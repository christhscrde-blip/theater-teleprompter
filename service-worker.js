const CACHE_NAME = 'theater-teleprompter-v7';
const ASSETS = [
  './',
  './index.html',
  './styles.css?v=7',
  './app.js?v=7',
  './script-data.js?v=7',
  './manifest.webmanifest?v=7',
  './data/chunk-01.js?v=7',
  './data/chunk-02.js?v=7',
  './data/chunk-03.js?v=7',
  './data/chunk-04.js?v=7',
  './data/chunk-05.js?v=7',
  './data/chunk-06.js?v=7',
  './data/chunk-07.js?v=7',
  './data/chunk-08.js?v=7',
  './data/chunk-09.js?v=7'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      for (const asset of ASSETS) {
        const response = await fetch(asset, { cache: 'reload' });
        if (!response.ok) throw new Error(`Asset nicht verfügbar: ${asset}`);
        await cache.put(asset, response);
      }
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put('./index.html', clone));
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
      if (response.ok) {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
      }
      return response;
    }))
  );
});