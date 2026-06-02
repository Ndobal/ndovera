import React from 'react';
import PayrollManagementBoard from '../../../features/school/components/PayrollManagementBoard';

export default function HoSPayroll() {
  // The HoS, like the Owner, reviews submitted payroll and approves it so staff payslips are released.
  return <PayrollManagementBoard canApprove />;
}
