import React from 'react';
import StudentSectionShell from './StudentSectionShell';
import PracticeArena from '../../../features/practice-arena';

// Practice comes from the question bank — every question your teachers have
// given across your classes so far, and Ndovera's own bank — with no AI calls,
// so it is free and works offline once a subject is saved on the device.
export default function StudentPractice() {
  return (
    <StudentSectionShell
      title="Practice Arena"
      subtitle="Quizzes from your teachers' questions and Ndovera's bank. Earn XP, keep your streak, climb the leaderboard — online or offline."
    >
      <PracticeArena />
    </StudentSectionShell>
  );
}
