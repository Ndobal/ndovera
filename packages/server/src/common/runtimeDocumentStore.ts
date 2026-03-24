import path from 'path';
import Database from 'better-sqlite3';
import { Pool } from 'pg';

const REPO_ROOT = path.resolve(process.cwd(), '..', '..');
const DATABASE_URL = (process.env.DATABASE_URL || process.env.POSTGRES_URL || '').trim();
const GLOBAL_SCOPE = '__global__';

function resolveRuntimePath(envValue: string | undefined, fallbackPath: string) {
	const trimmed = (envValue || '').trim();
	return trimmed ? path.resolve(trimmed) : path.join(REPO_ROOT, fallbackPath);
}

const SQLITE_PATH = resolveRuntimePath(process.env.NDOVERA_APP_DB_PATH, 'ndovera-app.db');
const sqlite = DATABASE_URL ? null : new Database(SQLITE_PATH);
const pgPool = DATABASE_URL
	? new Pool({
		connectionString: DATABASE_URL,
		ssl: process.env.PGSSLMODE === 'require' || process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
	})
	: null;

let schemaPromise: Promise<void> | null = null;

function nowIso() {
	return new Date().toISOString();
}

async function ensureSchema() {
	if (schemaPromise) return schemaPromise;
	schemaPromise = (async () => {
		if (pgPool) {
			await pgPool.query(`CREATE TABLE IF NOT EXISTS ndovera_documents (namespace TEXT NOT NULL, school_scope TEXT NOT NULL, payload_json TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY (namespace, school_scope))`);
			return;
		}
		if (sqlite) {
			sqlite.pragma('journal_mode = WAL');
			sqlite.exec(`CREATE TABLE IF NOT EXISTS ndovera_documents (namespace TEXT NOT NULL, school_scope TEXT NOT NULL, payload_json TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY (namespace, school_scope))`);
		}
	})();
	return schemaPromise;
}

function normalizeScope(scope?: string) {
	const normalized = String(scope || '').trim();
	return normalized || GLOBAL_SCOPE;
}

export async function readDocument<T>(namespace: string, scope: string | undefined, fallbackFactory: () => T): Promise<T> {
	await ensureSchema();
	const schoolScope = normalizeScope(scope);
	if (pgPool) {
		const response = await pgPool.query('SELECT payload_json FROM ndovera_documents WHERE namespace = $1 AND school_scope = $2', [namespace, schoolScope]);
		const payload = response.rows[0]?.payload_json;
		if (!payload) return fallbackFactory();
		try {
			return JSON.parse(String(payload)) as T;
		} catch {
			return fallbackFactory();
		}
	}
	if (!sqlite) return fallbackFactory();
	const row = sqlite.prepare('SELECT payload_json FROM ndovera_documents WHERE namespace = ? AND school_scope = ?').get(namespace, schoolScope) as { payload_json?: string } | undefined;
	if (!row?.payload_json) return fallbackFactory();
	try {
		return JSON.parse(String(row.payload_json)) as T;
	} catch {
		return fallbackFactory();
	}
}

export async function writeDocument<T>(namespace: string, scope: string | undefined, value: T): Promise<T> {
	await ensureSchema();
	const schoolScope = normalizeScope(scope);
	const payloadJson = JSON.stringify(value);
	const updatedAt = nowIso();
	if (pgPool) {
		await pgPool.query(
			'INSERT INTO ndovera_documents (namespace, school_scope, payload_json, updated_at) VALUES ($1, $2, $3, $4) ON CONFLICT (namespace, school_scope) DO UPDATE SET payload_json = EXCLUDED.payload_json, updated_at = EXCLUDED.updated_at',
			[namespace, schoolScope, payloadJson, updatedAt],
		);
		return value;
	}
	if (sqlite) {
		sqlite.prepare('INSERT INTO ndovera_documents (namespace, school_scope, payload_json, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(namespace, school_scope) DO UPDATE SET payload_json = excluded.payload_json, updated_at = excluded.updated_at').run(namespace, schoolScope, payloadJson, updatedAt);
	}
	return value;
}

export { GLOBAL_SCOPE };