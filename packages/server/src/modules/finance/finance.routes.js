import { Router } from 'express';
import { mockData } from '../../common/mockData.js';
export const financeRouter = Router();
financeRouter.get('/stats', (_req, res) => res.json(mockData.financeStats));
financeRouter.get('/payroll/overview', (_req, res) => res.json({ total: 0, pending: 0 }));
