import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import SchoolClassResults from './SchoolClassResults';
import { getClasses, getResultOverview } from '../../school/services/schoolApi';

jest.mock('../../school/services/schoolApi', () => ({ getClasses: jest.fn(), getResultOverview: jest.fn() }));
// The sheet and the analytics are the existing screens; here we only check they are opened correctly.
jest.mock('./TeacherCAScoreSheet', () => props => <div data-testid="sheet">{`sheet for ${props.fixedClassId} (${props.fixedClassName})`}</div>);
jest.mock('./ResultAdminConsole', () => () => <div data-testid="analytics">analytics</div>);

beforeEach(() => {
  window.history.replaceState({}, '', '/roles/hos/academics');
  getClasses.mockResolvedValue({ success: true, classes: [{ id: 'ss2a', name: 'SS 2', arm: 'A' }, { id: 'jss1', name: 'JSS 1', arm: '' }] });
  getResultOverview.mockResolvedValue({ success: true, batches: [{ classId: 'ss2a', status: 'submitted', sessionName: '2026/2027', termName: 'First Term' }] });
});

test('leadership sees every class with where its results stand, and opens a class to its CA score sheet', async () => {
  render(<SchoolClassResults analyticsMode="hos" roleTitle="Head of School Dashboard" />);
  expect(await screen.findByText('SS 2 A')).toBeTruthy();
  expect(screen.getByText('JSS 1')).toBeTruthy();
  expect(screen.getByText(/Submitted — awaiting approval/)).toBeTruthy();
  expect(screen.getByText(/No scores yet/)).toBeTruthy();
  expect(screen.getByTestId('analytics')).toBeTruthy();

  fireEvent.click(screen.getByText('SS 2 A'));
  expect(screen.getByTestId('sheet').textContent).toBe('sheet for ss2a (SS 2 A)');
  expect(window.location.search).toBe('?classId=ss2a');

  fireEvent.click(screen.getByText('← All classes'));
  expect(await screen.findByText('JSS 1')).toBeTruthy();
  expect(window.location.search).toBe('');
});

test('a link straight to a class opens its sheet', async () => {
  window.history.replaceState({}, '', '/roles/hos/academics?classId=jss1');
  render(<SchoolClassResults />);
  expect((await screen.findByTestId('sheet')).textContent).toMatch(/sheet for jss1/);
});
