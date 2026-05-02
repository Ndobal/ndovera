import React from 'react';
import StudentSectionShell from './StudentSectionShell';
import { ProfileEditor, PasswordChanger, DevicesManager, AppSettings, PrivacySettings } from '../../../features/student-settings';

export default function StudentSettings() {
  return (
    <StudentSectionShell title="Settings" subtitle="Change your account and app preferences.">
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="col-span-2">
            <ProfileEditor />
            <AppSettings />
          </div>
          <div className="col-span-1 space-y-4">
            <PasswordChanger />
            <DevicesManager />
          </div>
        </div>

        <div>
          <PrivacySettings />
        </div>
      </div>
    </StudentSectionShell>
  );
}
