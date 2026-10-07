// Teacher work submission and review.
//
//   Teacher: prepare → choose type, class, subject, week → submit → track review
//            → correct if returned → resubmit → approved
//   Owner/HOS (and reviewers the school names): choose a class → see who has
//            submitted, who has not, what is late or waiting → open → AI
//            preliminary review (advice only) → comment → approve / return
//
// Organisation: Session → Term → Class → Subject → Teacher → Type → Week.
//
// Every submit or resubmit freezes a version, so returned work never vanishes:
//   Version 1 → Submitted → Returned · Version 2 → Resubmitted → Approved
// Every action is written to the append-only `teacher_submission_audit`.
// Deleting is a soft delete with its audit record, and follows the school's rules.

export const DEFAULT_SUBMISSION_TYPES = [
  { key: 'lesson_plan', label: 'Lesson Plan' },
  { key: 'lesson_note', label: 'Lesson Note' },
  { key: 'exam_questions', label: 'Exam Questions' },
  { key: 'test_questions', label: 'Test Questions' },
  { key: 'scheme_of_work', label: 'Scheme of Work / Plan' },
  { key: 'other', label: 'Other' },
]

export const SUBMISSION_STATUSES = ['draft', 'submitted', 'under_review', 'approved', 'returned', 'resubmitted'] as const
export type SubmissionStatus = typeof SUBMISSION_STATUSES[number]
const OPEN_FOR_REVIEW = new Set(['submitted', 'resubmitted', 'under_review'])

export const DEFAULT_POLICY = {
  // Which work is expected, and by when, for "not submitted" and "late".
  requirements: [] as Array<{ type: string, cadence: 'weekly' | 'termly', dueWeekday: number }>,
  // 'approval' (Approved / Not approved) or 'score' (a mark out of maxScore).
  reviewMode: 'approval' as 'approval' | 'score',
  maxScore: 10,
  // Roles beyond Owner and HOS allowed to review.
  reviewerRoles: [] as string[],
  // Whether a teacher may edit or withdraw work that has been submitted but not yet reviewed.
  allowEditBeforeReview: true,
  allowDeleteBeforeReview: true,
  // What the AI preliminary review looks for.
  aiCriteria: ['clear learning objectives', 'logical organisation', 'completeness', 'learning activities', 'assessment of learning', 'appropriate level for the class'],
  customTypes: [] as Array<{ key: string, label: string }>,
}
export type SubmissionPolicy = typeof DEFAULT_POLICY

export class SubmissionError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

let _ready = false
export function resetTeacherSubmissionsCache() {
  _ready = false
}

export async function ensureSubmissionTables(db: D1Database) {
  if (_ready) return
  await db.prepare(`CREATE TABLE IF NOT EXISTS teacher_submissions (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    session_id TEXT,
    session_name TEXT,
    term_id TEXT,
    term_name TEXT,
    class_id TEXT NOT NULL,
    class_name TEXT,
    subject_id TEXT NOT NULL,
    subject_name TEXT,
    teacher_id TEXT NOT NULL,
    teacher_name TEXT,
    type TEXT NOT NULL,
    type_label TEXT NOT NULL,
    week_number INTEGER,
    period_label TEXT,
    title TEXT NOT NULL,
    content TEXT,
    files_json TEXT,
    status TEXT NOT NULL,
    current_version INTEGER NOT NULL DEFAULT 0,
    batch_id TEXT,
    first_submitted_at TEXT,
    submitted_at TEXT,
    reviewed_by TEXT,
    reviewed_by_name TEXT,
    reviewed_at TEXT,
    decision TEXT,
    score REAL,
    feedback TEXT,
    ai_review_json TEXT,
    deleted_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`).run()
  await db.prepare(`CREATE TABLE IF NOT EXISTS teacher_submission_versions (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    submission_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    title TEXT,
    content TEXT,
    files_json TEXT,
    submitted_status TEXT NOT NULL,
    submitted_at TEXT NOT NULL,
    outcome TEXT,
    score REAL,
    feedback TEXT,
    reviewed_by_name TEXT,
    reviewed_at TEXT,
    UNIQUE(submission_id, version)
  )`).run()
  await db.prepare(`CREATE TABLE IF NOT EXISTS teacher_submission_audit (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    submission_id TEXT NOT NULL,
    action TEXT NOT NULL,
    actor_id TEXT,
    actor_name TEXT,
    actor_role TEXT,
    status_before TEXT,
    status_after TEXT,
    version INTEGER,
    details TEXT,
    created_at TEXT NOT NULL
  )`).run()
  await db.prepare(`CREATE TABLE IF NOT EXISTS submission_policies (
    tenant_id TEXT PRIMARY KEY,
    policy_json TEXT NOT NULL,
    updated_by TEXT,
    updated_at TEXT NOT NULL
  )`).run()
  for (const statement of [
    `CREATE INDEX IF NOT EXISTS idx_teacher_submissions_class ON teacher_submissions(tenant_id, class_id, subject_id, type, week_number)`,
    `CREATE INDEX IF NOT EXISTS idx_teacher_submissions_teacher ON teacher_submissions(tenant_id, teacher_id, created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_teacher_submission_audit ON teacher_submission_audit(tenant_id, submission_id, created_at)`,
  ]) {
    try { await db.prepare(statement).run() } catch {}
  }
  _ready = true
}

const parse = <T>(value: unknown, fallback: T): T => {
  try { return value ? JSON.parse(String(value)) as T : fallback } catch { return fallback }
}

export async function getSubmissionPolicy(db: D1Database, tenantId: string): Promise<SubmissionPolicy> {
  await ensureSubmissionTables(db)
  const row = await db.prepare(`SELECT policy_json FROM submission_policies WHERE tenant_id = ?`).bind(tenantId).first() as Record<string, any> | null
  return { ...DEFAULT_POLICY, ...parse(row?.policy_json, {}) }
}

export async function saveSubmissionPolicy(db: D1Database, tenantId: string, input: Record<string, any>, actorId: string) {
  const current = await getSubmissionPolicy(db, tenantId)
  const typeKeys = new Set([...DEFAULT_SUBMISSION_TYPES.map(type => type.key)])
  const customTypes = (Array.isArray(input.customTypes) ? input.customTypes : current.customTypes)
    .map((type: any) => ({ label: String(type?.label || '').trim().slice(0, 60) }))
    .filter((type: any) => type.label)
    .map((type: any) => ({ key: `custom_${type.label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}`, label: type.label }))
  customTypes.forEach((type: { key: string }) => typeKeys.add(type.key))
  const policy: SubmissionPolicy = {
    requirements: (Array.isArray(input.requirements) ? input.requirements : current.requirements)
      .filter((item: any) => typeKeys.has(String(item?.type || '')))
      .map((item: any) => ({ type: String(item.type), cadence: item.cadence === 'termly' ? 'termly' : 'weekly', dueWeekday: Math.min(6, Math.max(0, Number(item.dueWeekday ?? 5))) })),
    reviewMode: input.reviewMode === 'score' ? 'score' : input.reviewMode === 'approval' ? 'approval' : current.reviewMode,
    maxScore: Math.min(1000, Math.max(1, Number(input.maxScore ?? current.maxScore) || 10)),
    reviewerRoles: (Array.isArray(input.reviewerRoles) ? input.reviewerRoles : current.reviewerRoles).map((role: unknown) => String(role || '').trim().toLowerCase()).filter(Boolean),
    allowEditBeforeReview: input.allowEditBeforeReview === undefined ? current.allowEditBeforeReview : Boolean(input.allowEditBeforeReview),
    allowDeleteBeforeReview: input.allowDeleteBeforeReview === undefined ? current.allowDeleteBeforeReview : Boolean(input.allowDeleteBeforeReview),
    aiCriteria: (Array.isArray(input.aiCriteria) ? input.aiCriteria : current.aiCriteria).map((item: unknown) => String(item || '').trim()).filter(Boolean).slice(0, 15),
    customTypes,
  }
  await db.prepare(`INSERT INTO submission_policies (tenant_id, policy_json, updated_by, updated_at) VALUES (?, ?, ?, ?)
    ON CONFLICT(tenant_id) DO UPDATE SET policy_json = excluded.policy_json, updated_by = excluded.updated_by, updated_at = excluded.updated_at`)
    .bind(tenantId, JSON.stringify(policy), actorId || null, new Date().toISOString()).run()
  return policy
}

export function submissionTypes(policy: SubmissionPolicy) {
  return [...DEFAULT_SUBMISSION_TYPES.slice(0, -1), ...policy.customTypes, DEFAULT_SUBMISSION_TYPES[DEFAULT_SUBMISSION_TYPES.length - 1]]
}

export function resolveType(policy: SubmissionPolicy, type: unknown, otherLabel: unknown) {
  const key = String(type || '').trim()
  const found = submissionTypes(policy).find(item => item.key === key)
  if (!found) throw new SubmissionError('Choose what kind of work this is.')
  if (found.key === 'other') {
    const label = String(otherLabel || '').trim().slice(0, 80)
    if (!label) throw new SubmissionError('Say what is being submitted when you choose Other.')
    return { key: 'other', label }
  }
  return found
}

export function mapSubmission(row: Record<string, any>) {
  return {
    id: String(row.id),
    sessionId: row.session_id || '', sessionName: row.session_name || '',
    termId: row.term_id || '', termName: row.term_name || '',
    classId: row.class_id, className: row.class_name || '',
    subjectId: row.subject_id, subjectName: row.subject_name || '',
    teacherId: row.teacher_id, teacherName: row.teacher_name || '',
    type: row.type, typeLabel: row.type_label,
    weekNumber: row.week_number == null ? null : Number(row.week_number), periodLabel: row.period_label || '',
    title: row.title, content: row.content || '', files: parse(row.files_json, [] as any[]),
    status: row.status as SubmissionStatus, version: Number(row.current_version || 0), batchId: row.batch_id || '',
    firstSubmittedAt: row.first_submitted_at || null, submittedAt: row.submitted_at || null,
    reviewedByName: row.reviewed_by_name || '', reviewedAt: row.reviewed_at || null,
    decision: row.decision || '', score: row.score == null ? null : Number(row.score), feedback: row.feedback || '',
    aiReview: parse(row.ai_review_json, null as any),
    createdAt: row.created_at, updatedAt: row.updated_at,
  }
}

export type Actor = { id: string, name: string, role: string }

export async function recordSubmissionAudit(db: D1Database, entry: {
  tenantId: string, submissionId: string, action: string, actor: Actor, statusBefore?: string, statusAfter?: string, version?: number, details?: Record<string, any>,
}) {
  await db.prepare(`INSERT INTO teacher_submission_audit (id, tenant_id, submission_id, action, actor_id, actor_name, actor_role, status_before, status_after, version, details, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
    `subaud-${crypto.randomUUID()}`, entry.tenantId, entry.submissionId, entry.action, entry.actor.id || null, entry.actor.name || null, entry.actor.role || null,
    entry.statusBefore || null, entry.statusAfter || null, entry.version ?? null, JSON.stringify(entry.details || {}), new Date().toISOString(),
  ).run()
}

export async function getSubmission(db: D1Database, tenantId: string, id: string) {
  await ensureSubmissionTables(db)
  const row = await db.prepare(`SELECT * FROM teacher_submissions WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL`).bind(id, tenantId).first() as Record<string, any> | null
  return row ? mapSubmission(row) : null
}

function normalizeFiles(value: unknown) {
  return (Array.isArray(value) ? value : []).slice(0, 30).map((file: any) => ({
    name: String(file?.name || '').slice(0, 200), url: String(file?.url || ''), type: String(file?.type || '').slice(0, 100), size: Number(file?.size || 0),
  })).filter(file => /^https?:\/\//.test(file.url) || file.url.startsWith('/'))
}

function normalizeWeek(value: unknown) {
  const week = Number(value)
  return Number.isInteger(week) && week > 0 && week <= 60 ? week : null
}

/** Freeze the current content as a new version and move to submitted / resubmitted. */
async function freezeVersion(db: D1Database, tenantId: string, submission: ReturnType<typeof mapSubmission>, status: 'submitted' | 'resubmitted', timestamp: string) {
  const version = submission.version + 1
  await db.batch([
    db.prepare(`INSERT INTO teacher_submission_versions (id, tenant_id, submission_id, version, title, content, files_json, submitted_status, submitted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(`subver-${crypto.randomUUID()}`, tenantId, submission.id, version, submission.title, submission.content, JSON.stringify(submission.files), status, timestamp),
    db.prepare(`UPDATE teacher_submissions SET status = ?, current_version = ?, submitted_at = ?, first_submitted_at = COALESCE(first_submitted_at, ?),
      decision = NULL, score = NULL, reviewed_by = NULL, reviewed_by_name = NULL, reviewed_at = NULL, updated_at = ? WHERE id = ? AND tenant_id = ?`)
      .bind(status, version, timestamp, timestamp, timestamp, submission.id, tenantId),
  ])
  return version
}

export async function createSubmission(db: D1Database, options: {
  tenantId: string, actor: Actor, policy: SubmissionPolicy,
  context: { sessionId: string, sessionName: string, termId: string, termName: string, classId: string, className: string, subjectId: string, subjectName: string },
  input: Record<string, any>, batchId?: string,
}) {
  await ensureSubmissionTables(db)
  const type = resolveType(options.policy, options.input.type, options.input.otherLabel)
  const weekNumber = normalizeWeek(options.input.weekNumber)
  const periodLabel = String(options.input.periodLabel || (weekNumber ? `Week ${weekNumber}` : '')).trim().slice(0, 60)
  const title = String(options.input.title || `${type.label}${periodLabel ? ` — ${periodLabel}` : ''}`).trim().slice(0, 200)
  const content = String(options.input.content || '').slice(0, 100000)
  const files = normalizeFiles(options.input.files)
  const submit = options.input.submit !== false
  if (submit && !content.trim() && !files.length) throw new SubmissionError('Add the work itself — text or at least one file — before submitting.')

  const id = `sub-${crypto.randomUUID()}`
  const timestamp = new Date().toISOString()
  const c = options.context
  await db.prepare(`INSERT INTO teacher_submissions (id, tenant_id, session_id, session_name, term_id, term_name, class_id, class_name, subject_id, subject_name,
      teacher_id, teacher_name, type, type_label, week_number, period_label, title, content, files_json, status, current_version, batch_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', 0, ?, ?, ?)`).bind(
    id, options.tenantId, c.sessionId || null, c.sessionName || null, c.termId || null, c.termName || null, c.classId, c.className, c.subjectId, c.subjectName,
    options.actor.id, options.actor.name, type.key, type.label, weekNumber, periodLabel || null, title, content, JSON.stringify(files), options.batchId || null, timestamp, timestamp,
  ).run()
  let submission = (await getSubmission(db, options.tenantId, id))!
  await recordSubmissionAudit(db, { tenantId: options.tenantId, submissionId: id, action: 'created', actor: options.actor, statusAfter: 'draft', details: { type: type.label, periodLabel, batchId: options.batchId || null } })
  if (submit) {
    const version = await freezeVersion(db, options.tenantId, submission, 'submitted', timestamp)
    await recordSubmissionAudit(db, { tenantId: options.tenantId, submissionId: id, action: 'submitted', actor: options.actor, statusBefore: 'draft', statusAfter: 'submitted', version })
    submission = (await getSubmission(db, options.tenantId, id))!
  }
  return submission
}

function assertOwnSubmission(submission: ReturnType<typeof mapSubmission>, actor: Actor) {
  if (String(submission.teacherId).toLowerCase() !== String(actor.id).toLowerCase()) throw new SubmissionError('Submission not found.', 404)
}

/** A teacher changing their own work, within the school's rules. */
export async function editSubmission(db: D1Database, options: { tenantId: string, id: string, actor: Actor, policy: SubmissionPolicy, input: Record<string, any> }) {
  const submission = await getSubmission(db, options.tenantId, options.id)
  if (!submission) throw new SubmissionError('Submission not found.', 404)
  assertOwnSubmission(submission, options.actor)
  const editable = submission.status === 'draft' || submission.status === 'returned'
    || (options.policy.allowEditBeforeReview && (submission.status === 'submitted' || submission.status === 'resubmitted'))
  if (!editable) throw new SubmissionError(submission.status === 'approved' ? 'Approved work cannot be changed.' : 'This work is being reviewed and cannot be changed now.', 409)

  const has = (key: string) => Object.prototype.hasOwnProperty.call(options.input, key)
  const next = {
    title: has('title') ? String(options.input.title || '').trim().slice(0, 200) || submission.title : submission.title,
    content: has('content') ? String(options.input.content || '').slice(0, 100000) : submission.content,
    files: has('files') ? normalizeFiles(options.input.files) : submission.files,
    weekNumber: has('weekNumber') ? normalizeWeek(options.input.weekNumber) : submission.weekNumber,
    periodLabel: has('periodLabel') ? String(options.input.periodLabel || '').trim().slice(0, 60) : submission.periodLabel,
  }
  const timestamp = new Date().toISOString()
  await db.prepare(`UPDATE teacher_submissions SET title = ?, content = ?, files_json = ?, week_number = ?, period_label = ?, updated_at = ? WHERE id = ? AND tenant_id = ?`)
    .bind(next.title, next.content, JSON.stringify(next.files), next.weekNumber, next.periodLabel || null, timestamp, submission.id, options.tenantId).run()
  const changed = Object.keys(next).filter(key => JSON.stringify((next as any)[key]) !== JSON.stringify((submission as any)[key]))
  await recordSubmissionAudit(db, { tenantId: options.tenantId, submissionId: submission.id, action: 'edited', actor: options.actor, statusBefore: submission.status, statusAfter: submission.status, version: submission.version, details: { changed } })

  // Editing work already handed in replaces what the reviewer will see, so it is frozen again as a new version.
  if (submission.status === 'submitted' || submission.status === 'resubmitted') {
    const fresh = (await getSubmission(db, options.tenantId, submission.id))!
    const version = await freezeVersion(db, options.tenantId, fresh, submission.status, timestamp)
    await recordSubmissionAudit(db, { tenantId: options.tenantId, submissionId: submission.id, action: 'revised_before_review', actor: options.actor, statusBefore: submission.status, statusAfter: submission.status, version })
  }
  return (await getSubmission(db, options.tenantId, submission.id))!
}

/** Submit a draft, or resubmit returned work as a new version. */
export async function submitSubmission(db: D1Database, options: { tenantId: string, id: string, actor: Actor }) {
  const submission = await getSubmission(db, options.tenantId, options.id)
  if (!submission) throw new SubmissionError('Submission not found.', 404)
  assertOwnSubmission(submission, options.actor)
  if (submission.status !== 'draft' && submission.status !== 'returned') throw new SubmissionError('Only a draft or returned work can be submitted.', 409)
  if (!submission.content.trim() && !submission.files.length) throw new SubmissionError('Add the work itself — text or at least one file — before submitting.')
  const status = submission.status === 'returned' ? 'resubmitted' : 'submitted'
  const version = await freezeVersion(db, options.tenantId, submission, status, new Date().toISOString())
  await recordSubmissionAudit(db, { tenantId: options.tenantId, submissionId: submission.id, action: status, actor: options.actor, statusBefore: submission.status, statusAfter: status, version })
  return (await getSubmission(db, options.tenantId, submission.id))!
}

export async function deleteSubmission(db: D1Database, options: { tenantId: string, id: string, actor: Actor, policy: SubmissionPolicy }) {
  const submission = await getSubmission(db, options.tenantId, options.id)
  if (!submission) throw new SubmissionError('Submission not found.', 404)
  assertOwnSubmission(submission, options.actor)
  const deletable = submission.status === 'draft'
    || (options.policy.allowDeleteBeforeReview && (submission.status === 'submitted' || submission.status === 'resubmitted') && !submission.reviewedAt && submission.version <= 1)
  if (!deletable) throw new SubmissionError('Work that has been reviewed stays on record and cannot be deleted.', 409)
  const timestamp = new Date().toISOString()
  // The audit record lands first: a deletion that cannot be recorded does not happen.
  await recordSubmissionAudit(db, { tenantId: options.tenantId, submissionId: submission.id, action: 'deleted', actor: options.actor, statusBefore: submission.status, statusAfter: 'deleted', version: submission.version, details: { title: submission.title, type: submission.typeLabel, periodLabel: submission.periodLabel, classId: submission.classId, subjectId: submission.subjectId } })
  await db.prepare(`UPDATE teacher_submissions SET deleted_at = ?, updated_at = ? WHERE id = ? AND tenant_id = ?`).bind(timestamp, timestamp, submission.id, options.tenantId).run()
}

/** A reviewer opening work moves it to Under Review. */
export async function startReview(db: D1Database, options: { tenantId: string, id: string, actor: Actor }) {
  const submission = await getSubmission(db, options.tenantId, options.id)
  if (!submission) throw new SubmissionError('Submission not found.', 404)
  if (!OPEN_FOR_REVIEW.has(submission.status)) return submission
  if (submission.status !== 'under_review') {
    await db.prepare(`UPDATE teacher_submissions SET status = 'under_review', updated_at = ? WHERE id = ? AND tenant_id = ?`).bind(new Date().toISOString(), submission.id, options.tenantId).run()
    await recordSubmissionAudit(db, { tenantId: options.tenantId, submissionId: submission.id, action: 'review_started', actor: options.actor, statusBefore: submission.status, statusAfter: 'under_review', version: submission.version })
  }
  return (await getSubmission(db, options.tenantId, submission.id))!
}

export async function decideSubmission(db: D1Database, options: {
  tenantId: string, id: string, actor: Actor, policy: SubmissionPolicy, decision: unknown, feedback: unknown, score?: unknown,
}) {
  const submission = await getSubmission(db, options.tenantId, options.id)
  if (!submission) throw new SubmissionError('Submission not found.', 404)
  if (!OPEN_FOR_REVIEW.has(submission.status)) throw new SubmissionError('Only work that is waiting for review can be approved or returned.', 409)
  const decision = String(options.decision || '')
  if (!['approve', 'return'].includes(decision)) throw new SubmissionError('Choose Approve or Return for correction.')
  const feedback = String(options.feedback || '').trim().slice(0, 8000)
  if (decision === 'return' && !feedback) throw new SubmissionError('Say what needs correcting when returning work.')
  let score: number | null = null
  if (options.policy.reviewMode === 'score') {
    score = Number(options.score)
    if (!Number.isFinite(score) || score < 0 || score > options.policy.maxScore) throw new SubmissionError(`Give a score between 0 and ${options.policy.maxScore}.`)
  }
  const status = decision === 'approve' ? 'approved' : 'returned'
  const timestamp = new Date().toISOString()
  await db.batch([
    db.prepare(`UPDATE teacher_submissions SET status = ?, decision = ?, score = ?, feedback = ?, reviewed_by = ?, reviewed_by_name = ?, reviewed_at = ?, updated_at = ?
      WHERE id = ? AND tenant_id = ?`).bind(status, decision, score, feedback || null, options.actor.id, options.actor.name, timestamp, timestamp, submission.id, options.tenantId),
    db.prepare(`UPDATE teacher_submission_versions SET outcome = ?, score = ?, feedback = ?, reviewed_by_name = ?, reviewed_at = ? WHERE submission_id = ? AND version = ?`)
      .bind(status, score, feedback || null, options.actor.name, timestamp, submission.id, submission.version),
  ])
  await recordSubmissionAudit(db, { tenantId: options.tenantId, submissionId: submission.id, action: status, actor: options.actor, statusBefore: submission.status, statusAfter: status, version: submission.version, details: { score, feedback } })
  return (await getSubmission(db, options.tenantId, submission.id))!
}

export async function getSubmissionHistory(db: D1Database, tenantId: string, id: string) {
  await ensureSubmissionTables(db)
  const [versions, events] = await Promise.all([
    db.prepare(`SELECT * FROM teacher_submission_versions WHERE tenant_id = ? AND submission_id = ? ORDER BY version DESC`).bind(tenantId, id).all(),
    db.prepare(`SELECT action, actor_name, actor_role, status_before, status_after, version, details, created_at FROM teacher_submission_audit WHERE tenant_id = ? AND submission_id = ? ORDER BY created_at DESC`).bind(tenantId, id).all(),
  ])
  return {
    versions: ((versions.results || []) as Record<string, any>[]).map(row => ({
      version: Number(row.version), title: row.title, content: row.content || '', files: parse(row.files_json, [] as any[]),
      submittedStatus: row.submitted_status, submittedAt: row.submitted_at, outcome: row.outcome || '', score: row.score == null ? null : Number(row.score),
      feedback: row.feedback || '', reviewedByName: row.reviewed_by_name || '', reviewedAt: row.reviewed_at || null,
    })),
    events: ((events.results || []) as Record<string, any>[]).map(row => ({
      action: row.action, actorName: row.actor_name || '', actorRole: row.actor_role || '', statusBefore: row.status_before || '', statusAfter: row.status_after || '',
      version: row.version == null ? null : Number(row.version), details: parse(row.details, {}), createdAt: row.created_at,
    })),
  }
}

export async function listSubmissions(db: D1Database, tenantId: string, filters: Record<string, any>) {
  await ensureSubmissionTables(db)
  const where = ['tenant_id = ?', 'deleted_at IS NULL']
  const params: unknown[] = [tenantId]
  const add = (sql: string, value: unknown) => { if (value !== undefined && value !== null && String(value) !== '') { where.push(sql); params.push(value) } }
  add('lower(teacher_id) = lower(?)', filters.teacherId)
  add('class_id = ?', filters.classId)
  add('subject_id = ?', filters.subjectId)
  add('type = ?', filters.type)
  add('week_number = ?', filters.weekNumber ? Number(filters.weekNumber) : '')
  add('status = ?', filters.status)
  add('session_id = ?', filters.sessionId)
  add('term_id = ?', filters.termId)
  add('substr(COALESCE(submitted_at, created_at), 1, 10) >= ?', filters.from)
  add('substr(COALESCE(submitted_at, created_at), 1, 10) <= ?', filters.to)
  if (filters.excludeDrafts) where.push(`status != 'draft'`)
  const rows = await db.prepare(`SELECT * FROM teacher_submissions WHERE ${where.join(' AND ')}
    ORDER BY session_name DESC, term_name DESC, class_name, subject_name, teacher_name, type_label, week_number, created_at DESC LIMIT 2000`).bind(...params).all()
  return ((rows.results || []) as Record<string, any>[]).map(mapSubmission)
}

/** Date (YYYY-MM-DD) a weekly requirement is due in a given week of the term. */
export function weeklyDueDate(termStart: string, weekNumber: number, dueWeekday: number) {
  const start = new Date(`${termStart}T00:00:00Z`)
  const weekStart = new Date(start.getTime() + (weekNumber - 1) * 7 * 86400000)
  const offset = (dueWeekday - weekStart.getUTCDay() + 7) % 7
  return new Date(weekStart.getTime() + offset * 86400000).toISOString().slice(0, 10)
}

/**
 * Who owes what. For each assigned teacher, subject and required type, every
 * week whose due date has passed (weekly) or the term (termly) is expected.
 * Missing = nothing submitted for it; late = first submitted after the due date.
 */
export function computeExpectations(options: {
  policy: SubmissionPolicy, termStart: string, termEnd: string, today: string,
  assignments: Array<{ classId: string, className: string, subjectId: string, subjectName: string, teacherId: string, teacherName: string }>,
  submissions: Array<ReturnType<typeof mapSubmission>>,
}) {
  const missing: Array<Record<string, any>> = []
  const late: Array<Record<string, any>> = []
  const lastDay = options.today < options.termEnd ? options.today : options.termEnd
  for (const assignment of options.assignments) {
    for (const requirement of options.policy.requirements) {
      const expected: Array<{ weekNumber: number | null, due: string }> = []
      if (requirement.cadence === 'termly') {
        if (options.termEnd <= options.today) expected.push({ weekNumber: null, due: options.termEnd })
      } else {
        for (let week = 1; week <= 20; week += 1) {
          const due = weeklyDueDate(options.termStart, week, requirement.dueWeekday)
          if (due > lastDay || due > options.termEnd) break
          expected.push({ weekNumber: week, due })
        }
      }
      for (const item of expected) {
        const match = options.submissions.find(submission => submission.classId === assignment.classId && submission.subjectId === assignment.subjectId
          && submission.type === requirement.type && String(submission.teacherId).toLowerCase() === String(assignment.teacherId).toLowerCase()
          && (item.weekNumber === null || submission.weekNumber === item.weekNumber) && submission.status !== 'draft')
        const base = { ...assignment, type: requirement.type, weekNumber: item.weekNumber, dueDate: item.due }
        if (!match) missing.push(base)
        else if (match.firstSubmittedAt && match.firstSubmittedAt.slice(0, 10) > item.due) late.push({ ...base, submissionId: match.id, submittedAt: match.firstSubmittedAt })
      }
    }
  }
  return { missing, late }
}

/** What the reviewer is told to look at; the AI's view is advice, never the decision. */
export function buildAiReviewPrompt(submission: ReturnType<typeof mapSubmission>, criteria: string[]) {
  return [
    `You are assisting a school leader who is reviewing a teacher's ${submission.typeLabel} for ${submission.subjectName}, ${submission.className}${submission.periodLabel ? `, ${submission.periodLabel}` : ''}.`,
    `Review it against these criteria: ${criteria.join('; ')}.`,
    'Base every observation only on the text provided. Do not invent content, ratings or comments that are not supported by it. If something cannot be judged from the text (for example an attached file you cannot see), say so.',
    'You are giving advice to the reviewer, who makes the final decision. Do not approve or reject the work yourself.',
    'Answer in this format:',
    '# Preliminary review', '## Strengths', '- ...', '## Suggestions', '- ...', '## Criteria',
    '| Criterion | Observation |', '|---|---|',
    'Key point: one sentence the reviewer should know first.',
  ].join('\n')
}
