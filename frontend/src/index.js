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

if ('serviceWorker' in navigator && shouldEnablePwa()) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
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
