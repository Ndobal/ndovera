import React from 'react';
import CommandPageShell from '../shared/components/CommandPageShell';

export default function Settings() {
  return (
    <CommandPageShell
      section="Control Layer"
      title="Settings"
      description="Manage your profile, security options, and dashboard preferences."
      chips={[
        { label: 'Profile', accent: 'accent-indigo' },
        { label: 'Security', accent: 'accent-amber' },
        { label: 'Preferences', accent: 'accent-emerald' },
      ]}
    />
  );
}
