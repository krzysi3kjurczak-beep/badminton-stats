const CACHE = 'badminton-stats-v53';

const ASSETS = [
  './',
  './index.html',
  './css/styles.css',
  './js/config.js',
  './js/cloud.js',
  './js/app.js',
  './manifest.json',
  './icons/icon.svg',
  './icons/logo.svg',
  './icons/auth-hero.svg',
  './icons/fingerprint.svg',
];

const NETWORK_FIRST = /\.(?:js|css|html)$|\/badminton-stats\/?$/;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const path = new URL(e.request.url).pathname;

  if (NETWORK_FIRST.test(path)) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then(cache => cache.put(e.request, copy));
          }
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
