import { describeSection, presetStructure, structureTotals, toBlueprint } from './paperStructure';

test('instructions write themselves from the structure', () => {
  expect(describeSection({ type: 'mcq', questions: 60, attempt: 60, compulsory: '' })).toMatch(/Answer ALL questions/);
  expect(describeSection({ type: 'essay', questions: 6, attempt: 3, compulsory: '' })).toBe('Answer any 3 of the 6 questions in this section.');
  expect(describeSection({ type: 'essay', questions: 6, attempt: 5, compulsory: '1' })).toBe('Question 1 is compulsory. Answer any 4 other questions.');
  expect(describeSection({ type: 'essay', questions: 6, attempt: 4, compulsory: '1, 2' })).toBe('Questions 1 and 2 are compulsory. Answer any 2 other questions.');
});

test('60 MCQs and 5 essays in parts, answer 3, 20 marks each', () => {
  const sections = [
    { name: 'A', type: 'mcq', questions: 60, attempt: 60, marksPerQuestion: 1, parts: 0, compulsory: '', instructions: '', instructionsEdited: false },
    { name: 'B', type: 'essay', questions: 5, attempt: 3, marksPerQuestion: 20, parts: 3, compulsory: '1', instructions: 'Do question 1 first.', instructionsEdited: true },
  ];
  expect(structureTotals(sections)).toEqual({ questions: 65, marks: 120 });
  const blueprint = toBlueprint(sections);
  expect(blueprint.sections[0]).toMatchObject({ type: 'mcq', questions: 60, parts: 0, compulsory: [], instructions: '' });
  expect(blueprint.sections[1]).toMatchObject({ type: 'essay', questions: 5, attempt: 3, marksPerQuestion: 20, parts: 3, compulsory: [1], instructions: 'Do question 1 first.' });
});

test('parts only apply to written question types; presets exist for each kind', () => {
  const [section] = toBlueprint([{ name: 'A', type: 'mcq', questions: 5, attempt: 5, marksPerQuestion: 1, parts: 3, compulsory: '' }]).sections;
  expect(section.parts).toBe(0);
  for (const kind of ['quiz', 'assignment', 'test', 'exam']) expect(structureTotals(presetStructure(kind, 'waec')).questions).toBeGreaterThan(0);
  expect(presetStructure('exam', 'waec')[1]).toMatchObject({ questions: 7, attempt: 5, parts: 3 });
});
