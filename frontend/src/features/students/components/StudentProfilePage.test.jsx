import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import StudentProfilePage from './StudentProfilePage';
import * as api from '../../school/services/schoolApi';

jest.mock('../../school/services/schoolApi', () => ({
  addStudentRecord: jest.fn(), deleteResultDocument: jest.fn(), deleteStudentRecord: jest.fn(), generateStudentAiReport: jest.fn(),
  getResultRecords: jest.fn(), getStudentProfile: jest.fn(), updateStudentRecord: jest.fn(),
}));
jest.mock('../../compliance/complianceApi', () => ({ uploadComplianceFile: jest.fn() }));
jest.mock('../../results-engine/components/ResultRecordViewer', () => () => null);

const group = (view, add = false) => ({ view, add });
function profileFor(relation, permissions, records = []) {
  return {
    relation, permissions, student: { id: 's-1', name: 'Ada Obi', className: 'JSS 1', displayId: 'GIS-S-001', status: 'active' },
    personal: { dateOfBirth: '2014-02-01', gender: 'Female' }, guardians: [{ id: 'par-1', name: 'Mrs Obi', relationship: 'Mother', phone: '0803' }],
    fees: null, payments: [], receipts: [], records, timeline: [], categories: [], addableCategories: ['behaviour', 'disciplinary', 'reward', 'note', 'report'],
    overview: { academic: 78, attendance: 94, outstandingFees: null, behaviour: 'Good', awards: 3, openDisciplinary: 1, assignmentCompletion: 87 },
    assignments: { total: 10, completed: 9, notDone: 1, graded: 8, averageScore: 81 }, attendance: { present: 47, absent: 3, late: 0, excused: 0, total: 50, rate: 94 },
  };
}
const CLASS_TEACHER = {
  view: true, personal: group(true), guardians: group(true), academic: group(true), results: group(true), attendance: group(true), fees: group(false), recordPayment: false,
  aiReport: group(true), deleteRecords: false,
  groups: { behaviour: group(true, true), disciplinary: group(true, true), reports: group(true, true), health: group(true, true), documents: group(true), awards: group(true, true), notes: group(true, true), activities: group(true, true) },
};

beforeEach(() => jest.clearAllMocks());

test('the overview shows the figures the doc asks for, and no Fees tab for a class teacher', async () => {
  api.getStudentProfile.mockResolvedValue(profileFor('classteacher', CLASS_TEACHER));
  render(<StudentProfilePage studentId="s-1" inline />);
  expect(await screen.findByText('78%')).toBeTruthy();
  expect(screen.getByText('94%')).toBeTruthy();
  expect(screen.getByText('87% completion')).toBeTruthy();
  expect(screen.queryByRole('tab', { name: 'Fees' })).toBeNull();
  expect(screen.getByRole('tab', { name: 'Health' })).toBeTruthy();
  fireEvent.click(screen.getByRole('tab', { name: 'Parents/Guardians' }));
  expect(screen.getByText('Mrs Obi')).toBeTruthy();
});

test('a teacher records behaviour with a rating, and closes a disciplinary case', async () => {
  api.getStudentProfile.mockResolvedValue(profileFor('classteacher', CLASS_TEACHER, [
    { id: 'r-1', category: 'disciplinary', title: 'Fighting in the hall', detail: '', metadata: { status: 'open' }, createdByName: 'Sarah James', createdAt: '2026-10-01T09:00:00Z' },
  ]));
  api.addStudentRecord.mockResolvedValue({ success: true });
  api.updateStudentRecord.mockResolvedValue({ success: true });
  window.prompt = jest.fn(() => 'Apologised');
  render(<StudentProfilePage studentId="s-1" inline />);
  fireEvent.click(await screen.findByRole('tab', { name: 'Behaviour' }));
  fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Helped a classmate' } });
  fireEvent.change(screen.getByLabelText('Behaviour rating'), { target: { value: 'Excellent' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add' }));
  await waitFor(() => expect(api.addStudentRecord).toHaveBeenCalledWith('s-1', expect.objectContaining({ category: 'behaviour', title: 'Helped a classmate', metadata: { rating: 'Excellent' } })));

  fireEvent.click(screen.getByRole('tab', { name: 'Disciplinary' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Close case' }));
  await waitFor(() => expect(api.updateStudentRecord).toHaveBeenCalledWith('s-1', 'r-1', { status: 'closed', note: 'Apologised' }));
});

test('the accountant sees fees and a way to record a payment', async () => {
  const accountant = { ...CLASS_TEACHER, academic: group(false), results: group(false), attendance: group(false), fees: group(true), recordPayment: true, aiReport: group(false),
    groups: Object.fromEntries(Object.keys(CLASS_TEACHER.groups).map(key => [key, group(key === 'documents')])) };
  api.getStudentProfile.mockResolvedValue({
    ...profileFor('accountant', accountant),
    fees: { totals: { currentTermCharges: 150000, paidThisTerm: 65000, previousOutstanding: 0, totalOutstanding: 85000 }, current: [{ id: 'o1', feeItem: 'Tuition', termName: 'First Term', balance: 85000, netAmount: 150000 }], previousOutstanding: [] },
    overview: { outstandingFees: 85000 },
  });
  render(<StudentProfilePage studentId="s-1" inline />);
  expect(await screen.findByText('₦85,000')).toBeTruthy();
  expect(screen.queryByRole('tab', { name: 'Behaviour' })).toBeNull();
  fireEvent.click(screen.getByRole('tab', { name: 'Fees' }));
  expect(screen.getByText('Tuition · First Term')).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Record payment' }).getAttribute('href')).toMatch(/\?pay=s-1&name=Ada%20Obi$/);
});
