import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { once } from 'node:events';
process.env.NODE_ENV = 'development';
process.env.PORT = String(42000 + Math.floor(Math.random() * 10000));
process.env.STORAGE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'xv-stress-5000-'));
process.env.JWT_SECRET = 'local-stress-only-secret-never-use-in-production';
process.env.DISABLE_AUTOMATIC_BACKUP = '1';
const { hashPassword, sign } = await import('../src/auth.js');
const { db, id } = await import('../src/db.js');
const { server } = await import('../server.js');
if (!server.listening) await once(server, 'listening');
const originalLog = console.log;
console.log = () => {};
const accounts = {};
for (const [role, name] of [['admin','Stress Admin'],['seller','Stress Seller'],['cashier','Stress Cashier'],['driver','Stress Driver'],['web_client','Stress Web']]) {
  const userId=id(), email=`stress-${role}@example.test`;
  db.prepare('INSERT INTO usuarios(id,nome,email,senha_hash,role,ativo) VALUES(?,?,?,?,?,1)').run(userId,name,email,hashPassword('StressOnly123!'),role);
  accounts[role]={id:userId,token:sign({sub:userId,role,email,nome:name})};
}
const clientId=id();
db.prepare('INSERT INTO clientes(id,razao_social,cnpj_cpf,endereco,bairro,vendedor_id) VALUES(?,?,?,?,?,?)').run(clientId,'Stress Client',`STRESS-${clientId}`,'Stress Street','Centro',accounts.seller.id);
db.prepare('INSERT INTO usuario_clientes(usuario_id,cliente_id) VALUES(?,?)').run(accounts.web_client.id,clientId);

const surfaces={
  admin:[n=>'/api/me',n=>'/api/dashboard?periodo='+['geral','semanal','mensal'][n%3],n=>'/api/products?q=stress-'+(n%11),n=>'/api/clients?q=stress-'+(n%7),n=>'/api/orders',n=>'/api/logistics/routes',n=>'/api/reports?periodo='+['geral','semanal','mensal'][n%3],n=>'/api/admin/metrics',n=>'/api/admin/reconcile',n=>'/api/setup/status'],
  seller:[n=>'/api/me',n=>'/api/clients?q=stress-'+(n%9),n=>'/api/products?cliente_id='+clientId+'&q=stress-'+(n%8),n=>'/api/orders',n=>'/api/seller/stock?q=stress-'+(n%5),n=>'/api/seller/dashboard/monthly'],
  cashier:[n=>'/api/me',n=>'/api/clients?q=stress-'+(n%7),n=>'/api/products?cliente_id='+clientId+'&q=stress-'+(n%8),n=>'/api/stock?q=stress-'+(n%5),n=>'/api/orders',n=>'/api/categories'],
  driver:[n=>'/api/me',n=>'/api/logistics/routes',n=>'/api/logistics/completed-routes',n=>'/api/orders'],
  web_client:[n=>'/api/me',n=>'/api/products?cliente_id='+clientId+'&q=stress-'+(n%8),n=>'/api/orders',n=>'/api/store/profile',n=>'/api/store-config',n=>'/api/categories']
};
const roles=Object.keys(surfaces);
const agents=Array.from({length:10},(_,i)=>new http.Agent({keepAlive:true,localAddress:`127.0.0.${i+2}`,maxSockets:8}));
const origin=`http://127.0.0.1:${process.env.PORT}`;
function get(url,token,agent){return new Promise((resolve,reject)=>{const req=http.get(origin+url,{agent,headers:{authorization:`Bearer ${token}`,accept:'application/json'}},res=>{const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>{let body='';try{body=Buffer.concat(chunks).toString('utf8')}catch{};resolve({status:res.statusCode,body,url})})});req.on('error',reject)})}
let completed=0;const total=5000;const counts=Object.fromEntries(roles.map(role=>[role,0]));
try{
  for(let n=0;n<total;n++){
    const role=roles[n%roles.length],choices=surfaces[role],url=choices[Math.floor(n/roles.length)%choices.length](n);
    const response=await get(url,accounts[role].token,agents[n%agents.length]);
    if(response.status!==200)throw new Error(`Stress request ${n+1} failed for ${role}: HTTP ${response.status} ${url} ${response.body.slice(0,300)}`);
    completed++;counts[role]++;
    if(completed%500===0){process.stdout.write(`Completed ${completed}/${total} HTTP operations; by interface: ${JSON.stringify(counts)}\n`)}
  }
  process.stdout.write(`PASS: ${completed} successful HTTP reads across admin, seller, cashier, driver and web-client surfaces.\n`);
} finally {
  for(const agent of agents)agent.destroy();
  await new Promise(resolve=>server.close(resolve));
  db.close();
  console.log=originalLog;
}
