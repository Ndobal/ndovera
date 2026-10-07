// The simple face of Ndovera's fee system: a whole term's fees as one table,
// student accounts with one balance, and payments with no choices to make.
// Underneath, finance.ts keeps every charge, payment and adjustment separately
// and permanently (the student ledger), so the simple numbers stay traceable.
//
//   Total Payable = Term Fee + Outstanding Fee + Other Charges − Discounts
//   Balance       = Total Payable − Paid
//
// "Outstanding Fee" is whatever was unpaid when this term began, carried from
// earlier terms (and the earlier fee system). It is one line on screen and a
// list of its sources underneath.

import {
  Actor, FinanceError, addAdjustment, auditStatement, cancelObligation, deriveObligation, ensureFinanceTables, getStructure,
  issueBills, listStructures, mapLegacyAssessment, mapObligation, money, saveStructure, setStructureStatus,
} from './finance'

export type ClassRef = { id: string, name: string }
export type TermRef = { id: string, name: string, sessionId: string, sessionName: string, startDate?: string }
export type Enrollment = { studentId: string, studentName: string, classId: string, className: string }

// ─── Who may change official fees ────────────────────────────────────────────

export const FEE_EDIT_MODES: Record<string, string[]> = {
  owner_only: ['owner'],
  owner_hos: ['owner', 'hos'],
  owner_accountant: ['owner', 'accountant'],
  all: ['owner', 'hos', 'accountant'],
}

let _ready = false
export function resetFeeEngineCache() { _ready = false }

export async function ensureFeeEngineTables(db: D1Database) {
  if (_ready) return
  await ensureFinanceTables(db)
  for (const statement of [
    `CREATE TABLE IF NOT EXISTS finance_settings (tenant_id TEXT PRIMARY KEY, fee_edit_mode TEXT NOT NULL DEFAULT 'all', updated_by TEXT, updated_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS fee_term_locks (tenant_id TEXT NOT NULL, term_id TEXT NOT NULL, locked INTEGER NOT NULL DEFAULT 0, locked_by TEXT, locked_at TEXT, unlocked_by TEXT, unlocked_at TEXT, PRIMARY KEY (tenant_id, term_id))`,
    `CREATE TABLE IF NOT EXISTS fee_class_moves (tenant_id TEXT NOT NULL, student_id TEXT NOT NULL, term_id TEXT NOT NULL, from_class_id TEXT, to_class_id TEXT NOT NULL, decision TEXT NOT NULL, note TEXT, decided_by TEXT, decided_at TEXT NOT NULL, PRIMARY KEY (tenant_id, student_id, term_id, to_class_id))`,
  ]) await db.prepare(statement).run()
  _ready = true
}

export async function getFeeSettings(db: D1Database, tenantId: string) {
  await ensureFeeEngineTables(db)
  const row = await db.prepare(`SELECT * FROM finance_settings WHERE tenant_id = ?`).bind(tenantId).first() as Record<string, any> | null
  const mode = FEE_EDIT_MODES[String(row?.fee_edit_mode)] ? String(row?.fee_edit_mode) : 'all'
  return { feeEditMode: mode, editors: FEE_EDIT_MODES[mode], updatedBy: row?.updated_by || '', updatedAt: row?.updated_at || null }
}

export async function saveFeeSettings(db: D1Database, tenantId: string, mode: string, actor: Actor) {
  if (!FEE_EDIT_MODES[mode]) throw new FinanceError('Choose who can change fees.')
  await ensureFeeEngineTables(db)
  const before = await getFeeSettings(db, tenantId)
  const now = new Date().toISOString()
  await db.batch([
    db.prepare(`INSERT INTO finance_settings (tenant_id, fee_edit_mode, updated_by, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(tenant_id) DO UPDATE SET fee_edit_mode = excluded.fee_edit_mode, updated_by = excluded.updated_by, updated_at = excluded.updated_at`).bind(tenantId, mode, actor.name, now),
    auditStatement(db, tenantId, { actor, action: 'fee_permissions_changed', oldValue: before.feeEditMode, newValue: mode }),
  ])
  return getFeeSettings(db, tenantId)
}

/** The Owner can always change fees; others only as the Owner's setting allows. */
export function canEditFees(settings: { editors: string[] }, role: string) {
  return role === 'owner' || settings.editors.includes(role)
}

// ─── A term's fees as one table ──────────────────────────────────────────────

export async function getTermLock(db: D1Database, tenantId: string, termId: string) {
  await ensureFeeEngineTables(db)
  const row = await db.prepare(`SELECT * FROM fee_term_locks WHERE tenant_id = ? AND term_id = ?`).bind(tenantId, termId).first() as Record<string, any> | null
  return { locked: Boolean(Number(row?.locked || 0)), lockedBy: row?.locked_by || '', lockedAt: row?.locked_at || null }
}

/** Every class's fees for a term: columns are fee items, rows are classes. */
export async function getTermGrid(db: D1Database, tenantId: string, term: TermRef, classes: ClassRef[]) {
  await ensureFeeEngineTables(db)
  const structures = (await listStructures(db, tenantId, { termId: term.id })).filter(Boolean) as NonNullable<Awaited<ReturnType<typeof getStructure>>>[]
  const columns: Array<{ name: string, required: boolean, frequency: string }> = []
  const seen = new Set<string>()
  // Column order: the class with the most items sets it; others' extra items follow.
  for (const structure of [...structures].sort((a, b) => b.items.length - a.items.length)) {
    for (const item of structure.items) {
      const key = item.name.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      columns.push({ name: item.name, required: item.required, frequency: item.frequency })
    }
  }
  const byClass = new Map(structures.map(structure => [structure.classId, structure]))
  const rows = classes.map(klass => {
    const structure = byClass.get(klass.id)
    const amounts: Record<string, number> = {}
    for (const item of structure?.items || []) amounts[item.name] = item.amount
    return { classId: klass.id, className: klass.name, structureId: structure?.id || '', status: structure?.status || 'none', amounts }
  })
  const billed = await db.prepare(`SELECT COUNT(DISTINCT student_id) AS n FROM fee_obligations WHERE tenant_id = ? AND term_id = ? AND structure_id IS NOT NULL AND status != 'cancelled'`).bind(tenantId, term.id).first() as Record<string, any>
  return {
    term, columns, rows, configured: structures.length > 0,
    lock: await getTermLock(db, tenantId, term.id),
    billedStudents: Number(billed?.n || 0),
  }
}

/** Terms that already have fees, newest first — the "reuse" choices. */
export async function listFeeTerms(db: D1Database, tenantId: string) {
  await ensureFeeEngineTables(db)
  const rows = await db.prepare(`SELECT s.term_id, s.term_name, s.session_id, s.session_name, MAX(s.updated_at) AS updated_at, COUNT(*) AS classes, t.start_date
    FROM fee_structures s LEFT JOIN academic_terms t ON t.id = s.term_id WHERE s.tenant_id = ? GROUP BY s.term_id, s.term_name, s.session_id, s.session_name, t.start_date
    ORDER BY COALESCE(t.start_date, MAX(s.updated_at)) DESC`).bind(tenantId).all().catch(() => ({ results: [] }))
  return ((rows.results || []) as Record<string, any>[]).map(row => ({ termId: row.term_id, termName: row.term_name, sessionId: row.session_id, sessionName: row.session_name, classes: Number(row.classes || 0) }))
}

type GridInput = { columns: Array<{ name: string, required?: boolean, frequency?: string }>, rows: Array<{ classId: string, amounts: Record<string, unknown> }> }

/** What saving this table would change for students already billed. */
async function billedImpact(db: D1Database, tenantId: string, termId: string, plan: Map<string, Map<string, number>>, existing: Map<string, NonNullable<Awaited<ReturnType<typeof getStructure>>>>) {
  const changes: Array<{ classId: string, className: string, structureId: string, item: string, from: number, to: number, students: number }> = []
  for (const [classId, structure] of existing) {
    const next = plan.get(classId) || new Map<string, number>()
    const names = new Set([...structure.items.map(item => item.name), ...next.keys()])
    for (const name of names) {
      const before = structure.items.find(item => item.name === name)?.amount ?? 0
      const after = next.get(name) ?? 0
      if (money(before) === money(after)) continue
      const billed = await db.prepare(`SELECT COUNT(DISTINCT student_id) AS n FROM fee_obligations WHERE tenant_id = ? AND structure_id = ? AND lower(fee_item) = lower(?) AND status != 'cancelled'`).bind(tenantId, structure.id, name).first() as Record<string, any>
      // A new item counts as affecting everyone already billed for this class.
      const students = before === 0
        ? Number((await db.prepare(`SELECT COUNT(DISTINCT student_id) AS n FROM fee_obligations WHERE tenant_id = ? AND structure_id = ? AND status != 'cancelled'`).bind(tenantId, structure.id).first() as Record<string, any>)?.n || 0)
        : Number(billed?.n || 0)
      if (students) changes.push({ classId, className: structure.className, structureId: structure.id, item: name, from: money(before), to: money(after), students })
    }
  }
  return changes
}

/**
 * Save the whole term's table. Amounts of 0 (or blank) leave an item out for
 * that class. If students have already been billed, the caller must choose:
 * `adjust_existing` (audited adjustments for everyone affected) or
 * `future_only` (only students billed from now on pay the new amounts).
 */
export async function saveTermGrid(db: D1Database, options: {
  tenantId: string, actor: Actor, term: TermRef, classes: ClassRef[], input: GridInput, changeMode?: string, enrollments?: Enrollment[],
}) {
  await ensureFeeEngineTables(db)
  const lock = await getTermLock(db, options.tenantId, options.term.id)
  if (lock.locked) throw new FinanceError(`${options.term.name} fees are locked. Unlock them to make changes.`, 423)
  const columns = (options.input.columns || []).map(column => ({ name: String(column.name || '').replace(/\s+/g, ' ').trim().slice(0, 80), required: column.required !== false, frequency: ['term', 'annual', 'once'].includes(String(column.frequency)) ? String(column.frequency) : 'term' })).filter(column => column.name)
  const names = new Set<string>()
  for (const column of columns) {
    const key = column.name.toLowerCase()
    if (names.has(key)) throw new FinanceError(`"${column.name}" appears twice.`)
    names.add(key)
  }
  const classMap = new Map(options.classes.map(klass => [klass.id, klass]))
  const plan = new Map<string, Map<string, number>>()
  for (const row of options.input.rows || []) {
    if (!classMap.has(row.classId)) continue
    const amounts = new Map<string, number>()
    for (const column of columns) {
      const amount = money(row.amounts?.[column.name])
      if (amount < 0) throw new FinanceError(`${classMap.get(row.classId)!.name}: ${column.name} cannot be negative.`)
      if (amount > 0) amounts.set(column.name, amount)
    }
    plan.set(row.classId, amounts)
  }

  const existingList = (await listStructures(db, options.tenantId, { termId: options.term.id })).filter(Boolean) as NonNullable<Awaited<ReturnType<typeof getStructure>>>[]
  const existing = new Map(existingList.map(structure => [structure.classId, structure]))
  const impact = await billedImpact(db, options.tenantId, options.term.id, plan, existing)
  if (impact.length && !['adjust_existing', 'future_only'].includes(String(options.changeMode))) {
    const students = new Set<string>()
    const affected = await db.prepare(`SELECT DISTINCT student_id FROM fee_obligations WHERE tenant_id = ? AND term_id = ? AND structure_id IN (${impact.map(() => '?').join(',')}) AND status != 'cancelled'`).bind(options.tenantId, options.term.id, ...impact.map(change => change.structureId)).all()
    for (const row of (affected.results || []) as Record<string, any>[]) students.add(String(row.student_id))
    throw new FinanceError(`${students.size} student${students.size === 1 ? ' has' : 's have'} already been billed. Choose what should happen to them.`, 409, { needsDecision: true, affectedStudents: students.size, changes: impact })
  }

  const columnFor = new Map(columns.map(column => [column.name, column]))
  let saved = 0
  for (const [classId, amounts] of plan) {
    const klass = classMap.get(classId)!
    const current = existing.get(classId)
    const items = [...amounts.entries()].map(([name, amount]) => ({ name, amount, required: columnFor.get(name)?.required ?? true, frequency: columnFor.get(name)?.frequency || 'term' }))
    if (!items.length && !current) continue
    if (!items.length && current) {
      // Emptying a class: keep the structure (its bills stay), with no items for new students.
      continue
    }
    if (current && current.status === 'closed') throw new FinanceError(`${klass.name}'s fees for ${options.term.name} are closed.`, 409)
    await saveStructure(db, {
      tenantId: options.tenantId, actor: options.actor, id: current?.id, items,
      period: { sessionId: options.term.sessionId, sessionName: options.term.sessionName, termId: options.term.id, termName: options.term.name, classId, className: klass.name },
    })
    saved += 1
  }

  // Students already billed: apply the decision, every change audited.
  let adjusted = 0
  if (impact.length && options.changeMode === 'adjust_existing') {
    for (const change of impact) {
      const reason = `Fee change for ${change.className}: ${change.item} ${change.from} → ${change.to}`
      if (change.from === 0) {
        // A new item: bill it to everyone already billed in this class.
        const students = await db.prepare(`SELECT DISTINCT student_id, student_name FROM fee_obligations WHERE tenant_id = ? AND structure_id = ? AND status != 'cancelled'`).bind(options.tenantId, change.structureId).all()
        const structure = await getStructure(db, options.tenantId, change.structureId)
        if (structure?.status === 'published') {
          const result = await issueBills(db, { tenantId: options.tenantId, structureId: change.structureId, actor: options.actor, students: ((students.results || []) as Record<string, any>[]).map(row => ({ studentId: String(row.student_id), studentName: String(row.student_name || '') })), legacyBilledStudentIds: new Set() })
          adjusted += result.issued
        }
        continue
      }
      const rows = await db.prepare(`SELECT * FROM fee_obligations WHERE tenant_id = ? AND structure_id = ? AND lower(fee_item) = lower(?) AND status != 'cancelled'`).bind(options.tenantId, change.structureId, change.item).all()
      for (const row of (rows.results || []) as Record<string, any>[]) {
        const obligation = mapObligation(row)
        if (change.to === 0) {
          // An item removed: cancel unpaid charges; paid ones are credited back instead.
          if (obligation.amountPaid === 0) await cancelObligation(db, { tenantId: options.tenantId, obligationId: obligation.id, reason, actor: options.actor })
          else await addAdjustment(db, { tenantId: options.tenantId, obligationId: obligation.id, kind: 'credit', amount: obligation.netAmount, reason, actor: options.actor })
        } else {
          const delta = money(change.to - change.from)
          await addAdjustment(db, { tenantId: options.tenantId, obligationId: obligation.id, kind: delta > 0 ? 'debit' : 'credit', amount: Math.abs(delta), reason, actor: options.actor })
        }
        adjusted += 1
      }
    }
  }
  await auditStatement(db, options.tenantId, {
    actor: options.actor, action: 'term_fees_saved', sessionId: options.term.sessionId, termId: options.term.id,
    newValue: { classes: saved, columns: columns.map(column => column.name), changesToBilled: impact, decision: options.changeMode || null, adjustedCharges: adjusted },
  }).run()
  return { saved, adjusted, impact }
}

/**
 * Lock the term's fees: they become official, and every enrolled student's
 * account is created. Students billed earlier are not billed again.
 */
export async function lockTerm(db: D1Database, options: { tenantId: string, actor: Actor, term: TermRef, enrollments: Enrollment[], legacyBilledStudentIds: Set<string> }) {
  await ensureFeeEngineTables(db)
  const structures = (await listStructures(db, options.tenantId, { termId: options.term.id })).filter(Boolean) as NonNullable<Awaited<ReturnType<typeof getStructure>>>[]
  if (!structures.length) throw new FinanceError(`Set up ${options.term.name} fees before locking them.`)
  let issued = 0
  const students = new Set<string>()
  for (const structure of structures) {
    if (!structure.items.length) continue
    if (structure.status === 'draft') await setStructureStatus(db, { tenantId: options.tenantId, id: structure.id, status: 'published', actor: options.actor })
    const inClass = options.enrollments.filter(enrollment => enrollment.classId === structure.classId)
    if (!inClass.length) continue
    const result = await issueBills(db, { tenantId: options.tenantId, structureId: structure.id, actor: options.actor, students: inClass, legacyBilledStudentIds: options.legacyBilledStudentIds })
    issued += result.issued
    inClass.forEach(enrollment => { if (!options.legacyBilledStudentIds.has(enrollment.studentId)) students.add(enrollment.studentId) })
  }
  const now = new Date().toISOString()
  await db.batch([
    db.prepare(`INSERT INTO fee_term_locks (tenant_id, term_id, locked, locked_by, locked_at) VALUES (?, ?, 1, ?, ?) ON CONFLICT(tenant_id, term_id) DO UPDATE SET locked = 1, locked_by = excluded.locked_by, locked_at = excluded.locked_at`).bind(options.tenantId, options.term.id, options.actor.name, now),
    auditStatement(db, options.tenantId, { actor: options.actor, action: 'term_fees_locked', sessionId: options.term.sessionId, termId: options.term.id, newValue: { students: students.size, charges: issued } }),
  ])
  return { students: students.size, charges: issued }
}

export async function unlockTerm(db: D1Database, options: { tenantId: string, actor: Actor, term: TermRef, reason?: unknown }) {
  await ensureFeeEngineTables(db)
  const now = new Date().toISOString()
  await db.batch([
    db.prepare(`UPDATE fee_term_locks SET locked = 0, unlocked_by = ?, unlocked_at = ? WHERE tenant_id = ? AND term_id = ?`).bind(options.actor.name, now, options.tenantId, options.term.id),
    auditStatement(db, options.tenantId, { actor: options.actor, action: 'term_fees_unlocked', sessionId: options.term.sessionId, termId: options.term.id, reason: String(options.reason || '').slice(0, 500) || undefined }),
  ])
  return getTermLock(db, options.tenantId, options.term.id)
}

/** Students on the register with no account for this term yet (joined after locking). */
export async function unbilledStudents(db: D1Database, tenantId: string, termId: string, enrollments: Enrollment[]) {
  await ensureFeeEngineTables(db)
  const [billed, legacy] = await Promise.all([
    db.prepare(`SELECT DISTINCT student_id FROM fee_obligations WHERE tenant_id = ? AND term_id = ? AND structure_id IS NOT NULL`).bind(tenantId, termId).all(),
    db.prepare(`SELECT DISTINCT student_id FROM fee_assessments WHERE tenant_id = ? AND term_id = ? AND assessment_kind = 'term'`).bind(tenantId, termId).all().catch(() => ({ results: [] })),
  ])
  const done = new Set([...(billed.results || []), ...(legacy.results || [])].map((row: any) => String(row.student_id)))
  return enrollments.filter(enrollment => !done.has(enrollment.studentId))
}

/** Create fee accounts for new students: their class's standard fees for the term. */
export async function billStudents(db: D1Database, options: { tenantId: string, actor: Actor, term: TermRef, students: Enrollment[] }) {
  const structures = (await listStructures(db, options.tenantId, { termId: options.term.id })).filter(Boolean) as NonNullable<Awaited<ReturnType<typeof getStructure>>>[]
  const byClass = new Map(structures.map(structure => [structure.classId, structure]))
  let created = 0
  const noFees: string[] = []
  for (const student of options.students) {
    const structure = byClass.get(student.classId)
    if (!structure || !structure.items.length) { noFees.push(student.studentName || student.studentId); continue }
    if (structure.status === 'draft') await setStructureStatus(db, { tenantId: options.tenantId, id: structure.id, status: 'published', actor: options.actor })
    const result = await issueBills(db, { tenantId: options.tenantId, structureId: structure.id, actor: options.actor, students: [student], legacyBilledStudentIds: new Set() })
    created += result.issued
  }
  return { created, noFees }
}

// ─── Student accounts ────────────────────────────────────────────────────────

const REDUCING = new Set(['discount', 'scholarship', 'waiver', 'credit'])

type Charge = ReturnType<typeof mapObligation> | ReturnType<typeof mapLegacyAssessment>

/** Everything the account summaries and statements need, in a few queries. */
async function loadLedger(db: D1Database, tenantId: string, studentIds?: string[]) {
  await ensureFeeEngineTables(db)
  const filter = studentIds?.length ? ` AND student_id IN (${studentIds.map(() => '?').join(',')})` : ''
  const args = studentIds?.length ? studentIds : []
  const [obligations, legacy, allocations, legacyAllocations, adjustments] = await Promise.all([
    db.prepare(`SELECT * FROM fee_obligations WHERE tenant_id = ?${filter}`).bind(tenantId, ...args).all(),
    db.prepare(`SELECT * FROM fee_assessments WHERE tenant_id = ? AND status != 'waived'${filter}`).bind(tenantId, ...args).all().catch(() => ({ results: [] })),
    db.prepare(`SELECT a.obligation_id, a.amount, a.created_at FROM fee_obligation_allocations a JOIN fee_obligations o ON o.id = a.obligation_id WHERE a.tenant_id = ?${filter.replace('student_id', 'o.student_id')}`).bind(tenantId, ...args).all(),
    db.prepare(`SELECT a.assessment_id, a.amount, a.created_at FROM fee_payment_allocations a JOIN fee_assessments f ON f.id = a.assessment_id WHERE a.tenant_id = ?${filter.replace('student_id', 'f.student_id')}`).bind(tenantId, ...args).all().catch(() => ({ results: [] })),
    db.prepare(`SELECT * FROM fee_adjustments WHERE tenant_id = ?${filter}`).bind(tenantId, ...args).all(),
  ])
  const paidByCharge = new Map<string, Array<{ amount: number, at: string }>>()
  for (const row of (allocations.results || []) as Record<string, any>[]) {
    const list = paidByCharge.get(String(row.obligation_id)) || []
    list.push({ amount: money(row.amount), at: String(row.created_at || '') })
    paidByCharge.set(String(row.obligation_id), list)
  }
  for (const row of (legacyAllocations.results || []) as Record<string, any>[]) {
    const key = `legacy:${row.assessment_id}`
    const list = paidByCharge.get(key) || []
    list.push({ amount: money(row.amount), at: String(row.created_at || '') })
    paidByCharge.set(key, list)
  }
  const adjustmentsByCharge = new Map<string, Array<Record<string, any>>>()
  for (const row of (adjustments.results || []) as Record<string, any>[]) {
    const list = adjustmentsByCharge.get(String(row.obligation_id)) || []
    list.push(row)
    adjustmentsByCharge.set(String(row.obligation_id), list)
  }
  const charges: Array<Charge & { structured: boolean }> = [
    ...((legacy.results || []) as Record<string, any>[]).map(row => ({ ...mapLegacyAssessment(row), structured: row.assessment_kind === 'term' })),
    ...((obligations.results || []) as Record<string, any>[]).map(row => ({ ...mapObligation(row), structured: Boolean(row.structure_id) })),
  ]
  return { charges, paidByCharge, adjustmentsByCharge }
}

function summarise(charges: Array<Charge & { structured: boolean }>, ledger: Awaited<ReturnType<typeof loadLedger>>, termId: string, termStart: string) {
  let termFee = 0
  let otherCharges = 0
  let discounts = 0
  let outstanding = 0
  let paid = 0
  const sources: Array<{ sessionName: string, termName: string, feeItem: string, original: number, carriedForward: number }> = []
  for (const charge of charges) {
    if (charge.status === 'cancelled') continue
    const payments = ledger.paidByCharge.get(charge.id) || []
    if (charge.termId === termId) {
      const adjustments = ledger.adjustmentsByCharge.get(charge.id) || []
      if (charge.structured) termFee += charge.amount
      else otherCharges += charge.amount
      for (const adjustment of adjustments) {
        if (adjustment.kind === 'debit') otherCharges += money(adjustment.amount)
        else if (REDUCING.has(adjustment.kind)) discounts += money(adjustment.amount)
      }
      paid += payments.reduce((sum, payment) => sum + payment.amount, 0)
    } else {
      // Owed when this term began; anything paid since counts as paid this term.
      const before = payments.filter(payment => !termStart || payment.at < termStart).reduce((sum, payment) => sum + payment.amount, 0)
      const since = payments.filter(payment => termStart && payment.at >= termStart).reduce((sum, payment) => sum + payment.amount, 0)
      const carried = money(charge.netAmount - before)
      if (carried !== 0) {
        outstanding += carried
        sources.push({ sessionName: charge.sessionName, termName: charge.termName, feeItem: charge.feeItem, original: charge.netAmount, carriedForward: carried })
      }
      paid += since
    }
  }
  const totalPayable = money(termFee + outstanding + otherCharges - discounts)
  const balance = money(totalPayable - paid)
  const billed = charges.some(charge => charge.termId === termId && charge.status !== 'cancelled')
  const status = !billed && totalPayable === 0 ? 'not_billed' : balance < 0 ? 'overpaid' : balance === 0 ? 'paid' : paid > 0 ? 'part_payment' : 'unpaid'
  return { termFee: money(termFee), outstanding: money(outstanding), otherCharges: money(otherCharges), discounts: money(discounts), totalPayable, paid: money(paid), balance, status, outstandingSources: sources }
}

export async function accountSummaries(db: D1Database, tenantId: string, period: { termId: string, termStart?: string }, enrollments: Enrollment[]) {
  const ledger = await loadLedger(db, tenantId)
  const byStudent = new Map<string, Array<Charge & { structured: boolean }>>()
  for (const charge of ledger.charges) {
    const list = byStudent.get(String(charge.studentId)) || []
    list.push(charge)
    byStudent.set(String(charge.studentId), list)
  }
  const moves = await db.prepare(`SELECT student_id, to_class_id FROM fee_class_moves WHERE tenant_id = ? AND term_id = ?`).bind(tenantId, period.termId).all()
  const decided = new Set(((moves.results || []) as Record<string, any>[]).map(row => `${row.student_id}|${row.to_class_id}`))
  const termStart = String(period.termStart || '')
  const seen = new Set<string>()
  const out = enrollments.map(enrollment => {
    seen.add(enrollment.studentId)
    const charges = byStudent.get(enrollment.studentId) || []
    const billedClass = charges.find(charge => charge.termId === period.termId && charge.structured && charge.status !== 'cancelled')?.classId || ''
    const moved = Boolean(billedClass && enrollment.classId && billedClass !== enrollment.classId && !decided.has(`${enrollment.studentId}|${enrollment.classId}`))
    return { ...enrollment, ...summarise(charges, ledger, period.termId, termStart), classMove: moved ? { fromClassId: billedClass, toClassId: enrollment.classId } : null }
  })
  // Students no longer on this term's register but still owing.
  for (const [studentId, charges] of byStudent) {
    if (seen.has(studentId)) continue
    const summary = summarise(charges, ledger, period.termId, termStart)
    if (summary.balance === 0) continue
    const last = charges[charges.length - 1]
    out.push({ studentId, studentName: last?.studentName || studentId, classId: last?.classId || '', className: last?.className ? `${last.className} (left)` : 'Left the register', ...summary, classMove: null })
  }
  return out
}

/** One student's account as a parent would read it. */
export async function studentStatement(db: D1Database, tenantId: string, studentId: string, period: { termId: string, termStart?: string, termName?: string }) {
  const ledger = await loadLedger(db, tenantId, [studentId])
  const summary = summarise(ledger.charges, ledger, period.termId, String(period.termStart || ''))
  const current = ledger.charges.filter(charge => charge.termId === period.termId && charge.status !== 'cancelled')
  const lines: Array<{ kind: string, description: string, charge: number, credit: number, date: string, id?: string }> = []
  if (summary.outstanding) lines.push({ kind: 'outstanding', description: 'Outstanding Fee', charge: summary.outstanding, credit: 0, date: '' })
  for (const charge of current) {
    lines.push({ kind: charge.structured ? 'fee' : 'charge', description: charge.feeItem, charge: charge.amount, credit: 0, date: String(charge.createdAt || '').slice(0, 10), id: charge.id })
    for (const adjustment of ledger.adjustmentsByCharge.get(charge.id) || []) {
      const reducing = REDUCING.has(adjustment.kind)
      lines.push({ kind: adjustment.kind, description: `${adjustment.kind[0].toUpperCase()}${adjustment.kind.slice(1)} — ${adjustment.reason}`, charge: reducing ? 0 : money(adjustment.amount), credit: reducing ? money(adjustment.amount) : 0, date: String(adjustment.created_at || '').slice(0, 10) })
    }
  }
  const termStart = String(period.termStart || '')
  const payments = await db.prepare(`SELECT * FROM fee_payments WHERE tenant_id = ? AND student_id = ? ORDER BY recorded_at`).bind(tenantId, studentId).all().catch(() => ({ results: [] }))
  const ids = new Set(ledger.charges.filter(charge => charge.termId === period.termId).map(charge => charge.id))
  for (const row of (payments.results || []) as Record<string, any>[]) {
    const at = String(row.recorded_at || '')
    // This term's payments: made since the term began, or (with no start date) against this term's charges.
    if (termStart ? at < termStart : !ids.size) continue
    const amount = money(row.amount)
    lines.push({ kind: amount < 0 ? 'reversal' : 'payment', description: amount < 0 ? `Payment reversed — ${row.reversal_reason || ''}` : `Payment — ${row.payment_type || ''}${row.payment_reference ? ` (${row.payment_reference})` : ''}${row.status === 'reversed' ? ' — reversed' : ''}`, charge: amount < 0 ? Math.abs(amount) : 0, credit: amount > 0 ? amount : 0, date: String(row.paid_on || at).slice(0, 10), id: String(row.id) })
  }
  return { ...summary, lines }
}

// ─── Individual charges, discounts and credits ───────────────────────────────

export async function addStudentCharge(db: D1Database, options: { tenantId: string, actor: Actor, term: TermRef, student: Enrollment, description: unknown, amount: unknown, reason?: unknown }) {
  await ensureFeeEngineTables(db)
  const description = String(options.description || '').trim().slice(0, 120)
  const amount = money(options.amount)
  if (!description) throw new FinanceError('Describe the charge (for example "Lost textbook").')
  if (!(amount > 0)) throw new FinanceError('Enter an amount greater than zero.')
  const reason = String(options.reason || description).trim().slice(0, 500)
  const now = new Date().toISOString()
  const id = `feeob-${crypto.randomUUID()}`
  const derived = deriveObligation(amount, 0, false, 0, false)
  await db.batch([
    db.prepare(`INSERT INTO fee_obligations (id, tenant_id, student_id, student_name, class_id, class_name, session_id, session_name, term_id, term_name, structure_id, item_id, fee_item, frequency, bill_key, amount, adjustments_total, waived, net_amount, amount_paid, balance, status, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, 'once', ?, ?, 0, 0, ?, 0, ?, ?, ?, ?, ?)`).bind(
      id, options.tenantId, options.student.studentId, options.student.studentName || null, options.student.classId || null, options.student.className || null,
      options.term.sessionId, options.term.sessionName, options.term.id, options.term.name, description, `${options.student.studentId}|charge|${id}`, amount, derived.net, derived.balance, derived.status, options.actor.name, now, now),
    auditStatement(db, options.tenantId, { actor: options.actor, action: 'charge_added', studentId: options.student.studentId, sessionId: options.term.sessionId, termId: options.term.id, obligationId: id, newValue: { description, amount }, reason }),
  ])
  return { id }
}

/**
 * A discount, scholarship, waiver or credit for one student. It is spread over
 * this term's charges (largest balance first), then earlier balances. A credit
 * may exceed what is owed; the rest stays on the account.
 */
export async function adjustStudent(db: D1Database, options: { tenantId: string, actor: Actor, studentId: string, termId: string, kind: string, amount: unknown, reason: unknown }) {
  await ensureFeeEngineTables(db)
  if (!['discount', 'scholarship', 'waiver', 'credit'].includes(options.kind)) throw new FinanceError('Choose discount, scholarship, waiver or credit.')
  const reason = String(options.reason || '').trim().slice(0, 500)
  if (!reason) throw new FinanceError('Give the reason for this adjustment.')
  const ledger = await loadLedger(db, options.tenantId, [options.studentId])
  const open = ledger.charges.filter(charge => charge.source === 'obligation' && !['cancelled', 'waived'].includes(charge.status))
  const ordered = [
    ...open.filter(charge => charge.termId === options.termId).sort((a, b) => b.balance - a.balance),
    ...open.filter(charge => charge.termId !== options.termId).sort((a, b) => b.balance - a.balance),
  ]
  if (!ordered.length) throw new FinanceError('This student has no bills to adjust yet.')
  if (options.kind === 'waiver') {
    // A waiver clears everything owed this term.
    let applied = 0
    for (const charge of ordered.filter(item => item.termId === options.termId && item.balance > 0)) {
      await addAdjustment(db, { tenantId: options.tenantId, obligationId: charge.id, kind: 'waiver', amount: 0, reason, actor: options.actor })
      applied += charge.balance
    }
    if (!applied) throw new FinanceError('Nothing is owed this term to waive.')
    return { applied: money(applied) }
  }
  let left = money(options.amount)
  if (!(left > 0)) throw new FinanceError('Enter an amount greater than zero.')
  const owed = money(ordered.reduce((sum, charge) => sum + Math.max(charge.balance, 0), 0))
  if (options.kind !== 'credit' && left > owed + 0.001) throw new FinanceError(`The ${options.kind} is more than the ${owed} this student owes. Use a credit to hold money on the account.`)
  for (const charge of ordered) {
    if (left <= 0) break
    const share = money(Math.min(Math.max(charge.balance, 0), left))
    if (share <= 0) continue
    await addAdjustment(db, { tenantId: options.tenantId, obligationId: charge.id, kind: options.kind, amount: share, reason, actor: options.actor })
    left = money(left - share)
  }
  if (left > 0) {
    // Only a credit gets here: the remainder is held on the newest bill as credit.
    await addAdjustment(db, { tenantId: options.tenantId, obligationId: ordered[0].id, kind: 'credit', amount: left, reason, actor: options.actor })
  }
  return { applied: money(options.amount) }
}

// ─── Students who moved class mid-term ───────────────────────────────────────

export async function resolveClassMove(db: D1Database, options: { tenantId: string, actor: Actor, term: TermRef, student: Enrollment, fromClassId: string, decision: string, note?: unknown }) {
  await ensureFeeEngineTables(db)
  if (!['keep', 'difference', 'custom'].includes(options.decision)) throw new FinanceError('Choose how to handle the class change.')
  let changes = 0
  if (options.decision === 'difference') {
    const structures = (await listStructures(db, options.tenantId, { termId: options.term.id })).filter(Boolean) as NonNullable<Awaited<ReturnType<typeof getStructure>>>[]
    const target = structures.find(structure => structure.classId === options.student.classId)
    if (!target) throw new FinanceError(`${options.student.className} has no fees for ${options.term.name} yet.`)
    const rows = await db.prepare(`SELECT * FROM fee_obligations WHERE tenant_id = ? AND student_id = ? AND term_id = ? AND structure_id IS NOT NULL AND status != 'cancelled'`).bind(options.tenantId, options.student.studentId, options.term.id).all()
    const charged = ((rows.results || []) as Record<string, any>[]).map(mapObligation)
    const reason = `Class change to ${options.student.className}: fee difference`
    for (const item of target.items.filter(entry => entry.required)) {
      const existing = charged.find(charge => charge.feeItem.toLowerCase() === item.name.toLowerCase())
      if (!existing) {
        await addStudentCharge(db, { tenantId: options.tenantId, actor: options.actor, term: options.term, student: options.student, description: item.name, amount: item.amount, reason })
        changes += 1
        continue
      }
      const delta = money(item.amount - existing.amount)
      if (!delta) continue
      await addAdjustment(db, { tenantId: options.tenantId, obligationId: existing.id, kind: delta > 0 ? 'debit' : 'credit', amount: Math.abs(delta), reason, actor: options.actor })
      changes += 1
    }
  }
  const now = new Date().toISOString()
  await db.batch([
    db.prepare(`INSERT INTO fee_class_moves (tenant_id, student_id, term_id, from_class_id, to_class_id, decision, note, decided_by, decided_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(tenant_id, student_id, term_id, to_class_id) DO UPDATE SET decision = excluded.decision, note = excluded.note, decided_by = excluded.decided_by, decided_at = excluded.decided_at`)
      .bind(options.tenantId, options.student.studentId, options.term.id, options.fromClassId, options.student.classId, options.decision, String(options.note || '').slice(0, 500) || null, options.actor.name, now),
    auditStatement(db, options.tenantId, { actor: options.actor, action: 'class_move_fees', studentId: options.student.studentId, termId: options.term.id, newValue: { from: options.fromClassId, to: options.student.classId, decision: options.decision, changes } }),
  ])
  return { decision: options.decision, changes }
}
