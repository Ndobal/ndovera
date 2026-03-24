import { Router } from 'express';
import { z } from 'zod';

import { getMessagingConnectionCount, publishMessagingEvent, publishMessagingEventToUsers, subscribeMessagingEvents } from './messaging.events.js';
import { getMessagingSettingsForUser, updateMessagingSettingsForUser } from '../operations/schoolOps.store.js';
import { getMessagingContactsForUser, getMessagingThreadForUser, getTypingStatusForUser, getRelevantPresenceAudienceForUser, lookupMessagingContactForUser, publishTypingStatusForUser, searchMessagingContactsForUser, sendMessagingThreadMessageForUser, setMessagingPresenceForUser } from './messaging.store.js';

export const messagingRouter = Router();

const settingsSchema = z.object({ allowStudentPeerMessaging: z.boolean() });
const threadMessageSchema = z.object({ peerId: z.string().trim().min(1), text: z.string().trim().min(1) });
const typingSchema = z.object({ peerId: z.string().trim().min(1), isTyping: z.boolean() });

messagingRouter.get('/settings', async (req, res) => {
	const user = (req as any).user;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });
	return res.json(await getMessagingSettingsForUser(user));
});

messagingRouter.post('/settings', async (req, res) => {
	const user = (req as any).user;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });
	const parsed = settingsSchema.safeParse(req.body || {});
	if (!parsed.success) return res.status(400).json({ error: 'Invalid messaging settings payload.' });
	return res.json(await updateMessagingSettingsForUser(user, parsed.data));
});

messagingRouter.get('/contacts', async (req, res) => {
	const user = (req as any).user;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });
	return res.json(await getMessagingContactsForUser(user));
});

messagingRouter.get('/stream', async (req, res) => {
	const user = (req as any).user;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });

	res.setHeader('Content-Type', 'text/event-stream');
	res.setHeader('Cache-Control', 'no-cache, no-transform');
	res.setHeader('Connection', 'keep-alive');
	res.setHeader('X-Accel-Buffering', 'no');
	res.flushHeaders?.();

	const send = (event: { type: string; [key: string]: unknown }) => {
		res.write(`event: ${event.type}\n`);
		res.write(`data: ${JSON.stringify(event)}\n\n`);
	};

	const subscription = subscribeMessagingEvents(user.id, send);
	const timestamp = new Date().toISOString();
	if (subscription.connectionCount === 1) {
		await setMessagingPresenceForUser(user.id, true);
		publishMessagingEventToUsers(await getRelevantPresenceAudienceForUser(user.id), { type: 'contacts_changed', timestamp, reason: 'presence' });
	}
	send({ type: 'connected', timestamp });

	const heartbeatId = setInterval(() => {
		res.write(': keepalive\n\n');
	}, 25000);

	const closeStream = () => {
		clearInterval(heartbeatId);
		subscription.unsubscribe();
		if (getMessagingConnectionCount(user.id) === 0) {
			void setMessagingPresenceForUser(user.id, false).then(() => {
				void getRelevantPresenceAudienceForUser(user.id).then((audience) => {
					publishMessagingEventToUsers(audience, { type: 'contacts_changed', timestamp: new Date().toISOString(), reason: 'presence' });
				});
			}).catch(() => undefined);
		}
	};

	req.on('close', closeStream);
});

messagingRouter.get('/lookup', async (req, res) => {
	const user = (req as any).user;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });
	const query = String(req.query.query || '').trim();
	if (!query) return res.status(400).json({ error: 'query is required.' });
	try {
		return res.json(await lookupMessagingContactForUser(user, query));
	} catch (error) {
		const status = typeof error === 'object' && error && 'status' in error ? Number((error as { status?: number }).status) : 400;
		return res.status(status || 400).json({ error: error instanceof Error ? error.message : 'Unable to resolve chat contact.' });
	}
});

messagingRouter.get('/search', async (req, res) => {
	const user = (req as any).user;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });
	const query = String(req.query.query || '').trim();
	if (!query) return res.status(400).json({ error: 'query is required.' });
	try {
		return res.json(await searchMessagingContactsForUser(user, query));
	} catch (error) {
		const status = typeof error === 'object' && error && 'status' in error ? Number((error as { status?: number }).status) : 400;
		return res.status(status || 400).json({ error: error instanceof Error ? error.message : 'Unable to search chat contacts.' });
	}
});

messagingRouter.get('/thread', async (req, res) => {
	const user = (req as any).user;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });
	const peerId = String(req.query.peerId || '').trim();
	if (!peerId) return res.status(400).json({ error: 'peerId is required.' });
	try {
		const result = await getMessagingThreadForUser(user, peerId);
		if (result.markedRead && peerId !== 'helpdesk') {
			publishMessagingEvent(peerId, { type: 'thread_changed', timestamp: new Date().toISOString(), peerId: user.id });
		}
		return res.json(result.messages);
	} catch (error) {
		const status = typeof error === 'object' && error && 'status' in error ? Number((error as { status?: number }).status) : 400;
		return res.status(status || 400).json({ error: error instanceof Error ? error.message : 'Unable to load chat thread.' });
	}
});

messagingRouter.post('/thread', async (req, res) => {
	const user = (req as any).user;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });
	const parsed = threadMessageSchema.safeParse(req.body || {});
	if (!parsed.success) return res.status(400).json({ error: 'Invalid thread payload.' });
	try {
		const response = await sendMessagingThreadMessageForUser(user, parsed.data.peerId, parsed.data.text);
		const timestamp = new Date().toISOString();
		publishMessagingEvent(user.id, { type: 'thread_changed', timestamp, peerId: parsed.data.peerId });
		if (parsed.data.peerId !== 'helpdesk') {
			publishMessagingEvent(parsed.data.peerId, { type: 'thread_changed', timestamp, peerId: user.id });
		}
		return res.json(response);
	} catch (error) {
		const status = typeof error === 'object' && error && 'status' in error ? Number((error as { status?: number }).status) : 400;
		return res.status(status || 400).json({ error: error instanceof Error ? error.message : 'Unable to send chat message.' });
	}
});

messagingRouter.get('/typing', async (req, res) => {
	const user = (req as any).user;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });
	const peerId = String(req.query.peerId || '').trim();
	if (!peerId) return res.status(400).json({ error: 'peerId is required.' });
	try {
		return res.json(await getTypingStatusForUser(user, peerId));
	} catch (error) {
		const status = typeof error === 'object' && error && 'status' in error ? Number((error as { status?: number }).status) : 400;
		return res.status(status || 400).json({ error: error instanceof Error ? error.message : 'Unable to load typing state.' });
	}
});

messagingRouter.post('/typing', async (req, res) => {
	const user = (req as any).user;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });
	const parsed = typingSchema.safeParse(req.body || {});
	if (!parsed.success) return res.status(400).json({ error: 'Invalid typing payload.' });
	try {
		const response = await publishTypingStatusForUser(user, parsed.data.peerId, parsed.data.isTyping);
		if (parsed.data.peerId !== 'helpdesk') {
			publishMessagingEvent(parsed.data.peerId, {
				type: 'typing_changed',
				timestamp: new Date().toISOString(),
				peerId: user.id,
				isTyping: parsed.data.isTyping,
			});
		}
		return res.json(response);
	} catch (error) {
		const status = typeof error === 'object' && error && 'status' in error ? Number((error as { status?: number }).status) : 400;
		return res.status(status || 400).json({ error: error instanceof Error ? error.message : 'Unable to update typing state.' });
	}
});