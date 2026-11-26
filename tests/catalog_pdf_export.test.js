import fs from 'node:fs';
import path from 'node:path';
import request from 'supertest';
import { server } from '../server.js';
import { db, STORAGE } from '../src/db.js';
import { hashPassword } from '../src/auth.js';

const CP1252_REV = {
  0x80: '€', 0x82: '‚', 0x83: 'ƒ', 0x84: '„', 0x85: '…', 0x86: '†', 0x87: '‡',
  0x88: 'ˆ', 0x89: '‰', 0x8a: 'Š', 0x8b: '‹', 0x8c: 'Œ', 0x8e: 'Ž', 0x91: '‘',
  0x92: '’', 0x93: '“', 0x94: '”', 0x95: '•', 0x96: '–', 0x97: '—', 0x98: '˜',
  0x99: '™', 0x9a: 'š', 0x9b: '›', 0x9c: 'œ', 0x9e: 'ž', 0x9f: 'Ÿ'
};

function decodeWin1252(raw) {
  let out = '';
  for (let i = 0; i < raw.length; i++) {
    const code = raw.charCodeAt(i);
    if (code >= 0x80 && code <= 0x9f && CP1252_REV[code]) {
      out += CP1252_REV[code];
    } else {
      out += raw[i];
    }
  }
  return out;
}

function extractPdfLines(buffer) {
  const text = Buffer.from(buffer).toString('latin1');
  const lines = [];
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let streamMatch;
  while ((streamMatch = streamRegex.exec(text)) !== null) {
    const streamBody = streamMatch[1];
    const tjRegex = /\(((?:\\.|[^\\)])*)\)\s*Tj/g;
    let tjMatch;
    while ((tjMatch = tjRegex.exec(streamBody)) !== null) {
      const unescaped = tjMatch[1]
        .replace(/\\\(/g, '(')
        .replace(/\\\)/g, ')')
        .replace(/\\\\/g, '\\');
      lines.push(decodeWin1252(unescaped));
    }
  }
  return lines;
}

function binaryResponseParser(res, callback) {
  const chunks = [];
  res.on('data', chunk => chunks.push(chunk));
  res.on('end', () => callback(null, Buffer.concat(chunks)));
}

describe('Catalog PDF Export Engine', () => {
  let adminToken;
  let sellerToken;
  let tableAId;
  let tableBId;
  let promoProdId;
  let soldOutProdId;
  let normalProdId;
  let noCatBala1Id;
  let noCatBala2Id;
  let noCatGelo1Id;
  let noCatGelo2Id;

  beforeAll(async () => {
    const admin = db.prepare('SELECT id FROM usuarios WHERE email=?').get('catpdfadmin@xiquim.local');
    if (!admin) {
      db.prepare('INSERT INTO usuarios (id, nome, email, senha_hash, role, ativo) VALUES (?, ?, ?, ?, ?, ?)').run(
        'cat-pdf-admin-1', 'Cat PDF Admin', 'catpdfadmin@xiquim.local', hashPassword('TestPass123!'), 'admin', 1
      );
    }
    const seller = db.prepare('SELECT id FROM usuarios WHERE email=?').get('catpdfseller@xiquim.local');
    if (!seller) {
      db.prepare('INSERT INTO usuarios (id, nome, email, senha_hash, role, ativo) VALUES (?, ?, ?, ?, ?, ?)').run(
        'cat-pdf-seller-1', 'Cat PDF Seller', 'catpdfseller@xiquim.local', hashPassword('TestPass123!'), 'seller', 1
      );
    }

    adminToken = (await request(server)
      .post('/api/auth/login')
      .send({ email: 'catpdfadmin@xiquim.local', password: 'TestPass123!' })).body.token;
    sellerToken = (await request(server)
      .post('/api/auth/login')
      .send({ email: 'catpdfseller@xiquim.local', password: 'TestPass123!' })).body.token;

    const catRes = await request(server)
      .post('/api/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ nome: 'Cervejas Especiais' });
    expect(catRes.status).toBe(201);
    const catId = catRes.body.item.id;

    // 1. Produto promocional (deve aparecer na seção PROMOÇÃO no topo, sem repetir abaixo)
    const pPromo = await request(server)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ nome: 'Cerveja Pilsen Promocional 350ml', unidade: 'FD', preco_base: 42, categoria_id: catId });
    expect(pPromo.status).toBe(201);
    promoProdId = pPromo.body.item.id;

    const prRes = await request(server)
      .post(`/api/products/${promoProdId}/promotions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ nome: 'Oferta Semana', preco_promocional: 36.9 });
    expect(prRes.status).toBe(201);

    // 2. Produto normal com categoria
    const pNorm = await request(server)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ nome: 'Cerveja Puro Malte 600ml', unidade: 'CX', preco_base: 110, categoria_id: catId });
    expect(pNorm.status).toBe(201);
    normalProdId = pNorm.body.item.id;

    // 3. Produto marcado como esgotado = 1 (deve listar normalmente, sem texto "esgotado")
    const pSoldOut = await request(server)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ nome: 'Chopp Artesanal 5L', unidade: 'UN', preco_base: 85, categoria_id: catId });
    expect(pSoldOut.status).toBe(201);
    soldOutProdId = pSoldOut.body.item.id;

    const markRes = await request(server)
      .post(`/api/products/${soldOutProdId}/sold-out`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ esgotado: 1 });
    expect(markRes.status).toBe(200);

    // 4. Produtos sem categoria (agrupamento por palavra-chave e por prefixo semelhante)
    const pBala1 = await request(server)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ nome: 'Bala Hortela 500g', unidade: 'PCT', preco_base: 14.5 });
    expect(pBala1.status).toBe(201);
    noCatBala1Id = pBala1.body.item.id;

    const pBala2 = await request(server)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ nome: 'Bala Morango 500g', unidade: 'PCT', preco_base: 15.0 });
    expect(pBala2.status).toBe(201);
    noCatBala2Id = pBala2.body.item.id;

    const pGelo1 = await request(server)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ nome: 'Gelo Cubo 5kg', unidade: 'PCT', preco_base: 12.0 });
    expect(pGelo1.status).toBe(201);
    noCatGelo1Id = pGelo1.body.item.id;

    const pGelo2 = await request(server)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ nome: 'Gelo Escama 10kg', unidade: 'PCT', preco_base: 19.0 });
    expect(pGelo2.status).toBe(201);
    noCatGelo2Id = pGelo2.body.item.id;

    // Tabelas de preço para testar mass_price_table_all dinâmica
    const tARes = await request(server)
      .post('/api/price-tables')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        nome: 'Atacado Geral A',
        itens: [
          { produto_id: promoProdId, preco: 38.0, quantidade_minima: 10 },
          { produto_id: normalProdId, preco: 99.9, quantidade_minima: 3 }
        ]
      });
    expect(tARes.status).toBe(201);
    tableAId = tARes.body.item.id;

    const tBRes = await request(server)
      .post('/api/price-tables')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        nome: 'Atacado Geral B',
        itens: [
          { produto_id: normalProdId, preco: 92.5, quantidade_minima: 6 }
        ]
      });
    expect(tBRes.status).toBe(201);
    tableBId = tBRes.body.item.id;

    const applyRes = await request(server)
      .post('/api/price-tables/apply')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ tabela_id: tableAId, target: 'ALL' });
    expect(applyRes.status).toBe(200);
  });

  afterAll(() => {
    db.prepare("DELETE FROM configuracoes WHERE chave='mass_price_table_all'").run();
    server.close();
  });

  it('1. Sobrescreve arquivo único catalogo.pdf, remove catalogo-<timestamp>.pdf legados e serve admin/seller', async () => {
    const exportsDir = path.join(STORAGE, 'exports');
    fs.mkdirSync(exportsDir, { recursive: true });
    const legacy1 = path.join(exportsDir, 'catalogo-1700000000001.pdf');
    const legacy2 = path.join(exportsDir, 'catalogo-1700000000002.pdf');
    fs.writeFileSync(legacy1, 'legacy-1');
    fs.writeFileSync(legacy2, 'legacy-2');

    const adminRes = await request(server)
      .get('/api/admin/export/catalog.pdf')
      .set('Authorization', `Bearer ${adminToken}`)
      .buffer(true)
      .parse(binaryResponseParser);
    expect(adminRes.status).toBe(200);
    expect(adminRes.headers['content-type']).toMatch(/application\/pdf/);

    const sellerRes = await request(server)
      .get('/api/catalog/export.pdf')
      .set('Authorization', `Bearer ${sellerToken}`)
      .buffer(true)
      .parse(binaryResponseParser);
    expect(sellerRes.status).toBe(200);
    expect(sellerRes.headers['content-type']).toMatch(/application\/pdf/);

    const files = fs.readdirSync(exportsDir);
    expect(files).toContain('catalogo.pdf');
    expect(files.some(f => /^catalogo-\d+\.pdf$/.test(f))).toBe(false);
    expect(files.filter(f => f.startsWith('catalogo'))).toEqual(['catalogo.pdf']);
  });

  it('2. Renderiza PROMOÇÃO no topo, preços dinâmicos em R$ XX,XX, qtd mín com unidade, esgotados normais e agrupamento por nome', async () => {
    const res = await request(server)
      .get('/api/admin/export/catalog.pdf')
      .set('Authorization', `Bearer ${adminToken}`)
      .buffer(true)
      .parse(binaryResponseParser);
    expect(res.status).toBe(200);

    const lines = extractPdfLines(res.body);
    const fullText = lines.join('\n');

    // Cabeçalho institucional e tabela geral vigente, sem total de produtos e sem estoque
    expect(fullText).toContain('XIQUIM VARGAS - DISTRIBUIDORA DE BEBIDAS');
    expect(fullText).toContain('CATÁLOGO DE PRODUTOS');
    expect(fullText).toContain('Tabela Geral vigente: Atacado Geral A');
    expect(fullText).not.toMatch(/Total de produtos/i);
    expect(fullText).not.toMatch(/DISPON[IÍ]VEL|RESERVADO|ESTOQUE/i);

    // Seção PROMOÇÃO antes de DEMAIS PRODUTOS, sem duplicar item promocional abaixo
    const promoIdx = lines.findIndex(l => l === 'PROMOÇÃO');
    const othersIdx = lines.findIndex(l => l === 'DEMAIS PRODUTOS');
    expect(promoIdx).toBeGreaterThan(-1);
    expect(othersIdx).toBeGreaterThan(promoIdx);

    const promoSection = lines.slice(promoIdx, othersIdx).join('\n');
    const othersSection = lines.slice(othersIdx).join('\n');
    expect(promoSection).toContain('Cerveja Pilsen Promocional 350ml');
    expect(promoSection).toContain('R$ 42,00');
    expect(promoSection).toContain('R$ 36,90');
    expect(promoSection).toContain('R$ 38,00');
    expect(promoSection).toContain('10 FD');
    expect(othersSection).not.toContain('Cerveja Pilsen Promocional 350ml');

    // Produto normal com preço da tabela geral e unidade CX
    expect(othersSection).toContain('[CERVEJAS ESPECIAIS]');
    expect(othersSection).toContain('Cerveja Puro Malte 600ml');
    expect(othersSection).toContain('R$ 110,00');
    expect(othersSection).toContain('R$ 99,90');
    expect(othersSection).toContain('3 CX');

    // Produto esgotado = 1 listado normalmente sem tag/texto "esgotado"
    expect(othersSection).toContain('Chopp Artesanal 5L');
    expect(othersSection).toContain('R$ 85,00');
    expect(fullText.toLowerCase()).not.toContain('esgotado');

    // Produtos sem categoria agrupados por palavra-chave (BALAS E CONFEITOS) e por prefixo (GELO)
    const balasIdx = lines.findIndex(l => l === '[BALAS E CONFEITOS]');
    const geloIdx = lines.findIndex(l => l === '[GELO]');
    expect(balasIdx).toBeGreaterThan(othersIdx);
    expect(geloIdx).toBeGreaterThan(othersIdx);
    const bala1Idx = lines.findIndex(l => l.includes('Bala Hortela 500g'));
    const bala2Idx = lines.findIndex(l => l.includes('Bala Morango 500g'));
    expect(bala1Idx).toBeGreaterThan(balasIdx);
    expect(bala2Idx).toBeGreaterThan(balasIdx);
    const gelo1Idx = lines.findIndex(l => l.includes('Gelo Cubo 5kg'));
    const gelo2Idx = lines.findIndex(l => l.includes('Gelo Escama 10kg'));
    expect(gelo1Idx).toBeGreaterThan(geloIdx);
    expect(gelo2Idx).toBeGreaterThan(geloIdx);

    // Impressão em console de prévia real extraída do PDF para conferência visual
    // eslint-disable-next-line no-console
    console.log('\n--- PRÉVIA REAL DO PDF GERADO ---\n' + fullText + '\n---------------------------------');
  });

  it('3. Atualiza automaticamente preços e qtd. mínima ao trocar ou editar tabela geral vigente (mass_price_table_all)', async () => {
    // Edita item na tabela B e aplica target: 'ALL'
    const editRes = await request(server)
      .put(`/api/price-tables/${tableBId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        itens: [
          { produto_id: normalProdId, preco: 88.4, quantidade_minima: 12 },
          { produto_id: noCatBala1Id, preco: 11.2, quantidade_minima: 4 }
        ]
      });
    expect(editRes.status).toBe(200);

    const applyB = await request(server)
      .post('/api/price-tables/apply')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ tabela_id: tableBId, target: 'ALL' });
    expect(applyB.status).toBe(200);

    const resB = await request(server)
      .get('/api/catalog/export.pdf')
      .set('Authorization', `Bearer ${sellerToken}`)
      .buffer(true)
      .parse(binaryResponseParser);
    expect(resB.status).toBe(200);

    const textB = extractPdfLines(resB.body).join('\n');
    expect(textB).toContain('Tabela Geral vigente: Atacado Geral B');
    expect(textB).toContain('R$ 88,40');
    expect(textB).toContain('12 CX');
    expect(textB).toContain('R$ 11,20');
    expect(textB).toContain('4 PCT');
    expect(textB).not.toContain('R$ 99,90');
    expect(textB).not.toContain('3 CX');

    // Ao inativar a tabela B, mass_price_table_all é limpa e o PDF mostra "Nenhuma ativa"
    const inactB = await request(server)
      .put(`/api/price-tables/${tableBId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ativo: 0 });
    expect(inactB.status).toBe(200);

    const resNone = await request(server)
      .get('/api/admin/export/catalog.pdf')
      .set('Authorization', `Bearer ${adminToken}`)
      .buffer(true)
      .parse(binaryResponseParser);
    expect(resNone.status).toBe(200);
    const textNone = extractPdfLines(resNone.body).join('\n');
    expect(textNone).toContain('Tabela Geral vigente: Nenhuma ativa');
    expect(textNone).not.toContain('R$ 88,40');
    expect(textNone).not.toContain('12 CX');
  });
});
