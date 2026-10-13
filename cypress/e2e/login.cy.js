describe('Login Flow', () => {
  it('loads the login page and logs in', () => {
    cy.visit('/admin.html');
    
    // Type credentials
    cy.get('input[type="email"], input[name="email"]').first().type('cypress@xiquim.local');
    cy.get('input[type="password"], input[name="password"]').first().type('CypressPass123!');
    
    // Submit
    cy.get('form').first().submit();
    
    // Should navigate or change UI
    cy.hash().should('include', '#home');
  });
});
