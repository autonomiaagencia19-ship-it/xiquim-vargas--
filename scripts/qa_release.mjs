import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const root=process.cwd(),tmp=process.env.STORAGE_DIR||path.join(root,'work-qa-storage'),port=Number(process.env.PORT||4387),base=`http://127.0.0.1:${port}`;
const env={...process.env,PORT:String(port),STORAGE_DIR:tmp,NODE_ENV:'production',JWT_SECRET:'qa-release-secret-keep-out-of-production'};
let logs='';const passed=[];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));const check=(ok,name)=>{if(!ok)throw Error(name);passed.push(name)};
async function req(url,opts={}){const r=await fetch(base+url,opts);const txt=await r.text();let data;try{data=JSON.parse(txt)}catch{data=txt}return{status:r.status,data,headers:r.headers}}
const json=(token,body,more={})=>({method:'POST',headers:{...(token?{authorization:`Bearer ${token}`}:{ }),'content-type':'application/json',...more},body:JSON.stringify(body)});
try{
 let ready=false;for(let i=0;i<240;i++){try{if((await fetch(base+'/ready')).ok){ready=true;break}}catch{}await sleep(100)}check(ready,'process start and readiness');
 check((await req('/health')).status===200,'health endpoint');
 for(const route of ['/admin.html','/loja.html','/vendedor.html','/pdv.html','/motorista.html','/admin','/loja','/vendedor','/caixa','/motorista'])check((await fetch(base+route)).ok,`interface ${route}`);
 check((await req('/api/products')).status===401,'API authentication gate');check((await req('/api/setup/status')).data.required===true,'fresh first-admin setup state');
 const token=fs.readFileSync(path.join(tmp,'setup-token.txt'),'utf8').trim();check(!!token,'secure first-access token emitted');
 let r=await req('/api/setup/initialize',json(null,{nome:'QA Administrador',email:'admin@qa.local',password:'StrongPass123!',token}));if(r.status!==201)r=await req('/api/setup/initialize',{...json(null,{nome:'QA Administrador',email:'admin@qa.local',password:'StrongPass123!'}),headers:{'content-type':'application/json','x-setup-token':token}});check(r.status===201,'first admin creation');const admin=r.data.token;check(!!admin,'first admin session');
 check((await req('/api/me',{headers:{authorization:`Bearer ${admin}`}})).status===200,'authenticated current user');
 const cat=await req('/api/categories',json(admin,{nome:'QA Categoria',descricao:'Teste'}));check(cat.status===201,'category creation');
 const prod=await req('/api/products',json(admin,{nome:'Produto de QA',sku:'QA-001',codigo_barras:'7890000000012',preco_base:12.5,unidade:'UN',categoria_id:cat.data.item.id}));check(prod.status===201,'product creation');const pid=prod.data.item.id;
 check((await req(`/api/stock/${pid}`,json(admin,{delta:20,tipo:'ENTRADA',observacao:'Carga de QA'}))).status===200,'stock inbound movement');
 check((await req(`/api/stock/${pid}/movements`,{headers:{authorization:`Bearer ${admin}`}})).status===200,'stock movement history');
 const client=await req('/api/clients',json(admin,{razao_social:'Cliente QA',nome_fantasia:'Cliente QA',cnpj_cpf:'QA-CLIENT-001',endereco:'Rua QA 1',bairro:'Centro',cidade:'Teste',estado:'GT'}));check(client.status===201,'customer creation');const cid=client.data.item.id;
 check((await req(`/api/products?limit=100&cliente_id=${encodeURIComponent(cid)}`,{headers:{authorization:`Bearer ${admin}`}})).status===200,'customer-priced product listing');
 const order=await req('/api/orders',json(admin,{cliente_id:cid,itens:[{produto_id:pid,quantidade:2}],origem:'BALCAO',modalidade_entrega:'RETIRADA'}));check(order.status===201,'order creation');const oid=order.data.item.id;
 check((await req(`/api/orders/${oid}/detail`,{headers:{authorization:`Bearer ${admin}`}})).status===200,'order detail');
 check((await req('/api/dashboard',{headers:{authorization:`Bearer ${admin}`}})).status===200,'dashboard');
 check((await req('/api/admin/reconcile',{headers:{authorization:`Bearer ${admin}`}})).data.ok===true,'stock reservation reconciliation');
 check((await req(`/api/orders/${oid}/cancel`,json(admin,{motivo:'QA'}))).status===200,'order cancellation and stock release');
 check((await req('/api/orders/cancelled',{headers:{authorization:`Bearer ${admin}`}})).data.items.some(x=>x.id===oid),'cancelled-order history');
 check((await req('/api/admin/metrics',{headers:{authorization:`Bearer ${admin}`}})).status===200,'admin metrics');
 check((await req('/api/admin/ia',json(admin,{message:'teste'}))).status===200,'administrative contextual assistant');
 check((await req('/api/settings',{headers:{authorization:`Bearer ${admin}`}})).status===200,'system settings read');
 check((await req('/api/store-config')).status===200,'public store configuration');

 const users={};for(const role of ['seller','cashier','driver']){const user=await req('/api/users',json(admin,{nome:`QA ${role}`,email:`${role}@qa.local`,password:'StrongPass123!',role}));check(user.status===201,`${role} user creation`);users[role]=user.data.item;const login=await req('/api/auth/login',json(null,{email:`${role}@qa.local`,password:'StrongPass123!'}));check(login.status===200,`${role} login`);users[role].token=login.data.token;}
 check((await req('/api/users',{headers:{authorization:`Bearer ${admin}`}})).status===200,'user administration listing');
 check((await req(`/api/pdv/barcode?code=7890000000012&cliente_id=${encodeURIComponent(cid)}`,{headers:{authorization:`Bearer ${users.cashier.token}`}})).status===200,'cashier barcode lookup');
 check((await req(`/api/pdv/barcode?code=000000000000000&cliente_id=${encodeURIComponent(cid)}`,{headers:{authorization:`Bearer ${users.cashier.token}`}})).status===404,'unknown barcode handling');
 check((await req('/api/stock',{headers:{authorization:`Bearer ${users.cashier.token}`}})).status===200,'cashier stock inquiry');
 check((await req('/api/orders',{headers:{authorization:`Bearer ${users.seller.token}`}})).status===200,'seller order listing');
 check((await req('/api/seller/dashboard/monthly',{headers:{authorization:`Bearer ${users.seller.token}`}})).status===200,'seller monthly dashboard');
 const delivery=await req('/api/orders',json(admin,{cliente_id:cid,itens:[{produto_id:pid,quantidade:1}],origem:'WEB',modalidade_entrega:'ENTREGA'}));check(delivery.status===201,'delivery order creation');const did=delivery.data.item.id;
 check((await req(`/api/orders/${did}/status`,json(admin,{status:'SEPARACAO'}))).status===200,'order transition to separation');
 const route=await req('/api/logistics/routes',json(admin,{pedido_ids:[did],motorista_id:users.driver.id}));check(route.status===201,'route creation and driver assignment');
 check((await req('/api/logistics/grouped-orders',{headers:{authorization:`Bearer ${admin}`}})).status===200,'grouped logistics orders');
 check((await req('/api/logistics/loading-list',json(admin,{pedido_ids:[did]}))).status===200,'loading list calculation');
 const loadingPdf=await req('/api/logistics/loading-list/pdf',json(admin,{pedido_ids:[did]}));check(loadingPdf.status===200&&String(loadingPdf.headers.get('content-type')).includes('application/pdf'),'loading list PDF');
 const catalogPdf=await req('/api/admin/export/catalog.pdf',{headers:{authorization:`Bearer ${admin}`}});check(catalogPdf.status===200&&String(catalogPdf.headers.get('content-type')).includes('application/pdf'),'catalog export PDF');
 const stockPdf=await req('/api/admin/export/stock.pdf',{headers:{authorization:`Bearer ${admin}`}});check(stockPdf.status===200&&String(stockPdf.headers.get('content-type')).includes('application/pdf'),'stock export PDF');
 const orderPdf=await req(`/api/orders/${did}/pdf`,{headers:{authorization:`Bearer ${admin}`}});check(orderPdf.status===200&&String(orderPdf.headers.get('content-type')).includes('application/pdf'),'order PDF download');
 check((await req('/api/logistics/routes',{headers:{authorization:`Bearer ${users.driver.token}`}})).status===200,'driver route visibility');
 check((await req(`/api/orders/${did}/detail`,{headers:{authorization:`Bearer ${users.driver.token}`}})).status===200,'driver order visibility');
 const proof=await req(`/api/logistics/orders/${did}/proof`,json(users.driver.token,{data_url:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII='},{'Idempotency-Key':'QA-PROOF-0001'}));check(proof.status===200||proof.status===201,'driver proof upload');
 check((await req(`/api/logistics/orders/${did}/complete`,json(users.driver.token,{}, {'Idempotency-Key':'QA-COMPLETE-0001'}))).status===200,'driver delivery completion');
 check((await req('/api/logistics/completed-routes',{headers:{authorization:`Bearer ${users.driver.token}`}})).status===200,'driver completed-route history');
 check((await req('/api/admin/reconcile',{headers:{authorization:`Bearer ${admin}`}})).data.ok===true,'post-delivery stock reconciliation');
 console.log(JSON.stringify({ok:true,passed,total:passed.length,storage:tmp},null,2));
}catch(e){console.error(JSON.stringify({ok:false,error:e.message,passed,logs:logs.slice(-5000)},null,2));process.exitCode=1}











