import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AppDialogHost, askConfirm, showAlert } from './AppDialog';

test('confirm opens a centred dialog and resolves with the choice', async () => {
  render(<AppDialogHost />);
  let answer;
  act(() => { askConfirm('Delete this question?').then(value => { answer = value; }); });
  expect(await screen.findByRole('dialog')).toBeTruthy();
  expect(screen.getByText('Delete this question?')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  await waitFor(() => expect(answer).toBe(false));
  expect(screen.queryByRole('dialog')).toBeNull();

  act(() => { askConfirm('Continue to payment?').then(value => { answer = value; }); });
  fireEvent.click(await screen.findByRole('button', { name: 'Continue' }));
  await waitFor(() => expect(answer).toBe(true));
});

test('Escape cancels, and an alert has only OK', async () => {
  render(<AppDialogHost />);
  let answer;
  act(() => { askConfirm('Remove this student?').then(value => { answer = value; }); });
  const ok = await screen.findByRole('button', { name: 'Yes, continue' });
  fireEvent.keyDown(ok, { key: 'Escape' });
  await waitFor(() => expect(answer).toBe(false));

  let closed = false;
  act(() => { showAlert('Saved.').then(() => { closed = true; }); });
  expect(await screen.findByRole('alertdialog')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'OK' }));
  await waitFor(() => expect(closed).toBe(true));
});

test('without the host it falls back to the browser box', async () => {
  const spy = jest.spyOn(window, 'confirm').mockReturnValue(true);
  await expect(askConfirm('Fallback?')).resolves.toBe(true);
  expect(spy).toHaveBeenCalledWith('Fallback?');
  spy.mockRestore();
});
