import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import RoleSectionPage from '../../shared/components/RoleSectionPage';
import operationalRoleConfigs from './config/operationalRoleConfigs';

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

  return (
    <RoleSectionPage
      roleTitle={roleConfig.roleTitle}
      sectionTitle={section.title}
      sectionSubtitle={section.subtitle}
      watermark={roleConfig.watermark}
      metricCards={section.cards || []}
      infoCards={section.panels || []}
    />
  );
}
