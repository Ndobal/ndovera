import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getAssignedClasses } from '../classroom/classroomService';
import SubmissionDetail, { StatusBadge } from './SubmissionDetail';
import LessonPlanReviewPage from '../lesson-plans/LessonPlanReviewPage';
import { STATUS_LABELS, getReviewBoard, getSubmissionConfig, saveSubmissionConfig } from './submissionsApi';

// Owner / HOS: Select class → view submissions → find missing and late work →
// open → AI assistance → review → comment → approve / return. Everything is
// organised Session → Term → Class → Subject → Teacher → Type → Week.

const CARD = 'rounded-3xl border border-[#c9a96e]/40 bg-[#b5e3f4] p-5 dark:border-white/10 dark:bg-slate-900/40';
const SELECT = 'rounded-xl border border-[#c9a96e]/45 bg-white p-2 text-sm text-[#191970]';
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function Tile({ label, value, tone = 'text-[#191970]' }) {
  return (
    <div className="rounded-2xl bg-white p-3 dark:bg-slate-900">
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#800020]">{label}</p>
      <p className={`mt-1 text-2xl font-black ${tone}`}>{value}</p>
    </div>
  );
}

function PolicyEditor({ config, onSaved }) {
  const [policy, setPolicy] = useState(config.policy);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const set = patch => setPolicy(current => ({ ...current, ...patch }));
  const types = config.types.filter(type => type.key !== 'other');

  async function save() {
    setBusy(true); setMessage('');
    try {
      const result = await saveSubmissionConfig({ ...policy, reviewerRoles: String(policy.reviewerRolesText ?? policy.reviewerRoles.join(', ')).split(',').map(item => item.trim()).filter(Boolean) });
      setMessage('Submission rules saved.');
      onSaved(result);
    } catch (err) { setMessage(err.message); } finally { setBusy(false); }
  }

  return (
    <div className={`${CARD} space-y-3 text-sm text-[#191970] dark:text-slate-200`}>
      <h2 className="text-base font-black text-[#800000] dark:text-white">Submission rules</h2>
      <fieldset className="space-y-1">
        <legend className="text-xs font-bold uppercase text-[#800020]">Work expected from teachers</legend>
        {types.map(type => {
          const requirement = policy.requirements.find(item => item.type === type.key);
          return (
            <div key={type.key} className="flex flex-wrap items-center gap-2">
              <label className="flex min-w-[12rem] items-center gap-2">
                <input type="checkbox" checked={Boolean(requirement)} onChange={event => set({ requirements: event.target.checked ? [...policy.requirements, { type: type.key, cadence: 'weekly', dueWeekday: 5 }] : policy.requirements.filter(item => item.type !== type.key) })} />
                {type.label}
              </label>
              {requirement && (
                <>
                  <select aria-label={`${type.label} frequency`} value={requirement.cadence} onChange={event => set({ requirements: policy.requirements.map(item => item.type === type.key ? { ...item, cadence: event.target.value } : item) })} className={SELECT}>
                    <option value="weekly">Weekly</option><option value="termly">Once a term</option>
                  </select>
                  {requirement.cadence === 'weekly' && (
                    <select aria-label={`${type.label} due day`} value={requirement.dueWeekday} onChange={event => set({ requirements: policy.requirements.map(item => item.type === type.key ? { ...item, dueWeekday: Number(event.target.value) } : item) })} className={SELECT}>
                      {WEEKDAYS.map((day, index) => <option key={day} value={index}>Due {day}</option>)}
                    </select>
                  )}
                </>
              )}
            </div>
          );
        })}
      </fieldset>
      <div className="flex flex-wrap items-center gap-2">
        <label>Review by
          <select value={policy.reviewMode} onChange={event => set({ reviewMode: event.target.value })} className={`${SELECT} ml-2`}>
            <option value="approval">Approved / Not approved</option><option value="score">Score</option>
          </select>
        </label>
        {policy.reviewMode === 'score' && <label>out of <input type="number" min="1" value={policy.maxScore} onChange={event => set({ maxScore: Number(event.target.value) })} className={`${SELECT} w-20`} /></label>}
      </div>
      <label className="block">Other roles that may review (comma-separated, e.g. hod)
        <input value={policy.reviewerRolesText ?? policy.reviewerRoles.join(', ')} onChange={event => set({ reviewerRolesText: event.target.value })} className={`${SELECT} mt-1 w-full`} />
      </label>
      <label className="block">Extra submission types (one per line)
        <textarea rows={2} value={policy.customTypesText ?? policy.customTypes.map(type => type.label).join('\n')} onChange={event => set({ customTypesText: event.target.value, customTypes: event.target.value.split('\n').map(label => ({ label })) })} className={`${SELECT} mt-1 w-full`} />
      </label>
      <label className="block">What the AI preliminary review checks (one per line)
        <textarea rows={3} value={policy.aiCriteriaText ?? policy.aiCriteria.join('\n')} onChange={event => set({ aiCriteriaText: event.target.value, aiCriteria: event.target.value.split('\n') })} className={`${SELECT} mt-1 w-full`} />
      </label>
      <label className="flex items-center gap-2"><input type="checkbox" checked={policy.allowEditBeforeReview} onChange={event => set({ allowEditBeforeReview: event.target.checked })} /> Teachers may edit work before it is reviewed</label>
      <label className="flex items-center gap-2"><input type="checkbox" checked={policy.allowDeleteBeforeReview} onChange={event => set({ allowDeleteBeforeReview: event.target.checked })} /> Teachers may withdraw work before it is reviewed</label>
      {message && <p role="status" className="font-semibold text-[#1a5c38]">{message}</p>}
      <button type="button" disabled={busy} onClick={save} className="rounded-2xl bg-[#1a5c38] px-4 py-2 font-bold text-[#b5e3f4] disabled:opacity-50">{busy ? 'Saving…' : 'Save rules'}</button>
    </div>
  );
}

export default function SubmissionReviewPage({ dashboardLabel = 'Dashboard' }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const classId = searchParams.get('classId') || '';
  const [config, setConfig] = useState(null);
  const [classes, setClasses] = useState([]);
  const [overview, setOverview] = useState([]);
  const [board, setBoard] = useState(null);
  // scope: 'all' (every term, including work from before the calendar was set up), 'session' or 'term'.
  const [filters, setFilters] = useState({ scope: 'all', teacherId: '', subjectId: '', type: '', weekNumber: '', status: '', from: '', to: '' });
  const [openId, setOpenId] = useState('');
  const [showRules, setShowRules] = useState(false);
  // Teachers also submit lesson plans on their Lesson Plans page (a separate, older store): reviewed here too.
  const [view, setView] = useState('work');
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([getSubmissionConfig(), getAssignedClasses()])
      .then(([cfg, assigned]) => { setConfig(cfg); setClasses(assigned?.classes || []); })
      .catch(err => setError(err.message));
  }, []);
  useEffect(() => {
    getReviewBoard({ scope: filters.scope, from: filters.from, to: filters.to }).then(summary => setOverview(summary.classes || [])).catch(err => setError(err.message));
  }, [filters.scope, filters.from, filters.to]);

  const loadBoard = useCallback(() => {
    if (!classId) { setBoard(null); return; }
    getReviewBoard({ classId, ...filters }).then(setBoard).catch(err => setError(err.message));
  }, [classId, filters]);
  useEffect(() => { loadBoard(); }, [loadBoard]);

  const grouped = useMemo(() => {
    const groups = new Map();
    for (const item of board?.submissions || []) {
      const key = `${item.subjectName} · ${item.teacherName} · ${item.typeLabel}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    }
    return [...groups.entries()];
  }, [board]);

  const counts = id => overview.find(item => item.classId === id);
  const teachers = [...new Map((board?.submissions || []).map(item => [item.teacherId, item.teacherName])).entries()];
  const subjects = [...new Map((board?.submissions || []).map(item => [item.subjectId, item.subjectName])).entries()];

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-4 sm:p-8">
      <section className={CARD}>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#800020]">{dashboardLabel}</p>
        <h1 className="text-2xl font-black text-[#800000] dark:text-white">Teacher Submissions</h1>
        <p className="mt-1 text-sm text-[#191970] dark:text-slate-300">{config?.period?.sessionName} {config?.period?.termName ? `· ${config.period.termName}` : ''} — choose a class to review its work.</p>
        <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label="Which work">
          {[['all', 'Everything'], ['session', 'This session'], ['term', 'This term']].map(([key, label]) => (
            <button key={key} type="button" onClick={() => setFilters(current => ({ ...current, scope: key }))} className={`rounded-xl px-3 py-1.5 text-sm font-bold ${filters.scope === key ? 'bg-[#800020] text-[#b5e3f4]' : 'bg-white text-[#800020]'}`}>{label}</button>
          ))}
          <label className="text-xs font-bold text-[#800020]">From <input aria-label="From date" type="date" value={filters.from} onChange={event => setFilters(current => ({ ...current, from: event.target.value }))} className={SELECT} /></label>
          <label className="text-xs font-bold text-[#800020]">To <input aria-label="To date" type="date" value={filters.to} onChange={event => setFilters(current => ({ ...current, to: event.target.value }))} className={SELECT} /></label>
        </div>
        {config?.canConfigure && <button type="button" onClick={() => setShowRules(value => !value)} className="mt-3 rounded-2xl border border-[#c9a96e]/45 bg-white px-3 py-1.5 text-sm font-bold text-[#191970]">{showRules ? 'Hide rules' : 'Submission rules'}</button>}
      </section>
      <nav className="flex flex-wrap gap-1.5" aria-label="What to review">
        {[['work', 'Submitted work'], ['lessonPlans', 'Lesson plans (Lesson Plans page)']].map(([key, label]) => (
          <button key={key} type="button" onClick={() => setView(key)} className={`rounded-xl px-3 py-1.5 text-sm font-bold ${view === key ? 'bg-[#800020] text-[#b5e3f4]' : 'bg-white text-[#800020]'}`}>{label}</button>
        ))}
      </nav>
      {view === 'lessonPlans' ? <LessonPlanReviewPage dashboardLabel={dashboardLabel} /> : (
      <>
      {error && <p role="alert" className="font-semibold text-red-700">{error}</p>}
      {showRules && config && <PolicyEditor config={config} onSaved={result => setConfig(current => ({ ...current, policy: result.policy, types: result.types }))} />}

      <section className={CARD} aria-label="Classes">
        <div className="flex flex-wrap gap-2">
          {classes.map(item => {
            const summary = counts(item.id);
            const selected = item.id === classId;
            return (
              <button key={item.id} type="button" onClick={() => setSearchParams(selected ? {} : { classId: item.id })}
                className={`rounded-2xl px-4 py-2 text-left text-sm font-bold ${selected ? 'bg-[#800020] text-[#b5e3f4]' : 'bg-white text-[#191970]'}`}>
                {item.className || item.name}
                {summary ? <span className="block text-[11px] font-semibold opacity-80">{summary.awaitingReview} awaiting · {summary.approved} approved</span> : <span className="block text-[11px] font-semibold opacity-60">No submissions</span>}
              </button>
            );
          })}
        </div>
      </section>

      {classId && board && (
        <>
          <section className="grid grid-cols-2 gap-3 md:grid-cols-6" aria-label="Summary">
            <Tile label="Submitted" value={board.summary.submittedTeachers.length} />
            <Tile label="Not submitted" value={board.summary.notSubmittedTeachers.length} tone="text-[#800000]" />
            <Tile label="Late" value={board.summary.late.length} tone="text-amber-700" />
            <Tile label="Awaiting review" value={board.summary.awaitingReview} tone="text-[#2447d8]" />
            <Tile label="Returned" value={board.summary.returnedAwaitingResubmission} tone="text-rose-700" />
            <Tile label="Approved" value={board.summary.approved} tone="text-[#1a5c38]" />
          </section>

          {(board.summary.notSubmittedTeachers.length > 0 || board.summary.missing.length > 0 || board.summary.late.length > 0) && (
            <section className={`${CARD} space-y-2 text-sm text-[#191970] dark:text-slate-200`} aria-label="Missing and late work">
              {board.summary.notSubmittedTeachers.length > 0 && <p><strong>No submissions this term:</strong> {board.summary.notSubmittedTeachers.map(item => item.teacherName).join(', ')}</p>}
              {board.summary.missing.length > 0 && (
                <details><summary className="cursor-pointer font-bold">Missing required work ({board.summary.missing.length})</summary>
                  <ul className="mt-1 list-disc pl-5">{board.summary.missing.map((item, index) => <li key={index}>{item.teacherName} — {item.subjectName} — {config?.types.find(type => type.key === item.type)?.label || item.type}{item.weekNumber ? ` Week ${item.weekNumber}` : ''} (due {item.dueDate})</li>)}</ul>
                </details>
              )}
              {board.summary.late.length > 0 && (
                <details><summary className="cursor-pointer font-bold">Late ({board.summary.late.length})</summary>
                  <ul className="mt-1 list-disc pl-5">{board.summary.late.map((item, index) => <li key={index}>{item.teacherName} — {item.subjectName}{item.weekNumber ? ` Week ${item.weekNumber}` : ''}: due {item.dueDate}, submitted {item.submittedAt.slice(0, 10)}</li>)}</ul>
                </details>
              )}
            </section>
          )}

          <section className={`${CARD} space-y-3`} aria-label="Submissions">
            <div className="flex flex-wrap gap-2">
              <select aria-label="Teacher" value={filters.teacherId} onChange={event => setFilters(current => ({ ...current, teacherId: event.target.value }))} className={SELECT}><option value="">All teachers</option>{teachers.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>
              <select aria-label="Subject" value={filters.subjectId} onChange={event => setFilters(current => ({ ...current, subjectId: event.target.value }))} className={SELECT}><option value="">All subjects</option>{subjects.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>
              <select aria-label="Type" value={filters.type} onChange={event => setFilters(current => ({ ...current, type: event.target.value }))} className={SELECT}><option value="">All types</option>{config?.types.map(type => <option key={type.key} value={type.key}>{type.label}</option>)}</select>
              <input aria-label="Week" type="number" min="1" placeholder="Week" value={filters.weekNumber} onChange={event => setFilters(current => ({ ...current, weekNumber: event.target.value }))} className={`${SELECT} w-24`} />
              <select aria-label="Status" value={filters.status} onChange={event => setFilters(current => ({ ...current, status: event.target.value }))} className={SELECT}><option value="">All statuses</option>{Object.entries(STATUS_LABELS).filter(([key]) => key !== 'draft').map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
            </div>
            {grouped.length === 0 ? <p className="text-sm text-[#191970] dark:text-slate-300">No submissions match.</p> : grouped.map(([label, items]) => (
              <div key={label}>
                <h3 className="mb-1 text-sm font-bold text-[#800000] dark:text-white">{label}</h3>
                <ul className="space-y-1">
                  {items.map(item => (
                    <li key={item.id}>
                      <button type="button" onClick={() => setOpenId(item.id)} className="flex w-full flex-wrap items-center gap-2 rounded-xl bg-white px-3 py-2 text-left text-sm text-[#191970] hover:ring-2 hover:ring-[#2447d8] dark:bg-slate-900 dark:text-slate-100">
                        <span className="font-semibold">{item.periodLabel || item.title}</span>
                        {filters.scope !== 'term' && (item.termName || item.sessionName) ? <span className="text-xs text-[#800020]">{[item.sessionName, item.termName].filter(Boolean).join(' · ')}</span> : null}
                        <StatusBadge status={item.status} />
                        <span className="text-xs text-slate-500">{item.submittedAt ? new Date(item.submittedAt).toLocaleString() : ''}{item.version > 1 ? ` · v${item.version}` : ''}{item.reviewedByName ? ` · ${item.reviewedByName}` : ''}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        </>
      )}
      </>
      )}
      {openId && <SubmissionDetail id={openId} mode="review" onClose={() => setOpenId('')} onChanged={loadBoard} />}
    </div>
  );
}
