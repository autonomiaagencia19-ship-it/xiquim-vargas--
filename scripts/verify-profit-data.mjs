import { db } from '../src/db.js';

const topLucro = db.prepare(`
  SELECT 
    pr.nome,
    COUNT(pi.id) as total_vendas,
    SUM(pi.quantidade) as qtd_total,
    ROUND(SUM(pi.subtotal), 2) as receita,
    ROUND(SUM(pi.quantidade * pi.custo_unitario_aplicado), 2) as custo,
    ROUND(SUM(pi.subtotal) - SUM(pi.quantidade * pi.custo_unitario_aplicado), 2) as lucro_bruto,
    ROUND(((SUM(pi.subtotal) - SUM(pi.quantidade * pi.custo_unitario_aplicado)) / SUM(pi.subtotal)) * 100, 1) as margem_pct
  FROM pedido_itens pi
  JOIN produtos pr ON pr.id = pi.produto_id
  JOIN pedidos p ON p.id = pi.pedido_id
  WHERE p.status = 'CONCLUIDO'
  GROUP BY pr.id
  ORDER BY lucro_bruto DESC
  LIMIT 5
`).all();

console.log('--- TOP 5 PRODUTOS MAIS LUCRATIVOS ---');
console.table(topLucro);

const firstProd = db.prepare(`SELECT id, nome, preco_base, preco_custo FROM produtos LIMIT 1`).get();
console.log(`\n--- HISTÓRICO DE VALIDADE DO PRODUTO: ${firstProd.nome} (Venda: R$ ${firstProd.preco_base} | Custo Atual: R$ ${firstProd.preco_custo}) ---`);

const histExemplo = db.prepare(`
  SELECT pch.tipo_ajuste, pch.custo, pch.motivo, pch.data_inicio, pch.data_fim
  FROM produto_custos_historico pch
  WHERE pch.produto_id = ?
  ORDER BY pch.data_inicio ASC
`).all(firstProd.id);

console.table(histExemplo);
