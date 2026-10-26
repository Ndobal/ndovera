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

describe('a maths paper of 20 questions keeps all 20', () => {
  const paper = (last) => Array.from({ length: 19 }, (_, index) => `${index + 1}. Simplify ${index + 2}x + ${index}x\nA. ${index}x\nB. ${index + 1}x\nC. ${index + 2}x\nD. ${2 * index + 2}x`).join('\n') + `\n${last}\nA. 2\nB. 3\nC. 4\nD. 5`;

  test('"20.Simplify" with no space after the number is still question 20', () => {
    const { questions, warnings } = importQuestions(paper('20.Find x if 2x = 6'));
    expect(questions).toHaveLength(20);
    expect(questions[19].prompt).toBe('Find x if 2x = 6');
    expect(questions[18].options[3]).toBe('38x');
    expect(warnings.filter(warning => /jump|numbered/.test(warning))).toEqual([]);
  });

  test('"20)Find" works the same, and "2.5 kg" in a question is not a new question', () => {
    expect(importQuestions(paper('20)Find x if 2x = 6')).questions).toHaveLength(20);
    const { questions } = importQuestions('1. A bag weighs\n2.5 kg. Find its weight in grams.\nA. 25\nB. 2500');
    expect(questions).toHaveLength(1);
  });

  test('numbers that jump or repeat are pointed out to the teacher', () => {
    const jumped = importQuestions('1. One? A. a B. b\n2. Two? A. a B. b\n4. Four? A. a B. b').warnings;
    expect(jumped.some(warning => /jump from 2 to 4/.test(warning))).toBe(true);
    const repeated = importQuestions('1. One? A. a B. b\n2. Two? A. a B. b\n2. Again? A. a B. b').warnings;
    expect(repeated.some(warning => /Two questions are numbered 2/.test(warning))).toBe(true);
  });
});

describe('every option is kept, however the options are laid out', () => {
  test('two options to a line: D is its own option, not joined to C', () => {
    const { questions } = importQuestions('1. Solve 2x = 8\nA. 2      B. 3\nC. 4      D. 5\nAnswer: C');
    expect(summary(questions)).toEqual([{ type: 'mcq', prompt: 'Solve 2x = 8', options: ['2', '3', '4', '5'], answer: '4' }]);
  });

  test('no space after the letter ("D.5", "C)4")', () => {
    const { questions } = importQuestions('1. Solve 2x = 8\nA. 2\nB. 3\nC)4\nD.5');
    expect(questions[0].options).toEqual(['2', '3', '4', '5']);
    expect(importQuestions('1. Solve 2x = 8\nA. 2 B. 3 C. 4 D.5').questions[0].options).toEqual(['2', '3', '4', '5']);
  });

  test('options on the question line itself', () => {
    const { questions } = importQuestions('1. What is 2 + 2? A. 3 B. 4 C. 5 D. 6\nAnswer: B');
    expect(summary(questions)).toEqual([{ type: 'mcq', prompt: 'What is 2 + 2?', options: ['3', '4', '5', '6'], answer: '4' }]);
  });

  test('three to a line, then one', () => {
    expect(importQuestions('1. Pick\n(a) x (b) y (c) z\n(d) w').questions[0].options).toEqual(['x', 'y', 'z', 'w']);
  });
});
