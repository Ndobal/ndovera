import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getApiUrl } from '../../config/apiBase';
import { getStoredAuth, buildSelectedRoleHeader } from '../auth/services/authApi';
const KINDS = ['incident','visitor','patrol','handover','gate','hazard'];
const SEVERITIES = ['low','medium','high','critical'];
const SUPERVISORS = new Set(['chiefsecurityofficer','owner','hos']);
const api = async (path, options = {}) => {
  const auth = getStoredAuth();
  const token = typeof auth === 'string' ? auth : auth?.token;
  const res = await fetch(getApiUrl('/api/premises-security' + path), {
    ...options,
    headers: {
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...buildSelectedRoleHeader(),
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
    credentials: 'include',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Security service unavailable.');
  return data;
};
export default function PremisesSecurityDashboard({ role }) {
  const supervisor = SUPERVISORS.has(role);
  const [data, setData] = useState({ records: [], summary: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [form, setForm] = useState({ kind: 'incident', title: '', location: '', notes: '', severity: 'low' });
  const load = useCallback(async () => {
    try { setData(await api('/overview')); setError(''); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const records = useMemo(() => (data.records || []).filter(r => filter === 'all' || r.kind === filter), [data, filter]);
  const count = (status) => (data.summary || []).filter(r => r.status === status).reduce((sum, r) => sum + Number(r.total || 0), 0);
  const submit = async (event) => {
    event.preventDefault(); setNotice('');
    try {
      await api('/records', { method: 'POST', body: JSON.stringify(form) });
      setForm({ kind: 'incident', title: '', location: '', notes: '', severity: 'low' });
      setNotice('Record saved and added to the security log.'); await load();
    } catch (err) { setError(err.message); }
  };
  const changeStatus = async (id, status) => {
    try { await api('/records/' + id + '/status', { method: 'PATCH', body: JSON.stringify({ status }) }); await load(); }
    catch (err) { setError(err.message); }
  };
  const escalate = async (id, action) => {
    try {
      await api('/records/' + id + '/' + action, { method: 'PATCH' });
      setNotice(action === 'escalate' ? 'Escalation recorded for supervisor review.' : 'Escalation acknowledged.');
      await load();
    } catch (err) { setError(err.message); }
  };
  const checkout = async (id) => {
    try {
      await api('/records/' + id + '/checkout', { method: 'PATCH' });
      setNotice('Visitor departure recorded.'); await load();
      if (selected?.record?.id === id) setSelected(null);
    } catch (err) { setError(err.message); }
  };
  const viewHistory = async (id) => {
    setHistoryLoading(true);
    try { setSelected(await api('/records/' + id + '/events')); setError(''); }
    catch (err) { setError(err.message); }
    finally { setHistoryLoading(false); }
  };
  const input = 'w-full rounded-lg border border-slate-300 p-3 text-slate-900';
  return <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
    <header className="rounded-2xl bg-[#191970] p-6 text-white">
      <p className="text-sm uppercase tracking-widest text-amber-200">School Premises Protection</p>
      <h1 className="mt-2 text-3xl font-bold">{role === 'chiefsecurityofficer' ? 'Chief Security Officer' : role === 'securityofficer' ? 'Security Officer' : 'School Security'} Dashboard</h1>
      <p className="mt-2 text-sm text-slate-200">Incident reporting, gate records, visitor logs, patrols, hazards and shift handovers.</p>
    </header>
    {error && <p role="alert" className="rounded-lg border border-red-300 p-3 text-red-800">{error}</p>}
    {notice && <p role="status" className="rounded-lg border border-green-300 p-3 text-green-800">{notice}</p>}
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {[['Open', count('open')], ['Investigating', count('investigating')], ['Resolved', count('resolved')], ['Visitors on site', data.activeVisitors || 0], ['Escalations awaiting review', data.pendingEscalations || 0]].map(([label, value]) =>
        <div key={label} className="rounded-xl border bg-white p-5 shadow-sm"><p className="text-sm text-slate-600">{label} reports</p><strong className="text-3xl text-[#191970]">{value}</strong></div>)}
    </div>
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-xl border bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-xl font-semibold">Log a security activity</h2>
        <form className="space-y-3" onSubmit={submit}>
          <label className="block text-sm">Activity type<select className={input} value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value })}>{KINDS.map(k => <option key={k} value={k}>{k[0].toUpperCase() + k.slice(1)}</option>)}</select></label>
          <label className="block text-sm">Title / visitor purpose<input className={input} required maxLength={150} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}/></label>
          <label className="block text-sm">Gate / building / location<input className={input} required maxLength={150} value={form.location} onChange={e => setForm({ ...form, location: e.target.value })}/></label>
          <label className="block text-sm">Priority<select className={input} value={form.severity} onChange={e => setForm({ ...form, severity: e.target.value })}>{SEVERITIES.map(k => <option key={k}>{k}</option>)}</select></label>
          <label className="block text-sm">Details / action taken<textarea className={input} rows={4} maxLength={3000} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}/></label>
          <button className="rounded-lg bg-[#191970] px-5 py-3 font-semibold text-white">Save security record</button>
        </form>
      </section>
      <section className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-xl font-semibold">Recent security log</h2><button onClick={load} className="rounded border px-3 py-2">Refresh</button></div>
        <label className="block text-sm">Filter by type<select className={input} value={filter} onChange={e => setFilter(e.target.value)}><option value="all">All activities</option>{KINDS.map(k => <option key={k}>{k}</option>)}</select></label>
        {loading ? <p className="py-5">Loading live records…</p> : records.length === 0 ? <p className="py-5 text-slate-600">No records available for this filter.</p> :
          <div className="mt-4 max-h-[650px] space-y-3 overflow-y-auto">{records.map(r => <article key={r.id} className="rounded-lg border p-3">
            <div className="flex items-start justify-between gap-2"><strong>{r.title}</strong><span className="rounded bg-slate-100 px-2 py-1 text-xs">{r.severity}</span></div>
            <p className="text-sm text-slate-600">{r.kind} · {r.location} · {r.created_at}</p>
            <p className="mt-2 text-sm">Status: <strong>{r.status}</strong></p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="rounded border px-2 py-1 text-xs" onClick={() => viewHistory(r.id)}>View details & audit</button>
              {['incident','hazard','gate'].includes(r.kind) && r.status !== 'resolved' && !r.escalated_at && <button className="rounded border border-red-600 px-2 py-1 text-xs" onClick={() => escalate(r.id, 'escalate')}>Escalate</button>}
              {r.escalated_at && !r.acknowledged_at && <span className="text-xs font-semibold text-red-700">Escalated — awaiting review</span>}
              {supervisor && r.escalated_at && !r.acknowledged_at && r.status !== 'resolved' && <button className="rounded border border-blue-600 px-2 py-1 text-xs" onClick={() => escalate(r.id, 'acknowledge')}>Acknowledge</button>}
              {r.acknowledged_at && <span className="text-xs text-green-700">Acknowledged</span>}
              {r.kind === 'visitor' && !r.checked_out_at && <button className="rounded border border-amber-600 px-2 py-1 text-xs" onClick={() => checkout(r.id)}>Check visitor out</button>}
              {r.kind === 'visitor' && r.checked_out_at && <span className="text-xs text-green-700">Departed: {r.checked_out_at}</span>}
            </div>
            {supervisor && <div className="mt-2 flex gap-2"><button className="rounded border px-2 py-1 text-xs" onClick={() => changeStatus(r.id, 'investigating')}>Investigate</button><button className="rounded border px-2 py-1 text-xs" onClick={() => changeStatus(r.id, 'resolved')}>Resolve</button></div>}
          </article>)}</div>}
      </section>
    </div>
    {historyLoading && <p role="status">Loading record history…</p>}
    {selected && <section className="rounded-xl border bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between"><h2 className="text-xl font-semibold">Security record & audit trail</h2><button className="rounded border px-3 py-1" onClick={() => setSelected(null)}>Close</button></div>
      <h3 className="mt-3 font-semibold">{selected.record.title}</h3>
      <p className="mt-2 whitespace-pre-wrap text-sm">{selected.record.notes || 'No additional notes recorded.'}</p>
      <p className="mt-2 text-sm text-slate-600">{selected.record.location} · {selected.record.status}</p>
      <h3 className="mt-4 font-semibold">Recorded actions</h3>
      <ul className="mt-2 space-y-2">{(selected.events || []).map(event => <li key={event.id} className="rounded border p-2 text-sm">{event.action} · {event.details} · {event.created_at} · by {event.actor_id}</li>)}</ul>
    </section>}
    <p className="text-sm text-slate-600">For an immediate threat, follow the school's emergency response procedure and contact the appropriate emergency services. Logging a report does not automatically send an alert.</p>
  </div>;
}
