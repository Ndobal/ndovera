import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import FinancialStandingsReport from './FinancialStandingsReport';
import * as api from './simpleFeesApi';

jest.mock('react-router-dom', () => ({ useParams: () => ({ role: 'owner' }), useSearchParams: () => [new URLSearchParams(''), () => {}] }), { virtual: true });
jest.mock('./simpleFeesApi', () => ({ getStandings: jest.fn(), postStandings: jest.fn(), listStandingsReports: jest.fn(), getStandingsReport: jest.fn(), saveStandingsSettings: jest.fn() }));

const report = {
  schoolName: 'Genesis International School', termLabel: 'First Term, 2026/2027', from: '2026-09-07', to: '2026-10-21', generatedAt: '2026-10-21T09:00:00Z',
  totals: { expected: 320000, received: 100000, outstanding: 220000, credit: 0, collectionRate: 31.3, students: 2, studentsOwing: 2, studentsPaid: 0, familiesOwing: 1 },
  familiesOwing: [{ familyId: 'mrs-obi', familyName: 'Mrs Obi', owes: 220000, children: [{ studentName: 'Ada', className: 'JSS 1', balance: 60000 }, { studentName: 'Bola', className: 'JSS 1', balance: 160000 }] }],
  reminders: { email: 2, whatsapp: 1, studentsReminded: 2, dates: ['2026-10-07'], fortnightly: true, statement: 'Fee reminders are sent to the parents of every student still owing every two weeks by email.' },
};

beforeEach(() => {
  api.getStandings.mockResolvedValue({ report });
  api.listStandingsReports.mockResolvedValue({ reports: [], autoReminders: true });
  api.postStandings.mockResolvedValue({ report, posted: { id: 'r1', emailed: 2 } });
});

test('the Owner sees the standings, each family owing, the reminder statement, and posts it', async () => {
  render(<FinancialStandingsReport />);
  expect(await screen.findByText('Mrs Obi')).toBeTruthy();
  expect(screen.getByText(/₦320,000.00/)).toBeTruthy();
  expect(screen.getAllByText(/₦220,000.00/).length).toBeGreaterThan(0);
  expect(screen.getByText(/every two weeks by email/)).toBeTruthy();
  expect(screen.getByRole('checkbox', { name: /Remind owing families every two weeks/ }).checked).toBe(true);
  fireEvent.click(screen.getByText('Post to Owner & HoS'));
  expect(await screen.findByText(/emailed to 2/)).toBeTruthy();
});
