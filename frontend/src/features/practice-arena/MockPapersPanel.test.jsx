import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import MockPapersPanel from './MockPapersPanel';
import * as api from './practiceApi';

jest.mock('./practiceApi', () => ({ ...jest.requireActual('./practiceApi'), getMockPapers: jest.fn(), openMockPaper: jest.fn(), submitMockPaper: jest.fn() }));
jest.mock('../../shared/components/AppDialog', () => ({ askConfirm: jest.fn(() => Promise.resolve(true)) }));

const LISTED = { id: 'p1', exam: 'waec', examLabel: 'WAEC (WASSCE)', subjectName: 'Mathematics', setLabel: 'Mock 1', objectiveCount: 2, objectiveMinutes: 60, theoryCount: 1, theoryMinutes: 120, locked: false, lockedReason: '' };
const SITTING = {
  id: 'p1', exam: 'waec', examLabel: 'WAEC (WASSCE)', subjectName: 'Mathematics', setLabel: 'Mock 1', part: 'both', minutes: 180, instructions: 'Answer all.',
  objectives: [{ id: 'q1', position: 1, prompt: 'What is 2 + 2?', options: ['3', '4'], imageUrl: '/files/mock-papers/p1/q.png' }],
  theory: [{ id: 't1', position: 1, prompt: 'Solve x + 2 = 5.', marks: 10, imageUrl: '' }],
};
const RESULT = {
  score: 1, total: 1,
  objectives: [{ id: 'q1', position: 1, prompt: 'What is 2 + 2?', options: ['3', '4'], picked: 1, answerIndex: 1, correct: true, explanation: '2 + 2 = 4.' }],
  theory: [{ id: 't1', position: 1, prompt: 'Solve x + 2 = 5.', marks: 10, modelAnswer: 'x = 3', markingPoints: ['Subtract 2'] }],
};

beforeEach(() => {
  jest.clearAllMocks();
  api.getMockPapers.mockResolvedValue({ papers: [LISTED] });
  api.openMockPaper.mockResolvedValue({ paper: SITTING });
  api.submitMockPaper.mockResolvedValue({ result: RESULT });
});

test('a student chooses objectives, theory or both, and sees the answers after handing in', async () => {
  render(<MockPapersPanel />);
  await screen.findByRole('button', { name: 'Objectives only' });
  expect(screen.getByRole('button', { name: 'Theory only' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Both' }));
  await waitFor(() => expect(api.openMockPaper).toHaveBeenCalledWith('p1', 'both'));

  expect(await screen.findByRole('timer')).toHaveTextContent('180:00');
  expect(screen.getByAltText('Diagram for question 1')).toHaveAttribute('src', '/files/mock-papers/p1/q.png');
  fireEvent.click(screen.getByLabelText('B. 4'));
  fireEvent.change(screen.getByLabelText('Your answer'), { target: { value: 'x is 3' } });
  expect(screen.queryByText(/x = 3/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Hand in' }));
  await waitFor(() => expect(api.submitMockPaper).toHaveBeenCalledWith('p1', { part: 'both', answers: { q1: 1 } }));

  expect(await screen.findByText('1 / 1')).toBeInTheDocument();
  expect(screen.getByText(/x = 3/)).toBeInTheDocument();
  expect(screen.getByText(/x is 3/)).toBeInTheDocument();
  expect(screen.getByText(/not an official marking scheme/)).toBeInTheDocument();
});

test('only the parts a paper has are offered, and a locked paper points to the passes', async () => {
  const onNeedPass = jest.fn();
  api.getMockPapers.mockResolvedValue({ papers: [
    { ...LISTED, id: 'p2', subjectName: 'Physics', theoryCount: 0, theoryMinutes: 0 },
    { ...LISTED, id: 'p3', subjectName: 'Biology', locked: true, lockedReason: 'WAEC practice needs the WAEC / NECO Prep pass.' },
  ] });
  render(<MockPapersPanel onNeedPass={onNeedPass} />);
  await screen.findByText(/Physics/);
  expect(screen.getAllByRole('button', { name: 'Objectives only' })).toHaveLength(1);
  expect(screen.queryByRole('button', { name: 'Both' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'See passes' }));
  expect(onNeedPass).toHaveBeenCalledWith('waec');
});

test('when time runs out the paper is handed in by itself', async () => {
  jest.useFakeTimers();
  try {
    api.openMockPaper.mockResolvedValue({ paper: { ...SITTING, minutes: 1 } });
    render(<MockPapersPanel />);
    await act(async () => { await Promise.resolve(); });
    fireEvent.click(screen.getByRole('button', { name: 'Both' }));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    for (let second = 0; second < 61; second += 1) act(() => { jest.advanceTimersByTime(1000); });
    await act(async () => { await Promise.resolve(); });
    expect(api.submitMockPaper).toHaveBeenCalledTimes(1);
  } finally { jest.useRealTimers(); }
});
