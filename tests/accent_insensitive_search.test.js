import request from 'supertest';
import { server } from '../server.js';
import { db } from '../src/db.js';
import { hashPassword } from '../src/auth.js';

describe('Busca de Catálogo Sem Acentuação (Backend)', () => {
  let adminToken;
  let sellerToken;
  let createdIds = [];
  let createdCatId = 'cat-accent-test-1';

  beforeAll(async () => {
    if (!server.listening) {
      await new Promise(resolve => server.listen(0, resolve));
    }

    if (!db.prepare('SELECT id FROM usuarios WHERE email=?').get('accentadmin@xiquim.local')) {
      db.prepare('INSERT INTO usuarios (id, nome, email, senha_hash, role, ativo) VALUES (?, ?, ?, ?, ?, ?)').run(
        'accent-admin-1', 'Accent Admin', 'accentadmin@xiquim.local', hashPassword('TestPass123!'), 'admin', 1
      );
    }
    if (!db.prepare('SELECT id FROM usuarios WHERE email=?').get('accentseller@xiquim.local')) {
      db.prepare('INSERT INTO usuarios (id, nome, email, senha_hash, role, ativo) VALUES (?, ?, ?, ?, ?, ?)').run(
        'accent-seller-1', 'Accent Seller', 'accentseller@xiquim.local', hashPassword('TestPass123!'), 'seller', 1
      );
    }

    if (!db.prepare('SELECT id FROM categorias WHERE id=?').get(createdCatId)) {
      db.prepare('INSERT INTO categorias (id, nome, slug, descricao) VALUES (?, ?, ?, ?)').run(
        createdCatId, 'Laticínios e Café', 'laticinios-e-cafe', 'Categoria com acentuação'
      );
    }

    adminToken = (await request(server).post('/api/auth/login').send({ email: 'accentadmin@xiquim.local', password: 'TestPass123!' })).body.token;
    sellerToken = (await request(server).post('/api/auth/login').send({ email: 'accentseller@xiquim.local', password: 'TestPass123!' })).body.token;

    const samples = [
      { nome: 'Açúcar Cristal Refinado', sku: 'ACU-001', marca: 'União', descricao: 'Adoçante natural em grãos', categoria_id: createdCatId, preco_base: 5.5 },
      { nome: 'Café Torrado e Moído', sku: 'CAF-002', marca: 'Três Corações', descricao: 'Torra clássica intensa', categoria_id: createdCatId, preco_base: 18.9 },
      { nome: 'Água Mineral com Gás', sku: 'AGU-003', marca: 'São Lourenço', descricao: 'Refrescante cítrica natural', preco_base: 3.2 },
      { nome: 'Pão de Queijo Tradicional', sku: 'PAO-004', marca: 'Forno de Minas', descricao: 'Massa artesanal congelada', preco_base: 24.0 }
    ];

    for (const s of samples) {
      const res = await request(server).post('/api/products').set('Authorization', `Bearer ${adminToken}`).send(s);
      expect(res.status).toBe(201);
      createdIds.push(res.body.item.id);
    }
  });

  afterAll(async () => {
    for (const pid of createdIds) {
      try {
        await request(server).delete(`/api/products/${pid}`).set('Authorization', `Bearer ${adminToken}`);
      } catch {}
    }
    if (server.listening) {
      await new Promise(resolve => server.close(resolve));
    }
  });

  test('GET /api/products?q=... encontra produtos acentuados quando buscados sem acento', async () => {
    const cases = [
      { q: 'acucar', expectedName: 'Açúcar Cristal Refinado' },
      { q: 'ACUCAR', expectedName: 'Açúcar Cristal Refinado' },
      { q: 'açúcar', expectedName: 'Açúcar Cristal Refinado' },
      { q: 'cafe', expectedName: 'Café Torrado e Moído' },
      { q: 'agua', expectedName: 'Água Mineral com Gás' },
      { q: 'pao', expectedName: 'Pão de Queijo Tradicional' },
      { q: 'uniao', expectedName: 'Açúcar Cristal Refinado' },
      { q: 'sao lourenco', expectedName: 'Água Mineral com Gás' },
      { q: 'citrica', expectedName: 'Água Mineral com Gás' },
      { q: 'laticinios', expectedName: 'Café Torrado e Moído' },
      { q: 'CAF-002', expectedName: 'Café Torrado e Moído' }
    ];

    for (const c of cases) {
      const res = await request(server)
        .get(`/api/products?q=${encodeURIComponent(c.q)}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      const names = (res.body.items || []).map(x => x.nome);
      expect(names).toContain(c.expectedName);
    }
  });

  test('GET /api/stock, /api/seller/stock e /api/dashboard/product-sales suportam busca sem acentuação', async () => {
    const stockRes = await request(server)
      .get('/api/stock?q=acucar')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(stockRes.status).toBe(200);
    expect((stockRes.body.items || []).map(x => x.nome)).toContain('Açúcar Cristal Refinado');

    const sellerStockRes = await request(server)
      .get('/api/seller/stock?q=cafe')
      .set('Authorization', `Bearer ${sellerToken}`);
    expect(sellerStockRes.status).toBe(200);
    expect((sellerStockRes.body.items || []).map(x => x.nome)).toContain('Café Torrado e Moído');

    const salesRes = await request(server)
      .get('/api/dashboard/product-sales?q=agua')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(salesRes.status).toBe(200);
    expect((salesRes.body.items || []).map(x => x.nome)).toContain('Água Mineral com Gás');
  });
});
