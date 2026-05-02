import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import StudentOverview from './student/StudentOverview';
import StudentPractice from './student/StudentPractice';
import { StudentFarmingMode } from '../../features/auras';

export default function StudentDashboard() {
  const location = useLocation();
  const pathParts = location.pathname.split('/').filter(Boolean);
  const sectionKey = pathParts[2] || 'overview';

  if (sectionKey === 'farmingmode') {
    return <StudentFarmingMode studentId="current_student" studentName="Student" />;
  }

  if (sectionKey === 'practice') {
    return <StudentPractice />;
  }

  if (sectionKey !== 'overview') {
    return <Navigate to="/roles/student" replace />;
  }

  return <StudentOverview />;
}
