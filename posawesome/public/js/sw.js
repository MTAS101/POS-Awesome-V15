self.addEventListener('install', event => {
  event.waitUntil(
    caches.open('posawesome-cache-v1').then(cache => {
      return cache.addAll([
        '/assets/posawesome/js/posawesome.bundle.js',
        '/assets/posawesome/js/offline.js',
      ]);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then(response => {
      return (
        response ||
        fetch(event.request).then(resp => {
          const respClone = resp.clone();
          caches.open('posawesome-cache-v1').then(cache => {
            cache.put(event.request, respClone);
          });
          return resp;
        }).catch(() => response)
      );
    })
  );
});
