describe('Auditoria Funcional Exaustiva de Todos os 5 Roles (E2E)', () => {
  const ts = Date.now();
  const testData = {
    catName: `Cat Audit ${ts}`,
    subName: `Sub Audit ${ts}`,
    prodName: `Produto Audit ${ts}`,
    prodSku: `SKU-AUD-${ts}`,
    prodBarcode: `789${String(ts).slice(-10)}`,
    supplierName: `Fornecedor Audit ${ts}`,
    priceTableName: `Tabela Audit ${ts}`,
    adminClientName: `Cliente Admin Audit ${ts}`,
    sellerEmail: `vendedor.audit.${ts}@xiquim.local`,
    sellerPass: 'AuditPass123!',
    sellerName: `Vendedor Audit ${ts}`,
    sellerClientName: `Cliente Vendedor ${ts}`,
    cashierEmail: `caixa.audit.${ts}@xiquim.local`,
    cashierPass: 'AuditPass123!',
    cashierName: `Caixa Audit ${ts}`,
    driverEmail: `motorista.audit.${ts}@xiquim.local`,
    driverPass: 'AuditPass123!',
    driverName: `Motorista Audit ${ts}`,
    webClientEmail: `cliente.web.${ts}@xiquim.local`,
    webClientPass: 'AuditPass123!',
    webClientName: `Cliente Web B2B ${ts}`
  };

  let createdIds = {
    productId: null,
    categoryId: null,
    subcategoryId: null,
    supplierId: null,
    priceTableId: null,
    adminClientId: null,
    sellerUserId: null,
    cashierUserId: null,
    driverUserId: null,
    orderForDriver1: null,
    orderForDriver2: null
  };

  beforeEach(() => {
    // Monitorar qualquer erro HTTP 500 ou exceção não tratada em qualquer página/rota
    cy.on('window:before:load', (win) => {
      const origFetch = win.fetch.bind(win);
      win.fetch = async (...args) => {
        const res = await origFetch(...args);
        const url = typeof args[0] === 'string' ? args[0] : (args[0]?.url || '');
        if (res.status >= 500) {
          const clone = res.clone();
          const bodyText = await clone.text().catch(() => '');
          throw new Error(`HTTP ${res.status} detectado em ${url}: ${bodyText}`);
        }
        return res;
      };
    });
  });

  it('1. Role: Admin / Torre de Controle (admin.html) — Navegação em todas as abas, CRUD completo e PDFs', () => {
    cy.on('window:confirm', () => true);

    cy.visit('/admin.html');
    cy.get('input[name="email"]').clear().type('cypress@xiquim.local');
    cy.get('input[name="password"]').clear().type('CypressPass123!');
    cy.contains('button', 'Entrar na Torre').click();

    cy.hash().should('include', '#home');
    cy.get('#title', { timeout: 15000 }).should('contain', 'Visão Geral');

    // 1.1 Validar navegação e cliques em TODAS as abas do menu lateral
    const tabs = [
      { view: 'home', title: 'Visão Geral' },
      { view: 'products', title: 'Catálogo' },
      { view: 'stock', title: 'Estoque Inteligente' },
      { view: 'prices', title: 'Tabelas de preço' },
      { view: 'clients', title: 'Clientes & CRM' },
      { view: 'orders', title: 'Pedidos' },
      { view: 'logistics', title: 'Logística' },
      { view: 'suppliers', title: 'Fornecedores' },
      { view: 'inbound', title: 'Compra e Recebimento de Mercadorias' },
      { view: 'sellers', title: 'Vendedores' },
      { view: 'reports', title: 'Relatórios' },
      { view: 'audit', title: 'Auditoria' },
      { view: 'users', title: 'Usuários' },
      { view: 'store', title: 'Loja Online' },
      { view: 'ai', title: 'IA Administrativa' }
    ];

    tabs.forEach((t) => {
      cy.get(`button[data-view="${t.view}"]`).scrollIntoView().click();
      cy.get('#title', { timeout: 15000 }).should('contain', t.title);
      cy.get('#view').should('not.contain', 'Carregando...');
    });

    // 1.2 Criar Usuários Operacionais para os testes dos demais Roles (Vendedor, Caixa, Motorista)
    cy.get('button[data-view="users"]').click();
    cy.get('#title', { timeout: 15000 }).should('contain', 'Usuários');
    cy.get('#view').should('not.contain', 'Carregando...');
    cy.contains('#view .card', 'Usuários Internos', { timeout: 15000 }).should('be.visible').click();

    const createInternalUser = (nome, email, pass, role) => {
      cy.contains('#view button', '+ Usuário', { timeout: 10000 }).should('be.visible').click({ force: true });
      cy.get('#userForm input[name="nome"]').clear().type(nome);
      cy.get('#userForm input[name="email"]').clear().type(email);
      cy.get('#userForm input[name="password"]').clear().type(pass);
      cy.get('#userForm select[name="role"]').select(role);
      cy.get('#userForm button.primary').click({ force: true });
      cy.get('#modal').should('not.exist');
      cy.contains('#view td', email, { timeout: 15000 }).should('be.visible');
    };

    createInternalUser(testData.sellerName, testData.sellerEmail, testData.sellerPass, 'seller');
    createInternalUser(testData.cashierName, testData.cashierEmail, testData.cashierPass, 'cashier');
    createInternalUser(testData.driverName, testData.driverEmail, testData.driverPass, 'driver');

    // Capturar IDs dos usuários criados
    cy.window().then(async (win) => {
      const uRes = await win.api('/api/users');
      createdIds.sellerUserId = uRes.items.find(u => u.email === testData.sellerEmail)?.id;
      createdIds.cashierUserId = uRes.items.find(u => u.email === testData.cashierEmail)?.id;
      createdIds.driverUserId = uRes.items.find(u => u.email === testData.driverEmail)?.id;
      expect(createdIds.sellerUserId).to.be.a('string');
      expect(createdIds.cashierUserId).to.be.a('string');
      expect(createdIds.driverUserId).to.be.a('string');
    });

    // 1.3 CRUD de Categorias, Subcategorias e Produtos + PDF do Catálogo
    cy.get('button[data-view="products"]').click();
    cy.get('#title').should('contain', 'Catálogo');
    cy.get('#view').should('not.contain', 'Carregando...');

    // Criar Categoria
    cy.contains('#view button', '+ Categoria', { timeout: 15000 }).first().click({ force: true });
    cy.get('#categoryForm input[name="nome"]').type(testData.catName);
    cy.get('#categoryForm textarea[name="descricao"]').type('Categoria criada pela auditoria Cypress');
    cy.get('#categoryForm button.primary').click();
    cy.contains('h3', testData.catName, { timeout: 10000 }).should('exist');

    // Criar Subcategoria
    cy.contains('button', '+ Subcategoria').first().click();
    cy.get('#subForm select[name="categoria_id"]').select(testData.catName);
    cy.get('#subForm input[name="nome"]').type(testData.subName);
    cy.get('#subForm button.primary').click();
    cy.get('#modal').should('not.exist');

    // Criar Produto
    cy.contains('button', '+ Produto').click();
    cy.get('#productForm input[name="nome"]').type(testData.prodName);
    cy.get('#productForm input[name="sku"]').type(testData.prodSku);
    cy.get('#productForm input[name="codigo_barras"]').type(testData.prodBarcode);
    cy.get('#productForm input[name="marca"]').type('Marca Audit');
    cy.get('#productForm select[name="categoria_id"]').select(testData.catName);
    cy.get('#productForm select[name="subcategoria_id"]').select(testData.subName);
    cy.get('#productForm input[name="preco_base"]').clear().type('20.00');
    cy.get('#productForm input[name="preco_custo"]').clear().type('10.00');
    cy.get('#productForm button.primary').click();
    cy.get('#modal').should('not.exist');

    cy.get('#pq').clear().type(testData.prodSku);
    cy.contains('#catalogTable td', testData.prodName).should('be.visible');

    // Editar Produto
    cy.contains('#catalogTable tr', testData.prodName).within(() => {
      cy.contains('button', 'Editar').click();
    });
    cy.get('#productForm input[name="preco_base"]').clear().type('22.00');
    cy.get('#productForm button.primary').click();
    cy.get('#modal').should('not.exist');

    // Testar botão Custos & Lucro do Produto
    cy.get('#pq').clear().type(testData.prodSku);
    cy.contains('#catalogTable tr', testData.prodName).within(() => {
      cy.contains('button', 'Custos & Lucro').click();
    });
    cy.get('#modal').should('be.visible').and('contain', 'Linha do Tempo de Custos & Lucro');
    cy.get('#modal').contains('button', 'Fechar').click();
    cy.get('#modal').should('not.exist');

    // Testar botão Esgotado / Disponível
    cy.contains('#catalogTable tr', testData.prodName).within(() => {
      cy.contains('button', 'Esgotado').click();
      cy.contains('button', 'Disponível').should('be.visible').click();
      cy.contains('button', 'Esgotado').should('be.visible');
    });

    // Testar geração do PDF do Catálogo
    cy.contains('button', 'PDF do catálogo').click();
    cy.get('#xvPdfModal', { timeout: 15000 }).should('be.visible');
    cy.get('#xvPdfModal').contains('button', 'Fechar').click();
    cy.get('#xvPdfModal').should('not.exist');

    // Guardar ID do produto criado
    cy.window().then((win) => {
      const p = (win.adminProducts?.items || []).find(x => x.sku === testData.prodSku);
      expect(p).to.exist;
      createdIds.productId = p.id;
      const cat = (win.adminCategories?.categorias || []).find(x => x.nome === testData.catName);
      if (cat) createdIds.categoryId = cat.id;
      const sub = (win.adminCategories?.subcategorias || []).find(x => x.nome === testData.subName);
      if (sub) createdIds.subcategoryId = sub.id;
    });

    // 1.4 Módulo Estoque Inteligente: Movimentar saldo + Histórico + PDF do Estoque
    cy.get('button[data-view="stock"]').click();
    cy.get('#title').should('contain', 'Estoque Inteligente');
    cy.get('#stockSearch').clear().type(testData.prodSku);
    cy.contains('#stockTable tr', testData.prodName).within(() => {
      cy.contains('button', 'Movimentar').click();
    });
    cy.get('#stockForm select[name="tipo"]').select('ENTRADA');
    cy.get('#stockDeltaInput').clear().type('200');
    cy.get('#stockForm input[name="estoque_minimo"]').clear().type('10');
    cy.get('#stockForm input[name="observacao"]').type('Carga inicial E2E');
    cy.get('#stockForm button.primary').click();
    cy.get('#modal').should('not.exist');

    cy.get('#stockSearch').clear().type(testData.prodSku);
    cy.contains('#stockTable tr', testData.prodName).should('contain', '200');

    // Abrir Histórico de Estoque
    cy.contains('#stockTable tr', testData.prodName).within(() => {
      cy.contains('button', 'Histórico').click();
    });
    cy.get('#modal').should('be.visible').and('contain', 'Carga inicial E2E');
    cy.get('#modal .top button').click();

    // Testar PDF do Estoque
    cy.contains('button', 'PDF do estoque').click();
    cy.get('#xvPdfModal', { timeout: 15000 }).should('be.visible');
    cy.get('#xvPdfModal').contains('button', 'Fechar').click();
    cy.get('#xvPdfModal').should('not.exist');

    // 1.5 Módulo Fornecedores & Associação Produto-Fornecedor
    cy.get('button[data-view="suppliers"]').click();
    cy.get('#title').should('contain', 'Fornecedores');
    cy.contains('button', '+ Novo Fornecedor').click();
    cy.get('#supplierForm input[name="nome"]').type(testData.supplierName);
    cy.get('#supplierForm input[name="telefone_whatsapp"]').type('33999990000');
    cy.get('#supplierForm input[name="lead_time_padrao_dias"]').clear().type('4');
    cy.get('#supplierForm button.primary').click();
    cy.get('#modal').should('not.exist');

    cy.contains('#supplierTableWrap tr', testData.supplierName).within(() => {
      cy.contains('button', 'Associar').click();
    });
    cy.get('#linkProdSearch').type(testData.prodSku);
    cy.get('#linkProdCusto').clear().type('11.50');
    cy.get('#linkProdSubmitBtn').click();
    cy.get('#modal').should('contain', testData.prodName);
    cy.get('#modal').contains('button', 'Fechar').click();

    // 1.6 Módulo Clientes & CRM (Criar, Editar, Perfil, Interação CRM)
    cy.get('button[data-view="clients"]').click();
    cy.get('#title').should('contain', 'Clientes & CRM');
    cy.contains('button', '+ Novo Cliente').click();
    cy.get('#clientNewForm input[name="nome_fantasia"]').type(testData.adminClientName);
    cy.get('#clientNewForm input[name="razao_social"]').type(testData.adminClientName + ' LTDA');
    cy.get('#clientNewForm input[name="cnpj_cpf"]').type(String(ts).slice(-14).padStart(14, '1'));
    cy.get('#clientNewForm input[name="telefone"]').type('33988887777');
    cy.get('#clientNewForm input[name="endereco"]').type('Rua Israel Pinheiro, 1000');
    cy.get('#clientNewForm select[name="bairro"]').select('Centro');
    cy.then(() => {
      if (createdIds.sellerUserId) {
        cy.get('#clientNewForm select[name="vendedor_id"]').select(createdIds.sellerUserId);
      }
    });
    cy.get('#clientNewForm button.primary').click();
    cy.get('#modal').should('not.exist');

    // Alternar para aba Cadastro & Carteira Geral e Editar Cliente
    cy.contains('button.crm-tab-btn', 'Cadastro & Carteira Geral').click();
    cy.get('#clientsSearch').clear().type(testData.adminClientName);
    cy.contains('#clientsContent tr', testData.adminClientName).within(() => {
      cy.contains('button', 'Editar').click();
    });
    cy.get('#clientEditForm input[name="endereco"]').clear().type('Rua Israel Pinheiro, 1200');
    cy.get('#clientEditForm button.primary').click();
    cy.get('#modal').should('not.exist');

    // Registrar Interação CRM no cliente
    cy.get('#clientsSearch').clear().type(testData.adminClientName);
    cy.contains('#clientsContent tr', testData.adminClientName).within(() => {
      cy.contains('button', 'CRM').click();
    });
    cy.get('#crmInteractionForm select[name="tipo"]').select('VISITA');
    cy.get('#crmInteractionForm textarea[name="descricao"]').type('Visita de auditoria E2E realizada');
    cy.get('#crmInteractionForm button[type="submit"]').click();
    cy.get('#modal').should('not.exist');

    // Abrir Perfil Completo do Cliente
    cy.contains('#clientsContent tr', testData.adminClientName).within(() => {
      cy.get('button').first().click();
    });
    cy.get('#modal').should('contain', 'Perfil completo do cliente');
    cy.get('#modal .top button').click();

    cy.window().then((win) => {
      const c = (win._clientsData || []).find(x => (x.nome_fantasia || '').includes(testData.adminClientName) || (x.razao_social || '').includes(testData.adminClientName));
      expect(c).to.exist;
      createdIds.adminClientId = c.id;
    });

    // 1.7 Módulo Tabelas de Preço (Criar, Configurar Preço e Qtd Mínima, Aplicar em Massa e Individual, Detalhes)
    cy.get('button[data-view="prices"]').click();
    cy.get('#title').should('contain', 'Tabelas de preço');
    cy.contains('button', '+ Nova tabela').click();
    cy.get('#priceForm input[name="nome"]').type(testData.priceTableName);
    cy.get('#priceForm button.primary').click();
    cy.get('#modal').should('not.exist');

    cy.contains('tr', testData.priceTableName).within(() => {
      cy.contains('button', 'Ver preços').click();
    });
    cy.get('#priceItemsForm input.search').type(testData.prodSku);
    cy.then(() => {
      cy.get(`#priceItemsForm input[data-price-product="${createdIds.productId}"]`).clear().type('15.00');
      cy.get(`#priceItemsForm input[data-qty-product="${createdIds.productId}"]`).clear().type('5');
    });
    cy.get('#priceItemsForm').contains('button', 'Salvar tabela').first().click();
    cy.get('#modal').should('not.exist');

    // Aplicar tabela em massa a Todos os clientes
    cy.get('#applyTid').select(testData.priceTableName);
    cy.get('#applyTarget').select('ALL');
    cy.get('#applyTableForm button[type="submit"]').click();

    // Abrir modal Detalhes da Tabela de Preço
    cy.contains('tr', testData.priceTableName).within(() => {
      cy.contains('button', 'Detalhes').click();
    });
    cy.get('#ptdBody', { timeout: 10000 }).should('be.visible').and('contain', testData.priceTableName);
    cy.get('#modal .top button').click();

    // 1.8 Configurações da Loja Online e IA Administrativa
    cy.get('button[data-view="store"]').click();
    cy.get('#storeConfigForm button.primary').click();

    cy.get('button[data-view="ai"]').click();
    cy.contains('h3', 'Assistente Administrativo').should('be.visible');
    cy.contains('button', 'Estoque crítico').click();
    cy.get('#aimsg').should('have.value', 'Quais produtos estão com estoque crítico ou zerado?');
  });

  it('2. Role: Vendedor / Vendedor Externo (vendedor.html) — Carteira, Novo Cliente, Estoque em Tempo Real e Pedido com Qtd Mínima', () => {
    cy.on('window:confirm', () => true);
    cy.on('window:alert', () => true);

    cy.visit('/vendedor.html');
    cy.get('#roleLoginForm input[name="email"]').clear().type(testData.sellerEmail);
    cy.get('#roleLoginForm input[name="password"]').clear().type(testData.sellerPass);
    cy.get('#roleLoginForm button[type="submit"]').click();

    cy.contains('Meus Clientes & CRM', { timeout: 15000 }).should('be.visible');
    cy.contains('.client-card', testData.adminClientName).should('be.visible');

    // 2.1 Validar alternância para Saúde da Carteira (CRM)
    cy.contains('button.crm-tab-btn', 'Saúde da Carteira (CRM)').click();
    cy.contains('Carteira de Clientes').should('be.visible');
    cy.contains('button.crm-tab-btn', 'Cadastro & Carteira Geral').click();

    // 2.2 Validar Cadastro de Novo Cliente pelo Vendedor
    cy.contains('button', 'Adicionar cliente').click();
    cy.get('#sellerClientForm input[name="nome_fantasia"]').type(testData.sellerClientName);
    cy.get('#sellerClientForm input[name="razao_social"]').type(testData.sellerClientName + ' ME');
    cy.get('#sellerClientForm input[name="cnpj_cpf"]').type(String(ts).slice(-14).padStart(14, '2'));
    cy.get('#sellerClientForm input[name="telefone"]').type('33988112233');
    cy.get('#sellerClientForm input[name="endereco"]').type('Av. Minas Gerais, 500');
    cy.get('#sellerClientForm select[name="bairro"]').select('Centro');
    cy.get('#sellerClientForm button.primary').click();

    cy.contains('Meus Clientes & CRM', { timeout: 15000 }).should('be.visible');
    cy.contains('.client-card', testData.sellerClientName).should('be.visible');

    // 2.3 Validar Consulta de Estoque em Tempo Real (botão Estoque)
    cy.contains('button', 'Estoque').click();
    cy.contains('Estoque disponível', { timeout: 10000 }).should('be.visible');
    cy.get('#sellerStockSearch').clear().type(testData.prodSku);
    cy.contains('.seller-stock-row', testData.prodName).should('be.visible').and('contain', '200');
    cy.contains('button', 'Clientes').click();

    // 2.4 Validar Catálogo demonstrativo e Minhas Rotas
    cy.contains('button', 'Catálogo').click();
    cy.contains('Catálogo por Categoria').should('be.visible');
    cy.contains('button', 'Voltar').click();

    cy.contains('button', 'Minhas Rotas').click();
    cy.contains('Planejamento da semana').should('be.visible');
    cy.contains('button', 'Voltar').click();

    // 2.5 Montagem e Envio de Pedido (verificando Qtd Mínima e Tabela de Preços)
    cy.contains('.client-card', testData.adminClientName).within(() => {
      cy.contains('button', 'Novo pedido').click();
    });

    cy.contains('Novo pedido', { timeout: 10000 }).should('be.visible');
    cy.get('input[placeholder="Pesquisar produto..."]').type(testData.prodSku);

    cy.contains('.product-card', testData.prodName).should('be.visible').within(() => {
      // Preço inicial para 1 un deve ser o preço base (R$ 22,00), pois qtd mínima da tabela é 5 un
      cy.get('.product-price').should('contain', '22,00');
      // Clicar na faixa de quantidade mínima da tabela (5 un -> R$ 15,00)
      cy.contains('.promo-label', 'Selecionar 5 un.').click();
      cy.get('.product-price').should('contain', '15,00');
      cy.contains('button', 'Adicionar ao carrinho').click();
    });

    // Verificar carrinho e finalizar pedido
    cy.get('#sellerCartSubtotal').should('contain', '75,00'); // 5 * R$ 15,00
    cy.contains('button.seller-finalize', 'Finalizar pedido e gerar PDF').click();

    // Deve redirecionar para Meus pedidos com o pedido criado
    cy.contains('Meus pedidos', { timeout: 15000 }).should('be.visible');
    cy.contains('.mobile-card', testData.adminClientName).should('be.visible');
  });

  it('3. Role: Caixa / PDV (pdv.html) — Busca por Código de Barras e Nome, Carrinho, Pagamento e Emissão Direta (Retirada e Entrega)', () => {
    cy.on('window:confirm', () => true);

    cy.visit('/pdv.html');
    cy.get('#roleLoginForm input[name="email"]').clear().type(testData.cashierEmail);
    cy.get('#roleLoginForm input[name="password"]').clear().type(testData.cashierPass);
    cy.get('#roleLoginForm button[type="submit"]').click();

    cy.contains('PDV – Frente de Loja', { timeout: 15000 }).should('be.visible');

    // 3.1 Validar Leitura de Produto por Código de Barras
    cy.get('#pdvBarcodeButton').click();
    cy.get('#pdvBarcodeInput').should('have.attr', 'data-active', '1');
    cy.get('#pdvBarcodeInput').type(`${testData.prodBarcode}{enter}`);
    cy.contains('.pdv-row', testData.prodName, { timeout: 10000 }).should('be.visible');

    // 3.2 Validar Busca por Nome e Aplicação de Quantidade Mínima da Tabela no Carrinho
    cy.get('#pdvSearch').clear().type(testData.prodName);
    cy.contains('.pdv-product', testData.prodName).should('be.visible');
    // Usar botão no carrinho para aplicar a quantidade mínima da tabela (5 un)
    cy.contains('.pdv-row', testData.prodName).within(() => {
      cy.contains('button', 'Aplicar 5 un.').click();
    });
    cy.get('#pdvTotal').should('contain', '75,00');

    // 3.3 Configurar Forma de Pagamento (Dinheiro + Troco + Recebido) e Emitir Pedido de RETIRADA
    cy.get('#pdvFulfillment').select('RETIRADA');
    cy.get('#pdvPayment').select('DINHEIRO');
    cy.get('#pdvReceivedValue').type('100');
    cy.get('#pdvChange').should('contain', '25,00');
    cy.get('#pdvReceived').click().should('contain', 'Pagamento: Recebido');

    cy.contains('button.pdv-final', 'Finalizar e Imprimir Cupom').click();
    cy.contains('Venda Realizada com Sucesso!', { timeout: 15000 }).should('be.visible');
    cy.contains('Concluído (Retirada)').should('be.visible');

    // Fechar modal de PDF aberto automaticamente pela emissão do cupom
    cy.get('#xvPdfModal', { timeout: 15000 }).should('be.visible').contains('button', 'Fechar').click();
    cy.get('#xvPdfModal').should('not.exist');

    // 3.4 Emitir 2 Pedidos na modalidade ENTREGA para alimentar o teste de Logística/Motorista
    const emitPdvDeliveryOrder = () => {
      cy.get('#pdvClientSearch').clear().type(testData.adminClientName);
      cy.contains('#pdvClientDropdown .pdv-client-option', testData.adminClientName, { timeout: 10000 }).click({ force: true });
      cy.get('#pdvSearch').clear().type(testData.prodSku);
      cy.contains('.pdv-product', testData.prodName).within(() => {
        cy.contains('button', 'Adicionar').click();
      });
      cy.get('#pdvFulfillment').select('ENTREGA');
      cy.get('#pdvPayment').select('PIX');
      cy.contains('button.pdv-final', 'Finalizar e Imprimir Cupom').click();
      cy.contains('Em Separação (Entrega)', { timeout: 15000 }).should('be.visible');
      cy.get('#xvPdfModal', { timeout: 15000 }).should('be.visible').contains('button', 'Fechar').click();
      cy.get('#xvPdfModal').should('not.exist');
    };

    emitPdvDeliveryOrder();
    emitPdvDeliveryOrder();
  });

  it('4. Role: Admin Logística -> Role: Motorista / Entregas (motorista.html) — Romaneio PDF, Rota, Comprovante, Entrega Concluída e Ocorrência/Retorno', () => {
    cy.on('window:confirm', () => true);
    cy.on('window:alert', () => true);

    // 4.1 Logar no Admin para gerar Lista de Carregamento (Romaneio PDF) e Despachar Rota para o Motorista
    cy.visit('/admin.html');
    cy.get('input[name="email"]').clear().type('cypress@xiquim.local');
    cy.get('input[name="password"]').clear().type('CypressPass123!');
    cy.contains('button', 'Entrar na Torre').click();

    cy.get('button[data-view="logistics"]', { timeout: 15000 }).click();
    cy.contains('h3', 'Todos os pedidos').click();
    cy.get('#deliveryRoutesDashboard', { timeout: 15000 }).should('be.visible');

    // Selecionar os pedidos de entrega do nosso cliente
    cy.get('#delivQuickSearch').clear().type(testData.adminClientName);
    cy.get('.routeOrder:visible').should('have.length.at.least', 2).check({ force: true });

    // Testar geração da Lista de Carregamento e Romaneio PDF
    cy.get('#btnDelivMakeList').click();
    cy.get('#modal').should('be.visible').and('contain', 'Lista de carregamento');
    cy.get('#modal').contains('button', 'Gerar PDF').click();
    cy.get('#xvPdfModal', { timeout: 15000 }).should('be.visible');
    cy.get('#xvPdfModal').contains('button', 'Fechar').click();

    // Testar botão Imprimir Pedidos em PDF dentro do Romaneio
    cy.get('#modal').contains('button', 'Imprimir Pedidos em PDF').click();
    cy.get('#xvPdfModal', { timeout: 15000 }).should('be.visible');
    cy.get('#xvPdfModal').contains('button', 'Fechar').click();

    // Prosseguir com Motorista e criar a rota
    cy.get('#modal').contains('button', 'Prosseguir com Motorista').click();
    cy.get('#generateRouteForm select[name="motorista_id"]').select(createdIds.driverUserId);
    cy.get('#generateRouteForm button.primary').click();
    cy.get('#modal').should('not.exist');

    // 4.2 Acessar interface do Motorista (motorista.html)
    cy.visit('/motorista.html', {
      onBeforeLoad(win) {
        win.localStorage.removeItem('xv_token');
        win.localStorage.removeItem('xv_user');
      }
    });
    cy.get('#roleLoginForm input[name="email"]').clear().type(testData.driverEmail);
    cy.get('#roleLoginForm input[name="password"]').clear().type(testData.driverPass);
    cy.get('#roleLoginForm button[type="submit"]').click();

    cy.contains('Fila do dia', { timeout: 15000 }).should('be.visible');
    cy.get('.route-card', { timeout: 15000 }).should('have.length.at.least', 2);

    // 4.3 Testar envio de comprovante (Canhoto) na primeira parada via API / uploadProof
    cy.window().then(async (win) => {
      const firstStopBtn = win.document.querySelector('.route-card button.good');
      const onclickAttr = firstStopBtn.getAttribute('onclick');
      const stopOrderId = onclickAttr.match(/'([^']+)'/)[1];
      const tinyPngDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      const proofRes = await win.api(`/api/logistics/orders/${stopOrderId}/proof`, {
        method: 'POST',
        body: JSON.stringify({ data_url: tinyPngDataUrl })
      });
      expect(proofRes.ok).to.be.true;
    });

    // 4.4 Alterar status da 1ª parada para Entregue (✓ Concluído)
    cy.get('.route-card').first().within(() => {
      cy.contains('button', 'Concluído').click();
    });
    cy.contains('Entrega concluída com sucesso!').should('exist');
    cy.get('.route-card', { timeout: 10000 }).should('have.length', 1);

    // 4.5 Alterar status da 2ª parada para Retornado / Ocorrência (✕ Não concluída)
    cy.get('.route-card').first().within(() => {
      cy.contains('button', 'Não concluída').click();
    });
    cy.get('#modal').should('be.visible').and('contain', 'Marcar Parada como Não Concluída');
    cy.get('#failReasonSelect').select('Cliente não se encontra no local');
    cy.get('#failReasonDesc').type('Estabelecimento fechado no horário da visita (Teste E2E)');
    cy.get('#btnConfirmFailStop').click();
    cy.get('#modal').should('not.exist');

    // 4.6 Validar tela de Rotas Concluídas do Motorista
    cy.contains('button', 'Rotas concluídas').click();
    cy.contains('Rotas concluídas', { timeout: 10000 }).should('be.visible');
    cy.contains('button', 'Fila do dia').click();
  });

  it('5. Role: Cliente Web / Loja B2B (loja.html) — Autocadastro, Vitrine, Filtros, Carrinho c/ Qtd Mínima, Checkout Online e Status do Pedido', () => {
    cy.on('window:confirm', () => true);
    cy.on('window:alert', () => true);

    cy.visit('/loja.html');

    // 5.1 Autocadastro de novo Cliente Web B2B
    cy.contains('button', 'Cadastre-se').click();
    cy.get('#storeRegisterForm input[name="nome"]').type(testData.webClientName);
    cy.get('#storeRegisterForm input[name="email"]').type(testData.webClientEmail);
    cy.get('#storeRegisterForm input[name="telefone"]').type('33999112233');
    cy.get('#storeRegisterForm input[name="endereco"]').type('Rua Sete de Setembro, 900');
    cy.get('#storeRegisterForm select[name="bairro"]').select('Centro');
    cy.get('#storeRegisterForm input[name="password"]').type(testData.webClientPass);
    cy.get('#storeRegisterForm button.primary').click();

    // 5.2 Validar vitrine, filtros de busca/preço e navegação por categorias
    cy.get('#storeProducts .product-card', { timeout: 15000 }).should('have.length.at.least', 1);

    cy.get('#storeSearch').clear().type(testData.prodName);
    cy.contains('#storeProducts .product-card', testData.prodName).should('be.visible');
    cy.contains('button', 'Limpar filtros').click();

    // Navegar em Categoria e Subcategoria
    cy.contains('.mobile-card h3', testData.catName).click();
    cy.contains('h2', testData.catName).should('be.visible');
    cy.contains('.mobile-card h3', testData.subName).click();
    cy.contains('h2', testData.subName).should('be.visible');
    cy.get('#storeSubMin').type('1');
    cy.get('#storeSubMax').type('999');
    cy.contains('button', 'Limpar filtros').click();
    cy.get('#storeSubMax').should('have.value', '');
    cy.contains('button', 'Categorias').click();

    // 5.3 Adicionar item ao carrinho e validar abertura do drawer
    cy.get('#storeSearch').clear().type(testData.prodName);
    cy.contains('#storeProducts .product-card', testData.prodName).within(() => {
      cy.get('.quantity-input').clear().type('5');
      cy.contains('button', 'Adicionar').click();
    });
    cy.get('#cartCount').should('have.text', '5');

    // 5.4 Abrir Carrinho e Fechar Pedido Online
    cy.get('.cart-button').click();
    cy.get('.cart-drawer').should('be.visible').and('contain', testData.prodName);
    cy.get('#lojaPayment').select('PIX');
    cy.get('.cart-drawer').contains('button', 'Finalizar pedido').click();

    // Confirmar modal de Previsão de Entrega
    cy.get('#confirmDeliveryForecastModal', { timeout: 10000 }).should('be.visible');
    cy.get('#btnFinalConfirmOrder').click();
    cy.get('#confirmDeliveryForecastModal').should('not.exist');

    // 5.5 Consultar Status dos próprios pedidos, Detalhes, PDF, Sobre Nós e Perfil
    cy.contains('button.store-nav', 'Pedidos').click();
    cy.contains('h2', 'Pedidos', { timeout: 10000 }).should('be.visible');
    cy.get('#storeMain .mobile-card').first().should('contain', 'PENDENTE').within(() => {
      cy.contains('button', 'Ver pedido').click();
    });
    cy.get('#storeOrderModal').should('be.visible').and('contain', testData.prodName);
    cy.get('#storeOrderModal').contains('button', 'Fechar').click();

    // Testar PDF do pedido na Loja Online
    cy.get('#storeMain .mobile-card').first().within(() => {
      cy.contains('button', 'PDF').click();
    });
    cy.get('#xvPdfModal', { timeout: 15000 }).should('be.visible');
    cy.get('#xvPdfModal').contains('button', 'Fechar').click();

    // Testar aba Sobre Nós
    cy.contains('button.store-nav', 'Sobre Nós').click();
    cy.contains('Sobre a Distribuidora Xiquim Vargas').should('be.visible');

    // Testar aba Perfil e atualização cadastral
    cy.contains('button.store-nav', 'Perfil').click();
    cy.get('#storeProfileForm input[name="endereco"]', { timeout: 10000 }).should('have.value', 'Rua Sete de Setembro, 900');
    cy.get('#storeProfileForm button.primary').click();
    cy.contains('Perfil atualizado com sucesso').should('exist');
  });
});

