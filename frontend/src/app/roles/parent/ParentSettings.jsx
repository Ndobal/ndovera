import React from 'react';
import StudentSectionShell from '../student/StudentSectionShell';
import { ProfileEditor } from '../../../features/student-settings';

export default function ParentSettings() {
  return (
    <StudentSectionShell
      title="Profile & Security"
      subtitle="Keep your household contact details, birthdays, and linked learner admission records current for the school."
      dashboardLabel="Parent Dashboard"
      watermarkText="Parent Settings"
    >
      <ProfileEditor viewerRole="parent" allowLinkedStudents />
    </StudentSectionShell>
  );
}