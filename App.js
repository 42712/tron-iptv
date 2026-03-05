// ══════════════════════════════════════════════
//  GUARD — redirect to login if no session
// ══════════════════════════════════════════════
const SESSION = (function () {
  try {
    return (
      JSON.parse(localStorage.getItem('tron_session') || 'null') ||
      JSON.parse(sessionStorage.getItem('tron_session') || 'null')
    );
  } catch (_) { return null; }
})();

if (!SESSION || !SESSION.server || !SESSION.user || !SESSION.pass) {
  window.location.replace('index.html');
}

const S = SESSION || {};

// ══════════════════════════════════════════════
//  STATE
// ══════════════════════════════════════════════
let currentSection  = 'live';
let currentPlaying  = null;
let allItems        = [];
let filteredItems   = [];
let hlsInstance     = null;
let retryTimer      = null;
let retryCount      = 0;
const MAX_RETRY     = 5;

// ══════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  // show server in topbar
  try {
    const host = new URL(S.server).hostname;
    document.getElementById('server-badge').textContent = host;
  } catch (_) {}

  updateFavCount();
  navTo('live');

  // register service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
});

// ══════════════════════════════════════════════
//  UTILS
// ══════════════════════════════════════════════
function toast(msg, type = 'info', duration = 3000) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast show ' + type;
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), duration);
}

function getFavs() {
  try { return JSON.parse(localStorage.getItem('tron_favs') || '[]'); }
  catch (_) { return []; }
}

function saveFavsStore(arr) {
  localStorage.setItem('tron_favs', JSON.stringify(arr));
  updateFavCount();
}

function isFaved(id) {
  return getFavs().some(f => f._id === id);
}

function toggleFav(item) {
  let favs = getFavs();
  const idx = favs.findIndex(f => f._id === item._id);
  if (idx >= 0) {
    favs.splice(idx, 1);
    saveFavsStore(favs);
    toast('Removido dos favoritos', 'error');
    return false;
  }
  favs.push(item);
  saveFavsStore(favs);
  toast('⭐ Adicionado aos favoritos', 'success');
  return true;
}

function updateFavCount() {
  const n = getFavs().length;
  ['cnt-favs', 'cnt-favs2'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = n;
  });
}

function updateCount(section, n) {
  const map = {
    live:   ['cnt-live',   'cnt-live2'],
    movies: ['cnt-movies', 'cnt-movies2'],
    series: ['cnt-series', 'cnt-series2'],
  };
  (map[section] || []).forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = n;
  });
}

function apiUrl(action, extra = '') {
  const raw = `${S.server}/player_api.php?username=${S.user}&password=${S.pass}&action=${action}${extra}`;
  return `https://corsproxy.io/?url=${encodeURIComponent(raw)}`;
}

function activateNav(section) {
  document.querySelectorAll('.nav-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.section === section);
  });
}

function showLoading() {
  document.getElementById('grid').innerHTML =
    '<div class="state-box"><div class="loader"></div><p>CARREGANDO...</p></div>';
  document.getElementById('filter-bar').innerHTML = '';
}

function showEmpty(msg = 'NENHUM ITEM ENCONTRADO') {
  document.getElementById('grid').innerHTML =
    `<div class="state-box"><div class="icon">🔍</div><p>${msg}</p></div>`;
}

function showError(msg) {
  document.getElementById('grid').innerHTML =
    `<div class="state-box"><div class="icon">⚠️</div><p>${msg}</p></div>`;
}

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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
//  PLAYER
// ══════════════════════════════════════════════
function play(url, name, isLive = false) {
  currentPlaying = url;
  clearTimeout(retryTimer);
  retryCount = 0;

  const video = document.getElementById('video');
  document.getElementById('player-idle').style.display = 'none';

  const nowPlaying = document.getElementById('now-playing');
  nowPlaying.textContent = name || '';
  nowPlaying.style.display = 'block';

  const statusEl  = document.getElementById('player-status');
  const dotEl     = document.getElementById('status-dot');
  const textEl    = document.getElementById('status-text');
  statusEl.style.display  = 'flex';
  dotEl.className  = 'status-dot ' + (isLive ? 'live' : '');
  textEl.textContent = isLive ? 'AO VIVO' : 'REPRODUZINDO';

  if (hlsInstance) { hlsInstance.destroy(); hlsInstance = null; }

  if (url.includes('.m3u8') && Hls.isSupported()) {
    hlsInstance = new Hls({ enableWorker: true, lowLatencyMode: true });
    hlsInstance.loadSource(url);
    hlsInstance.attachMedia(video);
    hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => video.play().catch(() => {}));
    hlsInstance.on(Hls.Events.ERROR, (_, data) => {
      if (data.fatal && currentPlaying === url) {
        retryCount++;
        if (retryCount <= MAX_RETRY) {
          const delay = Math.min(retryCount * 2000, 8000);
          toast(`Reconectando... (${retryCount}/${MAX_RETRY})`, 'error', delay);
          retryTimer = setTimeout(() => play(url, name, isLive), delay);
        } else {
          toast('Não foi possível conectar', 'error', 5000);
        }
      }
    });
  } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
    video.src = url;
    video.play().catch(() => {});
  } else {
    video.src = url;
    video.play().catch(() => {});
  }

  video.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function stopPlayer() {
  if (hlsInstance) { hlsInstance.destroy(); hlsInstance = null; }
  clearTimeout(retryTimer);
  const video = document.getElementById('video');
  video.pause(); video.src = '';
  document.getElementById('player-idle').style.display  = 'flex';
  document.getElementById('now-playing').style.display  = 'none';
  document.getElementById('player-status').style.display = 'none';
  currentPlaying = null;
}

// ══════════════════════════════════════════════
//  NAVIGATION
// ══════════════════════════════════════════════
function navTo(section) {
  currentSection = section;
  activateNav(section);
  closeEpPanel();
  document.getElementById('search-input').value = '';

  const titles = {
    live:   'CANAIS AO VIVO',
    movies: 'FILMES',
    series: 'SÉRIES',
    favs:   'FAVORITOS',
  };
  document.getElementById('section-title').textContent = titles[section] || '';

  if (section === 'live')        loadLive();
  else if (section === 'movies') loadMovies();
  else if (section === 'series') loadSeries();
  else if (section === 'favs')   loadFavs();
}

// ══════════════════════════════════════════════
//  CARDS
// ══════════════════════════════════════════════
function renderCards(items, type = 'live') {
  const grid = document.getElementById('grid');
  grid.innerHTML = '';

  if (!items.length) { showEmpty(); return; }

  document.getElementById('section-info').textContent = items.length + ' itens';

  items.forEach(item => {
    const faved      = isFaved(item._id);
    const imgSrc     = item.img || '';
    const isLandscape = type === 'live';
    const placeholder = type === 'live' ? '📺' : type === 'movies' ? '🎬' : '📂';

    const div = document.createElement('div');
    div.className = 'card' + (currentPlaying === item.url ? ' playing' : '');
    div.dataset.id = item._id;

    div.innerHTML = `
      <div class="card-img-wrap ${isLandscape ? 'landscape' : ''}">
        ${imgSrc
          ? `<img src="${escHtml(imgSrc)}" alt="" loading="lazy"
               onerror="this.parentElement.innerHTML='<div class=\\"card-no-img\\">${placeholder}</div>'">`
          : `<div class="card-no-img">${placeholder}</div>`}
        <div class="card-play-overlay">▶</div>
        ${type === 'live' ? '<div class="card-live-badge">LIVE</div>' : ''}
      </div>
      <div class="card-body">
        <div class="card-name">${escHtml(item.name)}</div>
        ${item.group ? `<div class="card-meta">${escHtml(item.group)}</div>` : ''}
      </div>
      <div class="card-footer">
        <button class="fav-btn ${faved ? 'faved' : ''}"
          title="${faved ? 'Remover favorito' : 'Adicionar favorito'}"
          onclick="handleFav(event,'${escHtml(item._id)}')">⭐</button>
      </div>`;

    div.addEventListener('click', () => {
      if (type === 'series') {
        openSeries(item);
      } else {
        document.querySelectorAll('.card').forEach(c => c.classList.remove('playing'));
        div.classList.add('playing');
        play(item.url, item.name, type === 'live');
      }
    });

    grid.appendChild(div);
  });
}

function handleFav(e, id) {
  e.stopPropagation();
  const item = allItems.find(i => i._id === id) || getFavs().find(f => f._id === id);
  if (!item) return;
  const nowFaved = toggleFav(item);
  const btn = e.currentTarget;
  btn.classList.toggle('faved', nowFaved);
  btn.title = nowFaved ? 'Remover favorito' : 'Adicionar favorito';
  if (currentSection === 'favs') loadFavs();
}

// ══════════════════════════════════════════════
//  FILTERS
// ══════════════════════════════════════════════
function renderFilters(items) {
  const bar    = document.getElementById('filter-bar');
  const groups = [...new Set(items.map(i => i.group).filter(Boolean))].slice(0, 60);
  bar.innerHTML = '';
  if (!groups.length) return;

  const allBtn = document.createElement('button');
  allBtn.className = 'filter-chip active';
  allBtn.textContent = 'Todos';
  allBtn.onclick = () => { filterByGroup(null); setActiveChip(allBtn); };
  bar.appendChild(allBtn);

  groups.forEach(g => {
    const btn = document.createElement('button');
    btn.className = 'filter-chip';
    btn.textContent = g;
    btn.onclick = () => { filterByGroup(g); setActiveChip(btn); };
    bar.appendChild(btn);
  });
}

function setActiveChip(el) {
  document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
}

function filterByGroup(group) {
  filteredItems = group ? allItems.filter(i => i.group === group) : [...allItems];
  renderCards(filteredItems, currentSection);
}

// ══════════════════════════════════════════════
//  SEARCH
// ══════════════════════════════════════════════
function doSearch(q) {
  if (!allItems.length) return;
  const lq = q.toLowerCase().trim();
  filteredItems = lq ? allItems.filter(i => i.name.toLowerCase().includes(lq)) : [...allItems];
  renderCards(filteredItems, currentSection);
}

// ══════════════════════════════════════════════
//  LOAD LIVE
// ══════════════════════════════════════════════
async function loadLive() {
  showLoading();
  try {
    const r = await fetch(apiUrl('get_live_streams'));
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const data = await r.json();
    allItems = data.map(c => ({
      _id:   'live_' + c.stream_id,
      name:  c.name  || 'Canal',
      url:   `${S.server}/live/${S.user}/${S.pass}/${c.stream_id}.m3u8`,
      img:   c.stream_icon || '',
      group: c.category_name || '',
      raw:   c,
    }));
    filteredItems = [...allItems];
    updateCount('live', allItems.length);
    renderFilters(allItems);
    renderCards(allItems, 'live');
  } catch (e) {
    showError('ERRO AO CARREGAR CANAIS');
    toast('Erro: ' + e.message, 'error');
  }
}

// ══════════════════════════════════════════════
//  LOAD MOVIES
// ══════════════════════════════════════════════
async function loadMovies() {
  showLoading();
  try {
    const r = await fetch(apiUrl('get_vod_streams'));
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const data = await r.json();
    allItems = data.map(m => ({
      _id:   'mov_' + m.stream_id,
      name:  m.name  || 'Filme',
      url:   `${S.server}/movie/${S.user}/${S.pass}/${m.stream_id}.${m.container_extension || 'mp4'}`,
      img:   m.stream_icon || '',
      group: m.category_name || '',
      raw:   m,
    }));
    filteredItems = [...allItems];
    updateCount('movies', allItems.length);
    renderFilters(allItems);
    renderCards(allItems, 'movies');
  } catch (e) {
    showError('ERRO AO CARREGAR FILMES');
    toast('Erro: ' + e.message, 'error');
  }
}

// ══════════════════════════════════════════════
//  LOAD SERIES
// ══════════════════════════════════════════════
async function loadSeries() {
  showLoading();
  try {
    const r = await fetch(apiUrl('get_series'));
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const data = await r.json();
    allItems = data.map(s => ({
      _id:       'ser_' + s.series_id,
      name:      s.name || 'Série',
      url:       null,
      img:       s.cover || (s.backdrop_path && s.backdrop_path[0]) || '',
      group:     s.category_name || '',
      series_id: s.series_id,
      raw:       s,
    }));
    filteredItems = [...allItems];
    updateCount('series', allItems.length);
    renderFilters(allItems);
    renderCards(allItems, 'series');
  } catch (e) {
    showError('ERRO AO CARREGAR SÉRIES');
    toast('Erro: ' + e.message, 'error');
  }
}

// ══════════════════════════════════════════════
//  SERIES EPISODES
// ══════════════════════════════════════════════
async function openSeries(item) {
  const panel = document.getElementById('ep-panel');
  document.getElementById('ep-title').textContent = item.name;
  document.getElementById('season-tabs').innerHTML =
    '<div class="loader" style="margin:8px auto"></div>';
  document.getElementById('ep-list').innerHTML = '';
  panel.style.display = 'block';
  panel.scrollIntoView({ behavior: 'smooth' });

  try {
    const r = await fetch(apiUrl('get_series_info', '&series_id=' + item.series_id));
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const data = await r.json();

    const episodes = data.episodes || {};
    const seasons  = Object.keys(episodes).sort((a, b) => +a - +b);
    const tabsEl   = document.getElementById('season-tabs');
    tabsEl.innerHTML = '';

    if (!seasons.length) {
      document.getElementById('ep-list').innerHTML =
        '<div style="color:var(--text-dim);padding:12px;font-size:13px;font-family:var(--mono)">Nenhum episódio encontrado</div>';
      return;
    }

    seasons.forEach((season, i) => {
      const btn = document.createElement('button');
      btn.className = 'season-tab' + (i === 0 ? ' active' : '');
      btn.textContent = 'T' + season;
      btn.onclick = () => {
        document.querySelectorAll('.season-tab').forEach(t => t.classList.remove('active'));
        btn.classList.add('active');
        renderEpisodes(episodes[season], item.name);
      };
      tabsEl.appendChild(btn);
    });

    renderEpisodes(episodes[seasons[0]], item.name);
  } catch (e) {
    document.getElementById('ep-list').innerHTML =
      `<div style="color:var(--accent);padding:12px;font-size:13px;">Erro: ${e.message}</div>`;
  }
}

function renderEpisodes(eps, seriesName) {
  const list = document.getElementById('ep-list');
  list.innerHTML = '';

  if (!eps || !eps.length) {
    list.innerHTML = '<div style="color:var(--text-dim);padding:12px;font-size:13px;">Sem episódios</div>';
    return;
  }

  eps.forEach(ep => {
    const ext = ep.container_extension || 'mkv';
    const url = `${S.server}/series/${S.user}/${S.pass}/${ep.id}.${ext}`;
    const div = document.createElement('div');
    div.className = 'ep-item' + (currentPlaying === url ? ' playing' : '');

    div.innerHTML = `
      <span class="ep-num">E${ep.episode_num}</span>
      <span class="ep-name">${escHtml(ep.title || 'Episódio ' + ep.episode_num)}</span>
      ${ep.info && ep.info.duration ? `<span class="ep-dur">${escHtml(ep.info.duration)}</span>` : ''}`;

    div.onclick = () => {
      document.querySelectorAll('.ep-item').forEach(el => el.classList.remove('playing'));
      div.classList.add('playing');
      const label = `${seriesName} · E${ep.episode_num}${ep.title ? ' — ' + ep.title : ''}`;
      play(url, label, false);
    };

    list.appendChild(div);
  });
}

function closeEpPanel() {
  document.getElementById('ep-panel').style.display = 'none';
}

// ══════════════════════════════════════════════
//  FAVORITES
// ══════════════════════════════════════════════
function loadFavs() {
  const favs = getFavs();
  allItems = favs; filteredItems = [...favs];
  updateFavCount();
  document.getElementById('filter-bar').innerHTML = '';
  document.getElementById('section-info').textContent = favs.length + ' itens';
  if (!favs.length) { showEmpty('NENHUM FAVORITO AINDA'); return; }
  renderCards(favs, 'live');
}

// ══════════════════════════════════════════════
//  KEYBOARD SHORTCUTS
// ══════════════════════════════════════════════
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;

  if (e.key === 'f' || e.key === 'F') {
    const v = document.getElementById('video');
    if (v.requestFullscreen) v.requestFullscreen();
  }

  if (e.key === ' ') {
    const v = document.getElementById('video');
    if (v.src || v.currentSrc) {
      e.preventDefault();
      v.paused ? v.play() : v.pause();
    }
  }

  if (e.key === 'Escape') closeEpPanel();

  // number shortcuts: 1=live 2=movies 3=series 4=favs
  const sections = ['', 'live', 'movies', 'series', 'favs'];
  if (sections[e.key]) navTo(sections[e.key]);
});
