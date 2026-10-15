import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { ReadAloudPlayer, isQuietPlace, readAloud } from './ReadAloud';

beforeEach(() => {
  window.SpeechSynthesisUtterance = function Utterance(text) { this.text = text; };
  window.speechSynthesis = { speak: jest.fn(), cancel: jest.fn(), pause: jest.fn(), resume: jest.fn(), getVoices: () => [] };
});

test('practice, assignments and exams are quiet places', () => {
  expect(isQuietPlace('/roles/student/practice')).toBe(true);
  expect(isQuietPlace('/roles/student/assignments')).toBe(true);
  expect(isQuietPlace('/roles/student/exams/123')).toBe(true);
  expect(isQuietPlace('/roles/student/classroom', '?tab=assignments')).toBe(true);
  expect(isQuietPlace('/roles/student/offline-notes')).toBe(false);
  expect(isQuietPlace('/roles/student/classroom', '?tab=stream')).toBe(false);
});

test('reading carries on across pages with a floating player, and stops on entering an exam', () => {
  const { rerender } = render(<ReadAloudPlayer pathname="/roles/student/timetable" search="" />);
  act(() => { readAloud.start({ chunks: ['First sentence.', 'Second sentence.'], title: 'Photosynthesis', source: 'note:1', href: '/roles/student/offline-notes' }); });
  expect(screen.getByRole('region', { name: 'Reading aloud' })).toBeTruthy();
  expect(screen.getByText('Photosynthesis')).toBeTruthy();
  expect(window.speechSynthesis.speak).toHaveBeenCalledTimes(1);
  // Moving to another ordinary page: still reading.
  rerender(<ReadAloudPlayer pathname="/roles/student/results" search="" />);
  expect(screen.getByRole('region', { name: 'Reading aloud' })).toBeTruthy();
  // Opening an exam: reading stops, and the student is told why.
  rerender(<ReadAloudPlayer pathname="/roles/student/exams" search="" />);
  expect(window.speechSynthesis.cancel).toHaveBeenCalled();
  expect(screen.getByRole('status').textContent).toMatch(/Reading stopped/);
  expect(screen.queryByRole('region', { name: 'Reading aloud' })).toBeNull();
});
