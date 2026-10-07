import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import SubmissionReviewPage from './SubmissionReviewPage';
import * as api from './submissionsApi';
import { getAssignedClasses } from '../classroom/classroomService';

// This project's Jest cannot resolve React Router 7, so the one hook the page uses is stood in.
jest.mock('react-router-dom', () => {
  const ReactLib = jest.requireActual('react');
  return {
    useSearchParams: () => {
      const [params, setParams] = ReactLib.useState(new URLSearchParams());
      return [params, next => setParams(new URLSearchParams(next))];
    },
  };
}, { virtual: true });
jest.mock('../classroom/classroomService', () => ({ getAssignedClasses: jest.fn() }));
jest.mock('./submissionsApi', () => ({
  ...jest.requireActual('./submissionsApi'),
  getSubmissionConfig: jest.fn(), getReviewBoard: jest.fn(), getSubmissionDetail: jest.fn(),
  startSubmissionReview: jest.fn(), saveSubmissionConfig: jest.fn(), runAiReview: jest.fn(), decideSubmission: jest.fn(),
}));

const submission = { id: 's1', classId: 'p5', className: 'Primary 5', subjectId: 'math', subjectName: 'Mathematics', teacherId: 't1', teacherName: 'Mrs A', typeLabel: 'Lesson Plan', periodLabel: 'Week 4', title: 'Week 4 plan', content: 'Objectives…', files: [], status: 'submitted', version: 1, submittedAt: '2026-10-02T10:00:00Z' };

beforeEach(() => {
  jest.clearAllMocks();
  getAssignedClasses.mockResolvedValue({ success: true, classes: [{ id: 'p5', className: 'Primary 5' }, { id: 'p6', className: 'Primary 6' }] });
  api.getSubmissionConfig.mockResolvedValue({ success: true, types: [{ key: 'lesson_plan', label: 'Lesson Plan' }], policy: { requirements: [], reviewMode: 'approval', maxScore: 10, reviewerRoles: [], customTypes: [], aiCriteria: [] }, period: { sessionName: '2026/2027', termName: 'First Term' }, canReview: true, canConfigure: true });
  api.getReviewBoard.mockImplementation(params => Promise.resolve(params?.classId
    ? { success: true, submissions: [submission], summary: { submittedTeachers: ['t1'], notSubmittedTeachers: [{ teacherId: 't2', teacherName: 'Mr B' }], missing: [], late: [], awaitingReview: 1, returnedAwaitingResubmission: 0, approved: 0 } }
    : { success: true, classes: [{ classId: 'p5', className: 'Primary 5', awaitingReview: 1, approved: 0 }] }));
  api.getSubmissionDetail.mockResolvedValue({ success: true, submission, versions: [], events: [], permissions: { isReviewer: true, reviewMode: 'approval', maxScore: 10 } });
  api.startSubmissionReview.mockResolvedValue({ success: true });
});

test('a reviewer chooses a class, sees who has not submitted, and opening work starts its review', async () => {
  render(<SubmissionReviewPage dashboardLabel="Head of School" />);
  fireEvent.click(await screen.findByText('Primary 5'));
  expect(await screen.findByText(/No submissions this term:/)).toBeTruthy();
  expect(screen.getByText('Mr B', { exact: false })).toBeTruthy();
  expect(screen.getByText('Mathematics · Mrs A · Lesson Plan')).toBeTruthy();

  fireEvent.click(screen.getByText('Week 4'));
  await waitFor(() => expect(api.startSubmissionReview).toHaveBeenCalledWith('s1'));
  expect(await screen.findByText(/AI preliminary review — advice for you, not a decision/)).toBeTruthy();
});

test('every term is listed by default, so older work is never hidden; the reviewer can narrow it to this session or term', async () => {
  render(<SubmissionReviewPage dashboardLabel="Head of School" />);
  fireEvent.click(await screen.findByText('Primary 5'));
  await waitFor(() => expect(api.getReviewBoard).toHaveBeenCalledWith(expect.objectContaining({ classId: 'p5', scope: 'all' })));
  fireEvent.click(screen.getByText('This term'));
  await waitFor(() => expect(api.getReviewBoard).toHaveBeenCalledWith(expect.objectContaining({ classId: 'p5', scope: 'term' })));
});
