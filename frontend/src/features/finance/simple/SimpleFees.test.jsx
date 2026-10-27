import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { bulkEdit, previewChanges, rowTotal } from './simpleFeesApi';
import FeeSetup from './FeeSetup';
import { QuickPayCell, RecordPaymentDialog } from './StudentAccounts';
import * as api from './simpleFeesApi';

jest.mock('./simpleFeesApi', () => {
  const actual = jest.requireActual('./simpleFeesApi');
  return { ...actual, getTermGrid: jest.fn(), getSavedTemplate: jest.fn(), getFeeSource: jest.fn(), saveTermGrid: jest.fn(), lockTermFees: jest.fn(), recordSimplePayment: jest.fn(), listAccounts: jest.fn() };
});

const rows = [
  { classId: 'n1', className: 'Nursery 1', amounts: { Tuition: 80000, Books: 10000 } },
  { classId: 'p1', className: 'Primary 1', amounts: { Tuition: 100000, Books: 15000 } },
];

test('Edit All: same amount, increase or reduce by a percentage — with a preview of each change', () => {
  expect(bulkEdit(rows, 'Tuition', 'increase', 10).map(row => row.amounts.Tuition)).toEqual([88000, 110000]);
  expect(bulkEdit(rows, 'Tuition', 'reduce', 5).map(row => row.amounts.Tuition)).toEqual([76000, 95000]);
  expect(bulkEdit(rows, 'Books', 'same', 12000).map(row => row.amounts.Books)).toEqual([12000, 12000]);
  expect(rows[0].amounts.Tuition).toBe(80000); // nothing changes until applied
  expect(previewChanges(rows, bulkEdit(rows, 'Tuition', 'increase', 10), 'Tuition')).toEqual([{ className: 'Nursery 1', from: 80000, to: 88000 }, { className: 'Primary 1', from: 100000, to: 110000 }]);
  expect(rowTotal(rows[1], [{ name: 'Tuition' }, { name: 'Books' }])).toBe(115000);
});

const term = { id: 't2', name: 'Second Term', sessionName: '2026/2027' };
const emptyGrid = { grid: { term, columns: [], rows: rows.map(row => ({ ...row, amounts: {} })), configured: false, lock: { locked: false }, billedStudents: 0 }, terms: [{ id: 't2', name: 'Second Term', sessionName: '2026/2027' }], settings: { editors: ['owner'] }, canEditFees: true };
const lastTerm = { grid: { term: { id: 't1', name: 'First Term', sessionName: '2026/2027' }, columns: [{ name: 'Tuition', required: true, frequency: 'term' }, { name: 'Books', required: true, frequency: 'term' }], rows, configured: true, lock: { locked: true }, billedStudents: 2 } };

test('reuse last term: both tables arrive exactly as they were, +10% with preview, debts written off, then Save as draft', async () => {
  api.getTermGrid.mockResolvedValue({ ...emptyGrid, students: [{ studentId: 'ada', studentName: 'Ada Obi', classId: 'p1', className: 'Primary 1' }], earlierDebts: { students: 3, total: 90000 } });
  api.getFeeSource.mockResolvedValue({
    found: true, label: '2025/2026 Third Term', columns: lastTerm.grid.columns, rows: rows.map(({ classId, amounts }) => ({ classId, amounts })),
    students: [{ studentId: 'ada', studentName: 'Ada Obi', amounts: { Tuition: 60000 } }], leftOut: 1,
  });
  api.saveTermGrid.mockResolvedValue({ saved: 2, adjusted: 0 });
  render(<FeeSetup initialTermId="t2" initialSource={{ type: 'reuse', termId: 't1' }} canEdit />);
  expect(await screen.findByText(/Copied 2025\/2026 Third Term exactly: class fees and 1 student who pays differently, set by class/)).toBeTruthy();
  expect(api.getFeeSource).toHaveBeenCalledWith('t2', 't1');
  expect(screen.getByLabelText('Primary 1 Tuition').value).toBe('100000');
  expect(screen.getByText('₦115,000')).toBeTruthy(); // row total
  // Ada pays her own tuition; her books follow the class (shown faintly).
  expect(screen.getByLabelText('Ada Obi Tuition').value).toBe('60000');
  expect(screen.getByLabelText('Ada Obi Books').placeholder).toBe('15000');
  expect(screen.getByText('₦75,000')).toBeTruthy();
  fireEvent.click(screen.getByLabelText(/Write off outstanding debts/));

  fireEvent.click(screen.getByRole('button', { name: /Tuition/ }));
  const dialog = screen.getByRole('dialog', { name: 'Edit Tuition' });
  fireEvent.change(within(dialog).getByRole('spinbutton'), { target: { value: '10' } });
  expect(within(dialog).getByText('Preview')).toBeTruthy();
  expect(within(dialog).getByText('₦110,000')).toBeTruthy();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Apply' }));
  expect(screen.getByLabelText('Primary 1 Tuition').value).toBe('110000');

  fireEvent.click(screen.getByRole('button', { name: 'Save draft now' }));
  await waitFor(() => expect(api.saveTermGrid).toHaveBeenCalled());
  const payload = api.saveTermGrid.mock.calls[0][0];
  expect(payload.action).toBe('draft');
  expect(payload.termId).toBe('t2');
  expect(payload.rows.find(row => row.classId === 'p1').amounts).toEqual({ Tuition: 110000, Books: 15000 });
  expect(payload.students).toEqual([{ studentId: 'ada', studentName: 'Ada Obi', amounts: { Tuition: 60000 } }]);
  expect(payload.debtMode).toBe('write_off');
  expect(payload.feeMode).toBe('class');
});

test('reuse brings the term\'s settings, and students new since then are listed for their fees; by student, nobody pays the class row', async () => {
  const register = [
    { studentId: 'ada', studentName: 'Ada Obi', classId: 'p1', className: 'Primary 1' },
    { studentId: 'kene', studentName: 'Kene Ude', classId: 'n1', className: 'Nursery 1' },
  ];
  api.getTermGrid.mockResolvedValue({ ...emptyGrid, students: register, earlierDebts: { students: 0, total: 0 } });
  api.getFeeSource.mockResolvedValue({
    found: true, label: '2025/2026 Third Term', feeMode: 'student', columns: lastTerm.grid.columns, rows: rows.map(({ classId, amounts }) => ({ classId, amounts })),
    students: [{ studentId: 'ada', studentName: 'Ada Obi', amounts: { Tuition: 90000 } }], newStudents: [register[1]], leftOut: 0,
  });
  api.saveTermGrid.mockClear().mockResolvedValue({ saved: 2, adjusted: 0 });
  render(<FeeSetup initialTermId="t2" initialSource={{ type: 'reuse', termId: 't1' }} canEdit />);
  expect(await screen.findByText(/set for each student/)).toBeTruthy();
  expect(screen.getByRole('tab', { name: 'Individual student fees' }).getAttribute('aria-selected')).toBe('true');
  expect(screen.queryByLabelText('Primary 1 Tuition')).toBeNull(); // the class table is hidden on this tab
  expect(screen.getByText('NEW')).toBeTruthy();
  // By student the class row is not a fallback: Kene starts with nothing.
  expect(screen.getByLabelText('Kene Ude Tuition').placeholder).toBe('—');
  fireEvent.click(screen.getByRole('button', { name: /Fill empty cells from class fees/ }));
  expect(screen.getByLabelText('Kene Ude Tuition').value).toBe('80000');
  expect(screen.getByLabelText('Ada Obi Tuition').value).toBe('90000'); // filled cells are kept
  fireEvent.click(screen.getByRole('button', { name: /^Publish Second Term fees/ }));
  await waitFor(() => expect(api.saveTermGrid).toHaveBeenCalled());
  const payload = api.saveTermGrid.mock.calls[0][0];
  expect(payload.action).toBe('publish');
  expect(payload.feeMode).toBe('student');
  expect(payload.students.find(student => student.studentId === 'kene').amounts).toEqual({ Tuition: 80000, Books: 10000 });
});

test('changing fees after billing asks what should happen to students already billed', async () => {
  const configured = { ...emptyGrid, grid: { ...lastTerm.grid, term, lock: { locked: false } } };
  api.getTermGrid.mockResolvedValue(configured);
  const decision = Object.assign(new Error('426 students have already been billed.'), { status: 409, data: { needsDecision: true, affectedStudents: 426, changes: [{ className: 'Primary 1', item: 'Tuition', from: 150000, to: 160000, students: 426 }] } });
  api.saveTermGrid.mockRejectedValueOnce(decision).mockResolvedValueOnce({ saved: 2, adjusted: 426 });
  render(<FeeSetup initialTermId="t2" canEdit />);
  fireEvent.change(await screen.findByLabelText('Primary 1 Tuition'), { target: { value: '160000' } });
  fireEvent.click(screen.getByRole('button', { name: /^Publish Second Term fees/ }));
  const dialog = await screen.findByRole('dialog', { name: 'Students already billed' });
  expect(within(dialog).getByText(/426 students have already been billed/)).toBeTruthy();
  fireEvent.click(within(dialog).getByRole('button', { name: /Apply the difference/ }));
  await waitFor(() => expect(api.saveTermGrid).toHaveBeenLastCalledWith(expect.objectContaining({ action: 'publish', changeMode: 'adjust_existing' })));
  expect(await screen.findByText(/426 existing charge\(s\) adjusted/)).toBeTruthy();
});

test('published fees stay editable: change, save a draft, publish later', async () => {
  api.getTermGrid.mockResolvedValue({ ...emptyGrid, grid: { ...lastTerm.grid, term, lock: { locked: true } } });
  api.saveTermGrid.mockClear().mockResolvedValue({ draft: { savedAt: '2026-10-14T09:00:00.000Z', savedBy: 'OWN' } });
  render(<FeeSetup initialTermId="t2" canEdit />);
  const cell = await screen.findByLabelText('Primary 1 Tuition');
  expect(cell.disabled).toBe(false);
  expect(screen.getByText('Published')).toBeTruthy();
  expect(screen.getByRole('button', { name: /Publish changes/ }).disabled).toBe(true); // nothing changed yet
  fireEvent.change(cell, { target: { value: '120000' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save draft now' }));
  expect(await screen.findByText(/Saved as a draft\. Nobody has been billed/)).toBeTruthy();
  expect(api.saveTermGrid).toHaveBeenCalledWith(expect.objectContaining({ action: 'draft' }));
  expect(screen.getByRole('button', { name: /Publish changes/ }).disabled).toBe(false);
});

test('a saved draft reopens where the school left off, and can be discarded', async () => {
  api.getTermGrid.mockResolvedValue({
    ...emptyGrid, grid: { ...lastTerm.grid, term, lock: { locked: true } },
    draft: { savedAt: '2026-10-14T09:00:00.000Z', savedBy: 'OWN', payload: { columns: lastTerm.grid.columns, rows: [{ classId: 'p1', amounts: { Tuition: 125000, Books: 15000 } }], students: [], feeMode: 'class', debtMode: 'carry' } },
  });
  render(<FeeSetup initialTermId="t2" canEdit />);
  expect((await screen.findByLabelText('Primary 1 Tuition')).value).toBe('125000');
  expect(screen.getByText(/Showing your draft/)).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Discard draft' })).toBeTruthy();
});

test('recording a payment asks only for amount, method, reference, date and note', async () => {
  api.recordSimplePayment.mockResolvedValue({ receipt: { receiptNo: 'RCT-1' } });
  const onDone = jest.fn();
  render(<RecordPaymentDialog student={{ studentId: 'ada', studentName: 'John James', className: 'JHS 1', balance: 100000 }} onClose={() => {}} onDone={onDone} />);
  const dialog = screen.getByRole('dialog', { name: 'Record Payment' });
  expect(within(dialog).getAllByRole('textbox').length + within(dialog).getAllByRole('spinbutton').length).toBe(3); // amount, reference, note (+ date)
  fireEvent.change(within(dialog).getByLabelText(/Amount/), { target: { value: '60000' } });
  fireEvent.click(within(dialog).getByRole('radio', { name: 'Transfer' }));
  fireEvent.click(within(dialog).getByRole('button', { name: 'Record Payment' }));
  await waitFor(() => expect(onDone).toHaveBeenCalled());
  expect(api.recordSimplePayment).toHaveBeenCalledWith('ada', expect.objectContaining({ amount: 60000, method: 'transfer' }));
});

test('Fees & Billing receipts open in the school\'s designed receipt, with the term figures as issued', async () => {
  const { ReceiptDialog } = await import('../FinanceShared');
  const receipt = {
    receiptNo: 'RCT-2026-7', status: 'valid', createdAt: '2026-10-14T09:00:00.000Z', verificationUrl: 'https://greenfield.ndovera.com/receipt-verification/RCT-2026-7',
    snapshot: { studentName: 'Ada Obi', className: 'Primary 1', termName: 'First Term', sessionName: '2026/2027', amountPaid: 50000, totalPayable: 160000, paidToDate: 90000, remainingBalance: 70000, method: 'transfer', reference: 'TRF-9', recordedBy: 'Bursar' },
  };
  render(<ReceiptDialog receipt={receipt} schoolName="Greenfield School" onClose={() => {}} />);
  const dialog = screen.getByRole('dialog', { name: 'Official School Fees Receipt' });
  expect(within(dialog).getByText('Greenfield School')).toBeTruthy();
  expect(within(dialog).getByText('Fifty Thousand Naira Only')).toBeTruthy();
  expect(within(dialog).getByText('₦160,000')).toBeTruthy(); // expected fees for the term
  expect(within(dialog).getByText('₦90,000')).toBeTruthy(); // paid to date
  expect(within(dialog).getByRole('button', { name: 'Share on WhatsApp' })).toBeTruthy();
});

test('fee entry saves itself as a draft a few seconds after typing stops', async () => {
  api.getTermGrid.mockResolvedValue({ ...emptyGrid, grid: { ...lastTerm.grid, term, lock: { locked: true } } });
  api.saveTermGrid.mockClear().mockResolvedValue({ draft: { savedAt: '2026-10-14T09:00:00.000Z', savedBy: 'OWN' } });
  render(<FeeSetup initialTermId="t2" canEdit />);
  fireEvent.change(await screen.findByLabelText('Primary 1 Tuition'), { target: { value: '121000' } });
  expect(screen.getByText('Changes are saved as a draft automatically.')).toBeTruthy();
  expect(api.saveTermGrid).not.toHaveBeenCalled();
  await waitFor(() => expect(api.saveTermGrid).toHaveBeenCalledWith(expect.objectContaining({ action: 'draft', autosave: true })), { timeout: 6000 });
  expect(api.saveTermGrid.mock.calls[0][0].rows.find(row => row.classId === 'p1').amounts.Tuition).toBe(121000);
  expect(await screen.findByText(/All changes saved as a draft/)).toBeTruthy();
  expect(api.saveTermGrid).toHaveBeenCalledTimes(1);
}, 15000);

test('a payment received can be typed straight into the student\'s row and recorded with Enter', async () => {
  api.recordSimplePayment.mockClear().mockResolvedValue({ receipt: { receiptNo: 'RCT-9' } });
  const onRecorded = jest.fn();
  const row = { studentId: 'ada', studentName: 'Ada Obi', status: 'unpaid' };
  const { rerender } = render(<QuickPayCell account={row} onRecorded={onRecorded} />);
  const amount = screen.getByLabelText('Amount received from Ada Obi');
  fireEvent.change(amount, { target: { value: '45000' } });
  fireEvent.change(screen.getByLabelText('Payment method for Ada Obi'), { target: { value: 'transfer' } });
  fireEvent.keyDown(amount, { key: 'Enter' });
  await waitFor(() => expect(onRecorded).toHaveBeenCalled());
  expect(api.recordSimplePayment).toHaveBeenCalledWith('ada', expect.objectContaining({ amount: 45000, method: 'transfer' }));
  expect(screen.getByRole('button', { name: 'RCT-9' })).toBeTruthy();
  expect(amount.value).toBe('');
  // A student with no fee account has nothing to pay into yet.
  rerender(<QuickPayCell account={{ ...row, status: 'not_billed' }} />);
  expect(screen.getByText('No fee account')).toBeTruthy();
});

test('next term, set before it opens: the page says nobody is billed yet, and publishing says so too', async () => {
  const upcoming = { ...term, upcoming: true, startDate: '2027-01-05' };
  api.getTermGrid.mockResolvedValue({ ...emptyGrid, grid: { ...lastTerm.grid, term: upcoming, lock: { locked: false }, billedStudents: 0 }, terms: [{ id: 't1', name: 'First Term', sessionName: '2026/2027', status: 'active' }, { id: 't2', name: 'Second Term', sessionName: '2026/2027', status: 'upcoming' }], earlierDebts: { students: 2, total: 50000 } });
  api.saveTermGrid.mockClear().mockResolvedValue({ saved: 2, adjusted: 0, published: { scheduled: true, students: 0, charges: 0, noFees: [] } });
  render(<FeeSetup initialTermId="t2" canEdit />);
  expect(await screen.findByText(/Second Term has not started \(it starts 5 January 2027\)/)).toBeTruthy();
  expect(screen.getByRole('option', { name: '2026/2027 · First Term (current)' })).toBeTruthy();
  expect(screen.getByRole('option', { name: '2026/2027 · Second Term (not started)' })).toBeTruthy();
  fireEvent.click(screen.getByLabelText(/Write off outstanding debts/));
  // Writing off happens when the term opens, so publishing now asks nothing.
  fireEvent.click(screen.getByRole('button', { name: 'Publish Second Term fees in advance' }));
  await waitFor(() => expect(api.saveTermGrid).toHaveBeenCalledWith(expect.objectContaining({ action: 'publish', termId: 't2', debtMode: 'write_off' })));
  expect(await screen.findByText(/Published in advance\. Nobody has been billed yet: when Second Term opens/)).toBeTruthy();
});
