import React, { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import StudentSectionShell from '../student/StudentSectionShell';

const TEMPLATES = [
  { text: 'Received — will review and respond shortly.', style: 'msg-text-butter' },
  { text: "Please check your child's homework and acknowledge.", style: 'msg-text-lemon' },
  { text: 'Class will be dismissed 10 minutes early today.', style: 'msg-text-white' },
  { text: 'Reminder: submit assignments by Friday.', style: 'msg-text-butter' },
  { text: 'Please update attendance records.', style: 'msg-text-lemon' },
  { text: 'Meeting at 3pm in the staff room.', style: 'msg-text-white' },
];

function TeacherMessaging() {
  const [userId] = useState(() => localStorage.getItem('userId') || 'teacher-1');
  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [body, setBody] = useState('');
  const [group, setGroup] = useState('class');
  const socketRef = useRef(null);

  useEffect(() => {
    fetch(`/api/conversations?userId=${encodeURIComponent(userId)}`)
      .then(r => r.json())
      .then(d => setConversations(d.conversations || []))
      .catch(() => {});

    // connect socket
    const s = io('/', { query: { userId } });
    socketRef.current = s;
    s.on('connect', () => {});
    s.on('message', (m) => {
      if (m.conversationId && (activeConv && m.conversationId === activeConv.id)) {
        setMessages((prev) => [...prev, m]);
        try { s.emit('ack', { messageId: m.id, conversationId: m.conversationId }); } catch(e){}
      }
      // refresh conversations to reflect updated_at
      fetch(`/api/conversations?userId=${encodeURIComponent(userId)}`).then(r=>r.json()).then(d=>setConversations(d.conversations||[])).catch(()=>{});
    });
    s.on('delivered', ({ messageId }) => {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, deliveredAt: new Date().toISOString() } : m));
    });
    s.on('read', ({ conversationId, userId: reader }) => {
      if (conversationId === (activeConv && activeConv.id)) {
        setMessages(prev => prev.map(m => ({ ...m, readAt: m.readAt || new Date().toISOString() })));
      }
    });
    return () => s.disconnect();
  }, [userId, activeConv]);

  useEffect(() => {
    if (!activeConv) return;
    fetch(`/api/conversations/${activeConv.id}/messages`).then(r=>r.json()).then(d=>setMessages(d.messages||[])).catch(()=>{});
    // join socket room
    if (socketRef.current && activeConv.id) socketRef.current.emit('join', activeConv.id);
    return () => { if (socketRef.current && activeConv.id) socketRef.current.emit('leave', activeConv.id); };
  }, [activeConv]);

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

  function groupMessagesByDate(msgs) {
    const groups = {};
    msgs.forEach(m => {
      const d = new Date(m.sentAt || m.sentAt);
      const key = d.toISOString().slice(0,10);
      if (!groups[key]) groups[key] = [];
      groups[key].push(m);
    });
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

  function createConversationForGroup(selectedGroup) {
    // map groups to participant ids (simplified demo mapping)
    let participants = [];
    if (selectedGroup === 'class') participants = ['teacher-1', 'student-1', 'student-2'];
    if (selectedGroup === 'parents') participants = ['teacher-1','parent-1','parent-2'];
    if (selectedGroup === 'staff') participants = ['teacher-1','admin-1','owner-1'];

    return fetch('/api/conversations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subject: `Group: ${selectedGroup}`, participants }) })
      .then(r => r.json())
      .then(d => {
        if (d.success && d.conversation) {
          setConversations(prev => [d.conversation, ...prev]);
          setActiveConv(d.conversation);
        }
      }).catch(()=>{});
  }

  async function sendMessage() {
    if (!activeConv || !body.trim()) return;
    const localId = `local_${Date.now()}`;
    const localMsg = { id: localId, conversationId: activeConv.id, senderId: userId, body: body.trim(), sentAt: new Date().toISOString(), status: 'sending' };
    setMessages(prev => [...prev, localMsg]);
    setBody('');
    try {
      const res = await fetch(`/api/conversations/${activeConv.id}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ senderId: userId, body: localMsg.body }) });
      const d = await res.json();
      if (d.success && d.message) {
        // replace local optimistic message with server message
        setMessages(prev => prev.map(m => m.id === localId ? d.message : m));
      } else {
        setMessages(prev => prev.map(m => m.id === localId ? { ...m, status: 'failed' } : m));
      }
    } catch (err) {
      setMessages(prev => prev.map(m => m.id === localId ? { ...m, status: 'failed' } : m));
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
          <div className="space-y-2">
            {conversations.map(c => (
              <div key={c.id} onClick={() => setActiveConv(c)} className={`p-2 rounded-md cursor-pointer conv-list-item ${activeConv && activeConv.id === c.id ? 'bg-indigo-700/20' : ''}`}>
                <div className="text-sm font-semibold">{c.subject || (c.participants || []).filter(p => p !== userId)[0] || 'Conversation'}</div>
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
                              <div className="text-2xs neon-subtle">{new Date(m.sentAt).toLocaleTimeString()}</div>
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
