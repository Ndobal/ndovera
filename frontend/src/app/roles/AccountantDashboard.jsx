import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import accountantConfig from './config/accountantConfig';
import StaffSettingsPage from './shared/StaffSettingsPage';
import SchoolNewsroomPage from '../../features/school/components/SchoolNewsroomPage';
import PayrollManagementBoard from '../../features/school/components/PayrollManagementBoard';
import StaffAiAssistantPage from '../../features/ai/components/StaffAiAssistantPage';
import OwnerFinance from './owner/OwnerFinance';
import FeesManagementBoard from '../../features/school/components/FeesManagementBoard';
import FeeReceiptsBoard from '../../features/school/components/FeeReceiptsBoard';
import FinanceReconciliationBoard from '../../features/school/components/FinanceReconciliationBoard';
import TuckShopFinanceBoard from '../../features/school/components/TuckShopFinanceBoard';
import SchoolAuditTrailPage from '../../features/school/components/SchoolAuditTrailPage';

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

  if (sectionKey === 'overview') {
    return <OwnerFinance initialTab={5} />;
  }

  if (sectionKey === 'fees') {
    return <FeesManagementBoard initialFinanceTab="fees" />;
  }

  if (sectionKey === 'receipts') {
    return <FeeReceiptsBoard />;
  }

  if (sectionKey === 'expenses') {
    return <OwnerFinance initialTab={4} />;
  }

  if (sectionKey === 'reconciliation') {
    return <FinanceReconciliationBoard />;
  }

  if (sectionKey === 'tuck-shop') {
    return <TuckShopFinanceBoard />;
  }

  if (sectionKey === 'reports') {
    return <OwnerFinance initialTab={5} />;
  }

  if (sectionKey === 'auras') {
    return (
      <SchoolAuditTrailPage
        roleLabel="Accountant Dashboard"
        title="Auras Transaction Oversight"
        subtitle="Use the live audit feed to trace wallet-sensitive actions and transaction-linked platform events without relying on placeholder finance cards."
      />
    );
  }

  if (sectionKey === 'ai-assistant') {
    return <StaffAiAssistantPage roleKey="accountant" roleTitle={accountantConfig.roleTitle} />;
  }

  return <SchoolAuditTrailPage roleLabel={accountantConfig.roleTitle} title={section.title} subtitle={section.subtitle} />;
}
