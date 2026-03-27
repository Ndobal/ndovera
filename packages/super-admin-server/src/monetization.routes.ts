import { Router } from 'express';
import { z } from 'zod';

import { getMonetizationOverview, getMonetizationSettings, getMonetizationUserControl, listFocusModeEligibility, saveMonetizationSettings, setMonetizationUserControl, computeFocusModePeriodSummaries } from '../../server/src/modules/finance/monetization.store.js';

export const monetizationSuperRouter = Router();

const settingsSchema = z.object({
	schoolPricing: z.object({
		currencyCode: z.string().trim().min(1),
		academicTermsPerYear: z.number().int().min(1),
		tiers: z.array(z.object({
			key: z.string().trim().min(1),
			label: z.string().trim().min(1),
			minStudents: z.number().int().min(0),
			maxStudents: z.number().int().nullable(),
			oneTimeSetupNaira: z.number().nonnegative(),
			perStudentPerTermNaira: z.number().nonnegative(),
			oneTimeSetupDiscountNaira: z.number().nonnegative().optional(),
			perStudentPerTermDiscountNaira: z.number().nonnegative().optional(),
		})).min(1),
	}),
	aiEconomy: z.object({
		freeQueriesEveryDays: z.number().int().min(1),
		freeQueriesPerWindow: z.number().int().min(0),
		keyuPerAiCredit: z.number().int().min(1),
		packages: z.array(z.object({
			id: z.string().trim().min(1),
			label: z.string().trim().min(1),
			nairaAmount: z.number().nonnegative(),
			aiCredits: z.number().int().min(1),
		})).min(1),
	}),
	adRevenue: z.object({
		systemRevenuePerSuccessfulImpressionNaira: z.number().nonnegative(),
		hiddenTeacherIncentivePerSuccessfulImpressionNaira: z.number().nonnegative(),
		hiddenTeacherIncentiveEnabled: z.boolean(),
		systemAdRevenueEnabled: z.boolean(),
		networkName: z.string().trim().min(1),
	}),
	focusMode: z.object({
		userVisibleLabel: z.string().trim().min(1),
		minimumMonthlyActiveRatio: z.number().nonnegative(),
		targetMonthlyWorkingHours: z.number().positive(),
		minimumQuarterlyTeachingSessions: z.number().int().nonnegative(),
		monthlyBaseIncentiveNaira: z.number().nonnegative(),
		quarterlyBaseIncentiveNaira: z.number().nonnegative(),
		quarterlyBonusMinNaira: z.number().nonnegative(),
		quarterlyBonusMaxNaira: z.number().nonnegative(),
		programEnabled: z.boolean(),
	}),
	marketplace: z.object({
		keyuPerNaira: z.number().int().min(1),
		bundles: z.array(z.object({
			id: z.string().trim().min(1),
			label: z.string().trim().min(1),
			description: z.string().trim().min(1),
			category: z.enum(['ai-credits', 'keyu', 'tutor-subscription']),
			nairaAmount: z.number().nonnegative(),
			originalNairaAmount: z.number().nonnegative().nullable(),
			aiCredits: z.number().int().nonnegative(),
			keyuAmount: z.number().int().nonnegative(),
			active: z.boolean(),
			featured: z.boolean(),
			createdAt: z.string().trim().min(1),
			updatedAt: z.string().trim().min(1),
		})).min(1),
		discountCodes: z.array(z.object({
			id: z.string().trim().min(1),
			code: z.string().trim().min(1),
			description: z.string().trim().min(1),
			percentageOff: z.number().min(0).max(100),
			scope: z.enum(['school-onboarding', 'marketplace', 'all']),
			active: z.boolean(),
			validFrom: z.string().trim().nullable(),
			expiresAt: z.string().trim().nullable(),
			maxUses: z.number().int().positive().nullable(),
			usedCount: z.number().int().nonnegative(),
			discontinuedAt: z.string().trim().nullable(),
			createdAt: z.string().trim().min(1),
			updatedAt: z.string().trim().min(1),
		})),
		tutorBilling: z.object({
			trialDays: z.number().int().min(1),
			monthlyFeeNaira: z.number().nonnegative(),
			includedStudents: z.number().int().min(1),
			extraStudentFeeNaira: z.number().nonnegative(),
			requireUpfrontAfterTrial: z.boolean(),
		}),
	}),
	priceIncreaseNotices: z.array(z.object({
		id: z.string().trim().min(1),
		scope: z.enum(['school-signup', 'termly-billing', 'ai-credits']),
		title: z.string().trim().min(1),
		message: z.string().trim().min(1),
		currentAmountNaira: z.number().nonnegative(),
		newAmountNaira: z.number().nonnegative(),
		effectiveAt: z.string().trim().min(1),
		active: z.boolean(),
		createdAt: z.string().trim().min(1),
		updatedAt: z.string().trim().min(1),
	})).min(1),
});

const computeSchema = z.object({
	periodType: z.enum(['monthly', 'quarterly']),
	periodKey: z.string().trim().optional(),
	schoolId: z.string().trim().optional(),
});

const userControlSchema = z.object({
	schoolId: z.string().trim().min(1),
	userId: z.string().trim().min(1),
	hiddenAdIncentiveEnabled: z.boolean(),
	focusModePayoutEnabled: z.boolean(),
	holdReason: z.string().trim().max(240).optional().or(z.literal('')),
});

monetizationSuperRouter.get('/settings', async (_req, res) => {
	return res.json({ settings: await getMonetizationSettings() });
});

monetizationSuperRouter.put('/settings', async (req, res) => {
	const parsed = settingsSchema.safeParse(req.body?.settings || req.body || {});
	if (!parsed.success) return res.status(400).json({ error: 'Invalid monetization settings payload.' });
	const user = (req as any).superUser;
	return res.json({ settings: await saveMonetizationSettings(parsed.data, user?.id || null) });
});

monetizationSuperRouter.get('/overview', async (req, res) => {
	const periodType = req.query.periodType === 'quarterly' ? 'quarterly' : 'monthly';
	return res.json(await getMonetizationOverview({ periodType, periodKey: String(req.query.periodKey || '').trim() || undefined, schoolId: String(req.query.schoolId || '').trim() || undefined }));
});

monetizationSuperRouter.post('/focus-mode/compute', async (req, res) => {
	const parsed = computeSchema.safeParse(req.body || {});
	if (!parsed.success) return res.status(400).json({ error: 'Invalid focus mode compute payload.' });
	const user = (req as any).superUser;
	return res.json({ summaries: await computeFocusModePeriodSummaries({ ...parsed.data, computedBy: user?.id || null }) });
});

monetizationSuperRouter.get('/focus-mode/eligibility', async (req, res) => {
	const periodType = req.query.periodType === 'quarterly' ? 'quarterly' : 'monthly';
	return res.json({ summaries: await listFocusModeEligibility({ periodType, periodKey: String(req.query.periodKey || '').trim() || undefined, schoolId: String(req.query.schoolId || '').trim() || undefined }) });
});

monetizationSuperRouter.get('/user-controls', async (req, res) => {
	const schoolId = String(req.query.schoolId || '').trim();
	const userId = String(req.query.userId || '').trim();
	if (!schoolId || !userId) return res.status(400).json({ error: 'schoolId and userId are required.' });
	return res.json({ control: await getMonetizationUserControl(schoolId, userId) });
});

monetizationSuperRouter.put('/user-controls', async (req, res) => {
	const parsed = userControlSchema.safeParse(req.body || {});
	if (!parsed.success) return res.status(400).json({ error: 'Invalid user control payload.' });
	const user = (req as any).superUser;
	return res.json({ control: await setMonetizationUserControl({ ...parsed.data, holdReason: parsed.data.holdReason || null, updatedBy: user?.id || null }) });
});