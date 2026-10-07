import { getApiUrl } from '../../config/apiBase';
import { buildSelectedRoleHeader } from '../auth/services/authApi';

// Fees & billing (Worker: finance.ts, routes under /api/school/finance).

async function request(path, { method = 'GET', body } = {}) {
  const token = localStorage.getItem('token');
  const response = await fetch(getApiUrl(path), {
    method,
    credentials: 'include',
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

const query = params => {
  const entries = Object.entries(params || {}).filter(([, value]) => value !== undefined && value !== null && value !== '');
  return entries.length ? `?${new URLSearchParams(entries).toString()}` : '';
};
const id = value => encodeURIComponent(value);

export const getFinanceContext = () => request('/api/school/finance/context');
export const getFinanceDashboard = (params) => request(`/api/school/finance/dashboard${query(params)}`);
export const listFeeStructures = (params) => request(`/api/school/finance/structures${query(params)}`);
export const createFeeStructure = (payload) => request('/api/school/finance/structures', { method: 'POST', body: payload });
export const updateFeeStructure = (structureId, items) => request(`/api/school/finance/structures/${id(structureId)}`, { method: 'PUT', body: { items } });
export const setFeeStructureStatus = (structureId, status) => request(`/api/school/finance/structures/${id(structureId)}/status`, { method: 'POST', body: { status } });
export const previewFeeStructureCopy = (structureId) => request(`/api/school/finance/structures/${id(structureId)}/copy-preview`);
export const getStructureStudents = (structureId) => request(`/api/school/finance/structures/${id(structureId)}/students`);
export const issueStructureBills = (structureId) => request(`/api/school/finance/structures/${id(structureId)}/issue`, { method: 'POST' });
export const getItemOptIns = (itemId) => request(`/api/school/finance/items/${id(itemId)}/optins`);
export const saveItemOptIns = (itemId, studentIds) => request(`/api/school/finance/items/${id(itemId)}/optins`, { method: 'POST', body: { studentIds } });
export const searchFinanceStudents = (params) => request(`/api/school/finance/students${query(params)}`);
export const getStudentAccount = (studentId) => request(`/api/school/finance/students/${id(studentId)}/account`);
export const getChargeHistory = (chargeId) => request(`/api/school/finance/obligations/${id(chargeId)}/history`);
export const addChargeAdjustment = (chargeId, payload) => request(`/api/school/finance/obligations/${id(chargeId)}/adjustments`, { method: 'POST', body: payload });
export const cancelCharge = (chargeId, reason) => request(`/api/school/finance/obligations/${id(chargeId)}/cancel`, { method: 'POST', body: { reason } });
export const recordStudentPayment = (studentId, payload) => request(`/api/school/finance/students/${id(studentId)}/payments`, { method: 'POST', body: payload });
export const reverseFinancePayment = (paymentId, reason) => request(`/api/school/finance/payments/${id(paymentId)}/reverse`, { method: 'POST', body: { reason } });
export const listFinanceClaims = (params) => request(`/api/school/finance/claims${query(params)}`);
export const reviewFinanceClaim = (claimId, action, note) => request(`/api/school/finance/claims/${id(claimId)}/review`, { method: 'POST', body: { action, note } });
export const searchFeeArchives = (params) => request(`/api/school/finance/archives${query(params)}`);
export const getFinanceAudit = (params) => request(`/api/school/finance/audit${query(params)}`);
export const getMyFeeAccounts = () => request('/api/school/finance/my-accounts');
export const submitFeeClaim = (payload) => request('/api/school/finance/my-claims', { method: 'POST', body: payload });
export const getSchoolPaymentDetails = () => request('/api/school/fees/payment-details');

export const naira = value => `₦${(Number(value) || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

export const STATUS_LABELS = {
  not_paid: 'Not paid', partially_paid: 'Partially paid', paid: 'Paid', overpaid: 'Overpaid', waived: 'Waived', cancelled: 'Cancelled',
  submitted: 'Submitted', under_review: 'Under review', resolved: 'Resolved', auto_resolved: 'Auto-resolved', rejected: 'Rejected',
  draft: 'Draft', published: 'Published', closed: 'Closed', confirmed: 'Confirmed', reversed: 'Reversed', reversal: 'Reversal',
};

export const STATUS_STYLES = {
  not_paid: 'bg-rose-100 text-rose-900', partially_paid: 'bg-amber-100 text-amber-900', paid: 'bg-emerald-100 text-emerald-900',
  overpaid: 'bg-sky-100 text-sky-900', waived: 'bg-violet-100 text-violet-900', cancelled: 'bg-slate-200 text-slate-700',
  submitted: 'bg-amber-100 text-amber-900', under_review: 'bg-sky-100 text-sky-900', resolved: 'bg-emerald-100 text-emerald-900',
  auto_resolved: 'bg-emerald-100 text-emerald-900', rejected: 'bg-rose-100 text-rose-900',
  draft: 'bg-slate-200 text-slate-800', published: 'bg-emerald-100 text-emerald-900', closed: 'bg-slate-300 text-slate-800',
  confirmed: 'bg-emerald-100 text-emerald-900', reversed: 'bg-rose-100 text-rose-900', reversal: 'bg-rose-50 text-rose-800',
};
