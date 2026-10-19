import request from 'supertest';
import { server } from '../server.js';
import { db } from '../src/db.js';
import { hashPassword } from '../src/auth.js';

describe('Logistics API', () => {
  let token;

  beforeAll(async () => {
    // Ensure admin user exists
    const existing = db.prepare('SELECT id FROM usuarios WHERE email=?').get('testadmin3@xiquim.local');
    if (!existing) {
      db.prepare('INSERT INTO usuarios (id, nome, email, senha_hash, role, ativo) VALUES (?, ?, ?, ?, ?, ?)').run(
        'test-admin-3', 'Test Admin 3', 'testadmin3@xiquim.local', hashPassword('TestPass123!'), 'admin', 1
      );
    }
    
    // Login
    const res = await request(server)
      .post('/api/auth/login')
      .send({ email: 'testadmin3@xiquim.local', password: 'TestPass123!' });
    token = res.body.token;
  });

  afterAll(() => {
    server.close();
  });

  it('should list all routes', async () => {
    const res = await request(server)
      .get('/api/logistics/routes')
      .set('Authorization', `Bearer ${token}`);
      
    expect(res.status).toBe(200);
    expect(res.body.items).toBeDefined();
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  it('should return 400 when generating a route with no orders', async () => {
    const res = await request(server)
      .post('/api/logistics/routes')
      .set('Authorization', `Bearer ${token}`)
      .send({
        pedido_ids: []
      });
      
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Nenhum pedido/);
  });

  it('should save and retrieve weekly delivery routes schedule', async () => {
    const testSchedule = [
      { dia: 1, dia_nome: 'Segunda-feira', motorista_id: null, motorista_nome: null, bairros: ['Centro', 'JK'] },
      { dia: 2, dia_nome: 'Terça-feira', motorista_id: null, motorista_nome: null, bairros: ['Vila Isa'] }
    ];

    const postRes = await request(server)
      .post('/api/logistics/delivery-routes-config')
      .set('Authorization', `Bearer ${token}`)
      .send({ items: testSchedule, schedule: testSchedule });

    expect(postRes.status).toBe(200);
    expect(postRes.body.ok).toBe(true);
    expect(postRes.body.items).toHaveLength(2);

    const getRes = await request(server)
      .get('/api/logistics/delivery-routes-config')
      .set('Authorization', `Bearer ${token}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.items).toBeDefined();
    expect(getRes.body.schedule).toBeDefined();
    expect(getRes.body.items).toHaveLength(2);
    expect(getRes.body.items[0].dia_nome).toBe('Segunda-feira');
    expect(getRes.body.items[0].bairros).toContain('Centro');
  });
});
