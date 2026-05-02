import React from 'react';
import CommandPageShell from '../shared/components/CommandPageShell';

export default function AITutor() {
  return (
    <CommandPageShell
      section="Adaptive Intelligence"
      title="AI Tutor"
      description="Get homework help, lesson explanations, and exam prep powered by NDOVERA AI."
      chips={[
        { label: 'Prompt Assist', accent: 'accent-indigo' },
        { label: 'Hints', accent: 'accent-emerald' },
        { label: 'Practice', accent: 'accent-amber' },
      ]}
    />
  );
}
