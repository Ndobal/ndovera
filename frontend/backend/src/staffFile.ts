// The Digital Staff Office File.
//
// One authoritative file per member of staff, opened from their name anywhere
// in Ndovera. It replaces the physical office folder:
//
//   Records  — employment and role history, documents, qualifications,
//              training, leave, disciplinary, assets, contacts, next of kin,
//              salary, exit. Never overwritten: an edit is a new version that
//              supersedes the old one, which stays in the history.
//   Loans    — applied for in Ndovera or recorded from before it. The balance
//              only ever moves through transactions: a confirmed repayment,
//              an adjustment or a formal waiver. Nobody edits a balance.
//   Tasks    — assigned by management, updated by the staff member, then
//              evaluated (Outstanding … Unsatisfactory, optionally a score).
//   Reviews  — formal performance reviews here; peer reviews come from the
//              Staff Evaluation module.
//   Reports  — concerns about a member of staff, with a workflow that gives
//              them a chance to respond. A confidential reporter is hidden
//              from the staff member, never from authorised investigators.
//   Rewards  — awards, badges and certificates.
//
// Permissions are per record, not per page: who may see a record depends on
// the viewer's role, their relation to the staff member and the record's own
// visibility (staff-visible, management only, or owner only).

export class StaffFileError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

export const RECORD_CATEGORIES = ['employment', 'document', 'qualification', 'training', 'leave', 'disciplinary', 'asset', 'emergency_contact', 'next_of_kin', 'salary', 'exit', 'policy', 'note'] as const
export type RecordCategory = typeof RECORD_CATEGORIES[number]
export const RECORD_LABELS: Record<RecordCategory, string> = {
  employment: 'Employment & role history', document: 'Documents', qualification: 'Certificates & qualifications', training: 'Training & development',
  leave: 'Leave & absence', disciplinary: 'Queries, warnings & disciplinary', asset: 'Assets issued', emergency_contact: 'Emergency contacts',
  next_of_kin: 'Next of kin', salary: 'Salary history', exit: 'Exit & clearance', policy: 'Signed policies', note: 'Notes',
}
// private: only the staff member, the HoS, the Owner and the Accountant — not section heads or colleagues.
export const VISIBILITIES = ['staff', 'management', 'private', 'restricted'] as const
export type Visibility = typeof VISIBILITIES[number]
// Where a category lands if the person adding the record does not choose.
const DEFAULT_VISIBILITY: Partial<Record<RecordCategory, Visibility>> = { disciplinary: 'management', salary: 'restricted', note: 'management' }

export const TASK_RATINGS = ['Outstanding', 'Very Well Done', 'Well Done', 'Satisfactory', 'Needs Improvement', 'Unsatisfactory'] as const
export const TASK_STATUSES = ['assigned', 'in_progress', 'submitted', 'completed'] as const
export const LOAN_STATUSES = ['submitted', 'under_review', 'approved', 'declined', 'active', 'cleared'] as const
export const REPORT_STATUSES = ['submitted', 'under_review', 'response_requested', 'investigated', 'substantiated', 'unsubstantiated', 'action_taken', 'closed'] as const
// From here on the staff member sees the report and may answer it.
const REPORT_VISIBLE_TO_STAFF = new Set(['response_requested', 'investigated', 'substantiated', 'unsubstantiated', 'action_taken', 'closed'])
export const REWARD_TYPES = ['certificate', 'badge', 'commendation', 'employee_of_the_month', 'punctuality', 'lesson_preparation', 'task_performance', 'long_service', 'innovation', 'student_impact', 'custom'] as const

// ─── Who may do what ─────────────────────────────────────────────────────────

export type Viewer = { id: string, name: string, role: string, isSelf: boolean, oversees: boolean }

/**
 * What a viewer may see and do in one staff file. `oversees` means the viewer is
 * a section head whose section this staff member teaches in.
 */
export function staffFilePermissions(viewer: Viewer) {
  const role = viewer.role
  const owner = role === 'owner'
  const hos = role === 'hos'
  const management = owner || hos
  const accountant = role === 'accountant'
  const sectionHead = viewer.oversees && !management
  return {
    view: viewer.isSelf || management || accountant || sectionHead,
    // Record visibility the viewer may read.
    visibilities: (owner ? ['staff', 'management', 'private', 'restricted'] : hos ? ['staff', 'management', 'private'] : ['staff']) as Visibility[],
    // Private records: the staff member themselves, the HoS, the Owner and the Accountant.
    seePrivate: viewer.isSelf || management || accountant,
    addPrivate: management || accountant,
    categoriesHidden: (accountant && !viewer.isSelf ? RECORD_CATEGORIES.filter(category => !['salary', 'employment'].includes(category)) : sectionHead ? ['salary', 'disciplinary', 'next_of_kin', 'emergency_contact', 'exit'] : []) as RecordCategory[],
    // Accountants may read salary history even though it is owner-restricted by default.
    readRestrictedSalary: owner || accountant,
    addRecords: management,
    addOwnContactRecords: viewer.isSelf,
    loans: viewer.isSelf || management || accountant,
    manageLoans: management || accountant,
    applyForLoan: viewer.isSelf,
    tasks: viewer.isSelf || management || sectionHead,
    assignTasks: management || sectionHead,
    reviews: viewer.isSelf || management || sectionHead,
    writeReviews: management,
    reports: viewer.isSelf || management,
    investigateReports: management,
    seeReporterIdentity: management,
    rewards: true,
    giveRewards: management || sectionHead,
    submissions: viewer.isSelf || management || sectionHead,
    attendance: viewer.isSelf || management || sectionHead || accountant,
    payroll: viewer.isSelf || owner || accountant,
  }
}
export type StaffFilePermissions = ReturnType<typeof staffFilePermissions>

let _ready = false
export function resetStaffFileCache() {
  _ready = false
}

export async function ensureStaffFileTables(db: D1Database) {
  if (_ready) return
  const statements = [
    `CREATE TABLE IF NOT EXISTS staff_records (
      id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, staff_id TEXT NOT NULL, category TEXT NOT NULL, title TEXT NOT NULL, detail TEXT,
      effective_from TEXT, effective_to TEXT, status TEXT, visibility TEXT NOT NULL, files_json TEXT, metadata_json TEXT,
      supersedes_id TEXT, superseded_by TEXT, superseded_at TEXT,
      created_by TEXT, created_by_name TEXT, created_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS staff_loans (
      id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, staff_id TEXT NOT NULL, number TEXT NOT NULL, principal REAL NOT NULL, purpose TEXT,
      period_months INTEGER, monthly_instalment REAL, status TEXT NOT NULL, source TEXT NOT NULL, issued_on TEXT, next_payment_on TEXT,
      decision_note TEXT, decided_by_name TEXT, decided_at TEXT, cleared_at TEXT, evidence_json TEXT,
      created_by TEXT, created_by_name TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS staff_loan_transactions (
      id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, loan_id TEXT NOT NULL, type TEXT NOT NULL, amount REAL NOT NULL, paid_on TEXT,
      status TEXT NOT NULL, proof_json TEXT, note TEXT, created_by TEXT, created_by_name TEXT, created_at TEXT NOT NULL,
      confirmed_by_name TEXT, confirmed_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS staff_tasks (
      id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, title TEXT NOT NULL, description TEXT, due_on TEXT, priority TEXT,
      assigned_by TEXT, assigned_by_name TEXT, created_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS staff_task_assignees (
      id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, task_id TEXT NOT NULL, staff_id TEXT NOT NULL, status TEXT NOT NULL,
      progress_note TEXT, evidence_json TEXT, rating TEXT, score REAL, comments TEXT, evaluated_by_name TEXT, evaluated_at TEXT, updated_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS staff_performance_reviews (
      id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, staff_id TEXT NOT NULL, period_label TEXT NOT NULL, criteria_json TEXT NOT NULL, overall REAL,
      comments TEXT, internal_notes TEXT, reviewer_id TEXT, reviewer_name TEXT, created_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS staff_reports (
      id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, staff_id TEXT NOT NULL, category TEXT NOT NULL, details TEXT NOT NULL, confidential INTEGER NOT NULL DEFAULT 1,
      reporter_id TEXT, reporter_name TEXT, status TEXT NOT NULL, staff_response TEXT, staff_responded_at TEXT, management_response TEXT, outcome TEXT,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS staff_rewards (
      id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, staff_id TEXT NOT NULL, type TEXT NOT NULL, title TEXT NOT NULL, reason TEXT, period_label TEXT,
      badge TEXT, certificate INTEGER NOT NULL DEFAULT 0, awarded_on TEXT NOT NULL, awarded_by TEXT, awarded_by_name TEXT, created_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS staff_file_audit (
      id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, staff_id TEXT NOT NULL, record_type TEXT NOT NULL, record_id TEXT, action TEXT NOT NULL,
      before_json TEXT, after_json TEXT, reason TEXT, actor_id TEXT, actor_name TEXT, actor_role TEXT, created_at TEXT NOT NULL)`,
    `CREATE INDEX IF NOT EXISTS idx_staff_records ON staff_records(tenant_id, staff_id, category)`,
    `CREATE INDEX IF NOT EXISTS idx_staff_loans ON staff_loans(tenant_id, staff_id)`,
    `CREATE INDEX IF NOT EXISTS idx_staff_task_assignees ON staff_task_assignees(tenant_id, staff_id)`,
    `CREATE INDEX IF NOT EXISTS idx_staff_file_audit ON staff_file_audit(tenant_id, staff_id, created_at)`,
  ]
  for (const statement of statements) await db.prepare(statement).run()
  _ready = true
}

const parse = <T>(value: unknown, fallback: T): T => {
  try { return value ? JSON.parse(String(value)) as T : fallback } catch { return fallback }
}
const now = () => new Date().toISOString()
const isDate = (value: unknown) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))
const text = (value: unknown, max: number) => String(value ?? '').trim().slice(0, max)
const money = (value: unknown) => Math.round(Number(value) * 100) / 100

export type Actor = { id: string, name: string, role: string }

export function normalizeFiles(value: unknown) {
  return (Array.isArray(value) ? value : []).slice(0, 20).map((file: any) => ({
    name: text(file?.name, 200), url: String(file?.url || ''), type: text(file?.type, 100), size: Number(file?.size || 0),
  })).filter(file => /^https?:\/\//.test(file.url) || file.url.startsWith('/'))
}

export async function recordStaffAudit(db: D1Database, entry: {
  tenantId: string, staffId: string, recordType: string, recordId?: string, action: string, actor: Actor, before?: unknown, after?: unknown, reason?: string,
}) {
  await db.prepare(`INSERT INTO staff_file_audit (id, tenant_id, staff_id, record_type, record_id, action, before_json, after_json, reason, actor_id, actor_name, actor_role, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
    `saud-${crypto.randomUUID()}`, entry.tenantId, entry.staffId, entry.recordType, entry.recordId || null, entry.action,
    entry.before === undefined ? null : JSON.stringify(entry.before), entry.after === undefined ? null : JSON.stringify(entry.after),
    entry.reason || null, entry.actor.id, entry.actor.name, entry.actor.role, now(),
  ).run()
}

export async function listStaffAudit(db: D1Database, tenantId: string, staffId: string, limit = 200) {
  await ensureStaffFileTables(db)
  const rows = await db.prepare(`SELECT * FROM staff_file_audit WHERE tenant_id = ? AND lower(staff_id) = lower(?) ORDER BY created_at DESC LIMIT ?`).bind(tenantId, staffId, limit).all()
  return ((rows.results || []) as Record<string, any>[]).map(row => ({
    id: row.id, recordType: row.record_type, recordId: row.record_id, action: row.action, before: parse(row.before_json, null as any), after: parse(row.after_json, null as any),
    reason: row.reason || '', actorName: row.actor_name || '', actorRole: row.actor_role || '', createdAt: row.created_at,
  }))
}

// ─── HR records ──────────────────────────────────────────────────────────────

function mapRecord(row: Record<string, any>) {
  return {
    id: String(row.id), staffId: row.staff_id, category: row.category as RecordCategory, title: row.title, detail: row.detail || '',
    effectiveFrom: row.effective_from || '', effectiveTo: row.effective_to || '', status: row.status || '', visibility: row.visibility as Visibility,
    files: parse(row.files_json, [] as any[]), metadata: parse(row.metadata_json, {} as Record<string, any>),
    supersedesId: row.supersedes_id || null, supersededBy: row.superseded_by || null, supersededAt: row.superseded_at || null,
    createdByName: row.created_by_name || '', createdAt: row.created_at,
  }
}
export type StaffRecord = ReturnType<typeof mapRecord>

export function canSeeRecord(record: { category: RecordCategory, visibility: Visibility }, permissions: StaffFilePermissions) {
  if (record.visibility === 'private') return permissions.seePrivate
  if (permissions.categoriesHidden.includes(record.category)) return false
  if (record.category === 'salary' && permissions.readRestrictedSalary) return true
  return permissions.visibilities.includes(record.visibility)
}

function normalizeRecordInput(input: Record<string, any>) {
  const category = String(input.category || '') as RecordCategory
  if (!RECORD_CATEGORIES.includes(category)) throw new StaffFileError('Choose what kind of record this is.')
  const title = text(input.title, 200)
  if (!title) throw new StaffFileError('Give the record a title.')
  const visibility = (VISIBILITIES.includes(input.visibility) ? input.visibility : DEFAULT_VISIBILITY[category] || 'staff') as Visibility
  for (const key of ['effectiveFrom', 'effectiveTo']) if (input[key] && !isDate(input[key])) throw new StaffFileError('Dates must be dates.')
  if (input.effectiveFrom && input.effectiveTo && input.effectiveTo < input.effectiveFrom) throw new StaffFileError('The end date is before the start date.')
  return {
    category, title, detail: text(input.detail, 8000), effectiveFrom: input.effectiveFrom || '', effectiveTo: input.effectiveTo || '',
    status: text(input.status, 60), visibility, files: normalizeFiles(input.files),
    metadata: input.metadata && typeof input.metadata === 'object' ? input.metadata : {},
  }
}

export async function listStaffRecords(db: D1Database, tenantId: string, staffId: string, options: { includeSuperseded?: boolean } = {}) {
  await ensureStaffFileTables(db)
  const rows = await db.prepare(`SELECT * FROM staff_records WHERE tenant_id = ? AND lower(staff_id) = lower(?) ${options.includeSuperseded ? '' : 'AND superseded_at IS NULL'}
    ORDER BY COALESCE(effective_from, created_at) DESC, created_at DESC`).bind(tenantId, staffId).all()
  return ((rows.results || []) as Record<string, any>[]).map(mapRecord)
}

export async function getStaffRecord(db: D1Database, tenantId: string, id: string) {
  await ensureStaffFileTables(db)
  const row = await db.prepare(`SELECT * FROM staff_records WHERE tenant_id = ? AND id = ?`).bind(tenantId, id).first() as Record<string, any> | null
  return row ? mapRecord(row) : null
}

/** Adds a record — or, with `supersedesId`, a new version of one; the old version stays in the history. */
export async function addStaffRecord(db: D1Database, options: { tenantId: string, staffId: string, input: Record<string, any>, actor: Actor, supersedesId?: string }) {
  await ensureStaffFileTables(db)
  const record = normalizeRecordInput(options.input)
  let previous: StaffRecord | null = null
  if (options.supersedesId) {
    previous = await getStaffRecord(db, options.tenantId, options.supersedesId)
    if (!previous || previous.staffId.toLowerCase() !== options.staffId.toLowerCase()) throw new StaffFileError('Record not found.', 404)
    if (previous.supersededAt) throw new StaffFileError('A newer version of this record already exists. Edit that one.', 409)
  }
  const id = `srec-${crypto.randomUUID()}`
  const timestamp = now()
  await db.prepare(`INSERT INTO staff_records (id, tenant_id, staff_id, category, title, detail, effective_from, effective_to, status, visibility, files_json, metadata_json, supersedes_id, created_by, created_by_name, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
    id, options.tenantId, options.staffId, record.category, record.title, record.detail || null, record.effectiveFrom || null, record.effectiveTo || null, record.status || null,
    record.visibility, JSON.stringify(record.files), JSON.stringify(record.metadata), previous?.id || null, options.actor.id, options.actor.name, timestamp,
  ).run()
  if (previous) {
    await db.prepare(`UPDATE staff_records SET superseded_by = ?, superseded_at = ? WHERE id = ?`).bind(id, timestamp, previous.id).run()
  }
  await recordStaffAudit(db, { tenantId: options.tenantId, staffId: options.staffId, recordType: 'record', recordId: id, action: previous ? 'record_revised' : 'record_added', actor: options.actor, before: previous || undefined, after: record })
  return (await getStaffRecord(db, options.tenantId, id))!
}

/** Every version of a record, newest first. */
export async function staffRecordHistory(db: D1Database, tenantId: string, id: string) {
  const versions: StaffRecord[] = []
  let current = await getStaffRecord(db, tenantId, id)
  // Walk forward to the newest version, then back through every earlier one.
  while (current?.supersededBy) current = await getStaffRecord(db, tenantId, current.supersededBy)
  for (let guard = 0; current && guard < 100; guard += 1) {
    versions.push(current)
    current = current.supersedesId ? await getStaffRecord(db, tenantId, current.supersedesId) : null
  }
  return versions
}

// ─── Loans ───────────────────────────────────────────────────────────────────

function mapLoan(row: Record<string, any>) {
  return {
    id: String(row.id), staffId: row.staff_id, number: row.number, principal: Number(row.principal), purpose: row.purpose || '',
    periodMonths: row.period_months == null ? null : Number(row.period_months), monthlyInstalment: row.monthly_instalment == null ? null : Number(row.monthly_instalment),
    status: row.status, source: row.source, issuedOn: row.issued_on || '', nextPaymentOn: row.next_payment_on || '',
    decisionNote: row.decision_note || '', decidedByName: row.decided_by_name || '', decidedAt: row.decided_at || null, clearedAt: row.cleared_at || null,
    evidence: parse(row.evidence_json, [] as any[]), createdByName: row.created_by_name || '', createdAt: row.created_at, updatedAt: row.updated_at,
  }
}
function mapTransaction(row: Record<string, any>) {
  return {
    id: String(row.id), loanId: row.loan_id, type: row.type, amount: Number(row.amount), paidOn: row.paid_on || '', status: row.status,
    proof: parse(row.proof_json, [] as any[]), note: row.note || '', createdByName: row.created_by_name || '', createdAt: row.created_at,
    confirmedByName: row.confirmed_by_name || '', confirmedAt: row.confirmed_at || null,
  }
}
export type Loan = ReturnType<typeof mapLoan>
export type LoanTransaction = ReturnType<typeof mapTransaction>

/** The balance is principal minus confirmed repayments and waivers, plus or minus confirmed adjustments. */
export function loanBalance(loan: Pick<Loan, 'principal'>, transactions: LoanTransaction[]) {
  let paid = 0
  let waived = 0
  let adjusted = 0
  for (const tx of transactions) {
    if (tx.status !== 'confirmed') continue
    if (tx.type === 'repayment') paid += tx.amount
    else if (tx.type === 'waiver') waived += tx.amount
    else if (tx.type === 'adjustment') adjusted += tx.amount
  }
  const outstanding = money(Math.max(0, loan.principal + adjusted - paid - waived))
  const awaiting = money(transactions.filter(tx => tx.status === 'awaiting_confirmation').reduce((sum, tx) => sum + tx.amount, 0))
  return { totalPaid: money(paid), waived: money(waived), adjusted: money(adjusted), outstanding, awaitingConfirmation: awaiting, percentPaid: loan.principal > 0 ? Math.min(100, Math.round((paid / (loan.principal + adjusted)) * 100)) : 100 }
}

export async function getLoan(db: D1Database, tenantId: string, id: string) {
  await ensureStaffFileTables(db)
  const row = await db.prepare(`SELECT * FROM staff_loans WHERE tenant_id = ? AND id = ?`).bind(tenantId, id).first() as Record<string, any> | null
  if (!row) return null
  const txRows = await db.prepare(`SELECT * FROM staff_loan_transactions WHERE tenant_id = ? AND loan_id = ? ORDER BY created_at`).bind(tenantId, id).all()
  const loan = mapLoan(row)
  const transactions = ((txRows.results || []) as Record<string, any>[]).map(mapTransaction)
  return { ...loan, transactions, ...loanBalance(loan, transactions) }
}
export type LoanWithLedger = NonNullable<Awaited<ReturnType<typeof getLoan>>>

export async function listLoans(db: D1Database, tenantId: string, staffId: string) {
  await ensureStaffFileTables(db)
  const rows = await db.prepare(`SELECT id FROM staff_loans WHERE tenant_id = ? AND lower(staff_id) = lower(?) ORDER BY created_at DESC`).bind(tenantId, staffId).all()
  const loans: LoanWithLedger[] = []
  for (const row of (rows.results || []) as Record<string, any>[]) {
    // eslint-disable-next-line no-await-in-loop
    const loan = await getLoan(db, tenantId, String(row.id))
    if (loan) loans.push(loan)
  }
  return loans
}

async function nextLoanNumber(db: D1Database, tenantId: string) {
  const row = await db.prepare(`SELECT COUNT(*) AS count FROM staff_loans WHERE tenant_id = ?`).bind(tenantId).first() as Record<string, any> | null
  return `LN-${String(Number(row?.count || 0) + 1).padStart(4, '0')}`
}

function positiveAmount(value: unknown, label: string) {
  const amount = money(value)
  if (!Number.isFinite(amount) || amount <= 0) throw new StaffFileError(`Enter the ${label} as an amount above zero.`)
  return amount
}

/**
 * A staff member applies (Submitted), or management records a loan that began
 * outside Ndovera (Active, with what was already repaid as a confirmed opening repayment).
 */
export async function createLoan(db: D1Database, options: { tenantId: string, staffId: string, input: Record<string, any>, actor: Actor, existing: boolean }) {
  await ensureStaffFileTables(db)
  const principal = positiveAmount(options.input.principal ?? options.input.amount, 'loan amount')
  const purpose = text(options.input.purpose, 1000)
  if (!options.existing && !purpose) throw new StaffFileError('Say what the loan is for.')
  const periodMonths = options.input.periodMonths ? Math.max(1, Math.min(120, Math.round(Number(options.input.periodMonths)))) : null
  const monthly = options.input.monthlyInstalment ? positiveAmount(options.input.monthlyInstalment, 'monthly instalment') : (periodMonths ? money(principal / periodMonths) : null)
  const issuedOn = options.input.issuedOn || ''
  if (issuedOn && !isDate(issuedOn)) throw new StaffFileError('The date issued must be a date.')
  if (options.existing && !issuedOn) throw new StaffFileError('Enter the date the loan was issued.')
  const alreadyRepaid = options.existing ? money(options.input.alreadyRepaid || 0) : 0
  if (alreadyRepaid < 0 || alreadyRepaid > principal) throw new StaffFileError('The amount already repaid cannot be more than the loan.')
  const nextPaymentOn = options.input.nextPaymentOn && isDate(options.input.nextPaymentOn) ? options.input.nextPaymentOn : ''
  const id = `loan-${crypto.randomUUID()}`
  const timestamp = now()
  const number = await nextLoanNumber(db, options.tenantId)
  const status = options.existing ? (alreadyRepaid >= principal ? 'cleared' : 'active') : 'submitted'
  await db.prepare(`INSERT INTO staff_loans (id, tenant_id, staff_id, number, principal, purpose, period_months, monthly_instalment, status, source, issued_on, next_payment_on, evidence_json, cleared_at, created_by, created_by_name, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
    id, options.tenantId, options.staffId, number, principal, purpose || null, periodMonths, monthly, status, options.existing ? 'existing' : 'application',
    issuedOn || null, nextPaymentOn || null, JSON.stringify(normalizeFiles(options.input.evidence)), status === 'cleared' ? timestamp : null,
    options.actor.id, options.actor.name, timestamp, timestamp,
  ).run()
  if (alreadyRepaid > 0) {
    await db.prepare(`INSERT INTO staff_loan_transactions (id, tenant_id, loan_id, type, amount, paid_on, status, note, created_by, created_by_name, created_at, confirmed_by_name, confirmed_at)
      VALUES (?, ?, ?, 'repayment', ?, ?, 'confirmed', 'Repaid before the loan was recorded in Ndovera', ?, ?, ?, ?, ?)`).bind(
      `ltx-${crypto.randomUUID()}`, options.tenantId, id, alreadyRepaid, issuedOn || null, options.actor.id, options.actor.name, timestamp, options.actor.name, timestamp,
    ).run()
  }
  await recordStaffAudit(db, { tenantId: options.tenantId, staffId: options.staffId, recordType: 'loan', recordId: id, action: options.existing ? 'loan_recorded' : 'loan_applied', actor: options.actor, after: { number, principal, alreadyRepaid } })
  return (await getLoan(db, options.tenantId, id))!
}

const LOAN_DECISIONS: Record<string, { from: string[], to: string }> = {
  review: { from: ['submitted'], to: 'under_review' },
  approve: { from: ['submitted', 'under_review'], to: 'approved' },
  decline: { from: ['submitted', 'under_review', 'approved'], to: 'declined' },
  activate: { from: ['approved'], to: 'active' },
}

export async function decideLoan(db: D1Database, options: { tenantId: string, loanId: string, decision: unknown, note?: unknown, issuedOn?: unknown, nextPaymentOn?: unknown, actor: Actor }) {
  const loan = await getLoan(db, options.tenantId, options.loanId)
  if (!loan) throw new StaffFileError('Loan not found.', 404)
  const rule = LOAN_DECISIONS[String(options.decision || '')]
  if (!rule) throw new StaffFileError('Choose a decision.')
  if (!rule.from.includes(loan.status)) throw new StaffFileError(`A ${loan.status.replace('_', ' ')} loan cannot be moved to ${rule.to.replace('_', ' ')}.`, 409)
  const note = text(options.note, 1000)
  if (rule.to === 'declined' && !note) throw new StaffFileError('Give a reason for declining the loan.')
  const issuedOn = rule.to === 'active' ? (isDate(options.issuedOn) ? String(options.issuedOn) : new Date().toISOString().slice(0, 10)) : loan.issuedOn
  const nextPaymentOn = isDate(options.nextPaymentOn) ? String(options.nextPaymentOn) : loan.nextPaymentOn
  await db.prepare(`UPDATE staff_loans SET status = ?, decision_note = COALESCE(?, decision_note), decided_by_name = ?, decided_at = ?, issued_on = ?, next_payment_on = ?, updated_at = ? WHERE id = ?`)
    .bind(rule.to, note || null, options.actor.name, now(), issuedOn || null, nextPaymentOn || null, now(), loan.id).run()
  await recordStaffAudit(db, { tenantId: options.tenantId, staffId: loan.staffId, recordType: 'loan', recordId: loan.id, action: `loan_${rule.to}`, actor: options.actor, before: { status: loan.status }, after: { status: rule.to }, reason: note })
  return (await getLoan(db, options.tenantId, loan.id))!
}

async function settleIfCleared(db: D1Database, tenantId: string, loanId: string, actor: Actor) {
  const loan = await getLoan(db, tenantId, loanId)
  if (loan && loan.status === 'active' && loan.outstanding <= 0) {
    await db.prepare(`UPDATE staff_loans SET status = 'cleared', cleared_at = ?, updated_at = ? WHERE id = ?`).bind(now(), now(), loan.id).run()
    await recordStaffAudit(db, { tenantId, staffId: loan.staffId, recordType: 'loan', recordId: loan.id, action: 'loan_cleared', actor, after: { status: 'cleared' } })
  }
  return (await getLoan(db, tenantId, loanId))!
}

/**
 * A repayment. From the staff member it waits for confirmation; recorded by
 * management it is confirmed at once. Only confirmed repayments reduce the balance.
 */
export async function addRepayment(db: D1Database, options: { tenantId: string, loanId: string, input: Record<string, any>, actor: Actor, confirmed: boolean }) {
  const loan = await getLoan(db, options.tenantId, options.loanId)
  if (!loan) throw new StaffFileError('Loan not found.', 404)
  if (loan.status !== 'active') throw new StaffFileError('Repayments are recorded against an active loan.', 409)
  const amount = positiveAmount(options.input.amount, 'amount paid')
  if (amount > loan.outstanding - (options.confirmed ? 0 : loan.awaitingConfirmation) + 0.001) throw new StaffFileError(`That is more than the outstanding balance of ${loan.outstanding}.`)
  const paidOn = isDate(options.input.paidOn) ? options.input.paidOn : new Date().toISOString().slice(0, 10)
  const id = `ltx-${crypto.randomUUID()}`
  const timestamp = now()
  await db.prepare(`INSERT INTO staff_loan_transactions (id, tenant_id, loan_id, type, amount, paid_on, status, proof_json, note, created_by, created_by_name, created_at, confirmed_by_name, confirmed_at)
    VALUES (?, ?, ?, 'repayment', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
    id, options.tenantId, loan.id, amount, paidOn, options.confirmed ? 'confirmed' : 'awaiting_confirmation', JSON.stringify(normalizeFiles(options.input.proof)),
    text(options.input.note, 1000) || null, options.actor.id, options.actor.name, timestamp, options.confirmed ? options.actor.name : null, options.confirmed ? timestamp : null,
  ).run()
  await recordStaffAudit(db, { tenantId: options.tenantId, staffId: loan.staffId, recordType: 'loan', recordId: loan.id, action: options.confirmed ? 'repayment_recorded' : 'repayment_reported', actor: options.actor, after: { amount, paidOn } })
  return settleIfCleared(db, options.tenantId, loan.id, options.actor)
}

export async function confirmRepayment(db: D1Database, options: { tenantId: string, loanId: string, transactionId: string, confirm: boolean, note?: unknown, actor: Actor }) {
  const loan = await getLoan(db, options.tenantId, options.loanId)
  if (!loan) throw new StaffFileError('Loan not found.', 404)
  const tx = loan.transactions.find(item => item.id === options.transactionId)
  if (!tx || tx.status !== 'awaiting_confirmation') throw new StaffFileError('That payment is not waiting for confirmation.', 409)
  const note = text(options.note, 1000)
  if (!options.confirm && !note) throw new StaffFileError('Say why the payment is being rejected.')
  if (options.confirm && tx.amount > loan.outstanding + 0.001) throw new StaffFileError('Confirming this would take the balance below zero.')
  await db.prepare(`UPDATE staff_loan_transactions SET status = ?, confirmed_by_name = ?, confirmed_at = ?, note = COALESCE(?, note) WHERE id = ?`)
    .bind(options.confirm ? 'confirmed' : 'rejected', options.actor.name, now(), note || null, tx.id).run()
  await recordStaffAudit(db, { tenantId: options.tenantId, staffId: loan.staffId, recordType: 'loan', recordId: loan.id, action: options.confirm ? 'repayment_confirmed' : 'repayment_rejected', actor: options.actor, after: { amount: tx.amount }, reason: note })
  return settleIfCleared(db, options.tenantId, loan.id, options.actor)
}

/** A formal change to what is owed: an adjustment (+/-) or a waiver. Always with a reason. */
export async function adjustLoan(db: D1Database, options: { tenantId: string, loanId: string, type: unknown, amount: unknown, reason: unknown, actor: Actor }) {
  const loan = await getLoan(db, options.tenantId, options.loanId)
  if (!loan) throw new StaffFileError('Loan not found.', 404)
  if (loan.status !== 'active') throw new StaffFileError('Only an active loan can be adjusted or waived.', 409)
  const type = String(options.type || '')
  if (!['adjustment', 'waiver'].includes(type)) throw new StaffFileError('Choose an adjustment or a waiver.')
  const reason = text(options.reason, 1000)
  if (!reason) throw new StaffFileError('Give the reason for this change; it is kept in the audit trail.')
  const amount = money(options.amount)
  if (!Number.isFinite(amount) || amount === 0) throw new StaffFileError('Enter the amount.')
  if (type === 'waiver' && (amount < 0 || amount > loan.outstanding + 0.001)) throw new StaffFileError('A waiver is a positive amount no more than the outstanding balance.')
  if (type === 'adjustment' && loan.outstanding + amount < -0.001) throw new StaffFileError('That adjustment would take the balance below zero.')
  await db.prepare(`INSERT INTO staff_loan_transactions (id, tenant_id, loan_id, type, amount, paid_on, status, note, created_by, created_by_name, created_at, confirmed_by_name, confirmed_at)
    VALUES (?, ?, ?, ?, ?, ?, 'confirmed', ?, ?, ?, ?, ?, ?)`).bind(
    `ltx-${crypto.randomUUID()}`, options.tenantId, loan.id, type, amount, new Date().toISOString().slice(0, 10), reason, options.actor.id, options.actor.name, now(), options.actor.name, now(),
  ).run()
  await recordStaffAudit(db, { tenantId: options.tenantId, staffId: loan.staffId, recordType: 'loan', recordId: loan.id, action: `loan_${type}`, actor: options.actor, before: { outstanding: loan.outstanding }, after: { amount }, reason })
  return settleIfCleared(db, options.tenantId, loan.id, options.actor)
}

// ─── Tasks ───────────────────────────────────────────────────────────────────

function mapAssignment(row: Record<string, any>) {
  return {
    id: String(row.id), taskId: row.task_id, staffId: row.staff_id, title: row.title, description: row.description || '', dueOn: row.due_on || '', priority: row.priority || 'normal',
    assignedByName: row.assigned_by_name || '', assignedById: row.assigned_by || '', status: row.status, progressNote: row.progress_note || '', evidence: parse(row.evidence_json, [] as any[]),
    rating: row.rating || '', score: row.score == null ? null : Number(row.score), comments: row.comments || '', evaluatedByName: row.evaluated_by_name || '', evaluatedAt: row.evaluated_at || null,
    createdAt: row.created_at, updatedAt: row.updated_at,
  }
}
export type TaskAssignment = ReturnType<typeof mapAssignment>

export async function createTask(db: D1Database, options: { tenantId: string, input: Record<string, any>, staffIds: string[], actor: Actor }) {
  await ensureStaffFileTables(db)
  const title = text(options.input.title, 200)
  if (!title) throw new StaffFileError('Give the task a title.')
  if (!options.staffIds.length) throw new StaffFileError('Choose who the task is for.')
  const dueOn = options.input.dueOn || ''
  if (dueOn && !isDate(dueOn)) throw new StaffFileError('The due date must be a date.')
  const priority = ['low', 'normal', 'high', 'urgent'].includes(options.input.priority) ? options.input.priority : 'normal'
  const id = `task-${crypto.randomUUID()}`
  const timestamp = now()
  await db.prepare(`INSERT INTO staff_tasks (id, tenant_id, title, description, due_on, priority, assigned_by, assigned_by_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(id, options.tenantId, title, text(options.input.description, 4000) || null, dueOn || null, priority, options.actor.id, options.actor.name, timestamp).run()
  for (const staffId of [...new Set(options.staffIds)]) {
    // eslint-disable-next-line no-await-in-loop
    await db.prepare(`INSERT INTO staff_task_assignees (id, tenant_id, task_id, staff_id, status, updated_at) VALUES (?, ?, ?, ?, 'assigned', ?)`).bind(`tasn-${crypto.randomUUID()}`, options.tenantId, id, staffId, timestamp).run()
    // eslint-disable-next-line no-await-in-loop
    await recordStaffAudit(db, { tenantId: options.tenantId, staffId, recordType: 'task', recordId: id, action: 'task_assigned', actor: options.actor, after: { title, dueOn, priority } })
  }
  return id
}

export async function listTasks(db: D1Database, tenantId: string, staffId: string) {
  await ensureStaffFileTables(db)
  const rows = await db.prepare(`SELECT a.*, t.title, t.description, t.due_on, t.priority, t.assigned_by, t.assigned_by_name, t.created_at FROM staff_task_assignees a
    JOIN staff_tasks t ON t.id = a.task_id WHERE a.tenant_id = ? AND lower(a.staff_id) = lower(?) ORDER BY CASE a.status WHEN 'completed' THEN 1 ELSE 0 END, t.due_on, t.created_at DESC`).bind(tenantId, staffId).all()
  return ((rows.results || []) as Record<string, any>[]).map(mapAssignment)
}

export async function getAssignment(db: D1Database, tenantId: string, id: string) {
  await ensureStaffFileTables(db)
  const row = await db.prepare(`SELECT a.*, t.title, t.description, t.due_on, t.priority, t.assigned_by, t.assigned_by_name, t.created_at FROM staff_task_assignees a
    JOIN staff_tasks t ON t.id = a.task_id WHERE a.tenant_id = ? AND a.id = ?`).bind(tenantId, id).first() as Record<string, any> | null
  return row ? mapAssignment(row) : null
}

/** The staff member reports progress, or submits the task as done with evidence. */
export async function updateTaskProgress(db: D1Database, options: { tenantId: string, assignmentId: string, input: Record<string, any>, actor: Actor }) {
  const assignment = await getAssignment(db, options.tenantId, options.assignmentId)
  if (!assignment || assignment.staffId.toLowerCase() !== options.actor.id.toLowerCase()) throw new StaffFileError('Task not found.', 404)
  if (assignment.status === 'completed') throw new StaffFileError('This task has been marked completed.', 409)
  const status = ['in_progress', 'submitted'].includes(options.input.status) ? options.input.status : 'in_progress'
  const evidence = [...assignment.evidence, ...normalizeFiles(options.input.evidence)]
  await db.prepare(`UPDATE staff_task_assignees SET status = ?, progress_note = ?, evidence_json = ?, updated_at = ? WHERE id = ?`)
    .bind(status, text(options.input.note, 4000) || assignment.progressNote || null, JSON.stringify(evidence), now(), assignment.id).run()
  await recordStaffAudit(db, { tenantId: options.tenantId, staffId: assignment.staffId, recordType: 'task', recordId: assignment.taskId, action: status === 'submitted' ? 'task_submitted' : 'task_progress', actor: options.actor, after: { status, note: text(options.input.note, 200) } })
  return (await getAssignment(db, options.tenantId, assignment.id))!
}

/** Management marks a task completed and says how well it was done. */
export async function evaluateTask(db: D1Database, options: { tenantId: string, assignmentId: string, input: Record<string, any>, actor: Actor }) {
  const assignment = await getAssignment(db, options.tenantId, options.assignmentId)
  if (!assignment) throw new StaffFileError('Task not found.', 404)
  const rating = String(options.input.rating || '')
  if (!TASK_RATINGS.includes(rating as any)) throw new StaffFileError('Choose how well the task was done.')
  let score: number | null = null
  if (options.input.score !== undefined && options.input.score !== '' && options.input.score !== null) {
    score = Number(options.input.score)
    if (!Number.isFinite(score) || score < 0 || score > 100) throw new StaffFileError('A score is out of 100.')
  }
  await db.prepare(`UPDATE staff_task_assignees SET status = 'completed', rating = ?, score = ?, comments = ?, evaluated_by_name = ?, evaluated_at = ?, updated_at = ? WHERE id = ?`)
    .bind(rating, score, text(options.input.comments, 4000) || null, options.actor.name, now(), now(), assignment.id).run()
  await recordStaffAudit(db, { tenantId: options.tenantId, staffId: assignment.staffId, recordType: 'task', recordId: assignment.taskId, action: 'task_evaluated', actor: options.actor, before: { status: assignment.status }, after: { rating, score } })
  return (await getAssignment(db, options.tenantId, assignment.id))!
}

// ─── Formal performance reviews ──────────────────────────────────────────────

export const DEFAULT_REVIEW_CRITERIA = ['Punctuality', 'Teaching effectiveness', 'Classroom management', 'Lesson preparation', 'Teamwork', 'Communication', 'Professionalism', 'Task completion']

function mapReview(row: Record<string, any>, includeInternal: boolean) {
  return {
    id: String(row.id), staffId: row.staff_id, periodLabel: row.period_label, criteria: parse(row.criteria_json, [] as Array<{ label: string, score: number }>),
    overall: row.overall == null ? null : Number(row.overall), comments: row.comments || '', ...(includeInternal ? { internalNotes: row.internal_notes || '' } : {}),
    reviewerName: row.reviewer_name || '', createdAt: row.created_at,
  }
}

export async function addPerformanceReview(db: D1Database, options: { tenantId: string, staffId: string, input: Record<string, any>, actor: Actor }) {
  await ensureStaffFileTables(db)
  const periodLabel = text(options.input.periodLabel, 120)
  if (!periodLabel) throw new StaffFileError('Say which period this review covers, for example "Term 1 2026/2027".')
  const criteria = (Array.isArray(options.input.criteria) ? options.input.criteria : [])
    .map((item: any) => ({ label: text(item?.label, 120), score: Number(item?.score) }))
    .filter((item: { label: string }) => item.label)
  if (!criteria.length) throw new StaffFileError('Score at least one criterion.')
  if (criteria.some((item: { score: number }) => !Number.isFinite(item.score) || item.score < 0 || item.score > 100)) throw new StaffFileError('Each score is out of 100.')
  const overall = Math.round(criteria.reduce((sum: number, item: { score: number }) => sum + item.score, 0) / criteria.length)
  const id = `sprev-${crypto.randomUUID()}`
  await db.prepare(`INSERT INTO staff_performance_reviews (id, tenant_id, staff_id, period_label, criteria_json, overall, comments, internal_notes, reviewer_id, reviewer_name, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(id, options.tenantId, options.staffId, periodLabel, JSON.stringify(criteria), overall,
    text(options.input.comments, 4000) || null, text(options.input.internalNotes, 4000) || null, options.actor.id, options.actor.name, now()).run()
  await recordStaffAudit(db, { tenantId: options.tenantId, staffId: options.staffId, recordType: 'review', recordId: id, action: 'review_recorded', actor: options.actor, after: { periodLabel, overall } })
  return id
}

export async function listPerformanceReviews(db: D1Database, tenantId: string, staffId: string, includeInternal: boolean) {
  await ensureStaffFileTables(db)
  const rows = await db.prepare(`SELECT * FROM staff_performance_reviews WHERE tenant_id = ? AND lower(staff_id) = lower(?) ORDER BY created_at DESC`).bind(tenantId, staffId).all()
  return ((rows.results || []) as Record<string, any>[]).map(row => mapReview(row, includeInternal))
}

// ─── Reports about staff ─────────────────────────────────────────────────────

function mapReport(row: Record<string, any>, options: { revealReporter: boolean }) {
  const hidden = Boolean(row.confidential) && !options.revealReporter
  return {
    id: String(row.id), staffId: row.staff_id, category: row.category, details: row.details, confidential: Boolean(row.confidential),
    reporterName: hidden ? '' : (row.reporter_name || ''), reporterId: hidden ? '' : (row.reporter_id || ''),
    status: row.status, staffResponse: row.staff_response || '', staffRespondedAt: row.staff_responded_at || null,
    managementResponse: row.management_response || '', outcome: row.outcome || '', createdAt: row.created_at, updatedAt: row.updated_at,
  }
}

export async function fileReport(db: D1Database, options: { tenantId: string, staffId: string, input: Record<string, any>, actor: Actor }) {
  await ensureStaffFileTables(db)
  const category = text(options.input.category, 80)
  const details = text(options.input.details, 8000)
  if (!category) throw new StaffFileError('Choose a category, for example "Professional conduct".')
  if (details.length < 10) throw new StaffFileError('Describe what happened.')
  if (options.staffId.toLowerCase() === options.actor.id.toLowerCase()) throw new StaffFileError('You cannot file a report about yourself.')
  const id = `sreport-${crypto.randomUUID()}`
  await db.prepare(`INSERT INTO staff_reports (id, tenant_id, staff_id, category, details, confidential, reporter_id, reporter_name, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'submitted', ?, ?)`).bind(id, options.tenantId, options.staffId, category, details, options.input.confidential === false ? 0 : 1,
    options.actor.id, options.actor.name, now(), now()).run()
  // The reporter is recorded in the audit too, which only authorised roles can read.
  await recordStaffAudit(db, { tenantId: options.tenantId, staffId: options.staffId, recordType: 'report', recordId: id, action: 'report_filed', actor: options.actor, after: { category } })
  return id
}

export async function listReports(db: D1Database, tenantId: string, staffId: string, options: { asSubject: boolean, revealReporter: boolean }) {
  await ensureStaffFileTables(db)
  const rows = await db.prepare(`SELECT * FROM staff_reports WHERE tenant_id = ? AND lower(staff_id) = lower(?) ORDER BY created_at DESC`).bind(tenantId, staffId).all()
  return ((rows.results || []) as Record<string, any>[])
    .filter(row => !options.asSubject || REPORT_VISIBLE_TO_STAFF.has(String(row.status)))
    .map(row => mapReport(row, { revealReporter: options.revealReporter }))
}

export async function getReport(db: D1Database, tenantId: string, id: string) {
  await ensureStaffFileTables(db)
  return await db.prepare(`SELECT * FROM staff_reports WHERE tenant_id = ? AND id = ?`).bind(tenantId, id).first() as Record<string, any> | null
}

export async function updateReportStatus(db: D1Database, options: { tenantId: string, reportId: string, input: Record<string, any>, actor: Actor }) {
  const row = await getReport(db, options.tenantId, options.reportId)
  if (!row) throw new StaffFileError('Report not found.', 404)
  const status = String(options.input.status || '')
  if (!REPORT_STATUSES.includes(status as any)) throw new StaffFileError('Choose a status.')
  // A finding against someone needs their side first.
  if (['substantiated', 'action_taken'].includes(status) && !row.staff_responded_at && !options.input.overrideNoResponse) {
    throw new StaffFileError('Ask the staff member for their response before recording an adverse finding.', 409)
  }
  await db.prepare(`UPDATE staff_reports SET status = ?, management_response = COALESCE(?, management_response), outcome = COALESCE(?, outcome), updated_at = ? WHERE id = ?`)
    .bind(status, text(options.input.managementResponse, 4000) || null, text(options.input.outcome, 2000) || null, now(), row.id).run()
  await recordStaffAudit(db, { tenantId: options.tenantId, staffId: row.staff_id, recordType: 'report', recordId: row.id, action: 'report_status', actor: options.actor, before: { status: row.status }, after: { status }, reason: text(options.input.managementResponse, 200) })
}

export async function respondToReport(db: D1Database, options: { tenantId: string, reportId: string, response: unknown, actor: Actor }) {
  const row = await getReport(db, options.tenantId, options.reportId)
  if (!row || String(row.staff_id).toLowerCase() !== options.actor.id.toLowerCase() || !REPORT_VISIBLE_TO_STAFF.has(String(row.status))) throw new StaffFileError('Report not found.', 404)
  const response = text(options.response, 8000)
  if (!response) throw new StaffFileError('Write your response.')
  if (['closed'].includes(String(row.status))) throw new StaffFileError('This report is closed.', 409)
  await db.prepare(`UPDATE staff_reports SET staff_response = ?, staff_responded_at = ?, updated_at = ? WHERE id = ?`).bind(response, now(), now(), row.id).run()
  await recordStaffAudit(db, { tenantId: options.tenantId, staffId: row.staff_id, recordType: 'report', recordId: row.id, action: 'report_response', actor: options.actor })
}

// ─── Rewards ─────────────────────────────────────────────────────────────────

function mapReward(row: Record<string, any>) {
  return {
    id: String(row.id), staffId: row.staff_id, type: row.type, title: row.title, reason: row.reason || '', periodLabel: row.period_label || '',
    badge: row.badge || '🏆', certificate: Boolean(row.certificate), awardedOn: row.awarded_on, awardedByName: row.awarded_by_name || '', createdAt: row.created_at,
  }
}
export type Reward = ReturnType<typeof mapReward>

export async function addReward(db: D1Database, options: { tenantId: string, staffId: string, input: Record<string, any>, actor: Actor }) {
  await ensureStaffFileTables(db)
  const type = REWARD_TYPES.includes(options.input.type) ? options.input.type : 'custom'
  const title = text(options.input.title, 160)
  if (!title) throw new StaffFileError('Name the award, for example "Outstanding Teacher Award".')
  const awardedOn = isDate(options.input.awardedOn) ? options.input.awardedOn : new Date().toISOString().slice(0, 10)
  const id = `reward-${crypto.randomUUID()}`
  await db.prepare(`INSERT INTO staff_rewards (id, tenant_id, staff_id, type, title, reason, period_label, badge, certificate, awarded_on, awarded_by, awarded_by_name, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(id, options.tenantId, options.staffId, type, title, text(options.input.reason, 1000) || null, text(options.input.periodLabel, 120) || null,
    text(options.input.badge, 8) || '🏆', options.input.certificate === false ? 0 : 1, awardedOn, options.actor.id, options.actor.name, now()).run()
  await recordStaffAudit(db, { tenantId: options.tenantId, staffId: options.staffId, recordType: 'reward', recordId: id, action: 'reward_given', actor: options.actor, after: { title } })
  return id
}

export async function listRewards(db: D1Database, tenantId: string, staffId: string) {
  await ensureStaffFileTables(db)
  const rows = await db.prepare(`SELECT * FROM staff_rewards WHERE tenant_id = ? AND lower(staff_id) = lower(?) ORDER BY awarded_on DESC, created_at DESC`).bind(tenantId, staffId).all()
  return ((rows.results || []) as Record<string, any>[]).map(mapReward)
}

export async function getReward(db: D1Database, tenantId: string, id: string) {
  await ensureStaffFileTables(db)
  const row = await db.prepare(`SELECT * FROM staff_rewards WHERE tenant_id = ? AND id = ?`).bind(tenantId, id).first() as Record<string, any> | null
  return row ? mapReward(row) : null
}

// ─── The chronological file ──────────────────────────────────────────────────

const TIMELINE_LABELS: Record<string, (entry: Record<string, any>) => string> = {
  record_added: entry => `${RECORD_LABELS[entry.after?.category as RecordCategory] || 'Record'} added: ${entry.after?.title || ''}`,
  record_revised: entry => `Record updated: ${entry.after?.title || ''}`,
  loan_applied: entry => `Loan ${entry.after?.number || ''} applied for`,
  loan_recorded: entry => `Existing loan ${entry.after?.number || ''} recorded`,
  loan_approved: () => 'Loan approved', loan_declined: () => 'Loan declined', loan_active: () => 'Loan disbursed and active', loan_cleared: () => 'Loan cleared — 100% paid',
  repayment_confirmed: entry => `Loan repayment of ₦${Number(entry.after?.amount || 0).toLocaleString('en-NG')} confirmed`,
  repayment_recorded: entry => `Loan repayment of ₦${Number(entry.after?.amount || 0).toLocaleString('en-NG')} recorded`,
  repayment_reported: entry => `Loan repayment of ₦${Number(entry.after?.amount || 0).toLocaleString('en-NG')} reported — awaiting confirmation`,
  loan_waiver: () => 'Part of a loan waived', loan_adjustment: () => 'Loan balance adjusted',
  task_assigned: entry => `Task assigned: ${entry.after?.title || ''}`, task_submitted: () => 'Task submitted as done',
  task_evaluated: entry => `Task completed: ${entry.after?.rating || ''}`,
  review_recorded: entry => `Performance review: ${entry.after?.periodLabel || ''} — ${entry.after?.overall ?? ''}%`,
  reward_given: entry => `Award: ${entry.after?.title || ''}`,
}

/** What appears in the staff member's timeline: their own file's events, minus investigation detail they may not see. */
export function timelineFrom(audit: Awaited<ReturnType<typeof listStaffAudit>>, permissions: StaffFilePermissions) {
  return audit
    .filter(entry => TIMELINE_LABELS[entry.action])
    .filter(entry => entry.recordType !== 'record' || canSeeRecord({ category: entry.after?.category || 'note', visibility: entry.after?.visibility || 'staff' }, permissions))
    .filter(entry => entry.recordType !== 'loan' || permissions.loans)
    .map(entry => ({ at: entry.createdAt, text: TIMELINE_LABELS[entry.action](entry), type: entry.recordType, by: entry.actorName }))
}
