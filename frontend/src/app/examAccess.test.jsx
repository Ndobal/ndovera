import React from 'react';
import { render, screen } from '@testing-library/react';
import Exams from './Exams';
import { canBuildExams, examHomeFor } from './examAccess';

jest.mock('../shared/components/CommandPageShell', () => () => null);
jest.mock('react-router-dom', () => ({ Link: ({ children }) => <a href="/exams/create">{children}</a> }), { virtual: true });

test('only teaching and leadership roles can build an exam, matching the server', () => {
  ['teacher', 'classteacher', 'hod', 'hodassistant', 'hos', 'owner', 'ami', 'Teacher'].forEach(role => expect(canBuildExams(role)).toBe(true));
  ['student', 'parent', 'growthpartner', 'driver', '', undefined].forEach(role => expect(canBuildExams(role)).toBe(false));
});

test('students and parents are sent to their own exam pages', () => {
  expect(examHomeFor('student')).toBe('/roles/student/exams');
  expect(examHomeFor('parent')).toBe('/roles/parent/exams');
  expect(examHomeFor('driver')).toBe('/exams');
});

test('the button to build an exam shows only to those who can', () => {
  const { rerender } = render(<Exams canCreate={false} />);
  expect(screen.queryByText('Create New Exam')).not.toBeInTheDocument();
  rerender(<Exams canCreate />);
  expect(screen.getByText('Create New Exam')).toBeInTheDocument();
});
