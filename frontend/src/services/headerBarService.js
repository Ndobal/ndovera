import API_ENDPOINTS from '../config/apiEndpoints';
import { getJson } from './apiClient';

const fallbackByRole = {
  student: {
    auras: 320,
    chats: 3,
    notifications: 4,
    chatItems: [
      { id: 'c1', sender: 'Math Teacher', preview: 'Upload your class work by 6:00 PM', time: '2m ago', unread: true },
      { id: 'c2', sender: 'Class Captain', preview: 'Science live class starts by 3:00 PM', time: '16m ago', unread: true },
      { id: 'c3', sender: 'School Support', preview: 'Your request has been resolved', time: '1h ago', unread: false },
    ],
    notificationItems: [
      { id: 'n1', title: 'New assignment posted', detail: 'Mathematics CA is now available.', time: 'Just now', unread: true },
      { id: 'n2', title: 'Attendance update', detail: 'Today attendance marked as present.', time: '35m ago', unread: true },
      { id: 'n3', title: 'Material uploaded', detail: 'Biology note with diagrams uploaded.', time: '2h ago', unread: false },
      { id: 'n4', title: 'Auras reward', detail: 'You earned 12 Auras from practice.', time: '5h ago', unread: false },
    ],
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
