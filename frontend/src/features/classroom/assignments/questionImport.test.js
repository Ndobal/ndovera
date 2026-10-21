import { importQuestions } from './questionImport';

const summary = questions => questions.map(question => ({ type: question.type, prompt: question.prompt, options: question.options, answer: question.answer }));

test('questions pasted back to back (no blank lines) become separate questions with their own options', () => {
  const { questions, warnings } = importQuestions(`1. What is the capital of Nigeria?
A. Lagos
B. Abuja
C. Kano
D. Ibadan
Answer: B
2. Which is a prime number?
A. 4
B. 6
C. 7
D. 9
Answer: C
3. 2 + 2 = ?
A. 3
B. 4
C. 5
D. 6
Ans: B`);
  expect(warnings).toEqual([]);
  expect(summary(questions)).toEqual([
    { type: 'mcq', prompt: 'What is the capital of Nigeria?', options: ['Lagos', 'Abuja', 'Kano', 'Ibadan'], answer: 'Abuja' },
    { type: 'mcq', prompt: 'Which is a prime number?', options: ['4', '6', '7', '9'], answer: '7' },
    { type: 'mcq', prompt: '2 + 2 = ?', options: ['3', '4', '5', '6'], answer: '4' },
  ]);
});

test('options on one line, lower-case letters, brackets, and an answer key at the end', () => {
  const { questions, warnings } = importQuestions(`Q1. Solve 3x = 12
(a) 2  (b) 3  (c) 4  (d) 6
Q2) The plural of child is
a) childs
b) children
c) childrens
d) childes
Q3. Water boils at
A) 50°C B) 100°C C) 150°C D) 200°C

Answer key: 1. C  2. B  3. B`);
  expect(warnings).toEqual([]);
  expect(questions.map(question => question.answer)).toEqual(['4', 'children', '100°C']);
  expect(questions[0].options).toEqual(['2', '3', '4', '6']);
});

test('an asterisk or (correct) marks the answer; explanations and formulas are kept', () => {
  const { questions } = importQuestions(`1. Evaluate \\(\\frac{1}{2} + \\frac{1}{4}\\)
A. \\(\\frac{2}{6}\\)
B. \\(\\frac{3}{4}\\) *
C. \\(\\frac{1}{8}\\)
Explanation: Use a common denominator of 4.
2. Which shape has three sides?
A. Square
B. Triangle (correct)
C. Circle`);
  expect(questions[0].answer).toBe('\\(\\frac{3}{4}\\)');
  expect(questions[0].explanation).toBe('Use a common denominator of 4.');
  expect(questions[0].prompt).toBe('Evaluate \\(\\frac{1}{2} + \\frac{1}{4}\\)');
  expect(questions[1].answer).toBe('Triangle');
});

test('sections set the type: objectives are multiple choice, theory questions become essays', () => {
  const { questions } = importQuestions(`SECTION A: OBJECTIVES
1. 5 × 6 =
A. 11 B. 30 C. 56 D. 65
Answer: B

SECTION B: THEORY
1. Explain the water cycle.
Answer: Evaporation, condensation, precipitation.
2. Describe three uses of water.`);
  expect(questions.map(question => question.type)).toEqual(['mcq', 'essay', 'essay']);
  expect(questions[1].markingGuide).toBe('Evaporation, condensation, precipitation.');
});

test('a question that runs over several lines stays one question; numbers inside it do not split it', () => {
  const { questions } = importQuestions(`1. A trader bought 2.5 kg of rice
for ₦3,000 and sold it for ₦4,500.
What was the profit?
A. ₦1,000
B. ₦1,500
C. ₦2,000
Answer: B`);
  expect(questions).toHaveLength(1);
  expect(questions[0].prompt).toBe('A trader bought 2.5 kg of rice\nfor ₦3,000 and sold it for ₦4,500.\nWhat was the profit?');
  expect(questions[0].answer).toBe('₦1,500');
});

test('short answers and fill-in-the-blanks are recognised; missing answers are reported', () => {
  const { questions, warnings } = importQuestions(`1. The capital of Ghana is ______.
Answer: Accra
2. Name the largest planet.
Answer: Jupiter
3. Which is a vowel?
A. b
B. e
C. t`);
  expect(questions.map(question => question.type)).toEqual(['fillgaps', 'shortanswer', 'mcq']);
  expect(questions[0].acceptedAnswers).toBe('Accra');
  expect(warnings).toEqual(['Question 3: no correct answer was found. Choose it below.']);
});

test('the older tagged blocks still work', () => {
  const { questions } = importQuestions(`[COMPREHENSION]
Passage:
Ada read the story aloud before the class assembly.
Question: Why was Ada able to read before the assembly?
Marking Guide: She prepared.

[CROSS MATCHING]
Prompt: Match the countries to their capitals.
Nigeria -> Abuja
Ghana -> Accra`);
  expect(questions.map(question => question.type)).toEqual(['comprehension', 'crossmatching']);
  expect(questions[0].passage).toBe('Ada read the story aloud before the class assembly.');
  expect(questions[1].pairs.map(pair => [pair.left, pair.right])).toEqual([['Nigeria', 'Abuja'], ['Ghana', 'Accra']]);
});

test('text pasted from Word with tabs and non-breaking spaces', () => {
  const { questions } = importQuestions('1.\tWhat colour is the sky?\nA. Blue\nB. Green\nAnswer:\tA');
  expect(summary(questions)).toEqual([{ type: 'mcq', prompt: 'What colour is the sky?', options: ['Blue', 'Green'], answer: 'Blue' }]);
});
