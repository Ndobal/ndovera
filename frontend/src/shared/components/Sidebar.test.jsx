import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import Sidebar from './Sidebar';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: '/roles/owner', search: '' }),
  useNavigate: () => mockNavigate,
  NavLink: ({ to, children, className }) => <a href={to} className={typeof className === 'function' ? className({ isActive: false }) : className}>{children}</a>,
}), { virtual: true });
jest.mock('../hooks/useFeatureFlags', () => () => ({ featureFlags: { aurasEnabled: true, farmingModeEnabled: true } }));
jest.mock('../hooks/useTenantPwaManifest', () => ({ getTenantPwaInfo: () => null }));
jest.mock('../../features/submissions/StaffSubmissionPanel', () => () => null);

test('the sidebar search finds a Settings section and Enter opens it', () => {
  render(<Sidebar />);
  const box = screen.getByRole('searchbox', { name: 'Search the app', hidden: true });
  fireEvent.change(box, { target: { value: 'unplaced students' } });
  expect(screen.getByRole('button', { name: /Settings › Class Register/, hidden: true })).toBeTruthy();
  fireEvent.keyDown(box, { key: 'Enter' });
  expect(mockNavigate).toHaveBeenCalledWith('/roles/owner/settings?tab=Class%20Register');
  // Searching "receipt" finds the Finance page from its everyday words too.
  fireEvent.change(box, { target: { value: 'receipt' } });
  expect(screen.getByRole('button', { name: /Finance/, hidden: true })).toBeTruthy();
  // "/" jumps to the search box.
  box.blur();
  fireEvent.keyDown(window, { key: '/' });
  expect(document.activeElement).toBe(box);
});
