import { getApiUrl } from '../../config/apiBase';
import { buildSelectedRoleHeader } from '../auth/services/authApi';

// Birthday celebrations (Worker: birthdays.ts). The server decides the school from the
// session; the client never sends one.

function headers() {
  const token = localStorage.getItem('token');
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...buildSelectedRoleHeader() };
}

async function request(path, { method = 'GET', body } = {}) {
  const response = await fetch(getApiUrl(`/api/birthdays${path}`), { method, credentials: 'include', cache: 'no-store', headers: { ...headers(), 'X-No-Offline-Cache': '1' }, body: body ? JSON.stringify(body) : undefined });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) {
    const error = new Error(data.message || (response.status === 404 ? 'This celebration is unavailable.' : 'Birthday service unavailable. Please try again.'));
    error.status = response.status;
    throw error;
  }
  return data;
}

const id = value => encodeURIComponent(value);

export const getToday = () => request('/today');
export const getMemories = () => request('/memories');
export const getCelebration = celebrationId => request(`/${id(celebrationId)}`);
export const getWishes = celebrationId => request(`/${id(celebrationId)}/wishes`);
export const sendWish = (celebrationId, message, requestId) => request(`/${id(celebrationId)}/wishes`, { method: 'POST', body: { message, requestId } });
export const suggestWish = (celebrationId, style) => request(`/${id(celebrationId)}/suggestions`, { method: 'POST', body: { style } });
export const reportWish = (celebrationId, wishId, reason) => request(`/${id(celebrationId)}/wishes/${id(wishId)}/report`, { method: 'POST', body: { reason } });
export const getSettings = () => request('/settings');
export const saveSettings = settings => request('/settings', { method: 'PUT', body: settings });
export const getModeration = () => request('/moderation');
export const decideWish = (wishId, decision) => request(`/wishes/${id(wishId)}/decision`, { method: 'POST', body: { decision } });
export const getMyConsent = () => request('/my-consent');
export const setMyConsent = celebrate => request('/my-consent', { method: 'PUT', body: { celebrate } });
export const setChildConsent = (studentId, celebrate) => request(`/consent/${id(studentId)}`, { method: 'PUT', body: { celebrate } });

/** The card (SVG) as an object URL, fetched with the session — never a public link. */
export async function getCardUrl(celebrationId) {
  const response = await fetch(getApiUrl(`/api/birthdays/${id(celebrationId)}/card`), { credentials: 'include', cache: 'no-store', headers: { ...headers(), 'X-No-Offline-Cache': '1' } });
  if (!response.ok) throw new Error('Card unavailable.');
  return URL.createObjectURL(await response.blob());
}

/** Turn the card into a PNG on this device (no server work) and save it. */
export async function downloadCardPng(cardUrl, filename) {
  const image = new Image();
  await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; image.src = cardUrl; });
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1350;
  canvas.getContext('2d').drawImage(image, 0, 0, 1080, 1350);
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}
