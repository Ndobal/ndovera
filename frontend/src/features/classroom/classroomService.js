const API = '/api';

function getAuthHeaders() {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

export async function createClass(payload) {
  const res = await fetch(`${API}/classrooms`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(payload) });
  return res.json();
}

export async function getClass(id) {
  const res = await fetch(`${API}/classrooms/${id}`, { headers: getAuthHeaders() });
  return res.json();
}

export async function getAssignedClasses() {
  const res = await fetch(`${API}/classrooms/assigned`, { headers: getAuthHeaders() });
  return res.json();
}

export async function getPosts(classId) {
  const res = await fetch(`${API}/classrooms/${classId}/stream`, { headers: getAuthHeaders() });
  return res.json();
}

export async function createPost(classId, payload) {
  const res = await fetch(`${API}/classrooms/${classId}/stream`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(payload) });
  return res.json();
}

export async function addPostComment(classId, postId, payload) {
  const res = await fetch(`${API}/classrooms/${classId}/posts/${postId}/comments`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(payload) });
  return res.json();
}

export async function getAssignments(classId) {
  const res = await fetch(`${API}/classrooms/${classId}/assignments`, { headers: getAuthHeaders() });
  return res.json();
}

export async function createAssignment(classId, payload) {
  const res = await fetch(`${API}/classrooms/${classId}/assignments`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(payload) });
  return res.json();
}

export async function uploadAssignmentAsset(classId, payload) {
  const token = localStorage.getItem('token');
  const formData = new FormData();
  formData.append('file', payload.file);
  if (payload.title) formData.append('title', payload.title);
  const res = await fetch(`${API}/classrooms/${classId}/assignment-assets/upload`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  return res.json();
}

export async function submitAssignment(assignmentId, payload) {
  const res = await fetch(`${API}/assignments/${assignmentId}/submit`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(payload) });
  return res.json();
}

export async function getSubmissions(assignmentId) {
  const res = await fetch(`${API}/assignments/${assignmentId}/submissions`, { headers: getAuthHeaders() });
  return res.json();
}

export async function gradeSubmission(submissionId, payload) {
  const res = await fetch(`${API}/submissions/${submissionId}/grade`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(payload) });
  return res.json();
}

export async function recordAttendance(classId, payload) {
  const res = await fetch(`${API}/classrooms/${classId}/attendance`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(payload) });
  return res.json();
}

export async function getAttendance(classId, since) {
  const q = since ? `?since=${encodeURIComponent(since)}` : '';
  const res = await fetch(`${API}/classrooms/${classId}/attendance${q}`, { headers: getAuthHeaders() });
  return res.json();
}

export async function getClassStudents(classId) {
  const res = await fetch(`${API}/classrooms/${classId}/students`, { headers: getAuthHeaders() });
  return res.json();
}

export async function getClassMembers(classId) {
  const res = await fetch(`${API}/classrooms/${classId}/members`, { headers: getAuthHeaders() });
  return res.json();
}

export async function getClassSubjects(classId) {
  const res = await fetch(`${API}/classrooms/${classId}/subjects`, { headers: getAuthHeaders() });
  return res.json();
}

export async function addMaterial(classId, payload) {
  const res = await fetch(`${API}/classrooms/${classId}/materials`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(payload) });
  return res.json();
}

export async function getMaterials(classId) {
  const res = await fetch(`${API}/classrooms/${classId}/materials`, { headers: getAuthHeaders() });
  return res.json();
}

export async function uploadMaterial(classId, payload) {
  // prefer multipart if `file` is provided (FormData)
  const token = localStorage.getItem('token');
  if (payload.file) {
    const fd = new FormData();
    fd.append('file', payload.file);
    if (payload.title) fd.append('title', payload.title);
    if (payload.subjectId) fd.append('subjectId', payload.subjectId);
    if (payload.description) fd.append('description', payload.description);
    if (payload.type) fd.append('type', payload.type);
    const res = await fetch(`${API}/classrooms/${classId}/materials/upload-multipart`, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: fd });
    return res.json();
  }
  // fallback to base64 path
  const res = await fetch(`${API}/classrooms/${classId}/materials/upload`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(payload) });
  return res.json();
}

export async function getLiveSessions(classId) {
  const res = await fetch(`${API}/classrooms/${classId}/live`, { headers: getAuthHeaders() });
  return res.json();
}

export async function startLiveSession(classId, payload) {
  const res = await fetch(`${API}/classrooms/${classId}/live`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(payload) });
  return res.json();
}

export async function endLiveSession(classId, sessionId) {
  const res = await fetch(`${API}/classrooms/${classId}/live/${sessionId}/end`, { method: 'POST', headers: getAuthHeaders() });
  return res.json();
}

export async function saveContent(classId, payload) {
  const res = await fetch(`${API}/save-content`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ classId, ...payload }) });
  return res.json();
}
