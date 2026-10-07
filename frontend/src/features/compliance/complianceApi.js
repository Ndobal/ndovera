import { getApiUrl } from '../../config/apiBase';
import { buildSelectedRoleHeader } from '../auth/services/authApi';

// Teacher Submissions & Compliance (Worker: compliance.ts).

function headers() {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...buildSelectedRoleHeader(),
  };
}

async function request(path, { method = 'GET', body } = {}) {
  const response = await fetch(getApiUrl(path), { method, credentials: 'include', headers: headers(), body: body ? JSON.stringify(body) : undefined });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) {
    const error = new Error(data.message || data.error || 'Request failed.');
    error.data = data;
    error.status = response.status;
    throw error;
  }
  return data;
}

function query(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => { if (value !== undefined && value !== null && value !== '') search.set(key, String(value)); });
  const text = search.toString();
  return text ? `?${text}` : '';
}

export const getComplianceConfig = () => request('/api/compliance/config');
export const createComplianceRule = rule => request('/api/compliance/rules', { method: 'POST', body: rule });
export const updateComplianceRule = (id, rule) => request(`/api/compliance/rules/${encodeURIComponent(id)}`, { method: 'PUT', body: rule });
export const setComplianceRuleActive = (id, active) => request(`/api/compliance/rules/${encodeURIComponent(id)}/active`, { method: 'POST', body: { active } });
export const saveComplianceSettings = settings => request('/api/compliance/settings', { method: 'PUT', body: settings });
export const getMyCompliance = (params = {}) => request(`/api/compliance/mine${query(params)}`);
export const getComplianceOverview = (params = {}) => request(`/api/compliance/overview${query(params)}`);
export const getTeacherCompliance = (teacherId, params = {}) => request(`/api/compliance/teachers/${encodeURIComponent(teacherId)}${query(params)}`);
export const verifyComplianceUnit = payload => request('/api/compliance/verify', { method: 'POST', body: payload });
export const uploadComplianceEvidence = payload => request('/api/compliance/evidence', { method: 'POST', body: payload });
export const decideComplianceFine = payload => request('/api/compliance/fines', { method: 'POST', body: payload });
export const getComplianceAudit = (params = {}) => request(`/api/compliance/audit${query(params)}`);
export const getClassReportTemplate = () => request('/api/compliance/class-report-template');
export const saveClassReportTemplate = questions => request('/api/compliance/class-report-template', { method: 'PUT', body: { questions } });
export const getMyClassReport = (params = {}) => request(`/api/compliance/class-report${query(params)}`);
export const saveMyClassReport = payload => request('/api/compliance/class-report', { method: 'PUT', body: payload });
export const generateClassReportSummary = id => request(`/api/compliance/class-report/${encodeURIComponent(id)}/ai-summary`, { method: 'POST' });
export const submitMyClassReport = (id, summary) => request(`/api/compliance/class-report/${encodeURIComponent(id)}/submit`, { method: 'POST', body: { summary } });
export const getClassReports = (params = {}) => request(`/api/compliance/class-reports${query(params)}`);

/** Uploads one file through the submissions store and returns { name, url, type, size }. */
export async function uploadComplianceFile(file) {
  const token = localStorage.getItem('token');
  const form = new FormData();
  form.append('file', file);
  const response = await fetch(getApiUrl('/api/teacher-submissions/upload'), {
    method: 'POST', credentials: 'include', body: form,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...buildSelectedRoleHeader() },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.file) throw new Error(data.message || 'Could not upload that file.');
  return data.file;
}
