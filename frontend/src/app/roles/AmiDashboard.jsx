import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import RoleSectionPage from '../../shared/components/RoleSectionPage';
import operationalRoleConfigs from './config/operationalRoleConfigs';
import AmiTenantGovernance from '../../features/tenants/components/AmiTenantGovernance';

export default function AmiDashboard() {
  const location = useLocation();
  const roleConfig = operationalRoleConfigs.ami;
  const pathParts = location.pathname.split('/').filter(Boolean);
  const sectionKey = pathParts[2] || 'overview';
  const section = roleConfig.sections[sectionKey];

  if (!section) {
    return <Navigate to="/roles/ami" replace />;
  }

  if (['overview', 'tenants', 'policies', 'reports'].includes(sectionKey)) {
    return <AmiTenantGovernance sectionKey={sectionKey} />;
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
