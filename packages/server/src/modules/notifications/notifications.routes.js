import { Router } from 'express';
import { mockData } from '../../common/mockData.js';
export const notificationsRouter = Router();
notificationsRouter.get('/', (_req, res) => res.json({ notifications: mockData.notifications }));
notificationsRouter.post('/', (req, res) => res.json({ ok: true, payload: req.body || {} }));
notificationsRouter.put('/:id/read', (req, res) => res.json({ ok: true, id: req.params.id }));
