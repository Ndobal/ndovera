import 'react-app-polyfill/stable';
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import './shared/styles/theme.css';
import { startOutbox } from './shared/offline/outbox';
import { installFriendlyNetworkErrors } from './shared/offline/networkErrors';
// Senders for work done offline (they register themselves with the outbox).
import './features/attendance/staffAttendanceQueue';
import './features/practice-arena/practiceApi';
import './features/classroom/classroomService'; // registers the offline assignment-submission sender
import './features/results-engine/service/resultEngineService'; // registers the offline C.A. score sender
import './features/clubs/clubsApi'; // registers the offline club hand-in sender

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

// A request that gets no answer is described as the person's network, not as Ndovera failing.
installFriendlyNetworkErrors();
// Offline-first: whatever was done without a connection syncs on its own, from any page.
startOutbox();

const container = document.getElementById('root');
const root = createRoot(container);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
