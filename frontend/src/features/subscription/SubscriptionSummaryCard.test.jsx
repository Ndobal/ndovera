import React from 'react';
import { render, screen } from '@testing-library/react';
import SubscriptionSummaryCard from './SubscriptionSummaryCard';
import { getMyTermBills } from '../tenants/services/tenantApi';

jest.mock('react-router-dom', () => ({ Link: ({ to, children, className }) => <a href={to} className={className}>{children}</a>, useLocation: () => ({ pathname: '/roles/owner' }) }), { virtual: true });
jest.mock('../tenants/services/tenantApi', () => ({ getMyTermBills: jest.fn() }));
jest.mock('../school/services/schoolApi', () => ({ getMyTenant: jest.fn() }));

test('shows the balance due with Pay now and More', async () => {
  getMyTermBills.mockResolvedValue({ bills: [
    { id: 'a', status: 'unpaid', amount: 107500, graceUntil: '2999-11-14T00:00:00Z', payUrl: 'https://ndovera.com/invoice/tok' },
    { id: 'b', status: 'paid', amount: 20000 },
  ] });
  render(<SubscriptionSummaryCard role="hos" />);
  expect(await screen.findByText(/₦107,500\.00 due/)).toBeTruthy();
  expect(screen.getByText('Pay now').getAttribute('href')).toBe('https://ndovera.com/invoice/tok');
  expect(screen.getByText('More').getAttribute('href')).toBe('/roles/hos/subscription');
});

test('says all paid when nothing is outstanding, and still links to More', async () => {
  getMyTermBills.mockResolvedValue({ bills: [{ id: 'b', status: 'paid', amount: 20000 }] });
  render(<SubscriptionSummaryCard />);
  expect(await screen.findByText('All paid')).toBeTruthy();
  expect(screen.queryByText('Pay now')).toBeNull();
  expect(screen.getByText('More').getAttribute('href')).toBe('/roles/owner/subscription');
});
