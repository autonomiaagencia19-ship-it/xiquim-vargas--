import fs from 'fs';

let serverCode = fs.readFileSync('server.js', 'utf8');

const endpointCode = `
  if(method==='POST'&&p==='/api/logistics/loading-list/orders-pdf') {
    return parseBody(req, async b => {
      try {
        const ids = b.pedido_ids || [];
        if(!ids.length) return send(res,400,{error:'Sem pedidos'});
        const place = ids.map(()=>'?').join(',');
        
        const orders = db.prepare(\`
          SELECT p.*, c.nome as cliente_nome, c.nome_fantasia, c.cnpj_cpf
          FROM pedidos p
          JOIN clientes c ON p.cliente_id = c.id
          WHERE p.id IN (\${place})
        \`).all(...ids);
        
        const items = db.prepare(\`
          SELECT i.*, pr.nome as produto_nome
          FROM pedido_itens i
          JOIN produtos pr ON i.produto_id = pr.id
          WHERE i.pedido_id IN (\${place})
        \`).all(...ids);
        
        const ordersData = orders.map(order => ({
          order,
          items: items.filter(i => i.pedido_id === order.id)
        }));
        
        const pdf = require('node:path').join(STORAGE, 'pdfs', 'bulk_orders.pdf');
        
        // Dynamic import to use the new function
        const { makeBulkOrderPdf } = await import('./src/pdf.js');
        makeBulkOrderPdf(ordersData, pdf);
        
        return serveFile(res, pdf, 'application/pdf');
      } catch(e) {
        return send(res, 500, {error: e.message});
      }
    });
  }
`;

serverCode = serverCode.replace(
  /return send\(res,404,\{error:'Rota não encontrada'\}\);/,
  endpointCode + '\nreturn send(res,404,{error:"Rota não encontrada"});'
);

fs.writeFileSync('server.js', serverCode);
console.log('Fixed server.js endpoint');
