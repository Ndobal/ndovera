import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import StudentSectionShell from './StudentSectionShell';
import { getStoredAuth } from '../../../features/auth/services/authApi';

const STUDENT_MESSAGING_INTENT_KEY = 'studentMessagingIntent';

function uniqueIdentifiers(values) {
  return Array.from(new Set((values || []).map(value => String(value || '').trim()).filter(Boolean)));
}

function buildRequestInit(token, init = {}) {
  const nextHeaders = {
    ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
  if (value === 'support') return 'School Support';

  const base = value.includes('@') ? value.split('@')[0] : value;
  return base
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, letter => letter.toUpperCase());
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

function normalizeTeacherContact(member) {
  return {
    id: String(member.id || member.email || member.displayId || ''),
    name: String(member.name || member.email || 'Teacher'),
    email: String(member.email || ''),
    displayId: String(member.displayId || ''),
    role: member.isClassTeacher ? 'Class Teacher' : 'Subject Teacher',
    status: String(member.status || 'Active'),
    isClassTeacher: Boolean(member.isClassTeacher),
    identifiers: uniqueIdentifiers([member.id, member.email, member.displayId]),
  };
}

function normalizeStudentContact(member) {
  return {
    id: String(member.id || member.email || member.displayId || ''),
    name: String(member.name || member.email || 'Classmate'),
    email: String(member.email || ''),
    displayId: String(member.displayId || ''),
    role: 'Classmate',
    status: String(member.status || 'Active'),
    isClassTeacher: false,
    identifiers: uniqueIdentifiers([member.id, member.email, member.displayId]),
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

export default function StudentMessaging() {
  const location = useLocation();
  const storedAuth = getStoredAuth();
  const authUser = storedAuth?.user || {};
  const token = storedAuth?.token || localStorage.getItem('token') || '';
  const me = authUser.id || authUser.email || localStorage.getItem('userId') || '';
  const classroomId = authUser.classId || localStorage.getItem('classroomId') || '';
  const selfIdentifiers = useMemo(() => uniqueIdentifiers([me, authUser.email, authUser.displayId]), [authUser.displayId, authUser.email, me]);

  const supportContact = useMemo(() => ({
    id: 'support',
    name: 'School Support',
    role: 'Help Desk',
    status: 'Available',
    isClassTeacher: false,
    identifiers: ['support'],
  }), []);

  const [teacherContacts, setTeacherContacts] = useState([]);
  const [classmateContacts, setClassmateContacts] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState('');
  const [messages, setMessages] = useState([]);
  const [composer, setComposer] = useState('');
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [conversationsLoaded, setConversationsLoaded] = useState(false);
  const [actionError, setActionError] = useState('');
  const [pendingIntent, setPendingIntent] = useState(() => readStudentMessagingIntent());
  const startConversationRef = useRef(null);

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
      if (!classroomId || !me) {
        setTeacherContacts([]);
        setLoadingContacts(false);
        return;
      }

      setLoadingContacts(true);

      try {
        const payload = await requestJson(`/api/classrooms/${encodeURIComponent(classroomId)}/members`, token);
        const members = payload.members || [];
        const teachers = members
          .filter(member => String(member.role || '').toLowerCase() === 'teacher')
          .map(normalizeTeacherContact)
          .sort((left, right) => Number(Boolean(right.isClassTeacher)) - Number(Boolean(left.isClassTeacher)) || left.name.localeCompare(right.name));
        const classmates = members
          .filter(member => String(member.role || '').toLowerCase() === 'student')
          .map(normalizeStudentContact)
          .filter(contact => !contact.identifiers.some(identifier => selfIdentifiers.includes(identifier)))
          .sort((left, right) => left.name.localeCompare(right.name));

        if (!ignore) {
          setTeacherContacts(teachers);
          setClassmateContacts(classmates);
        }
      } catch {
        if (!ignore) {
          setTeacherContacts([]);
          setClassmateContacts([]);
        }
      } finally {
        if (!ignore) {
          setLoadingContacts(false);
        }
      }
    }

    loadContacts();
    return () => { ignore = true; };
  }, [classroomId, me, selfIdentifiers, supportContact, token]);

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
    const poll = window.setInterval(loadConversations, 12000);
    return () => {
      ignore = true;
      window.clearInterval(poll);
    };
  }, [me, token]);

  useEffect(() => {
    let ignore = false;

    async function loadMessages() {
      if (!activeConversationId) {
        setMessages([]);
        setLoadingMessages(false);
        return;
      }

      setLoadingMessages(true);

      try {
        const payload = await requestJson(`/api/conversations/${encodeURIComponent(activeConversationId)}/messages`, token);
        if (!ignore) {
          setMessages(payload.messages || []);
        }

        await requestJson(`/api/conversations/${encodeURIComponent(activeConversationId)}/mark-read`, token, {
          method: 'POST',
        }).catch(() => null);
      } catch (error) {
        if (!ignore) {
          setActionError(error instanceof Error ? error.message : 'Could not load messages.');
        }
      } finally {
        if (!ignore) {
          setLoadingMessages(false);
        }
      }
    }

    loadMessages();
    const poll = window.setInterval(loadMessages, 9000);
    return () => {
      ignore = true;
      window.clearInterval(poll);
    };
  }, [activeConversationId, token]);

  const contactLookup = useMemo(() => {
    const map = new Map();
    const selfProfile = {
      id: me,
      name: String(authUser.name || authUser.email || 'You'),
      role: 'Student',
      status: 'Active',
      identifiers: selfIdentifiers,
    };

    selfIdentifiers.forEach(identifier => map.set(identifier, selfProfile));
    teacherContacts.forEach(contact => {
      contact.identifiers.forEach(identifier => map.set(identifier, contact));
    });
    classmateContacts.forEach(contact => {
      contact.identifiers.forEach(identifier => map.set(identifier, contact));
    });
    supportContact.identifiers.forEach(identifier => map.set(identifier, supportContact));

    return map;
  }, [authUser.email, authUser.name, classmateContacts, me, selfIdentifiers, supportContact, teacherContacts]);

  const allContacts = useMemo(() => [...teacherContacts, ...classmateContacts, supportContact], [classmateContacts, supportContact, teacherContacts]);

  const conversationCards = useMemo(() => {
    return (conversations || []).map(conversation => {
      const participants = Array.isArray(conversation.participants) ? conversation.participants.map(value => String(value || '')) : [];
      const otherParticipants = participants.filter(identifier => !selfIdentifiers.includes(identifier));
      const otherProfiles = otherParticipants.map(identifier => contactLookup.get(identifier) || {
        id: identifier,
        name: prettifyIdentifier(identifier),
        role: 'School Contact',
      });

      return {
        ...conversation,
        title: String(conversation.subject || '').trim() || otherProfiles.map(profile => profile.name).join(', ') || 'Conversation',
        subtitle: otherProfiles.map(profile => profile.role).filter(Boolean).join(' • ') || 'Direct message',
        lastUpdated: conversation.updated_at || conversation.updatedAt || conversation.created_at || conversation.createdAt || '',
      };
    }).sort((left, right) => new Date(right.lastUpdated || 0).getTime() - new Date(left.lastUpdated || 0).getTime());
  }, [contactLookup, conversations, selfIdentifiers]);

  const activeConversation = useMemo(
    () => conversationCards.find(conversation => conversation.id === activeConversationId) || null,
    [activeConversationId, conversationCards],
  );

  const groupedMessages = useMemo(() => groupMessagesByDate(messages), [messages]);

  function resolveParticipantName(identifier) {
    return contactLookup.get(String(identifier || ''))?.name || prettifyIdentifier(identifier);
  }

  function resolveParticipantRole(identifier) {
    return contactLookup.get(String(identifier || ''))?.role || 'School Contact';
  }

  async function startConversationWith(contact) {
    setActionError('');

    const existingConversation = conversationCards.find(conversation => {
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
          role: String(requestedContact.role || 'Classmate'),
          status: String(requestedContact.status || 'Active'),
          isClassTeacher: false,
          identifiers: requestedIdentifiers,
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

    try {
      const payload = await requestJson(`/api/conversations/${encodeURIComponent(activeConversationId)}/messages`, token, {
        method: 'POST',
        body: JSON.stringify({ senderId: me, body: optimisticMessage.body }),
      });

      if (payload.message) {
        setMessages(previous => previous.map(message => message.id === localId ? payload.message : message));
      }

      await refreshConversations(activeConversationId);
    } catch (error) {
      setMessages(previous => previous.map(message => message.id === localId ? { ...message, status: 'failed' } : message));
      setActionError(error instanceof Error ? error.message : 'Could not send the message.');
    }
  }

  async function retryMessage(localId) {
    const message = messages.find(entry => entry.id === localId);
    if (!message || !activeConversationId) return;

    setMessages(previous => previous.map(entry => entry.id === localId ? { ...entry, status: 'sending' } : entry));

    try {
      const payload = await requestJson(`/api/conversations/${encodeURIComponent(activeConversationId)}/messages`, token, {
        method: 'POST',
        body: JSON.stringify({ senderId: me, body: message.body || '' }),
      });

      if (payload.message) {
        setMessages(previous => previous.map(entry => entry.id === localId ? payload.message : entry));
      }

      await refreshConversations(activeConversationId);
    } catch (error) {
      setMessages(previous => previous.map(entry => entry.id === localId ? { ...entry, status: 'failed' } : entry));
      setActionError(error instanceof Error ? error.message : 'Could not resend the message.');
    }
  }

  function handleComposerKey(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }

  return (
    <StudentSectionShell title="Messaging" subtitle="Chat with classmates, teachers, and school support from one place.">
      <div className="grid grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)] gap-5">
        <div className="space-y-4">
          <section className="rounded-3xl border border-[#800000]/15 bg-[#f5deb3]/95 p-4 shadow-[0_18px_40px_rgba(128,0,0,0.08)] dark:border-[#bf00ff]/30 dark:bg-[#800000]/70">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-[#800000] dark:text-[#0000ff]">People In Your Class</h3>
                <p className="mt-1 text-sm text-[#191970] dark:text-[#39ff14]">Open a direct conversation with classmates, teachers, or school support.</p>
              </div>
              <span className="rounded-full bg-[#800000]/10 px-3 py-1 text-xs font-semibold text-[#800020] dark:bg-[#00ffff]/20 dark:text-[#bf00ff]">
                {loadingContacts ? 'Loading' : `${teacherContacts.length + classmateContacts.length} contacts`}
              </span>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#800020] dark:text-[#bf00ff]">Teachers</p>
                  <span className="text-xs text-[#191970] dark:text-[#39ff14]">{teacherContacts.length}</span>
                </div>
              {teacherContacts.map(contact => (
                <button
                  key={contact.id}
                  type="button"
                  onClick={() => startConversationWith(contact)}
                  className="flex w-full items-start justify-between rounded-2xl border border-[#800000]/10 bg-white/50 px-4 py-3 text-left transition hover:-translate-y-0.5 hover:border-[#1a5c38]/40 hover:shadow-[0_14px_30px_rgba(26,92,56,0.12)] dark:border-[#bf00ff]/25 dark:bg-[#191970]/35"
                >
                  <div>
                    <div className="text-sm font-semibold text-[#800000] dark:text-[#ffffff]">{contact.name}</div>
                    <div className="mt-1 text-xs text-[#800020] dark:text-[#bf00ff]">{contact.role}</div>
                  </div>
                  <span className="rounded-full bg-[#1a5c38] px-3 py-1 text-xs font-bold text-[#f5deb3] dark:bg-[#00ffff] dark:text-black">
                    Chat
                  </span>
                </button>
              ))}

              {!loadingContacts && teacherContacts.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#800000]/20 px-4 py-4 text-sm text-[#191970] dark:border-[#bf00ff]/30 dark:text-[#39ff14]">
                  No teachers are available for direct class messaging yet.
                </div>
              ) : null}
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#800020] dark:text-[#bf00ff]">Classmates</p>
                  <span className="text-xs text-[#191970] dark:text-[#39ff14]">{classmateContacts.length}</span>
                </div>

                {classmateContacts.map(contact => (
                  <button
                    key={contact.id}
                    type="button"
                    onClick={() => startConversationWith(contact)}
                    className="mb-3 flex w-full items-start justify-between rounded-2xl border border-[#800000]/10 bg-white/50 px-4 py-3 text-left transition hover:-translate-y-0.5 hover:border-[#1a5c38]/40 hover:shadow-[0_14px_30px_rgba(26,92,56,0.12)] dark:border-[#bf00ff]/25 dark:bg-[#191970]/35"
                  >
                    <div>
                      <div className="text-sm font-semibold text-[#800000] dark:text-[#ffffff]">{contact.name}</div>
                      <div className="mt-1 text-xs text-[#800020] dark:text-[#bf00ff]">{contact.role}{contact.displayId ? ` • ${contact.displayId}` : ''}</div>
                    </div>
                    <span className="rounded-full bg-[#1a5c38] px-3 py-1 text-xs font-bold text-[#f5deb3] dark:bg-[#00ffff] dark:text-black">
                      Chat
                    </span>
                  </button>
                ))}

                {!loadingContacts && classmateContacts.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[#800000]/20 px-4 py-4 text-sm text-[#191970] dark:border-[#bf00ff]/30 dark:text-[#39ff14]">
                    No classmates are available for direct messaging yet.
                  </div>
                ) : null}
              </div>

              <button
                type="button"
                onClick={() => startConversationWith(supportContact)}
                className="flex w-full items-start justify-between rounded-2xl border border-[#800000]/10 bg-[#fff5e1] px-4 py-3 text-left transition hover:-translate-y-0.5 hover:border-[#1a5c38]/40 hover:shadow-[0_14px_30px_rgba(26,92,56,0.12)] dark:border-[#bf00ff]/25 dark:bg-[#191970]/35"
              >
                <div>
                  <div className="text-sm font-semibold text-[#800000] dark:text-[#ffffff]">{supportContact.name}</div>
                  <div className="mt-1 text-xs text-[#800020] dark:text-[#bf00ff]">{supportContact.role}</div>
                </div>
                <span className="rounded-full bg-[#1a5c38] px-3 py-1 text-xs font-bold text-[#f5deb3] dark:bg-[#00ffff] dark:text-black">
                  Chat
                </span>
              </button>
            </div>
          </section>

          <section className="rounded-3xl border border-[#800000]/15 bg-[#f5deb3]/95 p-4 shadow-[0_18px_40px_rgba(25,25,112,0.08)] dark:border-[#bf00ff]/30 dark:bg-[#800000]/70">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-[#800000] dark:text-[#0000ff]">Conversations</h3>
                <p className="mt-1 text-sm text-[#191970] dark:text-[#39ff14]">Your current chats with classmates, teachers, and support appear here.</p>
              </div>
              <span className="text-xs font-semibold text-[#800020] dark:text-[#bf00ff]">{loadingConversations ? 'Refreshing...' : `${conversationCards.length} threads`}</span>
            </div>

            <div className="mt-4 space-y-3">
              {conversationCards.map(conversation => (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => setActiveConversationId(conversation.id)}
                  className={`w-full rounded-2xl border px-4 py-3 text-left transition ${activeConversationId === conversation.id
                    ? 'border-[#1a5c38] bg-[#1a5c38]/10 shadow-[0_14px_30px_rgba(26,92,56,0.12)] dark:border-[#00ffff] dark:bg-[#191970]/50'
                    : 'border-[#800000]/10 bg-white/45 hover:border-[#800000]/25 dark:border-[#bf00ff]/20 dark:bg-[#191970]/30'
                  }`}
                >
                  <div className="text-sm font-semibold text-[#800000] dark:text-[#ffffff]">{conversation.title}</div>
                  <div className="mt-1 text-xs text-[#800020] dark:text-[#bf00ff]">{conversation.subtitle}</div>
                  <div className="mt-2 text-[11px] text-[#191970]/80 dark:text-[#39ff14]/80">
                    {conversation.lastUpdated ? new Date(conversation.lastUpdated).toLocaleString() : 'No messages yet'}
                  </div>
                </button>
              ))}

              {!loadingConversations && conversationCards.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#800000]/20 px-4 py-6 text-sm text-[#191970] dark:border-[#bf00ff]/30 dark:text-[#39ff14]">
                  Start with a classmate, teacher, or support card above to open your first conversation.
                </div>
              ) : null}
            </div>
          </section>
        </div>

        <section className="flex min-h-[38rem] flex-col rounded-[2rem] border border-[#800000]/15 bg-[#f5deb3] p-5 shadow-[0_26px_60px_rgba(128,0,0,0.10)] dark:border-[#bf00ff]/30 dark:bg-[#800000]/75">
          {!me ? (
            <div className="flex flex-1 items-center justify-center rounded-[1.5rem] border border-dashed border-[#800000]/20 text-sm text-[#191970] dark:border-[#bf00ff]/35 dark:text-[#39ff14]">
              Sign in again to load your messages.
            </div>
          ) : !activeConversation ? (
            <div className="flex flex-1 flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-[#800000]/20 bg-white/35 px-6 text-center dark:border-[#bf00ff]/35 dark:bg-[#191970]/35">
              <h3 className="text-xl font-semibold text-[#800000] dark:text-[#0000ff]">Select A Conversation</h3>
              <p className="mt-2 max-w-xl text-sm text-[#191970] dark:text-[#39ff14]">
                Pick an existing thread or start a new chat with a classmate, teacher, or school support.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-4 border-b border-[#800000]/10 pb-4 dark:border-[#bf00ff]/20">
                <div>
                  <h3 className="text-2xl font-semibold text-[#800000] dark:text-[#0000ff]">{activeConversation.title}</h3>
                  <p className="mt-1 text-sm text-[#191970] dark:text-[#39ff14]">{activeConversation.subtitle}</p>
                </div>
                <div className="rounded-full bg-[#1a5c38] px-4 py-2 text-xs font-bold text-[#f5deb3] dark:bg-[#00ffff] dark:text-black">
                  Safe School Chat
                </div>
              </div>

              <div className="mt-4 flex-1 overflow-y-auto rounded-[1.5rem] border border-[#800000]/10 bg-white/40 p-4 dark:border-[#bf00ff]/20 dark:bg-[#191970]/25">
                {loadingMessages ? (
                  <div className="text-sm text-[#191970] dark:text-[#39ff14]">Loading messages...</div>
                ) : groupedMessages.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-[#191970] dark:text-[#39ff14]">
                    No messages yet. Say hello to begin.
                  </div>
                ) : (
                  <div className="space-y-5">
                    {groupedMessages.map(group => (
                      <div key={group.dateKey}>
                        <div className="mb-3 text-center text-xs font-semibold uppercase tracking-[0.2em] text-[#800020] dark:text-[#bf00ff]">
                          {group.label}
                        </div>
                        <div className="space-y-3">
                          {group.items.map(message => {
                            const isOwn = selfIdentifiers.includes(String(message.senderId || ''));
                            const sentAt = message.sentAt || message.sent_at || message.createdAt || new Date().toISOString();

                            return (
                              <div key={message.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[78%] rounded-[1.4rem] border px-4 py-3 ${isOwn
                                  ? 'border-[#1a5c38]/25 bg-[#1a5c38]/12 text-[#191970] dark:border-[#00ffff]/35 dark:bg-[#00ffff]/10 dark:text-[#ffffff]'
                                  : 'border-[#800000]/15 bg-[#fff8ea] text-[#191970] dark:border-[#bf00ff]/25 dark:bg-[#191970]/45 dark:text-[#39ff14]'
                                }`}>
                                  <div className="text-xs font-semibold text-[#800020] dark:text-[#bf00ff]">
                                    {isOwn ? 'You' : resolveParticipantName(message.senderId)}
                                  </div>
                                  <div className="mt-2 whitespace-pre-wrap text-sm leading-6">
                                    {message.body}
                                  </div>
                                  <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-[#191970]/75 dark:text-[#39ff14]/80">
                                    <span>{new Date(sentAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
                                    <span>{isOwn ? (message.readAt ? 'Read' : message.status === 'sending' ? 'Sending...' : message.status === 'failed' ? 'Failed' : 'Sent') : resolveParticipantRole(message.senderId)}</span>
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
                  </div>
                )}
              </div>

              <div className="mt-4 rounded-[1.5rem] border border-[#800000]/10 bg-white/45 p-4 dark:border-[#bf00ff]/20 dark:bg-[#191970]/35">
                {actionError ? (
                  <div className="mb-3 rounded-2xl border border-[#800000]/15 bg-[#fff3df] px-4 py-3 text-sm text-[#800000] dark:border-[#bf00ff]/25 dark:bg-[#2a0f3c] dark:text-[#ffffff]">
                    {actionError}
                  </div>
                ) : null}
                <textarea
                  value={composer}
                  onChange={event => setComposer(event.target.value)}
                  onKeyDown={handleComposerKey}
                  rows={3}
                  placeholder="Write a clear message to your classmate, teacher, or school support..."
                  className="w-full rounded-[1.2rem] border border-[#800000]/10 bg-[#fff9f0] px-4 py-3 text-sm text-[#191970] outline-none transition focus:border-[#1a5c38] focus:ring-2 focus:ring-[#1a5c38]/20 dark:border-[#bf00ff]/20 dark:bg-[#12001f] dark:text-[#39ff14] dark:focus:border-[#00ffff] dark:focus:ring-[#00ffff]/20"
                />
                <div className="mt-3 flex items-center justify-between gap-3">
                  <p className="text-xs text-[#800020] dark:text-[#bf00ff]">Chats stay within your class roster and school support channels.</p>
                  <button
                    type="button"
                    onClick={sendMessage}
                    disabled={!composer.trim()}
                    className="rounded-full bg-[#1a5c38] px-5 py-2 text-sm font-bold text-[#f5deb3] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#00ffff] dark:text-black"
                  >
                    Send Message
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </StudentSectionShell>
  );
}
