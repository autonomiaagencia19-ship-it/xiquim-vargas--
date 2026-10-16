import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const dbPath = path.resolve('storage/xiquim-vargas.db');
const db = new DatabaseSync(dbPath);

const totalProds = db.prepare('SELECT count(*) as c FROM produtos WHERE ativo=1').get().c;
const totalImgs = db.prepare('SELECT count(*) as c FROM produto_imagens').get().c;
const totalStock = db.prepare('SELECT count(*) as c FROM estoque').get().c;
const totalPriceItems = db.prepare('SELECT count(*) as c FROM tabela_preco_itens').get().c;

console.log('=== ESTATÍSTICAS DO BANCO DE DADOS ===');
console.log('Total produtos ativos:', totalProds);
console.log('Total imagens cadastradas:', totalImgs);
console.log('Total produtos com estoque:', totalStock);
console.log('Total regras de tabela de preço:', totalPriceItems);

// Check newly added products
const sampleNew = db.prepare(`
  SELECT p.id, p.nome, p.sku, p.codigo_barras, p.preco_base, p.foto_url, p.descricao,
         c.nome as cat_nome, s.nome as sub_nome, e.quantidade_disponivel
  FROM produtos p
  LEFT JOIN categorias c ON c.id=p.categoria_id
  LEFT JOIN subcategorias s ON s.id=p.subcategoria_id
  LEFT JOIN estoque e ON e.produto_id=p.id
  WHERE p.sku >= 'XQ-0192'
  ORDER BY p.sku
  LIMIT 8
`).all();

console.log('\n=== AMOSTRA DE NOVOS PRODUTOS ===');
sampleNew.forEach(p => {
  console.log(`[${p.sku}] ${p.nome}`);
  console.log(`  Categoria: ${p.cat_nome} > ${p.sub_nome}`);
  console.log(`  Preço Base: R$ ${p.preco_base.toFixed(2)} | Estoque: ${p.quantidade_disponivel} un`);
  console.log(`  Foto: ${p.foto_url}`);
  console.log(`  Descrição: ${p.descricao}\n`);
});

// Verify multi-image products
const multiImgs = db.prepare('SELECT produto_id, count(*) as count FROM produto_imagens GROUP BY produto_id HAVING count > 1').all();
console.log(`=== PRODUTOS COM MÚLTIPLAS IMAGENS (${multiImgs.length}) ===`);
for (const m of multiImgs) {
  const prod = db.prepare('SELECT nome FROM produtos WHERE id=?').get(m.produto_id);
  const imgs = db.prepare('SELECT id, arquivo_path, principal, ordem FROM produto_imagens WHERE produto_id=? ORDER BY principal DESC, ordem').all(m.produto_id);
  console.log(`- ${prod.nome} (${imgs.length} fotos):`);
  imgs.forEach(i => console.log(`    principal=${i.principal}, ordem=${i.ordem}, path=${i.arquivo_path}`));
}

// Verify all files on disk
const allImgs = db.prepare('SELECT id, produto_id, arquivo_path FROM produto_imagens').all();
let missing = 0;
let validSize = 0;
for (const img of allImgs) {
  const fullPath = path.join('storage', img.arquivo_path);
  if (!fs.existsSync(fullPath)) {
    missing++;
  } else {
    const s = fs.statSync(fullPath);
    if (s.size > 0) validSize++;
  }
}
console.log(`\nImagens válidas e confirmadas no disco: ${validSize} de ${allImgs.length}`);
console.log(`Imagens inexistentes no disco: ${missing}`);

console.log('\n=== TESTES DE BUSCA NO CATÁLOGO ===');
const searchTerms = ['trento', 'red bull', 'halls', 'rexona', 'amassaxup', 'toddy', 'kitana', 'limão'];
for (const term of searchTerms) {
  const results = db.prepare(`
    SELECT p.id, p.nome, p.sku, p.preco_base, p.foto_url, c.nome as categoria
    FROM produtos p
    LEFT JOIN categorias c ON c.id=p.categoria_id
    WHERE p.ativo=1 AND p.nome LIKE ?
    LIMIT 2
  `).all(`%${term}%`);
  console.log(`Busca '${term}': ${results.length} resultados encontrados:`);
  results.forEach(r => console.log(`  - [${r.sku}] ${r.nome} (R$ ${r.preco_base.toFixed(2)}) -> ${r.foto_url}`));
}
