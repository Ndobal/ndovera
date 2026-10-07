import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import StaffFilePage from './StaffFilePage';
import * as api from './staffFileApi';

jest.mock('./staffFileApi');
jest.mock('../compliance/complianceApi', () => ({ uploadComplianceFile: jest.fn() }));
jest.mock('../../app/roles/student/StudentSectionShell', () => ({ title, children }) => <div><h1>{title}</h1>{children}</div>);
// This project's Jest cannot resolve React Router 7, so the pieces the page uses are stood in.
jest.mock('react-router-dom', () => ({
  Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>,
  useLocation: () => ({ pathname: '/roles/teacher/staff/me' }),
  useParams: () => ({ staffId: 'me' }),
}), { virtual: true });

const SELF_PERMISSIONS = { view: true, loans: true, manageLoans: false, applyForLoan: true, tasks: true, assignTasks: false, reviews: true, writeReviews: false, reports: true, investigateReports: false, rewards: true, giveRewards: false, submissions: true, attendance: true, payroll: true };

function fileFor(permissions) {
  return {
    profile: { id: 't-james', name: 'Sarah James', roles: ['teacher'], displayId: 'GIS-0042', avatar: '', status: 'active', position: 'Mathematics Teacher', employedOn: '2022-09-05' },
    sections: ['secondary'], teaching: [{ role: 'subject', classId: 'jss1', className: 'JSS 1', subjectName: 'Mathematics' }], permissions,
    overview: { submissions: { done: 4, total: 5 }, attendanceRate: 100, openTasks: 2, latestReview: { periodLabel: 'Term 1', overall: 86 }, loanOutstanding: permissions.loans ? 150000 : null, rewards: 4, badges: [{ badge: '🏆', title: 'Outstanding Teacher' }] },
    attention: [{ level: 'red', text: 'Exam Questions — JSS 2 Mathematics missing' }, { level: 'yellow', text: 'Loan LN-0042 — instalment awaiting payment confirmation' }],
    activity: [{ at: '2026-10-06T10:00:00Z', text: 'Loan repayment of ₦50,000 confirmed' }],
  };
}

beforeEach(() => jest.clearAllMocks());

test('a teacher\'s own file: this week, what needs attention, and only the tabs they may open', async () => {
  api.getStaffFile.mockResolvedValue(fileFor(SELF_PERMISSIONS));
  render(<StaffFilePage />);
  expect(await screen.findByText('4/5')).toBeTruthy();
  expect(screen.getByText('₦150,000')).toBeTruthy();
  expect(screen.getByText(/JSS 2 Mathematics missing/)).toBeTruthy();
  expect(screen.getByText(/Loan repayment of ₦50,000 confirmed/)).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Loans' })).toBeTruthy();
  expect(api.getStaffFile).toHaveBeenCalledWith('me');
});

test('a section head does not get the Loans or Payroll tabs', async () => {
  api.getStaffFile.mockResolvedValue(fileFor({ ...SELF_PERMISSIONS, loans: false, payroll: false, applyForLoan: false, assignTasks: true, giveRewards: true }));
  render(<StaffFilePage />);
  await screen.findByText('4/5');
  expect(screen.queryByRole('button', { name: 'Loans' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Payroll' })).toBeNull();
  expect(screen.queryByText('Loan balance')).toBeNull();
});

test('the borrower reports a payment, which then waits for confirmation', async () => {
  api.getStaffFile.mockResolvedValue(fileFor(SELF_PERMISSIONS));
  const loan = { id: 'loan-1', number: 'LN-0042', status: 'active', principal: 300000, totalPaid: 150000, outstanding: 150000, awaitingConfirmation: 0, monthlyInstalment: 50000, nextPaymentOn: '2026-10-30', purpose: 'Rent', source: 'application', transactions: [], adjusted: 0, waived: 0 };
  api.getStaffLoans.mockResolvedValue({ loans: [loan], canManage: false, canApply: true });
  api.addStaffLoanPayment.mockResolvedValue({ loan: { ...loan, awaitingConfirmation: 50000 } });
  render(<StaffFilePage />);
  fireEvent.click(await screen.findByRole('button', { name: 'Loans' }));
  expect(await screen.findByText(/Staff Loan #LN-0042/)).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '50000' } });
  fireEvent.click(screen.getByRole('button', { name: 'I have paid' }));
  await waitFor(() => expect(api.addStaffLoanPayment).toHaveBeenCalledWith('loan-1', { amount: '50000', paidOn: '', proof: [] }));
  expect(await screen.findByText('Payment reported — waiting for confirmation.')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Confirm' })).toBeNull();
});
