import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getStoredAuth } from '../auth/services/authApi';
import { getExamReadiness } from './materialAiApi';

// Exam Readiness: how a student stands against an examination specification,
// measured only from their marked work. Areas without marked work say so —
// Ndovera never guesses a score.

const CARD = 'rounded-3xl border border-[#c9a96e]/40 bg-[#b5e3f4] p-5 dark:border-white/10 dark:bg-slate-900/40';
const INNER = 'rounded-2xl bg-white p-4 dark:bg-slate-900';
const FIELD = 'rounded-xl border border-[#c9a96e]/45 bg-white p-2 text-sm text-[#191970] dark:border-white/15 dark:bg-slate-950 dark:text-slate-100';
const LABEL = 'text-[11px] font-bold uppercase tracking-[0.12em] text-[#800020] dark:text-slate-400';

function Bar({ percent }) {
  if (percent === null || percent === undefined) return <span className="text-xs font-semibold text-slate-500">Not yet assessed</span>;
  const tone = percent >= 70 ? 'bg-emerald-500' : percent >= 50 ? 'bg-amber-500' : 'bg-rose-500';
  return (
    <span className="flex items-center gap-2">
      <span className="h-3 w-40 overflow-hidden rounded-full bg-slate-200 sm:w-56" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}><span className={`block h-full ${tone}`} style={{ width: `${percent}%` }} /></span>
      <span className="w-10 text-right text-sm font-bold">{percent}%</span>
    </span>
  );
}

export default function ExamReadinessPage({ studentId = '' }) {
  const storedUser = getStoredAuth()?.user || JSON.parse(localStorage.getItem('authUser') || '{}');
  const classId = localStorage.getItem('classroomId') || storedUser?.classId || '';
  const [data, setData] = useState(null);
  const [choice, setChoice] = useState({ subjectId: '', exam: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!classId) return;
    setLoading(true);
    setError('');
    getExamReadiness({ classId, studentId, ...(choice.subjectId && choice.exam ? choice : {}) })
      .then(result => {
        setData(result);
        if (!choice.subjectId) {
          const first = result.options.find(option => option.exams.length);
          if (first) setChoice({ subjectId: first.subjectId, exam: first.exams[0].key });
        }
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [classId, studentId, choice.subjectId, choice.exam]); // eslint-disable-line react-hooks/exhaustive-deps

  const available = (data?.options || []).filter(option => option.exams.length);
  const subject = available.find(option => option.subjectId === choice.subjectId);
  const readiness = data?.readiness;

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4">
      <div className={CARD}>
        <p className={LABEL}>Exam Readiness</p>
        <h1 className="text-2xl font-black text-[#800000] dark:text-white">How ready am I?</h1>
        <p className="mt-1 text-sm text-[#191970] dark:text-slate-300">Measured from your marked work against the official examination specification — not guessed.</p>
        {available.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            <select className={FIELD} aria-label="Subject" value={choice.subjectId} onChange={event => { const next = available.find(option => option.subjectId === event.target.value); setChoice({ subjectId: event.target.value, exam: next?.exams[0]?.key || '' }); }}>
              {available.map(option => <option key={option.subjectId} value={option.subjectId}>{option.subjectName}</option>)}
            </select>
            <select className={FIELD} aria-label="Examination" value={choice.exam} onChange={event => setChoice(current => ({ ...current, exam: event.target.value }))}>
              {(subject?.exams || []).map(exam => <option key={exam.key} value={exam.key}>{exam.label} ({exam.version})</option>)}
            </select>
          </div>
        )}
      </div>

      {!classId && <p className={INNER}>Join a class to see your exam readiness.</p>}
      {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p>}
      {loading && !data && <p className={INNER}>Working it out…</p>}
      {data && !available.length && <p className={INNER}>Ndovera does not yet hold an examination specification for your subjects, so readiness cannot be measured yet.</p>}

      {readiness && (
        <>
          <section className={INNER} aria-label="Readiness by area">
            <div className="mb-3 flex flex-wrap items-baseline gap-2">
              <h2 className="flex-1 text-lg font-bold text-[#800000] dark:text-white">{readiness.exam.name} {readiness.exam.subject} Readiness</h2>
              {readiness.overall !== null && <span className="text-2xl font-black text-[#1a5c38]">{readiness.overall}%</span>}
            </div>
            <ul className="space-y-2">
              {readiness.areas.map(area => (
                <li key={area.area} className="flex flex-wrap items-center justify-between gap-2 text-[#191970] dark:text-slate-200">
                  <span className="font-semibold">{area.area}<span className="ml-2 text-xs font-normal text-slate-500">{area.assessedTopics}/{area.topics.length} topic(s) assessed</span></span>
                  <Bar percent={area.percent} />
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-slate-500">Based on {readiness.evidenceCount} marked piece(s) of work{readiness.unmatched ? `; ${readiness.unmatched} did not match any part of this specification` : ''}.</p>
          </section>

          {readiness.attention.length > 0 && (
            <section className={INNER} aria-label="Areas requiring attention">
              <h2 className="text-lg font-bold text-[#800000] dark:text-white">Areas requiring attention</h2>
              <ul className="mt-2 space-y-2">
                {readiness.attention.map(item => (
                  <li key={item.id} className="flex flex-wrap items-center gap-2 text-[#191970] dark:text-slate-200">
                    <span className="flex-1"><strong>{item.topic}</strong> <span className="text-xs text-slate-500">({item.area})</span></span>
                    <Bar percent={item.percent} />
                    <Link className="rounded-xl bg-[#1a5c38] px-3 py-1.5 text-xs font-bold text-[#b5e3f4]" to={`/roles/student/professor-vera?prompt=${encodeURIComponent(`Help me prepare for ${readiness.exam.name} ${readiness.exam.subject}: I scored ${item.percent}% on ${item.topic}. Teach me what I am missing, then give me ${readiness.exam.name.replace(/\s*\(.*\)$/, '')}-style practice questions (not past questions) with answers at the end.`)}`}>Practise with Ndovera AI</Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {readiness.notAssessed.length > 0 && (
            <section className={INNER} aria-label="Not yet assessed">
              <h2 className="text-lg font-bold text-[#800000] dark:text-white">Not yet assessed</h2>
              <p className="text-sm text-[#191970] dark:text-slate-300">No marked work yet on: {readiness.notAssessed.map(item => item.topic).join(', ')}.</p>
            </section>
          )}
        </>
      )}
    </div>
  );
}
