import { buildQuiz, estimateXp, keywordOverlap, levelForXp, markAnswer, shuffleOptions, textMatches } from './engine';

const seeded = seed => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

const pack = {
  questions: [
    { id: 'q1', type: 'mcq', prompt: '2 + 2?', options: ['3', '4', '5', 'None of the above'], correctIndex: 1 },
    { id: 'q2', type: 'truefalse', prompt: 'The sky is green.', options: ['True', 'False'], correctIndex: 1 },
    { id: 'q3', type: 'shortanswer', prompt: 'Capital of Nigeria?', accepted: ['Abuja'] },
    { id: 'q4', type: 'essay', prompt: 'Explain photosynthesis.', modelAnswer: 'Green plants use sunlight, water and carbon dioxide to make glucose.' },
    { id: 'q5', type: 'crossmatching', prompt: 'Match', pairs: [{ left: 'Cat', right: 'Kitten' }, { left: 'Dog', right: 'Puppy' }] },
    { id: 'q6', type: 'comprehension', prompt: 'What did Ada do?', passage: 'Ada went to school.', modelAnswer: 'She went to school.', stat: { seen: 2, correct: 0, box: 0 } },
  ],
};

test('answers are marked like Ndovera marks them, typos and number formats aside', () => {
  expect(markAnswer(pack.questions[0], 1)).toEqual({ credit: 1, correct: true });
  expect(markAnswer(pack.questions[0], 0).correct).toBe(false);
  expect(textMatches('  ABUJA ', ['Abuja'])).toBe(true);
  expect(textMatches('Photosynthasis', ['Photosynthesis'])).toBe(true);
  expect(textMatches('Lagos', ['Abuja'])).toBe(false);
  expect(textMatches('0.50', ['0.5'])).toBe(true);
  expect(markAnswer(pack.questions[4], { Cat: 'Kitten', Dog: 'Kitten' })).toEqual({ credit: 0.5, correct: false });
  expect(markAnswer(pack.questions[3], 'my essay', 'partly')).toMatchObject({ credit: 0.5, selfMarked: true });
  expect(keywordOverlap('plants use sunlight and water', pack.questions[3].modelAnswer)).toBe(38);
});

test('shuffling options follows the answer and keeps "None of the above" last', () => {
  for (let seed = 1; seed < 20; seed += 1) {
    const shuffled = shuffleOptions(pack.questions[0], seeded(seed));
    expect(shuffled.options[shuffled.correctIndex]).toBe('4');
    expect(shuffled.options[3]).toBe('None of the above');
  }
});

test('modes build the right quizzes', () => {
  const quick = buildQuiz(pack, 'quick', {}, seeded(3));
  expect(quick.questions.every(question => !['essay', 'comprehension'].includes(question.type))).toBe(true);
  expect(quick.seconds).toBe(0);
  const blitz = buildQuiz(pack, 'blitz', {}, seeded(3));
  expect(blitz.seconds).toBe(120);
  const exam = buildQuiz(pack, 'exam', {}, seeded(3));
  // Objectives first, the written section after.
  const firstWritten = exam.questions.findIndex(question => ['essay', 'comprehension'].includes(question.type));
  expect(exam.questions.slice(firstWritten).every(question => ['essay', 'comprehension'].includes(question.type))).toBe(true);
  expect(buildQuiz(pack, 'mistakes', {}, seeded(3)).questions.length).toBeGreaterThan(0);
  const custom = buildQuiz(pack, 'custom', { types: ['truefalse'], count: 5, minutes: 2 }, seeded(3));
  expect(custom.questions.map(question => question.id)).toEqual(['q2']);
  expect(custom.seconds).toBe(120);
});

test('XP and levels match the server rules', () => {
  const results = Array.from({ length: 5 }, () => ({ type: 'mcq', credit: 1, correct: true }));
  // 5 × 10, combo bonus for the 3rd (2), 4th (4), 5th (6), perfect 25.
  expect(estimateXp(results, 'quick')).toBe(50 + 2 + 4 + 6 + 25);
  expect(levelForXp(0).level).toBe(1);
  expect(levelForXp(100).level).toBe(2);
  expect(levelForXp(299).level).toBe(2);
  expect(levelForXp(300).level).toBe(3);
});

test('a mock keeps every objective question in order, on the examination clock', () => {
  const pack = { questions: [
    { id: 'e1', type: 'mcq', prompt: 'English 1', options: ['a', 'b'], correctIndex: 0 },
    { id: 'm1', type: 'mcq', prompt: 'Maths 1', options: ['a', 'b'], correctIndex: 1 },
    { id: 'x', type: 'essay', prompt: 'Essay', modelAnswer: 'x' },
  ] };
  const quiz = buildQuiz(pack, 'mock', { minutes: 120, label: 'JAMB UTME mock' }, () => 0.5);
  expect(quiz.mode).toBe('mock');
  expect(quiz.seconds).toBe(7200);
  expect(quiz.questions.map(question => question.id)).toEqual(['e1', 'm1']);
});

test('close answers count: 70% alike, any case or spacing; numbers stay exact', () => {
  expect(textMatches('MITOCHONDRION', ['mitochondria'])).toBe(true);
  expect(textMatches('photo synthesis', ['Photosynthesis'])).toBe(true);
  expect(textMatches('it is photosynthesis', ['photosynthesis'])).toBe(true);
  expect(textMatches('Photosinthesis', ['photosynthesis'])).toBe(true);
  expect(textMatches('decrease', ['increase'])).toBe(false);
  expect(textMatches('car', ['cat'])).toBe(false);
  expect(textMatches('H2 O', ['H2O'])).toBe(true);
  expect(textMatches('13', ['12'])).toBe(false);
  expect(textMatches('Abuja', ['Lagos', 'Abuja'])).toBe(true);
});
