import React, { useEffect, useState } from 'react';

const RISK_ACCENT = {
  critical: 'accent-rose',
  high:     'accent-amber',
  medium:   'accent-indigo',
  low:      'accent-emerald',
};

function RiskBadge({ level }) {
  return <span className={`micro-label ${RISK_ACCENT[level] || 'accent-indigo'}`}>{level || 'info'}</span>;
}

export default function AmiSecurityPage() {
  const [events, setEvents]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [notice, setNotice]       = useState('');
  const [filter, setFilter]       = useState('all');
  const [search, setSearch]       = useState('');
  const [locking, setLocking]     = useState(false);

  function loadEvents() {
    setLoading(true);
    fetch('/api/ami/security-events', {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    })
      .then(r => r.json())
      .then(d => { setEvents(d.events || []); setError(''); })
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadEvents(); }, []);

  async function triggerEmergencyLock() {
    if (!window.confirm('This will lock all tenant access immediately. Proceed?')) return;
    setLocking(true);
    try {
      const res = await fetch('/api/ami/emergency-lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ reason: 'Manual AMI emergency lock' }),
      });
      const d = await res.json();
      setNotice(d.message || 'Emergency lock triggered.');
    } catch {
      setError('Failed to trigger emergency lock. Contact the system administrator.');
    } finally {
      setLocking(false);
    }
  }

  function exportLog() {
    const rows = [['Timestamp','Actor','Action','Target','Risk','IP']];
    events.forEach(e => rows.push([e.timestamp, e.actor, e.action, e.target, e.riskLevel, e.ip]));
    const csv = rows.map(r => r.map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `security-log-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  }

  const displayed = events.filter(e => {
    if (filter !== 'all' && e.riskLevel !== filter) return false;
    if (search && !`${e.actor} ${e.action} ${e.target} ${e.ip}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <section className="glass-surface rounded-3xl p-6 border border-white/10">
        <p className="micro-label neon-subtle mb-2">AMI System Authority</p>
        <h1 className="text-3xl command-title neon-title mb-2">Security Command</h1>
        <p className="text-slate-700 dark:text-slate-300 neon-subtle">
          Monitor platform-wide security events, review suspicious activity, and trigger emergency responses.
        </p>

        {error  && <div className="mt-4 rounded-2xl border border-rose-300/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>}
        {notice && <div className="mt-4 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{notice}</div>}
      </section>

      {/* Summary cards */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Critical',  accent: 'accent-rose',    count: events.filter(e => e.riskLevel === 'critical').length },
          { label: 'High',      accent: 'accent-amber',   count: events.filter(e => e.riskLevel === 'high').length },
          { label: 'Medium',    accent: 'accent-indigo',  count: events.filter(e => e.riskLevel === 'medium').length },
          { label: 'Total Events', accent: 'accent-emerald', count: events.length },
        ].map(c => (
          <div key={c.label} className="glass-surface rounded-3xl p-5">
            <p className="micro-label neon-subtle">{c.label}</p>
            <p className={`mt-2 text-2xl command-title ${c.accent}`}>{c.count}</p>
          </div>
        ))}
      </section>

      {/* Actions */}
      <section className="glass-surface rounded-3xl p-6 border border-white/10">
        <h2 className="text-xl command-title neon-title mb-4">Emergency Controls</h2>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={triggerEmergencyLock}
            disabled={locking}
            className="rounded-2xl border border-rose-400/40 px-5 py-3 font-semibold text-rose-200 hover:bg-rose-500/10 disabled:opacity-50 transition-colors"
          >
            {locking ? 'Locking…' : '🔒 Emergency Platform Lock'}
          </button>
          <button
            onClick={loadEvents}
            className="rounded-2xl border border-white/10 px-5 py-3 font-semibold text-slate-300 hover:text-white hover:border-white/30 transition-colors"
          >
            ↻ Refresh
          </button>
          <button
            onClick={exportLog}
            disabled={events.length === 0}
            className="rounded-2xl border border-indigo-400/40 px-5 py-3 font-semibold text-indigo-200 hover:bg-indigo-500/10 disabled:opacity-40 transition-colors"
          >
            ↓ Export CSV
          </button>
        </div>
      </section>

      {/* Event log */}
      <section className="glass-surface rounded-3xl p-6 border border-white/10">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-xl command-title neon-title">Security Events</h2>
          <div className="flex flex-wrap gap-2">
            {['all','critical','high','medium','low'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`text-xs px-3 py-1 rounded-lg border transition-colors ${
                  filter === f ? 'quick-create border-transparent' : 'border-white/10 text-slate-400 hover:text-white'
                }`}
              >
                {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by actor, action, IP…"
          className="w-full rounded-2xl border border-white/10 bg-slate-900/30 px-4 py-2 text-sm text-slate-900 dark:text-amber-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 mb-4"
        />

        {loading && <p className="text-sm neon-subtle">Loading events…</p>}

        {!loading && displayed.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-slate-900/30 p-5 text-center">
            <p className="micro-label accent-amber mb-1">No security events</p>
            <p className="text-xs text-slate-400">
              Security events will appear here once the backend delivers them via <code>/api/ami/security-events</code>.
            </p>
          </div>
        )}

        <div className="space-y-3">
          {displayed.map((e, i) => (
            <div key={e.id || i} className="rounded-2xl bg-slate-900/30 border border-white/5 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2 mb-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <RiskBadge level={e.riskLevel} />
                  <span className="text-sm font-semibold text-slate-100">{e.action}</span>
                </div>
                <span className="text-xs neon-subtle">{e.timestamp ? new Date(e.timestamp).toLocaleString() : '—'}</span>
              </div>
              <p className="text-xs text-slate-300">
                <span className="text-indigo-300">{e.actor}</span>
                {e.target ? <> → <span className="text-amber-200">{e.target}</span></> : null}
              </p>
              {e.ip && <p className="text-xs neon-subtle mt-1">IP: {e.ip}</p>}
              {e.detail && <p className="text-xs text-slate-400 mt-1">{e.detail}</p>}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
