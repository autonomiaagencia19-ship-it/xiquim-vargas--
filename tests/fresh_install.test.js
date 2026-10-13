import request from 'supertest';
import { server } from '../server.js';
import { db, STORAGE } from '../src/db.js';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

describe('Fresh install without bootstrap database', () => {
  afterAll(() => server.close());

  it('creates an empty, current-schema database and offers first-admin setup', async () => {
    expect(fs.existsSync(`${STORAGE}/xiquim-vargas.db`)).toBe(true);
    expect(db.prepare('SELECT COUNT(*) n FROM produtos').get().n).toBe(0);
    expect(db.prepare('PRAGMA table_info(tabela_preco_itens)').all().map(column => column.name)).toContain('quantidade_minima');
    expect(db.prepare('PRAGMA table_info(clientes)').all().map(column => column.name)).not.toContain('limite_credito');

    const status = await request(server).get('/api/setup/status');
    expect(status.status).toBe(200);
    expect(status.body.required).toBe(true);

    const setupToken = fs.readFileSync(path.join(STORAGE, 'setup-token.txt'), 'utf8').trim();
    const initialized = await request(server).post('/api/setup/initialize').send({
      setup_token: setupToken, nome: 'Fresh Install Admin', email: 'fresh-install@example.test', password: 'FreshInstall123!'
    });
    expect(initialized.status).toBe(201);
    const token = initialized.body.token;
    const me = await request(server).get('/api/me').set('Authorization', `Bearer ${token}`);
    expect(me.status).toBe(200);
    expect(me.body).not.toHaveProperty('impersonation');
    expect(me.body).not.toHaveProperty('actor_user_id');

    const removedFeature = await request(server).post('/api/admin/impersonate').set('Authorization', `Bearer ${token}`).send({ user_id: 'nobody' });
    expect(removedFeature.status).toBe(404);
    expect((await request(server).get('/api/events')).status).toBe(204);
    expect((await request(server).post('/api/events/ticket')).status).toBe(401);

    const ticketResponse = await request(server).post('/api/events/ticket').set('Authorization', `Bearer ${token}`);
    expect(ticketResponse.status).toBe(201);
    expect(ticketResponse.headers['access-control-allow-origin']).toBeUndefined();
    if (!server.listening) await new Promise(resolve => server.listen(0, resolve));
    const statusCode = await new Promise((resolve, reject) => {
      const stream = http.get(`http://127.0.0.1:${server.address().port}/api/events?ticket=${encodeURIComponent(ticketResponse.body.ticket)}`, response => {
        const code = response.statusCode;
        response.destroy();
        resolve(code);
      });
      stream.on('error', error => error.code === 'ECONNRESET' ? resolve(200) : reject(error));
    });
    expect(statusCode).toBe(200);
    expect((await request(server).get(`/api/events?ticket=${encodeURIComponent(ticketResponse.body.ticket)}`)).status).toBe(204);
  });
});
