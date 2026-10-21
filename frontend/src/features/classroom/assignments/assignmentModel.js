// Assignment questions: their shapes, labels, scoring and what is saved.
// Shared by the teacher's builder, the importer and the viewers.

export const QUESTION_TYPES = [
  { value: 'mcq', label: 'Multiple choice', short: 'MCQ' },
  { value: 'shortanswer', label: 'Short answer', short: 'Short' },
  { value: 'fillgaps', label: 'Fill in the blanks', short: 'Fill' },
  { value: 'crossmatching', label: 'Matching', short: 'Match' },
  { value: 'essay', label: 'Essay / theory', short: 'Essay' },
  { value: 'comprehension', label: 'Comprehension', short: 'Comp.' },
  { value: 'longanswer', label: 'Long answer', short: 'Long' },
];

let counter = 0;
export function createId(prefix = 'item') {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter}_${Math.random().toString(36).slice(2, 7)}`;
}

export function createQuestion(type = 'mcq') {
  const base = { id: createId('question'), type, prompt: '', imageUrl: '', score: 1 };
  switch (type) {
    case 'shortanswer': return { ...base, answer: '' };
    case 'fillgaps': return { ...base, acceptedAnswers: '' };
    case 'crossmatching': return { ...base, pairs: [{ id: createId('pair'), left: '', right: '' }, { id: createId('pair'), left: '', right: '' }] };
    case 'essay': return { ...base, markingGuide: '' };
    case 'comprehension': return { ...base, passage: '', markingGuide: '' };
    case 'longanswer': return { ...base, markingGuide: '' };
    case 'mcq':
    default: return { ...base, type: 'mcq', options: ['', '', '', ''], answer: '', explanation: '' };
  }
}

export function typeLabel(type) {
  if (String(type || '').toLowerCase() === 'mixed') return 'Mixed';
  return QUESTION_TYPES.find(item => item.value === String(type || '').toLowerCase())?.label || 'Assignment';
}

export const optionLetter = index => String.fromCharCode(65 + index);

export function isQuestionBlank(question) {
  if (!question) return true;
  const text = [question.prompt, question.passage].some(value => String(value || '').trim());
  const options = Array.isArray(question.options) && question.options.some(option => String(option || '').trim());
  const pairs = Array.isArray(question.pairs) && question.pairs.some(pair => String(pair.left || '').trim() || String(pair.right || '').trim());
  return !text && !options && !pairs;
}

export function questionScore(question) {
  const score = Number(question?.score);
  return Number.isFinite(score) && score > 0 ? score : 1;
}

export const totalScore = (questions = []) => questions.reduce((sum, question) => sum + questionScore(question), 0);

/** "B" (or "b", "(B)") → the text of option B; anything else is kept as written. */
export function answerToOption(answer, options = []) {
  const cleaned = String(answer || '').trim().replace(/^\(([A-Ha-h])\)$/, '$1');
  if (/^[A-Ha-h]$/.test(cleaned)) return options[cleaned.toUpperCase().charCodeAt(0) - 65] ?? '';
  return cleaned;
}

/** What a question still needs before it can be used ('' when it is ready). */
export function questionProblem(question) {
  if (question.type === 'crossmatching') return (question.pairs || []).filter(pair => String(pair.left || '').trim() && String(pair.right || '').trim()).length >= 2 ? '' : 'Add at least two complete pairs.';
  if (!String(question.prompt || '').trim() && !String(question.passage || '').trim()) return 'Type the question.';
  if (question.type === 'mcq') {
    const options = (question.options || []).filter(option => String(option || '').trim());
    if (options.length < 2) return 'Give at least two options.';
    if (!String(question.answer || '').trim() || !options.includes(question.answer)) return 'Mark the correct option.';
  }
  return '';
}

export function normalizeQuestionForSave(question, index) {
  const base = { id: question.id || createId('question'), order: index + 1, type: question.type, prompt: String(question.prompt || '').trim(), imageUrl: String(question.imageUrl || '').trim(), score: questionScore(question) };
  switch (question.type) {
    case 'mcq': {
      const options = (question.options || []).map(option => String(option || '').trim()).filter(Boolean);
      return { ...base, options, answer: answerToOption(question.answer, options), explanation: String(question.explanation || '').trim() };
    }
    case 'fillgaps':
      return { ...base, acceptedAnswers: (Array.isArray(question.acceptedAnswers) ? question.acceptedAnswers : String(question.acceptedAnswers || '').split(',')).map(answer => String(answer).trim()).filter(Boolean) };
    case 'crossmatching':
      return { ...base, pairs: (question.pairs || []).map(pair => ({ left: String(pair.left || '').trim(), right: String(pair.right || '').trim() })).filter(pair => pair.left || pair.right) };
    case 'comprehension':
      return { ...base, passage: String(question.passage || '').trim(), markingGuide: String(question.markingGuide || '').trim() };
    case 'essay':
    case 'longanswer':
      return { ...base, markingGuide: String(question.markingGuide || '').trim() };
    default:
      return { ...base, answer: String(question.answer || '').trim() };
  }
}

/** A saved question, back in the editor's shape (accepted answers as text, pairs with ids). */
export function questionForEditing(question) {
  const fresh = createQuestion(question?.type || 'mcq');
  const merged = { ...fresh, ...question, id: question?.id || fresh.id };
  if (Array.isArray(merged.acceptedAnswers)) merged.acceptedAnswers = merged.acceptedAnswers.join(', ');
  if (merged.type === 'crossmatching') merged.pairs = (merged.pairs || []).map(pair => ({ id: pair.id || createId('pair'), left: pair.left || '', right: pair.right || '' }));
  if (merged.type === 'mcq' && (!Array.isArray(merged.options) || !merged.options.length)) merged.options = ['', '', '', ''];
  return merged;
}

export function inferFormat(questions) {
  const types = Array.from(new Set((questions || []).map(question => question.type).filter(Boolean)));
  if (!types.length) return 'assignment';
  return types.length === 1 ? types[0] : 'mixed';
}
