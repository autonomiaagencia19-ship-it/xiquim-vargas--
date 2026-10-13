import { all } from '../src/db.js';
const rows = all(`
  SELECT e.produto_id, pr.nome, e.quantidade_reservada, 
         COALESCE(SUM(CASE WHEN p.cancelled_at IS NULL AND p.status IN ('PENDENTE','SEPARACAO','ROTA') THEN pi.quantidade ELSE 0 END), 0) as esperado
  FROM estoque e
  JOIN produtos pr ON pr.id = e.produto_id
  LEFT JOIN pedido_itens pi ON pi.produto_id = e.produto_id
  LEFT JOIN pedidos p ON p.id = pi.pedido_id
  GROUP BY e.produto_id
  HAVING e.quantidade_reservada != esperado
`);
console.log(JSON.stringify(rows, null, 2));
