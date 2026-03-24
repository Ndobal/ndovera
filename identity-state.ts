import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { Pool, PoolClient } from 'pg';

export type IdentityCategory = 'student' | 'staff' | 'parent' | 'admin' | 'alumni' | 'global';
export type IdentityUserStatus = 'active' | 'inactive';

export type SchoolRecord = { id: string; name: string; subdomain: string; createdAt: string };

export type IdentityUserRecord = {
	id: string;
	schoolId: string;
	schoolName: string;
	name: string;
	email?: string | null;
	phone?: string | null;
	passwordHash: string;
	category: IdentityCategory;
	status: IdentityUserStatus;
	roles: string[];
	activeRole: string;
	aliases: string[];
	createdAt: string;
	updatedAt: string;
};

export type StudentRecord = {
	id: string;
	schoolId: string;
	schoolName: string;
	userId: string;
	name: string;
	parentUserIds: string[];
	status: 'active' | 'transferred' | 'alumni';
	previousUserIds: string[];
	createdAt: string;
	updatedAt: string;
};

export type TransferRecord = {
	id: string;
	studentId: string;
	fromSchoolId: string;
	toSchoolId: string;
	fromUserId: string;
	toUserId: string;
	reason?: string;
	requestedBy?: string;
	createdAt: string;
	completedAt: string;
};

export type IdentityLifecycleAction = 'deactivated' | 'reactivated';

export type IdentityLifecycleEventRecord = {
	id: string;
	userId: string;
	schoolId: string;
	schoolName: string;
	userName: string;
	action: IdentityLifecycleAction;
	actorId?: string;
	actorName?: string;
	actorRole?: string;
	reason?: string;
	createdAt: string;
};

export type IdentityState = {
	schools: SchoolRecord[];
	users: IdentityUserRecord[];
	students: StudentRecord[];
	transfers: TransferRecord[];
	lifecycleEvents: IdentityLifecycleEventRecord[];
	counters: Record<string, number>;
};

export type ProvisionInput = {
	category: IdentityCategory;
	schoolId?: string;
	schoolName?: string;
	name: string;
	email?: string | null;
	phone?: string | null;
	password?: string;
	roles?: string[];
};

export type CreateSchoolWithOwnerInput = {
	schoolName: string;
	subdomain: string;
	schoolId?: string;
	ownerName: string;
	ownerEmail?: string | null;
	ownerPhone?: string | null;
	ownerPassword?: string;
	ownerRoles?: string[];
};

export type UpdateIdentityUserInput = {
	userId: string;
	schoolId?: string;
	name?: string;
	email?: string | null;
	phone?: string | null;
	password?: string;
	roles?: string[];
	activeRole?: string;
	category?: IdentityCategory;
	status?: IdentityUserStatus;
	aliasToAdd?: string | null;
	auditActorId?: string;
	auditActorName?: string;
	auditActorRole?: string;
	auditReason?: string;
};

export type ListIdentityLifecycleEventsOptions = {
	schoolId?: string;
	userId?: string;
	limit?: number;
};

export type AssignRoleInput = {
	targetUserId: string;
	schoolId: string;
	role: string;
	makeActive?: boolean;
	uniquePerSchool?: boolean;
};

const REPO_ROOT = path.resolve(process.cwd(), '..', '..');
const DATABASE_URL = (process.env.DATABASE_URL || process.env.POSTGRES_URL || '').trim();
const SCHOOL_DEFAULT = { id: 'school-1', name: 'Ndovera Academy', subdomain: 'ndovera' };

function resolveRuntimePath(envValue: string | undefined, fallbackPath: string) {
	const trimmed = (envValue || '').trim();
	return trimmed ? path.resolve(trimmed) : path.join(REPO_ROOT, fallbackPath);
}

const SQLITE_PATH = resolveRuntimePath(process.env.NDOVERA_IDENTITY_DB_PATH, 'ndovera-identity.db');
const LEGACY_STATE_PATH = resolveRuntimePath(process.env.NDOVERA_LEGACY_STATE_PATH, 'identity-state.json');

const sqlite = DATABASE_URL ? null : new Database(SQLITE_PATH);
const pgPool = DATABASE_URL
	? new Pool({
		connectionString: DATABASE_URL,
		ssl: process.env.PGSSLMODE === 'require' || process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
	})
	: null;

let initializationPromise: Promise<void> | null = null;

function nowIso() {
	return new Date().toISOString();
}

function trimOrNull(value: unknown) {
	const normalized = String(value || '').trim();
	return normalized ? normalized : null;
}

function normalizePhone(value: unknown) {
	const normalized = String(value || '').replace(/[^\d+]/g, '').trim();
	return normalized ? normalized : null;
}

function makeSchoolIdFromSubdomain(subdomain: string) {
	const normalized = String(subdomain || '').trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
	return normalized || `school-${crypto.randomUUID().slice(0, 8)}`;
}

function defaultState(): IdentityState {
	return { schools: [{ ...SCHOOL_DEFAULT, createdAt: nowIso() }], users: [], students: [], transfers: [], lifecycleEvents: [], counters: {} };
}

function ensureStateShape(raw: Partial<IdentityState> | null | undefined): IdentityState {
	const state = defaultState();
	if (!raw) return state;
	if (Array.isArray(raw.schools) && raw.schools.length) state.schools = raw.schools as SchoolRecord[];
	if (Array.isArray(raw.users)) state.users = raw.users as IdentityUserRecord[];
	if (Array.isArray(raw.students)) state.students = raw.students as StudentRecord[];
	if (Array.isArray(raw.transfers)) state.transfers = raw.transfers as TransferRecord[];
	if (Array.isArray(raw.lifecycleEvents)) state.lifecycleEvents = raw.lifecycleEvents as IdentityLifecycleEventRecord[];
	if (raw.counters && typeof raw.counters === 'object') state.counters = { ...raw.counters };
	return state;
}

function readLegacySeed(): IdentityState | null {
	try {
		if (!fs.existsSync(LEGACY_STATE_PATH)) return null;
		const parsed = JSON.parse(fs.readFileSync(LEGACY_STATE_PATH, 'utf8')) as Partial<IdentityState>;
		return ensureStateShape(parsed);
	} catch {
		return null;
	}
}

function getCategoryPrefix(category: IdentityCategory) {
	switch (category) {
		case 'student': return 'NS';
		case 'staff': return 'NT';
		case 'parent': return 'NP';
		case 'admin': return 'NONY-NDO';
		case 'alumni': return 'NAL';
		case 'global': return 'NU-G';
	}
}

function getSequenceWidth(category: IdentityCategory) {
	return category === 'global' ? 7 : 6;
}

function getSchoolInitials(schoolName: string) {
	const tokens = schoolName.replace(/[^A-Za-z0-9 ]+/g, ' ').trim().split(/\s+/).filter(Boolean);
	if (tokens.length === 0) return 'SCH';
	if (tokens.length === 1) return tokens[0].slice(0, 3).toUpperCase().padEnd(3, 'X');
	return tokens.slice(0, 4).map((token) => token[0].toUpperCase()).join('');
}

function counterKey(category: IdentityCategory, scopeId: string) {
	return `${scopeId}:${category}`;
}

function nextSequence(state: IdentityState, category: IdentityCategory, scopeId: string) {
	const key = counterKey(category, scopeId);
	const current = state.counters[key];
	if (typeof current === 'number' && current > 0) {
		state.counters[key] = current + 1;
		return current;
	}
	const seed = category === 'global' ? 1000000 + Math.floor(Math.random() * 8000000) : 100000 + Math.floor(Math.random() * 800000);
	state.counters[key] = seed + 1;
	return seed;
}

export function makeIdentityCode(category: IdentityCategory, schoolName: string, sequence: number) {
	if (category === 'global') {
		return `${getCategoryPrefix(category)}-${String(sequence).padStart(getSequenceWidth(category), '0')}`;
	}
	return `${getCategoryPrefix(category)}-${getSchoolInitials(schoolName)}-${String(sequence).padStart(getSequenceWidth(category), '0')}`;
}

function hashPassword(password: string) {
	if (!password) return bcrypt.hashSync(crypto.randomBytes(8).toString('hex'), 10);
	return password.startsWith('$2') ? password : bcrypt.hashSync(password, 10);
}

function toJson(value: unknown) {
	return JSON.stringify(value);
}

function parseJsonArray(value: unknown) {
	if (Array.isArray(value)) return value;
	if (typeof value !== 'string' || !value) return [];
	try {
		const parsed = JSON.parse(value);
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

function rowToSchool(row: any): SchoolRecord {
	return { id: String(row.id), name: String(row.name), subdomain: String(row.subdomain), createdAt: String(row.created_at || row.createdAt) };
}

function rowToUser(row: any): IdentityUserRecord {
	return {
		id: String(row.id),
		schoolId: String(row.school_id || row.schoolId),
		schoolName: String(row.school_name || row.schoolName),
		name: String(row.name),
		email: row.email ? String(row.email) : null,
		phone: row.phone ? String(row.phone) : null,
		passwordHash: String(row.password_hash || row.passwordHash),
		category: String(row.category) as IdentityCategory,
		status: String(row.status || 'active') as IdentityUserStatus,
		roles: parseJsonArray(row.roles_json || row.rolesJson) as string[],
		activeRole: String(row.active_role || row.activeRole),
		aliases: parseJsonArray(row.aliases_json || row.aliasesJson) as string[],
		createdAt: String(row.created_at || row.createdAt),
		updatedAt: String(row.updated_at || row.updatedAt),
	};
}

function rowToStudent(row: any): StudentRecord {
	return {
		id: String(row.id),
		schoolId: String(row.school_id || row.schoolId),
		schoolName: String(row.school_name || row.schoolName),
		userId: String(row.user_id || row.userId),
		name: String(row.name),
		parentUserIds: parseJsonArray(row.parent_user_ids_json || row.parentUserIdsJson) as string[],
		status: String(row.status) as 'active' | 'transferred' | 'alumni',
		previousUserIds: parseJsonArray(row.previous_user_ids_json || row.previousUserIdsJson) as string[],
		createdAt: String(row.created_at || row.createdAt),
		updatedAt: String(row.updated_at || row.updatedAt),
	};
}

function rowToTransfer(row: any): TransferRecord {
	return {
		id: String(row.id),
		studentId: String(row.student_id || row.studentId),
		fromSchoolId: String(row.from_school_id || row.fromSchoolId),
		toSchoolId: String(row.to_school_id || row.toSchoolId),
		fromUserId: String(row.from_user_id || row.fromUserId),
		toUserId: String(row.to_user_id || row.toUserId),
		reason: row.reason ? String(row.reason) : undefined,
		requestedBy: row.requested_by ? String(row.requested_by) : undefined,
		createdAt: String(row.created_at || row.createdAt),
		completedAt: String(row.completed_at || row.completedAt),
	};
}

function rowToLifecycleEvent(row: any): IdentityLifecycleEventRecord {
	return {
		id: String(row.id),
		userId: String(row.user_id || row.userId),
		schoolId: String(row.school_id || row.schoolId),
		schoolName: String(row.school_name || row.schoolName),
		userName: String(row.user_name || row.userName),
		action: String(row.action) as IdentityLifecycleAction,
		actorId: row.actor_id ? String(row.actor_id) : undefined,
		actorName: row.actor_name ? String(row.actor_name) : undefined,
		actorRole: row.actor_role ? String(row.actor_role) : undefined,
		reason: row.reason ? String(row.reason) : undefined,
		createdAt: String(row.created_at || row.createdAt),
	};
}

async function ensureSchema() {
	if (initializationPromise) return initializationPromise;
	initializationPromise = (async () => {
		if (pgPool) {
			await pgPool.query(`CREATE TABLE IF NOT EXISTS schools (id TEXT PRIMARY KEY, name TEXT NOT NULL, subdomain TEXT NOT NULL, created_at TEXT NOT NULL)`);
			await pgPool.query(`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, school_id TEXT NOT NULL, school_name TEXT NOT NULL, name TEXT NOT NULL, email TEXT, phone TEXT, password_hash TEXT NOT NULL, category TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active', roles_json TEXT NOT NULL, active_role TEXT NOT NULL, aliases_json TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE)`);
			await pgPool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT');
			await pgPool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'`);
			await pgPool.query(`CREATE TABLE IF NOT EXISTS students (id TEXT PRIMARY KEY, school_id TEXT NOT NULL, school_name TEXT NOT NULL, user_id TEXT NOT NULL UNIQUE, name TEXT NOT NULL, parent_user_ids_json TEXT NOT NULL, status TEXT NOT NULL, previous_user_ids_json TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)`);
			await pgPool.query(`CREATE TABLE IF NOT EXISTS transfers (id TEXT PRIMARY KEY, student_id TEXT NOT NULL, from_school_id TEXT NOT NULL, to_school_id TEXT NOT NULL, from_user_id TEXT NOT NULL, to_user_id TEXT NOT NULL, reason TEXT, requested_by TEXT, created_at TEXT NOT NULL, completed_at TEXT NOT NULL)`);
			await pgPool.query(`CREATE TABLE IF NOT EXISTS lifecycle_events (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, school_id TEXT NOT NULL, school_name TEXT NOT NULL, user_name TEXT NOT NULL, action TEXT NOT NULL, actor_id TEXT, actor_name TEXT, actor_role TEXT, reason TEXT, created_at TEXT NOT NULL)`);
			await pgPool.query(`CREATE TABLE IF NOT EXISTS counters (counter_key TEXT PRIMARY KEY, value INTEGER NOT NULL)`);
		} else if (sqlite) {
			sqlite.pragma('journal_mode = WAL');
			sqlite.pragma('foreign_keys = ON');
			sqlite.exec(`
				CREATE TABLE IF NOT EXISTS schools (id TEXT PRIMARY KEY, name TEXT NOT NULL, subdomain TEXT NOT NULL, created_at TEXT NOT NULL);
				CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, school_id TEXT NOT NULL, school_name TEXT NOT NULL, name TEXT NOT NULL, email TEXT, phone TEXT, password_hash TEXT NOT NULL, category TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active', roles_json TEXT NOT NULL, active_role TEXT NOT NULL, aliases_json TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE);
				CREATE TABLE IF NOT EXISTS students (id TEXT PRIMARY KEY, school_id TEXT NOT NULL, school_name TEXT NOT NULL, user_id TEXT NOT NULL UNIQUE, name TEXT NOT NULL, parent_user_ids_json TEXT NOT NULL, status TEXT NOT NULL, previous_user_ids_json TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE);
				CREATE TABLE IF NOT EXISTS transfers (id TEXT PRIMARY KEY, student_id TEXT NOT NULL, from_school_id TEXT NOT NULL, to_school_id TEXT NOT NULL, from_user_id TEXT NOT NULL, to_user_id TEXT NOT NULL, reason TEXT, requested_by TEXT, created_at TEXT NOT NULL, completed_at TEXT NOT NULL);
				CREATE TABLE IF NOT EXISTS lifecycle_events (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, school_id TEXT NOT NULL, school_name TEXT NOT NULL, user_name TEXT NOT NULL, action TEXT NOT NULL, actor_id TEXT, actor_name TEXT, actor_role TEXT, reason TEXT, created_at TEXT NOT NULL);
				CREATE TABLE IF NOT EXISTS counters (counter_key TEXT PRIMARY KEY, value INTEGER NOT NULL);
			`);
			try {
				sqlite.exec('ALTER TABLE users ADD COLUMN phone TEXT');
			} catch {
				// Column already exists.
			}
			try {
				sqlite.exec("ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active'");
			} catch {
				// Column already exists.
			}
		}
		const currentState = await loadIdentityStateInternal();
		if (currentState.schools.length === 0) {
			await writeIdentityStateInternal(defaultState());
		}
	})();
	return initializationPromise;
}

async function loadIdentityStateInternal(): Promise<IdentityState> {
	if (pgPool) {
		const [schoolsResp, usersResp, studentsResp, transfersResp, lifecycleEventsResp, countersResp] = await Promise.all([
			pgPool.query('SELECT id, name, subdomain, created_at FROM schools ORDER BY created_at ASC'),
			pgPool.query('SELECT id, school_id, school_name, name, email, phone, password_hash, category, status, roles_json, active_role, aliases_json, created_at, updated_at FROM users ORDER BY created_at ASC'),
			pgPool.query('SELECT id, school_id, school_name, user_id, name, parent_user_ids_json, status, previous_user_ids_json, created_at, updated_at FROM students ORDER BY created_at ASC'),
			pgPool.query('SELECT id, student_id, from_school_id, to_school_id, from_user_id, to_user_id, reason, requested_by, created_at, completed_at FROM transfers ORDER BY created_at ASC'),
			pgPool.query('SELECT id, user_id, school_id, school_name, user_name, action, actor_id, actor_name, actor_role, reason, created_at FROM lifecycle_events ORDER BY created_at DESC'),
			pgPool.query('SELECT counter_key, value FROM counters'),
		]);
		return {
			schools: schoolsResp.rows.map(rowToSchool),
			users: usersResp.rows.map(rowToUser),
			students: studentsResp.rows.map(rowToStudent),
			transfers: transfersResp.rows.map(rowToTransfer),
			lifecycleEvents: lifecycleEventsResp.rows.map(rowToLifecycleEvent),
			counters: Object.fromEntries(countersResp.rows.map((row: any) => [String(row.counter_key), Number(row.value)])),
		};
	}
	if (sqlite) {
		return {
			schools: sqlite.prepare('SELECT id, name, subdomain, created_at FROM schools ORDER BY created_at ASC').all().map(rowToSchool),
			users: sqlite.prepare('SELECT id, school_id, school_name, name, email, phone, password_hash, category, status, roles_json, active_role, aliases_json, created_at, updated_at FROM users ORDER BY created_at ASC').all().map(rowToUser),
			students: sqlite.prepare('SELECT id, school_id, school_name, user_id, name, parent_user_ids_json, status, previous_user_ids_json, created_at, updated_at FROM students ORDER BY created_at ASC').all().map(rowToStudent),
			transfers: sqlite.prepare('SELECT id, student_id, from_school_id, to_school_id, from_user_id, to_user_id, reason, requested_by, created_at, completed_at FROM transfers ORDER BY created_at ASC').all().map(rowToTransfer),
			lifecycleEvents: sqlite.prepare('SELECT id, user_id, school_id, school_name, user_name, action, actor_id, actor_name, actor_role, reason, created_at FROM lifecycle_events ORDER BY created_at DESC').all().map(rowToLifecycleEvent),
			counters: Object.fromEntries((sqlite.prepare('SELECT counter_key, value FROM counters').all() as Array<{ counter_key: string; value: number }>).map((row) => [row.counter_key, Number(row.value)])),
		};
	}
	return defaultState();
}

async function writeIdentityStateInternal(state: IdentityState) {
	if (pgPool) {
		const client = await pgPool.connect();
		try {
			await writeStateWithClient(client, state);
		} finally {
			client.release();
		}
		return;
	}
	writeStateToSqlite(state);
}

async function writeStateWithClient(client: PoolClient, state: IdentityState) {
	await client.query('BEGIN');
	try {
		await client.query('DELETE FROM lifecycle_events');
		await client.query('DELETE FROM transfers');
		await client.query('DELETE FROM students');
		await client.query('DELETE FROM users');
		await client.query('DELETE FROM schools');
		await client.query('DELETE FROM counters');
		for (const school of state.schools) await client.query('INSERT INTO schools (id, name, subdomain, created_at) VALUES ($1, $2, $3, $4)', [school.id, school.name, school.subdomain, school.createdAt]);
		for (const user of state.users) await client.query('INSERT INTO users (id, school_id, school_name, name, email, phone, password_hash, category, status, roles_json, active_role, aliases_json, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)', [user.id, user.schoolId, user.schoolName, user.name, user.email, user.phone || null, user.passwordHash, user.category, user.status, toJson(user.roles), user.activeRole, toJson(user.aliases), user.createdAt, user.updatedAt]);
		for (const student of state.students) await client.query('INSERT INTO students (id, school_id, school_name, user_id, name, parent_user_ids_json, status, previous_user_ids_json, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)', [student.id, student.schoolId, student.schoolName, student.userId, student.name, toJson(student.parentUserIds), student.status, toJson(student.previousUserIds), student.createdAt, student.updatedAt]);
		for (const transfer of state.transfers) await client.query('INSERT INTO transfers (id, student_id, from_school_id, to_school_id, from_user_id, to_user_id, reason, requested_by, created_at, completed_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)', [transfer.id, transfer.studentId, transfer.fromSchoolId, transfer.toSchoolId, transfer.fromUserId, transfer.toUserId, transfer.reason || null, transfer.requestedBy || null, transfer.createdAt, transfer.completedAt]);
		for (const event of state.lifecycleEvents) await client.query('INSERT INTO lifecycle_events (id, user_id, school_id, school_name, user_name, action, actor_id, actor_name, actor_role, reason, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)', [event.id, event.userId, event.schoolId, event.schoolName, event.userName, event.action, event.actorId || null, event.actorName || null, event.actorRole || null, event.reason || null, event.createdAt]);
		for (const [counterKey, value] of Object.entries(state.counters)) await client.query('INSERT INTO counters (counter_key, value) VALUES ($1, $2)', [counterKey, value]);
		await client.query('COMMIT');
	} catch (error) {
		await client.query('ROLLBACK');
		throw error;
	}
}

function writeStateToSqlite(state: IdentityState) {
	if (!sqlite) return;
	sqlite.transaction(() => {
		sqlite.prepare('DELETE FROM lifecycle_events').run();
		sqlite.prepare('DELETE FROM transfers').run();
		sqlite.prepare('DELETE FROM students').run();
		sqlite.prepare('DELETE FROM users').run();
		sqlite.prepare('DELETE FROM schools').run();
		sqlite.prepare('DELETE FROM counters').run();
		const insertSchool = sqlite.prepare('INSERT INTO schools (id, name, subdomain, created_at) VALUES (?, ?, ?, ?)');
		const insertUser = sqlite.prepare('INSERT INTO users (id, school_id, school_name, name, email, phone, password_hash, category, status, roles_json, active_role, aliases_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
		const insertStudent = sqlite.prepare('INSERT INTO students (id, school_id, school_name, user_id, name, parent_user_ids_json, status, previous_user_ids_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
		const insertTransfer = sqlite.prepare('INSERT INTO transfers (id, student_id, from_school_id, to_school_id, from_user_id, to_user_id, reason, requested_by, created_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
		const insertLifecycleEvent = sqlite.prepare('INSERT INTO lifecycle_events (id, user_id, school_id, school_name, user_name, action, actor_id, actor_name, actor_role, reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
		const insertCounter = sqlite.prepare('INSERT INTO counters (counter_key, value) VALUES (?, ?)');
		state.schools.forEach((school) => insertSchool.run(school.id, school.name, school.subdomain, school.createdAt));
		state.users.forEach((user) => insertUser.run(user.id, user.schoolId, user.schoolName, user.name, user.email || null, user.phone || null, user.passwordHash, user.category, user.status, toJson(user.roles), user.activeRole, toJson(user.aliases), user.createdAt, user.updatedAt));
		state.students.forEach((student) => insertStudent.run(student.id, student.schoolId, student.schoolName, student.userId, student.name, toJson(student.parentUserIds), student.status, toJson(student.previousUserIds), student.createdAt, student.updatedAt));
		state.transfers.forEach((transfer) => insertTransfer.run(transfer.id, transfer.studentId, transfer.fromSchoolId, transfer.toSchoolId, transfer.fromUserId, transfer.toUserId, transfer.reason || null, transfer.requestedBy || null, transfer.createdAt, transfer.completedAt));
		state.lifecycleEvents.forEach((event) => insertLifecycleEvent.run(event.id, event.userId, event.schoolId, event.schoolName, event.userName, event.action, event.actorId || null, event.actorName || null, event.actorRole || null, event.reason || null, event.createdAt));
		Object.entries(state.counters).forEach(([counterKey, value]) => insertCounter.run(counterKey, value));
	})();
}

export async function loadIdentityState(): Promise<IdentityState> {
	await ensureSchema();
	const state = await loadIdentityStateInternal();
	if (!state.schools.some((school) => school.id === SCHOOL_DEFAULT.id)) {
		state.schools.unshift({ ...SCHOOL_DEFAULT, createdAt: nowIso() });
		await saveIdentityState(state);
	}
	return state;
}

export async function saveIdentityState(state: IdentityState) {
	await ensureSchema();
	await writeIdentityStateInternal(state);
}

export function isIdentityUserActive(user: IdentityUserRecord) {
	return (user.status || 'active') === 'active';
}

export function listIdentityUsers(state: IdentityState, schoolId?: string, includeInactive = false) {
	const scoped = schoolId ? state.users.filter((user) => user.schoolId === schoolId) : state.users;
	return includeInactive ? scoped : scoped.filter(isIdentityUserActive);
}

export function listIdentityLifecycleEvents(state: IdentityState, options: ListIdentityLifecycleEventsOptions = {}) {
	const { schoolId, userId, limit } = options;
	const scoped = state.lifecycleEvents.filter((event) => {
		if (schoolId && event.schoolId !== schoolId) return false;
		if (userId && event.userId !== userId) return false;
		return true;
	});
	const sorted = [...scoped].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
	if (typeof limit === 'number' && limit > 0) return sorted.slice(0, limit);
	return sorted;
}

export function ensureSchool(state: IdentityState, schoolId: string, schoolName: string, subdomain?: string) {
	const existing = state.schools.find((school) => school.id === schoolId);
	if (existing) {
		if (!existing.name && schoolName) existing.name = schoolName;
		if (!existing.subdomain && subdomain) existing.subdomain = subdomain;
		return existing;
	}
	const school: SchoolRecord = { id: schoolId, name: schoolName, subdomain: subdomain || schoolId, createdAt: nowIso() };
	state.schools.push(school);
	return school;
}

export function countUsersByCategory(state: IdentityState, schoolId?: string) {
	const scoped = listIdentityUsers(state, schoolId);
	const students = scoped.filter((user) => user.category === 'student').length;
	const staff = scoped.filter((user) => user.category === 'staff').length;
	const parents = scoped.filter((user) => user.category === 'parent').length;
	const admins = scoped.filter((user) => user.category === 'admin').length;
	const alumni = scoped.filter((user) => user.category === 'alumni').length;
	const global = scoped.filter((user) => user.category === 'global').length;
	return { students, staff, parents, admins, alumni, global, total: scoped.length };
}

export function countInactiveUsers(state: IdentityState, schoolId?: string) {
	const scoped = schoolId ? state.users.filter((user) => user.schoolId === schoolId) : state.users;
	return scoped.filter((user) => !isIdentityUserActive(user)).length;
}

export function buildMetrics(state: IdentityState) {
	return {
		schools: state.schools.map((school) => ({ id: school.id, name: school.name, subdomain: school.subdomain, counts: countUsersByCategory(state, school.id), inactiveUsers: countInactiveUsers(state, school.id) })),
		totals: countUsersByCategory(state),
		inactiveUsers: countInactiveUsers(state),
		transfers: state.transfers.length,
	};
}

export function findUserByIdentifier(state: IdentityState, identifier: string) {
	const normalized = identifier.trim().toLowerCase();
	return state.users.find((user) => {
		const matchesId = user.id.toLowerCase() === normalized;
		const matchesEmail = Boolean(user.email) && user.email?.toLowerCase() === normalized;
		const matchesAlias = user.aliases.some((alias) => alias.toLowerCase() === normalized);
		return matchesId || matchesEmail || matchesAlias;
	});
}

export function verifyStoredPassword(password: string, passwordHash: string) {
	if (!passwordHash) return false;
	if (passwordHash.startsWith('$2')) return bcrypt.compareSync(password, passwordHash);
	return password === passwordHash;
}

export async function provisionUser(state: IdentityState, input: ProvisionInput) {
	await ensureSchema();
	const isGlobal = input.category === 'global';
	const schoolId = isGlobal ? 'global' : input.schoolId || 'school-1';
	const schoolName = isGlobal ? 'Global' : input.schoolName || 'Ndovera Academy';
	const school = isGlobal ? { id: schoolId, name: schoolName, subdomain: 'global', createdAt: nowIso() } : ensureSchool(state, schoolId, schoolName);
	const sequence = nextSequence(state, input.category, school.id);
	const id = makeIdentityCode(input.category, school.name, sequence);
	const password = input.password || crypto.randomBytes(6).toString('hex');
	const now = nowIso();
	const activeRole = input.roles?.[0] || (input.category === 'student' ? 'Student' : input.category === 'staff' ? 'Staff' : input.category === 'parent' ? 'Parent' : input.category === 'alumni' ? 'Alumni' : input.category === 'global' ? 'Global' : 'Admin');
	const user: IdentityUserRecord = {
		id,
		schoolId: school.id,
		schoolName: school.name,
		name: input.name,
		email: input.email || null,
		phone: normalizePhone(input.phone),
		passwordHash: hashPassword(password),
		category: input.category,
		status: 'active',
		roles: input.roles?.length ? input.roles : [activeRole],
		activeRole,
		aliases: [],
		createdAt: now,
		updatedAt: now,
	};
	state.users.push(user);
	if (input.category === 'student') {
		state.students.push({ id: crypto.randomUUID(), schoolId: school.id, schoolName: school.name, userId: user.id, name: input.name, parentUserIds: [], status: 'active', previousUserIds: [], createdAt: now, updatedAt: now });
	}
	await saveIdentityState(state);
	return { user, temporaryPassword: input.password ? null : password };
}

export async function createSchoolWithOwner(state: IdentityState, input: CreateSchoolWithOwnerInput) {
	await ensureSchema();
	const subdomain = String(input.subdomain || '').trim().toLowerCase();
	if (!subdomain) throw new Error('School subdomain is required.');
	const schoolId = trimOrNull(input.schoolId) || makeSchoolIdFromSubdomain(subdomain);
	if (state.schools.some((school) => school.id === schoolId && school.name !== input.schoolName.trim())) {
		throw new Error('A school with this id already exists.');
	}
	if (state.schools.some((school) => school.subdomain.toLowerCase() === subdomain && school.id !== schoolId)) {
		throw new Error('A school with this subdomain already exists.');
	}
	const school = ensureSchool(state, schoolId, input.schoolName.trim(), subdomain);
	school.name = input.schoolName.trim();
	school.subdomain = subdomain;
	await saveIdentityState(state);
	const owner = await provisionUser(state, {
		category: 'admin',
		schoolId: school.id,
		schoolName: school.name,
		name: input.ownerName.trim(),
		email: trimOrNull(input.ownerEmail),
		phone: normalizePhone(input.ownerPhone),
		password: trimOrNull(input.ownerPassword) || undefined,
		roles: input.ownerRoles?.length ? input.ownerRoles : ['School Admin'],
	});
	await assignRoleToUser(state, {
		targetUserId: owner.user.id,
		schoolId: school.id,
		role: 'Owner',
		makeActive: true,
		uniquePerSchool: false,
	});
	const refreshed = await loadIdentityState();
	const persistedOwner = refreshed.users.find((user) => user.id === owner.user.id) || owner.user;
	return { school, owner: persistedOwner, temporaryPassword: owner.temporaryPassword };
}

function defaultRoleForCategory(category: IdentityCategory) {
	if (category === 'student') return 'Student';
	if (category === 'staff') return 'Staff';
	if (category === 'parent') return 'Parent';
	if (category === 'alumni') return 'Alumni';
	if (category === 'global') return 'Global';
	return 'Admin';
}

function normalizeRoleForComparison(role?: string) {
	return String(role || '').trim().toLowerCase();
}

function ensureActiveRole(user: IdentityUserRecord) {
	if (user.roles.includes(user.activeRole)) return;
	user.activeRole = user.roles[0] || defaultRoleForCategory(user.category);
	if (!user.roles.length) {
		user.roles = [user.activeRole];
	}
}

function createLifecycleEvent(targetUser: IdentityUserRecord, input: UpdateIdentityUserInput, status: IdentityUserStatus): IdentityLifecycleEventRecord {
	return {
		id: crypto.randomUUID(),
		userId: targetUser.id,
		schoolId: targetUser.schoolId,
		schoolName: targetUser.schoolName,
		userName: targetUser.name,
		action: status === 'inactive' ? 'deactivated' : 'reactivated',
		actorId: trimOrNull(input.auditActorId) || undefined,
		actorName: trimOrNull(input.auditActorName) || undefined,
		actorRole: trimOrNull(input.auditActorRole) || undefined,
		reason: trimOrNull(input.auditReason) || undefined,
		createdAt: nowIso(),
	};
}

export async function assignRoleToUser(state: IdentityState, input: AssignRoleInput) {
	await ensureSchema();
	const targetUser = state.users.find((user) => user.id === input.targetUserId && user.schoolId === input.schoolId);
	if (!targetUser) throw new Error('Selected staff member was not found in this school.');
	if (!['staff', 'admin'].includes(targetUser.category)) throw new Error('Only staff accounts can be appointed to head roles.');

	const role = String(input.role || '').trim();
	if (!role) throw new Error('A target role is required.');

	const now = nowIso();
	const normalizedRole = normalizeRoleForComparison(role);
	const uniquePerSchool = input.uniquePerSchool ?? true;

	if (uniquePerSchool) {
		state.users.forEach((user) => {
			if (user.schoolId !== input.schoolId || user.id === targetUser.id) return;
			const nextRoles = user.roles.filter((entry) => normalizeRoleForComparison(entry) !== normalizedRole);
			if (nextRoles.length === user.roles.length) return;
			user.roles = nextRoles;
			ensureActiveRole(user);
			user.updatedAt = now;
		});
	}

	if (!targetUser.roles.some((entry) => normalizeRoleForComparison(entry) === normalizedRole)) {
		targetUser.roles = [role, ...targetUser.roles];
	}
	if (input.makeActive ?? true) {
		targetUser.activeRole = role;
	}
	ensureActiveRole(targetUser);
	targetUser.updatedAt = now;

	await saveIdentityState(state);
	return { user: targetUser };
}

export async function updateIdentityUser(state: IdentityState, input: UpdateIdentityUserInput) {
	await ensureSchema();
	const targetUser = state.users.find((user) => user.id === input.userId && (!input.schoolId || user.schoolId === input.schoolId));
	if (!targetUser) throw new Error('Selected user was not found.');
	const previousStatus = targetUser.status || 'active';
	if (input.email !== undefined) {
		const nextEmail = trimOrNull(input.email)?.toLowerCase() || null;
		const existing = nextEmail ? state.users.find((user) => user.id !== targetUser.id && (user.email || '').toLowerCase() === nextEmail) : null;
		if (existing) throw new Error('Another user already uses this email address.');
		targetUser.email = nextEmail;
	}
	if (input.phone !== undefined) targetUser.phone = normalizePhone(input.phone);
	if (input.name !== undefined) targetUser.name = String(input.name || '').trim() || targetUser.name;
	if (input.password !== undefined && String(input.password || '').trim()) targetUser.passwordHash = hashPassword(String(input.password));
	if (input.category !== undefined) targetUser.category = input.category;
	if (input.roles) {
		const nextRoles = input.roles.map((role) => role.trim()).filter(Boolean);
		if (!nextRoles.length) throw new Error('At least one role is required.');
		targetUser.roles = [...new Set(nextRoles)];
	}
	if (input.activeRole !== undefined) targetUser.activeRole = String(input.activeRole || '').trim() || targetUser.activeRole;
	if (input.aliasToAdd) targetUser.aliases = [...new Set([...targetUser.aliases, String(input.aliasToAdd).trim()])];
	let lifecycleEvent: IdentityLifecycleEventRecord | null = null;
	if (input.status !== undefined) {
		targetUser.status = input.status;
		if (input.status !== previousStatus) {
			lifecycleEvent = createLifecycleEvent(targetUser, input, input.status);
			state.lifecycleEvents.push(lifecycleEvent);
		}
	}
	ensureActiveRole(targetUser);
	targetUser.updatedAt = nowIso();
	await saveIdentityState(state);
	return { user: targetUser, lifecycleEvent };
}

export async function transferStudent(state: IdentityState, studentUserId: string, targetSchoolId: string, reason?: string, requestedBy?: string) {
	await ensureSchema();
	const studentUser = state.users.find((user) => user.id === studentUserId && user.category === 'student');
	if (!studentUser) throw new Error('Student not found.');
	const studentRecord = state.students.find((student) => student.userId === studentUserId);
	if (!studentRecord) throw new Error('Student record not found.');
	const targetSchool = state.schools.find((school) => school.id === targetSchoolId);
	if (!targetSchool) throw new Error('Target school not found.');

	const fromSchoolId = studentUser.schoolId;
	const fromUserId = studentUser.id;
	const sequence = nextSequence(state, 'student', targetSchool.id);
	const nextUserId = makeIdentityCode('student', targetSchool.name, sequence);
	const now = nowIso();

	studentUser.aliases = [...new Set([...studentUser.aliases, fromUserId])];
	studentUser.schoolId = targetSchool.id;
	studentUser.schoolName = targetSchool.name;
	studentUser.id = nextUserId;
	studentUser.updatedAt = now;
	studentRecord.previousUserIds = [...new Set([...studentRecord.previousUserIds, fromUserId])];
	studentRecord.schoolId = targetSchool.id;
	studentRecord.schoolName = targetSchool.name;
	studentRecord.userId = nextUserId;
	studentRecord.status = 'active';
	studentRecord.updatedAt = now;
	const transfer: TransferRecord = { id: crypto.randomUUID(), studentId: studentRecord.id, fromSchoolId, toSchoolId: targetSchool.id, fromUserId, toUserId: nextUserId, reason, requestedBy, createdAt: now, completedAt: now };
	state.transfers.push(transfer);
	await saveIdentityState(state);
	return { student: studentRecord, user: studentUser, transfer };
}

export async function graduateStudentToAlumni(state: IdentityState, studentUserId: string, reason?: string, requestedBy?: string) {
	await ensureSchema();
	const studentUser = state.users.find((user) => user.id === studentUserId && user.category === 'student');
	if (!studentUser) throw new Error('Student not found.');
	const studentRecord = state.students.find((student) => student.userId === studentUserId);
	if (!studentRecord) throw new Error('Student record not found.');

	const now = nowIso();
	studentUser.category = 'alumni';
	studentUser.roles = ['Alumni', ...studentUser.roles.filter((role) => normalizeRoleForComparison(role) !== 'student' && normalizeRoleForComparison(role) !== 'alumni')];
	studentUser.activeRole = 'Alumni';
	studentUser.updatedAt = now;

	studentRecord.status = 'alumni';
	studentRecord.updatedAt = now;
	if (reason || requestedBy) {
		studentUser.aliases = [...new Set([...studentUser.aliases, ...(reason ? [`graduated:${reason}`] : []), ...(requestedBy ? [`graduated-by:${requestedBy}`] : [])])];
	}

	await saveIdentityState(state);
	return { student: studentRecord, user: studentUser };
}
