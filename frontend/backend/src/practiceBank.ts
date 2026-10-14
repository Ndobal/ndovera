// The shared practice bank: one subject however schools name it, what each class
// offers, how many questions each subject has, and Ndovera AI writing questions
// where a subject has too few.
//
// Subjects: "Maths", "General Mathematics" and "Mathematics (Core)" are one subject.
// The fixed rules in levels.ts catch the common names; every other name is matched by
// Ndovera AI in the background (mapNewSubjects, nightly) into `subject_aliases`, so a
// question set under any of those names reaches every student who offers the subject.
//
// Counts: `practice_bank_counts` holds how many questions each subject has per
// section, level and difficulty — raised as questions are added (practiceArena.ts),
// rebuilt once a night — so opening Practice never counts the whole bank.
//
// Generation: when a student starts a subject that has too few questions at their
// level and difficulty, Ndovera AI writes a batch with the assessment engine (the same
// standard as teachers' AI quizzes), on one of the subject's topics, into Ndovera's
// bank for every school. Students choose only the difficulty: Simple, Intermediate or
// External examination (Common Entrance, BECE, or WAEC/NECO by section). Ndovera pays
// for it — students spend no credits — within daily limits. Without topics nothing is
// generated: the student is asked to have their teacher add the class's topics.

import { buildGenerationPrompt, normalizeConfig, normalizeQuestion, parseQuestionsJson } from './assessmentEngine'
import type { Bloom, Slot } from './assessmentEngine'
import { labelOfRank, subjectKeyOf } from './levels'
import { DIFFICULTY_LEVELS, GLOBAL_TENANT, PracticeError, ensurePracticeTables, normalizeDifficulty, upsertBankQuestions } from './practiceArena'
import type { Difficulty, PracticeStudent } from './practiceArena'
import { listTopics } from './topicHub'
import { EXAMS, normalizeExam } from './practicePasses'
import type { ExamKey } from './practicePasses'

export type AiRunner = (messages: Array<{ role: string, content: string }>, options: { maxTokens: number, temperature: number }) => Promise<string>

/** Who pays nothing, how much: generous for practice, bounded for Ndovera's AI budget. */
export const GENERATION_LIMITS = { perStudentPerDay: 4, platformPerDay: 400, batch: 8, enoughQuestions: 15 }

export const DIFFICULTIES = [
  { key: 'simple', label: 'Simple', engine: 'easy', blooms: ['remember', 'understand', 'remember', 'understand', 'apply'] },
  { key: 'intermediate', label: 'Intermediate', engine: 'standard', blooms: ['understand', 'apply', 'understand', 'apply', 'analyse'] },
  { key: 'external', label: 'External examination', engine: 'external', blooms: ['apply', 'analyse', 'understand', 'apply', 'evaluate'] },
] as const

/** The external examinations a section prepares for (practicePasses.ts). Nursery has none. */
export function externalExamFor(section: string) {
  const exams = (Object.keys(EXAMS) as ExamKey[]).filter(key => EXAMS[key].section === section)
  return exams.length ? { name: exams.map(key => EXAMS[key].label).join(' / '), exams } : null
}

const now = () => new Date().toISOString()
const lagosDay = (at = new Date()) => new Date(at.getTime() + 3600_000).toISOString().slice(0, 10)
const UNKNOWN_RANK = -99

const readyDbs = new WeakSet<object>()
export async function ensurePracticeBankTables(db: D1Database) {
  if (readyDbs.has(db as object)) return
  await ensurePracticeTables(db)
  for (const statement of [
    `CREATE TABLE IF NOT EXISTS subject_aliases (raw_key TEXT PRIMARY KEY, canonical_key TEXT NOT NULL, name TEXT, decided_by TEXT, decided_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS practice_generations (
      id TEXT PRIMARY KEY, day TEXT NOT NULL, tenant_id TEXT, student_id TEXT, subject_key TEXT NOT NULL, section TEXT, level_rank INTEGER,
      difficulty TEXT, topic TEXT, added INTEGER NOT NULL DEFAULT -1, created_at TEXT NOT NULL)`,
    `CREATE INDEX IF NOT EXISTS idx_practice_generations_day ON practice_generations(day, student_id)`,
    `CREATE INDEX IF NOT EXISTS idx_practice_generations_subject ON practice_generations(subject_key, section, level_rank, difficulty)`,
  ]) await db.prepare(statement).run()
  readyDbs.add(db as object)
}

// ─── One subject, however it is named ────────────────────────────────────────

let aliasCache: { at: number, map: Map<string, string> } | null = null
export function resetSubjectAliasCache() { aliasCache = null }

async function aliasMap(db: D1Database) {
  if (aliasCache && Date.now() - aliasCache.at < 10 * 60_000) return aliasCache.map
  await ensurePracticeBankTables(db)
  const rows = await db.prepare(`SELECT raw_key, canonical_key FROM subject_aliases`).all()
  const map = new Map(((rows.results || []) as Record<string, any>[]).map(row => [String(row.raw_key), String(row.canonical_key)]))
  aliasCache = { at: Date.now(), map }
  return map
}

/** The subject's one key, and every key that means the same subject. */
export async function subjectKeys(db: D1Database, name: string) {
  const map = await aliasMap(db)
  const raw = subjectKeyOf(name)
  const canonical = map.get(raw) || raw
  const keys = [canonical, ...[...map].filter(([, target]) => target === canonical).map(([source]) => source)]
  return { key: canonical, keys: Array.from(new Set(keys.filter(Boolean))) }
}

/** What the student's class offers, each with how many questions there are at their level, by difficulty. */
export async function offeredSubjects(db: D1Database, student: PracticeStudent) {
  await ensurePracticeBankTables(db)
  const rows = student.classId
    ? await db.prepare(`SELECT id, name FROM subjects WHERE classId = ? AND (tenantId = ? OR tenantId IS NULL OR tenantId = '') ORDER BY name`).bind(student.classId, student.tenantId).all().catch(() => ({ results: [] }))
    : { results: [] }
  const subjects = new Map<string, { key: string, keys: string[], name: string, subjectId: string }>()
  for (const row of (rows.results || []) as Record<string, any>[]) {
    const name = String(row.name || '').trim()
    if (!name) continue
    const { key, keys } = await subjectKeys(db, name)
    if (key && !subjects.has(key)) subjects.set(key, { key, keys, name, subjectId: String(row.id) })
  }
  const allKeys = [...subjects.values()].flatMap(subject => subject.keys)
  const counts = new Map<string, Record<string, number>>()
  const ranks = new Map<string, number[]>()
  if (allKeys.length && student.section && student.rank !== null) {
    const result = await db.prepare(`SELECT subject_key, difficulty, level_rank, SUM(total) AS n FROM practice_bank_counts WHERE section = ? AND level_rank <= ? AND subject_key IN (${allKeys.map(() => '?').join(',')}) GROUP BY subject_key, difficulty, level_rank`)
      .bind(student.section, student.rank, ...allKeys).all()
    for (const row of (result.results || []) as Record<string, any>[]) {
      const entry = counts.get(String(row.subject_key)) || {}
      entry[String(row.difficulty || '')] = (entry[String(row.difficulty || '')] || 0) + Number(row.n || 0)
      counts.set(String(row.subject_key), entry)
      if (Number(row.level_rank) !== UNKNOWN_RANK && Number(row.n) > 0) ranks.set(String(row.subject_key), [...(ranks.get(String(row.subject_key)) || []), Number(row.level_rank)])
    }
  }
  return [...subjects.values()].map(subject => {
    const byDifficulty: Record<string, number> = { simple: 0, intermediate: 0, external: 0 }
    for (const key of subject.keys) {
      const entry = counts.get(key) || {}
      byDifficulty.simple += (entry.simple || 0) + (entry[''] || 0)
      byDifficulty.intermediate += (entry.intermediate || 0) + (entry[''] || 0)
      byDifficulty.external += entry.external || 0
    }
    const levels = subject.keys.flatMap(key => ranks.get(key) || [])
    const low = levels.length ? Math.min(...levels) : null
    const high = levels.length ? Math.max(...levels) : null
    return {
      ...subject, questions: Math.max(byDifficulty.simple, byDifficulty.intermediate) + byDifficulty.external, byDifficulty,
      levels: low === null || high === null ? '' : `${labelOfRank(low)}${high !== low ? ` – ${labelOfRank(high)}` : ''}`,
    }
  })
}

// ─── Counting the bank (nightly) ─────────────────────────────────────────────

/** Rebuild the per-subject counts: one pass over the bank a night. */
export async function rebuildBankCounts(db: D1Database) {
  await ensurePracticeBankTables(db)
  const rows = await db.prepare(`SELECT subject_key, section, COALESCE(level_rank, ${UNKNOWN_RANK}) AS level_rank, COALESCE(difficulty, '') AS difficulty, COUNT(*) AS total
    FROM question_bank WHERE playable = 1 AND COALESCE(status, 'approved') = 'approved' AND (release_at IS NULL OR release_at = '' OR release_at <= ?) AND subject_key IS NOT NULL AND subject_key != '' AND section IS NOT NULL AND section != ''
    GROUP BY subject_key, section, COALESCE(level_rank, ${UNKNOWN_RANK}), COALESCE(difficulty, '')`).bind(now()).all()
  const stamp = now()
  const statements: D1PreparedStatement[] = [db.prepare(`DELETE FROM practice_bank_counts`)]
  for (const row of (rows.results || []) as Record<string, any>[]) {
    statements.push(db.prepare(`INSERT INTO practice_bank_counts (subject_key, section, level_rank, difficulty, total, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .bind(row.subject_key, row.section, Number(row.level_rank), String(row.difficulty || ''), Number(row.total), stamp))
  }
  // One transaction, so Practice never sees the table half rebuilt.
  for (let index = 0; index < statements.length; index += 500) await db.batch(statements.slice(index, index + 500))
  return { groups: statements.length - 1 }
}

// ─── Matching subjects with Ndovera AI (nightly) ─────────────────────────────

/** The model's mapping, keeping only answers that name a key it was given. */
export function parseSubjectMapping(reply: string, asked: string[], known: string[]) {
  const allowed = new Set([...asked, ...known])
  let parsed: any = null
  const text = String(reply || '')
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  try { parsed = JSON.parse(start >= 0 && end > start ? text.slice(start, end + 1) : text) } catch { return new Map<string, string>() }
  const out = new Map<string, string>()
  for (const key of asked) {
    const target = String(parsed?.[key] || '').trim()
    out.set(key, allowed.has(target) ? target : key)
  }
  return out
}

/**
 * Subject names Ndovera has not placed yet (in the bank or offered by any school) are
 * matched to subjects it knows: the same subject under another name joins it; anything
 * else becomes a subject of its own. Further Mathematics is never Mathematics.
 */
export async function mapNewSubjects(db: D1Database, runAi: AiRunner, limit = 60) {
  await ensurePracticeBankTables(db)
  const map = await aliasMap(db)
  const [inBank, offered] = await Promise.all([
    db.prepare(`SELECT DISTINCT subject_key FROM practice_bank_counts`).all(),
    db.prepare(`SELECT DISTINCT name FROM subjects WHERE name IS NOT NULL AND name != ''`).all().catch(() => ({ results: [] })),
  ])
  const names = new Map<string, string>()
  for (const row of (inBank.results || []) as Record<string, any>[]) names.set(String(row.subject_key), String(row.subject_key).replace(/-/g, ' '))
  for (const row of (offered.results || []) as Record<string, any>[]) { const key = subjectKeyOf(row.name); if (key && !names.has(key)) names.set(key, String(row.name)) }
  const known = Array.from(new Set([...map.values()]))
  const fresh = [...names.keys()].filter(key => !map.has(key)).slice(0, limit)
  if (!fresh.length) return { mapped: 0 }
  const reply = await runAi([
    { role: 'system', content: 'You match school subject names. Two names are the same subject only when a student would sit the same subject under either name (e.g. "maths" and "general mathematics"). Different subjects stay apart: Further Mathematics is not Mathematics, Basic Science is not Biology, Literature is not English. Reply with JSON only.' },
    { role: 'user', content: `Known subjects (keys): ${JSON.stringify(known)}\nNew subjects (key: how a school wrote it): ${JSON.stringify(Object.fromEntries(fresh.map(key => [key, names.get(key)])))}\nReturn one JSON object mapping each new key to the known or new key it is the same subject as, or to itself if it is a subject of its own.` },
  ], { maxTokens: 1500, temperature: 0 })
  const mapping = parseSubjectMapping(reply, fresh, known)
  if (!mapping.size) return { mapped: 0 }
  // A new key mapped to another new key: that other one is the subject itself.
  const stamp = now()
  const statements = [...mapping].map(([raw, target]) => {
    const canonical = mapping.get(target) && mapping.get(target) !== target ? mapping.get(target)! : target
    return db.prepare(`INSERT OR IGNORE INTO subject_aliases (raw_key, canonical_key, name, decided_by, decided_at) VALUES (?, ?, ?, 'ai', ?)`).bind(raw, canonical, names.get(raw) || raw, stamp)
  })
  await db.batch(statements)
  resetSubjectAliasCache()
  return { mapped: statements.length }
}

// ─── Ndovera AI writes questions where there are too few ─────────────────────

async function topicsFor(db: D1Database, student: PracticeStudent, subject: { subjectId: string, keys: string[] }) {
  // The class's own topics first (the topics its teachers set), then topics already in the bank for this subject and section.
  const own = subject.subjectId && student.classId
    ? (await listTopics(db, student.classId, subject.subjectId, { publishedOnly: true }).catch(() => [])).map(topic => topic.name).filter(Boolean)
    : []
  if (own.length) return own
  if (!student.section || !subject.keys.length) return []
  const rows = await db.prepare(`SELECT DISTINCT topic FROM question_bank WHERE subject_key IN (${subject.keys.map(() => '?').join(',')}) AND section = ? AND playable = 1 AND topic IS NOT NULL AND topic != '' LIMIT 40`)
    .bind(...subject.keys, student.section).all().catch(() => ({ results: [] }))
  return ((rows.results || []) as Record<string, any>[]).map(row => String(row.topic)).filter(Boolean)
}

export type GenerationResult = { added: number, topic?: string, needsTopics?: boolean, busy?: boolean, limited?: 'student' | 'platform' }

/**
 * One batch of questions from Ndovera AI into Ndovera's bank, to the standard asked for:
 * a school level (simple / intermediate) or an examination (WAEC, NECO, JAMB, BECE,
 * Common Entrance). `context` grounds it in a material or a syllabus topic. Used when a
 * student finds a subject short, and by the night builder (practiceBuilder.ts).
 */
export async function writeQuestions(db: D1Database, options: {
  subject: { key: string, keys?: string[], name: string }, section: string, rank: number, difficulty: Difficulty, exam?: ExamKey | '', topic: string,
  context?: string, runAi: AiRunner, originType: string, originId: string, batch?: number,
}) {
  const level = DIFFICULTIES.find(item => item.key === options.difficulty)!
  const exam = options.difficulty === 'external' && options.exam ? EXAMS[options.exam] : null
  const batch = options.batch || GENERATION_LIMITS.batch
  const className = labelOfRank(options.rank)
  const optionCount = exam?.mcqOptions || 4
  const config = normalizeConfig({ kind: 'quiz', standard: exam?.standard || 'school', difficulty: level.engine, questionCount: batch, totalMarks: batch, types: ['mcq'], topicNames: [options.topic], mcqOptions: optionCount }, className)
  // Examinations are objective papers: no true/false items there.
  const slots: Slot[] = Array.from({ length: batch }, (_, index) => ({
    index, section: 'A', type: !exam && index % 4 === 3 ? 'truefalse' : 'mcq', bloom: level.blooms[index % level.blooms.length] as Bloom, topic: options.topic, marks: 1,
  }))
  const keys = options.subject.keys?.length ? options.subject.keys : [options.subject.key]
  const sample = await db.prepare(`SELECT prompt FROM question_bank WHERE subject_key IN (${keys.map(() => '?').join(',')}) AND section = ? AND topic = ? LIMIT 20`)
    .bind(...keys, options.section, options.topic).all().catch(() => ({ results: [] }))
  const context = [
    exam
      ? `Objective questions on "${options.topic}" in ${options.subject.name}, written to the standard of ${exam.style}. Match that examination exactly: its syllabus, wording, ${optionCount} options per question, plausible distractors and level of difficulty. Do not copy real past questions; write new ones of the same standard.`
      : `Practice questions for ${className} students on the topic "${options.topic}" in ${options.subject.name}.`,
    options.difficulty === 'simple' ? 'Keep them simple: clear recall and understanding, one step each, everyday language for this class.' : '',
    options.difficulty === 'intermediate' ? 'Make them intermediate: understanding and application, some two-step questions.' : '',
    options.context ? `Base the questions on this material:\n${options.context.slice(0, 5000)}` : '',
    'Every question must have exactly one correct option. Work it out first and give the working or reason in "workingSteps".',
  ].filter(Boolean).join('\n\n')
  const prompt = buildGenerationPrompt({ config, slots, subjectName: options.subject.name, className, context, existingPrompts: ((sample.results || []) as Record<string, any>[]).map(row => String(row.prompt)) })
  const reply = await options.runAi([{ role: 'system', content: prompt.system }, { role: 'user', content: prompt.user }], { maxTokens: 700 + 420 * batch, temperature: 0.6 })
  const questions = parseQuestionsJson(reply).map((item, index) => normalizeQuestion(item, slots[index] || slots[0], optionCount))
    .filter(({ question, problems }) => !problems.length && ['mcq', 'truefalse'].includes(question.type) && question.answerIndex >= 0)
    .map(({ question }) => question)
  return upsertBankQuestions(db, questions.map(question => ({
    tenantId: GLOBAL_TENANT, type: question.type, prompt: question.prompt, options: question.options, answer: question.answerIndex,
    explanation: [...(question.workingSteps || []), ...(question.markingPoints || [])].join('\n').slice(0, 4000),
    subject: options.subject.name, subjectKey: options.subject.key, section: options.section, rank: options.rank, topic: options.topic,
    difficulty: options.difficulty, exam: exam ? options.exam : undefined,
    originType: options.originType, originId: options.originId, answerSource: 'ai', createdBy: 'Ndovera AI', status: 'approved',
  })))
}

/**
 * A student opened a subject with too few questions: Ndovera AI writes a batch at once.
 * The caller has already checked the student may open it; daily limits apply here.
 */
export async function generatePracticeQuestions(db: D1Database, options: {
  student: PracticeStudent, subject: { key: string, keys: string[], name: string, subjectId: string }, difficulty: string, exam?: string, runAi: AiRunner,
}): Promise<GenerationResult> {
  await ensurePracticeBankTables(db)
  const { student, subject } = options
  const difficulty = normalizeDifficulty(options.difficulty) || 'intermediate'
  if (!student.section || student.rank === null) throw new PracticeError('Ndovera cannot tell which level your class is, so it cannot prepare questions for it. Ask your school to name the class like "JSS 2" or "Primary 4".', 409)
  const exam = difficulty === 'external' ? normalizeExam(options.exam) : ''
  if (difficulty === 'external' && (!exam || EXAMS[exam].section !== student.section)) throw new PracticeError('Choose one of your section\'s examinations.')
  const day = lagosDay()
  const [mine, everyone, running] = await Promise.all([
    db.prepare(`SELECT COUNT(*) AS n FROM practice_generations WHERE day = ? AND student_id = ?`).bind(day, student.studentId).first(),
    db.prepare(`SELECT COUNT(*) AS n FROM practice_generations WHERE day = ?`).bind(day).first(),
    db.prepare(`SELECT COUNT(*) AS n FROM practice_generations WHERE subject_key = ? AND section = ? AND level_rank = ? AND difficulty = ? AND added = -1 AND created_at > ?`)
      .bind(subject.key, student.section, student.rank, difficulty, new Date(Date.now() - 2 * 60_000).toISOString()).first(),
  ]) as Array<Record<string, any> | null>
  if (Number(running?.n || 0) > 0) return { added: 0, busy: true }
  if (Number(mine?.n || 0) >= GENERATION_LIMITS.perStudentPerDay) return { added: 0, limited: 'student' }
  if (Number(everyone?.n || 0) >= GENERATION_LIMITS.platformPerDay) return { added: 0, limited: 'platform' }

  const topics = await topicsFor(db, student, subject)
  if (!topics.length) return { added: 0, needsTopics: true }
  // The topic written about least so far at this level and difficulty.
  const done = await db.prepare(`SELECT topic, COUNT(*) AS n FROM practice_generations WHERE subject_key = ? AND section = ? AND level_rank = ? AND difficulty = ? GROUP BY topic`)
    .bind(subject.key, student.section, student.rank, difficulty).all()
  const used = new Map(((done.results || []) as Record<string, any>[]).map(row => [String(row.topic), Number(row.n)]))
  const topic = [...topics].sort((a, b) => (used.get(a) || 0) - (used.get(b) || 0) || Math.random() - 0.5)[0]

  const id = `pgen_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`
  await db.prepare(`INSERT INTO practice_generations (id, day, tenant_id, student_id, subject_key, section, level_rank, difficulty, topic, added, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, -1, ?)`)
    .bind(id, day, student.tenantId, student.studentId, subject.key, student.section, student.rank, difficulty, topic, now()).run()
  try {
    const result = await writeQuestions(db, { subject, section: student.section, rank: student.rank, difficulty, exam, topic, runAi: options.runAi, originType: 'ndovera_ai_practice', originId: id })
    await db.prepare(`UPDATE practice_generations SET added = ? WHERE id = ?`).bind(result.added, id).run()
    return { added: result.added, topic }
  } catch (error) {
    await db.prepare(`UPDATE practice_generations SET added = 0 WHERE id = ?`).bind(id).run().catch(() => null)
    throw error
  }
}

export { DIFFICULTY_LEVELS }
export type { Difficulty }
