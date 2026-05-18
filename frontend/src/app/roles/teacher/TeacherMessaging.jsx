import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import StudentSectionShell from '../student/StudentSectionShell';
import { buildSelectedRoleHeader, getStoredAuth } from '../../../features/auth/services/authApi';
import { getApiUrl } from '../../../config/apiBase';

const STAFF_MESSAGING_INTENT_KEY = 'staffMessagingIntent';
const MESSAGE_POLL_INTERVAL_MS = 4500;
const CONVERSATION_POLL_INTERVAL_MS = 9000;

function uniqueValues(values) {
  return Array.from(new Set((values || []).map(value => String(value || '').trim()).filter(Boolean)));
}

function normalizeParticipants(value) {
  if (Array.isArray(value)) {
    return value.map(item => String(item || '').trim()).filter(Boolean);
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map(item => String(item || '').trim()).filter(Boolean);
      }
    } catch {
      return value.split(',').map(item => String(item || '').trim()).filter(Boolean);
    }
  }

  return [];
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

async function requestJson(path, token, init = {}) {
  const response = await fetch(getApiUrl(path), buildRequestInit(token, init));
  const json = await response.json().catch(() => ({}));

  if (!response.ok || json?.success === false) {
    throw new Error(json?.error || json?.message || 'Request failed.');
  }

  return json;
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function prettifyIdentifier(value) {
  const normalized = String(value || '').trim();
  if (!normalized) return 'Conversation';

  const labelSource = normalized.includes('@') ? normalized.split('@')[0] : normalized;
  return labelSource
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

function normalizeRoleKeys(person = {}) {
  const roles = Array.isArray(person.roles) && person.roles.length > 0
    ? person.roles
    : [person.role].filter(Boolean);

  return uniqueValues(roles.map(role => normalizeText(role)).filter(Boolean));
}

function normalizeSchoolContact(person = {}) {
  const roleKeys = normalizeRoleKeys(person);
  const roleLabels = roleKeys.map(role => prettifyIdentifier(role));

  return {
    id: String(person.id || person.email || person.displayId || ''),
    name: String(person.name || person.email || 'School Contact'),
    email: String(person.email || ''),
    displayId: String(person.displayId || ''),
    role: roleLabels[0] || 'School Contact',
    roleSummary: roleLabels.join(' • ') || 'School Contact',
    roleKeys,
    status: String(person.status || 'Active'),
    identifiers: uniqueValues([person.id, person.email, person.displayId]),
  };
}

function mergeContacts(...contactGroups) {
  const byId = new Map();

  contactGroups.flat().forEach(contact => {
    const id = String(contact?.id || '').trim();
    if (!id) return;

    const existing = byId.get(id);
    if (!existing) {
      byId.set(id, {
        ...contact,
        identifiers: uniqueValues(contact.identifiers || []),
        roleKeys: uniqueValues(contact.roleKeys || []),
      });
      return;
    }

    byId.set(id, {
      ...existing,
      ...contact,
      roleKeys: uniqueValues([...(existing.roleKeys || []), ...(contact.roleKeys || [])]),
      identifiers: uniqueValues([...(existing.identifiers || []), ...(contact.identifiers || [])]),
      roleSummary: uniqueValues([existing.roleSummary, contact.roleSummary]).join(' • ') || existing.roleSummary || contact.roleSummary,
    });
  });

  return Array.from(byId.values()).sort((left, right) => left.name.localeCompare(right.name));
}

function TeacherMessaging() {
  const location = useLocation();
  const storedAuth = getStoredAuth();
  const authUser = storedAuth?.user || {};
  const token = storedAuth?.token || localStorage.getItem('token') || '';
  const userId = authUser.id || authUser.email || localStorage.getItem('userId') || '';
  const selfIdentifiers = useMemo(
    () => uniqueValues([userId, authUser.email, authUser.displayId]),
    [authUser.displayId, authUser.email, userId],
  );

  const [students, setStudents] = useState([]);
  const [parents, setParents] = useState([]);
  const [staff, setStaff] = useState([]);
  const [contactQuery, setContactQuery] = useState('');
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState('');
  const [messages, setMessages] = useState([]);
  const [composer, setComposer] = useState('');
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [conversationsLoaded, setConversationsLoaded] = useState(false);
  const [actionError, setActionError] = useState('');
  const [pendingIntent, setPendingIntent] = useState(() => {
    try {
      return JSON.parse(window.sessionStorage.getItem(STAFF_MESSAGING_INTENT_KEY) || 'null');
    } catch {
      return null;
    }
  });

  const latestActiveConversationIdRef = useRef('');
  const startConversationRef = useRef(null);

  const allContacts = useMemo(
    () => [...students, ...parents, ...staff],
    [parents, staff, students],
  );

  const contactLookup = useMemo(() => {
    const lookup = new Map();
    const selfProfile = {
      id: userId,
      name: String(authUser.name || authUser.email || 'You'),
      email: String(authUser.email || ''),
      displayId: String(authUser.displayId || ''),
      role: 'Teacher',
      roleSummary: 'Teacher',
      roleKeys: ['teacher'],
      status: 'Active',
      identifiers: selfIdentifiers,
    };

    selfIdentifiers.forEach(identifier => lookup.set(identifier, selfProfile));
    allContacts.forEach(contact => {
      (contact.identifiers || []).forEach(identifier => lookup.set(identifier, contact));
    });

    return lookup;
  }, [allContacts, authUser.displayId, authUser.email, authUser.name, selfIdentifiers, userId]);

  const filteredContacts = useMemo(() => {
    const query = normalizeText(contactQuery);
    if (!query) {
      return { students, parents, staff };
    }

    const matchContact = contact => {
      const haystack = [contact.name, contact.email, contact.displayId, contact.roleSummary].map(normalizeText).join(' ');
      return haystack.includes(query);
    };

    return {
      students: students.filter(matchContact),
      parents: parents.filter(matchContact),
      staff: staff.filter(matchContact),
    };
  }, [contactQuery, parents, staff, students]);

  const conversationCards = useMemo(() => {
    return (conversations || []).map(conversation => {
      const participants = normalizeParticipants(conversation?.participants);
      const otherParticipants = participants.filter(identifier => !selfIdentifiers.includes(identifier));
      const otherProfiles = otherParticipants.map(identifier => contactLookup.get(identifier) || {
        id: identifier,
        name: prettifyIdentifier(identifier),
        roleSummary: 'School Contact',
      });

      return {
        ...conversation,
        participants,
        title: String(conversation?.subject || '').trim() || otherProfiles.map(profile => profile.name).join(', ') || 'Conversation',
        subtitle: otherProfiles.map(profile => profile.roleSummary || profile.role).filter(Boolean).join(' • ') || 'Direct message',
        lastUpdated: conversation.updated_at || conversation.updatedAt || conversation.created_at || conversation.createdAt || '',
      };
    }).sort((left, right) => new Date(right.lastUpdated || 0).getTime() - new Date(left.lastUpdated || 0).getTime());
  }, [contactLookup, conversations, selfIdentifiers]);

  const activeConversation = useMemo(
    () => conversationCards.find(conversation => conversation.id === activeConversationId) || null,
    [activeConversationId, conversationCards],
  );

  const groupedMessages = useMemo(() => groupMessagesByDate(messages), [messages]);

  const resolveParticipantName = useCallback(identifier => {
    return contactLookup.get(String(identifier || ''))?.name || prettifyIdentifier(identifier);
  }, [contactLookup]);

  const resolveParticipantRole = useCallback(identifier => {
    return contactLookup.get(String(identifier || ''))?.roleSummary || 'School Contact';
  }, [contactLookup]);

  const loadContacts = useCallback(async () => {
    if (!userId) {
      setStudents([]);
      setParents([]);
      setStaff([]);
      setLoadingContacts(false);
      return;
    }

    setLoadingContacts(true);

    try {
      const [assignedClassesPayload, peoplePayload] = await Promise.all([
        requestJson('/api/classrooms/assigned', token).catch(() => ({ classes: [] })),
        requestJson('/api/people', token).catch(() => ({ people: [] })),
      ]);

      const assignedClasses = Array.isArray(assignedClassesPayload?.classes)
        ? assignedClassesPayload.classes
        : Array.isArray(assignedClassesPayload?.classrooms)
          ? assignedClassesPayload.classrooms
          : [];

      const classMembersPayloads = await Promise.all(
        assignedClasses
          .map(classroom => String(classroom?.id || '').trim())
          .filter(Boolean)
          .map(classroomId => requestJson(`/api/classrooms/${encodeURIComponent(classroomId)}/members`, token).catch(() => ({ members: [] }))),
      );

      const classStudents = mergeContacts(
        classMembersPayloads.flatMap(payload => (payload?.members || []))
          .map(normalizeSchoolContact)
          .filter(contact => contact.roleKeys.includes('student'))
          .filter(contact => !contact.identifiers.some(identifier => selfIdentifiers.includes(identifier))),
      );

      const normalizedPeople = (Array.isArray(peoplePayload?.people) ? peoplePayload.people : [])
        .map(normalizeSchoolContact)
        .filter(contact => !contact.identifiers.some(identifier => selfIdentifiers.includes(identifier)));

      const parentContacts = mergeContacts(
        normalizedPeople.filter(contact => contact.roleKeys.includes('parent')),
      );

      const staffContacts = mergeContacts(
        normalizedPeople.filter(contact => !contact.roleKeys.includes('student') && !contact.roleKeys.includes('parent')),
      );

      setStudents(classStudents);
      setParents(parentContacts);
      setStaff(staffContacts);
      setActionError('');
    } catch (error) {
      setStudents([]);
      setParents([]);
      setStaff([]);
      setActionError(error instanceof Error ? error.message : 'Could not load live recipients.');
    } finally {
      setLoadingContacts(false);
    }
  }, [selfIdentifiers, token, userId]);

  const loadConversations = useCallback(async ({ preferredConversationId, silent = false } = {}) => {
    if (!userId) {
      setConversations([]);
      setActiveConversationId('');
      setLoadingConversations(false);
      setConversationsLoaded(true);
      return;
    }

    if (!silent) {
      setLoadingConversations(true);
    }

    try {
      const payload = await requestJson(`/api/conversations?userId=${encodeURIComponent(userId)}`, token);
      const nextConversations = payload.conversations || [];

      setConversations(nextConversations);
      setActiveConversationId(currentConversationId => {
        const nextId = preferredConversationId || currentConversationId;
        if (nextId && nextConversations.some(conversation => conversation.id === nextId)) {
          return nextId;
        }
        return nextConversations[0]?.id || '';
      });
      setActionError('');
    } catch (error) {
      if (!silent) {
        setActionError(error instanceof Error ? error.message : 'Could not load conversations.');
      }
    } finally {
      if (!silent) {
        setLoadingConversations(false);
      }
      setConversationsLoaded(true);
    }
  }, [token, userId]);

  const loadMessages = useCallback(async ({ conversationId, silent = false } = {}) => {
    const targetConversationId = conversationId || latestActiveConversationIdRef.current;
    if (!targetConversationId) {
      setMessages([]);
      setLoadingMessages(false);
      return;
    }

    if (!silent) {
      setLoadingMessages(true);
    }

    try {
      const payload = await requestJson(`/api/conversations/${encodeURIComponent(targetConversationId)}/messages`, token);
      setMessages(payload.messages || []);

      await requestJson(`/api/conversations/${encodeURIComponent(targetConversationId)}/mark-read`, token, {
        method: 'POST',
      }).catch(() => null);
    } catch (error) {
      if (!silent) {
        setActionError(error instanceof Error ? error.message : 'Could not load messages.');
      }
    } finally {
      if (!silent) {
        setLoadingMessages(false);
      }
    }
  }, [token]);

  useEffect(() => {
    latestActiveConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  useEffect(() => {
    loadContacts();
    loadConversations();
  }, [loadContacts, loadConversations]);

  useEffect(() => {
    const conversationPoll = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      loadConversations({ preferredConversationId: latestActiveConversationIdRef.current, silent: true });
    }, CONVERSATION_POLL_INTERVAL_MS);

    const messagePoll = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      loadMessages({ silent: true });
    }, MESSAGE_POLL_INTERVAL_MS);

    const handleResume = () => {
      if (document.visibilityState === 'hidden') return;
      loadConversations({ preferredConversationId: latestActiveConversationIdRef.current, silent: true });
      loadMessages({ silent: true });
    };

    window.addEventListener('focus', handleResume);
    document.addEventListener('visibilitychange', handleResume);

    return () => {
      window.clearInterval(conversationPoll);
      window.clearInterval(messagePoll);
      window.removeEventListener('focus', handleResume);
      document.removeEventListener('visibilitychange', handleResume);
    };
  }, [loadConversations, loadMessages]);

  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      return;
    }

    loadMessages({ conversationId: activeConversationId });
  }, [activeConversationId, loadMessages]);

  useEffect(() => {
    const requestedConversationId = String(location.state?.conversationId || '').trim();
    if (!requestedConversationId || !conversationsLoaded) return;
    if (requestedConversationId === activeConversationId) return;

    const existingConversation = conversations.find(conversation => conversation.id === requestedConversationId);
    if (existingConversation) {
      setActiveConversationId(existingConversation.id);
    }
  }, [activeConversationId, conversations, conversationsLoaded, location.state]);

  const startConversationWith = useCallback(async contact => {
    if (!contact?.id) return;
    setActionError('');

    const existingConversation = conversationCards.find(conversation => {
      const participants = normalizeParticipants(conversation?.participants);
      const hasSelf = participants.some(identifier => selfIdentifiers.includes(identifier));
      const hasContact = participants.some(identifier => (contact.identifiers || []).includes(identifier));
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
          participants: [userId, contact.id],
        }),
      });

      if (payload.conversation) {
        setConversations(previous => [payload.conversation, ...previous.filter(conversation => conversation.id !== payload.conversation.id)]);
        setActiveConversationId(payload.conversation.id);
        setMessages([]);
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not start that conversation.');
    }
  }, [conversationCards, selfIdentifiers, token, userId]);

  startConversationRef.current = startConversationWith;

  useEffect(() => {
    if (!pendingIntent || loadingContacts || loadingConversations) return;

    const finalizeIntent = () => {
      try {
        window.sessionStorage.removeItem(STAFF_MESSAGING_INTENT_KEY);
      } catch {}
      setPendingIntent(null);
    };

    const requestedContact = pendingIntent.contact;
    const requestedIdentifiers = uniqueValues([
      requestedContact?.id,
      requestedContact?.email,
      requestedContact?.displayId,
    ]);
    const resolvedContact = allContacts.find(contact => (
      (contact.identifiers || []).some(identifier => requestedIdentifiers.includes(identifier))
    ));

    if (pendingIntent.composeDraft) {
      setComposer(currentValue => currentValue || pendingIntent.composeDraft);
    }

    if (resolvedContact && startConversationRef.current) {
      Promise.resolve(startConversationRef.current(resolvedContact)).finally(finalizeIntent);
      return;
    }

    finalizeIntent();
  }, [allContacts, loadingContacts, loadingConversations, pendingIntent]);

  async function sendMessage() {
    if (!composer.trim() || !activeConversationId) return;

    const localId = `local_${Date.now()}`;
    const optimisticMessage = {
      id: localId,
      conversationId: activeConversationId,
      senderId: userId,
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
        body: JSON.stringify({ senderId: userId, body: optimisticMessage.body }),
      });

      if (payload.message) {
        setMessages(previous => previous.map(message => message.id === localId ? payload.message : message));
      } else {
        setMessages(previous => previous.map(message => message.id === localId ? { ...message, status: 'failed' } : message));
      }

      await loadConversations({ preferredConversationId: activeConversationId, silent: true });
      await loadMessages({ conversationId: activeConversationId, silent: true });
    } catch (error) {
      setMessages(previous => previous.map(message => message.id === localId ? { ...message, status: 'failed' } : message));
      setActionError(error instanceof Error ? error.message : 'Could not send the message.');
    }
  }

  async function retryMessage(localId) {
    const failedMessage = messages.find(message => message.id === localId);
    if (!failedMessage || !activeConversationId) return;

    setMessages(previous => previous.map(message => message.id === localId ? { ...message, status: 'sending' } : message));
    setActionError('');

    try {
      const payload = await requestJson(`/api/conversations/${encodeURIComponent(activeConversationId)}/messages`, token, {
        method: 'POST',
        body: JSON.stringify({ senderId: userId, body: failedMessage.body || '' }),
      });

      if (payload.message) {
        setMessages(previous => previous.map(message => message.id === localId ? payload.message : message));
      } else {
        setMessages(previous => previous.map(message => message.id === localId ? { ...message, status: 'failed' } : message));
      }

      await loadConversations({ preferredConversationId: activeConversationId, silent: true });
      await loadMessages({ conversationId: activeConversationId, silent: true });
    } catch (error) {
      setMessages(previous => previous.map(message => message.id === localId ? { ...message, status: 'failed' } : message));
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
    <StudentSectionShell title="Messaging" subtitle="Live teacher messaging for students, parents, and staff.">
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-4">
          <section className="rounded-3xl border border-[#800000]/15 bg-[#f5deb3]/95 p-4 shadow-[0_18px_40px_rgba(128,0,0,0.08)] dark:border-[#bf00ff]/30 dark:bg-[#800000]/70">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-[#800000] dark:text-[#0000ff]">Choose Recipient</h3>
                <p className="mt-1 text-sm leading-6 text-[#191970] dark:text-[#39ff14]">
                  Start a conversation with live recipients instead of demo users.
                </p>
              </div>
              <span className="rounded-full bg-[#800000]/10 px-3 py-1 text-xs font-semibold text-[#800020] dark:bg-[#00ffff]/20 dark:text-[#bf00ff]">
                {loadingContacts ? 'Loading' : `${students.length + parents.length + staff.length} live contacts`}
              </span>
            </div>

            <div className="mt-4">
              <input
                value={contactQuery}
                onChange={event => setContactQuery(event.target.value)}
                placeholder="Search by name, role, email, or ID"
                className="w-full rounded-2xl border border-[#800000]/15 bg-white/70 px-4 py-3 text-sm text-[#191970] outline-none transition focus:border-[#1a5c38] focus:ring-4 focus:ring-[#1a5c38]/10 dark:border-[#bf00ff]/20 dark:bg-[#191970]/35 dark:text-[#ffffff]"
              />
            </div>

            <div className="mt-4 space-y-4">
              {[
                { key: 'students', label: 'Students', contacts: filteredContacts.students },
                { key: 'parents', label: 'Parents', contacts: filteredContacts.parents },
                { key: 'staff', label: 'Staff', contacts: filteredContacts.staff },
              ].map(section => (
                <div key={section.key}>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#800020] dark:text-[#bf00ff]">{section.label}</p>
                    <span className="text-xs text-[#191970] dark:text-[#39ff14]">{section.contacts.length}</span>
                  </div>

                  <div className="space-y-2">
                    {section.contacts.map(contact => (
                      <button
                        key={`${section.key}-${contact.id}`}
                        type="button"
                        onClick={() => startConversationWith(contact)}
                        className="flex w-full items-start justify-between rounded-2xl border border-[#800000]/10 bg-white/55 px-4 py-3 text-left transition hover:-translate-y-0.5 hover:border-[#1a5c38]/40 hover:shadow-[0_14px_30px_rgba(26,92,56,0.12)] dark:border-[#bf00ff]/25 dark:bg-[#191970]/35"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-[#800000] dark:text-[#ffffff]">{contact.name}</div>
                          <div className="mt-1 text-xs text-[#800020] dark:text-[#bf00ff]">
                            {contact.roleSummary}{contact.displayId ? ` • ${contact.displayId}` : ''}
                          </div>
                        </div>
                        <span className="rounded-full bg-[#1a5c38] px-3 py-1 text-xs font-bold text-[#f5deb3] dark:bg-[#00ffff] dark:text-black">
                          Chat
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              {!loadingContacts && students.length + parents.length + staff.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#800000]/20 px-4 py-4 text-sm leading-6 text-[#191970] dark:border-[#bf00ff]/30 dark:text-[#39ff14]">
                  No live recipients are available yet for this teacher account.
                </div>
              ) : null}
            </div>
          </section>

          <section className="rounded-3xl border border-[#800000]/15 bg-[#f5deb3]/95 p-4 shadow-[0_18px_40px_rgba(25,25,112,0.08)] dark:border-[#bf00ff]/30 dark:bg-[#800000]/70">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-[#800000] dark:text-[#0000ff]">Conversations</h3>
                <p className="mt-1 text-sm leading-6 text-[#191970] dark:text-[#39ff14]">
                  Background sync keeps threads fresh without obvious refresh flashes.
                </p>
              </div>
              <span className="text-xs font-semibold text-[#800020] dark:text-[#bf00ff]">
                {loadingConversations ? 'Refreshing...' : `${conversationCards.length} threads`}
              </span>
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
                <div className="rounded-2xl border border-dashed border-[#800000]/20 px-4 py-6 text-sm leading-6 text-[#191970] dark:border-[#bf00ff]/30 dark:text-[#39ff14]">
                  Start a conversation from the live recipient list.
                </div>
              ) : null}
            </div>
          </section>
        </div>

        <section className="flex min-h-[40rem] flex-col rounded-[2rem] border border-[#800000]/15 bg-[#f5deb3] p-5 shadow-[0_26px_60px_rgba(128,0,0,0.10)] dark:border-[#bf00ff]/30 dark:bg-[#800000]/75">
          {actionError ? (
            <div className="mb-4 rounded-2xl border border-red-300/60 bg-red-50 px-4 py-3 text-sm font-semibold text-[#800000] dark:border-[#ff5f8d]/35 dark:bg-[#4a0014] dark:text-[#ffffff]">
              {actionError}
            </div>
          ) : null}

          {!userId ? (
            <div className="flex flex-1 items-center justify-center rounded-[1.5rem] border border-dashed border-[#800000]/20 text-sm text-[#191970] dark:border-[#bf00ff]/35 dark:text-[#39ff14]">
              Sign in again to load teacher messaging.
            </div>
          ) : !activeConversation ? (
            <div className="flex flex-1 flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-[#800000]/20 bg-white/35 px-6 text-center dark:border-[#bf00ff]/35 dark:bg-[#191970]/35">
              <h3 className="text-xl font-semibold text-[#800000] dark:text-[#0000ff]">Select A Conversation</h3>
              <p className="mt-2 max-w-xl text-sm leading-6 text-[#191970] dark:text-[#39ff14]">
                Pick a live user from the left pane to start messaging without fake demo contacts.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-4 border-b border-[#800000]/10 pb-4 dark:border-[#bf00ff]/20">
                <div>
                  <h3 className="text-2xl font-semibold text-[#800000] dark:text-[#0000ff]">{activeConversation.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-[#191970] dark:text-[#39ff14]">{activeConversation.subtitle}</p>
                </div>
                <div className="rounded-full bg-[#1a5c38] px-4 py-2 text-xs font-bold text-[#f5deb3] dark:bg-[#00ffff] dark:text-black">
                  Teacher Chat
                </div>
              </div>

              <div className="mt-4 flex-1 overflow-y-auto rounded-[1.5rem] border border-[#800000]/10 bg-white/45 p-4 dark:border-[#bf00ff]/20 dark:bg-[#191970]/25">
                {loadingMessages && messages.length === 0 ? (
                  <div className="text-sm text-[#191970] dark:text-[#39ff14]">Loading messages...</div>
                ) : groupedMessages.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-[#191970] dark:text-[#39ff14]">
                    No messages yet. Start the conversation below.
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
                            const senderIdentifier = String(message.senderId || message.sender_id || '');
                            const isOwn = selfIdentifiers.includes(senderIdentifier);
                            const sentAt = message.sentAt || message.sent_at || message.createdAt || new Date().toISOString();

                            return (
                              <div key={message.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[78%] rounded-[1.4rem] border px-4 py-3 ${isOwn
                                  ? 'border-[#1a5c38]/25 bg-[#1a5c38]/12 text-[#191970] dark:border-[#00ffff]/35 dark:bg-[#00ffff]/10 dark:text-[#ffffff]'
                                  : 'border-[#800000]/15 bg-[#fff8ea] text-[#191970] dark:border-[#bf00ff]/25 dark:bg-[#191970]/45 dark:text-[#39ff14]'
                                }`}>
                                  <div className="text-xs font-semibold text-[#800020] dark:text-[#bf00ff]">
                                    {isOwn ? 'You' : resolveParticipantName(senderIdentifier)}
                                  </div>
                                  <div className="mt-2 whitespace-pre-wrap text-[15px] leading-7">
                                    {message.body}
                                  </div>
                                  <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-[#191970]/75 dark:text-[#39ff14]/80">
                                    <span>{new Date(sentAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
                                    <span>
                                      {isOwn
                                        ? (message.readAt || message.read_at ? 'Read' : message.status === 'sending' ? 'Sending...' : message.status === 'failed' ? 'Failed' : 'Sent')
                                        : resolveParticipantRole(senderIdentifier)}
                                    </span>
                                  </div>
                                  {message.status === 'failed' ? (
                                    <button
                                      type="button"
                                      onClick={() => retryMessage(message.id)}
                                      className="mt-3 rounded-full bg-[#1a5c38] px-3 py-1 text-xs font-bold text-[#f5deb3] dark:bg-[#00ffff] dark:text-black"
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

              <div className="mt-4 rounded-[1.5rem] border border-[#800000]/10 bg-white/55 p-4 dark:border-[#bf00ff]/20 dark:bg-[#191970]/35">
                <div className="flex flex-col gap-3">
                  <textarea
                    value={composer}
                    onChange={event => setComposer(event.target.value)}
                    onKeyDown={handleComposerKey}
                    rows={4}
                    placeholder="Type your message here"
                    className="w-full rounded-2xl border border-[#800000]/15 bg-[#fff8ea] px-4 py-3 text-[15px] leading-7 text-[#191970] outline-none transition focus:border-[#1a5c38] focus:ring-4 focus:ring-[#1a5c38]/10 dark:border-[#bf00ff]/25 dark:bg-[#191970]/45 dark:text-[#ffffff]"
                  />

                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#800020] dark:text-[#bf00ff]">
                      Press Enter to send. Shift + Enter for a new line.
                    </p>
                    <button
                      type="button"
                      onClick={sendMessage}
                      className="rounded-2xl bg-[#1a5c38] px-5 py-3 text-sm font-bold text-[#f5deb3] transition hover:bg-[#154a2e] dark:bg-[#00ffff] dark:text-black dark:hover:bg-[#7dfcff]"
                    >
                      Send Message
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </StudentSectionShell>
  );
}

export default TeacherMessaging;