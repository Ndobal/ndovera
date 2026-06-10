import React from 'react';
import { useParams } from 'react-router-dom';
import StudentClassroomExperience from '../features/classroom/StudentClassroomExperience';
import TeacherClassroom from '../features/classroom/TeacherClassroom';

// Teachers and school supervisors (owner, HoS, ICT, admin) get the full multi-class management
// classroom: every class is listed, so they can monitor what is happening and override class
// content (posts, materials, attendance, subjects). Students and parents get the read-only view.
const CLASSROOM_MANAGER_ROLES = new Set(['teacher', 'classteacher', 'owner', 'hos', 'admin', 'ict', 'ict_manager']);

function managerDashboardLabel(role) {
  switch (role) {
    case 'owner': return 'Owner Dashboard';
    case 'hos': return 'Head of School';
    case 'ict':
    case 'ict_manager': return 'ICT Dashboard';
    case 'admin': return 'Admin Dashboard';
    default: return 'Teacher Dashboard';
  }
}

export default function RoleClassroom() {
  const { role } = useParams();
  const roleKey = String(role || '').trim().toLowerCase();
  if (CLASSROOM_MANAGER_ROLES.has(roleKey)) {
    const label = managerDashboardLabel(roleKey);
    return <TeacherClassroom dashboardLabel={label} watermarkText={label} />;
  }
  return <StudentClassroomExperience />;
}
