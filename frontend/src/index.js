import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import './shared/styles/theme.css';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.getRegistrations()
      .then(registrations => Promise.all(registrations.map(registration => registration.unregister())))
      .then(() => {
        if (!('caches' in window)) return null;
        return caches.keys().then(keys => Promise.all(keys.map(key => caches.delete(key))));
      })
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
