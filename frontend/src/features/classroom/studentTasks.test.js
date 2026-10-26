import { getAssignments } from './classroomService';
import { getStudentDashboard } from '../../services/roleDashboardService';
import { listOutbox } from '../../shared/offline/outbox';
import { clearAnswerDraft, loadStudentAssignments, readAnswerDraft, saveAnswerDraft, studentClassId } from './studentTasks';

jest.mock('./classroomService', () => ({ getAssignments: jest.fn() }));
jest.mock('../../services/roleDashboardService', () => ({ getStudentDashboard: jest.fn() }));
jest.mock('../../shared/offline/outbox', () => ({ listOutbox: jest.fn(() => Promise.resolve([])) }));

const signIn = user => window.localStorage.setItem('authUser', JSON.stringify(user));
const setOnline = online => Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => online });

beforeEach(() => {
  window.localStorage.clear();
  setOnline(true);
  jest.clearAllMocks();
  listOutbox.mockResolvedValue([]);
});

test("the student's own class wins over a class left on the phone by someone else", () => {
  window.localStorage.setItem('classroomId', 'teacher-last-class');
  signIn({ id: 'stu-1', role: 'student', classId: 'jss1a' });
  expect(studentClassId()).toBe('jss1a');
});

test('with no class on the device, Ndovera is asked which class the student is in', async () => {
  signIn({ id: 'stu-2', role: 'student' });
  getStudentDashboard.mockResolvedValue({ classId: 'ss2b' });
  getAssignments.mockResolvedValue({ success: true, assignments: [{ id: 'a1', title: 'Algebra' }] });
  const result = await loadStudentAssignments();
  expect(getAssignments).toHaveBeenCalledWith('ss2b');
  expect(result.assignments.map(item => item.id)).toEqual(['a1']);
});

test('offline, the copy downloaded earlier is shown, with hand-ins still waiting on the device', async () => {
  signIn({ id: 'stu-3', role: 'student', classId: 'jss2' });
  getAssignments.mockResolvedValue({ success: true, assignments: [{ id: 'a1', title: 'Fractions' }, { id: 'a2', title: 'Angles' }] });
  await loadStudentAssignments();

  setOnline(false);
  listOutbox.mockResolvedValue([{ id: 'x', status: 'queued', createdAt: '2026-10-26T09:00:00.000Z', payload: { assignmentId: 'a2', body: { answers: { q1: '90' }, capturedAt: '2026-10-26T09:00:00.000Z' } } }]);
  const result = await loadStudentAssignments();
  expect(result.offline).toBe(true);
  expect(result.assignments.map(item => item.title)).toEqual(['Fractions', 'Angles']);
  expect(result.assignments[1].mySubmission).toMatchObject({ queued: true, content: { answers: { q1: '90' } } });
  expect(getAssignments).toHaveBeenCalledTimes(1);
});

test('a dropped connection while loading falls back to the kept copy too', async () => {
  signIn({ id: 'stu-4', role: 'student', classId: 'pry5' });
  getAssignments.mockResolvedValueOnce({ success: true, assignments: [{ id: 'a1' }] });
  await loadStudentAssignments();
  getAssignments.mockRejectedValueOnce(new TypeError('Failed to fetch'));
  const result = await loadStudentAssignments();
  expect(result).toMatchObject({ offline: true, assignments: [{ id: 'a1' }] });
});

test('offline with nothing downloaded yet says so plainly', async () => {
  signIn({ id: 'stu-5', role: 'student', classId: 'pry6' });
  setOnline(false);
  await expect(loadStudentAssignments()).rejects.toThrow(/offline/i);
});

test('answers typed so far are kept per student and per assignment', async () => {
  signIn({ id: 'stu-6', role: 'student', classId: 'jss3' });
  await saveAnswerDraft('a9', { q1: 'x = 4' });
  expect((await readAnswerDraft('a9')).answers).toEqual({ q1: 'x = 4' });
  signIn({ id: 'stu-7', role: 'student', classId: 'jss3' });
  expect(await readAnswerDraft('a9')).toBeNull();
  signIn({ id: 'stu-6', role: 'student', classId: 'jss3' });
  await clearAnswerDraft('a9');
  expect(await readAnswerDraft('a9')).toBeNull();
});
