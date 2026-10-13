import { one, all } from '../src/db.js';

const counts = {
  usuarios: one('SELECT COUNT(*) n FROM usuarios')?.n,
  categorias: one('SELECT COUNT(*) n FROM categorias WHERE ativo=1')?.n,
  subcategorias: one('SELECT COUNT(*) n FROM subcategorias WHERE ativo=1')?.n,
  produtos: one('SELECT COUNT(*) n FROM produtos WHERE ativo=1')?.n,
  estoque_registros: one('SELECT COUNT(*) n FROM estoque')?.n,
  movimentacoes_estoque: one('SELECT COUNT(*) n FROM movimentacoes_estoque')?.n,
  tabelas_preco: one('SELECT COUNT(*) n FROM tabelas_preco')?.n,
  clientes: one('SELECT COUNT(*) n FROM clientes WHERE ativo=1')?.n,
  pedidos: one('SELECT COUNT(*) n FROM pedidos')?.n,
  pedidos_concluidos: one("SELECT COUNT(*) n FROM pedidos WHERE status='CONCLUIDO'")?.n,
  pedidos_cancelados: one('SELECT COUNT(*) n FROM pedidos WHERE cancelled_at IS NOT NULL')?.n,
  pedidos_itens: one('SELECT COUNT(*) n FROM pedido_itens')?.n,
  rotas_logistica: one('SELECT COUNT(*) n FROM rotas_logistica')?.n,
  comprovantes_entrega: one('SELECT COUNT(*) n FROM comprovantes_entrega')?.n,
  audit_logs: one('SELECT COUNT(*) n FROM audit_logs')?.n,
  mismatches_reconcile: all(`
    SELECT e.produto_id 
    FROM estoque e 
    LEFT JOIN pedido_itens pi ON pi.produto_id=e.produto_id 
    LEFT JOIN pedidos p ON p.id=pi.pedido_id 
    GROUP BY e.produto_id 
    HAVING e.quantidade_reservada != COALESCE(SUM(CASE WHEN p.cancelled_at IS NULL AND p.status IN ('PENDENTE','SEPARACAO','ROTA') THEN pi.quantidade ELSE 0 END), 0)
  `).length
};

console.log(JSON.stringify(counts, null, 2));
