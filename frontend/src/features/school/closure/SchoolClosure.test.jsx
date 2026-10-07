import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { ClosureGate, formatCountdown } from './SchoolClosure';

function mockStatus(body) {
  global.fetch = jest.fn(() => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ success: true, ...body }) }));
}

afterEach(() => { delete global.fetch; });

test('a closed school sees only the closed notice', async () => {
  mockStatus({ closed: true, schoolName: 'Genesis International School', closure: { status: 'executed' } });
  render(<ClosureGate role="teacher"><p>Dashboard content</p></ClosureGate>);
  expect(await screen.findByText('Genesis International School has closed')).toBeTruthy();
  expect(screen.queryByText('Dashboard content')).toBeNull();
});

test('the owner sees the countdown while a closure is pending; students do not', async () => {
  const effectiveAt = new Date(Date.now() + 50 * 3600000).toISOString();
  mockStatus({ closed: false, closure: { status: 'pending', effectiveAt } });
  const { unmount } = render(<ClosureGate role="owner"><p>Dashboard content</p></ClosureGate>);
  expect(await screen.findByText(/scheduled to close in/)).toBeTruthy();
  expect(screen.getByText('Review or revoke')).toBeTruthy();
  expect(screen.getByText('Dashboard content')).toBeTruthy();
  unmount();
  mockStatus({ closed: false, closure: { status: 'pending', effectiveAt } });
  render(<ClosureGate role="student"><p>Dashboard content</p></ClosureGate>);
  await waitFor(() => expect(global.fetch).toHaveBeenCalled());
  expect(screen.queryByText(/scheduled to close/)).toBeNull();
});

test('Ndovera admins never trigger the school check', () => {
  mockStatus({ closed: true });
  render(<ClosureGate role="ami"><p>Ami content</p></ClosureGate>);
  expect(global.fetch).not.toHaveBeenCalled();
  expect(screen.getByText('Ami content')).toBeTruthy();
});

test('countdown format', () => {
  expect(formatCountdown(72 * 3600000)).toBe('3d 00h 00m 00s');
  expect(formatCountdown(3725000)).toBe('01h 02m 05s');
  expect(formatCountdown(-5)).toBe('00h 00m 00s');
});
