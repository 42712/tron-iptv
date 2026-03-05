<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>TRON IPTV</title>
<link rel="stylesheet" href="style.css">
<link rel="manifest" href="manifest.json">
<link href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&family=Share+Tech+Mono&display=swap" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
</head>
<body>

<!-- TOP BAR -->
<div class="topbar">
  <div class="topbar-logo">TRON</div>
  <div class="search-wrap">
    <span class="search-icon">🔍</span>
    <input id="search-input" type="text" placeholder="Buscar..." oninput="doSearch(this.value)">
  </div>
  <div class="topbar-right">
    <span class="server-badge" id="server-badge"></span>
    <button class="logout-btn" onclick="doLogout()">⏻ SAIR</button>
  </div>
</div>

<div class="main-layout">

  <!-- SIDEBAR -->
  <aside class="sidebar">

    <!-- mobile nav (shown as tab bar on small screens) -->
    <div class="sidebar-section mobile-nav">
      <button class="nav-btn" data-section="live" onclick="navTo('live')">
        <span class="nav-icon">📺</span><span class="nav-label">Canais</span>
        <span class="nav-count" id="cnt-live">—</span>
      </button>
      <button class="nav-btn" data-section="movies" onclick="navTo('movies')">
        <span class="nav-icon">🎬</span><span class="nav-label">Filmes</span>
        <span class="nav-count" id="cnt-movies">—</span>
      </button>
      <button class="nav-btn" data-section="series" onclick="navTo('series')">
        <span class="nav-icon">📂</span><span class="nav-label">Séries</span>
        <span class="nav-count" id="cnt-series">—</span>
      </button>
      <button class="nav-btn" data-section="favs" onclick="navTo('favs')">
        <span class="nav-icon">⭐</span><span class="nav-label">Favoritos</span>
        <span class="nav-count" id="cnt-favs">—</span>
      </button>
    </div>

    <!-- desktop sidebar nav -->
    <div class="sidebar-section desktop-nav">
      <span class="sidebar-label">Navegar</span>
      <button class="nav-btn" data-section="live" onclick="navTo('live')">
        <span class="nav-icon">📺</span><span class="nav-label">Canais ao Vivo</span>
        <span class="nav-count" id="cnt-live2">—</span>
      </button>
      <button class="nav-btn" data-section="movies" onclick="navTo('movies')">
        <span class="nav-icon">🎬</span><span class="nav-label">Filmes</span>
        <span class="nav-count" id="cnt-movies2">—</span>
      </button>
      <button class="nav-btn" data-section="series" onclick="navTo('series')">
        <span class="nav-icon">📂</span><span class="nav-label">Séries</span>
        <span class="nav-count" id="cnt-series2">—</span>
      </button>
    </div>

    <div class="sidebar-divider desktop-nav"></div>

    <div class="sidebar-section desktop-nav">
      <span class="sidebar-label">Coleção</span>
      <button class="nav-btn" data-section="favs" onclick="navTo('favs')">
        <span class="nav-icon">⭐</span><span class="nav-label">Favoritos</span>
        <span class="nav-count" id="cnt-favs2">—</span>
      </button>
    </div>
  </aside>

  <!-- CONTENT -->
  <div class="content-area">

    <!-- PLAYER -->
    <div class="player-wrap">
      <video id="video" controls autoplay playsinline></video>
      <div class="player-overlay" id="player-idle">
        <div class="player-idle-inner">
          <div class="idle-icon">📺</div>
          <p>SELECIONE UM ITEM PARA REPRODUZIR</p>
        </div>
      </div>
      <div class="now-playing" id="now-playing"></div>
      <div class="player-status" id="player-status">
        <div class="status-dot" id="status-dot"></div>
        <span id="status-text">AO VIVO</span>
      </div>
    </div>

    <!-- EPISODES PANEL -->
    <div class="episodes-panel" id="ep-panel">
      <div class="ep-header">
        <div class="ep-title" id="ep-title">Episódios</div>
        <button class="ep-close" onclick="closeEpPanel()">✕ FECHAR</button>
      </div>
      <div class="season-tabs" id="season-tabs"></div>
      <div class="ep-list" id="ep-list"></div>
    </div>

    <!-- CONTENT HEADER -->
    <div class="content-header">
      <div class="content-title" id="section-title">CANAIS AO VIVO</div>
      <div class="content-info" id="section-info">—</div>
    </div>

    <!-- FILTER BAR -->
    <div class="filter-bar" id="filter-bar"></div>

    <!-- GRID -->
    <div class="grid-area">
      <div id="grid"></div>
    </div>

  </div>
</div>

<!-- TOAST -->
<div class="toast" id="toast"></div>

<script src="app.js"></script>
</body>
</html>
