// The Ndovera Curriculum and Examination Specification Library.
//
// Ndovera AI must not decide from general knowledge what a class is expected to
// learn, or what an examination tests, when Ndovera holds the actual documents.
// This module stores them and answers the questions the material generator,
// the student tutor and Exam Readiness ask:
//
//   Curricula        — Ndovera's own (tenant_id '') and a school's own, as rows:
//                      class → subject → theme → topic → subtopics → objectives
//                      → competencies (+ term, week, keywords).
//   Exam specs       — one row per examination and subject (body, version,
//                      effective dates, papers, marks, duration, calculator and
//                      practical rules, assessment objectives, skills, source),
//                      with its topics grouped by area.
//   Cross-mapping    — which curriculum topics an exam topic draws on.
//   Resolver         — finds where a topic sits: the class the teacher chose,
//                      another class (a mismatch), several classes, or nowhere.
//
// Nothing here is invented: rows come from CSV or from syllabus text that
// Ndovera AI only restructures, and every library is reviewed before it is
// published. An exam with no specification on file can still be practised
// "in the style of", and is labelled as unverified everywhere it appears.

export class CurriculumError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

export type Actor = { id: string, name: string, role: string }

const now = () => new Date().toISOString()
const newId = (prefix: string) => `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`
const clip = (value: unknown, max = 500) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max)

function parseList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(item => clip(item, 600)).filter(Boolean).slice(0, 60)
  const text = String(value ?? '').trim()
  if (!text) return []
  if (text.startsWith('[')) { try { return parseList(JSON.parse(text)) } catch {} }
  return text.split(/\s*(?:;|\n|•|•)\s*/).map(item => clip(item.replace(/^[-*\d.)\s]+/, ''), 600)).filter(Boolean).slice(0, 60)
}

function json<T>(value: unknown, fallback: T): T {
  if (value && typeof value === 'object') return value as T
  try { return value ? JSON.parse(String(value)) as T : fallback } catch { return fallback }
}

// ─── Class levels and subjects ───────────────────────────────────────────────

const NUMBER_WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6 }

export type ClassLevel = { key: string, label: string, order: number, section: 'nursery' | 'primary' | 'junior' | 'senior' | '' }

const level = (section: ClassLevel['section'], n: number): ClassLevel => {
  if (section === 'nursery') return { key: `NUR${n}`, label: `Nursery ${n}`, order: n, section }
  if (section === 'primary') return { key: `PRY${n}`, label: `Primary ${n}`, order: 10 + n, section }
  if (section === 'junior') return { key: `JSS${n}`, label: `JSS ${n}`, order: 20 + n, section }
  return { key: `SS${n}`, label: `SS ${n}`, order: 30 + n, section }
}

/** "SSS 2", "Senior Secondary Two", "SS2 Science" → SS2; "Basic 7" → JSS1; "Pry 4" → Primary 4. '' when unknown. */
export function normalizeClassLevel(raw: unknown): ClassLevel {
  const text = String(raw ?? '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()
  const none: ClassLevel = { key: '', label: '', order: 0, section: '' }
  if (!text) return none
  const numberMatch = text.match(/(\d{1,2})/) || text.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|iii|ii|iv|vi|v|i)\b/)
  const n = numberMatch ? (Number(numberMatch[1]) || NUMBER_WORDS[numberMatch[1]] || 0) : 0
  if (/\b(kg|kindergarten|creche|pre ?school|reception|nursery|pre ?k)\b/.test(text)) return level('nursery', Math.min(3, Math.max(1, n || 1)))
  if (/\b(sss|ss|senior secondary|senior school|s s s|shs)\b/.test(text) || /^(s{2,3}|shs)\d/.test(text.replace(/\s/g, ''))) return n >= 1 && n <= 3 ? level('senior', n) : none
  if (/\b(jss|js|junior secondary|junior school|j s s|jhs)\b/.test(text) || /^(js{1,2}|jhs)\d/.test(text.replace(/\s/g, ''))) return n >= 1 && n <= 3 ? level('junior', n) : none
  if (/\b(basic|grade|year|class)\b/.test(text) && n) {
    if (n <= 6) return level('primary', n)
    if (n <= 9) return level('junior', n - 6)
    if (n <= 12) return level('senior', n - 9)
  }
  if (/\b(primary|pry|pri|elementary)\b/.test(text) && n >= 1 && n <= 6) return level('primary', n)
  return none
}

const SUBJECT_ALIASES: Array<[RegExp, string]> = [
  [/^(general )?math(s|ematics)?( general)?$/, 'mathematics'],
  [/^further math(s|ematics)?$/, 'further mathematics'],
  [/^english( language| studies)?$/, 'english'],
  [/^(basic )?science( and technology)?$/, 'basic science'],
  [/^(civic|civics)( education)?$/, 'civic education'],
  [/^(agric|agricultural science|agriculture)$/, 'agricultural science'],
  [/^(ict|computer( studies| science)?|information (and communication )?technology|data processing)$/, 'computer studies'],
  [/^(crs|christian religious (studies|knowledge))$/, 'christian religious studies'],
  [/^(irs|islamic (religious )?studies)$/, 'islamic studies'],
  [/^(lit|literature)( in english)?$/, 'literature in english'],
  [/^(phe|physical (and|&) health education)$/, 'physical and health education'],
  [/^(quantitative|quantitative reasoning|quantitative aptitude)$/, 'quantitative reasoning'],
  [/^(verbal|verbal reasoning|verbal aptitude)$/, 'verbal reasoning'],
]

/** A comparable key for a subject name: "General Maths" and "Mathematics" are the same subject. */
export function subjectKey(raw: unknown) {
  const text = String(raw ?? '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z ]+/g, ' ').replace(/\s+/g, ' ').trim()
  for (const [pattern, key] of SUBJECT_ALIASES) if (pattern.test(text)) return key
  return text
}

// ─── Text similarity ─────────────────────────────────────────────────────────
// Lexical, explainable and free: stems, stop words removed, a few synonyms.

const STOP = new Set('a an and the of in on to for with by from as at is are be its their into how what why which using use introduction basic simple types type concept concepts meaning part parts i ii iii'.split(' '))
const SYNONYMS: Record<string, string> = { maths: 'mathematics', math: 'mathematics', simultaneous: 'simultaneous', quadratics: 'quadratic', trig: 'trigonometry', trigonometric: 'trigonometry', genetics: 'heredity', inheritance: 'heredity', mendelian: 'heredity', mendel: 'heredity', fraction: 'fraction', photosynthetic: 'photosynthesis' }

function stem(word: string) {
  let w = word
  if (w.length > 5 && w.endsWith('ies')) w = `${w.slice(0, -3)}y`
  else if (w.length > 4 && w.endsWith('es') && /(ss|sh|ch|x|z)es$/.test(w)) w = w.slice(0, -2)
  else if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') && !w.endsWith('us') && !w.endsWith('is')) w = w.slice(0, -1)
  if (w.length > 6 && w.endsWith('ing')) w = w.slice(0, -3)
  return SYNONYMS[w] || w
}

export function tokens(text: unknown) {
  return [...new Set(String(text ?? '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(word => word && !STOP.has(word)).map(stem))]
}

/** 0..1: how well `query` matches a topic described by `fields` (topic first, then subtopics and keywords). */
export function similarity(query: unknown, fields: { topic: string, subtopics?: string[], keywords?: string[], theme?: string }) {
  const q = tokens(query)
  if (!q.length) return 0
  const phrase = String(query).toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()
  const score = (text: string) => {
    const t = tokens(text)
    if (!t.length) return 0
    const shared = q.filter(word => t.includes(word)).length
    const dice = (2 * shared) / (q.length + t.length)
    const covered = shared / q.length
    const normalized = text.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()
    const contains = phrase.length > 3 && normalized.includes(phrase) ? 0.25 : 0
    return Math.min(1, Math.max(dice, covered * 0.9) + contains)
  }
  const topicScore = score(fields.topic)
  const subtopicScore = Math.max(0, ...(fields.subtopics || []).map(score)) * 0.95
  const keywordScore = Math.max(0, ...(fields.keywords || []).map(score)) * 0.85
  const themeScore = fields.theme ? score(fields.theme) * 0.6 : 0
  return Math.round(Math.max(topicScore, subtopicScore, keywordScore, themeScore) * 100) / 100
}

// ─── Tables ──────────────────────────────────────────────────────────────────

const readyDbs = new WeakSet<object>()
export function resetCurriculumCache() { /* WeakSet entries fall away with their database */ }

export async function ensureCurriculumTables(db: D1Database) {
  if (readyDbs.has(db as object)) return
  const statements = [
    `CREATE TABLE IF NOT EXISTS curricula (
      id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL DEFAULT '', name TEXT NOT NULL, country TEXT, system TEXT, version TEXT,
      source TEXT, notes TEXT, status TEXT NOT NULL DEFAULT 'draft', created_by TEXT, created_at TEXT, updated_at TEXT, published_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS curriculum_topics (
      id TEXT PRIMARY KEY, curriculum_id TEXT NOT NULL, class_key TEXT, class_label TEXT, class_order INTEGER DEFAULT 0, section TEXT,
      subject_key TEXT, subject TEXT, theme TEXT, topic TEXT NOT NULL, subtopics TEXT, objectives TEXT, competencies TEXT, keywords TEXT,
      term TEXT, week TEXT, position INTEGER DEFAULT 0, created_at TEXT, updated_at TEXT
    )`,
    `CREATE INDEX IF NOT EXISTS idx_curriculum_topics_lookup ON curriculum_topics(curriculum_id, subject_key, class_order)`,
    `CREATE TABLE IF NOT EXISTS exam_specs (
      id TEXT PRIMARY KEY, exam_key TEXT NOT NULL, body TEXT, name TEXT, country TEXT, qualification TEXT, version TEXT,
      effective_from TEXT, effective_to TEXT, source TEXT, subject_key TEXT, subject TEXT, papers TEXT, assessment_objectives TEXT,
      required_skills TEXT, question_types TEXT, calculator TEXT, practical TEXT, notes TEXT, status TEXT NOT NULL DEFAULT 'draft',
      created_by TEXT, created_at TEXT, updated_at TEXT, published_at TEXT
    )`,
    `CREATE INDEX IF NOT EXISTS idx_exam_specs_lookup ON exam_specs(exam_key, subject_key, status)`,
    `CREATE TABLE IF NOT EXISTS exam_spec_topics (
      id TEXT PRIMARY KEY, spec_id TEXT NOT NULL, area TEXT, topic TEXT NOT NULL, objectives TEXT, skills TEXT, question_types TEXT,
      keywords TEXT, position INTEGER DEFAULT 0, created_at TEXT, updated_at TEXT
    )`,
    `CREATE INDEX IF NOT EXISTS idx_exam_spec_topics ON exam_spec_topics(spec_id, position)`,
    `CREATE TABLE IF NOT EXISTS curriculum_exam_map (
      id TEXT PRIMARY KEY, curriculum_topic_id TEXT NOT NULL, spec_topic_id TEXT NOT NULL, method TEXT, score REAL, created_by TEXT, created_at TEXT
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_curriculum_exam_map ON curriculum_exam_map(curriculum_topic_id, spec_topic_id)`,
    `CREATE TABLE IF NOT EXISTS material_ai_config (scope TEXT PRIMARY KEY, payload TEXT, updated_by TEXT, updated_at TEXT)`,
  ]
  for (const sql of statements) await db.prepare(sql).run()
  readyDbs.add(db as object)
}

// ─── Curricula ───────────────────────────────────────────────────────────────

export function mapCurriculum(row: Record<string, any>) {
  return {
    id: String(row.id), tenantId: String(row.tenant_id || ''), name: String(row.name || ''), country: String(row.country || ''),
    system: String(row.system || ''), version: String(row.version || ''), source: String(row.source || ''), notes: String(row.notes || ''),
    status: String(row.status || 'draft'), createdAt: row.created_at, updatedAt: row.updated_at, publishedAt: row.published_at || null,
    owner: row.tenant_id ? 'school' : 'ndovera', topicCount: Number(row.topic_count || 0),
  }
}

export function mapCurriculumTopic(row: Record<string, any>) {
  return {
    id: String(row.id), curriculumId: String(row.curriculum_id), classKey: String(row.class_key || ''), classLabel: String(row.class_label || ''),
    classOrder: Number(row.class_order || 0), section: String(row.section || ''), subjectKey: String(row.subject_key || ''), subject: String(row.subject || ''),
    theme: String(row.theme || ''), topic: String(row.topic || ''), subtopics: json<string[]>(row.subtopics, []), objectives: json<string[]>(row.objectives, []),
    competencies: json<string[]>(row.competencies, []), keywords: json<string[]>(row.keywords, []), term: String(row.term || ''), week: String(row.week || ''),
    position: Number(row.position || 0),
  }
}
export type CurriculumTopic = ReturnType<typeof mapCurriculumTopic>

/** Ndovera's libraries (tenant '') and, when a tenant is given, that school's own. */
export async function listCurricula(db: D1Database, options: { tenantId?: string, includeDrafts?: boolean, ndoveraOnly?: boolean } = {}) {
  await ensureCurriculumTables(db)
  const where = [options.ndoveraOnly ? `c.tenant_id = ''` : `(c.tenant_id = '' OR c.tenant_id = ?)`]
  if (!options.includeDrafts) where.push(`c.status = 'published'`)
  const binds = options.ndoveraOnly ? [] : [String(options.tenantId || '')]
  const rows = await db.prepare(`SELECT c.*, (SELECT COUNT(*) FROM curriculum_topics t WHERE t.curriculum_id = c.id) AS topic_count
    FROM curricula c WHERE ${where.join(' AND ')} ORDER BY c.tenant_id DESC, c.name`).bind(...binds).all()
  return ((rows.results || []) as Record<string, any>[]).map(mapCurriculum)
}

export async function getCurriculum(db: D1Database, id: string) {
  await ensureCurriculumTables(db)
  const row = await db.prepare(`SELECT c.*, (SELECT COUNT(*) FROM curriculum_topics t WHERE t.curriculum_id = c.id) AS topic_count FROM curricula c WHERE c.id = ?`).bind(id).first() as Record<string, any> | null
  return row ? mapCurriculum(row) : null
}

export async function saveCurriculum(db: D1Database, input: Record<string, any>, options: { tenantId: string, actor: Actor, id?: string }) {
  await ensureCurriculumTables(db)
  const name = clip(input.name, 160)
  if (!name) throw new CurriculumError('Give the curriculum a name.')
  const fields = [name, clip(input.country, 80), clip(input.system, 120), clip(input.version, 60), clip(input.source, 400), clip(input.notes, 2000)]
  if (options.id) {
    const existing = await getCurriculum(db, options.id)
    if (!existing || existing.tenantId !== options.tenantId) throw new CurriculumError('Curriculum not found.', 404)
    await db.prepare(`UPDATE curricula SET name = ?, country = ?, system = ?, version = ?, source = ?, notes = ?, updated_at = ? WHERE id = ?`).bind(...fields, now(), options.id).run()
    return getCurriculum(db, options.id)
  }
  const id = newId('cur')
  await db.prepare(`INSERT INTO curricula (id, tenant_id, name, country, system, version, source, notes, status, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?)`)
    .bind(id, options.tenantId, ...fields, options.actor.id, now(), now()).run()
  return getCurriculum(db, id)
}

export async function setCurriculumStatus(db: D1Database, id: string, status: string, tenantId: string) {
  const existing = await getCurriculum(db, id)
  if (!existing || existing.tenantId !== tenantId) throw new CurriculumError('Curriculum not found.', 404)
  if (!['draft', 'published', 'archived'].includes(status)) throw new CurriculumError('Unknown status.')
  if (status === 'published' && !existing.topicCount) throw new CurriculumError('Add topics before publishing the curriculum.')
  await db.prepare(`UPDATE curricula SET status = ?, updated_at = ?, published_at = CASE WHEN ? = 'published' THEN ? ELSE published_at END WHERE id = ?`).bind(status, now(), status, now(), id).run()
  return getCurriculum(db, id)
}

export async function deleteCurriculum(db: D1Database, id: string, tenantId: string) {
  const existing = await getCurriculum(db, id)
  if (!existing || existing.tenantId !== tenantId) throw new CurriculumError('Curriculum not found.', 404)
  await db.prepare(`DELETE FROM curriculum_exam_map WHERE curriculum_topic_id IN (SELECT id FROM curriculum_topics WHERE curriculum_id = ?)`).bind(id).run()
  await db.prepare(`DELETE FROM curriculum_topics WHERE curriculum_id = ?`).bind(id).run()
  await db.prepare(`DELETE FROM curricula WHERE id = ?`).bind(id).run()
}

export async function listCurriculumTopics(db: D1Database, curriculumId: string, filters: { subjectKey?: string, classKey?: string } = {}) {
  await ensureCurriculumTables(db)
  const where = ['curriculum_id = ?']
  const binds: unknown[] = [curriculumId]
  if (filters.subjectKey) { where.push('subject_key = ?'); binds.push(filters.subjectKey) }
  if (filters.classKey) { where.push('class_key = ?'); binds.push(filters.classKey) }
  const rows = await db.prepare(`SELECT * FROM curriculum_topics WHERE ${where.join(' AND ')} ORDER BY subject_key, class_order, position, topic`).bind(...binds).all()
  return ((rows.results || []) as Record<string, any>[]).map(mapCurriculumTopic)
}

/** A row as typed, pasted or imported. Returns problems instead of throwing so imports can report them all. */
export function normalizeCurriculumRow(raw: Record<string, any>) {
  const lower: Record<string, any> = {}
  for (const [key, value] of Object.entries(raw || {})) lower[key.toLowerCase().replace(/[^a-z]/g, '')] = value
  const pick = (...keys: string[]) => keys.map(key => lower[key]).find(value => value !== undefined && String(value).trim() !== '')
  const classRaw = clip(pick('class', 'classlevel', 'level', 'grade', 'year', 'classlabel'), 60)
  const level = normalizeClassLevel(classRaw)
  const subject = clip(pick('subject', 'subjectname'), 120)
  const topic = clip(pick('topic', 'topicname', 'title'), 240)
  const problems: string[] = []
  if (!topic) problems.push('no topic')
  if (!subject) problems.push('no subject')
  if (!level.key) problems.push(`class "${classRaw || '—'}" not recognised`)
  return {
    problems,
    row: {
      classKey: level.key, classLabel: level.label || classRaw, classOrder: level.order, section: level.section,
      subject, subjectKey: subjectKey(subject), theme: clip(pick('theme', 'strand', 'unit', 'module', 'area'), 240), topic,
      subtopics: parseList(pick('subtopics', 'subtopic', 'contents', 'content')), objectives: parseList(pick('objectives', 'learningobjectives', 'performanceobjectives', 'objective')),
      competencies: parseList(pick('competencies', 'competency', 'expectedcompetencies', 'skills')), keywords: parseList(pick('keywords', 'tags')),
      term: clip(pick('term'), 40), week: clip(pick('week', 'weeks'), 40),
    },
  }
}

export async function addCurriculumTopics(db: D1Database, curriculumId: string, rows: Array<Record<string, any>>) {
  await ensureCurriculumTables(db)
  const accepted: string[] = []
  const rejected: Array<{ index: number, problems: string[], topic: string }> = []
  const start = Number((await db.prepare(`SELECT COALESCE(MAX(position), 0) AS p FROM curriculum_topics WHERE curriculum_id = ?`).bind(curriculumId).first() as any)?.p || 0)
  const statements: D1PreparedStatement[] = []
  rows.slice(0, 2000).forEach((raw, index) => {
    const { problems, row } = normalizeCurriculumRow(raw)
    if (problems.length) { rejected.push({ index, problems, topic: row.topic }); return }
    const id = newId('ctp')
    accepted.push(id)
    statements.push(db.prepare(`INSERT INTO curriculum_topics (id, curriculum_id, class_key, class_label, class_order, section, subject_key, subject, theme, topic, subtopics, objectives, competencies, keywords, term, week, position, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(id, curriculumId, row.classKey, row.classLabel, row.classOrder, row.section, row.subjectKey, row.subject, row.theme, row.topic,
      JSON.stringify(row.subtopics), JSON.stringify(row.objectives), JSON.stringify(row.competencies), JSON.stringify(row.keywords), row.term, row.week, start + accepted.length, now(), now()))
  })
  for (let i = 0; i < statements.length; i += 50) await db.batch(statements.slice(i, i + 50))
  await db.prepare(`UPDATE curricula SET updated_at = ? WHERE id = ?`).bind(now(), curriculumId).run()
  return { added: accepted.length, rejected }
}

export async function updateCurriculumTopic(db: D1Database, curriculumId: string, topicId: string, input: Record<string, any>) {
  const { problems, row } = normalizeCurriculumRow(input)
  if (problems.length) throw new CurriculumError(`Cannot save: ${problems.join(', ')}.`)
  const result = await db.prepare(`UPDATE curriculum_topics SET class_key = ?, class_label = ?, class_order = ?, section = ?, subject_key = ?, subject = ?, theme = ?, topic = ?, subtopics = ?, objectives = ?, competencies = ?, keywords = ?, term = ?, week = ?, updated_at = ?
    WHERE id = ? AND curriculum_id = ?`).bind(row.classKey, row.classLabel, row.classOrder, row.section, row.subjectKey, row.subject, row.theme, row.topic, JSON.stringify(row.subtopics), JSON.stringify(row.objectives),
    JSON.stringify(row.competencies), JSON.stringify(row.keywords), row.term, row.week, now(), topicId, curriculumId).run()
  if (!result.meta?.changes) throw new CurriculumError('Topic not found.', 404)
}

export async function deleteCurriculumTopic(db: D1Database, curriculumId: string, topicId: string) {
  await db.prepare(`DELETE FROM curriculum_exam_map WHERE curriculum_topic_id = ?`).bind(topicId).run()
  await db.prepare(`DELETE FROM curriculum_topics WHERE id = ? AND curriculum_id = ?`).bind(topicId, curriculumId).run()
}

// ─── CSV ─────────────────────────────────────────────────────────────────────

/** RFC-4180-ish CSV (or tab-separated) into objects keyed by the header row. */
export function parseCsv(text: string): Array<Record<string, string>> {
  const source = String(text || '').replace(/^﻿/, '').replace(/\r\n?/g, '\n')
  const firstLine = source.split('\n', 1)[0] || ''
  const delimiter = firstLine.split('\t').length > firstLine.split(',').length ? '\t' : ','
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i]
    if (quoted) {
      if (ch === '"' && source[i + 1] === '"') { cell += '"'; i += 1 }
      else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"' && !cell.trim()) { quoted = true; cell = '' }
    else if (ch === delimiter) { row.push(cell); cell = '' }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = '' }
    else cell += ch
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  const [header, ...body] = rows.filter(cells => cells.some(value => value.trim()))
  if (!header) return []
  const keys = header.map(value => value.trim())
  return body.map(cells => Object.fromEntries(keys.map((key, index) => [key, (cells[index] || '').trim()])))
}

// ─── Syllabus text → rows (Ndovera AI restructures; it never adds) ───────────

export type AiRunner = (messages: Array<{ role: string, content: string }>, options: { maxTokens: number, temperature: number }) => Promise<string>

export const IMPORT_CHUNK = 5000

/** The next piece of a long document, cut at a line break. */
export function importChunk(text: string, offset: number) {
  const source = String(text || '')
  if (offset >= source.length) return { chunk: '', next: source.length }
  let end = Math.min(source.length, offset + IMPORT_CHUNK)
  if (end < source.length) {
    const cut = source.lastIndexOf('\n', end)
    if (cut > offset + IMPORT_CHUNK / 2) end = cut
  }
  return { chunk: source.slice(offset, end), next: end }
}

export function extractJsonArray(reply: string): any[] {
  const text = String(reply || '').replace(/```(?:json)?/g, '')
  const start = text.indexOf('[')
  const end = text.lastIndexOf(']')
  if (start < 0 || end <= start) return []
  try { const parsed = JSON.parse(text.slice(start, end + 1)); return Array.isArray(parsed) ? parsed : [] } catch { return [] }
}

export function curriculumImportPrompt(chunk: string, defaults: { subject?: string, classLabel?: string }) {
  return [
    { role: 'system', content: [
      'You convert an official school curriculum / scheme of work into structured rows. Return ONLY a JSON array.',
      'Each element: {"class": "e.g. SS 2 or Primary 4", "subject": "", "theme": "theme/strand/unit if stated", "topic": "", "subtopics": [""], "objectives": ["performance objectives as written"], "competencies": [""], "term": "", "week": ""}.',
      'Copy the document: never add topics, objectives or content that are not in the text. Keep the wording of objectives. Leave a field empty when the text does not say it.',
      defaults.subject ? `If the subject is not stated, it is ${defaults.subject}.` : '',
      defaults.classLabel ? `If the class is not stated, it is ${defaults.classLabel}.` : '',
    ].filter(Boolean).join('\n') },
    { role: 'user', content: `CURRICULUM TEXT:\n<<<\n${chunk}\n>>>` },
  ]
}

export function examSpecImportPrompt(chunk: string, subject: string) {
  return [
    { role: 'system', content: [
      'You convert an official examination syllabus / specification into structured rows. Return ONLY a JSON array.',
      'Each element: {"area": "section or content area, e.g. Algebra", "topic": "", "objectives": ["what candidates should be able to do, as written"], "skills": [""], "questionTypes": [""]}.',
      `The subject is ${subject}. Copy the document: never add topics or objectives that are not in the text, and keep its wording.`,
    ].join('\n') },
    { role: 'user', content: `SYLLABUS TEXT:\n<<<\n${chunk}\n>>>` },
  ]
}

// ─── Examination catalogue and specifications ────────────────────────────────

type CatalogEntry = { key: string, label: string, body: string, sections: ClassLevel['section'][], minOrder?: number, subjects?: string[] }

/**
 * Examinations a teacher may prepare for. This is only which exam applies to
 * which subjects and levels — never what the exam contains; that comes from a
 * stored specification.
 */
export const EXAM_CATALOG: CatalogEntry[] = [
  { key: 'waec', label: 'WAEC (WASSCE)', body: 'West African Examinations Council', sections: ['senior'] },
  { key: 'neco', label: 'NECO (SSCE)', body: 'National Examinations Council', sections: ['senior'] },
  { key: 'bece', label: 'BECE / Junior Secondary examinations', body: 'State Ministries / NECO', sections: ['junior'] },
  { key: 'ncee', label: 'National Common Entrance', body: 'National Examinations Council', sections: ['primary'], minOrder: 15,
    subjects: ['mathematics', 'english', 'basic science', 'quantitative reasoning', 'verbal reasoning', 'social studies', 'general studies', 'national values'] },
  { key: 'igcse', label: 'Cambridge IGCSE', body: 'Cambridge International', sections: ['junior', 'senior'], minOrder: 23 },
  { key: 'sat', label: 'SAT', body: 'College Board', sections: ['senior'], subjects: ['mathematics', 'english'] },
  { key: 'ielts', label: 'IELTS', body: 'British Council / IDP / Cambridge', sections: ['senior'], subjects: ['english'] },
  { key: 'toefl', label: 'TOEFL', body: 'ETS', sections: ['senior'], subjects: ['english'] },
]

export function mapExamSpec(row: Record<string, any>) {
  return {
    id: String(row.id), examKey: String(row.exam_key), body: String(row.body || ''), name: String(row.name || ''), country: String(row.country || ''),
    qualification: String(row.qualification || ''), version: String(row.version || ''), effectiveFrom: String(row.effective_from || ''), effectiveTo: String(row.effective_to || ''),
    source: String(row.source || ''), subjectKey: String(row.subject_key || ''), subject: String(row.subject || ''),
    papers: json<Array<Record<string, any>>>(row.papers, []), assessmentObjectives: json<string[]>(row.assessment_objectives, []),
    requiredSkills: json<string[]>(row.required_skills, []), questionTypes: json<string[]>(row.question_types, []),
    calculator: String(row.calculator || ''), practical: String(row.practical || ''), notes: String(row.notes || ''),
    status: String(row.status || 'draft'), updatedAt: row.updated_at, publishedAt: row.published_at || null, topicCount: Number(row.topic_count || 0),
  }
}
export type ExamSpec = ReturnType<typeof mapExamSpec>

export function mapSpecTopic(row: Record<string, any>) {
  return {
    id: String(row.id), specId: String(row.spec_id), area: String(row.area || ''), topic: String(row.topic || ''),
    objectives: json<string[]>(row.objectives, []), skills: json<string[]>(row.skills, []), questionTypes: json<string[]>(row.question_types, []),
    keywords: json<string[]>(row.keywords, []), position: Number(row.position || 0),
  }
}
export type SpecTopic = ReturnType<typeof mapSpecTopic>

const isCurrent = (spec: ExamSpec, today = now().slice(0, 10)) => (!spec.effectiveFrom || spec.effectiveFrom <= today) && (!spec.effectiveTo || spec.effectiveTo >= today)

export async function listExamSpecs(db: D1Database, options: { includeDrafts?: boolean, examKey?: string, subjectKey?: string } = {}) {
  await ensureCurriculumTables(db)
  const where = ['1 = 1']
  const binds: unknown[] = []
  if (!options.includeDrafts) where.push(`s.status = 'published'`)
  if (options.examKey) { where.push('s.exam_key = ?'); binds.push(options.examKey) }
  if (options.subjectKey) { where.push('s.subject_key = ?'); binds.push(options.subjectKey) }
  const rows = await db.prepare(`SELECT s.*, (SELECT COUNT(*) FROM exam_spec_topics t WHERE t.spec_id = s.id) AS topic_count FROM exam_specs s WHERE ${where.join(' AND ')} ORDER BY s.exam_key, s.subject_key, s.effective_from DESC`).bind(...binds).all()
  return ((rows.results || []) as Record<string, any>[]).map(mapExamSpec)
}

export async function getExamSpec(db: D1Database, id: string) {
  await ensureCurriculumTables(db)
  const row = await db.prepare(`SELECT s.*, (SELECT COUNT(*) FROM exam_spec_topics t WHERE t.spec_id = s.id) AS topic_count FROM exam_specs s WHERE s.id = ?`).bind(id).first() as Record<string, any> | null
  return row ? mapExamSpec(row) : null
}

/** The published specification in force today for an exam and subject (latest version first). */
export async function currentSpecFor(db: D1Database, examKey: string, subject: string) {
  const specs = await listExamSpecs(db, { examKey, subjectKey: subjectKey(subject) })
  return specs.find(spec => isCurrent(spec)) || null
}

function normalizePapers(value: unknown) {
  const list = Array.isArray(value) ? value : json<any[]>(value, [])
  return list.slice(0, 12).map((paper: any) => ({
    name: clip(paper?.name, 120), marks: Number(paper?.marks) || 0, durationMinutes: Number(paper?.durationMinutes ?? paper?.duration) || 0,
    questionTypes: parseList(paper?.questionTypes), notes: clip(paper?.notes, 600),
  })).filter(paper => paper.name)
}

export async function saveExamSpec(db: D1Database, input: Record<string, any>, options: { actor: Actor, id?: string }) {
  await ensureCurriculumTables(db)
  const examKey = clip(input.examKey, 40).toLowerCase().replace(/[^a-z0-9_-]/g, '')
  const subject = clip(input.subject, 120)
  if (!examKey) throw new CurriculumError('Choose the examination.')
  if (!subject) throw new CurriculumError('Name the subject.')
  const catalog = EXAM_CATALOG.find(entry => entry.key === examKey)
  const values = [
    examKey, clip(input.body, 160) || catalog?.body || '', clip(input.name, 160) || catalog?.label || examKey.toUpperCase(), clip(input.country, 80), clip(input.qualification, 160),
    clip(input.version, 60), clip(input.effectiveFrom, 10), clip(input.effectiveTo, 10), clip(input.source, 600), subjectKey(subject), subject,
    JSON.stringify(normalizePapers(input.papers)), JSON.stringify(parseList(input.assessmentObjectives)), JSON.stringify(parseList(input.requiredSkills)),
    JSON.stringify(parseList(input.questionTypes)), clip(input.calculator, 300), clip(input.practical, 600), clip(input.notes, 2000),
  ]
  if (!values[5]) throw new CurriculumError('Give the specification version (for example "2025–2027 syllabus") so teachers know which one they are preparing for.')
  if (options.id) {
    const result = await db.prepare(`UPDATE exam_specs SET exam_key = ?, body = ?, name = ?, country = ?, qualification = ?, version = ?, effective_from = ?, effective_to = ?, source = ?, subject_key = ?, subject = ?,
      papers = ?, assessment_objectives = ?, required_skills = ?, question_types = ?, calculator = ?, practical = ?, notes = ?, updated_at = ? WHERE id = ?`).bind(...values, now(), options.id).run()
    if (!result.meta?.changes) throw new CurriculumError('Specification not found.', 404)
    return getExamSpec(db, options.id)
  }
  const id = newId('exs')
  await db.prepare(`INSERT INTO exam_specs (exam_key, body, name, country, qualification, version, effective_from, effective_to, source, subject_key, subject, papers, assessment_objectives, required_skills, question_types, calculator, practical, notes, id, status, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?)`).bind(...values, id, options.actor.id, now(), now()).run()
  return getExamSpec(db, id)
}

export async function setExamSpecStatus(db: D1Database, id: string, status: string) {
  const spec = await getExamSpec(db, id)
  if (!spec) throw new CurriculumError('Specification not found.', 404)
  if (!['draft', 'published', 'archived'].includes(status)) throw new CurriculumError('Unknown status.')
  if (status === 'published' && !spec.topicCount) throw new CurriculumError('Add the specification\'s topics before publishing it.')
  await db.prepare(`UPDATE exam_specs SET status = ?, updated_at = ?, published_at = CASE WHEN ? = 'published' THEN ? ELSE published_at END WHERE id = ?`).bind(status, now(), status, now(), id).run()
  return getExamSpec(db, id)
}

export async function deleteExamSpec(db: D1Database, id: string) {
  await ensureCurriculumTables(db)
  await db.prepare(`DELETE FROM curriculum_exam_map WHERE spec_topic_id IN (SELECT id FROM exam_spec_topics WHERE spec_id = ?)`).bind(id).run()
  await db.prepare(`DELETE FROM exam_spec_topics WHERE spec_id = ?`).bind(id).run()
  await db.prepare(`DELETE FROM exam_specs WHERE id = ?`).bind(id).run()
}

export async function listSpecTopics(db: D1Database, specId: string) {
  await ensureCurriculumTables(db)
  const rows = await db.prepare(`SELECT * FROM exam_spec_topics WHERE spec_id = ? ORDER BY position, area, topic`).bind(specId).all()
  return ((rows.results || []) as Record<string, any>[]).map(mapSpecTopic)
}

export async function addSpecTopics(db: D1Database, specId: string, rows: Array<Record<string, any>>) {
  await ensureCurriculumTables(db)
  const start = Number((await db.prepare(`SELECT COALESCE(MAX(position), 0) AS p FROM exam_spec_topics WHERE spec_id = ?`).bind(specId).first() as any)?.p || 0)
  const statements: D1PreparedStatement[] = []
  const rejected: Array<{ index: number, problems: string[] }> = []
  rows.slice(0, 2000).forEach((raw, index) => {
    const lower: Record<string, any> = {}
    for (const [key, value] of Object.entries(raw || {})) lower[key.toLowerCase().replace(/[^a-z]/g, '')] = value
    const topic = clip(lower.topic ?? lower.title, 240)
    if (!topic) { rejected.push({ index, problems: ['no topic'] }); return }
    statements.push(db.prepare(`INSERT INTO exam_spec_topics (id, spec_id, area, topic, objectives, skills, question_types, keywords, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(newId('est'), specId, clip(lower.area ?? lower.section ?? lower.theme, 160), topic, JSON.stringify(parseList(lower.objectives ?? lower.objective)), JSON.stringify(parseList(lower.skills)),
        JSON.stringify(parseList(lower.questiontypes ?? lower.questiontype)), JSON.stringify(parseList(lower.keywords)), start + statements.length + 1, now(), now()))
  })
  for (let i = 0; i < statements.length; i += 50) await db.batch(statements.slice(i, i + 50))
  await db.prepare(`UPDATE exam_specs SET updated_at = ? WHERE id = ?`).bind(now(), specId).run()
  return { added: statements.length, rejected }
}

export async function updateSpecTopic(db: D1Database, specId: string, topicId: string, input: Record<string, any>) {
  const topic = clip(input.topic, 240)
  if (!topic) throw new CurriculumError('A topic needs a name.')
  await db.prepare(`UPDATE exam_spec_topics SET area = ?, topic = ?, objectives = ?, skills = ?, question_types = ?, keywords = ?, updated_at = ? WHERE id = ? AND spec_id = ?`)
    .bind(clip(input.area, 160), topic, JSON.stringify(parseList(input.objectives)), JSON.stringify(parseList(input.skills)), JSON.stringify(parseList(input.questionTypes)), JSON.stringify(parseList(input.keywords)), now(), topicId, specId).run()
}

export async function deleteSpecTopic(db: D1Database, specId: string, topicId: string) {
  await db.prepare(`DELETE FROM curriculum_exam_map WHERE spec_topic_id = ?`).bind(topicId).run()
  await db.prepare(`DELETE FROM exam_spec_topics WHERE id = ? AND spec_id = ?`).bind(topicId, specId).run()
}

// ─── Cross-mapping ───────────────────────────────────────────────────────────

export const AUTO_MAP_THRESHOLD = 0.5

/** Link each topic of a specification to the curriculum topics (same subject) it draws on. Manual links are kept. */
export async function autoMapSpec(db: D1Database, specId: string, curriculumIds: string[]) {
  const spec = await getExamSpec(db, specId)
  if (!spec) throw new CurriculumError('Specification not found.', 404)
  const specTopics = await listSpecTopics(db, specId)
  const curriculumTopics = (await Promise.all(curriculumIds.map(id => listCurriculumTopics(db, id, { subjectKey: spec.subjectKey })))).flat()
  const catalog = EXAM_CATALOG.find(entry => entry.key === spec.examKey)
  const eligible = curriculumTopics.filter(topic => !catalog || catalog.sections.includes(topic.section as any) || !topic.section)
  await db.prepare(`DELETE FROM curriculum_exam_map WHERE method = 'auto' AND spec_topic_id IN (SELECT id FROM exam_spec_topics WHERE spec_id = ?)`).bind(specId).run()
  const statements: D1PreparedStatement[] = []
  for (const specTopic of specTopics) {
    for (const topic of eligible) {
      const score = Math.max(similarity(specTopic.topic, topic), similarity(topic.topic, { topic: specTopic.topic, keywords: specTopic.keywords, theme: specTopic.area }))
      if (score >= AUTO_MAP_THRESHOLD) {
        statements.push(db.prepare(`INSERT OR IGNORE INTO curriculum_exam_map (id, curriculum_topic_id, spec_topic_id, method, score, created_at) VALUES (?, ?, ?, 'auto', ?, ?)`).bind(newId('map'), topic.id, specTopic.id, score, now()))
      }
    }
  }
  for (let i = 0; i < statements.length; i += 50) await db.batch(statements.slice(i, i + 50))
  return { linked: statements.length, specTopics: specTopics.length, curriculumTopics: eligible.length }
}

export async function setMapping(db: D1Database, curriculumTopicId: string, specTopicId: string, linked: boolean, actor: Actor) {
  await ensureCurriculumTables(db)
  if (linked) {
    await db.prepare(`INSERT INTO curriculum_exam_map (id, curriculum_topic_id, spec_topic_id, method, score, created_by, created_at) VALUES (?, ?, ?, 'manual', 1, ?, ?)
      ON CONFLICT(curriculum_topic_id, spec_topic_id) DO UPDATE SET method = 'manual', score = 1, created_by = excluded.created_by`).bind(newId('map'), curriculumTopicId, specTopicId, actor.id, now()).run()
  } else {
    await db.prepare(`DELETE FROM curriculum_exam_map WHERE curriculum_topic_id = ? AND spec_topic_id = ?`).bind(curriculumTopicId, specTopicId).run()
  }
}

export async function mappingsForSpec(db: D1Database, specId: string) {
  await ensureCurriculumTables(db)
  const rows = await db.prepare(`SELECT m.*, ct.topic AS curriculum_topic, ct.class_label, ct.curriculum_id FROM curriculum_exam_map m
    JOIN exam_spec_topics st ON st.id = m.spec_topic_id JOIN curriculum_topics ct ON ct.id = m.curriculum_topic_id WHERE st.spec_id = ?`).bind(specId).all()
  return ((rows.results || []) as Record<string, any>[]).map(row => ({
    curriculumTopicId: String(row.curriculum_topic_id), specTopicId: String(row.spec_topic_id), method: String(row.method || ''), score: Number(row.score || 0),
    curriculumTopic: String(row.curriculum_topic || ''), classLabel: String(row.class_label || ''), curriculumId: String(row.curriculum_id || ''),
  }))
}

// ─── Settings: which curriculum a school follows; what AI may produce ───────

export type MaterialAiSettings = {
  curriculumIds: string[]
  text: boolean, tables: boolean, formulae: boolean, graphs: boolean, images: boolean, maxImages: number
}

export const DEFAULT_MATERIAL_AI: MaterialAiSettings = { curriculumIds: [], text: true, tables: true, formulae: true, graphs: true, images: true, maxImages: 4 }
export const MAX_IMAGES_CAP = 8

async function readConfig(db: D1Database, scope: string) {
  await ensureCurriculumTables(db)
  const row = await db.prepare(`SELECT payload FROM material_ai_config WHERE scope = ?`).bind(scope).first() as Record<string, any> | null
  return json<Record<string, any>>(row?.payload, {})
}

function cleanSettings(raw: Record<string, any>, base: MaterialAiSettings): MaterialAiSettings {
  const flag = (key: keyof MaterialAiSettings) => (raw[key] === undefined ? base[key] as boolean : Boolean(raw[key]))
  return {
    curriculumIds: Array.isArray(raw.curriculumIds) ? raw.curriculumIds.map(String).filter(Boolean).slice(0, 6) : base.curriculumIds,
    text: true, tables: flag('tables'), formulae: flag('formulae'), graphs: flag('graphs'), images: flag('images'),
    maxImages: Math.max(0, Math.min(MAX_IMAGES_CAP, raw.maxImages === undefined ? base.maxImages : Math.round(Number(raw.maxImages) || 0))),
  }
}

/** Ndovera's platform limits. */
export async function getPlatformMaterialAi(db: D1Database) {
  return cleanSettings(await readConfig(db, 'platform'), DEFAULT_MATERIAL_AI)
}

/**
 * What a school may use: its own choices, never beyond the platform's — a
 * school can switch off images or lower the number, not raise it.
 */
export async function getSchoolMaterialAi(db: D1Database, tenantId: string) {
  const platform = await getPlatformMaterialAi(db)
  const school = cleanSettings(await readConfig(db, `tenant:${tenantId}`), platform)
  return {
    ...school,
    tables: platform.tables && school.tables, formulae: platform.formulae && school.formulae, graphs: platform.graphs && school.graphs,
    images: platform.images && school.images, maxImages: Math.min(platform.maxImages, school.maxImages),
    platform,
  }
}

export async function saveMaterialAiConfig(db: D1Database, scope: 'platform' | `tenant:${string}`, input: Record<string, any>, actor: Actor) {
  await ensureCurriculumTables(db)
  const base = scope === 'platform' ? DEFAULT_MATERIAL_AI : await getPlatformMaterialAi(db)
  const settings = cleanSettings(input, base)
  await db.prepare(`INSERT INTO material_ai_config (scope, payload, updated_by, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(scope) DO UPDATE SET payload = excluded.payload, updated_by = excluded.updated_by, updated_at = excluded.updated_at`)
    .bind(scope, JSON.stringify(settings), actor.id, now()).run()
  return settings
}

/** The curricula a school's teachers are grounded in: the school's chosen ones, else its own, else every published Ndovera curriculum. */
export async function curriculaForSchool(db: D1Database, tenantId: string) {
  const [settings, available] = await Promise.all([getSchoolMaterialAi(db, tenantId), listCurricula(db, { tenantId })])
  const chosen = available.filter(item => settings.curriculumIds.includes(item.id))
  if (chosen.length) return chosen
  const own = available.filter(item => item.tenantId === tenantId)
  return own.length ? own : available
}

// ─── Resolver ────────────────────────────────────────────────────────────────

export const MATCH_THRESHOLD = 0.55

export type Resolution = {
  status: 'matched' | 'mismatch' | 'multiple' | 'not_found' | 'no_curriculum'
  message: string
  curricula: Array<{ id: string, name: string, owner: string }>
  chosenClass: ClassLevel
  match: (CurriculumTopic & { confidence: number, curriculumName: string }) | null
  matches: Array<CurriculumTopic & { confidence: number, curriculumName: string }>
}

/**
 * Where a topic sits in the school's curriculum. Every level the topic appears
 * at is returned (Fractions: Primary 3, 4, 5, 6), best match per level.
 */
export async function resolveTopic(db: D1Database, options: { tenantId: string, subject: string, topic: string, classLabel?: string, curriculumIds?: string[] }): Promise<Resolution> {
  const all = await curriculaForSchool(db, options.tenantId)
  const curricula = options.curriculumIds?.length ? all.filter(item => options.curriculumIds!.includes(item.id)) : all
  const chosenClass = normalizeClassLevel(options.classLabel)
  const base = { curricula: curricula.map(item => ({ id: item.id, name: item.name, owner: item.owner })), chosenClass, match: null, matches: [] }
  if (!curricula.length) {
    return { ...base, status: 'no_curriculum', message: 'Ndovera has no curriculum on file for your school yet, so this material will be written from the topic alone and labelled as not curriculum-checked.' }
  }
  const key = subjectKey(options.subject)
  const names = new Map(curricula.map(item => [item.id, item.name]))
  const rows = (await Promise.all(curricula.map(item => listCurriculumTopics(db, item.id, { subjectKey: key })))).flat()
  const scored = rows.map(row => ({ ...row, confidence: similarity(options.topic, row), curriculumName: names.get(row.curriculumId) || '' }))
    .filter(row => row.confidence >= MATCH_THRESHOLD)
    .sort((a, b) => b.confidence - a.confidence || a.classOrder - b.classOrder)
  // Best match per class level, in class order.
  const perLevel = new Map<string, typeof scored[number]>()
  for (const row of scored) if (!perLevel.has(row.classKey)) perLevel.set(row.classKey, row)
  const matches = [...perLevel.values()].sort((a, b) => a.classOrder - b.classOrder)
  const subjectName = options.subject || 'this subject'
  if (!matches.length) {
    return { ...base, matches, status: 'not_found', message: `"${options.topic}" was not found under ${subjectName} in the curriculum your school uses. You can choose another topic, or continue and Ndovera will label the material as not curriculum-checked.` }
  }
  if (chosenClass.key) {
    const here = matches.find(row => row.classKey === chosenClass.key)
    if (here) return { ...base, matches, match: here, status: 'matched', message: `Found under ${here.classLabel} ${here.subject}${here.theme ? ` — ${here.theme}` : ''} (${Math.round(here.confidence * 100)}% match).` }
    const where = matches.map(row => row.classLabel).join(', ')
    return { ...base, matches, status: 'mismatch', message: `Curriculum mismatch: "${options.topic}" was not found under ${chosenClass.label} ${subjectName} in the curriculum your school uses. It was found under ${where}.` }
  }
  if (matches.length === 1) {
    const only = matches[0]
    return { ...base, matches, match: only, status: 'matched', message: `"${options.topic}" is covered under ${only.classLabel} ${only.subject}${only.theme ? ` — ${only.theme}` : ''} in ${only.curriculumName} (${Math.round(only.confidence * 100)}% match).` }
  }
  return { ...base, matches, status: 'multiple', message: `This topic appears at several curriculum levels: ${matches.map(row => `${row.classLabel} — ${row.topic}`).join('; ')}. Choose the level you are teaching, or prepare progressive material across the levels.` }
}

export async function getCurriculumTopicsByIds(db: D1Database, ids: string[]) {
  await ensureCurriculumTables(db)
  if (!ids.length) return []
  const rows = await db.prepare(`SELECT * FROM curriculum_topics WHERE id IN (SELECT value FROM json_each(?)) ORDER BY class_order, position`).bind(JSON.stringify(ids.slice(0, 12))).all()
  return ((rows.results || []) as Record<string, any>[]).map(mapCurriculumTopic)
}

// ─── Examinations a teacher may choose, for a subject and level ─────────────

export type ExamOption = { key: string, label: string, body: string, grounded: boolean, specId: string, version: string, note: string }

export async function examOptionsFor(db: D1Database, subject: string, classLabel = ''): Promise<ExamOption[]> {
  const key = subjectKey(subject)
  const level = normalizeClassLevel(classLabel)
  const specs = (await listExamSpecs(db, { subjectKey: key })).filter(spec => isCurrent(spec))
  const options: ExamOption[] = []
  // Built-in examinations are decided by the catalogue alone (level, subject); the rest are Ndovera's additions.
  const seen = new Set<string>(EXAM_CATALOG.map(entry => entry.key))
  for (const entry of EXAM_CATALOG) {
    if (entry.subjects && !entry.subjects.includes(key)) continue
    if (level.key && !entry.sections.includes(level.section)) continue
    if (level.key && entry.minOrder && level.order < entry.minOrder) continue
    const spec = specs.find(item => item.examKey === entry.key)
    options.push({
      key: entry.key, label: entry.label, body: entry.body, grounded: Boolean(spec), specId: spec?.id || '', version: spec?.version || '',
      note: spec ? `${spec.name} ${spec.subject} — ${spec.version}` : 'No specification on file yet: practice will be general exam-style and its coverage is not verified.',
    })
  }
  // Examinations Ndovera has added beyond the built-in list.
  for (const spec of specs) {
    if (seen.has(spec.examKey)) continue
    seen.add(spec.examKey)
    options.push({ key: spec.examKey, label: spec.name || spec.examKey.toUpperCase(), body: spec.body, grounded: true, specId: spec.id, version: spec.version, note: `${spec.name} ${spec.subject} — ${spec.version}` })
  }
  return options
}

/**
 * For each chosen examination: its specification (if on file) and the spec
 * topics relevant to these curriculum topics — mapped ones first, else topics
 * whose names match the teacher's topic.
 */
export async function examGrounding(db: D1Database, options: { examKeys: string[], subject: string, topic: string, curriculumTopicIds: string[] }) {
  await ensureCurriculumTables(db)
  const result: Array<{ key: string, label: string, spec: ExamSpec | null, topics: Array<SpecTopic & { via: string }> }> = []
  for (const examKey of options.examKeys.slice(0, 4)) {
    const catalog = EXAM_CATALOG.find(entry => entry.key === examKey)
    const spec = await currentSpecFor(db, examKey, options.subject)
    if (!spec) { result.push({ key: examKey, label: catalog?.label || examKey.toUpperCase(), spec: null, topics: [] }); continue }
    const specTopics = await listSpecTopics(db, spec.id)
    let mapped: string[] = []
    if (options.curriculumTopicIds.length) {
      const rows = await db.prepare(`SELECT spec_topic_id FROM curriculum_exam_map WHERE curriculum_topic_id IN (SELECT value FROM json_each(?))`).bind(JSON.stringify(options.curriculumTopicIds)).all()
      mapped = ((rows.results || []) as Record<string, any>[]).map(row => String(row.spec_topic_id))
    }
    let topics: Array<SpecTopic & { via: string }> = specTopics.filter(topic => mapped.includes(topic.id)).map(topic => ({ ...topic, via: 'mapping' }))
    if (!topics.length) {
      topics = specTopics.map(topic => ({ ...topic, via: 'topic name', score: similarity(options.topic, { topic: topic.topic, keywords: topic.keywords, theme: topic.area }) }))
        .filter(topic => (topic as any).score >= 0.45).sort((a, b) => (b as any).score - (a as any).score).slice(0, 6)
    }
    result.push({ key: examKey, label: spec.name || catalog?.label || examKey.toUpperCase(), spec, topics })
  }
  return result
}

// ─── Exam Readiness ──────────────────────────────────────────────────────────

export type Evidence = { title: string, topic: string, percent: number, at: string }

/**
 * A student's readiness against a specification, from marked work only. Each
 * piece of evidence counts towards the spec topic it best matches; areas with
 * no marked work say so rather than guessing.
 */
export function readinessFor(specTopics: SpecTopic[], evidence: Evidence[], options: { attentionBelow?: number } = {}) {
  const attentionBelow = options.attentionBelow ?? 60
  const perTopic = new Map<string, number[]>()
  const unmatched: Evidence[] = []
  for (const item of evidence) {
    let best: SpecTopic | null = null
    let bestScore = 0
    for (const topic of specTopics) {
      const score = Math.max(similarity(item.topic || item.title, { topic: topic.topic, keywords: topic.keywords }), similarity(item.title, { topic: topic.topic, keywords: topic.keywords }) * 0.9)
      if (score > bestScore) { best = topic; bestScore = score }
    }
    if (!best || bestScore < 0.5) { unmatched.push(item); continue }
    perTopic.set(best.id, [...(perTopic.get(best.id) || []), item.percent])
  }
  const mean = (values: number[]) => Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
  const areas = new Map<string, { area: string, topics: Array<{ id: string, topic: string, percent: number | null, pieces: number }> }>()
  for (const topic of specTopics) {
    const area = topic.area || 'General'
    if (!areas.has(area)) areas.set(area, { area, topics: [] })
    const scores = perTopic.get(topic.id) || []
    areas.get(area)!.topics.push({ id: topic.id, topic: topic.topic, percent: scores.length ? mean(scores) : null, pieces: scores.length })
  }
  const areaList = [...areas.values()].map(area => {
    const scored = area.topics.filter(topic => topic.percent !== null)
    const pieces = scored.reduce((sum, topic) => sum + topic.pieces, 0)
    return { ...area, percent: scored.length ? mean(scored.map(topic => topic.percent as number)) : null, assessedTopics: scored.length, pieces }
  })
  const attention = areaList.flatMap(area => area.topics.filter(topic => topic.percent !== null && (topic.percent as number) < attentionBelow).map(topic => ({ ...topic, area: area.area })))
    .sort((a, b) => (a.percent as number) - (b.percent as number))
  const notAssessed = areaList.flatMap(area => area.topics.filter(topic => topic.percent === null).map(topic => ({ id: topic.id, topic: topic.topic, area: area.area })))
  const assessed = areaList.filter(area => area.percent !== null)
  return {
    overall: assessed.length ? mean(assessed.map(area => area.percent as number)) : null,
    areas: areaList, attention, notAssessed, unmatched: unmatched.length, evidenceCount: evidence.length - unmatched.length,
  }
}
