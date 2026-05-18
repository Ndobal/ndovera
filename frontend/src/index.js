import 'react-app-polyfill/stable';
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import './shared/styles/theme.css';

function getAndroidMajorVersion() {
  const match = navigator.userAgent.match(/Android\s([0-9]+)/i);
  return match ? Number(match[1]) : null;
}

function shouldEnablePwa() {
  const androidMajorVersion = getAndroidMajorVersion();
  return androidMajorVersion === null || androidMajorVersion >= 8;
}

function activateWaitingServiceWorker(registration) {
  if (!registration?.waiting) return;
  registration.waiting.postMessage({ type: 'SKIP_WAITING' });
}

if ('serviceWorker' in navigator && shouldEnablePwa()) {
  window.addEventListener('load', () => {
    let didReloadForUpdate = false;
    const handleControllerChange = () => {
      if (didReloadForUpdate) return;
      didReloadForUpdate = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
      .then(registration => {
        const refreshRegistration = () => {
          registration.update().catch(() => null);
        };

        if (registration.waiting) {
          activateWaitingServiceWorker(registration);
        }

        registration.addEventListener('updatefound', () => {
          const installingWorker = registration.installing;
          if (!installingWorker) return;
          installingWorker.addEventListener('statechange', () => {
            if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
              activateWaitingServiceWorker(registration);
            }
          });
        });

        refreshRegistration();
        window.addEventListener('focus', refreshRegistration);
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            refreshRegistration();
          }
        });
      })
      .catch(() => null);
  });
} else if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.getRegistrations()
      .then(registrations => Promise.all(registrations.map(registration => registration.unregister())))
      .catch(() => null);
  });
}

const container = document.getElementById('root');
const root = createRoot(container);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
