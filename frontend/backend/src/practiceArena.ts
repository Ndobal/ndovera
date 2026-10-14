// Practice Arena: students practise from the question bank — no AI call is ever
// made here, so practice works from day one, for everyone, at no cost.
//
// Where the questions come from: everything teachers in every Ndovera school have
// given (assignments, notes, materials, submitted work — gathered by the harvester),
// schools' own banks, Ndovera's bank (tenant 'global', uploaded by Ami with a
// section), and questions Ndovera AI writes when a subject has too few
// (practiceBank.ts). A question set in one school helps students in all of them.
//
// Which questions a student sees: their subject (however a school names it), their
// section, every level up to their own — a JSS 3 student practises JSS 1–3, a JSS 2
// student JSS 1–2 — and the difficulty they choose. Exam questions stay hidden until
// after the exam (release_at).
//
// Packs carry their answers so a quiz can be played and marked with no network;
// the attempt is sent later and re-marked here from the bank, which decides XP.

import { levelOf, labelOfRank, sectionOfRank, subjectKeyOf, normalizeSection } from './levels'
import type { SectionKey } from './levels'

export class PracticeError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

export const GLOBAL_TENANT = 'global'
export const PACK_SIZE = 60
const now = () => new Date().toISOString()
const parse = <T,>(value: unknown, fallback: T): T => { try { return value ? JSON.parse(String(value)) as T : fallback } catch { return fallback } }

// ─── The bank: columns practice needs ─────────────────────────────────────────

const PRACTICE_COLUMNS: Array<[string, string]> = [
  ['section', 'section TEXT'], ['level_rank', 'level_rank INTEGER'], ['subject_key', 'subject_key TEXT'], ['release_at', 'release_at TEXT'],
  ['answer_source', 'answer_source TEXT'], ['origin_type', 'origin_type TEXT'], ['origin_id', 'origin_id TEXT'], ['playable', 'playable INTEGER'],
  // simple | intermediate | external (blank: not graded, counted as simple or intermediate).
  ['difficulty', 'difficulty TEXT'],
]

export const DIFFICULTY_LEVELS = ['simple', 'intermediate', 'external'] as const
export type Difficulty = typeof DIFFICULTY_LEVELS[number]
export const normalizeDifficulty = (value: unknown): Difficulty | '' => ((DIFFICULTY_LEVELS as readonly string[]).includes(String(value)) ? String(value) as Difficulty : '')

const readyDbs = new WeakSet<object>()
export async function ensurePracticeTables(db: D1Database) {
  if (readyDbs.has(db as object)) return
  // The bank itself is created by questionBank.ts; on a fresh database make sure it exists.
  await db.prepare(`CREATE TABLE IF NOT EXISTS question_bank (
    id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, subject TEXT, class_level TEXT, class_id TEXT, subject_id TEXT, topic TEXT, type TEXT NOT NULL,
    prompt TEXT NOT NULL, normalized_prompt TEXT NOT NULL, question_hash TEXT NOT NULL, options_json TEXT, answer_json TEXT, explanation TEXT,
    image_url TEXT, score REAL, status TEXT, source TEXT, created_by TEXT, metadata_json TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
    UNIQUE(tenant_id, question_hash, type)
  )`).run()
  const columns = new Set(((await db.prepare(`PRAGMA table_info(question_bank)`).all()).results || []).map((row: any) => String(row.name).toLowerCase()))
  for (const [name, definition] of PRACTICE_COLUMNS) {
    if (!columns.has(name)) { try { await db.exec(`ALTER TABLE question_bank ADD COLUMN ${definition}`) } catch {} }
  }
  for (const statement of [
    `CREATE INDEX IF NOT EXISTS idx_question_bank_practice ON question_bank(subject_key, section, level_rank, playable)`,
    `CREATE INDEX IF NOT EXISTS idx_question_bank_hash ON question_bank(tenant_id, question_hash)`,
    `CREATE INDEX IF NOT EXISTS idx_question_bank_pending ON question_bank(answer_source, playable)`,
    // Rows in rowid order within a subject and section: a pack starts at a random point and
    // reads only as many rows as it needs, however large the shared bank grows.
    `CREATE INDEX IF NOT EXISTS idx_question_bank_sample ON question_bank(subject_key, section, playable)`,
    // How many questions each subject has per section, level and difficulty (see practiceBank.ts).
    `CREATE TABLE IF NOT EXISTS practice_bank_counts (
      subject_key TEXT NOT NULL, section TEXT NOT NULL, level_rank INTEGER NOT NULL, difficulty TEXT NOT NULL, total INTEGER NOT NULL DEFAULT 0, updated_at TEXT,
      PRIMARY KEY (subject_key, section, level_rank, difficulty))`,
    `CREATE TABLE IF NOT EXISTS practice_profiles (
      student_id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, student_name TEXT, class_id TEXT, xp INTEGER NOT NULL DEFAULT 0,
      streak INTEGER NOT NULL DEFAULT 0, best_streak INTEGER NOT NULL DEFAULT 0, last_active_date TEXT, today_date TEXT, today_xp INTEGER NOT NULL DEFAULT 0,
      daily_goal INTEGER NOT NULL DEFAULT 50, answered INTEGER NOT NULL DEFAULT 0, correct INTEGER NOT NULL DEFAULT 0, quizzes INTEGER NOT NULL DEFAULT 0,
      perfect INTEGER NOT NULL DEFAULT 0, badges_json TEXT NOT NULL DEFAULT '[]', subjects_json TEXT NOT NULL DEFAULT '[]', updated_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS practice_attempts (
      id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, student_id TEXT NOT NULL, student_name TEXT, class_id TEXT, subject_key TEXT, subject_name TEXT,
      mode TEXT, total INTEGER NOT NULL, correct REAL NOT NULL, percent INTEGER NOT NULL, xp INTEGER NOT NULL, duration_sec INTEGER,
      details_json TEXT, started_at TEXT, finished_at TEXT, week_key TEXT, created_at TEXT NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_practice_attempts_board ON practice_attempts(tenant_id, class_id, week_key)`,
    `CREATE INDEX IF NOT EXISTS idx_practice_attempts_student ON practice_attempts(student_id, created_at)`,
    `CREATE TABLE IF NOT EXISTS practice_question_stats (
      student_id TEXT NOT NULL, question_id TEXT NOT NULL, seen INTEGER NOT NULL DEFAULT 0, correct INTEGER NOT NULL DEFAULT 0,
      box INTEGER NOT NULL DEFAULT 0, last_seen TEXT, PRIMARY KEY (student_id, question_id)
    )`,
  ]) await db.prepare(statement).run()
  readyDbs.add(db as object)
}

// ─── Questions in, questions out ──────────────────────────────────────────────

export function normalizeText(value: unknown) {
  return String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

export function bankType(value: unknown) {
  const type = String(value || '').toLowerCase().replace(/[^a-z]/g, '')
  if (['mcq', 'multiplechoice', 'objective'].includes(type)) return 'mcq'
  if (['truefalse', 'tf', 'trueorfalse'].includes(type)) return 'truefalse'
  if (['shortanswer', 'short', 'oneword'].includes(type)) return 'shortanswer'
  if (['fillgaps', 'fillblank', 'fill', 'fillintheblank', 'cloze'].includes(type)) return 'fillgaps'
  if (['crossmatching', 'matching', 'match'].includes(type)) return 'crossmatching'
  if (type === 'comprehension') return 'comprehension'
  if (['essay', 'longanswer', 'structured', 'theory', 'calculation', 'practical'].includes(type)) return 'essay'
  return type || 'mcq'
}

async function hashOf(type: string, prompt: string, options: string[]) {
  // The same signature questionBank.ts uses, so a harvested copy of a teacher's question is the same row.
  const signature = [type, normalizeText(prompt), options.map(normalizeText).join('|')].join('::')
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(signature))
  return Array.from(new Uint8Array(digest)).map(value => value.toString(16).padStart(2, '0')).join('')
}

/** The index of the right option, from a letter ("B"), the option's text, or an index. */
export function correctIndexOf(answer: unknown, options: string[]) {
  if (typeof answer === 'number' && answer >= 0 && answer < options.length) return answer
  const raw = String(answer ?? '').trim()
  if (!raw) return -1
  const letter = raw.match(/^\(?([A-Ha-h])\)?[.)]?$/)
  if (letter) {
    const index = letter[1].toUpperCase().charCodeAt(0) - 65
    if (index < options.length) return index
  }
  const text = normalizeText(raw.replace(/^\(?[A-Ha-h][.)]\s+/, ''))
  const byText = options.findIndex(option => normalizeText(option) === text)
  if (byText >= 0) return byText
  if (/^\d+$/.test(raw) && Number(raw) < options.length) return Number(raw)
  return -1
}

export type BankInput = {
  tenantId: string, type: string, prompt: string, options?: string[], answer?: unknown, explanation?: string, passage?: string, imageUrl?: string,
  pairs?: Array<{ left: string, right: string }>,
  subject?: string, subjectId?: string, classId?: string, classLevel?: string, section?: string, rank?: number | null, topic?: string,
  originType: string, originId: string, releaseAt?: string | null, answerSource?: string, createdBy?: string, status?: string,
  difficulty?: string,
  /** The subject's practice key when already known (Ndovera AI questions use the subject's canonical key). */
  subjectKey?: string,
  /** Exam papers: the release date follows the exam (it can move later), for the copy that came from this paper. */
  exactRelease?: boolean,
}

function answerText(type: string, answer: unknown, pairs?: Array<{ left: string, right: string }>) {
  if (type === 'crossmatching') return pairs || (Array.isArray(answer) ? answer : [])
  if (Array.isArray(answer)) return answer.map(value => String(value ?? '').trim()).filter(Boolean)
  return String(answer ?? '').trim()
}

/**
 * Count questions practice can use now (playable, approved, released, placed on the
 * ladder) into `practice_bank_counts` — called wherever a question becomes playable.
 */
export async function countNewlyPlayable(db: D1Database, rows: Array<Record<string, any>>) {
  const counted = new Map<string, number>()
  const stamp = now()
  for (const row of rows) {
    const subjectKey = row.subjectKey ?? row.subject_key
    const section = row.section
    const status = row.status || 'approved'
    const releaseAt = row.releaseAt ?? row.release_at
    if (!subjectKey || !section || status !== 'approved' || (releaseAt && String(releaseAt) > stamp)) continue
    const key = JSON.stringify([subjectKey, section, row.rank ?? row.level_rank ?? -99, row.difficulty || ''])
    counted.set(key, (counted.get(key) || 0) + 1)
  }
  if (!counted.size) return
  await db.batch([...counted].map(([key, total]) => {
    const [subjectKey, section, rank, difficulty] = JSON.parse(key)
    return db.prepare(`INSERT INTO practice_bank_counts (subject_key, section, level_rank, difficulty, total, updated_at) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(subject_key, section, level_rank, difficulty) DO UPDATE SET total = total + excluded.total, updated_at = excluded.updated_at`).bind(subjectKey, section, Number(rank), difficulty, total, stamp)
  }))
}

/** Whether a question can be played and marked: objective ones need their key, open ones a model answer. */
export function isPlayable(type: string, options: string[], answer: unknown, explanation = '') {
  if (type === 'mcq' || type === 'truefalse') return options.length >= 2 && correctIndexOf(answer, options) >= 0
  if (type === 'crossmatching') return Array.isArray(answer) && answer.length >= 2
  if (type === 'shortanswer' || type === 'fillgaps') return Array.isArray(answer) ? answer.length > 0 : String(answer || '').trim().length > 0
  return String(Array.isArray(answer) ? answer.join(' ') : answer || '').trim().length > 0 || String(explanation || '').trim().length > 20
}

/**
 * Add questions to the bank (or improve the copy already there). Returns how many
 * were new. A question already public stays public; one that has now been given
 * openly is released; a missing answer key is filled in when a source has it.
 */
export async function upsertBankQuestions(db: D1Database, inputs: BankInput[]) {
  await ensurePracticeTables(db)
  const rows: Array<Record<string, any>> = []
  for (const input of inputs) {
    const prompt = String(input.prompt || '').trim()
    if (prompt.length < 3) continue
    const type = bankType(input.type)
    const options = type === 'truefalse' && !(input.options || []).length ? ['True', 'False'] : (input.options || []).map(option => String(option || '').trim()).filter(Boolean).slice(0, 8)
    const answer = answerText(type, input.answer, input.pairs)
    const explanation = String(input.explanation || '').trim().slice(0, 4000)
    const playable = isPlayable(type, options, answer, explanation)
    const level = input.rank !== undefined && input.rank !== null ? { rank: input.rank, section: sectionOfRank(input.rank) } : levelOf(input.classLevel)
    const section = normalizeSection(input.section) || level?.section || ''
    const subjectName = String(input.subject || '').trim()
    rows.push({
      tenantId: input.tenantId || GLOBAL_TENANT, type, prompt: prompt.slice(0, 6000), options, answer, explanation, playable,
      hash: await hashOf(type, prompt, options), subjectName, subjectKey: input.subjectKey || subjectKeyOf(subjectName), difficulty: normalizeDifficulty(input.difficulty) || null, subjectId: input.subjectId || '', classId: input.classId || '',
      classLevel: input.classLevel || (level ? labelOfRank(level.rank) : ''), section, rank: level?.rank ?? null, topic: String(input.topic || '').slice(0, 200),
      releaseAt: input.releaseAt || null, originType: input.originType, originId: input.originId, exactRelease: Boolean(input.exactRelease),
      answerSource: playable ? (input.answerSource || 'teacher') : (type === 'crossmatching' ? 'none' : 'pending'),
      metadata: { ...(input.passage ? { passage: input.passage.slice(0, 8000) } : {}), ...(subjectName ? { subjectName } : {}), ...(type === 'crossmatching' && Array.isArray(answer) ? { left: (answer as any[]).map(pair => pair.left), right: (answer as any[]).map(pair => pair.right) } : {}) },
      imageUrl: input.imageUrl || '', createdBy: input.createdBy || '', status: input.status || 'approved',
    })
  }
  if (!rows.length) return { added: 0, updated: 0 }
  let added = 0
  let updated = 0
  // Questions practice can use now are counted at once; the nightly rebuild catches the rest.
  const nowPlayable: Array<Record<string, any>> = []
  for (let start = 0; start < rows.length; start += 40) {
    const slice = rows.slice(start, start + 40)
    const byTenant = new Map<string, Array<Record<string, any>>>()
    for (const row of slice) byTenant.set(row.tenantId, [...(byTenant.get(row.tenantId) || []), row])
    const statements: D1PreparedStatement[] = []
    for (const [tenantId, group] of byTenant) {
      const hashes = Array.from(new Set(group.map(row => row.hash)))
      const existing = await db.prepare(`SELECT id, question_hash, type, release_at, playable, origin_id FROM question_bank WHERE tenant_id = ? AND question_hash IN (${hashes.map(() => '?').join(',')})`)
        .bind(tenantId, ...hashes).all()
      const found = new Map(((existing.results || []) as Record<string, any>[]).map(row => [`${row.question_hash}:${row.type}`, row]))
      const seen = new Set<string>()
      for (const row of group) {
        const key = `${row.hash}:${row.type}`
        if (seen.has(key)) continue
        seen.add(key)
        const current = found.get(key)
        const stamp = now()
        if (!current) {
          added += 1
          if (row.playable) nowPlayable.push(row)
          statements.push(db.prepare(`INSERT OR IGNORE INTO question_bank (id, tenant_id, subject, class_level, class_id, subject_id, topic, type, prompt, normalized_prompt, question_hash,
            options_json, answer_json, explanation, image_url, score, status, source, created_by, metadata_json, created_at, updated_at,
            section, level_rank, subject_key, release_at, answer_source, origin_type, origin_id, playable, difficulty)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
            `qb_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`, tenantId, row.subjectName, row.classLevel, row.classId, row.subjectId, row.topic, row.type,
            row.prompt, normalizeText(row.prompt), row.hash, JSON.stringify(row.options), JSON.stringify(row.answer), row.explanation, row.imageUrl,
            row.status, `harvest:${row.originType}`, row.createdBy, JSON.stringify(row.metadata), stamp, stamp,
            row.section || null, row.rank, row.subjectKey || null, row.releaseAt, row.answerSource, row.originType, row.originId, row.playable ? 1 : 0, row.difficulty,
          ))
          continue
        }
        // Released as soon as any source has given it openly; the earlier of two release dates wins.
        const release = row.exactRelease && String(current.origin_id || '') === row.originId
          ? row.releaseAt
          : !current.release_at || !row.releaseAt ? null : (String(row.releaseAt) < String(current.release_at) ? row.releaseAt : current.release_at)
        const improveKey = !Number(current.playable) && row.playable
        if (improveKey) nowPlayable.push({ ...row, releaseAt: release })
        if (release !== (current.release_at || null) || improveKey) {
          updated += 1
          statements.push(db.prepare(`UPDATE question_bank SET release_at = ?, updated_at = ?
            ${improveKey ? ', answer_json = ?, explanation = ?, playable = 1, answer_source = ?' : ''}
            , section = COALESCE(NULLIF(section, ''), ?), level_rank = COALESCE(level_rank, ?), subject_key = COALESCE(NULLIF(subject_key, ''), ?)
            WHERE id = ?`).bind(release, stamp, ...(improveKey ? [JSON.stringify(row.answer), row.explanation, row.answerSource] : []), row.section || null, row.rank, row.subjectKey || null, current.id))
        }
      }
    }
    if (statements.length) await db.batch(statements)
  }
  await countNewlyPlayable(db, nowPlayable)
  return { added, updated }
}

/** Questions written before practice had sections and levels: work them out from what is there. */
export async function classifyLegacyQuestions(db: D1Database, limit = 150, onlyId = '', sectionHint = '') {
  await ensurePracticeTables(db)
  const rows = await db.prepare(`SELECT q.id, q.type, q.subject, q.class_level, q.options_json, q.answer_json, q.explanation, q.metadata_json, c.name AS class_name
    FROM question_bank q LEFT JOIN classes c ON c.id = q.class_id WHERE ${onlyId ? 'q.id = ?' : 'q.subject_key IS NULL'} LIMIT ?`).bind(...(onlyId ? [onlyId] : []), limit).all().catch(() => ({ results: [] }))
  const statements: D1PreparedStatement[] = []
  for (const row of (rows.results || []) as Record<string, any>[]) {
    const type = bankType(row.type)
    const options = parse<string[]>(row.options_json, [])
    const answer = parse<unknown>(row.answer_json, row.answer_json || '')
    const metadata = parse<Record<string, any>>(row.metadata_json, {})
    const level = levelOf(row.class_level) || levelOf(row.class_name)
    const playable = isPlayable(type, Array.isArray(options) ? options : [], answer, row.explanation || '')
    statements.push(db.prepare(`UPDATE question_bank SET subject_key = ?, section = ${sectionHint ? '?' : "COALESCE(NULLIF(section, ''), ?)"}, level_rank = COALESCE(level_rank, ?), playable = ?,
      answer_source = COALESCE(answer_source, ?), origin_type = COALESCE(origin_type, 'bank') WHERE id = ?`).bind(
      subjectKeyOf(row.subject || metadata.subjectName || '') || '-', normalizeSection(sectionHint) || level?.section || normalizeSection(row.class_level) || null, level?.rank ?? null,
      playable ? 1 : 0, playable ? 'teacher' : (type === 'crossmatching' ? 'none' : 'pending'), row.id))
  }
  if (statements.length) await db.batch(statements)
  return statements.length
}

// ─── The student ─────────────────────────────────────────────────────────────

export type PracticeStudent = { tenantId: string, studentId: string, studentName: string, classId: string, className: string, rank: number | null, section: SectionKey | '' }

export async function practiceStudent(db: D1Database, input: { tenantId: string, studentId: string, studentName: string, classId: string }): Promise<PracticeStudent> {
  const classRow = input.classId
    ? await db.prepare(`SELECT name, arm FROM classes WHERE id = ? AND tenantId = ?`).bind(input.classId, input.tenantId).first().catch(() => null) as Record<string, any> | null
    : null
  const level = levelOf(classRow?.name)
  return {
    ...input, className: classRow ? `${classRow.name}${classRow.arm ? ` ${classRow.arm}` : ''}` : '',
    rank: level?.rank ?? null, section: level?.section || '',
  }
}

/** Questions of a difficulty: ungraded ones count as simple or intermediate, never as external. */
function difficultyClause(difficulty: Difficulty | '') {
  if (difficulty === 'external') return ` AND q.difficulty = 'external'`
  if (difficulty) return ` AND (q.difficulty IS NULL OR q.difficulty = '' OR q.difficulty = '${difficulty}')`
  return ''
}

/**
 * The SQL that limits questions to a student's ladder (own section, levels up to their
 * own), released, playable — from every school. A class Ndovera cannot place on the
 * ladder practises its own school's questions for that class.
 */
function ladder(student: PracticeStudent, difficulty: Difficulty | '' = '') {
  const released = `(q.release_at IS NULL OR q.release_at = '' OR q.release_at <= ?)`
  const base = `q.playable = 1 AND COALESCE(q.status, 'approved') = 'approved' AND ${released}${difficultyClause(difficulty)}`
  if (student.section && student.rank !== null) {
    return { where: `${base} AND q.section = ? AND (q.level_rank IS NULL OR q.level_rank <= ?)`, params: [now(), student.section, student.rank] }
  }
  return { where: `${base} AND q.tenant_id = ? AND q.class_id = ?`, params: [now(), student.tenantId, student.classId] }
}

/**
 * Up to `limit` questions for the subject's keys, starting at a random point in the
 * bank and wrapping round: reads about as many rows as it returns, not the whole
 * subject. Without a section (a class off the ladder), the school's own questions.
 */
async function sampleQuestions(db: D1Database, student: PracticeStudent, keys: string[], difficulty: Difficulty | '', limit: number) {
  const { where, params } = ladder(student, difficulty)
  const out: Record<string, any>[] = []
  for (const key of keys) {
    if (out.length >= limit) break
    const want = limit - out.length
    if (!student.section) {
      const rows = await db.prepare(`SELECT q.* FROM question_bank q WHERE ${where} AND q.subject_key = ? ORDER BY RANDOM() LIMIT ?`).bind(...params, key, want).all()
      out.push(...((rows.results || []) as Record<string, any>[]))
      continue
    }
    const bounds = await db.prepare(`SELECT MIN(rowid) AS lo, MAX(rowid) AS hi FROM question_bank WHERE subject_key = ? AND section = ? AND playable = 1`).bind(key, student.section).first() as Record<string, any> | null
    if (bounds?.lo === null || bounds?.lo === undefined) continue
    const lo = Number(bounds.lo)
    const hi = Number(bounds.hi)
    const start = lo + Math.floor(Math.random() * (hi - lo + 1))
    const sql = (op: string) => `SELECT q.* FROM question_bank q WHERE q.subject_key = ? AND q.section = ? AND q.playable = 1 AND q.rowid ${op} ? AND ${where} ORDER BY q.rowid LIMIT ?`
    const first = await db.prepare(sql('>=')).bind(key, student.section, start, ...params, want).all()
    const rows = (first.results || []) as Record<string, any>[]
    if (rows.length < want) {
      const rest = await db.prepare(sql('<')).bind(key, student.section, start, ...params, want - rows.length).all()
      rows.push(...((rest.results || []) as Record<string, any>[]))
    }
    out.push(...rows)
  }
  return out
}

export async function practiceSubjects(db: D1Database, student: PracticeStudent) {
  await ensurePracticeTables(db)
  const { where, params } = ladder(student)
  const rows = await db.prepare(`SELECT q.subject_key AS subject_key, MAX(q.subject) AS subject, COUNT(*) AS total,
      SUM(CASE WHEN q.type IN ('mcq', 'truefalse') THEN 1 ELSE 0 END) AS objective,
      SUM(CASE WHEN q.type IN ('shortanswer', 'fillgaps', 'crossmatching') THEN 1 ELSE 0 END) AS written,
      SUM(CASE WHEN q.type IN ('essay', 'comprehension', 'longanswer') THEN 1 ELSE 0 END) AS open_ended,
      MIN(q.level_rank) AS min_rank, MAX(q.level_rank) AS max_rank
    FROM question_bank q WHERE ${where} AND q.subject_key IS NOT NULL AND q.subject_key != '-' GROUP BY q.subject_key ORDER BY total DESC LIMIT 40`).bind(...params).all()
  const mastery = await db.prepare(`SELECT a.subject_key, SUM(a.correct) AS correct, SUM(a.total) AS total, COUNT(*) AS quizzes, MAX(a.created_at) AS last_played
    FROM practice_attempts a WHERE a.student_id = ? GROUP BY a.subject_key`).bind(student.studentId).all()
  const bySubject = new Map(((mastery.results || []) as Record<string, any>[]).map(row => [String(row.subject_key), row]))
  return ((rows.results || []) as Record<string, any>[]).map(row => {
    const played = bySubject.get(String(row.subject_key))
    const total = Number(played?.total || 0)
    return {
      key: String(row.subject_key), name: String(row.subject || row.subject_key), questions: Number(row.total || 0),
      types: { objective: Number(row.objective || 0), written: Number(row.written || 0), openEnded: Number(row.open_ended || 0) },
      levels: row.min_rank !== null && row.max_rank !== null ? `${labelOfRank(Number(row.min_rank))}${Number(row.max_rank) !== Number(row.min_rank) ? ` – ${labelOfRank(Number(row.max_rank))}` : ''}` : '',
      mastery: total ? Math.round((Number(played?.correct || 0) / total) * 100) : null, quizzes: Number(played?.quizzes || 0), lastPlayed: played?.last_played || null,
    }
  })
}

/** What a question looks like to the player: everything needed to mark it on the device. */
export function toPlayable(row: Record<string, any>) {
  const type = bankType(row.type)
  const options = parse<string[]>(row.options_json, [])
  const answer = parse<any>(row.answer_json, row.answer_json || '')
  const metadata = parse<Record<string, any>>(row.metadata_json, {})
  const base = {
    id: String(row.id), type, prompt: String(row.prompt || ''), topic: String(row.topic || ''), imageUrl: String(row.image_url || ''),
    passage: String(metadata.passage || ''), explanation: String(row.explanation || ''), level: row.level_rank !== null && row.level_rank !== undefined ? labelOfRank(Number(row.level_rank)) : '',
    answerSource: String(row.answer_source || 'teacher'), fromNdovera: String(row.tenant_id) === GLOBAL_TENANT,
  }
  if (type === 'mcq' || type === 'truefalse') {
    const opts = Array.isArray(options) && options.length ? options : type === 'truefalse' ? ['True', 'False'] : []
    const correctIndex = correctIndexOf(answer, opts)
    return correctIndex < 0 ? null : { ...base, options: opts, correctIndex }
  }
  if (type === 'shortanswer' || type === 'fillgaps') {
    const accepted = (Array.isArray(answer) ? answer : String(answer || '').split(/\s*(?:\n|;|\|| or )\s*/i)).map((value: unknown) => String(value || '').trim()).filter(Boolean)
    return accepted.length ? { ...base, accepted } : null
  }
  if (type === 'crossmatching') {
    const pairs = (Array.isArray(answer) ? answer : []).map((pair: any) => ({ left: String(pair?.left || pair?.a || ''), right: String(pair?.right || pair?.b || '') })).filter((pair: any) => pair.left && pair.right)
    return pairs.length >= 2 ? { ...base, pairs } : null
  }
  const modelAnswer = String(Array.isArray(answer) ? answer.join('\n') : answer || '').trim() || base.explanation
  return modelAnswer ? { ...base, type: type === 'comprehension' ? 'comprehension' : 'essay', modelAnswer } : null
}

/**
 * A pack of questions for one subject: mostly ones the student has not mastered,
 * mixed across their levels, own level favoured. Answers are included.
 */
export async function buildPack(db: D1Database, student: PracticeStudent, subjectKey: string, size = PACK_SIZE, options: { keys?: string[], difficulty?: string, subjectName?: string } = {}) {
  await ensurePracticeTables(db)
  if (!subjectKey) throw new PracticeError('Choose a subject to practise.')
  const difficulty = normalizeDifficulty(options.difficulty)
  const keys = Array.from(new Set([subjectKey, ...(options.keys || [])]))
  const candidates = await sampleQuestions(db, student, keys, difficulty, 300)
  if (!candidates.length) {
    return { id: `pack_${subjectKey}_${Date.now()}`, subjectKey, subjectName: options.subjectName || subjectKey, difficulty, generatedAt: now(), level: student.rank !== null ? labelOfRank(student.rank) : '', questions: [] }
  }
  const stats = new Map<string, Record<string, any>>()
  const ids = candidates.map(row => String(row.id))
  for (let start = 0; start < ids.length; start += 90) {
    const slice = ids.slice(start, start + 90)
    const result = await db.prepare(`SELECT question_id, seen, correct, box FROM practice_question_stats WHERE student_id = ? AND question_id IN (${slice.map(() => '?').join(',')})`).bind(student.studentId, ...slice).all()
    for (const row of (result.results || []) as Record<string, any>[]) stats.set(String(row.question_id), row)
  }
  const scored = candidates.map(row => {
    const stat = stats.get(String(row.id))
    const box = Number(stat?.box || 0)
    const ownLevel = student.rank !== null && Number(row.level_rank) === student.rank ? 0.35 : 0
    return { row, stat, weight: Math.random() + ownLevel - box * 0.25 + (stat && Number(stat.correct) < Number(stat.seen) ? 0.4 : 0) }
  }).sort((a, b) => b.weight - a.weight)
  const questions = []
  for (const { row, stat } of scored) {
    const playable = toPlayable(row)
    if (!playable) continue
    questions.push({ ...playable, stat: stat ? { seen: Number(stat.seen), correct: Number(stat.correct), box: Number(stat.box) } : null })
    if (questions.length >= size) break
  }
  return {
    id: `pack_${subjectKey}_${Date.now()}`, subjectKey, subjectName: options.subjectName || String(candidates[0].subject || subjectKey), difficulty, generatedAt: now(),
    level: student.rank !== null ? labelOfRank(student.rank) : '', questions,
  }
}

// ─── Marking ─────────────────────────────────────────────────────────────────

function editDistance(a: string, b: string) {
  if (Math.abs(a.length - b.length) > 2) return 3
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index)
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = previous[0]
    previous[0] = i
    for (let j = 1; j <= b.length; j += 1) {
      const above = previous[j]
      previous[j] = Math.min(previous[j] + 1, previous[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1))
      diagonal = above
    }
  }
  return previous[b.length]
}

/** A written answer matches when it says the same thing: case, punctuation, small typos and number formats aside. */
export function textMatches(response: unknown, accepted: string[]) {
  const given = normalizeText(response)
  if (!given) return false
  return accepted.some(answer => {
    const expected = normalizeText(answer)
    if (!expected) return false
    if (given === expected) return true
    // Numbers compare as numbers ("0.50" is "0.5", "1,000" is "1000"), read before punctuation is removed.
    const asNumber = (value: unknown) => { const text = String(value ?? '').trim().replace(/[\s,]/g, ''); return /^[-+]?\d*\.?\d+$/.test(text) ? Number(text) : NaN }
    const a = asNumber(response)
    const b = asNumber(answer)
    if (Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < 1e-9) return true
    // One slip in a long word is a typo, not a wrong answer.
    return expected.length >= 6 && editDistance(given, expected) <= 1
  })
}

/** Mark one answer. Open answers are marked by the student against the model answer (self-check). */
export function markAnswer(question: Record<string, any>, response: unknown, selfRating?: string) {
  const type = question.type
  if (type === 'mcq' || type === 'truefalse') {
    // The device shuffles options, so it sends the chosen option's text; an exact text match comes first.
    const options: string[] = question.options || []
    const byText = typeof response === 'string' ? options.findIndex(option => normalizeText(option) === normalizeText(response)) : -1
    const chosen = typeof response === 'number' ? response : byText >= 0 ? byText : correctIndexOf(response, options)
    const correct = chosen === question.correctIndex
    return { credit: correct ? 1 : 0, correct }
  }
  if (type === 'shortanswer' || type === 'fillgaps') {
    const correct = textMatches(response, question.accepted || [])
    return { credit: correct ? 1 : 0, correct }
  }
  if (type === 'crossmatching') {
    const given = response && typeof response === 'object' ? response as Record<string, string> : {}
    const pairs = question.pairs || []
    const right = pairs.filter((pair: any) => normalizeText(given[pair.left]) === normalizeText(pair.right)).length
    const credit = pairs.length ? right / pairs.length : 0
    return { credit: Math.round(credit * 100) / 100, correct: right === pairs.length }
  }
  const credit = selfRating === 'got_it' ? 1 : selfRating === 'partly' ? 0.5 : 0
  return { credit, correct: credit === 1, selfMarked: true }
}

// ─── XP, levels, streaks, badges ─────────────────────────────────────────────

export const LEVEL_TITLES = ['Rookie', 'Explorer', 'Scholar', 'Achiever', 'Expert', 'Master', 'Grandmaster', 'Legend']

/** Level L needs 50·L·(L−1) XP: 0, 100, 300, 600, 1000, 1500 … */
export function levelForXp(xp: number) {
  const level = Math.max(1, Math.floor((50 + Math.sqrt(2500 + 200 * Math.max(0, xp))) / 100))
  const floor = 50 * level * (level - 1)
  const next = 50 * (level + 1) * level
  return { level, title: LEVEL_TITLES[Math.min(LEVEL_TITLES.length - 1, Math.floor((level - 1) / 3))], floor, next, progress: Math.round(((xp - floor) / (next - floor)) * 100) }
}

export const BADGES = [
  { key: 'first_quiz', label: 'First Steps', icon: '🎯', description: 'Finish your first practice quiz' },
  { key: 'perfect', label: 'Flawless', icon: '💎', description: 'Score 100% on a quiz of 5 or more questions' },
  { key: 'streak_3', label: 'On Fire', icon: '🔥', description: 'Practise 3 days in a row' },
  { key: 'streak_7', label: 'Week Warrior', icon: '⚡', description: 'Practise 7 days in a row' },
  { key: 'streak_30', label: 'Unstoppable', icon: '🏆', description: 'Practise 30 days in a row' },
  { key: 'century', label: 'Century', icon: '💯', description: 'Answer 100 questions correctly' },
  { key: 'thousand', label: 'Knowledge Bank', icon: '🏦', description: 'Answer 1,000 questions correctly' },
  { key: 'speedster', label: 'Speedster', icon: '⏱️', description: 'Score 80% or more in a timed blitz' },
  { key: 'explorer', label: 'All-Rounder', icon: '🧭', description: 'Practise 4 different subjects' },
  { key: 'essayist', label: 'Wordsmith', icon: '✍️', description: 'Complete an exam simulation with written answers' },
  { key: 'level_5', label: 'Rising Star', icon: '🌟', description: 'Reach level 5' },
  { key: 'level_10', label: 'Scholar Elite', icon: '🎓', description: 'Reach level 10' },
] as const

/** Lagos calendar date (schools work in West Africa Time). */
export function lagosDate(at: Date) {
  return new Date(at.getTime() + 60 * 60 * 1000).toISOString().slice(0, 10)
}

function weekKey(at: Date) {
  const day = new Date(`${lagosDate(at)}T00:00:00Z`)
  const monday = new Date(day.getTime() - ((day.getUTCDay() + 6) % 7) * 86400000)
  return monday.toISOString().slice(0, 10)
}

export function profileView(row: Record<string, any> | null, today = lagosDate(new Date())) {
  const xp = Number(row?.xp || 0)
  const lastActive = String(row?.last_active_date || '')
  const yesterday = new Date(Date.parse(`${today}T00:00:00Z`) - 86400000).toISOString().slice(0, 10)
  const streakAlive = lastActive === today || lastActive === yesterday
  const earned = new Set(parse<string[]>(row?.badges_json, []))
  return {
    xp, ...levelForXp(xp), streak: streakAlive ? Number(row?.streak || 0) : 0, bestStreak: Number(row?.best_streak || 0), practisedToday: lastActive === today,
    todayXp: String(row?.today_date || '') === today ? Number(row?.today_xp || 0) : 0, dailyGoal: Number(row?.daily_goal || 50),
    answered: Number(row?.answered || 0), correct: Number(row?.correct || 0), quizzes: Number(row?.quizzes || 0),
    accuracy: Number(row?.answered || 0) ? Math.round((Number(row?.correct || 0) / Number(row?.answered || 1)) * 100) : 0,
    badges: BADGES.map(badge => ({ ...badge, earned: earned.has(badge.key) })),
  }
}

export async function getProfile(db: D1Database, studentId: string) {
  await ensurePracticeTables(db)
  return profileView(await db.prepare(`SELECT * FROM practice_profiles WHERE student_id = ?`).bind(studentId).first() as Record<string, any> | null)
}

export type AttemptInput = {
  id: string, subjectKey: string, subjectName?: string, mode?: string, startedAt?: string, finishedAt?: string, durationSec?: number,
  answers: Array<{ questionId: string, response?: unknown, selfRating?: string, timeMs?: number }>,
}

export const MODES = ['quick', 'blitz', 'exam', 'mistakes', 'truefalse', 'custom'] as const

/**
 * Record a finished quiz (sent live, or later from the offline outbox). Marked
 * again here from the bank; the same attempt id is only ever counted once.
 */
export async function recordAttempt(db: D1Database, student: PracticeStudent, input: AttemptInput) {
  await ensurePracticeTables(db)
  const id = String(input.id || '').trim().slice(0, 80)
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(id)) throw new PracticeError('A quiz attempt needs an id.')
  const existing = await db.prepare(`SELECT * FROM practice_attempts WHERE id = ?`).bind(id).first() as Record<string, any> | null
  if (existing) {
    if (existing.student_id !== student.studentId) throw new PracticeError('Attempt not found.', 404)
    return { attempt: attemptView(existing), profile: await getProfile(db, student.studentId), newBadges: [], levelUp: null, duplicate: true }
  }
  const answers = (Array.isArray(input.answers) ? input.answers : []).slice(0, 120)
  if (!answers.length) throw new PracticeError('Answer at least one question.')
  const ids = Array.from(new Set(answers.map(answer => String(answer.questionId || '')).filter(Boolean)))
  const rows = new Map<string, Record<string, any>>()
  for (let start = 0; start < ids.length; start += 90) {
    const slice = ids.slice(start, start + 90)
    // Questions come from every school's bank; an id is only ever one question.
    const result = await db.prepare(`SELECT * FROM question_bank WHERE id IN (${slice.map(() => '?').join(',')})`).bind(...slice).all()
    for (const row of (result.results || []) as Record<string, any>[]) rows.set(String(row.id), row)
  }
  const mode = (MODES as readonly string[]).includes(String(input.mode)) ? String(input.mode) : 'quick'
  let combo = 0
  let bestCombo = 0
  let credit = 0
  let xp = 0
  let written = 0
  const details: Array<Record<string, any>> = []
  const statements: D1PreparedStatement[] = []
  const stamp = now()
  for (const answer of answers) {
    const row = rows.get(String(answer.questionId))
    const question = row ? toPlayable(row) : null
    if (!question) continue
    const marked = markAnswer(question, answer.response, answer.selfRating)
    credit += marked.credit
    if ((marked as any).selfMarked) written += 1
    if (marked.correct) { combo += 1; bestCombo = Math.max(bestCombo, combo) } else combo = 0
    // 10 XP a right answer (15 for a written one), half for half right; a run of right answers earns a little more.
    const base = (question.type === 'essay' || question.type === 'comprehension') ? 15 : 10
    xp += Math.round(base * marked.credit) + (marked.correct && combo >= 3 ? Math.min(10, (combo - 2) * 2) : 0)
    details.push({ questionId: question.id, credit: marked.credit, correct: marked.correct })
    statements.push(db.prepare(`INSERT INTO practice_question_stats (student_id, question_id, seen, correct, box, last_seen) VALUES (?, ?, 1, ?, ?, ?)
      ON CONFLICT(student_id, question_id) DO UPDATE SET seen = seen + 1, correct = correct + excluded.correct,
      box = CASE WHEN excluded.correct = 1 THEN MIN(box + 1, 5) ELSE 0 END, last_seen = excluded.last_seen`)
      .bind(student.studentId, question.id, marked.correct ? 1 : 0, marked.correct ? 1 : 0, stamp))
  }
  const total = details.length
  if (!total) throw new PracticeError('None of these questions are in the question bank any more.', 404)
  const percent = Math.round((credit / total) * 100)
  if (mode === 'blitz') xp = Math.round(xp * 1.25)
  if (total >= 5 && percent === 100) xp += 25

  const finished = new Date(Math.min(Date.now(), Date.parse(String(input.finishedAt || '')) || Date.now()))
  const today = lagosDate(finished)
  const previous = await db.prepare(`SELECT * FROM practice_profiles WHERE student_id = ?`).bind(student.studentId).first() as Record<string, any> | null
  const before = profileView(previous, lagosDate(new Date()))
  const firstToday = String(previous?.last_active_date || '') !== today
  if (firstToday) xp += 10
  const yesterday = new Date(Date.parse(`${today}T00:00:00Z`) - 86400000).toISOString().slice(0, 10)
  const lastActive = String(previous?.last_active_date || '')
  // An offline quiz synced late still counts for the day it was played, never moving the streak backwards.
  const streak = lastActive === today || lastActive > today ? Number(previous?.streak || 1) : lastActive === yesterday ? Number(previous?.streak || 0) + 1 : 1
  const totalXp = Number(previous?.xp || 0) + xp
  const subjects = Array.from(new Set([...parse<string[]>(previous?.subjects_json, []), input.subjectKey].filter(Boolean)))
  const correctCount = details.filter(detail => detail.correct).length
  const answered = Number(previous?.answered || 0) + total
  const correctTotal = Number(previous?.correct || 0) + correctCount
  const badges = new Set(parse<string[]>(previous?.badges_json, []))
  const earnedBefore = new Set(badges)
  badges.add('first_quiz')
  if (total >= 5 && percent === 100) badges.add('perfect')
  if (streak >= 3) badges.add('streak_3')
  if (streak >= 7) badges.add('streak_7')
  if (streak >= 30) badges.add('streak_30')
  if (correctTotal >= 100) badges.add('century')
  if (correctTotal >= 1000) badges.add('thousand')
  if (mode === 'blitz' && percent >= 80 && total >= 5) badges.add('speedster')
  if (subjects.length >= 4) badges.add('explorer')
  if (mode === 'exam' && written > 0) badges.add('essayist')
  const level = levelForXp(totalXp).level
  if (level >= 5) badges.add('level_5')
  if (level >= 10) badges.add('level_10')

  const todayXp = (String(previous?.today_date || '') === today ? Number(previous?.today_xp || 0) : 0) + xp
  statements.push(db.prepare(`INSERT INTO practice_attempts (id, tenant_id, student_id, student_name, class_id, subject_key, subject_name, mode, total, correct, percent, xp,
    duration_sec, details_json, started_at, finished_at, week_key, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
    id, student.tenantId, student.studentId, student.studentName, student.classId, input.subjectKey, String(input.subjectName || input.subjectKey).slice(0, 120), mode,
    total, credit, percent, xp, Math.max(0, Math.min(86400, Math.round(Number(input.durationSec || 0)))), JSON.stringify({ details, bestCombo }),
    input.startedAt || null, finished.toISOString(), weekKey(finished), stamp))
  statements.push(db.prepare(`INSERT INTO practice_profiles (student_id, tenant_id, student_name, class_id, xp, streak, best_streak, last_active_date, today_date, today_xp,
    answered, correct, quizzes, perfect, badges_json, subjects_json, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(student_id) DO UPDATE SET tenant_id = excluded.tenant_id, student_name = excluded.student_name, class_id = excluded.class_id, xp = excluded.xp,
    streak = excluded.streak, best_streak = excluded.best_streak, last_active_date = excluded.last_active_date, today_date = excluded.today_date,
    today_xp = excluded.today_xp, answered = excluded.answered, correct = excluded.correct, quizzes = excluded.quizzes, perfect = excluded.perfect,
    badges_json = excluded.badges_json, subjects_json = excluded.subjects_json, updated_at = excluded.updated_at`).bind(
    student.studentId, student.tenantId, student.studentName, student.classId, totalXp, streak, Math.max(streak, Number(previous?.best_streak || 0)),
    lastActive > today ? lastActive : today, lastActive > today ? String(previous?.today_date || today) : today, lastActive > today ? Number(previous?.today_xp || 0) : todayXp,
    answered, correctTotal, Number(previous?.quizzes || 0) + 1, Number(previous?.perfect || 0) + (total >= 5 && percent === 100 ? 1 : 0),
    JSON.stringify(Array.from(badges)), JSON.stringify(subjects), stamp))
  await db.batch(statements)
  const profile = await getProfile(db, student.studentId)
  return {
    attempt: { id, total, correct: credit, percent, xp, bestCombo, mode, subjectKey: input.subjectKey, details },
    profile,
    newBadges: BADGES.filter(badge => badges.has(badge.key) && !earnedBefore.has(badge.key)),
    levelUp: profile.level > before.level ? { from: before.level, to: profile.level, title: profile.title } : null,
  }
}

function attemptView(row: Record<string, any>) {
  const details = parse<Record<string, any>>(row.details_json, {})
  return {
    id: row.id, total: Number(row.total), correct: Number(row.correct), percent: Number(row.percent), xp: Number(row.xp), bestCombo: Number(details.bestCombo || 0),
    mode: row.mode, subjectKey: row.subject_key, subjectName: row.subject_name, durationSec: Number(row.duration_sec || 0), finishedAt: row.finished_at, details: details.details || [],
  }
}

export async function recentAttempts(db: D1Database, studentId: string, limit = 10) {
  await ensurePracticeTables(db)
  const rows = await db.prepare(`SELECT * FROM practice_attempts WHERE student_id = ? ORDER BY created_at DESC LIMIT ?`).bind(studentId, limit).all()
  return ((rows.results || []) as Record<string, any>[]).map(attemptView)
}

/** This week's XP in the student's class or school — for one subject, or all of them. */
export async function leaderboard(db: D1Database, student: PracticeStudent, scope: 'class' | 'school' = 'class', subjectKeys: string[] = []) {
  await ensurePracticeTables(db)
  const week = weekKey(new Date())
  const subject = subjectKeys.length ? ` AND subject_key IN (${subjectKeys.map(() => '?').join(',')})` : ''
  const rows = scope === 'class' && student.classId
    ? await db.prepare(`SELECT student_id, MAX(student_name) AS name, SUM(xp) AS xp, COUNT(*) AS quizzes FROM practice_attempts WHERE tenant_id = ? AND class_id = ? AND week_key = ?${subject} GROUP BY student_id ORDER BY xp DESC LIMIT 20`).bind(student.tenantId, student.classId, week, ...subjectKeys).all()
    : await db.prepare(`SELECT student_id, MAX(student_name) AS name, SUM(xp) AS xp, COUNT(*) AS quizzes FROM practice_attempts WHERE tenant_id = ? AND week_key = ?${subject} GROUP BY student_id ORDER BY xp DESC LIMIT 20`).bind(student.tenantId, week, ...subjectKeys).all()
  return {
    week, scope, subjectKey: subjectKeys[0] || '',
    entries: ((rows.results || []) as Record<string, any>[]).map((row, index) => ({
      rank: index + 1, name: String(row.name || 'Student'), xp: Number(row.xp || 0), quizzes: Number(row.quizzes || 0), you: row.student_id === student.studentId,
    })),
  }
}
