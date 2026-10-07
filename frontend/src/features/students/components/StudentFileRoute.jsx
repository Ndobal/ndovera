import React from 'react';
import { useParams } from 'react-router-dom';
import StudentSectionShell from '../../../app/roles/student/StudentSectionShell';
import StudentProfilePage from './StudentProfilePage';

/** /roles/:role/students/:studentId — the same Digital Student File, as a page. */
export default function StudentFileRoute() {
  const { studentId = '' } = useParams();
  return (
    <StudentSectionShell title="Student File" dashboardLabel="Student File">
      <StudentProfilePage studentId={decodeURIComponent(studentId)} inline />
    </StudentSectionShell>
  );
}
