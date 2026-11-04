import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import DriverTransportPage from './DriverTransportPage';
import { boardChild, getDriverTransport, markArrived, openDriverRun } from './transportApi';

jest.mock('./transportApi', () => ({
  ...jest.requireActual('./transportApi'),
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

test('the driver navigates to a home, or to the next children still to collect', async () => {
  const withHomes = [
    { ...riders[0], home: { address: '12 Airport Road', landmark: 'Blue gate', lat: 8.98, lng: 7.38 } },
    { ...riders[1], home: { address: '4 Kuje Road, Abuja', landmark: '', lat: null, lng: null } },
    { studentId: 'chi', name: 'Chi Eze', className: 'JSS 2A', tripNo: 1, directions: 'both', home: null },
  ];
  openDriverRun.mockResolvedValue({ run: { id: 'run1', direction: 'morning', tripNo: 1 }, boarded: [], riders: withHomes });
  render(<DriverTransportPage />);
  fireEvent.click(await screen.findByRole('button', { name: /Start morning run/ }));
  const links = await screen.findAllByRole('link', { name: /Navigate/ });
  expect(links).toHaveLength(2);
  expect(links[0].getAttribute('href')).toContain('destination=8.98%2C7.38');
  expect(links[0].getAttribute('href')).toContain('dir_action=navigate');
  expect(links[1].getAttribute('href')).toContain('destination=4+Kuje+Road');
  expect(screen.getByText(/No home location yet/)).toBeTruthy();
  const next = screen.getByRole('link', { name: /next 2 children/ }).getAttribute('href');
  expect(next).toContain('waypoints=8.98%2C7.38');
  fireEvent.click(screen.getByRole('button', { name: /Ada Obi/ }));
  expect(await screen.findByRole('link', { name: /next child/ })).toBeTruthy();
});
