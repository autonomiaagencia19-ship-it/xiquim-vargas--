import request from 'supertest';
import { server } from '../server.js';
import { db } from '../src/db.js';
import { hashPassword } from '../src/auth.js';

describe('Dashboard API', () => {
  let token;
  let sellerToken;

  beforeAll(async () => {
    // Admin user
    const admin = db.prepare('SELECT id FROM usuarios WHERE email=?').get('testadmin7@xiquim.local');
    if (!admin) {
      db.prepare('INSERT INTO usuarios (id, nome, email, senha_hash, role, ativo) VALUES (?, ?, ?, ?, ?, ?)').run(
        'test-admin-7', 'Test Admin 7', 'testadmin7@xiquim.local', hashPassword('TestPass123!'), 'admin', 1
      );
    }
    const resA = await request(server).post('/api/auth/login').send({ email: 'testadmin7@xiquim.local', password: 'TestPass123!' });
    token = resA.body.token;

    // Seller user
    const seller = db.prepare('SELECT id FROM usuarios WHERE email=?').get('testseller2@xiquim.local');
    if (!seller) {
      db.prepare('INSERT INTO usuarios (id, nome, email, senha_hash, role, ativo) VALUES (?, ?, ?, ?, ?, ?)').run(
        'test-seller-2', 'Test Seller 2', 'testseller2@xiquim.local', hashPassword('TestPass123!'), 'seller', 1
      );
    }
    const resS = await request(server).post('/api/auth/login').send({ email: 'testseller2@xiquim.local', password: 'TestPass123!' });
    sellerToken = resS.body.token;
  });

  afterAll(() => {
    server.close();
  });

  it('admin should fetch dashboard stats', async () => {
    const res = await request(server)
      .get('/api/dashboard')
      .set('Authorization', `Bearer ${token}`);
      
    expect(res.status).toBe(200);
    expect(res.body.pedidosHoje).toBeDefined();
    expect(res.body.faturamento).toBeDefined();
  });

  it('seller should be able to get their monthly dashboard', async () => {
    const res = await request(server)
      .get('/api/seller/dashboard/monthly')
      .set('Authorization', `Bearer ${sellerToken}`);
      
    expect(res.status).toBe(200);
    expect(res.body.mes).toBeDefined();
    expect(res.body.pedidos).toBeDefined();
  });

  it('should get self /api/me', async () => {
    const res = await request(server)
      .get('/api/me')
      .set('Authorization', `Bearer ${token}`);
      
    expect(res.status).toBe(200);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe('testadmin7@xiquim.local');
  });
});
