import { getApiUrl } from '../../../config/apiBase';
import { getStoredAuth, syncRefreshedToken } from '../../auth/services/authApi';

function authHeaders(withJson = true) {
  const auth = getStoredAuth();
  return {
    ...(withJson ? { 'Content-Type': 'application/json' } : {}),
    ...(auth?.token ? { Authorization: `Bearer ${auth.token}` } : {}),
  };
}

async function parse(res) {
  syncRefreshedToken(res);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.message || 'Request failed.');
  return data;
}

async function request(path, { method = 'GET', body, auth = false } = {}) {
  const res = await fetch(getApiUrl(path), {
    method,
    credentials: 'include',
    headers: auth ? authHeaders(Boolean(body)) : (body ? { 'Content-Type': 'application/json' } : undefined),
    body: body ? JSON.stringify(body) : undefined,
  });
  return parse(res);
}

function query(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.set(key, value);
  });
  const text = search.toString();
  return text ? `?${text}` : '';
}

// Public
export const listPublicChampionships = (filters) => request(`/api/public/championships${query(filters)}`);
export const getPublicChampionship = (slug) => request(`/api/public/championships/${encodeURIComponent(slug)}`);
export const getPromotedChampionship = () => request('/api/public/championships/promo');

// Participant
export const getChampionshipEligibility = (slug) => request(`/api/championships/${encodeURIComponent(slug)}/eligibility`, { auth: true });
export const registerForChampionship = (slug, body) => request(`/api/championships/${encodeURIComponent(slug)}/register`, { method: 'POST', body: body || {}, auth: true });
export const getMyChampionships = () => request('/api/championships/mine', { auth: true });

// School Championship Centre
export const getSchoolChampionships = () => request('/api/school/championships', { auth: true });
export const getSchoolChampionshipRoster = (slug) => request(`/api/school/championships/${encodeURIComponent(slug)}/roster`, { auth: true });
export const nominateSchoolStudents = (slug, studentIds) => request(`/api/school/championships/${encodeURIComponent(slug)}/nominate`, { method: 'POST', body: { studentIds }, auth: true });

// Parent Championship Centre
export const getParentChampionships = () => request('/api/parent/championships', { auth: true });
export const registerChildForChampionship = (slug, body) => request(`/api/parent/championships/${encodeURIComponent(slug)}/register-child`, { method: 'POST', body, auth: true });

// Question bank pool (schools contribute, Ami moderates)
export const submitChampionshipQuestion = (body) => request('/api/school/championships/questions', { method: 'POST', body, auth: true });
export const listSchoolChampionshipQuestions = (status) => request(`/api/school/championships/questions${query({ status })}`, { auth: true });
export const listAmiChampionshipQuestions = (filters) => request(`/api/ami/championships/questions${query(filters)}`, { auth: true });
export const moderateChampionshipQuestion = (id, decision, note) => request(`/api/ami/championships/questions/${encodeURIComponent(id)}/moderate`, { method: 'POST', body: { decision, note }, auth: true });

// Written entries (essays and similar)
export const submitChampionshipEntry = (slug, body) => request(`/api/championships/${encodeURIComponent(slug)}/submissions`, { method: 'POST', body, auth: true });
export const getMyChampionshipSubmissions = (slug) => request(`/api/championships/${encodeURIComponent(slug)}/my-submissions`, { auth: true });

// Ami
export const listAmiChampionships = () => request('/api/ami/championships', { auth: true });
export const getAmiChampionship = (id) => request(`/api/ami/championships/${encodeURIComponent(id)}`, { auth: true });
export const saveAmiChampionship = (body) => request('/api/ami/championships', { method: 'POST', body, auth: true });
export const setAmiChampionshipStatus = (id, status) => request(`/api/ami/championships/${encodeURIComponent(id)}/status`, { method: 'POST', body: { status }, auth: true });
