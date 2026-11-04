// Exams Ndovera builds because a school asked. Ami starts one from a request: its name, where it is sold, its
// price, and the curriculum's topics. The night builder writes questions from those topics like any other
// exam's syllabus, and the chief-examiner check marks them. Nobody can see or buy the exam until it has enough
// checked questions; then it goes on sale by itself, in its country or everywhere, and the people who asked are told.
//
// Cost: no AI beyond the night builder's existing cap. These exams take turns in that cap with the others.
// Reading the list: one query per worker every 5 minutes, at most MAX_EXAMS rows.

import { addSpecTopics, listExamSpecs, saveExamSpec, setExamSpecStatus } from './curriculumLibrary'
import { countryCode } from './countryPricing'
import { ensureExamRequestTables } from './examRequests'
import { subjectKeyOf } from './levels'
import { BUNDLES, EXAMS, EXAM_CORE, EXAM_KEYS, examCoreShort, examMinStock, examStock } from './practicePasses'

export class CustomExamError extends Error {
  status: number
  constructor(message: string, status = 400) { super(message); this.status = status }
}

const MAX_EXAMS = 30
const CACHE_MS = 5 * 60_000
const MAX_TOPICS_AT_ONCE = 500
const CORE_NEEDED = 30
export const CUSTOM_DEFAULTS = { mcqOptions: 4, mockQuestions: 50, mockMinutes: 60, priceNaira: 3000, minStock: 150 }
const SECTIONS = ['primary', 'junior', 'senior']
const ON_SALE_NOTE = 'It is on sale now. Students can buy the pass under Practice.'
const BUILDING_NOTE = 'Ndovera is writing the questions from the curriculum. It goes on sale when enough have been checked, and we will tell you.'
const clean = (value: unknown, limit: number) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, limit)

async function ensureTable(db: D1Database) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS custom_exams (key TEXT PRIMARY KEY, label TEXT NOT NULL, section TEXT NOT NULL, country TEXT NOT NULL DEFAULT '',
    mcq_options INTEGER NOT NULL, mock_questions INTEGER NOT NULL, mock_minutes INTEGER NOT NULL, price_naira INTEGER NOT NULL, min_stock INTEGER NOT NULL, core_json TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'building', created_by TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, live_at TEXT)`).run()
}

function forget() {
  for (const key of [...EXAM_KEYS]) {
    if (!EXAMS[key].custom) continue
    delete EXAMS[key]
    delete EXAM_CORE[key]
    delete (BUNDLES as any)[key]
    EXAM_KEYS.splice(EXAM_KEYS.indexOf(key), 1)
  }
}

/** Adds one exam, and its pass, to the lists everything else reads. */
function register(row: Record<string, any>) {
  const key = String(row.key)
  const label = String(row.label)
  EXAMS[key] = {
    label, section: String(row.section), standard: 'school', mcqOptions: Number(row.mcq_options), mockQuestions: Number(row.mock_questions), mockMinutes: Number(row.mock_minutes),
    style: `the ${label} examination${row.country ? ` (${row.country})` : ''}: its syllabus, its wording and its standard`,
    custom: true, live: row.status === 'live', paused: row.status === 'paused', country: String(row.country || ''), minStock: Number(row.min_stock),
  }
  let core: Record<string, number> = {}
  try { core = JSON.parse(String(row.core_json)) } catch { core = {} }
  EXAM_CORE[key] = core
  ;(BUNDLES as any)[key] = { label: `${label} Prep`, priceNaira: Number(row.price_naira), scope: 'year', levels: [], exams: [key], section: String(row.section), blurb: `All subjects, ${label} standard, timed mocks — 12 months` }
  EXAM_KEYS.push(key)
}

let loaded: { db: object, at: number } | null = null

export async function loadCustomExams(db: D1Database, force = false) {
  if (!force && loaded && loaded.db === db && Date.now() - loaded.at < CACHE_MS) return
  const sameDb = loaded?.db === db
  loaded = { db: db as object, at: Date.now() }
  try {
    const rows = await db.prepare(`SELECT * FROM custom_exams LIMIT ${MAX_EXAMS}`).all()
    forget()
    for (const row of (rows.results || []) as Record<string, any>[]) register(row)
  } catch (error) {
    // No table means no exam has been started. On any other failure, keep what we know and try again soon.
    if (/no such table/i.test(String((error as Error)?.message))) forget()
    else {
      if (!sameDb) forget()
      loaded = { db: db as object, at: Date.now() - CACHE_MS + 30_000 }
    }
  }
}

/** Exams on request that the night builder should be writing for. */
export const buildingExamKeys = () => EXAM_KEYS.filter(key => EXAMS[key].custom && !EXAMS[key].paused)

function whole(value: unknown, fallback: number, label: string, least: number, most: number) {
  const number = value === undefined || value === '' || value === null ? fallback : Number(value)
  if (!Number.isInteger(number) || number < least || number > most) throw new CustomExamError(`${label} must be a whole number from ${least} to ${most}.`)
  return number
}

const keyFor = (label: string) => `x_${label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 30)}`

export async function createCustomExam(db: D1Database, input: Record<string, any>, actor: string) {
  await ensureTable(db)
  await ensureExamRequestTables(db)
  const label = clean(input.label, 60)
  if (label.length < 2) throw new CustomExamError('Name the exam.')
  const key = keyFor(label)
  if (key === 'x_') throw new CustomExamError('Name the exam in letters or numbers.')
  const section = String(input.section || '')
  if (!SECTIONS.includes(section)) throw new CustomExamError('Choose Primary, Junior or Senior.')
  const typedCountry = clean(input.country, 80)
  const country = typedCountry ? countryCode(typedCountry) : ''
  if (typedCountry && !country) throw new CustomExamError('Choose the country from the list, or leave it empty for everyone.')
  const subjects = [...new Set(String(input.subjects || '').split(/[,\n]/).map(item => subjectKeyOf(item)).filter(Boolean))].slice(0, 20)
  if (!subjects.length) throw new CustomExamError('Name the main subjects, separated by commas.')
  const count = await db.prepare(`SELECT COUNT(*) AS n FROM custom_exams`).first() as Record<string, any> | null
  if (Number(count?.n || 0) >= MAX_EXAMS) throw new CustomExamError(`Ndovera can hold ${MAX_EXAMS} of these exams.`)
  if (await db.prepare(`SELECT 1 FROM custom_exams WHERE key = ?`).bind(key).first()) throw new CustomExamError('An exam with that name already exists.', 409)
  const minStock = whole(input.minStock, CUSTOM_DEFAULTS.minStock, 'Questions before sale', 30, 2000)
  const core = Object.fromEntries(subjects.map(subject => [subject, Math.min(CORE_NEEDED, Math.floor(minStock / subjects.length))]))
  const at = new Date().toISOString()
  await db.prepare(`INSERT INTO custom_exams (key, label, section, country, mcq_options, mock_questions, mock_minutes, price_naira, min_stock, core_json, status, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'building', ?, ?, ?)`)
    .bind(key, label, section, country, whole(input.mcqOptions, CUSTOM_DEFAULTS.mcqOptions, 'Options per question', 3, 5), whole(input.mockQuestions, CUSTOM_DEFAULTS.mockQuestions, 'Mock questions', 10, 200),
      whole(input.mockMinutes, CUSTOM_DEFAULTS.mockMinutes, 'Mock minutes', 10, 300), whole(input.priceNaira, CUSTOM_DEFAULTS.priceNaira, 'Price', 100, 100000), minStock, JSON.stringify(core), actor, at, at).run()
  await loadCustomExams(db, true)
  if (input.requestId) await linkRequestToExam(db, String(input.requestId), key, actor)
  return { key, label }
}

export async function listCustomExams(db: D1Database) {
  await ensureTable(db)
  const rows = await db.prepare(`SELECT * FROM custom_exams ORDER BY created_at DESC LIMIT ${MAX_EXAMS}`).all()
  const list = (rows.results || []) as Record<string, any>[]
  if (!list.length) return []
  await loadCustomExams(db, true)
  const [stock, short] = await Promise.all([examStock(db), examCoreShort(db)])
  const specs = await Promise.all(list.map(row => listExamSpecs(db, { examKey: String(row.key), includeDrafts: true })))
  return list.map((row, index) => ({
    key: String(row.key), label: String(row.label), section: String(row.section), country: String(row.country || ''), status: String(row.status), priceNaira: Number(row.price_naira),
    minStock: Number(row.min_stock), ready: stock[String(row.key)] || 0, stillNeeds: short[String(row.key)] || [],
    subjects: specs[index].map((spec: any) => ({ subject: spec.subject, topics: spec.topicCount, status: spec.status })),
  }))
}

export async function updateCustomExam(db: D1Database, key: string, input: Record<string, any>) {
  await ensureTable(db)
  const row = await db.prepare(`SELECT * FROM custom_exams WHERE key = ?`).bind(key).first() as Record<string, any> | null
  if (!row) throw new CustomExamError('Exam not found.', 404)
  const priceNaira = whole(input.priceNaira, Number(row.price_naira), 'Price', 100, 100000)
  const minStock = whole(input.minStock, Number(row.min_stock), 'Questions before sale', 30, 2000)
  // Stopping takes it off sale. Starting again goes back to building, and sale follows at the next check if there are enough questions.
  const status = input.status === 'paused' ? 'paused' : input.status === 'building' ? 'building' : String(row.status)
  await db.prepare(`UPDATE custom_exams SET price_naira = ?, min_stock = ?, status = ?, updated_at = ? WHERE key = ?`).bind(priceNaira, minStock, status, new Date().toISOString(), key).run()
  await loadCustomExams(db, true)
}

/** The curriculum, one topic a line. Plain text only, so this costs no AI. */
export async function addExamTopics(db: D1Database, key: string, input: Record<string, any>, actor: string) {
  await ensureTable(db)
  await loadCustomExams(db, true)
  const exam = EXAMS[key]
  if (!exam?.custom) throw new CustomExamError('Exam not found.', 404)
  const subject = clean(input.subject, 120)
  if (!subject) throw new CustomExamError('Name the subject.')
  const lines = String(input.topics || '').split('\n').map(line => clean(line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, ''), 240)).filter(line => line.length >= 3)
  if (!lines.length) throw new CustomExamError('Type the topics, one on each line.')
  if (lines.length > MAX_TOPICS_AT_ONCE) throw new CustomExamError(`Send up to ${MAX_TOPICS_AT_ONCE} topics at a time.`)
  const specs = await listExamSpecs(db, { examKey: key, subjectKey: subjectKeyOf(subject), includeDrafts: true })
  const spec = specs[0] || await saveExamSpec(db, { examKey: key, subject, name: exam.label, country: exam.country, version: 'From the curriculum the school sent' }, { actor: { id: actor } as any })
  const result = await addSpecTopics(db, spec.id, lines.map(topic => ({ topic })))
  await setExamSpecStatus(db, spec.id, 'published')
  return { subject, added: result.added }
}

/** Night check: exams with enough checked questions go on sale. Returns who to tell. One read when none are waiting. */
export async function promoteReadyExams(db: D1Database) {
  const waiting = await db.prepare(`SELECT key, label FROM custom_exams WHERE status = 'building' LIMIT ${MAX_EXAMS}`).all().catch(() => ({ results: [] }))
  const rows = (waiting.results || []) as Record<string, any>[]
  if (!rows.length) return []
  await loadCustomExams(db, true)
  await ensureExamRequestTables(db)
  const stock = await examStock(db)
  const ready: Array<{ key: string, label: string, requesters: Array<{ userId: string, tenantId: string }> }> = []
  for (const row of rows) {
    const key = String(row.key)
    if ((stock[key] || 0) < examMinStock(key)) continue
    const at = new Date().toISOString()
    await db.prepare(`UPDATE custom_exams SET status = 'live', live_at = ?, updated_at = ? WHERE key = ?`).bind(at, at, key).run()
    const asked = await db.prepare(`SELECT user_id, tenant_id FROM exam_requests WHERE custom_exam = ? AND status = 'building' LIMIT 100`).bind(key).all()
    await db.prepare(`UPDATE exam_requests SET status = 'ready', ami_note = ?, updated_at = ? WHERE custom_exam = ? AND status = 'building'`).bind(ON_SALE_NOTE, at, key).run()
    ready.push({ key, label: String(row.label), requesters: ((asked.results || []) as Record<string, any>[]).map(item => ({ userId: String(item.user_id), tenantId: String(item.tenant_id || '') })) })
  }
  if (ready.length) await loadCustomExams(db, true)
  return ready
}

/** A request joins the exam built for it. A second school asking for the same exam joins it too. */
export async function linkRequestToExam(db: D1Database, requestId: string, key: string, actor: string) {
  await ensureExamRequestTables(db)
  if (!EXAMS[key]?.custom) throw new CustomExamError('Exam not found.', 404)
  const live = Boolean(EXAMS[key].live)
  await db.prepare(`UPDATE exam_requests SET custom_exam = ?, status = ?, ami_note = ?, handled_by = ?, updated_at = ? WHERE id = ?`)
    .bind(key, live ? 'ready' : 'building', live ? ON_SALE_NOTE : BUILDING_NOTE, actor, new Date().toISOString(), requestId).run()
}
