import { db } from '../src/db.js';
import { hashPassword } from '../src/auth.js';

const usersToSeed = [
  { id: 'cypress-admin-1', nome: 'Cypress Admin', email: 'cypress@xiquim.local', pass: 'CypressPass123!', role: 'admin' },
  { id: 'cypress-admin-2', nome: 'Admin E2E', email: 'admin@admin.com', pass: 'ChangeMe123!', role: 'admin' },
  { id: 'cypress-seller-1', nome: 'Vendedor E2E', email: 'vendedor1@gv.local', pass: 'ChangeMe123!', role: 'seller' },
  { id: 'cypress-cashier-1', nome: 'Caixa E2E', email: 'caixa1@gv.local', pass: 'ChangeMe123!', role: 'cashier' },
  { id: 'cypress-web-1', nome: 'Cliente Web E2E', email: 'web1@gv.local', pass: 'ChangeMe123!', role: 'web_client' }
];

for (const u of usersToSeed) {
  const existing = db.prepare('SELECT id FROM usuarios WHERE email=?').get(u.email);
  if (!existing) {
    db.prepare('INSERT INTO usuarios (id, nome, email, senha_hash, role, ativo) VALUES (?, ?, ?, ?, ?, ?)').run(
      u.id, u.nome, u.email, hashPassword(u.pass), u.role, 1
    );
  } else {
    db.prepare('UPDATE usuarios SET senha_hash=?, role=?, ativo=1 WHERE id=?').run(hashPassword(u.pass), u.role, existing.id);
  }
}

// Garantir que vendedor1@gv.local tenha ao menos 1 cliente na carteira para price_tables.cy.js
const sellerRow = db.prepare('SELECT id FROM usuarios WHERE email=?').get('vendedor1@gv.local');
if (sellerRow) {
  const hasClient = db.prepare("SELECT id FROM clientes WHERE vendedor_id=? AND id != 'CLIENTE-BALCAO' LIMIT 1").get(sellerRow.id);
  if (!hasClient) {
    const anyClient = db.prepare("SELECT id FROM clientes WHERE id != 'CLIENTE-BALCAO' LIMIT 1").get();
    if (anyClient) {
      db.prepare('UPDATE clientes SET vendedor_id=? WHERE id=?').run(sellerRow.id, anyClient.id);
    }
  }
}
console.log('Cypress users seeded.');
