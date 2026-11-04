import { getApiUrl } from '../../config/apiBase';
import { buildSelectedRoleHeader } from '../auth/services/authApi';

// Reviews, the home page strips, one-time pass codes and country prices.

function headers() {
  const token = localStorage.getItem('token');
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...buildSelectedRoleHeader() };
}

async function request(path, { method = 'GET', body } = {}) {
  const response = await fetch(getApiUrl(path), { method, credentials: 'include', headers: headers(), body: body ? JSON.stringify(body) : undefined });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) throw new Error(data.message || data.error || 'Request failed.');
  return data;
}

export const getAiLimits = () => request('/api/ami/ai-limits');
export const saveAiLimits = body => request('/api/ami/ai-limits', { method: 'PUT', body });
export const getCustomExams = () => request('/api/ami/custom-exams');
export const createCustomExam = body => request('/api/ami/custom-exams', { method: 'POST', body });
export const updateCustomExam = (key, body) => request(`/api/ami/custom-exams/${encodeURIComponent(key)}`, { method: 'PUT', body });
export const addCustomExamTopics = (key, body) => request(`/api/ami/custom-exams/${encodeURIComponent(key)}/topics`, { method: 'POST', body });
export const joinExamRequest = (id, key) => request(`/api/ami/exam-requests/${encodeURIComponent(id)}/join`, { method: 'POST', body: { key } });
export const getMyExamRequests = () => request('/api/exam-requests/mine');
export async function sendExamRequest(form) {
  const { 'Content-Type': ignored, ...plain } = headers();
  const response = await fetch(getApiUrl('/api/exam-requests'), { method: 'POST', credentials: 'include', headers: plain, body: form });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) throw new Error(data.message || data.error || 'Could not send your request.');
  return data;
}
export const getExamRequests = status => request(`/api/ami/exam-requests?status=${encodeURIComponent(status)}`);
export const answerExamRequest = (id, body) => request(`/api/ami/exam-requests/${encodeURIComponent(id)}`, { method: 'POST', body });
export async function downloadExamRequestFile(id, name) {
  const response = await fetch(getApiUrl(`/api/ami/exam-requests/${encodeURIComponent(id)}/file`), { credentials: 'include', headers: headers() });
  if (!response.ok) throw new Error('Could not open that file.');
  const link = document.createElement('a');
  link.href = URL.createObjectURL(await response.blob());
  link.download = name || 'curriculum';
  link.click();
  URL.revokeObjectURL(link.href);
}

export async function getFeatureChanges() {
  const { sections } = await request('/api/ami/website/sections');
  const row = (sections || []).find(item => item.section_key === 'features');
  try { return { added: [], hidden: [], ...JSON.parse(row?.metadata || '{}') }; } catch { return { added: [], hidden: [] }; }
}
export const saveFeatureChanges = metadata => request('/api/ami/website/sections', { method: 'POST', body: { sectionKey: 'features', title: '', content: '', metadata } });

export const getHomeShowcase = () => request('/api/public/home-showcase');
export const getMyReview = () => request('/api/reviews/mine');
export const saveMyReview = body => request('/api/reviews/mine', { method: 'POST', body });

export const getReviews = status => request(`/api/ami/reviews?status=${encodeURIComponent(status)}`);
export const setReviewStatus = (id, status) => request(`/api/ami/reviews/${encodeURIComponent(id)}`, { method: 'POST', body: { status } });
export const getShowcaseSchools = () => request('/api/ami/showcase/schools');
export const setSchoolHidden = (id, hidden) => request(`/api/ami/showcase/schools/${encodeURIComponent(id)}`, { method: 'POST', body: { hidden } });

export const getCodeBatches = () => request('/api/ami/pass-codes');
export const makeCodes = body => request('/api/ami/pass-codes', { method: 'POST', body });
export const getCodeBatch = id => request(`/api/ami/pass-codes/${encodeURIComponent(id)}`);
export const stopCodes = id => request(`/api/ami/pass-codes/${encodeURIComponent(id)}/cancel`, { method: 'POST', body: {} });

export const getContactChangePrice = () => request('/api/ami/contact-change-price');
export const saveContactChangePrice = naira => request('/api/ami/contact-change-price', { method: 'PUT', body: { naira } });
export const getBankClaims = status => request(`/api/ami/bank-claims?status=${encodeURIComponent(status)}`);
export const decideBankClaim = (id, decision) => request(`/api/ami/bank-claims/${encodeURIComponent(id)}`, { method: 'POST', body: { decision } });
export const getCountryPrices = () => request('/api/ami/pricing-countries');
export const saveCountryPrice = body => request('/api/ami/pricing-countries', { method: 'POST', body });
export const removeCountryPrice = country => request(`/api/ami/pricing-countries/${encodeURIComponent(country)}`, { method: 'DELETE' });
