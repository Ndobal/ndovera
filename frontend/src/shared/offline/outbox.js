// The outbox: things done offline that must reach Ndovera — quiz attempts,
// staff sign-ins. Each kind registers a sender; the outbox retries on its own
// when the connection returns, every half minute while online, and when the app
// comes back to the foreground, whichever page is open.
//
// A send that fails for want of a network (or a busy server: 5xx, 429, timeout)
// stays queued. One the server refuses (4xx) is kept, marked "needs review" with
// the reason, and never blocks the items behind it.

import { entries, getItem, isOnline, removeItem, setItem } from './offlineStore';

const senders = new Map();
const listeners = new Set();
let flushing = null;
let started = false;

export function registerSender(kind, send) {
  senders.set(kind, send);
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify() {
  listOutbox().then(items => listeners.forEach(listener => { try { listener(items); } catch {} })).catch(() => null);
}

export function isRetryable(error) {
  const status = Number(error?.status || 0);
  if (!status) return true; // no response at all: offline, DNS, timeout, CORS on a captive portal
  return status >= 500 || status === 429 || status === 408;
}

export async function enqueue(kind, payload, meta = {}) {
  const id = `${kind}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
  const item = { id, kind, payload, meta, createdAt: new Date().toISOString(), attempts: 0, status: 'queued', error: '' };
  await setItem(id, item, 'outbox');
  notify();
  try { navigator.serviceWorker?.ready?.then(registration => registration.sync?.register?.('ndovera-outbox')).catch(() => null); } catch {}
  if (isOnline()) setTimeout(() => { flushOutbox().catch(() => null); }, 50);
  return item;
}

export async function listOutbox(kind = '') {
  const items = (await entries(kind ? `${kind}:` : '', 'outbox')).map(([, value]) => value).filter(Boolean);
  return items.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
}

export async function removeFromOutbox(id) {
  await removeItem(id, 'outbox');
  notify();
}

/** Try an item that needs review again (after the cause was fixed). */
export async function retryItem(id) {
  const item = await getItem(id, 'outbox');
  if (!item) return;
  await setItem(id, { ...item, status: 'queued', error: '' }, 'outbox');
  notify();
  return flushOutbox();
}

/** Send everything queued, oldest first. Returns { sent, failed, waiting }. */
export function flushOutbox() {
  if (flushing) return flushing;
  flushing = (async () => {
    const result = { sent: 0, failed: 0, waiting: 0, results: [] };
    if (!isOnline()) {
      result.waiting = (await listOutbox()).filter(item => item.status === 'queued').length;
      return result;
    }
    for (const item of await listOutbox()) {
      if (item.status !== 'queued') continue;
      const send = senders.get(item.kind);
      if (!send) { result.waiting += 1; continue; }
      try {
        const response = await send(item.payload, item);
        await removeItem(item.id, 'outbox');
        result.sent += 1;
        result.results.push({ item, response });
      } catch (error) {
        const attempts = Number(item.attempts || 0) + 1;
        if (isRetryable(error)) {
          await setItem(item.id, { ...item, attempts, error: error?.message || 'Waiting for a connection.' }, 'outbox');
          result.waiting += 1;
          // The network is down or busy: the rest will fail the same way; try later.
          break;
        }
        await setItem(item.id, { ...item, attempts, status: 'needs_review', error: error?.message || 'Ndovera could not accept this.' }, 'outbox');
        result.failed += 1;
      }
    }
    return result;
  })().finally(() => {
    flushing = null;
    notify();
  });
  return flushing;
}

/** Start the background retries once for the whole app. */
export function startOutbox() {
  if (started || typeof window === 'undefined') return;
  started = true;
  const kick = () => { if (isOnline()) flushOutbox().catch(() => null); };
  window.addEventListener('online', kick);
  document.addEventListener?.('visibilitychange', () => { if (document.visibilityState === 'visible') kick(); });
  setInterval(kick, 30000);
  try {
    navigator.serviceWorker?.addEventListener?.('message', event => { if (event?.data?.type === 'flush-outbox') kick(); });
    // Background Sync wakes the app's worker when the connection returns, even with the tab in the background.
    navigator.serviceWorker?.ready?.then(registration => registration.sync?.register?.('ndovera-outbox')).catch(() => null);
  } catch {}
  setTimeout(kick, 1500);
}
