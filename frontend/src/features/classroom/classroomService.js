import { getApiUrl } from '../../config/apiBase';

function apiFetch(path, options) {
  return fetch(getApiUrl(path), options);
}

function getAuthHeaders() {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
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

export async function createClass(payload) {
  const res = await apiFetch('/api/classrooms', { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(payload) });
  return res.json();
}

export async function getClass(id) {
  const res = await apiFetch(`/api/classrooms/${id}`, { headers: getAuthHeaders() });
  return res.json();
}

export async function getAssignedClasses() {
  const res = await apiFetch('/api/classrooms/assigned', { headers: getAuthHeaders() });
  return res.json();
}

export async function getPosts(classId) {
  const res = await apiFetch(`/api/classrooms/${classId}/stream`, { headers: getAuthHeaders() });
  return res.json();
}

export async function createPost(classId, payload) {
  const res = await apiFetch(`/api/classrooms/${classId}/stream`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(payload) });
  return res.json();
}

export async function addPostComment(classId, postId, payload) {
  const res = await apiFetch(`/api/classrooms/${classId}/posts/${postId}/comments`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(payload) });
  return res.json();
}

export async function getAssignments(classId) {
  const res = await apiFetch(`/api/classrooms/${classId}/assignments`, { headers: getAuthHeaders() });
  return res.json();
}

export async function createAssignment(classId, payload) {
  const res = await apiFetch(`/api/classrooms/${classId}/assignments`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(payload) });
  return res.json();
}

export async function uploadAssignmentAsset(classId, payload) {
  const token = localStorage.getItem('token');
  const formData = new FormData();
  formData.append('file', payload.file);
  if (payload.title) formData.append('title', payload.title);
  const res = await apiFetch(`/api/classrooms/${classId}/assignment-assets/upload`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  return res.json();
}

export async function submitAssignment(assignmentId, payload) {
  const res = await apiFetch(`/api/assignments/${assignmentId}/submit`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(payload) });
  return res.json();
}

export async function getMySubmission(assignmentId) {
  const res = await apiFetch(`/api/assignments/${assignmentId}/my-submission`, { headers: getAuthHeaders() });
  return res.json();
}

export async function getSubmissions(assignmentId) {
  const res = await apiFetch(`/api/assignments/${assignmentId}/submissions`, { headers: getAuthHeaders() });
  return res.json();
}

export async function gradeSubmission(submissionId, payload) {
  const res = await apiFetch(`/api/submissions/${submissionId}/grade`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(payload) });
  return res.json();
}

export async function recordAttendance(classId, payload) {
  const res = await apiFetch(`/api/classrooms/${classId}/attendance`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(payload) });
  return res.json();
}

export async function getAttendance(classId, since) {
  const q = since ? `?since=${encodeURIComponent(since)}` : '';
  const res = await apiFetch(`/api/classrooms/${classId}/attendance${q}`, { headers: getAuthHeaders() });
  return res.json();
}

export async function getClassStudents(classId) {
  const res = await apiFetch(`/api/classrooms/${classId}/students`, { headers: getAuthHeaders() });
  return res.json();
}

export async function getClassMembers(classId) {
  const res = await apiFetch(`/api/classrooms/${classId}/members`, { headers: getAuthHeaders() });
  return res.json();
}

export async function getClassSubjects(classId) {
  const res = await apiFetch(`/api/classrooms/${classId}/subjects`, { headers: getAuthHeaders() });
  return res.json();
}

export async function addMaterial(classId, payload) {
  const res = await apiFetch(`/api/classrooms/${classId}/materials`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(payload) });
  return res.json();
}

export async function getMaterials(classId, params = {}) {
  const res = await apiFetch(`/api/classrooms/${classId}/materials${buildQuery(params)}`, { headers: getAuthHeaders() });
  return res.json();
}

export async function getLearningStudents() {
  const res = await apiFetch('/api/learning/students', { headers: getAuthHeaders() });
  return res.json();
}

export async function uploadMaterial(classId, payload) {
  // prefer multipart if `file` is provided (FormData)
  const token = localStorage.getItem('token');
  if (payload.file) {
    const fd = new FormData();
    fd.append('file', payload.file);
    ['title', 'subjectId', 'description', 'type', 'topic', 'weekLabel', 'week', 'visibility', 'releaseAt'].forEach(key => {
      if (payload[key]) fd.append(key, payload[key]);
    });
    const res = await apiFetch(`/api/classrooms/${classId}/materials/upload-multipart`, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: fd });
    return res.json();
  }
  // fallback to base64 path
  const res = await apiFetch(`/api/classrooms/${classId}/materials/upload`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(payload) });
  return res.json();
}

export async function getLiveSessions(classId) {
  const res = await apiFetch(`/api/classrooms/${classId}/live`, { headers: getAuthHeaders() });
  return res.json();
}

export async function startLiveSession(classId, payload) {
  const res = await apiFetch(`/api/classrooms/${classId}/live`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(payload) });
  return res.json();
}

export async function endLiveSession(classId, sessionId) {
  const res = await apiFetch(`/api/classrooms/${classId}/live/${sessionId}/end`, { method: 'POST', headers: getAuthHeaders() });
  return res.json();
}

export async function saveContent(classId, payload) {
  const res = await apiFetch('/api/save-content', { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ classId, ...payload }) });
  return res.json();
}

export async function getSubjectMembers(classId, subjectId) {
  const res = await apiFetch(`/api/classrooms/${classId}/subjects/${subjectId}/members`, { headers: getAuthHeaders() });
  return res.json();
}

export async function removeStudentFromSubject(classId, subjectId, studentId) {
  const res = await apiFetch(`/api/classrooms/${classId}/subjects/${subjectId}/remove-student`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ studentId }) });
  return res.json();
}

export async function restoreStudentToSubject(classId, subjectId, studentId) {
  const res = await apiFetch(`/api/classrooms/${classId}/subjects/${subjectId}/remove-student/${studentId}`, { method: 'DELETE', headers: getAuthHeaders() });
  return res.json();
}
