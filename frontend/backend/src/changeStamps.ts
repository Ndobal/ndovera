// Change stamps: read the expensive things only when something changed.
//
// A stamp is a tiny counter per scope:
//   tenant:<schoolId>   bumped by anything done in the school that others may need
//                       to see (a material, an assignment, a person, a fee record,
//                       an announcement, a result…) — every successful change request
//                       except the personal ones listed in PERSONAL_PATHS;
//   user:<usersId>      bumped when someone sends that person a message, or they
//                       read their messages (their unread count changes).
//
// The browser asks /api/changes (one or two primary-key reads) and fetches the
// real data only when a stamp moved. The header is cached under its stamps, so
// while nothing changes it is served from the edge cache with no database reads.

export const PERSONAL_PATHS: RegExp[] = [
  /^\/api\/(login|logout|auth)\b/,
  /^\/api\/push\//,
  /^\/api\/conversations\/[^/]+\/mark-read$/, // bumps the reader's own stamp instead
  /^\/api\/conversations(\/[^/]+\/messages)?$/, // bumps the participants' stamps instead
  /^\/api\/practice-arena\//,
  /^\/api\/ai(\/|-tutor|-pay\/)/,
  /^\/api\/material-ai\/(drafts|resolve)/, // a teacher's private drafts
  /^\/api\/ai-assessments\/[^/]+\/(generate-next|regenerate|regenerate-all|review)$/,
  /^\/api\/library-imports\/[^/]+\/step$/,
  /^\/api\/users\/me\b/,
]

const readyDbs = new WeakSet<object>()
async function ensureStampTable(db: D1Database) {
  if (readyDbs.has(db as object)) return
  await db.prepare(`CREATE TABLE IF NOT EXISTS change_stamps (scope TEXT PRIMARY KEY, version INTEGER NOT NULL DEFAULT 0, updated_at TEXT)`).run()
  readyDbs.add(db as object)
}

export const tenantScope = (tenantId: string) => `tenant:${String(tenantId || '').trim()}`
export const userScope = (userId: string) => `user:${String(userId || '').trim().toLowerCase()}`

/** Move the stamps on: one statement per scope, in one batch. */
export async function bumpStamps(db: D1Database, scopes: string[]) {
  const unique = Array.from(new Set(scopes.filter(scope => scope && !scope.endsWith(':'))))
  if (!unique.length) return
  await ensureStampTable(db)
  const at = new Date().toISOString()
  await db.batch(unique.map(scope => db.prepare(`INSERT INTO change_stamps (scope, version, updated_at) VALUES (?, 1, ?) ON CONFLICT(scope) DO UPDATE SET version = version + 1, updated_at = excluded.updated_at`).bind(scope, at)))
}

/** The stamps for some scopes, as { scope: version } (0 for one never bumped). */
export async function readStamps(db: D1Database, scopes: string[]) {
  const unique = Array.from(new Set(scopes.filter(scope => scope && !scope.endsWith(':'))))
  const out: Record<string, number> = Object.fromEntries(unique.map(scope => [scope, 0]))
  if (!unique.length) return out
  await ensureStampTable(db)
  const rows = ((await db.prepare(`SELECT scope, version FROM change_stamps WHERE scope IN (${unique.map(() => '?').join(', ')})`).bind(...unique).all()).results || []) as Array<{ scope: string, version: number }>
  for (const row of rows) out[row.scope] = Number(row.version || 0)
  return out
}

/** Does a successful request change something other people may need to see? */
export function changesSharedState(method: string, path: string, status: number) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase())) return false
  if (status >= 400) return false
  return !PERSONAL_PATHS.some(pattern => pattern.test(path))
}
