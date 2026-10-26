// Bumped to v7 to evict the precached HTML that v6 and earlier stored. Page HTML names
// the hashed bundles of the deploy it came from, and the precache was only ever refreshed
// when this constant changed — so after the next deploy an installed app could launch from
// a shell asking for JavaScript that no longer exists, and render nothing at all. The
// shell is now fetched fresh every time, and only assets whose names change with their
// contents are kept.
var CACHE_NAME = 'ndovera-pwa-v8';
// Offline-first, restored safely (v8). The app shell IS kept again — but only together
// with every script and stylesheet it names, stored as one unit after all of them have
// downloaded. Online, a page always comes fresh from the network; the kept shell is used
// only when there is no network, and it can never point at bundles that are not kept.
var SHELL_CACHE = 'ndovera-shell-v1';
var SHELL_KEY = '/__ndovera_shell__';
// Data the app has read (GET /api), per signed-in person, for reading offline.
var API_CACHE = 'ndovera-api-v1';
// Materials, images and PDFs once opened (/files/), readable offline afterwards.
var FILES_CACHE = 'ndovera-files-v1';
var API_CACHE_LIMIT = 400;
var FILES_CACHE_LIMIT = 200;
// Never kept: sign-in, payments, AI (always live), push and anything with a secret in it.
var API_NEVER_CACHE = /^\/api\/(auth|login|logout|ai\/|ai-pay|push|payments?|flutterwave|tenants\/register|password|reset|uploads?)/i;
var NOTIFICATION_STATE_CACHE = 'ndovera-notification-state-v1';
var NOTIFICATION_STATE_KEY = '/__fee-reminder-state__';
var PUSH_CONTEXT_KEY = '/__push-context__';
var PERIODIC_FEE_REMINDER_TAG = 'parent-fee-reminders';
// Deliberately no HTML: see the note on CACHE_NAME. These are the files whose contents
// never change behind their names.
var APP_SHELL = [
  '/manifest.json',
  '/android-chrome-192x192.png',
  '/android-chrome-512x512.png'
];

// What an offline launch gets instead of a stale app. A page that says why it is empty
// can be acted on; a white screen cannot.
var OFFLINE_PAGE = [
  '<!doctype html><html lang="en"><head><meta charset="utf-8">',
  '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">',
  '<title>NDOVERA is offline</title>',
  '<style>',
  'body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;',
  'background:#b5e3f4;color:#191970;font:16px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif;padding:24px}',
  '.card{max-width:26rem;text-align:center;background:#fff4df;border:1px solid rgba(201,169,110,.5);',
  'border-radius:24px;padding:24px}h1{color:#800000;font-size:1.25rem;margin:0 0 8px}',
  'p{margin:0 0 20px}button{background:#1a5c38;color:#b5e3f4;border:0;border-radius:16px;',
  'padding:10px 22px;font-size:.95rem;font-weight:700}',
  '@media (prefers-color-scheme: dark){body{background:#020617;color:#e2e8f0}',
  '.card{background:rgba(15,23,42,.6);border-color:rgba(255,255,255,.1)}h1{color:#f1f5f9}}',
  '</style></head><body><div class="card">',
  '<h1>You are offline</h1>',
  '<p>Your phone or computer is not getting internet: mobile data or Wi-Fi is off, the signal is too weak, or the data bundle has run out. NDOVERA itself is fine. Reconnect and try again — nothing you saved is lost.</p>',
  '<button onclick="location.reload()">Try again</button>',
  '</div></body></html>'
].join('');

function offlineResponse() {
  return new Response(OFFLINE_PAGE, {
    status: 503,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}

function readNotificationState() {
  return caches.open(NOTIFICATION_STATE_CACHE)
    .then(function (cache) {
      return cache.match(NOTIFICATION_STATE_KEY);
    })
    .then(function (response) {
      if (!response) return {};
      return response.json().catch(function () { return {}; });
    })
    .catch(function () {
      return {};
    });
}

function writeNotificationState(state) {
  return caches.open(NOTIFICATION_STATE_CACHE)
    .then(function (cache) {
      return cache.put(
        NOTIFICATION_STATE_KEY,
        new Response(JSON.stringify(state || {}), {
          headers: { 'Content-Type': 'application/json' }
        })
      );
    })
    .catch(function () {
      return null;
    });
}

function readPushContext() {
  return caches.open(NOTIFICATION_STATE_CACHE)
    .then(function (cache) {
      return cache.match(PUSH_CONTEXT_KEY);
    })
    .then(function (response) {
      if (!response) return {};
      return response.json().catch(function () { return {}; });
    })
    .catch(function () {
      return {};
    });
}

function writePushContext(context) {
  return caches.open(NOTIFICATION_STATE_CACHE)
    .then(function (cache) {
      return cache.put(
        PUSH_CONTEXT_KEY,
        new Response(JSON.stringify(context || {}), {
          headers: { 'Content-Type': 'application/json' }
        })
      );
    })
    .catch(function () {
      return null;
    });
}

function urlBase64ToUint8Array(base64String) {
  var padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  var base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  var rawData = atob(base64);
  var outputArray = new Uint8Array(rawData.length);
  for (var index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index);
  }
  return outputArray;
}

function fetchPushPublicKey() {
  return fetch('/api/push/public-key', {
    credentials: 'include',
    headers: { 'Accept': 'application/json' }
  })
    .then(function (response) {
      if (!response || !response.ok) return null;
      return response.json().catch(function () { return null; });
    })
    .catch(function () {
      return null;
    });
}

function fetchPushFeed(roleKey) {
  return fetch('/api/push/feed?roleKey=' + encodeURIComponent(roleKey || 'student'), {
    credentials: 'include',
    headers: { 'Accept': 'application/json' }
  })
    .then(function (response) {
      if (!response || !response.ok) return null;
      return response.json().catch(function () { return null; });
    })
    .catch(function () {
      return null;
    });
}

function showDeliveredNotification(notification, fallbackUrl) {
  if (!notification || !notification.id) {
    return null;
  }

  return readNotificationState().then(function (delivered) {
    var nextState = delivered || {};
    var deliveryKey = String(notification.tag || notification.id || 'push-notice');
    if (nextState[deliveryKey]) {
      return null;
    }

    return self.registration.showNotification(notification.title || 'NDOVERA notice', {
      body: notification.body || '',
      tag: deliveryKey,
      icon: notification.icon || '/android-chrome-192x192.png',
      badge: notification.badge || '/android-chrome-192x192.png',
      data: {
        url: notification.url || fallbackUrl || '/'
      }
    }).then(function () {
      nextState[deliveryKey] = new Date().toISOString();
      return writeNotificationState(nextState);
    });
  });
}

function syncPushNotifications(roleKey) {
  return fetchPushFeed(roleKey)
    .then(function (payload) {
      return showDeliveredNotification(payload && payload.notification, '/roles/' + String(roleKey || 'student'));
    });
}

function resubscribeToPush(roleKey) {
  return fetchPushPublicKey()
    .then(function (payload) {
      if (!payload || !payload.available || !payload.publicKey) {
        return null;
      }

      return self.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(payload.publicKey)
      }).then(function (subscription) {
        return fetch('/api/push/subscriptions', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ roleKey: roleKey || 'student', subscription: subscription.toJSON() })
        }).catch(function () {
          return null;
        });
      });
    });
}

function fetchParentHeaderData() {
  return fetch('/api/header/parent', {
    credentials: 'include',
    headers: { 'Accept': 'application/json' }
  })
    .then(function (response) {
      if (!response || !response.ok) return null;
      return response.json().catch(function () { return null; });
    })
    .catch(function () {
      return null;
    });
}

function syncParentFeeReminders() {
  return fetchParentHeaderData()
    .then(function (payload) {
      var items = payload && payload.notificationItems ? payload.notificationItems : [];
      var feeReminderItems = items.filter(function (item) {
        return item && item.category === 'fee_reminder';
      });

      if (!feeReminderItems.length) {
        return null;
      }

      return readNotificationState().then(function (delivered) {
        var nextState = delivered || {};
        var changed = false;
        var notifications = [];

        feeReminderItems.forEach(function (item) {
          var deliveryKey = String(item.id || 'fee-reminder') + ':' + String(item.reminderSlotKey || 'current');
          if (nextState[deliveryKey]) {
            return;
          }

          notifications.push(
            self.registration.showNotification(item.title || 'School reminder', {
              body: item.detail || item.preview || '',
              tag: deliveryKey,
              icon: '/android-chrome-192x192.png',
              badge: '/android-chrome-192x192.png',
              data: {
                url: '/roles/parent/fees'
              }
            })
          );
          nextState[deliveryKey] = new Date().toISOString();
          changed = true;
        });

        if (!notifications.length) {
          return null;
        }

        return Promise.all(notifications).then(function () {
          return changed ? writeNotificationState(nextState) : null;
        });
      });
    });
}

function shouldCacheResponse(request, response) {
  if (!response || !response.ok) return false;
  if (response.status === 206) return false;
  if (request.headers.get('range')) return false;
  if (response.type !== 'basic') return false;
  // Never store page HTML. Each build stamps index.html with new hashed bundle names, so a
  // cached copy from an earlier deploy asks for JavaScript that has since been replaced and
  // the app renders nothing. Hashed assets are safe: their names change when they change.
  if (request.mode === 'navigate') return false;
  var contentType = response.headers.get('content-type') || '';
  if (contentType.indexOf('text/html') !== -1) return false;
  return true;
}

function assetPathsOf(html) {
  var paths = [];
  var pattern = /(?:src|href)=["'](\/static\/[^"']+)["']/g;
  var match = pattern.exec(html);
  while (match) {
    if (paths.indexOf(match[1]) === -1) paths.push(match[1]);
    match = pattern.exec(html);
  }
  return paths;
}

/** Keep a shell only once every asset it names is kept with it. */
function keepShell(html) {
  var assets = assetPathsOf(html);
  if (!assets.length) return Promise.resolve(false);
  return caches.open(CACHE_NAME).then(function (cache) {
    return Promise.all(assets.map(function (path) {
      return cache.match(path).then(function (found) {
        if (found) return true;
        return fetch(path, { credentials: 'same-origin' }).then(function (response) {
          if (!response || !response.ok) throw new Error('asset ' + path);
          return cache.put(path, response);
        });
      });
    })).then(function () {
      return caches.open(SHELL_CACHE).then(function (shellCache) {
        return shellCache.put(SHELL_KEY, new Response(html, {
          headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Ndovera-Assets': JSON.stringify(assets) }
        }));
      });
    }).then(function () {
      // Bundles from earlier deploys that this shell no longer names can go.
      return cache.keys().then(function (requests) {
        return Promise.all(requests.map(function (request) {
          var path = new URL(request.url).pathname;
          if (path.indexOf('/static/') === 0 && assets.indexOf(path) === -1) return cache.delete(request);
          return null;
        }));
      });
    }).then(function () { return true; });
  }).catch(function () { return false; });
}

/** The kept shell, if every asset it names is still kept. */
function keptShell() {
  return caches.open(SHELL_CACHE).then(function (shellCache) {
    return shellCache.match(SHELL_KEY);
  }).then(function (shell) {
    if (!shell) return null;
    var assets = [];
    try { assets = JSON.parse(shell.headers.get('X-Ndovera-Assets') || '[]'); } catch (error) { assets = []; }
    return caches.open(CACHE_NAME).then(function (cache) {
      return Promise.all(assets.map(function (path) { return cache.match(path); }));
    }).then(function (found) {
      return found.every(Boolean) ? shell : null;
    });
  }).catch(function () { return null; });
}

function trimCache(name, limit) {
  return caches.open(name).then(function (cache) {
    return cache.keys().then(function (keys) {
      if (keys.length <= limit) return null;
      return Promise.all(keys.slice(0, keys.length - limit).map(function (key) { return cache.delete(key); }));
    });
  }).catch(function () { return null; });
}

function hashText(text) {
  var hash = 5381;
  for (var i = 0; i < text.length; i += 1) hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
  return (hash >>> 0).toString(36);
}

/** API answers are kept per person: the key carries a hash of who asked. */
function apiCacheKey(request) {
  var auth = request.headers.get('Authorization') || '';
  var role = request.headers.get('X-Selected-Role') || '';
  var url = new URL(request.url);
  url.searchParams.set('__ndv_user', hashText(auth + '|' + role));
  return new Request(url.toString(), { method: 'GET' });
}

// Why a saved copy was used: 'server' (Ndovera answered 502/503/504), 'slow' (no answer within
// 9 s) or 'network' (no answer at all). The page tells the person whose connection it was.
function withOfflineHeader(response, reason) {
  var headers = new Headers(response.headers);
  headers.set('X-Ndovera-Offline', reason || 'network');
  return response.blob().then(function (body) {
    return new Response(body, { status: response.status, statusText: response.statusText, headers: headers });
  });
}

/** Tell the open pages whether Ndovera answered (so they can show or hide the "saved copy" banner). */
var lastServerStatus = 'ok';
function reportServerStatus(status) {
  if (status === lastServerStatus) return;
  lastServerStatus = status;
  self.clients.matchAll({ includeUncontrolled: true, type: 'window' }).then(function (clients) {
    clients.forEach(function (client) { client.postMessage({ type: 'server-status', status: status }); });
  }).catch(function () { return null; });
}

/**
 * Network first; when there is no network, it is very slow, or Ndovera is down or refusing
 * (502/503/504 — e.g. the database at its daily limit), the kept copy. A busy server is treated
 * exactly like being offline: what was already loaded stays readable.
 */
function apiNetworkFirst(event) {
  var request = event.request;
  var key = apiCacheKey(request);
  var network = fetch(request).then(function (response) {
    var type = response.headers.get('content-type') || '';
    if (response.status === 502 || response.status === 503 || response.status === 504) {
      reportServerStatus('unavailable');
      return caches.open(API_CACHE).then(function (cache) { return cache.match(key); }).then(function (kept) {
        return kept ? withOfflineHeader(kept, 'server') : response;
      });
    }
    if (response.status < 500) reportServerStatus('ok');
    if (response.ok && response.status === 200 && type.indexOf('application/json') !== -1 && !request.headers.get('X-No-Offline-Cache')) {
      var copy = response.clone();
      event.waitUntil(caches.open(API_CACHE).then(function (cache) { return cache.put(key, copy); }).then(function () { return trimCache(API_CACHE, API_CACHE_LIMIT); }));
    }
    return response;
  });
  var slow = new Promise(function (resolve) { setTimeout(resolve, 9000); }).then(function () {
    return caches.open(API_CACHE).then(function (cache) { return cache.match(key); }).then(function (kept) {
      if (!kept) return network;
      return withOfflineHeader(kept, 'slow');
    });
  });
  return Promise.race([network, slow]).catch(function () {
    return caches.open(API_CACHE).then(function (cache) { return cache.match(key); }).then(function (kept) {
      if (kept) return withOfflineHeader(kept, 'network');
      return new Response(JSON.stringify({ success: false, offline: true, message: 'Your internet connection is not reaching Ndovera (no network, a weak signal or no data), and this page has not been opened on this device before.' }), {
        status: 503, headers: { 'Content-Type': 'application/json', 'X-Ndovera-Offline': 'network' }
      });
    });
  });
}

/** Files: the kept copy straight away (refreshed in the background), else the network, kept for next time. */
function filesStaleWhileRevalidate(event) {
  var request = event.request;
  return caches.open(FILES_CACHE).then(function (cache) {
    return cache.match(request).then(function (kept) {
      var network = fetch(request).then(function (response) {
        var type = response.headers.get('content-type') || '';
        if (response.ok && response.status === 200 && type.indexOf('video/') !== 0 && type.indexOf('audio/') !== 0) {
          var copy = response.clone();
          event.waitUntil(cache.put(request, copy).then(function () { return trimCache(FILES_CACHE, FILES_CACHE_LIMIT); }));
        }
        return response;
      });
      if (kept) {
        event.waitUntil(network.catch(function () { return null; }));
        return kept;
      }
      return network;
    });
  });
}

self.addEventListener('sync', function (event) {
  if (event.tag === 'ndovera-outbox') {
    // The connection is back: ask any open app window to send what it queued offline.
    event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      clientList.forEach(function (client) { client.postMessage({ type: 'flush-outbox' }); });
    }));
  }
});

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function (cache) {
        return cache.addAll(APP_SHELL);
      })
      .then(function () {
        // Keep the current shell (and its bundles) from the start, for the first offline launch.
        return fetch('/', { cache: 'no-store', credentials: 'same-origin' })
          .then(function (response) { return response.ok ? response.text().then(keepShell) : null; })
          .catch(function () { return null; });
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
          if ([CACHE_NAME, SHELL_CACHE, API_CACHE, FILES_CACHE, NOTIFICATION_STATE_CACHE].indexOf(cacheKey) === -1) {
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

self.addEventListener('message', function (event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  // Signing out: nobody else on this device may read the kept data.
  if (event.data && event.data.type === 'CLEAR_USER_CACHE') {
    var clearing = Promise.all([caches.delete(API_CACHE)]);
    if (event.waitUntil) event.waitUntil(clearing);
    return;
  }

  if (event.data && event.data.type === 'SET_PUSH_CONTEXT') {
    var roleKey = event.data.roleKey || 'student';
    if (event.waitUntil) {
      event.waitUntil(writePushContext({ roleKey: roleKey }));
    } else {
      writePushContext({ roleKey: roleKey });
    }
    return;
  }

  if (event.data && event.data.type === 'SYNC_PARENT_FEE_REMINDERS') {
    if (event.waitUntil) {
      event.waitUntil(syncParentFeeReminders());
    } else {
      syncParentFeeReminders();
    }
  }
});

self.addEventListener('periodicsync', function (event) {
  if (event.tag === PERIODIC_FEE_REMINDER_TAG) {
    event.waitUntil(syncParentFeeReminders());
  }
});

self.addEventListener('push', function (event) {
  event.waitUntil(
    readPushContext().then(function (context) {
      var roleKey = context && context.roleKey ? context.roleKey : 'student';

      if (event.data) {
        try {
          return showDeliveredNotification(event.data.json(), '/roles/' + roleKey);
        } catch (error) {
          return showDeliveredNotification({
            id: 'push-' + Date.now(),
            title: 'NDOVERA notice',
            body: event.data.text(),
            url: '/roles/' + roleKey,
          }, '/roles/' + roleKey);
        }
      }

      return syncPushNotifications(roleKey);
    })
  );
});

self.addEventListener('pushsubscriptionchange', function (event) {
  event.waitUntil(
    readPushContext().then(function (context) {
      return resubscribeToPush(context && context.roleKey ? context.roleKey : 'student');
    })
  );
});

self.addEventListener('notificationclick', function (event) {
  var targetUrl = event.notification && event.notification.data && event.notification.data.url
    ? event.notification.data.url
    : '/roles/parent/fees';

  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(function (clientList) {
        for (var i = 0; i < clientList.length; i += 1) {
          var client = clientList[i];
          if (client.url.indexOf(targetUrl) !== -1 && 'focus' in client) {
            return client.focus();
          }
        }

        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }

        return null;
      })
  );
});

self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') return;
  if (event.request.headers.get('range')) return;

  var requestUrl = new URL(event.request.url);
  var isNavigationRequest = event.request.mode === 'navigate';
  if (requestUrl.origin !== self.location.origin) return;

  if (requestUrl.pathname.indexOf('/api/') === 0) {
    if (API_NEVER_CACHE.test(requestUrl.pathname) || requestUrl.pathname.indexOf('/stream') !== -1) return;
    event.respondWith(apiNetworkFirst(event));
    return;
  }

  if (requestUrl.pathname.indexOf('/files/') === 0) {
    event.respondWith(filesStaleWhileRevalidate(event));
    return;
  }

  if (isNavigationRequest) {
    // Online: always the fresh page (and keep it, with its bundles, for offline launches).
    // Offline: the kept shell — only if every bundle it names is kept too.
    event.respondWith(
      fetch(event.request)
        .then(function (response) {
          var type = response.headers.get('content-type') || '';
          if (response.ok && type.indexOf('text/html') !== -1) {
            var copy = response.clone();
            event.waitUntil(copy.text().then(keepShell));
          }
          return response;
        })
        .catch(function () {
          return keptShell().then(function (shell) { return shell || offlineResponse(); });
        })
        .catch(function () { return offlineResponse(); })
    );
    return;
  }

  // Hashed build files never change behind their names: the kept copy first.
  if (requestUrl.pathname.indexOf('/static/') === 0) {
    event.respondWith(
      caches.match(event.request).then(function (kept) {
        if (kept) return kept;
        return fetch(event.request).then(function (response) {
          if (shouldCacheResponse(event.request, response)) {
            var copy = response.clone();
            event.waitUntil(caches.open(CACHE_NAME).then(function (cache) { return cache.put(event.request, copy); }).catch(function () { return null; }));
          }
          return response;
        });
      }).catch(function () { return Response.error(); })
    );
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
          .catch(function () { return undefined; })
          .then(function (cachedResponse) {
            return cachedResponse || Response.error();
          });
      })
      .catch(function () {
        return Response.error();
      })
  );
});
