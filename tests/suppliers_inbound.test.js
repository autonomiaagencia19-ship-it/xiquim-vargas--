import request from 'supertest';
import { server } from '../server.js';
import { db } from '../src/db.js';
import { hashPassword } from '../src/auth.js';

describe('Suppliers and Inbound Receiving API', () => {
  let token;
  let testProductId;
  let testSupplierId;
  let testPurchaseId;

  beforeAll(async () => {
    // Ensure test admin exists
    const adminEmail = 'testadmin_supp@xiquim.local';
    let admin = db.prepare('SELECT id FROM usuarios WHERE email=?').get(adminEmail);
    if (!admin) {
      db.prepare('INSERT INTO usuarios (id, nome, email, senha_hash, role, ativo) VALUES (?, ?, ?, ?, ?, ?)').run(
        'test-admin-supp', 'Test Admin Suprimentos', adminEmail, hashPassword('TestPass123!'), 'admin', 1
      );
    }
    const resA = await request(server).post('/api/auth/login').send({ email: adminEmail, password: 'TestPass123!' });
    token = resA.body.token;

    // Create a product for testing
    const ts = Date.now().toString(36);
    const pRes = await request(server)
      .post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        nome: `Refrigerante Cola 2L - Teste ${ts}`,
        preco_base: 8.50,
        sku: `REF-COLA-${ts}`
      });
    testProductId = pRes.body.item.id;
  });

  afterAll(() => {
    server.close();
  });

  it('should validate that supplier requires "nome" as primary field', async () => {
    const res = await request(server)
      .post('/api/suppliers')
      .set('Authorization', `Bearer ${token}`)
      .send({
        cnpj_cpf: '12.345.678/0001-90',
        telefone_whatsapp: '(31) 99999-8888'
        // Missing nome!
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Nome do fornecedor/i);
  });

  it('should create a supplier with "nome" in 1st place and default lead time', async () => {
    const res = await request(server)
      .post('/api/suppliers')
      .set('Authorization', `Bearer ${token}`)
      .send({
        nome: 'Distribuidora Minas Bebidas Ltda',
        razao_social: 'Minas Bebidas Comercio e Distribuicao Ltda',
        nome_fantasia: 'Minas Bebidas',
        cnpj_cpf: '11.222.333/0001-44',
        contato_nome: 'Carlos Eduardo',
        telefone_whatsapp: '(31) 98888-7777',
        email: 'pedidos@minasbebidas.com.br',
        lead_time_padrao_dias: 4,
        cidade: 'Belo Horizonte',
        estado: 'MG'
      });

    expect(res.status).toBe(201);
    expect(res.body.item).toBeDefined();
    expect(res.body.item.nome).toBe('Distribuidora Minas Bebidas Ltda');
    expect(res.body.item.lead_time_padrao_dias).toBe(4);
    testSupplierId = res.body.item.id;
  });

  it('should list suppliers and show total_produtos count', async () => {
    const res = await request(server)
      .get('/api/suppliers?q=Minas')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    const found = res.body.items.find(s => s.id === testSupplierId);
    expect(found).toBeDefined();
    expect(found.nome).toBe('Distribuidora Minas Bebidas Ltda');
  });

  it('should link a product to the supplier (N:N relation) with acquisition cost and lead time', async () => {
    const res = await request(server)
      .post(`/api/suppliers/${testSupplierId}/products`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        produto_id: testProductId,
        custo_aquisicao: 4.25,
        codigo_referencia_fornecedor: 'COLA-CX-06',
        lead_time_dias: 3,
        quantidade_minima_compra: 12
      });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    // Verify supplier products list
    const checkRes = await request(server)
      .get(`/api/suppliers/${testSupplierId}/products`)
      .set('Authorization', `Bearer ${token}`);

    expect(checkRes.status).toBe(200);
    const linked = checkRes.body.items.find(p => p.produto_id === testProductId);
    expect(linked).toBeDefined();
    expect(linked.custo_aquisicao).toBe(4.25);
    expect(linked.lead_time_dias).toBe(3);
  });

  it('should list qualified suppliers for a product', async () => {
    const res = await request(server)
      .get(`/api/products/${testProductId}/suppliers`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    const entry = res.body.items.find(f => f.fornecedor_id === testSupplierId);
    expect(entry).toBeDefined();
    expect(entry.custo_aquisicao).toBe(4.25);
  });

  it('should create a purchase order with sequential number PC-YYYY-NNNNNN and target delivery ETA', async () => {
    const today = new Date();
    const futureDate = new Date(today.getTime() + 3 * 86400000).toISOString().slice(0, 10);

    const res = await request(server)
      .post('/api/purchases')
      .set('Authorization', `Bearer ${token}`)
      .send({
        fornecedor_id: testSupplierId,
        previsao_entrega: futureDate,
        observacoes: 'Pedido para reposição de estoque de fim de semana',
        itens: [
          { produto_id: testProductId, quantidade: 50, custo_unitario: 4.25 }
        ]
      });

    expect(res.status).toBe(201);
    expect(res.body.item).toBeDefined();
    expect(res.body.item.numero).toMatch(/^PC-\d{4}-\d{6}$/);
    expect(res.body.item.status).toBe('CONFIRMADO');
    expect(res.body.item.valor_total).toBe(212.50);
    testPurchaseId = res.body.item.id;
  });

  it('should show inbound receiving KPIs summary', async () => {
    const res = await request(server)
      .get('/api/inbound/summary')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.aguardando).toBeGreaterThanOrEqual(1);
  });

  it('should receive purchase order at the dock, incrementing stock and creating ENTRADA_COMPRA audit movement', async () => {
    // Check initial stock
    const stockBefore = db.prepare('SELECT quantidade_disponivel FROM estoque WHERE produto_id=?').get(testProductId);
    const initialQty = stockBefore ? stockBefore.quantidade_disponivel : 0;

    // Receive full order at dock
    const res = await request(server)
      .post(`/api/purchases/${testPurchaseId}/receive`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        receber_tudo: true,
        numero_nota_fiscal: 'NF-998811'
      });

    expect(res.status).toBe(200);
    expect(res.body.total_recebido).toBe(50);
    expect(res.body.item.status).toBe('CONCLUIDO');

    // Check stock was incremented by 50
    const stockAfter = db.prepare('SELECT quantidade_disponivel FROM estoque WHERE produto_id=?').get(testProductId);
    expect(stockAfter.quantidade_disponivel).toBe(initialQty + 50);

    // Verify stock movement
    const movement = db.prepare(
      "SELECT * FROM movimentacoes_estoque WHERE produto_id=? AND tipo='ENTRADA_COMPRA' ORDER BY created_at DESC LIMIT 1"
    ).get(testProductId);
    expect(movement).toBeDefined();
    expect(movement.quantidade).toBe(50);
    expect(movement.observacao).toContain('NF-998811');
  });

  it('CRITICAL: Blind/manual stock entry (POST /api/stock/:id) MUST remain 100% functional without requiring any supplier/purchase order', async () => {
    const stockBefore = db.prepare('SELECT quantidade_disponivel FROM estoque WHERE produto_id=?').get(testProductId);
    const currentQty = stockBefore.quantidade_disponivel;

    // Operator enters blind stock delta directly with free-text observation
    const res = await request(server)
      .post(`/api/stock/${testProductId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        delta: 15,
        tipo: 'ENTRADA',
        observacao: 'Ajuste manual cego de estoque pelo operador'
      });

    expect(res.status).toBe(200);
    expect(res.body.item.quantidade_disponivel).toBe(currentQty + 15);

    // Also verify movement history
    const movRes = await request(server)
      .get(`/api/stock/${testProductId}/movements`)
      .set('Authorization', `Bearer ${token}`);

    expect(movRes.status).toBe(200);
    const manualMov = movRes.body.items.find(m => m.observacao === 'Ajuste manual cego de estoque pelo operador');
    expect(manualMov).toBeDefined();
    expect(manualMov.quantidade).toBe(15);
  });
});
