import { getStoredAuth } from '../auth/services/authApi';
import { getStudentDashboard } from '../../services/roleDashboardService';
import { currentUserKey, getItem, isOnline, removeItem, requestPersistentStorage, setItem } from '../../shared/offline/offlineStore';
import { listOutbox } from '../../shared/offline/outbox';
import { getAssignments } from './classroomService';

// A student's work, kept on the device: the list of assignments (downloaded whenever
// Ndovera can be reached, so new work is on the phone before the network goes), the
// answers typed so far, and hand-ins waiting in the outbox. With no network the
// student still sees every task, answers it, and the hand-in goes when Ndovera is back.

const listKey = classId => `tasks:${currentUserKey()}:${classId}`;
const draftKey = assignmentId => `task-draft:${currentUserKey()}:${assignmentId}`;

/**
 * The student's own class. The signed-in profile comes first: the loose "classroomId"
 * key can be left behind by someone else who used this phone, or by last session's class.
 */
export function studentClassId() {
  let user = getStoredAuth()?.user;
  if (!user) {
    try { user = JSON.parse(window.localStorage.getItem('authUser') || '{}') || {}; } catch { user = {}; }
  }
  return String(user.classId || window.localStorage.getItem('classroomId') || '').trim();
}

/** The class, asking Ndovera when the profile on this device does not carry one. */
export async function resolveStudentClassId() {
  const known = studentClassId();
  if (known || !isOnline()) return known;
  const dashboard = await getStudentDashboard().catch(() => null);
  const classId = dashboard?._meta?.source === 'fallback' ? '' : String(dashboard?.classId || '').trim();
  if (classId) window.localStorage.setItem('classroomId', classId);
  return classId;
}

/** Hand-ins still on this device, by assignment. */
async function queuedSubmissions() {
  const items = await listOutbox('assignment-submit').catch(() => []);
  const byAssignment = new Map();
  for (const item of items) {
    const { assignmentId, body } = item.payload || {};
    if (!assignmentId) continue;
    byAssignment.set(String(assignmentId), {
      assignmentId, status: item.status === 'needs_review' ? 'needs_review' : 'queued', queued: true,
      error: item.error || '', submittedAt: body?.capturedAt || item.createdAt, content: { answers: body?.answers || {} },
    });
  }
  return byAssignment;
}

/** A queued hand-in counts as handed in, until Ndovera has the real one. */
function withQueued(assignments, queued) {
  return assignments.map(item => {
    const waiting = queued.get(String(item.id));
    if (!waiting) return item;
    const sentAt = item.mySubmission?.submittedAt || '';
    return sentAt && sentAt >= waiting.submittedAt ? item : { ...item, mySubmission: waiting, studentStatus: 'Waiting to send' };
  });
}

/** Pictures in questions, fetched once so the app's worker keeps them for offline. */
function keepImages(assignments) {
  const urls = new Set();
  for (const item of assignments) for (const question of item.questions || []) if (question?.imageUrl) urls.add(question.imageUrl);
  urls.forEach(url => { try { fetch(url, { credentials: 'same-origin' }).catch(() => null); } catch {} });
}

/**
 * The student's assignments: live when Ndovera answers (and kept), the kept copy when not.
 * Returns { classId, assignments, offline, savedAt, message }.
 */
export async function loadStudentAssignments() {
  const classId = await resolveStudentClassId();
  if (!classId) return { classId: '', assignments: [], offline: false, savedAt: '' };
  const queued = await queuedSubmissions();
  let failure = '';
  if (isOnline()) {
    try {
      const response = await getAssignments(classId);
      if (response?.success && Array.isArray(response.assignments)) {
        const savedAt = new Date().toISOString();
        await setItem(listKey(classId), { assignments: response.assignments, savedAt });
        requestPersistentStorage();
        keepImages(response.assignments);
        return { classId, assignments: withQueued(response.assignments, queued), offline: false, savedAt };
      }
      failure = response?.message || '';
    } catch (error) {
      failure = error?.message || '';
    }
  }
  const kept = await getItem(listKey(classId));
  if (!kept) {
    throw new Error(isOnline()
      ? (failure || 'Could not load assignments.')
      : 'You are offline, and your assignments have not been downloaded to this device yet. Open this page once with internet and they will stay here.');
  }
  return { classId, assignments: withQueued(kept.assignments || [], queued), offline: true, savedAt: kept.savedAt || '' };
}

/** Download the student's work now, so it is there when the network is not. Never throws. */
export function prefetchStudentTasks() {
  if (!isOnline()) return Promise.resolve(null);
  return loadStudentAssignments().catch(() => null);
}

// ─── Answers typed so far ────────────────────────────────────────────────────

export async function readAnswerDraft(assignmentId) {
  const draft = await getItem(draftKey(assignmentId));
  return draft && typeof draft.answers === 'object' ? draft : null;
}

export function saveAnswerDraft(assignmentId, answers) {
  return setItem(draftKey(assignmentId), { answers, savedAt: new Date().toISOString() });
}

export function clearAnswerDraft(assignmentId) {
  return removeItem(draftKey(assignmentId));
}
