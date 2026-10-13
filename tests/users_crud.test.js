import request from 'supertest';
import { server } from '../server.js';
import { db } from '../src/db.js';
import { hashPassword } from '../src/auth.js';

describe('Users CRUD API', () => {
  let token;
  let testUserId;

  beforeAll(async () => {
    // Ensure admin user exists
    const existing = db.prepare('SELECT id FROM usuarios WHERE email=?').get('testadmin2@xiquim.local');
    if (!existing) {
      db.prepare('INSERT INTO usuarios (id, nome, email, senha_hash, role, ativo) VALUES (?, ?, ?, ?, ?, ?)').run(
        'test-admin-2', 'Test Admin 2', 'testadmin2@xiquim.local', hashPassword('TestPass123!'), 'admin', 1
      );
    }
    
    // Login
    const res = await request(server)
      .post('/api/auth/login')
      .send({ email: 'testadmin2@xiquim.local', password: 'TestPass123!' });
    token = res.body.token;
  });

  afterAll(() => {
    server.close();
  });

  it('should create a new user', async () => {
    const res = await request(server)
      .post('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .send({
        nome: 'New User Test',
        email: 'newuser@xiquim.local',
        password: 'Password123!',
        role: 'seller',
        telefone: '11999999999'
      });
      
    expect(res.status).toBe(201);
    expect(res.body.item).toBeDefined();
    expect(res.body.item.email).toBe('newuser@xiquim.local');
    testUserId = res.body.item.id;
  });

  it('should list users', async () => {
    const res = await request(server)
      .get('/api/users')
      .set('Authorization', `Bearer ${token}`);
      
    expect(res.status).toBe(200);
    expect(res.body.items).toBeDefined();
    expect(res.body.items.some(u => u.id === testUserId)).toBe(true);
  });

  it('should edit a user', async () => {
    const res = await request(server)
      .put(`/api/users/${testUserId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        nome: 'Updated User Test',
        email: 'newuser@xiquim.local',
        role: 'seller',
        ativo: false
      });
      
    expect(res.status).toBe(200);
    expect(res.body.item.nome).toBe('Updated User Test');
    expect(res.body.item.ativo).toBe(0);
  });

  it('should delete a user', async () => {
    const res = await request(server)
      .delete(`/api/users/${testUserId}`)
      .set('Authorization', `Bearer ${token}`);
      
    expect(res.status).toBe(200);
    expect(res.body.deleted).toBeDefined();
    
    // Verify deletion
    const check = db.prepare('SELECT id FROM usuarios WHERE id=?').get(testUserId);
    expect(check).toBeUndefined();
  });
});
