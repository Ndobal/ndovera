import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import InvoicePayPage from './InvoicePayPage';
import { confirmInvoicePayment, getPublicInvoice, startInvoiceCheckout } from '../services/tenantApi';

let mockSearch = '';
jest.mock('react-router-dom', () => ({ useParams: () => ({ token: 'tok' }), useLocation: () => ({ search: mockSearch }) }), { virtual: true });
jest.mock('../services/tenantApi', () => ({ getPublicInvoice: jest.fn(), startInvoiceCheckout: jest.fn(), confirmInvoicePayment: jest.fn() }));

const invoice = {
  id: 'b1', invoiceNo: 'NDV-INV-202610-ABCD', schoolName: 'Genesis International School', session: '2026/2027', term: 'First Term', status: 'unpaid',
  amountCents: 10750000, dueAt: '2026-11-14T00:00:00Z', sentAt: '2026-10-15T00:00:00Z',
  lines: [
    { label: 'Onboarding fee', detail: 'One-time school set-up on Ndovera', amountCents: 5000000 },
    { label: 'Per-student charge', detail: 'First Term, 2026/2027 — active students', quantity: 115, unitCents: 50000, amountCents: 5750000 },
  ],
};

const renderAt = path => { mockSearch = path.includes('?') ? path.slice(path.indexOf('?')) : ''; return render(<InvoicePayPage />); };

beforeEach(() => jest.clearAllMocks());

test('shows the invoice on the Ndovera letterhead with the total and a pay button', async () => {
  getPublicInvoice.mockResolvedValue({ success: true, invoice });
  renderAt('/invoice/tok');
  expect(await screen.findByText('Genesis International School')).toBeTruthy();
  expect(screen.getAllByText(/support@ndovera\.com/).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/\+234 812 888 2800/).length).toBeGreaterThan(0);
  expect(screen.getByText('INVOICE')).toBeTruthy();
  expect(screen.getByText(/One Hundred Seven Thousand Five Hundred Naira Only/)).toBeTruthy();
  expect(screen.getByRole('button', { name: /Pay ₦107,500\.00 now/ })).toBeTruthy();
  expect(startInvoiceCheckout).not.toHaveBeenCalled();
});

test('back from Flutterwave it confirms the payment and shows the receipt', async () => {
  confirmInvoicePayment.mockResolvedValue({ success: true, paid: true, invoice: { ...invoice, status: 'paid', receiptNo: 'NDV-RCT-202610-WXYZ', paidAt: '2026-10-16T00:00:00Z' } });
  renderAt('/invoice/tok?payment_ref=nbill_b1_abc');
  await waitFor(() => expect(confirmInvoicePayment).toHaveBeenCalledWith('tok', 'nbill_b1_abc'));
  expect(await screen.findByText('OFFICIAL PAYMENT RECEIPT')).toBeTruthy();
  expect(screen.getByText(/receipt has been emailed/)).toBeTruthy();
  expect(screen.queryByRole('button', { name: /Pay .* now/ })).toBeNull();
});
