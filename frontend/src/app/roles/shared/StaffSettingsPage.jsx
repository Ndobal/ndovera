import React from 'react';
import StudentSectionShell from '../student/StudentSectionShell';
import { ProfileEditor } from '../../../features/student-settings';

export default function StaffSettingsPage({
  title = 'Profile & Settings',
  subtitle = 'Keep your staff record current for school operations.',
  dashboardLabel = 'Staff Dashboard',
  watermarkText = 'Staff Settings',
}) {
  return (
    <StudentSectionShell
      title={title}
      subtitle={subtitle}
      dashboardLabel={dashboardLabel}
      watermarkText={watermarkText}
    >
      <ProfileEditor viewerRole="staff" />
    </StudentSectionShell>
  );
}