import { loadIdentityState, provisionUser } from '../identity-state.ts';
import { generatePayrollDirectorSheet, getPayrollSelfService, preparePayrollMonth, publishPayrollMonth, savePayrollMonthNote, savePayrollPayoutProfile, updatePayrollSlip } from '../packages/server/src/modules/finance/payroll.store.ts';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

type SessionUser = {
  id: string;
  name: string;
  email?: string;
  school_id: string;
  school_name: string;
  roles: string[];
  activeRole: string;
};

const schoolId = 'school-1';
const schoolName = 'Ndovera Academy';
const monthKey = '2026-03';
const financeEmail = 'finance-officer@ndovera.local';
const staffEmail = 'teacher-one@ndovera.local';
const password = 'Pass123456!';
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const outputPath = path.join(scriptDir, 'verify-payroll-e2e-output.json');

function asSessionUser(user: {
  id: string;
  name: string;
  email?: string | null;
  schoolId: string;
  schoolName: string;
  roles: string[];
  activeRole: string;
}): SessionUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email || undefined,
    school_id: user.schoolId,
    school_name: user.schoolName,
    roles: user.roles,
    activeRole: user.activeRole,
  };
}

async function ensureUsers() {
  const state = await loadIdentityState();
  let financeUser = state.users.find((user) => user.email?.toLowerCase() === financeEmail);
  if (!financeUser) {
    financeUser = (await provisionUser(state, {
      category: 'admin',
      schoolId,
      schoolName,
      name: 'Finance Officer Demo',
      email: financeEmail,
      password,
      roles: ['Finance Officer'],
    })).user;
  }

  const refreshedState = await loadIdentityState();
  let staffUser = refreshedState.users.find((user) => user.email?.toLowerCase() === staffEmail);
  if (!staffUser) {
    staffUser = (await provisionUser(refreshedState, {
      category: 'staff',
      schoolId,
      schoolName,
      name: 'Teacher One Demo',
      email: staffEmail,
      password,
      roles: ['Teacher'],
    })).user;
  }

  return {
    financeUser: asSessionUser(financeUser),
    staffUser: asSessionUser(staffUser),
  };
}

try {
  const { financeUser, staffUser } = await ensureUsers();

  const prepared = await preparePayrollMonth(financeUser, { monthKey });
  const staffSlip = prepared.slips.find((slip) => slip.monthKey === monthKey && slip.userId === staffUser.id);
  if (!staffSlip) {
    throw new Error(`No payroll slip created for ${staffUser.id} in ${monthKey}.`);
  }

  const updatedSlip = await updatePayrollSlip(financeUser, {
    slipId: staffSlip.id,
    baseSalaryNaira: 185000,
    bonusNaira: 12000,
    allowancesNaira: 15000,
    taxNaira: 8000,
    loanNaira: 5000,
    deductionsNaira: 3000,
    note: 'Verified end-to-end payroll check row.',
  });

  const noted = await savePayrollMonthNote(financeUser, {
    monthId: staffSlip.payrollMonthId,
    notes: 'March payroll note generated during automated end-to-end verification.',
    directorNote: 'Director sheet reviewed for automated payroll verification.',
  });

  await savePayrollPayoutProfile(staffUser, {
    accountName: staffUser.name,
    bankName: 'Access Bank',
    accountNumber: '0123456789',
    bvn: '12345678901',
    consentAcknowledged: true,
  });

  const directorSnapshot = await generatePayrollDirectorSheet(financeUser, staffSlip.payrollMonthId);
  const published = await publishPayrollMonth(financeUser, staffSlip.payrollMonthId);
  const selfService = await getPayrollSelfService(staffUser);
  const publishedSlip = selfService.slips.find((slip) => slip.id === staffSlip.id) || selfService.slips[0] || null;
  const directorMonth = directorSnapshot.months.find((month) => month.id === staffSlip.payrollMonthId) || null;
  const notedMonth = noted.months.find((month) => month.id === staffSlip.payrollMonthId) || null;

  fs.writeFileSync(outputPath, JSON.stringify({
    ok: true,
    seededUsers: {
      finance: { id: financeUser.id, email: financeUser.email, role: financeUser.activeRole },
      staff: { id: staffUser.id, email: staffUser.email, role: staffUser.activeRole },
    },
    preparedMonth: monthKey,
    updatedSlip: {
      id: updatedSlip.id,
      grossNaira: updatedSlip.grossNaira,
      netNaira: updatedSlip.netNaira,
      status: updatedSlip.status,
      metadata: updatedSlip.metadata,
    },
    noteSaved: {
      notes: notedMonth?.notes || null,
      directorNote: notedMonth?.directorNote || null,
    },
    directorSheet: {
      available: Boolean(directorMonth?.directorSheet),
      rowCount: Array.isArray((directorMonth?.directorSheet as any)?.rows) ? (directorMonth?.directorSheet as any).rows.length : 0,
    },
    publishResult: {
      monthStatus: published.months.find((month) => month.id === staffSlip.payrollMonthId)?.status || null,
      publishedCount: published.overview.publishedCount,
      pendingKycCount: published.overview.pendingKycCount,
    },
    selfService: {
      slipCount: selfService.slips.length,
      selectedSlip: publishedSlip ? {
        id: publishedSlip.id,
        monthKey: publishedSlip.monthKey,
        status: publishedSlip.status,
        grossNaira: publishedSlip.grossNaira,
        netNaira: publishedSlip.netNaira,
        monthNote: publishedSlip.metadata?.monthNote || null,
        directorNote: publishedSlip.metadata?.directorNote || null,
      } : null,
      kycStatus: selfService.profile?.kycStatus || null,
    },
  }, null, 2));
  console.log(`Wrote verification result to ${outputPath}`);
} catch (error) {
  fs.writeFileSync(outputPath, JSON.stringify({
    ok: false,
    error: error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack,
    } : String(error),
  }, null, 2));
  console.error(error);
  process.exitCode = 1;
}
