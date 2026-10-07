import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import ComplianceCentre from './ComplianceCentre';
import TeacherCompliancePage, { MySubmissionsCard } from './TeacherCompliancePage';
import ClassReportPage from './ClassReportPage';
import * as api from './complianceApi';

jest.mock('./complianceApi');
// This project's Jest cannot resolve React Router 7, so the pieces these pages use are stood in.
jest.mock('react-router-dom', () => ({
  MemoryRouter: ({ children }) => children,
  Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>,
  useLocation: () => ({ pathname: '/roles/hos/compliance' }),
}), { virtual: true });
jest.mock('../../app/roles/student/StudentSectionShell', () => ({ title, children }) => <div><h1>{title}</h1>{children}</div>);

const examItem = {
  ruleId: 'r-exam', ruleName: 'Exam Questions', kind: 'exam_questions', periodKey: 'once:2026-11-13', periodLabel: 'Exam Questions', dueAt: '2026-11-13T15:00:00.000Z',
  units: [
    { key: 'subject:jss1:m1', label: 'Mathematics — JSS 1', done: true, source: 'auto', detail: 'Submitted' },
    { key: 'subject:jss2:b2', label: 'Basic Science — JSS 2', done: false, source: null, detail: 'Not submitted' },
  ],
  done: 1, total: 2, status: 'partial', verification: 'auto', missing: ['Basic Science — JSS 2'], method: 'either', evidenceUpload: false,
  fine: { proposed: 1000, decision: null, amount: 1000, reason: '' },
};
const registerItem = { ...examItem, ruleId: 'r-reg', ruleName: 'Register', kind: 'register', units: [{ key: 'class:jss1', label: 'JSS 1', done: true, source: 'auto', detail: '5/5 days marked' }], done: 1, total: 1, status: 'complete', missing: [], fine: null };

const config = {
  rules: [], kinds: [{ key: 'register', label: 'Register' }, { key: 'exam_questions', label: 'Exam Questions' }], frequencies: [], sections: ['nursery', 'primary', 'secondary'],
  settings: { sectionHeads: { nursery: ['nurseryhead'], primary: ['headteacher'], secondary: ['principal'] } },
  permissions: { canConfigure: true, canOversee: true, canVerify: true, canDecideFines: true, scope: 'all' },
};

beforeEach(() => {
  jest.clearAllMocks();
  window.confirm = jest.fn(() => true);
  window.prompt = jest.fn(() => 'Paper copy seen');
});

test('Heads see totals and a matrix; a cell opens the teacher with exactly what is missing and lets them mark it submitted', async () => {
  api.getComplianceConfig.mockResolvedValue(config);
  api.getComplianceOverview.mockResolvedValue({
    date: '2026-10-07', weekLabel: 'Week 5',
    summary: { teachers: 2, fullyCompliant: 1, partial: 1, outstanding: 0, late: 0, proposedPenalties: 1000 },
    columns: [{ ruleId: 'r-reg', name: 'Register', kind: 'register' }, { ruleId: 'r-exam', name: 'Exam Questions', kind: 'exam_questions' }],
    rows: [{ teacher: { id: 't-james', name: 'Sarah James', sections: ['secondary'] }, items: [registerItem, examItem] }],
    permissions: { canVerify: true, canDecideFines: true },
  });
  api.getTeacherCompliance.mockResolvedValue({ teacher: { id: 't-james', name: 'Sarah James', sections: ['secondary'] }, items: [examItem], history: [], audit: [] });
  api.verifyComplianceUnit.mockResolvedValue({ success: true });

  render(<MemoryRouter initialEntries={['/roles/hos/compliance']}><ComplianceCentre /></MemoryRouter>);
  expect(await screen.findByText('Week 5 — Teacher Compliance')).toBeTruthy();
  expect(screen.getByText('₦1,000')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: /Sarah James: Exam Questions Partial/ }));
  const drawer = await screen.findByRole('dialog');
  await within(drawer).findByText(/Basic Science — JSS 2/);
  expect(within(drawer).getByText(/₦1,000 penalty proposed/)).toBeTruthy();
  fireEvent.click(within(drawer).getByRole('button', { name: 'Mark submitted' }));
  await waitFor(() => expect(api.verifyComplianceUnit).toHaveBeenCalledWith({ ruleId: 'r-exam', periodKey: 'once:2026-11-13', teacherId: 't-james', unitKey: 'subject:jss2:b2', note: 'Paper copy seen' }));
  fireEvent.click(within(drawer).getByRole('button', { name: 'Waive' }));
  await waitFor(() => expect(api.decideComplianceFine).toHaveBeenCalledWith(expect.objectContaining({ decision: 'waived', teacherId: 't-james' })));
});

test('the teacher card says how many items need attention and links to them; the page lists what is missing', async () => {
  api.getMyCompliance.mockResolvedValue({ date: '2026-10-07', items: [registerItem, examItem], history: [{ weekStart: '2026-09-28', label: 'Week 4', required: 2, onTime: 1, late: 0, missing: 1, partial: 0, pending: 0 }], attention: 1 });
  const { unmount } = render(<MemoryRouter><MySubmissionsCard /></MemoryRouter>);
  expect(await screen.findByText('1 item requires attention')).toBeTruthy();
  expect(screen.getByRole('link', { name: 'View missing items' }).getAttribute('href')).toBe('/roles/teacher/compliance');
  unmount();

  render(<MemoryRouter><TeacherCompliancePage /></MemoryRouter>);
  expect(await screen.findByText('Missing: Basic Science — JSS 2')).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Open Exams' })).toBeTruthy();
  expect(screen.getByText('₦1,000 penalty proposed — a Head will decide')).toBeTruthy();
  expect(screen.getByText('Week 4')).toBeTruthy();
});

test('a class teacher answers the questions, lets Ndovera AI write it up, edits it and submits', async () => {
  const questions = [{ id: 'topics', label: 'Topics covered', type: 'long', required: true }, { id: 'struggling', label: 'Pupils who are struggling', type: 'students' }];
  api.getMyClassReport.mockResolvedValue({ classes: [{ id: 'p5', name: 'Primary 5' }], classId: 'p5', period: { key: 'week:2026-10-05', label: 'Week 5' }, questions, report: null, students: [{ id: 's-1', name: 'Ada' }] });
  api.saveMyClassReport.mockImplementation(async payload => ({ report: { id: 'rep-1', status: 'draft', answers: payload.answers, summary: payload.summary } }));
  api.generateClassReportSummary.mockResolvedValue({ report: { id: 'rep-1', status: 'draft', aiSummary: 'Summary: fractions.', summary: 'Summary: fractions.' } });
  api.submitMyClassReport.mockResolvedValue({ report: { id: 'rep-1', status: 'submitted', summary: 'Edited.' } });

  render(<MemoryRouter><ClassReportPage /></MemoryRouter>);
  fireEvent.change(await screen.findByLabelText(/Topics covered/), { target: { value: 'Fractions' } });
  fireEvent.click(screen.getByLabelText('Ada'));
  fireEvent.click(screen.getByRole('button', { name: /Write it up with Ndovera AI/ }));
  await waitFor(() => expect(screen.getByLabelText('Report').value).toBe('Summary: fractions.'));
  expect(api.saveMyClassReport).toHaveBeenCalledWith({ classId: 'p5', answers: { topics: 'Fractions', struggling: ['s-1'] }, summary: '' });
  fireEvent.change(screen.getByLabelText('Report'), { target: { value: 'Edited.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Submit report' }));
  await waitFor(() => expect(api.submitMyClassReport).toHaveBeenCalledWith('rep-1', 'Edited.'));
  expect(await screen.findByText('✓ Submitted')).toBeTruthy();
});
