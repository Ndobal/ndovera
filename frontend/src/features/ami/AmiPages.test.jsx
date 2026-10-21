import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import AmiFinancePage from './AmiFinancePage';
import AmiOverview from './AmiOverview';
import AmiTenantGovernance from '../tenants/components/AmiTenantGovernance';
import { askConfirm } from '../../shared/components/AppDialog';
import { getAmiTenants, getAmiTermBills, getPlatformFinance, sendPlatformReminders } from '../tenants/services/tenantApi';

jest.mock('react-router-dom', () => ({
  Link: ({ to, children, className }) => <a href={to} className={className}>{children}</a>,
  useLocation: () => ({ pathname: '/roles/ami/finance', search: '' }),
}), { virtual: true });
jest.mock('../tenants/components/SchoolAccessPanel', () => () => <div>School access</div>);
jest.mock('../tenants/components/AmiPlatformAnalytics', () => () => <div>Analytics</div>);
jest.mock('../../shared/components/AppDialog', () => ({ askConfirm: jest.fn(() => Promise.resolve(true)), askText: jest.fn(() => Promise.resolve('ref')) }));
jest.mock('../tenants/services/tenantApi', () => new Proxy({}, { get: (target, key) => { if (!target[key]) target[key] = jest.fn(() => Promise.resolve({})); return target[key]; } }));

const month = new Date().toISOString().slice(0, 7);
const FINANCE = {
  success: true, canManage: true, generatedAt: new Date().toISOString(), categories: { expense: ['Hosting & infrastructure'], income: ['Other income'] },
  kpis: { collectedAllTime: 107500, collectedThisMonth: 107500, collectedThisYear: 107500, outstanding: 20000, overdue: 20000, schoolsOwing: 1, schoolsUnpaidThisTerm: 1, otherIncome: 0, expenses: 12000, partnerPayouts: 0, netAllTime: 95500, paymentsCount: 1 },
  monthly: Array.from({ length: 12 }, (_, index) => ({ month: index === 11 ? month : `2025-${String(index + 1).padStart(2, '0')}`, collected: index === 11 ? 107500 : 0, otherIncome: 0, expenses: index === 11 ? 12000 : 0, net: index === 11 ? 95500 : 0 })),
  schools: [
    { tenantId: 'school-b', schoolName: 'Bright Future Academy', ownerName: 'Mrs Owner', contactEmail: 'o@b.test', ownerPhone: '+2348031234567', status: 'active', logoUrl: '', currentTermFee: { status: 'overdue', term: 'First Term', session: '2026/2027' }, billed: 20000, paid: 0, outstanding: 20000, overdue: 20000, daysOverdue: 20, lastPayment: null, lastReminder: null },
    { tenantId: 'school-a', schoolName: 'Genesis International School', ownerName: 'Mr Owner', contactEmail: 'o@a.test', ownerPhone: '', status: 'active', logoUrl: '', currentTermFee: { status: 'paid', term: 'First Term', session: '2026/2027' }, billed: 107500, paid: 107500, outstanding: 0, overdue: 0, daysOverdue: 0, lastPayment: { at: new Date().toISOString(), amount: 107500, method: 'Flutterwave', recordedBy: 'Flutterwave — Mr Owner' }, lastReminder: null },
  ],
  payments: [{ id: 'p1', at: new Date().toISOString(), tenantId: 'school-a', schoolName: 'Genesis International School', amount: 107500, kind: 'Onboarding + term', period: 'First Term, 2026/2027', method: 'Flutterwave', reference: 'Flutterwave 777', recordedBy: 'Flutterwave — Mr Owner', receiptNo: 'RCT-1' }],
  payouts: [], ledger: [{ id: 'l1', kind: 'expense', category: 'Hosting & infrastructure', description: 'Cloudflare', amount: 12000, occurredOn: '2026-10-01', recordedBy: 'Ami' }], reminders: [],
};
const TENANTS = {
  summary: { totalTenants: 2, activeTenants: 2, pendingApproval: 0, pendingPayments: 0, termFeesUnpaid: 1, activeDiscountCodes: 0 },
  tenants: [
    { id: 'school-a', schoolName: 'Genesis International School', ownerName: 'Mr Owner', ownerEmail: 'o@a.test', requestedSubdomain: 'genesis', websiteDomain: 'genesis.ndovera.com', status: 'active', paymentStatus: 'paid', approvalStatus: 'approved', studentCount: 115, planKey: 'growth', studentFeePerTerm: 500, setupFee: 50000, currentTermFee: { status: 'paid', term: 'First Term', session: '2026/2027' }, createdAt: '2026-08-01' },
    { id: 'school-b', schoolName: 'Bright Future Academy', ownerName: 'Mrs Owner', ownerEmail: 'o@b.test', requestedSubdomain: 'bright', websiteDomain: 'bright.ndovera.com', status: 'active', paymentStatus: 'paid', approvalStatus: 'approved', studentCount: 40, planKey: 'growth', studentFeePerTerm: 500, setupFee: 50000, currentTermFee: { status: 'not_invoiced', term: 'First Term', session: '2026/2027' }, createdAt: '2026-09-01' },
  ],
  payments: [], discountCodes: [], tenantAwards: [],
};

beforeEach(() => {
  askConfirm.mockResolvedValue(true);
  getPlatformFinance.mockResolvedValue(FINANCE);
  getAmiTenants.mockResolvedValue(TENANTS);
  getAmiTermBills.mockResolvedValue({ bills: [] });
});

test('Finance: balances, payments with who paid, and reminders to chosen schools', async () => {
  sendPlatformReminders.mockResolvedValue({ results: [{ tenantId: 'school-b', schoolName: 'Bright Future Academy', sentTo: 'o@b.test' }], sent: 1 });
  render(<AmiFinancePage />);
  expect(await screen.findByText('Collected this year')).toBeTruthy();
  expect(screen.getByText('20 days overdue')).toBeTruthy();
  fireEvent.click(screen.getByText('Select all owing (1)'));
  fireEvent.click(screen.getByText('Email reminders (1)'));
  await waitFor(() => expect(sendPlatformReminders).toHaveBeenCalledWith({ tenantIds: ['school-b'], channel: 'email' }));
  expect(await screen.findByText(/Reminder emailed to 1 school/)).toBeTruthy();
  fireEvent.click(screen.getByRole('tab', { name: 'Payments received' }));
  expect(screen.getByText('Flutterwave — Mr Owner')).toBeTruthy();
  fireEvent.click(screen.getByRole('tab', { name: 'Money out' }));
  expect(screen.getByText('Cloudflare')).toBeTruthy();
  fireEvent.click(screen.getByText('Show as table'));
  expect(screen.getAllByText('Net').length).toBeGreaterThan(0);
});

test('Finance for shareholders is read-only', async () => {
  render(<AmiFinancePage readOnly />);
  expect(await screen.findByText('Collected this year')).toBeTruthy();
  expect(screen.queryByText(/Email reminders/)).toBeNull();
  expect(screen.queryByRole('tab', { name: 'Reminders sent' })).toBeNull();
});

test('Dashboard: stats, unpaid this term, latest payments', async () => {
  render(<AmiOverview />);
  expect(await screen.findByText('155')).toBeTruthy();
  const unpaid = screen.getByText('Unpaid this term').closest('section');
  expect(await within(unpaid).findByText('Bright Future Academy')).toBeTruthy();
  expect(screen.getByText('Latest payments')).toBeTruthy();
});

test('Schools: table with search, and Manage opens the school\'s controls', async () => {
  render(<AmiTenantGovernance sectionKey="tenants" />);
  expect(await screen.findByText('Genesis International School')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Search schools'), { target: { value: 'bright' } });
  expect(screen.queryByText('Genesis International School')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Manage' }));
  expect(await screen.findByRole('dialog', { name: 'Manage Bright Future Academy' })).toBeTruthy();
  expect(screen.getByText('Mark First Term Paid')).toBeTruthy();
});

test('Billing & Pricing has the pricing, term billing and discount panels', async () => {
  render(<AmiTenantGovernance sectionKey="billing" />);
  expect(await screen.findByText('Plan Pricing')).toBeTruthy();
  expect(screen.getByText('Term Billing')).toBeTruthy();
  expect(screen.getByText('Discount Codes')).toBeTruthy();
});
