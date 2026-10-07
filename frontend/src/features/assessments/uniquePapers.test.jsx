import React from 'react';
import { render } from '@testing-library/react';
import { isSecondaryClass } from './assessmentsApi';
import { StudentPaper } from './PaperPreview';
import { AnswerKey, paperPart } from './UniquePapers';
import { evaluate, hasVariables, masterQuestions } from './variants';

// The same cases as the server's tests (backend/test/ai-assessments.test.mjs), so both read templates alike.
const speed = { id: 'speed', section: 'A', type: 'mcq', prompt: 'A car travels {{d=100..300 step 10}} km in {{t=2..5}} hours. What is its average speed?', options: ['{{= d/t :1}} km/h', '{{= d*t}} km/h', '{{= d+t}} km/h', '{{= d-t}} km/h'], answerIndex: 0, answer: 'Speed = {{d}} ÷ {{t}} = {{= d/t :1}} km/h', markingPoints: [], marks: 1 };

test('the master paper fills every template at its lowest value, as the server does', () => {
  const [master] = masterQuestions([speed]);
  expect(master.prompt).toBe('A car travels 100 km in 2 hours. What is its average speed?');
  expect(master.options).toEqual(['50.0 km/h', '200 km/h', '102 km/h', '98 km/h']);
  expect(master.answer).toBe('Speed = 100 ÷ 2 = 50.0 km/h');
  expect(master.id).toBe('speed');
  expect(hasVariables(speed)).toBe(true);
  expect(hasVariables(master)).toBe(false);
  expect(evaluate('sin(30) + sqrt(16)', {})).toBe(4.5);
  expect(() => evaluate('alert(1)', {})).toThrow();
});

test('secondary classes are recognised', () => {
  for (const name of ['SS 2A', 'JSS1', 'SSS 3 Gold', 'Year 9', 'Grade 11', 'Basic 8']) expect(isSecondaryClass(name)).toBe(true);
  for (const name of ['Primary 4', 'Nursery 2', 'KG 1', 'Basic 3', 'Year 2']) expect(isSecondaryClass(name)).toBe(false);
});

test('a unique paper shows its version and code, a personal one the student\'s name; the key lists every answer', () => {
  const paper = { label: 'Ada Obi', code: 'K7Q2', studentName: 'Ada Obi', admissionNo: 'GIS/0042', questions: [{ ...masterQuestions([speed])[0], options: ['200 km/h', '50.0 km/h', '102 km/h', '98 km/h'], answerIndex: 1 }, { id: 'e', section: 'B', type: 'essay', prompt: 'Discuss.', options: [], marks: 10 }] };
  const assessment = { id: 'a', kind: 'exam', title: 'Physics', subjectName: 'Physics', className: 'SS 2', config: {}, questions: paper.questions };
  const { container } = render(<StudentPaper assessment={assessment} letterhead={{ schoolName: 'Genesis' }} candidate={paper} breakBefore />);
  expect(container.textContent).toMatch(/Paper code: K7Q2/);
  expect(container.textContent).toMatch(/Ada Obi/);
  expect(container.textContent).toMatch(/GIS\/0042/);
  expect(container.querySelector('header.ndv-page-break')).toBeTruthy();
  const key = render(<AnswerKey paper={paper} original={[speed, paper.questions[1]]} />).container;
  expect(key.textContent).toMatch(/1\.\s*B/);
  expect(key.textContent).toMatch(/main marking scheme/);
});

test('a unique theory-only paper keeps the letterhead and the student\'s name, names the part and counts only theory marks', () => {
  const questions = [{ ...masterQuestions([speed])[0] }, { id: 'e', section: 'B', type: 'essay', prompt: 'Discuss friction.', options: [], marks: 10 }];
  const assessment = { id: 'a', kind: 'exam', title: 'Physics', subjectName: 'Physics', className: 'SS 2', config: {}, audit: { examMarks: 11 }, questions };
  const theory = paperPart(assessment, questions, 'theory');
  expect(theory.questions.map(question => question.id)).toEqual(['e']);
  expect(theory.audit.examMarks).toBe(10);
  expect(paperPart(assessment, questions, 'objective').audit.examMarks).toBe(1);
  expect(paperPart(assessment, questions, 'all')).toEqual({ ...assessment, questions });
  const { container } = render(<StudentPaper assessment={theory} letterhead={{ schoolName: 'Genesis', address: '1 School Road' }} candidate={{ label: 'Ada Obi', code: 'K7Q2', studentName: 'Ada Obi', admissionNo: 'GIS/0042' }} />);
  expect(container.querySelector('.ndv-letterhead').textContent).toMatch(/GENESIS.*1 School Road/);
  expect(container.querySelector('.ndv-paper-title').textContent).toMatch(/— THEORY$/);
  expect(container.textContent).toMatch(/Ada Obi/);
  expect(container.textContent).toMatch(/Paper code: K7Q2/);
  expect(container.textContent).toMatch(/Total marks10/);
  expect(container.textContent).not.toMatch(/A car travels/);
});
