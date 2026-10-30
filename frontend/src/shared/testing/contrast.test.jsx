import React from 'react';
import { readFileSync } from 'fs';
import path from 'path';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { contrastRatio, describeProblems, findContrastProblems } from './contrast';
import Sidebar from '../components/Sidebar';
import AmiOverview from '../../features/ami/AmiOverview';
import AmiFinancePage from '../../features/ami/AmiFinancePage';
import AmiProfitLossPage from '../../features/ami/AmiProfitLossPage';
import AmiShareholdersPage from '../../features/ami/AmiShareholdersPage';
import AmiPlatformAnalytics from '../../features/tenants/components/AmiPlatformAnalytics';
import AmiTenantGovernance from '../../features/tenants/components/AmiTenantGovernance';
import AmiAuditsPage from '../../app/roles/ami/AmiAuditsPage';
import AmiReportsPage from '../../app/roles/ami/AmiReportsPage';
import StudentAssignments from '../../app/roles/student/StudentAssignments';
import { loadStudentAssignments } from '../../features/classroom/studentTasks';
import { getPlatformFinance, getProfitAndLoss, getPlatformShares, listShareholders, getAmiTenants, getPlatformAnalytics, getSchoolAccessGrants, getAmiAuditLogs, getAmiReportSummary, getAmiTermBills } from '../../features/tenants/services/tenantApi';
import { FinanceReport, IncomeExpenditure, TermFeeTemplate } from '../../features/finance/TermFinance';
import { NextTermCard } from '../../features/finance/simple/SimpleFees';
import { getClasses, getFamilies, getLinkOverview, getPeople, getTermFinanceReport, runFinanceAI } from '../../features/school/services/schoolApi';
import FamilyTablePanel from '../../features/school/components/FamilyTablePanel';
import LinkStudentsPanel from '../../features/school/components/LinkStudentsPanel';
import { ClassesTab } from '../../app/roles/owner/OwnerSettings';
import { getExcursions, getFeeGroups, getFeeReports, getFeesOverview, getNewStudentFees } from '../../features/finance/simple/simpleFeesApi';
import { ExcursionsCard, FeeGroupsCard, NewStudentsCard } from '../../features/finance/simple/ExtraFees';
import PayrollManagementBoard from '../../features/school/components/PayrollManagementBoard';
import TeacherPayslip from '../../app/roles/teacher/TeacherPayslip';
import { RolesEditor } from '../../app/roles/owner/OwnerPeople';
import ParentNotifications from '../../features/communications/ParentNotifications';
import * as commApi from '../../features/communications/communicationsApi';
import HelpCentre from '../../features/help/HelpCentre';
import HelpArticleAdmin from '../../features/help/HelpArticleAdmin';
import PremisesSecurityDashboard from '../../features/security/PremisesSecurityDashboard';
import AmiOutreachPage from '../../features/ami/AmiOutreachPage';
import * as tenantApiForOutreach from '../../features/tenants/services/tenantApi';
import { getBranding, getMyBankDetails, getMyPayslip, getPayroll, getPayrollHistory, getPayrollNote, getPayrollSettings, getWebsiteSections } from '../../features/school/services/schoolApi';

// The colour rule, enforced: no text may clash with its background, in light or dark mode.
// Any new page in the command centre should be added to the list below.

let mockPath = '/roles/ami';
jest.mock('react-router-dom', () => ({
  Link: ({ to, children, className }) => <a href={to} className={className}>{children}</a>,
  NavLink: ({ to, children, className }) => <a href={to} className={typeof className === 'function' ? className({ isActive: to === mockPath }) : className}>{children}</a>,
  useLocation: () => ({ pathname: mockPath, search: '' }),
  useNavigate: () => jest.fn(),
  useParams: () => ({}),
  Navigate: () => null,
}), { virtual: true });
jest.mock('../../features/classroom/studentTasks', () => ({
  loadStudentAssignments: jest.fn(), readAnswerDraft: jest.fn(() => Promise.resolve(null)), saveAnswerDraft: jest.fn(), clearAnswerDraft: jest.fn(),
}));
jest.mock('../hooks/useFeatureFlags', () => () => ({ featureFlags: { aurasEnabled: true, farmingModeEnabled: true } }));
jest.mock('../../features/communications/communicationsApi', () => ({ ...jest.requireActual('../../features/communications/communicationsApi'), getInbox: jest.fn(() => Promise.resolve({ items: [] })), getMyChoices: jest.fn(), saveMyChoices: jest.fn(() => Promise.resolve({})), markInboxRead: jest.fn(() => Promise.resolve({})) }));
jest.mock('jspdf', () => ({ jsPDF: jest.fn() }));
jest.mock('html2canvas', () => jest.fn());
jest.mock('../hooks/useTenantPwaManifest', () => ({ getTenantPwaInfo: () => null }));
jest.mock('../../features/submissions/StaffSubmissionPanel', () => () => null);
jest.mock('../../features/tenants/components/SchoolAccessPanel', () => () => <div>School access</div>);
jest.mock('../components/AppDialog', () => ({ askConfirm: jest.fn(() => Promise.resolve(true)), askText: jest.fn(() => Promise.resolve('')) }));
jest.mock('../../features/tenants/services/tenantApi', () => new Proxy({}, { get: (target, key) => { if (!target[key]) target[key] = jest.fn(() => Promise.resolve({})); return target[key]; } }));
jest.mock('../../features/school/services/schoolApi', () => ({ ...jest.requireActual('../../features/school/services/schoolApi'), getTermFinanceReport: jest.fn(), runFinanceAI: jest.fn(), getClasses: jest.fn(), getPeople: jest.fn(), getLinkOverview: jest.fn(), getFamilies: jest.fn(), getPayroll: jest.fn(), getPayrollHistory: jest.fn(), getPayrollSettings: jest.fn(), getBranding: jest.fn(), getWebsiteSections: jest.fn(), getPayrollNote: jest.fn(), getMyPayslip: jest.fn(), getMyBankDetails: jest.fn() }));
jest.mock('../../features/finance/simple/simpleFeesApi', () => ({ ...jest.requireActual('../../features/finance/simple/simpleFeesApi'), getFeesOverview: jest.fn(), getFeeReports: jest.fn(), getNewStudentFees: jest.fn(), getExcursions: jest.fn(), getFeeGroups: jest.fn() }));

const month = new Date().toISOString().slice(0, 7);
const school = (id, name, extra = {}) => ({
  tenantId: id, schoolName: name, ownerName: 'Owner', contactEmail: `o@${id}.test`, ownerPhone: '', status: 'active', logoUrl: '',
  currentTermFee: { status: 'not_invoiced', term: 'First Term', session: '2026/2027' }, billed: 0, paid: 0, outstanding: 0, overdue: 0, daysOverdue: 0,
  thisTerm: { basis: 'estimate', amount: 7000, owed: 7000, students: 14, rate: 500, note: 'Estimate: 14 students × ₦500 · no invoice raised' }, totalOwed: 7000,
  lastPayment: null, lastReminder: null, ...extra,
});
const FINANCE = {
  success: true, canManage: true, generatedAt: new Date().toISOString(), categories: { expense: ['Hosting & infrastructure'], income: ['Other income'] },
  kpis: { collectedAllTime: 107500, collectedThisMonth: 0, collectedThisYear: 107500, collectedThisTerm: 107500, outstanding: 20000, overdue: 20000, owedDraft: 0, owedNotInvoiced: 7000, owedTotal: 27000, schoolsOwing: 1, schoolsPaid: 1, schoolsUnpaidThisTerm: 2, otherIncome: 0, expenses: 12000, partnerPayouts: 0, netAllTime: 95500, paymentsCount: 1 },
  monthly: Array.from({ length: 12 }, (_, index) => ({ month: index === 11 ? month : `2025-${String(index + 1).padStart(2, '0')}`, collected: index === 11 ? 107500 : 0, otherIncome: 0, expenses: 0, net: 0 })),
  schools: [
    school('b', 'Bright Future Academy', { currentTermFee: { status: 'overdue', term: 'First Term', session: '2026/2027' }, outstanding: 20000, overdue: 20000, daysOverdue: 20, totalOwed: 20000, thisTerm: { basis: 'invoiced', amount: 20000, owed: 20000, note: 'Invoice sent · overdue' } }),
    school('c', "Cotter's Academy"),
    school('a', 'Genesis International School', { currentTermFee: { status: 'paid', term: 'First Term', session: '2026/2027' }, paid: 107500, totalOwed: 0, thisTerm: { basis: 'paid', amount: 107500, owed: 0, note: 'Paid' }, lastPayment: { at: new Date().toISOString(), amount: 107500, method: 'Flutterwave', recordedBy: 'Flutterwave' } }),
  ],
  payments: [], payouts: [], ledger: [], reminders: [], recurring: [],
};
const PNL = {
  success: true, canManage: true, year: '2026', ledgerCategories: { expense: ['Hosting & infrastructure'], income: ['Other income'] },
  months: [{ month, future: false, termFees: 57500, onboarding: 50000, otherIncome: 0, revenue: 107500, byCategory: { Hosting: 20000 }, runningCosts: 20000, expenses: 32000, net: 75500, margin: 70.2 }],
  totals: { termFees: 57500, onboarding: 50000, otherIncome: 0, revenue: 107500, expenses: 32000, net: 75500, runningCosts: 20000, margin: 70.2 },
  categories: [{ category: 'Hosting & infrastructure', amount: 20000, share: 62.5 }],
  analysis: { monthsCounted: 1, profitableMonths: 1, lossMonths: 0, averageMonthlyRevenue: 107500, averageMonthlyExpense: 32000, averageMonthlyNet: 75500, expenseRatio: 29.8, bestMonth: { month, net: 75500 }, worstMonth: { month, net: 75500 }, currentRunningCost: 20000, averageRatePerStudent: 500, breakEvenStudentsPerTerm: 160 },
  previousYear: { revenue: 0 }, recurring: [{ id: 'r1', category: 'Hosting & infrastructure', description: 'Cloudflare', amount: 20000, startMonth: month, endMonth: null, active: true }],
};
const SHARES = {
  success: true, canManage: true, frequencies: ['quarterly', 'yearly'],
  register: { holders: [{ email: 'a@x.test', name: 'Ade', shares: 600, capital: 600000, pct: 60 }, { email: 'b@x.test', name: 'Bola', shares: 400, capital: 400000, pct: 40 }], totalShares: 1000, totalCapital: 1000000, problems: [] },
  events: [{ id: 'e1', kind: 'issue', email: 'a@x.test', name: 'Ade', shares: 600, capital: 600000, occurredOn: '2025-01-01', note: 'Founding', recordedBy: 'Ami' }],
  policy: { retentionPct: 30, frequency: 'quarterly' },
  dividends: [{ id: 'd1', fromMonth: '2025-01', toMonth: '2025-03', netProfit: 100000, retentionPct: 30, retained: 30000, distributable: 70000, totalShares: 1000, declaredOn: '2025-04-02', declaredBy: 'Ami', lines: [{ id: 'l1', email: 'a@x.test', name: 'Ade', shares: 600, pct: 60, amount: 42000, paid: 0, paidReference: '' }, { id: 'l2', email: 'b@x.test', name: 'Bola', shares: 400, pct: 40, amount: 28000, paid: 28000, paidReference: 'GTB 1', paidAt: '2025-04-03' }] }],
  dues: [{ email: 'a@x.test', name: 'Ade', declared: 42000, paid: 0, due: 42000, projected: 31710 }, { email: 'b@x.test', name: 'Bola', declared: 28000, paid: 28000, due: 0, projected: 21140 }],
  mine: { email: 'a@x.test', name: 'Ade', declared: 42000, paid: 0, due: 42000, projected: 31710 },
  projection: { fromMonth: '2025-04', toMonth: '2026-09', netProfit: 75500, retained: 22650, distributable: 52850, lines: [{ email: 'a@x.test', name: 'Ade', pct: 60, amount: 31710 }] },
};
const TENANTS = { summary: { totalTenants: 3, activeTenants: 3 }, payments: [], discountCodes: [], tenantAwards: [], tenants: [{ id: 'a', schoolName: 'Genesis International School', ownerName: 'Mr Owner', ownerEmail: 'g@x.test', websiteDomain: 'genesis.ndovera.com', planKey: 'growth', studentFeePerTerm: 500, status: 'active', paymentStatus: 'paid', approvalStatus: 'approved', studentCount: 78, currentTermFee: { status: 'paid', term: 'First Term', session: '2026/2027' }, createdAt: '2026-08-01' }] };
const ANALYTICS = { totals: { schools: 4, activeSchools: 4, staffActive: 114, staffInactive: 31, studentsActive: 93, studentsInactive: 16 }, schools: [{ tenantId: 'a', schoolName: 'Genesis International School', ownerEmail: 'g@x.test', status: 'active', staffActive: 102, staffInactive: 31, studentsActive: 78, studentsInactive: 16 }, { tenantId: 'm', schoolName: 'Mighty School', ownerEmail: 'm@x.test', status: 'active', staffActive: 5, staffInactive: 0, studentsActive: 0, studentsInactive: 0 }] };
const AUDIT = { logs: [{ id: '1', timestamp: new Date().toISOString(), action: 'Term fee marked paid', actor: 'Ami Admin (ami)', target: 'Genesis International School', detail: 'session: 2026/2027' }] };
const REPORT = {
  generatedAt: new Date().toISOString(),
  schools: { total: 4, active: 4, suspended: 0, pendingApproval: 0, onboardingUnpaid: 1, list: [{ tenantId: 'a', schoolName: 'Genesis International School', status: 'active', students: 78, paid: 107500, owed: 0, thisTerm: 'Paid' }] },
  people: { studentsActive: 93, studentsInactive: 16, staffActive: 114, staffInactive: 31, parents: 40 },
  finance: { collectedAllTime: 107500, collectedThisYear: 107500, paymentsCount: 1, owedTotal: 27000, owedInvoiced: 20000, owedDraft: 0, owedNotInvoiced: 7000, overdue: 20000, revenueThisYear: 107500, expensesThisYear: 32000, netThisYear: 75500, marginThisYear: 70.2 },
  activity: { total: 12, top: [{ action: 'Term fee marked paid', count: 3 }], security: [{ action: 'Password reset requested', count: 1 }] },
};

// A school's Finance tabs (Owner, HoS, Accountant).
const TERM = { id: 't1', name: 'First Term', sessionName: '2026/2027', startDate: '2026-09-07', endDate: '2026-12-18' };
const TERM_REPORT = {
  term: TERM, window: { from: '2026-09-07', to: '2026-10-27', ongoing: true, datedStart: true },
  fees: { source: 'fees', students: 2, termFees: 320000, broughtForward: 35000, otherCharges: 5000, discounts: 20000, expected: 340000, collected: 100000, outstanding: 240000, overpaid: 0, collectionRate: 29.4, paidInFull: 0, partPaid: 1, unpaid: 1, leftOwing: 0,
    byClass: [{ className: 'JSS 1', students: 2, expected: 340000, collected: 100000, outstanding: 240000, owing: 2 }], debtors: [{ studentId: 'ada', name: 'Ada Obi', className: 'JSS 1', expected: 180000, paid: 0, balance: 180000, status: 'Unpaid' }] },
  spending: { total: 30000, count: 1, byCategory: [{ category: 'Utilities', amount: 30000, share: 100 }], byMonth: [{ month: '2026-10', amount: 30000 }], largest: [] },
  payroll: { gross: 250000, net: 230000, months: ['2026-09', '2026-10'], entries: 4 }, net: 70000,
  previous: { term: { id: 't0', name: 'Third Term', sessionName: '2025/2026' }, fees: { source: 'template', expected: 0, collected: 0, outstanding: 0, collectionRate: 0 }, spending: { total: 90000, count: 3 }, net: -90000 },
  terms: [{ id: 't1', name: 'First Term', sessionName: '2026/2027', current: true }, { id: 't0', name: 'Third Term', sessionName: '2025/2026', current: false }],
};
const REPORT_DOC = {
  title: 'Finance report: First Term, 2026/2027', schoolName: 'Genesis International School', period: '7 September 2026 to 27 October 2026', generatedBy: 'computed', term: TERM, terms: TERM_REPORT.terms,
  sections: [
    { heading: 'Summary', paragraphs: ['The school expects ₦340,000 in fees this term and has collected ₦100,000.'] },
    { heading: '1. School fees for the term', paragraphs: ['Students were billed ₦320,000.'], table: { columns: ['Item', 'Amount'], rows: [['Expected this term', '₦340,000']] } },
    { heading: 'How the figures are worked out', paragraphs: [], bullets: ['Surplus or shortfall = fees collected − spending.'] },
  ],
};
const FEE_OVERVIEW = { configured: true, locked: true, canEditFees: true, term: TERM, nextTerm: { id: 't2', name: 'Second Term', sessionName: '2026/2027', startDate: '2027-01-05', configured: false, published: false, hasDraft: false } };
const FEE_REPORTS = {
  term: TERM, feeTable: { columns: ['Tuition', 'Books'], rows: [{ classId: 'jss1', className: 'JSS 1', amounts: { Tuition: 130000, Books: 20000 } }], feeMode: 'class' },
  students: [{ studentId: 'ada', studentName: 'Ada Obi', className: 'JSS 1', termFee: 150000, outstanding: 35000, totalPayable: 185000, paid: 0, balance: 185000, status: 'unpaid' }],
};

beforeEach(() => {
  getTermFinanceReport.mockResolvedValue({ report: TERM_REPORT });
  getClasses.mockResolvedValue({ classes: [{ id: 'jss2a', name: 'JSS 2', arm: 'A', classTeacherId: 't1', teacherIds: ['t1'], caregiverIds: [] }] });
  getPeople.mockResolvedValue({ people: [{ id: 't1', name: 'Mrs Ade' }] });
  runFinanceAI.mockResolvedValue({ analysis: REPORT_DOC });
  getFeesOverview.mockResolvedValue(FEE_OVERVIEW);
  getFeeReports.mockResolvedValue(FEE_REPORTS);
  getPlatformFinance.mockResolvedValue(FINANCE);
  getProfitAndLoss.mockResolvedValue(PNL);
  getPlatformShares.mockResolvedValue(SHARES);
  listShareholders.mockResolvedValue({ shareholders: [] });
  getAmiTenants.mockResolvedValue(TENANTS);
  getPlatformAnalytics.mockResolvedValue(ANALYTICS);
  getSchoolAccessGrants.mockResolvedValue({ grants: [] });
  getAmiAuditLogs.mockResolvedValue(AUDIT);
  getAmiReportSummary.mockResolvedValue(REPORT);
  getAmiTermBills.mockResolvedValue({ bills: [] });
});

function expectReadable(container, label) {
  for (const mode of ['light', 'dark']) {
    const problems = findContrastProblems(container, mode);
    if (problems.length) throw new Error(`${label} (${mode} mode) has text that clashes with its background:\n${describeProblems(problems)}`);
  }
}

test('the checker catches clashing colours and passes readable ones', () => {
  const { container } = render(
    <div>
      <div className="bg-white"><p className="text-white" data-case="white-on-white">Hidden</p></div>
      <div className="bg-[#0b1f3a]"><p className="text-[#191970]" data-case="navy-on-navy">Hidden</p></div>
      <div className="glass-surface"><p className="text-white/55" data-case="pale-on-glass">Hidden</p></div>
      <div className="bg-white dark:bg-slate-900"><p className="text-slate-900 dark:text-white">Readable both ways</p></div>
    </div>,
  );
  const light = findContrastProblems(container, 'light').map(problem => problem.element.dataset.case);
  expect(light).toEqual(['white-on-white', 'navy-on-navy', 'pale-on-glass']);
  // bg-white has no dark: variant, so the first card stays white in dark mode and still clashes.
  expect(findContrastProblems(container, 'dark').map(problem => problem.element.dataset.case)).toEqual(['white-on-white', 'navy-on-navy']);
  expect(contrastRatio([255, 255, 255], [0, 0, 0])).toBeCloseTo(21);
});

test('theme.css light-only rules are scoped to :root, so they never fire in dark mode', () => {
  const css = readFileSync(path.join(__dirname, '../styles/theme.css'), 'utf8');
  // `.dark` sits on <html>; a bare `:not(.dark)` also matches <body>, painting light-mode colours in dark mode.
  const bare = css.split('\n').filter(line => /(^|[\s,>+~])(?<!:root):not\(\.dark\)/.test(line));
  expect(bare).toEqual([]);
});

test.each([['ami', '/roles/ami'], ['shareholder', '/roles/shareholder']])('the %s sidebar is readable, with and without search results', (role, pathname) => {
  mockPath = pathname;
  const { container } = render(<Sidebar mobileOpen />);
  expectReadable(container, `${role} sidebar`);
  fireEvent.change(screen.getByRole('searchbox', { name: 'Search the app' }), { target: { value: 'finance' } });
  expectReadable(container, `${role} sidebar search`);
  fireEvent.change(screen.getByRole('searchbox', { name: 'Search the app' }), { target: { value: 'zzzz' } });
  expectReadable(container, `${role} sidebar search with no results`);
});

test.each([
  ['Dashboard', () => <AmiOverview />, 'Ndovera has collected'],
  ['Finance', () => <AmiFinancePage />, 'Schools owe Ndovera'],
  ['Profit & Loss', () => <AmiProfitLossPage />, 'What the figures say'],
  ['Shareholders', () => <AmiShareholdersPage />, 'Share capital paid'],
  ['Shareholder view', () => <AmiShareholdersPage readOnly />, 'Your position'],
  ['Schools at a glance', () => <AmiPlatformAnalytics />, 'Mighty School'],
  ['Schools', () => <AmiTenantGovernance sectionKey="tenants" />, 'Genesis International School'],
  ['Audit Trail', () => <AmiAuditsPage />, 'Term fee marked paid'],
  ['Reports', () => <AmiReportsPage />, 'Schools: what each has paid and owes'],
])('the %s page is readable in light and dark mode', async (label, renderPage, ready) => {
  mockPath = '/roles/ami';
  const { container } = render(renderPage());
  await waitFor(() => expect(screen.getAllByText(ready).length).toBeGreaterThan(0));
  expectReadable(container, label);
});

test.each([
  ['Income & Expenditure', () => <IncomeExpenditure />, 'Where the expected fees come from'],
  ['Finance report', () => <FinanceReport />, 'How the figures are worked out'],
  ['Fee Template for the current term', () => <TermFeeTemplate legacy={<div>Earlier board</div>} />, 'Class fees'],
  ['ICT class teachers', () => <ClassesTab assignOnly />, 'Save This Class'],
  ['Next term card', () => <NextTermCard nextTerm={FEE_OVERVIEW.nextTerm} canEdit onSetup={() => {}} />, 'Set Second Term fees in advance'],
])('the school Finance %s is readable in light and dark mode', async (label, renderPage, ready) => {
  const { container } = render(renderPage());
  await waitFor(() => expect(screen.getAllByText(ready).length).toBeGreaterThan(0));
  expectReadable(container, label);
});

test('a student offline, with a hand-in waiting to send, can read the notice and the status', async () => {
  loadStudentAssignments.mockResolvedValue({
    classId: 'jss1', offline: true, savedAt: new Date().toISOString(),
    assignments: [{ id: 'a2', title: 'Angles', subjectName: 'Mathematics', questions: [], mySubmission: { queued: true, status: 'queued', submittedAt: new Date().toISOString(), content: { answers: {} } } }],
  });
  render(<StudentAssignments />);
  const banner = await screen.findByText(/No connection — showing the copy saved on this device/);
  expectReadable(banner, 'Offline assignments notice');
  fireEvent.click(screen.getByRole('tab', { name: 'Submitted' }));
  expectReadable(screen.getByText('Waiting to send'), 'Waiting-to-send status');
});

test('the parent-linking panel is readable, with a parent to turn off and a link to a turned-off parent', async () => {
  getLinkOverview.mockResolvedValue({
    success: true, maxParentsPerStudent: 2,
    counts: { students: 2, unlinkedStudents: 1, parents: 1, parentsWithoutChildren: 1 },
    parents: [{ id: 'p1', name: 'Mr Lone', email: 'lone@a.test', children: [] }, { id: 'p3', name: 'Mr Eze', email: 'eze@a.test', children: [{ id: 's3', name: 'Chidi Eze' }] }],
    students: [
      { id: 's1', name: 'Ada Obi', displayId: 'GIS/001', className: 'JSS 1', parents: [{ id: 'p2', name: 'Mrs Obi', email: 'obi@a.test', off: true }] },
      { id: 's2', name: 'Bisi Ola', displayId: 'GIS/002', className: 'JSS 2', parents: [] },
      { id: 's3', name: 'Chidi Eze', displayId: 'GIS/003', className: 'JSS 3', parents: [{ id: 'p3', name: 'Mr Eze', email: 'eze@a.test' }] },
    ],
  });
  const { container } = render(<LinkStudentsPanel />);
  await screen.findByRole('button', { name: /Turn off marked/ });
  fireEvent.click(screen.getByRole('checkbox', { name: 'Mark Mr Lone' }));
  expect(screen.getByRole('button', { name: 'Turn off marked (1)' })).toBeEnabled();
  expectReadable(container, 'Link by parent, a parent marked to turn off');
  fireEvent.click(screen.getByRole('button', { name: 'Link by child' }));
  fireEvent.click(screen.getByRole('button', { name: '1 parent' }));
  expect(screen.queryByRole('button', { name: /Bisi Ola/ })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /Ada Obi/ }));
  await screen.findByText('Mrs Obi (off)');
  expectReadable(container, 'Link by child, linked to a turned-off parent');
  fireEvent.click(screen.getByRole('button', { name: /Chidi Eze/ }));
  expect(screen.getByText('Parent: Mr Eze')).toBeInTheDocument();
  fireEvent.click(await screen.findByRole('button', { name: 'Link another child to Mr Eze' }));
  await screen.findByRole('heading', { name: 'Mr Eze' });
  expectReadable(container, 'Link another child to the same parent');
});

test('the family table is readable: parents typed in, a turned-off parent, and a new student row', async () => {
  getFamilies.mockResolvedValue({
    success: true, maxParentsPerStudent: 2,
    classes: [{ id: 'c1', label: 'JSS 1 A' }],
    students: [
      { id: 's1', name: 'Ada Obi', displayId: 'GIS/001', classId: 'c1', className: 'JSS 1 A', parents: [{ id: 'p1', name: 'Mrs Obi', phone: '2348031234567', email: '' }, { id: 'p2', name: 'Mr Obi', phone: '', email: 'obi@mail.test', off: true }] },
      { id: 's2', name: 'Bisi Ola', displayId: 'GIS/002', classId: 'c1', className: 'JSS 1 A', parents: [] },
    ],
  });
  const { container } = render(<FamilyTablePanel />);
  await screen.findByText('Ada Obi');
  expect(screen.getByDisplayValue('0803 123 4567')).toBeInTheDocument();
  fireEvent.change(screen.getByRole('textbox', { name: 'Bisi Ola: parent 1 name' }), { target: { value: 'Mr Ola' } });
  expect(screen.getByRole('button', { name: 'Save changes (1)' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: '+ New student' }));
  expectReadable(container, 'Family table');
});

test('the new-students and excursions fee cards are readable in light and dark mode', async () => {
  getNewStudentFees.mockResolvedValue({ success: true, canEdit: true, term: { id: 't1', name: 'First Term', startDate: '2026-09-07' }, columns: ['Tuition', 'Books'],
    students: [{ studentId: 'chi', name: 'Chi Eze', classId: 'jss1', className: 'JSS 1', classAmounts: { Tuition: 130000, Books: 20000 }, ownAmounts: { Tuition: 100000 } }] });
  getExcursions.mockResolvedValue({ success: true, canEdit: true, classes: [{ id: 'jss1', name: 'JSS 1' }, { id: 'jss2', name: 'JSS 2' }],
    terms: [{ key: 'current', name: 'First Term (this term)' }, { key: 'next', name: 'Second Term, 2026/2027 (next term)' }],
    excursions: [{ id: 'e1', title: 'Zoo', amount: 5000, termName: 'First Term', upcoming: false, students: 40, classIds: ['jss1'], classes: ['JSS 1'] }] });
  const { container } = render(<div><NewStudentsCard /><ExcursionsCard /></div>);
  await screen.findByText('1 student joined this term');
  await screen.findByText('Zoo');
  fireEvent.click(screen.getByRole('button', { name: '+ New excursion' }));
  expectReadable(container, 'New students and excursions cards');
});

test('the fee groups card and the finance report\'s edit view are readable in light and dark mode', async () => {
  getFeeGroups.mockResolvedValue({ success: true, canEdit: true, sections: ['nursery', 'primary', 'secondary'], fromTerm: 'Second Term, 2026/2027',
    groups: [{ id: 'g1', name: 'Staff child', rates: { primary: 30000, secondary: 40000 }, members: 1 }, { id: 'g2', name: 'Scholarship', rates: {}, members: 0 }],
    students: [{ studentId: 'ada', name: 'Ada Obi', classId: 'jss1', className: 'JSS 1', section: 'secondary', groupId: 'g1' }, { studentId: 'bisi', name: 'Bisi Ola', classId: 'jss1', className: 'JSS 1', section: 'secondary', groupId: '' }] });
  const groups = render(<FeeGroupsCard />);
  await screen.findByText('Staff children, scholarship students and other groups');
  fireEvent.click(screen.getAllByRole('button', { name: 'Add students' })[0]);
  fireEvent.change(screen.getByRole('textbox', { name: 'Find a student for Staff child' }), { target: { value: 'bisi' } });
  expectReadable(groups.container, 'Fee groups card');
  groups.unmount();

  const report = render(<FinanceReport />);
  await screen.findAllByText('How the figures are worked out');
  fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
  await screen.findByRole('textbox', { name: 'Report title' });
  expectReadable(report.container, 'Finance report edit view');
});

const PAYROLL_SETTINGS = {
  attendanceCharges: false,
  earningColumns: [{ key: 'basicSalary', label: 'Basic Salary' }, { key: 'housingAllowance', label: 'Housing Allowance' }, { key: 'transportAllowance', label: 'Transport Allowance' }, { key: 'bonus', label: 'Bonus' }],
  deductionColumns: [{ key: 'tax', label: 'Income Tax' }, { key: 'pension', label: 'Pension' }, { key: 'otherDeduction', label: 'Other Deductions' }, { key: 'deduction_1', label: 'Staff Loan', kind: 'school' }, { key: 'deduction_2', label: 'Cooperative' }],
};

test('the payroll sheet is readable: green income headings, red deductions, empty amount boxes, what is kept and paid on', async () => {
  getPayroll.mockResolvedValue({ success: true, period: '2026-10', approved: false, submitted: false, settings: PAYROLL_SETTINGS,
    payroll: [
      { staffId: 'tola', name: 'Tola Ade', displayId: 'GIS/ST/001', role: 'teacher', basicSalary: 120000, allowancesMap: {}, deductionsMap: { deduction_1: 10000, deduction_2: 5000 }, hasEntry: true },
      { staffId: 'bayo', name: 'Bayo Eze', displayId: 'GIS/ST/002', role: 'clinic', basicSalary: 0, allowancesMap: {}, deductionsMap: {}, hasEntry: false },
    ] });
  getPayrollHistory.mockResolvedValue({ history: [] });
  getPayrollSettings.mockResolvedValue({ settings: PAYROLL_SETTINGS });
  getBranding.mockResolvedValue({ branding: { schoolName: 'Greenfield School' } });
  getWebsiteSections.mockResolvedValue({ sections: [] });
  getPayrollNote.mockResolvedValue({ note: null });
  const { container } = render(<PayrollManagementBoard />);
  await screen.findByText('Tola Ade');
  expect(screen.getByRole('spinbutton', { name: 'Bayo Eze: Basic Salary' })).toHaveValue(null);
  expect(screen.queryByText('Late Charges')).toBeNull();
  expect(screen.getByText('Cooperative: ₦5,000')).toBeInTheDocument();
  expectReadable(container, 'Payroll sheet');
  fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
  expect(screen.getByRole('combobox', { name: 'Staff Loan: where it goes' })).toHaveValue('school');
  expectReadable(container, 'Payroll settings');
});

test('my payslip and my salary account are readable in light and dark mode', async () => {
  getMyPayslip.mockResolvedValue({ success: true, period: '2026-09', available: [{ period: '2026-09', net: 110000 }],
    payslip: { name: 'Tola Ade', period: '2026-09', gross: 120000, deductions: 10000, net: 110000, earnings: [{ key: 'basicSalary', label: 'Basic Salary', amount: 120000 }], deductionBreakdown: [{ key: 'deduction_1', label: 'Staff Loan', amount: 10000 }], branding: { schoolName: 'Greenfield School' } } });
  getMyBankDetails.mockResolvedValue({ details: { bankName: '', accountName: '', accountNumber: '' } });
  getWebsiteSections.mockResolvedValue({ sections: [] });
  const { container } = render(<TeacherPayslip auth={{ user: { name: 'Tola Ade', role: 'teacher' } }} />);
  await screen.findByText('Staff Loan');
  await screen.findByRole('textbox', { name: 'Account number' });
  expectReadable(container, 'My payslip with the salary account form');
});

test('the roles editor is readable, and with every role removed it asks for one', () => {
  const { container } = render(<RolesEditor person={{ id: 'tola', name: 'Tola Ade' }} roles={['teacher', 'accountant']} onSave={jest.fn()} onCancel={() => {}} />);
  expectReadable(container, 'Roles editor');
  fireEvent.click(screen.getByRole('button', { name: 'Remove accountant role' }));
  fireEvent.click(screen.getByRole('button', { name: 'Remove teacher role' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Choose a role to assign');
  expect(screen.getByRole('button', { name: 'Save roles' })).toBeDisabled();
  expectReadable(container, 'Roles editor with no role left');
  fireEvent.change(screen.getByRole('combobox', { name: 'Choose a role to assign' }), { target: { value: 'librarian' } });
  expect(screen.getByRole('button', { name: 'Save roles' })).toBeEnabled();
});

test('a parent can choose WhatsApp only, and the page stays readable', async () => {
  commApi.getMyChoices.mockResolvedValue({ choices: {}, schoolConfirmedConsent: true });
  commApi.getInbox.mockResolvedValue({ items: [] });
  commApi.markInboxRead.mockResolvedValue({});
  commApi.saveMyChoices.mockResolvedValue({});
  const { container } = render(<ParentNotifications />);
  const button = await screen.findByRole('button', { name: 'Use WhatsApp only — no emails or SMS' });
  expectReadable(container, 'Parent notifications');
  fireEvent.click(button);
  await screen.findByText('You get WhatsApp only (and notifications here).');
  expect(commApi.saveMyChoices).toHaveBeenCalledWith({ whatsapp: 'granted', sms: 'withdrawn', email: 'withdrawn' });
  expectReadable(container, 'Parent notifications, WhatsApp only');
});

// The premium upgrade's screens: Help Centre, the article editor and premises security.
function mockFetchJson(routes) {
  if (!global.fetch) global.fetch = () => Promise.reject(new Error('no network in tests'));
  return jest.spyOn(global, 'fetch').mockImplementation(async url => {
    const key = Object.keys(routes).find(path => String(url).includes(path));
    return { ok: true, status: 200, json: async () => (key ? routes[key] : {}), text: async () => JSON.stringify(key ? routes[key] : {}) };
  });
}

test('the Help Centre and the article editor are readable in light and dark mode', async () => {
  const spy = mockFetchJson({
    '/api/help/articles/published': { articles: [] },
    '/api/help/articles/editor': { articles: [{ id: 'r1', article_id: 'a1', revision: 1, title: 'How to pay school fees', category: 'Fees', state: 'in_review', created_by: 'own' }] },
  });
  // The help screens only call the server for a signed-in person.
  const payload = btoa(JSON.stringify({ id: 'own', role: 'owner', tenantId: 'school-a', exp: Math.floor(Date.now() / 1000) + 600 }));
  window.localStorage.setItem('token', `x.${payload}.y`);
  window.localStorage.setItem('authUser', JSON.stringify({ id: 'own', role: 'owner', tenantId: 'school-a' }));
  try {
    const help = render(<HelpCentre role="owner" />);
    await screen.findAllByRole('heading');
    expectReadable(help.container, 'Help Centre');
    help.unmount();
    const admin = render(<HelpArticleAdmin role="owner" />);
    await screen.findByText('How to pay school fees');
    expectReadable(admin.container, 'Help article editor');
  } finally {
    spy.mockRestore();
    window.localStorage.removeItem('token');
    window.localStorage.removeItem('authUser');
  }
});

test('the premises security dashboard is readable in light and dark mode', async () => {
  const spy = mockFetchJson({
    '/overview': { summary: [{ kind: 'incident', status: 'open', total: 1 }], records: [{ id: 'r1', kind: 'incident', title: 'Broken fence', location: 'Back field', notes: 'Near the hostel', severity: 'high', status: 'open', created_at: '2026-10-29T08:00:00Z', created_by: 'guard', escalated_at: '2026-10-29T09:00:00Z' }] },
    '/checkpoints': { checkpoints: [{ id: 'c1', name: 'Main gate', location: 'North entrance', active: 1 }], rounds: [{ id: 'p1', checkpoint_name: 'Main gate', officer_id: 'guard', checked_at: '2026-10-29T10:00:00Z', notes: '' }] },
  });
  try {
    const { container } = render(<PremisesSecurityDashboard role="chiefsecurityofficer" />);
    await screen.findAllByText('Broken fence');
    expectReadable(container, 'Premises security dashboard');
  } finally { spy.mockRestore(); }
});

test('the School Outreach page is readable in light and dark mode', async () => {
  mockPath = '/roles/ami/outreach';
  tenantApiForOutreach.getOutreach.mockResolvedValue({
    success: true, emailReady: false, searchReady: false, sentToday: 3,
    countries: { NG: 'Nigeria', GH: 'Ghana', ZA: 'South Africa' },
    settings: { sending: false, dailyCap: 40, noAutoSend: ['ZA'], templates: { first: { subject: 'Hello {schoolName}', body: 'Dear {schoolName} team' }, second: { subject: 'Follow-up', body: 'Body' }, later: { subject: 'News', body: 'Body' } } },
    byStatus: [{ status: 'new', n: 4 }, { status: 'active', n: 2 }, { status: 'opted_out', n: 1 }], byCountry: [{ country: 'NG', n: 6 }, { country: 'GH', n: 1 }],
    thisWeek: { found_new: 5 },
    sources: [{ id: 's1', url: 'https://kingsacademy.edu.ng/', country: 'NG', last_crawled_at: '2026-11-01T02:00:00Z', last_found: 3 }, { id: 's2', url: 'https://blocked.sch.gh/', country: 'GH', last_error: 'robots.txt does not allow this page' }],
    prospects: [
      { id: 'p1', email: 'info@kingsacademy.edu.ng', domain: 'kingsacademy.edu.ng', school_name: 'Kings Academy', country: 'NG', status: 'active', step: 1, next_due_at: '2026-11-16T08:00:00Z' },
      { id: 'p2', email: 'head@hill.sch.gh', domain: 'hill.sch.gh', school_name: null, country: 'GH', status: 'opted_out', step: 2 },
      { id: 'p3', email: 'info@new.edu.ng', domain: 'new.edu.ng', school_name: 'New School', country: 'NG', status: 'bounced', step: 0 },
    ],
  });
  const { container } = render(<AmiOutreachPage />);
  await screen.findByText('Kings Academy');
  expectReadable(container, 'School Outreach');
});
