import fs from 'node:fs';import {DatabaseSync} from 'node:sqlite';
const BASE=process.env.BASE||'http://127.0.0.1:3200';const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const req=async(p,o={})=>{const r=await fetch(BASE+p,o);const t=await r.text();let d={};try{d=JSON.parse(t)}catch{};return{s:r.status,d}};const login=async(e,p)=>{const r=await req('/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:e,password:p})});if(r.s!==200)throw Error(`login ${e}`);return r.d.token};const H=t=>({authorization:`Bearer ${t}`,'content-type':'application/json'});const A=(x,m)=>{if(!x)throw Error(m)};
const admin=await login('admin@xiquimvargas.local','Admin@123'), seller=await login('vendedor@xiquimvargas.local','Vendedor@123'), driver=await login('motorista@xiquimvargas.local','Motorista@123');
let pass=0;const db=new DatabaseSync('storage/xiquim-vargas.db');
for(let cycle=1;cycle<=50;cycle++){
 const health=await req('/health');A(health.s===200&&health.d.ok,`cycle ${cycle}: health`);
 const ready=await req('/ready');A(ready.s===200&&ready.d.ready,`cycle ${cycle}: ready`);
 const products=await req('/api/products?limit=20',{headers:H(seller)});A(products.s===200,`cycle ${cycle}: products`);
 const clients=await req('/api/clients',{headers:H(seller)});A(clients.s===200&&clients.d.items.length,`cycle ${cycle}: clients`);
 const reconcile=await req('/api/admin/reconcile',{headers:H(admin)});A(reconcile.s===200&&reconcile.d.ok,`cycle ${cycle}: stock reconcile`);
 const audit=await req('/api/audit',{headers:H(admin)});A(audit.s===200,`cycle ${cycle}: audit`);
 const metrics=await req('/api/admin/metrics',{headers:H(admin)});A(metrics.s===200&&metrics.d.requests>0,`cycle ${cycle}: metrics`);
 A((await req('/api/audit',{headers:H(seller)})).s===403,`cycle ${cycle}: audit isolation`);
 A((await req('/api/dashboard',{headers:H(seller)})).s===403,`cycle ${cycle}: dashboard isolation`);
 A(db.prepare('PRAGMA integrity_check').get().integrity_check==='ok',`cycle ${cycle}: sqlite integrity`);
 A(db.prepare('PRAGMA foreign_key_check').all().length===0,`cycle ${cycle}: foreign keys`);
 A(db.prepare("SELECT COUNT(*) n FROM estoque WHERE quantidade_disponivel<0 OR quantidade_reservada<0").get().n===0,`cycle ${cycle}: negative stock`);
 const css=fs.readFileSync('public/styles.css','utf8');A(css.includes('prefers-reduced-motion'),`cycle ${cycle}: css polish`);
 const app=fs.readFileSync('public/app.js','utf8');A(!/[ÃÂâ][\x80-\xBF]/.test(app),`cycle ${cycle}: encoding`);
 pass++;await sleep(120);
}
db.close();console.log(`FINAL 50 CYCLES PASS: ${pass}/50`);
