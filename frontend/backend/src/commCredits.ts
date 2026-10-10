// Parent notifications (N20) — message units: prices, grants, the ledger and reservations.
//
// Spec: `messaging whatsapp.md`. Paid channels (WhatsApp, SMS) are bought in units;
// email is free to schools for now; in-app is always free.
//
//   WhatsApp  ₦15.20 a unit (1520 kobo)     10 free units per school per term
//   SMS       ₦8.00 a segment (800 kobo)    10 free units per school per term
//   Email     ₦0 (billing mode FREE)        no units needed while free
//
// A unit lives in a grant: the term allowance (expires at term end), a Super Admin
// gift (its own expiry, or none), or a purchase (never expires). Units are spent in
// that order — expiring term allowance, expiring gifts, non-expiring gifts, purchases
// — earliest expiry first within each.
//
// Money is integer kobo and units are integers: no floating point anywhere.
//
// Reservations are all-or-nothing. A whole batch's units are reserved in ONE D1 batch
// (a transaction). Each grant row carries CHECK constraints (reserved never above
// remaining, nothing negative), and reserving from an expired grant is made to break
// the constraint too — so if another batch took the last units first, or a grant
// expired in between, the whole reservation rolls back and balances are unchanged.
// The database, not a read-then-write in a Worker, is the authority.

export const CHANNELS = ['whatsapp', 'sms', 'email'] as const
export type Channel = typeof CHANNELS[number]
export const PAID_CHANNELS: Channel[] = ['whatsapp', 'sms']
export const CHANNEL_LABELS: Record<Channel, string> = { whatsapp: 'WhatsApp', sms: 'SMS', email: 'Email' }

export const DEFAULT_PRICES: Record<Channel, { kobo: number, mode: 'PAID' | 'FREE' }> = {
  whatsapp: { kobo: 1520, mode: 'PAID' },
  sms: { kobo: 800, mode: 'PAID' },
  email: { kobo: 0, mode: 'FREE' },
}
export const DEFAULT_TERM_ALLOWANCE = 10
export const PACKAGE_SIZES = [10, 50, 100, 500, 1000]
export const MAX_PURCHASE_UNITS = 100_000
export const QUOTE_MINUTES = 30

// Units spent first: the lower the rank, the sooner it goes.
const SOURCE_RANK: Record<string, number> = { term_allowance: 0, gift: 1, purchase: 2 }

export class CommError extends Error {
  status: number
  details: Record<string, unknown>
  constructor(message: string, status = 400, details: Record<string, unknown> = {}) {
    super(message)
    this.status = status
    this.details = details
  }
}

export const isChannel = (value: unknown): value is Channel => (CHANNELS as readonly string[]).includes(String(value))
export const nowIso = () => new Date().toISOString()
export const newId = (prefix: string) => `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`
export const formatNaira = (kobo: number) => `₦${(kobo / 100).toLocaleString('en-NG', { minimumFractionDigits: kobo % 100 ? 2 : 0, maximumFractionDigits: 2 })}`

const readyDbs = new WeakSet<object>()
export async function ensureCommTables(db: D1Database) {
  if (readyDbs.has(db as object)) return
  const statements = [
    `CREATE TABLE IF NOT EXISTS comm_prices (
      id TEXT PRIMARY KEY, channel TEXT NOT NULL, unit_price_kobo INTEGER NOT NULL CHECK (unit_price_kobo >= 0), billing_mode TEXT NOT NULL,
      version INTEGER NOT NULL, effective_from TEXT NOT NULL, notice TEXT, created_by TEXT, created_at TEXT NOT NULL, UNIQUE(channel, version))`,
    `CREATE TABLE IF NOT EXISTS comm_platform_config (key TEXT PRIMARY KEY, value TEXT, updated_by TEXT, updated_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS comm_grants (
      id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, channel TEXT NOT NULL, source TEXT NOT NULL,
      initial_units INTEGER NOT NULL CHECK (initial_units > 0),
      remaining_units INTEGER NOT NULL CHECK (remaining_units >= 0),
      reserved_units INTEGER NOT NULL DEFAULT 0 CHECK (reserved_units >= 0 AND reserved_units <= remaining_units),
      expires_at TEXT, grant_key TEXT, reason TEXT, note TEXT, purchase_id TEXT, actor_id TEXT, actor_name TEXT,
      reversed_units INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_comm_grants_key ON comm_grants(tenant_id, channel, grant_key) WHERE grant_key IS NOT NULL`,
    `CREATE INDEX IF NOT EXISTS idx_comm_grants_spend ON comm_grants(tenant_id, channel, remaining_units)`,
    `CREATE TABLE IF NOT EXISTS comm_ledger (
      id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, channel TEXT NOT NULL, op TEXT NOT NULL, units INTEGER NOT NULL,
      grant_id TEXT, batch_id TEXT, delivery_id TEXT, purchase_id TEXT, op_key TEXT NOT NULL UNIQUE, actor TEXT, note TEXT, created_at TEXT NOT NULL)`,
    `CREATE INDEX IF NOT EXISTS idx_comm_ledger_tenant ON comm_ledger(tenant_id, created_at)`,
    `CREATE TABLE IF NOT EXISTS comm_reservations (
      id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, channel TEXT NOT NULL, batch_id TEXT NOT NULL, delivery_id TEXT NOT NULL, grant_id TEXT NOT NULL,
      units INTEGER NOT NULL CHECK (units > 0), status TEXT NOT NULL, expires_at TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      UNIQUE(delivery_id, grant_id))`,
    `CREATE INDEX IF NOT EXISTS idx_comm_reservations_delivery ON comm_reservations(delivery_id, status)`,
    `CREATE INDEX IF NOT EXISTS idx_comm_reservations_expiry ON comm_reservations(status, expires_at)`,
    `CREATE TABLE IF NOT EXISTS comm_purchases (
      id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, channel TEXT NOT NULL, units INTEGER NOT NULL CHECK (units > 0),
      unit_price_kobo INTEGER NOT NULL, price_version INTEGER NOT NULL, amount_kobo INTEGER NOT NULL, currency TEXT NOT NULL DEFAULT 'NGN',
      status TEXT NOT NULL, quote_expires_at TEXT NOT NULL, tx_ref TEXT UNIQUE, provider_tx_id TEXT UNIQUE, checkout_url TEXT,
      grant_id TEXT, failure TEXT, initiated_by TEXT, initiated_name TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, paid_at TEXT)`,
    `CREATE INDEX IF NOT EXISTS idx_comm_purchases_tenant ON comm_purchases(tenant_id, created_at)`,
    `CREATE TABLE IF NOT EXISTS comm_audit (id TEXT PRIMARY KEY, tenant_id TEXT, actor TEXT, action TEXT NOT NULL, data TEXT, created_at TEXT NOT NULL)`,
    `CREATE INDEX IF NOT EXISTS idx_comm_audit_tenant ON comm_audit(tenant_id, created_at)`,
  ]
  for (const sql of statements) await db.prepare(sql).run()
  readyDbs.add(db as object)
}

export async function audit(db: D1Database, tenantId: string | null, actor: string, action: string, data: Record<string, unknown> = {}) {
  await db.prepare(`INSERT INTO comm_audit (id, tenant_id, actor, action, data, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .bind(newId('cau'), tenantId, actor, action, JSON.stringify(data), nowIso()).run()
}

// ─── Platform configuration and prices ──────────────────────────────────────

export async function getPlatformConfig(db: D1Database) {
  await ensureCommTables(db)
  const rows = ((await db.prepare(`SELECT key, value FROM comm_platform_config`).all()).results || []) as Array<{ key: string, value: string }>
  const map = Object.fromEntries(rows.map(row => [row.key, row.value]))
  const int = (key: string, fallback: number) => (map[key] !== undefined && Number.isInteger(Number(map[key])) && Number(map[key]) >= 0 ? Number(map[key]) : fallback)
  return {
    termAllowance: { whatsapp: int('allowance.whatsapp', DEFAULT_TERM_ALLOWANCE), sms: int('allowance.sms', DEFAULT_TERM_ALLOWANCE) } as Record<'whatsapp' | 'sms', number>,
    minimumPurchase: { whatsapp: int('minimum.whatsapp', 10), sms: int('minimum.sms', 10), email: int('minimum.email', 10) } as Record<Channel, number>,
    packages: PACKAGE_SIZES,
  }
}

export async function setPlatformConfig(db: D1Database, values: Record<string, number>, actor: string) {
  await ensureCommTables(db)
  const allowed = ['allowance.whatsapp', 'allowance.sms', 'minimum.whatsapp', 'minimum.sms', 'minimum.email']
  for (const [key, value] of Object.entries(values)) {
    if (!allowed.includes(key)) continue
    if (!Number.isInteger(value) || value < 0 || value > 100_000) throw new CommError(`${key} must be a whole number from 0 to 100,000.`)
    await db.prepare(`INSERT INTO comm_platform_config (key, value, updated_by, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_by = excluded.updated_by, updated_at = excluded.updated_at`)
      .bind(key, String(value), actor, nowIso()).run()
  }
  await audit(db, null, actor, 'platform_config_changed', values)
  return getPlatformConfig(db)
}

export type PriceVersion = { channel: Channel, unitPriceKobo: number, billingMode: 'PAID' | 'FREE', version: number, effectiveFrom: string, notice: string }

async function priceRows(db: D1Database, channel: Channel) {
  await ensureCommTables(db)
  const rows = ((await db.prepare(`SELECT * FROM comm_prices WHERE channel = ? ORDER BY version ASC`).bind(channel).all()).results || []) as Record<string, any>[]
  const versions: PriceVersion[] = [
    { channel, unitPriceKobo: DEFAULT_PRICES[channel].kobo, billingMode: DEFAULT_PRICES[channel].mode, version: 0, effectiveFrom: '2026-01-01T00:00:00.000Z', notice: '' },
    ...rows.map(row => ({ channel, unitPriceKobo: Number(row.unit_price_kobo), billingMode: row.billing_mode === 'FREE' ? 'FREE' as const : 'PAID' as const, version: Number(row.version), effectiveFrom: String(row.effective_from), notice: String(row.notice || '') })),
  ]
  return versions
}

/** The price in force at a moment (the latest version whose effective date has passed). */
export async function priceAt(db: D1Database, channel: Channel, at = nowIso()) {
  const versions = await priceRows(db, channel)
  return versions.filter(version => version.effectiveFrom <= at).sort((a, b) => a.version - b.version).pop() || versions[0]
}

export async function priceSchedule(db: D1Database) {
  const out: Record<string, { current: PriceVersion, upcoming: PriceVersion[] }> = {}
  for (const channel of CHANNELS) {
    const versions = await priceRows(db, channel)
    const current = await priceAt(db, channel)
    out[channel] = { current, upcoming: versions.filter(version => version.effectiveFrom > nowIso()) }
  }
  return out
}

/** A future-effective price change (Super Admin). Historical and already reserved free work is unaffected. */
export async function schedulePrice(db: D1Database, input: { channel: unknown, unitPriceKobo: unknown, billingMode?: unknown, effectiveFrom: unknown, notice?: unknown }, actor: string) {
  if (!isChannel(input.channel)) throw new CommError('Choose WhatsApp, SMS or email.')
  const kobo = Number(input.unitPriceKobo)
  if (!Number.isInteger(kobo) || kobo < 0 || kobo > 10_000_00) throw new CommError('The price must be a whole number of kobo, from 0.')
  const effective = new Date(String(input.effectiveFrom || ''))
  if (Number.isNaN(effective.getTime())) throw new CommError('Choose when the price takes effect.')
  if (effective.getTime() < Date.now() - 60_000) throw new CommError('A price change must take effect in the future, so schools can be told first.')
  const mode = input.billingMode === 'FREE' || kobo === 0 ? 'FREE' : 'PAID'
  const versions = await priceRows(db, input.channel)
  const version = Math.max(...versions.map(item => item.version)) + 1
  await db.prepare(`INSERT INTO comm_prices (id, channel, unit_price_kobo, billing_mode, version, effective_from, notice, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(newId('cpr'), input.channel, kobo, mode, version, effective.toISOString(), String(input.notice || '').slice(0, 500), actor, nowIso()).run()
  await audit(db, null, actor, 'price_scheduled', { channel: input.channel, kobo, mode, version, effectiveFrom: effective.toISOString() })
  return priceSchedule(db)
}

// ─── Grants and wallets ─────────────────────────────────────────────────────

export type Grant = {
  id: string, tenantId: string, channel: Channel, source: 'term_allowance' | 'gift' | 'purchase', initialUnits: number, remainingUnits: number,
  reservedUnits: number, expiresAt: string | null, grantKey: string | null, reason: string, note: string, actorName: string, reversedUnits: number, createdAt: string,
}
const mapGrant = (row: Record<string, any>): Grant => ({
  id: String(row.id), tenantId: String(row.tenant_id), channel: row.channel, source: row.source, initialUnits: Number(row.initial_units),
  remainingUnits: Number(row.remaining_units), reservedUnits: Number(row.reserved_units), expiresAt: row.expires_at || null, grantKey: row.grant_key || null,
  reason: String(row.reason || ''), note: String(row.note || ''), actorName: String(row.actor_name || ''), reversedUnits: Number(row.reversed_units || 0), createdAt: String(row.created_at),
})

/** Spend order: term allowance, expiring gifts, non-expiring gifts, purchases; earliest expiry first. */
export function spendOrder(a: Grant, b: Grant) {
  const rank = (grant: Grant) => (grant.source === 'gift' && !grant.expiresAt ? 1.5 : SOURCE_RANK[grant.source] ?? 3)
  return rank(a) - rank(b) || String(a.expiresAt || '9999').localeCompare(String(b.expiresAt || '9999')) || a.createdAt.localeCompare(b.createdAt)
}

export async function listGrants(db: D1Database, tenantId: string, channel?: Channel) {
  await ensureCommTables(db)
  const rows = channel
    ? await db.prepare(`SELECT * FROM comm_grants WHERE tenant_id = ? AND channel = ? ORDER BY created_at ASC`).bind(tenantId, channel).all()
    : await db.prepare(`SELECT * FROM comm_grants WHERE tenant_id = ? ORDER BY created_at ASC`).bind(tenantId).all()
  return ((rows.results || []) as Record<string, any>[]).map(mapGrant)
}

const live = (grant: Grant, at: string) => !grant.expiresAt || grant.expiresAt > at

/** Grants that can pay for something now, in the order they are spent. */
export async function spendableGrants(db: D1Database, tenantId: string, channel: Channel, at = nowIso()) {
  return (await listGrants(db, tenantId, channel)).filter(grant => live(grant, at) && grant.remainingUnits - grant.reservedUnits > 0).sort(spendOrder)
}

export async function walletSummary(db: D1Database, tenantId: string, at = nowIso()) {
  const grants = await listGrants(db, tenantId)
  const usedRows = ((await db.prepare(`SELECT channel, SUM(units) AS used FROM comm_ledger WHERE tenant_id = ? AND op = 'consume' GROUP BY channel`).bind(tenantId).all()).results || []) as Array<{ channel: string, used: number }>
  const out = {} as Record<Channel, { spendable: number, reserved: number, termAllowance: number, gifts: number, purchased: number, used: number, expiring: Array<{ units: number, expiresAt: string, source: string }> }>
  for (const channel of CHANNELS) {
    const mine = grants.filter(grant => grant.channel === channel && live(grant, at))
    const free = (grant: Grant) => grant.remainingUnits - grant.reservedUnits
    out[channel] = {
      spendable: mine.reduce((sum, grant) => sum + free(grant), 0),
      reserved: mine.reduce((sum, grant) => sum + grant.reservedUnits, 0),
      termAllowance: mine.filter(grant => grant.source === 'term_allowance').reduce((sum, grant) => sum + free(grant), 0),
      gifts: mine.filter(grant => grant.source === 'gift').reduce((sum, grant) => sum + free(grant), 0),
      purchased: mine.filter(grant => grant.source === 'purchase').reduce((sum, grant) => sum + free(grant), 0),
      used: Number(usedRows.find(row => row.channel === channel)?.used || 0),
      expiring: mine.filter(grant => grant.expiresAt && free(grant) > 0).sort(spendOrder).map(grant => ({ units: free(grant), expiresAt: grant.expiresAt!, source: grant.source })),
    }
  }
  return out
}

async function insertGrant(db: D1Database, input: {
  tenantId: string, channel: Channel, source: Grant['source'], units: number, expiresAt: string | null, grantKey: string | null,
  reason?: string, note?: string, purchaseId?: string, actorId?: string, actorName?: string, opKey: string,
}) {
  const id = newId('cgr')
  const stamp = nowIso()
  // The grant and its ledger line go in together; the unique keys make a repeat a no-op.
  const results = await db.batch([
    db.prepare(`INSERT OR IGNORE INTO comm_grants (id, tenant_id, channel, source, initial_units, remaining_units, reserved_units, expires_at, grant_key, reason, note, purchase_id, actor_id, actor_name, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(id, input.tenantId, input.channel, input.source, input.units, input.units, input.expiresAt, input.grantKey,
      input.reason || '', input.note || '', input.purchaseId || null, input.actorId || null, input.actorName || null, stamp, stamp),
    db.prepare(`INSERT OR IGNORE INTO comm_ledger (id, tenant_id, channel, op, units, grant_id, purchase_id, op_key, actor, note, created_at)
      SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM comm_grants WHERE id = ?)`).bind(newId('cle'), input.tenantId, input.channel,
      input.source === 'purchase' ? 'purchase' : 'allocate', input.units, id, input.purchaseId || null, input.opKey, input.actorName || input.actorId || 'system', input.reason || input.source, stamp, id),
  ])
  return { created: Number(results[0]?.meta?.changes || 0) > 0, id }
}

/**
 * The free term allowance, once per school, session, term and channel. Switching
 * the active term back and forth never grants twice (the grant key is unique).
 */
export async function ensureTermAllowance(db: D1Database, tenantId: string, term: { sessionId: string, termId: string, endDate: string } | null) {
  if (!term?.termId || !term.endDate) return []
  const config = await getPlatformConfig(db)
  const expiresAt = new Date(`${term.endDate.slice(0, 10)}T23:59:59+01:00`).toISOString()
  if (expiresAt <= nowIso()) return []
  const created: Channel[] = []
  for (const channel of ['whatsapp', 'sms'] as const) {
    const units = config.termAllowance[channel]
    if (!units) continue
    const key = `term_allowance:${term.sessionId}:${term.termId}`
    const result = await insertGrant(db, { tenantId, channel, source: 'term_allowance', units, expiresAt, grantKey: key, reason: 'Free units for the term', opKey: `${tenantId}:${channel}:${key}` })
    if (result.created) created.push(channel)
  }
  return created
}

// ─── Reservations ───────────────────────────────────────────────────────────

export type ReservationRequest = { deliveryId: string, channel: Channel, units: number }

/**
 * Plan which grants pay for each delivery, from a snapshot of spendable grants.
 * Returns null when the snapshot cannot cover everything (nothing is reserved).
 */
export function allocate(requests: ReservationRequest[], grantsByChannel: Record<string, Grant[]>) {
  const free = new Map<string, number>()
  for (const grants of Object.values(grantsByChannel)) for (const grant of grants) free.set(grant.id, grant.remainingUnits - grant.reservedUnits)
  const lines: Array<{ deliveryId: string, channel: Channel, grantId: string, units: number }> = []
  for (const request of requests) {
    let needed = request.units
    for (const grant of grantsByChannel[request.channel] || []) {
      if (!needed) break
      const available = free.get(grant.id) || 0
      if (available <= 0) continue
      const take = Math.min(available, needed)
      free.set(grant.id, available - take)
      lines.push({ deliveryId: request.deliveryId, channel: request.channel, grantId: grant.id, units: take })
      needed -= take
    }
    if (needed > 0) return null
  }
  return lines
}

export type ReserveResult = { ok: true, lines: number } | { ok: false, shortfall: Record<string, number> }

/**
 * Reserve units for a whole batch, or nothing. Retries a few times when another
 * batch got in first (the transaction rolls back on the CHECK constraint).
 */
export async function reserveAll(db: D1Database, tenantId: string, batchId: string, requests: ReservationRequest[], options: { expiresAt: string, extra?: D1PreparedStatement[] }): Promise<ReserveResult> {
  const needed: Record<string, number> = {}
  for (const request of requests) needed[request.channel] = (needed[request.channel] || 0) + request.units
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const at = nowIso()
    const grantsByChannel: Record<string, Grant[]> = {}
    for (const channel of Object.keys(needed) as Channel[]) grantsByChannel[channel] = await spendableGrants(db, tenantId, channel, at)
    const lines = allocate(requests, grantsByChannel)
    if (!lines) {
      const shortfall: Record<string, number> = {}
      for (const [channel, units] of Object.entries(needed)) {
        const have = (grantsByChannel[channel] || []).reduce((sum, grant) => sum + grant.remainingUnits - grant.reservedUnits, 0)
        if (have < units) shortfall[channel] = units - have
      }
      return { ok: false, shortfall }
    }
    const statements: D1PreparedStatement[] = []
    for (const line of lines) {
      // An expired grant is pushed over its CHECK constraint, so it can never fund a send.
      statements.push(db.prepare(`UPDATE comm_grants SET reserved_units = reserved_units + ? + CASE WHEN expires_at IS NOT NULL AND expires_at <= ? THEN 1000000000 ELSE 0 END, updated_at = ? WHERE id = ? AND tenant_id = ?`)
        .bind(line.units, at, at, line.grantId, tenantId))
      statements.push(db.prepare(`INSERT INTO comm_reservations (id, tenant_id, channel, batch_id, delivery_id, grant_id, units, status, expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'reserved', ?, ?, ?)`)
        .bind(newId('crs'), tenantId, line.channel, batchId, line.deliveryId, line.grantId, line.units, options.expiresAt, at, at))
      statements.push(db.prepare(`INSERT INTO comm_ledger (id, tenant_id, channel, op, units, grant_id, batch_id, delivery_id, op_key, actor, created_at) VALUES (?, ?, ?, 'reserve', ?, ?, ?, ?, ?, 'system', ?)`)
        .bind(newId('cle'), tenantId, line.channel, line.units, line.grantId, batchId, line.deliveryId, `reserve:${line.deliveryId}:${line.grantId}`, at))
    }
    try {
      await db.batch([...statements, ...(options.extra || [])])
      return { ok: true, lines: lines.length }
    } catch (error) {
      // Lost a race (CHECK constraint) or a duplicate: look again from a fresh snapshot.
      if (attempt === 3) throw error
    }
  }
  return { ok: false, shortfall: needed }
}

/** Spend a delivery's reserved units (the provider accepted a billable message). Idempotent. */
export async function consumeReservation(db: D1Database, tenantId: string, deliveryId: string) {
  const rows = ((await db.prepare(`SELECT * FROM comm_reservations WHERE tenant_id = ? AND delivery_id = ? AND status = 'reserved'`).bind(tenantId, deliveryId).all()).results || []) as Record<string, any>[]
  if (!rows.length) return 0
  const at = nowIso()
  const statements: D1PreparedStatement[] = []
  for (const row of rows) {
    statements.push(db.prepare(`UPDATE comm_reservations SET status = 'consumed', updated_at = ? WHERE id = ? AND status = 'reserved'`).bind(at, row.id))
    statements.push(db.prepare(`UPDATE comm_grants SET reserved_units = reserved_units - ?, remaining_units = remaining_units - ?, updated_at = ? WHERE id = ?`).bind(row.units, row.units, at, row.grant_id))
    statements.push(db.prepare(`INSERT OR IGNORE INTO comm_ledger (id, tenant_id, channel, op, units, grant_id, batch_id, delivery_id, op_key, actor, created_at) VALUES (?, ?, ?, 'consume', ?, ?, ?, ?, ?, 'system', ?)`)
      .bind(newId('cle'), tenantId, row.channel, row.units, row.grant_id, row.batch_id, deliveryId, `consume:${row.id}`, at))
  }
  await db.batch(statements)
  return rows.reduce((sum, row) => sum + Number(row.units), 0)
}

/** Give a delivery's reserved units back (rejected before billing, cancelled, or stale). Idempotent. */
export async function releaseReservation(db: D1Database, tenantId: string, deliveryId: string, why = 'release') {
  const rows = ((await db.prepare(`SELECT * FROM comm_reservations WHERE tenant_id = ? AND delivery_id = ? AND status = 'reserved'`).bind(tenantId, deliveryId).all()).results || []) as Record<string, any>[]
  if (!rows.length) return 0
  const at = nowIso()
  const statements: D1PreparedStatement[] = []
  for (const row of rows) {
    statements.push(db.prepare(`UPDATE comm_reservations SET status = 'released', updated_at = ? WHERE id = ? AND status = 'reserved'`).bind(at, row.id))
    statements.push(db.prepare(`UPDATE comm_grants SET reserved_units = reserved_units - ?, updated_at = ? WHERE id = ?`).bind(row.units, at, row.grant_id))
    statements.push(db.prepare(`INSERT OR IGNORE INTO comm_ledger (id, tenant_id, channel, op, units, grant_id, batch_id, delivery_id, op_key, actor, note, created_at) VALUES (?, ?, ?, 'release', ?, ?, ?, ?, ?, 'system', ?, ?)`)
      .bind(newId('cle'), tenantId, row.channel, row.units, row.grant_id, row.batch_id, deliveryId, `release:${row.id}`, why, at))
  }
  await db.batch(statements)
  return rows.reduce((sum, row) => sum + Number(row.units), 0)
}

/** Expired grants: units nobody reserved are written off in the ledger (once). */
export async function expireGrants(db: D1Database, at = nowIso()) {
  await ensureCommTables(db)
  const rows = ((await db.prepare(`SELECT * FROM comm_grants WHERE expires_at IS NOT NULL AND expires_at <= ? AND remaining_units > reserved_units LIMIT 200`).bind(at).all()).results || []) as Record<string, any>[]
  for (const row of rows) {
    const units = Number(row.remaining_units) - Number(row.reserved_units)
    await db.batch([
      db.prepare(`UPDATE comm_grants SET remaining_units = remaining_units - ?, updated_at = ? WHERE id = ? AND remaining_units - reserved_units = ?`).bind(units, at, row.id, units),
      db.prepare(`INSERT OR IGNORE INTO comm_ledger (id, tenant_id, channel, op, units, grant_id, op_key, actor, note, created_at) VALUES (?, ?, ?, 'expire', ?, ?, ?, 'system', 'expired', ?)`)
        .bind(newId('cle'), row.tenant_id, row.channel, units, row.id, `expire:${row.id}:${row.remaining_units}`, at),
    ])
  }
  return rows.length
}

// ─── Super Admin gifts ──────────────────────────────────────────────────────

export async function giftUnits(db: D1Database, input: { tenantIds: unknown, channel: unknown, units: unknown, reason: unknown, expiresAt?: unknown, note?: unknown, idempotencyKey: unknown }, actor: { id: string, name: string }, tenantExists: (id: string) => Promise<boolean>) {
  await ensureCommTables(db)
  if (!isChannel(input.channel)) throw new CommError('Choose WhatsApp, SMS or email.')
  const units = Number(input.units)
  if (!Number.isInteger(units) || units <= 0 || units > MAX_PURCHASE_UNITS) throw new CommError('Units must be a positive whole number.')
  const reason = String(input.reason || '').trim().slice(0, 300)
  if (!reason) throw new CommError('Give a reason for the gift.')
  const key = String(input.idempotencyKey || '').trim().slice(0, 100)
  if (!key) throw new CommError('Missing idempotency key.')
  let expiresAt: string | null = null
  if (input.expiresAt) {
    const date = new Date(String(input.expiresAt))
    if (Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) throw new CommError('The expiry must be in the future.')
    expiresAt = date.toISOString()
  }
  const tenantIds = Array.from(new Set((Array.isArray(input.tenantIds) ? input.tenantIds : [input.tenantIds]).map(value => String(value || '').trim()).filter(Boolean))).slice(0, 500)
  if (!tenantIds.length) throw new CommError('Choose at least one school.')
  const results: Array<{ tenantId: string, status: 'granted' | 'already_granted' | 'school_not_found', grantId?: string }> = []
  for (const tenantId of tenantIds) {
    if (!(await tenantExists(tenantId))) { results.push({ tenantId, status: 'school_not_found' }); continue }
    const grantKey = `gift:${key}`
    const result = await insertGrant(db, { tenantId, channel: input.channel, source: 'gift', units, expiresAt, grantKey, reason, note: String(input.note || '').slice(0, 500), actorId: actor.id, actorName: actor.name, opKey: `${tenantId}:${input.channel}:${grantKey}` })
    const existing = result.created ? null : await db.prepare(`SELECT id FROM comm_grants WHERE tenant_id = ? AND channel = ? AND grant_key = ?`).bind(tenantId, input.channel, grantKey).first() as any
    results.push({ tenantId, status: result.created ? 'granted' : 'already_granted', grantId: result.created ? result.id : existing?.id })
    if (result.created) await audit(db, tenantId, actor.name, 'units_gifted', { channel: input.channel, units, reason, expiresAt, grantId: result.id })
  }
  return results
}

/** Take back what is left of a gift (never what was already spent or reserved). The original stays. */
export async function reverseGift(db: D1Database, grantId: string, input: { reason: unknown }, actor: { id: string, name: string }) {
  await ensureCommTables(db)
  const row = await db.prepare(`SELECT * FROM comm_grants WHERE id = ?`).bind(grantId).first() as Record<string, any> | null
  if (!row || row.source !== 'gift') throw new CommError('Gift not found.', 404)
  const reason = String(input.reason || '').trim().slice(0, 300)
  if (!reason) throw new CommError('Give a reason for the reversal.')
  const units = Number(row.remaining_units) - Number(row.reserved_units)
  if (units <= 0) throw new CommError('Nothing is left to reverse: the rest is spent or reserved.', 409)
  const at = nowIso()
  const result = await db.batch([
    db.prepare(`UPDATE comm_grants SET remaining_units = remaining_units - ?, reversed_units = reversed_units + ?, updated_at = ? WHERE id = ? AND remaining_units - reserved_units = ?`).bind(units, units, at, grantId, units),
    db.prepare(`INSERT INTO comm_ledger (id, tenant_id, channel, op, units, grant_id, op_key, actor, note, created_at) VALUES (?, ?, ?, 'reverse', ?, ?, ?, ?, ?, ?)`)
      .bind(newId('cle'), row.tenant_id, row.channel, units, grantId, `reverse:${grantId}:${row.remaining_units}`, actor.name, reason, at),
  ])
  if (!Number(result[0]?.meta?.changes)) throw new CommError('The gift changed while you were reversing it; try again.', 409)
  await audit(db, String(row.tenant_id), actor.name, 'gift_reversed', { grantId, units, reason })
  return { reversed: units }
}

export async function listGifts(db: D1Database, filters: { tenantId?: string } = {}) {
  await ensureCommTables(db)
  const rows = filters.tenantId
    ? await db.prepare(`SELECT * FROM comm_grants WHERE source = 'gift' AND tenant_id = ? ORDER BY created_at DESC LIMIT 500`).bind(filters.tenantId).all()
    : await db.prepare(`SELECT * FROM comm_grants WHERE source = 'gift' ORDER BY created_at DESC LIMIT 500`).all()
  return ((rows.results || []) as Record<string, any>[]).map(mapGrant)
}

// ─── Purchases ──────────────────────────────────────────────────────────────

export type Purchase = {
  id: string, tenantId: string, channel: Channel, units: number, unitPriceKobo: number, priceVersion: number, amountKobo: number, currency: string,
  status: string, quoteExpiresAt: string, txRef: string | null, checkoutUrl: string | null, grantId: string | null, failure: string, createdAt: string, paidAt: string | null,
}
const mapPurchase = (row: Record<string, any>): Purchase => ({
  id: String(row.id), tenantId: String(row.tenant_id), channel: row.channel, units: Number(row.units), unitPriceKobo: Number(row.unit_price_kobo),
  priceVersion: Number(row.price_version), amountKobo: Number(row.amount_kobo), currency: String(row.currency), status: String(row.status),
  quoteExpiresAt: String(row.quote_expires_at), txRef: row.tx_ref || null, checkoutUrl: row.checkout_url || null, grantId: row.grant_id || null,
  failure: String(row.failure || ''), createdAt: String(row.created_at), paidAt: row.paid_at || null,
})

/** A server-owned quote: the price in force now, times the units. */
export async function createQuote(db: D1Database, tenantId: string, input: { channel: unknown, units: unknown }, actor: { id: string, name: string }) {
  if (!isChannel(input.channel)) throw new CommError('Choose WhatsApp, SMS or email.')
  const units = Number(input.units)
  const config = await getPlatformConfig(db)
  if (!Number.isInteger(units) || units <= 0 || units > MAX_PURCHASE_UNITS) throw new CommError('Choose a positive whole number of units.')
  if (units < config.minimumPurchase[input.channel]) throw new CommError(`The smallest purchase is ${config.minimumPurchase[input.channel]} units.`)
  const price = await priceAt(db, input.channel)
  if (price.billingMode === 'FREE') throw new CommError(`${CHANNEL_LABELS[input.channel]} is free at the moment; there is nothing to buy.`)
  const id = newId('cpu')
  const at = nowIso()
  const expires = new Date(Date.now() + QUOTE_MINUTES * 60_000).toISOString()
  await db.prepare(`INSERT INTO comm_purchases (id, tenant_id, channel, units, unit_price_kobo, price_version, amount_kobo, currency, status, quote_expires_at, initiated_by, initiated_name, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'NGN', 'quoted', ?, ?, ?, ?, ?)`).bind(id, tenantId, input.channel, units, price.unitPriceKobo, price.version, units * price.unitPriceKobo, expires, actor.id, actor.name, at, at).run()
  return getPurchase(db, tenantId, id)
}

export async function getPurchase(db: D1Database, tenantId: string, id: string) {
  await ensureCommTables(db)
  const row = await db.prepare(`SELECT * FROM comm_purchases WHERE id = ? AND tenant_id = ?`).bind(id, tenantId).first() as Record<string, any> | null
  if (!row) throw new CommError('Purchase not found.', 404)
  return mapPurchase(row)
}

export async function listPurchases(db: D1Database, tenantId: string) {
  await ensureCommTables(db)
  return (((await db.prepare(`SELECT * FROM comm_purchases WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 200`).bind(tenantId).all()).results || []) as Record<string, any>[]).map(mapPurchase)
}

/** Turn a valid quote into a checkout: one unique reference per purchase. */
export async function startCheckout(db: D1Database, tenantId: string, purchaseId: string, openCheckout: (purchase: Purchase, txRef: string) => Promise<string>) {
  const purchase = await getPurchase(db, tenantId, purchaseId)
  if (purchase.status === 'pending' && purchase.checkoutUrl) return purchase
  if (purchase.status !== 'quoted') throw new CommError('This quote has already been used.', 409)
  if (purchase.quoteExpiresAt <= nowIso()) throw new CommError('This quote has expired. Get a new one.', 409)
  // The price must still be the one quoted.
  const price = await priceAt(db, purchase.channel)
  if (price.version !== purchase.priceVersion) throw new CommError('The price has changed since this quote. Get a new one.', 409)
  const txRef = `comm_${purchase.id}`
  const url = await openCheckout(purchase, txRef)
  await db.prepare(`UPDATE comm_purchases SET status = 'pending', tx_ref = ?, checkout_url = ?, updated_at = ? WHERE id = ? AND status = 'quoted'`).bind(txRef, url, nowIso(), purchase.id).run()
  return getPurchase(db, tenantId, purchase.id)
}

export type ProviderVerification = { status: string, txRef: string, amount: number, currency: string, transactionId: string, tenantId?: string }

/**
 * Credit a purchase from the payment provider's own verification (never from the
 * browser). Succeeds once: the purchase's status and the grant key make repeats,
 * duplicate webhooks and replays return the original outcome.
 */
export async function settlePurchase(db: D1Database, txRef: string, verification: ProviderVerification) {
  await ensureCommTables(db)
  const row = await db.prepare(`SELECT * FROM comm_purchases WHERE tx_ref = ?`).bind(txRef).first() as Record<string, any> | null
  if (!row) throw new CommError('Purchase not found.', 404)
  const purchase = mapPurchase(row)
  if (purchase.status === 'paid') return { purchase, credited: false }
  const expectedNaira = purchase.amountKobo / 100
  const problems: string[] = []
  if (String(verification.status).toLowerCase() !== 'successful') problems.push(`payment status ${verification.status || 'unknown'}`)
  if (verification.txRef !== txRef) problems.push('reference mismatch')
  if (String(verification.currency).toUpperCase() !== 'NGN') problems.push(`currency ${verification.currency}`)
  if (Math.round(Number(verification.amount) * 100) !== purchase.amountKobo) problems.push(`amount ₦${verification.amount} (expected ₦${expectedNaira})`)
  if (verification.tenantId && verification.tenantId !== purchase.tenantId) problems.push('school mismatch')
  if (problems.length) {
    const status = String(verification.status).toLowerCase() === 'successful' ? 'mismatch' : (['failed', 'cancelled'].includes(String(verification.status).toLowerCase()) ? 'failed' : 'pending')
    await db.prepare(`UPDATE comm_purchases SET status = ?, failure = ?, updated_at = ? WHERE id = ? AND status <> 'paid'`).bind(status, problems.join('; '), nowIso(), purchase.id).run()
    if (status === 'mismatch') await audit(db, purchase.tenantId, 'system', 'purchase_mismatch', { purchaseId: purchase.id, problems })
    return { purchase: await getPurchase(db, purchase.tenantId, purchase.id), credited: false, problems }
  }
  const claim = await db.prepare(`UPDATE comm_purchases SET status = 'paid', provider_tx_id = ?, paid_at = ?, updated_at = ? WHERE id = ? AND status <> 'paid'`).bind(verification.transactionId || null, nowIso(), nowIso(), purchase.id).run()
  if (!Number(claim.meta?.changes)) return { purchase: await getPurchase(db, purchase.tenantId, purchase.id), credited: false }
  const grant = await insertGrant(db, { tenantId: purchase.tenantId, channel: purchase.channel, source: 'purchase', units: purchase.units, expiresAt: null, grantKey: `purchase:${purchase.id}`, reason: `Bought ${purchase.units} units`, purchaseId: purchase.id, opKey: `${purchase.tenantId}:${purchase.channel}:purchase:${purchase.id}` })
  await db.prepare(`UPDATE comm_purchases SET grant_id = ? WHERE id = ?`).bind(grant.id, purchase.id).run()
  await audit(db, purchase.tenantId, 'system', 'units_purchased', { purchaseId: purchase.id, channel: purchase.channel, units: purchase.units, amountKobo: purchase.amountKobo })
  return { purchase: await getPurchase(db, purchase.tenantId, purchase.id), credited: grant.created }
}

export async function ledgerFor(db: D1Database, tenantId: string, limit = 200) {
  await ensureCommTables(db)
  return ((await db.prepare(`SELECT * FROM comm_ledger WHERE tenant_id = ? ORDER BY created_at DESC LIMIT ?`).bind(tenantId, limit).all()).results || []) as Record<string, any>[]
}
