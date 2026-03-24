import { Router } from 'express';
import { z } from 'zod';

import { requireRoles } from '../../../rbac.js';
import { recordAdEventReceipt } from './adCompliance.store.js';
import { acknowledgeUserPriceIncreaseNotice, getFocusModeStatus, getUserPriceIncreaseNotices, recordAdImpressionForMonitoring, recordFocusModeActivity, startFocusModeSession, stopFocusModeSession } from './monetization.store.js';

export const monetizationRouter = Router();

const startSchema = z.object({
	sourcePage: z.string().trim().max(120).optional(),
});

const pingSchema = z.object({
	sessionId: z.string().trim().min(1),
	eventType: z.string().trim().max(80).optional(),
	sourcePage: z.string().trim().max(120).optional(),
	lessonId: z.string().trim().max(120).optional(),
	assessmentId: z.string().trim().max(120).optional(),
	studentId: z.string().trim().max(120).optional(),
	metadata: z.record(z.string(), z.unknown()).optional(),
});

const stopSchema = z.object({
	sessionId: z.string().trim().min(1),
});

const adImpressionSchema = z.object({
	pageKey: z.string().trim().min(1),
	placementKey: z.string().trim().min(1),
	focusSessionId: z.string().trim().optional(),
	networkName: z.string().trim().optional(),
	successful: z.boolean().optional(),
	providerImpressionId: z.string().trim().optional(),
	requestFingerprint: z.string().trim().optional(),
	consentRecordId: z.string().trim().optional(),
	retentionUntil: z.string().trim().optional(),
	metadata: z.record(z.string(), z.unknown()).optional(),
});

const noticeAckSchema = z.object({
	noticeId: z.string().trim().min(1),
	action: z.enum(['dismiss', 'agree']),
});

monetizationRouter.get('/price-increase-notices', async (req, res) => {
	const user = (req as any).user;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });
	return res.json({ notices: await getUserPriceIncreaseNotices(user) });
});

monetizationRouter.post('/price-increase-notices/acknowledge', async (req, res) => {
	const user = (req as any).user;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });
	const parsed = noticeAckSchema.safeParse(req.body || {});
	if (!parsed.success) return res.status(400).json({ error: 'Invalid price increase acknowledgement payload.' });
	return res.json({ notices: await acknowledgeUserPriceIncreaseNotice(user, parsed.data) });
});

monetizationRouter.get('/focus-mode/status', async (req, res) => {
	const user = (req as any).user;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });
	return res.json(await getFocusModeStatus(user));
});

monetizationRouter.post('/focus-mode/session/start', requireRoles('Teacher', 'Staff', 'Educator', 'HoS', 'School Admin', 'Principal', 'Head Teacher', 'Nursery Head'), async (req, res) => {
	const user = (req as any).user;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });
	const parsed = startSchema.safeParse(req.body || {});
	if (!parsed.success) return res.status(400).json({ error: 'Invalid focus mode start payload.' });
	return res.status(201).json(await startFocusModeSession(user, parsed.data));
});

monetizationRouter.post('/focus-mode/session/ping', requireRoles('Teacher', 'Staff', 'Educator', 'HoS', 'School Admin', 'Principal', 'Head Teacher', 'Nursery Head'), async (req, res) => {
	const user = (req as any).user;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });
	const parsed = pingSchema.safeParse(req.body || {});
	if (!parsed.success) return res.status(400).json({ error: 'Invalid focus mode activity payload.' });
	return res.json(await recordFocusModeActivity(user, parsed.data));
});

monetizationRouter.post('/focus-mode/session/stop', requireRoles('Teacher', 'Staff', 'Educator', 'HoS', 'School Admin', 'Principal', 'Head Teacher', 'Nursery Head'), async (req, res) => {
	const user = (req as any).user;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });
	const parsed = stopSchema.safeParse(req.body || {});
	if (!parsed.success) return res.status(400).json({ error: 'Invalid focus mode stop payload.' });
	return res.json(await stopFocusModeSession(user, parsed.data.sessionId));
});

monetizationRouter.post('/ads/impressions', requireRoles('Teacher', 'Staff', 'Educator', 'HoS', 'School Admin', 'Principal', 'Head Teacher', 'Nursery Head'), async (req, res) => {
	const user = (req as any).user;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });
	const parsed = adImpressionSchema.safeParse(req.body || {});
	if (!parsed.success) return res.status(400).json({ error: 'Invalid ad impression payload.' });
	const result = await recordAdImpressionForMonitoring(user, parsed.data);
	const receipt = await recordAdEventReceipt({
		impressionEventId: result.eventId,
		providerName: String(parsed.data.networkName || 'adsense').trim() || 'adsense',
		providerImpressionId: parsed.data.providerImpressionId,
		requestFingerprint: parsed.data.requestFingerprint,
		consentRecordId: parsed.data.consentRecordId,
		retentionUntil: parsed.data.retentionUntil,
	});
	return res.status(201).json({ ok: true, impressionId: result.eventId, receiptId: receipt.id });
});