// ── SESSÃO ──────────────────────────────────
const S = (() => {
  try {
    return JSON.parse(localStorage.getItem('tron_session') || 'null') ||
           JSON.parse(sessionStorage.getItem('tron_session') || 'null');
  } catch { return null; }
})();
if (!S?.server) { window.location.replace('index.html'); }

// ── PROXY POOL ───────────────────────────────
const PX = [
  u => u,
  u => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  u => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
  u => `https://api.cors.lol/?url=${encodeURIComponent(u)}`,
];

async function api(action, extra = '') {
  const raw = `${S.server}/player_api.php?username=${S.user}&password=${S.pass}&action=${action}${extra}`;
  for (let i = 0; i < PX.length; i++) {
    try {
      const r = await fetch(PX[i](raw), { signal: AbortSignal.timeout(12000) });
      if (!r.ok) continue;
      const txt = await r.text();
      if (!txt?.trim()) continue;
      const d = JSON.parse(txt);
      return d;
    } catch (e) { console.warn('proxy', i, e.message); }
  }
  throw new Error('Servidor inacessível');
}

// ── ESTADO ──────────────────────────────────
let section = 'live';
let cats    = [];      // [{cat_id, category_name}]
let streams = [];      // todos os streams carregados
let activeCat  = null;
let activeUrl  = null;
let hls        = null;
let retries    = 0;

// ── INIT ─────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  navTo('live');
});

// ── TOAST ────────────────────────────────────
function toast(msg, cls = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast show ' + cls;
  clearTimeout(el._t);
  el._t = setTimeout(() => el.className = 'toast', 2800);
}

// ── FAVORITOS ────────────────────────────────
const getFavs  = () => { try { return JSON.parse(localStorage.getItem('tfavs') || '[]'); } catch { return []; } };
const saveFavs = a  => localStorage.setItem('tfavs', JSON.stringify(a));
const isFav    = id => getFavs().some(f => f._id === id);
function toggleFav(item) {
  let f = getFavs();
  const i = f.findIndex(x => x._id === item._id);
  if (i >= 0) { f.splice(i, 1); saveFavs(f); toast('Removido', 'err'); return false; }
  f.push(item); saveFavs(f); toast('⭐ Adicionado!', 'ok'); return true;
}

// ── NAVEGAÇÃO ────────────────────────────────
function navTo(s) {
  section = s;
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.s === s));
  document.getElementById('srch').value = '';
  activeCat = null;
  closeEp();
  resetItemList();

  if (s === 'favs') { showFavs(); return; }
  loadSection(s);
}

async function loadSection(s) {
  setCatLoad();
  try {
    if (s === 'live') {
      // categorias + streams em paralelo
      const [cData, sData] = await Promise.all([
        api('get_live_categories'),
        api('get_live_streams'),
      ]);
      cats    = Array.isArray(cData) ? cData : [];
      streams = Array.isArray(sData) ? sData.map(c => ({
        _id:   'l_' + c.stream_id,
        name:  c.name || '—',
        url:   `${S.server}/live/${S.user}/${S.pass}/${c.stream_id}.m3u8`,
        img:   c.stream_icon || '',
        group: c.category_name || '',
        cat:   String(c.category_id || ''),
        type:  'live',
      })) : [];
    } else if (s === 'movies') {
      const [cData, sData] = await Promise.all([
        api('get_vod_categories'),
        api('get_vod_streams'),
      ]);
      cats    = Array.isArray(cData) ? cData : [];
      streams = Array.isArray(sData) ? sData.map(m => ({
        _id:   'm_' + m.stream_id,
        name:  m.name || '—',
        url:   `${S.server}/movie/${S.user}/${S.pass}/${m.stream_id}.${m.container_extension || 'mp4'}`,
        img:   m.stream_icon || '',
        group: m.category_name || '',
        cat:   String(m.category_id || ''),
        type:  'movies',
      })) : [];
    } else if (s === 'series') {
      const [cData, sData] = await Promise.all([
        api('get_series_categories'),
        api('get_series'),
      ]);
      cats    = Array.isArray(cData) ? cData : [];
      streams = Array.isArray(sData) ? sData.map(s => ({
        _id:       'sr_' + s.series_id,
        name:      s.name || '—',
        url:       null,
        img:       s.cover || '',
        group:     s.category_name || '',
        cat:       String(s.category_id || ''),
        type:      'series',
        series_id: s.series_id,
      })) : [];
    }
    renderCats();
    toast(`✅ ${streams.length} itens`, 'ok');
  } catch (e) {
    document.getElementById('cat-list').innerHTML =
      `<div class="state"><div class="ico">⚠️</div><p>${e.message}</p></div>`;
    toast(e.message, 'err');
  }
}

// ── CATEGORIAS ───────────────────────────────
function setCatLoad() {
  document.getElementById('cat-list').innerHTML =
    '<div class="state"><div class="spin"></div><p>CARREGANDO...</p></div>';
  document.getElementById('item-list').innerHTML = '';
  document.getElementById('items-head').textContent = 'SELECIONE UMA CATEGORIA';
}

function renderCats() {
  const el = document.getElementById('cat-list');
  el.innerHTML = '';

  // "Todos" no topo
  const all = mk('div', 'cat', 'Todos');
  all.onclick = () => { setActiveCat(null, all); showItems(streams); };
  el.appendChild(all);

  cats.forEach(c => {
    const d = mk('div', 'cat', c.category_name || '—');
    d.dataset.id = c.category_id;
    d.onclick = () => {
      setActiveCat(c.category_id, d);
      showItems(streams.filter(s => s.cat === String(c.category_id)));
    };
    el.appendChild(d);
  });
}

function setActiveCat(id, el) {
  activeCat = id;
  document.querySelectorAll('.cat').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
}

// ── ITENS ────────────────────────────────────
function resetItemList() {
  document.getElementById('item-list').innerHTML = '';
  document.getElementById('items-head').textContent = 'SELECIONE UMA CATEGORIA';
}

function showItems(list) {
  const el   = document.getElementById('item-list');
  const head = document.getElementById('items-head');
  head.textContent = list.length + ' itens';
  el.innerHTML = '';
  if (!list.length) { el.innerHTML = '<div class="state"><div class="ico">🔍</div><p>VAZIO</p></div>'; return; }

  const isLive = section === 'live';
  const isSer  = section === 'series';
  const frag   = document.createDocumentFragment();

  list.forEach(item => {
    const d = document.createElement('div');
    d.className = 'item' + (activeUrl === item.url ? ' active' : '');
    d.dataset.id = item._id;

    const imgH = item.img
      ? `<img src="${esc(item.img)}" alt="" loading="lazy" onerror="this.style.display='none'">`
      : (isLive ? '📺' : isSer ? '📂' : '🎬');

    d.innerHTML = `
      <div class="item-img${isSer ? ' tall' : ''}">${imgH}</div>
      <div class="item-txt">
        <div class="item-name">${esc(item.name)}</div>
        ${item.group ? `<div class="item-sub">${esc(item.group)}</div>` : ''}
      </div>
      ${isLive ? '<div class="dot-live"></div>' : ''}
      <button class="fav ${isFav(item._id) ? 'on' : ''}"
        onclick="hFav(event,'${esc(item._id)}')">⭐</button>`;

    d.addEventListener('click', e => {
      if (e.target.classList.contains('fav')) return;
      if (isSer) { openSeries(item); return; }
      document.querySelectorAll('.item').forEach(x => x.classList.remove('active'));
      d.classList.add('active');
      startPlay(item);
    });

    frag.appendChild(d);
  });
  el.appendChild(frag);
}

function hFav(e, id) {
  e.stopPropagation();
  const item = streams.find(i => i._id === id) || getFavs().find(f => f._id === id);
  if (!item) return;
  const on = toggleFav(item);
  e.currentTarget.classList.toggle('on', on);
  if (section === 'favs') showFavs();
}

// ── BUSCA ────────────────────────────────────
function doSearch(q) {
  if (section === 'favs') { showItems(getFavs().filter(f => f.name?.toLowerCase().includes(q.toLowerCase()))); return; }
  if (!streams.length) return;
  const lq = q.toLowerCase();
  const base = activeCat ? streams.filter(s => s.cat === String(activeCat)) : streams;
  showItems(lq ? base.filter(s => s.name.toLowerCase().includes(lq)) : base);
}

// ── PLAYER ───────────────────────────────────
function startPlay(item) {
  activeUrl = item.url;
  document.getElementById('now').style.display = 'block';
  document.getElementById('now-n').textContent = item.name;
  document.getElementById('now-g').textContent = item.group || '';
  playUrl(item.url, item.name, item.type === 'live');
}

function playUrl(url, name, isLive) {
  retries = 0;
  const v = document.getElementById('video');
  document.getElementById('idle').style.display = 'none';
  document.getElementById('pip').style.display  = 'flex';
  document.getElementById('pip-name').textContent = name;
  document.getElementById('pip-live').textContent = isLive ? '🔴 AO VIVO' : '';

  if (hls) { hls.destroy(); hls = null; }

  if (url.includes('.m3u8') && Hls.isSupported()) {
    hls = new Hls({ enableWorker: true });
    hls.loadSource(url);
    hls.attachMedia(v);
    hls.on(Hls.Events.MANIFEST_PARSED, () => v.play().catch(() => {}));
    hls.on(Hls.Events.ERROR, (_, d) => {
      if (d.fatal && activeUrl === url) {
        retries++;
        if (retries <= 4) setTimeout(() => playUrl(url, name, isLive), retries * 2000);
        else toast('Falha no stream', 'err');
      }
    });
  } else {
    v.src = url; v.play().catch(() => {});
  }
}

// ── SÉRIES ───────────────────────────────────
async function openSeries(item) {
  document.querySelectorAll('.item').forEach(x => x.classList.remove('active'));
  const row = document.querySelector(`.item[data-id="${item._id}"]`);
  if (row) row.classList.add('active');

  const ew = document.getElementById('ep-wrap');
  document.getElementById('ep-title').textContent = item.name;
  document.getElementById('seasons').innerHTML = '<div class="spin" style="margin:6px auto"></div>';
  document.getElementById('ep-list').innerHTML = '';
  ew.style.display = 'flex';

  try {
    const d   = await api('get_series_info', '&series_id=' + item.series_id);
    const eps = d.episodes || {};
    const ss  = Object.keys(eps).sort((a, b) => +a - +b);
    const sEl = document.getElementById('seasons');
    sEl.innerHTML = '';
    if (!ss.length) { document.getElementById('ep-list').innerHTML = '<div class="state"><p>SEM EPISÓDIOS</p></div>'; return; }
    ss.forEach((s, i) => {
      const b = mk('button', 'sea' + (i === 0 ? ' active' : ''), 'T' + s);
      b.onclick = () => { document.querySelectorAll('.sea').forEach(x => x.classList.remove('active')); b.classList.add('active'); renderEps(eps[s], item.name); };
      sEl.appendChild(b);
    });
    renderEps(eps[ss[0]], item.name);
  } catch (e) {
    document.getElementById('ep-list').innerHTML = `<div class="state"><p>${e.message}</p></div>`;
  }
}

function renderEps(eps, sname) {
  const el = document.getElementById('ep-list');
  el.innerHTML = '';
  if (!eps?.length) { el.innerHTML = '<div class="state"><p>VAZIO</p></div>'; return; }
  const frag = document.createDocumentFragment();
  eps.forEach(ep => {
    const url = `${S.server}/series/${S.user}/${S.pass}/${ep.id}.${ep.container_extension || 'mkv'}`;
    const d   = document.createElement('div');
    d.className = 'ep-row' + (activeUrl === url ? ' active' : '');
    d.innerHTML = `<span class="ep-n">E${ep.episode_num}</span><span class="ep-nm">${esc(ep.title || 'Ep.' + ep.episode_num)}</span>${ep.info?.duration ? `<span class="ep-d">${ep.info.duration}</span>` : ''}`;
    d.onclick = () => {
      document.querySelectorAll('.ep-row').forEach(x => x.classList.remove('active'));
      d.classList.add('active');
      activeUrl = url;
      document.getElementById('now').style.display = 'block';
      document.getElementById('now-n').textContent = `${sname} · E${ep.episode_num}`;
      document.getElementById('now-g').textContent = ep.title || '';
      playUrl(url, `${sname} E${ep.episode_num}`, false);
    };
    frag.appendChild(d);
  });
  el.appendChild(frag);
}

function closeEp() { document.getElementById('ep-wrap').style.display = 'none'; }

// ── FAVORITOS PAGE ───────────────────────────
function showFavs() {
  const f = getFavs();
  document.getElementById('cat-list').innerHTML  = '<div class="cat active">⭐ Todos favoritos</div>';
  document.getElementById('items-head').textContent = f.length + ' favoritos';
  showItems(f);
}

// ── LOGOUT ───────────────────────────────────
function doLogout() {
  localStorage.removeItem('tron_session');
  sessionStorage.removeItem('tron_session');
  if (hls) hls.destroy();
  window.location.href = 'index.html';
}

// ── UTILS ────────────────────────────────────
function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function mk(tag, cls, txt) {
  const el = document.createElement(tag);
  el.className = cls;
  if (txt) el.textContent = txt;
  return el;
}

// ── TECLADO ──────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  if (e.key === ' ') { const v = document.getElementById('video'); if (v.src) { e.preventDefault(); v.paused ? v.play() : v.pause(); } }
  if (e.key === 'f') { const v = document.getElementById('video'); if (v.requestFullscreen) v.requestFullscreen(); }
  if (e.key === 'Escape') closeEp();
});
