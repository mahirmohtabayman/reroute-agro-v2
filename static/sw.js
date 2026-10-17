/* Reroute Agro service worker.
   Caches ONLY public static files (fonts, crop photos, icons, background images) and an offline page.
   API calls (/api/…) — sessions, orders, payments, wallet — always go to the network and are never stored.
   No offline transactions: when there is no connection the app shows the offline page. */
const VERSION = 'reroute-static-v1';
const PRECACHE = ['/offline.html', '/static/icons/icon-192.png', '/static/fonts/Kalpurush.woff2'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;

  if (req.mode === 'navigate') {
    // the page itself: always fresh from the network, offline page when there is no connection
    e.respondWith(fetch(req).catch(() => caches.match('/offline.html')));
    return;
  }
  if (url.pathname.startsWith('/static/') && !url.pathname.endsWith('index.html')) {
    // public static files: serve from cache, refresh in the background
    e.respondWith(caches.open(VERSION).then(async c => {
      const hit = await c.match(req);
      const net = fetch(req).then(r => { if (r.ok) c.put(req, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    }));
  }
});
