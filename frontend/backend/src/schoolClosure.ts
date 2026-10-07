// Closing a school. Only the school's Owner can ask; the Head of School cannot.
//
//   Owner requests closure (reason, category, school name typed to confirm)
//   → Ndovera admins (Ami) are alerted at once
//   → a 72-hour window opens, during which the Owner can revoke it
//   → when the window ends, the scheduled job closes the school: the website
//     goes offline and nobody in the school can use Ndovera. Nothing is deleted;
//     an Ndovera admin can reopen the school.
//
// Every step is kept in school_closure_requests and the school's audit trail.

export class ClosureError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

export const CLOSURE_DELAY_MS = 72 * 60 * 60 * 1000
export const CLOSURE_CATEGORIES = ['financial', 'enrolment', 'relocation', 'merger', 'regulatory', 'ownership_change', 'other'] as const

let _ready = false
export function resetClosureCache() { _ready = false; closedTenants.clear() }

export async function ensureClosureTables(db: D1Database) {
  if (_ready) return
  await db.prepare(`CREATE TABLE IF NOT EXISTS school_closure_requests (
    id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, school_name TEXT,
    requested_by TEXT NOT NULL, requested_by_name TEXT, category TEXT NOT NULL, reason TEXT NOT NULL,
    status TEXT NOT NULL, requested_at TEXT NOT NULL, effective_at TEXT NOT NULL,
    revoked_at TEXT, revoked_by TEXT, revoke_note TEXT,
    acknowledged_at TEXT, acknowledged_by TEXT, admin_note TEXT,
    executed_at TEXT, reopened_at TEXT, reopened_by TEXT
  )`).run()
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_closure_tenant ON school_closure_requests(tenant_id, status)`).run()
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_closure_due ON school_closure_requests(status, effective_at)`).run()
  _ready = true
}

export function mapClosure(row: Record<string, any> | null) {
  if (!row) return null
  return {
    id: row.id, tenantId: row.tenant_id, schoolName: row.school_name || '', requestedBy: row.requested_by, requestedByName: row.requested_by_name || '',
    category: row.category, reason: row.reason, status: row.status, requestedAt: row.requested_at, effectiveAt: row.effective_at,
    revokedAt: row.revoked_at || null, revokedBy: row.revoked_by || '', revokeNote: row.revoke_note || '',
    acknowledgedAt: row.acknowledged_at || null, acknowledgedBy: row.acknowledged_by || '', adminNote: row.admin_note || '',
    executedAt: row.executed_at || null, reopenedAt: row.reopened_at || null, reopenedBy: row.reopened_by || '',
  }
}

/** The school's current closure request (pending or executed), if any. */
export async function getActiveClosure(db: D1Database, tenantId: string) {
  await ensureClosureTables(db)
  const row = await db.prepare(`SELECT * FROM school_closure_requests WHERE tenant_id = ? AND status IN ('pending', 'executed') ORDER BY requested_at DESC LIMIT 1`).bind(tenantId).first() as Record<string, any> | null
  return mapClosure(row)
}

export async function listClosureHistory(db: D1Database, tenantId: string) {
  await ensureClosureTables(db)
  const rows = await db.prepare(`SELECT * FROM school_closure_requests WHERE tenant_id = ? ORDER BY requested_at DESC LIMIT 20`).bind(tenantId).all()
  return ((rows.results || []) as Record<string, any>[]).map(mapClosure)
}

export async function requestClosure(db: D1Database, options: {
  tenantId: string, schoolName: string, actor: { id: string, name: string }, category: unknown, reason: unknown, confirmName: unknown, now?: Date,
}) {
  await ensureClosureTables(db)
  const category = String(options.category || '')
  if (!(CLOSURE_CATEGORIES as readonly string[]).includes(category)) throw new ClosureError('Choose why the school is closing.')
  const reason = String(options.reason || '').trim().slice(0, 3000)
  if (reason.length < 20) throw new ClosureError('Explain the reason for closing in at least 20 characters.')
  const typed = String(options.confirmName || '').trim().toLowerCase().replace(/\s+/g, ' ')
  if (!typed || typed !== options.schoolName.trim().toLowerCase().replace(/\s+/g, ' ')) throw new ClosureError('Type the school\'s name exactly as shown to confirm.')
  const existing = await getActiveClosure(db, options.tenantId)
  if (existing?.status === 'pending') throw new ClosureError('A closure is already scheduled for this school.', 409)
  if (existing?.status === 'executed') throw new ClosureError('This school is already closed.', 409)
  const now = options.now || new Date()
  const id = `closure-${crypto.randomUUID()}`
  await db.prepare(`INSERT INTO school_closure_requests (id, tenant_id, school_name, requested_by, requested_by_name, category, reason, status, requested_at, effective_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`).bind(id, options.tenantId, options.schoolName, options.actor.id, options.actor.name, category, reason,
    now.toISOString(), new Date(now.getTime() + CLOSURE_DELAY_MS).toISOString()).run()
  return mapClosure(await db.prepare(`SELECT * FROM school_closure_requests WHERE id = ?`).bind(id).first() as Record<string, any>)!
}

/** The Owner changes their mind within the 72 hours. */
export async function revokeClosure(db: D1Database, options: { tenantId: string, actor: { id: string, name: string }, note?: unknown, now?: Date }) {
  const closure = await getActiveClosure(db, options.tenantId)
  if (!closure || closure.status !== 'pending') throw new ClosureError('There is no pending closure to revoke.', 404)
  const now = options.now || new Date()
  if (now.toISOString() >= closure.effectiveAt) throw new ClosureError('The 72 hours have passed; the school is being closed. Contact Ndovera to reopen it.', 409)
  const result = await db.prepare(`UPDATE school_closure_requests SET status = 'revoked', revoked_at = ?, revoked_by = ?, revoke_note = ? WHERE id = ? AND status = 'pending'`)
    .bind(now.toISOString(), options.actor.name, String(options.note || '').trim().slice(0, 1000) || null, closure.id).run()
  if (!Number((result as any)?.meta?.changes ?? 1)) throw new ClosureError('This closure changed a moment ago. Reload and try again.', 409)
  return mapClosure(await db.prepare(`SELECT * FROM school_closure_requests WHERE id = ?`).bind(closure.id).first() as Record<string, any>)!
}

/** Ndovera admin: every pending and recent closure across schools. */
export async function listClosuresForAdmin(db: D1Database) {
  await ensureClosureTables(db)
  const rows = await db.prepare(`SELECT * FROM school_closure_requests ORDER BY CASE status WHEN 'pending' THEN 0 WHEN 'executed' THEN 1 ELSE 2 END, requested_at DESC LIMIT 200`).all()
  return ((rows.results || []) as Record<string, any>[]).map(mapClosure)
}

export async function acknowledgeClosure(db: D1Database, options: { id: string, actor: { id: string, name: string }, note?: unknown }) {
  await ensureClosureTables(db)
  const row = await db.prepare(`SELECT * FROM school_closure_requests WHERE id = ?`).bind(options.id).first() as Record<string, any> | null
  if (!row) throw new ClosureError('Closure request not found.', 404)
  await db.prepare(`UPDATE school_closure_requests SET acknowledged_at = COALESCE(acknowledged_at, ?), acknowledged_by = COALESCE(acknowledged_by, ?), admin_note = COALESCE(?, admin_note) WHERE id = ?`)
    .bind(new Date().toISOString(), options.actor.name, String(options.note || '').trim().slice(0, 1000) || null, options.id).run()
  return mapClosure(await db.prepare(`SELECT * FROM school_closure_requests WHERE id = ?`).bind(options.id).first() as Record<string, any>)!
}

/** Pending requests whose 72 hours are over. The caller closes each school. */
export async function dueClosures(db: D1Database, now = new Date()) {
  await ensureClosureTables(db)
  const rows = await db.prepare(`SELECT * FROM school_closure_requests WHERE status = 'pending' AND effective_at <= ? ORDER BY effective_at LIMIT 20`).bind(now.toISOString()).all()
  return ((rows.results || []) as Record<string, any>[]).map(mapClosure).filter(Boolean) as NonNullable<ReturnType<typeof mapClosure>>[]
}

export async function markExecuted(db: D1Database, id: string, now = new Date()) {
  const result = await db.prepare(`UPDATE school_closure_requests SET status = 'executed', executed_at = ? WHERE id = ? AND status = 'pending'`).bind(now.toISOString(), id).run()
  return Number((result as any)?.meta?.changes ?? 1) > 0
}

export async function markReopened(db: D1Database, tenantId: string, actorName: string) {
  await ensureClosureTables(db)
  await db.prepare(`UPDATE school_closure_requests SET status = 'reopened', reopened_at = ?, reopened_by = ? WHERE tenant_id = ? AND status = 'executed'`)
    .bind(new Date().toISOString(), actorName, tenantId).run()
  closedTenants.delete(tenantId)
}

// ─── Is this school closed? (checked on every signed-in request) ─────────────
// A short per-isolate cache keeps this to one small query per school per minute.

const closedTenants = new Map<string, { closed: boolean, at: number }>()
const CACHE_MS = 60_000

export async function isTenantClosed(db: D1Database, tenantId: string) {
  if (!tenantId) return false
  const cached = closedTenants.get(tenantId)
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.closed
  // The closure record counts too: other flows recompute a school's status
  // (payments, approvals) and must not quietly reopen a closed school.
  const row = await db.prepare(`SELECT t.status AS status, (SELECT COUNT(*) FROM school_closure_requests r WHERE r.tenant_id = t.id AND r.status = 'executed') AS executed FROM tenants t WHERE t.id = ?`)
    .bind(tenantId).first().catch(() => db.prepare(`SELECT status, 0 AS executed FROM tenants WHERE id = ?`).bind(tenantId).first().catch(() => null)) as Record<string, any> | null
  const closed = String(row?.status || '') === 'closed' || Number(row?.executed || 0) > 0
  closedTenants.set(tenantId, { closed, at: Date.now() })
  return closed
}

export function forgetTenantClosure(tenantId: string) {
  closedTenants.delete(tenantId)
}
