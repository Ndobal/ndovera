import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BLOOM, BLOOM_LABELS, KIND_LABELS, STATUS_LABELS, TYPE_LABELS, getAssessmentVersion, isSecondaryClass, listAssessmentVersions, postAssessment, regenerateAssessmentQuestion,
  draftMarkingSchemes, releaseAssessmentAnswers, reviewAssessment, saveAssessmentEdits, submitExamPaper,
} from './assessmentsApi';
import QuestionCard from './QuestionCard';
import { MarkingScheme, StudentPaper } from './PaperPreview';
import { buildDocx } from './docxExport';
import { printPaper } from './printPaper';
import UniquePapers, { paperPart as partOfPaper } from './UniquePapers';
import { masterQuestions } from './variants';

// Generate → AI quality check → Teacher review → Edit → Preview → Approve →
// Schedule/Post (quiz, assignment, test) or Submit for approval (exam).

const CARD = 'rounded-3xl border border-[#c9a96e]/40 bg-[#b5e3f4] p-4 dark:border-white/10 dark:bg-slate-900/40';
const BTN = 'rounded-xl px-3 py-2 text-sm font-bold disabled:opacity-50';
const PRIMARY = `${BTN} bg-[#1a5c38] text-[#b5e3f4]`;
const SECONDARY = `${BTN} border border-[#c9a96e]/50 bg-white text-[#800020]`;
const FIELD = 'rounded-lg border border-[#c9a96e]/45 bg-white p-2 text-sm text-[#191970]';
const STATUS_STYLE = { ok: 'text-emerald-700', warn: 'text-amber-700', fail: 'text-rose-700' };
const STATUS_ICON = { ok: '✓', warn: '⚠', fail: '✗' };
const blankQuestion = (type, section) => ({ id: `q-new-${Date.now()}`, type, section, prompt: '', options: type === 'mcq' ? ['', '', '', ''] : type === 'truefalse' ? ['True', 'False'] : [], answerIndex: 0, answer: '', markingPoints: [], alternatives: [], workingSteps: [], rubric: [], marks: 1, bloom: 'understand', difficulty: 'standard', topic: '', source: 'teacher' });

// Local, live version of the computed audit while the teacher edits (the server recomputes on save).
function liveBloom(questions, target) {
  const total = questions.reduce((sum, question) => sum + (Number(question.marks) || 0), 0) || 1;
  const targetSum = BLOOM.reduce((sum, level) => sum + (target?.[level] || 0), 0) || 1;
  return BLOOM.map(level => {
    const items = questions.filter(question => question.bloom === level);
    const marks = items.reduce((sum, question) => sum + (Number(question.marks) || 0), 0);
    return { level, questions: items.length, marks, coverage: Math.round((marks / total) * 100), target: Math.round(((target?.[level] || 0) / targetSum) * 100) };
  });
}

function BloomMeter({ rows }) {
  const totals = rows.reduce((sum, row) => ({ questions: sum.questions + row.questions, marks: sum.marks + row.marks }), { questions: 0, marks: 0 });
  return (
    <section className={CARD} aria-label="Bloom's coverage meter">
      <h3 className="mb-2 font-black text-[#800000] dark:text-white">Bloom's coverage</h3>
      <table className="w-full text-sm text-[#191970] dark:text-slate-200">
        <thead><tr className="text-left text-xs uppercase text-[#800020]"><th className="p-1">Level</th><th className="p-1">Qs</th><th className="p-1">Marks</th><th className="p-1">Coverage</th></tr></thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.level} className="border-t border-[#c9a96e]/30">
              <td className="p-1 font-semibold">{BLOOM_LABELS[row.level]}</td><td className="p-1">{row.questions}</td><td className="p-1">{row.marks}</td>
              <td className="p-1">
                <div className="relative h-3 w-full rounded-full bg-white">
                  <div className="absolute inset-y-0 left-0 rounded-full bg-[#1a5c38]" style={{ width: `${Math.min(100, row.coverage)}%` }} />
                  <div className="absolute inset-y-[-3px] w-0.5 bg-[#800020]" style={{ left: `${Math.min(100, row.target)}%` }} title={`Target ${row.target}%`} />
                </div>
                <span className="text-xs">{row.coverage}% (target {row.target}%)</span>
              </td>
            </tr>
          ))}
          <tr className="border-t-2 border-[#191970] font-black"><td className="p-1">Total</td><td className="p-1">{totals.questions}</td><td className="p-1">{totals.marks}</td><td className="p-1">100%</td></tr>
        </tbody>
      </table>
    </section>
  );
}

function AuditPanel({ audit, review, onReview, reviewing, dirty }) {
  if (!audit) return null;
  return (
    <section className={CARD} aria-label="Quality check">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h3 className="flex-1 font-black text-[#800000] dark:text-white">Final exam audit</h3>
        <button type="button" className={SECONDARY} disabled={reviewing || dirty} onClick={onReview} title={dirty ? 'Save your changes first' : ''}>{reviewing ? 'Ndovera AI is reviewing…' : 'Run AI review'}</button>
      </div>
      {dirty && <p className="mb-2 text-xs text-amber-800">Unsaved changes — the audit updates when you save.</p>}
      <ul className="space-y-1 text-sm">
        {audit.checks.map(check => (
          <li key={check.key} className="flex gap-2">
            <span className={`w-4 font-black ${STATUS_STYLE[check.status]}`} aria-hidden>{STATUS_ICON[check.status]}</span>
            <span className="font-semibold text-[#191970] dark:text-white">{check.label}:</span>
            <span className={STATUS_STYLE[check.status]}>{check.detail}</span>
          </li>
        ))}
      </ul>
      {review && (
        <div className="mt-3 rounded-xl bg-white/70 p-2 text-sm text-[#191970]">
          <p className="font-bold">Ndovera AI review {review.reviewedVersion ? `(version ${review.reviewedVersion})` : ''}: {review.findings.length ? `${review.findings.length} point(s) to look at` : 'no issues found'}</p>
          <ul className="mt-1 list-disc pl-5">{review.findings.map((finding, index) => <li key={index}>Q{finding.question}: {finding.issue}</li>)}</ul>
          <p className="mt-1 text-xs">Suggestions only — nothing was changed. You make the final decision.</p>
        </div>
      )}
    </section>
  );
}

function VersionHistory({ assessmentId, onView }) {
  const [versions, setVersions] = useState(null);
  useEffect(() => { listAssessmentVersions(assessmentId).then(data => setVersions(data.versions)).catch(() => setVersions([])); }, [assessmentId]);
  if (!versions) return <p role="status">Loading history…</p>;
  return (
    <ol className="space-y-1 text-sm text-[#191970] dark:text-slate-200">
      {versions.map(version => (
        <li key={version.version} className="rounded-xl bg-white/70 px-3 py-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-black">v{version.version}</span><span className="font-bold">{version.label}</span>
            <span className="text-xs">{new Date(version.createdAt).toLocaleString()} · {version.changedBy}</span>
            <button type="button" className="ml-auto text-xs font-bold text-[#800020] underline" onClick={() => onView(version.version)}>View</button>
          </div>
          {version.summary && <p className="text-xs">{version.summary}</p>}
        </li>
      ))}
    </ol>
  );
}

function PostDialog({ assessment, onDone, onClose }) {
  const [mode, setMode] = useState('now');
  const [opensAt, setOpensAt] = useState('');
  const [closesAt, setClosesAt] = useState('');
  const [durationMinutes, setDuration] = useState(assessment.config.durationMinutes || 0);
  const [attempts, setAttempts] = useState(1);
  const [latePolicy, setLatePolicy] = useState('accept_marked_late');
  const [autoMark, setAutoMark] = useState(true);
  // Secondary-school exams: a unique paper for every student, unless the teacher turns it off.
  const [uniquePerStudent, setUnique] = useState(assessment.kind === 'exam' && isSecondaryClass(assessment.className));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const local = value => (value ? new Date(value).toISOString() : '');
  async function submit() {
    setBusy(true); setError('');
    try {
      const result = await postAssessment(assessment.id, { mode, opensAt: local(opensAt), closesAt: local(closesAt), durationMinutes: Number(durationMinutes), attempts: Number(attempts), latePolicy, autoMark, uniquePerStudent });
      onDone(result.assessment, mode === 'now' ? 'Posted — students can see it in the classroom now.' : `Scheduled — Ndovera will open it on ${new Date(opensAt).toLocaleString()}.`);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-[#191970]/60 p-3" role="dialog" aria-modal="true" aria-label="Post or schedule">
      <div className="w-full max-w-lg space-y-3 rounded-3xl bg-white p-5 text-[#191970] shadow-2xl">
        <h2 className="text-lg font-black text-[#800000]">{assessment.kind === 'exam' ? 'Sit this examination online' : `Post ${KIND_LABELS[assessment.kind]}`}</h2>
        <div className="flex gap-2">
          <button type="button" className={mode === 'now' ? PRIMARY : SECONDARY} onClick={() => setMode('now')}>Post now</button>
          <button type="button" className={mode === 'schedule' ? PRIMARY : SECONDARY} onClick={() => setMode('schedule')}>Schedule</button>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {mode === 'schedule' && <label className="text-xs font-bold text-[#800020]">Opens<input type="datetime-local" className={`${FIELD} w-full`} value={opensAt} onChange={event => setOpensAt(event.target.value)} /></label>}
          <label className="text-xs font-bold text-[#800020]">Closes (optional)<input type="datetime-local" className={`${FIELD} w-full`} value={closesAt} onChange={event => setClosesAt(event.target.value)} /></label>
          <label className="text-xs font-bold text-[#800020]">Duration (minutes, 0 = untimed)<input type="number" min="0" className={`${FIELD} w-full`} value={durationMinutes} onChange={event => setDuration(event.target.value)} /></label>
          <label className="text-xs font-bold text-[#800020]">Attempts<input type="number" min="1" max="10" className={`${FIELD} w-full`} value={attempts} onChange={event => setAttempts(event.target.value)} /></label>
          <label className="text-xs font-bold text-[#800020] sm:col-span-2">Late submissions
            <select className={`${FIELD} w-full`} value={latePolicy} onChange={event => setLatePolicy(event.target.value)}>
              <option value="accept_marked_late">Accept, marked late</option><option value="reject">Do not accept after closing</option><option value="accept">Accept without marking late</option>
            </select>
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={autoMark} onChange={event => setAutoMark(event.target.checked)} /> Mark objective questions automatically (theory questions stay for you)</label>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={uniquePerStudent} onChange={event => setUnique(event.target.checked)} /> <span>A unique paper for every student — objective questions and options in a different order, and their own numbers where you marked them variable. Each student is marked with their own key.</span></label>
        <p className="text-xs">Students never see answers or the marking scheme until you release them after the assessment.</p>
        {error && <p role="alert" className="text-sm font-semibold text-rose-700">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className={SECONDARY} onClick={onClose}>Cancel</button>
          <button type="button" className={PRIMARY} disabled={busy || (mode === 'schedule' && !opensAt)} onClick={submit}>{busy ? 'Posting…' : mode === 'now' ? 'Post now' : 'Schedule'}</button>
        </div>
      </div>
    </div>
  );
}

async function downloadWord(assessment, letterhead, which, onError) {
  try {
    const blob = await buildDocx(assessment, letterhead, which);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${assessment.title.replace(/[^\w\- ]+/g, '').trim() || 'assessment'}${which === 'scheme' ? ' - marking scheme' : ''}.docx`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  } catch (err) {
    onError(err?.message || 'Could not build the Word document.');
  }
}

export default function AssessmentWorkspace({ initial, letterhead, onBack }) {
  const [assessment, setAssessment] = useState(initial);
  const [questions, setQuestions] = useState(initial.questions);
  const [title, setTitle] = useState(initial.title);
  const [dirty, setDirty] = useState(false);
  const [tab, setTab] = useState('questions');
  const paperRef = useRef(null);
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState({ text: '', tone: 'ok' });
  const [review, setReview] = useState(initial.review);
  const [posting, setPosting] = useState(false);
  const [viewing, setViewing] = useState(null);
  const [addType, setAddType] = useState('mcq');
  // Print the whole paper, or only its theory section (when the objectives are written as CBT).
  const [paperPart, setPaperPart] = useState('all');
  // Ruled answer lines under theory questions: off for exams (answer booklets), on for quizzes and tests.
  const [answerSpace, setAnswerSpace] = useState(initial.kind !== 'exam');
  const editable = ['draft', 'finalised'].includes(assessment.status) && initial.canEdit !== false;
  const optionCount = assessment.questions.find(question => question.type === 'mcq')?.options?.length || 4;
  const bloomRows = useMemo(() => liveBloom(questions, assessment.config.bloom), [questions, assessment.config.bloom]);
  const findings = useMemo(() => Object.fromEntries((review?.findings || []).map(finding => [finding.question, finding.issue])), [review]);
  // The preview, print and Word file show the master paper (number templates at their lowest values).
  const OBJECTIVE = ['mcq', 'truefalse', 'fill'];
  // One part on its own keeps the letterhead, with its own questions, total marks and name in the title.
  const preview = useMemo(() => partOfPaper({ ...assessment, title, answerSpace }, masterQuestions(questions), paperPart), [assessment, title, questions, paperPart, answerSpace]);
  const hasBothParts = questions.some(question => OBJECTIVE.includes(question.type)) && questions.some(question => !OBJECTIVE.includes(question.type));
  const missingSchemes = questions.filter(question => !['mcq', 'truefalse'].includes(question.type) && (question.parts?.length ? question.parts.some(part => !part.answer && !part.markingPoints?.length) : !question.answer && !question.markingPoints?.length)).length;

  async function draftSchemes() {
    if (dirty) { say('Save your changes first.', 'warn'); return; }
    setBusy('schemes');
    try {
      const result = await draftMarkingSchemes(assessment.id);
      setAssessment(result.assessment);
      say(result.drafted ? `Ndovera AI drafted ${result.drafted} marking guide${result.drafted === 1 ? '' : 's'} — check them in each question's Marking scheme.${result.remaining ? ` Run it again for the other ${result.remaining}.` : ''}` : 'Every question already has a marking guide.');
    } catch (err) { say(err.message, 'error'); } finally { setBusy(''); }
  }

  useEffect(() => { setQuestions(assessment.questions); setTitle(assessment.title); setDirty(false); }, [assessment]);

  const change = next => { setQuestions(next); setDirty(true); };
  const say = (text, tone = 'ok') => setNotice({ text, tone });

  async function save(extra = {}) {
    setBusy('save');
    try {
      const result = await saveAssessmentEdits(assessment.id, { title, questions, ...extra });
      setAssessment(result.assessment);
      say(result.problems?.length ? `Saved as version ${result.assessment.version}. Still to fix: ${result.problems.join(' ')}` : `Saved as version ${result.assessment.version}.`, result.problems?.length ? 'warn' : 'ok');
    } catch (err) { say(err.message, 'error'); } finally { setBusy(''); }
  }

  async function regenerate(target, instruction) {
    if (dirty) { say('Save your changes before regenerating, so nothing is lost.', 'warn'); return; }
    setBusy(`regen-${target.questionId || target.slot}`);
    try { const result = await regenerateAssessmentQuestion(assessment.id, { ...target, instruction }); setAssessment(result.assessment); say('Question rewritten by Ndovera AI.'); } catch (err) { say(err.message, 'error'); } finally { setBusy(''); }
  }

  async function runReview() {
    setBusy('review');
    try { const result = await reviewAssessment(assessment.id); setReview(result.review); } catch (err) { say(err.message, 'error'); } finally { setBusy(''); }
  }

  async function submitExam() {
    setBusy('submit');
    try { const result = await submitExamPaper(assessment.id); setAssessment(result.assessment); say('Submitted through the exam-question path. Track its approval under Submit Work.'); } catch (err) { say(err.message, 'error'); } finally { setBusy(''); }
  }

  // Print every page (or Save as PDF) from a frame holding only the paper.
  function printDoc(which, part = 'all') {
    setPaperPart(part);
    setTab(which);
    setTimeout(() => {
      const paper = paperRef.current?.querySelector('article.ndv-paper');
      printPaper(paper, which === 'scheme' ? `Marking scheme — ${title}` : title).catch(err => say(err.message || 'Could not open printing.', 'error'));
    }, 350);
  }

  const failCount = assessment.audit?.checks?.filter(check => check.status === 'fail').length || 0;

  return (
    <div className="space-y-4">
      <section className={`${CARD} space-y-3 ndv-no-print`}>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={SECONDARY} onClick={onBack}>← All assessments</button>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#800020]">{KIND_LABELS[assessment.kind]} · {STATUS_LABELS[assessment.status]} · v{assessment.version}</span>
          <span className="text-xs text-[#191970]">{assessment.className} · {assessment.subjectName}</span>
        </div>
        <input aria-label="Title" className="w-full rounded-xl border border-[#c9a96e]/45 bg-white p-2 text-lg font-black text-[#800000]" value={title} disabled={!editable} onChange={event => { setTitle(event.target.value); setDirty(true); }} />
        <div className="flex flex-wrap gap-2">
          {editable && <button type="button" className={PRIMARY} disabled={!dirty || busy === 'save'} onClick={() => save()}>{busy === 'save' ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}</button>}
          {editable && assessment.kind !== 'exam' && <button type="button" className={PRIMARY} disabled={dirty || assessment.pending > 0} onClick={() => setPosting(true)} title={dirty ? 'Save first' : ''}>Approve & post / schedule</button>}
          {editable && assessment.kind === 'exam' && assessment.status === 'finalised' && <button type="button" className={PRIMARY} disabled={dirty || assessment.pending > 0} onClick={() => setPosting(true)} title={dirty ? 'Save first' : ''}>Sit online / schedule</button>}
          {editable && assessment.kind === 'exam' && <button type="button" className={PRIMARY} disabled={dirty || busy === 'submit' || assessment.pending > 0} onClick={submitExam}>{busy === 'submit' ? 'Submitting…' : assessment.submissionId ? 'Resubmit as exam question' : 'Finalise & submit as exam question'}</button>}
          {['posted', 'scheduled'].includes(assessment.status) && <button type="button" className={SECONDARY} onClick={async () => { try { await releaseAssessmentAnswers(assessment.id); say('Answers and marking guides released to students.'); } catch (err) { say(err.message, 'error'); } }}>Release answers to students</button>}
          <button type="button" className={SECONDARY} onClick={() => printDoc('paper')}>Print / PDF paper</button>
          {hasBothParts && <button type="button" className={SECONDARY} onClick={() => printDoc('paper', 'theory')} title="For CBT objectives: print only the theory section">Print / PDF theory only</button>}
          {editable && missingSchemes > 0 && <button type="button" className={SECONDARY} disabled={busy === 'schemes'} onClick={draftSchemes}>{busy === 'schemes' ? 'Drafting…' : `Draft ${missingSchemes} missing marking guide${missingSchemes === 1 ? '' : 's'} with Ndovera AI`}</button>}
          <button type="button" className={SECONDARY} onClick={() => printDoc('scheme')}>Print / PDF marking scheme</button>
          <button type="button" className={SECONDARY} onClick={() => downloadWord(preview, letterhead, 'paper', message => say(message, 'error'))}>Word (.docx) paper</button>
          <button type="button" className={SECONDARY} onClick={() => downloadWord(preview, letterhead, 'scheme', message => say(message, 'error'))}>Word (.docx) scheme</button>
        </div>
        {failCount > 0 && <p className="text-sm font-semibold text-rose-700">The audit found {failCount} problem(s) to fix before this can be {assessment.kind === 'exam' ? 'submitted' : 'posted'}.</p>}
        {assessment.failed?.length > 0 && editable && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-amber-50 p-2 text-sm text-amber-900">
            <span className="flex-1">Ndovera AI could not write {assessment.failed.length} planned question(s).</span>
            {assessment.failed.map(slot => <button key={slot} type="button" className={SECONDARY} disabled={Boolean(busy)} onClick={() => regenerate({ slot })}>{busy === `regen-${slot}` ? 'Writing…' : `Try slot ${slot + 1} again`}</button>)}
            <button type="button" className={SECONDARY} onClick={() => save({ dropFailed: true })}>Remove them</button>
          </div>
        )}
        {notice.text && <p role={notice.tone === 'error' ? 'alert' : 'status'} className={`rounded-xl px-3 py-2 text-sm font-semibold ${notice.tone === 'error' ? 'bg-rose-50 text-rose-800' : notice.tone === 'warn' ? 'bg-amber-50 text-amber-900' : 'bg-emerald-50 text-[#1a5c38]'}`}>{notice.text}</p>}
        <nav className="flex gap-1.5 overflow-x-auto" aria-label="Views">
          {[['questions', 'Questions'], ['paper', 'Preview paper'], ['scheme', 'Preview marking scheme'], ['unique', 'Unique papers'], ['quality', 'Quality & Bloom'], ['history', 'Version history']].map(([key, label]) => (
            <button key={key} type="button" onClick={() => { setTab(key); setPaperPart('all'); }} className={`shrink-0 rounded-xl px-3 py-1.5 text-sm font-semibold ${tab === key ? 'bg-[#800020] text-[#b5e3f4]' : 'bg-white/70 text-[#800020]'}`}>{label}</button>
          ))}
        </nav>
      </section>

      {tab === 'questions' && (
        <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
          <div className="space-y-3">
            {questions.map((question, index) => (
              <QuestionCard
                key={question.id} question={question} number={index + 1} total={questions.length} optionCount={optionCount} readOnly={!editable}
                finding={findings[index + 1]} busy={busy === `regen-${question.id}`}
                onChange={next => change(questions.map(item => (item.id === question.id ? next : item)))}
                onDelete={() => change(questions.filter(item => item.id !== question.id))}
                onDuplicate={() => change([...questions.slice(0, index + 1), { ...question, id: `q-copy-${Date.now()}`, source: 'teacher' }, ...questions.slice(index + 1)])}
                onMove={direction => { const next = [...questions]; const [item] = next.splice(index, 1); next.splice(index + direction, 0, item); change(next); }}
                onRegenerate={instruction => regenerate({ questionId: question.id }, instruction)}
              />
            ))}
            {editable && (
              <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-dashed border-[#c9a96e] p-3">
                <span className="text-sm font-bold text-[#800020]">Add your own question</span>
                <select aria-label="New question type" className={FIELD} value={addType} onChange={event => setAddType(event.target.value)}>{Object.entries(TYPE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
                <button type="button" className={SECONDARY} onClick={() => change([...questions, blankQuestion(addType, questions[questions.length - 1]?.section || 'A')])}>+ Add</button>
              </div>
            )}
          </div>
          <div className="space-y-4">
            <BloomMeter rows={bloomRows} />
            <AuditPanel audit={assessment.audit} review={review} onReview={runReview} reviewing={busy === 'review'} dirty={dirty} />
          </div>
        </div>
      )}
      {tab === 'paper' && (
        <div ref={paperRef}>
          <div className="ndv-no-print mb-2 flex flex-wrap items-center gap-1.5">
            {hasBothParts && [['all', 'Whole paper'], ['objective', 'Objectives only'], ['theory', 'Theory only']].map(([key, label]) => <button key={key} type="button" className={`rounded-xl px-3 py-1 text-xs font-bold ${paperPart === key ? 'bg-[#800020] text-[#b5e3f4]' : 'bg-white text-[#800020]'}`} onClick={() => setPaperPart(key)}>{label}</button>)}
            <label className="ml-2 flex items-center gap-1.5 text-xs font-bold text-[#800020]"><input type="checkbox" checked={answerSpace} onChange={event => setAnswerSpace(event.target.checked)} /> Answer lines on the paper{assessment.kind === 'exam' ? ' (off: students use answer booklets)' : ''}</label>
          </div>
          <StudentPaper assessment={preview} letterhead={letterhead} />
        </div>
      )}
      {tab === 'scheme' && <div ref={paperRef}><MarkingScheme assessment={preview} letterhead={letterhead} /></div>}
      {tab === 'unique' && <UniquePapers assessment={{ ...assessment, answerSpace }} letterhead={letterhead} dirty={dirty} />}
      {tab === 'quality' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <BloomMeter rows={bloomRows} />
          <AuditPanel audit={assessment.audit} review={review} onReview={runReview} reviewing={busy === 'review'} dirty={dirty} />
          {assessment.audit?.pattern?.key && <section className={CARD}><h3 className="font-black text-[#800000]">MCQ answer key</h3><p className="mt-1 break-all font-mono text-sm">{assessment.audit.pattern.key}</p></section>}
        </div>
      )}
      {tab === 'history' && (
        <section className={CARD}>
          <VersionHistory assessmentId={assessment.id} onView={async version => { try { const data = await getAssessmentVersion(assessment.id, version); setViewing({ version, ...data.snapshot }); } catch (err) { say(err.message, 'error'); } }} />
          {viewing && (
            <div className="mt-3 rounded-2xl bg-white p-3">
              <div className="mb-2 flex items-center gap-2"><p className="flex-1 font-black text-[#800000]">Version {viewing.version} — {viewing.label} ({viewing.changedBy}, {new Date(viewing.createdAt).toLocaleString()})</p><button type="button" className={SECONDARY} onClick={() => setViewing(null)}>Close</button></div>
              <StudentPaper assessment={{ ...assessment, ...viewing, questions: masterQuestions(viewing.questions || []) }} letterhead={letterhead} showPageBreaks={false} />
            </div>
          )}
        </section>
      )}
      {posting && <PostDialog assessment={assessment} onClose={() => setPosting(false)} onDone={(next, message) => { setPosting(false); setAssessment(next); say(message); }} />}
    </div>
  );
}
