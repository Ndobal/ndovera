import React, { useCallback, useEffect, useMemo, useState } from 'react';
import RichContent from '../../shared/rich/RichContent';
import { PHASE_LABELS, getExamMarking, postExamScores, saveExamMarks } from './assessmentsApi';

// The teacher's marking sheet for one exam. Objective marks come from the CBT
// (or are typed in, for a printed paper); the teacher types the theory marks;
// Ndovera works out the score for the CA score sheet the way the school chose,
// and posting puts it there and opens the paper for the students to review.

const CELL = 'w-20 rounded-lg border border-[#c9a96e]/45 bg-white p-1.5 text-sm text-[#191970] disabled:bg-slate-100';
const BTN = 'rounded-xl px-4 py-2 text-sm font-bold disabled:opacity-50';

/** The score sheet's exam score, exactly as the server works it out (examSittings.ts sheetScore). */
export function previewScore(objective, theory, paperTotal, scoring) {
  if ((objective === null || objective === '' || objective === undefined) && (theory === null || theory === '' || theory === undefined)) return { total: null, score: null };
  const total = (Number(objective) || 0) + (Number(theory) || 0);
  const max = Math.max(1, Number(scoring.examMaxScore) || 60);
  const value = scoring.entry === 'raw' || !paperTotal ? total : (total / paperTotal) * max;
  const factor = 10 ** Math.max(0, Math.min(2, scoring.decimals));
  return { total, score: Math.max(0, Math.min(max, Math.round(value * factor) / factor)) };
}

function TypedAnswers({ row }) {
  const theory = (row.questions || []).filter(question => !['mcq', 'fillgaps'].includes(question.type));
  if (!theory.length) return <p className="text-sm">No theory questions on this paper.</p>;
  return (
    <ol className="space-y-3">
      {theory.map(question => (
        <li key={question.id} className="rounded-xl bg-white p-3 text-sm text-[#191970]">
          <RichContent text={question.prompt} />
          <p className="mt-2 text-xs font-bold text-[#800020]">{row.studentName}'s answer ({question.score} marks)</p>
          <p className="whitespace-pre-wrap rounded-lg bg-[#f4fbf7] p-2">{String(row.answers?.[question.id] ?? '') || <em>No answer</em>}</p>
          {question.markingGuide && <details className="mt-1"><summary className="cursor-pointer text-xs font-bold text-[#1a5c38]">Marking guide</summary><RichContent text={question.markingGuide} /></details>}
        </li>
      ))}
    </ol>
  );
}

export default function ExamMarking({ sittingId, onBack }) {
  const [data, setData] = useState(null);
  const [edits, setEdits] = useState({});
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState({ text: '', tone: 'ok' });
  const [reading, setReading] = useState('');

  const load = useCallback(async () => {
    try { setData(await getExamMarking(sittingId)); setEdits({}); } catch (err) { setNotice({ text: err.message, tone: 'error' }); }
  }, [sittingId]);
  useEffect(() => { load(); }, [load]);

  const sitting = data?.sitting;
  const rows = useMemo(() => (data?.rows || []).map(row => ({ ...row, ...(edits[row.studentId] || {}) })), [data, edits]);
  const dirty = Object.keys(edits).length > 0;
  const locked = sitting && ['scheduled', 'open'].includes(sitting.phase);
  const set = (studentId, patch) => setEdits(current => ({ ...current, [studentId]: { ...(current[studentId] || {}), ...patch } }));

  async function save() {
    setBusy('save');
    try {
      await saveExamMarks(sittingId, rows.filter(row => edits[row.studentId]).map(row => ({ studentId: row.studentId, studentName: row.studentName, theory: row.theory === '' ? null : row.theory, ...(sitting.mode === 'print' ? { objective: row.objective === '' ? null : row.objective } : {}) })));
      await load();
      setNotice({ text: 'Marks saved.', tone: 'ok' });
    } catch (err) { setNotice({ text: err.message, tone: 'error' }); } finally { setBusy(''); }
  }

  async function post(confirmed = false) {
    if (dirty) { setNotice({ text: 'Save the marks first.', tone: 'warn' }); return; }
    setBusy('post');
    try {
      const result = await postExamScores(sittingId, confirmed);
      await load();
      setNotice({ text: `Posted ${result.posted} score${result.posted === 1 ? '' : 's'} to the CA score sheet. Students can now review the paper in their Assignments tab.`, tone: 'ok' });
    } catch (err) {
      if (err.data?.needsConfirmation && window.confirm(err.message)) { setBusy(''); await post(true); return; }
      setNotice({ text: err.message, tone: 'error' });
    } finally { setBusy(''); }
  }

  if (!data) return <div className="space-y-2">{onBack && <button type="button" className={`${BTN} border border-[#c9a96e]/50 bg-white text-[#800020]`} onClick={onBack}>← Exams</button>}{notice.text ? <p role="alert" className="font-semibold text-rose-700">{notice.text}</p> : <p role="status">Loading the marking sheet…</p>}</div>;
  const { scoring } = data;
  const written = rows.filter(row => row.wroteCbt).length;
  return (
    <div className="space-y-4">
      <section className="space-y-2 rounded-3xl border border-[#c9a96e]/40 bg-[#b5e3f4] p-5 text-[#191970]">
        {onBack && <button type="button" className={`${BTN} border border-[#c9a96e]/50 bg-white text-[#800020]`} onClick={onBack}>← Exams</button>}
        <h2 className="text-xl font-black text-[#800000]">{sitting.title}</h2>
        <p className="text-sm">{sitting.className} · {sitting.subjectName} · {sitting.modeLabel} · <strong>{PHASE_LABELS[sitting.phase] || sitting.phase}</strong>{sitting.mode !== 'print' ? ` · ${written} of ${rows.length} wrote the CBT` : ''}</p>
        <p className="text-sm">Paper: objectives {sitting.objectiveMarks} + theory {sitting.theoryMarks} = <strong>{sitting.paperTotal}</strong>. Score sheet exam column: {scoring.entry === 'raw' ? `marks as obtained, up to ${scoring.examMaxScore}` : <>total ÷ {sitting.paperTotal} × {scoring.examMaxScore} (rounded to {scoring.decimals} decimal place{scoring.decimals === 1 ? '' : 's'})</>}. The school sets this in Result Settings.</p>
        {locked && <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">{sitting.phase === 'open' ? 'The exam is being written now. Mark it after it closes.' : `The exam opens ${new Date(sitting.opensAt).toLocaleString()}.`}</p>}
        {sitting.mode !== 'print' && !locked && <p className="text-sm">Objective marks come from the CBT and cannot be changed here. {sitting.mode === 'cbt_objective' ? 'Enter each student\'s mark for the printed theory paper.' : 'Read each student\'s typed theory answers and enter their theory mark.'}</p>}
        {sitting.phase === 'posted' && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-[#1a5c38]">Scores posted {new Date(sitting.postedAt).toLocaleString()}. Change a mark and post again to update the score sheet.</p>}
        <div className="flex flex-wrap gap-2">
          <button type="button" className={`${BTN} bg-[#1a5c38] text-[#b5e3f4]`} disabled={locked || !dirty || busy === 'save'} onClick={save}>{busy === 'save' ? 'Saving…' : 'Save marks'}</button>
          <button type="button" className={`${BTN} bg-[#800020] text-[#b5e3f4]`} disabled={locked || busy === 'post'} onClick={() => post(false)}>{busy === 'post' ? 'Posting…' : sitting.phase === 'posted' ? 'Post scores again' : 'Post scores to the score sheet'}</button>
        </div>
        {notice.text && <p role={notice.tone === 'error' ? 'alert' : 'status'} className={`rounded-xl px-3 py-2 text-sm font-semibold ${notice.tone === 'error' ? 'bg-rose-50 text-rose-800' : notice.tone === 'warn' ? 'bg-amber-50 text-amber-900' : 'bg-emerald-50 text-[#1a5c38]'}`}>{notice.text}</p>}
      </section>
      <div className="overflow-x-auto rounded-3xl bg-white p-3">
        <table className="w-full min-w-[720px] text-sm text-[#191970]">
          <thead>
            <tr className="text-left text-xs uppercase text-[#800020]">
              <th className="p-2">Student</th><th className="p-2">Adm. no.</th>{sitting.mode !== 'print' && <th className="p-2">CBT</th>}
              <th className="p-2">Objectives /{sitting.objectiveMarks}</th><th className="p-2">Theory /{sitting.theoryMarks}</th><th className="p-2">Total /{sitting.paperTotal}</th><th className="p-2">Score sheet /{scoring.examMaxScore}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => {
              const { total, score } = previewScore(row.objective, row.theory, sitting.paperTotal, scoring);
              return (
                <React.Fragment key={row.studentId}>
                  <tr className="border-t border-[#c9a96e]/30">
                    <td className="p-2 font-semibold">{row.studentName}{row.paperCode ? <span className="ml-1 text-[11px] text-slate-500">({row.paperCode})</span> : null}</td>
                    <td className="p-2 text-xs">{row.admissionNo || '—'}</td>
                    {sitting.mode !== 'print' && <td className="p-2 text-xs">{row.wroteCbt ? '✓ Wrote' : <span className="text-rose-700">Absent</span>}{row.answers && <button type="button" className="ml-2 text-xs font-bold text-[#800020] underline" onClick={() => setReading(reading === row.studentId ? '' : row.studentId)}>{reading === row.studentId ? 'Hide answers' : 'Read answers'}</button>}</td>}
                    <td className="p-2">{sitting.mode === 'print'
                      ? <input aria-label={`Objective mark for ${row.studentName}`} type="number" min="0" max={sitting.objectiveMarks} step="0.5" className={CELL} disabled={locked} value={row.objective ?? ''} onChange={event => set(row.studentId, { objective: event.target.value })} />
                      : <span className="font-bold">{row.objective ?? '—'}</span>}</td>
                    <td className="p-2"><input aria-label={`Theory mark for ${row.studentName}`} type="number" min="0" max={sitting.theoryMarks} step="0.5" className={CELL} disabled={locked || !sitting.theoryMarks} value={row.theory ?? ''} onChange={event => set(row.studentId, { theory: event.target.value })} /></td>
                    <td className="p-2 font-bold">{total ?? '—'}</td>
                    <td className="p-2 font-black text-[#1a5c38]">{score ?? '—'}</td>
                  </tr>
                  {reading === row.studentId && <tr><td colSpan={7} className="bg-[#f4fbf7] p-3"><TypedAnswers row={row} /></td></tr>}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
        {!rows.length && <p className="p-3 text-sm">No students in this class.</p>}
      </div>
    </div>
  );
}
