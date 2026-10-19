import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = path.resolve(process.cwd());
const STORAGE = path.resolve(process.env.STORAGE_DIR || path.join(ROOT, 'storage'));
const dbPath = path.join(STORAGE, 'xiquim-vargas.db');

console.log('--- RESET EM MASSA DO CATÁLOGO ---');
console.log(`Local do banco de dados: ${dbPath}`);

if (!fs.existsSync(dbPath)) {
  console.error(`ERRO: Banco de dados não encontrado em ${dbPath}`);
  process.exit(1);
}

// 1. Criar backup de segurança
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupPath = path.join(STORAGE, `backup-pre-catalog-reset-${timestamp}.db`);
fs.copyFileSync(dbPath, backupPath);
console.log(`✓ Backup criado com sucesso em: ${backupPath} (${(fs.statSync(backupPath).size / 1024).toFixed(1)} KB)`);

// 2. Conectar ao banco
const db = new DatabaseSync(dbPath);
db.exec('PRAGMA foreign_keys = OFF;'); // Desabilitar temporariamente FK para reorganização segura
db.exec('PRAGMA busy_timeout = 10000;');

try {
  db.exec('BEGIN TRANSACTION;');

  // A. Desvincular e remover todas as categorias e subcategorias
  console.log('1. Removendo categorias e subcategorias...');
  db.exec('UPDATE produtos SET categoria_id = NULL, subcategoria_id = NULL;');
  const delSubs = db.prepare('DELETE FROM subcategorias').run();
  const delCats = db.prepare('DELETE FROM categorias').run();
  console.log(`   ✓ Subcategorias removidas: ${delSubs.changes}`);
  console.log(`   ✓ Categorias removidas: ${delCats.changes}`);

  // B. Remover SKU, código de barras e descrição dos produtos, e setar preço base em 1.00
  console.log('2. Limpando SKUs, códigos de barras, descrições e redefinindo preços base para R$ 1,00...');
  const updProds = db.prepare(`
    UPDATE produtos 
    SET sku = NULL, 
        codigo_barras = NULL, 
        descricao = NULL, 
        preco_base = 1.00,
        categoria_id = NULL,
        subcategoria_id = NULL,
        updated_at = CURRENT_TIMESTAMP;
  `).run();
  console.log(`   ✓ Produtos atualizados: ${updProds.changes}`);

  // C. Tabelas de preços e promoções
  console.log('3. Ajustando tabelas de preços e desativando promoções para garantir preço R$ 1,00...');
  try {
    const updTab = db.prepare('UPDATE tabela_preco_itens SET preco = 1.00;').run();
    console.log(`   ✓ Itens de tabela de preço ajustados para R$ 1,00: ${updTab.changes}`);
  } catch(e) {
    console.log(`   (Tabela de preços: ${e.message})`);
  }

  try {
    const updPromo = db.prepare('UPDATE promocoes SET ativo = 0, preco_promocional = 1.00;').run();
    console.log(`   ✓ Promoções desativadas: ${updPromo.changes}`);
  } catch(e) {
    console.log(`   (Promoções: ${e.message})`);
  }

  // D. Estoque de cada produto em 100.000 un
  console.log('4. Definindo estoque de cada produto em 100.000 unidades...');
  const updEstoque = db.prepare(`
    UPDATE estoque 
    SET quantidade_disponivel = 100000, 
        quantidade_reservada = 0,
        updated_at = CURRENT_TIMESTAMP;
  `).run();
  console.log(`   ✓ Registros de estoque atualizados: ${updEstoque.changes}`);

  // Garantir que todos os produtos existentes possuam registro na tabela estoque
  const insEstoque = db.prepare(`
    INSERT OR IGNORE INTO estoque(produto_id, quantidade_disponivel, quantidade_reservada, estoque_minimo)
    SELECT id, 100000, 0, 0 FROM produtos;
  `).run();
  if (insEstoque.changes > 0) {
    console.log(`   ✓ Produtos sem estoque inseridos com 100.000 un: ${insEstoque.changes}`);
  }

  // E. Log de auditoria
  const logId = crypto.randomUUID();
  try {
    db.prepare(`
      INSERT INTO audit_logs(id, user_id, action, entity, entity_id, after_json)
      VALUES(?, 'admin', 'BULK_CATALOG_RESET', 'produtos', 'all', ?)
    `).run(logId, JSON.stringify({
      mensagem: 'Categorias e subcategorias removidas; SKU, barcode e descrição limpos; Preços em 1.00; Estoque em 100.000 un.',
      timestamp: new Date().toISOString()
    }));
    console.log('5. Auditoria registrada no sistema.');
  } catch(e) {
    console.log(`   (Auditoria: ${e.message})`);
  }

  db.exec('COMMIT;');
  console.log('✓ Transação confirmada com sucesso.');
} catch(err) {
  db.exec('ROLLBACK;');
  console.error('ERRO na execução:', err);
  process.exit(1);
} finally {
  db.exec('PRAGMA foreign_keys = ON;');
  db.close();
}

// 3. Verificação final
const checkDb = new DatabaseSync(dbPath);
const totalCats = checkDb.prepare('SELECT COUNT(*) as count FROM categorias').get().count;
const totalSubs = checkDb.prepare('SELECT COUNT(*) as count FROM subcategorias').get().count;
const totalProds = checkDb.prepare('SELECT COUNT(*) as count FROM produtos').get().count;
const prodsWithSku = checkDb.prepare("SELECT COUNT(*) as count FROM produtos WHERE sku IS NOT NULL AND TRIM(sku) != ''").get().count;
const prodsWithBarcode = checkDb.prepare("SELECT COUNT(*) as count FROM produtos WHERE codigo_barras IS NOT NULL AND TRIM(codigo_barras) != ''").get().count;
const prodsWithDesc = checkDb.prepare("SELECT COUNT(*) as count FROM produtos WHERE descricao IS NOT NULL AND TRIM(descricao) != ''").get().count;
const priceStats = checkDb.prepare('SELECT MIN(preco_base) as minP, MAX(preco_base) as maxP, AVG(preco_base) as avgP FROM produtos').get();
const stockStats = checkDb.prepare('SELECT MIN(quantidade_disponivel) as minEstoque, MAX(quantidade_disponivel) as maxEstoque, SUM(quantidade_disponivel) as totalEstoque FROM estoque').get();

checkDb.close();

console.log('\n--- RELATÓRIO DE CONFERÊNCIA ---');
console.log(`Categorias no banco: ${totalCats}`);
console.log(`Subcategorias no banco: ${totalSubs}`);
console.log(`Total de produtos: ${totalProds}`);
console.log(`Produtos com SKU: ${prodsWithSku}`);
console.log(`Produtos com Código de Barras: ${prodsWithBarcode}`);
console.log(`Produtos com Descrição: ${prodsWithDesc}`);
console.log(`Preço Base: Mínimo = R$ ${priceStats.minP}, Máximo = R$ ${priceStats.maxP}, Média = R$ ${priceStats.avgP}`);
console.log(`Estoque por produto: Mínimo = ${stockStats.minEstoque} un, Máximo = ${stockStats.maxEstoque} un`);
console.log(`Estoque geral somado: ${Number(stockStats.totalEstoque).toLocaleString('pt-BR')} un`);
console.log('--------------------------------');
