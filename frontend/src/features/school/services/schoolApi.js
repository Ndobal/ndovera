import { getApiUrl } from '../../../config/apiBase';
import { getStoredAuth, clearStoredAuth, persistAuth } from '../../auth/services/authApi';

function buildHeaders() {
  const auth = getStoredAuth();
  return {
    'Content-Type': 'application/json',
    ...(auth?.token ? { Authorization: `Bearer ${auth.token}` } : {}),
  };
}

function handleUnauthorized() {
  clearStoredAuth();
  window.location.href = '/login';
}

// Silently refresh the stored token if the server issued a new one (sliding expiry)
function applyRefreshedToken(res) {
  const refreshed = res.headers.get('X-Refresh-Token');
  if (refreshed) {
    const auth = getStoredAuth();
    if (auth) persistAuth({ token: refreshed, user: auth.user });
  }
}

async function req(path, opts = {}) {
  const res = await fetch(getApiUrl(path), {
    method: opts.method || 'GET',
    headers: buildHeaders(),
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (res.status === 401) { handleUnauthorized(); return {}; }
  applyRefreshedToken(res);
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

async function uploadFile(path, file, extraFields = {}) {
  const auth = getStoredAuth();
  const formData = new FormData();
  formData.append('file', file);
  for (const [k, v] of Object.entries(extraFields)) formData.append(k, v);
  const res = await fetch(getApiUrl(path), {
    method: 'POST',
    headers: auth?.token ? { Authorization: `Bearer ${auth.token}` } : {},
    body: formData,
  });
  if (res.status === 401) { handleUnauthorized(); return {}; }
  applyRefreshedToken(res);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.message || 'Upload failed.');
  return data;
}

export const uploadLogo = (file) => uploadFile('/api/school/logo', file);
export const getWebsiteSections = () => req('/api/school/website/sections');
export const saveWebsiteSection = (data) => req('/api/school/website/sections', { method: 'POST', body: data });
export const uploadSectionImage = (file, sectionKey) => uploadFile('/api/school/website/sections/upload', file, { sectionKey });
export const getEvents = () => req('/api/school/events');
export const createEvent = (data) => req('/api/school/events', { method: 'POST', body: data });
export const updateEvent = (id, data) => req(`/api/school/events/${id}`, { method: 'PUT', body: data });
export const deleteEvent = (id) => req(`/api/school/events/${id}`, { method: 'DELETE' });
export const uploadEventMedia = (file) => uploadFile('/api/school/events/upload', file);
export const getParents = () => req('/api/school/parents');
export const bulkAddSubjects = (classId, data) => req(`/api/school/classes/${classId}/subjects/bulk`, { method: 'POST', body: data });
export const updateSubject = (subjectId, data) => req(`/api/school/subjects/${subjectId}`, { method: 'PUT', body: data });
export const deleteSubject = (subjectId) => req(`/api/school/subjects/${subjectId}`, { method: 'DELETE' });
export const updateClass = (classId, data) => req(`/api/school/classes/${classId}`, { method: 'PUT', body: data });
export const getUserProfile = (userId) => req(`/api/people/${userId}`);
export const updateUserProfile = (userId, data) => req(`/api/people/${userId}`, { method: 'PUT', body: data });
export const linkParentStudent = (data) => req('/api/school/parent-student-link', { method: 'POST', body: data });
