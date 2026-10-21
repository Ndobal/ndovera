import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import TeacherAssignmentsPanel from './TeacherAssignmentsPanel';
import * as svc from './classroomService';
import { askConfirm } from '../../shared/components/AppDialog';

jest.mock('./classroomService', () => ({
  getAssignedClasses: jest.fn(), getTopics: jest.fn(), createAssignment: jest.fn(), updateAssignment: jest.fn(), deleteAssignment: jest.fn(),
  uploadAssignmentAsset: jest.fn(), getSubmissions: jest.fn(), gradeSubmission: jest.fn(),
}));
jest.mock('../../shared/components/AppDialog', () => ({ askConfirm: jest.fn() }));

const CLASSES = [
  { id: 'jss1a', className: 'JSS 1 A', subjects: [{ id: 'math-a', name: 'Mathematics' }, { id: 'eng-a', name: 'English' }] },
  { id: 'jss1b', className: 'JSS 1 B', subjects: [{ id: 'math-b', name: 'Mathematics' }] },
  { id: 'jss1c', className: 'JSS 1 C', subjects: [{ id: 'bsc-c', name: 'Basic Science' }] },
];

beforeEach(() => {
  askConfirm.mockResolvedValue(true);
  svc.getAssignedClasses.mockResolvedValue({ success: true, classes: CLASSES });
  svc.getTopics.mockResolvedValue({ topics: [] });
  svc.createAssignment.mockResolvedValue({ success: true, assignment: { id: 'new' } });
  svc.getSubmissions.mockResolvedValue({ submissions: [] });
});

test('paste questions, give the assignment to another arm too, and publish both', async () => {
  const onRefresh = jest.fn();
  render(<TeacherAssignmentsPanel assignedClasses={CLASSES} currentClassId="jss1a" currentClassName="JSS 1 A" assignments={[]} onRefreshAssignments={onRefresh} />);
  fireEvent.click(screen.getByText('+ New assignment'));
  const dialog = await screen.findByRole('dialog', { name: 'New assignment' });

  fireEvent.change(within(dialog).getByLabelText('Subject'), { target: { value: 'math-a' } });
  fireEvent.click(await within(dialog).findByText('+ JSS 1 B'));
  expect(within(dialog).queryByText('+ JSS 1 C')).toBeNull(); // no Mathematics there
  fireEvent.change(within(dialog).getByLabelText('Title'), { target: { value: 'Fractions' } });

  fireEvent.click(within(dialog).getByRole('tab', { name: 'Paste many at once' }));
  fireEvent.change(within(dialog).getByLabelText('Paste questions'), { target: { value: '1. 2 + 2 =\nA. 3\nB. 4\nAnswer: B\n2. 3 × 3 =\nA. 6 B. 9 C. 12\nAns: B\n3. Explain a fraction.' } });
  expect(within(dialog).getByText('Found 3 questions')).toBeTruthy();
  fireEvent.click(within(dialog).getByText('Add 3 questions to this assignment'));
  expect(within(dialog).getByText(/3<\/b>|3 questions/, { exact: false })).toBeTruthy();

  fireEvent.click(within(dialog).getByText('Publish'));
  await waitFor(() => expect(svc.createAssignment).toHaveBeenCalledTimes(2));
  const [[firstClass, first], [secondClass, second]] = svc.createAssignment.mock.calls;
  expect([firstClass, first.subjectId, secondClass, second.subjectId]).toEqual(['jss1a', 'math-a', 'jss1b', 'math-b']);
  expect(first.questions.map(question => [question.type, question.answer])).toEqual([['mcq', '4'], ['mcq', '9'], ['essay', undefined]]);
  expect(first.metadata.totalScore).toBe(3);
  expect(first.metadata.groupId).toBe(second.metadata.groupId);
  expect(await screen.findByText(/"Fractions" is live for JSS 1 A, JSS 1 B/)).toBeTruthy();
});

test('a multiple choice question needs its correct option marked before publishing', async () => {
  render(<TeacherAssignmentsPanel assignedClasses={CLASSES.slice(1, 2)} currentClassId="jss1b" currentClassName="JSS 1 B" assignments={[]} />);
  fireEvent.click(screen.getByText('+ New assignment'));
  const dialog = await screen.findByRole('dialog', { name: 'New assignment' });
  expect(within(dialog).getByLabelText('Subject').value).toBe('math-b'); // the only subject is chosen
  fireEvent.change(within(dialog).getByLabelText('Title'), { target: { value: 'Quiz' } });
  fireEvent.change(within(dialog).getByLabelText('Question'), { target: { value: 'Which is even?' } });
  const options = within(dialog).getAllByPlaceholderText(/Option [AB]/);
  fireEvent.change(options[0], { target: { value: '3' } });
  fireEvent.change(options[1], { target: { value: '4' } });
  fireEvent.click(within(dialog).getByText('Publish'));
  expect(await within(dialog).findByText('Question 1: Mark the correct option.')).toBeTruthy();
  expect(svc.createAssignment).not.toHaveBeenCalled();
  fireEvent.click(within(dialog).getByLabelText('Make B the correct answer'));
  fireEvent.click(within(dialog).getByText('Publish'));
  await waitFor(() => expect(svc.createAssignment).toHaveBeenCalledWith('jss1b', expect.objectContaining({ subjectId: 'math-b', title: 'Quiz' })));
});

test('a teacher with no subject in the class is told why, instead of being stuck', async () => {
  render(<TeacherAssignmentsPanel assignedClasses={[{ id: 'x', className: 'Primary 4', subjects: [] }]} currentClassId="x" assignments={[]} />);
  fireEvent.click(screen.getByText('+ New assignment'));
  const dialog = await screen.findByRole('dialog', { name: 'New assignment' });
  expect(within(dialog).getByText(/You are not assigned a subject in Primary 4/)).toBeTruthy();
});
