import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import RoleSectionPage from '../../shared/components/RoleSectionPage';
import teacherConfig from './config/teacherConfig';
import { TeacherCAScoreSheet } from '../../features/results-engine';
import { StaffCashout } from '../../features/auras';
import TeacherExams from './teacher/TeacherExams';

export default function TeacherDashboard() {
  const location = useLocation();
  const pathParts = location.pathname.split('/').filter(Boolean);
  const sectionKey = pathParts[2] || 'overview';
  const section = teacherConfig.sections[sectionKey];

  if (!section) {
    return <Navigate to="/roles/teacher" replace />;
  }

  if (sectionKey === 'scores') {
    return <TeacherCAScoreSheet />;
  }

  if (sectionKey === 'exams') {
    return <TeacherExams />;
  }

  if (sectionKey === 'cashout') {
    return <StaffCashout staffId="current_staff" staffName="Staff" balance={1240} farmingMode={{ enabled: true, activeMonths: 2 }} />;
  }

  return (
    <RoleSectionPage
      roleTitle={teacherConfig.roleTitle}
      sectionTitle={section.title}
      sectionSubtitle={section.subtitle}
      watermark={teacherConfig.watermark}
      metricCards={section.cards || []}
      infoCards={section.panels || []}
    />
  );
}
