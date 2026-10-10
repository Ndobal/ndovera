import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import NotificationsCenter from './NotificationsCenter';
import * as api from './communicationsApi';

jest.mock('./communicationsApi', () => {
  const actual = jest.requireActual('./communicationsApi');
  return { ...actual, getOverview: jest.fn(), saveSettings: jest.fn(), quoteUnits: jest.fn(), startPurchase: jest.fn(), recheckBatch: jest.fn(), checkPurchase: jest.fn() };
});

const wallet = (spendable, extra = {}) => ({ spendable, reserved: 0, termAllowance: spendable, gifts: 0, purchased: 0, used: 0, expiring: [], ...extra });
const OVERVIEW = {
  success: true,
  settings: { shortagePolicy: 'PAUSE_BATCH', whatsappEnabled: true, smsEnabled: true, emailEnabled: true, consentConfirmed: true, guardianMode: 'designated', assignmentMode: 'digest', digestTime: '17:00', deadlineHoursBefore: 24, reminderIntervalDays: 14, initialReminderDate: '', events: { notice: true }, pauses: { whatsapp: ['credits'] } },
  wallet: { whatsapp: wallet(10), sms: wallet(10), email: wallet(0) },
  waiting: [{ id: 'b1', type: 'notice', label: 'School notice', shortfall: { whatsapp: 110 }, counts: { recipients: 120 }, createdAt: '2026-10-10T09:00:00Z' }],
  warnings: ['WhatsApp sending paused. This school notice needs 120 units; 10 are available. Buy 110 units for ₦1,672. Email and in-app notifications remain active.'],
  last30Days: [{ channel: 'inapp', status: 'delivered', n: 120 }],
  automation: [{ channel: 'whatsapp', paused: true, reasons: ['credits'] }, { channel: 'sms', paused: false, reasons: [] }, { channel: 'email', paused: false, reasons: [] }],
  prices: { whatsapp: { current: { unitPriceKobo: 1520, billingMode: 'PAID' } }, sms: { current: { unitPriceKobo: 800, billingMode: 'PAID' } }, email: { current: { unitPriceKobo: 0, billingMode: 'FREE' } } },
  packages: [10, 50, 100, 500, 1000], minimumPurchase: { whatsapp: 10, sms: 10 },
  providers: { whatsapp: true, sms: true, email: true }, templatesApproved: ['notice'], canChangeSettings: true, canBuy: true,
};

beforeEach(() => {
  api.getOverview.mockResolvedValue(OVERVIEW);
  api.saveSettings.mockResolvedValue({ success: true });
});

test('the overview shows the exact shortfall warning, the balances and what is waiting', async () => {
  render(<NotificationsCenter />);
  expect(await screen.findByText(/This school notice needs 120 units; 10 are available\. Buy 110 units for ₦1,672/)).toBeInTheDocument();
  expect(screen.getByText(/paused \(waiting for units\)/)).toBeInTheDocument();
  expect(screen.getByText(/120 families · short 110 WhatsApp/)).toBeInTheDocument();
  expect(screen.getByText('Free')).toBeInTheDocument(); // email
});

test('choosing SMS for the remainder asks to confirm the SMS cost before saving', async () => {
  render(<NotificationsCenter />);
  fireEvent.click(await screen.findByRole('tab', { name: 'Settings' }));
  fireEvent.click(screen.getByLabelText(/WhatsApp first, SMS for the rest/));
  const confirm = jest.spyOn(window, 'confirm').mockReturnValue(true);
  fireEvent.click(screen.getByRole('button', { name: 'Save settings' }));
  await waitFor(() => expect(api.saveSettings).toHaveBeenCalled());
  expect(confirm.mock.calls[0][0]).toMatch(/₦8 per SMS segment/);
  expect(api.saveSettings.mock.calls[0][0]).toMatchObject({ shortagePolicy: 'SMS_FOR_REMAINDER', acknowledgeSmsCost: true });
  confirm.mockRestore();
});

test('buying units gets a server quote, then hands over to Flutterwave', async () => {
  api.quoteUnits.mockResolvedValue({ quote: { id: 'q1' } });
  api.startPurchase.mockResolvedValue({ checkoutUrl: 'https://checkout.flutterwave.test/pay' });
  const assign = jest.fn();
  delete window.location;
  window.location = { search: '', assign };
  render(<NotificationsCenter />);
  fireEvent.click(await screen.findByRole('tab', { name: 'Buy units' }));
  fireEvent.click(screen.getByRole('button', { name: /100 units · ₦1,520/ }));
  expect(screen.getByText('₦1,520', { selector: 'b' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Pay with Flutterwave' }));
  await waitFor(() => expect(assign).toHaveBeenCalledWith('https://checkout.flutterwave.test/pay'));
  expect(api.quoteUnits).toHaveBeenCalledWith({ channel: 'whatsapp', units: 100 });
});
