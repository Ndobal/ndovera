import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import BirthdaysPage from './BirthdaysPage';
import * as api from './birthdaysApi';

let mockRole = 'student';
jest.mock('react-router-dom', () => ({ useParams: () => ({ role: mockRole }) }), { virtual: true });
jest.mock('./birthdaysApi', () => ({
  getToday: jest.fn(), getMemories: jest.fn(), getCelebration: jest.fn(), getWishes: jest.fn(), sendWish: jest.fn(), suggestWish: jest.fn(),
  reportWish: jest.fn(), getSettings: jest.fn(), saveSettings: jest.fn(), getModeration: jest.fn(), decideWish: jest.fn(),
  getMyConsent: jest.fn(), setMyConsent: jest.fn(), setChildConsent: jest.fn(), getCardUrl: jest.fn(), downloadCardPng: jest.fn(),
}));

const renderAs = role => { mockRole = role; return render(<BirthdaysPage />); };

beforeEach(() => {
  api.getToday.mockResolvedValue({ items: [{ id: 'b1', name: 'Ada Teacher', displayDate: '10 October' }] });
  api.getCelebration.mockResolvedValue({ id: 'b1', name: 'Ada Teacher', displayDate: '10 October', message: 'Wishing you joy.', wishCount: 0, canSendWish: true, canReadWishes: false, allowedStyles: ['cheerful', 'warm'] });
  api.getCardUrl.mockResolvedValue('blob:card');
  api.suggestWish.mockResolvedValue({ message: 'Happy birthday! Have a fantastic day!' });
  api.sendWish.mockResolvedValue({ status: 'pending' });
});

test('a student opens today’s celebration, gets a suggestion and sends a wish that waits for approval', async () => {
  renderAs('student');
  fireEvent.click(await screen.findByText('🎂 Ada Teacher'));
  expect(await screen.findByText('Happy Birthday, Ada Teacher!')).toBeInTheDocument();
  expect(await screen.findByAltText('Birthday card for Ada Teacher')).toHaveAttribute('src', 'blob:card');
  fireEvent.click(screen.getByRole('button', { name: 'Help me write' }));
  await waitFor(() => expect(screen.getByPlaceholderText('Your birthday wish')).toHaveValue('Happy birthday! Have a fantastic day!'));
  jest.spyOn(window, 'confirm').mockReturnValue(true);
  fireEvent.click(screen.getByRole('button', { name: /Preview & send/ }));
  expect(await screen.findByText('Wish sent. A teacher will check it before it is shown.')).toBeInTheDocument();
  expect(api.sendWish.mock.calls[0][1]).toBe('Happy birthday! Have a fantastic day!');
  expect(screen.queryByRole('tab', { name: 'Settings' })).not.toBeInTheDocument();
});

test('the Owner gets the review queue and settings tabs', async () => {
  api.getModeration.mockResolvedValue({ items: [{ id: 'w1', message: 'Happy birthday ma', senderName: 'Dayo', senderRole: 'student', recipient: 'Ada Teacher', reportReason: '' }] });
  api.decideWish.mockResolvedValue({ status: 'approved' });
  renderAs('owner');
  fireEvent.click(await screen.findByRole('tab', { name: 'Review wishes' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Approve' }));
  await waitFor(() => expect(api.decideWish).toHaveBeenCalledWith('w1', 'approve'));
});
