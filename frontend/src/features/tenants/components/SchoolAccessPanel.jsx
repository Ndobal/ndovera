import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { completeSchoolAccess, getPlatformAnalytics, getSchoolAccessGrants, openSchoolAccess, requestSchoolAccess, revokeSchoolAccessGrant } from '../services/tenantApi';
import { getStoredAuth, persistAuth } from '../../auth/services/authApi';
import { askConfirm } from '../../../shared/components/AppDialog';

// Ami asks a school's owner for permission to manage the school: what she needs to do and for how
// long. The owner approves (choosing the hours) or declines on their dashboard. Once approved, Ami
// opens the school as its owner until the time ends, she marks the task done, or she ends it.

const HOURS = [[1, '1 hour'], [2, '2 hours'], [4, '4 hours'], [8, '8 hours'], [24, '1 day'], [48, '2 days'], [72, '3 days'], [168, '7 days']];
const FIELD = 'w-full rounded-xl border border-[#c9a96e]/50 bg-white px-3 py-2 text-sm text-[#191970] dark:border-white/10 dark:bg-slate-900 dark:text-white';
const LABEL = 'block text-[11px] font-bold uppercase tracking-[0.14em] text-[#800020] dark:text-slate-300';

const stamp = value => (value ? new Date(value).toLocaleString('en-NG', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '');

/** Open the school as its owner for this approved request (Ami returns from the banner inside). */
export async function openSupportSession(grant) {
  const res = await openSchoolAccess(grant.id);
  const current = getStoredAuth();
  if (current?.token) window.localStorage.setItem('ami_return_token', current.token);
  window.localStorage.setItem('ami_support_grant', JSON.stringify({ id: grant.id, until: res.grantExpiresAt || res.expiresAt, school: grant.tenantId }));
  persistAuth({ token: res.token, user: { role: 'owner', name: res.name, tenantId: res.tenantId } }, {});
  window.location.href = '/roles/owner';
}

export default function SchoolAccessPanel() {
  const [schools, setSchools] = useState([]);
  const [grants, setGrants] = useState([]);
  const [form, setForm] = useState({ tenantId: '', reason: '', hours: 24 });
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const loadGrants = useCallback(() => getSchoolAccessGrants().then(result => setGrants(result.grants || [])).catch(() => {}), []);
  useEffect(() => {
    getPlatformAnalytics().then(result => setSchools(result.schools || [])).catch(err => setError(err.message || 'Could not load the schools.'));
    loadGrants();
    const timer = setInterval(loadGrants, 15000);
    return () => clearInterval(timer);
  }, [loadGrants]);

  const schoolName = useMemo(() => Object.fromEntries(schools.map(school => [school.tenantId, school.schoolName || 'School'])), [schools]);
  const pending = grants.filter(grant => grant.status === 'pending');
  const active = grants.filter(grant => grant.active);
  const recent = grants.filter(grant => !grant.active && grant.status !== 'pending').slice(0, 5);

  async function submit(event) {
    event.preventDefault();
    if (!form.tenantId) { setError('Choose the school.'); return; }
    if (!form.reason.trim()) { setError('Say what you need to do in the school. The owner sees this.'); return; }
    setBusy('request'); setError(''); setNotice('');
    try {
      await requestSchoolAccess(form.tenantId, form.reason.trim(), Number(form.hours));
      setNotice(`Request sent to the owner of ${schoolName[form.tenantId] || 'the school'}. You can open the school as soon as they approve.`);
      setForm({ tenantId: '', reason: '', hours: 24 });
      await loadGrants();
    } catch (err) { setError(err.message || 'Could not send the request.'); } finally { setBusy(''); }
  }

  async function act(grant, work, message) {
    setBusy(grant.id); setError(''); setNotice('');
    try { await work(); if (message) setNotice(message); await loadGrants(); } catch (err) { setError(err.message || 'That did not work.'); } finally { setBusy(''); }
  }

  return (
    <section className="overflow-hidden rounded-3xl border-2 border-[#c9a96e] bg-[#fff8ef] text-[#191970] shadow-sm dark:bg-slate-900/70 dark:text-slate-100">
      <div className="h-1.5 bg-gradient-to-r from-[#800000] via-[#c9a96e] to-[#1a5c38]" />
      <div className="space-y-4 p-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#800020] dark:text-amber-200">Support access</p>
          <h2 className="text-xl font-black text-[#800000] dark:text-white">Manage a school</h2>
          <p className="text-sm">Ask the school&apos;s owner for permission. They see what you need to do and choose how long you may stay; access ends on its own when the time is up.</p>
        </div>
        {error ? <p role="alert" className="rounded-2xl bg-rose-100 px-4 py-2 text-sm font-semibold text-rose-900">{error}</p> : null}
        {notice ? <p role="status" className="rounded-2xl bg-emerald-100 px-4 py-2 text-sm font-semibold text-emerald-900">{notice}</p> : null}

        <form onSubmit={submit} className="grid gap-3 md:grid-cols-[1fr_1.4fr_auto_auto] md:items-end">
          <label className={LABEL}>School
            <select value={form.tenantId} onChange={event => setForm(current => ({ ...current, tenantId: event.target.value }))} className={FIELD}>
              <option value="">Choose a school…</option>
              {schools.map(school => <option key={school.tenantId} value={school.tenantId}>{school.schoolName || 'School'}</option>)}
            </select>
          </label>
          <label className={LABEL}>What do you need to do?
            <input value={form.reason} onChange={event => setForm(current => ({ ...current, reason: event.target.value }))} placeholder="e.g. Set up classes and import students" className={FIELD} />
          </label>
          <label className={LABEL}>For
            <select value={form.hours} onChange={event => setForm(current => ({ ...current, hours: Number(event.target.value) }))} className={FIELD}>
              {HOURS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <button type="submit" disabled={busy === 'request'} className="rounded-xl bg-[#1a5c38] px-5 py-2.5 text-sm font-black text-white disabled:opacity-60">{busy === 'request' ? 'Sending…' : 'Request access'}</button>
        </form>

        {active.length ? (
          <div className="space-y-2">
            <h3 className="text-xs font-black uppercase tracking-[0.16em] text-[#1a5c38]">Approved — you can open these now</h3>
            {active.map(grant => (
              <div key={grant.id} className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#1a5c38]/40 bg-emerald-50 px-3 py-2 text-sm dark:bg-emerald-500/10">
                <span className="min-w-0 flex-1"><b>{schoolName[grant.tenantId] || 'School'}</b> · {grant.reason} · until {stamp(grant.expiresAt)}</span>
                <button type="button" disabled={busy === grant.id} onClick={() => act(grant, () => openSupportSession(grant))} className="rounded-xl bg-[#1a5c38] px-4 py-1.5 text-xs font-black text-white disabled:opacity-60">Open school</button>
                <button type="button" disabled={busy === grant.id} onClick={async () => { if (await askConfirm('Mark this task done? Access to the school ends now; a new request is needed to continue.')) act(grant, () => completeSchoolAccess(grant.id), 'Task marked done; access has ended.'); }} className="rounded-xl bg-[#191970] px-3 py-1.5 text-xs font-bold text-[#c9a96e]">Task done</button>
                <button type="button" disabled={busy === grant.id} onClick={() => act(grant, () => revokeSchoolAccessGrant(grant.id), 'Access ended.')} className="rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-[#800020]">End access</button>
              </div>
            ))}
          </div>
        ) : null}

        {pending.length ? (
          <div className="space-y-2">
            <h3 className="text-xs font-black uppercase tracking-[0.16em] text-amber-700">Waiting for the owner</h3>
            {pending.map(grant => (
              <p key={grant.id} className="rounded-2xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm dark:bg-amber-500/10">
                <b>{schoolName[grant.tenantId] || 'School'}</b> · {grant.reason} · {grant.requestedHours}h asked · sent {stamp(grant.createdAt)}
              </p>
            ))}
          </div>
        ) : null}

        {recent.length ? (
          <details className="text-sm">
            <summary className="cursor-pointer text-xs font-bold uppercase tracking-[0.16em] text-slate-600 dark:text-slate-300">Earlier requests</summary>
            <ul className="mt-2 space-y-1">
              {recent.map(grant => (
                <li key={grant.id} className="text-xs text-slate-600 dark:text-slate-300">
                  {schoolName[grant.tenantId] || 'School'} · {grant.reason} · {grant.status === 'denied' ? 'declined' : grant.completedAt ? 'task done' : grant.status === 'revoked' ? 'ended' : 'expired'} {stamp(grant.decidedAt || grant.createdAt)}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>
    </section>
  );
}
