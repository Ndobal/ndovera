import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import operationalRoleConfigs from './config/operationalRoleConfigs';
import AmiTenantGovernance from '../../features/tenants/components/AmiTenantGovernance';
import AmiSecurityPage from './ami/AmiSecurityPage';
import AmiPoliciesPage from './ami/AmiPoliciesPage';
import AmiAuditsPage from './ami/AmiAuditsPage';
import AmiReportsPage from './ami/AmiReportsPage';
import AmiSettingsPage from './ami/AmiSettingsPage';
import AmiWebsitePage from './ami/AmiWebsitePage';
import AmiQuestionBank from './ami/AmiQuestionBank';
import AmiGrowthPartnersPage from './ami/AmiGrowthPartnersPage';
import AmiChampionshipsPage from './ami/AmiChampionshipsPage';
import AmiOverview from '../../features/ami/AmiOverview';
import AmiFinancePage from '../../features/ami/AmiFinancePage';
import AmiShareholdersPage from '../../features/ami/AmiShareholdersPage';
import AmiProfitLossPage from '../../features/ami/AmiProfitLossPage';
import AmiOutreachPage from '../../features/ami/AmiOutreachPage';
import { AmiPage } from '../../features/ami/AmiUi';

export default function AmiDashboard() {
  const location = useLocation();
  const roleConfig = operationalRoleConfigs.ami;
  const pathParts = location.pathname.split('/').filter(Boolean);
  const sectionKey = pathParts[2] || 'overview';
  const section = roleConfig.sections[sectionKey];

  if (!section) {
    return <Navigate to="/roles/ami" replace />;
  }

  // Pages with their own headings sit on the command-centre canvas with a breadcrumb.
  const framed = page => <AmiPage crumbs={[section.title]}>{page}</AmiPage>;
  if (sectionKey === 'overview')      return <AmiOverview />;
  if (sectionKey === 'finance')       return <AmiFinancePage />;
  if (sectionKey === 'shareholders')  return <AmiShareholdersPage />;
  if (sectionKey === 'profit-loss')   return <AmiProfitLossPage />;
  if (sectionKey === 'outreach')      return <AmiOutreachPage />;
  if (sectionKey === 'security')      return framed(<AmiSecurityPage />);
  if (sectionKey === 'policies')      return framed(<AmiPoliciesPage />);
  if (sectionKey === 'audits')        return <AmiAuditsPage />;
  if (sectionKey === 'reports')       return <AmiReportsPage />;
  if (sectionKey === 'website')       return framed(<AmiWebsitePage />);
  if (sectionKey === 'growth-partners') return framed(<AmiGrowthPartnersPage />);
  if (sectionKey === 'championships') return framed(<AmiChampionshipsPage />);
  if (sectionKey === 'settings')      return framed(<AmiSettingsPage />);
  if (sectionKey === 'question-bank') return framed(<AmiQuestionBank />);

  // tenants (Schools), billing (Billing & Pricing)
  return <AmiTenantGovernance sectionKey={sectionKey} />;
}
