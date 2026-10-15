import { getApiUrl } from '../../config/apiBase';
import { buildSelectedRoleHeader, getStoredAuth } from '../auth/services/authApi';

function authHeaders(json = true) {
  const auth = getStoredAuth();
  return {
    ...(json ? { 'Content-Type': 'application/json' } : {}),
    ...(auth?.token ? { Authorization: `Bearer ${auth.token}` } : {}),
    ...buildSelectedRoleHeader(),
  };
}

async function request(path, { method = 'GET', body } = {}) {
  const isForm = body instanceof FormData;
  const response = await fetch(getApiUrl(path), { method, headers: authHeaders(!isForm), body: body === undefined ? undefined : (isForm ? body : JSON.stringify(body)) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) throw new Error(data.message || data.error || 'Request failed.');
  return data;
}

const id = value => encodeURIComponent(String(value || ''));
const query = params => {
  const search = new URLSearchParams(Object.entries(params || {}).filter(([, value]) => value !== '' && value !== undefined && value !== null));
  return search.toString() ? `?${search}` : '';
};

export const getHealthContext = () => request('/api/health/context');
export const searchHealthStudents = q => request(`/api/health/students${query({ q })}`);
export const reportIncident = body => request('/api/health/incidents', { method: 'POST', body });
export const listHealthIncidents = filters => request(`/api/health/incidents${query(filters)}`);
export const getHealthIncident = incidentId => request(`/api/health/incidents/${id(incidentId)}`);
export const updateHealthIncident = (incidentId, body) => request(`/api/health/incidents/${id(incidentId)}`, { method: 'PUT', body });
export const setHealthRest = (incidentId, action) => request(`/api/health/incidents/${id(incidentId)}/rest`, { method: 'POST', body: { action } });
export const getStudentHealth = studentId => request(`/api/health/students/${id(studentId)}`);
export const saveHealthProfile = (studentId, body) => request(`/api/health/students/${id(studentId)}/profile`, { method: 'PUT', body });
export const getMyChildrenHealth = () => request('/api/health/mine');

export function uploadHealthPhoto(incidentId, file) {
  const form = new FormData();
  form.append('file', file);
  return request(`/api/health/incidents/${id(incidentId)}/photos`, { method: 'POST', body: form });
}

/** A private photo, fetched with the signed-in account and shown from memory. */
export async function loadHealthPhoto(url) {
  const response = await fetch(getApiUrl(url), { headers: authHeaders(false) });
  if (!response.ok) throw new Error('Photo not available.');
  return URL.createObjectURL(await response.blob());
}
