import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import TeacherPayslip from './TeacherPayslip';
import { getMyBankDetails, getMyPayslip, getWebsiteSections } from '../../../features/school/services/schoolApi';

jest.mock('../../../features/school/services/schoolApi', () => ({ getMyPayslip: jest.fn(), getMyBankDetails: jest.fn(), saveMyBankDetails: jest.fn(), getWebsiteSections: jest.fn() }));
jest.mock('jspdf', () => ({ jsPDF: jest.fn() }));
jest.mock('html2canvas', () => jest.fn());

const AVAILABLE = [['2026-10', 130000], ['2026-09', 120000], ['2026-08', 110000], ['2025-12', 90000]].map(([period, net]) => ({ period, net }));

beforeEach(() => {
  jest.clearAllMocks();
  getWebsiteSections.mockResolvedValue({ sections: [] });
  getMyBankDetails.mockResolvedValue({ details: { bankName: '', accountName: '', accountNumber: '' } });
  getMyPayslip.mockImplementation(async period => ({ success: true, period: period || '2026-10', available: AVAILABLE, payslip: { name: 'Tola Ade', period: period || '2026-10', gross: 1000, deductions: 0, net: 1000 } }));
});

async function open() {
  render(<TeacherPayslip auth={{ user: { name: 'Tola Ade', role: 'teacher' } }} />);
  await screen.findByRole('button', { name: /Print/ });
}

test('the latest payslip opens first, with account details on their own tab', async () => {
  await open();
  expect(screen.getByRole('tab', { name: 'Latest payslip' })).toHaveAttribute('aria-selected', 'true');
  expect(screen.queryByRole('textbox', { name: 'Account number' })).not.toBeInTheDocument();
  expect(getMyBankDetails).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('tab', { name: 'Account details' }));
  expect(await screen.findByRole('textbox', { name: 'Account number' })).toBeInTheDocument();
});

test('previous payslips are by year, then month, all closed, and a month loads only when opened', async () => {
  await open();
  fireEvent.click(screen.getByRole('tab', { name: 'Previous payslips' }));
  const year2026 = screen.getByRole('button', { name: /^2026/ });
  const year2025 = screen.getByRole('button', { name: /^2025/ });
  expect(year2026).toHaveAttribute('aria-expanded', 'false');
  expect(year2025).toHaveAttribute('aria-expanded', 'false');
  expect(screen.queryByRole('button', { name: /September 2026/ })).not.toBeInTheDocument();
  expect(year2026).toHaveTextContent('2 payslips');
  expect(screen.queryByRole('button', { name: /October 2026/ })).not.toBeInTheDocument();
  expect(getMyPayslip).toHaveBeenCalledTimes(1);

  fireEvent.click(year2026);
  const september = screen.getByRole('button', { name: /September 2026/ });
  expect(september).toHaveAttribute('aria-expanded', 'false');
  expect(screen.queryByRole('button', { name: /October 2026/ })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /December 2025/ })).not.toBeInTheDocument();
  const order = screen.getAllByRole('button', { name: /2026/ }).map(button => button.textContent);
  expect(order[1]).toContain('September');
  expect(order[2]).toContain('August');
  expect(getMyPayslip).toHaveBeenCalledTimes(1);

  fireEvent.click(september);
  await waitFor(() => expect(getMyPayslip).toHaveBeenCalledWith('2026-09'));
  fireEvent.click(september);
  expect(september).toHaveAttribute('aria-expanded', 'false');
});

test('with only one payslip, the previous tab says so', async () => {
  getMyPayslip.mockResolvedValue({ success: true, period: '2026-10', available: [AVAILABLE[0]], payslip: { name: 'Tola', period: '2026-10', gross: 1, deductions: 0, net: 1 } });
  await open();
  fireEvent.click(screen.getByRole('tab', { name: 'Previous payslips' }));
  expect(screen.getByText(/no earlier payslips/)).toBeInTheDocument();
});
