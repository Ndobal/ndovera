import React, { useCallback, useEffect, useState } from 'react';
import { getApiUrl } from '../../../config/apiBase';
import { buildSelectedRoleHeader, clearStoredAuth } from '../../auth/services/authApi';

// Closing a school (Worker: schoolClosure.ts). The Owner asks; Ndovera admins
// are alerted; the Owner has 72 hours to revoke; then the school closes for
// everyone in it until Ndovera reopens it. The Head of School cannot close it.

async function request(path, { method = 'GET', body } = {}) {
  const token = localStorage.getItem('token');
  const response = await fetch(getApiUrl(path), {
    method, credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...buildSelectedRoleHeader() },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) { const error = new Error(data.message || data.error || 'Request failed.'); error.status = response.status; throw error; }
  return data;
}

export const getClosureStatus = () => request('/api/school/closure');
export const requestSchoolClosure = payload => request('/api/school/closure', { method: 'POST', body: payload });
export const revokeSchoolClosure = note => request('/api/school/closure/revoke', { method: 'POST', body: { note } });
export const listSchoolClosures = () => request('/api/ami/school-closures');
export const acknowledgeSchoolClosure = (id, note) => request(`/api/ami/school-closures/${encodeURIComponent(id)}/acknowledge`, { method: 'POST', body: { note } });
export const reopenSchool = tenantId => request(`/api/ami/tenants/${encodeURIComponent(tenantId)}/restore`, { method: 'POST', body: {} });

const CARD = 'rounded-3xl border border-[#c9a96e]/40 bg-[#b5e3f4] p-5 dark:border-white/10 dark:bg-slate-900/40';
const FIELD = 'w-full rounded-xl border border-[#c9a96e]/45 bg-white p-2 text-sm text-[#191970]';
const LABEL = 'block text-xs font-bold uppercase tracking-wide text-[#800020]';
const CATEGORY_LABELS = { financial: 'Financial reasons', enrolment: 'Low enrolment', relocation: 'Relocation', merger: 'Merger with another school', regulatory: 'Regulatory / licensing', ownership_change: 'Change of ownership', other: 'Other' };

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), intervalMs); return () => clearInterval(timer); }, [intervalMs]);
  return now;
}

export function formatCountdown(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return `${days ? `${days}d ` : ''}${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
}

function Countdown({ until }) {
  const now = useNow();
  return <span className="font-mono font-black tabular-nums">{formatCountdown(Date.parse(until) - now)}</span>;
}

/** Owner and HOS: the closure page. Only the Owner can request or revoke. */
export function SchoolClosurePage({ dashboardLabel = 'Dashboard' }) {
  const [data, setData] = useState(null);
  const [form, setForm] = useState({ category: '', reason: '', confirmName: '', understood: false });
  const [revokeNote, setRevokeNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState({ text: '', tone: 'ok' });
  const load = useCallback(() => getClosureStatus().then(setData).catch(err => setNotice({ text: err.message, tone: 'error' })), []);
  useEffect(() => { load(); }, [load]);
  const set = patch => setForm(previous => ({ ...previous, ...patch }));

  async function submit() {
    setBusy(true); setNotice({ text: '', tone: 'ok' });
    try { await requestSchoolClosure(form); setNotice({ text: 'Closure scheduled. Ndovera has been alerted, and a confirmation has been emailed to you. You can revoke it at any time in the next 72 hours.', tone: 'ok' }); load(); } catch (err) { setNotice({ text: err.message, tone: 'error' }); } finally { setBusy(false); }
  }
  async function revoke() {
    setBusy(true);
    try { await revokeSchoolClosure(revokeNote); setNotice({ text: 'Closure revoked. The school stays open.', tone: 'ok' }); setRevokeNote(''); load(); } catch (err) { setNotice({ text: err.message, tone: 'error' }); } finally { setBusy(false); }
  }

  const closure = data?.closure;
  const pending = closure?.status === 'pending';
  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 sm:p-8">
      <section className={CARD}>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#800020]">{dashboardLabel}</p>
        <h1 className="text-2xl font-black text-[#800000] dark:text-white">Close the school</h1>
        <p className="mt-1 text-sm text-[#191970] dark:text-slate-300">Closing ends {data?.schoolName || 'the school'}'s use of Ndovera: the school website goes offline and no staff, student or parent can sign in. Records are kept, and Ndovera can reopen the school. Only the school owner can do this, and there are 72 hours to change your mind.</p>
      </section>
      {notice.text && <p role={notice.tone === 'error' ? 'alert' : 'status'} className={`rounded-xl px-3 py-2 text-sm font-semibold ${notice.tone === 'error' ? 'bg-rose-50 text-rose-800' : 'bg-emerald-50 text-[#1a5c38]'}`}>{notice.text}</p>}
      {!data ? <p role="status">Loading…</p> : pending ? (
        <section className="space-y-3 rounded-3xl border-2 border-rose-400 bg-rose-50 p-5 text-rose-950">
          <h2 className="text-lg font-black">Closure scheduled</h2>
          <p className="text-sm">Requested by {closure.requestedByName} on {new Date(closure.requestedAt).toLocaleString()} — {CATEGORY_LABELS[closure.category] || closure.category}.</p>
          <p className="rounded-xl bg-white/70 p-3 text-sm">“{closure.reason}”</p>
          <p className="text-lg">The school closes in <Countdown until={closure.effectiveAt} /> <span className="text-sm">({new Date(closure.effectiveAt).toLocaleString()})</span></p>
          {closure.acknowledgedAt && <p className="text-sm">Ndovera acknowledged this on {new Date(closure.acknowledgedAt).toLocaleString()}{closure.adminNote ? `: “${closure.adminNote}”` : '.'}</p>}
          {data.canRequest ? (
            <div className="space-y-2">
              <label className={LABEL}>Note (optional)<input className={FIELD} value={revokeNote} onChange={event => setRevokeNote(event.target.value)} placeholder="Why the school is staying open" /></label>
              <button type="button" disabled={busy} onClick={revoke} className="rounded-2xl bg-[#1a5c38] px-5 py-2 text-sm font-bold text-[#b5e3f4] disabled:opacity-50">{busy ? 'Revoking…' : 'Revoke — keep the school open'}</button>
            </div>
          ) : <p className="text-sm font-semibold">Only the school owner can revoke the closure.</p>}
        </section>
      ) : data.canRequest ? (
        <section className={`${CARD} space-y-3`}>
          <label className={LABEL}>Reason category
            <select className={FIELD} value={form.category} onChange={event => set({ category: event.target.value })}>
              <option value="">Choose…</option>
              {(data.categories || []).map(key => <option key={key} value={key}>{CATEGORY_LABELS[key] || key}</option>)}
            </select>
          </label>
          <label className={LABEL}>Reason (sent to Ndovera)<textarea rows={4} className={FIELD} value={form.reason} onChange={event => set({ reason: event.target.value })} placeholder="Explain why the school is closing (at least 20 characters)" /></label>
          <label className={LABEL}>Type the school's name to confirm: <span className="normal-case text-[#191970]">{data.schoolName}</span>
            <input className={FIELD} value={form.confirmName} onChange={event => set({ confirmName: event.target.value })} autoComplete="off" />
          </label>
          <label className="flex items-start gap-2 text-sm text-[#191970] dark:text-slate-200"><input type="checkbox" className="mt-1" checked={form.understood} onChange={event => set({ understood: event.target.checked })} /> I understand that after 72 hours nobody in this school will be able to use Ndovera until Ndovera reopens it.</label>
          <button type="button" disabled={busy || !form.understood || !form.category || form.reason.trim().length < 20 || form.confirmName.trim().toLowerCase() !== String(data.schoolName || '').trim().toLowerCase()} onClick={submit}
            className="rounded-2xl bg-rose-700 px-5 py-2 text-sm font-bold text-white disabled:opacity-50">{busy ? 'Scheduling…' : 'Schedule closure (72 hours)'}</button>
        </section>
      ) : (
        <section className={CARD}><p className="text-sm text-[#191970] dark:text-slate-200">No closure is scheduled. Only the school owner can close the school.</p></section>
      )}
      {data?.history?.length > 0 && (
        <section className={CARD}>
          <h2 className="mb-2 font-black text-[#800000] dark:text-white">History</h2>
          <ul className="space-y-1 text-sm text-[#191970] dark:text-slate-200">
            {data.history.map(item => (
              <li key={item.id} className="rounded-xl bg-white/70 px-3 py-2">
                {new Date(item.requestedAt).toLocaleDateString()} · {CATEGORY_LABELS[item.category] || item.category} · <strong>{item.status}</strong>
                {item.revokedAt ? ` — revoked ${new Date(item.revokedAt).toLocaleString()}${item.revokeNote ? `: ${item.revokeNote}` : ''}` : ''}
                {item.reopenedAt ? ` — reopened by ${item.reopenedBy}` : ''}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function ClosedScreen({ schoolName }) {
  return (
    <div className="flex min-h-[70vh] items-center justify-center p-6" role="alert">
      <div className="max-w-lg rounded-3xl bg-white p-8 text-center text-[#191970] shadow-xl">
        <p className="text-5xl" aria-hidden>🏫</p>
        <h1 className="mt-3 text-2xl font-black text-[#800000]">{schoolName || 'This school'} has closed</h1>
        <p className="mt-2 text-sm">The school is no longer using Ndovera, so its classes, results and records are not available here. Contact the school, or Ndovera support, with any questions.</p>
        <button type="button" className="mt-5 rounded-2xl bg-[#800020] px-5 py-2 text-sm font-bold text-white" onClick={() => { clearStoredAuth(); window.location.assign('/login'); }}>Sign out</button>
      </div>
    </div>
  );
}

/**
 * Wraps the signed-in app: a closed school sees only the closed screen; the
 * Owner and Head of School see a countdown while a closure is pending.
 */
export function ClosureGate({ role, children }) {
  const [state, setState] = useState(null);
  const normalized = String(role || '').toLowerCase();
  const schoolUser = normalized && !['ami', 'growthpartner'].includes(normalized);
  useEffect(() => {
    if (!schoolUser) return undefined;
    let cancelled = false;
    getClosureStatus().then(data => !cancelled && setState(data)).catch(() => {});
    return () => { cancelled = true; };
  }, [schoolUser]);
  if (state?.closed) return <ClosedScreen schoolName={state.schoolName} />;
  const pending = state?.closure?.status === 'pending' ? state.closure : null;
  return (
    <>
      {pending && ['owner', 'hos'].includes(normalized) && (
        <div className="mx-4 mt-4 flex flex-wrap items-center gap-3 rounded-2xl border-2 border-rose-400 bg-rose-50 px-4 py-3 text-sm text-rose-950 sm:mx-6 lg:mx-8" role="status">
          <span className="font-black">This school is scheduled to close in <Countdown until={pending.effectiveAt} />.</span>
          <a href={`/roles/${normalized}/school-closure`} className="font-bold underline">{normalized === 'owner' ? 'Review or revoke' : 'Details'}</a>
        </div>
      )}
      {children}
    </>
  );
}

/** Ndovera admin: every closure request across schools. */
export function AmiSchoolClosuresPage() {
  const [closures, setClosures] = useState(null);
  const [notes, setNotes] = useState({});
  const [notice, setNotice] = useState('');
  const load = useCallback(() => listSchoolClosures().then(data => setClosures(data.closures)).catch(err => setNotice(err.message)), []);
  useEffect(() => { load(); }, [load]);
  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 sm:p-8">
      <section className={CARD}>
        <h1 className="text-2xl font-black text-[#800000] dark:text-white">School closures</h1>
        <p className="mt-1 text-sm text-[#191970] dark:text-slate-300">Closures requested by school owners. Each takes effect 72 hours after the request unless the owner revokes it. A closed school can be reopened here.</p>
      </section>
      {notice && <p role="status" className="font-semibold text-[#1a5c38]">{notice}</p>}
      {!closures ? <p role="status">Loading…</p> : !closures.length ? <p className="text-sm">No closure requests.</p> : closures.map(item => (
        <article key={item.id} className={`${CARD} space-y-2 ${item.status === 'pending' ? 'ring-2 ring-rose-400' : ''}`}>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="flex-1 text-lg font-black text-[#800000] dark:text-white">{item.schoolName || item.tenantId}</h2>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-black uppercase text-[#800020]">{item.status}</span>
          </div>
          <p className="text-sm text-[#191970] dark:text-slate-200">{item.requestedByName} · {new Date(item.requestedAt).toLocaleString()} · {CATEGORY_LABELS[item.category] || item.category}</p>
          <p className="rounded-xl bg-white/70 p-3 text-sm text-[#191970]">“{item.reason}”</p>
          {item.status === 'pending' && <p className="text-sm text-rose-900">Closes in <Countdown until={item.effectiveAt} /> ({new Date(item.effectiveAt).toLocaleString()})</p>}
          {item.revokedAt && <p className="text-sm">Revoked {new Date(item.revokedAt).toLocaleString()}{item.revokeNote ? `: ${item.revokeNote}` : ''}</p>}
          {item.acknowledgedAt ? <p className="text-sm">Acknowledged by {item.acknowledgedBy}{item.adminNote ? `: “${item.adminNote}”` : ''}</p> : (
            <div className="flex flex-wrap gap-2">
              <input className={`${FIELD} flex-1`} placeholder="Note (e.g. called the owner)" value={notes[item.id] || ''} onChange={event => setNotes(previous => ({ ...previous, [item.id]: event.target.value }))} />
              <button type="button" className="rounded-2xl bg-[#191970] px-4 py-2 text-sm font-bold text-white" onClick={async () => { try { await acknowledgeSchoolClosure(item.id, notes[item.id] || ''); load(); } catch (err) { setNotice(err.message); } }}>Acknowledge</button>
            </div>
          )}
          {item.status === 'executed' && (
            <button type="button" className="rounded-2xl bg-[#1a5c38] px-4 py-2 text-sm font-bold text-[#b5e3f4]" onClick={async () => { try { await reopenSchool(item.tenantId); setNotice(`${item.schoolName} reopened.`); load(); } catch (err) { setNotice(err.message); } }}>Reopen school</button>
          )}
        </article>
      ))}
    </div>
  );
}
