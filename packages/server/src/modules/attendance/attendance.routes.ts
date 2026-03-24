import { Router } from 'express';

export const attendanceRouter = Router();

attendanceRouter.get('/staff', (_req, res) => res.json({ attendance: [] }));
attendanceRouter.get('/parent', (_req, res) => res.json({ attendance: [] }));
attendanceRouter.post('/mark', (req, res) => res.json({ ok: true, payload: req.body || {} }));
attendanceRouter.post('/staff/mark', (req, res) => res.json({ ok: true, payload: req.body || {} }));
attendanceRouter.post('/parent/mark', (req, res) => res.json({ ok: true, payload: req.body || {} }));