import { Router } from 'express';
import { z } from 'zod';

import { adjustAiCredits, consumeAiCredits, createAiCreditPurchaseIntent, fulfillAiCreditPurchase, getAiCreditBalanceForUser, listAiCreditLedger, listAiCreditLedgerForUser } from './credits.store.js';

export const creditsRouter = Router();

const purchaseIntentSchema = z.object({
	packageId: z.string().trim().min(1),
	ownerType: z.enum(['school', 'user']).optional(),
});

const consumeSchema = z.object({
	credits: z.number().int().positive(),
	featureKey: z.string().trim().min(1),
	ownerType: z.enum(['school', 'user']).optional(),
	referenceId: z.string().trim().optional(),
	metadata: z.record(z.string(), z.unknown()).optional(),
});

creditsRouter.get('/ai-credits/balance', async (req, res) => {
	const user = (req as any).user;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });
	return res.json(await getAiCreditBalanceForUser(user));
});

creditsRouter.get('/ai-credits/ledger', async (req, res) => {
	const user = (req as any).user;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });
	const ownerType = req.query.ownerType === 'user' ? 'user' : req.query.ownerType === 'school' ? 'school' : undefined;
	return res.json({ entries: await listAiCreditLedgerForUser(user, ownerType) });
});

creditsRouter.post('/ai-credits/purchase-intents', async (req, res) => {
	const user = (req as any).user;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });
	const parsed = purchaseIntentSchema.safeParse(req.body || {});
	if (!parsed.success) return res.status(400).json({ error: 'Invalid AI credit purchase payload.' });
	try {
		return res.status(201).json(await createAiCreditPurchaseIntent(user, parsed.data));
	} catch (error) {
		return res.status(404).json({ error: error instanceof Error ? error.message : 'AI credit purchase failed.' });
	}
});

creditsRouter.post('/ai-credits/consume', async (req, res) => {
	const user = (req as any).user;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });
	const parsed = consumeSchema.safeParse(req.body || {});
	if (!parsed.success) return res.status(400).json({ error: 'Invalid AI credit consume payload.' });
	try {
		return res.json(await consumeAiCredits(user, parsed.data));
	} catch (error) {
		return res.status(400).json({ error: error instanceof Error ? error.message : 'AI credit consume failed.' });
	}
});

export const creditsSuperRouter = Router();

const adjustSchema = z.object({
	schoolId: z.string().trim().min(1),
	ownerType: z.enum(['school', 'user']),
	ownerId: z.string().trim().min(1),
	creditsDelta: z.number().int().refine((value) => value !== 0, 'creditsDelta cannot be zero'),
	reason: z.string().trim().min(1),
	metadata: z.record(z.string(), z.unknown()).optional(),
});

creditsSuperRouter.post('/ai-credits/adjust', async (req, res) => {
	const parsed = adjustSchema.safeParse(req.body || {});
	if (!parsed.success) return res.status(400).json({ error: 'Invalid AI credit adjustment payload.' });
	const user = (req as any).superUser;
	try {
		return res.json(await adjustAiCredits({ ...parsed.data, createdBy: user?.id || null }));
	} catch (error) {
		return res.status(400).json({ error: error instanceof Error ? error.message : 'AI credit adjustment failed.' });
	}
});

creditsSuperRouter.get('/ai-credits/ledger', async (req, res) => {
	const schoolId = String(req.query.schoolId || '').trim();
	if (!schoolId) return res.status(400).json({ error: 'schoolId is required.' });
	const ownerType = req.query.ownerType === 'user' ? 'user' : req.query.ownerType === 'school' ? 'school' : undefined;
	return res.json({ entries: await listAiCreditLedger({ schoolId, ownerType, ownerId: String(req.query.ownerId || '').trim() || undefined }) });
});

creditsSuperRouter.post('/ai-credits/fulfill-purchase/:purchaseId', async (req, res) => {
	const user = (req as any).superUser;
	try {
		return res.json(await fulfillAiCreditPurchase(String(req.params.purchaseId || '').trim(), user?.id || null));
	} catch (error) {
		return res.status(404).json({ error: error instanceof Error ? error.message : 'AI credit purchase not found.' });
	}
});
