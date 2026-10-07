import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import SubjectsTab from './SubjectsTab';
import * as service from '../classroomService';

jest.mock('../classroomService', () => ({
  addTopic: jest.fn(), deleteTopic: jest.fn(), deleteAssignment: jest.fn(), deleteMaterial: jest.fn(),
  getAssignments: jest.fn(), getMaterials: jest.fn(), getSubjectMembers: jest.fn(), getTopics: jest.fn(),
  removeStudentFromSubject: jest.fn(), restoreStudentToSubject: jest.fn(), reorderTopics: jest.fn(),
}));
jest.mock('../TeacherAssignmentsPanel', () => () => <p>Assignments panel</p>);
jest.mock('../topics/TopicHub', () => () => null);
jest.mock('../topics/TopicDialogs', () => ({ RemoveTopicDialog: () => null, TopicEditorDialog: () => null }));
// This project's Jest cannot resolve React Router 7.
jest.mock('react-router-dom', () => ({ Link: ({ to, children }) => <a href={to}>{children}</a> }), { virtual: true });

beforeEach(() => {
  service.getAssignments.mockResolvedValue({ assignments: [] });
  service.getMaterials.mockResolvedValue({ materials: [] });
  service.getSubjectMembers.mockResolvedValue({ members: [] });
  service.getTopics.mockResolvedValue({ topics: [] });
});

const subjects = [
  { id: 'math', name: 'Mathematics', teacherId: 't-math' },
  { id: 'eng', name: 'English', teacherId: 't-eng' },
];

test('a subject teacher who is not the class teacher can add topics to the subject they teach — and only that one', async () => {
  render(<SubjectsTab classId="jss1" subjects={subjects} canManage={false} myIdentifiers={['t-math', 'math@a.test']} />);
  fireEvent.click(screen.getByText('Mathematics'));
  fireEvent.click(await screen.findByRole('button', { name: /^topics/i }));
  expect(await screen.findByPlaceholderText('e.g. Photosynthesis')).toBeTruthy();
  expect(screen.getByRole('button', { name: /Add a topic for Mathematics/ })).toBeTruthy();

  fireEvent.click(screen.getByText('← All Subjects'));
  fireEvent.click(screen.getByText('English'));
  fireEvent.click(await screen.findByRole('button', { name: /^topics/i }));
  expect(screen.queryByPlaceholderText('e.g. Photosynthesis')).toBeNull();
});
