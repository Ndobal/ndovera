import React, { useEffect, useState } from 'react';
import {
  getManagedOpportunities,
  createOpportunity,
  updateOpportunity,
  deleteOpportunity,
} from '../services/publicSiteApi';

const EMPTY = {
  title: '',
  description: '',
  location: '',
  employmentType: 'Full-time',
  department: '',
  applyUrl: '',
  applyEmail: '',
  deadline: '',
  tenantId: '',
};

const input = 'mt-1 w-full rounded-xl border border-[#c9a96e]/40 bg-[#fff8ee] px-3 py-2 text-sm text-[#191970] outline-none focus:ring-2 focus:ring-[#1a5c38] dark:border-white/10 dark:bg-slate-800 dark:text-slate-100';
const label = 'text-xs font-semibold uppercase tracking-[0.18em] text-[#800020] dark:text-slate-400';

/**
 * Reusable vacancy manager. `allowTenantField` lets a superadmin (ami) target a
 * specific school by tenant id (blank = NDOVERA-wide posting); owners/HOS omit it
 * and the backend scopes the vacancy to their own school automatically.
 */
export default function OpportunitiesManager({ allowTenantField = false }) {
  const [vacancies, setVacancies] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  async function load() {
    setLoading(true);
    try {
      const data = await getManagedOpportunities();
      setVacancies(Array.isArray(data?.vacancies) ? data.vacancies : []);
    } catch (error) {
      setMessage(error.message || 'Could not load vacancies.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!form.title.trim()) { setMessage('Title is required.'); return; }
    setSaving(true);
    setMessage('');
    try {
      await createOpportunity(form);
      setForm(EMPTY);
      setMessage('Vacancy posted.');
      await load();
    } catch (error) {
      setMessage(error.message || 'Could not post the vacancy.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(vacancy) {
    await updateOpportunity(vacancy.id, { status: vacancy.status === 'open' ? 'closed' : 'open' });
    await load();
  }

  async function remove(vacancy) {
    await deleteOpportunity(vacancy.id);
    await load();
  }

  return (
    <section className="rounded-3xl border border-[#c9a96e]/45 bg-[#b5e3f4] p-5 shadow-[0_18px_40px_rgba(128,0,0,0.08)] dark:border-white/10 dark:bg-slate-900/40">
      <p className="text-lg font-bold text-[#800000] dark:text-slate-100">Opportunities / Vacancies</p>
      <p className="mt-1 text-sm text-[#191970] dark:text-slate-300">Posted vacancies appear on the public Opportunities page and on staff, parent, and student dashboards.</p>

      <form onSubmit={handleSubmit} className="mt-5 grid gap-3 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className={label}>Job Title</label>
          <input value={form.title} onChange={e => setForm(c => ({ ...c, title: e.target.value }))} className={input} placeholder="e.g. Mathematics Teacher" />
        </div>
        <div className="md:col-span-2">
          <label className={label}>Description</label>
          <textarea rows={4} value={form.description} onChange={e => setForm(c => ({ ...c, description: e.target.value }))} className={`${input} resize-none`} placeholder="Role summary, requirements, responsibilities…" />
        </div>
        <div>
          <label className={label}>Employment Type</label>
          <input value={form.employmentType} onChange={e => setForm(c => ({ ...c, employmentType: e.target.value }))} className={input} placeholder="Full-time" />
        </div>
        <div>
          <label className={label}>Location</label>
          <input value={form.location} onChange={e => setForm(c => ({ ...c, location: e.target.value }))} className={input} placeholder="City / Remote" />
        </div>
        <div>
          <label className={label}>Department</label>
          <input value={form.department} onChange={e => setForm(c => ({ ...c, department: e.target.value }))} className={input} placeholder="e.g. Science" />
        </div>
        <div>
          <label className={label}>Apply by (deadline)</label>
          <input value={form.deadline} onChange={e => setForm(c => ({ ...c, deadline: e.target.value }))} className={input} placeholder="e.g. 31 July 2026" />
        </div>
        <div>
          <label className={label}>Apply URL</label>
          <input value={form.applyUrl} onChange={e => setForm(c => ({ ...c, applyUrl: e.target.value }))} className={input} placeholder="https://…" />
        </div>
        <div>
          <label className={label}>Apply Email</label>
          <input value={form.applyEmail} onChange={e => setForm(c => ({ ...c, applyEmail: e.target.value }))} className={input} placeholder="jobs@school.com" />
        </div>
        {allowTenantField ? (
          <div className="md:col-span-2">
            <label className={label}>Post for school (tenant ID) — leave blank for NDOVERA</label>
            <input value={form.tenantId} onChange={e => setForm(c => ({ ...c, tenantId: e.target.value }))} className={input} placeholder="Blank = NDOVERA-wide" />
          </div>
        ) : null}

        {message ? <p className={`md:col-span-2 text-sm ${message.includes('posted') ? 'text-[#1a5c38] dark:text-emerald-300' : 'text-red-600'}`}>{message}</p> : null}

        <div className="md:col-span-2">
          <button type="submit" disabled={saving} className="rounded-2xl bg-[#800020] px-5 py-2.5 text-sm font-bold text-[#b5e3f4] transition hover:bg-[#670019] disabled:opacity-60">
            {saving ? 'Posting…' : 'Post Vacancy'}
          </button>
        </div>
      </form>

      <div className="mt-6 space-y-3">
        {loading ? <p className="text-sm text-[#800020] dark:text-slate-400">Loading…</p> : null}
        {!loading && !vacancies.length ? <p className="text-sm text-[#191970] dark:text-slate-300">No vacancies posted yet.</p> : null}
        {vacancies.map(vacancy => (
          <div key={vacancy.id} className="flex items-center justify-between gap-3 rounded-2xl border border-[#c9a96e]/35 bg-[#fff8ee]/70 p-3 dark:border-white/10 dark:bg-slate-800/40">
            <div className="min-w-0">
              <p className="truncate font-semibold text-[#14215b] dark:text-slate-100">{vacancy.title}</p>
              <p className="truncate text-xs text-[#4a5578] dark:text-slate-400">{vacancy.schoolName} • {vacancy.employmentType || '—'} • {vacancy.status}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button type="button" onClick={() => toggleStatus(vacancy)} className="rounded-xl border border-[#14215b]/30 px-3 py-1.5 text-xs font-semibold text-[#14215b] dark:text-slate-200">
                {vacancy.status === 'open' ? 'Close' : 'Reopen'}
              </button>
              <button type="button" onClick={() => remove(vacancy)} className="rounded-xl border border-red-400/40 px-3 py-1.5 text-xs font-semibold text-red-600">Delete</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
