import { db, run, all } from '../src/db.js';

console.log('Reconciliando reservas de estoque no banco de dados...');

db.exec(`
  UPDATE estoque 
  SET quantidade_reservada = (
    SELECT COALESCE(SUM(pi.quantidade), 0)
    FROM pedido_itens pi
    JOIN pedidos p ON p.id = pi.pedido_id
    WHERE pi.produto_id = estoque.produto_id
      AND p.cancelled_at IS NULL
      AND p.status IN ('PENDENTE', 'SEPARACAO', 'ROTA')
  )
`);

const mismatches = all(`
  SELECT e.produto_id, e.quantidade_reservada, 
         COALESCE(SUM(CASE WHEN p.cancelled_at IS NULL AND p.status IN ('PENDENTE','SEPARACAO','ROTA') THEN pi.quantidade ELSE 0 END), 0) as esperado
  FROM estoque e
  LEFT JOIN pedido_itens pi ON pi.produto_id = e.produto_id
  LEFT JOIN pedidos p ON p.id = pi.pedido_id
  GROUP BY e.produto_id
  HAVING e.quantidade_reservada != esperado
`);

console.log(`Divergências restantes após reconciliação: ${mismatches.length}`);
