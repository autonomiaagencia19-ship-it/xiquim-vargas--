import fs from 'node:fs';
import { one } from './db.js';
import { formatBrasiliaDateTime } from './timezone.js';
const CP1252={'€':'\x80','‚':'\x82','ƒ':'\x83','„':'\x84','…':'\x85','†':'\x86','‡':'\x87','ˆ':'\x88','‰':'\x89','Š':'\x8A','‹':'\x8B','Œ':'\x8C','Ž':'\x8E','‘':'\x91','’':'\x92','“':'\x93','”':'\x94','•':'\x95','–':'\x96','—':'\x97','˜':'\x98','™':'\x99','š':'\x9A','›':'\x9B','œ':'\x9C','ž':'\x9E','Ÿ':'\x9F'};
function win1252(s){return String(s??'').normalize('NFC').replace(/[€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ]/g,c=>CP1252[c]).replace(/[\u0100-\uFFFF]/g,'?')}
function esc(s){return win1252(s).replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)')}
function wrap(s,n=116){const str=String(s??'');if(str.length<=n)return [str];const words=str.split(/\s+/);const out=[];let line='';for(let w of words){while(w.length>n){if(line){out.push(line);line=''}out.push(w.slice(0,n));w=w.slice(n)}if((line?(line+' '+w):w).length>n){if(line)out.push(line);line=w}else line=line?(line+' '+w):w}if(line)out.push(line);return out.length?out:['']}
function buildPdf(pages,file,options={}){
  const fontSize=options.fontSize||9.5;
  const lineHeight=options.lineHeight||(fontSize>=9.5?14:11);
  const leftMargin=options.leftMargin||(fontSize>=9.5?28:14);
  const topMargin=options.topMargin||(fontSize>=9.5?810:824);
  const objs=[];
  const add=x=>{objs.push(x);return objs.length};
  const font=add('<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>');
  const pageRefs=[],contentRefs=[];
  for(const pg of pages){
    const content=['BT',`/F1 ${fontSize} Tf`,`${leftMargin} ${topMargin} Td`];
    pg.forEach((l,i)=>{
      if(i)content.push(`0 -${lineHeight} Td`);
      content.push(`(${esc(l)}) Tj`);
    });
    content.push('ET');
    const stream=content.join('\n');
    contentRefs.push(add(`<< /Length ${Buffer.byteLength(stream,'latin1')} >>\nstream\n${stream}\nendstream`));
    pageRefs.push(add('PLACEHOLDER'));
  }
  const pagesObj=objs.length+1,catalogObj=pagesObj+1;
  for(let i=0;i<pageRefs.length;i++)objs[pageRefs[i]-1]=`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${contentRefs[i]} 0 R >>`;
  objs.push(`<< /Type /Pages /Kids [${pageRefs.map(x=>x+' 0 R').join(' ')}] /Count ${pageRefs.length} >>`);
  objs.push(`<< /Type /Catalog /Pages ${pagesObj} 0 R >>`);
  let out='%PDF-1.4\n',offs=[0];
  for(let i=0;i<objs.length;i++){
    offs.push(Buffer.byteLength(out,'latin1'));
    out+=`${i+1} 0 obj\n${objs[i]}\nendobj\n`;
  }
  const xref=Buffer.byteLength(out,'latin1');
  out+=`xref\n0 ${objs.length+1}\n0000000000 65535 f \n`;
  for(let i=1;i<=objs.length;i++)out+=String(offs[i]).padStart(10,'0')+' 00000 n \n';
  out+=`trailer\n<< /Size ${objs.length+1} /Root ${catalogObj} 0 R >>\nstartxref\n${xref}\n%%EOF`;
  fs.writeFileSync(file,Buffer.from(out,'latin1'));
}
function paginate(lines,maxLines=54,wrapCols=94){
  const pages=[];
  let page=[];
  for(const l of lines.flatMap(x=>wrap(x,wrapCols))){
    if(page.length>=maxLines){
      pages.push(page);
      page=[];
    }
    page.push(l);
  }
  if(page.length)pages.push(page);
  return pages;
}
function formatUnitTag(u){
  const s=String(u||'').trim();
  if(!s)return 'UN';
  const up=s.toUpperCase();
  if(up==='UND'||up==='UNIDADE'||up==='UNIDADES')return 'UN';
  if(up==='PCT'||up==='PACOTE')return 'PCT';
  if(up==='CX'||up==='CAIXA')return 'CX';
  if(up==='FD'||up==='FARDO')return 'FD';
  if(up==='LT'||up==='LATA')return 'LT';
  if(up==='POTE')return 'POTE';
  return up;
}
function buildThermalPdf(lines,file){const objs=[];const add=x=>{objs.push(x);return objs.length};const font=add('<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>');const lineHeight=13;const pageHeight=Math.max(260,(lines.length*lineHeight)+50);const pageWidth=226;const content=['BT','/F1 8.5 Tf',`10 ${pageHeight-20} Td`];lines.forEach((l,i)=>{if(i)content.push(`0 -${lineHeight} Td`);content.push(`(${esc(l)}) Tj`)});content.push('ET');const stream=content.join('\n');const contentRef=add(`<< /Length ${Buffer.byteLength(stream,'latin1')} >>\nstream\n${stream}\nendstream`);const pageRef=add('PLACEHOLDER');const pagesObj=objs.length+1,catalogObj=pagesObj+1;objs[pageRef-1]=`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${contentRef} 0 R >>`;objs.push(`<< /Type /Pages /Kids [${pageRef} 0 R] /Count 1 >>`);objs.push(`<< /Type /Catalog /Pages ${pagesObj} 0 R >>`);let out='%PDF-1.4\n',offs=[0];for(let i=0;i<objs.length;i++){offs.push(Buffer.byteLength(out,'latin1'));out+=`${i+1} 0 obj\n${objs[i]}\nendobj\n`}const xref=Buffer.byteLength(out,'latin1');out+=`xref\n0 ${objs.length+1}\n0000000000 65535 f \n`;for(let i=1;i<=objs.length;i++)out+=String(offs[i]).padStart(10,'0')+' 00000 n \n';out+=`trailer\n<< /Size ${objs.length+1} /Root ${catalogObj} 0 R >>\nstartxref\n${xref}\n%%EOF`;fs.writeFileSync(file,Buffer.from(out,'latin1'))}
function formatOrderAddress(order){
  let endereco = order?.endereco;
  let bairro = order?.bairro;
  let cidade = order?.cidade;
  let estado = order?.estado;
  let cep = order?.cep;
  if(!endereco && order?.cliente_id){
    try{
      const c=one('SELECT endereco, bairro, cidade, estado, cep FROM clientes WHERE id=?',[order.cliente_id]);
      if(c){
        endereco=c.endereco;
        bairro=c.bairro;
        cidade=c.cidade;
        estado=c.estado;
        cep=c.cep;
      }
    }catch{}
  }
  const parts=[];
  if(endereco) parts.push(endereco);
  if(bairro) parts.push(`Bairro: ${bairro}`);
  if(cidade) parts.push(`${cidade}${estado?`/${estado}`:''}`);
  if(cep) parts.push(`CEP: ${cep}`);
  return parts.length ? parts.join(' - ') : 'Endereço não informado';
}

function makeThermalOrderPdf(order,items,file){
  const addr = formatOrderAddress(order);
  const lines=[
    '========================================',
    'XIQUIM VARGAS - DISTRIBUIDORA DE BEBIDAS',
    '========================================',
    '            CUPOM DE VENDA              ',
    '----------------------------------------',
    `EMISSAO: ${formatBrasiliaDateTime(order.created_at)}`,
    '----------------------------------------',
    ...wrap(`CLIENTE: ${order.cliente_nome||'Cliente Balcao'}`,40),
    ...wrap(`ENDERECO: ${addr}`,40),
    '----------------------------------------',
    'ITENS:',
    'QTD/UN DESCRICAO          UNIT     TOTAL',
    '----------------------------------------'
  ].filter(Boolean);
  let totalQtd=0;
  for(const x of items){
    totalQtd+=Number(x.quantidade||0);
    let unit = x.unidade;
    if(!unit && x.produto_id){
      try{
        const prod=one('SELECT unidade FROM produtos WHERE id=?',[x.produto_id]);
        if(prod?.unidade) unit=prod.unidade;
      }catch{}
    }
    const unitTag = formatUnitTag(unit);
    const qStr = `${String(x.quantidade).padStart(2)} ${unitTag.slice(0,3).padEnd(3)}`;
    const descLines = wrap(String(x.produto_nome||'').trim(), 17);
    const firstDesc = (descLines[0]||'').padEnd(17);
    const unitStr = Number(x.preco_unitario_aplicado).toFixed(2).padStart(7);
    const subStr = Number(x.subtotal).toFixed(2).padStart(8);
    lines.push(`${qStr} ${firstDesc} ${unitStr} ${subStr}`);
    for(let i=1;i<descLines.length;i++){
      lines.push(`       ${descLines[i]}`);
    }
  }
  const subtotal=Number(order.subtotal_bruto??order.total);
  const descVal=Number(order.desconto_tipo==='PERCENTUAL'?(subtotal*Number(order.desconto_valor||0)/100):(order.desconto_valor||0));
  const total=Number(order.total);
  lines.push(
    '----------------------------------------',
    `TOTAL DE ITENS: ${String(totalQtd).padStart(23)}`,
    `SUBTOTAL:       ${('R$ '+subtotal.toFixed(2)).padStart(24)}`,
    `DESCONTO:       ${('R$ '+descVal.toFixed(2)).padStart(24)}`,
    `TOTAL A PAGAR:  ${('R$ '+total.toFixed(2)).padStart(24)}`
  );
  if(order.observacoes){
    lines.push('----------------------------------------');
    for(const obsLine of wrap(`OBS: ${order.observacoes}`,40)){
      lines.push(obsLine);
    }
  }
  lines.push(
    '----------------------------------------',
    `FORMA PAGTO:    ${String(order.forma_pagamento||'-').padStart(24)}`,
    `PAGAMENTO:      ${(order.pagamento_status==='RECEBIDO'?'RECEBIDO':'NAO RECEBIDO').padStart(24)}`
  );
  if(order.forma_pagamento==='DINHEIRO'&&order.valor_recebido){
    lines.push(`VALOR RECEBIDO: ${('R$ '+Number(order.valor_recebido).toFixed(2)).padStart(24)}`);
    lines.push(`TROCO:          ${('R$ '+Number(order.troco||0).toFixed(2)).padStart(24)}`);
  }else if(order.forma_pagamento==='CREDITO'){
    const credInfo=order.cartao_modalidade==='PARCELADO'?`${order.parcelas||2}x`:'A VISTA';
    lines.push(`MODALIDADE:     ${credInfo.padStart(24)}`);
  }
  lines.push(
    '----------------------------------------',
    '',
    '',
    '________________________________________',
    '         ASSINATURA DO CLIENTE          ',
    `   ${(order.cliente_nome||'Cliente Balcao').slice(0,34)}   `,
    '========================================',
    'Esse documento não possui valor fiscal',
    '       Xiquim Vargas ERP - PDV          ',
    '========================================'
  );
  buildThermalPdf(lines,file);
}

export function makeOrderPdf(order,items,file){
  if(order.origem==='BALCAO')return makeThermalOrderPdf(order,items,file);
  const sep = '-'.repeat(94);
  const lines=[
    'XIQUIM VARGAS - DISTRIBUIDORA DE BEBIDAS',
    '',
    `Emissão: ${formatBrasiliaDateTime(order.created_at)}`,
    `Cliente: ${order.cliente_nome}`,
    `Endereço: ${formatOrderAddress(order)}`,
    '',
    'ITENS',
    `QTD/UN  ${'DESCRIÇÃO'.padEnd(55,' ')}${'UNITÁRIO'.padStart(15,' ')}${'SUBTOTAL'.padStart(16,' ')}`,
    sep
  ];
  for(const x of items){
    let unit = x.unidade;
    if(!unit && x.produto_id){
      try{
        const prod=one('SELECT unidade FROM produtos WHERE id=?',[x.produto_id]);
        if(prod?.unidade) unit=prod.unidade;
      }catch{}
    }
    const unitTag = formatUnitTag(unit);
    const qStr = (String(x.quantidade).padStart(3) + ' ' + unitTag).padEnd(7, ' ') + ' ';
    const descLines=wrap(String(x.produto_nome||'').trim(),55);
    const firstDesc=(descLines[0]||'').padEnd(55,' ');
    lines.push(`${qStr}${firstDesc}${`R$ ${Number(x.preco_unitario_aplicado).toFixed(2)}`.padStart(15)}${`R$ ${Number(x.subtotal).toFixed(2)}`.padStart(16)}`);
    for(let i=1;i<descLines.length;i++){
      lines.push(`        ${descLines[i]}`);
    }
  }
  lines.push(
    '',
    sep,
    `SUBTOTAL: R$ ${Number(order.subtotal_bruto??order.total).toFixed(2)}`,
    `DESCONTO ${order.desconto_tipo==='PERCENTUAL'?`(${Number(order.desconto_valor||0).toFixed(2)}%)`:'(R$)'}: R$ ${Number(order.desconto_tipo==='PERCENTUAL'?(Number(order.subtotal_bruto||0)*Number(order.desconto_valor||0)/100):(order.desconto_valor||0)).toFixed(2)}`,
    `TOTAL DO PEDIDO: R$ ${Number(order.total).toFixed(2)}`,
    '',
    ...wrap(`Observações: ${order.observacoes||'-'}`, 94),
    '',
    `Forma de pagamento: ${order.forma_pagamento||'-'}`,
    `Pagamento: ${order.pagamento_status==='RECEBIDO'?'Recebido':'Não recebido'}`
  );
  if(order.forma_pagamento==='DINHEIRO'&&order.valor_recebido){
    lines.push(`Valor recebido: R$ ${Number(order.valor_recebido).toFixed(2)}`);
    lines.push(`Troco: R$ ${Number(order.troco||0).toFixed(2)}`);
  }else if(order.forma_pagamento==='CREDITO'){
    lines.push(`Crédito: ${order.cartao_modalidade==='PARCELADO'?`${order.parcelas||1}x`:'À vista'}`);
  }
  lines.push(
    '',
    'Esse documento não possui valor fiscal'
  );
  buildPdf(paginate(lines.filter(l=>l!==null&&l!==undefined),54,94),file,{fontSize:9.5,lineHeight:14,leftMargin:28,topMargin:810});
}

export function makeCatalogPdf(items,file){const sep='-'.repeat(116);const lines=['XIQUIM VARGAS','CATÁLOGO DE PRODUTOS',`Gerado em: ${formatBrasiliaDateTime(new Date())}`,`Total de produtos: ${items.length}`,'','PRODUTO                                          | SKU              | CATEGORIA        | SUBCATEGORIA     | PREÇO | PROMOÇÃO',sep];for(const x of items)lines.push(`${String(x.nome||'').slice(0,48).padEnd(48)} | ${String(x.sku||'').slice(0,16).padEnd(16)} | ${String(x.categoria_nome||'-').slice(0,16).padEnd(16)} | ${String(x.subcategoria_nome||'-').slice(0,16).padEnd(16)} | R$ ${Number(x.preco_base||0).toFixed(2)} | ${x.promocao_preco==null?'-':'R$ '+Number(x.promocao_preco).toFixed(2)}`);buildPdf(paginate(lines,72,116),file,{fontSize:8,lineHeight:11,leftMargin:14,topMargin:824})}
export function makeStockPdf(items,file){const sep='-'.repeat(116);const lines=['XIQUIM VARGAS','RELATÓRIO DE ESTOQUE INTELIGENTE',`Gerado em: ${formatBrasiliaDateTime(new Date())}`,`Total de produtos: ${items.length}`,'','PRODUTO                                                  | SKU             | DISPONÍVEL | RESERVADO | MÍNIMO | STATUS',sep];for(const x of items)lines.push(`${String(x.nome||'').slice(0,56).padEnd(56)} | ${String(x.sku||'').slice(0,15).padEnd(15)} | ${String(x.quantidade_disponivel).padStart(10)} | ${String(x.quantidade_reservada).padStart(9)} | ${String(x.estoque_minimo).padStart(6)} | ${x.status||'-'}`);buildPdf(paginate(lines,72,116),file,{fontSize:8,lineHeight:11,leftMargin:14,topMargin:824})}

export function makeLoadingListPdf(data, file) {
  const sep = '-'.repeat(72);
  const lines=[
    'XIQUIM VARGAS - DISTRIBUIDORA DE BEBIDAS',
    'LISTA DE CARREGAMENTO LOGÍSTICO',
    ...(data.vendedor ? [`Vendedor: ${data.vendedor}`] : []),
    `Gerado em: ${formatBrasiliaDateTime(new Date())}`,
    `Total de pedidos: ${data.total_pedidos || 0}`,
    `Total de volumes: ${data.total_produtos || 0}`,
    '',
    'QTD/UN   DESCRIÇÃO DO PRODUTO',
    sep
  ];
  for(const p of data.produtos||[]){
    let unit = p.unidade;
    if(!unit && p.produto_id){
      try{
        const prod=one('SELECT unidade FROM produtos WHERE id=?',[p.produto_id]);
        if(prod?.unidade) unit=prod.unidade;
      }catch{}
    }
    const unitTag = formatUnitTag(unit);
    const qStr = (String(p.quantidade_total).padStart(3) + ' ' + unitTag).padEnd(8, ' ') + ' ';
    const descLines = wrap(String(p.produto_nome || '').trim(), 63);
    lines.push(`${qStr}${descLines[0] || ''}`);
    for(let i=1; i<descLines.length; i++){
      lines.push(`         ${descLines[i]}`);
    }
  }
  lines.push(
    sep,
    '',
    `TOTAL GERAL DE VOLUMES: ${data.total_produtos || 0}`,
    `VARIEDADE DE PRODUTOS: ${(data.produtos||[]).length}`,
    '',
    'Documento operacional para conferência de carregamento e expedição.'
  );
  buildPdf(paginate(lines,44,72),file,{fontSize:12,lineHeight:17,leftMargin:28,topMargin:805});
}
export function makeBulkOrderPdf(ordersData, file) {
  const allPages = [];
  const sep = '-'.repeat(94);
  for (const {order, items} of ordersData) {
    const lines=[
      'XIQUIM VARGAS - DISTRIBUIDORA DE BEBIDAS',
      '',
      `Emissão: ${formatBrasiliaDateTime(order.created_at)}`,
      `Cliente: ${order.cliente_nome}`,
      `Endereço: ${formatOrderAddress(order)}`,
      '',
      'ITENS',
      `QTD/UN  ${'DESCRIÇÃO'.padEnd(55,' ')}${'UNITÁRIO'.padStart(15,' ')}${'SUBTOTAL'.padStart(16,' ')}`,
      sep
    ];
    for(const x of items){
      let unit = x.unidade;
      if(!unit && x.produto_id){
        try{
          const prod=one('SELECT unidade FROM produtos WHERE id=?',[x.produto_id]);
          if(prod?.unidade) unit=prod.unidade;
        }catch{}
      }
      const unitTag = formatUnitTag(unit);
      const qStr = (String(x.quantidade).padStart(3) + ' ' + unitTag).padEnd(7, ' ') + ' ';
      const descLines=wrap(String(x.produto_nome||'').trim(),55);
      const firstDesc=(descLines[0]||'').padEnd(55,' ');
      lines.push(`${qStr}${firstDesc}${`R$ ${Number(x.preco_unitario_aplicado).toFixed(2)}`.padStart(15)}${`R$ ${Number(x.subtotal).toFixed(2)}`.padStart(16)}`);
      for(let i=1;i<descLines.length;i++){
        lines.push(`        ${descLines[i]}`);
      }
    }
    lines.push(
      '',
      sep,
      `SUBTOTAL: R$ ${Number(order.subtotal_bruto??order.total).toFixed(2)}`,
      `DESCONTO ${order.desconto_tipo==='PERCENTUAL'?`(${Number(order.desconto_valor||0).toFixed(2)}%)`:'(R$)'}: R$ ${Number(order.desconto_tipo==='PERCENTUAL'?(Number(order.subtotal_bruto||0)*Number(order.desconto_valor||0)/100):(order.desconto_valor||0)).toFixed(2)}`,
      `TOTAL DO PEDIDO: R$ ${Number(order.total).toFixed(2)}`,
      '',
      ...wrap(`Observações: ${order.observacoes||'-'}`, 94),
      '',
      `Forma de pagamento: ${order.forma_pagamento||'-'}`,
      `Pagamento: ${order.pagamento_status==='RECEBIDO'?'Recebido':'Não recebido'}`
    );
    if(order.forma_pagamento==='DINHEIRO'&&order.valor_recebido){
      lines.push(`Valor recebido: R$ ${Number(order.valor_recebido).toFixed(2)}`);
      lines.push(`Troco: R$ ${Number(order.troco||0).toFixed(2)}`);
    }else if(order.forma_pagamento==='CREDITO'){
      lines.push(`Crédito: ${order.cartao_modalidade==='PARCELADO'?`${order.parcelas||1}x`:'À vista'}`);
    }
    lines.push(
      '',
      'Esse documento não possui valor fiscal'
    );
    
    const pages = paginate(lines.filter(l=>l!==null&&l!==undefined),54,94);
    allPages.push(...pages);
  }
  buildPdf(allPages, file, {fontSize:9.5,lineHeight:14,leftMargin:28,topMargin:810});
}
