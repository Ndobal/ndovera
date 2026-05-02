import React from 'react';
import CommandPageShell from '../shared/components/CommandPageShell';

export default function Rewards() {
  return (
    <CommandPageShell
      section="Incentive Engine"
      title="Rewards"
      description="View your earned Auras, badges, and unlockable features."
      chips={[
        { label: 'Badges', accent: 'accent-indigo' },
        { label: 'Auras', accent: 'accent-emerald' },
        { label: 'Milestones', accent: 'accent-amber' },
      ]}
    />
  );
}
