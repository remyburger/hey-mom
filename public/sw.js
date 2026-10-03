// Minimal service worker: offline app shell + last-known responses.
// Bump CACHE when this file changes so old caches are deleted.
const CACHE = 'hey-mom-v2';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './index.html'])));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

const putInCache = (req, res) => {
  if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
  return res;
};

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Vite's hashed build files never change, so cache first is safe for them only
  if (url.origin === self.location.origin && url.pathname.includes('/assets/')) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => putInCache(req, res))));
    return;
  }

  // Everything else (pages, manifest, icons, weather, fonts): network first, cache as fallback
  e.respondWith(
    fetch(req)
      .then((res) => putInCache(req, res))
      .catch(() => caches.match(req).then((r) => r || (req.mode === 'navigate' ? caches.match('./index.html') : undefined)))
  );
});
