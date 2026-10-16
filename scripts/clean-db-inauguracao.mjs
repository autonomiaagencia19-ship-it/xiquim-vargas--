import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

const ROOT = path.resolve(process.cwd());
const STORAGE = path.resolve('storage');
const dbPath = path.join(STORAGE, 'xiquim-vargas.db');

console.log('=== Limpeza do Banco de Dados para Inauguração (Preservação do Catálogo) ===\n');

// 1. Backup de segurança antes da limpeza
const backupDir = path.join(STORAGE, 'backups');
fs.mkdirSync(backupDir, { recursive: true });
const preCleanBackup = path.join(backupDir, `pre-clean-inauguracao-${Date.now()}.db`);
fs.copyFileSync(dbPath, preCleanBackup);
console.log(`[Backup] Cópia pré-limpeza salva em: ${preCleanBackup}`);

const db = new DatabaseSync(dbPath);
db.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');

// Obter ID do admin central
let adminUser = db.prepare("SELECT id, email FROM usuarios WHERE email='admin@gv.local'").get();
if (!adminUser) {
  const defaultPassword = crypto.createHash('sha256').update('ChangeMe123!').digest('hex'); // or auth hash
  const newAdminId = crypto.randomUUID();
  db.prepare("INSERT OR IGNORE INTO usuarios(id, nome, email, senha_hash, role, ativo) VALUES(?, 'Administrador Central', 'admin@gv.local', ?, 'admin', 1)").run(newAdminId, defaultPassword);
  adminUser = db.prepare("SELECT id, email FROM usuarios WHERE email='admin@gv.local'").get();
}

console.log('[1/4] Iniciando exclusão atômica de dados operacionais e de teste...');

db.exec('BEGIN TRANSACTION;');

try {
  // Limpar tabelas de CRM e interações
  db.exec('DELETE FROM cliente_interacoes;');
  
  // Limpar compras de fornecedores e produtos vinculados
  db.exec('DELETE FROM compra_itens;');
  db.exec('DELETE FROM compras;');
  db.exec('DELETE FROM fornecedor_produtos;');
  db.exec('DELETE FROM fornecedores;');
  
  // Limpar entregas, rotas logísticas e devoluções
  db.exec('DELETE FROM comprovantes_entrega;');
  db.exec('DELETE FROM rota_pedidos;');
  db.exec('DELETE FROM rotas_logistica;');
  db.exec('DELETE FROM pedido_retornos;');
  
  // Limpar pedidos e itens de pedidos
  db.exec('DELETE FROM pedido_itens;');
  db.exec('DELETE FROM pedidos;');
  
  // Limpar promoções temporárias
  db.exec('DELETE FROM promocoes;');

  // Limpar usuários clientes web e clientes de demonstração
  db.exec('DELETE FROM usuario_clientes;');
  db.exec("DELETE FROM clientes WHERE id != 'CLIENTE-BALCAO';");
  
  // Limpar configurações de rotas de demonstração
  db.exec('DELETE FROM rota_bairros;');
  db.exec('DELETE FROM rotas_config;');
  db.exec('DELETE FROM vendedor_rotas;');
  
  // Limpar movimentações de estoque antigas, logs e idempotência
  db.exec('DELETE FROM movimentacoes_estoque;');
  db.exec('DELETE FROM audit_logs;');
  db.exec('DELETE FROM idempotency_keys;');
  db.exec('DELETE FROM system_events;');
  
  // Limpar usuários de demonstração (manter apenas o administrador central)
  db.exec("DELETE FROM usuarios WHERE email != 'admin@gv.local';");

  // Configurar cronograma padrão oficial de rotas de entrega (Gov. Valadares)
  const defaultDeliverySchedule = JSON.stringify([
    { dia: 'segunda', dia_nome: 'Segunda-feira', bairros: ['Vila Isa', 'Vila Mariana', 'São Raimundo', 'Belvedere'], motorista_id: null, motorista_nome: null },
    { dia: 'terca', dia_nome: 'Terça-feira', bairros: ['Altinópolis', 'Santo Antônio', 'Mãe de Deus', 'São Pedro', 'SIR', 'Floresta'], motorista_id: null, motorista_nome: null },
    { dia: 'quarta', dia_nome: 'Quarta-feira', bairros: ['Trevo', 'Santa Paula', 'São Paulo', 'Santa Terezinha', 'Penha', 'Vitória', 'Novo Horizonte', 'Canaã', 'JK 1', 'JK 2', 'JK 3', 'Jardim Alice'], motorista_id: null, motorista_nome: null },
    { dia: 'quinta', dia_nome: 'Quinta-feira', bairros: ['Santa Rita', 'Vila Rica', 'Pérola', 'Fraternidade', 'São Cristóvão', 'Nossa Senhora de Fátima', 'Sagrada Família', 'Parque Olímpico', 'Castanheira', 'Bela Vista', 'Kennedy', 'Nova Vila Bretas', 'Vila Império'], motorista_id: null, motorista_nome: null },
    { dia: 'sexta', dia_nome: 'Sexta-feira', bairros: ['Palmeiras', 'Vila Ozanan', 'Planalto', 'Turmalina'], motorista_id: null, motorista_nome: null },
    { dia: 'sabado', dia_nome: 'Sábado', bairros: ['Carapina', 'Santa Helena', 'Nossa Senhora das Graças', 'Grã-Duquesa'], motorista_id: null, motorista_nome: null }
  ]);
  db.prepare("INSERT INTO configuracoes(chave, valor) VALUES('delivery.routes_schedule', ?) ON CONFLICT(chave) DO UPDATE SET valor=excluded.valor, updated_at=CURRENT_TIMESTAMP").run(defaultDeliverySchedule);

  // Garantir cliente balcão padrão ativo
  db.exec(`
    INSERT INTO clientes(id, razao_social, nome_fantasia, cnpj_cpf, endereco, bairro, cidade, estado, ativo)
    VALUES('CLIENTE-BALCAO', 'Consumidor Final (Balcão)', 'Balcão / PDV', '00.000.000/0000-00', 'Venda Direta em Loja', 'Centro', 'Governador Valadares', 'MG', 1)
    ON CONFLICT(id) DO UPDATE SET
      razao_social = 'Consumidor Final (Balcão)',
      nome_fantasia = 'Balcão / PDV',
      endereco = 'Venda Direta em Loja',
      bairro = 'Centro',
      cidade = 'Governador Valadares',
      estado = 'MG',
      ativo = 1;
  `);

  console.log('[2/4] Atualizando estoque de todos os produtos do catálogo para 10.000 unidades...');

  // Configurar 10.000 unidades para cada produto ativo no catálogo
  const prods = db.prepare('SELECT id, nome FROM produtos WHERE ativo=1').all();
  const adminId = adminUser?.id || null;

  const updateEstoqueStmt = db.prepare(`
    INSERT INTO estoque(produto_id, quantidade_disponivel, quantidade_reservada, estoque_minimo, updated_at)
    VALUES(?, 10000, 0, 500, CURRENT_TIMESTAMP)
    ON CONFLICT(produto_id) DO UPDATE SET
      quantidade_disponivel = 10000,
      quantidade_reservada = 0,
      estoque_minimo = 500,
      updated_at = CURRENT_TIMESTAMP;
  `);

  const insertMovEstoqueStmt = db.prepare(`
    INSERT INTO movimentacoes_estoque(id, produto_id, tipo, quantidade, quantidade_anterior, quantidade_posterior, operador_id, observacao)
    VALUES(?, ?, 'INVENTARIO', 10000, 0, 10000, ?, 'Implantação de estoque para inauguração (10.000 un)')
  `);

  for (const p of prods) {
    updateEstoqueStmt.run(p.id);
    insertMovEstoqueStmt.run(crypto.randomUUID(), p.id, adminId);
  }

  // Registrar auditoria da carga de inauguração
  const auditPayload = JSON.stringify({
    acao: 'Banco limpo para inauguração',
    produtos_mantidos: prods.length,
    estoque_por_produto: 10000,
    data: new Date().toISOString()
  });
  const prevHash = db.prepare('SELECT integrity_hash FROM audit_logs ORDER BY created_at DESC, rowid DESC LIMIT 1').get()?.integrity_hash || '';
  const hashPayload = `${prevHash}|${adminId || ''}|CLEANUP_INAUGURACAO|sistema|xiquim-vargas-erp||${auditPayload}`;
  const auditIntegrityHash = crypto.createHash('sha256').update(hashPayload).digest('hex');

  db.prepare(`
    INSERT INTO audit_logs(id, user_id, action, entity, entity_id, after_json, integrity_hash)
    VALUES(?, ?, 'CLEANUP_INAUGURACAO', 'sistema', 'xiquim-vargas-erp', ?, ?)
  `).run(crypto.randomUUID(), adminId, auditPayload, auditIntegrityHash);

  db.exec('COMMIT;');
  console.log(`[3/4] Transação confirmada com sucesso! ${prods.length} produtos atualizados com 10.000 unidades.`);

} catch (err) {
  db.exec('ROLLBACK;');
  console.error('[Erro] Falha durante a limpeza do banco, rollback executado:', err);
  throw err;
}

// 4. Compactação física do banco de dados (VACUUM e Checkpoint)
console.log('[4/4] Executando VACUUM e truncando WAL...');
db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
db.exec('VACUUM;');
db.exec('PRAGMA wal_checkpoint(TRUNCATE);');

const check = db.prepare('PRAGMA integrity_check').get();
console.log(`[Integridade] Verificação de integridade pós-limpeza: ${check.integrity_check}`);

console.log('\n=== Limpeza Concluída com Sucesso! ===');
