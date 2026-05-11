var CACHE_NAME = 'ndovera-pwa-v2';
var APP_SHELL = [
  '/',
  '/login',
  '/manifest.json',
  '/android-chrome-192x192.png',
  '/android-chrome-512x512.png'
];

function shouldCacheResponse(request, response) {
  if (!response || !response.ok) return false;
  if (response.status === 206) return false;
  if (request.headers.get('range')) return false;
  return response.type === 'basic';
}

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
  if (event.request.headers.get('range')) return;

  var requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  if (requestUrl.pathname.indexOf('/api/') === 0 || requestUrl.pathname.indexOf('/files/') === 0) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(function (response) {
        if (shouldCacheResponse(event.request, response)) {
          var responseCopy = response.clone();
          event.waitUntil(
            caches.open(CACHE_NAME)
              .then(function (cache) {
                return cache.put(event.request, responseCopy);
              })
              .catch(function () {
                return null;
              })
          );
        }
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
