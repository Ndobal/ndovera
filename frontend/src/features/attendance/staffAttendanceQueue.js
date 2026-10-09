// Staff sign-ins made without a connection. They live in the app-wide outbox
// (IndexedDB), so a face capture cannot overflow storage and silently lose the
// mark, and they sync from any page as soon as the connection returns — not only
// while the attendance page is open. Each mark carries the moment it was made,
// which is the time Ndovera records (so syncing late never makes anyone late).

import { enqueue, flushOutbox, listOutbox, registerSender, removeFromOutbox, retryItem, subscribe } from '../../shared/offline/outbox';
import { submitStaffAttendanceActivity } from '../school/services/schoolApi';

const KIND = 'staff-attendance';
const LEGACY_QUEUE_KEY = 'ndovera_staff_attendance_queue_v1';

registerSender(KIND, payload => submitStaffAttendanceActivity(payload));

let migrated = null;
/** Marks queued by the previous version (localStorage) move into the outbox once. */
function migrateLegacyQueue() {
  if (migrated) return migrated;
  migrated = (async () => {
    if (typeof window === 'undefined') return;
    let legacy = [];
    try { legacy = JSON.parse(window.localStorage.getItem(LEGACY_QUEUE_KEY) || '[]'); } catch { legacy = []; }
    for (const entry of Array.isArray(legacy) ? legacy : []) {
      if (!entry?.payload) continue;
      await enqueue(KIND, { ...entry.payload, capturedAt: entry.payload.capturedAt || entry.queuedAt });
    }
    try { window.localStorage.removeItem(LEGACY_QUEUE_KEY); } catch {}
  })().catch(() => null);
  return migrated;
}
migrateLegacyQueue();

export async function getQueuedStaffAttendanceActions() {
  await migrateLegacyQueue();
  return (await listOutbox(KIND)).map(item => ({ id: item.id, queuedAt: item.createdAt, payload: item.payload, status: item.status, error: item.error, attempts: item.attempts }));
}

export async function queueStaffAttendanceAction(payload) {
  const item = await enqueue(KIND, { ...payload, capturedAt: payload?.capturedAt || new Date().toISOString() });
  return { id: item.id, queuedAt: item.createdAt, payload: item.payload, status: item.status };
}

export function removeQueuedStaffAttendanceAction(entryId) {
  return removeFromOutbox(entryId);
}

export function retryQueuedStaffAttendanceAction(entryId) {
  return retryItem(entryId);
}

/** Send queued marks now. Resolves to { sent, failed, waiting }. */
export function flushStaffAttendanceQueue() {
  return flushOutbox();
}

export function subscribeToStaffAttendanceQueue(listener) {
  return subscribe(items => listener(items.filter(item => item.kind === KIND)));
}
