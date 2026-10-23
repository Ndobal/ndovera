import { getApiUrl } from '../../config/apiBase';
import { buildSelectedRoleHeader } from '../auth/services/authApi';
import { currentUserKey, getItem, isOnline, setItem } from '../../shared/offline/offlineStore';
import { enqueue, listOutbox, registerSender } from '../../shared/offline/outbox';

// Practice Arena (Worker: practiceArena.ts). Everything a student needs to
// practise is kept on the device: the home screen, a pack per subject (questions
// with their answers), and finished quizzes waiting to sync.

/** This device's id for practice passes (paid practice opens on two devices per student). */
export function practiceDeviceId() {
  try {
    let id = localStorage.getItem('ndovera:practiceDevice');
    if (!id) {
      id = `dev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
      localStorage.setItem('ndovera:practiceDevice', id);
    }
    return id;
  } catch { return ''; }
}

function headers() {
  const token = localStorage.getItem('token');
  const device = practiceDeviceId();
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(device ? { 'X-Practice-Device': device } : {}), ...buildSelectedRoleHeader() };
}

async function request(path, { method = 'GET', body } = {}) {
  const response = await fetch(getApiUrl(path), { method, credentials: 'include', headers: headers(), body: body ? JSON.stringify(body) : undefined });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) {
    const error = new Error(data.message || data.error || 'Request failed.');
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

const key = suffix => `practice:${currentUserKey()}:${suffix}`;
const ATTEMPT_KIND = 'practice-attempt';

registerSender(ATTEMPT_KIND, attempt => request('/api/practice-arena/attempts', { method: 'POST', body: attempt }));

/** The arena's home: live when online (and kept), the kept copy when not. */
export async function loadHome() {
  if (isOnline()) {
    try {
      const data = await request('/api/practice-arena/home');
      await setItem(key('home'), { ...data, savedAt: Date.now() });
      return { ...data, offline: false };
    } catch (error) {
      if (error.status && error.status < 500) throw error;
    }
  }
  const kept = await getItem(key('home'));
  if (!kept) throw Object.assign(new Error('You are offline and practice has not been opened on this device yet. Connect once to download your questions.'), { offline: true });
  return { ...kept, offline: true };
}

const packKey = (subjectKey, difficulty, exam = '') => key(`pack:${subjectKey}${difficulty ? `:${difficulty}` : ''}${exam ? `:${exam}` : ''}`);

/** A kept pack plays offline only until its pass ends (or a week after download). */
const stillValid = pack => !pack?.validUntil || Date.parse(pack.validUntil) > Date.now();

/**
 * A subject's questions at a difficulty (simple, intermediate, external; '' for all):
 * fresh when online (and kept for offline play), else the kept pack. `needsMore` says
 * the subject has too few and Ndovera AI can prepare more.
 */
export async function loadPack(subjectKey, { refresh = true, difficulty = '', exam = '' } = {}) {
  if (refresh && isOnline()) {
    try {
      const data = await request(`/api/practice-arena/pack?subject=${encodeURIComponent(subjectKey)}&size=60${difficulty ? `&difficulty=${difficulty}` : ''}${exam ? `&exam=${exam}` : ''}`);
      if (data.pack.questions.length) await setItem(packKey(subjectKey, difficulty, exam), { ...data.pack, savedAt: Date.now() });
      return { ...data.pack, needsMore: Boolean(data.needsMore), offline: false };
    } catch (error) {
      // Today's free questions used up: the questions already on this device can still be replayed.
      if (error.data?.freeLimit) {
        const kept = await getItem(packKey(subjectKey, difficulty, exam));
        if (kept?.questions?.length && stillValid(kept)) return { ...kept, offline: false, replay: true };
        throw error;
      }
      if (error.status && error.status < 500) throw error;
    }
  }
  const kept = await getItem(packKey(subjectKey, difficulty, exam));
  if (kept && !stillValid(kept)) throw Object.assign(new Error('These saved questions have expired on this device. Connect to the internet to download them again.'), { offline: true });
  if (!kept) throw Object.assign(new Error('These questions are not on this device yet. Connect to the internet to download them.'), { offline: true });
  return { ...kept, offline: true };
}

/** Ask Ndovera AI to write practice questions for a paid subject that has too few. */
export const generateQuestions = (subjectKey, difficulty, exam = '') => request('/api/practice-arena/generate', { method: 'POST', body: { subject: subjectKey, difficulty, exam } });

/** A timed mock examination (JAMB: Use of English + 3 subjects; others: one subject). Online only. */
export const loadMock = (exam, subject = '') => request(`/api/practice-arena/mock?exam=${exam}${subject ? `&subject=${encodeURIComponent(subject)}` : ''}`);

export const quotePass = payload => request('/api/practice-arena/passes/quote', { method: 'POST', body: payload });
export const checkoutPass = payload => request('/api/practice-arena/passes/checkout', { method: 'POST', body: payload });
export const verifyPass = txRef => request('/api/practice-arena/passes/verify', { method: 'POST', body: { txRef } });
export const getFamilyPasses = () => request('/api/practice-arena/family');
export const getSchoolPasses = () => request('/api/practice-arena/school');
export const clearStudentDevices = studentId => request('/api/practice-arena/devices/clear', { method: 'POST', body: { studentId } });
export const naira = value => `₦${(Number(value) || 0).toLocaleString()}`;

export async function packSavedAt(subjectKey) {
  const kept = await getItem(packKey(subjectKey, ''));
  return kept?.savedAt || null;
}

/**
 * Save a finished quiz: sent now when online; otherwise it waits in the outbox
 * and syncs by itself. Resolves with Ndovera's result, or { queued: true }.
 */
export async function saveAttempt(attempt) {
  if (isOnline()) {
    try {
      return await request('/api/practice-arena/attempts', { method: 'POST', body: attempt });
    } catch (error) {
      if (error.status && error.status < 500) throw error;
    }
  }
  await enqueue(ATTEMPT_KIND, attempt);
  return { queued: true };
}

export async function pendingAttempts() {
  return (await listOutbox(ATTEMPT_KIND)).filter(item => item.status === 'queued').length;
}

export const getLeaderboard = (scope = 'class', subject = '') => request(`/api/practice-arena/leaderboard?scope=${scope}${subject ? `&subject=${encodeURIComponent(subject)}` : ''}`);

/** "Not this subject": the question is checked again by Ndovera AI (two reports hold it at once). */
export function reportWrongSubject(questionId) {
  return request(`/api/practice-arena/questions/${encodeURIComponent(questionId)}/report-subject`, { method: 'POST', body: {} });
}
