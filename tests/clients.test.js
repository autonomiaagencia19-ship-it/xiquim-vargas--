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
  });
});
