// Professional fees and billing.
//
// The governing rule: Ndovera keeps a continuous financial ledger for every
// student across classes, terms and sessions. Fee structures, obligations,
// payments, allocations, arrears, claims, adjustments, reversals and receipts
// stay separately identifiable and auditable. Closing a term or session never
// erases an obligation; it stays linked to its billing period and follows the
// student until it is settled, waived or formally resolved.
//
//   Fee structure  — what a class is charged for a term (Draft → Published → Closed).
//                    Editing it never reprices bills already issued.
//   Obligation     — one charge to one student: an item of a structure. Each has
//                    its own status: not_paid, partially_paid, paid, overpaid,
//                    waived, cancelled.
//   Adjustment     — discount, scholarship, waiver, credit or debit, with who
//                    authorised it, when and why. The original charge is untouched.
//   Payment        — money received (`fee_payments`, shared with the earlier
//                    system). It is allocated to named obligations, never spread
//                    arbitrarily. Mistakes are reversed, never deleted.
//   Receipt        — an immutable snapshot made when a payment is confirmed.
//   Claim          — a parent's "I have paid": submitted → under review →
//                    resolved / rejected, auto-resolved when the bill is settled.
//
// Bills raised by the earlier term-assessment system are left where they are.
// Their unpaid balances appear on the same ledger as "earlier records" and can
// be paid from it; the two systems never bill the same student for the same term.

import { ensureAcademicTables } from './academicSessions'

export class FinanceError extends Error {
  status: number
  details: Record<string, any>
  constructor(message: string, status = 400, details: Record<string, any> = {}) {
    super(message)
    this.status = status
    this.details = details
  }
}

export const OBLIGATION_STATUSES = ['not_paid', 'partially_paid', 'paid', 'overpaid', 'waived', 'cancelled'] as const
export const ADJUSTMENT_KINDS = ['discount', 'scholarship', 'waiver', 'credit', 'debit'] as const
export const FREQUENCIES = ['term', 'annual', 'once'] as const
const REDUCING = new Set(['discount', 'scholarship', 'waiver', 'credit'])
const LEGACY_PREFIX = 'legacy:'

export const money = (value: unknown) => Math.round((Number(value) || 0) * 100) / 100

let _ready = false
export function resetFinanceCache() {
  _ready = false
}

export async function ensureFinanceTables(db: D1Database) {
  if (_ready) return
  // fee_payments, fee_assessments and fee_payment_allocations belong to the earlier system.
  await ensureAcademicTables(db)
  const ddl = [
    `CREATE TABLE IF NOT EXISTS fee_structures (
      id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
      session_id TEXT NOT NULL, session_name TEXT, term_id TEXT NOT NULL, term_name TEXT,
      class_id TEXT NOT NULL, class_name TEXT,
      status TEXT NOT NULL DEFAULT 'draft', copied_from_id TEXT,
      created_by TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, published_at TEXT, closed_at TEXT,
      UNIQUE(tenant_id, term_id, class_id)
    )`,
    `CREATE TABLE IF NOT EXISTS fee_structure_items (
      id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, structure_id TEXT NOT NULL,
      name TEXT NOT NULL, amount REAL NOT NULL, required INTEGER NOT NULL DEFAULT 1,
      frequency TEXT NOT NULL DEFAULT 'term', sort_order INTEGER NOT NULL DEFAULT 0
    )`,
    // Students who take an optional item (Transport, Feeding…) for a structure.
    `CREATE TABLE IF NOT EXISTS fee_item_optins (
      tenant_id TEXT NOT NULL, item_id TEXT NOT NULL, student_id TEXT NOT NULL, created_at TEXT NOT NULL,
      PRIMARY KEY (item_id, student_id)
    )`,
    `CREATE TABLE IF NOT EXISTS fee_obligations (
      id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL,
      student_id TEXT NOT NULL, student_name TEXT, class_id TEXT, class_name TEXT,
      session_id TEXT NOT NULL, session_name TEXT, term_id TEXT NOT NULL, term_name TEXT,
      structure_id TEXT, item_id TEXT, fee_item TEXT NOT NULL, frequency TEXT NOT NULL DEFAULT 'term',
      bill_key TEXT NOT NULL,
      amount REAL NOT NULL, adjustments_total REAL NOT NULL DEFAULT 0, waived INTEGER NOT NULL DEFAULT 0,
      net_amount REAL NOT NULL, amount_paid REAL NOT NULL DEFAULT 0, balance REAL NOT NULL,
      status TEXT NOT NULL, cancelled_at TEXT, cancel_reason TEXT,
      created_by TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      UNIQUE(tenant_id, bill_key)
    )`,
    `CREATE TABLE IF NOT EXISTS fee_adjustments (
      id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, obligation_id TEXT NOT NULL, student_id TEXT NOT NULL,
      kind TEXT NOT NULL, amount REAL NOT NULL, reason TEXT NOT NULL,
      authorized_by TEXT, authorized_by_name TEXT, created_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS fee_obligation_allocations (
      id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, payment_id TEXT NOT NULL, obligation_id TEXT NOT NULL,
      amount REAL NOT NULL, created_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS finance_receipts (
      id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, receipt_no TEXT NOT NULL, payment_id TEXT NOT NULL,
      student_id TEXT NOT NULL, snapshot_json TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'valid',
      created_at TEXT NOT NULL, UNIQUE(tenant_id, receipt_no)
    )`,
    `CREATE TABLE IF NOT EXISTS finance_claims (
      id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, student_id TEXT NOT NULL, student_name TEXT,
      claimant_id TEXT, claimant_name TEXT, amount REAL NOT NULL, method TEXT, reference TEXT, paid_at TEXT, note TEXT,
      obligation_ids TEXT NOT NULL, status TEXT NOT NULL, resolution_note TEXT, resolved_by TEXT, resolved_at TEXT, payment_id TEXT,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    )`,
    // Append-only: who changed what, from what, to what, when, and why.
    `CREATE TABLE IF NOT EXISTS finance_audit (
      id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, actor_id TEXT, actor_name TEXT, student_id TEXT,
      session_id TEXT, term_id TEXT, fee_obligation_id TEXT, payment_id TEXT, action TEXT NOT NULL,
      old_value TEXT, new_value TEXT, reason TEXT, created_at TEXT NOT NULL
    )`,
    // A write that must not land unless the row it guards changed (see guardChanged).
    `CREATE TABLE IF NOT EXISTS finance_write_guard (id INTEGER PRIMARY KEY AUTOINCREMENT, changed INTEGER NOT NULL CHECK (changed > 0))`,
  ]
  for (const statement of ddl) await db.prepare(statement).run()
  for (const column of ['status TEXT', 'payer_name TEXT', 'paid_on TEXT', 'reversal_of TEXT', 'reversed_by TEXT', 'reversal_reason TEXT', 'reversed_at TEXT']) {
    try { await db.exec(`ALTER TABLE fee_payments ADD COLUMN ${column}`) } catch {}
  }
  for (const statement of [
    `CREATE INDEX IF NOT EXISTS idx_fee_obligations_student ON fee_obligations(tenant_id, student_id, status)`,
    `CREATE INDEX IF NOT EXISTS idx_fee_obligations_term ON fee_obligations(tenant_id, term_id, class_id)`,
    `CREATE INDEX IF NOT EXISTS idx_fee_allocations_payment ON fee_obligation_allocations(tenant_id, payment_id)`,
    `CREATE INDEX IF NOT EXISTS idx_fee_allocations_obligation ON fee_obligation_allocations(tenant_id, obligation_id)`,
    `CREATE INDEX IF NOT EXISTS idx_finance_audit ON finance_audit(tenant_id, student_id, created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_finance_claims ON finance_claims(tenant_id, status, created_at)`,
  ]) {
    try { await db.prepare(statement).run() } catch {}
  }
  _ready = true
}

/**
 * Inside a batch, this statement aborts the whole batch when the statement
 * before it changed no rows — so a payment whose guarded balance update found
 * the bill already changed by someone else never half-lands.
 */
function guardChanged(db: D1Database) {
  return db.prepare(`INSERT OR REPLACE INTO finance_write_guard (id, changed) VALUES (1, changes())`)
}

export type Actor = { id: string, name: string }

export function auditStatement(db: D1Database, tenantId: string, entry: {
  actor: Actor, action: string, studentId?: string, sessionId?: string, termId?: string, obligationId?: string, paymentId?: string,
  oldValue?: unknown, newValue?: unknown, reason?: string,
}) {
  return db.prepare(`INSERT INTO finance_audit (id, tenant_id, actor_id, actor_name, student_id, session_id, term_id, fee_obligation_id, payment_id, action, old_value, new_value, reason, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
    `finaud-${crypto.randomUUID()}`, tenantId, entry.actor.id || null, entry.actor.name || null, entry.studentId || null,
    entry.sessionId || null, entry.termId || null, entry.obligationId || null, entry.paymentId || null, entry.action,
    entry.oldValue === undefined ? null : JSON.stringify(entry.oldValue), entry.newValue === undefined ? null : JSON.stringify(entry.newValue),
    entry.reason || null, new Date().toISOString(),
  )
}

// ─── Status ──────────────────────────────────────────────────────────────────

/** Net payable and status, from the charge, its adjustments and what has been paid. */
export function deriveObligation(amount: number, adjustmentsTotal: number, waived: boolean, paid: number, cancelled: boolean) {
  const net = money(Math.max(amount + adjustmentsTotal, 0))
  const balance = money(net - paid)
  let status: typeof OBLIGATION_STATUSES[number]
  if (cancelled) status = 'cancelled'
  else if (waived && net === 0 && paid === 0) status = 'waived'
  else if (paid <= 0) status = net === 0 ? 'paid' : 'not_paid'
  else if (balance > 0) status = 'partially_paid'
  else if (balance === 0) status = 'paid'
  else status = 'overpaid'
  return { net, balance: cancelled ? 0 : balance, status }
}

export function mapObligation(row: Record<string, any>) {
  return {
    id: String(row.id), source: 'obligation' as const,
    studentId: row.student_id, studentName: row.student_name || '', classId: row.class_id || '', className: row.class_name || '',
    sessionId: row.session_id, sessionName: row.session_name || '', termId: row.term_id, termName: row.term_name || '',
    structureId: row.structure_id || '', itemId: row.item_id || '', feeItem: row.fee_item, frequency: row.frequency,
    amount: money(row.amount), adjustmentsTotal: money(row.adjustments_total), netAmount: money(row.net_amount),
    amountPaid: money(row.amount_paid), balance: money(row.balance), status: row.status,
    cancelReason: row.cancel_reason || '', createdAt: row.created_at, updatedAt: row.updated_at,
  }
}

/** An unpaid bill from the earlier term-assessment system, shown on the same ledger. */
export function mapLegacyAssessment(row: Record<string, any>) {
  const net = money(row.net_amount)
  const paid = money(row.amount_paid)
  return {
    id: `${LEGACY_PREFIX}${row.id}`, source: 'legacy' as const, legacyAssessmentId: String(row.id),
    studentId: row.student_id, studentName: row.student_name || '', classId: row.class_id || '', className: row.class_name || '',
    sessionId: row.session_id, sessionName: row.session_name || '', termId: row.term_id, termName: row.term_name || '',
    structureId: '', itemId: '', feeItem: row.assessment_kind === 'opening_balance' ? 'Opening balance' : `${row.term_name || 'Term'} fees`, frequency: 'term',
    amount: net, adjustmentsTotal: 0, netAmount: net, amountPaid: paid, balance: money(row.outstanding),
    status: paid <= 0 ? 'not_paid' : money(row.outstanding) > 0 ? 'partially_paid' : 'paid',
    cancelReason: '', createdAt: row.created_at, updatedAt: row.updated_at,
  }
}

// ─── Fee structures ──────────────────────────────────────────────────────────

export type ItemInput = { name: string, amount: number, required: boolean, frequency: string }

export function normalizeItems(items: unknown): ItemInput[] {
  const list = (Array.isArray(items) ? items : []).map((item: any) => ({
    name: String(item?.name || '').replace(/\s+/g, ' ').trim().slice(0, 80),
    amount: money(item?.amount),
    required: item?.required !== false,
    frequency: (FREQUENCIES as readonly string[]).includes(String(item?.frequency)) ? String(item.frequency) : 'term',
  })).filter(item => item.name)
  const names = new Set<string>()
  for (const item of list) {
    if (item.amount < 0) throw new FinanceError(`${item.name} cannot have a negative amount.`)
    const key = item.name.toLowerCase()
    if (names.has(key)) throw new FinanceError(`"${item.name}" appears twice.`)
    names.add(key)
  }
  return list
}

export async function getStructure(db: D1Database, tenantId: string, id: string) {
  await ensureFinanceTables(db)
  const row = await db.prepare(`SELECT * FROM fee_structures WHERE id = ? AND tenant_id = ?`).bind(id, tenantId).first() as Record<string, any> | null
  if (!row) return null
  const items = await db.prepare(`SELECT * FROM fee_structure_items WHERE structure_id = ? ORDER BY sort_order, name`).bind(id).all()
  return {
    id: row.id, sessionId: row.session_id, sessionName: row.session_name || '', termId: row.term_id, termName: row.term_name || '',
    classId: row.class_id, className: row.class_name || '', status: row.status, copiedFromId: row.copied_from_id || '',
    createdAt: row.created_at, updatedAt: row.updated_at, publishedAt: row.published_at || null, closedAt: row.closed_at || null,
    items: ((items.results || []) as Record<string, any>[]).map(item => ({ id: item.id, name: item.name, amount: money(item.amount), required: Boolean(Number(item.required)), frequency: item.frequency })),
  }
}

export async function listStructures(db: D1Database, tenantId: string, filters: { sessionId?: string, termId?: string, classId?: string } = {}) {
  await ensureFinanceTables(db)
  const where = ['tenant_id = ?']
  const params: unknown[] = [tenantId]
  for (const [column, value] of [['session_id', filters.sessionId], ['term_id', filters.termId], ['class_id', filters.classId]]) {
    if (value) { where.push(`${column} = ?`); params.push(value) }
  }
  const rows = await db.prepare(`SELECT id FROM fee_structures WHERE ${where.join(' AND ')} ORDER BY session_name DESC, term_name, class_name`).bind(...params).all()
  const out = []
  for (const row of (rows.results || []) as Record<string, any>[]) out.push(await getStructure(db, tenantId, String(row.id)))
  return out.filter(Boolean)
}

/** Create (or replace the items of) a draft structure for one class and term. */
export async function saveStructure(db: D1Database, options: {
  tenantId: string, actor: Actor, id?: string,
  period: { sessionId: string, sessionName: string, termId: string, termName: string, classId: string, className: string },
  items: unknown, copiedFromId?: string,
}) {
  await ensureFinanceTables(db)
  const items = normalizeItems(options.items)
  if (!items.length) throw new FinanceError('Add at least one fee item.')
  const now = new Date().toISOString()
  let id = options.id
  if (id) {
    const existing = await getStructure(db, options.tenantId, id)
    if (!existing) throw new FinanceError('Fee structure not found.', 404)
    if (existing.status === 'closed') throw new FinanceError('A closed fee structure cannot be changed.', 409)
  } else {
    const clash = await db.prepare(`SELECT id FROM fee_structures WHERE tenant_id = ? AND term_id = ? AND class_id = ?`).bind(options.tenantId, options.period.termId, options.period.classId).first()
    if (clash) throw new FinanceError(`${options.period.className} already has a fee structure for ${options.period.termName}.`, 409, { structureId: (clash as any).id })
    id = `feestruct-${crypto.randomUUID()}`
    await db.prepare(`INSERT INTO fee_structures (id, tenant_id, session_id, session_name, term_id, term_name, class_id, class_name, status, copied_from_id, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?)`).bind(id, options.tenantId, options.period.sessionId, options.period.sessionName, options.period.termId, options.period.termName,
      options.period.classId, options.period.className, options.copiedFromId || null, options.actor.name || null, now, now).run()
  }
  // Replacing items never touches bills already issued: obligations keep their own amounts.
  const statements: D1PreparedStatement[] = [db.prepare(`DELETE FROM fee_structure_items WHERE structure_id = ? AND tenant_id = ?`).bind(id, options.tenantId)]
  items.forEach((item, index) => statements.push(db.prepare(`INSERT INTO fee_structure_items (id, tenant_id, structure_id, name, amount, required, frequency, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(`feeitem-${crypto.randomUUID()}`, options.tenantId, id, item.name, item.amount, item.required ? 1 : 0, item.frequency, index)))
  statements.push(db.prepare(`UPDATE fee_structures SET updated_at = ? WHERE id = ?`).bind(now, id))
  statements.push(auditStatement(db, options.tenantId, { actor: options.actor, action: options.id ? 'structure_edited' : (options.copiedFromId ? 'structure_copied' : 'structure_created'), sessionId: options.period.sessionId, termId: options.period.termId, newValue: { structureId: id, classId: options.period.classId, items } }))
  await db.batch(statements)
  return (await getStructure(db, options.tenantId, id!))!
}

export async function setStructureStatus(db: D1Database, options: { tenantId: string, id: string, status: string, actor: Actor }) {
  const structure = await getStructure(db, options.tenantId, options.id)
  if (!structure) throw new FinanceError('Fee structure not found.', 404)
  const allowed: Record<string, string[]> = { draft: ['published'], published: ['closed', 'draft'], closed: [] }
  if (!allowed[structure.status]?.includes(options.status)) throw new FinanceError(`A ${structure.status} structure cannot become ${options.status}.`, 409)
  if (options.status === 'draft') {
    const billed = await db.prepare(`SELECT COUNT(*) AS n FROM fee_obligations WHERE structure_id = ? AND tenant_id = ?`).bind(structure.id, options.tenantId).first() as Record<string, any>
    if (Number(billed?.n || 0) > 0) throw new FinanceError('Bills have been issued from this structure, so it cannot go back to draft. Use adjustments for individual changes.', 409)
  }
  const now = new Date().toISOString()
  await db.batch([
    db.prepare(`UPDATE fee_structures SET status = ?, published_at = CASE WHEN ? = 'published' THEN ? ELSE published_at END, closed_at = CASE WHEN ? = 'closed' THEN ? ELSE closed_at END, updated_at = ? WHERE id = ?`)
      .bind(options.status, options.status, now, options.status, now, now, structure.id),
    auditStatement(db, options.tenantId, { actor: options.actor, action: `structure_${options.status}`, sessionId: structure.sessionId, termId: structure.termId, oldValue: structure.status, newValue: options.status }),
  ])
  return (await getStructure(db, options.tenantId, structure.id))!
}

export async function setOptIns(db: D1Database, options: { tenantId: string, itemId: string, studentIds: string[] }) {
  await ensureFinanceTables(db)
  const now = new Date().toISOString()
  await db.batch([
    db.prepare(`DELETE FROM fee_item_optins WHERE item_id = ? AND tenant_id = ?`).bind(options.itemId, options.tenantId),
    ...[...new Set(options.studentIds)].map(studentId => db.prepare(`INSERT INTO fee_item_optins (tenant_id, item_id, student_id, created_at) VALUES (?, ?, ?, ?)`).bind(options.tenantId, options.itemId, studentId, now)),
  ])
}

/**
 * Issue bills from a published structure to every student enrolled in the
 * class for that session. Idempotent: a student already billed for an item is
 * skipped, and existing bills are never repriced. Annual items are billed once
 * per session; optional items only to students who take them.
 */
export async function issueBills(db: D1Database, options: {
  tenantId: string, structureId: string, actor: Actor,
  students: Array<{ studentId: string, studentName: string }>,
  legacyBilledStudentIds: Set<string>,
}) {
  const structure = await getStructure(db, options.tenantId, options.structureId)
  if (!structure) throw new FinanceError('Fee structure not found.', 404)
  if (structure.status !== 'published') throw new FinanceError('Publish the fee structure before issuing bills.', 409)
  const optins = await db.prepare(`SELECT item_id, student_id FROM fee_item_optins WHERE tenant_id = ? AND item_id IN (SELECT id FROM fee_structure_items WHERE structure_id = ?)`).bind(options.tenantId, structure.id).all()
  const optedIn = new Set(((optins.results || []) as Record<string, any>[]).map(row => `${row.item_id}|${row.student_id}`))
  const now = new Date().toISOString()
  const statements: D1PreparedStatement[] = []
  let created = 0
  const skippedLegacy: string[] = []
  for (const student of options.students) {
    // The earlier system already billed this student for this term: never bill twice.
    if (options.legacyBilledStudentIds.has(student.studentId)) { skippedLegacy.push(student.studentName || student.studentId); continue }
    for (const item of structure.items) {
      if (!item.required && !optedIn.has(`${item.id}|${student.studentId}`)) continue
      const scope = item.frequency === 'annual' ? `session:${structure.sessionId}` : item.frequency === 'once' ? 'once' : `term:${structure.termId}`
      const billKey = `${student.studentId}|${scope}|${item.name.toLowerCase()}`
      const derived = deriveObligation(item.amount, 0, false, 0, false)
      statements.push(db.prepare(`INSERT OR IGNORE INTO fee_obligations (id, tenant_id, student_id, student_name, class_id, class_name, session_id, session_name, term_id, term_name,
          structure_id, item_id, fee_item, frequency, bill_key, amount, adjustments_total, waived, net_amount, amount_paid, balance, status, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, 0, ?, ?, ?, ?, ?)`).bind(
        `feeob-${crypto.randomUUID()}`, options.tenantId, student.studentId, student.studentName || null, structure.classId, structure.className,
        structure.sessionId, structure.sessionName, structure.termId, structure.termName, structure.id, item.id, item.name, item.frequency, billKey,
        item.amount, derived.net, derived.balance, derived.status, options.actor.name || null, now, now))
      created += 1
    }
  }
  let inserted = 0
  for (let index = 0; index < statements.length; index += 50) {
    const results = await db.batch(statements.slice(index, index + 50))
    inserted += results.reduce((sum, result) => sum + Number((result as any)?.meta?.changes || 0), 0)
  }
  await auditStatement(db, options.tenantId, { actor: options.actor, action: 'bills_issued', sessionId: structure.sessionId, termId: structure.termId, newValue: { structureId: structure.id, issued: inserted, alreadyBilled: created - inserted, skippedLegacy } }).run()
  return { issued: inserted, alreadyBilled: created - inserted, skippedLegacy }
}

// ─── Copying a previous structure ────────────────────────────────────────────

/** The items of a source structure, to preview and edit before creating the copy. The source is never changed. */
export async function previewCopy(db: D1Database, tenantId: string, sourceId: string) {
  const source = await getStructure(db, tenantId, sourceId)
  if (!source) throw new FinanceError('Source fee structure not found.', 404)
  return { source: { id: source.id, sessionName: source.sessionName, termName: source.termName, className: source.className }, items: source.items.map(({ name, amount, required, frequency }) => ({ name, amount, required, frequency })) }
}

// ─── Obligations: adjustments and cancellation ───────────────────────────────

async function getObligationRow(db: D1Database, tenantId: string, id: string) {
  await ensureFinanceTables(db)
  return await db.prepare(`SELECT * FROM fee_obligations WHERE id = ? AND tenant_id = ?`).bind(id, tenantId).first() as Record<string, any> | null
}

export async function addAdjustment(db: D1Database, options: { tenantId: string, obligationId: string, kind: string, amount: unknown, reason: unknown, actor: Actor }) {
  const row = await getObligationRow(db, options.tenantId, options.obligationId)
  if (!row) throw new FinanceError('Charge not found.', 404)
  if (row.status === 'cancelled') throw new FinanceError('A cancelled charge cannot be adjusted.', 409)
  if (!(ADJUSTMENT_KINDS as readonly string[]).includes(options.kind)) throw new FinanceError('Choose discount, scholarship, waiver, credit or debit.')
  const reason = String(options.reason || '').trim().slice(0, 500)
  if (!reason) throw new FinanceError('Say why this adjustment is being made.')
  const before = mapObligation(row)
  // A waiver clears whatever is still owed on the charge.
  const amount = options.kind === 'waiver' ? money(before.netAmount - before.amountPaid) : money(options.amount)
  if (!(amount > 0)) throw new FinanceError(options.kind === 'waiver' ? 'Nothing is left to waive on this charge.' : 'Enter an amount greater than zero.')
  if (REDUCING.has(options.kind) && amount > money(before.netAmount - before.amountPaid) + 0.001 && options.kind !== 'credit') {
    throw new FinanceError(`The ${options.kind} is more than the ${money(before.netAmount - before.amountPaid)} still owed on this charge.`)
  }
  const signed = REDUCING.has(options.kind) ? -amount : amount
  const adjustmentsTotal = money(before.adjustmentsTotal + signed)
  const waived = options.kind === 'waiver' || Boolean(Number(row.waived))
  const after = deriveObligation(before.amount, adjustmentsTotal, waived, before.amountPaid, false)
  const now = new Date().toISOString()
  await db.batch([
    db.prepare(`INSERT INTO fee_adjustments (id, tenant_id, obligation_id, student_id, kind, amount, reason, authorized_by, authorized_by_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(`feeadj-${crypto.randomUUID()}`, options.tenantId, before.id, before.studentId, options.kind, amount, reason, options.actor.id || null, options.actor.name || null, now),
    db.prepare(`UPDATE fee_obligations SET adjustments_total = ?, waived = ?, net_amount = ?, balance = ?, status = ?, updated_at = ? WHERE id = ? AND tenant_id = ? AND adjustments_total = ?`)
      .bind(adjustmentsTotal, waived ? 1 : 0, after.net, after.balance, after.status, now, before.id, options.tenantId, before.adjustmentsTotal),
    guardChanged(db),
    auditStatement(db, options.tenantId, { actor: options.actor, action: `adjustment_${options.kind}`, studentId: before.studentId, sessionId: before.sessionId, termId: before.termId, obligationId: before.id,
      oldValue: { netAmount: before.netAmount, balance: before.balance, status: before.status }, newValue: { amount, netAmount: after.net, balance: after.balance, status: after.status }, reason }),
  ]).catch(error => { throw conflictOr(error) })
  return mapObligation((await getObligationRow(db, options.tenantId, before.id))!)
}

export async function cancelObligation(db: D1Database, options: { tenantId: string, obligationId: string, reason: unknown, actor: Actor }) {
  const row = await getObligationRow(db, options.tenantId, options.obligationId)
  if (!row) throw new FinanceError('Charge not found.', 404)
  const before = mapObligation(row)
  if (before.status === 'cancelled') return before
  if (before.amountPaid > 0) throw new FinanceError('Money has been paid against this charge. Reverse those payments first, or use a credit adjustment.', 409)
  const reason = String(options.reason || '').trim().slice(0, 500)
  if (!reason) throw new FinanceError('Say why this charge is being cancelled.')
  const now = new Date().toISOString()
  await db.batch([
    db.prepare(`UPDATE fee_obligations SET status = 'cancelled', balance = 0, cancelled_at = ?, cancel_reason = ?, updated_at = ? WHERE id = ? AND tenant_id = ? AND amount_paid = 0`).bind(now, reason, now, before.id, options.tenantId),
    guardChanged(db),
    auditStatement(db, options.tenantId, { actor: options.actor, action: 'obligation_cancelled', studentId: before.studentId, sessionId: before.sessionId, termId: before.termId, obligationId: before.id, oldValue: { status: before.status, balance: before.balance }, newValue: { status: 'cancelled' }, reason }),
  ]).catch(error => { throw conflictOr(error) })
  return mapObligation((await getObligationRow(db, options.tenantId, before.id))!)
}

function conflictOr(error: unknown) {
  if (/CHECK constraint failed/i.test(String((error as Error)?.message || ''))) {
    return new FinanceError('This record changed a moment ago. Reload and try again.', 409)
  }
  return error
}

// ─── The student ledger ──────────────────────────────────────────────────────

export async function listStudentCharges(db: D1Database, tenantId: string, studentId: string) {
  await ensureFinanceTables(db)
  const [obligations, legacy] = await Promise.all([
    db.prepare(`SELECT o.* FROM fee_obligations o LEFT JOIN academic_terms t ON t.id = o.term_id WHERE o.tenant_id = ? AND o.student_id = ?
      ORDER BY COALESCE(t.start_date, o.created_at), o.fee_item`).bind(tenantId, studentId).all(),
    db.prepare(`SELECT a.* FROM fee_assessments a LEFT JOIN academic_terms t ON t.id = a.term_id WHERE a.tenant_id = ? AND a.student_id = ?
      ORDER BY COALESCE(t.start_date, a.created_at)`).bind(tenantId, studentId).all().catch(() => ({ results: [] })),
  ])
  return [
    ...((legacy.results || []) as Record<string, any>[]).filter(row => row.status !== 'waived').map(mapLegacyAssessment),
    ...((obligations.results || []) as Record<string, any>[]).map(mapObligation),
  ]
}

/**
 * The student's financial account: current-term charges, earlier balances kept
 * as their own obligations (never merged into this term's tuition), totals,
 * payments, adjustments and receipts.
 */
export async function getStudentAccount(db: D1Database, options: { tenantId: string, studentId: string, current: { sessionId: string, termId: string, termStart?: string, termEnd?: string } }) {
  const charges = await listStudentCharges(db, options.tenantId, options.studentId)
  const isCurrent = (charge: { termId: string }) => Boolean(options.current.termId) && charge.termId === options.current.termId
  const live = charges.filter(charge => charge.status !== 'cancelled')
  const current = live.filter(isCurrent)
  const previousOutstanding = live.filter(charge => !isCurrent(charge) && charge.balance > 0)
  const [payments, adjustments, receipts] = await Promise.all([
    db.prepare(`SELECT * FROM fee_payments WHERE tenant_id = ? AND student_id = ? ORDER BY recorded_at DESC LIMIT 200`).bind(options.tenantId, options.studentId).all().catch(() => ({ results: [] })),
    db.prepare(`SELECT * FROM fee_adjustments WHERE tenant_id = ? AND student_id = ? ORDER BY created_at DESC`).bind(options.tenantId, options.studentId).all(),
    db.prepare(`SELECT id, receipt_no, payment_id, status, created_at, snapshot_json FROM finance_receipts WHERE tenant_id = ? AND student_id = ? ORDER BY created_at DESC`).bind(options.tenantId, options.studentId).all(),
  ])
  const paymentRows = (payments.results || []) as Record<string, any>[]
  const inTerm = (when: string) => Boolean(options.current.termStart) && when.slice(0, 10) >= String(options.current.termStart) && (!options.current.termEnd || when.slice(0, 10) <= String(options.current.termEnd))
  const paidThisTerm = money(paymentRows.filter(row => row.status !== 'reversed' && !row.reversal_of && inTerm(String(row.paid_on || row.recorded_at || ''))).reduce((sum, row) => sum + money(row.amount), 0)
    - paymentRows.filter(row => row.reversal_of && inTerm(String(row.recorded_at || ''))).reduce((sum, row) => sum + Math.abs(money(row.amount)), 0))
  const currentCharges = money(current.reduce((sum, charge) => sum + charge.netAmount, 0))
  const currentOutstanding = money(current.reduce((sum, charge) => sum + Math.max(charge.balance, 0), 0))
  const previous = money(previousOutstanding.reduce((sum, charge) => sum + charge.balance, 0))
  return {
    totals: {
      currentTermCharges: currentCharges,
      currentTermOutstanding: currentOutstanding,
      previousOutstanding: previous,
      totalOutstanding: money(currentOutstanding + previous),
      paidThisTerm,
    },
    current,
    previousOutstanding,
    history: charges,
    payments: paymentRows.map(row => ({
      id: row.id, amount: money(row.amount), method: row.payment_type || '', reference: row.payment_reference || '', payerName: row.payer_name || '',
      paidOn: row.paid_on || String(row.recorded_at || '').slice(0, 10), recordedAt: row.recorded_at, recordedBy: row.recorded_by_name || '',
      status: row.status || 'confirmed', reversalOf: row.reversal_of || '', reversalReason: row.reversal_reason || '', note: row.note || '',
    })),
    adjustments: ((adjustments.results || []) as Record<string, any>[]).map(row => ({ id: row.id, obligationId: row.obligation_id, kind: row.kind, amount: money(row.amount), reason: row.reason, authorizedBy: row.authorized_by_name || '', createdAt: row.created_at })),
    receipts: ((receipts.results || []) as Record<string, any>[]).map(row => ({ id: row.id, receiptNo: row.receipt_no, paymentId: row.payment_id, status: row.status, createdAt: row.created_at, snapshot: JSON.parse(String(row.snapshot_json || '{}')) })),
  }
}

/** Every allocation, adjustment and audit event for one charge. */
export async function getObligationHistory(db: D1Database, tenantId: string, obligationId: string) {
  await ensureFinanceTables(db)
  const legacyId = obligationId.startsWith(LEGACY_PREFIX) ? obligationId.slice(LEGACY_PREFIX.length) : ''
  const [allocations, adjustments, audit] = await Promise.all([
    legacyId
      ? db.prepare(`SELECT a.payment_id, a.amount, a.created_at, p.payment_type, p.payment_reference, p.status FROM fee_payment_allocations a LEFT JOIN fee_payments p ON p.id = a.payment_id WHERE a.tenant_id = ? AND a.assessment_id = ? ORDER BY a.created_at`).bind(tenantId, legacyId).all()
      : db.prepare(`SELECT a.payment_id, a.amount, a.created_at, p.payment_type, p.payment_reference, p.status FROM fee_obligation_allocations a LEFT JOIN fee_payments p ON p.id = a.payment_id WHERE a.tenant_id = ? AND a.obligation_id = ? ORDER BY a.created_at`).bind(tenantId, obligationId).all(),
    db.prepare(`SELECT * FROM fee_adjustments WHERE tenant_id = ? AND obligation_id = ? ORDER BY created_at`).bind(tenantId, obligationId).all(),
    db.prepare(`SELECT action, actor_name, old_value, new_value, reason, created_at FROM finance_audit WHERE tenant_id = ? AND fee_obligation_id = ? ORDER BY created_at`).bind(tenantId, obligationId).all(),
  ])
  return {
    allocations: ((allocations.results || []) as Record<string, any>[]).map(row => ({ paymentId: row.payment_id, amount: money(row.amount), method: row.payment_type || '', reference: row.payment_reference || '', createdAt: row.created_at })),
    adjustments: ((adjustments.results || []) as Record<string, any>[]).map(row => ({ kind: row.kind, amount: money(row.amount), reason: row.reason, authorizedBy: row.authorized_by_name || '', createdAt: row.created_at })),
    audit: ((audit.results || []) as Record<string, any>[]).map(row => ({ action: row.action, actorName: row.actor_name || '', oldValue: row.old_value ? JSON.parse(row.old_value) : null, newValue: row.new_value ? JSON.parse(row.new_value) : null, reason: row.reason || '', createdAt: row.created_at })),
  }
}

// ─── Payments, receipts and reversals ────────────────────────────────────────

async function nextReceiptNo(db: D1Database, tenantId: string) {
  const year = new Date().getUTCFullYear()
  const row = await db.prepare(`SELECT COUNT(*) AS n FROM finance_receipts WHERE tenant_id = ? AND receipt_no LIKE ?`).bind(tenantId, `RCT-${year}-%`).first() as Record<string, any>
  return `RCT-${year}-${String(Number(row?.n || 0) + 1).padStart(6, '0')}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`
}

/**
 * Record money received and say exactly what it pays for. Allocations must add
 * up to the amount and may not exceed what each charge still owes. On success
 * a receipt is made, and open claims on the settled charges resolve.
 */
export async function recordPayment(db: D1Database, options: {
  tenantId: string, actor: Actor, studentId: string, studentName?: string,
  amount: unknown, method?: string, reference?: string, payerName?: string, paidOn?: string, note?: string,
  allocations?: Array<{ obligationId: string, amount: unknown }>, selectedObligationIds?: string[], claimId?: string, idempotencyKey?: string,
  period?: { sessionName: string, termName: string },
  /** Ordinary fee payment: no allocation choices — oldest debt first, any extra kept as credit. */
  payOldestFirst?: boolean,
}) {
  await ensureFinanceTables(db)
  const amount = money(options.amount)
  if (!(amount > 0)) throw new FinanceError('Enter an amount greater than zero.')
  const idempotencyKey = String(options.idempotencyKey || '').trim().slice(0, 190)
  if (idempotencyKey) {
    const duplicate = await db.prepare(`SELECT id FROM fee_payments WHERE tenant_id = ? AND idempotency_key = ?`).bind(options.tenantId, idempotencyKey).first() as Record<string, any> | null
    if (duplicate) return { duplicate: true, paymentId: String(duplicate.id), receipt: await getReceiptForPayment(db, options.tenantId, String(duplicate.id)) }
  }

  const charges = await listStudentCharges(db, options.tenantId, options.studentId)
  const byId = new Map(charges.map(charge => [charge.id, charge]))
  const plan: Array<{ charge: typeof charges[number], amount: number }> = []
  const requested: Array<{ obligationId: string, amount: unknown, overpay?: boolean }> = options.payOldestFirst
    ? allocateOldestFirst(charges, amount)
    : options.allocations?.length ? options.allocations : autoAllocate(charges, options.selectedObligationIds || [], amount)
  for (const allocation of requested) {
    const share = money(allocation?.amount)
    if (share <= 0) continue
    const charge = byId.get(String(allocation?.obligationId || ''))
    if (!charge) throw new FinanceError('One of the selected charges does not belong to this student.', 404)
    if (charge.status === 'cancelled' || charge.status === 'waived') throw new FinanceError(`${charge.feeItem} (${charge.termName}) is ${charge.status} and cannot be paid.`)
    if (!allocation.overpay && share > charge.balance + 0.001) throw new FinanceError(`${charge.feeItem} (${charge.sessionName} ${charge.termName}) only has ${charge.balance} outstanding.`)
    plan.push({ charge, amount: share })
  }
  if (!plan.length) throw new FinanceError('Say what this payment is for: allocate it to at least one charge.')
  const allocated = money(plan.reduce((sum, entry) => sum + entry.amount, 0))
  if (allocated !== amount) throw new FinanceError(`The allocations add up to ${allocated}, but the payment is ${amount}.`, 400, { allocated, amount })

  const now = new Date().toISOString()
  const paymentId = `feepay-${crypto.randomUUID()}`
  const previousBalance = money(charges.filter(charge => charge.status !== 'cancelled').reduce((sum, charge) => sum + Math.max(charge.balance, 0), 0))
  const statements: D1PreparedStatement[] = [
    db.prepare(`INSERT INTO fee_payments (id, tenant_id, student_id, student_name, amount, payment_type, payment_reference, idempotency_key, note, claim_id, recorded_by, recorded_by_name, recorded_at, created_at, status, payer_name, paid_on)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?, ?)`).bind(
      paymentId, options.tenantId, options.studentId, options.studentName || null, amount, String(options.method || 'cash').slice(0, 40),
      String(options.reference || '').slice(0, 190) || null, idempotencyKey || null, String(options.note || '').slice(0, 1000) || null, options.claimId || null,
      options.actor.id || null, options.actor.name || null, now, now, String(options.payerName || '').slice(0, 200) || null, /^\d{4}-\d{2}-\d{2}$/.test(String(options.paidOn)) ? options.paidOn : now.slice(0, 10)),
  ]
  for (const entry of plan) {
    if (entry.charge.source === 'legacy') {
      const nextPaid = money(entry.charge.amountPaid + entry.amount)
      const nextOutstanding = money(Math.max(entry.charge.netAmount - nextPaid, 0))
      statements.push(
        db.prepare(`INSERT INTO fee_payment_allocations (id, tenant_id, payment_id, assessment_id, session_name, term_name, amount, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
          .bind(`feealloc-${crypto.randomUUID()}`, options.tenantId, paymentId, entry.charge.legacyAssessmentId, entry.charge.sessionName, entry.charge.termName, entry.amount, now),
        db.prepare(`UPDATE fee_assessments SET amount_paid = ?, outstanding = ?, status = ?, updated_at = ? WHERE tenant_id = ? AND id = ? AND amount_paid = ?`)
          .bind(nextPaid, nextOutstanding, nextOutstanding > 0 ? 'partial' : 'paid', now, options.tenantId, entry.charge.legacyAssessmentId, entry.charge.amountPaid),
        guardChanged(db),
      )
    } else {
      const nextPaid = money(entry.charge.amountPaid + entry.amount)
      const derived = deriveObligation(entry.charge.amount, entry.charge.adjustmentsTotal, entry.charge.status === 'waived', nextPaid, false)
      statements.push(
        db.prepare(`INSERT INTO fee_obligation_allocations (id, tenant_id, payment_id, obligation_id, amount, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
          .bind(`feeoalloc-${crypto.randomUUID()}`, options.tenantId, paymentId, entry.charge.id, entry.amount, now),
        db.prepare(`UPDATE fee_obligations SET amount_paid = ?, balance = ?, status = ?, updated_at = ? WHERE tenant_id = ? AND id = ? AND amount_paid = ?`)
          .bind(nextPaid, derived.balance, derived.status, now, options.tenantId, entry.charge.id, entry.charge.amountPaid),
        guardChanged(db),
      )
    }
    statements.push(auditStatement(db, options.tenantId, {
      actor: options.actor, action: 'payment_allocated', studentId: options.studentId, sessionId: entry.charge.sessionId, termId: entry.charge.termId,
      obligationId: entry.charge.id, paymentId, oldValue: { balance: entry.charge.balance }, newValue: { paid: entry.amount, balance: money(entry.charge.balance - entry.amount) },
    }))
  }

  const receiptId = `rcpt-${crypto.randomUUID()}`
  const receiptNo = await nextReceiptNo(db, options.tenantId)
  const snapshot = {
    receiptNo, studentId: options.studentId, studentName: options.studentName || '', payerName: String(options.payerName || ''),
    amount, paidOn: /^\d{4}-\d{2}-\d{2}$/.test(String(options.paidOn)) ? options.paidOn : now.slice(0, 10), method: String(options.method || 'cash'),
    reference: String(options.reference || ''), period: options.period || null,
    items: plan.map(entry => ({ feeItem: entry.charge.feeItem, sessionName: entry.charge.sessionName, termName: entry.charge.termName, amount: entry.amount, balanceAfter: money(entry.charge.balance - entry.amount) })),
    previousBalance, amountPaid: amount, remainingBalance: money(previousBalance - amount), recordedBy: options.actor.name, issuedAt: now,
  }
  statements.push(
    db.prepare(`INSERT INTO finance_receipts (id, tenant_id, receipt_no, payment_id, student_id, snapshot_json, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'valid', ?)`)
      .bind(receiptId, options.tenantId, receiptNo, paymentId, options.studentId, JSON.stringify(snapshot), now),
    db.prepare(`UPDATE fee_payments SET receipt_id = ?, receipt_no = ? WHERE id = ?`).bind(receiptId, receiptNo, paymentId),
    auditStatement(db, options.tenantId, { actor: options.actor, action: 'payment_recorded', studentId: options.studentId, paymentId, newValue: { amount, method: options.method, reference: options.reference, receiptNo } }),
  )
  await db.batch(statements).catch(error => { throw conflictOr(error) })

  const resolvedClaims = await resolveSettledClaims(db, options.tenantId, options.studentId, options.actor, paymentId, options.claimId)
  return { duplicate: false, paymentId, receipt: { id: receiptId, receiptNo, snapshot }, resolvedClaims }
}

/**
 * For payments that arrive without a line-by-line split (online payments, an
 * approved claim): spread the amount over the bills the payer selected, oldest
 * first, never past what each still owes. Anything left over is not guessed at
 * — the payment is refused and the school allocates it by hand.
 */
export function autoAllocate(charges: Array<{ id: string, balance: number, status: string }>, selectedIds: string[], amount: number) {
  const order = new Map(charges.map((charge, index) => [charge.id, index]))
  const selected = selectedIds.map(id => charges.find(charge => charge.id === id)).filter(Boolean) as Array<{ id: string, balance: number, status: string }>
  selected.sort((a, b) => (order.get(a.id) || 0) - (order.get(b.id) || 0))
  let left = money(amount)
  const out: Array<{ obligationId: string, amount: number }> = []
  for (const charge of selected) {
    if (left <= 0) break
    if (charge.balance <= 0 || ['cancelled', 'waived'].includes(charge.status)) continue
    const share = money(Math.min(charge.balance, left))
    out.push({ obligationId: charge.id, amount: share })
    left = money(left - share)
  }
  return out
}

/**
 * Spread an ordinary payment over everything owed, oldest first. Money beyond
 * the total owed stays on the account as credit, recorded against the newest
 * charge (which then shows as overpaid). Earlier-system bills cannot hold credit.
 */
export function allocateOldestFirst(charges: Array<{ id: string, source: string, balance: number, status: string, createdAt?: string }>, amount: number) {
  const open = charges.filter(charge => !['cancelled', 'waived'].includes(charge.status))
  const ordered = [...open].sort((a, b) => (a.source === 'legacy' ? 0 : 1) - (b.source === 'legacy' ? 0 : 1) || String(a.createdAt || '').localeCompare(String(b.createdAt || '')))
  let left = money(amount)
  const out: Array<{ obligationId: string, amount: number, overpay?: boolean }> = []
  for (const charge of ordered) {
    if (left <= 0) break
    if (charge.balance <= 0) continue
    const share = money(Math.min(charge.balance, left))
    out.push({ obligationId: charge.id, amount: share })
    left = money(left - share)
  }
  if (left > 0) {
    const newest = [...ordered].reverse().find(charge => charge.source !== 'legacy')
    if (!newest) throw new FinanceError(`This payment is ${left} more than everything owed, and there is no current bill to hold the credit.`)
    const existing = out.find(entry => entry.obligationId === newest.id)
    if (existing) { existing.amount = money(existing.amount + left); existing.overpay = true }
    else out.push({ obligationId: newest.id, amount: left, overpay: true })
  }
  return out
}

export async function getReceiptForPayment(db: D1Database, tenantId: string, paymentId: string) {
  const row = await db.prepare(`SELECT * FROM finance_receipts WHERE tenant_id = ? AND payment_id = ?`).bind(tenantId, paymentId).first() as Record<string, any> | null
  return row ? { id: row.id, receiptNo: row.receipt_no, status: row.status, snapshot: JSON.parse(String(row.snapshot_json || '{}')) } : null
}

/**
 * Undo a confirmed payment without erasing it: the original stays, a reversal
 * entry is recorded beside it, every allocation is undone, and its receipt is
 * marked reversed.
 */
export async function reversePayment(db: D1Database, options: { tenantId: string, paymentId: string, reason: unknown, actor: Actor }) {
  await ensureFinanceTables(db)
  const reason = String(options.reason || '').trim().slice(0, 500)
  if (!reason) throw new FinanceError('Say why this payment is being reversed.')
  const payment = await db.prepare(`SELECT * FROM fee_payments WHERE id = ? AND tenant_id = ?`).bind(options.paymentId, options.tenantId).first() as Record<string, any> | null
  if (!payment) throw new FinanceError('Payment not found.', 404)
  if (payment.status === 'reversed') throw new FinanceError('This payment has already been reversed.', 409)
  if (payment.reversal_of) throw new FinanceError('A reversal entry cannot itself be reversed.', 409)

  const [obligationAllocations, legacyAllocations] = await Promise.all([
    db.prepare(`SELECT a.obligation_id, a.amount, o.amount AS charge, o.adjustments_total, o.waived, o.amount_paid FROM fee_obligation_allocations a JOIN fee_obligations o ON o.id = a.obligation_id WHERE a.tenant_id = ? AND a.payment_id = ? AND a.amount > 0`).bind(options.tenantId, payment.id).all(),
    db.prepare(`SELECT a.assessment_id, a.amount, f.net_amount, f.amount_paid FROM fee_payment_allocations a JOIN fee_assessments f ON f.id = a.assessment_id WHERE a.tenant_id = ? AND a.payment_id = ? AND a.amount > 0`).bind(options.tenantId, payment.id).all().catch(() => ({ results: [] })),
  ])
  const now = new Date().toISOString()
  const reversalId = `feepay-${crypto.randomUUID()}`
  const statements: D1PreparedStatement[] = [
    db.prepare(`UPDATE fee_payments SET status = 'reversed', reversed_by = ?, reversal_reason = ?, reversed_at = ? WHERE id = ? AND tenant_id = ? AND COALESCE(status, 'confirmed') != 'reversed'`)
      .bind(options.actor.name || null, reason, now, payment.id, options.tenantId),
    guardChanged(db),
    db.prepare(`INSERT INTO fee_payments (id, tenant_id, student_id, student_name, amount, payment_type, payment_reference, note, recorded_by, recorded_by_name, recorded_at, created_at, status, reversal_of, reversal_reason)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'reversal', ?, ?)`).bind(
      reversalId, options.tenantId, payment.student_id, payment.student_name, -money(payment.amount), payment.payment_type, payment.payment_reference,
      `Reversal of ${payment.receipt_no || payment.id}`, options.actor.id || null, options.actor.name || null, now, now, payment.id, reason),
  ]
  for (const row of (obligationAllocations.results || []) as Record<string, any>[]) {
    const nextPaid = money(money(row.amount_paid) - money(row.amount))
    const derived = deriveObligation(money(row.charge), money(row.adjustments_total), Boolean(Number(row.waived)), nextPaid, false)
    statements.push(
      db.prepare(`INSERT INTO fee_obligation_allocations (id, tenant_id, payment_id, obligation_id, amount, created_at) VALUES (?, ?, ?, ?, ?, ?)`).bind(`feeoalloc-${crypto.randomUUID()}`, options.tenantId, reversalId, row.obligation_id, -money(row.amount), now),
      db.prepare(`UPDATE fee_obligations SET amount_paid = ?, balance = ?, status = ?, updated_at = ? WHERE id = ? AND tenant_id = ? AND amount_paid = ?`).bind(nextPaid, derived.balance, derived.status, now, row.obligation_id, options.tenantId, money(row.amount_paid)),
      guardChanged(db),
    )
  }
  for (const row of (legacyAllocations.results || []) as Record<string, any>[]) {
    const nextPaid = money(money(row.amount_paid) - money(row.amount))
    const outstanding = money(Math.max(money(row.net_amount) - nextPaid, 0))
    statements.push(
      db.prepare(`INSERT INTO fee_payment_allocations (id, tenant_id, payment_id, assessment_id, amount, created_at) VALUES (?, ?, ?, ?, ?, ?)`).bind(`feealloc-${crypto.randomUUID()}`, options.tenantId, reversalId, row.assessment_id, -money(row.amount), now),
      db.prepare(`UPDATE fee_assessments SET amount_paid = ?, outstanding = ?, status = ?, updated_at = ? WHERE id = ? AND tenant_id = ? AND amount_paid = ?`).bind(nextPaid, outstanding, nextPaid <= 0 ? 'unpaid' : outstanding > 0 ? 'partial' : 'paid', now, row.assessment_id, options.tenantId, money(row.amount_paid)),
      guardChanged(db),
    )
  }
  statements.push(
    db.prepare(`UPDATE finance_receipts SET status = 'reversed' WHERE tenant_id = ? AND payment_id = ?`).bind(options.tenantId, payment.id),
    auditStatement(db, options.tenantId, { actor: options.actor, action: 'payment_reversed', studentId: payment.student_id, paymentId: payment.id, oldValue: { amount: money(payment.amount), status: payment.status || 'confirmed' }, newValue: { status: 'reversed', reversalId }, reason }),
  )
  await db.batch(statements).catch(error => { throw conflictOr(error) })
  return { reversalId }
}

// ─── Claims ──────────────────────────────────────────────────────────────────

export function mapClaim(row: Record<string, any>) {
  return {
    id: row.id, studentId: row.student_id, studentName: row.student_name || '', claimantName: row.claimant_name || '',
    amount: money(row.amount), method: row.method || '', reference: row.reference || '', paidAt: row.paid_at || '', note: row.note || '',
    obligationIds: JSON.parse(String(row.obligation_ids || '[]')), status: row.status, resolutionNote: row.resolution_note || '',
    resolvedBy: row.resolved_by || '', resolvedAt: row.resolved_at || null, paymentId: row.payment_id || '', createdAt: row.created_at,
  }
}

/**
 * A payment claim. Before anything is queued, the charges it names are
 * checked: if they are already settled, the claim resolves on the spot.
 */
export async function submitClaim(db: D1Database, options: {
  tenantId: string, studentId: string, studentName: string, claimant: Actor, amount: unknown, method?: string, reference?: string, paidAt?: string, note?: string, obligationIds: string[],
}) {
  await ensureFinanceTables(db)
  const amount = money(options.amount)
  if (!(amount > 0)) throw new FinanceError('Enter the amount you paid.')
  const charges = await listStudentCharges(db, options.tenantId, options.studentId)
  const named = charges.filter(charge => options.obligationIds.includes(charge.id))
  if (!named.length) throw new FinanceError('Choose the fees this payment was for.')
  const settled = named.every(charge => charge.balance <= 0 || ['paid', 'overpaid', 'waived', 'cancelled'].includes(charge.status))
  const now = new Date().toISOString()
  const id = `claim-${crypto.randomUUID()}`
  const status = settled ? 'auto_resolved' : 'submitted'
  await db.prepare(`INSERT INTO finance_claims (id, tenant_id, student_id, student_name, claimant_id, claimant_name, amount, method, reference, paid_at, note, obligation_ids, status, resolution_note, resolved_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
    id, options.tenantId, options.studentId, options.studentName || null, options.claimant.id || null, options.claimant.name || null, amount,
    String(options.method || '').slice(0, 40) || null, String(options.reference || '').slice(0, 190) || null, String(options.paidAt || '').slice(0, 30) || null,
    String(options.note || '').slice(0, 1000) || null, JSON.stringify(named.map(charge => charge.id)), status,
    settled ? 'Auto-resolved — these fees were already settled.' : null, settled ? now : null, now, now,
  ).run()
  await auditStatement(db, options.tenantId, { actor: options.claimant, action: settled ? 'claim_auto_resolved' : 'claim_submitted', studentId: options.studentId, newValue: { claimId: id, amount, reference: options.reference } }).run()
  return mapClaim((await db.prepare(`SELECT * FROM finance_claims WHERE id = ?`).bind(id).first()) as Record<string, any>)
}

export async function reviewClaim(db: D1Database, options: { tenantId: string, claimId: string, action: string, note?: string, actor: Actor }) {
  await ensureFinanceTables(db)
  const row = await db.prepare(`SELECT * FROM finance_claims WHERE id = ? AND tenant_id = ?`).bind(options.claimId, options.tenantId).first() as Record<string, any> | null
  if (!row) throw new FinanceError('Claim not found.', 404)
  const transitions: Record<string, Record<string, string>> = {
    submitted: { start_review: 'under_review', reject: 'rejected', resolve: 'resolved' },
    under_review: { reject: 'rejected', resolve: 'resolved' },
  }
  const next = transitions[row.status]?.[options.action]
  if (!next) throw new FinanceError(`A ${String(row.status).replace('_', ' ')} claim cannot be ${options.action.replace('_', ' ')}ed.`, 409)
  if (next === 'rejected' && !String(options.note || '').trim()) throw new FinanceError('Give the reason for rejecting this claim.')
  const now = new Date().toISOString()
  await db.batch([
    db.prepare(`UPDATE finance_claims SET status = ?, resolution_note = COALESCE(?, resolution_note), resolved_by = ?, resolved_at = CASE WHEN ? IN ('resolved', 'rejected') THEN ? ELSE resolved_at END, updated_at = ? WHERE id = ?`)
      .bind(next, String(options.note || '').trim() || null, options.actor.name || null, next, now, now, row.id),
    auditStatement(db, options.tenantId, { actor: options.actor, action: `claim_${next}`, studentId: row.student_id, oldValue: row.status, newValue: next, reason: options.note }),
  ])
  return mapClaim((await db.prepare(`SELECT * FROM finance_claims WHERE id = ?`).bind(row.id).first()) as Record<string, any>)
}

/** Open claims whose charges are now all settled resolve themselves. */
async function resolveSettledClaims(db: D1Database, tenantId: string, studentId: string, actor: Actor, paymentId: string, claimId?: string) {
  const open = await db.prepare(`SELECT * FROM finance_claims WHERE tenant_id = ? AND student_id = ? AND status IN ('submitted', 'under_review')`).bind(tenantId, studentId).all()
  const openRows = (open.results || []) as Record<string, any>[]
  if (!openRows.length) return []
  const charges = await listStudentCharges(db, tenantId, studentId)
  const byId = new Map(charges.map(charge => [charge.id, charge]))
  const resolved: string[] = []
  const now = new Date().toISOString()
  for (const row of openRows) {
    const ids: string[] = JSON.parse(String(row.obligation_ids || '[]'))
    const settled = ids.length > 0 && ids.every(id => { const charge = byId.get(id); return !charge || charge.balance <= 0 })
    if (!settled && row.id !== claimId) continue
    await db.batch([
      db.prepare(`UPDATE finance_claims SET status = 'resolved', resolution_note = ?, resolved_by = ?, resolved_at = ?, payment_id = COALESCE(payment_id, ?), updated_at = ? WHERE id = ? AND status IN ('submitted', 'under_review')`)
        .bind(row.id === claimId ? 'Resolved by recording this payment.' : 'Auto-resolved — the fees it names are now settled.', actor.name || null, now, paymentId, now, row.id),
      auditStatement(db, tenantId, { actor, action: 'claim_resolved', studentId, paymentId, newValue: { claimId: row.id } }),
    ])
    resolved.push(String(row.id))
  }
  return resolved
}

// ─── Archives and dashboard ──────────────────────────────────────────────────

export async function searchArchives(db: D1Database, tenantId: string, filters: Record<string, any>) {
  await ensureFinanceTables(db)
  const where = ['o.tenant_id = ?']
  const params: unknown[] = [tenantId]
  const add = (sql: string, value: unknown) => { if (value !== undefined && value !== null && String(value) !== '') { where.push(sql); params.push(value) } }
  add('o.session_id = ?', filters.sessionId)
  add('o.term_id = ?', filters.termId)
  add('o.class_id = ?', filters.classId)
  add('o.student_id = ?', filters.studentId)
  add('lower(o.fee_item) = lower(?)', filters.feeItem)
  if (filters.status === 'owing') where.push(`o.status IN ('not_paid', 'partially_paid')`)
  else if (filters.status === 'settled') where.push(`o.status IN ('paid', 'overpaid', 'waived')`)
  else add('o.status = ?', filters.status)
  add('substr(o.created_at, 1, 10) >= ?', filters.from)
  add('substr(o.created_at, 1, 10) <= ?', filters.to)
  const obligations = await db.prepare(`SELECT o.* FROM fee_obligations o WHERE ${where.join(' AND ')} ORDER BY o.session_name DESC, o.term_name, o.class_name, o.student_name, o.fee_item LIMIT 2000`).bind(...params).all()

  // Payments against debts from another period, made within a date range:
  // "payments made against previous-session debts during First Term 2027/28".
  let payments: Array<Record<string, any>> = []
  if (filters.view === 'payments') {
    const pWhere = ['a.tenant_id = ?', 'a.amount > 0', `COALESCE(p.status, 'confirmed') = 'confirmed'`]
    const pParams: unknown[] = [tenantId]
    if (filters.paidFrom) { pWhere.push('COALESCE(p.paid_on, substr(p.recorded_at, 1, 10)) >= ?'); pParams.push(filters.paidFrom) }
    if (filters.paidTo) { pWhere.push('COALESCE(p.paid_on, substr(p.recorded_at, 1, 10)) <= ?'); pParams.push(filters.paidTo) }
    if (filters.debtSessionNot) { pWhere.push('o.session_id != ?'); pParams.push(filters.debtSessionNot) }
    if (filters.debtTermNot) { pWhere.push('o.term_id != ?'); pParams.push(filters.debtTermNot) }
    if (filters.classId) { pWhere.push('o.class_id = ?'); pParams.push(filters.classId) }
    const rows = await db.prepare(`SELECT a.payment_id, a.amount, p.paid_on, p.recorded_at, p.payment_type, p.payment_reference, p.receipt_no, o.student_id, o.student_name, o.class_name, o.session_name, o.term_name, o.fee_item
      FROM fee_obligation_allocations a JOIN fee_payments p ON p.id = a.payment_id JOIN fee_obligations o ON o.id = a.obligation_id
      WHERE ${pWhere.join(' AND ')} ORDER BY p.recorded_at DESC LIMIT 2000`).bind(...pParams).all()
    payments = ((rows.results || []) as Record<string, any>[]).map(row => ({
      paymentId: row.payment_id, amount: money(row.amount), paidOn: row.paid_on || String(row.recorded_at || '').slice(0, 10), method: row.payment_type || '', reference: row.payment_reference || '', receiptNo: row.receipt_no || '',
      studentId: row.student_id, studentName: row.student_name || '', className: row.class_name || '', debtPeriod: `${row.session_name} ${row.term_name}`, feeItem: row.fee_item,
    }))
  }
  return { obligations: ((obligations.results || []) as Record<string, any>[]).map(mapObligation), payments }
}

export async function financeDashboard(db: D1Database, tenantId: string, current: { sessionId: string, termId: string, termStart?: string, termEnd?: string }, filters: { classId?: string, feeItem?: string } = {}) {
  await ensureFinanceTables(db)
  const scope = ['tenant_id = ?', `status != 'cancelled'`]
  const params: unknown[] = [tenantId]
  if (filters.classId) { scope.push('class_id = ?'); params.push(filters.classId) }
  if (filters.feeItem) { scope.push('lower(fee_item) = lower(?)'); params.push(filters.feeItem) }
  const currentRow = await db.prepare(`SELECT COALESCE(SUM(net_amount), 0) AS expected, COALESCE(SUM(amount_paid), 0) AS collected, COALESCE(SUM(CASE WHEN balance > 0 THEN balance ELSE 0 END), 0) AS outstanding,
      COUNT(DISTINCT CASE WHEN balance > 0 THEN student_id END) AS owing FROM fee_obligations WHERE ${scope.join(' AND ')} AND term_id = ?`).bind(...params, current.termId || '').first() as Record<string, any>
  const arrearsRow = await db.prepare(`SELECT COALESCE(SUM(balance), 0) AS arrears, COUNT(DISTINCT student_id) AS students FROM fee_obligations WHERE ${scope.join(' AND ')} AND term_id != ? AND balance > 0`).bind(...params, current.termId || '').first() as Record<string, any>
  // Term Fees bills (the earlier system) count too: their earlier-term balances as
  // arrears, and — unless a single fee type is being looked at — this term's bills.
  const legacyClass = filters.classId ? 'AND class_id = ?' : ''
  const legacyArgs = filters.classId ? [filters.classId] : []
  const legacyRow = await db.prepare(`SELECT COALESCE(SUM(outstanding), 0) AS arrears FROM fee_assessments WHERE tenant_id = ? AND term_id != ? AND outstanding > 0 AND status != 'waived' ${legacyClass}`).bind(tenantId, current.termId || '', ...legacyArgs).first().catch(() => ({ arrears: 0 })) as Record<string, any>
  const legacyCurrent = filters.feeItem ? null : await db.prepare(`SELECT COALESCE(SUM(net_amount), 0) AS expected, COALESCE(SUM(amount_paid), 0) AS collected, COALESCE(SUM(outstanding), 0) AS outstanding,
      COUNT(DISTINCT CASE WHEN outstanding > 0 THEN student_id END) AS owing FROM fee_assessments WHERE tenant_id = ? AND term_id = ? AND status != 'waived' ${legacyClass}`).bind(tenantId, current.termId || '', ...legacyArgs).first().catch(() => null) as Record<string, any> | null
  const claimsRow = await db.prepare(`SELECT COUNT(*) AS n FROM finance_claims WHERE tenant_id = ? AND status IN ('submitted', 'under_review')`).bind(tenantId).first() as Record<string, any>
  const recent = await db.prepare(`SELECT id, student_name, amount, payment_type, payment_reference, receipt_no, recorded_at, status FROM fee_payments WHERE tenant_id = ? AND reversal_of IS NULL ORDER BY recorded_at DESC LIMIT 10`).bind(tenantId).all().catch(() => ({ results: [] }))
  const byClass = await db.prepare(`SELECT class_id, class_name, SUM(net_amount) AS expected, SUM(amount_paid) AS collected, SUM(CASE WHEN balance > 0 THEN balance ELSE 0 END) AS outstanding FROM fee_obligations WHERE ${scope.join(' AND ')} AND term_id = ? GROUP BY class_id, class_name ORDER BY class_name`).bind(...params, current.termId || '').all()
  const byItem = await db.prepare(`SELECT fee_item, SUM(net_amount) AS expected, SUM(amount_paid) AS collected, SUM(CASE WHEN balance > 0 THEN balance ELSE 0 END) AS outstanding FROM fee_obligations WHERE ${scope.join(' AND ')} AND term_id = ? GROUP BY fee_item ORDER BY fee_item`).bind(...params, current.termId || '').all()
  const expected = money(money(currentRow?.expected) + money(legacyCurrent?.expected))
  const collected = money(money(currentRow?.collected) + money(legacyCurrent?.collected))
  return {
    expected, collected, outstanding: money(money(currentRow?.outstanding) + money(legacyCurrent?.outstanding)),
    previousTermArrears: money(money(arrearsRow?.arrears) + money(legacyRow?.arrears)),
    collectionRate: expected > 0 ? Math.round((collected / expected) * 1000) / 10 : 0,
    // The two systems never bill the same student for the same term, so the counts add.
    studentsOwing: Number(currentRow?.owing || 0) + Number(legacyCurrent?.owing || 0),
    unresolvedClaims: Number(claimsRow?.n || 0),
    recentPayments: ((recent.results || []) as Record<string, any>[]).map(row => ({ id: row.id, studentName: row.student_name || '', amount: money(row.amount), method: row.payment_type || '', reference: row.payment_reference || '', receiptNo: row.receipt_no || '', recordedAt: row.recorded_at, status: row.status || 'confirmed' })),
    byClass: ((byClass.results || []) as Record<string, any>[]).map(row => ({ classId: row.class_id, className: row.class_name, expected: money(row.expected), collected: money(row.collected), outstanding: money(row.outstanding) })),
    byItem: ((byItem.results || []) as Record<string, any>[]).map(row => ({ feeItem: row.fee_item, expected: money(row.expected), collected: money(row.collected), outstanding: money(row.outstanding) })),
  }
}

export async function listFinanceAudit(db: D1Database, tenantId: string, filters: { studentId?: string, limit?: number } = {}) {
  await ensureFinanceTables(db)
  const rows = filters.studentId
    ? await db.prepare(`SELECT * FROM finance_audit WHERE tenant_id = ? AND student_id = ? ORDER BY created_at DESC LIMIT ?`).bind(tenantId, filters.studentId, Math.min(filters.limit || 200, 1000)).all()
    : await db.prepare(`SELECT * FROM finance_audit WHERE tenant_id = ? ORDER BY created_at DESC LIMIT ?`).bind(tenantId, Math.min(filters.limit || 200, 1000)).all()
  return ((rows.results || []) as Record<string, any>[]).map(row => ({
    id: row.id, actorName: row.actor_name || '', studentId: row.student_id || '', sessionId: row.session_id || '', termId: row.term_id || '',
    obligationId: row.fee_obligation_id || '', paymentId: row.payment_id || '', action: row.action,
    oldValue: row.old_value ? JSON.parse(row.old_value) : null, newValue: row.new_value ? JSON.parse(row.new_value) : null, reason: row.reason || '', createdAt: row.created_at,
  }))
}
