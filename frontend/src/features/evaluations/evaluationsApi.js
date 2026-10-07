import { getApiUrl } from '../../config/apiBase';
import { buildSelectedRoleHeader } from '../auth/services/authApi';

// Staff evaluation (Worker: staffEvaluations.ts).

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

export const listEvaluations = () => request('/api/staff-evaluations');
export const createEvaluation = payload => request('/api/staff-evaluations', { method: 'POST', body: payload });
export const updateEvaluation = (id, payload) => request(`/api/staff-evaluations/${encodeURIComponent(id)}`, { method: 'PUT', body: payload });
export const closeEvaluation = id => request(`/api/staff-evaluations/${encodeURIComponent(id)}/close`, { method: 'POST' });
export const getEvaluationResults = id => request(`/api/staff-evaluations/${encodeURIComponent(id)}/results`);
export const summariseStaffFeedback = (id, staffId) => request(`/api/staff-evaluations/${encodeURIComponent(id)}/results/${encodeURIComponent(staffId)}/ai-summary`, { method: 'POST' });
export const getMyEvaluations = () => request('/api/staff-evaluations-mine');
export const submitEvaluationResponse = (id, payload) => request(`/api/staff-evaluations/${encodeURIComponent(id)}/responses`, { method: 'POST', body: payload });

export const EVALUATION_STATUS = {
  not_started: { label: 'Not Started', className: 'bg-slate-200 text-slate-800' },
  open: { label: 'Open', className: 'bg-emerald-100 text-emerald-900' },
  closed: { label: 'Completed / Closed', className: 'bg-[#800020] text-[#b5e3f4]' },
};
