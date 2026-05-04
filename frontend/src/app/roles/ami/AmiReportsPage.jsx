import React, { useEffect, useState } from 'react';

export default function AmiReportsPage() {
  const [summary, setSummary]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');

  const token = localStorage.getItem('token');

  useEffect(() => {
    fetch('/api/ami/reports/summary', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => { setSummary(d); setError(''); })
      .catch(() => setSummary(null))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function downloadReport(type) {
    fetch(`/api/ami/reports/export?type=${type}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.blob())
      .then(blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${type}-report-${new Date().toISOString().slice(0,10)}.csv`;
        a.click();
      })
      .catch(() => alert('Export failed — backend endpoint not yet available.'));
  }

  const platform  = summary?.platform  || {};
  const tenants   = summary?.tenants   || {};
  const security  = summary?.security  || {};
  const financial = summary?.financial || {};

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <section className="glass-surface rounded-3xl p-6 border border-white/10">
        <p className="micro-label neon-subtle mb-2">AMI System Authority</p>
        <h1 className="text-3xl command-title neon-title mb-2">Executive Reports</h1>
        <p className="text-slate-700 dark:text-slate-300 neon-subtle">
          Platform health, tenant compliance, financial overview, and security incident summaries.
        </p>
        {error && <div className="mt-4 rounded-2xl border border-rose-300/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>}
      </section>

      {loading && (
        <section className="glass-surface rounded-3xl p-6 border border-white/10">
          <p className="text-sm neon-subtle">Loading reports…</p>
        </section>
      )}

      {!loading && !summary && (
        <section className="glass-surface rounded-3xl p-6 border border-white/10 text-center">
          <p className="micro-label accent-amber mb-2">Reports unavailable</p>
          <p className="text-sm text-slate-400">
            Report data will be served from <code>/api/ami/reports/summary</code> once the backend is connected.
          </p>
        </section>
      )}

      {/* Platform Health */}
      <section className="glass-surface rounded-3xl p-6 border border-white/10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl command-title neon-title">Platform Health</h2>
          <button onClick={() => downloadReport('platform')} className="rounded-2xl border border-indigo-400/40 px-4 py-2 text-sm font-semibold text-indigo-200 hover:bg-indigo-500/10 transition-colors">
            ↓ Export
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Uptime',        value: platform.uptime        || '—', accent: 'accent-emerald' },
            { label: 'API Calls Today', value: platform.apiCalls    || '—', accent: 'accent-indigo' },
            { label: 'Error Rate',    value: platform.errorRate     || '—', accent: 'accent-amber' },
            { label: 'Active Users',  value: platform.activeUsers   || '—', accent: 'accent-emerald' },
          ].map(c => (
            <div key={c.label} className="rounded-2xl bg-slate-900/30 p-4">
              <p className="micro-label neon-subtle">{c.label}</p>
              <p className={`mt-2 text-xl command-title ${c.accent}`}>{c.value}</p>
            </div>
          ))}
        </div>
        {platform.generatedAt && (
          <p className="text-xs neon-subtle mt-3">Generated: {new Date(platform.generatedAt).toLocaleString()}</p>
        )}
      </section>

      {/* Tenant Compliance */}
      <section className="glass-surface rounded-3xl p-6 border border-white/10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl command-title neon-title">Tenant Compliance</h2>
          <button onClick={() => downloadReport('tenants')} className="rounded-2xl border border-indigo-400/40 px-4 py-2 text-sm font-semibold text-indigo-200 hover:bg-indigo-500/10 transition-colors">
            ↓ Export
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Tenants',    value: tenants.total       || '—', accent: 'accent-indigo' },
            { label: 'Active',           value: tenants.active      || '—', accent: 'accent-emerald' },
            { label: 'Pending Approval', value: tenants.pending     || '—', accent: 'accent-amber' },
            { label: 'Suspended',        value: tenants.suspended   || '—', accent: 'accent-rose' },
          ].map(c => (
            <div key={c.label} className="rounded-2xl bg-slate-900/30 p-4">
              <p className="micro-label neon-subtle">{c.label}</p>
              <p className={`mt-2 text-xl command-title ${c.accent}`}>{c.value}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Financial Overview */}
      <section className="glass-surface rounded-3xl p-6 border border-white/10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl command-title neon-title">Financial Overview</h2>
          <button onClick={() => downloadReport('financial')} className="rounded-2xl border border-indigo-400/40 px-4 py-2 text-sm font-semibold text-indigo-200 hover:bg-indigo-500/10 transition-colors">
            ↓ Export
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[
            { label: 'Total Revenue',    value: financial.totalRevenue    || '—', accent: 'accent-emerald' },
            { label: 'Pending Payments', value: financial.pendingPayments || '—', accent: 'accent-amber' },
            { label: 'Failed Payments',  value: financial.failedPayments  || '—', accent: 'accent-rose' },
          ].map(c => (
            <div key={c.label} className="rounded-2xl bg-slate-900/30 p-4">
              <p className="micro-label neon-subtle">{c.label}</p>
              <p className={`mt-2 text-xl command-title ${c.accent}`}>{c.value}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Security Incident Summary */}
      <section className="glass-surface rounded-3xl p-6 border border-white/10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl command-title neon-title">Security Incident Summary</h2>
          <button onClick={() => downloadReport('security')} className="rounded-2xl border border-indigo-400/40 px-4 py-2 text-sm font-semibold text-indigo-200 hover:bg-indigo-500/10 transition-colors">
            ↓ Export
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Critical Events',  value: security.critical   || '—', accent: 'accent-rose' },
            { label: 'High Risk',        value: security.high       || '—', accent: 'accent-amber' },
            { label: 'Resolved',         value: security.resolved   || '—', accent: 'accent-emerald' },
            { label: 'Open Incidents',   value: security.open       || '—', accent: 'accent-indigo' },
          ].map(c => (
            <div key={c.label} className="rounded-2xl bg-slate-900/30 p-4">
              <p className="micro-label neon-subtle">{c.label}</p>
              <p className={`mt-2 text-xl command-title ${c.accent}`}>{c.value}</p>
            </div>
          ))}
        </div>

        {security.incidents && security.incidents.length > 0 && (
          <div className="mt-4 space-y-2">
            {security.incidents.map((inc, i) => (
              <div key={i} className="rounded-2xl bg-slate-900/20 border border-white/5 px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-100">{inc.title}</span>
                  <span className="text-xs neon-subtle">{inc.date ? new Date(inc.date).toLocaleDateString() : '—'}</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">{inc.summary}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
