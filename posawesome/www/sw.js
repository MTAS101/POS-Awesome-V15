self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    (async () => {
      const cache = await caches.open('posawesome-cache-v1');
      const resources = [
        '/app/posapp',
        '/assets/posawesome/js/posawesome.bundle.js',
        '/assets/posawesome/js/offline.js'
      ];
      await Promise.all(resources.map(async url => {
        try {
          const resp = await fetch(url);
          if (resp && resp.ok) {
            await cache.put(url, resp.clone());
          }
        } catch (err) {
          console.warn('SW install failed to fetch', url, err);
        }
      }));
    })()
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  if (event.request.url.includes('socket.io')) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          return await fetch(event.request);
        } catch (err) {
          return caches.match('/app/posapp', { ignoreSearch: true });
        }
      })()
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(response => {

      if (response) {
        return response;
      }
      return fetch(event.request).then(resp => {

        // Cache only full successful responses
        if (resp && resp.ok && resp.status === 200) {
          const clone = resp.clone();
          caches.open('posawesome-cache-v1').then(cache => cache.put(event.request, clone));
        }
        return resp;
      });

    }).catch(() => caches.match(event.request).then(r => r || Response.error()))

  );
});
