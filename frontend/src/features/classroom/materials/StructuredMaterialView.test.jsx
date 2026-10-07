import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import StructuredMaterialView from './StructuredMaterialView';

// Published Ndovera AI materials: each block drawn as what it is, answers only on request.
const blocks = [
  { type: 'heading', text: 'Core Teaching' },
  { type: 'formula', text: '$$x=\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}$$\n\n*The quadratic formula*' },
  { type: 'table', text: '| Equation | Roots |\n| --- | --- |\n| x^2 - 4 = 0 | ±2 |' },
  { type: 'figure', text: '```figure\n{"type":"function","xRange":[-3,3],"functions":[{"expr":"x^2-4"}]}\n```' },
  { type: 'worked_example', text: 'Solve x^2 - 4 = 0', items: ['x^2 = 4', 'x = ±2'], ordered: true },
  { type: 'common_mistake', text: 'Dividing by x loses a root.' },
  { type: 'question', text: '**1. WAEC-style Practice Question** · Easy\n\nSolve x^2 = 9.', items: ['±3', '3 only'], ordered: true, answer: '**Answer:** A. ±3' },
  { type: 'flashcard', text: 'Discriminant', answer: 'b^2 - 4ac' },
];

test('formulae, tables, graphs, worked examples, questions and flashcards render natively', () => {
  const { container } = render(<StructuredMaterialView blocks={blocks} />);
  expect(container.querySelector('.katex-display')).toBeTruthy();
  expect(screen.getByRole('columnheader', { name: 'Roots' })).toBeTruthy();
  expect(container.querySelector('figure.ndv-figure svg')).toBeTruthy();
  expect(screen.getByLabelText('Worked example')).toBeTruthy();
  expect(screen.getByLabelText('Common mistake')).toBeTruthy();
  expect(screen.getByText('WAEC-style Practice Question', { exact: false })).toBeTruthy();
  expect(container.textContent).not.toMatch(/\*\*|```|\$\$|\| ---/);

  // The answer stays hidden until the student asks for it.
  expect(screen.queryByText(/Answer:/)).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Show answer' }));
  expect(screen.getByText(/Answer:/)).toBeTruthy();

  const card = screen.getByRole('button', { name: /Flashcard — tap to turn/ });
  fireEvent.click(card);
  expect(card.getAttribute('aria-pressed')).toBe('true');
  expect(card.textContent).toMatch(/b\^2 - 4ac|b2/);
});
