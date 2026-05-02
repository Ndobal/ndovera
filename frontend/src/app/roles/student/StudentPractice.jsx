import React, { useState } from 'react';
import StudentSectionShell from './StudentSectionShell';
import PracticeTab from '../../../features/classroom/practice';
import { useAuraBalance } from '../../../features/auras/hooks/useAuraBalance';

export default function StudentPractice() {
  // assume current student id accessible via auth/context
  const studentId = localStorage.getItem('userId') || 'current_student';
  const { balance } = useAuraBalance(studentId);
  const [auraBalance, setAuraBalance] = useState(balance ?? 0);

  // keep local balance synced with hook result
  React.useEffect(() => {
    if (balance !== undefined) setAuraBalance(balance);
  }, [balance]);

  return (
    <StudentSectionShell
      title="Practice"
      subtitle="Train, improve, and get better every day."
    >
      <PracticeTab auraBalance={auraBalance} setAuraBalance={setAuraBalance} />
    </StudentSectionShell>
  );
}
