import { getApiUrl } from '../../../config/apiBase';
import { getStoredAuth } from '../../auth/services/authApi';

function buildHeaders(includeAuth = true) {
  const headers = {
    'Content-Type': 'application/json',
  };

  if (includeAuth) {
    const auth = getStoredAuth();
    if (auth?.token) {
      headers.Authorization = `Bearer ${auth.token}`;
    }
  }

  return headers;
}

async function requestJson(path, options = {}) {
  const response = await fetch(getApiUrl(path), {
    method: options.method || 'GET',
    headers: buildHeaders(options.auth !== false),
    body: typeof options.body === 'undefined' ? undefined : JSON.stringify(options.body),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || data.message || 'Request failed.');
  }

  return data;
}

export function getTenantPricing(params = {}) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== '' && value !== null && typeof value !== 'undefined') {
      query.set(key, String(value));
    }
  });

  const suffix = query.toString() ? `?${query.toString()}` : '';
  return requestJson(`/api/tenants/pricing${suffix}`, { auth: false });
}

export function registerSchool(payload) {
  return requestJson('/api/tenants/register', {
    method: 'POST',
    body: payload,
    auth: false,
  });
}

export function getMyTenant() {
  return requestJson('/api/tenants/me');
}

export function initiateTenantPayment(payload = {}) {
  return requestJson('/api/tenants/payments/initiate', {
    method: 'POST',
    body: payload,
  });
}

export function verifyTenantPayment(txRef) {
  return requestJson('/api/tenants/payments/verify', {
    method: 'POST',
    body: { txRef },
  });
}

export function getAmiTenants() {
  return requestJson('/api/ami/tenants');
}

export function upsertDiscountCode(payload) {
  return requestJson('/api/ami/discount-codes', {
    method: 'POST',
    body: payload,
  });
}

export function endDiscountCode(code) {
  return requestJson(`/api/ami/discount-codes/${encodeURIComponent(code)}/end`, {
    method: 'POST',
    body: {},
  });
}

export function approveTenant(tenantId, approvalNote = '') {
  return requestJson(`/api/ami/tenants/${encodeURIComponent(tenantId)}/approve`, {
    method: 'POST',
    body: { approvalNote },
  });
}

export function suspendTenant(tenantId) {
  return requestJson(`/api/ami/tenants/${encodeURIComponent(tenantId)}/suspend`, {
    method: 'POST',
    body: {},
  });
}

export function restoreTenant(tenantId) {
  return requestJson(`/api/ami/tenants/${encodeURIComponent(tenantId)}/restore`, {
    method: 'POST',
    body: {},
  });
}