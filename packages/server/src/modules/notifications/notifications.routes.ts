import { Router } from 'express';
import { z } from 'zod';

import { createNotificationBroadcast, listNotificationsForUser, markNotificationReadForUser } from '../operations/schoolOps.store.js';

export const notificationsRouter = Router();

const broadcastSchema = z.object({ message: z.string().trim().min(1), targetRole: z.string().trim().optional() });

notificationsRouter.get('/', async (req, res) => {
	const user = (req as any).user;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });
	return res.json(await listNotificationsForUser(user));
});

notificationsRouter.post('/', async (req, res) => {
	const user = (req as any).user;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });
	const parsed = broadcastSchema.safeParse(req.body || {});
	if (!parsed.success) return res.status(400).json({ error: 'Invalid notification payload.' });
	return res.status(201).json(await createNotificationBroadcast(user, parsed.data.message, parsed.data.targetRole));
});

notificationsRouter.put('/:id/read', async (req, res) => {
	const user = (req as any).user;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });
	return res.json(await markNotificationReadForUser(user, String(req.params.id || '').trim()));
});