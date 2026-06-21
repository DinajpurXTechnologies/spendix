// SpendiX service worker — app shell caching for offline support & PWA installability.
const CACHE_NAME = 'spendix-cache-v1';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Network-first for navigation/API calls (so data stays fresh), falling back to
// cache when offline. Cache-first for static assets already in the app shell.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // Never intercept Firebase/Google API calls — let them go straight to network.
  const url = new URL(req.url);
  if (url.origin.includes('googleapis.com') || url.origin.includes('gstatic.com') || url.origin.includes('firebaseio.com')) {
    return;
  }

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match('./index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res.ok && (url.protocol === 'http:' || url.protocol === 'https:')) {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
        }
        return res;
      }).catch(() => cached);
    })
  );
});
