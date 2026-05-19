import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import RoleSectionPage from '../../shared/components/RoleSectionPage';
import operationalRoleConfigs from './config/operationalRoleConfigs';
import WebsiteTab from './owner/tabs/WebsiteTab';
import TeacherClassroom from '../../features/classroom/TeacherClassroom';
import { ResultAdminConsole, TeacherCAScoreSheet } from '../../features/results-engine';
import OwnerPeople from './owner/OwnerPeople';
import SchoolAnnouncementsPanel from '../../shared/components/SchoolAnnouncementsPanel';
import LessonPlanReviewPage from '../../features/lesson-plans/LessonPlanReviewPage';
import StaffAttendanceManagementPanel from '../../features/attendance/components/StaffAttendanceManagementPanel';
import AdmissionsManagementBoard from '../../features/school/components/AdmissionsManagementBoard';

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
  const section = roleConfig.sections[sectionKey];

  if (!section) {
    return <Navigate to={`/roles/${roleKey}`} replace />;
  }

  if (isIctSurface && sectionKey === 'people') {
    return <OwnerPeople />;
  }

  if (isIctSurface && sectionKey === 'overview') {
    return (
      <div className="p-8 max-w-7xl mx-auto space-y-6">
        <div className="rounded-3xl p-6 bg-[#f5deb3] dark:bg-slate-900/30 border border-[#c9a96e]/40 dark:border-white/10">
          <h1 className="text-2xl font-bold text-[#800000] dark:text-slate-100">{roleTitle}</h1>
          <p className="text-[#191970] dark:text-slate-300 mt-1 text-sm">
            Monitor access, systems, and school-wide communication from one place.
          </p>
        </div>

        <SchoolAnnouncementsPanel subtitle="Publish an ICT or systems-wide update here. School users will see it in their notification bell across the app." />

        <RoleSectionPage
          roleTitle={roleTitle}
          sectionTitle={section.title}
          sectionSubtitle={section.subtitle}
          watermark={roleConfig.watermark}
          metricCards={section.cards || []}
          infoCards={section.panels || []}
        />
      </div>
    );
  }

  if (isIctSurface && sectionKey === 'settings') {
    return (
      <div className="p-8 max-w-7xl mx-auto space-y-6">
        <div className="rounded-3xl p-6 bg-[#f5deb3] dark:bg-slate-900/30 border border-[#c9a96e]/40 dark:border-white/10">
          <h1 className="text-2xl font-bold text-[#800000] dark:text-slate-100">Settings</h1>
          <p className="text-[#191970] dark:text-slate-300 mt-1 text-sm">
            Manage public school website media, admissions content, and staff attendance sign-in policy.
          </p>
        </div>
        <div className="rounded-3xl p-6 bg-[#f5deb3] dark:bg-slate-900/30 border border-[#c9a96e]/40 dark:border-white/10">
          <WebsiteTab />
        </div>
        <div className="rounded-3xl p-6 bg-[#f5deb3] dark:bg-slate-900/30 border border-[#c9a96e]/40 dark:border-white/10">
          <StaffAttendanceManagementPanel />
        </div>
      </div>
    );
  }

  if (isIctSurface && sectionKey === 'results') {
    return <ResultAdminConsole analyticsMode="hos" roleTitle={roleTitle} />;
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

  if (['transport', 'hostel', 'clinic'].includes(roleKey) && sectionKey === 'admissions') {
    return <AdmissionsManagementBoard audience={roleKey} title={`${roleConfig.roleTitle} Admissions Queue`} subtitle="Review incoming applicants that need your operational follow-up before resumption." />;
  }

  return (
    <RoleSectionPage
      roleTitle={roleTitle}
      sectionTitle={section.title}
      sectionSubtitle={section.subtitle}
      watermark={roleConfig.watermark}
      metricCards={[]}
      infoCards={section.panels || []}
    />
  );
}
