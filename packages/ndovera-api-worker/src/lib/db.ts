import postgres from "postgres";
import type { ApiWorkerEnv } from "./env";

type JsonValue = Record<string, unknown>;

type StorageRecord = {
  namespace: string;
  scope: string;
  payload: JsonValue;
  updatedAt: string;
};

function nowIso() {
  return new Date().toISOString();
}

function resolveConnectionString(env: ApiWorkerEnv): string {
  const direct = String(env.HYPERDRIVE_CONNECTION_STRING || "").trim();
  if (direct) return direct;
  const binding = env.HYPERDRIVE?.connectionString;
  return String(binding || "").trim();
}

async function ensureD1Schema(env: ApiWorkerEnv) {
  await env.APP_DB.exec(
    "CREATE TABLE IF NOT EXISTS ndovera_documents (namespace TEXT NOT NULL, scope TEXT NOT NULL, payload_json TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY(namespace, scope));"
  );
}

async function ensurePgSchema(client: postgres.Sql) {
  await client`CREATE TABLE IF NOT EXISTS ndovera_documents (namespace TEXT NOT NULL, scope TEXT NOT NULL, payload_json JSONB NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY(namespace, scope));`;
}

export async function readDocument<T extends JsonValue>(
  env: ApiWorkerEnv,
  namespace: string,
  scope: string,
  fallback: () => T
): Promise<T> {
  const connectionString = resolveConnectionString(env);
  if (connectionString) {
    const sql = postgres(connectionString, { prepare: false });
    try {
      await ensurePgSchema(sql);
      const rows = await sql<StorageRecord[]>`
        SELECT namespace, scope, payload_json as payload, updated_at as "updatedAt"
        FROM ndovera_documents
        WHERE namespace = ${namespace} AND scope = ${scope}
        LIMIT 1
      `;
      if (!rows.length) return fallback();
      return (rows[0].payload || fallback()) as T;
    } finally {
      await sql.end({ timeout: 1 });
    }
  }

  await ensureD1Schema(env);
  const response = await env.APP_DB
    .prepare(
      "SELECT payload_json FROM ndovera_documents WHERE namespace = ?1 AND scope = ?2 LIMIT 1"
    )
    .bind(namespace, scope)
    .first<{ payload_json?: string }>();

  if (!response?.payload_json) return fallback();
  try {
    return JSON.parse(response.payload_json) as T;
  } catch {
    return fallback();
  }
}

export async function writeDocument<T extends JsonValue>(
  env: ApiWorkerEnv,
  namespace: string,
  scope: string,
  payload: T
): Promise<T> {
  const updatedAt = nowIso();
  const connectionString = resolveConnectionString(env);
  if (connectionString) {
    const sql = postgres(connectionString, { prepare: false });
    try {
      await ensurePgSchema(sql);
      await sql`
        INSERT INTO ndovera_documents (namespace, scope, payload_json, updated_at)
        VALUES (${namespace}, ${scope}, ${sql.json(payload)}, ${updatedAt})
        ON CONFLICT (namespace, scope)
        DO UPDATE SET payload_json = EXCLUDED.payload_json, updated_at = EXCLUDED.updated_at
      `;
      return payload;
    } finally {
      await sql.end({ timeout: 1 });
    }
  }

  await ensureD1Schema(env);
  await env.APP_DB
    .prepare(
      "INSERT INTO ndovera_documents (namespace, scope, payload_json, updated_at) VALUES (?1, ?2, ?3, ?4) ON CONFLICT(namespace, scope) DO UPDATE SET payload_json = excluded.payload_json, updated_at = excluded.updated_at"
    )
    .bind(namespace, scope, JSON.stringify(payload), updatedAt)
    .run();

  return payload;
}
