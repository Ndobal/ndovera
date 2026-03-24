import { Router } from 'express';
import { z } from 'zod';

import { listAdConsentRecords, listAdConsentRecordsForUser, listAdEvents, recordAdConsent, reprocessAdEvents } from './adCompliance.store.js';

export const adComplianceRouter = Router();

const consentSchema = z.object({
	consentScope: z.string().trim().min(1),
	consentStatus: z.enum(['granted', 'denied', 'withdrawn']),
	policyVersion: z.string().trim().min(1),
	lawfulBasis: z.string().trim().min(1),
	expiresAt: z.string().trim().optional(),
	metadata: z.record(z.string(), z.unknown()).optional(),
});

adComplianceRouter.post('/ads/consent', async (req, res) => {
	const user = (req as any).user;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });
	const parsed = consentSchema.safeParse(req.body || {});
	if (!parsed.success) return res.status(400).json({ error: 'Invalid ad consent payload.' });
	return res.status(201).json({ consent: await recordAdConsent(user, parsed.data) });
});

adComplianceRouter.get('/ads/consent', async (req, res) => {
	const user = (req as any).user;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });
	return res.json({ records: await listAdConsentRecordsForUser(user) });
});

export const adComplianceSuperRouter = Router();

const reprocessSchema = z.object({
	impressionIds: z.array(z.string().trim().min(1)).min(1),
	retentionUntil: z.string().trim().optional(),
});

adComplianceSuperRouter.get('/ads/events', async (req, res) => {
	return res.json({ events: await listAdEvents({ schoolId: String(req.query.schoolId || '').trim() || undefined, impressionStatus: String(req.query.impressionStatus || '').trim() || undefined }) });
});

adComplianceSuperRouter.get('/ads/consent-audit', async (req, res) => {
	return res.json({ records: await listAdConsentRecords({ schoolId: String(req.query.schoolId || '').trim() || undefined, userId: String(req.query.userId || '').trim() || undefined }) });
});

adComplianceSuperRouter.post('/ads/reprocess', async (req, res) => {
	const parsed = reprocessSchema.safeParse(req.body || {});
	if (!parsed.success) return res.status(400).json({ error: 'Invalid ad reprocess payload.' });
	return res.json({ receipts: await reprocessAdEvents(parsed.data) });
});
