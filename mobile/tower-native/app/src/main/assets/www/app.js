function adminOfflineDb(){
  return new Promise((resolve,reject)=>{
    const r=indexedDB.open('xv-offline-admin-v1',1);
    r.onupgradeneeded=()=>{
      const d=r.result;
      if(!d.objectStoreNames.contains('kv'))d.createObjectStore('kv');
      if(!d.objectStoreNames.contains('outbox'))d.createObjectStore('outbox',{keyPath:'id'});
    };
    r.onsuccess=()=>resolve(r.result);
    r.onerror=()=>reject(r.error);
  });
}
async function adminOfflinePut(store,key,value){
  try{
    const d=await adminOfflineDb();
    return new Promise((res,rej)=>{
      const t=d.transaction(store,'readwrite');
      t.objectStore(store).put(value,key);
      t.oncomplete=res;
      t.onerror=()=>rej(t.error);
    });
  }catch(e){console.warn('adminOfflinePut err',e)}
}
async function adminOfflineGet(store,key){
  try{
    const d=await adminOfflineDb();
    return new Promise((res,rej)=>{
      const t=d.transaction(store);
      const r=t.objectStore(store).get(key);
      r.onsuccess=()=>res(r.result);
      r.onerror=()=>rej(r.error);
    });
  }catch(e){return null}
}
async function queueAdminOffline(path,opt){
  const id=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10);
  const item={id,path,method:opt.method||'POST',body:opt.body||'{}',headers:opt.headers||{},created_at:new Date().toISOString()};
  try{
    const d=await adminOfflineDb();
    await new Promise((res,rej)=>{
      const t=d.transaction('outbox','readwrite');
      t.objectStore('outbox').put(item);
      t.oncomplete=res;
      t.onerror=()=>rej(t.error);
    });
  }catch(e){}
  return item;
}
async function syncAdminOutbox(){
  if(!navigator.onLine)return;
  try{
    const d=await adminOfflineDb();
    const rows=await new Promise((res,rej)=>{
      const t=d.transaction('outbox');
      const q=t.objectStore('outbox').getAll();
      q.onsuccess=()=>res(q.result);
      q.onerror=()=>rej(q.error);
    });
    if(!rows||!rows.length)return;
    let synced=0;
    for(const item of rows.sort((a,b)=>a.created_at.localeCompare(b.created_at))){
      try{
        await api(item.path,{method:item.method,body:item.body,headers:{...(item.headers||{}),'Idempotency-Key':item.headers?.['Idempotency-Key']||('OFF-ADMIN-'+item.id)}});
        await new Promise((res,rej)=>{
          const t=d.transaction('outbox','readwrite');
          t.objectStore('outbox').delete(item.id);
          t.oncomplete=res;
          t.onerror=()=>rej(t.error);
        });
        synced++;
      }catch(err){
        if(!navigator.onLine)break;
      }
    }
    if(synced>0){
      toast(`✓ ${synced} operação(ões) offline sincronizada(s) na Torre!`);
      refreshCurrentViewSilently();
    }
  }catch(e){}
}
window.syncAdminOutbox=syncAdminOutbox;

const API = (typeof window !== 'undefined' && (window.location.protocol === 'file:' || !window.location.origin || window.location.origin === 'null')) ? 'https://xiquim-vargas-erp.onrender.com' : '';let token=localStorage.getItem('xv_token');let me=null;const $=s=>document.querySelector(s);
function jsonArg(value){const bytes=new TextEncoder().encode(JSON.stringify(value));let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);return btoa(binary)}
function parseJsonArg(encoded){return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(encoded),c=>c.charCodeAt(0))))}
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const brl=value=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number.isFinite(Number(value))?Number(value):0);
const ROLE_LABELS={admin:'Administrador',seller:'Vendedor',cashier:'Caixa',driver:'Motorista',web_client:'Loja Online'};

async function api(path,opt={}){
  const method=opt.method||'GET';
  const reqId=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10);
  try{
    const r=await fetch(API+path,{...opt,headers:{'x-request-id':reqId,'content-type':'application/json',...(opt.headers||{}),...(token?{authorization:'Bearer '+token}:{})}});
    if(!r.ok){
      let e;try{e=await r.json()}catch{};
      if(r.status===401&&token&&!path.includes('/api/auth/login')){
        localStorage.removeItem('xv_token');localStorage.removeItem('xv_user');token=null;location.href='/admin.html';
      }
      throw new Error(e?.error||`HTTP ${r.status}`);
    }
    const data=r.headers.get('content-type')?.includes('application/json')?await r.json():await r.blob();
    if(method==='GET'&&typeof data==='object'&&!(data instanceof Blob)){
      adminOfflinePut('kv',path,data);
      try{localStorage.setItem('xv_cache_'+(me?.id||'admin')+'_'+path,JSON.stringify(data))}catch{}
    }
    return data;
  }catch(err){
    if(err.message==='Failed to fetch'||err.message?.includes('NetworkError')||err.message?.includes('fetch')||!navigator.onLine){
      if(method==='GET'){
        const cached=await adminOfflineGet('kv',path);
        if(cached){
          return cached;
        }
        const fallback=localStorage.getItem('xv_cache_'+(me?.id||'admin')+'_'+path);
        if(fallback) return JSON.parse(fallback);
        throw new Error('Modo offline: estes dados ainda não foram salvos neste aparelho.');
      }else{
        await queueAdminOffline(path,opt);
        toast("Modo offline: alteração gravada localmente. Será enviada ao reconectar.");
        return {success:true,item:{},offline:true};
      }
    }
    throw err;
  }
}

let _netStatusTimer=null;
function handleNetworkChange(isOnline){
  clearTimeout(_netStatusTimer);
  _netStatusTimer=setTimeout(async()=>{
    const reallyOnline = typeof navigator.onLine==='boolean' ? navigator.onLine : isOnline;
    const el=document.getElementById('offlineIndicator');
    if(reallyOnline){
      if(el)el.style.display='none';
      toast("Conexão restabelecida! Atualizando Torre de Controle...");
      await syncAdminOutbox();
      refreshCurrentViewSilently();
    }else{
      if(el)el.style.display='flex';
      toast("Torre em Modo Offline. Operando com dados salvos no aparelho.", true);
    }
  }, 300);
}
window.addEventListener('online',()=>handleNetworkChange(true));
window.addEventListener('offline',()=>handleNetworkChange(false));
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
        const kanCols=document.querySelectorAll('.panel .kanban .kanban-col');
        const kanVals=[d.pendentes, d.separacao, d.rota, d.concluidos];
        if(kanCols.length>=4){
          kanCols.forEach((col,idx)=>{
            if(idx<4){
              const badge=col.querySelector('.kanban-head .badge');
              const strong=col.querySelector('.kanban-card strong');
              const nextVal=kanVals[idx];
              if(badge&&badge.textContent!==String(nextVal)){
                badge.textContent=String(nextVal);
                badge.classList.add('xv-flash-updated');
                setTimeout(()=>badge.classList.remove('xv-flash-updated'),1000);
              }
              if(strong&&!strong.textContent.startsWith(String(nextVal))){
                strong.textContent=`${nextVal} pedido(s)`;
                strong.classList.add('xv-flash-updated');
                setTimeout(()=>strong.classList.remove('xv-flash-updated'),1000);
              }
            }
          });
        }
      }else if(currentView==='orders'){
        if(!eventType||eventType==='orders_changed'||eventType==='routes_changed'||eventType==='returns_changed'||eventType==='tab_focused'){
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
        if(!eventType||eventType==='products_changed'||eventType==='stock_changed'||eventType==='prices_changed'||eventType==='tab_focused'){
          const [p,c,promo]=await Promise.all([api('/api/products?limit=100000'),api('/api/categories'),api('/api/promotions')]);
          window.adminProducts=p;window.adminCategories=c;window.catalogCategories=c.categorias;window.catalogSubcategories=c.subcategorias;window.adminPromotions=promo;
          if(!hasOpenModal){
            const pqVal=$('#pq')?.value,catVal=$('#catFilter')?.value,subVal=$('#subFilter')?.value;
            const v=$('#view');
            if(v){
              if(window.adminCurrentSubId){
                const subObj=c.subcategorias.find(s=>s.id===window.adminCurrentSubId);
                adminProdutosSub(window.adminCurrentSubId,subObj?.nome||'Subcategoria',window.adminCurrentCatId);
              }else if(window.adminCurrentCatId){
                adminSubcategorias(window.adminCurrentCatId);
              }else{
                renderAdminCatalog(v);
              }
            }
            if(pqVal&&$('#pq'))$('#pq').value=pqVal;
            if(catVal&&$('#catFilter'))$('#catFilter').value=catVal;
            if(subVal&&$('#subFilter'))$('#subFilter').value=subVal;
            if(pqVal||catVal||subVal)catalogFilter();
          }
        }
      }else if(currentView==='stock'){
        if(!eventType||eventType==='stock_changed'||eventType==='products_changed'||eventType==='orders_changed'||eventType==='purchases_changed'||eventType==='returns_changed'||eventType==='tab_focused'){
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
        if(!eventType||eventType==='clients_changed'||eventType==='orders_changed'||eventType==='tab_focused'){
          if(typeof window.refreshCrmData==='function'){
            window.refreshCrmData();
          }else{
            const c=await api('/api/clients');
            window._clientsData=c.items||[];
            if(typeof window.renderClientsUI==='function')window.renderClientsUI();
          }
        }
      }else if(currentView==='logistics'){
        if(!eventType||eventType==='routes_changed'||eventType==='orders_changed'||eventType==='returns_changed'||eventType==='tab_focused'){
          const v=$('#view');
          if(v&&!hasOpenModal){
            if(document.getElementById('returnedOrdersDashboard')?.style.display==='block'){
              if(typeof window.refreshReturnedOrders==='function')window.refreshReturnedOrders();
            }else if(document.getElementById('deliveryRoutesDashboard')?.style.display==='block'){if(typeof window.refreshDeliveryRoutesSilently==='function')window.refreshDeliveryRoutesSilently();}else if(document.getElementById('logisticsModalityDashboard')?.style.display==='block'){
              if(typeof window.renderModalityDashboard==='function'){
                const groupsReq=await api('/api/logistics/grouped-orders').catch(()=>[]);
                window._logisticsGroups=groupsReq;
                window.renderModalityDashboard(window._currentLogisticsGrupoKey||'TODOS', window._currentLogisticsSellerFilter||'');
              }
            }else if(document.getElementById('logisticsDashboard')?.style.display==='block'){
              if(typeof window.refreshLogisticsInRoute==='function') window.refreshLogisticsInRoute();
            }else if(document.getElementById('logisticsMain')?.style.display!=='none'){
              const checkedBoxes=document.querySelectorAll('.load-order:checked');
              if(checkedBoxes.length===0){
                logistics(v);
              }else{
                const retData=await api('/api/logistics/returned-orders').catch(()=>({items:[]}));
                const retBadge=document.getElementById('returnedOrdersGridBadge');
                if(retBadge){
                  retBadge.textContent=retData.items?.length||0;
                  retBadge.style.background=retData.items?.length?'#ef4444':'#64748b';
                }
              }
            }
          }
        }
      }else if(currentView==='prices'){
        if(!eventType||eventType==='prices_changed'||eventType==='clients_changed'||eventType==='tab_focused'){
          if(window.ptdCurrentTableId && document.getElementById('ptdBody')){
            try{
              const updated=await api('/api/price-tables/'+window.ptdCurrentTableId+'/details');
              renderPriceTableDashboard(window.ptdCurrentTableId, window.ptdCurrentTableName, updated);
            }catch(e){}
          }else if(!hasOpenModal){
            const v=$('#view');if(v)prices(v);
          }
        }
      }else if(currentView==='users'){
        if(!eventType||eventType==='users_changed'||eventType==='tab_focused'){
          const v=$('#view');if(v&&!hasOpenModal)users(v);
        }
      }else if(currentView==='suppliers'){
        if(!eventType||eventType==='suppliers_changed'||eventType==='tab_focused'){
          const v=$('#view');
          if(v&&!hasOpenModal){
            const sVal=$('#supplierSearch')?.value;
            const s=await api('/api/suppliers');
            window._suppliersData=s.items||[];
            const wrap=$('#supplierTableWrap');
            if(wrap){
              wrap.innerHTML=renderSuppliersTable(window._suppliersData);
              if(sVal&&$('#supplierSearch')){$('#supplierSearch').value=sVal;filterSuppliers(sVal)}
              const kpis=document.querySelectorAll('#view .card.kpi .v');
              if(kpis.length>=3){
                kpis[0].textContent=window._suppliersData.length;
                kpis[1].textContent=window._suppliersData.reduce((a,x)=>a+Number(x.total_produtos||0),0);
                kpis[2].textContent=window._suppliersData.reduce((a,x)=>a+Number(x.compras_abertas||0),0);
              }
            }else{
              suppliers(v);
            }
          }
        }
      }else if(currentView==='inbound'){
        if(!eventType||eventType==='purchases_changed'||eventType==='stock_changed'||eventType==='tab_focused'){
          const v=$('#view');
          if(v&&!hasOpenModal){
            const sVal=$('#inboundSearch')?.value;
            const stVal=$('#inboundStatusFilter')?.value;
            const [summary, res]=await Promise.all([
              api('/api/inbound/summary'),
              api('/api/purchases')
            ]);
            window._inboundSummary=summary;
            window._purchasesData=res.items||[];
            const wrap=$('#inboundTableWrap');
            if(wrap){
              wrap.innerHTML=renderInboundTable(window._purchasesData);
              if(sVal&&$('#inboundSearch'))$('#inboundSearch').value=sVal;
              if(stVal&&$('#inboundStatusFilter'))$('#inboundStatusFilter').value=stVal;
              filterInbound();
              const kpis=document.querySelectorAll('#view .card.kpi .v');
              if(kpis.length>=5){
                kpis[0].textContent=summary.aguardando;
                kpis[1].textContent=summary.hoje;
                kpis[2].textContent=summary.atrasados;
                kpis[3].textContent=summary.recebidosMes;
                kpis[4].textContent=brl(summary.valorMes);
              }
            }else{
              inbound(v);
            }
          }
        }
      }else if(currentView==='sellers'){
        if(!eventType||eventType==='orders_changed'||eventType==='users_changed'||eventType==='tab_focused'){
          if(!hasOpenModal){
            if(window._currentSellerDashboardId && window._currentSellerDashboardNome){
              renderSellerDashboard(window._currentSellerDashboardId, window._currentSellerDashboardNome);
            }else{
              const v=$('#view');if(v)sellers(v);
            }
          }
        }
      }else if(currentView==='reports'){
        if(!eventType||eventType==='orders_changed'||eventType==='dashboard_changed'||eventType==='tab_focused'){
          const v=$('#view');if(v&&!hasOpenModal)reports(v,window._currentReportsPeriodo||'geral');
        }
      }else if(currentView==='audit'){
        if(!eventType||eventType==='audit_changed'||eventType==='tab_focused'){
          const v=$('#view');if(v&&!hasOpenModal)auditView(v);
        }
      }else if(currentView==='store'){
        if(!eventType||eventType==='settings_changed'||eventType==='tab_focused'){
          if(!hasOpenModal&&!document.querySelector('#storeConfigForm:focus-within')){
            const v=$('#view');if(v)storeSettings(v);
          }
        }
      }
    }catch(err){console.warn('Silent refresh error:',err)}
  },120);
}
async function login(e){e.preventDefault();try{const b=Object.fromEntries(new FormData(e.currentTarget));const x=await api('/api/auth/login',{method:'POST',body:JSON.stringify(b)});token=x.token;me=x.user;localStorage.setItem('xv_token',token);localStorage.setItem('xv_user',JSON.stringify(x.user||{}));location.reload()}catch(err){toast(err.message)}}
async function downloadAuthFile(url,filename){try{const reqId=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10);console.log(`[${reqId}] GET ${url}`);const r=await fetch(url,{headers:{'x-request-id':reqId,...(token?{authorization:'Bearer '+token}:{})}});if(!r.ok)throw new Error('Não foi possível abrir o documento');const b=await r.blob();const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=filename||'documento.pdf';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}catch(e){alert(e.message)}}
async function downloadAuthPost(url,body,filename){try{const reqId=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10);console.log(`[${reqId}] POST ${url}`);const r=await fetch(url,{method:'POST',headers:{'x-request-id':reqId,'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},body:JSON.stringify(body)});if(!r.ok)throw new Error('Não foi possível gerar o documento');const b=await r.blob();const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=filename||'documento.pdf';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}catch(e){alert(e.message)}}
function logout(){localStorage.removeItem('xv_token');localStorage.removeItem('xv_user');location.href='/admin.html'}
async function boot(){
  if(!token){try{const st=await fetch('/api/setup/status',{cache:'no-store'}).then(r=>r.json());if(st.required)return setupPage(st)}catch{}return roleLoginPage('Administrador Geral')}
  const cachedMe=localStorage.getItem('xv_user');
  if(cachedMe){try{me=JSON.parse(cachedMe)}catch{}}
  try{
    const m=await api('/api/me');
    me=m.user;
    localStorage.setItem('xv_user',JSON.stringify(me));
    if(me.role!=='admin'){
      localStorage.removeItem('xv_token');
      localStorage.removeItem('xv_user');
      alert('A Torre de Controle é de uso exclusivo para o Administrador Geral. Você será redirecionado para o login.');
      return location.href='/admin.html';
    }
    render();
  }catch(err){
    if(!navigator.onLine&&me?.role==='admin'){
      console.warn('Operando offline com sessão em cache');
      return render();
    }
    if(err.message?.includes('401')||err.message?.includes('Token')||err.message?.includes('jwt')||err.message?.includes('unauthorized')){
      return logout();
    }
    if(me?.role==='admin'){
      return render();
    }
    logout();
  }
}
function setupPage(status){const q=new URLSearchParams(location.search);const setupToken=q.get('setup')||'';document.body.innerHTML=`<div class="login"><div class="loginbox"><img class="xv-logo" src="/assets/institucional/01_Logo_Xiquim_Vargas_HD.png" alt="Xiquim Vargas"><h1>Primeiro acesso</h1><p style="color:var(--muted)">Este ERP ainda não foi configurado. Crie agora o administrador principal. Não existe uma senha fixa de fábrica.</p>${setupToken?`<form id="setupForm"><div class="field"><label>Nome do administrador</label><input name="nome" required maxlength="180"></div><br><div class="field"><label>E-mail</label><input name="email" type="email" required autocomplete="email"></div><br><div class="field"><label>Senha</label><div style="display:flex;gap:6px"><input name="password" type="password" minlength="10" required autocomplete="new-password" style="flex:1"><button type="button" class="btn" tabindex="-1" onclick="const x=this.previousElementSibling; x.type=x.type==='password'?'text':'password'">👁</button></div><small style="display:block;margin-top:6px;color:var(--muted)">Use pelo menos 10 caracteres.</small></div><br><button class="btn primary" style="width:100%">Criar administrador e entrar</button></form>`:`<div class="panel" style="margin-top:18px"><strong>Configuração inicial protegida</strong><p style="color:var(--muted)">Abra o link de primeiro acesso exibido nos logs do serviço no Render. Esse link é criado uma única vez e deixa de funcionar depois que o administrador é criado.</p></div>`}<div id="toast" class="toast"></div></div></div>`;if(setupToken){$('#setupForm').onsubmit=async e=>{e.preventDefault();const b=Object.fromEntries(new FormData(e.currentTarget));b.setup_token=setupToken;try{const x=await fetch('/api/setup/initialize',{method:'POST',headers:{'content-type':'application/json','x-setup-token':setupToken},body:JSON.stringify(b)});const out=await x.json();if(!x.ok)throw new Error(out.error||'Não foi possível concluir a configuração');token=out.token;localStorage.setItem('xv_token',token);history.replaceState({},'', '/admin');location.reload()}catch(err){toast(err.message)}}}}

const menu=[['Visão Geral','home'],['Catálogo','products'],['Tabelas de preço','prices'],['Estoque Inteligente','stock'],['Clientes & CRM','clients'],['Pedidos','orders'],['Logística','logistics'],['Fornecedores','suppliers'],['Recebimento','inbound'],['Vendedores','sellers'],['Relatórios','reports'],['Auditoria','audit'],['Usuários','users'],['IA Administrativa','ai']];
function shell(){const dot='•';const groups=[['Operação',[[dot,'Visão Geral','home'],[dot,'Pedidos','orders'],[dot,'Catálogo','products'],[dot,'Loja Online','store'],[dot,'Estoque Inteligente','stock'],[dot,'Clientes & CRM','clients'],[dot,'Logística','logistics']]],['Suprimentos',[[dot,'Fornecedores','suppliers'],[dot,'Recebimento de Mercadorias','inbound']]],['Gestão',[[dot,'Vendedores','sellers'],[dot,'Usuários','users'],[dot,'Tabelas de preço','prices'],[dot,'Relatórios','reports']]],['Governança',[[dot,'Auditoria','audit'],[dot,'IA Administrativa','ai']]]];return `<div class="app"><aside class="sidebar"><img class="xv-logo" src="/assets/institucional/01_Logo_Xiquim_Vargas_HD.png" alt="Xiquim Vargas ERP"><div class="group">Torre de Controle</div>${groups.map(([title,items])=>`<div class="group">${title}</div><div class="nav">${items.map(([i,l,k])=>`<button data-view="${k}"><span style="width:16px;text-align:center;font-size:16px;line-height:1;display:inline-block">${i}</span>${l}</button>`).join('')}</div>`).join('')}<div class="group">Sessão</div><div class="nav"><button onclick="logout()"><span style="width:16px;text-align:center;font-size:16px;line-height:1;display:inline-block">•</span>Sair</button></div></aside><main class="main"><div class="topbar"><div class="brand-dark"><button class="mobile-back-btn btn" onclick="window.showSidebar()">← Voltar</button><div><h1 id="title">Visão Geral</h1></div></div><div class="topbar-actions"><span id="offlineIndicator" style="display:${navigator.onLine?'none':'inline-flex'};background:#e11d48;color:#fff;font-weight:700;font-size:11px;padding:3px 8px;border-radius:12px;margin-right:6px">OFFLINE</span><span class="badge">${esc(ROLE_LABELS[me?.role]||me?.role||'Administrador')}</span></div></div><div id="view"></div></main></div><div id="toast" class="toast"></div>`}
async function render(){if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});Realtime.init((type,payload)=>refreshCurrentViewSilently(type,payload));document.body.innerHTML=shell();window.showSidebar=()=>document.querySelector('.app').classList.remove('view-open');document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{document.querySelector('.app').classList.add('view-open');show(b.dataset.view)});const h=location.hash.slice(1);if(h&&window.innerWidth<=800)document.querySelector('.app').classList.add('view-open');await show(h||'home')}
async function show(view){document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));$('#title').textContent=({home:'Visão Geral',products:'Catálogo',stock:'Estoque Inteligente',clients:'Clientes & CRM',orders:'Pedidos',users:'Usuários',sellers:'Vendedores',logistics:'Logística',suppliers:'Fornecedores',inbound:'Recebimento de Mercadorias',reports:'Relatórios',store:'Loja Online',audit:'Auditoria',prices:'Tabelas de preço',ai:'IA Administrativa'})[view]||view;location.hash=view;const v=$('#view');v.innerHTML='<div class="panel">Carregando...</div>';try{if(view==='home')return home(v);if(view==='products')return products(v);if(view==='prices')return prices(v);if(view==='store')return storeSettings(v);if(view==='stock')return stock(v);if(view==='clients')return clients(v);if(view==='orders')return orders(v);if(view==='users')return users(v);if(view==='sellers')return sellers(v);if(view==='logistics')return logistics(v);if(view==='suppliers')return suppliers(v);if(view==='inbound')return inbound(v);if(view==='reports')return reports(v);if(view==='audit')return auditView(v);if(view==='ai')return ai(v)}catch(e){v.innerHTML=`<div class="panel">Erro: ${esc(e.message)}</div>`}}
async function home(v){const d=await api('/api/dashboard');window._dashboardData=d;const cards=[['🛍','Pedidos hoje',d.pedidosHoje],['●','Pendentes',d.pendentes],['●','Separação',d.separacao],['🚚','Em rota',d.rota],['✓','Concluídos',d.concluidos],['R$','Faturamento',`${brl(d.faturamento)}`],['▪','Produtos',d.produtos],['!','Estoque baixo',d.criticos],['♣','Clientes',d.clientes],['♣','Vendedores',d.vendedores]];const kan=[['PENDENTE',d.pendentes,'status-pendente'],['SEPARACAO',d.separacao,'status-separacao'],['ROTA',d.rota,'status-rota'],['CONCLUIDO',d.concluidos,'status-concluido']];const top=d.topProdutos||[];const chunked=[];for(let i=0;i<top.length;i+=5)chunked.push(top.slice(i,i+5));const topKanbanHtml=chunked.length?`<div class="panel" style="margin-top:16px"><div class="panel-title"><h3>Top 20 Produtos Mais Vendidos</h3></div><div class="kanban">${chunked.map((chunk,idx)=>`<div class="kanban-col"><div class="kanban-head"><span><span class="dot" style="background:var(--xv-orange)"></span>Top ${idx*5+1} ao ${idx*5+chunk.length}</span><span class="badge">${chunk.length}</span></div>${chunk.map((p,i)=>`<div class="kanban-card" style="display:flex;gap:12px;align-items:center"><div class="catalog-product-cell">${p.foto_url?`<img class="catalog-mini-photo" src="${esc(p.foto_url)}" alt="">`:'<div class="catalog-mini-photo placeholder">XV</div>'}</div><div><strong>#${idx*5+i+1} - ${esc(p.nome)}</strong><br><small class="muted">${p.total_vendido} un vendidas</small><br><small class="orange">${brl(p.total_receita)}</small></div></div>`).join('')}</div>`).join('')}</div></div>`:'';window.renderModalidadeRanking=function(periodo='geral'){window._currentModalidadePeriodo=periodo;const db=window._dashboardData||d;const periodosMap=db.vendasPorOrigemPeriodos||{geral:db.vendasPorOrigem||[],semanal:[],mensal:[]};const rawList=periodosMap[periodo]||db.vendasPorOrigem||[];const originLabels={VENDEDOR:'Vendedor Externo',BALCAO:'Frente de Loja / Caixa',WEB:'Loja Online'};const originIcons={VENDEDOR:'👤',BALCAO:'🏪',WEB:'🛒'};const originColors={VENDEDOR:'var(--xv-orange)',BALCAO:'#4a90e2',WEB:'#2ecc71'};const originsData=rawList.reduce((acc,x)=>({...acc,[x.origem]:x}),{});const origensList=['VENDEDOR','BALCAO','WEB'].map(o=>({origem:o,label:originLabels[o],icon:originIcons[o],color:originColors[o],pedidos:Number(originsData[o]?.pedidos||0),faturamento:Number(originsData[o]?.faturamento||0)})).sort((a,b)=>b.faturamento-a.faturamento);const rankBadges=['🥇 1º Lugar','🥈 2º Lugar','🥉 3º Lugar'];const pLabels={geral:'Todo o histórico',semanal:'Últimos 7 dias',mensal:'Últimos 30 dias'};const el=document.getElementById('modalidadeRankingContainer');if(!el)return;el.innerHTML=`<div class="panel-title" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px"><div><h3 style="margin:0">Ranking de Vendas por Modalidade</h3><p class="muted" style="margin:4px 0 0;font-size:12px">Período selecionado: <strong>${pLabels[periodo]||periodo}</strong></p></div><div class="actions" style="display:flex;gap:6px"><button class="btn ${periodo==='geral'?'primary':''}" style="font-size:12px;padding:6px 12px" onclick="renderModalidadeRanking('geral')">Geral</button><button class="btn ${periodo==='semanal'?'primary':''}" style="font-size:12px;padding:6px 12px" onclick="renderModalidadeRanking('semanal')">Semanal (7d)</button><button class="btn ${periodo==='mensal'?'primary':''}" style="font-size:12px;padding:6px 12px" onclick="renderModalidadeRanking('mensal')">Mensal (30d)</button></div></div><div class="kanban" style="margin-top:14px">${origensList.map((x,idx)=>`<div class="kanban-col"><div class="kanban-head"><span><span class="dot" style="background:${x.color}"></span>${x.label}</span><span class="badge" style="background:${idx===0?'rgba(253,94,2,0.18)':''};color:${idx===0?'#fd5e02':''}">${rankBadges[idx]}</span></div><div class="kanban-card" style="text-align:center;padding:22px;border:1px solid ${idx===0?'rgba(253,94,2,0.3)':'var(--border)'}"><div style="font-size:30px;margin-bottom:6px">${x.icon}</div><div class="v" style="font-size:22px;color:${x.color};font-weight:800">${brl(x.faturamento)}</div><div style="margin-top:8px"><span class="badge" style="font-size:11px">${x.pedidos} pedido(s)</span></div><small class="muted" style="display:block;margin-top:8px">${x.faturamento>0?`${brl(x.pedidos?x.faturamento/x.pedidos:0)} ticket médio`:'Sem vendas no período'}</small></div></div>`).join('')}</div>`};v.innerHTML=`<div class="grid">${cards.map(x=>`<div class="card kpi"><div class="kpi-title" style="font-size:19px;font-weight:850;color:#000000;margin-bottom:8px;display:flex;align-items:center;gap:6px"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#000;flex:0 0 10px"></span> <span>${x[1]}</span></div><div class="v">${x[2]}</div></div>`).join('')}</div><div class="panel" style="margin-top:16px"><div class="panel-title"><h3>Fluxo operacional</h3><button class="btn" onclick="show('orders')">Ver pedidos</button></div><div class="kanban kanban-orders">${kan.map(k=>`<div class="kanban-col" style="min-height:150px;display:flex;flex-direction:column"><div class="kanban-head"><span><span class="dot"></span>${k[0]}</span><span class="badge">${k[1]}</span></div><div class="kanban-card" style="flex:1;min-height:95px;margin:0;padding:18px 16px;display:flex;align-items:center;justify-content:center;text-align:center"><strong style="font-size:19px;font-weight:800;color:var(--xv-brand-navy,#0f172a);margin:0;letter-spacing:-0.2px">${k[1]} pedido(s)</strong></div></div>`).join('')}</div></div><div class="panel" id="modalidadeRankingContainer" style="margin-top:16px"></div>${topKanbanHtml}`;window.renderModalidadeRanking(window._currentModalidadePeriodo||'geral')}
async function products(v){const [p,c,promo]=await Promise.all([api('/api/products?limit=100000'),api('/api/categories'),api('/api/promotions')]);window.adminProducts=p;window.adminCategories=c;window.catalogCategories=c.categorias;window.catalogSubcategories=c.subcategorias;window.adminPromotions=promo;renderAdminCatalog(v)}
function renderAdminCatalogToolbar(){const cats=window.adminCategories?.categorias||[];const subs=window.adminCategories?.subcategorias||[];return `<div class="panel catalog-toolbar"><div class="actions"><input id="pq" class="search" placeholder="Pesquisar por nome, SKU ou código de barras" oninput="catalogFilter(this)"><button class="btn primary" onclick="newProduct()">+ Produto</button><button class="btn" onclick="newCategory()">+ Categoria</button><button class="btn" onclick="newSubcategory()">+ Subcategoria</button><button class="btn" onclick="exportCatalogPdf()">⇩ PDF do catálogo</button></div><div class="catalog-filters"><select id="catFilter" class="field-input" onchange="onAdminCatFilterChange(this.value)"><option value="">Todas as categorias</option>${cats.map(x=>`<option value="${x.id}">${esc(x.nome)}</option>`).join('')}</select><select id="subFilter" class="field-input" onchange="catalogFilter()"><option value="">Todas as subcategorias</option>${subs.map(x=>`<option data-cat="${x.categoria_id}" value="${x.id}">${esc(x.nome)}</option>`).join('')}</select></div></div>`}
function onAdminCatFilterChange(catId){const subSel=document.getElementById('subFilter');if(subSel){subSel.querySelectorAll('option[data-cat]').forEach(opt=>{opt.hidden=!!catId&&opt.dataset.cat!==catId});if(subSel.selectedOptions[0]?.hidden)subSel.value=''}catalogFilter()}
function renderAdminCatalog(v){window.adminCurrentCatId='';window.adminCurrentSubId='';const p=window.adminProducts;const c=window.adminCategories;const promo=window.adminPromotions;const cats=c.categorias;const catCards=cats.length?`<div class="grid" style="margin-top:14px;margin-bottom:24px;">${cats.map(cat=>{const count=(p.items||[]).filter(x=>x.categoria_id===cat.id).length;const subCount=c.subcategorias.filter(s=>s.categoria_id===cat.id).length;return `<div class="card" style="cursor:pointer;position:relative" onclick="adminSubcategorias('${cat.id}')"><div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px"><h3 style="margin:0">${esc(cat.nome)}</h3><div style="display:flex;gap:4px;flex-shrink:0" onclick="event.stopPropagation()"><button class="btn" style="padding:4px 8px;font-size:12px" title="Editar categoria" onclick="editCategory(parseJsonArg('${jsonArg(cat)}'))">✏</button><button class="btn" style="padding:4px 8px;font-size:12px;color:#b42318" title="Excluir categoria" onclick="deleteCategory('${cat.id}',parseJsonArg('${jsonArg(cat.nome)}'))">🗑</button></div></div><p class="muted" style="margin-top:8px">${count} produtos · ${subCount} subcategorias</p></div>`}).join('')}</div>`:'';v.innerHTML=`${renderAdminCatalogToolbar()}<div class="catalog-summary"><span><b>${p.total}</b> produtos ativos</span><span><b>${cats.length}</b> categorias</span><span><b>${c.subcategorias.length}</b> subdivisões</span><span><b>${promo.items.length}</b> promoções ativas</span></div><div class="panel-title" style="margin-top:16px;"><h2>Categorias do Catálogo</h2></div>${catCards}<div class="panel-title" style="margin-top:24px;"><h2>Todos os Produtos</h2></div><div id="catalogTable" class="tablewrap"><table class="table"><thead><tr><th>Produto</th><th>SKU</th><th>Categoria</th><th>Subcategoria</th><th>Preço</th><th>Promoção</th><th>Ações</th></tr></thead><tbody>${p.items.map(x=>catalogRow(x)).join('')}</tbody></table></div><div class="panel category-panel" style="margin-top:24px"><div class="panel-title" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px"><div><h3>Estrutura do catálogo</h3><span class="badge">Editável pela Torre</span></div><div class="actions" style="display:flex;gap:8px"><button class="btn" onclick="newCategory()">+ Categoria</button><button class="btn" onclick="newSubcategory()">+ Subcategoria</button></div></div><div class="category-tree">${cats.map(cat=>{const subs=c.subcategorias.filter(s=>s.categoria_id===cat.id);return `<div class="category-node" style="display:flex;flex-direction:column;gap:10px;align-items:stretch"><div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap"><div><strong style="font-size:15px">${esc(cat.nome)}</strong><small>${esc(cat.descricao||'Sem descrição')}</small></div><div class="category-actions" style="display:flex;gap:6px"><button class="btn" style="padding:4px 8px;font-size:12px" onclick="editCategory(parseJsonArg('${jsonArg(cat)}'))">✏ Editar</button><button class="btn" style="padding:4px 8px;font-size:12px;color:#b42318" onclick="deleteCategory('${cat.id}',parseJsonArg('${jsonArg(cat.nome)}'))">🗑 Excluir</button><button class="btn primary" style="padding:4px 8px;font-size:12px" onclick="newSubcategory('${cat.id}')">+ Subcategoria</button></div></div><div style="display:flex;flex-wrap:wrap;gap:8px;padding-top:8px;border-top:1px solid #1e2c40"><span class="muted" style="font-size:11px;align-self:center;text-transform:uppercase;letter-spacing:0.5px">Subcategorias:</span>${subs.length?subs.map(s=>`<span class="badge" style="display:inline-flex;align-items:center;gap:6px;padding:4px 10px;background:#f1f5f9;border:1px solid #cbd5e1;color:#000000;font-size:12px"><span>${esc(s.nome)}</span><button type="button" title="Editar subcategoria" style="background:none;border:none;color:#94a3b8;cursor:pointer;padding:0 2px;font-size:12px" onmouseover="this.style.color='#f97316'" onmouseout="this.style.color='#94a3b8'" onclick="editSubcategory(parseJsonArg('${jsonArg(s)}'))">✏</button><button type="button" title="Excluir subcategoria" style="background:none;border:none;color:#f87171;cursor:pointer;padding:0 2px;font-size:12px" onmouseover="this.style.color='#ef4444'" onmouseout="this.style.color='#f87171'" onclick="deleteSubcategory('${s.id}',parseJsonArg('${jsonArg(s.nome)}'),'${cat.id}')">✕</button></span>`).join(''):'<span class="muted" style="font-size:12px">Sem subdivisões</span>'}</div></div>`}).join('')}</div></div>`}
function adminSubcategorias(catId){const v=$('#view');window.adminCurrentCatId=catId;window.adminCurrentSubId='';const cat=window.adminCategories.categorias.find(c=>c.id===catId);const subs=window.adminCategories.subcategorias.filter(s=>s.categoria_id===catId);const p=window.adminProducts;const catItems=(p.items||[]).filter(x=>x.categoria_id===catId);v.innerHTML=`${renderAdminCatalogToolbar()}<div class="mobile-nav" style="margin-bottom:14px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px"><button class="btn" onclick="renderAdminCatalog(document.getElementById('view'))">← Voltar a Todas as Categorias</button><div style="display:flex;gap:6px">${cat?`<button class="btn" onclick="editCategory(parseJsonArg('${jsonArg(cat)}'))">✏ Editar Categoria</button><button class="btn" style="color:#b42318" onclick="deleteCategory('${cat.id}',parseJsonArg('${jsonArg(cat.nome)}'))">🗑 Excluir Categoria</button>`:''}<button class="btn primary" onclick="newSubcategory('${catId}')">+ Nova Subcategoria</button></div></div><div class="panel-title"><h2>Categoria: ${esc(cat?.nome||'')}</h2><span class="badge">${catItems.length} produtos cadastrados</span></div><div class="grid" style="margin-top:14px;margin-bottom:24px;"><div class="card" style="cursor:pointer;border-left:4px solid #f97316" onclick="adminProdutosSub('','Todos os Produtos (${catItems.length})','${catId}')"><h3>Todos os Produtos</h3><p class="muted">Exibir todos os ${catItems.length} produtos desta categoria</p></div>${subs.length?subs.map(s=>{const count=(p.items||[]).filter(x=>x.subcategoria_id===s.id).length;return `<div class="card" style="cursor:pointer;position:relative" onclick="adminProdutosSub('${s.id}','${esc(s.nome).replace(/'/g,"\\'").replace(/"/g,"&quot;")}','${catId}')"><div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px"><h3 style="margin:0">${esc(s.nome)}</h3><div style="display:flex;gap:4px;flex-shrink:0" onclick="event.stopPropagation()"><button class="btn" style="padding:4px 8px;font-size:12px" title="Editar subcategoria" onclick="editSubcategory(parseJsonArg('${jsonArg(s)}'))">✏</button><button class="btn" style="padding:4px 8px;font-size:12px;color:#b42318" title="Excluir subcategoria" onclick="deleteSubcategory('${s.id}',parseJsonArg('${jsonArg(s.nome)}'),'${catId}')">🗑</button></div></div><p class="muted" style="margin-top:8px">${count} produtos</p></div>`}).join(''):'<p class="muted">Nenhuma subcategoria encontrada.</p>'}</div><div class="panel-title" style="margin-top:20px"><h2>Produtos em ${esc(cat?.nome||'')}</h2></div><div id="catalogTable" class="tablewrap"><table class="table"><thead><tr><th>Produto</th><th>SKU</th><th>Categoria</th><th>Subcategoria</th><th>Preço</th><th>Promoção</th><th>Ações</th></tr></thead><tbody>${catItems.map(x=>catalogRow(x)).join('')}</tbody></table></div>`;const cf=$('#catFilter');if(cf){cf.value=catId;onAdminCatFilterChange(catId)}}
function adminProdutosSub(subId,subName,catId){const v=$('#view');window.adminCurrentSubId=subId;window.adminCurrentCatId=catId;const p=window.adminProducts;const sub=subId?(window.adminCategories?.subcategorias||[]).find(s=>s.id===subId):null;const items=(p.items||[]).filter(x=>{if(catId&&x.categoria_id!==catId)return false;if(subId&&x.subcategoria_id!==subId)return false;return true});v.innerHTML=`${renderAdminCatalogToolbar()}<div class="mobile-nav" style="margin-bottom:14px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px"><div style="display:flex;gap:8px"><button class="btn" onclick="adminSubcategorias('${catId||''}')">← Subcategorias</button><button class="btn" onclick="renderAdminCatalog(document.getElementById('view'))">🏠 Catálogo Geral</button></div>${sub?`<div style="display:flex;gap:6px"><button class="btn" onclick="editSubcategory(parseJsonArg('${jsonArg(sub)}'))">✏ Editar Subcategoria</button><button class="btn" style="color:#b42318" onclick="deleteSubcategory('${sub.id}',parseJsonArg('${jsonArg(sub.nome)}'),'${catId}')">🗑 Excluir Subcategoria</button></div>`:''}</div><div class="panel-title"><h2>${esc(subName)}</h2><span class="badge">${items.length} produtos</span></div><div class="form" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px;"><div class="field"><label>Menor preço</label><input type="number" step="0.01" id="adminSubMin" class="search" placeholder="R$ 0,00" oninput="catalogFilter()"></div><div class="field"><label>Maior preço</label><input type="number" step="0.01" id="adminSubMax" class="search" placeholder="Sem limite" oninput="catalogFilter()"></div></div><div id="catalogTable" class="tablewrap"><table class="table"><thead><tr><th>Produto</th><th>SKU</th><th>Categoria</th><th>Subcategoria</th><th>Preço</th><th>Promoção</th><th>Ações</th></tr></thead><tbody>${items.map(x=>catalogRow(x)).join('')}</tbody></table></div>`;const cf=$('#catFilter');if(cf){cf.value=catId||'';onAdminCatFilterChange(catId||'');if(subId&&$('#subFilter'))$('#subFilter').value=subId}catalogFilter()}
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
function catalogFilter(input){const q=(input?.value??$('#pq')?.value??'').toLowerCase();const isSubView=!!document.getElementById('adminSubMin');let cat='';let sub='';let min=0;let max=Infinity;if(isSubView){cat=window.adminCurrentCatId||'';sub=window.adminCurrentSubId||'';min=Number($('#adminSubMin')?.value)||0;const maxRaw=$('#adminSubMax')?.value;max=maxRaw?Number(maxRaw):Infinity}else{cat=$('#catFilter')?.value||'';sub=$('#subFilter')?.value||''}document.querySelectorAll('#catalogTable tbody tr').forEach(r=>{const okText=r.innerText.toLowerCase().includes(q);const okCat=!cat||r.dataset.cat===cat;const okSub=!sub||r.dataset.sub===sub;const price=Number(r.dataset.price||0);const okPrice=(price>=min&&price<=max);r.style.display=okText&&okCat&&okSub&&okPrice?'':'none'})}
function productFormHtml(x={}){const cats=window.catalogCategories||[],subs=window.catalogSubcategories||[];return `<form id="productForm" class="form"><div class="field"><label>Nome</label><input name="nome" required maxlength="180" value="${esc(x.nome||'')}"></div><div class="field"><label>SKU (opcional)</label><input name="sku" maxlength="80" value="${esc(x.sku||'')}"></div><div class="field"><label>Código de barras</label><input name="codigo_barras" value="${esc(x.codigo_barras||'')}"></div><div class="field"><label>Marca</label><input name="marca" value="${esc(x.marca||'')}"></div><div class="field"><label>Sabor</label><input name="sabor" value="${esc(x.sabor||'')}"></div><div class="field"><label>Tamanho</label><input name="tamanho" value="${esc(x.tamanho||'')}"></div><div class="field"><label>Unidade</label><input name="unidade" value="${esc(x.unidade||'UN')}"></div><div class="field"><label>Categoria</label><select id="productCat" name="categoria_id"><option value="">Sem categoria</option>${cats.map(c=>`<option value="${c.id}" ${c.id===x.categoria_id?'selected':''}>${esc(c.nome)}</option>`).join('')}</select></div><div class="field"><label>Subcategoria</label><select id="productSub" name="subcategoria_id"><option value="">Sem subcategoria</option>${subs.map(z=>`<option data-cat="${z.categoria_id}" value="${z.id}" ${z.id===x.subcategoria_id?'selected':''}>${esc(z.nome)}</option>`).join('')}</select></div><div class="field"><label>Preço base</label><input name="preco_base" type="number" min="0" step="0.01" value="${Number(x.preco_base||0)}"></div><div class="field" style="grid-column:1/-1"><label>Descrição</label><textarea name="descricao" rows="4">${esc(x.descricao||'')}</textarea></div><div class="field" style="grid-column:1/-1"><small class="muted">Estoque é administrado exclusivamente no módulo Estoque Inteligente. Catálogo não altera saldo.</small></div><div class="actions"><button class="btn primary">Salvar produto</button></div></form>`}
function newProduct(){modal('Novo produto',productFormHtml());$('#productCat').onchange=()=>filterSubOptions($('#productCat').value);filterSubOptions('');$('#productForm').onsubmit=async e=>{e.preventDefault();try{const x=await api('/api/products',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(e.currentTarget)))});closeModal();toast('Produto criado. Estoque inicial permanece zero até lançamento no módulo Estoque.');show('products')}catch(x){toast(x.message)}}}
function filterSubOptions(cat){document.querySelectorAll('#productSub option[data-cat]').forEach(o=>o.hidden=!!cat&&o.dataset.cat!==cat);if($('#productSub')?.selectedOptions[0]?.hidden)$('#productSub').value=''}
function editProduct(x){modal('Editar produto',productFormHtml(x));$('#productCat').onchange=()=>filterSubOptions($('#productCat').value);filterSubOptions(x.categoria_id||'');$('#productForm').onsubmit=async e=>{e.preventDefault();try{await api('/api/products/'+x.id,{method:'PUT',body:JSON.stringify(Object.fromEntries(new FormData(e.currentTarget)))});closeModal();toast('Produto atualizado sem alterar o estoque');show('products')}catch(z){toast(z.message)}}}
function manageProductImages(x){modal('Fotos do produto — '+esc(x.nome),`<div class="photo-manager"><div class="photo-upload" style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:16px"><label class="btn primary photo-picker" style="cursor:pointer">+ Adicionar e Enquadrar Foto <input id="productPhotoInput" type="file" accept="image/png,image/jpeg,image/webp" hidden></label><span class="muted" style="font-size:12px">Mecanismo visual para mover, centralizar e ver exatamente a exibição no catálogo e loja.</span></div><div id="productPhotos" class="photo-grid">Carregando…</div></div>`,'780px');loadProductImages(x.id);$('#productPhotoInput').onchange=e=>{const f=e.target.files?.[0];if(!f)return;if(f.size>8*1024*1024)return toast('A imagem excede 8 MB');const r=new FileReader();r.onload=()=>{openImagePositionerModal(r.result,async(croppedDataUrl)=>{try{await api('/api/products/'+x.id+'/images',{method:'POST',body:JSON.stringify({data_url:croppedDataUrl})});toast('Foto centralizada e salva com sucesso!');loadProductImages(x.id);const [newP]=await Promise.all([api('/api/products?limit=100000')]);window.adminProducts=newP}catch(z){toast(z.message,true)}})};r.readAsDataURL(f)}}
function openImagePositionerModal(dataUrl,onSaveCallback,aspectMode='square'){const isCover=aspectMode==='cover_banner';const positionerModal=document.createElement('div');positionerModal.id='imagePositionerModal';positionerModal.style='position:fixed;inset:0;background:rgba(0,0,0,0.88);display:grid;place-items:center;z-index:110';positionerModal.innerHTML=`<div class="panel" style="width:min(820px,96vw);max-height:94vh;overflow-y:auto;background:#0b1422;border:1px solid #23344a;box-shadow:0 24px 60px rgba(0,0,0,0.6)"><div class="top" style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #1e2c3f;padding-bottom:10px;margin-bottom:14px"><div><h2 style="margin:0;font-size:1.25rem;color:#fff">📐 Enquadrar e Centralizar ${isCover?'Foto de Capa da Loja':'Foto'}</h2><p class="muted" style="margin:4px 0 0;font-size:12px">Arraste a foto com o mouse ou toque para mover. Ajuste o zoom para o tamanho e posição perfeitos.</p></div><button class="btn" id="closePositionerBtn" style="padding:4px 10px;font-size:18px">×</button></div><div class="photo-crop-workspace"><div class="photo-cropper-viewport" id="cropperViewport" style="${isCover?'max-width:680px;height:240px;aspect-ratio:16/9;':'max-width:420px;height:300px;'}"><img id="cropperImage" src="${dataUrl}" alt="Ajuste"><div class="photo-cropper-grid-overlay"><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div></div></div><div class="photo-cropper-controls"><label>🔍 Zoom: <input type="range" id="cropZoom" min="0.5" max="3.0" step="0.05" value="1.0" style="width:140px"><span id="zoomVal" style="color:#fd5e02;font-weight:bold;min-width:35px">100%</span></label><button type="button" class="btn" id="btnCenterCrop" style="font-size:12px;padding:6px 12px">🎯 Centralizar Foto</button><button type="button" class="btn" id="btnFitCrop" style="font-size:12px;padding:6px 12px">⛶ Ajustar às Bordas</button></div><div><strong style="display:block;font-size:13px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;text-align:center">Como ela será exibida nos locais do sistema:</strong><div class="photo-preview-group">${isCover?`<div class="photo-preview-item" style="width:100%"><div style="width:100%;max-width:540px;height:160px;border-radius:12px;background:#021d60;border:2px solid var(--xv-brand-orange,#fd5e02);overflow:hidden;position:relative;display:flex;align-items:flex-end;box-shadow:0 8px 24px rgba(2,29,96,0.3)"><canvas id="previewCanvasCover" width="540" height="160" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover"></canvas><div style="position:relative;z-index:2;padding:12px;color:#fff;pointer-events:none;background:linear-gradient(90deg,rgba(2,29,96,0.9),rgba(2,29,96,0.3),transparent);width:100%"><strong style="font-size:16px;display:block">Catálogo Xiquim Vargas</strong><span style="font-size:11px;opacity:0.9">Card de Capa da Loja Online</span></div></div><span>Card Oficial da Loja Online</span></div>`:`<div class="photo-preview-item"><div class="photo-preview-box-store"><canvas id="previewCanvasStore" width="140" height="140"></canvas></div><span>Card da Loja Online & PDV</span></div><div class="photo-preview-item"><div class="photo-preview-box-mini"><canvas id="previewCanvasMini" width="48" height="48"></canvas></div><span>Tabelas & Miniaturas</span></div>`}</div></div><div class="actions" style="justify-content:flex-end;margin-top:14px;border-top:1px solid #1e2c3f;padding-top:14px"><button type="button" class="btn" id="cancelPositionerBtn">Cancelar</button><button type="button" class="btn primary" id="confirmPositionerBtn" style="padding:10px 20px;font-weight:800">✓ Confirmar e Usar Esta Posição</button></div></div></div>`;document.body.appendChild(positionerModal);const vp=positionerModal.querySelector('#cropperViewport');const img=positionerModal.querySelector('#cropperImage');const zoomInput=positionerModal.querySelector('#cropZoom');const zoomVal=positionerModal.querySelector('#zoomVal');const cvsCover=positionerModal.querySelector('#previewCanvasCover');const cvsStore=positionerModal.querySelector('#previewCanvasStore');const cvsMini=positionerModal.querySelector('#previewCanvasMini');let scale=1.0;let posX=0;let posY=0;let isDragging=false;let startX=0;let startY=0;let initialImgW=0;let initialImgH=0;function updateTransform(){img.style.transform=`translate(${posX}px, ${posY}px) scale(${scale})`;zoomVal.textContent=Math.round(scale*100)+'%';renderLivePreviews()}function renderLivePreviews(){if(!initialImgW||!initialImgH)return;const vpRect=vp.getBoundingClientRect();const vpW=vpRect.width||(isCover?680:420);const vpH=vpRect.height||(isCover?240:300);const targets=isCover?[cvsCover]:[cvsStore,cvsMini];targets.forEach(cvs=>{if(!cvs)return;const ctx=cvs.getContext('2d');ctx.clearRect(0,0,cvs.width,cvs.height);ctx.fillStyle=isCover?'#021d60':'#ffffff';ctx.fillRect(0,0,cvs.width,cvs.height);const ratio=cvs.width/vpW;ctx.save();ctx.translate(cvs.width/2,cvs.height/2);ctx.translate(posX*ratio,posY*ratio);ctx.scale(scale*ratio,scale*ratio);ctx.drawImage(img,-initialImgW/2,-initialImgH/2,initialImgW,initialImgH);ctx.restore()})}img.onload=()=>{const vpRect=vp.getBoundingClientRect();const vpW=vpRect.width||(isCover?680:420);const vpH=vpRect.height||(isCover?240:300);initialImgW=img.naturalWidth;initialImgH=img.naturalHeight;img.style.width=initialImgW+'px';img.style.height=initialImgH+'px';scale=isCover?Math.max(vpW/initialImgW,vpH/initialImgH):Math.min((vpW*0.9)/(initialImgW||1),(vpH*0.9)/(initialImgH||1),1.0);zoomInput.value=scale;posX=0;posY=0;updateTransform()};if(img.complete)img.onload();vp.addEventListener('mousedown',e=>{isDragging=true;startX=e.clientX-posX;startY=e.clientY-posY});window.addEventListener('mousemove',e=>{if(!isDragging)return;posX=e.clientX-startX;posY=e.clientY-startY;updateTransform()});window.addEventListener('mouseup',()=>{isDragging=false});vp.addEventListener('touchstart',e=>{if(e.touches.length===1){isDragging=true;startX=e.touches[0].clientX-posX;startY=e.touches[0].clientY-posY}},{passive:true});window.addEventListener('touchmove',e=>{if(!isDragging||e.touches.length!==1)return;posX=e.touches[0].clientX-startX;posY=e.touches[0].clientY-startY;updateTransform()},{passive:true});window.addEventListener('touchend',()=>{isDragging=false});zoomInput.oninput=()=>{scale=parseFloat(zoomInput.value);updateTransform()};positionerModal.querySelector('#btnCenterCrop').onclick=()=>{posX=0;posY=0;updateTransform()};positionerModal.querySelector('#btnFitCrop').onclick=()=>{const vpRect=vp.getBoundingClientRect();const vpW=vpRect.width||(isCover?680:420);const vpH=vpRect.height||(isCover?240:300);scale=isCover?Math.max(vpW/initialImgW,vpH/initialImgH):Math.min((vpW*0.9)/(initialImgW||1),(vpH*0.9)/(initialImgH||1),1.0);zoomInput.value=scale;posX=0;posY=0;updateTransform()};const closeMe=()=>positionerModal.remove();positionerModal.querySelector('#closePositionerBtn').onclick=closeMe;positionerModal.querySelector('#cancelPositionerBtn').onclick=closeMe;positionerModal.querySelector('#confirmPositionerBtn').onclick=()=>{const outCanvas=document.createElement('canvas');const outW=isCover?1280:600;const outH=isCover?480:600;outCanvas.width=outW;outCanvas.height=outH;const ctx=outCanvas.getContext('2d');ctx.fillStyle=isCover?'#021d60':'#ffffff';ctx.fillRect(0,0,outW,outH);const vpRect=vp.getBoundingClientRect();const vpW=vpRect.width||(isCover?680:420);const ratio=outW/vpW;ctx.save();ctx.translate(outW/2,outH/2);ctx.translate(posX*ratio,posY*ratio);ctx.scale(scale*ratio,scale*ratio);ctx.drawImage(img,-initialImgW/2,-initialImgH/2,initialImgW,initialImgH);ctx.restore();const resultDataUrl=outCanvas.toDataURL('image/jpeg',0.92);closeMe();onSaveCallback(resultDataUrl)}}
async function loadProductImages(id){try{const x=await api('/api/products/'+id+'/images');$('#productPhotos').innerHTML=x.items.length?x.items.map(i=>`<div class="photo-item" style="display:flex;justify-content:space-between;align-items:center;background:#0d1624;padding:12px;border:1px solid #203248;border-radius:10px;margin-bottom:8px"><div style="display:flex;align-items:center;gap:12px"><img src="${i.url}" alt="" style="width:58px;height:58px;object-fit:contain;background:#fff;border-radius:8px;border:1px solid #cbd5e1"><div><span class="badge" style="background:${i.principal?'rgba(253,94,2,0.18)':'rgba(255,255,255,0.08)'};color:${i.principal?'#fd5e02':'#cbd5e1'}">${i.principal?'Principal':'Foto'}</span></div></div><div class="actions" style="display:flex;gap:6px"><button type="button" class="btn" style="font-size:12px;padding:6px 10px" onclick="repositionProductImage('${i.url}', '${id}')">📐 Ajustar / Mover</button><button class="btn danger" style="font-size:12px;padding:6px 10px" onclick="deleteProductImage('${i.id}',${id?`'${id}'`:'null'})">Excluir</button></div></div>`).join(''):'<div class="empty-state">Nenhuma foto cadastrada.</div>'}catch(e){$('#productPhotos').textContent=e.message}}
function repositionProductImage(imageUrl, productId){openImagePositionerModal(imageUrl, async(croppedDataUrl)=>{try{await api('/api/products/'+productId+'/images',{method:'POST',body:JSON.stringify({data_url:croppedDataUrl})});toast('Novo enquadramento salvo com sucesso!');loadProductImages(productId);const [newP]=await Promise.all([api('/api/products?limit=100000')]);window.adminProducts=newP}catch(z){toast(z.message,true)}})}
async function deleteProductImage(imageId,productId){if(!confirm('Excluir esta foto?'))return;try{await api('/api/product-images/'+imageId,{method:'DELETE'});toast('Foto excluída');loadProductImages(productId);show('products')}catch(e){toast(e.message)}}
function managePromotion(x){modal('Promoção — '+esc(x.nome),`<form id="promoForm" class="form"><div class="field"><label>Nome da promoção</label><input name="nome" value="${esc(x.promocao_nome||'Oferta especial')}" required></div><div class="field"><label>Preço promocional</label><input name="preco_promocional" type="number" min="0" step="0.01" required value="${x.promocao_preco!=null?Number(x.promocao_preco):''}"></div><div class="field"><label>Início</label><input name="inicio" type="datetime-local"></div><div class="field"><label>Término</label><input name="termino" type="datetime-local"></div><div class="actions"><button class="btn primary">Publicar promoção</button></div></form><div class="panel"><p class="muted">A promoção altera o preço exibido/comercializado no catálogo e loja, sem alterar estoque.</p></div>`);$('#promoForm').onsubmit=async e=>{e.preventDefault();try{await api('/api/products/'+x.id+'/promotions',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(e.currentTarget)))});closeModal();toast('Promoção publicada');show('products')}catch(z){toast(z.message)}}}
function exportCatalogPdf(){downloadAuthFile('/api/admin/export/catalog.pdf','xiquim-vargas-catalogo.pdf')}
function newCategory(){modal('Nova categoria',`<form id="categoryForm" class="form"><div class="field"><label>Nome</label><input name="nome" required maxlength="120"></div><div class="field"><label>Slug (opcional)</label><input name="slug"></div><div class="field" style="grid-column:1/-1"><label>Descrição</label><textarea name="descricao"></textarea></div><div class="actions"><button class="btn primary">Criar categoria</button></div></form>`);$('#categoryForm').onsubmit=async e=>{e.preventDefault();try{await api('/api/categories',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(e.currentTarget)))});closeModal();toast('Categoria criada');show('products')}catch(x){toast(x.message)}}}
function editCategory(x){modal('Editar categoria',`<form id="categoryForm" class="form"><div class="field"><label>Nome</label><input name="nome" value="${esc(x.nome)}" required></div><div class="field"><label>Slug</label><input name="slug" value="${esc(x.slug)}"></div><div class="field"><label>Ordem</label><input name="ordem" type="number" value="${x.ordem||0}"></div><div class="field"><label>Status</label><select name="ativo"><option value="1" ${x.ativo?'selected':''}>Ativa</option><option value="0" ${!x.ativo?'selected':''}>Inativa</option></select></div><div class="field" style="grid-column:1/-1"><label>Descrição</label><textarea name="descricao">${esc(x.descricao||'')}</textarea></div><div class="actions" style="grid-column:1/-1;display:flex;justify-content:space-between;align-items:center;margin-top:14px"><button type="button" class="btn" style="color:#b42318;border-color:#f5b5b5" onclick="deleteCategory('${x.id}',parseJsonArg('${jsonArg(x.nome)}'))">🗑 Excluir categoria</button><div style="display:flex;gap:8px"><button type="button" class="btn" onclick="closeModal()">Cancelar</button><button class="btn primary">Salvar categoria</button></div></div></form>`);$('#categoryForm').onsubmit=async e=>{e.preventDefault();try{await api('/api/categories/'+x.id,{method:'PUT',body:JSON.stringify(Object.fromEntries(new FormData(e.currentTarget)))});closeModal();toast('Categoria atualizada');show('products')}catch(z){toast(z.message)}}}
async function deleteCategory(id,nome){const p=window.adminProducts?.items||[];const subs=(window.adminCategories?.subcategorias||[]).filter(s=>s.categoria_id===id);const prodCount=p.filter(x=>x.categoria_id===id).length;let msg=`Excluir a categoria "${nome}"?`;if(prodCount>0||subs.length>0){msg+=`\n\n- ${prodCount} produto(s) vinculado(s) ficarão "Sem categoria".`;if(subs.length>0)msg+=`\n- ${subs.length} subcategoria(s) associada(s) também serão excluídas.`}msg+=`\n\nO histórico de pedidos e estoque é preservado. Deseja continuar?`;if(!confirm(msg))return;try{await api('/api/categories/'+id,{method:'DELETE'});closeModal();toast(`Categoria "${nome}" excluída com sucesso`);show('products')}catch(e){toast(e.message,true)}}
async function deleteSubcategory(id,nome,catId){const p=window.adminProducts?.items||[];const prodCount=p.filter(x=>x.subcategoria_id===id).length;let msg=`Excluir a subcategoria "${nome}"?`;if(prodCount>0){msg+=`\n\n- ${prodCount} produto(s) vinculado(s) ficarão sem subcategoria (permanecem na categoria principal).`}msg+=`\n\nO histórico de pedidos e estoque é preservado. Deseja continuar?`;if(!confirm(msg))return;try{await api('/api/subcategories/'+id,{method:'DELETE'});closeModal();toast(`Subcategoria "${nome}" excluída com sucesso`);const cId=catId||window.adminCurrentCatId;if(cId){const [newP,newC]=await Promise.all([api('/api/products?limit=100000'),api('/api/categories')]);window.adminProducts=newP;window.adminCategories=newC;window.catalogCategories=newC.categorias;window.catalogSubcategories=newC.subcategorias;adminSubcategorias(cId)}else{show('products')}}catch(e){toast(e.message,true)}}
function newSubcategory(defaultCatId){const cats=window.catalogCategories||window.adminCategories?.categorias||[];modal('Nova subcategoria',`<form id="subForm" class="form"><div class="field"><label>Categoria vinculada</label><select name="categoria_id" required><option value="">Selecione a categoria...</option>${cats.map(c=>`<option value="${c.id}" ${c.id===defaultCatId?'selected':''}>${esc(c.nome)}</option>`).join('')}</select></div><div class="field"><label>Nome da subcategoria</label><input name="nome" required maxlength="120" placeholder="Ex: Latas, Long Neck, Garrafas..."></div><div class="field"><label>Slug (opcional)</label><input name="slug" placeholder="ex: latas"></div><div class="field"><label>Ordem de exibição</label><input name="ordem" type="number" value="0"></div><div class="actions" style="grid-column:1/-1;display:flex;justify-content:flex-end;gap:8px;margin-top:10px"><button type="button" class="btn" onclick="closeModal()">Cancelar</button><button class="btn primary">Criar subcategoria</button></div></form>`);$('#subForm').onsubmit=async e=>{e.preventDefault();try{const b=Object.fromEntries(new FormData(e.currentTarget));b.ordem=Number(b.ordem||0);await api('/api/subcategories',{method:'POST',body:JSON.stringify(b)});closeModal();toast('Subcategoria criada com sucesso');if(defaultCatId){const [newP,newC]=await Promise.all([api('/api/products?limit=100000'),api('/api/categories')]);window.adminProducts=newP;window.adminCategories=newC;window.catalogCategories=newC.categorias;window.catalogSubcategories=newC.subcategorias;adminSubcategorias(defaultCatId)}else{show('products')}}catch(x){toast(x.message,true)}}}
function editSubcategory(s){const cats=window.catalogCategories||window.adminCategories?.categorias||[];modal('Editar subcategoria',`<form id="editSubForm" class="form"><div class="field"><label>Categoria vinculada</label><select name="categoria_id" required>${cats.map(c=>`<option value="${c.id}" ${c.id===s.categoria_id?'selected':''}>${esc(c.nome)}</option>`).join('')}</select></div><div class="field"><label>Nome da subcategoria</label><input name="nome" value="${esc(s.nome)}" required maxlength="120"></div><div class="field"><label>Slug</label><input name="slug" value="${esc(s.slug||'')}"></div><div class="field"><label>Ordem de exibição</label><input name="ordem" type="number" value="${s.ordem||0}"></div><div class="field"><label>Status</label><select name="ativo"><option value="1" ${s.ativo?'selected':''}>Ativa</option><option value="0" ${!s.ativo?'selected':''}>Inativa</option></select></div><div class="actions" style="grid-column:1/-1;display:flex;justify-content:space-between;align-items:center;margin-top:14px"><button type="button" class="btn" style="color:#b42318;border-color:#f5b5b5" onclick="deleteSubcategory('${s.id}',parseJsonArg('${jsonArg(s.nome)}'),'${s.categoria_id}')">🗑 Excluir subcategoria</button><div style="display:flex;gap:8px"><button type="button" class="btn" onclick="closeModal()">Cancelar</button><button class="btn primary">Salvar subcategoria</button></div></div></form>`);$('#editSubForm').onsubmit=async e=>{e.preventDefault();try{const b=Object.fromEntries(new FormData(e.currentTarget));b.ordem=Number(b.ordem||0);b.ativo=Number(b.ativo||1);await api('/api/subcategories/'+s.id,{method:'PUT',body:JSON.stringify(b)});closeModal();toast('Subcategoria atualizada com sucesso');if(window.adminCurrentCatId){const [newP,newC]=await Promise.all([api('/api/products?limit=100000'),api('/api/categories')]);window.adminProducts=newP;window.adminCategories=newC;window.catalogCategories=newC.categorias;window.catalogSubcategories=newC.subcategorias;adminSubcategorias(window.adminCurrentCatId)}else{show('products')}}catch(z){toast(z.message,true)}}}
async function stock(v){const x=await api('/api/stock?limit=100000');v.innerHTML=`<div class="panel"><div class="panel-title"><div><h3>Estoque Inteligente</h3><p class="muted">Módulo independente do catálogo. Alterações aqui não alteram nome, preço, categoria ou fotos.</p></div><div class="actions"><input id="stockSearch" class="search" style="max-width:360px" placeholder="Pesquisar estoque" oninput="stockFilter(this)"><button class="btn primary" onclick="exportStockPdf()">⇩ PDF do estoque</button></div></div><div class="stock-kpis"><span><b>${x.total}</b> itens</span><span><b>${x.items.filter(i=>i.status==='CRITICO').length}</b> críticos</span><span><b>${x.items.reduce((a,i)=>a+Number(i.quantidade_reservada),0)}</b> reservados</span></div></div><div id="stockTable" class="tablewrap"><table class="table"><thead><tr><th>Produto</th><th>SKU</th><th>Descrição</th><th>Disponível</th><th>Reservado</th><th>Mínimo</th><th>Status</th><th>Ações</th></tr></thead><tbody>${x.items.map(stockRow).join('')}</tbody></table></div>`}
function stockRow(x){return `<tr data-stock-text="${esc((x.nome+' '+x.sku+' '+(x.descricao||'')).toLowerCase())}"><td><div class="catalog-product-cell">${x.foto_url?`<img class="catalog-mini-photo" src="${esc(x.foto_url)}" alt="" onerror="this.onerror=null;this.replaceWith(Object.assign(document.createElement('div'),{className:'catalog-mini-photo placeholder',textContent:'XV'}))">`:'<div class="catalog-mini-photo placeholder">XV</div>'}<div><strong>${esc(x.nome)}</strong><br><small>${esc([x.marca,x.sabor,x.tamanho].filter(Boolean).join(' · '))}</small></div></div></td><td>${esc(x.sku)}</td><td>${esc(x.descricao||'-')}</td><td><strong>${x.quantidade_disponivel}</strong></td><td>${x.quantidade_reservada}</td><td>${x.estoque_minimo}</td><td><span class="badge status-${String(x.status).toLowerCase()}">${esc(x.status)}</span></td><td><button class="btn" onclick="adjustStock('${x.id}')">Movimentar</button> <button class="btn" onclick="stockHistory('${x.id}')">Histórico</button></td></tr>`}
function stockFilter(i){const q=i.value.toLowerCase();document.querySelectorAll('#stockTable tbody tr').forEach(r=>r.style.display=r.dataset.stockText.includes(q)?'':'none')}
function exportStockPdf(){downloadAuthFile('/api/admin/export/stock.pdf','xiquim-vargas-estoque.pdf')}
async function stockHistory(id){try{const x=await api('/api/stock/'+id+'/movements');modal('Histórico de estoque',`<div class="tablewrap"><table class="table"><thead><tr><th>Data</th><th>Tipo</th><th>Delta</th><th>Saldo</th><th>Operador</th><th>Observação</th></tr></thead><tbody>${x.items.map(m=>`<tr><td>${new Date(m.created_at).toLocaleString('pt-BR')}</td><td>${esc(m.tipo)}</td><td>${m.quantidade>0?'+':''}${m.quantidade}</td><td>${m.quantidade_posterior}</td><td>${esc(m.operador_nome||'-')}</td><td>${esc(m.observacao||'-')}</td></tr>`).join('')||'<tr><td colspan="6">Sem movimentações.</td></tr>'}</tbody></table></div>`)}catch(e){toast(e.message)}}
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
        <div class="card kpi" style="border-top:4px solid #021D60;">
          <div style="font-size:13px;color:#8193a9;margin-bottom:4px;">🟢 Recorrentes Ativos (≤15d)</div>
          <div class="v" style="color:#10b981;">${s.ativos || 0}</div>
          <div style="font-size:11px;color:#10b981;margin-top:4px;">Comprando no ciclo ideal</div>
        </div>
        <div class="card kpi" style="border-top:4px solid #021D60;">
          <div style="font-size:13px;color:#8193a9;margin-bottom:4px;">⚠️ Em Risco / Churn (16–45d)</div>
          <div class="v" style="color:#f59e0b;">${s.em_risco || 0}</div>
          <div style="font-size:11px;color:#d97706;margin-top:4px;">Atenção: ciclo de recompra atrasado</div>
        </div>
        <div class="card kpi" style="border-top:4px solid #021D60;">
          <div style="font-size:13px;color:#8193a9;margin-bottom:4px;">🔴 Inativos / Dormientes (>45d)</div>
          <div class="v" style="color:#ef4444;">${s.inativos || 0}</div>
          <div style="font-size:11px;color:#ef4444;margin-top:4px;">Requerem reativação urgente</div>
        </div>
        <div class="card kpi" style="border-top:4px solid #021D60;">
          <div style="font-size:13px;color:#8193a9;margin-bottom:4px;">⭐ Clientes VIPs</div>
          <div class="v" style="color:#8b5cf6;">${s.vips || 0}</div>
          <div style="font-size:11px;color:#8b5cf6;margin-top:4px;">Alto faturamento e frequência</div>
        </div>
        <div class="card kpi" style="border-top:4px solid #021D60;">
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
const defaultInstitutionalCards = [
  {
    id: 'horarios',
    badge: 'Atendimento',
    title: 'Horários de Atendimento',
    description: 'Confira nossos horários de funcionamento presencial e entregas: Segunda à Sexta das 07:30 às 17:30 e Sábado das 07:30 às 12:30.',
    image: '/assets/institucional/02_Horarios_de_Atendimento_HD.png',
    link: '',
    link_text: ''
  },
  {
    id: 'localizacao',
    badge: 'Endereço',
    title: 'Nossa Localização',
    description: 'Venha nos visitar! Rua José Luiz Nogueira, 645 - Centro, Governador Valadares/MG (Próximo ao Mercado Municipal).',
    image: '/assets/institucional/03_Nossa_Localizacao_Fachada_HD.png',
    link: 'https://maps.google.com/?q=Rua+Jose+Luiz+Nogueira+645+Centro+Governador+Valadares+MG',
    link_text: '📍 Abrir no Google Maps'
  },
  {
    id: 'rotas',
    badge: 'Logística & Entregas',
    title: 'Rotas de Entrega & Dias da Região',
    description: 'Entregas diárias no centro e cronograma semanal organizado por bairros em toda a região com agilidade e compromisso.',
    image: '/assets/institucional/04_Rotas_de_Entrega_Dias_HD.png',
    link: '',
    link_text: ''
  }
];

async function storeSettings(v){
  const s = await api('/api/settings');
  const vals = Object.fromEntries(s.items.map(x=>[x.chave,x.valor]));
  let aboutCards = defaultInstitutionalCards;
  if(vals['store.about_cards']){
    try {
      const parsed = JSON.parse(vals['store.about_cards']);
      if(Array.isArray(parsed) && parsed.length) aboutCards = parsed;
    } catch(e){}
  }
  window._adminAboutCards = JSON.parse(JSON.stringify(aboutCards));

  v.innerHTML = `
    <div class="panel">
      <div class="panel-title">
        <div>
          <h3>Gestão da Loja Online</h3>
          <p class="muted">Controle editorial da vitrine, identidade visual e dashboard institucional "Sobre Nós".</p>
        </div>
        <div class="actions">
          <a class="btn" href="/loja.html" target="_blank">🌐 Visualizar Loja</a>
          <button class="btn" onclick="show('products')">Abrir catálogo</button>
        </div>
      </div>
      <form id="storeConfigForm" class="form">
        <div class="field">
          <label>Título da loja</label>
          <input name="store.title" value="${esc(vals['store.title']||'Catálogo Xiquim Vargas')}">
        </div>
        <div class="field">
          <label>Subtítulo</label>
          <input name="store.subtitle" value="${esc(vals['store.subtitle']||'Distribuição, reposição e condições comerciais em um só lugar.')}">
        </div>
        <div class="field" style="grid-column:1/-1">
          <label>Texto principal / Hero</label>
          <textarea name="store.hero" rows="3">${esc(vals['store.hero']||'Encontre produtos, condições e reposição para o seu negócio.')}</textarea>
        </div>
        <div class="field" style="grid-column:1/-1">
          <label>Subtítulo da página "Sobre Nós"</label>
          <textarea name="store.about_subtitle" rows="2">${esc(vals['store.about_subtitle']||'Tradição, agilidade e compromisso no fornecimento de bebidas, doces e alimentos para o comércio e varejo de Governador Valadares e região.')}</textarea>
        </div>
        <div class="field" style="grid-column:1/-1">
          <label>Foto de capa da loja</label>
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;flex-wrap:wrap">
            <label class="btn primary photo-picker" style="cursor:pointer">
              📷 Escolher e Ajustar Foto de Capa
              <input id="storeCoverInput" type="file" accept="image/png,image/jpeg,image/webp" hidden>
            </label>
            ${vals['store.cover']?`<button type="button" class="btn" style="padding:10px 14px" onclick="repositionStoreCover('${esc(vals['store.cover'])}')">📐 Mover e Centralizar Capa Atual</button>`:''}
          </div>
          <div id="storeCoverPreview" class="store-cover-preview">
            ${vals['store.cover']?`<img src="${esc(vals['store.cover'])}" alt="Capa atual">`:'<span class="muted">Nenhuma capa cadastrada.</span>'}
          </div>
          <span class="muted">PNG, JPG ou WEBP · até 8 MB. A capa aparece imediatamente abaixo do cabeçalho da Loja Online.</span>
        </div>
        <div class="field" style="grid-column:1/-1">
          <label>💰 Valor Mínimo de Compra na Loja Online (R$)</label>
          <input name="store.min_order_value" type="number" step="0.01" min="0" placeholder="0.00 (deixe 0 ou vazio para sem valor mínimo)" value="${esc(vals['store.min_order_value']||'')}">
          <span class="muted">Exibido com destaque na página inicial de todos os clientes da loja online e bloqueia finalizações abaixo deste valor.</span>
        </div>
        <div class="field" style="grid-column:1/-1">
          <label>Rodapé</label>
          <textarea name="store.footer" rows="2">${esc(vals['store.footer']||'Pedido, catálogo e operação integrados.')}</textarea>
        </div>
        <div class="actions" style="grid-column:1/-1">
          <button class="btn primary">Salvar identidade da loja</button>
        </div>
      </form>
    </div>

    <div class="panel" style="margin-top:20px">
      <div class="panel-title">
        <div>
          <h3>🏢 Configuração do Painel "Sobre Nós" (Cards Institucionais)</h3>
          <p class="muted">Adicione, edite ou remova cards com fotos, horários de atendimento, localização e rotas de entrega que aparecem no botão "Sobre Nós" da loja online.</p>
        </div>
        <div class="actions">
          <button type="button" class="btn primary" onclick="adminAddAboutCard()">+ Novo Card Institucional</button>
          <button type="button" class="btn" onclick="adminResetAboutCards()">↺ Restaurar Padrão Oficial</button>
        </div>
      </div>
      <div id="adminAboutCardsList" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px;margin-top:16px">
      </div>
      <div class="actions" style="margin-top:20px;border-top:1px solid #1f2d40;padding-top:16px;justify-content:flex-end">
        <button type="button" class="btn primary" style="padding:12px 20px;font-size:15px" onclick="adminSaveAboutCards()">💾 Salvar Todos os Cards do Sobre Nós</button>
      </div>
    </div>
  `;

  renderAdminAboutCardsList();

  window.repositionStoreCover = function(coverUrl) {
    if(!coverUrl) return;
    openImagePositionerModal(coverUrl, async (croppedDataUrl) => {
      try {
        const out = await api('/api/store-cover', { method: 'POST', body: JSON.stringify({ data_url: croppedDataUrl }) });
        $('#storeCoverPreview').innerHTML = `<img src="${esc(out.url)}" alt="Capa atual">`;
        toast('Foto de capa ajustada e salva com sucesso!');
        show('store');
      } catch(z) { toast(z.message, true); }
    }, 'cover_banner');
  };

  $('#storeCoverInput').onchange = e => {
    const f = e.target.files?.[0];
    if(!f) return;
    if(f.size > 8*1024*1024) return toast('A imagem excede 8 MB');
    const r = new FileReader();
    r.onload = () => {
      openImagePositionerModal(r.result, async (croppedDataUrl) => {
        try {
          const out = await api('/api/store-cover', { method: 'POST', body: JSON.stringify({ data_url: croppedDataUrl }) });
          $('#storeCoverPreview').innerHTML = `<img src="${esc(out.url)}" alt="Capa atual">`;
          toast('Foto de capa ajustada e salva com sucesso!');
          show('store');
        } catch(z) { toast(z.message, true); }
      }, 'cover_banner');
    };
    /*
      try {
        const out = await api('/api/store-cover', { method: 'POST', body: JSON.stringify({ data_url: r.result }) });
        $('#storeCoverPreview').innerHTML = `<img src="${esc(out.url)}" alt="Capa atual">`;
        toast('Foto de capa atualizada');
      } catch(z) { toast(z.message, true); }
    */
    r.readAsDataURL(f);
  };

  $('#storeConfigForm').onsubmit = async e => {
    e.preventDefault();
    for(const [chave,valor] of Object.entries(Object.fromEntries(new FormData(e.currentTarget)))) {
      await api('/api/settings', { method: 'POST', body: JSON.stringify({ chave, valor }) });
    }
    toast('Identidade da Loja Online atualizada com sucesso!');
  };
}

function renderAdminAboutCardsList(){
  const container = document.getElementById('adminAboutCardsList');
  if(!container) return;
  const cards = window._adminAboutCards || [];
  if(!cards.length){
    container.innerHTML = `<div class="empty-state" style="grid-column:1/-1">Nenhum card cadastrado. Clique em "+ Novo Card Institucional".</div>`;
    return;
  }
  container.innerHTML = cards.map((c, idx) => `
    <div class="card" style="display:flex;flex-direction:column;gap:12px;position:relative;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span class="badge" style="background:rgba(253,94,2,0.18);color:#fd5e02">Card #${idx+1}</span>
        <div style="display:flex;gap:6px">
          ${idx > 0 ? `<button type="button" class="btn" style="padding:4px 8px;font-size:12px" title="Subir" onclick="adminMoveAboutCard(${idx}, -1)">▲</button>` : ''}
          ${idx < cards.length - 1 ? `<button type="button" class="btn" style="padding:4px 8px;font-size:12px" title="Descer" onclick="adminMoveAboutCard(${idx}, 1)">▼</button>` : ''}
          <button type="button" class="btn danger" style="padding:4px 8px;font-size:12px" title="Excluir card" onclick="adminDeleteAboutCard(${idx})">🗑</button>
        </div>
      </div>
      <div style="width:100%;height:180px;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e2e8f0;display:flex;align-items:center;justify-content:center;position:relative">
        ${c.image ? `<img src="${esc(c.image)}" alt="" style="width:100%;height:100%;object-fit:contain">` : `<span class="muted" style="font-size:12px">Sem imagem</span>`}
        <label style="position:absolute;bottom:8px;right:8px;background:rgba(0,0,0,0.75);color:#fff;padding:4px 10px;border-radius:6px;font-size:11px;cursor:pointer;border:1px solid rgba(255,255,255,0.25)">
          📷 Trocar Foto
          <input type="file" accept="image/*" style="display:none" onchange="adminUploadCardImage(${idx}, this)">
        </label>
      </div>
      <div class="field">
        <label>Etiqueta / Tag (Ex: Atendimento, Endereço, Logística)</label>
        <input value="${esc(c.badge||'')}" oninput="window._adminAboutCards[${idx}].badge = this.value" placeholder="Tag de identificação">
      </div>
      <div class="field">
        <label>Título do Card</label>
        <input value="${esc(c.title||'')}" oninput="window._adminAboutCards[${idx}].title = this.value" placeholder="Ex: Horários de Atendimento" required>
      </div>
      <div class="field">
        <label>Descrição detalhada</label>
        <textarea rows="3" oninput="window._adminAboutCards[${idx}].description = this.value" placeholder="Texto explicativo do card...">${esc(c.description||'')}</textarea>
      </div>
      <div class="field">
        <label>Link Externo ou Mapa (opcional)</label>
        <input value="${esc(c.link||'')}" oninput="window._adminAboutCards[${idx}].link = this.value" placeholder="https://maps.google.com/...">
      </div>
      <div class="field">
        <label>Texto do Botão do Link</label>
        <input value="${esc(c.link_text||'')}" oninput="window._adminAboutCards[${idx}].link_text = this.value" placeholder="Ex: 📍 Abrir no Google Maps">
      </div>
    </div>
  `).join('');
}

window.adminAddAboutCard = function(){
  window._adminAboutCards = window._adminAboutCards || [];
  window._adminAboutCards.push({
    id: 'card_' + Date.now(),
    badge: 'Institucional',
    title: 'Novo Card Informativo',
    description: 'Insira a descrição detalhada para seus clientes aqui.',
    image: '/assets/institucional/01_Logo_Xiquim_Vargas_HD.png',
    link: '',
    link_text: ''
  });
  renderAdminAboutCardsList();
  toast('Novo card adicionado. Preencha os campos e salve.');
};

window.adminDeleteAboutCard = function(idx){
  if(!confirm('Deseja realmente remover este card institucional?')) return;
  window._adminAboutCards.splice(idx, 1);
  renderAdminAboutCardsList();
};

window.adminMoveAboutCard = function(idx, dir){
  const cards = window._adminAboutCards;
  const target = idx + dir;
  if(target < 0 || target >= cards.length) return;
  const temp = cards[idx];
  cards[idx] = cards[target];
  cards[target] = temp;
  renderAdminAboutCardsList();
};

window.adminUploadCardImage = function(idx, input){
  const file = input.files?.[0];
  if(!file) return;
  if(file.size > 8*1024*1024) return alert('A imagem excede 8 MB');
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      toast('Fazendo upload da imagem do card...');
      const res = await api('/api/store-image', {
        method: 'POST',
        body: JSON.stringify({ data_url: reader.result })
      });
      window._adminAboutCards[idx].image = res.url;
      renderAdminAboutCardsList();
      toast('✓ Foto do card atualizada!');
    } catch(err) {
      alert(err.message);
    }
  };
  reader.readAsDataURL(file);
};

window.adminResetAboutCards = function(){
  if(!confirm('Restaurar os 3 cards padrão oficiais (Horários, Fachada/Localização e Rotas de Entrega)?')) return;
  window._adminAboutCards = JSON.parse(JSON.stringify(defaultInstitutionalCards));
  renderAdminAboutCardsList();
  toast('Cards restaurados para o padrão.');
};

window.adminSaveAboutCards = async function(){
  try {
    toast('Salvando cards institucionais...');
    const cards = window._adminAboutCards || [];
    await api('/api/settings', {
      method: 'POST',
      body: JSON.stringify({
        chave: 'store.about_cards',
        valor: JSON.stringify(cards)
      })
    });
    toast('✓ Cards do "Sobre Nós" salvos e publicados na Loja Online!');
  } catch(err) {
    toast(err.message, true);
  }
};

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
      <div class="card" style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:16px;margin-bottom:14px;box-shadow:0 4px 14px rgba(59,130,246,0.08)">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap">
          <div>
            <div style="font-size:16px;font-weight:800;color:#1d4ed8;display:flex;align-items:center;gap:8px">
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
      <div class="card" style="background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;padding:16px;margin-bottom:14px;box-shadow:0 4px 14px rgba(253,94,2,0.08)">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap">
          <div>
            <div style="font-size:16px;font-weight:800;color:#c2410c;display:flex;align-items:center;gap:8px">
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
      <div class="card" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:16px;margin-bottom:14px;box-shadow:0 4px 14px rgba(34,197,94,0.08)">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:12px">
          <div>
            <div style="font-size:16px;font-weight:800;color:#15803d;display:flex;align-items:center;gap:8px">
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
                      <div style="font-weight:700;color:#000000">${esc(c.razao_social)}</div>
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
      <div class="card" style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:12px;padding:16px;margin-bottom:14px;box-shadow:0 4px 14px rgba(148,163,184,0.08)">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:12px">
          <div>
            <div style="font-size:16px;font-weight:800;color:#334155;display:flex;align-items:center;gap:8px">
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
                      <div style="font-weight:700;color:#000000">${esc(c.razao_social)}</div>
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
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px 18px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
      <div>
        <div style="font-size:18px;font-weight:800;color:#000;display:flex;align-items:center;gap:8px">
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
        <h2 style="margin:4px 0 2px;font-size:24px;color:#000">${data.kpis.totalClients}</h2>
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
        <h2 style="margin:4px 0 2px;font-size:24px;color:#000">${data.kpis.totalPedidos}</h2>
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
        <h3 style="margin:0;font-size:16px;color:#000">Lista Geral de Clientes da Tabela (<span id="ptdCount">${data.clients.length}</span>)</h3>
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
                <div style="font-weight:700;color:#000000">${esc(c.razao_social)}</div>
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
    window._currentSellerDashboardId=null;
    window._currentSellerDashboardNome=null;
    v.innerHTML=`<div class="panel"><div class="panel-title"><div><h3>Vendedores</h3><p class="muted">Desempenho e painel do mês de cada vendedor.</p></div><button class="btn primary" onclick="show('sellers')">↻ Atualizar</button></div></div><div class="grid" style="margin-top:14px">${vendedores.map(u=>`<div class="card" style="cursor:pointer" onclick="renderSellerDashboard('${u.id}','${esc(u.nome)}')"><h3 style="margin-top:0;display:flex;align-items:center;gap:8px"><span class="client-icon" style="width:30px;height:30px;font-size:14px">👤</span>${esc(u.nome)}</h3><p class="muted" style="margin:0">${esc(u.email)}</p></div>`).join('')||'<div class="empty-state">Nenhum vendedor ativo encontrado.</div>'}</div>`;
  };
  window.renderSellerDashboard=async function(id,nome){
    window._currentSellerDashboardId=id;
    window._currentSellerDashboardNome=nome;
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
  const [r,o,drivers,u,sett,ret]=await Promise.all([
    api('/api/logistics/routes'),
    api('/api/logistics/grouped-orders'),
    api('/api/users'),
    api('/api/logistics/route-config'),
    api('/api/settings'),
    api('/api/logistics/returned-orders').catch(()=>({items:[]}))
  ]);
  const sMap=Object.fromEntries((sett.items||[]).map(x=>[x.chave,x.valor]));
  const depotLat=sMap['deposito_latitude']||sMap['depot.latitude']||'';
  const depotLng=sMap['deposito_longitude']||sMap['depot.longitude']||'';
  const ds=drivers.items.filter(x=>x.role==='driver'),sellers=drivers.items.filter(x=>x.role==='seller');
  const groups=o.grupos||[];
  window._logisticsGroups=groups;
  window._logisticsSellers=sellers;
  const returnedOrders = ret?.items || [];
  window._returnedOrders = returnedOrders;

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
    let html=`<div class="panel-title"><div style="display:flex;align-items:center;gap:12px"><button class="btn" onclick="document.getElementById('logisticsModalityDashboard').style.display='none';const mw=document.getElementById('logisticsMainWrapper');if(mw)mw.style.display='block';if(document.getElementById('logisticsMain'))document.getElementById('logisticsMain').style.display='block';const t=document.getElementById('title');if(t)t.textContent='Logística';window.scrollTo({top:0,behavior:'smooth'})">← Voltar para separação</button><div><h3 style="margin:0">${esc(g.titulo)}</h3><p class="muted" style="margin-top:4px">${g.grupo==='BALCAO'?'Somente pedidos do balcão marcados para entrega.':'Pedidos subdivididos por bairro.'}</p></div></div></div>`;
    
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
      return `<div class="card logistics-neighborhood"><div class="panel-title"><strong style="color:#ef4444">${esc(sg.bairro)}</strong><span class="badge" style="margin-right:auto; margin-left:10px">${totalP} pedidos · ${brl(totalV)}</span><label style="cursor:pointer;font-size:12px;display:flex;align-items:center;gap:5px"><input type="checkbox" onchange="const cb=this.closest('.logistics-neighborhood').querySelectorAll('.routeOrder'); cb.forEach(c => c.checked = this.checked)"> Selecionar todos</label></div><div class="actions">${filteredPedidos.map(p=>`<label class="card logistics-order"><input type="checkbox" class="load-order routeOrder" value="${p.id}"> <span><strong>${esc(p.numero)}</strong> · ${esc(p.nome_fantasia||p.razao_social)}<br><strong style="color:#ef4444;font-size:12px">📍 ${esc(p.bairro||sg.bairro)}</strong> · <small class="muted">Operador: ${esc(p.operador_nome||'N/A')}${grupoKey==='TODOS'?` · Origem: ${esc(p.origem)}`:''}</small></span></label>`).join('')}</div></div>`;
    }).join('');
    
    if(!hasSubgrupos) sgHtml='<div class="empty-state">Nenhum pedido para este filtro.</div>';
    html+=sgHtml;
    return html;
  };

  window.renderModalityDashboard=function(grupoKey='TODOS', vendedorFiltro=''){
    openDeliveryRoutesDashboard('expedicao', grupoKey, vendedorFiltro);
  };

  window.openReturnedOrdersDashboard = function(){
    const mw = document.getElementById('logisticsMainWrapper');
    if(mw) mw.style.display = 'none';
    if(document.getElementById('logisticsMain')) document.getElementById('logisticsMain').style.display='none';
    if(document.getElementById('logisticsModalityDashboard')) document.getElementById('logisticsModalityDashboard').style.display='none';
    if(document.getElementById('logisticsDashboard')) document.getElementById('logisticsDashboard').style.display='none';
    if(document.getElementById('sellerRoutesDashboard')) document.getElementById('sellerRoutesDashboard').style.display='none';
    if(document.getElementById('deliveryRoutesDashboard')) document.getElementById('deliveryRoutesDashboard').style.display='none';
    const retDb = document.getElementById('returnedOrdersDashboard');
    if(retDb) {
      retDb.style.display='block';
      const t = document.getElementById('title');
      if(t) t.textContent = 'Logística · Pedidos Retornados';
      renderReturnedOrdersDashboardContent();
      window.scrollTo({top:0, behavior:'smooth'});
    }
  };

  window.closeReturnedOrdersDashboard = function(){
    const retDb = document.getElementById('returnedOrdersDashboard');
    if(retDb) retDb.style.display='none';
    const mw = document.getElementById('logisticsMainWrapper');
    if(mw) mw.style.display = 'block';
    if(document.getElementById('logisticsMain')) document.getElementById('logisticsMain').style.display='block';
    const t = document.getElementById('title');
    if(t) t.textContent = 'Logística';
    window.scrollTo({top:0, behavior:'smooth'});
  };

  window.refreshReturnedOrders = async function(){
    try{
      const data = await api('/api/logistics/returned-orders');
      window._returnedOrders = data.items || [];
      const badgeCount = document.getElementById('returnedOrdersCountBadge');
      if(badgeCount) {
        badgeCount.textContent = window._returnedOrders.length;
        badgeCount.style.background = window._returnedOrders.length ? '#ef4444' : 'var(--border)';
      }
      const gridBadge = document.getElementById('returnedOrdersGridBadge');
      if(gridBadge) {
        gridBadge.textContent = window._returnedOrders.length;
        gridBadge.style.background = window._returnedOrders.length ? '#ef4444' : '#64748b';
      }
      if(document.getElementById('returnedOrdersDashboard')?.style.display === 'block'){
        renderReturnedOrdersDashboardContent();
      }
    }catch(e){console.warn('Erro ao atualizar pedidos retornados:', e)}
  };

  window.renderReturnedOrdersDashboardContent = function(){
    const list = window._returnedOrders || [];
    const totalRet = list.length;
    const valTotal = list.reduce((acc, x) => acc + Number(x.total || x.pedido_total || 0), 0);
    const prontosNovaRota = list.filter(x => (x.status || x.pedido_status) === 'SEPARACAO').length;
    const motivoCounts = {};
    list.forEach(x => {
      if(x.motivo) motivoCounts[x.motivo] = (motivoCounts[x.motivo] || 0) + 1;
    });
    let principalMotivo = '-';
    let maxCount = 0;
    for(const [mot, count] of Object.entries(motivoCounts)){
      if(count > maxCount){
        maxCount = count;
        principalMotivo = mot;
      }
    }

    const container = document.getElementById('returnedOrdersDashboardContainer');
    if(!container) return;

    container.innerHTML = `
      <div class="panel-title" style="margin-bottom:18px">
        <div style="display:flex;align-items:center;gap:12px">
          <button class="btn" onclick="closeReturnedOrdersDashboard()">← Voltar para separação</button>
          <div>
            <h3 style="margin:0">↩ Painel de Pedidos que Retornaram</h3>
            <p class="muted" style="margin-top:4px">Ocorrências de entregas não concluídas, motivos de retorno e reincorporação automática à fila de separação.</p>
          </div>
        </div>
        <button class="btn primary" onclick="refreshReturnedOrders()">↻ Atualizar</button>
      </div>

      <div class="grid" style="margin-bottom:18px">
        <div class="card kpi" style="border-left:4px solid #ef4444">
          <small class="muted">Total de Retornos</small>
          <h2 style="color:#ef4444;margin:6px 0 0">${totalRet}</h2>
          <small class="muted">${totalRet === 1 ? '1 retorno registrado' : totalRet + ' retornos registrados'}</small>
        </div>
        <div class="card kpi" style="border-left:4px solid #f59e0b">
          <small class="muted">Valor dos Pedidos Retornados</small>
          <h2 class="orange" style="margin:6px 0 0">${brl(valTotal)}</h2>
          <small class="muted">Estoque e produtos preservados</small>
        </div>
        <div class="card kpi" style="border-left:4px solid #10b981">
          <small class="muted">Prontos p/ Nova Rota</small>
          <h2 style="color:#10b981;margin:6px 0 0">${prontosNovaRota}</h2>
          <small class="muted">Em fila de separação p/ novo carregamento</small>
        </div>
        <div class="card kpi" style="border-left:4px solid #6366f1">
          <small class="muted">Principal Motivo</small>
          <h3 style="margin:6px 0 0;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${esc(principalMotivo)}">${esc(principalMotivo)}</h3>
          <small class="muted">${maxCount > 0 ? `${maxCount} ocorrência(s)` : 'Sem ocorrências'}</small>
        </div>
      </div>

      <div class="panel" style="margin-bottom:14px;padding:14px">
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
          <input id="retFilterSearch" class="field-input search" style="flex:1;min-width:240px;margin:0" placeholder="🔍 Buscar por número, cliente, motorista ou motivo..." oninput="renderReturnedOrdersTable()">
          <select id="retFilterReason" class="field-input search" style="width:auto;min-width:220px;margin:0" onchange="renderReturnedOrdersTable()">
            <option value="">Todos os motivos</option>
            <option value="Cliente não se encontra no local">Cliente não se encontra no local</option>
            <option value="Cliente se recusou a receber o pedido">Cliente se recusou a receber o pedido</option>
            <option value="Pedido incorreto / Divergência de itens">Pedido incorreto / Divergência de itens</option>
            <option value="Problemas mecânicos com o veículo">Problemas mecânicos com o veículo</option>
            <option value="Imprevisto com a equipe de entrega">Imprevisto com a equipe de entrega</option>
            <option value="Outros motivos">Outros motivos</option>
          </select>
          <select id="retFilterStatus" class="field-input search" style="width:auto;min-width:180px;margin:0" onchange="renderReturnedOrdersTable()">
            <option value="">Todas as situações</option>
            <option value="SEPARACAO">Liberado p/ Nova Rota</option>
            <option value="ROTA">Em Nova Rota</option>
            <option value="CONCLUIDO">Concluído</option>
          </select>
        </div>
      </div>

      <div class="tablewrap">
        <table class="table">
          <thead>
            <tr>
              <th>Pedido</th>
              <th>Data / Horário</th>
              <th>Cliente</th>
              <th>Motorista</th>
              <th>Motivo do Retorno</th>
              <th>Observação do Motorista</th>
              <th>Total</th>
              <th>Situação / Destino</th>
            </tr>
          </thead>
          <tbody id="returnedOrdersTableBody"></tbody>
        </table>
      </div>
    `;

    renderReturnedOrdersTable();
  };

  window.renderReturnedOrdersTable = function(){
    const tbody = document.getElementById('returnedOrdersTableBody');
    if(!tbody) return;
    const q = (document.getElementById('retFilterSearch')?.value || '').trim().toLowerCase();
    const reasonFilter = document.getElementById('retFilterReason')?.value || '';
    const statusFilter = document.getElementById('retFilterStatus')?.value || '';

    const list = (window._returnedOrders || []).filter(item => {
      const st = item.status || item.pedido_status || '';
      if(statusFilter && st !== statusFilter) return false;
      if(reasonFilter && item.motivo !== reasonFilter) return false;
      if(q){
        const text = [
          item.pedido_numero,
          item.nome_fantasia,
          item.razao_social,
          item.cliente_fantasia,
          item.cliente_nome,
          item.motorista_nome,
          item.motivo,
          item.descricao,
          item.bairro,
          item.cliente_bairro
        ].filter(Boolean).join(' ').toLowerCase();
        if(!text.includes(q)) return false;
      }
      return true;
    });

    if(!list.length){
      tbody.innerHTML = `<tr><td colspan="8" class="empty-state" style="padding:32px;text-align:center"><div style="font-size:32px;margin-bottom:8px">🚚✨</div><strong>Nenhum pedido retornado encontrado</strong><p class="muted" style="margin-top:4px;font-size:13px">Nenhuma ocorrência encontrada para os filtros selecionados.</p></td></tr>`;
      return;
    }

    tbody.innerHTML = list.map(x => {
      const curStatus = x.status || x.pedido_status;
      const clientName = x.nome_fantasia || x.razao_social || x.cliente_fantasia || x.cliente_nome || 'Cliente não identificado';
      const bairro = x.bairro || x.cliente_bairro || '';
      const phone = x.telefone || x.cliente_telefone || '';
      const orderTotal = Number(x.total != null ? x.total : x.pedido_total || 0);
      const isLiberado = curStatus === 'SEPARACAO';
      const dateStr = x.created_at ? new Date(x.created_at).toLocaleString('pt-BR') : '-';

      return `<tr>
        <td>
          <strong>${esc(x.pedido_numero)}</strong>
          <br>
          ${isLiberado
            ? `<span class="badge" style="background:#10b98120;color:#10b981;border:1px solid #10b98150;font-size:10px;padding:2px 5px">✓ Em Separação</span>`
            : `<span class="badge" style="font-size:10px;padding:2px 5px">${esc(curStatus)}</span>`}
        </td>
        <td style="font-size:13px;white-space:nowrap">${dateStr}</td>
        <td>
          <strong>${esc(clientName)}</strong>
          ${bairro ? `<br><strong style="color:#ef4444;font-size:12px">📍 ${esc(bairro)}</strong>` : ''}
          ${phone ? `<br><small class="muted">📞 ${esc(phone)}</small>` : ''}
        </td>
        <td>
          <span>👤 ${esc(x.motorista_nome || 'Não informado')}</span>
          ${x.rota_data ? `<br><small class="muted">Rota: ${esc(x.rota_data)}</small>` : ''}
        </td>
        <td>
          <span style="display:inline-block;padding:3px 8px;border-radius:6px;background:#fef2f2;color:#b91c1c;border:1px solid #fecaca;font-weight:600;font-size:12px">
            ✕ ${esc(x.motivo || 'Motivo não informado')}
          </span>
        </td>
        <td style="max-width:240px">
          <div style="font-size:12px;color:var(--text);word-break:break-word">
            ${x.descricao ? esc(x.descricao) : '<span class="muted">Sem observação adicional</span>'}
          </div>
        </td>
        <td><strong>${brl(orderTotal)}</strong></td>
        <td>
          ${isLiberado
            ? `<span class="badge" style="background:#10b98120;color:#10b981;border:1px solid #10b98150;font-weight:600;font-size:11px">Liberado p/ Nova Rota</span><br><button class="btn" style="font-size:11px;padding:3px 7px;margin-top:4px" onclick="closeReturnedOrdersDashboard();renderModalityDashboard('TODOS')">Ver na Separação →</button>`
            : `<span class="badge">${esc(curStatus)}</span>`}
        </td>
      </tr>`;
    }).join('');
  };

  window._ordersInRoute = o.em_rota || [];

  window.openLogisticsInRoute = function(){
    const mw = document.getElementById('logisticsMainWrapper');
    if(mw) mw.style.display = 'none';
    if(document.getElementById('logisticsMain')) document.getElementById('logisticsMain').style.display = 'none';
    if(document.getElementById('logisticsModalityDashboard')) document.getElementById('logisticsModalityDashboard').style.display = 'none';
    if(document.getElementById('returnedOrdersDashboard')) document.getElementById('returnedOrdersDashboard').style.display = 'none';
    if(document.getElementById('sellerRoutesDashboard')) document.getElementById('sellerRoutesDashboard').style.display = 'none';
    if(document.getElementById('deliveryRoutesDashboard')) document.getElementById('deliveryRoutesDashboard').style.display = 'none';
    const db = document.getElementById('logisticsDashboard');
    if(db) {
      db.style.display = 'block';
      const t = document.getElementById('title');
      if(t) t.textContent = 'Logística · Pedidos em Rota';
      renderLogisticsInRouteContent();
      window.scrollTo({top:0, behavior:'smooth'});
    }
  };

  window.closeLogisticsInRoute = function(){
    const db = document.getElementById('logisticsDashboard');
    if(db) db.style.display = 'none';
    const mw = document.getElementById('logisticsMainWrapper');
    if(mw) mw.style.display = 'block';
    if(document.getElementById('logisticsMain')) document.getElementById('logisticsMain').style.display = 'block';
    const t = document.getElementById('title');
    if(t) t.textContent = 'Logística';
    window.scrollTo({top:0, behavior:'smooth'});
  };

  window.refreshLogisticsInRoute = async function(){
    try{
      const data = await api('/api/logistics/grouped-orders');
      window._ordersInRoute = data.em_rota || [];
      const inRouteBadge = document.getElementById('ordersInRouteCountBadge');
      if(inRouteBadge) {
        inRouteBadge.textContent = window._ordersInRoute.length;
        inRouteBadge.style.background = window._ordersInRoute.length ? '#3b82f6' : 'var(--border)';
      }
      const inRouteGridBadge = document.getElementById('ordersInRouteGridBadge');
      if(inRouteGridBadge) {
        inRouteGridBadge.textContent = window._ordersInRoute.length;
        inRouteGridBadge.style.background = window._ordersInRoute.length ? '#3b82f6' : '#64748b';
      }
      if(document.getElementById('logisticsDashboard')?.style.display === 'block'){
        renderLogisticsInRouteContent(true);
      }
    }catch(e){
      console.warn('Erro ao atualizar pedidos em rota:', e);
    }
  };

  window.renderLogisticsInRouteContent = function(preserveFilters = false){
    const list = window._ordersInRoute || [];
    const totalOrders = list.length;
    const totalValor = list.reduce((acc, x) => acc + Number(x.total || 0), 0);
    const bairrosList = [...new Set(list.map(x => x.bairro || 'Sem bairro'))].sort((a,b) => a.localeCompare(b));
    const sellersList = [...new Set(list.map(x => x.operador_nome).filter(Boolean))].sort((a,b) => a.localeCompare(b));
    const driversList = [...new Set(list.map(x => x.motorista_nome).filter(Boolean))].sort((a,b) => a.localeCompare(b));

    const prevSearch = preserveFilters ? (document.getElementById('routeFilterSearch')?.value || '') : '';
    const prevBairro = preserveFilters ? (document.getElementById('routeFilterBairro')?.value || '') : '';
    const prevSeller = preserveFilters ? (document.getElementById('routeFilterSeller')?.value || '') : '';
    const prevDriver = preserveFilters ? (document.getElementById('routeFilterDriver')?.value || '') : '';
    const prevOrigin = preserveFilters ? (document.getElementById('routeFilterOrigin')?.value || '') : '';

    const container = document.getElementById('logisticsDashboardContainer');
    if(!container) return;

    container.innerHTML = `
      <div class="panel" style="margin-bottom:18px;border-left:4px solid #3b82f6">
        <div class="panel-title" style="margin-bottom:0;flex-wrap:wrap;gap:14px">
          <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">
            <button class="btn" onclick="closeLogisticsInRoute()" style="display:inline-flex;align-items:center;gap:6px">
              ← Voltar para Separação
            </button>
            <div>
              <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
                <h2 style="margin:0;font-size:22px;letter-spacing:-0.5px">🚚 Dashboard: Pedidos em Rota</h2>
                <span class="badge" style="background:rgba(59,130,246,0.18);color:#3b82f6;border:1px solid rgba(59,130,246,0.4);font-size:12px;display:inline-flex;align-items:center;gap:6px">
                  <span style="width:7px;height:7px;border-radius:50%;background:#3b82f6;box-shadow:0 0 8px #3b82f6;display:inline-block"></span>
                  Tempo Real
                </span>
              </div>
              <p class="muted" style="margin-top:4px;font-size:13px">
                Painel de tela cheia para monitoramento de todas as entregas e pedidos atualmente em trânsito com os motoristas.
              </p>
            </div>
          </div>
          <div class="actions">
            <button class="btn primary" onclick="refreshLogisticsInRoute()" style="display:inline-flex;align-items:center;gap:6px">
              ↻ Atualizar Pedidos
            </button>
          </div>
        </div>
      </div>

      <div class="grid" style="margin-bottom:18px">
        <div class="card kpi" style="border-left:4px solid #3b82f6">
          <small class="muted">Pedidos em Rota</small>
          <h2 style="color:#3b82f6;margin:6px 0 0">${totalOrders}</h2>
          <small class="muted">${totalOrders === 1 ? '1 entrega em trânsito' : totalOrders + ' entregas em trânsito'}</small>
        </div>
        <div class="card kpi" style="border-left:4px solid #10b981">
          <small class="muted">Valor em Mercadoria</small>
          <h2 class="orange" style="margin:6px 0 0">${brl(totalValor)}</h2>
          <small class="muted">Carga total em entrega nas ruas</small>
        </div>
        <div class="card kpi" style="border-left:4px solid #ef4444">
          <small class="muted">Bairros Atendidos</small>
          <h2 style="color:#ef4444;margin:6px 0 0">${bairrosList.length}</h2>
          <small class="muted">Destinos e regiões de rota</small>
        </div>
        <div class="card kpi" style="border-left:4px solid #8b5cf6">
          <small class="muted">Motoristas Ativos</small>
          <h2 style="color:#8b5cf6;margin:6px 0 0">${driversList.length}</h2>
          <small class="muted">Entregadores em campo</small>
        </div>
      </div>

      <div class="panel" style="margin-bottom:16px;padding:16px">
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
          <input id="routeFilterSearch" class="field-input search" style="flex:2;min-width:240px;margin:0" placeholder="🔍 Buscar por pedido, cliente, endereço, motorista..." oninput="filterLogisticsInRouteTable()" value="${esc(prevSearch)}">
          <select id="routeFilterBairro" class="field-input search" style="flex:1;min-width:180px;margin:0" onchange="filterLogisticsInRouteTable()">
            <option value="">Todos os bairros</option>
            ${bairrosList.map(b => `<option value="${esc(b)}" ${prevBairro === b ? 'selected' : ''}>${esc(b)}</option>`).join('')}
          </select>
          <select id="routeFilterSeller" class="field-input search" style="flex:1;min-width:170px;margin:0" onchange="filterLogisticsInRouteTable()">
            <option value="">Todos os vendedores</option>
            ${sellersList.map(s => `<option value="${esc(s)}" ${prevSeller === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}
          </select>
          <select id="routeFilterDriver" class="field-input search" style="flex:1;min-width:170px;margin:0" onchange="filterLogisticsInRouteTable()">
            <option value="">Todos os motoristas</option>
            ${driversList.map(d => `<option value="${esc(d)}" ${prevDriver === d ? 'selected' : ''}>${esc(d)}</option>`).join('')}
          </select>
          <select id="routeFilterOrigin" class="field-input search" style="flex:1;min-width:150px;margin:0" onchange="filterLogisticsInRouteTable()">
            <option value="">Todas as origens</option>
            <option value="VENDEDOR" ${prevOrigin === 'VENDEDOR' ? 'selected' : ''}>Vendedor Externo</option>
            <option value="BALCAO" ${prevOrigin === 'BALCAO' ? 'selected' : ''}>Balcão (Entrega)</option>
            <option value="WEB" ${prevOrigin === 'WEB' ? 'selected' : ''}>Loja Online</option>
          </select>
          <button class="btn" onclick="clearLogisticsInRouteFilters()">Limpar filtros</button>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;padding-top:10px;border-top:1px solid #1e2c40">
          <small class="muted" id="routeFilterCountBadge"></small>
          <small class="muted" id="routeFilterTotalValueBadge"></small>
        </div>
      </div>

      <div class="tablewrap">
        <table class="table">
          <thead>
            <tr>
              <th>Pedido</th>
              <th>Cliente</th>
              <th>Endereço de Entrega</th>
              <th>Bairro</th>
              <th>Vendedor / Emissor</th>
              <th>Motorista</th>
              <th>Total</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody id="logisticsInRouteTableBody"></tbody>
        </table>
      </div>
    `;

    filterLogisticsInRouteTable();
  };

  window.clearLogisticsInRouteFilters = function(){
    const s = document.getElementById('routeFilterSearch'); if(s) s.value = '';
    const b = document.getElementById('routeFilterBairro'); if(b) b.value = '';
    const sel = document.getElementById('routeFilterSeller'); if(sel) sel.value = '';
    const d = document.getElementById('routeFilterDriver'); if(d) d.value = '';
    const o = document.getElementById('routeFilterOrigin'); if(o) o.value = '';
    filterLogisticsInRouteTable();
  };

  window.filterLogisticsInRouteTable = function(){
    const tbody = document.getElementById('logisticsInRouteTableBody');
    if(!tbody) return;
    const q = (document.getElementById('routeFilterSearch')?.value || '').trim().toLowerCase();
    const bairroFilter = document.getElementById('routeFilterBairro')?.value || '';
    const sellerFilter = document.getElementById('routeFilterSeller')?.value || '';
    const driverFilter = document.getElementById('routeFilterDriver')?.value || '';
    const originFilter = document.getElementById('routeFilterOrigin')?.value || '';

    const allOrders = window._ordersInRoute || [];
    const filtered = allOrders.filter(x => {
      if(bairroFilter && (x.bairro || 'Sem bairro') !== bairroFilter) return false;
      if(sellerFilter && (x.operador_nome || '') !== sellerFilter) return false;
      if(driverFilter && (x.motorista_nome || '') !== driverFilter) return false;
      if(originFilter && (x.origem || '') !== originFilter) return false;
      if(q){
        const text = [
          x.numero,
          x.nome_fantasia,
          x.razao_social,
          x.endereco,
          x.bairro,
          x.operador_nome,
          x.motorista_nome,
          x.origem,
          x.telefone
        ].filter(Boolean).join(' ').toLowerCase();
        if(!text.includes(q)) return false;
      }
      return true;
    });

    const badge = document.getElementById('routeFilterCountBadge');
    if(badge) {
      badge.textContent = `Exibindo ${filtered.length} de ${allOrders.length} pedido(s) em rota`;
    }
    const valBadge = document.getElementById('routeFilterTotalValueBadge');
    if(valBadge) {
      const sum = filtered.reduce((acc, x) => acc + Number(x.total || 0), 0);
      valBadge.textContent = `Valor filtrado: ${brl(sum)}`;
    }

    if(!filtered.length){
      tbody.innerHTML = `<tr><td colspan="9" class="empty-state" style="padding:48px 20px;text-align:center"><div style="font-size:38px;margin-bottom:10px">🚚✨</div><strong style="font-size:16px">${allOrders.length===0 ? 'Nenhum pedido em rota no momento' : 'Nenhum pedido encontrado para os filtros selecionados'}</strong><p class="muted" style="margin-top:6px;font-size:13px">${allOrders.length===0 ? 'Todos os pedidos estão em separação ou já foram entregues.' : 'Tente alterar ou limpar os filtros de busca acima.'}</p>${allOrders.length>0 ? '<button class="btn" style="margin-top:12px" onclick="clearLogisticsInRouteFilters()">Limpar Filtros</button>' : '<button class="btn" style="margin-top:12px" onclick="closeLogisticsInRoute()">Ir para Separação de Pedidos</button>'}</td></tr>`;
      return;
    }

    const originBadges = {
      VENDEDOR: '<span class="badge" style="background:rgba(253,94,2,0.15);color:#fd5e02;font-size:10px">Vendedor</span>',
      BALCAO: '<span class="badge" style="background:rgba(59,130,246,0.15);color:#3b82f6;font-size:10px">Balcão</span>',
      WEB: '<span class="badge" style="background:rgba(34,197,94,0.15);color:#22c55e;font-size:10px">Loja Web</span>'
    };

    tbody.innerHTML = filtered.map(x => `
      <tr>
        <td>
          <strong style="font-size:14px">${esc(x.numero)}</strong>
          <br>${originBadges[x.origem] || `<span class="badge" style="font-size:10px">${esc(x.origem || '-')}</span>`}
        </td>
        <td>
          <strong>${esc(x.nome_fantasia || x.razao_social || 'Cliente')}</strong>
          ${x.telefone ? `<br><small class="muted">📞 ${esc(x.telefone)}</small>` : ''}
        </td>
        <td style="max-width:240px;word-break:break-word">${esc(x.endereco || '-')}</td>
        <td><strong style="color:#ef4444;font-size:13px">📍 ${esc(x.bairro || 'Sem bairro')}</strong></td>
        <td>${esc(x.operador_nome || '-')}</td>
        <td><span style="font-weight:700">👤 ${esc(x.motorista_nome || 'Não atribuído')}</span></td>
        <td><strong class="orange" style="font-size:14px">${brl(x.total)}</strong></td>
        <td><span class="badge" style="background:rgba(59,130,246,0.18);color:#3b82f6;border:1px solid rgba(59,130,246,0.4);font-weight:700">🚚 Em Rota</span></td>
        <td class="actions">
          <button class="btn" style="padding:5px 10px;font-size:12px" onclick="orderDetail('${x.id}')">Detalhes</button>
          <button class="btn" style="padding:5px 10px;font-size:12px" onclick="downloadAuthFile('/api/orders/${x.id}/pdf','pedido-${x.numero}.pdf')">PDF</button>
        </td>
      </tr>
    `).join('');
  };

  v.innerHTML=`
  <div id="logisticsMainWrapper">
    <div class="panel" id="logisticsMain" style="margin-bottom:14px">
      <div class="panel-title" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px">
        <div>
          <h3 style="margin:0">Separação e Roteirização</h3>
          <p class="muted" style="margin:4px 0 0">Criação de rotas de entrega, expedição e cronograma semanal de motoristas.</p>
        </div>
        <div style="display:flex; gap:8px; flex-wrap:wrap">
          <button class="btn" style="background:linear-gradient(135deg,#021d60,#082b78); border:1px solid #1e3a8a; color:#fff; font-weight:700" onclick="openDeliveryRoutesDashboard('cronograma')">
            📅 Ver / Configurar Cronograma Semanal
          </button>
          <button class="btn" onclick="show('logistics')">↻ Atualizar</button>
        </div>
      </div>
      <div class="grid">
        <div class="card" style="cursor:pointer;border-top:4px solid #1e3a8a" onclick="openDeliveryRoutesDashboard('expedicao', 'TODOS')"><h3 style="margin:0">Todos os pedidos</h3><p class="muted" style="margin-top:6px">Todos os pedidos agrupados por bairro para expedição.</p></div>
        <div class="card" style="cursor:pointer;border-top:4px solid #f59e0b" onclick="openDeliveryRoutesDashboard('expedicao', 'VENDEDOR')"><h3 style="margin:0">Pedidos de vendedores</h3><p class="muted" style="margin-top:6px">Pedidos externos subdivididos por bairro.</p></div>
        <div class="card" style="cursor:pointer;border-top:4px solid #3b82f6" onclick="openDeliveryRoutesDashboard('expedicao', 'WEB')"><h3 style="margin:0">Pedidos web</h3><p class="muted" style="margin-top:6px">Pedidos da Loja Online subdivididos por bairro.</p></div>
        <div class="card" style="cursor:pointer;border-top:4px solid #8b5cf6" onclick="openDeliveryRoutesDashboard('expedicao', 'BALCAO')"><h3 style="margin:0">Pedidos balcão — entrega</h3><p class="muted" style="margin-top:6px">Pedidos locais marcados para entrega.</p></div>
        <div class="card" style="cursor:pointer;border-top:4px solid #3b82f6;position:relative" onclick="openLogisticsInRoute()">
          <div style="display:flex;align-items:center;justify-content:space-between">
            <h3 style="margin:0">🚚 Pedidos em rota</h3>
            <span id="ordersInRouteGridBadge" class="badge" style="background:${(o.em_rota||[]).length?'#3b82f6':'#64748b'};color:#fff;font-size:12px;padding:3px 8px">${(o.em_rota||[]).length}</span>
          </div>
          <p class="muted" style="margin-top:6px">Dashboard de monitoramento em tempo real dos pedidos na rua.</p>
        </div>
        <div class="card" style="cursor:pointer;border-top:4px solid #ef4444;position:relative" onclick="openReturnedOrdersDashboard()">
          <div style="display:flex;align-items:center;justify-content:space-between">
            <h3 style="margin:0">↩ Pedidos que retornaram</h3>
            <span id="returnedOrdersGridBadge" class="badge" style="background:${returnedOrders.length?'#ef4444':'#64748b'};color:#fff;font-size:12px;padding:3px 8px">${returnedOrders.length}</span>
          </div>
          <p class="muted" style="margin-top:6px">Histórico de paradas não concluídas e motivos de retorno.</p>
        </div>
      </div>
    </div>

    <div class="panel" style="margin-bottom:16px">
     <div class="panel-title">
       <div>
         <h3>📍 Ponto de Partida e Roteirização Inteligente (OpenStreetMap)</h3>
         <p class="muted">A fila de paradas das entregas é calculada automaticamente pela rota mais curta nas ruas reais via <strong>OpenStreetMap (OSRM)</strong>, 100% gratuito e sem necessidade de chave de API.</p>
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

    <div id="logisticsSellerRoutesInline" style="margin-top:20px"></div>

  </div>

  <div id="logisticsModalityDashboard" class="panel" style="display:none; padding-bottom:80px; position:relative; z-index:40;">
    <div id="logisticsModalityContent"></div>
    <div style="position:fixed; bottom:20px; left:50%; transform:translateX(-50%); background:var(--xv-panel,#101d2e); padding:10px 20px; border-radius:30px; box-shadow:0 10px 25px rgba(0,0,0,0.35); z-index:999; display:flex; flex-wrap:wrap; justify-content:center; gap:10px; width:max-content; max-width:90vw; border:1px solid var(--border)">
     <button class="btn" onclick="generateLoadingList()">📋 Gerar lista</button>
     <button class="btn good" style="background:#059669; border-color:#059669; font-weight:700" onclick="completeOrdersWithoutDriver()">✓ Concluir sem motorista</button>
     <button class="btn primary" onclick="makeRouteModal()">🚚 Gerar rota</button>
    </div>
  </div>

  <div id="sellerRoutesDashboard" style="display:none; width:100%;">
    <div id="sellerRoutesDashboardContainer"></div>
  </div>

  <div id="deliveryRoutesDashboard" style="display:none; width:100%;">
    <div id="deliveryRoutesDashboardContainer"></div>
  </div>

  <div id="logisticsDashboard" style="display:none; width:100%;">
    <div id="logisticsDashboardContainer"></div>
  </div>

  <div id="returnedOrdersDashboard" style="display:none; width:100%;">
    <div id="returnedOrdersDashboardContainer"></div>
  </div>`;
  renderSellerRoutesDashboardContent();
}
function newRouteConfig(){routeConfigModal()}

function editRouteConfig(x){routeConfigModal(x)}

window.openSellerRoutesDashboard = async function(){
  const mw = document.getElementById('logisticsMainWrapper');
  if(mw) mw.style.display = 'none';
  if(document.getElementById('logisticsMain')) document.getElementById('logisticsMain').style.display = 'none';
  if(document.getElementById('logisticsModalityDashboard')) document.getElementById('logisticsModalityDashboard').style.display = 'none';
  if(document.getElementById('returnedOrdersDashboard')) document.getElementById('returnedOrdersDashboard').style.display = 'none';
  if(document.getElementById('logisticsDashboard')) document.getElementById('logisticsDashboard').style.display = 'none';
  if(document.getElementById('deliveryRoutesDashboard')) document.getElementById('deliveryRoutesDashboard').style.display = 'none';
  const sDb = document.getElementById('sellerRoutesDashboard');
  if(sDb) {
    sDb.style.display = 'block';
    const t = document.getElementById('title');
    if(t) t.textContent = 'Logística · Rotas de Vendedor';
    window.scrollTo({top:0, behavior:'smooth'});
    await renderSellerRoutesDashboardContent();
  }
};

window.closeSellerRoutesDashboard = function(){
  const sDb = document.getElementById('sellerRoutesDashboard');
  if(sDb) sDb.style.display = 'none';
  const mw = document.getElementById('logisticsMainWrapper');
  if(mw) mw.style.display = 'block';
  if(document.getElementById('logisticsMain')) document.getElementById('logisticsMain').style.display = 'block';
  const t = document.getElementById('title');
  if(t) t.textContent = 'Logística';
  window.scrollTo({top:0, behavior:'smooth'});
};

window.renderSellerRoutesDashboardContent = async function(){
  const fullDb = document.getElementById('sellerRoutesDashboard');
  const isInline = !(fullDb && fullDb.style.display === 'block');
  const container = isInline ? document.getElementById('logisticsSellerRoutesInline') : document.getElementById('sellerRoutesDashboardContainer');
  if(!container) return;
  container.innerHTML = '<div class="panel">Carregando rotas de vendedores...</div>';
  try {
    const [u, usersReq] = await Promise.all([
      api('/api/logistics/route-config'),
      api('/api/users')
    ]);
    const sellers = usersReq.items.filter(x => x.role === 'seller' && x.ativo === 1);
    const routes = u.routes || [];
    const assignments = u.assignments || [];
    const diasSemana = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

    container.innerHTML = `
      <div class="panel" style="margin-bottom:18px;border-left:4px solid #fd5e02">
        <div class="panel-title" style="margin-bottom:0;flex-wrap:wrap;gap:14px">
          <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">
            <button class="btn" onclick="closeSellerRoutesDashboard()" style="display:${isInline?'none':'inline-flex'};align-items:center;gap:6px">
              ← Voltar para Logística
            </button>
            <div>
              <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
                <h2 style="margin:0;font-size:22px;letter-spacing:-0.5px">👔 Modalidade 1: Rotas de Vendedor</h2>
                <span class="badge" style="background:rgba(253,94,2,0.15);color:#fd5e02;border:1px solid rgba(253,94,2,0.3);font-size:12px;font-weight:700">
                  Carteira Comercial
                </span>
              </div>
              <p class="muted" style="margin-top:4px;font-size:13px">
                ℹ️ <strong>Finalidade desta modalidade:</strong> Serve <strong>apenas para designar vendedores</strong> para aquela rota / carteira de atendimento. <span style="color:#fd5e02;font-weight:600">Não causa nenhuma mudança na parte de entregas ou logística física.</span>
              </p>
            </div>
          </div>
          <div class="actions">
            <button class="btn primary" onclick="newRouteConfig()" style="background:#fd5e02;border-color:#fd5e02">+ Criar Nova Rota</button>
          </div>
        </div>
      </div>

      <div class="grid" style="margin-bottom:18px">
        <div class="card" style="border-top:3px solid #fd5e02">
          <small class="muted">Vendedores Ativos</small>
          <h2 style="color:#fd5e02;margin:4px 0">${sellers.length}</h2>
          <small class="muted">Equipe externa disponível</small>
        </div>
        <div class="card" style="border-top:3px solid #3b82f6">
          <small class="muted">Rotas de Visitas Cadastradas</small>
          <h2 style="color:#3b82f6;margin:4px 0">${routes.length}</h2>
          <small class="muted">Regiões e agrupamentos</small>
        </div>
        <div class="card" style="border-top:3px solid #10b981">
          <small class="muted">Designações Ativas</small>
          <h2 style="color:#10b981;margin:4px 0">${assignments.length}</h2>
          <small class="muted">Vendedor ➔ Rota ➔ Dia</small>
        </div>
      </div>

      <div class="panel" style="margin-bottom:18px">
        <div class="panel-title">
          <div>
            <h3>➕ Designar Vendedor para Rota</h3>
            <p class="muted">Defina em qual dia da semana o vendedor visita e atende os clientes desta rota comercial.</p>
          </div>
        </div>
        <div class="form">
          <div class="field">
            <label>Vendedor</label>
            <select id="dashAssignSeller">
              ${sellers.map(s => `<option value="${s.id}">${esc(s.nome)} (${esc(s.email)})</option>`).join('') || '<option value="">Nenhum vendedor cadastrado</option>'}
            </select>
          </div>
          <div class="field">
            <label>Dia da Semana de Atendimento</label>
            <select id="dashAssignDay">
              ${diasSemana.map((x, i) => `<option value="${i+1}">${x}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label>Rota / Região</label>
            <select id="dashAssignRoute">
              ${routes.map(r => `<option value="${r.id}">${esc(r.nome)} (${r.bairros.length} bairros)</option>`).join('') || '<option value="">Nenhuma rota cadastrada</option>'}
            </select>
          </div>
          <div class="actions">
            <button class="btn primary" style="background:#fd5e02;border-color:#fd5e02" onclick="assignSellerRouteFromDash()">Designar Rota ao Vendedor</button>
          </div>
        </div>
      </div>

      <div class="panel" style="margin-bottom:18px">
        <div class="panel-title">
          <div>
            <h3>📋 Designações de Vendedores Ativas</h3>
            <p class="muted">Vendedores associados aos dias da semana para atendimento aos clientes das rotas.</p>
          </div>
        </div>
        <div class="tablewrap">
          <table class="table" style="width:100%;table-layout:fixed;min-width:760px">
            <colgroup>
              <col style="width:20%">
              <col style="width:16%">
              <col style="width:22%">
              <col style="width:30%">
              <col style="width:12%">
            </colgroup>
            <thead>
              <tr>
                <th style="white-space:nowrap">Vendedor</th>
                <th style="white-space:nowrap">Dia da Semana</th>
                <th style="white-space:nowrap">Rota Comercial</th>
                <th style="white-space:normal">Bairros Abrangidos</th>
                <th style="text-align:right;width:110px">Ações</th>
              </tr>
            </thead>
            <tbody>
              ${assignments.map(a => {
                const rt = routes.find(r => r.id === a.rota_config_id);
                const bList = rt ? rt.bairros.map(b => b.bairro).join(', ') : '-';
                return `<tr>
                  <td><strong>👤 ${esc(a.vendedor_nome)}</strong></td>
                  <td><span class="badge" style="background:rgba(253,94,2,0.15);color:#fd5e02;font-weight:700">📅 ${diasSemana[a.dia_semana-1]}</span></td>
                  <td style="white-space:nowrap;vertical-align:middle;overflow:hidden;text-overflow:ellipsis;padding:12px"><strong>${esc(a.rota_nome)}</strong></td>
                  <td style="white-space:normal!important;vertical-align:middle;line-height:1.4;padding:12px"><small class="muted" style="line-height:1.4;display:block;word-break:break-word">${esc(bList)}</small></td>
                  <td style="text-align:right;white-space:nowrap;vertical-align:middle;padding:12px">
                    <button class="btn danger" style="padding:6px 14px;font-size:12px;font-weight:700;margin:0;display:inline-block;white-space:nowrap" onclick="removeRouteAssignmentFromDash('${a.vendedor_id}',${a.dia_semana})">Remover</button>
                  </td>
                </tr>`;
              }).join('') || '<tr><td colspan="5" class="empty-state">Nenhuma designação de rota configurada para vendedores.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>

      <div class="panel">
        <div class="panel-title">
          <div>
            <h3>🗺️ Rotas e Bairros Comerciais</h3>
            <p class="muted">Cadastros de rotas e suas listas de bairros.</p>
          </div>
          <button class="btn primary" onclick="newRouteConfig()">+ Nova Rota</button>
        </div>
        <div class="tablewrap">
          <table class="table" style="width:100%;table-layout:fixed;min-width:760px">
            <colgroup>
              <col style="width:25%">
              <col style="width:15%">
              <col style="width:48%">
              <col style="width:12%">
            </colgroup>
            <thead>
              <tr>
                <th>Nome da Rota</th>
                <th>Qtd. Bairros</th>
                <th>Bairros Cadastrados</th>
                <th style="text-align:right;width:110px">Ações</th>
              </tr>
            </thead>
            <tbody>
              ${routes.map(x => `
                <tr>
                  <td><strong>${esc(x.nome)}</strong></td>
                  <td><span class="badge">${(x.bairros||[]).length}</span></td>
                  <td style="white-space:normal!important;vertical-align:middle;line-height:1.4;padding:12px">${(x.bairros||[]).map(b => esc(b.bairro)).join(' · ') || '<span class="muted">Sem bairros</span>'}</td>
                  <td style="text-align:right;white-space:nowrap;vertical-align:middle;padding:12px">
                    <button class="btn" style="padding:6px 14px;font-size:12px;font-weight:700;margin:0;display:inline-block;white-space:nowrap" onclick="editRouteConfig(parseJsonArg('${jsonArg(x)}'))">Editar</button>
                  </td>
                </tr>
              `).join('') || '<tr><td colspan="4" class="empty-state">Nenhuma rota cadastrada.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } catch(e) {
    container.innerHTML = `<div class="panel"><p class="muted">Erro ao carregar dados: ${esc(e.message)}</p></div>`;
  }
};

window.assignSellerRouteFromDash = async function(){
  const s = document.getElementById('dashAssignSeller')?.value;
  const d = Number(document.getElementById('dashAssignDay')?.value);
  const r = document.getElementById('dashAssignRoute')?.value;
  if(!s || !d || !r) return toast('Preencha todos os campos.');
  try {
    await api('/api/logistics/route-assignments', {
      method: 'POST',
      body: JSON.stringify({ vendedor_id: s, dia_semana: d, rota_config_id: r })
    });
    toast('Rota designada ao vendedor com sucesso!');
    await renderSellerRoutesDashboardContent();
  } catch(e) {
    toast(e.message, true);
  }
};

window.removeRouteAssignmentFromDash = async function(vid, dia){
  if(!confirm('Remover designação de rota deste vendedor neste dia?')) return;
  try {
    await api('/api/logistics/route-assignments/' + vid + '/' + dia, { method: 'DELETE' });
    toast('Designação removida com sucesso!');
    await renderSellerRoutesDashboardContent();
  } catch(e) {
    toast(e.message, true);
  }
};

window.openDeliveryRoutesDashboard = async function(tab = 'expedicao', grupoKey = 'TODOS', vendedorFiltro = ''){
  window._deliveryActiveTab = tab || 'expedicao';
  if(grupoKey) window._currentLogisticsGrupoKey = grupoKey;
  if(vendedorFiltro !== undefined) window._currentLogisticsSellerFilter = vendedorFiltro;

  const mw = document.getElementById('logisticsMainWrapper');
  if(mw) mw.style.display = 'none';
  if(document.getElementById('logisticsMain')) document.getElementById('logisticsMain').style.display = 'none';
  if(document.getElementById('logisticsModalityDashboard')) document.getElementById('logisticsModalityDashboard').style.display = 'none';
  if(document.getElementById('returnedOrdersDashboard')) document.getElementById('returnedOrdersDashboard').style.display = 'none';
  if(document.getElementById('logisticsDashboard')) document.getElementById('logisticsDashboard').style.display = 'none';
  if(document.getElementById('sellerRoutesDashboard')) document.getElementById('sellerRoutesDashboard').style.display = 'none';
  const dDb = document.getElementById('deliveryRoutesDashboard');
  if(dDb) {
    dDb.style.display = 'block';
    const t = document.getElementById('title');
    if(t) t.textContent = 'Logística · Rotas de Entrega (Tela Cheia)';
    window.scrollTo({top:0, behavior:'smooth'});
    await renderDeliveryRoutesDashboardContent();
  }
};

window.closeDeliveryRoutesDashboard = function(){
  const dDb = document.getElementById('deliveryRoutesDashboard');
  if(dDb) dDb.style.display = 'none';
  const mw = document.getElementById('logisticsMainWrapper');
  if(mw) mw.style.display = 'block';
  if(document.getElementById('logisticsMain')) document.getElementById('logisticsMain').style.display = 'block';
  const t = document.getElementById('title');
  if(t) t.textContent = 'Logística';
  window.scrollTo({top:0, behavior:'smooth'});
};

window.switchDeliveryTab = function(tab){
  window._deliveryActiveTab = tab;
  renderDeliveryRoutesDashboardContent();
};

window.switchDeliveryGrupo = function(grupoKey, vendedorFiltro=''){
  window._currentLogisticsGrupoKey = grupoKey;
  window._currentLogisticsSellerFilter = vendedorFiltro;
  renderDeliveryRoutesDashboardContent();
};

window.updateDelivSelectionCounter = function(){
  const checked = [...document.querySelectorAll('.routeOrder:checked')];
  const countSpan = document.getElementById('delivSelectedCount');
  const btnRoute = document.getElementById('btnDelivMakeRoute');
  const btnList = document.getElementById('btnDelivMakeList');
  let sum = 0;
  checked.forEach(cb => {
    sum += Number(cb.getAttribute('data-total') || 0);
  });
  if(countSpan){
    countSpan.innerHTML = '<strong>' + checked.length + '</strong> pedido(s) selecionado(s) · <span class="orange" style="font-weight:700">' + brl(sum) + '</span>';
  }
  if(btnRoute) btnRoute.disabled = checked.length === 0;
  if(btnList) btnList.disabled = checked.length === 0;
  const btnComplete = document.getElementById('btnDelivCompleteDirect');
  if(btnComplete) btnComplete.disabled = checked.length === 0;
};

window.filterDelivOrdersTable = function(){
  const q = (document.getElementById('delivQuickSearch')?.value || '').trim().toLowerCase();
  const neighborhoodCards = document.querySelectorAll('#delivNeighborhoodsList .logistics-neighborhood');
  neighborhoodCards.forEach(card => {
    const orders = card.querySelectorAll('.logistics-order');
    let visibleCount = 0;
    orders.forEach(order => {
      const text = order.textContent.toLowerCase();
      const match = !q || text.includes(q);
      order.style.display = match ? 'flex' : 'none';
      if(match) visibleCount++;
    });
    card.style.display = (visibleCount > 0 || !q) ? 'block' : 'none';
  });
};

window.downloadDeliveryOrdersPdf = function(){
  const ids = [...document.querySelectorAll('.routeOrder:checked')].map(x => x.value);
  if(!ids.length) return toast('Selecione os pedidos para imprimir em PDF.');
  downloadAuthPost('/api/logistics/loading-list/orders-pdf', { pedido_ids: ids }, 'Pedidos_Carregamento.pdf');
};

window.refreshDeliveryRoutesSilently = async function(){
  const checked = document.querySelectorAll('.routeOrder:checked');
  if(checked.length > 0 && window._deliveryActiveTab === 'expedicao') return;
  if(typeof window.renderDeliveryRoutesDashboardContent === 'function'){
    await window.renderDeliveryRoutesDashboardContent();
  }
};

window.renderDeliveryRoutesDashboardContent = async function(){
  const container = document.getElementById('deliveryRoutesDashboardContainer');
  if(!container) return;

  const activeTab = window._deliveryActiveTab || 'expedicao';
  const activeGrupo = window._currentLogisticsGrupoKey || 'TODOS';
  const sellerFilter = window._currentLogisticsSellerFilter || '';

  if(!container.innerHTML || container.innerHTML.includes('Carregando')) {
    container.innerHTML = '<div class="panel">Carregando Central de Rotas de Entrega...</div>';
  }

  try {
    const [delivRes, usersReq, groupedReq, routesReq, sett] = await Promise.all([
      api('/api/logistics/delivery-routes-config').catch(() => ({ schedule: [] })),
      api('/api/users').catch(() => ({ items: [] })),
      api('/api/logistics/grouped-orders').catch(() => ({ grupos: [], em_rota: [] })),
      api('/api/logistics/routes').catch(() => ({ items: [] })),
      api('/api/settings').catch(() => ({ items: [] }))
    ]);

    const dbSchedule = delivRes.items || delivRes.schedule || [];
    if (!window._currentDeliverySchedule || (!window._currentDeliverySchedule.length && dbSchedule.length)) {
      window._currentDeliverySchedule = JSON.parse(JSON.stringify(dbSchedule));
    }
    const schedule = window._currentDeliverySchedule || [];
    const allUsers = usersReq.items || [];
    const drivers = allUsers.filter(x => x.role === 'driver' && x.ativo === 1);
    window._currentDeliveryDrivers = drivers;
    const routesList = routesReq.items || [];
    window._deliveryRoutesList = routesList;
    const busyDriverIds = routesList.filter(r => r.status !== 'CONCLUIDA').map(r => r.motorista_id);
    const availableDrivers = drivers.filter(d => !busyDriverIds.includes(d.id));

    const sMap = Object.fromEntries((sett.items || []).map(x => [x.chave, x.valor]));
    const depotLat = sMap['deposito_latitude'] || sMap['depot.latitude'] || '';
    const depotLng = sMap['deposito_longitude'] || sMap['depot.longitude'] || '';

    const groups = groupedReq.grupos || [];
    window._logisticsGroups = groups;

    // Build unified subgroups for TODOS
    const subgruposMap = new Map();
    let totalSeparacao = 0;
    let totalValorSeparacao = 0;
    for(const grp of groups) {
      for(const sg of grp.subgrupos) {
        totalSeparacao += sg.pedidos.length;
        totalValorSeparacao += sg.pedidos.reduce((acc, p) => acc + Number(p.total || 0), 0);
        if(!subgruposMap.has(sg.bairro)) {
          subgruposMap.set(sg.bairro, { bairro: sg.bairro, pedidos: [] });
        }
        subgruposMap.get(sg.bairro).pedidos.push(...sg.pedidos);
      }
    }
    const todosGrupo = {
      grupo: 'TODOS',
      titulo: 'Todos os pedidos',
      subgrupos: Array.from(subgruposMap.values()).sort((a, b) => a.bairro.localeCompare(b.bairro))
    };

    const countByGroup = {
      TODOS: totalSeparacao,
      VENDEDOR: (groups.find(x => x.grupo === 'VENDEDOR')?.subgrupos || []).reduce((acc, s) => acc + s.pedidos.length, 0),
      WEB: (groups.find(x => x.grupo === 'WEB')?.subgrupos || []).reduce((acc, s) => acc + s.pedidos.length, 0),
      BALCAO: (groups.find(x => x.grupo === 'BALCAO')?.subgrupos || []).reduce((acc, s) => acc + s.pedidos.length, 0)
    };

    const totalBairrosCronograma = schedule.reduce((acc, s) => acc + (s.bairros || []).length, 0);
    const allKnownBairros = [...new Set(groups.flatMap(g => (g.subgrupos || []).map(sg => sg.bairro)).filter(Boolean))].sort((a,b)=>a.localeCompare(b));

    // Current displayed group
    let currentGroupObj = activeGrupo === 'TODOS' ? todosGrupo : groups.find(x => x.grupo === activeGrupo);
    if(!currentGroupObj) currentGroupObj = todosGrupo;

    // Operators list for filter dropdown if VENDEDOR or BALCAO
    const operatorsSet = new Set();
    for(const sg of currentGroupObj.subgrupos || []) {
      for(const p of sg.pedidos || []) {
        if(p.operador_nome) operatorsSet.add(p.operador_nome);
      }
    }
    const operatorsArr = Array.from(operatorsSet).sort();

    container.innerHTML = `
      <!-- Top Banner -->
      <div class="panel" style="margin-bottom:18px;border-left:4px solid #1e3a8a">
        <div class="panel-title" style="margin-bottom:0;flex-wrap:wrap;gap:14px">
          <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">
            <button class="btn" onclick="closeDeliveryRoutesDashboard()" style="display:inline-flex;align-items:center;gap:6px">
              ← Voltar para Logística
            </button>
            <div>
              <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
                <h2 style="margin:0;font-size:22px;letter-spacing:-0.5px">🚚 Central Única de Rotas de Entrega & Expedição</h2>
                
              </div>
              <p class="muted" style="margin-top:4px;font-size:13px">
                Ambiente exclusivo para criação de viagens de entrega, roteirização automática mais curta (OSRM/Google Maps), lista de carregamento, alocação de motoristas e cronograma semanal.
              </p>
            </div>
          </div>
          <div class="actions" style="display:flex;gap:8px">
            <button class="btn" onclick="window._currentDeliverySchedule = null; renderDeliveryRoutesDashboardContent()">↻ Atualizar Dados</button>
          </div>
        </div>
      </div>

      <!-- Navigation Tabs -->
      <div style="display:flex; gap:10px; margin-bottom:18px; flex-wrap:wrap; border-bottom:1px solid var(--border); padding-bottom:12px">
        <button class="btn ${activeTab === 'expedicao' ? 'primary' : ''}" style="font-size:13px; font-weight:700; ${activeTab === 'expedicao' ? 'background:#082b78;border-color:#1e3a8a;color:#fff' : ''}" onclick="switchDeliveryTab('expedicao')">
          📦 1. Criar Rota & Expedição (${totalSeparacao} pedidos)
        </button>
        <button class="btn ${activeTab === 'cronograma' ? 'primary' : ''}" style="font-size:13px; font-weight:700; ${activeTab === 'cronograma' ? 'background:#082b78;border-color:#1e3a8a;color:#fff' : ''}" onclick="switchDeliveryTab('cronograma')">
          📅 2. Cronograma Semanal & Motoristas (${schedule.length} dias)
        </button>
        <button class="btn ${activeTab === 'historico' ? 'primary' : ''}" style="font-size:13px; font-weight:700; ${activeTab === 'historico' ? 'background:#082b78;border-color:#1e3a8a;color:#fff' : ''}" onclick="switchDeliveryTab('historico')">
          📋 3. Histórico de Rotas (${routesList.length})
        </button>
      </div>

      ${activeTab === 'expedicao' ? `
        <!-- KPI Cards -->
        <div class="grid" style="margin-bottom:18px">
          <div class="card" style="border-top:3px solid #1e3a8a">
            <small class="muted">Pedidos em Separação</small>
            <h2 style="color:#60a5fa;margin:4px 0">${totalSeparacao}</h2>
            <small class="muted">${brl(totalValorSeparacao)} prontos para rota</small>
          </div>
          <div class="card" style="border-top:3px solid #3b82f6">
            <small class="muted">Bairros c/ Entregas</small>
            <h2 style="color:#3b82f6;margin:4px 0">${subgruposMap.size}</h2>
            <small class="muted">Regiões com pedidos</small>
          </div>
          <div class="card" style="border-top:3px solid #8b5cf6">
            <small class="muted">Motoristas Disponíveis</small>
            <h2 style="color:#8b5cf6;margin:4px 0">${availableDrivers.length} <span style="font-size:15px;color:var(--muted)">/ ${drivers.length} ativos</span></h2>
            <small class="muted">${busyDriverIds.length} em rota no momento</small>
          </div>
          <div class="card" style="border-top:3px solid #f59e0b">
            <small class="muted">Ponto de Partida</small>
            <h3 style="margin:6px 0;font-size:15px;color:${depotLat && depotLng ? '#10b981' : '#f59e0b'}">
              ${depotLat && depotLng ? '✓ Depósito Mapeado' : '⚠ Sem coordenadas'}
            </h3>
            <small class="muted">${depotLat ? `${Number(depotLat).toFixed(4)}, ${Number(depotLng).toFixed(4)}` : 'Clique abaixo para salvar'}</small>
          </div>
        </div>

        <!-- Channels Selector & Operators Filter -->
        <div class="panel" style="margin-bottom:16px">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px">
            <div style="display:flex; gap:8px; flex-wrap:wrap">
              <button class="btn ${activeGrupo === 'TODOS' ? 'primary' : ''}" style="font-size:12px" onclick="switchDeliveryGrupo('TODOS')">
                🛒 Todos os Pedidos (${countByGroup.TODOS})
              </button>
              <button class="btn ${activeGrupo === 'VENDEDOR' ? 'primary' : ''}" style="font-size:12px" onclick="switchDeliveryGrupo('VENDEDOR')">
                👔 Vendedores (${countByGroup.VENDEDOR})
              </button>
              <button class="btn ${activeGrupo === 'WEB' ? 'primary' : ''}" style="font-size:12px" onclick="switchDeliveryGrupo('WEB')">
                🌐 Loja Online (${countByGroup.WEB})
              </button>
              <button class="btn ${activeGrupo === 'BALCAO' ? 'primary' : ''}" style="font-size:12px" onclick="switchDeliveryGrupo('BALCAO')">
                🏪 Balcão Entrega (${countByGroup.BALCAO})
              </button>
            </div>
            ${(activeGrupo === 'VENDEDOR' || activeGrupo === 'BALCAO') && operatorsArr.length ? `
              <div style="display:flex; align-items:center; gap:8px">
                <label style="font-size:12px; font-weight:700">Filtrar Usuário:</label>
                <select id="delivSellerFilter" class="field-input" style="width:auto;margin:0;padding:6px 12px;font-size:12px" onchange="switchDeliveryGrupo('${activeGrupo}', this.value)">
                  <option value="">Todos os usuários</option>
                  ${operatorsArr.map(nome => `<option value="${esc(nome)}" ${sellerFilter === nome ? 'selected' : ''}>${esc(nome)}</option>`).join('')}
                </select>
              </div>
            ` : ''}
          </div>
        </div>

        <!-- Sticky Action Toolbar -->
        <div class="panel" style="margin-bottom:16px; position:sticky; top:10px; z-index:30; background:var(--xv-panel,#101d2e); border:1px solid #1e3a8a; box-shadow:0 8px 24px rgba(0,0,0,0.35); padding:12px 18px">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px">
            <div style="display:flex; align-items:center; gap:14px; flex-wrap:wrap">
              <input id="delivQuickSearch" class="field-input search" style="margin:0; width:260px; min-width:200px; padding:7px 12px; font-size:13px" placeholder="🔍 Filtrar pedido, cliente ou bairro..." oninput="filterDelivOrdersTable()">
              <span id="delivSelectedCount" style="font-size:13px">
                <strong>0</strong> pedidos selecionados · <span class="orange">R$ 0,00</span>
              </span>
            </div>
            <div style="display:flex; gap:10px; flex-wrap:wrap">
              <button id="btnDelivMakeList" class="btn" onclick="generateLoadingList()">
                📋 Gerar Lista de Carregamento
              </button>
              <button class="btn" onclick="downloadDeliveryOrdersPdf()">
                🖨️ Imprimir Pedidos em PDF
              </button>
              <button id="btnDelivCompleteDirect" class="btn good" style="background:#059669; border-color:#059669; font-weight:800; font-size:13px; display:inline-flex; align-items:center; gap:6px" onclick="completeOrdersWithoutDriver()">
                ✓ Concluir Pedidos (Sem Motorista)
              </button>
              <button id="btnDelivMakeRoute" class="btn primary" style="background:#10b981; border-color:#10b981; font-weight:800; font-size:13px" onclick="makeRouteModal()">
                🚚 Gerar Rota & Designar Motorista →
              </button>
            </div>
          </div>
        </div>

        <!-- Neighborhoods and Orders List -->
        <div id="delivNeighborhoodsList">
          ${(() => {
            const sgs = currentGroupObj.subgrupos || [];
            let hasAny = false;
            const html = sgs.map(sg => {
              let pList = sg.pedidos || [];
              if((activeGrupo === 'VENDEDOR' || activeGrupo === 'BALCAO') && sellerFilter) {
                pList = pList.filter(p => p.operador_nome === sellerFilter);
              }
              if(!pList.length) return '';
              hasAny = true;
              const sgTotal = pList.reduce((acc, p) => acc + Number(p.total || 0), 0);
              return `
                <div class="card logistics-neighborhood" style="margin-bottom:16px; border-left:4px solid #10b981">
                  <div class="panel-title" style="margin-bottom:10px; flex-wrap:wrap; gap:8px">
                    <div style="display:flex; align-items:center; gap:10px">
                      <strong style="color:#10b981; font-size:15px">📍 ${esc(sg.bairro)}</strong>
                      <span class="badge" style="background:rgba(16,185,129,0.15);color:#10b981;font-weight:700">
                        ${pList.length} ${pList.length === 1 ? 'pedido' : 'pedidos'} · ${brl(sgTotal)}
                      </span>
                    </div>
                    <label style="cursor:pointer;font-size:12px;display:flex;align-items:center;gap:6px;font-weight:600">
                      <input type="checkbox" onchange="const cb=this.closest('.logistics-neighborhood').querySelectorAll('.routeOrder'); cb.forEach(c => c.checked = this.checked); updateDelivSelectionCounter()">
                      Selecionar todos deste bairro
                    </label>
                  </div>
                  <div class="actions" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(280px, 1fr)); gap:10px">
                    ${pList.map(p => `
                      <label class="card logistics-order" style="display:flex; align-items:flex-start; gap:10px; cursor:pointer; padding:10px; background:rgba(255,255,255,0.02); border:1px solid var(--border)">
                        <input type="checkbox" class="load-order routeOrder" value="${p.id}" data-total="${p.total || 0}" onchange="updateDelivSelectionCounter()" style="margin-top:3px">
                        <div style="flex:1; font-size:12px; line-height:1.4">
                          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2px">
                            <strong style="font-size:13px; color:var(--text)">${esc(p.numero)}</strong>
                            <strong class="orange" style="font-size:12px">${brl(p.total)}</strong>
                          </div>
                          <div style="font-weight:700; color:var(--text)">${esc(p.nome_fantasia || p.razao_social)}</div>
                          <div class="muted" style="font-size:11px; margin-top:2px">
                            📍 ${esc(p.endereco || sg.bairro)}
                          </div>
                          <div class="muted" style="font-size:11px; margin-top:2px">
                            👤 ${esc(p.operador_nome || 'N/A')}${activeGrupo === 'TODOS' ? ` · ${esc(p.origem)}` : ''}
                          </div>
                        </div>
                      </label>
                    `).join('')}
                  </div>
                </div>
              `;
            }).join('');

            return hasAny ? html : '<div class="empty-state">Nenhum pedido em separação para este filtro ou canal.</div>';
          })()}
        </div>

        <!-- Central Depot Configuration Panel -->
        <div class="panel" style="margin-top:24px">
          <div class="panel-title">
            <div>
              <h3>📍 Ponto de Partida e Roteirização Inteligente (OpenStreetMap)</h3>
              <p class="muted">A rota mais curta pelas ruas reais é calculada automaticamente via <strong>OpenStreetMap (OSRM)</strong>, 100% gratuito e sem necessidade de chave de API.</p>
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
      ` : ''}

      ${activeTab === 'cronograma' ? `
        <!-- Weekly Delivery Schedule -->
        <div class="grid" style="margin-bottom:18px">
          <div class="card" style="border-top:3px solid #1e3a8a">
            <small class="muted">Dias com Rotas Configuradas</small>
            <h2 style="color:#60a5fa;margin:4px 0">${schedule.length}</h2>
            <small class="muted">Dias da semana ativos</small>
          </div>
          <div class="card" style="border-top:3px solid #3b82f6">
            <small class="muted">Bairros Mapeados para Entrega</small>
            <h2 style="color:#3b82f6;margin:4px 0">${totalBairrosCronograma}</h2>
            <small class="muted">Regiões atendidas</small>
          </div>
          <div class="card" style="border-top:3px solid #8b5cf6">
            <small class="muted">Motoristas Ativos no Sistema</small>
            <h2 style="color:#8b5cf6;margin:4px 0">${drivers.length}</h2>
            <small class="muted">Entregadores cadastrados</small>
          </div>
        </div>

        <div class="panel">
          <div class="panel-title" style="margin-bottom:14px; flex-wrap:wrap; gap:12px; align-items:center; justify-content:space-between">
            <div>
              <h3 style="margin:0">📅 Cronograma Semanal de Entregas por Bairros e Motoristas</h3>
              <p class="muted" style="margin-top:4px; max-width:850px">
                Defina quais bairros são atendidos em cada dia da semana e selecione o motorista responsável por cada rota de entrega. Esta configuração orienta automaticamente a <strong>previsão de entrega calculada no checkout e na loja virtual</strong>!
              </p>
            </div>
            <div style="display:flex; gap:8px; flex-wrap:wrap">
              <button class="btn" style="border:1px solid #1e3a8a; background:rgba(8,43,120,0.25); color:#60a5fa; font-weight:700" onclick="initDefaultDeliverySchedule()">
                ⚡ Inicializar Semana Padrão (Seg a Sáb)
              </button>
              <button class="btn primary" style="background:#3b82f6; border-color:#3b82f6; font-weight:700" onclick="addDeliveryDayModal()">
                + Adicionar Dia / Rota
              </button>
              <button class="btn primary" style="background:linear-gradient(135deg,#021d60,#082b78); border:1px solid #1e3a8a; color:#fff; font-weight:700" onclick="saveDeliveryRoutesSchedule()">
                💾 Salvar Cronograma Completo
              </button>
            </div>
          </div>

          ${schedule.length === 0 ? `
            <div class="card" style="text-align:center; padding:36px; border:2px dashed var(--border); background:rgba(255,255,255,0.01); border-radius:10px">
              <div style="font-size:42px; margin-bottom:12px">🚚📅</div>
              <h3 style="margin:0 0 6px">Nenhum dia ou cronograma semanal configurado ainda</h3>
              <p class="muted" style="max-width:540px; margin:0 auto 18px; font-size:13px">
                Crie as rotas de entrega por dia da semana para definir os bairros atendidos e designar os motoristas responsáveis.
              </p>
              <div style="display:flex; justify-content:center; gap:12px; flex-wrap:wrap">
                <button class="btn primary" style="background:linear-gradient(135deg,#021d60,#082b78); border:1px solid #1e3a8a; color:#fff; font-size:14px; padding:10px 20px; font-weight:700" onclick="initDefaultDeliverySchedule()">
                  ⚡ Criar Cronograma Semanal Padrão (Segunda a Sábado)
                </button>
                <button class="btn" style="font-size:14px; padding:10px 20px; font-weight:700" onclick="addDeliveryDayModal()">
                  + Adicionar Dia Personalizado
                </button>
              </div>
            </div>
          ` : `
            <!-- Known Neighborhoods Quick Selection Chips -->
            ${allKnownBairros.length ? `
              <div style="margin-bottom:18px; padding:12px 14px; background:rgba(255,255,255,0.02); border:1px solid var(--border); border-radius:8px">
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px">
                  <span style="font-size:12px; font-weight:700; color:#60a5fa">💡 Bairros com clientes cadastrados:</span>
                  <span class="muted" style="font-size:11px">Clique em qualquer bairro abaixo para adicioná-lo à rota selecionada no momento.</span>
                </div>
                <div style="display:flex; gap:6px; flex-wrap:wrap">
                  ${allKnownBairros.map(b => `
                    <span class="badge" style="cursor:pointer; background:rgba(8,43,120,0.35); color:#93c5fd; border:1px solid rgba(30,58,138,0.6); font-size:11px; padding:3px 8px" onclick="appendBairroToActiveDay('${esc(b)}')">
                      + ${esc(b)}
                    </span>
                  `).join('')}
                </div>
              </div>
            ` : ''}

            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:16px;">
              ${schedule.map((item, index) => {
                const bairrosText = (item.bairros || []).join(', ');
                return `
                  <div class="card" style="border-top:4px solid #1e3a8a; background:rgba(8,43,120,0.08); display:flex; flex-direction:column; justify-content:space-between">
                    <div>
                      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px">
                        <div style="display:flex; align-items:center; gap:8px">
                          <strong style="font-size:16px; color:#021D60">📅 ${esc(item.dia_nome || ('Dia ' + item.dia))}</strong>
                          <span class="badge" style="background:#eff6ff; color:#1e3a8a; border:1px solid #bfdbfe">${(item.bairros||[]).length} bairros</span>
                        </div>
                        <button class="btn" style="padding:2px 8px; font-size:11px; color:#ef4444; border-color:#ef4444" onclick="removeDeliveryDay(${index})">
                          ✕ Remover
                        </button>
                      </div>

                      <div class="field" style="margin-bottom:12px">
                        <label style="font-size:12px; font-weight:700">🚚 Motorista Responsável pela Rota</label>
                        <select id="deliv_driver_${index}" class="field-input" style="width:100%" onchange="updateDeliveryDriverInSchedule(${index}, this.value)">
                          <option value="">-- Selecione ou Deixe sem motorista fixo --</option>
                          ${drivers.map(d => `<option value="${d.id}" ${item.motorista_id === d.id ? 'selected' : ''}>👤 ${esc(d.nome)} (${esc(d.email)})</option>`).join('')}
                        </select>
                      </div>

                      <div class="field">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px">
                          <label style="font-size:12px; font-weight:700">📍 Bairros Atendidos (separados por vírgula ou linha)</label>
                          <small style="font-size:11px; color:var(--muted)">Clique na caixa e use as sugestões acima</small>
                        </div>
                        <textarea id="deliv_bairros_${index}" rows="4" class="field-input" style="width:100%; font-size:13px; line-height:1.5" placeholder="Ex: Centro, Vila Isa, JK..." onfocus="window._lastFocusedDayIndex = ${index}" onchange="updateDeliveryBairrosInSchedule(${index}, this.value)">${esc(bairrosText)}</textarea>
                      </div>
                    </div>

                    <div style="margin-top:10px; font-size:11px; color:var(--muted); display:flex; justify-content:space-between; align-items:center">
                      <div>
                        ${item.motorista_nome ? `Motorista atual: <strong>${esc(item.motorista_nome)}</strong>` : 'Nenhum motorista designado no momento'}
                      </div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>

            <div class="actions" style="margin-top:20px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px">
              <button class="btn" onclick="addDeliveryDayModal()">
                + Adicionar Outro Dia ao Cronograma
              </button>
              <button class="btn primary" style="background:linear-gradient(135deg,#021d60,#082b78); border:1px solid #1e3a8a; color:#fff; font-size:14px; padding:10px 20px; font-weight:700" onclick="saveDeliveryRoutesSchedule()">
                💾 Salvar Cronograma Completo de Entregas
              </button>
            </div>
          `}
        </div>
      ` : ''}

      ${activeTab === 'historico' ? `
        <!-- Created Routes History Table -->
        <div class="panel">
          <div class="panel-title">
            <div>
              <h3>📋 Histórico de Rotas Criadas</h3>
              <p class="muted">Acompanhe as viagens de entrega geradas, motoristas designados, paradas e status de entrega.</p>
            </div>
            <button class="btn" onclick="renderDeliveryRoutesDashboardContent()">↻ Atualizar</button>
          </div>
          <div class="tablewrap">
            <table class="table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Motorista Designado</th>
                  <th>Status</th>
                  <th>Paradas / Pedidos</th>
                  <th>Distância / Tempo</th>
                </tr>
              </thead>
              <tbody>
                ${routesList.map(x => {
                  let ids = [];
                  try { ids = JSON.parse(x.sequencia_json || '[]'); } catch {}
                  const meta = x.distance_km != null ? `${x.distance_km} km ${x.estimated_minutes ? `· ~${x.estimated_minutes} min` : ''}` : '-';
                  return `
                    <tr>
                      <td>${esc(x.data)}</td>
                      <td><strong>👤 ${esc(x.motorista_nome || 'Sem motorista')}</strong></td>
                      <td>
                        <span class="badge" style="${x.status === 'CONCLUIDA' ? 'background:rgba(16,185,129,0.15);color:#10b981;border:1px solid rgba(16,185,129,0.3)' : 'background:rgba(59,130,246,0.15);color:#3b82f6;border:1px solid rgba(59,130,246,0.3)'}">
                          ${esc(x.status)}
                        </span>
                      </td>
                      <td>${ids.length} parada(s)</td>
                      <td><small class="muted">${meta}</small></td>
                    </tr>
                  `;
                }).join('') || '<tr><td colspan="5" class="empty-state">Nenhuma rota gerada ainda.</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
      ` : ''}
    `;

    updateDelivSelectionCounter();
  } catch(e) {
    container.innerHTML = '<div class="panel"><p class="muted">Erro ao carregar dados: ' + esc(e.message) + '</p></div>';
  }
};

window.initDefaultDeliverySchedule = async function(){
  window._currentDeliverySchedule = [
    { dia: 1, dia_nome: 'Segunda-feira', motorista_id: null, motorista_nome: null, bairros: [] },
    { dia: 2, dia_nome: 'Terça-feira', motorista_id: null, motorista_nome: null, bairros: [] },
    { dia: 3, dia_nome: 'Quarta-feira', motorista_id: null, motorista_nome: null, bairros: [] },
    { dia: 4, dia_nome: 'Quinta-feira', motorista_id: null, motorista_nome: null, bairros: [] },
    { dia: 5, dia_nome: 'Sexta-feira', motorista_id: null, motorista_nome: null, bairros: [] },
    { dia: 6, dia_nome: 'Sábado', motorista_id: null, motorista_nome: null, bairros: [] }
  ];
  window._deliveryActiveTab = 'cronograma';
  try {
    await api('/api/logistics/delivery-routes-config', {
      method: 'POST',
      body: JSON.stringify({
        items: window._currentDeliverySchedule,
        schedule: window._currentDeliverySchedule
      })
    });
    Realtime.emit('delivery_routes_changed');
    toast('Semana padrão (Segunda a Sábado) criada e salva com sucesso!');
  } catch(e) {
    toast('Semana padrão criada.');
  }
  await renderDeliveryRoutesDashboardContent();
};

window.addDeliveryDayModal = function(){
  const days = [
    { id: 1, nome: 'Segunda-feira' },
    { id: 2, nome: 'Terça-feira' },
    { id: 3, nome: 'Quarta-feira' },
    { id: 4, nome: 'Quinta-feira' },
    { id: 5, nome: 'Sexta-feira' },
    { id: 6, nome: 'Sábado' },
    { id: 7, nome: 'Domingo' }
  ];
  const drivers = window._currentDeliveryDrivers || [];
  modal('Adicionar Dia ao Cronograma de Entregas', `
    <form id="addDeliveryDayForm" class="form">
      <div class="field">
        <label>Dia da Semana</label>
        <select name="dia" required>
          ${days.map(d => `<option value="${d.id}" data-nome="${d.nome}">${d.nome}</option>`).join('')}
        </select>
      </div>
      <div class="field">
        <label>Motorista Responsável (opcional)</label>
        <select name="motorista_id">
          <option value="">-- Sem motorista fixo no momento --</option>
          ${drivers.map(d => `<option value="${d.id}">👤 ${esc(d.nome)} (${esc(d.email)})</option>`).join('')}
        </select>
      </div>
      <div class="field" style="grid-column:1/-1">
        <label>Bairros Atendidos (separados por vírgula ou linha)</label>
        <textarea name="bairros" rows="4" placeholder="Ex: Centro, Vila Isa, JK..."></textarea>
      </div>
      <div class="actions">
        <button type="button" class="btn" onclick="closeModal()">Cancelar</button>
        <button class="btn primary">Adicionar Dia</button>
      </div>
    </form>
  `);
  $('#addDeliveryDayForm').onsubmit = async e => {
    e.preventDefault();
    const selDay = e.currentTarget.querySelector('select[name="dia"]');
    const diaNum = Number(selDay.value);
    const diaNome = selDay.selectedOptions[0]?.getAttribute('data-nome') || 'Dia ' + diaNum;
    const driverId = e.currentTarget.querySelector('select[name="motorista_id"]').value || null;
    const drv = drivers.find(d => d.id === driverId);
    const bairrosText = e.currentTarget.querySelector('textarea[name="bairros"]').value || '';
    const bairros = bairrosText.split(/\n|,/).map(x => x.trim()).filter(Boolean);

    if(!window._currentDeliverySchedule) window._currentDeliverySchedule = [];
    window._currentDeliverySchedule.push({
      dia: diaNum,
      dia_nome: diaNome,
      motorista_id: driverId,
      motorista_nome: drv ? drv.nome : null,
      bairros
    });
    window._deliveryActiveTab = 'cronograma';
    try {
      await api('/api/logistics/delivery-routes-config', {
        method: 'POST',
        body: JSON.stringify({
          items: window._currentDeliverySchedule,
          schedule: window._currentDeliverySchedule
        })
      });
      Realtime.emit('delivery_routes_changed');
    } catch(err) {}
    closeModal();
    toast(`Dia ${diaNome} adicionado ao cronograma!`);
    await renderDeliveryRoutesDashboardContent();
  };
};

window.removeDeliveryDay = async function(index){
  if(!window._currentDeliverySchedule || !window._currentDeliverySchedule[index]) return;
  const dayName = window._currentDeliverySchedule[index].dia_nome || 'este dia';
  if(!confirm(`Remover ${dayName} do cronograma de entregas?`)) return;
  window._currentDeliverySchedule.splice(index, 1);
  try {
    await api('/api/logistics/delivery-routes-config', {
      method: 'POST',
      body: JSON.stringify({
        items: window._currentDeliverySchedule,
        schedule: window._currentDeliverySchedule
      })
    });
    Realtime.emit('delivery_routes_changed');
  } catch(err) {}
  toast(`${dayName} removido do cronograma.`);
  await renderDeliveryRoutesDashboardContent();
};

window.appendBairroToActiveDay = function(bairroName){
  if(!window._currentDeliverySchedule || !window._currentDeliverySchedule.length) {
    return toast('Adicione ou inicialize um dia no cronograma primeiro.');
  }
  const dayIndex = window._lastFocusedDayIndex != null ? window._lastFocusedDayIndex : 0;
  const item = window._currentDeliverySchedule[dayIndex];
  if(!item) return;
  const txtArea = document.getElementById('deliv_bairros_' + dayIndex);
  const current = (txtArea?.value || item.bairros?.join(', ') || '').trim();
  const arr = current ? current.split(/\n|,/).map(x => x.trim()).filter(Boolean) : [];
  if(!arr.includes(bairroName)){
    arr.push(bairroName);
    if(txtArea) txtArea.value = arr.join(', ');
    item.bairros = arr;
    toast(`Bairro "${bairroName}" adicionado à rota de ${item.dia_nome || ('Dia ' + item.dia)}!`);
  } else {
    toast(`Bairro "${bairroName}" já está na rota de ${item.dia_nome || ('Dia ' + item.dia)}.`);
  }
};

window.updateDeliveryDriverInSchedule = function(index, driverId){
  if(!window._currentDeliverySchedule || !window._currentDeliverySchedule[index]) return;
  const drv = (window._currentDeliveryDrivers || []).find(d => d.id === driverId);
  window._currentDeliverySchedule[index].motorista_id = driverId || null;
  window._currentDeliverySchedule[index].motorista_nome = drv ? drv.nome : null;
};

window.updateDeliveryBairrosInSchedule = function(index, text){
  if(!window._currentDeliverySchedule || !window._currentDeliverySchedule[index]) return;
  const arr = text.split(/\n|,/).map(x => x.trim()).filter(Boolean);
  window._currentDeliverySchedule[index].bairros = arr;
};

window.saveDeliveryRoutesSchedule = async function(){
  if(!window._currentDeliverySchedule) return;
  window._currentDeliverySchedule.forEach((item, index) => {
    const drvSelect = document.getElementById('deliv_driver_' + index);
    if(drvSelect) {
      const driverId = drvSelect.value;
      const drv = (window._currentDeliveryDrivers || []).find(d => d.id === driverId);
      item.motorista_id = driverId || null;
      item.motorista_nome = drv ? drv.nome : null;
    }
    const txtArea = document.getElementById('deliv_bairros_' + index);
    if(txtArea) {
      item.bairros = txtArea.value.split(/\n|,/).map(x => x.trim()).filter(Boolean);
    }
  });

  try {
    toast('Salvando cronograma de rotas de entrega...');
    await api('/api/logistics/delivery-routes-config', {
      method: 'POST',
      body: JSON.stringify({
        items: window._currentDeliverySchedule,
        schedule: window._currentDeliverySchedule
      })
    });
    toast('Cronograma de rotas de entrega salvo com sucesso!');
    Realtime.emit('delivery_routes_changed');
    await renderDeliveryRoutesDashboardContent();
  } catch(e) {
    toast('Erro ao salvar cronograma: ' + e.message, true);
  }
};

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
 if(!ids.length)return toast('Selecione os pedidos para gerar a lista de carregamento.');
 const seller = window._currentLogisticsSellerFilter || '';
 try{
  const x=await api('/api/logistics/loading-list',{method:'POST',body:JSON.stringify({pedido_ids:ids,vendedor:seller})});
  const sellerName = seller || x.vendedor || '';
  modal('Lista de carregamento',`<div class="panel" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px">
    <div>
      <strong>Produtos para carregamento</strong>
      ${sellerName?`<div style="font-size:13px; color:var(--xv-primary,#fd5e02); margin-top:2px;">👤 <strong>Vendedor:</strong> ${esc(sellerName)}</div>`:''}
      <div style="font-size:12px; color:var(--muted); margin-top:2px;">${ids.length} pedido(s) selecionado(s) · Total: ${x.total_produtos || 0} unidades</div>
    </div>
    <div style="display:flex; gap:8px; flex-wrap:wrap">
      <button class="btn primary" onclick="downloadAuthPost('/api/logistics/loading-list/pdf',{pedido_ids:parseJsonArg('${jsonArg(ids)}'),vendedor:parseJsonArg('${jsonArg(sellerName)}')},'Lista_Carregamento.pdf')">Gerar PDF</button>
      <button class="btn" onclick="downloadAuthPost('/api/logistics/loading-list/orders-pdf',{pedido_ids:parseJsonArg('${jsonArg(ids)}')},'Pedidos_Carregamento.pdf')">🖨️ Imprimir Pedidos em PDF</button>
    </div>
  </div>
  <div class="tablewrap"><table class="table"><thead><tr><th style="width:140px">Quantidade</th><th>Descrição do Produto</th></tr></thead><tbody>${x.produtos.map(p=>`<tr><td style="width:140px;font-size:1.15em"><strong style="color:var(--xv-primary,#fd5e02)">${p.quantidade_total} un</strong></td><td style="font-size:1.05em;font-weight:750">${esc(p.produto_nome)}</td></tr>`).join('')}</tbody></table></div>
  <div class="panel" style="margin-top:16px; margin-bottom:0; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; border-top:1px solid var(--border)">
    <div style="font-size:13px; color:var(--muted)">
      Finalização dos pedidos desta lista:
    </div>
    <div style="display:flex; gap:10px; flex-wrap:wrap">
      <button class="btn good" style="background:#059669; border-color:#059669; font-weight:800; display:inline-flex; align-items:center; gap:6px" onclick="completeOrdersWithoutDriver(parseJsonArg('${jsonArg(ids)}'))">
        ✓ Concluir Pedidos Sem Motorista
      </button>
      <button class="btn primary" style="background:#10b981; border-color:#10b981; font-weight:800; display:inline-flex; align-items:center; gap:6px" onclick="closeModal(); makeRouteModal()">
        🚚 Prosseguir com Motorista →
      </button>
    </div>
  </div>`);
 }catch(e){toast(e.message)}
}

window.completeOrdersWithoutDriver = async function(idsArg){
  let ids = [];
  if(Array.isArray(idsArg) && idsArg.length) {
    ids = idsArg;
  } else if(typeof idsArg === 'string' && idsArg.trim()) {
    ids = idsArg.split(',').map(s=>s.trim()).filter(Boolean);
  } else {
    ids = [...document.querySelectorAll('.routeOrder:checked, .load-order:checked')].map(x=>x.value);
    ids = [...new Set(ids)];
  }
  if(!ids.length) return toast('Selecione os pedidos que deseja concluir.');
  
  if(!confirm(`Deseja realmente CONCLUIR ${ids.length} pedido(s) selecionado(s) sem enviar ao motorista?\n\n• As mercadorias serão baixadas do estoque definitivamente.\n• Os pedidos passarão para o status CONCLUÍDO.\n• Nenhuma rota será criada para motoristas.`)){
    return;
  }
  
  try {
    toast(`Concluindo ${ids.length} pedido(s)...`);
    const res = await api('/api/logistics/orders/complete-direct', {
      method: 'POST',
      body: JSON.stringify({ pedido_ids: ids })
    });
    closeModal();
    toast(`✓ ${res.concluidos || ids.length} pedido(s) concluído(s) com sucesso sem envio a motorista!`);
    
    Realtime.emit('orders_changed', { ids, status: 'CONCLUIDO' });
    Realtime.emit('stock_changed');
    Realtime.emit('dashboard_changed');
    
    if(document.getElementById('deliveryRoutesDashboard')?.style.display === 'block'){
      await renderDeliveryRoutesDashboardContent();
    } else if(document.getElementById('logisticsModalityDashboard')?.style.display === 'block'){
      window.renderModalityDashboard(window._currentLogisticsGrupoKey||'TODOS', window._currentLogisticsSellerFilter||'');
    } else {
      show('logistics');
    }
  } catch(e) {
    toast(e.message || 'Erro ao concluir pedidos', true);
  }
};
async function makeRouteModal(){
    const ids=[...document.querySelectorAll('.routeOrder:checked')].map(x=>x.value);
    if(!ids.length)return toast('Selecione os pedidos para roteirizar.');
    
    // Fetch all active drivers
    const driversReq = await api('/api/users');
    const allDrivers = driversReq.items.filter(x => x.role==='driver' && x.ativo===1);
    
    // Fetch active routes to filter out drivers already in a route
    const routesReq = await api('/api/logistics/routes');
    const busyDrivers = routesReq.items.filter(r => r.status !== 'CONCLUIDA').map(r => r.motorista_id);
    
    const availableDrivers = allDrivers.filter(d => !busyDrivers.includes(d.id));
    
    modal('🚚 Gerar Rota & Designar Motorista', `<form id="generateRouteForm" class="form">
      <div class="field"><label>Motorista Responsável (disponível)</label>
      <select name="motorista_id" required>
        ${availableDrivers.length ? availableDrivers.map(d=>'<option value="'+d.id+'">👤 '+esc(d.nome)+' ('+esc(d.email)+')</option>').join('') : '<option value="" disabled selected>Nenhum motorista disponível no momento</option>'}
      </select></div>
      <div class="field" style="grid-column:1/-1">
        <p>Você selecionou <strong>${ids.length}</strong> pedido(s) para esta rota de entrega.</p>
        <p class="muted" style="font-size:12px;margin-top:4px">O itinerário e a sequência de paradas serão calculados automaticamente pela malha viária real (OpenStreetMap OSRM).</p>
      </div>
      <div class="actions"><button class="btn primary" ${!availableDrivers.length ? 'disabled' : ''}>Confirmar e Iniciar Rota</button></div>
    </form>`);
    
    $('#generateRouteForm').onsubmit=async e=>{
      e.preventDefault();
      closeModal();
      toast('Gerando rota logística e calculando itinerário...');
      try{
        await api('/api/logistics/routes',{method:'POST',body:JSON.stringify({
          motorista_id: new FormData(e.currentTarget).get('motorista_id'),
          pedido_ids: ids
        })});
        toast('Rota gerada com sucesso!');
        Realtime.emit('routes_changed',{ids});
        Realtime.emit('orders_changed',{ids,status:'ROTA'});
        if(document.getElementById('deliveryRoutesDashboard')?.style.display === 'block'){
          window._deliveryActiveTab = 'historico';
          await renderDeliveryRoutesDashboardContent();
        } else {
          refreshCurrentViewSilently('routes_changed');
        }
      } catch(ex){ toast(ex.message,true) }
    };
  }
async function reports(v,periodo='geral'){window._currentReportsPeriodo=periodo;v.innerHTML='<div class="panel">Carregando relatórios...</div>';const qStr=periodo!=='geral'?`?periodo=${periodo}`:'';const r=await api('/api/reports'+qStr);const periodLabels={geral:'Histórico Geral',semanal:'Últimos 7 dias',mensal:'Últimos 30 dias'};const originLabels={VENDEDOR:'Vendedor Externo',BALCAO:'Frente de Loja / PDV',WEB:'Loja Online (Web)'};v.innerHTML=`<div class="panel" style="margin-bottom:14px"><div class="panel-title" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px"><div><h3 style="margin:0">Relatórios Gerenciais</h3><p class="muted" style="margin:4px 0 0">Torre de Controle · Período: <strong>${periodLabels[periodo]||periodo}</strong></p></div><div class="actions" style="display:flex;gap:6px"><button class="btn ${periodo==='geral'?'primary':''}" style="font-size:12px;padding:6px 12px" onclick="reports(document.getElementById('view'),'geral')">Geral</button><button class="btn ${periodo==='semanal'?'primary':''}" style="font-size:12px;padding:6px 12px" onclick="reports(document.getElementById('view'),'semanal')">Semanal</button><button class="btn ${periodo==='mensal'?'primary':''}" style="font-size:12px;padding:6px 12px" onclick="reports(document.getElementById('view'),'mensal')">Mensal</button></div></div></div><div class="grid"><div class="card" style="border-top:4px solid #2ecc71"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><h3 style="margin:0;display:flex;align-items:center;gap:6px"><span>🛒</span> Vendas da Loja Online</h3><span class="badge" style="background:rgba(46,204,113,0.15);color:#2ecc71;border:1px solid rgba(46,204,113,0.3)">Canal Web</span></div><div style="padding:12px;background:rgba(46,204,113,0.08);border-radius:8px;margin-bottom:12px"><div style="font-size:24px;font-weight:800;color:#2ecc71">${brl(r.lojaOnline?.faturamento||0)}</div><small class="muted">${r.lojaOnline?.pedidos||0} pedido(s) concluído(s)</small></div>${(r.lojaOnline?.clientes||[]).length?`<small class="muted" style="font-weight:700;display:block;margin-bottom:6px">Clientes da Loja Online:</small>${r.lojaOnline.clientes.map(x=>`<p style="margin:4px 0">${esc(x.nome)} — <strong>${x.pedidos} pedidos</strong> — ${brl(x.faturamento)}</p>`).join('')}`:'<p class="muted">Nenhuma venda concluída na loja online no período.</p>'}</div><div class="card"><h3>Por Modalidade (Origem)</h3>${(r.origens||[]).map(x=>`<p><strong>${originLabels[x.origem]||x.origem}:</strong> ${x.pedidos} pedidos — <span class="orange">${brl(x.faturamento)}</span></p>`).join('')||'<p class="muted">Nenhum pedido no período.</p>'}</div><div class="card"><h3>Top produtos</h3>${r.topProdutos.slice(0,10).map(x=>`<p>${esc(x.nome)} — <strong>${x.quantidade} un.</strong> — ${brl(x.faturamento)}</p>`).join('')||'<p class="muted">Sem produtos vendidos no período.</p>'}</div><div class="card"><h3>Vendedores</h3>${r.vendedores.map(x=>`<p>${esc(x.nome)} — <strong>${x.pedidos} pedidos</strong> — ${brl(x.faturamento)}</p>`).join('')||'<p class="muted">Sem vendas de vendedores no período.</p>'}</div><div class="card"><h3>Frente de Loja / PDV</h3>${(r.balcao||[]).map(x=>`<p>${esc(x.nome)} — <strong>${x.pedidos} pedidos</strong> — ${brl(x.faturamento)}</p>`).join('')||'<p class="muted">Sem vendas no balcão no período.</p>'}</div></div>`}
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
          <span class="badge" style="background:${status.configured ? '#021d60' : '#f59e0b'};color:${status.configured ? '#ffffff' : '#07101a'};font-weight:700">
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
            <input id="quickGroqKey" type="password" placeholder="gsk_..." style="flex:1;max-width:400px;background:#ffffff;color:#000000;border:1px solid #cbd5e1;border-radius:6px;padding:8px 12px">
            <button class="btn primary" onclick="saveGroqKey()">Salvar Chave</button>
          </div>
        </div>
      ` : `
        <div style="margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.2);padding:10px 14px;border-radius:8px">
          <span style="font-size:13px;color:#021d60;font-weight:700">API Groq configurada e pronta para consultas com leitura em todo o banco de dados.</span>
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

      <textarea id="aimsg" style="width:100%;height:100px;background:#ffffff;color:#000000;border:1px solid #cbd5e1;border-radius:8px;padding:10px;font-family:inherit;font-size:14px" placeholder="Faça uma pergunta sobre qualquer dado do ERP (ex: Quais os produtos mais vendidos da categoria Bebidas?)..."></textarea>
      
      <div style="margin-top:12px;display:flex;align-items:center;gap:12px">
        <button id="aiSubmitBtn" class="btn primary" onclick="askAI()">Consultar IA Administrativa</button>
        <span id="aiLoadingIndicator" style="display:none;color:var(--xv-orange);font-size:13px">⏳ Analisando banco de dados no Groq...</span>
      </div>

      <div id="airespWrap" style="margin-top:20px;display:none">
        <h4 style="margin-bottom:8px">Resposta:</h4>
        <pre id="airesp" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;white-space:pre-wrap;word-break:break-word;font-size:14px;line-height:1.6;color:#000000"></pre>
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
                <div style="margin-bottom:6px;font-family:monospace;font-size:12px;background:#f8fafc;padding:6px;border-radius:4px;border:1px solid #e2e8f0">
                  <span style="color:#0369a1;font-weight:600">${esc(q.sql)}</span>
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
function modal(title,body,width='700px'){const x=document.createElement('div');x.id='modal';x.style='position:fixed;inset:0;background:#000b;display:grid;place-items:center;z-index:100';x.innerHTML=`<div class="panel" style="width:min(${width},94vw);max-height:90vh;overflow:auto"><div class="top"><h2>${title}</h2><button class="btn" onclick="closeModal()">×</button></div>${body}</div>`;document.body.appendChild(x)}function closeModal(){window.inboundBarcodeActive=false;window.ptdCurrentTableId=null;document.querySelector('#modal')?.remove()}
function roleLoginPage(role){document.body.innerHTML=`<div class="login"><div class="loginbox"><img class="xv-logo" src="/assets/institucional/01_Logo_Xiquim_Vargas_HD.png" alt="Xiquim Vargas"><h1>${role}</h1><p style="color:var(--muted)">Entre com suas credenciais.</p><form onsubmit="login(event)"><div class="field"><label>Email</label><input name="email" type="email" required></div><br><div class="field"><label>Senha</label><div style="display:flex;gap:6px"><input name="password" type="password" required style="flex:1"><button type="button" class="btn" tabindex="-1" onclick="const x=this.previousElementSibling; x.type=x.type==='password'?'text':'password'">👁</button></div></div><br><button class="btn primary" style="width:100%">Entrar</button></form><p style="color:var(--muted);font-size:16px">Servidor local: ${location.origin}</p></div></div><div id="toast" class="toast"></div>`}
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
            <td><strong style="color:#000000;font-size:14px;font-weight:800">${esc(f.nome)}</strong></td>
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
  row.style = 'grid-template-columns: 2fr 1fr 1fr auto; align-items:flex-end; background:#f8fafc; padding:10px; border-radius:8px; border:1px solid #e2e8f0';

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
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px;margin-bottom:16px">
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
            <span class="muted" style="font-size:12px">Conferência com leitor óptico USB ou manual:</span>
          </div>

          <div class="pdv-barcode-tools" style="background:#f8fafc;border:1px solid #e2e8f0;margin-bottom:12px">
            <div class="pdv-barcode-row">
              <button type="button" id="inboundBarcodeButton" class="btn" onclick="toggleInboundBarcode()">▣ Ler código de barras</button>
              <div class="field">
                <label style="color:#000;font-size:12px;font-weight:700">Quantidade por bipe</label>
                <input id="inboundBarcodeQty" class="field-input" type="number" min="1" max="99999" step="1" value="1" inputmode="numeric" style="padding:7px;height:36px;background:#fff;color:#000;border:1px solid #cbd5e1">
              </div>
            </div>
            <div id="inboundBarcodeStatus" class="muted" style="font-size:12px;margin-top:6px;color:#000">Leitor opcional. Conecte leitor físico USB/Bluetooth para bipagem contínua.</div>
            <input id="barcodeReceiveInput" class="pdv-barcode-input" type="text" inputmode="numeric" autocomplete="off" spellcheck="false" placeholder="Clique em Ler código de barras para bipagem contínua" onkeydown="onBarcodeReceiveKey(event, '${cid}')" style="background:#fff;color:#000;border:1px solid #cbd5e1">
          </div>

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

window.inboundBarcodeActive = false;

function toggleInboundBarcode(){
  const input = $('#barcodeReceiveInput');
  const button = $('#inboundBarcodeButton');
  const status = $('#inboundBarcodeStatus');
  if(!input || !button) return;
  const active = input.dataset.active === '1';
  input.dataset.active = active ? '0' : '1';
  window.inboundBarcodeActive = !active;
  button.classList.toggle('good', !active);
  button.textContent = active ? '▣ Ler código de barras' : '■ Leitor ativo — bipagem contínua';
  if(status){
    status.textContent = active 
      ? 'Leitor desativado. Clique para ativar.' 
      : 'Leitor contínuo ATIVO. Pode conferir produtos seguidos com o leitor físico USB sem clicar novamente.';
  }
  if(!active){
    input.value = '';
    input.focus();
  }
}

if(!window._inboundBarcodeGlobalListener){
  window._inboundBarcodeGlobalListener = true;
  window.addEventListener('keydown', e => {
    if(!window.inboundBarcodeActive) return;
    const input = $('#barcodeReceiveInput');
    if(!input || input.dataset.active !== '1') return;
    const activeEl = document.activeElement;
    const tag = activeEl ? activeEl.tagName.toLowerCase() : '';
    const id = activeEl ? activeEl.id : '';
    if((tag === 'input' || tag === 'textarea' || tag === 'select') && id !== 'barcodeReceiveInput') return;
    if(activeEl !== input) input.focus();
  });
}

async function onBarcodeReceiveKey(e, cid){
  if(e.key !== 'Enter') return;
  e.preventDefault();
  const input = e.currentTarget || e.target;
  const code = (input?.value || '').trim();
  if(!code) return;

  const qtyInput = $('#inboundBarcodeQty');
  const qty = Math.max(1, Math.min(99999, Number(qtyInput?.value || 1)));
  if(!Number.isInteger(qty)){
    toast('Quantidade inválida.', true);
    qtyInput?.focus();
    return;
  }

  try {
    const res = await api(`/api/inbound/barcode?code=${encodeURIComponent(code)}${cid ? `&compra_id=${encodeURIComponent(cid)}` : ''}`);
    const item = res.item;

    const row = document.querySelector(`tr[data-product-id="${item.produto_id}"]`) || document.querySelector(`tr[data-barcode="${code}"]`);
    if(row){
      const inp = row.querySelector('.receive-qty-input');
      if(inp){
        const max = Number(inp.max || 9999);
        const cur = Number(inp.value || 0);
        if(cur >= max && max > 0){
          toast(`Quantidade total de "${item.produto_nome}" já conferida (${cur}/${max})!`, true);
        } else {
          const novoValor = Math.min(max, cur + qty);
          inp.value = novoValor;
          row.classList.add('receive-row-highlight');
          setTimeout(() => row.classList.remove('receive-row-highlight'), 1000);
          toast(`✓ +${qty} bipado(s): ${item.produto_nome} (${novoValor}/${max})`);
        }
      }
    } else {
      toast(`Item "${item.produto_nome}" não encontrado na tabela de conferência!`, true);
    }
  } catch(err) {
    toast(err.message, true);
  } finally {
    if(input && (input.dataset.active === '1' || window.inboundBarcodeActive)){
      input.value = '';
      input.focus();
    } else if(input) {
      input.value = '';
    }
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

