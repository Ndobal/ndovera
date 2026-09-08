import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getAcademicOverview, getAcademicSession, createAcademicSession, updateAcademicSession,
  activateAcademicSession, archiveAcademicSession, saveAcademicTerms, activateAcademicTerm,
  closeAcademicTerm, saveAcademicBreak, deleteAcademicBreak, autoEnrolSession,
} from '../services/schoolApi';

const CARD = 'rounded-3xl p-5 sm:p-6 bg-[#b5e3f4] border border-[#c9a96e]/40 dark:border-white/10 dark:bg-slate-900/40';
const INNER = 'rounded-2xl border border-[#c9a96e]/30 bg-[#ade1f4]/60 p-3 dark:border-white/10 dark:bg-slate-800/40';
const INPUT = 'rounded-xl border border-[#c9a96e]/40 bg-white px-3 py-2 text-sm text-[#191970] outline-none focus:ring-2 focus:ring-[#1a5c38] dark:border-white/10 dark:bg-slate-800 dark:text-slate-100';
const BTN = 'rounded-2xl bg-[#1a5c38] px-5 py-2.5 text-sm font-bold text-[#b5e3f4] transition hover:bg-[#154a2e] disabled:opacity-60';
const BTN_GHOST = 'rounded-2xl border border-[#800020]/30 px-4 py-2 text-sm font-bold text-[#800020] transition hover:bg-[#800020]/10 disabled:opacity-60 dark:border-white/20 dark:text-slate-200';
const LABEL = 'text-xs font-bold uppercase tracking-[0.18em] text-[#800020] dark:text-slate-400';
const FIELD_LABEL = 'text-[10px] font-bold uppercase tracking-wide text-[#4a5578] dark:text-slate-400';

// Bottom actions sit above the mobile navigation bar, never behind it.
const STICKY_ACTIONS = 'sticky bottom-0 -mx-5 mt-5 flex flex-wrap gap-2 border-t border-[#c9a96e]/35 bg-[#b5e3f4]/95 px-5 pt-3 pb-[calc(0.75rem+var(--safe-bottom))] backdrop-blur sm:-mx-6 sm:px-6 dark:border-white/10 dark:bg-slate-900/95';

const BREAK_TYPES = [
  { value: 'mid_term', label: 'Mid-Term Break' },
  { value: 'christmas', label: 'Christmas Holiday' },
  { value: 'easter', label: 'Easter Break' },
  { value: 'long_vacation', label: 'Long Vacation' },
  { value: 'public_holiday', label: 'Public Holiday' },
  { value: 'custom', label: 'Custom Break' },
];

const STATUS_STYLES = {
  active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
  upcoming: 'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300',
  completed: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
  archived: 'bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
};

function StatusPill({ status }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${STATUS_STYLES[status] || STATUS_STYLES.completed}`}>
      {status}
    </span>
  );
}

/**
 * What the automatic register did, in the words a head teacher would use. The
 * counts come back from every call that fills a register.
 */
function describeEnrolment(enrolment) {
  if (!enrolment || !enrolment.enrolled) return '';

  const parts = [];
  if (enrolment.promoted) parts.push(`${enrolment.promoted} moved up a class`);
  if (enrolment.heldBack) parts.push(`${enrolment.heldBack} held in the same class`);
  if (enrolment.graduated) parts.push(`${enrolment.graduated} graduated`);

  const detail = parts.length ? ` — ${parts.join(', ')}` : '';
  const unplaced = enrolment.unplaced
    ? ` ${enrolment.unplaced} still need a class.`
    : '';
  return `${enrolment.enrolled} student${enrolment.enrolled === 1 ? '' : 's'} enrolled automatically${detail}.${unplaced}`;
}

function formatDate(value) {
  if (!value) return '—';
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

const EMPTY_SESSION = {
  name: '', startDate: '', endDate: '', resumptionDate: '', autoActivate: false, notes: '',
};

function blankTerms() {
  return ['First Term', 'Second Term', 'Third Term'].map((name, index) => ({
    sequence: index + 1, name, startDate: '', endDate: '', resumptionDate: '', autoActivate: false,
  }));
}

export default function AcademicSessionsBoard() {
  const [overview, setOverview] = useState(null);
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [form, setForm] = useState(EMPTY_SESSION);
  const [formTerms, setFormTerms] = useState(blankTerms);
  const [termDrafts, setTermDrafts] = useState([]);
  const [breakDraft, setBreakDraft] = useState(null);

  const loadOverview = useCallback(async (preferredId) => {
    const data = await getAcademicOverview();
    setOverview(data);
    const sessions = data?.sessions || [];
    const next = preferredId && sessions.some(s => s.id === preferredId)
      ? preferredId
      : (data?.activeSession?.id || sessions[0]?.id || '');
    setSelectedId(next);
    return next;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadOverview();
      } catch (e) {
        if (!cancelled) setError(e.message || 'Could not load the academic calendar.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [loadOverview]);

  useEffect(() => {
    if (!selectedId) { setDetail(null); return; }
    let cancelled = false;
    getAcademicSession(selectedId)
      .then(data => { if (!cancelled) { setDetail(data); setTermDrafts(data?.terms || []); } })
      .catch(e => { if (!cancelled) setError(e.message || 'Could not load that session.'); });
    return () => { cancelled = true; };
  }, [selectedId]);

  const sessions = overview?.sessions || [];
  const today = overview?.today || '';
  const calendar = overview?.calendar || null;

  async function refresh(preferredId) {
    const next = await loadOverview(preferredId || selectedId);
    if (next) {
      const data = await getAcademicSession(next);
      setDetail(data);
      setTermDrafts(data?.terms || []);
    }
  }

  // Returns whether the action succeeded, so callers can keep a form open on failure.
  function run(key, action, successMessage) {
    return async () => {
      setBusy(key); setError(''); setNotice('');
      try {
        const result = await action();
        if (successMessage) setNotice(typeof successMessage === 'function' ? successMessage(result) : successMessage);
        await refresh(result?.session?.id);
        return true;
      } catch (e) {
        setError(e.message || 'That did not work.');
        return false;
      } finally {
        setBusy('');
      }
    };
  }

  function startEdit(session) {
    setEditingId(session.id);
    setCreating(true);
    setForm({
      name: session.name,
      startDate: session.startDate,
      endDate: session.endDate,
      resumptionDate: session.resumptionDate || '',
      autoActivate: session.autoActivate,
      notes: session.notes || '',
    });
    // Terms are edited in the session panel below, not in this form.
    setFormTerms(blankTerms());
  }

  function closeForm() {
    setCreating(false);
    setEditingId('');
    setForm(EMPTY_SESSION);
    setFormTerms(blankTerms());
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy('create'); setError(''); setNotice('');
    try {
      if (editingId) {
        const updated = await updateAcademicSession(editingId, form);
        setNotice(`${updated.session.name} updated.`);
        closeForm();
        await refresh(updated.session.id);
        return;
      }

      const terms = formTerms.filter(term => term.name && term.startDate && term.endDate);
      const created = await createAcademicSession({ ...form, terms });
      const rolled = describeEnrolment(created.enrolment);
      setNotice(`${created.session.name} created. It is not active yet — activate it when the school is ready.${rolled ? ` ${rolled}` : ''}`);
      closeForm();
      await refresh(created.session.id);
      setSelectedId(created.session.id);
    } catch (e) {
      setError(e.message || (editingId ? 'Could not update the session.' : 'Could not create the session.'));
    } finally {
      setBusy('');
    }
  }

  async function handleFillRegister(session) {
    await run(
      `enrol-${session.id}`,
      () => autoEnrolSession(session.id),
      (result) => describeEnrolment(result?.enrolment)
        || 'Every student on the roster is already on this register.',
    )();
  }

  async function handleActivate(session) {
    const current = overview?.activeSession;
    const message = current && current.id !== session.id
      ? `Activate ${session.name}? ${current.name} will be closed, and every student's class will follow their ${session.name} placement.`
      : `Activate ${session.name}?`;
    if (!window.confirm(message)) return;

    await run(
      `activate-${session.id}`,
      () => activateAcademicSession(session.id),
      (result) => `${result.session.name} is now the active session${result.placementsApplied ? `, and ${result.placementsApplied} placements were applied.` : '.'}`,
    )();
  }

  const canEditTerms = detail?.session && detail.session.status !== 'archived';

  // Same rules the Worker enforces, checked as you type so a bad date is caught
  // in the row it belongs to rather than as one message after a round-trip. The
  // server stays authoritative — this only saves the round-trip — so if the rules
  // in normalizeTermInputs change, change them here too.
  const validateTerms = useCallback((terms, sessionStart, sessionEnd) => {
    const filled = terms.map((term, index) => ({ ...term, index }))
      .filter(term => term.startDate && term.endDate);

    const problems = {};
    for (const term of filled) {
      const label = term.name || `Term ${term.sequence}`;
      if (term.endDate <= term.startDate) {
        problems[term.index] = `${label} ends on ${term.endDate} but starts on ${term.startDate}. The end date must come after the start date.`;
      } else if (sessionStart && term.startDate < sessionStart) {
        problems[term.index] = `${label} starts before the session does (${sessionStart}).`;
      } else if (sessionEnd && term.endDate > sessionEnd) {
        problems[term.index] = `${label} ends after the session does (${sessionEnd}).`;
      }
    }

    const ordered = [...filled].sort((a, b) => a.startDate.localeCompare(b.startDate));
    for (let i = 1; i < ordered.length; i += 1) {
      const previous = ordered[i - 1];
      const current = ordered[i];
      if (problems[current.index] || problems[previous.index]) continue;
      if (previous.startDate <= current.endDate && current.startDate <= previous.endDate) {
        problems[current.index] = `${current.name || 'This term'} overlaps ${previous.name || 'the previous term'} (${previous.startDate} to ${previous.endDate}).`;
      }
    }
    return problems;
  }, []);

  const termProblems = useMemo(
    () => validateTerms(formTerms, form.startDate, form.endDate),
    [validateTerms, formTerms, form.startDate, form.endDate],
  );
  const hasTermProblems = Object.keys(termProblems).length > 0;

  // The same check for the editor on an existing session.
  const termDraftProblems = useMemo(
    () => validateTerms(termDrafts, detail?.session?.startDate, detail?.session?.endDate),
    [validateTerms, termDrafts, detail],
  );
  const hasTermDraftProblems = Object.keys(termDraftProblems).length > 0;

  const termsChanged = useMemo(() => {
    const original = detail?.terms || [];
    if (original.length !== termDrafts.length) return true;
    return termDrafts.some((draft, index) => {
      const source = original[index] || {};
      return ['name', 'startDate', 'endDate', 'resumptionDate'].some(key => (draft[key] || '') !== (source[key] || ''))
        || Boolean(draft.autoActivate) !== Boolean(source.autoActivate);
    });
  }, [detail, termDrafts]);

  if (loading) return <p className="text-sm text-[#800020] dark:text-slate-300">Loading the academic calendar…</p>;

  return (
    <div className="space-y-5">
      {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p> : null}
      {notice ? <p className="rounded-xl bg-[#fff8ee] px-3 py-2 text-sm font-semibold text-[#1a5c38] dark:bg-slate-800 dark:text-emerald-300">{notice}</p> : null}

      {/* Where the school is right now */}
      <section className={CARD}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-black text-[#800000] dark:text-slate-100">Where the school is today</h3>
            <p className="mt-1 text-sm text-[#191970] dark:text-slate-300">
              {calendar?.state === 'in-term' && `${calendar.session.name} · ${calendar.term.name}, running until ${formatDate(calendar.term.endDate)}.`}
              {calendar?.state === 'on-break' && `${calendar.currentBreak.name} until ${formatDate(calendar.currentBreak.endDate)}. School resumes ${formatDate(calendar.currentBreak.resumptionDate)}.`}
              {calendar?.state === 'between-terms' && `${calendar.session.name} · between terms.${calendar.nextTerm ? ` ${calendar.nextTerm.name} starts ${formatDate(calendar.nextTerm.startDate)}.` : ''}`}
              {calendar?.state === 'session-open' && `${calendar.session.name} is active, but no term is open yet.`}
              {calendar?.state === 'unconfigured' && 'No academic session has been set up yet. Create one below to begin.'}
            </p>
          </div>
          <p className="text-xs font-semibold text-[#4a5578] dark:text-slate-400">Today in Lagos: {formatDate(today)}</p>
        </div>
      </section>

      {/* Session list */}
      <section className={CARD}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-black text-[#800000] dark:text-slate-100">Academic sessions</h3>
          <button type="button" onClick={() => (creating ? closeForm() : setCreating(true))} className={BTN}>
            {creating ? 'Cancel' : '+ Create new session'}
          </button>
        </div>

        {creating ? (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4 rounded-2xl border border-[#c9a96e]/30 bg-[#fff8ee]/70 p-4 dark:border-white/10 dark:bg-slate-800/40">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className={LABEL}>Session name</span>
                <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="2027/2028" className={`${INPUT} mt-1 w-full`} />
              </label>
              <label className="block">
                <span className={LABEL}>Session starts</span>
                <input required type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} className={`${INPUT} mt-1 w-full`} />
                <span className="mt-0.5 block text-[11px] text-[#4a5578] dark:text-slate-400">First day of the whole academic year.</span>
              </label>
              <label className="block">
                <span className={LABEL}>Session ends</span>
                <input required type="date" min={form.startDate || undefined} value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} className={`${INPUT} mt-1 w-full`} />
                <span className="mt-0.5 block text-[11px] text-[#4a5578] dark:text-slate-400">Last day of the third term.</span>
              </label>
              <label className="block">
                <span className={LABEL}>Resumption date</span>
                <input type="date" min={form.startDate || undefined} max={form.endDate || undefined} value={form.resumptionDate} onChange={e => setForm(f => ({ ...f, resumptionDate: e.target.value }))} className={`${INPUT} mt-1 w-full`} />
                <span className="mt-0.5 block text-[11px] text-[#4a5578] dark:text-slate-400">Day pupils report for this session. Used when automatic activation is on.</span>
              </label>
            </div>

            <div className={editingId ? 'hidden' : ''}>
              <p className={LABEL}>Terms</p>
              <div className="mt-2 space-y-2">
                {formTerms.map((term, index) => {
                  const problem = termProblems[index] || '';
                  return (
                    <div key={term.sequence} className={`rounded-xl border bg-white/60 p-3 dark:bg-slate-900/40 ${problem ? 'border-red-400' : 'border-[#c9a96e]/30 dark:border-white/10'}`}>
                      <div className="grid gap-2 sm:grid-cols-4">
                        <label className="block">
                          <span className={FIELD_LABEL}>Term name</span>
                          <input value={term.name} onChange={e => setFormTerms(list => list.map((t, i) => i === index ? { ...t, name: e.target.value } : t))} placeholder="First Term" className={`${INPUT} mt-0.5 w-full`} />
                        </label>
                        <label className="block">
                          <span className={FIELD_LABEL}>Term starts</span>
                          {/* Bounded by the session so an out-of-range or reversed date cannot be picked. */}
                          <input type="date" min={form.startDate || undefined} max={form.endDate || undefined} value={term.startDate} onChange={e => setFormTerms(list => list.map((t, i) => i === index ? { ...t, startDate: e.target.value } : t))} className={`${INPUT} mt-0.5 w-full`} />
                        </label>
                        <label className="block">
                          <span className={FIELD_LABEL}>Term ends</span>
                          <input type="date" min={term.startDate || form.startDate || undefined} max={form.endDate || undefined} value={term.endDate} onChange={e => setFormTerms(list => list.map((t, i) => i === index ? { ...t, endDate: e.target.value } : t))} className={`${INPUT} mt-0.5 w-full`} />
                        </label>
                        <label className="block">
                          <span className={FIELD_LABEL}>School resumes after</span>
                          <input type="date" min={term.endDate || undefined} value={term.resumptionDate} onChange={e => setFormTerms(list => list.map((t, i) => i === index ? { ...t, resumptionDate: e.target.value } : t))} className={`${INPUT} mt-0.5 w-full`} />
                        </label>
                      </div>
                      {problem ? <p className="mt-2 text-xs font-semibold text-red-600 dark:text-red-300">{problem}</p> : null}
                    </div>
                  );
                })}
              </div>
              <p className="mt-1 text-xs text-[#4a5578] dark:text-slate-400">
                <strong>Term starts</strong> and <strong>Term ends</strong> are the teaching dates. <strong>School resumes after</strong> is the day pupils come back once this term's break is over — for the third term that is the start of the next session. Leave a term blank to add it later; term dates must sit inside the session dates and must not overlap.
              </p>
            </div>

            <label className="flex items-start gap-2 text-sm text-[#191970] dark:text-slate-300">
              <input type="checkbox" checked={form.autoActivate} onChange={e => setForm(f => ({ ...f, autoActivate: e.target.checked }))} className="mt-1" />
              <span>Automatically activate this session on its resumption date. Every student rolls into it on their own — returning pupils move up a class following your promotion flow — so all that is left is fees and payments.</span>
            </label>

            <label className="block">
              <span className={LABEL}>Notes</span>
              <textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className={`${INPUT} mt-1 w-full resize-none`} />
            </label>

            <div className="flex flex-wrap gap-2 pb-[var(--safe-bottom)]">
              <button type="submit" disabled={busy === 'create' || (!editingId && hasTermProblems)} className={BTN}>
                {busy === 'create' ? 'Saving…' : editingId ? 'Save changes' : 'Create session'}
              </button>
              <button type="button" onClick={closeForm} className={BTN_GHOST}>Cancel</button>
            </div>
          </form>
        ) : null}

        <div className="mt-4 space-y-2">
          {sessions.map(session => (
            <div key={session.id} className={`${INNER} flex flex-wrap items-center justify-between gap-3 ${session.id === selectedId ? 'ring-2 ring-[#1a5c38]' : ''}`}>
              <button type="button" onClick={() => setSelectedId(session.id)} className="min-w-[180px] flex-1 text-left">
                <p className="flex flex-wrap items-center gap-2 font-bold text-[#14215b] dark:text-slate-100">
                  {session.name} <StatusPill status={session.status} />
                  {session.autoActivate && session.status === 'upcoming' ? <span className="text-[11px] font-semibold text-[#1a5c38] dark:text-emerald-300">auto</span> : null}
                </p>
                <p className="text-xs text-[#4a5578] dark:text-slate-400">
                  {formatDate(session.startDate)} – {formatDate(session.endDate)}
                  {session.resumptionDate ? ` · resumes ${formatDate(session.resumptionDate)}` : ''}
                </p>
              </button>
              <div className="flex flex-wrap gap-2">
                {session.status !== 'active' && session.status !== 'archived' ? (
                  <button type="button" onClick={() => handleActivate(session)} disabled={busy === `activate-${session.id}`} className="rounded-lg bg-[#1a5c38] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60">
                    {busy === `activate-${session.id}` ? 'Activating…' : 'Set active'}
                  </button>
                ) : null}
                {session.status !== 'archived' ? (
                  <button type="button" onClick={() => startEdit(session)} className="rounded-lg border border-[#c9a96e]/40 px-3 py-1.5 text-xs font-semibold text-[#14215b] dark:border-white/20 dark:text-slate-200">
                    Edit
                  </button>
                ) : null}
                {session.status !== 'active' ? (
                  <button
                    type="button"
                    onClick={run(`archive-${session.id}`, () => archiveAcademicSession(session.id, session.status !== 'archived'))}
                    disabled={busy === `archive-${session.id}`}
                    className="rounded-lg border border-[#800020]/30 px-3 py-1.5 text-xs font-semibold text-[#800020] disabled:opacity-60 dark:border-white/20 dark:text-slate-300"
                  >
                    {session.status === 'archived' ? 'Restore' : 'Archive'}
                  </button>
                ) : null}
              </div>
            </div>
          ))}
          {!sessions.length ? (
            <p className="text-sm text-[#4a5578] dark:text-slate-400">No sessions yet. Create your first one above.</p>
          ) : null}
        </div>
      </section>

      {/* Terms and breaks for the selected session */}
      {detail?.session ? (
        <section className={CARD}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-lg font-black text-[#800000] dark:text-slate-100">
              {detail.session.name} <StatusPill status={detail.session.status} />
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-semibold text-[#4a5578] dark:text-slate-400">{detail.enrollmentCount} student{detail.enrollmentCount === 1 ? '' : 's'} enrolled</p>
              {detail.session.status !== 'archived' && detail.session.status !== 'completed' ? (
                <button
                  type="button"
                  onClick={() => handleFillRegister(detail.session)}
                  disabled={busy === `enrol-${detail.session.id}`}
                  className="rounded-lg border border-[#c9a96e]/40 px-3 py-1.5 text-xs font-semibold text-[#14215b] disabled:opacity-60 dark:border-white/20 dark:text-slate-200"
                >
                  {busy === `enrol-${detail.session.id}` ? 'Filling…' : 'Add missing students'}
                </button>
              ) : null}
            </div>
          </div>

          {detail.unplacedCount ? (
            <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
              {detail.unplacedCount} student{detail.unplacedCount === 1 ? ' has' : 's have'} no class in this session. Set their class on the promotion page so they are billed and appear on a class register.
            </p>
          ) : null}

          {detail.session.status !== 'active' ? (
            <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
              You are viewing a session that is not currently running. New academic records are only ever created against the active session.
            </p>
          ) : null}

          <h4 className="mt-4 text-sm font-black uppercase tracking-wide text-[#800020] dark:text-slate-300">Terms</h4>
          <div className="mt-2 space-y-2">
            {termDrafts.map((term, index) => (
              <div key={term.id || term.sequence} className={INNER}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="flex items-center gap-2 font-bold text-[#14215b] dark:text-slate-100">
                    {term.name} <StatusPill status={term.status || 'upcoming'} />
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {detail.session.status === 'active' && term.status !== 'active' ? (
                      <button type="button" onClick={run(`term-${term.id}`, () => activateAcademicTerm(term.id), `${term.name} is now the active term.`)} disabled={busy === `term-${term.id}`} className="rounded-lg bg-[#1a5c38] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60">Open term</button>
                    ) : null}
                    {term.status === 'active' ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (!window.confirm(`This will mark ${term.name} as completed. Continue?`)) return;
                          run(`close-${term.id}`, () => closeAcademicTerm(term.id), `${term.name} closed.`)();
                        }}
                        disabled={busy === `close-${term.id}`}
                        className="rounded-lg border border-[#800020]/30 px-3 py-1.5 text-xs font-semibold text-[#800020] dark:border-white/20 dark:text-slate-300"
                      >Close term</button>
                    ) : null}
                  </div>
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-4">
                  <label className="block"><span className={FIELD_LABEL}>Term name</span>
                    <input disabled={!canEditTerms} value={term.name || ''} onChange={e => setTermDrafts(list => list.map((t, i) => i === index ? { ...t, name: e.target.value } : t))} className={`${INPUT} mt-0.5 w-full`} /></label>
                  <label className="block"><span className={FIELD_LABEL}>Term starts</span>
                    <input disabled={!canEditTerms} type="date" min={detail.session.startDate || undefined} max={detail.session.endDate || undefined} value={term.startDate || ''} onChange={e => setTermDrafts(list => list.map((t, i) => i === index ? { ...t, startDate: e.target.value } : t))} className={`${INPUT} mt-0.5 w-full`} /></label>
                  <label className="block"><span className={FIELD_LABEL}>Term ends</span>
                    <input disabled={!canEditTerms} type="date" min={term.startDate || detail.session.startDate || undefined} max={detail.session.endDate || undefined} value={term.endDate || ''} onChange={e => setTermDrafts(list => list.map((t, i) => i === index ? { ...t, endDate: e.target.value } : t))} className={`${INPUT} mt-0.5 w-full`} /></label>
                  <label className="block"><span className={FIELD_LABEL}>School resumes after</span>
                    <input disabled={!canEditTerms} type="date" min={term.endDate || undefined} value={term.resumptionDate || ''} onChange={e => setTermDrafts(list => list.map((t, i) => i === index ? { ...t, resumptionDate: e.target.value } : t))} className={`${INPUT} mt-0.5 w-full`} /></label>
                </div>
                <label className="mt-2 flex items-center gap-2 text-xs text-[#191970] dark:text-slate-300">
                  <input type="checkbox" disabled={!canEditTerms} checked={Boolean(term.autoActivate)} onChange={e => setTermDrafts(list => list.map((t, i) => i === index ? { ...t, autoActivate: e.target.checked } : t))} />
                  Automatically open this term on its start date
                </label>
                {termDraftProblems[index] ? <p className="mt-2 text-xs font-semibold text-red-600 dark:text-red-300">{termDraftProblems[index]}</p> : null}
              </div>
            ))}
            {!termDrafts.length ? <p className="text-sm text-[#4a5578] dark:text-slate-400">No terms configured for this session yet.</p> : null}
          </div>

          {canEditTerms ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => setTermDrafts(list => [...list, { sequence: list.length + 1, name: `Term ${list.length + 1}`, startDate: '', endDate: '', resumptionDate: '', autoActivate: false }])} className={BTN_GHOST}>+ Add term</button>
              <button type="button" disabled={!termsChanged || hasTermDraftProblems || busy === 'terms'} onClick={run('terms', () => saveAcademicTerms(detail.session.id, termDrafts), 'Term dates saved.')} className={BTN}>
                {busy === 'terms' ? 'Saving…' : 'Save term dates'}
              </button>
            </div>
          ) : null}

          <h4 className="mt-6 text-sm font-black uppercase tracking-wide text-[#800020] dark:text-slate-300">Breaks and holidays</h4>
          <div className="mt-2 space-y-2">
            {(detail.breaks || []).map(item => (
              <div key={item.id} className={`${INNER} flex flex-wrap items-center justify-between gap-2`}>
                <div>
                  <p className="font-semibold text-[#14215b] dark:text-slate-100">{item.name}</p>
                  <p className="text-xs text-[#4a5578] dark:text-slate-400">
                    {formatDate(item.startDate)} – {formatDate(item.endDate)}
                    {item.resumptionDate ? ` · school resumes ${formatDate(item.resumptionDate)}` : ''}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setBreakDraft(item)} className="rounded-lg border border-[#c9a96e]/40 px-3 py-1.5 text-xs font-semibold text-[#14215b] dark:border-white/20 dark:text-slate-200">Edit</button>
                  <button type="button" onClick={run(`break-${item.id}`, () => deleteAcademicBreak(item.id), 'Break removed.')} className="rounded-lg border border-red-400/40 px-3 py-1.5 text-xs font-semibold text-red-600">Remove</button>
                </div>
              </div>
            ))}
            {!(detail.breaks || []).length ? <p className="text-sm text-[#4a5578] dark:text-slate-400">No breaks recorded for this session.</p> : null}
          </div>

          {breakDraft ? (
            <form
              className="mt-3 space-y-3 rounded-2xl border border-[#c9a96e]/30 bg-[#fff8ee]/70 p-4 dark:border-white/10 dark:bg-slate-800/40"
              onSubmit={async (event) => {
                event.preventDefault();
                const saved = await run('break-save', () => saveAcademicBreak(detail.session.id, breakDraft), 'Break saved.')();
                if (saved) setBreakDraft(null);
              }}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block"><span className={LABEL}>Break name</span>
                  <input required value={breakDraft.name || ''} onChange={e => setBreakDraft(d => ({ ...d, name: e.target.value }))} className={`${INPUT} mt-1 w-full`} /></label>
                <label className="block"><span className={LABEL}>Type</span>
                  <select value={breakDraft.breakType || 'custom'} onChange={e => setBreakDraft(d => ({ ...d, breakType: e.target.value }))} className={`${INPUT} mt-1 w-full`}>
                    {BREAK_TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
                  </select></label>
                <label className="block"><span className={LABEL}>Starts</span>
                  <input required type="date" value={breakDraft.startDate || ''} onChange={e => setBreakDraft(d => ({ ...d, startDate: e.target.value }))} className={`${INPUT} mt-1 w-full`} /></label>
                <label className="block"><span className={LABEL}>Ends</span>
                  <input required type="date" min={breakDraft.startDate || undefined} value={breakDraft.endDate || ''} onChange={e => setBreakDraft(d => ({ ...d, endDate: e.target.value }))} className={`${INPUT} mt-1 w-full`} /></label>
                <label className="block"><span className={LABEL}>School resumes</span>
                  <input type="date" min={breakDraft.endDate || undefined} value={breakDraft.resumptionDate || ''} onChange={e => setBreakDraft(d => ({ ...d, resumptionDate: e.target.value }))} className={`${INPUT} mt-1 w-full`} /></label>
                <label className="block"><span className={LABEL}>Applies to term</span>
                  <select value={breakDraft.termId || ''} onChange={e => setBreakDraft(d => ({ ...d, termId: e.target.value }))} className={`${INPUT} mt-1 w-full`}>
                    <option value="">Whole session</option>
                    {(detail.terms || []).map(term => <option key={term.id} value={term.id}>{term.name}</option>)}
                  </select></label>
              </div>
              <div className="flex flex-wrap gap-2 pb-[var(--safe-bottom)]">
                <button type="submit" disabled={busy === 'break-save'} className={BTN}>{busy === 'break-save' ? 'Saving…' : 'Save break'}</button>
                <button type="button" onClick={() => setBreakDraft(null)} className={BTN_GHOST}>Cancel</button>
              </div>
            </form>
          ) : (
            <div className={STICKY_ACTIONS}>
              <button type="button" onClick={() => setBreakDraft({ name: '', breakType: 'custom', startDate: '', endDate: '', resumptionDate: '', termId: '' })} className={BTN_GHOST}>+ Add a break</button>
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
