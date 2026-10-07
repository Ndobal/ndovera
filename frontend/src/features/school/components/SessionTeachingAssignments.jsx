import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { carryForwardTeachingAssignments, getSessionTeachingAssignments } from '../services/schoolApi';

// Academic continuity is automatic; teacher assignment is administrative. A new
// session opens with no teachers assigned. This panel shows who taught what last
// session so the school can confirm the rows that still hold — one by one, never
// by default — while anything already assigned for this session is left alone.

const CARD = 'rounded-3xl p-5 sm:p-6 bg-[#b5e3f4] border border-[#c9a96e]/40 dark:border-white/10 dark:bg-slate-900/40';
const BTN = 'rounded-2xl bg-[#1a5c38] px-5 py-2.5 text-sm font-bold text-[#b5e3f4] transition hover:bg-[#154a2e] disabled:opacity-60';
const ROLE_LABELS = { subject: 'Subject teacher', class_teacher: 'Class teacher', co_teacher: 'Co-teacher' };

export default function SessionTeachingAssignments({ activeSession, sessions }) {
  const previous = useMemo(() => {
    if (!activeSession) return null;
    return (sessions || [])
      .filter(session => session.id !== activeSession.id && ['completed', 'archived'].includes(session.status) && session.startDate < activeSession.startDate)
      .sort((a, b) => b.startDate.localeCompare(a.startDate))[0] || null;
  }, [activeSession, sessions]);
  const [current, setCurrent] = useState([]);
  const [past, setPast] = useState([]);
  const [selected, setSelected] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    if (!activeSession) return;
    const [now, before] = await Promise.all([
      getSessionTeachingAssignments(activeSession.id),
      previous ? getSessionTeachingAssignments(previous.id) : Promise.resolve({ assignments: [] }),
    ]);
    setCurrent((now?.assignments || []).filter(row => !row.ended_at));
    setPast(before?.assignments || []);
  }, [activeSession, previous]);

  useEffect(() => {
    load().catch(e => setError(e.message || 'Could not load teaching assignments.'));
  }, [load]);

  // A previous-session row is "open" when nothing fills that slot this session yet.
  const filled = useMemo(() => new Set(current.map(row => `${row.role}|${row.class_id}|${row.subject_id}`)), [current]);
  const open = past.filter(row => row.role === 'co_teacher' || !filled.has(`${row.role}|${row.class_id}|${row.subject_id}`));

  if (!activeSession) return null;

  function toggle(id) {
    setSelected(currentSet => {
      const next = new Set(currentSet);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function confirm() {
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await carryForwardTeachingAssignments(previous.id, Array.from(selected));
      setNotice(`${result.applied} assignment${result.applied === 1 ? '' : 's'} confirmed for ${activeSession.name}.${result.skipped ? ` ${result.skipped} skipped because the slot was already filled or the class/subject no longer exists.` : ''}`);
      setSelected(new Set());
      await load();
    } catch (e) {
      setError(e.message || 'Could not assign those teachers.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={CARD} aria-label="Teacher assignments">
      <h3 className="text-lg font-black text-[#800000] dark:text-slate-100">Teacher assignments — {activeSession.name}</h3>
      <p className="mt-1 text-sm text-[#191970] dark:text-slate-300">
        {current.length} assignment{current.length === 1 ? '' : 's'} made for this session. Assignments never carry over between sessions automatically; assign teachers in Classes and Subjects, or confirm last session's below.
      </p>
      {error ? <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p> : null}
      {notice ? <p role="status" className="mt-3 rounded-xl bg-[#fff8ee] px-3 py-2 text-sm font-semibold text-[#1a5c38]">{notice}</p> : null}
      {previous && open.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-[#800020]">Not yet assigned — taught in {previous.name}</p>
          <ul className="max-h-80 space-y-1 overflow-auto">
            {open.map(row => (
              <li key={row.id}>
                <label className="flex items-center gap-3 rounded-xl bg-white/60 px-3 py-2 text-sm text-[#191970] dark:bg-slate-800/60 dark:text-slate-100">
                  <input type="checkbox" checked={selected.has(row.id)} onChange={() => toggle(row.id)} />
                  <span className="flex-1">{row.class_name}{row.subject_name ? ` — ${row.subject_name}` : ''} <span className="text-xs text-[#4a5578]">({ROLE_LABELS[row.role] || row.role})</span></span>
                  <span className="text-xs font-semibold">{row.teacher_name || row.teacher_id}</span>
                </label>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className={BTN} disabled={busy || selected.size === 0} onClick={confirm}>
              {busy ? 'Assigning…' : `Assign selected (${selected.size}) for ${activeSession.name}`}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
