import React, { useCallback, useEffect, useState } from 'react';
import { getClasses, getResultOverview } from '../../school/services/schoolApi';
import ResultAdminConsole from './ResultAdminConsole';
import TeacherCAScoreSheet from './TeacherCAScoreSheet';

// Academics for the Head of School and Owner: every class, and each class's CA
// score sheet — the one record of CA, exam scores and the profile (behaviour,
// affective) entries that results are prepared from. Teachers enter scores on the
// same sheet from their own dashboard; this page lets leadership open any class to
// view, enter or supervise, following the result cycle (entry → submitted → published).
// The results analytics and settings stay below, unchanged.

const CARD = 'rounded-3xl border border-[#c9a96e]/40 bg-[#b5e3f4] p-5 dark:border-white/10 dark:bg-slate-900/40';
const STATUS = {
  draft: ['Entering scores', 'bg-amber-100 text-amber-900'],
  submitted: ['Submitted — awaiting approval', 'bg-sky-100 text-sky-900'],
  published: ['Published', 'bg-emerald-100 text-emerald-900'],
};

const readClassId = () => {
  try { return new URLSearchParams(window.location.search).get('classId') || ''; } catch { return ''; }
};

export default function SchoolClassResults({ analyticsMode = 'hos', roleTitle = 'Head of School Dashboard' }) {
  const [classes, setClasses] = useState(null);
  const [batches, setBatches] = useState([]);
  const [classId, setClassId] = useState(readClassId);
  const [error, setError] = useState('');

  useEffect(() => {
    getClasses().then(data => setClasses(data?.classes || data || [])).catch(err => { setClasses([]); setError(err.message); });
    getResultOverview().then(data => setBatches(data?.batches || [])).catch(() => setBatches([]));
  }, []);

  // The open class is kept in the address (…/academics?classId=…), so refresh and Back work.
  const open = useCallback(next => {
    setClassId(next);
    try {
      const url = new URL(window.location.href);
      if (next) url.searchParams.set('classId', next); else url.searchParams.delete('classId');
      window.history.pushState({}, '', url.toString());
    } catch { /* address bar update is optional */ }
  }, []);
  useEffect(() => {
    const onPop = () => setClassId(readClassId());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const nameOf = item => [item?.name, item?.arm].filter(Boolean).join(' ') || item?.className || 'Class';
  // The latest batch per class (newest session/term first, as the server lists them).
  const latest = new Map();
  for (const batch of batches) if (batch?.classId && !latest.has(batch.classId)) latest.set(batch.classId, batch);

  if (classId) {
    const current = (classes || []).find(item => String(item.id) === String(classId));
    return (
      <div className="space-y-3">
        <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-8">
          <button type="button" onClick={() => open('')} className="rounded-xl border border-[#c9a96e]/50 bg-white px-4 py-2 text-sm font-bold text-[#800020]">← All classes</button>
        </div>
        <TeacherCAScoreSheet key={classId} dashboardLabel={`${roleTitle} · ${current ? nameOf(current) : 'Class'}`} fixedClassId={classId} fixedClassName={current ? nameOf(current) : ''} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="mx-auto max-w-7xl space-y-4 px-4 pt-4 sm:px-8">
        <section className={CARD} aria-label="Classes">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#800020]">Academics</p>
          <h1 className="text-2xl font-black text-[#800000] dark:text-white">Class score sheets</h1>
          <p className="mt-1 text-sm text-[#191970] dark:text-slate-300">Open a class to see its CA score sheet — CA, exam scores and the behaviour and affective records results are prepared from. Teachers enter their subjects' scores on the same sheet; exam scores from Ndovera exams arrive here when teachers post them.</p>
          {error && <p role="alert" className="mt-2 text-sm font-semibold text-rose-700">{error}</p>}
          {!classes ? <p role="status" className="mt-3 text-sm">Loading classes…</p> : !classes.length ? <p className="mt-3 text-sm">No classes yet.</p> : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {classes.map(item => {
                const batch = latest.get(String(item.id));
                const [label, tone] = STATUS[batch?.status] || ['No scores yet', 'bg-white text-[#191970]'];
                return (
                  <button key={item.id} type="button" onClick={() => open(String(item.id))} className="rounded-2xl bg-white/90 p-4 text-left text-[#191970] shadow-sm hover:ring-2 hover:ring-[#800020]/30 dark:bg-slate-900 dark:text-slate-100">
                    <span className="block text-lg font-black text-[#800000] dark:text-white">{nameOf(item)}</span>
                    {item.classTeacherName ? <span className="block text-xs">Class teacher: {item.classTeacherName}</span> : null}
                    <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${tone}`}>{label}</span>
                    {batch?.termName ? <span className="ml-1 text-[11px]">{batch.sessionName} · {batch.termName}</span> : null}
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>
      <ResultAdminConsole analyticsMode={analyticsMode} roleTitle={roleTitle} />
    </div>
  );
}
