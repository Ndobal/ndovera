import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import TopicHub from './TopicHub';
import { getTopicHub, recordTopicProgress } from '../classroomService';

jest.mock('../classroomService', () => ({ getTopicHub: jest.fn(), recordTopicProgress: jest.fn() }));
jest.mock('../materials/MaterialViewer', () => ({ material }) => <p>Viewing {material.title}</p>);
jest.mock('./TopicStudyChat', () => ({ topic }) => <p>Studying {topic.name} with AI</p>);

const hub = {
  success: true,
  canManage: false,
  topic: { id: 'fr', name: 'Fractions', week: 'Week 4', description: 'Parts of a whole', objectives: ['Compare fractions'], status: 'published' },
  materials: [{ id: 'm1', title: 'Fractions Chart', url: 'https://x/chart.png', type: 'image', metadata: {} }],
  assignments: [{ id: 'a1', title: 'Class Assignment', isQuiz: false }, { id: 'q1', title: 'Practice Quiz', isQuiz: true }],
  progress: { label: 'Studying', stages: { studying: true, materialsViewed: false, assignmentCompleted: false, quizCompleted: false }, counts: { materials: 1, materialsViewed: 0, assignments: 1, assignmentsSubmitted: 0, quizzes: 1, quizzesSubmitted: 0 }, viewedMaterialIds: [] },
};

beforeEach(() => {
  jest.clearAllMocks();
  getTopicHub.mockResolvedValue(hub);
  recordTopicProgress.mockResolvedValue({ success: true });
});

test('a topic page shows everything filed under it and records the student opening it', async () => {
  render(<TopicHub classId="jss1a" topicId="fr" subjectName="Mathematics" />);
  expect(await screen.findByRole('heading', { name: 'Fractions' })).toBeTruthy();
  expect(screen.getByText('Compare fractions')).toBeTruthy();
  expect(screen.getByText('Class Assignment')).toBeTruthy();
  expect(screen.getByText('Practice Quiz')).toBeTruthy();
  expect(screen.getByText(/Your progress · Studying/)).toBeTruthy();
  expect(recordTopicProgress).toHaveBeenCalledWith('jss1a', 'fr', { event: 'opened' });

  fireEvent.click(screen.getByText('Fractions Chart'));
  expect(screen.getByText('Viewing Fractions Chart')).toBeTruthy();
  await waitFor(() => expect(recordTopicProgress).toHaveBeenCalledWith('jss1a', 'fr', { event: 'material_viewed', materialId: 'm1' }));

  fireEvent.click(screen.getByText(/Study with Ndovera AI/));
  expect(screen.getByText('Studying Fractions with AI')).toBeTruthy();
});
