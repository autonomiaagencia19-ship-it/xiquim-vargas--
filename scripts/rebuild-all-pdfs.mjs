import path from 'node:path';
import fs from 'node:fs';
import { all, run, STORAGE } from '../src/db.js';
import { makeOrderPdf } from '../src/pdf.js';

const orders = all(`
  SELECT p.*, c.razao_social as cliente_nome, c.nome_fantasia, c.cnpj_cpf
  FROM pedidos p
  JOIN clientes c ON p.cliente_id = c.id
`);

console.log(`Rebuilding ${orders.length} order PDFs...`);

let count = 0;
for (const order of orders) {
  const items = all(`
    SELECT pi.*, pr.nome as produto_nome
    FROM pedido_itens pi
    JOIN produtos pr ON pi.produto_id = pr.id
    WHERE pi.pedido_id = ?
  `, [order.id]);

  const pdfPath = path.join(STORAGE, 'pdfs', `${order.numero}.pdf`);
  try {
    makeOrderPdf(order, items, pdfPath);
    run("UPDATE pedidos SET pdf_path=?, pdf_status='READY', pdf_error=NULL WHERE id=?", [pdfPath, order.id]);
    count++;
  } catch (err) {
    console.error(`Error regenerating ${order.numero}:`, err.message);
  }
}

console.log(`Successfully rebuilt ${count} order PDFs.`);
