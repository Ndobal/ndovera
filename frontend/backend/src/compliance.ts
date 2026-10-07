// Teacher Submissions & Compliance.
//
// The school defines a rule once ("Lesson Notes, Secondary teachers, weekly,
// Friday 4:00 PM") and Ndovera works out every period from it — nobody creates
// "Lesson Notes Week 1, Week 2…". Status is computed from the evidence Ndovera
// already holds, so teachers never do the same work twice:
//
//   Register       → the class teacher's attendance register for each school day
//   Lesson notes   → lesson-note submissions, one per subject and class taught
//   Exam questions → exam-question submissions, one per subject and class taught
//   Class report   → the weekly class report questionnaire
//   Diary / custom → verified by a Head, or evidence uploaded where enabled
//
// Work done outside Ndovera is confirmed by an authorised Head (manual
// verification), and partial completion is shown exactly: "7/9 — missing:
// Basic Science JSS 2". Fines are calculated and proposed, never charged: a
// Head or the Owner approves, waives or adjusts each one, with the reason kept.
// Every manual change is written to an append-only audit.

export const COMPLIANCE_KINDS = ['register', 'diary', 'lesson_notes', 'exam_questions', 'ca_scores', 'class_report', 'custom'] as const
export type ComplianceKind = typeof COMPLIANCE_KINDS[number]
export const KIND_LABELS: Record<ComplianceKind, string> = {
  register: 'Register', diary: 'Diary', lesson_notes: 'Lesson Notes', exam_questions: 'Exam Questions', ca_scores: 'C.A. Scores', class_report: 'Class Report', custom: 'Other',
}
export const FREQUENCIES = ['weekly', 'monthly', 'termly', 'once', 'custom'] as const
export type Frequency = typeof FREQUENCIES[number]
export const SECTIONS = ['nursery', 'primary', 'secondary'] as const
export type Section = typeof SECTIONS[number]

/** Which leadership roles oversee which section, unless the school says otherwise. */
export const DEFAULT_SECTION_HEADS: Record<Section, string[]> = {
  nursery: ['nurseryhead'],
  primary: ['headteacher'],
  secondary: ['principal', 'viceprincipal'],
}
export const SCHOOL_WIDE_ROLES = ['owner', 'hos']

export class ComplianceError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

export type Rule = {
  id: string
  name: string
  kind: ComplianceKind
  appliesTo: Array<Section | 'all'>
  frequency: Frequency
  intervalDays: number
  dueWeekday: number
  dueDayOfMonth: number
  dueTime: string
  dueDate: string
  method: 'ndovera' | 'manual' | 'either'
  approvalRequired: boolean
  lateAllowed: boolean
  fineAmount: number
  graceHours: number
  startsOn: string
  endsOn: string
  evidenceUpload: boolean
  // C.A. Scores only: which C.A. component is due ('all' for every one).
  caComponent: string
  active: boolean
  createdAt: string
  updatedAt: string
}

let _ready = false
export function resetComplianceCache() {
  _ready = false
}

export async function ensureComplianceTables(db: D1Database) {
  if (_ready) return
  const statements = [
    `CREATE TABLE IF NOT EXISTS compliance_rules (
      id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, name TEXT NOT NULL, kind TEXT NOT NULL, applies_to_json TEXT,
      frequency TEXT NOT NULL, interval_days INTEGER, due_weekday INTEGER, due_day_of_month INTEGER, due_time TEXT, due_date TEXT,
      method TEXT, approval_required INTEGER, late_allowed INTEGER, fine_amount REAL, grace_hours INTEGER,
      starts_on TEXT, ends_on TEXT, evidence_upload INTEGER, active INTEGER NOT NULL DEFAULT 1,
      created_by TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
    // Latest row per unit wins; earlier rows are the history.
    `CREATE TABLE IF NOT EXISTS compliance_verifications (
      id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, rule_id TEXT NOT NULL, period_key TEXT NOT NULL, teacher_id TEXT NOT NULL, unit_key TEXT NOT NULL,
      status TEXT NOT NULL, source TEXT NOT NULL, note TEXT, files_json TEXT, on_behalf INTEGER NOT NULL DEFAULT 0,
      actor_id TEXT, actor_name TEXT, actor_role TEXT, created_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS compliance_fines (
      tenant_id TEXT NOT NULL, rule_id TEXT NOT NULL, period_key TEXT NOT NULL, teacher_id TEXT NOT NULL,
      decision TEXT NOT NULL, amount REAL NOT NULL, reason TEXT, actor_id TEXT, actor_name TEXT, decided_at TEXT NOT NULL,
      PRIMARY KEY (tenant_id, rule_id, period_key, teacher_id))`,
    `CREATE TABLE IF NOT EXISTS compliance_audit (
      id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, teacher_id TEXT, rule_id TEXT, period_key TEXT, unit_key TEXT,
      action TEXT NOT NULL, before_value TEXT, after_value TEXT, reason TEXT, actor_id TEXT, actor_name TEXT, actor_role TEXT, created_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS compliance_settings (
      tenant_id TEXT PRIMARY KEY, settings_json TEXT NOT NULL, updated_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS class_report_templates (
      tenant_id TEXT PRIMARY KEY, questions_json TEXT NOT NULL, updated_by TEXT, updated_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS class_reports (
      id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, period_key TEXT NOT NULL, period_label TEXT, class_id TEXT NOT NULL, class_name TEXT,
      teacher_id TEXT NOT NULL, teacher_name TEXT, questions_json TEXT, answers_json TEXT, ai_summary TEXT, summary TEXT,
      status TEXT NOT NULL, submitted_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      UNIQUE (tenant_id, period_key, class_id, teacher_id))`,
    `CREATE INDEX IF NOT EXISTS idx_compliance_verifications ON compliance_verifications(tenant_id, rule_id, period_key, teacher_id)`,
    `CREATE INDEX IF NOT EXISTS idx_compliance_audit ON compliance_audit(tenant_id, teacher_id, created_at)`,
  ]
  for (const statement of statements) await db.prepare(statement).run()
  try { await db.exec('ALTER TABLE compliance_rules ADD COLUMN ca_component TEXT') } catch {}
  _ready = true
}

const parse = <T>(value: unknown, fallback: T): T => {
  try { return value ? JSON.parse(String(value)) as T : fallback } catch { return fallback }
}
const normId = (value: unknown) => String(value || '').trim().toLowerCase()

// ─── Rules ────────────────────────────────────────────────────────────────────

function mapRule(row: Record<string, any>): Rule {
  return {
    id: String(row.id), name: String(row.name), kind: row.kind as ComplianceKind,
    appliesTo: parse(row.applies_to_json, ['all']),
    frequency: row.frequency as Frequency, intervalDays: Number(row.interval_days || 7),
    dueWeekday: Number(row.due_weekday ?? 5), dueDayOfMonth: Number(row.due_day_of_month || 28), dueTime: String(row.due_time || '16:00'),
    dueDate: String(row.due_date || ''), method: (row.method || 'either') as Rule['method'],
    approvalRequired: Boolean(row.approval_required), lateAllowed: row.late_allowed == null ? true : Boolean(row.late_allowed),
    fineAmount: Number(row.fine_amount || 0), graceHours: Number(row.grace_hours || 0),
    startsOn: String(row.starts_on || ''), endsOn: String(row.ends_on || ''), evidenceUpload: Boolean(row.evidence_upload),
    caComponent: String(row.ca_component || 'all'),
    active: Boolean(row.active), createdAt: row.created_at, updatedAt: row.updated_at,
  }
}

const isDate = (value: unknown) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))

export function normalizeRuleInput(input: Record<string, any>, current?: Rule): Omit<Rule, 'id' | 'createdAt' | 'updatedAt' | 'active'> {
  const pick = <K extends keyof Rule>(key: K, fallback: Rule[K]) => (input[key] !== undefined ? input[key] : (current ? current[key] : fallback))
  const name = String(pick('name', '') || '').trim().slice(0, 120)
  if (!name) throw new ComplianceError('Give the requirement a name, for example "Lesson Notes".')
  const kind = String(pick('kind', 'custom'))
  if (!COMPLIANCE_KINDS.includes(kind as ComplianceKind)) throw new ComplianceError('Choose what is being submitted.')
  const frequency = String(pick('frequency', 'weekly'))
  if (!FREQUENCIES.includes(frequency as Frequency)) throw new ComplianceError('Choose how often it is due.')
  const appliesRaw = pick('appliesTo', ['all'])
  const appliesTo = (Array.isArray(appliesRaw) ? appliesRaw : [appliesRaw]).map(item => String(item || '').toLowerCase())
    .filter(item => item === 'all' || SECTIONS.includes(item as Section)) as Rule['appliesTo']
  const dueTime = String(pick('dueTime', '16:00') || '16:00')
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(dueTime)) throw new ComplianceError('Give the due time as HH:MM, for example 16:00.')
  const dueDate = String(pick('dueDate', '') || '')
  if (frequency === 'once' && !isDate(dueDate)) throw new ComplianceError('Choose the deadline date for a one-time submission.')
  const startsOn = String(pick('startsOn', '') || '')
  const endsOn = String(pick('endsOn', '') || '')
  if (startsOn && !isDate(startsOn)) throw new ComplianceError('Give the start date as a date.')
  if (endsOn && !isDate(endsOn)) throw new ComplianceError('Give the end date as a date.')
  if (startsOn && endsOn && endsOn < startsOn) throw new ComplianceError('The end date is before the start date.')
  const method = String(pick('method', 'either'))
  return {
    name, kind: kind as ComplianceKind, appliesTo: appliesTo.length ? appliesTo : ['all'],
    frequency: frequency as Frequency,
    intervalDays: Math.min(366, Math.max(1, Math.round(Number(pick('intervalDays', 7)) || 7))),
    dueWeekday: Math.min(6, Math.max(0, Math.round(Number(pick('dueWeekday', 5)) || 0))),
    dueDayOfMonth: Math.min(31, Math.max(1, Math.round(Number(pick('dueDayOfMonth', 28)) || 28))),
    dueTime, dueDate,
    method: (['ndovera', 'manual', 'either'].includes(method) ? method : 'either') as Rule['method'],
    approvalRequired: Boolean(pick('approvalRequired', false)),
    lateAllowed: Boolean(pick('lateAllowed', true)),
    fineAmount: Math.max(0, Math.min(10_000_000, Number(pick('fineAmount', 0)) || 0)),
    graceHours: Math.max(0, Math.min(24 * 30, Math.round(Number(pick('graceHours', 0)) || 0))),
    startsOn, endsOn,
    evidenceUpload: Boolean(pick('evidenceUpload', false)),
    caComponent: String(pick('caComponent', 'all') || 'all').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'all',
  }
}

export async function listRules(db: D1Database, tenantId: string, { includeInactive = false } = {}) {
  await ensureComplianceTables(db)
  const rows = await db.prepare(`SELECT * FROM compliance_rules WHERE tenant_id = ? ${includeInactive ? '' : 'AND active = 1'} ORDER BY created_at`).bind(tenantId).all()
  return ((rows.results || []) as Record<string, any>[]).map(mapRule)
}

export async function getRule(db: D1Database, tenantId: string, id: string) {
  await ensureComplianceTables(db)
  const row = await db.prepare(`SELECT * FROM compliance_rules WHERE id = ? AND tenant_id = ?`).bind(id, tenantId).first() as Record<string, any> | null
  return row ? mapRule(row) : null
}

export async function saveRule(db: D1Database, options: { tenantId: string, id?: string, input: Record<string, any>, actor: Actor }) {
  await ensureComplianceTables(db)
  const current = options.id ? await getRule(db, options.tenantId, options.id) : null
  if (options.id && !current) throw new ComplianceError('Requirement not found.', 404)
  const rule = normalizeRuleInput(options.input, current || undefined)
  const now = new Date().toISOString()
  const id = current?.id || `crule-${crypto.randomUUID()}`
  const values = [rule.name, rule.kind, JSON.stringify(rule.appliesTo), rule.frequency, rule.intervalDays, rule.dueWeekday, rule.dueDayOfMonth, rule.dueTime, rule.dueDate || null,
    rule.method, rule.approvalRequired ? 1 : 0, rule.lateAllowed ? 1 : 0, rule.fineAmount, rule.graceHours, rule.startsOn || null, rule.endsOn || null, rule.evidenceUpload ? 1 : 0, rule.caComponent]
  if (current) {
    await db.prepare(`UPDATE compliance_rules SET name = ?, kind = ?, applies_to_json = ?, frequency = ?, interval_days = ?, due_weekday = ?, due_day_of_month = ?, due_time = ?, due_date = ?,
      method = ?, approval_required = ?, late_allowed = ?, fine_amount = ?, grace_hours = ?, starts_on = ?, ends_on = ?, evidence_upload = ?, ca_component = ?, updated_at = ? WHERE id = ? AND tenant_id = ?`)
      .bind(...values, now, id, options.tenantId).run()
  } else {
    await db.prepare(`INSERT INTO compliance_rules (name, kind, applies_to_json, frequency, interval_days, due_weekday, due_day_of_month, due_time, due_date,
      method, approval_required, late_allowed, fine_amount, grace_hours, starts_on, ends_on, evidence_upload, ca_component, id, tenant_id, active, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`)
      .bind(...values, id, options.tenantId, options.actor.id, now, now).run()
  }
  await recordAudit(db, { tenantId: options.tenantId, ruleId: id, action: current ? 'rule_updated' : 'rule_created', actor: options.actor, before: current, after: rule })
  return (await getRule(db, options.tenantId, id))!
}

export async function setRuleActive(db: D1Database, options: { tenantId: string, id: string, active: boolean, actor: Actor }) {
  const current = await getRule(db, options.tenantId, options.id)
  if (!current) throw new ComplianceError('Requirement not found.', 404)
  await db.prepare(`UPDATE compliance_rules SET active = ?, updated_at = ? WHERE id = ? AND tenant_id = ?`).bind(options.active ? 1 : 0, new Date().toISOString(), options.id, options.tenantId).run()
  await recordAudit(db, { tenantId: options.tenantId, ruleId: options.id, action: options.active ? 'rule_reactivated' : 'rule_stopped', actor: options.actor })
}

// ─── Settings: which roles oversee which section ────────────────────────────

export async function getComplianceSettings(db: D1Database, tenantId: string) {
  await ensureComplianceTables(db)
  const row = await db.prepare(`SELECT settings_json FROM compliance_settings WHERE tenant_id = ?`).bind(tenantId).first() as Record<string, any> | null
  const stored = parse(row?.settings_json, {} as Record<string, any>)
  const sectionHeads = { ...DEFAULT_SECTION_HEADS }
  for (const section of SECTIONS) {
    const roles = stored.sectionHeads?.[section]
    if (Array.isArray(roles)) sectionHeads[section] = roles.map(normId).filter(Boolean)
  }
  return { sectionHeads }
}

export async function saveComplianceSettings(db: D1Database, tenantId: string, input: Record<string, any>, actor: Actor) {
  const before = await getComplianceSettings(db, tenantId)
  const sectionHeads = { ...before.sectionHeads }
  for (const section of SECTIONS) {
    const roles = input.sectionHeads?.[section]
    if (Array.isArray(roles)) sectionHeads[section] = roles.map(normId).filter(role => role && !['student', 'parent'].includes(role))
  }
  await db.prepare(`INSERT INTO compliance_settings (tenant_id, settings_json, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(tenant_id) DO UPDATE SET settings_json = excluded.settings_json, updated_at = excluded.updated_at`)
    .bind(tenantId, JSON.stringify({ sectionHeads }), new Date().toISOString()).run()
  await recordAudit(db, { tenantId, action: 'settings_updated', actor, before, after: { sectionHeads } })
  return { sectionHeads }
}

/** Which sections a viewer oversees: everything for Owner/HOS, their own sections for section heads. */
export function viewerSections(roles: string[], settings: { sectionHeads: Record<Section, string[]> }): Section[] | 'all' {
  const mine = roles.map(normId)
  if (mine.some(role => SCHOOL_WIDE_ROLES.includes(role))) return 'all'
  return SECTIONS.filter(section => settings.sectionHeads[section].some(role => mine.includes(role)))
}

// ─── Periods ──────────────────────────────────────────────────────────────────

export type Period = { key: string, label: string, start: string, end: string, dueAt: string, weekNumber: number | null }

// No rule ever needs more than this many periods (about ten years of weeks); it
// keeps a rule with no end date and no term dates from running away.
const MAX_PERIODS = 520

/** Lagos has no daylight saving: every local time is UTC+01:00. */
export function lagosInstant(date: string, time = '00:00') {
  return new Date(`${date}T${time}:00+01:00`).toISOString()
}
export function lagosDate(instant: string | Date = new Date()) {
  return new Date(new Date(instant).getTime() + 3600_000).toISOString().slice(0, 10)
}
function addDays(date: string, days: number) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10)
}
function weekday(date: string) {
  return new Date(`${date}T00:00:00Z`).getUTCDay()
}
function mondayOf(date: string) {
  return addDays(date, -((weekday(date) + 6) % 7))
}
function lastDayOfMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
}

/**
 * Every period of a rule that has started by `until`, within the rule's dates
 * and the term. Weekly periods run Monday–Sunday and are numbered by term week.
 */
export function rulePeriods(rule: Rule, term: { id?: string, startDate: string, endDate: string }, until: string): Period[] {
  const termStart = term.startDate || rule.startsOn || until
  const termEnd = term.endDate || '9999-12-31'
  const from = rule.startsOn && rule.startsOn > termStart ? rule.startsOn : termStart
  const to = [rule.endsOn || '9999-12-31', termEnd].sort()[0]
  const periods: Period[] = []
  const termWeekOne = mondayOf(termStart)
  const push = (period: Omit<Period, 'weekNumber'> & { weekNumber?: number | null }) => {
    if (period.start > until || period.start > to || period.end < from) return
    periods.push({ weekNumber: null, ...period })
  }

  if (rule.frequency === 'once') {
    const due = rule.dueDate || to
    push({ key: `once:${due}`, label: rule.name, start: rule.startsOn || termStart, end: due, dueAt: lagosInstant(due, rule.dueTime) })
  } else if (rule.frequency === 'termly') {
    const due = rule.dueDate && rule.dueDate >= termStart && rule.dueDate <= termEnd ? rule.dueDate : termEnd
    push({ key: `term:${term.id || termStart}`, label: 'This term', start: termStart, end: termEnd, dueAt: lagosInstant(due, rule.dueTime) })
  } else if (rule.frequency === 'monthly') {
    for (let cursor = from.slice(0, 7), guard = 0; `${cursor}-01` <= to && `${cursor}-01` <= until && guard < MAX_PERIODS; guard += 1) {
      const [year, month] = cursor.split('-').map(Number)
      const last = lastDayOfMonth(year, month - 1)
      const due = `${cursor}-${String(Math.min(rule.dueDayOfMonth, last)).padStart(2, '0')}`
      push({ key: `month:${cursor}`, label: new Date(`${cursor}-01T00:00:00Z`).toLocaleString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }), start: `${cursor}-01`, end: `${cursor}-${String(last).padStart(2, '0')}`, dueAt: lagosInstant(due, rule.dueTime) })
      cursor = month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, '0')}`
    }
  } else if (rule.frequency === 'custom') {
    for (let start = from, index = 1; start <= to && start <= until && index <= MAX_PERIODS; index += 1) {
      const end = addDays(start, rule.intervalDays - 1)
      push({ key: `every:${start}`, label: `${start} – ${end}`, start, end, dueAt: lagosInstant(end, rule.dueTime) })
      start = addDays(start, rule.intervalDays)
    }
  } else {
    for (let start = mondayOf(from), guard = 0; start <= to && start <= until && guard < MAX_PERIODS; start = addDays(start, 7), guard += 1) {
      const weekNumber = Math.floor((Date.parse(start) - Date.parse(termWeekOne)) / (7 * 86400000)) + 1
      const due = addDays(start, (rule.dueWeekday + 6) % 7)
      push({ key: `week:${start}`, label: `Week ${weekNumber}`, start, end: addDays(start, 6), dueAt: lagosInstant(due, rule.dueTime), weekNumber })
    }
  }
  return periods
}

/** The period of a rule that a date falls in (or, for one-off deadlines, the one still open). */
export function periodAt(rule: Rule, term: { id?: string, startDate: string, endDate: string }, date: string) {
  const periods = rulePeriods(rule, term, date)
  return periods.find(period => period.start <= date && date <= period.end) || null
}

// ─── Evidence → units → status ───────────────────────────────────────────────

export type Actor = { id: string, name: string, role: string }
export type StaffPerson = { id: string, email: string, name: string, roles: string[] }
export type Assignment = { role: string, classId: string, className: string, subjectId: string, subjectName: string, teacherId: string }
export type Evidence = {
  // class id → date → latest recording time
  register: Map<string, Map<string, string>>
  submissions: Array<{ teacherId: string, classId: string, subjectId: string, type: string, status: string, weekNumber: number | null, firstSubmittedAt: string | null, approvedAt: string | null, termId: string }>
  classReports: Array<{ teacherId: string, classId: string, periodKey: string, status: string, submittedAt: string | null }>
  // C.A. scores handed in this term, and the school's C.A. components (for "all of them").
  caSubmissions?: Array<{ classId: string, subjectId: string, componentKey: string, status: string, submittedAt: string | null }>
  caComponentKeys?: string[]
  // latest verification per rule|period|teacher|unit
  verifications: Map<string, Record<string, any>>
  fines: Map<string, Record<string, any>>
}

export type Unit = { key: string, label: string, done: boolean, completedAt: string | null, source: 'auto' | 'manual' | 'upload' | null, detail: string, awaitingApproval?: boolean, verifiedBy?: string, onBehalf?: boolean }
export type ItemStatus = 'complete' | 'late' | 'partial' | 'pending' | 'missing' | 'not_required'
export type Item = {
  ruleId: string, ruleName: string, kind: ComplianceKind, periodKey: string, periodLabel: string, dueAt: string, graceEndsAt: string,
  units: Unit[], done: number, total: number, status: ItemStatus, verification: 'auto' | 'manual' | 'mixed' | null,
  missing: string[], fine: { proposed: number, decision: string | null, amount: number, reason: string } | null, method: Rule['method'], evidenceUpload: boolean,
}

export const unitVerificationKey = (ruleId: string, periodKey: string, teacherId: string, unitKey: string) => `${ruleId}|${periodKey}|${normId(teacherId)}|${unitKey}`
export const fineKey = (ruleId: string, periodKey: string, teacherId: string) => `${ruleId}|${periodKey}|${normId(teacherId)}`

function schoolDays(start: string, end: string) {
  const days: string[] = []
  for (let day = start; day <= end; day = addDays(day, 1)) if (weekday(day) >= 1 && weekday(day) <= 5) days.push(day)
  return days
}

function withinPeriod(instant: string | null, period: Period, graceEndsAt: string) {
  if (!instant) return false
  return instant >= lagosInstant(period.start) && instant <= (graceEndsAt > lagosInstant(addDays(period.end, 1)) ? graceEndsAt : lagosInstant(addDays(period.end, 1)))
}

/** What a teacher owes for one rule in one period, and how much of it is done. */
export function evaluateItem(options: {
  rule: Rule, period: Period, teacher: StaffPerson, assignments: Assignment[], evidence: Evidence, now: string, termId: string,
}): Item | null {
  const { rule, period, teacher, evidence } = options
  const teacherKeys = new Set([normId(teacher.id), normId(teacher.email)].filter(Boolean))
  const mine = options.assignments.filter(item => teacherKeys.has(normId(item.teacherId)))
  const classTeaching = [...new Map(mine.filter(item => item.role === 'class_teacher').map(item => [item.classId, item])).values()]
  const subjects = [...new Map(mine.filter(item => item.role === 'subject').map(item => [`${item.classId}:${item.subjectId}`, item])).values()]
    .sort((a, b) => `${a.subjectName} ${a.className}`.localeCompare(`${b.subjectName} ${b.className}`))
  const graceEndsAt = new Date(Date.parse(period.dueAt) + rule.graceHours * 3600_000).toISOString()
  const allowAuto = rule.method !== 'manual'
  const allowManual = rule.method !== 'ndovera'
  const counts = (instant: string | null) => Boolean(instant) && (rule.lateAllowed || instant! <= graceEndsAt)

  let units: Unit[] = []
  if (rule.kind === 'register') {
    const lastDay = [period.end, lagosDate(period.dueAt)].sort()[0]
    const days = schoolDays(period.start, lastDay)
    units = classTeaching.map(item => {
      const byDate = evidence.register.get(item.classId) || new Map<string, string>()
      const marked = days.filter(day => byDate.has(day))
      const latest = marked.map(day => byDate.get(day)!).sort().pop() || null
      const done = allowAuto && days.length > 0 && marked.length === days.length && counts(latest)
      return { key: `class:${item.classId}`, label: item.className, done, completedAt: done ? latest : null, source: done ? 'auto' : null, detail: `${marked.length}/${days.length} days marked` }
    })
  } else if (rule.kind === 'lesson_notes' || rule.kind === 'exam_questions') {
    const type = rule.kind === 'lesson_notes' ? 'lesson_note' : 'exam_questions'
    units = subjects.map(item => {
      const matches = evidence.submissions.filter(entry => entry.type === type && entry.classId === item.classId && entry.subjectId === item.subjectId
        && teacherKeys.has(normId(entry.teacherId)) && entry.status !== 'draft'
        && (rule.kind === 'exam_questions'
          ? (!options.termId || !entry.termId || entry.termId === options.termId)
          : (period.weekNumber != null && entry.weekNumber === period.weekNumber) || withinPeriod(entry.firstSubmittedAt, period, graceEndsAt)))
      const approved = matches.find(entry => entry.status === 'approved')
      const submitted = matches.sort((a, b) => String(a.firstSubmittedAt).localeCompare(String(b.firstSubmittedAt)))[0]
      const completedAt = rule.approvalRequired ? (approved?.firstSubmittedAt || null) : (submitted?.firstSubmittedAt || null)
      const done = allowAuto && counts(completedAt)
      return {
        key: `subject:${item.classId}:${item.subjectId}`, label: `${item.subjectName} — ${item.className}`, done, completedAt: done ? completedAt : null, source: done ? 'auto' : null,
        detail: done ? (rule.approvalRequired ? 'Approved' : 'Submitted') : submitted ? (rule.approvalRequired && !approved ? 'Submitted — awaiting approval' : 'Submitted after the deadline') : 'Not submitted',
        awaitingApproval: Boolean(rule.approvalRequired && submitted && !approved),
      }
    })
  } else if (rule.kind === 'ca_scores') {
    // Each subject taught: that C.A. handed in from the score sheet (approved, where the rule asks for approval).
    const accepted = (status: string) => status !== 'returned' && (!rule.approvalRequired || ['section_approved', 'approved'].includes(status))
    units = subjects.map(item => {
      const mine = (evidence.caSubmissions || []).filter(entry => entry.classId === item.classId && entry.subjectId === item.subjectId)
      const allAtOnce = mine.find(entry => entry.componentKey === 'all')
      let handedIn: Array<{ status: string, submittedAt: string | null }>
      if (rule.caComponent === 'all') {
        const keys = evidence.caComponentKeys || []
        handedIn = allAtOnce ? [allAtOnce] : keys.length && keys.every(key => mine.some(entry => entry.componentKey === key)) ? keys.map(key => mine.find(entry => entry.componentKey === key)!) : []
      } else {
        const one = mine.find(entry => entry.componentKey === rule.caComponent) || allAtOnce
        handedIn = one ? [one] : []
      }
      const ok = handedIn.length > 0 && handedIn.every(entry => accepted(entry.status))
      const completedAt = ok ? handedIn.map(entry => entry.submittedAt || '').sort().pop() || null : null
      const done = allowAuto && counts(completedAt)
      const pendingApproval = handedIn.length > 0 && !ok && handedIn.every(entry => entry.status !== 'returned')
      const returned = handedIn.some(entry => entry.status === 'returned')
      return {
        key: `subject:${item.classId}:${item.subjectId}`, label: `${item.subjectName} — ${item.className}`, done, completedAt: done ? completedAt : null, source: done ? 'auto' as const : null,
        detail: done ? (rule.approvalRequired ? 'Approved' : 'Handed in') : returned ? 'Returned for correction' : pendingApproval ? 'Handed in — awaiting approval' : 'Not handed in',
        awaitingApproval: pendingApproval,
      }
    })
  } else if (rule.kind === 'class_report') {
    units = classTeaching.map(item => {
      const report = evidence.classReports.find(entry => entry.classId === item.classId && entry.periodKey === period.key && teacherKeys.has(normId(entry.teacherId)) && entry.status === 'submitted')
      const done = allowAuto && counts(report?.submittedAt || null)
      return { key: `class:${item.classId}`, label: item.className, done, completedAt: done ? report!.submittedAt : null, source: done ? 'auto' : null, detail: report ? 'Submitted' : 'Not submitted' }
    })
  } else {
    // Diary and custom requirements: one per teacher, confirmed by a Head or by uploaded evidence.
    units = [{ key: 'all', label: rule.name, done: false, completedAt: null, source: null, detail: 'Not yet verified' }]
  }
  if (!units.length) return null

  // A Head's confirmation (or an upload on the teacher's behalf) completes a unit too.
  units = units.map(unit => {
    const verification = evidence.verifications.get(unitVerificationKey(rule.id, period.key, teacher.id, unit.key))
      || evidence.verifications.get(unitVerificationKey(rule.id, period.key, teacher.email, unit.key))
    if (!verification || verification.status !== 'verified' || unit.done) return unit
    const isUpload = verification.source === 'upload'
    // A teacher's own upload still needs approval where the school requires it.
    if (isUpload && !verification.on_behalf && rule.approvalRequired) return { ...unit, detail: 'Evidence uploaded — awaiting verification', awaitingApproval: true }
    if (!isUpload && !allowManual) return unit
    return {
      ...unit, done: true, completedAt: verification.created_at, source: isUpload ? 'upload' : 'manual',
      detail: verification.on_behalf ? `Submitted by ${verification.actor_name} on the teacher's behalf` : isUpload ? 'Evidence uploaded' : `Verified by ${verification.actor_name}`,
      verifiedBy: verification.actor_name, onBehalf: Boolean(verification.on_behalf),
    }
  })

  const done = units.filter(unit => unit.done).length
  const total = units.length
  const lastCompletion = units.map(unit => unit.completedAt || '').sort().pop() || null
  let status: ItemStatus
  if (done === total) status = lastCompletion && lastCompletion > period.dueAt ? 'late' : 'complete'
  else if (options.now <= period.dueAt) status = 'pending'
  else status = done === 0 ? 'missing' : 'partial'

  const sources = new Set(units.filter(unit => unit.done).map(unit => (unit.source === 'auto' ? 'auto' : 'manual')))
  const verification = !done ? null : sources.size > 1 ? 'mixed' : (sources.has('auto') ? 'auto' : 'manual')

  // A fine is proposed once the grace period is over and the work was not in by then.
  let fine: Item['fine'] = null
  const overdueBeyondGrace = (status === 'late' && lastCompletion! > graceEndsAt) || (['missing', 'partial'].includes(status) && options.now > graceEndsAt)
  if (rule.fineAmount > 0 && overdueBeyondGrace) {
    const decision = evidence.fines.get(fineKey(rule.id, period.key, teacher.id)) || evidence.fines.get(fineKey(rule.id, period.key, teacher.email))
    fine = {
      proposed: rule.fineAmount,
      decision: decision ? String(decision.decision) : null,
      amount: decision ? Number(decision.amount) : rule.fineAmount,
      reason: decision ? String(decision.reason || '') : '',
    }
  }

  return {
    ruleId: rule.id, ruleName: rule.name, kind: rule.kind, periodKey: period.key, periodLabel: period.label, dueAt: period.dueAt, graceEndsAt,
    units, done, total, status, verification,
    missing: units.filter(unit => !unit.done).map(unit => unit.label),
    fine, method: rule.method, evidenceUpload: rule.evidenceUpload,
  }
}

/** Sections a teacher works in, from the classes they teach. */
export function teacherSections(teacher: StaffPerson, assignments: Assignment[], classSections: Map<string, Section>) {
  const keys = new Set([normId(teacher.id), normId(teacher.email)])
  return [...new Set(assignments.filter(item => keys.has(normId(item.teacherId))).map(item => classSections.get(item.classId)).filter(Boolean) as Section[])]
}

export function ruleAppliesTo(rule: Rule, sections: Section[]) {
  return rule.appliesTo.includes('all') ? sections.length > 0 : sections.some(section => rule.appliesTo.includes(section))
}

/** A section-specific rule only counts the classes in its sections. */
export function assignmentsForRule(rule: Rule, assignments: Assignment[], classSections: Map<string, Section>) {
  if (rule.appliesTo.includes('all')) return assignments
  return assignments.filter(item => rule.appliesTo.includes(classSections.get(item.classId) as Section))
}

/** Everything one teacher owes, rule by rule, for the period each rule is in at `date`. */
export function teacherItems(options: {
  rules: Rule[], teacher: StaffPerson, assignments: Assignment[], classSections: Map<string, Section>, evidence: Evidence,
  term: { id?: string, startDate: string, endDate: string }, date: string, now: string,
}) {
  const sections = teacherSections(options.teacher, options.assignments, options.classSections)
  const items: Item[] = []
  for (const rule of options.rules) {
    if (!ruleAppliesTo(rule, sections)) continue
    const period = periodAt(rule, options.term, options.date)
    if (!period) continue
    const item = evaluateItem({ rule, period, teacher: options.teacher, assignments: assignmentsForRule(rule, options.assignments, options.classSections), evidence: options.evidence, now: options.now, termId: options.term.id || '' })
    if (item) items.push(item)
  }
  return items
}

/** Every period up to now, per week, for a teacher's permanent compliance history. */
export function teacherHistory(options: {
  rules: Rule[], teacher: StaffPerson, assignments: Assignment[], classSections: Map<string, Section>, evidence: Evidence,
  term: { id?: string, startDate: string, endDate: string }, now: string,
}) {
  const sections = teacherSections(options.teacher, options.assignments, options.classSections)
  const today = lagosDate(options.now)
  const weeks = new Map<string, { weekStart: string, label: string, required: number, onTime: number, late: number, missing: number, partial: number, pending: number }>()
  const termWeekOne = mondayOf(options.term.startDate || today)
  for (const rule of options.rules) {
    if (!ruleAppliesTo(rule, sections)) continue
    for (const period of rulePeriods(rule, options.term, today)) {
      const item = evaluateItem({ rule, period, teacher: options.teacher, assignments: assignmentsForRule(rule, options.assignments, options.classSections), evidence: options.evidence, now: options.now, termId: options.term.id || '' })
      if (!item) continue
      const weekStart = mondayOf(lagosDate(period.dueAt))
      const weekNumber = Math.floor((Date.parse(weekStart) - Date.parse(termWeekOne)) / (7 * 86400000)) + 1
      const entry = weeks.get(weekStart) || { weekStart, label: `Week ${weekNumber}`, required: 0, onTime: 0, late: 0, missing: 0, partial: 0, pending: 0 }
      entry.required += 1
      if (item.status === 'complete') entry.onTime += 1
      else if (item.status === 'late') entry.late += 1
      else if (item.status === 'missing') entry.missing += 1
      else if (item.status === 'partial') entry.partial += 1
      else entry.pending += 1
      weeks.set(weekStart, entry)
    }
  }
  return [...weeks.values()].sort((a, b) => a.weekStart.localeCompare(b.weekStart))
}

/** One line per teacher for the Heads' matrix, and the totals above it. */
export function summarize(rows: Array<{ items: Item[] }>) {
  let fullyCompliant = 0
  let partial = 0
  let outstanding = 0
  let late = 0
  let proposedPenalties = 0
  for (const row of rows) {
    const statuses = row.items.map(item => item.status)
    if (statuses.includes('missing')) outstanding += 1
    else if (statuses.includes('partial')) partial += 1
    else if (statuses.every(status => status === 'complete' || status === 'late')) fullyCompliant += 1
    late += statuses.filter(status => status === 'late').length
    for (const item of row.items) {
      if (item.fine && item.fine.decision !== 'waived') proposedPenalties += item.fine.amount
    }
  }
  return { teachers: rows.length, fullyCompliant, partial, outstanding, late, proposedPenalties }
}

// ─── Manual verification, uploads, fines, audit ─────────────────────────────

export async function recordAudit(db: D1Database, entry: {
  tenantId: string, teacherId?: string, ruleId?: string, periodKey?: string, unitKey?: string, action: string, actor: Actor, before?: unknown, after?: unknown, reason?: string,
}) {
  await db.prepare(`INSERT INTO compliance_audit (id, tenant_id, teacher_id, rule_id, period_key, unit_key, action, before_value, after_value, reason, actor_id, actor_name, actor_role, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
    `caud-${crypto.randomUUID()}`, entry.tenantId, entry.teacherId || null, entry.ruleId || null, entry.periodKey || null, entry.unitKey || null, entry.action,
    entry.before === undefined ? null : JSON.stringify(entry.before), entry.after === undefined ? null : JSON.stringify(entry.after), entry.reason || null,
    entry.actor.id || null, entry.actor.name || null, entry.actor.role || null, new Date().toISOString(),
  ).run()
}

export async function listAudit(db: D1Database, tenantId: string, filters: { teacherId?: string, limit?: number }) {
  await ensureComplianceTables(db)
  const where = ['tenant_id = ?']
  const params: unknown[] = [tenantId]
  if (filters.teacherId) { where.push('lower(teacher_id) = lower(?)'); params.push(filters.teacherId) }
  const rows = await db.prepare(`SELECT * FROM compliance_audit WHERE ${where.join(' AND ')} ORDER BY created_at DESC LIMIT ?`).bind(...params, Math.min(500, filters.limit || 200)).all()
  return ((rows.results || []) as Record<string, any>[]).map(row => ({
    id: row.id, teacherId: row.teacher_id, ruleId: row.rule_id, periodKey: row.period_key, unitKey: row.unit_key, action: row.action,
    before: parse(row.before_value, null), after: parse(row.after_value, null), reason: row.reason || '',
    actorName: row.actor_name || '', actorRole: row.actor_role || '', createdAt: row.created_at,
  }))
}

export async function loadVerifications(db: D1Database, tenantId: string, ruleIds: string[]) {
  await ensureComplianceTables(db)
  const map = new Map<string, Record<string, any>>()
  if (!ruleIds.length) return map
  const rows = await db.prepare(`SELECT * FROM compliance_verifications WHERE tenant_id = ? AND rule_id IN (SELECT value FROM json_each(?)) ORDER BY created_at`)
    .bind(tenantId, JSON.stringify(ruleIds)).all()
  for (const row of (rows.results || []) as Record<string, any>[]) map.set(unitVerificationKey(row.rule_id, row.period_key, row.teacher_id, row.unit_key), row)
  return map
}

export async function loadFines(db: D1Database, tenantId: string) {
  await ensureComplianceTables(db)
  const map = new Map<string, Record<string, any>>()
  const rows = await db.prepare(`SELECT * FROM compliance_fines WHERE tenant_id = ?`).bind(tenantId).all()
  for (const row of (rows.results || []) as Record<string, any>[]) map.set(fineKey(row.rule_id, row.period_key, row.teacher_id), row)
  return map
}

export function normalizeFiles(value: unknown) {
  return (Array.isArray(value) ? value : []).slice(0, 20).map((file: any) => ({
    name: String(file?.name || '').slice(0, 200), url: String(file?.url || ''), type: String(file?.type || '').slice(0, 100), size: Number(file?.size || 0),
  })).filter(file => /^https?:\/\//.test(file.url) || file.url.startsWith('/'))
}

/** A Head confirms (or withdraws confirmation of) work done outside Ndovera, or uploads it on the teacher's behalf. */
export async function recordVerification(db: D1Database, options: {
  tenantId: string, ruleId: string, periodKey: string, teacherId: string, unitKey: string, actor: Actor,
  status: 'verified' | 'revoked', source: 'manual' | 'upload', onBehalf?: boolean, note?: string, files?: unknown,
}) {
  await ensureComplianceTables(db)
  const previous = (await loadVerifications(db, options.tenantId, [options.ruleId])).get(unitVerificationKey(options.ruleId, options.periodKey, options.teacherId, options.unitKey))
  const files = normalizeFiles(options.files)
  await db.prepare(`INSERT INTO compliance_verifications (id, tenant_id, rule_id, period_key, teacher_id, unit_key, status, source, note, files_json, on_behalf, actor_id, actor_name, actor_role, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
    `cver-${crypto.randomUUID()}`, options.tenantId, options.ruleId, options.periodKey, options.teacherId, options.unitKey, options.status, options.source,
    String(options.note || '').slice(0, 2000) || null, JSON.stringify(files), options.onBehalf ? 1 : 0, options.actor.id, options.actor.name, options.actor.role, new Date().toISOString(),
  ).run()
  await recordAudit(db, {
    tenantId: options.tenantId, teacherId: options.teacherId, ruleId: options.ruleId, periodKey: options.periodKey, unitKey: options.unitKey,
    action: options.status === 'revoked' ? 'verification_withdrawn' : options.onBehalf ? 'submitted_on_behalf' : options.source === 'upload' ? 'evidence_uploaded' : 'marked_submitted',
    actor: options.actor, before: previous ? previous.status : 'none', after: options.status, reason: options.note,
  })
}

export async function decideFine(db: D1Database, options: {
  tenantId: string, ruleId: string, periodKey: string, teacherId: string, decision: unknown, amount?: unknown, reason?: unknown, proposed: number, actor: Actor,
}) {
  await ensureComplianceTables(db)
  const decision = String(options.decision || '')
  if (!['approved', 'waived', 'adjusted'].includes(decision)) throw new ComplianceError('Choose Approve, Waive or Adjust.')
  const reason = String(options.reason || '').trim().slice(0, 1000)
  if (decision !== 'approved' && !reason) throw new ComplianceError('Give a reason when waiving or adjusting a penalty.')
  let amount = options.proposed
  if (decision === 'waived') amount = 0
  if (decision === 'adjusted') {
    amount = Number(options.amount)
    if (!Number.isFinite(amount) || amount < 0) throw new ComplianceError('Enter the adjusted amount.')
  }
  const previous = (await loadFines(db, options.tenantId)).get(fineKey(options.ruleId, options.periodKey, options.teacherId))
  await db.prepare(`INSERT INTO compliance_fines (tenant_id, rule_id, period_key, teacher_id, decision, amount, reason, actor_id, actor_name, decided_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(tenant_id, rule_id, period_key, teacher_id) DO UPDATE SET decision = excluded.decision, amount = excluded.amount, reason = excluded.reason,
      actor_id = excluded.actor_id, actor_name = excluded.actor_name, decided_at = excluded.decided_at`)
    .bind(options.tenantId, options.ruleId, options.periodKey, options.teacherId, decision, amount, reason || null, options.actor.id, options.actor.name, new Date().toISOString()).run()
  await recordAudit(db, {
    tenantId: options.tenantId, teacherId: options.teacherId, ruleId: options.ruleId, periodKey: options.periodKey, action: `fine_${decision}`, actor: options.actor,
    before: previous ? { decision: previous.decision, amount: previous.amount } : { decision: 'proposed', amount: options.proposed }, after: { decision, amount }, reason,
  })
  return { decision, amount, reason }
}

// ─── Class reports ────────────────────────────────────────────────────────────

export const QUESTION_TYPES = ['short', 'long', 'number', 'yesno', 'choice', 'students', 'file'] as const
export type ReportQuestion = { id: string, label: string, type: typeof QUESTION_TYPES[number], options?: string[], required?: boolean }

export const DEFAULT_REPORT_QUESTIONS: ReportQuestion[] = [
  { id: 'attendance', label: 'Attendance this week — any patterns or concerns?', type: 'long' },
  { id: 'topics', label: 'Topics covered', type: 'long', required: true },
  { id: 'progress', label: 'Overall academic progress of the class', type: 'choice', options: ['Excellent', 'Good', 'Fair', 'Needs attention'], required: true },
  { id: 'struggling', label: 'Pupils who are struggling', type: 'students' },
  { id: 'outstanding', label: 'Outstanding pupils', type: 'students' },
  { id: 'behaviour', label: 'Behaviour and discipline', type: 'long' },
  { id: 'parents', label: 'Parent concerns raised', type: 'long' },
  { id: 'homework', label: 'Was homework given and checked?', type: 'yesno' },
  { id: 'resources', label: 'Resources needed', type: 'short' },
  { id: 'incidents', label: 'Incidents', type: 'long' },
  { id: 'achievements', label: 'Achievements', type: 'long' },
  { id: 'recommendations', label: 'Recommendations', type: 'long' },
]

export function normalizeQuestions(value: unknown): ReportQuestion[] {
  const list = (Array.isArray(value) ? value : []).slice(0, 40).map((item: any, index: number) => {
    const type = QUESTION_TYPES.includes(item?.type) ? item.type : 'short'
    const label = String(item?.label || '').trim().slice(0, 300)
    const options = type === 'choice' ? (Array.isArray(item?.options) ? item.options : []).map((option: unknown) => String(option || '').trim().slice(0, 100)).filter(Boolean).slice(0, 12) : undefined
    return { id: String(item?.id || `q${index + 1}`).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) || `q${index + 1}`, label, type, ...(options ? { options } : {}), required: Boolean(item?.required) }
  }).filter(item => item.label)
  if (!list.length) throw new ComplianceError('Add at least one question.')
  const ids = new Set<string>()
  return list.map((item, index) => {
    const id = ids.has(item.id) ? `${item.id}_${index}` : item.id
    ids.add(id)
    return { ...item, id }
  })
}

export async function getReportTemplate(db: D1Database, tenantId: string) {
  await ensureComplianceTables(db)
  const row = await db.prepare(`SELECT questions_json FROM class_report_templates WHERE tenant_id = ?`).bind(tenantId).first() as Record<string, any> | null
  return parse(row?.questions_json, DEFAULT_REPORT_QUESTIONS) as ReportQuestion[]
}

export async function saveReportTemplate(db: D1Database, tenantId: string, questions: unknown, actor: Actor) {
  const normalized = normalizeQuestions(questions)
  await ensureComplianceTables(db)
  await db.prepare(`INSERT INTO class_report_templates (tenant_id, questions_json, updated_by, updated_at) VALUES (?, ?, ?, ?)
    ON CONFLICT(tenant_id) DO UPDATE SET questions_json = excluded.questions_json, updated_by = excluded.updated_by, updated_at = excluded.updated_at`)
    .bind(tenantId, JSON.stringify(normalized), actor.id, new Date().toISOString()).run()
  await recordAudit(db, { tenantId, action: 'report_template_updated', actor, after: { questions: normalized.length } })
  return normalized
}

function mapReport(row: Record<string, any>) {
  return {
    id: String(row.id), periodKey: row.period_key, periodLabel: row.period_label || '', classId: row.class_id, className: row.class_name || '',
    teacherId: row.teacher_id, teacherName: row.teacher_name || '', questions: parse(row.questions_json, [] as ReportQuestion[]),
    answers: parse(row.answers_json, {} as Record<string, any>), aiSummary: row.ai_summary || '', summary: row.summary || '',
    status: row.status, submittedAt: row.submitted_at || null, createdAt: row.created_at, updatedAt: row.updated_at,
  }
}
export type ClassReport = ReturnType<typeof mapReport>

export async function getClassReport(db: D1Database, tenantId: string, id: string) {
  await ensureComplianceTables(db)
  const row = await db.prepare(`SELECT * FROM class_reports WHERE id = ? AND tenant_id = ?`).bind(id, tenantId).first() as Record<string, any> | null
  return row ? mapReport(row) : null
}

export async function findClassReport(db: D1Database, tenantId: string, periodKey: string, classId: string, teacherId: string) {
  await ensureComplianceTables(db)
  const row = await db.prepare(`SELECT * FROM class_reports WHERE tenant_id = ? AND period_key = ? AND class_id = ? AND lower(teacher_id) = lower(?)`).bind(tenantId, periodKey, classId, teacherId).first() as Record<string, any> | null
  return row ? mapReport(row) : null
}

export async function listClassReports(db: D1Database, tenantId: string, filters: { classId?: string, teacherId?: string, periodKey?: string, submittedOnly?: boolean }) {
  await ensureComplianceTables(db)
  const where = ['tenant_id = ?']
  const params: unknown[] = [tenantId]
  if (filters.classId) { where.push('class_id = ?'); params.push(filters.classId) }
  if (filters.teacherId) { where.push('lower(teacher_id) = lower(?)'); params.push(filters.teacherId) }
  if (filters.periodKey) { where.push('period_key = ?'); params.push(filters.periodKey) }
  if (filters.submittedOnly) where.push(`status = 'submitted'`)
  const rows = await db.prepare(`SELECT * FROM class_reports WHERE ${where.join(' AND ')} ORDER BY COALESCE(submitted_at, updated_at) DESC LIMIT 500`).bind(...params).all()
  return ((rows.results || []) as Record<string, any>[]).map(mapReport)
}

/** Save the teacher's answers. Submitted reports are on record and cannot change. */
export async function saveClassReportDraft(db: D1Database, options: {
  tenantId: string, periodKey: string, periodLabel: string, classId: string, className: string, teacher: Actor, questions: ReportQuestion[], answers: unknown, summary?: unknown,
}) {
  await ensureComplianceTables(db)
  const existing = await findClassReport(db, options.tenantId, options.periodKey, options.classId, options.teacher.id)
  if (existing?.status === 'submitted') throw new ComplianceError('This report has been submitted and is on record.', 409)
  const answers = Object.fromEntries(Object.entries((options.answers && typeof options.answers === 'object') ? options.answers as Record<string, unknown> : {})
    .filter(([key]) => options.questions.some(question => question.id === key))
    .map(([key, value]) => [key, Array.isArray(value) ? value.slice(0, 60).map(item => (typeof item === 'object' ? item : String(item).slice(0, 200))) : String(value ?? '').slice(0, 6000)]))
  const now = new Date().toISOString()
  const summary = options.summary === undefined ? (existing?.summary || '') : String(options.summary || '').slice(0, 20000)
  if (existing) {
    await db.prepare(`UPDATE class_reports SET answers_json = ?, summary = ?, questions_json = ?, updated_at = ? WHERE id = ?`).bind(JSON.stringify(answers), summary, JSON.stringify(options.questions), now, existing.id).run()
    return (await getClassReport(db, options.tenantId, existing.id))!
  }
  const id = `creport-${crypto.randomUUID()}`
  await db.prepare(`INSERT INTO class_reports (id, tenant_id, period_key, period_label, class_id, class_name, teacher_id, teacher_name, questions_json, answers_json, summary, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)`).bind(id, options.tenantId, options.periodKey, options.periodLabel, options.classId, options.className,
    options.teacher.id, options.teacher.name, JSON.stringify(options.questions), JSON.stringify(answers), summary, now, now).run()
  return (await getClassReport(db, options.tenantId, id))!
}

export function missingRequiredAnswers(report: ClassReport) {
  return report.questions.filter(question => question.required && !(Array.isArray(report.answers[question.id]) ? report.answers[question.id].length : String(report.answers[question.id] ?? '').trim())).map(question => question.label)
}

export async function submitClassReport(db: D1Database, options: { tenantId: string, id: string, teacher: Actor, summary?: unknown }) {
  const report = await getClassReport(db, options.tenantId, options.id)
  if (!report || normId(report.teacherId) !== normId(options.teacher.id)) throw new ComplianceError('Report not found.', 404)
  if (report.status === 'submitted') throw new ComplianceError('This report has already been submitted.', 409)
  const missing = missingRequiredAnswers(report)
  if (missing.length) throw new ComplianceError(`Answer the required questions first: ${missing.join('; ')}.`)
  const now = new Date().toISOString()
  const summary = options.summary === undefined ? report.summary : String(options.summary || '').slice(0, 20000)
  await db.prepare(`UPDATE class_reports SET status = 'submitted', summary = ?, submitted_at = ?, updated_at = ? WHERE id = ?`).bind(summary, now, now, report.id).run()
  await recordAudit(db, { tenantId: options.tenantId, teacherId: report.teacherId, periodKey: report.periodKey, unitKey: `class:${report.classId}`, action: 'class_report_submitted', actor: options.teacher })
  return (await getClassReport(db, options.tenantId, report.id))!
}

export async function storeAiSummary(db: D1Database, tenantId: string, id: string, text: string) {
  await db.prepare(`UPDATE class_reports SET ai_summary = ?, summary = CASE WHEN COALESCE(summary, '') = '' THEN ? ELSE summary END, updated_at = ? WHERE id = ? AND tenant_id = ?`)
    .bind(text, text, new Date().toISOString(), id, tenantId).run()
}

/** The AI writes up the teacher's answers; it is told to add nothing they did not say. */
export function buildClassReportPrompt(report: ClassReport, studentNames: Map<string, string>) {
  const lines = report.questions.map(question => {
    const value = report.answers[question.id]
    const text = Array.isArray(value)
      ? value.map(item => (typeof item === 'object' && item ? String((item as any).name || (item as any).id || '') : studentNames.get(String(item)) || String(item))).filter(Boolean).join(', ')
      : String(value ?? '').trim()
    return `${question.label}: ${text || '(no answer)'}`
  })
  return {
    system: [
      `You are writing a weekly class report for school management from a teacher's questionnaire answers (${report.className}, ${report.periodLabel}).`,
      'Use only what the teacher wrote. Do not add facts, names, numbers or judgements that are not in the answers. Where a question has no answer, leave it out rather than guessing.',
      'Write in clear, professional British English with these headings: Summary, Attendance, Academic Progress, Pupils Needing Support, Outstanding Pupils, Behaviour, Parents, Resources Needed, Incidents and Achievements, Recommendations. Omit a heading that has nothing under it.',
    ].join('\n'),
    user: lines.join('\n'),
  }
}
