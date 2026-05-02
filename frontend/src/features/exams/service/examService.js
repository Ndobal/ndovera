// examService.js
// Provides client-side functions to interact with the exam backend endpoints.

export async function fetchExamList() {
  const resp = await fetch('/api/exams');
  const text = await resp.text();
  if (!resp.ok) {
    throw new Error(`Failed to fetch exams: ${resp.status} ${resp.statusText} - ${text}`);
  }
  try {
    const data = JSON.parse(text);
    return data.exams || [];
  } catch (err) {
    throw new Error(`Invalid JSON response fetching exams: ${err.message} - response: ${text}`);
  }
}

export async function startExam(examId, userId) {
  const resp = await fetch(`/api/exams/${examId}/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  const text = await resp.text();
  if (!resp.ok) {
    throw new Error(`Failed to start exam: ${resp.status} ${resp.statusText} - ${text}`);
  }
  try { return JSON.parse(text); } catch (err) {
    throw new Error(`Invalid JSON response starting exam: ${err.message} - response: ${text}`);
  }
}

export async function fetchExamById(examId) {
  const resp = await fetch(`/api/exams/${examId}`);
  const text = await resp.text();
  if (!resp.ok) {
    throw new Error(`Failed to fetch exam: ${resp.status} ${resp.statusText} - ${text}`);
  }
  try {
    const data = JSON.parse(text);
    return data.exam;
  } catch (err) {
    throw new Error(`Invalid JSON response fetching exam: ${err.message} - response: ${text}`);
  }
}

export async function submitExam(examId, userId, answers) {
  const resp = await fetch(`/api/exams/${examId}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, answers }),
  });
  const text = await resp.text();
  if (!resp.ok) {
    throw new Error(`Failed to submit exam: ${resp.status} ${resp.statusText} - ${text}`);
  }
  try { return JSON.parse(text); } catch (err) {
    throw new Error(`Invalid JSON response submitting exam: ${err.message} - response: ${text}`);
  }
}

export async function createExam(examData) {
  const resp = await fetch('/api/exams', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(examData),
  });
  const text = await resp.text();
  if (!resp.ok) {
    throw new Error(`Failed to create exam: ${resp.status} ${resp.statusText} - ${text}`);
  }
  try { return JSON.parse(text); } catch (err) {
    throw new Error(`Invalid JSON response creating exam: ${err.message} - response: ${text}`);
  }
}

export async function updateExam(examId, examData) {
  const resp = await fetch(`/api/exams/${examId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(examData),
  });
  const text = await resp.text();
  if (!resp.ok) {
    throw new Error(`Failed to update exam: ${resp.status} ${resp.statusText} - ${text}`);
  }
  try { return JSON.parse(text); } catch (err) { throw new Error(`Invalid JSON response updating exam: ${err.message} - response: ${text}`); }
}

export async function deleteExam(examId) {
  const resp = await fetch(`/api/exams/${examId}`, { method: 'DELETE' });
  const text = await resp.text();
  if (!resp.ok) {
    throw new Error(`Failed to delete exam: ${resp.status} ${resp.statusText} - ${text}`);
  }
  try { return JSON.parse(text); } catch (err) { throw new Error(`Invalid JSON response deleting exam: ${err.message} - response: ${text}`); }
}

const examService = { fetchExamList, startExam, submitExam };
export default examService;