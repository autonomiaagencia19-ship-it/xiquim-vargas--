import request from 'supertest';
import { server } from '../server.js';
import { db } from '../src/db.js';
import { hashPassword } from '../src/auth.js';

describe('Stock API', () => {
  let token;
  let testProductId;

  beforeAll(async () => {
    // Admin user
    const admin = db.prepare('SELECT id FROM usuarios WHERE email=?').get('testadmin8@xiquim.local');
    if (!admin) {
      db.prepare('INSERT INTO usuarios (id, nome, email, senha_hash, role, ativo) VALUES (?, ?, ?, ?, ?, ?)').run(
        'test-admin-8', 'Test Admin 8', 'testadmin8@xiquim.local', hashPassword('TestPass123!'), 'admin', 1
      );
    }
    const resA = await request(server).post('/api/auth/login').send({ email: 'testadmin8@xiquim.local', password: 'TestPass123!' });
    token = resA.body.token;

    // Create a product for stock testing
    const pRes = await request(server)
      .post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        nome: 'Stock Test Product',
        preco_base: 50
      });
    testProductId = pRes.body.item.id;
  });

  afterAll(() => {
    server.close();
  });

  it('should list stock', async () => {
    const res = await request(server)
      .get('/api/stock')
      .set('Authorization', `Bearer ${token}`);
      
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  it('should adjust stock', async () => {
    const res = await request(server)
      .post(`/api/stock/${testProductId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        delta: 10,
        tipo: 'ENTRADA',
        observacao: 'Added 10 items for test'
      });
      
    expect(res.status).toBe(200);
    expect(res.body.item).toBeDefined();
    expect(res.body.item.quantidade_disponivel).toBe(10);
  });

  it('should fetch stock movements', async () => {
    const res = await request(server)
      .get(`/api/stock/${testProductId}/movements`)
      .set('Authorization', `Bearer ${token}`);
      
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBeGreaterThan(0);
  });
});
