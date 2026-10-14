import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getAcademicOverview, getClasses, getSessionEnrollments, moveSessionEnrollments, autoEnrolSession, getClassHistory, runClassMonitor,
} from '../services/schoolApi';

const OUTCOME = {
  changed: ['Moved', 'bg-sky-100 text-sky-900'], placed: ['Placed', 'bg-emerald-100 text-emerald-900'], cleared: ['Class removed', 'bg-slate-200 text-slate-800'],
  blocked: ['Blocked — class kept', 'bg-amber-100 text-amber-900'], restored: ['Put back by the monitor', 'bg-rose-100 text-rose-900'], pinned: ['Pinned', 'bg-slate-100 text-slate-700'],
};
const REASON = { manual: 'by hand', promotion: 'promotion', graduation: 'graduation', left: 'left the school', session: 'Class Register / new session', admission: 'admission', import: 'import', roster: 'class roster', 'class-deleted': 'class deleted' };

/**
 * Every student keeps their class until the Owner, Head of School or ICT moves them (or a
 * promotion does). This log shows each change — and any attempt to change a class off the
 * record, which was blocked or put back by the nightly monitor.
 */
function ClassChangesLog() {
  const [entries, setEntries] = useState(null);
  const [filter, setFilter] = useState('');
  const [message, setMessage] = useState('');
  const load = useCallback(() => getClassHistory({ outcome: filter, limit: 200 }).then(data => setEntries((data.entries || []).filter(entry => entry.outcome !== 'pinned'))).catch(err => setMessage(err.message)), [filter]);
  useEffect(() => { load(); }, [load]);
  const alerts = (entries || []).filter(entry => entry.outcome === 'blocked' || entry.outcome === 'restored').length;
  return (
    <section className={CARD} aria-label="Class changes">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="flex-1 text-lg font-black text-[#800000] dark:text-slate-100">Class changes{alerts ? <span className="ml-2 rounded-full bg-amber-200 px-2 py-0.5 text-xs text-amber-950">{alerts} blocked or put back</span> : null}</h3>
        <select aria-label="Show" value={filter} onChange={e => setFilter(e.target.value)} className={INPUT}>
          <option value="">All changes</option><option value="changed">Moved</option><option value="placed">Placed</option><option value="blocked">Blocked</option><option value="restored">Put back</option>
        </select>
        <button type="button" className={BTN_SMALL} onClick={async () => { try { const result = await runClassMonitor(); setMessage(`Checked ${result.checked} students: ${result.registered || 0} placed on this session's register (fees and class lists now see them), ${result.restored} put back, ${result.unplaced} still without a class.`); load(); } catch (err) { setMessage(err.message); } }}>Check now</button>
      </div>
      <p className="mt-1 text-xs text-[#4a5578] dark:text-slate-400">A student's class changes only when the Owner, Head of School or ICT moves them, or a promotion does. Anything else keeps the class and appears here; every night Ndovera also checks that no class changed off the record.</p>
      {message ? <p role="status" className="mt-2 text-sm font-semibold text-[#1a5c38]">{message}</p> : null}
      {!entries ? <p className="mt-2 text-sm">Loading…</p> : !entries.length ? <p className="mt-2 text-sm text-[#4a5578] dark:text-slate-400">No class changes recorded yet.</p> : (
        <ul className="mt-3 max-h-96 space-y-1 overflow-y-auto">
          {entries.map(entry => {
            const [label, tone] = OUTCOME[entry.outcome] || [entry.outcome, 'bg-slate-100'];
            return (
              <li key={entry.id} className={`${INNER} flex flex-wrap items-center gap-2 text-sm text-[#14215b] dark:text-slate-100`}>
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${tone}`}>{label}</span>
                <span className="font-semibold">{entry.student_name}</span>
                <span>{entry.from_class_name || '—'} → {entry.outcome === 'blocked' ? <s>{entry.to_class_name || 'no class'}</s> : (entry.to_class_name || 'no class')}</span>
                <span className="text-xs text-[#4a5578] dark:text-slate-400">{entry.by_name || entry.by_role || 'system'}{entry.reason ? ` · ${REASON[entry.reason] || entry.reason}` : ''} · {new Date(entry.at).toLocaleString()}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

const CARD = 'rounded-3xl p-5 sm:p-6 bg-[#b5e3f4] border border-[#c9a96e]/40 dark:border-white/10 dark:bg-slate-900/40';
const INNER = 'rounded-2xl border border-[#c9a96e]/30 bg-[#ade1f4]/60 p-3 dark:border-white/10 dark:bg-slate-800/40';
const INPUT = 'rounded-xl border border-[#c9a96e]/40 bg-white px-3 py-2 text-sm text-[#191970] outline-none focus:ring-2 focus:ring-[#1a5c38] dark:border-white/10 dark:bg-slate-800 dark:text-slate-100';
const BTN = 'rounded-2xl bg-[#1a5c38] px-5 py-2.5 text-sm font-bold text-[#b5e3f4] transition hover:bg-[#154a2e] disabled:opacity-60';
const BTN_SMALL = 'rounded-lg border border-[#c9a96e]/40 px-3 py-1.5 text-xs font-semibold text-[#14215b] disabled:opacity-60 dark:border-white/20 dark:text-slate-200';
const LABEL = 'text-xs font-bold uppercase tracking-[0.18em] text-[#800020] dark:text-slate-400';

// The move bar is pinned, and clears the mobile navigation bar.
const STICKY_BAR = 'sticky bottom-0 -mx-5 mt-4 flex flex-wrap items-center gap-3 border-t border-[#c9a96e]/35 bg-[#b5e3f4]/95 px-5 pt-3 pb-[calc(0.75rem+var(--safe-bottom))] backdrop-blur sm:-mx-6 sm:px-6 dark:border-white/10 dark:bg-slate-900/95';

function classLabel(klass) {
  return `${klass.name || ''}${klass.arm ? ` ${klass.arm}` : ''}`.trim();
}

/**
 * Who is in which class this session, and — the reason this screen exists — who
 * is in none.
 *
 * A promotion that lands a whole year group in one default class still has to be
 * split by hand, and a student the promotion could not place disappears from
 * every other screen in the app: no class list, no fee run, no result sheet.
 * Both jobs are the same job, so they live together here: see the gaps, select,
 * assign.
 */
export default function SessionRegisterBoard() {
  const [sessions, setSessions] = useState([]);
  const [sessionId, setSessionId] = useState('');
  const [classes, setClasses] = useState([]);
  const [register, setRegister] = useState(null);
  const [selected, setSelected] = useState(() => new Set());
  const [classFilter, setClassFilter] = useState('');
  const [moveTarget, setMoveTarget] = useState('');
  // Classes chosen for students with none, saved together with one press (studentId → classId).
  const [pending, setPending] = useState({});
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [overview, classData] = await Promise.all([
          getAcademicOverview(),
          getClasses().then(d => d?.classes || []).catch(() => []),
        ]);
        if (cancelled) return;
        const list = overview?.sessions || [];
        setSessions(list);
        setClasses(classData);
        setSessionId(overview?.activeSession?.id || list[0]?.id || '');
      } catch (e) {
        if (!cancelled) setError(e.message || 'Could not load sessions.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const loadRegister = useCallback(async (id) => {
    if (!id) { setRegister(null); return; }
    const data = await getSessionEnrollments(id);
    setRegister(data);
    setSelected(new Set());
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    loadRegister(sessionId).catch(e => setError(e.message || 'Could not load the register.'));
  }, [sessionId, loadRegister]);

  const enrollments = useMemo(() => register?.enrollments || [], [register]);
  const gaps = register?.gaps || { unplaced: [], offRegister: [], total: 0 };
  const session = sessions.find(item => item.id === sessionId) || null;

  const byClass = useMemo(() => {
    const groups = new Map();
    enrollments.forEach(row => {
      if (row.status !== 'active') return;
      const key = row.classId || '';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    });
    return Array.from(groups.entries())
      .map(([id, rows]) => ({
        id,
        label: rows[0]?.className
          ? `${rows[0].className}${rows[0].classArm ? ` ${rows[0].classArm}` : ''}`
          : 'No class yet',
        rows,
      }))
      .sort((a, b) => (a.id ? 1 : -1) - (b.id ? 1 : -1) || a.label.localeCompare(b.label));
  }, [enrollments]);

  const visibleGroups = useMemo(() => {
    const term = search.trim().toLowerCase();
    return byClass
      .filter(group => !classFilter || group.id === classFilter)
      .map(group => ({
        ...group,
        rows: term
          ? group.rows.filter(row => `${row.studentName} ${row.studentDisplayId}`.toLowerCase().includes(term))
          : group.rows,
      }))
      .filter(group => group.rows.length);
  }, [byClass, classFilter, search]);

  function toggle(studentId) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId); else next.add(studentId);
      return next;
    });
  }

  function toggleGroup(rows) {
    const ids = rows.map(row => row.studentId);
    const allOn = ids.every(id => selected.has(id));
    setSelected(prev => {
      const next = new Set(prev);
      ids.forEach(id => { if (allOn) next.delete(id); else next.add(id); });
      return next;
    });
  }

  async function runMove(studentIds, classId) {
    if (!studentIds.length || !classId) return;
    setBusy('move'); setError(''); setNotice('');
    try {
      const result = await moveSessionEnrollments(sessionId, { studentIds, classId });
      setNotice(
        `${result.moved} student${result.moved === 1 ? '' : 's'} moved to ${result.className}.`
        + (result.liveViewMoved ? ' Their teachers and parents see it now.' : ' It takes effect when this session opens.'),
      );
      await loadRegister(sessionId);
      setMoveTarget('');
    } catch (e) {
      setError(e.message || 'Could not move those students.');
    } finally {
      setBusy('');
    }
  }

  /** Save every class chosen in the "no class" list at once: one request per class, not per student. */
  async function savePlacements() {
    const byClass = new Map();
    for (const [studentId, classId] of Object.entries(pending)) {
      if (!classId) continue;
      byClass.set(classId, [...(byClass.get(classId) || []), studentId]);
    }
    if (!byClass.size) return;
    setBusy('place'); setError(''); setNotice('');
    let placed = 0;
    const failed = [];
    const failedClassIds = new Set();
    for (const [classId, studentIds] of byClass) {
      try {
        const result = await moveSessionEnrollments(sessionId, { studentIds, classId });
        placed += Number(result.moved || studentIds.length);
      } catch (e) {
        failedClassIds.add(classId);
        failed.push(`${classLabel(classes.find(klass => klass.id === classId) || { name: classId })}: ${e.message || 'not saved'}`);
      }
    }
    setNotice(`${placed} student${placed === 1 ? '' : 's'} placed in their class${placed === 1 ? '' : 'es'}.`);
    if (failed.length) setError(`Not saved — ${failed.join('; ')}. Those choices are kept; press Save again.`);
    // Saved choices clear; any that failed stay on screen to try again.
    setPending(current => Object.fromEntries(Object.entries(current).filter(([, classId]) => failedClassIds.has(classId))));
    await loadRegister(sessionId);
    setBusy('');
  }

  async function fillRegister() {
    setBusy('fill'); setError(''); setNotice('');
    try {
      const result = await autoEnrolSession(sessionId);
      const added = result?.enrolment?.enrolled || 0;
      setNotice(added
        ? `${added} student${added === 1 ? '' : 's'} added to the register.`
        : 'Every student on the school roster is already on this register.');
      await loadRegister(sessionId);
    } catch (e) {
      setError(e.message || 'Could not fill the register.');
    } finally {
      setBusy('');
    }
  }

  if (loading) return <p className="text-sm text-[#800020] dark:text-slate-300">Loading the register…</p>;

  return (
    <div className="space-y-5">
      <section className={CARD}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <label className="block">
            <span className={LABEL}>Session</span>
            <select value={sessionId} onChange={e => setSessionId(e.target.value)} className={`${INPUT} mt-1 min-w-[220px]`}>
              {sessions.map(item => (
                <option key={item.id} value={item.id}>
                  {item.name}{item.status === 'active' ? ' (running)' : ` — ${item.status}`}
                </option>
              ))}
            </select>
          </label>
          <div className="text-right">
            <p className="text-2xl font-black text-[#800000] dark:text-slate-100">{register?.enrolledCount ?? 0}</p>
            <p className="text-xs font-semibold text-[#4a5578] dark:text-slate-400">
              on the register of {register?.rosterCount ?? 0} students in the school
            </p>
          </div>
        </div>

        {error ? <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p> : null}
        {notice ? <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">{notice}</p> : null}

        {session && session.status !== 'active' ? (
          <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
            This session is not running yet. Changes here are saved against it, and reach teachers, students and parents on the day you activate it.
          </p>
        ) : null}
      </section>

      {/* The gaps come first: these are the students nobody else can see. */}
      {gaps.total > 0 ? (
        <section className={CARD}>
          <h3 className="text-lg font-black text-[#800000] dark:text-slate-100">
            {gaps.total} student{gaps.total === 1 ? ' needs' : 's need'} attention
          </h3>
          <p className="mt-1 text-xs text-[#4a5578] dark:text-slate-400">
            A student with no class does not appear on any class list, fee run or result sheet. Assign them here.
          </p>

          {gaps.unplaced.length ? (
            <div className="mt-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="flex-1 text-xs font-bold uppercase tracking-wide text-[#800020] dark:text-slate-300">
                  On the register, no class ({gaps.unplaced.length})
                </p>
                <button type="button" className={BTN_SMALL} onClick={() => toggleGroup(gaps.unplaced)}>
                  {gaps.unplaced.every(row => selected.has(row.studentId)) ? 'Clear selection' : `Select all ${gaps.unplaced.length}`}
                </button>
              </div>
              <p className="mt-1 text-xs text-[#4a5578] dark:text-slate-400">Choose a class beside each student, then press Save once. To put several in the same class, tick them and choose the class below.</p>
              {Object.values(pending).some(Boolean) ? (
                <div className="sticky top-14 z-20 mt-2 flex flex-wrap items-center gap-2 rounded-2xl border-2 border-[#1a5c38] bg-[#e8f5ee] px-3 py-2 dark:bg-slate-900">
                  <span className="flex-1 text-sm font-bold text-[#14215b] dark:text-slate-100">{Object.values(pending).filter(Boolean).length} class{Object.values(pending).filter(Boolean).length === 1 ? '' : 'es'} chosen, not saved yet</span>
                  <button type="button" className={BTN} disabled={busy === 'place'} onClick={savePlacements}>{busy === 'place' ? 'Saving…' : `Save all ${Object.values(pending).filter(Boolean).length}`}</button>
                  <button type="button" className={BTN_SMALL} disabled={busy === 'place'} onClick={() => setPending({})}>Clear</button>
                </div>
              ) : null}
              {gaps.unplaced.some(row => selected.has(row.studentId)) ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-[#14215b] dark:text-slate-100">{gaps.unplaced.filter(row => selected.has(row.studentId)).length} selected</span>
                  <select aria-label="Class for the selected students" value={moveTarget} onChange={e => setMoveTarget(e.target.value)} className={INPUT}>
                    <option value="">Place in class…</option>
                    {classes.map(klass => <option key={klass.id} value={klass.id}>{classLabel(klass)}</option>)}
                  </select>
                  <button type="button" className={BTN_SMALL} disabled={!moveTarget} onClick={() => {
                    const ids = gaps.unplaced.filter(row => selected.has(row.studentId)).map(row => row.studentId);
                    setPending(current => ({ ...current, ...Object.fromEntries(ids.map(id => [id, moveTarget])) }));
                    setSelected(new Set()); setMoveTarget('');
                  }}>Set for the ticked students</button>
                </div>
              ) : null}
              <div className="mt-2 space-y-2">
                {gaps.unplaced.map(row => (
                  <div key={row.studentId} className={`${INNER} flex flex-wrap items-center justify-between gap-2`}>
                    <label className="flex items-center gap-2 font-semibold text-[#14215b] dark:text-slate-100">
                      <input type="checkbox" checked={selected.has(row.studentId)} onChange={() => toggle(row.studentId)} aria-label={`Select ${row.studentName || row.studentId}`} />
                      {row.studentName || row.studentId}
                      {row.studentDisplayId ? <span className="ml-2 text-xs font-normal text-[#4a5578] dark:text-slate-400">{row.studentDisplayId}</span> : null}
                    </label>
                    <select
                      aria-label={`Class for ${row.studentName || row.studentId}`}
                      value={pending[row.studentId] || ''}
                      disabled={busy === 'place'}
                      onChange={e => { const value = e.target.value; setPending(current => ({ ...current, [row.studentId]: value })); }}
                      className={`${INPUT} ${pending[row.studentId] ? 'ring-2 ring-[#1a5c38]' : ''}`}
                    >
                      <option value="">Choose a class…</option>
                      {classes.map(klass => <option key={klass.id} value={klass.id}>{classLabel(klass)}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {gaps.offRegister.length ? (
            <div className="mt-4">
              <p className="text-xs font-bold uppercase tracking-wide text-[#800020] dark:text-slate-300">
                Not on this session's register ({gaps.offRegister.length})
              </p>
              <p className="mt-1 text-xs text-[#4a5578] dark:text-slate-400">
                Usually students admitted after the session was created. Adding them puts each one in the class their promotion flow gives them.
              </p>
              <div className="mt-2 space-y-2">
                {gaps.offRegister.slice(0, 25).map(row => (
                  <div key={row.studentId} className={`${INNER} flex flex-wrap items-center justify-between gap-2`}>
                    <span className="font-semibold text-[#14215b] dark:text-slate-100">
                      {row.studentName || row.studentId}
                      {row.className ? <span className="ml-2 text-xs font-normal text-[#4a5578] dark:text-slate-400">currently {row.className}</span> : null}
                    </span>
                  </div>
                ))}
                {gaps.offRegister.length > 25 ? (
                  <p className="text-xs text-[#4a5578] dark:text-slate-400">…and {gaps.offRegister.length - 25} more.</p>
                ) : null}
              </div>
              <button type="button" onClick={fillRegister} disabled={busy === 'fill'} className={`${BTN} mt-3`}>
                {busy === 'fill' ? 'Adding…' : `Add all ${gaps.offRegister.length} to the register`}
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className={CARD}>
        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className={LABEL}>Class</span>
            <select value={classFilter} onChange={e => setClassFilter(e.target.value)} className={`${INPUT} mt-1`}>
              <option value="">Every class</option>
              {byClass.map(group => <option key={group.id || 'none'} value={group.id}>{group.label} ({group.rows.length})</option>)}
            </select>
          </label>
          <label className="block flex-1 min-w-[180px]">
            <span className={LABEL}>Find a student</span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Name or student ID" className={`${INPUT} mt-1 w-full`} />
          </label>
        </div>

        <div className="mt-4 space-y-4">
          {visibleGroups.map(group => (
            <div key={group.id || 'none'}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-black text-[#14215b] dark:text-slate-100">
                  {group.label} <span className="text-xs font-semibold text-[#4a5578] dark:text-slate-400">({group.rows.length})</span>
                </p>
                <button type="button" onClick={() => toggleGroup(group.rows)} className={BTN_SMALL}>
                  Select all
                </button>
              </div>
              <div className="mt-2 space-y-1.5">
                {group.rows.map(row => (
                  <label key={row.studentId} className={`${INNER} flex cursor-pointer items-center gap-3`}>
                    <input type="checkbox" checked={selected.has(row.studentId)} onChange={() => toggle(row.studentId)} />
                    <span className="flex-1 text-sm font-semibold text-[#14215b] dark:text-slate-100">
                      {row.studentName || row.studentId}
                      {row.studentDisplayId ? <span className="ml-2 text-xs font-normal text-[#4a5578] dark:text-slate-400">{row.studentDisplayId}</span> : null}
                    </span>
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-[#4a5578] dark:text-slate-400">
                      {row.source === 'auto-promotion' ? 'promoted' : row.source === 'carryover' ? 'carried over' : row.source}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}
          {!visibleGroups.length ? (
            <p className="text-sm text-[#4a5578] dark:text-slate-400">Nobody on this register matches that.</p>
          ) : null}
        </div>

        {selected.size ? (
          <div className={STICKY_BAR}>
            <span className="text-sm font-bold text-[#14215b] dark:text-slate-100">{selected.size} selected</span>
            <select value={moveTarget} onChange={e => setMoveTarget(e.target.value)} className={INPUT}>
              <option value="">Move to class…</option>
              {classes.map(klass => <option key={klass.id} value={klass.id}>{classLabel(klass)}</option>)}
            </select>
            <button
              type="button"
              onClick={() => runMove(Array.from(selected), moveTarget)}
              disabled={!moveTarget || busy === 'move'}
              className={BTN}
            >
              {busy === 'move' ? 'Moving…' : 'Move'}
            </button>
            <button type="button" onClick={() => setSelected(new Set())} className={BTN_SMALL}>Clear</button>
          </div>
        ) : null}
      </section>

      <ClassChangesLog />
    </div>
  );
}
