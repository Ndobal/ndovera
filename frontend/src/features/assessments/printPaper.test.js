import React from 'react';
import { render } from '@testing-library/react';
import { StudentPaper } from './PaperPreview';
import { pageStyles, paperRows } from './printPaper';

const assessment = {
  id: 'a1', kind: 'exam', title: 'Physics', subjectName: 'Physics', className: 'SS 3', config: { durationMinutes: 60, totalMarks: 12 },
  blueprint: { sections: [{ name: 'A', type: 'mcq', questions: 2, attempt: 2, marks: 2 }, { name: 'B', type: 'essay', questions: 1, attempt: 1, marks: 10 }] },
  questions: [
    { id: 'q1', section: 'A', type: 'mcq', prompt: 'One?', options: ['a', 'b', 'c', 'd'], answerIndex: 0, marks: 1 },
    { id: 'q2', section: 'A', type: 'mcq', prompt: 'Two?', options: ['a', 'b', 'c', 'd'], answerIndex: 0, marks: 1 },
    { id: 'q3', section: 'B', type: 'essay', prompt: 'Three.', options: [], answerIndex: -1, marks: 10, parts: [{ label: 'a', prompt: 'Define.', marks: 4 }, { label: 'b', prompt: 'Explain.', marks: 6 }] },
  ],
};

test('every block of the paper becomes its own printed row, with a page break before the essay section', () => {
  const { container } = render(<StudentPaper assessment={assessment} letterhead={{ schoolName: 'Genesis' }} />);
  const html = paperRows(container.querySelector('article.ndv-paper'));
  const rows = html.match(/<tr /g) || [];
  // header, instructions, section A head, 2 questions, section B head, 1 question, end
  expect(rows).toHaveLength(8);
  expect((html.match(/ndv-break/g) || [])).toHaveLength(1);
  expect(html.indexOf('ndv-break')).toBeLessThan(html.indexOf('SECTION B'));
  expect(html.indexOf('ndv-break')).toBeGreaterThan(html.indexOf('Two?'));
  expect(html).toContain('END OF PAPER');
});

test('the print page carries the styles themselves, so it never prints unformatted', () => {
  const style = document.createElement('style');
  style.textContent = '.ndv-paper-options { list-style: none; } .ndv-letterhead-logo { height: 0.68in; }';
  document.head.appendChild(style);
  try {
    const css = pageStyles();
    expect(css).toMatch(/^<style>|<style>/);
    expect(css).toMatch(/\.ndv-paper-options\s*\{\s*list-style: none;/);
    expect(css).toMatch(/\.ndv-letterhead-logo\s*\{\s*height: 0\.68in;/);
    expect(css).not.toMatch(/<link/);
  } finally { style.remove(); }
});
