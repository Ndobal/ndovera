import React, { useCallback, useEffect, useMemo, useState } from 'react';
import StudentSectionShell from '../../app/roles/student/StudentSectionShell';
import MaterialViewer from '../classroom/materials/MaterialViewer';
import { getAssignedClasses } from '../classroom/classroomService';
import SubmissionDetail, { StatusBadge } from './SubmissionDetail';
import {
  STATUS_LABELS, createSubmission, createSubmissionBatch, getMySubmissions, getSubmissionConfig,
  getSubmissionResources, uploadSubmissionFile,
} from './submissionsApi';

// Teacher: Prepare → choose type → class/subject → week(s) → upload/write →
// submit → track the review → correct → resubmit → approved.

const FIELD = 'mt-1 w-full rounded-xl border border-[#c9a96e]/45 bg-white px-3 py-2 text-sm text-[#191970] dark:border-white/10 dark:bg-slate-900 dark:text-white';
const LABEL = 'block text-xs font-bold uppercase tracking-[0.1em] text-[#800020] dark:text-slate-300';
const CARD = 'rounded-3xl border border-[#c9a96e]/40 bg-[#b5e3f4] p-5 dark:border-white/10 dark:bg-slate-900/40';

function FilePicker({ files, onChange, disabled }) {
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState('');
  async function add(list) {
    setError('');
    const picked = Array.from(list || []);
    setUploading(count => count + picked.length);
    // Each file uploads on its own; one failure does not lose the others.
    const results = await Promise.all(picked.map(file => uploadSubmissionFile(file).then(saved => saved, err => { setError(`${file.name}: ${err.message}`); return null; })));
    setUploading(count => count - picked.length);
    onChange(current => [...current, ...results.filter(Boolean)]);
  }
  return (
    <div className="space-y-2">
      <label className="inline-flex cursor-pointer items-center rounded-2xl border border-[#c9a96e]/45 bg-white px-3 py-2 text-sm font-semibold text-[#191970] dark:bg-slate-900 dark:text-white">
        <input type="file" multiple className="hidden" disabled={disabled} onChange={event => { add(event.target.files); event.target.value = ''; }} />
        📎 Attach files
      </label>
      {uploading > 0 && <span role="status" className="ml-2 text-xs text-[#2447d8]">Uploading {uploading}…</span>}
      {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
      {files.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {files.map((file, index) => (
            <li key={`${file.url}-${index}`} className="flex items-center gap-1 rounded-xl bg-white px-2 py-1 text-xs text-[#191970] dark:bg-slate-900 dark:text-white">
              {file.name}
              <button type="button" disabled={disabled} onClick={() => onChange(current => current.filter((_, position) => position !== index))} aria-label={`Remove ${file.name}`} className="font-bold text-red-700">×</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** What the teacher may need while preparing: current materials, topics, earlier approved work. */
function ResourcePanel({ classId, subjectId, type }) {
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(null);
  useEffect(() => {
    if (!classId || !subjectId) { setData(null); return; }
    let cancelled = false;
    getSubmissionResources({ classId, subjectId, type }).then(result => { if (!cancelled) setData(result); }).catch(() => { if (!cancelled) setData(null); });
    return () => { cancelled = true; };
  }, [classId, subjectId, type]);
  if (!classId || !subjectId) return <p className="text-sm text-[#191970] dark:text-slate-300">Choose a class and subject to see its current materials and earlier approved work here.</p>;
  if (!data) return <p role="status" className="text-sm">Loading resources…</p>;
  return (
    <div className="space-y-4 text-sm text-[#191970] dark:text-slate-200">
      <section>
        <h3 className={LABEL}>Topics</h3>
        {data.topics.length ? <p className="mt-1">{data.topics.map(topic => `${topic.name}${topic.week ? ` (${topic.week})` : ''}`).join(' · ')}</p> : <p className="mt-1 text-slate-500">No topics yet.</p>}
      </section>
      <section>
        <h3 className={LABEL}>Current class materials</h3>
        {data.materials.length ? (
          <ul className="mt-1 space-y-1">{data.materials.slice(0, 15).map(item => <li key={item.id}><button type="button" onClick={() => setOpen(item)} className="text-left font-semibold hover:underline">{item.title}</button>{item.topic ? <span className="text-xs text-slate-500"> · {item.topic}</span> : null}</li>)}</ul>
        ) : <p className="mt-1 text-slate-500">None this term.</p>}
      </section>
      <section>
        <h3 className={LABEL}>Previously approved</h3>
        {data.previousApproved.length ? (
          <ul className="mt-1 space-y-1">
            {data.previousApproved.map(item => (
              <li key={item.id}>
                <details>
                  <summary className="cursor-pointer font-semibold">{item.title} <span className="text-xs font-normal text-slate-500">{item.termName}{item.mine ? ' · yours' : ` · ${item.teacherName}`}</span></summary>
                  <p className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded-xl bg-white p-2 text-xs dark:bg-slate-900">{item.content || 'Files only.'}</p>
                </details>
              </li>
            ))}
          </ul>
        ) : <p className="mt-1 text-slate-500">No approved work of this type yet.</p>}
      </section>
      {open && <MaterialViewer material={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function SubmitWork({ config, classes, onSubmitted }) {
  const [classId, setClassId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [type, setType] = useState('lesson_plan');
  const [otherLabel, setOtherLabel] = useState('');
  const [bulk, setBulk] = useState(false);
  const [weekFrom, setWeekFrom] = useState('1');
  const [weekTo, setWeekTo] = useState('4');
  const [single, setSingle] = useState({ weekNumber: '', title: '', content: '' });
  const [singleFiles, setSingleFiles] = useState([]);
  const [rows, setRows] = useState({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const subjects = classes.find(item => String(item.id) === classId)?.subjects || [];
  const weeks = useMemo(() => {
    const from = Math.max(1, Number(weekFrom) || 1);
    const to = Math.min(from + 19, Math.max(from, Number(weekTo) || from));
    return Array.from({ length: to - from + 1 }, (_, index) => from + index);
  }, [weekFrom, weekTo]);
  const row = week => rows[week] || { content: '', files: [] };
  const setRow = (week, patch) => setRows(current => ({ ...current, [week]: { ...row(week), ...(typeof patch === 'function' ? patch(row(week)) : patch) } }));

  async function save(submit) {
    setBusy(true); setMessage('');
    try {
      if (bulk) {
        const result = await createSubmissionBatch({
          classId, subjectId, type, otherLabel, submit,
          items: weeks.map(week => ({ weekNumber: week, content: row(week).content, files: row(week).files })),
        });
        const failed = result.results.filter(item => !item.ok);
        setMessage(failed.length
          ? `${result.results.length - failed.length} saved; ${failed.map(item => `Week ${item.weekNumber}: ${item.message}`).join(' · ')}`
          : `${weeks.length} weeks ${submit ? 'submitted' : 'saved as drafts'} — each is reviewed separately.`);
        if (!failed.length) setRows({});
      } else {
        await createSubmission({ classId, subjectId, type, otherLabel, weekNumber: single.weekNumber, title: single.title, content: single.content, files: singleFiles, submit });
        setMessage(submit ? 'Submitted. You can follow its review under My Submissions.' : 'Saved as a draft.');
        setSingle({ weekNumber: '', title: '', content: '' });
        setSingleFiles([]);
      }
      onSubmitted();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <form onSubmit={event => { event.preventDefault(); save(true); }} className={`${CARD} space-y-3`}>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={LABEL}>Class
            <select required value={classId} onChange={event => { setClassId(event.target.value); setSubjectId(''); }} className={FIELD}>
              <option value="">Choose a class</option>
              {classes.map(item => <option key={item.id} value={item.id}>{item.className || item.name}</option>)}
            </select>
          </label>
          <label className={LABEL}>Subject
            <select required value={subjectId} disabled={!classId} onChange={event => setSubjectId(event.target.value)} className={FIELD}>
              <option value="">Choose a subject</option>
              {subjects.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <label className={LABEL}>What are you submitting?
            <select value={type} onChange={event => setType(event.target.value)} className={FIELD}>
              {config.types.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}
            </select>
          </label>
          {type === 'other' && <label className={LABEL}>Describe it<input required value={otherLabel} onChange={event => setOtherLabel(event.target.value)} placeholder="e.g. Project brief" className={FIELD} /></label>}
        </div>

        {type === 'exam_questions' ? (
          // Exam questions are prepared on the Exams page, where Ndovera turns them into a CBT and a print-ready paper.
          <div className="space-y-2 rounded-2xl border border-[#1a5c38]/30 bg-[#f4fbf7] p-4 text-sm text-[#191970]">
            <p className="font-bold">Exam questions are prepared on the Exams page.</p>
            <p>Write them with Ndovera AI, or type, paste or upload your own Word or PDF paper. Ndovera turns them into objective questions with an answer key and a print-ready theory section, then sends them here for approval — where the Head of School chooses printing or CBT and sets the time.</p>
            <a href="/roles/teacher/exams" className="inline-block rounded-2xl bg-[#1a5c38] px-4 py-2 font-bold text-[#b5e3f4]">Go to Exams</a>
          </div>
        ) : (
        <>
        <label className="flex items-center gap-2 text-sm font-semibold text-[#191970] dark:text-white">
          <input type="checkbox" checked={bulk} onChange={event => setBulk(event.target.checked)} /> Submit several weeks at once
        </label>

        {bulk ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-end gap-2">
              <label className={LABEL}>From week<input type="number" min="1" value={weekFrom} onChange={event => setWeekFrom(event.target.value)} className={`${FIELD} w-24`} /></label>
              <label className={LABEL}>To week<input type="number" min="1" value={weekTo} onChange={event => setWeekTo(event.target.value)} className={`${FIELD} w-24`} /></label>
              <p className="text-xs text-[#191970] dark:text-slate-300">Each week is saved and reviewed on its own.</p>
            </div>
            {weeks.map(week => (
              <fieldset key={week} className="space-y-2 rounded-2xl border border-[#c9a96e]/40 bg-white/60 p-3 dark:bg-slate-900/40">
                <legend className="px-1 text-sm font-bold text-[#800000] dark:text-white">Week {week}</legend>
                <textarea rows={4} aria-label={`Week ${week} work`} value={row(week).content} onChange={event => setRow(week, { content: event.target.value })} placeholder="Write or paste the work, or attach files." className={FIELD} />
                <FilePicker files={row(week).files} disabled={busy} onChange={update => setRow(week, current => ({ files: update(current.files) }))} />
              </fieldset>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
              <label className={LABEL}>Week<input type="number" min="1" value={single.weekNumber} onChange={event => setSingle(current => ({ ...current, weekNumber: event.target.value }))} className={FIELD} /></label>
              <label className={LABEL}>Title (optional)<input value={single.title} onChange={event => setSingle(current => ({ ...current, title: event.target.value }))} className={FIELD} /></label>
            </div>
            <label className={LABEL}>The work<textarea rows={10} value={single.content} onChange={event => setSingle(current => ({ ...current, content: event.target.value }))} placeholder="Write or paste the work here, or attach files below." className={FIELD} /></label>
            <FilePicker files={singleFiles} disabled={busy} onChange={setSingleFiles} />
          </div>
        )}

        {message && <p role="status" className="text-sm font-semibold text-[#1a5c38] dark:text-emerald-300">{message}</p>}
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy || !subjectId} onClick={() => save(false)} className="rounded-2xl border border-[#c9a96e]/45 bg-white px-4 py-2 text-sm font-bold text-[#191970] disabled:opacity-50">Save as draft</button>
          <button type="submit" disabled={busy || !subjectId} className="rounded-2xl bg-[#1a5c38] px-4 py-2 text-sm font-bold text-[#b5e3f4] disabled:opacity-50">{busy ? 'Saving…' : bulk ? `Submit ${weeks.length} weeks` : 'Submit'}</button>
        </div>
        </>
        )}
      </form>
      <aside className={CARD} aria-label="Resources for this work">
        <h2 className="mb-3 text-base font-black text-[#800000] dark:text-white">Resources</h2>
        <ResourcePanel classId={classId} subjectId={subjectId} type={type} />
      </aside>
    </div>
  );
}

function MySubmissions({ refreshKey, config }) {
  const [filters, setFilters] = useState({ status: '', type: '' });
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState('');
  const load = useCallback(() => {
    getMySubmissions(filters).then(data => setItems(data.submissions)).catch(err => setError(err.message));
  }, [filters]);
  useEffect(() => { load(); }, [load, refreshKey]);

  return (
    <div className={`${CARD} space-y-3`}>
      <div className="flex flex-wrap gap-2">
        <select aria-label="Filter by status" value={filters.status} onChange={event => setFilters(current => ({ ...current, status: event.target.value }))} className="rounded-xl border border-[#c9a96e]/45 bg-white p-2 text-sm text-[#191970]">
          <option value="">All statuses</option>
          {Object.entries(STATUS_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
        <select aria-label="Filter by type" value={filters.type} onChange={event => setFilters(current => ({ ...current, type: event.target.value }))} className="rounded-xl border border-[#c9a96e]/45 bg-white p-2 text-sm text-[#191970]">
          <option value="">All types</option>
          {config.types.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}
        </select>
      </div>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {!items ? <p role="status">Loading…</p> : items.length === 0 ? <p className="text-sm text-[#191970] dark:text-slate-300">Nothing here yet.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm text-[#191970] dark:text-slate-200">
            <thead><tr className="text-xs uppercase text-[#800020]"><th className="p-2">Type</th><th className="p-2">Class</th><th className="p-2">Subject</th><th className="p-2">Week</th><th className="p-2">Submitted</th><th className="p-2">Status</th><th className="p-2">Reviewer</th><th className="p-2">Feedback</th></tr></thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id} onClick={() => setOpenId(item.id)} className="cursor-pointer border-t border-[#c9a96e]/30 hover:bg-white/60 dark:hover:bg-slate-800">
                  <td className="p-2 font-semibold">{item.typeLabel}</td><td className="p-2">{item.className}</td><td className="p-2">{item.subjectName}</td>
                  <td className="p-2">{item.periodLabel || '—'}</td><td className="p-2">{item.submittedAt ? new Date(item.submittedAt).toLocaleDateString() : '—'}</td>
                  <td className="p-2"><StatusBadge status={item.status} /></td><td className="p-2">{item.reviewedByName || '—'}</td>
                  <td className="max-w-[16rem] truncate p-2">{item.feedback || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {openId && <SubmissionDetail id={openId} mode="teacher" onClose={() => setOpenId('')} onChanged={load} />}
    </div>
  );
}

export default function TeacherSubmissionsPage() {
  const [tab, setTab] = useState('submit');
  const [config, setConfig] = useState(null);
  const [classes, setClasses] = useState([]);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    Promise.all([getSubmissionConfig(), getAssignedClasses()])
      .then(([cfg, assigned]) => { setConfig(cfg); setClasses(assigned?.classes || []); })
      .catch(err => setError(err.message));
  }, []);

  return (
    <StudentSectionShell title="Submit Work" dashboardLabel="Teacher Dashboard"
      subtitle={config?.period?.termName ? `${config.period.sessionName} · ${config.period.termName}` : 'Submit lesson plans, notes, questions and other work for review.'}>
      {error && <p role="alert" className="mb-4 text-red-700">{error}</p>}
      <div className="mb-4 flex gap-2">
        {[['submit', 'Submit Work'], ['mine', 'My Submissions']].map(([key, label]) => (
          <button key={key} type="button" onClick={() => setTab(key)} className={`rounded-2xl px-4 py-2 text-sm font-bold ${tab === key ? 'bg-[#800020] text-[#b5e3f4]' : 'bg-white text-[#800020]'}`}>{label}</button>
        ))}
      </div>
      {!config ? (!error && <p role="status">Loading…</p>) : tab === 'submit'
        ? <SubmitWork config={config} classes={classes} onSubmitted={() => setRefreshKey(key => key + 1)} />
        : <MySubmissions config={config} refreshKey={refreshKey} />}
    </StudentSectionShell>
  );
}
