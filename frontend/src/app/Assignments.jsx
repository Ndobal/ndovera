import React from 'react';
import CommandPageShell from '../shared/components/CommandPageShell';

export default function Assignments() {
  return (
    <CommandPageShell
      section="Task Node"
      title="Assignments"
      description="Submit assignments, view deadlines, and check teacher feedback here."
      chips={[
        { label: 'Draft', accent: 'accent-indigo' },
        { label: 'Due Today', accent: 'accent-amber' },
        { label: 'Submitted', accent: 'accent-emerald' },
      ]}
    />
  );
}
