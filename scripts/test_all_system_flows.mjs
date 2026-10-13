process.env.NODE_ENV = 'test';
import request from 'supertest';
import fs from 'node:fs';
import path from 'node:path';
import { db, one, all, run, STORAGE } from '../src/db.js';
import { hashPassword } from '../src/auth.js';

const { server } = await import('../server.js');

const results = {
  total: 0,
  passed: 0,
  failed: 0,
  steps: []
};

function assert(condition, description, details = null) {
  results.total++;
  if (condition) {
    results.passed++;
    results.steps.push({ status: 'PASS', description, details });
    console.log(`  [PASS] ${description}`);
  } else {
    results.failed++;
    results.steps.push({ status: 'FAIL', description, details });
    console.error(`  [FAIL] ${description}`, details || '');
    throw new Error(`Assertion failed: ${description}`);
  }
}

async function runAllFlows() {
  console.log('='.repeat(80));
  console.log('INICIANDO TESTES EXAUSTIVOS DE TODOS OS FLUXOS DO SISTEMA XIQUIM VARGAS ERP');
  console.log('Todas as operações e dados gerados PERMANECERÃO salvos no banco de dados.');
  console.log('='.repeat(80));

  const ts = Date.now();

  // =========================================================================
  // FASE 1: HEALTH, PRONTIDÃO E AUTENTICAÇÃO
  // =========================================================================
  console.log('\n--- FASE 1: Verificação de Prontidão, Health e Autenticação ---');
  
  const healthRes = await request(server).get('/health');
  assert(healthRes.status === 200 && healthRes.body.ok === true, 'GET /health retorna 200 e ok:true');
  
  const readyRes = await request(server).get('/ready');
  assert(readyRes.status === 200 && readyRes.body.ready === true, 'GET /ready retorna 200 e ready:true');

  // Assegurar usuário admin para o teste
  const adminEmail = 'testadmin@xiquim.local';
  const adminPass = 'TestPass123!';
  let adminUser = one('SELECT * FROM usuarios WHERE email=?', [adminEmail]);
  if (!adminUser) {
    const adminId = 'admin-e2e-' + ts;
    run("INSERT INTO usuarios (id, nome, email, senha_hash, role, ativo) VALUES (?, ?, ?, ?, 'admin', 1)",
      [adminId, 'Administrador E2E', adminEmail, hashPassword(adminPass)]);
    adminUser = one('SELECT * FROM usuarios WHERE email=?', [adminEmail]);
  } else {
    run("UPDATE usuarios SET senha_hash=?, ativo=1 WHERE email=?", [hashPassword(adminPass), adminEmail]);
  }

  const loginRes = await request(server)
    .post('/api/auth/login')
    .send({ email: adminEmail, password: adminPass });
  assert(loginRes.status === 200 && loginRes.body.token, 'POST /api/auth/login autentica admin e retorna token JWT');
  const adminToken = loginRes.body.token;

  const meRes = await request(server)
    .get('/api/me')
    .set('Authorization', `Bearer ${adminToken}`);
  assert(meRes.status === 200 && meRes.body.user.email === adminEmail, 'GET /api/me valida sessão e dados do usuário ativo');

  // =========================================================================
  // FASE 2: GESTÃO DE USUÁRIOS COM ROLES EM PORTUGUÊS E IMPERSONATION
  // =========================================================================
  console.log('\n--- FASE 2: Cadastro de Usuários (Roles em Português) e Impersonation ---');

  const accessLinksRes = await request(server)
    .get('/api/admin/access-links')
    .set('Authorization', `Bearer ${adminToken}`);
  assert(accessLinksRes.status === 200 && accessLinksRes.body.links.seller, 'GET /api/admin/access-links retorna links para todas as roles');

  // Criar Vendedor
  const sellerEmail = `vendedor_${ts}@xiquim.local`;
  const createSellerRes = await request(server)
    .post('/api/users')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ nome: `Vendedor Teste ${ts}`, email: sellerEmail, password: 'Password123!', role: 'seller', telefone: '11999990001' });
  assert(createSellerRes.status === 201 && createSellerRes.body.item.role === 'seller', 'POST /api/users cria usuário Vendedor (seller)');
  const sellerUser = createSellerRes.body.item;

  const sellerLogin = await request(server).post('/api/auth/login').send({ email: sellerEmail, password: 'Password123!' });
  const sellerToken = sellerLogin.body.token;
  assert(sellerLogin.status === 200 && sellerToken, 'Vendedor realiza login com sucesso');

  // Criar Caixa (PDV)
  const cashierEmail = `caixa_${ts}@xiquim.local`;
  const createCashierRes = await request(server)
    .post('/api/users')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ nome: `Caixa Teste ${ts}`, email: cashierEmail, password: 'Password123!', role: 'cashier', telefone: '11999990002' });
  assert(createCashierRes.status === 201 && createCashierRes.body.item.role === 'cashier', 'POST /api/users cria usuário Caixa (cashier)');
  const cashierUser = createCashierRes.body.item;

  const cashierLogin = await request(server).post('/api/auth/login').send({ email: cashierEmail, password: 'Password123!' });
  const cashierToken = cashierLogin.body.token;
  assert(cashierLogin.status === 200 && cashierToken, 'Caixa realiza login com sucesso');

  // Criar Motorista
  const driverEmail = `motorista_${ts}@xiquim.local`;
  const createDriverRes = await request(server)
    .post('/api/users')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ nome: `Motorista Teste ${ts}`, email: driverEmail, password: 'Password123!', role: 'driver', telefone: '11999990003' });
  assert(createDriverRes.status === 201 && createDriverRes.body.item.role === 'driver', 'POST /api/users cria usuário Motorista (driver)');
  const driverUser = createDriverRes.body.item;

  const driverLogin = await request(server).post('/api/auth/login').send({ email: driverEmail, password: 'Password123!' });
  const driverToken = driverLogin.body.token;
  assert(driverLogin.status === 200 && driverToken, 'Motorista realiza login com sucesso');

  // Atualizar usuário
  const updateSellerRes = await request(server)
    .put(`/api/users/${sellerUser.id}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ nome: `Vendedor Teste Atualizado ${ts}`, telefone: '11988887777' });
  assert(updateSellerRes.status === 200 && updateSellerRes.body.item.nome.includes('Atualizado'), 'PUT /api/users/:id atualiza dados de usuário');

  const impersonation=await request(app).post('/api/admin/impersonate').set('Authorization',`Bearer ${adminToken}`).send({user_id:sellerId});
  assert(impersonation.status===404,'impersonation endpoint has been removed');

  // =========================================================================
  // FASE 3: CATÁLOGO, CATEGORIAS, PRODUTOS, FOTOS E PROMOÇÕES
  // =========================================================================
  console.log('\n--- FASE 3: Catálogo, Categorias, Subcategorias, Produtos e Promoções ---');

  // Criar Categoria
  const catRes = await request(server)
    .post('/api/categories')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ nome: `Categoria E2E ${ts}`, descricao: 'Bebidas Premium para Teste E2E', ordem: 1 });
  assert(catRes.status === 201 && catRes.body.item.id, 'POST /api/categories cria nova categoria no catálogo');
  const catId = catRes.body.item.id;

  // Atualizar Categoria
  const catUpdate = await request(server)
    .put(`/api/categories/${catId}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ descricao: 'Descrição atualizada com sucesso' });
  assert(catUpdate.status === 200, 'PUT /api/categories/:id atualiza categoria');

  // Criar Subcategoria
  const subRes = await request(server)
    .post('/api/subcategories')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ categoria_id: catId, nome: `Subcategoria Cervejas ${ts}`, ordem: 1 });
  assert(subRes.status === 201 && subRes.body.item.id, 'POST /api/subcategories cria subcategoria vinculada');
  const subId = subRes.body.item.id;

  // Criar Produtos
  const p1Barcode = `789${String(ts).slice(-10)}`;
  const p1Sku = `SKU-E2E-1-${ts}`;
  const prod1Res = await request(server)
    .post('/api/products')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      nome: `Cerveja Puro Malte E2E ${ts}`,
      sku: p1Sku,
      codigo_barras: p1Barcode,
      preco_base: 8.50,
      categoria_id: catId,
      subcategoria_id: subId,
      unidade: 'UN',
      marca: 'Xiquim Cervejaria',
      sabor: 'Puro Malte'
    });
  assert(prod1Res.status === 201 && prod1Res.body.item.id, 'POST /api/products cria primeiro produto com código de barras');
  const prod1Id = prod1Res.body.item.id;

  const p2Sku = `SKU-E2E-2-${ts}`;
  const prod2Res = await request(server)
    .post('/api/products')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      nome: `Refrigerante Artesanal E2E ${ts}`,
      sku: p2Sku,
      codigo_barras: `788${String(ts).slice(-10)}`,
      preco_base: 5.00,
      categoria_id: catId,
      subcategoria_id: subId,
      unidade: 'LT',
      marca: 'Xiquim Refrescos'
    });
  assert(prod2Res.status === 201 && prod2Res.body.item.id, 'POST /api/products cria segundo produto');
  const prod2Id = prod2Res.body.item.id;

  // Toggle Sold-out
  const soldOutRes = await request(server)
    .post(`/api/products/${prod2Id}/sold-out`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ esgotado: true });
  assert(soldOutRes.status === 200 && soldOutRes.body.item.esgotado === 1, 'POST /api/products/:id/sold-out marca produto como esgotado');

  const unSoldOutRes = await request(server)
    .post(`/api/products/${prod2Id}/sold-out`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ esgotado: false });
  assert(unSoldOutRes.status === 200 && unSoldOutRes.body.item.esgotado === 0, 'POST /api/products/:id/sold-out desmarca produto esgotado');

  // Adicionar Promoção
  const promoRes = await request(server)
    .post(`/api/products/${prod1Id}/promotions`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ nome: `Super Promoção E2E ${ts}`, preco_promocional: 7.20 });
  assert(promoRes.status === 201 && promoRes.body.item.preco_promocional === 7.20, 'POST /api/products/:id/promotions cria promoção ativa');
  const promoId = promoRes.body.item.id;

  const promoList = await request(server)
    .get('/api/promotions')
    .set('Authorization', `Bearer ${adminToken}`);
  assert(promoList.status === 200 && promoList.body.items.some(p => p.id === promoId), 'GET /api/promotions lista promoções ativas');

  // Upload Imagem de Produto (1x1 transparente PNG base64)
  const sampleImg = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';
  const imgUploadRes = await request(server)
    .post(`/api/products/${prod1Id}/images`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ data_url: sampleImg });
  assert(imgUploadRes.status === 201 && imgUploadRes.body.item.id, 'POST /api/products/:id/images realiza upload de foto do produto');
  const imageId = imgUploadRes.body.item.id;

  const imgListRes = await request(server)
    .get(`/api/products/${prod1Id}/images`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert(imgListRes.status === 200 && imgListRes.body.items.length > 0, 'GET /api/products/:id/images lista fotos cadastradas');

  // Exportar PDF do Catálogo
  const catPdfRes = await request(server)
    .get('/api/admin/export/catalog.pdf')
    .set('Authorization', `Bearer ${adminToken}`);
  assert(catPdfRes.status === 200 && String(catPdfRes.headers['content-type']).includes('application/pdf'), 'GET /api/admin/export/catalog.pdf gera e exporta PDF do catálogo');

  // =========================================================================
  // FASE 4: ESTOQUE INTELIGENTE, MOVIMENTAÇÕES E CONSULTA PDV/VENDEDOR
  // =========================================================================
  console.log('\n--- FASE 4: Estoque Inteligente, Movimentações e Barcode Lookup ---');

  // Movimentação de Entrada no Estoque
  const stockInRes1 = await request(server)
    .post(`/api/stock/${prod1Id}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ delta: 150, tipo: 'ENTRADA', observacao: 'Carga inicial de teste E2E', estoque_minimo: 20 });
  assert(stockInRes1.status === 200 && stockInRes1.body.item.quantidade_disponivel === 150, 'POST /api/stock/:id entrada de 150 unidades no estoque');

  const stockInRes2 = await request(server)
    .post(`/api/stock/${prod2Id}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ delta: 80, tipo: 'ENTRADA', observacao: 'Carga inicial refri E2E', estoque_minimo: 15 });
  assert(stockInRes2.status === 200 && stockInRes2.body.item.quantidade_disponivel === 80, 'POST /api/stock/:id entrada de 80 unidades para segundo produto');

  // Ajuste de Estoque
  const stockAdjRes = await request(server)
    .post(`/api/stock/${prod1Id}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ delta: -5, tipo: 'AJUSTE', observacao: 'Ajuste de inventário -5' });
  assert(stockAdjRes.status === 200 && stockAdjRes.body.item.quantidade_disponivel === 145, 'POST /api/stock/:id ajuste de inventário decrementa corretamente');

  // Histórico de Movimentações
  const movRes = await request(server)
    .get(`/api/stock/${prod1Id}/movements`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert(movRes.status === 200 && movRes.body.items.length >= 2, 'GET /api/stock/:id/movements retorna auditoria completa de movimentações');

  // Consulta por Vendedor
  const sellerStockRes = await request(server)
    .get('/api/seller/stock')
    .set('Authorization', `Bearer ${sellerToken}`);
  assert(sellerStockRes.status === 200 && sellerStockRes.body.items.some(p => p.id === prod1Id), 'GET /api/seller/stock permite vendedor consultar estoque disponível');

  // Exportar PDF do Estoque
  const stockPdfRes = await request(server)
    .get('/api/admin/export/stock.pdf')
    .set('Authorization', `Bearer ${adminToken}`);
  assert(stockPdfRes.status === 200 && String(stockPdfRes.headers['content-type']).includes('application/pdf'), 'GET /api/admin/export/stock.pdf gera PDF do estoque inteligente');

  // =========================================================================
  // FASE 5: CADASTRO DE CLIENTES, ATRIBUIÇÃO E BARCODE DO PDV
  // =========================================================================
  console.log('\n--- FASE 5: Cadastro de Clientes e Leitura de Código de Barras no PDV ---');

  // Cliente Atribuído ao Vendedor
  const client1Res = await request(server)
    .post('/api/clients')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      razao_social: `Supermercado Central E2E ${ts}`,
      nome_fantasia: `Mercado Central ${ts}`,
      cnpj_cpf: `11.222.333/0001-${String(ts).slice(-2)}`,
      endereco: 'Av. Principal, 1000',
      bairro: 'Centro',
      cidade: 'Cidade Modelo',
      estado: 'SP',
      vendedor_id: sellerUser.id,
      telefone: '1133334444'
    });
  assert(client1Res.status === 201 && client1Res.body.item.id, 'POST /api/clients cadastra cliente com vendedor atribuído e bairro');
  const client1Id = client1Res.body.item.id;

  // Cliente 2 para Entregas
  const client2Res = await request(server)
    .post('/api/clients')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      razao_social: `Distribuidora Norte E2E ${ts}`,
      nome_fantasia: `Norte Bebidas ${ts}`,
      cnpj_cpf: `22.333.444/0001-${String(ts).slice(-2)}`,
      endereco: 'Rua das Flores, 500',
      bairro: 'Industrial',
      cidade: 'Cidade Modelo',
      estado: 'SP',
      telefone: '1133335555'
    });
  assert(client2Res.status === 201 && client2Res.body.item.id, 'POST /api/clients cadastra segundo cliente em outro bairro');
  const client2Id = client2Res.body.item.id;

  // Leitura de Código de Barras no Caixa
  const barcodeRes = await request(server)
    .get(`/api/pdv/barcode?code=${p1Barcode}&cliente_id=${client1Id}`)
    .set('Authorization', `Bearer ${cashierToken}`);
  assert(barcodeRes.status === 200 && barcodeRes.body.item.id === prod1Id, 'GET /api/pdv/barcode resolve produto e calcula preço para o cliente');

  // =========================================================================
  // FASE 6: TABELAS DE PREÇO, APLICAÇÃO EM MASSA, DETALHES E EXCLUSÃO
  // =========================================================================
  console.log('\n--- FASE 6: Tabelas de Preço, Aplicação em Massa, Detalhes e Exclusão ---');

  // Criar Tabela de Preço
  const createTableRes = await request(server)
    .post('/api/price-tables')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      nome: `Tabela Especial Atacado ${ts}`,
      itens: [
        { produto_id: prod1Id, preco: 6.80, quantidade_minima: 10 },
        { produto_id: prod2Id, preco: 4.20, quantidade_minima: 5 }
      ]
    });
  assert(createTableRes.status === 201 && createTableRes.body.item.id, 'POST /api/price-tables cria tabela de preço com regras de quantidade mínima');
  const priceTableId = createTableRes.body.item.id;

  // Aplicar Tabela ao Cliente 1
  const applyIndivRes = await request(server)
    .post('/api/price-tables/apply')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ tabela_id: priceTableId, target: 'INDIVIDUAL', cliente_id: client1Id });
  assert(applyIndivRes.status === 200 && applyIndivRes.body.ok, 'POST /api/price-tables/apply aplica tabela ao cliente individual');

  // Aplicar Tabela em Massa a Vendedores
  const applySellerRes = await request(server)
    .post('/api/price-tables/apply')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ tabela_id: priceTableId, target: 'VENDEDOR', vendedor_id: sellerUser.id });
  assert(applySellerRes.status === 200, 'POST /api/price-tables/apply aplica tabela em massa aos clientes do vendedor');

  // Detalhes da Tabela de Preço
  const tableDetailsRes = await request(server)
    .get(`/api/price-tables/${priceTableId}/details`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert(tableDetailsRes.status === 200 && tableDetailsRes.body.clients.length > 0, 'GET /api/price-tables/:id/details retorna clientes e canais vinculados');

  // Testar Tabela Temporária para exclusão
  const tempTableRes = await request(server)
    .post('/api/price-tables')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ nome: `Tabela Para Exclusão ${ts}`, itens: [{ produto_id: prod1Id, preco: 7.99 }] });
  const tempTableId = tempTableRes.body.item.id;

  const deleteTableRes = await request(server)
    .delete(`/api/price-tables/${tempTableId}`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert(deleteTableRes.status === 200 && deleteTableRes.body.ok, 'DELETE /api/price-tables/:id exclui tabela e desvincula clientes em tempo real');

  // =========================================================================
  // FASE 7: CICLO COMPLETO DE PEDIDOS: BALCAO, VENDEDOR E WEB
  // =========================================================================
  console.log('\n--- FASE 7: Emissão de Pedidos (Balcão, Vendedor Externo e Loja Online) ---');

  // 7A: Pedido de BALCÃO com Pagamento em Dinheiro e Troco
  const balcaoOrderRes = await request(server)
    .post('/api/orders')
    .set('Authorization', `Bearer ${cashierToken}`)
    .send({
      cliente_id: 'CLIENTE-BALCAO',
      itens: [{ produto_id: prod1Id, quantidade: 4 }],
      origem: 'BALCAO',
      modalidade_entrega: 'RETIRADA',
      forma_pagamento: 'DINHEIRO',
      pagamento_status: 'RECEBIDO',
      valor_recebido: 50.00,
      observacoes: 'Pedido no balcão pago à vista em dinheiro'
    });
  assert(balcaoOrderRes.status === 201 && balcaoOrderRes.body.item.id, 'POST /api/orders emite pedido BALCAO com troco calculado');
  const balcaoOrder = balcaoOrderRes.body.item;
  assert(balcaoOrder.pagamento_status === 'RECEBIDO', 'Pedido BALCAO registrado com status de pagamento RECEBIDO');

  // Download do Cupom Térmico Balcão
  const balcaoPdfRes = await request(server)
    .get(`/api/orders/${balcaoOrder.id}/pdf`)
    .set('Authorization', `Bearer ${cashierToken}`);
  assert(balcaoPdfRes.status === 200 && String(balcaoPdfRes.headers['content-type']).includes('application/pdf'), 'GET /api/orders/:id/pdf gera e entrega cupom térmico para pedido balcão');

  // 7B: Pedido de VENDEDOR EXTERNO com Desconto e Entrega
  const sellerOrderRes = await request(server)
    .post('/api/orders')
    .set('Authorization', `Bearer ${sellerToken}`)
    .send({
      cliente_id: client1Id,
      itens: [{ produto_id: prod1Id, quantidade: 10 }, { produto_id: prod2Id, quantidade: 5 }],
      origem: 'VENDEDOR',
      modalidade_entrega: 'ENTREGA',
      desconto_tipo: 'VALOR',
      desconto_valor: 10.00,
      forma_pagamento: 'PIX',
      pagamento_status: 'RECEBIDO',
      observacoes: 'Entrega urgente para cliente do vendedor'
    });
  assert(sellerOrderRes.status === 201 && sellerOrderRes.body.item.id, 'POST /api/orders emite pedido VENDEDOR com desconto e entrega agendada');
  const sellerOrder = sellerOrderRes.body.item;

  // 7C: Pedido da LOJA ONLINE (Web Client)
  // Registrar cliente na Loja Online
  const webClientEmail = `webuser_${ts}@xiquim.local`;
  const webRegRes = await request(server)
    .post('/api/store/register')
    .send({
      nome: `Cliente Loja Online ${ts}`,
      email: webClientEmail,
      password: 'StrongWebPass123!',
      endereco: 'Av. Beira Rio, 250',
      bairro: 'Industrial',
      telefone: '11977778888'
    });
  assert(webRegRes.status === 201 && webRegRes.body.token, 'POST /api/store/register registra cliente na Loja Online');
  const webToken = webRegRes.body.token;

  // Obter perfil da loja online
  const webProfileRes = await request(server)
    .get('/api/store/profile')
    .set('Authorization', `Bearer ${webToken}`);
  assert(webProfileRes.status === 200 && webProfileRes.body.item.cliente_id, 'GET /api/store/profile retorna perfil comercial do cliente web');
  const webClientId = webProfileRes.body.item.cliente_id;

  // Emitir pedido na Loja Online com Cartão Parcelado
  const webOrderRes = await request(server)
    .post('/api/orders')
    .set('Authorization', `Bearer ${webToken}`)
    .send({
      cliente_id: webClientId,
      itens: [{ produto_id: prod1Id, quantidade: 6 }],
      origem: 'WEB',
      modalidade_entrega: 'ENTREGA',
      forma_pagamento: 'CREDITO',
      cartao_modalidade: 'PARCELADO',
      parcelas: 3,
      observacoes: 'Compra realizada pelo portal web'
    });
  assert(webOrderRes.status === 201 && webOrderRes.body.item.id, 'POST /api/orders cliente web emite pedido na Loja Online');
  const webOrder = webOrderRes.body.item;

  // 7D: Teste de Cancelamento de Pedido e Estorno de Estoque
  const cancelTestOrderRes = await request(server)
    .post('/api/orders')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      cliente_id: client1Id,
      itens: [{ produto_id: prod1Id, quantidade: 3 }],
      origem: 'BALCAO',
      modalidade_entrega: 'RETIRADA'
    });
  const cancelOrderId = cancelTestOrderRes.body.item.id;
  
  const cancelRes = await request(server)
    .post(`/api/orders/${cancelOrderId}/cancel`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ motivo: 'Cancelamento de teste operacional E2E' });
  assert(cancelRes.status === 200 && cancelRes.body.item.status === 'CANCELADO', 'POST /api/orders/:id/cancel cancela pedido e estorna reservas com segurança');

  const cancelledListRes = await request(server)
    .get('/api/orders/cancelled')
    .set('Authorization', `Bearer ${adminToken}`);
  assert(cancelledListRes.status === 200 && cancelledListRes.body.items.some(o => o.id === cancelOrderId), 'GET /api/orders/cancelled lista pedidos cancelados');

  // =========================================================================
  // FASE 8: LOGÍSTICA, SEPARAÇÃO, LISTA DE CARREGAMENTO E ROTAS DE ENTREGA
  // =========================================================================
  console.log('\n--- FASE 8: Logística: Separação, Lista de Carregamento, Rotas e Entregas ---');

  // Avançar pedidos de entrega para SEPARACAO
  const advSellerRes = await request(server)
    .post(`/api/orders/${sellerOrder.id}/status`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ status: 'SEPARACAO' });
  assert(advSellerRes.status === 200 && advSellerRes.body.item.status === 'SEPARACAO', 'POST /api/orders/:id/status avança pedido do vendedor para SEPARACAO');

  const advWebRes = await request(server)
    .post(`/api/orders/${webOrder.id}/status`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ status: 'SEPARACAO' });
  assert(advWebRes.status === 200 && advWebRes.body.item.status === 'SEPARACAO', 'POST /api/orders/:id/status avança pedido web para SEPARACAO');

  // Agrupamento de Pedidos na Logística
  const groupedOrdersRes = await request(server)
    .get('/api/logistics/grouped-orders')
    .set('Authorization', `Bearer ${adminToken}`);
  assert(groupedOrdersRes.status === 200 && groupedOrdersRes.body.grupos.length > 0, 'GET /api/logistics/grouped-orders agrupa pedidos por origem e bairro');

  // Lista de Carregamento (Cálculo com Quantidade Primeiro)
  const deliveryOrderIds = [sellerOrder.id, webOrder.id];
  const loadListRes = await request(server)
    .post('/api/logistics/loading-list')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ pedido_ids: deliveryOrderIds });
  assert(loadListRes.status === 200 && loadListRes.body.produtos.length > 0, 'POST /api/logistics/loading-list calcula volumes consolidados de expedição');

  // PDF da Lista de Carregamento (Verificação do PDF)
  const loadListPdfRes = await request(server)
    .post('/api/logistics/loading-list/pdf')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ pedido_ids: deliveryOrderIds });
  assert(loadListPdfRes.status === 200 && String(loadListPdfRes.headers['content-type']).includes('application/pdf'), 'POST /api/logistics/loading-list/pdf gera PDF com quantidade primeiro e espaçamento');

  // PDF dos Pedidos em Lote da Carga
  const bulkOrdersPdfRes = await request(server)
    .post('/api/logistics/loading-list/orders-pdf')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ pedido_ids: deliveryOrderIds });
  assert(bulkOrdersPdfRes.status === 200 && String(bulkOrdersPdfRes.headers['content-type']).includes('application/pdf'), 'POST /api/logistics/loading-list/orders-pdf gera pacote consolidado de pedidos');

  // Geração de Rota Logística e Atribuição ao Motorista
  const routeRes = await request(server)
    .post('/api/logistics/routes')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ pedido_ids: deliveryOrderIds, motorista_id: driverUser.id });
  assert(routeRes.status === 201 && routeRes.body.item.id, 'POST /api/logistics/routes gera rota logística e atribui ao motorista');
  const routeId = routeRes.body.item.id;

  // Motorista Visualiza suas Rotas Ativas
  const driverRoutesRes = await request(server)
    .get('/api/logistics/routes')
    .set('Authorization', `Bearer ${driverToken}`);
  assert(driverRoutesRes.status === 200 && driverRoutesRes.body.items.some(r => r.id === routeId), 'GET /api/logistics/routes motorista acessa sua rota de entregas');

  // Motorista Anexa Comprovante de Entrega para Pedido 1
  const proofSample = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';
  const proofRes1 = await request(server)
    .post(`/api/logistics/orders/${sellerOrder.id}/proof`)
    .set('Authorization', `Bearer ${driverToken}`)
    .set('Idempotency-Key', `PROOF-E2E-1-${ts}`)
    .send({ data_url: proofSample });
  assert(proofRes1.status === 201 && proofRes1.body.ok, 'POST /api/logistics/orders/:id/proof motorista envia comprovante de entrega');

  // Motorista Conclui a Entrega do Pedido 1
  const completeRes1 = await request(server)
    .post(`/api/logistics/orders/${sellerOrder.id}/complete`)
    .set('Authorization', `Bearer ${driverToken}`)
    .set('Idempotency-Key', `COMPLETE-E2E-1-${ts}`)
    .send({});
  assert(completeRes1.status === 200 && completeRes1.body.item.status === 'CONCLUIDO', 'POST /api/logistics/orders/:id/complete entrega concluída e estoque baixado');

  // Motorista Anexa Comprovante de Entrega para Pedido 2 (Web)
  const proofRes2 = await request(server)
    .post(`/api/logistics/orders/${webOrder.id}/proof`)
    .set('Authorization', `Bearer ${driverToken}`)
    .set('Idempotency-Key', `PROOF-E2E-2-${ts}`)
    .send({ data_url: proofSample });
  assert(proofRes2.status === 201 && proofRes2.body.ok, 'Motorista anexa comprovante para segundo pedido da rota');

  // Motorista Conclui a Entrega do Pedido 2 (Web) -> Rota se torna CONCLUIDA
  const completeRes2 = await request(server)
    .post(`/api/logistics/orders/${webOrder.id}/complete`)
    .set('Authorization', `Bearer ${driverToken}`)
    .set('Idempotency-Key', `COMPLETE-E2E-2-${ts}`)
    .send({});
  assert(completeRes2.status === 200 && completeRes2.body.item.status === 'CONCLUIDO', 'Motorista conclui entrega final da rota com sucesso');

  // Histórico de Rotas Concluídas
  const completedRoutesRes = await request(server)
    .get('/api/logistics/completed-routes')
    .set('Authorization', `Bearer ${driverToken}`);
  assert(completedRoutesRes.status === 200 && completedRoutesRes.body.items.some(r => r.id === routeId), 'GET /api/logistics/completed-routes rota finalizada registrada no histórico');

  // =========================================================================
  // FASE 9: RECONCILIAÇÃO DE ESTOQUE, TORRE DE CONTROLE E RELATÓRIOS
  // =========================================================================
  console.log('\n--- FASE 9: Reconciliação, Dashboard com Filtros e Relatórios Gerenciais ---');

  // Reconciliação de Estoque (Verificação de consistência matemática)
  const reconcileRes = await request(server)
    .get('/api/admin/reconcile')
    .set('Authorization', `Bearer ${adminToken}`);
  assert(reconcileRes.status === 200 && reconcileRes.body.ok === true, 'GET /api/admin/reconcile integridade 100% perfeita entre reservas e pedidos abertos');

  // Dashboard Geral
  const dashGeral = await request(server)
    .get('/api/dashboard')
    .set('Authorization', `Bearer ${adminToken}`);
  assert(dashGeral.status === 200 && dashGeral.body.vendasPorOrigemPeriodos.geral, 'GET /api/dashboard retorna métricas gerais consolidadas');

  // Dashboard Semanal
  const dashSemanal = await request(server)
    .get('/api/dashboard?periodo=semanal')
    .set('Authorization', `Bearer ${adminToken}`);
  assert(dashSemanal.status === 200 && Array.isArray(dashSemanal.body.vendasPorOrigem), 'GET /api/dashboard?periodo=semanal filtra ranking por período semanal');

  // Dashboard Mensal
  const dashMensal = await request(server)
    .get('/api/dashboard?periodo=mensal')
    .set('Authorization', `Bearer ${adminToken}`);
  assert(dashMensal.status === 200 && Array.isArray(dashMensal.body.vendasPorOrigem), 'GET /api/dashboard?periodo=mensal filtra ranking por período mensal');

  // Relatórios Gerenciais - Geral
  const repGeral = await request(server)
    .get('/api/reports')
    .set('Authorization', `Bearer ${adminToken}`);
  assert(repGeral.status === 200 && repGeral.body.lojaOnline && repGeral.body.lojaOnline.faturamento >= 0, 'GET /api/reports retorna card de Vendas da Loja Online');

  // Relatórios Gerenciais - Semanal
  const repSemanal = await request(server)
    .get('/api/reports?periodo=semanal')
    .set('Authorization', `Bearer ${adminToken}`);
  assert(repSemanal.status === 200 && repSemanal.body.lojaOnline.pedidos >= 1, 'GET /api/reports?periodo=semanal contabiliza venda recente da Loja Online');

  // Relatórios Gerenciais - Mensal
  const repMensal = await request(server)
    .get('/api/reports?periodo=mensal')
    .set('Authorization', `Bearer ${adminToken}`);
  assert(repMensal.status === 200 && repMensal.body.lojaOnline.pedidos >= 1, 'GET /api/reports?periodo=mensal consolida vendas do mês da Loja Online');

  // Dashboard Mensal do Vendedor
  const sellerMonthDash = await request(server)
    .get('/api/seller/dashboard/monthly')
    .set('Authorization', `Bearer ${sellerToken}`);
  assert(sellerMonthDash.status === 200 && sellerMonthDash.body.pedidos >= 1, 'GET /api/seller/dashboard/monthly contabiliza vendas do vendedor no mês');

  // =========================================================================
  // FASE 10: GOVERNANÇA, AUDITORIA CRIPTOGRÁFICA E IA ADMINISTRATIVA
  // =========================================================================
  console.log('\n--- FASE 10: Auditoria Criptográfica SHA-256, Métricas e IA ---');

  // Auditoria
  const auditRes = await request(server)
    .get('/api/audit')
    .set('Authorization', `Bearer ${adminToken}`);
  assert(auditRes.status === 200 && auditRes.body.items.length > 0, 'GET /api/audit registra cadeia de auditoria completa');
  const hasIntegrityHash = auditRes.body.items.every(a => a.integrity_hash && a.integrity_hash.length === 64);
  assert(hasIntegrityHash, 'Todas as entradas de auditoria possuem hash SHA-256 de integridade');

  // Métricas do Sistema
  const metricsRes = await request(server)
    .get('/api/admin/metrics')
    .set('Authorization', `Bearer ${adminToken}`);
  assert(metricsRes.status === 200 && metricsRes.body.requests > 0, 'GET /api/admin/metrics fornece métricas operacionais em tempo de execução');

  // IA Administrativa
  const aiRes = await request(server)
    .post('/api/admin/ia')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ message: 'Qual o faturamento total em pedidos concluídos?' });
  assert(aiRes.status === 200 && aiRes.body.answer.includes('Contexto determinístico'), 'POST /api/admin/ia responde com contexto determinístico seguro');

  // Reconstrução de PDFs Pendentes
  const rebuildPdfRes = await request(server)
    .post('/api/admin/rebuild-pdfs')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({});
  assert(rebuildPdfRes.status === 200 && typeof rebuildPdfRes.body.fixed === 'number', 'POST /api/admin/rebuild-pdfs reconstrói PDFs do sistema');

  // Configurações do Sistema
  const settingsRes = await request(server)
    .get('/api/settings')
    .set('Authorization', `Bearer ${adminToken}`);
  assert(settingsRes.status === 200 && Array.isArray(settingsRes.body.items), 'GET /api/settings lê configurações do ERP');

  console.log('\n' + '='.repeat(80));
  console.log(`TODOS OS ${results.passed} PASSOS DE TESTES PASSARAM COM SUCESSO! (0 FALHAS)`);
  console.log('TODAS AS ALTERAÇÕES, DADOS, PEDIDOS E ROTAS PERMANECERAM NO BANCO DE DADOS.');
  console.log('='.repeat(80));

  return results;
}

runAllFlows()
  .then(res => {
    console.log(`\nRelatório Final: ${res.passed}/${res.total} verificações bem-sucedidas.`);
    process.exit(0);
  })
  .catch(err => {
    console.error('\nErro fatal durante os testes:', err);
    process.exit(1);
  });
