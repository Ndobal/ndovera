import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import operationalRoleConfigs from './config/operationalRoleConfigs';
import WebsiteTab from './owner/tabs/WebsiteTab';
import TeacherClassroom from '../../features/classroom/TeacherClassroom';
import { ResultAdminConsole, TeacherCAScoreSheet } from '../../features/results-engine';
import OwnerPeople from './owner/OwnerPeople';
import OwnerAttendance from './owner/OwnerAttendance';
import SchoolAnnouncementsPanel from '../../shared/components/SchoolAnnouncementsPanel';
import LessonPlanReviewPage from '../../features/lesson-plans/LessonPlanReviewPage';
import StaffAttendanceManagementPanel from '../../features/attendance/components/StaffAttendanceManagementPanel';
import AdmissionsManagementBoard from '../../features/school/components/AdmissionsManagementBoard';
import StaffSettingsPage from './shared/StaffSettingsPage';
import SchoolNewsroomPage from '../../features/school/components/SchoolNewsroomPage';
import SchoolAuditTrailPage from '../../features/school/components/SchoolAuditTrailPage';
import StaffAiAssistantPage from '../../features/ai/components/StaffAiAssistantPage';
import AdminLibrary from '../../features/library/AdminLibrary';

function OperationalLiveWorkspace({ roleTitle, title, subtitle, showAnnouncements = false, children = null }) {
  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="rounded-3xl p-6 bg-[#b5e3f4] dark:bg-slate-900/30 border border-[#c9a96e]/40 dark:border-white/10">
        <h1 className="text-2xl font-bold text-[#800000] dark:text-slate-100">{title}</h1>
        <p className="text-[#191970] dark:text-slate-300 mt-1 text-sm">{subtitle}</p>
      </div>
      {showAnnouncements ? <SchoolAnnouncementsPanel subtitle="Publish operational updates that staff can see immediately across the school workspace." /> : null}
      {children}
      <SchoolAuditTrailPage
        roleLabel={roleTitle}
        title={`${title} Activity Feed`}
        subtitle="Use the live audit trail instead of placeholder cards so operational teams can track real platform activity as it happens."
      />
    </div>
  );
}

export default function OperationalRoleDashboard({ roleKey }) {
  const location = useLocation();
  const normalizedRoleKey = roleKey === 'ict_manager' ? 'ict' : roleKey;
  const isIctSurface = normalizedRoleKey === 'ict';
  const roleConfig = operationalRoleConfigs[normalizedRoleKey];
  const roleTitle = roleKey === 'ict_manager' ? 'ICT Manager Dashboard' : roleConfig?.roleTitle;

  if (!roleConfig) {
    return <Navigate to="/roles/student" replace />;
  }

  const pathParts = location.pathname.split('/').filter(Boolean);
  const sectionKey = pathParts[2] || 'overview';

  if (sectionKey === 'newsroom') {
    return <SchoolNewsroomPage viewerRole={roleKey} dashboardLabel={roleTitle} />;
  }

  const section = roleConfig.sections[sectionKey];

  if (!section) {
    return <Navigate to={`/roles/${roleKey}`} replace />;
  }

  if (roleKey === 'librarian' && sectionKey !== 'settings') {
    return (
      <OperationalLiveWorkspace
        roleTitle={roleTitle}
        title={section.title}
        subtitle={section.subtitle}
        showAnnouncements={sectionKey === 'overview'}
      >
        <div className="rounded-3xl p-6 bg-[#b5e3f4] dark:bg-slate-900/30 border border-[#c9a96e]/40 dark:border-white/10">
          <AdminLibrary />
        </div>
      </OperationalLiveWorkspace>
    );
  }

  if (sectionKey === 'overview') {
    if (roleKey === 'classteacher') {
      return <TeacherClassroom initialTab="stream" dashboardLabel="Class Teacher Dashboard" watermarkText="Class Teacher Dashboard" />;
    }

    if (roleKey === 'hod' || roleKey === 'hodassistant') {
      return <LessonPlanReviewPage dashboardLabel={roleConfig.roleTitle} />;
    }

    return (
      <OperationalLiveWorkspace
        roleTitle={roleTitle}
        title={roleTitle}
        subtitle={section.subtitle || 'Monitor live operational activity, announcements, and school-wide system events from one screen.'}
        showAnnouncements
      />
    );
  }

  if (isIctSurface && sectionKey === 'people') {
    return <OwnerPeople />;
  }

  if (isIctSurface && sectionKey === 'overview') {
    return (
      <OperationalLiveWorkspace
        roleTitle={roleTitle}
        title={roleTitle}
        subtitle="Monitor access, systems, and school-wide communication from one place."
        showAnnouncements
      />
    );
  }

  if (isIctSurface && sectionKey === 'settings') {
    return (
      <div className="p-8 max-w-7xl mx-auto space-y-6">
        <div className="rounded-3xl p-6 bg-[#b5e3f4] dark:bg-slate-900/30 border border-[#c9a96e]/40 dark:border-white/10">
          <h1 className="text-2xl font-bold text-[#800000] dark:text-slate-100">Settings</h1>
          <p className="text-[#191970] dark:text-slate-300 mt-1 text-sm">
            Manage public school website media, admissions content, and staff attendance sign-in policy.
          </p>
        </div>
        <div className="rounded-3xl p-6 bg-[#b5e3f4] dark:bg-slate-900/30 border border-[#c9a96e]/40 dark:border-white/10">
          <WebsiteTab />
        </div>
        <div className="rounded-3xl p-6 bg-[#b5e3f4] dark:bg-slate-900/30 border border-[#c9a96e]/40 dark:border-white/10">
          <StaffAttendanceManagementPanel />
        </div>
      </div>
    );
  }

  if (sectionKey === 'settings') {
    return (
      <StaffSettingsPage
        title="Profile & Settings"
        subtitle="Keep your staff profile and contact information up to date for daily school operations."
        dashboardLabel={roleTitle}
        watermarkText={`${roleTitle} Settings`}
      />
    );
  }

  if (isIctSurface && sectionKey === 'results') {
    return <ResultAdminConsole analyticsMode="hos" roleTitle={roleTitle} />;
  }

  if (isIctSurface && ['support', 'systems', 'access', 'assets', 'reports'].includes(sectionKey)) {
    return (
      <OperationalLiveWorkspace
        roleTitle={roleTitle}
        title={section.title}
        subtitle={section.subtitle}
        showAnnouncements={sectionKey === 'support'}
      >
        {sectionKey === 'access' ? (
          <div className="rounded-3xl p-6 bg-[#b5e3f4] dark:bg-slate-900/30 border border-[#c9a96e]/40 dark:border-white/10">
            <OwnerPeople />
          </div>
        ) : null}
      </OperationalLiveWorkspace>
    );
  }

  if (roleKey === 'classteacher' && sectionKey === 'attendance') {
    return (
      <TeacherClassroom
        initialTab="attendance"
        lockedTab="attendance"
        dashboardLabel="Class Teacher Dashboard"
        watermarkText="Class Teacher Dashboard"
      />
    );
  }

  if (roleKey === 'classteacher' && sectionKey === 'results') {
    return <TeacherCAScoreSheet dashboardLabel="Class Teacher Dashboard" />;
  }

  if ((roleKey === 'hod' || roleKey === 'hodassistant') && sectionKey === 'lessons') {
    return <LessonPlanReviewPage dashboardLabel={roleConfig.roleTitle} />;
  }

  if (sectionKey === 'attendance') {
    return <OwnerAttendance />;
  }

  if (sectionKey === 'ai-assistant') {
    return <StaffAiAssistantPage roleKey={roleKey} roleTitle={roleTitle} />;
  }

  if (['transport', 'hostel', 'clinic'].includes(roleKey) && sectionKey === 'admissions') {
    return <AdmissionsManagementBoard audience={roleKey} title={`${roleConfig.roleTitle} Admissions Queue`} subtitle="Review incoming applicants that need your operational follow-up before resumption." />;
  }

  if (sectionKey === 'reports') {
    return (
      <OperationalLiveWorkspace
        roleTitle={roleTitle}
        title={section.title}
        subtitle={section.subtitle}
      />
    );
  }

  return <OperationalLiveWorkspace roleTitle={roleTitle} title={section.title} subtitle={section.subtitle} />;
}
