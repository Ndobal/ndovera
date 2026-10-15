import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CurriculumImportDialog } from './TopicDialogs';
import { getCurriculumTopicsForSubject, importCurriculumTopics } from '../classroomService';

jest.mock('../classroomService', () => ({ getCurriculumTopicsForSubject: jest.fn(), importCurriculumTopics: jest.fn(), deleteTopic: jest.fn(), updateTopic: jest.fn() }));

beforeEach(() => {
  jest.clearAllMocks();
  getCurriculumTopicsForSubject.mockResolvedValue({
    success: true, message: '', level: 'JSS 1', subject: 'Mathematics', currentTerm: '2', curricula: ['NERDC CURRICULUM'],
    topics: [
      { id: 'a', term: '1', week: '1', topic: 'Whole Numbers', subtopics: [], added: false },
      { id: 'b', term: '2', week: '1', topic: 'Fractions', subtopics: ['Proper fractions'], added: false },
      { id: 'c', term: '2', week: '2', topic: 'Estimation', subtopics: [], added: true },
    ],
  });
  importCurriculumTopics.mockResolvedValue({ success: true, added: 1, skipped: [] });
});

test('opens on the current term, leaves topics already there unticked and imports the rest as drafts', async () => {
  const onImported = jest.fn();
  render(<CurriculumImportDialog classId="jss1a" subjectId="math" subjectName="Mathematics" onClose={() => {}} onImported={onImported} />);
  expect(await screen.findByText('Week 1: Fractions')).toBeTruthy();
  expect(screen.queryByText('Week 1: Whole Numbers')).toBeNull();
  expect(screen.getByText('(already in this subject)')).toBeTruthy();

  fireEvent.click(screen.getByRole('button', { name: 'Import 1 topic as drafts' }));
  await waitFor(() => expect(importCurriculumTopics).toHaveBeenCalledWith('jss1a', 'math', ['b']));
  expect(onImported).toHaveBeenCalledWith({ success: true, added: 1, skipped: [] });

  fireEvent.click(screen.getByRole('tab', { name: 'First term' }));
  expect(screen.getByText('Week 1: Whole Numbers')).toBeTruthy();
});
