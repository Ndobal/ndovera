import { Router } from 'express';
import { z } from 'zod';

import { getSchoolPricingCatalog } from '../finance/billing.store.js';
import { consumeDiscountCode, getTierDiscountedAmounts, validateDiscountCode } from '../finance/monetization.store.js';
import { createFlutterwaveCheckout, flutterwaveEnabled, verifyFlutterwaveTransaction } from './flutterwave.js';
import { getOnboardingRequestByWaitToken, recordOnboardingPayment, registerSchoolOnboardingRequest, updateOnboardingRequestById } from './onboarding.store.js';

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
	if (minStudents === 0 && maxStudents === 0) return 'Custom pricing';
	return maxStudents === null ? `${minStudents}+ learners` : `${minStudents} to ${maxStudents} learners`;
}

const paymentSchema = z.object({
	paymentReference: z.string().trim().optional(),
	discountCode: z.string().trim().optional().or(z.literal('')),
});

const discountCodeSchema = z.object({
	code: z.string().trim().optional(),
	discountCode: z.string().trim().optional(),
	pricingTierKey: z.string().trim().optional(),
	requestedStudentCount: z.number().int().nonnegative().optional(),
});

const checkoutSchema = z.object({
	discountCode: z.string().trim().optional().or(z.literal('')),
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
	const discountedTier = getTierDiscountedAmounts(input.selectedTier);
	const subtotalNaira = discountedTier.oneTimeSetupNaira;
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
	const extraStudentCount = 0;
	const extraStudentTermDeficitNaira = 0;
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
	const codeText = String(parsed.data.discountCode || parsed.data.code || '').trim();
	if (!codeText) return res.status(400).json({ error: 'Discount code is required.' });
	const catalog = await getSchoolPricingCatalog();
	const selectedTier = catalog.schoolPricing.tiers.find((tier) => tier.key === String(parsed.data.pricingTierKey || '').trim()) || null;
	const code = await validateDiscountCode(codeText, 'school-onboarding');
	if (!code) return res.status(404).json({ error: 'Discount code is invalid, expired, or inactive.' });
	const pricing = calculateOnboardingAmounts({
		selectedTier,
		requestedStudentCount: parsed.data.requestedStudentCount,
		discountPercentage: code.percentageOff,
	});
	return res.json({
		discountCode: {
			id: code.id,
			code: code.code,
			description: code.description,
			percentageOff: code.percentageOff,
			validFrom: code.validFrom,
			expiresAt: code.expiresAt,
		},
		pricing: {
			subtotalNaira: pricing.subtotalNaira,
			discountAmountNaira: pricing.discountNaira,
			finalAmountNaira: pricing.totalNaira,
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

onboardingRouter.post('/:waitToken/checkout', async (req, res) => {
	const parsed = checkoutSchema.safeParse(req.body || {});
	if (!parsed.success) return res.status(400).json({ error: 'Invalid checkout payload.' });
	if (!flutterwaveEnabled()) return res.status(503).json({ error: 'Flutterwave is not configured.' });
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
		const txRef = `ndv_onb_${existing.id}_${Date.now()}`;
		const checkoutUrl = await createFlutterwaveCheckout({
			txRef,
			amountNaira: pricingSummary.totalNaira,
			customerName: existing.owner_name,
			customerEmail: existing.owner_ndovera_email,
			schoolName: existing.school_name,
			waitToken: existing.waitToken,
		});
		const request = await recordOnboardingPayment(existing.waitToken, existing.payment_reference, {
			pricingSubtotalNaira: pricingSummary.subtotalNaira,
			pricingDiscountNaira: pricingSummary.discountNaira,
			pricingTotalNaira: pricingSummary.totalNaira,
			discountCode: discountCode?.code,
			discountPercentage: discountCode?.percentageOff,
			flutterwaveTxRef: txRef,
			flutterwaveCheckoutUrl: checkoutUrl,
			flutterwaveStatus: 'pending',
		});
		return res.json({ ok: true, checkoutUrl, txRef, request });
	} catch (error) {
		return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to start checkout.' });
	}
});

onboardingRouter.post('/:waitToken/payment/verify', async (req, res) => {
	const waitToken = String(req.params.waitToken || '').trim();
	const transactionId = String(req.body?.transactionId || req.body?.transaction_id || '').trim();
	if (!waitToken || !transactionId) return res.status(400).json({ error: 'waitToken and transactionId are required.' });
	try {
		const existing = await getOnboardingRequestByWaitToken(waitToken);
		if (!existing) return res.status(404).json({ error: 'Onboarding request not found.' });
		const verified = await verifyFlutterwaveTransaction(transactionId);
		const txRef = String(verified?.tx_ref || '');
		if (existing.flutterwave_tx_ref && txRef && existing.flutterwave_tx_ref !== txRef) {
			return res.status(400).json({ error: 'Verified transaction does not match this onboarding request.' });
		}
		const status = String(verified?.status || '').toLowerCase();
		if (status !== 'successful') {
			await updateOnboardingRequestById(existing.id, {
				flutterwave_status: status || 'failed',
				payment_status: 'failed',
			});
			return res.status(400).json({ error: 'Payment is not successful yet.' });
		}
		const request = await updateOnboardingRequestById(existing.id, {
			payment_status: 'verified',
			status: existing.status === 'approved' ? 'approved' : 'payment-received',
			payment_reference: String(verified?.flw_ref || verified?.id || existing.payment_reference || '').trim() || existing.payment_reference,
			flutterwave_status: status,
			payment_verified_at: new Date().toISOString(),
		});
		return res.json({ ok: true, request });
	} catch (error) {
		return res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to verify payment.' });
	}
});

onboardingRouter.get('/:waitToken/status', async (req, res) => {
	const request = await getOnboardingRequestByWaitToken(String(req.params.waitToken || '').trim());
	if (!request) return res.status(404).json({ error: 'Onboarding request not found.' });
	return res.json({ status: request.status, payment_status: request.payment_status, token: req.params.waitToken, request });
});
