import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import DriverTransportPage from './DriverTransportPage';
import { boardChild, getDriverTransport, markArrived, openDriverRun } from './transportApi';

jest.mock('./transportApi', () => ({
  getDriverTransport: jest.fn(), setDriverTrips: jest.fn(), openDriverRun: jest.fn(), boardChild: jest.fn(), markArrived: jest.fn(), markDeparted: jest.fn(),
}));

const riders = [
  { studentId: 'ada', name: 'Ada Obi', className: 'JSS 1A', pickupTime: '06:45', pickupPoint: 'Lugbe junction', tripNo: 1, directions: 'both' },
  { studentId: 'bayo', name: 'Bayo Ade', className: 'JSS 1A', pickupTime: '06:50', tripNo: 1, directions: 'both' },
];

beforeEach(() => {
  jest.clearAllMocks();
  getDriverTransport.mockResolvedValue({ trips: 1, routes: [{ id: 'r1', name: 'Lugbe', students: riders.map(rider => ({ ...rider, routeId: 'r1' })) }], runs: [] });
  openDriverRun.mockResolvedValue({ run: { id: 'run1', direction: 'morning', tripNo: 1 }, boarded: [], riders });
  boardChild.mockResolvedValue({ onBoard: true });
  markArrived.mockResolvedValue({ run: { id: 'run1', direction: 'morning', tripNo: 1, arrivedAt: '2026-10-16T06:40:00Z' }, markedPresent: 2 });
  jest.spyOn(window, 'confirm').mockReturnValue(true);
});

test('the driver ticks children on board from the list, then records arriving at school', async () => {
  render(<DriverTransportPage />);
  fireEvent.click(await screen.findByRole('button', { name: /Morning/ }));
  fireEvent.click(screen.getByRole('button', { name: /Start morning run/ }));
  expect(await screen.findByText('0 of 2 on board', { exact: false })).toBeTruthy();

  fireEvent.click(screen.getByRole('button', { name: /Ada Obi/ }));
  await waitFor(() => expect(boardChild).toHaveBeenCalledWith('run1', { studentId: 'ada', onBoard: true }));
  expect(await screen.findByText('1 of 2 on board', { exact: false })).toBeTruthy();

  fireEvent.click(screen.getByRole('button', { name: /Mark all on board/ }));
  await waitFor(() => expect(boardChild).toHaveBeenCalledWith('run1', { studentId: 'bayo', onBoard: true }));

  fireEvent.click(await screen.findByRole('button', { name: /Arrived at school/ }));
  await waitFor(() => expect(markArrived).toHaveBeenCalledWith('run1'));
  expect(await screen.findByText(/2 children marked present/)).toBeTruthy();
});
