import React, { useCallback, useEffect, useState } from 'react';
import StudentSectionShell from '../../app/roles/student/StudentSectionShell';
import { generateClassReportSummary, getMyClassReport, saveMyClassReport, submitMyClassReport, uploadComplianceFile } from './complianceApi';
import { BODY, CARD, HEADING, INPUT, LABEL, PRIMARY, SECONDARY } from './complianceUi';

function Answer({ question, value, onChange, students, readOnly }) {
  const common = { id: `q-${question.id}`, disabled: readOnly };
  if (question.type === 'long') return <textarea {...common} rows={3} value={value || ''} onChange={event => onChange(event.target.value)} className={`${INPUT} w-full`} />;
  if (question.type === 'number') return <input {...common} type="number" value={value ?? ''} onChange={event => onChange(event.target.value)} className={`${INPUT} w-40`} />;
  if (question.type === 'yesno') {
    return (
      <div className="flex gap-4" role="radiogroup" aria-labelledby={`label-${question.id}`}>
        {['Yes', 'No'].map(option => (
          <label key={option} className={`flex items-center gap-1 text-sm ${BODY}`}>
            <input type="radio" name={`q-${question.id}`} disabled={readOnly} checked={value === option} onChange={() => onChange(option)} /> {option}
          </label>
        ))}
      </div>
    );
  }
  if (question.type === 'choice') {
    return (
      <select {...common} value={value || ''} onChange={event => onChange(event.target.value)} className={INPUT}>
        <option value="">Choose…</option>
        {(question.options || []).map(option => <option key={option} value={option}>{option}</option>)}
      </select>
    );
  }
  if (question.type === 'students') {
    const chosen = new Set(Array.isArray(value) ? value : [])
    return (
      <div className="flex max-h-48 flex-wrap gap-2 overflow-y-auto" role="group" aria-labelledby={`label-${question.id}`}>
        {students.length === 0 && <p className={`text-sm ${BODY}`}>No students in this class yet.</p>}
        {students.map(student => (
          <label key={student.id} className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${chosen.has(student.id) ? 'border-[#1a5c38] bg-[#1a5c38]/10' : 'border-[#c9a96e]/45'} ${BODY}`}>
            <input type="checkbox" disabled={readOnly} checked={chosen.has(student.id)} onChange={event => {
              const next = new Set(chosen);
              if (event.target.checked) next.add(student.id); else next.delete(student.id);
              onChange([...next]);
            }} />
            {student.name}
          </label>
        ))}
      </div>
    );
  }
  if (question.type === 'file') {
    const files = Array.isArray(value) ? value : [];
    return (
      <div className="space-y-1">
        {files.map(file => <a key={file.url} href={file.url} target="_blank" rel="noreferrer" className="block text-sm underline">{file.name}</a>)}
        {!readOnly && <input type="file" aria-label={question.label} onChange={async event => {
          const file = event.target.files?.[0];
          if (file) onChange([...files, await uploadComplianceFile(file)]);
        }} className="text-sm" />}
      </div>
    );
  }
  return <input {...common} value={value || ''} onChange={event => onChange(event.target.value)} className={`${INPUT} w-full`} />;
}

export default function ClassReportPage() {
  const [classId, setClassId] = useState('');
  const [data, setData] = useState(null);
  const [answers, setAnswers] = useState({});
  const [summary, setSummary] = useState('');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(() => {
    getMyClassReport(classId ? { classId } : {})
      .then(next => {
        setData(next);
        setAnswers(next.report?.answers || {});
        setSummary(next.report?.summary || '');
        setError('');
      })
      .catch(err => setError(err.message));
  }, [classId]);
  useEffect(() => { load(); }, [load]);

  const report = data?.report;
  const submitted = report?.status === 'submitted';

  async function run(kind, action) {
    setBusy(kind); setError(''); setMessage('');
    try { await action(); } catch (err) { setError(err.message); } finally { setBusy(''); }
  }
  const save = () => run('save', async () => {
    const result = await saveMyClassReport({ classId: data.classId, answers, summary });
    setData(current => ({ ...current, report: result.report }));
    setMessage('Draft saved.');
    return result.report;
  });
  const generate = () => run('ai', async () => {
    const saved = await saveMyClassReport({ classId: data.classId, answers, summary });
    const result = await generateClassReportSummary(saved.report.id);
    setData(current => ({ ...current, report: result.report }));
    setSummary(result.report.aiSummary);
    setMessage('Ndovera AI wrote the report from your answers. Read it and correct anything before you submit.');
  });
  const submit = () => run('submit', async () => {
    if (!window.confirm('Submit this week\'s class report? It cannot be changed afterwards.')) return;
    const saved = await saveMyClassReport({ classId: data.classId, answers, summary });
    const result = await submitMyClassReport(saved.report.id, summary);
    setData(current => ({ ...current, report: result.report }));
    setMessage('Weekly class report submitted.');
  });

  return (
    <StudentSectionShell title="Weekly Class Report" dashboardLabel="Teacher Dashboard" subtitle="Answer the school's questions about your class. Ndovera AI can write them up as a report — your answers stay on record alongside it.">
      {error && <p role="alert" className="mb-3 text-sm font-semibold text-rose-700">{error}</p>}
      {message && <p role="status" className="mb-3 text-sm font-semibold text-emerald-700 dark:text-emerald-300">{message}</p>}
      {!data && !error && <p role="status" className={BODY}>Loading…</p>}
      {data && !data.classes.length && <p className={`${CARD} ${BODY}`}>Class reports are written by class teachers. You are not the class teacher of any class.</p>}
      {data && data.classes.length > 0 && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            {data.classes.length > 1 && (
              <label className={`text-sm ${BODY}`}>Class
                <select value={data.classId} onChange={event => setClassId(event.target.value)} className={`${INPUT} ml-2`}>
                  {data.classes.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </label>
            )}
            <span className={`text-sm font-semibold ${BODY}`}>{data.classes.find(item => item.id === data.classId)?.name} · {data.period?.label}</span>
            {submitted && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">✓ Submitted</span>}
          </div>

          <section className={`${CARD} space-y-4`}>
            <h2 className={`text-base font-black ${HEADING}`}>Your answers</h2>
            {data.questions.map(question => (
              <div key={question.id} className="space-y-1">
                <label id={`label-${question.id}`} htmlFor={`q-${question.id}`} className={`block text-sm font-semibold ${BODY}`}>
                  {question.label}{question.required && <span className="text-rose-700"> *</span>}
                </label>
                <Answer question={question} value={answers[question.id]} students={data.students} readOnly={submitted}
                  onChange={value => setAnswers(current => ({ ...current, [question.id]: value }))} />
              </div>
            ))}
          </section>

          <section className={`${CARD} space-y-3`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className={`text-base font-black ${HEADING}`}>Report</h2>
              {!submitted && <button type="button" onClick={generate} disabled={Boolean(busy)} className={SECONDARY}>{busy === 'ai' ? 'Writing…' : '✨ Write it up with Ndovera AI'}</button>}
            </div>
            <p className={LABEL}>The report management reads, alongside your answers. Edit it freely.</p>
            <textarea rows={12} value={summary} readOnly={submitted} onChange={event => setSummary(event.target.value)} aria-label="Report" className={`${INPUT} w-full font-mono text-[13px] leading-6`} placeholder="Write a short report yourself, or let Ndovera AI draft one from your answers." />
            {!submitted && (
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={save} disabled={Boolean(busy)} className={SECONDARY}>{busy === 'save' ? 'Saving…' : 'Save draft'}</button>
                <button type="button" onClick={submit} disabled={Boolean(busy)} className={PRIMARY}>{busy === 'submit' ? 'Submitting…' : 'Submit report'}</button>
              </div>
            )}
          </section>
        </div>
      )}
    </StudentSectionShell>
  );
}
