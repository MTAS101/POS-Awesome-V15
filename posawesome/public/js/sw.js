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
  if (!event.request.url.startsWith('http')) return;
  if (event.request.url.includes('socket.io')) return;


  event.respondWith(
    caches.match(event.request).then(response => {
      if (response) {
        return response;
      }
      return fetch(event.request).then(resp => {
        if (resp && resp.ok && resp.status === 200) {
          const respClone = resp.clone();
          caches.open('posawesome-cache-v1').then(cache => cache.put(event.request, respClone));
        }
        return resp;
      });
    }).catch(() => caches.match(event.request).then(r => r || new Response('')))
  );
});
