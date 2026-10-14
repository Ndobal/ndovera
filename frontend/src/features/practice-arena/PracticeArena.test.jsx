import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import PracticeArena from './PracticeArena';
import * as api from './practiceApi';

jest.mock('./practiceApi');
jest.mock('../../shared/rich/RichContent', () => ({ text }) => <span>{text}</span>);
jest.mock('framer-motion', () => {
  const React = require('react');
  const strip = ({ whileHover, whileTap, initial, animate, exit, transition, ...rest }) => rest;
  // One component per tag (a new one each render would remount everything).
  const cache = {};
  const make = tag => { cache[tag] = cache[tag] || React.forwardRef((props, ref) => React.createElement(tag, { ...strip(props), ref })); return cache[tag]; };
  return { motion: new Proxy({}, { get: (_, tag) => make(tag) }), AnimatePresence: ({ children }) => <>{children}</> };
});

const HOME = {
  success: true,
  student: { name: 'Ada', className: 'JSS 2 A', level: 'JSS 2', section: 'junior' },
  profile: { xp: 150, level: 2, title: 'Rookie', streak: 3, todayXp: 20, dailyGoal: 50, accuracy: 80, correct: 40, quizzes: 6, badges: [{ key: 'first_quiz', label: 'First Steps', icon: '🎯', description: 'x', earned: true }, { key: 'perfect', label: 'Flawless', icon: '💎', description: 'y', earned: false }] },
  subjects: [{ key: 'mathematics', name: 'Mathematics', questions: 42, levels: 'JSS 1 – JSS 2', mastery: 70, types: { objective: 30, written: 10, openEnded: 2 } }],
  leaderboard: { entries: [{ rank: 1, name: 'Ada', xp: 120, you: true }, { rank: 2, name: 'Bola', xp: 80 }] },
  recent: [],
};

const PACK = {
  subjectKey: 'mathematics', savedAt: 1,
  questions: [
    { id: 'q1', type: 'truefalse', prompt: 'Two plus two is four.', options: ['True', 'False'], correctIndex: 0 },
    { id: 'q2', type: 'shortanswer', prompt: 'What is 3 x 3?', accepted: ['9'] },
  ],
};

beforeEach(() => {
  api.loadHome.mockResolvedValue({ ...HOME, offline: false });
  api.loadPack.mockResolvedValue(PACK);
  api.packSavedAt.mockResolvedValue(null);
  api.pendingAttempts.mockResolvedValue(0);
  api.saveAttempt.mockResolvedValue({ attempt: { xp: 35, percent: 100 }, profile: { ...HOME.profile, xp: 185, streak: 4 }, newBadges: [{ key: 'perfect', label: 'Flawless', icon: '💎', description: 'Score 100%' }], levelUp: null });
});

test('the arena shows level, streak, subjects with mastery, badges and the class leaderboard', async () => {
  render(<PracticeArena />);
  expect(await screen.findByText('Mathematics')).toBeTruthy();
  expect(screen.getByText(/3-day streak/)).toBeTruthy();
  expect(screen.getByRole('heading', { name: /Rookie · 150 XP/ })).toBeTruthy();
  expect(screen.getByRole('meter', { name: 'Mathematics mastery' }).getAttribute('aria-valuenow')).toBe('70');
  fireEvent.click(screen.getByRole('tab', { name: /Badges/ }));
  expect(screen.getByText('Flawless 🔒')).toBeTruthy();
  fireEvent.click(screen.getByRole('tab', { name: /Leaderboard/ }));
  expect(screen.getByText('Ada (you)')).toBeTruthy();
});

test('a quiz is played and marked on the device, then saved with the option text (not its shuffled position)', async () => {
  render(<PracticeArena />);
  fireEvent.click(await screen.findByRole('button', { name: 'Play ▶' }));
  const dialog = screen.getByRole('dialog');
  fireEvent.click(within(dialog).getByRole('button', { name: /Build Your Own/ }));
  await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Start ▶' })); });

  // Two questions, in some order; answer both correctly.
  for (let step = 0; step < 2; step += 1) {
    if (screen.queryByText('Two plus two is four.')) {
      fireEvent.click(screen.getByRole('button', { name: /True/ }));
    } else {
      fireEvent.change(screen.getByLabelText('Your answer'), { target: { value: ' 9 ' } });
      fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    }
    expect(await screen.findByRole('status')).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Next|See results/ })); });
  }

  expect(await screen.findByText('Perfect score! 💎')).toBeTruthy();
  expect(screen.getByText('+35 XP')).toBeTruthy();
  expect(screen.getByText('Flawless')).toBeTruthy();
  const attempt = api.saveAttempt.mock.calls[0][0];
  expect(attempt.subjectKey).toBe('mathematics');
  expect(attempt.mode).toBe('custom');
  expect(attempt.answers.find(answer => answer.questionId === 'q1').response).toBe('True');
  expect(attempt.answers.find(answer => answer.questionId === 'q2').response).toBe(' 9 ');
});

test('offline, a finished quiz waits on the device and says so', async () => {
  api.saveAttempt.mockResolvedValue({ queued: true });
  api.pendingAttempts.mockResolvedValue(1);
  render(<PracticeArena />);
  fireEvent.click(await screen.findByRole('button', { name: 'Play ▶' }));
  const dialog = screen.getByRole('dialog');
  fireEvent.click(within(dialog).getByRole('button', { name: /Build Your Own/ }));
  await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Start ▶' })); });
  for (let step = 0; step < 2; step += 1) {
    if (screen.queryByText('Two plus two is four.')) fireEvent.click(screen.getByRole('button', { name: /False/ }));
    else { fireEvent.change(screen.getByLabelText('Your answer'), { target: { value: '8' } }); fireEvent.click(screen.getByRole('button', { name: 'Check' })); }
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Next|See results/ })); });
  }
  expect(await screen.findByText(/Saved on this device/)).toBeTruthy();
  expect(screen.getByText('0 of 2 right')).toBeTruthy();
});

test('a locked subject sends the student to Passes, where examinations show what is ready and a mock can be started', async () => {
  const error = Object.assign(new Error('Your free subject this term is another one.'), { status: 402 });
  api.loadHome.mockResolvedValue({
    ...HOME, offline: false,
    subjects: [{ ...HOME.subjects[0], access: 'locked' }],
    levels: [{ key: 'simple', difficulty: 'simple', exam: '', label: 'Simple' }, { key: 'external:bece', difficulty: 'external', exam: 'bece', label: 'BECE (Junior WAEC)' }],
    passes: { freeSubject: 'english', freeChangesLeft: 1, allSubjects: false, subjects: [], exams: { bece: '2027-10-01T00:00:00Z' }, jambSubjects: [], list: [{ id: 'p1', bundle: 'bece', label: 'BECE Prep', expiresAt: '2027-10-01T00:00:00Z', subjects: [] }] },
    bundles: [{ key: 'subject', label: 'Subject Pass', priceNaira: 300, blurb: 'One more subject', exams: [], ready: true, stock: [] }, { key: 'bece', label: 'BECE Prep', priceNaira: 3000, blurb: 'BECE', exams: ['bece'], ready: true, stock: [] }],
    exams: { bece: { label: 'BECE (Junior WAEC)', mockQuestions: 50, mockMinutes: 60 } },
  });
  api.loadPack.mockRejectedValue(error);
  api.naira.mockImplementation(value => `₦${value}`);
  api.loadMock.mockResolvedValue({ minutes: 60, label: 'BECE (Junior WAEC)', pack: { subjectKey: 'mathematics', subjectName: 'Mathematics — BECE mock', questions: [PACK.questions[0]] } });
  render(<PracticeArena />);
  fireEvent.click(await screen.findByRole('button', { name: /Play/ }));
  fireEvent.click(screen.getByRole('button', { name: /Start/ }));
  expect(await screen.findByText(/Your free subject this term is another one/)).toBeTruthy();
  expect(screen.getByRole('tab', { name: /Passes/ }).getAttribute('aria-selected')).toBe('true');
  expect(screen.getByText(/BECE Prep · until/)).toBeTruthy();
  // The held examination offers a timed mock.
  fireEvent.change(screen.getByLabelText('BECE (Junior WAEC) mock subject'), { target: { value: 'mathematics' } });
  fireEvent.click(screen.getByRole('button', { name: /Start mock/ }));
  expect(api.loadMock).toHaveBeenCalledWith('bece', 'mathematics');
  expect(await screen.findByText('Two plus two is four.')).toBeTruthy();
});
