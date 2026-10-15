import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import SchoolAccessPanel from './SchoolAccessPanel';
import { getPlatformAnalytics, getSchoolAccessGrants, requestSchoolAccess } from '../services/tenantApi';

jest.mock('../services/tenantApi', () => ({
  getPlatformAnalytics: jest.fn(), getSchoolAccessGrants: jest.fn(), requestSchoolAccess: jest.fn(),
  openSchoolAccess: jest.fn(), revokeSchoolAccessGrant: jest.fn(), completeSchoolAccess: jest.fn(),
}));
jest.mock('../../auth/services/authApi', () => ({ getStoredAuth: jest.fn(), persistAuth: jest.fn() }));

beforeEach(() => {
  jest.clearAllMocks();
  getPlatformAnalytics.mockResolvedValue({ schools: [{ tenantId: 't1', schoolName: 'Genesis International School' }] });
  getSchoolAccessGrants.mockResolvedValue({ grants: [{ id: 'g0', tenantId: 't1', reason: 'Fix fees', status: 'approved', active: true, expiresAt: '2999-01-01T00:00:00Z' }] });
  requestSchoolAccess.mockResolvedValue({ success: true });
});

test('Ami asks a school owner for access with what she needs to do and for how long', async () => {
  render(<SchoolAccessPanel />);
  expect(await screen.findByRole('button', { name: 'Open school' })).toBeTruthy();
  fireEvent.change(screen.getByLabelText(/School/), { target: { value: 't1' } });
  fireEvent.change(screen.getByPlaceholderText('e.g. Set up classes and import students'), { target: { value: 'Import students' } });
  fireEvent.change(screen.getByLabelText(/^For/), { target: { value: '8' } });
  fireEvent.click(screen.getByRole('button', { name: 'Request access' }));
  await waitFor(() => expect(requestSchoolAccess).toHaveBeenCalledWith('t1', 'Import students', 8));
  expect(await screen.findByText(/Request sent to the owner of Genesis International School/)).toBeTruthy();
});
