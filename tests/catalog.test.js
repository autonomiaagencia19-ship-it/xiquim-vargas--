import request from 'supertest';
import { server } from '../server.js';
import { db } from '../src/db.js';
import { hashPassword } from '../src/auth.js';

describe('Store/Catalog API', () => {
  let token;

  beforeAll(async () => {
    // Add dummy product
    const cid = 'cat-1';
    db.prepare('INSERT OR IGNORE INTO categorias (id, nome, slug) VALUES (?, ?, ?)').run(cid, 'Cat Test', 'cat-test');
    db.prepare('INSERT OR IGNORE INTO produtos (id, nome, sku, preco_base, ativo, categoria_id) VALUES (?, ?, ?, ?, ?, ?)').run('prod-1', 'Produto Teste', 'PROD-123', 10.5, 1, cid);

    const existing = db.prepare('SELECT id FROM usuarios WHERE email=?').get('testadmin4@xiquim.local');
    if (!existing) {
      db.prepare('INSERT INTO usuarios (id, nome, email, senha_hash, role, ativo) VALUES (?, ?, ?, ?, ?, ?)').run(
        'test-admin-4', 'Test Admin 4', 'testadmin4@xiquim.local', hashPassword('TestPass123!'), 'admin', 1
      );
    }
    
    // Login
    const res = await request(server)
      .post('/api/auth/login')
      .send({ email: 'testadmin4@xiquim.local', password: 'TestPass123!' });
    token = res.body.token;
  });

  afterAll(() => {
    server.close();
  });

  it('should list all available products', async () => {
    const res = await request(server)
      .get('/api/products')
      .set('Authorization', `Bearer ${token}`);
      
    expect(res.status).toBe(200);
    expect(res.body.items).toBeDefined();
    expect(Array.isArray(res.body.items)).toBe(true);
    // At least one item should be returned since we added prod-1
    expect(res.body.items.length).toBeGreaterThan(0);
  });

  it('should search products by query', async () => {
    const res = await request(server)
      .get('/api/products?q=Produto Teste')
      .set('Authorization', `Bearer ${token}`);
      
    expect(res.status).toBe(200);
    expect(res.body.items).toBeDefined();
    expect(res.body.items.length).toBeGreaterThan(0);
    expect(res.body.items[0].nome).toMatch(/Produto Teste/i);
  });
});
