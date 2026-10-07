import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import MaterialBatchList from './MaterialBatchList';

const file = (name, size = 2048) => ({ name, size });
const items = [
  { key: 'a', file: file('Fractions.pdf'), title: 'Fractions', description: '', status: 'uploaded', error: '' },
  { key: 'b', file: file('Fraction Chart.png'), title: 'Fraction Chart', description: '', status: 'uploading', error: '' },
  { key: 'c', file: file('Introduction.mp4', 50 * 1024 * 1024), title: 'Introduction', description: '', status: 'failed', error: 'This file is too large to upload.' },
  { key: 'd', file: file('Exercise.docx'), title: 'Exercise', description: '', status: 'queued', error: '' },
];

test('each file shows its own result, and only failures offer Retry', () => {
  const onRetry = jest.fn();
  const onChange = jest.fn();
  render(<MaterialBatchList heading="Mathematics · Week 4" items={items} progress={{ b: 40 }} busy={false}
    onChange={onChange} onRemove={jest.fn()} onRetry={onRetry} onClearFinished={jest.fn()} />);

  expect(screen.getByText(/Mathematics · Week 4 — 4 files · 1 uploaded · 1 failed/)).toBeTruthy();
  const rows = screen.getAllByRole('listitem');
  expect(within(rows[0]).getByRole('status').textContent).toBe('Uploaded');
  expect(within(rows[1]).getByRole('status').textContent).toBe('Uploading 40%');
  expect(within(rows[2]).getByText('This file is too large to upload.')).toBeTruthy();
  expect(screen.getAllByText('Retry')).toHaveLength(1);

  fireEvent.click(within(rows[2]).getByText('Retry'));
  expect(onRetry).toHaveBeenCalledWith('c');

  // Uploaded files are locked; waiting files can be renamed before posting.
  expect(within(rows[0]).getAllByRole('textbox')[0].disabled).toBe(true);
  fireEvent.change(within(rows[3]).getAllByRole('textbox')[0], { target: { value: 'Fractions Exercise' } });
  expect(onChange).toHaveBeenCalledWith('d', { title: 'Fractions Exercise' });
});
