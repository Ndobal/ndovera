import React, { useCallback, useEffect, useMemo, useState } from 'react';
import StudentSectionShell from '../student/StudentSectionShell';
import { getStoredAuth } from '../../../features/auth/services/authApi';
import { getApiUrl } from '../../../config/apiBase';

const STAFF_MESSAGING_INTENT_KEY = 'staffMessagingIntent';

const TEMPLATES = [
  { text: 'Received — will review and respond shortly.', style: 'msg-text-butter' },
  { text: "Please check your child's homework and acknowledge.", style: 'msg-text-lemon' },
  { text: 'Class will be dismissed 10 minutes early today.', style: 'msg-text-white' },
  { text: 'Reminder: submit assignments by Friday.', style: 'msg-text-butter' },
  { text: 'Please update attendance records.', style: 'msg-text-lemon' },
  { text: 'Meeting at 3pm in the staff room.', style: 'msg-text-white' },
];

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

async function requestJson(path, token, init = {}) {
  const response = await fetch(getApiUrl(path), buildRequestInit(token, init));
  const json = await response.json().catch(() => ({}));

  if (!response.ok || json?.success === false) {
    throw new Error(json?.error || json?.message || 'Request failed.');
  }

  return json;
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

    return { date: dateKey, label, items };
  });
}

function conversationTitle(conversation, userIdentifiers) {
  const participants = Array.isArray(conversation?.participants) ? conversation.participants.map(value => String(value || '')) : [];
  const counterpart = participants.find(participant => !userIdentifiers.includes(participant));
  return conversation?.subject || counterpart || 'Conversation';
}

function TeacherMessaging() {
  const storedAuth = getStoredAuth();
  const authUser = storedAuth?.user || {};
  const token = storedAuth?.token || localStorage.getItem('token') || '';
  const userId = authUser.id || authUser.email || localStorage.getItem('userId') || '';
  const userIdentifiers = useMemo(
    () => Array.from(new Set([userId, authUser.email, authUser.displayId].map(value => String(value || '').trim()).filter(Boolean))),
    [authUser.displayId, authUser.email, userId],
  );
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState('');
  const [messages, setMessages] = useState([]);
  const [body, setBody] = useState('');
  const [group, setGroup] = useState('class');
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [actionError, setActionError] = useState('');
  const [pendingIntent, setPendingIntent] = useState(() => {
    try {
      return JSON.parse(window.sessionStorage.getItem(STAFF_MESSAGING_INTENT_KEY) || 'null');
    } catch {
      return null;
    }
  });
  const [conversationsLoaded, setConversationsLoaded] = useState(false);
  const activeConv = useMemo(
    () => conversations.find(conversation => conversation.id === activeConversationId) || null,
    [activeConversationId, conversations],
  );

  const refreshConversations = useCallback(async (preferredConversationId) => {
    if (!userId) {
      setConversations([]);
      setActiveConversationId('');
      return;
    }

    const payload = await requestJson(`/api/conversations?userId=${encodeURIComponent(userId)}`, token);
    const nextConversations = payload.conversations || [];

    setConversations(nextConversations);
    setActiveConversationId(currentConversationId => {
      const nextConversationId = preferredConversationId || currentConversationId;
      if (nextConversationId && nextConversations.some(conversation => conversation.id === nextConversationId)) {
        return nextConversationId;
      }
      return nextConversations[0]?.id || '';
    });
  }, [token, userId]);

  useEffect(() => {
    let ignore = false;

    async function loadConversations() {
      if (!userId) {
        setConversations([]);
        setActiveConversationId('');
        setLoadingConversations(false);
        setConversationsLoaded(true);
        return;
      }

      setLoadingConversations(true);

      try {
        const payload = await requestJson(`/api/conversations?userId=${encodeURIComponent(userId)}`, token);
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
  }, [token, userId]);

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
        }).catch(() => {});

        await refreshConversations(activeConversationId).catch(() => {});
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
  }, [activeConversationId, refreshConversations, token]);

  useEffect(() => {
    if (!pendingIntent || !conversationsLoaded) return;

    const requestedContact = pendingIntent.contact;
    const participantId = String(requestedContact?.id || '').trim();
    if (!participantId) {
      try { window.sessionStorage.removeItem(STAFF_MESSAGING_INTENT_KEY); } catch {}
      setPendingIntent(null);
      return;
    }

    if (pendingIntent.composeDraft) {
      setBody(currentBody => currentBody || pendingIntent.composeDraft);
    }

    const existingConversation = conversations.find(conversation => {
      const participants = Array.isArray(conversation.participants) ? conversation.participants.map(String) : [];
      return participants.includes(participantId) && participants.some(participant => userIdentifiers.includes(participant));
    });

    const finalize = () => {
      try { window.sessionStorage.removeItem(STAFF_MESSAGING_INTENT_KEY); } catch {}
      setPendingIntent(null);
    };

    if (existingConversation) {
      setActiveConversationId(existingConversation.id);
      finalize();
      return;
    }

    requestJson('/api/conversations', token, {
      method: 'POST',
      body: JSON.stringify({
        subject: `Direct: ${requestedContact?.name || 'Conversation'}`,
        participants: [userId, participantId],
      }),
    })
      .then(payload => {
        if (payload.conversation) {
          setConversations(previous => [payload.conversation, ...previous.filter(conversation => conversation.id !== payload.conversation.id)]);
          setActiveConversationId(payload.conversation.id);
        }
      })
      .catch(error => {
        setActionError(error instanceof Error ? error.message : 'Could not start that conversation.');
      })
      .finally(finalize);
  }, [conversations, conversationsLoaded, pendingIntent, token, userId, userIdentifiers]);

  function msgColorClass(senderId) {
    if (String(senderId).startsWith('teacher') || String(senderId).startsWith('admin') || String(senderId).startsWith('parent')) return 'msg-text-teacher';
    return 'msg-text-skyblue';
  }

  function renderTicks(m) {
    if (m.status === 'sending') {
      return (
        <svg className="tick-icon tick-gray" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden>
          <path d="M20.285 6.709l-11.39 11.39-5.18-5.18 1.414-1.414 3.766 3.766 9.976-9.976z" />
        </svg>
      );
    }
    if (m.readAt) {
      return (
        <svg className="tick-icon tick-blue" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden>
          <path d="M1 13l4 4L23 3l-4-4L5 13zM7 13l4 4 12-12-4-4L7 13z" />
        </svg>
      );
    }
    return (
      <svg className="tick-icon tick-gray" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden>
        <path d="M1 13l4 4L23 3l-4-4L5 13zM7 13l4 4 12-12-4-4L7 13z" />
      </svg>
    );
  }

  function createConversationForGroup(selectedGroup) {
    // map groups to participant ids (simplified demo mapping)
    let participants = [];
    if (selectedGroup === 'class') participants = [userId, 'student-1', 'student-2'];
    if (selectedGroup === 'parents') participants = [userId, 'parent-1', 'parent-2'];
    if (selectedGroup === 'staff') participants = [userId, 'admin-1', 'owner-1'];

    return requestJson('/api/conversations', token, {
      method: 'POST',
      body: JSON.stringify({ subject: `Group: ${selectedGroup}`, participants }),
    })
      .then(payload => {
        if (payload.conversation) {
          setConversations(previous => [payload.conversation, ...previous.filter(conversation => conversation.id !== payload.conversation.id)]);
          setActiveConversationId(payload.conversation.id);
        }
      })
      .catch(error => {
        setActionError(error instanceof Error ? error.message : 'Could not create a group conversation.');
      });
  }

  async function sendMessage() {
    if (!activeConv || !body.trim()) return;
    const localId = `local_${Date.now()}`;
    const localMsg = { id: localId, conversationId: activeConv.id, senderId: userId, body: body.trim(), sentAt: new Date().toISOString(), status: 'sending' };
    setMessages(prev => [...prev, localMsg]);
    setBody('');
    try {
      const payload = await requestJson(`/api/conversations/${activeConv.id}/messages`, token, {
        method: 'POST',
        body: JSON.stringify({ senderId: userId, body: localMsg.body }),
      });
      if (payload.message) {
        setMessages(prev => prev.map(m => m.id === localId ? payload.message : m));
        await refreshConversations(activeConv.id).catch(() => {});
      } else {
        setMessages(prev => prev.map(m => m.id === localId ? { ...m, status: 'failed' } : m));
      }
    } catch (err) {
      setMessages(prev => prev.map(m => m.id === localId ? { ...m, status: 'failed' } : m));
      setActionError(err instanceof Error ? err.message : 'Could not send the message.');
    }
  }

  return (
    <StudentSectionShell title="Messaging" subtitle="Teacher messaging — same student-style UI">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="col-span-1 glass-surface rounded-xl p-3">
          <div className="flex items-center justify-between mb-2 quick-create">
            <strong className="">Conversations</strong>
            <div>
              <select value={group} onChange={e => setGroup(e.target.value)} className="text-xs px-2 py-1 rounded mr-2">
                <option value="class">Class</option>
                <option value="parents">Parents</option>
                <option value="staff">Staff</option>
              </select>
              <button onClick={() => createConversationForGroup(group)} className="text-xs px-2 py-1 rounded quick-create">New</button>
            </div>
          </div>

          {actionError && (
            <div className="mb-3 rounded-2xl border border-red-300/60 bg-red-50 px-3 py-2 text-xs font-semibold text-[#800000] dark:border-[#ff5f8d]/35 dark:bg-[#4a0014] dark:text-[#ffffff]">
              {actionError}
            </div>
          )}

          <div className="space-y-2">
            {loadingConversations && conversations.length === 0 && <div className="text-xs text-slate-500 dark:text-slate-300">Loading conversations...</div>}
            {conversations.map(c => (
              <div key={c.id} onClick={() => setActiveConversationId(c.id)} className={`p-2 rounded-md cursor-pointer conv-list-item ${activeConv && activeConv.id === c.id ? 'bg-indigo-700/20' : ''}`}>
                <div className="text-sm font-semibold">{conversationTitle(c, userIdentifiers)}</div>
                <div className="text-xs neon-subtle">{(c.participants || []).join(', ')}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="col-span-2 glass-surface rounded-xl p-3">
          {!activeConv ? (
            <div className="text-slate-400">Select or start a conversation</div>
          ) : (
            <div className="flex flex-col h-96">
              <div className="flex-1 overflow-auto mb-2 p-2 bg-slate-900/10 rounded">
                {loadingMessages && messages.length === 0 && <p className="text-xs text-center mt-8 text-slate-500 dark:text-slate-300">Loading messages...</p>}
                {groupMessagesByDate(messages).map(groupItem => (
                  <div key={groupItem.date} className="mb-4">
                    <div className="text-center text-2xs neon-subtle mb-2">{groupItem.label}</div>
                    {groupItem.items.map(m => (
                      <div key={m.id} className={`msg-row ${m.senderId === userId ? 'own' : 'other'}`}>
                        <div style={{ maxWidth: '72%' }}>
                          <div className="msg-sender-name">{m.senderId}</div>
                          <div className={`msg-bubble ${m.senderId === userId ? 'own' : 'other'} msg-no-bg`}>
                            <div className={`${msgColorClass(m.senderId)} text-xs`}>{m.body}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div className="text-2xs neon-subtle">{new Date(m.sentAt || m.sent_at || Date.now()).toLocaleTimeString()}</div>
                              {renderTicks(m)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              <div>
                <div className="flex items-start gap-2">
                  <select onChange={e => setBody(e.target.value)} defaultValue="" className="min-w-[260px] rounded-md bg-slate-900/40 border border-white/10 px-2 py-1 text-sm text-slate-100">
                    <option value="">Insert template...</option>
                    {TEMPLATES.map((t, i) => <option key={i} value={t.text}>{t.text}</option>)}
                  </select>
                  <textarea value={body} onChange={e => setBody(e.target.value)} className="w-full rounded-md bg-slate-900/40 border border-white/10 px-2 py-1 text-sm text-slate-100" rows={3} onKeyDown={(e)=>{ if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }} />
                  <div className="mt-1">
                    <button onClick={sendMessage} className="px-3 py-1 rounded bg-indigo-600 text-white text-sm">Send</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </StudentSectionShell>
  );
}

export default TeacherMessaging;
