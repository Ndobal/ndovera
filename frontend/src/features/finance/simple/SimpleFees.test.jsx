import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { bulkEdit, previewChanges, rowTotal } from './simpleFeesApi';
import FeeSetup from './FeeSetup';
import { RecordPaymentDialog } from './StudentAccounts';
import * as api from './simpleFeesApi';

jest.mock('./simpleFeesApi', () => {
  const actual = jest.requireActual('./simpleFeesApi');
  return { ...actual, getTermGrid: jest.fn(), getSavedTemplate: jest.fn(), saveTermGrid: jest.fn(), lockTermFees: jest.fn(), recordSimplePayment: jest.fn(), listAccounts: jest.fn() };
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

test('reuse last term: the table arrives filled in, +10% with preview, then Save', async () => {
  api.getTermGrid.mockImplementation(id => Promise.resolve(id === 't1' ? lastTerm : emptyGrid));
  api.saveTermGrid.mockResolvedValue({ saved: 2, adjusted: 0 });
  render(<FeeSetup initialTermId="t2" initialSource={{ type: 'reuse', termId: 't1' }} canEdit />);
  expect(await screen.findByText(/Copied from 2026\/2027 First Term/)).toBeTruthy();
  expect(screen.getByLabelText('Primary 1 Tuition').value).toBe('100000');
  expect(screen.getByText('₦115,000')).toBeTruthy(); // row total

  fireEvent.click(screen.getByRole('button', { name: /Tuition/ }));
  const dialog = screen.getByRole('dialog', { name: 'Edit Tuition' });
  fireEvent.change(within(dialog).getByRole('spinbutton'), { target: { value: '10' } });
  expect(within(dialog).getByText('Preview')).toBeTruthy();
  expect(within(dialog).getByText('₦110,000')).toBeTruthy();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Apply' }));
  expect(screen.getByLabelText('Primary 1 Tuition').value).toBe('110000');

  fireEvent.click(screen.getByRole('button', { name: 'Save Fees' }));
  await waitFor(() => expect(api.saveTermGrid).toHaveBeenCalled());
  const payload = api.saveTermGrid.mock.calls[0][0];
  expect(payload.termId).toBe('t2');
  expect(payload.rows.find(row => row.classId === 'p1').amounts).toEqual({ Tuition: 110000, Books: 15000 });
});

test('changing fees after billing asks what should happen to students already billed', async () => {
  const configured = { ...emptyGrid, grid: { ...lastTerm.grid, term, lock: { locked: false } } };
  api.getTermGrid.mockResolvedValue(configured);
  const decision = Object.assign(new Error('426 students have already been billed.'), { status: 409, data: { needsDecision: true, affectedStudents: 426, changes: [{ className: 'Primary 1', item: 'Tuition', from: 150000, to: 160000, students: 426 }] } });
  api.saveTermGrid.mockRejectedValueOnce(decision).mockResolvedValueOnce({ saved: 2, adjusted: 426 });
  render(<FeeSetup initialTermId="t2" canEdit />);
  fireEvent.change(await screen.findByLabelText('Primary 1 Tuition'), { target: { value: '160000' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save Fees' }));
  const dialog = await screen.findByRole('dialog', { name: 'Students already billed' });
  expect(within(dialog).getByText(/426 students have already been billed/)).toBeTruthy();
  fireEvent.click(within(dialog).getByRole('button', { name: /Apply the difference/ }));
  await waitFor(() => expect(api.saveTermGrid).toHaveBeenLastCalledWith(expect.objectContaining({ changeMode: 'adjust_existing' })));
  expect(await screen.findByText(/426 existing charge\(s\) adjusted/)).toBeTruthy();
});

test('locked fees are read-only until unlocked', async () => {
  api.getTermGrid.mockResolvedValue({ ...emptyGrid, grid: { ...lastTerm.grid, term, lock: { locked: true } } });
  render(<FeeSetup initialTermId="t2" canEdit />);
  expect((await screen.findByLabelText('Primary 1 Tuition')).disabled).toBe(true);
  expect(screen.getByText('🔒 Locked')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Unlock to edit' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Save Fees' })).toBeNull();
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
