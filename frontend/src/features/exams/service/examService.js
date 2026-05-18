import { getApiUrl } from '../../../config/apiBase';
import { clearStoredAuth, getSignedOutRedirectPath, getStoredAuth, syncRefreshedToken, buildSelectedRoleHeader } from '../../auth/services/authApi';

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

function buildQuery(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    query.set(key, String(value));
  });
  const serialized = query.toString();
  return serialized ? `?${serialized}` : '';
}

async function req(path, options = {}) {
  const response = await fetch(getApiUrl(path), {
    method: options.method || 'GET',
    credentials: 'include',
    headers: buildHeaders(),
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (response.status === 401) {
    handleUnauthorized();
    return {};
  }

  syncRefreshedToken(response);

  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch (error) {
    throw new Error(`Invalid JSON response: ${error.message} - response: ${text}`);
  }

  if (!response.ok) {
    throw new Error(data.error || data.message || `Request failed with ${response.status}`);
  }

  return data;
}

export async function fetchExamList(params = {}) {
  const data = await req(`/api/exams${buildQuery(params)}`);
  return data.exams || [];
}

export async function startExam(examId, userId) {
  return req(`/api/exams/${examId}/start`, {
    method: 'POST',
    body: { userId },
  });
}

export async function fetchExamById(examId) {
  const data = await req(`/api/exams/${examId}`);
  return data.exam;
}

export async function submitExam(examId, userId, answers) {
  return req(`/api/exams/${examId}/submit`, {
    method: 'POST',
    body: { userId, answers },
  });
}

export async function createExam(examData) {
  return req('/api/exams', {
    method: 'POST',
    body: examData,
  });
}

export async function updateExam(examId, examData) {
  return req(`/api/exams/${examId}`, {
    method: 'PUT',
    body: examData,
  });
}

export async function deleteExam(examId) {
  return req(`/api/exams/${examId}`, {
    method: 'DELETE',
  });
}

const examService = { fetchExamList, startExam, submitExam };
export default examService;