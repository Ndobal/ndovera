import crypto from 'crypto';

import type { User } from '../../../rbac.js';
import { loadIdentityState } from '../../../../../identity-state.js';
import { ensureSqlSchema, executeSql, queryFirstSql, queryRowsSql } from '../../common/runtimeSqlStore.js';
import { getMonetizationSettings } from './monetization.store.js';

type PayrollConfigRow = {
	user_id: string;
	school_id: string;
	staff_name: string;
	role_name: string;
	base_salary_naira: number;
	allowances_naira: number;
	deductions_naira: number;
	payroll_enabled: number | boolean;
	updated_at: string;
};

type PayrollMonthRow = {
	id: string;
	school_id: string;
	month_key: string;
	status: string;
	notes: string | null;
	director_note: string | null;
	director_sheet_json: string | null;
	created_at: string;
	updated_at: string;
	published_at: string | null;
	created_by: string | null;
};

type PayrollSlipRow = {
	id: string;
	payroll_month_id: string;
	school_id: string;
	user_id: string;
	staff_name: string;
	role_name: string;
	base_salary_naira: number;
	allowances_naira: number;
	deductions_naira: number;
	gross_naira: number;
	net_naira: number;
	status: string;
	payment_reference: string | null;
	published_at: string | null;
	metadata_json: string | null;
	created_at: string;
	updated_at: string;
	month_key?: string;
	month_note?: string | null;
	director_note?: string | null;
};

type PayoutProfileRow = {
	school_id: string;
	user_id: string;
	account_name: string;
	bank_name: string;
	account_number: string;
	bvn: string | null;
	nin: string | null;
	kyc_status: string;
	kyc_reference: string | null;
	kyc_checked_at: string | null;
	consent_acknowledged_at: string | null;
	updated_at: string;
};

export type PayrollConfig = {
	userId: string;
	schoolId: string;
	staffName: string;
	roleName: string;
	baseSalaryNaira: number;
	allowancesNaira: number;
	deductionsNaira: number;
	payrollEnabled: boolean;
	updatedAt: string;
};

export type PayrollMonth = {
	id: string;
	schoolId: string;
	monthKey: string;
	status: 'draft' | 'published';
	notes: string | null;
	directorNote: string | null;
	directorSheet: Record<string, unknown> | null;
	createdAt: string;
	updatedAt: string;
	publishedAt: string | null;
	createdBy: string | null;
};

export type PayrollSlip = {
	id: string;
	payrollMonthId: string;
	schoolId: string;
	userId: string;
	staffName: string;
	roleName: string;
	baseSalaryNaira: number;
	allowancesNaira: number;
	deductionsNaira: number;
	grossNaira: number;
	netNaira: number;
	status: 'draft' | 'published' | 'held-kyc';
	paymentReference: string | null;
	publishedAt: string | null;
	metadata: Record<string, unknown> | null;
	createdAt: string;
	updatedAt: string;
	monthKey?: string;
};

export type PayrollPayoutProfile = {
	schoolId: string;
	userId: string;
	accountName: string;
	bankName: string;
	accountNumber: string;
	bvn: string | null;
	nin: string | null;
	kycStatus: 'missing' | 'pending' | 'verified';
	kycReference: string | null;
	kycCheckedAt: string | null;
	consentAcknowledgedAt: string | null;
	updatedAt: string;
};

export type PayrollAdminSnapshot = {
	configs: PayrollConfig[];
	months: PayrollMonth[];
	slips: PayrollSlip[];
	overview: {
		totalNetNaira: number;
		pendingKycCount: number;
		publishedCount: number;
	};
};

export type PayrollHistoryQuery = {
	search?: string;
	monthKey?: string;
	status?: 'draft' | 'published';
};

export type PayrollSlipBreakdown = {
	bonusNaira: number;
	taxNaira: number;
	loanNaira: number;
	note: string | null;
};

export type StaffIncentiveReadiness = {
	eligible: boolean;
	rank: number | null;
	periodKey: string;
	payoutEstimateNaira: number;
	profile: PayrollPayoutProfile | null;
	requiresProfileSubmission: boolean;
	kycRequired: boolean;
};

const SCHEMA_KEY = 'finance-payroll-v2';
const ADMIN_ROLES = new Set(['finance officer', 'accountant', 'bursar', 'school admin', 'hos', 'owner', 'tenant school owner']);
const STAFF_EXCLUDED_CATEGORIES = new Set(['student', 'parent', 'global', 'alumni']);
const TEACHING_ROLES = new Set(['teacher', 'staff', 'educator', 'hos', 'principal', 'head teacher', 'nursery head']);
const SCHEMA_STATEMENTS = [
	`CREATE TABLE IF NOT EXISTS payroll_staff_configs (
		user_id TEXT NOT NULL,
		school_id TEXT NOT NULL,
		staff_name TEXT NOT NULL,
		role_name TEXT NOT NULL,
		base_salary_naira REAL NOT NULL DEFAULT 0,
		allowances_naira REAL NOT NULL DEFAULT 0,
		deductions_naira REAL NOT NULL DEFAULT 0,
		payroll_enabled BOOLEAN NOT NULL DEFAULT TRUE,
		updated_at TEXT NOT NULL,
		PRIMARY KEY (school_id, user_id)
	)`,
	`CREATE TABLE IF NOT EXISTS payroll_payout_profiles (
		school_id TEXT NOT NULL,
		user_id TEXT NOT NULL,
		account_name TEXT NOT NULL,
		bank_name TEXT NOT NULL,
		account_number TEXT NOT NULL,
		bvn TEXT,
		nin TEXT,
		kyc_status TEXT NOT NULL,
		kyc_reference TEXT,
		kyc_checked_at TEXT,
		consent_acknowledged_at TEXT,
		updated_at TEXT NOT NULL,
		PRIMARY KEY (school_id, user_id)
	)`,
	`CREATE TABLE IF NOT EXISTS payroll_months (
		id TEXT PRIMARY KEY,
		school_id TEXT NOT NULL,
		month_key TEXT NOT NULL,
		status TEXT NOT NULL,
		notes TEXT,
		director_note TEXT,
		director_sheet_json TEXT,
		created_at TEXT NOT NULL,
		updated_at TEXT NOT NULL,
		published_at TEXT,
		created_by TEXT,
		UNIQUE (school_id, month_key)
	)`,
	`CREATE TABLE IF NOT EXISTS payroll_slips (
		id TEXT PRIMARY KEY,
		payroll_month_id TEXT NOT NULL,
		school_id TEXT NOT NULL,
		user_id TEXT NOT NULL,
		staff_name TEXT NOT NULL,
		role_name TEXT NOT NULL,
		base_salary_naira REAL NOT NULL DEFAULT 0,
		allowances_naira REAL NOT NULL DEFAULT 0,
		deductions_naira REAL NOT NULL DEFAULT 0,
		gross_naira REAL NOT NULL DEFAULT 0,
		net_naira REAL NOT NULL DEFAULT 0,
		status TEXT NOT NULL,
		payment_reference TEXT,
		published_at TEXT,
		metadata_json TEXT,
		created_at TEXT NOT NULL,
		updated_at TEXT NOT NULL,
		UNIQUE (payroll_month_id, user_id)
	)`
];

function nowIso() {
	return new Date().toISOString();
}

function currentMonthKey() {
	return nowIso().slice(0, 7);
}

function roundMoney(value: number) {
	return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

function schoolIdForUser(user: User) {
	return String(user.school_id || 'school-1').trim() || 'school-1';
}

function roleForUser(user: User) {
	return String(user.activeRole || user.roles?.[0] || 'User').trim();
}

function isPayrollAdmin(user: User) {
	return ADMIN_ROLES.has(roleForUser(user).toLowerCase());
}

function normalizeDigits(value: unknown) {
	return String(value || '').replace(/\D/g, '');
}

function trimOrNull(value: unknown) {
	const next = String(value || '').trim();
	return next ? next : null;
}

function parseJsonObject(value: string | null | undefined) {
	if (!value) return null;
	try {
		const parsed = JSON.parse(value);
		return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : null;
	} catch {
		return null;
	}
}

function getSlipBreakdown(metadata: Record<string, unknown> | null | undefined): PayrollSlipBreakdown {
	const payroll = metadata?.payroll;
	const parsed = payroll && typeof payroll === 'object' ? payroll as Record<string, unknown> : null;
	return {
		bonusNaira: Math.max(0, roundMoney(Number(parsed?.bonusNaira || 0))),
		taxNaira: Math.max(0, roundMoney(Number(parsed?.taxNaira || 0))),
		loanNaira: Math.max(0, roundMoney(Number(parsed?.loanNaira || 0))),
		note: trimOrNull(parsed?.note),
	};
}

function withSlipBreakdownMetadata(metadata: Record<string, unknown> | null | undefined, breakdown: Partial<PayrollSlipBreakdown>) {
	const nextMetadata = { ...(metadata || {}) };
	const existing = getSlipBreakdown(metadata);
	nextMetadata.payroll = {
		bonusNaira: Math.max(0, roundMoney(Number(breakdown.bonusNaira ?? existing.bonusNaira ?? 0))),
		taxNaira: Math.max(0, roundMoney(Number(breakdown.taxNaira ?? existing.taxNaira ?? 0))),
		loanNaira: Math.max(0, roundMoney(Number(breakdown.loanNaira ?? existing.loanNaira ?? 0))),
		note: trimOrNull(breakdown.note ?? existing.note),
	};
	return nextMetadata;
}

function mapConfig(row: PayrollConfigRow): PayrollConfig {
	return {
		userId: row.user_id,
		schoolId: row.school_id,
		staffName: row.staff_name,
		roleName: row.role_name,
		baseSalaryNaira: Number(row.base_salary_naira || 0),
		allowancesNaira: Number(row.allowances_naira || 0),
		deductionsNaira: Number(row.deductions_naira || 0),
		payrollEnabled: Boolean(row.payroll_enabled),
		updatedAt: row.updated_at,
	};
}

function mapMonth(row: PayrollMonthRow): PayrollMonth {
	return {
		id: row.id,
		schoolId: row.school_id,
		monthKey: row.month_key,
		status: row.status === 'published' ? 'published' : 'draft',
		notes: row.notes || null,
		directorNote: row.director_note || null,
		directorSheet: parseJsonObject(row.director_sheet_json),
		createdAt: row.created_at,
		updatedAt: row.updated_at,
		publishedAt: row.published_at || null,
		createdBy: row.created_by || null,
	};
}

function mapSlip(row: PayrollSlipRow): PayrollSlip {
	const baseMetadata = parseJsonObject(row.metadata_json);
	return {
		id: row.id,
		payrollMonthId: row.payroll_month_id,
		schoolId: row.school_id,
		userId: row.user_id,
		staffName: row.staff_name,
		roleName: row.role_name,
		baseSalaryNaira: Number(row.base_salary_naira || 0),
		allowancesNaira: Number(row.allowances_naira || 0),
		deductionsNaira: Number(row.deductions_naira || 0),
		grossNaira: Number(row.gross_naira || 0),
		netNaira: Number(row.net_naira || 0),
		status: row.status === 'published' ? 'published' : row.status === 'held-kyc' ? 'held-kyc' : 'draft',
		paymentReference: row.payment_reference || null,
		publishedAt: row.published_at || null,
		metadata: {
			...(baseMetadata || {}),
			monthNote: row.month_note || null,
			directorNote: row.director_note || null,
		},
		createdAt: row.created_at,
		updatedAt: row.updated_at,
		monthKey: row.month_key,
	};
}

function mapProfile(row: PayoutProfileRow | null): PayrollPayoutProfile | null {
	if (!row) return null;
	return {
		schoolId: row.school_id,
		userId: row.user_id,
		accountName: row.account_name,
		bankName: row.bank_name,
		accountNumber: row.account_number,
		bvn: row.bvn || null,
		nin: row.nin || null,
		kycStatus: row.kyc_status === 'verified' ? 'verified' : row.kyc_status === 'pending' ? 'pending' : 'missing',
		kycReference: row.kyc_reference || null,
		kycCheckedAt: row.kyc_checked_at || null,
		consentAcknowledgedAt: row.consent_acknowledged_at || null,
		updatedAt: row.updated_at,
	};
}

function defaultBaseSalary(roleName: string) {
	const normalized = roleName.trim().toLowerCase();
	if (normalized.includes('principal') || normalized.includes('hos')) return 220000;
	if (normalized.includes('ict')) return 170000;
	if (normalized.includes('account')) return 180000;
	if (normalized.includes('teacher')) return 140000;
	return 120000;
}

async function ensureSchema() {
	await ensureSqlSchema(SCHEMA_KEY, SCHEMA_STATEMENTS);
}

async function getLatestHistoricalBaseSalary(schoolId: string, userId: string) {
	const row = await queryFirstSql<{ base_salary_naira: number }>('SELECT base_salary_naira FROM payroll_slips WHERE school_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 1', [schoolId, userId]);
	return row ? Number(row.base_salary_naira || 0) : 0;
}

async function getSchoolStaff(schoolId: string) {
	const identity = await loadIdentityState();
	return (identity.users || []).filter((entry: any) => {
		if (String(entry.schoolId || '') !== schoolId) return false;
		if (STAFF_EXCLUDED_CATEGORIES.has(String(entry.category || '').toLowerCase())) return false;
		return true;
	});
}

async function ensureStaffConfigsForSchool(schoolId: string) {
	await ensureSchema();
	const staff = await getSchoolStaff(schoolId);
	for (const member of staff) {
		const userId = String(member.id || '').trim();
		if (!userId) continue;
		const existing = await queryFirstSql<{ user_id: string }>('SELECT user_id FROM payroll_staff_configs WHERE school_id = ? AND user_id = ?', [schoolId, userId]);
		if (existing?.user_id) continue;
		const roleName = String(member.activeRole || member.roles?.[0] || 'Staff').trim() || 'Staff';
		const historicalBase = await getLatestHistoricalBaseSalary(schoolId, userId);
		await executeSql('INSERT INTO payroll_staff_configs (user_id, school_id, staff_name, role_name, base_salary_naira, allowances_naira, deductions_naira, payroll_enabled, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [userId, schoolId, String(member.name || 'Staff Member'), roleName, historicalBase > 0 ? historicalBase : defaultBaseSalary(roleName), 0, 0, 1, nowIso()]);
	}
	return staff;
}

async function getPayoutProfile(schoolId: string, userId: string) {
	await ensureSchema();
	const row = await queryFirstSql<PayoutProfileRow>('SELECT school_id, user_id, account_name, bank_name, account_number, bvn, nin, kyc_status, kyc_reference, kyc_checked_at, consent_acknowledged_at, updated_at FROM payroll_payout_profiles WHERE school_id = ? AND user_id = ?', [schoolId, userId]);
	return mapProfile(row);
}

async function getMonthByKey(schoolId: string, monthKey: string) {
	await ensureSchema();
	const row = await queryFirstSql<PayrollMonthRow>('SELECT id, school_id, month_key, status, notes, director_note, director_sheet_json, created_at, updated_at, published_at, created_by FROM payroll_months WHERE school_id = ? AND month_key = ?', [schoolId, monthKey]);
	return row ? mapMonth(row) : null;
}

async function getMonthById(schoolId: string, monthId: string) {
	await ensureSchema();
	const row = await queryFirstSql<PayrollMonthRow>('SELECT id, school_id, month_key, status, notes, director_note, director_sheet_json, created_at, updated_at, published_at, created_by FROM payroll_months WHERE school_id = ? AND id = ?', [schoolId, monthId]);
	return row ? mapMonth(row) : null;
}

async function getSlipById(schoolId: string, slipId: string) {
	await ensureSchema();
	const row = await queryFirstSql<PayrollSlipRow>('SELECT s.id, s.payroll_month_id, s.school_id, s.user_id, s.staff_name, s.role_name, s.base_salary_naira, s.allowances_naira, s.deductions_naira, s.gross_naira, s.net_naira, s.status, s.payment_reference, s.published_at, s.metadata_json, s.created_at, s.updated_at, m.month_key FROM payroll_slips s JOIN payroll_months m ON m.id = s.payroll_month_id WHERE s.school_id = ? AND s.id = ?', [schoolId, slipId]);
	return row ? mapSlip(row) : null;
}

function buildGeneratedNote(monthKey: string, slips: PayrollSlip[]) {
	const totalNet = roundMoney(slips.reduce((sum, slip) => sum + Number(slip.netNaira || 0), 0));
	const totalGross = roundMoney(slips.reduce((sum, slip) => sum + Number(slip.grossNaira || 0), 0));
	const heldCount = slips.filter((slip) => slip.status === 'held-kyc').length;
	return [
		`PAYROLL NOTE - ${monthKey}`,
		'',
		`This payroll covers ${slips.length} staff record${slips.length === 1 ? '' : 's'}.`,
		`Gross payroll: NGN ${totalGross.toLocaleString('en-NG')}`,
		`Net payroll: NGN ${totalNet.toLocaleString('en-NG')}`,
		`Held for KYC: ${heldCount}`,
		'',
		'Reviewed salaries, adjustments, and deductions are reflected in the payroll sheet for this month.',
	].join('\n');
}

function buildDirectorSheet(monthKey: string, slips: PayrollSlip[], profiles: Map<string, PayrollPayoutProfile | null>, note: string | null) {
	return {
		title: `Director Payment Sheet - ${monthKey}`,
		note,
		totalPayableNaira: roundMoney(slips.reduce((sum, slip) => sum + slip.netNaira, 0)),
		totalGrossNaira: roundMoney(slips.reduce((sum, slip) => sum + slip.grossNaira, 0)),
		rows: slips.map((slip, index) => {
			const profile = profiles.get(slip.userId) || null;
			const breakdown = getSlipBreakdown(slip.metadata);
			return {
				serial: index + 1,
				name: slip.staffName,
				role: slip.roleName,
				baseSalaryNaira: slip.baseSalaryNaira,
				bonusNaira: breakdown.bonusNaira,
				allowancesNaira: slip.allowancesNaira,
				grossNaira: slip.grossNaira,
				taxNaira: breakdown.taxNaira,
				loanNaira: breakdown.loanNaira,
				deductionsNaira: slip.deductionsNaira,
				netNaira: slip.netNaira,
				status: slip.status,
				accountName: profile?.accountName || '',
				accountNumber: profile?.accountNumber || '',
				bankName: profile?.bankName || '',
			};
		}),
	};
}

function evaluateKyc(input: { accountName: string; bankName: string; accountNumber: string; bvn?: string | null; nin?: string | null }) {
	const accountNumber = normalizeDigits(input.accountNumber);
	const bvn = normalizeDigits(input.bvn);
	const nin = normalizeDigits(input.nin);
	const verified = Boolean(input.accountName.trim() && input.bankName.trim() && accountNumber.length === 10 && (bvn.length === 11 || nin.length === 11));
	return {
		accountNumber,
		bvn: bvn || null,
		nin: nin || null,
		status: verified ? 'verified' as const : 'pending' as const,
		reference: verified ? `kyc_${crypto.randomUUID()}` : null,
	};
}

export async function getPayrollOverview(user: User) {
	const schoolId = schoolIdForUser(user);
	await ensureStaffConfigsForSchool(schoolId);
	const rows = await queryRowsSql<{ net_naira: number; status: string }>('SELECT net_naira, status FROM payroll_slips WHERE school_id = ?', [schoolId]);
	return {
		total: roundMoney(rows.filter((row) => row.status === 'published').reduce((sum, row) => sum + Number(row.net_naira || 0), 0)),
		pending: roundMoney(rows.filter((row) => row.status !== 'published').reduce((sum, row) => sum + Number(row.net_naira || 0), 0)),
		publishedCount: rows.filter((row) => row.status === 'published').length,
		pendingKycCount: rows.filter((row) => row.status === 'held-kyc').length,
	};
}

export async function listPayrollAdminSnapshot(user: User): Promise<PayrollAdminSnapshot> {
	if (!isPayrollAdmin(user)) throw new Error('Forbidden');
	const schoolId = schoolIdForUser(user);
	await ensureStaffConfigsForSchool(schoolId);
	const configs = await queryRowsSql<PayrollConfigRow>('SELECT user_id, school_id, staff_name, role_name, base_salary_naira, allowances_naira, deductions_naira, payroll_enabled, updated_at FROM payroll_staff_configs WHERE school_id = ? ORDER BY staff_name ASC', [schoolId]);
	const months = await queryRowsSql<PayrollMonthRow>('SELECT id, school_id, month_key, status, notes, director_note, director_sheet_json, created_at, updated_at, published_at, created_by FROM payroll_months WHERE school_id = ? ORDER BY month_key DESC', [schoolId]);
	const slips = await queryRowsSql<PayrollSlipRow>('SELECT s.id, s.payroll_month_id, s.school_id, s.user_id, s.staff_name, s.role_name, s.base_salary_naira, s.allowances_naira, s.deductions_naira, s.gross_naira, s.net_naira, s.status, s.payment_reference, s.published_at, s.metadata_json, s.created_at, s.updated_at, m.month_key FROM payroll_slips s JOIN payroll_months m ON m.id = s.payroll_month_id WHERE s.school_id = ? ORDER BY m.month_key DESC, s.staff_name ASC', [schoolId]);
	const overview = await getPayrollOverview(user);
	return {
		configs: configs.map(mapConfig),
		months: months.map(mapMonth),
		slips: slips.map(mapSlip),
		overview: {
			totalNetNaira: overview.total,
			pendingKycCount: overview.pendingKycCount,
			publishedCount: overview.publishedCount,
		},
	};
}

export async function upsertPayrollConfig(user: User, input: { userId: string; baseSalaryNaira: number; allowancesNaira?: number; deductionsNaira?: number; payrollEnabled?: boolean }) {
	if (!isPayrollAdmin(user)) throw new Error('Forbidden');
	const schoolId = schoolIdForUser(user);
	await ensureStaffConfigsForSchool(schoolId);
	const existing = await queryFirstSql<PayrollConfigRow>('SELECT user_id, school_id, staff_name, role_name, base_salary_naira, allowances_naira, deductions_naira, payroll_enabled, updated_at FROM payroll_staff_configs WHERE school_id = ? AND user_id = ?', [schoolId, input.userId]);
	if (!existing) throw new Error('Staff payroll config not found.');
	await executeSql('UPDATE payroll_staff_configs SET base_salary_naira = ?, allowances_naira = ?, deductions_naira = ?, payroll_enabled = ?, updated_at = ? WHERE school_id = ? AND user_id = ?', [Math.max(0, roundMoney(Number(input.baseSalaryNaira || 0))), Math.max(0, roundMoney(Number(input.allowancesNaira ?? existing.allowances_naira ?? 0))), Math.max(0, roundMoney(Number(input.deductionsNaira ?? existing.deductions_naira ?? 0))), input.payrollEnabled ?? Boolean(existing.payroll_enabled) ? 1 : 0, nowIso(), schoolId, input.userId]);
	const updated = await queryFirstSql<PayrollConfigRow>('SELECT user_id, school_id, staff_name, role_name, base_salary_naira, allowances_naira, deductions_naira, payroll_enabled, updated_at FROM payroll_staff_configs WHERE school_id = ? AND user_id = ?', [schoolId, input.userId]);
	if (!updated) throw new Error('Payroll config update failed.');
	return mapConfig(updated);
}

export async function updatePayrollSlip(user: User, input: { slipId: string; baseSalaryNaira: number; bonusNaira?: number; allowancesNaira?: number; taxNaira?: number; loanNaira?: number; deductionsNaira?: number; note?: string | null }) {
	if (!isPayrollAdmin(user)) throw new Error('Forbidden');
	const schoolId = schoolIdForUser(user);
	const slip = await getSlipById(schoolId, input.slipId);
	if (!slip) throw new Error('Payroll slip not found.');
	const month = await getMonthById(schoolId, slip.payrollMonthId);
	if (!month) throw new Error('Payroll month not found.');
	if (month.status === 'published') throw new Error('Published payroll months are locked.');
	const metadata = withSlipBreakdownMetadata(slip.metadata, {
		bonusNaira: input.bonusNaira,
		taxNaira: input.taxNaira,
		loanNaira: input.loanNaira,
		note: input.note,
	});
	const breakdown = getSlipBreakdown(metadata);
	const baseSalaryNaira = Math.max(0, roundMoney(Number(input.baseSalaryNaira || 0)));
	const allowancesNaira = Math.max(0, roundMoney(Number(input.allowancesNaira ?? slip.allowancesNaira ?? 0)));
	const deductionsNaira = Math.max(0, roundMoney(Number(input.deductionsNaira ?? slip.deductionsNaira ?? 0)));
	const grossNaira = roundMoney(baseSalaryNaira + allowancesNaira + breakdown.bonusNaira);
	const totalDeductions = roundMoney(deductionsNaira + breakdown.taxNaira + breakdown.loanNaira);
	const netNaira = Math.max(0, roundMoney(grossNaira - totalDeductions));
	await executeSql('UPDATE payroll_slips SET base_salary_naira = ?, allowances_naira = ?, deductions_naira = ?, gross_naira = ?, net_naira = ?, metadata_json = ?, updated_at = ? WHERE id = ? AND school_id = ?', [baseSalaryNaira, allowancesNaira, deductionsNaira, grossNaira, netNaira, JSON.stringify(metadata), nowIso(), slip.id, schoolId]);
	const updated = await getSlipById(schoolId, slip.id);
	if (!updated) throw new Error('Payroll slip update failed.');
	return updated;
}

export async function savePayrollMonthNote(user: User, input: { monthId: string; notes?: string | null; directorNote?: string | null; generateDefault?: boolean }) {
	if (!isPayrollAdmin(user)) throw new Error('Forbidden');
	const schoolId = schoolIdForUser(user);
	const month = await getMonthById(schoolId, input.monthId);
	if (!month) throw new Error('Payroll month not found.');
	if (month.status === 'published') throw new Error('Published payroll months are locked.');
	const slipRows = await queryRowsSql<PayrollSlipRow>('SELECT s.id, s.payroll_month_id, s.school_id, s.user_id, s.staff_name, s.role_name, s.base_salary_naira, s.allowances_naira, s.deductions_naira, s.gross_naira, s.net_naira, s.status, s.payment_reference, s.published_at, s.metadata_json, s.created_at, s.updated_at, m.month_key FROM payroll_slips s JOIN payroll_months m ON m.id = s.payroll_month_id WHERE s.payroll_month_id = ? ORDER BY s.staff_name ASC', [month.id]);
	const slips = slipRows.map(mapSlip);
	const generated = input.generateDefault ? buildGeneratedNote(month.monthKey, slips) : null;
	const nextNotes = trimOrNull(input.notes) || generated;
	const nextDirectorNote = trimOrNull(input.directorNote) || nextNotes;
	await executeSql('UPDATE payroll_months SET notes = ?, director_note = ?, updated_at = ? WHERE id = ? AND school_id = ?', [nextNotes, nextDirectorNote, nowIso(), month.id, schoolId]);
	return listPayrollAdminSnapshot(user);
}

export async function generatePayrollDirectorSheet(user: User, monthId: string) {
	if (!isPayrollAdmin(user)) throw new Error('Forbidden');
	const schoolId = schoolIdForUser(user);
	const month = await getMonthById(schoolId, monthId);
	if (!month) throw new Error('Payroll month not found.');
	const slipRows = await queryRowsSql<PayrollSlipRow>('SELECT s.id, s.payroll_month_id, s.school_id, s.user_id, s.staff_name, s.role_name, s.base_salary_naira, s.allowances_naira, s.deductions_naira, s.gross_naira, s.net_naira, s.status, s.payment_reference, s.published_at, s.metadata_json, s.created_at, s.updated_at, m.month_key FROM payroll_slips s JOIN payroll_months m ON m.id = s.payroll_month_id WHERE s.payroll_month_id = ? ORDER BY s.staff_name ASC', [month.id]);
	const slips = slipRows.map(mapSlip);
	const profiles = new Map<string, PayrollPayoutProfile | null>();
	for (const slip of slips) {
		profiles.set(slip.userId, await getPayoutProfile(schoolId, slip.userId));
	}
	const directorSheet = buildDirectorSheet(month.monthKey, slips, profiles, month.directorNote || month.notes || buildGeneratedNote(month.monthKey, slips));
	await executeSql('UPDATE payroll_months SET director_sheet_json = ?, updated_at = ? WHERE id = ? AND school_id = ?', [JSON.stringify(directorSheet), nowIso(), month.id, schoolId]);
	return listPayrollAdminSnapshot(user);
}

export async function listPayrollHistory(user: User, query?: PayrollHistoryQuery) {
	if (!isPayrollAdmin(user)) throw new Error('Forbidden');
	const snapshot = await listPayrollAdminSnapshot(user);
	const search = String(query?.search || '').trim().toLowerCase();
	const monthKey = String(query?.monthKey || '').trim();
	const status = query?.status;
	const months = snapshot.months.filter((month) => {
		if (monthKey && month.monthKey !== monthKey) return false;
		if (status && month.status !== status) return false;
		if (!search) return true;
		return [month.monthKey, month.notes || '', month.directorNote || ''].some((value) => value.toLowerCase().includes(search));
	});
	const monthIds = new Set(months.map((month) => month.id));
	const slips = snapshot.slips.filter((slip) => {
		if (!monthIds.has(slip.payrollMonthId)) return false;
		if (!search) return true;
		const breakdown = getSlipBreakdown(slip.metadata);
		return [slip.staffName, slip.roleName, slip.monthKey || '', breakdown.note || ''].some((value) => value.toLowerCase().includes(search));
	});
	return {
		...snapshot,
		months,
		slips,
	};
}

export async function preparePayrollMonth(user: User, input?: { monthKey?: string; notes?: string | null }) {
	if (!isPayrollAdmin(user)) throw new Error('Forbidden');
	const schoolId = schoolIdForUser(user);
	const monthKey = String(input?.monthKey || currentMonthKey()).trim() || currentMonthKey();
	await ensureStaffConfigsForSchool(schoolId);
	let month = await getMonthByKey(schoolId, monthKey);
	const createdAt = nowIso();
	if (!month) {
		await executeSql('INSERT INTO payroll_months (id, school_id, month_key, status, notes, director_note, director_sheet_json, created_at, updated_at, published_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [`payroll_month_${crypto.randomUUID()}`, schoolId, monthKey, 'draft', trimOrNull(input?.notes), null, null, createdAt, createdAt, null, String(user.id || '').trim() || null]);
		month = await getMonthByKey(schoolId, monthKey);
	}
	if (!month) throw new Error('Unable to prepare payroll month.');
	const configs = await queryRowsSql<PayrollConfigRow>('SELECT user_id, school_id, staff_name, role_name, base_salary_naira, allowances_naira, deductions_naira, payroll_enabled, updated_at FROM payroll_staff_configs WHERE school_id = ? AND payroll_enabled = ?', [schoolId, 1]);
	for (const config of configs) {
		const existingSlip = await queryFirstSql<PayrollSlipRow>('SELECT id, payroll_month_id, school_id, user_id, staff_name, role_name, base_salary_naira, allowances_naira, deductions_naira, gross_naira, net_naira, status, payment_reference, published_at, metadata_json, created_at, updated_at FROM payroll_slips WHERE payroll_month_id = ? AND user_id = ?', [month.id, config.user_id]);
		const metadata = withSlipBreakdownMetadata(parseJsonObject(existingSlip?.metadata_json), {});
		const breakdown = getSlipBreakdown(metadata);
		const gross = roundMoney(Number(config.base_salary_naira || 0) + Number(config.allowances_naira || 0) + breakdown.bonusNaira);
		const totalDeductions = roundMoney(Number(config.deductions_naira || 0) + breakdown.taxNaira + breakdown.loanNaira);
		const net = Math.max(0, roundMoney(gross - totalDeductions));
		await executeSql('INSERT INTO payroll_slips (id, payroll_month_id, school_id, user_id, staff_name, role_name, base_salary_naira, allowances_naira, deductions_naira, gross_naira, net_naira, status, payment_reference, published_at, metadata_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(payroll_month_id, user_id) DO UPDATE SET staff_name = excluded.staff_name, role_name = excluded.role_name, base_salary_naira = excluded.base_salary_naira, allowances_naira = excluded.allowances_naira, deductions_naira = excluded.deductions_naira, gross_naira = excluded.gross_naira, net_naira = excluded.net_naira, status = excluded.status, updated_at = excluded.updated_at, metadata_json = excluded.metadata_json', [`payroll_slip_${crypto.randomUUID()}`, month.id, schoolId, config.user_id, config.staff_name, config.role_name, Number(config.base_salary_naira || 0), Number(config.allowances_naira || 0), Number(config.deductions_naira || 0), gross, net, 'draft', null, null, JSON.stringify({ ...metadata, monthKey, generatedFromConfig: true }), createdAt, createdAt]);
	}
	return listPayrollAdminSnapshot(user);
}

export async function publishPayrollMonth(user: User, monthId: string) {
	if (!isPayrollAdmin(user)) throw new Error('Forbidden');
	const schoolId = schoolIdForUser(user);
	const month = await getMonthById(schoolId, monthId);
	if (!month) throw new Error('Payroll month not found.');
	const slipRows = await queryRowsSql<PayrollSlipRow>('SELECT id, payroll_month_id, school_id, user_id, staff_name, role_name, base_salary_naira, allowances_naira, deductions_naira, gross_naira, net_naira, status, payment_reference, published_at, metadata_json, created_at, updated_at FROM payroll_slips WHERE payroll_month_id = ? ORDER BY staff_name ASC', [monthId]);
	const profiles = new Map<string, PayrollPayoutProfile | null>();
	for (const slip of slipRows) {
		profiles.set(slip.user_id, await getPayoutProfile(schoolId, slip.user_id));
	}
	const publishedAt = nowIso();
	for (const slip of slipRows) {
		const profile = profiles.get(slip.user_id) || null;
		const nextStatus = profile?.kycStatus === 'verified' ? 'published' : 'held-kyc';
		await executeSql('UPDATE payroll_slips SET status = ?, published_at = ?, updated_at = ? WHERE id = ?', [nextStatus, nextStatus === 'published' ? publishedAt : null, nowIso(), slip.id]);
	}
	const mappedSlips = slipRows.map((row) => mapSlip({ ...row, month_key: month.monthKey }));
	const directorNote = month.directorNote || month.notes || buildGeneratedNote(month.monthKey, mappedSlips);
	const directorSheet = buildDirectorSheet(month.monthKey, mappedSlips, profiles, directorNote);
	await executeSql('UPDATE payroll_months SET status = ?, published_at = ?, updated_at = ?, director_note = ?, director_sheet_json = ? WHERE id = ?', ['published', publishedAt, nowIso(), directorNote, JSON.stringify(directorSheet), monthId]);
	return listPayrollAdminSnapshot(user);
}

export async function getPayrollSelfService(user: User) {
	const schoolId = schoolIdForUser(user);
	await ensureSchema();
	await ensureStaffConfigsForSchool(schoolId);
	const profile = await getPayoutProfile(schoolId, String(user.id || '').trim());
	const slips = await queryRowsSql<PayrollSlipRow>('SELECT s.id, s.payroll_month_id, s.school_id, s.user_id, s.staff_name, s.role_name, s.base_salary_naira, s.allowances_naira, s.deductions_naira, s.gross_naira, s.net_naira, s.status, s.payment_reference, s.published_at, s.metadata_json, s.created_at, s.updated_at, m.month_key, m.notes AS month_note, m.director_note FROM payroll_slips s JOIN payroll_months m ON m.id = s.payroll_month_id WHERE s.school_id = ? AND s.user_id = ? ORDER BY m.month_key DESC', [schoolId, String(user.id || '').trim()]);
	return {
		profile,
		slips: slips.map(mapSlip),
	};
}

export async function savePayrollPayoutProfile(user: User, input: { accountName: string; bankName: string; accountNumber: string; bvn?: string | null; nin?: string | null; consentAcknowledged?: boolean }) {
	const schoolId = schoolIdForUser(user);
	await ensureSchema();
	const kyc = evaluateKyc(input);
	const updatedAt = nowIso();
	await executeSql('INSERT INTO payroll_payout_profiles (school_id, user_id, account_name, bank_name, account_number, bvn, nin, kyc_status, kyc_reference, kyc_checked_at, consent_acknowledged_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(school_id, user_id) DO UPDATE SET account_name = excluded.account_name, bank_name = excluded.bank_name, account_number = excluded.account_number, bvn = excluded.bvn, nin = excluded.nin, kyc_status = excluded.kyc_status, kyc_reference = excluded.kyc_reference, kyc_checked_at = excluded.kyc_checked_at, consent_acknowledged_at = CASE WHEN excluded.consent_acknowledged_at IS NOT NULL THEN excluded.consent_acknowledged_at ELSE payroll_payout_profiles.consent_acknowledged_at END, updated_at = excluded.updated_at', [schoolId, String(user.id || '').trim(), String(input.accountName || '').trim(), String(input.bankName || '').trim(), kyc.accountNumber, kyc.bvn, kyc.nin, kyc.status, kyc.reference, updatedAt, input.consentAcknowledged ? updatedAt : null, updatedAt]);
	const profile = await getPayoutProfile(schoolId, String(user.id || '').trim());
	if (!profile) throw new Error('Unable to save payout profile.');
	return profile;
}

export async function getStaffIncentiveReadiness(user: User): Promise<StaffIncentiveReadiness | null> {
	const role = roleForUser(user).toLowerCase();
	if (!TEACHING_ROLES.has(role)) return null;
	const settings = await getMonetizationSettings();
	if (!settings.focusMode.programEnabled) return null;
	const periodKey = currentMonthKey();
	const rows = await queryRowsSql<{ user_id: string; payout_total_naira: number; eligibility_status: string }>('SELECT user_id, payout_total_naira, eligibility_status FROM focus_mode_period_summaries WHERE period_type = ? AND period_key = ? ORDER BY payout_total_naira DESC, active_seconds DESC', ['monthly', periodKey]);
	const rank = rows.findIndex((row) => row.user_id === String(user.id || '').trim()) + 1;
	const entry = rank > 0 ? rows[rank - 1] : null;
	if (!entry || entry.eligibility_status !== 'eligible') return null;
	const profile = await getPayoutProfile(schoolIdForUser(user), String(user.id || '').trim());
	return {
		eligible: true,
		rank,
		periodKey,
		payoutEstimateNaira: roundMoney(Number(entry.payout_total_naira || settings.focusMode.monthlyBaseIncentiveNaira || 0)),
		profile,
		requiresProfileSubmission: !profile || !profile.accountNumber || !profile.consentAcknowledgedAt,
		kycRequired: !profile || profile.kycStatus !== 'verified',
	};
}