import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import RoleSectionPage from '../../shared/components/RoleSectionPage';
import accountantConfig from './config/accountantConfig';

export default function AccountantDashboard() {
  const location = useLocation();
  const pathParts = location.pathname.split('/').filter(Boolean);
  const sectionKey = pathParts[2] || 'overview';
  const section = accountantConfig.sections[sectionKey];

  if (!section) {
    return <Navigate to="/roles/accountant" replace />;
  }

  return (
    <RoleSectionPage
      roleTitle={accountantConfig.roleTitle}
      sectionTitle={section.title}
      sectionSubtitle={section.subtitle}
      watermark={accountantConfig.watermark}
      metricCards={[]}
      infoCards={section.panels || []}
    />
  );
}
