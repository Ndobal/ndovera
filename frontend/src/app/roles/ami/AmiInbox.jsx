import React, { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const SOURCE_LABELS = {
  website_contact: { label: 'Website Enquiry', colorClass: 'bg-indigo-500/20 text-indigo-300 border-indigo-400/30' },
  tenant_message:  { label: 'Tenant / Owner',  colorClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30' },
  system_alert:    { label: 'System Alert',    colorClass: 'bg-rose-500/20 text-rose-300 border-rose-400/30' },
  direct:          { label: 'Direct Message',  colorClass: 'bg-amber-500/20 text-amber-300 border-amber-400/30' },
};

function SourceTag({ source }) {
  const s = SOURCE_LABELS[source] || SOURCE_LABELS.direct;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${s.colorClass}`}>
      {s.label}
    </span>
  );
}

function timeAgo(iso) {
  if (!iso) return '';
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'website_contact', label: 'Website Enquiries' },
  { key: 'tenant_message', label: 'Tenant Messages' },
  { key: 'system_alert', label: 'System Alerts' },
];

export default function AmiInbox() {
  const userId = localStorage.getItem('userId') || 'ami';
  const [threads, setThreads] = useState([]);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [body, setBody] = useState('');
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const socketRef = useRef(null);
  const activeRef = useRef(null);
  const bottomRef = useRef(null);

  useEffect(() => { activeRef.current = active; }, [active]);

  function fetchThreads() {
    fetch(`/api/ami/inbox?userId=${encodeURIComponent(userId)}`)
      .then(r => r.json())
      .then(d => setThreads(d.threads || d.conversations || []))
      .catch(() => setThreads([]))
      .finally(() => setLoading(false));
  }

  // Socket connection
  useEffect(() => {
    const s = io(window.location.origin, { query: { userId } });
    socketRef.current = s;

    s.on('message', (m) => {
      if (m.conversationId && activeRef.current?.id === m.conversationId) {
        setMessages(prev => prev.some(x => x.id === m.id) ? prev : [...prev, m]);
        try { s.emit('ack', { messageId: m.id, conversationId: m.conversationId }); } catch (e) {}
      }
      fetchThreads();
    });

    s.on('delivered', ({ messageId }) => {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, deliveredAt: new Date().toISOString() } : m));
    });

    return () => s.disconnect();
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchThreads(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load messages when thread changes
  useEffect(() => {
    if (!active) return;
    fetch(`/api/conversations/${active.id}/messages`)
      .then(r => r.json())
      .then(d => setMessages(d.messages || []))
      .catch(() => setMessages([]));
    socketRef.current?.emit('join', active.id);
    return () => { socketRef.current?.emit('leave', active.id); };
  }, [active]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendReply() {
    if (!active || !body.trim()) return;
    const localId = `local_${Date.now()}`;
    const payload = { senderId: userId, body: body.trim() };
    setMessages(prev => [...prev, {
      id: localId, conversationId: active.id, ...payload,
      sentAt: new Date().toISOString(), status: 'sending',
    }]);
    setBody('');
    try {
      const res = await fetch(`/api/conversations/${active.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const d = await res.json();
      setMessages(prev => prev.map(m =>
        m.id === localId ? (d.success && d.message ? d.message : { ...m, status: 'failed' }) : m
      ));
    } catch {
      setMessages(prev => prev.map(m => m.id === localId ? { ...m, status: 'failed' } : m));
    }
    fetchThreads();
  }

  const filtered = filter === 'all'
    ? threads
    : filter === 'unread'
    ? threads.filter(t => (t.unreadCount || 0) > 0)
    : threads.filter(t => t.source === filter);

  const unreadTotal = threads.reduce((n, t) => n + (t.unreadCount || 0), 0);

  return (
    <div className="h-full flex flex-col min-h-0">

      {/* Header */}
      <div className="px-6 py-5 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold">AMI System Authority</p>
            <h1 className="text-2xl font-extrabold text-slate-100 mt-0.5">Unified Inbox</h1>
          </div>
          {unreadTotal > 0 && (
            <span className="px-3 py-1 rounded-full bg-rose-500/25 border border-rose-400/30 text-rose-300 text-xs font-bold">
              {unreadTotal} unread
            </span>
          )}
        </div>

        <div className="flex gap-2 mt-4 flex-wrap">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all border ${
                filter === f.key
                  ? 'bg-indigo-500/30 border-indigo-400/40 text-indigo-200'
                  : 'border-white/10 text-slate-300 hover:border-white/20 hover:text-white'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Two-pane layout */}
      <div className="flex flex-1 min-h-0">

        {/* Thread list */}
        <div className="w-80 flex-shrink-0 border-r border-white/10 overflow-y-auto">
          {loading && <p className="p-4 text-sm text-slate-400">Loading inbox…</p>}

          {!loading && filtered.length === 0 && (
            <div className="p-6 text-center space-y-2">
              <p className="text-3xl">📭</p>
              <p className="text-sm font-semibold text-slate-300">
                {filter === 'all' ? 'Inbox is empty' : 'No messages here'}
              </p>
              <p className="text-xs text-slate-500">
                {filter === 'all'
                  ? 'Website enquiries, tenant messages, and system alerts will appear here once the backend delivers them.'
                  : 'Try switching to "All" to see all messages.'}
              </p>
            </div>
          )}

          {filtered.map(t => (
            <button
              key={t.id}
              onClick={() => setActive(t)}
              className={`w-full text-left px-4 py-3 border-b border-white/5 transition-colors hover:bg-indigo-500/10 ${
                active?.id === t.id ? 'bg-indigo-500/15 border-l-2 border-l-indigo-400' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className={`text-sm font-semibold truncate ${(t.unreadCount || 0) > 0 ? 'text-white' : 'text-slate-300'}`}>
                  {t.subject || t.senderName || 'Message'}
                </p>
                <p className="text-[10px] text-slate-500 flex-shrink-0">{timeAgo(t.updatedAt || t.lastMessageAt)}</p>
              </div>
              <p className="text-xs text-slate-400 truncate mb-2">{t.preview || t.lastMessage || '—'}</p>
              <div className="flex items-center justify-between">
                <SourceTag source={t.source} />
                {(t.unreadCount || 0) > 0 && (
                  <span className="w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
                    {t.unreadCount}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>

        {/* Message thread pane */}
        <div className="flex-1 flex flex-col min-h-0">
          {!active ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-2">
                <p className="text-4xl">✉️</p>
                <p className="text-sm font-semibold text-slate-300">Select a thread to read</p>
                <p className="text-xs text-slate-500">
                  This inbox receives website enquiries,<br />
                  messages from tenant owners, and platform alerts.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Thread header */}
              <div className="px-5 py-4 border-b border-white/10">
                <p className="font-semibold text-slate-100">{active.subject || active.senderName || 'Thread'}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <SourceTag source={active.source} />
                  {active.senderEmail && <span className="text-xs text-slate-400">{active.senderEmail}</span>}
                  {active.tenantName  && <span className="text-xs text-slate-400">· {active.tenantName}</span>}
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 && (
                  <p className="text-xs text-slate-500 text-center mt-4">No messages yet in this thread.</p>
                )}
                {messages.map(m => {
                  const isMe = m.senderId === userId;
                  return (
                    <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[72%] rounded-2xl px-4 py-2 text-sm ${
                        isMe
                          ? 'bg-indigo-600/30 border border-indigo-400/20 text-indigo-100'
                          : 'bg-white/5 border border-white/10 text-slate-100'
                      }`}>
                        {!isMe && (
                          <p className="text-[10px] font-bold text-indigo-300 mb-1">
                            {m.senderName || m.senderId}
                          </p>
                        )}
                        <p className="leading-relaxed">{m.body}</p>
                        <p className="text-[10px] text-slate-400 mt-1 text-right">
                          {m.status === 'sending' ? 'Sending…'
                            : m.status === 'failed' ? '⚠ Failed'
                            : timeAgo(m.sentAt)}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>

              {/* Reply composer */}
              {active.source !== 'system_alert' ? (
                <div className="px-4 py-3 border-t border-white/10 flex gap-2 items-end">
                  <textarea
                    value={body}
                    onChange={e => setBody(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
                    rows={2}
                    placeholder="Reply… (Enter to send, Shift+Enter for new line)"
                    className="flex-1 rounded-xl bg-slate-900/40 border border-white/10 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 resize-none"
                  />
                  <button
                    onClick={sendReply}
                    disabled={!body.trim()}
                    className="px-4 py-2 rounded-xl bg-indigo-500/30 border border-indigo-400/30 text-indigo-200 font-semibold text-sm disabled:opacity-40 hover:bg-indigo-500/50 transition-colors"
                  >
                    Send
                  </button>
                </div>
              ) : (
                <div className="px-4 py-3 border-t border-white/10">
                  <p className="text-xs text-slate-500">
                    System alerts are read-only and generated automatically by the platform.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
