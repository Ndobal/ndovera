import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getAcademicOverview, getClasses, getSessionEnrollments, moveSessionEnrollments, autoEnrolSession,
} from '../services/schoolApi';

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
              <p className="text-xs font-bold uppercase tracking-wide text-[#800020] dark:text-slate-300">
                On the register, no class ({gaps.unplaced.length})
              </p>
              <div className="mt-2 space-y-2">
                {gaps.unplaced.map(row => (
                  <div key={row.studentId} className={`${INNER} flex flex-wrap items-center justify-between gap-2`}>
                    <span className="font-semibold text-[#14215b] dark:text-slate-100">
                      {row.studentName || row.studentId}
                      {row.studentDisplayId ? <span className="ml-2 text-xs font-normal text-[#4a5578] dark:text-slate-400">{row.studentDisplayId}</span> : null}
                    </span>
                    <select
                      defaultValue=""
                      disabled={busy === 'move'}
                      onChange={e => { if (e.target.value) runMove([row.studentId], e.target.value); }}
                      className={INPUT}
                    >
                      <option value="">Assign a class…</option>
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
    </div>
  );
}
