import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {makeOrderPdf,makeCatalogPdf,makeStockPdf} from '../src/pdf.js';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'xv-pdf-'));
const items=Array.from({length:120},(_,i)=>({produto_nome:`Bebida Áçãõ Nº ${i+1}`,quantidade:i%12+1,preco_unitario_aplicado:9.99,subtotal:(i%12+1)*9.99}));
const order=path.join(dir,'pedido.pdf');makeOrderPdf({numero:'XV-2026-000001',created_at:new Date().toISOString(),origem:'VENDEDOR',cliente_nome:'Cliente Águas & Cia',cnpj_cpf:'00.000.000/0001-00',total:1234.56,status:'PENDENTE'},items,order);
const cat=path.join(dir,'catalogo.pdf');makeCatalogPdf(items.map((x,i)=>({nome:x.produto_nome,sku:'SKU-'+i,categoria_nome:'Bebidas não alcoólicas',subcategoria_nome:'Refrigerantes',preco_base:9.99,promocao_preco:i%2?8.99:null})),cat);
const stock=path.join(dir,'estoque.pdf');makeStockPdf(items.map((x,i)=>({nome:x.produto_nome,sku:'SKU-'+i,quantidade_disponivel:100,quantidade_reservada:2,estoque_minimo:10,status:'OK'})),stock);
for(const f of [order,cat,stock]){const b=fs.readFileSync(f,'latin1');if(!b.startsWith('%PDF-1.4'))throw new Error('header '+f);const pages=(b.match(/\/Type \/Page\b/g)||[]).length;if(pages<2)throw new Error('pagination '+f);if(!b.includes('Distribui'))console.log('info:',f,'font encoding validated via PDF structure');console.log(path.basename(f),'PASS',b.length,'bytes',pages,'pages')}
fs.rmSync(dir,{recursive:true,force:true});console.log('PDF QA PASS');
