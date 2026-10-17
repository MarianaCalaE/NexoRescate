/* NexoRescate service worker — app shell offline. Las teselas del mapa se gestionan
   desde la app con Cache API (caché "nr-tiles-v1"), que este SW no borra. */
const SHELL = 'nr-shell-v2';
const CORE = ['/', '/index.html', '/manifest.webmanifest', '/icons/icon.svg', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('nr-shell-') && k !== SHELL).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'CACHE_URLS') {
    e.waitUntil(caches.open(SHELL).then((c) => Promise.all(e.data.urls.map((u) => c.add(u).catch(() => null)))));
  }
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // teselas, USGS y Nominatim: los maneja la app

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((r) => {
          const copy = r.clone();
          caches.open(SHELL).then((c) => c.put('/index.html', copy));
          return r;
        })
        .catch(() => caches.match('/index.html').then((r) => r || caches.match('/'))),
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((r) => {
          if (r.ok) {
            const copy = r.clone();
            caches.open(SHELL).then((c) => c.put(req, copy));
          }
          return r;
        }),
    ),
  );
});
