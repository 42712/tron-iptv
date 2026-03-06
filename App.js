// ══════════════════════════════════════════════
//  GUARD
// ══════════════════════════════════════════════
const SESSION = (function () {
  try {
    return (
      JSON.parse(localStorage.getItem('tron_session')   || 'null') ||
      JSON.parse(sessionStorage.getItem('tron_session') || 'null')
    );
  } catch (_) { return null; }
})();
if (!SESSION || !SESSION.server || !SESSION.user || !SESSION.pass) {
  window.location.replace('index.html');
}
const S = SESSION || {};

// ══════════════════════════════════════════════
//  CORS PROXY POOL
// ══════════════════════════════════════════════
const PROXIES = [
  u => u,                                                                     // direto
  u => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,        // allorigins
  u => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,                 // corsproxy
  u => `https://api.cors.lol/?url=${encodeURIComponent(u)}`,                 // cors.lol
  u => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,   // codetabs
];

async function fetchAPI(action, extra = '') {
  const raw = `${S.server}/player_api.php?username=${S.user}&password=${S.pass}&action=${action}${extra}`;
  for (let i = 0; i < PROXIES.length; i++) {
    try {
      const res = await fetch(PROXIES[i](raw), { signal: AbortSignal.timeout(10000) });
      if (!res.ok) continue;
      const text = await res.text();
      if (!text || text.trim() === '') continue;
      const data = JSON.parse(text);
      console.info(`[proxy #${i}] OK — ${action}`);
      return data;
    } catch (e) {
      console.warn(`[proxy #${i}] falhou:`, e.message);
    }
  }
  throw new Error('Servidor inacessível. Verifique URL, usuário e senha.');
}

// ══════════════════════════════════════════════
//  STATE
// ══════════════════════════════════════════════
let currentSection = 'live';
let currentUrl     = null;
let activeItem     = null;
let allItems       = [];
let hlsInstance    = null;
let retryTimer     = null;
let retryCount     = 0;
const MAX_RETRY    = 5;

// ══════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  try {
    const host = new URL(S.server).hostname;
    document.getElementById('server-info').textContent = host;
  } catch (_) {}
  updateFavCount();
  navTo('live');
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
});

// ══════════════════════════════════════════════
//  TOAST
// ══════════════════════════════════════════════
function toast(msg, type = 'info', ms = 3000) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast show ' + type;
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), ms);
}

// ══════════════════════════════════════════════
//  FAVORITOS
// ══════════════════════════════════════════════
function getFavs()        { try { return JSON.parse(localStorage.getItem('tron_favs') || '[]'); } catch { return []; } }
function saveFavs(arr)    { localStorage.setItem('tron_favs', JSON.stringify(arr)); updateFavCount(); }
function isFaved(id)      { return getFavs().some(f => f._id === id); }
function updateFavCount() {
  const n = getFavs().length;
  const el = document.getElementById('cnt-favs');
  if (el) el.textContent = n || '';
}
function toggleFav(item) {
  let favs = getFavs();
  const idx = favs.findIndex(f => f._id === item._id);
  if (idx >= 0) { favs.splice(idx, 1); saveFavs(favs); toast('Removido dos favoritos', 'error'); return false; }
  favs.push(item); saveFavs(favs); toast('⭐ Adicionado aos favoritos', 'success'); return true;
}

// ══════════════════════════════════════════════
//  COUNTERS
// ══════════════════════════════════════════════
function setCount(section, n) {
  const map = { live: 'cnt-live', movies: 'cnt-movies', series: 'cnt-series' };
  const el = document.getElementById(map[section]);
  if (el) el.textContent = n || '';
  document.getElementById('section-count').textContent = n + ' itens';
}

// ══════════════════════════════════════════════
//  NAVIGATION
// ══════════════════════════════════════════════
function navTo(section) {
  currentSection = section;
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.section === section));
  document.getElementById('search-input').value = '';
  closeEpPanel();
  const titles = { live:'CANAIS AO VIVO', movies:'FILMES', series:'SÉRIES', favs:'FAVORITOS' };
  document.getElementById('section-title').textContent = titles[section] || '';
  if (section === 'live')        loadLive();
  else if (section === 'movies') loadMovies();
  else if (section === 'series') loadSeries();
  else if (section === 'favs')   loadFavs();
}

// ══════════════════════════════════════════════
//  LIST RENDERING
// ══════════════════════════════════════════════
function escH(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function showLoading() {
  document.getElementById('list-area').innerHTML =
    '<div class="state-box"><div class="loader"></div><p>CARREGANDO...</p></div>';
  document.getElementById('filter-bar').innerHTML = '';
}

function showEmpty(msg = 'NENHUM ITEM') {
  document.getElementById('list-area').innerHTML =
    `<div class="state-box"><div class="icon">🔍</div><p>${msg}</p></div>`;
}

function showErr(msg) {
  document.getElementById('list-area').innerHTML =
    `<div class="state-box"><div class="icon">⚠️</div><p>${escH(msg)}</p></div>`;
}

// Renderiza lista vertical (uma linha por item)
function renderList(items, type) {
  const area = document.getElementById('list-area');
  area.innerHTML = '';
  if (!items.length) { showEmpty(); return; }

  const frag = document.createDocumentFragment();

  items.forEach(item => {
    const div = document.createElement('div');
    div.className = 'item-row' + (currentUrl === item.url ? ' active' : '');
    div.dataset.id = item._id;

    const isPortrait = type !== 'live';
    const icon = type === 'live' ? '📺' : type === 'movies' ? '🎬' : '📂';
    const faved = isFaved(item._id);

    div.innerHTML = `
      <div class="item-thumb ${isPortrait ? 'portrait' : ''}">
        ${item.img
          ? `<img src="${escH(item.img)}" alt="" loading="lazy" onerror="this.outerHTML='<span class=\\"thumb-icon\\">${icon}</span>'">`
          : `<span class="thumb-icon">${icon}</span>`}
      </div>
      <div class="item-info">
        <div class="item-name">${escH(item.name)}</div>
        ${item.group ? `<div class="item-meta">${escH(item.group)}</div>` : ''}
      </div>
      <div class="item-actions">
        ${type === 'live' ? '<div class="live-dot"></div>' : ''}
        <button class="fav-btn ${faved ? 'faved' : ''}"
          title="Favorito"
          onclick="handleFav(event,'${escH(item._id)}')">⭐</button>
      </div>`;

    div.addEventListener('click', (e) => {
      if (e.target.classList.contains('fav-btn')) return;
      if (type === 'series') { openSeries(item); return; }
      // marca item ativo
      document.querySelectorAll('.item-row').forEach(r => r.classList.remove('active'));
      div.classList.add('active');
      playItem(item, type);
    });

    frag.appendChild(div);
  });

  area.appendChild(frag);
}

function handleFav(e, id) {
  e.stopPropagation();
  const item = allItems.find(i => i._id === id) || getFavs().find(f => f._id === id);
  if (!item) return;
  const now = toggleFav(item);
  e.currentTarget.classList.toggle('faved', now);
  if (currentSection === 'favs') loadFavs();
}

// ══════════════════════════════════════════════
//  FILTERS
// ══════════════════════════════════════════════
function renderFilters(items) {
  const bar = document.getElementById('filter-bar');
  const groups = [...new Set(items.map(i => i.group).filter(Boolean))].slice(0, 80);
  bar.innerHTML = '';
  if (!groups.length) return;

  const all = document.createElement('button');
  all.className = 'filter-chip active';
  all.textContent = 'Todos';
  all.onclick = () => { setChip(all); renderList(allItems, currentSection); };
  bar.appendChild(all);

  groups.forEach(g => {
    const btn = document.createElement('button');
    btn.className = 'filter-chip';
    btn.textContent = g;
    btn.onclick = () => {
      setChip(btn);
      renderList(allItems.filter(i => i.group === g), currentSection);
    };
    bar.appendChild(btn);
  });
}
function setChip(el) {
  document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
}

// ══════════════════════════════════════════════
//  SEARCH
// ══════════════════════════════════════════════
function doSearch(q) {
  if (!allItems.length) return;
  const lq = q.toLowerCase().trim();
  const filtered = lq ? allItems.filter(i => i.name.toLowerCase().includes(lq)) : allItems;
  renderList(filtered, currentSection);
}

// ══════════════════════════════════════════════
//  PLAYER
// ══════════════════════════════════════════════
function playItem(item, type) {
  currentUrl = item.url;
  activeItem = item;

  // now-info
  const ni = document.getElementById('now-info');
  ni.style.display = 'block';
  document.getElementById('now-name').textContent  = item.name;
  document.getElementById('now-group').textContent = item.group || '';

  play(item.url, item.name, type === 'live');
}

function play(url, name, isLive) {
  clearTimeout(retryTimer);
  retryCount = 0;
  currentUrl = url;

  const video = document.getElementById('video');
  document.getElementById('player-idle').style.display = 'none';

  const piEl   = document.getElementById('player-info');
  const nameEl = document.getElementById('player-info-name');
  const dotEl  = document.getElementById('status-dot');
  const txtEl  = document.getElementById('status-text');
  piEl.style.display   = 'flex';
  nameEl.textContent   = name || '';
  dotEl.className      = 'dot' + (isLive ? ' live' : '');
  txtEl.textContent    = isLive ? 'AO VIVO' : 'REPRODUZINDO';

  if (hlsInstance) { hlsInstance.destroy(); hlsInstance = null; }

  if (url.includes('.m3u8') && Hls.isSupported()) {
    hlsInstance = new Hls({ enableWorker: true, lowLatencyMode: true });
    hlsInstance.loadSource(url);
    hlsInstance.attachMedia(video);
    hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => video.play().catch(() => {}));
    hlsInstance.on(Hls.Events.ERROR, (_, d) => {
      if (d.fatal && currentUrl === url) {
        retryCount++;
        if (retryCount <= MAX_RETRY) {
          const delay = Math.min(retryCount * 2000, 8000);
          toast(`Reconectando… (${retryCount}/${MAX_RETRY})`, 'error', delay);
          retryTimer = setTimeout(() => play(url, name, isLive), delay);
        } else {
          toast('Não foi possível conectar ao stream', 'error');
        }
      }
    });
  } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
    video.src = url; video.play().catch(() => {});
  } else {
    video.src = url; video.play().catch(() => {});
  }
}

function stopPlayer() {
  if (hlsInstance) { hlsInstance.destroy(); hlsInstance = null; }
  clearTimeout(retryTimer);
  const v = document.getElementById('video');
  v.pause(); v.src = '';
  document.getElementById('player-idle').style.display  = 'flex';
  document.getElementById('player-info').style.display  = 'none';
  document.getElementById('now-info').style.display     = 'none';
  currentUrl = null; activeItem = null;
}

// ══════════════════════════════════════════════
//  AUTH
// ══════════════════════════════════════════════
function doLogout() {
  localStorage.removeItem('tron_session');
  sessionStorage.removeItem('tron_session');
  stopPlayer();
  window.location.href = 'index.html';
}

// ══════════════════════════════════════════════
//  LOAD LIVE — usa getCategories + streams lazy
// ══════════════════════════════════════════════
async function loadLive() {
  showLoading();
  try {
    const data = await fetchAPI('get_live_streams');
    if (!Array.isArray(data)) throw new Error('Resposta inválida');
    allItems = data.map(c => ({
      _id:   'l_' + c.stream_id,
      name:  c.name || 'Canal',
      url:   `${S.server}/live/${S.user}/${S.pass}/${c.stream_id}.m3u8`,
      img:   c.stream_icon || '',
      group: c.category_name || '',
    }));
    setCount('live', allItems.length);
    renderFilters(allItems);
    renderList(allItems, 'live');
    toast(`✅ ${allItems.length} canais`, 'success', 2500);
  } catch (e) { showErr(e.message); toast(e.message, 'error'); }
}

// ══════════════════════════════════════════════
//  LOAD MOVIES
// ══════════════════════════════════════════════
async function loadMovies() {
  showLoading();
  try {
    const data = await fetchAPI('get_vod_streams');
    if (!Array.isArray(data)) throw new Error('Resposta inválida');
    allItems = data.map(m => ({
      _id:   'm_' + m.stream_id,
      name:  m.name || 'Filme',
      url:   `${S.server}/movie/${S.user}/${S.pass}/${m.stream_id}.${m.container_extension || 'mp4'}`,
      img:   m.stream_icon || '',
      group: m.category_name || '',
    }));
    setCount('movies', allItems.length);
    renderFilters(allItems);
    renderList(allItems, 'movies');
    toast(`✅ ${allItems.length} filmes`, 'success', 2500);
  } catch (e) { showErr(e.message); toast(e.message, 'error'); }
}

// ══════════════════════════════════════════════
//  LOAD SERIES
// ══════════════════════════════════════════════
async function loadSeries() {
  showLoading();
  try {
    const data = await fetchAPI('get_series');
    if (!Array.isArray(data)) throw new Error('Resposta inválida');
    allItems = data.map(s => ({
      _id:       's_' + s.series_id,
      name:      s.name || 'Série',
      url:       null,
      img:       s.cover || (Array.isArray(s.backdrop_path) ? s.backdrop_path[0] : '') || '',
      group:     s.category_name || '',
      series_id: s.series_id,
    }));
    setCount('series', allItems.length);
    renderFilters(allItems);
    renderList(allItems, 'series');
    toast(`✅ ${allItems.length} séries`, 'success', 2500);
  } catch (e) { showErr(e.message); toast(e.message, 'error'); }
}

// ══════════════════════════════════════════════
//  SERIES — EPISÓDIOS
// ══════════════════════════════════════════════
async function openSeries(item) {
  // marca na lista
  document.querySelectorAll('.item-row').forEach(r => r.classList.remove('active'));
  const row = document.querySelector(`.item-row[data-id="${item._id}"]`);
  if (row) row.classList.add('active');

  const panel = document.getElementById('ep-panel');
  document.getElementById('ep-series-name').textContent = item.name;
  document.getElementById('season-tabs').innerHTML = '<div class="loader" style="margin:4px auto"></div>';
  document.getElementById('ep-list').innerHTML = '';
  panel.style.display = 'flex';

  try {
    const data = await fetchAPI('get_series_info', '&series_id=' + item.series_id);
    const eps  = data.episodes || {};
    const seasons = Object.keys(eps).sort((a, b) => +a - +b);
    const tabs = document.getElementById('season-tabs');
    tabs.innerHTML = '';
    if (!seasons.length) {
      document.getElementById('ep-list').innerHTML =
        '<div style="color:var(--text-dim);padding:8px;font-size:12px;">Nenhum episódio</div>';
      return;
    }
    seasons.forEach((s, i) => {
      const btn = document.createElement('button');
      btn.className = 'season-tab' + (i === 0 ? ' active' : '');
      btn.textContent = 'T' + s;
      btn.onclick = () => {
        document.querySelectorAll('.season-tab').forEach(t => t.classList.remove('active'));
        btn.classList.add('active');
        renderEps(eps[s], item.name);
      };
      tabs.appendChild(btn);
    });
    renderEps(eps[seasons[0]], item.name);
  } catch (e) {
    document.getElementById('ep-list').innerHTML =
      `<div style="color:var(--accent);padding:8px;font-size:12px;">Erro: ${e.message}</div>`;
  }
}

function renderEps(eps, seriesName) {
  const list = document.getElementById('ep-list');
  list.innerHTML = '';
  if (!eps || !eps.length) {
    list.innerHTML = '<div style="color:var(--text-dim);padding:8px;font-size:12px;">Sem episódios</div>';
    return;
  }
  eps.forEach(ep => {
    const url = `${S.server}/series/${S.user}/${S.pass}/${ep.id}.${ep.container_extension || 'mkv'}`;
    const div = document.createElement('div');
    div.className = 'ep-item' + (currentUrl === url ? ' active' : '');
    div.innerHTML = `
      <span class="ep-num">E${ep.episode_num}</span>
      <span class="ep-name">${escH(ep.title || 'Episódio ' + ep.episode_num)}</span>
      ${ep.info?.duration ? `<span class="ep-dur">${escH(ep.info.duration)}</span>` : ''}`;
    div.onclick = () => {
      document.querySelectorAll('.ep-item').forEach(e => e.classList.remove('active'));
      div.classList.add('active');
      const label = `${seriesName} · E${ep.episode_num}${ep.title ? ' — ' + ep.title : ''}`;
      document.getElementById('now-info').style.display = 'block';
      document.getElementById('now-name').textContent   = label;
      document.getElementById('now-group').textContent  = '';
      play(url, label, false);
    };
    list.appendChild(div);
  });
}

function closeEpPanel() {
  document.getElementById('ep-panel').style.display = 'none';
}

// ══════════════════════════════════════════════
//  FAVORITOS PAGE
// ══════════════════════════════════════════════
function loadFavs() {
  allItems = getFavs();
  updateFavCount();
  document.getElementById('filter-bar').innerHTML = '';
  document.getElementById('section-count').textContent = allItems.length + ' itens';
  if (!allItems.length) { showEmpty('NENHUM FAVORITO AINDA'); return; }
  renderList(allItems, 'live');
}

// ══════════════════════════════════════════════
//  KEYBOARD
// ══════════════════════════════════════════════
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  if (e.key === 'f' || e.key === 'F') {
    const v = document.getElementById('video');
    if (v.requestFullscreen) v.requestFullscreen();
  }
  if (e.key === ' ') {
    const v = document.getElementById('video');
    if (v.src || v.currentSrc) { e.preventDefault(); v.paused ? v.play() : v.pause(); }
  }
  if (e.key === 'Escape') closeEpPanel();
});
