import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import RoleSectionPage from '../../shared/components/RoleSectionPage';
import teacherConfig from './config/teacherConfig';
import { TeacherCAScoreSheet } from '../../features/results-engine';
import { AuraBalance, StaffCashout, StaffFarmingMode, TransactionLog } from '../../features/auras';
import TeacherExams from './teacher/TeacherExams';
import TeacherPayslip from './teacher/TeacherPayslip';
import TeacherClassroom from '../../features/classroom/TeacherClassroom';
import TeacherOverview from './teacher/TeacherOverview';
import TeacherLessonPlansPage from '../../features/lesson-plans/TeacherLessonPlansPage';
import TeacherReports from './teacher/TeacherReports';
import TeacherAttendancePage from './teacher/TeacherAttendancePage';
import StaffSettingsPage from './shared/StaffSettingsPage';
import SchoolNewsroomPage from '../../features/school/components/SchoolNewsroomPage';
import StaffAiAssistantPage from '../../features/ai/components/StaffAiAssistantPage';
import TimetableViewer from '../../features/school/components/TimetableViewer';
import StudentMessaging from './student/StudentMessaging';
import useFeatureFlags from '../../shared/hooks/useFeatureFlags';
import { getStoredAuth } from '../../features/auth/services/authApi';

function TeacherAurasWorkspace({ auth, title, subtitle }) {
  const storedUser = auth?.user || getStoredAuth()?.user || {};
  const staffId = String(storedUser.id || storedUser.email || 'current_staff');
  const staffName = String(storedUser.name || storedUser.email || 'Staff');

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="rounded-3xl p-6 bg-[#f5deb3] dark:bg-slate-900/30 border border-[#c9a96e]/40 dark:border-white/10">
        <h1 className="text-2xl font-bold text-[#800000] dark:text-slate-100">{title}</h1>
        <p className="text-[#191970] dark:text-slate-300 mt-1 text-sm">{subtitle}</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <div className="space-y-6">
          <AuraBalance userId={staffId} />
          <div className="rounded-3xl border border-[#c9a96e]/40 bg-[#f5deb3] p-4 dark:border-white/10 dark:bg-slate-900/30">
            <StaffFarmingMode staffId={staffId} staffName={staffName} />
          </div>
        </div>

        <div className="rounded-3xl border border-[#c9a96e]/40 bg-[#f5deb3] p-6 dark:border-white/10 dark:bg-slate-900/30">
          <TransactionLog userId={staffId} userRole="teacher" />
        </div>
      </div>
    </div>
  );
}

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

  if (sectionKey === 'newsroom') {
    return <SchoolNewsroomPage viewerRole="teacher" dashboardLabel="Teacher Dashboard" />;
  }

  if (sectionKey === 'timetable') {
    return <TimetableViewer viewerRole="teacher" title="My Timetable" subtitle="Your weekly teaching schedule across all classes." />;
  }

  const section = teacherConfig.sections[sectionKey];

  if (!section) {
    return <Navigate to="/roles/teacher" replace />;
  }

  if (sectionKey === 'scores') {
    return <TeacherCAScoreSheet />;
  }

  if (sectionKey === 'offline-ca') {
    return <TeacherCAScoreSheet dashboardLabel="Teacher Dashboard" />;
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

  if (sectionKey === 'live') {
    return <TeacherClassroom initialTab="live" lockedTab="live" />;
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
    return (
      <StudentMessaging
        viewerRole="teacher"
        dashboardLabel="Teacher Dashboard"
        title="Messaging"
        subtitle="A clean school chat workspace for students, parents, staff, school admins, and helpdesk support."
      />
    );
  }

  if (sectionKey === 'settings') {
    return (
      <StaffSettingsPage
        title="Profile & Settings"
        subtitle="Keep your staff profile record current for payroll, attendance, and communication."
        dashboardLabel="Teacher Dashboard"
        watermarkText="Teacher Settings"
      />
    );
  }

  if (sectionKey === 'reports') {
    return <TeacherReports />;
  }

  if (sectionKey === 'ai-assistant') {
    return <StaffAiAssistantPage roleKey="teacher" roleTitle={teacherConfig.roleTitle} />;
  }

  if (sectionKey === 'auras') {
    return (
      <TeacherAurasWorkspace
        auth={auth}
        title="Auras"
        subtitle="Review your live wallet balance, transaction history, and farming status instead of a static rewards placeholder."
      />
    );
  }

  if (sectionKey === 'farming') {
    return (
      <TeacherAurasWorkspace
        auth={auth}
        title="Farming Mode"
        subtitle="Track your farming streak, eligibility, and wallet activity from the live Auras engine."
      />
    );
  }

  if (sectionKey === 'cashout') {
    return <StaffCashout staffId="current_staff" staffName="Staff" balance={1240} farmingMode={{ enabled: featureFlags.farmingModeEnabled, activeMonths: featureFlags.farmingModeEnabled ? 2 : 0 }} />;
  }

  return <Navigate to="/roles/teacher" replace />;
}
