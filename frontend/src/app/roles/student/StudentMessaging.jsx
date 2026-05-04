import React, { useEffect, useState, useRef } from 'react';
import StudentSectionShell from './StudentSectionShell';
import { io } from 'socket.io-client';

export default function StudentMessaging() {
  const me = localStorage.getItem('userId') || '';
  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [composer, setComposer] = useState('');
  const socketRef = useRef(null);

  const activeConvIdRef = useRef(null);

  useEffect(() => {
    activeConvIdRef.current = activeConv ? activeConv.id : null;
  }, [activeConv]);

  useEffect(() => {
    // init socket (only once per user)
    socketRef.current = io(window.location.origin, { query: { userId: me } });
    socketRef.current.on('connect', () => {});
      socketRef.current.on('message', (m) => {
        if (m.conversationId && (activeConv && m.conversationId === activeConv.id)) {
          setMessages(prev => {
            // ignore if already present
            if (prev.some(x => x.id === m.id)) return prev;
            // find optimistic local message match (same sender/body/conversation)
            const idx = prev.findIndex(x => (x.status === 'sending' || x.status === 'failed') && x.senderId === m.senderId && x.body === m.body && x.conversationId === m.conversationId);
            if (idx !== -1) {
              const copy = [...prev]; copy[idx] = m; return copy;
            }
            return [...prev, m];
          });
          try { socketRef.current.emit('ack', { messageId: m.id, conversationId: m.conversationId }); } catch(e){}
        }
        // refresh conversations to reflect updated_at
        fetch(`/api/conversations?userId=${encodeURIComponent(me)}`).then(r=>r.json()).then(d=>setConversations(d.conversations||[])).catch(()=>{});
      });
      socketRef.current.on('delivered', ({ messageId }) => {
        setMessages(prev => prev.map(m => m.id === messageId ? { ...m, deliveredAt: new Date().toISOString() } : m));
      });
      socketRef.current.on('read', ({ conversationId, userId: reader }) => {
        if (conversationId === (activeConv && activeConv.id)) {
          setMessages(prev => prev.map(m => ({ ...m, readAt: m.readAt || new Date().toISOString() })));
        }
      });
    socketRef.current.on('delivered', ({ messageId }) => {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, deliveredAt: new Date().toISOString() } : m));
    });
    socketRef.current.on('read', ({ conversationId, userId: reader }) => {
      if (conversationId === activeConvIdRef.current) {
        setMessages(prev => prev.map(m => ({ ...m, readAt: m.readAt || new Date().toISOString() })));
      }
    });
    return () => { socketRef.current && socketRef.current.disconnect(); };
  }, [me]);

  useEffect(() => {
    fetch(`/api/conversations?userId=${encodeURIComponent(me)}`).then(r => r.json()).then(j => setConversations(j.conversations || [])).catch(() => {});
  }, [me]);

  useEffect(() => {
    if (!activeConv) return;
    fetch(`/api/conversations/${activeConv.id}/messages`).then(r => r.json()).then(j => setMessages(j.messages || [])).catch(()=>{});
    // join socket room
    if (socketRef.current) socketRef.current.emit('join', activeConv.id);
    // mark messages read for this user
    if (socketRef.current) {
      try { fetch(`/api/conversations/${activeConv.id}/mark-read`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: me }) }); } catch(e) {}
      socketRef.current.emit('join', activeConv.id);
    }
    return () => { if (socketRef.current) socketRef.current.emit('leave', activeConv.id); };
  }, [activeConv]);

  const openConversation = (conv) => {
    setActiveConv(conv);
  };

  const sendMessage = async () => {
    if (!composer.trim() || !activeConv) return;
    const localId = `local_${Date.now()}`;
    const localMsg = { id: localId, conversationId: activeConv.id, senderId: me, body: composer.trim(), sentAt: new Date().toISOString(), status: 'sending' };
    setMessages(prev => [...prev, localMsg]);
    setComposer('');
    try {
      const payload = { senderId: me, body: localMsg.body };
      const res = await fetch(`/api/conversations/${activeConv.id}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const j = await res.json();
      if (j.success && j.message) {
        // replace local message with server message
        setMessages(prev => prev.map(m => m.id === localId ? j.message : m));
      }
    } catch (err) {
      setMessages(prev => prev.map(m => m.id === localId ? { ...m, status: 'failed' } : m));
    }
  };

  function handleComposerKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  async function retryMessage(localId) {
    const msg = messages.find(m => m.id === localId);
    if (!msg) return;
    // set sending state
    setMessages(prev => prev.map(m => m.id === localId ? { ...m, status: 'sending' } : m));
    try {
      const payload = { senderId: me, body: msg.body };
      const res = await fetch(`/api/conversations/${msg.conversationId}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const j = await res.json();
      if (j.success && j.message) {
        setMessages(prev => prev.map(m => m.id === localId ? j.message : m));
      } else {
        setMessages(prev => prev.map(m => m.id === localId ? { ...m, status: 'failed' } : m));
      }
    } catch (err) {
      setMessages(prev => prev.map(m => m.id === localId ? { ...m, status: 'failed' } : m));
    }
  }

  const startConversationWith = async (participantId) => {
    // create or find existing conv with participant
    const subject = '';
    const payload = { subject, participants: [me, participantId] };
    const r = await fetch('/api/conversations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const j = await r.json();
    if (j.success) {
      setConversations(prev => [j.conversation, ...prev]);
      setActiveConv(j.conversation);
    } else {
      alert(j.error || 'Could not create conversation');
    }
  };

  function groupMessagesByDate(msgs) {
    const groups = {};
    msgs.forEach(m => {
      const d = new Date(m.sentAt || m.sentAt);
      const key = d.toISOString().slice(0,10);
      if (!groups[key]) groups[key] = [];
      groups[key].push(m);
    });
    // transform to array with labels
    const keys = Object.keys(groups).sort();
    return keys.map(k => {
      const d = new Date(k + 'T00:00:00');
      const today = new Date();
      const yesterday = new Date(); yesterday.setDate(yesterday.getDate() -1);
      let label = d.toLocaleDateString();
      if (d.toDateString() === today.toDateString()) label = 'Today';
      if (d.toDateString() === yesterday.toDateString()) label = 'Yesterday';
      return { date: k, label, items: groups[k] };
    });
  }

  function msgColorClass(senderId) {
    if (String(senderId).startsWith('teacher') || String(senderId).startsWith('admin') || String(senderId).startsWith('parent')) return 'msg-text-teacher';
    return 'msg-text-skyblue';
  }

  function renderTicks(m) {
    // sending -> single gray tick, persisted -> double gray, read -> double blue
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
    // delivered (persisted to server)
    return (
      <svg className="tick-icon tick-gray" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden>
        <path d="M1 13l4 4L23 3l-4-4L5 13zM7 13l4 4 12-12-4-4L7 13z" />
      </svg>
    );
  }

  return (
    <StudentSectionShell title="Messaging" subtitle="Send safe messages to school staff.">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="col-span-1 glass-surface rounded-xl p-3">
          <div className="flex items-center justify-between mb-2 quick-create">
            <strong className="">Conversations</strong>
            <button onClick={() => startConversationWith('support')} className="text-xs px-2 py-1 rounded quick-create">New</button>
          </div>
          <div className="space-y-2">
            {conversations.map(c => (
              <div key={c.id} onClick={() => openConversation(c)} className={`p-2 rounded-md cursor-pointer conv-list-item ${activeConv && activeConv.id === c.id ? 'bg-indigo-700/20' : ''}`}>
                <div className="text-sm font-semibold">{c.subject || (c.participants || []).filter(p => p !== me)[0] || 'Conversation'}</div>
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
                {groupMessagesByDate(messages).map(group => (
                  <div key={group.date} className="mb-4">
                    <div className="text-center text-2xs neon-subtle mb-2">{group.label}</div>
                    {group.items.map(m => (
                      <div key={m.id} className={`msg-row ${m.senderId === me ? 'own' : 'other'}`}>
                        <div style={{ maxWidth: '72%' }}>
                          <div className="msg-sender-name">{m.senderId}</div>
                          <div className={`msg-bubble ${m.senderId === me ? 'own' : 'other'} msg-no-bg`}>
                            <div className="text-xs msg-text-skyblue">{m.body}</div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div className="text-2xs neon-subtle">{new Date(m.sentAt).toLocaleTimeString()}</div>
                                {renderTicks(m)}
                                {m.status === 'failed' ? (
                                  <button onClick={() => retryMessage(m.id)} className="ml-2 text-xs px-2 py-0.5 rounded bg-yellow-500 text-black">Retry</button>
                                ) : null}
                              </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              <div>
                <textarea value={composer} onChange={e => setComposer(e.target.value)} className="w-full rounded-md bg-slate-900/40 border border-white/10 px-2 py-1 text-sm text-slate-100" rows={2} />
                <div className="mt-2 text-right">
                  <button onClick={sendMessage} className="px-3 py-1 rounded bg-indigo-600 text-white text-sm">Send</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </StudentSectionShell>
  );
}
