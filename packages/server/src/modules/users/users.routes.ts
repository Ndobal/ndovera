import { Router } from 'express';
import { z } from 'zod';
import { assignRoleToUser, buildMetrics, isIdentityUserActive, listIdentityLifecycleEvents, listIdentityUsers, loadIdentityState, provisionUser, updateIdentityUser } from '../../../../../identity-state.js';
import { requireRoles } from '../../../rbac.js';
import { applyGlobalPolicyForUser, createOwnedSchoolForUser, getAccessibleSchoolContext, listGlobalPoliciesForUser, rollbackGlobalPolicyForUser, userHasOwnerPrivileges } from '../ownership/ownership.store.js';
import { getSchoolProfile } from '../schools/schoolProfile.store.js';
import { getAssignmentForUser, upsertAssignmentForUser } from './userAssignments.store.js';
import { getUserProfileById, getUserProfileTemplate, toPublicUserProfile, updateUserProfileForUser } from './userProfile.store.js';

export const usersRouter = Router();

const provisionSchema = z.object({
	category: z.enum(['student', 'staff', 'parent', 'admin']),
	schoolId: z.string().trim().min(1).optional(),
	schoolName: z.string().trim().min(2).optional(),
	name: z.string().trim().min(2),
	email: z.string().trim().email().optional().or(z.literal('')),
	password: z.string().min(6).optional(),
	roles: z.array(z.string().trim().min(1)).optional(),
	classId: z.string().trim().optional(),
	className: z.string().trim().optional(),
	subjectIds: z.array(z.string().trim().min(1)).optional(),
});

const headRoleSchema = z.object({
	userId: z.string().trim().min(1),
	role: z.enum(['HoS', 'Nursery Head', 'Head Teacher', 'Junior School Principal', 'Principal', 'Head of Section', 'Sectional Head']),
});

const profileSchema = z.object({
	avatarUrl: z.string().trim().max(500).optional(),
	statusText: z.string().trim().max(280).optional(),
	statusAvailability: z.enum(['available', 'busy', 'away', 'offline']).optional(),
	ndoveraEmail: z.string().trim().max(160).optional(),
	alternateEmail: z.string().trim().max(160).optional(),
	phone: z.string().trim().max(40).optional(),
	gender: z.string().trim().max(40).optional(),
	dateOfBirth: z.string().trim().max(40).optional(),
	address: z.string().trim().max(200).optional(),
	city: z.string().trim().max(80).optional(),
	state: z.string().trim().max(80).optional(),
	country: z.string().trim().max(80).optional(),
	nationality: z.string().trim().max(80).optional(),
	bio: z.string().trim().max(1200).optional(),
	emergencyContactName: z.string().trim().max(120).optional(),
	emergencyContactPhone: z.string().trim().max(40).optional(),
	occupation: z.string().trim().max(120).optional(),
	department: z.string().trim().max(120).optional(),
	employeeId: z.string().trim().max(80).optional(),
	admissionNumber: z.string().trim().max(80).optional(),
	className: z.string().trim().max(120).optional(),
	guardianName: z.string().trim().max(120).optional(),
	guardianPhone: z.string().trim().max(40).optional(),
	skills: z.array(z.string().trim().min(1).max(80)).max(30).optional(),
	preferences: z.record(z.string(), z.unknown()).optional(),
});

const lifecycleStatusSchema = z.object({
	status: z.enum(['active', 'inactive']),
	reason: z.string().trim().max(280).optional().or(z.literal('')),
});

const assignmentSchema = z.object({
	classId: z.string().trim().optional().or(z.literal('')),
	className: z.string().trim().optional().or(z.literal('')),
	subjectIds: z.array(z.string().trim().min(1)).optional(),
});

const ownedSchoolCreateSchema = z.object({
	schoolName: z.string().trim().min(2).max(120),
	subdomain: z.string().trim().min(2).max(40).regex(/^[a-z0-9-]+$/),
	schoolId: z.string().trim().min(2).max(80).optional(),
});

const globalPolicySchema = z.object({
	policyType: z.enum(['attendance', 'grading', 'finance', 'discipline', 'academic calendar']),
	targetSchoolIds: z.array(z.string().trim().min(1)).max(50).optional(),
	payload: z.record(z.unknown()),
	note: z.string().trim().max(280).optional().or(z.literal('')),
});

const rollbackPolicySchema = z.object({
	reason: z.string().trim().max(280).optional().or(z.literal('')),
});

function normalizeRoleName(value?: string) {
	return String(value || '').trim().toLowerCase();
}

function canAssignRole(actorRole: string, targetRole: string) {
	const normalizedActor = normalizeRoleName(actorRole);
	const normalizedTarget = normalizeRoleName(targetRole);
	if (normalizedTarget === 'hos') {
		return ['owner', 'tenant school owner', 'admin', 'super admin'].includes(normalizedActor);
	}
	return ['hos', 'owner', 'tenant school owner', 'admin', 'super admin'].includes(normalizedActor);
}

function isSchoolAccessible(user: any, schoolId: string) {
	const accessible = Array.isArray(user?.accessible_school_ids) ? user.accessible_school_ids.map((entry: unknown) => String(entry)) : [];
	return accessible.includes(schoolId);
}

async function buildSchoolSwitcherPayload(user: any) {
	const { accessibleSchools, ownerAccount } = await getAccessibleSchoolContext(user);
	const schools = await Promise.all(accessibleSchools.map(async (school) => {
		const profile = await getSchoolProfile(school.id).catch(() => null);
		return {
			id: school.id,
			name: school.name,
			subdomain: school.subdomain,
			accessLevel: school.accessLevel,
			logoUrl: profile?.logoUrl || null,
			websiteUrl: profile?.websiteUrl || null,
			primaryColor: profile?.primaryColor || '#0f766e',
		};
	}));
	return { schools, ownerAccount };
}

usersRouter.get('/me', (req, res) => {
	const user = (req as any).user;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });
 return loadIdentityState().then((state) => {
  const school = state.schools.find((entry) => entry.id === user.school_id) || null;
	 const identityUser = state.users.find((entry) => entry.id === user.id) || null;
	 if (identityUser && !isIdentityUserActive(identityUser)) {
		 return res.status(403).json({ error: 'This account has been deactivated. Contact your school administrator.' });
	 }
	return Promise.all([
		Promise.resolve(school ? getSchoolProfile(school.id) : null),
		buildSchoolSwitcherPayload(user),
	]).then(([profile, switcher]) => {
	 return getUserProfileById(user.id, identityUser).then((userProfile) => {
		const publicProfile = toPublicUserProfile(userProfile);
	 return res.json({
		...user,
		ndoveraId: user.id,
		schoolId: user.school_id,
		baseSchoolId: user.base_school_id || user.school_id,
		activeSchoolId: user.effective_school_id || user.school_id,
		schoolName: school?.name || null,
		alternateEmail: userProfile.alternateEmail || null,
		avatarUrl: publicProfile.avatarUrl,
		statusText: publicProfile.statusText,
		statusAvailability: publicProfile.statusAvailability,
		statusUpdatedAt: publicProfile.statusUpdatedAt,
		school: school ? {
	id: school.id,
	name: school.name,
	logoUrl: profile?.logoUrl || null,
	websiteUrl: profile?.websiteUrl || null,
	primaryColor: profile?.primaryColor || '#0f766e',
		} : null,
		accessibleSchools: switcher.schools,
		ownerAccount: switcher.ownerAccount,
	 });
	 });
	});
 }).catch(() => {
  return res.json({
   ...user,
   ndoveraId: user.id,
   schoolId: user.school_id,
		baseSchoolId: user.base_school_id || user.school_id,
		activeSchoolId: user.effective_school_id || user.school_id,
   schoolName: null,
   alternateEmail: null,
   avatarUrl: null,
   statusText: null,
   statusAvailability: 'available',
   statusUpdatedAt: null,
   school: null,
		accessibleSchools: [],
		ownerAccount: null,
  });
 });
});

usersRouter.get('/me/profile', async (req, res) => {
	const user = (req as any).user;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });
	const state = await loadIdentityState();
	const identityUser = state.users.find((entry) => entry.id === user.id) || null;
	if (identityUser && !isIdentityUserActive(identityUser)) {
		return res.status(403).json({ error: 'This account has been deactivated. Contact your school administrator.' });
	}
	const school = state.schools.find((entry) => entry.id === user.school_id) || null;
	const schoolProfile = school ? await getSchoolProfile(school.id) : null;
	const switcher = await buildSchoolSwitcherPayload(user);
	const profile = await getUserProfileById(user.id, identityUser);
	return res.json({
		user: {
			...user,
			ndoveraId: user.id,
			schoolId: user.school_id,
			baseSchoolId: user.base_school_id || user.school_id,
			activeSchoolId: user.effective_school_id || user.school_id,
			schoolName: school?.name || null,
			alternateEmail: profile.alternateEmail || null,
			avatarUrl: profile.avatarUrl || null,
			statusText: profile.statusText || null,
			statusAvailability: profile.statusAvailability,
			statusUpdatedAt: profile.statusUpdatedAt,
			school: school ? {
				id: school.id,
				name: school.name,
				logoUrl: schoolProfile?.logoUrl || null,
				websiteUrl: schoolProfile?.websiteUrl || null,
				primaryColor: schoolProfile?.primaryColor || '#0f766e',
			} : null,
				accessibleSchools: switcher.schools,
				ownerAccount: switcher.ownerAccount,
		},
		profile,
		template: getUserProfileTemplate(),
	});
});

usersRouter.put('/me/profile', async (req, res) => {
	const user = (req as any).user;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });
	const parsed = profileSchema.safeParse(req.body || {});
	if (!parsed.success) {
		return res.status(400).json({ error: 'Invalid profile payload.' });
	}
	const state = await loadIdentityState();
	const identityUser = state.users.find((entry) => entry.id === user.id) || null;
	if (identityUser && !isIdentityUserActive(identityUser)) {
		return res.status(403).json({ error: 'This account has been deactivated. Contact your school administrator.' });
	}
	const profile = await updateUserProfileForUser(user, parsed.data, identityUser);
	return res.json({
		ok: true,
		profile,
		publicProfile: toPublicUserProfile(profile),
	});
});

usersRouter.get('/', (req, res) => {
	const user = (req as any).user;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });
	return res.json({ users: [user] });
});

usersRouter.get('/metrics', async (req, res) => {
	const user = (req as any).user;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });
	const state = await loadIdentityState();
	const metrics = buildMetrics(state);
	return res.json({
		currentSchool: metrics.schools.find((school) => school.id === user.school_id) || null,
		...metrics,
	});
});

usersRouter.get('/owner/policies', async (req, res) => {
	const user = (req as any).user;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });
	if (!userHasOwnerPrivileges(user)) return res.status(403).json({ error: 'Only school owners can access policy controls.' });
	const payload = await listGlobalPoliciesForUser(user);
	return res.json(payload);
});

usersRouter.post('/owner/policies', async (req, res) => {
	const user = (req as any).user;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });
	if (!userHasOwnerPrivileges(user)) return res.status(403).json({ error: 'Only school owners can apply global policies.' });
	const parsed = globalPolicySchema.safeParse(req.body || {});
	if (!parsed.success) return res.status(400).json({ error: 'Invalid global policy payload.' });
	try {
		const result = await applyGlobalPolicyForUser(user, {
			policyType: parsed.data.policyType,
			targetSchoolIds: parsed.data.targetSchoolIds,
			payload: parsed.data.payload,
			note: parsed.data.note || null,
		});
		return res.status(201).json(result);
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unable to apply the global policy.';
		const code = typeof error === 'object' && error && 'code' in error ? String((error as any).code) : '';
		return res.status(code.includes('UPGRADE') ? 402 : 400).json({ error: message });
	}
});

usersRouter.post('/owner/policies/:policyId/rollback', async (req, res) => {
	const user = (req as any).user;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });
	if (!userHasOwnerPrivileges(user)) return res.status(403).json({ error: 'Only school owners can roll back global policies.' });
	const policyId = String(req.params.policyId || '').trim();
	if (!policyId) return res.status(400).json({ error: 'policyId is required.' });
	const parsed = rollbackPolicySchema.safeParse(req.body || {});
	if (!parsed.success) return res.status(400).json({ error: 'Invalid rollback payload.' });
	try {
		const result = await rollbackGlobalPolicyForUser(user, policyId, parsed.data.reason || null);
		return res.json(result);
	} catch (error) {
		return res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to roll back this policy.' });
	}
});

usersRouter.post('/owned-schools', async (req, res) => {
	const user = (req as any).user;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });
	if (!userHasOwnerPrivileges(user)) return res.status(403).json({ error: 'Only school owners can add another school.' });
	const parsed = ownedSchoolCreateSchema.safeParse(req.body || {});
	if (!parsed.success) return res.status(400).json({ error: 'Invalid school creation payload.' });
	try {
		const result = await createOwnedSchoolForUser(user, parsed.data);
		const profile = await getSchoolProfile(result.school.id).catch(() => null);
		return res.status(201).json({
			school: {
				id: result.school.id,
				name: result.school.name,
				subdomain: result.school.subdomain,
				logoUrl: profile?.logoUrl || null,
				websiteUrl: profile?.websiteUrl || null,
				primaryColor: profile?.primaryColor || '#0f766e',
			},
			ownerAccount: result.ownerAccount,
			accessibleSchools: result.accessibleSchools,
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unable to create the school.';
		const code = typeof error === 'object' && error && 'code' in error ? String((error as any).code) : '';
		return res.status(code === 'OWNER_TIER_LIMIT_REACHED' ? 402 : 400).json({ error: message });
	}
});

usersRouter.get('/directory', requireRoles('HoS', 'Admin', 'Super Admin', 'Owner', 'Tenant School Owner'), async (req, res) => {
	const user = (req as any).user;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });
	const state = await loadIdentityState();
	const schoolId = String(req.query.schoolId || user.school_id || '').trim();
	if (schoolId && !isSchoolAccessible(user, schoolId)) {
		return res.status(403).json({ error: 'Selected school is not available for this account.' });
	}
	const includeInactive = String(req.query.includeInactive || '').trim() === '1';
	const scopedUsers = listIdentityUsers(state, schoolId, includeInactive);
	const students = schoolId ? state.students.filter((item) => item.schoolId === schoolId) : state.students;
	return res.json({
		schoolId,
		includeInactive,
		users: scopedUsers,
		students,
		assignments: await Promise.all(scopedUsers.map(async (entry) => getAssignmentForUser(entry.id, entry.schoolId))),
		lifecycleEvents: listIdentityLifecycleEvents(state, { schoolId, limit: 120 }),
	});
});

usersRouter.patch('/:userId/status', requireRoles('HoS', 'Admin', 'Super Admin', 'Owner', 'Tenant School Owner'), async (req, res) => {
	const actor = (req as any).user;
	if (!actor) return res.status(401).json({ error: 'Unauthenticated' });
	const userId = String(req.params.userId || '').trim();
	if (!userId) return res.status(400).json({ error: 'userId is required.' });
	const parsed = lifecycleStatusSchema.safeParse(req.body || {});
	if (!parsed.success) return res.status(400).json({ error: 'Invalid status payload.' });
	if (userId === actor.id && parsed.data.status === 'inactive') {
		return res.status(400).json({ error: 'You cannot deactivate your own account.' });
	}
	const state = await loadIdentityState();
	const targetUser = state.users.find((entry) => entry.id === userId && entry.schoolId === actor.school_id);
	if (!targetUser) return res.status(404).json({ error: 'Selected user was not found in your school.' });
	try {
		const result = await updateIdentityUser(state, {
			userId,
			schoolId: actor.school_id,
			status: parsed.data.status,
			auditActorId: actor.id,
			auditActorName: actor.name || actor.email || actor.id,
			auditActorRole: actor.activeRole || actor.roles?.[0] || undefined,
			auditReason: parsed.data.reason || undefined,
		});
		return res.json(result);
	} catch (error) {
		return res.status(400).json({ error: error instanceof Error ? error.message : 'Status update failed.' });
	}
});

usersRouter.post('/:userId/assignment', requireRoles('HoS', 'Admin', 'Super Admin', 'Owner', 'Tenant School Owner'), async (req, res) => {
	const actor = (req as any).user;
	if (!actor) return res.status(401).json({ error: 'Unauthenticated' });
	const userId = String(req.params.userId || '').trim();
	if (!userId) return res.status(400).json({ error: 'userId is required.' });
	const parsed = assignmentSchema.safeParse(req.body || {});
	if (!parsed.success) return res.status(400).json({ error: 'Invalid assignment payload.' });
	const state = await loadIdentityState();
	const targetUser = state.users.find((entry) => entry.id === userId && entry.schoolId === actor.school_id);
	if (!targetUser) return res.status(404).json({ error: 'Selected user was not found in your school.' });
	const assignment = await upsertAssignmentForUser({
		userId,
		schoolId: String(actor.school_id || '').trim(),
		classId: parsed.data.classId,
		className: parsed.data.className,
		subjectIds: parsed.data.subjectIds,
	});
	return res.json({ ok: true, assignment });
});

usersRouter.post('/assign-head-role', requireRoles('HoS', 'Admin', 'Super Admin', 'Owner', 'Tenant School Owner'), async (req, res) => {
	const user = (req as any).user;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });

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
		if (!isSchoolAccessible(user, schoolId)) {
			return res.status(403).json({ error: 'Selected school is not available for this account.' });
		}
		const result = await assignRoleToUser(state, {
			targetUserId: parsed.data.userId,
			schoolId,
			role: parsed.data.role,
			makeActive: true,
			uniquePerSchool: true,
		});
		return res.json(result);
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unable to assign head role.';
		return res.status(400).json({ error: message });
	}
});

usersRouter.post('/provision', requireRoles('HoS', 'Admin', 'Super Admin', 'Owner', 'Tenant School Owner'), async (req, res) => {
	const user = (req as any).user;
	if (!user) return res.status(401).json({ error: 'Unauthenticated' });
	const parsed = provisionSchema.safeParse(req.body || {});
	if (!parsed.success) {
		return res.status(400).json({ error: 'Invalid user payload.' });
	}
	const state = await loadIdentityState();
	const schoolId = parsed.data.schoolId || user.school_id || 'school-1';
	if (schoolId && !isSchoolAccessible(user, schoolId)) {
		return res.status(403).json({ error: 'Selected school is not available for this account.' });
	}
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
	await upsertAssignmentForUser({
		userId: result.user.id,
		schoolId,
		classId: parsed.data.classId,
		className: parsed.data.className,
		subjectIds: parsed.data.subjectIds,
	});
	return res.status(201).json(result);
});
