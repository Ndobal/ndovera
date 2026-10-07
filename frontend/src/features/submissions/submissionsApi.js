import { getApiUrl } from '../../config/apiBase';
import { buildSelectedRoleHeader } from '../auth/services/authApi';

// Teacher work submission and review (Worker: teacherSubmissions.ts).

function headers(json = true) {
  const token = localStorage.getItem('token');
  return {
    ...(json ? { 'Content-Type': 'application/json' } : {}),
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

export const getSubmissionConfig = () => request('/api/teacher-submissions/config');
export const saveSubmissionConfig = policy => request('/api/teacher-submissions/config', { method: 'PUT', body: policy });
export const getMySubmissions = (params = {}) => request(`/api/teacher-submissions/mine${query(params)}`);
export const getSubmissionResources = params => request(`/api/teacher-submissions/resources${query(params)}`);
export const createSubmission = payload => request('/api/teacher-submissions', { method: 'POST', body: payload });
export const createSubmissionBatch = payload => request('/api/teacher-submissions/bulk', { method: 'POST', body: payload });
export const getSubmissionDetail = id => request(`/api/teacher-submissions/${encodeURIComponent(id)}`);
export const updateSubmission = (id, payload) => request(`/api/teacher-submissions/${encodeURIComponent(id)}`, { method: 'PUT', body: payload });
export const submitSubmission = id => request(`/api/teacher-submissions/${encodeURIComponent(id)}/submit`, { method: 'POST' });
export const deleteSubmission = id => request(`/api/teacher-submissions/${encodeURIComponent(id)}`, { method: 'DELETE' });
export const getReviewBoard = (params = {}) => request(`/api/teacher-submissions/review${query(params)}`);
export const startSubmissionReview = id => request(`/api/teacher-submissions/${encodeURIComponent(id)}/start-review`, { method: 'POST' });
export const decideSubmission = (id, payload) => request(`/api/teacher-submissions/${encodeURIComponent(id)}/decision`, { method: 'POST', body: payload });
export const runAiReview = id => request(`/api/teacher-submissions/${encodeURIComponent(id)}/ai-review`, { method: 'POST' });

export async function uploadSubmissionFile(file) {
  const form = new FormData();
  form.append('file', file);
  const response = await fetch(getApiUrl('/api/teacher-submissions/upload'), { method: 'POST', credentials: 'include', headers: headers(false), body: form });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) throw new Error(data.message || 'Could not upload that file.');
  return data.file;
}

export const STATUS_LABELS = {
  draft: 'Draft',
  submitted: 'Submitted',
  under_review: 'Under Review',
  approved: 'Approved',
  returned: 'Returned for Correction',
  resubmitted: 'Resubmitted',
};

export const STATUS_STYLES = {
  draft: 'bg-slate-200 text-slate-800',
  submitted: 'bg-sky-100 text-sky-900',
  under_review: 'bg-amber-100 text-amber-900',
  approved: 'bg-emerald-100 text-emerald-900',
  returned: 'bg-rose-100 text-rose-900',
  resubmitted: 'bg-indigo-100 text-indigo-900',
};
