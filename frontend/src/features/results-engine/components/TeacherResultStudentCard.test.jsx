import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import TeacherResultStudentCard from './TeacherResultStudentCard';
import { recomputeTeacherSheet } from '../utils/resultEngineTransforms';

const settings = { gradingScale: [], metadata: { caMaxScore: 40, examMaxScore: 60, caComponents: [{ key: 'ca1', label: 'CA 1', maxScore: 20 }] } };

function studentWith(typed) {
  const sheet = recomputeTeacherSheet({ settings, students: [{ id: 's1', name: 'Ada', rows: [{ subjectId: 'm', subjectName: 'Mathematics', caComponents: { ca1: Number(typed.ca1 || 0) }, exam: 0, typed }] }] });
  return sheet.students[0];
}

test('a CA score above 20 stays as typed, in red, and can be changed back to 8', () => {
  const onCaComponentChange = jest.fn();
  const { rerender } = render(<TeacherResultStudentCard index={0} student={studentWith({ ca1: '28' })} settings={settings} permissions={{}} onCaComponentChange={onCaComponentChange} onScoreChange={jest.fn()} onProfileFieldChange={jest.fn()} onProfileMapChange={jest.fn()} />);
  const box = screen.getByRole('spinbutton', { name: 'Mathematics CA 1' });
  expect(box).toHaveValue(28);
  expect(box).toHaveAttribute('aria-invalid', 'true');
  expect(screen.getByText('The most is 20')).toBeInTheDocument();

  fireEvent.change(box, { target: { value: '8' } });
  expect(onCaComponentChange).toHaveBeenLastCalledWith('s1', 'm', 'ca1', '8');
  rerender(<TeacherResultStudentCard index={0} student={studentWith({ ca1: '8' })} settings={settings} permissions={{}} onCaComponentChange={onCaComponentChange} onScoreChange={jest.fn()} onProfileFieldChange={jest.fn()} onProfileMapChange={jest.fn()} />);
  expect(screen.getByRole('spinbutton', { name: 'Mathematics CA 1' })).toHaveValue(8);
  expect(screen.queryByText('The most is 20')).not.toBeInTheDocument();
});
