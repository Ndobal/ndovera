import React, { useEffect, useState } from 'react';

export default function AmiAuditsPage() {
  const [logs, setLogs]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [search, setSearch]     = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo]     = useState('');
  const [page, setPage]         = useState(1);
  const PAGE_SIZE = 25;

  const token = localStorage.getItem('token');

  function loadLogs() {
    setLoading(true);
    const params = new URLSearchParams();
    if (search)   params.set('search', search);
    if (dateFrom) params.set('from', dateFrom);
    if (dateTo)   params.set('to', dateTo);
    params.set('limit', '500');

    fetch(`/api/ami/audit-logs?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => { setLogs(d.logs || d.entries || []); setError(''); setPage(1); })
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadLogs(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function exportCSV() {
    const rows = [['Timestamp','Actor','Action','Target','Result','IP']];
    logs.forEach(e => rows.push([e.timestamp, e.actor, e.action, e.target, e.result, e.ip]));
    const csv = rows.map(r => r.map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `audit-log-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  }

  const paginated = logs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.ceil(logs.length / PAGE_SIZE);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <section className="glass-surface rounded-3xl p-6 border border-white/10">
        <p className="micro-label neon-subtle mb-2">AMI System Authority</p>
        <h1 className="text-3xl command-title neon-title mb-2">Audit Trail</h1>
        <p className="text-slate-700 dark:text-slate-300 neon-subtle">
          Immutable log of all critical actions taken on the platform. Search by actor, action, or date range.
        </p>
        {error && <div className="mt-4 rounded-2xl border border-rose-300/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>}
      </section>

      {/* Filters */}
      <section className="glass-surface rounded-3xl p-6 border border-white/10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && loadLogs()}
            placeholder="Search actor, action, target…"
            className="rounded-2xl border border-white/10 bg-slate-900/30 px-4 py-3 text-sm text-slate-900 dark:text-amber-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
          />
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="rounded-2xl border border-white/10 bg-slate-900/30 px-4 py-3 text-sm text-slate-900 dark:text-amber-100"
          />
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="rounded-2xl border border-white/10 bg-slate-900/30 px-4 py-3 text-sm text-slate-900 dark:text-amber-100"
          />
        </div>
        <div className="flex flex-wrap gap-3 mt-3">
          <button
            onClick={loadLogs}
            className="rounded-2xl bg-emerald-500 px-5 py-2 text-sm font-semibold text-slate-950"
          >
            Search
          </button>
          <button
            onClick={() => { setSearch(''); setDateFrom(''); setDateTo(''); }}
            className="rounded-2xl border border-white/10 px-5 py-2 text-sm font-semibold text-slate-300 hover:text-white transition-colors"
          >
            Clear
          </button>
          <button
            onClick={exportCSV}
            disabled={logs.length === 0}
            className="rounded-2xl border border-indigo-400/40 px-5 py-2 text-sm font-semibold text-indigo-200 hover:bg-indigo-500/10 disabled:opacity-40 transition-colors"
          >
            ↓ Export CSV
          </button>
          <span className="self-center text-xs neon-subtle">{logs.length} entries</span>
        </div>
      </section>

      {/* Log table */}
      <section className="glass-surface rounded-3xl p-6 border border-white/10">
        <h2 className="text-xl command-title neon-title mb-4">Log Entries</h2>

        {loading && <p className="text-sm neon-subtle">Loading audit logs…</p>}

        {!loading && logs.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-slate-900/30 p-5 text-center">
            <p className="micro-label accent-amber mb-1">No audit logs found</p>
            <p className="text-xs text-slate-400">
              Audit entries will appear here once the backend serves them via <code>/api/ami/audit-logs</code>.
            </p>
          </div>
        )}

        <div className="space-y-2">
          {paginated.map((entry, i) => (
            <div key={entry.id || i} className="rounded-2xl bg-slate-900/20 border border-white/5 px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-slate-100">{entry.action}</span>
                  {entry.result === 'success' && <span className="micro-label accent-emerald">success</span>}
                  {entry.result === 'failed'  && <span className="micro-label accent-rose">failed</span>}
                </div>
                <span className="text-xs neon-subtle">{entry.timestamp ? new Date(entry.timestamp).toLocaleString() : '—'}</span>
              </div>
              <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-slate-400">
                {entry.actor  && <span>Actor: <span className="text-indigo-300">{entry.actor}</span></span>}
                {entry.target && <span>Target: <span className="text-amber-200">{entry.target}</span></span>}
                {entry.ip     && <span>IP: {entry.ip}</span>}
              </div>
              {entry.detail && <p className="text-xs text-slate-500 mt-1">{entry.detail}</p>}
            </div>
          ))}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/10">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-2xl border border-white/10 px-4 py-2 text-sm text-slate-300 disabled:opacity-40"
            >
              ← Prev
            </button>
            <span className="text-xs neon-subtle">Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="rounded-2xl border border-white/10 px-4 py-2 text-sm text-slate-300 disabled:opacity-40"
            >
              Next →
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
