import { getApiUrl } from '../../../config/apiBase';
import {
  buildSelectedRoleHeader,
  clearStoredAuth,
  getSignedOutRedirectPath,
  getStoredAuth,
  syncRefreshedToken,
} from '../../auth/services/authApi';

function buildHeaders() {
  const auth = getStoredAuth();
  return {
    'Content-Type': 'application/json',
    ...(auth?.token ? { Authorization: `Bearer ${auth.token}` } : {}),
    ...buildSelectedRoleHeader(),
  };
}

function handleUnauthorized() {
  clearStoredAuth();
  window.location.replace(getSignedOutRedirectPath());
}

async function requestJson(path, options = {}) {
  const response = await fetch(getApiUrl(path), {
    method: options.method || 'GET',
    credentials: 'include',
    headers: buildHeaders(),
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (response.status === 401) {
    handleUnauthorized();
    return {};
  }

  syncRefreshedToken(response);

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || data.message || 'Request failed.');
    error.data = data;
    throw error;
  }

  return data;
}

export function getAiAccess() {
  return requestJson('/api/ai/access');
}

export function saveAiBillingSettings(payload) {
  return requestJson('/api/ai/access/settings', {
    method: 'POST',
    body: payload,
  });
}

export function initiateAiTopUp(payload) {
  return requestJson('/api/ai/access/top-up/initiate', {
    method: 'POST',
    body: payload,
  });
}

export function verifyAiTopUp(txRef) {
  return requestJson('/api/ai/access/top-up/verify', {
    method: 'POST',
    body: { txRef },
  });
}

export function askAiTutor(payload) {
  return requestJson('/api/ai/tutor/ask', {
    method: 'POST',
    body: payload,
  });
}