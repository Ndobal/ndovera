import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import RoleSectionPage from '../../shared/components/RoleSectionPage';
import operationalRoleConfigs from './config/operationalRoleConfigs';
import WebsiteTab from './owner/tabs/WebsiteTab';
import TeacherClassroom from '../../features/classroom/TeacherClassroom';

export default function OperationalRoleDashboard({ roleKey }) {
  const location = useLocation();
  const roleConfig = operationalRoleConfigs[roleKey];

  if (!roleConfig) {
    return <Navigate to="/roles/student" replace />;
  }

  const pathParts = location.pathname.split('/').filter(Boolean);
  const sectionKey = pathParts[2] || 'overview';
  const section = roleConfig.sections[sectionKey];

  if (!section) {
    return <Navigate to={`/roles/${roleKey}`} replace />;
  }

  if (roleKey === 'ict' && sectionKey === 'settings') {
    return (
      <div className="p-8 max-w-7xl mx-auto space-y-6">
        <div className="rounded-3xl p-6 bg-[#f5deb3] dark:bg-slate-900/30 border border-[#c9a96e]/40 dark:border-white/10">
          <h1 className="text-2xl font-bold text-[#800000] dark:text-slate-100">Settings</h1>
          <p className="text-[#191970] dark:text-slate-300 mt-1 text-sm">
            Manage public school website media, admissions content, and page sections.
          </p>
        </div>
        <WebsiteTab />
      </div>
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

  return (
    <RoleSectionPage
      roleTitle={roleConfig.roleTitle}
      sectionTitle={section.title}
      sectionSubtitle={section.subtitle}
      watermark={roleConfig.watermark}
      metricCards={[]}
      infoCards={section.panels || []}
    />
  );
}
