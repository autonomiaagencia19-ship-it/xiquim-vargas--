import request from 'supertest';
import { server } from '../server.js';
import { db } from '../src/db.js';
import { hashPassword } from '../src/auth.js';

describe('Clients API', () => {
  let token;
  let sellerToken;

  beforeAll(async () => {
    // Admin user
    const admin = db.prepare('SELECT id FROM usuarios WHERE email=?').get('testadmin6@xiquim.local');
    if (!admin) {
      db.prepare('INSERT INTO usuarios (id, nome, email, senha_hash, role, ativo) VALUES (?, ?, ?, ?, ?, ?)').run(
        'test-admin-6', 'Test Admin 6', 'testadmin6@xiquim.local', hashPassword('TestPass123!'), 'admin', 1
      );
    }
    const resA = await request(server).post('/api/auth/login').send({ email: 'testadmin6@xiquim.local', password: 'TestPass123!' });
    token = resA.body.token;

    // Seller user
    const seller = db.prepare('SELECT id FROM usuarios WHERE email=?').get('testseller1@xiquim.local');
    if (!seller) {
      db.prepare('INSERT INTO usuarios (id, nome, email, senha_hash, role, ativo) VALUES (?, ?, ?, ?, ?, ?)').run(
        'test-seller-1', 'Test Seller 1', 'testseller1@xiquim.local', hashPassword('TestPass123!'), 'seller', 1
      );
    }
    const resS = await request(server).post('/api/auth/login').send({ email: 'testseller1@xiquim.local', password: 'TestPass123!' });
    sellerToken = resS.body.token;
  });

  afterAll(() => {
    server.close();
  });

  it('should list clients', async () => {
    const res = await request(server)
      .get('/api/clients')
      .set('Authorization', `Bearer ${token}`);
      
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  it('should create a client', async () => {
    const uniqueCnpj = `123${Date.now().toString().slice(-8)}`;
    const res = await request(server)
      .post('/api/clients')
      .set('Authorization', `Bearer ${token}`)
      .send({
        razao_social: 'Cliente API Test',
        cnpj_cpf: uniqueCnpj,
        endereco: 'Rua de Teste, 123'
      });
      
    expect(res.status).toBe(201);
    expect(res.body.item).toBeDefined();
    expect(res.body.item.cnpj_cpf).toBe(uniqueCnpj);
  });

  it('seller should be able to create and list their own clients', async () => {
    const uniqueCnpjSeller = `111${Date.now().toString().slice(-8)}`;
    const resC = await request(server)
      .post('/api/clients')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({
        razao_social: 'Cliente Seller Test',
        cnpj_cpf: uniqueCnpjSeller,
        endereco: 'Rua do Vendedor, 123'
      });
    expect(resC.status).toBe(201);

    const resL = await request(server)
      .get('/api/clients')
      .set('Authorization', `Bearer ${sellerToken}`);
    expect(resL.status).toBe(200);
    expect(resL.body.items.some(x => x.cnpj_cpf === uniqueCnpjSeller)).toBe(true);
    expect(resL.body.items.some(x => x.id === 'CLIENTE-BALCAO')).toBe(false);
    expect(resL.body.items.every(x => x.vendedor_id === 'test-seller-1')).toBe(true);
  });

  it('should isolate seller portfolios and exclude CLIENTE-BALCAO and unassigned clients', async () => {
    const seller2 = db.prepare('SELECT id FROM usuarios WHERE email=?').get('testseller2@xiquim.local');
    if (!seller2) {
      db.prepare('INSERT INTO usuarios (id, nome, email, senha_hash, role, ativo) VALUES (?, ?, ?, ?, ?, ?)').run(
        'test-seller-2', 'Test Seller 2', 'testseller2@xiquim.local', hashPassword('TestPass123!'), 'seller', 1
      );
    }
    const resS2 = await request(server).post('/api/auth/login').send({ email: 'testseller2@xiquim.local', password: 'TestPass123!' });
    const seller2Token = resS2.body.token;

    // Ensure CLIENTE-BALCAO exists
    db.prepare(`INSERT OR IGNORE INTO clientes (id, razao_social, nome_fantasia, cnpj_cpf, endereco, ativo) VALUES ('CLIENTE-BALCAO', 'Cliente Balcão', 'Consumidor Final', '00000000000', 'Balcão PDV', 1)`).run();

    // Create an unassigned client (no vendedor_id) via admin
    const unassignedRes = await request(server)
      .post('/api/clients')
      .set('Authorization', `Bearer ${token}`)
      .send({
        razao_social: 'Cliente Sem Vendedor Test',
        cnpj_cpf: `999${Date.now().toString().slice(-8)}`,
        endereco: 'Rua Direta, 100'
      });
    expect(unassignedRes.status).toBe(201);
    const unassignedClientId = unassignedRes.body.item.id;

    // Create a client for Seller 2
    const s2ClientRes = await request(server)
      .post('/api/clients')
      .set('Authorization', `Bearer ${seller2Token}`)
      .send({
        razao_social: 'Cliente Exclusivo Seller 2',
        cnpj_cpf: `888${Date.now().toString().slice(-8)}`,
        endereco: 'Rua Vendedor 2, 200'
      });
    expect(s2ClientRes.status).toBe(201);
    const s2ClientId = s2ClientRes.body.item.id;

    // Seller 1 must NOT see CLIENTE-BALCAO, unassignedClientId, or s2ClientId
    const s1List = await request(server)
      .get('/api/clients')
      .set('Authorization', `Bearer ${sellerToken}`);
    expect(s1List.status).toBe(200);
    const s1Ids = s1List.body.items.map(c => c.id);
    expect(s1Ids).not.toContain('CLIENTE-BALCAO');
    expect(s1Ids).not.toContain(unassignedClientId);
    expect(s1Ids).not.toContain(s2ClientId);

    // Seller 1 must get 403 when accessing profile of CLIENTE-BALCAO, unassigned client, or Seller 2's client
    const profBalcao = await request(server).get('/api/clients/CLIENTE-BALCAO/profile').set('Authorization', `Bearer ${sellerToken}`);
    expect(profBalcao.status).toBe(403);
    const profUnassigned = await request(server).get(`/api/clients/${unassignedClientId}/profile`).set('Authorization', `Bearer ${sellerToken}`);
    expect(profUnassigned.status).toBe(403);
    const profS2 = await request(server).get(`/api/clients/${s2ClientId}/profile`).set('Authorization', `Bearer ${sellerToken}`);
    expect(profS2.status).toBe(403);

    // Admin filtering by vendedor_id in Torre de Controle only returns that seller's clients
    const adminS2List = await request(server)
      .get('/api/clients?vendedor_id=test-seller-2')
      .set('Authorization', `Bearer ${token}`);
    expect(adminS2List.status).toBe(200);
    expect(adminS2List.body.items.some(c => c.id === s2ClientId)).toBe(true);
    expect(adminS2List.body.items.every(c => c.vendedor_id === 'test-seller-2' && c.id !== 'CLIENTE-BALCAO')).toBe(true);
  });
});
