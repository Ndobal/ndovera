import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import ClubsPage from './ClubsPage';
import * as api from './clubsApi';

jest.mock('./clubsApi', () => {
  const actual = jest.requireActual('./clubsApi');
  return { ...actual, listClubs: jest.fn(), getClub: jest.fn(), submitWork: jest.fn(), createPost: jest.fn(), createClub: jest.fn() };
});
jest.mock('../classroom/classroomService', () => ({ getAssignedClasses: jest.fn().mockResolvedValue({ classes: [] }) }));
jest.mock('../../shared/rich/RichContent', () => ({ text }) => <div>{text}</div>);

const club = { id: 'club_1', name: 'Press Club', category: 'Arts & Culture', meeting: 'Wednesdays', description: 'News and writing', status: 'active', members: 2, patrons: 1, posts: 2, myRole: 'member' };
const quiz = { id: 'p_quiz', kind: 'quiz', title: 'Newsroom quiz', body: '', url: '', embedUrl: '', files: [], dueAt: null, maxScore: 2, createdByName: 'Mr Art', createdAt: '2026-10-14T09:00:00Z',
  questions: [{ id: 'q1', type: 'mcq', prompt: 'Who edits a newspaper?', options: ['Editor', 'Printer'], marks: 1 }, { id: 'q2', type: 'short', prompt: 'Capital of Nigeria?', options: [], marks: 1 }] };
const note = { id: 'p_note', kind: 'note', title: 'Headlines', body: 'Short and active.', url: '', embedUrl: '', files: [], createdByName: 'Mr Art', createdAt: '2026-10-14T08:00:00Z', questions: [] };

beforeEach(() => {
  window.confirm = jest.fn(() => true);
  api.listClubs.mockResolvedValue({ clubs: [club], categories: ['Arts & Culture', 'Other'], canCreate: false, isManager: false });
  api.getClub.mockResolvedValue({ club, canManage: false, myRole: 'member', members: [{ userId: 's1', name: 'Ada', role: 'member' }], posts: [quiz, note], work: {} });
});

test('a student opens their club, reads a note, and takes a quiz that is marked at once', async () => {
  render(<ClubsPage />);
  fireEvent.click(await screen.findByRole('button', { name: /Press Club/ }));
  expect(await screen.findByRole('heading', { name: 'Press Club' })).toBeTruthy();
  expect(screen.getByText('Short and active.')).toBeTruthy();
  expect(screen.queryByRole('region', { name: 'Share with the club' })).toBeNull(); // students do not post

  api.submitWork.mockResolvedValue({ submission: { score: 2, total: 2, review: [{ questionId: 'q1', given: 0, correct: true, answer: 0 }, { questionId: 'q2', given: 'Abuja', correct: true, answer: 'Abuja' }] } });
  fireEvent.click(screen.getByRole('button', { name: /Take the quiz/ }));
  fireEvent.click(screen.getByLabelText('Editor'));
  fireEvent.change(screen.getByLabelText('Answer to question 2'), { target: { value: 'Abuja' } });
  fireEvent.click(screen.getByRole('button', { name: 'Hand in' }));
  await waitFor(() => expect(api.submitWork).toHaveBeenCalledWith('club_1', 'p_quiz', { answers: { q1: 0, q2: 'Abuja' } }));
  expect(await screen.findByText('You scored 2 / 2')).toBeTruthy();
});

test('a patron shares a note with the club', async () => {
  api.getClub.mockResolvedValue({ club, canManage: true, myRole: 'patron', members: [], posts: [], work: {} });
  api.createPost.mockResolvedValue({ post: note });
  render(<ClubsPage />);
  fireEvent.click(await screen.findByRole('button', { name: /Press Club/ }));
  const share = await screen.findByRole('region', { name: 'Share with the club' });
  fireEvent.click(within(share).getByRole('button', { name: /Note/ }));
  fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Headlines' } });
  fireEvent.change(screen.getByLabelText(/The note/), { target: { value: '# Headlines' } });
  fireEvent.click(screen.getByRole('button', { name: 'Post to the club' }));
  await waitFor(() => expect(api.createPost).toHaveBeenCalledWith('club_1', expect.objectContaining({ kind: 'note', title: 'Headlines', body: '# Headlines' })));
  expect(await screen.findByText('Posted to the club.')).toBeTruthy();
});
