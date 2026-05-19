import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import RoleSectionPage from '../../shared/components/RoleSectionPage';
import teacherConfig from './config/teacherConfig';
import { TeacherCAScoreSheet } from '../../features/results-engine';
import { StaffCashout } from '../../features/auras';
import TeacherExams from './teacher/TeacherExams';
import TeacherPayslip from './teacher/TeacherPayslip';
import TeacherClassroom from '../../features/classroom/TeacherClassroom';
import TeacherOverview from './teacher/TeacherOverview';
import TeacherMessaging from './teacher/TeacherMessaging';
import TeacherLessonPlansPage from '../../features/lesson-plans/TeacherLessonPlansPage';
import TeacherReports from './teacher/TeacherReports';
import TeacherAttendancePage from './teacher/TeacherAttendancePage';
import useFeatureFlags from '../../shared/hooks/useFeatureFlags';

export default function TeacherDashboard({ auth }) {
  const location = useLocation();
  const pathParts = location.pathname.split('/').filter(Boolean);
  const sectionKey = pathParts[2] || 'overview';
  const { featureFlags } = useFeatureFlags();

  const renderDisabledFeature = (title, subtitle) => (
    <RoleSectionPage
      roleTitle={teacherConfig.roleTitle}
      sectionTitle={title}
      sectionSubtitle={subtitle}
      watermark={teacherConfig.watermark}
      metricCards={[]}
      infoCards={[
        {
          title: 'Disabled By AMI Governance',
          items: [
            { text: 'This feature is currently turned off for your school.' },
            { text: 'AMI can enable it globally or for this specific tenant.' },
          ],
        },
      ]}
      theme="wheat"
    />
  );

  if (sectionKey === 'payslip') {
    return <TeacherPayslip auth={auth} />;
  }

  if (sectionKey === 'auras' && !featureFlags.aurasEnabled) {
    return renderDisabledFeature('Auras', 'Auras is currently disabled by AMI governance for this school.');
  }

  if ((sectionKey === 'farming' || sectionKey === 'cashout') && !featureFlags.farmingModeEnabled) {
    return renderDisabledFeature('Farming Mode', 'Farming mode and cashout are currently disabled by AMI governance for this school.');
  }

  if (sectionKey === 'overview') {
    return <TeacherOverview />;
  }

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

  if (sectionKey === 'practice') {
    return <TeacherExams mode="practice" title="Practice Drills" subtitle="Create live practice drills from the question bank instead of placeholder demo data." />;
  }

  if (sectionKey === 'attendance') {
    return <TeacherAttendancePage auth={auth} />;
  }

  if (sectionKey === 'classroom') {
    return <TeacherClassroom initialTab="stream" />;
  }

  if (sectionKey === 'assignments') {
    return <TeacherClassroom initialTab="assignments" lockedTab="assignments" />;
  }

  if (sectionKey === 'materials' || sectionKey === 'lesson-notes') {
    return <TeacherClassroom initialTab="materials" lockedTab="materials" />;
  }

  if (sectionKey === 'lesson-plan') {
    return <TeacherLessonPlansPage />;
  }

  if (sectionKey === 'messaging') {
    return <TeacherMessaging auth={auth} />;
  }

  if (sectionKey === 'reports') {
    return <TeacherReports />;
  }

  if (sectionKey === 'cashout') {
    return <StaffCashout staffId="current_staff" staffName="Staff" balance={1240} farmingMode={{ enabled: featureFlags.farmingModeEnabled, activeMonths: featureFlags.farmingModeEnabled ? 2 : 0 }} />;
  }

  return (
    <RoleSectionPage
      roleTitle={teacherConfig.roleTitle}
      sectionTitle={section.title}
      sectionSubtitle={section.subtitle}
      watermark={teacherConfig.watermark}
      metricCards={section.cards || []}
      infoCards={section.panels || []}
      theme="wheat"
    />
  );
}
