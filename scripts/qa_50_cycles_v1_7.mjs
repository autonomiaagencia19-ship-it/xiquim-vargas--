import {DatabaseSync} from 'node:sqlite';
const base=process.env.BASE_URL||'http://127.0.0.1:3000';
async function req(path,opts={}){const r=await fetch(base+path,opts);const ct=r.headers.get('content-type')||'';const data=ct.includes('application/json')?await r.json():Buffer.from(await r.arrayBuffer());if(!r.ok)throw new Error(`${r.status} ${JSON.stringify(data).slice(0,300)}`);return {r,data}}
async function login(email,password){return (await req('/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,password})})).data.token}
const admin=await login('admin@xiquimvargas.local','Admin@123');
const seller=await login('vendedor@xiquimvargas.local','Vendedor@123');
const AH={authorization:'Bearer '+admin};const SH={authorization:'Bearer '+seller};
const db=new DatabaseSync(new URL('../storage/xiquim-vargas.db',import.meta.url).pathname);
let pass=0;
for(let i=1;i<=50;i++){
  const h=(await req('/health')).data;if(h.version!=='1.7.0')throw new Error(`cycle ${i}: version`);
  const c=(await req('/api/products?limit=100',{headers:AH})).data;if(!Array.isArray(c.items))throw new Error(`cycle ${i}: catalog`);
  if(c.items.some(x=>'quantidade_disponivel' in x||'quantidade_reservada' in x||'estoque_minimo' in x))throw new Error(`cycle ${i}: stock leaked into catalog`);
  const st=(await req('/api/stock?limit=100',{headers:AH})).data;if(!Array.isArray(st.items))throw new Error(`cycle ${i}: stock`);
  const ss=(await req('/api/seller/stock',{headers:SH})).data;if(!Array.isArray(ss.items))throw new Error(`cycle ${i}: seller stock`);
  const cat=(await req('/api/categories',{headers:AH})).data;if(!Array.isArray(cat.categorias))throw new Error(`cycle ${i}: categories`);
  const promos=(await req('/api/promotions',{headers:AH})).data;if(!Array.isArray(promos.items))throw new Error(`cycle ${i}: promotions`);const store=(await req('/api/store-config')).data;if(!store.config?.['store.title'])throw new Error(`cycle ${i}: store config`);
  if(i%5===0){for(const p of ['/api/admin/export/catalog.pdf','/api/admin/export/stock.pdf']){const x=await req(p,{headers:AH});if(x.data.subarray(0,5).toString()!=='%PDF-')throw new Error(`cycle ${i}: invalid pdf ${p}`)}}
  if(i%10===0){const fk=db.prepare('PRAGMA foreign_key_check').all();const ic=db.prepare('PRAGMA integrity_check').get();if(fk.length||ic.integrity_check!=='ok')throw new Error(`cycle ${i}: sqlite integrity`) }
  pass++; if(i%10===0)console.log(`50-CYCLE CHECKPOINT ${i}/50 PASS`);
}
console.log(`50 CYCLES PASS: ${pass}/50`);db.close();
