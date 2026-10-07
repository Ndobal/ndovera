import React, { useCallback, useEffect, useState } from 'react';
import AiAnswer from '../ai/AiAnswer';
import {
  EVALUATION_STATUS, closeEvaluation, createEvaluation, getEvaluationResults, getMyEvaluations, listEvaluations,
  submitEvaluationResponse, summariseStaffFeedback, updateEvaluation,
} from './evaluationsApi';

// Staff evaluation. Management configures and reads aggregated, anonymous
// results; staff answer for colleagues. See staffEvaluations.ts in the Worker.

const CARD = 'rounded-3xl border border-[#c9a96e]/40 bg-[#b5e3f4] p-5 dark:border-white/10 dark:bg-slate-900/40';
const FIELD = 'mt-1 w-full rounded-xl border border-[#c9a96e]/45 bg-white px-3 py-2 text-sm text-[#191970] dark:border-white/10 dark:bg-slate-900 dark:text-white';
const LABEL = 'block text-xs font-bold uppercase tracking-[0.1em] text-[#800020] dark:text-slate-300';
const BTN = 'rounded-2xl px-4 py-2 text-sm font-bold disabled:opacity-50';

function StatusPill({ status }) {
  const style = EVALUATION_STATUS[status] || EVALUATION_STATUS.not_started;
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${style.className}`}>{style.label}</span>;
}

const toLocal = iso => { if (!iso) return ''; const date = new Date(iso); return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
const blank = () => ({
  title: '', periodLabel: '', questions: [{ id: 'q1', text: '', kind: 'rating' }], scale: { min: 1, max: 5 },
  reviewers: { mode: 'all', roles: [], people: [] }, subjects: { mode: 'all', roles: [], people: [] }, opensAt: '', closesAt: '',
});

function EligibilityField({ label, value, onChange, staff }) {
  const roles = [...new Set(staff.flatMap(person => person.roles))].sort();
  return (
    <fieldset className="space-y-1">
      <legend className={LABEL}>{label}</legend>
      <select value={value.mode} onChange={event => onChange({ ...value, mode: event.target.value })} className={FIELD}>
        <option value="all">All staff</option><option value="roles">Staff with these roles</option><option value="people">Chosen people</option>
      </select>
      {value.mode === 'roles' && (
        <div className="flex flex-wrap gap-2 text-sm text-[#191970] dark:text-white">
          {roles.map(role => (
            <label key={role} className="flex items-center gap-1"><input type="checkbox" checked={value.roles.includes(role)} onChange={event => onChange({ ...value, roles: event.target.checked ? [...value.roles, role] : value.roles.filter(item => item !== role) })} />{role}</label>
          ))}
        </div>
      )}
      {value.mode === 'people' && (
        <div className="max-h-40 overflow-auto rounded-xl bg-white p-2 text-sm text-[#191970] dark:bg-slate-900 dark:text-white">
          {staff.map(person => (
            <label key={person.id} className="flex items-center gap-1"><input type="checkbox" checked={value.people.includes(person.id)} onChange={event => onChange({ ...value, people: event.target.checked ? [...value.people, person.id] : value.people.filter(item => item !== person.id) })} />{person.name}</label>
          ))}
        </div>
      )}
    </fieldset>
  );
}

function EvaluationForm({ initial, staff, onSaved, onCancel }) {
  const [form, setForm] = useState(() => (initial ? { ...initial, opensAt: toLocal(initial.opensAt), closesAt: toLocal(initial.closesAt) } : blank()));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = patch => setForm(current => ({ ...current, ...patch }));
  const setQuestion = (index, patch) => set({ questions: form.questions.map((question, position) => (position === index ? { ...question, ...patch } : question)) });

  async function save(event) {
    event.preventDefault();
    setBusy(true); setError('');
    try {
      const payload = { ...form, opensAt: new Date(form.opensAt).toISOString(), closesAt: new Date(form.closesAt).toISOString() };
      const result = initial ? await updateEvaluation(initial.id, payload) : await createEvaluation(payload);
      onSaved(result.evaluation);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  return (
    <form onSubmit={save} className={`${CARD} space-y-3`}>
      <h2 className="text-lg font-black text-[#800000] dark:text-white">{initial ? 'Edit evaluation' : 'New evaluation'}</h2>
      {initial && <p className="text-xs text-[#191970] dark:text-slate-300">Once anyone has answered, only the closing date can change.</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={LABEL}>Title<input required value={form.title} onChange={event => set({ title: event.target.value })} className={FIELD} /></label>
        <label className={LABEL}>Evaluation period<input value={form.periodLabel} onChange={event => set({ periodLabel: event.target.value })} placeholder="e.g. First Term 2026/2027" className={FIELD} /></label>
        <label className={LABEL}>Opens<input required type="datetime-local" value={form.opensAt} onChange={event => set({ opensAt: event.target.value })} className={FIELD} /></label>
        <label className={LABEL}>Closes<input required type="datetime-local" value={form.closesAt} onChange={event => set({ closesAt: event.target.value })} className={FIELD} /></label>
      </div>
      <fieldset className="space-y-2">
        <legend className={LABEL}>Questions</legend>
        {form.questions.map((question, index) => (
          <div key={question.id} className="flex flex-wrap gap-2">
            <input aria-label={`Question ${index + 1}`} value={question.text} onChange={event => setQuestion(index, { text: event.target.value })} placeholder="e.g. Comes to class prepared" className={`${FIELD} mt-0 flex-1`} />
            <select aria-label={`Question ${index + 1} answer type`} value={question.kind} onChange={event => setQuestion(index, { kind: event.target.value })} className="rounded-xl border border-[#c9a96e]/45 bg-white p-2 text-sm text-[#191970]">
              <option value="rating">Rating</option><option value="comment">Written comment</option>
            </select>
            <button type="button" onClick={() => set({ questions: form.questions.filter((_, position) => position !== index) })} className="text-sm font-bold text-red-700">Remove</button>
          </div>
        ))}
        <button type="button" onClick={() => set({ questions: [...form.questions, { id: `q${Date.now()}`, text: '', kind: 'rating' }] })} className={`${BTN} border border-[#c9a96e]/45 bg-white text-[#191970]`}>+ Add question</button>
      </fieldset>
      <div className="flex flex-wrap items-end gap-3">
        <label className={LABEL}>Rating from<input type="number" min="0" max="9" value={form.scale.min} onChange={event => set({ scale: { ...form.scale, min: Number(event.target.value) } })} className={`${FIELD} w-24`} /></label>
        <label className={LABEL}>to<input type="number" min="1" max="10" value={form.scale.max} onChange={event => set({ scale: { ...form.scale, max: Number(event.target.value) } })} className={`${FIELD} w-24`} /></label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <EligibilityField label="Who reviews" value={form.reviewers} onChange={reviewers => set({ reviewers })} staff={staff} />
        <EligibilityField label="Who is evaluated" value={form.subjects} onChange={subjects => set({ subjects })} staff={staff} />
      </div>
      {error && <p role="alert" className="text-sm font-semibold text-red-700">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className={`${BTN} bg-[#1a5c38] text-[#b5e3f4]`}>{busy ? 'Saving…' : 'Save'}</button>
        <button type="button" onClick={onCancel} className={`${BTN} text-[#800020]`}>Cancel</button>
      </div>
    </form>
  );
}

function Results({ evaluation, onBack }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const load = useCallback(() => getEvaluationResults(evaluation.id).then(setData).catch(err => setError(err.message)), [evaluation.id]);
  useEffect(() => { load(); }, [load]);

  async function summarise(staffId) {
    setBusyId(staffId); setError('');
    try { await summariseStaffFeedback(evaluation.id, staffId); await load(); } catch (err) { setError(err.message); } finally { setBusyId(''); }
  }

  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className={`${BTN} bg-white text-[#800020]`}>← All evaluations</button>
      {error && <p role="alert" className="font-semibold text-red-700">{error}</p>}
      {!data ? <p role="status">Loading results…</p> : (
        <>
          <section className={CARD}>
            <h2 className="text-lg font-black text-[#800000] dark:text-white">{data.evaluation.title} <StatusPill status={data.evaluation.status} /></h2>
            <p className="mt-1 text-sm text-[#191970] dark:text-slate-300">
              Completion {data.completion.rate}% — {data.completion.responsesReceived} of {data.completion.responsesExpected} reviews in; {data.completion.reviewersFinished} of {data.completion.eligibleReviewers} reviewers finished. Individual reviewers are never shown.
            </p>
          </section>
          {data.staff.map(person => (
            <section key={person.staffId} className={`${CARD} space-y-2`} aria-label={person.name}>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="flex-1 text-base font-black text-[#800000] dark:text-white">{person.name}</h3>
                <span className="text-sm font-bold text-[#191970] dark:text-white">{person.overall != null ? `${person.overall} / ${data.evaluation.scale.max}` : 'No ratings yet'} · {person.responses} review{person.responses === 1 ? '' : 's'}</span>
              </div>
              <ul className="space-y-1 text-sm text-[#191970] dark:text-slate-200">
                {person.questions.map(question => question.kind === 'rating'
                  ? <li key={question.id}>{question.text}: <strong>{question.average ?? '—'}</strong></li>
                  : (
                    <li key={question.id}>
                      <details><summary className="cursor-pointer">{question.text} ({question.comments.length})</summary>
                        <ul className="mt-1 list-disc pl-5">{question.comments.map((comment, index) => <li key={index}>{comment}</li>)}</ul>
                      </details>
                    </li>
                  ))}
              </ul>
              {person.aiSummary
                ? <div className="rounded-2xl bg-white p-3 dark:bg-slate-900"><AiAnswer text={person.aiSummary.text} /><p className="mt-1 text-[11px] text-slate-500">AI summary of {person.aiSummary.responseCount} reviews · {new Date(person.aiSummary.generatedAt).toLocaleString()}. It uses only what reviewers wrote.</p></div>
                : null}
              {person.responses > 0 && <button type="button" disabled={busyId === person.staffId} onClick={() => summarise(person.staffId)} className={`${BTN} bg-[#2447d8] text-white`}>{busyId === person.staffId ? 'Summarising…' : person.aiSummary ? 'Summarise again' : 'AI summary'}</button>}
            </section>
          ))}
        </>
      )}
    </div>
  );
}

/** Owner / HOS: run evaluation exercises and read their results. */
export function StaffEvaluationAdminPage({ dashboardLabel = 'Dashboard' }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const load = useCallback(() => listEvaluations().then(setData).catch(err => setError(err.message)), []);
  useEffect(() => { load(); }, [load]);

  if (viewing) return <div className="mx-auto max-w-6xl p-4 sm:p-8"><Results evaluation={viewing} onBack={() => setViewing(null)} /></div>;

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-8">
      <section className={CARD}>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#800020]">{dashboardLabel}</p>
        <h1 className="text-2xl font-black text-[#800000] dark:text-white">Staff Evaluation</h1>
        <p className="mt-1 text-sm text-[#191970] dark:text-slate-300">Peer reviews close automatically at their deadline unless you extend them. Results never show who reviewed whom.</p>
        {!editing && <button type="button" onClick={() => setEditing('new')} className={`${BTN} mt-3 bg-[#1a5c38] text-[#b5e3f4]`}>+ New evaluation</button>}
      </section>
      {error && <p role="alert" className="font-semibold text-red-700">{error}</p>}
      {editing && data && <EvaluationForm initial={editing === 'new' ? null : editing} staff={data.staff} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
      {!data ? <p role="status">Loading…</p> : data.evaluations.length === 0 ? <p className="text-sm text-[#191970] dark:text-slate-300">No evaluations yet.</p> : (
        <ul className="space-y-3">
          {data.evaluations.map(evaluation => (
            <li key={evaluation.id} className={`${CARD} flex flex-wrap items-center gap-3`}>
              <div className="min-w-0 flex-1">
                <p className="font-black text-[#800000] dark:text-white">{evaluation.title} <StatusPill status={evaluation.status} /></p>
                <p className="text-xs text-[#191970] dark:text-slate-300">{evaluation.periodLabel} · {new Date(evaluation.opensAt).toLocaleString()} → {new Date(evaluation.closesAt).toLocaleString()} · {evaluation.completion.rate}% complete</p>
              </div>
              <button type="button" onClick={() => setViewing(evaluation)} className={`${BTN} bg-white text-[#191970]`}>Results</button>
              <button type="button" onClick={() => setEditing(evaluation)} className={`${BTN} bg-white text-[#191970]`}>{evaluation.status === 'closed' ? 'Extend' : 'Edit'}</button>
              {evaluation.status === 'open' && <button type="button" onClick={() => closeEvaluation(evaluation.id).then(load).catch(err => setError(err.message))} className={`${BTN} bg-[#800000] text-white`}>Close now</button>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Questionnaire({ evaluation, colleague, onDone, onCancel }) {
  const [answers, setAnswers] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { min, max } = evaluation.scale;
  const points = Array.from({ length: max - min + 1 }, (_, index) => min + index);

  async function submit(event) {
    event.preventDefault();
    setBusy(true); setError('');
    try { await submitEvaluationResponse(evaluation.id, { subjectId: colleague.id, answers }); onDone(); } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} className={`${CARD} space-y-4`}>
      <h2 className="text-lg font-black text-[#800000] dark:text-white">Reviewing {colleague.name}</h2>
      <p className="text-xs text-[#191970] dark:text-slate-300">Your answers are combined with others. Management never sees which answers are yours.</p>
      {evaluation.questions.map(question => (
        <fieldset key={question.id} className="space-y-1">
          <legend className="text-sm font-bold text-[#191970] dark:text-white">{question.text}</legend>
          {question.kind === 'rating' ? (
            <div className="flex flex-wrap gap-2">
              {points.map(point => (
                <label key={point} className={`cursor-pointer rounded-xl border px-3 py-1.5 text-sm font-bold ${answers[question.id] === point ? 'border-[#1a5c38] bg-[#1a5c38] text-[#b5e3f4]' : 'border-[#c9a96e]/45 bg-white text-[#191970]'}`}>
                  <input type="radio" name={question.id} value={point} className="sr-only" required onChange={() => setAnswers(current => ({ ...current, [question.id]: point }))} />{point}
                </label>
              ))}
            </div>
          ) : <textarea rows={3} aria-label={question.text} onChange={event => setAnswers(current => ({ ...current, [question.id]: event.target.value }))} className={FIELD} />}
        </fieldset>
      ))}
      {error && <p role="alert" className="text-sm font-semibold text-red-700">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className={`${BTN} bg-[#1a5c38] text-[#b5e3f4]`}>{busy ? 'Sending…' : 'Submit review'}</button>
        <button type="button" onClick={onCancel} className={`${BTN} text-[#800020]`}>Back</button>
      </div>
    </form>
  );
}

/** Any member of staff: the evaluations they are asked to complete. */
export function MyStaffEvaluationsPage({ dashboardLabel = 'Dashboard' }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [active, setActive] = useState(null);
  const load = useCallback(() => getMyEvaluations().then(setData).catch(err => setError(err.message)), []);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 sm:p-8">
      <section className={CARD}>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#800020]">{dashboardLabel}</p>
        <h1 className="text-2xl font-black text-[#800000] dark:text-white">Evaluate Colleagues</h1>
      </section>
      {error && <p role="alert" className="font-semibold text-red-700">{error}</p>}
      {active ? (
        <Questionnaire evaluation={active.evaluation} colleague={active.colleague} onCancel={() => setActive(null)} onDone={() => { setActive(null); load(); }} />
      ) : !data ? <p role="status">Loading…</p> : data.evaluations.length === 0 ? <p className="text-sm text-[#191970] dark:text-slate-300">There is nothing for you to complete right now.</p> : data.evaluations.map(evaluation => {
        const left = evaluation.colleagues.filter(colleague => !colleague.done).length;
        return (
          <section key={evaluation.id} className={`${CARD} space-y-2`}>
            <p className="font-black text-[#800000] dark:text-white">{evaluation.title} <StatusPill status={evaluation.status} /></p>
            <p className="text-xs text-[#191970] dark:text-slate-300">Closes {new Date(evaluation.closesAt).toLocaleString()} · {left} of {evaluation.colleagues.length} left</p>
            <ul className="grid gap-2 sm:grid-cols-2">
              {evaluation.colleagues.map(colleague => (
                <li key={colleague.id}>
                  <button type="button" disabled={colleague.done || evaluation.status !== 'open'} onClick={() => setActive({ evaluation, colleague })}
                    className="w-full rounded-2xl bg-white px-3 py-2 text-left text-sm font-semibold text-[#191970] disabled:opacity-60 dark:bg-slate-900 dark:text-white">
                    {colleague.done ? '✓ ' : ''}{colleague.name}{colleague.done ? ' — done' : evaluation.status !== 'open' ? ' — opens soon' : ''}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
