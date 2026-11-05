const CACHE = 'golden-v4';
const ASSETS = ['./', './index.html', './styles.css', './app.js', './manifest.json',
  './icon-192.png', './icon-512.png', './authorized.json', './generate-hash.html'];

self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS))); self.skipWaiting(); });
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())
));
self.addEventListener('fetch', e => {
  // authorized.json sempre da rede (lista viva)
  if (e.request.url.includes('authorized.json')) return;
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request)));
});
