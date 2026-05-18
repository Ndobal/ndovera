import { getApiUrl } from '../../../config/apiBase';
import { getStoredAuth, clearStoredAuth, getSignedOutRedirectPath, syncRefreshedToken, buildSelectedRoleHeader } from '../../auth/services/authApi';
import { storeTenantPwaInfo } from '../../../shared/hooks/useTenantPwaManifest';

function buildHeaders() {
  const auth = getStoredAuth();
  return {
    'Content-Type': 'application/json',
    ...(auth?.token ? { Authorization: `Bearer ${auth.token}` } : {}),
    ...buildSelectedRoleHeader(),
  };
}

function handleUnauthorized() {
  clearStoredAuth();
  window.location.replace(getSignedOutRedirectPath());
}

// Silently refresh the stored token if the server issued a new one (sliding expiry)
function applyRefreshedToken(res) {
  syncRefreshedToken(res);
}

async function req(path, opts = {}) {
  const res = await fetch(getApiUrl(path), {
    method: opts.method || 'GET',
    credentials: 'include',
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
export const getMyTenant = async () => {
  const data = await req('/api/tenants/me');
  // Cache tenant branding for PWA manifest and logout redirect
  const t = data?.tenants?.[0] || data;
  if (t?.subdomain || t?.schoolName || t?.name || t?.branding?.logoUrl || t?.logoUrl) {
    const subdomain = t.subdomain || '';
    const schoolName = t.schoolName || t.name || t.branding?.schoolName || '';
    const logoUrl = t.branding?.logoUrl || t.logoUrl || '';
    storeTenantPwaInfo({ schoolName, logoUrl, subdomain });
    window.localStorage.setItem('tenantSubdomain', subdomain);
  }
  return data;
};
export const getAuditLog = () => req('/api/audit');
export const getAttendance = () => req('/api/attendance');
export const resetPassword = (payload) => req('/api/admin/reset-password', { method: 'POST', body: payload });
export const getApprovals = () => req('/api/approvals');
export const getPeople = () => req('/api/people');
export const getExams = () => req('/api/exams');
export const getOwnerSchools = () => req('/api/owner/schools');
export const addPerson = (data) => req('/api/people', { method: 'POST', body: data });
export const bulkImportPeople = (rows) => req('/api/people/bulk', { method: 'POST', body: { rows } });
export const deactivatePerson = (userId) => req(`/api/people/${userId}`, { method: 'DELETE' });
export const updatePersonRole = (userId, role) => req(`/api/people/${userId}/role`, { method: 'PUT', body: { role } });
export const getClasses = () => req('/api/school/classes');
export const addClass = (data) => req('/api/school/classes', { method: 'POST', body: data });
export const getSubjects = () => req('/api/school/subjects');
export const addSubject = (data) => req('/api/school/subjects', { method: 'POST', body: data });
export const bulkAddSubjectsBySection = (sectionName, subjects, teacherId) => req(`/api/school/sections/${encodeURIComponent(sectionName)}/subjects/bulk`, { method: 'POST', body: { subjects, teacherId } });
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
    credentials: 'include',
    headers: {
      ...(auth?.token ? { Authorization: `Bearer ${auth.token}` } : {}),
      ...buildSelectedRoleHeader(),
    },
    body: formData,
  });
  if (res.status === 401) { handleUnauthorized(); return {}; }
  applyRefreshedToken(res);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.message || 'Upload failed.');
  return data;
}

async function uploadFiles(path, files = [], extraFields = {}) {
  const auth = getStoredAuth();
  const formData = new FormData();
  files.forEach(file => formData.append('files', file));
  Object.entries(extraFields || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    formData.append(key, String(value));
  });

  const res = await fetch(getApiUrl(path), {
    method: 'POST',
    credentials: 'include',
    headers: {
      ...(auth?.token ? { Authorization: `Bearer ${auth.token}` } : {}),
      ...buildSelectedRoleHeader(),
    },
    body: formData,
  });
  if (res.status === 401) { handleUnauthorized(); return {}; }
  applyRefreshedToken(res);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.message || 'Upload failed.');
  return data;
}

function buildQuery(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    query.set(key, String(value));
  });
  const serialized = query.toString();
  return serialized ? `?${serialized}` : '';
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

// Fees
export const getFeesConfig = () => req('/api/school/fees-config');
export const saveFeesConfig = (data) => req('/api/school/fees-config', { method: 'POST', body: data });
export const getFeesLedger = () => req('/api/school/fees-ledger');
export const markFeePaid = (studentId, data) => req(`/api/school/fees/${studentId}/pay`, { method: 'POST', body: data });

// Expenditure
export const getExpenditure = () => req('/api/school/expenditure');
export const addExpenditure = (data) => req('/api/school/expenditure', { method: 'POST', body: data });

// Payroll
export const getPayroll = () => req('/api/school/payroll');
export const updatePayrollStaff = (staffId, data) => req(`/api/school/payroll/staff/${staffId}`, { method: 'PUT', body: data });
export const approvePayroll = () => req('/api/school/payroll/approve', { method: 'POST' });
export const submitPayroll = () => req('/api/school/payroll/submit', { method: 'POST' });
export const getPayrollHistory = () => req('/api/school/payroll/history');
export const getPayrollSettings = () => req('/api/school/payroll/settings');
export const savePayrollSettings = (data) => req('/api/school/payroll/settings', { method: 'POST', body: data });
export const getMyPayslip = () => req('/api/school/payroll/my-payslip');

// Attendance
export const getStaffAttendance = (date) => req(`/api/school/staff-attendance?date=${date}`);
export const markStaffAttendance = (data) => req('/api/school/staff-attendance', { method: 'POST', body: data });
export const getStudentAttendance = (dateOrFilters, classId) => {
  const params = new URLSearchParams();

  if (dateOrFilters && typeof dateOrFilters === 'object') {
    Object.entries(dateOrFilters).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      params.set(key, String(value));
    });
  } else {
    if (dateOrFilters) params.set('date', String(dateOrFilters));
    if (classId) params.set('classId', String(classId));
  }

  const query = params.toString();
  return req(`/api/school/student-attendance${query ? `?${query}` : ''}`);
};
export const markStudentAttendance = (data) => req('/api/school/student-attendance', { method: 'POST', body: data });
export const runAttendanceAI = () => req('/api/school/attendance/ai-analysis', { method: 'POST' });
export const runFinanceAI = () => req('/api/school/finance/ai-analysis', { method: 'POST' });

// Results
export const getResultTemplates = () => req('/api/results/templates');
export const getResultSettings = () => req('/api/results/settings');
export const saveResultSettings = (data) => req('/api/results/settings', { method: 'POST', body: data });
export const getResultSheet = (params = {}) => req(`/api/results/sheet${buildQuery(params)}`);
export const saveResultEntries = (data) => req('/api/results/entries', { method: 'POST', body: data });
export const saveResultProfiles = (data) => req('/api/results/profiles', { method: 'POST', body: data });
export const updateResultBatchStatus = (data) => req('/api/results/batch-status', { method: 'POST', body: data });
export const publishResultBatch = (data) => req('/api/results/publish', { method: 'POST', body: data });
export const getResultOverview = () => req('/api/results/overview');
export const getResultRecords = (studentId = '') => req(`/api/results/records${buildQuery(studentId ? { studentId } : {})}`);
export const uploadResultDocuments = (files, extraFields = {}) => uploadFiles('/api/results/documents/upload', files, extraFields);
export const getLearningStudents = () => req('/api/learning/students');
export const getLessonPlans = (params = {}) => req(`/api/lesson-plans${buildQuery(params)}`);
export const saveLessonPlan = (data) => req('/api/lesson-plans', { method: 'POST', body: data });
export const reviewLessonPlan = (lessonPlanId, data) => req(`/api/lesson-plans/${lessonPlanId}/review`, { method: 'POST', body: data });
export const getPracticeQuestions = (params = {}) => req(`/api/practice/questions${buildQuery(params)}`);
export const getFeatureFlags = () => req('/api/feature-flags');

