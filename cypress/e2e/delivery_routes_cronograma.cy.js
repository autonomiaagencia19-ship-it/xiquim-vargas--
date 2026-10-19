describe('Central de Rotas & Cronograma Semanal de Entregas (E2E)', () => {
  beforeEach(() => {
    cy.visit('/admin.html');
    cy.get('input[type="email"], input[name="email"]').first().clear().type('cypress@xiquim.local');
    cy.get('input[type="password"], input[name="password"]').first().clear().type('CypressPass123!');
    cy.get('form').first().submit();
    cy.hash().should('include', '#home');
  });

  it('valida todo o ciclo: rotas, pedidos devolvidos, cronograma navy e abas operacionais', () => {
    // 1. Navegar para a tela de Logística
    cy.get('.nav button').contains('Logística').click();
    cy.get('#title').should('contain', 'Logística');

    // 2. Testar acesso e visualização do card de Pedidos em Rota
    cy.contains('h3', 'Pedidos em rota').should('be.visible').click();
    cy.get('#logisticsDashboard').should('be.visible');
    cy.contains('Dashboard: Pedidos em Rota').should('be.visible');
    cy.contains('button', 'Voltar para Separação').click();
    cy.get('#logisticsMain').should('be.visible');

    // 3. Testar acesso e visualização do card de Pedidos Devolvidos / Retornaram
    cy.contains('h3', 'Pedidos que retornaram').should('be.visible').click();
    cy.get('#returnedOrdersDashboard').should('be.visible');
    cy.contains('Painel de Pedidos que Retornaram').should('be.visible');
    cy.contains('button', 'Voltar para separação').click();
    cy.get('#logisticsMain').should('be.visible');

    // 4. Acessar o Cronograma Semanal pelo botão Navy
    cy.contains('button', 'Ver / Configurar Cronograma Semanal')
      .should('be.visible')
      .click();

    // 5. Validar que a Central Única abriu na aba de Cronograma Semanal
    cy.get('#deliveryRoutesDashboard').should('be.visible');
    cy.contains('Central Única de Rotas de Entrega & Expedição').should('be.visible');
    cy.contains('button', '2. Cronograma Semanal & Motoristas').should('be.visible');

    // 6. Validar a renderização dos 6 dias com o visual navy do ERP
    const dias = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    dias.forEach(dia => {
      cy.contains(dia).should('be.visible');
    });

    // 7. Configurar motorista e bairros no card da Segunda-feira
    cy.get('#deliv_bairros_0').clear().type('Centro, Vila Isa, JK, São Pedro');
    cy.get('#deliv_driver_0').should('be.visible');

    // 8. Salvar o cronograma completo
    cy.contains('button', 'Salvar Cronograma Completo').first().click();

    // 9. Alternar para a aba 1: Criar Rota & Expedição
    cy.contains('button', '1. Criar Rota & Expedição').click();
    cy.contains('Pedidos em Separação').should('be.visible');
    cy.contains('Motoristas Disponíveis').should('be.visible');

    // 10. Alternar para a aba 3: Histórico de Rotas
    cy.contains('button', '3. Histórico de Rotas').click();
    cy.contains('Histórico de Rotas Criadas').should('be.visible');

    // 11. Voltar para a Logística
    cy.contains('button', 'Voltar para Logística').click();
    cy.get('#logisticsMain').should('be.visible');
  });
});
