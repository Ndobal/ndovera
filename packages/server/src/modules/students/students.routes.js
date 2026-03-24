import { Router } from 'express';
import { requireRoles } from '../../../rbac.js';
import { buildMetrics, loadIdentityState, transferStudent } from '../../../../../identity-state.js';
export const studentsRouter = Router();
studentsRouter.get('/metrics', async (req, res) => {
    const user = req.user;
    if (!user)
        return res.status(401).json({ error: 'Unauthenticated' });
    const state = await loadIdentityState();
    const metrics = buildMetrics(state);
    return res.json({
        school: metrics.schools.find((school) => school.id === user.school_id) || null,
        ...metrics,
    });
});
studentsRouter.post('/:studentId/transfer', requireRoles('HoS', 'Admin', 'Super Admin'), async (req, res) => {
    const user = req.user;
    if (!user)
        return res.status(401).json({ error: 'Unauthenticated' });
    const studentId = String(req.params.studentId || '').trim();
    const targetSchoolId = String(req.body?.targetSchoolId || '').trim();
    const reason = String(req.body?.reason || '').trim() || undefined;
    if (!studentId || !targetSchoolId) {
        return res.status(400).json({ error: 'studentId and targetSchoolId are required.' });
    }
    try {
        const state = await loadIdentityState();
        const result = await transferStudent(state, studentId, targetSchoolId, reason, user.id);
        return res.json({ ok: true, ...result });
    }
    catch (error) {
        return res.status(400).json({ error: error instanceof Error ? error.message : 'Transfer failed.' });
    }
});
