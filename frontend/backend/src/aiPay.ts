// Ndovera AI generation is paid in AI credits (from 20 October 2026).
// 1 credit is worth ₦1; credits come from credit bundles (aiTutor.ts).
//
//   Assignments, quizzes and tests  100 credits per subject
//   Examination questions           200 credits per subject
//   Student notes / materials        50 credits per subject
//   Regenerating the whole set      half
//
// One generation is charged once, however many steps it takes to write: the
// charge is keyed by what is being generated (an assessment, a material draft),
// so a retry or a page refresh never charges twice. Editing a single question or
// section is not a new set and is not charged.
//
// The teacher's own credits pay first; when they are short, credits the school
// has bought for its staff pay instead. Before the start date every generation
// is recorded at 0 so teachers can see what it will cost.

import { AI_CREDIT_BUNDLES, creditBalances, refundAiCredits, spendAiCredits } from './aiTutor'

export const AI_PAY_START = '2026-10-20T00:00:00+01:00'
export const AI_CREDIT_PRICES = { assignment: 100, exam: 200, notes: 50 } as const
export type AiPayKind = keyof typeof AI_CREDIT_PRICES

export class AiPayError extends Error {
  status: number
  details: Record<string, unknown>
  constructor(message: string, status = 402, details: Record<string, unknown> = {}) {
    super(message)
    this.status = status
    this.details = details
  }
}

const now = () => new Date().toISOString()

const readyDbs = new WeakSet<object>()
export async function ensureAiPayTables(db: D1Database) {
  if (readyDbs.has(db as object)) return
  for (const statement of [
    `CREATE TABLE IF NOT EXISTS ai_pay_ledger (
      id TEXT PRIMARY KEY, ref_key TEXT NOT NULL UNIQUE, owner_key TEXT, tenant_id TEXT, user_id TEXT, kind TEXT NOT NULL, regenerate INTEGER NOT NULL DEFAULT 0,
      amount INTEGER NOT NULL, list_price INTEGER NOT NULL, label TEXT, free_reason TEXT, created_at TEXT NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_ai_pay_ledger_user ON ai_pay_ledger(user_id, created_at)`,
  ]) await db.prepare(statement).run()
  readyDbs.add(db as object)
}

/** `startsAt` can be moved by the AI_PAY_START variable (tests, or a later launch). */
export function isPayActive(at = new Date(), startsAt = AI_PAY_START) {
  return at.getTime() >= (Date.parse(startsAt) || Date.parse(AI_PAY_START))
}

export function priceOf(kind: AiPayKind, regenerate = false) {
  const price = AI_CREDIT_PRICES[kind]
  return regenerate ? Math.ceil(price / 2) : price
}

/** What an assessment kind costs to generate. */
export function kindOfAssessment(kind: string): AiPayKind {
  return String(kind) === 'exam' ? 'exam' : 'assignment'
}

/** What a material kind costs: notes are notes; question sets are priced as assessments. */
export function kindOfMaterial(kind: string): AiPayKind {
  if (kind === 'mock_exam') return 'exam'
  if (['practice_questions', 'worksheet'].includes(kind)) return 'assignment'
  return 'notes'
}

export type ChargeInput = {
  tenantId: string, userId: string, settingsKey: string, kind: AiPayKind, refKey: string, label: string, regenerate?: boolean, at?: Date, startsAt?: string
}

/**
 * Charge one generation in credits, once. Throws AiPayError (402) when neither
 * the teacher nor the school has enough credits, with what is needed.
 */
export async function chargeGeneration(db: D1Database, input: ChargeInput) {
  await ensureAiPayTables(db)
  const existing = await db.prepare(`SELECT * FROM ai_pay_ledger WHERE ref_key = ?`).bind(input.refKey).first() as Record<string, any> | null
  if (existing) return { charged: false, alreadyPaid: true, credits: Number(existing.amount || 0) }
  const price = priceOf(input.kind, Boolean(input.regenerate))
  const id = `aip_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`
  const record = (ownerKey: string | null, amount: number, freeReason: string | null) => db.prepare(`INSERT OR IGNORE INTO ai_pay_ledger
    (id, ref_key, owner_key, tenant_id, user_id, kind, regenerate, amount, list_price, label, free_reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(id, input.refKey, ownerKey, input.tenantId, input.userId, input.kind, input.regenerate ? 1 : 0, amount, price, input.label.slice(0, 200), freeReason, now()).run()

  if (!isPayActive(input.at, input.startsAt)) {
    await record(null, 0, 'before_start')
    return { charged: false, free: true, credits: 0, price, startsAt: input.startsAt || AI_PAY_START }
  }
  const spent = await spendAiCredits(db, { settingsKey: input.settingsKey, tenantId: input.tenantId, credits: price })
  if (!spent) {
    const balances = await creditBalances(db, input.settingsKey, input.tenantId)
    throw new AiPayError(`This needs ${price} AI credits. You have ${balances.credits}${balances.schoolCredits ? ` (your school has ${balances.schoolCredits})` : ''}. Buy a credit bundle to continue.`, 402, {
      needsCredits: true, price, credits: balances.credits, schoolCredits: balances.schoolCredits, kind: input.kind, regenerate: Boolean(input.regenerate),
    })
  }
  const written = await record(spent.paidBy === 'school' ? `school:${input.tenantId}` : `user:${input.userId}`, price, null)
  // Someone else recorded the same generation a moment ago: give these credits back.
  if (!written.meta?.changes) {
    await refundAiCredits(db, { settingsKey: input.settingsKey, tenantId: input.tenantId, credits: price, paidBy: spent.paidBy === 'school' ? 'school' : 'individual' })
    return { charged: false, alreadyPaid: true, credits: price }
  }
  return { charged: true, credits: price, paidBy: spent.paidBy, balance: spent.balance }
}

export async function walletSummary(db: D1Database, input: { tenantId: string, userId: string, settingsKey: string }, startsAt = AI_PAY_START) {
  await ensureAiPayTables(db)
  const [balances, recent] = await Promise.all([
    creditBalances(db, input.settingsKey, input.tenantId),
    db.prepare(`SELECT kind, regenerate, amount, list_price, label, free_reason, owner_key, created_at FROM ai_pay_ledger WHERE user_id = ? ORDER BY created_at DESC LIMIT 20`).bind(input.userId).all(),
  ])
  return {
    credits: balances.credits, schoolCredits: balances.schoolCredits, active: isPayActive(new Date(), startsAt), startsAt,
    prices: { ...AI_CREDIT_PRICES, regenerateFactor: 0.5 }, creditValueNaira: 1, bundles: AI_CREDIT_BUNDLES,
    recent: ((recent.results || []) as Record<string, any>[]).map(row => ({
      kind: row.kind, regenerate: Boolean(row.regenerate), credits: Number(row.amount || 0), price: Number(row.list_price || 0), label: row.label,
      free: Boolean(row.free_reason), paidBy: String(row.owner_key || '').startsWith('school:') ? 'school' : 'you', createdAt: row.created_at,
    })),
  }
}

/** The latest whole-set regeneration of something (its ledger stamp), so the next writing asks for a new version. */
export async function latestRegeneration(db: D1Database, refPrefix: string) {
  await ensureAiPayTables(db)
  const row = await db.prepare(`SELECT MAX(created_at) AS at FROM ai_pay_ledger WHERE ref_key LIKE ?`).bind(`${refPrefix}%`).first() as Record<string, any> | null
  return String(row?.at || '')
}
