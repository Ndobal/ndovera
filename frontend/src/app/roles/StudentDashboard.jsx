import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import StudentOverview from './student/StudentOverview';
import StudentPractice from './student/StudentPractice';
import { StudentFarmingMode } from '../../features/auras';
import RoleSectionPage from '../../shared/components/RoleSectionPage';
import useFeatureFlags from '../../shared/hooks/useFeatureFlags';

export default function StudentDashboard() {
  const location = useLocation();
  const pathParts = location.pathname.split('/').filter(Boolean);
  const sectionKey = pathParts[2] || 'overview';
  const { featureFlags } = useFeatureFlags();

  if (sectionKey === 'farmingmode') {
    if (!featureFlags.farmingModeEnabled) {
      return (
        <RoleSectionPage
          roleTitle="Student Dashboard"
          sectionTitle="Farming Mode"
          sectionSubtitle="Farming mode is currently disabled by AMI governance for this school."
          watermark="STUDENT"
          metricCards={[]}
          infoCards={[{ title: 'Feature Disabled', items: [{ text: 'AMI must enable farming mode before students can use it.' }] }]}
        />
      );
    }
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
