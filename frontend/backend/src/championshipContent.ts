// NDOVERA Championship content pipeline.
//
// Two things flow through here, and they share one principle: a machine may screen, but a
// human decides.
//
//   Questions (championship.md 13–14)
//     School submits → deterministic validation → AI classification → moderation → banked.
//     A question is never publicly readable straight from submission, and championship
//     questions stay locked until their competition cycle has ended.
//
//   Essays and other written entries (championship.md 15)
//     Student submits → word count and version recorded → AI produces a criteria-scored
//     report → the report is advisory input for the human review stage, never a final mark.
//
// Schema and logic live here; routes are registered in index.ts, matching championships.ts.

const QUESTION_SUBMISSIONS_DDL = `CREATE TABLE IF NOT EXISTS championship_question_submissions (
  id TEXT PRIMARY KEY,
  championship_id TEXT,
  tenant_id TEXT NOT NULL,
  submitted_by TEXT,
  submitter_name TEXT,
  subject TEXT,
  class_level TEXT,
  topic TEXT,
  difficulty TEXT,
  type TEXT NOT NULL,
  prompt TEXT NOT NULL,
  normalized_prompt TEXT NOT NULL,
  question_hash TEXT NOT NULL,
  options_json TEXT,
  answer_json TEXT,
  explanation TEXT,
  tags TEXT,
  status TEXT,
  ai_verdict TEXT,
  ai_report TEXT,
  validation_json TEXT,
  moderator_id TEXT,
  moderator_note TEXT,
  exposure_lock_until TEXT,
  banked_question_id TEXT,
  created_at TEXT,
  updated_at TEXT,
  UNIQUE(tenant_id, question_hash, type)
)`

const CHAMPIONSHIP_SUBMISSIONS_DDL = `CREATE TABLE IF NOT EXISTS championship_submissions (
  id TEXT PRIMARY KEY,
  championship_id TEXT NOT NULL,
  stage_id TEXT,
  registration_id TEXT,
  user_id TEXT,
  tenant_id TEXT,
  anonymous_code TEXT,
  kind TEXT,
  topic TEXT,
  content TEXT,
  file_url TEXT,
  word_count INTEGER DEFAULT 0,
  version INTEGER DEFAULT 1,
  status TEXT,
  ai_total REAL DEFAULT 0,
  ai_report TEXT,
  submitted_at TEXT,
  created_at TEXT,
  updated_at TEXT
)`

// championship.md section 14: a question carries what it may be used for. Championship-only
// material must not leak into practice feeds while the competition is still running.
export const QUESTION_TAGS = [
  'competition_only', 'school_assessment', 'practice', 'revision', 'quiz', 'championship', 'restricted',
]

export const QUESTION_SUBMISSION_STATUSES = ['submitted', 'ai_screened', 'approved', 'rejected', 'banked']

// The default essay rubric from championship.md section 15. Ami can override it per
// championship; the totals are recomputed from whatever criteria are stored.
export const DEFAULT_ESSAY_CRITERIA = [
  { key: 'content', label: 'Content', max: 20 },
  { key: 'relevance', label: 'Relevance', max: 20 },
  { key: 'structure', label: 'Structure', max: 15 },
  { key: 'originality', label: 'Originality', max: 20 },
  { key: 'grammar', label: 'Grammar', max: 10 },
  { key: 'creativity', label: 'Creativity', max: 15 },
]

const _contentTablesReady = { done: false }

export async function ensureChampionshipContentTables(db: D1Database) {
  if (_contentTablesReady.done) return
  await db.prepare(QUESTION_SUBMISSIONS_DDL).run()
  await db.prepare(CHAMPIONSHIP_SUBMISSIONS_DDL).run()
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_cqs_tenant_status ON championship_question_submissions (tenant_id, status)`).run()
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_cqs_championship ON championship_question_submissions (championship_id, status)`).run()
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_csub_championship ON championship_submissions (championship_id, stage_id)`).run()
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_csub_user ON championship_submissions (user_id)`).run()
  _contentTablesReady.done = true
}

function text(value: unknown, max = 4000) {
  return String(value ?? '').trim().slice(0, max)
}

function jsonOrNull(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  try { return JSON.parse(String(value)) } catch { return null }
}

// Matches the normalisation the school question bank already uses, so a question submitted
// twice — with different spacing, case or punctuation — collides rather than duplicating.
export function normalizeQuestionPrompt(prompt: string) {
  return String(prompt || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9 ]/g, '')
    .trim()
}

export function hashQuestionPrompt(normalizedPrompt: string) {
  // FNV-1a: short, stable and dependency-free. Only used to spot duplicates, never security.
  let hash = 0x811c9dc5
  for (let index = 0; index < normalizedPrompt.length; index += 1) {
    hash ^= normalizedPrompt.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

export function countWords(value: string) {
  const trimmed = String(value || '').trim()
  if (!trimmed) return 0
  return trimmed.split(/\s+/).length
}

/**
 * Deterministic checks from championship.md section 13, run before any AI is involved.
 *
 * These are the failures a model should never be asked to catch — a missing answer, an
 * objective question with one option, an answer that is not among the options. Cheap, exact
 * and not subject to a model having an off day.
 */
export function validateQuestionSubmission(input: Record<string, any>) {
  const problems: string[] = []
  const type = text(input.type, 20).toLowerCase() === 'theory' ? 'theory' : 'objective'
  const prompt = text(input.prompt, 4000)
  const options = Array.isArray(input.options) ? input.options.map((option: unknown) => text(option, 500)) : []
  const answer = text(input.answer, 1000)

  if (prompt.length < 10) problems.push('The question text is too short to be usable.')
  if (!answer) problems.push('An answer is required.')

  if (type === 'objective') {
    const filled = options.filter(Boolean)
    if (filled.length < 2) problems.push('An objective question needs at least two options.')
    if (new Set(filled.map(option => option.toLowerCase())).size !== filled.length) {
      problems.push('Two or more options are identical.')
    }
    if (answer && filled.length > 0 && !filled.some(option => option.toLowerCase() === answer.toLowerCase())) {
      problems.push('The answer does not match any of the options.')
    }
  }

  return { valid: problems.length === 0, problems, type, prompt, options, answer }
}

const AI_SCREEN_SYSTEM = [
  'You screen questions submitted to a schools competition question bank in Nigeria.',
  'Reply with STRICT JSON only, no prose and no code fences, shaped exactly:',
  '{"verdict":"pass|flag|fail","subject":"","classLevel":"","topic":"","difficulty":"easy|medium|hard","issues":[""],"notes":""}',
  'Use "fail" only for a question that is factually wrong, unanswerable or inappropriate for schoolchildren.',
  'Use "flag" when it is usable but needs a human look. Use "pass" when it is clean.',
  'Keep issues short and specific. Never invent a subject that contradicts the question.',
].join('\n')

/**
 * AI classification and quality screen. A failure here is never fatal: the submission simply
 * arrives at moderation unscreened, because a model outage must not block a school from
 * contributing questions.
 */
export async function screenQuestionWithAi(env: any, question: Record<string, any>, model: string, extract: (result: any) => string) {
  const fallback = { verdict: '', subject: '', classLevel: '', topic: '', difficulty: '', issues: [] as string[], notes: '', screened: false }
  if (!env?.AI || typeof env.AI.run !== 'function') return fallback

  const messages = [
    { role: 'system', content: AI_SCREEN_SYSTEM },
    {
      role: 'user',
      content: [
        `Type: ${question.type}`,
        question.subject ? `Declared subject: ${question.subject}` : '',
        question.classLevel ? `Declared class: ${question.classLevel}` : '',
        `Question: ${question.prompt}`,
        question.options?.length ? `Options: ${question.options.join(' | ')}` : '',
        `Answer: ${question.answer}`,
      ].filter(Boolean).join('\n'),
    },
  ]

  try {
    const result = await env.AI.run(model, { messages, max_tokens: 400, temperature: 0.2 })
    const parsed = jsonOrNull(String(extract(result) || '').replace(/```json|```/g, '').trim())
    if (!parsed || typeof parsed !== 'object') return fallback

    return {
      verdict: ['pass', 'flag', 'fail'].includes(String(parsed.verdict || '')) ? String(parsed.verdict) : 'flag',
      subject: text(parsed.subject, 80),
      classLevel: text(parsed.classLevel, 60),
      topic: text(parsed.topic, 120),
      difficulty: ['easy', 'medium', 'hard'].includes(String(parsed.difficulty || '')) ? String(parsed.difficulty) : '',
      issues: Array.isArray(parsed.issues) ? parsed.issues.map((issue: unknown) => text(issue, 200)).filter(Boolean).slice(0, 8) : [],
      notes: text(parsed.notes, 600),
      screened: true,
    }
  } catch {
    return fallback
  }
}

export function mapQuestionSubmissionRow(row: Record<string, any>) {
  return {
    id: String(row.id || ''),
    championshipId: String(row.championship_id || ''),
    tenantId: String(row.tenant_id || ''),
    submittedBy: String(row.submitted_by || ''),
    submitterName: String(row.submitter_name || ''),
    subject: String(row.subject || ''),
    classLevel: String(row.class_level || ''),
    topic: String(row.topic || ''),
    difficulty: String(row.difficulty || ''),
    type: String(row.type || 'objective'),
    prompt: String(row.prompt || ''),
    options: jsonOrNull(row.options_json) || [],
    answer: jsonOrNull(row.answer_json) ?? String(row.answer_json || ''),
    explanation: String(row.explanation || ''),
    tags: jsonOrNull(row.tags) || [],
    status: String(row.status || 'submitted'),
    aiVerdict: String(row.ai_verdict || ''),
    aiReport: jsonOrNull(row.ai_report),
    validation: jsonOrNull(row.validation_json),
    moderatorNote: String(row.moderator_note || ''),
    exposureLockUntil: String(row.exposure_lock_until || ''),
    bankedQuestionId: String(row.banked_question_id || ''),
    createdAt: String(row.created_at || ''),
    updatedAt: String(row.updated_at || ''),
  }
}

export async function createQuestionSubmission(
  db: D1Database,
  input: {
    championshipId?: string
    tenantId: string
    submittedBy: string
    submitterName?: string
    subject?: string
    classLevel?: string
    topic?: string
    difficulty?: string
    tags?: string[]
    exposureLockUntil?: string
  },
  validated: ReturnType<typeof validateQuestionSubmission>,
  screening: Awaited<ReturnType<typeof screenQuestionWithAi>>,
) {
  await ensureChampionshipContentTables(db)
  const now = new Date().toISOString()
  const id = `cqs_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  const normalizedPrompt = normalizeQuestionPrompt(validated.prompt)
  const questionHash = hashQuestionPrompt(normalizedPrompt)

  // A duplicate is reported rather than inserted — the school gets told, and the bank stays clean.
  const existing = await db.prepare(
    `SELECT id FROM championship_question_submissions WHERE tenant_id = ? AND question_hash = ? AND type = ?`
  ).bind(input.tenantId, questionHash, validated.type).first() as Record<string, any> | null
  if (existing) return { duplicate: true, id: String(existing.id || ''), submission: null }

  const status = screening.verdict === 'fail' ? 'rejected' : (screening.screened ? 'ai_screened' : 'submitted')
  const tags = Array.isArray(input.tags) ? input.tags.filter(tag => QUESTION_TAGS.includes(tag)) : []

  await db.prepare(
    `INSERT INTO championship_question_submissions (
      id, championship_id, tenant_id, submitted_by, submitter_name, subject, class_level, topic,
      difficulty, type, prompt, normalized_prompt, question_hash, options_json, answer_json,
      explanation, tags, status, ai_verdict, ai_report, validation_json, moderator_id,
      moderator_note, exposure_lock_until, banked_question_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, text(input.championshipId, 120), input.tenantId, input.submittedBy, text(input.submitterName, 160),
    text(input.subject || screening.subject, 80), text(input.classLevel || screening.classLevel, 60),
    text(input.topic || screening.topic, 120), text(input.difficulty || screening.difficulty, 20),
    validated.type, validated.prompt, normalizedPrompt, questionHash,
    JSON.stringify(validated.options), JSON.stringify(validated.answer),
    text((input as any).explanation, 2000), JSON.stringify(tags), status,
    screening.verdict || '', JSON.stringify(screening), JSON.stringify(validated.problems),
    '', '', text(input.exposureLockUntil, 30), '', now, now,
  ).run()

  const row = await db.prepare(`SELECT * FROM championship_question_submissions WHERE id = ?`).bind(id).first() as Record<string, any>
  return { duplicate: false, id, submission: mapQuestionSubmissionRow(row) }
}

export async function listQuestionSubmissions(
  db: D1Database,
  filters: { tenantId?: string; championshipId?: string; status?: string; limit?: number } = {},
) {
  await ensureChampionshipContentTables(db)
  const clauses: string[] = []
  const params: any[] = []

  if (filters.tenantId) { clauses.push('tenant_id = ?'); params.push(filters.tenantId) }
  if (filters.championshipId) { clauses.push('championship_id = ?'); params.push(filters.championshipId) }
  if (filters.status) { clauses.push('status = ?'); params.push(filters.status) }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  const limit = Math.max(1, Math.min(500, Number(filters.limit) || 200))
  const rows = await db.prepare(
    `SELECT * FROM championship_question_submissions ${where} ORDER BY created_at DESC LIMIT ?`
  ).bind(...params, limit).all()

  return (((rows as any).results || []) as Record<string, any>[]).map(mapQuestionSubmissionRow)
}

/**
 * Moderator decision. Approving banks the question into the school's question bank so it
 * becomes usable by the existing CBT and practice engines; rejecting records why.
 *
 * Banking is deliberately a separate write rather than a trigger: if the bank insert fails the
 * submission stays "approved" and can be retried, instead of being lost between two tables.
 */
export async function moderateQuestionSubmission(
  db: D1Database,
  submissionId: string,
  decision: 'approved' | 'rejected',
  moderatorId: string,
  note = '',
) {
  await ensureChampionshipContentTables(db)
  const now = new Date().toISOString()
  await db.prepare(
    `UPDATE championship_question_submissions
        SET status = ?, moderator_id = ?, moderator_note = ?, updated_at = ?
      WHERE id = ?`
  ).bind(decision, moderatorId, text(note, 1000), now, submissionId).run()

  const row = await db.prepare(`SELECT * FROM championship_question_submissions WHERE id = ?`).bind(submissionId).first() as Record<string, any> | null
  return row ? mapQuestionSubmissionRow(row) : null
}

export async function markQuestionBanked(db: D1Database, submissionId: string, bankedQuestionId: string) {
  await ensureChampionshipContentTables(db)
  await db.prepare(
    `UPDATE championship_question_submissions SET status = 'banked', banked_question_id = ?, updated_at = ? WHERE id = ?`
  ).bind(bankedQuestionId, new Date().toISOString(), submissionId).run()
}

/**
 * Whether a banked question may be shown outside the competition it was written for.
 *
 * championship.md section 14 asks for an exposure lock: championship material stays sealed
 * until its cycle ends, so practice feeds cannot reveal upcoming competition questions.
 */
export function questionIsExposable(submission: ReturnType<typeof mapQuestionSubmissionRow>, now = new Date()) {
  if (submission.status !== 'banked') return false
  if (submission.tags.includes('restricted')) return false
  if (submission.tags.includes('competition_only')) {
    if (!submission.exposureLockUntil) return false
    const until = Date.parse(submission.exposureLockUntil)
    if (Number.isNaN(until) || now.getTime() < until) return false
  }
  return true
}

// ─── Essay and written submissions (championship.md section 15) ───────────────────────────────

export function mapChampionshipSubmissionRow(row: Record<string, any>, options: { blind?: boolean } = {}) {
  const blind = options.blind === true
  return {
    id: String(row.id || ''),
    championshipId: String(row.championship_id || ''),
    stageId: String(row.stage_id || ''),
    registrationId: blind ? '' : String(row.registration_id || ''),
    userId: blind ? '' : String(row.user_id || ''),
    tenantId: blind ? '' : String(row.tenant_id || ''),
    anonymousCode: String(row.anonymous_code || ''),
    kind: String(row.kind || 'essay'),
    topic: String(row.topic || ''),
    content: String(row.content || ''),
    fileUrl: String(row.file_url || ''),
    wordCount: Number(row.word_count || 0),
    version: Number(row.version || 1),
    status: String(row.status || 'submitted'),
    aiTotal: Number(row.ai_total || 0),
    aiReport: jsonOrNull(row.ai_report),
    submittedAt: String(row.submitted_at || ''),
    createdAt: String(row.created_at || ''),
  }
}

/**
 * Records a submission, superseding any earlier one from the same participant for the stage.
 *
 * Versions are kept rather than overwritten: section 15 asks for the submission version to be
 * recorded, and in a competition the history of what was sent and when is exactly what an
 * appeal turns on.
 */
export async function createChampionshipSubmission(
  db: D1Database,
  input: {
    championshipId: string
    stageId?: string
    registrationId?: string
    userId: string
    tenantId?: string
    kind?: string
    topic?: string
    content?: string
    fileUrl?: string
  },
) {
  await ensureChampionshipContentTables(db)
  const now = new Date().toISOString()
  const id = `csub_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  const content = text(input.content, 60000)

  const previous = await db.prepare(
    `SELECT MAX(version) AS v FROM championship_submissions
      WHERE championship_id = ? AND user_id = ? AND COALESCE(stage_id,'') = ?`
  ).bind(input.championshipId, input.userId, text(input.stageId, 120)).first() as Record<string, any> | null
  const version = Number(previous?.v || 0) + 1

  // Blind judging (section 17) needs a stable, meaningless handle decided at submission time.
  const anonymousCode = `E-${String(Date.now()).slice(-5)}${Math.random().toString(36).slice(2, 4).toUpperCase()}`

  await db.prepare(
    `INSERT INTO championship_submissions (
      id, championship_id, stage_id, registration_id, user_id, tenant_id, anonymous_code,
      kind, topic, content, file_url, word_count, version, status, ai_total, ai_report,
      submitted_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, input.championshipId, text(input.stageId, 120), text(input.registrationId, 120),
    input.userId, text(input.tenantId, 120), anonymousCode,
    text(input.kind, 20) || 'essay', text(input.topic, 300), content, text(input.fileUrl, 500),
    countWords(content), version, 'submitted', 0, null, now, now, now,
  ).run()

  const row = await db.prepare(`SELECT * FROM championship_submissions WHERE id = ?`).bind(id).first() as Record<string, any>
  return mapChampionshipSubmissionRow(row)
}

export async function listChampionshipSubmissions(
  db: D1Database,
  filters: { championshipId?: string; stageId?: string; userId?: string; latestOnly?: boolean } = {},
) {
  await ensureChampionshipContentTables(db)
  const clauses: string[] = []
  const params: any[] = []
  if (filters.championshipId) { clauses.push('championship_id = ?'); params.push(filters.championshipId) }
  if (filters.stageId) { clauses.push("COALESCE(stage_id,'') = ?"); params.push(filters.stageId) }
  if (filters.userId) { clauses.push('user_id = ?'); params.push(filters.userId) }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  const rows = await db.prepare(
    `SELECT * FROM championship_submissions ${where} ORDER BY created_at DESC LIMIT 500`
  ).bind(...params).all()

  const mapped = (((rows as any).results || []) as Record<string, any>[]).map(row => mapChampionshipSubmissionRow(row))
  if (!filters.latestOnly) return mapped

  // Only the newest version per participant per stage.
  const seen = new Set<string>()
  return mapped.filter(submission => {
    const key = `${submission.userId}::${submission.stageId}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function normalizeEssayCriteria(value: unknown) {
  const parsed = Array.isArray(value) ? value : jsonOrNull(value)
  if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_ESSAY_CRITERIA
  const criteria = parsed
    .map((item: any) => ({
      key: text(item?.key, 40).toLowerCase().replace(/[^a-z0-9_]/g, '_'),
      label: text(item?.label, 60) || text(item?.key, 60),
      max: Math.max(1, Math.min(100, Number(item?.max) || 0)),
    }))
    .filter(item => item.key && item.max > 0)
  return criteria.length ? criteria : DEFAULT_ESSAY_CRITERIA
}

const AI_ESSAY_SYSTEM = [
  'You are a preliminary reviewer for a schools essay competition in Nigeria.',
  'You do NOT decide the final mark. A human review team sees your report and may override it.',
  'Reply with STRICT JSON only, no prose and no code fences, shaped exactly:',
  '{"scores":{"<criterionKey>":<number>},"strengths":[""],"improvements":[""],"summary":"","integrityConcerns":[""]}',
  'Score each criterion out of its stated maximum. Never exceed a maximum.',
  'Judge only what is written. Do not reward length. Note integrity concerns (for example text that reads as copied or machine-generated) as observations, never as accusations.',
].join('\n')

/**
 * AI review report for an essay (championship.md section 15).
 *
 * Produces a per-criterion score against the configured rubric plus written feedback. The
 * total is computed here from the returned scores rather than trusted from the model, and
 * every score is clamped to its maximum — a model cannot inflate a mark past the rubric.
 */
export async function reviewEssayWithAi(
  env: any,
  submission: { topic?: string; content: string; wordCount: number },
  criteria: Array<{ key: string; label: string; max: number }>,
  model: string,
  extract: (result: any) => string,
) {
  const maxTotal = criteria.reduce((sum, item) => sum + item.max, 0)
  const empty = {
    screened: false, scores: {} as Record<string, number>, total: 0, maxTotal,
    percentage: 0, strengths: [] as string[], improvements: [] as string[],
    summary: '', integrityConcerns: [] as string[],
  }
  if (!env?.AI || typeof env.AI.run !== 'function') return empty
  if (!String(submission.content || '').trim()) return empty

  const messages = [
    { role: 'system', content: AI_ESSAY_SYSTEM },
    {
      role: 'user',
      content: [
        submission.topic ? `Topic: ${submission.topic}` : '',
        `Word count: ${submission.wordCount}`,
        `Criteria and maximums: ${criteria.map(item => `${item.key} (${item.label}) max ${item.max}`).join(', ')}`,
        '',
        'Essay:',
        String(submission.content).slice(0, 12000),
      ].filter(Boolean).join('\n'),
    },
  ]

  try {
    const result = await env.AI.run(model, { messages, max_tokens: 900, temperature: 0.3 })
    const parsed = jsonOrNull(String(extract(result) || '').replace(/```json|```/g, '').trim())
    if (!parsed || typeof parsed !== 'object') return empty

    const scores: Record<string, number> = {}
    let total = 0
    for (const item of criteria) {
      const raw = Number((parsed.scores || {})[item.key])
      const clamped = Number.isFinite(raw) ? Math.max(0, Math.min(item.max, raw)) : 0
      scores[item.key] = Math.round(clamped * 10) / 10
      total += scores[item.key]
    }

    const list = (value: unknown, limit: number) => (Array.isArray(value)
      ? value.map(entry => text(entry, 300)).filter(Boolean).slice(0, limit)
      : [])

    return {
      screened: true,
      scores,
      total: Math.round(total * 10) / 10,
      maxTotal,
      percentage: maxTotal > 0 ? Math.round((total / maxTotal) * 1000) / 10 : 0,
      strengths: list(parsed.strengths, 6),
      improvements: list(parsed.improvements, 6),
      summary: text(parsed.summary, 1200),
      integrityConcerns: list(parsed.integrityConcerns, 5),
    }
  } catch {
    return empty
  }
}

export async function saveSubmissionAiReport(
  db: D1Database,
  submissionId: string,
  report: Awaited<ReturnType<typeof reviewEssayWithAi>>,
) {
  await ensureChampionshipContentTables(db)
  await db.prepare(
    `UPDATE championship_submissions
        SET ai_report = ?, ai_total = ?, status = ?, updated_at = ?
      WHERE id = ?`
  ).bind(
    JSON.stringify(report), report.total,
    report.screened ? 'ai_screened' : 'submitted',
    new Date().toISOString(), submissionId,
  ).run()
}
