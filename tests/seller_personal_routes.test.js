import request from 'supertest';
import http from 'node:http';
import { server } from '../server.js';
import { db } from '../src/db.js';
import { hashPassword } from '../src/auth.js';

function openSseListener(port, ticket) {
  const received = [];
  let reqStream;
  const ready = new Promise((resolve, reject) => {
    reqStream = http.get(`http://127.0.0.1:${port}/api/events?ticket=${encodeURIComponent(ticket)}`, res => {
      res.setEncoding('utf8');
      res.on('data', chunk => {
        const lines = String(chunk).split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              received.push(JSON.parse(line.slice(6)));
            } catch {}
          }
        }
      });
      resolve();
    });
    reqStream.on('error', err => {
      if (err.code !== 'ECONNRESET') reject(err);
    });
  });
  return {
    ready,
    received,
    close: () => { try { reqStream.destroy(); } catch {} }
  };
}

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

describe('Inversão de Rotas de Vendedor (Programação Pessoal + Monitoramento e Histórico)', () => {
  let adminToken, sellerToken, driverToken;
  let serverPort;
  const adminId = 'spr-admin-1';
  const sellerId = 'spr-seller-1';
  const driverId = 'spr-driver-1';

  beforeAll(async () => {
    if (!server.listening) {
      await new Promise(resolve => server.listen(0, resolve));
    }
    serverPort = server.address().port;

    const users = [
      { id: adminId, nome: 'SPR Admin', email: 'spradmin@xiquim.local', role: 'admin' },
      { id: sellerId, nome: 'SPR Seller', email: 'sprseller@xiquim.local', role: 'seller' },
      { id: driverId, nome: 'SPR Driver', email: 'sprdriver@xiquim.local', role: 'driver' }
    ];
    for (const u of users) {
      if (!db.prepare('SELECT id FROM usuarios WHERE id=?').get(u.id)) {
        db.prepare('INSERT INTO usuarios (id, nome, email, senha_hash, role, ativo) VALUES (?, ?, ?, ?, ?, ?)').run(
          u.id, u.nome, u.email, hashPassword('TestPass123!'), u.role, 1
        );
      }
    }

    db.prepare('DELETE FROM configuracoes WHERE chave IN (?, ?)').run(
      `seller.route_current.${sellerId}`,
      `seller.route_history.${sellerId}`
    );

    adminToken = (await request(server).post('/api/auth/login').send({ email: 'spradmin@xiquim.local', password: 'TestPass123!' })).body.token;
    sellerToken = (await request(server).post('/api/auth/login').send({ email: 'sprseller@xiquim.local', password: 'TestPass123!' })).body.token;
    driverToken = (await request(server).post('/api/auth/login').send({ email: 'sprdriver@xiquim.local', password: 'TestPass123!' })).body.token;
  });

  afterAll(async () => {
    db.prepare('DELETE FROM configuracoes WHERE chave IN (?, ?)').run(
      `seller.route_current.${sellerId}`,
      `seller.route_history.${sellerId}`
    );
    if (server.listening) {
      await new Promise(resolve => server.close(resolve));
    }
  });

  test('1. Vendedor programa a 1ª rota -> salva em current com histórico vazio', async () => {
    const res = await request(server)
      .put('/api/seller/personal-route')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ dia_semana: 3, bairros: ['Centro', 'Vila Bretas'], active: true });

    expect(res.status).toBe(200);
    expect(res.body.current).toMatchObject({
      active: true,
      dia_semana: 3,
      bairros: ['Centro', 'Vila Bretas']
    });
    expect(res.body.current.started_at).toBeTruthy();

    const getRes = await request(server)
      .get('/api/seller/personal-route')
      .set('Authorization', `Bearer ${sellerToken}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.current.bairros).toEqual(['Centro', 'Vila Bretas']);

    const histRes = await request(server)
      .get(`/api/admin/seller-routes/${sellerId}/history`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(histRes.status).toBe(200);
    expect(histRes.body.history).toEqual([]);
  });

  test('2. Vendedor programa 2ª rota (mesmo dia e outro dia) -> rota anterior vai para histórico com ended_at', async () => {
    await delay(15);
    const res2 = await request(server)
      .put('/api/seller/personal-route')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ dia_semana: 3, bairros: ['Lourdes', 'São Pedro'], active: true });

    expect(res2.status).toBe(200);
    expect(res2.body.current.bairros).toEqual(['Lourdes', 'São Pedro']);

    await delay(15);
    const res3 = await request(server)
      .put('/api/seller/personal-route')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ dia_semana: 5, bairros: ['Ilha dos Araújos'], active: true });

    expect(res3.status).toBe(200);
    expect(res3.body.current.dia_semana).toBe(5);
    expect(res3.body.current.bairros).toEqual(['Ilha dos Araújos']);

    const histRes = await request(server)
      .get(`/api/admin/seller-routes/${sellerId}/history`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(histRes.status).toBe(200);
    expect(histRes.body.history.length).toBe(2);
    expect(histRes.body.history[0].bairros).toEqual(['Lourdes', 'São Pedro']);
    expect(histRes.body.history[0].ended_at).toBeTruthy();
    expect(histRes.body.history[1].bairros).toEqual(['Centro', 'Vila Bretas']);
    expect(histRes.body.history[1].ended_at).toBeTruthy();
  });

  test('3. Toggle (PATCH /api/seller/personal-route/toggle) altera active sem duplicar histórico', async () => {
    const beforeHist = await request(server)
      .get(`/api/admin/seller-routes/${sellerId}/history`)
      .set('Authorization', `Bearer ${adminToken}`);
    const countBefore = beforeHist.body.history.length;

    const offRes = await request(server)
      .patch('/api/seller/personal-route/toggle')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ active: false });
    expect(offRes.status).toBe(200);
    expect(offRes.body.current.active).toBe(false);

    const onRes = await request(server)
      .patch('/api/seller/personal-route/toggle')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ active: true });
    expect(onRes.status).toBe(200);
    expect(onRes.body.current.active).toBe(true);

    const afterHist = await request(server)
      .get(`/api/admin/seller-routes/${sellerId}/history`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(afterHist.body.history.length).toBe(countBefore);
  });

  test('4. Admin consulta GET /api/admin/seller-routes e recebe rota atual e contagem do histórico', async () => {
    const res = await request(server)
      .get('/api/admin/seller-routes')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const entry = (res.body.items || []).find(s => s.id === sellerId);
    expect(entry).toBeTruthy();
    expect(entry.current.dia_semana).toBe(5);
    expect(entry.current.bairros).toEqual(['Ilha dos Araújos']);
    expect(entry.history_count).toBe(2);
  });

  test('5. SSE emite seller_routes_changed para Admin/Vendedor e NÃO dispara routes_changed para Motorista', async () => {
    const tAdmin = (await request(server).post('/api/events/ticket').set('Authorization', `Bearer ${adminToken}`)).body.ticket;
    const tSeller = (await request(server).post('/api/events/ticket').set('Authorization', `Bearer ${sellerToken}`)).body.ticket;
    const tDriver = (await request(server).post('/api/events/ticket').set('Authorization', `Bearer ${driverToken}`)).body.ticket;

    const lAdmin = openSseListener(serverPort, tAdmin);
    const lSeller = openSseListener(serverPort, tSeller);
    const lDriver = openSseListener(serverPort, tDriver);
    await Promise.all([lAdmin.ready, lSeller.ready, lDriver.ready]);

    try {
      const saveRes = await request(server)
        .put('/api/seller/personal-route')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({ dia_semana: 2, bairros: ['Santa Helena'], active: true });
      expect(saveRes.status).toBe(200);

      await delay(150);

      expect(lAdmin.received.some(e => e.type === 'seller_routes_changed' && e.payload?.vendedor_id === sellerId)).toBe(true);
      expect(lSeller.received.some(e => e.type === 'seller_routes_changed' && e.payload?.vendedor_id === sellerId)).toBe(true);
      expect(lAdmin.received.some(e => e.type === 'routes_changed')).toBe(false);
      expect(lDriver.received.some(e => e.type === 'routes_changed')).toBe(false);
      expect(lDriver.received.some(e => e.type === 'seller_routes_changed')).toBe(false);
    } finally {
      lAdmin.close();
      lSeller.close();
      lDriver.close();
    }
  });
});
