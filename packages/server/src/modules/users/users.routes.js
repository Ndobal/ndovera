import { Router } from 'express';
import { z } from 'zod';
import { assignRoleToUser, buildMetrics, loadIdentityState, provisionUser } from '../../../../../identity-state.js';
import { requireRoles } from '../../../rbac.js';
export const usersRouter = Router();
const provisionSchema = z.object({
    category: z.enum(['student', 'staff', 'parent', 'admin']),
    schoolId: z.string().trim().min(1).optional(),
    schoolName: z.string().trim().min(2).optional(),
    name: z.string().trim().min(2),
    email: z.string().trim().email().optional().or(z.literal('')),
    password: z.string().min(6).optional(),
    roles: z.array(z.string().trim().min(1)).optional(),
});
const headRoleSchema = z.object({
    userId: z.string().trim().min(1),
    role: z.enum(['HoS', 'Nursery Head', 'Head Teacher', 'Junior School Principal', 'Principal', 'Head of Section', 'Sectional Head']),
});
function normalizeRoleName(value) {
    return String(value || '').trim().toLowerCase();
}
function canAssignRole(actorRole, targetRole) {
    const normalizedActor = normalizeRoleName(actorRole);
    const normalizedTarget = normalizeRoleName(targetRole);
    if (normalizedTarget === 'hos') {
        return ['owner', 'tenant school owner', 'admin', 'super admin'].includes(normalizedActor);
    }
    return ['hos', 'owner', 'tenant school owner', 'admin', 'super admin'].includes(normalizedActor);
}
usersRouter.get('/me', (req, res) => {
    const user = req.user;
    if (!user)
        return res.status(401).json({ error: 'Unauthenticated' });
    return res.json(user);
});
usersRouter.get('/', (req, res) => {
    const user = req.user;
    if (!user)
        return res.status(401).json({ error: 'Unauthenticated' });
    return res.json({ users: [user] });
});
usersRouter.get('/metrics', async (req, res) => {
    const user = req.user;
    if (!user)
        return res.status(401).json({ error: 'Unauthenticated' });
    const state = await loadIdentityState();
    const metrics = buildMetrics(state);
    return res.json({
        currentSchool: metrics.schools.find((school) => school.id === user.school_id) || null,
        ...metrics,
    });
});
usersRouter.get('/directory', requireRoles('HoS', 'Admin', 'Super Admin', 'Owner', 'Tenant School Owner'), async (req, res) => {
    const user = req.user;
    if (!user)
        return res.status(401).json({ error: 'Unauthenticated' });
    const state = await loadIdentityState();
    const schoolId = String(req.query.schoolId || user.school_id || '').trim();
    const scopedUsers = schoolId ? state.users.filter((item) => item.schoolId === schoolId) : state.users;
    const students = schoolId ? state.students.filter((item) => item.schoolId === schoolId) : state.students;
    return res.json({
        schoolId,
        users: scopedUsers,
        students,
    });
});
usersRouter.post('/assign-head-role', requireRoles('HoS', 'Admin', 'Super Admin', 'Owner', 'Tenant School Owner'), async (req, res) => {
    const user = req.user;
    if (!user)
        return res.status(401).json({ error: 'Unauthenticated' });
    const parsed = headRoleSchema.safeParse(req.body || {});
    if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid head appointment payload.' });
    }
    const actorRole = String(user.activeRole || user.roles?.[0] || '').trim();
    if (!canAssignRole(actorRole, parsed.data.role)) {
        return res.status(403).json({ error: parsed.data.role === 'HoS' ? 'Only an owner or platform admin can appoint the Head of School.' : 'Your current role cannot appoint that sectional head.' });
    }
    try {
        const state = await loadIdentityState();
        const schoolId = String(user.school_id || 'school-1').trim();
        const result = await assignRoleToUser(state, {
            targetUserId: parsed.data.userId,
            schoolId,
            role: parsed.data.role,
            makeActive: true,
            uniquePerSchool: true,
        });
        return res.json(result);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to assign head role.';
        return res.status(400).json({ error: message });
    }
});
usersRouter.post('/provision', requireRoles('HoS', 'Admin', 'Super Admin'), async (req, res) => {
    const user = req.user;
    if (!user)
        return res.status(401).json({ error: 'Unauthenticated' });
    const parsed = provisionSchema.safeParse(req.body || {});
    if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid user payload.' });
    }
    const state = await loadIdentityState();
    const schoolId = parsed.data.schoolId || user.school_id || 'school-1';
    const schoolName = parsed.data.schoolName || state.schools.find((school) => school.id === schoolId)?.name || 'Ndovera Academy';
    const result = await provisionUser(state, {
        category: parsed.data.category,
        schoolId,
        schoolName,
        name: parsed.data.name,
        email: parsed.data.email || null,
        password: parsed.data.password,
        roles: parsed.data.roles,
    });
    return res.status(201).json(result);
});
