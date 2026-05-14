import React, { useMemo, useState, useEffect } from 'react';
import * as svc from './classroomService';

const SURFACE = 'rounded-3xl border border-[#c9a96e]/45 bg-[#f5deb3] p-5 shadow-[0_18px_42px_rgba(128,0,0,0.08)] dark:border-[#bf00ff]/35 dark:bg-[#800000]/75 dark:shadow-[0_0_28px_rgba(191,0,255,0.18)]';
const SUB_SURFACE = 'rounded-2xl border border-[#c9a96e]/45 bg-[#fff8f0] p-4 dark:border-[#bf00ff]/35 dark:bg-black/20';
const LABEL = 'text-xs font-semibold uppercase tracking-[0.18em] text-[#800020] dark:text-[#bf00ff]';
const TITLE = 'text-xl font-bold text-[#800000] dark:text-[#ffffff]';
const BODY = 'text-sm text-[#191970] dark:text-[#39ff14]';
const INPUT = 'w-full rounded-2xl border border-[#c9a96e]/45 bg-[#fff8f0] px-4 py-3 text-sm text-[#191970] placeholder:text-[#800020]/65 focus:outline-none focus:ring-2 focus:ring-[#1a5c38] dark:border-[#bf00ff]/35 dark:bg-black/20 dark:text-[#ffffff] dark:placeholder:text-[#39ff14]/55 dark:focus:ring-[#00ffff]';
const PRIMARY_BUTTON = 'rounded-2xl bg-[#1a5c38] px-4 py-2 text-sm font-bold text-[#f5deb3] transition-colors hover:bg-[#154a2e] disabled:cursor-not-allowed disabled:opacity-60 dark:bg-[#00ffff] dark:text-[#000000] dark:hover:bg-[#7dfcff]';
const SECONDARY_BUTTON = 'rounded-2xl border border-[#c9a96e]/45 bg-[#fff8f0] px-4 py-2 text-sm font-semibold text-[#191970] transition-colors hover:bg-[#f2e1bf] disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#bf00ff]/35 dark:bg-black/20 dark:text-[#ffffff] dark:hover:bg-[#800000]/85';
const DANGER_BUTTON = 'rounded-2xl border border-[#800000]/25 bg-white/70 px-3 py-2 text-sm font-semibold text-[#800000] transition-colors hover:bg-[#ffe8db] dark:border-[#ff5f8d]/35 dark:bg-black/20 dark:text-[#ffffff] dark:hover:bg-[#5a1024]';
const FLOATING_ADD_BUTTON = 'fixed bottom-8 right-8 z-[70] flex h-14 w-14 items-center justify-center rounded-full bg-[#1a5c38] text-3xl font-bold text-[#f5deb3] shadow-[0_18px_40px_rgba(26,92,56,0.35)] transition-transform hover:scale-105 hover:bg-[#154a2e] dark:bg-[#00ffff] dark:text-[#000000] dark:shadow-[0_0_26px_rgba(0,255,255,0.35)] dark:hover:bg-[#7dfcff]';

const QUESTION_TYPE_OPTIONS = [
  { value: 'mcq', label: 'MCQ' },
  { value: 'shortanswer', label: 'Short Answer' },
  { value: 'fillgaps', label: 'Fill In The Blanks' },
  { value: 'crossmatching', label: 'Cross Matching' },
  { value: 'essay', label: 'Essay' },
  { value: 'comprehension', label: 'Comprehension' },
  { value: 'longanswer', label: 'Long Answer' },
];

const IMPORT_SAMPLE = `1. What is the capital of Nigeria?
A. Lagos
B. Abuja
C. Kano
D. Ibadan
Answer: B

[COMPREHENSION]
Passage:
Ada read the story aloud before the class assembly.
Question: Why was Ada able to read before the assembly?
Marking Guide: Mention that Ada prepared and read aloud confidently.

[CROSS MATCHING]
Prompt: Match the countries to their capitals.
Nigeria -> Abuja
Ghana -> Accra
Kenya -> Nairobi`;

function createId(prefix = 'item') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function createQuestion(type = 'mcq') {
  switch (type) {
    case 'shortanswer':
      return { id: createId('question'), type, prompt: '', answer: '', imageUrl: '', score: 1 };
    case 'fillgaps':
      return { id: createId('question'), type, prompt: '', acceptedAnswers: '', imageUrl: '', score: 1 };
    case 'crossmatching':
      return {
        id: createId('question'),
        type,
        prompt: '',
        pairs: [
          { id: createId('pair'), left: '', right: '' },
          { id: createId('pair'), left: '', right: '' },
        ],
        imageUrl: '',
        score: 1,
      };
    case 'essay':
      return { id: createId('question'), type, prompt: '', markingGuide: '', imageUrl: '', score: 1 };
    case 'comprehension':
      return { id: createId('question'), type, passage: '', prompt: '', markingGuide: '', imageUrl: '', score: 1 };
    case 'longanswer':
      return { id: createId('question'), type, prompt: '', markingGuide: '', imageUrl: '', score: 1 };
    case 'mcq':
    default:
      return {
        id: createId('question'),
        type: 'mcq',
        prompt: '',
        options: ['', '', '', ''],
        answer: '',
        explanation: '',
        imageUrl: '',
        score: 1,
      };
  }
}

function buildFreshDraft(defaultClassId = '', defaultSubjectId = '') {
  return {
    classId: defaultClassId,
    subjectId: defaultSubjectId,
    title: '',
    description: '',
    dueAt: '',
    questions: [createQuestion('mcq')],
  };
}

function isQuestionBlank(question) {
  if (!question) return true;
  const prompt = String(question.prompt || '').trim();
  const passage = String(question.passage || '').trim();
  const options = Array.isArray(question.options) ? question.options.some(option => String(option || '').trim()) : false;
  const pairs = Array.isArray(question.pairs)
    ? question.pairs.some(pair => String(pair.left || '').trim() || String(pair.right || '').trim())
    : false;
  return !prompt && !passage && !options && !pairs;
}

function formatDueDate(value) {
  if (!value) return 'No due date';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

function normalizeQuestionScore(value) {
  const numericScore = Number(value);
  return Number.isFinite(numericScore) && numericScore > 0 ? numericScore : 1;
}

function calculateTotalScore(questions = []) {
  return questions.reduce((total, question) => total + normalizeQuestionScore(question?.score), 0);
}

function typeLabel(type) {
  switch (String(type || '').toLowerCase()) {
    case 'mcq': return 'MCQ';
    case 'shortanswer': return 'Short Answer';
    case 'fillgaps': return 'Fill In The Blanks';
    case 'crossmatching': return 'Cross Matching';
    case 'essay': return 'Essay';
    case 'comprehension': return 'Comprehension';
    case 'longanswer': return 'Long Answer';
    case 'mixed': return 'Mixed Format';
    default: return 'Assignment';
  }
}

function getOptionLabel(index) {
  return String.fromCharCode(65 + index);
}

function normalizeTypeToken(token) {
  const normalized = String(token || '').toLowerCase().replace(/[^a-z]/g, '');
  if (normalized.includes('mcq') || normalized.includes('multiplechoice')) return 'mcq';
  if (normalized.includes('short')) return 'shortanswer';
  if (normalized.includes('fill')) return 'fillgaps';
  if (normalized.includes('cross') || normalized.includes('match')) return 'crossmatching';
  if (normalized.includes('comprehension')) return 'comprehension';
  if (normalized.includes('long')) return 'longanswer';
  if (normalized.includes('essay')) return 'essay';
  return '';
}

function stripLeadingNumber(text) {
  return String(text || '').replace(/^\s*\d+[.)]\s*/, '').trim();
}

function mapAnswerTokenToOption(answerToken, options) {
  const cleaned = String(answerToken || '').trim();
  if (!cleaned) return '';
  if (/^[A-Z]$/i.test(cleaned)) {
    const answerIndex = cleaned.toUpperCase().charCodeAt(0) - 65;
    return options[answerIndex] || cleaned.toUpperCase();
  }
  return cleaned;
}

function parseMcqBlock(blockText) {
  const lines = String(blockText || '').split('\n').map(line => line.trim()).filter(Boolean);
  const optionLines = lines.filter(line => /^[A-H][).:-]\s+/.test(line));
  if (optionLines.length < 2) return null;

  const promptLines = [];
  const options = [];
  let answer = '';
  let explanation = '';
  let imageUrl = '';

  for (const line of lines) {
    if (/^answer\s*:/i.test(line)) {
      answer = mapAnswerTokenToOption(line.split(/:/).slice(1).join(':').trim(), options);
      continue;
    }
    if (/^explanation\s*:/i.test(line)) {
      explanation = line.split(/:/).slice(1).join(':').trim();
      continue;
    }
    if (/^image\s*:/i.test(line)) {
      imageUrl = line.split(/:/).slice(1).join(':').trim();
      continue;
    }
    if (/^[A-H][).:-]\s+/.test(line)) {
      options.push(line.replace(/^[A-H][).:-]\s+/, '').trim());
      continue;
    }
    promptLines.push(stripLeadingNumber(line));
  }

  return {
    ...createQuestion('mcq'),
    prompt: promptLines.join(' ').trim(),
    options: options.length ? options : ['', '', '', ''],
    answer,
    explanation,
    imageUrl,
  };
}

function parseStructuredBlock(type, blockText) {
  const lines = String(blockText || '').replace(/\r/g, '').split('\n');
  const trimmedLines = lines.map(line => line.trim()).filter(Boolean);
  const imageLine = trimmedLines.find(line => /^image\s*:/i.test(line));
  const imageUrl = imageLine ? imageLine.split(/:/).slice(1).join(':').trim() : '';

  if (type === 'crossmatching') {
    const promptLine = trimmedLines.find(line => /^prompt\s*:/i.test(line)) || '';
    const pairs = trimmedLines
      .filter(line => line.includes('->'))
      .map(line => {
        const [left, right] = line.split('->');
        return { id: createId('pair'), left: String(left || '').trim(), right: String(right || '').trim() };
      })
      .filter(pair => pair.left || pair.right);

    return {
      ...createQuestion('crossmatching'),
      prompt: promptLine ? promptLine.split(/:/).slice(1).join(':').trim() : stripLeadingNumber(trimmedLines.find(line => !line.includes('->')) || ''),
      pairs: pairs.length ? pairs : createQuestion('crossmatching').pairs,
      imageUrl,
    };
  }

  if (type === 'comprehension') {
    const questionIndex = lines.findIndex(line => /^question\s*:/i.test(line.trim()));
    const answerIndex = lines.findIndex(line => /^(marking guide|answer)\s*:/i.test(line.trim()));
    const passageStart = lines.findIndex(line => /^passage\s*:/i.test(line.trim()));
    const passageLines = [];
    if (passageStart !== -1) {
      const stopIndex = [questionIndex, answerIndex].filter(index => index > passageStart).sort((a, b) => a - b)[0] || lines.length;
      for (let index = passageStart; index < stopIndex; index += 1) {
        const line = lines[index].replace(/^passage\s*:/i, '').trim();
        if (line || index > passageStart) passageLines.push(line);
      }
    }
    const questionLine = questionIndex !== -1 ? lines[questionIndex].replace(/^question\s*:/i, '').trim() : '';
    const answerLine = answerIndex !== -1 ? lines[answerIndex].replace(/^(marking guide|answer)\s*:/i, '').trim() : '';
    return {
      ...createQuestion('comprehension'),
      passage: passageLines.join('\n').trim(),
      prompt: stripLeadingNumber(questionLine || trimmedLines.find(line => !/^passage\s*:/i.test(line) && !/^image\s*:/i.test(line)) || ''),
      markingGuide: answerLine,
      imageUrl,
    };
  }

  const questionLine = trimmedLines.find(line => /^question\s*:/i.test(line));
  const answerLine = trimmedLines.find(line => /^(answer|marking guide|answers)\s*:/i.test(line));
  const fallbackPrompt = trimmedLines.find(line => !/^image\s*:/i.test(line) && !/^(answer|marking guide|answers)\s*:/i.test(line));

  if (type === 'fillgaps') {
    return {
      ...createQuestion('fillgaps'),
      prompt: stripLeadingNumber(questionLine ? questionLine.split(/:/).slice(1).join(':').trim() : fallbackPrompt || ''),
      acceptedAnswers: answerLine ? answerLine.split(/:/).slice(1).join(':').trim() : '',
      imageUrl,
    };
  }

  if (type === 'shortanswer') {
    return {
      ...createQuestion('shortanswer'),
      prompt: stripLeadingNumber(questionLine ? questionLine.split(/:/).slice(1).join(':').trim() : fallbackPrompt || ''),
      answer: answerLine ? answerLine.split(/:/).slice(1).join(':').trim() : '',
      imageUrl,
    };
  }

  return {
    ...createQuestion(type === 'longanswer' ? 'longanswer' : 'essay'),
    prompt: stripLeadingNumber(questionLine ? questionLine.split(/:/).slice(1).join(':').trim() : fallbackPrompt || ''),
    markingGuide: answerLine ? answerLine.split(/:/).slice(1).join(':').trim() : '',
    imageUrl,
  };
}

function parseImportedQuestions(rawText) {
  const normalized = String(rawText || '').replace(/\r/g, '').trim();
  if (!normalized) {
    return { questions: [], errors: ['Paste some question text before importing.'] };
  }

  const blocks = normalized
    .split(/\n\s*\n(?=(?:\[[^\]]+\]|\d+[.)]\s+))/)
    .map(block => block.trim())
    .filter(Boolean);

  const questions = [];
  const errors = [];

  (blocks.length ? blocks : [normalized]).forEach((block, index) => {
    const headerMatch = block.match(/^\s*\[([^\]]+)\]\s*/);
    const explicitType = normalizeTypeToken(headerMatch?.[1] || '');
    const content = headerMatch ? block.slice(headerMatch[0].length).trim() : block;
    const inferredType = explicitType || (/^[\s\S]*^[A-H][).:-]\s+/m.test(content) ? 'mcq' : 'essay');

    const parsedQuestion = inferredType === 'mcq'
      ? parseMcqBlock(content)
      : parseStructuredBlock(inferredType, content);

    if (!parsedQuestion || isQuestionBlank(parsedQuestion)) {
      errors.push(`Block ${index + 1} could not be parsed into a supported question.`);
      return;
    }

    questions.push({ ...parsedQuestion, id: createId('question') });
  });

  return { questions, errors };
}

function normalizeQuestionForSave(question, index) {
  const base = {
    id: question.id || createId('question'),
    order: index + 1,
    type: question.type,
    prompt: String(question.prompt || '').trim(),
    imageUrl: String(question.imageUrl || '').trim(),
    score: normalizeQuestionScore(question.score),
  };

  if (question.type === 'mcq') {
    const options = (question.options || []).map(option => String(option || '').trim()).filter(Boolean);
    return {
      ...base,
      options,
      answer: mapAnswerTokenToOption(question.answer, options),
      explanation: String(question.explanation || '').trim(),
    };
  }

  if (question.type === 'fillgaps') {
    return {
      ...base,
      acceptedAnswers: String(question.acceptedAnswers || '')
        .split(',')
        .map(answer => answer.trim())
        .filter(Boolean),
    };
  }

  if (question.type === 'crossmatching') {
    return {
      ...base,
      pairs: (question.pairs || [])
        .map(pair => ({ left: String(pair.left || '').trim(), right: String(pair.right || '').trim() }))
        .filter(pair => pair.left || pair.right),
    };
  }

  if (question.type === 'comprehension') {
    return {
      ...base,
      passage: String(question.passage || '').trim(),
      markingGuide: String(question.markingGuide || '').trim(),
    };
  }

  if (question.type === 'essay' || question.type === 'longanswer') {
    return {
      ...base,
      markingGuide: String(question.markingGuide || '').trim(),
    };
  }

  return {
    ...base,
    answer: String(question.answer || '').trim(),
  };
}

function inferAssignmentFormat(questions) {
  const types = Array.from(new Set((questions || []).map(question => question.type).filter(Boolean)));
  if (types.length === 0) return 'assignment';
  return types.length === 1 ? types[0] : 'mixed';
}

function summarizeAssignment(assignment) {
  const questions = Array.isArray(assignment.questions) ? assignment.questions : [];
  const metadata = assignment.metadata && typeof assignment.metadata === 'object' ? assignment.metadata : {};
  const questionCount = questions.length || Number(metadata.questionCount || 0);
  const typeSummary = Array.from(new Set(questions.map(question => typeLabel(question.type)).filter(Boolean))).join(', ');
  return {
    format: typeLabel(assignment.format),
    questionCount,
    typeSummary: typeSummary || 'General assignment',
    totalScore: Number(metadata.totalScore || 0) || calculateTotalScore(questions),
  };
}

function QuestionImagePreview({ imageUrl }) {
  const [err, setErr] = useState(false);
  if (!imageUrl) return null;
  return (
    <div className={SUB_SURFACE}>
      {err ? (
        <p className="text-xs text-[#800020] dark:text-[#bf00ff] italic">Image could not load: <span className="break-all">{imageUrl}</span></p>
      ) : (
        <img
          src={imageUrl}
          alt="Question"
          className="max-h-56 w-full rounded-2xl object-contain"
          onError={() => setErr(true)}
        />
      )}
    </div>
  );
}

function SubmissionsPanel({ assignment, onClose }) {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [grading, setGrading] = useState({}); // { [submissionId]: { grade, feedback } }
  const [savingId, setSavingId] = useState(null);
  const [savedIds, setSavedIds] = useState([]);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    svc.getSubmissions(assignment.id)
      .then(d => setSubmissions(d?.submissions || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [assignment.id]);

  async function handleGrade(sub) {
    const g = grading[sub.id];
    if (!g || g.grade === '' || g.grade === undefined) { setMsg('Enter a grade (0-100) first.'); return; }
    setSavingId(sub.id); setMsg('');
    try {
      const res = await svc.gradeSubmission(sub.id, { grade: Number(g.grade), feedback: g.feedback || '' });
      if (res?.success) {
        setSavedIds(prev => [...prev, sub.id]);
        setSubmissions(prev => prev.map(s => s.id === sub.id ? { ...s, grade: Number(g.grade), feedback: g.feedback || '', gradedAt: res.gradedAt } : s));
        setMsg('Grade saved!');
      } else { setMsg(res?.error || 'Could not save grade.'); }
    } catch (err) { setMsg(err.message || 'Error saving grade.'); }
    finally { setSavingId(null); }
  }

  const questions = Array.isArray(assignment.questions) ? assignment.questions : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-[2rem] border border-[#c9a96e]/45 bg-[#fff8f0] p-6 shadow-2xl dark:border-[#bf00ff]/35 dark:bg-[#800000]/92">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
          <div>
            <p className={LABEL}>Submissions</p>
            <h3 className={TITLE}>{assignment.title}</h3>
            <p className={BODY}>{submissions.length} submission(s)</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-2xl border border-[#800000]/25 bg-white/70 px-3 py-2 text-sm font-semibold text-[#800000] hover:bg-[#ffe8db]">Close</button>
        </div>
        {msg && <p className={`mb-3 text-sm font-bold ${msg.includes('saved') ? 'text-[#1a5c38]' : 'text-red-600'}`}>{msg}</p>}
        {loading ? (
          <p className={BODY}>Loading submissions...</p>
        ) : submissions.length === 0 ? (
          <div className={SUB_SURFACE}><p className={BODY}>No students have submitted this assignment yet.</p></div>
        ) : (
          <div className="space-y-4">
            {submissions.map(sub => {
              const content = sub.content || {};
              const answers = content.answers || content || {};
              const isAlreadyGraded = sub.grade != null;
              return (
                <div key={sub.id} className={SUB_SURFACE}>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div>
                      <p className="font-bold text-[#800000] dark:text-white">{sub.studentName || sub.studentId}</p>
                      <p className="text-xs text-[#800020] font-semibold">Submitted: {sub.submittedAt ? new Date(sub.submittedAt).toLocaleString() : '—'}</p>
                    </div>
                    {isAlreadyGraded && (
                      <span className="rounded-full bg-[#1a5c38] px-3 py-1 text-xs font-bold text-[#f5deb3]">Graded: {sub.grade}/100</span>
                    )}
                  </div>
                  {/* Show answers */}
                  {questions.length > 0 ? (
                    <div className="space-y-1 mb-3">
                      {questions.map((q, qi) => {
                        const ans = answers[q.id || qi];
                        return (
                          <div key={q.id || qi} className="rounded-xl bg-[#f5deb3]/60 dark:bg-black/20 px-3 py-2">
                            <p className="text-xs font-bold text-[#800020]">Q{qi + 1}: {q.prompt || q.text}</p>
                            <p className="text-sm font-semibold text-[#191970] dark:text-slate-200">
                              {ans !== undefined && ans !== '' ? String(ans) : <span className="italic text-[#800020]">No answer</span>}
                            </p>
                            {q.answer && <p className="text-xs font-semibold text-[#1a5c38]">Correct: {String(q.answer)}</p>}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    answers.response ? (
                      <div className="rounded-xl bg-[#f5deb3]/60 dark:bg-black/20 px-3 py-2 mb-3">
                        <p className="text-xs font-bold text-[#800020] mb-1">Response</p>
                        <p className="text-sm font-semibold text-[#191970] dark:text-slate-200">{String(answers.response)}</p>
                      </div>
                    ) : null
                  )}
                  {/* Grading form */}
                  <div className="flex flex-wrap gap-3 items-end mt-2">
                    <div>
                      <label className={LABEL}>Score (0–100)</label>
                      <input
                        type="number" min="0" max="100"
                        value={grading[sub.id]?.grade !== undefined ? grading[sub.id].grade : (isAlreadyGraded ? sub.grade : '')}
                        onChange={e => setGrading(prev => ({ ...prev, [sub.id]: { ...prev[sub.id], grade: e.target.value } }))}
                        className="mt-1 w-24 rounded-xl border border-[#c9a96e]/40 bg-[#f5deb3] dark:bg-slate-900 text-[#191970] dark:text-slate-100 px-3 py-2 text-sm outline-none"
                        placeholder="0–100"
                      />
                    </div>
                    <div className="flex-1 min-w-[160px]">
                      <label className={LABEL}>Feedback (optional)</label>
                      <input
                        value={grading[sub.id]?.feedback !== undefined ? grading[sub.id].feedback : (sub.feedback || '')}
                        onChange={e => setGrading(prev => ({ ...prev, [sub.id]: { ...prev[sub.id], feedback: e.target.value } }))}
                        className="mt-1 w-full rounded-xl border border-[#c9a96e]/40 bg-[#f5deb3] dark:bg-slate-900 text-[#191970] dark:text-slate-100 px-3 py-2 text-sm outline-none"
                        placeholder="Well done! or areas to improve..."
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleGrade(sub)}
                      disabled={savingId === sub.id}
                      className="bg-[#1a5c38] hover:bg-[#154a2e] text-[#f5deb3] font-bold px-4 py-2 rounded-2xl text-sm disabled:opacity-60"
                    >
                      {savingId === sub.id ? 'Saving...' : savedIds.includes(sub.id) ? '✓ Saved' : 'Save Grade'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function AssignmentViewer({ assignment, onClose }) {
  const questions = Array.isArray(assignment.questions) ? assignment.questions : [];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-[2rem] border border-[#c9a96e]/45 bg-[#fff8f0] p-6 shadow-[0_24px_60px_rgba(128,0,0,0.18)] dark:border-[#bf00ff]/35 dark:bg-[#800000]/92 dark:shadow-[0_0_40px_rgba(191,0,255,0.28)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className={LABEL}>Assignment</p>
            <h3 className={TITLE}>{assignment.title}</h3>
            {assignment.description && <p className={`${BODY} mt-1`}>{assignment.description}</p>}
            <p className={`${BODY} mt-1`}>Subject: <strong>{assignment.subjectName || '—'}</strong> · Questions: <strong>{questions.length}</strong></p>
          </div>
          <button type="button" onClick={onClose} className="rounded-2xl border border-[#800000]/25 bg-white/70 px-3 py-2 text-sm font-semibold text-[#800000] hover:bg-[#ffe8db] dark:border-[#ff5f8d]/35 dark:bg-black/20 dark:text-[#ffffff]">Close</button>
        </div>
        <div className="mt-5 space-y-4">
          {questions.length === 0 && <p className={BODY}>No questions stored for this assignment.</p>}
          {questions.map((question, index) => (
            <div key={question.id || index} className={SURFACE}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className={LABEL}>Question {index + 1} · {typeLabel(question.type)}</p>
                  <p className="mt-2 text-base font-semibold text-[#191970] dark:text-[#ffffff] whitespace-pre-wrap">{question.prompt || question.passage || '—'}</p>
                </div>
                <span className="rounded-full bg-[#1a5c38] px-3 py-1 text-xs font-bold text-[#f5deb3] dark:bg-[#00ffff] dark:text-[#000000]">{normalizeQuestionScore(question.score)} pt{normalizeQuestionScore(question.score) !== 1 ? 's' : ''}</span>
              </div>
              <QuestionImagePreview imageUrl={question.imageUrl} />
              {question.type === 'mcq' && Array.isArray(question.options) && (
                <div className="mt-3 space-y-1">
                  {question.options.map((opt, oi) => (
                    <div key={oi} className={`flex gap-2 items-center rounded-xl px-3 py-2 text-sm ${opt === question.answer ? 'bg-[#1a5c38]/15 dark:bg-[#00ffff]/15 font-bold text-[#1a5c38] dark:text-[#00ffff]' : 'text-[#191970] dark:text-[#39ff14]'}`}>
                      <span className="font-bold">{getOptionLabel(oi)}.</span> {opt}
                      {opt === question.answer && <span className="ml-1 text-xs">(Answer)</span>}
                    </div>
                  ))}
                </div>
              )}
              {question.type === 'crossmatching' && Array.isArray(question.pairs) && (
                <div className="mt-3 space-y-1">
                  {question.pairs.map((pair, pi) => (
                    <div key={pi} className="grid grid-cols-[1fr,auto,1fr] gap-2 text-sm text-[#191970] dark:text-[#39ff14]">
                      <span>{pair.left}</span><span className="text-center">↔</span><span>{pair.right}</span>
                    </div>
                  ))}
                </div>
              )}
              {(question.markingGuide || question.answer || question.acceptedAnswers) && (
                <div className="mt-3 rounded-xl border border-[#c9a96e]/45 bg-[#f5deb3]/40 px-3 py-2 dark:border-[#bf00ff]/35 dark:bg-black/20">
                  <p className={LABEL}>Answer / Guide</p>
                  <p className="mt-1 text-sm text-[#191970] dark:text-[#39ff14] whitespace-pre-wrap">{question.markingGuide || question.answer || (Array.isArray(question.acceptedAnswers) ? question.acceptedAnswers.join(', ') : question.acceptedAnswers) || '—'}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function TeacherAssignmentsPanel({
  assignedClasses = [],
  currentClassId = '',
  currentClassName = '',
  assignments = [],
  onRefreshAssignments,
  onSelectClass,
}) {
  const [viewingAssignment, setViewingAssignment] = useState(null);
  const [submissionsAssignment, setSubmissionsAssignment] = useState(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerStep, setComposerStep] = useState('class');
  const [composerMode, setComposerMode] = useState('build');
  const [composerError, setComposerError] = useState('');
  const [composerNotice, setComposerNotice] = useState('');
  const [composerSaving, setComposerSaving] = useState(false);
  const [uploadingQuestionId, setUploadingQuestionId] = useState('');
  const [importText, setImportText] = useState('');
  const [importedFromText, setImportedFromText] = useState(false);
  const [successState, setSuccessState] = useState(null);
  const [draft, setDraft] = useState(buildFreshDraft(currentClassId || assignedClasses[0]?.id || ''));

  const draftClass = useMemo(
    () => assignedClasses.find(classroom => classroom.id === draft.classId) || null,
    [assignedClasses, draft.classId]
  );
  const subjectOptions = draftClass?.subjects || [];
  const draftSubject = subjectOptions.find(subject => subject.id === draft.subjectId) || null;
  const hasMeaningfulQuestions = draft.questions.some(question => !isQuestionBlank(question));
  const shouldShowQuestionEditors = composerMode === 'build' || hasMeaningfulQuestions;

  function openComposer() {
    const initialClassId = currentClassId || assignedClasses[0]?.id || '';
    const initialClass = assignedClasses.find(classroom => classroom.id === initialClassId) || assignedClasses[0] || null;
    const initialSubjects = initialClass?.subjects || [];
    const initialSubjectId = assignedClasses.length <= 1 && initialSubjects.length === 1 ? initialSubjects[0].id : '';

    setDraft(buildFreshDraft(initialClassId, initialSubjectId));
    setImportText('');
    setImportedFromText(false);
    setComposerMode('build');
    setComposerError('');
    setComposerNotice('');
    setSuccessState(null);
    setComposerStep(assignedClasses.length > 1 ? 'class' : initialSubjects.length > 1 ? 'subject' : 'details');
    setComposerOpen(true);
  }

  function closeComposer() {
    setComposerOpen(false);
    setComposerSaving(false);
    setComposerError('');
    setComposerNotice('');
    setImportText('');
    setImportedFromText(false);
  }

  function setDraftValue(key, value) {
    setDraft(prev => ({ ...prev, [key]: value }));
  }

  function updateDraftClass(nextClassId) {
    const nextClass = assignedClasses.find(classroom => classroom.id === nextClassId) || null;
    const nextSubjects = nextClass?.subjects || [];
    setDraft(prev => ({
      ...prev,
      classId: nextClassId,
      subjectId: nextSubjects.length === 1 ? nextSubjects[0].id : '',
    }));
  }

  function proceedFromClass() {
    if (!draft.classId) {
      setComposerError('Choose a class before continuing.');
      return;
    }
    const nextClass = assignedClasses.find(classroom => classroom.id === draft.classId) || null;
    const nextSubjects = nextClass?.subjects || [];
    if (nextSubjects.length === 0) {
      setComposerError('No subject is assigned to you in this class yet.');
      return;
    }
    if (nextSubjects.length === 1) {
      setDraft(prev => ({ ...prev, subjectId: nextSubjects[0].id }));
      setComposerStep('details');
      setComposerError('');
      return;
    }
    setComposerStep('subject');
    setComposerError('');
  }

  function proceedFromSubject() {
    if (!draft.subjectId) {
      setComposerError('Choose a subject before continuing.');
      return;
    }
    setComposerStep('details');
    setComposerError('');
  }

  function goBack() {
    if (composerStep === 'details') {
      setComposerStep(assignedClasses.length > 1 ? 'subject' : 'subject');
      if (assignedClasses.length > 1 && subjectOptions.length <= 1) {
        setComposerStep('class');
      }
      return;
    }
    if (composerStep === 'subject') {
      setComposerStep('class');
    }
  }

  function addQuestion(type) {
    setDraft(prev => ({ ...prev, questions: [...prev.questions, createQuestion(type)] }));
  }

  function addNextQuestion() {
    const nextType = draft.questions[draft.questions.length - 1]?.type || 'mcq';
    addQuestion(nextType);
  }

  function changeQuestionType(questionId, nextType) {
    setDraft(prev => ({
      ...prev,
      questions: prev.questions.map(question => (
        question.id === questionId
          ? { ...createQuestion(nextType), id: question.id, prompt: question.prompt || '', imageUrl: question.imageUrl || '' }
          : question
      )),
    }));
  }

  function updateQuestion(questionId, patch) {
    setDraft(prev => ({
      ...prev,
      questions: prev.questions.map(question => (question.id === questionId ? { ...question, ...patch } : question)),
    }));
  }

  function removeQuestion(questionId) {
    setDraft(prev => ({
      ...prev,
      questions: prev.questions.length === 1
        ? prev.questions
        : prev.questions.filter(question => question.id !== questionId),
    }));
  }

  function updateOption(questionId, optionIndex, value) {
    setDraft(prev => ({
      ...prev,
      questions: prev.questions.map(question => {
        if (question.id !== questionId) return question;
        const nextOptions = [...(question.options || [])];
        nextOptions[optionIndex] = value;
        return { ...question, options: nextOptions };
      }),
    }));
  }

  function addOption(questionId) {
    setDraft(prev => ({
      ...prev,
      questions: prev.questions.map(question => (
        question.id === questionId
          ? { ...question, options: [...(question.options || []), ''] }
          : question
      )),
    }));
  }

  function updateMatchingPair(questionId, pairId, key, value) {
    setDraft(prev => ({
      ...prev,
      questions: prev.questions.map(question => {
        if (question.id !== questionId) return question;
        return {
          ...question,
          pairs: (question.pairs || []).map(pair => (pair.id === pairId ? { ...pair, [key]: value } : pair)),
        };
      }),
    }));
  }

  function addMatchingPair(questionId) {
    setDraft(prev => ({
      ...prev,
      questions: prev.questions.map(question => (
        question.id === questionId
          ? { ...question, pairs: [...(question.pairs || []), { id: createId('pair'), left: '', right: '' }] }
          : question
      )),
    }));
  }

  function removeMatchingPair(questionId, pairId) {
    setDraft(prev => ({
      ...prev,
      questions: prev.questions.map(question => {
        if (question.id !== questionId) return question;
        const remainingPairs = (question.pairs || []).filter(pair => pair.id !== pairId);
        return { ...question, pairs: remainingPairs.length ? remainingPairs : [{ id: createId('pair'), left: '', right: '' }] };
      }),
    }));
  }

  async function uploadQuestionImage(questionId, file) {
    if (!file || !draft.classId) return;
    setUploadingQuestionId(questionId);
    setComposerError('');
    try {
      const response = await svc.uploadAssignmentAsset(draft.classId, { file, title: file.name });
      if (!response?.success || !response?.asset?.url) {
        throw new Error(response?.message || 'Could not upload image.');
      }
      updateQuestion(questionId, { imageUrl: response.asset.url });
      setComposerNotice('Question image uploaded.');
    } catch (error) {
      setComposerError(error instanceof Error ? error.message : 'Could not upload question image.');
    } finally {
      setUploadingQuestionId('');
    }
  }

  function importQuestions() {
    const parsed = parseImportedQuestions(importText);
    if (parsed.questions.length === 0) {
      setComposerError(parsed.errors[0] || 'No supported questions were found in the pasted text.');
      return;
    }

    setDraft(prev => {
      const shouldReplaceStarter = prev.questions.length === 1 && isQuestionBlank(prev.questions[0]);
      return {
        ...prev,
        questions: shouldReplaceStarter ? parsed.questions : [...prev.questions, ...parsed.questions],
      };
    });
    setImportedFromText(true);
    setComposerNotice(`Imported ${parsed.questions.length} question${parsed.questions.length === 1 ? '' : 's'}. Review them, then click Create Imported Assignment.`);
    setComposerError(parsed.errors[0] || '');
    setImportText('');
  }

  async function saveAssignment(event) {
    event.preventDefault();
    setComposerError('');
    setComposerNotice('');

    if (!draft.title.trim()) {
      setComposerError('Assignment title is required.');
      return;
    }

    if (!draft.classId) {
      setComposerError('Choose a class before saving.');
      return;
    }

    if (!draft.subjectId || !draftSubject) {
      setComposerError('Choose a subject before saving.');
      return;
    }

    const normalizedQuestions = draft.questions
      .map((question, index) => normalizeQuestionForSave(question, index))
      .filter(question => {
        if (question.type === 'crossmatching') return Array.isArray(question.pairs) && question.pairs.length > 0;
        if (question.type === 'comprehension') return question.passage || question.prompt;
        return question.prompt;
      });

    if (normalizedQuestions.length === 0) {
      setComposerError('Add at least one valid question before saving this assignment.');
      return;
    }

    setComposerSaving(true);
    try {
      const assignmentTitle = draft.title.trim();
      const targetClassId = draft.classId;
      const isImportedAssignment = composerMode === 'import' || importedFromText;
      const payload = {
        title: assignmentTitle,
        description: draft.description.trim(),
        dueAt: draft.dueAt || null,
        subjectId: draft.subjectId,
        subjectName: draftSubject.name,
        format: inferAssignmentFormat(normalizedQuestions),
        questions: normalizedQuestions,
        metadata: {
          questionCount: normalizedQuestions.length,
          totalScore: calculateTotalScore(normalizedQuestions),
          questionTypes: Array.from(new Set(normalizedQuestions.map(question => question.type))),
          importedFromText,
        },
      };

      const response = await svc.createAssignment(draft.classId, payload);
      if (!response?.success) {
        throw new Error(response?.message || 'Could not create assignment.');
      }

      closeComposer();

      if (isImportedAssignment) {
        setSuccessState({
          title: 'Bulk Assignment Created',
          message: `${assignmentTitle} was created successfully.`,
        });
      }

      if (targetClassId !== currentClassId && onSelectClass) {
        Promise.resolve(onSelectClass(targetClassId)).catch(() => {});
      } else if (onRefreshAssignments) {
        Promise.resolve(onRefreshAssignments(targetClassId)).catch(() => {});
      }
    } catch (error) {
      setComposerError(error instanceof Error ? error.message : 'Could not create assignment.');
    } finally {
      setComposerSaving(false);
    }
  }

  function renderQuestionEditor(question, index) {
    return (
      <section key={question.id} className={SURFACE}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className={LABEL}>Question {index + 1}</p>
            <h4 className={TITLE}>{typeLabel(question.type)}</h4>
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={question.type}
              onChange={(event) => changeQuestionType(question.id, event.target.value)}
              className={`${INPUT} w-auto min-w-[12rem]`}
            >
              {QUESTION_TYPE_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <button type="button" onClick={() => removeQuestion(question.id)} className={DANGER_BUTTON}>Remove</button>
          </div>
        </div>

        <div className="mt-4 space-y-4">
          <div>
            <label className={LABEL}>Score</label>
            <input
              type="number"
              min="1"
              step="1"
              value={question.score ?? 1}
              onChange={(event) => updateQuestion(question.id, { score: event.target.value })}
              className={`${INPUT} mt-2 max-w-[11rem]`}
              placeholder="1"
            />
          </div>

          {question.type === 'comprehension' && (
            <div>
              <label className={LABEL}>Passage</label>
              <textarea
                value={question.passage || ''}
                onChange={(event) => updateQuestion(question.id, { passage: event.target.value })}
                className={`${INPUT} mt-2 min-h-[140px]`}
                placeholder="Paste the comprehension passage here."
              />
            </div>
          )}

          <div>
            <label className={LABEL}>Question Prompt</label>
            <textarea
              value={question.prompt || ''}
              onChange={(event) => updateQuestion(question.id, { prompt: event.target.value })}
              className={`${INPUT} mt-2 min-h-[110px]`}
              placeholder="Type or paste the question text here."
            />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div>
              <label className={LABEL}>Question Image URL</label>
              <input
                value={question.imageUrl || ''}
                onChange={(event) => updateQuestion(question.id, { imageUrl: event.target.value })}
                className={`${INPUT} mt-2`}
                placeholder="https://..."
              />
            </div>
            <div>
              <label className={LABEL}>Upload Question Image</label>
              <input
                type="file"
                accept="image/*"
                onChange={(event) => {
                  const file = event.target.files && event.target.files[0];
                  if (file) uploadQuestionImage(question.id, file);
                  event.target.value = '';
                }}
                className={`${INPUT} mt-2 cursor-pointer file:mr-4 file:rounded-2xl file:border-0 file:bg-[#1a5c38] file:px-4 file:py-2 file:text-sm file:font-bold file:text-[#f5deb3] dark:file:bg-[#00ffff] dark:file:text-[#000000]`}
              />
              {uploadingQuestionId === question.id && <p className="mt-2 text-sm text-[#1a5c38] dark:text-[#00ffff]">Uploading image...</p>}
            </div>
          </div>

          {question.imageUrl && (
            <QuestionImagePreview imageUrl={question.imageUrl} />
          )}

          {question.type === 'mcq' && (
            <div className={SUB_SURFACE}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className={LABEL}>Options</p>
                  <p className={BODY}>Paste or type options, then mark the correct answer.</p>
                </div>
                <button type="button" onClick={() => addOption(question.id)} className={SECONDARY_BUTTON}>Add Option</button>
              </div>

              <div className="mt-4 space-y-3">
                {(question.options || []).map((option, optionIndex) => (
                  <div key={`${question.id}-option-${optionIndex}`} className="grid grid-cols-[auto,1fr] gap-3 items-center">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[#1a5c38] text-sm font-bold text-[#f5deb3] dark:bg-[#00ffff] dark:text-[#000000]">{getOptionLabel(optionIndex)}</span>
                    <input
                      value={option}
                      onChange={(event) => updateOption(question.id, optionIndex, event.target.value)}
                      className={INPUT}
                      placeholder={`Option ${getOptionLabel(optionIndex)}`}
                    />
                  </div>
                ))}
              </div>

              <div className="mt-4 grid grid-cols-1 xl:grid-cols-2 gap-4">
                <div>
                  <label className={LABEL}>Correct Answer</label>
                  <select
                    value={question.answer || ''}
                    onChange={(event) => updateQuestion(question.id, { answer: event.target.value })}
                    className={`${INPUT} mt-2`}
                  >
                    <option value="">Select the correct option</option>
                    {(question.options || []).map((option, optionIndex) => (
                      <option key={`${question.id}-answer-${optionIndex}`} value={option}>{getOptionLabel(optionIndex)}. {option || `Option ${getOptionLabel(optionIndex)}`}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={LABEL}>Explanation</label>
                  <textarea
                    value={question.explanation || ''}
                    onChange={(event) => updateQuestion(question.id, { explanation: event.target.value })}
                    className={`${INPUT} mt-2 min-h-[96px]`}
                    placeholder="Optional teacher explanation or marking note."
                  />
                </div>
              </div>
            </div>
          )}

          {question.type === 'shortanswer' && (
            <div>
              <label className={LABEL}>Expected Answer</label>
              <input
                value={question.answer || ''}
                onChange={(event) => updateQuestion(question.id, { answer: event.target.value })}
                className={`${INPUT} mt-2`}
                placeholder="Enter the expected short answer."
              />
            </div>
          )}

          {question.type === 'fillgaps' && (
            <div>
              <label className={LABEL}>Accepted Answers</label>
              <input
                value={question.acceptedAnswers || ''}
                onChange={(event) => updateQuestion(question.id, { acceptedAnswers: event.target.value })}
                className={`${INPUT} mt-2`}
                placeholder="Comma-separated accepted answers"
              />
            </div>
          )}

          {question.type === 'crossmatching' && (
            <div className={SUB_SURFACE}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className={LABEL}>Matching Pairs</p>
                  <p className={BODY}>Fill the left and right columns that students should match.</p>
                </div>
                <button type="button" onClick={() => addMatchingPair(question.id)} className={SECONDARY_BUTTON}>Add Pair</button>
              </div>
              <div className="mt-4 space-y-3">
                {(question.pairs || []).map(pair => (
                  <div key={pair.id} className="grid grid-cols-1 xl:grid-cols-[1fr,auto,1fr,auto] gap-3 items-center">
                    <input value={pair.left} onChange={(event) => updateMatchingPair(question.id, pair.id, 'left', event.target.value)} className={INPUT} placeholder="Column A" />
                    <span className="text-center text-[#800020] dark:text-[#bf00ff] font-bold">↔</span>
                    <input value={pair.right} onChange={(event) => updateMatchingPair(question.id, pair.id, 'right', event.target.value)} className={INPUT} placeholder="Column B" />
                    <button type="button" onClick={() => removeMatchingPair(question.id, pair.id)} className={DANGER_BUTTON}>Remove</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(question.type === 'essay' || question.type === 'longanswer' || question.type === 'comprehension') && (
            <div>
              <label className={LABEL}>Marking Guide</label>
              <textarea
                value={question.markingGuide || ''}
                onChange={(event) => updateQuestion(question.id, { markingGuide: event.target.value })}
                className={`${INPUT} mt-2 min-h-[120px]`}
                placeholder="Add marking points, rubric guidance, or sample answer notes."
              />
            </div>
          )}
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <section className={SURFACE}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className={LABEL}>Assignments</p>
            <h3 className={TITLE}>{currentClassName ? `Assignments for ${currentClassName}` : 'Assignments'}</h3>
            <p className={`${BODY} mt-2`}>View previously created assignments and open the subject-based builder when you need a new one.</p>
          </div>
          <button type="button" onClick={openComposer} className={PRIMARY_BUTTON}>Create Assignment</button>
        </div>

        <div className="mt-4 space-y-3">
          {assignments.length === 0 && (
            <div className={SUB_SURFACE}>
              <p className={`${LABEL} mb-2`}>No Assignments Yet</p>
              <p className={BODY}>This class does not have any saved assignments yet. Use the create button to publish one through the correct subject.</p>
            </div>
          )}

          {assignments.map(assignment => {
            const summary = summarizeAssignment(assignment);
            return (
              <article key={assignment.id} className={SUB_SURFACE}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h4 className="text-lg font-bold text-[#800000] dark:text-[#ffffff]">{assignment.title}</h4>
                    <p className={`${BODY} mt-2`}>{assignment.description || 'No teacher instructions added yet.'}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 items-center">
                    <span className="inline-flex rounded-full bg-[#1a5c38] px-3 py-1 text-xs font-bold uppercase tracking-[0.15em] text-[#f5deb3] dark:bg-[#00ffff] dark:text-[#000000]">{summary.format}</span>
                    <button type="button" onClick={() => setViewingAssignment(assignment)} className={SECONDARY_BUTTON}>View</button>
                    <button type="button" onClick={() => setSubmissionsAssignment(assignment)} className="rounded-2xl border border-[#1a5c38]/50 bg-[#1a5c38]/10 px-4 py-2 text-sm font-bold text-[#1a5c38] hover:bg-[#1a5c38]/20 transition-colors">Submissions</button>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full border border-[#c9a96e]/45 bg-white/60 px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] text-[#800020] dark:border-[#bf00ff]/35 dark:bg-black/20 dark:text-[#bf00ff]">Subject {assignment.subjectName || 'Not set'}</span>
                  <span className="rounded-full border border-[#c9a96e]/45 bg-white/60 px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] text-[#800020] dark:border-[#bf00ff]/35 dark:bg-black/20 dark:text-[#bf00ff]">Questions {summary.questionCount}</span>
                  <span className="rounded-full border border-[#c9a96e]/45 bg-white/60 px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] text-[#800020] dark:border-[#bf00ff]/35 dark:bg-black/20 dark:text-[#bf00ff]">Score {summary.totalScore}</span>
                  <span className="rounded-full border border-[#c9a96e]/45 bg-white/60 px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] text-[#800020] dark:border-[#bf00ff]/35 dark:bg-black/20 dark:text-[#bf00ff]">Due {formatDueDate(assignment.dueAt)}</span>
                </div>

                <p className={`${BODY} mt-3`}>{summary.typeSummary}</p>
              </article>
            );
          })}
        </div>
      </section>

      {composerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-6xl max-h-[92vh] overflow-y-auto rounded-[2rem] border border-[#c9a96e]/45 bg-[#fff8f0] p-6 shadow-[0_24px_60px_rgba(128,0,0,0.18)] dark:border-[#bf00ff]/35 dark:bg-[#800000]/92 dark:shadow-[0_0_40px_rgba(191,0,255,0.28)]">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className={LABEL}>Create Assignment</p>
                <h3 className={TITLE}>Subject-Based Assignment Builder</h3>
                <p className={`${BODY} mt-2`}>Choose the class, move through the assigned subject, then build structured questions with your light/night theme colors intact.</p>
              </div>
              <button type="button" onClick={closeComposer} className={DANGER_BUTTON}>Close</button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {[{ id: 'class', label: 'Class' }, { id: 'subject', label: 'Subject' }, { id: 'details', label: 'Assignment' }].map(step => {
                const isActive = composerStep === step.id;
                return (
                  <span key={step.id} className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] ${isActive ? 'bg-[#1a5c38] text-[#f5deb3] dark:bg-[#00ffff] dark:text-[#000000]' : 'border border-[#c9a96e]/45 text-[#800020] dark:border-[#bf00ff]/35 dark:text-[#bf00ff]'}`}>
                    {step.label}
                  </span>
                );
              })}
            </div>

            {composerError && <div className="mt-4 rounded-2xl border border-red-400/35 bg-red-50 px-4 py-3 text-sm text-[#800000] dark:border-[#ff5f8d]/35 dark:bg-[#4a0014] dark:text-[#ffffff]">{composerError}</div>}
            {composerNotice && <div className="mt-4 rounded-2xl border border-[#1a5c38]/35 bg-[#edf8f1] px-4 py-3 text-sm text-[#1a5c38] dark:border-[#00ffff]/35 dark:bg-[#002b2c] dark:text-[#00ffff]">{composerNotice}</div>}

            {composerStep === 'class' && (
              <div className="mt-6 space-y-4">
                <div className={SURFACE}>
                  <p className={LABEL}>Choose Class</p>
                  <p className={`${BODY} mt-2`}>If you teach multiple classes, select the class that should receive this assignment.</p>
                  <div className="mt-4 grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {assignedClasses.map(classroom => {
                      const isSelected = classroom.id === draft.classId;
                      return (
                        <button
                          key={classroom.id}
                          type="button"
                          onClick={() => updateDraftClass(classroom.id)}
                          className={`text-left rounded-3xl border p-4 transition-colors ${isSelected ? 'bg-[#1a5c38] text-[#f5deb3] border-[#1a5c38] dark:bg-[#00ffff] dark:text-[#000000] dark:border-[#00ffff]' : 'bg-[#fff8f0] border-[#c9a96e]/45 text-[#191970] hover:bg-[#f2e1bf] dark:bg-black/20 dark:border-[#bf00ff]/35 dark:text-[#ffffff] dark:hover:bg-[#800000]/85'}`}
                        >
                          <p className="text-lg font-bold">{classroom.className}</p>
                          <p className="mt-2 text-sm opacity-90">{classroom.subjects?.length || 0} assigned subject{classroom.subjects?.length === 1 ? '' : 's'}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex justify-end">
                  <button type="button" onClick={proceedFromClass} className={PRIMARY_BUTTON}>Proceed</button>
                </div>
              </div>
            )}

            {composerStep === 'subject' && (
              <div className="mt-6 space-y-4">
                <div className={SURFACE}>
                  <p className={LABEL}>Choose Subject</p>
                  <p className={`${BODY} mt-2`}>Assignments must be created under the subject you teach in this class.</p>
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    {subjectOptions.map(subject => {
                      const isSelected = subject.id === draft.subjectId;
                      return (
                        <button
                          key={subject.id}
                          type="button"
                          onClick={() => setDraftValue('subjectId', subject.id)}
                          className={`text-left rounded-3xl border p-4 transition-colors ${isSelected ? 'bg-[#1a5c38] text-[#f5deb3] border-[#1a5c38] dark:bg-[#00ffff] dark:text-[#000000] dark:border-[#00ffff]' : 'bg-[#fff8f0] border-[#c9a96e]/45 text-[#191970] hover:bg-[#f2e1bf] dark:bg-black/20 dark:border-[#bf00ff]/35 dark:text-[#ffffff] dark:hover:bg-[#800000]/85'}`}
                        >
                          <p className="text-lg font-bold">{subject.name}</p>
                          <p className="mt-2 text-sm opacity-90">Assigned subject</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-wrap justify-between gap-3">
                  <button type="button" onClick={goBack} className={SECONDARY_BUTTON}>Back</button>
                  <button type="button" onClick={proceedFromSubject} className={PRIMARY_BUTTON}>Proceed</button>
                </div>
              </div>
            )}

            {composerStep === 'details' && (
              <form onSubmit={saveAssignment} className="mt-6 space-y-5">
                <div className={SURFACE}>
                  <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                    <div className={SUB_SURFACE}>
                      <p className={LABEL}>Class</p>
                      <p className="mt-2 text-base font-bold text-[#800000] dark:text-[#ffffff]">{draftClass?.className || 'Choose class'}</p>
                    </div>
                    <div className={SUB_SURFACE}>
                      <p className={LABEL}>Subject</p>
                      <p className="mt-2 text-base font-bold text-[#800000] dark:text-[#ffffff]">{draftSubject?.name || 'Choose subject'}</p>
                    </div>
                    <div className={SUB_SURFACE}>
                      <p className={LABEL}>Question Types</p>
                      <p className="mt-2 text-base font-bold text-[#800000] dark:text-[#ffffff]">{typeLabel(inferAssignmentFormat(draft.questions.filter(question => !isQuestionBlank(question))))}</p>
                    </div>
                  </div>
                </div>

                <div className={SURFACE}>
                  <p className={LABEL}>Question Entry</p>
                  <div className="mt-4 grid grid-cols-1 xl:grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setComposerMode('build')}
                      className={`text-left rounded-3xl border p-4 transition-colors ${composerMode === 'build' ? 'bg-[#1a5c38] text-[#f5deb3] border-[#1a5c38] dark:bg-[#00ffff] dark:text-[#000000] dark:border-[#00ffff]' : 'bg-[#fff8f0] border-[#c9a96e]/45 text-[#191970] hover:bg-[#f2e1bf] dark:bg-black/20 dark:border-[#bf00ff]/35 dark:text-[#ffffff] dark:hover:bg-[#800000]/85'}`}
                    >
                      <p className="text-lg font-bold">Build Question By Question</p>
                      <p className="mt-2 text-sm opacity-90">Create each question manually and set the score for each one.</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setComposerMode('import')}
                      className={`text-left rounded-3xl border p-4 transition-colors ${composerMode === 'import' ? 'bg-[#1a5c38] text-[#f5deb3] border-[#1a5c38] dark:bg-[#00ffff] dark:text-[#000000] dark:border-[#00ffff]' : 'bg-[#fff8f0] border-[#c9a96e]/45 text-[#191970] hover:bg-[#f2e1bf] dark:bg-black/20 dark:border-[#bf00ff]/35 dark:text-[#ffffff] dark:hover:bg-[#800000]/85'}`}
                    >
                      <p className="text-lg font-bold">Bulk Import By Copy And Paste</p>
                      <p className="mt-2 text-sm opacity-90">Paste structured questions, then review and score the imported questions before saving.</p>
                    </button>
                  </div>
                </div>

                <div className={SURFACE}>
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    <div>
                      <label className={LABEL}>Assignment Title</label>
                      <input value={draft.title} onChange={(event) => setDraftValue('title', event.target.value)} className={`${INPUT} mt-2`} placeholder="e.g. Primary One Mathematics Continuous Assessment" />
                    </div>
                    <div>
                      <label className={LABEL}>Due Date</label>
                      <input type="datetime-local" value={draft.dueAt} onChange={(event) => setDraftValue('dueAt', event.target.value)} className={`${INPUT} mt-2`} />
                    </div>
                  </div>

                  <div className="mt-4">
                    <label className={LABEL}>Teacher Instructions</label>
                    <textarea value={draft.description} onChange={(event) => setDraftValue('description', event.target.value)} className={`${INPUT} mt-2 min-h-[120px]`} placeholder="Add directions, time limits, submission rules, or any note for learners." />
                  </div>
                </div>

                {composerMode === 'import' && (
                  <div className={SURFACE}>
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className={LABEL}>Bulk Import</p>
                        <h4 className={TITLE}>Paste Structured Questions</h4>
                        <p className={`${BODY} mt-2`}>Paste MCQs, comprehension blocks, or matching lists using the sample below. MCQs are parsed especially well when each option begins with A, B, C, or D.</p>
                      </div>
                      <button type="button" onClick={importQuestions} className={PRIMARY_BUTTON}>Import Questions</button>
                    </div>

                    <div className="mt-4 grid grid-cols-1 xl:grid-cols-2 gap-4">
                      <textarea value={importText} onChange={(event) => setImportText(event.target.value)} className={`${INPUT} min-h-[240px]`} placeholder="Paste question text here..." />
                      <pre className={`${SUB_SURFACE} overflow-auto whitespace-pre-wrap text-sm text-[#191970] dark:text-[#39ff14]`}>{IMPORT_SAMPLE}</pre>
                    </div>
                  </div>
                )}

                {shouldShowQuestionEditors && (
                  <div className={SURFACE}>
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className={LABEL}>{composerMode === 'import' ? 'Imported Questions' : 'Question Builder'}</p>
                        <h4 className={TITLE}>Build The Assignment</h4>
                      </div>
                      <span className="rounded-full border border-[#c9a96e]/45 bg-white/60 px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] text-[#800020] dark:border-[#bf00ff]/35 dark:bg-black/20 dark:text-[#bf00ff]">Questions {draft.questions.length}</span>
                    </div>

                    <div className="mt-5 space-y-4">
                      {draft.questions.map((question, index) => renderQuestionEditor(question, index))}
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap justify-between gap-3">
                  <button type="button" onClick={goBack} className={SECONDARY_BUTTON}>Back</button>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={closeComposer} className={SECONDARY_BUTTON}>Cancel</button>
                    <button type="submit" disabled={composerSaving} className={PRIMARY_BUTTON}>{composerSaving ? 'Saving...' : (composerMode === 'import' || importedFromText ? 'Create Imported Assignment' : 'Create Assignment')}</button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {composerOpen && composerStep === 'details' && composerMode === 'build' && (
        <button type="button" onClick={addNextQuestion} className={FLOATING_ADD_BUTTON} aria-label="Add new question">
          +
        </button>
      )}

      {viewingAssignment && (
        <AssignmentViewer assignment={viewingAssignment} onClose={() => setViewingAssignment(null)} />
      )}

      {submissionsAssignment && (
        <SubmissionsPanel assignment={submissionsAssignment} onClose={() => setSubmissionsAssignment(null)} />
      )}

      {successState && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[2rem] border border-[#1a5c38]/35 bg-[#edf8f1] p-6 text-center shadow-[0_24px_60px_rgba(26,92,56,0.28)] dark:border-[#00ffff]/35 dark:bg-[#002b2c]">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#1a5c38] text-4xl font-bold text-[#f5deb3] dark:bg-[#00ffff] dark:text-[#000000]">
              ✓
            </div>
            <h4 className="mt-4 text-2xl font-bold text-[#1a5c38] dark:text-[#00ffff]">{successState.title}</h4>
            <p className="mt-2 text-sm font-semibold text-[#191970] dark:text-[#ffffff]">{successState.message}</p>
            <button type="button" onClick={() => setSuccessState(null)} className="mt-5 rounded-2xl bg-[#1a5c38] px-5 py-2 text-sm font-bold text-[#f5deb3] transition-colors hover:bg-[#154a2e] dark:bg-[#00ffff] dark:text-[#000000] dark:hover:bg-[#7dfcff]">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}