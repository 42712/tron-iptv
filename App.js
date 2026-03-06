'use strict';

// ── SESSÃO ──────────────────────────────────
const S = (() => {
  try {
    return JSON.parse(localStorage.getItem('tron_session') || 'null') ||
           JSON.parse(sessionStorage.getItem('tron_session') || 'null');
  } catch { return null; }
})();
if (!S?.server) { window.location.replace('index.html'); }

// ── PROXY POOL (mais rápido primeiro) ────────
const PX = [
  u => u,
  u => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  u => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
  u => `https://api.cors.lol/?url=${encodeURIComponent(u)}`,
];

let bestProxy = 0; // cache do proxy que funcionou
async function apiCall(action, extra = '') {
  const raw = `${S.server}/player_api.php?username=${S.user}&password=${S.pass}&action=${action}${extra}`;
  // tenta primeiro o proxy que funcionou antes
  const order = [bestProxy, ...PX.map((_,i)=>i).filter(i=>i!==bestProxy)];
  for (const i of order) {
    try {
      const r = await fetch(PX[i](raw), { signal: AbortSignal.timeout(12000) });
      if (!r.ok) continue;
      const txt = await r.text();
      if (!txt?.trim() || txt[0]==='{' && txt.includes('"error"')) continue;
      const d = JSON.parse(txt);
      if (Array.isArray(d) && d.length === 0) continue; // pode ser erro
      bestProxy = i;
      return d;
    } catch(e) { console.warn('px'+i, e.message); }
  }
  throw new Error('Servidor inacessível. Verifique URL e credenciais.');
}

// ── ESTADO ──────────────────────────────────
let section    = 'live';
let allCats    = [];
let allStreams  = [];
let filtCats   = [];   // cats filtradas
let activeCatIdx = -1; // índice da cat atual em filtCats
let activeItems  = []; // streams da cat atual
let activeUrl    = null;
let hlsObj       = null;
let retries      = 0;
let qMode        = 'auto';
let searchOpen   = false;

// ── INIT ─────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  startClock();
  navTo('live');
});

function startClock() {
  const el = document.getElementById('bar-clock');
  function tick() {
    const now = new Date();
    const t = now.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
    const d = now.toLocaleDateString('pt-BR', { day:'2-digit', month:'short', year:'numeric' });
    el.textContent = t + '  |  ' + d;
  }
  tick(); setInterval(tick, 1000);
}

// ── TOAST ────────────────────────────────────
function toast(msg, cls='') {
  const el = document.getElementById('toast');
  el.textContent = msg; el.className = 'toast show '+cls;
  clearTimeout(el._t); el._t = setTimeout(()=>el.className='toast', 3000);
}

// ── FAVORITOS ────────────────────────────────
const getFavs = () => { try { return JSON.parse(localStorage.getItem('tfavs')||'[]'); } catch { return []; } };
const setFavs = a  => localStorage.setItem('tfavs', JSON.stringify(a));
const isFav   = id => getFavs().some(f=>f._id===id);
function toggleFav(item) {
  let f=getFavs(), i=f.findIndex(x=>x._id===item._id);
  if(i>=0){f.splice(i,1);setFavs(f);toast('Removido dos favoritos','err');return false;}
  f.push(item);setFavs(f);toast('⭐ Adicionado!','ok');return true;
}

// ── BUSCA GLOBAL ─────────────────────────────
function toggleSearch() {
  searchOpen = !searchOpen;
  const sb = document.getElementById('search-bar');
  sb.style.display = searchOpen ? 'flex' : 'none';
  if (searchOpen) {
    document.getElementById('srch').value = '';
    document.getElementById('srch').focus();
    // empurra workspace para baixo
    document.querySelector('.nav-tabs').style.top = 'calc(52px + 46px)';
    document.querySelector('.workspace').style.top = 'calc(52px + 46px + 42px)';
  } else {
    document.querySelector('.nav-tabs').style.top = '';
    document.querySelector('.workspace').style.top = '';
  }
}

function doSearch(q) {
  if (!q.trim()) { renderHome(); return; }
  const lq = q.toLowerCase();
  const results = allStreams.filter(s => s.name.toLowerCase().includes(lq));
  showPlayerView();
  document.getElementById('ch-cat-name').textContent = `Busca: "${q}"`;
  activeItems = results;
  activeCatIdx = -1;
  renderChList(results);
}

// ── NAVEGAÇÃO ────────────────────────────────
function navTo(s) {
  section = s;
  document.querySelectorAll('.ntab').forEach(b=>b.classList.toggle('active', b.dataset.s===s));
  document.getElementById('bar-mode').textContent =
    s==='live'?'AO VIVO': s==='movies'?'FILMES': s==='series'?'SÉRIES':'FAVORITOS';
  closeEp();
  if (s==='favs') { loadFavs(); return; }
  loadSection(s);
}

async function loadSection(s) {
  showHome('loading');
  try {
    const acts = {
      live:   ['get_live_categories',   'get_live_streams'],
      movies: ['get_vod_categories',    'get_vod_streams'],
      series: ['get_series_categories', 'get_series'],
    };
    const [cAct, sAct] = acts[s];
    const [cRaw, sRaw] = await Promise.all([apiCall(cAct), apiCall(sAct)]);

    allCats   = Array.isArray(cRaw) ? cRaw : [];
    allStreams = buildStreams(sRaw, s);
    filtCats  = allCats.filter(c => allStreams.some(st => st.cat === String(c.category_id)));

    renderHome();
    toast(`✅ ${allStreams.length} itens`, 'ok');
  } catch(e) {
    showHome('error', e.message);
    toast(e.message, 'err');
  }
}

function buildStreams(raw, s) {
  if (!Array.isArray(raw)) return [];
  if (s==='live') return raw.map((c,i)=>({
    _id:'l_'+c.stream_id, num:i+1,
    name:c.name||'—', url:`${S.server}/live/${S.user}/${S.pass}/${c.stream_id}.m3u8`,
    img:c.stream_icon||'', cat:String(c.category_id||''), grp:c.category_name||'',
    type:'live',
  }));
  if (s==='movies') return raw.map((m,i)=>({
    _id:'m_'+m.stream_id, num:i+1,
    name:m.name||'—', url:`${S.server}/movie/${S.user}/${S.pass}/${m.stream_id}.${m.container_extension||'mp4'}`,
    img:m.stream_icon||'', cat:String(m.category_id||''), grp:m.category_name||'',
    type:'movies',
  }));
  return raw.map((x,i)=>({
    _id:'sr_'+x.series_id, num:i+1,
    name:x.name||'—', url:null,
    img:x.cover||'', cat:String(x.category_id||''), grp:x.category_name||'',
    type:'series', series_id:x.series_id,
  }));
}

// ── HOME (grade de categorias) ───────────────
function showHome(state='cats', msg='') {
  document.getElementById('home-panel').style.display = 'flex';
  document.getElementById('player-view').style.display = 'none';
}
function showPlayerView() {
  document.getElementById('home-panel').style.display = 'none';
  document.getElementById('player-view').style.display = 'grid';
}

function renderHome() {
  showHome();
  const grid = document.getElementById('cat-grid');
  const title = document.getElementById('home-title');
  grid.innerHTML = '';

  if (!allCats.length) {
    grid.innerHTML = '<div class="state"><div class="ico">⚠️</div><p>SEM CATEGORIAS</p></div>';
    return;
  }

  title.textContent = 'SELECIONE UMA CATEGORIA';
  const frag = document.createDocumentFragment();

  // TODOS
  const all = mkCatCard('TODOS', allStreams.length);
  all.onclick = () => openCat(-1, allStreams, 'TODOS');
  frag.appendChild(all);

  filtCats.forEach((c, idx) => {
    const items = allStreams.filter(s => s.cat === String(c.category_id));
    const card  = mkCatCard(c.category_name || '—', items.length);
    card.onclick = () => openCat(idx, items, c.category_name || '—');
    frag.appendChild(card);
  });

  grid.appendChild(frag);
}

function showHome_loading() {
  const grid = document.getElementById('cat-grid');
  grid.innerHTML = '<div class="state"><div class="spin"></div><p>CARREGANDO...</p></div>';
}
function showHome_error(msg) {
  document.getElementById('cat-grid').innerHTML =
    `<div class="state"><div class="ico">⚠️</div><p>${esc(msg)}</p></div>`;
}

// Corrigir chamada
async function loadSection2(s) {
  showHome();
  document.getElementById('cat-grid').innerHTML =
    '<div class="state"><div class="spin"></div><p>CARREGANDO...</p></div>';
  try {
    const acts = {
      live:   ['get_live_categories',   'get_live_streams'],
      movies: ['get_vod_categories',    'get_vod_streams'],
      series: ['get_series_categories', 'get_series'],
    };
    const [cAct, sAct] = acts[s];
    const [cRaw, sRaw] = await Promise.all([apiCall(cAct), apiCall(sAct)]);
    allCats   = Array.isArray(cRaw) ? cRaw : [];
    allStreams = buildStreams(sRaw, s);
    filtCats  = allCats.filter(c => allStreams.some(st => st.cat === String(c.category_id)));
    renderHome();
    toast(`✅ ${allStreams.length} itens`, 'ok');
  } catch(e) {
    document.getElementById('cat-grid').innerHTML =
      `<div class="state"><div class="ico">⚠️</div><p>${esc(e.message)}</p></div>`;
    toast(e.message, 'err');
  }
}

function mkCatCard(name, count) {
  const d = document.createElement('div');
  d.className = 'cat-card';
  d.innerHTML = `<span class="cat-card-name">${esc(name)}</span><span class="cat-card-count">${count}</span>`;
  return d;
}

// ── ABRIR CATEGORIA ──────────────────────────
function openCat(idx, items, name) {
  activeCatIdx = idx;
  activeItems  = items;
  showPlayerView();
  document.getElementById('ch-cat-name').textContent = name;
  document.getElementById('ch-search').value = '';
  renderChList(items);
}

function backToCats() {
  showHome();
  document.getElementById('ch-list').innerHTML = '';
}

function prevCat() {
  if (activeCatIdx <= 0) return;
  activeCatIdx--;
  const c = filtCats[activeCatIdx];
  const items = allStreams.filter(s => s.cat === String(c.category_id));
  openCat(activeCatIdx, items, c.category_name || '—');
}

function nextCat() {
  if (activeCatIdx >= filtCats.length - 1) return;
  activeCatIdx++;
  const c = filtCats[activeCatIdx];
  const items = allStreams.filter(s => s.cat === String(c.category_id));
  openCat(activeCatIdx, items, c.category_name || '—');
}

function filterItems(q) {
  const lq = q.toLowerCase();
  renderChList(lq ? activeItems.filter(i => i.name.toLowerCase().includes(lq)) : activeItems);
}

// ── LISTA DE CANAIS ──────────────────────────
function renderChList(list) {
  const el    = document.getElementById('ch-list');
  const isLive = section === 'live';
  const isSer  = section === 'series';
  el.innerHTML = '';
  if (!list.length) { el.innerHTML='<div class="state"><div class="ico">🔍</div><p>VAZIO</p></div>'; return; }

  const frag = document.createDocumentFragment();
  list.forEach((item, i) => {
    const d = document.createElement('div');
    d.className = 'ch-item' + (activeUrl===item.url ? ' active' : '');
    d.dataset.id = item._id;

    const icon = isLive ? '📺' : isSer ? '📂' : '🎬';
    d.innerHTML = `
      <span class="ch-num">${item.num||i+1}</span>
      <div class="ch-logo">
        ${item.img
          ? `<img src="${esc(item.img)}" alt="" loading="lazy" onerror="this.style.display='none'">`
          : icon}
      </div>
      <div class="ch-info">
        <div class="ch-name">${esc(item.name)}</div>
        <div class="ch-sub">${isLive ? 'Ao vivo' : item.grp || ''}</div>
      </div>
      ${isLive ? '<div class="ch-dot"></div>' : ''}
      <button class="fav ${isFav(item._id)?'on':''}"
        onclick="hFav(event,'${esc(item._id)}')">⭐</button>`;

    d.addEventListener('click', e => {
      if (e.target.classList.contains('fav')) return;
      if (isSer) { openSeries(item); return; }
      document.querySelectorAll('.ch-item').forEach(x=>x.classList.remove('active'));
      d.classList.add('active');
      startPlay(item);
    });
    frag.appendChild(d);
  });
  el.appendChild(frag);
}

function hFav(e, id) {
  e.stopPropagation();
  const item = allStreams.find(i=>i._id===id) || getFavs().find(f=>f._id===id);
  if (!item) return;
  const on = toggleFav(item);
  e.currentTarget.classList.toggle('on', on);
  if (section==='favs') loadFavs();
}

// ── PLAYER ───────────────────────────────────
function startPlay(item) {
  activeUrl = item.url;

  // info col
  document.getElementById('info-badge').textContent =
    item.type==='live' ? 'AO VIVO' : item.type==='movies' ? 'FILME' : 'SÉRIE';
  document.getElementById('info-name').textContent  = item.name;
  document.getElementById('info-group').textContent = item.grp || '';
  document.getElementById('info-desc').textContent  = '';

  const th = document.getElementById('info-thumb');
  if (item.img && item.type !== 'live') {
    th.style.display = 'flex';
    th.innerHTML = `<img src="${esc(item.img)}" alt="" onerror="this.parentElement.style.display='none'">`;
  } else { th.style.display = 'none'; }

  playUrl(item.url, item.name, item.type==='live');
}

function playUrl(url, name, isLive) {
  retries = 0;
  const v = document.getElementById('video');
  document.getElementById('idle').style.display = 'none';
  if (hlsObj) { hlsObj.destroy(); hlsObj = null; }

  if (url.includes('.m3u8') && Hls.isSupported()) {
    hlsObj = new Hls({ enableWorker:true });
    hlsObj.loadSource(url);
    hlsObj.attachMedia(v);
    hlsObj.on(Hls.Events.MANIFEST_PARSED, (_,d) => {
      applyQ(hlsObj, d.levels);
      v.play().catch(()=>{});
    });
    hlsObj.on(Hls.Events.ERROR, (_,d) => {
      if (d.fatal && activeUrl===url) {
        retries++;
        if (retries<=4) { toast(`Reconectando (${retries}/4)…`,'err'); setTimeout(()=>playUrl(url,name,isLive), retries*2500); }
        else toast('Stream indisponível','err');
      }
    });
  } else {
    v.src = url; v.play().catch(()=>{});
  }
}

function applyQ(h, levels) {
  if (!levels?.length || qMode==='auto') { h.currentLevel=-1; return; }
  const sorted = levels.map((l,i)=>({i,h:l.height||0})).sort((a,b)=>a.h-b.h);
  if (qMode==='sd')  { h.currentLevel = sorted[0]?.i ?? -1; }
  if (qMode==='hd')  { h.currentLevel = (sorted.find(l=>l.h>=720) || sorted[Math.floor(sorted.length/2)])?.i ?? -1; }
  if (qMode==='fhd') { h.currentLevel = (sorted.find(l=>l.h>=1080) || sorted[sorted.length-1])?.i ?? -1; }
}

function setQ(q, btn) {
  qMode = q;
  document.querySelectorAll('.q-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  if (hlsObj) applyQ(hlsObj, hlsObj.levels);
  toast('Qualidade: '+q.toUpperCase());
}

function goFull() {
  const v = document.getElementById('video');
  (v.requestFullscreen||v.webkitRequestFullscreen).call(v);
}

// ── SÉRIES ───────────────────────────────────
async function openSeries(item) {
  document.querySelectorAll('.ch-item').forEach(x=>x.classList.remove('active'));
  document.querySelector(`.ch-item[data-id="${item._id}"]`)?.classList.add('active');

  const eb = document.getElementById('ep-box');
  document.getElementById('ep-box-title').textContent = item.name;
  document.getElementById('ep-seasons').innerHTML = '<div class="spin" style="margin:6px 14px"></div>';
  document.getElementById('ep-rows').innerHTML = '';
  eb.style.display = 'flex';

  // info col
  document.getElementById('info-badge').textContent = 'SÉRIE';
  document.getElementById('info-name').textContent  = item.name;
  document.getElementById('info-group').textContent = item.grp||'';
  const th = document.getElementById('info-thumb');
  if (item.img) {
    th.style.display='flex';
    th.innerHTML=`<img src="${esc(item.img)}" alt="" onerror="this.parentElement.style.display='none'">`;
  } else th.style.display='none';

  try {
    const d  = await apiCall('get_series_info','&series_id='+item.series_id);
    const es = d.episodes||{};
    if (d.info?.plot) document.getElementById('info-desc').textContent = d.info.plot;
    const ss = Object.keys(es).sort((a,b)=>+a-+b);
    const sEl = document.getElementById('ep-seasons');
    sEl.innerHTML='';
    if (!ss.length) { document.getElementById('ep-rows').innerHTML='<div class="state"><p>SEM EPISÓDIOS</p></div>'; return; }
    ss.forEach((s,i)=>{
      const b=document.createElement('button');
      b.className='sea'+(i===0?' active':'');
      b.textContent='Temp. '+s;
      b.onclick=()=>{ document.querySelectorAll('.sea').forEach(x=>x.classList.remove('active')); b.classList.add('active'); renderEps(es[s],item.name); };
      sEl.appendChild(b);
    });
    renderEps(es[ss[0]], item.name);
  } catch(e) {
    document.getElementById('ep-rows').innerHTML=`<div class="state"><p>${esc(e.message)}</p></div>`;
  }
}

function renderEps(eps, sname) {
  const el = document.getElementById('ep-rows');
  el.innerHTML='';
  if (!eps?.length) { el.innerHTML='<div class="state"><p>VAZIO</p></div>'; return; }
  const frag=document.createDocumentFragment();
  eps.forEach(ep=>{
    const url=`${S.server}/series/${S.user}/${S.pass}/${ep.id}.${ep.container_extension||'mkv'}`;
    const d=document.createElement('div');
    d.className='ep-row'+(activeUrl===url?' active':'');
    d.innerHTML=`<span class="ep-n">E${ep.episode_num}</span><span class="ep-nm">${esc(ep.title||'Ep.'+ep.episode_num)}</span>${ep.info?.duration?`<span class="ep-d">${esc(ep.info.duration)}</span>`:''}`;
    d.onclick=()=>{
      document.querySelectorAll('.ep-row').forEach(x=>x.classList.remove('active'));
      d.classList.add('active'); activeUrl=url;
      document.getElementById('info-name').textContent=`${sname} — E${ep.episode_num}`;
      document.getElementById('info-desc').textContent=ep.info?.plot||'';
      playUrl(url,`${sname} E${ep.episode_num}`,false);
    };
    frag.appendChild(d);
  });
  el.appendChild(frag);
}

function closeEp() { document.getElementById('ep-box').style.display='none'; }

// ── FAVORITOS ────────────────────────────────
function loadFavs() {
  allStreams=[]; allCats=[]; filtCats=[];
  const f=getFavs();
  showPlayerView();
  document.getElementById('ch-cat-name').textContent='⭐ FAVORITOS';
  activeItems=f; activeCatIdx=-1;
  renderChList(f);
}

// ── LOGOUT ───────────────────────────────────
function doLogout() {
  localStorage.removeItem('tron_session');
  sessionStorage.removeItem('tron_session');
  if (hlsObj) hlsObj.destroy();
  window.location.href='index.html';
}

// ── UTILS ────────────────────────────────────
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}

// ── TECLADO ──────────────────────────────────
document.addEventListener('keydown', e=>{
  if (e.target.tagName==='INPUT') return;
  if (e.key===' ')      { const v=document.getElementById('video'); if(v.src){e.preventDefault();v.paused?v.play():v.pause();} }
  if (e.key==='f')      goFull();
  if (e.key==='Escape') { closeEp(); if(searchOpen) toggleSearch(); }
  if (e.key==='ArrowLeft')  prevCat();
  if (e.key==='ArrowRight') nextCat();
});

// Corrige a função navTo para usar loadSection2
const _origNavTo = navTo;
window.navTo = function(s) {
  section = s;
  document.querySelectorAll('.ntab').forEach(b=>b.classList.toggle('active', b.dataset.s===s));
  document.getElementById('bar-mode').textContent =
    s==='live'?'AO VIVO': s==='movies'?'FILMES': s==='series'?'SÉRIES':'FAVORITOS';
  closeEp();
  if (s==='favs') { loadFavs(); return; }
  loadSection2(s);
};
// chama imediatamente com live
loadSection2('live');
