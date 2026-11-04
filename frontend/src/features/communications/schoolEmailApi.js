import { getApiUrl } from '../../config/apiBase';
import { buildSelectedRoleHeader } from '../auth/services/authApi';

// The school's email wording, and receipts by email.

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
    error.data = data;
    throw error;
  }
  return data;
}

export const getEmailTemplates = () => request('/api/school/email-templates');
export const saveEmailTemplate = (kind, body) => request(`/api/school/email-templates/${kind}`, { method: 'PUT', body });
export const resetEmailTemplate = kind => request(`/api/school/email-templates/${kind}`, { method: 'DELETE' });

export const getPassNudges = () => request('/api/school/pass-nudges');
export const setPassNudges = off => request('/api/school/pass-nudges', { method: 'PUT', body: { off } });
export const getReceiptEmailStatus = () => request('/api/school/finance/simple/receipts/email-status');
export const emailReceiptBatch = () => request('/api/school/finance/simple/receipts/email-batch', { method: 'POST', body: {} });
export const emailReceiptToParents = (receiptNo, again = false) => request('/api/school/finance/simple/receipts/email', { method: 'POST', body: { receiptNo, again } });
export const emailMyReceipt = receiptNo => request('/api/school/finance/my-receipts/email', { method: 'POST', body: { receiptNo } });
