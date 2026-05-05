import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import OwnerTenantConsole from '../../features/tenants/components/OwnerTenantConsole';
import { OwnerResultAnalytics } from '../../features/results-engine';
import AdminLibrary from '../../features/library/AdminLibrary';
import RoleLibrary from '../RoleLibrary';
import OwnerOverview from './owner/OwnerOverview';
import OwnerSchools from './owner/OwnerSchools';
import OwnerFinance from './owner/OwnerFinance';
import OwnerPeople from './owner/OwnerPeople';
import OwnerCompliance from './owner/OwnerCompliance';
import OwnerApprovals from './owner/OwnerApprovals';
import OwnerReports from './owner/OwnerReports';
import OwnerSettings from './owner/OwnerSettings';

export default function OwnerDashboard({ auth = null }) {
  const location = useLocation();
  const pathParts = location.pathname.split('/').filter(Boolean);
  const sectionKey = pathParts[2] || 'overview';

  const tenantStatus = auth?.user?.tenantStatus;
  if (tenantStatus !== 'active') {
    return <OwnerTenantConsole authUser={auth?.user} sectionKey={sectionKey} />;
  }

  switch (sectionKey) {
    case 'overview': return <OwnerOverview auth={auth} />;
    case 'schools': return <OwnerSchools auth={auth} />;
    case 'finance': return <OwnerFinance auth={auth} />;
    case 'academics': return <OwnerResultAnalytics />;
    case 'people': return <OwnerPeople auth={auth} />;
    case 'compliance': return <OwnerCompliance auth={auth} />;
    case 'approvals': return <OwnerApprovals auth={auth} />;
    case 'reports': return <OwnerReports auth={auth} />;
    case 'settings': return <OwnerSettings auth={auth} />;
    case 'library': return <RoleLibrary />;
    case 'library-admin': return <AdminLibrary />;
    default: return <Navigate to="/roles/owner" replace />;
  }
}
