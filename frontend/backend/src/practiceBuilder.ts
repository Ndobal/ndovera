// The night builder: Ndovera's question bank grows by itself, between midnight and
// 4am (Lagos), from everything taught and uploaded across Ndovera.
//
// Sources, picked up as they appear (each source is planned once, then worked on):
//   - examination syllabus topics Ami publishes (exam_specs: WAEC, NECO, JAMB, BECE,
//     Common Entrance) → questions of that examination's standard, EXAM_TOPIC_TARGET each;
//   - published curriculum topics (Ndovera's and schools') → Simple and Intermediate
//     questions for that class level, CURRICULUM_TARGET each;
//   - every material a teacher shares (its Ndovera note) → questions grounded in it, NOTE_TARGET each.
// Each night continues where the last one stopped: the queue keeps how many each source
// still needs, and the least-served sources go first (examinations first of all).
//
// Quality: every objective question in the bank — teachers' and Ndovera AI's — is checked
// against its standard by a chief-examiner pass. A good question is marked ok; a weak one
// is upgraded in place (clearer wording, a correct key, proper options); one that cannot
// be saved is withdrawn. Paid examination practice uses only checked questions.
//
// Cost: each step is one model call. The night's steps are capped (batchesPerNight, set by
// Ami) so the free plan's daily AI allowance is never exhausted; on the paid plan Ami can
// raise it. The queue and every night's work are visible to Ami.

import { ensureCurriculumTables } from './curriculumLibrary'
import { levelOf, subjectKeyOf } from './levels'
import { bankType, ensurePracticeTables, normalizeText } from './practiceArena'
import { writeQuestions } from './practiceBank'
import type { AiRunner } from './practiceBank'
import { EXAMS, addExamStock, normalizeExam } from './practicePasses'
import type { ExamKey } from './practicePasses'

export const EXAM_TOPIC_TARGET = 40
export const CURRICULUM_TARGET = 16
export const NOTE_TARGET = 8
export const DEFAULT_BUILD_SETTINGS = { batchesPerNight: 12, reviewEvery: 3 }
const PAGE = 100
const REVIEW_BATCH = 10

const now = () => new Date().toISOString()
const parse = <T,>(value: unknown, fallback: T): T => { try { return value ? JSON.parse(String(value)) as T : fallback } catch { return fallback } }
const lagos = (at: Date) => new Date(at.getTime() + 3600_000)

/** 00:00–03:59 in Lagos. */
export function inBuildWindow(at = new Date()) {
  return lagos(at).getUTCHours() < 4
}

const readyDbs = new WeakSet<object>()
export async function ensureBuilderTables(db: D1Database) {
  if (readyDbs.has(db as object)) return
  await ensurePracticeTables(db)
  await ensureCurriculumTables(db)
  for (const statement of [
    `CREATE TABLE IF NOT EXISTS practice_build_queue (
      id TEXT PRIMARY KEY, source_type TEXT NOT NULL, source_id TEXT NOT NULL, subject_key TEXT NOT NULL, subject_name TEXT, section TEXT NOT NULL,
      level_rank INTEGER NOT NULL, difficulty TEXT NOT NULL, exam TEXT, topic TEXT NOT NULL, context_ref TEXT, target INTEGER NOT NULL, made INTEGER NOT NULL DEFAULT 0,
      attempts INTEGER NOT NULL DEFAULT 0, priority INTEGER NOT NULL DEFAULT 5, status TEXT NOT NULL DEFAULT 'pending', created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
    `CREATE INDEX IF NOT EXISTS idx_practice_build_next ON practice_build_queue(status, priority, made)`,
    `CREATE TABLE IF NOT EXISTS practice_build_state (key TEXT PRIMARY KEY, value TEXT, updated_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS practice_build_nights (day TEXT PRIMARY KEY, steps INTEGER NOT NULL DEFAULT 0, added INTEGER NOT NULL DEFAULT 0, reviewed INTEGER NOT NULL DEFAULT 0,
      upgraded INTEGER NOT NULL DEFAULT 0, rejected INTEGER NOT NULL DEFAULT 0, failures INTEGER NOT NULL DEFAULT 0, updated_at TEXT)`,
  ]) await db.prepare(statement).run()
  readyDbs.add(db as object)
}

async function getState(db: D1Database, key: string) {
  const row = await db.prepare(`SELECT value FROM practice_build_state WHERE key = ?`).bind(key).first() as Record<string, any> | null
  return row ? String(row.value ?? '') : ''
}
async function setState(db: D1Database, key: string, value: string) {
  await db.prepare(`INSERT INTO practice_build_state (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`).bind(key, value, now()).run()
}

export async function getBuildSettings(db: D1Database) {
  await ensureBuilderTables(db)
  const saved = parse<Record<string, any>>(await getState(db, 'settings'), {})
  return {
    batchesPerNight: Math.max(0, Math.min(5000, Number(saved.batchesPerNight ?? DEFAULT_BUILD_SETTINGS.batchesPerNight) || 0)),
    reviewEvery: Math.max(2, Math.min(10, Number(saved.reviewEvery ?? DEFAULT_BUILD_SETTINGS.reviewEvery) || DEFAULT_BUILD_SETTINGS.reviewEvery)),
  }
}

export async function saveBuildSettings(db: D1Database, input: Record<string, any>) {
  const current = await getBuildSettings(db)
  const next = {
    batchesPerNight: Math.max(0, Math.min(5000, Math.floor(Number(input.batchesPerNight ?? current.batchesPerNight)) || 0)),
    reviewEvery: Math.max(2, Math.min(10, Math.floor(Number(input.reviewEvery ?? current.reviewEvery)) || current.reviewEvery)),
  }
  await setState(db, 'settings', JSON.stringify(next))
  return next
}

/** Examination names as syllabus documents write them. */
export function examKeyOf(value: unknown): ExamKey | '' {
  const text = String(value || '').toLowerCase()
  if (/jamb|utme/.test(text)) return 'jamb'
  if (/neco/.test(text)) return 'neco'
  if (/waec|wassce|ssce/.test(text)) return 'waec'
  if (/bece|junior\s*waec|basic\s*education/.test(text)) return 'bece'
  if (/common\s*entrance|ncee/.test(text)) return 'common_entrance'
  return normalizeExam(text)
}

/** The rank external questions sit at: the top of their section (packs for an examination ignore level). */
const EXAM_RANK: Record<string, number> = { primary: 6, junior: 9, senior: 12 }

// ─── Planning: new sources into the queue ────────────────────────────────────

type QueueRow = { id: string, sourceType: string, sourceId: string, subjectKey: string, subjectName: string, section: string, rank: number, difficulty: string, exam?: string, topic: string, contextRef?: string, target: number, priority: number }

async function enqueue(db: D1Database, rows: QueueRow[]) {
  if (!rows.length) return 0
  const stamp = now()
  const results = await db.batch(rows.map(row => db.prepare(`INSERT OR IGNORE INTO practice_build_queue (id, source_type, source_id, subject_key, subject_name, section, level_rank, difficulty, exam, topic, context_ref, target, priority, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(row.id, row.sourceType, row.sourceId, row.subjectKey, row.subjectName, row.section, row.rank, row.difficulty, row.exam || null, row.topic.slice(0, 300), row.contextRef || null, row.target, row.priority, stamp, stamp)))
  return results.reduce((sum, result) => sum + Number((result as any)?.meta?.changes || 0), 0)
}

/** One page of each source after its cursor. Returns whether every source is caught up. */
export async function planSources(db: D1Database) {
  await ensureBuilderTables(db)
  let caughtUp = true
  const page = async (key: string, sql: string, map: (row: Record<string, any>) => QueueRow[]) => {
    const [at, id] = (await getState(db, `cursor:${key}`)).split('|')
    const rows = ((await db.prepare(sql).bind(at || '', at || '', id || '', PAGE).all().catch(() => ({ results: [] }))).results || []) as Record<string, any>[]
    if (!rows.length) return 0
    const queued = await enqueue(db, rows.flatMap(map))
    const last = rows[rows.length - 1]
    await setState(db, `cursor:${key}`, `${last.updated_at || ''}|${last.id}`)
    if (rows.length === PAGE) caughtUp = false
    return queued
  }
  let queued = 0
  // Examination syllabus topics (published by Ami).
  queued += await page('exam', `SELECT t.id, t.topic, t.objectives, t.updated_at, s.exam_key, s.subject_key, s.subject FROM exam_spec_topics t JOIN exam_specs s ON s.id = t.spec_id
      WHERE s.status = 'published' AND (t.updated_at > ? OR (t.updated_at = ? AND t.id > ?)) ORDER BY t.updated_at, t.id LIMIT ?`, row => {
    const exam = examKeyOf(row.exam_key)
    const subjectKey = subjectKeyOf(row.subject || row.subject_key)
    if (!exam || !subjectKey || !row.topic) return []
    const section = EXAMS[exam].section
    return [{ id: `exam:${row.id}`, sourceType: 'exam_topic', sourceId: String(row.id), subjectKey, subjectName: String(row.subject || row.subject_key), section, rank: EXAM_RANK[section], difficulty: 'external', exam, topic: String(row.topic), contextRef: `exam_topic:${row.id}`, target: EXAM_TOPIC_TARGET, priority: 1 }]
  })
  // Published curriculum topics.
  queued += await page('curriculum', `SELECT ct.id, ct.topic, ct.subject, ct.subject_key, ct.class_label, ct.updated_at FROM curriculum_topics ct JOIN curricula c ON c.id = ct.curriculum_id
      WHERE c.status = 'published' AND (ct.updated_at > ? OR (ct.updated_at = ? AND ct.id > ?)) ORDER BY ct.updated_at, ct.id LIMIT ?`, row => {
    const level = levelOf(row.class_label)
    const subjectKey = subjectKeyOf(row.subject || row.subject_key)
    if (!level || !subjectKey || !row.topic) return []
    return (['simple', 'intermediate'] as const).map(difficulty => ({ id: `curriculum:${row.id}:${difficulty}`, sourceType: 'curriculum_topic', sourceId: String(row.id), subjectKey, subjectName: String(row.subject || row.subject_key), section: level.section, rank: level.rank, difficulty, topic: String(row.topic), contextRef: `curriculum_topic:${row.id}`, target: CURRICULUM_TARGET, priority: 3 }))
  })
  // Every material shared in any school (its Ndovera note).
  queued += await page('notes', `SELECT n.id, n.material_id, n.subject_name, n.topic, n.title, n.updated_at, c.name AS class_name FROM ndovera_notes n LEFT JOIN classes c ON c.id = n.class_id
      WHERE (n.updated_at > ? OR (n.updated_at = ? AND n.id > ?)) ORDER BY n.updated_at, n.id LIMIT ?`, row => {
    const level = levelOf(row.class_name)
    const subjectKey = subjectKeyOf(row.subject_name)
    if (!level || !subjectKey) return []
    return [{ id: `note:${row.material_id}`, sourceType: 'material', sourceId: String(row.material_id), subjectKey, subjectName: String(row.subject_name), section: level.section, rank: level.rank, difficulty: 'intermediate', topic: String(row.topic || row.title || row.subject_name), contextRef: `note:${row.id}`, target: NOTE_TARGET, priority: 4 }]
  })
  return { queued, caughtUp }
}

async function contextFor(db: D1Database, ref: string) {
  const [kind, id] = String(ref || '').split(/:(.+)/)
  if (kind === 'note') {
    const row = await db.prepare(`SELECT markdown FROM ndovera_notes WHERE id = ?`).bind(id).first() as Record<string, any> | null
    return String(row?.markdown || '')
  }
  if (kind === 'exam_topic') {
    const row = await db.prepare(`SELECT area, topic, objectives, skills, question_types, keywords FROM exam_spec_topics WHERE id = ?`).bind(id).first() as Record<string, any> | null
    return row ? [row.area && `Area: ${row.area}`, row.objectives && `Syllabus objectives: ${row.objectives}`, row.skills && `Skills tested: ${row.skills}`, row.question_types && `Question types: ${row.question_types}`, row.keywords && `Keywords: ${row.keywords}`].filter(Boolean).join('\n') : ''
  }
  if (kind === 'curriculum_topic') {
    const row = await db.prepare(`SELECT theme, subtopics, objectives, keywords FROM curriculum_topics WHERE id = ?`).bind(id).first() as Record<string, any> | null
    return row ? [row.theme && `Theme: ${row.theme}`, row.subtopics && `Subtopics: ${row.subtopics}`, row.objectives && `Learning objectives: ${row.objectives}`, row.keywords && `Keywords: ${row.keywords}`].filter(Boolean).join('\n') : ''
  }
  return ''
}

// ─── Building: one batch for the least-served source ─────────────────────────

export async function buildOne(db: D1Database, runAi: AiRunner) {
  await ensureBuilderTables(db)
  const item = await db.prepare(`SELECT * FROM practice_build_queue WHERE status = 'pending' ORDER BY priority, made, updated_at LIMIT 1`).first() as Record<string, any> | null
  if (!item) return null
  const remaining = Number(item.target) - Number(item.made)
  let added = 0
  let failed = false
  try {
    const result = await writeQuestions(db, {
      subject: { key: String(item.subject_key), name: String(item.subject_name || item.subject_key) }, section: String(item.section), rank: Number(item.level_rank),
      difficulty: item.difficulty, exam: item.exam || '', topic: String(item.topic), context: await contextFor(db, String(item.context_ref || '')),
      runAi, originType: `ndovera_builder:${item.source_type}`, originId: String(item.id), batch: Math.min(8, Math.max(1, remaining)),
    })
    added = result.added
  } catch (error) {
    failed = true
    console.error('Practice builder step failed', error)
  }
  const made = Number(item.made) + added
  const attempts = Number(item.attempts) + 1
  // Done when it has enough; given up when the model keeps producing nothing usable.
  const status = made >= Number(item.target) ? 'done' : attempts >= Math.ceil(Number(item.target) / 4) + 6 && made < attempts ? 'stuck' : 'pending'
  await db.prepare(`UPDATE practice_build_queue SET made = ?, attempts = ?, status = ?, updated_at = ? WHERE id = ?`).bind(made, attempts, status, now(), item.id).run()
  return { id: String(item.id), added, failed, status }
}

// ─── Checking: the chief examiner's pass ─────────────────────────────────────

const REVIEW_SYSTEM = [
  'You are a chief examiner checking practice questions before students use them. For each question decide:',
  '- "ok": correct, clear, exactly one right answer, plausible wrong options, and of the stated standard;',
  '- "fix": worth keeping but weak — give the improved question: clearer wording, a correct key, proper options (the stated number), and a short explanation;',
  '- "reject": wrong beyond repair, ambiguous, offensive, or not a real question.',
  'Write mathematics in LaTeX inside \\( \\). Keep a Nigerian context and money in Naira. Reply with JSON only: an array of',
  '{"id", "verdict": "ok"|"fix"|"reject", "prompt"?, "options"?, "answerIndex"?, "explanation"?, "reason"}.',
].join('\n')

function standardOf(row: Record<string, any>) {
  const exam = normalizeExam(row.exam)
  if (exam) return `${EXAMS[exam].style} (${EXAMS[exam].mcqOptions} options)`
  return `${row.class_level || 'school'} ${row.difficulty === 'simple' ? 'simple' : 'intermediate'} level school practice (${bankType(row.type) === 'truefalse' ? 'True / False' : 'up to 5 options'})`
}

async function hashOf(type: string, prompt: string, options: string[]) {
  const signature = [type, normalizeText(prompt), options.map(normalizeText).join('|')].join('::')
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(signature))
  return Array.from(new Uint8Array(digest)).map(value => value.toString(16).padStart(2, '0')).join('')
}

export async function reviewSome(db: D1Database, runAi: AiRunner, limit = REVIEW_BATCH) {
  await ensureBuilderTables(db)
  // Examination questions first (they are sold), then everything objective.
  let rows = ((await db.prepare(`SELECT * FROM question_bank WHERE quality IS NULL AND exam IS NOT NULL AND exam != '' AND playable = 1 LIMIT ?`).bind(limit).all()).results || []) as Record<string, any>[]
  if (rows.length < limit) {
    const more = ((await db.prepare(`SELECT * FROM question_bank WHERE quality IS NULL AND playable = 1 AND type IN ('mcq', 'truefalse') AND (exam IS NULL OR exam = '') LIMIT ?`).bind(limit - rows.length).all()).results || []) as Record<string, any>[]
    rows = [...rows, ...more]
  }
  if (!rows.length) return { reviewed: 0, upgraded: 0, rejected: 0 }
  const items = rows.map(row => {
    const options = parse<string[]>(row.options_json, [])
    const answer = parse<any>(row.answer_json, row.answer_json)
    return `ID: ${row.id}\nSubject: ${row.subject || ''}\nStandard: ${standardOf(row)}\nQuestion: ${String(row.prompt).slice(0, 1500)}\nOptions: ${options.map((option, index) => `${String.fromCharCode(65 + index)}. ${option}`).join(' | ')}\nKey: ${typeof answer === 'number' ? String.fromCharCode(65 + answer) : String(answer)}`
  }).join('\n\n---\n\n')
  const reply = await runAi([{ role: 'system', content: REVIEW_SYSTEM }, { role: 'user', content: items }], { maxTokens: 3500, temperature: 0.1 })
  const text = String(reply || '').replace(/```(?:json)?/g, '')
  let verdicts: any[] = []
  try { verdicts = JSON.parse(text.slice(text.indexOf('['), text.lastIndexOf(']') + 1)) } catch { verdicts = [] }
  const byId = new Map((Array.isArray(verdicts) ? verdicts : []).map(item => [String(item?.id || ''), item]))
  const stamp = now()
  let upgraded = 0
  let rejected = 0
  const nowPlayableExam = new Map<string, number>()
  for (const row of rows) {
    const verdict = byId.get(String(row.id))
    const exam = normalizeExam(row.exam)
    const countStock = () => { if (exam) nowPlayableExam.set(`${exam}|${row.subject_key || ''}`, (nowPlayableExam.get(`${exam}|${row.subject_key || ''}`) || 0) + 1) }
    if (!verdict) {
      // Not answered: kept for school-level practice, never sold as examination practice.
      await db.prepare(`UPDATE question_bank SET quality = 'unclear', quality_checked_at = ? WHERE id = ?`).bind(stamp, row.id).run()
      continue
    }
    if (verdict.verdict === 'ok') {
      await db.prepare(`UPDATE question_bank SET quality = 'ok', quality_checked_at = ? WHERE id = ?`).bind(stamp, row.id).run()
      countStock()
      continue
    }
    if (verdict.verdict === 'fix') {
      const type = bankType(row.type)
      const options = type === 'truefalse' ? ['True', 'False'] : (Array.isArray(verdict.options) ? verdict.options : []).map((option: unknown) => String(option || '').replace(/^\(?[A-Ha-h][).:]\s+/, '').trim()).filter(Boolean).slice(0, 6)
      const prompt = String(verdict.prompt || row.prompt).trim().slice(0, 6000)
      const answerIndex = Number(verdict.answerIndex)
      const needed = exam ? EXAMS[exam].mcqOptions : 0
      const valid = prompt.length >= 6 && options.length >= 2 && (!needed || type !== 'mcq' || options.length === needed) && Number.isInteger(answerIndex) && answerIndex >= 0 && answerIndex < options.length && new Set(options.map(normalizeText)).size === options.length
      if (valid) {
        try {
          await db.prepare(`UPDATE question_bank SET prompt = ?, normalized_prompt = ?, question_hash = ?, options_json = ?, answer_json = ?, explanation = ?, quality = 'upgraded', quality_checked_at = ?, updated_at = ? WHERE id = ?`)
            .bind(prompt, normalizeText(prompt), await hashOf(type, prompt, options), JSON.stringify(options), JSON.stringify(answerIndex), String(verdict.explanation || row.explanation || '').slice(0, 4000), stamp, stamp, row.id).run()
          upgraded += 1
          countStock()
          continue
        } catch { /* the upgraded wording already exists in the bank: this copy is withdrawn below */ }
      }
    }
    await db.prepare(`UPDATE question_bank SET quality = 'rejected', playable = 0, quality_checked_at = ?, updated_at = ? WHERE id = ?`).bind(stamp, stamp, row.id).run()
    rejected += 1
  }
  for (const [key, ready] of nowPlayableExam) {
    const [exam, subjectKey] = key.split('|')
    await addExamStock(db, exam, subjectKey, ready)
  }
  return { reviewed: rows.length, upgraded, rejected }
}

// ─── The night ───────────────────────────────────────────────────────────────

export async function nightStats(db: D1Database, day: string) {
  const row = await db.prepare(`SELECT * FROM practice_build_nights WHERE day = ?`).bind(day).first() as Record<string, any> | null
  return { day, steps: Number(row?.steps || 0), added: Number(row?.added || 0), reviewed: Number(row?.reviewed || 0), upgraded: Number(row?.upgraded || 0), rejected: Number(row?.rejected || 0), failures: Number(row?.failures || 0) }
}

/**
 * One cron minute of the night: plan new sources (until caught up), then one step —
 * a batch of new questions, or (every reviewEvery-th step) a quality check — while the
 * night's budget lasts. `force` runs outside the window (Ami's "run a step now").
 */
export async function runBuilderTick(db: D1Database, runAi: AiRunner, options: { at?: Date, force?: boolean } = {}) {
  const at = options.at || new Date()
  if (!options.force && !inBuildWindow(at)) return { skipped: 'outside the night window' }
  await ensureBuilderTables(db)
  const day = lagos(at).toISOString().slice(0, 10)
  if ((await getState(db, 'planned')) !== day || options.force) {
    const plan = await planSources(db)
    if (plan.caughtUp) await setState(db, 'planned', day)
  }
  const settings = await getBuildSettings(db)
  const stats = await nightStats(db, day)
  if (!options.force && stats.steps >= settings.batchesPerNight) return { skipped: 'tonight\'s budget is used', stats }
  const review = (stats.steps + 1) % settings.reviewEvery === 0
  let added = 0
  let reviewed = { reviewed: 0, upgraded: 0, rejected: 0 }
  let failed = 0
  if (review) {
    try { reviewed = await reviewSome(db, runAi) } catch (error) { failed = 1; console.error('Practice review failed', error) }
  }
  if (!review || (!reviewed.reviewed && !failed)) {
    const built = await buildOne(db, runAi)
    added = built?.added || 0
    if (built?.failed) failed = 1
    if (!built && !review) {
      // Nothing to build: use the step to check questions instead.
      try { reviewed = await reviewSome(db, runAi) } catch (error) { failed = 1; console.error('Practice review failed', error) }
    }
  }
  await db.prepare(`INSERT INTO practice_build_nights (day, steps, added, reviewed, upgraded, rejected, failures, updated_at) VALUES (?, 1, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(day) DO UPDATE SET steps = steps + 1, added = added + excluded.added, reviewed = reviewed + excluded.reviewed, upgraded = upgraded + excluded.upgraded,
      rejected = rejected + excluded.rejected, failures = failures + excluded.failures, updated_at = excluded.updated_at`)
    .bind(day, added, reviewed.reviewed, reviewed.upgraded, reviewed.rejected, failed, now()).run()
  return { day, added, ...reviewed, failed: Boolean(failed) }
}

/** For Ami: the queue by source and status, tonight and the last nights. */
export async function builderOverview(db: D1Database) {
  await ensureBuilderTables(db)
  const [queue, nights, unchecked] = await Promise.all([
    db.prepare(`SELECT source_type, status, COUNT(*) AS items, SUM(target) AS target, SUM(made) AS made FROM practice_build_queue GROUP BY source_type, status`).all(),
    db.prepare(`SELECT * FROM practice_build_nights ORDER BY day DESC LIMIT 14`).all(),
    db.prepare(`SELECT COUNT(*) AS n FROM question_bank WHERE quality IS NULL AND playable = 1 AND type IN ('mcq', 'truefalse')`).first(),
  ])
  return {
    settings: await getBuildSettings(db), queue: queue.results || [], nights: nights.results || [], unchecked: Number((unchecked as any)?.n || 0),
    window: 'Every night, 00:00–04:00 (Lagos)',
  }
}

