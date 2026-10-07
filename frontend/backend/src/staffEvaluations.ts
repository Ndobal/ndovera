// Staff evaluation (peer review) exercises.
//
// The school sets the questions, rating scale, who reviews, who is reviewed and
// the window. Status follows the dates: Not Started → Open → Closed, closing on
// its own at the deadline unless an administrator extends it.
//
// Anonymity: a response is stored against its reviewer only so each reviewer
// answers once per colleague. No result, completion figure or export ever
// links a reviewer to their answers — management sees averages, unattributed
// comments and completion rates.
//
// AI summaries work only from the submitted ratings and comments and are told
// not to invent any.

export class EvaluationError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

export type Question = { id: string, text: string, kind: 'rating' | 'comment' }
export type Eligibility = { mode: 'all' | 'roles' | 'people', roles: string[], people: string[] }

const NON_STAFF_ROLES = new Set(['student', 'parent', 'ami', 'growthpartner', 'caregiver'])

let _ready = false
export function resetStaffEvaluationsCache() {
  _ready = false
}

export async function ensureEvaluationTables(db: D1Database) {
  if (_ready) return
  await db.prepare(`CREATE TABLE IF NOT EXISTS staff_evaluations (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    title TEXT NOT NULL,
    period_label TEXT,
    questions_json TEXT NOT NULL,
    scale_min INTEGER NOT NULL DEFAULT 1,
    scale_max INTEGER NOT NULL DEFAULT 5,
    scale_labels_json TEXT,
    reviewers_json TEXT NOT NULL,
    subjects_json TEXT NOT NULL,
    opens_at TEXT NOT NULL,
    closes_at TEXT NOT NULL,
    closed_at TEXT,
    created_by TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`).run()
  await db.prepare(`CREATE TABLE IF NOT EXISTS staff_evaluation_responses (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    evaluation_id TEXT NOT NULL,
    reviewer_id TEXT NOT NULL,
    subject_id TEXT NOT NULL,
    answers_json TEXT NOT NULL,
    submitted_at TEXT NOT NULL,
    UNIQUE(evaluation_id, reviewer_id, subject_id)
  )`).run()
  await db.prepare(`CREATE TABLE IF NOT EXISTS staff_evaluation_summaries (
    evaluation_id TEXT NOT NULL,
    subject_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    summary TEXT NOT NULL,
    response_count INTEGER NOT NULL,
    generated_by TEXT,
    generated_at TEXT NOT NULL,
    PRIMARY KEY (evaluation_id, subject_id)
  )`).run()
  _ready = true
}

const parse = <T>(value: unknown, fallback: T): T => {
  try { return value ? JSON.parse(String(value)) as T : fallback } catch { return fallback }
}

export function evaluationStatus(row: { opens_at: string, closes_at: string, closed_at?: string | null }, now = new Date().toISOString()) {
  if (row.closed_at) return 'closed'
  if (now < row.opens_at) return 'not_started'
  if (now > row.closes_at) return 'closed'
  return 'open'
}

function normalizeEligibility(value: any): Eligibility {
  const mode = ['roles', 'people'].includes(value?.mode) ? value.mode : 'all'
  return {
    mode,
    roles: (Array.isArray(value?.roles) ? value.roles : []).map((role: unknown) => String(role || '').trim().toLowerCase()).filter(Boolean),
    people: (Array.isArray(value?.people) ? value.people : []).map((id: unknown) => String(id || '').trim()).filter(Boolean),
  }
}

function normalizeQuestions(value: unknown): Question[] {
  const list = (Array.isArray(value) ? value : []).slice(0, 40).map((item: any, index: number) => ({
    id: String(item?.id || `q${index + 1}`).slice(0, 40),
    text: String(item?.text || '').trim().slice(0, 300),
    kind: (item?.kind === 'comment' ? 'comment' : 'rating') as Question['kind'],
  })).filter(item => item.text)
  if (!list.length) throw new EvaluationError('Add at least one question.')
  return list
}

function normalizeDate(value: unknown, label: string) {
  const parsed = new Date(String(value || ''))
  if (Number.isNaN(parsed.getTime())) throw new EvaluationError(`Give a valid ${label}.`)
  return parsed.toISOString()
}

export function mapEvaluation(row: Record<string, any>) {
  return {
    id: String(row.id),
    title: String(row.title),
    periodLabel: String(row.period_label || ''),
    questions: parse(row.questions_json, [] as Question[]),
    scale: { min: Number(row.scale_min), max: Number(row.scale_max), labels: parse(row.scale_labels_json, [] as string[]) },
    reviewers: parse(row.reviewers_json, { mode: 'all', roles: [], people: [] } as Eligibility),
    subjects: parse(row.subjects_json, { mode: 'all', roles: [], people: [] } as Eligibility),
    opensAt: row.opens_at,
    closesAt: row.closes_at,
    closedAt: row.closed_at || null,
    status: evaluationStatus(row as any),
    createdAt: row.created_at,
  }
}

export async function saveEvaluation(db: D1Database, options: { tenantId: string, id?: string, input: Record<string, any>, actorId: string }) {
  await ensureEvaluationTables(db)
  const title = String(options.input.title || '').trim().slice(0, 150)
  if (!title) throw new EvaluationError('Give the evaluation a title.')
  const questions = normalizeQuestions(options.input.questions)
  const min = Math.max(0, Math.min(10, Number(options.input.scale?.min ?? 1)))
  const max = Math.max(min + 1, Math.min(10, Number(options.input.scale?.max ?? 5)))
  const opensAt = normalizeDate(options.input.opensAt, 'opening date')
  const closesAt = normalizeDate(options.input.closesAt, 'closing date')
  if (closesAt <= opensAt) throw new EvaluationError('The closing date must come after the opening date.')
  const now = new Date().toISOString()
  const fields = [title, String(options.input.periodLabel || '').slice(0, 80), JSON.stringify(questions), min, max,
    JSON.stringify((Array.isArray(options.input.scale?.labels) ? options.input.scale.labels : []).map(String).slice(0, 11)),
    JSON.stringify(normalizeEligibility(options.input.reviewers)), JSON.stringify(normalizeEligibility(options.input.subjects)), opensAt, closesAt]

  if (!options.id) {
    const id = `eval-${crypto.randomUUID()}`
    await db.prepare(`INSERT INTO staff_evaluations (id, tenant_id, title, period_label, questions_json, scale_min, scale_max, scale_labels_json, reviewers_json, subjects_json, opens_at, closes_at, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(id, options.tenantId, ...fields, options.actorId || null, now, now).run()
    return (await getEvaluation(db, options.tenantId, id))!
  }

  const existing = await getEvaluation(db, options.tenantId, options.id)
  if (!existing) throw new EvaluationError('Evaluation not found.', 404)
  const responses = await db.prepare(`SELECT COUNT(*) AS n FROM staff_evaluation_responses WHERE evaluation_id = ?`).bind(existing.id).first() as Record<string, any>
  // Once answers exist, only the window can change: changing the questions under
  // people who have answered would make the results meaningless.
  if (Number(responses?.n || 0) > 0) {
    await db.prepare(`UPDATE staff_evaluations SET closes_at = ?, closed_at = NULL, updated_at = ? WHERE id = ? AND tenant_id = ?`).bind(closesAt, now, existing.id, options.tenantId).run()
  } else {
    await db.prepare(`UPDATE staff_evaluations SET title = ?, period_label = ?, questions_json = ?, scale_min = ?, scale_max = ?, scale_labels_json = ?, reviewers_json = ?, subjects_json = ?, opens_at = ?, closes_at = ?, closed_at = NULL, updated_at = ?
      WHERE id = ? AND tenant_id = ?`).bind(...fields, now, existing.id, options.tenantId).run()
  }
  return (await getEvaluation(db, options.tenantId, existing.id))!
}

export async function closeEvaluation(db: D1Database, tenantId: string, id: string) {
  await ensureEvaluationTables(db)
  await db.prepare(`UPDATE staff_evaluations SET closed_at = ?, updated_at = ? WHERE id = ? AND tenant_id = ?`).bind(new Date().toISOString(), new Date().toISOString(), id, tenantId).run()
  return getEvaluation(db, tenantId, id)
}

export async function getEvaluation(db: D1Database, tenantId: string, id: string) {
  await ensureEvaluationTables(db)
  const row = await db.prepare(`SELECT * FROM staff_evaluations WHERE id = ? AND tenant_id = ?`).bind(id, tenantId).first() as Record<string, any> | null
  return row ? mapEvaluation(row) : null
}

export async function listEvaluations(db: D1Database, tenantId: string) {
  await ensureEvaluationTables(db)
  const rows = await db.prepare(`SELECT * FROM staff_evaluations WHERE tenant_id = ? ORDER BY opens_at DESC`).bind(tenantId).all()
  return ((rows.results || []) as Record<string, any>[]).map(mapEvaluation)
}

export type StaffMember = { id: string, email: string, name: string, roles: string[] }

/** Staff of the school: everyone whose roles are not student, parent or platform roles. */
export async function listSchoolStaff(db: D1Database, tenantId: string): Promise<StaffMember[]> {
  const rows = await db.prepare(`SELECT u.id, u.email, u.name, u.role, s.payload FROM users u LEFT JOIN settings s ON lower(s.studentId) = lower(u.email)
    WHERE u.tenantId = ? AND COALESCE(u.status, 'active') != 'inactive'`).bind(tenantId).all().catch(() => ({ results: [] }))
  return ((rows.results || []) as Record<string, any>[]).map(row => {
    const payload = parse(row.payload, {} as Record<string, any>)
    const roles = [...new Set([row.role, payload.role, ...(Array.isArray(payload.roles) ? payload.roles : [])].map(role => String(role || '').trim().toLowerCase()).filter(Boolean))]
    return { id: String(row.id), email: String(row.email || ''), name: String(row.name || payload.name || row.email || row.id), roles }
  }).filter(person => person.roles.some(role => !NON_STAFF_ROLES.has(role)))
}

function eligible(person: StaffMember, rule: Eligibility) {
  if (rule.mode === 'people') return rule.people.some(id => [person.id, person.email].some(value => value.toLowerCase() === id.toLowerCase()))
  if (rule.mode === 'roles') return person.roles.some(role => rule.roles.includes(role))
  return true
}

export function reviewersOf(evaluation: ReturnType<typeof mapEvaluation>, staff: StaffMember[]) {
  return staff.filter(person => eligible(person, evaluation.reviewers))
}

export function subjectsOf(evaluation: ReturnType<typeof mapEvaluation>, staff: StaffMember[]) {
  return staff.filter(person => eligible(person, evaluation.subjects))
}

const sameId = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

/** What a member of staff still has to do in an evaluation. */
export async function getReviewerAssignments(db: D1Database, evaluation: ReturnType<typeof mapEvaluation>, staff: StaffMember[], reviewer: StaffMember) {
  if (!reviewersOf(evaluation, staff).some(person => sameId(person.id, reviewer.id))) return null
  const done = await db.prepare(`SELECT subject_id FROM staff_evaluation_responses WHERE evaluation_id = ? AND lower(reviewer_id) = lower(?)`).bind(evaluation.id, reviewer.id).all()
  const doneIds = new Set(((done.results || []) as Record<string, any>[]).map(row => String(row.subject_id).toLowerCase()))
  return subjectsOf(evaluation, staff)
    .filter(person => !sameId(person.id, reviewer.id))
    .map(person => ({ id: person.id, name: person.name, done: doneIds.has(person.id.toLowerCase()) }))
}

export async function submitResponse(db: D1Database, options: {
  tenantId: string, evaluation: ReturnType<typeof mapEvaluation>, staff: StaffMember[], reviewer: StaffMember, subjectId: string, answers: Record<string, unknown>,
}) {
  if (options.evaluation.status !== 'open') throw new EvaluationError(options.evaluation.status === 'closed' ? 'This evaluation has closed.' : 'This evaluation has not opened yet.', 409)
  const assignments = await getReviewerAssignments(db, options.evaluation, options.staff, options.reviewer)
  const target = assignments?.find(item => sameId(item.id, options.subjectId))
  if (!assignments || !target) throw new EvaluationError('You are not asked to review this colleague.', 403)
  if (target.done) throw new EvaluationError('You have already reviewed this colleague.', 409)
  const answers: Record<string, number | string> = {}
  for (const question of options.evaluation.questions) {
    const value = options.answers?.[question.id]
    if (question.kind === 'rating') {
      const rating = Number(value)
      if (!Number.isInteger(rating) || rating < options.evaluation.scale.min || rating > options.evaluation.scale.max) {
        throw new EvaluationError(`Rate "${question.text}" from ${options.evaluation.scale.min} to ${options.evaluation.scale.max}.`)
      }
      answers[question.id] = rating
    } else {
      answers[question.id] = String(value || '').trim().slice(0, 2000)
    }
  }
  await db.prepare(`INSERT INTO staff_evaluation_responses (id, tenant_id, evaluation_id, reviewer_id, subject_id, answers_json, submitted_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .bind(`evresp-${crypto.randomUUID()}`, options.tenantId, options.evaluation.id, options.reviewer.id, target.id, JSON.stringify(answers), new Date().toISOString()).run()
}

/**
 * Aggregated results. Nothing here identifies a reviewer: completion is a rate,
 * comments are unattributed and returned in a fixed, non-chronological order.
 */
export async function getEvaluationResults(db: D1Database, evaluation: ReturnType<typeof mapEvaluation>, staff: StaffMember[]) {
  const rows = await db.prepare(`SELECT reviewer_id, subject_id, answers_json FROM staff_evaluation_responses WHERE evaluation_id = ?`).bind(evaluation.id).all()
  const responses = ((rows.results || []) as Record<string, any>[]).map(row => ({ reviewerId: String(row.reviewer_id), subjectId: String(row.subject_id), answers: parse(row.answers_json, {} as Record<string, any>) }))
  const reviewers = reviewersOf(evaluation, staff)
  const subjects = subjectsOf(evaluation, staff)
  const summaries = await db.prepare(`SELECT subject_id, summary, response_count, generated_at FROM staff_evaluation_summaries WHERE evaluation_id = ?`).bind(evaluation.id).all()
  const summaryBy = new Map(((summaries.results || []) as Record<string, any>[]).map(row => [String(row.subject_id), row]))

  const expected = reviewers.reduce((total, reviewer) => total + subjects.filter(subject => !sameId(subject.id, reviewer.id)).length, 0)
  const reviewersStarted = new Set(responses.map(response => response.reviewerId.toLowerCase()))
  const reviewersFinished = reviewers.filter(reviewer => {
    const owed = subjects.filter(subject => !sameId(subject.id, reviewer.id)).length
    return owed > 0 && responses.filter(response => sameId(response.reviewerId, reviewer.id)).length >= owed
  }).length

  const perStaff = subjects.map(subject => {
    const mine = responses.filter(response => sameId(response.subjectId, subject.id))
    const questions = evaluation.questions.map(question => {
      if (question.kind === 'rating') {
        const values = mine.map(response => Number(response.answers[question.id])).filter(Number.isFinite)
        return { id: question.id, text: question.text, kind: question.kind, average: values.length ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100 : null, count: values.length }
      }
      const comments = mine.map(response => String(response.answers[question.id] || '').trim()).filter(Boolean).sort((a, b) => a.localeCompare(b))
      return { id: question.id, text: question.text, kind: question.kind, comments }
    })
    const ratingAverages = questions.filter(item => item.kind === 'rating' && item.average != null).map(item => (item as any).average as number)
    const summary = summaryBy.get(subject.id.toLowerCase()) || summaryBy.get(subject.id)
    return {
      staffId: subject.id, name: subject.name, responses: mine.length,
      overall: ratingAverages.length ? Math.round((ratingAverages.reduce((a, b) => a + b, 0) / ratingAverages.length) * 100) / 100 : null,
      questions,
      aiSummary: summary ? { text: summary.summary, responseCount: Number(summary.response_count), generatedAt: summary.generated_at } : null,
    }
  })

  return {
    completion: {
      eligibleReviewers: reviewers.length,
      reviewersStarted: reviewersStarted.size,
      reviewersFinished,
      responsesReceived: responses.length,
      responsesExpected: expected,
      rate: expected ? Math.round((responses.length / expected) * 1000) / 10 : 0,
    },
    staff: perStaff.sort((a, b) => a.name.localeCompare(b.name)),
  }
}

export function buildEvaluationSummaryPrompt(name: string, scale: { min: number, max: number }, staffResult: { responses: number, questions: Array<Record<string, any>> }) {
  const lines = staffResult.questions.map(question => question.kind === 'rating'
    ? `Rating — ${question.text}: average ${question.average ?? 'no ratings'} on a ${scale.min}–${scale.max} scale from ${question.count} responses.`
    : `Comments — ${question.text}:\n${(question.comments || []).map((comment: string) => `- ${comment}`).join('\n') || '- (none)'}`)
  return {
    system: [
      'You summarise peer feedback about one member of school staff for school management.',
      'Use only the averages and comments provided. Do not invent ratings, comments, examples or events that are not in them.',
      'Do not guess who wrote any comment. If the feedback is thin or mixed, say so plainly.',
      'Format: "# Summary", then "## Recurring strengths" and "## Recurring concerns" as bullet lists, then "Key point: ..." with the single most useful takeaway for management.',
    ].join(' '),
    user: `Staff member: ${name}. Responses received: ${staffResult.responses}.\n\n${lines.join('\n\n')}`,
  }
}

export async function saveEvaluationSummary(db: D1Database, options: { tenantId: string, evaluationId: string, staffId: string, summary: string, responseCount: number, actorId: string }) {
  await db.prepare(`INSERT INTO staff_evaluation_summaries (evaluation_id, subject_id, tenant_id, summary, response_count, generated_by, generated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(evaluation_id, subject_id) DO UPDATE SET summary = excluded.summary, response_count = excluded.response_count, generated_by = excluded.generated_by, generated_at = excluded.generated_at`)
    .bind(options.evaluationId, options.staffId, options.tenantId, options.summary, options.responseCount, options.actorId || null, new Date().toISOString()).run()
}
