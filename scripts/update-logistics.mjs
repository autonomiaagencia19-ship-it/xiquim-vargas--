import fs from 'fs';
let c = fs.readFileSync('server.js','utf8');
c = c.replace(
  /WHERE p\.status IN \('PENDENTE','SEPARACAO','ROTA'\)/,
  "WHERE p.status IN ('SEPARACAO','ROTA')"
);
c = c.replace(
  /return send\(res,200,\{items:buckets\.filter\(g=>g\.subgrupos\.length\),grupos:buckets\}\)/,
  "const rota=rows.filter(o=>o.status==='ROTA'); buckets.forEach(b=>{ b.subgrupos.forEach(sg=>{ sg.pedidos = sg.pedidos.filter(o=>o.status==='SEPARACAO'); sg.total_pedidos = sg.pedidos.length; sg.total_valor = sg.pedidos.reduce((acc, x) => acc + Number(x.total||0), 0); }); b.subgrupos = b.subgrupos.filter(sg=>sg.pedidos.length>0); }); return send(res,200,{items:buckets.filter(g=>g.subgrupos.length),grupos:buckets, em_rota:rota})"
);
fs.writeFileSync('server.js',c);

let a = fs.readFileSync('public/app.js', 'utf8');

// Replace the old actions div with a floating one
a = a.replace(
  /<div class="actions"><button class="btn primary" onclick="generateLoadingList\(\)">Gerar lista de carregamento<\/button><button class="btn" onclick="makeRoute\(\)">Gerar rota com selecionados<\/button><\/div><\/div>/,
  `</div>
   <div style="text-align:center; margin:30px 0;"><button class="btn" onclick="$('#logisticsDashboard').style.display='block';$('#logisticsMain').style.display='none'">Ver dashboard de pedidos em rota →</button></div>
   <div style="position:fixed; bottom:20px; left:50%; transform:translateX(-50%); background:var(--bg); padding:10px 20px; border-radius:30px; box-shadow:0 10px 25px rgba(0,0,0,0.2); z-index:999; display:flex; gap:10px; border:1px solid var(--border)">
    <button class="btn primary" onclick="generateLoadingList()">Gerar lista</button>
    <button class="btn" onclick="makeRouteModal()">Gerar rota</button>
   </div>
   <div id="logisticsDashboard" style="display:none; padding:20px; background:var(--bg); position:absolute; top:0; left:0; width:100%; min-height:100vh; z-index:50;">
    <div class="panel-title"><div><h3>Dashboard: Pedidos em Rota</h3><p class="muted">Monitoramento de pedidos atualmente em entrega.</p></div><button class="btn" onclick="$('#logisticsDashboard').style.display='none';$('#logisticsMain').style.display='block'">← Voltar para separação</button></div>
    <div class="tablewrap"><table class="table"><thead><tr><th>Pedido</th><th>Cliente</th><th>Bairro</th><th>Operador/Vendedor</th></tr></thead><tbody>\${(o.em_rota||[]).map(x=>\`<tr><td>\${esc(x.numero)}</td><td>\${esc(x.nome_fantasia||x.razao_social)}</td><td>\${esc(x.bairro||'')}</td><td>\${esc(x.operador_nome||'')}</td></tr>\`).join('')||'<tr><td colspan="4">Nenhum pedido em rota.</td></tr>'}</tbody></table></div>
   </div>
  </div>`
);

// We must also wrap the logistics view to hide the main part when dashboard is active
a = a.replace(
  /<div class="panel"><div class="panel-title"><div><h3>Pedidos para carregamento e rota<\/h3>/,
  `<div class="panel" id="logisticsMain" style="padding-bottom:80px"><div class="panel-title"><div><h3>Pedidos para carregamento e rota</h3>`
);

// Replace makeRoute() with makeRouteModal()
a = a.replace(
  /async function makeRoute\(\)\{.*?catch\(e\)\{toast\(e\.message\)\}\}/s,
  `async function makeRouteModal(){
    const ids=[...document.querySelectorAll('.routeOrder:checked')].map(x=>x.value);
    if(!ids.length)return toast('Selecione os pedidos para roteirizar.');
    
    // Fetch all active drivers
    const driversReq = await api('/api/users');
    const allDrivers = driversReq.items.filter(x => x.role==='driver' && x.ativo===1);
    
    // Fetch active routes to filter out drivers already in a route
    const routesReq = await api('/api/logistics/routes');
    // A driver is busy if they have a route that is not CONCLUIDA. Actually routes api returns all active routes
    const busyDrivers = routesReq.items.filter(r => r.status !== 'CONCLUIDA').map(r => r.motorista_id);
    
    const availableDrivers = allDrivers.filter(d => !busyDrivers.includes(d.id));
    
    modal('Gerar Rota Logística', \`<form id="generateRouteForm" class="form">
      <div class="field"><label>Motorista (disponível)</label>
      <select name="motorista_id" required>
        \${availableDrivers.map(d=>\\\`<option value="\${d.id}">\${esc(d.nome)}</option>\\\`).join('')}
      </select></div>
      <div class="field" style="grid-column:1/-1">
        <p>Você selecionou <strong>\${ids.length}</strong> pedidos para esta rota.</p>
      </div>
      <div class="actions"><button class="btn primary">Confirmar e Gerar</button></div>
    </form>\`);
    
    $('#generateRouteForm').onsubmit=async e=>{
      e.preventDefault();
      try{
        await api('/api/logistics/routes',{method:'POST',body:JSON.stringify({
          motorista_id: new FormData(e.currentTarget).get('motorista_id'),
          pedido_ids: ids
        })});
        closeModal();
        toast('Rota gerada com sucesso!');
        show('logistics');
      } catch(ex){ toast(ex.message) }
    };
  }`
);

fs.writeFileSync('public/app.js', a);
console.log('files updated');
