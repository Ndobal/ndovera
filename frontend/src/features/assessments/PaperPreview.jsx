import React from 'react';
import RichContent from '../../shared/rich/RichContent';
import { BLOOM_LABELS, letter } from './assessmentsApi';
import './paper.css';

// The examination exactly as it prints: the school's letterhead, candidate
// details, instructions, then numbered sections with answer space. The marking
// scheme is a separate document and never part of the student paper.
// Each block carries data-print-block so printPaper (printPaper.js) can lay the
// paper out over as many A4 pages as it needs.

const KIND_TITLES = { quiz: 'QUIZ', assignment: 'ASSIGNMENT', test: 'TEST', exam: 'EXAMINATION' };

export function sectionsOf(assessment) {
  const names = assessment.blueprint?.sections?.length ? assessment.blueprint.sections.map(section => section.name) : [...new Set(assessment.questions.map(question => question.section || 'A'))];
  return names.map(name => ({ name, meta: assessment.blueprint?.sections?.find(section => section.name === name), questions: assessment.questions.filter(question => (question.section || 'A') === name) })).filter(section => section.questions.length);
}

/** Ruled lines to answer on, sized by the marks. */
export function answerLines(question, marks = question.marks) {
  if (['mcq', 'truefalse'].includes(question.type)) return 0;
  if (question.type === 'fill') return 1;
  if (question.parts?.length && marks === question.marks) return 0; // each part has its own lines
  if (question.type === 'short') return Math.max(2, marks * 2);
  if (question.type === 'essay') return Math.min(30, Math.max(6, marks * 2));
  return Math.min(20, Math.max(3, marks * 2));
}

/** Files on ndovera.com are also served from the school's own address; same-origin images always print and export. */
export function sameOriginUrl(url) {
  const value = String(url || '');
  if (!value || typeof window === 'undefined') return value;
  try {
    const parsed = new URL(value, window.location.origin);
    if (parsed.pathname.startsWith('/files/') && /(^|\.)ndovera\.com$/.test(parsed.hostname)) return `${window.location.origin}${parsed.pathname}${parsed.search}`;
  } catch { /* keep as given */ }
  return value;
}

/** Options short enough to sit four across on one line (e.g. ₦4,000 · ₦6,000 …): plain text, no tables or figures. */
export function shortOptions(options) {
  return Array.isArray(options) && options.length >= 2 && options.every(option => {
    const value = String(option ?? '');
    return !/\n|\||```|\$\$/.test(value) && value.replace(/\\[()]/g, '').length <= 22;
  });
}

const marksLabel = marks => `[${marks} mark${marks === 1 ? '' : 's'}]`;

/** A very light wash of a colour for the letterhead background. */
export function tint(hex, alpha = 0.07) {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(String(hex || ''));
  if (!match) return 'transparent';
  return `rgba(${parseInt(match[1], 16)}, ${parseInt(match[2], 16)}, ${parseInt(match[3], 16)}, ${alpha})`;
}

/** The school's letterhead: logo, name, address and contact in the school's colours — one band, at most 1 inch tall. */
export function Letterhead({ letterhead }) {
  const primary = letterhead?.primaryColor || '#14215b';
  const accent = letterhead?.accentColor || '#1a5c38';
  const details = [letterhead?.address, letterhead?.contact].filter(Boolean).join('  ·  ');
  return (
    <div className="ndv-letterhead" style={{ '--lh-primary': primary, '--lh-accent': accent, '--lh-tint': tint(primary) }}>
      {letterhead?.logoUrl ? <img src={sameOriginUrl(letterhead.logoUrl)} alt="" className="ndv-letterhead-logo" /> : null}
      <div className="ndv-letterhead-text">
        <h1 className="ndv-paper-school">{(letterhead?.schoolName || '').toUpperCase()}</h1>
        {letterhead?.motto ? <p className="ndv-letterhead-motto">{letterhead.motto}</p> : null}
        {details ? <p className="ndv-letterhead-line">{details}</p> : null}
      </div>
    </div>
  );
}

/** candidate: a unique paper's version ("Version B") or student (name, admission no.), and its code for finding the key. */
export function PaperHeader({ assessment, letterhead, title, candidate, breakBefore = false }) {
  const minutes = Number(assessment.config?.durationMinutes) || 0;
  const durationText = minutes ? `${Math.floor(minutes / 60) ? `${Math.floor(minutes / 60)} hour${Math.floor(minutes / 60) > 1 ? 's' : ''} ` : ''}${minutes % 60 ? `${minutes % 60} minutes` : ''}`.trim() : '';
  return (
    <header className={`ndv-paper-header ${breakBefore ? 'ndv-page-break' : ''}`} data-print-block>
      <Letterhead letterhead={letterhead} />
      <h2 className="ndv-paper-title">{title || `${(assessment.termName || '').toUpperCase()} ${KIND_TITLES[assessment.kind] || ''}${assessment.sessionName ? ` — ${assessment.sessionName} SESSION` : ''}${assessment.paperPart ? ` — ${assessment.paperPart}` : ''}`.trim()}</h2>
      {candidate ? <p className="ndv-paper-candidate">{candidate.version ? <strong>VERSION {candidate.version}</strong> : null}<span>Paper code: <strong>{candidate.code}</strong></span></p> : null}
      <table className="ndv-paper-fields">
        <tbody>
          <tr><th>Subject</th><td>{assessment.subjectName}</td><th>Class</th><td>{assessment.className}</td></tr>
          <tr><th>Duration</th><td>{durationText || '—'}</td><th>Total marks</th><td>{assessment.audit?.examMarks ?? assessment.config?.totalMarks}</td></tr>
          {letterhead?.showStudentFields !== false && (
            <>
              <tr><th>Student name</th><td colSpan={3} className="ndv-paper-blank">{candidate?.studentName || ''}</td></tr>
              <tr><th>Admission no.</th><td className="ndv-paper-blank">{candidate?.admissionNo || ''}</td><th>Date</th><td className="ndv-paper-blank" /></tr>
            </>
          )}
        </tbody>
      </table>
    </header>
  );
}

function Lines({ count }) {
  return count > 0 ? <div className="ndv-answer-lines" style={{ '--lines': count }} aria-hidden /> : null;
}

function PaperQuestion({ question, number, lines = true }) {
  const hasParts = question.parts?.length > 0;
  return (
    <div className={`ndv-paper-question ${question.pageBreakBefore ? 'ndv-page-break' : ''}`} data-print-block>
      <span className="ndv-paper-number">{number}.</span>
      <div className="ndv-paper-body">
        <div className="ndv-paper-q-head">
          <div className="ndv-paper-prompt">
            {question.compulsory ? <span className="ndv-paper-compulsory">(Compulsory) </span> : null}
            <RichContent text={question.prompt} />
          </div>
          {!hasParts && <span className="ndv-paper-marks">{marksLabel(question.marks)}</span>}
        </div>
        {question.options?.length ? (
          <ol className={`ndv-paper-options ${shortOptions(question.options) ? 'ndv-paper-options--short' : ''}`}>
            {question.options.map((option, index) => <li key={index}><span className="ndv-paper-letter">{letter(index)}.</span> <RichContent inline text={option} /></li>)}
          </ol>
        ) : null}
        {hasParts ? question.parts.map(part => (
          <div key={part.label} className="ndv-paper-part">
            <div className="ndv-paper-q-head">
              <span className="ndv-paper-part-label">({part.label})</span>
              <div className="ndv-paper-prompt"><RichContent text={part.prompt} /></div>
              <span className="ndv-paper-marks">{marksLabel(part.marks)}</span>
            </div>
            <Lines count={lines ? answerLines(question, part.marks) : 0} />
          </div>
        )) : <Lines count={lines ? answerLines(question) : 0} />}
      </div>
    </div>
  );
}

function printedLine(letterhead) {
  const stamp = new Date().toLocaleString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  return `Printed ${stamp}${letterhead?.schoolName ? ` · ${letterhead.schoolName}` : ''} · Ndovera`;
}

/** The student paper. */
export function StudentPaper({ assessment, letterhead, showPageBreaks = true, candidate, breakBefore = false }) {
  let number = 0;
  return (
    <article className="ndv-paper" aria-label={candidate ? `Paper ${candidate.label}` : 'Student paper'}>
      <PaperHeader assessment={assessment} letterhead={letterhead} candidate={candidate} breakBefore={breakBefore} />
      <section className="ndv-paper-instructions" data-print-block>
        <h3>INSTRUCTIONS TO CANDIDATES</h3>
        <RichContent text={assessment.paperInstructions || letterhead?.defaultInstructions || 'Answer the questions as instructed in each section.'} />
      </section>
      {sectionsOf(assessment).map((section, sectionIndex) => (
        <React.Fragment key={section.name}>
          <div className={`ndv-paper-section-head ${showPageBreaks && sectionIndex > 0 && section.meta?.type !== 'mcq' ? 'ndv-page-break' : ''}`} data-print-block>
            <h3>SECTION {section.name}</h3>
            {section.meta?.instructions ? <p className="ndv-paper-section-instructions">{section.meta.instructions}</p> : null}
          </div>
          {section.questions.map(question => { number += 1; return <PaperQuestion key={question.id} question={question} number={number} lines={assessment.answerSpace !== false} />; })}
        </React.Fragment>
      ))}
      <footer className="ndv-paper-end" data-print-block>
        <p>— END OF PAPER —</p>
        {letterhead?.footer ? <p className="ndv-paper-footer-note">{letterhead.footer}</p> : null}
        <p className="ndv-paper-printed">{printedLine(letterhead)}</p>
      </footer>
    </article>
  );
}

function SchemeLines({ answer, markingPoints }) {
  return (
    <>
      {answer ? <div><strong>Expected answer:</strong> <RichContent text={answer} /></div> : null}
      {markingPoints?.length ? <ul>{markingPoints.map((point, i) => <li key={i}><RichContent inline text={point} /></li>)}</ul> : null}
    </>
  );
}

/** The teacher's marking scheme. */
export function MarkingScheme({ assessment, letterhead }) {
  return (
    <article className="ndv-paper" aria-label="Marking scheme">
      <PaperHeader assessment={{ ...assessment, config: { ...assessment.config } }} letterhead={{ ...letterhead, showStudentFields: false }} title={`MARKING SCHEME — ${assessment.title}`} />
      <p className="ndv-confidential" data-print-block>CONFIDENTIAL — for teachers and examiners only. Do not release to students.</p>
      {assessment.questions.map((question, index) => (
        <div key={question.id} className="ndv-paper-question ndv-scheme-item" data-print-block>
          <span className="ndv-paper-number">{index + 1}.</span>
          <div className="ndv-paper-body">
            <p className="ndv-scheme-meta">{question.marks} mark{question.marks === 1 ? '' : 's'} · {BLOOM_LABELS[question.bloom] || question.bloom} · {question.topic || '—'}{question.compulsory ? ' · compulsory' : ''}</p>
            {['mcq', 'truefalse'].includes(question.type) && <p><strong>Answer: {letter(question.answerIndex)}</strong> — <RichContent inline text={question.options?.[question.answerIndex] || ''} /></p>}
            <SchemeLines answer={question.answer} markingPoints={question.markingPoints} />
            {(question.parts || []).map(part => (
              <div key={part.label} className="ndv-scheme-part"><strong>({part.label})</strong> <span className="ndv-scheme-meta">[{part.marks}]</span><SchemeLines answer={part.answer} markingPoints={part.markingPoints} /></div>
            ))}
            {question.alternatives?.length ? <p><strong>Also accept:</strong> {question.alternatives.join('; ')}</p> : null}
            {question.workingSteps?.length ? <div><strong>Working:</strong><ol>{question.workingSteps.map((step, i) => <li key={i}><RichContent inline text={step} /></li>)}</ol></div> : null}
            {question.rubric?.length ? (
              <table className="ndv-rubric"><thead><tr><th>Criterion</th><th>Marks</th></tr></thead>
                <tbody>{question.rubric.map((row, i) => <tr key={i}><td><RichContent inline text={row.criterion} /></td><td>{row.marks}</td></tr>)}</tbody></table>
            ) : null}
          </div>
        </div>
      ))}
      <footer className="ndv-paper-end" data-print-block><p className="ndv-paper-printed">{printedLine(letterhead)}</p></footer>
    </article>
  );
}
