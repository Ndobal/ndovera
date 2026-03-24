import { Router } from 'express';
import { mockData } from '../../common/mockData.js';
export const messagingRouter = Router();
messagingRouter.get('/messages', (_req, res) => res.json({ messages: mockData.messages }));
messagingRouter.post('/messages', (req, res) => res.json({ ok: true, payload: req.body || {} }));
messagingRouter.get('/contacts', (_req, res) => res.json({ contacts: [] }));
messagingRouter.get('/thread', (_req, res) => res.json({ thread: [] }));
