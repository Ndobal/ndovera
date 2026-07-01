import { getApiUrl } from '../../config/apiBase';
import { buildSelectedRoleHeader } from '../auth/services/authApi';

function apiFetch(path, options) {
  return fetch(getApiUrl(path), options);
}

function getAuthHeaders() {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...buildSelectedRoleHeader(),
  };
}

async function readJsonResponse(res) {
  const text = await res.text();
  const trimmed = String(text || '').trim();

  if (!trimmed) return {};

  try {
    return JSON.parse(trimmed);
  } catch {
    const looksLikeHtml = /^<!doctype html/i.test(trimmed) || /^<html/i.test(trimmed);
    if (looksLikeHtml) {
      return {
        success: false,
        message: 'The classroom service returned the website shell instead of data. Please refresh and try again.',
      };
    }

    return {
      success: false,
      message: res.ok ? 'Unexpected server response.' : trimmed,
    };
  }
}

async function requestJson(path, options) {
  const res = await apiFetch(path, options);
  return readJsonResponse(res);
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
  return requestJson('/api/classrooms', { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(payload) });
}

export async function getClass(id) {
  return requestJson(`/api/classrooms/${id}`, { headers: getAuthHeaders() });
}

export async function getAssignedClasses() {
  return requestJson('/api/classrooms/assigned', { headers: getAuthHeaders() });
}

export async function getPosts(classId) {
  return requestJson(`/api/classrooms/${classId}/stream`, { headers: getAuthHeaders() });
}

export async function createPost(classId, payload) {
  const res = await apiFetch(`/api/classrooms/${classId}/stream`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(payload) });
  return readJsonResponse(res);
}

export async function updatePost(classId, postId, payload) {
  const res = await apiFetch(`/api/classrooms/${classId}/stream/${postId}`, { method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify(payload) });
  return readJsonResponse(res);
}

export async function deletePost(classId, postId) {
  const res = await apiFetch(`/api/classrooms/${classId}/stream/${postId}`, { method: 'DELETE', headers: getAuthHeaders() });
  return readJsonResponse(res);
}

export async function addPostComment(classId, postId, payload) {
  const res = await apiFetch(`/api/classrooms/${classId}/posts/${postId}/comments`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(payload) });
  return readJsonResponse(res);
}

export async function getAssignments(classId) {
  return requestJson(`/api/classrooms/${classId}/assignments`, { headers: getAuthHeaders() });
}

export async function createAssignment(classId, payload) {
  const res = await apiFetch(`/api/classrooms/${classId}/assignments`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(payload) });
  return readJsonResponse(res);
}

export async function updateAssignment(classId, assignmentId, payload) {
  const res = await apiFetch(`/api/classrooms/${classId}/assignments/${assignmentId}`, { method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify(payload) });
  return readJsonResponse(res);
}

export async function deleteAssignment(classId, assignmentId) {
  const res = await apiFetch(`/api/classrooms/${classId}/assignments/${assignmentId}`, { method: 'DELETE', headers: getAuthHeaders() });
  return readJsonResponse(res);
}

export async function getTopics(classId, subjectId = '') {
  const query = subjectId ? `?subjectId=${encodeURIComponent(subjectId)}` : '';
  return requestJson(`/api/classrooms/${classId}/topics${query}`, { headers: getAuthHeaders() });
}

export async function addTopic(classId, payload) {
  const res = await apiFetch(`/api/classrooms/${classId}/topics`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(payload) });
  return readJsonResponse(res);
}

export async function deleteTopic(classId, topicId) {
  const res = await apiFetch(`/api/classrooms/${classId}/topics/${encodeURIComponent(topicId)}`, { method: 'DELETE', headers: getAuthHeaders() });
  return readJsonResponse(res);
}

export async function reorderTopics(classId, orderedIds) {
  const res = await apiFetch(`/api/classrooms/${classId}/topics/reorder`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ orderedIds }) });
  return readJsonResponse(res);
}

export async function uploadAssignmentAsset(classId, payload) {
  const token = localStorage.getItem('token');
  const formData = new FormData();
  formData.append('file', payload.file);
  if (payload.title) formData.append('title', payload.title);
  const res = await apiFetch(`/api/classrooms/${classId}/assignment-assets/upload`, {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...buildSelectedRoleHeader(),
    },
    body: formData,
  });
  return readJsonResponse(res);
}

export async function submitAssignment(assignmentId, payload) {
  const res = await apiFetch(`/api/assignments/${assignmentId}/submit`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(payload) });
  return readJsonResponse(res);
}

export async function getMySubmission(assignmentId) {
  const res = await apiFetch(`/api/assignments/${assignmentId}/my-submission`, { headers: getAuthHeaders() });
  return readJsonResponse(res);
}

export async function getSubmissions(assignmentId) {
  const res = await apiFetch(`/api/assignments/${assignmentId}/submissions`, { headers: getAuthHeaders() });
  return readJsonResponse(res);
}

export async function gradeSubmission(submissionId, payload) {
  const res = await apiFetch(`/api/submissions/${submissionId}/grade`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(payload) });
  return readJsonResponse(res);
}

export async function recordAttendance(classId, payload) {
  const res = await apiFetch(`/api/classrooms/${classId}/attendance`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(payload) });
  return readJsonResponse(res);
}

export async function getAttendance(classId, since) {
  const q = since ? `?since=${encodeURIComponent(since)}` : '';
  return requestJson(`/api/classrooms/${classId}/attendance${q}`, { headers: getAuthHeaders() });
}

export async function getClassStudents(classId) {
  return requestJson(`/api/classrooms/${classId}/students`, { headers: getAuthHeaders() });
}

export async function getClassMembers(classId) {
  return requestJson(`/api/classrooms/${classId}/members`, { headers: getAuthHeaders() });
}

export async function addClassMember(classId, payload) {
  const res = await apiFetch(`/api/classrooms/${classId}/members`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(payload) });
  return readJsonResponse(res);
}

export async function removeClassMember(classId, memberRole, userId) {
  const res = await apiFetch(`/api/classrooms/${classId}/members/${encodeURIComponent(memberRole)}/${encodeURIComponent(userId)}`, { method: 'DELETE', headers: getAuthHeaders() });
  return readJsonResponse(res);
}

export async function getClassSubjects(classId) {
  return requestJson(`/api/classrooms/${classId}/subjects`, { headers: getAuthHeaders() });
}

export async function addMaterial(classId, payload) {
  const res = await apiFetch(`/api/classrooms/${classId}/materials`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(payload) });
  return readJsonResponse(res);
}

export async function updateMaterial(classId, materialId, payload) {
  const res = await apiFetch(`/api/classrooms/${classId}/materials/${materialId}`, { method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify(payload) });
  return readJsonResponse(res);
}

export async function deleteMaterial(classId, materialId) {
  const res = await apiFetch(`/api/classrooms/${classId}/materials/${materialId}`, { method: 'DELETE', headers: getAuthHeaders() });
  return readJsonResponse(res);
}

export async function getMaterials(classId, params = {}) {
  return requestJson(`/api/classrooms/${classId}/materials${buildQuery(params)}`, { headers: getAuthHeaders() });
}

export async function getLearningStudents() {
  return requestJson('/api/learning/students', { headers: getAuthHeaders() });
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
    const res = await apiFetch(`/api/classrooms/${classId}/materials/upload-multipart`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...buildSelectedRoleHeader(),
      },
      body: fd,
    });
    return readJsonResponse(res);
  }
  // fallback to base64 path
  return requestJson(`/api/classrooms/${classId}/materials/upload`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(payload) });
}

export async function getLiveSessions(classId) {
  return requestJson(`/api/classrooms/${classId}/live`, { headers: getAuthHeaders() });
}

export async function startLiveSession(classId, payload) {
  const res = await apiFetch(`/api/classrooms/${classId}/live`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(payload) });
  return readJsonResponse(res);
}

export async function endLiveSession(classId, sessionId) {
  const res = await apiFetch(`/api/classrooms/${classId}/live/${sessionId}/end`, { method: 'POST', headers: getAuthHeaders() });
  return readJsonResponse(res);
}

export async function saveContent(classId, payload) {
  const res = await apiFetch('/api/save-content', { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ classId, ...payload }) });
  return readJsonResponse(res);
}

export async function getSubjectMembers(classId, subjectId) {
  const res = await apiFetch(`/api/classrooms/${classId}/subjects/${subjectId}/members`, { headers: getAuthHeaders() });
  return readJsonResponse(res);
}

export async function removeStudentFromSubject(classId, subjectId, studentId) {
  const res = await apiFetch(`/api/classrooms/${classId}/subjects/${subjectId}/remove-student`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ studentId }) });
  return readJsonResponse(res);
}

export async function restoreStudentToSubject(classId, subjectId, studentId) {
  const res = await apiFetch(`/api/classrooms/${classId}/subjects/${subjectId}/remove-student/${studentId}`, { method: 'DELETE', headers: getAuthHeaders() });
  return readJsonResponse(res);
}
