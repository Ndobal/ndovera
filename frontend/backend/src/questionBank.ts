function parseJsonField<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string' || !value) return fallback

  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function createId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function normalizeQuestionType(value: unknown) {
  const normalized = String(value || 'mcq')
    .trim()
    .toLowerCase()
    .replace(/[^a-z]/g, '')

  if (normalized === 'multiplechoice') return 'mcq'
  if (normalized === 'truefalse') return 'truefalse'
  if (normalized === 'shortanswer') return 'shortanswer'
  if (normalized === 'fillblank' || normalized === 'fillgaps') return 'fillgaps'
  if (normalized === 'crossmatching' || normalized === 'matching') return 'crossmatching'
  if (normalized === 'longanswer') return 'longanswer'
  if (normalized === 'picture' || normalized === 'image') return 'picture'
  if (normalized === 'essay' || normalized === 'comprehension' || normalized === 'mcq') return normalized
  return 'mcq'
}

function normalizeComparableText(value: unknown) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeQuestionPrompt(input: Record<string, any>) {
  return String(input.prompt || input.text || input.question || '').trim()
}

function normalizeQuestionOptions(input: Record<string, any>, type: string) {
  const sourceOptions = Array.isArray(input.options)
    ? input.options
    : Array.isArray(input.choices)
      ? input.choices
      : []

  const options = sourceOptions.map(option => String(option || '').trim()).filter(Boolean)
  if (type === 'truefalse' && options.length === 0) {
    return ['True', 'False']
  }
  return options
}

function normalizeQuestionPairs(input: Record<string, any>) {
  return (Array.isArray(input.pairs) ? input.pairs : [])
    .map(pair => ({
      left: String((pair as any)?.left || (pair as any)?.a || '').trim(),
      right: String((pair as any)?.right || (pair as any)?.b || '').trim(),
    }))
    .filter(pair => pair.left || pair.right)
}

function normalizeQuestionAnswer(input: Record<string, any>, type: string) {
  if (type === 'crossmatching') {
    return normalizeQuestionPairs(input)
  }

  if (type === 'fillgaps') {
    if (Array.isArray(input.answer)) {
      return input.answer.map(value => String(value || '').trim()).filter(Boolean)
    }

    const acceptedAnswers = String(input.acceptedAnswers || input.answer || '')
      .split(/[\n,;]+/)
      .map(entry => entry.trim())
      .filter(Boolean)
    return acceptedAnswers
  }

  if (type === 'truefalse') {
    if (input.answer === true || String(input.answer || '').trim().toLowerCase() === 'true') return 'True'
    if (input.answer === false || String(input.answer || '').trim().toLowerCase() === 'false') return 'False'
    return ''
  }

  return String(input.answer || '').trim()
}

function normalizeMetadata(input: Record<string, any>) {
  const metadata = input.metadata && typeof input.metadata === 'object'
    ? { ...(input.metadata as Record<string, any>) }
    : {}

  if (input.passage) metadata.passage = String(input.passage)
  if (input.topic) metadata.topic = String(input.topic)
  if (input.subjectName) metadata.subjectName = String(input.subjectName)
  if (input.className) metadata.className = String(input.className)
  if (input.left && Array.isArray(input.left)) metadata.left = input.left
  if (input.right && Array.isArray(input.right)) metadata.right = input.right

  return metadata
}

function extractQuestionBankPayload(input: Record<string, any>) {
  const type = normalizeQuestionType(input.type)
  const prompt = normalizeQuestionPrompt(input)
  const options = normalizeQuestionOptions(input, type)
  const answer = normalizeQuestionAnswer(input, type)
  const metadata = normalizeMetadata(input)

  if (type === 'crossmatching' && !Array.isArray(metadata.left)) {
    metadata.left = (Array.isArray(answer) ? answer : []).map(pair => String((pair as any)?.left || '').trim())
  }
  if (type === 'crossmatching' && !Array.isArray(metadata.right)) {
    metadata.right = (Array.isArray(answer) ? answer : []).map(pair => String((pair as any)?.right || '').trim())
  }

  return {
    id: String(input.id || '').trim(),
    subject: String(input.subject || input.subjectName || '').trim(),
    classLevel: String(input.classLevel || '').trim(),
    classId: String(input.classId || '').trim(),
    className: String(input.className || '').trim(),
    subjectId: String(input.subjectId || '').trim(),
    subjectName: String(input.subjectName || input.subject || '').trim(),
    topic: String(input.topic || metadata.topic || '').trim(),
    type,
    prompt,
    options,
    answer,
    explanation: String(input.explanation || input.markingGuide || '').trim(),
    imageUrl: String(input.imageUrl || input.image || '').trim(),
    score: Number(input.score || 1) > 0 ? Number(input.score || 1) : 1,
    status: String(input.status || 'approved').trim().toLowerCase() || 'approved',
    source: String(input.source || 'manual').trim().toLowerCase() || 'manual',
    createdBy: String(input.createdBy || input.createdById || '').trim(),
    metadata,
  }
}

async function computeQuestionHash(question: Record<string, any>) {
  const signature = [
    question.type,
    normalizeComparableText(question.prompt),
    (Array.isArray(question.options) ? question.options : []).map(normalizeComparableText).join('|'),
  ].join('::')

  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(signature))
  return Array.from(new Uint8Array(digest)).map(value => value.toString(16).padStart(2, '0')).join('')
}

function buildTrigramSet(value: string) {
  const normalized = `  ${normalizeComparableText(value)}  `
  const set = new Set<string>()
  for (let index = 0; index < normalized.length - 2; index += 1) {
    set.add(normalized.slice(index, index + 3))
  }
  return set
}

function computePromptSimilarity(left: string, right: string) {
  const leftSet = buildTrigramSet(left)
  const rightSet = buildTrigramSet(right)
  if (leftSet.size === 0 || rightSet.size === 0) return 0

  let intersection = 0
  for (const token of leftSet) {
    if (rightSet.has(token)) intersection += 1
  }
  const union = leftSet.size + rightSet.size - intersection
  return union > 0 ? intersection / union : 0
}

const QUESTION_BANK_DDL = `CREATE TABLE IF NOT EXISTS question_bank (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  subject TEXT,
  class_level TEXT,
  class_id TEXT,
  subject_id TEXT,
  topic TEXT,
  type TEXT NOT NULL,
  prompt TEXT NOT NULL,
  normalized_prompt TEXT NOT NULL,
  question_hash TEXT NOT NULL,
  options_json TEXT,
  answer_json TEXT,
  explanation TEXT,
  image_url TEXT,
  score REAL,
  status TEXT,
  source TEXT,
  created_by TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(tenant_id, question_hash, type)
)`

const QUESTION_USAGE_DDL = `CREATE TABLE IF NOT EXISTS question_usage (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  engine_type TEXT NOT NULL,
  engine_id TEXT NOT NULL,
  context_json TEXT,
  created_at TEXT NOT NULL
)`

const CBT_EXAMS_DDL = `CREATE TABLE IF NOT EXISTS cbt_exams (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  class_id TEXT,
  class_name TEXT,
  subject_id TEXT,
  subject_name TEXT,
  teacher_id TEXT,
  teacher_name TEXT,
  title TEXT NOT NULL,
  window_label TEXT,
  duration_minutes INTEGER,
  instructions TEXT,
  mode TEXT NOT NULL,
  status TEXT NOT NULL,
  release_at TEXT,
  settings_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`

const CBT_EXAM_QUESTIONS_DDL = `CREATE TABLE IF NOT EXISTS cbt_exam_questions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  exam_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  score REAL,
  settings_json TEXT
)`

const CBT_ATTEMPTS_DDL = `CREATE TABLE IF NOT EXISTS cbt_attempts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  exam_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  score REAL,
  total REAL,
  responses_json TEXT,
  feedback_json TEXT,
  created_at TEXT NOT NULL
)`

function mapQuestionRow(row: Record<string, any>) {
  const options = parseJsonField(row.options_json, [] as string[])
  const answer = parseJsonField(row.answer_json, row.answer_json || '')
  const metadata = parseJsonField(row.metadata_json, {} as Record<string, any>)
  const type = normalizeQuestionType(row.type)
  const pairs = type === 'crossmatching' && Array.isArray(answer) ? answer : []

  return {
    id: row.id,
    tenantId: row.tenant_id,
    subject: String(row.subject || metadata.subjectName || ''),
    classLevel: String(row.class_level || ''),
    classId: String(row.class_id || ''),
    subjectId: String(row.subject_id || ''),
    subjectName: String(metadata.subjectName || row.subject || ''),
    topic: String(row.topic || metadata.topic || ''),
    type,
    prompt: String(row.prompt || ''),
    text: String(row.prompt || ''),
    options,
    choices: options,
    answer,
    explanation: String(row.explanation || ''),
    imageUrl: String(row.image_url || ''),
    score: Number(row.score || 1) > 0 ? Number(row.score || 1) : 1,
    status: String(row.status || 'approved'),
    source: String(row.source || 'manual'),
    createdBy: String(row.created_by || ''),
    createdAt: String(row.created_at || ''),
    updatedAt: String(row.updated_at || ''),
    metadata,
    passage: String(metadata.passage || ''),
    pairs,
    left: Array.isArray(metadata.left) ? metadata.left : pairs.map(pair => String((pair as any)?.left || '').trim()),
    right: Array.isArray(metadata.right) ? metadata.right : pairs.map(pair => String((pair as any)?.right || '').trim()),
  }
}

async function listCandidateQuestions(db: D1Database, tenantId: string, question: Record<string, any>) {
  const rows = await db.prepare(
    `SELECT * FROM question_bank WHERE tenant_id = ? AND type = ? ORDER BY updated_at DESC LIMIT 40`
  ).bind(tenantId, question.type).all()

  return ((rows.results || []) as Record<string, any>[]).map(mapQuestionRow)
}

async function recordQuestionUsage(db: D1Database, tenantId: string, questionId: string, engineType: string, engineId: string, context: Record<string, any> = {}) {
  await db.prepare(QUESTION_USAGE_DDL).run()
  await db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS question_usage_unique_idx ON question_usage(question_id, engine_type, engine_id)`).run()

  const now = new Date().toISOString()
  const existing = await db.prepare(
    `SELECT id FROM question_usage WHERE question_id = ? AND engine_type = ? AND engine_id = ? LIMIT 1`
  ).bind(questionId, engineType, engineId).first() as Record<string, any> | null

  await db.prepare(
    `INSERT OR REPLACE INTO question_usage (id, tenant_id, question_id, engine_type, engine_id, context_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(existing?.id || createId('qusage'), tenantId, questionId, engineType, engineId, JSON.stringify(context || {}), now).run()
}

async function listExamQuestions(db: D1Database, tenantId: string, examId: string) {
  const rows = await db.prepare(
    `SELECT q.*, eq.sort_order, eq.score as linked_score, eq.settings_json
     FROM cbt_exam_questions eq
     INNER JOIN question_bank q ON q.id = eq.question_id
     WHERE eq.tenant_id = ? AND eq.exam_id = ?
     ORDER BY eq.sort_order ASC`
  ).bind(tenantId, examId).all()

  return ((rows.results || []) as Record<string, any>[]).map(row => {
    const question = mapQuestionRow(row)
    return {
      ...question,
      score: Number(row.linked_score || question.score || 1) > 0 ? Number(row.linked_score || question.score || 1) : 1,
      linkSettings: parseJsonField(row.settings_json, {} as Record<string, any>),
    }
  })
}

function mapExamRow(row: Record<string, any>, questions: Array<Record<string, any>> = []) {
  const settings = parseJsonField(row.settings_json, {} as Record<string, any>)
  return {
    id: row.id,
    tenantId: row.tenant_id,
    classId: String(row.class_id || ''),
    className: String(row.class_name || ''),
    subjectId: String(row.subject_id || ''),
    subjectName: String(row.subject_name || ''),
    teacherId: String(row.teacher_id || ''),
    teacherName: String(row.teacher_name || ''),
    title: String(row.title || ''),
    window: String(row.window_label || ''),
    durationMinutes: Number(row.duration_minutes || 0),
    instructions: String(row.instructions || ''),
    mode: String(row.mode || 'cbt'),
    status: String(row.status || 'draft'),
    releaseAt: String(row.release_at || ''),
    createdAt: String(row.created_at || ''),
    updatedAt: String(row.updated_at || ''),
    settings,
    questions,
  }
}

function sanitizeExamQuestionForSession(question: Record<string, any>) {
  const type = normalizeQuestionType(question.type)
  const base = {
    id: question.id,
    type,
    prompt: question.prompt,
    text: question.prompt,
    imageUrl: question.imageUrl || '',
    passage: question.passage || '',
    score: Number(question.score || 1) > 0 ? Number(question.score || 1) : 1,
  }

  if (type === 'mcq' || type === 'truefalse') {
    return {
      ...base,
      options: question.options || [],
      choices: question.options || [],
    }
  }

  if (type === 'crossmatching') {
    return {
      ...base,
      left: question.left || [],
      right: question.right || [],
    }
  }

  return base
}

function normalizeSubmittedResponse(value: unknown) {
  if (Array.isArray(value)) {
    return value.map(entry => normalizeComparableText(entry)).filter(Boolean)
  }
  if (value && typeof value === 'object') {
    return JSON.parse(JSON.stringify(value))
  }
  return normalizeComparableText(value)
}

function isCrossMatchCorrect(expected: Array<Record<string, any>>, actual: Array<Record<string, any>>) {
  const normalizedExpected = (Array.isArray(expected) ? expected : [])
    .map(pair => `${normalizeComparableText((pair as any)?.left)}=>${normalizeComparableText((pair as any)?.right)}`)
    .sort()
  const normalizedActual = (Array.isArray(actual) ? actual : [])
    .map(pair => `${normalizeComparableText((pair as any)?.left || (pair as any)?.a)}=>${normalizeComparableText((pair as any)?.right || (pair as any)?.b)}`)
    .sort()

  if (normalizedExpected.length === 0 || normalizedExpected.length !== normalizedActual.length) return false
  return normalizedExpected.every((value, index) => value === normalizedActual[index])
}

function scoreQuestion(question: Record<string, any>, response: unknown) {
  const type = normalizeQuestionType(question.type)
  const score = Number(question.score || 1) > 0 ? Number(question.score || 1) : 1
  const normalizedResponse = normalizeSubmittedResponse(response)

  if (type === 'essay' || type === 'comprehension' || type === 'longanswer' || type === 'picture') {
    return {
      correct: false,
      awarded: 0,
      pendingManualReview: true,
      expected: question.answer,
    }
  }

  if (type === 'crossmatching') {
    const correct = isCrossMatchCorrect(question.answer || [], Array.isArray(normalizedResponse) ? normalizedResponse as Array<Record<string, any>> : [])
    return { correct, awarded: correct ? score : 0, pendingManualReview: false, expected: question.answer }
  }

  if (type === 'fillgaps') {
    const expectedAnswers = Array.isArray(question.answer)
      ? question.answer.map((entry: unknown) => normalizeComparableText(entry)).filter(Boolean)
      : []
    const actualAnswers = Array.isArray(normalizedResponse)
      ? normalizedResponse as string[]
      : String(response || '').split(/[\n,;]+/).map(entry => normalizeComparableText(entry)).filter(Boolean)
    const correct = expectedAnswers.length > 0
      && expectedAnswers.length === actualAnswers.length
      && expectedAnswers.every((entry, index) => entry === actualAnswers[index])
    return { correct, awarded: correct ? score : 0, pendingManualReview: false, expected: question.answer }
  }

  const expected = normalizeComparableText(question.answer)
  const actual = typeof normalizedResponse === 'string' ? normalizedResponse : normalizeComparableText(response)
  const correct = Boolean(expected) && expected === actual
  return { correct, awarded: correct ? score : 0, pendingManualReview: false, expected: question.answer }
}

export async function ensureQuestionBankTables(db: D1Database) {
  await db.prepare(QUESTION_BANK_DDL).run()
  await db.prepare(QUESTION_USAGE_DDL).run()
  await db.prepare(CBT_EXAMS_DDL).run()
  await db.prepare(CBT_EXAM_QUESTIONS_DDL).run()
  await db.prepare(CBT_ATTEMPTS_DDL).run()
  try { await db.exec('ALTER TABLE question_bank ADD COLUMN metadata_json TEXT') } catch {}
  try { await db.exec('ALTER TABLE question_bank ADD COLUMN created_by TEXT') } catch {}
  try { await db.exec('ALTER TABLE question_bank ADD COLUMN status TEXT') } catch {}
  try { await db.exec('ALTER TABLE question_bank ADD COLUMN source TEXT') } catch {}
  try { await db.exec('ALTER TABLE question_bank ADD COLUMN image_url TEXT') } catch {}
  try { await db.exec('ALTER TABLE question_bank ADD COLUMN explanation TEXT') } catch {}
  try { await db.exec('ALTER TABLE cbt_exams ADD COLUMN release_at TEXT') } catch {}
  try { await db.exec('ALTER TABLE cbt_exams ADD COLUMN settings_json TEXT') } catch {}
  try { await db.exec('ALTER TABLE cbt_exam_questions ADD COLUMN settings_json TEXT') } catch {}
  try { await db.exec('ALTER TABLE cbt_attempts ADD COLUMN responses_json TEXT') } catch {}
  try { await db.exec('ALTER TABLE cbt_attempts ADD COLUMN feedback_json TEXT') } catch {}
  await db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS question_usage_unique_idx ON question_usage(question_id, engine_type, engine_id)`).run()
}

export async function listQuestionBankQuestions(db: D1Database, tenantId: string, filters: Record<string, any> = {}) {
  await ensureQuestionBankTables(db)
  const rows = await db.prepare(
    `SELECT * FROM question_bank WHERE tenant_id = ? ORDER BY updated_at DESC, created_at DESC`
  ).bind(tenantId).all()

  return ((rows.results || []) as Record<string, any>[])
    .map(mapQuestionRow)
    .filter(question => {
      if (filters.subject && normalizeComparableText(question.subject) !== normalizeComparableText(filters.subject)) return false
      if (filters.classLevel && normalizeComparableText(question.classLevel) !== normalizeComparableText(filters.classLevel)) return false
      if (filters.classId && String(question.classId || '') !== String(filters.classId || '')) return false
      if (filters.subjectId && String(question.subjectId || '') !== String(filters.subjectId || '')) return false
      if (filters.type && normalizeQuestionType(question.type) !== normalizeQuestionType(filters.type)) return false
      if (filters.status && normalizeComparableText(question.status) !== normalizeComparableText(filters.status)) return false
      return true
    })
}

function mapAssignmentQuestionToPracticeQuestion(
  tenantId: string,
  row: Record<string, any>,
  rawQuestion: Record<string, any>,
  index: number,
) {
  const className = `${String(row.class_name || '').trim()}${row.class_arm ? ` ${String(row.class_arm || '').trim()}` : ''}`.trim()
  const normalizedQuestion = extractQuestionBankPayload({
    ...rawQuestion,
    id: String(rawQuestion.id || `${row.assignment_id || 'assignment'}_${index + 1}`).trim(),
    classId: String(rawQuestion.classId || row.class_id || '').trim(),
    className: String(rawQuestion.className || className || '').trim(),
    subjectId: String(rawQuestion.subjectId || row.subject_id || '').trim(),
    subjectName: String(rawQuestion.subjectName || row.subject_name || '').trim(),
    subject: String(rawQuestion.subject || rawQuestion.subjectName || row.subject_name || '').trim(),
    source: rawQuestion.source || 'assignment',
    status: rawQuestion.status || 'approved',
    createdBy: rawQuestion.createdBy || row.created_by || '',
  })

  const answerPairs = normalizedQuestion.type === 'crossmatching' && Array.isArray(normalizedQuestion.answer)
    ? normalizedQuestion.answer
    : []

  return {
    id: normalizedQuestion.id,
    tenantId,
    subject: normalizedQuestion.subject,
    classLevel: normalizedQuestion.classLevel,
    classId: normalizedQuestion.classId,
    subjectId: normalizedQuestion.subjectId,
    subjectName: normalizedQuestion.subjectName,
    topic: normalizedQuestion.topic,
    type: normalizedQuestion.type,
    prompt: normalizedQuestion.prompt,
    text: normalizedQuestion.prompt,
    options: normalizedQuestion.options,
    choices: normalizedQuestion.options,
    answer: normalizedQuestion.answer,
    explanation: normalizedQuestion.explanation,
    imageUrl: normalizedQuestion.imageUrl,
    score: normalizedQuestion.score,
    status: normalizedQuestion.status,
    source: normalizedQuestion.source,
    createdBy: normalizedQuestion.createdBy,
    createdAt: String(row.created_at || ''),
    updatedAt: String(row.updated_at || row.created_at || ''),
    metadata: {
      ...normalizedQuestion.metadata,
      assignmentId: String(row.assignment_id || ''),
      assignmentTitle: String(row.assignment_title || ''),
      className: normalizedQuestion.className || className,
      subjectName: normalizedQuestion.subjectName || String(row.subject_name || ''),
    },
    passage: String(normalizedQuestion.metadata?.passage || ''),
    pairs: answerPairs,
    left: Array.isArray(normalizedQuestion.metadata?.left) ? normalizedQuestion.metadata.left : answerPairs.map(pair => String((pair as any)?.left || '').trim()),
    right: Array.isArray(normalizedQuestion.metadata?.right) ? normalizedQuestion.metadata.right : answerPairs.map(pair => String((pair as any)?.right || '').trim()),
  }
}

async function listAssignmentBackedPracticeQuestions(db: D1Database, tenantId: string, filters: Record<string, any> = {}) {
  const rows = await db.prepare(
    `SELECT
       a.id AS assignment_id,
       a.title AS assignment_title,
       a.subjectId AS subject_id,
       a.subjectName AS subject_name,
       a.questionPayload AS question_payload,
       a.createdBy AS created_by,
       a.createdAt AS created_at,
       a.updatedAt AS updated_at,
       c.id AS class_id,
       c.name AS class_name,
       c.arm AS class_arm
     FROM assignments a
     INNER JOIN classes c ON c.id = a.classId
     WHERE c.tenantId = ?
     ORDER BY a.updatedAt DESC, a.createdAt DESC`
  ).bind(tenantId).all().catch(() => ({ results: [] }))

  const questions: Array<Record<string, any>> = []
  for (const row of ((rows.results || []) as Record<string, any>[])) {
    if (filters.classId && String(row.class_id || '') !== String(filters.classId || '')) continue
    if (filters.subjectId && String(row.subject_id || '') !== String(filters.subjectId || '')) continue

    const rawQuestions = parseJsonField(row.question_payload, [] as Array<Record<string, any>>)
    rawQuestions.forEach((question, index) => {
      if (!question || typeof question !== 'object') return
      questions.push(mapAssignmentQuestionToPracticeQuestion(tenantId, row, question, index))
    })
  }

  return questions
}

function buildPracticeQuestionSignature(question: Record<string, any>) {
  return [
    normalizeQuestionType(question.type),
    normalizeComparableText(question.prompt || question.text || ''),
    (Array.isArray(question.options) ? question.options : Array.isArray(question.choices) ? question.choices : [])
      .map(option => normalizeComparableText(option))
      .join('|'),
    Array.isArray(question.answer)
      ? question.answer.map(entry => normalizeComparableText(typeof entry === 'string' ? entry : JSON.stringify(entry))).join('|')
      : normalizeComparableText(question.answer),
  ].join('::')
}

export async function getQuestionBankQuestionById(db: D1Database, tenantId: string, questionId: string) {
  await ensureQuestionBankTables(db)
  const row = await db.prepare(
    `SELECT * FROM question_bank WHERE tenant_id = ? AND id = ? LIMIT 1`
  ).bind(tenantId, questionId).first() as Record<string, any> | null

  return row ? mapQuestionRow(row) : null
}

export async function saveQuestionToBank(db: D1Database, tenantId: string, input: Record<string, any>) {
  await ensureQuestionBankTables(db)
  const normalizedQuestion = extractQuestionBankPayload(input)
  const normalizedPrompt = normalizeComparableText(normalizedQuestion.prompt)
  const questionHash = await computeQuestionHash(normalizedQuestion)
  const now = new Date().toISOString()

  const existingById = normalizedQuestion.id
    ? await db.prepare(`SELECT * FROM question_bank WHERE tenant_id = ? AND id = ? LIMIT 1`).bind(tenantId, normalizedQuestion.id).first() as Record<string, any> | null
    : null
  const existingByHash = !existingById
    ? await db.prepare(`SELECT * FROM question_bank WHERE tenant_id = ? AND question_hash = ? AND type = ? LIMIT 1`).bind(tenantId, questionHash, normalizedQuestion.type).first() as Record<string, any> | null
    : null

  const similarMatches = (await listCandidateQuestions(db, tenantId, normalizedQuestion))
    .filter(question => question.id !== existingById?.id && question.id !== existingByHash?.id)
    .map(question => ({
      id: question.id,
      prompt: question.prompt,
      similarity: computePromptSimilarity(question.prompt, normalizedQuestion.prompt),
    }))
    .filter(match => match.similarity >= 0.72)
    .sort((left, right) => right.similarity - left.similarity)
    .slice(0, 5)

  if (existingByHash && !normalizedQuestion.id) {
    return {
      question: mapQuestionRow(existingByHash),
      deduplicated: true,
      similarMatches,
    }
  }

  const targetId = String(existingById?.id || normalizedQuestion.id || createId('qbank')).trim()
  const createdAt = String(existingById?.created_at || now)

  await db.prepare(
    `INSERT OR REPLACE INTO question_bank (
      id, tenant_id, subject, class_level, class_id, subject_id, topic, type, prompt, normalized_prompt, question_hash,
      options_json, answer_json, explanation, image_url, score, status, source, created_by, metadata_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    targetId,
    tenantId,
    normalizedQuestion.subject,
    normalizedQuestion.classLevel,
    normalizedQuestion.classId || null,
    normalizedQuestion.subjectId || null,
    normalizedQuestion.topic,
    normalizedQuestion.type,
    normalizedQuestion.prompt,
    normalizedPrompt,
    questionHash,
    JSON.stringify(normalizedQuestion.options || []),
    JSON.stringify(normalizedQuestion.answer ?? ''),
    normalizedQuestion.explanation,
    normalizedQuestion.imageUrl,
    normalizedQuestion.score,
    normalizedQuestion.status,
    normalizedQuestion.source,
    normalizedQuestion.createdBy || null,
    JSON.stringify(normalizedQuestion.metadata || {}),
    createdAt,
    now,
  ).run()

  return {
    question: await getQuestionBankQuestionById(db, tenantId, targetId),
    deduplicated: false,
    similarMatches,
  }
}

export async function deleteQuestionFromBank(db: D1Database, tenantId: string, questionId: string) {
  await ensureQuestionBankTables(db)
  await db.prepare(`DELETE FROM question_usage WHERE tenant_id = ? AND question_id = ?`).bind(tenantId, questionId).run()
  await db.prepare(`DELETE FROM cbt_exam_questions WHERE tenant_id = ? AND question_id = ?`).bind(tenantId, questionId).run()
  await db.prepare(`DELETE FROM question_bank WHERE tenant_id = ? AND id = ?`).bind(tenantId, questionId).run()
}

export async function syncQuestionUsagesForEngine(db: D1Database, tenantId: string, engineType: string, engineId: string, questions: Array<Record<string, any>>, context: Record<string, any> = {}) {
  await ensureQuestionBankTables(db)
  await db.prepare(`DELETE FROM question_usage WHERE tenant_id = ? AND engine_type = ? AND engine_id = ?`).bind(tenantId, engineType, engineId).run()

  const linkedQuestions = [] as Array<Record<string, any>>
  for (const rawQuestion of (Array.isArray(questions) ? questions : [])) {
    const result = await saveQuestionToBank(db, tenantId, {
      ...context,
      ...rawQuestion,
      source: rawQuestion?.source || engineType,
      createdBy: rawQuestion?.createdBy || context.createdBy,
    })
    if (!result.question) continue

    await recordQuestionUsage(db, tenantId, String(result.question.id || ''), engineType, engineId, {
      ...context,
      questionScore: Number(rawQuestion?.score || result.question.score || 1),
      questionType: result.question.type,
    })
    linkedQuestions.push({
      ...result.question,
      score: Number(rawQuestion?.score || result.question.score || 1),
    })
  }

  return linkedQuestions
}

export async function listCbtExams(db: D1Database, tenantId: string, filters: Record<string, any> = {}, options: Record<string, any> = {}) {
  await ensureQuestionBankTables(db)
  const rows = await db.prepare(
    `SELECT * FROM cbt_exams WHERE tenant_id = ? ORDER BY updated_at DESC, created_at DESC`
  ).bind(tenantId).all()

  const exams = [] as Array<Record<string, any>>
  for (const row of ((rows.results || []) as Record<string, any>[])) {
    if (filters.classId && String(row.class_id || '') !== String(filters.classId || '')) continue
    if (filters.teacherId && String(row.teacher_id || '') !== String(filters.teacherId || '')) continue
    if (filters.subjectId && String(row.subject_id || '') !== String(filters.subjectId || '')) continue
    if (filters.mode && String(row.mode || '') !== String(filters.mode || '')) continue
    if (filters.status && String(row.status || '') !== String(filters.status || '')) continue
    const questions = options.includeQuestions ? await listExamQuestions(db, tenantId, String(row.id || '')) : []
    exams.push(mapExamRow(row, questions))
  }

  return exams
}

export async function getCbtExamById(db: D1Database, tenantId: string, examId: string, options: Record<string, any> = {}) {
  await ensureQuestionBankTables(db)
  const row = await db.prepare(
    `SELECT * FROM cbt_exams WHERE tenant_id = ? AND id = ? LIMIT 1`
  ).bind(tenantId, examId).first() as Record<string, any> | null

  if (!row) return null
  const questions = options.includeQuestions ? await listExamQuestions(db, tenantId, examId) : []
  return mapExamRow(row, questions)
}

export async function saveCbtExam(db: D1Database, input: Record<string, any>) {
  await ensureQuestionBankTables(db)
  const now = new Date().toISOString()
  const examId = String(input.id || createId('cbt')).trim()
  const existing = input.id ? await getCbtExamById(db, String(input.tenantId || ''), examId, { includeQuestions: true }) : null

  const linkedQuestions = await syncQuestionUsagesForEngine(
    db,
    String(input.tenantId || ''),
    'cbt',
    examId,
    Array.isArray(input.questions) ? input.questions : [],
    {
      classId: input.classId,
      className: input.className,
      subjectId: input.subjectId,
      subjectName: input.subjectName,
      createdBy: input.teacherId,
    },
  )

  await db.prepare(
    `INSERT OR REPLACE INTO cbt_exams (
      id, tenant_id, class_id, class_name, subject_id, subject_name, teacher_id, teacher_name,
      title, window_label, duration_minutes, instructions, mode, status, release_at, settings_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    examId,
    String(input.tenantId || ''),
    String(input.classId || ''),
    String(input.className || ''),
    String(input.subjectId || ''),
    String(input.subjectName || ''),
    String(input.teacherId || ''),
    String(input.teacherName || ''),
    String(input.title || ''),
    String(input.window || input.windowLabel || ''),
    Number(input.durationMinutes || 0) || 0,
    String(input.instructions || ''),
    String(input.mode || 'cbt'),
    String(input.status || 'draft'),
    String(input.releaseAt || ''),
    JSON.stringify(input.settings && typeof input.settings === 'object' ? input.settings : {}),
    String(existing?.createdAt || now),
    now,
  ).run()

  await db.prepare(`DELETE FROM cbt_exam_questions WHERE tenant_id = ? AND exam_id = ?`).bind(String(input.tenantId || ''), examId).run()
  for (const [index, question] of linkedQuestions.entries()) {
    await db.prepare(
      `INSERT INTO cbt_exam_questions (id, tenant_id, exam_id, question_id, sort_order, score, settings_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      createId('cbtq'),
      String(input.tenantId || ''),
      examId,
      String(question.id || ''),
      index,
      Number(question.score || 1),
      JSON.stringify({}),
    ).run()
  }

  return getCbtExamById(db, String(input.tenantId || ''), examId, { includeQuestions: true })
}

export async function deleteCbtExam(db: D1Database, tenantId: string, examId: string) {
  await ensureQuestionBankTables(db)
  await db.prepare(`DELETE FROM cbt_exam_questions WHERE tenant_id = ? AND exam_id = ?`).bind(tenantId, examId).run()
  await db.prepare(`DELETE FROM question_usage WHERE tenant_id = ? AND engine_type = 'cbt' AND engine_id = ?`).bind(tenantId, examId).run()
  await db.prepare(`DELETE FROM cbt_attempts WHERE tenant_id = ? AND exam_id = ?`).bind(tenantId, examId).run()
  await db.prepare(`DELETE FROM cbt_exams WHERE tenant_id = ? AND id = ?`).bind(tenantId, examId).run()
}

export async function startCbtExam(db: D1Database, tenantId: string, examId: string) {
  const exam = await getCbtExamById(db, tenantId, examId, { includeQuestions: true })
  if (!exam) return null

  return {
    exam: {
      id: exam.id,
      title: exam.title,
      window: exam.window,
      durationMinutes: exam.durationMinutes,
      instructions: exam.instructions,
    },
    questions: (exam.questions || []).map(sanitizeExamQuestionForSession),
  }
}

export async function submitCbtExamAttempt(db: D1Database, input: Record<string, any>) {
  await ensureQuestionBankTables(db)
  const exam = await getCbtExamById(db, String(input.tenantId || ''), String(input.examId || ''), { includeQuestions: true })
  if (!exam) return null

  const responses = input.answers && typeof input.answers === 'object' ? input.answers : {}
  let score = 0
  let total = 0
  let pendingManualCount = 0
  const feedback = {} as Record<string, any>

  for (const question of (exam.questions || [])) {
    const response = (responses as Record<string, any>)[String(question.id || '')]
    const evaluation = scoreQuestion(question, response)
    total += Number(question.score || 1)
    score += Number(evaluation.awarded || 0)
    if (evaluation.pendingManualReview) pendingManualCount += 1
    feedback[String(question.id || '')] = {
      correct: evaluation.correct,
      awarded: evaluation.awarded,
      pendingManualReview: evaluation.pendingManualReview,
      response,
    }
  }

  const attemptId = createId('cbtattempt')
  const createdAt = new Date().toISOString()
  await db.prepare(
    `INSERT INTO cbt_attempts (id, tenant_id, exam_id, student_id, score, total, responses_json, feedback_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    attemptId,
    String(input.tenantId || ''),
    String(input.examId || ''),
    String(input.studentId || ''),
    score,
    total,
    JSON.stringify(responses),
    JSON.stringify(feedback),
    createdAt,
  ).run()

  return {
    attemptId,
    examId: String(input.examId || ''),
    score,
    total,
    pendingManualCount,
    timestamp: createdAt,
  }
}

export async function buildPracticeQuestionFeed(db: D1Database, tenantId: string, filters: Record<string, any> = {}) {
  await ensureQuestionBankTables(db)
  const [questionBankQuestions, assignmentQuestions] = await Promise.all([
    listQuestionBankQuestions(db, tenantId, {
      classId: filters.classId,
      subjectId: filters.subjectId,
      status: 'approved',
    }),
    listAssignmentBackedPracticeQuestions(db, tenantId, {
      classId: filters.classId,
      subjectId: filters.subjectId,
    }),
  ])

  const mergedQuestions = new Map<string, Record<string, any>>()
  for (const question of [...assignmentQuestions, ...questionBankQuestions]) {
    const signature = buildPracticeQuestionSignature(question)
    const existing = mergedQuestions.get(signature)
    if (!existing || (existing.source === 'assignment' && question.source !== 'assignment')) {
      mergedQuestions.set(signature, question)
    }
  }

  const candidateQuestions = Array.from(mergedQuestions.values()).filter(question => {
    const type = normalizeQuestionType(question.type)
    return ['mcq', 'truefalse', 'shortanswer', 'fillgaps', 'crossmatching'].includes(type)
  })

  const topicPerformanceMap = {} as Record<string, any>
  if (filters.studentId) {
    const rows = await db.prepare(
      `SELECT feedback_json, exam_id FROM cbt_attempts WHERE tenant_id = ? AND student_id = ? ORDER BY created_at DESC LIMIT 25`
    ).bind(tenantId, String(filters.studentId || '')).all()

    for (const row of ((rows.results || []) as Record<string, any>[])) {
      const feedback = parseJsonField(row.feedback_json, {} as Record<string, any>)
      for (const questionId of Object.keys(feedback)) {
        const question = candidateQuestions.find(entry => String(entry.id || '') === String(questionId))
        if (!question) continue
        const topicKey = String(question.topic || question.subjectName || question.subject || 'General').trim() || 'General'
        const current = topicPerformanceMap[topicKey] || { attempts: 0, correct: 0, accuracy: 0, examScore: 0 }
        current.attempts += 1
        if (feedback[questionId]?.correct) current.correct += 1
        current.accuracy = current.attempts > 0 ? Math.round((current.correct / current.attempts) * 100) : 0
        current.examScore = current.accuracy
        topicPerformanceMap[topicKey] = current
      }
    }
  }

  return {
    questions: candidateQuestions,
    topicPerformanceMap,
  }
}
