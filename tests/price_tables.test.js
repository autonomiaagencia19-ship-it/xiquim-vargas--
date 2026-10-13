import request from 'supertest';
import { server } from '../server.js';
import { db } from '../src/db.js';
import { hashPassword } from '../src/auth.js';

describe('Price Tables API', () => {
  let token;
  let testProductId;

  beforeAll(async () => {
    const admin = db.prepare('SELECT id FROM usuarios WHERE email=?').get('testadmin9@xiquim.local');
    if (!admin) {
      db.prepare('INSERT INTO usuarios (id, nome, email, senha_hash, role, ativo) VALUES (?, ?, ?, ?, ?, ?)').run(
        'test-admin-9', 'Test Admin 9', 'testadmin9@xiquim.local', hashPassword('TestPass123!'), 'admin', 1
      );
    }
    const resA = await request(server).post('/api/auth/login').send({ email: 'testadmin9@xiquim.local', password: 'TestPass123!' });
    token = resA.body.token;

    const pRes = await request(server)
      .post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ nome: 'Price Table Product', preco_base: 100 });
    testProductId = pRes.body.item.id;
  });

  afterAll(() => {
    server.close();
  });

  let tableId;

  it('should create price table', async () => {
    const res = await request(server)
      .post('/api/price-tables')
      .set('Authorization', `Bearer ${token}`)
      .send({
        nome: 'Tabela Teste',
        itens: [{ produto_id: testProductId, preco: 90 }]
      });
      
    expect(res.status).toBe(201);
    expect(res.body.item).toBeDefined();
    tableId = res.body.item.id;
  });

  it('should update price table and items', async () => {
    const res = await request(server)
      .put(`/api/price-tables/${tableId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        nome: 'Tabela Teste Modificada',
        itens: [{ produto_id: testProductId, preco: 85 }]
      });
      
    expect(res.status).toBe(200);
    expect(res.body.item.nome).toBe('Tabela Teste Modificada');
  });

  it('should list price table items', async () => {
    const res = await request(server)
      .get(`/api/price-tables/${tableId}/items`)
      .set('Authorization', `Bearer ${token}`);
      
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items[0].preco).toBe(85);
  });

  it('should get price table dashboard details', async () => {
    db.prepare('DELETE FROM clientes WHERE id=? OR cnpj_cpf=?').run('test-client-pt-1', '99988877766');
    db.prepare(`
      INSERT INTO clientes (id, razao_social, cnpj_cpf, endereco, tabela_preco_id)
      VALUES (?, ?, ?, ?, ?)
    `).run('test-client-pt-1', 'Cliente Teste Tabela', '99988877766', 'Rua Teste', tableId);

    const res = await request(server)
      .get(`/api/price-tables/${tableId}/details`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.table).toBeDefined();
    expect(res.body.kpis.totalClients).toBeGreaterThanOrEqual(1);
    expect(res.body.clients.some(c => c.id === 'test-client-pt-1')).toBe(true);
  });

  it('should remove client from price table', async () => {
    const res = await request(server)
      .delete(`/api/price-tables/${tableId}/clients/test-client-pt-1`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    const checkClient = db.prepare('SELECT tabela_preco_id FROM clientes WHERE id=?').get('test-client-pt-1');
    expect(checkClient.tabela_preco_id).toBeNull();
  });

  it('should apply price table to specific seller clients', async () => {
    const seller = db.prepare('SELECT id FROM usuarios WHERE role=?').get('seller');
    const sellerId = seller ? seller.id : 'seller-test-1';
    if (!seller) {
      db.prepare('INSERT INTO usuarios (id, nome, email, senha_hash, role, ativo) VALUES (?, ?, ?, ?, ?, ?)').run(
        sellerId, 'Vendedor Teste', 'seller1@xiquim.local', hashPassword('TestPass123!'), 'seller', 1
      );
    }
    db.prepare('UPDATE clientes SET vendedor_id=? WHERE id=?').run(sellerId, 'test-client-pt-1');

    const res = await request(server)
      .post('/api/price-tables/apply')
      .set('Authorization', `Bearer ${token}`)
      .send({
        tabela_id: tableId,
        target: 'VENDEDOR',
        vendedor_id: sellerId
      });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    const checkClient = db.prepare('SELECT tabela_preco_id FROM clientes WHERE id=?').get('test-client-pt-1');
    expect(checkClient.tabela_preco_id).toBe(tableId);
  });

  it('should remove group from price table', async () => {
    const res = await request(server)
      .delete(`/api/price-tables/${tableId}/groups/vendedor`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    const checkClient = db.prepare('SELECT tabela_preco_id FROM clientes WHERE id=?').get('test-client-pt-1');
    expect(checkClient.tabela_preco_id).toBeNull();
  });

  it('should delete price table completely', async () => {
    const res = await request(server)
      .delete(`/api/price-tables/${tableId}`)
      .set('Authorization', `Bearer ${token}`);
      
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    const checkTable = db.prepare('SELECT * FROM tabelas_preco WHERE id=?').get(tableId);
    expect(checkTable).toBeUndefined();

    const checkItems = db.prepare('SELECT * FROM tabela_preco_itens WHERE tabela_id=?').all(tableId);
    expect(checkItems.length).toBe(0);
  });
});
