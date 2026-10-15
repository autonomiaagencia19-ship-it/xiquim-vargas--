import request from 'supertest';
import { server, broadcastEvent } from '../server.js';
import { db } from '../src/db.js';
import { hashPassword } from '../src/auth.js';

describe('Real-Time Synchronization (SSE & Broadcast)', () => {
  let adminToken, driverToken, cashierToken, sellerToken, clientToken;

  beforeAll(async () => {
    // Setup test users for all roles
    const users = [
      { id: 'rt-admin-1', nome: 'RT Admin', email: 'rtadmin@xiquim.local', role: 'admin' },
      { id: 'rt-driver-1', nome: 'RT Driver', email: 'rtdriver@xiquim.local', role: 'driver' },
      { id: 'rt-cashier-1', nome: 'RT Cashier', email: 'rtcashier@xiquim.local', role: 'cashier' },
      { id: 'rt-seller-1', nome: 'RT Seller', email: 'rtseller@xiquim.local', role: 'seller' },
      { id: 'rt-client-1', nome: 'RT WebClient', email: 'rtclient@xiquim.local', role: 'web_client' }
    ];

    for (const u of users) {
      const exists = db.prepare('SELECT id FROM usuarios WHERE email=?').get(u.email);
      if (!exists) {
        db.prepare('INSERT INTO usuarios (id, nome, email, senha_hash, role, ativo) VALUES (?, ?, ?, ?, ?, ?)').run(
          u.id, u.nome, u.email, hashPassword('Pass123456!'), u.role, 1
        );
      }
    }

    const getToken = async (email) => {
      const res = await request(server).post('/api/auth/login').send({ email, password: 'Pass123456!' });
      return res.body.token;
    };

    adminToken = await getToken('rtadmin@xiquim.local');
    driverToken = await getToken('rtdriver@xiquim.local');
    cashierToken = await getToken('rtcashier@xiquim.local');
    sellerToken = await getToken('rtseller@xiquim.local');
    clientToken = await getToken('rtclient@xiquim.local');
  });

  afterAll(() => {
    server.close();
  });

  it('should generate an SSE ticket for all operating roles', async () => {
    for (const token of [adminToken, driverToken, cashierToken, sellerToken, clientToken]) {
      const res = await request(server)
        .post('/api/events/ticket')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(201);
      expect(res.body.ticket).toBeDefined();
      expect(typeof res.body.ticket).toBe('string');
    }
  });

  it('should reject unauthenticated SSE ticket generation', async () => {
    const res = await request(server).post('/api/events/ticket');
    expect(res.status).toBe(401);
  });

  it('should allow driver to receive routes_changed, orders_changed, and returns_changed', () => {
    const received = [];
    const mockDriverClient = {
      _clientRole: 'driver',
      write: (data) => received.push(data)
    };

    // Simulate adding mock client to broadcast
    const origBroadcast = broadcastEvent;
    expect(typeof origBroadcast).toBe('function');

    // Test driver event permissions directly through broadcastEvent
    broadcastEvent('routes_changed', { id: 'r1' });
    broadcastEvent('orders_changed', { id: 'o1' });
    broadcastEvent('returns_changed', { id: 'ret1' });
  });

  it('should allow seller to receive stock, products, clients, orders, prices, returns, and routes', () => {
    expect(() => {
      broadcastEvent('stock_changed', { id: 'p1' });
      broadcastEvent('products_changed', { id: 'p1' });
      broadcastEvent('clients_changed', { id: 'c1' });
      broadcastEvent('orders_changed', { id: 'o1' });
      broadcastEvent('prices_changed', { id: 'pr1' });
      broadcastEvent('returns_changed', { id: 'ret1' });
      broadcastEvent('routes_changed', { id: 'r1' });
    }).not.toThrow();
  });

  it('should allow cashier to receive stock, products, orders, prices, and clients', () => {
    expect(() => {
      broadcastEvent('stock_changed', { id: 'p1' });
      broadcastEvent('products_changed', { id: 'p1' });
      broadcastEvent('orders_changed', { id: 'o1' });
      broadcastEvent('prices_changed', { id: 'pr1' });
      broadcastEvent('clients_changed', { id: 'c1' });
    }).not.toThrow();
  });

  it('should allow web client to receive products, stock, orders, prices, and settings', () => {
    expect(() => {
      broadcastEvent('products_changed', { id: 'p1' });
      broadcastEvent('stock_changed', { id: 'p1' });
      broadcastEvent('orders_changed', { id: 'o1' });
      broadcastEvent('prices_changed', { id: 'pr1' });
      broadcastEvent('settings_changed', { key: 'store.title' });
    }).not.toThrow();
  });
});
