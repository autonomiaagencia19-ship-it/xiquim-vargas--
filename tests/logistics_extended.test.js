import request from 'supertest';
import { server } from '../server.js';
import { db } from '../src/db.js';
import { hashPassword } from '../src/auth.js';

describe('Logistics Extended API', () => {
  let token;
  let sellerId;

  beforeAll(async () => {
    const admin = db.prepare('SELECT id FROM usuarios WHERE email=?').get('testadmin11@xiquim.local');
    if (!admin) {
      db.prepare('INSERT INTO usuarios (id, nome, email, senha_hash, role, ativo) VALUES (?, ?, ?, ?, ?, ?)').run(
        'test-admin-11', 'Test Admin 11', 'testadmin11@xiquim.local', hashPassword('TestPass123!'), 'admin', 1
      );
    }
    const resA = await request(server).post('/api/auth/login').send({ email: 'testadmin11@xiquim.local', password: 'TestPass123!' });
    token = resA.body.token;

    const seller = db.prepare('SELECT id FROM usuarios WHERE email=?').get('testseller11@xiquim.local');
    if (!seller) {
      db.prepare('INSERT INTO usuarios (id, nome, email, senha_hash, role, ativo) VALUES (?, ?, ?, ?, ?, ?)').run(
        'test-seller-11', 'Test Seller 11', 'testseller11@xiquim.local', hashPassword('TestPass123!'), 'seller', 1
      );
    }
    sellerId = 'test-seller-11';
  });

  afterAll(() => {
    server.close();
  });

  let routeId;

  it('should create route config', async () => {
    const res = await request(server)
      .post('/api/logistics/route-config')
      .set('Authorization', `Bearer ${token}`)
      .send({
        nome: 'Rota Leste',
        dia_semana: 3,
        bairros: ['Bairro 1', 'Bairro 2']
      });
      
    expect(res.status).toBe(201);
    routeId = res.body.item.id;
  });

  it('should list route configs', async () => {
    const res = await request(server)
      .get('/api/logistics/route-config')
      .set('Authorization', `Bearer ${token}`);
      
    expect(res.status).toBe(200);
    expect(res.body.routes.some(r => r.id === routeId)).toBe(true);
  });

  it('should assign seller to route', async () => {
    const res = await request(server)
      .post('/api/logistics/route-assignments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        dia_semana: 3,
        vendedor_id: sellerId,
        rota_config_id: routeId
      });
      
    expect(res.status).toBe(200);
  });

  it('should get grouped orders', async () => {
    const res = await request(server)
      .get('/api/logistics/grouped-orders')
      .set('Authorization', `Bearer ${token}`);
      
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.grupos)).toBe(true);
  });

  it('marks stop as not completed, rolls back order to SEPARACAO, records return and reconciles stock', async () => {
    // 1. Create product, stock, client, and order
    const pRes = await request(server)
      .post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ nome: 'Logistics Product Test', preco_base: 35 });
    const testProdId = pRes.body.item.id;
    await request(server)
      .post(`/api/stock/${testProdId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ delta: 50, tipo: 'ENTRADA' });

    const cRes = await request(server)
      .post('/api/clients')
      .set('Authorization', `Bearer ${token}`)
      .send({
        razao_social: 'Cliente Retorno Teste',
        cnpj_cpf: `888${Date.now().toString().slice(-8)}`,
        endereco: 'Av Principal, 500',
        bairro: 'Centro',
        telefone: '11987654321'
      });
    const testClientId = cRes.body.item.id;

    const oRes = await request(server)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        cliente_id: testClientId,
        origem: 'VENDEDOR',
        modalidade_entrega: 'ENTREGA',
        itens: [{ produto_id: testProdId, quantidade: 3 }]
      });
    const testOrderId = oRes.body.item.id;
    expect(oRes.body.item.status).toBe('PENDENTE');

    // 2. Advance to SEPARACAO
    await request(server)
      .post(`/api/orders/${testOrderId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'SEPARACAO' });

    // 3. Create route with this order -> transitions to ROTA
    const rRes = await request(server)
      .post('/api/logistics/routes')
      .set('Authorization', `Bearer ${token}`)
      .send({ pedido_ids: [testOrderId] });
    expect(rRes.status).toBe(201);
    const createdRouteId = rRes.body.item.id;

    const inRouteOrder = db.prepare('SELECT status FROM pedidos WHERE id=?').get(testOrderId);
    expect(inRouteOrder.status).toBe('ROTA');

    // 4. Driver marks stop as not completed (failed)
    const failRes = await request(server)
      .post(`/api/logistics/orders/${testOrderId}/fail`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        motivo: 'Cliente não se encontra no local',
        descricao: 'Campainha não atendeu após 3 tentativas.'
      });
    expect(failRes.status).toBe(200);
    expect(failRes.body.item.status).toBe('SEPARACAO');

    // 5. Verify order is unlinked from route and route is closed
    const rel = db.prepare('SELECT * FROM rota_pedidos WHERE pedido_id=?').get(testOrderId);
    expect(rel).toBeUndefined();

    const routeDb = db.prepare('SELECT status FROM rotas_logistica WHERE id=?').get(createdRouteId);
    expect(routeDb.status).toBe('CONCLUIDA');

    // 6. Verify return record exists in database
    const retDb = db.prepare('SELECT * FROM pedido_retornos WHERE pedido_id=?').get(testOrderId);
    expect(retDb).toBeDefined();
    expect(retDb.motivo).toBe('Cliente não se encontra no local');
    expect(retDb.descricao).toBe('Campainha não atendeu após 3 tentativas.');

    // 7. Verify returned orders endpoint lists the item
    const listRetRes = await request(server)
      .get('/api/logistics/returned-orders')
      .set('Authorization', `Bearer ${token}`);
    expect(listRetRes.status).toBe(200);
    const returnedEntry = listRetRes.body.items.find(x => x.pedido_id === testOrderId);
    expect(returnedEntry).toBeDefined();
    expect(returnedEntry.motivo).toBe('Cliente não se encontra no local');
    expect(returnedEntry.cliente_telefone).toBe('11987654321');
    expect(returnedEntry.status).toBe('SEPARACAO');

    // 8. Verify stock reserve is preserved without leaks and passes audit reconcile
    const recRes = await request(server)
      .get('/api/admin/reconcile')
      .set('Authorization', `Bearer ${token}`);
    expect(recRes.status).toBe(200);
    expect(recRes.body.ok).toBe(true);
    expect(recRes.body.mismatches).toEqual([]);

    // 9. Verify order is immediately eligible again in grouped-orders under SEPARACAO
    const groupedRes = await request(server)
      .get('/api/logistics/grouped-orders')
      .set('Authorization', `Bearer ${token}`);
    expect(groupedRes.status).toBe(200);
    const vendorGroup = groupedRes.body.grupos.find(g => g.grupo === 'VENDEDOR');
    const orderInGroup = vendorGroup?.subgrupos.flatMap(sg => sg.pedidos).find(p => p.id === testOrderId);
    expect(orderInGroup).toBeDefined();
    expect(orderInGroup.status).toBe('SEPARACAO');
  });
});

