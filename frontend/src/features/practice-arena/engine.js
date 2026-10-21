// The quiz engine on the device: builds a quiz from a downloaded pack and marks
// it instantly, with or without a connection. Ndovera marks it again when the
// attempt syncs (practiceArena.ts) — the rules here mirror that file.

export const MODES = [
  { key: 'quick', label: 'Quick Fire', icon: '⚡', blurb: '10 mixed questions, no clock', count: 10, seconds: 0, types: ['mcq', 'truefalse', 'shortanswer', 'fillgaps', 'crossmatching'] },
  { key: 'blitz', label: 'Timed Blitz', icon: '⏱️', blurb: 'Beat the clock: 2 minutes, XP × 1.25', count: 30, seconds: 120, types: ['mcq', 'truefalse', 'shortanswer', 'fillgaps'] },
  { key: 'exam', label: 'Exam Simulation', icon: '📝', blurb: 'Objectives, theory and comprehension, timed', count: 20, seconds: 20 * 60, types: ['mcq', 'truefalse', 'shortanswer', 'fillgaps', 'crossmatching', 'essay', 'comprehension'] },
  { key: 'mistakes', label: 'Mistake Fixer', icon: '🎯', blurb: 'Questions you missed before', count: 10, seconds: 0, types: ['mcq', 'truefalse', 'shortanswer', 'fillgaps', 'crossmatching', 'essay', 'comprehension'] },
  { key: 'custom', label: 'Build Your Own', icon: '🧩', blurb: 'Choose the question types, length and timer', count: 15, seconds: 0, types: [] },
];

export const TYPE_LABELS = {
  mcq: 'Multiple choice', truefalse: 'True / False', shortanswer: 'Short answer', fillgaps: 'Fill in the gap',
  crossmatching: 'Matching', essay: 'Essay / theory', comprehension: 'Comprehension',
};

export function normalizeText(value) {
  return String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Spaces aside: "h2 o" is "h2o". */
function compact(text) { return text.replace(/\s+/g, ''); }

/** Levenshtein distance, in full. */
function distance(a, b) {
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = previous[0];
    previous[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const above = previous[j];
      previous[j] = Math.min(previous[j] + 1, previous[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = above;
    }
  }
  return previous[b.length];
}

export const CLOSE_MATCH = 0.7;

/**
 * A close answer counts: at least 70% alike once case and spaces are set aside. Very short
 * answers (under 4 letters) must be exact, and the first letter must agree, so "decrease"
 * is not taken for "increase".
 */
export function closeEnough(given, expected) {
  const a = compact(given);
  const b = compact(expected);
  if (a === b) return true;
  // The answer said inside a short sentence ("it is photosynthesis") counts too.
  if (` ${given} `.includes(` ${expected} `) && given.split(' ').length <= expected.split(' ').length + 3) return true;
  if (b.length < 4 || a[0] !== b[0]) return false;
  return 1 - distance(a, b) / Math.max(a.length, b.length) >= CLOSE_MATCH;
}

export function textMatches(response, accepted = []) {
  const given = normalizeText(response);
  if (!given) return false;
  return accepted.some(answer => {
    const expected = normalizeText(answer);
    if (!expected) return false;
    if (given === expected) return true;
    // Numbers compare as numbers ("0.50" is "0.5", "1,000" is "1000"), read before punctuation is removed.
    const asNumber = value => { const text = String(value ?? '').trim().replace(/[\s,]/g, ''); return /^[-+]?\d*\.?\d+$/.test(text) ? Number(text) : NaN; };
    const a = asNumber(response);
    const b = asNumber(answer);
    if (Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < 1e-9) return true;
    // Numbers must be exactly right; words may be close: 70% alike (spaces and case aside, same first letter).
    if (Number.isFinite(b) || /\d/.test(expected)) return compact(given) === compact(expected);
    return closeEnough(given, expected);
  });
}

/** Mark one answer: { credit 0–1, correct }. Written answers are self-marked against the model answer. */
export function markAnswer(question, response, selfRating) {
  if (question.type === 'mcq' || question.type === 'truefalse') {
    const correct = response === question.correctIndex;
    return { credit: correct ? 1 : 0, correct };
  }
  if (question.type === 'shortanswer' || question.type === 'fillgaps') {
    const correct = textMatches(response, question.accepted || []);
    return { credit: correct ? 1 : 0, correct };
  }
  if (question.type === 'crossmatching') {
    const given = response && typeof response === 'object' ? response : {};
    const pairs = question.pairs || [];
    const right = pairs.filter(pair => normalizeText(given[pair.left]) === normalizeText(pair.right)).length;
    return { credit: pairs.length ? Math.round((right / pairs.length) * 100) / 100 : 0, correct: pairs.length > 0 && right === pairs.length };
  }
  const credit = selfRating === 'got_it' ? 1 : selfRating === 'partly' ? 0.5 : 0;
  return { credit, correct: credit === 1, selfMarked: true };
}

/** The words of the model answer the student used — a hint before they mark themselves. */
export function keywordOverlap(response, modelAnswer) {
  const stop = new Set('the a an and or of to in is are was were be by for with on at as it its this that from which'.split(' '));
  const words = text => new Set(normalizeText(text).split(' ').filter(word => word.length > 3 && !stop.has(word)));
  const model = words(modelAnswer);
  if (!model.size) return 0;
  const given = words(response);
  let hits = 0;
  model.forEach(word => { if (given.has(word)) hits += 1; });
  return Math.round((hits / model.size) * 100);
}

/** XP as Ndovera will count it (the server's figure is the one kept). */
export function estimateXp(results, mode) {
  let combo = 0;
  let xp = 0;
  for (const result of results) {
    if (result.correct) combo += 1; else combo = 0;
    const base = result.type === 'essay' || result.type === 'comprehension' ? 15 : 10;
    xp += Math.round(base * result.credit) + (result.correct && combo >= 3 ? Math.min(10, (combo - 2) * 2) : 0);
  }
  if (mode === 'blitz') xp = Math.round(xp * 1.25);
  const percent = results.length ? Math.round((results.reduce((sum, result) => sum + result.credit, 0) / results.length) * 100) : 0;
  if (results.length >= 5 && percent === 100) xp += 25;
  return xp;
}

export function levelForXp(xp) {
  const level = Math.max(1, Math.floor((50 + Math.sqrt(2500 + 200 * Math.max(0, xp))) / 100));
  const floor = 50 * level * (level - 1);
  const next = 50 * (level + 1) * level;
  return { level, floor, next, progress: Math.round(((xp - floor) / (next - floor)) * 100) };
}

function shuffle(list, random = Math.random) {
  const copy = [...list];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

/** Options in a new order every time, with the answer followed. "All/None of the above" stay last. */
export function shuffleOptions(question, random = Math.random) {
  if (question.type !== 'mcq' || !Array.isArray(question.options)) return question;
  const fixed = option => /^(all|none|both|neither) of the above|^(a|b) and (b|c)$/i.test(String(option).trim());
  const indexed = question.options.map((option, index) => ({ option, index }));
  const movable = shuffle(indexed.filter(item => !fixed(item.option)), random);
  const ordered = [...movable, ...indexed.filter(item => fixed(item.option))];
  return { ...question, options: ordered.map(item => item.option), correctIndex: ordered.findIndex(item => item.index === question.correctIndex) };
}

/** A quiz from a pack, for a mode (or the student's own choice of types, length and timer). */
export function buildQuiz(pack, modeKey, custom = {}, random = Math.random) {
  // A mock examination: every question of the pack, in its order (subject by subject), on the examination's clock.
  if (modeKey === 'mock') {
    const questions = (pack?.questions || []).filter(question => question.type === 'mcq' || question.type === 'truefalse');
    return { mode: 'mock', label: custom.label || 'Mock examination', seconds: Math.max(60, Number(custom.minutes || 60) * 60), questions: questions.map(question => shuffleOptions(question, random)) };
  }
  const mode = MODES.find(item => item.key === modeKey) || MODES[0];
  const types = mode.key === 'custom' ? (custom.types?.length ? custom.types : Object.keys(TYPE_LABELS)) : mode.types;
  const count = mode.key === 'custom' ? Math.max(5, Math.min(50, Number(custom.count) || 15)) : mode.count;
  const seconds = mode.key === 'custom' ? Math.max(0, Number(custom.minutes || 0) * 60) : mode.seconds;
  let pool = (pack?.questions || []).filter(question => types.includes(question.type));
  if (mode.key === 'mistakes') {
    const missed = pool.filter(question => question.stat && question.stat.correct < question.stat.seen);
    pool = missed.length >= 3 ? missed : pool.filter(question => !question.stat || question.stat.box < 2);
  }
  if (mode.key === 'exam') {
    // Objectives first, then the written section, the way a paper is laid out.
    const objective = shuffle(pool.filter(question => ['mcq', 'truefalse', 'shortanswer', 'fillgaps', 'crossmatching'].includes(question.type)), random).slice(0, 15);
    const written = shuffle(pool.filter(question => ['essay', 'comprehension'].includes(question.type)), random).slice(0, Math.max(2, count - objective.length));
    return { mode: mode.key, label: mode.label, seconds, questions: [...objective, ...written].slice(0, count).map(question => shuffleOptions(question, random)) };
  }
  return { mode: mode.key, label: mode.label, seconds, questions: shuffle(pool, random).slice(0, count).map(question => shuffleOptions(question, random)) };
}

export function newAttemptId() {
  const random = Math.random().toString(36).slice(2, 10);
  return `att_${Date.now().toString(36)}_${random}`;
}
