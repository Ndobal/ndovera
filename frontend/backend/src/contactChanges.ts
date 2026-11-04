// A school changes a user's email or phone 3 times a month free. After that, a pack of 5 more can be bought, at a price
// Ami sets (shown and charged in the buyer's currency). Bought changes do not expire. Setting a first address is free.

export const FREE_CHANGES_PER_MONTH = 3
export const EXTRA_CHANGES_PACK = 5
export const DEFAULT_PACK_NAIRA = 1500

export class ContactLimitError extends Error {
  status: number
  details: Record<string, unknown>
  constructor(message: string, status = 402, details: Record<string, unknown> = {}) { super(message); this.status = status; this.details = details }
}

const ready = new WeakSet<object>()
export async function ensureContactChangeTables(db: D1Database) {
  if (ready.has(db as object)) return
  for (const sql of [
    `CREATE TABLE IF NOT EXISTS school_contact_changes (tenant_id TEXT NOT NULL, month TEXT NOT NULL, used INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (tenant_id, month))`,
    `CREATE TABLE IF NOT EXISTS school_contact_wallet (tenant_id TEXT PRIMARY KEY, extra INTEGER NOT NULL DEFAULT 0)`,
    `CREATE TABLE IF NOT EXISTS contact_change_buys (tx_ref TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, amount_naira REAL NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL, paid_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS contact_change_price (id INTEGER PRIMARY KEY CHECK (id = 1), naira REAL NOT NULL, updated_by TEXT, updated_at TEXT)`,
  ]) await db.prepare(sql).run()
  ready.add(db as object)
}

const thisMonth = () => new Date(Date.now() + 3600_000).toISOString().slice(0, 7)

export async function packPrice(db: D1Database) {
  await ensureContactChangeTables(db)
  const row = await db.prepare(`SELECT naira FROM contact_change_price WHERE id = 1`).first() as Record<string, any> | null
  return Number(row?.naira) || DEFAULT_PACK_NAIRA
}

export async function setPackPrice(db: D1Database, naira: unknown, actor: string) {
  await ensureContactChangeTables(db)
  const value = Number(naira)
  if (!Number.isFinite(value) || value <= 0) throw new ContactLimitError('Enter a price above zero.', 400)
  await db.prepare(`INSERT INTO contact_change_price (id, naira, updated_by, updated_at) VALUES (1, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET naira = excluded.naira, updated_by = excluded.updated_by, updated_at = excluded.updated_at`).bind(value, actor, new Date().toISOString()).run()
}

export async function changeAllowance(db: D1Database, tenantId: string) {
  await ensureContactChangeTables(db)
  const used = await db.prepare(`SELECT used FROM school_contact_changes WHERE tenant_id = ? AND month = ?`).bind(tenantId, thisMonth()).first() as Record<string, any> | null
  const wallet = await db.prepare(`SELECT extra FROM school_contact_wallet WHERE tenant_id = ?`).bind(tenantId).first() as Record<string, any> | null
  return { freePerMonth: FREE_CHANGES_PER_MONTH, freeLeft: Math.max(0, FREE_CHANGES_PER_MONTH - Number(used?.used || 0)), extra: Number(wallet?.extra || 0), packSize: EXTRA_CHANGES_PACK, packNaira: await packPrice(db) }
}

/** Takes one change, and returns how to give it back. Only one request can take the last one. */
export async function takeContactChange(db: D1Database, tenantId: string) {
  await ensureContactChangeTables(db)
  const month = thisMonth()
  const free = await db.prepare(`INSERT INTO school_contact_changes (tenant_id, month, used) VALUES (?, ?, 1)
    ON CONFLICT(tenant_id, month) DO UPDATE SET used = used + 1 WHERE used < ${FREE_CHANGES_PER_MONTH}`).bind(tenantId, month).run()
  if (Number((free as any)?.meta?.changes || 0)) {
    return async () => { await db.prepare(`UPDATE school_contact_changes SET used = MAX(used - 1, 0) WHERE tenant_id = ? AND month = ?`).bind(tenantId, month).run() }
  }
  const extra = await db.prepare(`UPDATE school_contact_wallet SET extra = extra - 1 WHERE tenant_id = ? AND extra > 0`).bind(tenantId).run()
  if (Number((extra as any)?.meta?.changes || 0)) {
    return async () => { await db.prepare(`UPDATE school_contact_wallet SET extra = extra + 1 WHERE tenant_id = ?`).bind(tenantId).run() }
  }
  throw new ContactLimitError(`Your school has used its ${FREE_CHANGES_PER_MONTH} free email and phone changes this month. Buy ${EXTRA_CHANGES_PACK} more to continue.`, 402, { needsChanges: true })
}

export async function recordPackBuy(db: D1Database, txRef: string, tenantId: string, naira: number) {
  await ensureContactChangeTables(db)
  await db.prepare(`INSERT INTO contact_change_buys (tx_ref, tenant_id, amount_naira, status, created_at) VALUES (?, ?, ?, 'pending', ?)`).bind(txRef, tenantId, naira, new Date().toISOString()).run()
}

/** Adds the pack once, when Flutterwave says it was paid in full. */
export async function settlePackBuy(db: D1Database, txRef: string, verified: { status: string, amount: number, currency: string }) {
  await ensureContactChangeTables(db)
  const buy = await db.prepare(`SELECT * FROM contact_change_buys WHERE tx_ref = ?`).bind(txRef).first() as Record<string, any> | null
  if (!buy) return { paid: false, found: false, tenantId: '' }
  if (buy.status === 'paid') return { paid: true, found: true, tenantId: String(buy.tenant_id) }
  const ok = ['successful', 'completed'].includes(String(verified.status).toLowerCase()) && String(verified.currency).toUpperCase() === 'NGN' && Number(verified.amount) + 0.005 >= Number(buy.amount_naira)
  if (!ok) return { paid: false, found: true, tenantId: String(buy.tenant_id) }
  const claimed = await db.prepare(`UPDATE contact_change_buys SET status = 'paid', paid_at = ? WHERE tx_ref = ? AND status != 'paid'`).bind(new Date().toISOString(), txRef).run()
  if (Number((claimed as any)?.meta?.changes || 0)) {
    await db.prepare(`INSERT INTO school_contact_wallet (tenant_id, extra) VALUES (?, ?) ON CONFLICT(tenant_id) DO UPDATE SET extra = extra + excluded.extra`).bind(buy.tenant_id, EXTRA_CHANGES_PACK).run()
  }
  return { paid: true, found: true, tenantId: String(buy.tenant_id) }
}
