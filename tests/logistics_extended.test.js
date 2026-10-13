import request from 'supertest';
import { server } from '../server.js';
import { db } from '../src/db.js';
import { hashPassword } from '../src/auth.js';

describe('Logistics Extended API', () => {
  let token;
  let sellerId;

  beforeAll(async () => {
    const admin = db.prepare('SELECT id FROM usuarios WHERE email=?').get('testadmin11@xiquim.local');
    if (!admin) {
      db.prepare('INSERT INTO usuarios (id, nome, email, senha_hash, role, ativo) VALUES (?, ?, ?, ?, ?, ?)').run(
        'test-admin-11', 'Test Admin 11', 'testadmin11@xiquim.local', hashPassword('TestPass123!'), 'admin', 1
      );
    }
    const resA = await request(server).post('/api/auth/login').send({ email: 'testadmin11@xiquim.local', password: 'TestPass123!' });
    token = resA.body.token;

    const seller = db.prepare('SELECT id FROM usuarios WHERE email=?').get('testseller11@xiquim.local');
    if (!seller) {
      db.prepare('INSERT INTO usuarios (id, nome, email, senha_hash, role, ativo) VALUES (?, ?, ?, ?, ?, ?)').run(
        'test-seller-11', 'Test Seller 11', 'testseller11@xiquim.local', hashPassword('TestPass123!'), 'seller', 1
      );
    }
    sellerId = 'test-seller-11';
  });

  afterAll(() => {
    server.close();
  });

  let routeId;

  it('should create route config', async () => {
    const res = await request(server)
      .post('/api/logistics/route-config')
      .set('Authorization', `Bearer ${token}`)
      .send({
        nome: 'Rota Leste',
        dia_semana: 3,
        bairros: ['Bairro 1', 'Bairro 2']
      });
      
    expect(res.status).toBe(201);
    routeId = res.body.item.id;
  });

  it('should list route configs', async () => {
    const res = await request(server)
      .get('/api/logistics/route-config')
      .set('Authorization', `Bearer ${token}`);
      
    expect(res.status).toBe(200);
    expect(res.body.routes.some(r => r.id === routeId)).toBe(true);
  });

  it('should assign seller to route', async () => {
    const res = await request(server)
      .post('/api/logistics/route-assignments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        dia_semana: 3,
        vendedor_id: sellerId,
        rota_config_id: routeId
      });
      
    expect(res.status).toBe(200);
  });

  it('should get grouped orders', async () => {
    const res = await request(server)
      .get('/api/logistics/grouped-orders')
      .set('Authorization', `Bearer ${token}`);
      
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.grupos)).toBe(true);
  });
});
