import request from 'supertest';
import { server } from '../server.js';
import { db } from '../src/db.js';
import { hashPassword } from '../src/auth.js';

describe('Conclusão Direta na Lista de Carregamento (Sem Motorista)', () => {
  let adminToken;
  let driverId;
  let productId;
  let clientId;
  let order1Id, order2Id, order3Id;

  beforeAll(async () => {
    // Garante usuário admin
    const adminEmail = 'admin_direct_test@xiquim.local';
    let admin = db.prepare('SELECT id FROM usuarios WHERE email=?').get(adminEmail);
    if (!admin) {
      db.prepare('INSERT INTO usuarios (id, nome, email, senha_hash, role, ativo) VALUES (?, ?, ?, ?, ?, ?)').run(
        'usr-admin-direct', 'Admin Direct Test', adminEmail, hashPassword('TestPass123!'), 'admin', 1
      );
    }
    const resAuth = await request(server)
      .post('/api/auth/login')
      .send({ email: adminEmail, password: 'TestPass123!' });
    adminToken = resAuth.body.token;

    // Garante motorista
    const driverEmail = 'driver_direct_test@xiquim.local';
    let driver = db.prepare('SELECT id FROM usuarios WHERE email=?').get(driverEmail);
    if (!driver) {
      db.prepare('INSERT INTO usuarios (id, nome, email, senha_hash, role, ativo) VALUES (?, ?, ?, ?, ?, ?)').run(
        'usr-driver-direct', 'Driver Direct Test', driverEmail, hashPassword('TestPass123!'), 'driver', 1
      );
    }
    driverId = 'usr-driver-direct';

    // Cria cliente de teste
    clientId = 'cli-direct-' + Date.now();
    db.prepare('INSERT INTO clientes (id, razao_social, nome_fantasia, cnpj_cpf, endereco, bairro, cidade, estado, ativo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
      clientId, 'Cliente Teste Direto Ltda', 'Cliente Direto', '99.999.999/0001-99', 'Rua das Flores, 100', 'Centro', 'Gov. Valadares', 'MG', 1
    );

    // Cria produto de teste com 100 un de estoque
    productId = 'prod-direct-' + Date.now();
    db.prepare('INSERT INTO produtos (id, nome, sku, preco_base, ativo) VALUES (?, ?, ?, ?, ?)').run(
      productId, 'Fardo de Refrigerante 2L', 'SKU-' + productId, 50.00, 1
    );
    db.prepare('INSERT INTO estoque (produto_id, quantidade_disponivel, quantidade_reservada, estoque_minimo) VALUES (?, ?, ?, ?)').run(
      productId, 100, 0, 10
    );

    // Cria 3 pedidos em PENDENTE e avança para SEPARACAO
    // Pedido 1: 10 un (R$ 500)
    const o1 = await request(server)
      .post('/api/orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        cliente_id: clientId,
        origem: 'BALCAO',
        modalidade_entrega: 'ENTREGA',
        itens: [{ produto_id: productId, quantidade: 10 }]
      });
    order1Id = o1.body.item.id;
    await request(server).post(`/api/orders/${order1Id}/status`).set('Authorization', `Bearer ${adminToken}`).send({ status: 'SEPARACAO' });

    // Pedido 2: 15 un (R$ 750)
    const o2 = await request(server)
      .post('/api/orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        cliente_id: clientId,
        origem: 'VENDEDOR',
        modalidade_entrega: 'ENTREGA',
        itens: [{ produto_id: productId, quantidade: 15 }]
      });
    order2Id = o2.body.item.id;
    await request(server).post(`/api/orders/${order2Id}/status`).set('Authorization', `Bearer ${adminToken}`).send({ status: 'SEPARACAO' });

    // Pedido 3: 20 un (R$ 1000)
    const o3 = await request(server)
      .post('/api/orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        cliente_id: clientId,
        origem: 'WEB',
        modalidade_entrega: 'ENTREGA',
        itens: [{ produto_id: productId, quantidade: 20 }]
      });
    order3Id = o3.body.item.id;
    await request(server).post(`/api/orders/${order3Id}/status`).set('Authorization', `Bearer ${adminToken}`).send({ status: 'SEPARACAO' });
  });

  afterAll(() => {
    server.close();
  });

  it('Verifica a lista de carregamento com os 3 pedidos (45 un total)', async () => {
    const res = await request(server)
      .post('/api/logistics/loading-list')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ pedido_ids: [order1Id, order2Id, order3Id] });

    expect(res.status).toBe(200);
    expect(res.body.total_pedidos).toBe(3);
    expect(res.body.total_produtos).toBe(45);
  });

  it('Valida erro caso tente concluir direto sem passar pedido_ids', async () => {
    const res = await request(server)
      .post('/api/logistics/orders/complete-direct')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ pedido_ids: [] });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Selecione ao menos um pedido/i);
  });

  it('Conclui os pedidos 1 e 2 diretamente na lista de carregamento sem enviar a motorista', async () => {
    const res = await request(server)
      .post('/api/logistics/orders/complete-direct')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ pedido_ids: [order1Id, order2Id] });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.concluidos).toBe(2);

    // Verifica que pedidos 1 e 2 estão CONCLUIDO
    const det1 = await request(server).get(`/api/orders/${order1Id}/detail`).set('Authorization', `Bearer ${adminToken}`);
    expect(det1.body.order.status).toBe('CONCLUIDO');

    const det2 = await request(server).get(`/api/orders/${order2Id}/detail`).set('Authorization', `Bearer ${adminToken}`);
    expect(det2.body.order.status).toBe('CONCLUIDO');

    // Verifica que o estoque reservado foi baixado (10 + 15 = 25 un baixadas)
    const st = db.prepare('SELECT quantidade_reservada, quantidade_disponivel FROM estoque WHERE produto_id=?').get(productId);
    // 45 reservadas originalmente - 25 concluídas = 20 un reservadas (do pedido 3)
    expect(st.quantidade_reservada).toBe(20);

    // Verifica registro de movimentação SAIDA_VENDA
    const movs = db.prepare("SELECT * FROM movimentacoes_estoque WHERE produto_id=? AND tipo='SAIDA_VENDA'").all(productId);
    expect(movs.length).toBeGreaterThanOrEqual(2);
  });

  it('Mantém a opção de prosseguir com o motorista para os demais pedidos (Pedido 3)', async () => {
    // Pedido 3 continuou em SEPARACAO
    const det3 = await request(server).get(`/api/orders/${order3Id}/detail`).set('Authorization', `Bearer ${adminToken}`);
    expect(det3.body.order.status).toBe('SEPARACAO');

    // Cria rota normal com motorista para o Pedido 3
    const resRoute = await request(server)
      .post('/api/logistics/routes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        motorista_id: driverId,
        pedido_ids: [order3Id]
      });

    expect(resRoute.status).toBe(201);
    expect(resRoute.body.item.motorista_id).toBe(driverId);

    // Pedido 3 avançou para ROTA
    const afterRoute = await request(server).get(`/api/orders/${order3Id}/detail`).set('Authorization', `Bearer ${adminToken}`);
    expect(afterRoute.body.order.status).toBe('ROTA');

    // Motorista conclui normalmente a entrega do Pedido 3
    const resComp = await request(server)
      .post(`/api/logistics/orders/${order3Id}/complete`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(resComp.status).toBe(200);
    expect(resComp.body.item.status).toBe('CONCLUIDO');
  });
});
