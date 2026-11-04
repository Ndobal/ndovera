// AI on reports: two free a day for each person, then 50 AI credits each. Charged before the AI runs and given
// back if it fails, so nobody pays for a report they did not get.

import { refundAiCredits, spendAiCredits } from './aiTutor'

export const REPORT_AI_FREE_PER_DAY = 2
export const REPORT_AI_CREDITS = 50

export class ReportAiError extends Error {
  status = 402
}

const ready = new WeakSet<object>()
async function ensureTable(db: D1Database) {
  if (ready.has(db as object)) return
  await db.prepare(`CREATE TABLE IF NOT EXISTS ai_report_usage (settings_key TEXT NOT NULL, day TEXT NOT NULL, used INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (settings_key, day))`).run()
  ready.add(db as object)
}

const today = () => new Date(Date.now() + 3600_000).toISOString().slice(0, 10)

/** Takes one free report or 50 credits, and returns how to give it back. */
export async function chargeReportAi(db: D1Database, person: { settingsKey: string, tenantId: string }) {
  await ensureTable(db)
  const day = today()
  // Only one request can take the last free report.
  const free = await db.prepare(`INSERT INTO ai_report_usage (settings_key, day, used) VALUES (?, ?, 1)
    ON CONFLICT(settings_key, day) DO UPDATE SET used = used + 1 WHERE used < ${REPORT_AI_FREE_PER_DAY}`).bind(person.settingsKey, day).run()
  if (Number((free as any)?.meta?.changes || 0)) {
    return async () => { await db.prepare(`UPDATE ai_report_usage SET used = MAX(used - 1, 0) WHERE settings_key = ? AND day = ?`).bind(person.settingsKey, day).run() }
  }
  const paid = await spendAiCredits(db, { settingsKey: person.settingsKey, tenantId: person.tenantId, credits: REPORT_AI_CREDITS })
  if (!paid || paid.paidBy === 'none') throw new ReportAiError(`Your ${REPORT_AI_FREE_PER_DAY} free AI reports for today are used. Each further report costs ${REPORT_AI_CREDITS} AI credits: buy credits to continue.`)
  return async () => { await refundAiCredits(db, { settingsKey: person.settingsKey, tenantId: person.tenantId, credits: REPORT_AI_CREDITS, paidBy: paid.paidBy as 'individual' | 'school' }) }
}
