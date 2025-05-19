self.addEventListener('install', e => {
  // pre-cache your shell if you want...
  self.skipWaiting();
});
self.addEventListener('activate',   e => self.clients.claim());
self.addEventListener('fetch',      e => {
  // simple offline–first, or just pass through:
  e.respondWith(fetch(e.request));
});
