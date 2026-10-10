// One watcher for the whole app: has anything changed, and can Ndovera be reached?
//
// Instead of every panel re-reading its data every few seconds, the app asks
// /api/changes (a couple of tiny primary-key reads on the server) and each panel
// re-reads only when the stamp it cares about moved:
//   'tenant' — something in the school others may need to see (a material, an
//              assignment, a person, a fee record, an announcement…);
//   'user'   — the person's messages (a new message, or one read elsewhere).
//
// It also tracks whether Ndovera can be reached. 'offline' (no network) and
// 'unavailable' (the server or database is down or refusing: 502/503/504, or a
// time-out) are treated the same way by the app: keep the role and data already
// loaded, show saved copies, and queue work in the outbox until 'ok' returns.

import { getApiUrl } from '../../config/apiBase';
import { buildSelectedRoleHeader, getStoredAuth } from '../../features/auth/services/authApi';

const CHECK_MS = 30000;
const TIMEOUT_MS = 10000;

const changeListeners = new Set();
const statusListeners = new Set();
let last = null; // { tenant, user }
let status = typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'ok';
let timer = null;
let inFlight = null;
let started = false;

export function getConnectionStatus() {
  return status;
}

export function setConnectionStatus(next) {
  if (!next || next === status) return;
  status = next;
  statusListeners.forEach(listener => { try { listener(status); } catch {} });
}

/** listener(status): 'ok' | 'offline' | 'unavailable'. Returns an unsubscribe function. */
export function subscribeConnection(listener) {
  statusListeners.add(listener);
  return () => statusListeners.delete(listener);
}

/**
 * listener(kinds) is called with the scopes that moved, e.g. ['tenant'] or ['user'].
 * Returns an unsubscribe function. Starts the watcher on first use.
 */
export function subscribeChanges(listener) {
  changeListeners.add(listener);
  startChangeWatcher();
  return () => changeListeners.delete(listener);
}

/** True for a response that means "Ndovera is down or refusing", not "you asked for something wrong". */
export function isServerUnavailable(statusCode) {
  return [502, 503, 504].includes(Number(statusCode));
}

export function checkNow() {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    const auth = getStoredAuth();
    if (!auth?.token) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) { setConnectionStatus('offline'); return; }
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const abort = setTimeout(() => controller?.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(getApiUrl('/api/changes'), {
        credentials: 'include',
        cache: 'no-store',
        signal: controller?.signal,
        headers: { Authorization: `Bearer ${auth.token}`, 'X-No-Offline-Cache': '1', ...buildSelectedRoleHeader() },
      });
      if (response.headers.get('X-Ndovera-Offline') || isServerUnavailable(response.status)) { setConnectionStatus('unavailable'); return; }
      if (!response.ok) return; // 401 and friends are the session's business, not connectivity
      const data = await response.json().catch(() => null);
      if (!data) return;
      setConnectionStatus('ok');
      const next = { tenant: Number(data.tenant || 0), user: Number(data.user || 0) };
      const moved = last ? ['tenant', 'user'].filter(kind => next[kind] !== last[kind]) : [];
      last = next;
      if (moved.length) changeListeners.forEach(listener => { try { listener(moved); } catch {} });
    } catch {
      setConnectionStatus(typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'unavailable');
    } finally {
      clearTimeout(abort);
    }
  })().finally(() => { inFlight = null; });
  return inFlight;
}

export function startChangeWatcher() {
  if (started || typeof window === 'undefined') return;
  started = true;
  const tick = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    checkNow();
  };
  timer = setInterval(tick, CHECK_MS);
  window.addEventListener('online', () => { setConnectionStatus('ok'); checkNow(); });
  window.addEventListener('offline', () => setConnectionStatus('offline'));
  document.addEventListener?.('visibilitychange', () => { if (document.visibilityState === 'visible') checkNow(); });
  // The service worker reports when it had to answer from saved copies.
  try {
    navigator.serviceWorker?.addEventListener?.('message', event => {
      if (event?.data?.type === 'server-status') setConnectionStatus(event.data.status === 'ok' ? 'ok' : 'unavailable');
    });
  } catch {}
  setTimeout(checkNow, 500);
}

/** For tests. */
export function resetChangeWatcher() {
  if (timer) clearInterval(timer);
  timer = null;
  started = false;
  last = null;
  status = 'ok';
  changeListeners.clear();
  statusListeners.clear();
}
