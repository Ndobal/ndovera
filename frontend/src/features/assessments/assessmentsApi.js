import { getApiUrl } from '../../config/apiBase';
import { buildSelectedRoleHeader } from '../auth/services/authApi';

// Ndovera AI assessments (Worker: assessmentEngine.ts, aiAssessments.ts).

async function request(path, { method = 'GET', body } = {}) {
  const token = localStorage.getItem('token');
  const response = await fetch(getApiUrl(path), {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...buildSelectedRoleHeader() },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) {
    const error = new Error(data.message || data.error || 'Request failed.');
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

const q = params => {
  const entries = Object.entries(params || {}).filter(([, value]) => value !== undefined && value !== null && value !== '');
  return entries.length ? `?${new URLSearchParams(entries).toString()}` : '';
};
const id = value => encodeURIComponent(value);

export const getAssessmentOptions = (classId, subjectId) => request(`/api/ai-assessments/options${q({ classId, subjectId })}`);
export const listMyAssessments = params => request(`/api/ai-assessments${q(params)}`);
export const createAiAssessment = payload => request('/api/ai-assessments', { method: 'POST', body: payload });
export const getAiAssessment = assessmentId => request(`/api/ai-assessments/${id(assessmentId)}`);
export const approveAssessmentBlueprint = (assessmentId, blueprint) => request(`/api/ai-assessments/${id(assessmentId)}/blueprint`, { method: 'PUT', body: { blueprint } });
export const generateNextQuestions = assessmentId => request(`/api/ai-assessments/${id(assessmentId)}/generate-next`, { method: 'POST', body: {} });
export const regenerateAssessmentQuestion = (assessmentId, payload) => request(`/api/ai-assessments/${id(assessmentId)}/regenerate`, { method: 'POST', body: payload });
export const saveAssessmentEdits = (assessmentId, payload) => request(`/api/ai-assessments/${id(assessmentId)}`, { method: 'PUT', body: payload });
export const reviewAssessment = assessmentId => request(`/api/ai-assessments/${id(assessmentId)}/review`, { method: 'POST', body: {} });
export const listAssessmentVersions = assessmentId => request(`/api/ai-assessments/${id(assessmentId)}/versions`);
export const getAssessmentVersion = (assessmentId, version) => request(`/api/ai-assessments/${id(assessmentId)}/versions${q({ version })}`);
export const postAssessment = (assessmentId, payload) => request(`/api/ai-assessments/${id(assessmentId)}/post`, { method: 'POST', body: payload });
export const releaseAssessmentAnswers = assessmentId => request(`/api/ai-assessments/${id(assessmentId)}/release-answers`, { method: 'POST', body: {} });
export const submitExamPaper = assessmentId => request(`/api/ai-assessments/${id(assessmentId)}/submit-exam`, { method: 'POST', body: {} });
export const getExamLetterhead = () => request('/api/school/exam-letterhead');
export const saveExamLetterhead = payload => request('/api/school/exam-letterhead', { method: 'PUT', body: payload });

export const KIND_LABELS = { quiz: 'Quiz', assignment: 'Assignment', test: 'Test', exam: 'Examination' };
export const TYPE_LABELS = {
  mcq: 'Multiple choice', truefalse: 'True / False', fill: 'Fill in the gap', short: 'Short answer',
  structured: 'Structured', essay: 'Essay', calculation: 'Calculation', practical: 'Practical',
};
export const BLOOM = ['remember', 'understand', 'apply', 'analyse', 'evaluate', 'create'];
export const BLOOM_LABELS = { remember: 'Remember', understand: 'Understand', apply: 'Apply', analyse: 'Analyse', evaluate: 'Evaluate', create: 'Create' };
export const STATUS_LABELS = { draft: 'Draft', finalised: 'Approved', submitted: 'Submitted for approval', posted: 'Posted', scheduled: 'Scheduled' };
export const letter = index => 'ABCDEFGH'[index] || '?';

/** Printed unique papers: mode 'versions' (count 2–8) or 'students'. Teachers only; each paper carries its key. */
export const getUniquePapers = (assessmentId, mode, count) => request(`/api/ai-assessments/${id(assessmentId)}/papers${q({ mode, count })}`);

/** Secondary classes (JSS/SS, Year 7–13, Grade 7–12…) — their exams give each student a unique paper by default. Mirrors paperVariants.ts. */
export const isSecondaryClass = name => /\b(j\.?s\.?s?|s\.?s\.?s?)[\s-]*[1-3]|\bbasic\s*[7-9]\b|\bgrade\s*([7-9]|1[0-2])\b|\byear\s*([7-9]|1[0-3])\b|\bform\s*[1-6]\b|\bsecondary\b|\bsenior\b|\bigcse\b|\ba[- ]?level\b/i.test(String(name || ''));

// ─── Teacher's own papers and exam sittings (paperImport.ts, examSittings.ts) ──

/** A typed or pasted paper: { classId, subjectId, title, text }. */
export const importPaperText = payload => request('/api/ai-assessments/import', { method: 'POST', body: payload });

/** A PDF (read on the server) — Word files are read in the browser and sent as text. */
export async function importPaperFile(fields, file) {
  const token = localStorage.getItem('token');
  const form = new FormData();
  Object.entries(fields).forEach(([key, value]) => form.append(key, value ?? ''));
  form.append('file', file);
  const response = await fetch(getApiUrl('/api/ai-assessments/import'), { method: 'POST', credentials: 'include', headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...buildSelectedRoleHeader() }, body: form });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) throw Object.assign(new Error(data.message || 'Could not read the paper.'), { status: response.status, data });
  return data;
}

export const draftMarkingSchemes = assessmentId => request(`/api/ai-assessments/${id(assessmentId)}/draft-schemes`, { method: 'POST', body: {} });
export const listExamSittings = () => request('/api/exam-sittings');
export const rescheduleExamSitting = (sittingId, payload) => request(`/api/exam-sittings/${id(sittingId)}/schedule`, { method: 'PUT', body: payload });
export const getExamMarking = sittingId => request(`/api/exam-sittings/${id(sittingId)}/marking`);
export const saveExamMarks = (sittingId, rows) => request(`/api/exam-sittings/${id(sittingId)}/marks`, { method: 'PUT', body: { rows } });
export const postExamScores = (sittingId, confirmMissingTheory = false) => request(`/api/exam-sittings/${id(sittingId)}/post${confirmMissingTheory ? '?confirm=missing-theory' : ''}`, { method: 'POST', body: {} });
export const listStudentExams = () => request('/api/exam-sittings/student');
export const openStudentExamPaper = sittingId => request(`/api/exam-sittings/${id(sittingId)}/paper`);

export const SITTING_MODES = [
  ['cbt_objective', 'CBT objectives + printed theory', 'Objectives are written on the computer and mark themselves; the theory section is printed and written on paper.'],
  ['cbt', 'CBT — the whole paper', 'Everything is written on the computer. Objectives mark themselves; the teacher marks the typed theory answers.'],
  ['print', 'Printed paper', 'The whole paper is printed. The teacher enters the objective and theory marks.'],
];
export const PHASE_LABELS = { scheduled: 'Scheduled', open: 'Open now', marking: 'Ready for marking', posted: 'Scores posted' };

/** Head of School / Owner: submitted and approved exam papers to download. status: approved | submitted | all. */
export const getExamPapers = params => request(`/api/exam-papers${q(params)}`);
