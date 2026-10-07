import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MyStaffEvaluationsPage } from './StaffEvaluationPages';
import { getMyEvaluations, submitEvaluationResponse } from './evaluationsApi';

jest.mock('./evaluationsApi', () => ({
  ...jest.requireActual('./evaluationsApi'),
  getMyEvaluations: jest.fn(), submitEvaluationResponse: jest.fn(),
}));

const evaluation = {
  id: 'e1', title: 'First Term peer review', status: 'open', closesAt: '2026-10-12T00:00:00Z', scale: { min: 1, max: 5 },
  questions: [{ id: 'q1', text: 'Punctuality', kind: 'rating' }, { id: 'c1', text: 'Comments', kind: 'comment' }],
  colleagues: [{ id: 'bola', name: 'Bola', done: false }, { id: 'chi', name: 'Chi', done: true }],
};

test('staff pick a colleague, rate and comment, and finished reviews are locked', async () => {
  getMyEvaluations.mockResolvedValue({ success: true, evaluations: [evaluation] });
  submitEvaluationResponse.mockResolvedValue({ success: true });
  render(<MyStaffEvaluationsPage />);
  expect(await screen.findByText(/1 of 2 left/)).toBeTruthy();
  expect(screen.getByRole('button', { name: /Chi — done/ }).disabled).toBe(true);

  fireEvent.click(screen.getByText('Bola'));
  expect(screen.getByText(/Management never sees which answers are yours/)).toBeTruthy();
  fireEvent.click(screen.getByLabelText('4'));
  fireEvent.change(screen.getByLabelText('Comments'), { target: { value: 'Always early.' } });
  fireEvent.click(screen.getByText('Submit review'));
  await waitFor(() => expect(submitEvaluationResponse).toHaveBeenCalledWith('e1', { subjectId: 'bola', answers: { q1: 4, c1: 'Always early.' } }));
});
