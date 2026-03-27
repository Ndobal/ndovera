import crypto from 'crypto';
import { Router } from 'express';
import { z } from 'zod';

import { createMarketplacePurchaseIntent, createSchoolTermSnapshot, generateSchoolInvoice, getInvoiceDetail, getSchoolInvoiceDetail, getSchoolPricingCatalog, issueInvoice, listInvoices, listSchoolInvoices, recordBillingWebhook, recordInvoicePayment, recordInvoicePaymentProof } from './billing.store.js';
import { validateDiscountCode } from './monetization.store.js';

export const billingRouter = Router();
export const billingWebhookRouter = Router();

const paymentProofSchema = z.object({
	proofUrl: z.string().trim().min(1),
	note: z.string().trim().max(500).optional(),
	providerName: z.string().trim().max(120).optional(),
	providerReference: z.string().trim().max(200).optional(),
	amountNaira: z.number().nonnegative().optional(),
});

const discountCodeValidationSchema = z.object({
	code: z.string().trim().min(1),
	scope: z.enum(['school-onboarding', 'marketplace', 'all']).optional(),
});

const marketplacePurchaseSchema = z.object({
	bundleId: z.string().trim().min(1),
	discountCode: z.string().trim().optional().or(z.literal('')),
});

billingRouter.get('/pricing', async (_req, res) => {
	return res.json(await getSchoolPricingCatalog());
});

billingRouter.post('/discount-codes/validate', async (req, res) => {
	const parsed = discountCodeValidationSchema.safeParse(req.body || {});
	if (!parsed.success) return res.status(400).json({ error: 'Invalid discount code payload.' });
	const scope = parsed.data.scope === 'all' ? 'all' : parsed.data.scope || 'school-onboarding';
	const code = await validateDiscountCode(parsed.data.code, scope);
	if (!code) return res.status(404).json({ error: 'Discount code is invalid, expired, or inactive.' });
	return res.json({
		code: {
			id: code.id,
			code: code.code,
			description: code.description,
			percentageOff: code.percentageOff,
			scope: code.scope,
			validFrom: code.validFrom,
			expiresAt: code.expiresAt,
		},
	});
});

billingRouter.get('/invoices', async (req, res) => {
	const user = (req as any).user;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });
	return res.json({ invoices: await listSchoolInvoices(user) });
});

billingRouter.get('/invoices/:invoiceId', async (req, res) => {
	const user = (req as any).user;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });
	const invoice = await getSchoolInvoiceDetail(user, String(req.params.invoiceId || '').trim());
	if (!invoice) return res.status(404).json({ error: 'Invoice not found.' });
	return res.json({ invoice });
});

billingRouter.post('/invoices/:invoiceId/payments/proof', async (req, res) => {
	const user = (req as any).user;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });
	const parsed = paymentProofSchema.safeParse(req.body || {});
	if (!parsed.success) return res.status(400).json({ error: 'Invalid payment proof payload.' });
	try {
		const invoice = await recordInvoicePaymentProof({
			invoiceId: String(req.params.invoiceId || '').trim(),
			schoolId: String(user.school_id || 'school-1').trim(),
			...parsed.data,
		});
		return res.status(201).json({ invoice });
	} catch (error) {
		return res.status(404).json({ error: error instanceof Error ? error.message : 'Payment proof failed.' });
	}
});

billingRouter.post('/marketplace/purchase-intents', async (req, res) => {
	const user = (req as any).user;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });
	const parsed = marketplacePurchaseSchema.safeParse(req.body || {});
	if (!parsed.success) return res.status(400).json({ error: 'Invalid marketplace purchase payload.' });
	try {
		return res.status(201).json(await createMarketplacePurchaseIntent(user, { bundleId: parsed.data.bundleId, discountCode: parsed.data.discountCode || null }));
	} catch (error) {
		return res.status(400).json({ error: error instanceof Error ? error.message : 'Marketplace purchase failed.' });
	}
});

export const billingSuperRouter = Router();

const snapshotSchema = z.object({
	schoolId: z.string().trim().min(1),
	academicYear: z.string().trim().min(1),
	termKey: z.string().trim().min(1),
	studentCount: z.number().int().nonnegative(),
	pricingTierKey: z.string().trim().optional(),
});

const invoiceGenerationSchema = snapshotSchema.extend({
	includeSetupFee: z.boolean().optional(),
});

const issueInvoiceSchema = z.object({
	dueAt: z.string().trim().optional(),
});

const adminPaymentSchema = z.object({
	providerName: z.string().trim().min(1),
	providerReference: z.string().trim().min(1),
	amountNaira: z.number().positive(),
	status: z.string().trim().optional(),
	receivedAt: z.string().trim().optional(),
	metadata: z.record(z.string(), z.unknown()).optional(),
});

const webhookSchema = z.object({
	providerEventId: z.string().trim().min(1),
	eventType: z.string().trim().min(1),
	eventStatus: z.string().trim().optional(),
	payload: z.record(z.string(), z.unknown()).default({}),
	invoiceId: z.string().trim().optional(),
	providerReference: z.string().trim().optional(),
	amountNaira: z.number().nonnegative().optional(),
	schoolId: z.string().trim().optional(),
});

function paystackSecret() {
	return String(process.env.PAYSTACK_SECRET_KEY || process.env.PAYSTACK_SECRET || '').trim();
}

function normalizeProviderName(value: string) {
	return String(value || '').trim().toLowerCase();
}

function mapPaystackWebhook(body: Record<string, unknown>) {
	const eventType = String(body.event || '').trim() || 'paystack.event';
	const data = typeof body.data === 'object' && body.data ? body.data as Record<string, unknown> : {};
	const metadata = typeof data.metadata === 'object' && data.metadata ? data.metadata as Record<string, unknown> : {};
	const reference = String(data.reference || metadata.providerReference || metadata.reference || '').trim();
	const invoiceId = String(metadata.invoiceId || metadata.invoice_id || '').trim() || undefined;
	const schoolId = String(metadata.schoolId || metadata.school_id || '').trim() || undefined;
	const amountRaw = Number(data.amount || metadata.amount || 0);
	const amountNaira = amountRaw > 0 ? amountRaw / 100 : undefined;
	const providerEventId = String(data.id || reference || `${eventType}_${crypto.randomUUID()}`).trim();
	const eventStatus = String(data.status || body.status || '').trim() || 'received';
	return {
		providerEventId,
		eventType,
		eventStatus,
		payload: body,
		invoiceId,
		providerReference: reference || undefined,
		amountNaira,
		schoolId,
	};
}

billingWebhookRouter.post('/payments/webhooks/:providerName', async (req, res, next) => {
	const providerName = normalizeProviderName(String(req.params.providerName || ''));
	if (providerName !== 'paystack') return next();
	const secret = paystackSecret();
	if (!secret) return res.status(500).json({ error: 'PAYSTACK secret is not configured.' });
	const signature = String(req.headers['x-paystack-signature'] || '').trim();
	const rawBody = String((req as any).rawBody || '');
	if (!signature || !rawBody) return res.status(400).json({ error: 'Missing Paystack signature payload.' });
	const expected = crypto.createHmac('sha512', secret).update(rawBody).digest('hex');
	const valid = signature.length === expected.length && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
	if (!valid) return res.status(401).json({ error: 'Invalid Paystack signature.' });
	const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
	const event = await recordBillingWebhook('paystack', mapPaystackWebhook(body));
	return res.status(201).json({ ok: true, event });
});

billingSuperRouter.post('/school-term-snapshots', async (req, res) => {
	const parsed = snapshotSchema.safeParse(req.body || {});
	if (!parsed.success) return res.status(400).json({ error: 'Invalid school term snapshot payload.' });
	const user = (req as any).superUser;
	return res.status(201).json({ snapshot: await createSchoolTermSnapshot({ ...parsed.data, capturedBy: user?.id || null }) });
});

billingSuperRouter.post('/invoices/generate', async (req, res) => {
	const parsed = invoiceGenerationSchema.safeParse(req.body || {});
	if (!parsed.success) return res.status(400).json({ error: 'Invalid invoice generation payload.' });
	const user = (req as any).superUser;
	return res.status(201).json({ invoice: await generateSchoolInvoice({ ...parsed.data, createdBy: user?.id || null }) });
});

billingSuperRouter.get('/invoices', async (req, res) => {
	return res.json({ invoices: await listInvoices({ schoolId: String(req.query.schoolId || '').trim() || undefined, status: String(req.query.status || '').trim() || undefined }) });
});

billingSuperRouter.get('/invoices/:invoiceId', async (req, res) => {
	const invoice = await getInvoiceDetail(String(req.params.invoiceId || '').trim());
	if (!invoice) return res.status(404).json({ error: 'Invoice not found.' });
	return res.json({ invoice });
});

billingSuperRouter.post('/invoices/:invoiceId/issue', async (req, res) => {
	const parsed = issueInvoiceSchema.safeParse(req.body || {});
	if (!parsed.success) return res.status(400).json({ error: 'Invalid invoice issue payload.' });
	try {
		return res.json({ invoice: await issueInvoice(String(req.params.invoiceId || '').trim(), parsed.data.dueAt) });
	} catch (error) {
		return res.status(404).json({ error: error instanceof Error ? error.message : 'Invoice not found.' });
	}
});

billingSuperRouter.post('/invoices/:invoiceId/record-payment', async (req, res) => {
	const parsed = adminPaymentSchema.safeParse(req.body || {});
	if (!parsed.success) return res.status(400).json({ error: 'Invalid invoice payment payload.' });
	try {
		return res.json({ invoice: await recordInvoicePayment({ invoiceId: String(req.params.invoiceId || '').trim(), ...parsed.data }) });
	} catch (error) {
		return res.status(404).json({ error: error instanceof Error ? error.message : 'Invoice not found.' });
	}
});

billingSuperRouter.post('/payments/webhooks/:providerName', async (req, res) => {
	const parsed = webhookSchema.safeParse(req.body || {});
	if (!parsed.success) return res.status(400).json({ error: 'Invalid billing webhook payload.' });
	return res.status(201).json({ event: await recordBillingWebhook(String(req.params.providerName || '').trim(), parsed.data) });
});
