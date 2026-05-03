import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import RoleSectionPage from '../../shared/components/RoleSectionPage';
import ownerConfig from './config/ownerConfig';
import { OwnerResultAnalytics } from '../../features/results-engine';
import AdminPasswordReset from '../../features/auth/components/AdminPasswordReset';
import OwnerTenantConsole from '../../features/tenants/components/OwnerTenantConsole';

export default function OwnerDashboard({ auth = null }) {
  const location = useLocation();
  const pathParts = location.pathname.split('/').filter(Boolean);
  const sectionKey = pathParts[2] || 'overview';
  const section = ownerConfig.sections[sectionKey];

  if (!section) {
    return <Navigate to="/roles/owner" replace />;
  }

  const tenantStatus = auth?.user?.tenantStatus;

  if (tenantStatus !== 'active') {
    return <OwnerTenantConsole authUser={auth?.user} sectionKey={sectionKey} />;
  }

  if (sectionKey === 'overview' || sectionKey === 'academics' || sectionKey === 'reports') {
    return <OwnerResultAnalytics />;
  }

  // Show password reset UI in settings section
  if (sectionKey === 'settings') {
    return (
      <div>
        <RoleSectionPage
          roleTitle={ownerConfig.roleTitle}
          sectionTitle={section.title}
          sectionSubtitle={section.subtitle}
          watermark={ownerConfig.watermark}
          metricCards={section.cards || []}
          infoCards={section.panels || []}
        />
        <div className="mt-8">
          <AdminPasswordReset />
        </div>
      </div>
    );
  }

  return (
    <RoleSectionPage
      roleTitle={ownerConfig.roleTitle}
      sectionTitle={section.title}
      sectionSubtitle={section.subtitle}
      watermark={ownerConfig.watermark}
      metricCards={section.cards || []}
      infoCards={section.panels || []}
    />
  );
}
