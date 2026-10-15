const API='';
if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js').catch(()=>{})}
let token=localStorage.getItem('xv_token'),me=null;
function priceForLine(product,quantity=1){const minimum=Number(product?.quantidade_minima||1);if(product?.preco_tabela!=null&&Number(quantity)>=minimum)return Number(product.preco_tabela);if(product?.promocao_preco!=null)return Number(product.promocao_preco);return Number(product?.preco_aplicado??product?.preco_base??0)}
const $=s=>document.querySelector(s);function jsonArg(value){const bytes=new TextEncoder().encode(JSON.stringify(value));let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);return btoa(binary)}
function parseJsonArg(encoded){return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(encoded),c=>c.charCodeAt(0))))}
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
async function api(path,opt={}){const reqId=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10);try{const r=await fetch(API+path,{...opt,headers:{'x-request-id':reqId,'content-type':'application/json',...(opt.headers||{}),...(token?{authorization:'Bearer '+token}:{})}});if(!r.ok){let e;try{e=await r.json()}catch{};throw new Error(e?.error||`HTTP ${r.status}`)}return r.headers.get('content-type')?.includes('application/json')?r.json():r.blob()}catch(e){if((!navigator.onLine||e instanceof TypeError||e?.name==='TypeError'||e.message?.includes('fetch')||e.message?.includes('NetworkError')||e.message?.includes('Failed to fetch'))&&opt.method&&opt.method!=='GET'){const q=await queueOffline(path,opt);return {offline:true,queued_id:q.id}}throw e}}
function money(v){const n=Number(v);return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number.isFinite(n)?n:0)}
function offlineDb(){return new Promise((resolve,reject)=>{const r=indexedDB.open('xv-offline-v1-'+encodeURIComponent(me?.id||'anonymous'),1);r.onupgradeneeded=()=>{const d=r.result;if(!d.objectStoreNames.contains('kv'))d.createObjectStore('kv');if(!d.objectStoreNames.contains('queue'))d.createObjectStore('queue',{keyPath:'id'})};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
async function offlinePut(store,key,value){const d=await offlineDb();return new Promise((res,rej)=>{const t=d.transaction(store,'readwrite');t.objectStore(store).put(value,key);t.oncomplete=res;t.onerror=()=>rej(t.error)})}
async function offlineGet(store,key){const d=await offlineDb();return new Promise((res,rej)=>{const t=d.transaction(store);const r=t.objectStore(store).get(key);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
async function queueOffline(path,opt){const id=crypto.randomUUID();const item={id,path,method:opt.method||'POST',body:opt.body||'{}',headers:opt.headers||{},created_at:new Date().toISOString()};const d=await offlineDb();await new Promise((res,rej)=>{const t=d.transaction('queue','readwrite');t.objectStore('queue').put(item);t.oncomplete=res;t.onerror=()=>rej(t.error)});return item}
async function syncOfflineQueue(){if(!navigator.onLine)return;const d=await offlineDb();const rows=await new Promise((res,rej)=>{const t=d.transaction('queue');const q=t.objectStore('queue').getAll();q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error)});let synced=0;for(const item of (rows||[]).sort((a,b)=>a.created_at.localeCompare(b.created_at))){try{await api(item.path,{method:item.method,body:item.body,headers:{...(item.headers||{}),'Idempotency-Key':item.headers?.['Idempotency-Key']||('OFF-'+item.id)}});await new Promise((res,rej)=>{const t=d.transaction('queue','readwrite');t.objectStore('queue').delete(item.id);t.oncomplete=res;t.onerror=()=>rej(t.error)});synced++}catch(e){if(!navigator.onLine)break;console.warn('sync-pending',e.message)}}if(synced>0){toastRole(`✓ ${synced} operação(ões) offline sincronizada(s) com sucesso!`);if(typeof roleRealtimeRefresh==='function'){roleRealtimeRefresh('orders_changed');roleRealtimeRefresh('stock_changed')}}}
window.addEventListener('online',syncOfflineQueue);setTimeout(syncOfflineQueue,1200);

let _roleToastTimer=null;
function toastRole(m,isError=false){
  let t=$('#toast')||$('#roleToast')||$('#storeToast');
  if(!t){t=document.createElement('div');t.id='roleToast';t.className='toast';document.body.appendChild(t)}
  clearTimeout(_roleToastTimer);
  t.textContent=m;
  t.style.display='block';
  t.style.opacity='1';
  t.style.backgroundColor=isError?'#991b1b':'var(--xv-primary,#0f172a)';
  t.style.color='#fff';
  _roleToastTimer=setTimeout(()=>{t.style.opacity='0';setTimeout(()=>{t.style.display='none'},300)},2500);
}
window.toastStore=toastRole;
const toast=toastRole;
const brl=money;
function modal(title,body,width='700px'){
  document.querySelector('#modal')?.remove();
  const x=document.createElement('div');
  x.id='modal';
  x.style='position:fixed;inset:0;background:rgba(0,0,0,0.7);display:grid;place-items:center;z-index:1000;padding:12px;overflow-y:auto;';
  x.innerHTML=`<div class="panel" style="width:min(${width},96vw);max-height:92vh;overflow-y:auto;background:var(--bg,#fff);box-shadow:0 20px 45px rgba(0,0,0,0.35);border-radius:12px;padding:20px;border:1px solid #dfe5ed;"><div class="top" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid #e2e8f0;"><h2 style="margin:0;font-size:1.25rem;color:var(--xv-brand-navy,#061a4f);">${title}</h2><button class="btn" onclick="closeModal()" style="padding:4px 10px;font-size:16px;">✕</button></div>${body}</div>`;
  document.body.appendChild(x);
}
function closeModal(){
  document.querySelector('#modal')?.remove();
}
window.modal=modal;
window.closeModal=closeModal;

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

let _roleDebounce=null;
async function roleRealtimeRefresh(type,payload){
  clearTimeout(_roleDebounce);
  _roleDebounce=setTimeout(async()=>{
    const role=document.body.dataset.role;
    try{
      if(role==='Frente de Loja / PDV'){
        if(type==='clients_changed'||type==='tab_focused'){
          try{
            const c=await api('/api/clients');
            window.pdvClients=c.items||[];
            await offlinePut('kv','pdvClients',window.pdvClients);
          }catch(e){}
        }
        if(type==='stock_changed'||type==='products_changed'||type==='prices_changed'||type==='orders_changed'||type==='tab_focused'){
          const clientId=$('#pdvClient')?.value||'CLIENTE-BALCAO';
          const [p,s]=await Promise.all([
            api('/api/products'+(clientId?'?cliente_id='+encodeURIComponent(clientId):'')),
            api('/api/stock')
          ]);
          const sm=new Map(s.items.map(x=>[x.id,x]));
          window.pdvProducts=p.items.map(x=>({...x,...(sm.get(x.id)||{})}));
          await offlinePut('kv','pdvProducts',p.items);
          await offlinePut('kv','pdvStock',s.items);
          const searchInput=$('#pdvSearch');
          if(searchInput&&searchInput.value.trim()){
            pdvFilter(searchInput);
          }
          if(window.pdvCart&&Object.keys(window.pdvCart).length>0){
            pdvCartRender();
          }
        }
      }else if(role==='Vendedor Externo'){
        const host=document.querySelector('.mobile-content');
        if(host&&host.innerHTML.includes('Meus pedidos')){
          if(type==='orders_changed'||type==='returns_changed'||type==='tab_focused'){
            sellerOrders();
          }
        }else if(host&&host.innerHTML.includes('Painel do mês')){
          if(type==='orders_changed'||type==='returns_changed'||type==='tab_focused'){
            sellerDashboard();
          }
        }else if(host&&host.innerHTML.includes('Estoque disponível')){
          if(type==='stock_changed'||type==='products_changed'||type==='orders_changed'||type==='tab_focused'){
            const x=await api('/api/seller/stock');
            const listEl=$('#sellerStockList');
            if(listEl){
              listEl.innerHTML=x.items.map(sellerStockRow).join('');
              const search=$('#sellerStockSearch');
              if(search&&search.value.trim())sellerStockFilter(search);
            }else{
              sellerStock();
            }
          }
        }else if(window.sellerCatalogMode){
          if(type==='stock_changed'||type==='products_changed'||type==='prices_changed'||type==='orders_changed'||type==='tab_focused'){
            const [p,s]=await Promise.all([
              api('/api/products'+(window.sellerCurrentClientId?'?cliente_id='+encodeURIComponent(window.sellerCurrentClientId):'')),
              api('/api/seller/stock')
            ]);
            const sm=new Map(s.items.map(x=>[x.id,x]));
            const items=p.items.map(x=>({...x,...(sm.get(x.id)||{})}));
            if(window.sellerCatalogMode==='DEMO'){
              window.sellerCatalogItems=items;
              if(typeof sellerCatalogRender==='function')sellerCatalogRender(items);
            }else{
              window.sellerProducts=items;
              if(typeof sellerRender==='function')sellerRender(items);
              if(typeof renderSellerNewOrderCart==='function')renderSellerNewOrderCart();
            }
          }
        }else if(host&&host.innerHTML.includes('Minhas Rotas')){
          if(type==='routes_changed'||type==='tab_focused'){
            sellerMyRoutes();
          }
        }else{
          if(type==='clients_changed'||type==='orders_changed'||type==='returns_changed'||type==='tab_focused'){
            if(typeof sellerRefreshCrm==='function')sellerRefreshCrm();
          }
        }
      }else if(role==='Loja Online'){
        if(type==='orders_changed'||type==='tab_focused'){
          const navActive=document.querySelector('.store-nav.active');
          if(navActive&&navActive.textContent.toLowerCase().includes('ped')){
            lojaPedidos();
          }
        }
        if(type==='products_changed'||type==='stock_changed'||type==='prices_changed'||type==='tab_focused'){
          const p=await api('/api/products'+(window.lojaClientId?'?cliente_id='+encodeURIComponent(window.lojaClientId):''));
          window.lojaProducts=p.items;
          if($('#storeSubSearch')){
            lojaFilterSub();
          }else if($('#storeProducts')){
            lojaFilter();
          }
          if(typeof renderCart==='function'&&$('#cartItems')){
            renderCart();
          }
        }
        if(type==='settings_changed'){
          try{
            const sc=await api('/api/store-config');
            window.storeCfg=sc.config||{};
            const navActive=document.querySelector('.store-nav.active');
            if(navActive&&navActive.textContent.toLowerCase().includes('cat')){
              const hero=$('.store-hero');
              if(hero)hero.outerHTML=storeHeroHtml();
            }
          }catch(e){}
        }
      }else if(role==='Motorista'){
        if(type==='routes_changed'||type==='orders_changed'||type==='returns_changed'||type==='tab_focused'){
          const hasModal=!!document.querySelector('#modal');
          if(!hasModal){
            const host=document.querySelector('.mobile-content');
            if(host){
              if(host.innerHTML.includes('Fila do dia')){
                driver();
              }else if(host.innerHTML.includes('Rotas concluídas')){
                driverCompletedRoutes();
              }
            }
          }
        }
      }
    }catch(err){console.warn('roleRealtimeRefresh err',err)}
  },120);
}
async function downloadAuthFile(url,filename){try{const reqId=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10);console.log(`[${reqId}] GET ${url}`);const r=await fetch(url,{headers:{'x-request-id':reqId,...(token?{authorization:'Bearer '+token}:{})}});if(!r.ok)throw new Error('Não foi possível abrir o documento');const b=await r.blob();const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=filename||'documento.pdf';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}catch(e){alert(e.message)}}
function logout(){localStorage.removeItem('xv_token');location.reload()}
function loginPage(){const isStore=document.body.dataset.role==='Loja Online';document.body.innerHTML=`<div class="login"><div class="loginbox"><img class="xv-logo" src="/assets/brand/logo-online.jpg" alt="Xiquim Vargas"><h1>${esc(document.body.dataset.role)}</h1>${isStore?`<p>Escolha como deseja acessar a Loja Online.</p><div class="actions" style="display:grid;grid-template-columns:1fr 1fr"><button class="btn primary" onclick="storeAuthMode('login')">Fazer Login</button><button class="btn" onclick="storeAuthMode('register')">Cadastre-se</button></div><div id="storeAuthBox"></div>`:`<p>Entre com suas credenciais para acessar sua operação.</p><form id="roleLoginForm"><div class="field"><label>Email</label><input name="email" type="email" autocomplete="username" required></div><br><div class="field"><label>Senha</label><div style="display:flex;gap:6px"><input name="password" type="password" autocomplete="current-password" required style="flex:1"><button type="button" class="btn" tabindex="-1" onclick="const x=this.previousElementSibling; x.type=x.type==='password'?'text':'password'">👁</button></div></div><br><button class="btn primary" type="submit" style="width:100%;padding:13px">Entrar na operação</button></form>`}</div></div>`;if(!isStore)document.getElementById('roleLoginForm').addEventListener('submit',doLogin)}
function storeAuthMode(mode){const box=$('#storeAuthBox');if(mode==='login'){box.innerHTML=`<form id="roleLoginForm" class="form" style="margin-top:18px"><div class="field"><label>Email</label><input name="email" type="email" autocomplete="username" required></div><div class="field"><label>Senha</label><div style="display:flex;gap:6px"><input name="password" type="password" autocomplete="current-password" required style="flex:1"><button type="button" class="btn" tabindex="-1" onclick="const x=this.previousElementSibling; x.type=x.type==='password'?'text':'password'">👁</button></div></div><button class="btn primary" style="width:100%">Fazer Login</button></form>`;$('#roleLoginForm').addEventListener('submit',doLogin);return}storeRegister()}
function storeRegister(){const box=$('#storeAuthBox')||$('#registerBox');if(!box)return;box.innerHTML=`<form id="storeRegisterForm" class="form" style="margin-top:18px"><div class="field"><label>Nome</label><input name="nome" required></div><div class="field"><label>E-mail</label><input name="email" type="email" autocomplete="email" required></div><div class="field"><label>Telefone</label><input name="telefone" type="tel" autocomplete="tel" maxlength="40" required></div><div class="field"><label>Endereço</label><input name="endereco" autocomplete="street-address" maxlength="240" required></div><div class="field"><label>Bairro</label><input name="bairro" maxlength="120" required></div><div class="field"><label>Criar senha</label><div style="display:flex;gap:6px"><input id="regPassword" name="password" type="password" minlength="8" required style="flex:1"><button type="button" class="btn" onclick="const x=$('#regPassword');x.type=x.type==='password'?'text':'password'">👁</button></div></div><button class="btn primary" style="width:100%">Criar cadastro</button></form>`;$('#storeRegisterForm').onsubmit=async e=>{e.preventDefault();try{const x=await api('/api/store/register',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(e.currentTarget)))});token=x.token;localStorage.setItem('xv_token',token);location.reload()}catch(err){alert(err.message)}}}
async function doLogin(e){e.preventDefault();const form=e.currentTarget;if(!(form instanceof HTMLFormElement))return alert('Não foi possível identificar o formulário de login. Atualize a página e tente novamente.');const submit=form.querySelector('button[type=submit]');if(submit){submit.disabled=true;submit.textContent='Entrando…'}try{const data=Object.fromEntries(new FormData(form));const x=await api('/api/auth/login',{method:'POST',body:JSON.stringify(data)});token=x.token;me=x.user;localStorage.setItem('xv_token',token);localStorage.setItem('xv_user',JSON.stringify(x.user||{}));location.reload()}catch(err){alert(err.message);if(submit){submit.disabled=false;submit.textContent='Entrar na operação'}}}
async function initRole(){if(!token)return loginPage();const cachedMe=localStorage.getItem('xv_user');if(cachedMe){try{me=JSON.parse(cachedMe)}catch{}}try{const m=await api('/api/me');me=m.user;localStorage.setItem('xv_user',JSON.stringify(me));Realtime.init((type,payload)=>roleRealtimeRefresh(type,payload));await renderRole()}catch(err){if(!navigator.onLine&&me){console.warn('Operando offline com sessão em cache');await renderRole();return}if(err.message?.includes('401')||err.message?.includes('Token')){localStorage.removeItem('xv_token');localStorage.removeItem('xv_user');return loginPage()}if(me){await renderRole()}else{loginPage()}}}
function mobileHeader(title,subtitle,logo='/assets/brand/logo-online.jpg',dark=false){return `<header class="mobile-header"><div class="mobile-header-row"><img class="xv-logo" src="${logo}" alt="Xiquim Vargas"><div style="margin-left:auto;display:flex;gap:8px"><button class="btn" style="background:rgba(255,255,255,.1);border-color:rgba(255,255,255,.25);color:#fff" onclick="logout()">⇥</button></div></div><div style="margin-top:8px"><strong style="font-size:21px">${title}</strong><div class="mobile-user">${subtitle}</div></div></header>`}
function bottom(active){return `<nav class="bottom-nav"><button class="${active==='home'?'active':''}" onclick="roleHome()"><span class="ico">⌂</span>Início</button><button class="${active==='clients'?'active':''}" onclick="seller()"><span class="ico">♙</span>Clientes</button><button class="${active==='orders'?'active':''}" onclick="sellerOrders()"><span class="ico">▣</span>Pedidos</button><button><span class="ico">☰</span>Mais</button></nav>`}
async function renderRole(){const role=document.body.dataset.role;const expected={'Vendedor Externo':'seller','Frente de Loja / PDV':'cashier','Loja Online':'web_client','Motorista':'driver'}[role];if(expected&&me.role!==expected){localStorage.removeItem('xv_token');alert('Esta interface não corresponde ao seu perfil de acesso.');return loginPage()}
if(role==='Vendedor Externo')return seller();if(role==='Frente de Loja / PDV')return pdv();if(role==='Loja Online')return loja();return driver()}
window.openCrmWhatsApp = function(phone, clientName, days, topProductsJson) {
  const cleanPhone = String(phone||'').replace(/\D/g, '');
  if (!cleanPhone) return toastRole('Cliente sem telefone cadastrado.', true);
  let topProducts = [];
  try { topProducts = typeof topProductsJson === 'string' ? JSON.parse(topProductsJson) : (topProductsJson||[]); } catch(e){}
  const prodsText = topProducts && topProducts.length ? topProducts.slice(0, 2).join(' e ') : 'seus produtos habituais';
  const daysText = (days !== null && days !== undefined && days !== '') ? `Faz ${days} dias desde o seu último pedido.` : 'Esperamos que esteja tudo bem!';
  const sellerName = me?.nome || 'Vendedor Externo';
  const msg = encodeURIComponent(`Olá ${clientName}! Aqui é ${sellerName} da Distribuidora Xiquim Vargas. ${daysText} Notamos que ${prodsText} podem estar em baixa no seu estoque. Temos pronta entrega com ótimas condições nesta semana. Gostaria que gerássemos o seu pedido de reposição agora?`);
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
    `, '650px');

    $('#crmInteractionForm').onsubmit = async (e) => {
      e.preventDefault();
      const b = Object.fromEntries(new FormData(e.currentTarget));
      try {
        await api('/api/clients/' + clientId + '/interactions', {
          method: 'POST',
          body: JSON.stringify(b)
        });
        toastRole('Interação registrada com sucesso!');
        closeModal();
        if (typeof sellerRefreshCrm === 'function') sellerRefreshCrm();
      } catch (err) {
        toastRole(err.message, true);
      }
    };
  } catch (err) {
    toastRole(err.message, true);
  }
};

window.sellerRepeatClient = async function(clientId) {
  try {
    toastRole('Recuperando último pedido...');
    const x = await api('/api/clients/' + clientId + '/repeat-last', { method: 'POST', body: '{}' });
    const client = (window.sellerClients || []).find(c => c.id === clientId) || 
                   (window.sellerCrmData?.items || []).find(c => c.id === clientId) || 
                   { id: clientId, razao_social: 'Cliente' };
    await sellerNewOrder(client);
    if (x.itens && x.itens.length) {
      for (const item of x.itens) {
        const p = (window.sellerProducts || []).find(prod => prod.id === item.produto_id);
        if (p) {
          const qty = Math.min(Number(p.quantidade_disponivel || 99999), Number(item.quantidade));
          window.sellerOrderItems.set(p.id, {
            produto_id: p.id,
            quantidade: qty,
            nome: p.nome,
            preco: Number(p.preco_aplicado ?? p.preco_base),
            estoque: Number(p.quantidade_disponivel || 0)
          });
        }
      }
      renderSellerNewOrderCart();
      updateSellerCartFloating();
      toastRole(`Último pedido (${x.itens.length} itens) carregado no carrinho! Revise as quantidades.`);
    }
  } catch (e) {
    toastRole(e.message, true);
  }
};

async function seller(tab = null){
  window.sellerCurrentTab = tab || 'list';
  window.sellerCrmRfmFilter = window.sellerCrmRfmFilter || 'ALL';

  let c, crm;
  try {
    [c, crm] = await Promise.all([
      api('/api/clients'),
      api('/api/crm/dashboard').catch(() => ({ summary: {}, items: [] }))
    ]);
    await offlinePut('kv', 'sellerClients', c.items || []);
    await offlinePut('kv', 'sellerCrm', crm);
  } catch(e) {
    const cachedClients = await offlineGet('kv', 'sellerClients');
    const cachedCrm = await offlineGet('kv', 'sellerCrm');
    if (!cachedClients) throw e;
    c = { items: cachedClients, offline: true };
    crm = cachedCrm || { summary: {}, items: [] };
  }
  window.sellerClients = c.items || [];
  window.sellerCrmData = crm;

  const bairros = Array.from(new Set(window.sellerClients.map(x => x.bairro).filter(Boolean))).sort();

  const body = `
    <div class="mobile-shell">
      <div class="mobile-content">
        ${mobileHeader('Meus Clientes & CRM', `${esc(me.nome)} · Vendedor Externo`)}
        <div class="mobile-nav" style="margin-top:15px">
          <button class="btn primary" onclick="sellerNewClient()">＋ Adicionar cliente</button>
          <button class="btn" onclick="sellerCatalog()">🛒 Catálogo</button>
          <button class="btn" onclick="sellerDashboard()">▦ Painel do mês</button>
          <button class="btn" onclick="sellerOrders()">▣ Pedidos</button>
          <button class="btn" onclick="sellerMyRoutes()">🚚 Minhas Rotas</button>
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-top:16px;margin-bottom:14px;">
          <div style="display:flex;gap:8px;align-items:center;">
            <button type="button" class="crm-tab-btn ${window.sellerCurrentTab==='list'?'active':''}" onclick="window.sellerCurrentTab='list';document.querySelectorAll('.crm-tab-btn').forEach(b=>b.classList.remove('active'));this.classList.add('active');renderSellerClientsUI()">
              📋 Cadastro & Carteira Geral
            </button>
            <button type="button" class="crm-tab-btn ${window.sellerCurrentTab==='crm'?'active':''}" onclick="window.sellerCurrentTab='crm';document.querySelectorAll('.crm-tab-btn').forEach(b=>b.classList.remove('active'));this.classList.add('active');renderSellerClientsUI()">
              📊 Saúde da Carteira (CRM)
            </button>
          </div>
          <span class="muted" id="sellerClientCount" style="font-weight:750;font-size:13px;">${window.sellerClients.length} clientes na carteira</span>
        </div>

        <div class="form" style="display:grid;grid-template-columns:1fr;gap:8px;margin-bottom:14px;">
          <input id="sellerClientSearch" class="search" placeholder="Buscar por cliente, documento, telefone, bairro..." oninput="renderSellerClientsUI()">
          <div style="display:flex;gap:8px;">
            <select id="sellerClientBairro" class="search" style="flex:1;background:#fff;color:#172033;padding:8px;height:40px;border-radius:8px;border:1px solid #dbe3ec" onchange="renderSellerClientsUI()">
              <option value="">Todos os bairros</option>
              ${bairros.map(b=>`<option value="${esc(b)}">${esc(b)}</option>`).join('')}
            </select>
            <select id="sellerClientPeriodo" class="search" style="flex:1;background:#fff;color:#172033;padding:8px;height:40px;border-radius:8px;border:1px solid #dbe3ec;display:${window.sellerCurrentTab==='list'?'block':'none'}" onchange="renderSellerClientsUI()">
              <option value="">Qualquer período</option>
              <option value="7">Últimos 7 dias</option>
              <option value="15">De 8 a 15 dias</option>
              <option value="30">De 16 a 30 dias</option>
              <option value="99">+ 30 dias (ou nunca)</option>
            </select>
          </div>
        </div>

        <div id="sellerClientsContent"></div>
      </div>
      ${bottom('clients')}
    </div>
  `;
  document.body.innerHTML = body;
  renderSellerClientsUI();
}

function renderSellerClientsUI() {
  const tab = window.sellerCurrentTab || 'list';
  const sq = ($('#sellerClientSearch')?.value || '').trim().toLowerCase();
  const bairro = $('#sellerClientBairro')?.value || '';
  const periodoSelect = $('#sellerClientPeriodo');
  if (periodoSelect) periodoSelect.style.display = (tab === 'list' ? 'block' : 'none');

  const content = $('#sellerClientsContent');
  if (!content) return;

  if (tab === 'crm') {
    const crm = window.sellerCrmData || { summary: {}, items: [] };
    const rfmFilter = window.sellerCrmRfmFilter || 'ALL';
    let filtered = crm.items || [];

    if (rfmFilter !== 'ALL') {
      if (rfmFilter === 'EM_RISCO') filtered = filtered.filter(x => x.status_rfm === 'EM_RISCO');
      else if (rfmFilter === 'VIP') filtered = filtered.filter(x => x.status_rfm === 'VIP');
      else if (rfmFilter === 'ATIVO') filtered = filtered.filter(x => x.status_rfm === 'ATIVO');
      else if (rfmFilter === 'INATIVO') filtered = filtered.filter(x => x.status_rfm === 'INATIVO');
      else if (rfmFilter === 'NOVO') filtered = filtered.filter(x => x.status_rfm === 'NOVO');
    }

    if (bairro) {
      filtered = filtered.filter(x => x.bairro === bairro);
    }

    if (sq) {
      filtered = filtered.filter(x =>
        (x.razao_social || '').toLowerCase().includes(sq) ||
        (x.nome_fantasia || '').toLowerCase().includes(sq) ||
        (x.cnpj_cpf || '').toLowerCase().includes(sq) ||
        (x.telefone || '').toLowerCase().includes(sq) ||
        (x.bairro || '').toLowerCase().includes(sq) ||
        (x.cidade || '').toLowerCase().includes(sq)
      );
    }

    const s = crm.summary || {};
    const countEl = $('#sellerClientCount');
    if (countEl) countEl.textContent = `${filtered.length} de ${crm.items?.length || window.sellerClients.length} clientes filtrados`;

    content.innerHTML = `
      <div class="grid" style="margin-bottom:16px;">
        <div class="mobile-card kpi" style="border-top:4px solid var(--xv-brand-navy,#061a4f);">
          <div style="font-size:13px;color:#8193a9;margin-bottom:4px;">👥 Carteira de Clientes</div>
          <div class="v">${s.total_clientes || 0}</div>
          <div style="font-size:11px;color:#64748b;margin-top:4px;">${s.taxa_saude_carteira || 0}% de saúde da base</div>
        </div>
        <div class="mobile-card kpi" style="border-top:4px solid #10b981;">
          <div style="font-size:13px;color:#8193a9;margin-bottom:4px;">🟢 Recorrentes Ativos (≤15d)</div>
          <div class="v" style="color:#10b981;">${s.ativos || 0}</div>
          <div style="font-size:11px;color:#10b981;margin-top:4px;">Comprando no ciclo ideal</div>
        </div>
        <div class="mobile-card kpi" style="border-top:4px solid #f59e0b;">
          <div style="font-size:13px;color:#8193a9;margin-bottom:4px;">⚠️ Em Risco / Churn (16–45d)</div>
          <div class="v" style="color:#f59e0b;">${s.em_risco || 0}</div>
          <div style="font-size:11px;color:#d97706;margin-top:4px;">Atenção: ciclo de recompra atrasado</div>
        </div>
        <div class="mobile-card kpi" style="border-top:4px solid #ef4444;">
          <div style="font-size:13px;color:#8193a9;margin-bottom:4px;">🔴 Inativos / Dormientes (>45d)</div>
          <div class="v" style="color:#ef4444;">${s.inativos || 0}</div>
          <div style="font-size:11px;color:#ef4444;margin-top:4px;">Requerem reativação urgente</div>
        </div>
        <div class="mobile-card kpi" style="border-top:4px solid #8b5cf6;">
          <div style="font-size:13px;color:#8193a9;margin-bottom:4px;">⭐ Clientes VIPs</div>
          <div class="v" style="color:#8b5cf6;">${s.vips || 0}</div>
          <div style="font-size:11px;color:#8b5cf6;margin-top:4px;">Alto faturamento e frequência</div>
        </div>
        <div class="mobile-card kpi" style="border-top:4px solid var(--xv-brand-orange,#f45a08);">
          <div style="font-size:13px;color:#8193a9;margin-bottom:4px;">💰 Ticket Médio Geral</div>
          <div class="v" style="font-size:22px;">${money(s.ticket_medio || 0)}</div>
          <div style="font-size:11px;color:#64748b;margin-top:4px;">Média por pedido concluído</div>
        </div>
      </div>

      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:14px;">
        <span style="font-size:12px;color:#64748b;font-weight:800;">Filtro RFM:</span>
        <button type="button" class="crm-filter-pill ${rfmFilter==='ALL'?'active':''}" onclick="window.sellerCrmRfmFilter='ALL';renderSellerClientsUI()">Todos (${s.total_clientes||0})</button>
        <button type="button" class="crm-filter-pill ${rfmFilter==='EM_RISCO'?'active':''}" style="border-color:#f59e0b;color:${rfmFilter==='EM_RISCO'?'#fff':'#b45309'}" onclick="window.sellerCrmRfmFilter='EM_RISCO';renderSellerClientsUI()">⚠️ Em Risco (${s.em_risco||0})</button>
        <button type="button" class="crm-filter-pill ${rfmFilter==='VIP'?'active':''}" style="border-color:#8b5cf6;color:${rfmFilter==='VIP'?'#fff':'#6d28d9'}" onclick="window.sellerCrmRfmFilter='VIP';renderSellerClientsUI()">⭐ VIPs (${s.vips||0})</button>
        <button type="button" class="crm-filter-pill ${rfmFilter==='ATIVO'?'active':''}" style="border-color:#10b981;color:${rfmFilter==='ATIVO'?'#fff':'#047857'}" onclick="window.sellerCrmRfmFilter='ATIVO';renderSellerClientsUI()">🟢 Ativos (${s.ativos||0})</button>
        <button type="button" class="crm-filter-pill ${rfmFilter==='INATIVO'?'active':''}" style="border-color:#ef4444;color:${rfmFilter==='INATIVO'?'#fff':'#b91c1c'}" onclick="window.sellerCrmRfmFilter='INATIVO';renderSellerClientsUI()">🔴 Inativos (${s.inativos||0})</button>
        <button type="button" class="crm-filter-pill ${rfmFilter==='NOVO'?'active':''}" onclick="window.sellerCrmRfmFilter='NOVO';renderSellerClientsUI()">Novos (${s.novos||0})</button>
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
              if (days !== null && days !== undefined) {
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
                    <button class="btn" style="text-align:left;padding:4px 8px;font-size:13px;" onclick="sellerClientProfile('${x.id}')">
                      <strong>${esc(x.razao_social || x.nome_fantasia)}</strong>
                    </button>
                    <div style="font-size:11px;color:#64748b;margin-top:3px;">
                      ${esc(x.bairro || x.cidade || 'Sem bairro')}${x.telefone ? ' · ' + esc(x.telefone) : ''}
                    </div>
                  </td>
                  <td><span class="crm-badge-rfm ${rfmClass}">${rfmLabel}</span></td>
                  <td>${recBadge}</td>
                  <td>
                    <strong>${money(x.faturamento_total)}</strong>
                    <div style="font-size:11px;color:#64748b;margin-top:2px;">${x.total_pedidos} pedido(s) · Méd: ${money(x.ticket_medio)}</div>
                  </td>
                  <td style="max-width:220px;white-space:normal;">${topChips}</td>
                  <td>${lastIntText}</td>
                  <td style="text-align:right;">
                    <div style="display:inline-flex;gap:5px;align-items:center;flex-wrap:wrap;justify-content:flex-end;">
                      <button class="btn-crm-wpp" title="Conversar no WhatsApp com mensagem inteligente de reposição" onclick="openCrmWhatsApp('${x.telefone||''}', parseJsonArg('${jsonArg(x.razao_social||x.nome_fantasia)}'), ${days!==null&&days!==undefined?days:'null'}, parseJsonArg('${jsonArg(JSON.stringify(x.top_produtos||[]))}'))">📲 WhatsApp</button>
                      <button class="btn" title="Repetir último pedido" style="padding:6px 9px;font-size:12px;" onclick="sellerRepeatClient('${x.id}')">↻ Repetir</button>
                      <button class="btn" title="Linha do Tempo CRM e Registro de Contatos" style="padding:6px 9px;font-size:12px;" onclick="crmInteractionsModal('${x.id}', parseJsonArg('${jsonArg(x.razao_social||x.nome_fantasia)}'))">📝 CRM</button>
                      <button class="btn primary" title="Novo Pedido" style="padding:6px 10px;font-size:12px;" onclick="sellerNewOrder(parseJsonArg('${jsonArg(x)}'))">＋ Pedido</button>
                    </div>
                  </td>
                </tr>
              `;
            }).join('') || '<tr><td colspan="7" class="empty-state">Nenhum cliente encontrado com os filtros selecionados.</td></tr>'}
          </tbody>
        </table>
      </div>
    `;
  } else {
    // Tab Listagem Geral Clássica
    const periodo = $('#sellerClientPeriodo')?.value || '';
    const now = Date.now();
    const msInDay = 86400000;
    const filtered = (window.sellerClients || []).filter(c => {
      if (sq && !(c.razao_social||'').toLowerCase().includes(sq) && !(c.nome_fantasia||'').toLowerCase().includes(sq) && !(c.cnpj_cpf||'').toLowerCase().includes(sq) && !(c.telefone||'').toLowerCase().includes(sq) && !(c.bairro||'').toLowerCase().includes(sq)) return false;
      if (bairro && c.bairro !== bairro) return false;
      if (periodo) {
        if (!c.ultima_compra) {
          if (periodo !== '99') return false;
        } else {
          const t = c.ultima_compra.includes('T') ? c.ultima_compra : (c.ultima_compra.replace(' ','T')+'Z');
          const days = (now - new Date(t).getTime()) / msInDay;
          if (periodo === '7' && days > 7) return false;
          if (periodo === '15' && (days <= 7 || days > 15)) return false;
          if (periodo === '30' && (days <= 15 || days > 30)) return false;
          if (periodo === '99' && days <= 30) return false;
        }
      }
      return true;
    });

    const countEl = $('#sellerClientCount');
    if (countEl) countEl.textContent = `${filtered.length} de ${window.sellerClients.length} clientes na carteira`;

    content.innerHTML = `
      <div id="sellerClientList">
        ${filtered.map(x => `
          <article class="mobile-card client-card">
            <div class="client-icon">🛒</div>
            <div>
              <h3>${esc(x.razao_social || x.nome_fantasia)}</h3>
              <div class="muted">${esc(x.bairro || x.cidade || x.endereco || 'Endereço não informado')}</div>
              ${x.cnpj_cpf ? `<div class="muted" style="font-size:11px;">Doc: ${esc(x.cnpj_cpf)}${x.telefone ? ' · Tel: ' + esc(x.telefone) : ''}</div>` : ''}
              ${x.ultima_compra ? `<div class="muted" style="font-size:11px;margin-top:4px;color:#a26a0c;font-weight:700">Última compra: ${new Date(x.ultima_compra.includes('T')?x.ultima_compra:(x.ultima_compra.replace(' ','T')+'Z')).toLocaleDateString('pt-BR')}</div>` : `<div class="muted" style="font-size:11px;margin-top:4px;font-weight:700">Nunca comprou</div>`}
            </div>
            <div class="client-actions" style="flex-wrap:wrap;gap:6px;">
              <button class="btn" style="font-size:12px;padding:6px 10px;" onclick="crmInteractionsModal('${x.id}', parseJsonArg('${jsonArg(x.razao_social||x.nome_fantasia)}'))">📝 CRM</button>
              <button class="btn" style="font-size:12px;padding:6px 10px;" onclick="sellerRepeatClient('${x.id}')">↻ Repetir</button>
              <button class="btn" style="font-size:12px;padding:6px 10px;" onclick="sellerClientProfile('${x.id}')">Perfil</button>
              <button class="btn primary" style="font-size:12px;padding:6px 10px;" onclick="sellerNewOrder(parseJsonArg('${jsonArg(x)}'))">Novo pedido ›</button>
            </div>
          </article>
        `).join('') || '<div class="empty-state">Nenhum cliente encontrado.</div>'}
      </div>
    `;
  }
}
window.sellerFilterClients = renderSellerClientsUI;
window.renderSellerClientsUI = renderSellerClientsUI;

async function sellerRefreshCrm() {
  try {
    toastRole('Atualizando CRM da carteira...');
    const [c, crm] = await Promise.all([
      api('/api/clients'),
      api('/api/crm/dashboard').catch(() => ({ summary: {}, items: [] }))
    ]);
    window.sellerClients = c.items || [];
    window.sellerCrmData = crm;
    await offlinePut('kv', 'sellerClients', window.sellerClients);
    await offlinePut('kv', 'sellerCrm', window.sellerCrmData);
    renderSellerClientsUI();
    toastRole('CRM e carteira atualizados!');
  } catch (err) {
    toastRole(err.message, true);
  }
}
window.sellerRefreshCrm = sellerRefreshCrm;

async function sellerCatalog(){let p,s,cats;try{[p,s,cats]=await Promise.all([api('/api/products'),api('/api/seller/stock'),api('/api/categories')]);await offlinePut('kv','sellerCatalogProducts',p.items);await offlinePut('kv','sellerCatalogStock',s.items);await offlinePut('kv','sellerCategories',cats)}catch(e){const cp=await offlineGet('kv','sellerCatalogProducts');const cs=await offlineGet('kv','sellerCatalogStock');const ccats=await offlineGet('kv','sellerCategories');if(!cp||!cs||!ccats)throw e;p={items:cp};s={items:cs};cats=ccats}const sm=new Map(s.items.map(x=>[x.id,x]));const products=p.items.map(x=>({...x,...(sm.get(x.id)||{})}));window.sellerCatalogItems=products;window.sellerCategories=cats.categorias;window.sellerSubcategories=cats.subcategorias;window.sellerCatalogMode='DEMO';document.body.innerHTML=`<div class="mobile-shell"><div class="mobile-content">${mobileHeader('Catálogo',`${esc(me.nome)} · Demonstrativo`)}<div class="mobile-nav" style="margin-top:15px"><button class="btn" onclick="seller()">← Voltar</button></div><div id="sellerCatalogRoot"></div></div></div>`;sellerShowCategories()}
function sellerShowCategories(){const cats=window.sellerCategories||[];const html=cats.length?`<div class="grid" style="margin-top:14px;margin-bottom:24px;">${cats.map(c=>`<div class="mobile-card" style="cursor:pointer" onclick="sellerShowSubcategories('${c.id}')"><h3>${esc(c.nome)}</h3><p class="muted">${esc(c.descricao||'')}</p></div>`).join('')}</div>`:'';$('#sellerCatalogRoot').innerHTML=`<div class="section-title"><h2>Catálogo por Categoria</h2></div>${html}<div class="section-title"><h2>Todos os Produtos</h2></div><input class="search" style="margin-bottom:14px;background:#fff;color:#172033;border-color:#dbe3ec" placeholder="Pesquisar produto..." oninput="sellerFilterAll(this)"><div id="sellerProducts" class="product-grid"></div>`;const items=window.sellerCatalogMode==='DEMO'?window.sellerCatalogItems:window.sellerProducts;if(window.sellerCatalogMode==='DEMO')sellerCatalogRender(items);else sellerRender(items)}
function sellerFilterAll(input){const q=(input.value||'').toLowerCase();const items=window.sellerCatalogMode==='DEMO'?window.sellerCatalogItems:window.sellerProducts;const filtered=items.filter(p=>(p.nome+' '+(p.sku||'')+' '+(p.marca||'')).toLowerCase().includes(q));if(window.sellerCatalogMode==='DEMO')sellerCatalogRender(filtered);else sellerRender(filtered)}
function sellerShowSubcategories(catId){const cat=window.sellerCategories.find(c=>c.id===catId);const subs=(window.sellerSubcategories||[]).filter(s=>s.categoria_id===catId);window.sellerCurrentCatId=catId;window.sellerCurrentSubId='';const allItems=window.sellerCatalogMode==='DEMO'?window.sellerCatalogItems:window.sellerProducts;const catItems=(allItems||[]).filter(p=>p.categoria_id===catId);$('#sellerCatalogRoot').innerHTML=`<div class="mobile-nav" style="margin-bottom:14px"><button class="btn" onclick="sellerShowCategories()">← Voltar às categorias</button></div><div class="section-title"><h2>Subcategorias de ${esc(cat?.nome||'')}</h2><span class="muted">${catItems.length} produtos</span></div><div class="grid" style="margin-top:14px;margin-bottom:20px;"><div class="mobile-card" style="cursor:pointer;border-left:4px solid #f97316" onclick="sellerShowProductsSub('','Todos os Produtos (${catItems.length})','${catId}')"><h3>Todos os Produtos</h3><p class="muted">Ver todos os produtos de ${esc(cat?.nome||'')}</p></div>${subs.length?subs.map(s=>{const cnt=(allItems||[]).filter(p=>p.subcategoria_id===s.id).length;return `<div class="mobile-card" style="cursor:pointer" onclick="sellerShowProductsSub('${s.id}','${esc(s.nome).replace(/'/g,"\\'").replace(/"/g,"&quot;")}','${catId}')"><h3>${esc(s.nome)}</h3><p class="muted">${cnt} produtos</p></div>`}).join(''):'<p class="muted">Nenhuma subcategoria.</p>'}</div><div class="section-title"><h2>Produtos em ${esc(cat?.nome||'')}</h2></div><div id="sellerProducts" class="product-grid" style="margin-top:14px"></div>`;if(window.sellerCatalogMode==='DEMO')sellerCatalogRender(catItems);else sellerRender(catItems)}
function sellerShowProductsSub(subId,subName,catId){window.sellerCurrentSubId=subId;window.sellerCurrentCatId=catId;$('#sellerCatalogRoot').innerHTML=`<div class="mobile-nav" style="margin-bottom:14px;display:flex;gap:8px"><button class="btn" onclick="sellerShowSubcategories('${catId||''}')">← Subcategorias</button><button class="btn" onclick="sellerShowCategories()">🏠 Categorias</button></div><div class="section-title"><h2>${esc(subName)}</h2></div><div class="form" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px;"><input id="sellerSubSearch" class="search" style="grid-column:1/-1" placeholder="Pesquisar produto..." oninput="sellerFilterSub()"><div class="field"><label>Menor preço (R$)</label><input type="number" step="0.01" min="0" id="sellerSubMin" class="search" placeholder="0,00" oninput="sellerFilterSub()"></div><div class="field"><label>Maior preço (R$)</label><input type="number" step="0.01" min="0" id="sellerSubMax" class="search" placeholder="Sem limite" oninput="sellerFilterSub()"></div><div style="grid-column:1/-1;display:flex;gap:8px;margin-top:4px;"><button type="button" class="btn" onclick="const s=$('#sellerSubSearch');if(s)s.value='';const mn=$('#sellerSubMin');if(mn)mn.value='';const mx=$('#sellerSubMax');if(mx)mx.value='';sellerFilterSub()">Limpar filtros</button></div></div><div id="sellerProducts" class="product-grid" style="margin-top:14px"></div>`;sellerFilterSub()}
function sellerFilterSub(){const q=($('#sellerSubSearch')?.value||'').trim().toLowerCase();const minRaw=$('#sellerSubMin')?.value;const maxRaw=$('#sellerSubMax')?.value;const min=minRaw!==''&&minRaw!=null?Number(minRaw):0;const max=maxRaw!==''&&maxRaw!=null?Number(maxRaw):Infinity;const subId=window.sellerCurrentSubId;const catId=window.sellerCurrentCatId;const items=window.sellerCatalogMode==='DEMO'?window.sellerCatalogItems:window.sellerProducts;const filtered=(items||[]).filter(x=>{if(catId&&x.categoria_id!==catId)return false;if(subId&&x.subcategoria_id!==subId)return false;const price=Number(x.promocao_preco!=null?x.promocao_preco:(x.preco_aplicado??x.preco_base));if(price<min||price>max)return false;if(q&&!(x.nome+' '+(x.sku||'')+' '+(x.codigo_barras||'')).toLowerCase().includes(q))return false;return true});if(window.sellerCatalogMode==='DEMO')sellerCatalogRender(filtered);else sellerRender(filtered)}
function sellerCatalogRender(items){const el=$('#sellerProducts')||$('#sellerCatalogList');if(el)el.innerHTML=items.map(p=>`<article class="product-card">${productThumbHtml(p,p.marca||'PRODUTO')}<h4>${esc(p.nome)}</h4><div class="muted">${esc(p.tamanho||p.sabor||p.sku||'')}</div><div class="product-price">${money(p.preco_aplicado ?? p.preco_base)}</div>${Number(p.esgotado)?'<div class="promo-label" style="background:#b42318">ESGOTADO</div><button class="btn" disabled>Indisponível</button>':''}</article>`).join('')}
async function sellerDashboard(){try{const x=await api('/api/seller/dashboard/monthly');document.body.innerHTML=`<div class="mobile-shell"><div class="mobile-content">${mobileHeader('Painel do mês',`${esc(me.nome)} · Vendas do mês`)}<div class="mobile-nav" style="margin-top:15px"><button class="btn" onclick="seller()">← Minha carteira</button><button class="btn" onclick="sellerOrders()">▣ Pedidos</button><button class="btn primary" onclick="sellerDashboard()">↻ Atualizar</button></div><div class="grid" style="margin-top:12px"><div class="mobile-card"><small class="muted">Pedidos no mês</small><h2>${Number(x.pedidos||0)}</h2></div><div class="mobile-card"><small class="muted">Valor total dos pedidos</small><h2 class="orange">${money(x.valor_total)}</h2><p class="muted" style="font-size:16px">Valor dos pedidos emitidos, não apenas pagamentos recebidos.</p></div></div><div class="mobile-card" style="margin-top:12px"><strong>${esc(x.mes||'Mês atual')}</strong><p class="muted">Considera os pedidos emitidos por você e os pedidos da sua carteira de clientes neste mês.</p></div></div>${bottom('home')}</div>`}catch(e){alert(e.message)}}
async function sellerMyRoutes(){try{const x=await api('/api/seller/my-routes');const dias=['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];const html=x.items.length?x.items.map(r=>`<article class="mobile-card"><div class="route-status">${dias[r.dia_semana]||'Dia '+r.dia_semana}</div><h3 style="margin:4px 0">${esc(r.nome)}</h3><div class="muted" style="margin-top:6px"><strong>Bairros:</strong> ${r.bairros.length?r.bairros.map(b=>esc(b)).join(', '):'Nenhum bairro cadastrado'}</div></article>`).join(''):'<div class="empty-state">Nenhuma rota designada para você.</div>';document.body.innerHTML=`<div class="mobile-shell"><div class="mobile-content">${mobileHeader('Minhas Rotas',`${esc(me.nome)} · Rotas Designadas`)}<div class="mobile-nav" style="margin-top:15px"><button class="btn" onclick="seller()">← Voltar</button><button class="btn primary" onclick="sellerMyRoutes()">↻ Atualizar</button></div><div class="section-title"><h2>Planejamento da semana</h2><span class="muted">${x.items.length} rotas</span></div>${html}</div>${bottom('clients')}</div>`}catch(e){alert(e.message)}}
async function sellerEditOrder(id){
 try{
  const x=await api('/api/orders/'+id+'/detail'); let products={items:[],total:0}; for(let page=1,done=false;!done;page++){const pg=await api('/api/products?limit=100&page='+page);products.items.push(...pg.items);products.total=pg.total;done=products.items.length>=pg.total||!pg.items.length}
  const o=x.order;if(o.status!=='PENDENTE')return alert('Somente pedidos pendentes podem ser editados pelo vendedor.');
  const existing=new Set(x.items.map(i=>i.produto_id));window.sellerOrderCatalog=products.items.filter(p=>!existing.has(p.id));
  window.sellerOrderItems=new Map(x.items.map(i=>[i.produto_id,{produto_id:i.produto_id,quantidade:Number(i.quantidade),nome:i.produto_nome}]));
  document.body.innerHTML=`<div class="mobile-shell"><div class="mobile-content">${mobileHeader('Editar pedido '+esc(o.numero),`${esc(me.nome)} · ${esc(o.nome_fantasia||o.cliente_nome)}`)}<form id="sellerOrderEditForm" class="mobile-card form" style="margin-top:15px"><div class="field"><label>Modalidade</label><select name="modalidade_entrega"><option value="ENTREGA" ${o.modalidade_entrega==='ENTREGA'?'selected':''}>Entrega</option><option value="RETIRADA" ${o.modalidade_entrega!=='ENTREGA'?'selected':''}>Retirada</option></select></div><div class="field"><label>Desconto</label><input name="desconto_valor" type="number" min="0" step="0.01" value="${Number(o.desconto_valor||0)}"></div><div class="field"><label>Tipo de desconto</label><select name="desconto_tipo"><option value="VALOR" ${o.desconto_tipo!=='PERCENTUAL'?'selected':''}>R$ valor</option><option value="PERCENTUAL" ${o.desconto_tipo==='PERCENTUAL'?'selected':''}>%</option></select></div><div class="field" style="grid-column:1/-1"><label>Observações</label><textarea name="observacoes" rows="3">${esc(o.observacoes||'')}</textarea></div><div class="field" style="grid-column:1/-1"><label>Itens do pedido</label><div id="sellerOrderItems"></div></div><div class="field" style="grid-column:1/-1"><label>Adicionar item do catálogo</label><input id="sellerOrderSearch" class="search" placeholder="Pesquisar produto..." oninput="filterSellerOrderCatalog(this)"><div id="sellerOrderCatalog" class="order-catalog-picker"></div></div><div class="actions" style="grid-column:1/-1"><button type="button" class="btn" onclick="sellerOrders()">Cancelar</button><button class="btn primary">Salvar alterações</button></div></form></div></div>`;
  renderSellerOrderItems();filterSellerOrderCatalog($('#sellerOrderSearch'));
  $('#sellerOrderEditForm').onsubmit=async e=>{e.preventDefault();const f=Object.fromEntries(new FormData(e.currentTarget));const itens=[...window.sellerOrderItems.values()].filter(i=>Number(i.quantidade)>0).map(i=>({produto_id:i.produto_id,quantidade:Number(i.quantidade)}));if(!itens.length)return alert('O pedido precisa manter pelo menos um item.');try{await api('/api/orders/'+id,{method:'PUT',body:JSON.stringify({...f,itens})});alert('Pedido atualizado e PDF regenerado.');sellerOrders()}catch(z){alert(z.message)}}
 }catch(e){alert(e.message)}
}
function renderSellerOrderItems(){const h=$('#sellerOrderItems');if(!h)return;h.innerHTML=[...window.sellerOrderItems.values()].map(i=>`<div class="seller-edit-item"><div style="flex:1"><strong>${esc(i.nome)}</strong></div><input type="number" min="1" max="100000" value="${Number(i.quantidade)}" oninput="window.sellerOrderItems.get('${i.produto_id}').quantidade=Number(this.value)"><button type="button" class="btn danger" onclick="window.sellerOrderItems.delete('${i.produto_id}');renderSellerOrderItems()">Remover</button></div>`).join('')||'<span class="muted">Adicione um item.</span>'}
function filterSellerOrderCatalog(input){const q=(input.value||'').toLowerCase().trim();const items=(window.sellerOrderCatalog||[]).filter(p=>(p.nome+' '+(p.sku||'')+' '+(p.codigo_barras||'')).toLowerCase().includes(q));$('#sellerOrderCatalog').innerHTML=items.map(p=>`<div class="order-catalog-item"><span><strong>${esc(p.nome)}</strong><small>${esc(p.sku||'Sem SKU')} · ${money(p.preco_aplicado??p.preco_base)}</small></span><button type="button" class="btn" onclick="addSellerOrderItem('${p.id}')">Adicionar</button></div>`).join('')||'<span class="muted">Nenhum produto encontrado.</span>'}
function addSellerOrderItem(id){const p=(window.sellerOrderCatalog||[]).find(x=>x.id===id);if(!p)return;if(window.sellerOrderItems.has(id))window.sellerOrderItems.get(id).quantidade+=1;else window.sellerOrderItems.set(id,{produto_id:id,quantidade:1,nome:p.nome});renderSellerOrderItems();filterSellerOrderCatalog($('#sellerOrderSearch'))}
// Miniatura padronizada usada pelo Vendedor Externo e pela Loja Online (object-fit: contain, nunca corta a imagem).
function productThumbHtml(p,label){const fb=esc(label||p.marca||'PRODUTO');return `<div class="product-thumb">${p.foto_url?`<img src="${esc(p.foto_url)}" alt="${esc(p.nome)}" loading="lazy" onerror="this.onerror=null;this.style.display='none';this.nextElementSibling.style.display='grid'"><span class="product-image-fallback" style="display:none">${fb}</span>`:`<span class="product-image-fallback" style="display:grid">${fb}</span>`}</div>`}

function sellerNewClient(){document.body.innerHTML=`<div class="mobile-shell"><div class="mobile-content">${mobileHeader('Adicionar cliente',`${esc(me.nome)} · Vendedor externo`)}<div class="mobile-nav" style="margin-top:15px"><button class="btn" onclick="seller()">← Voltar para clientes</button></div><form id="sellerClientForm" class="mobile-card form" style="margin-top:15px"><div class="field"><label>Nome fantasia</label><input name="nome_fantasia" required></div><div class="field"><label>Razão social (opcional)</label><input name="razao_social"></div><div class="field"><label>CNPJ/CPF</label><input name="cnpj_cpf"></div><div class="field"><label>Email</label><input name="email" type="email"></div><div class="field"><label>Telefone</label><input name="telefone"></div><div class="field"><label>Endereço</label><input name="endereco" required></div><div class="field"><label>Bairro</label><input name="bairro" required></div><div class="field"><label>Cidade</label><input name="cidade"></div><div class="field"><label>Estado</label><input name="estado"></div><div class="actions"><button class="btn" type="button" onclick="seller()">Cancelar</button><button class="btn primary">Salvar cliente</button></div></form></div></div>`;$('#sellerClientForm').onsubmit=async e=>{e.preventDefault();try{const x=await api('/api/clients',{method:'POST',headers:{'Idempotency-Key':'CLIENT-'+crypto.randomUUID()},body:JSON.stringify(Object.fromEntries(new FormData(e.currentTarget)))});if(x.offline){alert('Cliente salvo no aparelho e será enviado quando a rede voltar.');return seller()}alert('Cliente cadastrado.');seller()}catch(err){alert(err.message)}}}
async function sellerClientProfile(id){try{const x=await api('/api/clients/'+id+'/profile');document.body.innerHTML=`<div class="mobile-shell"><div class="mobile-content">${mobileHeader('Perfil do cliente',`${esc(me.nome)} · ${esc(x.client.razao_social)}`)}<div class="mobile-nav" style="margin-top:15px"><button class="btn" onclick="seller()">← Carteira</button><button class="btn primary" onclick="sellerNewOrder(parseJsonArg('${jsonArg(x.client)}'))">＋ Novo pedido</button><button class="btn" onclick="sellerRepeatClient('${id}')">↻ Repetir último pedido</button><button class="btn" onclick="crmInteractionsModal('${id}', parseJsonArg('${jsonArg(x.client.razao_social||x.client.nome_fantasia)}'))">📝 CRM</button>${x.client.telefone?`<button class="btn-crm-wpp" onclick="openCrmWhatsApp('${x.client.telefone}', parseJsonArg('${jsonArg(x.client.razao_social||x.client.nome_fantasia)}'), null, parseJsonArg('${jsonArg(JSON.stringify((x.topProdutos||[]).map(p=>p.nome)))}'))">📲 WhatsApp</button>`:''}</div><div class="grid"><div class="mobile-card"><small>Pedidos</small><h2>${x.summary?.pedidos||0}</h2></div><div class="mobile-card"><small>Faturado</small><h2>${money(x.summary?.faturado)}</h2></div><div class="mobile-card"><small>Em aberto</small><h2>${money(x.summary?.em_aberto)}</h2></div></div><div class="mobile-card"><h3>${esc(x.client.razao_social)}</h3><p class="muted">${esc(x.client.endereco||'')} · ${esc(x.client.bairro||'')} · ${esc(x.client.cidade||'')} ${x.client.telefone?'· Tel: '+esc(x.client.telefone):''}</p></div><div class="mobile-card"><h3>Mais comprados</h3>${x.topProdutos.map(p=>`<p><strong>${esc(p.nome)}</strong> — ${p.quantidade} un. (${money(p.faturamento)})</p>`).join('')||'<p class="muted">Sem histórico concluído.</p>'}</div><div class="mobile-card"><h3>Histórico de pedidos</h3>${x.orders.map(o=>`<p><strong>${esc(o.numero)}</strong> · <span class="badge status-${String(o.status).toLowerCase()}">${esc(o.status)}</span> · <strong>${money(o.total)}</strong> <button class="btn" onclick="downloadAuthFile('/api/orders/${o.id}/pdf','pedido-${o.numero}.pdf')">PDF</button></p>`).join('')||'<p class="muted">Nenhum pedido realizado.</p>'}</div></div>${bottom('clients')}</div>`}catch(e){alert(e.message)}}
async function sellerNewOrder(client){if(!client)return alert('Selecione um cliente na carteira.');window.sellerCurrentClientId=client.id;let p,s,cats;try{[p,s,cats]=await Promise.all([api('/api/products?cliente_id='+encodeURIComponent(client.id)),api('/api/seller/stock'),api('/api/categories')]);await offlinePut('kv','sellerProducts',p.items);await offlinePut('kv','sellerStock',s.items);await offlinePut('kv','sellerCategories',cats)}catch(e){const cp=await offlineGet('kv','sellerProducts');const cs=await offlineGet('kv','sellerStock');const ccats=await offlineGet('kv','sellerCategories');if(!cp||!cs||!ccats)throw e;p={items:cp};s={items:cs};cats=ccats}const sm=new Map(s.items.map(x=>[x.id,x]));window.sellerProducts=p.items.map(x=>({...x,...(sm.get(x.id)||{})}));window.sellerCategories=cats.categorias;window.sellerSubcategories=cats.subcategorias;window.sellerOrderItems=new Map();window.sellerCatalogMode='ORDER';document.body.innerHTML=`<div class="mobile-shell"><div class="mobile-content">${mobileHeader('Novo pedido',`${esc(client.razao_social)} · Vendedor externo`)}<div class="mobile-nav" style="margin-top:15px"><button class="btn" onclick="seller()">← Voltar</button><button class="btn" onclick="sellerOrders()">Pedidos</button></div><div id="sellerCatalogRoot" style="margin-top:12px"></div><section class="mobile-card seller-cart-dashboard" style="margin-top:18px"><div class="section-title"><h2>Carrinho do pedido</h2><span id="sellerCartCount" class="badge">0 itens</span></div><div id="sellerCartItems" class="seller-cart-items"><span class="muted">Nenhum produto selecionado.</span></div><div class="form" style="margin-top:14px"><div class="field"><label>Desconto</label><input id="sellerDiscount" type="number" min="0" step="0.01" value="0"></div><div class="field"><label>Tipo</label><select id="sellerDiscountType"><option value="VALOR">R$ valor</option><option value="PERCENTUAL">%</option></select></div><div class="field" style="grid-column:1/-1"><label>Observação</label><textarea id="sellerObs" rows="2"></textarea></div></div><div class="seller-cart-total"><strong>Total dos itens</strong><strong id="sellerCartSubtotal">${money(0)}</strong></div><button class="btn primary seller-finalize" onclick="submitSellerOrder('${client.id}')">Finalizar pedido e gerar PDF</button></section></div></div>`;sellerShowCategories();renderSellerNewOrderCart();initSellerFloatingCart()}
function sellerRender(items){const el=$('#sellerProducts');if(el)el.innerHTML=items.map(p=>`<article class="product-card" data-seller-product-id="${esc(p.id)}">${productThumbHtml(p,p.marca||'PRODUTO')}<h4>${esc(p.nome)}</h4><div class="muted">${esc(p.tamanho||p.sabor||p.sku||'')}</div><div class="product-price">${money(p.preco_aplicado ?? p.preco_base)}</div>${Number(p.esgotado)?'<div class="promo-label" style="background:#b42318">ESGOTADO</div><button class="btn" disabled>Indisponível</button>':`<div class="muted" style="margin-bottom:8px">Estoque disponível: ${p.quantidade_disponivel ?? 'N/A'}</div><button class="btn primary seller-add-btn" style="width:100%" onclick="addSellerNewOrderItem('${p.id}')">Adicionar ao carrinho</button>`}</article>`).join('')}
function addSellerNewOrderItem(id){const p=(window.sellerProducts||[]).find(x=>x.id===id);if(!p||Number(p.esgotado))return;if(!window.sellerOrderItems)window.sellerOrderItems=new Map();const current=window.sellerOrderItems.get(id);const next=Math.min(Number(p.quantidade_disponivel||99999),Number(current?.quantidade||0)+1);window.sellerOrderItems.set(id,{...p,produto_id:id,quantidade:next,nome:p.nome,preco:priceForLine(p,next),estoque:Number(p.quantidade_disponivel||0)});renderSellerNewOrderCart();updateSellerCartFloating();flashSellerProductAdded(id)}
function flashSellerProductAdded(id){const card=document.querySelector(`[data-seller-product-id="${CSS.escape(id)}"]`);if(!card)return;card.classList.remove('seller-product-added');void card.offsetWidth;card.classList.add('seller-product-added');const btn=card.querySelector('.seller-add-btn');if(btn){const original=btn.textContent;btn.textContent='✓ Adicionado';btn.classList.add('seller-add-confirm');clearTimeout(btn._confirmTimer);btn._confirmTimer=setTimeout(()=>{btn.textContent=original;btn.classList.remove('seller-add-confirm')},900)}}
function updateSellerCartFloating(){const count=[...(window.sellerOrderItems?.values()||[])].reduce((n,i)=>n+i.quantidade,0);const el=$('#sellerFloatingCartCount');if(el)el.textContent=count;const label=$('#sellerFloatingCartLabel');if(label)label.textContent=count?`${count} ${count===1?'item':'itens'}`:'Carrinho'}
function openSellerFloatingCart(){const items=[...(window.sellerOrderItems?.values()||[])];const subtotal=items.reduce((n,i)=>n+i.quantidade*i.preco,0);const count=items.reduce((n,i)=>n+i.quantidade,0);const existing=$('#sellerFloatingCartModal');if(existing)existing.remove();document.body.insertAdjacentHTML('beforeend',`<div id="sellerFloatingCartModal" class="seller-cart-overlay" onclick="if(event.target===this)closeSellerFloatingCart()"><aside class="seller-floating-cart"><div class="panel-title"><h2>Carrinho do pedido</h2><button type="button" class="btn" onclick="closeSellerFloatingCart()">×</button></div><div class="seller-floating-count"><strong>${count} ${count===1?'item':'itens'}</strong></div><div class="seller-floating-items">${items.length?items.map(i=>`<div class="seller-floating-line"><div><strong>${esc(i.nome)}</strong><div class="muted">${money(i.preco)} · estoque ${i.estoque}</div></div><div class="seller-floating-controls"><button type="button" class="btn" onclick="changeSellerNewOrderQty('${i.produto_id}',-1);openSellerFloatingCart()">−</button><strong>${i.quantidade}</strong><button type="button" class="btn" onclick="changeSellerNewOrderQty('${i.produto_id}',1);openSellerFloatingCart()">+</button><button type="button" class="btn danger" onclick="removeSellerNewOrderItem('${i.produto_id}');openSellerFloatingCart()">Remover</button></div></div>`).join(''):'<div class="empty-state">Nenhum produto adicionado.</div>'}</div><div class="form seller-floating-form"><div class="field"><label>Desconto</label><div class="seller-discount-row"><span>Tipo</span><select id="sellerFloatingDiscountType" onchange="syncSellerFloatingDiscount()"><option value="VALOR">R$ valor</option><option value="PERCENTUAL">%</option></select><input id="sellerFloatingDiscount" type="number" min="0" step="0.01" value="${esc($('#sellerDiscount')?.value||0)}" oninput="syncSellerFloatingDiscount()"></div></div><div class="field"><label>Observação</label><textarea id="sellerFloatingObs" rows="2" oninput="syncSellerFloatingObs()">${esc($('#sellerObs')?.value||'')}</textarea></div></div><div class="seller-floating-total"><strong>Total dos itens</strong><strong>${money(subtotal)}</strong></div><button class="btn primary seller-finalize" onclick="closeSellerFloatingCart();submitSellerOrder(window.sellerCurrentClientId)" ${items.length?'':'disabled'}>Finalizar pedido e gerar PDF</button></aside></div>`);const type=$('#sellerDiscountType'),ft=$('#sellerFloatingDiscountType');if(type&&ft)ft.value=type.value}
function closeSellerFloatingCart(){document.querySelector('#sellerFloatingCartModal')?.remove()}
function syncSellerFloatingDiscount(){const source=$('#sellerFloatingDiscount'),type=$('#sellerFloatingDiscountType');const target=$('#sellerDiscount'),targetType=$('#sellerDiscountType');if(source&&target)target.value=source.value;if(type&&targetType)targetType.value=type.value}
function syncSellerFloatingObs(){const source=$('#sellerFloatingObs'),target=$('#sellerObs');if(source&&target)target.value=source.value}

function changeSellerNewOrderQty(id,delta){const item=window.sellerOrderItems?.get(id);if(!item)return;const next=Math.max(0,Math.min(item.estoque||99999,item.quantidade+delta));if(!next)window.sellerOrderItems.delete(id);else{item.quantidade=next;item.preco=priceForLine(item,next)}renderSellerNewOrderCart()}
function removeSellerNewOrderItem(id){window.sellerOrderItems?.delete(id);renderSellerNewOrderCart()}
function renderSellerNewOrderCart(){const host=$('#sellerCartItems');if(!host)return;const items=[...(window.sellerOrderItems?.values()||[])];const count=items.reduce((n,i)=>n+i.quantidade,0);const subtotal=items.reduce((n,i)=>n+i.quantidade*i.preco,0);$('#sellerCartCount').textContent=`${count} ${count===1?'item':'itens'}`;$('#sellerCartSubtotal').textContent=money(subtotal);host.innerHTML=items.length?items.map(i=>`<div class="seller-cart-line"><div class="seller-cart-info"><strong>${esc(i.nome)}</strong><span class="muted">${money(i.preco)} · estoque ${i.estoque}</span></div><div class="seller-cart-controls"><button type="button" class="btn" onclick="changeSellerNewOrderQty('${i.produto_id}',-1)">−</button><strong>${i.quantidade}</strong><button type="button" class="btn" onclick="changeSellerNewOrderQty('${i.produto_id}',1)">+</button><button type="button" class="btn danger" onclick="removeSellerNewOrderItem('${i.produto_id}')">Remover</button></div></div>`).join(''):'<span class="muted">Nenhum produto selecionado. Use "Adicionar ao carrinho" no catálogo acima.</span>'}
function initSellerFloatingCart(){if(!document.querySelector('#sellerFloatingCart'))document.body.insertAdjacentHTML('beforeend',`<button id="sellerFloatingCart" class="seller-floating-cart-btn" type="button" aria-label="Abrir carrinho do pedido" onclick="openSellerFloatingCart()"><span class="seller-cart-icon">🛒</span><span id="sellerFloatingCartLabel">Carrinho</span><b id="sellerFloatingCartCount">0</b></button>`);updateSellerCartFloating()}
function sellerFilter(i){sellerRender(window.sellerProducts.filter(x=>(x.nome+' '+x.sku+' '+(x.marca||'')).toLowerCase().includes(i.value.toLowerCase())))}
async function submitSellerOrder(clientId){
  const itens=[...(window.sellerOrderItems?.values()||[])].filter(x=>x.quantidade>0).map(x=>({produto_id:x.produto_id,quantidade:Number(x.quantidade)}));
  if(!itens.length)return toastRole('Adicione pelo menos um produto ao carrinho.',true);
  window.sellerOrderItems=new Map();
  closeSellerFloatingCart();
  toastRole('Enviando pedido...');
  sellerOrders();
  Realtime.emit('orders_changed');
  Realtime.emit('stock_changed');
  try{
    const x=await api('/api/orders',{method:'POST',body:JSON.stringify({cliente_id:clientId,itens,origem:'VENDEDOR',desconto_tipo:$('#sellerDiscountType')?.value||'VALOR',desconto_valor:Number($('#sellerDiscount')?.value||0),observacoes:$('#sellerObs')?.value||''}),headers:{'Idempotency-Key':'SELLER-'+crypto.randomUUID()}});
    toastRole(x.offline?'Pedido salvo offline.':'✓ Pedido '+x.item.numero+' criado e PDF gerado!');
    roleRealtimeRefresh('orders_changed');
  }catch(e){toastRole(e.message,true)}
}
async function sellerStock(){const x=await api('/api/seller/stock');document.body.innerHTML=`<div class="mobile-shell"><div class="mobile-content">${mobileHeader('Estoque disponível',`${esc(me.nome)} · Somente consulta`)}<div class="mobile-nav" style="margin-top:15px"><button class="btn" onclick="seller()">← Clientes</button><button class="btn" onclick="sellerOrders()">▣ Pedidos</button><button class="btn primary" onclick="sellerStock()">↻ Atualizar</button></div><div class="mobile-card"><input id="sellerStockSearch" class="search" style="background:#fff;color:#172033" placeholder="Pesquisar produto" oninput="sellerStockFilter(this)"></div><div id="sellerStockList">${x.items.map(sellerStockRow).join('')}</div></div></div>`}
function sellerStockRow(x){return `<article class="mobile-card seller-stock-row" data-search="${esc((x.nome+' '+x.sku+' '+(x.descricao||'')).toLowerCase())}"><div class="route-row">${x.foto_url?`<img class="catalog-mini-photo" src="${esc(x.foto_url)}" alt="${esc(x.nome)}" onerror="this.style.display='none'">`:`<div class="client-icon">◉</div>`}<div><h3>${esc(x.nome)}</h3><div class="muted">SKU: ${esc(x.sku)}</div><div class="muted">${esc(x.descricao||'Sem descrição')}</div></div><strong class="orange">${x.quantidade_disponivel}</strong></div></article>`}
function sellerStockFilter(i){const q=i.value.toLowerCase();document.querySelectorAll('.seller-stock-row').forEach(x=>x.style.display=x.dataset.search.includes(q)?'':'none')}
async function sellerOrders(){let x;try{x=await api('/api/orders');await offlinePut('kv','sellerOrders',x)}catch(e){x=await offlineGet('kv','sellerOrders')||{items:[]}}document.body.innerHTML=`<div class="mobile-shell"><div class="mobile-content">${mobileHeader('Meus pedidos',`${esc(me.nome)} · Apenas pedidos do vendedor`)}<div class="mobile-nav" style="margin-top:15px"><button class="btn" onclick="seller()">♙ Clientes</button><button class="btn" onclick="sellerDashboard()">▦ Painel do mês</button></div><div class="section-title"><h2>Histórico</h2><span class="muted">${x.items.length} pedidos</span></div>${x.items.map(o=>`<article class="mobile-card" style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;gap:10px"><strong>${esc(o.numero)}</strong><span class="badge status-${String(o.status).toLowerCase()}">${esc(({PENDENTE:'Pendente',SEPARACAO:'Em separação',ROTA:'Em rota',CONCLUIDO:'Concluído'})[o.status]||o.status)}</span></div><h3 style="margin-top:8px">${esc(o.cliente_nome)}</h3><div class="muted">${new Date(o.created_at).toLocaleString('pt-BR')} · ${esc(o.origem)}</div><div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px"><strong class="orange" style="font-size:20px">${money(o.total)}</strong>${o.status==='PENDENTE'?`<button class="btn primary" onclick="sellerEditOrder('${o.id}')">Editar pedido</button>`:''}<button class="btn" onclick="downloadAuthFile('/api/orders/${o.id}/pdf','pedido-${o.numero}.pdf')">Ver PDF</button></div></article>`).join('')}</div>${bottom('orders')}</div>`}
function pdvGetDefaultClient(){return (window.pdvClients||[]).find(x=>x.id==='CLIENTE-BALCAO'||x.razao_social==='Cliente Balcão')||{id:'CLIENTE-BALCAO',razao_social:'Cliente Balcão'}}
function pdvResetClient(){const def=pdvGetDefaultClient();const hidden=$('#pdvClient'),search=$('#pdvClientSearch'),badge=$('#pdvClientBadge'),drop=$('#pdvClientDropdown');if(hidden)hidden.value=def.id;if(search)search.value=def.razao_social||'Cliente Balcão';if(badge)badge.textContent='Cliente Balcão (Padrão)';if(drop)drop.style.display='none';toastRole('Cliente redefinido para Cliente Balcão')}
async function pdvSelectClient(id){const c=(window.pdvClients||[]).find(x=>x.id===id);if(!c)return;const hidden=$('#pdvClient'),search=$('#pdvClientSearch'),badge=$('#pdvClientBadge'),drop=$('#pdvClientDropdown');if(hidden)hidden.value=c.id;const name=c.razao_social||c.nome_fantasia||'Cliente';if(search)search.value=name;const isDefault=c.id==='CLIENTE-BALCAO'||name==='Cliente Balcão';if(badge)badge.textContent=isDefault?'Cliente Balcão (Padrão)':name;if(drop)drop.style.display='none';if(id!=='CLIENTE-BALCAO'){try{const result=await api('/api/products?cliente_id='+encodeURIComponent(id));const byId=new Map(result.items.map(product=>[product.id,product]));window.pdvProducts=window.pdvProducts.map(product=>({...product,...(byId.get(product.id)||{})}));pdvRender([]);pdvCartRender()}catch(error){toastRole('Nao foi possivel atualizar os precos deste cliente. O servidor recalculara ao finalizar.',true)}}}
function pdvClientFocus(){const search=$('#pdvClientSearch');if(search)pdvClientInput(search)}
function pdvClientInput(input){const q=String(input?.value||'').trim().toLowerCase();const drop=$('#pdvClientDropdown');if(!drop)return;if(!q){pdvResetClient();drop.style.display='none';return}const items=(window.pdvClients||[]).filter(c=>(c.razao_social||'').toLowerCase().includes(q)||(c.nome_fantasia||'').toLowerCase().includes(q)||(c.cnpj_cpf||'').toLowerCase().includes(q)||(c.telefone||'').toLowerCase().includes(q)||(c.bairro||'').toLowerCase().includes(q));if(!items.length){drop.innerHTML='<div style="padding:12px;color:#718198;text-align:center">Nenhum cliente encontrado</div>';drop.style.display='block';return}drop.innerHTML=items.slice(0,15).map(c=>`<div class="pdv-client-option" onclick="pdvSelectClient('${c.id}')"><strong>${esc(c.razao_social||c.nome_fantasia)}</strong><small>${esc(c.cnpj_cpf||'Sem documento')}${c.telefone?' · '+esc(c.telefone):''}${c.bairro?' · '+esc(c.bairro):''}</small></div>`).join('');drop.style.display='block'}
function pdvClientFilter(input){return pdvClientInput(input)}
function pdvClientKeydown(event){if(event.key==='Escape'){const drop=$('#pdvClientDropdown');if(drop)drop.style.display='none'}}
function pdvRemoveItem(id){delete window.pdvCart[id];pdvCartRender()}
async function pdvPrintOrder(orderId,orderNum){try{const reqId=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10);const r=await fetch('/api/orders/'+orderId+'/pdf',{headers:{'x-request-id':reqId,...(token?{authorization:'Bearer '+token}:{})}});if(!r.ok)throw new Error('Não foi possível gerar o cupom para impressão');const b=await r.blob();const blobUrl=URL.createObjectURL(b);const printWin=window.open(blobUrl,'_blank');if(printWin)printWin.focus();else{const a=document.createElement('a');a.href=blobUrl;a.target='_blank';a.download=`cupom-${orderNum||'pedido'}.pdf`;a.click()}setTimeout(()=>URL.revokeObjectURL(blobUrl),60000)}catch(e){toastRole(e.message,true)}}
async function pdv(){
 let c,p,s;
 try{
   [c,p,s]=await Promise.all([api('/api/clients'),api('/api/products'),api('/api/stock')]);
   await offlinePut('kv','pdvClients',c.items||[]);
   await offlinePut('kv','pdvProducts',p.items||[]);
   await offlinePut('kv','pdvStock',s.items||[]);
 }catch(e){
   const cp=await offlineGet('kv','pdvClients');
   const pp=await offlineGet('kv','pdvProducts');
   const sp=await offlineGet('kv','pdvStock');
   if(!cp||!pp)throw e;
   c={items:cp,offline:true};
   p={items:pp,offline:true};
   s={items:sp||[],offline:true};
 }
 const sm=new Map(s.items.map(x=>[x.id,x]));window.pdvClients=c.items;window.pdvProducts=p.items.map(x=>({...x,...(sm.get(x.id)||{})}));window.pdvCart={};
 const defaultClient=pdvGetDefaultClient();
 document.body.innerHTML=`<div class="pdv-shell dark-pdv"><header class="pdv-top"><img class="xv-logo" src="/assets/brand/logo-pdv.jpg" alt="Xiquim Vargas Frente de Loja"><div class="pdv-title">PDV – Frente de Loja</div><div style="display:flex;align-items:center;gap:12px;color:#b7c2cf"><span>◷ ${new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</span><span>${esc(me.nome)}</span><button type="button" class="btn" title="Reimprimir último cupom emitido" onclick="pdvReprintLast()">🖨️ Reimprimir</button><button type="button" class="btn" aria-label="Sair da conta" onclick="logout()">⇥</button></div></header><main class="pdv-layout"><section class="pdv-left"><input id="pdvSearch" class="pdv-search" placeholder="▥ Código de barras ou nome do produto... F2" oninput="pdvFilter(this)"><div class="pdv-barcode-tools"><div class="pdv-barcode-row"><button type="button" id="pdvBarcodeButton" class="btn" onclick="togglePdvBarcode()">▣ Ler código de barras</button><div class="field"><label>Quantidade</label><input id="pdvBarcodeQty" type="number" min="1" max="99999" step="1" value="1" inputmode="numeric"></div></div><div id="pdvBarcodeStatus" class="muted">Leitor opcional. Conecte leitor físico USB/Bluetooth para bipagem contínua.</div><input id="pdvBarcodeInput" class="pdv-barcode-input" type="text" inputmode="numeric" autocomplete="off" spellcheck="false" placeholder="Clique em Ler código de barras para bipagem contínua" onkeydown="pdvBarcodeKeydown(event)"></div><div style="display:flex;justify-content:space-between;margin:14px 0 8px;color:#95a4b6;font-size:16px;font-weight:800"><span>PRODUTOS ENCONTRADOS</span><span id="pdvCount">0 resultado(s)</span></div><div id="pdvProducts" class="pdv-results"></div></section><section class="pdv-right"><div class="pdv-order"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><h2 style="margin:0">PEDIDO ATUAL</h2><button class="btn" onclick="pdvClear()">Limpar pedido</button></div><div id="pdvOrderList" class="pdv-order-list"></div><div class="pdv-total"><div style="display:flex;justify-content:space-between;color:#a8b4c2"><span>TOTAL DO PEDIDO</span><span id="pdvUnits">0 (un)</span></div><div class="amount" id="pdvTotal">R$ 0,00</div></div><div class="pdv-client-bar-wrap"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><label class="pdv-client-label" style="margin:0;font-size:13px;font-weight:800;color:#95a4b6">CLIENTE DO PEDIDO</label><span id="pdvClientBadge" class="pdv-client-badge">Cliente Balcão (Padrão)</span></div><div class="pdv-client-input-group"><input id="pdvClientSearch" class="search pdv-client-search" type="text" autocomplete="off" spellcheck="false" placeholder="Digite o nome, razão social, CPF/CNPJ ou bairro..." value="${esc(defaultClient.razao_social||'Cliente Balcão')}" oninput="pdvClientInput(this)" onfocus="pdvClientFocus()" onkeydown="pdvClientKeydown(event)"><button type="button" id="pdvClientClearBtn" class="pdv-client-clear-btn" title="Remover cliente e retornar ao Cliente Balcão" onclick="pdvResetClient()">✕</button></div><input type="hidden" id="pdvClient" value="${defaultClient.id}"><div id="pdvClientDropdown" class="pdv-client-dropdown" style="display:none"></div></div><div class="form" style="margin-top:10px"><div class="field"><label>Modalidade do pedido</label><select id="pdvFulfillment"><option value="RETIRADA" selected>Retirada no balcão</option><option value="ENTREGA">Entrega</option></select></div><div class="field"><label>Forma de pagamento</label><select id="pdvPayment" onchange="pdvPaymentUI()"><option value="">Selecionar</option><option value="DINHEIRO">Dinheiro</option><option value="DEBITO">Cartão de débito</option><option value="CREDITO">Cartão de crédito</option><option value="PIX">PIX</option></select></div></div><div id="pdvPaymentCard" class="mobile-card" style="margin-top:8px"></div><button id="pdvReceived" class="btn" style="width:100%;margin-top:8px" onclick="togglePdvReceived()">Pagamento: Não recebido</button><textarea id="pdvObs" class="search" style="margin-top:8px;width:100%" rows="2" placeholder="Observação do pedido"></textarea><button class="pdv-final" style="margin-top:10px" onclick="submitPDV()">▣ Finalizar e Imprimir Cupom</button></div></section></main></div>`;
 if(!window._pdvOutsideListener){window._pdvOutsideListener=true;document.addEventListener('click',e=>{const wrap=e.target.closest('.pdv-client-bar-wrap');const drop=$('#pdvClientDropdown');if(!wrap&&drop)drop.style.display='none'})}
 if(!window._pdvBarcodeGlobalListener){window._pdvBarcodeGlobalListener=true;window.addEventListener('keydown',e=>{if(!window.pdvBarcodeActive)return;const input=$('#pdvBarcodeInput');if(!input||input.dataset.active!=='1')return;const activeEl=document.activeElement;const tag=activeEl?activeEl.tagName.toLowerCase():'';const id=activeEl?activeEl.id:'';if((tag==='input'||tag==='textarea'||tag==='select')&&id!=='pdvBarcodeInput')return;if(activeEl!==input)input.focus()})}
 pdvRender([]);pdvPaymentUI();
}
function pdvPaymentUI(){const f=$('#pdvPayment')?.value,c=$('#pdvPaymentCard');if(!c)return;if(f==='DINHEIRO')c.innerHTML='<strong>Dinheiro</strong><div class="field"><label>Valor recebido</label><input id="pdvReceivedValue" type="number" min="0" step="0.01" oninput="pdvChange()"></div><div id="pdvChange" class="product-price">Troco: R$ 0,00</div>';else if(f==='DEBITO')c.innerHTML='<strong>Débito</strong><p class="muted" style="margin:4px 0 0">Cartão de débito</p>';else if(f==='CREDITO')c.innerHTML='<strong>Crédito</strong><div class="field"><label>Modalidade</label><select id="pdvCreditMode" onchange="pdvCreditUI()"><option value="A_VISTA">À vista</option><option value="PARCELADO">Parcelado</option></select></div><div id="pdvParcelas"></div>';else if(f==='PIX')c.innerHTML='<strong>PIX</strong><p class="muted" style="margin:4px 0 0">Chave ou QR Code PIX para recebimento imediato.</p>';else c.innerHTML='<span class="muted">Selecione a forma de pagamento.</span>'}
function pdvCreditUI(){const x=$('#pdvParcelas');if(!x)return;x.innerHTML=$('#pdvCreditMode').value==='PARCELADO'?'<div class="field"><label>Parcelas</label><select id="pdvInstallments">'+Array.from({length:11},(_,i)=>`<option value="${i+2}">${i+2}x</option>`).join('')+'</select></div>':''}
function pdvChange(){const total=Object.entries(window.pdvCart||{}).reduce((s,[id,q])=>{const p=window.pdvProducts.find(x=>x.id===id);return s+Number(q)*priceForLine(p,q)},0);const rec=Number($('#pdvReceivedValue')?.value||0);if($('#pdvChange'))$('#pdvChange').textContent='Troco: '+money(Math.max(0,rec-total))}
function togglePdvReceived(){const b=$('#pdvReceived');if(!b)return;const on=b.dataset.received==='1';b.dataset.received=on?'0':'1';b.textContent='Pagamento: '+(on?'Não recebido':'Recebido');b.classList.toggle('good',!on)}
function togglePdvBarcode(){const input=$('#pdvBarcodeInput'),button=$('#pdvBarcodeButton'),status=$('#pdvBarcodeStatus');if(!input||!button)return;const active=input.dataset.active==='1';input.dataset.active=active?'0':'1';window.pdvBarcodeActive=!active;button.classList.toggle('good',!active);button.textContent=active?'▣ Ler código de barras':'■ Leitor ativo — bipagem contínua';status.textContent=active?'Leitor desativado. Clique para ativar.':'Leitor contínuo ATIVO. Pode ler produtos seguidos com o leitor físico sem clicar novamente.';if(!active){input.value='';input.focus()}}
function pdvBarcodeKeydown(event){if(event.key!=='Enter')return;event.preventDefault();const input=event.currentTarget;if(input.dataset.active!=='1')return;const code=String(input.value||'').trim();if(!code)return;pdvReadBarcode(code)}
async function pdvReadBarcode(code){const input=$('#pdvBarcodeInput'),qtyInput=$('#pdvBarcodeQty');const qty=Math.max(1,Math.min(99999,Number(qtyInput?.value||1)));if(!Number.isInteger(qty)){toastRole('Quantidade inválida.',true);qtyInput?.focus();return}const clienteId=$('#pdvClient')?.value||'CLIENTE-BALCAO';try{const x=await api('/api/pdv/barcode?code='+encodeURIComponent(code)+'&cliente_id='+encodeURIComponent(clienteId));const p=x.item;if(Number(p.esgotado)){toastRole(`Produto esgotado: ${p.nome}`,true);return}const available=Number(p.quantidade_disponivel||0);if(available<qty){toastRole(`Estoque insuficiente para ${p.nome}. Disponível: ${available}.`,true);return}const existing=Number(window.pdvCart[p.id]||0);if(existing+qty>available){toastRole(`A quantidade de ${p.nome} ultrapassa o estoque disponível.`,true);return}const cached=window.pdvProducts.find(x=>x.id===p.id);window.pdvProducts=cached?window.pdvProducts.map(x=>x.id===p.id?{...x,...p}:x):[...window.pdvProducts,p];window.pdvCart[p.id]=existing+qty;if(qtyInput)qtyInput.value='1';pdvRender([]);pdvCartRender();toastRole(`✓ ${p.nome} (+${qty})`)}catch(e){toastRole(e.message==='Código de barras não cadastrado'?'Código não cadastrado':e.message,true)}finally{if(input&&input.dataset.active==='1'){input.value='';input.focus()}}}
function pdvFilter(i){const q=i.value.trim().toLowerCase();if(!q){$('#pdvCount').textContent='0 resultado(s)';return pdvRender([])}const items=window.pdvProducts.filter(x=>(x.nome+' '+(x.sku||'')+' '+(x.codigo_barras||'')).toLowerCase().includes(q));$('#pdvCount').textContent=items.length+' resultado(s)';pdvRender(items)}
function pdvRender(items){$('#pdvProducts').innerHTML=items.map(p=>`<article class="pdv-product" ${Number(p.esgotado)?'style="opacity:.45;cursor:not-allowed" title="Produto esgotado"':`onclick="pdvAdd('${p.id}')"`}><div class="pdv-thumb">${esc(p.marca||'')}</div><div><h4>${esc(p.nome)}${Number(p.esgotado)?' <span style="color:#ff6b6b;font-size:16px">ESGOTADO</span>':''}</h4><small>${esc(p.tamanho||'')} · Estoque: ${p.quantidade_disponivel} un</small><br><small>Cód: ${esc(p.codigo_barras||p.sku||'-')}</small></div><div class="price">${money(p.preco_aplicado ?? p.preco_base)}</div></article>`).join('')}
function pdvAdd(id){const p=window.pdvProducts.find(x=>x.id===id);if(!p||Number(p.esgotado))return;window.pdvCart[id]=(window.pdvCart[id]||0)+1;if(window.pdvCart[id]>p.quantidade_disponivel)window.pdvCart[id]=p.quantidade_disponivel;const s=$('#pdvSearch');if(s){s.value='';$('#pdvCount').textContent='0 resultado(s)'}pdvRender([]);s?.focus();pdvCartRender()}
function pdvClear(){window.pdvCart={};pdvCartRender()}
function pdvCartRender(){const rows=Object.entries(window.pdvCart).filter(([,q])=>q>0).map(([id,q],i)=>{const p=window.pdvProducts.find(x=>x.id===id),unit=priceForLine(p,q),total=q*unit;return `<div class="pdv-row"><span class="num">${String(i+1).padStart(2,'0')}</span><div><strong>${esc(p.nome)}</strong><br><small style="color:#9aa8b7">Cód: ${esc(p.codigo_barras||p.sku||'-')}</small></div><div class="qty-control"><button onclick="pdvQty('${id}',-1)">−</button><span>${q}</span><button onclick="pdvQty('${id}',1)">＋</button></div><strong style="color:var(--xv-orange)">${money(total)}</strong><button type="button" class="pdv-btn-remove" title="Remover item" aria-label="Remover item" onclick="pdvRemoveItem('${id}')">✕</button></div>`}).join('');$('#pdvOrderList').innerHTML=rows||'<div style="padding:30px;text-align:center;color:#718198">Adicione produtos ao pedido usando a lista ao lado.</div>';const total=Object.entries(window.pdvCart).reduce((s,[id,q])=>{const p=window.pdvProducts.find(x=>x.id===id);return s+q*priceForLine(p,q)},0);const units=Object.values(window.pdvCart).reduce((s,x)=>s+x,0);$('#pdvTotal').textContent=money(total);$('#pdvUnits').textContent=units+' (un)'}
function pdvQty(id,delta){const p=window.pdvProducts.find(x=>x.id===id);window.pdvCart[id]=Math.max(0,Math.min(p.quantidade_disponivel,(window.pdvCart[id]||0)+delta));pdvCartRender()}
async function submitPDV(){
  const itens=Object.entries(window.pdvCart).filter(([,q])=>q>0).map(([produto_id,quantidade])=>({produto_id,quantidade}));
  if(!itens.length)return toastRole('O pedido está vazio.',true);
  const clientId=$('#pdvClient')?.value||'CLIENTE-BALCAO';
  if($('#pdvFulfillment').value==='ENTREGA'){
    const client=window.pdvClients.find(x=>x.id===clientId);
    if(!String(client?.endereco||'').trim())return toastRole('Este cliente não possui endereço cadastrado.',true);
  }
  const forma=$('#pdvPayment').value;
  const payload={
    cliente_id:clientId,
    itens,
    origem:'BALCAO',
    modalidade_entrega:$('#pdvFulfillment').value,
    forma_pagamento:forma||null,
    pagamento_status:$('#pdvReceived').dataset.received==='1'?'RECEBIDO':'NAO_RECEBIDO',
    valor_recebido:Number($('#pdvReceivedValue')?.value||0)||null,
    cartao_modalidade:$('#pdvCreditMode')?.value||null,
    parcelas:$('#pdvCreditMode')?.value==='PARCELADO'?Math.max(2,Math.min(12,Number($('#pdvInstallments')?.value||2))):1,
    observacoes:$('#pdvObs')?.value||''
  };

  const total=Object.entries(window.pdvCart).reduce((s,[id,q])=>{
    const p=window.pdvProducts.find(x=>x.id===id);
    return s+q*Number(p?.preco_aplicado??p?.preco_base??0);
  },0);

  itens.forEach(it=>{
    const prod=window.pdvProducts.find(p=>p.id===it.produto_id);
    if(prod&&prod.quantidade_disponivel!=null){
      prod.quantidade_disponivel=Math.max(0,Number(prod.quantidade_disponivel)-Number(it.quantidade));
    }
  });

  window.pdvCart={};
  pdvResetClient();
  if($('#pdvSearch'))$('#pdvSearch').value='';
  if($('#pdvCount'))$('#pdvCount').textContent='0 resultado(s)';
  pdvRender([]);
  if($('#pdvBarcodeQty'))$('#pdvBarcodeQty').value='1';
  if($('#pdvPayment')){$('#pdvPayment').value='';pdvPaymentUI()}
  const rcv=$('#pdvReceived');
  if(rcv){rcv.dataset.received='0';rcv.textContent='Pagamento: Não recebido';rcv.classList.remove('good')}
  if($('#pdvObs'))$('#pdvObs').value='';
  if($('#pdvReceivedValue'))$('#pdvReceivedValue').value='';
  if($('#pdvChange'))$('#pdvChange').textContent='Troco: R$ 0,00';
  if($('#pdvFulfillment'))$('#pdvFulfillment').value='RETIRADA';
  pdvCartRender();

  const bInput=$('#pdvBarcodeInput');
  if(bInput&&bInput.dataset.active==='1'){bInput.value='';bInput.focus()}

  toastRole('Enviando pedido...');
  Realtime.emit('orders_changed');
  Realtime.emit('stock_changed');

  try{
    const x=await api('/api/orders',{method:'POST',headers:{'Idempotency-Key':'PDV-'+crypto.randomUUID()},body:JSON.stringify(payload)});
    if(x.offline){
      toastRole('✓ Pedido gravado offline no PDV! Sincronizará automaticamente com a rede.');
    }else{
      window.pdvLastOrder=x.item;
      toastRole('✓ Pedido '+x.item.numero+' gerado com sucesso!');
      if(x.item?.id){
        pdvPrintOrder(x.item.id,x.item.numero);
      }
    }
    const orderList=$('#pdvOrderList');
    if(orderList){
      orderList.innerHTML=`<div class="pdv-sale-alert xv-flash-updated"><div style="font-size:28px">✓</div><h3 style="color:#10b981;margin:6px 0;font-size:17px">Venda Realizada com Sucesso!</h3><p style="color:#95a4b6;margin:4px 0">${itens.length} produto(s) · <strong style="color:#fff">${money(total)}</strong> · ${x.offline?'Status: <b>Salvo Offline</b>':`Pedido #${esc(x.item?.numero||'')}`}</p><div style="display:flex;gap:8px;justify-content:center;margin-top:12px;flex-wrap:wrap">${x.offline?'':'<button class="btn pdv-print-btn" onclick="pdvPrintOrder(\''+x.item?.id+'\',\''+esc(x.item?.numero||'')+'\')">🖨️ Imprimir Cupom Térmico</button>'}<button class="btn" onclick="pdvCartRender()">＋ Iniciar Novo Pedido</button></div></div><div style="padding:15px;text-align:center;color:#718198">Caixa pronto para o próximo cliente. Adicione produtos na lista.</div>`;
    }
  }catch(e){toastRole(e.message,true)}
}

async function loja(){const [c,p,sc,cats]=await Promise.all([api('/api/clients'),api('/api/products'),api('/api/store-config'),api('/api/categories')]);const cfg=sc.config||{};window.lojaProducts=p.items;window.lojaCategories=cats.categorias;window.lojaSubcategories=cats.subcategorias;window.lojaCart=window.lojaCart||{};const activeIds=new Set(window.lojaProducts.map(x=>x.id));const removed=Object.keys(window.lojaCart).filter(id=>!activeIds.has(id));for(const id of removed)delete window.lojaCart[id];if(removed.length)setTimeout(()=>alert(`${removed.length} produto(s) indisponível(is) foram removidos automaticamente do carrinho.`),0);window.lojaClientId=c.items[0]?.id||'';if(window.lojaClientId){try{const priced=await api('/api/products?cliente_id='+encodeURIComponent(window.lojaClientId));window.lojaProducts=priced.items}catch(error){console.warn('Falha ao atualizar precos da loja',error)}}document.body.innerHTML=`<div><header class="store-header"><img class="xv-logo" src="/assets/brand/logo-online.jpg" alt="Xiquim Vargas"><nav class="store-links"><button class="store-nav active" onclick="lojaCatalogo()">Catálogo</button><button class="store-nav" onclick="lojaPedidos()">Pedidos</button><button class="store-nav" onclick="lojaPerfil()">Perfil</button></nav><div class="store-actions"><span>♙ ${esc(me.nome)}</span><button class="btn cart-button" onclick="openCart()">🛒 <b id="cartCount">0</b></button><button class="btn" onclick="logout()">⇥</button></div></header><main id="storeMain"></main><footer class="store-footer"><strong>Xiquim Vargas</strong><div style="margin-top:7px">${esc(cfg['store.footer']||'Pedido, catálogo e operação integrados.')}</div></footer><div id="cartDrawer"></div></div>`;window.storeCfg=cfg;lojaCatalogo()}

function lojaNav(active){document.querySelectorAll('.store-nav').forEach(b=>b.classList.toggle('active',b.textContent.toLowerCase().startsWith(active)))}
function lojaDashboard(){return lojaCatalogo()}
function storeHeroHtml(){const cfg=window.storeCfg||{};const cover=cfg['store.cover'];return `<section class="store-cover-hero"${cover?` style="background-image:url('${esc(cover)}')"`:''}><div class="store-cover-content"><h1>${esc(cfg['store.title']||'Catálogo Xiquim Vargas')}</h1><h2>${esc(cfg['store.subtitle']||'')}</h2><p>${esc(cfg['store.hero']||'')}</p></div></section>`}
async function lojaCatalogo(){lojaNav('cat');const cats=window.lojaCategories||[];const catCards=cats.length?`<div class="grid" style="margin-top:14px;margin-bottom:24px;">${cats.map(c=>`<div class="mobile-card" style="cursor:pointer" onclick="lojaSubcategorias('${c.id}')"><h3>${esc(c.nome)}</h3><p class="muted">${esc(c.descricao||'')}</p></div>`).join('')}</div>`:'';$('#storeMain').innerHTML=`${storeHeroHtml()}<section class="store-main">${catCards}<div class="section-title"><h2>Catálogo de Produtos</h2></div><div class="form" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px;"><input id="storeSearch" class="search" style="grid-column:1/-1" placeholder="Pesquisar produto por nome, marca ou SKU..." oninput="lojaFilter()"><div class="field"><label>Menor preço (R$)</label><input type="number" step="0.01" min="0" id="storeMin" class="search" placeholder="0,00" onkeydown="if(event.key==='Enter')lojaFilter()"></div><div class="field"><label>Maior preço (R$)</label><input type="number" step="0.01" min="0" id="storeMax" class="search" placeholder="Sem limite" onkeydown="if(event.key==='Enter')lojaFilter()"></div><div style="grid-column:1/-1;display:flex;gap:8px;margin-top:4px;"><button type="button" class="btn primary" style="flex:1" onclick="lojaFilter()">🔍 Filtrar por preço</button><button type="button" class="btn" onclick="lojaClearFilters()">Limpar filtros</button></div></div><div id="storeProducts" class="product-grid" style="margin-top:14px"></div></section>`;lojaFilter()}
function lojaClearFilters(){const s=$('#storeSearch');if(s)s.value='';const mn=$('#storeMin');if(mn)mn.value='';const mx=$('#storeMax');if(mx)mx.value='';lojaFilter()}
function lojaSubcategorias(catId){const cat=window.lojaCategories.find(c=>c.id===catId);const subs=(window.lojaSubcategories||[]).filter(s=>s.categoria_id===catId);window.lojaCurrentCatId=catId;const catItems=(window.lojaProducts||[]).filter(p=>p.categoria_id===catId);$('#storeMain').innerHTML=`${storeHeroHtml()}<section class="store-main"><div class="mobile-nav" style="margin-bottom:14px"><button class="btn" onclick="lojaCatalogo()">← Todas as Categorias</button></div><div class="section-title"><h2>${esc(cat?.nome||'Categoria')}</h2><span class="badge">${catItems.length} produtos</span></div><div class="grid" style="margin-top:14px;margin-bottom:20px;"><div class="mobile-card" style="cursor:pointer;border-left:4px solid #f97316" onclick="lojaProdutosSub('','Todos os Produtos (${catItems.length})','${catId}')"><h3>Todos os Produtos</h3><p class="muted">Ver toda a linha de ${esc(cat?.nome||'')}</p></div>${subs.length?subs.map(s=>{const cnt=(window.lojaProducts||[]).filter(p=>p.subcategoria_id===s.id).length;return `<div class="mobile-card" style="cursor:pointer" onclick="lojaProdutosSub('${s.id}','${esc(s.nome).replace(/'/g,"\\'").replace(/"/g,"&quot;")}','${catId}')"><h3>${esc(s.nome)}</h3><p class="muted">${cnt} produtos</p></div>`}).join(''):'<p class="muted">Nenhuma subcategoria encontrada.</p>'}</div><div class="section-title"><h2>Produtos em ${esc(cat?.nome||'')}</h2></div><div id="storeProducts" class="product-grid" style="margin-top:14px"></div></section>`;lojaRender(catItems)}
function lojaProdutosSub(subId,subName,catId){window.lojaCurrentSubId=subId;window.lojaCurrentCatId=catId;$('#storeMain').innerHTML=`${storeHeroHtml()}<section class="store-main"><div class="mobile-nav" style="margin-bottom:14px;display:flex;gap:8px"><button class="btn" onclick="lojaSubcategorias('${catId||''}')">← Subcategorias</button><button class="btn" onclick="lojaCatalogo()">🏠 Categorias</button></div><div class="section-title"><h2>${esc(subName)}</h2></div><div class="form" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px;"><input id="storeSubSearch" class="search" style="grid-column:1/-1" placeholder="Pesquisar produto por nome, marca ou SKU..." oninput="lojaFilterSub()"><div class="field"><label>Menor preço (R$)</label><input type="number" step="0.01" min="0" id="storeSubMin" class="search" placeholder="0,00" oninput="lojaFilterSub()"></div><div class="field"><label>Maior preço (R$)</label><input type="number" step="0.01" min="0" id="storeSubMax" class="search" placeholder="Sem limite" oninput="lojaFilterSub()"></div><div style="grid-column:1/-1;display:flex;gap:8px;margin-top:4px;"><button type="button" class="btn primary" style="flex:1" onclick="lojaFilterSub()">🔍 Filtrar por preço</button><button type="button" class="btn" onclick="lojaClearSubFilters()">Limpar filtros</button></div></div><div id="storeProducts" class="product-grid" style="margin-top:14px"></div></section>`;lojaFilterSub()}
function lojaFilterSub(){const q=($('#storeSubSearch')?.value||'').trim().toLowerCase();const minRaw=$('#storeSubMin')?.value;const maxRaw=$('#storeSubMax')?.value;const min=minRaw!==''&&minRaw!=null?Number(minRaw):0;const max=maxRaw!==''&&maxRaw!=null?Number(maxRaw):Infinity;const subId=window.lojaCurrentSubId;const catId=window.lojaCurrentCatId;const filtered=(window.lojaProducts||[]).filter(x=>{if(catId&&x.categoria_id!==catId)return false;if(subId&&x.subcategoria_id!==subId)return false;const price=Number(x.promocao_preco!=null?x.promocao_preco:(x.preco_aplicado??x.preco_base));if(price<min||price>max)return false;if(q&&!(x.nome+' '+(x.sku||'')+' '+(x.marca||'')+' '+(x.codigo_barras||'')).toLowerCase().includes(q))return false;return true;});lojaRender(filtered)}
function lojaClearSubFilters(){const s=$('#storeSubSearch');if(s)s.value='';const mn=$('#storeSubMin');if(mn)mn.value='';const mx=$('#storeMax');if(mx)mx.value='';lojaFilterSub()}
async function lojaPedidos(){lojaNav('ped');const x=await api('/api/orders');$('#storeMain').innerHTML=`<section class="store-main"><div class="section-title"><h2>Pedidos</h2><span class="muted">Histórico da sua conta</span></div>${x.items.map(o=>`<article class="mobile-card" style="margin-bottom:10px"><strong>${esc(o.numero)}</strong><span class="badge">${esc(o.status)}</span><p>${new Date(o.created_at).toLocaleString('pt-BR')} · ${money(o.total)}</p><div class="actions"><button class="btn" onclick="storeViewOrder('${o.id}')">Ver pedido</button><button class="btn" onclick="downloadAuthFile('/api/orders/${o.id}/pdf','pedido-${o.numero}.pdf')">PDF</button><button class="btn primary" onclick="storeRepeatOrder('${o.id}')">↻ Repetir pedido</button></div></article>`).join('')||'<div class="empty-state">Nenhum pedido.</div>'}</section>`}
async function storeViewOrder(id){try{const x=await api('/api/orders/'+id+'/detail');const o=x.order;storeOrderModal('Pedido '+esc(o.numero),`<div class="panel"><strong>${esc(o.cliente_nome||'')}</strong><p class="muted">${new Date(o.created_at).toLocaleString('pt-BR')} · ${esc(o.modalidade_entrega==='ENTREGA'?'Entrega':'Retirada')}</p></div><div class="tablewrap"><table class="table"><thead><tr><th>Produto</th><th>Quantidade</th><th>Preço</th><th>Total</th></tr></thead><tbody>${x.items.map(i=>`<tr><td>${esc(i.produto_nome)}</td><td>${i.quantidade}</td><td>${money(i.preco_unitario_aplicado)}</td><td>${money(i.subtotal)}</td></tr>`).join('')}</tbody></table></div><div class="actions" style="margin-top:12px"><button class="btn" onclick="document.querySelector('#storeOrderModal')?.remove()">Fechar</button><button class="btn primary" onclick="storeRepeatOrder('${id}');document.querySelector('#storeOrderModal')?.remove()">↻ Repetir pedido</button></div>`)}catch(e){toastStore(e.message)}}

function storeOrderModal(title,body){const old=$('#storeOrderModal');old?.remove();const d=document.createElement('div');d.id='storeOrderModal';d.className='store-order-modal';d.innerHTML=`<div class="store-order-overlay" onclick="if(event.target===this)document.querySelector('#storeOrderModal')?.remove()"><section class="store-order-dialog"><div class="panel-title"><h2>${title}</h2><button class="btn" onclick="document.querySelector('#storeOrderModal')?.remove()">×</button></div>${body}</section></div>`;document.body.appendChild(d)}
async function lojaPerfil(){lojaNav('per');try{const x=await api('/api/store/profile');const p=x.item;$('#storeMain').innerHTML=`<section class="store-main"><div class="mobile-card"><h2>Meu perfil</h2><p class="muted">${esc(p.email)}</p><form id="storeProfileForm" class="form" style="margin-top:14px"><div class="field"><label>Nome</label><input value="${esc(p.nome)}" disabled></div><div class="field"><label>Telefone</label><input name="telefone" type="tel" maxlength="40" value="${esc(p.telefone||p.cliente_telefone||'')}" required></div><div class="field" style="grid-column:1/-1"><label>Endereço</label><input name="endereco" autocomplete="street-address" maxlength="240" value="${esc(p.endereco||'')}" required></div><div class="field"><label>Bairro</label><input name="bairro" maxlength="120" value="${esc(p.bairro||'')}" required></div><div class="field"><label>Cidade</label><input value="${esc(p.cidade||'')}" disabled></div><div class="field"><label>Estado</label><input value="${esc(p.estado||'')}" disabled></div><div class="actions" style="grid-column:1/-1"><button class="btn primary">Salvar perfil</button></div></form></div></section>`;$('#storeProfileForm').onsubmit=async e=>{e.preventDefault();const b=Object.fromEntries(new FormData(e.currentTarget));try{const saved=await api('/api/store/profile',{method:'PUT',body:JSON.stringify(b)});me.telefone=saved.item.telefone;toastStore('Perfil atualizado com sucesso.')}catch(err){alert(err.message)}}}catch(e){$('#storeMain').innerHTML=`<section class="store-main"><div class="mobile-card"><h2>Meu perfil</h2><p>${esc(e.message)}</p></div></section>`}}
async function refreshStorePrices(clientId){try{window.lojaClientId=clientId;const p=await api('/api/products?cliente_id='+encodeURIComponent(clientId));window.lojaProducts=p.items;lojaFilter()}catch(e){alert(e.message)}}
function lojaFilter(){const q=($('#storeSearch')?.value||'').trim().toLowerCase();const minRaw=$('#storeMin')?.value;const maxRaw=$('#storeMax')?.value;const min=minRaw!==''&&minRaw!=null?Number(minRaw):0;const max=maxRaw!==''&&maxRaw!=null?Number(maxRaw):Infinity;const filtered=(window.lojaProducts||[]).filter(x=>{const price=Number(x.promocao_preco!=null?x.promocao_preco:(x.preco_aplicado??x.preco_base));if(price<min||price>max)return false;if(q&&!(x.nome+' '+(x.sku||'')+' '+(x.marca||'')+' '+(x.codigo_barras||'')).toLowerCase().includes(q))return false;return true;});lojaRender(filtered)}
function lojaRender(items){$('#storeProducts').innerHTML=items.map(p=>`<article class="product-card">${productThumbHtml(p,p.marca||'XV')}<h4>${esc(p.nome)}</h4><div class="muted">${esc(p.descricao||[p.tamanho,p.sabor].filter(Boolean).join(' · ')||p.categoria_nome||'Produto')}</div>${p.preco_tabela!=null&&Number(p.quantidade_minima)>1?`<div class="promo-label">Tabela: ${money(p.preco_tabela)} a partir de ${p.quantidade_minima} unidades</div>`:''}${p.promocao_preco!=null&&!(p.preco_tabela!=null&&Number(p.quantidade_minima)<=1)?`<div class="promo-label">PROMOÇÃO</div><div><span class="muted strike">R$ ${Number(p.preco_base).toFixed(2)}</span> <span class="product-price">R$ ${Number(p.promocao_preco).toFixed(2)}</span></div>`:`<div class="product-price">${money(p.preco_aplicado ?? p.preco_base)}</div>`}${Number(p.esgotado)?'<div class="quantity-line"><button class="btn" disabled style="width:100%;opacity:.7;cursor:not-allowed">Esgotado</button></div>':`<div class="quantity-line"><input id="qty-${p.id}" type="number" min="1" max="99999" value="1" class="search quantity-input" style="background:#fff;color:#172033"><button class="btn primary" onclick="addToCart('${p.id}')">Adicionar</button></div>`}</article>`).join('')}
function addToCart(id){const p=window.lojaProducts.find(x=>x.id===id);const input=$('#qty-'+id);const raw=Number(input?.value||1);const q=Number.isFinite(raw)?Math.max(1,Math.min(99999,Math.floor(raw))):1;if(!p||Number(p.esgotado))return;const current=Number(window.lojaCart[id]||0);const next=Math.min(99999,current+q);const added=next-current;window.lojaCart[id]=next;updateCartCount();toastStore(added<q?'Limite de 99.999 unidades por produto atingido.':`${added} unidade(s) adicionada(s) ao carrinho`)}
function updateCartCount(){const n=Object.values(window.lojaCart||{}).reduce((a,x)=>a+Number(x),0);const el=$('#cartCount');if(el)el.textContent=n}
function toastStore(m){let t=$('#storeToast');if(!t){t=document.createElement('div');t.id='storeToast';t.className='toast';document.body.appendChild(t)}t.textContent=m;t.style.display='block';setTimeout(()=>t.style.display='none',1800)}
function openCart(){const rows=Object.entries(window.lojaCart||{}).filter(([,q])=>q>0).map(([id,q])=>{const p=window.lojaProducts.find(x=>x.id===id);if(!p)return '';const price=priceForLine(p,q);return `<div class="cart-row"><div class="cart-product-info"><strong>${esc(p.nome)}</strong><small>${money(price)} por unidade</small><div class="cart-qty-controls"><button type="button" aria-label="Diminuir quantidade" onclick="changeCartQty('${id}',-1)">−</button><span>${q}</span><button type="button" aria-label="Aumentar quantidade" onclick="changeCartQty('${id}',1)">＋</button></div></div><div class="cart-line-total"><strong>${money(q*price)}</strong><button class="btn cart-remove" onclick="removeFromCart('${id}')">Remover</button></div></div>`}).join('');const total=Object.entries(window.lojaCart||{}).reduce((s,[id,q])=>{const p=window.lojaProducts.find(x=>x.id===id);return s+(p?Number(q)*priceForLine(p,q):0)},0);modalStoreCart(rows,total)}
function modalStoreCart(rows,total){const d=$('#cartDrawer');d.innerHTML=`<div class="cart-overlay" onclick="if(event.target===this)closeCart()"><aside class="cart-drawer"><div class="panel-title"><h2>Seu carrinho</h2><button type="button" class="btn" aria-label="Fechar carrinho" onclick="closeCart()">×</button></div>${rows||'<div class="empty-state">Seu carrinho está vazio.</div>'}<div class="cart-total"><span>Total</span><strong>${money(total)}</strong></div>${rows?`<div class="field" style="margin-top:12px"><label>Forma de pagamento</label><select id="lojaPayment" onchange="window.lojaPaymentUI&&window.lojaPaymentUI()"><option value="" disabled selected>Selecionar</option><option value="DINHEIRO">Dinheiro</option><option value="DEBITO">Cartão de débito</option><option value="CREDITO">Cartão de crédito</option><option value="PIX">PIX</option></select></div><div id="lojaPaymentCard"></div>`:''}<button class="btn primary" style="width:100%;margin-top:12px" onclick="submitLoja()" ${rows?'':'disabled'}>Finalizar pedido</button></aside></div>`}
function closeCart(){$('#cartDrawer').innerHTML=''}
function changeCartQty(id,delta){const current=Number(window.lojaCart?.[id]||0);if(!current)return;window.lojaCart[id]=Math.max(1,Math.min(99999,current+delta));updateCartCount();openCart()}
async function storeRepeatOrder(orderId){try{const detail=await api('/api/orders/'+orderId+'/detail');const currentProducts=[];let page=1,total=Infinity;while(currentProducts.length<total){const products=await api('/api/products?cliente_id='+encodeURIComponent(window.lojaClientId)+'&limit=100&page='+page);currentProducts.push(...(products.items||[]));total=Number(products.total||0);if(!products.items?.length)break;page++}const availability=await api('/api/store/availability?ids='+encodeURIComponent(detail.items.map(i=>i.produto_id).join(',')));window.lojaAvailability=new Map((availability.items||[]).map(x=>[x.produto_id,x]));window.lojaProducts=currentProducts;const active=new Map(currentProducts.map(p=>[p.id,p]));const valid=[],missing=[];for(const i of detail.items){const product=active.get(i.produto_id),a=window.lojaAvailability.get(i.produto_id),available=product&&a&&!Number(a.esgotado)?Math.max(0,Number(a.quantidade_disponivel)||0):0;if(!product||available<=0){missing.push(`${i.produto_nome}: indisponível/esgotado`);continue}const q=Math.min(Number(i.quantidade),available);valid.push({...i,quantidade_repetir:q});if(q<Number(i.quantidade))missing.push(`${i.produto_nome}: solicitado ${i.quantidade}, disponível ${q}`)}if(missing.length){if(!valid.length||!confirm(`Alguns itens não estão disponíveis na quantidade original:\n\n${missing.join('\n')}\n\nDeseja repetir apenas os itens disponíveis, respeitando o estoque atual?`))return}if(!valid.length)return alert('Nenhum item deste pedido está disponível no momento.');const merge=Object.values(window.lojaCart||{}).some(q=>Number(q)>0)?confirm('Deseja mesclar os itens deste pedido com o carrinho atual?\n\nOK = mesclar\nCancelar = substituir o carrinho atual'):false;if(!merge)window.lojaCart={};for(const i of valid){const q=Number(i.quantidade_repetir);if(Number.isInteger(q)&&q>0)window.lojaCart[i.produto_id]=Math.min(99999,Number(window.lojaCart[i.produto_id]||0)+q)}updateCartCount();lojaCatalogo();openCart()}catch(e){alert(e.message)}}
function removeFromCart(id){delete window.lojaCart[id];updateCartCount();openCart()}
window.lojaPaymentUI=function(){const f=$('#lojaPayment')?.value,c=$('#lojaPaymentCard');if(!c)return;if(f==='CREDITO'){c.innerHTML='<div class="field" style="margin-top:10px"><label>Modalidade Crédito</label><select id="lojaCreditMode" onchange="window.lojaCreditUI&&window.lojaCreditUI()"><option value="A_VISTA">À vista</option><option value="PARCELADO">Parcelado</option></select></div><div id="lojaParcelas"></div>';}else{c.innerHTML='';}};
window.lojaCreditUI=function(){const x=$('#lojaParcelas');if(!x)return;x.innerHTML=$('#lojaCreditMode').value==='PARCELADO'?'<div class="field" style="margin-top:10px"><label>Parcelas</label><select id="lojaInstallments">'+Array.from({length:11},(_,i)=>`<option value="${i+2}">${i+2}x</option>`).join('')+'</select></div>':'';};
async function submitLoja(){
  const itens=Object.entries(window.lojaCart||{}).filter(([,q])=>q>0).map(([produto_id,quantidade])=>({produto_id,quantidade}));
  if(!itens.length)return toastRole('Seu carrinho está vazio.',true);
  const forma=$('#lojaPayment')?.value;
  if(!forma)return toastRole('Selecione uma forma de pagamento.',true);
  const payload={
    cliente_id:window.lojaClientId,
    itens,
    origem:'WEB',
    forma_pagamento:forma
  };
  if(forma==='CREDITO'){
    payload.cartao_modalidade=$('#lojaCreditMode')?.value||'A_VISTA';
    if(payload.cartao_modalidade==='PARCELADO'){
      payload.parcelas=Number($('#lojaInstallments')?.value||2);
    }else{
      payload.parcelas=1;
    }
  }

  window.lojaCart={};
  closeCart();
  updateCartCount();
  toastRole('Pedido realizado com sucesso!');
  Realtime.emit('orders_changed');
  Realtime.emit('stock_changed');

  try{
    const x=await api('/api/orders',{
      method:'POST',
      headers:{'Idempotency-Key':`WEB-${Date.now()}-${Math.random().toString(36).slice(2,8)}`},
      body:JSON.stringify(payload)
    });
    toastRole(`✓ Pedido ${x.item.numero} registrado! Visualize em Pedidos.`);
    roleRealtimeRefresh('orders_changed');
  }catch(e){toastRole(e.message,true)}
}
async function driver(){
 let r,o;
 try{
   [r,o]=await Promise.all([api('/api/logistics/routes'),api('/api/orders')]);
   await offlinePut('kv','driverRoutes',r.items||[]);
   await offlinePut('kv','driverOrders',o.items||[]);
 }catch(e){
   const cr=await offlineGet('kv','driverRoutes');
   const co=await offlineGet('kv','driverOrders');
   if(!cr||!co)throw e;
   r={items:cr,offline:true};
   o={items:co,offline:true};
 }
 const byId=new Map(o.items.map(x=>[x.id,x]));const activeRoutes=r.items.filter(route=>route.status!=='CONCLUIDA');const stops=activeRoutes.flatMap(route=>{let ids=[];try{ids=JSON.parse(route.sequencia_json||'[]')}catch{};return ids.map((id,i)=>({id,order:byId.get(id),route,i}))}).filter(x=>x.order&&x.order.status!=='CONCLUIDO');const routeNames=new Map(activeRoutes.map(x=>[x.id,x]));document.body.innerHTML=`<div class="mobile-shell mobile-dark"><div class="mobile-content">${mobileHeader('Fila do dia',`${esc(me.nome)} · Logística interna`,'/assets/brand/logo-admin.jpg',true)}<div class="mobile-nav" style="margin-top:15px"><button class="btn primary" onclick="driver()">↻ Atualizar fila</button><button class="btn" onclick="driverCompletedRoutes()">✓ Rotas concluídas</button><button class="btn" onclick="logout()">Sair</button></div><div class="mobile-card" style="margin-bottom:12px"><div class="route-status">Operação de entrega</div><h2 style="margin:5px 0">${stops.length} parada(s) na fila</h2><div class="muted">A sequência foi definida pela Torre de Controle. Abra o mapa, entregue e conclua.</div></div>${stops.length?stops.map((s,idx)=>{const address=s.order.endereco||s.order.cliente_endereco||'Endereço não informado';const route=routeNames.get(s.route.id);const phone=s.order.cliente_telefone||s.order.telefone||'';const cleanPhone=String(phone).replace(/\D/g,'');const waUrl=cleanPhone.length>=10?`https://wa.me/55${cleanPhone}?text=${encodeURIComponent('Olá '+s.order.cliente_nome+', sou o motorista responsável pela entrega do seu pedido '+s.order.numero+'.')}`:'';return `<article class="route-card"><div class="route-row"><div class="route-number">${idx+1}</div><div style="flex:1"><div class="route-status">${esc(route?.nome||'Rota')} · Parada ${idx+1}</div><h3 style="margin:4px 0;color:#14203a">${esc(s.order.cliente_nome)}</h3><div class="muted">${esc(address)}</div><div class="muted" style="margin-top:5px">Pedido ${esc(s.order.numero)} · ${money(s.order.total)}</div></div></div><div class="route-contact" style="display:flex;gap:8px;margin-top:10px;align-items:center;flex-wrap:wrap">${cleanPhone?`<a class="btn" style="flex:1;background:#25D366;color:#fff;border-color:#25D366;font-size:12px;padding:6px 10px;text-align:center;display:inline-flex;align-items:center;justify-content:center;gap:5px;font-weight:700" target="_blank" href="${waUrl}">💬 WhatsApp</a><a class="btn" style="flex:1;background:#0284c7;color:#fff;border-color:#0284c7;font-size:12px;padding:6px 10px;text-align:center;display:inline-flex;align-items:center;justify-content:center;gap:5px;font-weight:700" href="tel:${cleanPhone}">📞 Ligar (${esc(phone)})</a>`:`<span class="badge" style="font-size:11px;background:rgba(255,255,255,0.08);color:#94a3b8;padding:4px 8px">Sem telefone cadastrado</span>`}</div><div class="route-actions" style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap"><a class="btn" style="flex:1;min-width:85px;text-align:center" target="_blank" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}">⌖ Maps</a><label class="btn" style="flex:1;min-width:85px;text-align:center">📷 Canhoto<input type="file" accept="image/png,image/jpeg" capture="environment" hidden onchange="uploadProof('${s.id}',this)"></label><button class="btn danger" style="flex:1;min-width:115px;background:#ef4444;color:#fff;border-color:#ef4444;text-align:center" onclick="openFailStopModal('${s.id}','${esc(s.order.numero)}','${esc(s.order.cliente_nome)}')">✕ Não concluída</button><button class="btn good" style="flex:1;min-width:95px;text-align:center" onclick="completeDriver('${s.id}')">✓ Concluído</button></div></article>`}).join(''):'<div class="mobile-card empty-state">Nenhuma parada pendente. As rotas concluídas ficam disponíveis em <strong>Rotas concluídas</strong>.</div>'}</div></div>`}
async function driverCompletedRoutes(){try{const x=await api('/api/logistics/completed-routes');const groups=x.groups||[];document.body.innerHTML=`<div class="mobile-shell mobile-dark"><div class="mobile-content">${mobileHeader('Rotas concluídas',`${esc(me.nome)} · Histórico de entregas`,'/assets/brand/logo-admin.jpg',true)}<div class="mobile-nav" style="margin-top:15px"><button class="btn" onclick="driver()">← Fila do dia</button><button class="btn primary" onclick="driverCompletedRoutes()">↻ Atualizar</button><button class="btn" onclick="logout()">Sair</button></div>${groups.length?groups.map(g=>`<section class="driver-history-day"><div class="section-title"><h2>${formatDriverDate(g.data)}</h2><span class="badge">${g.rotas.length} ${g.rotas.length===1?'rota':'rotas'}</span></div>${g.rotas.map(route=>`<article class="mobile-card completed-route-card"><div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start"><div><div class="route-status">Rota concluída</div><h3 style="margin:4px 0">${esc(route.nome||'Rota')}</h3><div class="muted">Realizada em ${formatDriverDateTime(route.concluida_em||route.updated_at)}</div></div><strong>${route.stops.length} ${route.stops.length===1?'parada':'paradas'}</strong></div><div class="completed-stop-list">${route.stops.map(stop=>`<div class="completed-stop"><span class="route-number">${stop.ordem}</span><div style="flex:1"><strong>${esc(stop.cliente_nome)}</strong><div class="muted">Pedido ${esc(stop.pedido_numero)} · ${money(stop.total)}</div><div class="muted">${esc(stop.endereco||'Endereço não informado')}${stop.bairro?` · ${esc(stop.bairro)}`:''}</div></div><span class="badge status-concluido">Concluída</span></div>`).join('')}</div></article>`).join('')}</section>`).join(''):'<div class="mobile-card empty-state">Nenhuma rota concluída registrada.</div>'}</div></div>`}catch(e){alert(e.message)}}
function formatDriverDate(date){if(!date)return 'Data não informada';const d=new Date(String(date).length===10?date+'T12:00:00':date);return Number.isNaN(d.getTime())?esc(date):d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'})}
function formatDriverDateTime(date){if(!date)return 'Horário não informado';const d=new Date(date);return Number.isNaN(d.getTime())?esc(date):d.toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}
async function uploadProof(id,input){const file=input.files?.[0];if(!file)return;if(file.size>8*1024*1024){alert('A foto precisa ter no mximo 8 MB.');input.value='';return}const reader=new FileReader();reader.onload=async()=>{try{await api('/api/logistics/orders/'+id+'/proof',{method:'POST',body:JSON.stringify({data_url:reader.result})});alert('Comprovante anexado.');driver()}catch(e){alert(e.message)}};reader.readAsDataURL(file)}
async function completeDriver(id){
  const btn=document.querySelector(`button[onclick*="completeDriver('${id}')"]`);
  const card=btn?.closest('.route-card');
  if(card){
    card.style.transition='all 0.3s ease';
    card.style.opacity='0';
    card.style.transform='scale(0.95)';
    setTimeout(()=>{
      card.remove();
      const remaining=document.querySelectorAll('.route-card').length;
      const countHeader=document.querySelector('.mobile-card h2');
      if(countHeader)countHeader.textContent=`${remaining} parada(s) na fila`;
      if(!remaining){
        const content=document.querySelector('.mobile-content');
        if(content&&!content.querySelector('.empty-state')){
          content.insertAdjacentHTML('beforeend','<div class="mobile-card empty-state">Nenhuma parada pendente. As rotas concluídas ficam disponíveis em <strong>Rotas concluídas</strong>.</div>');
        }
      }
    },280);
  }
  toastRole('✓ Entrega concluída com sucesso!');
  Realtime.emit('orders_changed',{id,status:'CONCLUIDO'});
  Realtime.emit('routes_changed');
  try{
    await api('/api/logistics/orders/'+id+'/complete',{method:'POST',body:'{}'});
  }catch(e){toastRole(e.message,true);roleRealtimeRefresh('routes_changed')}
}
function openFailStopModal(id, numero, clienteNome){
  modal('✕ Marcar Parada como Não Concluída', `
    <div style="display:flex;flex-direction:column;gap:14px;color:#1e293b">
      <div>
        <strong style="font-size:15px;color:var(--xv-brand-navy,#061a4f)">Pedido ${esc(numero)}</strong>
        <div class="muted" style="font-size:13px;margin-top:2px">${esc(clienteNome)}</div>
      </div>
      <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:10px;font-size:12px;color:#991b1b">
        ⚠️ <strong>Atenção:</strong> Ao marcar esta parada como não concluída, ela será desvinculada da rota atual e o pedido voltará para o status <strong>Em Separação</strong> na Torre de Controle, ficando disponível para novas listas de carregamento e nova rota.
      </div>
      <div>
        <label style="display:block;font-size:13px;font-weight:700;margin-bottom:6px">Selecione o motivo da ocorrência: *</label>
        <select id="failReasonSelect" class="search" style="width:100%;padding:10px;border-radius:8px;border:1px solid #cbd5e1;font-size:14px;background:#fff;color:#0f172a">
          <option value="Cliente não se encontra no local">Cliente não se encontra no local</option>
          <option value="Cliente se recusou a receber o pedido">Cliente se recusou a receber o pedido</option>
          <option value="Pedido incorreto / Divergência de itens">Pedido incorreto / Divergência de itens</option>
          <option value="Problemas mecânicos com o veículo">Problemas mecânicos com o veículo</option>
          <option value="Imprevisto com a equipe de entrega">Imprevisto com a equipe de entrega</option>
          <option value="Outros motivos">Outros motivos</option>
        </select>
      </div>
      <div>
        <label style="display:block;font-size:13px;font-weight:700;margin-bottom:6px">Observações complementares (opcional):</label>
        <textarea id="failReasonDesc" rows="3" placeholder="Detalhes adicionais sobre o imprevisto ocorrido na entrega..." style="width:100%;padding:10px;border-radius:8px;border:1px solid #cbd5e1;font-size:13px;box-sizing:border-box;resize:vertical;font-family:inherit"></textarea>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:8px">
        <button class="btn" type="button" onclick="closeModal()">Cancelar</button>
        <button class="btn danger" type="button" id="btnConfirmFailStop" onclick="submitFailStop('${id}')" style="background:#dc2626;color:#fff;border-color:#dc2626;font-weight:700">Confirmar Não Concluído</button>
      </div>
    </div>
  `, '520px');
}
async function submitFailStop(id){
  const sel=document.getElementById('failReasonSelect');
  const descEl=document.getElementById('failReasonDesc');
  const motivo=sel?.value || 'Outros motivos';
  const descricao=descEl?.value?.trim() || '';
  const btn=document.getElementById('btnConfirmFailStop');
  if(btn){btn.disabled=true;btn.textContent='Registrando...';}
  try{
    await api('/api/logistics/orders/'+id+'/fail',{method:'POST',body:JSON.stringify({motivo,descricao})});
    closeModal();
    const targetCard=document.querySelector(`button[onclick*="openFailStopModal('${id}'"]`)?.closest('.route-card');
    if(targetCard){
      targetCard.style.transition='all 0.3s ease';
      targetCard.style.opacity='0';
      targetCard.style.transform='scale(0.95)';
      setTimeout(()=>{
        targetCard.remove();
        const remaining=document.querySelectorAll('.route-card').length;
        const countHeader=document.querySelector('.mobile-card h2');
        if(countHeader)countHeader.textContent=`${remaining} parada(s) na fila`;
        if(!remaining){
          const content=document.querySelector('.mobile-content');
          if(content&&!content.querySelector('.empty-state')){
            content.insertAdjacentHTML('beforeend','<div class="mobile-card empty-state">Nenhuma parada pendente. As rotas concluídas ficam disponíveis em <strong>Rotas concluídas</strong>.</div>');
          }
        }
      },280);
    }
    toastRole('✕ Ocorrência registrada! Pedido retornou para a separação.');
    Realtime.emit('orders_changed',{id,status:'SEPARACAO',action:'DELIVERY_FAILED'});
    Realtime.emit('routes_changed');
    Realtime.emit('returns_changed');
  }catch(e){
    if(btn){btn.disabled=false;btn.textContent='Confirmar Não Concluído';}
    toastRole(e.message,true);
  }
}
window.openFailStopModal=openFailStopModal;
window.submitFailStop=submitFailStop;
async function roleHome(){const r=document.body.dataset.role;if(r==='Vendedor Externo')return seller();if(r==='Frente de Loja / PDV')return pdv();if(r==='Loja Online')return loja();return driver()}
initRole();
