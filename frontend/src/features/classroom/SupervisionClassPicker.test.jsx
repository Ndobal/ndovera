import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import SupervisionClassPicker from './SupervisionClassPicker';
import { setClassSupervision, setSupervisionPolicy } from './classroomService';

jest.mock('./classroomService', () => ({ setClassSupervision: jest.fn(), setSupervisionPolicy: jest.fn() }));

const classes = [
  { id: 'jss2a', className: 'JSS 2A', supervisionJoined: true, studentCount: 30, subjectCount: 9, materialCount: 4, assignmentCount: 2 },
  { id: 'jss1b', className: 'JSS 1B', supervisionJoined: false, studentCount: 28, subjectCount: 9, materialCount: 1, assignmentCount: 0 },
];

beforeEach(() => jest.clearAllMocks());

test('the owner sees supervised classes first and joins another from All Classes', async () => {
  setClassSupervision.mockResolvedValue({ success: true });
  const onEnter = jest.fn();
  const onClassesChange = jest.fn();
  render(<SupervisionClassPicker classes={classes} supervision={{ role: 'owner', label: 'School Owner', canIntervene: true, hosMode: 'intervene' }}
    onEnter={onEnter} onClassesChange={onClassesChange} onPolicyChange={jest.fn()} />);
  expect(screen.getByText('JSS 2A')).toBeTruthy();
  expect(screen.queryByText('JSS 1B')).toBeNull();
  fireEvent.click(screen.getByText('All Classes (2)'));
  fireEvent.click(screen.getByText('Join Class'));
  await waitFor(() => expect(setClassSupervision).toHaveBeenCalledWith('jss1b', 'join'));
  expect(onEnter).toHaveBeenCalledWith('jss1b');
  expect(onClassesChange.mock.calls[0][0].find(item => item.id === 'jss1b').supervisionJoined).toBe(true);
});

test('only the owner can switch the Head of School to view only', async () => {
  setSupervisionPolicy.mockResolvedValue({ success: true, hosMode: 'view' });
  const onPolicyChange = jest.fn();
  const { rerender } = render(<SupervisionClassPicker classes={classes} supervision={{ role: 'owner', label: 'School Owner', canIntervene: true, hosMode: 'intervene' }}
    onEnter={jest.fn()} onClassesChange={jest.fn()} onPolicyChange={onPolicyChange} />);
  fireEvent.change(screen.getByLabelText('Head of School access'), { target: { value: 'view' } });
  await waitFor(() => expect(onPolicyChange).toHaveBeenCalledWith('view'));
  rerender(<SupervisionClassPicker classes={classes} supervision={{ role: 'hos', label: 'Head of School', canIntervene: false, hosMode: 'view' }}
    onEnter={jest.fn()} onClassesChange={jest.fn()} onPolicyChange={jest.fn()} />);
  expect(screen.queryByLabelText('Head of School access')).toBeNull();
  expect(screen.getByText(/view only, by school policy/)).toBeTruthy();
});
