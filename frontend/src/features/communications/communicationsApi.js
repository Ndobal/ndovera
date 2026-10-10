import { getApiUrl } from '../../config/apiBase';
import { buildSelectedRoleHeader } from '../auth/services/authApi';

// Parent notifications (N20): WhatsApp, SMS, email and in-app, with message units.
// Worker: commCredits.ts, commMessages.ts, commEngine.ts (routes under /api/communications
// and /api/super-admin/communications).

function headers() {
  const token = localStorage.getItem('token');
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...buildSelectedRoleHeader() };
}

async function request(path, { method = 'GET', body } = {}) {
  const response = await fetch(getApiUrl(path), { method, credentials: 'include', headers: headers(), body: body ? JSON.stringify(body) : undefined });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) {
    const error = new Error(data.message || data.error || 'Request failed.');
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

const id = value => encodeURIComponent(value);
const query = params => {
  const text = new URLSearchParams(Object.entries(params).filter(([, value]) => value)).toString();
  return text ? `?${text}` : '';
};

// School
export const getOverview = () => request('/api/communications/overview');
export const saveSettings = body => request('/api/communications/settings', { method: 'PATCH', body });
export const previewNotification = body => request('/api/communications/batches/preview', { method: 'POST', body });
export const recheckBatch = batchId => request(`/api/communications/batches/${id(batchId)}/admit`, { method: 'POST' });
export const sendNotice = body => request('/api/communications/notices', { method: 'POST', body });
export const getDeliveries = filters => request(`/api/communications/deliveries${query(filters || {})}`);
export const getWallets = () => request('/api/communications/wallets');
export const getContacts = () => request('/api/communications/contacts');
export const setContactConsent = (guardianId, body) => request(`/api/communications/contacts/${id(guardianId)}/consent`, { method: 'POST', body });
export const quoteUnits = body => request('/api/communications/purchases/quote', { method: 'POST', body });
export const startPurchase = purchaseId => request('/api/communications/purchases', { method: 'POST', body: { purchaseId } });
export const checkPurchase = purchaseId => request(`/api/communications/purchases/${id(purchaseId)}`);
export const listPurchases = () => request('/api/communications/purchases');

// Parents
export const getInbox = () => request('/api/communications/inbox');
export const markInboxRead = ids => request('/api/communications/inbox/read', { method: 'POST', body: { ids } });
export const getMyChoices = () => request('/api/communications/my-choices');
export const saveMyChoices = body => request('/api/communications/my-choices', { method: 'PUT', body });

// Super Admin
export const getSchoolWallets = () => request('/api/super-admin/communications/schools');
export const listGifts = tenantId => request(`/api/super-admin/communications/grants${query({ tenantId })}`);
export const giftUnits = body => request('/api/super-admin/communications/grants', { method: 'POST', body });
export const reverseGift = (grantId, reason) => request(`/api/super-admin/communications/grants/${id(grantId)}/reverse`, { method: 'POST', body: { reason } });
export const getPrices = () => request('/api/super-admin/communications/prices');
export const schedulePrice = body => request('/api/super-admin/communications/prices', { method: 'POST', body });
export const savePlatformConfig = body => request('/api/super-admin/communications/config', { method: 'PUT', body });
export const getTemplates = () => request('/api/super-admin/communications/templates');
export const saveTemplate = (eventType, body) => request(`/api/super-admin/communications/templates/${id(eventType)}`, { method: 'PUT', body });
export const getReconciliation = () => request('/api/super-admin/communications/reconciliation');
export const resolveDelivery = (deliveryId, decision) => request(`/api/super-admin/communications/deliveries/${id(deliveryId)}/resolve`, { method: 'POST', body: { decision } });

export const naira = kobo => `₦${(Number(kobo || 0) / 100).toLocaleString('en-NG', { minimumFractionDigits: Number(kobo) % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
export const CHANNEL_LABELS = { whatsapp: 'WhatsApp', sms: 'SMS', email: 'Email', inapp: 'In-app' };
export const STATUS_LABELS = {
  planned: 'Planned', awaiting_credits: 'Waiting for units', queued: 'Queued', submitting: 'Sending', accepted: 'Accepted by provider',
  sent: 'Sent', delivered: 'Delivered', read: 'Read', failed: 'Failed', unknown: 'Outcome unknown', cancelled: 'Cancelled', expired: 'Expired',
};
export const EXCLUDED_LABELS = {
  no_guardian_linked: 'Students with no linked parent', guardian_inactive: 'Parent account inactive', no_valid_phone: 'No valid phone number',
  no_permitted_paid_channel: 'No permitted WhatsApp/SMS', sms_fallback_off: 'Could get SMS, but SMS fallback is off',
};
