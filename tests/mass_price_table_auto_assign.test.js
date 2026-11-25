import request from 'supertest';
import { server } from '../server.js';
import { db } from '../src/db.js';
import { hashPassword } from '../src/auth.js';

describe('Auto-Assign Mass Price Table (target ALL) for New Clients', () => {
  let adminToken;
  let sellerToken;
  let sellerId = 'mass-pt-seller-1';
  let productId;
  let massTableId;
  let vipTableId;

  beforeAll(async () => {
    const admin = db.prepare('SELECT id FROM usuarios WHERE email=?').get('massptadmin@xiquim.local');
    if (!admin) {
      db.prepare('INSERT INTO usuarios (id, nome, email, senha_hash, role, ativo) VALUES (?, ?, ?, ?, ?, ?)').run(
        'mass-pt-admin-1', 'Mass PT Admin', 'massptadmin@xiquim.local', hashPassword('TestPass123!'), 'admin', 1
      );
    }

    const seller = db.prepare('SELECT id FROM usuarios WHERE email=?').get('massptseller@xiquim.local');
    if (!seller) {
      db.prepare('INSERT INTO usuarios (id, nome, email, senha_hash, role, ativo) VALUES (?, ?, ?, ?, ?, ?)').run(
        sellerId, 'Mass PT Seller', 'massptseller@xiquim.local', hashPassword('TestPass123!'), 'seller', 1
      );
    } else {
      sellerId = seller.id;
    }

    const resAdmin = await request(server)
      .post('/api/auth/login')
      .send({ email: 'massptadmin@xiquim.local', password: 'TestPass123!' });
    adminToken = resAdmin.body.token;

    const resSeller = await request(server)
      .post('/api/auth/login')
      .send({ email: 'massptseller@xiquim.local', password: 'TestPass123!' });
    sellerToken = resSeller.body.token;

    const pRes = await request(server)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ nome: 'Produto Atacado Massa Auto', preco_base: 100 });
    expect(pRes.status).toBe(201);
    productId = pRes.body.item.id;

    // Tabela VIP individual para testar precedência
    const vipRes = await request(server)
      .post('/api/price-tables')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        nome: 'Tabela VIP Exclusiva',
        itens: [{ produto_id: productId, preco: 60, quantidade_minima: 1 }]
      });
    expect(vipRes.status).toBe(201);
    vipTableId = vipRes.body.item.id;
  });

  afterAll(() => {
    db.prepare("DELETE FROM configuracoes WHERE chave='mass_price_table_all'").run();
    server.close();
  });

  it('1. Admin creates wholesale table with min qty and applies with target ALL', async () => {
    const createRes = await request(server)
      .post('/api/price-tables')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        nome: 'Tabela Atacado Global',
        itens: [{ produto_id: productId, preco: 75, quantidade_minima: 5 }]
      });
    expect(createRes.status).toBe(201);
    massTableId = createRes.body.item.id;

    const applyRes = await request(server)
      .post('/api/price-tables/apply')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ tabela_id: massTableId, target: 'ALL' });
    expect(applyRes.status).toBe(200);
    expect(applyRes.body.ok).toBe(true);

    const cfg = db.prepare("SELECT valor FROM configuracoes WHERE chave='mass_price_table_all'").get();
    expect(cfg?.valor).toBe(massTableId);
  });

  it('2. Seller registers new client and immediately inherits mass price table and min qty', async () => {
    const clientRes = await request(server)
      .post('/api/clients')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({
        razao_social: 'Cliente Novo Vendedor Auto',
        cnpj_cpf: '11222333000181',
        endereco: 'Rua das Flores, 100',
        bairro: 'Centro'
      });

    expect(clientRes.status).toBe(201);
    const created = clientRes.body.item;
    expect(created.tabela_preco_massa_id).toBe(massTableId);
    expect(created.tabela_preco_id).toBe(massTableId);
    expect(created.tabela_preco_individual_id).toBeNull();

    const prodRes = await request(server)
      .get(`/api/products?cliente_id=${created.id}`)
      .set('Authorization', `Bearer ${sellerToken}`);
    expect(prodRes.status).toBe(200);

    const prod = prodRes.body.items.find(x => x.id === productId);
    expect(prod).toBeDefined();
    expect(prod.preco_tabela).toBe(75);
    expect(prod.quantidade_minima).toBe(5);
  });

  it('3. Web client self-registers (POST /api/store/register) and immediately gets mass price table', async () => {
    const regRes = await request(server)
      .post('/api/store/register')
      .send({
        nome: 'Cliente Loja Web Auto',
        email: 'webauto@xiquim.local',
        password: 'WebPassword123!',
        endereco: 'Av. Brasil, 250',
        bairro: 'Centro',
        telefone: '33999998888'
      });

    expect(regRes.status).toBe(201);
    expect(regRes.body.token).toBeDefined();

    const webToken = regRes.body.token;
    const webUserId = regRes.body.user.id;
    const link = db.prepare('SELECT cliente_id FROM usuario_clientes WHERE usuario_id=?').get(webUserId);
    expect(link).toBeDefined();

    const dbClient = db.prepare('SELECT * FROM clientes WHERE id=?').get(link.cliente_id);
    expect(dbClient.tabela_preco_massa_id).toBe(massTableId);
    expect(dbClient.tabela_preco_id).toBe(massTableId);

    const prodRes = await request(server)
      .get(`/api/products?cliente_id=${link.cliente_id}`)
      .set('Authorization', `Bearer ${webToken}`);
    expect(prodRes.status).toBe(200);

    const prod = prodRes.body.items.find(x => x.id === productId);
    expect(prod).toBeDefined();
    expect(prod.preco_tabela).toBe(75);
    expect(prod.quantidade_minima).toBe(5);
  });

  it('4. Admin registers VIP client with individual table keeping priority over active mass table', async () => {
    const vipClientRes = await request(server)
      .post('/api/clients')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        razao_social: 'Cliente VIP Prioridade',
        cnpj_cpf: '22333444000192',
        endereco: 'Rua VIP, 500',
        bairro: 'Centro',
        tabela_preco_id: vipTableId
      });

    expect(vipClientRes.status).toBe(201);
    const created = vipClientRes.body.item;
    expect(created.tabela_preco_individual_id).toBe(vipTableId);
    expect(created.tabela_preco_massa_id).toBe(massTableId);
    expect(created.tabela_preco_id).toBe(vipTableId);

    const prodRes = await request(server)
      .get(`/api/products?cliente_id=${created.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(prodRes.status).toBe(200);

    const prod = prodRes.body.items.find(x => x.id === productId);
    expect(prod).toBeDefined();
    expect(prod.preco_tabela).toBe(60);
    expect(prod.quantidade_minima).toBe(1);
    expect(prod.preco_aplicado).toBe(60);
  });

  it('5. When mass table is cleared, inactivated, or deleted, newly registered clients do not inherit it', async () => {
    // A. Inativar a tabela global -> limpa a regra
    const inactRes = await request(server)
      .put(`/api/price-tables/${massTableId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ativo: 0 });
    expect(inactRes.status).toBe(200);
    expect(db.prepare("SELECT valor FROM configuracoes WHERE chave='mass_price_table_all'").get()).toBeUndefined();

    const afterInactClient = await request(server)
      .post('/api/clients')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({
        razao_social: 'Cliente Apos Inativacao',
        cnpj_cpf: '33444555000103',
        endereco: 'Rua Sem Tabela, 1',
        bairro: 'Centro'
      });
    expect(afterInactClient.status).toBe(201);
    expect(afterInactClient.body.item.tabela_preco_massa_id).toBeNull();
    expect(afterInactClient.body.item.tabela_preco_id).toBeNull();

    // B. Reativar, reaplicar ALL e remover todos clientes (DELETE /clients) -> limpa a regra
    await request(server)
      .put(`/api/price-tables/${massTableId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ativo: 1 });
    await request(server)
      .post('/api/price-tables/apply')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ tabela_id: massTableId, target: 'ALL' });
    expect(db.prepare("SELECT valor FROM configuracoes WHERE chave='mass_price_table_all'").get()?.valor).toBe(massTableId);

    const clearClientsRes = await request(server)
      .delete(`/api/price-tables/${massTableId}/clients`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(clearClientsRes.status).toBe(200);
    expect(db.prepare("SELECT valor FROM configuracoes WHERE chave='mass_price_table_all'").get()).toBeUndefined();

    // C. Reaplicar ALL e excluir a tabela (DELETE /:id) -> limpa a regra
    await request(server)
      .post('/api/price-tables/apply')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ tabela_id: massTableId, target: 'ALL' });
    expect(db.prepare("SELECT valor FROM configuracoes WHERE chave='mass_price_table_all'").get()?.valor).toBe(massTableId);

    const delTableRes = await request(server)
      .delete(`/api/price-tables/${massTableId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(delTableRes.status).toBe(200);
    expect(db.prepare("SELECT valor FROM configuracoes WHERE chave='mass_price_table_all'").get()).toBeUndefined();

    const afterDeleteClient = await request(server)
      .post('/api/clients')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({
        razao_social: 'Cliente Apos Exclusao',
        cnpj_cpf: '44555666000114',
        endereco: 'Rua Sem Tabela, 2',
        bairro: 'Centro'
      });
    expect(afterDeleteClient.status).toBe(201);
    expect(afterDeleteClient.body.item.tabela_preco_massa_id).toBeNull();
    expect(afterDeleteClient.body.item.tabela_preco_id).toBeNull();

    const prodRes = await request(server)
      .get(`/api/products?cliente_id=${afterDeleteClient.body.item.id}`)
      .set('Authorization', `Bearer ${sellerToken}`);
    const prod = prodRes.body.items.find(x => x.id === productId);
    expect(prod.preco_tabela).toBeUndefined();
    expect(prod.preco_aplicado).toBe(100);
  });
});
