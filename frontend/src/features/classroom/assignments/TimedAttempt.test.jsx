import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { CountdownBar, useTimedAttempt } from './TimedAttempt';
import { startAssignment } from '../classroomService';

jest.mock('../classroomService', () => ({ startAssignment: jest.fn() }));

function Harness({ assignment, onTimeUp }) {
  const attempt = useTimedAttempt(assignment, { onTimeUp });
  return <><CountdownBar attempt={attempt} /><p>{attempt.ready ? 'questions visible' : 'questions hidden'}</p></>;
}

afterEach(() => { jest.useRealTimers(); jest.clearAllMocks(); });

test('untimed work does not start a clock', () => {
  render(<Harness assignment={{ id: 'a', metadata: {} }} />);
  expect(startAssignment).not.toHaveBeenCalled();
  expect(screen.getByText('questions visible')).toBeTruthy();
});

test('timed work starts on the server clock, counts down and submits at zero', async () => {
  jest.useFakeTimers();
  const now = Date.now();
  // The device clock is 10 minutes slow; the countdown follows the server.
  startAssignment.mockResolvedValue({ success: true, timed: true, startedAt: new Date(now + 600000).toISOString(), deadline: new Date(now + 600000 + 3000).toISOString(), serverNow: new Date(now + 600000).toISOString() });
  const onTimeUp = jest.fn();
  render(<Harness assignment={{ id: 'a', metadata: { durationMinutes: 1 } }} onTimeUp={onTimeUp} />);
  expect(screen.getByText('questions hidden')).toBeTruthy();
  await act(async () => { await Promise.resolve(); });
  expect(startAssignment).toHaveBeenCalledWith('a');
  expect(screen.getByText('questions visible')).toBeTruthy();
  expect(screen.getByRole('timer').textContent).toMatch(/0:0[23]/);
  await act(async () => { jest.advanceTimersByTime(4000); });
  expect(onTimeUp).toHaveBeenCalledTimes(1);
  await act(async () => { jest.advanceTimersByTime(4000); });
  expect(onTimeUp).toHaveBeenCalledTimes(1);
});

test('a refused start (closed, attempts used) is shown, and the questions stay hidden', async () => {
  startAssignment.mockResolvedValue({ success: false, message: 'You have used all 1 attempt.' });
  render(<Harness assignment={{ id: 'a', metadata: { durationMinutes: 5 } }} />);
  expect(await screen.findByText('You have used all 1 attempt.')).toBeTruthy();
  expect(screen.getByText('questions hidden')).toBeTruthy();
});
