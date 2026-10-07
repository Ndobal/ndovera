// Storage and workflow for Ndovera AI assessments (logic in assessmentEngine.ts).
//
// An assessment is a draft owned by its teacher and school. Generation happens
// a few questions at a time (the browser calls generateNext until nothing is
// pending), so long papers never hit request time limits and the teacher sees
// progress. Every save is a new version — never an overwrite — recording who
// changed what and when.

import {
  AssessmentConfig, AssessmentError, Blueprint, Question, Slot, ASSESSMENT_PROFILES, auditAssessment, buildGenerationPrompt,
  auditAssessment, buildReviewPrompt, normalizeBlueprint, normalizeConfig, normalizeQuestion, optionCountFor, parseQuestionsJson, placeAnswer, planSlots, proposeBlueprint, randomiseAnswers, seededRandom,
} from './assessmentEngine'

export type AiRunner = (messages: Array<{ role: string, content: string }>, options: { maxTokens: number, temperature: number }) => Promise<string>
export type Actor = { id: string, name: string, role: string }

/** How many slots one model call writes: many short items, few long ones. */
function batchFor(pending: Slot[]) {
  const first = pending[0]
  if (!first) return pending
  const size = first.parts ? 2 : ['mcq', 'truefalse', 'fill'].includes(first.type) ? 6 : 3
  // Keep a batch to one kind of question so the instructions stay focused.
  const same = pending.filter(slot => slot.type === first.type && Boolean(slot.parts) === Boolean(first.parts))
  return same.slice(0, size)
}
const tokensFor = (slots: Slot[]) => 600 + slots.reduce((sum, slot) => sum + (slot.parts ? 1300 : ['mcq', 'truefalse', 'fill'].includes(slot.type) ? 380 : 700), 0)
const STATUSES = ['draft', 'finalised', 'submitted', 'posted', 'scheduled'] as const

let _ready = false
export function resetAiAssessmentCache() { _ready = false }

export async function ensureAiAssessmentTables(db: D1Database) {
  if (_ready) return
  for (const statement of [
    `CREATE TABLE IF NOT EXISTS ai_assessments (
      id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, class_id TEXT NOT NULL, class_name TEXT, subject_id TEXT NOT NULL, subject_name TEXT,
      session_name TEXT, term_name TEXT, kind TEXT NOT NULL, title TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft',
      config_json TEXT NOT NULL, blueprint_json TEXT, blueprint_approved INTEGER NOT NULL DEFAULT 0,
      slots_json TEXT NOT NULL DEFAULT '[]', questions_json TEXT NOT NULL DEFAULT '[]', failed_json TEXT NOT NULL DEFAULT '[]',
      review_json TEXT, delivery_json TEXT, version INTEGER NOT NULL DEFAULT 0,
      posted_assignment_id TEXT, submission_id TEXT,
      created_by TEXT NOT NULL, created_by_name TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS ai_assessment_versions (
      id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, assessment_id TEXT NOT NULL, version INTEGER NOT NULL, label TEXT NOT NULL,
      change_summary TEXT, snapshot_json TEXT NOT NULL, changed_by TEXT, changed_by_name TEXT, created_at TEXT NOT NULL,
      UNIQUE(assessment_id, version)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_ai_assessments_owner ON ai_assessments(tenant_id, created_by, updated_at)`,
    `CREATE INDEX IF NOT EXISTS idx_ai_assessments_class ON ai_assessments(tenant_id, class_id, subject_id)`,
    `CREATE TABLE IF NOT EXISTS exam_letterheads (tenant_id TEXT PRIMARY KEY, payload TEXT NOT NULL, updated_by TEXT, updated_at TEXT NOT NULL)`,
  ]) {
    await db.prepare(statement).run()
  }
  _ready = true
}

const parse = <T>(value: unknown, fallback: T): T => { try { return value ? JSON.parse(String(value)) as T : fallback } catch { return fallback } }

export function mapAssessment(row: Record<string, any>) {
  return {
    id: String(row.id), tenantId: row.tenant_id, classId: row.class_id, className: row.class_name || '', subjectId: row.subject_id, subjectName: row.subject_name || '',
    sessionName: row.session_name || '', termName: row.term_name || '', kind: row.kind, title: row.title, status: row.status,
    config: parse<AssessmentConfig>(row.config_json, {} as AssessmentConfig), blueprint: parse<Blueprint | null>(row.blueprint_json, null), blueprintApproved: Boolean(Number(row.blueprint_approved)),
    slots: parse<Slot[]>(row.slots_json, []), questions: parse<Question[]>(row.questions_json, []), failed: parse<number[]>(row.failed_json, []),
    review: parse<any>(row.review_json, null), delivery: parse<any>(row.delivery_json, null), version: Number(row.version || 0),
    postedAssignmentId: row.posted_assignment_id || '', submissionId: row.submission_id || '',
    createdBy: row.created_by, createdByName: row.created_by_name || '', createdAt: row.created_at, updatedAt: row.updated_at,
  }
}
export type Assessment = ReturnType<typeof mapAssessment>

export function pendingSlots(assessment: Assessment) {
  const filled = new Set(assessment.questions.map(question => question.slot))
  return assessment.slots.filter(slot => !filled.has(slot.index))
}

export async function getAssessment(db: D1Database, tenantId: string, id: string) {
  await ensureAiAssessmentTables(db)
  const row = await db.prepare(`SELECT * FROM ai_assessments WHERE id = ? AND tenant_id = ?`).bind(id, tenantId).first() as Record<string, any> | null
  return row ? mapAssessment(row) : null
}

/** Only the teacher who made it may change it; nobody outside the school may see it. */
export async function getOwnAssessment(db: D1Database, tenantId: string, id: string, actor: Actor) {
  const assessment = await getAssessment(db, tenantId, id)
  if (!assessment) throw new AssessmentError('Assessment not found.', 404)
  if (assessment.createdBy !== actor.id) throw new AssessmentError('Only the teacher who created this assessment can change it.', 403)
  return assessment
}

export async function listAssessments(db: D1Database, tenantId: string, filters: { createdBy?: string, classId?: string, subjectId?: string }) {
  await ensureAiAssessmentTables(db)
  const where = ['tenant_id = ?']
  const params: unknown[] = [tenantId]
  if (filters.createdBy) { where.push('created_by = ?'); params.push(filters.createdBy) }
  if (filters.classId) { where.push('class_id = ?'); params.push(filters.classId) }
  if (filters.subjectId) { where.push('subject_id = ?'); params.push(filters.subjectId) }
  const rows = await db.prepare(`SELECT id, class_id, class_name, subject_id, subject_name, kind, title, status, version, created_by_name, updated_at, questions_json, slots_json FROM ai_assessments WHERE ${where.join(' AND ')} ORDER BY updated_at DESC LIMIT 200`).bind(...params).all()
  return ((rows.results || []) as Record<string, any>[]).map(row => ({
    id: row.id, classId: row.class_id, className: row.class_name, subjectId: row.subject_id, subjectName: row.subject_name, kind: row.kind, title: row.title,
    status: row.status, version: Number(row.version || 0), createdByName: row.created_by_name, updatedAt: row.updated_at,
    questionCount: parse<any[]>(row.questions_json, []).length, plannedCount: parse<any[]>(row.slots_json, []).length,
  }))
}

/** Save the current state as a new numbered version. Nothing is overwritten. */
async function saveVersion(db: D1Database, assessment: Assessment, patch: Partial<Record<string, unknown>>, actor: Actor, label: string, summary: string) {
  const now = new Date().toISOString()
  const next = { ...assessment, ...patch }
  const version = assessment.version + 1
  const snapshot = { title: next.title, status: next.status, config: next.config, blueprint: next.blueprint, questions: next.questions, delivery: next.delivery }
  await db.batch([
    db.prepare(`UPDATE ai_assessments SET title = ?, status = ?, config_json = ?, blueprint_json = ?, blueprint_approved = ?, slots_json = ?, questions_json = ?, failed_json = ?,
        review_json = ?, delivery_json = ?, posted_assignment_id = ?, submission_id = ?, version = ?, updated_at = ? WHERE id = ? AND version = ?`).bind(
      next.title, next.status, JSON.stringify(next.config), next.blueprint ? JSON.stringify(next.blueprint) : null, next.blueprintApproved ? 1 : 0,
      JSON.stringify(next.slots), JSON.stringify(next.questions), JSON.stringify(next.failed), next.review ? JSON.stringify(next.review) : null,
      next.delivery ? JSON.stringify(next.delivery) : null, next.postedAssignmentId || null, next.submissionId || null, version, now, assessment.id, assessment.version),
    db.prepare(`INSERT INTO ai_assessment_versions (id, tenant_id, assessment_id, version, label, change_summary, snapshot_json, changed_by, changed_by_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(`aiav-${crypto.randomUUID()}`, assessment.tenantId, assessment.id, version, label, summary.slice(0, 1000), JSON.stringify(snapshot), actor.id, actor.name, now),
  ])
  const saved = await getAssessment(db, assessment.tenantId, assessment.id)
  if (!saved || saved.version !== version) throw new AssessmentError('This assessment was changed in another window. Reload and try again.', 409)
  return saved
}

/** Working state that is not worth a version of its own (generation progress). */
async function saveProgress(db: D1Database, assessment: Assessment, patch: { questions: Question[], failed: number[] }) {
  await db.prepare(`UPDATE ai_assessments SET questions_json = ?, failed_json = ?, updated_at = ? WHERE id = ? AND version = ?`)
    .bind(JSON.stringify(patch.questions), JSON.stringify(patch.failed), new Date().toISOString(), assessment.id, assessment.version).run()
  return (await getAssessment(db, assessment.tenantId, assessment.id))!
}

export async function listVersions(db: D1Database, tenantId: string, assessmentId: string) {
  await ensureAiAssessmentTables(db)
  const rows = await db.prepare(`SELECT version, label, change_summary, changed_by_name, created_at FROM ai_assessment_versions WHERE tenant_id = ? AND assessment_id = ? ORDER BY version DESC`).bind(tenantId, assessmentId).all()
  return ((rows.results || []) as Record<string, any>[]).map(row => ({ version: Number(row.version), label: row.label, summary: row.change_summary || '', changedBy: row.changed_by_name || '', createdAt: row.created_at }))
}

export async function getVersionSnapshot(db: D1Database, tenantId: string, assessmentId: string, version: number) {
  const row = await db.prepare(`SELECT snapshot_json, label, created_at, changed_by_name FROM ai_assessment_versions WHERE tenant_id = ? AND assessment_id = ? AND version = ?`).bind(tenantId, assessmentId, version).first() as Record<string, any> | null
  return row ? { ...parse<any>(row.snapshot_json, {}), label: row.label, createdAt: row.created_at, changedBy: row.changed_by_name } : null
}

// ─── Create, blueprint, generate ─────────────────────────────────────────────

export async function createAssessment(db: D1Database, options: {
  tenantId: string, actor: Actor, classId: string, className: string, subjectId: string, subjectName: string, sessionName: string, termName: string,
  input: Record<string, any>,
}) {
  await ensureAiAssessmentTables(db)
  const config = normalizeConfig(options.input, options.className)
  // The teacher's paper structure (sections, questions, marks each, parts,
  // compulsory) decides the paper. Without one, Ndovera proposes it.
  let blueprint: Blueprint | null = null
  if (Array.isArray(options.input.blueprint?.sections) && options.input.blueprint.sections.length) {
    blueprint = normalizeBlueprint(options.input.blueprint, config)
    config.totalMarks = blueprint.totalMarks
    config.questionCount = blueprint.sections.reduce((sum, section) => sum + section.questions, 0)
    config.types = [...new Set(blueprint.sections.map(section => section.type))]
  } else if (config.kind === 'exam') {
    blueprint = proposeBlueprint(config)
  }
  // Exams still get a review of the plan and topic coverage before writing;
  // quizzes, assignments and tests start writing from the structure at once.
  const approved = Boolean(blueprint) && config.kind !== 'exam'
  const slots = config.kind === 'exam' ? [] : planSlots(config, blueprint)
  const id = `aia-${crypto.randomUUID()}`
  const now = new Date().toISOString()
  const kindLabel = { quiz: 'Quiz', assignment: 'Assignment', test: 'Test', exam: 'Examination' }[config.kind]
  const title = String(options.input.title || '').trim().slice(0, 200) || `${options.subjectName} ${kindLabel}${config.topicNames.length === 1 ? ` — ${config.topicNames[0]}` : ''}`
  await db.prepare(`INSERT INTO ai_assessments (id, tenant_id, class_id, class_name, subject_id, subject_name, session_name, term_name, kind, title, status, config_json, blueprint_json, blueprint_approved, slots_json, created_by, created_by_name, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
    id, options.tenantId, options.classId, options.className, options.subjectId, options.subjectName, options.sessionName || null, options.termName || null,
    config.kind, title, JSON.stringify(config), blueprint ? JSON.stringify(blueprint) : null, approved ? 1 : 0, JSON.stringify(slots), options.actor.id, options.actor.name, now, now).run()
  return (await getAssessment(db, options.tenantId, id))!
}

/**
 * A paper the teacher typed, pasted or uploaded: no AI writing — it opens in the
 * same editor for checking, then goes through the same approval route.
 * Questions that still need something (an MCQ without its answer, a theory
 * question without a marking guide) are kept and listed, so nothing is lost.
 */
export async function importAssessment(db: D1Database, options: {
  tenantId: string, actor: Actor, classId: string, className: string, subjectId: string, subjectName: string, sessionName: string, termName: string,
  input: Record<string, any>, questions: any[], blueprint: { sections: any[] }, label: string, summary: string,
}) {
  const created = await createAssessment(db, { ...options, input: { ...options.input, blueprint: options.blueprint } })
  const problems: string[] = []
  const questions = options.questions.slice(0, 150).map((raw, index) => {
    const slot = { index: 10000 + index, section: raw?.section || 'A', type: raw?.type, bloom: raw?.bloom || 'understand', topic: raw?.topic || '', marks: raw?.marks }
    const { question, problems: issues } = normalizeQuestion({ ...raw, source: 'teacher' }, slot, optionCountFor(created.config))
    if (issues.length) problems.push(`Q${index + 1}: ${issues.join(' ')}`)
    return { ...question, slot: slot.index }
  })
  // The paper's own marks are the target: the teacher wrote them.
  const blueprint = created.blueprint ? { ...created.blueprint } : null
  if (blueprint) blueprint.totalMarks = auditAssessment(questions, created.config, blueprint).examMarks
  const config = { ...created.config, totalMarks: blueprint?.totalMarks || questions.reduce((sum, question) => sum + question.marks, 0), questionCount: questions.length }
  const assessment = await saveVersion(db, created, { questions, blueprint, config, blueprintApproved: true, slots: [] }, options.actor, options.label, options.summary)
  return { assessment, problems }
}

/** Exams: the teacher edits and approves the blueprint before any question is written. */
export async function approveBlueprint(db: D1Database, assessment: Assessment, input: unknown, actor: Actor) {
  if (assessment.kind !== 'exam') throw new AssessmentError('Only examinations use a blueprint.')
  if (assessment.questions.length) throw new AssessmentError('Questions have already been written from this blueprint.', 409)
  const blueprint = normalizeBlueprint(input, assessment.config)
  const config = { ...assessment.config, totalMarks: blueprint.totalMarks, topicNames: blueprint.topics.map(topic => topic.name) }
  const slots = planSlots(config, blueprint)
  return saveVersion(db, assessment, { blueprint, blueprintApproved: true, config, slots }, actor, 'Blueprint approved', `${blueprint.sections.length} section(s), ${slots.length} questions, ${blueprint.totalMarks} marks`)
}

/**
 * Write the next few pending questions. Call until `remaining` is 0; the last
 * call randomises the answer key and saves version 1 ("AI Generated").
 */
export async function generateNext(db: D1Database, assessment: Assessment, options: { runAi: AiRunner, context: string, actor: Actor }) {
  if (assessment.kind === 'exam' && !assessment.blueprintApproved) throw new AssessmentError('Approve the exam blueprint first.', 409)
  const failed = new Set(assessment.failed)
  const pending = pendingSlots(assessment).filter(slot => !failed.has(slot.index))
  if (!pending.length) return { assessment, remaining: 0, done: true }
  const batch = batchFor(pending)
  const profile = ASSESSMENT_PROFILES[assessment.config.standard] || ASSESSMENT_PROFILES.school
  const prompt = buildGenerationPrompt({
    config: assessment.config, slots: batch, subjectName: assessment.subjectName, className: assessment.className, context: options.context,
    existingPrompts: assessment.questions.map(question => question.prompt),
  })
  const accepted: Question[] = []
  let leftover = batch
  // Two tries for this batch; anything still invalid is marked failed for the teacher to regenerate or write.
  for (let attempt = 0; attempt < 2 && leftover.length; attempt += 1) {
    let reply = ''
    try {
      reply = await options.runAi([{ role: 'system', content: prompt.system }, { role: 'user', content: attempt === 0 ? prompt.user : buildGenerationPrompt({ config: assessment.config, slots: leftover, subjectName: assessment.subjectName, className: assessment.className, context: options.context, existingPrompts: [...assessment.questions, ...accepted].map(question => question.prompt) }).user }], { maxTokens: tokensFor(leftover), temperature: 0.6 })
    } catch (error) {
      if (attempt === 1) throw new AssessmentError('Ndovera AI is busy right now. Try again in a moment.', 503)
      continue
    }
    const items = parseQuestionsJson(reply)
    const stillMissing: Slot[] = []
    leftover.forEach((slot, index) => {
      const raw = items[index]
      if (!raw) { stillMissing.push(slot); return }
      // The plan, not the model, decides type, marks, level and section.
      const { question, problems } = normalizeQuestion({ ...raw, type: slot.type, marks: slot.marks, section: slot.section }, slot, optionCountFor(assessment.config))
      if (problems.length) { stillMissing.push(slot); return }
      accepted.push({ ...question, bloom: slot.bloom, topic: question.topic || slot.topic, slot: slot.index })
    })
    leftover = stillMissing
  }
  for (const slot of leftover) failed.add(slot.index)
  let questions = [...assessment.questions, ...accepted].sort((a, b) => a.slot - b.slot)
  const remaining = pendingSlots({ ...assessment, questions }).filter(slot => !failed.has(slot.index)).length
  if (remaining === 0) {
    questions = randomiseAnswers(questions)
    const saved = await saveVersion(db, assessment, { questions, failed: [...failed] }, options.actor, 'AI Generated', `${questions.length} question(s) written by Ndovera AI${failed.size ? `; ${failed.size} could not be written and need regenerating` : ''}`)
    return { assessment: saved, remaining: 0, done: true }
  }
  const saved = await saveProgress(db, assessment, { questions, failed: [...failed] })
  return { assessment: saved, remaining, done: false }
}

/** Rewrite one question (or write a slot that failed), keeping its plan. */
export async function regenerateQuestion(db: D1Database, assessment: Assessment, target: { questionId?: string, slot?: number }, options: { runAi: AiRunner, context: string, actor: Actor, instruction?: string }) {
  const existing = target.questionId ? assessment.questions.find(question => question.id === target.questionId) : null
  const slot = existing
    ? { index: existing.slot, section: existing.section, type: existing.type, bloom: existing.bloom, topic: existing.topic, marks: existing.marks, ...(existing.parts?.length ? { parts: existing.parts.length } : {}), ...(existing.compulsory ? { compulsory: true } : {}) }
    : assessment.slots.find(item => item.index === target.slot)
  if (!slot) throw new AssessmentError('Question not found.', 404)
  const profile = ASSESSMENT_PROFILES[assessment.config.standard] || ASSESSMENT_PROFILES.school
  const others = assessment.questions.filter(question => question.id !== existing?.id)
  const config = options.instruction ? { ...assessment.config, instructions: `${assessment.config.instructions}\nFor this question: ${options.instruction}`.trim() } : assessment.config
  const prompt = buildGenerationPrompt({ config, slots: [slot], subjectName: assessment.subjectName, className: assessment.className, context: options.context, existingPrompts: [...others.map(question => question.prompt), ...(existing ? [existing.prompt] : [])] })
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const reply = await options.runAi([{ role: 'system', content: prompt.system }, { role: 'user', content: prompt.user }], { maxTokens: 1500, temperature: 0.8 }).catch(() => '')
    const [raw] = parseQuestionsJson(reply)
    if (!raw) continue
    const { question, problems } = normalizeQuestion({ ...raw, type: slot.type, marks: slot.marks, section: slot.section }, slot, optionCountFor(assessment.config))
    if (problems.length) continue
    const fresh = { ...question, id: existing?.id || question.id, bloom: slot.bloom, slot: slot.index }
    // Keep the answer letter the randomiser chose for this position.
    const placed = existing && existing.type === 'mcq' && existing.answerIndex >= 0 ? placeAnswer(fresh, existing.answerIndex, seededRandom(Date.now())) : fresh
    const questions = existing ? assessment.questions.map(item => (item.id === existing.id ? placed : item)) : [...assessment.questions, placed].sort((a, b) => a.slot - b.slot)
    const failed = assessment.failed.filter(index => index !== slot.index)
    const index = questions.findIndex(item => item.id === placed.id) + 1
    return saveVersion(db, assessment, { questions, failed }, options.actor, 'Question regenerated', `Q${index} rewritten by Ndovera AI${options.instruction ? ` ("${options.instruction.slice(0, 80)}")` : ''}`)
  }
  throw new AssessmentError('Ndovera AI could not write a valid question this time. Try again, or write it yourself.', 502)
}

/** Teacher edits: questions, title, config tweaks. Each save is a version with a summary of what changed. */
export async function saveTeacherEdits(db: D1Database, assessment: Assessment, input: Record<string, any>, actor: Actor) {
  if (!['draft', 'finalised'].includes(assessment.status)) throw new AssessmentError('This assessment has been posted or submitted. Make a copy to change it.', 409)
  const profile = ASSESSMENT_PROFILES[assessment.config.standard] || ASSESSMENT_PROFILES.school
  const incoming = Array.isArray(input.questions) ? input.questions : assessment.questions
  const problems: string[] = []
  const questions: Question[] = incoming.slice(0, 120).map((raw: any, index: number) => {
    const previous = assessment.questions.find(question => question.id === raw?.id)
    const { question, problems: issues } = normalizeQuestion({ ...raw, source: previous?.source || raw?.source || 'teacher' }, { index: previous?.slot ?? (10000 + index), section: raw?.section || previous?.section || 'A', type: raw?.type, bloom: raw?.bloom, topic: raw?.topic, marks: raw?.marks }, optionCountFor(assessment.config))
    if (issues.length) problems.push(`Q${index + 1}: ${issues.join(' ')}`)
    return { ...question, slot: previous?.slot ?? (10000 + index) }
  })
  const title = String(input.title ?? assessment.title).trim().slice(0, 200) || assessment.title
  const changes = summarizeChanges(assessment.questions, questions)
  if (title !== assessment.title) changes.unshift('title changed')
  // A deleted question takes its planned slot with it. Slots the AI could not
  // write stay as to-dos unless the teacher drops them.
  const used = new Set(questions.map(question => question.slot))
  const keepFailed = input.dropFailed ? new Set<number>() : new Set(assessment.failed)
  const slots = assessment.slots.filter(slot => used.has(slot.index) || keepFailed.has(slot.index))
  const failed = assessment.failed.filter(index => keepFailed.has(index))
  if (input.dropFailed && assessment.failed.length) changes.push(`${assessment.failed.length} unwritten question(s) removed`)
  const saved = await saveVersion(db, assessment, { title, questions, slots, failed, status: 'draft' }, actor, 'Teacher Edited', changes.join('; ') || 'saved')
  return { assessment: saved, problems }
}

export function summarizeChanges(before: Question[], after: Question[]) {
  const changes: string[] = []
  const beforeIds = new Map(before.map((question, index) => [question.id, { question, index }]))
  const afterIds = new Set(after.map(question => question.id))
  after.forEach((question, index) => {
    const previous = beforeIds.get(question.id)
    if (!previous) { changes.push(`Q${index + 1} added`); return }
    const fields = (['prompt', 'options', 'answerIndex', 'marks', 'bloom', 'difficulty', 'answer', 'markingPoints', 'type', 'section'] as const)
      .filter(field => JSON.stringify(previous.question[field]) !== JSON.stringify(question[field]))
    if (fields.length) changes.push(`Q${index + 1} ${fields.join(', ')} edited`)
    else if (previous.index !== index) changes.push(`Q${previous.index + 1} moved to ${index + 1}`)
  })
  before.forEach((question, index) => { if (!afterIds.has(question.id)) changes.push(`Q${index + 1} deleted`) })
  return changes.slice(0, 40)
}

export function auditFor(assessment: Assessment) {
  return auditAssessment(assessment.questions, assessment.config, assessment.blueprint)
}

/** The optional AI moderation pass: warnings only, never edits. */
export async function aiReview(db: D1Database, assessment: Assessment, options: { runAi: AiRunner, actor: Actor }) {
  const findings: Array<{ question: number, issue: string, severity: string }> = []
  for (let start = 0; start < assessment.questions.length; start += 10) {
    const chunk = assessment.questions.slice(start, start + 10)
    const prompt = buildReviewPrompt(chunk, assessment.config, assessment.subjectName, assessment.className)
    const reply = await options.runAi([{ role: 'system', content: prompt.system }, { role: 'user', content: prompt.user }], { maxTokens: 900, temperature: 0.1 }).catch(() => '')
    for (const item of parseQuestionsJson(reply)) {
      const number = Number(item?.question)
      if (!Number.isFinite(number) || number < 1 || number > chunk.length || !item?.issue) continue
      findings.push({ question: start + number, issue: String(item.issue).slice(0, 300), severity: item.severity === 'error' ? 'error' : 'warning' })
    }
  }
  const review = { findings, reviewedAt: new Date().toISOString(), reviewedVersion: assessment.version }
  await db.prepare(`UPDATE ai_assessments SET review_json = ? WHERE id = ?`).bind(JSON.stringify(review), assessment.id).run()
  return review
}

export async function setStatus(db: D1Database, assessment: Assessment, patch: { status: typeof STATUSES[number], delivery?: unknown, postedAssignmentId?: string, submissionId?: string }, actor: Actor, label: string, summary: string) {
  return saveVersion(db, assessment, patch as any, actor, label, summary)
}

// ─── Exam letterhead ─────────────────────────────────────────────────────────

export function normalizeLetterhead(input: Record<string, any> = {}) {
  const field = (value: unknown, max: number) => String(value ?? '').trim().slice(0, max)
  return {
    schoolName: field(input.schoolName, 160), logoUrl: field(input.logoUrl, 600), address: field(input.address, 300), motto: field(input.motto, 160),
    contact: field(input.contact, 200), defaultInstructions: field(input.defaultInstructions, 1500),
    // The school's colours, for the letterhead band.
    primaryColor: /^#[0-9a-fA-F]{6}$/.test(String(input.primaryColor || '')) ? String(input.primaryColor) : '#14215b',
    accentColor: /^#[0-9a-fA-F]{6}$/.test(String(input.accentColor || '')) ? String(input.accentColor) : '#1a5c38',
    showStudentFields: input.showStudentFields !== false, footer: field(input.footer, 200),
  }
}

export async function getLetterhead(db: D1Database, tenantId: string, fallback: { schoolName: string, logoUrl: string, primaryColor?: string, accentColor?: string, contact?: string }) {
  await ensureAiAssessmentTables(db)
  const row = await db.prepare(`SELECT payload FROM exam_letterheads WHERE tenant_id = ?`).bind(tenantId).first() as Record<string, any> | null
  const saved = parse<Record<string, any>>(row?.payload, {})
  // Saved values win only when filled in: an empty saved logo must not hide the school's branding logo.
  return normalizeLetterhead({
    defaultInstructions: 'Read each question carefully. Write your answers clearly in the spaces provided. Show all working where required.',
    ...saved,
    schoolName: saved.schoolName || fallback.schoolName,
    logoUrl: saved.logoUrl || fallback.logoUrl,
    primaryColor: saved.primaryColor || fallback.primaryColor,
    accentColor: saved.accentColor || fallback.accentColor,
    contact: saved.contact || fallback.contact || '',
  })
}

export async function saveLetterhead(db: D1Database, tenantId: string, input: Record<string, any>, actor: Actor) {
  await ensureAiAssessmentTables(db)
  const payload = normalizeLetterhead(input)
  await db.prepare(`INSERT INTO exam_letterheads (tenant_id, payload, updated_by, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(tenant_id) DO UPDATE SET payload = excluded.payload, updated_by = excluded.updated_by, updated_at = excluded.updated_at`)
    .bind(tenantId, JSON.stringify(payload), actor.name, new Date().toISOString()).run()
  return payload
}
