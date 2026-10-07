import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAssignedClasses } from '../classroom/classroomService';
import { KIND_LABELS, PHASE_LABELS, STATUS_LABELS, importPaperFile, importPaperText, listExamSittings, listMyAssessments } from './assessmentsApi';
import { docxToText } from './docxText';
import ExamMarking from './ExamMarking';

// The teacher's Exams page.
//   New exam paper — with Ndovera AI, typed or pasted, or uploaded (Word / PDF).
//     Every way ends in the same editor (answers, marking guides, figures, print),
//     then goes to the HOS for approval, who decides print / CBT and the time.
//   Exams to mark — after a sitting closes: objective marks from the CBT, theory
//     marks from the teacher, then Post scores to the CA score sheet.

const CARD = 'rounded-3xl border border-[#c9a96e]/40 bg-[#b5e3f4] p-5 text-[#191970] dark:border-white/10 dark:bg-slate-900/40 dark:text-slate-200';
const BTN = 'rounded-xl px-4 py-2 text-sm font-bold disabled:opacity-50';
const PRIMARY = `${BTN} bg-[#1a5c38] text-[#b5e3f4]`;
const SECONDARY = `${BTN} border border-[#c9a96e]/50 bg-white text-[#800020]`;
const FIELD = 'mt-1 w-full rounded-xl border border-[#c9a96e]/45 bg-white p-2 text-sm text-[#191970]';
const LABEL = 'block text-xs font-bold uppercase tracking-wide text-[#800020]';

const SAMPLE = `SECTION A: OBJECTIVES
Answer all questions.
1. Which of these is a vector quantity?
A. mass  B. speed  C. velocity  D. time
2. The unit of force is
A. joule  B. newton  C. watt  D. pascal

SECTION B: THEORY
Answer any two questions. Question 1 is compulsory.
1. (a) Define work. [2 marks]
(b) A boy lifts a 5 kg box through 2 m. Calculate the work done. [4 marks]
2. Explain three uses of a concave mirror. (6 marks)

ANSWER KEY
1. C  2. B`;

function ImportPaper({ classes, onImported }) {
  const [how, setHow] = useState('paste');
  const [classId, setClassId] = useState(classes[0]?.id || '');
  const subjects = classes.find(item => item.id === classId)?.subjects || [];
  const [subjectId, setSubjectId] = useState(classes[0]?.subjects?.[0]?.id || '');
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState(120);
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function read() {
    setBusy(true); setError('');
    try {
      const fields = { classId, subjectId, title, durationMinutes: duration, kind: 'exam' };
      let result;
      if (how === 'paste') result = await importPaperText({ ...fields, text });
      else if (/\.docx$/i.test(file?.name || '')) result = await importPaperText({ ...fields, text: await docxToText(file), sourceName: file.name });
      else result = await importPaperFile(fields, file);
      onImported(result);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2" role="group" aria-label="How to add the paper">
        <button type="button" className={how === 'paste' ? PRIMARY : SECONDARY} onClick={() => setHow('paste')}>Type or paste</button>
        <button type="button" className={how === 'upload' ? PRIMARY : SECONDARY} onClick={() => setHow('upload')}>Upload Word or PDF</button>
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        <label className={LABEL}>Class<select className={FIELD} value={classId} onChange={event => { setClassId(event.target.value); setSubjectId(classes.find(item => item.id === event.target.value)?.subjects?.[0]?.id || ''); }}>{classes.map(item => <option key={item.id} value={item.id}>{item.name}{item.arm ? ` ${item.arm}` : ''}</option>)}</select></label>
        <label className={LABEL}>Subject<select className={FIELD} value={subjectId} onChange={event => setSubjectId(event.target.value)}>{subjects.map(subject => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label>
        <label className={LABEL}>Title (optional)<input className={FIELD} value={title} onChange={event => setTitle(event.target.value)} placeholder="First Term Examination" /></label>
        <label className={LABEL}>Duration (minutes)<input type="number" min="0" className={FIELD} value={duration} onChange={event => setDuration(event.target.value)} /></label>
      </div>
      {how === 'paste' ? (
        <label className={LABEL}>Your questions
          <textarea rows={12} className={`${FIELD} font-mono`} value={text} onChange={event => setText(event.target.value)} placeholder={SAMPLE} />
        </label>
      ) : (
        <label className={LABEL}>Word (.docx) or PDF file
          <input type="file" accept=".docx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className={FIELD} onChange={event => setFile(event.target.files?.[0] || null)} />
        </label>
      )}
      <details className="text-sm">
        <summary className="cursor-pointer font-bold text-[#800020]">How to write it so Ndovera reads it perfectly</summary>
        <ul className="mt-1 list-disc space-y-1 pl-5">
          <li>Number every question: 1. 2. 3. … Options as A. B. C. D. (on one line or one per line).</li>
          <li>Show the answer with an ANSWER KEY at the end (1. C 2. B …), an “Answer: B” line, or an asterisk after the right option.</li>
          <li>Start sections with SECTION A / SECTION B and their instruction (e.g. “Answer any three questions. Question 1 is compulsory.”).</li>
          <li>Theory parts as (a) (b) (c), with marks like [4 marks] or (4 marks).</li>
          <li>Pictures cannot be read from files: add them again in the editor with the Graph / Diagram tool or as an image. Scanned papers cannot be read — type or paste them.</li>
        </ul>
        <pre className="mt-2 overflow-x-auto rounded-xl bg-white p-2 text-xs">{SAMPLE}</pre>
      </details>
      {error && <p role="alert" className="text-sm font-semibold text-rose-700">{error}</p>}
      <button type="button" className={PRIMARY} disabled={busy || !subjectId || (how === 'paste' ? text.trim().length < 20 : !file)} onClick={read}>{busy ? 'Reading your paper…' : 'Read my paper'}</button>
    </div>
  );
}

export default function ExamsHub() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('papers');
  const [classes, setClasses] = useState(null);
  const [papers, setPapers] = useState(null);
  const [sittings, setSittings] = useState(null);
  const [adding, setAdding] = useState(false);
  const [imported, setImported] = useState(null);
  const [marking, setMarking] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(() => {
    listMyAssessments().then(data => setPapers((data.assessments || []).filter(item => item.kind === 'exam'))).catch(err => setError(err.message));
    listExamSittings().then(data => setSittings(data.sittings || [])).catch(() => setSittings([]));
  }, []);
  useEffect(() => {
    getAssignedClasses().then(data => setClasses((data?.classes || []).filter(item => item.subjects?.length))).catch(() => setClasses([]));
    load();
  }, [load]);

  const openPaper = id => navigate(`/roles/teacher/ai-assistant?tab=assessment&open=${encodeURIComponent(id)}`);

  if (marking) return <ExamMarking sittingId={marking} onBack={() => { setMarking(''); load(); }} />;

  const toMark = (sittings || []).filter(sitting => sitting.phase === 'marking');
  return (
    <div className="space-y-4">
      <nav className="flex flex-wrap gap-1.5" aria-label="Exams">
        {[['papers', 'Exam papers'], ['marking', `Mark & post scores${toMark.length ? ` (${toMark.length})` : ''}`]].map(([key, label]) => (
          <button key={key} type="button" className={`rounded-xl px-3 py-1.5 text-sm font-semibold ${tab === key ? 'bg-[#800020] text-[#b5e3f4]' : 'bg-white/70 text-[#800020]'}`} onClick={() => setTab(key)}>{label}</button>
        ))}
      </nav>
      {error && <p role="alert" className="font-semibold text-rose-700">{error}</p>}

      {tab === 'papers' && (
        <>
          <section className={`${CARD} space-y-3`}>
            <h2 className="text-lg font-black text-[#800000] dark:text-white">New exam paper</h2>
            <p className="text-sm">However you write it, the paper opens in the same editor to check answers, add marking guides and diagrams, and print — then goes to the Head of School, who approves it for printing or CBT and sets the time.</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={PRIMARY} onClick={() => navigate('/roles/teacher/ai-assistant?tab=assessment&kind=exam')}>✨ With Ndovera AI Assessment</button>
              <button type="button" className={SECONDARY} disabled={!classes?.length} onClick={() => { setAdding(open => !open); setImported(null); }}>✍️ Type, paste or upload my own</button>
            </div>
            {classes && !classes.length && <p className="text-sm">No classes with subjects are assigned to you yet.</p>}
            {adding && classes?.length > 0 && !imported && <ImportPaper classes={classes} onImported={result => { setImported(result); load(); }} />}
            {imported && (
              <div className="space-y-2 rounded-2xl bg-white p-3" role="status">
                <p className="font-bold text-[#1a5c38]">Read {imported.assessment.questions.length} questions{imported.usedAi ? ' (with help from Ndovera AI)' : ''}.</p>
                {[...(imported.warnings || [])].map((warning, index) => <p key={index} className="text-sm text-amber-900">⚠ {warning}</p>)}
                {imported.problems?.length > 0 && <p className="text-sm text-amber-900">⚠ {imported.problems.length} question{imported.problems.length === 1 ? '' : 's'} still need{imported.problems.length === 1 ? 's' : ''} something (an answer or a marking guide) before the paper can be submitted. The editor shows which.</p>}
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={PRIMARY} onClick={() => openPaper(imported.assessment.id)}>Open in the editor</button>
                  <button type="button" className={SECONDARY} onClick={() => setImported(null)}>Add another</button>
                </div>
              </div>
            )}
          </section>
          <section className={CARD}>
            <h2 className="mb-2 font-black text-[#800000] dark:text-white">My exam papers</h2>
            {!papers ? <p role="status">Loading…</p> : !papers.length ? <p className="text-sm">No exam papers yet.</p> : (
              <ul className="space-y-2">
                {papers.map(item => (
                  <li key={item.id}>
                    <button type="button" onClick={() => openPaper(item.id)} className="flex w-full flex-wrap items-center gap-2 rounded-2xl bg-white/80 px-4 py-3 text-left text-[#191970] hover:ring-2 hover:ring-[#800020]/30">
                      <span className="flex-1 font-bold">{item.title}</span>
                      <span className="text-xs">{KIND_LABELS[item.kind]} · {item.className} · {item.subjectName}</span>
                      <span className="rounded-full bg-[#fff6e0] px-2 py-0.5 text-xs font-bold">{STATUS_LABELS[item.status] || item.status}</span>
                      <span className="text-xs">{item.questionCount} questions · {new Date(item.updatedAt).toLocaleDateString()}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {tab === 'marking' && (
        <section className={CARD}>
          <h2 className="mb-2 font-black text-[#800000] dark:text-white">Approved exams</h2>
          {!sittings ? <p role="status">Loading…</p> : !sittings.length ? <p className="text-sm">No approved exams yet. When the Head of School approves a paper, it appears here.</p> : (
            <ul className="space-y-2">
              {sittings.map(sitting => (
                <li key={sitting.id} className="flex flex-wrap items-center gap-2 rounded-2xl bg-white/80 px-4 py-3 text-[#191970]">
                  <span className="flex-1"><strong>{sitting.title}</strong><span className="block text-xs">{sitting.className} · {sitting.subjectName} · {sitting.modeLabel}{sitting.opensAt ? ` · ${new Date(sitting.opensAt).toLocaleString()} – ${new Date(sitting.closesAt).toLocaleTimeString()}` : ''}</span></span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${sitting.phase === 'marking' ? 'bg-amber-100 text-amber-900' : sitting.phase === 'posted' ? 'bg-emerald-100 text-emerald-900' : 'bg-[#fff6e0]'}`}>{PHASE_LABELS[sitting.phase] || sitting.phase}</span>
                  <button type="button" className={SECONDARY} onClick={() => setMarking(sitting.id)}>{sitting.phase === 'posted' ? 'View / post again' : 'Mark & post'}</button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
