import React, { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const SOURCE_META = {
  website_contact: { label: 'Website Enquiry', accent: 'accent-indigo' },
  tenant_message:  { label: 'Tenant / Owner',  accent: 'accent-emerald' },
  system_alert:    { label: 'System Alert',    accent: 'accent-rose' },
  direct:          { label: 'Direct Message',  accent: 'accent-amber' },
};

function SourceTag({ source }) {
  const s = SOURCE_META[source] || SOURCE_META.direct;
  return <span className={`micro-label ${s.accent}`}>{s.label}</span>;
}

function timeAgo(iso) {
  if (!iso) return '';
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}

function groupByDate(msgs) {
  const map = {};
  msgs.forEach(m => {
    const k = new Date(m.sentAt).toISOString().slice(0, 10);
    if (!map[k]) map[k] = [];
    map[k].push(m);
  });
  return Object.keys(map).sort().map(k => {
    const d = new Date(`${k}T00:00:00`);
    const today = new Date();
    const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
    let label = d.toLocaleDateString();
    if (d.toDateString() === today.toDateString()) label = 'Today';
    if (d.toDateString() === yesterday.toDateString()) label = 'Yesterday';
    return { key: k, label, items: map[k] };
  });
}

const FILTERS = [
  { key: 'all',             label: 'All' },
  { key: 'unread',          label: 'Unread' },
  { key: 'website_contact', label: 'Website Enquiries' },
  { key: 'tenant_message',  label: 'Tenant Messages' },
  { key: 'system_alert',    label: 'System Alerts' },
];

export default function AmiInbox() {
  const userId = localStorage.getItem('userId') || 'ami';
  const [threads, setThreads]   = useState([]);
  const [active, setActive]     = useState(null);
  const [messages, setMessages] = useState([]);
  const [body, setBody]         = useState('');
  const [filter, setFilter]     = useState('all');
  const [loading, setLoading]   = useState(true);
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

  useEffect(() => {
    if (!active) return;
    fetch(`/api/conversations/${active.id}/messages`)
      .then(r => r.json())
      .then(d => setMessages(d.messages || []))
      .catch(() => setMessages([]));
    socketRef.current?.emit('join', active.id);
    return () => { socketRef.current?.emit('leave', active.id); };
  }, [active]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

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

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(); }
  }

  const filtered = filter === 'all'     ? threads
    : filter === 'unread' ? threads.filter(t => (t.unreadCount || 0) > 0)
    : threads.filter(t => t.source === filter);

  const unreadTotal = threads.reduce((n, t) => n + (t.unreadCount || 0), 0);

  return (
    <div className="p-8 max-w-7xl mx-auto">

      {/* Page header */}
      <section className="glass-surface rounded-3xl p-6 mb-6">
        <p className="micro-label neon-subtle mb-2">AMI System Authority</p>
        <h1 className="text-3xl command-title neon-title mb-1">
          Unified Inbox
          {unreadTotal > 0 && (
            <span className="ml-3 text-sm micro-label accent-rose">{unreadTotal} unread</span>
          )}
        </h1>
        <p className="text-slate-700 dark:text-slate-300 neon-subtle">
          Receive and reply to website enquiries, tenant owner messages, and platform system alerts.
        </p>
        <div className="flex flex-wrap gap-2 mt-4">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`text-xs px-3 py-1 rounded-lg border transition-colors ${
                filter === f.key
                  ? 'quick-create border-transparent'
                  : 'border-white/10 text-slate-400 hover:text-slate-100 hover:border-white/30'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </section>

      {/* Two-pane layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Thread list */}
        <div className="col-span-1 glass-surface rounded-xl p-3">
          <div className="flex items-center justify-between mb-3">
            <strong>Inbox</strong>
            {unreadTotal > 0 && <span className="micro-label accent-rose">{unreadTotal} unread</span>}
          </div>

          {loading && <p className="text-xs neon-subtle p-2">Loading inbox…</p>}

          {!loading && filtered.length === 0 && (
            <div className="rounded-2xl border border-white/10 p-4 bg-slate-900/30">
              <p className="micro-label accent-amber mb-1">No messages</p>
              <p className="text-xs text-slate-400">
                {filter === 'all'
                  ? 'Website enquiries, tenant messages, and system alerts will appear here once the backend is connected.'
                  : 'No messages match this filter.'}
              </p>
            </div>
          )}

          <div className="space-y-1 mt-1">
            {filtered.map(t => (
              <div
                key={t.id}
                onClick={() => setActive(t)}
                className={`p-2 rounded-md cursor-pointer conv-list-item ${active?.id === t.id ? 'bg-indigo-700/20' : ''}`}
              >
                <div className="flex items-start justify-between gap-1 mb-0.5">
                  <div className={`text-sm font-semibold truncate ${(t.unreadCount || 0) > 0 ? 'text-white' : ''}`}>
                    {t.subject || t.senderName || 'Message'}
                  </div>
                  {(t.unreadCount || 0) > 0 && (
                    <span className="micro-label accent-rose flex-shrink-0">{t.unreadCount}</span>
                  )}
                </div>
                <div className="text-xs neon-subtle truncate mb-1">{t.preview || t.lastMessage || '—'}</div>
                <div className="flex items-center justify-between">
                  <SourceTag source={t.source} />
                  <span className="text-xs neon-subtle">{timeAgo(t.updatedAt || t.lastMessageAt)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Thread pane */}
        <div className="col-span-2 glass-surface rounded-xl p-3">
          {!active ? (
            <div className="flex flex-col items-center justify-center h-64 text-center gap-2">
              <p className="micro-label accent-indigo">Select a thread</p>
              <p className="text-sm neon-subtle">
                Website enquiries, tenant messages, and<br />platform alerts will appear here.
              </p>
            </div>
          ) : (
            <div className="flex flex-col h-[32rem]">

              {/* Thread header */}
              <div className="flex items-start gap-3 mb-3 pb-3 border-b border-white/10">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-100 truncate">
                    {active.subject || active.senderName || 'Thread'}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-0.5">
                    <SourceTag source={active.source} />
                    {active.senderEmail && <span className="text-xs neon-subtle">{active.senderEmail}</span>}
                    {active.tenantName  && <span className="text-xs neon-subtle">· {active.tenantName}</span>}
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-auto mb-2 p-2 bg-slate-900/10 rounded">
                {messages.length === 0 && (
                  <p className="text-xs neon-subtle text-center mt-8">No messages in this thread yet.</p>
                )}
                {groupByDate(messages).map(group => (
                  <div key={group.key} className="mb-4">
                    <div className="text-center text-2xs neon-subtle mb-2">{group.label}</div>
                    {group.items.map(m => (
                      <div key={m.id} className={`msg-row ${m.senderId === userId ? 'own' : 'other'}`}>
                        <div style={{ maxWidth: '72%' }}>
                          <div className="msg-sender-name">
                            {m.senderId === userId ? 'You' : (m.senderName || m.senderId)}
                          </div>
                          <div className={`msg-bubble ${m.senderId === userId ? 'own' : 'other'} msg-no-bg`}>
                            <div className="text-xs msg-text-skyblue">{m.body}</div>
                            <div className="text-2xs neon-subtle mt-0.5">
                              {m.status === 'sending' ? 'Sending…'
                                : m.status === 'failed' ? '⚠ Failed'
                                : timeAgo(m.sentAt)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>

              {/* Composer */}
              {active.source !== 'system_alert' ? (
                <div>
                  <textarea
                    value={body}
                    onChange={e => setBody(e.target.value)}
                    onKeyDown={handleKey}
                    rows={2}
                    placeholder="Reply… (Enter to send, Shift+Enter for new line)"
                    className="w-full rounded-md bg-slate-900/40 border border-white/10 px-2 py-1 text-sm text-slate-100"
                  />
                  <div className="mt-2 text-right">
                    <button
                      onClick={sendReply}
                      disabled={!body.trim()}
                      className="px-3 py-1 rounded bg-indigo-600 text-white text-sm disabled:opacity-40"
                    >
                      Send
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-xs neon-subtle border-t border-white/10 pt-3">
                  System alerts are read-only — generated automatically by the platform.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
