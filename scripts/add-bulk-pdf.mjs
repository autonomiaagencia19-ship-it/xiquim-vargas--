import fs from 'fs';

let pdfCode = fs.readFileSync('src/pdf.js', 'utf8');

if (!pdfCode.includes('makeBulkOrderPdf')) {
  pdfCode += `
export function makeBulkOrderPdf(ordersData, file) {
  const allPages = [];
  for (const {order, items} of ordersData) {
    const origin={WEB:'Loja Online',VENDEDOR:'Vendedor Externo',BALCAO:'Frente de Loja'}[order.origem]||order.origem;
    const lines=['XIQUIM VARGAS','DISTRIBUIÇÃO DE BEBIDAS','',\`PEDIDO \${order.numero}\`,\`Emissão: \${new Date(order.created_at).toLocaleString('pt-BR')}\`,\`Modalidade: \${origin}\`,\`Cliente: \${order.cliente_nome}\`,\`Nome fantasia: \${order.nome_fantasia||'-'}\`,\`Documento: \${order.cnpj_cpf||'-'}\`,'','ITENS','QTD  DESCRIÇÃO                         UNITÁRIO        SUBTOTAL','--------------------------------------------------------------------------------'];
    for(const x of items){
      const desc=String(x.produto_nome||'').slice(0,32).padEnd(32,' ');
      lines.push(\`\${String(x.quantidade).padStart(3)}  \${desc}\${\`R$ \${Number(x.preco_unitario_aplicado).toFixed(2)}\`.padStart(13)}\${\`R$ \${Number(x.subtotal).toFixed(2)}\`.padStart(14)}\`);
    }
    lines.push('','--------------------------------------------------------------------------------',\`SUBTOTAL: R$ \${Number(order.subtotal_bruto??order.total).toFixed(2)}\`,\`DESCONTO \${order.desconto_tipo==='PERCENTUAL'?\`(\${Number(order.desconto_valor||0).toFixed(2)}%)\`:'(R$)'}: R$ \${Number(order.desconto_tipo==='PERCENTUAL'?(Number(order.subtotal_bruto||0)*Number(order.desconto_valor||0)/100):(order.desconto_valor||0)).toFixed(2)}\`,\`TOTAL DO PEDIDO: R$ \${Number(order.total).toFixed(2)}\`,'',\`Forma de pagamento: \${order.forma_pagamento||'-'}\`,\`Pagamento: \${order.pagamento_status==='RECEBIDO'?'Recebido':'Não recebido'}\`,order.forma_pagamento==='DINHEIRO'?\`Valor recebido: R$ \${Number(order.valor_recebido||0).toFixed(2)}\`:'',order.forma_pagamento==='DINHEIRO'?\`Troco: R$ \${Number(order.troco||0).toFixed(2)}\`:'',order.forma_pagamento==='CREDITO'?\`Crédito: \${order.cartao_modalidade==='PARCELADO'?\`\${order.parcelas||1}x\`:'À vista'}\`:'',\`Observações: \${order.observacoes||'-'}\`,'',\`Status: \${order.status}\`,'Documento operacional do Xiquim Vargas ERP.');
    
    // Use the paginate function (defined internally in pdf.js) which we can't call directly if it's not exported,
    // but wait! The script adds this to the bottom of the file, so paginate IS in scope.
    const pages = paginate(lines);
    allPages.push(...pages);
  }
  buildPdf(allPages, file);
}
`;
  fs.writeFileSync('src/pdf.js', pdfCode);
  console.log('src/pdf.js updated with makeBulkOrderPdf');
}

let serverCode = fs.readFileSync('server.js', 'utf8');
if (!serverCode.includes('/api/logistics/loading-list/orders-pdf')) {
  // We need to inject the endpoint. Let's find a good spot, like right after '/api/logistics/loading-list/pdf'
  // Wait, I can just append it before `return send(res, 404, {error: 'Not found'});` at the end of routing.
  // Or simply regex replace:
  
  const endpointCode = `
  if(req.method==='POST'&&p==='/api/logistics/loading-list/orders-pdf') {
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
    /return send\(res,\s*404,\s*\{error:\s*'Not found'\}\);/,
    endpointCode + '\n  return send(res, 404, {error: "Not found"});'
  );
  fs.writeFileSync('server.js', serverCode);
  console.log('server.js updated with /api/logistics/loading-list/orders-pdf');
}

let appCode = fs.readFileSync('public/app.js', 'utf8');
if (!appCode.includes('Imprimir Pedidos')) {
  // Replace the modal content to add the button
  // Existing:
  // <button class="btn primary" onclick="downloadAuthPost('/api/logistics/loading-list/pdf',{pedido_ids:parseJsonArg('${jsonArg(ids)}')},'Lista_Carregamento.pdf')">Gerar PDF</button></div>
  appCode = appCode.replace(
    /<button class="btn primary" onclick="downloadAuthPost\('\/api\/logistics\/loading-list\/pdf'.*?<\/button><\/div>/,
    `$& <div style="margin-top:10px;text-align:right"><button class="btn" onclick="downloadAuthPost('/api/logistics/loading-list/orders-pdf',{pedido_ids:parseJsonArg('\${jsonArg(ids)}')},'Pedidos_Carregamento.pdf')">🖨️ Imprimir Pedidos em PDF</button></div>`
  );
  // Wait, the previous replacement was:
  // `<div class="panel" style="display:flex; justify-content:space-between; align-items:center"><strong>Produtos para carregamento</strong><button class="btn primary" onclick="...">Gerar PDF</button></div><div class="tablewrap">...</div>`
  // My replace logic above won't work well if I want the new button next to "Gerar PDF" or below the table.
  // Let's just put it below the tablewrap.
  appCode = appCode.replace(
    /<\/tbody><\/table><\/div>`\)/,
    `</tbody></table></div><div style="margin-top:14px; display:flex; justify-content:flex-end;"><button class="btn" onclick="downloadAuthPost('/api/logistics/loading-list/orders-pdf',{pedido_ids:parseJsonArg('\${jsonArg(ids)}')},'Pedidos_Carregamento.pdf')">🖨️ Imprimir todos os pedidos em PDF</button></div>\`)`
  );
  fs.writeFileSync('public/app.js', appCode);
  console.log('public/app.js updated with Imprimir Pedidos button');
}
