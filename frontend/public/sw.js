var CACHE_NAME = 'ndovera-pwa-v1';
var APP_SHELL = [
  '/',
  '/login',
  '/manifest.json',
  '/android-chrome-192x192.png',
  '/android-chrome-512x512.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function (cache) {
        return cache.addAll(APP_SHELL);
      })
      .then(function () {
        return self.skipWaiting();
      })
      .catch(function () {
        return self.skipWaiting();
      })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (cacheKeys) {
        return Promise.all(cacheKeys.map(function (cacheKey) {
          if (cacheKey !== CACHE_NAME) {
            return caches.delete(cacheKey);
          }
          return null;
        }));
      })
      .then(function () {
        return self.clients.claim();
      })
  );
});

self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') return;

  var requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  if (requestUrl.pathname.indexOf('/api/') === 0 || requestUrl.pathname.indexOf('/files/') === 0) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(function (response) {
        var responseCopy = response.clone();
        caches.open(CACHE_NAME).then(function (cache) {
          cache.put(event.request, responseCopy);
        });
        return response;
      })
      .catch(function () {
        return caches.match(event.request)
          .then(function (cachedResponse) {
            return cachedResponse || caches.match('/');
          });
      })
  );
});
