function offlineOutboxKey(){return 'xv_outbox_'+(me?.id||'anonymous')}const API='';let token=localStorage.getItem('xv_token');let me=null;const $=s=>document.querySelector(s);function jsonArg(value){const bytes=new TextEncoder().encode(JSON.stringify(value));let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);return btoa(binary)}
function parseJsonArg(encoded){return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(encoded),c=>c.charCodeAt(0))))}
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));const brl=value=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number.isFinite(Number(value))?Number(value):0);const ROLE_LABELS={admin:'Administrador',seller:'Vendedor',cashier:'Caixa',driver:'Motorista',web_client:'Loja Online'};
async function api(path,opt={}){const method=opt.method||'GET';const reqId=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10);console.log(`[${reqId}] ${method} ${path}`);try{const r=await fetch(API+path,{...opt,headers:{'x-request-id':reqId,'content-type':'application/json',...(opt.headers||{}),...(token?{authorization:'Bearer '+token}:{})}});if(!r.ok){let e;try{e=await r.json()}catch{};if(r.status===401&&token&&!path.includes('/api/auth/login')){localStorage.removeItem('xv_token');token=null;location.href='/admin.html'}throw new Error(e?.error||`HTTP ${r.status}`)}const data=r.headers.get('content-type')?.includes('application/json')?await r.json():await r.blob();if(method==='GET'&&typeof data==='object')localStorage.setItem('xv_cache_'+(me?.id||'anonymous')+'_'+path,JSON.stringify(data));return data}catch(err){if(err.message==='Failed to fetch'||err.message.includes('NetworkError')||err.message.includes('fetch')||!navigator.onLine){if(method==='GET'){const c=localStorage.getItem('xv_cache_'+(me?.id||'anonymous')+'_'+path);if(c){setTimeout(()=>toast("Conexão instável. Exibindo dados locais do aparelho."),500);return JSON.parse(c)}throw new Error('Sem internet e sem dados no cache.')}else{const out=JSON.parse(localStorage.getItem(offlineOutboxKey())||'[]');out.push({path,opt,reqId});localStorage.setItem(offlineOutboxKey(),JSON.stringify(out));setTimeout(()=>toast("Sem sinal! Ação salva e será enviada quando a rede voltar."),500);return{success:true,item:{},offline:true}}}throw err}}
window.addEventListener('online', async()=>{const out=JSON.parse(localStorage.getItem(offlineOutboxKey())||'[]');if(!out.length)return;localStorage.removeItem(offlineOutboxKey());toast("Internet voltou! Sincronizando operações...");for(const r of out){try{await api(r.path,r.opt)}catch(e){console.error("Sync erro",e)}}toast("Sincronização offline concluída!")});
let _toastTimer=null;
function toast(m,isError=false){let t=$('#toast');if(!t){t=document.createElement('div');t.id='toast';t.className='toast';document.body.appendChild(t)}clearTimeout(_toastTimer);t.textContent=m;t.style.display='block';t.style.opacity='1';t.style.backgroundColor=isError?'#991b1b':'var(--xv-primary,#0f172a)';t.style.color='#fff';_toastTimer=setTimeout(()=>{t.style.opacity='0';setTimeout(()=>{t.style.display='none'},300)},2500)}

async function openRealtimeStream(){const response=await fetch('/api/events/ticket',{method:'POST',headers:{authorization:'Bearer '+token}});if(!response.ok){if(response.status===401||response.status===403)return null;throw new Error('Realtime temporariamente indisponivel')}const {ticket}=await response.json();return new EventSource('/api/events?ticket='+encodeURIComponent(ticket))}
const Realtime={
  bc:null,es:null,listeners:[],connecting:false,reconnectDelay:1000,
  openStream:openRealtimeStream,
  connectStream(){if(this.es||this.connecting)return;this.connecting=true;this.openStream().then(stream=>{if(!stream)return;this.es=stream;this.reconnectDelay=1000;stream.onmessage=e=>{try{const d=JSON.parse(e.data);this.dispatch(d.type,d.payload,'sse')}catch(err){}};stream.onerror=()=>{stream.close();if(this.es===stream)this.es=null;const delay=this.reconnectDelay;this.reconnectDelay=Math.min(30000,delay*2);setTimeout(()=>this.connectStream(),delay)}}).catch(()=>{const delay=this.reconnectDelay;this.reconnectDelay=Math.min(30000,delay*2);setTimeout(()=>this.connectStream(),delay)}).finally(()=>{this.connecting=false})},
  init(onMsg){
    if(onMsg)this.listeners.push(onMsg);
    if(!this.bc&&typeof BroadcastChannel!=='undefined'){
      try{
        this.bc=new BroadcastChannel('xv_erp_realtime');
        this.bc.onmessage=e=>{if(e?.data)this.dispatch(e.data.type,e.data.payload,'bc')};
      }catch(e){}
    }
    if(!this.es&&typeof EventSource!=='undefined'){
      try{
        this.connectStream();window.addEventListener('online',()=>this.connectStream());
        
      }catch(e){}
    }
    window.addEventListener('visibilitychange',()=>{if(!document.hidden)this.dispatch('tab_focused',{},'local')});
  },
  emit(type,payload={}){
    this.dispatch(type,payload,'local');
    try{this.bc?.postMessage({type,payload})}catch(e){}
  },
  dispatch(type,payload,source){
    for(const fn of this.listeners){try{fn(type,payload,source)}catch(e){console.error('Realtime err',e)}}
  }
};

let _refreshDebounce=null;
async function refreshCurrentViewSilently(eventType,payload){
  clearTimeout(_refreshDebounce);
  _refreshDebounce=setTimeout(async()=>{
    const currentView=location.hash.slice(1)||'home';
    const hasOpenModal=!!document.querySelector('#modal');
    try{
      if(currentView==='home'){
        const d=await api('/api/dashboard');
        window._dashboardData=d;
        if(typeof window.renderModalidadeRanking==='function') window.renderModalidadeRanking(window._currentModalidadePeriodo||'geral');
        const kpis=document.querySelectorAll('.card.kpi .v');
        const vals=[d.pedidosHoje,d.pendentes,d.separacao,d.rota,d.concluidos,brl(d.faturamento),d.produtos,d.criticos,d.clientes,d.vendedores];
        if(kpis.length===vals.length){
          kpis.forEach((el,idx)=>{
            const nextStr=String(vals[idx]);
            if(el.textContent!==nextStr){
              el.textContent=nextStr;
              el.classList.add('xv-flash-updated');
              setTimeout(()=>el.classList.remove('xv-flash-updated'),1000);
            }
          });
        }else{
          const v=$('#view');
          if(v&&!hasOpenModal)home(v);
        }
      }else if(currentView==='orders'){
        if(!eventType||eventType==='orders_changed'||eventType==='tab_focused'){
          const [res,usersRes]=await Promise.all([api('/api/orders'),api('/api/users').catch(()=>({items:[]}))]);
          window._ordersItems=Array.isArray(res.items)?res.items:[];
          if(usersRes?.items) window._sellerUsers=usersRes.items.filter(u=>u.role==='seller'&&u.ativo);
          if(window.currentOrdersStatus!==undefined&&window.currentOrdersStatus!==null){
            const sVal=$('#ordersSearch')?.value;
            const originVal=$('#ordersOriginFilter')?.value;
            renderOrdersList(window.currentOrdersStatus);
            if(sVal&&$('#ordersSearch')){$('#ordersSearch').value=sVal}
            if(originVal&&$('#ordersOriginFilter')){$('#ordersOriginFilter').value=originVal}
            filterTowerOrders();
          }else if(window._ordersOrigin==='VENDEDOR'&&window._selectedSellerForOrders){
            renderOrdersList(null);
            filterTowerOrders();
          }else{
            const mainOriginVal=$('#ordersMainOriginFilter')?.value;
            renderOrdersDashboard();
            if(mainOriginVal&&$('#ordersMainOriginFilter')){$('#ordersMainOriginFilter').value=mainOriginVal;onMainOrdersOriginFilter(mainOriginVal)}
          }
        }
      }else if(currentView==='products'){
        if(!eventType||eventType==='products_changed'||eventType==='stock_changed'||eventType==='tab_focused'){
          const [p,c,promo]=await Promise.all([api('/api/products?limit=100000'),api('/api/categories'),api('/api/promotions')]);
          window.adminProducts=p;window.adminCategories=c;window.catalogCategories=c.categorias;window.catalogSubcategories=c.subcategorias;window.adminPromotions=promo;
          if(!hasOpenModal){
            const pqVal=$('#pq')?.value,catVal=$('#catFilter')?.value,subVal=$('#subFilter')?.value;
            const v=$('#view');
            if(v)renderAdminCatalog(v);
            if(pqVal&&$('#pq'))$('#pq').value=pqVal;
            if(catVal&&$('#catFilter'))$('#catFilter').value=catVal;
            if(subVal&&$('#subFilter'))$('#subFilter').value=subVal;
            if(pqVal||catVal||subVal)catalogFilter();
          }
        }
      }else if(currentView==='stock'){
        if(!eventType||eventType==='stock_changed'||eventType==='products_changed'||eventType==='tab_focused'){
          const x=await api('/api/stock?limit=100000');
          if(!hasOpenModal){
            const searchVal=$('#stockSearch')?.value;
            const tbody=$('#stockTable tbody');
            if(tbody){
              tbody.innerHTML=x.items.map(stockRow).join('');
              const kpis=document.querySelector('.stock-kpis');
              if(kpis)kpis.innerHTML=`<span><b>${x.total}</b> itens</span><span><b>${x.items.filter(i=>i.status==='CRITICO').length}</b> críticos</span><span><b>${x.items.reduce((a,i)=>a+Number(i.quantidade_reservada),0)}</b> reservados</span>`;
              if(searchVal&&$('#stockSearch')){$('#stockSearch').value=searchVal;stockFilter($('#stockSearch'))}
            }else{
              const v=$('#view');if(v)stock(v);
            }
          }
        }
      }else if(currentView==='clients'){
        if(!eventType||eventType==='clients_changed'||eventType==='tab_focused'){
          const c=await api('/api/clients');
          window._clientsData=c.items;
          if(typeof window.renderClientsUI==='function')window.renderClientsUI();
        }
      }else if(currentView==='logistics'){
        if(!eventType||eventType==='routes_changed'||eventType==='orders_changed'||eventType==='tab_focused'){
          const v=$('#view');
          if(v&&!hasOpenModal&&document.getElementById('logisticsMain')?.style.display!=='none')logistics(v);
        }
      }else if(currentView==='prices'){
        if(!eventType||eventType==='prices_changed'||eventType==='tab_focused'){
          const v=$('#view');if(v&&!hasOpenModal)prices(v);
        }
      }else if(currentView==='users'){
        if(!eventType||eventType==='users_changed'||eventType==='tab_focused'){
          const v=$('#view');if(v&&!hasOpenModal)users(v);
        }
      }else if(currentView==='suppliers'){
        if(!eventType||eventType==='suppliers_changed'||eventType==='tab_focused'){
          const v=$('#view');if(v&&!hasOpenModal)suppliers(v);
        }
      }else if(currentView==='inbound'){
        if(!eventType||eventType==='purchases_changed'||eventType==='stock_changed'||eventType==='tab_focused'){
          const v=$('#view');if(v&&!hasOpenModal)inbound(v);
        }
      }
    }catch(err){console.warn('Silent refresh error:',err)}
  },120);
}
async function login(e){e.preventDefault();try{const b=Object.fromEntries(new FormData(e.currentTarget));const x=await api('/api/auth/login',{method:'POST',body:JSON.stringify(b)});token=x.token;localStorage.setItem('xv_token',token);location.reload()}catch(err){toast(err.message)}}
async function downloadAuthFile(url,filename){try{const reqId=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10);console.log(`[${reqId}] GET ${url}`);const r=await fetch(url,{headers:{'x-request-id':reqId,...(token?{authorization:'Bearer '+token}:{})}});if(!r.ok)throw new Error('Não foi possível abrir o documento');const b=await r.blob();const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=filename||'documento.pdf';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}catch(e){alert(e.message)}}
async function downloadAuthPost(url,body,filename){try{const reqId=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10);console.log(`[${reqId}] POST ${url}`);const r=await fetch(url,{method:'POST',headers:{'x-request-id':reqId,'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},body:JSON.stringify(body)});if(!r.ok)throw new Error('Não foi possível gerar o documento');const b=await r.blob();const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=filename||'documento.pdf';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}catch(e){alert(e.message)}}
function logout(){localStorage.removeItem('xv_token');location.href='/admin.html'}
async function boot(){
  if(!token){try{const st=await fetch('/api/setup/status',{cache:'no-store'}).then(r=>r.json());if(st.required)return setupPage(st)}catch{}return roleLoginPage('Administrador Geral')}
  try{const m=await api('/api/me');me=m.user;if(me.role!=='admin'){const map={seller:'/vendedor.html',cashier:'/pdv.html',driver:'/motorista.html',web_client:'/loja.html'};localStorage.removeItem('xv_token');alert('A Torre de Controle é de uso exclusivo para o Administrador Geral. Você será redirecionado para o login.');return location.href='/admin.html'}render()}catch{logout()}
}
function setupPage(status){const q=new URLSearchParams(location.search);const setupToken=q.get('setup')||'';document.body.innerHTML=`<div class="login"><div class="loginbox"><div class="brand">Xiquim <span>Vargas</span></div><h1>Primeiro acesso</h1><p style="color:var(--muted)">Este ERP ainda não foi configurado. Crie agora o administrador principal. Não existe uma senha fixa de fábrica.</p>${setupToken?`<form id="setupForm"><div class="field"><label>Nome do administrador</label><input name="nome" required maxlength="180"></div><br><div class="field"><label>E-mail</label><input name="email" type="email" required autocomplete="email"></div><br><div class="field"><label>Senha</label><div style="display:flex;gap:6px"><input name="password" type="password" minlength="10" required autocomplete="new-password" style="flex:1"><button type="button" class="btn" tabindex="-1" onclick="const x=this.previousElementSibling; x.type=x.type==='password'?'text':'password'">👁</button></div><small style="display:block;margin-top:6px;color:var(--muted)">Use pelo menos 10 caracteres.</small></div><br><button class="btn primary" style="width:100%">Criar administrador e entrar</button></form>`:`<div class="panel" style="margin-top:18px"><strong>Configuração inicial protegida</strong><p style="color:var(--muted)">Abra o link de primeiro acesso exibido nos logs do serviço no Render. Esse link é criado uma única vez e deixa de funcionar depois que o administrador é criado.</p></div>`}<div id="toast" class="toast"></div></div></div>`;if(setupToken){$('#setupForm').onsubmit=async e=>{e.preventDefault();const b=Object.fromEntries(new FormData(e.currentTarget));b.setup_token=setupToken;try{const x=await fetch('/api/setup/initialize',{method:'POST',headers:{'content-type':'application/json','x-setup-token':setupToken},body:JSON.stringify(b)});const out=await x.json();if(!x.ok)throw new Error(out.error||'Não foi possível concluir a configuração');token=out.token;localStorage.setItem('xv_token',token);history.replaceState({},'', '/admin');location.reload()}catch(err){toast(err.message)}}}}

const menu=[['Visão Geral','home'],['Catálogo','products'],['Tabelas de preço','prices'],['Estoque Inteligente','stock'],['Clientes & CRM','clients'],['Pedidos','orders'],['Logística','logistics'],['Fornecedores','suppliers'],['Recebimento','inbound'],['Vendedores','sellers'],['Relatórios','reports'],['Auditoria','audit'],['Usuários','users'],['IA Administrativa','ai']];
function shell(){const dot='•';const groups=[['Operação',[[dot,'Visão Geral','home'],[dot,'Pedidos','orders'],[dot,'Catálogo','products'],[dot,'Loja Online','store'],[dot,'Estoque Inteligente','stock'],[dot,'Clientes & CRM','clients'],[dot,'Logística','logistics']]],['Suprimentos',[[dot,'Fornecedores','suppliers'],[dot,'Recebimento de Mercadorias','inbound']]],['Gestão',[[dot,'Vendedores','sellers'],[dot,'Usuários','users'],[dot,'Tabelas de preço','prices'],[dot,'Relatórios','reports']]],['Governança',[[dot,'Auditoria','audit'],[dot,'IA Administrativa','ai']]]];return `<div class="app"><aside class="sidebar"><img class="xv-logo" src="/assets/brand/logo-admin.jpg" alt="Xiquim Vargas ERP"><div class="group">Torre de Controle</div>${groups.map(([title,items])=>`<div class="group">${title}</div><div class="nav">${items.map(([i,l,k])=>`<button data-view="${k}"><span style="width:16px;text-align:center;font-size:16px;line-height:1;display:inline-block">${i}</span>${l}</button>`).join('')}</div>`).join('')}<div class="group">Sessão</div><div class="nav"><button onclick="logout()"><span style="width:16px;text-align:center;font-size:16px;line-height:1;display:inline-block">•</span>Sair</button></div></aside><main class="main"><div class="topbar"><div class="brand-dark"><button class="mobile-back-btn btn" onclick="window.showSidebar()">← Voltar</button><div><h1 id="title">Visão Geral</h1></div></div><div class="topbar-actions"><span class="badge">${esc(ROLE_LABELS[me?.role]||me?.role||'Administrador')}</span></div></div><div id="view"></div></main></div><div id="toast" class="toast"></div>`}
async function render(){if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});Realtime.init((type,payload)=>refreshCurrentViewSilently(type,payload));document.body.innerHTML=shell();window.showSidebar=()=>document.querySelector('.app').classList.remove('view-open');document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{document.querySelector('.app').classList.add('view-open');show(b.dataset.view)});const h=location.hash.slice(1);if(h&&window.innerWidth<=800)document.querySelector('.app').classList.add('view-open');await show(h||'home')}
async function show(view){document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));$('#title').textContent=({home:'Visão Geral',products:'Catálogo',stock:'Estoque Inteligente',clients:'Clientes & CRM',orders:'Pedidos',users:'Usuários',sellers:'Vendedores',logistics:'Logística',suppliers:'Fornecedores',inbound:'Recebimento de Mercadorias',reports:'Relatórios',store:'Loja Online',audit:'Auditoria',prices:'Tabelas de preço',ai:'IA Administrativa'})[view]||view;location.hash=view;const v=$('#view');v.innerHTML='<div class="panel">Carregando...</div>';try{if(view==='home')return home(v);if(view==='products')return products(v);if(view==='prices')return prices(v);if(view==='store')return storeSettings(v);if(view==='stock')return stock(v);if(view==='clients')return clients(v);if(view==='orders')return orders(v);if(view==='users')return users(v);if(view==='sellers')return sellers(v);if(view==='logistics')return logistics(v);if(view==='suppliers')return suppliers(v);if(view==='inbound')return inbound(v);if(view==='reports')return reports(v);if(view==='audit')return auditView(v);if(view==='ai')return ai(v)}catch(e){v.innerHTML=`<div class="panel">Erro: ${esc(e.message)}</div>`}}
async function home(v){const d=await api('/api/dashboard');window._dashboardData=d;const cards=[['🛍','Pedidos hoje',d.pedidosHoje],['●','Pendentes',d.pendentes],['●','Separação',d.separacao],['🚚','Em rota',d.rota],['✓','Concluídos',d.concluidos],['R$','Faturamento',`${brl(d.faturamento)}`],['▪','Produtos',d.produtos],['!','Estoque baixo',d.criticos],['♣','Clientes',d.clientes],['♣','Vendedores',d.vendedores]];const kan=[['PENDENTE',d.pendentes,'status-pendente'],['SEPARACAO',d.separacao,'status-separacao'],['ROTA',d.rota,'status-rota'],['CONCLUIDO',d.concluidos,'status-concluido']];const top=d.topProdutos||[];const chunked=[];for(let i=0;i<top.length;i+=5)chunked.push(top.slice(i,i+5));const topKanbanHtml=chunked.length?`<div class="panel" style="margin-top:16px"><div class="panel-title"><h3>Top 20 Produtos Mais Vendidos</h3></div><div class="kanban">${chunked.map((chunk,idx)=>`<div class="kanban-col"><div class="kanban-head"><span><span class="dot" style="background:var(--xv-orange)"></span>Top ${idx*5+1} ao ${idx*5+chunk.length}</span><span class="badge">${chunk.length}</span></div>${chunk.map((p,i)=>`<div class="kanban-card" style="display:flex;gap:12px;align-items:center"><div class="catalog-product-cell">${p.foto_url?`<img class="catalog-mini-photo" src="${esc(p.foto_url)}" alt="">`:'<div class="catalog-mini-photo placeholder">XV</div>'}</div><div><strong>#${idx*5+i+1} - ${esc(p.nome)}</strong><br><small class="muted">${p.total_vendido} un vendidas</small><br><small class="orange">${brl(p.total_receita)}</small></div></div>`).join('')}</div>`).join('')}</div></div>`:'';window.renderModalidadeRanking=function(periodo='geral'){window._currentModalidadePeriodo=periodo;const db=window._dashboardData||d;const periodosMap=db.vendasPorOrigemPeriodos||{geral:db.vendasPorOrigem||[],semanal:[],mensal:[]};const rawList=periodosMap[periodo]||db.vendasPorOrigem||[];const originLabels={VENDEDOR:'Vendedor Externo',BALCAO:'Frente de Loja / Caixa',WEB:'Loja Online'};const originIcons={VENDEDOR:'👤',BALCAO:'🏪',WEB:'🛒'};const originColors={VENDEDOR:'var(--xv-orange)',BALCAO:'#4a90e2',WEB:'#2ecc71'};const originsData=rawList.reduce((acc,x)=>({...acc,[x.origem]:x}),{});const origensList=['VENDEDOR','BALCAO','WEB'].map(o=>({origem:o,label:originLabels[o],icon:originIcons[o],color:originColors[o],pedidos:Number(originsData[o]?.pedidos||0),faturamento:Number(originsData[o]?.faturamento||0)})).sort((a,b)=>b.faturamento-a.faturamento);const rankBadges=['🥇 1º Lugar','🥈 2º Lugar','🥉 3º Lugar'];const pLabels={geral:'Todo o histórico',semanal:'Últimos 7 dias',mensal:'Últimos 30 dias'};const el=document.getElementById('modalidadeRankingContainer');if(!el)return;el.innerHTML=`<div class="panel-title" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px"><div><h3 style="margin:0">Ranking de Vendas por Modalidade</h3><p class="muted" style="margin:4px 0 0;font-size:12px">Período selecionado: <strong>${pLabels[periodo]||periodo}</strong></p></div><div class="actions" style="display:flex;gap:6px"><button class="btn ${periodo==='geral'?'primary':''}" style="font-size:12px;padding:6px 12px" onclick="renderModalidadeRanking('geral')">Geral</button><button class="btn ${periodo==='semanal'?'primary':''}" style="font-size:12px;padding:6px 12px" onclick="renderModalidadeRanking('semanal')">Semanal (7d)</button><button class="btn ${periodo==='mensal'?'primary':''}" style="font-size:12px;padding:6px 12px" onclick="renderModalidadeRanking('mensal')">Mensal (30d)</button></div></div><div class="kanban" style="margin-top:14px">${origensList.map((x,idx)=>`<div class="kanban-col"><div class="kanban-head"><span><span class="dot" style="background:${x.color}"></span>${x.label}</span><span class="badge" style="background:${idx===0?'rgba(253,94,2,0.18)':''};color:${idx===0?'#fd5e02':''}">${rankBadges[idx]}</span></div><div class="kanban-card" style="text-align:center;padding:22px;border:1px solid ${idx===0?'rgba(253,94,2,0.3)':'var(--border)'}"><div style="font-size:30px;margin-bottom:6px">${x.icon}</div><div class="v" style="font-size:22px;color:${x.color};font-weight:800">${brl(x.faturamento)}</div><div style="margin-top:8px"><span class="badge" style="font-size:11px">${x.pedidos} pedido(s)</span></div><small class="muted" style="display:block;margin-top:8px">${x.faturamento>0?`${brl(x.pedidos?x.faturamento/x.pedidos:0)} ticket médio`:'Sem vendas no período'}</small></div></div>`).join('')}</div>`};v.innerHTML=`<div class="grid">${cards.map(x=>`<div class="card kpi"><div style="font-size:16px;color:#8193a9;margin-bottom:7px">${x[0]} &nbsp; ${x[1]}</div><div class="v">${x[2]}</div></div>`).join('')}</div><div class="panel" style="margin-top:16px"><div class="panel-title"><h3>Fluxo operacional</h3><button class="btn" onclick="show('orders')">Ver pedidos</button></div><div class="kanban">${kan.map(k=>`<div class="kanban-col"><div class="kanban-head"><span><span class="dot"></span>${k[0]}</span><span class="badge">${k[1]}</span></div><div class="kanban-card"><strong>${k[1]} pedido(s)</strong><small>Monitorado em tempo real pela Torre de Controle</small></div></div>`).join('')}</div></div><div class="panel" id="modalidadeRankingContainer" style="margin-top:16px"></div>${topKanbanHtml}`;window.renderModalidadeRanking(window._currentModalidadePeriodo||'geral')}
async function products(v){const [p,c,promo]=await Promise.all([api('/api/products?limit=100000'),api('/api/categories'),api('/api/promotions')]);window.adminProducts=p;window.adminCategories=c;window.catalogCategories=c.categorias;window.catalogSubcategories=c.subcategorias;window.adminPromotions=promo;renderAdminCatalog(v)}
function renderAdminCatalogToolbar(){const cats=window.adminCategories?.categorias||[];const subs=window.adminCategories?.subcategorias||[];return `<div class="panel catalog-toolbar"><div class="actions"><input id="pq" class="search" placeholder="Pesquisar por nome, SKU ou código de barras" oninput="catalogFilter(this)"><button class="btn primary" onclick="newProduct()">+ Produto</button><button class="btn" onclick="newCategory()">+ Categoria</button><button class="btn" onclick="newSubcategory()">+ Subcategoria</button><button class="btn" onclick="exportCatalogPdf()">⇩ PDF do catálogo</button></div><div class="catalog-filters"><select id="catFilter" class="field-input" onchange="catalogFilter()"><option value="">Todas as categorias</option>${cats.map(x=>`<option value="${x.id}">${esc(x.nome)}</option>`).join('')}</select><select id="subFilter" class="field-input" onchange="catalogFilter()"><option value="">Todas as subcategorias</option>${subs.map(x=>`<option value="${x.id}">${esc(x.nome)}</option>`).join('')}</select></div></div>`}
function renderAdminCatalog(v){const p=window.adminProducts;const c=window.adminCategories;const promo=window.adminPromotions;const cats=c.categorias;const catCards=cats.length?`<div class="grid" style="margin-top:14px;margin-bottom:24px;">${cats.map(cat=>`<div class="card" style="cursor:pointer" onclick="adminSubcategorias('${cat.id}')"><h3>${esc(cat.nome)}</h3><p class="muted">${esc(cat.descricao||'')}</p></div>`).join('')}</div>`:'';v.innerHTML=`${renderAdminCatalogToolbar()}<div class="catalog-summary"><span><b>${p.total}</b> produtos ativos</span><span><b>${cats.length}</b> categorias</span><span><b>${c.subcategorias.length}</b> subdivisões</span><span><b>${promo.items.length}</b> promoções ativas</span></div><div class="panel-title" style="margin-top:16px;"><h2>Categorias</h2></div>${catCards}<div class="panel-title" style="margin-top:24px;"><h2>Todos os Produtos</h2></div><div id="catalogTable" class="tablewrap"><table class="table"><thead><tr><th>Produto</th><th>SKU</th><th>Categoria</th><th>Subcategoria</th><th>Preço</th><th>Promoção</th><th>Ações</th></tr></thead><tbody>${p.items.map(x=>catalogRow(x)).join('')}</tbody></table></div><div class="panel category-panel" style="margin-top:24px"><div class="panel-title"><h3>Estrutura do catálogo</h3><span class="badge">Editável pela Torre</span></div><div class="category-tree">${cats.map(cat=>`<div class="category-node"><div><strong>${esc(cat.nome)}</strong><small>${esc(cat.descricao||'Sem descrição')}</small></div><div class="category-actions"><button class="btn" onclick="editCategory(parseJsonArg('${jsonArg(cat)}'))">Editar</button><span>${c.subcategorias.filter(s=>s.categoria_id===cat.id).map(s=>esc(s.nome)).join(' · ')||'Sem subdivisões'}</span></div></div>`).join('')}</div></div>`}
function adminSubcategorias(catId){const v=$('#view');const cat=window.adminCategories.categorias.find(c=>c.id===catId);const subs=window.adminCategories.subcategorias.filter(s=>s.categoria_id===catId);v.innerHTML=`${renderAdminCatalogToolbar()}<div class="mobile-nav" style="margin-bottom:14px"><button class="btn" onclick="renderAdminCatalog(document.getElementById('view'))">← Voltar</button></div><div class="panel-title"><h2>Subcategorias de ${esc(cat?.nome||'')}</h2></div><div class="grid" style="margin-top:14px;margin-bottom:24px;">${subs.length?subs.map(s=>`<div class="card" style="cursor:pointer" onclick="adminProdutosSub('${s.id}','${esc(s.nome).replace(/'/g,"\\'").replace(/"/g,"&quot;")}')"><h3>${esc(s.nome)}</h3></div>`).join(''):'<p class="muted">Nenhuma subcategoria encontrada.</p>'}</div>`}
function adminProdutosSub(subId,subName){const v=$('#view');window.adminCurrentSubId=subId;const p=window.adminProducts;v.innerHTML=`${renderAdminCatalogToolbar()}<div class="mobile-nav" style="margin-bottom:14px"><button class="btn" onclick="renderAdminCatalog(document.getElementById('view'))">← Catálogo Inicial</button></div><div class="panel-title"><h2>${esc(subName)}</h2></div><div class="form" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px;"><div class="field"><label>Menor preço</label><input type="number" step="0.01" id="adminSubMin" class="search" placeholder="R$ 0,00" oninput="catalogFilter()"></div><div class="field"><label>Maior preço</label><input type="number" step="0.01" id="adminSubMax" class="search" placeholder="Sem limite" oninput="catalogFilter()"></div></div><div id="catalogTable" class="tablewrap"><table class="table"><thead><tr><th>Produto</th><th>SKU</th><th>Categoria</th><th>Subcategoria</th><th>Preço</th><th>Promoção</th><th>Ações</th></tr></thead><tbody>${p.items.map(x=>catalogRow(x)).join('')}</tbody></table></div>`;catalogFilter()}
function catalogRow(x){return `<tr data-product="${x.id}" data-cat="${x.categoria_id||''}" data-sub="${x.subcategoria_id||''}" data-price="${x.promocao_preco!=null?Number(x.promocao_preco):Number(x.preco_base)}"><td><div class="catalog-product-cell">${x.foto_url?`<img class="catalog-mini-photo" src="${esc(x.foto_url)}" alt="" onerror="this.onerror=null;this.replaceWith(Object.assign(document.createElement('div'),{className:'catalog-mini-photo placeholder',textContent:'XV'}))">`:'<div class="catalog-mini-photo placeholder">XV</div>'}<div><strong>${esc(x.nome)}</strong>${Number(x.esgotado)?' <span class="badge" style="background:#fde2e2;color:#b42318;border-color:#f5b5b5">ESGOTADO</span>':''}<br><small>${esc([x.marca,x.sabor,x.tamanho].filter(Boolean).join(' · '))}</small></div></div></td><td>${esc(x.sku)}</td><td>${esc(x.categoria_nome||'-')}</td><td>${esc(x.subcategoria_nome||'-')}</td><td>${brl(x.preco_base)}</td><td>${x.promocao_preco!=null?`<strong class="orange">${brl(x.promocao_preco)}</strong>`:'—'}</td><td><button class="btn" onclick="editProduct(parseJsonArg('${jsonArg(x)}'))">Editar</button> <button class="btn" onclick="manageProductImages(parseJsonArg('${jsonArg(x)}'))">Fotos</button> <button class="btn" onclick="managePromotion(parseJsonArg('${jsonArg(x)}'))">Promoção</button> <button class="btn" onclick="productSuppliersModal('${x.id}',parseJsonArg('${jsonArg(x.nome)}'))">🏢 Fornecedores</button> <button class="btn" onclick="toggleSoldOut('${x.id}',${Number(x.esgotado)?0:1})">${Number(x.esgotado)?'✔ Disponível':'⊘ Esgotado'}</button> <button class="btn" style="color:#b42318" onclick="deleteProduct('${x.id}',parseJsonArg('${jsonArg(x.nome)}'))">🗑 Excluir</button></td></tr>`}
async function toggleSoldOut(id,flag){
  const row=document.querySelector(`tr[data-product="${id}"]`);
  const btn=row?.querySelector(`button[onclick*="toggleSoldOut('${id}'"]`);
  const nameStrong=row?.querySelector('td:first-child strong');
  if(btn){
    btn.textContent=flag?'✔ Disponível':'⊘ Esgotado';
    btn.setAttribute('onclick',`toggleSoldOut('${id}',${flag?0:1})`);
  }
  let badge=row?.querySelector('.badge-sold-out')||row?.querySelector('span.badge[style*="fde2e2"]');
  if(flag){
    if(!badge&&nameStrong){
      nameStrong.insertAdjacentHTML('afterend',' <span class="badge badge-sold-out" style="background:#fde2e2;color:#b42318;border-color:#f5b5b5">ESGOTADO</span>');
    }
  }else{
    if(badge)badge.remove();
  }
  if(row){
    row.classList.add('xv-flash-updated');
    setTimeout(()=>row.classList.remove('xv-flash-updated'),900);
  }
  const prod=(window.adminProducts?.items||[]).find(p=>p.id===id);
  if(prod)prod.esgotado=flag?1:0;
  toast(flag?'Produto marcado como esgotado':'Produto disponível novamente');
  Realtime.emit('products_changed',{id,esgotado:!!flag});
  try{await api('/api/products/'+id+'/sold-out',{method:'POST',body:JSON.stringify({esgotado:!!flag})})}catch(e){toast(e.message,true);refreshCurrentViewSilently('products_changed')}
}
async function deleteProduct(id,nome){
  if(!confirm(`Excluir o produto "${nome}" do catálogo?\n\nEle deixa de aparecer na loja, PDV e vendedor. O histórico de pedidos é preservado.`))return;
  const row=document.querySelector(`tr[data-product="${id}"]`);
  if(row){
    row.style.transition='all 0.25s ease';row.style.opacity='0';row.style.transform='scale(0.95)';
    setTimeout(()=>row.remove(),250);
  }
  if(window.adminProducts?.items){
    window.adminProducts.items=window.adminProducts.items.filter(p=>p.id!==id);
    window.adminProducts.total=Math.max(0,(window.adminProducts.total||1)-1);
    const sumEl=document.querySelector('.catalog-summary b');if(sumEl)sumEl.textContent=window.adminProducts.total;
  }
  toast(`Produto "${nome}" excluído do catálogo`);
  Realtime.emit('products_changed',{id,deleted:true});
  try{await api('/api/products/'+id,{method:'DELETE'})}catch(e){toast(e.message,true);refreshCurrentViewSilently('products_changed')}
}
function catalogFilter(input){const q=(input?.value??$('#pq')?.value??'').toLowerCase();const isSubView=!!document.getElementById('adminSubMin');let cat='';let sub='';let min=0;let max=Infinity;if(isSubView){sub=window.adminCurrentSubId;min=Number($('#adminSubMin')?.value)||0;const maxRaw=$('#adminSubMax')?.value;max=maxRaw?Number(maxRaw):Infinity;}else{cat=$('#catFilter')?.value||'';sub=$('#subFilter')?.value||'';}document.querySelectorAll('#catalogTable tbody tr').forEach(r=>{const okText=r.innerText.toLowerCase().includes(q);const okCat=!cat||r.dataset.cat===cat;const okSub=!sub||r.dataset.sub===sub;const price=Number(r.dataset.price||0);const okPrice=(price>=min&&price<=max);r.style.display=okText&&okCat&&okSub&&okPrice?'':'none'})}
function productFormHtml(x={}){const cats=window.catalogCategories||[],subs=window.catalogSubcategories||[];return `<form id="productForm" class="form"><div class="field"><label>Nome</label><input name="nome" required maxlength="180" value="${esc(x.nome||'')}"></div><div class="field"><label>SKU (opcional)</label><input name="sku" maxlength="80" value="${esc(x.sku||'')}"></div><div class="field"><label>Código de barras</label><input name="codigo_barras" value="${esc(x.codigo_barras||'')}"></div><div class="field"><label>Marca</label><input name="marca" value="${esc(x.marca||'')}"></div><div class="field"><label>Sabor</label><input name="sabor" value="${esc(x.sabor||'')}"></div><div class="field"><label>Tamanho</label><input name="tamanho" value="${esc(x.tamanho||'')}"></div><div class="field"><label>Unidade</label><input name="unidade" value="${esc(x.unidade||'UN')}"></div><div class="field"><label>Categoria</label><select id="productCat" name="categoria_id"><option value="">Sem categoria</option>${cats.map(c=>`<option value="${c.id}" ${c.id===x.categoria_id?'selected':''}>${esc(c.nome)}</option>`).join('')}</select></div><div class="field"><label>Subcategoria</label><select id="productSub" name="subcategoria_id"><option value="">Sem subcategoria</option>${subs.map(z=>`<option data-cat="${z.categoria_id}" value="${z.id}" ${z.id===x.subcategoria_id?'selected':''}>${esc(z.nome)}</option>`).join('')}</select></div><div class="field"><label>Preço base</label><input name="preco_base" type="number" min="0" step="0.01" value="${Number(x.preco_base||0)}"></div><div class="field" style="grid-column:1/-1"><label>Descrição</label><textarea name="descricao" rows="4">${esc(x.descricao||'')}</textarea></div><div class="field" style="grid-column:1/-1"><small class="muted">Estoque é administrado exclusivamente no módulo Estoque Inteligente. Catálogo não altera saldo.</small></div><div class="actions"><button class="btn primary">Salvar produto</button></div></form>`}
function newProduct(){modal('Novo produto',productFormHtml());$('#productCat').onchange=()=>filterSubOptions($('#productCat').value);filterSubOptions('');$('#productForm').onsubmit=async e=>{e.preventDefault();try{const x=await api('/api/products',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(e.currentTarget)))});closeModal();toast('Produto criado. Estoque inicial permanece zero até lançamento no módulo Estoque.');show('products')}catch(x){toast(x.message)}}}
function filterSubOptions(cat){document.querySelectorAll('#productSub option[data-cat]').forEach(o=>o.hidden=!!cat&&o.dataset.cat!==cat);if($('#productSub')?.selectedOptions[0]?.hidden)$('#productSub').value=''}
function editProduct(x){modal('Editar produto',productFormHtml(x));$('#productCat').onchange=()=>filterSubOptions($('#productCat').value);filterSubOptions(x.categoria_id||'');$('#productForm').onsubmit=async e=>{e.preventDefault();try{await api('/api/products/'+x.id,{method:'PUT',body:JSON.stringify(Object.fromEntries(new FormData(e.currentTarget)))});closeModal();toast('Produto atualizado sem alterar o estoque');show('products')}catch(z){toast(z.message)}}}
function manageProductImages(x){modal('Fotos do produto',`<div class="photo-manager"><div class="photo-upload"><label class="btn primary photo-picker">+ Adicionar foto <input id="productPhotoInput" type="file" accept="image/png,image/jpeg,image/webp" hidden></label><span class="muted">Até 8 MB por imagem. As fotos ficam no armazenamento do ERP; não é necessário URL.</span></div><div id="productPhotos" class="photo-grid">Carregando…</div></div>`);loadProductImages(x.id);$('#productPhotoInput').onchange=async e=>{const f=e.target.files?.[0];if(!f)return;if(f.size>8*1024*1024)return toast('A imagem excede 8 MB');const r=new FileReader();r.onload=async()=>{try{await api('/api/products/'+x.id+'/images',{method:'POST',body:JSON.stringify({data_url:r.result})});toast('Foto armazenada');loadProductImages(x.id)}catch(z){toast(z.message)}};r.readAsDataURL(f)}}
async function loadProductImages(id){try{const x=await api('/api/products/'+id+'/images');$('#productPhotos').innerHTML=x.items.length?x.items.map(i=>`<div class="photo-item"><img src="${i.url}" alt=""><div><span class="badge">${i.principal?'Principal':'Foto'}</span><button class="btn danger" onclick="deleteProductImage('${i.id}',${id?`'${id}'`:'null'})">Excluir</button></div></div>`).join(''):'<div class="empty-state">Nenhuma foto cadastrada.</div>'}catch(e){$('#productPhotos').textContent=e.message}}
async function deleteProductImage(imageId,productId){if(!confirm('Excluir esta foto?'))return;try{await api('/api/product-images/'+imageId,{method:'DELETE'});toast('Foto excluída');loadProductImages(productId);show('products')}catch(e){toast(e.message)}}
function managePromotion(x){modal('Promoção — '+esc(x.nome),`<form id="promoForm" class="form"><div class="field"><label>Nome da promoção</label><input name="nome" value="${esc(x.promocao_nome||'Oferta especial')}" required></div><div class="field"><label>Preço promocional</label><input name="preco_promocional" type="number" min="0" step="0.01" required value="${x.promocao_preco!=null?Number(x.promocao_preco):''}"></div><div class="field"><label>Início</label><input name="inicio" type="datetime-local"></div><div class="field"><label>Término</label><input name="termino" type="datetime-local"></div><div class="actions"><button class="btn primary">Publicar promoção</button></div></form><div class="panel"><p class="muted">A promoção altera o preço exibido/comercializado no catálogo e loja, sem alterar estoque.</p></div>`);$('#promoForm').onsubmit=async e=>{e.preventDefault();try{await api('/api/products/'+x.id+'/promotions',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(e.currentTarget)))});closeModal();toast('Promoção publicada');show('products')}catch(z){toast(z.message)}}}
function exportCatalogPdf(){downloadAuthFile('/api/admin/export/catalog.pdf','xiquim-vargas-catalogo.pdf')}
function newCategory(){modal('Nova categoria',`<form id="categoryForm" class="form"><div class="field"><label>Nome</label><input name="nome" required maxlength="120"></div><div class="field"><label>Slug (opcional)</label><input name="slug"></div><div class="field" style="grid-column:1/-1"><label>Descrição</label><textarea name="descricao"></textarea></div><div class="actions"><button class="btn primary">Criar categoria</button></div></form>`);$('#categoryForm').onsubmit=async e=>{e.preventDefault();try{await api('/api/categories',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(e.currentTarget)))});closeModal();toast('Categoria criada');show('products')}catch(x){toast(x.message)}}}
function editCategory(x){modal('Editar categoria',`<form id="categoryForm" class="form"><div class="field"><label>Nome</label><input name="nome" value="${esc(x.nome)}" required></div><div class="field"><label>Slug</label><input name="slug" value="${esc(x.slug)}"></div><div class="field"><label>Ordem</label><input name="ordem" type="number" value="${x.ordem||0}"></div><div class="field"><label>Status</label><select name="ativo"><option value="1" ${x.ativo?'selected':''}>Ativa</option><option value="0" ${!x.ativo?'selected':''}>Inativa</option></select></div><div class="field" style="grid-column:1/-1"><label>Descrição</label><textarea name="descricao">${esc(x.descricao||'')}</textarea></div><div class="actions"><button class="btn primary">Salvar categoria</button></div></form>`);$('#categoryForm').onsubmit=async e=>{e.preventDefault();try{await api('/api/categories/'+x.id,{method:'PUT',body:JSON.stringify(Object.fromEntries(new FormData(e.currentTarget)))});closeModal();toast('Categoria atualizada');show('products')}catch(z){toast(z.message)}}}
function newSubcategory(){const cats=window.catalogCategories||[];modal('Nova subcategoria',`<form id="subForm" class="form"><div class="field"><label>Categoria</label><select name="categoria_id" required>${cats.map(x=>`<option value="${x.id}">${esc(x.nome)}</option>`).join('')}</select></div><div class="field"><label>Nome</label><input name="nome" required maxlength="120"></div><div class="field"><label>Slug (opcional)</label><input name="slug"></div><div class="actions"><button class="btn primary">Criar subcategoria</button></div></form>`);$('#subForm').onsubmit=async e=>{e.preventDefault();try{await api('/api/subcategories',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(e.currentTarget)))});closeModal();toast('Subcategoria criada');show('products')}catch(x){toast(x.message)}}}
async function stock(v){const x=await api('/api/stock?limit=100000');v.innerHTML=`<div class="panel"><div class="panel-title"><div><h3>Estoque Inteligente</h3><p class="muted">Módulo independente do catálogo. Alterações aqui não alteram nome, preço, categoria ou fotos.</p></div><div class="actions"><input id="stockSearch" class="search" style="max-width:360px" placeholder="Pesquisar estoque" oninput="stockFilter(this)"><button class="btn primary" onclick="exportStockPdf()">⇩ PDF do estoque</button></div></div><div class="stock-kpis"><span><b>${x.total}</b> itens</span><span><b>${x.items.filter(i=>i.status==='CRITICO').length}</b> críticos</span><span><b>${x.items.reduce((a,i)=>a+Number(i.quantidade_reservada),0)}</b> reservados</span></div></div><div id="stockTable" class="tablewrap"><table class="table"><thead><tr><th>Produto</th><th>SKU</th><th>Descrição</th><th>Disponível</th><th>Reservado</th><th>Mínimo</th><th>Status</th><th>Ações</th></tr></thead><tbody>${x.items.map(stockRow).join('')}</tbody></table></div>`}
function stockRow(x){return `<tr data-stock-text="${esc((x.nome+' '+x.sku+' '+(x.descricao||'')).toLowerCase())}"><td><div class="catalog-product-cell">${x.foto_url?`<img class="catalog-mini-photo" src="${esc(x.foto_url)}" alt="" onerror="this.onerror=null;this.replaceWith(Object.assign(document.createElement('div'),{className:'catalog-mini-photo placeholder',textContent:'XV'}))">`:'<div class="catalog-mini-photo placeholder">XV</div>'}<div><strong>${esc(x.nome)}</strong><br><small>${esc([x.marca,x.sabor,x.tamanho].filter(Boolean).join(' · '))}</small></div></div></td><td>${esc(x.sku)}</td><td>${esc(x.descricao||'-')}</td><td><strong>${x.quantidade_disponivel}</strong></td><td>${x.quantidade_reservada}</td><td>${x.estoque_minimo}</td><td><span class="badge status-${String(x.status).toLowerCase()}">${esc(x.status)}</span></td><td><button class="btn" onclick="adjustStock('${x.id}')">Movimentar</button> <button class="btn" onclick="stockHistory('${x.id}')">Histórico</button></td></tr>`}
function stockFilter(i){const q=i.value.toLowerCase();document.querySelectorAll('#stockTable tbody tr').forEach(r=>r.style.display=r.dataset.stockText.includes(q)?'':'none')}
function exportStockPdf(){downloadAuthFile('/api/admin/export/stock.pdf','xiquim-vargas-estoque.pdf')}
async function stockHistory(id){try{const x=await api('/api/stock/'+id+'/movements');modal('Histórico de estoque',`<div class="tablewrap"><table class="table"><thead><tr><th>Data</th><th>Tipo</th><th>Delta</th><th>Saldo</th><th>Operador</th><th>Observação</th></tr></thead><tbody>${x.items.map(m=>`<tr><td>${new Date(m.created_at).toLocaleString('pt-BR')}</td><td>${esc(m.tipo)}</td><td>${m.quantidade>0?'+':''}${m.quantidade}</td><td>${m.quantidade_posterior}</td><td>${esc(m.operador_nome||'-')}</td><td>${esc(m.observacao||'-')}</td></tr>`).join('')||'<tr><td colspan="6">Sem movimentações.</td></tr>'}</tbody></table></div><div style="margin-top:14px; display:flex; justify-content:flex-end;"><button class="btn" onclick="downloadAuthPost('/api/logistics/loading-list/orders-pdf',{pedido_ids:parseJsonArg('${jsonArg(ids)}')},'Pedidos_Carregamento.pdf')">🖨️ Imprimir todos os pedidos em PDF</button></div>`)}catch(e){toast(e.message)}}
function adjustStock(id){modal('Movimentar estoque',`<form id="stockForm"><div class="field"><label>Delta (+ entrada / - saída)</label><input name="delta" type="number" required></div><div class="field"><label>Tipo</label><select name="tipo"><option>ENTRADA</option><option>SAIDA</option><option>AJUSTE</option><option>INVENTARIO</option></select></div><div class="field"><label>Estoque mínimo</label><input name="estoque_minimo" type="number" min="0"></div><div class="field"><label>Observação</label><input name="observacao"></div><br><button class="btn primary">Aplicar movimentação</button></form>`);$('#stockForm').onsubmit=async e=>{e.preventDefault();try{const b=Object.fromEntries(new FormData(e.currentTarget));const delta=Number(b.delta);b.delta=delta;if(b.estoque_minimo!=='')b.estoque_minimo=Number(b.estoque_minimo);else delete b.estoque_minimo;closeModal();const row=document.querySelector(`button[onclick*="adjustStock('${id}')"]`)?.closest('tr');if(row){const availCell=row.querySelector('td:nth-child(4) strong');if(availCell){availCell.textContent=Number(availCell.textContent||0)+delta}row.classList.add('xv-flash-updated');setTimeout(()=>row.classList.remove('xv-flash-updated'),900)}toast('Estoque movimentado com sucesso!');Realtime.emit('stock_changed',{id,delta});await api('/api/stock/'+id,{method:'POST',body:JSON.stringify(b)});refreshCurrentViewSilently('stock_changed')}catch(x){toast(x.message,true);refreshCurrentViewSilently('stock_changed')}}}
window.openCrmWhatsApp = function(phone, clientName, days, topProductsJson) {
  const cleanPhone = String(phone||'').replace(/\D/g, '');
  if (!cleanPhone) return toast('Cliente sem telefone cadastrado.');
  let topProducts = [];
  try { topProducts = typeof topProductsJson === 'string' ? JSON.parse(topProductsJson) : (topProductsJson||[]); } catch(e){}
  const prodsText = topProducts && topProducts.length ? topProducts.slice(0, 2).join(' e ') : 'seus produtos habituais';
  const daysText = (days !== null && days !== undefined && days !== '') ? `Faz ${days} dias desde o seu último pedido.` : 'Esperamos que esteja tudo bem!';
  const msg = encodeURIComponent(`Olá ${clientName}! Aqui é da Distribuidora Xiquim Vargas. ${daysText} Notamos que ${prodsText} podem estar em baixa no seu estoque. Temos pronta entrega com ótimas condições nesta semana. Gostaria que gerássemos o seu pedido de reposição agora?`);
  window.open(`https://wa.me/55${cleanPhone}?text=${msg}`, '_blank');
};

window.crmInteractionsModal = async function(clientId, clientName) {
  try {
    const res = await api('/api/clients/' + clientId + '/interactions');
    const items = res.items || [];
    modal(`Linha do Tempo CRM — ${esc(clientName)}`, `
      <div style="margin-bottom:14px;background:#f8fafc;border:1px solid #dfe5ed;border-radius:10px;padding:14px;">
        <h4 style="margin:0 0 10px;color:var(--xv-brand-navy,#061a4f);">+ Registrar Novo Contato / Ocorrência</h4>
        <form id="crmInteractionForm" class="form">
          <div class="field">
            <label>Tipo de Contato</label>
            <select name="tipo" class="field-input" required>
              <option value="WHATSAPP">📲 WhatsApp</option>
              <option value="LIGACAO">📞 Ligação Telefônica</option>
              <option value="VISITA">🤝 Visita Presencial</option>
              <option value="COBRANCA">💰 Cobrança / Financeiro</option>
              <option value="OBSERVACAO">📝 Observação / Preferência</option>
            </select>
          </div>
          <div class="field" style="grid-column:1/-1;">
            <label>Resumo da conversa / ocorrência</label>
            <textarea name="descricao" rows="2" placeholder="Ex: Dono pediu retorno na sexta-feira após o fechamento do caixa..." required></textarea>
          </div>
          <div class="actions" style="grid-column:1/-1;justify-content:flex-end;">
            <button class="btn primary" type="submit">Salvar Interação</button>
          </div>
        </form>
      </div>
      <h4 style="margin:16px 0 8px;color:var(--xv-brand-navy,#061a4f);">Histórico de Contatos (${items.length})</h4>
      <div id="crmInteractionsList" style="max-height:300px;overflow-y:auto;padding-right:4px;">
        ${items.length ? items.map(it => `
          <div class="crm-timeline-item">
            <div class="crm-timeline-head">
              <span class="badge" style="background:#e2e8f0;color:#1e293b;">${esc(it.tipo)}</span>
              <small class="muted">${new Date(it.created_at).toLocaleString('pt-BR')} · por <b>${esc(it.usuario_nome || 'Operador')}</b></small>
            </div>
            <div style="color:#1e293b;font-size:13px;line-height:1.45;">${esc(it.descricao)}</div>
          </div>
        `).join('') : '<div class="empty-state" style="padding:18px;">Nenhuma interação registrada ainda para este cliente.</div>'}
      </div>
    `);

    $('#crmInteractionForm').onsubmit = async (e) => {
      e.preventDefault();
      const b = Object.fromEntries(new FormData(e.currentTarget));
      try {
        await api('/api/clients/' + clientId + '/interactions', {
          method: 'POST',
          body: JSON.stringify(b)
        });
        toast('Interação registrada com sucesso!');
        closeModal();
        if (typeof window.refreshCrmData === 'function') window.refreshCrmData();
      } catch (err) {
        toast(err.message);
      }
    };
  } catch (err) {
    toast(err.message);
  }
};

window.renderClientsUI=function(){
  const tab = window.currentClientTab || 'crm';
  const sq = document.getElementById('clientsSearch')?.value.toLowerCase().trim() || '';
  const sellerFilter = document.getElementById('clientsSellerFilter')?.value || '';

  if (tab === 'crm') {
    const crm = window._crmData || { summary: {}, items: [] };
    const rfmFilter = window.currentCrmRfmFilter || 'ALL';
    let filtered = crm.items || [];

    if (rfmFilter !== 'ALL') {
      if (rfmFilter === 'EM_RISCO') filtered = filtered.filter(x => x.status_rfm === 'EM_RISCO');
      else if (rfmFilter === 'VIP') filtered = filtered.filter(x => x.status_rfm === 'VIP');
      else if (rfmFilter === 'ATIVO') filtered = filtered.filter(x => x.status_rfm === 'ATIVO');
      else if (rfmFilter === 'INATIVO') filtered = filtered.filter(x => x.status_rfm === 'INATIVO');
      else if (rfmFilter === 'NOVO') filtered = filtered.filter(x => x.status_rfm === 'NOVO');
    }

    if (sellerFilter) {
      filtered = filtered.filter(x => x.vendedor_id === sellerFilter || x.vendedor_nome === sellerFilter);
    }

    if (sq) {
      filtered = filtered.filter(x =>
        (x.razao_social || '').toLowerCase().includes(sq) ||
        (x.nome_fantasia || '').toLowerCase().includes(sq) ||
        (x.cnpj_cpf || '').toLowerCase().includes(sq) ||
        (x.telefone || '').toLowerCase().includes(sq) ||
        (x.bairro || '').toLowerCase().includes(sq) ||
        (x.cidade || '').toLowerCase().includes(sq) ||
        (x.vendedor_nome || '').toLowerCase().includes(sq)
      );
    }

    const s = crm.summary || {};
    const html = `
      <div class="grid" style="margin-bottom:16px;">
        <div class="card kpi" style="border-top:4px solid var(--xv-navy);">
          <div style="font-size:13px;color:#8193a9;margin-bottom:4px;">👥 Carteira de Clientes</div>
          <div class="v">${s.total_clientes || 0}</div>
          <div style="font-size:11px;color:#64748b;margin-top:4px;">${s.taxa_saude_carteira || 0}% de saúde da base</div>
        </div>
        <div class="card kpi" style="border-top:4px solid #10b981;">
          <div style="font-size:13px;color:#8193a9;margin-bottom:4px;">🟢 Recorrentes Ativos (≤15d)</div>
          <div class="v" style="color:#10b981;">${s.ativos || 0}</div>
          <div style="font-size:11px;color:#10b981;margin-top:4px;">Comprando no ciclo ideal</div>
        </div>
        <div class="card kpi" style="border-top:4px solid #f59e0b;">
          <div style="font-size:13px;color:#8193a9;margin-bottom:4px;">⚠️ Em Risco / Churn (16–45d)</div>
          <div class="v" style="color:#f59e0b;">${s.em_risco || 0}</div>
          <div style="font-size:11px;color:#d97706;margin-top:4px;">Atenção: ciclo de recompra atrasado</div>
        </div>
        <div class="card kpi" style="border-top:4px solid #ef4444;">
          <div style="font-size:13px;color:#8193a9;margin-bottom:4px;">🔴 Inativos / Dormientes (>45d)</div>
          <div class="v" style="color:#ef4444;">${s.inativos || 0}</div>
          <div style="font-size:11px;color:#ef4444;margin-top:4px;">Requerem reativação urgente</div>
        </div>
        <div class="card kpi" style="border-top:4px solid #8b5cf6;">
          <div style="font-size:13px;color:#8193a9;margin-bottom:4px;">⭐ Clientes VIPs</div>
          <div class="v" style="color:#8b5cf6;">${s.vips || 0}</div>
          <div style="font-size:11px;color:#8b5cf6;margin-top:4px;">Alto faturamento e frequência</div>
        </div>
        <div class="card kpi" style="border-top:4px solid var(--xv-orange);">
          <div style="font-size:13px;color:#8193a9;margin-bottom:4px;">💰 Ticket Médio Geral</div>
          <div class="v" style="font-size:22px;">${brl(s.ticket_medio || 0)}</div>
          <div style="font-size:11px;color:#64748b;margin-top:4px;">Média por pedido concluído</div>
        </div>
      </div>

      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:14px;">
        <span style="font-size:12px;color:#64748b;font-weight:800;">Filtro RFM:</span>
        <button type="button" class="crm-filter-pill ${rfmFilter==='ALL'?'active':''}" onclick="window.currentCrmRfmFilter='ALL';renderClientsUI()">Todos (${s.total_clientes||0})</button>
        <button type="button" class="crm-filter-pill ${rfmFilter==='EM_RISCO'?'active':''}" style="border-color:#f59e0b;color:${rfmFilter==='EM_RISCO'?'#fff':'#b45309'}" onclick="window.currentCrmRfmFilter='EM_RISCO';renderClientsUI()">⚠️ Em Risco (${s.em_risco||0})</button>
        <button type="button" class="crm-filter-pill ${rfmFilter==='VIP'?'active':''}" style="border-color:#8b5cf6;color:${rfmFilter==='VIP'?'#fff':'#6d28d9'}" onclick="window.currentCrmRfmFilter='VIP';renderClientsUI()">⭐ VIPs (${s.vips||0})</button>
        <button type="button" class="crm-filter-pill ${rfmFilter==='ATIVO'?'active':''}" style="border-color:#10b981;color:${rfmFilter==='ATIVO'?'#fff':'#047857'}" onclick="window.currentCrmRfmFilter='ATIVO';renderClientsUI()">🟢 Ativos (${s.ativos||0})</button>
        <button type="button" class="crm-filter-pill ${rfmFilter==='INATIVO'?'active':''}" style="border-color:#ef4444;color:${rfmFilter==='INATIVO'?'#fff':'#b91c1c'}" onclick="window.currentCrmRfmFilter='INATIVO';renderClientsUI()">🔴 Inativos (${s.inativos||0})</button>
        <button type="button" class="crm-filter-pill ${rfmFilter==='NOVO'?'active':''}" onclick="window.currentCrmRfmFilter='NOVO';renderClientsUI()">Novos (${s.novos||0})</button>
      </div>

      <div class="tablewrap">
        <table class="table">
          <thead>
            <tr>
              <th>Cliente / Razão Social</th>
              <th>Status RFM</th>
              <th>Recência (Última Compra)</th>
              <th>Pedidos & Faturamento</th>
              <th>Mix Habitual (Top Produtos)</th>
              <th>Último Contato CRM</th>
              <th style="text-align:right;">Ações Rápidas</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.map(x => {
              const days = x.dias_sem_comprar;
              let recBadge = '<span class="badge" style="background:#e2e8f0;color:#64748b;">Nunca comprou</span>';
              if (days !== null) {
                if (days <= 7) recBadge = `<span class="badge" style="background:rgba(34,197,94,0.15);color:#16a34a;">Há ${days} dia(s)</span>`;
                else if (days <= 15) recBadge = `<span class="badge" style="background:rgba(59,130,246,0.15);color:#2563eb;">Há ${days} dias</span>`;
                else if (days <= 45) recBadge = `<span class="badge" style="background:rgba(245,158,11,0.18);color:#d97706;animation:pulse-lead 2s infinite;">Há ${days} dias</span>`;
                else recBadge = `<span class="badge" style="background:rgba(239,68,68,0.15);color:#dc2626;">Há ${days} dias</span>`;
              }

              let rfmClass = 'crm-badge-ativo';
              let rfmLabel = '🟢 Ativo';
              if (x.status_rfm === 'VIP') { rfmClass = 'crm-badge-vip'; rfmLabel = '⭐ VIP'; }
              else if (x.status_rfm === 'EM_RISCO') { rfmClass = 'crm-badge-risco'; rfmLabel = '⚠️ Em Risco'; }
              else if (x.status_rfm === 'INATIVO') { rfmClass = 'crm-badge-inativo'; rfmLabel = '🔴 Inativo'; }
              else if (x.status_rfm === 'NOVO') { rfmClass = 'crm-badge-novo'; rfmLabel = '🆕 Novo'; }

              const topChips = (x.top_produtos || []).slice(0, 2).map(p => `<span class="crm-product-tag">${esc(p)}</span>`).join('') || '<span class="muted" style="font-size:11px;">Sem mix ainda</span>';
              const lastIntText = x.ultima_interacao ? `<small style="display:block;color:#1e293b;max-width:210px;white-space:normal;line-height:1.3;"><b>${esc(x.ultima_interacao.tipo)}:</b> ${esc(x.ultima_interacao.descricao.slice(0, 45))}${x.ultima_interacao.descricao.length>45?'...':''}</small>` : '<small class="muted">Nenhum registro</small>';

              return `
                <tr>
                  <td>
                    <button class="btn" style="text-align:left;padding:4px 8px;font-size:13px;" onclick="clientProfile('${x.id}')">
                      <strong>${esc(x.razao_social || x.nome_fantasia)}</strong>
                    </button>
                    <div style="font-size:11px;color:#64748b;margin-top:3px;">
                      ${esc(x.bairro || x.cidade || 'Sem bairro')} · 👤 ${esc(x.vendedor_nome || 'Sem vendedor')}
                    </div>
                  </td>
                  <td><span class="crm-badge-rfm ${rfmClass}">${rfmLabel}</span></td>
                  <td>${recBadge}</td>
                  <td>
                    <strong>${brl(x.faturamento_total)}</strong>
                    <div style="font-size:11px;color:#64748b;margin-top:2px;">${x.total_pedidos} pedido(s) · Méd: ${brl(x.ticket_medio)}</div>
                  </td>
                  <td style="max-width:220px;white-space:normal;">${topChips}</td>
                  <td>${lastIntText}</td>
                  <td style="text-align:right;">
                    <div style="display:inline-flex;gap:5px;align-items:center;">
                      <button class="btn-crm-wpp" title="Conversar no WhatsApp com mensagem inteligente" onclick="openCrmWhatsApp('${x.telefone||''}', parseJsonArg('${jsonArg(x.razao_social||x.nome_fantasia)}'), ${days!==null?days:'null'}, parseJsonArg('${jsonArg(JSON.stringify(x.top_produtos||[]))}'))">📲 WhatsApp</button>
                      <button class="btn" title="Repetir último pedido" style="padding:6px 9px;font-size:12px;" onclick="repeatClient('${x.id}')">↻</button>
                      <button class="btn" title="Linha do Tempo CRM e Registro de Contatos" style="padding:6px 9px;font-size:12px;" onclick="crmInteractionsModal('${x.id}', parseJsonArg('${jsonArg(x.razao_social||x.nome_fantasia)}'))">📝</button>
                      <button class="btn" title="Perfil 360º" style="padding:6px 9px;font-size:12px;" onclick="clientProfile('${x.id}')">👁</button>
                    </div>
                  </td>
                </tr>
              `;
            }).join('') || '<tr><td colspan="7" class="empty-state">Nenhum cliente encontrado com os filtros selecionados.</td></tr>'}
          </tbody>
        </table>
      </div>
    `;
    const host = document.getElementById('clientsContent');
    if (host) host.innerHTML = html;
  } else {
    // Tab Listagem Geral Clássica
    let filtered = window._clientsData || [];
    if (sellerFilter) {
      filtered = filtered.filter(x => x.vendedor_id === sellerFilter || x.vendedor_nome === sellerFilter);
    }
    if (sq) {
      filtered = filtered.filter(x =>
        (x.razao_social || '').toLowerCase().includes(sq) ||
        (x.nome_fantasia || '').toLowerCase().includes(sq) ||
        (x.cnpj_cpf || '').toLowerCase().includes(sq) ||
        (x.telefone || '').toLowerCase().includes(sq) ||
        (x.bairro || '').toLowerCase().includes(sq) ||
        (x.cidade || '').toLowerCase().includes(sq) ||
        (x.email || '').toLowerCase().includes(sq)
      );
    }
    const html = `
      <div class="tablewrap">
        <table class="table">
          <thead>
            <tr>
              <th>Cliente / Razão Social</th>
              <th>CNPJ/CPF</th>
              <th>Telefone</th>
              <th>Bairro</th>
              <th>Vendedor</th>
              <th style="text-align:right;">Ações</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.map(x => `
              <tr>
                <td><button class="btn" onclick="clientProfile('${x.id}')"><b>${esc(x.razao_social||x.nome_fantasia)}</b></button></td>
                <td>${esc(x.cnpj_cpf||'-')}</td>
                <td>${esc(x.telefone||'-')}</td>
                <td>${esc(x.bairro||'-')}</td>
                <td>${esc(x.vendedor_nome||'-')}</td>
                <td style="text-align:right;">
                  <button class="btn" onclick="crmInteractionsModal('${x.id}', parseJsonArg('${jsonArg(x.razao_social||x.nome_fantasia)}'))">📝 CRM</button>
                  <button class="btn" onclick="editClient(parseJsonArg('${jsonArg(x)}'))">Editar</button>
                </td>
              </tr>
            `).join('') || '<tr><td colspan="6" class="empty-state">Nenhum cliente encontrado.</td></tr>'}
          </tbody>
        </table>
      </div>
    `;
    const host = document.getElementById('clientsContent');
    if (host) host.innerHTML = html;
  }
};

window.refreshCrmData = async function() {
  try {
    const [c, crm] = await Promise.all([api('/api/clients'), api('/api/crm/dashboard')]);
    window._clientsData = c.items || [];
    window._crmData = crm;
    renderClientsUI();
  } catch(e) {}
};

async function clients(v){
  const [c, crm, usersRes] = await Promise.all([
    api('/api/clients'),
    api('/api/crm/dashboard').catch(() => ({ summary: {}, items: [] })),
    api('/api/users').catch(() => ({ items: [] }))
  ]);
  window._clientsData = c.items || [];
  window._crmData = crm;
  window.currentClientTab = window.currentClientTab || 'crm';
  window.currentCrmRfmFilter = window.currentCrmRfmFilter || 'ALL';
  const sellers = (usersRes.items || []).filter(u => u.role === 'seller' && u.ativo);

  v.innerHTML = `
    <div class="panel">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:16px;">
        <div style="display:flex;gap:8px;align-items:center;">
          <button type="button" class="crm-tab-btn ${window.currentClientTab==='crm'?'active':''}" onclick="window.currentClientTab='crm';document.querySelectorAll('.crm-tab-btn').forEach(b=>b.classList.remove('active'));this.classList.add('active');renderClientsUI()">
            📊 Saúde da Carteira (CRM)
          </button>
          <button type="button" class="crm-tab-btn ${window.currentClientTab==='list'?'active':''}" onclick="window.currentClientTab='list';document.querySelectorAll('.crm-tab-btn').forEach(b=>b.classList.remove('active'));this.classList.add('active');renderClientsUI()">
            📋 Cadastro & Carteira Geral
          </button>
        </div>
        <div class="actions">
          <button class="btn primary" onclick="newClient()">+ Novo Cliente</button>
        </div>
      </div>

      <div class="actions" style="margin-bottom:16px;justify-content:space-between;flex-wrap:wrap;gap:10px;">
        <div style="display:flex;gap:10px;align-items:center;flex:1;max-width:680px;">
          <input type="text" id="clientsSearch" class="field-input search" style="flex:1;" placeholder="Buscar por cliente, documento, telefone, bairro..." oninput="renderClientsUI()">
          <select id="clientsSellerFilter" class="field-input search" style="width:200px;" onchange="renderClientsUI()">
            <option value="">Todos os vendedores</option>
            ${sellers.map(s => `<option value="${s.id}">${esc(s.nome)}</option>`).join('')}
          </select>
        </div>
        <div style="display:flex;gap:8px;align-items:center;">
          <button class="btn" onclick="refreshCrmData()">↻ Atualizar</button>
        </div>
      </div>

      <div id="clientsContent"></div>
    </div>
  `;
  renderClientsUI();
}
async function newClient(){const t=await api('/api/price-tables');modal('Novo cliente',`<form id="clientNewForm" class="form"><div class="field"><label>Nome fantasia</label><input name="nome_fantasia"></div><div class="field"><label>Razão social</label><input name="razao_social" required></div><div class="field"><label>CNPJ/CPF</label><input name="cnpj_cpf"></div><div class="field"><label>Email</label><input name="email" type="email"></div><div class="field"><label>Telefone</label><input name="telefone"></div><div class="field"><label>Endereço</label><input name="endereco" required></div><div class="field"><label>Bairro</label><input name="bairro" required></div><div class="field"><label>Cidade</label><input name="cidade"></div><div class="field"><label>Estado</label><input name="estado"></div><div class="field"><label>CEP</label><input name="cep"></div><div class="field"><label>Tabela de Preços</label><select name="tabela_preco_id" class="field-input"><option value="">(Preço base - Padrão)</option>${t.items.map(p=>`<option value="${p.id}">${esc(p.nome)}</option>`).join('')}</select></div><div class="actions" style="grid-column:1/-1"><button type="button" class="btn" onclick="closeModal()">Cancelar</button><button class="btn primary">Criar cliente</button></div></form>`);$('#clientNewForm').onsubmit=async e=>{e.preventDefault();try{await api('/api/clients',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(e.currentTarget)))});closeModal();toast('Cliente criado');show('clients')}catch(z){toast(z.message)}}}

async function editClient(x){const t=await api('/api/price-tables');modal('Editar cliente',`<form id="clientEditForm" class="form"><div class="field"><label>Nome fantasia</label><input name="nome_fantasia" value="${esc(x.nome_fantasia||'')}"></div><div class="field"><label>Razão social</label><input name="razao_social" required value="${esc(x.razao_social||'')}"></div><div class="field"><label>CNPJ/CPF</label><input name="cnpj_cpf" value="${esc(x.cnpj_cpf||'')}"></div><div class="field"><label>Email</label><input name="email" type="email" value="${esc(x.email||'')}"></div><div class="field"><label>Telefone</label><input name="telefone" value="${esc(x.telefone||'')}"></div><div class="field"><label>Endereço</label><input name="endereco" required value="${esc(x.endereco||'')}"></div><div class="field"><label>Bairro</label><input name="bairro" required value="${esc(x.bairro||'')}"></div><div class="field"><label>Cidade</label><input name="cidade" value="${esc(x.cidade||'')}"></div><div class="field"><label>Estado</label><input name="estado" value="${esc(x.estado||'')}"></div><div class="field"><label>CEP</label><input name="cep" value="${esc(x.cep||'')}"></div><div class="field"><label>Tabela de Preços</label><select name="tabela_preco_id" class="field-input"><option value="">(Preço base - Padrão)</option>${t.items.map(p=>`<option value="${p.id}" ${x.tabela_preco_id===p.id?'selected':''}>${esc(p.nome)}</option>`).join('')}</select></div><div class="actions" style="grid-column:1/-1"><button type="button" class="btn" onclick="closeModal()">Cancelar</button><button class="btn primary">Salvar alterações</button></div></form>`);$('#clientEditForm').onsubmit=async e=>{e.preventDefault();try{await api('/api/clients/'+x.id,{method:'PUT',body:JSON.stringify(Object.fromEntries(new FormData(e.currentTarget)))});closeModal();toast('Cliente atualizado');show('clients')}catch(z){toast(z.message)}}}
async function clientProfile(id){const x=await api('/api/clients/'+id+'/profile');modal('Perfil completo do cliente',`<div class="grid"><div class="card"><small>Pedidos</small><h2>${x.summary?.pedidos||0}</h2></div><div class="card"><small>Faturado</small><h2>${brl(x.summary?.faturado||0)}</h2></div><div class="card"><small>Em aberto</small><h2>${brl(x.summary?.em_aberto||0)}</h2></div></div><h3>${esc(x.client.razao_social)}</h3><p>${esc(x.client.endereco)} · ${esc(x.client.cidade||'')} · Tabela: ${esc(x.client.tabela_preco_nome||'Preço base')}</p><div class="actions"><button class="btn primary" onclick="repeatClient('${id}')">↻ Repetir último pedido</button><button class="btn" onclick="crmInteractionsModal('${id}', parseJsonArg('${jsonArg(x.client.razao_social||x.client.nome_fantasia)}'))">📝 Linha do Tempo CRM</button></div><h4>Produtos mais comprados</h4><div class="tablewrap"><table class="table"><thead><tr><th>Produto</th><th>Qtd.</th><th>Faturamento</th><th>Última compra</th></tr></thead><tbody>${x.topProdutos.map(p=>`<tr><td>${esc(p.nome)}</td><td>${p.quantidade}</td><td>${brl(p.faturamento)}</td><td>${p.ultima_compra?new Date(p.ultima_compra).toLocaleDateString('pt-BR'):'-'}</td></tr>`).join('')||'<tr><td colspan=4>Nenhum histórico concluído.</td></tr>'}</tbody></table></div><h4>Histórico de pedidos</h4><div class="tablewrap"><table class="table"><thead><tr><th>Pedido</th><th>Origem</th><th>Status</th><th>Total</th><th>Documento</th></tr></thead><tbody>${x.orders.map(o=>`<tr><td><button class="btn" onclick="orderDetail('${o.id}')">${esc(o.numero)}</button></td><td>${esc(o.origem)}</td><td>${esc(o.status)}</td><td>${brl(o.total)}</td><td><button class="btn" onclick="downloadAuthFile('/api/orders/${o.id}/pdf','pedido-${o.numero}.pdf')">PDF</button></td></tr>`).join('')}</tbody></table></div>`)}
async function repeatClient(id){try{const x=await api('/api/clients/'+id+'/repeat-last',{method:'POST',body:'{}'});modal('Repetir pedido',`<p>O último pedido foi recuperado. Revise as quantidades antes de emitir.</p><div class="tablewrap"><table class="table"><tbody>${x.itens.map(i=>`<tr><td>${esc(i.produto_id)}</td><td>${i.quantidade}</td></tr>`).join('')}</tbody></table></div><button class="btn primary" onclick="closeModal();toast('Itens recuperados. Abra o emissor para revisar.')">Continuar</button>`)}catch(e){toast(e.message)}}
async function orderDetail(id){
 const x=await api('/api/orders/'+id+'/detail');
 const o=x.order;
 let products={items:[],total:0}; for(let page=1,done=false;!done;page++){const pg=await api('/api/products?limit=100&page='+page);products.items.push(...pg.items);products.total=pg.total;done=products.items.length>=pg.total||!pg.items.length}
 const existing=new Set(x.items.map(i=>i.produto_id));
 const catalog=products.items.filter(p=>!existing.has(p.id));
 modal('Editar pedido '+esc(o.numero),`<form id="orderEditForm" class="form">
   <div class="field"><label>Cliente</label><input value="${esc(o.nome_fantasia||o.cliente_nome)}" disabled></div>
   <div class="field"><label>Modalidade</label><select name="modalidade_entrega"><option value="ENTREGA" ${o.modalidade_entrega==='ENTREGA'?'selected':''}>Entrega</option><option value="RETIRADA" ${o.modalidade_entrega!=='ENTREGA'?'selected':''}>Retirada</option></select></div>
   <div class="field"><label>Desconto</label><input name="desconto_valor" type="number" min="0" step="0.01" value="${Number(o.desconto_valor||0)}"></div>
   <div class="field"><label>Tipo de desconto</label><select name="desconto_tipo"><option value="VALOR" ${o.desconto_tipo!=='PERCENTUAL'?'selected':''}>R$ valor</option><option value="PERCENTUAL" ${o.desconto_tipo==='PERCENTUAL'?'selected':''}>%</option></select></div>
   <div class="field" style="grid-column:1/-1"><label>Observação</label><textarea name="observacoes" rows="3">${esc(o.observacoes||'')}</textarea></div>
   <div class="field" style="grid-column:1/-1"><label>Itens atuais</label><div id="orderEditItems">${x.items.map(i=>`<div class="actions order-edit-line" style="margin-bottom:6px;border-bottom:1px solid #e5eaf1;padding-bottom:7px"><span style="flex:1">${esc(i.produto_nome)}</span><input class="order-q" data-product="${i.produto_id}" type="number" min="1" max="100000" value="${i.quantidade}" style="width:100px"><button type="button" class="btn danger order-remove" data-product="${i.produto_id}">Remover</button></div>`).join('')}</div></div>
   <div class="field" style="grid-column:1/-1"><label>Adicionar item do catálogo</label><input id="orderCatalogSearch" class="search" placeholder="Pesquisar produto por nome, SKU ou código..." oninput="filterOrderCatalog(this)"><div id="orderCatalog" class="order-catalog-picker">${catalog.slice(0,30).map(p=>`<label class="order-catalog-item"><span><strong>${esc(p.nome)}</strong><small>${esc(p.sku||'Sem SKU')} · ${brl(p.preco_aplicado??p.preco_base)}</small></span><button type="button" class="btn" onclick="addOrderCatalogItem('${p.id}')">Adicionar</button></label>`).join('')||'<span class="muted">Todos os produtos disponíveis já estão no pedido.</span>'}</div></div>
   <div class="actions"><button type="button" class="btn" onclick="closeModal()">Cancelar</button><button type="button" class="btn" onclick="downloadAuthFile('/api/orders/${id}/pdf','pedido-${o.numero}.pdf')">PDF atual</button><button class="btn primary">Salvar pedido</button></div>
 </form>`);
 window.orderEditCatalog=catalog;
 window.orderEditItems=new Map(x.items.map(i=>[i.produto_id,{produto_id:i.produto_id,quantidade:Number(i.quantidade),nome:i.produto_nome}]));
 $('#orderEditForm').querySelectorAll('.order-remove').forEach(b=>b.onclick=()=>{window.orderEditItems.delete(b.dataset.product);renderOrderEditItems()});
 $('#orderEditForm').onsubmit=async e=>{
   e.preventDefault();
   const f=Object.fromEntries(new FormData(e.currentTarget));
   const itens=[...window.orderEditItems.values()].filter(i=>Number(i.quantidade)>0).map(i=>({produto_id:i.produto_id,quantidade:Number(i.quantidade)}));
   if(!itens.length)return toast('O pedido precisa manter pelo menos um item.');
   try{await api('/api/orders/'+id,{method:'PUT',body:JSON.stringify({...f,itens})});closeModal();toast('Pedido atualizado e PDF regenerado');show('orders')}
   catch(z){toast(z.message)}
 };
 renderOrderEditItems();
}
function renderOrderEditItems(){
 const host=$('#orderEditItems');if(!host)return;
 host.innerHTML=[...window.orderEditItems.values()].map(i=>`<div class="actions order-edit-line" style="margin-bottom:6px;border-bottom:1px solid #e5eaf1;padding-bottom:7px"><span style="flex:1">${esc(i.nome)}</span><input class="order-q" data-product="${i.produto_id}" type="number" min="1" max="100000" value="${Number(i.quantidade)}" style="width:100px" oninput="window.orderEditItems.get('${i.produto_id}').quantidade=Number(this.value)"><button type="button" class="btn danger order-remove" data-product="${i.produto_id}" onclick="window.orderEditItems.delete('${i.produto_id}');renderOrderEditItems()">Remover</button></div>`).join('')||'<span class="muted">Adicione ao menos um item.</span>';
}
function filterOrderCatalog(input){
 const q=(input.value||'').toLowerCase().trim();
 const items=(window.orderEditCatalog||[]).filter(p=>(p.nome+' '+(p.sku||'')+' '+(p.codigo_barras||'')).toLowerCase().includes(q));
 $('#orderCatalog').innerHTML=items.slice(0,40).map(p=>`<label class="order-catalog-item"><span><strong>${esc(p.nome)}</strong><small>${esc(p.sku||'Sem SKU')} · ${brl(p.preco_aplicado??p.preco_base)}</small></span><button type="button" class="btn" onclick="addOrderCatalogItem('${p.id}')">Adicionar</button></label>`).join('')||'<span class="muted">Nenhum produto encontrado.</span>';
}
function addOrderCatalogItem(id){
 const p=(window.orderEditCatalog||[]).find(x=>x.id===id);if(!p)return;
 if(window.orderEditItems.has(id)){window.orderEditItems.get(id).quantidade+=1}else window.orderEditItems.set(id,{produto_id:id,quantidade:1,nome:p.nome});
 renderOrderEditItems();filterOrderCatalog($('#orderCatalogSearch'));
}
window.getSellersSummaryForOrders = function(ordersList) {
  const sellersMap = new Map();
  for (const u of (window._sellerUsers || [])) {
    sellersMap.set(u.nome, {
      id: u.id,
      nome: u.nome,
      email: u.email || '',
      telefone: u.telefone || '',
      pedidos: [],
      total: 0
    });
  }
  for (const o of ordersList) {
    if (o.origem !== 'VENDEDOR') continue;
    const sName = o.vendedor_nome || o.operador_nome || 'Vendedor Não Identificado';
    if (!sellersMap.has(sName)) {
      sellersMap.set(sName, {
        id: o.operador_id || o.vendedor_id || '',
        nome: sName,
        email: '',
        telefone: '',
        pedidos: [],
        total: 0
      });
    }
    const item = sellersMap.get(sName);
    item.pedidos.push(o);
    item.total += Number(o.total || 0);
  }
  return Array.from(sellersMap.values()).sort((a, b) => b.pedidos.length - a.pedidos.length || a.nome.localeCompare(b.nome));
};

window.renderSellersCardsHtml = function(sellers, contextTitle) {
  if (!sellers.length) {
    return `<div class="empty-state" style="padding:28px;">Nenhum vendedor cadastrado ou com pedidos encontrados.</div>`;
  }
  return `
    <div class="panel" style="margin-top:14px;background:#f8fafc;border:1px solid #dfe6ef;">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
        <div>
          <h3 style="margin:0;color:var(--xv-brand-navy,#061a4f);">📊 Vendedores — ${esc(contextTitle || 'Pedidos')}</h3>
          <p class="muted" style="margin:4px 0 0;">Clique em um vendedor abaixo para auditar e gerenciar seus pedidos em detalhes.</p>
        </div>
        <span class="badge" style="background:#fff;font-weight:700;padding:6px 12px;font-size:12px;">${sellers.length} vendedor(es)</span>
      </div>
      <div class="sellers-cards-grid">
        ${sellers.map(s => {
          const initials = s.nome.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'VD';
          const count = s.pedidos.length;
          const totalMoney = brl(s.total);
          return `
            <div class="seller-order-card" onclick="selectSellerForOrders('${esc(s.nome).replace(/'/g, "\\'")}')">
              <div class="seller-card-top">
                <div class="seller-card-avatar">${esc(initials)}</div>
                <div class="seller-card-info">
                  <h3 title="${esc(s.nome)}">${esc(s.nome)}</h3>
                  <p>${esc(s.email || s.telefone || 'Vendedor Externo')}</p>
                </div>
              </div>
              <div class="seller-card-metrics">
                <div class="seller-metric-item">
                  <span class="seller-metric-label">Pedidos</span>
                  <span class="seller-metric-val">${count}</span>
                </div>
                <div class="seller-metric-item">
                  <span class="seller-metric-label">Faturamento</span>
                  <span class="seller-metric-val money" style="font-size:14px">${totalMoney}</span>
                </div>
              </div>
              <div class="seller-card-footer">
                <span class="seller-card-badge">${count === 1 ? '1 pedido emitido' : count + ' pedidos emitidos'}</span>
                <span class="seller-card-link">Ver pedidos →</span>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
};

window.selectSellerForOrders = function(sellerName) {
  window._selectedSellerForOrders = sellerName;
  window._ordersOrigin = 'VENDEDOR';
  if(window.currentOrdersStatus === null || window.currentOrdersStatus === undefined) {
    renderOrdersList(null);
  } else {
    filterTowerOrders();
  }
};

window.onOrdersOriginFilterChange = function(val) {
  window._ordersOrigin = val;
  window._selectedSellerForOrders = null;
  filterTowerOrders();
};

window.onMainOrdersOriginFilter = function(val) {
  window._ordersOrigin = val;
  window._selectedSellerForOrders = null;
  const content = $('#ordersMainContent');
  if(!content) return;
  if(val === 'VENDEDOR') {
    const sellers = getSellersSummaryForOrders(window._ordersItems);
    content.innerHTML = renderSellersCardsHtml(sellers, 'Operação Geral');
  } else if(val === 'BALCAO' || val === 'WEB') {
    const filtered = window._ordersItems.filter(i => i.origem === val);
    const pCount = filtered.filter(i => i.status === 'PENDENTE').length;
    const sCount = filtered.filter(i => i.status === 'SEPARACAO').length;
    const rCount = filtered.filter(i => i.status === 'ROTA').length;
    const cCount = filtered.filter(i => i.status === 'CONCLUIDO').length;
    content.innerHTML = `
      <div class="grid" style="margin-top:14px">
        <div class="card" style="cursor:pointer;border-top:4px solid #f59e0b" onclick="window._ordersOrigin='${val}';renderOrdersList('PENDENTE')"><h3 style="margin-top:0">Pendentes</h3><p class="muted">${pCount} pedido(s) aguardando</p></div>
        <div class="card" style="cursor:pointer;border-top:4px solid #3b82f6" onclick="window._ordersOrigin='${val}';renderOrdersList('SEPARACAO')"><h3 style="margin-top:0">Em Separação</h3><p class="muted">${sCount} pedido(s) no estoque</p></div>
        <div class="card" style="cursor:pointer;border-top:4px solid #8b5cf6" onclick="window._ordersOrigin='${val}';renderOrdersList('ROTA')"><h3 style="margin-top:0">Em Rota</h3><p class="muted">${rCount} pedido(s) em transporte</p></div>
        <div class="card" style="cursor:pointer;border-top:4px solid #10b981" onclick="window._ordersOrigin='${val}';renderOrdersList('CONCLUIDO')"><h3 style="margin-top:0">Concluídos</h3><p class="muted">${cCount} pedido(s) entregues</p></div>
      </div>
    `;
  } else {
    const pendentes=window._ordersItems.filter(i=>i.status==='PENDENTE').length;
    const separacao=window._ordersItems.filter(i=>i.status==='SEPARACAO').length;
    const rota=window._ordersItems.filter(i=>i.status==='ROTA').length;
    const concluidos=window._ordersItems.filter(i=>i.status==='CONCLUIDO').length;
    content.innerHTML = `
      <div class="grid" style="margin-top:14px">
        <div class="card" style="cursor:pointer;border-top:4px solid #f59e0b" onclick="renderOrdersList('PENDENTE')"><h3 style="margin-top:0">Pendentes</h3><p class="muted">${pendentes} pedido(s) aguardando</p></div>
        <div class="card" style="cursor:pointer;border-top:4px solid #3b82f6" onclick="renderOrdersList('SEPARACAO')"><h3 style="margin-top:0">Em Separação</h3><p class="muted">${separacao} pedido(s) no estoque</p></div>
        <div class="card" style="cursor:pointer;border-top:4px solid #8b5cf6" onclick="renderOrdersList('ROTA')"><h3 style="margin-top:0">Em Rota</h3><p class="muted">${rota} pedido(s) em transporte</p></div>
        <div class="card" style="cursor:pointer;border-top:4px solid #10b981" onclick="renderOrdersList('CONCLUIDO')"><h3 style="margin-top:0">Concluídos</h3><p class="muted">${concluidos} pedido(s) entregues</p></div>
      </div>
    `;
  }
};

async function orders(v){
  const [result, usersRes] = await Promise.all([
    api('/api/orders'),
    api('/api/users').catch(() => ({ items: [] }))
  ]);
  window._ordersItems = Array.isArray(result.items) ? result.items : [];
  window._sellerUsers = (usersRes.items || []).filter(u => u.role === 'seller' && u.ativo);
  window._selectedSellerForOrders = null;
  window._ordersOrigin = '';

  window.renderOrdersDashboard = function(){
    window.currentOrdersStatus = null;
    window._selectedSellerForOrders = null;
    const pendentes = window._ordersItems.filter(i => i.status === 'PENDENTE').length;
    const separacao = window._ordersItems.filter(i => i.status === 'SEPARACAO').length;
    const rota = window._ordersItems.filter(i => i.status === 'ROTA').length;
    const concluidos = window._ordersItems.filter(i => i.status === 'CONCLUIDO').length;
    
    v.innerHTML = `
      <div class="panel orders-toolbar">
        <div class="panel-title">
          <div>
            <h3>Pedidos da operação</h3>
            <p class="muted">Gerenciamento do fluxo operacional</p>
          </div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <select id="ordersMainOriginFilter" class="field-input search" style="width:auto" onchange="onMainOrdersOriginFilter(this.value)">
              <option value="">Todas as origens</option>
              <option value="VENDEDOR" ${window._ordersOrigin==='VENDEDOR'?'selected':''}>Vendedor</option>
              <option value="BALCAO" ${window._ordersOrigin==='BALCAO'?'selected':''}>Balcão/Caixa</option>
              <option value="WEB" ${window._ordersOrigin==='WEB'?'selected':''}>Loja Online</option>
            </select>
            <button class="btn" onclick="cancelledOrders()">Histórico de cancelados</button>
            <button class="btn primary" onclick="show('orders')">↻ Atualizar</button>
          </div>
        </div>
      </div>
      <div id="ordersMainContent">
        <div class="grid" style="margin-top:14px">
          <div class="card" style="cursor:pointer;border-top:4px solid #f59e0b" onclick="renderOrdersList('PENDENTE')"><h3 style="margin-top:0">Pendentes</h3><p class="muted">${pendentes} pedido(s) aguardando</p></div>
          <div class="card" style="cursor:pointer;border-top:4px solid #3b82f6" onclick="renderOrdersList('SEPARACAO')"><h3 style="margin-top:0">Em Separação</h3><p class="muted">${separacao} pedido(s) no estoque</p></div>
          <div class="card" style="cursor:pointer;border-top:4px solid #8b5cf6" onclick="renderOrdersList('ROTA')"><h3 style="margin-top:0">Em Rota</h3><p class="muted">${rota} pedido(s) em transporte</p></div>
          <div class="card" style="cursor:pointer;border-top:4px solid #10b981" onclick="renderOrdersList('CONCLUIDO')"><h3 style="margin-top:0">Concluídos</h3><p class="muted">${concluidos} pedido(s) entregues</p></div>
        </div>
      </div>
    `;
    if(window._ordersOrigin) {
      onMainOrdersOriginFilter(window._ordersOrigin);
    }
  };

  window.renderOrdersList = function(status){
    window.currentOrdersStatus = status;
    const filtered = status ? window._ordersItems.filter(i => i.status === status) : window._ordersItems;
    const titleMap = {'PENDENTE':'Pendentes','SEPARACAO':'Em Separação','ROTA':'Em Rota','CONCLUIDO':'Concluídos'};
    const selectedOrigin = window._ordersOrigin || '';
    let filterOriginHtml = `
      <select id="ordersOriginFilter" class="field-input search" style="width:auto;margin-left:8px" onchange="onOrdersOriginFilterChange(this.value)">
        <option value="">Todas as origens</option>
        <option value="VENDEDOR" ${selectedOrigin==='VENDEDOR'?'selected':''}>Vendedor</option>
        <option value="BALCAO" ${selectedOrigin==='BALCAO'?'selected':''}>Balcão/Caixa</option>
        <option value="WEB" ${selectedOrigin==='WEB'?'selected':''}>Loja Online</option>
      </select>
    `;
    let batchBtnHtml = '';
    let thCb = '';
    if(status === 'PENDENTE'){
      batchBtnHtml = `<button id="ordersBatchBtn" class="btn primary" style="margin-left:8px" onclick="advanceSelectedOrders()">Avançar Selecionados</button>`;
      thCb = `<th style="width:40px"><input type="checkbox" onchange="toggleAllOrders(this.checked)"></th>`;
    }
    v.innerHTML = `
      <div class="panel orders-toolbar">
        <div class="panel-title">
          <div style="display:flex;align-items:center;gap:12px">
            <button class="btn" onclick="renderOrdersDashboard()">← Voltar</button>
            <div>
              <h3 style="margin:0">${titleMap[status] || (window._selectedSellerForOrders ? 'Pedidos do Vendedor' : 'Todos os Pedidos')}</h3>
              <p class="muted" style="margin-top:4px">${filtered.length} pedido(s) listado(s)</p>
            </div>
          </div>
        </div>
        <div class="orders-filters" style="margin-top:14px;display:flex;align-items:center;flex-wrap:wrap;gap:8px">
          <input id="ordersSearch" class="search" style="flex:1;max-width:400px" placeholder="Buscar por número, cliente, vendedor..." oninput="filterTowerOrders()">
          ${filterOriginHtml}
          ${batchBtnHtml}
        </div>
      </div>
      <div id="ordersSellerDashboardContainer" style="display:none"></div>
      <div id="ordersActiveSellerBar" style="display:none;margin-top:14px;margin-bottom:14px;align-items:center;gap:12px;background:#fff;padding:12px 18px;border:1px solid var(--xv-brand-line);border-radius:var(--xv-brand-radius);box-shadow:0 3px 12px rgba(6,26,79,0.03);"></div>
      <div id="ordersTableContainer" class="tablewrap" style="margin-top:14px">
        <table class="table">
          <thead>
            <tr>${thCb}<th>Número</th><th>Cliente</th><th>Origem / Vendedor</th><th>Total</th><th>Desconto</th><th>Pagamento</th><th>Status</th><th>Ações</th></tr>
          </thead>
          <tbody id="towerOrdersBody">
            ${filtered.map(x => {
              let tdCb = '';
              if(status === 'PENDENTE') tdCb = `<td><input type="checkbox" class="order-cb" value="${x.id}"></td>`;
              const sellerName = x.vendedor_nome || x.operador_nome || '';
              return `
                <tr data-order-search="${esc([x.numero, x.nome_fantasia || x.cliente_nome, x.origem, sellerName].join(' ').toLowerCase())}" data-order-origin="${esc(x.origem || '')}" data-order-seller="${esc(sellerName)}">
                  ${tdCb}
                  <td><strong>${esc(x.numero)}</strong></td>
                  <td>${esc(x.nome_fantasia || x.cliente_nome || 'Cliente não identificado')}</td>
                  <td>${esc(x.origem || '-')}${x.origem === 'VENDEDOR' && sellerName ? `<br><small style="color:var(--xv-brand-orange,#f45a08);font-weight:650">👤 ${esc(sellerName)}</small>` : ''}</td>
                  <td>${brl(x.total)}</td>
                  <td>${x.desconto_tipo === 'PERCENTUAL' ? Number(x.desconto_valor || 0) + '%' : brl(x.desconto_valor || 0)}</td>
                  <td>${esc(x.forma_pagamento || '-')} · <button class="btn ${x.pagamento_status === 'RECEBIDO' ? 'good' : 'danger'}" onclick="togglePaymentStatus('${x.id}', '${x.pagamento_status}', '${esc(x.numero)}')">${x.pagamento_status === 'RECEBIDO' ? 'Recebido' : 'Não recebido'}</button></td>
                  <td><span class="badge status-${String(x.status || '').toLowerCase()}">${esc(x.status || '—')}</span></td>
                  <td class="order-actions">
                    ${x.status === 'PENDENTE' ? `<button class="btn" onclick="orderDetail('${x.id}')">Editar</button>` : '<span class="muted">Edição bloqueada</span>'}
                    <button class="btn" onclick="downloadAuthFile('/api/orders/${x.id}/pdf','pedido-${esc(x.numero)}.pdf')">PDF</button>
                    ${x.status === 'PENDENTE' ? `<button class="btn" onclick="advance('${x.id}','${x.status}')">Avançar → separação</button>` : ''}
                    ${['PENDENTE','SEPARACAO'].includes(x.status) ? `<button class="btn danger" onclick="cancelOrder('${x.id}','${esc(x.numero)}')">Cancelar pedido</button>` : ''}
                  </td>
                </tr>
              `;
            }).join('') || `<tr><td colspan="${status==='PENDENTE'?9:8}" class="empty-state">Nenhum pedido encontrado.</td></tr>`}
          </tbody>
        </table>
      </div>
      <div id="ordersNoMatch" class="empty-state" hidden>Nenhum pedido corresponde aos filtros.</div>
    `;
    filterTowerOrders();
  };

  if(window.currentOrdersStatus !== undefined && window.currentOrdersStatus !== null) {
    renderOrdersList(window.currentOrdersStatus);
  } else if(window._ordersOrigin === 'VENDEDOR' && window._selectedSellerForOrders) {
    renderOrdersList(null);
  } else {
    renderOrdersDashboard();
  }
}

function filterTowerOrders(){
  const q = ($('#ordersSearch')?.value || '').trim().toLocaleLowerCase('pt-BR');
  const oFilter = $('#ordersOriginFilter')?.value || '';
  const dashContainer = $('#ordersSellerDashboardContainer');
  const tableContainer = $('#ordersTableContainer');
  const activeSellerBar = $('#ordersActiveSellerBar');
  const batchBtn = $('#ordersBatchBtn');

  if(oFilter === 'VENDEDOR'){
    if(!window._selectedSellerForOrders){
      if(dashContainer){
        const statusOrders = (window.currentOrdersStatus !== undefined && window.currentOrdersStatus !== null)
          ? window._ordersItems.filter(i => i.status === window.currentOrdersStatus)
          : window._ordersItems;
        const sellers = getSellersSummaryForOrders(statusOrders);
        const titleMap = {'PENDENTE':'Pendentes','SEPARACAO':'Em Separação','ROTA':'Em Rota','CONCLUIDO':'Concluídos'};
        const ctxTitle = window.currentOrdersStatus ? titleMap[window.currentOrdersStatus] : 'Geral';
        dashContainer.innerHTML = renderSellersCardsHtml(sellers, ctxTitle);
        dashContainer.style.display = 'block';
      }
      if(tableContainer) tableContainer.style.display = 'none';
      if(activeSellerBar) activeSellerBar.style.display = 'none';
      if(batchBtn) batchBtn.style.display = 'none';
      const empty = $('#ordersNoMatch'); if(empty) empty.hidden = true;
      return;
    } else {
      if(dashContainer) dashContainer.style.display = 'none';
      if(tableContainer) tableContainer.style.display = 'block';
      if(batchBtn) batchBtn.style.display = '';
      if(activeSellerBar){
        const countOrders = window._ordersItems.filter(o => o.origem === 'VENDEDOR' && (o.vendedor_nome === window._selectedSellerForOrders || o.operador_nome === window._selectedSellerForOrders) && (!window.currentOrdersStatus || o.status === window.currentOrdersStatus)).length;
        activeSellerBar.style.display = 'flex';
        activeSellerBar.innerHTML = `
          <button class="btn" onclick="window._selectedSellerForOrders=null;filterTowerOrders()">← Voltar para todos os vendedores</button>
          <div style="display:flex;align-items:center;gap:8px">
            <h3 style="margin:0;font-size:16px;color:var(--xv-brand-navy,#061a4f);">Pedidos do vendedor: <span style="color:var(--xv-brand-orange,#f45a08)">${esc(window._selectedSellerForOrders)}</span></h3>
            <span class="badge" style="background:#fff;font-weight:700;">${countOrders} pedido(s)</span>
          </div>
        `;
      }
    }
  } else {
    window._selectedSellerForOrders = null;
    if(dashContainer) dashContainer.style.display = 'none';
    if(tableContainer) tableContainer.style.display = 'block';
    if(activeSellerBar) activeSellerBar.style.display = 'none';
    if(batchBtn) batchBtn.style.display = '';
  }

  let visible = 0;
  document.querySelectorAll('#towerOrdersBody tr[data-order-search]').forEach(row => {
    const okText = !q || row.dataset.orderSearch.includes(q);
    const rowOrigin = row.dataset.orderOrigin;
    const rowSeller = row.dataset.orderSeller || '';
    let okOrigin = true;
    if(oFilter) okOrigin = (rowOrigin === oFilter);
    let okSeller = true;
    if(oFilter === 'VENDEDOR' && window._selectedSellerForOrders){
      okSeller = (rowSeller === window._selectedSellerForOrders);
    }
    const ok = okText && okOrigin && okSeller;
    row.hidden = !ok;
    if(ok) visible++;
  });
  const empty = $('#ordersNoMatch'); if(empty) empty.hidden = (visible !== 0);

  const subTitle = document.querySelector('.orders-toolbar .muted');
  if(subTitle){
    if(oFilter === 'VENDEDOR' && window._selectedSellerForOrders){
      subTitle.textContent = `${visible} pedido(s) de ${window._selectedSellerForOrders}`;
    } else {
      subTitle.textContent = `${visible} pedido(s) listado(s)`;
    }
  }
}
window.toggleAllOrders=function(checked){document.querySelectorAll('.order-cb').forEach(cb=>{if(!cb.closest('tr').hidden)cb.checked=checked})};
window.advanceSelectedOrders=async function(){
 const cbs=document.querySelectorAll('.order-cb:checked');
 if(!cbs.length)return toast('Selecione ao menos um pedido.');
 const ids=Array.from(cbs).map(cb=>cb.value);
 if(!confirm(`Avançar ${ids.length} pedido(s) para separação?`))return;
 cbs.forEach(cb=>{
   const row=cb.closest('tr');
   if(row){
     row.style.transition='all 0.25s ease';row.style.opacity='0';row.style.transform='translateX(20px)';
     setTimeout(()=>row.remove(),250);
   }
 });
 for(const id of ids){
   const order=(window._ordersItems||[]).find(o=>o.id===id);
   if(order)order.status='SEPARACAO';
 }
 setTimeout(()=>{
   const remaining=document.querySelectorAll('#towerOrdersBody tr[data-order-search]').length;
   const subTitle=document.querySelector('.orders-toolbar .muted');
   if(subTitle)subTitle.textContent=`${remaining} pedido(s) listado(s)`;
   if(!remaining){
     const tbody=$('#towerOrdersBody');if(tbody)tbody.innerHTML='<tr><td colspan="9" class="empty-state">Nenhum pedido encontrado.</td></tr>';
   }
 },260);
 toast(`${ids.length} pedido(s) avançado(s) para separação!`);
 Realtime.emit('orders_changed',{ids,status:'SEPARACAO'});
 try{
   for(const id of ids){await api(`/api/orders/${id}/status`,{method:'POST',body:JSON.stringify({status:'SEPARACAO'})})}
 }catch(e){toast(e.message,true);refreshCurrentViewSilently('orders_changed')}
};
window.togglePaymentStatus=async function(id,currentStatus,numero){
  if(currentStatus==='RECEBIDO'){if(!confirm(`O pedido ${numero} já está marcado como Recebido. Deseja mesmo alterar para Não recebido?`))return;}
  const nextStatus=currentStatus==='RECEBIDO'?'NAO_RECEBIDO':'RECEBIDO';
  const btn=document.querySelector(`button[onclick*="togglePaymentStatus('${id}'"]`);
  const row=btn?.closest('tr');
  if(btn){
    btn.textContent=nextStatus==='RECEBIDO'?'Recebido':'Não recebido';
    btn.className=`btn ${nextStatus==='RECEBIDO'?'good':'danger'}`;
    btn.setAttribute('onclick',`togglePaymentStatus('${id}', '${nextStatus}', '${esc(numero)}')`);
  }
  if(row){
    row.classList.add('xv-flash-updated');
    setTimeout(()=>row.classList.remove('xv-flash-updated'),900);
  }
  const order=(window._ordersItems||[]).find(o=>o.id===id);
  if(order)order.pagamento_status=nextStatus;
  toast(nextStatus==='RECEBIDO'?`Pedido ${numero}: Pagamento marcado como RECEBIDO`:`Pedido ${numero}: Pagamento marcado como NÃO RECEBIDO`);
  Realtime.emit('orders_changed',{id,pagamento_status:nextStatus});
  try{await api(`/api/orders/${id}/toggle-payment`,{method:'POST',body:JSON.stringify({pagamento_status:nextStatus})})}catch(e){
    toast(e.message,true);
    if(order)order.pagamento_status=currentStatus;
    if(btn){
      btn.textContent=currentStatus==='RECEBIDO'?'Recebido':'Não recebido';
      btn.className=`btn ${currentStatus==='RECEBIDO'?'good':'danger'}`;
      btn.setAttribute('onclick',`togglePaymentStatus('${id}', '${currentStatus}', '${esc(numero)}')`);
    }
  }
};
async function cancelOrder(id,numero){
  if(!confirm(`Deseja mesmo cancelar o pedido ${numero}?\n\nEsta ação devolverá ao estoque as quantidades reservadas e removerá o pedido do fluxo operacional. O histórico será preservado.`))return;
  const row=document.querySelector(`button[onclick*="cancelOrder('${id}'"]`)?.closest('tr');
  if(row){
    row.style.transition='all 0.25s ease';row.style.opacity='0';row.style.transform='scale(0.95)';
    setTimeout(()=>{
      row.remove();
      const remaining=document.querySelectorAll('#towerOrdersBody tr[data-order-search]').length;
      const subTitle=document.querySelector('.orders-toolbar .muted');
      if(subTitle)subTitle.textContent=`${remaining} pedido(s) listado(s)`;
    },250);
  }
  window._ordersItems=(window._ordersItems||[]).filter(o=>o.id!==id);
  toast(`Pedido ${numero} cancelado e reservas estornadas.`);
  Realtime.emit('orders_changed',{id,status:'CANCELADO'});
  Realtime.emit('stock_changed');
  try{await api(`/api/orders/${id}/cancel`,{method:'POST',body:JSON.stringify({})})}catch(e){toast(e.message,true);refreshCurrentViewSilently('orders_changed')}
}
async function cancelledOrders(){try{const x=await api('/api/orders/cancelled');const items=x.items||[];modal('Histórico de pedidos cancelados',`<div class="tablewrap"><table class="table"><thead><tr><th>Pedido</th><th>Cliente</th><th>Origem</th><th>Total</th><th>Cancelado em</th><th>Cancelado por</th><th>Motivo</th><th>Ações</th></tr></thead><tbody>${items.map(o=>`<tr><td><strong>${esc(o.numero)}</strong></td><td>${esc(o.nome_fantasia||o.cliente_nome||'-')}</td><td>${esc(o.origem||'-')}</td><td>${brl(o.total)}</td><td>${o.cancelled_at?new Date(o.cancelled_at).toLocaleString('pt-BR'):'-'}</td><td>${esc(o.cancelled_by_nome||'-')}</td><td>${esc(o.cancel_reason||'Não informado')}</td><td><button class="btn" onclick="downloadAuthFile('/api/orders/${o.id}/pdf','pedido-${esc(o.numero)}.pdf')">PDF</button></td></tr>`).join('')||'<tr><td colspan="8" class="empty-state">Nenhum pedido cancelado.</td></tr>'}</tbody></table></div>`)}catch(e){toast(e.message)}}
async function advance(id,status){
  if(status!=='PENDENTE')return toast('Este pedido já avançou. Separação → rota é controlado pela Logística e rota → concluído pelo Motorista.');
  const next='SEPARACAO';
  const row=document.querySelector(`button[onclick*="advance('${id}'"]`)?.closest('tr');
  if(row){
    row.style.transition='all 0.25s ease';row.style.opacity='0';row.style.transform='translateX(20px)';
    setTimeout(()=>{
      row.remove();
      const remaining=document.querySelectorAll('#towerOrdersBody tr[data-order-search]').length;
      const subTitle=document.querySelector('.orders-toolbar .muted');
      if(subTitle)subTitle.textContent=`${remaining} pedido(s) listado(s)`;
      if(!remaining){
        const tbody=$('#towerOrdersBody');if(tbody)tbody.innerHTML='<tr><td colspan="9" class="empty-state">Nenhum pedido encontrado.</td></tr>';
      }
    },250);
  }
  const order=(window._ordersItems||[]).find(o=>o.id===id);
  if(order)order.status=next;
  toast('Pedido avançado para separação!');
  Realtime.emit('orders_changed',{id,status:next});
  try{await api(`/api/orders/${id}/status`,{method:'POST',body:JSON.stringify({status:next})})}catch(e){toast(e.message,true);refreshCurrentViewSilently('orders_changed')}
}
async function storeSettings(v){const s=await api('/api/settings');const keys=['store.title','store.subtitle','store.hero','store.footer','store.cover'];const vals=Object.fromEntries(s.items.map(x=>[x.chave,x.valor]));v.innerHTML=`<div class="panel"><div class="panel-title"><div><h3>Gestão da Loja Online</h3><p class="muted">Controle editorial da vitrine. Produtos, fotos e promoções continuam sendo administrados nos módulos correspondentes.</p></div><button class="btn" onclick="show('products')">Abrir catálogo</button></div><form id="storeConfigForm" class="form"><div class="field"><label>Título da loja</label><input name="store.title" value="${esc(vals['store.title']||'Catálogo Xiquim Vargas')}"></div><div class="field"><label>Subtítulo</label><input name="store.subtitle" value="${esc(vals['store.subtitle']||'Distribuição, reposição e condições comerciais em um só lugar.')}"></div><div class="field" style="grid-column:1/-1"><label>Texto principal / Hero</label><textarea name="store.hero" rows="4">${esc(vals['store.hero']||'Encontre produtos, condições e reposição para o seu negócio.')}</textarea></div><div class="field" style="grid-column:1/-1"><label>Foto de capa da loja</label><input id="storeCoverInput" type="file" accept="image/png,image/jpeg,image/webp"><div id="storeCoverPreview" class="store-cover-preview">${vals['store.cover']?`<img src="${esc(vals['store.cover'])}" alt="Capa atual">`:'<span class="muted">Nenhuma capa cadastrada.</span>'}</div><span class="muted">PNG, JPG ou WEBP · até 8 MB. A capa aparece imediatamente abaixo do cabeçalho da Loja Online.</span></div><div class="field" style="grid-column:1/-1"><label>Rodapé</label><textarea name="store.footer" rows="3">${esc(vals['store.footer']||'Pedido, catálogo e operação integrados.')}</textarea></div><div class="actions"><button class="btn primary">Salvar identidade da loja</button></div></form></div>`;$('#storeCoverInput').onchange=async e=>{const f=e.target.files?.[0];if(!f)return;if(f.size>8*1024*1024)return toast('A imagem excede 8 MB');const r=new FileReader();r.onload=async()=>{try{const out=await api('/api/store-cover',{method:'POST',body:JSON.stringify({data_url:r.result})});$('#storeCoverPreview').innerHTML=`<img src="${esc(out.url)}" alt="Capa atual">`;toast('Foto de capa atualizada')}catch(z){toast(z.message)}};r.readAsDataURL(f)};$('#storeConfigForm').onsubmit=async e=>{e.preventDefault();for(const [chave,valor] of Object.entries(Object.fromEntries(new FormData(e.currentTarget))))await api('/api/settings',{method:'POST',body:JSON.stringify({chave,valor})});toast('Loja Online atualizada');show('store')}}

async function prices(v){
  const [x, cl, usrs]=await Promise.all([api('/api/price-tables'),api('/api/clients'),api('/api/users')]);
  window._pricesClients=cl.items;
  const vendedores=usrs.items.filter(u=>u.role==='seller'&&u.ativo);
  v.innerHTML=`<div class="panel"><div class="panel-title"><h3>Governança de preços</h3><button class="btn primary" onclick="newPriceTable()">+ Nova tabela</button></div><p style="color:#91a1b4">Preços por cliente são resolvidos no servidor e aplicados a todos os canais.</p></div>

  <div class="grid"><div class="panel"><h3>Aplicar tabela em massa</h3><form id="applyTableForm" style="display:grid;gap:12px;align-items:end;"><div class="field"><label>Tabela</label><select id="applyTid" class="field-input" required><option value="">Selecione...</option>${x.items.map(t=>`<option value="${t.id}">${esc(t.nome)}</option>`).join('')}</select></div><div class="field"><label>Alvo</label><select id="applyTarget" class="field-input" required onchange="$('#applySellerField').style.display=this.value==='VENDEDOR'?'flex':'none';if(this.value!=='VENDEDOR')$('#applySellerId').value=''"><option value="ALL">Todos os clientes</option><option value="WEB">Loja Online (Web)</option><option value="BALCAO">Balcão (Frente de Loja)</option><option value="VENDEDOR">Vendedores</option></select></div><div class="field" id="applySellerField" style="display:none"><label>Vendedor</label><select id="applySellerId" class="field-input"><option value="">Todos os vendedores</option>${vendedores.map(s=>`<option value="${s.id}">${esc(s.nome)}</option>`).join('')}</select></div><button class="btn primary" type="submit" style="width:100%">Aplicar em massa</button></form></div>

  <div class="panel"><h3>Aplicar tabela individualmente</h3><form id="applyIndivForm" style="display:grid;gap:12px;align-items:end;"><div class="field" style="position:relative"><label>Buscar Cliente (Nome/CNPJ)</label><input id="applyIndivSearch" class="field-input search" autocomplete="off" required placeholder="Digite o nome ou cnpj..." oninput="pricesSearchClient(this.value)"><input type="hidden" id="applyIndivId" required><div id="applyIndivResults" style="position:absolute;top:100%;left:0;right:0;background:#fff;border:1px solid #ccc;border-radius:4px;max-height:200px;overflow-y:auto;z-index:99;display:none;box-shadow:0 4px 12px rgba(0,0,0,.15)"></div></div><div class="field"><label>Tabela</label><select id="applyIndivTid" class="field-input" required><option value="">Selecione a tabela...</option>${x.items.map(t=>`<option value="${t.id}">${esc(t.nome)}</option>`).join('')}</select></div><button class="btn primary" type="submit" style="width:100%">Aplicar ao cliente</button></form></div></div>

  <div class="tablewrap"><table class="table"><thead><tr><th>Nome</th><th>Itens</th><th>Status</th><th>Ações</th></tr></thead><tbody>${x.items.map(t=>`<tr><td style="font-weight:bold;font-size:1.15em;color:var(--xv-primary)">${esc(t.nome)}</td><td>${t.itens}</td><td><div style="display:flex;align-items:center;gap:8px"><span class="badge ${t.ativo?'ok':''}">${t.ativo?'Ativa':'Inativa'}</span><button class="btn" style="padding:4px 9px;font-size:12px;display:inline-flex;align-items:center;gap:4px" onclick="priceTableDetails('${t.id}','${esc(t.nome)}')">📊 Detalhes</button></div></td><td><button class="btn" onclick="priceTableItems('${t.id}','${esc(t.nome)}')">Ver preços</button> <button class="btn danger" onclick="deletePriceTable('${t.id}','${esc(t.nome)}')">Excluir tabela de preço</button></td></tr>`).join('')}</tbody></table></div>`;
  $('#applyTableForm').onsubmit=async e=>{e.preventDefault();const target=$('#applyTarget').value;const vid=target==='VENDEDOR'?$('#applySellerId').value:null;const targetLabel=target==='VENDEDOR'&&vid?`clientes do vendedor "${$('#applySellerId').options[$('#applySellerId').selectedIndex]?.text}"`:'clientes escolhidos';if(!confirm(`Deseja aplicar a tabela selecionada aos ${targetLabel}? Isso substituirá a tabela atual deles.`))return;toast('Aplicando tabela em massa...');try{await api('/api/price-tables/apply',{method:'POST',body:JSON.stringify({tabela_id:$('#applyTid').value,target,vendedor_id:vid||undefined})});toast('Tabela aplicada em massa com sucesso');Realtime.emit('prices_changed');Realtime.emit('products_changed');refreshCurrentViewSilently('prices_changed')}catch(z){toast(z.message,true)}}
  $('#applyIndivForm').onsubmit=async e=>{e.preventDefault();if(!$('#applyIndivId').value)return toast('Selecione um cliente na lista');toast('Aplicando tabela ao cliente...');try{await api('/api/price-tables/apply',{method:'POST',body:JSON.stringify({tabela_id:$('#applyIndivTid').value,target:'INDIVIDUAL',cliente_id:$('#applyIndivId').value})});toast('Tabela aplicada ao cliente com sucesso');$('#applyIndivId').value='';$('#applyIndivSearch').value='';Realtime.emit('prices_changed');Realtime.emit('products_changed');refreshCurrentViewSilently('prices_changed')}catch(z){toast(z.message,true)}}
}
async function priceTableItems(id,name){
 const x=await api('/api/price-tables/'+id+'/items');
 let page=1,total=Infinity,items=[];
 while(items.length<total){const p=await api('/api/products?limit=100&page='+page);items.push(...p.items);total=p.total;if(!p.items.length)break;page++}
 modal('Tabela: '+esc(name),`<form id="priceItemsForm"><div class="tablewrap"><table class="table"><thead><tr><th>Produto</th><th>Preço</th><th>Qtd. Mínima</th></tr></thead><tbody>${items.map(pr=>{const it=x.items.find(i=>i.produto_id===pr.id);return `<tr><td>${esc(pr.nome)}</td><td><input data-price-product="${pr.id}" value="${it?Number(it.preco).toFixed(2):''}" type="number" step="0.01" min="0" style="width:100px"></td><td><input data-qty-product="${pr.id}" value="${it?Number(it.quantidade_minima||1):1}" type="number" step="1" min="1" style="width:80px"></td></tr>`}).join('')}</tbody></table></div><br><button class="btn primary">Salvar preços</button></form>`);
 $('#priceItemsForm').onsubmit=async e=>{e.preventDefault();const itens=[...document.querySelectorAll('[data-price-product]')].filter(i=>i.value!=='').map(i=>{const q=document.querySelector(`[data-qty-product="${i.dataset.priceProduct}"]`);return {produto_id:i.dataset.priceProduct,preco:Number(i.value),quantidade_minima:q?Number(q.value||1):1};});try{await api('/api/price-tables/'+id,{method:'PUT',body:JSON.stringify({itens})});closeModal();toast('Tabela atualizada');show('prices')}catch(z){toast(z.message)}}
}
async function deletePriceTable(id,nome='esta tabela'){
  if(!confirm(`Excluir a tabela de preço "${nome}"?\n\nOs itens e vínculos associados a esta tabela serão removidos e os clientes voltarão ao preço base.`))return;
  const row=document.querySelector(`button[onclick*="deletePriceTable('${id}'"]`)?.closest('tr')||document.querySelector(`button[onclick*="deactivatePriceTable('${id}'"]`)?.closest('tr');
  if(row){
    row.style.transition='all 0.25s ease';row.style.opacity='0';row.style.transform='scale(0.95)';
    setTimeout(()=>row.remove(),250);
  }
  document.querySelectorAll(`#applyTid option[value="${id}"], #applyIndivTid option[value="${id}"]`).forEach(opt=>opt.remove());
  toast(`Tabela "${nome}" excluída com sucesso`);
  Realtime.emit('prices_changed',{id,deleted:true});
  Realtime.emit('products_changed');
  Realtime.emit('clients_changed');
  try{await api('/api/price-tables/'+id,{method:'DELETE'})}catch(e){toast(e.message,true);refreshCurrentViewSilently('prices_changed')}
}
const deactivatePriceTable = deletePriceTable;
window.deletePriceTable = deletePriceTable;
window.deactivatePriceTable = deletePriceTable;
async function priceTableDetails(id,name){
  window.ptdActiveGroupKey=null;
  modal(esc(name),`
    <div id="ptdContainer">
      <div id="ptdLoader" style="padding:40px 20px;text-align:center">
        <div class="muted">Carregando métricas, clientes e grupos vinculados...</div>
      </div>
      <div id="ptdBody" style="display:none"></div>
    </div>
  `,'960px');
  try{
    const data=await api('/api/price-tables/'+id+'/details');
    renderPriceTableDashboard(id,name,data);
  }catch(e){
    const l=document.getElementById('ptdLoader');
    if(l)l.innerHTML=`<div class="critical" style="padding:20px;text-align:center">Erro ao carregar dados: ${esc(e.message)}</div>`;
  }
}
function renderPriceTableGroupCard(id,name,data,groupKey){
  if(!groupKey)return '';
  if(groupKey==='web'){
    const count=data.groupsSummary?.web||0;
    return `
      <div class="card" style="background:#081326;border:1px solid #3b82f6;border-radius:12px;padding:16px;margin-bottom:14px;box-shadow:0 8px 24px rgba(59,130,246,0.18)">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap">
          <div>
            <div style="font-size:16px;font-weight:800;color:#93c5fd;display:flex;align-items:center;gap:8px">
              <span>🌐</span> Canal Loja Online (Web)
              <span class="badge" style="background:rgba(59,130,246,0.2);color:#93c5fd">${count} vinculado(s)</span>
            </div>
            <p class="muted" style="margin:4px 0 0;font-size:12px">
              Clientes que realizam compras através da Loja Online com as condições desta tabela de preço.
            </p>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            ${count>0?`
              <button class="btn danger" style="padding:7px 14px;font-size:12px;font-weight:700" onclick="removeGroupFromPriceTable('${id}','web','Loja Online (Web)','${esc(name)}')">
                🗑️ Remover Grupo Web da Tabela
              </button>
            `:''}
            <button class="btn" style="padding:5px 11px;font-size:12px" onclick="togglePriceTableGroup('${id}','web')" title="Fechar card">✕</button>
          </div>
        </div>
        ${count===0?`
          <div style="padding:14px 0 4px;color:#94a3b8;font-size:12px">
            Nenhum cliente da Loja Online vinculado a esta tabela no momento.
          </div>
        `:`
          <div style="margin-top:10px;padding:10px 14px;background:rgba(59,130,246,0.08);border-radius:8px;font-size:12px;color:#cbd5e1;display:flex;align-items:center;gap:8px">
            <span>ℹ️</span> Ao remover este grupo, todos os clientes Web voltarão a usar os preços base padrão do catálogo.
          </div>
        `}
      </div>
    `;
  }
  if(groupKey==='balcao'){
    const count=data.groupsSummary?.balcao||0;
    return `
      <div class="card" style="background:#1a1006;border:1px solid #fd5e02;border-radius:12px;padding:16px;margin-bottom:14px;box-shadow:0 8px 24px rgba(253,94,2,0.18)">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap">
          <div>
            <div style="font-size:16px;font-weight:800;color:#fdba74;display:flex;align-items:center;gap:8px">
              <span>🏪</span> Canal Balcão (Frente de Loja / PDV)
              <span class="badge" style="background:rgba(253,94,2,0.2);color:#fdba74">${count>0?'Vinculado':'Não vinculado'}</span>
            </div>
            <p class="muted" style="margin:4px 0 0;font-size:12px">
              Vendas emitidas no terminal de caixa / frente de loja utilizando esta tabela de preço.
            </p>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            ${count>0?`
              <button class="btn danger" style="padding:7px 14px;font-size:12px;font-weight:700" onclick="removeGroupFromPriceTable('${id}','balcao','Balcão (PDV)','${esc(name)}')">
                🗑️ Remover Grupo Balcão da Tabela
              </button>
            `:''}
            <button class="btn" style="padding:5px 11px;font-size:12px" onclick="togglePriceTableGroup('${id}','balcao')" title="Fechar card">✕</button>
          </div>
        </div>
        ${count===0?`
          <div style="padding:14px 0 4px;color:#94a3b8;font-size:12px">
            O Balcão (PDV) não está vinculado a esta tabela no momento.
          </div>
        `:`
          <div style="margin-top:10px;padding:10px 14px;background:rgba(253,94,2,0.08);border-radius:8px;font-size:12px;color:#cbd5e1;display:flex;align-items:center;gap:8px">
            <span>ℹ️</span> Ao remover este grupo, as vendas de balcão voltarão a aplicar os preços base padrão.
          </div>
        `}
      </div>
    `;
  }
  if(groupKey==='vendedor'){
    const sellerClients=data.clients.filter(c=>c.canal_tipo==='VENDEDOR');
    return `
      <div class="card" style="background:#06170e;border:1px solid #22c55e;border-radius:12px;padding:16px;margin-bottom:14px;box-shadow:0 8px 24px rgba(34,197,94,0.18)">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:12px">
          <div>
            <div style="font-size:16px;font-weight:800;color:#86efac;display:flex;align-items:center;gap:8px">
              <span>👥</span> Canal Vendedores
              <span class="badge" style="background:rgba(34,197,94,0.2);color:#86efac">${sellerClients.length} cliente(s)</span>
            </div>
            <p class="muted" style="margin:4px 0 0;font-size:12px">
              Clientes atendidos por vendedores externos com esta tabela aplicada. Exclua individualmente na lista abaixo ou remova o grupo completo:
            </p>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            ${sellerClients.length>0?`
              <button class="btn danger" style="padding:7px 14px;font-size:12px;font-weight:700" onclick="removeGroupFromPriceTable('${id}','vendedor','Vendedores','${esc(name)}')">
                🗑️ Remover Todo o Grupo Vendedor
              </button>
            `:''}
            <button class="btn" style="padding:5px 11px;font-size:12px" onclick="togglePriceTableGroup('${id}','vendedor')" title="Fechar card">✕</button>
          </div>
        </div>
        ${sellerClients.length===0?`
          <div style="padding:16px;text-align:center;color:#94a3b8;font-size:12px;border:1px dashed rgba(34,197,94,0.3);border-radius:8px">
            Nenhum cliente de vendedor vinculado a esta tabela no momento.
          </div>
        `:`
          <div class="tablewrap" style="max-height:300px;overflow:auto;border:1px solid rgba(34,197,94,0.3)">
            <table class="table" style="font-size:12px">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Vendedor Responsável</th>
                  <th>Documento / Contato</th>
                  <th>Histórico</th>
                  <th style="text-align:right">Ação</th>
                </tr>
              </thead>
              <tbody>
                ${sellerClients.map(c=>`
                  <tr data-client-row="${c.id}">
                    <td>
                      <div style="font-weight:700;color:#fff">${esc(c.razao_social)}</div>
                      ${c.nome_fantasia?`<div class="muted" style="font-size:11px">${esc(c.nome_fantasia)}</div>`:''}
                    </td>
                    <td>
                      <span class="badge" style="background:rgba(34,197,94,.18);color:#4ade80;border:1px solid rgba(34,197,94,.3)">
                        👤 ${esc(c.vendedor_nome || 'Atribuído')}
                      </span>
                    </td>
                    <td>
                      <div><code>${esc(c.cnpj_cpf||'-')}</code></div>
                      <div class="muted" style="font-size:11px">${esc(c.telefone||c.cidade||'-')}</div>
                    </td>
                    <td>
                      <div>${c.total_pedidos} pedidos</div>
                      <div class="muted" style="font-size:11px">${brl(c.total_faturado)}</div>
                    </td>
                    <td style="text-align:right">
                      <button class="btn danger" style="padding:5px 12px;font-size:12px" title="Excluir este cliente da tabela" onclick="removeClientFromPriceTable('${id}','${c.id}','${esc(c.razao_social)}','${esc(name)}')">
                        Excluir
                      </button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>
    `;
  }
  if(groupKey==='geral'||groupKey==='direto'){
    const directClients=data.clients.filter(c=>c.canal_tipo==='GERAL');
    return `
      <div class="card" style="background:#0e1624;border:1px solid #94a3b8;border-radius:12px;padding:16px;margin-bottom:14px;box-shadow:0 8px 24px rgba(148,163,184,0.18)">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:12px">
          <div>
            <div style="font-size:16px;font-weight:800;color:#cbd5e1;display:flex;align-items:center;gap:8px">
              <span>🏢</span> Canal Clientes Diretos / Gerais
              <span class="badge" style="background:rgba(148,163,184,0.2);color:#cbd5e1">${directClients.length} cliente(s)</span>
            </div>
            <p class="muted" style="margin:4px 0 0;font-size:12px">
              Clientes diretos ou gerais sem vendedor específico atribuído. Exclua individualmente na lista abaixo ou remova o grupo completo:
            </p>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            ${directClients.length>0?`
              <button class="btn danger" style="padding:7px 14px;font-size:12px;font-weight:700" onclick="removeGroupFromPriceTable('${id}','geral','Clientes Diretos','${esc(name)}')">
                🗑️ Remover Todo o Grupo Direto
              </button>
            `:''}
            <button class="btn" style="padding:5px 11px;font-size:12px" onclick="togglePriceTableGroup('${id}','geral')" title="Fechar card">✕</button>
          </div>
        </div>
        ${directClients.length===0?`
          <div style="padding:16px;text-align:center;color:#94a3b8;font-size:12px;border:1px dashed rgba(148,163,184,0.3);border-radius:8px">
            Nenhum cliente direto vinculado a esta tabela no momento.
          </div>
        `:`
          <div class="tablewrap" style="max-height:300px;overflow:auto;border:1px solid rgba(148,163,184,0.3)">
            <table class="table" style="font-size:12px">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Documento / Contato</th>
                  <th>Localização</th>
                  <th>Histórico</th>
                  <th style="text-align:right">Ação</th>
                </tr>
              </thead>
              <tbody>
                ${directClients.map(c=>`
                  <tr data-client-row="${c.id}">
                    <td>
                      <div style="font-weight:700;color:#fff">${esc(c.razao_social)}</div>
                      ${c.nome_fantasia?`<div class="muted" style="font-size:11px">${esc(c.nome_fantasia)}</div>`:''}
                    </td>
                    <td>
                      <div><code>${esc(c.cnpj_cpf||'-')}</code></div>
                      <div class="muted" style="font-size:11px">${esc(c.telefone||c.email||'-')}</div>
                    </td>
                    <td>
                      <div>${esc(c.cidade||'-')}${c.estado?` / ${esc(c.estado)}`:''}</div>
                    </td>
                    <td>
                      <div>${c.total_pedidos} pedidos</div>
                      <div class="muted" style="font-size:11px">${brl(c.total_faturado)}</div>
                    </td>
                    <td style="text-align:right">
                      <button class="btn danger" style="padding:5px 12px;font-size:12px" title="Excluir este cliente da tabela" onclick="removeClientFromPriceTable('${id}','${c.id}','${esc(c.razao_social)}','${esc(name)}')">
                        Excluir
                      </button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>
    `;
  }
  return '';
}
function renderPriceTableDashboard(id,name,data){
  window.ptdCurrentData=data;
  window.ptdCurrentTableName=name;
  window.ptdCurrentTableId=id;
  const loader=document.getElementById('ptdLoader');
  const body=document.getElementById('ptdBody');
  if(!body)return;
  if(loader)loader.style.display='none';
  body.style.display='block';
  body.innerHTML=`
    <div style="background:#091422;border:1px solid #1e2f47;border-radius:12px;padding:14px 18px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
      <div>
        <div style="font-size:18px;font-weight:800;color:#fff;display:flex;align-items:center;gap:8px">
          <span>🏷️</span> ${esc(name)}
          <span class="badge ${data.table.ativo?'ok':''}">${data.table.ativo?'Ativa':'Inativa'}</span>
        </div>
        <div class="muted" style="font-size:12px;margin-top:4px">
          ${data.itemsCount} produtos com preço cadastrado · Criada em ${new Date(data.table.created_at).toLocaleDateString('pt-BR')}
        </div>
      </div>
      <div class="actions">
        <button class="btn" onclick="priceTableItems('${id}','${esc(name)}')">🏷️ Ver Preços da Tabela</button>
        ${data.clients.length>0?`<button class="btn danger" style="font-size:12px;padding:8px 12px" onclick="removeAllClientsFromPriceTable('${id}','${esc(name)}')">Desvincular Todos</button>`:''}
        <button class="btn danger" style="font-size:12px;padding:8px 12px" onclick="deletePriceTable('${id}','${esc(name)}');closeModal();">🗑️ Excluir Tabela de Preço</button>
      </div>
    </div>
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px;margin-bottom:14px">
      <div class="card" style="padding:12px 14px">
        <small class="muted" style="font-weight:700;text-transform:uppercase;font-size:10px;letter-spacing:0.5px">Vínculos Ativos</small>
        <h2 style="margin:4px 0 2px;font-size:24px;color:#fff">${data.kpis.totalClients}</h2>
        <span class="muted" style="font-size:11px">Clientes cadastrados na tabela</span>
      </div>
      <div class="card" style="padding:12px 14px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <small class="muted" style="font-weight:700;text-transform:uppercase;font-size:10px;letter-spacing:0.5px">Canais e Grupos Ativos</small>
          <small class="muted" style="font-size:10px">Clique para gerenciar</small>
        </div>
        <div style="display:flex;gap:5px;flex-wrap:wrap">
          <button type="button" class="ptd-group-pill" onclick="togglePriceTableGroup('${id}','web')" title="Clique para gerenciar canal Web" style="cursor:pointer;border-radius:999px;padding:4px 9px;font-size:11px;font-weight:750;background:rgba(59,130,246,0.15);color:#60a5fa;border:1px solid ${window.ptdActiveGroupKey==='web'?'#3b82f6':'rgba(59,130,246,0.3)'};box-shadow:${window.ptdActiveGroupKey==='web'?'0 0 0 2px rgba(59,130,246,0.4)':''};transition:all 0.15s">
            🌐 Web: ${data.groupsSummary.web}
          </button>
          <button type="button" class="ptd-group-pill" onclick="togglePriceTableGroup('${id}','balcao')" title="Clique para gerenciar canal Balcão" style="cursor:pointer;border-radius:999px;padding:4px 9px;font-size:11px;font-weight:750;background:rgba(253,94,2,0.15);color:#fb923c;border:1px solid ${window.ptdActiveGroupKey==='balcao'?'#fd5e02':'rgba(253,94,2,0.3)'};box-shadow:${window.ptdActiveGroupKey==='balcao'?'0 0 0 2px rgba(253,94,2,0.4)':''};transition:all 0.15s">
            🏪 Balcão: ${data.groupsSummary.balcao}
          </button>
          <button type="button" class="ptd-group-pill" onclick="togglePriceTableGroup('${id}','vendedor')" title="Clique para gerenciar canal Vendedor" style="cursor:pointer;border-radius:999px;padding:4px 9px;font-size:11px;font-weight:750;background:rgba(34,197,94,0.15);color:#4ade80;border:1px solid ${window.ptdActiveGroupKey==='vendedor'?'#22c55e':'rgba(34,197,94,0.3)'};box-shadow:${window.ptdActiveGroupKey==='vendedor'?'0 0 0 2px rgba(34,197,94,0.4)':''};transition:all 0.15s">
            👥 Vendedor: ${data.groupsSummary.vendedor}
          </button>
          <button type="button" class="ptd-group-pill" onclick="togglePriceTableGroup('${id}','geral')" title="Clique para gerenciar canal Direto" style="cursor:pointer;border-radius:999px;padding:4px 9px;font-size:11px;font-weight:750;background:rgba(148,163,184,0.15);color:#cbd5e1;border:1px solid ${window.ptdActiveGroupKey==='geral'?'#94a3b8':'rgba(148,163,184,0.3)'};box-shadow:${window.ptdActiveGroupKey==='geral'?'0 0 0 2px rgba(148,163,184,0.4)':''};transition:all 0.15s">
            🏢 Direto: ${data.groupsSummary.geral}
          </button>
        </div>
      </div>
      <div class="card" style="padding:12px 14px">
        <small class="muted" style="font-weight:700;text-transform:uppercase;font-size:10px;letter-spacing:0.5px">Pedidos Concluídos</small>
        <h2 style="margin:4px 0 2px;font-size:24px;color:#fff">${data.kpis.totalPedidos}</h2>
        <span class="muted" style="font-size:11px">Pedidos emitidos sob a tabela</span>
      </div>
      <div class="card" style="padding:12px 14px">
        <small class="muted" style="font-weight:700;text-transform:uppercase;font-size:10px;letter-spacing:0.5px">Faturamento Acumulado</small>
        <h2 style="margin:4px 0 2px;font-size:24px;color:var(--xv-orange)">${brl(data.kpis.totalFaturado)}</h2>
        <span class="muted" style="font-size:11px">Faturamento de clientes na tabela</span>
      </div>
    </div>
    <div id="ptdGroupCardContainer">
      ${renderPriceTableGroupCard(id,name,data,window.ptdActiveGroupKey)}
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:10px;flex-wrap:wrap">
      <div>
        <h3 style="margin:0;font-size:16px;color:#fff">Lista Geral de Clientes da Tabela (<span id="ptdCount">${data.clients.length}</span>)</h3>
        <p class="muted" style="margin:2px 0 0;font-size:12px">Clique em "Excluir" em qualquer cliente para removê-lo desta tabela.</p>
      </div>
      ${data.clients.length>0?`<div style="min-width:240px"><input type="text" class="search" placeholder="🔍 Filtrar por nome, doc ou canal..." style="padding:8px 12px;font-size:12px" oninput="filterPriceTableClients(this.value)"></div>`:''}
    </div>
    <div class="tablewrap" style="max-height:400px;overflow:auto">
      <table class="table" id="ptdTable">
        <thead>
          <tr>
            <th>Cliente / Usuário</th>
            <th>Documento / Contato</th>
            <th>Grupo / Canal</th>
            <th>Histórico</th>
            <th style="text-align:right">Ação</th>
          </tr>
        </thead>
        <tbody>
          ${data.clients.map(c=>`
            <tr data-client-row="${c.id}" data-search="${esc((c.razao_social+' '+(c.nome_fantasia||'')+' '+(c.cnpj_cpf||'')+' '+c.grupo_canal+' '+(c.web_usuario_nome||'')+' '+(c.web_usuario_email||'')).toLowerCase())}">
              <td>
                <div style="font-weight:700;color:#fff">${esc(c.razao_social)}</div>
                ${c.nome_fantasia?`<div class="muted" style="font-size:11px">${esc(c.nome_fantasia)}</div>`:''}
                ${c.web_usuario_nome?`<div style="font-size:11px;color:#60a5fa">👤 Usuário: ${esc(c.web_usuario_nome)} (${esc(c.web_usuario_email||'')})</div>`:''}
              </td>
              <td>
                <div><code>${esc(c.cnpj_cpf||'-')}</code></div>
                <div class="muted" style="font-size:11px">${esc(c.telefone||c.cidade||'-')}</div>
              </td>
              <td>
                <span class="badge" style="${c.canal_tipo==='WEB'?'background:rgba(59,130,246,.18);color:#60a5fa;border:1px solid rgba(59,130,246,.3)':c.canal_tipo==='BALCAO'?'background:rgba(253,94,2,.18);color:#fb923c;border:1px solid rgba(253,94,2,.3)':c.canal_tipo==='VENDEDOR'?'background:rgba(34,197,94,.18);color:#4ade80;border:1px solid rgba(34,197,94,.3)':'background:#20304a;color:#cbd5e1'}">
                  ${esc(c.grupo_canal)}
                </span>
              </td>
              <td>
                <div>${c.total_pedidos} pedidos</div>
                <div class="muted" style="font-size:11px">${brl(c.total_faturado)}</div>
              </td>
              <td style="text-align:right">
                <button class="btn danger" style="padding:5px 12px;font-size:12px" title="Excluir este cliente da tabela" onclick="removeClientFromPriceTable('${id}','${c.id}','${esc(c.razao_social)}','${esc(name)}')">
                  Excluir
                </button>
              </td>
            </tr>
          `).join('')||`
            <tr>
              <td colspan="5" style="text-align:center;padding:30px;color:#8496ab">
                <div style="font-size:24px;margin-bottom:8px">👥</div>
                <div style="font-weight:700;color:#cbd5e1">Nenhum cliente ou grupo vinculado a esta tabela</div>
                <div style="font-size:12px;margin-top:4px">Você pode vincular clientes individualmente ou em massa na tela de Governança.</div>
              </td>
            </tr>
          `}
        </tbody>
      </table>
    </div>
  `;
}
window.togglePriceTableGroup=function(tableId,groupKey){
  if(window.ptdActiveGroupKey===groupKey){
    window.ptdActiveGroupKey=null;
  }else{
    window.ptdActiveGroupKey=groupKey;
  }
  if(window.ptdCurrentData){
    renderPriceTableDashboard(tableId,window.ptdCurrentTableName,window.ptdCurrentData);
  }
};
window.selectPriceTableGroup=function(tableId,groupKey){
  window.ptdActiveGroupKey=groupKey;
  if(window.ptdCurrentData){
    renderPriceTableDashboard(tableId,window.ptdCurrentTableName,window.ptdCurrentData);
  }
};
window.removeGroupFromPriceTable=async function(tableId,groupKey,groupName,tableName){
  if(!confirm(`Remover todos os vínculos do grupo "${groupName}" desta tabela de preço?\n\nOs clientes deste grupo voltarão ao preço base padrão.`))return;
  try{
    await api(`/api/price-tables/${tableId}/groups/${groupKey}`,{method:'DELETE'});
    toast(`Grupo "${groupName}" removido da tabela com sucesso`);
    Realtime.emit('clients_changed');
    Realtime.emit('prices_changed');
    const updated=await api('/api/price-tables/'+tableId+'/details');
    renderPriceTableDashboard(tableId,tableName,updated);
  }catch(err){
    toast(err.message,true);
  }
};
window.filterPriceTableClients=function(q){
  const term=(q||'').toLowerCase().trim();
  let visible=0;
  document.querySelectorAll('#ptdTable tbody tr[data-search]').forEach(r=>{
    const match=!term||r.dataset.search.includes(term);
    r.style.display=match?'':'none';
    if(match)visible++;
  });
  const cEl=document.getElementById('ptdCount');
  if(cEl)cEl.textContent=visible;
};
window.removeClientFromPriceTable=async function(tableId,clientId,clientName,tableName){
  if(!confirm(`Excluir o cliente "${clientName}" desta tabela de preço?\n\nEle deixará de usar esta tabela e voltará ao preço base padrão.`))return;
  document.querySelectorAll(`tr[data-client-row="${clientId}"]`).forEach(row=>{
    row.style.transition='all 0.25s ease';
    row.style.opacity='0';
    row.style.transform='scale(0.95)';
    setTimeout(()=>row.remove(),250);
  });
  try{
    await api(`/api/price-tables/${tableId}/clients/${clientId}`,{method:'DELETE'});
    toast(`Cliente "${clientName}" excluído da tabela com sucesso`);
    Realtime.emit('clients_changed');
    Realtime.emit('prices_changed');
    const updated=await api('/api/price-tables/'+tableId+'/details');
    renderPriceTableDashboard(tableId,tableName,updated);
  }catch(err){
    toast(err.message,true);
    priceTableDetails(tableId,tableName);
  }
};
window.removeAllClientsFromPriceTable=async function(tableId,tableName){
  if(!confirm(`Excluir TODOS os clientes e grupos vinculados à tabela "${tableName}"?\n\nTodos voltarão ao preço base padrão.`))return;
  try{
    await api(`/api/price-tables/${tableId}/clients`,{method:'DELETE'});
    toast(`Todos os clientes foram excluídos da tabela "${tableName}"`);
    Realtime.emit('clients_changed');
    Realtime.emit('prices_changed');
    const updated=await api('/api/price-tables/'+tableId+'/details');
    renderPriceTableDashboard(tableId,tableName,updated);
  }catch(err){
    toast(err.message,true);
  }
};
window.priceTableDetails=priceTableDetails;
function newPriceTable(){modal('Nova tabela de preço',`<form id="priceForm"><div class="field"><label>Nome</label><input name="nome" required></div><button class="btn primary">Criar tabela</button></form>`);$('#priceForm').onsubmit=async e=>{e.preventDefault();try{await api('/api/price-tables',{method:'POST',body:JSON.stringify({nome:new FormData(e.currentTarget).get('nome'),itens:[]})});closeModal();show('prices')}catch(x){toast(x.message)}}}
async function sellers(v) {
  const x=await api('/api/users');
  const vendedores=x.items.filter(u=>u.role==='seller'&&u.ativo);
  window.renderSellersDashboard=function(){
    v.innerHTML=`<div class="panel"><div class="panel-title"><div><h3>Vendedores</h3><p class="muted">Desempenho e painel do mês de cada vendedor.</p></div><button class="btn primary" onclick="show('sellers')">↻ Atualizar</button></div></div><div class="grid" style="margin-top:14px">${vendedores.map(u=>`<div class="card" style="cursor:pointer" onclick="renderSellerDashboard('${u.id}','${esc(u.nome)}')"><h3 style="margin-top:0;display:flex;align-items:center;gap:8px"><span class="client-icon" style="width:30px;height:30px;font-size:14px">👤</span>${esc(u.nome)}</h3><p class="muted" style="margin:0">${esc(u.email)}</p></div>`).join('')||'<div class="empty-state">Nenhum vendedor ativo encontrado.</div>'}</div>`;
  };
  window.renderSellerDashboard=async function(id,nome){
    v.innerHTML='<div class="panel">Carregando painel do mês...</div>';
    try{
      const d=await api('/api/seller/dashboard/monthly?vendedor_id='+encodeURIComponent(id));
      v.innerHTML=`<div class="panel"><div class="panel-title"><div style="display:flex;align-items:center;gap:12px"><button class="btn" onclick="renderSellersDashboard()">← Voltar</button><div><h3 style="margin:0">${nome} · Painel do mês</h3><p class="muted" style="margin-top:4px">${esc(d.mes||'Mês atual')}</p></div></div><button class="btn primary" onclick="renderSellerDashboard('${id}','${esc(nome)}')">↻ Atualizar</button></div></div><div class="grid" style="margin-top:14px"><div class="card"><small class="muted">Pedidos no mês</small><h2>${Number(d.pedidos||0)}</h2></div><div class="card"><small class="muted">Valor total dos pedidos</small><h2 class="orange">${brl(d.valor_total||0)}</h2><p class="muted" style="font-size:16px">Valor dos pedidos emitidos, não apenas pagamentos recebidos.</p></div></div>`;
    }catch(e){
      v.innerHTML=`<div class="panel"><div class="panel-title"><div style="display:flex;align-items:center;gap:12px"><button class="btn" onclick="renderSellersDashboard()">← Voltar</button><div><h3 style="margin:0">Erro</h3></div></div></div><div class="empty-state" style="margin-top:14px">Erro ao carregar dados: ${esc(e.message)}</div></div>`;
    }
  };
  renderSellersDashboard();
}
async function users(v){const [x,links]=await Promise.all([api('/api/users'),api('/api/admin/access-links')]);window.accessLinks=links.links;const labels=ROLE_LABELS;window.renderUsersDashboard=function(){v.innerHTML=`<div class="panel"><div class="panel-title"><div><h3>Usuários</h3><p class="muted">Gerencie os acessos do ERP e Loja Online.</p></div></div><div class="grid"><div class="card" style="cursor:pointer" onclick="renderUsersList('internos')"><h3>Usuários Internos</h3><p class="muted">Administradores, Vendedores, Caixas e Motoristas</p></div><div class="card" style="cursor:pointer" onclick="renderUsersList('web')"><h3>Usuários Web</h3><p class="muted">Clientes da Loja Online</p></div></div></div>`};window.renderUsersList=function(tipo){const isInternal=tipo==='internos';const filtered=x.items.filter(u=>isInternal?u.role!=='web_client':u.role==='web_client');v.innerHTML=`<div class="panel"><div class="panel-title"><div style="display:flex;align-items:center;gap:12px"><button class="btn" onclick="renderUsersDashboard()">← Voltar</button><div><h3 style="margin:0">${isInternal?'Usuários Internos':'Usuários Web'}</h3></div></div><button class="btn primary" onclick="newUser()">+ Usuário</button></div></div>${isInternal?`<div class="panel" style="margin-top:14px"><div class="panel-title"><div><h3>Links de acesso interno</h3><p class="muted">Os links abaixo já apontam para este ERP no endereço atual. Clique para copiar e envie ao usuário.</p></div><span class="badge">${esc(links.base_url)}</span></div><div class="access-links-grid">${Object.entries(links.links).filter(([role])=>role!=='web_client').map(([role,url])=>`<div class="access-link-card"><strong>${labels[role]||role}</strong><code>${esc(url)}</code><button class="btn" onclick="copyAccessLink('${role}')">⧉ Copiar URL</button></div>`).join('')}</div></div>`:`<div class="panel" style="margin-top:14px"><div class="panel-title"><div><h3>Link da Loja Online</h3><p class="muted">Envie este link para os clientes acessarem a loja e se cadastrarem.</p></div><span class="badge">${esc(links.base_url)}</span></div><div class="access-links-grid">${Object.entries(links.links).filter(([role])=>role==='web_client').map(([role,url])=>`<div class="access-link-card"><strong>${labels[role]||role}</strong><code>${esc(url)}</code><button class="btn" onclick="copyAccessLink('${role}')">⧉ Copiar URL</button></div>`).join('')}</div></div>`}<div class="tablewrap" style="margin-top:14px"><table class="table"><thead><tr><th>Nome</th><th>Email</th><th>Perfil</th><th>Ativo</th><th>Ações</th></tr></thead><tbody>${filtered.map(u=>`<tr><td>${esc(u.nome)}</td><td>${esc(u.email)}</td><td>${esc(labels[u.role]||u.role)}</td><td>${u.ativo?'Sim':'Não'}</td><td class="actions"><button class="btn" onclick="editUser(parseJsonArg('${jsonArg(u)}'))">Editar</button>${u.id!==me?.id?`<button class="btn danger" onclick="deleteUser('${u.id}',parseJsonArg('${jsonArg(u.nome)}'))">Excluir</button>`:'<span class="muted">Sessão atual</span>'}</td></tr>`).join('')||'<tr><td colspan="5" class="empty-state">Nenhum usuário encontrado.</td></tr>'}</tbody></table></div>`};renderUsersDashboard()}
function copyAccessLink(role){const url=window.accessLinks?.[role];if(!url)return toast('URL não encontrada');navigator.clipboard?.writeText(url).then(()=>toast('URL copiada')).catch(()=>{prompt('Copie esta URL:',url)})}
function newUser(){modal('Novo usuário',`<form id="userForm" class="form"><div class="field"><label>Nome</label><input name="nome" required></div><div class="field"><label>Email</label><input name="email" required></div><div class="field"><label>Senha</label><input name="password" value="ChangeMe123!" required></div><div class="field"><label>Função / Perfil</label><select name="role" required><option value="seller">Vendedor</option><option value="cashier">Caixa</option><option value="driver">Motorista</option><option value="web_client">Loja Online</option><option value="admin">Administrador</option></select></div><button class="btn primary">Criar usuário</button></form>`);$('#userForm').onsubmit=async e=>{e.preventDefault();try{await api('/api/users',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(e.currentTarget)))});closeModal();show('users')}catch(x){toast(x.message)}}}
function editUser(u){modal('Editar usuário',`<form id="userEditForm" class="form"><div class="field"><label>Nome</label><input name="nome" required value="${esc(u.nome)}"></div><div class="field"><label>Email</label><input name="email" type="email" required value="${esc(u.email)}"></div><div class="field"><label>Nova senha (opcional)</label><div style="display:flex;gap:6px"><input name="password" type="password" placeholder="Deixe vazio para manter" style="flex:1"><button type="button" class="btn" tabindex="-1" onclick="const x=this.previousElementSibling; x.type=x.type==='password'?'text':'password'">👁</button></div></div><div class="field"><label>Função / Perfil</label><select name="role">${[['seller','Vendedor'],['cashier','Caixa'],['driver','Motorista'],['web_client','Loja Online'],['admin','Administrador']].map(([v,l])=>`<option value="${v}" ${u.role===v?'selected':''}>${l}</option>`).join('')}</select></div><div class="field"><label>Ativo</label><select name="ativo"><option value="1" ${u.ativo?'selected':''}>Sim</option><option value="0" ${!u.ativo?'selected':''}>Não</option></select></div><div class="actions"><button type="button" class="btn" onclick="closeModal()">Cancelar</button><button class="btn primary">Salvar</button></div></form>`);$('#userEditForm').onsubmit=async e=>{e.preventDefault();const b=Object.fromEntries(new FormData(e.currentTarget));b.ativo=b.ativo==='1';if(!b.password)delete b.password;try{await api('/api/users/'+u.id,{method:'PUT',body:JSON.stringify(b)});closeModal();toast('Usuário atualizado');show('users')}catch(x){toast(x.message)}}}
async function deleteUser(id,nome){if(id===me?.id)return toast('Não é possível excluir o próprio usuário.');if(!confirm(`Excluir o usuário "${nome}"?\\n\\nO acesso será removido. Histórico operacional será preservado sem o vínculo com este usuário.`))return;try{await api('/api/users/'+id,{method:'DELETE'});toast('Usuário excluído');show('users')}catch(e){toast(e.message)}}
async function logistics(v){
 const [r,o,drivers,u,sett]=await Promise.all([api('/api/logistics/routes'),api('/api/logistics/grouped-orders'),api('/api/users'),api('/api/logistics/route-config'),api('/api/settings')]);
 const sMap=Object.fromEntries((sett.items||[]).map(x=>[x.chave,x.valor]));
 const depotLat=sMap['deposito_latitude']||sMap['depot.latitude']||'';
 const depotLng=sMap['deposito_longitude']||sMap['depot.longitude']||'';
 const ds=drivers.items.filter(x=>x.role==='driver'),sellers=drivers.items.filter(x=>x.role==='seller');
 const groups=o.grupos||[];
 window._logisticsGroups=groups;
 window._logisticsSellers=sellers;

 window.renderLogisticsModality=function(grupoKey, vendedorFiltro=''){
   let g;
   if(grupoKey === 'TODOS') {
     const subgruposMap = new Map();
     for(const grp of window._logisticsGroups) {
       for(const sg of grp.subgrupos) {
         if(!subgruposMap.has(sg.bairro)) subgruposMap.set(sg.bairro, {bairro: sg.bairro, pedidos: []});
         subgruposMap.get(sg.bairro).pedidos.push(...sg.pedidos);
       }
     }
     g = {
       grupo: 'TODOS',
       titulo: 'Todos os pedidos',
       subgrupos: Array.from(subgruposMap.values()).sort((a,b)=>a.bairro.localeCompare(b.bairro))
     };
   } else {
     g=window._logisticsGroups.find(x=>x.grupo===grupoKey);
   }
   if(!g) return '<div class="empty-state">Nenhum pedido elegível neste grupo.</div>';
   let html=`<div class="panel-title"><div style="display:flex;align-items:center;gap:12px"><button class="btn" onclick="document.getElementById('logisticsModalityDashboard').style.display='none';document.getElementById('logisticsMain').style.display='block'">← Voltar</button><div><h3 style="margin:0">${esc(g.titulo)}</h3><p class="muted" style="margin-top:4px">${g.grupo==='BALCAO'?'Somente pedidos do balcão marcados para entrega.':'Pedidos subdivididos por bairro.'}</p></div></div></div>`;
   
   if(grupoKey==='VENDEDOR' || grupoKey==='BALCAO'){
     const ops = new Set();
     for(const sg of g.subgrupos){
       for(const p of sg.pedidos) if(p.operador_nome) ops.add(p.operador_nome);
     }
     const opsArr = Array.from(ops).sort();
     html+=`<div class="orders-filters" style="margin-top:14px;margin-bottom:14px"><select id="logisticsSellerFilter" class="field-input search" style="width:auto" onchange="renderModalityDashboard('${grupoKey}', this.value)"><option value="">Todos os usuários</option>${opsArr.map(nome=>`<option value="${esc(nome)}" ${vendedorFiltro===nome?'selected':''}>${esc(nome)}</option>`).join('')}</select></div>`;
   }
   
   let hasSubgrupos=false;
   let sgHtml=g.subgrupos.map(sg=>{
     let filteredPedidos=sg.pedidos;
     if((grupoKey==='VENDEDOR' || grupoKey==='BALCAO') && vendedorFiltro){
       filteredPedidos=sg.pedidos.filter(p=>p.operador_nome===vendedorFiltro);
     }
     if(!filteredPedidos.length)return '';
     hasSubgrupos=true;
     const totalP=filteredPedidos.length;
     const totalV=filteredPedidos.reduce((acc, p)=>acc+Number(p.total||0),0);
     return `<div class="card logistics-neighborhood"><div class="panel-title"><strong>${esc(sg.bairro)}</strong><span class="badge" style="margin-right:auto; margin-left:10px">${totalP} pedidos · ${brl(totalV)}</span><label style="cursor:pointer;font-size:12px;display:flex;align-items:center;gap:5px"><input type="checkbox" onchange="const cb=this.closest('.logistics-neighborhood').querySelectorAll('.routeOrder'); cb.forEach(c => c.checked = this.checked)"> Selecionar todos</label></div><div class="actions">${filteredPedidos.map(p=>`<label class="card logistics-order"><input type="checkbox" class="load-order routeOrder" value="${p.id}"> <span><strong>${esc(p.numero)}</strong> · ${esc(p.nome_fantasia||p.razao_social)} <span class="badge" style="font-size:10px;padding:2px 4px;margin-left:5px">${p.status}</span><br><small class="muted">Operador: ${esc(p.operador_nome||'N/A')}${grupoKey==='TODOS'?` · Origem: ${esc(p.origem)}`:''}</small></span></label>`).join('')}</div></div>`;
   }).join('');
   
   if(!hasSubgrupos) sgHtml='<div class="empty-state">Nenhum pedido para este filtro.</div>';
   html+=sgHtml;
   return html;
 };

 window.renderModalityDashboard=function(grupoKey, vendedorFiltro=''){
   document.getElementById('logisticsMain').style.display='none';
   const modDb=document.getElementById('logisticsModalityDashboard');
   modDb.style.display='block';
   document.getElementById('logisticsModalityContent').innerHTML=renderLogisticsModality(grupoKey, vendedorFiltro);
 };

 v.innerHTML=`<div class="panel" id="logisticsMain" style="margin-bottom:14px">
  <div class="panel-title"><div><h3>Separação e Roteirização</h3></div><button class="btn" onclick="show('logistics')">↻ Atualizar</button></div>
  <div class="grid">
    <div class="card" style="cursor:pointer;border-top:4px solid #10b981" onclick="renderModalityDashboard('TODOS')"><h3>Todos os pedidos</h3><p class="muted">Todos os pedidos agrupados por bairro.</p></div>
    <div class="card" style="cursor:pointer;border-top:4px solid #f59e0b" onclick="renderModalityDashboard('VENDEDOR')"><h3>Pedidos de vendedores</h3><p class="muted">Pedidos externos subdivididos por bairro.</p></div>
    <div class="card" style="cursor:pointer;border-top:4px solid #3b82f6" onclick="renderModalityDashboard('WEB')"><h3>Pedidos web</h3><p class="muted">Pedidos da Loja Online subdivididos por bairro.</p></div>
    <div class="card" style="cursor:pointer;border-top:4px solid #8b5cf6" onclick="renderModalityDashboard('BALCAO')"><h3>Pedidos balcão — entrega</h3><p class="muted">Pedidos locais para entrega.</p></div>
  </div>
 </div>
 <div id="logisticsModalityDashboard" class="panel" style="display:none; padding-bottom:80px; position:relative; z-index:40;">
   <div id="logisticsModalityContent"></div>
   <div style="position:fixed; bottom:20px; left:50%; transform:translateX(-50%); background:var(--bg); padding:10px; border-radius:30px; box-shadow:0 10px 25px rgba(0,0,0,0.2); z-index:999; display:flex; flex-wrap:wrap; justify-content:center; gap:10px; width:max-content; max-width:90vw; border:1px solid var(--border)">
    <button class="btn primary" onclick="generateLoadingList()">Gerar lista</button>
    <button class="btn" onclick="makeRouteModal()">Gerar rota</button>
   </div>
 </div>
 <div style="text-align:center; margin:16px 0 24px;"><button class="btn" onclick="document.getElementById('logisticsDashboard').style.display='block';document.getElementById('logisticsMain').style.display='none';document.getElementById('logisticsModalityDashboard').style.display='none'">Ver pedidos em rota →</button></div>
 <div class="panel" style="margin-bottom:16px">
  <div class="panel-title">
    <div>
      <h3>📍 Ponto de Partida do Depósito Central</h3>
      <p class="muted">Coordenadas geográficas do centro de distribuição para otimização e ordenação das rotas de entrega.</p>
    </div>
  </div>
  <div class="form">
    <div class="field">
      <label>Latitude do Depósito</label>
      <input id="depotLatInput" placeholder="Ex: -23.550520" value="${esc(depotLat)}">
    </div>
    <div class="field">
      <label>Longitude do Depósito</label>
      <input id="depotLngInput" placeholder="Ex: -46.633308" value="${esc(depotLng)}">
    </div>
    <div class="actions">
      <button class="btn primary" onclick="saveDepotCoordinates()">Salvar Coordenadas</button>
    </div>
  </div>
 </div>
 <div class="panel"><div class="panel-title"><div><h3>Rotas e bairros</h3><p class="muted">Configure o nome da rota e os bairros. O dia da semana é definido separadamente quando necessário.</p></div><button class="btn primary" onclick="newRouteConfig()">+ Criar rota</button></div><div class="tablewrap"><table class="table"><thead><tr><th>Rota</th><th>Bairros</th><th></th></tr></thead><tbody>${u.routes.map(x=>`<tr><td>${esc(x.nome)}</td><td>${x.bairros.map(b=>esc(b.bairro)).join(' · ')}</td><td><button class="btn" onclick="editRouteConfig(parseJsonArg('${jsonArg(x)}'))">Editar</button></td></tr>`).join('')||'<tr><td colspan="3">Nenhuma rota configurada.</td></tr>'}</tbody></table></div></div>
 <div class="panel"><div class="panel-title"><div><h3>Designação de rota do vendedor</h3></div></div><div class="form"><div class="field"><label>Vendedor</label><select id="assignSeller">${sellers.map(x=>`<option value="${x.id}">${esc(x.nome)}</option>`).join('')}</select></div><div class="field"><label>Dia</label><select id="assignDay">${['Segunda','Terça','Quarta','Quinta','Sexta','Sábado'].map((x,i)=>`<option value="${i+1}">${x}</option>`).join('')}</select></div><div class="field"><label>Rota</label><select id="assignRoute">${u.routes.map(x=>`<option value="${x.id}">${esc(x.nome)}</option>`).join('')}</select></div><div class="actions"><button class="btn primary" onclick="assignSellerRoute()">Designar rota</button></div></div><div class="tablewrap" style="margin-top:15px"><table class="table"><thead><tr><th>Vendedor</th><th>Rota</th><th>Dia</th><th>Ações</th></tr></thead><tbody>${(u.assignments||[]).map(a=>`<tr><td>${esc(a.vendedor_nome)}</td><td>${esc(a.rota_nome)}</td><td>${['Segunda','Terça','Quarta','Quinta','Sexta','Sábado'][a.dia_semana-1]}</td><td class="actions"><button class="btn danger" onclick="removeRouteAssignment('${a.vendedor_id}',${a.dia_semana})">Remover</button></td></tr>`).join('')||'<tr><td colspan="4">Nenhuma designação configurada.</td></tr>'}</tbody></table></div></div>
 <div id="logisticsDashboard" style="display:none; padding:20px; background:var(--bg); position:absolute; top:0; left:0; width:100%; min-height:100vh; z-index:50;">
  <div class="panel-title"><div><h3>Dashboard: Pedidos em Rota</h3><p class="muted">Monitoramento de pedidos atualmente em entrega.</p></div><button class="btn" onclick="document.getElementById('logisticsDashboard').style.display='none';document.getElementById('logisticsMain').style.display='block'">← Voltar para separação</button></div>
  <div class="tablewrap"><table class="table"><thead><tr><th>Pedido</th><th>Cliente</th><th>Bairro</th><th>Operador/Vendedor</th></tr></thead><tbody>${(o.em_rota||[]).map(x=>`<tr><td>${esc(x.numero)}</td><td>${esc(x.nome_fantasia||x.razao_social)}</td><td>${esc(x.bairro||'')}</td><td>${esc(x.operador_nome||'')}</td></tr>`).join('')||'<tr><td colspan="4">Nenhum pedido em rota.</td></tr>'}</tbody></table></div>
 </div>
 <div class="tablewrap"><table class="table"><thead><tr><th>Data</th><th>Motorista</th><th>Status</th><th>Pedidos</th></tr></thead><tbody>${r.items.map(x=>{let ids=[];try{ids=JSON.parse(x.sequencia_json)}catch{}return `<tr><td>${x.data}</td><td>${esc(x.motorista_nome||'-')}</td><td>${esc(x.status)}</td><td>${ids.length}</td></tr>`}).join('')}</tbody></table></div>`;
}
function newRouteConfig(){routeConfigModal()}

function editRouteConfig(x){routeConfigModal(x)}
window.saveDepotCoordinates = async function(){
  const lat = document.getElementById('depotLatInput')?.value?.trim() || '';
  const lng = document.getElementById('depotLngInput')?.value?.trim() || '';
  try {
    await api('/api/settings', { method: 'POST', body: JSON.stringify({ chave: 'deposito_latitude', valor: lat }) });
    await api('/api/settings', { method: 'POST', body: JSON.stringify({ chave: 'deposito_longitude', valor: lng }) });
    toast('Coordenadas do depósito salvas com sucesso!');
  } catch(e) {
    toast(e.message);
  }
};
function routeConfigModal(x=null){
 const bs=(x?.bairros||[]).map(b=>b.bairro);
 modal(x?'Editar rota':'Nova rota',`<form id="routeConfigForm" class="form"><div class="field"><label>Nome da rota</label><input name="nome" required value="${esc(x?.nome||'')}"></div><div class="field" style="grid-column:1/-1"><label>Bairros (um por linha)</label><textarea name="bairros" rows="8" placeholder="Centro\nIndustrial\nFuncionários">${esc(bs.join('\n'))}</textarea></div><div class="actions"><button class="btn primary">Salvar rota</button></div></form>`);
 $('#routeConfigForm').onsubmit=async e=>{e.preventDefault();const b=Object.fromEntries(new FormData(e.currentTarget));b.bairros=b.bairros.split(/\n|,/).map(x=>x.trim()).filter(Boolean);try{await api(x?'/api/logistics/route-config/'+x.id:'/api/logistics/route-config',{method:x?'PUT':'POST',body:JSON.stringify(b)});closeModal();show('logistics')}catch(z){toast(z.message)}}
}
async function assignSellerRoute(){try{await api('/api/logistics/route-assignments',{method:'POST',body:JSON.stringify({vendedor_id:$('#assignSeller').value,dia_semana:Number($('#assignDay').value),rota_config_id:$('#assignRoute').value})});toast('Rota designada ao vendedor');show('logistics')}catch(e){toast(e.message)}}
async function removeRouteAssignment(vid, dia){if(!confirm('Remover designação de rota deste vendedor neste dia?'))return;try{await api('/api/logistics/route-assignments/'+vid+'/'+dia,{method:'DELETE'});toast('Designação removida');show('logistics')}catch(e){toast(e.message)}}
async function generateLoadingList(){
 const ids=[...document.querySelectorAll('.load-order:checked')].map(x=>x.value);
 if(!ids.length)return toast('Selecione os pedidos agrupados por bairro.');
 try{
  const x=await api('/api/logistics/loading-list',{method:'POST',body:JSON.stringify({pedido_ids:ids})});
  modal('Lista de carregamento',`<div class="panel" style="display:flex; justify-content:space-between; align-items:center"><strong>Produtos para carregamento</strong><button class="btn primary" onclick="downloadAuthPost('/api/logistics/loading-list/pdf',{pedido_ids:parseJsonArg('${jsonArg(ids)}')},'Lista_Carregamento.pdf')">Gerar PDF</button></div> <div style="margin-top:10px;text-align:right"><button class="btn" onclick="downloadAuthPost('/api/logistics/loading-list/orders-pdf',{pedido_ids:parseJsonArg('${jsonArg(ids)}')},'Pedidos_Carregamento.pdf')">🖨️ Imprimir Pedidos em PDF</button></div><div class="tablewrap"><table class="table"><thead><tr><th style="width:140px">Quantidade</th><th>Descrição do Produto</th></tr></thead><tbody>${x.produtos.map(p=>`<tr><td style="width:140px;font-size:1.15em"><strong style="color:var(--xv-primary,#fd5e02)">${p.quantidade_total} un</strong></td><td style="font-size:1.05em;font-weight:750">${esc(p.produto_nome)}</td></tr>`).join('')}</tbody></table></div>`)
 }catch(e){toast(e.message)}
}
async function makeRouteModal(){
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
    
    modal('Gerar Rota Logística', `<form id="generateRouteForm" class="form">
      <div class="field"><label>Motorista (disponível)</label>
      <select name="motorista_id" required>
        ${availableDrivers.map(d=>'<option value="'+d.id+'">'+esc(d.nome)+'</option>').join('')}
      </select></div>
      <div class="field" style="grid-column:1/-1">
        <p>Você selecionou <strong>${ids.length}</strong> pedidos para esta rota.</p>
      </div>
      <div class="actions"><button class="btn primary">Confirmar e Gerar</button></div>
    </form>`);
    
    $('#generateRouteForm').onsubmit=async e=>{
      e.preventDefault();
      closeModal();
      toast('Gerando rota logística...');
      try{
        await api('/api/logistics/routes',{method:'POST',body:JSON.stringify({
          motorista_id: new FormData(e.currentTarget).get('motorista_id'),
          pedido_ids: ids
        })});
        toast('Rota gerada com sucesso!');
        Realtime.emit('routes_changed',{ids});
        Realtime.emit('orders_changed',{ids,status:'ROTA'});
        refreshCurrentViewSilently('routes_changed');
      } catch(ex){ toast(ex.message,true) }
    };
  }
async function reports(v,periodo='geral'){v.innerHTML='<div class="panel">Carregando relatórios...</div>';const qStr=periodo!=='geral'?`?periodo=${periodo}`:'';const r=await api('/api/reports'+qStr);const periodLabels={geral:'Histórico Geral',semanal:'Últimos 7 dias',mensal:'Últimos 30 dias'};const originLabels={VENDEDOR:'Vendedor Externo',BALCAO:'Frente de Loja / PDV',WEB:'Loja Online (Web)'};v.innerHTML=`<div class="panel" style="margin-bottom:14px"><div class="panel-title" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px"><div><h3 style="margin:0">Relatórios Gerenciais</h3><p class="muted" style="margin:4px 0 0">Torre de Controle · Período: <strong>${periodLabels[periodo]||periodo}</strong></p></div><div class="actions" style="display:flex;gap:6px"><button class="btn ${periodo==='geral'?'primary':''}" style="font-size:12px;padding:6px 12px" onclick="reports(document.getElementById('view'),'geral')">Geral</button><button class="btn ${periodo==='semanal'?'primary':''}" style="font-size:12px;padding:6px 12px" onclick="reports(document.getElementById('view'),'semanal')">Semanal</button><button class="btn ${periodo==='mensal'?'primary':''}" style="font-size:12px;padding:6px 12px" onclick="reports(document.getElementById('view'),'mensal')">Mensal</button></div></div></div><div class="grid"><div class="card" style="border-top:4px solid #2ecc71"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><h3 style="margin:0;display:flex;align-items:center;gap:6px"><span>🛒</span> Vendas da Loja Online</h3><span class="badge" style="background:rgba(46,204,113,0.15);color:#2ecc71;border:1px solid rgba(46,204,113,0.3)">Canal Web</span></div><div style="padding:12px;background:rgba(46,204,113,0.08);border-radius:8px;margin-bottom:12px"><div style="font-size:24px;font-weight:800;color:#2ecc71">${brl(r.lojaOnline?.faturamento||0)}</div><small class="muted">${r.lojaOnline?.pedidos||0} pedido(s) concluído(s)</small></div>${(r.lojaOnline?.clientes||[]).length?`<small class="muted" style="font-weight:700;display:block;margin-bottom:6px">Clientes da Loja Online:</small>${r.lojaOnline.clientes.map(x=>`<p style="margin:4px 0">${esc(x.nome)} — <strong>${x.pedidos} pedidos</strong> — ${brl(x.faturamento)}</p>`).join('')}`:'<p class="muted">Nenhuma venda concluída na loja online no período.</p>'}</div><div class="card"><h3>Por Modalidade (Origem)</h3>${(r.origens||[]).map(x=>`<p><strong>${originLabels[x.origem]||x.origem}:</strong> ${x.pedidos} pedidos — <span class="orange">${brl(x.faturamento)}</span></p>`).join('')||'<p class="muted">Nenhum pedido no período.</p>'}</div><div class="card"><h3>Top produtos</h3>${r.topProdutos.slice(0,10).map(x=>`<p>${esc(x.nome)} — <strong>${x.quantidade} un.</strong> — ${brl(x.faturamento)}</p>`).join('')||'<p class="muted">Sem produtos vendidos no período.</p>'}</div><div class="card"><h3>Vendedores</h3>${r.vendedores.map(x=>`<p>${esc(x.nome)} — <strong>${x.pedidos} pedidos</strong> — ${brl(x.faturamento)}</p>`).join('')||'<p class="muted">Sem vendas de vendedores no período.</p>'}</div><div class="card"><h3>Frente de Loja / PDV</h3>${(r.balcao||[]).map(x=>`<p>${esc(x.nome)} — <strong>${x.pedidos} pedidos</strong> — ${brl(x.faturamento)}</p>`).join('')||'<p class="muted">Sem vendas no balcão no período.</p>'}</div></div>`}
async function auditView(v){const a=await api('/api/audit');v.innerHTML=`<div class="tablewrap"><table class="table"><thead><tr><th>Quando</th><th>Usuário</th><th>Ação</th><th>Entidade</th><th>ID</th></tr></thead><tbody>${a.items.map(x=>`<tr><td>${new Date(x.created_at).toLocaleString('pt-BR')}</td><td>${esc(x.user_nome||'-')}</td><td>${esc(x.action)}</td><td>${esc(x.entity)}</td><td>${esc(x.entity_id||'-')}</td></tr>`).join('')}</tbody></table></div>`}
async function ai(v){
  let status = { configured: false, model: 'openai/gpt-oss-120b' };
  try {
    status = await api('/api/admin/ia/status');
  } catch {}

  v.innerHTML = `
    <div class="panel">
      <div class="panel-title" style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px">
        <div>
          <h3>Assistente Administrativo</h3>
          
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <span class="badge" style="background:${status.configured ? '#10b981' : '#f59e0b'};color:#07101a;font-weight:700">
            ${status.configured ? '✓ Groq Conectado' : '⚠ Chave Groq Pendente'}
          </span>
          <span class="badge" style="background:#0284c7;color:#fff">
            🔒 100% Somente Leitura
          </span>
        </div>
      </div>

      ${!status.configured ? `
        <div style="background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);border-radius:8px;padding:14px;margin-bottom:18px">
          <strong style="color:#fbbf24">Configuração da chave Groq:</strong>
          <p class="muted" style="margin:6px 0 10px;font-size:13px">
            Para ativar as análises inteligentes do modelo <code>${esc(status.model)}</code>, insira sua chave da API do Groq abaixo (ou declare <code>GROQ_API_KEY</code> no arquivo <code>.env</code>):
          </p>
          <div style="display:flex;gap:8px">
            <input id="quickGroqKey" type="password" placeholder="gsk_..." style="flex:1;max-width:400px;background:#091227;color:white;border:1px solid var(--border);border-radius:6px;padding:8px 12px">
            <button class="btn primary" onclick="saveGroqKey()">Salvar Chave</button>
          </div>
        </div>
      ` : `
        <div style="margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.2);padding:10px 14px;border-radius:8px">
          <span style="font-size:13px;color:#34d399">API Groq configurada e pronta para consultas com leitura em todo o banco de dados.</span>
          <button class="btn" style="font-size:12px;padding:4px 10px" onclick="changeGroqKeyModal()">Alterar chave</button>
        </div>
      `}

      <div style="margin-bottom:12px">
        <label style="font-size:12px;color:var(--muted);display:block;margin-bottom:6px">Sugestões rápidas de consulta:</label>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn" style="font-size:12px;padding:5px 10px" onclick="fillAIQuery('Qual o faturamento geral, total de pedidos e ticket médio?')">Faturamento e pedidos</button>
          <button class="btn" style="font-size:12px;padding:5px 10px" onclick="fillAIQuery('Quais produtos estão com estoque crítico ou zerado?')">Estoque crítico</button>
          <button class="btn" style="font-size:12px;padding:5px 10px" onclick="fillAIQuery('Quais os clientes com maior volume de compras?')">Top clientes</button>
          <button class="btn" style="font-size:12px;padding:5px 10px" onclick="fillAIQuery('Qual a situação das entregas e rotas logísticas hoje?')">Situação logística</button>
        </div>
      </div>

      <textarea id="aimsg" style="width:100%;height:100px;background:#091227;color:white;border:1px solid var(--border);border-radius:8px;padding:10px;font-family:inherit;font-size:14px" placeholder="Faça uma pergunta sobre qualquer dado do ERP (ex: Quais os produtos mais vendidos da categoria Bebidas?)..."></textarea>
      
      <div style="margin-top:12px;display:flex;align-items:center;gap:12px">
        <button id="aiSubmitBtn" class="btn primary" onclick="askAI()">Consultar IA Administrativa</button>
        <span id="aiLoadingIndicator" style="display:none;color:var(--xv-orange);font-size:13px">⏳ Analisando banco de dados no Groq...</span>
      </div>

      <div id="airespWrap" style="margin-top:20px;display:none">
        <h4 style="margin-bottom:8px">Resposta:</h4>
        <pre id="airesp" style="background:#07101a;border:1px solid var(--border);border-radius:8px;padding:16px;white-space:pre-wrap;word-break:break-word;font-size:14px;line-height:1.6;color:#e2e8f0"></pre>
        <div id="aiQueriesWrap" style="margin-top:10px"></div>
      </div>
    </div>
  `;
}

window.fillAIQuery = function(text){
  const el = document.getElementById('aimsg');
  if(el){ el.value = text; el.focus(); }
};

window.saveGroqKey = async function(){
  const val = document.getElementById('quickGroqKey')?.value?.trim();
  if(!val) return toast('Informe a chave Groq.');
  try {
    await api('/api/settings', { method: 'POST', body: JSON.stringify({ chave: 'groq.api_key', valor: val }) });
    toast('Chave Groq configurada com sucesso!');
    show('ai');
  } catch(e) {
    toast(e.message);
  }
};

window.changeGroqKeyModal = function(){
  modal('Alterar Chave Groq API', `
    <form id="groqKeyForm" class="form">
      <div class="field">
        <label>Nova Chave da API (gsk_...)</label>
        <input name="key" type="password" required placeholder="gsk_...">
      </div>
      <div class="actions">
        <button class="btn primary">Salvar Chave</button>
      </div>
    </form>
  `);
  $('#groqKeyForm').onsubmit = async e => {
    e.preventDefault();
    const key = new FormData(e.currentTarget).get('key')?.trim();
    if(!key) return toast('Informe a chave.');
    try {
      await api('/api/settings', { method: 'POST', body: JSON.stringify({ chave: 'groq.api_key', valor: key }) });
      closeModal();
      toast('Chave Groq atualizada com sucesso!');
      show('ai');
    } catch(err) {
      toast(err.message);
    }
  };
};

async function askAI(){
  const msg = $('#aimsg')?.value?.trim();
  if(!msg) return toast('Digite sua pergunta antes de consultar.');
  
  const btn = document.getElementById('aiSubmitBtn');
  const spinner = document.getElementById('aiLoadingIndicator');
  const respWrap = document.getElementById('airespWrap');
  const respBox = document.getElementById('airesp');
  const queriesWrap = document.getElementById('aiQueriesWrap');

  if(btn) btn.disabled = true;
  if(spinner) spinner.style.display = 'inline';
  if(respWrap) respWrap.style.display = 'none';

  try {
    const x = await api('/api/admin/ia', { method: 'POST', body: JSON.stringify({ message: msg }) });
    if(respBox) respBox.textContent = x.answer;
    if(queriesWrap) {
      if(x.queries && x.queries.length > 0) {
        queriesWrap.innerHTML = `
          <details style="background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:6px;padding:10px">
            <summary style="cursor:pointer;color:var(--muted);font-size:12px;font-weight:600">
              🔍 ${x.queries.length} consulta(s) SQL somente-leitura executadas no banco
            </summary>
            <div style="margin-top:8px">
              ${x.queries.map(q => `
                <div style="margin-bottom:6px;font-family:monospace;font-size:12px;background:#050b14;padding:6px;border-radius:4px;border:1px solid rgba(255,255,255,0.08)">
                  <span style="color:#38bdf8">${esc(q.sql)}</span>
                  <span class="muted" style="margin-left:8px">(${q.count !== undefined ? q.count + ' linha(s)' : esc(q.error||'')})</span>
                </div>
              `).join('')}
            </div>
          </details>
        `;
      } else {
        queriesWrap.innerHTML = '';
      }
    }
    if(respWrap) respWrap.style.display = 'block';
  } catch(e) {
    toast(e.message);
  } finally {
    if(btn) btn.disabled = false;
    if(spinner) spinner.style.display = 'none';
  }
}
function filterTable(input,id){const q=input.value.toLowerCase();document.querySelectorAll(`#${id} tbody tr`).forEach(r=>r.style.display=r.innerText.toLowerCase().includes(q)?'':'none')}
function modal(title,body,width='700px'){const x=document.createElement('div');x.id='modal';x.style='position:fixed;inset:0;background:#000b;display:grid;place-items:center;z-index:100';x.innerHTML=`<div class="panel" style="width:min(${width},94vw);max-height:90vh;overflow:auto"><div class="top"><h2>${title}</h2><button class="btn" onclick="closeModal()">×</button></div>${body}</div>`;document.body.appendChild(x)}function closeModal(){document.querySelector('#modal')?.remove()}
function roleLoginPage(role){document.body.innerHTML=`<div class="login"><div class="loginbox"><div class="brand">Xiquim <span>Vargas</span></div><h1>${role}</h1><p style="color:var(--muted)">Entre com suas credenciais.</p><form onsubmit="login(event)"><div class="field"><label>Email</label><input name="email" type="email" required></div><br><div class="field"><label>Senha</label><div style="display:flex;gap:6px"><input name="password" type="password" required style="flex:1"><button type="button" class="btn" tabindex="-1" onclick="const x=this.previousElementSibling; x.type=x.type==='password'?'text':'password'">👁</button></div></div><br><button class="btn primary" style="width:100%">Entrar</button></form><p style="color:var(--muted);font-size:16px">Servidor local: ${location.origin}</p></div></div><div id="toast" class="toast"></div>`}
boot();


function pricesSearchClient(q){
  const r=$('#applyIndivResults');
  const sq=q.trim().toLowerCase();
  if(!sq){r.style.display='none';return}
  const items=(window._pricesClients||[]).filter(x=>
    (x.razao_social||'').toLowerCase().includes(sq)||
    (x.nome_fantasia||'').toLowerCase().includes(sq)||
    (x.cnpj_cpf||'').toLowerCase().includes(sq)||
    (x.telefone||'').toLowerCase().includes(sq)||
    (x.bairro||'').toLowerCase().includes(sq)||
    (x.cidade||'').toLowerCase().includes(sq)||
    (x.email||'').toLowerCase().includes(sq)
  );
  if(!items.length){r.innerHTML='<div style="padding:10px;color:#888">Nenhum cliente encontrado.</div>';r.style.display='block';return}
  r.innerHTML=items.slice(0,50).map(x=>`<div style="padding:10px;border-bottom:1px solid #eee;cursor:pointer" onclick="$('#applyIndivSearch').value='${esc(x.razao_social||x.nome_fantasia)}';$('#applyIndivId').value='${x.id}';$('#applyIndivResults').style.display='none'"><strong>${esc(x.razao_social||x.nome_fantasia)}</strong><br><small style="color:#666">${esc(x.cnpj_cpf||'Sem documento')}${x.telefone?' · '+esc(x.telefone):''}${x.bairro?' · '+esc(x.bairro):''}</small></div>`).join('');
  r.style.display='block';
}
document.addEventListener('click', e => {
  const r = document.getElementById('applyIndivResults');
  if(r && r.style.display==='block' && !e.target.closest('#applyIndivForm')){
    r.style.display = 'none';
  }
});

/* ================================================================
   MÓDULO: GESTÃO DE FORNECEDORES (SRM) & ASSOCIAÇÃO PRODUTO-FORNECEDOR
   ================================================================ */
async function suppliers(v){
  const s = await api('/api/suppliers');
  window._suppliersData = s.items || [];
  const totalForn = window._suppliersData.length;
  const totalProd = window._suppliersData.reduce((a,x)=>a+Number(x.total_produtos||0),0);
  const comprasAbertas = window._suppliersData.reduce((a,x)=>a+Number(x.compras_abertas||0),0);

  v.innerHTML = `
    <div class="panel">
      <div class="panel-title">
        <div>
          <h3>Gestão e Organização de Fornecedores</h3>
          <p class="muted">Gerencie seus parceiros comerciais, lead times de entrega e catálogo de produtos vinculados.</p>
        </div>
        <div class="actions">
          <button class="btn" onclick="show('inbound')">📥 Recebimento de Mercadorias</button>
          <button class="btn primary" onclick="newSupplierModal()">+ Novo Fornecedor</button>
        </div>
      </div>
      <div class="grid" style="margin-top:14px;margin-bottom:14px">
        <div class="card kpi">
          <div class="l">🏢 Fornecedores Ativos</div>
          <div class="v">${totalForn}</div>
        </div>
        <div class="card kpi">
          <div class="l">📦 Produtos Vinculados</div>
          <div class="v">${totalProd}</div>
        </div>
        <div class="card kpi">
          <div class="l">🚚 Compras em Andamento</div>
          <div class="v" style="color:var(--xv-orange)">${comprasAbertas}</div>
        </div>
      </div>
      <div class="actions" style="margin-top:16px;margin-bottom:12px">
        <input id="supplierSearch" class="search" style="max-width:400px" placeholder="Buscar por nome, CNPJ, telefone ou cidade..." oninput="filterSuppliers(this.value)">
      </div>
      <div id="supplierTableWrap" class="tablewrap">
        ${renderSuppliersTable(window._suppliersData)}
      </div>
    </div>
  `;
}

function renderSuppliersTable(list){
  if(!list.length) return `<div class="empty-state">Nenhum fornecedor cadastrado. Clique em "+ Novo Fornecedor" para começar.</div>`;
  return `
    <table class="table">
      <thead>
        <tr>
          <th>Nome do Fornecedor</th>
          <th>Razão Social / Fantasia</th>
          <th>CNPJ/CPF</th>
          <th>Contato / WhatsApp</th>
          <th>Cidade/UF</th>
          <th>Prazo Médio</th>
          <th>Produtos</th>
          <th>Compras Abertas</th>
          <th>Ações</th>
        </tr>
      </thead>
      <tbody>
        ${list.map(f=>`
          <tr data-supplier="${f.id}">
            <td><strong style="color:#fff;font-size:14px">${esc(f.nome)}</strong></td>
            <td>${esc(f.nome_fantasia || f.razao_social || '—')}</td>
            <td>${esc(f.cnpj_cpf || '—')}</td>
            <td>${esc([f.contato_nome, f.telefone_whatsapp].filter(Boolean).join(' · ') || '—')}</td>
            <td>${esc([f.cidade, f.estado].filter(Boolean).join('/') || '—')}</td>
            <td><span class="badge">${f.lead_time_padrao_dias} dias</span></td>
            <td>
              <button class="btn" style="padding:5px 10px;font-size:12px" onclick="supplierProductsModal('${f.id}',parseJsonArg('${jsonArg(f.nome)}'))">
                📦 ${f.total_produtos} vinculados
              </button>
            </td>
            <td>
              <span class="badge ${Number(f.compras_abertas)>0?'badge-lead-today':''}">${f.compras_abertas}</span>
            </td>
            <td>
              <button class="btn primary" style="padding:6px 10px;font-size:12px" onclick="newPurchaseOrderModal('${f.id}')">➕ Comprar</button>
              <button class="btn" style="padding:6px 10px;font-size:12px" onclick="editSupplierModal('${f.id}')">Editar</button>
              <button class="btn danger" style="padding:6px 10px;font-size:12px" onclick="deleteSupplier('${f.id}',parseJsonArg('${jsonArg(f.nome)}'))">🗑</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function filterSuppliers(q){
  const sq = (q||'').toLowerCase().trim();
  const filtered = (window._suppliersData||[]).filter(f =>
    (f.nome||'').toLowerCase().includes(sq) ||
    (f.razao_social||'').toLowerCase().includes(sq) ||
    (f.nome_fantasia||'').toLowerCase().includes(sq) ||
    (f.cnpj_cpf||'').toLowerCase().includes(sq) ||
    (f.telefone_whatsapp||'').toLowerCase().includes(sq) ||
    (f.cidade||'').toLowerCase().includes(sq)
  );
  const wrap = document.getElementById('supplierTableWrap');
  if(wrap) wrap.innerHTML = renderSuppliersTable(filtered);
}

function supplierFormHtml(x={}){
  return `
    <form id="supplierForm" class="form">
      <div class="field" style="grid-column:1/-1">
        <label>Nome do Fornecedor *</label>
        <input name="nome" required maxlength="180" placeholder="Ex: Distribuidora Central de Bebidas" value="${esc(x.nome||'')}">
        <small class="muted">Identificação principal do fornecedor no ERP.</small>
      </div>
      <div class="field">
        <label>Nome Fantasia (opcional)</label>
        <input name="nome_fantasia" value="${esc(x.nome_fantasia||'')}">
      </div>
      <div class="field">
        <label>Razão Social (opcional)</label>
        <input name="razao_social" value="${esc(x.razao_social||'')}">
      </div>
      <div class="field">
        <label>CNPJ / CPF</label>
        <input name="cnpj_cpf" placeholder="00.000.000/0000-00" value="${esc(x.cnpj_cpf||'')}">
      </div>
      <div class="field">
        <label>Contato / Representante</label>
        <input name="contato_nome" placeholder="Ex: Roberto Vendas" value="${esc(x.contato_nome||'')}">
      </div>
      <div class="field">
        <label>Telefone / WhatsApp</label>
        <input name="telefone_whatsapp" placeholder="(00) 00000-0000" value="${esc(x.telefone_whatsapp||'')}">
      </div>
      <div class="field">
        <label>E-mail</label>
        <input name="email" type="email" value="${esc(x.email||'')}">
      </div>
      <div class="field">
        <label>Prazo Médio de Entrega (dias)</label>
        <input name="lead_time_padrao_dias" type="number" min="1" max="365" value="${x.lead_time_padrao_dias||5}" required>
      </div>
      <div class="field">
        <label>Cidade</label>
        <input name="cidade" value="${esc(x.cidade||'')}">
      </div>
      <div class="field">
        <label>Estado (UF)</label>
        <input name="estado" maxlength="2" placeholder="MG, SP, etc." value="${esc(x.estado||'')}">
      </div>
      <div class="field" style="grid-column:1/-1">
        <label>Endereço Completo</label>
        <input name="endereco" value="${esc(x.endereco||'')}">
      </div>
      <div class="field" style="grid-column:1/-1">
        <label>Condições de Pagamento acordadas</label>
        <input name="condicoes_pagamento" placeholder="Ex: 28 dias boleto, à vista com 5% de desconto" value="${esc(x.condicoes_pagamento||'')}">
      </div>
      <div class="field" style="grid-column:1/-1">
        <label>Observações internas</label>
        <textarea name="observacoes" rows="2">${esc(x.observacoes||'')}</textarea>
      </div>
      <div class="actions" style="grid-column:1/-1;margin-top:10px">
        <button type="button" class="btn" onclick="closeModal()">Cancelar</button>
        <button class="btn primary">Salvar Fornecedor</button>
      </div>
    </form>
  `;
}

function newSupplierModal(){
  modal('Cadastrar Novo Fornecedor', supplierFormHtml());
  $('#supplierForm').onsubmit = async e => {
    e.preventDefault();
    try {
      const b = Object.fromEntries(new FormData(e.currentTarget));
      await api('/api/suppliers', { method:'POST', body: JSON.stringify(b) });
      closeModal();
      toast('Fornecedor cadastrado com sucesso!');
      show('suppliers');
    } catch(err) {
      toast(err.message, true);
    }
  };
}

async function editSupplierModal(id){
  try {
    const data = await api('/api/suppliers/' + id);
    modal('Editar Fornecedor — ' + esc(data.supplier.nome), supplierFormHtml(data.supplier));
    $('#supplierForm').onsubmit = async e => {
      e.preventDefault();
      try {
        const b = Object.fromEntries(new FormData(e.currentTarget));
        await api('/api/suppliers/' + id, { method:'PUT', body: JSON.stringify(b) });
        closeModal();
        toast('Dados do fornecedor atualizados');
        show('suppliers');
      } catch(err) {
        toast(err.message, true);
      }
    };
  } catch(e) {
    toast(e.message, true);
  }
}

async function deleteSupplier(id, nome){
  if(!confirm(`Desativar o fornecedor "${nome}"?\n\nO histórico de compras e produtos vinculados será preservado.`)) return;
  try {
    await api('/api/suppliers/' + id, { method:'DELETE' });
    toast(`Fornecedor "${nome}" desativado`);
    show('suppliers');
  } catch(e) {
    toast(e.message, true);
  }
}

/* ================================================================
   ASSOCIAÇÃO PRODUTO <-> FORNECEDOR (N:N)
   ================================================================ */
async function supplierProductsModal(fid, fnome){
  try {
    const res = await api('/api/suppliers/' + fid + '/products');
    const prods = res.items || [];
    modal(`Catálogo de Produtos — ${esc(fnome)}`, `
      <div class="actions" style="margin-bottom:14px;justify-content:space-between">
        <div>
          <span class="badge" style="font-size:12px">${prods.length} produto(s) associado(s) a este fornecedor</span>
        </div>
        <button class="btn primary" onclick="linkProductsToSupplierModal('${fid}',parseJsonArg('${jsonArg(fnome)}'))">
          + Associar Produtos do Catálogo
        </button>
      </div>
      <div class="tablewrap" style="max-height:460px">
        <table class="table">
          <thead>
            <tr>
              <th>Produto</th>
              <th>Ref. Fornecedor</th>
              <th>Custo de Compra</th>
              <th>Preço de Venda</th>
              <th>Previsão de Entrega</th>
              <th>Mínimo</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            ${prods.map(p=>`
              <tr>
                <td>
                  <div class="catalog-product-cell">
                    ${p.foto_url?`<img class="catalog-mini-photo" src="${esc(p.foto_url)}">`:'<div class="catalog-mini-photo placeholder">XV</div>'}
                    <div>
                      <strong>${esc(p.produto_nome)}</strong><br>
                      <small class="muted">SKU: ${esc(p.produto_sku||'-')} · Saldo Disp: ${p.quantidade_disponivel||0}</small>
                    </div>
                  </div>
                </td>
                <td>${esc(p.codigo_referencia_fornecedor||'—')}</td>
                <td><strong class="orange">${brl(p.custo_aquisicao)}</strong></td>
                <td>${brl(p.produto_preco_base)}</td>
                <td><span class="badge">${p.lead_time_dias ? `${p.lead_time_dias} dias` : 'Padrão'}</span></td>
                <td>${p.quantidade_minima_compra||1} un</td>
                <td>
                  <button class="btn danger" style="padding:4px 8px;font-size:12px" onclick="unlinkSupplierProduct('${fid}','${p.produto_id}',parseJsonArg('${jsonArg(fnome)}'))">Desvincular</button>
                </td>
              </tr>
            `).join('') || '<tr><td colspan="7">Nenhum produto associado a este fornecedor ainda. Clique no botão acima para associar.</td></tr>'}
          </tbody>
        </table>
      </div>
      <div class="actions" style="margin-top:14px;justify-content:flex-end">
        <button class="btn" onclick="closeModal()">Fechar</button>
      </div>
    `, '900px');
  } catch(e) {
    toast(e.message, true);
  }
}

async function unlinkSupplierProduct(fid, pid, fnome){
  if(!confirm('Remover o vínculo deste produto com o fornecedor?')) return;
  try {
    await api(`/api/suppliers/${fid}/products/${pid}`, { method:'DELETE' });
    toast('Produto desvinculado do fornecedor');
    supplierProductsModal(fid, fnome);
  } catch(e) {
    toast(e.message, true);
  }
}

async function linkProductsToSupplierModal(fid, fnome){
  const catalog = window.adminProducts?.items || (await api('/api/products?limit=100000')).items;
  modal(`Associar Produto ao Fornecedor — ${esc(fnome)}`, `
    <form id="linkProdForm" class="form">
      <div class="field" style="grid-column:1/-1">
        <label>Selecione o Produto do Catálogo *</label>
        <input id="linkProdSearch" class="search" placeholder="Buscar produto por nome ou SKU..." oninput="filterCatalogForLink(this.value)">
        <select id="linkProdSelect" name="produto_id" size="6" required style="margin-top:6px;width:100%">
          ${catalog.map(p=>`<option value="${p.id}" data-text="${esc((p.nome+' '+(p.sku||'')).toLowerCase())}">${esc(p.nome)} (${esc(p.sku||'S/ SKU')}) — Venda: ${brl(p.preco_base)}</option>`).join('')}
        </select>
      </div>
      <div class="field">
        <label>Custo de Aquisição (R$) *</label>
        <input name="custo_aquisicao" type="number" step="0.01" min="0" required placeholder="0.00">
      </div>
      <div class="field">
        <label>Código / Referência no Fornecedor (opcional)</label>
        <input name="codigo_referencia_fornecedor" placeholder="Ex: REF-8812">
      </div>
      <div class="field">
        <label>Prazo de Entrega Específico (dias)</label>
        <input name="lead_time_dias" type="number" min="1" placeholder="Em branco usa o padrão do fornecedor">
      </div>
      <div class="field">
        <label>Lote Mínimo de Compra (unidades)</label>
        <input name="quantidade_minima_compra" type="number" min="1" value="1">
      </div>
      <div class="actions" style="grid-column:1/-1;margin-top:10px">
        <button type="button" class="btn" onclick="supplierProductsModal('${fid}',parseJsonArg('${jsonArg(fnome)}'))">← Voltar</button>
        <button class="btn primary">Confirmar Associação</button>
      </div>
    </form>
  `, '750px');

  $('#linkProdForm').onsubmit = async e => {
    e.preventDefault();
    try {
      const b = Object.fromEntries(new FormData(e.currentTarget));
      await api(`/api/suppliers/${fid}/products`, {
        method: 'POST',
        body: JSON.stringify({
          produto_id: b.produto_id,
          custo_aquisicao: Number(b.custo_aquisicao||0),
          codigo_referencia_fornecedor: b.codigo_referencia_fornecedor||null,
          lead_time_dias: b.lead_time_dias ? Number(b.lead_time_dias) : null,
          quantidade_minima_compra: Number(b.quantidade_minima_compra||1)
        })
      });
      toast('Produto associado com sucesso!');
      supplierProductsModal(fid, fnome);
    } catch(err) {
      toast(err.message, true);
    }
  };
}

function filterCatalogForLink(q){
  const sq = (q||'').toLowerCase().trim();
  document.querySelectorAll('#linkProdSelect option').forEach(opt => {
    opt.hidden = sq ? !opt.dataset.text.includes(sq) : false;
  });
}

async function productSuppliersModal(pid, pnome){
  try {
    const res = await api('/api/products/' + pid + '/suppliers');
    const items = res.items || [];
    modal(`Fornecedores Homologados — ${esc(pnome)}`, `
      <p class="muted" style="margin-bottom:12px">Compare custos de aquisição e prazos de entrega entre os fornecedores cadastrados para este produto.</p>
      <div class="tablewrap">
        <table class="table">
          <thead>
            <tr>
              <th>Fornecedor</th>
              <th>Custo de Compra</th>
              <th>Previsão de Entrega</th>
              <th>Telefone / Contato</th>
              <th>Ação</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(s=>`
              <tr>
                <td><strong>${esc(s.fornecedor_nome)}</strong></td>
                <td><strong class="orange">${brl(s.custo_aquisicao)}</strong></td>
                <td><span class="badge">${s.lead_time_dias || s.lead_time_padrao_dias || 5} dias</span></td>
                <td>${esc(s.telefone_whatsapp||'—')}</td>
                <td>
                  <button class="btn primary" style="padding:4px 8px;font-size:12px" onclick="closeModal();newPurchaseOrderModal('${s.fornecedor_id}')">➕ Comprar deste</button>
                </td>
              </tr>
            `).join('') || '<tr><td colspan="5">Nenhum fornecedor vinculado a este produto ainda. Acesse o menu "Fornecedores" para vincular.</td></tr>'}
          </tbody>
        </table>
      </div>
      <div class="actions" style="margin-top:14px;justify-content:flex-end">
        <button class="btn" onclick="closeModal()">Fechar</button>
      </div>
    `, '750px');
  } catch(e) {
    toast(e.message, true);
  }
}

/* ================================================================
   MÓDULO: GESTÃO DE RECEBIMENTO DE MERCADORIAS (DOCA & INBOUND)
   ================================================================ */
async function inbound(v){
  const [summary, res] = await Promise.all([
    api('/api/inbound/summary'),
    api('/api/purchases')
  ]);
  window._inboundSummary = summary;
  window._purchasesData = res.items || [];

  v.innerHTML = `
    <div class="panel">
      <div class="panel-title">
        <div>
          <h3>Doca de Recebimento de Mercadorias</h3>
          <p class="muted">Gestão de compras, prazos de entrega determinados por fornecedor e conferência de entrada.</p>
        </div>
        <div class="actions">
          <button class="btn" onclick="show('suppliers')">🏢 Fornecedores</button>
          <button class="btn primary" onclick="newPurchaseOrderModal()">+ Novo Pedido de Compra</button>
        </div>
      </div>
      <div class="grid" style="margin-top:14px;margin-bottom:14px">
        <div class="card kpi">
          <div class="l">🚚 Aguardando Chegada</div>
          <div class="v">${summary.aguardando}</div>
        </div>
        <div class="card kpi">
          <div class="l">🟡 Chegando Hoje</div>
          <div class="v" style="color:#f59e0b">${summary.hoje}</div>
        </div>
        <div class="card kpi">
          <div class="l">🔴 Entregas Atrasadas</div>
          <div class="v" style="color:#ef4444">${summary.atrasados}</div>
        </div>
        <div class="card kpi">
          <div class="l">�
 Recebidos no Mês</div>
          <div class="v" style="color:#22c55e">${summary.recebidosMes}</div>
        </div>
        <div class="card kpi">
          <div class="l">💰 Reposição no Mês</div>
          <div class="v" style="font-size:20px">${brl(summary.valorMes)}</div>
        </div>
      </div>
      <div class="actions" style="margin-top:16px;margin-bottom:12px;justify-content:space-between">
        <div style="display:flex;gap:10px;align-items:center;flex:1;max-width:600px">
          <input id="inboundSearch" class="search" placeholder="Buscar por pedido PC-..., fornecedor ou NF..." oninput="filterInbound()">
          <select id="inboundStatusFilter" class="field-input" onchange="filterInbound()">
            <option value="ALL">Todos os status</option>
            <option value="PENDENTES">Em Aberto (Aguardando/Em Trânsito)</option>
            <option value="CONFIRMADO">Confirmados</option>
            <option value="A_CAMINHO">A Caminho (Em Trânsito)</option>
            <option value="RECEBIDO_PARCIAL">Recebimento Parcial</option>
            <option value="CONCLUIDO">Concluídos</option>
            <option value="ATRASADOS">Atrasados</option>
          </select>
        </div>
      </div>
      <div id="inboundTableWrap" class="tablewrap">
        ${renderInboundTable(window._purchasesData)}
      </div>
    </div>
  `;
}

function renderInboundTable(list){
  if(!list.length) return `<div class="empty-state">Nenhum pedido de compra encontrado. Clique em "+ Novo Pedido de Compra".</div>`;
  return `
    <table class="table">
      <thead>
        <tr>
          <th>Pedido Compra</th>
          <th>Fornecedor</th>
          <th>Emissão</th>
          <th>Previsão de Entrega</th>
          <th>Status</th>
          <th>Itens / Qtd</th>
          <th>Valor Total</th>
          <th>NF</th>
          <th>Ações</th>
        </tr>
      </thead>
      <tbody>
        ${list.map(c => {
          let leadBadge = '';
          if(c.lead_status === 'ATRASADO') leadBadge = `<span class="badge badge-lead-late">🔴 Atrasado (${Math.abs(c.diff_dias)}d)</span>`;
          else if(c.lead_status === 'HOJE') leadBadge = `<span class="badge badge-lead-today">🟡 Chega Hoje</span>`;
          else if(c.lead_status === 'NO_PRAZO') leadBadge = `<span class="badge badge-lead-ontime">🟢 Em ${c.diff_dias}d (${new Date(c.previsao_entrega).toLocaleDateString('pt-BR')})</span>`;
          else if(c.lead_status === 'CONCLUIDO') leadBadge = `<span class="badge status-concluido">✓ Entregue</span>`;
          else leadBadge = `<span class="badge">Cancelado</span>`;

          const isOpen = (c.status !== 'CONCLUIDO' && c.status !== 'CANCELADO');

          return `
            <tr>
              <td><strong style="color:var(--xv-orange);cursor:pointer" onclick="purchaseDetailModal('${c.id}')">${esc(c.numero)}</strong></td>
              <td><strong>${esc(c.fornecedor_nome)}</strong></td>
              <td>${new Date(c.data_emissao).toLocaleDateString('pt-BR')}</td>
              <td>${leadBadge}</td>
              <td><span class="badge status-${String(c.status).toLowerCase()}">${esc(c.status)}</span></td>
              <td>${c.total_itens} itens (${c.total_qtd_recebida}/${c.total_qtd_pedida} un)</td>
              <td><strong>${brl(c.valor_total)}</strong></td>
              <td>${esc(c.numero_nota_fiscal||'—')}</td>
              <td>
                ${isOpen ? `<button class="btn btn-quick-receive" style="padding:6px 12px;font-size:12px" onclick="receivePurchaseOrderModal('${c.id}')">📥 Receber</button>` : ''}
                <button class="btn" style="padding:6px 10px;font-size:12px" onclick="purchaseDetailModal('${c.id}')">Detalhes</button>
                ${isOpen && c.status === 'CONFIRMADO' ? `<button class="btn" style="padding:6px 10px;font-size:12px" onclick="advancePurchaseStatus('${c.id}','A_CAMINHO')">🚚 Em Trânsito</button>` : ''}
                ${isOpen ? `<button class="btn danger" style="padding:6px 10px;font-size:12px" onclick="cancelPurchaseOrder('${c.id}','${c.numero}')">Cancelar</button>` : ''}
              </td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
}

function filterInbound(){
  const q = ($('#inboundSearch')?.value || '').toLowerCase().trim();
  const st = $('#inboundStatusFilter')?.value || 'ALL';
  const filtered = (window._purchasesData || []).filter(c => {
    const matchText = (c.numero||'').toLowerCase().includes(q) ||
                      (c.fornecedor_nome||'').toLowerCase().includes(q) ||
                      (c.numero_nota_fiscal||'').toLowerCase().includes(q);
    if(!matchText) return false;
    if(st === 'ALL') return true;
    if(st === 'PENDENTES') return (c.status !== 'CONCLUIDO' && c.status !== 'CANCELADO');
    if(st === 'ATRASADOS') return (c.lead_status === 'ATRASADO');
    return (c.status === st);
  });
  const wrap = document.getElementById('inboundTableWrap');
  if(wrap) wrap.innerHTML = renderInboundTable(filtered);
}

/* ================================================================
   EMISSÃO DE PEDIDO DE COMPRA COM PRAZO DETERMINADO
   ================================================================ */
async function newPurchaseOrderModal(preselectedSupplierId=null){
  const suppliers = (await api('/api/suppliers')).items || [];
  if(!suppliers.length) return alert('Cadastre ao menos um fornecedor antes de emitir um pedido de compra.');

  modal('Novo Pedido de Compra', `
    <form id="purchaseOrderForm" class="form">
      <div class="field">
        <label>Fornecedor *</label>
        <select id="poSupplierSelect" name="fornecedor_id" required class="field-input" onchange="onPoSupplierChange(this.value)">
          <option value="">Selecione o Fornecedor...</option>
          ${suppliers.map(s=>`<option value="${s.id}" data-lead="${s.lead_time_padrao_dias}" ${s.id===preselectedSupplierId?'selected':''}>${esc(s.nome)} (Prazo médio: ${s.lead_time_padrao_dias}d)</option>`).join('')}
        </select>
      </div>
      <div class="field">
        <label>Prazo de Entrega Prometido pelo Fornecedor (ETA) *</label>
        <input id="poPrevisaoInput" name="previsao_entrega" type="date" required class="field-input">
      </div>
      <div class="field">
        <label>Número da Nota Fiscal (se já emitida)</label>
        <input name="numero_nota_fiscal" placeholder="Ex: NF-e 45291" class="field-input">
      </div>
      <div class="field" style="grid-column:1/-1">
        <label>Observações do Pedido</label>
        <input name="observacoes" placeholder="Condições de frete, transportadora ou instruções de descarga..." class="field-input">
      </div>

      <div style="grid-column:1/-1;margin-top:14px;border-top:1px solid #24344b;padding-top:14px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <h4 style="margin:0">Itens do Pedido</h4>
          <button type="button" class="btn" style="font-size:12px" onclick="addPoItemRow()">+ Adicionar Item</button>
        </div>
        <div id="poItemsContainer" style="display:grid;gap:8px"></div>
        <div style="display:flex;justify-content:flex-end;margin-top:12px;font-size:16px">
          <span>Total do Pedido: <strong id="poTotalDisplay" class="orange">R$ 0,00</strong></span>
        </div>
      </div>

      <div class="actions" style="grid-column:1/-1;margin-top:14px;justify-content:flex-end">
        <button type="button" class="btn" onclick="closeModal()">Cancelar</button>
        <button class="btn primary">Emitir Pedido de Compra</button>
      </div>
    </form>
  `, '850px');

  window._currentPoSupplierProducts = [];
  if(preselectedSupplierId){
    onPoSupplierChange(preselectedSupplierId);
  }

  $('#purchaseOrderForm').onsubmit = async e => {
    e.preventDefault();
    const rows = document.querySelectorAll('.po-item-row');
    if(!rows.length) return alert('Adicione ao menos um item ao pedido.');
    const itens = [];
    rows.forEach(r => {
      const pid = r.querySelector('.po-prod-id').value;
      const q = Number(r.querySelector('.po-prod-qtd').value);
      const c = Number(r.querySelector('.po-prod-custo').value);
      if(pid && q > 0) itens.push({ produto_id: pid, quantidade: q, custo_unitario: c });
    });
    if(!itens.length) return alert('Preencha as quantidades dos itens.');

    const b = Object.fromEntries(new FormData(e.currentTarget));
    b.itens = itens;

    try {
      const res = await api('/api/purchases', { method:'POST', body: JSON.stringify(b) });
      closeModal();
      toast(`Pedido de Compra ${res.item.numero} emitido com sucesso!`);
      show('inbound');
    } catch(err) {
      toast(err.message, true);
    }
  };
}

async function onPoSupplierChange(fid){
  if(!fid) return;
  const sel = $('#poSupplierSelect');
  const opt = sel.selectedOptions[0];
  const lead = Number(opt?.dataset?.lead || 5);
  const targetDate = new Date(Date.now() + (lead * 86400000)).toISOString().slice(0,10);
  if($('#poPrevisaoInput')) $('#poPrevisaoInput').value = targetDate;

  try {
    const res = await api(`/api/suppliers/${fid}/products`);
    window._currentPoSupplierProducts = res.items || [];
    $('#poItemsContainer').innerHTML = '';
    if(window._currentPoSupplierProducts.length){
      addPoItemRow();
    } else {
      $('#poItemsContainer').innerHTML = `<p class="muted">Este fornecedor ainda não tem produtos vinculados no catálogo. Você pode vincular os produtos no menu "Fornecedores" ou digitar manualmente.</p>`;
    }
  } catch(e) {
    console.error(e);
  }
}

function addPoItemRow(){
  const container = document.getElementById('poItemsContainer');
  if(!container) return;
  const prods = window._currentPoSupplierProducts || [];
  const row = document.createElement('div');
  row.className = 'po-item-row form';
  row.style = 'grid-template-columns: 2fr 1fr 1fr auto; align-items:flex-end; background:#07101a; padding:10px; border-radius:8px; border:1px solid #1e2c40';

  row.innerHTML = `
    <div class="field">
      <label>Produto</label>
      <select class="po-prod-id field-input" onchange="onPoProdSelect(this)" required>
        <option value="">Selecione o produto...</option>
        ${prods.map(p=>`<option value="${p.produto_id}" data-cost="${p.custo_aquisicao}">${esc(p.produto_nome)} (${esc(p.produto_sku||'-')})</option>`).join('')}
      </select>
    </div>
    <div class="field">
      <label>Quantidade</label>
      <input type="number" min="1" value="10" class="po-prod-qtd field-input" oninput="calcPoTotal()" required>
    </div>
    <div class="field">
      <label>Custo Unit. (R$)</label>
      <input type="number" step="0.01" min="0" value="0.00" class="po-prod-custo field-input" oninput="calcPoTotal()" required>
    </div>
    <button type="button" class="btn danger" style="padding:10px" onclick="this.closest('.po-item-row').remove();calcPoTotal()">🗑</button>
  `;
  container.appendChild(row);
  calcPoTotal();
}

function onPoProdSelect(sel){
  const row = sel.closest('.po-item-row');
  const opt = sel.selectedOptions[0];
  const cost = Number(opt?.dataset?.cost || 0);
  if(row){
    const costInput = row.querySelector('.po-prod-custo');
    if(costInput) costInput.value = cost.toFixed(2);
    calcPoTotal();
  }
}

function calcPoTotal(){
  let total = 0;
  document.querySelectorAll('.po-item-row').forEach(r => {
    const q = Number(r.querySelector('.po-prod-qtd')?.value || 0);
    const c = Number(r.querySelector('.po-prod-custo')?.value || 0);
    total += (q * c);
  });
  const el = document.getElementById('poTotalDisplay');
  if(el) el.textContent = brl(total);
}

/* ================================================================
   RECEBIMENTO DE MERCADORIAS (CONFERÊNCIA & ENTRADA NO ESTOQUE)
   ================================================================ */
async function receivePurchaseOrderModal(cid){
  try {
    const res = await api('/api/purchases/' + cid);
    const c = res.compra;
    const itens = res.itens || [];

    modal(`Recebimento na Doca — ${esc(c.numero)}`, `
      <div style="background:#0a1422;border:1px solid #1f2f45;border-radius:10px;padding:14px;margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
          <div>
            <h3 style="margin:0">${esc(c.fornecedor_nome)}</h3>
            <p class="muted" style="margin:4px 0 0">
              Emissão: ${new Date(c.data_emissao).toLocaleDateString('pt-BR')} · 
              Previsão ETA: <strong>${new Date(c.previsao_entrega).toLocaleDateString('pt-BR')}</strong> ·
              Total Previsto: <strong>${brl(c.valor_total)}</strong>
            </p>
          </div>
          <button type="button" class="btn btn-quick-receive" onclick="executeQuickReceive('${cid}')">
            ⚡ Receber Tudo Conforme Pedido
          </button>
        </div>
      </div>

      <form id="receiveForm" class="form">
        <div class="field">
          <label>Número da Nota Fiscal (NF-e)</label>
          <input name="numero_nota_fiscal" class="field-input" placeholder="Ex: 001.284.992" value="${esc(c.numero_nota_fiscal||'')}">
        </div>
        <div class="field">
          <label>Observação da Doca / Lacre / Avarias</label>
          <input name="observacao" class="field-input" placeholder="Ex: Carga descarregada sem avarias">
        </div>

        <div style="grid-column:1/-1;margin-top:10px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <h4 style="margin:0">Conferência Física dos Itens</h4>
            <span class="muted" style="font-size:12px">Bipe o código de barras ou confira as quantidades abaixo:</span>
          </div>
          <input id="barcodeReceiveInput" class="search" style="margin-bottom:10px" placeholder="🔍 Bipe ou digite o código de barras do produto para conferir..." onkeydown="onBarcodeReceiveKey(event)">

          <div class="tablewrap" style="max-height:360px">
            <table class="table" id="receiveItemsTable">
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Cód. Barras</th>
                  <th>Pedido</th>
                  <th>Já Recebido</th>
                  <th>Falta</th>
                  <th style="width:140px">Receber Agora</th>
                </tr>
              </thead>
              <tbody>
                ${itens.map(it => {
                  const saldoFalta = Math.max(0, Number(it.quantidade_pedida) - Number(it.quantidade_recebida));
                  return `
                    <tr data-product-id="${it.produto_id}" data-barcode="${esc(it.codigo_barras||'')}">
                      <td>
                        <strong>${esc(it.produto_nome)}</strong><br>
                        <small class="muted">SKU: ${esc(it.produto_sku||'-')} · Saldo Atual: ${it.quantidade_disponivel||0}</small>
                      </td>
                      <td>${esc(it.codigo_barras||'—')}</td>
                      <td>${it.quantidade_pedida} un</td>
                      <td>${it.quantidade_recebida} un</td>
                      <td><span class="badge ${saldoFalta>0?'badge-lead-today':''}">${saldoFalta} un</span></td>
                      <td>
                        <input type="number" min="0" max="${saldoFalta}" value="${saldoFalta}" class="field-input receive-qty-input" data-item-id="${it.id}" data-prod-id="${it.produto_id}" style="width:100px;text-align:center;padding:6px">
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <div class="actions" style="grid-column:1/-1;margin-top:14px;justify-content:flex-end">
          <button type="button" class="btn" onclick="closeModal()">Cancelar</button>
          <button class="btn primary">Confirmar Entrada no Estoque</button>
        </div>
      </form>
    `, '900px');

    $('#receiveForm').onsubmit = async e => {
      e.preventDefault();
      const b = Object.fromEntries(new FormData(e.currentTarget));
      const itensPayload = [];
      document.querySelectorAll('.receive-qty-input').forEach(inp => {
        const q = Number(inp.value || 0);
        if(q > 0) itensPayload.push({ produto_id: inp.dataset.prodId, id: inp.dataset.itemId, quantidade_recebida: q });
      });

      if(!itensPayload.length) return alert('Informe ao menos uma quantidade a receber.');

      try {
        const out = await api(`/api/purchases/${cid}/receive`, {
          method: 'POST',
          body: JSON.stringify({
            numero_nota_fiscal: b.numero_nota_fiscal,
            observacao: b.observacao,
            itens: itensPayload
          })
        });
        closeModal();
        toast(`Recebimento concluído! ${out.total_recebido} unidades deram entrada imediata no estoque.`);
        Realtime.emit('stock_changed');
        Realtime.emit('purchases_changed');
        show('inbound');
      } catch(err) {
        toast(err.message, true);
      }
    };
  } catch(e) {
    toast(e.message, true);
  }
}

async function executeQuickReceive(cid){
  if(!confirm('Confirmar recebimento de 100% dos itens da compra?\n\nO saldo físico de todos os produtos dará entrada imediata no estoque.')) return;
  try {
    const nf = prompt('Número da Nota Fiscal (opcional):', '') || '';
    const out = await api(`/api/purchases/${cid}/receive`, {
      method: 'POST',
      body: JSON.stringify({
        receber_tudo: true,
        numero_nota_fiscal: nf
      })
    });
    closeModal();
    toast(`Sucesso! Compra finalizada e estoque atualizado com +${out.total_recebido} unidades!`);
    Realtime.emit('stock_changed');
    Realtime.emit('purchases_changed');
    show('inbound');
  } catch(e) {
    toast(e.message, true);
  }
}

function onBarcodeReceiveKey(e){
  if(e.key === 'Enter'){
    e.preventDefault();
    const code = (e.target.value||'').trim();
    if(!code) return;
    const row = document.querySelector(`tr[data-barcode="${code}"]`);
    if(row){
      const inp = row.querySelector('.receive-qty-input');
      if(inp){
        const max = Number(inp.max||9999);
        const cur = Number(inp.value||0);
        if(cur < max){
          inp.value = cur + 1;
          row.classList.add('receive-row-highlight');
          setTimeout(()=>row.classList.remove('receive-row-highlight'), 1000);
          toast(`+1 bipado: ${row.querySelector('strong').textContent}`);
        } else {
          toast('Quantidade total deste item já conferida!', true);
        }
      }
    } else {
      toast(`Código de barras "${code}" não pertence a esta compra!`, true);
    }
    e.target.value = '';
  }
}

function formatPrevisaoEntrega(c){
  const dataFmt = c.previsao_entrega ? new Date(c.previsao_entrega + (c.previsao_entrega.includes('T') ? '' : 'T12:00:00')).toLocaleDateString('pt-BR') : '';
  if(c.lead_status === 'NO_PRAZO') return `No prazo${dataFmt ? ` (${dataFmt})` : ''}`;
  if(c.lead_status === 'HOJE') return `Hoje${dataFmt ? ` (${dataFmt})` : ''}`;
  if(c.lead_status === 'ATRASADO') return `Atrasado (${Math.abs(c.diff_dias||0)}d)${dataFmt ? ` (${dataFmt})` : ''}`;
  if(c.lead_status === 'CONCLUIDO') return `Entregue${c.data_conclusao ? ` (${new Date(c.data_conclusao).toLocaleDateString('pt-BR')})` : ''}`;
  if(c.lead_status === 'CANCELADO') return 'Cancelado';
  return dataFmt || c.lead_status || '—';
}

async function purchaseDetailModal(cid){
  try {
    const res = await api('/api/purchases/' + cid);
    const c = res.compra;
    const itens = res.itens || [];
    modal(`Detalhe da Compra — ${esc(c.numero)}`, `
      <div class="grid" style="margin-bottom:14px">
        <div class="card"><small class="muted">Fornecedor</small><h3>${esc(c.fornecedor_nome)}</h3><small>${esc(c.fornecedor_telefone||'')}</small></div>
        <div class="card"><small class="muted">Status</small><h3>${esc(c.status)}</h3><small>Previsão de entrega: ${formatPrevisaoEntrega(c)}</small></div>
        <div class="card"><small class="muted">Valor Total</small><h3 class="orange">${brl(c.valor_total)}</h3><small>NF: ${esc(c.numero_nota_fiscal||'S/N')}</small></div>
      </div>
      <div class="tablewrap">
        <table class="table">
          <thead><tr><th>Produto</th><th>Pedida</th><th>Recebida</th><th>Custo Unit.</th><th>Subtotal</th></tr></thead>
          <tbody>
            ${itens.map(it=>`
              <tr>
                <td><strong>${esc(it.produto_nome)}</strong></td>
                <td>${it.quantidade_pedida} un</td>
                <td><strong style="color:${it.quantidade_recebida>=it.quantidade_pedida?'#22c55e':'#f59e0b'}">${it.quantidade_recebida} un</strong></td>
                <td>${brl(it.custo_unitario)}</td>
                <td>${brl(it.subtotal)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      <div class="actions" style="margin-top:14px;justify-content:flex-end">
        <button class="btn" onclick="closeModal()">Fechar</button>
      </div>
    `, '750px');
  } catch(e) {
    toast(e.message, true);
  }
}

async function advancePurchaseStatus(cid, status){
  try {
    await api(`/api/purchases/${cid}/status`, { method:'POST', body: JSON.stringify({ status }) });
    toast('Status da compra atualizado');
    show('inbound');
  } catch(e) {
    toast(e.message, true);
  }
}

async function cancelPurchaseOrder(cid, numero){
  const motivo = prompt(`Confirmar cancelamento da compra ${numero}?\n\nDigite o motivo (opcional):`, '');
  if(motivo === null) return;
  try {
    await api(`/api/purchases/${cid}/cancel`, { method:'POST', body: JSON.stringify({ motivo }) });
    toast(`Compra ${numero} cancelada`);
    show('inbound');
  } catch(e) {
    toast(e.message, true);
  }
}

