// Mock papers: whole papers kept together, with an objectives part, a theory part and the
// time for each. Students choose objectives only, theory only, or both.
//
// Ami writes them with an AI assistant: the page gives a prompt, the reply is pasted back,
// checked here question by question, and saved as a draft. Nothing reaches students until
// Ami publishes it. Publishing also files the objectives in the bank, where the night's
// chief-examiner pass checks them like any other examination question.
//
// A question that needs a diagram says what to draw ("diagram" in the pasted reply). Ami attaches
// the image to the draft, and the paper cannot be published until every one is attached.
//
// The answers stay on the server until the student hands in. Theory is not marked by
// Ndovera: the student compares their work with the model answer and marking points.

import { GLOBAL_TENANT, ensurePracticeTables, upsertBankQuestions } from './practiceArena'
import { subjectKeyOf } from './levels'
import { EXAMS, PassError, normalizeExam } from './practicePasses'
import type { ExamKey } from './practicePasses'
import { examKeyOf, EXAM_RANK } from './practiceBuilder'

const MAX_OBJECTIVES = 200
const MAX_THEORY = 40
const ORIGIN = 'mock_paper'
export const MOCK_PAPER_PARTS = ['objective', 'theory', 'both'] as const
export type MockPaperPart = typeof MOCK_PAPER_PARTS[number]

const now = () => new Date().toISOString()
const newId = (prefix: string) => `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`
const parse = <T,>(value: unknown, fallback: T): T => { try { return value ? JSON.parse(String(value)) as T : fallback } catch { return fallback } }
const text = (value: unknown, limit = 6000) => String(value ?? '').trim().slice(0, limit)

const readyDbs = new WeakSet<object>()
export async function ensureMockPaperTables(db: D1Database) {
  if (readyDbs.has(db as object)) return
  for (const statement of [
    `CREATE TABLE IF NOT EXISTS mock_papers (
      id TEXT PRIMARY KEY, exam TEXT NOT NULL, subject_key TEXT NOT NULL, subject_name TEXT NOT NULL, set_label TEXT NOT NULL, section TEXT NOT NULL,
      objective_minutes INTEGER NOT NULL DEFAULT 0, theory_minutes INTEGER NOT NULL DEFAULT 0, instructions TEXT,
      objective_count INTEGER NOT NULL DEFAULT 0, theory_count INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'draft',
      created_by TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, published_at TEXT,
      UNIQUE (exam, subject_key, set_label))`,
    `CREATE INDEX IF NOT EXISTS idx_mock_papers_section ON mock_papers(section, status)`,
    `CREATE TABLE IF NOT EXISTS mock_paper_questions (
      id TEXT PRIMARY KEY, paper_id TEXT NOT NULL, part TEXT NOT NULL, position INTEGER NOT NULL, prompt TEXT NOT NULL, options_json TEXT,
      answer_index INTEGER, explanation TEXT, marks INTEGER NOT NULL DEFAULT 1, model_answer TEXT, marking_points_json TEXT, diagram_note TEXT, image_url TEXT)`,
    `CREATE INDEX IF NOT EXISTS idx_mock_paper_questions ON mock_paper_questions(paper_id, part, position)`,
    `CREATE TABLE IF NOT EXISTS mock_paper_attempts (id TEXT PRIMARY KEY, paper_id TEXT NOT NULL, student_id TEXT NOT NULL, part TEXT NOT NULL, score INTEGER NOT NULL, total INTEGER NOT NULL, created_at TEXT NOT NULL)`,
    `CREATE INDEX IF NOT EXISTS idx_mock_paper_attempts ON mock_paper_attempts(student_id, paper_id)`,
  ]) await db.prepare(statement).run()
  readyDbs.add(db as object)
}

// ─── Reading a pasted paper ──────────────────────────────────────────────────

type ParsedObjective = { prompt: string, options: string[], answerIndex: number, explanation: string, diagram: string }
type ParsedTheory = { prompt: string, marks: number, modelAnswer: string, markingPoints: string[], diagram: string }
export type ParsedMockPaper = {
  exam: ExamKey, subjectKey: string, subjectName: string, setLabel: string, instructions: string,
  objectiveMinutes: number, theoryMinutes: number, objectives: ParsedObjective[], theory: ParsedTheory[],
}

/** A reply from an AI assistant: often wrapped in a code fence or a sentence, sometimes with trailing commas. */
function readJson(raw: string) {
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  const body = raw.slice(start, end + 1)
  return parse<Record<string, any> | null>(body, null) || parse<Record<string, any> | null>(body.replace(/,(\s*[}\]])/g, '$1'), null)
}

function readOptions(value: unknown) {
  const list = Array.isArray(value) ? value : value && typeof value === 'object' ? Object.values(value as object) : []
  return list.map(option => text(option, 1500).replace(/^\(?[A-Ea-e][.)]\s+/, ''))
}

function readAnswer(value: unknown, options: string[]) {
  const answer = text(value, 1500)
  const letter = /^\(?([A-Ea-e])\)?[.)]?$/.exec(answer)
  if (letter) {
    const index = letter[1].toUpperCase().charCodeAt(0) - 65
    return index < options.length ? index : -1
  }
  return options.findIndex(option => option.toLowerCase() === answer.toLowerCase())
}

/** Check a pasted paper. Problems must be fixed before saving; warnings are for Ami to judge. */
export function parseMockPaper(raw: unknown) {
  const problems: string[] = []
  const warnings: string[] = []
  const data = readJson(String(raw ?? ''))
  if (!data) return { paper: null, problems: ['This could not be read. Paste the whole reply, and ask the assistant to return the JSON only.'], warnings }

  const exam = examKeyOf(data.exam) || normalizeExam(data.exam)
  if (!exam) problems.push('"exam" must be WAEC, NECO, JAMB, BECE or Common Entrance.')
  const subjectName = text(data.subject, 120)
  const subjectKey = subjectKeyOf(subjectName)
  if (!subjectKey) problems.push('"subject" is missing.')
  const setLabel = text(data.setLabel, 60)
  if (!setLabel) problems.push('"setLabel" is missing, for example "Mock 1".')

  const objectiveList = Array.isArray(data.objectives) ? data.objectives : []
  const theoryList = Array.isArray(data.theory) ? data.theory : []
  if (!objectiveList.length && !theoryList.length) problems.push('The paper has no questions.')
  if (objectiveList.length > MAX_OBJECTIVES) problems.push(`A paper can hold at most ${MAX_OBJECTIVES} objective questions.`)
  if (theoryList.length > MAX_THEORY) problems.push(`A paper can hold at most ${MAX_THEORY} theory questions.`)
  if (exam === 'jamb' && theoryList.length) problems.push('JAMB is objective only: remove the theory questions.')

  const seen = new Set<string>()
  const repeated = (prompt: string, label: string) => {
    const key = prompt.toLowerCase().replace(/\s+/g, ' ')
    if (seen.has(key)) problems.push(`${label}: this question appears twice.`)
    seen.add(key)
  }
  const flagged = (prompt: string, label: string, diagram: string) => {
    if (!diagram && /\b(diagram|figure|graph|table|chart|shown below|shown above)\b/i.test(prompt)) warnings.push(`${label} mentions a diagram or table but has no "diagram" description. Add one, or reword the question.`)
    if (/\b(past question|(waec|neco|jamb|utme|wassce|ssce)\s*(19|20)\d\d|(19|20)\d\d\s*(waec|neco|jamb|utme|wassce|ssce))\b/i.test(prompt)) warnings.push(`${label} looks like it came from a real past paper. Use original questions.`)
  }

  const expected = exam ? EXAMS[exam].mcqOptions : 0
  const objectives: ParsedObjective[] = objectiveList.slice(0, MAX_OBJECTIVES).map((item: any, index: number) => {
    const label = `Objective ${index + 1}`
    const prompt = text(item?.question ?? item?.prompt)
    const options = readOptions(item?.options)
    const answerIndex = readAnswer(item?.answer, options)
    const diagram = text(item?.diagram, 1000)
    if (!prompt) problems.push(`${label}: the question is missing.`)
    if (options.length < 2 || options.some(option => !option)) problems.push(`${label}: it needs at least two options, none of them empty.`)
    if (new Set(options.map(option => option.toLowerCase())).size !== options.length) problems.push(`${label}: two options are the same.`)
    if (answerIndex < 0) problems.push(`${label}: the answer must be one of its option letters.`)
    if (expected && options.length >= 2 && options.length !== expected) warnings.push(`${label} has ${options.length} options; ${EXAMS[exam as ExamKey].label} usually has ${expected}.`)
    if (prompt) { repeated(prompt, label); flagged(prompt, label, diagram) }
    return { prompt, options, answerIndex, explanation: text(item?.explanation, 2000), diagram }
  })

  const theory: ParsedTheory[] = theoryList.slice(0, MAX_THEORY).map((item: any, index: number) => {
    const label = `Theory ${index + 1}`
    const prompt = text(item?.question ?? item?.prompt)
    const modelAnswer = text(item?.modelAnswer ?? item?.answer, 8000)
    const marks = Math.floor(Number(item?.marks))
    const diagram = text(item?.diagram, 1000)
    if (!prompt) problems.push(`${label}: the question is missing.`)
    if (!modelAnswer) problems.push(`${label}: the model answer is missing.`)
    if (!(marks > 0)) problems.push(`${label}: "marks" must be a number above zero.`)
    if (prompt) { repeated(prompt, label); flagged(prompt, label, diagram) }
    const points = Array.isArray(item?.markingPoints) ? item.markingPoints.map((point: unknown) => text(point, 500)).filter(Boolean) : []
    return { prompt, marks: marks > 0 ? marks : 0, modelAnswer, markingPoints: points, diagram }
  })

  const objectiveMinutes = Math.floor(Number(data.objectiveMinutes))
  const theoryMinutes = Math.floor(Number(data.theoryMinutes))
  if (objectives.length && !(objectiveMinutes > 0)) problems.push('"objectiveMinutes" must be a number above zero.')
  if (theory.length && !(theoryMinutes > 0)) problems.push('"theoryMinutes" must be a number above zero.')

  if (problems.length || !exam) return { paper: null, problems, warnings }
  const paper: ParsedMockPaper = {
    exam, subjectKey, subjectName, setLabel, instructions: text(data.instructions, 2000),
    objectiveMinutes: objectives.length ? objectiveMinutes : 0, theoryMinutes: theory.length ? theoryMinutes : 0, objectives, theory,
  }
  return { paper, problems, warnings }
}

// ─── Keeping papers ──────────────────────────────────────────────────────────

function mapPaper(row: Record<string, any>) {
  return {
    id: String(row.id), exam: String(row.exam) as ExamKey, examLabel: EXAMS[String(row.exam) as ExamKey]?.label || String(row.exam),
    subjectKey: String(row.subject_key), subjectName: String(row.subject_name), setLabel: String(row.set_label), section: String(row.section),
    objectiveMinutes: Number(row.objective_minutes || 0), theoryMinutes: Number(row.theory_minutes || 0), instructions: String(row.instructions || ''),
    objectiveCount: Number(row.objective_count || 0), theoryCount: Number(row.theory_count || 0), status: String(row.status),
    createdBy: String(row.created_by || ''), createdAt: String(row.created_at || ''), publishedAt: row.published_at ? String(row.published_at) : null,
    diagramsMissing: Number(row.diagrams_missing || 0),
  }
}

export async function saveMockPaper(db: D1Database, paper: ParsedMockPaper, createdBy: string) {
  await ensureMockPaperTables(db)
  const taken = await db.prepare(`SELECT id FROM mock_papers WHERE exam = ? AND subject_key = ? AND set_label = ?`).bind(paper.exam, paper.subjectKey, paper.setLabel).first()
  if (taken) throw new PassError(`${EXAMS[paper.exam].label} ${paper.subjectName} already has a paper called "${paper.setLabel}". Change "setLabel", or delete the old one first.`, 409)
  const id = newId('mpap')
  const stamp = now()
  await db.prepare(`INSERT INTO mock_papers (id, exam, subject_key, subject_name, set_label, section, objective_minutes, theory_minutes, instructions, objective_count, theory_count, status, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?)`)
    .bind(id, paper.exam, paper.subjectKey, paper.subjectName, paper.setLabel, EXAMS[paper.exam].section, paper.objectiveMinutes, paper.theoryMinutes, paper.instructions, paper.objectives.length, paper.theory.length, createdBy, stamp, stamp).run()
  const insert = `INSERT INTO mock_paper_questions (id, paper_id, part, position, prompt, options_json, answer_index, explanation, marks, model_answer, marking_points_json, diagram_note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  const statements = [
    ...paper.objectives.map((item, index) => db.prepare(insert).bind(newId('mpq'), id, 'objective', index + 1, item.prompt, JSON.stringify(item.options), item.answerIndex, item.explanation, 1, null, null, item.diagram || null)),
    ...paper.theory.map((item, index) => db.prepare(insert).bind(newId('mpq'), id, 'theory', index + 1, item.prompt, null, null, null, item.marks, item.modelAnswer, JSON.stringify(item.markingPoints), item.diagram || null)),
  ]
  for (let at = 0; at < statements.length; at += 50) await db.batch(statements.slice(at, at + 50))
  return getMockPaper(db, id)
}

export async function listMockPapers(db: D1Database, filter: { section?: string, published?: boolean } = {}) {
  await ensureMockPaperTables(db)
  const where: string[] = []
  const binds: unknown[] = []
  if (filter.section) { where.push('section = ?'); binds.push(filter.section) }
  if (filter.published) where.push(`status = 'published'`)
  const rows = await db.prepare(`SELECT p.*, (SELECT COUNT(*) FROM mock_paper_questions q WHERE q.paper_id = p.id AND q.diagram_note IS NOT NULL AND q.image_url IS NULL) AS diagrams_missing FROM mock_papers p ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY exam, subject_name, set_label LIMIT 500`).bind(...binds).all()
  return ((rows.results || []) as Record<string, any>[]).map(mapPaper)
}

export async function getMockPaper(db: D1Database, id: string) {
  await ensureMockPaperTables(db)
  const row = await db.prepare(`SELECT * FROM mock_papers WHERE id = ?`).bind(id).first() as Record<string, any> | null
  if (!row) throw new PassError('That paper was not found.', 404)
  const rows = await db.prepare(`SELECT * FROM mock_paper_questions WHERE paper_id = ? ORDER BY part, position`).bind(id).all()
  const questions = ((rows.results || []) as Record<string, any>[]).map(item => ({
    id: String(item.id), part: String(item.part), position: Number(item.position), prompt: String(item.prompt), options: parse<string[]>(item.options_json, []),
    answerIndex: item.answer_index === null || item.answer_index === undefined ? null : Number(item.answer_index), explanation: String(item.explanation || ''),
    marks: Number(item.marks || 0), modelAnswer: String(item.model_answer || ''), markingPoints: parse<string[]>(item.marking_points_json, []),
    diagram: String(item.diagram_note || ''), imageUrl: String(item.image_url || ''),
  }))
  return { ...mapPaper(row), objectives: questions.filter(item => item.part === 'objective'), theory: questions.filter(item => item.part === 'theory') }
}

/** Publishing files the objectives in the bank for the night's check; withdrawing takes them out of practice. */
export async function setMockPaperStatus(db: D1Database, id: string, status: unknown) {
  if (status !== 'published' && status !== 'draft') throw new PassError('A paper is either published or a draft.')
  const paper = await getMockPaper(db, id)
  const stamp = now()
  // The night's check reads text only, so questions with a diagram stay in their paper.
  const withDiagram = paper.objectives.filter(item => item.diagram || item.imageUrl)
  if (status === 'published') {
    const missing = [
      ...paper.objectives.filter(item => item.diagram && !item.imageUrl).map(item => `Objective ${item.position}`),
      ...paper.theory.filter(item => item.diagram && !item.imageUrl).map(item => `Theory ${item.position}`),
    ]
    if (missing.length) throw new PassError(`Attach the diagrams before publishing: ${missing.join(', ')}.`, 409, { missing })
    await ensurePracticeTables(db)
    await upsertBankQuestions(db, paper.objectives.filter(item => !item.diagram && !item.imageUrl).map(item => ({
      tenantId: GLOBAL_TENANT, type: 'mcq', prompt: item.prompt, options: item.options, answer: item.answerIndex, explanation: item.explanation,
      subject: paper.subjectName, subjectKey: paper.subjectKey, section: paper.section, rank: EXAM_RANK[paper.section], topic: `${paper.subjectName} ${paper.setLabel}`,
      difficulty: 'external', exam: paper.exam, originType: ORIGIN, originId: paper.id, answerSource: 'ai', createdBy: paper.createdBy || 'Ami', status: 'approved',
    })))
  }
  await db.batch([
    db.prepare(`UPDATE mock_papers SET status = ?, published_at = ?, updated_at = ? WHERE id = ?`).bind(status, status === 'published' ? stamp : null, stamp, id),
    db.prepare(`UPDATE question_bank SET playable = ? WHERE origin_type = ? AND origin_id = ? AND COALESCE(quality, '') != 'rejected'`).bind(status === 'published' ? 1 : 0, ORIGIN, id),
    ...withDiagram.map(item => db.prepare(`UPDATE question_bank SET playable = 0 WHERE origin_type = ? AND origin_id = ? AND prompt = ?`).bind(ORIGIN, id, item.prompt)),
  ])
  return getMockPaper(db, id)
}

/** Attach or remove a question's diagram. A published paper is withdrawn first, so students never see one half-changed. */
export async function setMockPaperDiagram(db: D1Database, paperId: string, questionId: string, imageUrl: string | null) {
  const paper = await getMockPaper(db, paperId)
  if (paper.status === 'published') throw new PassError('Withdraw this paper before changing its diagrams.', 409)
  const question = [...paper.objectives, ...paper.theory].find(item => item.id === questionId)
  if (!question) throw new PassError('That question was not found.', 404)
  await db.prepare(`UPDATE mock_paper_questions SET image_url = ? WHERE id = ? AND paper_id = ?`).bind(imageUrl, questionId, paperId).run()
  return { paper: await getMockPaper(db, paperId), previous: question.imageUrl }
}

export async function deleteMockPaper(db: D1Database, id: string) {
  const paper = await getMockPaper(db, id)
  if (paper.status === 'published') throw new PassError('Withdraw this paper before deleting it.', 409)
  await db.batch([
    db.prepare(`DELETE FROM mock_paper_questions WHERE paper_id = ?`).bind(id),
    db.prepare(`DELETE FROM mock_papers WHERE id = ?`).bind(id),
  ])
}

// ─── Sitting a paper ─────────────────────────────────────────────────────────

export function readMockPaperPart(value: unknown): MockPaperPart {
  if (!(MOCK_PAPER_PARTS as readonly unknown[]).includes(value)) throw new PassError('Choose objectives, theory or both.')
  return value as MockPaperPart
}

function includedParts(paper: { objectiveCount: number, theoryCount: number }, part: MockPaperPart) {
  const objective = part !== 'theory'
  const theory = part !== 'objective'
  if (objective && !paper.objectiveCount) throw new PassError('This paper has no objective questions.')
  if (theory && !paper.theoryCount) throw new PassError('This paper has no theory questions.')
  return { objective, theory }
}

/** The paper as a student receives it: no answers until they hand in. */
export function mockPaperForStudent(paper: Awaited<ReturnType<typeof getMockPaper>>, part: MockPaperPart) {
  const { objective, theory } = includedParts(paper, part)
  return {
    id: paper.id, exam: paper.exam, examLabel: paper.examLabel, subjectName: paper.subjectName, setLabel: paper.setLabel, instructions: paper.instructions, part,
    minutes: (objective ? paper.objectiveMinutes : 0) + (theory ? paper.theoryMinutes : 0),
    objectives: objective ? paper.objectives.map(item => ({ id: item.id, position: item.position, prompt: item.prompt, options: item.options, imageUrl: item.imageUrl })) : [],
    theory: theory ? paper.theory.map(item => ({ id: item.id, position: item.position, prompt: item.prompt, marks: item.marks, imageUrl: item.imageUrl })) : [],
  }
}

/** Mark the objectives on the server, record the sitting, and release the answers. */
export async function markMockPaper(db: D1Database, paper: Awaited<ReturnType<typeof getMockPaper>>, studentId: string, part: MockPaperPart, answers: unknown) {
  const { objective, theory } = includedParts(paper, part)
  const chosen = answers && typeof answers === 'object' ? answers as Record<string, unknown> : {}
  const objectives = objective ? paper.objectives.map(item => {
    const raw = chosen[item.id]
    const picked = raw === null || raw === undefined || raw === '' ? null : Number(raw)
    return { id: item.id, position: item.position, prompt: item.prompt, imageUrl: item.imageUrl, options: item.options, picked, answerIndex: item.answerIndex, correct: picked === item.answerIndex, explanation: item.explanation }
  }) : []
  const score = objectives.filter(item => item.correct).length
  await db.prepare(`INSERT INTO mock_paper_attempts (id, paper_id, student_id, part, score, total, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .bind(newId('mpat'), paper.id, studentId, part, score, objectives.length, now()).run()
  return {
    score, total: objectives.length, objectives,
    theory: theory ? paper.theory.map(item => ({ id: item.id, position: item.position, prompt: item.prompt, imageUrl: item.imageUrl, marks: item.marks, modelAnswer: item.modelAnswer, markingPoints: item.markingPoints })) : [],
  }
}
