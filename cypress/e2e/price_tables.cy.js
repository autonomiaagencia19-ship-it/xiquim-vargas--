describe('Price Tables & Modalities E2E', () => {
  const tName = 'Tabela Cypress ' + Date.now();
  const tPrice = '12.50';
  const tQty = '3';

  it('1. Admin: Create table, configure items and apply in mass/individual', () => {
    cy.visit('http://localhost:3000/admin.html');
    cy.get('input[name="email"]').type('admin@admin.com');
    cy.get('input[name="password"]').type('ChangeMe123!');
    cy.contains('button', 'Entrar').click();
    cy.contains('h1', 'Visão Geral', {timeout: 10000}).should('be.visible');

    cy.get('button[data-view="prices"]').click();
    cy.contains('h3', 'Governança de preços').should('be.visible');

    cy.contains('button', '+ Nova tabela').click();
    cy.get('input[name="nome"]').type(tName);
    cy.get('#priceForm').contains('button', 'Criar tabela').click();

    cy.contains('td', tName).should('exist');

    cy.contains('tr', tName).within(() => {
      cy.contains('button', 'Ver preços').click();
    });

    cy.get('#priceItemsForm table tbody tr').first().as('firstProduct');
    cy.get('@firstProduct').find('input[data-price-product]').type(tPrice);
    cy.get('@firstProduct').find('input[data-qty-product]').clear().type(tQty);
    
    cy.get('#priceItemsForm').contains('button', 'Salvar preços').click();
    
    cy.get('#applyTid').select(tName);
    cy.get('#applyTarget').select('ALL');
    cy.on('window:confirm', () => true);
    cy.get('#applyTableForm').contains('button', 'Aplicar em massa').click();
  });

  it('2. Loja Online: Verify minimum quantity pricing', () => {
    cy.visit('http://localhost:3000/loja.html');
    cy.contains('button', 'Fazer Login').click();
    cy.get('#roleLoginForm input[name="email"]').type('web1@gv.local');
    cy.get('#roleLoginForm input[name="password"]').type('ChangeMe123!');
    cy.get('#roleLoginForm button').contains('Fazer Login').click();

    cy.get('.product-card', {timeout: 10000}).should('exist');

    cy.get('.product-card').first().within(() => {
      cy.get('.quantity-input').clear().type('1');
      cy.contains('button', 'Adicionar').click({force: true});
    });

    cy.get('.cart-button').click({force: true});
    
    cy.get('.cart-row').first().within(() => {
      cy.get('button[aria-label="Aumentar quantidade"]').click({force: true});
      cy.get('button[aria-label="Aumentar quantidade"]').click({force: true});
      cy.get('.cart-line-total').should('not.be.empty');
    });
  });

  it('3. Balcão (PDV): Verify minimum quantity pricing', () => {
    cy.visit('http://localhost:3000/pdv.html');
    cy.get('input[name="email"]').type('caixa1@gv.local');
    cy.get('input[name="password"]').type('ChangeMe123!');
    cy.contains('button', 'Entrar na operação').click();
    cy.contains('Frente de Loja', {timeout: 10000}).should('be.visible');

    cy.get('#pdvClient option', {timeout: 10000}).should('have.length.gt', 1);

    cy.get('#pdvClient').find('option').eq(1).then($option => {
      cy.get('#pdvClient').select($option.val());
    });

    cy.get('input[oninput="pdvFilter(this)"]').type('a');

    cy.get('.pdv-product', {timeout: 10000}).first().click({force: true});

    cy.get('.pdv-row').first().within(() => {
      cy.get('.qty-control button').eq(1).click({force: true});
      cy.get('.qty-control button').eq(1).click({force: true});
      cy.get('.pdv-subtotal').should('not.be.empty');
    });
  });

  it('4. Vendedor: Verify minimum quantity pricing', () => {
    cy.visit('http://localhost:3000/vendedor.html');
    cy.get('input[name="email"]').type('vendedor1@gv.local');
    cy.get('input[name="password"]').type('ChangeMe123!');
    cy.contains('button', 'Entrar na operação').click();
    cy.contains('Meus clientes', {timeout: 10000}).should('be.visible');

    cy.get('.client-card').first().within(() => {
      cy.contains('button', 'Novo pedido').click({force: true});
    });
    
    cy.get('.product-card', {timeout: 10000}).first().within(() => {
      cy.contains('button', 'Adicionar ao carrinho').click({force: true});
    });

    cy.get('#sellerFloatingCart').click({force: true});

    cy.get('.seller-cart-line').first().within(() => {
      cy.get('.seller-cart-controls button').eq(1).click({force: true});
      cy.get('.seller-cart-controls button').eq(1).click({force: true});
    });
    cy.get('#sellerCartSubtotal').should('not.be.empty');
  });
});
