import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import operationalRoleConfigs from './config/operationalRoleConfigs';
import AmiTenantGovernance from '../../features/tenants/components/AmiTenantGovernance';
import AmiSecurityPage from './ami/AmiSecurityPage';
import AmiPoliciesPage from './ami/AmiPoliciesPage';
import AmiAuditsPage from './ami/AmiAuditsPage';
import AmiReportsPage from './ami/AmiReportsPage';
import AmiSettingsPage from './ami/AmiSettingsPage';

export default function AmiDashboard() {
  const location = useLocation();
  const roleConfig = operationalRoleConfigs.ami;
  const pathParts = location.pathname.split('/').filter(Boolean);
  const sectionKey = pathParts[2] || 'overview';
  const section = roleConfig.sections[sectionKey];

  if (!section) {
    return <Navigate to="/roles/ami" replace />;
  }

  if (sectionKey === 'security') return <AmiSecurityPage />;
  if (sectionKey === 'policies') return <AmiPoliciesPage />;
  if (sectionKey === 'audits')   return <AmiAuditsPage />;
  if (sectionKey === 'reports')  return <AmiReportsPage />;
  if (sectionKey === 'settings') return <AmiSettingsPage />;

  // overview, tenants
  return <AmiTenantGovernance sectionKey={sectionKey} />;
}
