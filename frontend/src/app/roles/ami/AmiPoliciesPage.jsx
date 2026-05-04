import React, { useEffect, useState } from 'react';

const STATUS_ACCENT = {
  published: 'accent-emerald',
  draft:     'accent-amber',
  archived:  'accent-rose',
};

const SCOPES   = ['global', 'tenants', 'security', 'billing', 'data'];
const ENFORCEMENTS = ['advisory', 'required', 'strict'];

const EMPTY_FORM = { title: '', content: '', scope: 'global', enforcement: 'required' };

export default function AmiPoliciesPage() {
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [notice, setNotice]     = useState('');
  const [form, setForm]         = useState(EMPTY_FORM);
  const [busy, setBusy]         = useState('');
  const [showForm, setShowForm] = useState(false);

  const token = localStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  function loadPolicies() {
    setLoading(true);
    fetch('/api/ami/policies', { headers })
      .then(r => r.json())
      .then(d => { setPolicies(d.policies || []); setError(''); })
      .catch(() => setPolicies([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadPolicies(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function runAction(key, fn) {
    setBusy(key); setError(''); setNotice('');
    try { await fn(); await loadPolicies(); }
    catch (e) { setError(e.message || 'Action failed.'); }
    finally { setBusy(''); }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    await runAction('create', async () => {
      const res = await fetch('/api/ami/policies', { method: 'POST', headers, body: JSON.stringify(form) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed to save policy.');
      setNotice(`Policy "${form.title}" created as draft.`);
      setForm(EMPTY_FORM);
      setShowForm(false);
    });
  }

  async function publish(id) {
    await runAction(`publish-${id}`, async () => {
      const res = await fetch(`/api/ami/policies/${id}/publish`, { method: 'POST', headers, body: '{}' });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed to publish.');
      setNotice('Policy published.');
    });
  }

  async function archive(id) {
    await runAction(`archive-${id}`, async () => {
      const res = await fetch(`/api/ami/policies/${id}/archive`, { method: 'POST', headers, body: '{}' });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed to archive.');
      setNotice('Policy archived.');
    });
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <section className="glass-surface rounded-3xl p-6 border border-white/10">
        <p className="micro-label neon-subtle mb-2">AMI System Authority</p>
        <h1 className="text-3xl command-title neon-title mb-2">Policy Engine</h1>
        <p className="text-slate-700 dark:text-slate-300 neon-subtle">
          Create, publish, and manage global platform policies across all tenants.
        </p>

        {error  && <div className="mt-4 rounded-2xl border border-rose-300/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>}
        {notice && <div className="mt-4 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{notice}</div>}

        <div className="mt-4 flex gap-3">
          <button
            onClick={() => setShowForm(v => !v)}
            className="rounded-2xl bg-emerald-500 px-5 py-3 font-semibold text-slate-950"
          >
            {showForm ? '✕ Cancel' : '+ New Policy'}
          </button>
        </div>
      </section>

      {/* Create form */}
      {showForm && (
        <section className="glass-surface rounded-3xl p-6 border border-white/10">
          <h2 className="text-xl command-title neon-title mb-4">Draft New Policy</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs micro-label neon-subtle mb-1 block">Policy Title</label>
              <input
                required
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Data Retention Policy v2"
                className="w-full rounded-2xl border border-white/10 bg-slate-900/30 px-4 py-3 text-slate-900 dark:text-amber-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs micro-label neon-subtle mb-1 block">Scope</label>
                <select
                  value={form.scope}
                  onChange={e => setForm(f => ({ ...f, scope: e.target.value }))}
                  className="w-full rounded-2xl border border-white/10 bg-slate-900/30 px-4 py-3 text-slate-900 dark:text-amber-100"
                >
                  {SCOPES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs micro-label neon-subtle mb-1 block">Enforcement</label>
                <select
                  value={form.enforcement}
                  onChange={e => setForm(f => ({ ...f, enforcement: e.target.value }))}
                  className="w-full rounded-2xl border border-white/10 bg-slate-900/30 px-4 py-3 text-slate-900 dark:text-amber-100"
                >
                  {ENFORCEMENTS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs micro-label neon-subtle mb-1 block">Policy Content</label>
              <textarea
                required
                rows={6}
                value={form.content}
                onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                placeholder="Write the full policy text here…"
                className="w-full rounded-2xl border border-white/10 bg-slate-900/30 px-4 py-3 text-slate-900 dark:text-amber-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
            </div>

            <button
              type="submit"
              disabled={busy === 'create'}
              className="w-full rounded-2xl bg-emerald-500 px-4 py-3 font-semibold text-slate-950 disabled:opacity-60"
            >
              {busy === 'create' ? 'Saving…' : 'Save as Draft'}
            </button>
          </form>
        </section>
      )}

      {/* Policy summary */}
      <section className="grid grid-cols-3 gap-4">
        {[
          { label: 'Published', count: policies.filter(p => p.status === 'published').length, accent: 'accent-emerald' },
          { label: 'Drafts',    count: policies.filter(p => p.status === 'draft').length,     accent: 'accent-amber' },
          { label: 'Archived',  count: policies.filter(p => p.status === 'archived').length,  accent: 'accent-rose' },
        ].map(c => (
          <div key={c.label} className="glass-surface rounded-3xl p-5">
            <p className="micro-label neon-subtle">{c.label}</p>
            <p className={`mt-2 text-2xl command-title ${c.accent}`}>{c.count}</p>
          </div>
        ))}
      </section>

      {/* Policy list */}
      <section className="glass-surface rounded-3xl p-6 border border-white/10">
        <h2 className="text-xl command-title neon-title mb-4">All Policies</h2>

        {loading && <p className="text-sm neon-subtle">Loading policies…</p>}

        {!loading && policies.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-slate-900/30 p-5 text-center">
            <p className="micro-label accent-amber mb-1">No policies yet</p>
            <p className="text-xs text-slate-400">
              Create a policy above. Policies will also be fetched from <code>/api/ami/policies</code>.
            </p>
          </div>
        )}

        <div className="space-y-4">
          {policies.map(policy => (
            <div key={policy.id} className="rounded-2xl bg-slate-900/20 border border-white/10 p-5 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-100">{policy.title}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <span className={`micro-label ${STATUS_ACCENT[policy.status] || 'accent-indigo'}`}>{policy.status}</span>
                    <span className="micro-label accent-indigo">{policy.scope}</span>
                    <span className="micro-label accent-amber">{policy.enforcement}</span>
                  </div>
                </div>
                <span className="text-xs neon-subtle">{policy.updatedAt ? new Date(policy.updatedAt).toLocaleDateString() : ''}</span>
              </div>

              {policy.content && (
                <p className="text-sm text-slate-300 line-clamp-3">{policy.content}</p>
              )}

              <div className="flex flex-wrap gap-2 pt-1">
                {policy.status === 'draft' && (
                  <button
                    onClick={() => publish(policy.id)}
                    disabled={!!busy}
                    className="rounded-2xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
                  >
                    Publish
                  </button>
                )}
                {policy.status !== 'archived' && (
                  <button
                    onClick={() => archive(policy.id)}
                    disabled={!!busy}
                    className="rounded-2xl border border-rose-400/40 px-4 py-2 text-sm font-semibold text-rose-200 disabled:opacity-40"
                  >
                    Archive
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
