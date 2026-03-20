import { fetchWithAuth } from '../../../services/apiClient';

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
};

export type NdoveraChatMessage = {
  id: string;
  from: string;
  fromName: string;
  to: string | null;
  text: string;
  time: string;
};

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
