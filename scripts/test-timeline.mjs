import { db } from '../src/db.js';

// Teste do endpoint /api/products/:id/costs-history
const prod = db.prepare(`
  SELECT pr.id, pr.nome 
  FROM produtos pr
  JOIN pedido_itens pi ON pi.produto_id = pr.id
  GROUP BY pr.id
  ORDER BY count(pi.id) DESC
  LIMIT 1
`).get();

const periods = db.prepare(`
  SELECT 
    h.id, h.custo, h.tipo_ajuste, h.motivo, h.data_inicio, h.data_fim,
    u.nome as usuario_nome
  FROM produto_custos_historico h
  LEFT JOIN usuarios u ON u.id = h.usuario_id
  WHERE h.produto_id = ?
  ORDER BY h.data_inicio DESC
`).all(prod.id);

for (const p of periods) {
  const sales = db.prepare(`
    SELECT 
      COALESCE(SUM(pi.quantidade), 0) as qtd_vendida,
      COALESCE(ROUND(SUM(pi.subtotal), 2), 0) as receita_periodo,
      COALESCE(ROUND(SUM(pi.quantidade * pi.custo_unitario_aplicado), 2), 0) as custo_periodo
    FROM pedido_itens pi
    JOIN pedidos ped ON ped.id = pi.pedido_id
    WHERE pi.produto_id = ?
      AND ped.status = 'CONCLUIDO'
      AND ped.created_at >= ?
      AND (? IS NULL OR ped.created_at < ?)
  `).get(prod.id, p.data_inicio, p.data_fim, p.data_fim);

  p.qtd_vendida = sales.qtd_vendida;
  p.receita = sales.receita_periodo;
  p.custo_total = sales.custo_periodo;
  p.lucro_bruto = Number((sales.receita_periodo - sales.custo_periodo).toFixed(2));
  p.margem_pct = sales.receita_periodo > 0 ? Number(((p.lucro_bruto / sales.receita_periodo) * 100).toFixed(1)) : 0;
}

console.log('Linha do tempo calculada para:', prod.nome);
console.table(periods.map(p => ({
  tipo: p.tipo_ajuste,
  custo: p.custo,
  inicio: p.data_inicio.substring(0, 10),
  fim: p.data_fim ? p.data_fim.substring(0, 10) : 'Ativo',
  vendidos: p.qtd_vendida,
  receita: p.receita,
  lucro: p.lucro_bruto,
  margem: p.margem_pct + '%'
})));
