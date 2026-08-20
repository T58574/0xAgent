
// =============================================================================
// 0xAgent Service Worker — PWA app-shell cache for local/LAN deployment.
// Strategy:
//   - Network-first for navigation (index.html) with offline fallback to cache.
//   - Cache-first for static assets (js/css/manifest/icons/fonts).
//   - NEVER intercept /api or /ws (live backend + WebSocket).
// Bump CACHE_VERSION to invalidate on release.
// =============================================================================
const CACHE_VERSION = '0xagent-v1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;

const APP_SHELL = [
  '/',
  '/manifest.webmanifest',
  '/icons/icon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== STATIC_CACHE && k.startsWith('0xagent')).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isStatic(url) {
  const u = new URL(url);
  if (u.pathname.startsWith('/api/') || u.pathname === '/ws') return false;
  return /\.(js|css|map|svg|png|webp|woff2?|ttf|ico|json)$/.test(u.pathname) || u.pathname.endsWith('.webmanifest');
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Only handle same-origin requests.
  if (url.origin !== self.location.origin) return;

  // --- API / WebSocket: pass-through to network, no caching ---
  if (url.pathname.startsWith('/api/') || url.pathname === '/ws') return;

  // --- Navigation request: network-first with offline fallback to index ---
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(STATIC_CACHE).then((c) => c.put('/', copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match('/').then((hit) => hit || caches.match('/index.html')))
    );
    return;
  }

  // --- Static assets: cache-first, populate on miss ---
  if (isStatic(req.url)) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            const copy = res.clone();
            caches.open(STATIC_CACHE).then((c) => c.put(req, copy)).catch(() => {});
            return res;
          })
      )
    );
  }
});

