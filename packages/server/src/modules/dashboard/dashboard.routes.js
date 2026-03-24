import { Router } from 'express';
import { mockData } from '../../common/mockData.js';
import { buildMetrics, loadIdentityState } from '../../../../../identity-state.js';
export const dashboardRouter = Router();
dashboardRouter.get('/summary', async (_req, res) => {
    const state = await loadIdentityState();
    return res.json({
        ...mockData.dashboardSummary,
        identity: buildMetrics(state),
    });
});
