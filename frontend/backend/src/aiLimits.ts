// The free AI each person gets a day, and what a report costs after that. Ami can change these.
// Read at most once a minute per worker, and a failed read falls back to the defaults, so AI never stops over this.

export const DEFAULT_AI_LIMITS = { freeAiPerDay: 1, freeReportsPerDay: 2, reportCredits: 50 }
export type AiLimits = typeof DEFAULT_AI_LIMITS

export class AiLimitsError extends Error {
  status = 400
}

const CACHE_MS = 60_000
let cached: { db: object, at: number, limits: AiLimits } | null = null

export async function aiLimits(db: D1Database): Promise<AiLimits> {
  if (cached && cached.db === db && Date.now() - cached.at < CACHE_MS) return cached.limits
  // The table is made when Ami first saves, so until then this is just the defaults.
  const row = await db.prepare(`SELECT free_ai_per_day, free_reports_per_day, report_credits FROM ai_limits WHERE id = 1`).first().catch(() => null) as Record<string, any> | null
  const limits = row ? { freeAiPerDay: Number(row.free_ai_per_day), freeReportsPerDay: Number(row.free_reports_per_day), reportCredits: Number(row.report_credits) } : DEFAULT_AI_LIMITS
  cached = { db: db as object, at: Date.now(), limits }
  return limits
}

function whole(value: unknown, label: string, least: number, most: number) {
  const number = Number(value)
  if (!Number.isInteger(number) || number < least || number > most) throw new AiLimitsError(`${label} must be a whole number from ${least} to ${most}.`)
  return number
}

export async function saveAiLimits(db: D1Database, input: Record<string, unknown>, actor: string) {
  const limits = {
    freeAiPerDay: whole(input.freeAiPerDay, 'Free AI uses a day', 0, 100),
    freeReportsPerDay: whole(input.freeReportsPerDay, 'Free AI reports a day', 0, 100),
    reportCredits: whole(input.reportCredits, 'Credits for each further report', 1, 5000),
  }
  await db.prepare(`CREATE TABLE IF NOT EXISTS ai_limits (id INTEGER PRIMARY KEY, free_ai_per_day INTEGER NOT NULL, free_reports_per_day INTEGER NOT NULL, report_credits INTEGER NOT NULL, updated_by TEXT, updated_at TEXT)`).run()
  await db.prepare(`INSERT INTO ai_limits (id, free_ai_per_day, free_reports_per_day, report_credits, updated_by, updated_at) VALUES (1, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET free_ai_per_day = excluded.free_ai_per_day, free_reports_per_day = excluded.free_reports_per_day, report_credits = excluded.report_credits, updated_by = excluded.updated_by, updated_at = excluded.updated_at`)
    .bind(limits.freeAiPerDay, limits.freeReportsPerDay, limits.reportCredits, actor, new Date().toISOString()).run()
  cached = { db: db as object, at: Date.now(), limits }
  return limits
}
