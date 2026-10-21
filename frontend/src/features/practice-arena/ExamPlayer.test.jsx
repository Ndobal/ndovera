import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import ExamPlayer, { markPaper } from './ExamPlayer';
import { askConfirm } from '../../shared/components/AppDialog';

jest.mock('../../shared/components/AppDialog', () => ({ askConfirm: jest.fn() }));
beforeEach(() => { askConfirm.mockResolvedValue(true); });
jest.mock('../../shared/rich/RichContent', () => ({ text }) => <span>{text}</span>);

const questions = [
  { id: 'q1', type: 'mcq', prompt: 'Capital of Nigeria?', options: ['Lagos', 'Abuja'], correctIndex: 1 },
  { id: 'q2', type: 'shortanswer', prompt: 'Process in leaves?', accepted: ['photosynthesis'] },
  { id: 'q3', type: 'essay', prompt: 'Explain evaporation.', modelAnswer: 'Water changes into vapour when heated by the sun' },
];

test('the paper is marked only at hand-in; theory by the model answer\'s key words', () => {
  const results = markPaper(questions, { q1: { choice: 1 }, q2: { text: 'Photosinthesis' }, q3: { text: 'water changes into vapour when heated' } });
  expect(results.map(item => item.correct)).toEqual([true, true, true]);
  expect(results[2].selfRating).toBe('got_it');
  expect(markPaper(questions, { q3: { text: 'water is wet' } })[2].selfRating).toBe('missed');
  expect(markPaper(questions, {}).every(item => item.unanswered)).toBe(true);
});

test('no answer is shown while sitting the exam', async () => {
  const onFinish = jest.fn();
  render(<ExamPlayer quiz={{ mode: 'exam', label: 'Exam Simulation', seconds: 600, questions }} subjectName="Basic Science" onFinish={onFinish} onExit={() => {}} />);
  fireEvent.click(screen.getByText('Lagos'));
  expect(screen.getByText('Your answer: A')).toBeTruthy();
  expect(screen.queryByText(/Not quite|Brilliant|Answer:/)).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Question 3' }));
  fireEvent.click(screen.getByText('Hand in the paper'));
  await screen.findByText(/Exam conditions/);
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(onFinish).toHaveBeenCalledTimes(1);
  expect(onFinish.mock.calls[0][0].results[0].correct).toBe(false);
});
