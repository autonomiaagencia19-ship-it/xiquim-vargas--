describe('Users Management', () => {
  beforeEach(() => {
    cy.visit('http://localhost:3000/admin.html');
    cy.get('input[name="email"]').type('admin@admin.com');
    cy.get('input[name="password"]').type('ChangeMe123!');
    cy.get('button[type="submit"]').click();
    cy.contains('h1', 'Visão Geral', {timeout: 10000}).should('be.visible');
    cy.get('button[data-view="users"]').click();
    cy.contains('h3', 'Usuários Internos').click();
  });

  it('can edit a user', () => {
    // Create a user first
    cy.contains('button', '+ Usuário').click();
    cy.get('#userForm input[name="nome"]').type('Test User 1');
    cy.get('#userForm input[name="email"]').type('testuser1@example.com');
    cy.get('#userForm button.primary').click();
    cy.contains('td', 'Test User 1').should('exist');

    // Edit the user
    cy.contains('tr', 'Test User 1').within(() => {
      cy.contains('button', 'Editar').click();
    });
    cy.get('#userEditForm input[name="nome"]').clear().type('Test User 1 Edited');
    cy.get('#userEditForm button.primary').click();

    // Verify it changed
    cy.contains('td', 'Test User 1 Edited').should('exist');
  });

  it('can delete a user', () => {
    // Create a user first
    cy.contains('button', '+ Usuário').click();
    cy.get('#userForm input[name="nome"]').type('To Be Deleted');
    cy.get('#userForm input[name="email"]').type('tobedeleted@example.com');
    cy.get('#userForm button.primary').click();
    cy.contains('td', 'To Be Deleted').should('exist');

    // Delete the user
    cy.contains('tr', 'To Be Deleted').within(() => {
      cy.contains('button', 'Excluir').click();
    });

    // Handle confirmation alert
    cy.on('window:confirm', () => true);

    // Verify deletion
    cy.contains('td', 'To Be Deleted').should('not.exist');
  });
});
