import { getApiUrl } from '../../config/apiBase';
import { buildSelectedRoleHeader } from '../auth/services/authApi';

// Ndovera AI — Prepare Material, the Curriculum & Exam Library, and Exam Readiness
// (Worker: materialGenerator.ts, curriculumLibrary.ts).

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

const query = params => {
  const search = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''));
  const text = search.toString();
  return text ? `?${text}` : '';
};
const id = value => encodeURIComponent(value);

// Teacher: the generator.
export const getMaterialAiOptions = (classId, subjectId) => request(`/api/material-ai/options${query({ classId, subjectId })}`);
export const resolveCurriculum = body => request('/api/material-ai/resolve', { method: 'POST', body });
export const listMaterialDrafts = classId => request(`/api/material-ai/drafts${query({ classId })}`);
export const createMaterialDraft = body => request('/api/material-ai/drafts', { method: 'POST', body });
export const getMaterialDraft = draftId => request(`/api/material-ai/drafts/${id(draftId)}`);
export const discardMaterialDraft = draftId => request(`/api/material-ai/drafts/${id(draftId)}`, { method: 'DELETE' });
export const generateNextSection = draftId => request(`/api/material-ai/drafts/${id(draftId)}/next`, { method: 'POST' });
export const regenerateSection = (draftId, key, instruction) => request(`/api/material-ai/drafts/${id(draftId)}/sections/${id(key)}/regenerate`, { method: 'POST', body: { instruction } });
export const saveDraftBlocks = (draftId, blocks, title) => request(`/api/material-ai/drafts/${id(draftId)}/blocks`, { method: 'PUT', body: { blocks, title } });
export const redrawImage = (draftId, index) => request(`/api/material-ai/drafts/${id(draftId)}/images/${index}`, { method: 'POST' });
export const reviewDraft = draftId => request(`/api/material-ai/drafts/${id(draftId)}/review`, { method: 'POST' });
export const publishDraft = (draftId, body) => request(`/api/material-ai/drafts/${id(draftId)}/publish`, { method: 'POST', body });

// Library: Ami ('ami') or a school's Owner/HoS ('school').
const base = scope => (scope === 'ami' ? '/api/ami/curricula' : '/api/school/curricula');
export const listCurricula = scope => request(base(scope));
export const createCurriculum = (scope, body) => request(base(scope), { method: 'POST', body });
export const updateCurriculum = (scope, curriculumId, body) => request(`${base(scope)}/${id(curriculumId)}`, { method: 'PUT', body });
export const setCurriculumStatus = (scope, curriculumId, status) => request(`${base(scope)}/${id(curriculumId)}/status`, { method: 'POST', body: { status } });
export const deleteCurriculum = (scope, curriculumId) => request(`${base(scope)}/${id(curriculumId)}`, { method: 'DELETE' });
export const listCurriculumTopics = (scope, curriculumId, filters = {}) => request(`${base(scope)}/${id(curriculumId)}/topics${query(filters)}`);
export const addCurriculumTopics = (scope, curriculumId, body) => request(`${base(scope)}/${id(curriculumId)}/topics`, { method: 'POST', body });
export const importCurriculumText = (scope, curriculumId, body) => request(`${base(scope)}/${id(curriculumId)}/import-text`, { method: 'POST', body });
export const updateCurriculumTopic = (scope, curriculumId, topicId, body) => request(`${base(scope)}/${id(curriculumId)}/topics/${id(topicId)}`, { method: 'PUT', body });
export const deleteCurriculumTopic = (scope, curriculumId, topicId) => request(`${base(scope)}/${id(curriculumId)}/topics/${id(topicId)}`, { method: 'DELETE' });

export const listExamSpecs = () => request('/api/ami/exam-specs');
export const createExamSpec = body => request('/api/ami/exam-specs', { method: 'POST', body });
export const updateExamSpec = (specId, body) => request(`/api/ami/exam-specs/${id(specId)}`, { method: 'PUT', body });
export const setExamSpecStatus = (specId, status) => request(`/api/ami/exam-specs/${id(specId)}/status`, { method: 'POST', body: { status } });
export const deleteExamSpec = specId => request(`/api/ami/exam-specs/${id(specId)}`, { method: 'DELETE' });
export const getExamSpecTopics = specId => request(`/api/ami/exam-specs/${id(specId)}/topics`);
export const addExamSpecTopics = (specId, body) => request(`/api/ami/exam-specs/${id(specId)}/topics`, { method: 'POST', body });
export const importExamSpecText = (specId, body) => request(`/api/ami/exam-specs/${id(specId)}/import-text`, { method: 'POST', body });
export const updateExamSpecTopic = (specId, topicId, body) => request(`/api/ami/exam-specs/${id(specId)}/topics/${id(topicId)}`, { method: 'PUT', body });
export const deleteExamSpecTopic = (specId, topicId) => request(`/api/ami/exam-specs/${id(specId)}/topics/${id(topicId)}`, { method: 'DELETE' });
export const autoMapExamSpec = specId => request(`/api/ami/exam-specs/${id(specId)}/automap`, { method: 'POST' });
export const setExamMapping = body => request('/api/ami/exam-map', { method: 'POST', body });
export const getPlatformMaterialAi = () => request('/api/ami/material-ai/settings');
export const savePlatformMaterialAi = body => request('/api/ami/material-ai/settings', { method: 'PUT', body });
export const getSchoolMaterialAi = () => request('/api/school/material-ai/settings');
export const saveSchoolMaterialAi = body => request('/api/school/material-ai/settings', { method: 'PUT', body });

// Students and parents.
export const getExamReadiness = params => request(`/api/exam-readiness${query(params)}`);
