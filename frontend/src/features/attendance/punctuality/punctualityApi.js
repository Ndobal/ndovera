import { getApiUrl } from '../../../config/apiBase';
import { buildSelectedRoleHeader } from '../../auth/services/authApi';

// Staff punctuality (Worker: staffPunctuality.ts).

async function request(path, { method = 'GET', body } = {}) {
  const token = localStorage.getItem('token');
  const response = await fetch(getApiUrl(path), {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...buildSelectedRoleHeader() },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) throw new Error(data.message || data.error || 'Request failed.');
  return data;
}

export const getPunctualityReport = (period, date = '') => request(`/api/school/staff-punctuality?period=${encodeURIComponent(period)}${date ? `&date=${encodeURIComponent(date)}` : ''}`);
export const getPunctualityWinner = month => request(`/api/school/staff-punctuality/winner?month=${encodeURIComponent(month)}`);
export const publishPunctualityAward = payload => request('/api/school/staff-punctuality/awards', { method: 'POST', body: payload });
export const getPunctualityAward = () => request('/api/school/staff-punctuality/award');
