import request from 'supertest';
import http from 'node:http';
import { server } from '../server.js';
import { db } from '../src/db.js';
import { hashPassword } from '../src/auth.js';

function openSseListener(port, ticket) {
  const received = [];
  let reqStream;
  const ready = new Promise((resolve, reject) => {
    reqStream = http.get(`http://127.0.0.1:${port}/api/events?ticket=${encodeURIComponent(ticket)}`, res => {
      res.setEncoding('utf8');
      res.on('data', chunk => {
        const lines = String(chunk).split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              received.push(JSON.parse(line.slice(6)));
            } catch {}
          }
        }
      });
      resolve();
    });
    reqStream.on('error', err => {
      if (err.code !== 'ECONNRESET') reject(err);
    });
  });
  return {
    ready,
    received,
    close: () => { try { reqStream.destroy(); } catch {} }
  };
}

describe('Fluxos Dinâmicos: Novo Produto na Tabela e Edição de Preço / Qtd Mínima', () => {
  let adminToken, sellerToken;
  let sellerId = 'dyn-seller-1';
  let tableId;
  let initialProductId;
  let newProductId;
  let existingClientId;
  let webClientId;
  let webToken;
  let serverPort;

  beforeAll(async () => {
    if (!server.listening) {
      await new Promise(resolve => server.listen(0, resolve));
    }
    serverPort = server.address().port;

    if (!db.prepare('SELECT id FROM usuarios WHERE email=?').get('dynadmin@xiquim.local')) {
      db.prepare('INSERT INTO usuarios (id, nome, email, senha_hash, role, ativo) VALUES (?, ?, ?, ?, ?, ?)').run(
        'dyn-admin-1', 'Dyn Admin', 'dynadmin@xiquim.local', hashPassword('TestPass123!'), 'admin', 1
      );
    }
    if (!db.prepare('SELECT id FROM usuarios WHERE email=?').get('dynseller@xiquim.local')) {
      db.prepare('INSERT INTO usuarios (id, nome, email, senha_hash, role, ativo) VALUES (?, ?, ?, ?, ?, ?)').run(
        sellerId, 'Dyn Seller', 'dynseller@xiquim.local', hashPassword('TestPass123!'), 'seller', 1
      );
    }

    adminToken = (await request(server).post('/api/auth/login').send({ email: 'dynadmin@xiquim.local', password: 'TestPass123!' })).body.token;
    sellerToken = (await request(server).post('/api/auth/login').send({ email: 'dynseller@xiquim.local', password: 'TestPass123!' })).body.token;

    // Cria produto inicial com estoque suficiente
    const p1 = await request(server).post('/api/products').set('Authorization', `Bearer ${adminToken}`).send({ nome: 'Bebida Base 1', preco_base: 100 });
    initialProductId = p1.body.item.id;
    await request(server).post(`/api/stock/${initialProductId}`).set('Authorization', `Bearer ${adminToken}`).send({ tipo: 'ENTRADA', delta: 500 });

    // Cria tabela global ALL com o produto inicial (R$ 80, mín. 5 un)
    const tbl = await request(server).post('/api/price-tables').set('Authorization', `Bearer ${adminToken}`).send({
      nome: 'Tabela Atacado Dinâmica',
      itens: [{ produto_id: initialProductId, preco: 80, quantidade_minima: 5 }]
    });
    tableId = tbl.body.item.id;
    await request(server).post('/api/price-tables/apply').set('Authorization', `Bearer ${adminToken}`).send({ tabela_id: tableId, target: 'ALL' });

    // Cadastra cliente via Vendedor e outro via Web (ambos herdam tableId automaticamente)
    const cSeller = await request(server).post('/api/clients').set('Authorization', `Bearer ${sellerToken}`).send({
      razao_social: 'Cliente Dinâmico Vendedor',
      cnpj_cpf: '55666777000125',
      endereco: 'Rua A, 10',
      bairro: 'Centro'
    });
    existingClientId = cSeller.body.item.id;

    const cWeb = await request(server).post('/api/store/register').send({
      nome: 'Cliente Dinâmico Web',
      email: 'dynweb@xiquim.local',
      password: 'WebPassword123!',
      endereco: 'Rua B, 20',
      bairro: 'Centro',
      telefone: '33988887777'
    });
    webToken = cWeb.body.token;
    webClientId = db.prepare('SELECT cliente_id FROM usuario_clientes WHERE usuario_id=?').get(cWeb.body.user.id).cliente_id;
  });

  afterAll(() => {
    db.prepare("DELETE FROM configuracoes WHERE chave='mass_price_table_all'").run();
    server.close();
  });

  it('Fluxo 1: Novo produto criado e adicionado na tabela reflete automaticamente via SSE, catálogo e pedido sem reaplicar tabela', async () => {
    const sellerTicket = (await request(server).post('/api/events/ticket').set('Authorization', `Bearer ${sellerToken}`)).body.ticket;
    const webTicket = (await request(server).post('/api/events/ticket').set('Authorization', `Bearer ${webToken}`)).body.ticket;
    const sellerSse = openSseListener(serverPort, sellerTicket);
    const webSse = openSseListener(serverPort, webTicket);
    await Promise.all([sellerSse.ready, webSse.ready]);

    try {
      // 1) Admin cria produto novo
      const p2 = await request(server).post('/api/products').set('Authorization', `Bearer ${adminToken}`).send({ nome: 'Cerveja Nova Premium', preco_base: 120 });
      expect(p2.status).toBe(201);
      newProductId = p2.body.item.id;
      await request(server).post(`/api/stock/${newProductId}`).set('Authorization', `Bearer ${adminToken}`).send({ tipo: 'ENTRADA', delta: 500 });

      // 2) Admin adiciona esse novo produto na tabela mantendo o item anterior (simula salvar modal priceTableItems com replace_all: true)
      const updRes = await request(server)
        .put(`/api/price-tables/${tableId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          replace_all: true,
          itens: [
            { produto_id: initialProductId, preco: 80, quantidade_minima: 5 },
            { produto_id: newProductId, preco: 95, quantidade_minima: 4 }
          ]
        });
      expect(updRes.status).toBe(200);

      // Aguarda propagação SSE
      await new Promise(r => setTimeout(r, 80));

      // Valida eventos SSE recebidos pelo vendedor e cliente web
      expect(sellerSse.received.some(e => e.type === 'products_changed')).toBe(true);
      expect(sellerSse.received.some(e => e.type === 'prices_changed')).toBe(true);
      expect(webSse.received.some(e => e.type === 'products_changed')).toBe(true);
      expect(webSse.received.some(e => e.type === 'prices_changed')).toBe(true);

      // Valida que clientes já vinculados veem o novo produto com preço diferenciado sem reaplicar
      const sellerCatalog = await request(server).get(`/api/products?cliente_id=${existingClientId}`).set('Authorization', `Bearer ${sellerToken}`);
      const itemSeller = sellerCatalog.body.items.find(x => x.id === newProductId);
      expect(itemSeller.preco_base).toBe(120);
      expect(itemSeller.preco_tabela).toBe(95);
      expect(itemSeller.quantidade_minima).toBe(4);
      expect(itemSeller.preco_aplicado).toBe(120); // Abaixo de 4 un, preco_aplicado padrão permanece 120

      const webCatalog = await request(server).get(`/api/products?cliente_id=${webClientId}`).set('Authorization', `Bearer ${webToken}`);
      const itemWeb = webCatalog.body.items.find(x => x.id === newProductId);
      expect(itemWeb.preco_tabela).toBe(95);
      expect(itemWeb.quantidade_minima).toBe(4);

      // Valida cobrança real em pedido ao atingir quantidade mínima (4 un -> 4 * 95 = 380)
      const orderRes = await request(server)
        .post('/api/orders')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({
          cliente_id: existingClientId,
          origem: 'VENDEDOR',
          itens: [{ produto_id: newProductId, quantidade: 4 }]
        });
      expect(orderRes.status).toBe(201);
      expect(orderRes.body.item.total).toBe(380);
    } finally {
      sellerSse.close();
      webSse.close();
    }
  });

  it('Fluxo 2: Edição de preço e quantidade mínima na tabela atualiza automaticamente catálogo, pedido e dispara SSE', async () => {
    const sellerTicket = (await request(server).post('/api/events/ticket').set('Authorization', `Bearer ${sellerToken}`)).body.ticket;
    const sellerSse = openSseListener(serverPort, sellerTicket);
    await sellerSse.ready;

    try {
      // 1) Reduz preço para 65 e reduz quantidade mínima de 5 para 3 unidades no produto inicial
      const editRes = await request(server)
        .put(`/api/price-tables/${tableId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          replace_all: true,
          itens: [
            { produto_id: initialProductId, preco: 65, quantidade_minima: 3 },
            { produto_id: newProductId, preco: 95, quantidade_minima: 4 }
          ]
        });
      expect(editRes.status).toBe(200);

      await new Promise(r => setTimeout(r, 80));
      expect(sellerSse.received.some(e => e.type === 'prices_changed')).toBe(true);
      expect(sellerSse.received.some(e => e.type === 'products_changed')).toBe(true);

      // Confere no details (modal admin) e no catálogo do cliente
      const detailsRes = await request(server).get(`/api/price-tables/${tableId}/details`).set('Authorization', `Bearer ${adminToken}`);
      const detailItem = detailsRes.body.tableItems.find(i => i.produto_id === initialProductId);
      expect(detailItem.preco).toBe(65);
      expect(detailItem.quantidade_minima).toBe(3);

      const catRes = await request(server).get(`/api/products?cliente_id=${existingClientId}`).set('Authorization', `Bearer ${sellerToken}`);
      const prod = catRes.body.items.find(x => x.id === initialProductId);
      expect(prod.preco_tabela).toBe(65);
      expect(prod.quantidade_minima).toBe(3);

      // Pedido com 3 un agora ganha o desconto (3 * 65 = 195)
      const ordWith3 = await request(server)
        .post('/api/orders')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({ cliente_id: existingClientId, origem: 'VENDEDOR', itens: [{ produto_id: initialProductId, quantidade: 3 }] });
      expect(ordWith3.status).toBe(201);
      expect(ordWith3.body.item.total).toBe(195);

      // 2) Agora aumenta quantidade mínima para 10 e muda preço para 60
      await request(server)
        .put(`/api/price-tables/${tableId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          itens: [{ produto_id: initialProductId, preco: 60, quantidade_minima: 10 }]
        });

      // Pedido com 3 un não atinge mais o mínimo de 10 -> volta para preço base (3 * 100 = 300)
      const ordBelowMin = await request(server)
        .post('/api/orders')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({ cliente_id: existingClientId, origem: 'VENDEDOR', itens: [{ produto_id: initialProductId, quantidade: 3 }] });
      expect(ordBelowMin.status).toBe(201);
      expect(ordBelowMin.body.item.total).toBe(300);

      // Pedido com 10 un atinge o novo mínimo -> cobra 10 * 60 = 600
      const ordAtMin = await request(server)
        .post('/api/orders')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({ cliente_id: existingClientId, origem: 'VENDEDOR', itens: [{ produto_id: initialProductId, quantidade: 10 }] });
      expect(ordAtMin.status).toBe(201);
      expect(ordAtMin.body.item.total).toBe(600);
    } finally {
      sellerSse.close();
    }
  });

  it('Fluxo 3: Vendedor recém-criado sem clientes na carteira recebe preços da regra ALL em GET /api/products sem cliente_id', async () => {
    const brandNewSellerId = 'dyn-brand-new-seller';
    if (!db.prepare('SELECT id FROM usuarios WHERE email=?').get('newseller_noclient@xiquim.local')) {
      db.prepare('INSERT INTO usuarios (id, nome, email, senha_hash, role, ativo) VALUES (?, ?, ?, ?, ?, ?)').run(
        brandNewSellerId, 'Novo Vendedor Sem Clientes', 'newseller_noclient@xiquim.local', hashPassword('TestPass123!'), 'seller', 1
      );
    }
    const newSellerToken = (await request(server).post('/api/auth/login').send({
      email: 'newseller_noclient@xiquim.local',
      password: 'TestPass123!'
    })).body.token;

    // Garante que este vendedor não tem nenhum cliente vinculado
    const sellerClientsCount = db.prepare('SELECT COUNT(*) n FROM clientes WHERE vendedor_id=?').get(brandNewSellerId).n;
    expect(sellerClientsCount).toBe(0);

    // Garante que a tabela global ALL está ativa
    const cfg = db.prepare("SELECT valor FROM configuracoes WHERE chave='mass_price_table_all'").get();
    expect(cfg?.valor).toBe(tableId);

    // Consulta catálogo demonstrativo sem cliente_id
    const prodRes = await request(server)
      .get('/api/products')
      .set('Authorization', `Bearer ${newSellerToken}`);
    expect(prodRes.status).toBe(200);

    const pInit = prodRes.body.items.find(x => x.id === initialProductId);
    const pNew = prodRes.body.items.find(x => x.id === newProductId);
    expect(pInit).toBeDefined();
    expect(pInit.preco_tabela).toBe(60);
    expect(pInit.quantidade_minima).toBe(10);
    expect(pNew).toBeDefined();
    expect(pNew.preco_tabela).toBe(95);
    expect(pNew.quantidade_minima).toBe(4);
  });
});
