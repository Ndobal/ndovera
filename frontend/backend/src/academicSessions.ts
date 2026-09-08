// Academic sessions, terms, breaks, session-scoped enrollment, promotion and the
// per-term fee cycle.
//
// The rules this module exists to enforce:
//   * exactly one active session per tenant, and one active term inside it,
//     guarded by partial unique indexes rather than by application logic alone;
//   * a student's class placement belongs to a session, so promoting a student
//     writes a new enrollment row and never edits last session's record;
//   * every term opens its own fee assessment, and whatever is left unpaid at the
//     end of a term stays attached to that term's assessment while still counting
//     towards what the student currently owes.
//
// Dates are school calendar dates (YYYY-MM-DD) read in Africa/Lagos, which is
// UTC+1 all year, so a term configured to start on the 7th flips on the 7th in
// Nigeria rather than at 01:00 local time.

const LAGOS_UTC_OFFSET_MINUTES = 60

// Isolate-scoped, deliberately not keyed on the database instance: the Workers
// runtime builds a fresh `env` — and therefore a fresh binding object — for every
// request, so a WeakSet keyed on `db` would miss every time and re-run the whole
// schema on each request. Tests call resetAcademicTablesCache between databases.
let _tablesInitialized = false

export function resetAcademicTablesCache() {
  _tablesInitialized = false
}

export const SESSION_STATUSES = ['upcoming', 'active', 'completed', 'archived']
export const TERM_STATUSES = ['upcoming', 'active', 'completed']
export const ENROLLMENT_STATUSES = ['active', 'promoted', 'repeated', 'graduated', 'withdrawn', 'transferred']
export const PROMOTION_ACTIONS = ['promote', 'repeat', 'graduate', 'withdraw', 'transfer']
export const BREAK_TYPES = ['mid_term', 'christmas', 'easter', 'long_vacation', 'public_holiday', 'custom']
export const ASSESSMENT_STATUSES = ['unpaid', 'partial', 'paid', 'waived']

// Placements this module made on its own when a session opened. They are
// defaults, so a promotion round the school actually runs may overwrite them;
// every other source records a decision someone took, and is never overwritten.
export const AUTO_ENROLLED_SOURCES = ['carryover', 'auto-promotion']

export const DEFAULT_TERM_NAMES = ['First Term', 'Second Term', 'Third Term']

// Session management is a leadership action. Teachers read history; they do not
// activate sessions or move students.
export const SESSION_ADMIN_ROLES = ['owner', 'hos', 'ict', 'admin']
export const PROMOTION_ADMIN_ROLES = ['owner', 'hos', 'ict', 'admin']
export const FEE_ADMIN_ROLES = ['owner', 'hos', 'accountant']

const ACADEMIC_SESSIONS_DDL = `CREATE TABLE IF NOT EXISTS academic_sessions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'upcoming',
  resumption_date TEXT,
  auto_activate INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  activated_at TEXT,
  completed_at TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL,
  updated_by TEXT,
  updated_at TEXT NOT NULL,
  UNIQUE(tenant_id, name)
)`

const ACADEMIC_TERMS_DDL = `CREATE TABLE IF NOT EXISTS academic_terms (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  name TEXT NOT NULL,
  sequence INTEGER NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  resumption_date TEXT,
  status TEXT NOT NULL DEFAULT 'upcoming',
  auto_activate INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  activated_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(tenant_id, session_id, sequence),
  UNIQUE(tenant_id, session_id, name)
)`

const ACADEMIC_BREAKS_DDL = `CREATE TABLE IF NOT EXISTS academic_breaks (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  term_id TEXT,
  name TEXT NOT NULL,
  break_type TEXT NOT NULL DEFAULT 'custom',
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  resumption_date TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`

// One placement per student per session. Promotion inserts here; it never
// rewrites the previous session's row.
const SESSION_ENROLLMENTS_DDL = `CREATE TABLE IF NOT EXISTS session_enrollments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  session_name TEXT NOT NULL,
  student_id TEXT NOT NULL,
  student_name TEXT,
  student_display_id TEXT,
  class_id TEXT,
  class_name TEXT,
  class_arm TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  source TEXT NOT NULL DEFAULT 'manual',
  promotion_batch_id TEXT,
  enrolled_by TEXT,
  enrolled_by_name TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(tenant_id, session_id, student_id)
)`

const PROMOTION_BATCHES_DDL = `CREATE TABLE IF NOT EXISTS promotion_batches (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  from_session_id TEXT,
  from_session_name TEXT,
  to_session_id TEXT NOT NULL,
  to_session_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  notes TEXT,
  created_by TEXT,
  created_by_name TEXT,
  created_at TEXT NOT NULL,
  committed_by TEXT,
  committed_by_name TEXT,
  committed_at TEXT,
  updated_at TEXT NOT NULL
)`

const PROMOTION_DECISIONS_DDL = `CREATE TABLE IF NOT EXISTS promotion_decisions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  batch_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  student_name TEXT,
  student_display_id TEXT,
  from_class_id TEXT,
  from_class_name TEXT,
  to_class_id TEXT,
  to_class_name TEXT,
  action TEXT NOT NULL DEFAULT 'promote',
  source TEXT NOT NULL DEFAULT 'auto',
  status TEXT NOT NULL DEFAULT 'pending',
  decided_by TEXT,
  decided_by_name TEXT,
  decided_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(tenant_id, batch_id, student_id)
)`

const PROMOTION_AUDIT_DDL = `CREATE TABLE IF NOT EXISTS promotion_audit (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  batch_id TEXT,
  student_id TEXT NOT NULL,
  student_name TEXT,
  from_session_id TEXT,
  from_session_name TEXT,
  from_class_id TEXT,
  from_class_name TEXT,
  to_session_id TEXT,
  to_session_name TEXT,
  to_class_id TEXT,
  to_class_name TEXT,
  action TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'manual',
  performed_by TEXT,
  performed_by_name TEXT,
  performed_at TEXT NOT NULL
)`

// One assessment per student per term. The 'opening_balance' kind carries
// pre-migration arrears so the old running ledger never has to be reinterpreted.
const FEE_ASSESSMENTS_DDL = `CREATE TABLE IF NOT EXISTS fee_assessments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  session_name TEXT NOT NULL,
  term_id TEXT NOT NULL,
  term_name TEXT NOT NULL,
  student_id TEXT NOT NULL,
  student_name TEXT,
  student_display_id TEXT,
  class_id TEXT,
  class_name TEXT,
  assessment_kind TEXT NOT NULL DEFAULT 'term',
  gross_amount REAL NOT NULL DEFAULT 0,
  discount_amount REAL NOT NULL DEFAULT 0,
  net_amount REAL NOT NULL DEFAULT 0,
  amount_paid REAL NOT NULL DEFAULT 0,
  outstanding REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'unpaid',
  notes TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(tenant_id, term_id, student_id, assessment_kind)
)`

const FEE_ASSESSMENT_LINES_DDL = `CREATE TABLE IF NOT EXISTS fee_assessment_lines (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  assessment_id TEXT NOT NULL,
  fee_type TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'class',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  UNIQUE(tenant_id, assessment_id, fee_type)
)`

// The money actually handed over. Never edited, never deleted.
const FEE_PAYMENTS_DDL = `CREATE TABLE IF NOT EXISTS fee_payments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  student_name TEXT,
  amount REAL NOT NULL,
  payment_type TEXT NOT NULL DEFAULT 'cash',
  payment_reference TEXT,
  idempotency_key TEXT,
  note TEXT,
  claim_id TEXT,
  receipt_id TEXT,
  receipt_no TEXT,
  recorded_by TEXT,
  recorded_by_name TEXT,
  recorded_at TEXT NOT NULL,
  created_at TEXT NOT NULL
)`

// Where each payment landed. A payment's allocations sum to the payment amount.
const FEE_PAYMENT_ALLOCATIONS_DDL = `CREATE TABLE IF NOT EXISTS fee_payment_allocations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  payment_id TEXT NOT NULL,
  assessment_id TEXT NOT NULL,
  session_name TEXT,
  term_name TEXT,
  amount REAL NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(tenant_id, payment_id, assessment_id)
)`

const ACADEMIC_INDEX_STATEMENTS = [
  // The one-active guarantees, held by the database rather than by callers.
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_academic_sessions_one_active ON academic_sessions(tenant_id) WHERE status = 'active'`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_academic_terms_one_active ON academic_terms(tenant_id) WHERE status = 'active'`,
  // A payment reference, when the school supplies one, identifies one transaction.
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_fee_payments_idempotency ON fee_payments(tenant_id, idempotency_key) WHERE idempotency_key IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS idx_academic_sessions_tenant ON academic_sessions(tenant_id, start_date)`,
  `CREATE INDEX IF NOT EXISTS idx_academic_terms_session ON academic_terms(tenant_id, session_id, sequence)`,
  `CREATE INDEX IF NOT EXISTS idx_academic_breaks_session ON academic_breaks(tenant_id, session_id, start_date)`,
  `CREATE INDEX IF NOT EXISTS idx_session_enrollments_session ON session_enrollments(tenant_id, session_id, class_id)`,
  `CREATE INDEX IF NOT EXISTS idx_session_enrollments_student ON session_enrollments(tenant_id, student_id)`,
  `CREATE INDEX IF NOT EXISTS idx_promotion_decisions_batch ON promotion_decisions(tenant_id, batch_id)`,
  `CREATE INDEX IF NOT EXISTS idx_promotion_audit_student ON promotion_audit(tenant_id, student_id, performed_at)`,
  `CREATE INDEX IF NOT EXISTS idx_fee_assessments_student ON fee_assessments(tenant_id, student_id, session_name, term_name)`,
  `CREATE INDEX IF NOT EXISTS idx_fee_assessments_term ON fee_assessments(tenant_id, term_id, class_id)`,
  `CREATE INDEX IF NOT EXISTS idx_fee_assessments_outstanding ON fee_assessments(tenant_id, student_id, outstanding)`,
  `CREATE INDEX IF NOT EXISTS idx_fee_assessment_lines_assessment ON fee_assessment_lines(tenant_id, assessment_id)`,
  `CREATE INDEX IF NOT EXISTS idx_fee_payments_student ON fee_payments(tenant_id, student_id, recorded_at)`,
  `CREATE INDEX IF NOT EXISTS idx_fee_payment_allocations_assessment ON fee_payment_allocations(tenant_id, assessment_id)`,
]

export async function ensureAcademicTables(db: D1Database) {
  if (_tablesInitialized) return

  for (const ddl of [
    ACADEMIC_SESSIONS_DDL,
    ACADEMIC_TERMS_DDL,
    ACADEMIC_BREAKS_DDL,
    SESSION_ENROLLMENTS_DDL,
    PROMOTION_BATCHES_DDL,
    PROMOTION_DECISIONS_DDL,
    PROMOTION_AUDIT_DDL,
    FEE_ASSESSMENTS_DDL,
    FEE_ASSESSMENT_LINES_DDL,
    FEE_PAYMENTS_DDL,
    FEE_PAYMENT_ALLOCATIONS_DDL,
  ]) {
    await db.prepare(ddl).run()
  }

  for (const statement of ACADEMIC_INDEX_STATEMENTS) {
    // Guarded so one index that a legacy row set cannot satisfy does not leave the
    // rest of the schema uninitialised.
    try { await db.prepare(statement).run() } catch {}
  }

  _tablesInitialized = true
}

// ─── Small shared helpers ────────────────────────────────────────────────────

export class AcademicError extends Error {
  status: number

  constructor(message: string, status = 400) {
    super(message)
    this.name = 'AcademicError'
    this.status = status
  }
}

function normalizeKeyPart(value: unknown) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'na'
}

function sanitizeText(value: unknown, maxLength = 500) {
  return String(value === null || value === undefined ? '' : value).trim().slice(0, maxLength)
}

function toMoney(value: unknown) {
  const numeric = Number(value || 0)
  if (!Number.isFinite(numeric)) return 0
  // Kobo precision; keeps repeated add/subtract from drifting.
  return Math.round(numeric * 100) / 100
}

function nowIso() {
  return new Date().toISOString()
}

/** Today's calendar date in Africa/Lagos (UTC+1, no DST). */
export function lagosToday(reference: Date = new Date()) {
  const shifted = new Date(reference.getTime() + LAGOS_UTC_OFFSET_MINUTES * 60 * 1000)
  return shifted.toISOString().slice(0, 10)
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function normalizeDate(value: unknown, label: string, { required = true } = {}) {
  const raw = String(value || '').trim().slice(0, 10)
  if (!raw) {
    if (required) throw new AcademicError(`${label} is required.`)
    return ''
  }
  if (!DATE_PATTERN.test(raw)) {
    throw new AcademicError(`${label} must be a date in YYYY-MM-DD form.`)
  }
  const parsed = new Date(`${raw}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== raw) {
    throw new AcademicError(`${label} is not a real calendar date.`)
  }
  return raw
}

function normalizeStatus(value: unknown, allowed: string[], fallback: string) {
  const normalized = String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_')
  return allowed.includes(normalized) ? normalized : fallback
}

function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return aStart <= bEnd && bStart <= aEnd
}

function boolToInt(value: unknown) {
  return value === true || value === 1 || value === '1' || value === 'true' ? 1 : 0
}

// ─── Row mappers ─────────────────────────────────────────────────────────────

export function mapSessionRow(row: Record<string, any>) {
  return {
    id: String(row.id || ''),
    name: String(row.name || ''),
    startDate: String(row.start_date || ''),
    endDate: String(row.end_date || ''),
    status: String(row.status || 'upcoming'),
    resumptionDate: String(row.resumption_date || ''),
    autoActivate: Number(row.auto_activate || 0) === 1,
    notes: String(row.notes || ''),
    activatedAt: String(row.activated_at || ''),
    completedAt: String(row.completed_at || ''),
    createdBy: String(row.created_by || ''),
    createdAt: String(row.created_at || ''),
    updatedAt: String(row.updated_at || ''),
  }
}

export function mapTermRow(row: Record<string, any>) {
  return {
    id: String(row.id || ''),
    sessionId: String(row.session_id || ''),
    name: String(row.name || ''),
    sequence: Number(row.sequence || 0),
    startDate: String(row.start_date || ''),
    endDate: String(row.end_date || ''),
    resumptionDate: String(row.resumption_date || ''),
    status: String(row.status || 'upcoming'),
    autoActivate: Number(row.auto_activate || 0) === 1,
    notes: String(row.notes || ''),
    activatedAt: String(row.activated_at || ''),
    completedAt: String(row.completed_at || ''),
    createdAt: String(row.created_at || ''),
    updatedAt: String(row.updated_at || ''),
  }
}

export function mapBreakRow(row: Record<string, any>) {
  return {
    id: String(row.id || ''),
    sessionId: String(row.session_id || ''),
    termId: String(row.term_id || ''),
    name: String(row.name || ''),
    breakType: String(row.break_type || 'custom'),
    startDate: String(row.start_date || ''),
    endDate: String(row.end_date || ''),
    resumptionDate: String(row.resumption_date || ''),
    notes: String(row.notes || ''),
    createdAt: String(row.created_at || ''),
    updatedAt: String(row.updated_at || ''),
  }
}

export function mapEnrollmentRow(row: Record<string, any>) {
  return {
    id: String(row.id || ''),
    sessionId: String(row.session_id || ''),
    sessionName: String(row.session_name || ''),
    studentId: String(row.student_id || ''),
    studentName: String(row.student_name || ''),
    studentDisplayId: String(row.student_display_id || ''),
    classId: String(row.class_id || ''),
    className: String(row.class_name || ''),
    classArm: String(row.class_arm || ''),
    status: String(row.status || 'active'),
    source: String(row.source || 'manual'),
    promotionBatchId: String(row.promotion_batch_id || ''),
    enrolledBy: String(row.enrolled_by || ''),
    enrolledByName: String(row.enrolled_by_name || ''),
    createdAt: String(row.created_at || ''),
    updatedAt: String(row.updated_at || ''),
  }
}

export function mapAssessmentRow(row: Record<string, any>) {
  return {
    id: String(row.id || ''),
    sessionId: String(row.session_id || ''),
    sessionName: String(row.session_name || ''),
    termId: String(row.term_id || ''),
    termName: String(row.term_name || ''),
    studentId: String(row.student_id || ''),
    studentName: String(row.student_name || ''),
    studentDisplayId: String(row.student_display_id || ''),
    classId: String(row.class_id || ''),
    className: String(row.class_name || ''),
    assessmentKind: String(row.assessment_kind || 'term'),
    grossAmount: toMoney(row.gross_amount),
    discountAmount: toMoney(row.discount_amount),
    netAmount: toMoney(row.net_amount),
    amountPaid: toMoney(row.amount_paid),
    outstanding: toMoney(row.outstanding),
    status: String(row.status || 'unpaid'),
    notes: String(row.notes || ''),
    createdAt: String(row.created_at || ''),
    updatedAt: String(row.updated_at || ''),
  }
}

export function mapPaymentRow(row: Record<string, any>) {
  return {
    id: String(row.id || ''),
    studentId: String(row.student_id || ''),
    studentName: String(row.student_name || ''),
    amount: toMoney(row.amount),
    paymentType: String(row.payment_type || 'cash'),
    paymentReference: String(row.payment_reference || ''),
    note: String(row.note || ''),
    claimId: String(row.claim_id || ''),
    receiptId: String(row.receipt_id || ''),
    receiptNo: String(row.receipt_no || ''),
    recordedBy: String(row.recorded_by || ''),
    recordedByName: String(row.recorded_by_name || ''),
    recordedAt: String(row.recorded_at || ''),
  }
}

export function mapAllocationRow(row: Record<string, any>) {
  return {
    id: String(row.id || ''),
    paymentId: String(row.payment_id || ''),
    assessmentId: String(row.assessment_id || ''),
    sessionName: String(row.session_name || ''),
    termName: String(row.term_name || ''),
    amount: toMoney(row.amount),
    createdAt: String(row.created_at || ''),
  }
}

export function mapPromotionDecisionRow(row: Record<string, any>) {
  return {
    id: String(row.id || ''),
    batchId: String(row.batch_id || ''),
    studentId: String(row.student_id || ''),
    studentName: String(row.student_name || ''),
    studentDisplayId: String(row.student_display_id || ''),
    fromClassId: String(row.from_class_id || ''),
    fromClassName: String(row.from_class_name || ''),
    toClassId: String(row.to_class_id || ''),
    toClassName: String(row.to_class_name || ''),
    action: String(row.action || 'promote'),
    source: String(row.source || 'auto'),
    status: String(row.status || 'pending'),
    decidedBy: String(row.decided_by || ''),
    decidedByName: String(row.decided_by_name || ''),
    decidedAt: String(row.decided_at || ''),
  }
}

export function mapPromotionBatchRow(row: Record<string, any>) {
  return {
    id: String(row.id || ''),
    fromSessionId: String(row.from_session_id || ''),
    fromSessionName: String(row.from_session_name || ''),
    toSessionId: String(row.to_session_id || ''),
    toSessionName: String(row.to_session_name || ''),
    status: String(row.status || 'draft'),
    notes: String(row.notes || ''),
    createdBy: String(row.created_by || ''),
    createdByName: String(row.created_by_name || ''),
    createdAt: String(row.created_at || ''),
    committedBy: String(row.committed_by || ''),
    committedByName: String(row.committed_by_name || ''),
    committedAt: String(row.committed_at || ''),
  }
}

export function mapPromotionAuditRow(row: Record<string, any>) {
  return {
    id: String(row.id || ''),
    batchId: String(row.batch_id || ''),
    studentId: String(row.student_id || ''),
    studentName: String(row.student_name || ''),
    fromSessionName: String(row.from_session_name || ''),
    fromClassName: String(row.from_class_name || ''),
    toSessionName: String(row.to_session_name || ''),
    toClassName: String(row.to_class_name || ''),
    action: String(row.action || ''),
    mode: String(row.mode || 'manual'),
    performedBy: String(row.performed_by || ''),
    performedByName: String(row.performed_by_name || ''),
    performedAt: String(row.performed_at || ''),
  }
}

// ─── Session reads ───────────────────────────────────────────────────────────

export async function listSessions(db: D1Database, tenantId: string) {
  await ensureAcademicTables(db)
  const rows = await db.prepare(
    `SELECT * FROM academic_sessions WHERE tenant_id = ? ORDER BY start_date DESC, created_at DESC`
  ).bind(tenantId).all()
  return ((rows.results || []) as Record<string, any>[]).map(mapSessionRow)
}

export async function getSessionById(db: D1Database, tenantId: string, sessionId: string) {
  await ensureAcademicTables(db)
  const row = await db.prepare(
    `SELECT * FROM academic_sessions WHERE tenant_id = ? AND id = ?`
  ).bind(tenantId, sessionId).first() as Record<string, any> | null
  return row ? mapSessionRow(row) : null
}

export async function getActiveSession(db: D1Database, tenantId: string) {
  await ensureAcademicTables(db)
  const row = await db.prepare(
    `SELECT * FROM academic_sessions WHERE tenant_id = ? AND status = 'active' LIMIT 1`
  ).bind(tenantId).first() as Record<string, any> | null
  return row ? mapSessionRow(row) : null
}

export async function listTerms(db: D1Database, tenantId: string, sessionId: string) {
  await ensureAcademicTables(db)
  const rows = await db.prepare(
    `SELECT * FROM academic_terms WHERE tenant_id = ? AND session_id = ? ORDER BY sequence ASC`
  ).bind(tenantId, sessionId).all()
  return ((rows.results || []) as Record<string, any>[]).map(mapTermRow)
}

export async function getTermById(db: D1Database, tenantId: string, termId: string) {
  await ensureAcademicTables(db)
  const row = await db.prepare(
    `SELECT * FROM academic_terms WHERE tenant_id = ? AND id = ?`
  ).bind(tenantId, termId).first() as Record<string, any> | null
  return row ? mapTermRow(row) : null
}

export async function getActiveTerm(db: D1Database, tenantId: string) {
  await ensureAcademicTables(db)
  const row = await db.prepare(
    `SELECT * FROM academic_terms WHERE tenant_id = ? AND status = 'active' LIMIT 1`
  ).bind(tenantId).first() as Record<string, any> | null
  return row ? mapTermRow(row) : null
}

export async function listBreaks(db: D1Database, tenantId: string, sessionId: string) {
  await ensureAcademicTables(db)
  const rows = await db.prepare(
    `SELECT * FROM academic_breaks WHERE tenant_id = ? AND session_id = ? ORDER BY start_date ASC`
  ).bind(tenantId, sessionId).all()
  return ((rows.results || []) as Record<string, any>[]).map(mapBreakRow)
}

/**
 * The active session and term, plus everything a caller needs to stamp a record
 * with the right period. Falls back to the legacy school_sessions breadcrumb so
 * surfaces keep working for a tenant that has not set up a session yet.
 */
export async function getCurrentAcademicPeriod(db: D1Database, tenantId: string) {
  // Deliberately does NOT create the schema. This runs on hot read paths — the
  // dashboard header polls it through the fee notification builders — and paying
  // for 27 DDL statements on every cold isolate there exceeded the CPU limit,
  // taking the whole endpoint down. Reads tolerate the tables being absent and
  // fall back; the write paths still call ensureAcademicTables.
  const sessionRow = await db.prepare(
    `SELECT * FROM academic_sessions WHERE tenant_id = ? AND status = 'active' LIMIT 1`
  ).bind(tenantId).first().catch(() => null) as Record<string, any> | null

  const session = sessionRow ? mapSessionRow(sessionRow) : null

  const termRow = session
    ? await db.prepare(
        `SELECT * FROM academic_terms WHERE tenant_id = ? AND status = 'active' LIMIT 1`
      ).bind(tenantId).first().catch(() => null) as Record<string, any> | null
    : null

  const term = termRow ? mapTermRow(termRow) : null

  if (session) {
    return {
      configured: true,
      sessionId: session.id,
      sessionName: session.name,
      termId: term?.id || '',
      termName: term?.name || '',
      session,
      term,
    }
  }

  const legacy = await db.prepare(
    `SELECT session, term FROM school_sessions WHERE tenantId = ? ORDER BY createdAt DESC LIMIT 1`
  ).bind(tenantId).first().catch(() => null) as Record<string, any> | null

  return {
    configured: false,
    sessionId: '',
    sessionName: String(legacy?.session || '').trim(),
    termId: '',
    termName: String(legacy?.term || '').trim(),
    session: null,
    term: null,
  }
}

/** Full session view: the session, its terms, and its breaks. */
export async function getSessionDetail(db: D1Database, tenantId: string, sessionId: string) {
  const session = await getSessionById(db, tenantId, sessionId)
  if (!session) return null

  const [terms, breaks] = await Promise.all([
    listTerms(db, tenantId, sessionId),
    listBreaks(db, tenantId, sessionId),
  ])

  return { session, terms, breaks }
}

// ─── Session writes ──────────────────────────────────────────────────────────

function buildSessionId(tenantId: string, name: string) {
  return `acadsess_${normalizeKeyPart(tenantId)}_${normalizeKeyPart(name).slice(0, 24)}`
}

function buildTermId(sessionId: string, sequence: number) {
  return `acadterm_${normalizeKeyPart(sessionId)}_${sequence}`
}

export async function createSession(db: D1Database, options: {
  tenantId: string
  name: unknown
  startDate: unknown
  endDate: unknown
  resumptionDate?: unknown
  autoActivate?: unknown
  notes?: unknown
  actorId?: string
  terms?: Array<Record<string, any>>
}) {
  await ensureAcademicTables(db)

  const name = sanitizeText(options.name, 60)
  if (!name) throw new AcademicError('Session name is required.')

  const startDate = normalizeDate(options.startDate, 'Session start date')
  const endDate = normalizeDate(options.endDate, 'Session end date')
  if (endDate <= startDate) {
    throw new AcademicError('The session end date must fall after its start date.')
  }
  const resumptionDate = normalizeDate(options.resumptionDate, 'Resumption date', { required: false })

  const existing = await db.prepare(
    `SELECT id FROM academic_sessions WHERE tenant_id = ? AND LOWER(name) = LOWER(?)`
  ).bind(options.tenantId, name).first() as Record<string, any> | null
  if (existing) {
    throw new AcademicError(`A session named "${name}" already exists.`, 409)
  }

  const overlapping = await db.prepare(
    `SELECT name FROM academic_sessions
     WHERE tenant_id = ? AND status != 'archived' AND start_date <= ? AND end_date >= ?
     LIMIT 1`
  ).bind(options.tenantId, endDate, startDate).first() as Record<string, any> | null
  if (overlapping) {
    throw new AcademicError(`These dates overlap the ${String(overlapping.name)} session.`, 409)
  }

  const timestamp = nowIso()
  const id = buildSessionId(options.tenantId, name)

  const statements = [
    db.prepare(
      `INSERT INTO academic_sessions (id, tenant_id, name, start_date, end_date, status, resumption_date, auto_activate, notes, created_by, created_at, updated_by, updated_at)
       VALUES (?, ?, ?, ?, ?, 'upcoming', ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id,
      options.tenantId,
      name,
      startDate,
      endDate,
      resumptionDate || null,
      boolToInt(options.autoActivate),
      sanitizeText(options.notes, 2000) || null,
      options.actorId || null,
      timestamp,
      options.actorId || null,
      timestamp,
    ),
  ]

  // Terms are optional at creation; a session with none can have them added later.
  const termInputs = Array.isArray(options.terms) ? options.terms : []
  const normalizedTerms = normalizeTermInputs(termInputs, { sessionStart: startDate, sessionEnd: endDate })
  for (const term of normalizedTerms) {
    statements.push(buildTermInsert(db, { tenantId: options.tenantId, sessionId: id, term, timestamp }))
  }

  await db.batch(statements)

  // The school that already exists rolls straight into the new session, with
  // every returning student moved up a class, so the register is never empty and
  // the owner is left with fees and payments rather than re-enrolling everyone.
  // Best effort: a roster that cannot be read must not cost the school its
  // session — activation fills the register again anyway.
  const enrolment = await autoEnrolSession(db, {
    tenantId: options.tenantId,
    sessionId: id,
    actorId: options.actorId,
    ensureTables: false,
  }).catch(() => null)

  return { ...(await getSessionDetail(db, options.tenantId, id))!, enrolment }
}

function normalizeTermInputs(rawTerms: Array<Record<string, any>>, bounds: { sessionStart: string, sessionEnd: string }) {
  const normalized = rawTerms.map((term, index) => {
    const sequence = Number(term?.sequence ?? index + 1)
    if (!Number.isInteger(sequence) || sequence < 1 || sequence > 12) {
      throw new AcademicError('Term sequence must be a whole number between 1 and 12.')
    }
    const name = sanitizeText(term?.name, 60) || DEFAULT_TERM_NAMES[sequence - 1] || `Term ${sequence}`
    const startDate = normalizeDate(term?.startDate, `${name} start date`)
    const endDate = normalizeDate(term?.endDate, `${name} end date`)
    // Quote the dates back: the usual cause is a mistyped year, which is invisible
    // in a message that only says the dates are the wrong way round.
    if (endDate <= startDate) {
      throw new AcademicError(
        `${name} ends on ${endDate} but starts on ${startDate}. Set the end date after the start date.`
      )
    }
    if (startDate < bounds.sessionStart || endDate > bounds.sessionEnd) {
      throw new AcademicError(
        `${name} runs ${startDate} to ${endDate}, which falls outside the session (${bounds.sessionStart} to ${bounds.sessionEnd}).`
      )
    }
    return {
      sequence,
      name,
      startDate,
      endDate,
      resumptionDate: normalizeDate(term?.resumptionDate, `${name} resumption date`, { required: false }),
      autoActivate: boolToInt(term?.autoActivate),
      notes: sanitizeText(term?.notes, 2000),
    }
  }).sort((left, right) => left.sequence - right.sequence)

  for (let index = 1; index < normalized.length; index += 1) {
    const previous = normalized[index - 1]
    const current = normalized[index]
    if (previous.sequence === current.sequence) {
      throw new AcademicError(`Two terms share sequence ${current.sequence}.`)
    }
    if (previous.name.toLowerCase() === current.name.toLowerCase()) {
      throw new AcademicError(`Two terms share the name ${current.name}.`)
    }
    if (rangesOverlap(previous.startDate, previous.endDate, current.startDate, current.endDate)) {
      throw new AcademicError(
        `${previous.name} (${previous.startDate} to ${previous.endDate}) overlaps ${current.name} (${current.startDate} to ${current.endDate}).`
      )
    }
  }

  return normalized
}

function buildTermInsert(db: D1Database, options: {
  tenantId: string
  sessionId: string
  term: ReturnType<typeof normalizeTermInputs>[number]
  timestamp: string
}) {
  return db.prepare(
    `INSERT INTO academic_terms (id, tenant_id, session_id, name, sequence, start_date, end_date, resumption_date, status, auto_activate, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'upcoming', ?, ?, ?, ?)`
  ).bind(
    buildTermId(options.sessionId, options.term.sequence),
    options.tenantId,
    options.sessionId,
    options.term.name,
    options.term.sequence,
    options.term.startDate,
    options.term.endDate,
    options.term.resumptionDate || null,
    options.term.autoActivate,
    options.term.notes || null,
    options.timestamp,
    options.timestamp,
  )
}

export async function updateSession(db: D1Database, options: {
  tenantId: string
  sessionId: string
  name?: unknown
  startDate?: unknown
  endDate?: unknown
  resumptionDate?: unknown
  autoActivate?: unknown
  notes?: unknown
  actorId?: string
}) {
  await ensureAcademicTables(db)

  const current = await getSessionById(db, options.tenantId, options.sessionId)
  if (!current) throw new AcademicError('Session not found.', 404)
  if (current.status === 'archived') {
    throw new AcademicError('Restore this session before editing it.')
  }

  const name = options.name === undefined ? current.name : sanitizeText(options.name, 60)
  if (!name) throw new AcademicError('Session name is required.')

  const startDate = options.startDate === undefined ? current.startDate : normalizeDate(options.startDate, 'Session start date')
  const endDate = options.endDate === undefined ? current.endDate : normalizeDate(options.endDate, 'Session end date')
  if (endDate <= startDate) {
    throw new AcademicError('The session end date must fall after its start date.')
  }
  const resumptionDate = options.resumptionDate === undefined
    ? current.resumptionDate
    : normalizeDate(options.resumptionDate, 'Resumption date', { required: false })

  if (name.toLowerCase() !== current.name.toLowerCase()) {
    const clash = await db.prepare(
      `SELECT id FROM academic_sessions WHERE tenant_id = ? AND LOWER(name) = LOWER(?) AND id != ?`
    ).bind(options.tenantId, name, options.sessionId).first()
    if (clash) throw new AcademicError(`A session named "${name}" already exists.`, 409)
  }

  const overlapping = await db.prepare(
    `SELECT name FROM academic_sessions
     WHERE tenant_id = ? AND id != ? AND status != 'archived' AND start_date <= ? AND end_date >= ?
     LIMIT 1`
  ).bind(options.tenantId, options.sessionId, endDate, startDate).first() as Record<string, any> | null
  if (overlapping) {
    throw new AcademicError(`These dates overlap the ${String(overlapping.name)} session.`, 409)
  }

  // Narrowing a session must not orphan a term outside its bounds.
  const terms = await listTerms(db, options.tenantId, options.sessionId)
  const stray = terms.find(term => term.startDate < startDate || term.endDate > endDate)
  if (stray) {
    throw new AcademicError(`${stray.name} (${stray.startDate} to ${stray.endDate}) would fall outside the new session dates.`)
  }

  const timestamp = nowIso()
  await db.prepare(
    `UPDATE academic_sessions
     SET name = ?, start_date = ?, end_date = ?, resumption_date = ?, auto_activate = ?, notes = ?, updated_by = ?, updated_at = ?
     WHERE tenant_id = ? AND id = ?`
  ).bind(
    name,
    startDate,
    endDate,
    resumptionDate || null,
    options.autoActivate === undefined ? boolToInt(current.autoActivate) : boolToInt(options.autoActivate),
    options.notes === undefined ? (current.notes || null) : (sanitizeText(options.notes, 2000) || null),
    options.actorId || null,
    timestamp,
    options.tenantId,
    options.sessionId,
  ).run()

  // The session name is denormalised onto enrollments for cheap history reads.
  if (name !== current.name) {
    await db.prepare(
      `UPDATE session_enrollments SET session_name = ?, updated_at = ? WHERE tenant_id = ? AND session_id = ?`
    ).bind(name, timestamp, options.tenantId, options.sessionId).run()
    await db.prepare(
      `UPDATE fee_assessments SET session_name = ?, updated_at = ? WHERE tenant_id = ? AND session_id = ?`
    ).bind(name, timestamp, options.tenantId, options.sessionId).run()
  }

  return (await getSessionDetail(db, options.tenantId, options.sessionId))!
}

export async function setSessionArchived(db: D1Database, options: {
  tenantId: string
  sessionId: string
  archived: boolean
  actorId?: string
}) {
  await ensureAcademicTables(db)
  const current = await getSessionById(db, options.tenantId, options.sessionId)
  if (!current) throw new AcademicError('Session not found.', 404)

  if (options.archived && current.status === 'active') {
    throw new AcademicError('Activate another session before archiving the current one.')
  }

  const nextStatus = options.archived ? 'archived' : (current.completedAt ? 'completed' : 'upcoming')
  await db.prepare(
    `UPDATE academic_sessions SET status = ?, updated_by = ?, updated_at = ? WHERE tenant_id = ? AND id = ?`
  ).bind(nextStatus, options.actorId || null, nowIso(), options.tenantId, options.sessionId).run()

  return (await getSessionById(db, options.tenantId, options.sessionId))!
}

/**
 * Make one session active and stand the previous one down, in a single batch so
 * the tenant is never briefly left with two active sessions or none.
 */
export async function activateSession(db: D1Database, options: {
  tenantId: string
  sessionId: string
  actorId?: string
  actorName?: string
  activateFirstTerm?: boolean
}) {
  await ensureAcademicTables(db)

  const target = await getSessionById(db, options.tenantId, options.sessionId)
  if (!target) throw new AcademicError('Session not found.', 404)
  if (target.status === 'archived') throw new AcademicError('Restore this session before activating it.')
  if (target.status === 'active') {
    return { session: target, deactivated: null, activatedTerm: await getActiveTerm(db, options.tenantId) }
  }

  // Opening a session on an empty register would empty the school. Anyone the
  // register is missing joins now, moved up a class per the progression flow;
  // anyone already on it — placed by hand, by a promotion round, or when the
  // session was created — is left exactly as they are.
  const enrolment = await autoEnrolSession(db, {
    tenantId: options.tenantId,
    sessionId: options.sessionId,
    actorId: options.actorId,
    actorName: options.actorName,
    ensureTables: false,
  }).catch(() => null)

  const previous = await getActiveSession(db, options.tenantId)
  const timestamp = nowIso()
  const statements: D1PreparedStatement[] = []

  if (previous) {
    statements.push(...await buildHandoverStatements(db, {
      tenantId: options.tenantId,
      fromSessionId: previous.id,
      toSessionId: options.sessionId,
      timestamp,
    }))

    // Close the outgoing session and its open term before the index sees two.
    statements.push(db.prepare(
      `UPDATE academic_terms SET status = 'completed', completed_at = ?, updated_at = ?
       WHERE tenant_id = ? AND session_id = ? AND status = 'active'`
    ).bind(timestamp, timestamp, options.tenantId, previous.id))
    statements.push(db.prepare(
      `UPDATE academic_sessions SET status = 'completed', completed_at = ?, updated_by = ?, updated_at = ?
       WHERE tenant_id = ? AND id = ?`
    ).bind(timestamp, options.actorId || null, timestamp, options.tenantId, previous.id))
  }

  // Any term still marked active elsewhere would collide with the new one.
  statements.push(db.prepare(
    `UPDATE academic_terms SET status = 'completed', completed_at = ?, updated_at = ?
     WHERE tenant_id = ? AND status = 'active'`
  ).bind(timestamp, timestamp, options.tenantId))

  statements.push(db.prepare(
    `UPDATE academic_sessions SET status = 'active', activated_at = ?, completed_at = NULL, updated_by = ?, updated_at = ?
     WHERE tenant_id = ? AND id = ?`
  ).bind(timestamp, options.actorId || null, timestamp, options.tenantId, options.sessionId))

  const terms = await listTerms(db, options.tenantId, options.sessionId)
  let activatedTermId = ''
  if (options.activateFirstTerm !== false && terms.length) {
    // Prefer the term that actually covers today; otherwise open the first one.
    const today = lagosToday()
    const covering = terms.find(term => term.startDate <= today && today <= term.endDate)
    const chosen = covering || terms[0]
    activatedTermId = chosen.id
    statements.push(db.prepare(
      `UPDATE academic_terms SET status = 'active', activated_at = ?, completed_at = NULL, updated_at = ?
       WHERE tenant_id = ? AND id = ?`
    ).bind(timestamp, timestamp, options.tenantId, chosen.id))
  }

  await db.batch(statements)

  return {
    session: (await getSessionById(db, options.tenantId, options.sessionId))!,
    deactivated: previous,
    activatedTerm: activatedTermId ? await getTermById(db, options.tenantId, activatedTermId) : null,
    enrolment,
  }
}

// ─── Term writes ─────────────────────────────────────────────────────────────

export async function saveTerms(db: D1Database, options: {
  tenantId: string
  sessionId: string
  terms: Array<Record<string, any>>
}) {
  await ensureAcademicTables(db)

  const session = await getSessionById(db, options.tenantId, options.sessionId)
  if (!session) throw new AcademicError('Session not found.', 404)

  const normalized = normalizeTermInputs(
    Array.isArray(options.terms) ? options.terms : [],
    { sessionStart: session.startDate, sessionEnd: session.endDate },
  )
  if (!normalized.length) throw new AcademicError('Add at least one term.')

  const existing = await listTerms(db, options.tenantId, options.sessionId)
  const existingBySequence = new Map(existing.map(term => [term.sequence, term]))
  const keptIds = new Set(normalized.map(term => buildTermId(options.sessionId, term.sequence)))

  // A term that already carries assessments cannot simply be dropped.
  const removable = existing.filter(term => !keptIds.has(term.id))
  for (const term of removable) {
    const inUse = await db.prepare(
      `SELECT COUNT(*) AS n FROM fee_assessments WHERE tenant_id = ? AND term_id = ?`
    ).bind(options.tenantId, term.id).first() as Record<string, any> | null
    if (Number(inUse?.n || 0) > 0) {
      throw new AcademicError(`${term.name} already has fee assessments and cannot be removed.`)
    }
  }

  const timestamp = nowIso()
  const statements: D1PreparedStatement[] = []

  for (const term of removable) {
    statements.push(db.prepare(`DELETE FROM academic_breaks WHERE tenant_id = ? AND term_id = ?`).bind(options.tenantId, term.id))
    statements.push(db.prepare(`DELETE FROM academic_terms WHERE tenant_id = ? AND id = ?`).bind(options.tenantId, term.id))
  }

  for (const term of normalized) {
    const id = buildTermId(options.sessionId, term.sequence)
    const prior = existingBySequence.get(term.sequence)
    if (prior) {
      statements.push(db.prepare(
        `UPDATE academic_terms
         SET name = ?, start_date = ?, end_date = ?, resumption_date = ?, auto_activate = ?, notes = ?, updated_at = ?
         WHERE tenant_id = ? AND id = ?`
      ).bind(
        term.name,
        term.startDate,
        term.endDate,
        term.resumptionDate || null,
        term.autoActivate,
        term.notes || null,
        timestamp,
        options.tenantId,
        id,
      ))
    } else {
      statements.push(buildTermInsert(db, { tenantId: options.tenantId, sessionId: options.sessionId, term, timestamp }))
    }
  }

  await db.batch(statements)
  return listTerms(db, options.tenantId, options.sessionId)
}

/**
 * Open one term and close whichever was open. Both halves ship in one batch so
 * the partial unique index never sees an overlap.
 */
export async function activateTerm(db: D1Database, options: {
  tenantId: string
  termId: string
  actorId?: string
}) {
  await ensureAcademicTables(db)

  const target = await getTermById(db, options.tenantId, options.termId)
  if (!target) throw new AcademicError('Term not found.', 404)

  const session = await getSessionById(db, options.tenantId, target.sessionId)
  if (!session) throw new AcademicError('Term is not attached to a session.', 404)
  if (session.status !== 'active') {
    throw new AcademicError(`Activate the ${session.name} session before opening ${target.name}.`)
  }
  if (target.status === 'active') {
    return { term: target, closed: null }
  }

  const previous = await getActiveTerm(db, options.tenantId)
  const timestamp = nowIso()

  await db.batch([
    db.prepare(
      `UPDATE academic_terms SET status = 'completed', completed_at = ?, updated_at = ?
       WHERE tenant_id = ? AND status = 'active'`
    ).bind(timestamp, timestamp, options.tenantId),
    db.prepare(
      `UPDATE academic_terms SET status = 'active', activated_at = ?, completed_at = NULL, updated_at = ?
       WHERE tenant_id = ? AND id = ?`
    ).bind(timestamp, timestamp, options.tenantId, options.termId),
  ])

  return { term: (await getTermById(db, options.tenantId, options.termId))!, closed: previous }
}

export async function closeTerm(db: D1Database, options: { tenantId: string, termId: string }) {
  await ensureAcademicTables(db)
  const target = await getTermById(db, options.tenantId, options.termId)
  if (!target) throw new AcademicError('Term not found.', 404)
  if (target.status !== 'active') throw new AcademicError('Only the active term can be closed.')

  const timestamp = nowIso()
  await db.prepare(
    `UPDATE academic_terms SET status = 'completed', completed_at = ?, updated_at = ? WHERE tenant_id = ? AND id = ?`
  ).bind(timestamp, timestamp, options.tenantId, options.termId).run()

  return (await getTermById(db, options.tenantId, options.termId))!
}

// ─── Breaks ──────────────────────────────────────────────────────────────────

export async function saveBreak(db: D1Database, options: {
  tenantId: string
  sessionId: string
  breakId?: string
  termId?: unknown
  name: unknown
  breakType?: unknown
  startDate: unknown
  endDate: unknown
  resumptionDate?: unknown
  notes?: unknown
}) {
  await ensureAcademicTables(db)

  const session = await getSessionById(db, options.tenantId, options.sessionId)
  if (!session) throw new AcademicError('Session not found.', 404)

  const name = sanitizeText(options.name, 80)
  if (!name) throw new AcademicError('Break name is required.')

  const startDate = normalizeDate(options.startDate, 'Break start date')
  const endDate = normalizeDate(options.endDate, 'Break end date')
  if (endDate < startDate) throw new AcademicError('The break must end on or after it starts.')
  const resumptionDate = normalizeDate(options.resumptionDate, 'Resumption date', { required: false })
  if (resumptionDate && resumptionDate <= endDate) {
    throw new AcademicError('School must resume after the break ends.')
  }

  const termId = sanitizeText(options.termId, 120)
  if (termId) {
    const term = await getTermById(db, options.tenantId, termId)
    if (!term || term.sessionId !== options.sessionId) {
      throw new AcademicError('That term does not belong to this session.')
    }
  }

  const timestamp = nowIso()
  const id = sanitizeText(options.breakId, 120) || `acadbreak_${normalizeKeyPart(options.sessionId)}_${Date.now()}`

  await db.prepare(
    `INSERT INTO academic_breaks (id, tenant_id, session_id, term_id, name, break_type, start_date, end_date, resumption_date, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT created_at FROM academic_breaks WHERE id = ?), ?), ?)
     ON CONFLICT(id) DO UPDATE SET
       term_id = excluded.term_id,
       name = excluded.name,
       break_type = excluded.break_type,
       start_date = excluded.start_date,
       end_date = excluded.end_date,
       resumption_date = excluded.resumption_date,
       notes = excluded.notes,
       updated_at = excluded.updated_at`
  ).bind(
    id,
    options.tenantId,
    options.sessionId,
    termId || null,
    name,
    normalizeStatus(options.breakType, BREAK_TYPES, 'custom'),
    startDate,
    endDate,
    resumptionDate || null,
    sanitizeText(options.notes, 1000) || null,
    id,
    timestamp,
    timestamp,
  ).run()

  return (await listBreaks(db, options.tenantId, options.sessionId)).find(item => item.id === id)!
}

export async function deleteBreak(db: D1Database, tenantId: string, breakId: string) {
  await ensureAcademicTables(db)
  await db.prepare(`DELETE FROM academic_breaks WHERE tenant_id = ? AND id = ?`).bind(tenantId, breakId).run()
}

// ─── Session enrollment ──────────────────────────────────────────────────────
//
// session_enrollments is the historical record. The rest of the app still reads a
// student's current class from settings.payload.classId and users.className, so
// those stay in step as a mirror of whichever session is active. The mirror is
// derived, never authoritative, and can be rebuilt from enrollments at any time.

function buildEnrollmentId(sessionId: string, studentId: string) {
  return `enrol_${normalizeKeyPart(sessionId)}_${normalizeKeyPart(studentId)}`
}

export async function listSessionEnrollments(db: D1Database, options: {
  tenantId: string
  sessionId: string
  classId?: string
  status?: string
}) {
  await ensureAcademicTables(db)

  const filters = ['tenant_id = ?', 'session_id = ?']
  const bindings: unknown[] = [options.tenantId, options.sessionId]

  if (options.classId) {
    filters.push('class_id = ?')
    bindings.push(options.classId)
  }
  if (options.status) {
    filters.push('status = ?')
    bindings.push(options.status)
  }

  const rows = await db.prepare(
    `SELECT * FROM session_enrollments WHERE ${filters.join(' AND ')} ORDER BY class_name, student_name`
  ).bind(...bindings).all()

  return ((rows.results || []) as Record<string, any>[]).map(mapEnrollmentRow)
}

/** Every session a student has been enrolled in, newest first. */
export async function listStudentEnrollmentHistory(db: D1Database, tenantId: string, studentId: string) {
  await ensureAcademicTables(db)
  const rows = await db.prepare(
    `SELECT e.* FROM session_enrollments e
     LEFT JOIN academic_sessions s ON s.id = e.session_id
     WHERE e.tenant_id = ? AND e.student_id = ?
     ORDER BY COALESCE(s.start_date, e.created_at) DESC`
  ).bind(tenantId, studentId).all()
  return ((rows.results || []) as Record<string, any>[]).map(mapEnrollmentRow)
}

export async function getEnrollment(db: D1Database, tenantId: string, sessionId: string, studentId: string) {
  await ensureAcademicTables(db)
  const row = await db.prepare(
    `SELECT * FROM session_enrollments WHERE tenant_id = ? AND session_id = ? AND student_id = ?`
  ).bind(tenantId, sessionId, studentId).first() as Record<string, any> | null
  return row ? mapEnrollmentRow(row) : null
}

type ClassRecord = { id: string, name: string, arm: string, label: string }

async function loadClassMap(db: D1Database, tenantId: string) {
  const rows = await db.prepare(
    `SELECT id, name, arm FROM classes WHERE tenantId = ?`
  ).bind(tenantId).all().catch(() => ({ results: [] }))

  const map = new Map<string, ClassRecord>()
  for (const row of ((rows.results || []) as Record<string, any>[])) {
    const id = String(row.id || '')
    const name = String(row.name || '')
    const arm = String(row.arm || '')
    map.set(id, { id, name, arm, label: `${name}${arm ? ` ${arm}` : ''}`.trim() })
  }
  return map
}

/**
 * Statements that keep the legacy current-class mirror in step with an
 * enrollment. Returned rather than run so callers can fold them into the same
 * batch as the enrollment write.
 */
async function buildMirrorStatements(db: D1Database, options: {
  tenantId: string
  studentId: string
  studentEmail?: string
  classId: string
  className: string
  classArm: string
  status: string
}) {
  const statements: D1PreparedStatement[] = []
  const timestamp = nowIso()

  const leftSchool = ['graduated', 'withdrawn', 'transferred'].includes(options.status)
  const classId = leftSchool ? '' : options.classId
  const label = leftSchool ? '' : `${options.className}${options.classArm ? ` ${options.classArm}` : ''}`.trim()

  // settings rows are keyed by the student's email for most of the school and by
  // their user id for the rest, and every class list in the app reads them with
  // `studentId = email OR studentId = id`. A mirror that wrote only under the
  // email therefore skipped whole cohorts in silence: they stayed in last
  // session's class on the teacher's register, on the class list, and in the fee
  // run, with nothing to show that anything had failed. Look under both keys,
  // write under the one that exists, and create the row when neither does — a
  // student with no settings row is invisible to every class list there is.
  let email = String(options.studentEmail || '').trim()
  if (!email) {
    const userRow = await db.prepare(`SELECT email FROM users WHERE id = ? AND tenantId = ?`)
      .bind(options.studentId, options.tenantId).first().catch(() => null) as Record<string, any> | null
    email = String(userRow?.email || '').trim()
  }

  const settingsKeys = Array.from(new Set([email, String(options.studentId || '').trim()].filter(Boolean)))
  let settingsKey = ''
  let payload: Record<string, any> = {}

  for (const key of settingsKeys) {
    const row = await db.prepare(`SELECT payload FROM settings WHERE studentId = ?`)
      .bind(key).first().catch(() => null) as Record<string, any> | null
    if (!row) continue
    settingsKey = key
    try { payload = JSON.parse(String(row.payload || '{}')) || {} } catch { payload = {} }
    break
  }

  if (!settingsKey && settingsKeys.length) {
    // Nothing stored yet. Seed it the way the roster writers do, so the student
    // resolves as a student of this school rather than as a bare class pointer.
    settingsKey = settingsKeys[0]
    payload = { role: 'student', tenantId: options.tenantId }
  }

  if (settingsKey) {
    payload.classId = classId
    payload.className = leftSchool ? '' : options.className
    payload.classArm = leftSchool ? null : (options.classArm || null)
    if (leftSchool) payload.status = options.status === 'graduated' ? 'alumni' : options.status
    statements.push(db.prepare(
      `INSERT INTO settings (studentId, payload) VALUES (?, ?)
       ON CONFLICT(studentId) DO UPDATE SET payload = excluded.payload`
    ).bind(settingsKey, JSON.stringify(payload)))
  }

  statements.push(db.prepare(
    `UPDATE users SET className = ? WHERE id = ? AND tenantId = ?`
  ).bind(label, options.studentId, options.tenantId))

  if (leftSchool) {
    statements.push(db.prepare(
      `UPDATE users SET status = ? WHERE id = ? AND tenantId = ?`
    ).bind(options.status === 'graduated' ? 'alumni' : options.status, options.studentId, options.tenantId))
  }

  // class_memberships drives classroom access; move it with the placement.
  statements.push(db.prepare(
    `DELETE FROM class_memberships WHERE tenant_id = ? AND user_id = ? AND membership_role = 'student'`
  ).bind(options.tenantId, options.studentId))

  if (classId) {
    statements.push(db.prepare(
      `INSERT OR REPLACE INTO class_memberships (id, tenant_id, class_id, user_id, membership_role, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'student', ?, ?)`
    ).bind(
      `cm_${normalizeKeyPart(options.tenantId)}_${normalizeKeyPart(classId)}_${normalizeKeyPart(options.studentId)}`,
      options.tenantId,
      classId,
      options.studentId,
      timestamp,
      timestamp,
    ))
  }

  return statements
}

/** Place (or re-place) one student in a session. */
export async function upsertEnrollment(db: D1Database, options: {
  tenantId: string
  sessionId: string
  studentId: string
  studentName?: string
  studentEmail?: string
  studentDisplayId?: string
  classId: string
  status?: unknown
  source?: string
  promotionBatchId?: string
  actorId?: string
  actorName?: string
}) {
  await ensureAcademicTables(db)

  const session = await getSessionById(db, options.tenantId, options.sessionId)
  if (!session) throw new AcademicError('Session not found.', 404)

  const status = normalizeStatus(options.status, ENROLLMENT_STATUSES, 'active')
  const classes = await loadClassMap(db, options.tenantId)
  const leftSchool = ['graduated', 'withdrawn', 'transferred'].includes(status)

  const classId = sanitizeText(options.classId, 120)
  if (!classId && !leftSchool) {
    throw new AcademicError('Pick a class for this student.')
  }
  const klass = classId ? classes.get(classId) : null
  if (classId && !klass) {
    throw new AcademicError('That class no longer exists.', 404)
  }

  const timestamp = nowIso()
  const id = buildEnrollmentId(options.sessionId, options.studentId)

  const statements: D1PreparedStatement[] = [
    db.prepare(
      `INSERT INTO session_enrollments (id, tenant_id, session_id, session_name, student_id, student_name, student_display_id, class_id, class_name, class_arm, status, source, promotion_batch_id, enrolled_by, enrolled_by_name, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(tenant_id, session_id, student_id) DO UPDATE SET
         class_id = excluded.class_id,
         class_name = excluded.class_name,
         class_arm = excluded.class_arm,
         status = excluded.status,
         source = excluded.source,
         promotion_batch_id = excluded.promotion_batch_id,
         student_name = excluded.student_name,
         student_display_id = excluded.student_display_id,
         updated_at = excluded.updated_at`
    ).bind(
      id,
      options.tenantId,
      options.sessionId,
      session.name,
      options.studentId,
      sanitizeText(options.studentName, 200) || null,
      sanitizeText(options.studentDisplayId, 60) || null,
      klass?.id || null,
      klass?.name || null,
      klass?.arm || null,
      status,
      sanitizeText(options.source, 40) || 'manual',
      sanitizeText(options.promotionBatchId, 120) || null,
      options.actorId || null,
      sanitizeText(options.actorName, 200) || null,
      timestamp,
      timestamp,
    ),
  ]

  // Only the live session drives what the rest of the app shows today.
  if (session.status === 'active') {
    statements.push(...await buildMirrorStatements(db, {
      tenantId: options.tenantId,
      studentId: options.studentId,
      studentEmail: options.studentEmail,
      classId: klass?.id || '',
      className: klass?.name || '',
      classArm: klass?.arm || '',
      status,
    }))
  }

  await db.batch(statements)
  return (await getEnrollment(db, options.tenantId, options.sessionId, options.studentId))!
}

/**
 * Move students to another class within one session.
 *
 * This is the other half of automatic promotion: a school that runs one JSS 3
 * into SS 1 Science by default still has to split it into Science and Art by
 * hand, and doing that one student at a time — or by drafting a whole promotion
 * round — is not a workable afternoon. Placements written here are marked
 * 'manual', which is what stops a later promotion round overwriting them.
 */
export async function moveEnrollments(db: D1Database, options: {
  tenantId: string
  sessionId: string
  studentIds: string[]
  classId: string
  status?: unknown
  actorId?: string
  actorName?: string
  studentEmailById?: Map<string, string>
}) {
  await ensureAcademicTables(db)

  const session = await getSessionById(db, options.tenantId, options.sessionId)
  if (!session) throw new AcademicError('Session not found.', 404)

  const status = normalizeStatus(options.status, ENROLLMENT_STATUSES, 'active')
  const leftSchool = ['graduated', 'withdrawn', 'transferred'].includes(status)

  const classId = sanitizeText(options.classId, 120)
  const classes = await loadClassMap(db, options.tenantId)
  const klass = classId ? classes.get(classId) : null
  if (classId && !klass) throw new AcademicError('That class no longer exists.', 404)
  if (!klass && !leftSchool) throw new AcademicError('Pick a class to move these students into.')

  const studentIds = Array.from(new Set(
    (options.studentIds || []).map(value => String(value || '').trim()).filter(Boolean)
  ))
  if (!studentIds.length) throw new AcademicError('Pick at least one student to move.')

  const register = await listSessionEnrollments(db, { tenantId: options.tenantId, sessionId: options.sessionId })
  const byStudent = new Map(register.map(item => [item.studentId, item]))

  const timestamp = nowIso()
  const statements: D1PreparedStatement[] = []
  let moved = 0
  const missing: string[] = []

  for (const studentId of studentIds) {
    const current = byStudent.get(studentId)
    if (!current) {
      missing.push(studentId)
      continue
    }
    // Already where they are being sent, and for the same reason: nothing to write.
    if (current.classId === (klass?.id || '') && current.status === status) continue

    statements.push(db.prepare(
      `UPDATE session_enrollments
       SET class_id = ?, class_name = ?, class_arm = ?, status = ?, source = 'manual',
           enrolled_by = ?, enrolled_by_name = ?, updated_at = ?
       WHERE tenant_id = ? AND session_id = ? AND student_id = ?`
    ).bind(
      klass?.id || null,
      klass?.name || null,
      klass?.arm || null,
      status,
      options.actorId || null,
      sanitizeText(options.actorName, 200) || null,
      timestamp,
      options.tenantId,
      options.sessionId,
      studentId,
    ))

    // Only the live session drives what the rest of the app shows today.
    if (session.status === 'active') {
      statements.push(...await buildMirrorStatements(db, {
        tenantId: options.tenantId,
        studentId,
        studentEmail: options.studentEmailById?.get(studentId),
        classId: klass?.id || '',
        className: klass?.name || '',
        classArm: klass?.arm || '',
        status,
      }))
    }

    moved += 1
  }

  for (let index = 0; index < statements.length; index += 40) {
    await db.batch(statements.slice(index, index + 40))
  }

  return {
    moved,
    missing,
    className: klass?.label || '',
    sessionName: session.name,
    liveViewMoved: session.status === 'active',
  }
}

/**
 * Close the outgoing session's register at handover: the class each student sat
 * in stays exactly as recorded, and what became of them is written beside it.
 *
 * This belongs to activation rather than to enrollment. Drafting next year's
 * session in January must not tell this year's register that the school has
 * already moved on — nothing has happened until the new session opens.
 */
async function buildHandoverStatements(db: D1Database, options: {
  tenantId: string
  fromSessionId: string
  toSessionId: string
  timestamp: string
}) {
  const [outgoing, incoming] = await Promise.all([
    listSessionEnrollments(db, { tenantId: options.tenantId, sessionId: options.fromSessionId, status: 'active' }),
    listSessionEnrollments(db, { tenantId: options.tenantId, sessionId: options.toSessionId }),
  ])
  if (!outgoing.length) return []

  const incomingByStudent = new Map(incoming.map(item => [item.studentId, item]))
  const statements: D1PreparedStatement[] = []

  for (const enrollment of outgoing) {
    const next = incomingByStudent.get(enrollment.studentId)
    // Nobody carried this student forward. Their record stands as it is rather
    // than claiming an outcome the school never decided.
    if (!next) continue

    const outcome = next.status !== 'active'
      ? next.status
      : next.classId && next.classId !== enrollment.classId ? 'promoted' : 'repeated'

    statements.push(db.prepare(
      `UPDATE session_enrollments SET status = ?, updated_at = ?
       WHERE tenant_id = ? AND session_id = ? AND student_id = ? AND status = 'active'`
    ).bind(outcome, options.timestamp, options.tenantId, options.fromSessionId, enrollment.studentId))
  }

  return statements
}

/**
 * Re-point the legacy current-class mirror at a session's enrollments. Run after
 * activating a session so staff see the new placements immediately.
 */
export async function syncMirrorToSession(db: D1Database, options: {
  tenantId: string
  sessionId: string
  studentEmailById?: Map<string, string>
}) {
  await ensureAcademicTables(db)

  const enrollments = await listSessionEnrollments(db, { tenantId: options.tenantId, sessionId: options.sessionId })
  if (!enrollments.length) return { synced: 0 }

  const statements: D1PreparedStatement[] = []
  let synced = 0
  for (const enrollment of enrollments) {
    // An active placement with no class is a to-do for the office, not an
    // instruction to strip the student of the class they are already in.
    if (!enrollment.classId && !['graduated', 'withdrawn', 'transferred'].includes(enrollment.status)) continue

    synced += 1
    statements.push(...await buildMirrorStatements(db, {
      tenantId: options.tenantId,
      studentId: enrollment.studentId,
      studentEmail: options.studentEmailById?.get(enrollment.studentId),
      classId: enrollment.classId,
      className: enrollment.className,
      classArm: enrollment.classArm,
      status: enrollment.status,
    }))
  }

  // D1 caps how much one batch will carry; chunk large cohorts.
  for (let index = 0; index < statements.length; index += 40) {
    await db.batch(statements.slice(index, index + 40))
  }

  return { synced }
}

// ─── Automatic enrollment and promotion ────────────────────────

// A student wearing one of these statuses has left the school. Rolling them into
// a new session would put leavers back on the register.
const LEFT_SCHOOL_USER_STATUSES = ['inactive', 'alumni', 'graduated', 'withdrawn', 'transferred', 'archived', 'deleted']

// The same, expressed as enrollment statuses: whatever the last session recorded
// about a student who left is the end of their story.
const LEFT_SCHOOL_ENROLLMENT_STATUSES = ['graduated', 'withdrawn', 'transferred']

type RosterEntry = {
  id: string
  name: string
  email: string
  displayId: string
  classId: string
  classLabel: string
}

type PriorPlacement = {
  sessionId: string
  sessionName: string
  classId: string
  className: string
  status: string
}

/**
 * The school's current students, read straight from the roster tables. The
 * request-side helper hydrates every settings blob and costs far more than this
 * needs; the cron path has no request context to borrow it from either.
 */
async function loadStudentRoster(db: D1Database, tenantId: string): Promise<RosterEntry[]> {
  const placeholders = LEFT_SCHOOL_USER_STATUSES.map(() => '?').join(', ')
  const rows = await db.prepare(
    `SELECT u.id AS id, u.name AS name, u.email AS email, u.className AS class_label,
            COALESCE(s.payload, s2.payload) AS payload
     FROM users u
     LEFT JOIN settings s ON s.studentId = u.email
     LEFT JOIN settings s2 ON s2.studentId = u.id
     WHERE u.tenantId = ? AND LOWER(COALESCE(u.role, '')) = 'student'
       AND LOWER(COALESCE(NULLIF(TRIM(u.status), ''), 'active')) NOT IN (${placeholders})
     ORDER BY u.name`
  ).bind(tenantId, ...LEFT_SCHOOL_USER_STATUSES).all().catch(() => ({ results: [] }))

  const roster: RosterEntry[] = []
  for (const row of ((rows.results || []) as Record<string, any>[])) {
    const id = String(row.id || '').trim()
    if (!id) continue

    let payload: Record<string, any> = {}
    try { payload = JSON.parse(String(row.payload || '{}')) || {} } catch { payload = {} }

    roster.push({
      id,
      name: String(row.name || payload.name || ''),
      email: String(row.email || ''),
      displayId: String(payload.publicStudentId || payload.displayId || ''),
      classId: String(payload.classId || ''),
      classLabel: String(row.class_label || payload.className || ''),
    })
  }
  return roster
}

/**
 * Where a student sat in the last session that ran before this one. Ordered
 * oldest first so the final write per student is their most recent placement.
 */
async function loadPriorPlacements(db: D1Database, options: {
  tenantId: string
  sessionId: string
  sessionStart: string
}) {
  const rows = await db.prepare(
    `SELECT e.student_id AS student_id, e.session_id AS session_id, e.class_id AS class_id,
            e.class_name AS class_name, e.status AS status, s.name AS session_name
     FROM session_enrollments e
     LEFT JOIN academic_sessions s ON s.id = e.session_id
     WHERE e.tenant_id = ? AND e.session_id != ?
       AND COALESCE(s.start_date, e.created_at) < ?
     ORDER BY COALESCE(s.start_date, e.created_at) ASC`
  ).bind(options.tenantId, options.sessionId, options.sessionStart).all().catch(() => ({ results: [] }))

  const placements = new Map<string, PriorPlacement>()
  for (const row of ((rows.results || []) as Record<string, any>[])) {
    placements.set(String(row.student_id || ''), {
      sessionId: String(row.session_id || ''),
      sessionName: String(row.session_name || ''),
      classId: String(row.class_id || ''),
      className: String(row.class_name || ''),
      status: String(row.status || 'active'),
    })
  }
  return placements
}

/** The owner's class-to-class progression flow, as saved on the promotion page. */
async function loadProgressionMap(db: D1Database, tenantId: string) {
  const row = await db.prepare(
    `SELECT payload FROM settings WHERE studentId = ?`
  ).bind(`promotion_map_${tenantId}`).first().catch(() => null) as Record<string, any> | null
  if (!row) return {} as Record<string, string>

  try {
    const payload = JSON.parse(String(row.payload || '{}')) || {}
    const map = payload.map || {}
    return (map && typeof map === 'object' ? map : {}) as Record<string, string>
  } catch {
    return {} as Record<string, string>
  }
}

/**
 * Where a student sits today. The stored class id is authoritative; schools that
 * predate it only ever recorded the printed label, so fall back to matching that.
 */
function resolveRosterClass(entry: RosterEntry, classes: Map<string, ClassRecord>) {
  const direct = entry.classId ? classes.get(entry.classId) : null
  if (direct) return direct

  const label = entry.classLabel.trim().toLowerCase()
  if (!label) return null
  for (const klass of classes.values()) {
    if (klass.label.toLowerCase() === label) return klass
  }
  return null
}

/**
 * Fill a session's register with the school that already exists, moving every
 * returning student up a class on the way in.
 *
 * A new session is not a new school: the same children are still here. So the
 * register is seeded when the session is created and again before it opens —
 * returning students follow the owner's progression flow into their next class,
 * newly admitted ones land in the class they were admitted into, and a class
 * with no rule holds where it is rather than being guessed at. That leaves the
 * owner with fees and payments to enter rather than the whole school.
 *
 * Rows land with source 'auto-promotion' or 'carryover', the two markers a
 * manually run promotion round is allowed to overwrite. Anything enrolled by
 * hand, or by a promotion round already committed, is left exactly as it is.
 */
export async function autoEnrolSession(db: D1Database, options: {
  tenantId: string
  sessionId: string
  actorId?: string
  actorName?: string
  ensureTables?: boolean
}) {
  if (options.ensureTables !== false) await ensureAcademicTables(db)

  const session = await getSessionById(db, options.tenantId, options.sessionId)
  if (!session) throw new AcademicError('Session not found.', 404)

  const nothingToDo = {
    enrolled: 0,
    promoted: 0,
    heldBack: 0,
    graduated: 0,
    unplaced: 0,
    alreadyEnrolled: 0,
    sessionName: session.name,
  }
  // A finished session's register is history; leave it alone.
  if (session.status === 'archived' || session.status === 'completed') return nothingToDo

  const [roster, classes, existingRows, priorPlacements, progressionMap] = await Promise.all([
    loadStudentRoster(db, options.tenantId),
    loadClassMap(db, options.tenantId),
    db.prepare(
      `SELECT student_id FROM session_enrollments WHERE tenant_id = ? AND session_id = ?`
    ).bind(options.tenantId, options.sessionId).all().catch(() => ({ results: [] })),
    loadPriorPlacements(db, {
      tenantId: options.tenantId,
      sessionId: options.sessionId,
      sessionStart: session.startDate,
    }),
    loadProgressionMap(db, options.tenantId),
  ])

  const alreadyEnrolled = new Set(
    ((existingRows.results || []) as Record<string, any>[]).map(row => String(row.student_id || ''))
  )

  const timestamp = nowIso()
  const statements: D1PreparedStatement[] = []
  const counts = { enrolled: 0, promoted: 0, heldBack: 0, graduated: 0, unplaced: 0 }

  for (const entry of roster) {
    if (alreadyEnrolled.has(entry.id)) continue

    const prior = priorPlacements.get(entry.id)
    // The last session already recorded that this student left.
    if (prior && LEFT_SCHOOL_ENROLLMENT_STATUSES.includes(prior.status)) continue

    const currentClass = (prior?.classId ? classes.get(prior.classId) : null)
      || resolveRosterClass(entry, classes)

    let action = 'repeat'
    let status = 'active'
    let target = currentClass

    if (prior) {
      // A returning student moves on. No rule for their class means the owner
      // has not said where it leads, so hold them rather than guess.
      const mapped = String(progressionMap[currentClass?.id || ''] || '').trim()
      if (mapped === 'alumni') {
        action = 'graduate'
        status = 'graduated'
        target = null
      } else if (mapped && classes.has(mapped)) {
        action = 'promote'
        target = classes.get(mapped)!
      }
    } else {
      // Newly admitted: the class they were admitted into is the right one.
      action = 'enrol'
    }

    if (action === 'promote') counts.promoted += 1
    else if (action === 'graduate') counts.graduated += 1
    else if (prior) counts.heldBack += 1

    // Enrol even when no class can be resolved: a student missing from the
    // register is invisible, whereas one with no class is a visible to-do. The
    // mirror sync skips these rather than wiping the placement they do have.
    if (!target && status === 'active') counts.unplaced += 1

    statements.push(db.prepare(
      `INSERT INTO session_enrollments (id, tenant_id, session_id, session_name, student_id, student_name, student_display_id, class_id, class_name, class_arm, status, source, promotion_batch_id, enrolled_by, enrolled_by_name, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?)
       ON CONFLICT(tenant_id, session_id, student_id) DO NOTHING`
    ).bind(
      buildEnrollmentId(options.sessionId, entry.id),
      options.tenantId,
      options.sessionId,
      session.name,
      entry.id,
      sanitizeText(entry.name, 200) || null,
      sanitizeText(entry.displayId, 60) || null,
      target?.id || null,
      target?.name || null,
      target?.arm || null,
      status,
      action === 'promote' || action === 'graduate' ? 'auto-promotion' : 'carryover',
      options.actorId || null,
      sanitizeText(options.actorName, 200) || null,
      timestamp,
      timestamp,
    ))

    // Only a move is worth a promotion record; a first enrollment is not one.
    if (prior && action !== 'enrol') {
      statements.push(db.prepare(
        `INSERT OR REPLACE INTO promotion_audit (id, tenant_id, batch_id, student_id, student_name, from_session_id, from_session_name, from_class_id, from_class_name, to_session_id, to_session_name, to_class_id, to_class_name, action, mode, performed_by, performed_by_name, performed_at)
         VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'automatic', ?, ?, ?)`
      ).bind(
        `promoaud_auto_${normalizeKeyPart(options.sessionId)}_${normalizeKeyPart(entry.id)}`,
        options.tenantId,
        entry.id,
        sanitizeText(entry.name, 200) || null,
        prior.sessionId || null,
        prior.sessionName || null,
        currentClass?.id || prior.classId || null,
        currentClass?.label || prior.className || null,
        session.id,
        session.name,
        target?.id || null,
        target?.label || null,
        action,
        options.actorId || null,
        sanitizeText(options.actorName, 200) || null,
        timestamp,
      ))
    }

    counts.enrolled += 1
  }

  for (let index = 0; index < statements.length; index += 40) {
    await db.batch(statements.slice(index, index + 40))
  }

  return { ...counts, alreadyEnrolled: alreadyEnrolled.size, sessionName: session.name }
}

// ─── Promotion ───────────────────────────────────────────────────────────────

export async function listPromotionBatches(db: D1Database, tenantId: string) {
  await ensureAcademicTables(db)
  const rows = await db.prepare(
    `SELECT * FROM promotion_batches WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 100`
  ).bind(tenantId).all()
  return ((rows.results || []) as Record<string, any>[]).map(mapPromotionBatchRow)
}

export async function getPromotionBatch(db: D1Database, tenantId: string, batchId: string) {
  await ensureAcademicTables(db)
  const row = await db.prepare(
    `SELECT * FROM promotion_batches WHERE tenant_id = ? AND id = ?`
  ).bind(tenantId, batchId).first() as Record<string, any> | null
  if (!row) return null

  const decisions = await db.prepare(
    `SELECT * FROM promotion_decisions WHERE tenant_id = ? AND batch_id = ? ORDER BY from_class_name, student_name`
  ).bind(tenantId, batchId).all()

  return {
    batch: mapPromotionBatchRow(row),
    decisions: ((decisions.results || []) as Record<string, any>[]).map(mapPromotionDecisionRow),
  }
}

/**
 * Draft a promotion round. Every student enrolled in the outgoing session gets a
 * proposed next class from the school's configured progression map, and every
 * proposal starts pending so nothing moves until a human approves it.
 */
export async function buildPromotionProposals(db: D1Database, options: {
  tenantId: string
  fromSessionId: string
  toSessionId: string
  progressionMap: Record<string, string>
  students: Array<{ id: string, name: string, email?: string, displayId?: string, classId: string }>
  actorId?: string
  actorName?: string
}) {
  await ensureAcademicTables(db)

  const fromSession = options.fromSessionId
    ? await getSessionById(db, options.tenantId, options.fromSessionId)
    : null
  const toSession = await getSessionById(db, options.tenantId, options.toSessionId)
  if (!toSession) throw new AcademicError('Pick the session students are moving into.', 404)
  if (options.fromSessionId && options.fromSessionId === options.toSessionId) {
    throw new AcademicError('The outgoing and incoming sessions must differ.')
  }

  const existingCommitted = await db.prepare(
    `SELECT id FROM promotion_batches WHERE tenant_id = ? AND to_session_id = ? AND status = 'committed' LIMIT 1`
  ).bind(options.tenantId, options.toSessionId).first()
  if (existingCommitted) {
    throw new AcademicError(`${toSession.name} has already been promoted into. Edit its enrollments instead.`, 409)
  }

  const classes = await loadClassMap(db, options.tenantId)

  // Prefer the outgoing session's recorded enrollments; fall back to the live
  // roster for the first ever round, when no enrollment history exists yet.
  const priorEnrollments = fromSession
    ? await listSessionEnrollments(db, { tenantId: options.tenantId, sessionId: fromSession.id })
    : []
  const priorByStudent = new Map(priorEnrollments.map(item => [item.studentId, item]))

  const roster = options.students.map(student => {
    const prior = priorByStudent.get(student.id)
    const fromClassId = prior?.classId || student.classId || ''
    const fromClass = classes.get(fromClassId)
    return {
      studentId: student.id,
      studentName: student.name,
      studentDisplayId: student.displayId || '',
      fromClassId,
      fromClassName: fromClass?.label || prior?.className || '',
    }
  }).filter(entry => entry.studentId)

  if (!roster.length) throw new AcademicError('There are no students to promote.')

  const timestamp = nowIso()
  const batchId = `promo_${normalizeKeyPart(options.tenantId)}_${normalizeKeyPart(toSession.name)}_${Date.now()}`

  const statements: D1PreparedStatement[] = [
    db.prepare(
      `INSERT INTO promotion_batches (id, tenant_id, from_session_id, from_session_name, to_session_id, to_session_name, status, created_by, created_by_name, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?)`
    ).bind(
      batchId,
      options.tenantId,
      fromSession?.id || null,
      fromSession?.name || null,
      toSession.id,
      toSession.name,
      options.actorId || null,
      sanitizeText(options.actorName, 200) || null,
      timestamp,
      timestamp,
    ),
  ]

  for (const entry of roster) {
    const mapped = String(options.progressionMap?.[entry.fromClassId] || '').trim()
    let action = 'promote'
    let toClassId = mapped
    let toClassName = ''

    if (!mapped) {
      // No rule configured: hold the student where they are and let staff decide.
      action = 'repeat'
      toClassId = entry.fromClassId
      toClassName = entry.fromClassName
    } else if (mapped === 'alumni') {
      action = 'graduate'
      toClassId = ''
      toClassName = ''
    } else {
      const target = classes.get(mapped)
      if (!target) {
        action = 'repeat'
        toClassId = entry.fromClassId
        toClassName = entry.fromClassName
      } else {
        toClassName = target.label
      }
    }

    statements.push(db.prepare(
      `INSERT INTO promotion_decisions (id, tenant_id, batch_id, student_id, student_name, student_display_id, from_class_id, from_class_name, to_class_id, to_class_name, action, source, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'auto', 'pending', ?, ?)`
    ).bind(
      `promodec_${normalizeKeyPart(batchId)}_${normalizeKeyPart(entry.studentId)}`,
      options.tenantId,
      batchId,
      entry.studentId,
      entry.studentName || null,
      entry.studentDisplayId || null,
      entry.fromClassId || null,
      entry.fromClassName || null,
      toClassId || null,
      toClassName || null,
      action,
      timestamp,
      timestamp,
    ))
  }

  for (let index = 0; index < statements.length; index += 40) {
    await db.batch(statements.slice(index, index + 40))
  }

  return (await getPromotionBatch(db, options.tenantId, batchId))!
}

/** Override the proposed placement for one or many students. */
export async function updatePromotionDecisions(db: D1Database, options: {
  tenantId: string
  batchId: string
  updates: Array<{ studentId: string, toClassId?: unknown, action?: unknown }>
  actorId?: string
  actorName?: string
}) {
  await ensureAcademicTables(db)

  const existing = await getPromotionBatch(db, options.tenantId, options.batchId)
  if (!existing) throw new AcademicError('Promotion round not found.', 404)
  if (existing.batch.status === 'committed') {
    throw new AcademicError('This promotion round has already been committed.')
  }

  const classes = await loadClassMap(db, options.tenantId)
  const timestamp = nowIso()
  const statements: D1PreparedStatement[] = []

  for (const update of options.updates || []) {
    const studentId = sanitizeText(update?.studentId, 120)
    if (!studentId) continue

    const decision = existing.decisions.find(item => item.studentId === studentId)
    if (!decision) throw new AcademicError(`${studentId} is not part of this promotion round.`, 404)

    const action = update.action === undefined
      ? decision.action
      : normalizeStatus(update.action, PROMOTION_ACTIONS, decision.action)

    let toClassId = update.toClassId === undefined ? decision.toClassId : sanitizeText(update.toClassId, 120)
    let toClassName = ''

    if (action === 'graduate' || action === 'withdraw' || action === 'transfer') {
      toClassId = ''
    } else {
      if (!toClassId) throw new AcademicError(`Pick a class for ${decision.studentName || studentId}.`)
      const target = classes.get(toClassId)
      if (!target) throw new AcademicError(`The class chosen for ${decision.studentName || studentId} no longer exists.`, 404)
      toClassName = target.label
    }

    statements.push(db.prepare(
      `UPDATE promotion_decisions
       SET to_class_id = ?, to_class_name = ?, action = ?, source = 'manual', decided_by = ?, decided_by_name = ?, decided_at = ?, updated_at = ?
       WHERE tenant_id = ? AND batch_id = ? AND student_id = ?`
    ).bind(
      toClassId || null,
      toClassName || null,
      action,
      options.actorId || null,
      sanitizeText(options.actorName, 200) || null,
      timestamp,
      timestamp,
      options.tenantId,
      options.batchId,
      studentId,
    ))
  }

  if (!statements.length) return existing

  for (let index = 0; index < statements.length; index += 40) {
    await db.batch(statements.slice(index, index + 40))
  }

  return (await getPromotionBatch(db, options.tenantId, options.batchId))!
}

/**
 * Turn approved proposals into enrollments for the incoming session. Writes the
 * new placements, the audit trail and the batch status together, so a failure
 * part-way cannot leave half a cohort enrolled.
 */
export async function commitPromotionBatch(db: D1Database, options: {
  tenantId: string
  batchId: string
  studentIds?: string[]
  actorId?: string
  actorName?: string
  studentEmailById?: Map<string, string>
}) {
  await ensureAcademicTables(db)

  const existing = await getPromotionBatch(db, options.tenantId, options.batchId)
  if (!existing) throw new AcademicError('Promotion round not found.', 404)
  if (existing.batch.status === 'cancelled') throw new AcademicError('This promotion round was cancelled.')

  const toSession = await getSessionById(db, options.tenantId, existing.batch.toSessionId)
  if (!toSession) throw new AcademicError('The incoming session no longer exists.', 404)

  const selected = options.studentIds?.length
    ? existing.decisions.filter(decision => options.studentIds!.includes(decision.studentId))
    : existing.decisions

  const pending = selected.filter(decision => decision.status !== 'committed')
  if (!pending.length) throw new AcademicError('Every selected student has already been enrolled.')

  // The automatic roll-over places everyone as soon as a session exists, and
  // this round is the school overruling that default, so those rows are replaced
  // in place. A placement someone made by hand, or an earlier promotion round,
  // is a decision already taken: refuse rather than silently overwrite it.
  const alreadyEnrolled = await listSessionEnrollments(db, { tenantId: options.tenantId, sessionId: toSession.id })
  const enrolledByStudent = new Map(alreadyEnrolled.map(item => [item.studentId, item]))
  const clashes = pending.filter(decision => {
    const existing = enrolledByStudent.get(decision.studentId)
    return existing ? !AUTO_ENROLLED_SOURCES.includes(existing.source) : false
  })
  if (clashes.length) {
    // Name them. "One student is already enrolled" sends the office hunting
    // through a list of six hundred to find out which.
    const names = clashes.slice(0, 3).map(item => item.studentName || item.studentId).join(', ')
    const rest = clashes.length > 3 ? ` and ${clashes.length - 3} others` : ''
    throw new AcademicError(
      `${names}${rest} ${clashes.length === 1 ? 'is' : 'are'} already enrolled in ${toSession.name} by hand. `
      + 'Leave them out of this round, or change their class from the Class Register.',
      409,
    )
  }

  const timestamp = nowIso()
  const statements: D1PreparedStatement[] = []
  const classes = await loadClassMap(db, options.tenantId)

  for (const decision of pending) {
    const status = decision.action === 'promote' || decision.action === 'repeat'
      ? 'active'
      : decision.action === 'graduate' ? 'graduated'
      : decision.action === 'withdraw' ? 'withdrawn' : 'transferred'

    const target = decision.toClassId ? classes.get(decision.toClassId) : null

    statements.push(db.prepare(
      `INSERT INTO session_enrollments (id, tenant_id, session_id, session_name, student_id, student_name, student_display_id, class_id, class_name, class_arm, status, source, promotion_batch_id, enrolled_by, enrolled_by_name, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'promotion', ?, ?, ?, ?, ?)
       ON CONFLICT(tenant_id, session_id, student_id) DO UPDATE SET
         class_id = excluded.class_id,
         class_name = excluded.class_name,
         class_arm = excluded.class_arm,
         status = excluded.status,
         source = excluded.source,
         promotion_batch_id = excluded.promotion_batch_id,
         student_name = excluded.student_name,
         student_display_id = excluded.student_display_id,
         enrolled_by = excluded.enrolled_by,
         enrolled_by_name = excluded.enrolled_by_name,
         updated_at = excluded.updated_at`
    ).bind(
      buildEnrollmentId(toSession.id, decision.studentId),
      options.tenantId,
      toSession.id,
      toSession.name,
      decision.studentId,
      decision.studentName || null,
      decision.studentDisplayId || null,
      target?.id || null,
      target?.name || null,
      target?.arm || null,
      status,
      options.batchId,
      options.actorId || null,
      sanitizeText(options.actorName, 200) || null,
      timestamp,
      timestamp,
    ))

    statements.push(db.prepare(
      `INSERT INTO promotion_audit (id, tenant_id, batch_id, student_id, student_name, from_session_id, from_session_name, from_class_id, from_class_name, to_session_id, to_session_name, to_class_id, to_class_name, action, mode, performed_by, performed_by_name, performed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      `promoaud_${normalizeKeyPart(options.batchId)}_${normalizeKeyPart(decision.studentId)}`,
      options.tenantId,
      options.batchId,
      decision.studentId,
      decision.studentName || null,
      existing.batch.fromSessionId || null,
      existing.batch.fromSessionName || null,
      decision.fromClassId || null,
      decision.fromClassName || null,
      toSession.id,
      toSession.name,
      decision.toClassId || null,
      decision.toClassName || null,
      decision.action,
      decision.source === 'manual' ? 'manual' : 'automatic',
      options.actorId || null,
      sanitizeText(options.actorName, 200) || null,
      timestamp,
    ))

    statements.push(db.prepare(
      `UPDATE promotion_decisions SET status = 'committed', updated_at = ? WHERE tenant_id = ? AND batch_id = ? AND student_id = ?`
    ).bind(timestamp, options.tenantId, options.batchId, decision.studentId))

    // This round replaces the automatic placement, so the automatic record of it
    // goes too: the history should show one decision per student, the real one.
    statements.push(db.prepare(
      `DELETE FROM promotion_audit WHERE tenant_id = ? AND id = ?`
    ).bind(
      options.tenantId,
      `promoaud_auto_${normalizeKeyPart(toSession.id)}_${normalizeKeyPart(decision.studentId)}`,
    ))

    // The outgoing enrollment records what happened to the student, without
    // touching the class they were actually in.
    if (existing.batch.fromSessionId) {
      const outgoingStatus = decision.action === 'promote' ? 'promoted'
        : decision.action === 'repeat' ? 'repeated'
        : status
      statements.push(db.prepare(
        `UPDATE session_enrollments SET status = ?, updated_at = ?
         WHERE tenant_id = ? AND session_id = ? AND student_id = ?`
      ).bind(outgoingStatus, timestamp, options.tenantId, existing.batch.fromSessionId, decision.studentId))
    }

    // Only move the live view if students are being promoted into the session
    // that is already running.
    if (toSession.status === 'active') {
      statements.push(...await buildMirrorStatements(db, {
        tenantId: options.tenantId,
        studentId: decision.studentId,
        studentEmail: options.studentEmailById?.get(decision.studentId),
        classId: target?.id || '',
        className: target?.name || '',
        classArm: target?.arm || '',
        status,
      }))
    }
  }

  const remaining = existing.decisions.length - pending.length
  statements.push(db.prepare(
    `UPDATE promotion_batches SET status = ?, committed_by = ?, committed_by_name = ?, committed_at = ?, updated_at = ?
     WHERE tenant_id = ? AND id = ?`
  ).bind(
    remaining > 0 && options.studentIds?.length ? 'draft' : 'committed',
    options.actorId || null,
    sanitizeText(options.actorName, 200) || null,
    timestamp,
    timestamp,
    options.tenantId,
    options.batchId,
  ))

  for (let index = 0; index < statements.length; index += 40) {
    await db.batch(statements.slice(index, index + 40))
  }

  return {
    batch: (await getPromotionBatch(db, options.tenantId, options.batchId))!,
    enrolled: pending.length,
    session: toSession,
  }
}

export async function cancelPromotionBatch(db: D1Database, tenantId: string, batchId: string) {
  await ensureAcademicTables(db)
  const existing = await getPromotionBatch(db, tenantId, batchId)
  if (!existing) throw new AcademicError('Promotion round not found.', 404)
  if (existing.batch.status === 'committed') {
    throw new AcademicError('A committed promotion round cannot be cancelled.')
  }
  await db.prepare(
    `UPDATE promotion_batches SET status = 'cancelled', updated_at = ? WHERE tenant_id = ? AND id = ?`
  ).bind(nowIso(), tenantId, batchId).run()
}

export async function listPromotionAudit(db: D1Database, options: {
  tenantId: string
  studentId?: string
  batchId?: string
  limit?: number
}) {
  await ensureAcademicTables(db)

  const filters = ['tenant_id = ?']
  const bindings: unknown[] = [options.tenantId]
  if (options.studentId) {
    filters.push('student_id = ?')
    bindings.push(options.studentId)
  }
  if (options.batchId) {
    filters.push('batch_id = ?')
    bindings.push(options.batchId)
  }

  const limit = Math.min(Math.max(Number(options.limit || 200), 1), 1000)
  const rows = await db.prepare(
    `SELECT * FROM promotion_audit WHERE ${filters.join(' AND ')} ORDER BY performed_at DESC LIMIT ${limit}`
  ).bind(...bindings).all()

  return ((rows.results || []) as Record<string, any>[]).map(mapPromotionAuditRow)
}

// ─── The term fee cycle ──────────────────────────────────────────────────────
//
// Every term opens its own assessment per student. Nothing is ever overwritten:
// when a term ends with money still owed, that shortfall stays on the term's own
// assessment and simply keeps counting towards what the student currently owes.
// A later payment is allocated back to the assessment it settles, so the debt is
// recorded once and paid once.

function buildAssessmentId(termId: string, studentId: string, kind: string) {
  return `feeasmt_${normalizeKeyPart(termId)}_${normalizeKeyPart(studentId)}_${normalizeKeyPart(kind)}`
}

function deriveAssessmentStatus(netAmount: number, amountPaid: number, currentStatus?: string) {
  if (currentStatus === 'waived') return 'waived'
  const net = toMoney(netAmount)
  const paid = toMoney(amountPaid)
  if (net <= 0) return 'paid'
  if (paid <= 0) return 'unpaid'
  return paid >= net ? 'paid' : 'partial'
}

/**
 * Work out what one student owes for a term from the school's fee template.
 * Mirrors how the fees board resolves an amount: a per-student row overrides the
 * class row, which overrides the all-classes row. The gap between the class
 * default and the student's own figure is what the school has discounted.
 */
export function resolveStudentFeeLines(options: {
  feeConfigRows: Array<Record<string, any>>
  classId: string
  studentId: string
}) {
  const byFeeType = new Map<string, { classAmount: number | null, allAmount: number | null, studentAmount: number | null, sortOrder: number }>()

  for (const row of options.feeConfigRows) {
    const feeType = String(row.fee_type || row.feeType || '').trim()
    if (!feeType) continue

    const key = feeType.toLowerCase()
    const entry = byFeeType.get(key) || { classAmount: null, allAmount: null, studentAmount: null, sortOrder: Number(row.sort_order ?? row.sortOrder ?? 0) }
    entry.sortOrder = Math.min(entry.sortOrder, Number(row.sort_order ?? row.sortOrder ?? 0))

    const rowStudentId = String(row.student_id || row.studentId || '').trim()
    const rowClassId = String(row.class_id || row.classId || '').trim()
    const amount = toMoney(row.amount)

    if (rowStudentId) {
      if (rowStudentId === options.studentId) entry.studentAmount = amount
    } else if (rowClassId) {
      if (rowClassId === options.classId) entry.classAmount = amount
    } else {
      entry.allAmount = amount
    }

    byFeeType.set(key, entry)
  }

  const lines: Array<{ feeType: string, amount: number, defaultAmount: number, source: string, sortOrder: number }> = []

  for (const [key, entry] of byFeeType) {
    const defaultAmount = entry.classAmount ?? entry.allAmount
    // A fee that has neither a class row nor an all-classes row only applies to
    // the student it was written for.
    if (defaultAmount === null && entry.studentAmount === null) continue

    const applied = entry.studentAmount ?? defaultAmount ?? 0
    const source = entry.studentAmount !== null ? 'student' : entry.classAmount !== null ? 'class' : 'all'

    lines.push({
      feeType: key,
      amount: toMoney(applied),
      defaultAmount: toMoney(defaultAmount ?? applied),
      source,
      sortOrder: entry.sortOrder,
    })
  }

  // Restore the original casing of each fee name.
  const labelByKey = new Map<string, string>()
  for (const row of options.feeConfigRows) {
    const feeType = String(row.fee_type || row.feeType || '').trim()
    if (feeType && !labelByKey.has(feeType.toLowerCase())) labelByKey.set(feeType.toLowerCase(), feeType)
  }

  const resolved = lines
    .map(line => ({ ...line, feeType: labelByKey.get(line.feeType) || line.feeType }))
    .sort((left, right) => left.sortOrder - right.sortOrder || left.feeType.localeCompare(right.feeType))

  const grossAmount = toMoney(resolved.reduce((total, line) => total + line.defaultAmount, 0))
  const netAmount = toMoney(resolved.reduce((total, line) => total + line.amount, 0))

  return {
    lines: resolved,
    grossAmount,
    netAmount,
    discountAmount: toMoney(Math.max(grossAmount - netAmount, 0)),
  }
}

async function loadFeeConfigForPeriod(db: D1Database, options: {
  tenantId: string
  sessionName: string
  termName: string
}) {
  const rows = await db.prepare(
    `SELECT * FROM fees_config WHERE tenant_id = ? ORDER BY sort_order ASC`
  ).bind(options.tenantId).all().catch(() => ({ results: [] }))

  const all = (rows.results || []) as Record<string, any>[]
  const session = options.sessionName.trim().toLowerCase()
  const term = options.termName.trim().toLowerCase()

  const exact = all.filter(row => {
    const rowSession = String(row.session || '').trim().toLowerCase()
    const rowTerm = String(row.term || '').trim().toLowerCase()
    if (rowSession !== session) return false
    return !term || !rowTerm || rowTerm === term
  })

  return exact
}

export async function getAssessmentById(db: D1Database, tenantId: string, assessmentId: string) {
  await ensureAcademicTables(db)
  const row = await db.prepare(
    `SELECT * FROM fee_assessments WHERE tenant_id = ? AND id = ?`
  ).bind(tenantId, assessmentId).first() as Record<string, any> | null
  return row ? mapAssessmentRow(row) : null
}

export async function listAssessmentLines(db: D1Database, tenantId: string, assessmentId: string) {
  await ensureAcademicTables(db)
  const rows = await db.prepare(
    `SELECT * FROM fee_assessment_lines WHERE tenant_id = ? AND assessment_id = ? ORDER BY sort_order, fee_type`
  ).bind(tenantId, assessmentId).all()
  return ((rows.results || []) as Record<string, any>[]).map(row => ({
    id: String(row.id || ''),
    feeType: String(row.fee_type || ''),
    amount: toMoney(row.amount),
    source: String(row.source || 'class'),
    sortOrder: Number(row.sort_order || 0),
  }))
}

/**
 * Open a term's fee assessments. Each student is billed against the class they
 * hold in that session's enrollment, so a promoted student is billed for their
 * new class rather than the one they have left.
 *
 * Re-running is safe: an untouched assessment is refreshed from the current
 * template, and one that already has money against it keeps what has been paid.
 */
export async function generateTermAssessments(db: D1Database, options: {
  tenantId: string
  termId: string
  studentIds?: string[]
  actorId?: string
}) {
  await ensureAcademicTables(db)

  const term = await getTermById(db, options.tenantId, options.termId)
  if (!term) throw new AcademicError('Term not found.', 404)

  const session = await getSessionById(db, options.tenantId, term.sessionId)
  if (!session) throw new AcademicError('That term is not attached to a session.', 404)

  const readRegister = () => listSessionEnrollments(db, {
    tenantId: options.tenantId,
    sessionId: session.id,
    status: 'active',
  })

  // Top the register up first: a student admitted mid-session, or a session
  // created before the register filled itself, would otherwise be billed for
  // nothing. Best effort — a roster that cannot be read must not stop the
  // school raising fees for everyone already on it.
  await autoEnrolSession(db, {
    tenantId: options.tenantId,
    sessionId: session.id,
    actorId: options.actorId,
    ensureTables: false,
  }).catch(() => null)

  const enrollments = await readRegister()
  if (!enrollments.length) {
    throw new AcademicError(`No students are enrolled in ${session.name} yet. Add the school's students, then generate fees again.`)
  }

  const targeted = options.studentIds?.length
    ? enrollments.filter(item => options.studentIds!.includes(item.studentId))
    : enrollments
  if (!targeted.length) throw new AcademicError('None of the selected students are enrolled in this session.')

  const feeConfigRows = await loadFeeConfigForPeriod(db, {
    tenantId: options.tenantId,
    sessionName: session.name,
    termName: term.name,
  })
  if (!feeConfigRows.length) {
    throw new AcademicError(`Set up the fee template for ${session.name} ${term.name} before generating assessments.`)
  }

  const existingRows = await db.prepare(
    `SELECT * FROM fee_assessments WHERE tenant_id = ? AND term_id = ? AND assessment_kind = 'term'`
  ).bind(options.tenantId, options.termId).all()
  const existingByStudent = new Map(
    ((existingRows.results || []) as Record<string, any>[]).map(row => [String(row.student_id || ''), mapAssessmentRow(row)])
  )

  const timestamp = nowIso()
  const statements: D1PreparedStatement[] = []
  let created = 0
  let updated = 0
  let skipped = 0

  for (const enrollment of targeted) {
    const resolved = resolveStudentFeeLines({
      feeConfigRows,
      classId: enrollment.classId,
      studentId: enrollment.studentId,
    })
    if (!resolved.lines.length) {
      skipped += 1
      continue
    }

    const existing = existingByStudent.get(enrollment.studentId)
    const amountPaid = existing?.amountPaid || 0

    // Never quietly reprice a term below what has already been collected.
    if (existing && amountPaid > resolved.netAmount) {
      skipped += 1
      continue
    }

    const assessmentId = existing?.id || buildAssessmentId(options.termId, enrollment.studentId, 'term')
    const status = deriveAssessmentStatus(resolved.netAmount, amountPaid, existing?.status)

    statements.push(db.prepare(
      `INSERT INTO fee_assessments (id, tenant_id, session_id, session_name, term_id, term_name, student_id, student_name, student_display_id, class_id, class_name, assessment_kind, gross_amount, discount_amount, net_amount, amount_paid, outstanding, status, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'term', ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(tenant_id, term_id, student_id, assessment_kind) DO UPDATE SET
         class_id = excluded.class_id,
         class_name = excluded.class_name,
         student_name = excluded.student_name,
         student_display_id = excluded.student_display_id,
         gross_amount = excluded.gross_amount,
         discount_amount = excluded.discount_amount,
         net_amount = excluded.net_amount,
         outstanding = excluded.outstanding,
         status = excluded.status,
         updated_at = excluded.updated_at`
    ).bind(
      assessmentId,
      options.tenantId,
      session.id,
      session.name,
      term.id,
      term.name,
      enrollment.studentId,
      enrollment.studentName || null,
      enrollment.studentDisplayId || null,
      enrollment.classId || null,
      enrollment.className || null,
      resolved.grossAmount,
      resolved.discountAmount,
      resolved.netAmount,
      amountPaid,
      toMoney(Math.max(resolved.netAmount - amountPaid, 0)),
      status,
      options.actorId || null,
      timestamp,
      timestamp,
    ))

    // Rewrite the breakdown so a changed template is reflected line by line.
    statements.push(db.prepare(
      `DELETE FROM fee_assessment_lines WHERE tenant_id = ? AND assessment_id = ?`
    ).bind(options.tenantId, assessmentId))

    resolved.lines.forEach((line, index) => {
      statements.push(db.prepare(
        `INSERT INTO fee_assessment_lines (id, tenant_id, assessment_id, fee_type, amount, source, sort_order, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        `feeline_${normalizeKeyPart(assessmentId)}_${normalizeKeyPart(line.feeType)}`,
        options.tenantId,
        assessmentId,
        line.feeType,
        line.amount,
        line.source,
        index,
        timestamp,
      ))
    })

    if (existing) updated += 1
    else created += 1
  }

  for (let index = 0; index < statements.length; index += 40) {
    await db.batch(statements.slice(index, index + 40))
  }

  return { created, updated, skipped, termName: term.name, sessionName: session.name }
}

/**
 * Everything a student still owes, oldest first, so a payment settles the
 * longest-standing debt before this term's bill.
 */
export async function listStudentOutstanding(db: D1Database, tenantId: string, studentId: string) {
  await ensureAcademicTables(db)
  const rows = await db.prepare(
    `SELECT a.* FROM fee_assessments a
     LEFT JOIN academic_terms t ON t.id = a.term_id
     WHERE a.tenant_id = ? AND a.student_id = ? AND a.outstanding > 0 AND a.status != 'waived'
     ORDER BY COALESCE(t.start_date, a.created_at) ASC`
  ).bind(tenantId, studentId).all()
  return ((rows.results || []) as Record<string, any>[]).map(mapAssessmentRow)
}

/**
 * A student's full fee position: every assessment they have ever carried, what
 * is still owed from earlier terms, and what the current term adds.
 */
export async function getStudentFinancialHistory(db: D1Database, tenantId: string, studentId: string) {
  await ensureAcademicTables(db)

  const rows = await db.prepare(
    `SELECT a.* FROM fee_assessments a
     LEFT JOIN academic_terms t ON t.id = a.term_id
     WHERE a.tenant_id = ? AND a.student_id = ?
     ORDER BY COALESCE(t.start_date, a.created_at) ASC`
  ).bind(tenantId, studentId).all()
  const assessments = ((rows.results || []) as Record<string, any>[]).map(mapAssessmentRow)

  const paymentRows = await db.prepare(
    `SELECT * FROM fee_payments WHERE tenant_id = ? AND student_id = ? ORDER BY recorded_at DESC`
  ).bind(tenantId, studentId).all()
  const payments = ((paymentRows.results || []) as Record<string, any>[]).map(mapPaymentRow)

  const allocationRows = await db.prepare(
    `SELECT al.* FROM fee_payment_allocations al
     JOIN fee_payments p ON p.id = al.payment_id
     WHERE al.tenant_id = ? AND p.student_id = ?
     ORDER BY al.created_at DESC`
  ).bind(tenantId, studentId).all()
  const allocations = ((allocationRows.results || []) as Record<string, any>[]).map(mapAllocationRow)

  const activeTerm = await getActiveTerm(db, tenantId)
  const currentAssessments = activeTerm ? assessments.filter(item => item.termId === activeTerm.id) : []
  const currentIds = new Set(currentAssessments.map(item => item.id))

  const previousOutstanding = toMoney(assessments
    .filter(item => !currentIds.has(item.id) && item.status !== 'waived')
    .reduce((total, item) => total + item.outstanding, 0))
  const currentCharges = toMoney(currentAssessments.reduce((total, item) => total + item.netAmount, 0))
  const currentOutstanding = toMoney(currentAssessments.reduce((total, item) => total + item.outstanding, 0))

  // Group by session, then term, for the statement view.
  const sessions = new Map<string, { sessionName: string, terms: Map<string, any> }>()
  for (const assessment of assessments) {
    if (!sessions.has(assessment.sessionName)) {
      sessions.set(assessment.sessionName, { sessionName: assessment.sessionName, terms: new Map() })
    }
    const bucket = sessions.get(assessment.sessionName)!
    if (!bucket.terms.has(assessment.termName)) {
      bucket.terms.set(assessment.termName, {
        termName: assessment.termName,
        assessed: 0,
        paid: 0,
        outstanding: 0,
        assessments: [] as ReturnType<typeof mapAssessmentRow>[],
      })
    }
    const termBucket = bucket.terms.get(assessment.termName)
    termBucket.assessed = toMoney(termBucket.assessed + assessment.netAmount)
    termBucket.paid = toMoney(termBucket.paid + assessment.amountPaid)
    termBucket.outstanding = toMoney(termBucket.outstanding + assessment.outstanding)
    termBucket.assessments.push(assessment)
  }

  return {
    assessments,
    payments,
    allocations,
    summary: {
      previousOutstanding,
      currentCharges,
      currentOutstanding,
      totalDue: toMoney(previousOutstanding + currentOutstanding),
      lifetimeAssessed: toMoney(assessments.reduce((total, item) => total + item.netAmount, 0)),
      lifetimePaid: toMoney(assessments.reduce((total, item) => total + item.amountPaid, 0)),
    },
    statement: Array.from(sessions.values()).map(entry => ({
      sessionName: entry.sessionName,
      terms: Array.from(entry.terms.values()),
    })),
  }
}

/**
 * Record one payment and say exactly which assessments it settled.
 *
 * Without explicit allocations the money is applied oldest debt first, so a
 * parent clearing arrears settles last term before this one. Payment, its
 * allocations and the assessment balances are written in one batch: a payment
 * can never land without the allocations that explain it.
 */
export async function recordFeePayment(db: D1Database, options: {
  tenantId: string
  studentId: string
  studentName?: string
  amount: number
  paymentType?: string
  paymentReference?: string
  note?: string
  claimId?: string
  idempotencyKey?: string
  allocations?: Array<{ assessmentId: string, amount: number }>
  recordedBy?: string
  recordedByName?: string
}) {
  await ensureAcademicTables(db)

  const amount = toMoney(options.amount)
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new AcademicError('Enter an amount greater than zero.')
  }

  // A resubmitted form must not become a second payment.
  const idempotencyKey = sanitizeText(options.idempotencyKey, 190)
  if (idempotencyKey) {
    const duplicate = await db.prepare(
      `SELECT * FROM fee_payments WHERE tenant_id = ? AND idempotency_key = ?`
    ).bind(options.tenantId, idempotencyKey).first() as Record<string, any> | null
    if (duplicate) {
      return {
        duplicate: true,
        payment: mapPaymentRow(duplicate),
        allocations: await listPaymentAllocations(db, options.tenantId, String(duplicate.id)),
      }
    }
  }

  const outstanding = await listStudentOutstanding(db, options.tenantId, options.studentId)
  const totalOutstanding = toMoney(outstanding.reduce((total, item) => total + item.outstanding, 0))

  if (totalOutstanding <= 0) {
    throw new AcademicError('This student has nothing outstanding. Generate the term assessment first.')
  }

  let plan: Array<{ assessment: ReturnType<typeof mapAssessmentRow>, amount: number }> = []

  if (options.allocations?.length) {
    const byId = new Map(outstanding.map(item => [item.id, item]))
    let requested = 0

    for (const allocation of options.allocations) {
      const assessmentId = sanitizeText(allocation?.assessmentId, 190)
      const allocated = toMoney(allocation?.amount)
      if (!assessmentId || allocated <= 0) continue

      const assessment = byId.get(assessmentId)
      if (!assessment) {
        throw new AcademicError('One of the selected charges is already settled or does not belong to this student.', 404)
      }
      if (allocated > assessment.outstanding) {
        throw new AcademicError(
          `${assessment.sessionName} ${assessment.termName} only has ${assessment.outstanding} outstanding.`
        )
      }
      requested = toMoney(requested + allocated)
      plan.push({ assessment, amount: allocated })
    }

    if (!plan.length) throw new AcademicError('Choose at least one charge for this payment to settle.')
    if (requested !== amount) {
      throw new AcademicError(`The allocations add up to ${requested}, which does not match the ${amount} being paid.`)
    }
  } else {
    if (amount > totalOutstanding) {
      throw new AcademicError(
        `This student owes ${totalOutstanding}. Reduce the amount, or allocate the payment across specific charges.`
      )
    }
    // Oldest debt first.
    let remaining = amount
    for (const assessment of outstanding) {
      if (remaining <= 0) break
      const applied = toMoney(Math.min(remaining, assessment.outstanding))
      if (applied <= 0) continue
      plan.push({ assessment, amount: applied })
      remaining = toMoney(remaining - applied)
    }
    if (remaining > 0) {
      throw new AcademicError('Could not allocate the full payment against the outstanding charges.')
    }
  }

  const timestamp = nowIso()
  const paymentId = `feepay_${normalizeKeyPart(options.tenantId)}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

  const statements: D1PreparedStatement[] = [
    db.prepare(
      `INSERT INTO fee_payments (id, tenant_id, student_id, student_name, amount, payment_type, payment_reference, idempotency_key, note, claim_id, recorded_by, recorded_by_name, recorded_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      paymentId,
      options.tenantId,
      options.studentId,
      sanitizeText(options.studentName, 200) || null,
      amount,
      sanitizeText(options.paymentType, 40) || 'cash',
      sanitizeText(options.paymentReference, 190) || null,
      idempotencyKey || null,
      sanitizeText(options.note, 1000) || null,
      sanitizeText(options.claimId, 190) || null,
      sanitizeText(options.recordedBy, 190) || null,
      sanitizeText(options.recordedByName, 200) || null,
      timestamp,
      timestamp,
    ),
  ]

  for (const entry of plan) {
    const nextPaid = toMoney(entry.assessment.amountPaid + entry.amount)
    const nextOutstanding = toMoney(Math.max(entry.assessment.netAmount - nextPaid, 0))

    statements.push(db.prepare(
      `INSERT INTO fee_payment_allocations (id, tenant_id, payment_id, assessment_id, session_name, term_name, amount, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      `feealloc_${normalizeKeyPart(paymentId)}_${normalizeKeyPart(entry.assessment.id)}`,
      options.tenantId,
      paymentId,
      entry.assessment.id,
      entry.assessment.sessionName,
      entry.assessment.termName,
      entry.amount,
      timestamp,
    ))

    // Guarded on the balance we read, so two concurrent payments cannot both
    // apply against the same outstanding figure.
    statements.push(db.prepare(
      `UPDATE fee_assessments
       SET amount_paid = ?, outstanding = ?, status = ?, updated_at = ?
       WHERE tenant_id = ? AND id = ? AND amount_paid = ?`
    ).bind(
      nextPaid,
      nextOutstanding,
      deriveAssessmentStatus(entry.assessment.netAmount, nextPaid, entry.assessment.status),
      timestamp,
      options.tenantId,
      entry.assessment.id,
      entry.assessment.amountPaid,
    ))
  }

  const results = await db.batch(statements)

  // If the guarded update matched nothing, another payment landed first.
  const assessmentUpdates = results.slice(1).filter((_result, index) => index % 2 === 1)
  const stale = assessmentUpdates.some(result => Number((result as any)?.meta?.changes ?? 1) === 0)
  if (stale) {
    throw new AcademicError('Another payment was recorded for this student a moment ago. Reload and try again.', 409)
  }

  return {
    duplicate: false,
    payment: {
      id: paymentId,
      studentId: options.studentId,
      studentName: sanitizeText(options.studentName, 200),
      amount,
      paymentType: sanitizeText(options.paymentType, 40) || 'cash',
      paymentReference: sanitizeText(options.paymentReference, 190),
      note: sanitizeText(options.note, 1000),
      claimId: sanitizeText(options.claimId, 190),
      receiptId: '',
      receiptNo: '',
      recordedBy: sanitizeText(options.recordedBy, 190),
      recordedByName: sanitizeText(options.recordedByName, 200),
      recordedAt: timestamp,
    },
    allocations: plan.map(entry => ({
      assessmentId: entry.assessment.id,
      sessionName: entry.assessment.sessionName,
      termName: entry.assessment.termName,
      assessmentKind: entry.assessment.assessmentKind,
      amount: entry.amount,
      outstandingAfter: toMoney(Math.max(entry.assessment.netAmount - entry.assessment.amountPaid - entry.amount, 0)),
    })),
  }
}

export async function listPaymentAllocations(db: D1Database, tenantId: string, paymentId: string) {
  await ensureAcademicTables(db)
  const rows = await db.prepare(
    `SELECT * FROM fee_payment_allocations WHERE tenant_id = ? AND payment_id = ?`
  ).bind(tenantId, paymentId).all()
  return ((rows.results || []) as Record<string, any>[]).map(mapAllocationRow)
}

/** Attach an issued receipt to the payment it documents. */
export async function attachReceiptToPayment(db: D1Database, options: {
  tenantId: string
  paymentId: string
  receiptId: string
  receiptNo: string
}) {
  await ensureAcademicTables(db)
  await db.prepare(
    `UPDATE fee_payments SET receipt_id = ?, receipt_no = ? WHERE tenant_id = ? AND id = ?`
  ).bind(options.receiptId, options.receiptNo, options.tenantId, options.paymentId).run()
}

/**
 * The fees board: what this term charged and collected, alongside what is still
 * owed from earlier terms and how much of it has been recovered.
 */
export async function getFeeDashboard(db: D1Database, options: {
  tenantId: string
  termId?: string
  classId?: string
  status?: string
}) {
  await ensureAcademicTables(db)

  const term = options.termId
    ? await getTermById(db, options.tenantId, options.termId)
    : await getActiveTerm(db, options.tenantId)

  const filters = ['tenant_id = ?']
  const bindings: unknown[] = [options.tenantId]

  if (term) {
    filters.push('term_id = ?')
    bindings.push(term.id)
  }
  if (options.classId) {
    filters.push('class_id = ?')
    bindings.push(options.classId)
  }
  if (options.status) {
    filters.push('status = ?')
    bindings.push(options.status)
  }

  const currentRows = await db.prepare(
    `SELECT * FROM fee_assessments WHERE ${filters.join(' AND ')} ORDER BY class_name, student_name`
  ).bind(...bindings).all()
  const current = ((currentRows.results || []) as Record<string, any>[]).map(mapAssessmentRow)

  // Everything owed from any term other than the one in view.
  const priorRows = term
    ? await db.prepare(
        `SELECT * FROM fee_assessments WHERE tenant_id = ? AND term_id != ? ORDER BY session_name, term_name`
      ).bind(options.tenantId, term.id).all()
    : { results: [] }
  const prior = ((priorRows.results || []) as Record<string, any>[]).map(mapAssessmentRow)

  const sum = (rows: ReturnType<typeof mapAssessmentRow>[], key: 'netAmount' | 'amountPaid' | 'outstanding') =>
    toMoney(rows.reduce((total, row) => total + row[key], 0))

  return {
    term,
    assessments: current,
    currentTerm: {
      assessed: sum(current, 'netAmount'),
      collected: sum(current, 'amountPaid'),
      outstanding: sum(current, 'outstanding'),
      studentCount: current.length,
    },
    previousOutstanding: {
      carriedForward: sum(prior, 'netAmount'),
      recovered: sum(prior, 'amountPaid'),
      remaining: sum(prior, 'outstanding'),
    },
  }
}

// ─── Migration from the single running ledger ────────────────────────────────

/**
 * Bring the pre-session-engine balances across as one opening-balance assessment
 * per student on the term the school nominates.
 *
 * The old fees_ledger held a lifetime paid figure against a current-term charge,
 * so those two numbers cannot be split back into per-term history. Only the
 * arrears they imply are carried over, and fees_ledger itself is left untouched
 * as the record of what came before.
 */
export async function backfillOpeningBalances(db: D1Database, options: {
  tenantId: string
  termId: string
  actorId?: string
  dryRun?: boolean
}) {
  await ensureAcademicTables(db)

  const term = await getTermById(db, options.tenantId, options.termId)
  if (!term) throw new AcademicError('Term not found.', 404)
  const session = await getSessionById(db, options.tenantId, term.sessionId)
  if (!session) throw new AcademicError('That term is not attached to a session.', 404)

  const ledgerRows = await db.prepare(
    `SELECT * FROM fees_ledger WHERE tenant_id = ?`
  ).bind(options.tenantId).all().catch(() => ({ results: [] }))

  const timestamp = nowIso()
  const statements: D1PreparedStatement[] = []
  const carried: Array<{ studentId: string, studentName: string, amount: number }> = []
  let skipped = 0

  for (const row of ((ledgerRows.results || []) as Record<string, any>[])) {
    const studentId = String(row.student_id || '').trim()
    if (!studentId) continue

    const arrears = toMoney(Math.max(toMoney(row.fee_amount) - toMoney(row.amount_paid), 0))
    if (arrears <= 0) {
      skipped += 1
      continue
    }

    const existing = await db.prepare(
      `SELECT id FROM fee_assessments WHERE tenant_id = ? AND student_id = ? AND assessment_kind = 'opening_balance'`
    ).bind(options.tenantId, studentId).first()
    if (existing) {
      skipped += 1
      continue
    }

    const studentName = String(row.student_name || studentId)
    carried.push({ studentId, studentName, amount: arrears })

    if (options.dryRun) continue

    const assessmentId = buildAssessmentId(options.termId, studentId, 'opening_balance')
    statements.push(db.prepare(
      `INSERT INTO fee_assessments (id, tenant_id, session_id, session_name, term_id, term_name, student_id, student_name, student_display_id, class_id, class_name, assessment_kind, gross_amount, discount_amount, net_amount, amount_paid, outstanding, status, notes, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'opening_balance', ?, 0, ?, 0, ?, 'unpaid', ?, ?, ?, ?)`
    ).bind(
      assessmentId,
      options.tenantId,
      session.id,
      session.name,
      term.id,
      term.name,
      studentId,
      studentName,
      String(row.student_display_id || '') || null,
      String(row.class_id || '') || null,
      String(row.class_name || '') || null,
      arrears,
      arrears,
      arrears,
      'Balance brought forward from the fee records kept before termly assessments.',
      options.actorId || null,
      timestamp,
      timestamp,
    ))

    statements.push(db.prepare(
      `INSERT INTO fee_assessment_lines (id, tenant_id, assessment_id, fee_type, amount, source, sort_order, created_at)
       VALUES (?, ?, ?, 'Balance brought forward', ?, 'opening_balance', 0, ?)`
    ).bind(
      `feeline_${normalizeKeyPart(assessmentId)}_opening`,
      options.tenantId,
      assessmentId,
      arrears,
      timestamp,
    ))
  }

  if (!options.dryRun) {
    for (let index = 0; index < statements.length; index += 40) {
      await db.batch(statements.slice(index, index + 40))
    }
  }

  return {
    dryRun: Boolean(options.dryRun),
    carriedCount: carried.length,
    carriedTotal: toMoney(carried.reduce((total, entry) => total + entry.amount, 0)),
    skipped,
    students: carried,
    termName: term.name,
    sessionName: session.name,
  }
}

// ─── Scheduled transitions ───────────────────────────────────────────────────

/**
 * Move terms and sessions on when their configured dates arrive. Driven by the
 * Worker cron rather than by anyone having a page open, and only for the terms
 * and sessions whose owners ticked the automatic option.
 */
export async function runScheduledAcademicTransitions(db: D1Database, options: { today?: string } = {}) {
  // Deliberately no ensureAcademicTables: this runs on the every-minute cron, and
  // paying for the whole schema there exceeded the CPU budget. Transitions turn on
  // calendar dates, so the queries simply tolerate the tables not existing yet.
  const today = options.today || lagosToday()
  const transitions: Array<Record<string, any>> = []

  // A term whose end date has passed hands over to the next term in its session.
  const endedTerms = await db.prepare(
    `SELECT * FROM academic_terms WHERE status = 'active' AND end_date < ?`
  ).bind(today).all().catch(() => ({ results: [] }))

  for (const row of ((endedTerms.results || []) as Record<string, any>[])) {
    const term = mapTermRow(row)
    const tenantId = String(row.tenant_id || '')
    if (!tenantId) continue

    const nextRow = await db.prepare(
      `SELECT * FROM academic_terms
       WHERE tenant_id = ? AND session_id = ? AND sequence > ?
       ORDER BY sequence ASC LIMIT 1`
    ).bind(tenantId, term.sessionId, term.sequence).first() as Record<string, any> | null

    if (nextRow) {
      const next = mapTermRow(nextRow)
      if (!next.autoActivate) continue
      if (next.startDate > today) {
        // The break between the two terms is still running; just close the old one.
        await closeTerm(db, { tenantId, termId: term.id }).catch(() => null)
        transitions.push({ tenantId, kind: 'term-closed', termName: term.name })
        continue
      }
      await activateTerm(db, { tenantId, termId: next.id }).catch(() => null)
      transitions.push({ tenantId, kind: 'term-activated', from: term.name, to: next.name })
      continue
    }

    // No later term: the session's teaching year is over.
    await closeTerm(db, { tenantId, termId: term.id }).catch(() => null)
    transitions.push({ tenantId, kind: 'session-teaching-complete', termName: term.name })
  }

  // A session scheduled to start takes over from whatever is running.
  const dueSessions = await db.prepare(
    `SELECT * FROM academic_sessions
     WHERE status = 'upcoming' AND auto_activate = 1 AND COALESCE(NULLIF(resumption_date, ''), start_date) <= ?`
  ).bind(today).all().catch(() => ({ results: [] }))

  for (const row of ((dueSessions.results || []) as Record<string, any>[])) {
    const session = mapSessionRow(row)
    const tenantId = String(row.tenant_id || '')
    if (!tenantId) continue

    // A session nobody has been enrolled into would open on an empty register, so
    // fill it from the roster first. Only a school with no students left to
    // enrol is skipped.
    const enrolled = await db.prepare(
      `SELECT COUNT(*) AS n FROM session_enrollments WHERE tenant_id = ? AND session_id = ?`
    ).bind(tenantId, session.id).first() as Record<string, any> | null
    if (Number(enrolled?.n || 0) === 0) {
      const seeded = await autoEnrolSession(db, { tenantId, sessionId: session.id, ensureTables: false }).catch(() => null)
      if (!seeded?.enrolled) {
        transitions.push({ tenantId, kind: 'session-activation-skipped', sessionName: session.name, reason: 'no students to enrol' })
        continue
      }
      transitions.push({
        tenantId,
        kind: 'session-auto-enrolled',
        sessionName: session.name,
        enrolled: seeded.enrolled,
        promoted: seeded.promoted,
        graduated: seeded.graduated,
      })
    }

    const result = await activateSession(db, { tenantId, sessionId: session.id }).catch(() => null)
    if (result) {
      await syncMirrorToSession(db, { tenantId, sessionId: session.id }).catch(() => null)
      transitions.push({ tenantId, kind: 'session-activated', sessionName: session.name })
    }
  }

  return { today, transitions }
}

/**
 * Where the school is in its calendar right now: the running term, or the break
 * it is on and when it resumes.
 */
export async function getCalendarPosition(db: D1Database, tenantId: string, today = lagosToday()) {
  await ensureAcademicTables(db)

  const session = await getActiveSession(db, tenantId)
  if (!session) return { state: 'unconfigured', today }

  const term = await getActiveTerm(db, tenantId)
  if (term && term.startDate <= today && today <= term.endDate) {
    return { state: 'in-term', today, session, term }
  }

  const breaks = await listBreaks(db, tenantId, session.id)
  const current = breaks.find(item => item.startDate <= today && today <= item.endDate)
  if (current) {
    return { state: 'on-break', today, session, term, currentBreak: current }
  }

  const upcoming = await db.prepare(
    `SELECT * FROM academic_terms WHERE tenant_id = ? AND session_id = ? AND start_date > ? ORDER BY start_date ASC LIMIT 1`
  ).bind(tenantId, session.id, today).first() as Record<string, any> | null

  return {
    state: term ? 'between-terms' : 'session-open',
    today,
    session,
    term,
    nextTerm: upcoming ? mapTermRow(upcoming) : null,
  }
}
