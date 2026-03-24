import { Router } from 'express';
import { buildMetrics, loadIdentityState } from '../../../../../identity-state.js';
import { buildDashboardSummaryForUser } from '../operations/schoolOps.store.js';

export const dashboardRouter = Router();

dashboardRouter.get('/summary', async (req, res) => {
	const user = (req as any).user;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });
	const state = await loadIdentityState();
	const summary = await buildDashboardSummaryForUser(user);
	return res.json({
		...summary,
		identity: buildMetrics(state),
	});
});