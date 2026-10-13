import request from 'supertest';
import { server } from '../server.js';
import { db } from '../src/db.js';
import { hashPassword } from '../src/auth.js';

describe('Auth API', () => {
  beforeAll(() => {
    // Ensure test user exists
    const existing = db.prepare('SELECT id FROM usuarios WHERE email=?').get('testadmin@xiquim.local');
    if (!existing) {
      db.prepare('INSERT INTO usuarios (id, nome, email, senha_hash, role, ativo) VALUES (?, ?, ?, ?, ?, ?)').run(
        'test-admin-id', 'Test Admin', 'testadmin@xiquim.local', hashPassword('TestPass123!'), 'admin', 1
      );
    }
  });

  afterAll(() => {
    server.close();
  });

  it('should fail login with wrong credentials', async () => {
    const res = await request(server)
      .post('/api/auth/login')
      .send({ email: 'testadmin@xiquim.local', password: 'wrongpassword' });
    
    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it('should login successfully with correct credentials', async () => {
    const res = await request(server)
      .post('/api/auth/login')
      .send({ email: 'testadmin@xiquim.local', password: 'TestPass123!' });
    
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe('testadmin@xiquim.local');
  });

  it('should access protected route with valid token', async () => {
    const login = await request(server)
      .post('/api/auth/login')
      .send({ email: 'testadmin@xiquim.local', password: 'TestPass123!' });
    
    const token = login.body.token;
    
    const res = await request(server)
      .get('/api/users')
      .set('Authorization', `Bearer ${token}`);
      
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
  });
});
