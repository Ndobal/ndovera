import path from 'path';
import Database from 'better-sqlite3';
import { Pool } from 'pg';

const REPO_ROOT = path.resolve(process.cwd(), '..', '..');
const DATABASE_URL = (process.env.DATABASE_URL || process.env.POSTGRES_URL || '').trim();

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

const schemaCache = new Map<string, Promise<void>>();

function toPgPlaceholders(sql: string) {
	let index = 0;
	return sql.replace(/\?/g, () => `$${++index}`);
}

export async function ensureSqlSchema(schemaKey: string, statements: string[]) {
	const existing = schemaCache.get(schemaKey);
	if (existing) return existing;
	const promise = (async () => {
		if (pgPool) {
			for (const statement of statements) {
				await pgPool.query(statement);
			}
			return;
		}
		if (sqlite) {
			sqlite.pragma('journal_mode = WAL');
			for (const statement of statements) {
				sqlite.exec(statement);
			}
		}
	})();
	schemaCache.set(schemaKey, promise);
	return promise;
}

export async function queryRowsSql<T = Record<string, unknown>>(sql: string, params: Array<unknown> = []) {
	if (pgPool) {
		const result = await pgPool.query(toPgPlaceholders(sql), params);
		return result.rows as T[];
	}
	if (!sqlite) return [] as T[];
	return sqlite.prepare(sql).all(...params) as T[];
}

export async function queryFirstSql<T = Record<string, unknown>>(sql: string, params: Array<unknown> = []) {
	const rows = await queryRowsSql<T>(sql, params);
	return rows[0] || null;
}

export async function executeSql(sql: string, params: Array<unknown> = []) {
	if (pgPool) {
		await pgPool.query(toPgPlaceholders(sql), params);
		return;
	}
	if (!sqlite) return;
	sqlite.prepare(sql).run(...params);
}

export async function closeSqlStore() {
	await Promise.resolve(pgPool?.end());
	if (sqlite) sqlite.close();
}

export function getSqlBackend() {
	return pgPool ? 'postgres' : 'sqlite';
}