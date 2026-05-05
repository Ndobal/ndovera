import { getApiUrl } from '../../../config/apiBase';
import { getStoredAuth } from '../../auth/services/authApi';

function buildHeaders() {
  const auth = getStoredAuth();
  return {
    'Content-Type': 'application/json',
    ...(auth?.token ? { Authorization: `Bearer ${auth.token}` } : {}),
  };
}

async function req(path, opts = {}) {
  const res = await fetch(getApiUrl(path), {
    method: opts.method || 'GET',
    headers: buildHeaders(),
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.message || 'Request failed.');
  return data;
}

export const getMe = () => req('/api/users/me');
export const getMyTenant = () => req('/api/tenants/me');
export const getAuditLog = () => req('/api/audit');
export const getAttendance = () => req('/api/attendance');
export const resetPassword = (payload) => req('/api/admin/reset-password', { method: 'POST', body: payload });
export const getApprovals = () => req('/api/approvals');
export const getPeople = () => req('/api/people');
export const getExams = () => req('/api/exams');
export const getOwnerSchools = () => req('/api/owner/schools');
export const addPerson = (data) => req('/api/people', { method: 'POST', body: data });
export const deactivatePerson = (userId) => req(`/api/people/${userId}`, { method: 'DELETE' });
export const updatePersonRole = (userId, role) => req(`/api/people/${userId}/role`, { method: 'PUT', body: { role } });
export const getClasses = () => req('/api/school/classes');
export const addClass = (data) => req('/api/school/classes', { method: 'POST', body: data });
export const getSubjects = () => req('/api/school/subjects');
export const addSubject = (data) => req('/api/school/subjects', { method: 'POST', body: data });
export const getSession = () => req('/api/school/session');
export const saveSession = (data) => req('/api/school/session', { method: 'POST', body: data });
export const getBranding = () => req('/api/school/branding');
export const saveBranding = (data) => req('/api/school/branding', { method: 'POST', body: data });
