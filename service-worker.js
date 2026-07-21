const CACHE_NAME = 'theater-teleprompter-v2';
const ASSETS = [
  './', './index.html', './styles.css', './app.js', './script-data.js', './manifest.webmanifest',
  './data/chunk-01.js', './data/chunk-02.js', './data/chunk-03.js',
  './data/chunk-04.js', './data/chunk-05.js', './data/chunk-06.js',
  './data/chunk-07.js', './data/chunk-08.js', './data/chunk-09.js'
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
  )));
  self.clients.claim();
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
    if (response.ok) {
      const clone = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
    }
    return response;
  }).catch(() => caches.match('./index.html'))));
});
