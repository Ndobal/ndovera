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
    // A student's own amount for an item this term, in place of their class's (0: they do not pay it).
    `CREATE TABLE IF NOT EXISTS fee_student_amounts (tenant_id TEXT NOT NULL, term_id TEXT NOT NULL, student_id TEXT NOT NULL, student_name TEXT, item TEXT NOT NULL, amount REAL NOT NULL DEFAULT 0, updated_by TEXT, updated_at TEXT, PRIMARY KEY (tenant_id, term_id, student_id, item))`,
    // Per term: how fees are set (by class, or each student's own) and what happens
    // to debts from earlier terms when this term's accounts are created.
    `CREATE TABLE IF NOT EXISTS fee_term_settings (tenant_id TEXT NOT NULL, term_id TEXT NOT NULL, debt_mode TEXT NOT NULL DEFAULT 'carry', fee_mode TEXT NOT NULL DEFAULT 'class', decided_by TEXT, decided_at TEXT, written_off_at TEXT, written_off_amount REAL, written_off_students INTEGER, PRIMARY KEY (tenant_id, term_id))`,
    // Changes saved as a draft: kept as entered, applied to nobody until published.
    `CREATE TABLE IF NOT EXISTS fee_term_drafts (tenant_id TEXT NOT NULL, term_id TEXT NOT NULL, payload_json TEXT NOT NULL, saved_by TEXT, saved_at TEXT NOT NULL, PRIMARY KEY (tenant_id, term_id))`,
  ]) await db.prepare(statement).run()
  await db.prepare(`ALTER TABLE fee_term_settings ADD COLUMN fee_mode TEXT NOT NULL DEFAULT 'class'`).run().catch(() => null)
  _ready = true
}

/**
 * How a term's fees are set:
 *   class   — each class pays its row; students listed separately pay their own amounts instead.
 *   student — every student pays only what is entered for them; class rows are starting amounts.
 */
export const FEE_MODES = ['class', 'student'] as const

// ─── Drafts: fee changes saved but not yet published ─────────────────────────

const DRAFT_LIMIT = 900_000

export async function getFeeDraft(db: D1Database, tenantId: string, termId: string) {
  await ensureFeeEngineTables(db)
  const row = await db.prepare(`SELECT * FROM fee_term_drafts WHERE tenant_id = ? AND term_id = ?`).bind(tenantId, termId).first() as Record<string, any> | null
  if (!row) return null
  let payload: Record<string, any> = {}
  try { payload = JSON.parse(String(row.payload_json || '{}')) || {} } catch { payload = {} }
  return { payload, savedBy: row.saved_by || '', savedAt: row.saved_at }
}

/** Keep the page as entered. Nothing official changes and nobody is billed. */
export async function saveFeeDraft(db: D1Database, options: { tenantId: string, actor: Actor, term: TermRef, payload: Record<string, any>, autosave?: boolean }) {
  await ensureFeeEngineTables(db)
  const payload = {
    columns: Array.isArray(options.payload.columns) ? options.payload.columns : [],
    rows: Array.isArray(options.payload.rows) ? options.payload.rows : [],
    students: Array.isArray(options.payload.students) ? options.payload.students : [],
    feeMode: (FEE_MODES as readonly string[]).includes(String(options.payload.feeMode)) ? String(options.payload.feeMode) : 'class',
    debtMode: options.payload.debtMode === 'write_off' ? 'write_off' : 'carry',
  }
  const json = JSON.stringify(payload)
  if (json.length > DRAFT_LIMIT) throw new FinanceError('This draft is too large to save. Remove unused items or students and try again.')
  const now = new Date().toISOString()
  const save = db.prepare(`INSERT INTO fee_term_drafts (tenant_id, term_id, payload_json, saved_by, saved_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(tenant_id, term_id) DO UPDATE SET payload_json = excluded.payload_json, saved_by = excluded.saved_by, saved_at = excluded.saved_at`)
    .bind(options.tenantId, options.term.id, json, options.actor.name || null, now)
  // Autosave runs every few seconds while someone types: one row write, no audit entry
  // each time (a draft changes nobody's account; publishing is audited in full).
  if (options.autosave) await save.run()
  else {
    await db.batch([
      save,
      auditStatement(db, options.tenantId, { actor: options.actor, action: 'term_fees_draft_saved', sessionId: options.term.sessionId, termId: options.term.id, newValue: { columns: payload.columns.length, students: payload.students.length, feeMode: payload.feeMode } }),
    ])
  }
  return { savedBy: options.actor.name || '', savedAt: now }
}

export async function discardFeeDraft(db: D1Database, tenantId: string, termId: string) {
  await ensureFeeEngineTables(db)
  await db.prepare(`DELETE FROM fee_term_drafts WHERE tenant_id = ? AND term_id = ?`).bind(tenantId, termId).run()
}

// ─── Students who pay differently from their class ───────────────────────────

/** Per student: item (lower-case) → their own amount for this term. */
export type StudentAmounts = Map<string, { studentName: string, amounts: Map<string, { name: string, amount: number }> }>

export async function loadStudentAmounts(db: D1Database, tenantId: string, termId: string): Promise<StudentAmounts> {
  await ensureFeeEngineTables(db)
  const rows = await db.prepare(`SELECT * FROM fee_student_amounts WHERE tenant_id = ? AND term_id = ?`).bind(tenantId, termId).all()
  const out: StudentAmounts = new Map()
  for (const row of (rows.results || []) as Record<string, any>[]) {
    const studentId = String(row.student_id)
    const entry = out.get(studentId) || { studentName: '', amounts: new Map() }
    entry.studentName = entry.studentName || String(row.student_name || '')
    entry.amounts.set(String(row.item).toLowerCase(), { name: String(row.item), amount: money(row.amount) })
    out.set(studentId, entry)
  }
  return out
}

/** The issueBills hooks that apply each student's own amounts (and, by student, nothing else). */
function studentBilling(students: StudentAmounts, feeMode = 'class') {
  return {
    amountFor: (studentId: string, item: string) => students.get(studentId)?.amounts.get(item.toLowerCase())?.amount ?? (feeMode === 'student' ? 0 : undefined),
    extraItems: (studentId: string) => [...(students.get(studentId)?.amounts.values() || [])].map(entry => ({ name: entry.name, amount: entry.amount, frequency: 'term' })),
  }
}

function studentRowsOut(students: StudentAmounts) {
  return [...students].map(([studentId, entry]) => ({ studentId, studentName: entry.studentName, amounts: Object.fromEntries([...entry.amounts.values()].map(item => [item.name, item.amount])) }))
}

/**
 * Students who would be billed something this term: their own amounts, or (by class)
 * their class's. Anyone else has no fees set and gets no account until they do.
 */
export function studentsWithFees<T extends { studentId: string, classId: string }>(grid: { feeMode: string, rows: Array<{ classId: string, amounts: Record<string, number> }>, students: Array<{ studentId: string, amounts: Record<string, number> }> }, enrollments: T[]) {
  const classRows = new Map(grid.rows.map(row => [row.classId, row.amounts || {}]))
  const own = new Map(grid.students.map(row => [row.studentId, row.amounts || {}]))
  return enrollments.filter(enrollment => {
    const mine = own.get(enrollment.studentId) || {}
    const items = new Set([...Object.keys(mine), ...(grid.feeMode === 'student' ? [] : Object.keys(classRows.get(enrollment.classId) || {}))])
    for (const item of items) {
      const amount = item in mine ? Number(mine[item]) : Number((classRows.get(enrollment.classId) || {})[item])
      if (amount > 0) return true
    }
    return false
  })
}

// ─── Debts from earlier terms: carry them in, or write them off ──────────────

export async function getDebtSettings(db: D1Database, tenantId: string, termId: string) {
  await ensureFeeEngineTables(db)
  const row = await db.prepare(`SELECT * FROM fee_term_settings WHERE tenant_id = ? AND term_id = ?`).bind(tenantId, termId).first() as Record<string, any> | null
  return {
    mode: row?.debt_mode === 'write_off' ? 'write_off' : 'carry', feeMode: row?.fee_mode === 'student' ? 'student' : 'class',
    decidedBy: row?.decided_by || '', decidedAt: row?.decided_at || null,
    writtenOffAt: row?.written_off_at || null, writtenOffAmount: money(row?.written_off_amount), writtenOffStudents: Number(row?.written_off_students || 0),
  }
}

async function saveFeeMode(db: D1Database, tenantId: string, term: TermRef, feeMode: string, actor: Actor) {
  const before = await getDebtSettings(db, tenantId, term.id)
  if (before.feeMode === feeMode) return
  const now = new Date().toISOString()
  await db.batch([
    db.prepare(`INSERT INTO fee_term_settings (tenant_id, term_id, fee_mode, decided_by, decided_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(tenant_id, term_id) DO UPDATE SET fee_mode = excluded.fee_mode, decided_by = excluded.decided_by, decided_at = excluded.decided_at`).bind(tenantId, term.id, feeMode, actor.name, now),
    auditStatement(db, tenantId, { actor, action: 'term_fee_mode_set', sessionId: term.sessionId, termId: term.id, oldValue: before.feeMode, newValue: feeMode }),
  ])
}

async function saveDebtMode(db: D1Database, tenantId: string, term: TermRef, mode: string, actor: Actor) {
  const before = await getDebtSettings(db, tenantId, term.id)
  if (before.mode === mode) return
  if (before.writtenOffAt) throw new FinanceError(`Earlier debts were already written off for ${term.name}; that cannot be undone here.`, 409)
  const now = new Date().toISOString()
  await db.batch([
    db.prepare(`INSERT INTO fee_term_settings (tenant_id, term_id, debt_mode, decided_by, decided_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(tenant_id, term_id) DO UPDATE SET debt_mode = excluded.debt_mode, decided_by = excluded.decided_by, decided_at = excluded.decided_at`).bind(tenantId, term.id, mode, actor.name, now),
    auditStatement(db, tenantId, { actor, action: 'term_debt_mode_set', sessionId: term.sessionId, termId: term.id, oldValue: before.mode, newValue: mode }),
  ])
}

/**
 * Clear every balance owed from earlier terms for these students, each one
 * recorded: new-system charges get a waiver adjustment, earlier-system term
 * bills are marked waived. Credits (money held for a student) are kept.
 */
export async function writeOffEarlierDebts(db: D1Database, options: { tenantId: string, actor: Actor, term: TermRef, studentIds: string[] }) {
  const reason = `Outstanding debts written off when ${options.term.sessionName} ${options.term.name} fees were set`
  const now = new Date().toISOString()
  let amount = 0
  const students = new Set<string>()
  // D1 allows 100 bound values per query.
  for (let index = 0; index < options.studentIds.length; index += 80) {
    const ledger = await loadLedger(db, options.tenantId, options.studentIds.slice(index, index + 80))
    for (const charge of ledger.charges) {
      if (charge.termId === options.term.id || ['cancelled', 'waived'].includes(charge.status) || !(charge.balance > 0)) continue
      if (charge.source === 'obligation') {
        await addAdjustment(db, { tenantId: options.tenantId, obligationId: charge.id, kind: 'waiver', amount: 0, reason, actor: options.actor })
      } else {
        await db.prepare(`UPDATE fee_assessments SET status = 'waived', notes = TRIM(COALESCE(notes, '') || ' ' || ?), updated_at = ? WHERE tenant_id = ? AND id = ?`).bind(reason, now, options.tenantId, (charge as any).legacyAssessmentId).run()
      }
      amount = money(amount + charge.balance)
      students.add(String(charge.studentId))
    }
  }
  await db.batch([
    db.prepare(`INSERT INTO fee_term_settings (tenant_id, term_id, debt_mode, decided_by, decided_at, written_off_at, written_off_amount, written_off_students) VALUES (?, ?, 'write_off', ?, ?, ?, ?, ?)
      ON CONFLICT(tenant_id, term_id) DO UPDATE SET debt_mode = 'write_off', written_off_at = excluded.written_off_at, written_off_amount = COALESCE(fee_term_settings.written_off_amount, 0) + excluded.written_off_amount, written_off_students = COALESCE(fee_term_settings.written_off_students, 0) + excluded.written_off_students`)
      .bind(options.tenantId, options.term.id, options.actor.name, now, now, amount, students.size),
    auditStatement(db, options.tenantId, { actor: options.actor, action: 'debts_written_off', sessionId: options.term.sessionId, termId: options.term.id, newValue: { students: students.size, amount }, reason }),
  ])
  return { students: students.size, amount }
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
  const students = await loadStudentAmounts(db, tenantId, term.id)
  // An item only some students pay still needs its column.
  for (const entry of students.values()) {
    for (const item of entry.amounts.values()) {
      if (seen.has(item.name.toLowerCase())) continue
      seen.add(item.name.toLowerCase())
      columns.push({ name: item.name, required: true, frequency: 'term' })
    }
  }
  const byClass = new Map(structures.map(structure => [structure.classId, structure]))
  const rows = classes.map(klass => {
    const structure = byClass.get(klass.id)
    const amounts: Record<string, number> = {}
    // A class keeps every item on file (so its students can pay their own); 0 shows as blank.
    for (const item of structure?.items || []) if (item.amount > 0) amounts[item.name] = item.amount
    return { classId: klass.id, className: klass.name, structureId: structure?.id || '', status: structure?.status || 'none', amounts }
  })
  const billed = await db.prepare(`SELECT COUNT(DISTINCT student_id) AS n FROM fee_obligations WHERE tenant_id = ? AND term_id = ? AND structure_id IS NOT NULL AND status != 'cancelled'`).bind(tenantId, term.id).first() as Record<string, any>
  const settings = await getDebtSettings(db, tenantId, term.id)
  return {
    term, columns, rows, students: studentRowsOut(students), configured: structures.length > 0, feeMode: settings.feeMode,
    lock: await getTermLock(db, tenantId, term.id),
    debt: settings,
    billedStudents: Number(billed?.n || 0),
  }
}

/**
 * Terms whose fees can be reused, newest first: terms set up here, and terms
 * whose fees live in the earlier Fee Template (where most schools' last term is).
 */
export async function listFeeTerms(db: D1Database, tenantId: string) {
  await ensureFeeEngineTables(db)
  const [terms, structured, template] = await Promise.all([
    db.prepare(`SELECT t.id, t.name, t.session_id, s.name AS session_name FROM academic_terms t JOIN academic_sessions s ON s.id = t.session_id
      WHERE t.tenant_id = ? ORDER BY s.start_date DESC, t.sequence DESC`).bind(tenantId).all().catch(() => ({ results: [] })),
    db.prepare(`SELECT term_id, COUNT(*) AS classes FROM fee_structures WHERE tenant_id = ? GROUP BY term_id`).bind(tenantId).all().catch(() => ({ results: [] })),
    db.prepare(`SELECT lower(trim(session)) AS session, lower(trim(term)) AS term, COUNT(DISTINCT class_id) AS classes FROM fees_config WHERE tenant_id = ? AND COALESCE(trim(term), '') != '' GROUP BY 1, 2`).bind(tenantId).all().catch(() => ({ results: [] })),
  ])
  const classesByTerm = new Map(((structured.results || []) as Record<string, any>[]).map(row => [String(row.term_id), Number(row.classes || 0)]))
  const templateTerms = new Map(((template.results || []) as Record<string, any>[]).map(row => [`${row.session}|${row.term}`, Number(row.classes || 0)]))
  const out: Array<{ termId: string, termName: string, sessionId: string, sessionName: string, classes: number, origin: 'fees' | 'template' }> = []
  for (const row of (terms.results || []) as Record<string, any>[]) {
    const base = { termId: String(row.id), termName: String(row.name), sessionId: String(row.session_id), sessionName: String(row.session_name) }
    const templateKey = `${base.sessionName.trim().toLowerCase()}|${base.termName.trim().toLowerCase()}`
    if (classesByTerm.has(base.termId)) out.push({ ...base, classes: classesByTerm.get(base.termId)!, origin: 'fees' })
    else if (templateTerms.has(templateKey)) out.push({ ...base, classes: templateTerms.get(templateKey)!, origin: 'template' })
  }
  return out
}

/**
 * The earlier Fee Template for one term, as a fee table. A student's own row
 * replaces their class's amount, and a class row replaces the all-classes one
 * (as the earlier system read them). Only amounts that differ from what the
 * student's class paid become student-specific fees; the rest follow the class.
 */
export function gridFromFeeConfig(configRows: Array<Record<string, any>>, classes: ClassRef[], studentClass: Map<string, string>, studentNames: Map<string, string>) {
  const ordered = [...configRows].sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0))
  const columns: Array<{ name: string, required: boolean, frequency: string }> = []
  const names = new Map<string, string>()
  const all = new Map<string, number>()
  const byClass = new Map<string, Map<string, number>>()
  const byStudent = new Map<string, Map<string, number>>()
  for (const row of ordered) {
    const name = String(row.fee_type || row.feeType || '').replace(/\s+/g, ' ').trim()
    if (!name) continue
    const key = name.toLowerCase()
    if (!names.has(key)) { names.set(key, name); columns.push({ name, required: true, frequency: 'term' }) }
    const amount = money(row.amount)
    const studentId = String(row.student_id || row.studentId || '').trim()
    const classId = String(row.class_id || row.classId || '').trim()
    const target = studentId ? byStudent : classId ? byClass : null
    if (!target) { all.set(key, amount); continue }
    const id = studentId || classId
    const map = target.get(id) || new Map<string, number>()
    map.set(key, amount)
    target.set(id, map)
  }
  const classAmount = (classId: string, key: string) => byClass.get(classId)?.get(key) ?? all.get(key)
  const rows = classes.map(klass => {
    const amounts: Record<string, number> = {}
    for (const [key, name] of names) {
      const amount = classAmount(klass.id, key)
      if (amount) amounts[name] = amount
    }
    return { classId: klass.id, amounts }
  })
  const students: Array<{ studentId: string, studentName: string, amounts: Record<string, number> }> = []
  for (const [studentId, items] of byStudent) {
    const classId = studentClass.get(studentId) || ''
    const amounts: Record<string, number> = {}
    for (const [key, amount] of items) {
      const usual = classId ? classAmount(classId, key) : undefined
      if (usual === undefined ? amount > 0 : money(usual) !== amount) amounts[names.get(key)!] = amount
    }
    if (Object.keys(amounts).length) students.push({ studentId, studentName: studentNames.get(studentId) || studentId, amounts })
  }
  return { columns, rows, students }
}

type GridInput = {
  columns: Array<{ name: string, required?: boolean, frequency?: string }>,
  rows: Array<{ classId: string, amounts: Record<string, unknown> }>,
  // Left out: the term's student-specific fees stay as they are.
  students?: Array<{ studentId: string, studentName?: string, amounts: Record<string, unknown> }>,
}

type Structure = NonNullable<Awaited<ReturnType<typeof getStructure>>>
type BilledAction =
  | { kind: 'adjust', obligation: ReturnType<typeof mapObligation>, label: string, from: number, to: number }
  | { kind: 'add', studentId: string, studentName: string, structureId: string }

/**
 * What saving would change for students already billed this term, charge by
 * charge. Each student's amount for an item is their own if they have one,
 * otherwise their class's — before and after the save.
 */
async function billedChanges(db: D1Database, tenantId: string, termId: string, s: {
  plan: Map<string, Map<string, number>>, existing: Map<string, Structure>, oldStudents: StudentAmounts, newStudents: StudentAmounts,
  oldMode: string, newMode: string,
}) {
  const rows = await db.prepare(`SELECT * FROM fee_obligations WHERE tenant_id = ? AND term_id = ? AND structure_id IS NOT NULL AND status != 'cancelled'`).bind(tenantId, termId).all()
  const obligations = ((rows.results || []) as Record<string, any>[]).map(mapObligation)
  // By student, a class's row is only a starting point: nobody pays it unless it is entered for them.
  const oldClass = (classId: string, key: string) => (s.oldMode === 'student' ? 0 : s.existing.get(classId)?.items.find(item => item.name.toLowerCase() === key)?.amount ?? 0)
  const newClass = (classId: string, key: string) => {
    if (s.newMode === 'student') return 0
    const next = s.plan.get(classId)
    // A class left out of the table keeps its fees.
    if (!next) return s.existing.get(classId)?.items.find(item => item.name.toLowerCase() === key)?.amount ?? 0
    for (const [name, amount] of next) if (name.toLowerCase() === key) return amount
    return 0
  }
  const amount = (students: StudentAmounts, classFor: (classId: string, key: string) => number, studentId: string, classId: string, key: string) =>
    students.get(studentId)?.amounts.get(key)?.amount ?? classFor(classId, key)
  const own = (studentId: string, key: string) => s.oldStudents.get(studentId)?.amounts.has(key) || s.newStudents.get(studentId)?.amounts.has(key)

  const actions: BilledAction[] = []
  const grouped = new Map<string, { classId: string, className: string, item: string, from: number, to: number, students: number }>()
  const note = (classId: string, label: string, item: string, from: number, to: number) => {
    const key = `${label}|${item.toLowerCase()}|${from}|${to}`
    const entry = grouped.get(key) || { classId, className: label, item, from, to, students: 0 }
    entry.students += 1
    grouped.set(key, entry)
  }
  const billed = new Map<string, { studentName: string, classId: string, className: string, structureId: string, items: Set<string> }>()
  for (const obligation of obligations) {
    const studentId = String(obligation.studentId)
    const key = String(obligation.feeItem).toLowerCase()
    const entry = billed.get(studentId) || { studentName: obligation.studentName, classId: obligation.classId, className: obligation.className, structureId: obligation.structureId, items: new Set<string>() }
    entry.items.add(key)
    billed.set(studentId, entry)
    const from = money(amount(s.oldStudents, oldClass, studentId, obligation.classId, key))
    const to = money(amount(s.newStudents, newClass, studentId, obligation.classId, key))
    if (from === to) continue
    const label = own(studentId, key) ? obligation.studentName || studentId : obligation.className
    actions.push({ kind: 'adjust', obligation, label, from, to })
    note(obligation.classId, label, obligation.feeItem, from, to)
  }
  // Items a billed student did not pay before and now does.
  for (const [studentId, entry] of billed) {
    const candidates = new Map<string, string>()
    if (s.newMode !== 'student') for (const [name] of s.plan.get(entry.classId) || []) candidates.set(name.toLowerCase(), name)
    for (const item of s.newStudents.get(studentId)?.amounts.values() || []) candidates.set(item.name.toLowerCase(), item.name)
    let adds = false
    for (const [key, name] of candidates) {
      if (entry.items.has(key)) continue
      const from = money(amount(s.oldStudents, oldClass, studentId, entry.classId, key))
      const to = money(amount(s.newStudents, newClass, studentId, entry.classId, key))
      if (from !== 0 || to <= 0) continue
      adds = true
      note(entry.classId, own(studentId, key) ? entry.studentName || studentId : entry.className, name, 0, to)
    }
    if (adds) actions.push({ kind: 'add', studentId, studentName: entry.studentName, structureId: entry.structureId })
  }
  const affected = new Set(actions.map(action => action.kind === 'add' ? action.studentId : String(action.obligation.studentId)))
  return { impact: [...grouped.values()], actions, affected: affected.size }
}

/**
 * Save the whole term's table. Amounts of 0 (or blank) leave an item out for
 * that class. If students have already been billed, the caller must choose:
 * `adjust_existing` (audited adjustments for everyone affected) or
 * `future_only` (only students billed from now on pay the new amounts).
 */
export async function saveTermGrid(db: D1Database, options: {
  tenantId: string, actor: Actor, term: TermRef, classes: ClassRef[], input: GridInput, changeMode?: string, enrollments?: Enrollment[], debtMode?: string, feeMode?: string,
  // Publishing edits published fees directly; every change to billed students still asks first.
  allowPublished?: boolean,
}) {
  await ensureFeeEngineTables(db)
  const lock = await getTermLock(db, options.tenantId, options.term.id)
  if (lock.locked && !options.allowPublished) throw new FinanceError(`${options.term.name} fees are locked. Unlock them to make changes.`, 423)
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
  if (options.debtMode !== undefined && !['carry', 'write_off'].includes(String(options.debtMode))) throw new FinanceError('Choose whether to carry or write off earlier debts.')
  if (options.feeMode !== undefined && !(FEE_MODES as readonly string[]).includes(String(options.feeMode))) throw new FinanceError('Choose class fees or individual student fees.')
  const oldMode = (await getDebtSettings(db, options.tenantId, options.term.id)).feeMode
  const newMode = options.feeMode ? String(options.feeMode) : oldMode

  // Student-specific fees: a blank cell means "same as the class".
  const oldStudents = await loadStudentAmounts(db, options.tenantId, options.term.id)
  let studentPlan: StudentAmounts | null = null
  if (Array.isArray(options.input.students)) {
    studentPlan = new Map()
    for (const row of options.input.students) {
      const studentId = String(row?.studentId || '').trim().slice(0, 200)
      if (!studentId) continue
      const amounts = new Map<string, { name: string, amount: number }>()
      for (const column of columns) {
        const raw = row.amounts?.[column.name]
        if (raw === undefined || raw === null || String(raw).trim() === '') continue
        const amount = money(raw)
        if (amount < 0) throw new FinanceError(`${row.studentName || studentId}: ${column.name} cannot be negative.`)
        amounts.set(column.name.toLowerCase(), { name: column.name, amount })
      }
      if (amounts.size) studentPlan.set(studentId, { studentName: String(row.studentName || oldStudents.get(studentId)?.studentName || '').slice(0, 200), amounts })
    }
  }
  const newStudents = studentPlan || oldStudents

  const existingList = (await listStructures(db, options.tenantId, { termId: options.term.id })).filter(Boolean) as Structure[]
  const existing = new Map(existingList.map(structure => [structure.classId, structure]))
  const { impact, actions, affected } = await billedChanges(db, options.tenantId, options.term.id, { plan, existing, oldStudents, newStudents, oldMode, newMode })
  if (impact.length && !['adjust_existing', 'future_only'].includes(String(options.changeMode))) {
    throw new FinanceError(`${affected} student${affected === 1 ? ' has' : 's have'} already been billed. Choose what should happen to them.`, 409, { needsDecision: true, affectedStudents: affected, changes: impact })
  }

  // Every class keeps every item on file, at 0 where the class does not pay it,
  // so a student in any class — even one whose row is empty — can be billed
  // their own amounts. A 0 item is never billed to anyone without their own amount.
  const someoneHasOwnFees = newMode === 'student' || newStudents.size > 0
  let saved = 0
  for (const [classId, amounts] of plan) {
    const klass = classMap.get(classId)!
    const current = existing.get(classId)
    if (!amounts.size && !current && !someoneHasOwnFees) continue
    const items = columns.map(column => {
      const amount = amounts.get(column.name) || 0
      return { name: column.name, amount, required: amount > 0 ? column.required : false, frequency: column.frequency }
    })
    if (!items.length) continue
    if (current && current.status === 'closed') throw new FinanceError(`${klass.name}'s fees for ${options.term.name} are closed.`, 409)
    await saveStructure(db, {
      tenantId: options.tenantId, actor: options.actor, id: current?.id, items,
      period: { sessionId: options.term.sessionId, sessionName: options.term.sessionName, termId: options.term.id, termName: options.term.name, classId, className: klass.name },
    })
    saved += 1
  }

  if (studentPlan) {
    const now = new Date().toISOString()
    const statements: D1PreparedStatement[] = [db.prepare(`DELETE FROM fee_student_amounts WHERE tenant_id = ? AND term_id = ?`).bind(options.tenantId, options.term.id)]
    for (const [studentId, entry] of studentPlan) {
      for (const item of entry.amounts.values()) {
        statements.push(db.prepare(`INSERT INTO fee_student_amounts (tenant_id, term_id, student_id, student_name, item, amount, updated_by, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
          .bind(options.tenantId, options.term.id, studentId, entry.studentName || null, item.name, item.amount, options.actor.name || null, now))
      }
    }
    // One batch is one transaction; large schools are split into chunks.
    for (let index = 0; index < statements.length; index += 80) await db.batch(statements.slice(index, index + 80))
  }
  if (options.debtMode) await saveDebtMode(db, options.tenantId, options.term, String(options.debtMode), options.actor)
  if (newMode !== oldMode) await saveFeeMode(db, options.tenantId, options.term, newMode, options.actor)

  // Students already billed: apply the decision, every change audited.
  let adjusted = 0
  if (actions.length && options.changeMode === 'adjust_existing') {
    const additions = new Map<string, Array<{ studentId: string, studentName: string }>>()
    for (const action of actions) {
      if (action.kind === 'add') {
        additions.set(action.structureId, [...(additions.get(action.structureId) || []), { studentId: action.studentId, studentName: action.studentName }])
        continue
      }
      const { obligation, label, from, to } = action
      const reason = `Fee change for ${label}: ${obligation.feeItem} ${from} → ${to}`
      if (to === 0) {
        // An item removed: cancel unpaid charges; paid ones are credited back instead.
        if (obligation.amountPaid === 0) await cancelObligation(db, { tenantId: options.tenantId, obligationId: obligation.id, reason, actor: options.actor })
        else await addAdjustment(db, { tenantId: options.tenantId, obligationId: obligation.id, kind: 'credit', amount: obligation.netAmount, reason, actor: options.actor })
      } else {
        const delta = money(to - from)
        await addAdjustment(db, { tenantId: options.tenantId, obligationId: obligation.id, kind: delta > 0 ? 'debit' : 'credit', amount: Math.abs(delta), reason, actor: options.actor })
      }
      adjusted += 1
    }
    // New items for students already billed: bill what they do not have yet.
    for (const [structureId, students] of additions) {
      const structure = await getStructure(db, options.tenantId, structureId)
      if (structure?.status !== 'published') continue
      const result = await issueBills(db, { tenantId: options.tenantId, structureId, actor: options.actor, students, legacyBilledStudentIds: new Set(), ...studentBilling(newStudents, newMode) })
      adjusted += result.issued
    }
  }
  await auditStatement(db, options.tenantId, {
    actor: options.actor, action: 'term_fees_saved', sessionId: options.term.sessionId, termId: options.term.id,
    newValue: { classes: saved, columns: columns.map(column => column.name), feeMode: newMode, studentSpecific: newStudents.size, changesToBilled: impact, decision: options.changeMode || null, adjustedCharges: adjusted },
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
  const debt = await getDebtSettings(db, options.tenantId, options.term.id)
  const own = studentBilling(await loadStudentAmounts(db, options.tenantId, options.term.id), debt.feeMode)
  let issued = 0
  const students = new Set<string>()
  for (const structure of structures) {
    if (!structure.items.length) continue
    if (structure.status === 'draft') await setStructureStatus(db, { tenantId: options.tenantId, id: structure.id, status: 'published', actor: options.actor })
    const inClass = options.enrollments.filter(enrollment => enrollment.classId === structure.classId)
    if (!inClass.length) continue
    const result = await issueBills(db, { tenantId: options.tenantId, structureId: structure.id, actor: options.actor, students: inClass, legacyBilledStudentIds: options.legacyBilledStudentIds, ...own })
    issued += result.issued
    inClass.forEach(enrollment => { if (!options.legacyBilledStudentIds.has(enrollment.studentId)) students.add(enrollment.studentId) })
  }
  // The school chose to start this term clean: earlier debts are written off, each one recorded.
  const writtenOff = debt.mode === 'write_off'
    ? await writeOffEarlierDebts(db, { tenantId: options.tenantId, actor: options.actor, term: options.term, studentIds: options.enrollments.map(enrollment => enrollment.studentId) })
    : null
  const now = new Date().toISOString()
  await db.batch([
    db.prepare(`INSERT INTO fee_term_locks (tenant_id, term_id, locked, locked_by, locked_at) VALUES (?, ?, 1, ?, ?) ON CONFLICT(tenant_id, term_id) DO UPDATE SET locked = 1, locked_by = excluded.locked_by, locked_at = excluded.locked_at`).bind(options.tenantId, options.term.id, options.actor.name, now),
    auditStatement(db, options.tenantId, { actor: options.actor, action: 'term_fees_locked', sessionId: options.term.sessionId, termId: options.term.id, newValue: { students: students.size, charges: issued, debtMode: debt.mode, writtenOff } }),
  ])
  return { students: students.size, charges: issued, writtenOff }
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
  const debt = await getDebtSettings(db, options.tenantId, options.term.id)
  const own = studentBilling(await loadStudentAmounts(db, options.tenantId, options.term.id), debt.feeMode)
  let created = 0
  const noFees: string[] = []
  const billed: string[] = []
  for (const student of options.students) {
    const structure = byClass.get(student.classId)
    if (!structure || !structure.items.length) { noFees.push(student.studentName || student.studentId); continue }
    if (structure.status === 'draft') await setStructureStatus(db, { tenantId: options.tenantId, id: structure.id, status: 'published', actor: options.actor })
    const result = await issueBills(db, { tenantId: options.tenantId, structureId: structure.id, actor: options.actor, students: [student], legacyBilledStudentIds: new Set(), ...own })
    created += result.issued
    billed.push(student.studentId)
  }
  // Late joiners follow the term's choice about earlier debts, like everyone else.
  if (debt.mode === 'write_off' && billed.length) await writeOffEarlierDebts(db, { tenantId: options.tenantId, actor: options.actor, term: options.term, studentIds: billed })
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
    return { ...enrollment, ...summarise(charges, ledger, period.termId, termStart), classMove: moved ? { fromClassId: billedClass, toClassId: enrollment.classId } : null, left: false }
  })
  // Students no longer on this term's register but still owing.
  for (const [studentId, charges] of byStudent) {
    if (seen.has(studentId)) continue
    const summary = summarise(charges, ledger, period.termId, termStart)
    if (summary.balance === 0) continue
    const last = charges[charges.length - 1]
    out.push({ studentId, studentName: last?.studentName || studentId, classId: last?.classId || '', className: last?.className ? `${last.className} (left)` : 'Left the register', ...summary, classMove: null, left: true })
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
