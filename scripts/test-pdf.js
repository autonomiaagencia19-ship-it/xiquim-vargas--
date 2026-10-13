const Database = require('better-sqlite3');
const path = require('path');

const db = new Database('./storage/data.db');
function all(sql, params=[]) {
  return db.prepare(sql).all(params);
}

async function test() {
  try {
    const row = db.prepare('SELECT id FROM pedidos LIMIT 1').get();
    if(!row) return console.log('No orders to test');
    const ids = [row.id];
    const place = ids.map(()=>'?').join(',');
    
    console.log('Querying orders...');
    const orders = all(`
      SELECT p.*, c.nome as cliente_nome, c.nome_fantasia, c.cnpj_cpf
      FROM pedidos p
      JOIN clientes c ON p.cliente_id = c.id
      WHERE p.id IN (${place})
    `, ids);
    
    console.log('Querying items...');
    const items = all(`
      SELECT i.*, pr.nome as produto_nome
      FROM pedido_itens i
      JOIN produtos pr ON i.produto_id = pr.id
      WHERE i.pedido_id IN (${place})
    `, ids);
    
    const ordersData = orders.map(order => ({
      order,
      items: items.filter(i => i.pedido_id === order.id)
    }));
    
    const pdfPath = path.join('./storage', 'pdfs', 'bulk_orders.pdf');
    
    console.log('Importing pdf.js...');
    const { makeBulkOrderPdf } = await import('./src/pdf.js');
    console.log('Generating PDF...');
    makeBulkOrderPdf(ordersData, pdfPath);
    console.log('Success! PDF created at', pdfPath);
  } catch(e) {
    console.error('TEST ERROR:', e.stack);
  }
}
test();
