import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const STORAGE = path.join(ROOT, 'storage');
const DB_PATH = path.join(STORAGE, 'xiquim-vargas.db');
const BACKUPS_DIR = path.join(STORAGE, 'backups');

if (!fs.existsSync(DB_PATH)) {
  console.error('Database file not found at:', DB_PATH);
  process.exit(1);
}

fs.mkdirSync(BACKUPS_DIR, { recursive: true });
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupPath = path.join(BACKUPS_DIR, `backup-before-cleanup-${timestamp}.db`);

console.log(`[1/4] Criando backup de seguranca em: ${backupPath}...`);
fs.copyFileSync(DB_PATH, backupPath);
const backupStat = fs.statSync(backupPath);
console.log(`[1/4] Backup criado com sucesso! Tamanho: ${(backupStat.size / (1024 * 1024)).toFixed(2)} MB`);

console.log('[2/4] Conectando ao banco de dados e iniciando limpeza controlada...');
const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA busy_timeout = 10000;');
db.exec('PRAGMA foreign_keys = OFF;');

try {
  // Limpeza de tabelas operacionais e historicos
  db.exec('BEGIN TRANSACTION;');

  console.log(' - Limpando rotas e comprovantes...');
  db.exec('DELETE FROM rota_pedidos;');
  db.exec('DELETE FROM rotas_logistica;');
  db.exec('DELETE FROM comprovantes_entrega;');
  db.exec('DELETE FROM pedido_retornos;');

  console.log(' - Limpando pedidos e itens de pedidos...');
  db.exec('DELETE FROM pedido_itens;');
  db.exec('DELETE FROM pedidos;');

  console.log(' - Limpando movimentacoes de estoque e logs de auditoria...');
  db.exec('DELETE FROM movimentacoes_estoque;');
  db.exec('DELETE FROM audit_logs;');
  db.exec('DELETE FROM promocoes;');

  console.log(' - Limpando clientes (preservando apenas CLIENTE-BALCAO)...');
  db.exec("DELETE FROM usuario_clientes WHERE cliente_id != 'CLIENTE-BALCAO';");
  db.exec("DELETE FROM clientes WHERE id != 'CLIENTE-BALCAO';");
  db.exec(`
    INSERT OR IGNORE INTO clientes(id, razao_social, nome_fantasia, cnpj_cpf, endereco, ativo)
    VALUES('CLIENTE-BALCAO', 'Cliente Balcão', 'Cliente Balcão', 'TEMP-CLIENTE-BALCAO', 'Atendimento no balcão', 1);
  `);
  db.exec("UPDATE clientes SET endereco='' WHERE id='CLIENTE-BALCAO' AND endereco='Atendimento no balcão';");

  console.log(' - Ajustando estoque para exatamente 100.000 un para cada produto cadastrado...');
  db.exec('DELETE FROM estoque;');
  db.exec(`
    INSERT INTO estoque (produto_id, quantidade_disponivel, quantidade_reservada, estoque_minimo, updated_at)
    SELECT id, 100000, 0, 0, CURRENT_TIMESTAMP
    FROM produtos;
  `);

  db.exec('COMMIT;');
  console.log('[3/4] Transacao confirmada com sucesso!');
} catch (err) {
  db.exec('ROLLBACK;');
  console.error('Erro durante a limpeza do banco. Transacao revertida:', err);
  process.exit(1);
} finally {
  db.exec('PRAGMA foreign_keys = ON;');
}

console.log('[4/4] Executando otimizacao e VACUUM...');
try {
  db.exec('VACUUM;');
  db.exec('PRAGMA optimize;');
} catch (e) {
  console.warn('Aviso no VACUUM:', e.message);
}

// Relatorio final
const totalProdutos = db.prepare('SELECT count(*) as c FROM produtos').get().c;
const totalEstoque = db.prepare('SELECT count(*) as c, sum(quantidade_disponivel) as total_un FROM estoque').get();
const totalPedidos = db.prepare('SELECT count(*) as c FROM pedidos').get().c;
const totalClientes = db.prepare('SELECT count(*) as c FROM clientes').get().c;
const totalUsuarios = db.prepare('SELECT count(*) as c FROM usuarios').get().c;

console.log('\n======================================================');
console.log('            RELATORIO DE LIMPEZA DO BANCO             ');
console.log('======================================================');
console.log(`Produtos no catálogo:       ${totalProdutos}`);
console.log(`Registros de estoque:       ${totalEstoque.c}`);
console.log(`Estoque total disponível:   ${Number(totalEstoque.total_un).toLocaleString('pt-BR')} unidades (100.000 un/produto)`);
console.log(`Pedidos restantes:          ${totalPedidos}`);
console.log(`Clientes restantes:         ${totalClientes} (CLIENTE-BALCAO)`);
console.log(`Usuários operacionais:      ${totalUsuarios} (mantidos para login)`);
console.log('======================================================\n');
