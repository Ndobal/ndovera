import { fetchWithAuth } from './apiClient';

async function request(path: string, opts: RequestInit = {}) {
  return fetchWithAuth(path, opts);
}

export const api = {
  getNotes: () => request('/api/notes'),
  createNote: (body: any) => request('/api/notes', { method: 'POST', body: JSON.stringify(body) }),
  listExams: () => request('/api/cbt/exams'),
  createExam: (body: any) => request('/api/cbt/exams', { method: 'POST', body: JSON.stringify(body) }),
  postAttempt: (body: any) => request('/api/cbt/attempts', { method: 'POST', body: JSON.stringify(body) }),
  getMessages: (userId: string) => request(`/api/messages?userId=${encodeURIComponent(userId)}`),
  sendMessage: (body: any) => request('/api/messages', { method: 'POST', body: JSON.stringify(body) }),
  listFarms: () => request('/api/farms'),
  createFarm: (body: any) => request('/api/farms', { method: 'POST', body: JSON.stringify(body) }),
  getLessonPlans: () => request('/api/lesson-plans'),
  createLessonPlan: (body: any) => request('/api/lesson-plans', { method: 'POST', body: JSON.stringify(body) }),
  reviewLessonPlan: (lessonPlanId: string, body: any) => request(`/api/lesson-plans/${encodeURIComponent(lessonPlanId)}/review`, { method: 'POST', body: JSON.stringify(body) }),
  uploadLessonPlan: (body: any) => request('/api/lesson-plans', { method: 'POST', body: JSON.stringify(body) }),
}

export default api;
