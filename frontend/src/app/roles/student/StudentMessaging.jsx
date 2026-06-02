import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  ChatBubbleLeftRightIcon,
  FaceSmileIcon,
  LifebuoyIcon,
  MagnifyingGlassIcon,
  PaperAirplaneIcon,
  ShieldCheckIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import StudentSectionShell from './StudentSectionShell';
import { buildSelectedRoleHeader, getStoredAuth } from '../../../features/auth/services/authApi';
import { CHAT_EMOJIS, CHAT_STICKERS, getChatInitials, getChatAvatarColor } from '../../../shared/constants/chatExtras';

const STUDENT_MESSAGING_INTENT_KEY = 'studentMessagingIntent';
const QUICK_EMOJIS = CHAT_EMOJIS;
const CONTACT_POLL_INTERVAL_MS = 3600000;  // contact/thread list refreshes hourly; manual button for sooner
const MESSAGE_POLL_INTERVAL_MS = 6000;     // quiet background sync of the open thread

function uniqueIdentifiers(values) {
  return Array.from(new Set((values || []).map(value => String(value || '').trim()).filter(Boolean)));
}

function buildRequestInit(token, init = {}) {
  const nextHeaders = {
    ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...buildSelectedRoleHeader(),
    ...(init.headers || {}),
  };

  return {
    credentials: 'include',
    ...init,
    headers: nextHeaders,
  };
}

function prettifyIdentifier(identifier) {
  const value = String(identifier || '').trim();
  if (!value) return 'Conversation';
  if (value === 'support') return 'Ndovera Helpdesk';

  const base = value.includes('@') ? value.split('@')[0] : value;
  return base
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, letter => letter.toUpperCase());
}

function prettifyRole(roleKey) {
  const normalized = String(roleKey || '').trim().toLowerCase();
  if (!normalized) return 'School Contact';
  if (normalized === 'hos') return 'Head Of School';
  if (normalized === 'ict_manager') return 'ICT Manager';
  if (normalized === 'classteacher') return 'Class Teacher';
  if (normalized === 'examofficer') return 'Exam Officer';
  if (normalized === 'sportsmaster') return 'Sports Master';

  return normalized
    .replace(/_/g, ' ')
    .replace(/\b\w/g, letter => letter.toUpperCase());
}

function buildRoleKeys(person) {
  const explicitRoles = Array.isArray(person?.roles)
    ? person.roles
    : String(person?.roles || '')
      .split(',')
      .map(value => value.trim())
      .filter(Boolean);

  return uniqueIdentifiers([person?.primaryRole, person?.role, ...explicitRoles].map(value => String(value || '').toLowerCase()));
}

function buildInitials(value) {
  const parts = String(value || 'ND').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'ND';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
}

function groupMessagesByDate(messages) {
  const groups = new Map();

  (messages || []).forEach(message => {
    const sentAt = message.sentAt || message.sent_at || message.createdAt || new Date().toISOString();
    const key = new Date(sentAt).toISOString().slice(0, 10);
    const bucket = groups.get(key) || [];
    bucket.push(message);
    groups.set(key, bucket);
  });

  return Array.from(groups.entries()).map(([dateKey, items]) => {
    const date = new Date(`${dateKey}T00:00:00`);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    let label = date.toLocaleDateString();
    if (date.toDateString() === today.toDateString()) label = 'Today';
    if (date.toDateString() === yesterday.toDateString()) label = 'Yesterday';

    return { dateKey, label, items };
  });
}

function normalizeDirectoryContact(person) {
  const roleKeys = buildRoleKeys(person);
  const roleSummary = roleKeys.length ? roleKeys.map(prettifyRole).join(' • ') : 'School Contact';

  return {
    id: String(person?.id || person?.email || person?.displayId || '').trim(),
    name: String(person?.name || person?.email || 'School Contact').trim(),
    email: String(person?.email || '').trim(),
    displayId: String(person?.displayId || person?.publicStudentId || '').trim(),
    role: prettifyRole(roleKeys[0] || person?.role || 'contact'),
    roleKeys,
    roleSummary,
    status: String(person?.status || 'Active').trim() || 'Active',
    identifiers: uniqueIdentifiers([person?.id, person?.email, person?.displayId, person?.publicStudentId]),
    isAdmin: roleKeys.some(roleKey => roleKey === 'owner' || roleKey === 'hos'),
    isTeacher: roleKeys.includes('teacher') || roleKeys.includes('classteacher'),
    isStudent: roleKeys.includes('student'),
  };
}

function readStudentMessagingIntent() {
  try {
    return JSON.parse(window.sessionStorage.getItem(STUDENT_MESSAGING_INTENT_KEY) || 'null');
  } catch {
    return null;
  }
}

function clearStudentMessagingIntent() {
  try {
    window.sessionStorage.removeItem(STUDENT_MESSAGING_INTENT_KEY);
  } catch {}
}

async function requestJson(path, token, init = {}) {
  const response = await fetch(path, buildRequestInit(token, init));
  const json = await response.json().catch(() => ({}));

  if (!response.ok || json?.success === false) {
    throw new Error(json?.error || json?.message || 'Request failed.');
  }

  return json;
}

function contactMatchesQuery(contact, query) {
  const normalizedQuery = String(query || '').trim().toLowerCase();
  if (!normalizedQuery) return true;
  const haystack = [
    contact?.name,
    contact?.email,
    contact?.displayId,
    contact?.role,
    contact?.roleSummary,
  ].map(value => String(value || '').toLowerCase()).join(' ');
  return haystack.includes(normalizedQuery);
}

function getMessagingUiConfig(viewerRole) {
  const normalizedRole = String(viewerRole || 'student').trim().toLowerCase();

  if (normalizedRole === 'parent') {
    return {
      roleLabel: 'Parent',
      title: 'Messaging',
      subtitle: 'Message teachers, school admins, and helpdesk from one safe parent workspace.',
      hubDescription: 'Recent chats, school support, school admins, and every teacher in one sidebar.',
      emptyStateDescription: 'Pick a previous thread, chat with Ndovera Helpdesk, or message any teacher or school admin from the sidebar.',
      emptyConversationCopy: 'No previous parent chat matches yet. Start with helpdesk, a school admin, or a teacher below.',
      composerPlaceholder: 'Write a clear message to a teacher, school admin, or helpdesk...',
    };
  }

  if (normalizedRole === 'teacher') {
    return {
      roleLabel: 'Teacher',
      title: 'Messaging',
      subtitle: 'A clean school chat workspace for students, parents, staff, school admins, and helpdesk support.',
      hubDescription: 'Recent chats, school support, admins, parents, and student contacts in one sidebar.',
      emptyStateDescription: 'Pick a previous thread, chat with Ndovera Helpdesk, or open a student, parent, staff, or admin contact from the sidebar.',
      emptyConversationCopy: 'No previous teacher chat matches yet. Start with helpdesk, an admin, a parent, or a student below.',
      composerPlaceholder: 'Write a clear message to a student, parent, staff member, admin, or helpdesk...',
    };
  }

  return {
    roleLabel: 'Student',
    title: 'Messaging',
    subtitle: 'A clean school chat workspace for classmates, teachers, school admins, and helpdesk support.',
    hubDescription: 'Recent chats, school support, admins, and all contacts in one sidebar.',
    emptyStateDescription: 'Pick a previous thread, chat with Ndovera Helpdesk, message school admins, or open any contact from the sidebar.',
    emptyConversationCopy: 'No previous chat matches yet. Start with helpdesk, a school admin, or any contact below.',
    composerPlaceholder: 'Write a clear message to your classmate, teacher, school admin, or helpdesk...',
  };
}

function ConversationAvatar({ title, contactType = 'conversation' }) {
  const palette = contactType === 'support'
    ? 'border-[#1a5c38]/20 bg-[#1a5c38]/12 text-[#1a5c38] dark:border-[#00ffff]/25 dark:bg-[#00ffff]/12 dark:text-[#00ffff]'
    : contactType === 'admin'
      ? 'border-[#800000]/20 bg-[#800000]/12 text-[#800000] dark:border-[#bf00ff]/25 dark:bg-[#bf00ff]/12 dark:text-[#ffffff]'
      : 'border-[#800020]/15 bg-white/70 text-[#800020] dark:border-[#bf00ff]/20 dark:bg-[#191970]/40 dark:text-[#ffffff]';

  return (
    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border text-sm font-bold ${palette}`}>
      {buildInitials(title)}
    </span>
  );
}

export default function StudentMessaging({
  viewerRole = 'student',
  title,
  subtitle,
  dashboardLabel,
}) {
  const location = useLocation();
  const storedAuth = getStoredAuth();
  const authUser = storedAuth?.user || {};
  const token = storedAuth?.token || localStorage.getItem('token') || '';
  const me = authUser.id || authUser.email || localStorage.getItem('userId') || '';
  const normalizedViewerRole = String(viewerRole || 'student').trim().toLowerCase();
  const uiConfig = useMemo(() => getMessagingUiConfig(normalizedViewerRole), [normalizedViewerRole]);
  const selfIdentifiers = useMemo(() => uniqueIdentifiers([me, authUser.email, authUser.displayId]), [authUser.displayId, authUser.email, me]);

  const supportContact = useMemo(() => ({
    id: 'support',
    name: 'Ndovera Helpdesk',
    role: 'School Support',
    roleKeys: ['support'],
    roleSummary: 'School Support • Help Desk',
    status: 'Available',
    identifiers: ['support'],
    isAdmin: false,
    isTeacher: false,
    isStudent: false,
  }), []);

  const [directoryContacts, setDirectoryContacts] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState('');
  const [messages, setMessages] = useState([]);
  const [composer, setComposer] = useState('');
  const [contactQuery, setContactQuery] = useState('');
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [conversationsLoaded, setConversationsLoaded] = useState(false);
  const [actionError, setActionError] = useState('');
  const [pendingIntent, setPendingIntent] = useState(() => readStudentMessagingIntent());
  const [emojiTrayOpen, setEmojiTrayOpen] = useState(false);
  const [stickerTrayOpen, setStickerTrayOpen] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const [profileContact, setProfileContact] = useState(null);
  const startConversationRef = useRef(null);
  const contactSearchRef = useRef(null);
  const messagesEndRef = useRef(null);
  const messageSignatureRef = useRef('');

  async function refreshConversations(preferredConversationId) {
    if (!me) {
      setConversations([]);
      setActiveConversationId('');
      return;
    }

    const payload = await requestJson(`/api/conversations?userId=${encodeURIComponent(me)}`, token);
    const nextConversations = payload.conversations || [];

    setConversations(nextConversations);
    setActiveConversationId(currentConversationId => {
      const nextId = preferredConversationId || currentConversationId;
      if (nextId && nextConversations.some(conversation => conversation.id === nextId)) {
        return nextId;
      }
      return nextConversations[0]?.id || '';
    });
  }

  useEffect(() => {
    let ignore = false;

    async function loadContacts() {
      if (!me) {
        setDirectoryContacts([]);
        setLoadingContacts(false);
        return;
      }

      setLoadingContacts(true);

      try {
        const payload = await requestJson('/api/people?limit=250', token);
        const people = Array.isArray(payload?.people) ? payload.people : [];
        const contacts = people
          .map(normalizeDirectoryContact)
          .filter(contact => contact.id)
          .filter(contact => !contact.identifiers.some(identifier => selfIdentifiers.includes(identifier)))
          // School-wide chat = teachers, admins, students. Parents are excluded from the general chat
          // (parents themselves only reach school admins/teachers + helpdesk).
          .filter(contact => (
            normalizedViewerRole === 'parent'
              ? contact.isAdmin || contact.isTeacher
              : !contact.roleKeys.includes('parent')
          ))
          .sort((left, right) => {
            if (Number(right.isAdmin) !== Number(left.isAdmin)) return Number(right.isAdmin) - Number(left.isAdmin);
            if (Number(right.isTeacher) !== Number(left.isTeacher)) return Number(right.isTeacher) - Number(left.isTeacher);
            return left.name.localeCompare(right.name);
          });

        if (!ignore) {
          setDirectoryContacts(contacts);
        }
      } catch {
        if (!ignore) {
          setDirectoryContacts([]);
        }
      } finally {
        if (!ignore) {
          setLoadingContacts(false);
        }
      }
    }

    loadContacts();
    return () => {
      ignore = true;
    };
  }, [me, normalizedViewerRole, selfIdentifiers, token, refreshTick]);

  useEffect(() => {
    let ignore = false;

    async function loadConversations() {
      if (!me) {
        setConversations([]);
        setActiveConversationId('');
        setLoadingConversations(false);
        setConversationsLoaded(true);
        return;
      }

      setLoadingConversations(true);

      try {
        const payload = await requestJson(`/api/conversations?userId=${encodeURIComponent(me)}`, token);
        const nextConversations = payload.conversations || [];

        if (!ignore) {
          setConversations(nextConversations);
          setActiveConversationId(currentConversationId => {
            if (currentConversationId && nextConversations.some(conversation => conversation.id === currentConversationId)) {
              return currentConversationId;
            }
            return nextConversations[0]?.id || '';
          });
          setActionError('');
        }
      } catch (error) {
        if (!ignore) {
          setActionError(error instanceof Error ? error.message : 'Could not load conversations.');
        }
      } finally {
        if (!ignore) {
          setLoadingConversations(false);
          setConversationsLoaded(true);
        }
      }
    }

    loadConversations();
    const poll = window.setInterval(loadConversations, CONTACT_POLL_INTERVAL_MS);
    return () => {
      ignore = true;
      window.clearInterval(poll);
    };
  }, [me, token, refreshTick]);

  useEffect(() => {
    let ignore = false;
    messageSignatureRef.current = '';

    async function loadMessages({ silent = false } = {}) {
      if (!activeConversationId) {
        setMessages([]);
        setLoadingMessages(false);
        return;
      }

      if (!silent) setLoadingMessages(true);

      try {
        const payload = await requestJson(`/api/conversations/${encodeURIComponent(activeConversationId)}/messages`, token);
        const nextMessages = payload.messages || [];
        const lastMessage = nextMessages[nextMessages.length - 1] || {};
        const signature = `${activeConversationId}:${nextMessages.length}:${lastMessage.id || ''}:${lastMessage.readAt || lastMessage.read_at || ''}`;
        if (!ignore && (!silent || signature !== messageSignatureRef.current)) {
          messageSignatureRef.current = signature;
          setMessages(nextMessages);
        }

        await requestJson(`/api/conversations/${encodeURIComponent(activeConversationId)}/mark-read`, token, {
          method: 'POST',
        }).catch(() => null);
      } catch (error) {
        if (!ignore && !silent) {
          setActionError(error instanceof Error ? error.message : 'Could not load messages.');
        }
      } finally {
        if (!ignore && !silent) {
          setLoadingMessages(false);
        }
      }
    }

    loadMessages();
    const poll = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      loadMessages({ silent: true });
    }, MESSAGE_POLL_INTERVAL_MS);
    return () => {
      ignore = true;
      window.clearInterval(poll);
    };
  }, [activeConversationId, token]);

  // Keep the newest message in view so the thread always reads bottom-anchored.
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ block: 'end' });
    }
  }, [messages, activeConversationId]);

  const adminContacts = useMemo(() => directoryContacts.filter(contact => contact.isAdmin), [directoryContacts]);

  const filteredContactGroups = useMemo(() => {
    const normalizedQuery = String(contactQuery || '').trim().toLowerCase();
    const filterContacts = (contacts) => contacts.filter(contact => contactMatchesQuery(contact, normalizedQuery));

    if (normalizedViewerRole === 'parent') {
      return [
        { key: 'admins', label: 'School Admin', contacts: filterContacts(adminContacts) },
        { key: 'teachers', label: 'Teachers', contacts: filterContacts(directoryContacts.filter(contact => contact.isTeacher && !contact.isAdmin)) },
      ].filter(group => group.contacts.length > 0);
    }

    if (normalizedViewerRole === 'teacher') {
      return [
        { key: 'admins', label: 'School Admin', contacts: filterContacts(adminContacts) },
        { key: 'parents', label: 'Parents', contacts: filterContacts(directoryContacts.filter(contact => contact.roleKeys.includes('parent'))) },
        { key: 'students', label: 'Students', contacts: filterContacts(directoryContacts.filter(contact => contact.isStudent)) },
        { key: 'staff', label: 'Staff', contacts: filterContacts(directoryContacts.filter(contact => !contact.isAdmin && !contact.isStudent && !contact.roleKeys.includes('parent'))) },
      ].filter(group => group.contacts.length > 0);
    }

    return [
      { key: 'admins', label: 'School Admin', contacts: filterContacts(adminContacts) },
      { key: 'teachers', label: 'Teachers', contacts: filterContacts(directoryContacts.filter(contact => contact.isTeacher && !contact.isAdmin)) },
      { key: 'students', label: 'Students', contacts: filterContacts(directoryContacts.filter(contact => contact.isStudent)) },
      { key: 'others', label: 'Other Contacts', contacts: filterContacts(directoryContacts.filter(contact => !contact.isAdmin && !contact.isTeacher && !contact.isStudent)) },
    ].filter(group => group.contacts.length > 0);
  }, [adminContacts, contactQuery, directoryContacts, normalizedViewerRole]);

  const contactLookup = useMemo(() => {
    const map = new Map();
    const selfProfile = {
      id: me,
      name: String(authUser.name || authUser.email || 'You'),
      role: uiConfig.roleLabel,
      roleSummary: uiConfig.roleLabel,
      identifiers: selfIdentifiers,
      roleKeys: [normalizedViewerRole],
    };

    selfIdentifiers.forEach(identifier => map.set(identifier, selfProfile));
    directoryContacts.forEach(contact => {
      contact.identifiers.forEach(identifier => map.set(identifier, contact));
    });
    supportContact.identifiers.forEach(identifier => map.set(identifier, supportContact));

    return map;
  }, [authUser.email, authUser.name, directoryContacts, me, normalizedViewerRole, selfIdentifiers, supportContact, uiConfig.roleLabel]);

  const allContacts = useMemo(() => [supportContact, ...directoryContacts], [directoryContacts, supportContact]);

  const conversationCards = useMemo(() => {
    const normalizedQuery = String(contactQuery || '').trim().toLowerCase();

    return (conversations || []).map(conversation => {
      const participants = Array.isArray(conversation.participants) ? conversation.participants.map(value => String(value || '')) : [];
      const otherParticipants = participants.filter(identifier => !selfIdentifiers.includes(identifier));
      const otherProfiles = otherParticipants.map(identifier => contactLookup.get(identifier) || {
        id: identifier,
        name: prettifyIdentifier(identifier),
        role: 'School Contact',
        roleSummary: 'School Contact',
        roleKeys: [],
      });
      const primaryProfile = otherProfiles[0] || null;
      const title = String(conversation.subject || '').trim() || otherProfiles.map(profile => profile.name).join(', ') || 'Conversation';
      const subtitle = otherProfiles.map(profile => profile.roleSummary || profile.role).filter(Boolean).join(' • ') || 'Direct message';
      const lastUpdated = conversation.updated_at || conversation.updatedAt || conversation.created_at || conversation.createdAt || '';
      const card = {
        ...conversation,
        title,
        subtitle,
        lastUpdated,
        contactType: primaryProfile?.id === 'support'
          ? 'support'
          : primaryProfile?.roleKeys?.some(roleKey => roleKey === 'owner' || roleKey === 'hos')
            ? 'admin'
            : 'conversation',
      };

      if (!normalizedQuery) return card;

      const haystack = [
        title,
        subtitle,
        conversation?.subject,
        conversation?.preview,
        conversation?.lastMessage,
      ].map(value => String(value || '').toLowerCase()).join(' ');

      return haystack.includes(normalizedQuery) ? card : null;
    }).filter(Boolean).sort((left, right) => new Date(right.lastUpdated || 0).getTime() - new Date(left.lastUpdated || 0).getTime());
  }, [contactLookup, contactQuery, conversations, selfIdentifiers]);

  const activeConversation = useMemo(
    () => conversationCards.find(conversation => conversation.id === activeConversationId) || null,
    [activeConversationId, conversationCards],
  );

  const groupedMessages = useMemo(() => groupMessagesByDate(messages), [messages]);

  function resolveParticipantName(identifier) {
    return contactLookup.get(String(identifier || ''))?.name || prettifyIdentifier(identifier);
  }

  function resolveParticipantRole(identifier) {
    return contactLookup.get(String(identifier || ''))?.roleSummary || contactLookup.get(String(identifier || ''))?.role || 'School Contact';
  }

  async function startConversationWith(contact) {
    setActionError('');

    const existingConversation = conversations.find(conversation => {
      const participants = Array.isArray(conversation.participants) ? conversation.participants.map(value => String(value || '')) : [];
      const hasSelf = participants.some(identifier => selfIdentifiers.includes(identifier));
      const hasContact = participants.some(identifier => contact.identifiers.includes(identifier));
      return hasSelf && hasContact;
    });

    if (existingConversation) {
      setActiveConversationId(existingConversation.id);
      return;
    }

    try {
      const payload = await requestJson('/api/conversations', token, {
        method: 'POST',
        body: JSON.stringify({
          subject: '',
          participants: [me, contact.id],
        }),
      });
      const nextConversation = payload.conversation;
      setConversations(previous => [nextConversation, ...previous.filter(conversation => conversation.id !== nextConversation.id)]);
      setActiveConversationId(nextConversation.id);
      setMessages([]);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not start that conversation.');
    }
  }

  startConversationRef.current = startConversationWith;

  useEffect(() => {
    const requestedConversationId = String(location.state?.conversationId || '').trim();
    if (!requestedConversationId || !conversationsLoaded) return;
    if (requestedConversationId === activeConversationId) return;

    const existingConversation = conversations.find(conversation => conversation.id === requestedConversationId);
    if (existingConversation) {
      setActiveConversationId(existingConversation.id);
    }
  }, [activeConversationId, conversations, conversationsLoaded, location.state]);

  useEffect(() => {
    if (!pendingIntent || loadingContacts || loadingConversations) return;

    const finalizeIntent = () => {
      clearStudentMessagingIntent();
      setPendingIntent(null);
    };

    const requestedContact = pendingIntent.contact;
    const requestedIdentifiers = uniqueIdentifiers([
      requestedContact?.id,
      requestedContact?.email,
      requestedContact?.displayId,
    ]);
    const resolvedContact = requestedContact?.id === 'support'
      ? supportContact
      : allContacts.find(contact => contact.identifiers.some(identifier => requestedIdentifiers.includes(identifier))) || (requestedContact ? {
          id: String(requestedContact.id || requestedContact.email || requestedContact.displayId || ''),
          name: String(requestedContact.name || requestedContact.email || 'Conversation'),
          email: String(requestedContact.email || ''),
          displayId: String(requestedContact.displayId || ''),
          role: prettifyRole(requestedContact.role || 'contact'),
          roleKeys: [String(requestedContact.role || 'contact').toLowerCase()],
          roleSummary: prettifyRole(requestedContact.role || 'contact'),
          status: String(requestedContact.status || 'Active'),
          identifiers: requestedIdentifiers,
          isAdmin: false,
          isTeacher: false,
          isStudent: false,
        } : null);

    if (pendingIntent.composeDraft) {
      setComposer(currentValue => currentValue || pendingIntent.composeDraft);
    }

    if (resolvedContact?.id && startConversationRef.current) {
      Promise.resolve(startConversationRef.current(resolvedContact)).finally(finalizeIntent);
      return;
    }

    finalizeIntent();
  }, [allContacts, loadingContacts, loadingConversations, pendingIntent, supportContact]);

  async function sendMessage() {
    if (!composer.trim() || !activeConversationId) return;

    const localId = `local_${Date.now()}`;
    const optimisticMessage = {
      id: localId,
      conversationId: activeConversationId,
      senderId: me,
      body: composer.trim(),
      sentAt: new Date().toISOString(),
      status: 'sending',
    };

    setMessages(previous => [...previous, optimisticMessage]);
    setComposer('');
    setActionError('');
    setEmojiTrayOpen(false);

    try {
      const payload = await requestJson(`/api/conversations/${encodeURIComponent(activeConversationId)}/messages`, token, {
        method: 'POST',
        body: JSON.stringify({ senderId: me, body: optimisticMessage.body }),
      });

      if (payload.message) {
        setMessages(previous => previous.map(message => (message.id === localId ? payload.message : message)));
      }

      await refreshConversations(activeConversationId);
    } catch (error) {
      setMessages(previous => previous.map(message => (message.id === localId ? { ...message, status: 'failed' } : message)));
      setActionError(error instanceof Error ? error.message : 'Could not send the message.');
    }
  }

  async function retryMessage(localId) {
    const message = messages.find(entry => entry.id === localId);
    if (!message || !activeConversationId) return;

    setMessages(previous => previous.map(entry => (entry.id === localId ? { ...entry, status: 'sending' } : entry)));

    try {
      const payload = await requestJson(`/api/conversations/${encodeURIComponent(activeConversationId)}/messages`, token, {
        method: 'POST',
        body: JSON.stringify({ senderId: me, body: message.body || '' }),
      });

      if (payload.message) {
        setMessages(previous => previous.map(entry => (entry.id === localId ? payload.message : entry)));
      }

      await refreshConversations(activeConversationId);
    } catch (error) {
      setMessages(previous => previous.map(entry => (entry.id === localId ? { ...entry, status: 'failed' } : entry)));
      setActionError(error instanceof Error ? error.message : 'Could not resend the message.');
    }
  }

  function handleComposerKey(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }

  function appendEmoji(emoji) {
    setComposer(current => `${current}${emoji}`);
  }

  function refreshLists() {
    setRefreshTick(tick => tick + 1);
  }

  function openProfile(identifier) {
    const contact = contactLookup.get(String(identifier || '')) || null;
    if (contact) setProfileContact(contact);
  }

  async function sendSticker(sticker) {
    setStickerTrayOpen(false);
    if (!activeConversationId) return;
    try {
      await requestJson(`/api/conversations/${encodeURIComponent(activeConversationId)}/messages`, token, {
        method: 'POST',
        body: JSON.stringify({ senderId: me, body: sticker }),
      });
      await refreshConversations(activeConversationId);
      messageSignatureRef.current = '';
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not send sticker.');
    }
  }

  return (
    <StudentSectionShell
      title={title || uiConfig.title}
      subtitle={subtitle || uiConfig.subtitle}
      dashboardLabel={dashboardLabel || `${uiConfig.roleLabel} Dashboard`}
      watermarkText={`${uiConfig.roleLabel} Messaging`}
    >
      <div className="grid min-h-[calc(100vh-12rem)] grid-cols-1 gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="flex min-h-[42rem] flex-col overflow-hidden rounded-[2rem] border border-[#800000]/15 bg-[#f5deb3]/95 shadow-[0_22px_48px_rgba(128,0,0,0.08)] dark:border-[#bf00ff]/30 dark:bg-[#800000]/70">
          <div className="border-b border-[#800000]/10 px-5 py-5 dark:border-[#bf00ff]/20">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1a5c38]/12 text-[#1a5c38] dark:bg-[#00ffff]/12 dark:text-[#00ffff]">
                <ChatBubbleLeftRightIcon className="h-6 w-6" />
              </span>
              <div>
                <h2 className="text-xl font-semibold text-[#800000] dark:text-[#0000ff]">Chat Hub</h2>
                <p className="mt-1 text-sm text-[#191970] dark:text-[#39ff14]">{uiConfig.hubDescription}</p>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <label className="flex flex-1 items-center gap-3 rounded-2xl border border-[#800000]/10 bg-white/70 px-4 py-3 dark:border-[#bf00ff]/20 dark:bg-[#191970]/35">
                <MagnifyingGlassIcon className="h-5 w-5 text-[#800020] dark:text-[#bf00ff]" />
                <input
                  ref={contactSearchRef}
                  value={contactQuery}
                  onChange={event => setContactQuery(event.target.value)}
                  placeholder="Search a name to chat with"
                  className="w-full bg-transparent text-sm text-[#191970] outline-none placeholder:text-[#800020]/65 dark:text-[#ffffff] dark:placeholder:text-[#bf00ff]/70"
                />
              </label>
              <button
                type="button"
                onClick={refreshLists}
                className="shrink-0 rounded-2xl bg-[#1a5c38] px-3 py-3 text-xs font-bold text-[#f5deb3] dark:bg-[#00ffff] dark:text-black"
                title="Refresh contacts"
              >
                {loadingContacts || loadingConversations ? '…' : '↻'}
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4">
            <div className="rounded-3xl border border-[#800000]/10 bg-white/55 p-4 dark:border-[#bf00ff]/20 dark:bg-[#191970]/35">
              <div className="flex items-center gap-2">
                <LifebuoyIcon className="h-5 w-5 text-[#1a5c38] dark:text-[#00ffff]" />
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#800020] dark:text-[#bf00ff]">Quick Channels</p>
              </div>
              <div className="mt-3 space-y-2">
                <button
                  type="button"
                  onClick={() => startConversationWith(supportContact)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-[#1a5c38]/15 bg-[#1a5c38]/8 px-3 py-3 text-left transition hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(26,92,56,0.10)] dark:border-[#00ffff]/20 dark:bg-[#00ffff]/10"
                >
                  <ConversationAvatar title={supportContact.name} contactType="support" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#800000] dark:text-[#ffffff]">{supportContact.name}</p>
                    <p className="truncate text-xs text-[#800020] dark:text-[#bf00ff]">{supportContact.roleSummary}</p>
                  </div>
                </button>

                {adminContacts.slice(0, 3).map(contact => (
                  <button
                    key={contact.id}
                    type="button"
                    onClick={() => startConversationWith(contact)}
                    className="flex w-full items-center gap-3 rounded-2xl border border-[#800000]/10 bg-[#fff7ea] px-3 py-3 text-left transition hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(128,0,0,0.10)] dark:border-[#bf00ff]/20 dark:bg-[#191970]/30"
                  >
                    <ConversationAvatar title={contact.name} contactType="admin" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#800000] dark:text-[#ffffff]">{contact.name}</p>
                      <p className="truncate text-xs text-[#800020] dark:text-[#bf00ff]">{contact.roleSummary}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 rounded-3xl border border-[#800000]/10 bg-white/55 p-4 dark:border-[#bf00ff]/20 dark:bg-[#191970]/35">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <ShieldCheckIcon className="h-5 w-5 text-[#800020] dark:text-[#bf00ff]" />
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#800020] dark:text-[#bf00ff]">Previous Chats</p>
                </div>
                <span className="text-[11px] font-semibold text-[#800020] dark:text-[#bf00ff]">
                  {loadingConversations ? 'Refreshing...' : `${conversationCards.length} thread${conversationCards.length === 1 ? '' : 's'}`}
                </span>
              </div>

              <div className="mt-3 space-y-2">
                {conversationCards.map(conversation => (
                  <button
                    key={conversation.id}
                    type="button"
                    onClick={() => setActiveConversationId(conversation.id)}
                    className={`flex w-full items-start gap-3 rounded-2xl border px-3 py-3 text-left transition ${activeConversationId === conversation.id
                      ? 'border-[#1a5c38]/35 bg-[#1a5c38]/10 dark:border-[#00ffff] dark:bg-[#00ffff]/10'
                      : 'border-[#800000]/10 bg-[#fff8ee] hover:-translate-y-0.5 hover:shadow-[0_14px_28px_rgba(128,0,0,0.08)] dark:border-[#bf00ff]/20 dark:bg-[#120014]/55'
                    }`}
                  >
                    <ConversationAvatar title={conversation.title} contactType={conversation.contactType} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[#800000] dark:text-[#ffffff]">{conversation.title}</p>
                      <p className="mt-1 truncate text-xs text-[#800020] dark:text-[#bf00ff]">{conversation.subtitle}</p>
                      <p className="mt-2 truncate text-[11px] text-[#191970]/75 dark:text-[#39ff14]/80">
                        {conversation.lastUpdated ? new Date(conversation.lastUpdated).toLocaleString() : 'No messages yet'}
                      </p>
                    </div>
                  </button>
                ))}

                {!loadingConversations && conversationCards.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[#800000]/15 px-4 py-5 text-sm text-[#191970] dark:border-[#bf00ff]/25 dark:text-[#39ff14]">
                    {uiConfig.emptyConversationCopy}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="mt-4 rounded-3xl border border-[#800000]/10 bg-white/55 p-4 dark:border-[#bf00ff]/20 dark:bg-[#191970]/35">
              <div className="flex items-center gap-2">
                <UserGroupIcon className="h-5 w-5 text-[#800020] dark:text-[#bf00ff]" />
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#800020] dark:text-[#bf00ff]">Contacts</p>
              </div>

              <div className="mt-3 space-y-4">
                {loadingContacts ? (
                  <p className="text-sm text-[#191970] dark:text-[#39ff14]">Loading school contacts...</p>
                ) : filteredContactGroups.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[#800000]/15 px-4 py-5 text-sm text-[#191970] dark:border-[#bf00ff]/25 dark:text-[#39ff14]">
                    No contacts match your search yet.
                  </div>
                ) : filteredContactGroups.map(group => (
                  <div key={group.key}>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#800020] dark:text-[#bf00ff]">{group.label}</p>
                      <span className="text-[11px] text-[#191970] dark:text-[#39ff14]">{group.contacts.length}</span>
                    </div>
                    <div className="space-y-2">
                      {group.contacts.map(contact => (
                        <button
                          key={contact.id}
                          type="button"
                          onClick={() => startConversationWith(contact)}
                          className="flex w-full items-center gap-3 rounded-2xl border border-[#800000]/10 bg-[#fff8ee] px-3 py-3 text-left transition hover:-translate-y-0.5 hover:shadow-[0_12px_24px_rgba(128,0,0,0.08)] dark:border-[#bf00ff]/20 dark:bg-[#120014]/55"
                        >
                          <ConversationAvatar title={contact.name} contactType={contact.isAdmin ? 'admin' : 'conversation'} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-[#800000] dark:text-[#ffffff]">{contact.name}</p>
                            <p className="truncate text-xs text-[#800020] dark:text-[#bf00ff]">
                              {contact.roleSummary}{contact.displayId ? ` • ${contact.displayId}` : ''}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </aside>

        <section className="flex min-h-[42rem] flex-col overflow-hidden rounded-[2rem] border border-[#800000]/15 bg-[#f5deb3] shadow-[0_26px_60px_rgba(128,0,0,0.10)] dark:border-[#bf00ff]/30 dark:bg-[#800000]/75">
          {!me ? (
            <div className="flex flex-1 items-center justify-center px-6 text-sm text-[#191970] dark:text-[#39ff14]">
              Sign in again to load your messages.
            </div>
          ) : !activeConversation ? (
            <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-[#1a5c38]/12 text-[#1a5c38] dark:bg-[#00ffff]/12 dark:text-[#00ffff]">
                <ChatBubbleLeftRightIcon className="h-8 w-8" />
              </span>
              <h3 className="mt-5 text-2xl font-semibold text-[#800000] dark:text-[#0000ff]">Open a school chat</h3>
              <p className="mt-2 max-w-xl text-sm leading-6 text-[#191970] dark:text-[#39ff14]">
                {uiConfig.emptyStateDescription}
              </p>
            </div>
          ) : (
            <>
              <div className="border-b border-[#800000]/10 px-6 py-5 dark:border-[#bf00ff]/20">
                <div className="flex items-start gap-4">
                  <ConversationAvatar title={activeConversation.title} contactType={activeConversation.contactType} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="truncate text-2xl font-semibold text-[#800000] dark:text-[#0000ff]">{activeConversation.title}</h3>
                      <span className="rounded-full bg-[#1a5c38] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[#f5deb3] dark:bg-[#00ffff] dark:text-black">
                        Safe School Chat
                      </span>
                    </div>
                    <p className="mt-1 truncate text-sm text-[#191970] dark:text-[#39ff14]">{activeConversation.subtitle}</p>
                    <p className="mt-2 text-[11px] text-[#800020] dark:text-[#bf00ff]">
                      {activeConversation.lastUpdated ? `Updated ${new Date(activeConversation.lastUpdated).toLocaleString()}` : 'Direct school conversation'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.45),transparent_42%)] px-6 py-5 dark:bg-[radial-gradient(circle_at_top_left,rgba(0,255,255,0.08),transparent_42%)]">
                {loadingMessages ? (
                  <div className="text-sm text-[#191970] dark:text-[#39ff14]">Loading messages...</div>
                ) : groupedMessages.length === 0 ? (
                  <div className="flex h-full items-center justify-center rounded-[1.5rem] border border-dashed border-[#800000]/15 bg-white/35 px-6 text-sm text-[#191970] dark:border-[#bf00ff]/25 dark:bg-[#191970]/25 dark:text-[#39ff14]">
                    No messages yet. Start the conversation from the composer below.
                  </div>
                ) : (
                  <div className="space-y-6">
                    {groupedMessages.map(group => (
                      <div key={group.dateKey}>
                        <div className="mb-4 text-center text-[11px] font-semibold uppercase tracking-[0.22em] text-[#800020] dark:text-[#bf00ff]">
                          {group.label}
                        </div>
                        <div className="space-y-3">
                          {group.items.map(message => {
                            const senderIdentifier = String(message.senderId || '');
                            const isOwn = selfIdentifiers.includes(senderIdentifier);
                            const sentAt = message.sentAt || message.sent_at || message.createdAt || new Date().toISOString();
                            const senderName = isOwn ? String(authUser.name || 'You') : resolveParticipantName(message.senderId);

                            return (
                              <div key={message.id} className={`flex items-end gap-2 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                                {!isOwn ? (
                                  <button type="button" onClick={() => openProfile(senderIdentifier)} title="View details" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: getChatAvatarColor(senderIdentifier) }}>
                                    {getChatInitials(senderName)}
                                  </button>
                                ) : null}
                                <div className={`max-w-[80%] rounded-[1.6rem] border px-4 py-3 shadow-sm ${isOwn
                                  ? 'border-[#1a5c38]/20 bg-[#1a5c38]/12 text-[#191970] dark:border-[#00ffff]/25 dark:bg-[#00ffff]/10 dark:text-[#ffffff]'
                                  : 'border-[#800000]/12 bg-[#fff7eb] text-[#191970] dark:border-[#bf00ff]/20 dark:bg-[#191970]/40 dark:text-[#39ff14]'
                                }`}>
                                  <div className="text-xs font-semibold text-[#800020] dark:text-[#bf00ff]">
                                    {isOwn ? 'You' : senderName}
                                  </div>
                                  <div className="mt-2 whitespace-pre-wrap text-sm leading-6">{message.body}</div>
                                  <div className="mt-3 flex items-center justify-between gap-4 text-[11px] text-[#191970]/75 dark:text-[#39ff14]/75">
                                    <span>{new Date(sentAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
                                    <span>
                                      {isOwn
                                        ? (message.readAt ? 'Read' : message.status === 'sending' ? 'Sending...' : message.status === 'failed' ? 'Failed' : 'Sent')
                                        : resolveParticipantRole(message.senderId)}
                                    </span>
                                  </div>
                                  {message.status === 'failed' ? (
                                    <button
                                      type="button"
                                      onClick={() => retryMessage(message.id)}
                                      className="mt-3 rounded-full bg-[#00ffff] px-3 py-1 text-xs font-bold text-black"
                                    >
                                      Retry
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              <div className="border-t border-[#800000]/10 bg-white/40 px-6 py-5 dark:border-[#bf00ff]/20 dark:bg-[#191970]/25">
                {actionError ? (
                  <div className="mb-4 rounded-2xl border border-[#800000]/15 bg-[#fff3df] px-4 py-3 text-sm text-[#800000] dark:border-[#bf00ff]/25 dark:bg-[#2a0f3c] dark:text-[#ffffff]">
                    {actionError}
                  </div>
                ) : null}

                {emojiTrayOpen ? (
                  <div className="mb-3 max-h-44 overflow-y-auto rounded-2xl border border-[#800000]/10 bg-[#fff8ee] p-2 dark:border-[#bf00ff]/20 dark:bg-[#120014]/55">
                    <div className="flex flex-wrap items-center gap-1">
                      {QUICK_EMOJIS.map((emoji, index) => (
                        <button
                          key={`${emoji}-${index}`}
                          type="button"
                          onClick={() => appendEmoji(emoji)}
                          className="rounded-lg px-1.5 py-1 text-xl transition hover:bg-[#1a5c38]/15"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {stickerTrayOpen ? (
                  <div className="mb-3 max-h-44 overflow-y-auto rounded-2xl border border-[#800000]/10 bg-[#fff8ee] p-2 dark:border-[#bf00ff]/20 dark:bg-[#120014]/55">
                    <div className="grid grid-cols-6 gap-2 sm:grid-cols-8">
                      {CHAT_STICKERS.map((sticker, index) => (
                        <button
                          key={`${sticker}-${index}`}
                          type="button"
                          onClick={() => sendSticker(sticker)}
                          className="rounded-xl py-2 text-3xl transition hover:bg-[#1a5c38]/15"
                        >
                          {sticker}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="rounded-[1.6rem] border border-[#800000]/10 bg-[#fffaf3] p-3 dark:border-[#bf00ff]/20 dark:bg-[#120014]/70">
                  <textarea
                    value={composer}
                    onChange={event => setComposer(event.target.value)}
                    onKeyDown={handleComposerKey}
                    rows={3}
                    placeholder={uiConfig.composerPlaceholder}
                    className="w-full resize-none bg-transparent px-2 py-2 text-sm text-[#191970] outline-none placeholder:text-[#800020]/65 dark:text-[#ffffff] dark:placeholder:text-[#bf00ff]/70"
                  />
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-[#800000]/10 pt-3 dark:border-[#bf00ff]/20">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => { setEmojiTrayOpen(current => !current); setStickerTrayOpen(false); }}
                        className="flex h-10 w-10 items-center justify-center rounded-full border border-[#800000]/10 bg-white/75 text-[#800020] transition hover:border-[#1a5c38]/35 hover:text-[#1a5c38] dark:border-[#bf00ff]/20 dark:bg-[#191970]/35 dark:text-[#bf00ff] dark:hover:border-[#00ffff] dark:hover:text-[#00ffff]"
                        aria-label="Toggle emojis"
                      >
                        <FaceSmileIcon className="h-5 w-5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => { setStickerTrayOpen(current => !current); setEmojiTrayOpen(false); }}
                        className="flex h-10 w-10 items-center justify-center rounded-full border border-[#800000]/10 bg-white/75 text-lg transition hover:border-[#1a5c38]/35 dark:border-[#bf00ff]/20 dark:bg-[#191970]/35"
                        aria-label="Toggle stickers"
                        title="Stickers"
                      >
                        🩷
                      </button>
                      <button
                        type="button"
                        onClick={() => contactSearchRef.current?.focus()}
                        className="flex h-10 w-10 items-center justify-center rounded-full border border-[#800000]/10 bg-white/75 text-[#800020] transition hover:border-[#1a5c38]/35 hover:text-[#1a5c38] dark:border-[#bf00ff]/20 dark:bg-[#191970]/35 dark:text-[#bf00ff] dark:hover:border-[#00ffff] dark:hover:text-[#00ffff]"
                        aria-label="Open contacts"
                      >
                        <UserGroupIcon className="h-5 w-5" />
                      </button>
                      <p className="text-xs text-[#800020] dark:text-[#bf00ff]">Chats stay within your authenticated school network.</p>
                    </div>

                    <button
                      type="button"
                      onClick={sendMessage}
                      disabled={!composer.trim()}
                      className="inline-flex items-center gap-2 rounded-full bg-[#1a5c38] px-5 py-2.5 text-sm font-bold text-[#f5deb3] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#00ffff] dark:text-black"
                    >
                      <PaperAirplaneIcon className="h-4 w-4" />
                      Send Message
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </section>
      </div>

      {profileContact ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="presentation" onClick={() => setProfileContact(null)}>
          <div className="w-full max-w-sm rounded-3xl border border-[#800000]/20 bg-[#fff8ee] p-6 text-center shadow-2xl dark:border-[#bf00ff]/30 dark:bg-[#191970]" onClick={event => event.stopPropagation()}>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full text-xl font-bold text-white" style={{ backgroundColor: getChatAvatarColor(profileContact.id) }}>
              {getChatInitials(profileContact.name)}
            </div>
            <h3 className="mt-3 text-lg font-bold text-[#800000] dark:text-white">{profileContact.name}</h3>
            <p className="mt-1 text-sm text-[#800020] dark:text-[#bf00ff]">{profileContact.roleSummary || profileContact.role}</p>
            {profileContact.email ? <p className="mt-1 text-xs text-[#191970] dark:text-[#39ff14]">{profileContact.email}</p> : null}
            {profileContact.displayId ? <p className="mt-1 text-xs text-[#191970]/70 dark:text-[#39ff14]/70">ID: {profileContact.displayId}</p> : null}
            <div className="mt-4 flex justify-center gap-2">
              <button type="button" onClick={() => { startConversationWith(profileContact); setProfileContact(null); }} className="rounded-2xl bg-[#1a5c38] px-4 py-2 text-sm font-bold text-[#f5deb3] dark:bg-[#00ffff] dark:text-black">Message</button>
              <button type="button" onClick={() => setProfileContact(null)} className="rounded-2xl border border-[#800020]/20 px-4 py-2 text-sm font-bold text-[#800020] dark:border-[#bf00ff]/30 dark:text-[#bf00ff]">Close</button>
            </div>
          </div>
        </div>
      ) : null}
    </StudentSectionShell>
  );
}