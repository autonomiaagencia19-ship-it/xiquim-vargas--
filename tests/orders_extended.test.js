import request from 'supertest';
import { server } from '../server.js';
import { db, STORAGE } from '../src/db.js';
import { hashPassword } from '../src/auth.js';

describe('Orders Extended API', () => {
  let token;
  let clientId;
  let productId;
  let orderId;

  beforeAll(async () => {
    const admin = db.prepare('SELECT id FROM usuarios WHERE email=?').get('testadmin10@xiquim.local');
    if (!admin) {
      db.prepare('INSERT INTO usuarios (id, nome, email, senha_hash, role, ativo) VALUES (?, ?, ?, ?, ?, ?)').run(
        'test-admin-10', 'Test Admin 10', 'testadmin10@xiquim.local', hashPassword('TestPass123!'), 'admin', 1
      );
    }
    const resA = await request(server).post('/api/auth/login').send({ email: 'testadmin10@xiquim.local', password: 'TestPass123!' });
    token = resA.body.token;

    const pRes = await request(server)
      .post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ nome: 'Order Product', preco_base: 50 });
    productId = pRes.body.item.id;

    // Add stock so we can order
    await request(server).post(`/api/stock/${productId}`).set('Authorization', `Bearer ${token}`).send({ delta: 100, tipo: 'ENTRADA' });

    const uniqueCnpjOrder = `999${Date.now().toString().slice(-8)}`;
    const cRes = await request(server)
      .post('/api/clients')
      .set('Authorization', `Bearer ${token}`)
      .send({ razao_social: 'Order Client', cnpj_cpf: uniqueCnpjOrder, endereco: 'Rua X' });
    clientId = cRes.body.item.id;
  });

  afterAll(() => {
    server.close();
  });

  it('rejects duplicate product lines when their combined quantity exceeds stock without reserving partially', async () => {
    db.prepare('UPDATE estoque SET quantidade_disponivel=5, quantidade_reservada=0 WHERE produto_id=?').run(productId);
    const beforeOrders = db.prepare('SELECT COUNT(*) n FROM pedidos').get().n;
    const response = await request(server).post('/api/orders').set('Authorization', `Bearer ${token}`).send({
      cliente_id: clientId, origem: 'BALCAO', itens: [
        { produto_id: productId, quantidade: 4 }, { produto_id: productId, quantidade: 4 }
      ]
    });
    expect(response.status).toBe(409);
    expect(db.prepare('SELECT quantidade_disponivel, quantidade_reservada FROM estoque WHERE produto_id=?').get(productId)).toEqual({ quantidade_disponivel: 5, quantidade_reservada: 0 });
    expect(db.prepare('SELECT COUNT(*) n FROM pedidos').get().n).toBe(beforeOrders);
    db.prepare('UPDATE estoque SET quantidade_disponivel=100, quantidade_reservada=0 WHERE produto_id=?').run(productId);
  });

  it('consolidates duplicate lines and applies the customer tier price to every unit at its threshold', async () => {
    const tableId = `tier-table-${Date.now()}`;
    db.prepare('INSERT INTO tabelas_preco(id,nome) VALUES(?,?)').run(tableId, 'Tier test');
    db.prepare('INSERT INTO tabela_preco_itens(id,tabela_id,produto_id,preco,quantidade_minima) VALUES(?,?,?,?,?)').run(`tier-item-${Date.now()}`, tableId, productId, 7, 10);
    db.prepare('UPDATE clientes SET tabela_preco_id=? WHERE id=?').run(tableId, clientId);
    const catalog = await request(server).get(`/api/products?cliente_id=${clientId}`).set('Authorization', `Bearer ${token}`);
    const listed = catalog.body.items.find(product => product.id === productId);
    expect(listed.preco_tabela).toBe(7);
    expect(listed.quantidade_minima).toBe(10);

    const response = await request(server).post('/api/orders').set('Authorization', `Bearer ${token}`).send({
      cliente_id: clientId, origem: 'BALCAO', itens: [
        { produto_id: productId, quantidade: 5 }, { produto_id: productId, quantidade: 5 }
      ]
    });
    expect(response.status).toBe(201);
    const lines = db.prepare('SELECT quantidade, preco_unitario_aplicado, subtotal FROM pedido_itens WHERE pedido_id=?').all(response.body.item.id);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toEqual({ quantidade: 10, preco_unitario_aplicado: 7, subtotal: 70 });
    expect(response.body.item.total).toBe(70);
    db.prepare('UPDATE clientes SET tabela_preco_id=NULL WHERE id=?').run(clientId);
  });

  it('should create an order', async () => {
    const res = await request(server)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        cliente_id: clientId,
        itens: [{ produto_id: productId, quantidade: 2 }],
        origem: 'BALCAO'
      });
      
    expect(res.status).toBe(201);
    orderId = res.body.item.id;
  });

  it('should update an order', async () => {
    const res = await request(server)
      .put(`/api/orders/${orderId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        itens: [{ produto_id: productId, quantidade: 3 }],
        observacoes: 'Updated notes'
      });
      
    expect(res.status).toBe(200);
    expect(res.body.item.observacoes).toBe('Updated notes');
  });

  it('should change order status to SEPARACAO', async () => {
    const res = await request(server)
      .post(`/api/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'SEPARACAO' });
      
    expect(res.status).toBe(200);
    expect(res.body.item.status).toBe('SEPARACAO');
  });

  it('should get order detail', async () => {
    const res = await request(server)
      .get(`/api/orders/${orderId}/detail`)
      .set('Authorization', `Bearer ${token}`);
      
    expect(res.status).toBe(200);
    expect(res.body.order).toBeDefined();
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  it('should cancel order', async () => {
    const res = await request(server)
      .post(`/api/orders/${orderId}/cancel`)
      .set('Authorization', `Bearer ${token}`)
      .send({ motivo: 'Customer requested' });
      
    expect(res.status).toBe(200);
    expect(res.body.item.status).toBe('CANCELADO');
  });

  it('should list cancelled orders', async () => {
    const res = await request(server)
      .get(`/api/orders/cancelled`)
      .set('Authorization', `Bearer ${token}`);
      
    expect(res.status).toBe(200);
    expect(res.body.items.some(o => o.id === orderId)).toBe(true);
  });

  it('completes an in-route delivery without requiring a proof image', async () => {
    const created = await request(server).post('/api/orders').set('Authorization', `Bearer ${token}`).send({
      cliente_id: clientId, origem: 'BALCAO', itens: [{ produto_id: productId, quantidade: 1 }]
    });
    expect(created.status).toBe(201);
    db.prepare("UPDATE pedidos SET status='ROTA' WHERE id=?").run(created.body.item.id);
    const completed = await request(server).post(`/api/logistics/orders/${created.body.item.id}/complete`).set('Authorization', `Bearer ${token}`).send({});
    expect(completed.status).toBe(200);
    expect(completed.body.item.status).toBe('CONCLUIDO');
  });

  it('accepts a 6 MiB delivery proof and stores its path relative to persistent storage', async () => {
    const created = await request(server).post('/api/orders').set('Authorization', `Bearer ${token}`).send({
      cliente_id: clientId, origem: 'BALCAO', itens: [{ produto_id: productId, quantidade: 1 }]
    });
    expect(created.status).toBe(201);
    db.prepare("UPDATE pedidos SET status='ROTA' WHERE id=?").run(created.body.item.id);
    const image = Buffer.concat([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jf9sAAAAASUVORK5CYII=', 'base64'), Buffer.alloc(6 * 1024 * 1024)]);
    const uploaded = await request(server).post(`/api/logistics/orders/${created.body.item.id}/proof`)
      .set('Authorization', `Bearer ${token}`)
      .send({ data_url: `data:image/png;base64,${image.toString('base64')}` });
    expect(uploaded.status).toBe(201);
    const proof = db.prepare('SELECT arquivo_path FROM comprovantes_entrega WHERE pedido_id=?').get(created.body.item.id);
    expect(proof.arquivo_path.startsWith('proofs/')).toBe(true);
    expect(proof.arquivo_path.includes(STORAGE)).toBe(false);
  });
});
