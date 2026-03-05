const CACHE_NAME = 'tron-iptv-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/app.html',
  '/style.css',
  '/app.js',
  '/manifest.json'
];

// ── INSTALL: cache static assets ──────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// ── ACTIVATE: clear old caches ────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ── FETCH: cache-first for static, network-first for API ──
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Skip non-GET and cross-origin stream/api requests
  if (event.request.method !== 'GET') return;
  if (url.pathname.includes('/live/') ||
      url.pathname.includes('/movie/') ||
      url.pathname.includes('/series/') ||
      url.pathname.includes('player_api')) {
    return; // let the browser handle streams natively
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // Only cache same-origin successful responses
        if (response && response.status === 200 && url.origin === self.location.origin) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
