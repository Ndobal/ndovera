// Keeping each practice question in its own subject.
//
// A question enters the bank under the subject its source was filed under (an assignment,
// a material, an exam paper). A paper filed under the wrong subject used to put, say, ICT
// questions into Agricultural Science practice. Now:
//
//   - Ndovera AI checks every question against the subject it is filed under, in small
//     batches: a question of another known subject moves there; one that fits no known
//     subject is held back (subject_check = 'wrong'). Practice never serves held questions.
//   - Students can report "not this subject": two students (or one member of staff) hold
//     the question at once ('reported') until the check looks at it again.
//   - Subject names are joined only when the names themselves agree (see namesCanMatch),
//     so a wrong guess by the model can never merge two different subjects.

import { BUILT_IN_SUBJECT_KEYS } from './levels'

export type AiRunner = (messages: Array<{ role: string, content: string }>, options: { maxTokens: number, temperature: number }) => Promise<string>

/** Questions practice must not serve: held as the wrong subject, or reported and waiting for the check. */
export const HELD_SUBJECT_CHECKS = ['wrong', 'reported']
export const SUBJECT_SERVABLE_SQL = (alias = 'q') => `COALESCE(${alias}.subject_check, '') NOT IN ('wrong', 'reported')`
export const SUBJECT_CHECK_BATCH = 25
// Batches a night: the Worker's AI budget is shared with the night builder (free plan).
export const SUBJECT_CHECKS_PER_NIGHT = 12
export const REPORTS_TO_HOLD = 2

const now = () => new Date().toISOString()
const readyDbs = new WeakSet<object>()

export async function ensureSubjectCheckTables(db: D1Database) {
  if (readyDbs.has(db as object)) return
  for (const column of ['subject_check TEXT', 'subject_checked_at TEXT', 'subject_from TEXT']) {
    await db.prepare(`ALTER TABLE question_bank ADD COLUMN ${column}`).run().catch(() => null)
  }
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_question_bank_subject_check ON question_bank (subject_check, playable)`).run().catch(() => null)
  await db.prepare(`CREATE TABLE IF NOT EXISTS question_subject_reports (
    question_id TEXT NOT NULL, reporter_id TEXT NOT NULL, reporter_role TEXT, tenant_id TEXT, subject_key TEXT, created_at TEXT NOT NULL,
    PRIMARY KEY (question_id, reporter_id))`).run()
  await db.prepare(`CREATE TABLE IF NOT EXISTS subject_check_nights (day TEXT PRIMARY KEY, batches INTEGER NOT NULL DEFAULT 0)`).run()
  readyDbs.add(db as object)
}

// ─── Which subject names may be joined ───────────────────────────────────────

// Words every other subject shares; a match on these alone means nothing.
const GENERIC = new Set(['and', 'of', 'the', 'in', 'studies', 'study', 'education', 'science', 'sciences', 'technology', 'general', 'basic', 'language', 'arts', 'art', 'core', 'elective', 'introduction', 'to', 'for', 'applied'])
const NEVER = [['mathematics', 'further-mathematics']]
// Words that begin alike but name different subjects (Physics is not Physical Education).
const NEVER_WORDS = [['physic', 'physical']]
// Words that make a different subject: Further Mathematics is not Mathematics, Home Economics is not Economics.
const QUALIFIERS = ['further', 'home', 'additional', 'advanced']

const tokensOf = (key: string) => String(key || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)

/**
 * Whether two subject keys may be the same subject, judged on the names alone: they share a
 * real word (by its first five letters), or one is the initials of the other ("crs" and
 * "christian-religious-studies"). Two of Ndovera's own subjects are never joined, and
 * Further Mathematics is never Mathematics.
 */
export function namesCanMatch(a: string, b: string) {
  if (!a || !b) return false
  if (a === b) return true
  if (NEVER.some(pair => pair.includes(a) && pair.includes(b))) return false
  if (BUILT_IN_SUBJECT_KEYS.includes(a) && BUILT_IN_SUBJECT_KEYS.includes(b)) return false
  const left = tokensOf(a)
  const right = tokensOf(b)
  if (QUALIFIERS.some(word => left.includes(word) !== right.includes(word))) return false
  // Real words, plural "s" dropped: "maths" → "math", which begins "mathematics"; "agric" begins "agricultural".
  const words = (tokens: string[]) => tokens.filter(token => !GENERIC.has(token) && token.length >= 3).map(token => (token.length > 4 && token.endsWith('s') ? token.slice(0, -1) : token))
  const sameWord = (x: string, y: string) => {
    if (NEVER_WORDS.some(pair => pair.includes(x) && pair.includes(y) && x !== y)) return false
    const [short, long] = x.length <= y.length ? [x, y] : [y, x]
    return short === long || (short.length >= 4 && long.startsWith(short))
  }
  if (words(left).some(x => words(right).some(y => sameWord(x, y)))) return true
  const initials = (tokens: string[]) => tokens.filter(token => !['and', 'of', 'the', 'in'].includes(token)).map(token => token[0]).join('')
  return (left.length === 1 && left[0].length >= 2 && left[0] === initials(right)) || (right.length === 1 && right[0].length >= 2 && right[0] === initials(left))
}

// ─── The check ───────────────────────────────────────────────────────────────

const SYSTEM = [
  'You check that school practice questions are filed under the right subject (Nigerian curriculum).',
  'For each question, say whether a teacher of the subject it is filed under would set it in that subject.',
  'Questions that fit two subjects (e.g. a farm-record calculation in Agricultural Science) belong where they are filed: answer "yes".',
  'If it clearly belongs to another subject, answer "no" and give that subject\'s key from the list of known subjects, or "none" if no key fits.',
  'If you cannot tell, answer "unsure". Reply with JSON only: an array of {"id", "belongs": "yes"|"no"|"unsure", "subject"?: "<key>"|"none"}.',
].join('\n')

const parse = <T,>(value: unknown, fallback: T): T => { try { return value ? JSON.parse(String(value)) as T : fallback } catch { return fallback } }

/** The model's verdicts, keeping only well-formed ones for questions it was given. */
export function parseSubjectVerdicts(reply: string, ids: string[]) {
  const text = String(reply || '').replace(/```(?:json)?/g, '')
  let list: any[] = []
  try { list = JSON.parse(text.slice(text.indexOf('['), text.lastIndexOf(']') + 1)) } catch { list = [] }
  const wanted = new Set(ids)
  const out = new Map<string, { belongs: 'yes' | 'no' | 'unsure', subject: string }>()
  for (const item of Array.isArray(list) ? list : []) {
    const id = String(item?.id || '')
    const belongs = String(item?.belongs || '').toLowerCase()
    if (!wanted.has(id) || !['yes', 'no', 'unsure'].includes(belongs)) continue
    out.set(id, { belongs: belongs as 'yes' | 'no' | 'unsure', subject: String(item?.subject || '').trim().toLowerCase() })
  }
  return out
}

/**
 * Check one batch: reported questions first, then unchecked ones. Reads are
 * bounded by the subject_check index and the batch size. Returns what happened.
 */
export async function checkQuestionSubjects(db: D1Database, runAi: AiRunner, options: { limit?: number, reportedOnly?: boolean, canonicalOf?: (key: string) => string } = {}) {
  await ensureSubjectCheckTables(db)
  const limit = options.limit || SUBJECT_CHECK_BATCH
  const canonicalOf = options.canonicalOf || ((key: string) => key)
  let rows = ((await db.prepare(`SELECT id, subject, subject_key, type, prompt, options_json, class_level FROM question_bank WHERE subject_check = 'reported' LIMIT ?`).bind(limit).all()).results || []) as Record<string, any>[]
  if (!options.reportedOnly && rows.length < limit) {
    const more = ((await db.prepare(`SELECT id, subject, subject_key, type, prompt, options_json, class_level FROM question_bank WHERE subject_check IS NULL AND playable = 1 AND subject_key IS NOT NULL AND subject_key != '' AND subject_key != '-' LIMIT ?`).bind(limit - rows.length).all()).results || []) as Record<string, any>[]
    rows = [...rows, ...more]
  }
  if (!rows.length) return { checked: 0, ok: 0, moved: 0, held: 0 }
  const known = ((await db.prepare(`SELECT DISTINCT subject_key FROM practice_bank_counts`).all().catch(() => ({ results: [] }))).results || []) as Record<string, any>[]
  const knownKeys = Array.from(new Set([...known.map(row => canonicalOf(String(row.subject_key))), ...rows.map(row => canonicalOf(String(row.subject_key)))].filter(key => key && key !== '-'))).sort()
  const items = rows.map(row => {
    const options = parse<string[]>(row.options_json, [])
    return `ID: ${row.id}\nFiled under: ${row.subject_key}${row.subject ? ` (${row.subject})` : ''}${row.class_level ? ` · ${row.class_level}` : ''}\nQuestion: ${String(row.prompt).slice(0, 900)}${options.length ? `\nOptions: ${options.slice(0, 6).join(' | ')}` : ''}`
  }).join('\n\n---\n\n')
  const reply = await runAi([
    { role: 'system', content: SYSTEM },
    { role: 'user', content: `Known subjects (keys): ${JSON.stringify(knownKeys)}\n\n${items}` },
  ], { maxTokens: 120 + 40 * rows.length, temperature: 0 })
  const verdicts = parseSubjectVerdicts(reply, rows.map(row => String(row.id)))
  const stamp = now()
  const statements: D1PreparedStatement[] = []
  let ok = 0
  let moved = 0
  let held = 0
  for (const row of rows) {
    const verdict = verdicts.get(String(row.id))
    const filed = canonicalOf(String(row.subject_key))
    // No answer for this one: a reported question waits for the next check; an unchecked one is tried again later.
    if (!verdict) continue
    if (verdict.belongs !== 'no') {
      ok += 1
      statements.push(db.prepare(`UPDATE question_bank SET subject_check = 'ok', subject_checked_at = ? WHERE id = ?`).bind(stamp, row.id))
      statements.push(db.prepare(`DELETE FROM question_subject_reports WHERE question_id = ?`).bind(row.id))
      continue
    }
    const target = canonicalOf(verdict.subject)
    if (target && target !== filed && knownKeys.includes(target)) {
      moved += 1
      statements.push(db.prepare(`UPDATE question_bank SET subject_key = ?, subject = ?, subject_from = COALESCE(subject_from, ?), subject_check = 'moved', subject_checked_at = ?, updated_at = ? WHERE id = ?`)
        .bind(target, target.replace(/-/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase()), String(row.subject_key), stamp, stamp, row.id))
      statements.push(db.prepare(`DELETE FROM question_subject_reports WHERE question_id = ?`).bind(row.id))
      continue
    }
    held += 1
    statements.push(db.prepare(`UPDATE question_bank SET subject_check = 'wrong', subject_checked_at = ? WHERE id = ?`).bind(stamp, row.id))
  }
  if (statements.length) await db.batch(statements)
  return { checked: verdicts.size, ok, moved, held }
}

/** Take one batch from tonight's allowance; false when it is used up. */
export async function takeNightBatch(db: D1Database, day: string, max = SUBJECT_CHECKS_PER_NIGHT) {
  await ensureSubjectCheckTables(db)
  const result = await db.prepare(`INSERT INTO subject_check_nights (day, batches) VALUES (?, 1) ON CONFLICT(day) DO UPDATE SET batches = batches + 1 WHERE batches < ?`).bind(day, max).run()
  return Number(result?.meta?.changes || 0) > 0
}

/**
 * A student or teacher says a question is not of the subject they were practising. Two
 * different students, or one member of staff, hold it until the check has looked again.
 */
export async function reportQuestionSubject(db: D1Database, input: { questionId: string, reporterId: string, role: string, tenantId: string }) {
  await ensureSubjectCheckTables(db)
  const question = await db.prepare(`SELECT id, subject_key, subject_check FROM question_bank WHERE id = ?`).bind(input.questionId).first() as Record<string, any> | null
  if (!question) return { found: false, held: false }
  await db.prepare(`INSERT OR IGNORE INTO question_subject_reports (question_id, reporter_id, reporter_role, tenant_id, subject_key, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .bind(input.questionId, input.reporterId, input.role, input.tenantId, question.subject_key, now()).run()
  const counts = await db.prepare(`SELECT COUNT(*) AS n, SUM(CASE WHEN reporter_role != 'student' THEN 1 ELSE 0 END) AS staff FROM question_subject_reports WHERE question_id = ?`).bind(input.questionId).first() as Record<string, any> | null
  const hold = Number(counts?.staff || 0) > 0 || Number(counts?.n || 0) >= REPORTS_TO_HOLD
  if (hold && question.subject_check !== 'wrong') {
    await db.prepare(`UPDATE question_bank SET subject_check = 'reported', subject_checked_at = ? WHERE id = ?`).bind(now(), input.questionId).run()
  }
  return { found: true, held: hold, reports: Number(counts?.n || 0) }
}
