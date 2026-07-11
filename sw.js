const CACHE = 'badminton-stats-v305';

const ASSETS = [
  './',
  './index.html',
  './favicon.ico',
  './css/styles.css',
  './js/config.js',
  './js/cloud.js',
  './js/push.js',
  './js/app.js',
  './manifest.json',
  './icons/icon-16.png',
  './icons/icon-32.png',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/logo-mark.png',
  './icons/logo-hero.png',
  './icons/invite-banner.svg',
  './icons/fingerprint.svg',
  './icons/shuttlecock.svg',
  './icons/whistle.png',
  './icons/tab-matches.png',
  './icons/tab-matches-src.png',
  './fonts/cascadia-mono-400.woff2',
  './fonts/cascadia-mono-500.woff2',
  './fonts/cascadia-mono-600.woff2',
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

self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('push', event => {
  let payload = { title: 'Badminton App', body: '', data: {} };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch (_) {}
  const data = payload.data || {};
  const notifId = data.notifId;
  const tag = data.tag || (notifId != null ? `plan-notif-${notifId}` : 'badminton-push');
  event.waitUntil(
    self.registration.showNotification(payload.title || 'Badminton App', {
      body: payload.body || '',
      icon: 'icons/icon-192.png',
      badge: 'icons/icon-192.png',
      tag,
      data,
    }),
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const data = event.notification.data || {};
  let url = new URL('./', self.location).href;
  if (data.url) url = data.url;
  else if (data.planToken) url = new URL(`./?plan=${encodeURIComponent(data.planToken)}`, self.location).href;
  else if (data.matchId) url = new URL(`./?match=${data.matchId}`, self.location).href;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client) return client.navigate(url);
          return;
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    }),
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
