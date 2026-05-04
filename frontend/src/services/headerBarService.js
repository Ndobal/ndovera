import API_ENDPOINTS from '../config/apiEndpoints';
import { getJson } from './apiClient';

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

export function getHeaderBarData(roleKey) {
  const endpoint = API_ENDPOINTS.header.stats(roleKey);
  return getJson(endpoint, defaultFallback(roleKey));
}
