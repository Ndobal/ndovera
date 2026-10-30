import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  approveTermsCalendar, getTermsCalendar, getTermsCalendarVersion, returnTermsCalendar,
  saveTermsCalendarDraft, submitTermsCalendar,
} from '../school/services/schoolApi';

// Terms Calendar: one calendar per session, laid over the term dates and public holidays.
// Draft → submit → approved by another head → published to the school calendar (holidays and
// breaks stop attendance being marked) and, for public entries, the school website. Every
// version is kept.

const CARD = 'rounded-xl border border-slate-200 bg-white p-4 text-slate-900 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';
const FIELD = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100';
const LABEL = 'block text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300';
const PRIMARY = 'rounded-lg bg-[#191970] px-4 py-2 text-sm font-bold text-white disabled:opacity-50';
const SECONDARY = 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-[#191970] disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-white';
const MUTED = 'text-sm text-slate-700 dark:text-slate-300';
const STATUS = {
  draft: ['Draft', 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-100'],
  submitted: ['Waiting for approval', 'bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100'],
  published: ['Published', 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100'],
  superseded: ['Replaced by a later version', 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'],
};
const AUDIENCE = { everyone: 'Everyone', staff: 'Staff only', parents: 'Parents', internal: 'Management only' };
const REFERENCE_LABEL = { term_start: 'Term', term_end: 'Term', resumption: 'Resumption', closure: 'Break / holiday', event: 'School calendar', public_holiday: 'Public holiday' };
const newEntry = () => ({ id: `e${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, type: 'event', title: '', startDate: '', endDate: '', audience: 'everyone', showOnWebsite: false, reminderDays: null, note: '' });

function Chip({ status }) {
  const [label, className] = STATUS[status] || STATUS.draft;
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${className}`}>{label}</span>;
}

export default function TermsCalendarPage() {
  const [data, setData] = useState(null);
  const [sessionId, setSessionId] = useState('');
  const [entries, setEntries] = useState([]);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [note, setNote] = useState('');
  const [viewing, setViewing] = useState(null);

  const load = useCallback(async id => {
    try {
      const result = await getTermsCalendar(id);
      setData(result);
      const calendar = result.calendar;
      setSessionId(calendar?.session?.id || '');
      setEntries((calendar?.working || calendar?.published)?.entries || []);
      setDirty(false);
      setError('');
    } catch (err) { setError(err.message); }
  }, []);
  useEffect(() => { load(''); }, [load]);

  const calendar = data?.calendar;
  const working = calendar?.working;
  const locked = working?.status === 'submitted' || ['completed', 'archived'].includes(calendar?.session?.status);
  const types = calendar?.types || {};
  const me = data?.me;
  const canApprove = ['owner', 'hos'].includes(me?.role) && working?.status === 'submitted';
  const ownSubmission = working?.draftedById && working.draftedById === me?.id;
  const conflictsFor = id => (working?.conflicts || []).filter(item => item.entryId === id);

  const run = async (key, action, message) => {
    setBusy(key); setError(''); setNotice('');
    try { const result = await action(); setNotice(typeof message === 'function' ? message(result) : message); await load(sessionId); }
    catch (err) { setError(err.message); }
    finally { setBusy(''); }
  };
  const change = (id, patch) => { setEntries(current => current.map(entry => (entry.id === id ? { ...entry, ...patch } : entry))); setDirty(true); };

  const timeline = useMemo(() => {
    if (!calendar) return [];
    return [
      ...calendar.reference.map(item => ({ ...item, reference: true })),
      ...entries.map(entry => ({ ...entry, kind: entry.type })),
    ].filter(item => item.startDate).sort((a, b) => a.startDate.localeCompare(b.startDate));
  }, [calendar, entries]);

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 text-slate-900 sm:p-6 dark:text-slate-100">
      <header className="rounded-2xl bg-[#191970] p-6 text-white">
        <p className="text-xs font-bold uppercase tracking-widest text-amber-200">Terms Calendar</p>
        <h1 className="mt-1 text-2xl font-black">{calendar?.session?.name || 'Session calendar'}</h1>
        <p className="mt-2 text-sm text-slate-100">Breaks, holidays, tests, exams, events, open days, results and fee deadlines for the session. Drafted, then approved by another head before it is published. Every version is kept.</p>
      </header>

      {data?.sessions?.length ? (
        <label className="block max-w-xs text-xs font-bold uppercase text-slate-700 dark:text-slate-300">Session
          <select className={FIELD} value={sessionId} onChange={event => load(event.target.value)}>
            {data.sessions.map(session => <option key={session.id} value={session.id}>{session.name} ({session.status})</option>)}
          </select>
        </label>
      ) : null}
      {data && !calendar ? <p className={`${CARD} ${MUTED}`}>Create the session and its terms first (Settings → Sessions & Terms).</p> : null}
      {error ? <p role="alert" className="rounded-lg bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800 dark:bg-rose-950 dark:text-rose-200">{error}</p> : null}
      {notice ? <p role="status" className="rounded-lg bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">{notice}</p> : null}

      {calendar ? (
        <>
          <section className={`${CARD} space-y-2`}>
            <div className="flex flex-wrap items-center gap-2">
              {calendar.published ? <><Chip status="published" /><span className={MUTED}>Version {calendar.published.version}, approved by {calendar.published.decidedBy} on {new Date(calendar.published.decidedAt).toLocaleDateString()}.</span></> : <span className={MUTED}>Not published yet.</span>}
            </div>
            {working ? (
              <div className="flex flex-wrap items-center gap-2">
                <Chip status={working.status} />
                <span className={MUTED}>Version {working.version} by {working.draftedBy}{working.submittedAt && working.status === 'submitted' ? `, submitted ${new Date(working.submittedAt).toLocaleString()}` : ''}.</span>
                {working.decisionNote ? <span className="text-sm font-semibold text-amber-900 dark:text-amber-200">{working.decisionNote}</span> : null}
              </div>
            ) : null}
          </section>

          {working?.conflicts?.length ? (
            <section className={`${CARD} space-y-1`} aria-label="Problems">
              <h2 className="font-black text-[#0b1f3a] dark:text-white">Problems found</h2>
              {working.conflicts.map((item, index) => (
                <p key={index} className={item.severity === 'error' ? 'text-sm font-semibold text-rose-800 dark:text-rose-200' : 'text-sm text-amber-900 dark:text-amber-200'}>
                  {item.severity === 'error' ? '✕ Must fix: ' : '! Check: '}{item.message}
                </p>
              ))}
            </section>
          ) : null}

          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-black text-[#191970] dark:text-white">Calendar entries</h2>
              {!locked ? <button type="button" className={SECONDARY} onClick={() => { setEntries(current => [...current, newEntry()]); setDirty(true); }}>+ Add an entry</button> : null}
            </div>
            {!entries.length ? <p className={`${CARD} ${MUTED}`}>No entries yet. Add the mid-term breaks, tests, exams, events, results day and fee deadlines.</p> : null}
            {entries.map(entry => (
              <div key={entry.id} className={`${CARD} grid gap-2 sm:grid-cols-2 lg:grid-cols-6`}>
                <label className={LABEL}>Type
                  <select disabled={locked} className={FIELD} value={entry.type} onChange={event => change(entry.id, { type: event.target.value })}>
                    {Object.entries(types).map(([key, type]) => <option key={key} value={key}>{type.label}</option>)}
                  </select>
                </label>
                <label className={`${LABEL} lg:col-span-2`}>Title<input disabled={locked} className={FIELD} value={entry.title} maxLength={160} onChange={event => change(entry.id, { title: event.target.value })} /></label>
                <label className={LABEL}>From<input disabled={locked} type="date" className={FIELD} value={entry.startDate} onChange={event => change(entry.id, { startDate: event.target.value, endDate: entry.endDate || event.target.value })} /></label>
                <label className={LABEL}>To<input disabled={locked} type="date" className={FIELD} value={entry.endDate} onChange={event => change(entry.id, { endDate: event.target.value })} /></label>
                <label className={LABEL}>For
                  <select disabled={locked} className={FIELD} value={entry.audience} onChange={event => change(entry.id, { audience: event.target.value })}>
                    {Object.entries(AUDIENCE).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                  </select>
                </label>
                <label className={LABEL}>Reminder
                  <select disabled={locked} className={FIELD} value={entry.reminderDays || ''} onChange={event => change(entry.id, { reminderDays: event.target.value ? Number(event.target.value) : null })}>
                    <option value="">None</option>{[1, 2, 3, 7, 14].map(days => <option key={days} value={days}>{days} day{days === 1 ? '' : 's'} before</option>)}
                  </select>
                </label>
                <label className={`${LABEL} lg:col-span-3`}>Note<input disabled={locked} className={FIELD} value={entry.note} maxLength={1000} onChange={event => change(entry.id, { note: event.target.value })} /></label>
                <label className="flex items-center gap-2 self-end text-sm"><input disabled={locked || ['staff', 'internal'].includes(entry.audience) || types[entry.type]?.closesSchool} type="checkbox" checked={Boolean(entry.showOnWebsite)} onChange={event => change(entry.id, { showOnWebsite: event.target.checked })} /> Show on the school website</label>
                {!locked ? <button type="button" className={`${SECONDARY} self-end`} onClick={() => { setEntries(current => current.filter(item => item.id !== entry.id)); setDirty(true); }}>Remove</button> : null}
                {conflictsFor(entry.id).map((item, index) => <p key={index} className={`lg:col-span-6 text-xs font-semibold ${item.severity === 'error' ? 'text-rose-800 dark:text-rose-200' : 'text-amber-900 dark:text-amber-200'}`}>{item.message}</p>)}
              </div>
            ))}
          </section>

          <section className={`${CARD} space-y-3`}>
            {!locked ? (
              <div className="flex flex-wrap gap-2">
                <button type="button" className={SECONDARY} disabled={busy !== '' || !dirty} onClick={() => run('save', () => saveTermsCalendarDraft(sessionId, entries), result => `Draft saved (version ${result.version}).${result.conflicts.length ? ` ${result.conflicts.length} problem${result.conflicts.length === 1 ? '' : 's'} to look at.` : ''}`)}>{busy === 'save' ? 'Saving…' : 'Save draft'}</button>
                <button type="button" className={PRIMARY} disabled={busy !== '' || dirty || working?.status !== 'draft'} onClick={() => run('submit', () => submitTermsCalendar(sessionId), 'Submitted. Another head approves it before it is published.')}>{busy === 'submit' ? 'Submitting…' : 'Submit for approval'}</button>
                {dirty ? <span className="self-center text-xs text-slate-700 dark:text-slate-300">Save the draft before submitting.</span> : null}
              </div>
            ) : null}
            {canApprove ? (
              <div className="space-y-2">
                <label className={LABEL}>Note (required to return; optional to approve)<textarea rows={2} className={FIELD} value={note} onChange={event => setNote(event.target.value)} /></label>
                {ownSubmission ? <p className={MUTED}>You submitted this version. Another head (Owner or Head of School) approves it, unless you are the school's only head.</p> : null}
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={PRIMARY} disabled={busy !== ''} onClick={() => run('approve', () => approveTermsCalendar(sessionId, note), result => `Version ${result.version} published: ${result.published} entr${result.published === 1 ? 'y' : 'ies'} on the school calendar${result.removed ? `, ${result.removed} removed` : ''}.`)}>{busy === 'approve' ? 'Publishing…' : 'Approve and publish'}</button>
                  <button type="button" className={SECONDARY} disabled={busy !== '' || !note.trim()} onClick={() => run('return', () => returnTermsCalendar(sessionId, note), 'Returned for changes.')}>Return for changes</button>
                </div>
              </div>
            ) : working?.status === 'submitted' ? <p className={MUTED}>Waiting for the Owner or Head of School to approve.</p> : null}
          </section>

          <section className={`${CARD} space-y-2`}>
            <h2 className="font-black text-[#0b1f3a] dark:text-white">The session at a glance</h2>
            <ul className="divide-y divide-slate-200 text-sm dark:divide-slate-700">
              {timeline.map((item, index) => (
                <li key={`${item.kind}-${item.id || index}`} className="flex flex-wrap gap-x-3 py-1.5">
                  <span className="w-48 shrink-0 font-mono text-xs text-slate-700 dark:text-slate-300">{item.startDate}{item.endDate && item.endDate !== item.startDate ? ` → ${item.endDate}` : ''}</span>
                  <span className="font-semibold">{item.title || types[item.type]?.label}</span>
                  <span className="text-xs text-slate-700 dark:text-slate-300">{item.reference ? `${REFERENCE_LABEL[item.kind] || item.source} · ${item.source}` : types[item.type]?.label}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className={`${CARD} space-y-2`}>
            <h2 className="font-black text-[#0b1f3a] dark:text-white">History</h2>
            {!calendar.history.length ? <p className={MUTED}>No versions yet.</p> : (
              <ul className="space-y-1 text-sm">
                {calendar.history.map(item => (
                  <li key={item.version} className="flex flex-wrap items-center gap-2">
                    <b>Version {item.version}</b><Chip status={item.status} />
                    <span className="text-slate-700 dark:text-slate-300">{item.entries} entries · drafted by {item.draftedBy || '—'}{item.decidedBy ? ` · ${item.status === 'draft' ? 'returned' : 'approved'} by ${item.decidedBy} on ${new Date(item.decidedAt).toLocaleDateString()}` : ''}</span>
                    <button type="button" className="text-xs font-bold text-[#191970] underline dark:text-blue-200" onClick={async () => { try { setViewing((await getTermsCalendarVersion(sessionId, item.version)).version); } catch (err) { setError(err.message); } }}>View</button>
                  </li>
                ))}
              </ul>
            )}
            {viewing ? (
              <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                <div className="flex items-center justify-between"><b>Version {viewing.version}</b><button type="button" className={SECONDARY} onClick={() => setViewing(null)}>Close</button></div>
                <ul className="mt-2 space-y-1 text-sm">{viewing.entries.map(entry => <li key={entry.id}>{entry.startDate}{entry.endDate !== entry.startDate ? ` → ${entry.endDate}` : ''} · {entry.title} ({types[entry.type]?.label || entry.type})</li>)}</ul>
              </div>
            ) : null}
          </section>
        </>
      ) : null}
    </div>
  );
}
