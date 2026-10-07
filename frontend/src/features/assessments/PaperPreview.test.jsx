import React from 'react';
import { render, screen } from '@testing-library/react';
import { MarkingScheme, StudentPaper, shortOptions } from './PaperPreview';

const assessment = {
  id: 'a1', kind: 'exam', title: 'SS2 Economics First Term Examination', subjectName: 'Economics', className: 'SS 2A',
  sessionName: '2026/2027', termName: 'First Term', config: { durationMinutes: 120, totalMarks: 12 }, audit: { examMarks: 12 },
  blueprint: { sections: [
    { name: 'A', type: 'mcq', questions: 1, attempt: 1, marks: 2, instructions: 'Answer ALL questions.' },
    { name: 'B', type: 'essay', questions: 1, attempt: 1, marks: 10, instructions: 'Answer ONE question.' },
  ] },
  questions: [
    { id: 'q1', section: 'A', type: 'mcq', prompt: 'The index is \\(\\frac{300}{1200}\\times100\\). What is it?', options: ['20', '25', '30', '35'], answerIndex: 1, answer: '', markingPoints: ['SECRET-MCQ-REASON'], alternatives: [], workingSteps: [], rubric: [], marks: 2, bloom: 'apply', topic: 'Price index' },
    { id: 'q2', section: 'B', type: 'essay', prompt: 'Evaluate the policy.', options: [], answerIndex: -1, answer: 'SECRET-ESSAY-ANSWER', markingPoints: ['Point'], alternatives: [], workingSteps: [], rubric: [{ criterion: 'Judgement', marks: 4 }], marks: 10, bloom: 'evaluate', topic: 'Policy' },
  ],
};
const letterhead = { schoolName: 'Genesis International School', defaultInstructions: 'Write clearly.' };

test('the student paper has the letterhead, sections and numbering but no answers', () => {
  const { container } = render(<StudentPaper assessment={assessment} letterhead={letterhead} />);
  expect(screen.getByText('GENESIS INTERNATIONAL SCHOOL')).toBeTruthy();
  expect(screen.getByText('INSTRUCTIONS TO CANDIDATES')).toBeTruthy();
  expect(screen.getByText('SECTION A')).toBeTruthy();
  expect(screen.getByText('SECTION B')).toBeTruthy();
  expect(container.querySelector('.katex')).toBeTruthy();
  expect(container.textContent).not.toMatch(/SECRET/);
  expect(container.textContent).toMatch(/Student name/);
});

test('the marking scheme carries every answer and is marked confidential', () => {
  const { container } = render(<MarkingScheme assessment={assessment} letterhead={letterhead} />);
  expect(container.textContent).toMatch(/CONFIDENTIAL/);
  expect(container.textContent).toMatch(/Answer: B/);
  expect(container.textContent).toMatch(/SECRET-ESSAY-ANSWER/);
  expect(container.textContent).toMatch(/Judgement/);
});

test('the letterhead uses the school colours and contact; parts and compulsory questions print', () => {
  const parted = { ...assessment, questions: [assessment.questions[0], { ...assessment.questions[1], compulsory: true, parts: [{ label: 'a', prompt: 'Define inflation.', marks: 4, answer: 'SECRET-PART' }, { label: 'b', prompt: 'Explain two causes.', marks: 6 }] }] };
  const { container } = render(<StudentPaper assessment={parted} letterhead={{ ...letterhead, address: '1 School Road, Lagos', contact: '0800 000 0000', primaryColor: '#800000', accentColor: '#c9a96e' }} />);
  const band = container.querySelector('.ndv-letterhead');
  expect(band.style.getPropertyValue('--lh-primary')).toBe('#800000');
  expect(band.textContent).toMatch(/1 School Road, Lagos.*0800 000 0000/);
  expect(container.textContent).toMatch(/\(Compulsory\)/);
  expect(container.textContent).toMatch(/\(a\)Define inflation\.\s*\[4 marks\]/);
  expect(container.textContent).toMatch(/\(b\)Explain two causes\.\s*\[6 marks\]/);
  expect(container.textContent).not.toMatch(/SECRET/);
  expect(container.textContent).toMatch(/Printed \d/);
});

test('a theory-only print keeps the school letterhead, names the part and shows only its own marks', () => {
  const theoryOnly = { ...assessment, paperPart: 'THEORY', audit: { examMarks: 10 }, questions: assessment.questions.filter(question => question.section === 'B') };
  const { container } = render(<StudentPaper assessment={theoryOnly} letterhead={{ ...letterhead, address: '1 School Road', contact: '0800 000 0000', primaryColor: '#800000' }} />);
  expect(container.querySelector('.ndv-letterhead')).toBeTruthy();
  expect(container.querySelector('.ndv-letterhead').textContent).toMatch(/GENESIS INTERNATIONAL SCHOOL.*1 School Road.*0800 000 0000/);
  expect(container.querySelector('.ndv-paper-title').textContent).toMatch(/— THEORY$/);
  expect(container.textContent).toMatch(/Total marks10/);
  expect(container.textContent).not.toMatch(/SECTION A/);
  expect(container.textContent).toMatch(/SECTION B/);
});

test('short options sit four across; answer lines can be left off for answer booklets', () => {
  expect(shortOptions(['₦4,000', '₦6,000', '₦2,000', '₦8,000'])).toBe(true);
  expect(shortOptions(['Increasing government spending to create jobs in rural areas', 'b', 'c', 'd'])).toBe(false);
  const naira = { ...assessment, questions: [{ ...assessment.questions[0], options: ['₦4,000', '₦6,000', '₦2,000', '₦8,000'] }, assessment.questions[1]] };
  const { container, rerender } = render(<StudentPaper assessment={naira} letterhead={letterhead} />);
  expect(container.querySelector('.ndv-paper-options--short')).toBeTruthy();
  expect(container.querySelector('.ndv-answer-lines')).toBeTruthy();
  rerender(<StudentPaper assessment={{ ...naira, answerSpace: false }} letterhead={letterhead} />);
  expect(container.querySelector('.ndv-answer-lines')).toBeNull();
  expect(container.querySelector('.ndv-letterhead')).toBeTruthy();
});
