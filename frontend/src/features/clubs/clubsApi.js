import { getApiUrl } from '../../config/apiBase';
import { buildSelectedRoleHeader } from '../auth/services/authApi';
import { currentUserKey, getItem, isOnline, setItem } from '../../shared/offline/offlineStore';
import { enqueue, isRetryable, registerSender } from '../../shared/offline/outbox';

// Clubs (Worker: clubs.ts). A club's page — its notes, links and work — is kept on
// the device each time it is opened, so notes can be read with no internet.

function headers(json = true) {
  const token = localStorage.getItem('token');
  return { ...(json ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...buildSelectedRoleHeader() };
}

async function request(path, { method = 'GET', body } = {}) {
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  const response = await fetch(getApiUrl(path), { method, credentials: 'include', headers: headers(!isForm), body: body ? (isForm ? body : JSON.stringify(body)) : undefined });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) {
    const error = new Error(data.message || data.error || 'Request failed.');
    error.status = response.status;
    throw error;
  }
  return data;
}

const key = suffix => `clubs:${currentUserKey()}:${suffix}`;
const id = value => encodeURIComponent(value);

/** Live when online (and kept), the kept copy when not. */
async function cached(path, cacheKey) {
  if (isOnline()) {
    try {
      const data = await request(path);
      await setItem(key(cacheKey), { ...data, savedAt: Date.now() }).catch(() => null);
      return { ...data, offline: false };
    } catch (error) {
      if (error.status && error.status < 500) throw error;
    }
  }
  const kept = await getItem(key(cacheKey)).catch(() => null);
  if (!kept) throw Object.assign(new Error('You are offline and this has not been opened on this device yet.'), { offline: true });
  return { ...kept, offline: true };
}

export const listClubs = () => cached('/api/clubs', 'list');
export const getClub = clubId => cached(`/api/clubs/${id(clubId)}`, `club:${clubId}`);
export const createClub = payload => request('/api/clubs', { method: 'POST', body: payload });
export const updateClub = (clubId, payload) => request(`/api/clubs/${id(clubId)}`, { method: 'PUT', body: payload });
export const findPeople = (clubId, params) => request(`/api/clubs/${id(clubId)}/candidates?${new URLSearchParams(params).toString()}`);
export const addMembers = (clubId, people, as = '') => request(`/api/clubs/${id(clubId)}/members`, { method: 'POST', body: { people, as } });
export const removeMember = (clubId, userId) => request(`/api/clubs/${id(clubId)}/members/${id(userId)}`, { method: 'DELETE' });
export const setLeader = (clubId, userId, leader) => request(`/api/clubs/${id(clubId)}/members/${id(userId)}/leader`, { method: 'POST', body: { leader } });
export const createPost = (clubId, payload) => request(`/api/clubs/${id(clubId)}/posts`, { method: 'POST', body: payload });
export const withdrawPost = (clubId, postId) => request(`/api/clubs/${id(clubId)}/posts/${id(postId)}`, { method: 'DELETE' });
const sendWork = (clubId, postId, payload) => request(`/api/clubs/${id(clubId)}/posts/${id(postId)}/submit`, { method: 'POST', body: payload });
registerSender('club-submit', ({ clubId, postId, payload }) => sendWork(clubId, postId, payload));

/** Hand in club work. With no connection it waits on the device and goes by itself when Ndovera is back. */
export async function submitWork(clubId, postId, payload) {
  try {
    return await sendWork(clubId, postId, payload);
  } catch (error) {
    if (!isRetryable(error)) throw error;
    const submittedAt = new Date().toISOString();
    await enqueue('club-submit', { clubId, postId, payload }, { label: 'Club hand-in' });
    return { success: true, queued: true, submission: { ...payload, queued: true, submittedAt } };
  }
}
export const listWork = (clubId, postId) => request(`/api/clubs/${id(clubId)}/posts/${id(postId)}/submissions`);
export const markWork = (clubId, submissionId, payload) => request(`/api/clubs/${id(clubId)}/submissions/${id(submissionId)}/mark`, { method: 'POST', body: payload });

export async function uploadClubFile(clubId, file) {
  const form = new FormData();
  form.append('file', file);
  return (await request(`/api/clubs/${id(clubId)}/upload`, { method: 'POST', body: form })).file;
}

export const POST_TYPES = [
  ['note', '📝 Note'], ['video', '🎬 Video'], ['image', '🖼️ Images'], ['document', '📄 Document'],
  ['link', '🔗 Link'], ['announcement', '📣 Announcement'], ['assignment', '✍️ Assignment'], ['quiz', '❓ Quiz'],
];

export const CATEGORY_STYLES = {
  Academic: 'from-indigo-600 to-blue-600', 'Arts & Culture': 'from-fuchsia-600 to-pink-600', Sports: 'from-emerald-600 to-green-600',
  'Science & Technology': 'from-cyan-600 to-sky-600', 'Service & Leadership': 'from-amber-500 to-orange-600', Faith: 'from-violet-600 to-purple-600', Other: 'from-slate-600 to-slate-800',
};
