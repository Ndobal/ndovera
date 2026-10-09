import { getApiUrl } from '../../config/apiBase';
import { buildSelectedRoleHeader } from '../auth/services/authApi';
import { currentUserKey, getItem, isOnline, setItem } from '../../shared/offline/offlineStore';
import { enqueue, listOutbox, registerSender } from '../../shared/offline/outbox';

// Practice Arena (Worker: practiceArena.ts). Everything a student needs to
// practise is kept on the device: the home screen, a pack per subject (questions
// with their answers), and finished quizzes waiting to sync.

function headers() {
  const token = localStorage.getItem('token');
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...buildSelectedRoleHeader() };
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

/** A subject's questions: fresh when online (and kept for offline play), else the kept pack. */
export async function loadPack(subjectKey, { refresh = true } = {}) {
  if (refresh && isOnline()) {
    try {
      const data = await request(`/api/practice-arena/pack?subject=${encodeURIComponent(subjectKey)}&size=80`);
      await setItem(key(`pack:${subjectKey}`), { ...data.pack, savedAt: Date.now() });
      return { ...data.pack, offline: false };
    } catch (error) {
      if (error.status && error.status < 500) throw error;
    }
  }
  const kept = await getItem(key(`pack:${subjectKey}`));
  if (!kept) throw Object.assign(new Error('These questions are not on this device yet. Connect to the internet to download them.'), { offline: true });
  return { ...kept, offline: true };
}

export async function packSavedAt(subjectKey) {
  const kept = await getItem(key(`pack:${subjectKey}`));
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

export const getLeaderboard = (scope = 'class') => request(`/api/practice-arena/leaderboard?scope=${scope}`);
