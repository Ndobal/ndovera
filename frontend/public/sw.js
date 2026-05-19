var CACHE_NAME = 'ndovera-pwa-v4';
var NOTIFICATION_STATE_CACHE = 'ndovera-notification-state-v1';
var NOTIFICATION_STATE_KEY = '/__fee-reminder-state__';
var PUSH_CONTEXT_KEY = '/__push-context__';
var PERIODIC_FEE_REMINDER_TAG = 'parent-fee-reminders';
var APP_SHELL = [
  '/',
  '/index.html',
  '/login',
  '/register-school',
  '/manifest.json',
  '/android-chrome-192x192.png',
  '/android-chrome-512x512.png'
];

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

self.addEventListener('message', function (event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
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

  if (requestUrl.pathname.indexOf('/api/') === 0 || requestUrl.pathname.indexOf('/files/') === 0) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(function (response) {
        if (isNavigationRequest && response && response.status === 404) {
          return caches.match('/')
            .then(function (cachedHome) {
              return cachedHome || caches.match('/index.html') || response;
            });
        }

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
            if (cachedResponse) {
              return cachedResponse;
            }

            if (isNavigationRequest) {
              return caches.match('/')
                .then(function (cachedHome) {
                  return cachedHome || caches.match('/index.html');
                });
            }

            return caches.match('/');
          });
      })
  );
});
