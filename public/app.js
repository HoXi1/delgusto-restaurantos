const app = document.querySelector('#app');
const toastRoot = document.querySelector('#toast-root');
const socket = io({autoConnect:false});

let restaurants = [];
let session = JSON.parse(localStorage.getItem('delGustoSession') || 'null');
let publicData = null;
let state = null;
let superState = null;
let page = 'dashboard';
let cart = [];
let selectedTable = 1;

const money = n => `${Number(n || 0).toFixed(2)} KM`;
const fmtDate = s => new Date(s).toLocaleString('bs-BA', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });
const fmtTime = s => new Date(s).toLocaleTimeString('bs-BA', {hour:'2-digit',minute:'2-digit'});
const escapeHtml = s => String(s ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

const icons = {
  grid:'<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></svg>',
  table:'<svg viewBox="0 0 24 24"><path d="M5 9h14M7 9v10m10-10v10M4 5h16v4H4z"/></svg>',
  calendar:'<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4m8-4v4M3 10h18"/></svg>',
  menu:'<svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h11"/></svg>',
  orders:'<svg viewBox="0 0 24 24"><path d="M6 3h12l2 4-2 14H6L4 7zM4 7h16M9 11h6"/></svg>',
  chef:'<svg viewBox="0 0 24 24"><path d="M7 14v6h10v-6M6 14h12a4 4 0 0 0-1-7.87A5 5 0 0 0 7 6.13 4 4 0 0 0 6 14Z"/></svg>',
  bell:'<svg viewBox="0 0 24 24"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>',
  qr:'<svg viewBox="0 0 24 24"><path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM15 14h2v2h-2zM19 14h2v4h-2zM14 19h4v2h-4zM20 20h1v1h-1z"/></svg>',
  logout:'<svg viewBox="0 0 24 24"><path d="M10 17l5-5-5-5M15 12H3M14 3h7v18h-7"/></svg>',
  plus:'<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  arrow:'<svg viewBox="0 0 24 24"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>',
  users:'<svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  revenue:'<svg viewBox="0 0 24 24"><path d="M12 2v20M17 6.5c0-2-2-3.5-5-3.5S7 4.5 7 6.5 9 10 12 10s5 1.5 5 3.5S15 17 12 17s-5-1.5-5-3.5"/></svg>',
  trend:'<svg viewBox="0 0 24 24"><path d="M3 17l6-6 4 4 8-9M15 6h6v6"/></svg>',
  search:'<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>',
  clock:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  check:'<svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"/></svg>',
  x:'<svg viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18"/></svg>',
  edit:'<svg viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg>',
  card:'<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18"/></svg>',
  spark:'<svg viewBox="0 0 24 24"><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8ZM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8Z"/></svg>'
};
const icon = (n, cls='') => `<span class="ico ${cls}">${icons[n] || icons.grid}</span>`;

function toast(text, type='ok'){
  const el=document.createElement('div');
  el.className=`toast ${type}`;
  el.innerHTML=`${type==='ok'?icon('check'):icon('bell')}<span>${escapeHtml(text)}</span>`;
  toastRoot.appendChild(el);
  setTimeout(()=>el.classList.add('show'),20);
  setTimeout(()=>{el.classList.remove('show');setTimeout(()=>el.remove(),250)},2800);
}
async function api(url, opts={}){
  const headers={'Content-Type':'application/json',...(opts.headers||{})};
  if(session?.csrf && !['GET','HEAD'].includes(String(opts.method||'GET').toUpperCase())) headers['X-CSRF-Token']=session.csrf;
  const r=await fetch(url,{...opts,headers,credentials:'same-origin'});
  let data=null; try{data=await r.json()}catch{}
  if(!r.ok) throw new Error(data?.error || 'Došlo je do greške.');
  return data;
}
function setBrand(r){
  document.documentElement.style.setProperty('--accent', r?.accent || '#d99a62');
  document.title = r?.name ? `${r.name} — Restaurant OS` : 'Restaurant OS';
}
function route(){
  const parts=location.pathname.split('/').filter(Boolean);
  if(parts[0]==='platform') return {type:'platform', sub:parts[1]||''};
  const host=location.hostname.toLowerCase();
  const domainTenant=restaurants.find(r=>String(r.domain||'').toLowerCase()===host);
  if(['login','app','qr'].includes(parts[0])) return {type:'restaurant',slug:'del-gusto',sub:parts[0]};
  const slug=parts[0] || domainTenant?.slug || 'del-gusto';
  return {type:'restaurant',slug,sub:parts[1]||''};
}
function go(path){history.pushState({},'',path);bootRoute();}
window.addEventListener('popstate',bootRoute);

async function bootRoute(){
  try{
    restaurants = restaurants.length ? restaurants : await api('/api/restaurants');
    const r=route();
    if(r.type==='platform'){
      if(r.sub==='login' || !session?.superAdmin){ renderPlatformLogin(); return; }
      await loadSuper(); return;
    }
    const exists=restaurants.find(x=>x.slug===r.slug);
    if(!exists){ go('/'); return; }
    publicData=await api(`/api/public/${r.slug}`); setBrand(publicData.restaurant);
    if(r.sub==='login'){
      if(session?.user && session?.csrf && session?.restaurant?.slug===r.slug){ await loadState(); return; }
      renderLogin(r.slug); return;
    }
    if(r.sub==='app'){
      if(!session?.user || !session?.csrf || session?.restaurant?.slug!==r.slug){ go('/login'); return; }
      await loadState(); return;
    }
    if(r.sub==='qr'){ renderQrGuest(); return; }
    renderWebsite();
  }catch(err){ app.innerHTML=`<div class="fatal"><div>${icon('bell')}</div><h1>Ne možemo učitati aplikaciju.</h1><p>${escapeHtml(err.message)}</p><button class="btn" onclick="location.reload()">Pokušaj ponovo</button></div>`; }
}

function renderWebsite(){
  const r=publicData.restaurant, m=publicData.menu, cats=[...new Set(m.map(x=>x.category))];
  app.innerHTML=`
  <div class="brand-site">
    <header class="site-nav glass">
      <a class="wordmark" href="/${r.slug}"><span class="wordmark-dot"></span>${r.name}</a>
      <nav class="site-links"><a href="#menu">Jelovnik</a><a href="#about">O nama</a><a href="#reserve">Rezervacije</a></nav>
      <div class="site-nav-actions"><button class="staff-top" id="staffTop">CRM Login</button><button class="nav-cta" id="reserveTop">Rezerviši <span>→</span></button></div>
    </header>

    <main>
      <section class="hero-v2">
        <div class="hero-noise"></div><div class="hero-orb orb-a"></div><div class="hero-orb orb-b"></div>
        <div class="hero-copy">
          <div class="micro-pill"><span></span>${escapeHtml(r.tagline)}</div>
          <h1>${escapeHtml(r.name)}</h1>
          <p>${escapeHtml(r.hero)}. Savremena gastronomija, pažljivo birani sastojci i ambijent kojem se vraćaš.</p>
          <div class="hero-actions"><button class="btn xl" id="heroReserve">Rezerviši sto ${icon('arrow')}</button><button class="btn xl ghost" id="heroMenu">Pogledaj jelovnik</button></div>
          <div class="hero-meta"><div><small>LOKACIJA</small><b>${escapeHtml(r.address)}</b></div><div><small>RADNO VRIJEME</small><b>${escapeHtml(r.hours)}</b></div><div><small>REZERVACIJE</small><b>${escapeHtml(r.phone)}</b></div></div>
        </div>
        <div class="hero-visual"><div class="plate-ring r1"></div><div class="plate-ring r2"></div><div class="plate-core"><span>${r.logo || r.name.slice(0,2)}</span></div><div class="float-card fc1"><small>CHEF'S PICK</small><b>${escapeHtml(m[0]?.name || 'Signature dish')}</b><span>${money(m[0]?.price)}</span></div><div class="float-card fc2"><span class="live-dot"></span><b>Otvoreno danas</b><small>${escapeHtml(r.hours)}</small></div></div>
      </section>

      <section class="marquee"><div>SEASONAL MENU <span>◆</span> RESERVATIONS <span>◆</span> FINE DINING <span>◆</span> SIGNATURE COCKTAILS <span>◆</span> ${escapeHtml(r.name)} <span>◆</span></div></section>

      <section class="section-v2" id="menu">
        <div class="section-head"><div><div class="eyebrow">Jelovnik</div><h2>Okusi koji ostaju.</h2></div><p>Naš izbor jela je kratak, fokusiran i napravljen da svako jelo ima razlog zašto je na meniju.</p></div>
        <div class="category-chips">${cats.map((c,i)=>`<button class="chip ${i===0?'active':''}" data-cat="${escapeHtml(c)}">${escapeHtml(c)}</button>`).join('')}</div>
        <div class="food-grid" id="foodGrid">${renderFoodCards(m)}</div>
      </section>

      <section class="experience" id="about"><div class="experience-card"><div class="eyebrow">Iskustvo</div><h2>Nije samo večera.<br>To je atmosfera.</h2><p>${escapeHtml(r.name)} spaja kuhinju, dizajn i servis u jedno iskustvo. Bez suvišnog. Bez kompromisa.</p><div class="stats-line"><div><strong>4.9</strong><span>prosječna ocjena</span></div><div><strong>12+</strong><span>signature jela</span></div><div><strong>7/7</strong><span>dana sedmično</span></div></div></div><div class="experience-visual"><div class="exp-grid"></div><div class="quote-mark">“</div><p>Detalji nisu detalji.<br>Oni čine iskustvo.</p></div></section>

      <section class="section-v2 reservation-section" id="reserve">
        <div class="reservation-copy"><div class="eyebrow">Rezervacije</div><h2>Vaš stol<br>vas čeka.</h2><p>Rezervaciju šaljete direktno restoranu. Potvrda i upravljanje rezervacijom vode se kroz interni sistem restorana.</p><div class="contact-stack"><span>${icon('clock')} ${escapeHtml(r.hours)}</span><span>${icon('table')} ${escapeHtml(r.address)}</span><span>${icon('users')} ${escapeHtml(r.phone)}</span></div></div>
        <form id="resForm" class="booking-card">
          <div class="booking-top"><span>Nova rezervacija</span><span class="status-dot">ONLINE</span></div>
          <div class="form-grid"><label class="field"><span>Ime i prezime</span><input name="name" autocomplete="name" required placeholder="Vaše ime"></label><label class="field"><span>Telefon</span><input name="phone" autocomplete="tel" required placeholder="+387 6x xxx xxx"></label><label class="field"><span>Datum</span><input type="date" name="date" required></label><label class="field"><span>Vrijeme</span><input type="time" name="time" required></label><label class="field"><span>Broj gostiju</span><select name="guests">${[1,2,3,4,5,6,7,8,9,10].map(x=>`<option>${x}</option>`).join('')}</select></label><label class="field"><span>Zona</span><select name="zone">${[...new Set(publicData.tables.map(t=>t.zone))].map(z=>`<option>${escapeHtml(z)}</option>`).join('')}</select></label><label class="field full"><span>Napomena</span><textarea name="message" rows="3" placeholder="Poseban zahtjev, alergije, povod..."></textarea></label></div>
          <button class="btn xl full-btn">Pošalji rezervaciju ${icon('arrow')}</button>
        </form>
      </section>
    </main>
    <footer class="site-footer"><a class="wordmark" href="/${r.slug}"><span class="wordmark-dot"></span>${r.name}</a><span>© ${new Date().getFullYear()} ${escapeHtml(r.name)}</span><button class="staff-link" id="staffLogin">Staff portal</button></footer>
  </div>`;
  document.querySelector('#staffTop').onclick=()=>go('/login');
  document.querySelector('#reserveTop').onclick=()=>document.querySelector('#reserve').scrollIntoView({behavior:'smooth'});
  document.querySelector('#heroReserve').onclick=()=>document.querySelector('#reserve').scrollIntoView({behavior:'smooth'});
  document.querySelector('#heroMenu').onclick=()=>document.querySelector('#menu').scrollIntoView({behavior:'smooth'});
  document.querySelector('#staffLogin').onclick=()=>go('/login');
  document.querySelectorAll('[data-cat]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-cat]').forEach(x=>x.classList.remove('active'));b.classList.add('active');document.querySelector('#foodGrid').innerHTML=renderFoodCards(m.filter(x=>x.category===b.dataset.cat));});
  document.querySelector('#resForm').onsubmit=async e=>{e.preventDefault();const btn=e.target.querySelector('button');btn.disabled=true;try{await api(`/api/public/${r.slug}/reservations`,{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(e.target)))});toast('Rezervacija je poslana.');e.target.reset()}catch(err){toast(err.message,'err')}finally{btn.disabled=false}};
}
function renderFoodCards(items){return items.map((i,idx)=>`<article class="food-card"><div class="food-art"><div class="food-index">0${idx+1}</div><div class="food-symbol">${i.category?.toLowerCase().includes('pić')?'◌':'✦'}</div></div><div class="food-info"><div class="food-top"><span>${escapeHtml(i.category)}</span><strong>${money(i.price)}</strong></div><h3>${escapeHtml(i.name)}</h3><p>${escapeHtml(i.description || 'Pažljivo pripremljeno i servirano.')}</p></div></article>`).join('')}

function renderLogin(slug){
  const r=publicData.restaurant;
  app.innerHTML=`<div class="auth-shell"><div class="auth-art"><div class="auth-glow"></div><a class="wordmark large" href="/${r.slug}"><span class="wordmark-dot"></span>${r.name}</a><div class="auth-art-copy"><div class="eyebrow">Staff access</div><h1>Operacije.<br>Bez buke.</h1><p>Jedno mjesto za servis, kuhinju, rezervacije, stolove i dnevni pregled poslovanja.</p></div><div class="auth-caption"><span class="live-dot"></span>Sistem aktivan</div></div><div class="auth-panel"><button class="back-link" id="backSite">← Nazad na web</button><form class="auth-card" id="loginForm"><div class="auth-icon">${icon('spark')}</div><h2>Dobrodošli nazad.</h2><p>Prijavite se na ${escapeHtml(r.name)} radni prostor.</p><label class="field"><span>Email</span><input type="email" name="email" required autocomplete="username" placeholder="ime@restoran.ba"></label><label class="field"><span>Lozinka</span><input type="password" name="password" required autocomplete="current-password" placeholder="••••••••"></label><button class="btn xl full-btn">Prijava ${icon('arrow')}</button><div class="auth-security">${icon('check')} Zaštićen pristup · sesija vezana za restoran</div></form></div></div>`;
  document.querySelector('#backSite').onclick=()=>go('/');
  document.querySelector('#loginForm').onsubmit=async e=>{e.preventDefault();const btn=e.target.querySelector('button');btn.disabled=true;try{const f=Object.fromEntries(new FormData(e.target));const d=await api('/api/login',{method:'POST',body:JSON.stringify({restaurantSlug:slug,...f})});session=d;localStorage.setItem('delGustoSession',JSON.stringify(d));if(!socket.connected)socket.connect();go('/app')}catch(err){toast(err.message,'err')}finally{btn.disabled=false}};
}

async function loadState(){
  try{state=await api('/api/state');setBrand(state.restaurant);if(!socket.connected)socket.connect();renderPortal();}
  catch{logout(false)}
}
async function logout(){try{if(session?.csrf)await api('/api/logout',{method:'POST',body:'{}'})}catch{}session=null;state=null;localStorage.removeItem('delGustoSession');go('/login')}

const navConfig={
  ADMIN:[['dashboard','grid','Pregled'],['tables','table','Stolovi'],['reservations','calendar','Rezervacije'],['menu','menu','Jelovnik'],['orders','orders','Narudžbe'],['kitchen','chef','Kuhinja'],['staff','users','Osoblje'],['settings','grid','Postavke'],['notifications','bell','Obavijesti'],['qr','qr','QR naručivanje']],
  WAITER:[['waiter','orders','Nova narudžba'],['tables','table','Stolovi'],['orders','orders','Narudžbe']],
  KITCHEN:[['kitchen','chef','Kuhinjski monitor'],['orders','orders','Sve narudžbe']]
};
function renderPortal(){
  if(!state)return;
  const nav=navConfig[session.user.role] || navConfig.ADMIN;
  if(!nav.some(x=>x[0]===page))page=nav[0][0];
  const unread=state.notifications.filter(x=>!x.read).length;
  app.innerHTML=`<div class="os-shell"><aside class="os-sidebar"><div class="os-logo"><div class="os-mark">${state.restaurant.logo || state.restaurant.name.slice(0,2)}</div><div><b>${escapeHtml(state.restaurant.name)}</b><span>Restaurant OS</span></div></div><nav class="os-nav">${nav.map(n=>`<button data-page="${n[0]}" class="${page===n[0]?'active':''}">${icon(n[1])}<span>${n[2]}</span>${n[0]==='notifications'&&unread?`<em>${unread}</em>`:''}</button>`).join('')}</nav><div class="os-user"><div class="avatar">${escapeHtml(session.user.name.split(' ').map(x=>x[0]).join('').slice(0,2))}</div><div><b>${escapeHtml(session.user.name)}</b><span>${roleLabel(session.user.role)}</span></div><button id="logout" title="Odjava">${icon('logout')}</button></div></aside><main class="os-main"><header class="os-top"><div><div class="breadcrumbs">${escapeHtml(state.restaurant.name)} <span>/</span> ${pageLabel(page)}</div><h1>${pageLabel(page)}</h1></div><div class="top-actions"><div class="system-live"><span></span>LIVE</div><button class="icon-btn" id="notifBtn">${icon('bell')}${unread?`<i>${unread}</i>`:''}</button></div></header><section class="os-content" id="pageContent">${renderPage()}</section></main></div>`;
  document.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>{page=b.dataset.page;renderPortal()});
  document.querySelector('#logout').onclick=logout;
  document.querySelector('#notifBtn').onclick=()=>{page='notifications';renderPortal()};
  bindPageEvents();
}
function roleLabel(r){return ({ADMIN:'Administrator',WAITER:'Konobar',KITCHEN:'Kuhinja'})[r]||r}
function pageLabel(p){return ({dashboard:'Kontrolni centar',tables:'Raspored stolova',reservations:'Rezervacije',menu:'Jelovnik',orders:'Narudžbe',kitchen:'Kuhinjski monitor',staff:'Osoblje',settings:'Postavke',notifications:'Obavijesti',qr:'QR naručivanje',waiter:'Nova narudžba'})[p]||p}
function renderPage(){return ({dashboard:dashboardPage,tables:tablesPage,reservations:reservationsPage,menu:menuPage,orders:ordersPage,kitchen:kitchenPage,staff:staffPage,settings:settingsPage,notifications:notificationsPage,qr:qrPage,waiter:waiterPage})[page]?.() || ''}

function dashboardPage(){
  const active=state.orders.filter(o=>!['NAPLAĆENA','OTKAZANA'].includes(o.status));
  const revenue=state.orders.filter(o=>o.status==='NAPLAĆENA').reduce((s,o)=>s+o.total,0);
  const occupied=state.tables.filter(t=>t.status==='ZAUZET').length;
  const pending=state.reservations.filter(r=>r.status==='NA ČEKANJU').length;
  const latest=[...state.orders].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).slice(0,5);
  return `<div class="dashboard-hero"><div><div class="eyebrow">Operativni pregled</div><h2>Dobrodošli, ${escapeHtml(session.user.name.split(' ')[0])}.</h2><p>Ovdje vidiš šta se dešava u restoranu upravo sada.</p></div><div class="date-pill">${new Date().toLocaleDateString('bs-BA',{weekday:'long',day:'2-digit',month:'long'})}</div></div>
  <div class="metric-grid"><article class="metric-card featured"><div class="metric-icon">${icon('revenue')}</div><span>Promet</span><strong>${money(revenue)}</strong><small>${icon('trend')} naplaćene narudžbe</small></article><article class="metric-card"><div class="metric-icon">${icon('orders')}</div><span>Aktivne narudžbe</span><strong>${active.length}</strong><small>${active.filter(o=>o.status==='NOVA').length} novih</small></article><article class="metric-card"><div class="metric-icon">${icon('table')}</div><span>Zauzetost</span><strong>${occupied}<i>/${state.tables.length}</i></strong><small>${Math.round((occupied/state.tables.length)*100||0)}% kapaciteta</small></article><article class="metric-card"><div class="metric-icon">${icon('calendar')}</div><span>Rezervacije</span><strong>${state.reservations.length}</strong><small>${pending} čeka potvrdu</small></article></div>
  <div class="dash-grid"><section class="os-card span2"><div class="card-head"><div><span>Servis uživo</span><h3>Aktivne narudžbe</h3></div><button class="text-btn" data-jump="orders">Sve narudžbe →</button></div><div class="activity-list">${latest.length?latest.map(o=>{const t=state.tables.find(x=>x.id===o.tableId);return `<div class="activity-row"><div class="activity-icon">${icon('orders')}</div><div class="activity-main"><b>${escapeHtml(t?.name||'Sto')} · #${o.id}</b><span>${o.items.map(i=>`${i.qty}× ${escapeHtml(i.name)}`).join(', ')}</span></div><span class="order-state ${statusClass(o.status)}">${o.status}</span><strong>${money(o.total)}</strong><time>${fmtTime(o.createdAt)}</time></div>`}).join(''):'<div class="empty-state">Nema narudžbi za prikaz.</div>'}</div></section><section class="os-card"><div class="card-head"><div><span>Status sale</span><h3>Stolovi</h3></div><button class="text-btn" data-jump="tables">Mapa →</button></div><div class="mini-floor">${state.tables.slice(0,8).map(t=>`<div class="mini-table ${t.status==='ZAUZET'?'busy':''}"><b>${escapeHtml(t.name.replace('Sto ',''))}</b><span>${t.status==='ZAUZET'?'ZAUZET':'SLOBODAN'}</span></div>`).join('')}</div></section></div>`;
}
function tablesPage(){return `<div class="page-toolbar"><div><p>Vizuelni raspored i trenutno stanje sale.</p></div><button class="btn" id="addTable">${icon('plus')} Dodaj sto</button></div><div class="floor-shell"><div class="floor-toolbar"><div><span class="legend free"></span>Slobodan</div><div><span class="legend busy"></span>Zauzet</div><div class="floor-zone">GLAVNA SALA</div></div><div class="floor-v2">${state.tables.map(t=>`<button class="table-v2 ${t.status==='ZAUZET'?'busy':''}" style="left:${Math.min(Number(t.x||80),760)}px;top:${Math.min(Number(t.y||80),460)}px" data-table="${t.id}"><span class="table-top">${t.capacity} mjesta</span><b>${escapeHtml(t.name)}</b><small>${escapeHtml(t.zone)}</small>${t.status==='ZAUZET'?'<i>AKTIVNO</i>':''}</button>`).join('')}</div></div>`}
function reservationsPage(){const rows=state.reservations;return `<div class="page-toolbar"><p>Upravljanje dolascima i zahtjevima gostiju.</p><div class="search-box">${icon('search')}<input placeholder="Pretraži rezervacije" id="resSearch"></div></div><div class="os-card table-card"><table class="data-table"><thead><tr><th>Gost</th><th>Termin</th><th>Gosti</th><th>Zona</th><th>Status</th><th></th></tr></thead><tbody id="resBody">${renderReservations(rows)}</tbody></table></div>`}
function renderReservations(rows){return rows.map(r=>`<tr><td><div class="person-cell"><div class="avatar sm">${escapeHtml((r.name||'?').split(' ').map(x=>x[0]).join('').slice(0,2))}</div><div><b>${escapeHtml(r.name)}</b><span>${escapeHtml(r.phone)}</span></div></div></td><td><b>${escapeHtml(r.date||'')}</b><span class="sub">${escapeHtml(r.time||'')}</span></td><td>${r.guests}</td><td>${escapeHtml(r.zone||'—')}</td><td><span class="order-state ${statusClass(r.status)}">${escapeHtml(r.status)}</span></td><td><div class="row-actions">${r.status==='NA ČEKANJU'?`<button class="mini-btn ok" data-res-ok="${r.id}">${icon('check')}</button><button class="mini-btn" data-res-no="${r.id}">${icon('x')}</button>`:''}</div></td></tr>`).join('')}
function menuPage(){const cats=[...new Set(state.menu.map(x=>x.category))];return `<div class="page-toolbar"><div class="menu-tabs"><button class="chip active">Sve</button>${cats.map(c=>`<button class="chip">${escapeHtml(c)}</button>`).join('')}</div><button class="btn" id="addMenu">${icon('plus')} Novo jelo</button></div><div class="menu-admin-v2">${state.menu.map((i,idx)=>`<article class="menu-admin-card"><div class="mac-art"><span>${String(idx+1).padStart(2,'0')}</span><div>✦</div></div><div class="mac-body"><div class="row"><span class="category-label">${escapeHtml(i.category)}</span><span class="visibility ${i.visible?'on':''}">${i.visible?'AKTIVNO':'SKRIVENO'}</span></div><h3>${escapeHtml(i.name)}</h3><p>${escapeHtml(i.description||'Bez opisa')}</p><div class="row mac-bottom"><strong>${money(i.price)}</strong><div><button class="mini-btn" data-menu-edit="${i.id}">${icon('edit')}</button><button class="mini-btn danger" data-menu-del="${i.id}">${icon('x')}</button></div></div></div></article>`).join('')}</div>`}
function ordersPage(){return `<div class="page-toolbar"><div class="status-tabs"><span class="active">Sve</span><span>Nove</span><span>Priprema</span><span>Završene</span></div><div class="live-label"><span></span> ažuriranje uživo</div></div><div class="order-board">${state.orders.length?state.orders.map(orderCard).join(''):'<div class="empty-state">Nema narudžbi.</div>'}</div>`}
function orderCard(o){const t=state.tables.find(x=>x.id===o.tableId);return `<article class="order-v2 ${statusClass(o.status)}"><div class="order-head"><div><span>${escapeHtml(t?.name||'Sto')} · ${escapeHtml(o.source||'POS')}</span><h3>#${o.id}</h3></div><span class="order-state ${statusClass(o.status)}">${escapeHtml(o.status)}</span></div><div class="order-items">${o.items.map(i=>`<div><b>${i.qty}×</b><span>${escapeHtml(i.name)}</span><strong>${money(i.price*i.qty)}</strong></div>`).join('')}</div>${o.note?`<div class="order-note">${escapeHtml(o.note)}</div>`:''}<div class="order-foot"><span>${icon('clock')} ${fmtTime(o.createdAt)}</span><strong>${money(o.total)}</strong></div></article>`}
function kitchenPage(){const active=state.orders.filter(o=>!['NAPLAĆENA','OTKAZANA'].includes(o.status));const cols=[['NOVA','NOVE'],['U PRIPREMI','U PRIPREMI'],['SPREMNA','SPREMNO']];return `<div class="kitchen-head"><div><span class="live-dot"></span> KUHINJA UŽIVO</div><div>${active.length} aktivnih narudžbi</div></div><div class="kanban">${cols.map(([status,label])=>`<section class="kanban-col"><header><span>${label}</span><b>${active.filter(o=>o.status===status).length}</b></header><div>${active.filter(o=>o.status===status).map(o=>kitchenTicket(o)).join('')||'<div class="empty-col">Nema narudžbi</div>'}</div></section>`).join('')}</div>`}
function kitchenTicket(o){const t=state.tables.find(x=>x.id===o.tableId);return `<article class="ticket ${statusClass(o.status)}"><div class="ticket-top"><div><small>${fmtTime(o.createdAt)}</small><h3>${escapeHtml(t?.name||'Sto')}</h3></div><b>#${o.id}</b></div><div class="ticket-items">${o.items.map(i=>`<div><strong>${i.qty}×</strong><span>${escapeHtml(i.name)}</span></div>`).join('')}</div>${o.note?`<div class="ticket-note">NAPOMENA · ${escapeHtml(o.note)}</div>`:''}<div class="ticket-actions">${o.status==='NOVA'?`<button class="btn full-btn" data-order-status="${o.id}" data-status="U PRIPREMI">Započni pripremu</button>`:o.status==='U PRIPREMI'?`<button class="btn full-btn success" data-order-status="${o.id}" data-status="SPREMNA">Označi kao spremno</button>`:`<div class="ready-banner">${icon('check')} SPREMNO ZA SERVIS</div>`}</div></article>`}
function staffPage(){return `<div class="page-toolbar"><div><p>Upravljanje pristupom osoblja i ulogama.</p></div><button class="btn" id="addStaff">${icon('plus')} Novi korisnik</button></div><div class="os-card table-card"><table class="data-table"><thead><tr><th>Korisnik</th><th>Email</th><th>Uloga</th><th>Status</th><th></th></tr></thead><tbody>${state.staff.map(u=>`<tr><td><div class="person-cell"><div class="avatar sm">${escapeHtml(u.name.split(' ').map(x=>x[0]).join('').slice(0,2))}</div><div><b>${escapeHtml(u.name)}</b><span>#${u.id}</span></div></div></td><td>${escapeHtml(u.email)}</td><td><span class="order-state new">${roleLabel(u.role)}</span></td><td><span class="order-state ${u.active?'success':'danger'}">${u.active?'AKTIVAN':'PAUZIRAN'}</span></td><td><button class="mini-btn" data-staff-toggle="${u.id}" data-active="${u.active}">${u.active?'Pauziraj':'Aktiviraj'}</button></td></tr>`).join('')}</tbody></table></div>`}
function settingsPage(){const r=state.restaurant,s=state.settings||{};return `<div class="settings-grid"><section class="os-card"><div class="card-head"><div><span>Javni web</span><h3>Podaci restorana</h3></div></div><form id="settingsForm" class="form-grid settings-form"><label class="field"><span>Telefon</span><input name="phone" value="${escapeHtml(r.phone||'')}"></label><label class="field"><span>Radno vrijeme</span><input name="hours" value="${escapeHtml(r.hours||'')}"></label><label class="field full"><span>Adresa</span><input name="address" value="${escapeHtml(r.address||'')}"></label><label class="field full"><span>Tagline</span><input name="tagline" value="${escapeHtml(r.tagline||'')}"></label><label class="field full"><span>Hero tekst</span><textarea name="hero" rows="3">${escapeHtml(r.hero||'')}</textarea></label><button class="btn full-btn" type="submit">Sačuvaj postavke</button></form></section><section class="os-card"><div class="card-head"><div><span>Moduli</span><h3>Online funkcije</h3></div></div><div class="settings-toggles"><label><input type="checkbox" id="reservationEnabled" ${s.reservationEnabled!==false?'checked':''}><span>Online rezervacije</span></label><label><input type="checkbox" id="qrOrderingEnabled" ${s.qrOrderingEnabled!==false?'checked':''}><span>QR naručivanje</span></label></div></section></div>`}
function notificationsPage(){return `<div class="page-toolbar"><p>Operativne obavijesti iz sistema.</p><div><button class="btn ghost" id="readAll">Označi pročitano</button> <button class="btn ghost danger-text" id="clearNotices">Obriši sve</button></div></div><div class="os-card notice-list">${state.notifications.length?state.notifications.map(n=>`<div class="notice-v2 ${n.read?'read':''}"><div class="notice-icon">${icon(n.type==='reservation'?'calendar':n.type==='order'?'orders':'bell')}</div><div><b>${escapeHtml(n.text)}</b><span>${fmtDate(n.createdAt)}</span></div>${!n.read?'<i></i>':''}</div>`).join(''):'<div class="empty-state">Nema obavijesti.</div>'}</div>`}
function qrPage(){return `<div class="qr-layout"><section><div class="eyebrow">Guest ordering</div><h2>QR naručivanje<br>bez čekanja.</h2><p>Svaki sto može imati svoj QR kod. Gost skenira kod, vidi samo jelovnik ovog restorana i šalje narudžbu direktno u kuhinju.</p><div class="qr-list">${state.tables.map(t=>`<a class="qr-row" href="/qr?table=${t.id}" target="_blank"><div class="qr-mini">${icon('qr')}</div><div><b>${escapeHtml(t.name)}</b><span>/qr?table=${t.id}</span></div>${icon('arrow')}</a>`).join('')}</div></section><aside class="qr-preview"><div class="phone"><div class="phone-notch"></div><div class="phone-content"><div class="wordmark small"><span class="wordmark-dot"></span>${escapeHtml(state.restaurant.name)}</div><div class="qr-preview-box">${icon('qr')}</div><h3>Skeniraj. Naruči. Uživaj.</h3><p>Narudžba ide direktno restoranu.</p></div></div></aside></div>`}
function waiterPage(){return `<div class="waiter-layout"><section class="os-card"><div class="card-head"><div><span>1. korak</span><h3>Odaberi sto</h3></div></div><div class="waiter-tables">${state.tables.map(t=>`<button class="${selectedTable===t.id?'selected':''} ${t.status==='ZAUZET'?'busy':''}" data-select-table="${t.id}"><b>${escapeHtml(t.name)}</b><span>${t.status}</span></button>`).join('')}</div><div class="card-head spaced"><div><span>2. korak</span><h3>Dodaj artikle</h3></div></div><div class="waiter-menu">${state.menu.filter(i=>i.visible).map(i=>`<button data-add-item="${i.id}"><div><b>${escapeHtml(i.name)}</b><span>${escapeHtml(i.category)}</span></div><strong>${money(i.price)}</strong>${icon('plus')}</button>`).join('')}</div></section><aside class="os-card cart-card"><div class="card-head"><div><span>Aktivna narudžba</span><h3>${escapeHtml(state.tables.find(t=>t.id===selectedTable)?.name||'Sto')}</h3></div><span>${cart.reduce((s,i)=>s+i.qty,0)} artikala</span></div><div class="cart-list">${cart.length?cart.map(i=>`<div><span><b>${i.qty}×</b> ${escapeHtml(i.name)}</span><strong>${money(i.price*i.qty)}</strong></div>`).join(''):'<div class="empty-cart">Dodaj artikle iz jelovnika.</div>'}</div><textarea id="orderNote" class="note-input" placeholder="Napomena za kuhinju..."></textarea><div class="cart-total"><span>Ukupno</span><strong>${money(cart.reduce((s,i)=>s+i.price*i.qty,0))}</strong></div><button class="btn xl full-btn" id="sendOrder" ${cart.length?'':'disabled'}>Pošalji u kuhinju ${icon('arrow')}</button></aside></div>`}
function statusClass(s){s=String(s||'').toUpperCase();if(s.includes('NAPLA')||s.includes('ZAVR')||s.includes('POTVR'))return 'success';if(s.includes('PRIPRE')||s.includes('ČEK'))return 'warning';if(s.includes('OTKAZ'))return 'danger';return 'new'}

function bindPageEvents(){
  document.querySelectorAll('[data-jump]').forEach(b=>b.onclick=()=>{page=b.dataset.jump;renderPortal()});
  document.querySelector('#addTable')?.addEventListener('click',async()=>{const name=prompt('Naziv stola:',`Sto ${state.tables.length+1}`);if(!name)return;await api('/api/tables',{method:'POST',body:JSON.stringify({name})});await loadState();toast('Sto je dodan.')});
  document.querySelector('#resSearch')?.addEventListener('input',e=>{const q=e.target.value.toLowerCase();document.querySelector('#resBody').innerHTML=renderReservations(state.reservations.filter(r=>`${r.name} ${r.phone} ${r.date}`.toLowerCase().includes(q)));bindPageEvents()});
  document.querySelectorAll('[data-res-ok]').forEach(b=>b.onclick=()=>updateReservation(b.dataset.resOk,'POTVRĐENA'));
  document.querySelectorAll('[data-res-no]').forEach(b=>b.onclick=()=>updateReservation(b.dataset.resNo,'OTKAZANA'));
  document.querySelector('#addMenu')?.addEventListener('click',async()=>{const name=prompt('Naziv jela:');if(!name)return;const price=prompt('Cijena (KM):','12.00');const category=prompt('Kategorija:','Glavna jela');await api('/api/menu',{method:'POST',body:JSON.stringify({name,price:Number(price),category,description:'Novo jelo'})});await loadState();toast('Jelo je dodano.')});
  document.querySelectorAll('[data-menu-del]').forEach(b=>b.onclick=async()=>{if(!confirm('Obrisati jelo?'))return;await api(`/api/menu/${b.dataset.menuDel}`,{method:'DELETE'});await loadState();toast('Jelo je obrisano.')});
  document.querySelectorAll('[data-menu-edit]').forEach(b=>b.onclick=async()=>{const i=state.menu.find(x=>x.id===Number(b.dataset.menuEdit));const name=prompt('Naziv:',i.name);if(!name)return;const price=prompt('Cijena:',i.price);await api(`/api/menu/${i.id}`,{method:'PUT',body:JSON.stringify({...i,name,price:Number(price)})});await loadState();toast('Jelo je ažurirano.')});
  document.querySelectorAll('[data-order-status]').forEach(b=>b.onclick=async()=>{await api(`/api/orders/${b.dataset.orderStatus}/status`,{method:'PUT',body:JSON.stringify({status:b.dataset.status})});await loadState();toast('Status narudžbe je ažuriran.')});
  document.querySelector('#readAll')?.addEventListener('click',async()=>{await api('/api/notifications/read-all',{method:'PUT'});await loadState()});
  document.querySelector('#clearNotices')?.addEventListener('click',async()=>{await api('/api/notifications',{method:'DELETE'});await loadState()});
  document.querySelectorAll('[data-select-table]').forEach(b=>b.onclick=()=>{selectedTable=Number(b.dataset.selectTable);renderPortal()});
  document.querySelectorAll('[data-add-item]').forEach(b=>b.onclick=()=>{const i=state.menu.find(x=>x.id===Number(b.dataset.addItem));const c=cart.find(x=>x.id===i.id);c?c.qty++:cart.push({...i,qty:1});renderPortal()});
  document.querySelector('#sendOrder')?.addEventListener('click',async()=>{if(!cart.length)return;const note=document.querySelector('#orderNote')?.value||'';await api('/api/orders',{method:'POST',body:JSON.stringify({tableId:selectedTable,items:cart.map(i=>({id:i.id,qty:i.qty})),note,source:'WAITER'})});cart=[];await loadState();toast('Narudžba je poslana u kuhinju.')});
  document.querySelectorAll('[data-table]').forEach(b=>b.onclick=async()=>{const t=state.tables.find(x=>x.id===Number(b.dataset.table));if(t?.status!=='ZAUZET')return;const active=state.orders.filter(o=>o.tableId===t.id&&!['NAPLAĆENA','OTKAZANA'].includes(o.status));const total=active.reduce((a,o)=>a+Number(o.total),0);if(confirm(`${t.name} ima ${active.length} aktivnih narudžbi (${money(total)}). Naplatiti i osloboditi sto?`)){const method=confirm('OK = Kartica, Cancel = Gotovina')?'CARD':'CASH';await api(`/api/tables/${t.id}/pay`,{method:'POST',body:JSON.stringify({method})});await loadState();toast('Sto je naplaćen i oslobođen.')}});
  document.querySelector('#addStaff')?.addEventListener('click',async()=>{const name=prompt('Ime korisnika:');if(!name)return;const email=prompt('Email:');if(!email)return;const password=prompt('Početna lozinka (min 8 znakova):');if(!password)return;const role=(prompt('Uloga: ADMIN, WAITER ili KITCHEN','WAITER')||'WAITER').toUpperCase();await api('/api/staff',{method:'POST',body:JSON.stringify({name,email,password,role})});await loadState();toast('Korisnik je kreiran.')});
  document.querySelectorAll('[data-staff-toggle]').forEach(b=>b.onclick=async()=>{await api(`/api/staff/${b.dataset.staffToggle}`,{method:'PUT',body:JSON.stringify({active:b.dataset.active!=='true'})});await loadState();toast('Status korisnika je ažuriran.')});
  document.querySelector('#settingsForm')?.addEventListener('submit',async e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target));d.reservationEnabled=document.querySelector('#reservationEnabled')?.checked??true;d.qrOrderingEnabled=document.querySelector('#qrOrderingEnabled')?.checked??true;await api('/api/settings',{method:'PUT',body:JSON.stringify(d)});await loadState();toast('Postavke su sačuvane.')});
}
async function updateReservation(id,status){await api(`/api/reservations/${id}`,{method:'PUT',body:JSON.stringify({status})});await loadState();toast(status==='POTVRĐENA'?'Rezervacija potvrđena.':'Rezervacija otkazana.')}

function renderQrGuest(){
  const r=publicData.restaurant;const tableId=Number(new URLSearchParams(location.search).get('table')||publicData.tables[0]?.id);const table=publicData.tables.find(t=>t.id===tableId)||publicData.tables[0];cart=[];
  app.innerHTML=`<div class="guest-shell"><header><div class="wordmark"><span class="wordmark-dot"></span>${escapeHtml(r.name)}</div><div class="guest-table">${escapeHtml(table?.name||'Sto')}</div></header><main><div class="guest-head"><div class="eyebrow">Naruči sa stola</div><h1>Šta ti se jede?</h1><p>Odaberi artikle. Narudžba ide direktno osoblju restorana.</p></div><div class="guest-menu" id="guestMenu">${publicData.menu.map(i=>`<button data-gadd="${i.id}"><div><span>${escapeHtml(i.category)}</span><b>${escapeHtml(i.name)}</b><small>${escapeHtml(i.description||'')}</small></div><strong>${money(i.price)}</strong>${icon('plus')}</button>`).join('')}</div></main><div class="guest-cart" id="guestCart"><div><span>Vaša narudžba</span><b id="guestCount">0 artikala</b></div><strong id="guestTotal">0.00 KM</strong><button class="btn" id="guestSend" disabled>Pošalji ${icon('arrow')}</button></div></div>`;
  document.querySelectorAll('[data-gadd]').forEach(b=>b.onclick=()=>{const i=publicData.menu.find(x=>x.id===Number(b.dataset.gadd));const c=cart.find(x=>x.id===i.id);c?c.qty++:cart.push({...i,qty:1});const count=cart.reduce((s,x)=>s+x.qty,0);document.querySelector('#guestCount').textContent=`${count} artikala`;document.querySelector('#guestTotal').textContent=money(cart.reduce((s,x)=>s+x.price*x.qty,0));document.querySelector('#guestSend').disabled=false});
  document.querySelector('#guestSend').onclick=async()=>{try{await api(`/api/public/${r.slug}/orders`,{method:'POST',body:JSON.stringify({tableId:table.id,items:cart.map(i=>({id:i.id,qty:i.qty}))})});toast('Narudžba je poslana.');cart=[];setTimeout(()=>renderQrGuest(),800)}catch(err){toast(err.message,'err')}};
}

function renderPlatformLogin(){
  setBrand({accent:'#79a8ff'});
  app.innerHTML=`<div class="platform-login"><div class="platform-brand"><div class="platform-symbol">RO</div><div><b>Restaurant OS</b><span>Platform Console</span></div></div><form id="platformForm" class="auth-card compact"><div class="eyebrow">Platform owner</div><h2>Centralna administracija.</h2><p>Pristup upravljanju restoranima i sistemskim metrikama.</p><label class="field"><span>Email</span><input type="email" name="email" required></label><label class="field"><span>Lozinka</span><input type="password" name="password" required></label><button class="btn xl full-btn">Prijava ${icon('arrow')}</button></form></div>`;
  document.querySelector('#platformForm').onsubmit=async e=>{e.preventDefault();try{const f=Object.fromEntries(new FormData(e.target));const d=await api('/api/login',{method:'POST',body:JSON.stringify({restaurantSlug:'__superadmin',...f})});session=d;localStorage.setItem('restaurantOsSession',JSON.stringify(d));go('/platform')}catch(err){toast(err.message,'err')}};
}
async function loadSuper(){try{superState=await api('/api/super/state');renderPlatform()}catch{session=null;localStorage.removeItem('restaurantOsSession');renderPlatformLogin()}}
function platformNav(view){
  const current=view||'portfolio';
  return `<nav>
    <button data-platform-view="portfolio" class="${current==='portfolio'?'active':''}">${icon('grid')} Portfelj</button>
    <button data-platform-view="analytics" class="${current==='analytics'?'active':''}">${icon('trend')} Analitika</button>
    <button data-platform-view="clients" class="${current==='clients'?'active':''}">${icon('users')} Klijenti</button>
  </nav>`;
}
function platformShell(content,view='portfolio'){
  app.innerHTML=`<div class="platform-shell" id="platformShell"><div class="platform-overlay" id="platformOverlay"></div><aside class="platform-side"><div class="platform-brand"><div class="platform-symbol">RO</div><div><b>Restaurant OS</b><span>Platform Console</span></div></div>${platformNav(view)}<button class="platform-logout" id="platformLogout">${icon('logout')} Odjava</button></aside><div class="platform-mobilebar"><div class="platform-brand"><div class="platform-symbol">RO</div><div><b>Restaurant OS</b><span>Platform Console</span></div></div><button class="platform-menu-btn" id="platformMenuBtn" aria-label="Otvori meni">${icon('menu')}</button></div><main class="platform-main">${content}</main></div>`;
  const shell=document.querySelector('#platformShell'), menu=document.querySelector('#platformMenuBtn'), overlay=document.querySelector('#platformOverlay');
  const close=()=>shell?.classList.remove('menu-open');
  menu?.addEventListener('click',()=>shell?.classList.toggle('menu-open')); overlay?.addEventListener('click',close);
  document.querySelectorAll('[data-platform-view]').forEach(b=>b.onclick=()=>{go(`/platform/${b.dataset.platformView==='portfolio'?'':b.dataset.platformView}`);close()});
  document.querySelector('#platformLogout').onclick=()=>{session=null;localStorage.removeItem('restaurantOsSession');go('/platform/login')};
}
function platformTotals(){
  const rs=superState.restaurants; return {active:rs.filter(r=>r.active).length,orders:rs.reduce((s,r)=>s+r.activeOrders,0),staff:rs.reduce((s,r)=>s+r.staffCount,0),revenue:rs.reduce((s,r)=>s+r.todayRevenue,0),reservations:rs.reduce((s,r)=>s+r.reservations,0)};
}
function renderPlatform(){
  const sub=route().sub||'portfolio';
  if(sub==='analytics') return renderPlatformAnalytics();
  if(sub==='clients') return renderPlatformClients();
  const t=platformTotals();
  platformShell(`<header><div><div class="eyebrow">Platform overview</div><h1>Restorani</h1><p class="platform-lead">Centralni pregled svih aktivnih lokacija i operacija.</p></div><button class="btn" id="newRestaurantBtn">${icon('plus')} Novi restoran</button></header><div class="platform-kpis"><div><span>Aktivni restorani</span><strong>${t.active}</strong></div><div><span>Aktivne narudžbe</span><strong>${t.orders}</strong></div><div><span>Ukupno osoblja</span><strong>${t.staff}</strong></div><div><span>Promet u sistemu</span><strong>${money(t.revenue)}</strong></div></div><section class="platform-grid">${superState.restaurants.map(r=>`<article class="platform-tenant" style="--tenant:${r.accent}"><div class="tenant-glow"></div><div class="pt-top"><div class="pt-mark">${escapeHtml(r.logo||r.name.slice(0,2))}</div><span class="status-dot ${r.active?'':'inactive'}">${r.active?'ACTIVE':'PAUSED'}</span></div><h2>${escapeHtml(r.name)}</h2><p>${escapeHtml(r.address)}</p><div class="pt-metrics"><div><span>Osoblje</span><b>${r.staffCount}</b></div><div><span>Stolovi</span><b>${r.tables}</b></div><div><span>Meni</span><b>${r.menuItems}</b></div><div><span>Narudžbe</span><b>${r.activeOrders}</b></div></div><div class="pt-actions"><a href="/${r.slug}" target="_blank">Javni web ${icon('arrow')}</a><a href="/${r.slug}/login" target="_blank">Staff portal ${icon('arrow')}</a></div></article>`).join('')}</section>`, 'portfolio');
  document.querySelector('#newRestaurantBtn').onclick=openNewRestaurantModal;
}
function renderPlatformAnalytics(){
  const rs=superState.restaurants, t=platformTotals(); const max=Math.max(1,...rs.map(r=>r.todayRevenue));
  platformShell(`<header><div><div class="eyebrow">Business intelligence</div><h1>Analitika</h1><p class="platform-lead">Uporedi performanse restorana iz jednog mjesta.</p></div><div class="analytics-live"><span class="live-dot"></span> Live podaci</div></header>
  <div class="platform-kpis"><div><span>Ukupan promet</span><strong>${money(t.revenue)}</strong></div><div><span>Aktivne narudžbe</span><strong>${t.orders}</strong></div><div><span>Rezervacije</span><strong>${t.reservations}</strong></div><div><span>Prosjek / restoran</span><strong>${money(t.revenue/Math.max(1,rs.length))}</strong></div></div>
  <section class="analytics-grid"><article class="analytics-card wide"><div class="card-head"><div><span>Promet po restoranu</span><h3>Današnji rezultat</h3></div><b>${money(t.revenue)}</b></div><div class="revenue-bars">${rs.map(r=>`<div class="revenue-row"><div class="revenue-label"><span class="tenant-mini" style="--tenant:${r.accent}"></span><b>${escapeHtml(r.name)}</b><small>${money(r.todayRevenue)}</small></div><div class="bar-track"><i style="width:${Math.max(4,(r.todayRevenue/max)*100)}%;--tenant:${r.accent}"></i></div></div>`).join('')}</div></article>
  <article class="analytics-card"><div class="card-head"><div><span>Operacije</span><h3>Aktivnost sistema</h3></div></div><div class="donut-wrap"><div class="css-donut" style="--p:${Math.min(100,t.orders*8)}"><strong>${t.orders}</strong><span>aktivnih</span></div><div class="legend-stack"><div><i></i><span>Narudžbe</span><b>${t.orders}</b></div><div><i></i><span>Rezervacije</span><b>${t.reservations}</b></div><div><i></i><span>Osoblje</span><b>${t.staff}</b></div></div></div></article>
  <article class="analytics-card wide"><div class="card-head"><div><span>Portfolio ranking</span><h3>Performanse lokacija</h3></div></div><div class="ranking-list">${[...rs].sort((a,b)=>b.todayRevenue-a.todayRevenue).map((r,i)=>`<div><strong>#${i+1}</strong><span>${escapeHtml(r.name)}<small>${r.activeOrders} aktivnih narudžbi · ${r.staffCount} osoblja</small></span><b>${money(r.todayRevenue)}</b></div>`).join('')}</div></article></section>`, 'analytics');
}
function renderPlatformClients(){
  const rs=superState.restaurants;
  platformShell(`<header><div><div class="eyebrow">Client management</div><h1>Klijenti</h1><p class="platform-lead">Upravljanje restoranima, pristupima i statusom usluge.</p></div><button class="btn" id="clientsAddBtn">${icon('plus')} Novi restoran</button></header><div class="client-toolbar"><label class="platform-search">${icon('search')}<input id="clientSearch" placeholder="Pretraži restoran, grad ili slug..."></label><span>${rs.length} klijenta</span></div><section class="client-list" id="clientList">${clientsRows(rs)}</section>`, 'clients');
  document.querySelector('#clientsAddBtn').onclick=openNewRestaurantModal;
  document.querySelector('#clientSearch').oninput=e=>{const q=e.target.value.toLowerCase();document.querySelector('#clientList').innerHTML=clientsRows(rs.filter(r=>`${r.name} ${r.address} ${r.slug}`.toLowerCase().includes(q)));bindClientActions()};
  bindClientActions();
}
function clientsRows(rs){return rs.map(r=>`<article class="client-row"><div class="client-identity"><div class="pt-mark" style="--tenant:${r.accent}">${escapeHtml(r.logo||r.name.slice(0,2))}</div><div><b>${escapeHtml(r.name)}</b><span>/${escapeHtml(r.slug)} · ${escapeHtml(r.address)}</span></div></div><div class="client-stat"><span>Promet</span><b>${money(r.todayRevenue)}</b></div><div class="client-stat"><span>Osoblje</span><b>${r.staffCount}</b></div><div class="client-stat"><span>Narudžbe</span><b>${r.activeOrders}</b></div><div class="client-actions"><a class="mini-action" href="/${r.slug}" target="_blank">Web</a><a class="mini-action" href="/${r.slug}/login" target="_blank">CRM</a><button class="toggle-client ${r.active?'on':''}" data-client-toggle="${r.id}" data-active="${r.active}"><i></i>${r.active?'Aktivan':'Pauziran'}</button></div></article>`).join('') || '<div class="empty-platform">Nema rezultata.</div>'}
function bindClientActions(){document.querySelectorAll('[data-client-toggle]').forEach(b=>b.onclick=async()=>{const active=b.dataset.active!=='true';try{await api(`/api/super/restaurants/${b.dataset.clientToggle}`,{method:'PUT',body:JSON.stringify({active})});superState=await api('/api/super/state');renderPlatformClients();toast(active?'Restoran je aktiviran.':'Restoran je pauziran.')}catch(err){toast(err.message,'err')}})}
function openNewRestaurantModal(){
  const modal=document.createElement('div'); modal.className='platform-modal-wrap';
  modal.innerHTML=`<div class="platform-modal"><button class="modal-close" type="button">${icon('x')}</button><div class="eyebrow">Onboarding</div><h2>Novi restoran</h2><p>Kreiraj novi white-label tenant. Sistem odmah priprema web, CRM i početne uloge.</p><form id="newRestaurantForm"><div class="form-grid"><label class="field"><span>Naziv restorana</span><input name="name" required placeholder="Npr. Atelier 17"></label><label class="field"><span>Slug / URL</span><input name="slug" required placeholder="atelier-17"></label><label class="field"><span>Adresa</span><input name="address" placeholder="Sarajevo, BiH"></label><label class="field"><span>Telefon</span><input name="phone" placeholder="+387 61 000 000"></label><label class="field"><span>Admin email</span><input name="email" type="email" required placeholder="admin@restoran.ba"></label><label class="field"><span>Početna lozinka</span><input name="password" type="password" minlength="6" required placeholder="Najmanje 6 znakova"></label><label class="field"><span>Accent boja</span><input name="accent" type="color" value="#79a8ff"></label><label class="field"><span>Domena (opcionalno)</span><input name="domain" placeholder="restoran.ba"></label><label class="field full"><span>Tagline</span><input name="tagline" placeholder="Modern dining experience"></label></div><div class="modal-actions"><button type="button" class="btn ghost cancel-modal">Odustani</button><button class="btn" type="submit">${icon('plus')} Kreiraj restoran</button></div></form></div>`;
  document.body.appendChild(modal); requestAnimationFrame(()=>modal.classList.add('show'));
  const close=()=>{modal.classList.remove('show');setTimeout(()=>modal.remove(),180)};
  modal.querySelector('.modal-close').onclick=close; modal.querySelector('.cancel-modal').onclick=close; modal.onclick=e=>{if(e.target===modal)close()};
  modal.querySelector('input[name="name"]').oninput=e=>{const sl=modal.querySelector('input[name="slug"]');if(!sl.dataset.touched)sl.value=e.target.value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')};
  modal.querySelector('input[name="slug"]').oninput=e=>e.target.dataset.touched='1';
  modal.querySelector('#newRestaurantForm').onsubmit=async e=>{e.preventDefault();const btn=e.target.querySelector('button[type="submit"]');btn.disabled=true;btn.textContent='Kreiranje...';try{const payload=Object.fromEntries(new FormData(e.target));const d=await api('/api/super/restaurants',{method:'POST',body:JSON.stringify(payload)});restaurants=[];superState=await api('/api/super/state');close();renderPlatform();toast(`${d.restaurant.name} je kreiran.`)}catch(err){btn.disabled=false;btn.innerHTML=`${icon('plus')} Kreiraj restoran`;toast(err.message,'err')}};
}

socket.on('state',s=>{if(state){state=s;renderPortal()}});
['menu','tables','reservations','notifications'].forEach(ev=>socket.on(ev,v=>{if(state){state[ev]=v;renderPortal()}}));
socket.on('order:new',o=>{if(state&&!state.orders.some(x=>x.id===o.id)){state.orders.unshift(o);renderPortal();toast('Nova narudžba je stigla.')}});
socket.on('order:update',o=>{if(state){const i=state.orders.findIndex(x=>x.id===o.id);if(i>=0)state.orders[i]=o;renderPortal()}});

bootRoute();

socket.on('state:changed',async()=>{if(state){try{state=await api('/api/state');renderPortal()}catch{}}});
