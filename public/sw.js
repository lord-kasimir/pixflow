const CACHE_NAME = 'pixflow-v2';
const SHELL_FILES = ['/', '/css/app.css', '/js/app.js', '/manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(c => c.addAll(SHELL_FILES)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Thumbnails: Cache-first
  if (url.pathname.startsWith('/api/thumb/')) {
    e.respondWith(
      caches.open(CACHE_NAME).then(c =>
        c.match(e.request).then(cached => {
          if (cached) return cached;
          return fetch(e.request).then(res => {
            if (res.ok) c.put(e.request, res.clone());
            return res;
          });
        })
      )
    );
    return;
  }

  // App-Shell: Cache-first, dann Netzwerk
  if (!url.pathname.startsWith('/api/')) {
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request))
    );
    return;
  }

  // API: Network-only
  e.respondWith(fetch(e.request));
});
