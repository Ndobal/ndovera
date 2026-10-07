import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import AcademicHistory from './AcademicHistory';
import { getArchivedMaterials, getAssignedClasses, getTeachingHistory, reuseArchivedMaterial } from './classroomService';

jest.mock('./classroomService', () => ({
  getArchivedMaterials: jest.fn(), getAssignedClasses: jest.fn(), getTeachingHistory: jest.fn(), reuseArchivedMaterial: jest.fn(),
}));
jest.mock('./materials/MaterialViewer', () => () => null);

beforeEach(() => {
  jest.clearAllMocks();
  getArchivedMaterials.mockResolvedValue({
    success: true,
    current: { sessionName: '2027/2028', termName: 'First Term' },
    materials: [
      { id: 'old', title: 'Fractions', subjectName: 'Math', academicSessionId: 'past', academicSessionName: '2026/2027', academicTermName: 'Third Term', archiveClassName: 'Primary 3', status: 'published' },
      { id: 'older', title: 'Shapes', subjectName: 'Math', academicSessionId: 'past', academicSessionName: '2026/2027', academicTermName: 'First Term', archiveClassName: 'Primary 3', status: 'published' },
    ],
  });
  getAssignedClasses.mockResolvedValue({ success: true, classes: [{ id: 'new-class', name: 'Primary 4', subjects: [{ id: 'math', name: 'Math' }] }] });
  getTeachingHistory.mockResolvedValue({ success: true, assignments: [
    { id: 'a1', current: false, sessionName: '2026/2027', className: 'Primary 3', subjectName: 'Math', role: 'subject' },
    { id: 'a2', current: true, sessionName: '2027/2028', className: 'Primary 4', subjectName: 'Math', role: 'subject' },
  ] });
});

test('students see history grouped by session and term, without teacher controls', async () => {
  render(<AcademicHistory />);
  const session = await screen.findByRole('region', { name: '2026/2027' });
  expect(within(session).getByText('Third Term')).toBeTruthy();
  expect(within(session).getByText('First Term')).toBeTruthy();
  expect(screen.getByText(/Current: 2027\/2028 • First Term/)).toBeTruthy();
  expect(screen.queryByText('Reuse in current session')).toBeNull();
  expect(getAssignedClasses).not.toHaveBeenCalled();
  expect(getTeachingHistory).not.toHaveBeenCalled();
});

test('teachers see earlier assignments and reuse a material as a draft referencing the original', async () => {
  reuseArchivedMaterial.mockResolvedValue({ success: true, material: { id: 'copy' } });
  render(<AcademicHistory role="teacher" />);
  expect(await screen.findByText('Teaching history')).toBeTruthy();
  expect(screen.getByText('Primary 3 — Math')).toBeTruthy();
  expect(screen.queryByText('Primary 4 — Math')).toBeNull();
  fireEvent.click(screen.getAllByText('Reuse in current session')[0]);
  fireEvent.change(screen.getByLabelText('Class'), { target: { value: 'new-class' } });
  fireEvent.change(screen.getByLabelText('Subject'), { target: { value: 'math' } });
  fireEvent.click(screen.getByText('Reuse as draft'));
  await waitFor(() => expect(reuseArchivedMaterial).toHaveBeenCalledWith('old', { classId: 'new-class', subjectId: 'math', status: 'draft' }));
  await screen.findByText(/The original is unchanged/);
});

test('archive API failures are visible instead of appearing to be an empty archive', async () => {
  getArchivedMaterials.mockResolvedValue({ success: false, message: 'Could not load archived materials.' });
  render(<AcademicHistory />);
  expect((await screen.findByRole('alert')).textContent).toBe('Could not load archived materials.');
});

test('history folds by session and term, and can be filtered by subject or searched by topic and text', async () => {
  getArchivedMaterials.mockResolvedValue({
    success: true,
    materials: [
      { id: 'm1', title: 'Fractions', topic: 'Number', subjectName: 'Math', academicSessionId: 's2', academicSessionName: '2026/2027', academicTermName: 'Third Term', archiveClassName: 'Primary 3', status: 'published' },
      { id: 'm2', title: 'Shapes', subjectName: 'Math', academicSessionId: 's2', academicSessionName: '2026/2027', academicTermName: 'First Term', archiveClassName: 'Primary 3', status: 'published' },
      { id: 'e1', title: 'Comprehension', description: '<p>Reading about photosynthesis</p>', subjectName: 'English', academicSessionId: 's1', academicSessionName: '2025/2026', academicTermName: 'Second Term', archiveClassName: 'Primary 2', status: 'published' },
    ],
  });
  render(<AcademicHistory />);

  // Newest session and its first term start open; the rest are folded.
  expect(await screen.findByText('Fractions')).toBeTruthy();
  expect(screen.queryByText('Shapes')).toBeNull();
  expect(screen.queryByText('Comprehension')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /First Term/ }));
  expect(screen.getByText('Shapes')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: /2026\/2027/ }));
  expect(screen.queryByText('Fractions')).toBeNull();

  // A subject filter opens everything that matches.
  fireEvent.click(screen.getByRole('button', { name: /^English/ }));
  expect(screen.getByText('Comprehension')).toBeTruthy();
  expect(screen.queryByRole('region', { name: '2026/2027' })).toBeNull();

  // Search reaches inside descriptions and topics.
  fireEvent.click(screen.getByRole('button', { name: /All subjects/ }));
  fireEvent.change(screen.getByPlaceholderText('Search by topic or text…'), { target: { value: 'photosynthesis' } });
  expect(screen.getByText('Comprehension')).toBeTruthy();
  expect(screen.queryByText('Fractions')).toBeNull();
  fireEvent.change(screen.getByPlaceholderText('Search by topic or text…'), { target: { value: 'number' } });
  expect(screen.getByText('Fractions')).toBeTruthy();
  expect(screen.getByText(/1 of 3 items match/)).toBeTruthy();
  fireEvent.change(screen.getByPlaceholderText('Search by topic or text…'), { target: { value: 'zebra' } });
  expect(screen.getByText('Nothing matches your search or subject filter.')).toBeTruthy();
});
