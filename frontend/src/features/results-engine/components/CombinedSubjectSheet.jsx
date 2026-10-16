import React, { useCallback, useEffect, useRef, useState } from 'react';
import { getGroupScoreSheet, saveGroupScores, submitGroupScores } from '../../school/services/schoolApi';
import { computeGrade, normalizeCaComponentDefinitions, resolveResultScoreModel } from '../utils/resultEngineTransforms';
import { RESULT_BODY, RESULT_BUTTON, RESULT_HEADING, RESULT_INNER_SURFACE, RESULT_INPUT, RESULT_LABEL, RESULT_SECONDARY_BUTTON, RESULT_SURFACE, RESULT_TABLE_HEAD } from './resultSheetTheme';

// A combined subject (one subject taught to students of several classes): every
// student on one sheet, one at a time. Each score is saved into the student's own
// class, and the subject is submitted to each class teacher in one step.

const keyOf = (classId, studentId) => `${classId}::${studentId}`;
const clamp = (value, max) => Math.max(0, Math.min(Number(max) || 0, Number(value) || 0));

export default function CombinedSubjectSheet({ groupId }) {
  const [data, setData] = useState(null);
  const [scores, setScores] = useState({});
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [report, setReport] = useState(null);
  const dirtyRef = useRef(new Set());

  const load = useCallback(async () => {
    const next = await getGroupScoreSheet(groupId);
    const map = {};
    for (const entry of next.entries || []) map[keyOf(entry.classId, entry.studentId)] = { caComponents: entry.caComponents || {}, examScore: Number(entry.examScore || 0), saved: true };
    setData(next);
    setScores(map);
    dirtyRef.current = new Set();
  }, [groupId]);

  useEffect(() => {
    setLoading(true);
    setError('');
    load().catch(err => setError(err.message || 'Could not open this combined subject.')).finally(() => setLoading(false));
  }, [load]);

  const components = normalizeCaComponentDefinitions(data?.settings);
  const scoreModel = resolveResultScoreModel(data?.settings);
  const gradingScale = data?.settings?.gradingScale || [];
  const students = data?.students || [];
  const classes = data?.classes || [];
  const classById = new Map(classes.map(item => [item.classId, item]));
  const finishIndex = students.length;
  const current = students[Math.min(index, finishIndex)] || null;
  const missing = students.filter(student => !scores[keyOf(student.classId, student.id)]?.saved);

  const locked = student => {
    const cls = classById.get(student.classId);
    const saved = scores[keyOf(student.classId, student.id)]?.saved;
    return Boolean(saved && cls && (cls.batchStatus !== 'draft' || (cls.frozen && Number(data?.permissions?.overrideRank || 0) < 2)));
  };

  function change(student, field, value, componentKey) {
    const key = keyOf(student.classId, student.id);
    dirtyRef.current.add(key);
    setScores(currentScores => {
      const before = currentScores[key] || { caComponents: {}, examScore: 0 };
      const next = field === 'ca'
        ? { ...before, caComponents: { ...before.caComponents, [componentKey]: Number(value || 0) } }
        : { ...before, examScore: Number(value || 0) };
      return { ...currentScores, [key]: next };
    });
  }

  async function saveDirty({ announce = false } = {}) {
    const pending = [...dirtyRef.current];
    if (!pending.length) { if (announce) setMessage('Nothing new to save.'); return true; }
    setSaving(true); setError(''); setMessage('');
    try {
      const rows = pending.map(key => {
        const [classId, studentId] = key.split('::');
        const value = scores[key] || {};
        return { classId, studentId, caComponents: value.caComponents || {}, examScore: value.examScore || 0, entered: true };
      });
      const result = await saveGroupScores({ groupId, rows });
      await load();
      const problems = [...(result.errors || []), ...(result.locked || []).map(item => `${item.className}: a submitted score was not changed`)];
      if (problems.length) setError(problems.join(' · '));
      if (announce) setMessage(`${result.savedRows || 0} score${result.savedRows === 1 ? '' : 's'} saved.`);
      return true;
    } catch (err) {
      setError(err.message || 'Could not save these scores.');
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function goTo(next) {
    if (saving) return;
    if (await saveDirty()) setIndex(next);
  }

  async function submit() {
    setSaving(true); setError(''); setMessage(''); setReport(null);
    try {
      const result = await submitGroupScores(groupId);
      setReport(result.report || []);
      setMessage('Submitted to the class teachers.');
      await load();
    } catch (err) {
      setError(err.message || 'Could not submit.');
      setReport(err.data?.report || null);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <section className={`${RESULT_SURFACE} p-6 ${RESULT_BODY}`}>Loading combined subject…</section>;
  if (!data) return <section role="alert" className={`${RESULT_SURFACE} p-6 text-sm text-rose-800`}>{error || 'Could not open this combined subject.'}</section>;

  const value = current ? (scores[keyOf(current.classId, current.id)] || { caComponents: {}, examScore: 0 }) : null;
  const caTotal = value ? Math.min(scoreModel.caMaxScore, components.reduce((sum, component) => sum + clamp(value.caComponents?.[component.key], component.maxScore), 0)) : 0;
  const total = value ? Math.min(scoreModel.totalMaxScore, caTotal + clamp(value.examScore, scoreModel.examMaxScore)) : 0;
  const isLocked = current ? locked(current) : false;

  return (
    <div className="space-y-4">
      <section className={`${RESULT_SURFACE} space-y-2 p-5`}>
        <p className={`micro-label ${RESULT_LABEL}`}>Combined subject · {data.period?.termName} {data.period?.sessionName}</p>
        <h2 className={`text-xl font-black ${RESULT_HEADING}`}>{data.group?.name}</h2>
        <p className={`text-sm ${RESULT_BODY}`}>Students from {classes.map(item => item.className).join(', ')} on one sheet. Each score is saved to the student's own class.</p>
        {!data.configurationReady && <p className="text-sm font-semibold text-amber-800">{data.configurationError}</p>}
      </section>

      {error && <section role="alert" className={`${RESULT_SURFACE} p-4 text-sm text-[#800020] bg-rose-200/65`}>{error}</section>}
      {message && <section role="status" className={`${RESULT_SURFACE} p-4 text-sm text-[#1a5c38] bg-emerald-100/70`}>{message}</section>}

      <section className={`${RESULT_SURFACE} space-y-4 p-4 sm:p-5`}>
        <p className={`micro-label ${RESULT_LABEL}`}>Students · {students.length - missing.length} of {students.length} scored</p>
        <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Students">
          {students.map((student, position) => {
            const done = scores[keyOf(student.classId, student.id)]?.saved;
            return (
              <button key={keyOf(student.classId, student.id)} type="button" role="tab" aria-selected={position === index} onClick={() => goTo(position)}
                className={`shrink-0 rounded-xl border px-3 py-1.5 text-xs font-bold ${position === index ? 'border-[#2447d8] bg-[#2447d8] text-white' : done ? 'border-emerald-300 bg-emerald-50 text-emerald-900' : 'border-[#7cc4e8]/60 bg-white text-[#191970]'}`}>
                {done ? '✓ ' : ''}{student.name} <span className="opacity-70">({student.className})</span>
              </button>
            );
          })}
          <button type="button" role="tab" aria-selected={index >= finishIndex} onClick={() => goTo(finishIndex)}
            className={`shrink-0 rounded-xl border px-3 py-1.5 text-xs font-bold ${index >= finishIndex ? 'border-[#2447d8] bg-[#2447d8] text-white' : 'border-[#2447d8]/40 bg-white text-[#2447d8]'}`}>🏁 Submit</button>
        </div>

        {current ? (
          <>
            <div className={`${RESULT_INNER_SURFACE} p-4`}>
              <p className={`text-lg font-semibold ${RESULT_HEADING}`}>{current.name}{current.displayId ? ` • ${current.displayId}` : ''}</p>
              <p className={`text-xs ${RESULT_BODY}`}>{current.className}{isLocked ? ' · submitted — ask the class teacher to return it to change it' : ''}</p>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm" style={{ minWidth: `${360 + components.length * 110}px` }}>
                  <thead className={RESULT_TABLE_HEAD}>
                    <tr className="text-left">
                      {components.map(component => <th key={component.key} className="micro-label px-3 py-2">{component.label} ({component.maxScore})</th>)}
                      <th className="micro-label px-3 py-2">CA ({scoreModel.caMaxScore})</th>
                      <th className="micro-label px-3 py-2">Exam ({scoreModel.examMaxScore})</th>
                      <th className="micro-label px-3 py-2">Total</th>
                      <th className="micro-label px-3 py-2">Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      {components.map(component => (
                        <td key={component.key} className="px-3 py-2">
                          <input type="number" min={0} max={component.maxScore} disabled={isLocked} aria-label={component.label}
                            value={value.caComponents?.[component.key] ?? ''} onChange={event => change(current, 'ca', event.target.value, component.key)}
                            className={`${RESULT_INPUT} disabled:opacity-60`} />
                        </td>
                      ))}
                      <td className={`px-3 py-2 font-semibold ${RESULT_BODY}`}>{caTotal}</td>
                      <td className="px-3 py-2">
                        <input type="number" min={0} max={scoreModel.examMaxScore} disabled={isLocked} aria-label="Exam"
                          value={value.examScore ?? ''} onChange={event => change(current, 'exam', event.target.value)} className={`${RESULT_INPUT} disabled:opacity-60`} />
                      </td>
                      <td className={`px-3 py-2 font-semibold ${RESULT_BODY}`}>{total}</td>
                      <td className={`px-3 py-2 font-black ${RESULT_HEADING}`}>{computeGrade(total, gradingScale) || '—'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button type="button" className={RESULT_SECONDARY_BUTTON} disabled={saving || index === 0} onClick={() => goTo(index - 1)}>← Previous</button>
              <span className={`text-xs ${RESULT_BODY}`}>Student {index + 1} of {students.length}</span>
              <div className="flex gap-2">
                <button type="button" className={RESULT_SECONDARY_BUTTON} disabled={saving} onClick={() => saveDirty({ announce: true })}>{saving ? 'Saving…' : 'Save as draft'}</button>
                <button type="button" className={RESULT_BUTTON} disabled={saving} onClick={() => goTo(index + 1)}>{saving ? 'Saving…' : 'Next →'}</button>
              </div>
            </div>
          </>
        ) : (
          <div className="space-y-3">
            <div className={`${RESULT_INNER_SURFACE} divide-y divide-[#7cc4e8]/30`}>
              {classes.map(item => (
                <div key={item.classId} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm">
                  <span className={`font-bold ${RESULT_HEADING}`}>{item.className}</span>
                  <span className={RESULT_BODY}>
                    {item.batchStatus !== 'draft' ? 'Class handed in' : item.submission?.status === 'returned' ? `Returned: “${item.submission.returnNote}”` : item.submission ? 'Submitted to the class teacher' : 'Not submitted'}
                  </span>
                </div>
              ))}
            </div>
            {missing.length > 0 && <p className="text-sm font-semibold text-amber-800">Still without a score: {missing.map(student => `${student.name} (${student.className})`).join(', ')}.</p>}
            {report && (
              <ul className={`list-disc pl-5 text-sm ${RESULT_BODY}`}>
                {report.map(item => <li key={item.className}><strong>{item.className}</strong>: {item.message}</li>)}
              </ul>
            )}
            <div className="flex flex-wrap gap-2">
              {data.permissions?.canSubmit && <button type="button" className={RESULT_BUTTON} disabled={saving || missing.length > 0} onClick={submit}>{saving ? 'Submitting…' : 'Submit to class teachers'}</button>}
              <button type="button" className={RESULT_SECONDARY_BUTTON} disabled={saving} onClick={() => saveDirty({ announce: true })}>Save as draft</button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
