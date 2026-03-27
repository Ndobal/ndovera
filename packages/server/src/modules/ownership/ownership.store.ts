import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

import { ensureSchool, loadIdentityState, saveIdentityState } from '../../../../../identity-state.js';
import type { SchoolRecord } from '../../../../../identity-state.js';
import type { User } from '../../../rbac.js';

export type OwnerTier = 'growth' | 'pro' | 'enterprise';
export type PolicyControlLevel = 'none' | 'limited' | 'full';
export type GlobalPolicyType = 'attendance' | 'grading' | 'finance' | 'discipline' | 'academic calendar';
export type OwnerAccessLevel = 'member' | 'owner';

export type OwnerAccountRecord = {
	id: string;
	ownerUserId: string;
	ownerEmail: string | null;
	ownerName: string;
	tier: OwnerTier;
	extraSchoolSlots: number;
	createdAt: string;
	updatedAt: string;
};

export type SchoolOwnershipRecord = {
	id: string;
	ownerAccountId: string;
	schoolId: string;
	schoolName: string;
	linkedAt: string;
};

export type GlobalPolicyRecord = {
	id: string;
	ownerAccountId: string;
	policyType: GlobalPolicyType;
	targetSchoolIds: string[];
	payload: Record<string, unknown>;
	status: 'active' | 'rolled_back';
	appliedByUserId: string;
	appliedByName: string;
	note: string | null;
	createdAt: string;
	rolledBackAt: string | null;
	rolledBackByUserId: string | null;
	rollbackReason: string | null;
};

export type PolicyAuditRecord = {
	id: string;
	ownerAccountId: string;
	policyId: string;
	action: 'applied' | 'rolled_back';
	actorUserId: string;
	actorName: string;
	actorRole: string | null;
	targetSchoolIds: string[];
	policyType: GlobalPolicyType;
	note: string | null;
	createdAt: string;
};

export type OwnershipState = {
	ownerAccounts: OwnerAccountRecord[];
	schoolOwnerships: SchoolOwnershipRecord[];
	globalPolicies: GlobalPolicyRecord[];
	policyAudits: PolicyAuditRecord[];
};

export type AccessibleSchoolRecord = SchoolRecord & {
	accessLevel: OwnerAccessLevel;
	ownerAccountId?: string;
};

export type OwnerAccountSummary = {
	id: string;
	tier: OwnerTier;
	policyControl: PolicyControlLevel;
	maxSchools: number | null;
	allowedSchoolCount: number | null;
	extraSchoolSlots: number;
	ownedSchoolCount: number;
	canAddSchools: boolean;
	upgradeRequired: boolean;
	ownerName: string;
	ownerEmail: string | null;
};

export type CreateOwnedSchoolInput = {
	schoolName: string;
	subdomain: string;
	schoolId?: string;
};

export type ApplyGlobalPolicyInput = {
	policyType: GlobalPolicyType;
	targetSchoolIds?: string[];
	payload: Record<string, unknown>;
	note?: string | null;
};

const REPO_ROOT = path.resolve(process.cwd(), '..', '..');
const OWNERSHIP_STATE_PATH = path.resolve(process.env.NDOVERA_OWNERSHIP_STATE_PATH || path.join(REPO_ROOT, 'ndovera-ownership.json'));
const OWNER_ROLES = new Set(['owner', 'tenant school owner']);
const PRO_POLICY_TYPES = new Set<GlobalPolicyType>(['attendance', 'grading', 'finance']);

function nowIso() {
	return new Date().toISOString();
}

function defaultOwnershipState(): OwnershipState {
	return {
		ownerAccounts: [],
		schoolOwnerships: [],
		globalPolicies: [],
		policyAudits: [],
	};
}

function trimOrNull(value: unknown) {
	const normalized = String(value || '').trim();
	return normalized ? normalized : null;
}

function normalizeTier(value: unknown): OwnerTier {
	const normalized = String(value || '').trim().toLowerCase();
	if (normalized === 'pro') return 'pro';
	if (normalized === 'enterprise') return 'enterprise';
	return 'growth';
}

function normalizePolicyType(value: unknown): GlobalPolicyType {
	const normalized = String(value || '').trim().toLowerCase();
	if (normalized === 'attendance') return 'attendance';
	if (normalized === 'grading') return 'grading';
	if (normalized === 'finance') return 'finance';
	if (normalized === 'discipline') return 'discipline';
	return 'academic calendar';
}

function ensureDirectory() {
	fs.mkdirSync(path.dirname(OWNERSHIP_STATE_PATH), { recursive: true });
}

function ensureOwnershipStateShape(raw: Partial<OwnershipState> | null | undefined): OwnershipState {
	const state = defaultOwnershipState();
	if (!raw) return state;
	if (Array.isArray(raw.ownerAccounts)) {
		state.ownerAccounts = raw.ownerAccounts.map((entry) => ({
			id: String(entry.id),
			ownerUserId: String(entry.ownerUserId),
			ownerEmail: trimOrNull(entry.ownerEmail),
			ownerName: String(entry.ownerName || 'School Owner'),
			tier: normalizeTier(entry.tier),
			extraSchoolSlots: Number(entry.extraSchoolSlots || 0) || 0,
			createdAt: String(entry.createdAt || nowIso()),
			updatedAt: String(entry.updatedAt || nowIso()),
		}));
	}
	if (Array.isArray(raw.schoolOwnerships)) {
		state.schoolOwnerships = raw.schoolOwnerships.map((entry) => ({
			id: String(entry.id),
			ownerAccountId: String(entry.ownerAccountId),
			schoolId: String(entry.schoolId),
			schoolName: String(entry.schoolName || ''),
			linkedAt: String(entry.linkedAt || nowIso()),
		}));
	}
	if (Array.isArray(raw.globalPolicies)) {
		state.globalPolicies = raw.globalPolicies.map((entry) => ({
			id: String(entry.id),
			ownerAccountId: String(entry.ownerAccountId),
			policyType: normalizePolicyType(entry.policyType),
			targetSchoolIds: Array.isArray(entry.targetSchoolIds) ? entry.targetSchoolIds.map((schoolId) => String(schoolId)) : [],
			payload: entry.payload && typeof entry.payload === 'object' ? entry.payload as Record<string, unknown> : {},
			status: entry.status === 'rolled_back' ? 'rolled_back' : 'active',
			appliedByUserId: String(entry.appliedByUserId || ''),
			appliedByName: String(entry.appliedByName || 'School Owner'),
			note: trimOrNull(entry.note),
			createdAt: String(entry.createdAt || nowIso()),
			rolledBackAt: trimOrNull(entry.rolledBackAt),
			rolledBackByUserId: trimOrNull(entry.rolledBackByUserId),
			rollbackReason: trimOrNull(entry.rollbackReason),
		}));
	}
	if (Array.isArray(raw.policyAudits)) {
		state.policyAudits = raw.policyAudits.map((entry) => ({
			id: String(entry.id),
			ownerAccountId: String(entry.ownerAccountId),
			policyId: String(entry.policyId),
			action: entry.action === 'rolled_back' ? 'rolled_back' : 'applied',
			actorUserId: String(entry.actorUserId || ''),
			actorName: String(entry.actorName || 'School Owner'),
			actorRole: trimOrNull(entry.actorRole),
			targetSchoolIds: Array.isArray(entry.targetSchoolIds) ? entry.targetSchoolIds.map((schoolId) => String(schoolId)) : [],
			policyType: normalizePolicyType(entry.policyType),
			note: trimOrNull(entry.note),
			createdAt: String(entry.createdAt || nowIso()),
		}));
	}
	return state;
}

export async function loadOwnershipState(): Promise<OwnershipState> {
	try {
		ensureDirectory();
		if (!fs.existsSync(OWNERSHIP_STATE_PATH)) {
			const empty = defaultOwnershipState();
			fs.writeFileSync(OWNERSHIP_STATE_PATH, JSON.stringify(empty, null, 2));
			return empty;
		}
		const parsed = JSON.parse(fs.readFileSync(OWNERSHIP_STATE_PATH, 'utf8')) as Partial<OwnershipState>;
		return ensureOwnershipStateShape(parsed);
	} catch {
		return defaultOwnershipState();
	}
}

export async function saveOwnershipState(state: OwnershipState) {
	ensureDirectory();
	fs.writeFileSync(OWNERSHIP_STATE_PATH, JSON.stringify(state, null, 2));
}

export function userHasOwnerPrivileges(user: Pick<User, 'roles'> | undefined) {
	if (!user) return false;
	return user.roles.some((role) => OWNER_ROLES.has(String(role || '').trim().toLowerCase()));
}

export function getOwnerTierConfig(tier: OwnerTier) {
	if (tier === 'enterprise') {
		return { maxSchools: null, policyControl: 'full' as PolicyControlLevel };
	}
	if (tier === 'pro') {
		return { maxSchools: 3, policyControl: 'limited' as PolicyControlLevel };
	}
	return { maxSchools: 1, policyControl: 'none' as PolicyControlLevel };
}

function ensureOwnerAccountRecord(state: OwnershipState, user: Pick<User, 'id' | 'name' | 'email' | 'school_id' | 'roles'>) {
	let account = state.ownerAccounts.find((entry) => entry.ownerUserId === user.id);
	let changed = false;
	if (!account && userHasOwnerPrivileges(user)) {
		const timestamp = nowIso();
		account = {
			id: crypto.randomUUID(),
			ownerUserId: user.id,
			ownerEmail: trimOrNull(user.email),
			ownerName: String(user.name || user.email || user.id),
			tier: 'growth',
			extraSchoolSlots: 0,
			createdAt: timestamp,
			updatedAt: timestamp,
		};
		state.ownerAccounts.push(account);
		changed = true;
	}
	if (account) {
		const nextName = String(user.name || user.email || user.id);
		const nextEmail = trimOrNull(user.email);
		if (account.ownerName !== nextName || account.ownerEmail !== nextEmail) {
			account.ownerName = nextName;
			account.ownerEmail = nextEmail;
			account.updatedAt = nowIso();
			changed = true;
		}
		if (user.school_id) {
			const existingOwnership = state.schoolOwnerships.find((entry) => entry.ownerAccountId === account.id && entry.schoolId === user.school_id);
			if (!existingOwnership) {
				state.schoolOwnerships.push({
					id: crypto.randomUUID(),
					ownerAccountId: account.id,
					schoolId: user.school_id,
					schoolName: '',
					linkedAt: nowIso(),
				});
				account.updatedAt = nowIso();
				changed = true;
			}
		}
	}
	return { account: account || null, changed };
}

export async function syncOwnerAccountForUser(user: Pick<User, 'id' | 'name' | 'email' | 'school_id' | 'roles'>) {
	const state = await loadOwnershipState();
	const { account, changed } = ensureOwnerAccountRecord(state, user);
	if (changed) await saveOwnershipState(state);
	return { state, account };
}

export function listOwnedSchoolLinks(state: OwnershipState, ownerAccountId: string) {
	return state.schoolOwnerships.filter((entry) => entry.ownerAccountId === ownerAccountId);
}

export function summarizeOwnerAccount(state: OwnershipState, account: OwnerAccountRecord | null): OwnerAccountSummary | null {
	if (!account) return null;
	const tierConfig = getOwnerTierConfig(account.tier);
	const ownedSchoolCount = listOwnedSchoolLinks(state, account.id).length;
	const allowedSchoolCount = tierConfig.maxSchools === null ? null : tierConfig.maxSchools + account.extraSchoolSlots;
	const canAddSchools = allowedSchoolCount === null ? true : ownedSchoolCount < allowedSchoolCount;
	return {
		id: account.id,
		tier: account.tier,
		policyControl: tierConfig.policyControl,
		maxSchools: tierConfig.maxSchools,
		allowedSchoolCount,
		extraSchoolSlots: account.extraSchoolSlots,
		ownedSchoolCount,
		canAddSchools,
		upgradeRequired: !canAddSchools,
		ownerName: account.ownerName,
		ownerEmail: account.ownerEmail,
	};
	}

export function listAccessibleSchools(identityState: Awaited<ReturnType<typeof loadIdentityState>> extends infer T ? T : never, ownershipState: OwnershipState, user: Pick<User, 'id' | 'school_id'>): AccessibleSchoolRecord[] {
	const map = new Map<string, AccessibleSchoolRecord>();
	const primarySchool = identityState.schools.find((school) => school.id === user.school_id);
	if (primarySchool) {
		map.set(primarySchool.id, { ...primarySchool, accessLevel: 'member' });
	}
	const account = ownershipState.ownerAccounts.find((entry) => entry.ownerUserId === user.id);
	if (!account) return Array.from(map.values());
	for (const ownership of listOwnedSchoolLinks(ownershipState, account.id)) {
		const school = identityState.schools.find((entry) => entry.id === ownership.schoolId);
		if (!school) continue;
		map.set(school.id, {
			...school,
			accessLevel: 'owner',
			ownerAccountId: account.id,
		});
	}
	return Array.from(map.values()).sort((left, right) => left.name.localeCompare(right.name));
}

export async function getAccessibleSchoolContext(user: Pick<User, 'id' | 'name' | 'email' | 'school_id' | 'roles'>) {
	const identityState = await loadIdentityState();
	const { state: ownershipState, account } = await syncOwnerAccountForUser(user);
	for (const ownership of ownershipState.schoolOwnerships) {
		const school = identityState.schools.find((entry) => entry.id === ownership.schoolId);
		if (school && ownership.schoolName !== school.name) {
			ownership.schoolName = school.name;
		}
	}
	await saveOwnershipState(ownershipState);
	return {
		identityState,
		ownershipState,
		account,
		accessibleSchools: listAccessibleSchools(identityState, ownershipState, user),
		ownerAccount: summarizeOwnerAccount(ownershipState, account),
	};
	}

function makeSchoolIdFromSubdomain(subdomain: string) {
	const normalized = String(subdomain || '').trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
	return normalized || `school-${crypto.randomUUID().slice(0, 8)}`;
}

export async function createOwnedSchoolForUser(user: Pick<User, 'id' | 'name' | 'email' | 'school_id' | 'roles'>, input: CreateOwnedSchoolInput) {
	if (!userHasOwnerPrivileges(user)) {
		throw new Error('Only a school owner can add another school.');
	}
	const schoolName = String(input.schoolName || '').trim();
	const subdomain = String(input.subdomain || '').trim().toLowerCase();
	if (!schoolName || schoolName.length < 2) throw new Error('School name is required.');
	if (!subdomain || !/^[a-z0-9-]{2,40}$/.test(subdomain)) throw new Error('Subdomain must be 2-40 characters using letters, numbers, or hyphens only.');

	const { identityState, ownershipState, account } = await getAccessibleSchoolContext(user);
	if (!account) throw new Error('Owner account could not be initialized.');
	const summary = summarizeOwnerAccount(ownershipState, account);
	if (!summary?.canAddSchools) {
		const error = new Error('Your current plan has reached its school limit. Upgrade your owner tier or purchase an additional school slot to continue.');
		(error as Error & { code?: string }).code = 'OWNER_TIER_LIMIT_REACHED';
		throw error;
	}

	const schoolId = trimOrNull(input.schoolId) || makeSchoolIdFromSubdomain(subdomain);
	if (identityState.schools.some((school) => school.id === schoolId && school.name !== schoolName)) {
		throw new Error('A school with this id already exists.');
	}
	if (identityState.schools.some((school) => school.subdomain.toLowerCase() === subdomain && school.id !== schoolId)) {
		throw new Error('A school with this subdomain already exists.');
	}

	const school = ensureSchool(identityState, schoolId, schoolName, subdomain);
	school.name = schoolName;
	school.subdomain = subdomain;
	await saveIdentityState(identityState);

	if (!ownershipState.schoolOwnerships.some((entry) => entry.ownerAccountId === account.id && entry.schoolId === school.id)) {
		ownershipState.schoolOwnerships.push({
			id: crypto.randomUUID(),
			ownerAccountId: account.id,
			schoolId: school.id,
			schoolName: school.name,
			linkedAt: nowIso(),
		});
		account.updatedAt = nowIso();
		await saveOwnershipState(ownershipState);
	}

	return {
		school,
		ownerAccount: summarizeOwnerAccount(ownershipState, account),
		accessibleSchools: listAccessibleSchools(identityState, ownershipState, user),
	};
	}

export async function applyGlobalPolicyForUser(user: Pick<User, 'id' | 'name' | 'email' | 'school_id' | 'roles' | 'activeRole'>, input: ApplyGlobalPolicyInput) {
	const { identityState, ownershipState, account, accessibleSchools, ownerAccount } = await getAccessibleSchoolContext(user);
	if (!account || !ownerAccount) throw new Error('Only school owners can apply global policies.');
	if (ownerAccount.policyControl === 'none') {
		const error = new Error('Your current tier does not include cross-school policy controls.');
		(error as Error & { code?: string }).code = 'OWNER_POLICY_UPGRADE_REQUIRED';
		throw error;
	}
	const policyType = normalizePolicyType(input.policyType);
	if (ownerAccount.policyControl === 'limited' && !PRO_POLICY_TYPES.has(policyType)) {
		throw new Error('Your current tier allows attendance, grading, and finance policies only.');
	}
	const targetSchoolIds = (input.targetSchoolIds?.length ? input.targetSchoolIds : accessibleSchools.filter((school) => school.accessLevel === 'owner').map((school) => school.id))
		.filter((schoolId, index, list) => Boolean(schoolId) && list.indexOf(schoolId) === index);
	if (!targetSchoolIds.length) throw new Error('Select at least one owned school.');
	const accessibleIds = new Set(accessibleSchools.filter((school) => school.accessLevel === 'owner').map((school) => school.id));
	for (const schoolId of targetSchoolIds) {
		if (!accessibleIds.has(schoolId)) throw new Error('One or more selected schools are not owned by this account.');
		if (!identityState.schools.some((school) => school.id === schoolId)) throw new Error('One or more selected schools could not be found.');
	}
	const timestamp = nowIso();
	const record: GlobalPolicyRecord = {
		id: crypto.randomUUID(),
		ownerAccountId: account.id,
		policyType,
		targetSchoolIds,
		payload: input.payload && typeof input.payload === 'object' ? input.payload : {},
		status: 'active',
		appliedByUserId: user.id,
		appliedByName: String(user.name || user.email || user.id),
		note: trimOrNull(input.note),
		createdAt: timestamp,
		rolledBackAt: null,
		rolledBackByUserId: null,
		rollbackReason: null,
	};
	ownershipState.globalPolicies.unshift(record);
	ownershipState.policyAudits.unshift({
		id: crypto.randomUUID(),
		ownerAccountId: account.id,
		policyId: record.id,
		action: 'applied',
		actorUserId: user.id,
		actorName: String(user.name || user.email || user.id),
		actorRole: trimOrNull(user.activeRole || user.roles[0]),
		targetSchoolIds,
		policyType,
		note: trimOrNull(input.note),
		createdAt: timestamp,
	});
	await saveOwnershipState(ownershipState);
	return { policy: record, ownerAccount };
	}

export async function rollbackGlobalPolicyForUser(user: Pick<User, 'id' | 'name' | 'email' | 'school_id' | 'roles' | 'activeRole'>, policyId: string, reason?: string | null) {
	const { ownershipState, account, ownerAccount } = await getAccessibleSchoolContext(user);
	if (!account || !ownerAccount) throw new Error('Only school owners can roll back global policies.');
	const policy = ownershipState.globalPolicies.find((entry) => entry.id === policyId && entry.ownerAccountId === account.id);
	if (!policy) throw new Error('Global policy not found.');
	if (policy.status === 'rolled_back') throw new Error('This global policy has already been rolled back.');
	policy.status = 'rolled_back';
	policy.rolledBackAt = nowIso();
	policy.rolledBackByUserId = user.id;
	policy.rollbackReason = trimOrNull(reason);
	ownershipState.policyAudits.unshift({
		id: crypto.randomUUID(),
		ownerAccountId: account.id,
		policyId: policy.id,
		action: 'rolled_back',
		actorUserId: user.id,
		actorName: String(user.name || user.email || user.id),
		actorRole: trimOrNull(user.activeRole || user.roles[0]),
		targetSchoolIds: [...policy.targetSchoolIds],
		policyType: policy.policyType,
		note: trimOrNull(reason),
		createdAt: policy.rolledBackAt,
	});
	await saveOwnershipState(ownershipState);
	return { policy, ownerAccount };
	}

export async function listGlobalPoliciesForUser(user: Pick<User, 'id' | 'name' | 'email' | 'school_id' | 'roles'>) {
	const { ownershipState, account, ownerAccount } = await getAccessibleSchoolContext(user);
	if (!account || !ownerAccount) {
		return { policies: [], audits: [], ownerAccount: null };
	}
	return {
		policies: ownershipState.globalPolicies.filter((entry) => entry.ownerAccountId === account.id),
		audits: ownershipState.policyAudits.filter((entry) => entry.ownerAccountId === account.id),
		ownerAccount,
	};
	}