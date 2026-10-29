const CACHE = 'xv-shell-v1-8-35';
const SHELL = [
  '/',
  '/admin.html',
  '/vendedor.html',
  '/pdv.html',
  '/loja.html',
  '/motorista.html',
  '/styles.css',
  '/styles.css?v=1.8.35',
  '/app.js',
  '/app.js?v=1.8.35',
  '/role.js',
  '/role.js?v=1.8.35',
  '/assets/institucional/01_Logo_Xiquim_Vargas_HD.png',
  '/assets/brand/logo-online.jpg',
  '/assets/brand/logo-pdv.jpg',
  '/assets/brand/logo-admin.jpg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(SHELL.map(url => new Request(url, { cache: 'reload' }))))
      .catch(err => console.warn('[sw] cache addAll warning:', err.message))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key.startsWith('xv-shell-') && key !== CACHE).map(key => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // APIs and media: do not cache in service worker shell (handled via IndexedDB)
  if (url.origin === self.location.origin && (url.pathname.startsWith('/api/') || url.pathname.startsWith('/media/'))) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response.ok && url.origin === self.location.origin) {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request).then(cached => {
          if (cached) return cached;
          if (event.request.mode === 'navigate') {
            return caches.match(url.pathname) || caches.match('/admin.html');
          }
          return Response.error();
        });
      })
  );
});
