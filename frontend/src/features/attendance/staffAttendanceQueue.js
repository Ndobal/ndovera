const STAFF_ATTENDANCE_QUEUE_KEY = 'ndovera_staff_attendance_queue_v1';

function readQueue() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STAFF_ATTENDANCE_QUEUE_KEY);
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed.filter(entry => entry && typeof entry === 'object' && entry.id && entry.payload) : [];
  } catch {
    return [];
  }
}

function writeQueue(entries) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STAFF_ATTENDANCE_QUEUE_KEY, JSON.stringify(Array.isArray(entries) ? entries : []));
  } catch {}
}

export function getQueuedStaffAttendanceActions() {
  return readQueue();
}

export function queueStaffAttendanceAction(payload) {
  const entries = readQueue();
  const entry = {
    id: `staff_attendance_queue_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    queuedAt: new Date().toISOString(),
    payload,
  };
  entries.push(entry);
  writeQueue(entries);
  return entry;
}

export function removeQueuedStaffAttendanceAction(entryId) {
  writeQueue(readQueue().filter(entry => entry.id !== entryId));
}