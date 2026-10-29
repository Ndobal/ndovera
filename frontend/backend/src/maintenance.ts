// Upkeep jobs that tidy old rows (backfills) used to run whenever a Worker instance started.
// Instances are short-lived, so an in-memory "ran recently" flag rarely held and the jobs
// re-read whole tables many times a day (Oct 2026: the top read costs on D1). The last run is
// kept in the database instead: checking it is one primary-key read.

const readyDbs = new WeakSet<object>()

async function ensureMaintenanceTable(db: D1Database) {
  if (readyDbs.has(db as object)) return
  await db.prepare(`CREATE TABLE IF NOT EXISTS maintenance_runs (key TEXT PRIMARY KEY, ran_at TEXT NOT NULL)`).run()
  readyDbs.add(db as object)
}

/**
 * True (and the run is recorded) when `key` has not run within `intervalMs`; false otherwise.
 * Two instances racing may both run once; the jobs are safe to repeat.
 */
export async function claimMaintenanceRun(db: D1Database, key: string, intervalMs: number) {
  await ensureMaintenanceTable(db)
  const row = await db.prepare(`SELECT ran_at FROM maintenance_runs WHERE key = ?`).bind(key).first() as Record<string, any> | null
  const last = Date.parse(String(row?.ran_at || ''))
  if (Number.isFinite(last) && Date.now() - last < intervalMs) return false
  await db.prepare(`INSERT INTO maintenance_runs (key, ran_at) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET ran_at = excluded.ran_at`).bind(key, new Date().toISOString()).run()
  return true
}
