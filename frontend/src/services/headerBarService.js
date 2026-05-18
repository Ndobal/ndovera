import API_ENDPOINTS from '../config/apiEndpoints';
import { getJson } from './apiClient';
import { getApiUrl } from '../config/apiBase';
import { buildSelectedRoleHeader, getStoredAuth } from '../features/auth/services/authApi';

const fallbackByRole = {
  student: {
    auras: 0,
    chats: 0,
    notifications: 0,
    chatItems: [],
    notificationItems: [],
  },
};

function defaultFallback(roleKey) {
  const base = fallbackByRole[roleKey] || fallbackByRole.student;
  return {
    ...base,
    _meta: { source: 'fallback' },
  };
}

function buildHeaders(includeJson = true) {
  const auth = getStoredAuth();
  return {
    ...(includeJson ? { 'Content-Type': 'application/json' } : {}),
    ...(auth?.token ? { Authorization: `Bearer ${auth.token}` } : {}),
    ...buildSelectedRoleHeader(),
  };
}

async function requestJson(path, init = {}) {
  const response = await fetch(getApiUrl(path), {
    credentials: 'include',
    ...init,
    headers: {
      ...buildHeaders(Boolean(init.body)),
      ...(init.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.success === false) {
    throw new Error(data?.error || data?.message || 'Request failed.');
  }

  return data;
}

export function getHeaderBarData(roleKey) {
  const endpoint = getApiUrl(API_ENDPOINTS.header.stats(roleKey));
  return getJson(endpoint, defaultFallback(roleKey), { headers: buildSelectedRoleHeader() });
}

export function getConversationMessages(conversationId) {
  return requestJson(`/api/conversations/${encodeURIComponent(conversationId)}/messages`);
}

export function markConversationRead(conversationId) {
  return requestJson(`/api/conversations/${encodeURIComponent(conversationId)}/mark-read`, {
    method: 'POST',
  });
}

export function sendConversationReply(conversationId, body) {
  return requestJson(`/api/conversations/${encodeURIComponent(conversationId)}/messages`, {
    method: 'POST',
    body: JSON.stringify({ body }),
  });
}
