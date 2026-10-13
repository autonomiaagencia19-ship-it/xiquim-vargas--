import fs from 'fs';

let serverCode = fs.readFileSync('server.js', 'utf8');

const badCodeRegex = /if\(method==='POST'&&p==='\/api\/logistics\/loading-list\/orders-pdf'\) \{[\s\S]*?return serveFile\(res, pdf, 'application\/pdf'\);\s*\} catch\(e\) \{\s*return send\(res, 500, \{error: e\.message\}\);\s*\}\s*\}/;

const goodCode = `
  if(method==='POST'&&p==='/api/logistics/loading-list/orders-pdf') {
    try {
      const b = await body(req);
      const ids = b.pedido_ids || [];
      if(!ids.length) return send(res,400,{error:'Sem pedidos'});
      const place = ids.map(()=>'?').join(',');
      
      const orders = all(\`
        SELECT p.*, c.nome as cliente_nome, c.nome_fantasia, c.cnpj_cpf
        FROM pedidos p
        JOIN clientes c ON p.cliente_id = c.id
        WHERE p.id IN (\${place})
      \`, ...ids);
      
      const items = all(\`
        SELECT i.*, pr.nome as produto_nome
        FROM pedido_itens i
        JOIN produtos pr ON i.produto_id = pr.id
        WHERE i.pedido_id IN (\${place})
      \`, ...ids);
      
      const ordersData = orders.map(order => ({
        order,
        items: items.filter(i => i.pedido_id === order.id)
      }));
      
      const pdfPath = path.join(STORAGE, 'pdfs', 'bulk_orders.pdf');
      
      const { makeBulkOrderPdf } = await import('./src/pdf.js');
      makeBulkOrderPdf(ordersData, pdfPath);
      
      return fs.createReadStream(pdfPath).on('open',()=>res.writeHead(200,{'content-type':'application/pdf','content-disposition':\`attachment; filename="Pedidos_Carregamento.pdf"\`})).pipe(res);
    } catch(e) {
      return send(res, 500, {error: e.message});
    }
  }
`;

if (badCodeRegex.test(serverCode)) {
  serverCode = serverCode.replace(badCodeRegex, goodCode.trim());
  fs.writeFileSync('server.js', serverCode);
  console.log('Fixed PDF serving logic in server.js');
} else {
  console.log('Could not find the block to replace. Here is what we have:');
  const lines = serverCode.split('\\n');
  const idx = lines.findIndex(l => l.includes('/api/logistics/loading-list/orders-pdf'));
  console.log(lines.slice(idx, idx + 35).join('\\n'));
}
