import { getApiUrl } from '../../../config/apiBase';
import { buildSelectedRoleHeader } from '../../auth/services/authApi';

// The simple fee screens (Worker: feeEngine.ts, /api/school/finance/simple/*).

async function request(path, { method = 'GET', body } = {}) {
  const token = localStorage.getItem('token');
  const response = await fetch(getApiUrl(path), {
    method, credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...buildSelectedRoleHeader() },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) {
    const error = new Error(data.message || data.error || 'Request failed.');
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

const q = params => {
  const entries = Object.entries(params || {}).filter(([, value]) => value !== undefined && value !== null && value !== '');
  return entries.length ? `?${new URLSearchParams(entries).toString()}` : '';
};
const id = value => encodeURIComponent(value);

export const getFeesOverview = () => request('/api/school/finance/simple/overview');
export const getTermGrid = termId => request(`/api/school/finance/simple/grid${q({ termId })}`);
export const getSavedTemplate = termId => request(`/api/school/finance/simple/template${q({ termId })}`);
/** Another term's fees (or, with no `from`, the latest saved Fee Template) shaped for this term's table. */
export const getFeeSource = (termId, from) => request(`/api/school/finance/simple/source${q({ termId, from })}`);
export const saveTermGrid = payload => request('/api/school/finance/simple/grid', { method: 'PUT', body: payload });
export const lockTermFees = (termId, unlock = false, reason = '') => request('/api/school/finance/simple/lock', { method: 'POST', body: { termId, unlock, reason } });
export const getFeeSettings = () => request('/api/school/finance/simple/settings');
export const saveFeeSettings = feeEditMode => request('/api/school/finance/simple/settings', { method: 'PUT', body: { feeEditMode } });
export const listAccounts = params => request(`/api/school/finance/simple/accounts${q(params)}`);
export const getAccount = studentId => request(`/api/school/finance/simple/accounts/${id(studentId)}`);
export const recordSimplePayment = (studentId, payload) => request(`/api/school/finance/simple/accounts/${id(studentId)}/pay`, { method: 'POST', body: payload });
export const addCharge = (studentId, payload) => request(`/api/school/finance/simple/accounts/${id(studentId)}/charge`, { method: 'POST', body: payload });
export const adjustAccount = (studentId, payload) => request(`/api/school/finance/simple/accounts/${id(studentId)}/adjust`, { method: 'POST', body: payload });
/** Family discount: { familyId, studentIds, mode: 'percent' | 'amount', value, note }. */
export const applyFamilyDiscount = payload => request('/api/school/finance/simple/family-discount', { method: 'POST', body: payload });
/** One student's fee reminder: the polite message to each parent, their email and a WhatsApp link. */
export const getFeeReminder = studentId => request(`/api/school/finance/simple/accounts/${id(studentId)}/reminder`);
/** Email reminders to the parents of these students ({ studentIds, text? }), or record that WhatsApp was opened. */
export const sendFeeReminders = payload => request('/api/school/finance/simple/reminders', { method: 'POST', body: payload });
export const settleClassMove = (studentId, decision, note) => request(`/api/school/finance/simple/accounts/${id(studentId)}/class-move`, { method: 'POST', body: { decision, note } });
export const billNewStudents = studentIds => request('/api/school/finance/simple/bill-new', { method: 'POST', body: { studentIds } });
export const getNewStudentFees = () => request('/api/school/finance/simple/new-students');
export const saveNewStudentFees = payload => request('/api/school/finance/simple/new-students', { method: 'POST', body: payload });
export const getExcursions = () => request('/api/school/finance/simple/excursions');
export const getFeeGroups = () => request('/api/school/finance/simple/fee-groups');
export const saveFeeGroup = payload => request('/api/school/finance/simple/fee-groups', { method: 'POST', body: payload });
export const setFeeGroupMembers = (groupId, studentIds) => request('/api/school/finance/simple/fee-groups/members', { method: 'POST', body: { groupId, studentIds } });
export const addExcursion = payload => request('/api/school/finance/simple/excursions', { method: 'POST', body: payload });
export const addExcursionClasses = (excursionId, classIds) => request(`/api/school/finance/simple/excursions/${id(excursionId)}/classes`, { method: 'POST', body: { classIds } });
export const listTermPayments = params => request(`/api/school/finance/simple/payments${q(params)}`);
export const getFeeReports = () => request('/api/school/finance/simple/reports');
/** Receipts for many payments at once (each as issued, with its check link). */
export const getReceipts = paymentIds => request('/api/school/finance/simple/receipts', { method: 'POST', body: { paymentIds } });
export const discardFeeDraft = termId => request(`/api/school/finance/simple/draft${q({ termId })}`, { method: 'DELETE' });
export const reversePayment = (paymentId, reason) => request(`/api/school/finance/payments/${id(paymentId)}/reverse`, { method: 'POST', body: { reason } });

export const naira = value => `₦${(Number(value) || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

export const ACCOUNT_STATUS = {
  paid: { label: 'Paid', className: 'bg-emerald-100 text-emerald-900' },
  part_payment: { label: 'Part Payment', className: 'bg-amber-100 text-amber-900' },
  unpaid: { label: 'Unpaid', className: 'bg-rose-100 text-rose-900' },
  overpaid: { label: 'Overpaid', className: 'bg-sky-100 text-sky-900' },
  not_billed: { label: 'No account yet', className: 'bg-slate-200 text-slate-700' },
};

export const EDIT_MODES = [
  ['owner_only', '🔒 Owner only', 'Owner'],
  ['owner_hos', 'Owner + HOS', 'Owner, Head of School'],
  ['owner_accountant', 'Owner + Accountant', 'Owner, Accountant'],
  ['all', 'Owner + HOS + Accountant', 'All three'],
];

// ─── Fee table helpers (pure, tested) ────────────────────────────────────────

export const rowTotal = (row, columns) => columns.reduce((sum, column) => sum + (Number(row.amounts?.[column.name]) || 0), 0);

const round = value => Math.round(value * 100) / 100;

/**
 * "Edit All" for one column: the same amount for every class, or every amount
 * raised / reduced by a percentage. Returns new rows; nothing is changed until
 * the caller applies them.
 */
export function bulkEdit(rows, column, mode, value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return rows;
  return rows.map(row => {
    const current = Number(row.amounts?.[column]) || 0;
    let next = current;
    if (mode === 'same') next = number;
    else if (mode === 'increase') next = round(current * (1 + number / 100));
    else if (mode === 'reduce') next = round(Math.max(0, current * (1 - number / 100)));
    return { ...row, amounts: { ...row.amounts, [column]: next } };
  });
}

/** A student's total: their own amount where they have one, otherwise their class's. */
export const studentTotal = (student, classRow, columns) => columns.reduce((sum, column) => {
  const own = student.amounts?.[column.name];
  const value = own === undefined || own === null || own === '' ? classRow?.amounts?.[column.name] : own;
  return sum + (Number(value) || 0);
}, 0);

/** Lines for the preview: each class whose amount changes. */
export function previewChanges(before, after, column) {
  return before.map((row, index) => ({ className: row.className, from: Number(row.amounts?.[column]) || 0, to: Number(after[index]?.amounts?.[column]) || 0 }))
    .filter(line => line.from !== line.to);
}

// Financial standings report (Owner, HoS, Accountant).
export const getStandings = (params = {}) => request(`/api/school/finance/standings${q(params)}`);
export const postStandings = (body = {}) => request('/api/school/finance/standings/post', { method: 'POST', body });
export const listStandingsReports = () => request('/api/school/finance/standings/reports');
export const getStandingsReport = reportId => request(`/api/school/finance/standings/reports/${id(reportId)}`);
export const saveStandingsSettings = body => request('/api/school/finance/standings/settings', { method: 'PUT', body });
