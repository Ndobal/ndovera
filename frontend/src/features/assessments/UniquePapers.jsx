import React, { useRef, useState } from 'react';
import RichContent from '../../shared/rich/RichContent';
import { getUniquePapers, letter } from './assessmentsApi';
import { StudentPaper } from './PaperPreview';
import { printPaper } from './printPaper';
import { hasVariables } from './variants';

// Unique printed papers: versions A, B, C… or one paper per student, each with
// its own question order, option order and numbers — and its own answer key.
// The papers come from the server (paperVariants.ts), so a key always matches
// its paper and the online exam uses the same rules.

const BTN = 'rounded-xl px-4 py-2 text-sm font-bold disabled:opacity-50';
const PRIMARY = `${BTN} bg-[#1a5c38] text-[#b5e3f4]`;
const SECONDARY = `${BTN} border border-[#c9a96e]/50 bg-white text-[#800020]`;
const FIELD = 'rounded-xl border border-[#c9a96e]/45 bg-white p-2 text-sm text-[#191970]';

/** One paper's answer key: MCQ letters in a grid, worked answers where the numbers change. */
export function AnswerKey({ paper, original }) {
  const templated = new Set(original.filter(hasVariables).map(question => question.id));
  const objective = [];
  const written = [];
  paper.questions.forEach((question, index) => {
    const number = index + 1;
    if (['mcq', 'truefalse'].includes(question.type)) objective.push({ number, text: letter(question.answerIndex) });
    else if (question.type === 'fill') objective.push({ number, text: question.answer });
    if (templated.has(question.id) && !['mcq', 'truefalse'].includes(question.type)) written.push({ number, question });
  });
  return (
    <section className="ndv-paper-question ndv-key" data-print-block style={{ display: 'block' }}>
      <h3 className="ndv-paper-section-head" style={{ marginTop: 0 }}>{paper.label} — paper code <strong>{paper.code}</strong>{paper.admissionNo ? ` · ${paper.admissionNo}` : ''}</h3>
      {objective.length > 0 && <div className="ndv-key-grid">{objective.map(item => <span key={item.number}><strong>{item.number}.</strong> {item.text}</span>)}</div>}
      {written.length > 0 && (
        <table className="ndv-key-table" style={{ marginTop: 6 }}>
          <tbody>
            {written.map(({ number, question }) => (
              <tr key={number}><th style={{ width: '3em' }}>{number}</th><td>
                {question.answer ? <RichContent text={question.answer} /> : null}
                {(question.parts || []).map(part => <div key={part.label}><strong>({part.label})</strong> <RichContent inline text={part.answer || ''} /></div>)}
              </td></tr>
            ))}
          </tbody>
        </table>
      )}
      {paper.questions.some(question => !['mcq', 'truefalse', 'fill'].includes(question.type) && !templated.has(question.id)) && <p className="ndv-scheme-meta">Other theory questions: use the main marking scheme (their numbers do not change).</p>}
    </section>
  );
}

const OBJECTIVE = ['mcq', 'truefalse', 'fill'];
export const PARTS = [['all', 'Whole paper'], ['objective', 'Objectives only'], ['theory', 'Theory only']];

/** One part of a paper (or all of it): its questions, its own total marks, and its name for the title. */
export function paperPart(assessment, questions, part) {
  if (part === 'all') return { ...assessment, questions };
  const objectiveMarks = questions.filter(question => OBJECTIVE.includes(question.type)).reduce((sum, question) => sum + (Number(question.marks) || 0), 0);
  const paperTotal = assessment.audit?.examMarks ?? assessment.config?.totalMarks ?? 0;
  return {
    ...assessment, paperPart: part === 'theory' ? 'THEORY' : 'OBJECTIVES',
    audit: { ...(assessment.audit || {}), examMarks: part === 'theory' ? Math.max(0, paperTotal - objectiveMarks) : objectiveMarks },
    questions: questions.filter(question => (part === 'theory' ? !OBJECTIVE.includes(question.type) : OBJECTIVE.includes(question.type))),
  };
}

export default function UniquePapers({ assessment, letterhead, dirty }) {
  const [mode, setMode] = useState('versions');
  const [count, setCount] = useState(4);
  const [papers, setPapers] = useState(null);
  const [show, setShow] = useState('papers');
  // Print the whole paper or one part — e.g. only the theory when the objectives are written as CBT.
  const [part, setPart] = useState('all');
  const hasBothParts = assessment.questions.some(question => OBJECTIVE.includes(question.type)) && assessment.questions.some(question => !OBJECTIVE.includes(question.type));
  const partLabel = part === 'theory' ? 'Theory — ' : part === 'objective' ? 'Objectives — ' : '';
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const sheetRef = useRef(null);

  async function load() {
    setBusy(true); setError('');
    try { const data = await getUniquePapers(assessment.id, mode, mode === 'versions' ? count : undefined); setPapers(data.papers); setShow('papers'); } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  function print(which) {
    setShow(which);
    setTimeout(() => {
      printPaper(sheetRef.current, `${which === 'keys' ? 'Answer keys — ' : ''}${partLabel}${assessment.title}`).catch(err => setError(err.message || 'Could not open printing.'));
    }, 350);
  }

  return (
    <div className="space-y-4">
      <section className="space-y-3 rounded-3xl border border-[#c9a96e]/40 bg-[#b5e3f4] p-5 text-[#191970]" aria-label="Unique papers">
        <h2 className="text-lg font-black text-[#800000]">Unique papers</h2>
        <p className="text-sm">Every paper has the same questions, but objective questions and their options are in a different order, and numbers you marked as variable change. Theory questions keep their numbers, so instructions like “Question 1 is compulsory” stay true. Each paper has its own answer key.</p>
        <div className="flex flex-wrap items-end gap-2">
          <button type="button" className={mode === 'versions' ? PRIMARY : SECONDARY} onClick={() => { setMode('versions'); setPapers(null); }}>Versions A, B, C…</button>
          <button type="button" className={mode === 'students' ? PRIMARY : SECONDARY} onClick={() => { setMode('students'); setPapers(null); }}>One paper per student</button>
          {mode === 'versions' && (
            <label className="text-xs font-bold text-[#800020]">How many versions
              <select className={`${FIELD} ml-1`} value={count} onChange={event => { setCount(Number(event.target.value)); setPapers(null); }}>{[2, 3, 4, 5, 6, 7, 8].map(n => <option key={n} value={n}>{n}</option>)}</select>
            </label>
          )}
          <button type="button" className={PRIMARY} disabled={busy || dirty} title={dirty ? 'Save your changes first' : ''} onClick={load}>{busy ? 'Preparing…' : papers ? 'Prepare again' : 'Prepare papers'}</button>
        </div>
        {hasBothParts && (
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Which part to print">
            <span className="text-xs font-bold text-[#800020]">Print</span>
            {PARTS.map(([key, label]) => <button key={key} type="button" className={`rounded-xl px-3 py-1 text-xs font-bold ${part === key ? 'bg-[#800020] text-[#b5e3f4]' : 'bg-white text-[#800020]'}`} onClick={() => setPart(key)}>{label}</button>)}
            {part === 'theory' && <span className="text-xs">— for CBT objectives: each student's theory paper, with their own numbers where you marked them variable.</span>}
          </div>
        )}
        {dirty && <p className="text-sm font-semibold text-amber-800">Save your changes first — papers are made from the saved version.</p>}
        {mode === 'students' && <p className="text-xs">Each student's name and admission number are printed on their paper. Hand each student the paper with their name.</p>}
        {error && <p role="alert" className="text-sm font-semibold text-rose-700">{error}</p>}
        {papers && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold">{papers.length} paper{papers.length === 1 ? '' : 's'} ready.</span>
            <button type="button" className={PRIMARY} onClick={() => print('papers')}>Print / PDF all papers</button>
            <button type="button" className={SECONDARY} onClick={() => print('keys')}>Print / PDF answer keys</button>
            <button type="button" className={SECONDARY} onClick={() => setShow(show === 'papers' ? 'keys' : 'papers')}>{show === 'papers' ? 'Show answer keys' : 'Show papers'}</button>
          </div>
        )}
      </section>
      {papers && (
        <div ref={sheetRef} className="space-y-6">
          {show === 'papers'
            ? papers.map((paper, index) => <StudentPaper key={paper.code + index} assessment={paperPart(assessment, paper.questions, part)} letterhead={letterhead} candidate={paper} breakBefore={index > 0} />)
            : <article className="ndv-paper" aria-label="Answer keys">
                <h2 className="ndv-paper-title" data-print-block>ANSWER KEYS — {partLabel.toUpperCase()}{assessment.title}</h2>
                {papers.map((paper, index) => <AnswerKey key={paper.code + index} paper={{ ...paper, questions: paperPart(assessment, paper.questions, part).questions }} original={assessment.questions} />)}
              </article>}
        </div>
      )}
    </div>
  );
}
