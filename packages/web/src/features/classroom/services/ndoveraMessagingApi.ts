import { fetchWithAuth, resolveApiUrl } from '../../../services/apiClient';

export type NdoveraMessagingSettings = {
  allowStudentPeerMessaging: boolean;
};

export type NdoveraMessagingContact = {
  id: string;
  kind: 'helpdesk' | 'user';
  name: string;
  role: string;
  subtitle?: string;
  identifier?: string | null;
  contextLabel?: string | null;
  avatarUrl?: string | null;
  statusText?: string | null;
  statusAvailability?: 'available' | 'busy' | 'away' | 'offline';
  statusUpdatedAt?: string | null;
  isOnline?: boolean;
  lastSeenAt?: string | null;
  lastMessageText?: string | null;
  lastMessageTime?: string | null;
  unreadCount?: number;
};

export type NdoveraChatMessage = {
  id: string;
  from: string;
  fromName: string;
  to: string | null;
  text: string;
  time: string;
  readBy?: string[];
};

export type NdoveraTypingStatus = {
  typing: boolean;
};

export type NdoveraMessagingStreamEvent =
  | { type: 'connected'; timestamp: string }
  | { type: 'contacts_changed'; timestamp: string; reason?: 'presence' | 'thread' | 'system' }
  | { type: 'thread_changed'; timestamp: string; peerId: string }
  | { type: 'typing_changed'; timestamp: string; peerId: string; isTyping: boolean };

export async function getMessagingSettings() {
  return fetchWithAuth('/api/messaging/settings') as Promise<NdoveraMessagingSettings>;
}

export async function updateMessagingSettings(body: NdoveraMessagingSettings) {
  return fetchWithAuth('/api/messaging/settings', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }) as Promise<NdoveraMessagingSettings>;
}

export async function getMessagingContacts() {
  return fetchWithAuth('/api/messaging/contacts') as Promise<NdoveraMessagingContact[]>;
}

export async function lookupMessagingContact(query: string) {
	return fetchWithAuth(`/api/messaging/lookup?query=${encodeURIComponent(query)}`) as Promise<NdoveraMessagingContact>;
}

export async function searchMessagingContacts(query: string) {
  return fetchWithAuth(`/api/messaging/search?query=${encodeURIComponent(query)}`) as Promise<NdoveraMessagingContact[]>;
}

export async function getMessagingThread(peerId: string) {
  return fetchWithAuth(`/api/messaging/thread?peerId=${encodeURIComponent(peerId)}`) as Promise<NdoveraChatMessage[]>;
}

export async function sendMessagingThreadMessage(body: { peerId: string; text: string }) {
  return fetchWithAuth('/api/messaging/thread', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }) as Promise<{ messages: NdoveraChatMessage[] }>;
}

export async function getTypingStatus(peerId: string) {
  return fetchWithAuth(`/api/messaging/typing?peerId=${encodeURIComponent(peerId)}`) as Promise<NdoveraTypingStatus>;
}

export async function publishTypingStatus(body: { peerId: string; isTyping: boolean }) {
  return fetchWithAuth('/api/messaging/typing', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }) as Promise<{ ok: boolean; isTyping: boolean }>;
}

export function createMessagingEventSource() {
  return new EventSource(resolveApiUrl('/api/messaging/stream'), { withCredentials: true });
}
