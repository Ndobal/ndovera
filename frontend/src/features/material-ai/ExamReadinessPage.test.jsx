import React from 'react';
import { render, screen } from '@testing-library/react';
import ExamReadinessPage from './ExamReadinessPage';
import * as api from './materialAiApi';

jest.mock('./materialAiApi');
jest.mock('../auth/services/authApi', () => ({ getStoredAuth: () => ({ user: { classId: 'ss2a' } }) }));
// This project's Jest cannot resolve React Router 7.
jest.mock('react-router-dom', () => ({ Link: ({ to, children, className }) => <a href={to} className={className}>{children}</a> }), { virtual: true });

beforeEach(() => {
  api.getExamReadiness.mockResolvedValue({
    success: true, className: 'SS 2 A',
    options: [{ subjectId: 'math', subjectName: 'Mathematics', exams: [{ key: 'waec', label: 'WAEC (WASSCE)', version: '2025', specId: 's1' }] }, { subjectId: 'eng', subjectName: 'English', exams: [] }],
    readiness: {
      exam: { name: 'WAEC (WASSCE)', subject: 'Mathematics' }, overall: 65, evidenceCount: 2, unmatched: 1,
      areas: [
        { area: 'Algebra', percent: 90, assessedTopics: 1, topics: [{}] },
        { area: 'Trigonometry', percent: 40, assessedTopics: 1, topics: [{}] },
        { area: 'Statistics', percent: null, assessedTopics: 0, topics: [{}] },
      ],
      attention: [{ id: 't2', topic: 'Bearings', area: 'Trigonometry', percent: 40 }],
      notAssessed: [{ id: 't3', topic: 'Probability', area: 'Statistics' }],
    },
  });
});

test('readiness is shown per area from marked work, with what needs attention and what is not yet assessed', async () => {
  render(<ExamReadinessPage />);
  expect(await screen.findByText('WAEC (WASSCE) Mathematics Readiness')).toBeTruthy();
  expect(screen.getAllByRole('meter').map(meter => meter.getAttribute('aria-valuenow'))).toEqual(['90', '40', '40']);
  expect(screen.getByText('Not yet assessed', { selector: 'span' })).toBeTruthy();
  expect(screen.getByText(/No marked work yet on: Probability/)).toBeTruthy();
  const practise = screen.getByRole('link', { name: 'Practise with Ndovera AI' });
  expect(decodeURIComponent(practise.getAttribute('href'))).toMatch(/WAEC-style practice questions \(not past questions\)/);
  // Only subjects with a specification on file can be chosen.
  expect(screen.getByRole('combobox', { name: 'Subject' }).querySelectorAll('option')).toHaveLength(1);
});
