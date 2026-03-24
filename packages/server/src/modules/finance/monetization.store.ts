import crypto from 'crypto';

import type { User } from '../../../rbac.js';
import { ensureSqlSchema, executeSql, queryFirstSql, queryRowsSql } from '../../common/runtimeSqlStore.js';

export type SchoolPricingTier = {
	key: string;
	label: string;
	minStudents: number;
	maxStudents: number | null;
	oneTimeSetupNaira: number;
	perStudentPerTermNaira: number;
	oneTimeSetupDiscountNaira?: number;
	perStudentPerTermDiscountNaira?: number;
};

export type DiscountCodeScope = 'school-onboarding' | 'marketplace' | 'all';

export type DiscountCode = {
	id: string;
	code: string;
	description: string;
	percentageOff: number;
	scope: DiscountCodeScope;
	active: boolean;
	validFrom: string | null;
	expiresAt: string | null;
	maxUses: number | null;
	usedCount: number;
	discontinuedAt: string | null;
	createdAt: string;
	updatedAt: string;
};

export type MarketplaceBundleCategory = 'ai-credits' | 'keyu' | 'tutor-subscription';

export type MarketplaceBundle = {
	id: string;
	label: string;
	description: string;
	category: MarketplaceBundleCategory;
	nairaAmount: number;
	originalNairaAmount: number | null;
	aiCredits: number;
	keyuAmount: number;
	active: boolean;
	featured: boolean;
	createdAt: string;
	updatedAt: string;
};

export type PriceIncreaseNoticeScope = 'school-signup' | 'termly-billing' | 'ai-credits';

export type PriceIncreaseNotice = {
	id: string;
	scope: PriceIncreaseNoticeScope;
	title: string;
	message: string;
	currentAmountNaira: number;
	newAmountNaira: number;
	effectiveAt: string;
	active: boolean;
	createdAt: string;
	updatedAt: string;
};

export type DashboardPriceIncreaseNotice = PriceIncreaseNotice & {
	agreed: boolean;
	dismissedToday: boolean;
	showToday: boolean;
};

export type MonetizationSettings = {
	schoolPricing: {
		currencyCode: string;
		academicTermsPerYear: number;
		tiers: SchoolPricingTier[];
	};
	aiEconomy: {
		freeQueriesEveryDays: number;
		freeQueriesPerWindow: number;
		keyuPerAiCredit: number;
		packages: Array<{ id: string; label: string; nairaAmount: number; aiCredits: number }>;
	};
	adRevenue: {
		systemRevenuePerSuccessfulImpressionNaira: number;
		hiddenTeacherIncentivePerSuccessfulImpressionNaira: number;
		hiddenTeacherIncentiveEnabled: boolean;
		systemAdRevenueEnabled: boolean;
		networkName: string;
	};
	focusMode: {
		userVisibleLabel: string;
		minimumMonthlyActiveRatio: number;
		targetMonthlyWorkingHours: number;
		minimumQuarterlyTeachingSessions: number;
		monthlyBaseIncentiveNaira: number;
		quarterlyBaseIncentiveNaira: number;
		quarterlyBonusMinNaira: number;
		quarterlyBonusMaxNaira: number;
		programEnabled: boolean;
	};
	marketplace: {
		keyuPerNaira: number;
		bundles: MarketplaceBundle[];
		discountCodes: DiscountCode[];
		tutorBilling: {
			trialDays: number;
			monthlyFeeNaira: number;
			includedStudents: number;
			extraStudentFeeNaira: number;
			requireUpfrontAfterTrial: boolean;
		};
	};
	priceIncreaseNotices: PriceIncreaseNotice[];
};

export type FocusModeSessionRecord = {
	id: string;
	schoolId: string;
	userId: string;
	roleName: string;
	sourcePage: string;
	startedAt: string;
	lastActivityAt: string;
	endedAt: string | null;
	status: string;
	activeSeconds: number;
	idleSeconds: number;
};

export type FocusModeStatus = {
	activeSession: FocusModeSessionRecord | null;
	monthToDate: {
		periodKey: string;
		activeSeconds: number;
		teachingSessionsCount: number;
		lessonsMonitoredCount: number;
		assessmentsCheckedCount: number;
		eligibilityProgressRatio: number;
	};
};

export type MonetizationOverview = {
	periodType: 'monthly' | 'quarterly';
	periodKey: string;
	systemRevenueNaira: number;
	hiddenTeacherIncentiveNaira: number;
	successfulImpressions: number;
	focusEligibleStaff: number;
	staffOnHold: number;
	schoolBreakdown: Array<{
		schoolId: string;
		systemRevenueNaira: number;
		hiddenTeacherIncentiveNaira: number;
		successfulImpressions: number;
		focusEligibleStaff: number;
	}>;
	teacherSummaries: Array<{
		schoolId: string;
		userId: string;
		activeSeconds: number;
		teachingSessionsCount: number;
		payoutTotalNaira: number;
		hiddenAdIncentiveNaira: number;
		eligibilityStatus: string;
	}>;
};

type MonetizationUserControl = {
	schoolId: string;
	userId: string;
	hiddenAdIncentiveEnabled: boolean;
	focusModePayoutEnabled: boolean;
	holdReason: string | null;
	updatedAt: string;
	updatedBy: string | null;
};

type PeriodSummaryRow = {
	id: string;
	school_id: string;
	user_id: string;
	role_name: string;
	period_type: string;
	period_key: string;
	active_seconds: number;
	teaching_sessions_count: number;
	lessons_monitored_count: number;
	assessments_checked_count: number;
	hidden_ad_incentive_naira: number;
	payout_base_naira: number;
	payout_bonus_naira: number;
	payout_total_naira: number;
	eligibility_status: string;
};

const SCHEMA_KEY = 'monetization-foundations-v1';
const ACTIVE_GAP_SECONDS = 15 * 60;
const TEACHING_ROLES = new Set(['teacher', 'staff', 'educator', 'hos', 'school admin', 'principal', 'head teacher', 'nursery head']);
const SCHEMA_STATEMENTS = [
	`CREATE TABLE IF NOT EXISTS monetization_settings (
		scope_key TEXT PRIMARY KEY,
		settings_json TEXT NOT NULL,
		updated_at TEXT NOT NULL,
		updated_by TEXT
	)`,
	`CREATE TABLE IF NOT EXISTS monetization_user_controls (
		school_id TEXT NOT NULL,
		user_id TEXT NOT NULL,
		hidden_ad_incentive_enabled BOOLEAN NOT NULL DEFAULT TRUE,
		focus_mode_payout_enabled BOOLEAN NOT NULL DEFAULT TRUE,
		hold_reason TEXT,
		updated_at TEXT NOT NULL,
		updated_by TEXT,
		PRIMARY KEY (school_id, user_id)
	)`,
	`CREATE TABLE IF NOT EXISTS monetization_notice_acknowledgements (
		school_id TEXT NOT NULL,
		user_id TEXT NOT NULL,
		notice_id TEXT NOT NULL,
		dismissed_on TEXT,
		agreed_at TEXT,
		updated_at TEXT NOT NULL,
		PRIMARY KEY (school_id, user_id, notice_id)
	)`,
	`CREATE TABLE IF NOT EXISTS school_term_snapshots (
		id TEXT PRIMARY KEY,
		school_id TEXT NOT NULL,
		academic_year TEXT NOT NULL,
		term_key TEXT NOT NULL,
		student_count INTEGER NOT NULL,
		billing_tier_key TEXT NOT NULL,
		captured_at TEXT NOT NULL,
		captured_by TEXT
	)`,
	`CREATE TABLE IF NOT EXISTS school_invoices (
		id TEXT PRIMARY KEY,
		school_id TEXT NOT NULL,
		invoice_type TEXT NOT NULL,
		academic_year TEXT,
		term_key TEXT,
		status TEXT NOT NULL,
		currency_code TEXT NOT NULL,
		subtotal_naira REAL NOT NULL DEFAULT 0,
		total_naira REAL NOT NULL DEFAULT 0,
		paid_naira REAL NOT NULL DEFAULT 0,
		balance_naira REAL NOT NULL DEFAULT 0,
		metadata_json TEXT,
		created_at TEXT NOT NULL,
		updated_at TEXT NOT NULL,
		due_at TEXT
	)`,
	`CREATE TABLE IF NOT EXISTS school_invoice_items (
		id TEXT PRIMARY KEY,
		invoice_id TEXT NOT NULL,
		item_type TEXT NOT NULL,
		label TEXT NOT NULL,
		quantity REAL NOT NULL DEFAULT 1,
		unit_amount_naira REAL NOT NULL DEFAULT 0,
		total_amount_naira REAL NOT NULL DEFAULT 0,
		metadata_json TEXT
	)`,
	`CREATE TABLE IF NOT EXISTS ad_impression_events (
		id TEXT PRIMARY KEY,
		school_id TEXT NOT NULL,
		user_id TEXT NOT NULL,
		role_name TEXT NOT NULL,
		focus_session_id TEXT,
		page_key TEXT NOT NULL,
		placement_key TEXT NOT NULL,
		network_name TEXT NOT NULL,
		impression_status TEXT NOT NULL,
		system_revenue_naira REAL NOT NULL DEFAULT 0,
		hidden_teacher_incentive_naira REAL NOT NULL DEFAULT 0,
		created_at TEXT NOT NULL,
		metadata_json TEXT
	)`,
	`CREATE TABLE IF NOT EXISTS focus_mode_sessions (
		id TEXT PRIMARY KEY,
		school_id TEXT NOT NULL,
		user_id TEXT NOT NULL,
		role_name TEXT NOT NULL,
		source_page TEXT NOT NULL,
		started_at TEXT NOT NULL,
		last_activity_at TEXT NOT NULL,
		ended_at TEXT,
		status TEXT NOT NULL,
		active_seconds INTEGER NOT NULL DEFAULT 0,
		idle_seconds INTEGER NOT NULL DEFAULT 0
	)`,
	`CREATE TABLE IF NOT EXISTS focus_mode_activity_events (
		id TEXT PRIMARY KEY,
		school_id TEXT NOT NULL,
		user_id TEXT NOT NULL,
		session_id TEXT NOT NULL,
		event_type TEXT NOT NULL,
		source_page TEXT,
		lesson_id TEXT,
		assessment_id TEXT,
		student_id TEXT,
		created_at TEXT NOT NULL,
		metadata_json TEXT
	)`,
	`CREATE TABLE IF NOT EXISTS focus_mode_period_summaries (
		id TEXT PRIMARY KEY,
		school_id TEXT NOT NULL,
		user_id TEXT NOT NULL,
		role_name TEXT NOT NULL,
		period_type TEXT NOT NULL,
		period_key TEXT NOT NULL,
		active_seconds INTEGER NOT NULL DEFAULT 0,
		teaching_sessions_count INTEGER NOT NULL DEFAULT 0,
		lessons_monitored_count INTEGER NOT NULL DEFAULT 0,
		assessments_checked_count INTEGER NOT NULL DEFAULT 0,
		hidden_ad_incentive_naira REAL NOT NULL DEFAULT 0,
		payout_base_naira REAL NOT NULL DEFAULT 0,
		payout_bonus_naira REAL NOT NULL DEFAULT 0,
		payout_total_naira REAL NOT NULL DEFAULT 0,
		eligibility_status TEXT NOT NULL,
		computed_at TEXT NOT NULL,
		computed_by TEXT,
		metadata_json TEXT,
		UNIQUE (school_id, user_id, period_type, period_key)
	)`
];

function nowIso() {
	return new Date().toISOString();
}

function roundMoney(value: number) {
	return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

function normalizeDiscountPercent(value: unknown) {
	const numeric = Number(value || 0);
	if (!Number.isFinite(numeric)) return 0;
	return Math.max(0, Math.min(100, roundMoney(numeric)));
}

function normalizeDiscountAmount(value: unknown) {
	const numeric = Number(value || 0);
	if (!Number.isFinite(numeric)) return 0;
	return Math.max(0, roundMoney(numeric));
}

function normalizePricingTier(tier: Partial<SchoolPricingTier>, fallback: SchoolPricingTier): SchoolPricingTier {
	return {
		key: String(tier.key || fallback.key).trim() || fallback.key,
		label: String(tier.label || fallback.label).trim() || fallback.label,
		minStudents: Math.max(1, Math.round(Number(tier.minStudents ?? fallback.minStudents))),
		maxStudents: tier.maxStudents === null ? null : (tier.maxStudents === undefined ? fallback.maxStudents : Math.max(1, Math.round(Number(tier.maxStudents)))),
		oneTimeSetupNaira: Math.max(0, roundMoney(Number(tier.oneTimeSetupNaira ?? fallback.oneTimeSetupNaira))),
		perStudentPerTermNaira: Math.max(0, roundMoney(Number(tier.perStudentPerTermNaira ?? fallback.perStudentPerTermNaira))),
		oneTimeSetupDiscountNaira: normalizeDiscountAmount(tier.oneTimeSetupDiscountNaira ?? fallback.oneTimeSetupDiscountNaira),
		perStudentPerTermDiscountNaira: normalizeDiscountAmount(tier.perStudentPerTermDiscountNaira ?? fallback.perStudentPerTermDiscountNaira),
	};
}

function normalizeMarketplaceBundle(bundle: Partial<MarketplaceBundle>, fallback: MarketplaceBundle): MarketplaceBundle {
	return {
		id: String(bundle.id || fallback.id).trim() || fallback.id,
		label: String(bundle.label || fallback.label).trim() || fallback.label,
		description: String(bundle.description || fallback.description).trim() || fallback.description,
		category: (bundle.category || fallback.category) as MarketplaceBundleCategory,
		nairaAmount: Math.max(0, roundMoney(Number(bundle.nairaAmount ?? fallback.nairaAmount))),
		originalNairaAmount: bundle.originalNairaAmount === null
			? null
			: Math.max(0, roundMoney(Number(bundle.originalNairaAmount ?? fallback.originalNairaAmount ?? fallback.nairaAmount))),
		aiCredits: Math.max(0, Math.round(Number(bundle.aiCredits ?? fallback.aiCredits))),
		keyuAmount: Math.max(0, Math.round(Number(bundle.keyuAmount ?? fallback.keyuAmount))),
		active: bundle.active ?? fallback.active,
		featured: bundle.featured ?? fallback.featured,
		createdAt: String(bundle.createdAt || fallback.createdAt).trim() || fallback.createdAt,
		updatedAt: String(bundle.updatedAt || fallback.updatedAt).trim() || fallback.updatedAt,
	};
}

function normalizeDiscountCode(code: Partial<DiscountCode>, fallback: DiscountCode): DiscountCode {
	return {
		id: String(code.id || fallback.id).trim() || fallback.id,
		code: String(code.code || fallback.code).trim().toUpperCase() || fallback.code,
		description: String(code.description || fallback.description).trim() || fallback.description,
		percentageOff: normalizeDiscountPercent(code.percentageOff ?? fallback.percentageOff),
		scope: (code.scope || fallback.scope) as DiscountCodeScope,
		active: code.active ?? fallback.active,
		validFrom: code.validFrom === null ? null : String(code.validFrom || fallback.validFrom || '').trim() || null,
		expiresAt: code.expiresAt === null ? null : String(code.expiresAt || fallback.expiresAt || '').trim() || null,
		maxUses: code.maxUses === null ? null : (code.maxUses === undefined ? fallback.maxUses : Math.max(1, Math.round(Number(code.maxUses)))),
		usedCount: Math.max(0, Math.round(Number(code.usedCount ?? fallback.usedCount))),
		discontinuedAt: code.discontinuedAt === null ? null : String(code.discontinuedAt || fallback.discontinuedAt || '').trim() || null,
		createdAt: String(code.createdAt || fallback.createdAt).trim() || fallback.createdAt,
		updatedAt: String(code.updatedAt || fallback.updatedAt).trim() || fallback.updatedAt,
	};
}

function normalizePriceIncreaseNotice(notice: Partial<PriceIncreaseNotice>, fallback: PriceIncreaseNotice): PriceIncreaseNotice {
	return {
		id: String(notice.id || fallback.id).trim() || fallback.id,
		scope: (notice.scope || fallback.scope) as PriceIncreaseNoticeScope,
		title: String(notice.title || fallback.title).trim() || fallback.title,
		message: String(notice.message || fallback.message).trim() || fallback.message,
		currentAmountNaira: Math.max(0, roundMoney(Number(notice.currentAmountNaira ?? fallback.currentAmountNaira))),
		newAmountNaira: Math.max(0, roundMoney(Number(notice.newAmountNaira ?? fallback.newAmountNaira))),
		effectiveAt: String(notice.effectiveAt || fallback.effectiveAt).trim() || fallback.effectiveAt,
		active: notice.active ?? fallback.active,
		createdAt: String(notice.createdAt || fallback.createdAt).trim() || fallback.createdAt,
		updatedAt: String(notice.updatedAt || fallback.updatedAt).trim() || fallback.updatedAt,
	};
}

function defaultSettings(): MonetizationSettings {
	const createdAt = nowIso();
	return {
		schoolPricing: {
			currencyCode: 'NGN',
			academicTermsPerYear: 3,
			tiers: [
				{ key: 'tier-1', label: 'Tier 1', minStudents: 1, maxStudents: 150, oneTimeSetupNaira: 40000, perStudentPerTermNaira: 500, oneTimeSetupDiscountNaira: 5000, perStudentPerTermDiscountNaira: 50 },
				{ key: 'tier-2', label: 'Tier 2', minStudents: 151, maxStudents: null, oneTimeSetupNaira: 70000, perStudentPerTermNaira: 500, oneTimeSetupDiscountNaira: 8000, perStudentPerTermDiscountNaira: 75 },
			],
		},
		aiEconomy: {
			freeQueriesEveryDays: 3,
			freeQueriesPerWindow: 5,
			keyuPerAiCredit: 100,
			packages: [
				{ id: 'pkg-basic', label: 'Basic', nairaAmount: 100, aiCredits: 5 },
				{ id: 'pkg-bundle-500', label: 'Bundle 500', nairaAmount: 500, aiCredits: 30 },
				{ id: 'pkg-bundle-1000', label: 'Bundle 1000', nairaAmount: 1000, aiCredits: 70 },
			],
		},
		adRevenue: {
			systemRevenuePerSuccessfulImpressionNaira: 0.1,
			hiddenTeacherIncentivePerSuccessfulImpressionNaira: 0.02,
			hiddenTeacherIncentiveEnabled: true,
			systemAdRevenueEnabled: true,
			networkName: 'adsense',
		},
		focusMode: {
			userVisibleLabel: 'Focus Mode',
			minimumMonthlyActiveRatio: 0.5,
			targetMonthlyWorkingHours: 160,
			minimumQuarterlyTeachingSessions: 30,
			monthlyBaseIncentiveNaira: 2000,
			quarterlyBaseIncentiveNaira: 2000,
			quarterlyBonusMinNaira: 500,
			quarterlyBonusMaxNaira: 1000,
			programEnabled: true,
		},
		marketplace: {
			keyuPerNaira: 3,
			bundles: [
				{ id: 'bundle-ai-basic', label: 'AI Credit Starter', description: 'Quick AI top-up for staff lesson help and school workflows.', category: 'ai-credits', nairaAmount: 1000, originalNairaAmount: 1200, aiCredits: 70, keyuAmount: 0, active: true, featured: true, createdAt, updatedAt: createdAt },
				{ id: 'bundle-keyu-300', label: 'Keyu 300', description: 'Marketplace Keyu pack for in-app services and future redemptions.', category: 'keyu', nairaAmount: 100, originalNairaAmount: null, aiCredits: 0, keyuAmount: 300, active: true, featured: true, createdAt, updatedAt: createdAt },
				{ id: 'bundle-keyu-1500', label: 'Keyu 1,500', description: 'Larger Keyu bundle for schools running multiple paid actions inside the app.', category: 'keyu', nairaAmount: 500, originalNairaAmount: 600, aiCredits: 0, keyuAmount: 1500, active: true, featured: false, createdAt, updatedAt: createdAt },
				{ id: 'bundle-tutor-monthly', label: 'Tutor Monthly Access', description: 'Unlock tutorial tools after the one-week trial and keep premium tutoring active.', category: 'tutor-subscription', nairaAmount: 5000, originalNairaAmount: null, aiCredits: 0, keyuAmount: 0, active: true, featured: false, createdAt, updatedAt: createdAt },
			],
			discountCodes: [],
			tutorBilling: {
				trialDays: 7,
				monthlyFeeNaira: 5000,
				includedStudents: 5,
				extraStudentFeeNaira: 500,
				requireUpfrontAfterTrial: true,
			},
		},
		priceIncreaseNotices: [
			{
				id: 'notice-school-signup',
				scope: 'school-signup',
				title: 'School signup price increase',
				message: 'School registration fees will increase on the effective date shown below.',
				currentAmountNaira: 40000,
				newAmountNaira: 50000,
				effectiveAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString(),
				active: false,
				createdAt,
				updatedAt: createdAt,
			},
			{
				id: 'notice-termly-billing',
				scope: 'termly-billing',
				title: 'Termly billing price increase',
				message: 'Termly billing rates will change on the effective date shown below.',
				currentAmountNaira: 500,
				newAmountNaira: 650,
				effectiveAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString(),
				active: false,
				createdAt,
				updatedAt: createdAt,
			},
			{
				id: 'notice-ai-credits',
				scope: 'ai-credits',
				title: 'AI credit price increase',
				message: 'AI credit packages will increase in price on the effective date shown below.',
				currentAmountNaira: 100,
				newAmountNaira: 150,
				effectiveAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString(),
				active: false,
				createdAt,
				updatedAt: createdAt,
			},
		],
	};
}

function normalizeSettings(settings?: Partial<MonetizationSettings> | null): MonetizationSettings {
	const defaults = defaultSettings();
	return {
		schoolPricing: {
			currencyCode: String(settings?.schoolPricing?.currencyCode || defaults.schoolPricing.currencyCode).trim() || defaults.schoolPricing.currencyCode,
			academicTermsPerYear: Math.max(1, Math.round(Number(settings?.schoolPricing?.academicTermsPerYear ?? defaults.schoolPricing.academicTermsPerYear))),
			tiers: (settings?.schoolPricing?.tiers?.length ? settings.schoolPricing.tiers : defaults.schoolPricing.tiers).map((tier, index) => normalizePricingTier(tier, defaults.schoolPricing.tiers[index] || defaults.schoolPricing.tiers[defaults.schoolPricing.tiers.length - 1])),
		},
		aiEconomy: {
			freeQueriesEveryDays: Math.max(1, Math.round(Number(settings?.aiEconomy?.freeQueriesEveryDays ?? defaults.aiEconomy.freeQueriesEveryDays))),
			freeQueriesPerWindow: Math.max(0, Math.round(Number(settings?.aiEconomy?.freeQueriesPerWindow ?? defaults.aiEconomy.freeQueriesPerWindow))),
			keyuPerAiCredit: Math.max(1, Math.round(Number(settings?.aiEconomy?.keyuPerAiCredit ?? defaults.aiEconomy.keyuPerAiCredit))),
			packages: (settings?.aiEconomy?.packages?.length ? settings.aiEconomy.packages : defaults.aiEconomy.packages).map((entry, index) => ({
				id: String(entry.id || defaults.aiEconomy.packages[index]?.id || `pkg-${index + 1}`).trim(),
				label: String(entry.label || defaults.aiEconomy.packages[index]?.label || `Package ${index + 1}`).trim(),
				nairaAmount: Math.max(0, roundMoney(Number(entry.nairaAmount ?? defaults.aiEconomy.packages[index]?.nairaAmount ?? 0))),
				aiCredits: Math.max(1, Math.round(Number(entry.aiCredits ?? defaults.aiEconomy.packages[index]?.aiCredits ?? 1))),
			})),
		},
		adRevenue: {
			systemRevenuePerSuccessfulImpressionNaira: Math.max(0, roundMoney(Number(settings?.adRevenue?.systemRevenuePerSuccessfulImpressionNaira ?? defaults.adRevenue.systemRevenuePerSuccessfulImpressionNaira))),
			hiddenTeacherIncentivePerSuccessfulImpressionNaira: Math.max(0, roundMoney(Number(settings?.adRevenue?.hiddenTeacherIncentivePerSuccessfulImpressionNaira ?? defaults.adRevenue.hiddenTeacherIncentivePerSuccessfulImpressionNaira))),
			hiddenTeacherIncentiveEnabled: settings?.adRevenue?.hiddenTeacherIncentiveEnabled ?? defaults.adRevenue.hiddenTeacherIncentiveEnabled,
			systemAdRevenueEnabled: settings?.adRevenue?.systemAdRevenueEnabled ?? defaults.adRevenue.systemAdRevenueEnabled,
			networkName: String(settings?.adRevenue?.networkName || defaults.adRevenue.networkName).trim() || defaults.adRevenue.networkName,
		},
		focusMode: {
			userVisibleLabel: String(settings?.focusMode?.userVisibleLabel || defaults.focusMode.userVisibleLabel).trim() || defaults.focusMode.userVisibleLabel,
			minimumMonthlyActiveRatio: Math.max(0, Number(settings?.focusMode?.minimumMonthlyActiveRatio ?? defaults.focusMode.minimumMonthlyActiveRatio)),
			targetMonthlyWorkingHours: Math.max(1, Number(settings?.focusMode?.targetMonthlyWorkingHours ?? defaults.focusMode.targetMonthlyWorkingHours)),
			minimumQuarterlyTeachingSessions: Math.max(0, Math.round(Number(settings?.focusMode?.minimumQuarterlyTeachingSessions ?? defaults.focusMode.minimumQuarterlyTeachingSessions))),
			monthlyBaseIncentiveNaira: Math.max(0, roundMoney(Number(settings?.focusMode?.monthlyBaseIncentiveNaira ?? defaults.focusMode.monthlyBaseIncentiveNaira))),
			quarterlyBaseIncentiveNaira: Math.max(0, roundMoney(Number(settings?.focusMode?.quarterlyBaseIncentiveNaira ?? defaults.focusMode.quarterlyBaseIncentiveNaira))),
			quarterlyBonusMinNaira: Math.max(0, roundMoney(Number(settings?.focusMode?.quarterlyBonusMinNaira ?? defaults.focusMode.quarterlyBonusMinNaira))),
			quarterlyBonusMaxNaira: Math.max(0, roundMoney(Number(settings?.focusMode?.quarterlyBonusMaxNaira ?? defaults.focusMode.quarterlyBonusMaxNaira))),
			programEnabled: settings?.focusMode?.programEnabled ?? defaults.focusMode.programEnabled,
		},
		marketplace: {
			keyuPerNaira: Math.max(1, Math.round(Number(settings?.marketplace?.keyuPerNaira ?? defaults.marketplace.keyuPerNaira))),
			bundles: (settings?.marketplace?.bundles?.length ? settings.marketplace.bundles : defaults.marketplace.bundles).map((bundle, index) => normalizeMarketplaceBundle(bundle, defaults.marketplace.bundles[index] || defaults.marketplace.bundles[defaults.marketplace.bundles.length - 1])),
			discountCodes: (settings?.marketplace?.discountCodes || defaults.marketplace.discountCodes).map((code, index) => normalizeDiscountCode(code, defaults.marketplace.discountCodes[index] || {
				id: `discount_${index + 1}`,
				code: `CODE${index + 1}`,
				description: 'Discount code',
				percentageOff: 10,
				scope: 'all',
				active: true,
				validFrom: null,
				expiresAt: null,
				maxUses: null,
				usedCount: 0,
				discontinuedAt: null,
				createdAt: defaults.marketplace.bundles[0]?.createdAt || nowIso(),
				updatedAt: defaults.marketplace.bundles[0]?.updatedAt || nowIso(),
			})),
			tutorBilling: {
				trialDays: Math.max(1, Math.round(Number(settings?.marketplace?.tutorBilling?.trialDays ?? defaults.marketplace.tutorBilling.trialDays))),
				monthlyFeeNaira: Math.max(0, roundMoney(Number(settings?.marketplace?.tutorBilling?.monthlyFeeNaira ?? defaults.marketplace.tutorBilling.monthlyFeeNaira))),
				includedStudents: Math.max(1, Math.round(Number(settings?.marketplace?.tutorBilling?.includedStudents ?? defaults.marketplace.tutorBilling.includedStudents))),
				extraStudentFeeNaira: Math.max(0, roundMoney(Number(settings?.marketplace?.tutorBilling?.extraStudentFeeNaira ?? defaults.marketplace.tutorBilling.extraStudentFeeNaira))),
				requireUpfrontAfterTrial: settings?.marketplace?.tutorBilling?.requireUpfrontAfterTrial ?? defaults.marketplace.tutorBilling.requireUpfrontAfterTrial,
			},
		},
		priceIncreaseNotices: (settings?.priceIncreaseNotices?.length ? settings.priceIncreaseNotices : defaults.priceIncreaseNotices).map((notice, index) => normalizePriceIncreaseNotice(notice, defaults.priceIncreaseNotices[index] || defaults.priceIncreaseNotices[defaults.priceIncreaseNotices.length - 1])),
	};
}

function schoolIdForUser(user: User) {
	return String(user.school_id || 'school-1').trim();
}

function roleForUser(user: User) {
	return String(user.activeRole || user.roles?.[0] || 'User').trim();
}

function isTeachingRole(roleName: string) {
	return TEACHING_ROLES.has(roleName.trim().toLowerCase());
}

function monthKey(date = new Date()) {
	return date.toISOString().slice(0, 7);
}

function quarterKey(date = new Date()) {
	const month = date.getUTCMonth();
	return `${date.getUTCFullYear()}-Q${Math.floor(month / 3) + 1}`;
}

function periodBounds(periodType: 'monthly' | 'quarterly', periodKey?: string) {
	if (periodType === 'monthly') {
		const key = periodKey || monthKey();
		const [yearText, monthText] = key.split('-');
		const start = new Date(Date.UTC(Number(yearText), Number(monthText) - 1, 1, 0, 0, 0));
		const end = new Date(Date.UTC(Number(yearText), Number(monthText), 1, 0, 0, 0));
		return { key, start, end };
	}
	const key = periodKey || quarterKey();
	const [yearText, quarterText] = key.split('-Q');
	const quarter = Math.max(1, Math.min(4, Number(quarterText || 1)));
	const monthStart = (quarter - 1) * 3;
	const start = new Date(Date.UTC(Number(yearText), monthStart, 1, 0, 0, 0));
	const end = new Date(Date.UTC(Number(yearText), monthStart + 3, 1, 0, 0, 0));
	return { key, start, end };
}

function secondsBetween(startIso: string, endIso: string) {
	const diff = Math.floor((new Date(endIso).getTime() - new Date(startIso).getTime()) / 1000);
	return Math.max(0, diff);
}

async function ensureSchema() {
	await ensureSqlSchema(SCHEMA_KEY, SCHEMA_STATEMENTS);
	const existing = await queryFirstSql<{ settings_json: string }>('SELECT settings_json FROM monetization_settings WHERE scope_key = ?', ['global']);
	if (!existing) {
		await executeSql('INSERT INTO monetization_settings (scope_key, settings_json, updated_at, updated_by) VALUES (?, ?, ?, ?)', ['global', JSON.stringify(defaultSettings()), nowIso(), null]);
	}
}

async function readSettingsRow() {
	await ensureSchema();
	const row = await queryFirstSql<{ settings_json: string }>('SELECT settings_json FROM monetization_settings WHERE scope_key = ?', ['global']);
	if (!row?.settings_json) return defaultSettings();
	try {
		return normalizeSettings(JSON.parse(String(row.settings_json)) as Partial<MonetizationSettings>);
	} catch {
		return defaultSettings();
	}
}

async function touchSession(sessionId: string, now: string) {
	const session = await queryFirstSql<{ last_activity_at: string; active_seconds: number; idle_seconds: number; status: string }>('SELECT last_activity_at, active_seconds, idle_seconds, status FROM focus_mode_sessions WHERE id = ?', [sessionId]);
	if (!session || session.status !== 'active') return null;
	const diffSeconds = secondsBetween(session.last_activity_at, now);
	const activeIncrement = diffSeconds <= ACTIVE_GAP_SECONDS ? diffSeconds : 0;
	const idleIncrement = diffSeconds > ACTIVE_GAP_SECONDS ? diffSeconds : 0;
	await executeSql('UPDATE focus_mode_sessions SET last_activity_at = ?, active_seconds = ?, idle_seconds = ? WHERE id = ?', [now, Number(session.active_seconds || 0) + activeIncrement, Number(session.idle_seconds || 0) + idleIncrement, sessionId]);
	return { activeIncrement, idleIncrement };
}

async function readUserControls(schoolId: string, userId: string): Promise<MonetizationUserControl> {
	await ensureSchema();
	const row = await queryFirstSql<{
		hidden_ad_incentive_enabled: number | boolean;
		focus_mode_payout_enabled: number | boolean;
		hold_reason: string | null;
		updated_at: string;
		updated_by: string | null;
	}>('SELECT hidden_ad_incentive_enabled, focus_mode_payout_enabled, hold_reason, updated_at, updated_by FROM monetization_user_controls WHERE school_id = ? AND user_id = ?', [schoolId, userId]);
	return {
		schoolId,
		userId,
		hiddenAdIncentiveEnabled: row ? Boolean(row.hidden_ad_incentive_enabled) : true,
		focusModePayoutEnabled: row ? Boolean(row.focus_mode_payout_enabled) : true,
		holdReason: row?.hold_reason || null,
		updatedAt: row?.updated_at || nowIso(),
		updatedBy: row?.updated_by || null,
	};
}

function userFacingEligibilityRatio(activeSeconds: number, settings: MonetizationSettings) {
	const targetSeconds = Math.max(1, Number(settings.focusMode.targetMonthlyWorkingHours || 0) * 3600);
	return Math.max(0, Math.min(1, activeSeconds / targetSeconds));
}

export async function getMonetizationSettings() {
	return readSettingsRow();
}

export async function saveMonetizationSettings(settings: MonetizationSettings, updatedBy?: string | null) {
	await ensureSchema();
	const normalized = normalizeSettings(settings);
	await executeSql('UPDATE monetization_settings SET settings_json = ?, updated_at = ?, updated_by = ? WHERE scope_key = ?', [JSON.stringify(normalized), nowIso(), String(updatedBy || '').trim() || null, 'global']);
	return normalized;
}

export function calculateTierDiscountPercent(tier: SchoolPricingTier) {
	const setupPercent = tier.oneTimeSetupNaira > 0 ? ((Number(tier.oneTimeSetupDiscountNaira || 0) / tier.oneTimeSetupNaira) * 100) : 0;
	const termPercent = tier.perStudentPerTermNaira > 0 ? ((Number(tier.perStudentPerTermDiscountNaira || 0) / tier.perStudentPerTermNaira) * 100) : 0;
	return roundMoney(Math.max(setupPercent, termPercent));
}

export function getTierDiscountedAmounts(tier: SchoolPricingTier) {
	return {
		oneTimeSetupNaira: Math.max(0, roundMoney(Number(tier.oneTimeSetupNaira || 0) - Number(tier.oneTimeSetupDiscountNaira || 0))),
		perStudentPerTermNaira: Math.max(0, roundMoney(Number(tier.perStudentPerTermNaira || 0) - Number(tier.perStudentPerTermDiscountNaira || 0))),
		discountPercent: calculateTierDiscountPercent(tier),
	};
}

export function getMarketplaceBundleDiscountPercent(bundle: MarketplaceBundle) {
	if (!bundle.originalNairaAmount || bundle.originalNairaAmount <= bundle.nairaAmount || bundle.originalNairaAmount <= 0) return 0;
	return roundMoney(((bundle.originalNairaAmount - bundle.nairaAmount) / bundle.originalNairaAmount) * 100);
}

export function getMarketplaceBundlePrice(bundle: MarketplaceBundle) {
	return roundMoney(bundle.nairaAmount);
}

export function isDiscountCodeActive(code: DiscountCode, scope: DiscountCodeScope, referenceDate = new Date()) {
	if (!code.active || code.discontinuedAt) return false;
	if (!(code.scope === 'all' || code.scope === scope)) return false;
	if (code.validFrom && new Date(code.validFrom).getTime() > referenceDate.getTime()) return false;
	if (code.expiresAt && new Date(code.expiresAt).getTime() < referenceDate.getTime()) return false;
	if (code.maxUses !== null && Number(code.usedCount || 0) >= Number(code.maxUses || 0)) return false;
	return true;
}

export async function validateDiscountCode(codeText: string, scope: DiscountCodeScope) {
	const settings = await getMonetizationSettings();
	const normalizedCode = String(codeText || '').trim().toUpperCase();
	if (!normalizedCode) return null;
	const match = settings.marketplace.discountCodes.find((entry) => entry.code.trim().toUpperCase() === normalizedCode);
	if (!match || !isDiscountCodeActive(match, scope)) return null;
	return match;
}

export async function consumeDiscountCode(codeId: string, updatedBy?: string | null) {
	const settings = await getMonetizationSettings();
	const nextCodes = settings.marketplace.discountCodes.map((entry) => entry.id === codeId
		? { ...entry, usedCount: Number(entry.usedCount || 0) + 1, updatedAt: nowIso() }
		: entry);
	return saveMonetizationSettings({ ...settings, marketplace: { ...settings.marketplace, discountCodes: nextCodes } }, updatedBy);
}

export async function getMarketplaceCatalog() {
	const settings = await getMonetizationSettings();
	return {
		keyuPerNaira: settings.marketplace.keyuPerNaira,
		bundles: settings.marketplace.bundles
			.filter((bundle) => bundle.active)
			.map((bundle) => ({
				...bundle,
				discountPercent: getMarketplaceBundleDiscountPercent(bundle),
			})),
		tutorBilling: settings.marketplace.tutorBilling,
	};
}

export async function getTutorBillingSettings() {
	const settings = await getMonetizationSettings();
	return settings.marketplace.tutorBilling;
}

export async function setMonetizationUserControl(input: {
	schoolId: string;
	userId: string;
	hiddenAdIncentiveEnabled: boolean;
	focusModePayoutEnabled: boolean;
	holdReason?: string | null;
	updatedBy?: string | null;
}) {
	await ensureSchema();
	const updatedAt = nowIso();
	await executeSql(
		'INSERT INTO monetization_user_controls (school_id, user_id, hidden_ad_incentive_enabled, focus_mode_payout_enabled, hold_reason, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(school_id, user_id) DO UPDATE SET hidden_ad_incentive_enabled = excluded.hidden_ad_incentive_enabled, focus_mode_payout_enabled = excluded.focus_mode_payout_enabled, hold_reason = excluded.hold_reason, updated_at = excluded.updated_at, updated_by = excluded.updated_by',
		[input.schoolId, input.userId, input.hiddenAdIncentiveEnabled ? 1 : 0, input.focusModePayoutEnabled ? 1 : 0, String(input.holdReason || '').trim() || null, updatedAt, String(input.updatedBy || '').trim() || null]
	);
	return readUserControls(input.schoolId, input.userId);
}

export async function getMonetizationUserControl(schoolId: string, userId: string) {
	return readUserControls(schoolId, userId);
}

export async function startFocusModeSession(user: User, input?: { sourcePage?: string }) {
	await ensureSchema();
	const schoolId = schoolIdForUser(user);
	const userId = String(user.id || '').trim();
	const active = await queryFirstSql<{ id: string }>('SELECT id FROM focus_mode_sessions WHERE school_id = ? AND user_id = ? AND status = ?', [schoolId, userId, 'active']);
	if (active?.id) return getFocusModeStatus(user);
	const now = nowIso();
	const sessionId = `focus_${crypto.randomUUID()}`;
	await executeSql('INSERT INTO focus_mode_sessions (id, school_id, user_id, role_name, source_page, started_at, last_activity_at, ended_at, status, active_seconds, idle_seconds) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [sessionId, schoolId, userId, roleForUser(user), String(input?.sourcePage || 'focus-mode').trim() || 'focus-mode', now, now, null, 'active', 0, 0]);
	await executeSql('INSERT INTO focus_mode_activity_events (id, school_id, user_id, session_id, event_type, source_page, lesson_id, assessment_id, student_id, created_at, metadata_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [`activity_${crypto.randomUUID()}`, schoolId, userId, sessionId, 'toggle_on', String(input?.sourcePage || 'focus-mode').trim() || 'focus-mode', null, null, null, now, null]);
	return getFocusModeStatus(user);
}

export async function recordFocusModeActivity(user: User, input: {
	sessionId: string;
	eventType?: string;
	sourcePage?: string;
	lessonId?: string;
	assessmentId?: string;
	studentId?: string;
	metadata?: Record<string, unknown>;
}) {
	await ensureSchema();
	const now = nowIso();
	await touchSession(String(input.sessionId || '').trim(), now);
	await executeSql('INSERT INTO focus_mode_activity_events (id, school_id, user_id, session_id, event_type, source_page, lesson_id, assessment_id, student_id, created_at, metadata_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [`activity_${crypto.randomUUID()}`, schoolIdForUser(user), String(user.id || '').trim(), String(input.sessionId || '').trim(), String(input.eventType || 'heartbeat').trim() || 'heartbeat', String(input.sourcePage || '').trim() || null, String(input.lessonId || '').trim() || null, String(input.assessmentId || '').trim() || null, String(input.studentId || '').trim() || null, now, input.metadata ? JSON.stringify(input.metadata) : null]);
	return getFocusModeStatus(user);
}

export async function stopFocusModeSession(user: User, sessionId: string) {
	await ensureSchema();
	const now = nowIso();
	await touchSession(String(sessionId || '').trim(), now);
	await executeSql('UPDATE focus_mode_sessions SET status = ?, ended_at = ?, last_activity_at = ? WHERE id = ? AND school_id = ? AND user_id = ?', ['ended', now, now, String(sessionId || '').trim(), schoolIdForUser(user), String(user.id || '').trim()]);
	await executeSql('INSERT INTO focus_mode_activity_events (id, school_id, user_id, session_id, event_type, source_page, lesson_id, assessment_id, student_id, created_at, metadata_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [`activity_${crypto.randomUUID()}`, schoolIdForUser(user), String(user.id || '').trim(), String(sessionId || '').trim(), 'toggle_off', 'focus-mode', null, null, null, now, null]);
	return getFocusModeStatus(user);
}

export async function getFocusModeStatus(user: User): Promise<FocusModeStatus> {
	await ensureSchema();
	const schoolId = schoolIdForUser(user);
	const userId = String(user.id || '').trim();
	const settings = await readSettingsRow();
	const activeSession = await queryFirstSql<{
		id: string;
		school_id: string;
		user_id: string;
		role_name: string;
		source_page: string;
		started_at: string;
		last_activity_at: string;
		ended_at: string | null;
		status: string;
		active_seconds: number;
		idle_seconds: number;
	}>('SELECT id, school_id, user_id, role_name, source_page, started_at, last_activity_at, ended_at, status, active_seconds, idle_seconds FROM focus_mode_sessions WHERE school_id = ? AND user_id = ? AND status = ? ORDER BY started_at DESC LIMIT 1', [schoolId, userId, 'active']);
	const { key, start, end } = periodBounds('monthly');
	const sessionRows = await queryRowsSql<{ active_seconds: number }>('SELECT active_seconds FROM focus_mode_sessions WHERE school_id = ? AND user_id = ? AND started_at >= ? AND started_at < ?', [schoolId, userId, start.toISOString(), end.toISOString()]);
	const lessonRow = await queryFirstSql<{ total: number }>('SELECT COUNT(*) AS total FROM focus_mode_activity_events WHERE school_id = ? AND user_id = ? AND created_at >= ? AND created_at < ? AND event_type IN (?, ?)', [schoolId, userId, start.toISOString(), end.toISOString(), 'lesson_monitor', 'lesson_open']);
	const assessmentRow = await queryFirstSql<{ total: number }>('SELECT COUNT(*) AS total FROM focus_mode_activity_events WHERE school_id = ? AND user_id = ? AND created_at >= ? AND created_at < ? AND event_type IN (?, ?)', [schoolId, userId, start.toISOString(), end.toISOString(), 'assessment_review', 'assessment_submit']);
	const activeSeconds = sessionRows.reduce((sum, row) => sum + Number(row.active_seconds || 0), 0);
	return {
		activeSession: activeSession ? {
			id: activeSession.id,
			schoolId: activeSession.school_id,
			userId: activeSession.user_id,
			roleName: activeSession.role_name,
			sourcePage: activeSession.source_page,
			startedAt: activeSession.started_at,
			lastActivityAt: activeSession.last_activity_at,
			endedAt: activeSession.ended_at,
			status: activeSession.status,
			activeSeconds: Number(activeSession.active_seconds || 0),
			idleSeconds: Number(activeSession.idle_seconds || 0),
		} : null,
		monthToDate: {
			periodKey: key,
			activeSeconds,
			teachingSessionsCount: sessionRows.length,
			lessonsMonitoredCount: Number(lessonRow?.total || 0),
			assessmentsCheckedCount: Number(assessmentRow?.total || 0),
			eligibilityProgressRatio: userFacingEligibilityRatio(activeSeconds, settings),
		},
	};
}

export async function recordAdImpressionForMonitoring(user: User, input: {
	pageKey: string;
	placementKey: string;
	focusSessionId?: string;
	networkName?: string;
	successful?: boolean;
	metadata?: Record<string, unknown>;
}) {
	await ensureSchema();
	const settings = await readSettingsRow();
	const schoolId = schoolIdForUser(user);
	const userId = String(user.id || '').trim();
	const controls = await readUserControls(schoolId, userId);
	const successful = input.successful !== false;
	const canAccrueHiddenTeacherAmount = successful && settings.adRevenue.hiddenTeacherIncentiveEnabled && controls.hiddenAdIncentiveEnabled && !controls.holdReason && isTeachingRole(roleForUser(user));
	const eventId = `impression_${crypto.randomUUID()}`;
	await executeSql('INSERT INTO ad_impression_events (id, school_id, user_id, role_name, focus_session_id, page_key, placement_key, network_name, impression_status, system_revenue_naira, hidden_teacher_incentive_naira, created_at, metadata_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [eventId, schoolId, userId, roleForUser(user), String(input.focusSessionId || '').trim() || null, String(input.pageKey || 'unknown').trim() || 'unknown', String(input.placementKey || 'default').trim() || 'default', String(input.networkName || settings.adRevenue.networkName || 'adsense').trim() || 'adsense', successful ? 'successful' : 'failed', successful && settings.adRevenue.systemAdRevenueEnabled ? roundMoney(settings.adRevenue.systemRevenuePerSuccessfulImpressionNaira) : 0, canAccrueHiddenTeacherAmount ? roundMoney(settings.adRevenue.hiddenTeacherIncentivePerSuccessfulImpressionNaira) : 0, nowIso(), input.metadata ? JSON.stringify(input.metadata) : null]);
	return { eventId };
}

export async function computeFocusModePeriodSummaries(input: {
	periodType: 'monthly' | 'quarterly';
	periodKey?: string;
	schoolId?: string;
	computedBy?: string | null;
}) {
	await ensureSchema();
	const settings = await readSettingsRow();
	const { key, start, end } = periodBounds(input.periodType, input.periodKey);
	const sessionRows = await queryRowsSql<{
		school_id: string;
		user_id: string;
		role_name: string;
		active_seconds: number;
	}>('SELECT school_id, user_id, role_name, active_seconds FROM focus_mode_sessions WHERE started_at >= ? AND started_at < ?' + (input.schoolId ? ' AND school_id = ?' : ''), input.schoolId ? [start.toISOString(), end.toISOString(), input.schoolId] : [start.toISOString(), end.toISOString()]);
	const activityRows = await queryRowsSql<{
		school_id: string;
		user_id: string;
		event_type: string;
	}>('SELECT school_id, user_id, event_type FROM focus_mode_activity_events WHERE created_at >= ? AND created_at < ?' + (input.schoolId ? ' AND school_id = ?' : ''), input.schoolId ? [start.toISOString(), end.toISOString(), input.schoolId] : [start.toISOString(), end.toISOString()]);
	const adRows = await queryRowsSql<{
		school_id: string;
		user_id: string;
		hidden_teacher_incentive_naira: number;
	}>('SELECT school_id, user_id, hidden_teacher_incentive_naira FROM ad_impression_events WHERE created_at >= ? AND created_at < ? AND impression_status = ?' + (input.schoolId ? ' AND school_id = ?' : ''), input.schoolId ? [start.toISOString(), end.toISOString(), 'successful', input.schoolId] : [start.toISOString(), end.toISOString(), 'successful']);
	const grouped = new Map<string, {
		schoolId: string;
		userId: string;
		roleName: string;
		activeSeconds: number;
		teachingSessionsCount: number;
		lessonsMonitoredCount: number;
		assessmentsCheckedCount: number;
		hiddenAdIncentiveNaira: number;
	}>();
	for (const row of sessionRows) {
		const groupKey = `${row.school_id}:${row.user_id}`;
		const existing = grouped.get(groupKey) || { schoolId: row.school_id, userId: row.user_id, roleName: row.role_name, activeSeconds: 0, teachingSessionsCount: 0, lessonsMonitoredCount: 0, assessmentsCheckedCount: 0, hiddenAdIncentiveNaira: 0 };
		existing.activeSeconds += Number(row.active_seconds || 0);
		existing.teachingSessionsCount += 1;
		grouped.set(groupKey, existing);
	}
	for (const row of activityRows) {
		const groupKey = `${row.school_id}:${row.user_id}`;
		const existing = grouped.get(groupKey);
		if (!existing) continue;
		if (['lesson_monitor', 'lesson_open'].includes(row.event_type)) existing.lessonsMonitoredCount += 1;
		if (['assessment_review', 'assessment_submit'].includes(row.event_type)) existing.assessmentsCheckedCount += 1;
	}
	for (const row of adRows) {
		const groupKey = `${row.school_id}:${row.user_id}`;
		const existing = grouped.get(groupKey);
		if (!existing) continue;
		existing.hiddenAdIncentiveNaira = roundMoney(existing.hiddenAdIncentiveNaira + Number(row.hidden_teacher_incentive_naira || 0));
	}
	const rankedKeys = Array.from(grouped.entries())
		.filter(([, summary]) => isTeachingRole(summary.roleName))
		.sort((left, right) => right[1].activeSeconds - left[1].activeSeconds || right[1].teachingSessionsCount - left[1].teachingSessionsCount || right[1].lessonsMonitoredCount - left[1].lessonsMonitoredCount || right[1].assessmentsCheckedCount - left[1].assessmentsCheckedCount || left[1].userId.localeCompare(right[1].userId))
		.slice(0, 50)
		.map(([groupKey]) => groupKey);
	const topTeacherKeys = new Set(rankedKeys);
	for (const summary of grouped.values()) {
		const controls = await readUserControls(summary.schoolId, summary.userId);
		const monthlyRatio = userFacingEligibilityRatio(summary.activeSeconds, settings);
		const qualifiesForPeriod = input.periodType === 'monthly'
			? monthlyRatio >= settings.focusMode.minimumMonthlyActiveRatio
			: summary.teachingSessionsCount >= settings.focusMode.minimumQuarterlyTeachingSessions || monthlyRatio >= settings.focusMode.minimumMonthlyActiveRatio * 3;
		const eligible = settings.focusMode.programEnabled && controls.focusModePayoutEnabled && !controls.holdReason && topTeacherKeys.has(`${summary.schoolId}:${summary.userId}`) && qualifiesForPeriod;
		const payoutBase = eligible ? roundMoney(input.periodType === 'monthly' ? settings.focusMode.monthlyBaseIncentiveNaira : settings.focusMode.quarterlyBaseIncentiveNaira) : 0;
		const payoutBonus = eligible && input.periodType === 'quarterly' && summary.assessmentsCheckedCount > 0 ? roundMoney(settings.focusMode.quarterlyBonusMinNaira) : 0;
		const payoutTotal = roundMoney(payoutBase + payoutBonus);
		await executeSql(
			'INSERT INTO focus_mode_period_summaries (id, school_id, user_id, role_name, period_type, period_key, active_seconds, teaching_sessions_count, lessons_monitored_count, assessments_checked_count, hidden_ad_incentive_naira, payout_base_naira, payout_bonus_naira, payout_total_naira, eligibility_status, computed_at, computed_by, metadata_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(school_id, user_id, period_type, period_key) DO UPDATE SET role_name = excluded.role_name, active_seconds = excluded.active_seconds, teaching_sessions_count = excluded.teaching_sessions_count, lessons_monitored_count = excluded.lessons_monitored_count, assessments_checked_count = excluded.assessments_checked_count, hidden_ad_incentive_naira = excluded.hidden_ad_incentive_naira, payout_base_naira = excluded.payout_base_naira, payout_bonus_naira = excluded.payout_bonus_naira, payout_total_naira = excluded.payout_total_naira, eligibility_status = excluded.eligibility_status, computed_at = excluded.computed_at, computed_by = excluded.computed_by, metadata_json = excluded.metadata_json',
			[`summary_${crypto.randomUUID()}`, summary.schoolId, summary.userId, summary.roleName, input.periodType, key, summary.activeSeconds, summary.teachingSessionsCount, summary.lessonsMonitoredCount, summary.assessmentsCheckedCount, summary.hiddenAdIncentiveNaira, payoutBase, payoutBonus, payoutTotal, eligible ? 'eligible' : controls.holdReason ? 'held' : topTeacherKeys.has(`${summary.schoolId}:${summary.userId}`) ? 'not-eligible' : 'outside-top-50', nowIso(), String(input.computedBy || '').trim() || null, JSON.stringify({ monthlyEligibilityRatio: monthlyRatio, rankedForIncentive: topTeacherKeys.has(`${summary.schoolId}:${summary.userId}`) })]
		);
	}
	return listFocusModeEligibility({ periodType: input.periodType, periodKey: key, schoolId: input.schoolId });
}

export async function listFocusModeEligibility(input: { periodType: 'monthly' | 'quarterly'; periodKey?: string; schoolId?: string }) {
	await ensureSchema();
	const { key } = periodBounds(input.periodType, input.periodKey);
	return queryRowsSql<PeriodSummaryRow>('SELECT id, school_id, user_id, role_name, period_type, period_key, active_seconds, teaching_sessions_count, lessons_monitored_count, assessments_checked_count, hidden_ad_incentive_naira, payout_base_naira, payout_bonus_naira, payout_total_naira, eligibility_status FROM focus_mode_period_summaries WHERE period_type = ? AND period_key = ?' + (input.schoolId ? ' AND school_id = ?' : '') + ' ORDER BY payout_total_naira DESC, active_seconds DESC', input.schoolId ? [input.periodType, key, input.schoolId] : [input.periodType, key]);
}

export async function getMonetizationOverview(input: { periodType: 'monthly' | 'quarterly'; periodKey?: string; schoolId?: string }): Promise<MonetizationOverview> {
	await ensureSchema();
	const { key, start, end } = periodBounds(input.periodType, input.periodKey);
	const adRows = await queryRowsSql<{
		school_id: string;
		system_revenue_naira: number;
		hidden_teacher_incentive_naira: number;
	}>('SELECT school_id, system_revenue_naira, hidden_teacher_incentive_naira FROM ad_impression_events WHERE impression_status = ? AND created_at >= ? AND created_at < ?' + (input.schoolId ? ' AND school_id = ?' : ''), input.schoolId ? ['successful', start.toISOString(), end.toISOString(), input.schoolId] : ['successful', start.toISOString(), end.toISOString()]);
	const summaryRows = await listFocusModeEligibility({ periodType: input.periodType, periodKey: key, schoolId: input.schoolId });
	const schoolBreakdown = new Map<string, MonetizationOverview['schoolBreakdown'][number]>();
	for (const row of adRows) {
		const entry = schoolBreakdown.get(row.school_id) || { schoolId: row.school_id, systemRevenueNaira: 0, hiddenTeacherIncentiveNaira: 0, successfulImpressions: 0, focusEligibleStaff: 0 };
		entry.systemRevenueNaira = roundMoney(entry.systemRevenueNaira + Number(row.system_revenue_naira || 0));
		entry.hiddenTeacherIncentiveNaira = roundMoney(entry.hiddenTeacherIncentiveNaira + Number(row.hidden_teacher_incentive_naira || 0));
		entry.successfulImpressions += 1;
		schoolBreakdown.set(row.school_id, entry);
	}
	for (const row of summaryRows) {
		const entry = schoolBreakdown.get(row.school_id) || { schoolId: row.school_id, systemRevenueNaira: 0, hiddenTeacherIncentiveNaira: 0, successfulImpressions: 0, focusEligibleStaff: 0 };
		if (row.eligibility_status === 'eligible') entry.focusEligibleStaff += 1;
		schoolBreakdown.set(row.school_id, entry);
	}
	const heldCount = summaryRows.filter((row) => row.eligibility_status === 'held').length;
	return {
		periodType: input.periodType,
		periodKey: key,
		systemRevenueNaira: roundMoney(adRows.reduce((sum, row) => sum + Number(row.system_revenue_naira || 0), 0)),
		hiddenTeacherIncentiveNaira: roundMoney(adRows.reduce((sum, row) => sum + Number(row.hidden_teacher_incentive_naira || 0), 0)),
		successfulImpressions: adRows.length,
		focusEligibleStaff: summaryRows.filter((row) => row.eligibility_status === 'eligible').length,
		staffOnHold: heldCount,
		schoolBreakdown: Array.from(schoolBreakdown.values()).sort((left, right) => right.systemRevenueNaira - left.systemRevenueNaira),
		teacherSummaries: summaryRows.map((row) => ({
			schoolId: row.school_id,
			userId: row.user_id,
			activeSeconds: Number(row.active_seconds || 0),
			teachingSessionsCount: Number(row.teaching_sessions_count || 0),
			payoutTotalNaira: roundMoney(Number(row.payout_total_naira || 0)),
			hiddenAdIncentiveNaira: roundMoney(Number(row.hidden_ad_incentive_naira || 0)),
			eligibilityStatus: row.eligibility_status,
		})),
	};
}

function noticeVisibleToRole(scope: PriceIncreaseNoticeScope, roleName: string) {
	const normalizedRole = String(roleName || '').trim().toLowerCase();
	if (scope === 'ai-credits') return true;
	return ['hos', 'owner', 'tenant school owner', 'ict manager'].includes(normalizedRole);
}

function sameUtcDate(left: string | null | undefined, right: string | null | undefined) {
	if (!left || !right) return false;
	return left.slice(0, 10) === right.slice(0, 10);
}

export async function getUserPriceIncreaseNotices(user: User): Promise<DashboardPriceIncreaseNotice[]> {
	await ensureSchema();
	const schoolId = schoolIdForUser(user);
	const userId = String(user.id || '').trim();
	const roleName = roleForUser(user);
	const settings = await getMonetizationSettings();
	const rows = await queryRowsSql<{ notice_id: string; dismissed_on: string | null; agreed_at: string | null }>('SELECT notice_id, dismissed_on, agreed_at FROM monetization_notice_acknowledgements WHERE school_id = ? AND user_id = ?', [schoolId, userId]);
	const ackByNotice = new Map(rows.map((row) => [row.notice_id, row]));
	const today = nowIso().slice(0, 10);
	return settings.priceIncreaseNotices
		.filter((notice) => notice.active)
		.filter((notice) => noticeVisibleToRole(notice.scope, roleName))
		.filter((notice) => sameUtcDate(notice.effectiveAt, today) || new Date(notice.effectiveAt).getTime() > Date.now())
		.map((notice) => {
			const ack = ackByNotice.get(notice.id);
			const agreed = Boolean(ack?.agreed_at);
			const dismissedToday = sameUtcDate(ack?.dismissed_on || null, today);
			return {
				...notice,
				agreed,
				dismissedToday,
				showToday: !agreed && !dismissedToday,
			};
		})
		.filter((notice) => notice.showToday || notice.dismissedToday);
}

export async function acknowledgeUserPriceIncreaseNotice(user: User, input: { noticeId: string; action: 'dismiss' | 'agree' }) {
	await ensureSchema();
	const schoolId = schoolIdForUser(user);
	const userId = String(user.id || '').trim();
	const settings = await getMonetizationSettings();
	const notice = settings.priceIncreaseNotices.find((entry) => entry.id === input.noticeId);
	if (!notice) throw new Error('Price increase notice not found.');
	const updatedAt = nowIso();
	await executeSql(
		'INSERT INTO monetization_notice_acknowledgements (school_id, user_id, notice_id, dismissed_on, agreed_at, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(school_id, user_id, notice_id) DO UPDATE SET dismissed_on = excluded.dismissed_on, agreed_at = CASE WHEN excluded.agreed_at IS NOT NULL THEN excluded.agreed_at ELSE monetization_notice_acknowledgements.agreed_at END, updated_at = excluded.updated_at',
		[
			schoolId,
			userId,
			input.noticeId,
			input.action === 'dismiss' ? updatedAt.slice(0, 10) : null,
			input.action === 'agree' ? updatedAt : null,
			updatedAt,
		]
	);
	return getUserPriceIncreaseNotices(user);
}