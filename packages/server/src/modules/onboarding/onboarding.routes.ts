import { Router } from 'express';
import { z } from 'zod';

import { getSchoolPricingCatalog } from '../finance/billing.store.js';
import { consumeDiscountCode, getTierDiscountedAmounts, validateDiscountCode } from '../finance/monetization.store.js';
import { getOnboardingRequestByWaitToken, recordOnboardingPayment, registerSchoolOnboardingRequest } from './onboarding.store.js';

export const onboardingRouter = Router();

const registerSchema = z.object({
	schoolName: z.string().trim().min(2),
	ownerName: z.string().trim().min(2),
	ownerNdoveraEmail: z.string().trim().email(),
	adminEmail: z.string().trim().email().optional().or(z.literal('')),
	phoneNumber: z.string().trim().optional(),
	pricingTierKey: z.string().trim().optional(),
	requestedStudentCount: z.number().int().positive().max(50000).optional(),
});

function formatTierRange(minStudents: number, maxStudents: number | null) {
	return maxStudents === null ? `${minStudents}+ learners` : `${minStudents} to ${maxStudents} learners`;
}

const paymentSchema = z.object({
	paymentReference: z.string().trim().optional(),
	discountCode: z.string().trim().optional().or(z.literal('')),
});

const discountCodeSchema = z.object({
	code: z.string().trim().min(1),
});

function calculateOnboardingAmounts(input: {
	selectedTier: Awaited<ReturnType<typeof getSchoolPricingCatalog>>['schoolPricing']['tiers'][number] | null;
	requestedStudentCount?: number;
	extraStudentCount?: number;
	discountPercentage?: number;
}) {
	if (!input.selectedTier) {
		return { subtotalNaira: 0, discountNaira: 0, totalNaira: 0 };
	}
	const requestedStudentCount = Math.max(0, Number(input.requestedStudentCount || 0));
	const extraStudentCount = Math.max(0, Number(input.extraStudentCount || 0));
	const discountedTier = getTierDiscountedAmounts(input.selectedTier);
	const includedStudents = Math.max(0, requestedStudentCount - extraStudentCount);
	const subtotalNaira = (discountedTier.oneTimeSetupNaira) + (discountedTier.perStudentPerTermNaira * includedStudents) + (Number(input.selectedTier.perStudentPerTermNaira || 0) * extraStudentCount);
	const discountNaira = Number(input.discountPercentage || 0) > 0 ? subtotalNaira * (Number(input.discountPercentage || 0) / 100) : 0;
	const totalNaira = Math.max(0, subtotalNaira - discountNaira);
	return {
		subtotalNaira,
		discountNaira,
		totalNaira,
	};
}

onboardingRouter.post('/register-school', async (req, res) => {
	const parsed = registerSchema.safeParse(req.body || {});
	if (!parsed.success) return res.status(400).json({ error: 'Invalid onboarding payload.' });
	const catalog = await getSchoolPricingCatalog();
	const selectedTier = catalog.schoolPricing.tiers.find((tier) => tier.key === String(parsed.data.pricingTierKey || '').trim()) || null;
	const requestedStudentCount = Number(parsed.data.requestedStudentCount || 0) || undefined;
	const includedMaxStudents = selectedTier?.maxStudents ?? requestedStudentCount ?? null;
	const extraStudentCount = selectedTier && requestedStudentCount && selectedTier.maxStudents !== null && requestedStudentCount > selectedTier.maxStudents
		? requestedStudentCount - selectedTier.maxStudents
		: 0;
	const extraStudentTermDeficitNaira = selectedTier && extraStudentCount > 0
		? extraStudentCount * Number(selectedTier.perStudentPerTermNaira || 0)
		: 0;
	const pricingSummary = calculateOnboardingAmounts({ selectedTier, requestedStudentCount, extraStudentCount });
	const request = await registerSchoolOnboardingRequest({
		...parsed.data,
		pricingTierKey: selectedTier?.key,
		pricingTierLabel: selectedTier?.label,
		includedStudentRange: selectedTier ? formatTierRange(selectedTier.minStudents, includedMaxStudents) : undefined,
		requestedStudentCount,
		extraStudentCount,
		extraStudentTermDeficitNaira,
		pricingSubtotalNaira: pricingSummary.subtotalNaira,
		pricingDiscountNaira: pricingSummary.discountNaira,
		pricingTotalNaira: pricingSummary.totalNaira,
	});
	return res.status(201).json({ ok: true, request, waitToken: request.waitToken });
});

onboardingRouter.post('/discount-code/validate', async (req, res) => {
	const parsed = discountCodeSchema.safeParse(req.body || {});
	if (!parsed.success) return res.status(400).json({ error: 'Discount code is required.' });
	const code = await validateDiscountCode(parsed.data.code, 'school-onboarding');
	if (!code) return res.status(404).json({ error: 'Discount code is invalid, expired, or inactive.' });
	return res.json({
		code: {
			id: code.id,
			code: code.code,
			description: code.description,
			percentageOff: code.percentageOff,
			validFrom: code.validFrom,
			expiresAt: code.expiresAt,
		},
	});
});

onboardingRouter.post('/:waitToken/payment', async (req, res) => {
	const parsed = paymentSchema.safeParse(req.body || {});
	if (!parsed.success) return res.status(400).json({ error: 'Invalid payment payload.' });
	try {
		const existing = await getOnboardingRequestByWaitToken(String(req.params.waitToken || '').trim());
		if (!existing) return res.status(404).json({ error: 'Onboarding request not found.' });
		const catalog = await getSchoolPricingCatalog();
		const selectedTier = catalog.schoolPricing.tiers.find((tier) => tier.key === String(existing.pricing_tier_key || '').trim()) || null;
		const discountCode = parsed.data.discountCode ? await validateDiscountCode(parsed.data.discountCode, 'school-onboarding') : null;
		const pricingSummary = calculateOnboardingAmounts({
			selectedTier,
			requestedStudentCount: existing.requested_student_count,
			extraStudentCount: existing.extra_student_count,
			discountPercentage: discountCode?.percentageOff,
		});
		const request = await recordOnboardingPayment(String(req.params.waitToken || '').trim(), parsed.data.paymentReference, {
			pricingSubtotalNaira: pricingSummary.subtotalNaira,
			pricingDiscountNaira: pricingSummary.discountNaira,
			pricingTotalNaira: pricingSummary.totalNaira,
			discountCode: discountCode?.code,
			discountPercentage: discountCode?.percentageOff,
		});
		if (discountCode) {
			await consumeDiscountCode(discountCode.id, null);
		}
		return res.json({ ok: true, request, token: req.params.waitToken });
	} catch (error) {
		const status = typeof error === 'object' && error && 'status' in error ? Number((error as { status?: number }).status) : 500;
		return res.status(status || 500).json({ error: error instanceof Error ? error.message : 'Payment update failed.' });
	}
});

onboardingRouter.get('/:waitToken/status', async (req, res) => {
	const request = await getOnboardingRequestByWaitToken(String(req.params.waitToken || '').trim());
	if (!request) return res.status(404).json({ error: 'Onboarding request not found.' });
	return res.json({ status: request.status, payment_status: request.payment_status, token: req.params.waitToken, request });
});