import request from 'supertest';
import { server } from '../server.js';
import { db } from '../src/db.js';
import { hashPassword } from '../src/auth.js';

describe('Exhaustive Logistics & Delivery Lifecycle Test Suite', () => {
  let adminToken;
  let driverToken;
  let driverId;
  let driver2Id;
  let productId;
  let clients = [];
  let orders = [];
  let routeId;

  beforeAll(async () => {
    // 1. Setup Admin
    const adminEmail = `admin_log_${Date.now()}@xiquim.local`;
    const adminId = `adm-log-${Date.now()}`;
    db.prepare('INSERT INTO usuarios (id, nome, email, senha_hash, role, ativo) VALUES (?, ?, ?, ?, ?, ?)').run(
      adminId, 'Admin Logística', adminEmail, hashPassword('AdminPass123!'), 'admin', 1
    );
    const loginRes = await request(server).post('/api/auth/login').send({ email: adminEmail, password: 'AdminPass123!' });
    adminToken = loginRes.body.token;

    // 2. Setup Driver 1
    const driverEmail = `driver_log_${Date.now()}@xiquim.local`;
    driverId = `drv-log-1-${Date.now()}`;
    db.prepare('INSERT INTO usuarios (id, nome, email, senha_hash, role, ativo) VALUES (?, ?, ?, ?, ?, ?)').run(
      driverId, 'Carlos Motorista 1', driverEmail, hashPassword('DriverPass123!'), 'driver', 1
    );
    const drvLoginRes = await request(server).post('/api/auth/login').send({ email: driverEmail, password: 'DriverPass123!' });
    driverToken = drvLoginRes.body.token;

    // 3. Setup Driver 2
    const driver2Email = `driver2_log_${Date.now()}@xiquim.local`;
    driver2Id = `drv-log-2-${Date.now()}`;
    db.prepare('INSERT INTO usuarios (id, nome, email, senha_hash, role, ativo) VALUES (?, ?, ?, ?, ?, ?)').run(
      driver2Id, 'Marcos Motorista 2', driver2Email, hashPassword('DriverPass123!'), 'driver', 1
    );

    // 4. Create Product with Stock
    const pRes = await request(server)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ nome: 'Bebida Premium Teste', preco_base: 15.00 });
    productId = pRes.body.item.id;
    await request(server)
      .post(`/api/stock/${productId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ delta: 500, tipo: 'ENTRADA' });

    // 5. Create Clients in Different Neighborhoods
    const bairros = ['Centro', 'Vila Isa', 'JK', 'Ilha dos Araújos', 'Santa Rita'];
    for (let i = 0; i < bairros.length; i++) {
      const cRes = await request(server)
        .post('/api/clients')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          razao_social: `Supermercado ${bairros[i]} Ltda`,
          nome_fantasia: `Mercado ${bairros[i]}`,
          cnpj_cpf: `98${Date.now().toString().slice(-8)}${i}`,
          endereco: `Avenida Principal, ${100 + i * 25}`,
          bairro: bairros[i],
          telefone: `3398888000${i}`
        });
      clients.push(cRes.body.item);
    }
  });

  afterAll(() => {
    server.close();
  });

  // ==========================================
  // OPERAÇÃO 1 a 5: CRIAÇÃO DE PEDIDOS VARIADOS
  // ==========================================
  it('OP 1: Cria pedido de Balcão marcado para ENTREGA', async () => {
    const res = await request(server)
      .post('/api/orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        cliente_id: clients[0].id,
        origem: 'BALCAO',
        modalidade_entrega: 'ENTREGA',
        forma_pagamento: 'DINHEIRO',
        itens: [{ produto_id: productId, quantidade: 10 }]
      });
    expect(res.status).toBe(201);
    expect(res.body.item.modalidade_entrega).toBe('ENTREGA');
    orders.push(res.body.item);
  });

  it('OP 2: Cria pedido de Vendedor Externo com entrega no Vila Isa', async () => {
    const res = await request(server)
      .post('/api/orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        cliente_id: clients[1].id,
        origem: 'VENDEDOR',
        modalidade_entrega: 'ENTREGA',
        forma_pagamento: 'PIX',
        itens: [{ produto_id: productId, quantidade: 20 }]
      });
    expect(res.status).toBe(201);
    orders.push(res.body.item);
  });

  it('OP 3: Cria pedido da Loja Online (Web) no bairro JK', async () => {
    const res = await request(server)
      .post('/api/orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        cliente_id: clients[2].id,
        origem: 'WEB',
        modalidade_entrega: 'ENTREGA',
        forma_pagamento: 'PIX',
        itens: [{ produto_id: productId, quantidade: 15 }]
      });
    expect(res.status).toBe(201);
    orders.push(res.body.item);
  });

  it('OP 4: Cria segundo pedido no Centro (agrupamento no mesmo bairro)', async () => {
    const res = await request(server)
      .post('/api/orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        cliente_id: clients[0].id,
        origem: 'VENDEDOR',
        modalidade_entrega: 'ENTREGA',
        forma_pagamento: 'DINHEIRO',
        itens: [{ produto_id: productId, quantidade: 5 }]
      });
    expect(res.status).toBe(201);
    orders.push(res.body.item);
  });

  it('OP 5: Cria pedido no bairro Ilha dos Araújos', async () => {
    const res = await request(server)
      .post('/api/orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        cliente_id: clients[3].id,
        origem: 'WEB',
        modalidade_entrega: 'ENTREGA',
        forma_pagamento: 'PIX',
        itens: [{ produto_id: productId, quantidade: 8 }]
      });
    expect(res.status).toBe(201);
    orders.push(res.body.item);
  });

  // ==========================================
  // OPERAÇÃO 6 a 8: FLUXO DE SEPARAÇÃO E AGRUPAMENTO
  // ==========================================
  it('OP 6: Move todos os pedidos de PENDENTE para SEPARACAO', async () => {
    for (const o of orders) {
      const res = await request(server)
        .post(`/api/orders/${o.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'SEPARACAO' });
      expect(res.status).toBe(200);
      expect(res.body.item.status).toBe('SEPARACAO');
    }
  });

  it('OP 7: Consulta pedidos agrupados por origem e bairro para expedição', async () => {
    const res = await request(server)
      .get('/api/logistics/grouped-orders')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.grupos).toBeDefined();

    // Valida que Centro tem múltiplos pedidos
    const todosSubgrupos = res.body.grupos.flatMap(g => g.subgrupos);
    const centroGroup = todosSubgrupos.find(sg => sg.bairro === 'Centro');
    expect(centroGroup).toBeDefined();
    expect(centroGroup.pedidos.length).toBeGreaterThanOrEqual(1);
  });

  it('OP 8: Gera lista de carregamento consolidada de produtos do armazém', async () => {
    const ids = orders.map(o => o.id);
    const res = await request(server)
      .post('/api/logistics/loading-list')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ pedido_ids: ids });
    expect(res.status).toBe(200);
    expect(res.body.total_pedidos).toBe(ids.length);
    // 10 + 20 + 15 + 5 + 8 = 58 un
    expect(res.body.total_produtos).toBe(58);
  });

  // ==========================================
  // OPERAÇÃO 9 a 12: CRIAÇÃO DE ROTA E ROTEIRIZAÇÃO
  // ==========================================
  it('OP 9: Cria rota de entrega e designa motorista (Carlos Motorista 1)', async () => {
    const ids = [orders[0].id, orders[1].id, orders[2].id];
    const res = await request(server)
      .post('/api/logistics/routes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        motorista_id: driverId,
        pedido_ids: ids
      });
    expect(res.status).toBe(201);
    expect(res.body.item).toBeDefined();
    expect(res.body.item.motorista_id).toBe(driverId);
    expect(res.body.ordered).toHaveLength(3);
    routeId = res.body.item.id;
  });

  it('OP 10: Verifica que os pedidos da rota mudaram automaticamente para status ROTA', async () => {
    const ids = [orders[0].id, orders[1].id, orders[2].id];
    for (const id of ids) {
      const res = await request(server)
        .get(`/api/orders/${id}/detail`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.order.status).toBe('ROTA');
    }
  });

  it('OP 11: Impede adicionar pedidos que já estão em rota a uma nova rota', async () => {
    const res = await request(server)
      .post('/api/logistics/routes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        motorista_id: driver2Id,
        pedido_ids: [orders[0].id]
      });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/Somente pedidos PENDENTES ou em SEPARAÇÃO/i);
  });

  it('OP 12: Lista rotas ativas do motorista logado', async () => {
    const res = await request(server)
      .get('/api/logistics/routes')
      .set('Authorization', `Bearer ${driverToken}`);
    expect(res.status).toBe(200);
    expect(res.body.items.some(r => r.id === routeId)).toBe(true);
  });

  // ==========================================
  // OPERAÇÃO 13 a 17: ENTREGAS CONCLUÍDAS E COMPROVANTE
  // ==========================================
  it('OP 13: Anexa comprovante de entrega (foto/assinatura) no pedido 1', async () => {
    const dummyBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const res = await request(server)
      .post(`/api/logistics/orders/${orders[0].id}/proof`)
      .set('Authorization', `Bearer ${driverToken}`)
      .send({ data_url: dummyBase64 });
    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
  });

  it('OP 14: Conclui com sucesso a entrega da parada 1 (pedido 1)', async () => {
    const res = await request(server)
      .post(`/api/logistics/orders/${orders[0].id}/complete`)
      .set('Authorization', `Bearer ${driverToken}`);
    expect(res.status).toBe(200);
    expect(res.body.item.status).toBe('CONCLUIDO');
  });

  // ==========================================
  // OPERAÇÃO 15 a 17: PEDIDO DEVOLVIDO / RETORNADO
  // ==========================================
  it('OP 15: Marca a parada 2 (pedido 2) como RETORNO/DEVOLUÇÃO por motivo comercial', async () => {
    const res = await request(server)
      .post(`/api/logistics/orders/${orders[1].id}/fail`)
      .set('Authorization', `Bearer ${driverToken}`)
      .send({
        motivo: 'Cliente ausente / estabelecimento fechado',
        descricao: 'Motorista tentou entrega às 14h30, ninguém atendeu.'
      });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    // Pedido devolvido deve retornar a SEPARACAO para ser re-roteirizado
    expect(res.body.item.status).toBe('SEPARACAO');
  });

  it('OP 16: Consulta lista de pedidos que retornaram no dashboard de devoluções', async () => {
    const res = await request(server)
      .get('/api/logistics/returned-orders')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    const returned = res.body.items.find(x => x.pedido_id === orders[1].id);
    expect(returned).toBeDefined();
    expect(returned.motivo).toBe('Cliente ausente / estabelecimento fechado');
    expect(returned.motorista_nome).toBe('Carlos Motorista 1');
  });

  it('OP 17: Conclui a parada 3 (pedido 3), finalizando todos os pedidos restantes da rota', async () => {
    const res = await request(server)
      .post(`/api/logistics/orders/${orders[2].id}/complete`)
      .set('Authorization', `Bearer ${driverToken}`);
    expect(res.status).toBe(200);
    expect(res.body.item.status).toBe('CONCLUIDO');
  });

  // ==========================================
  // OPERAÇÃO 18: ROTA CONCLUÍDA NO HISTÓRICO
  // ==========================================
  it('OP 18: Valida que a rota mudou de status para CONCLUIDA no histórico de rotas', async () => {
    const res = await request(server)
      .get('/api/logistics/completed-routes')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.items).toBeDefined();
    const completedRoute = res.body.items.find(r => r.id === routeId);
    expect(completedRoute).toBeDefined();
    expect(completedRoute.status).toBe('CONCLUIDA');
  });

  // ==========================================
  // OPERAÇÃO 19 a 20: RE-ROTEIRIZAÇÃO DO PEDIDO DEVOLVIDO
  // ==========================================
  it('OP 19: Re-roteiriza o pedido que retornou junto com novos pedidos pendentes em uma Rota 2', async () => {
    // orders[1] retornou a SEPARACAO, e orders[3], orders[4] estavam em SEPARACAO
    const ids = [orders[1].id, orders[3].id, orders[4].id];
    const res = await request(server)
      .post('/api/logistics/routes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        motorista_id: driver2Id,
        pedido_ids: ids
      });
    expect(res.status).toBe(201);
    expect(res.body.item.motorista_id).toBe(driver2Id);
    const rota2Id = res.body.item.id;

    // Conclui todos os 3 pedidos da Rota 2
    for (const pid of ids) {
      const cRes = await request(server)
        .post(`/api/logistics/orders/${pid}/complete`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(cRes.status).toBe(200);
    }

    // Verifica que a Rota 2 foi concluída
    const compRes = await request(server)
      .get('/api/logistics/completed-routes')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(compRes.body.items.some(r => r.id === rota2Id && r.status === 'CONCLUIDA')).toBe(true);
  });

  // ==========================================
  // OPERAÇÃO 21 a 25: GESTÃO DO CRONOGRAMA SEMANAL (6 DIAS E CUSTOMIZAÇÕES)
  // ==========================================
  it('OP 20: Salva o cronograma semanal de 6 dias com designação de motoristas e bairros', async () => {
    const weeklySchedule = [
      { dia: 1, dia_nome: 'Segunda-feira', motorista_id: driverId, motorista_nome: 'Carlos Motorista 1', bairros: ['Centro', 'JK'] },
      { dia: 2, dia_nome: 'Terça-feira', motorista_id: driver2Id, motorista_nome: 'Marcos Motorista 2', bairros: ['Vila Isa'] },
      { dia: 3, dia_nome: 'Quarta-feira', motorista_id: driverId, motorista_nome: 'Carlos Motorista 1', bairros: ['Ilha dos Araújos'] },
      { dia: 4, dia_nome: 'Quinta-feira', motorista_id: driver2Id, motorista_nome: 'Marcos Motorista 2', bairros: ['Santa Rita'] },
      { dia: 5, dia_nome: 'Sexta-feira', motorista_id: driverId, motorista_nome: 'Carlos Motorista 1', bairros: ['Centro', 'São Pedro'] },
      { dia: 6, dia_nome: 'Sábado', motorista_id: null, motorista_nome: null, bairros: ['Plantão Geral'] }
    ];

    const res = await request(server)
      .post('/api/logistics/delivery-routes-config')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ items: weeklySchedule, schedule: weeklySchedule });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.items).toHaveLength(6);
  });

  it('OP 21: Consulta o cronograma semanal e valida os 6 dias e motoristas designados', async () => {
    const res = await request(server)
      .get('/api/logistics/delivery-routes-config')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(6);
    expect(res.body.items[0].dia_nome).toBe('Segunda-feira');
    expect(res.body.items[0].motorista_id).toBe(driverId);
    expect(res.body.items[0].bairros).toContain('Centro');
    expect(res.body.items[1].motorista_id).toBe(driver2Id);
    expect(res.body.items[5].bairros).toContain('Plantão Geral');
  });

  it('OP 22: Adiciona dia customizado (Domingo - Rota de Eventos)', async () => {
    const getRes = await request(server)
      .get('/api/logistics/delivery-routes-config')
      .set('Authorization', `Bearer ${adminToken}`);
    const schedule = getRes.body.items;
    schedule.push({
      dia: 7,
      dia_nome: 'Domingo',
      motorista_id: driverId,
      motorista_nome: 'Carlos Motorista 1',
      bairros: ['Parque de Exposições', 'Centro']
    });

    const postRes = await request(server)
      .post('/api/logistics/delivery-routes-config')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ items: schedule, schedule });
    expect(postRes.status).toBe(200);
    expect(postRes.body.items).toHaveLength(7);
  });

  it('OP 23: Remove dia customizado do cronograma mantendo os 6 dias principais', async () => {
    const getRes = await request(server)
      .get('/api/logistics/delivery-routes-config')
      .set('Authorization', `Bearer ${adminToken}`);
    const filtered = getRes.body.items.filter(d => d.dia !== 7);

    const postRes = await request(server)
      .post('/api/logistics/delivery-routes-config')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ items: filtered, schedule: filtered });
    expect(postRes.status).toBe(200);
    expect(postRes.body.items).toHaveLength(6);
  });
});
