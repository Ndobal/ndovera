import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import accountantConfig from './config/accountantConfig';
import StaffSettingsPage from './shared/StaffSettingsPage';
import SchoolNewsroomPage from '../../features/school/components/SchoolNewsroomPage';
import PayrollManagementBoard from '../../features/school/components/PayrollManagementBoard';
import StaffAiAssistantPage from '../../features/ai/components/StaffAiAssistantPage';
import OwnerFinance from './owner/OwnerFinance';
import FeesManagementBoard from '../../features/school/components/FeesManagementBoard';
import SchoolAuditTrailPage from '../../features/school/components/SchoolAuditTrailPage';

function AccountantLiveWorkspace({ title, subtitle, children }) {
  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="rounded-3xl p-6 bg-[#f5deb3] dark:bg-slate-900/30 border border-[#c9a96e]/40 dark:border-white/10">
        <h1 className="text-2xl font-bold text-[#800000] dark:text-slate-100">{title}</h1>
        <p className="text-[#191970] dark:text-slate-300 mt-1 text-sm">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

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
    return (
      <AccountantLiveWorkspace
        title="Receipts"
        subtitle="Issue, reprint, and verify receipts from the live fees ledger instead of a placeholder summary card."
      >
        <FeesManagementBoard initialFinanceTab="fees" />
      </AccountantLiveWorkspace>
    );
  }

  if (sectionKey === 'expenses') {
    return <OwnerFinance initialTab={4} />;
  }

  if (sectionKey === 'reconciliation' || sectionKey === 'reports' || sectionKey === 'tuck-shop') {
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
