import React from 'react';
import { render, screen } from '@testing-library/react';
import TeacherNotifications from './TeacherNotifications';
import * as api from './communicationsApi';

jest.mock('./communicationsApi', () => ({ ...jest.requireActual('./communicationsApi'), getClassNotifications: jest.fn() }));

test('a teacher sees how parents were told about their class, as counts', async () => {
  api.getClassNotifications.mockResolvedValue({
    classes: ['JSS 1 A'],
    notifications: [{ id: 'e1', type: 'assignment', title: 'Fractions worksheet', term: '', createdAt: '2026-10-10T09:00:00Z', classes: ['JSS 1 A'], families: 30, batchStatus: 'done', notReachable: { no_valid_phone: 2 }, channels: { inapp: { delivered: 30 }, whatsapp: { delivered: 20, failed: 1 }, sms: { accepted: 5 } } }],
  });
  render(<TeacherNotifications />);
  expect(await screen.findByText('New assignment: Fractions worksheet')).toBeInTheDocument();
  expect(screen.getByText('In-app: 30 of 30 sent')).toBeInTheDocument();
  expect(screen.getByText('WhatsApp: 20 of 21 sent · 1 failed')).toBeInTheDocument();
  expect(screen.getByText(/No valid phone number: 2/)).toBeInTheDocument();
});

test('a teacher with no class is told so', async () => {
  api.getClassNotifications.mockResolvedValue({ classes: [], notifications: [] });
  render(<TeacherNotifications />);
  expect(await screen.findByText('You are not set as the teacher of any class yet.')).toBeInTheDocument();
});
