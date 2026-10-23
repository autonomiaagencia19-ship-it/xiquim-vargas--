import { DatabaseSync } from 'node:sqlite';
import { hashPassword } from '../src/auth.js';

const db = new DatabaseSync('storage/xiquim-vargas.db');
const sellers = db.prepare("SELECT id, nome, email, senha_hash FROM usuarios WHERE role='seller'").all();

console.log(`Found ${sellers.length} sellers.`);
const defaultHash = hashPassword('ChangeMe123!');

for (const s of sellers) {
  // Update to ensure ChangeMe123! is guaranteed to work
  db.prepare("UPDATE usuarios SET senha_hash=?, ativo=1, updated_at=CURRENT_TIMESTAMP WHERE id=?").run(defaultHash, s.id);
}

console.log('All sellers updated with standardized ChangeMe123! password hash.');
