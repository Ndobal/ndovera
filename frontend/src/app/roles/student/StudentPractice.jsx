import React, { useEffect, useState } from 'react';
import StudentSectionShell from './StudentSectionShell';
import PracticeTab from '../../../features/classroom/practice';
import { getAiAccess } from '../../../features/ai/services/aiTutorApi';

export default function StudentPractice() {
  const [auraBalance, setAuraBalance] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadAiBalance() {
      try {
        const data = await getAiAccess();
        if (!active) return;
        const nextBalance = Number(data?.access?.usage?.remainingFreeRequests || 0) + Number(data?.access?.wallet?.availableCredits || 0);
        setAuraBalance(Number.isFinite(nextBalance) && nextBalance >= 0 ? nextBalance : 0);
      } catch {
        if (active) {
          setAuraBalance(0);
        }
      }
    }

    loadAiBalance();
    return () => {
      active = false;
    };
  }, []);

  return (
    <StudentSectionShell
      title="Practice"
      subtitle="Choose a subject, solve mixed questions, and study with AI."
    >
      <PracticeTab auraBalance={auraBalance} setAuraBalance={setAuraBalance} />
    </StudentSectionShell>
  );
}
