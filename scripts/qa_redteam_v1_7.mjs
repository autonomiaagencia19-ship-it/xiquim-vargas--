const base='http://127.0.0.1:3000';
async function req(path,opts={}){const r=await fetch(base+path,opts);let d;const ct=r.headers.get('content-type')||'';d=ct.includes('application/json')?await r.json():Buffer.from(await r.arrayBuffer());return {status:r.status,data:d}}
async function login(email,password){return (await req('/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,password})})).data.token}
const admin=await login('admin@xiquimvargas.local','Admin@123');const seller=await login('vendedor@xiquimvargas.local','Vendedor@123');const web=await login('cliente@xiquimvargas.local','Cliente@123');
const A={authorization:'Bearer '+admin,'content-type':'application/json'},S={authorization:'Bearer '+seller,'content-type':'application/json'},W={authorization:'Bearer '+web,'content-type':'application/json'};
const cat=(await req('/api/products?limit=10',{headers:A})).data.items[0];const st=(await req('/api/stock/'+cat.id+'?x=1',{headers:A})).data;
const tests=[];
let r=await req('/api/products?limit=10',{headers:A});tests.push(['catalog has no stock',!r.data.items.some(x=>'quantidade_disponivel' in x)]);
r=await req('/api/stock',{headers:W});tests.push(['web cannot see stock endpoint',r.status===403||r.status===401]);
r=await req('/api/admin/export/catalog.pdf',{headers:S});tests.push(['seller cannot export admin catalog',r.status===403||r.status===401]);
r=await req(`/api/products/${cat.id}/images`,{method:'GET',headers:S});tests.push(['seller cannot enumerate admin photos',r.status===403||r.status===401]);r=await req('/api/settings',{headers:S});tests.push(['seller cannot edit store settings',r.status===403||r.status===401]);
r=await req(`/api/products/${cat.id}/promotions`,{method:'POST',headers:S,body:JSON.stringify({nome:'x',preco_promocional:1})});tests.push(['seller cannot create promotion',r.status===403||r.status===401]);
r=await req(`/api/stock/${cat.id}`,{method:'POST',headers:S,body:JSON.stringify({delta:1,tipo:'AJUSTE'})});tests.push(['seller cannot mutate stock',r.status===403||r.status===401]);
r=await req('/api/../server.js',{headers:A});tests.push(['path traversal blocked',r.status===404||r.status===403]);
const before=(await req('/api/stock',{headers:A})).data.items.find(x=>x.id===cat.id);const original=(await req('/api/products?limit=10',{headers:A})).data.items.find(x=>x.id===cat.id);r=await req(`/api/products/${cat.id}`,{method:'PUT',headers:A,body:JSON.stringify({descricao:'QA catálogo não deve alterar estoque'})});const after=(await req('/api/stock',{headers:A})).data.items.find(x=>x.id===cat.id);tests.push(['catalog edit preserves stock',Number(before.quantidade_disponivel)===Number(after.quantidade_disponivel)]);await req(`/api/products/${cat.id}`,{method:'PUT',headers:A,body:JSON.stringify({descricao:original.descricao})});
const ok=tests.every(x=>x[1]);for(const [n,v] of tests)console.log((v?'PASS':'FAIL')+' - '+n);if(!ok)process.exit(1);console.log('RED TEAM 1.7 PASS');
