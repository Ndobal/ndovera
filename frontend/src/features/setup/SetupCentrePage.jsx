import React, { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { getSchoolSetup, saveSessionTransition } from '../school/services/schoolApi';

// Smart Setup Centre: is the school fully set up, and ready for the new term or session?
// Every status comes from the school's own records, checked on the server. "Fix now" opens the
// exact page that fixes it — only for roles allowed there — and the centre checks again when
// you come back.

const STATUS = {
  complete: { label: 'Complete', icon: '✓', className: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100' },
  incomplete: { label: 'Incomplete', icon: '!', className: 'bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100' },
  blocked: { label: 'Waiting on an earlier step', icon: '⏸', className: 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100' },
  not_started: { label: 'Not started', icon: '○', className: 'bg-rose-100 text-rose-900 dark:bg-rose-900 dark:text-rose-100' },
  not_applicable: { label: 'Not needed', icon: '–', className: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200' },
  unable_to_verify: { label: 'Could not check', icon: '?', className: 'bg-violet-100 text-violet-900 dark:bg-violet-900 dark:text-violet-100' },
};

const settings = tab => role => `/roles/${role}/settings?tab=${encodeURIComponent(tab)}`;
const page = path => role => `/roles/${role}/${path}`;
const HEADS = ['owner', 'hos'];
// Where each step is fixed, and which roles may open that page.
const FIXES = {
  branding: { to: settings('School Branding'), roles: HEADS },
  sessions: { to: settings('Sessions & Terms'), roles: HEADS },
  calendar: { to: page('terms-calendar'), roles: HEADS },
  classes: { to: role => (role === 'ict' ? '/roles/ict/classes' : settings('Classes')(role)), roles: [...HEADS, 'ict'] },
  classLevels: { to: role => (role === 'ict' ? '/roles/ict/classes' : settings('Class Levels')(role)), roles: [...HEADS, 'ict'] },
  subjects: { to: role => (role === 'ict' ? '/roles/ict/classes' : settings('Subjects')(role)), roles: [...HEADS, 'ict'] },
  people: { to: page('people'), roles: [...HEADS, 'ict'] },
  parents: { to: page('people'), roles: [...HEADS, 'ict'] },
  roles: { to: page('people'), roles: [...HEADS, 'ict'] },
  teachers: { to: role => (role === 'ict' ? '/roles/ict/classes' : settings('Classes')(role)), roles: [...HEADS, 'ict'] },
  fees: { to: page('finance'), roles: HEADS },
  grading: { to: role => `/roles/${role}/academics?tab=administration`, roles: HEADS },
  website: { to: settings('Website'), roles: HEADS },
  communications: { to: page('communications'), roles: HEADS },
  attendance: { to: page('attendance'), roles: HEADS },
  staffAttendance: { to: settings('Attendance Management'), roles: HEADS },
  timetable: { to: page('timetable'), roles: HEADS },
  promotion: { to: settings('Promotion'), roles: HEADS },
};
const WHO = { default: 'the Owner or Head of School' };

function FixButton({ fix, role }) {
  const target = FIXES[fix];
  if (!target) return null;
  if (!target.roles.includes(role)) return <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Ask {WHO[fix] || WHO.default} to fix this.</span>;
  return <Link to={target.to(role)} className="inline-flex rounded-lg bg-[#191970] px-3 py-1.5 text-sm font-bold text-white hover:bg-[#12124f]">Fix now</Link>;
}

function StatusChip({ status }) {
  const meta = STATUS[status] || STATUS.unable_to_verify;
  return <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${meta.className}`}><span aria-hidden="true">{meta.icon}</span>{meta.label}</span>;
}

function AreaCard({ item, index, role }) {
  return (
    <li className="rounded-xl border border-slate-200 bg-white p-4 text-slate-900 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-black text-[#0b1f3a] dark:text-white">{index != null ? `${index + 1}. ` : ''}{item.title}{item.critical ? <span className="ml-2 rounded bg-[#191970] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">Essential</span> : null}</h3>
          <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">{item.summary}</p>
        </div>
        <StatusChip status={item.status} />
      </div>
      {item.problems?.length ? <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-800 dark:text-slate-200">{item.problems.map(problem => <li key={problem}>{problem}</li>)}</ul> : null}
      {item.status !== 'complete' && item.status !== 'not_applicable' ? <div className="mt-3"><FixButton fix={item.fix} role={role} /></div> : null}
    </li>
  );
}

export default function SetupCentrePage() {
  const location = useLocation();
  const role = location.pathname.split('/')[2] || 'owner';
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);

  const check = useCallback(async () => {
    setChecking(true);
    try { setData(await getSchoolSetup()); setError(''); }
    catch (err) { setError(err.message || 'The Setup Centre could not check the school just now.'); }
    finally { setChecking(false); }
  }, []);

  useEffect(() => { check(); }, [check]);
  // Back from fixing something: check again.
  useEffect(() => {
    const again = () => { if (document.visibilityState === 'visible') check(); };
    window.addEventListener('focus', again);
    document.addEventListener('visibilitychange', again);
    return () => { window.removeEventListener('focus', again); document.removeEventListener('visibilitychange', again); };
  }, [check]);

  const chooseKeep = async keepTeachers => {
    setSaving(true);
    try { await saveSessionTransition(keepTeachers); await check(); }
    catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const essentials = data?.areas.filter(item => item.critical) || [];
  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 text-slate-900 sm:p-6 dark:text-slate-100">
      <header className="rounded-2xl bg-[#191970] p-6 text-white">
        <p className="text-xs font-bold uppercase tracking-widest text-amber-200">Smart Setup Centre</p>
        <h1 className="mt-1 text-2xl font-black">Is the school ready?</h1>
        <p className="mt-2 text-sm text-slate-100">Every step below is checked against the school's own records — nothing is ticked by hand. Fix a step, come back, and it is checked again.</p>
      </header>

      {error ? <p role="alert" className="rounded-lg bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800 dark:bg-rose-950 dark:text-rose-200">{error}</p> : null}
      {!data && !error ? <p role="status" className="text-sm text-slate-700 dark:text-slate-300">Checking the school's records…</p> : null}

      {data ? (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <h2 className="text-sm font-black uppercase tracking-wide text-[#0b1f3a] dark:text-white">Progress</h2>
              <p className="mt-2 text-3xl font-black text-[#191970] dark:text-white">{data.progress.percent}%</p>
              <p className="text-sm text-slate-700 dark:text-slate-300">{data.progress.done} of {data.progress.applicable} steps complete.</p>
              <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700" role="progressbar" aria-label="Setup progress" aria-valuenow={data.progress.percent} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full bg-[#1a5c38] dark:bg-emerald-400" style={{ width: `${data.progress.percent}%` }} />
              </div>
            </section>
            <section className={`rounded-xl border p-5 shadow-sm ${data.readiness.ready ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-50' : 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-50'}`}>
              <h2 className="text-sm font-black uppercase tracking-wide">Ready to run on Ndovera?</h2>
              <p className="mt-2 text-2xl font-black">{data.readiness.ready ? 'Yes — every essential step is complete' : 'Not yet'}</p>
              {data.readiness.missing.length ? <p className="mt-1 text-sm">Still needed: {data.readiness.missing.join(', ')}.</p> : null}
              {data.readiness.unverified.length ? <p className="mt-1 text-sm">Could not be checked just now: {data.readiness.unverified.join(', ')}. Readiness is not assumed.</p> : null}
              <p className="mt-2 text-xs">{essentials.filter(item => item.status === 'complete').length} of {essentials.length} essential steps complete.</p>
            </section>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-slate-700 dark:text-slate-300">Checked {new Date(data.checkedAt).toLocaleString()}.</p>
            <button type="button" onClick={check} disabled={checking} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-[#191970] disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-white">{checking ? 'Checking…' : 'Check again'}</button>
          </div>

          {data.newSession ? (
            <section className="space-y-3 rounded-2xl border-2 border-[#c9a96e] bg-[#fff8ee] p-5 text-slate-900 dark:border-amber-700 dark:bg-slate-900 dark:text-slate-100">
              <h2 className="text-lg font-black text-[#191970] dark:text-white">New session readiness</h2>
              <p className="text-sm text-slate-800 dark:text-slate-200">{data.newSession.session} ends on {data.newSession.endsOn} ({data.newSession.daysLeft} days).{data.newSession.nextSession ? ` Next: ${data.newSession.nextSession}.` : ''}</p>
              <ul className="space-y-3">{data.newSession.steps.map(item => <AreaCard key={item.key} item={item} role={role} />)}</ul>
              {HEADS.includes(role) ? (
                <fieldset className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
                  <legend className="px-1 text-sm font-bold text-[#0b1f3a] dark:text-white">Teachers when the new session starts</legend>
                  <label className="flex items-start gap-2 text-sm"><input type="radio" name="keep" checked={data.keepTeachers} disabled={saving} onChange={() => chooseKeep(true)} className="mt-1" /> <span><b>Keep every teacher where they are</b> (class teachers and subject teachers carry over; change any after it starts).</span></label>
                  <label className="mt-2 flex items-start gap-2 text-sm"><input type="radio" name="keep" checked={!data.keepTeachers} disabled={saving} onChange={() => chooseKeep(false)} className="mt-1" /> <span><b>Start with open slots</b> and assign the new session's teachers yourself (last session's teachers can be confirmed one by one).</span></label>
                  <p className="mt-2 text-xs text-slate-700 dark:text-slate-300">Either way, who taught what this session is kept on record, and no result, fee or attendance record is deleted.</p>
                </fieldset>
              ) : null}
            </section>
          ) : null}

          <section className="space-y-3">
            <h2 className="text-lg font-black text-[#191970] dark:text-white">Setup steps</h2>
            <ol className="space-y-3">{data.areas.map((item, index) => <AreaCard key={item.key} item={item} index={index} role={role} />)}</ol>
          </section>
        </>
      ) : null}
    </div>
  );
}
