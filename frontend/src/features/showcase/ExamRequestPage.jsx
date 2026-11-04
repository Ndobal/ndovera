import React, { useCallback, useEffect, useState } from 'react';
import { getMyExamRequests, sendExamRequest } from './showcaseApi';

// Ask Ndovera for an exam it doesn't have yet, and send the curriculum to build it from.

const CARD = 'rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900';
const FIELD = 'mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-white/20 dark:bg-slate-800 dark:text-white';
const LABEL = 'block text-sm font-bold text-slate-800 dark:text-slate-100';
const BODY = 'text-sm text-slate-700 dark:text-slate-200';
const STATUS = { new: 'Received', reviewing: 'Ndovera is reading the curriculum', building: 'Being built', ready: 'Ready', declined: 'Not going ahead' };
const EMPTY = { examName: '', scope: 'country', country: '', section: 'senior', subjects: '', curriculumLink: '', curriculumNote: '' };

export default function ExamRequestPage() {
  const [form, setForm] = useState(EMPTY);
  const [file, setFile] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const [mine, setMine] = useState(null);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => getMyExamRequests().then(result => setMine(result.requests)).catch(error => setNotice(error.message)), []);
  useEffect(() => { load(); }, [load]);
  const set = key => event => setForm(current => ({ ...current, [key]: event.target.value }));

  const send = async event => {
    event.preventDefault();
    setBusy(true);
    setNotice('');
    try {
      const data = new FormData();
      Object.entries(form).forEach(([key, value]) => data.append(key, value));
      data.append('confirmed', String(confirmed));
      if (file) data.append('file', file);
      const result = await sendExamRequest(data);
      setNotice(result.message);
      setForm(EMPTY);
      setFile(null);
      setConfirmed(false);
      event.target.reset();
      await load();
    } catch (error) { setNotice(error.message); } finally { setBusy(false); }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4 md:p-8">
      <section className={CARD}>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">Request an exam</h1>
        <p className={`mt-1 ${BODY}`}>Don't see your exam in practice? Tell us which one and send its curriculum. Ndovera reads every request and tells you here what happens next.</p>
      </section>
      {notice ? <p role="status" className="rounded-2xl bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-900 dark:bg-indigo-500/15 dark:text-indigo-100">{notice}</p> : null}
      <form onSubmit={send} className={`${CARD} space-y-4`} aria-label="Exam request">
        <label className={LABEL}>Name of the exam
          <input className={FIELD} value={form.examName} onChange={set('examName')} placeholder="For example KCSE or BECE Ghana" />
        </label>
        <fieldset>
          <legend className={LABEL}>Who is this exam for?</legend>
          <label className={`mt-1 flex items-center gap-2 ${BODY}`}><input type="radio" name="scope" value="country" checked={form.scope === 'country'} onChange={set('scope')} /> Students in one country</label>
          <label className={`mt-1 flex items-center gap-2 ${BODY}`}><input type="radio" name="scope" value="global" checked={form.scope === 'global'} onChange={set('scope')} /> Students anywhere, like the current exams</label>
        </fieldset>
        {form.scope === 'country' ? <label className={LABEL}>Country<input className={FIELD} value={form.country} onChange={set('country')} /></label> : null}
        <label className={LABEL}>Level
          <select className={FIELD} value={form.section} onChange={set('section')}>
            <option value="primary">Primary</option><option value="junior">Junior secondary</option><option value="senior">Senior secondary</option><option value="other">Other</option>
          </select>
        </label>
        <label className={LABEL}>Subjects<input className={FIELD} value={form.subjects} onChange={set('subjects')} placeholder="For example Mathematics, English, Biology" /></label>
        <label className={LABEL}>Curriculum file (PDF, Word, text or photo, up to 10 MB)
          <input type="file" accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png" className={FIELD} onChange={event => setFile(event.target.files?.[0] || null)} />
        </label>
        <label className={LABEL}>Or a link to it<input className={FIELD} value={form.curriculumLink} onChange={set('curriculumLink')} placeholder="https://" /></label>
        <label className={LABEL}>Or type the topics
          <textarea className={FIELD} rows={4} maxLength={4000} value={form.curriculumNote} onChange={set('curriculumNote')} />
        </label>
        <label className={`flex items-start gap-2 ${BODY}`}><input type="checkbox" className="mt-1" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} /> Ndovera may use this curriculum to write practice questions, and I am allowed to share it</label>
        <button type="submit" disabled={busy} className="rounded-2xl bg-indigo-700 px-4 py-2 text-sm font-black text-white disabled:opacity-50">{busy ? 'Sending…' : 'Send request'}</button>
      </form>
      <section className={`${CARD} space-y-2`} aria-label="Your requests">
        <h2 className="font-black text-slate-900 dark:text-white">Your requests</h2>
        {!mine ? <p role="status" className={BODY}>Loading…</p> : mine.length ? (
          <ul className="space-y-2">
            {mine.map(item => (
              <li key={item.id} className="rounded-2xl bg-slate-100 p-3 dark:bg-white/5">
                <p className="text-sm font-bold text-slate-900 dark:text-white">{item.examName}{item.country ? ` · ${item.country}` : ''}</p>
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">{STATUS[item.status] || item.status}</p>
                {item.note ? <p className={`mt-1 ${BODY}`}>{item.note}</p> : null}
              </li>
            ))}
          </ul>
        ) : <p className={BODY}>No requests yet.</p>}
      </section>
    </div>
  );
}
