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
