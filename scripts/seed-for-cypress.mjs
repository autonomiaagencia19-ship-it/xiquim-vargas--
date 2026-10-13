import { db } from '../src/db.js';
import { hashPassword } from '../src/auth.js';

const email = 'cypress@xiquim.local';
const admin = db.prepare('SELECT id FROM usuarios WHERE email=?').get(email);
if (!admin) {
  db.prepare('INSERT INTO usuarios (id, nome, email, senha_hash, role, ativo) VALUES (?, ?, ?, ?, ?, ?)').run(
    'cypress-admin-1', 'Cypress Admin', email, hashPassword('CypressPass123!'), 'admin', 1
  );
  console.log('Cypress user seeded.');
} else {
  // Update password to be sure
  db.prepare('UPDATE usuarios SET senha_hash=? WHERE id=?').run(hashPassword('CypressPass123!'), admin.id);
  console.log('Cypress user updated.');
}
