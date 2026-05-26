import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import RoleSectionPage from '../../shared/components/RoleSectionPage';
import accountantConfig from './config/accountantConfig';
import StaffSettingsPage from './shared/StaffSettingsPage';
import SchoolNewsroomPage from '../../features/school/components/SchoolNewsroomPage';
import PayrollManagementBoard from '../../features/school/components/PayrollManagementBoard';
import StaffAiAssistantPage from '../../features/ai/components/StaffAiAssistantPage';

export default function AccountantDashboard() {
  const location = useLocation();
  const pathParts = location.pathname.split('/').filter(Boolean);
  const sectionKey = pathParts[2] || 'overview';

  if (sectionKey === 'newsroom') {
    return <SchoolNewsroomPage viewerRole="accountant" dashboardLabel={accountantConfig.roleTitle} />;
  }

  const section = accountantConfig.sections[sectionKey];

  if (!section) {
    return <Navigate to="/roles/accountant" replace />;
  }

  if (sectionKey === 'settings') {
    return (
      <StaffSettingsPage
        title="Profile & Settings"
        subtitle="Update your accountant profile details used across finance and payroll workflows."
        dashboardLabel={accountantConfig.roleTitle}
        watermarkText="Accountant Settings"
      />
    );
  }

  if (sectionKey === 'payroll') {
    return <PayrollManagementBoard canApprove={false} />;
  }

  if (sectionKey === 'ai-assistant') {
    return <StaffAiAssistantPage roleKey="accountant" roleTitle={accountantConfig.roleTitle} />;
  }

  return (
    <RoleSectionPage
      roleTitle={accountantConfig.roleTitle}
      sectionTitle={section.title}
      sectionSubtitle={section.subtitle}
      watermark={accountantConfig.watermark}
      metricCards={[]}
      infoCards={section.panels || []}
      showMobileRoleNav={sectionKey === 'overview'}
      mobileNavRoleKey="accountant"
    />
  );
}
