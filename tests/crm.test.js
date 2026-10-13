import request from 'supertest';
import { server } from '../server.js';
import { db } from '../src/db.js';
import { hashPassword } from '../src/auth.js';

describe('CRM & Relacionamento API', () => {
  let token;
  let testClientId;

  beforeAll(async () => {
    const admin = db.prepare('SELECT id FROM usuarios WHERE email=?').get('testadmin_crm@xiquim.local');
    if (!admin) {
      db.prepare('INSERT INTO usuarios (id, nome, email, senha_hash, role, ativo) VALUES (?, ?, ?, ?, ?, ?)').run(
        'test-admin-crm', 'Test Admin CRM', 'testadmin_crm@xiquim.local', hashPassword('TestPass123!'), 'admin', 1
      );
    }
    const resA = await request(server).post('/api/auth/login').send({ email: 'testadmin_crm@xiquim.local', password: 'TestPass123!' });
    token = resA.body.token;

    // Get an existing client or create one
    const client = db.prepare("SELECT id FROM clientes WHERE ativo=1 AND id != 'CLIENTE-BALCAO' LIMIT 1").get();
    if (client) {
      testClientId = client.id;
    } else {
      testClientId = 'cli-test-crm-01';
      db.prepare("INSERT INTO clientes (id, razao_social, nome_fantasia, cnpj_cpf, endereco, ativo) VALUES (?, ?, ?, ?, ?, 1)").run(
        testClientId, 'Bar do CRM Teste', 'Bar CRM', '99887766000199', 'Rua Central, 50'
      );
    }
  });

  afterAll(() => {
    server.close();
  });

  it('GET /api/crm/dashboard should return summary and classified items', async () => {
    const res = await request(server)
      .get('/api/crm/dashboard')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.summary).toBeDefined();
    expect(res.body.summary.total_clientes).toBeGreaterThanOrEqual(1);
    expect(typeof res.body.summary.ativos).toBe('number');
    expect(typeof res.body.summary.em_risco).toBe('number');
    expect(typeof res.body.summary.inativos).toBe('number');
    expect(Array.isArray(res.body.items)).toBe(true);

    const first = res.body.items[0];
    if (first) {
      expect(first.razao_social).toBeDefined();
      expect(first.status_rfm).toBeDefined();
      expect(['VIP', 'ATIVO', 'EM_RISCO', 'INATIVO', 'NOVO']).toContain(first.status_rfm);
    }
  });

  it('POST /api/clients/:id/interactions should register a CRM interaction note', async () => {
    const res = await request(server)
      .post(`/api/clients/${testClientId}/interactions`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        tipo: 'WHATSAPP',
        descricao: 'Cliente confirmou que estoque de cerveja está baixo. Pediu retorno na sexta.'
      });

    expect(res.status).toBe(201);
    expect(res.body.item).toBeDefined();
    expect(res.body.item.tipo).toBe('WHATSAPP');
    expect(res.body.item.descricao).toContain('estoque de cerveja');
  });

  it('GET /api/clients/:id/interactions should list interactions for client', async () => {
    const res = await request(server)
      .get(`/api/clients/${testClientId}/interactions`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBeGreaterThanOrEqual(1);
    expect(res.body.items[0].descricao).toContain('estoque de cerveja');
  });

  it('GET /api/crm/dashboard should return portfolio-scoped data for seller role', async () => {
    const seller = db.prepare('SELECT id FROM usuarios WHERE email=?').get('testseller_crm@xiquim.local');
    if (!seller) {
      db.prepare('INSERT INTO usuarios (id, nome, email, senha_hash, role, ativo) VALUES (?, ?, ?, ?, ?, ?)').run(
        'test-seller-crm', 'Test Seller CRM', 'testseller_crm@xiquim.local', hashPassword('TestPass123!'), 'seller', 1
      );
    }
    // Assign testClientId to this seller
    db.prepare('UPDATE clientes SET vendedor_id=? WHERE id=?').run('test-seller-crm', testClientId);

    const loginRes = await request(server).post('/api/auth/login').send({ email: 'testseller_crm@xiquim.local', password: 'TestPass123!' });
    const sellerToken = loginRes.body.token;

    const res = await request(server)
      .get('/api/crm/dashboard')
      .set('Authorization', `Bearer ${sellerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.summary).toBeDefined();
    expect(Array.isArray(res.body.items)).toBe(true);
    // All returned items must belong to test-seller-crm
    for (const item of res.body.items) {
      expect(item.vendedor_id).toBe('test-seller-crm');
    }
    expect(res.body.summary.total_clientes).toBe(res.body.items.length);
  });
});
