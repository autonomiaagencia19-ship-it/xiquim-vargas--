import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = path.resolve(process.cwd());
const STORAGE = path.resolve(process.env.STORAGE_DIR || path.join(ROOT, 'storage'));
const dbPath = path.join(STORAGE, 'xiquim-vargas.db');
const backupsDir = path.join(STORAGE, 'backups');

fs.mkdirSync(backupsDir, { recursive: true });

// 1. Backup
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupPath = path.join(backupsDir, `xiquim-vargas-backup-before-clear-users-${timestamp}.db`);
fs.copyFileSync(dbPath, backupPath);
console.log(`[backup] Banco de dados salvo com segurança em: ${backupPath}`);

// 2. Connect to DB
const db = new DatabaseSync(dbPath);
db.exec('PRAGMA busy_timeout=5000;');

// 3. Count current users
const usersBefore = db.prepare('SELECT id, nome, email, role, ativo FROM usuarios').all();
console.log(`[info] Usuários encontrados antes da exclusão (${usersBefore.length}):`);
for (const u of usersBefore) {
  console.log(`  - [${u.role}] ${u.nome} <${u.email}> (ativo: ${u.ativo})`);
}

// 4. Handle foreign key references safely
db.exec('PRAGMA foreign_keys=OFF;');

db.exec(`
  -- Desvincular usuários de pedidos, movimentações e clientes
  UPDATE clientes SET vendedor_id = NULL WHERE vendedor_id IS NOT NULL;
  UPDATE pedidos SET operador_id = NULL WHERE operador_id IS NOT NULL;
  UPDATE movimentacoes_estoque SET operador_id = NULL WHERE operador_id IS NOT NULL;
  UPDATE rotas_logistica SET motorista_id = NULL WHERE motorista_id IS NOT NULL;
  UPDATE pedido_retornos SET motorista_id = NULL WHERE motorista_id IS NOT NULL;
  UPDATE audit_logs SET user_id = NULL WHERE user_id IS NOT NULL;
  
  -- Limpar tabelas associativas e sessões
  DELETE FROM usuario_clientes;
  DELETE FROM comprovantes_entrega;
  DELETE FROM idempotency_keys;

  -- Excluir TODOS os usuários
  DELETE FROM usuarios;

  -- Resetar chave de setup
  DELETE FROM configuracoes WHERE chave = 'setup.completed';
`);

db.exec('PRAGMA foreign_keys=ON;');

const usersAfter = db.prepare('SELECT COUNT(*) n FROM usuarios').get();
console.log(`[sucesso] Usuários restantes no banco: ${usersAfter.n}`);

// 5. Generate fresh setup token for first access
const tokenFile = path.join(STORAGE, 'setup-token.txt');
try { fs.unlinkSync(tokenFile); } catch {}

const newToken = crypto.randomBytes(24).toString('base64url');
fs.writeFileSync(tokenFile, newToken, { mode: 0o600 });

console.log('\n======================================================');
console.log(' TODOS OS USUÁRIOS FORAM REMOVIDOS COM SUCESSO!');
console.log('======================================================');
console.log('O ERP retornou para o modo de PRIMEIRO ACESSO (Setup).');
console.log(`Código de primeiro acesso (setup token): ${newToken}`);
console.log(`Link para criar o Administrador Geral: http://localhost:3000/admin.html?setup=${newToken}`);
console.log('======================================================\n');
