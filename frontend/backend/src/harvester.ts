// The harvester: gathers every question given in Ndovera into the question bank,
// and keeps an Ndovera copy of every material as well-formatted notes.
//
// Sources                         What is taken
//   assignments                   their questions (released after the due date)
//   Ndovera AI assessments        their questions (exams/tests: after the exam)
//   materials                     a formatted Ndovera note copy; their questions;
//                                 uploaded PDF/Word files are read too
//   teacher submissions           questions in exam/test papers and lesson notes,
//                                 typed or uploaded (exam papers: after the exam)
//   Ami's question documents      every question, with the section Ami chose
//
// When: every minute the cron picks up whatever changed since last time, so a new
// question reaches the bank within about a minute. Every night at midnight (Lagos)
// a full sweep goes through everything again, a page at a time, to catch edits
// and to re-check when held-back exam questions may be released.
//
// Each run does a little (the Worker has a small CPU budget per run); documents
// are read a step at a time, like curriculum PDF imports. Questions that came
// without an answer key are given one by Ndovera AI once, and it is stored.

import { parsePaperText, needsAiHelp, AI_IMPORT_SYSTEM, importFromAiReply } from './paperImport'
import type { ImportedQuestion } from './paperImport'
import { levelOf } from './levels'
import { ensurePracticeTables, upsertBankQuestions, classifyLegacyQuestions, bankType, normalizeText, GLOBAL_TENANT, countNewlyPlayable } from './practiceArena'
import type { BankInput } from './practiceArena'
import { seedQuantReasoningBank } from './quantReasoning'
import { seedVerbalReasoningBank } from './verbalReasoning'

export type AiRunner = (messages: Array<{ role: string, content: string }>, options: { maxTokens: number, temperature: number }) => Promise<string>
export type HarvestDeps = {
  db: D1Database
  bucket?: { get(key: string): Promise<any>, put(key: string, value: any, options?: any): Promise<any> } | null
  /** File bytes → text (Markdown). */
  toText?: ((bytes: ArrayBuffer, fileName: string, contentType: string) => Promise<string>) | null
  runAi?: AiRunner | null
  now?: Date
}

export class HarvestError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

const iso = (deps: HarvestDeps) => (deps.now || new Date()).toISOString()
const parse = <T,>(value: unknown, fallback: T): T => { try { return value ? JSON.parse(String(value)) as T : fallback } catch { return fallback } }
const DAY = 86400000
export const MAX_DOC_BYTES = 20 * 1024 * 1024
const DOC_LOCK_MS = 3 * 60 * 1000
const DOC_MAX_ATTEMPTS = 4
const READABLE = /\.(pdf|docx?|odt|rtf|txt|md|markdown|html?)$/i

const readyDbs = new WeakSet<object>()
export async function ensureHarvestTables(db: D1Database) {
  if (readyDbs.has(db as object)) return
  await ensurePracticeTables(db)
  for (const statement of [
    `CREATE TABLE IF NOT EXISTS harvest_state (key TEXT PRIMARY KEY, value TEXT, updated_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS harvest_log (
      source_type TEXT NOT NULL, source_id TEXT NOT NULL, tenant_id TEXT, signature TEXT, questions INTEGER DEFAULT 0, status TEXT, error TEXT, harvested_at TEXT,
      PRIMARY KEY (source_type, source_id)
    )`,
    `CREATE TABLE IF NOT EXISTS harvest_documents (
      id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, origin_type TEXT NOT NULL, origin_id TEXT NOT NULL, file_key TEXT NOT NULL, file_name TEXT, content_type TEXT,
      defaults_json TEXT, make_note INTEGER NOT NULL DEFAULT 0, questions_expected INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'queued',
      text_key TEXT, text_inline TEXT, offset INTEGER DEFAULT 0, total INTEGER DEFAULT 0, added INTEGER DEFAULT 0, attempts INTEGER DEFAULT 0, error TEXT,
      locked_until TEXT, created_by TEXT, created_by_name TEXT, created_at TEXT, updated_at TEXT, finished_at TEXT
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_harvest_documents_origin ON harvest_documents(origin_type, origin_id, file_key)`,
    `CREATE INDEX IF NOT EXISTS idx_harvest_documents_status ON harvest_documents(status, updated_at)`,
    `CREATE TABLE IF NOT EXISTS ndovera_notes (
      id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, material_id TEXT NOT NULL UNIQUE, class_id TEXT, subject_id TEXT, subject_name TEXT, topic TEXT, title TEXT,
      markdown TEXT NOT NULL, word_count INTEGER DEFAULT 0, source TEXT, source_url TEXT, visibility TEXT, release_at TEXT, created_at TEXT, updated_at TEXT
    )`,
    `CREATE INDEX IF NOT EXISTS idx_ndovera_notes_class ON ndovera_notes(tenant_id, class_id, updated_at)`,
  ]) await db.prepare(statement).run()
  readyDbs.add(db as object)
}

async function getState(db: D1Database, key: string) {
  const row = await db.prepare(`SELECT value FROM harvest_state WHERE key = ?`).bind(key).first() as Record<string, any> | null
  return row ? String(row.value || '') : ''
}
async function setState(db: D1Database, key: string, value: string) {
  await db.prepare(`INSERT INTO harvest_state (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`)
    .bind(key, value, new Date().toISOString()).run()
}

async function digest(text: string) {
  const bytes = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(bytes)).map(value => value.toString(16).padStart(2, '0')).join('')
}

// ─── Formatting notes ────────────────────────────────────────────────────────

/**
 * Text read from a PDF or Word file → tidy Markdown: no PDF metadata or page
 * furniture, paragraphs joined, headings and lists recognised. Wording is kept.
 */
export function tidyMarkdown(source: string) {
  let text = String(source || '').replace(/\r\n?/g, '\n')
  // Workers AI prefixes PDFs with a metadata block and page headings.
  text = text.replace(/^#{1,3}\s*Metadata\s*\n(?:[-*].*\n|\s*\n)*/im, '').replace(/^#{1,4}\s*Contents\s*$/gim, '').replace(/^#{1,4}\s*Page\s+\d+\s*$/gim, '')
  const lines = text.split('\n').map(line => line.replace(/\s+$/, '').replace(/ /g, ' '))
  const out: string[] = []
  let paragraph = ''
  const flush = () => { if (paragraph.trim()) out.push(paragraph.trim()); paragraph = '' }
  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index]
    const line = raw.trim()
    if (!line) { flush(); if (out.length && out[out.length - 1] !== '') out.push(''); continue }
    if (/^\s*(page\s*)?\d{1,4}(\s*(of|\/)\s*\d{1,4})?\s*$/i.test(line)) continue
    if (/^#{1,6}\s/.test(line) || /^\|/.test(line) || /^```/.test(line) || /^\$\$/.test(line) || /^>/.test(line)) { flush(); out.push(line); continue }
    const bullet = line.match(/^[•▪●◦○■□➢➤►✓✔\-*–]\s*(.+)$/)
    if (bullet) { flush(); out.push(`- ${bullet[1]}`); continue }
    const numbered = line.match(/^(\(?\d{1,2}[.)]|\(?[a-h][.)]|\(?[ivx]{1,4}[.)])\s+(.+)$/i)
    if (numbered) { flush(); out.push(`${/^\(?\d/.test(numbered[1]) ? `${numbered[1].replace(/[()]/g, '').replace(/\)$/, '.')}` : `- **${numbered[1]}**`} ${numbered[2]}`); continue }
    const words = line.split(/\s+/).length
    const isCaps = /[A-Z]/.test(line) && line === line.toUpperCase() && /[A-Z]{3}/.test(line)
    const sectionNumber = line.match(/^(\d+(?:\.\d+){1,3})\s+([A-Z].{2,80})$/)
    if (words <= 10 && isCaps && !/[.,;]$/.test(line)) { flush(); out.push(`## ${line.charAt(0) + line.slice(1).toLowerCase()}`); continue }
    if (sectionNumber) { flush(); out.push(`### ${sectionNumber[1]} ${sectionNumber[2]}`); continue }
    if (words <= 8 && /:$/.test(line)) { flush(); out.push(`**${line}**`); continue }
    // Lines broken by the page width are one paragraph; a hyphen at a break joins a word.
    paragraph = paragraph ? (paragraph.endsWith('-') ? `${paragraph.slice(0, -1)}${line}` : `${paragraph} ${line}`) : line
  }
  flush()
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

function hasStructure(markdown: string) {
  return (markdown.match(/^#{2,3}\s/gm) || []).length >= 2 || (markdown.match(/^(- |\d+\.)/gm) || []).length >= 4
}

export const FORMAT_NOTES_SYSTEM = [
  'You format a teacher\'s class notes as clean Markdown for students to read on a phone.',
  'Do not add, remove, correct or reword anything: keep every word as written. Only add structure:',
  '## headings for main parts, ### for sub-parts, bullet or numbered lists where the text lists things, **bold** for defined terms,',
  'Markdown tables for tabular data, and LaTeX \\( \\) for formulas. Return only the Markdown.',
].join('\n')

/** Material blocks (from the editor or Ndovera AI) → Markdown for the Ndovera copy. */
export function blocksToMarkdown(blocks: Array<Record<string, any>>) {
  const out: string[] = []
  const items = (block: Record<string, any>) => (Array.isArray(block.items) ? block.items : []).map((item: unknown, index: number) => `${block.ordered ? `${index + 1}.` : '-'} ${String(item)}`).join('\n')
  for (const block of Array.isArray(blocks) ? blocks : []) {
    const text = String(block?.text || '').trim()
    switch (block?.type) {
      case 'heading': out.push(`## ${text}`); break
      case 'subheading': out.push(`### ${text}`); break
      case 'exam_tip': out.push(`> 💡 **Exam tip:** ${text}`); break
      case 'common_mistake': out.push(`> ⚠️ **Common mistake:** ${text}`); break
      case 'note': out.push(`> 📝 ${text}`); break
      case 'list': case 'summary': case 'exercise': out.push([text ? (block.type === 'summary' ? `**Summary:** ${text}` : text) : '', items(block)].filter(Boolean).join('\n\n')); break
      case 'worked_example': out.push([`**Worked example.** ${text}`, items(block)].filter(Boolean).join('\n\n')); break
      case 'flashcard': out.push(`**Q:** ${text}\n\n**A:** ${String(block.answer || '')}`); break
      case 'question': out.push([text, (Array.isArray(block.items) ? block.items : []).map((option: unknown, index: number) => `${String.fromCharCode(65 + index)}. ${String(option)}`).join('\n'), block.answer ? `> ${String(block.answer).replace(/\n/g, '\n> ')}` : ''].filter(Boolean).join('\n\n')); break
      default: if (text) out.push(text)
    }
  }
  return out.filter(Boolean).join('\n\n').trim()
}

async function saveNote(db: D1Database, note: { tenantId: string, materialId: string, classId: string, subjectId: string, subjectName: string, topic: string, title: string, markdown: string, source: string, sourceUrl: string, visibility: string, releaseAt: string | null }) {
  const markdown = String(note.markdown || '').trim()
  if (markdown.length < 40) return null
  const stamp = new Date().toISOString()
  await db.prepare(`INSERT INTO ndovera_notes (id, tenant_id, material_id, class_id, subject_id, subject_name, topic, title, markdown, word_count, source, source_url, visibility, release_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(material_id) DO UPDATE SET class_id = excluded.class_id, subject_id = excluded.subject_id, subject_name = excluded.subject_name, topic = excluded.topic,
    title = excluded.title, markdown = excluded.markdown, word_count = excluded.word_count, source = excluded.source, source_url = excluded.source_url,
    visibility = excluded.visibility, release_at = excluded.release_at, updated_at = excluded.updated_at`).bind(
    `note_${note.materialId}`, note.tenantId, note.materialId, note.classId, note.subjectId, note.subjectName, note.topic.slice(0, 200), note.title.slice(0, 200),
    markdown.slice(0, 400_000), markdown.split(/\s+/).length, note.source, note.sourceUrl, note.visibility, note.releaseAt, stamp, stamp).run()
  return `note_${note.materialId}`
}

// ─── Questions from what teachers wrote ───────────────────────────────────────

const COMMAND = /^(define|explain|state|list|calculate|what|why|how|when|where|which|who|describe|mention|name|give|find|solve|evaluate|simplify|discuss|outline|differentiate|distinguish|compare|identify|write|draw|show|prove|determine|convert|express|complete|fill|choose|match|is|are|does|do|can)\b/i

/** A line from a notes document that is really a question, not a numbered heading. */
export function looksLikeQuestion(question: ImportedQuestion) {
  const prompt = String(question.prompt || '').trim()
  if (prompt.length < 8) return false
  if ((question.type === 'mcq' || question.type === 'truefalse') && question.options.length >= 2) return true
  if (question.parts.length) return true
  return /\?\s*$/.test(prompt) || COMMAND.test(prompt) || /_{3,}|\.{4,}/.test(prompt)
}

type Context = { tenantId: string, subject: string, subjectId: string, classId: string, classLevel: string, section?: string, rank?: number | null, topic?: string, originType: string, originId: string, releaseAt: string | null, createdBy?: string, exactRelease?: boolean }

/** paperImport's reading of a paper → bank questions. */
export function importedToBank(questions: ImportedQuestion[], context: Context, filter = false): BankInput[] {
  return questions.filter(question => !filter || looksLikeQuestion(question)).map(question => {
    const parts = question.parts.length ? `\n\n${question.parts.map(part => `(${part.label}) ${part.prompt}`).join('\n')}` : ''
    const objective = question.type === 'mcq' || question.type === 'truefalse'
    const type = objective ? question.type : question.type === 'fill' ? 'fillgaps' : question.type === 'short' ? 'shortanswer' : 'essay'
    return {
      ...context, type, prompt: `${question.prompt}${parts}`, options: objective ? question.options : [],
      answer: objective ? (question.answerIndex >= 0 ? question.options[question.answerIndex] : '') : question.answer || '',
    }
  })
}

/** An Ndovera AI assessment question → a bank question. */
function assessmentQuestionToBank(question: Record<string, any>, context: Context): BankInput {
  const type = String(question.type || 'short')
  const options = Array.isArray(question.options) ? question.options : []
  const parts = Array.isArray(question.parts) ? question.parts : []
  const objective = type === 'mcq' || type === 'truefalse'
  const modelAnswer = [question.answer, ...(Array.isArray(question.workingSteps) ? question.workingSteps : []),
    ...parts.map((part: any) => `(${part.label}) ${[part.answer, ...(part.markingPoints || [])].filter(Boolean).join(' — ')}`),
    ...(Array.isArray(question.markingPoints) && question.markingPoints.length ? [`Marking points: ${question.markingPoints.join('; ')}`] : [])].filter(Boolean).join('\n')
  return {
    ...context, topic: String(question.topic || context.topic || ''),
    type: objective ? type : type === 'fill' ? 'fillgaps' : type === 'short' && String(question.answer || '').split(/\s+/).length <= 6 ? 'shortanswer' : 'essay',
    prompt: `${String(question.prompt || '')}${parts.length ? `\n\n${parts.map((part: any) => `(${part.label}) ${part.prompt}`).join('\n')}` : ''}`,
    options: objective ? options : [],
    answer: objective ? (Number(question.answerIndex) >= 0 ? options[Number(question.answerIndex)] : '') : type === 'short' || type === 'fill' ? [question.answer, ...(question.alternatives || [])].filter(Boolean) : modelAnswer,
    explanation: Array.isArray(question.workingSteps) ? question.workingSteps.join('\n') : '',
  }
}

/** A question saved in an assignment (any of the shapes the classroom has used). */
function assignmentQuestionToBank(raw: Record<string, any>, context: Context): BankInput | null {
  if (!raw || typeof raw !== 'object') return null
  const prompt = String(raw.prompt || raw.text || raw.question || '').trim()
  if (!prompt) return null
  const type = bankType(raw.type || (Array.isArray(raw.options || raw.choices) && (raw.options || raw.choices).length ? 'mcq' : 'shortanswer'))
  const options = (Array.isArray(raw.options) ? raw.options : Array.isArray(raw.choices) ? raw.choices : []).map((option: any) => typeof option === 'object' ? String(option?.text || option?.label || '') : String(option || ''))
  let answer: unknown = raw.answer ?? raw.correctAnswer ?? raw.correct ?? raw.acceptedAnswers ?? ''
  if (typeof raw.correctIndex === 'number' && options[raw.correctIndex]) answer = options[raw.correctIndex]
  if (typeof raw.answerIndex === 'number' && raw.answerIndex >= 0 && options[raw.answerIndex]) answer = options[raw.answerIndex]
  return {
    ...context, type, prompt, options, answer, pairs: Array.isArray(raw.pairs) ? raw.pairs : undefined,
    explanation: String(raw.explanation || raw.markingGuide || raw.solution || ''), passage: String(raw.passage || raw.metadata?.passage || ''),
    imageUrl: String(raw.imageUrl || raw.image || ''), topic: String(raw.topic || context.topic || ''),
  }
}

// ─── Release dates: exam questions wait until the exam is over ────────────────

async function termEnd(db: D1Database, tenantId: string) {
  const row = await db.prepare(`SELECT end_date FROM academic_terms WHERE tenant_id = ? AND status = 'active' LIMIT 1`).bind(tenantId).first().catch(() => null) as Record<string, any> | null
  const value = String(row?.end_date || '').trim()
  return /^\d{4}-\d{2}-\d{2}/.test(value) ? new Date(`${value.slice(0, 10)}T23:59:00+01:00`).toISOString() : ''
}

/** When exam questions may be practised: six hours after the sitting closes, else after the term, else four months on. */
export async function examReleaseAt(db: D1Database, input: { tenantId: string, assessmentId?: string, classId?: string, subjectId?: string, createdAt?: string }) {
  const sitting = input.assessmentId
    ? await db.prepare(`SELECT MAX(COALESCE(closes_at, opens_at)) AS closes FROM exam_sittings WHERE tenant_id = ? AND assessment_id = ?`).bind(input.tenantId, input.assessmentId).first().catch(() => null) as Record<string, any> | null
    : await db.prepare(`SELECT MAX(COALESCE(closes_at, opens_at)) AS closes FROM exam_sittings WHERE tenant_id = ? AND class_id = ? AND subject_id = ? AND created_at >= ?`)
      .bind(input.tenantId, input.classId || '', input.subjectId || '', input.createdAt || '').first().catch(() => null) as Record<string, any> | null
  const closes = Date.parse(String(sitting?.closes || ''))
  if (Number.isFinite(closes)) return new Date(closes + 6 * 3600000).toISOString()
  const end = await termEnd(db, input.tenantId)
  if (end && Date.parse(end) > Date.parse(input.createdAt || '') ) return end
  return new Date((Date.parse(input.createdAt || '') || Date.now()) + 120 * DAY).toISOString()
}

const future = (value: unknown, nowIso: string) => {
  const text = String(value || '').trim()
  return text && Date.parse(text) > Date.parse(nowIso) ? new Date(Date.parse(text)).toISOString() : null
}

// ─── Sources ─────────────────────────────────────────────────────────────────

type SourceRow = Record<string, any>
type Harvested = { questions: BankInput[], documents: Array<{ fileKey: string, fileName: string, contentType: string, makeNote: boolean, questionsExpected: boolean, defaults: Context }>, note?: Parameters<typeof saveNote>[1] | null, signatureExtra?: string }

function fileKeyOf(url: unknown) {
  const text = String(url || '').trim()
  const match = text.match(/\/files\/(.+)$/)
  if (!match) return ''
  try { return decodeURIComponent(match[1].split('?')[0]) } catch { return match[1].split('?')[0] }
}

function className(row: SourceRow) {
  return `${String(row.class_name || '').trim()}${row.class_arm ? ` ${String(row.class_arm).trim()}` : ''}`.trim()
}

type Source = {
  type: string
  /** Rows changed after (stamp, id), oldest first. */
  changed: (db: D1Database, stamp: string, id: string, limit: number) => Promise<SourceRow[]>
  /** Every row after `id`, for the nightly sweep. */
  all: (db: D1Database, id: string, limit: number) => Promise<SourceRow[]>
  stamp: (row: SourceRow) => string
  harvest: (deps: HarvestDeps, row: SourceRow) => Promise<Harvested | null>
}

const rowsOf = async (statement: D1PreparedStatement) => ((await statement.all().catch(() => ({ results: [] }))).results || []) as SourceRow[]

const assignmentsSource: Source = {
  type: 'assignment',
  changed: (db, stamp, id, limit) => rowsOf(db.prepare(`SELECT a.*, COALESCE(a.updatedAt, a.createdAt, '') AS stamp, c.tenantId AS tenant_id, c.name AS class_name, c.arm AS class_arm
    FROM assignments a INNER JOIN classes c ON c.id = a.classId WHERE (COALESCE(a.updatedAt, a.createdAt, '') > ? OR (COALESCE(a.updatedAt, a.createdAt, '') = ? AND a.id > ?))
    ORDER BY COALESCE(a.updatedAt, a.createdAt, ''), a.id LIMIT ?`).bind(stamp, stamp, id, limit)),
  all: (db, id, limit) => rowsOf(db.prepare(`SELECT a.*, COALESCE(a.updatedAt, a.createdAt, '') AS stamp, c.tenantId AS tenant_id, c.name AS class_name, c.arm AS class_arm
    FROM assignments a INNER JOIN classes c ON c.id = a.classId WHERE a.id > ? ORDER BY a.id LIMIT ?`).bind(id, limit)),
  stamp: row => String(row.stamp || ''),
  async harvest(deps, row) {
    const metadata = parse<Record<string, any>>(row.metadata, {})
    // Answers to homework stay hidden from practice until the work is due.
    const releaseAt = [future(row.dueAt, iso(deps)), future(metadata.releaseAt, iso(deps))].filter(Boolean).sort().pop() || null
    const context: Context = { tenantId: String(row.tenant_id), subject: String(row.subjectName || ''), subjectId: String(row.subjectId || ''), classId: String(row.classId || ''), classLevel: className(row), topic: String(metadata.topic || ''), originType: 'assignment', originId: String(row.id), releaseAt, createdBy: String(row.createdBy || '') }
    const questions = parse<any[]>(row.questionPayload, []).map(question => assignmentQuestionToBank(question, context)).filter(Boolean) as BankInput[]
    const files = [...(Array.isArray(metadata.attachments) ? metadata.attachments : []), ...(Array.isArray(metadata.files) ? metadata.files : [])]
    const documents = files.map((file: any) => ({ fileKey: fileKeyOf(file?.url), fileName: String(file?.name || ''), contentType: String(file?.type || ''), makeNote: false, questionsExpected: true, defaults: context }))
      .filter(doc => doc.fileKey && READABLE.test(doc.fileName || doc.fileKey))
    return { questions, documents, signatureExtra: releaseAt || '' }
  },
}

const assessmentsSource: Source = {
  type: 'ai_assessment',
  changed: (db, stamp, id, limit) => rowsOf(db.prepare(`SELECT * FROM ai_assessments WHERE status != 'draft' AND (updated_at > ? OR (updated_at = ? AND id > ?)) ORDER BY updated_at, id LIMIT ?`).bind(stamp, stamp, id, limit)),
  all: (db, id, limit) => rowsOf(db.prepare(`SELECT * FROM ai_assessments WHERE status != 'draft' AND id > ? ORDER BY id LIMIT ?`).bind(id, limit)),
  stamp: row => String(row.updated_at || ''),
  async harvest(deps, row) {
    const kind = String(row.kind || 'quiz')
    let releaseAt: string | null = null
    if (kind === 'exam' || kind === 'test') {
      releaseAt = await examReleaseAt(deps.db, { tenantId: String(row.tenant_id), assessmentId: String(row.id), createdAt: String(row.created_at || '') })
    } else if (row.posted_assignment_id) {
      const assignment = await deps.db.prepare(`SELECT dueAt FROM assignments WHERE id = ?`).bind(String(row.posted_assignment_id)).first().catch(() => null) as Record<string, any> | null
      releaseAt = future(assignment?.dueAt, iso(deps))
    } else {
      releaseAt = new Date(Date.parse(iso(deps)) + 14 * DAY).toISOString()
    }
    releaseAt = releaseAt && Date.parse(releaseAt) > Date.parse(iso(deps)) ? releaseAt : null
    const context: Context = { tenantId: String(row.tenant_id), subject: String(row.subject_name || ''), subjectId: String(row.subject_id || ''), classId: String(row.class_id || ''), classLevel: String(row.class_name || ''), originType: kind === 'exam' || kind === 'test' ? 'exam_paper' : 'ai_assessment', originId: String(row.id), releaseAt, createdBy: String(row.created_by || ''), exactRelease: kind === 'exam' || kind === 'test' }
    return { questions: parse<any[]>(row.questions_json, []).map(question => assessmentQuestionToBank(question, context)), documents: [], signatureExtra: releaseAt || '' }
  },
}

const materialsSource: Source = {
  type: 'material',
  changed: (db, stamp, id, limit) => rowsOf(db.prepare(`SELECT m.*, COALESCE(m.uploadedAt, '') AS stamp, c.tenantId AS tenant_id, c.name AS class_name, c.arm AS class_arm
    FROM materials m INNER JOIN classes c ON c.id = m.classId WHERE (COALESCE(m.uploadedAt, '') > ? OR (COALESCE(m.uploadedAt, '') = ? AND m.id > ?))
    ORDER BY COALESCE(m.uploadedAt, ''), m.id LIMIT ?`).bind(stamp, stamp, id, limit)),
  all: (db, id, limit) => rowsOf(db.prepare(`SELECT m.*, COALESCE(m.uploadedAt, '') AS stamp, c.tenantId AS tenant_id, c.name AS class_name, c.arm AS class_arm
    FROM materials m INNER JOIN classes c ON c.id = m.classId WHERE m.id > ? ORDER BY m.id LIMIT ?`).bind(id, limit)),
  stamp: row => String(row.stamp || ''),
  async harvest(deps, row) {
    const metadata = parse<Record<string, any>>(row.metadata, {})
    if (String(metadata.status || '') === 'draft' || metadata.deletedAt || metadata.archived) return null
    const visibility = String(metadata.visibility || 'student_parent')
    if (!/student/.test(visibility)) return null
    const releaseAt = future(metadata.releaseAt, iso(deps))
    const context: Context = { tenantId: String(row.tenant_id), subject: String(metadata.subjectName || ''), subjectId: String(metadata.subjectId || ''), classId: String(row.classId || ''), classLevel: className(row), topic: String(metadata.topic || ''), originType: 'material', originId: String(row.id), releaseAt, createdBy: String(metadata.uploadedById || '') }
    const noteBase = { tenantId: context.tenantId, materialId: String(row.id), classId: context.classId, subjectId: context.subjectId, subjectName: context.subject, topic: context.topic || '', title: String(row.title || 'Notes'), sourceUrl: String(row.url || ''), visibility, releaseAt }
    const questions: BankInput[] = []
    let note: Harvested['note'] = null
    const blocks = Array.isArray(metadata.blocks) ? metadata.blocks : []
    if (blocks.length) {
      note = { ...noteBase, markdown: `# ${noteBase.title}\n\n${blocksToMarkdown(blocks)}`, source: 'blocks' }
      // Ndovera AI materials: the draft has each question with its own answer.
      const draftId = String(metadata.ai?.draftId || '')
      const draft = draftId ? await deps.db.prepare(`SELECT blocks FROM material_ai_drafts WHERE id = ?`).bind(draftId).first().catch(() => null) as Record<string, any> | null : null
      for (const block of parse<any[]>(draft?.blocks, [])) {
        if (block?.type !== 'question') continue
        const options = Array.isArray(block.options) ? block.options : []
        const objective = options.length >= 2
        questions.push({ ...context, type: objective ? 'mcq' : String(block.answer || '').split(/\s+/).length <= 6 && block.answer ? 'shortanswer' : 'essay', prompt: String(block.prompt || ''), options: objective ? options : [],
          answer: objective ? block.answer : [block.answer, block.solution, ...(Array.isArray(block.markingGuide) ? block.markingGuide : [])].filter(Boolean).join('\n'), explanation: String(block.solution || '') })
      }
    } else if (String(metadata.description || '').trim().length > 80 && !row.url) {
      note = { ...noteBase, markdown: `# ${noteBase.title}\n\n${tidyMarkdown(String(metadata.description))}`, source: 'text' }
      questions.push(...importedToBank(parsePaperText(String(metadata.description)).questions, context, true))
    }
    const fileKey = fileKeyOf(row.url)
    const fileName = String(metadata.fileName || metadata.originalName || row.title || fileKey)
    const documents = fileKey && (READABLE.test(fileName) || READABLE.test(fileKey))
      ? [{ fileKey, fileName: READABLE.test(fileName) ? fileName : fileKey.split('/').pop() || fileKey, contentType: String(metadata.mimeType || metadata.contentType || ''), makeNote: !note, questionsExpected: /question|exam|test|quiz|assignment|worksheet|exercise|past/i.test(`${row.title} ${fileName}`), defaults: context }]
      : []
    return { questions, documents, note, signatureExtra: `${String(row.url || '')}:${blocks.length}:${String(metadata.description || '').length}:${releaseAt || ''}` }
  },
}

const QUESTION_SUBMISSIONS = new Set(['exam_questions', 'test_questions', 'lesson_note'])
const submissionsSource: Source = {
  type: 'submission',
  changed: (db, stamp, id, limit) => rowsOf(db.prepare(`SELECT * FROM teacher_submissions WHERE deleted_at IS NULL AND status != 'draft' AND type IN ('exam_questions', 'test_questions', 'lesson_note')
    AND (updated_at > ? OR (updated_at = ? AND id > ?)) ORDER BY updated_at, id LIMIT ?`).bind(stamp, stamp, id, limit)),
  all: (db, id, limit) => rowsOf(db.prepare(`SELECT * FROM teacher_submissions WHERE deleted_at IS NULL AND status != 'draft' AND type IN ('exam_questions', 'test_questions', 'lesson_note') AND id > ? ORDER BY id LIMIT ?`).bind(id, limit)),
  stamp: row => String(row.updated_at || ''),
  async harvest(deps, row) {
    if (!QUESTION_SUBMISSIONS.has(String(row.type))) return null
    const examPaper = row.type !== 'lesson_note'
    const releaseAt = examPaper ? await examReleaseAt(deps.db, { tenantId: String(row.tenant_id), classId: String(row.class_id), subjectId: String(row.subject_id), createdAt: String(row.created_at || '') }) : null
    const context: Context = { tenantId: String(row.tenant_id), subject: String(row.subject_name || ''), subjectId: String(row.subject_id || ''), classId: String(row.class_id || ''), classLevel: String(row.class_name || ''), originType: examPaper ? 'exam_paper' : 'lesson_note', originId: String(row.id), releaseAt: releaseAt && Date.parse(releaseAt) > Date.parse(iso(deps)) ? releaseAt : null, createdBy: String(row.teacher_id || ''), exactRelease: examPaper }
    const text = String(row.content || '').replace(/<[^>]+>/g, '\n')
    const questions = text.trim() ? importedToBank(parsePaperText(text).questions, context, !examPaper) : []
    const documents = parse<any[]>(row.files_json, []).map(file => ({ fileKey: fileKeyOf(file?.url), fileName: String(file?.name || ''), contentType: String(file?.type || ''), makeNote: false, questionsExpected: examPaper, defaults: context }))
      .filter(doc => doc.fileKey && READABLE.test(doc.fileName || doc.fileKey))
    return { questions, documents, signatureExtra: context.releaseAt || '' }
  },
}

export const SOURCES: Source[] = [assignmentsSource, assessmentsSource, materialsSource, submissionsSource]

async function harvestRow(deps: HarvestDeps, source: Source, row: SourceRow) {
  const { db } = deps
  const id = String(row.id)
  let result: Harvested | null = null
  try {
    result = await source.harvest(deps, row)
  } catch (error) {
    await db.prepare(`INSERT INTO harvest_log (source_type, source_id, tenant_id, signature, questions, status, error, harvested_at) VALUES (?, ?, ?, '', 0, 'failed', ?, ?)
      ON CONFLICT(source_type, source_id) DO UPDATE SET status = 'failed', error = excluded.error, harvested_at = excluded.harvested_at`)
      .bind(source.type, id, String(row.tenant_id || ''), error instanceof Error ? error.message.slice(0, 300) : 'failed', iso(deps)).run()
    return 0
  }
  const signature = await digest(`${source.stamp(row)}|${result?.signatureExtra || ''}|${result?.questions.length || 0}`)
  const logged = await db.prepare(`SELECT signature FROM harvest_log WHERE source_type = ? AND source_id = ?`).bind(source.type, id).first() as Record<string, any> | null
  if (logged?.signature === signature) return 0
  let added = 0
  if (result) {
    added = (await upsertBankQuestions(db, result.questions)).added
    if (result.note) await saveNote(db, result.note)
    for (const document of result.documents) await queueDocument(db, { ...document, tenantId: String(row.tenant_id || ''), originType: source.type, originId: id })
  }
  await db.prepare(`INSERT INTO harvest_log (source_type, source_id, tenant_id, signature, questions, status, error, harvested_at) VALUES (?, ?, ?, ?, ?, 'done', NULL, ?)
    ON CONFLICT(source_type, source_id) DO UPDATE SET signature = excluded.signature, questions = harvest_log.questions + excluded.questions, status = 'done', error = NULL, harvested_at = excluded.harvested_at`)
    .bind(source.type, id, String(row.tenant_id || ''), signature, added, iso(deps)).run()
  return added
}

// ─── Documents (uploaded PDFs and Word files) ─────────────────────────────────

export async function queueDocument(db: D1Database, input: { tenantId: string, originType: string, originId: string, fileKey: string, fileName: string, contentType: string, makeNote: boolean, questionsExpected: boolean, defaults: Record<string, any>, createdBy?: string, createdByName?: string }) {
  await ensureHarvestTables(db)
  const id = `hdoc_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`
  const stamp = new Date().toISOString()
  await db.prepare(`INSERT OR IGNORE INTO harvest_documents (id, tenant_id, origin_type, origin_id, file_key, file_name, content_type, defaults_json, make_note, questions_expected, status, created_by, created_by_name, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'queued', ?, ?, ?, ?)`).bind(id, input.tenantId, input.originType, input.originId, input.fileKey, input.fileName.slice(0, 200),
    input.contentType.slice(0, 100), JSON.stringify(input.defaults), input.makeNote ? 1 : 0, input.questionsExpected ? 1 : 0, input.createdBy || '', input.createdByName || '', stamp, stamp).run()
  const row = await db.prepare(`SELECT * FROM harvest_documents WHERE origin_type = ? AND origin_id = ? AND file_key = ?`).bind(input.originType, input.originId, input.fileKey).first() as Record<string, any>
  return mapDocument(row)
}

export function mapDocument(row: Record<string, any>) {
  const total = Number(row.total || 0)
  const status = String(row.status || 'queued')
  const defaults = parse<Record<string, any>>(row.defaults_json, {})
  return {
    id: String(row.id), tenantId: String(row.tenant_id || ''), originType: String(row.origin_type), originId: String(row.origin_id), fileName: String(row.file_name || ''),
    status, added: Number(row.added || 0), attempts: Number(row.attempts || 0), error: String(row.error || ''),
    percent: status === 'done' ? 100 : !total ? (status === 'reading' ? 5 : 0) : Math.min(99, 10 + Math.floor((Number(row.offset || 0) / total) * 90)),
    section: String(defaults.section || ''), classLevel: String(defaults.classLevel || ''), subject: String(defaults.subject || ''), topic: String(defaults.topic || ''),
    releaseAt: defaults.releaseAt || null, createdByName: String(row.created_by_name || ''), createdAt: row.created_at, finishedAt: row.finished_at || null,
    active: ['queued', 'reading', 'processing'].includes(status),
  }
}

export async function listDocuments(db: D1Database, filters: { tenantId: string, originType?: string }, limit = 30) {
  await ensureHarvestTables(db)
  const rows = await db.prepare(`SELECT * FROM harvest_documents WHERE tenant_id = ? ${filters.originType ? 'AND origin_type = ?' : ''}
    ORDER BY CASE WHEN status IN ('queued', 'reading', 'processing') THEN 0 ELSE 1 END, created_at DESC LIMIT ?`).bind(...[filters.tenantId, ...(filters.originType ? [filters.originType] : []), limit]).all()
  return ((rows.results || []) as Record<string, any>[]).map(mapDocument)
}

async function claimDocument(db: D1Database, id: string) {
  const result = await db.prepare(`UPDATE harvest_documents SET locked_until = ? WHERE id = ? AND status IN ('queued', 'reading', 'processing') AND (locked_until IS NULL OR locked_until < ?)`)
    .bind(new Date(Date.now() + DOC_LOCK_MS).toISOString(), id, new Date().toISOString()).run()
  return Boolean(result.meta?.changes)
}

const DOC_CHUNK = 14000

/** One step of a document: read it, then turn its text into questions (all at once when short). */
export async function runDocumentStep(deps: HarvestDeps, id: string) {
  const { db } = deps
  await ensureHarvestTables(db)
  if (!(await claimDocument(db, id))) return null
  const row = await db.prepare(`SELECT * FROM harvest_documents WHERE id = ?`).bind(id).first() as Record<string, any>
  const defaults = parse<Context & Record<string, any>>(row.defaults_json, {} as any)
  const release = (fields: Record<string, unknown>) => {
    const keys = Object.keys(fields)
    return db.prepare(`UPDATE harvest_documents SET ${keys.map(key => `${key} = ?`).join(', ')}, locked_until = NULL, updated_at = ? WHERE id = ?`).bind(...keys.map(key => fields[key]), new Date().toISOString(), id).run()
  }
  try {
    if (!Number(row.total)) {
      if (!deps.bucket) throw new HarvestError('File storage is not available.', 503)
      const object = await deps.bucket.get(String(row.file_key))
      if (!object) throw new HarvestError('The file is no longer stored.', 404)
      if (Number(object.size || 0) > MAX_DOC_BYTES) throw new HarvestError('The file is too large to read.', 422)
      const bytes: ArrayBuffer = typeof object.arrayBuffer === 'function' ? await object.arrayBuffer() : object.body
      const name = String(row.file_name || row.file_key)
      let text = ''
      if (/\.(txt|md|markdown)$/i.test(name)) text = new TextDecoder().decode(bytes)
      else if (/\.html?$/i.test(name)) text = new TextDecoder().decode(bytes).replace(/<(script|style)[\s\S]*?<\/\1>/gi, '').replace(/<\/(p|div|h\d|li|tr)>/gi, '\n').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')
      else {
        if (!deps.toText) throw new HarvestError('Documents cannot be read right now.', 503)
        text = await deps.toText(bytes, name, String(row.content_type || object.httpMetadata?.contentType || ''))
      }
      const tidy = tidyMarkdown(text)
      if (tidy.length < 30) {
        await release({ status: 'failed', error: 'No text could be read from this file — it may be a scanned picture.', finished_at: new Date().toISOString() })
        return mapDocument({ ...row, status: 'failed' })
      }
      if (Number(row.make_note) && defaults.originType === 'material') {
        let markdown = tidy
        // Notes with no recognisable structure are laid out by Ndovera AI (wording unchanged).
        if (!hasStructure(markdown) && markdown.length > 1500 && markdown.length < 16000 && deps.runAi) {
          const formatted = await deps.runAi([{ role: 'system', content: FORMAT_NOTES_SYSTEM }, { role: 'user', content: markdown }], { maxTokens: 6000, temperature: 0.1 }).catch(() => '')
          const cleaned = String(formatted || '').replace(/^```(?:markdown)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
          // Keep the AI's layout only if it kept the words (length within 15%).
          if (cleaned && Math.abs(cleaned.length - markdown.length) / markdown.length < 0.15) markdown = cleaned
        }
        const material = await db.prepare(`SELECT title FROM materials WHERE id = ?`).bind(String(row.origin_id)).first().catch(() => null) as Record<string, any> | null
        await saveNote(db, {
          tenantId: String(row.tenant_id), materialId: String(row.origin_id), classId: String(defaults.classId || ''), subjectId: String(defaults.subjectId || ''), subjectName: String(defaults.subject || ''),
          topic: String(defaults.topic || ''), title: String(material?.title || row.file_name || 'Notes'), markdown: /^#\s/.test(markdown) ? markdown : `# ${String(material?.title || row.file_name || 'Notes')}\n\n${markdown}`,
          source: 'file', sourceUrl: `/files/${row.file_key}`, visibility: 'student_parent', releaseAt: defaults.releaseAt || null,
        })
      }
      const textKey = deps.bucket && tidy.length > 60000 ? `harvest-documents/${id}.txt` : ''
      if (textKey) await deps.bucket!.put(textKey, tidy, { httpMetadata: { contentType: 'text/plain; charset=utf-8' } })
      await release({ status: 'processing', text_key: textKey || null, text_inline: textKey ? null : tidy, total: tidy.length, offset: 0, attempts: 0, error: null })
      return mapDocument({ ...row, status: 'processing', total: tidy.length })
    }
    let text = String(row.text_inline || '')
    if (!text && row.text_key && deps.bucket) {
      const stored = await deps.bucket.get(String(row.text_key))
      text = stored ? (typeof stored.text === 'function' ? await stored.text() : String(stored.body || '')) : ''
    }
    if (!text) throw new HarvestError('The text read from this file is missing; it will be read again.', 409)
    const offset = Number(row.offset || 0)
    // Short documents are read whole, so an answer key at the end reaches every question.
    let end = text.length <= 40000 ? text.length : Math.min(text.length, offset + DOC_CHUNK)
    if (end < text.length) { const cut = text.lastIndexOf('\n\n', end); if (cut > offset + DOC_CHUNK / 2) end = cut }
    const chunk = text.slice(offset, end)
    const expected = Boolean(Number(row.questions_expected))
    let parsed = parsePaperText(chunk)
    const questionish = expected || (chunk.match(/\?\s*$/gm) || []).length >= 3
    if (questionish && needsAiHelp(parsed, chunk) && deps.runAi) {
      const reply = await deps.runAi([{ role: 'system', content: AI_IMPORT_SYSTEM }, { role: 'user', content: chunk.slice(0, 12000) }], { maxTokens: 3500, temperature: 0.1 })
      const fromAi = importFromAiReply(reply, chunk)
      if (fromAi.questions.length) parsed = fromAi
    }
    const level = defaults.rank !== undefined && defaults.rank !== null ? null : levelOf(defaults.classLevel)
    const result = await upsertBankQuestions(db, importedToBank(parsed.questions, {
      ...defaults, tenantId: String(row.tenant_id || GLOBAL_TENANT), rank: defaults.rank ?? level?.rank ?? null, originType: String(defaults.originType || row.origin_type), originId: String(defaults.originId || row.origin_id),
    }, !expected))
    const done = end >= text.length
    await release({ status: done ? 'done' : 'processing', offset: end, added: Number(row.added || 0) + result.added, attempts: 0, error: null, ...(done ? { text_inline: null, finished_at: new Date().toISOString() } : {}) })
    return mapDocument({ ...row, status: done ? 'done' : 'processing', offset: end, added: Number(row.added || 0) + result.added })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Reading failed.'
    const attempts = Number(row.attempts || 0) + 1
    const hard = error instanceof HarvestError && [404, 422].includes(error.status)
    await release(hard || attempts >= DOC_MAX_ATTEMPTS ? { status: 'failed', attempts, error: message.slice(0, 300), finished_at: new Date().toISOString() } : { attempts, error: `${message.slice(0, 200)} — retrying automatically.` })
    return null
  }
}

export async function setDocumentStatus(db: D1Database, id: string, tenantId: string, action: 'retry' | 'cancel') {
  await ensureHarvestTables(db)
  const row = await db.prepare(`SELECT * FROM harvest_documents WHERE id = ? AND tenant_id = ?`).bind(id, tenantId).first() as Record<string, any> | null
  if (!row) throw new HarvestError('Upload not found.', 404)
  if (action === 'retry' && row.status !== 'failed') throw new HarvestError('Only a failed upload can be retried.', 409)
  if (action === 'cancel' && !['queued', 'reading', 'processing'].includes(String(row.status))) throw new HarvestError('This upload has already finished.', 409)
  await db.prepare(`UPDATE harvest_documents SET status = ?, attempts = 0, error = NULL, locked_until = NULL, updated_at = ? WHERE id = ?`)
    .bind(action === 'retry' ? (Number(row.total) ? 'processing' : 'queued') : 'cancelled', new Date().toISOString(), id).run()
  return mapDocument({ ...row, status: action === 'retry' ? 'queued' : 'cancelled' })
}

// ─── Answer keys from Ndovera AI (once, then stored) ──────────────────────────

export const ANSWER_KEY_SYSTEM = [
  'You are an experienced Nigerian school examiner. Give the correct answer to each question below.',
  'Return ONLY a JSON array: [{"id":"","answer":"","alternatives":[""],"explanation":""}].',
  'Multiple choice / true-false: "answer" is the exact text of the correct option. Short-answer and fill-in: the answer in at most five words, with other accepted wordings in "alternatives".',
  'Essay, structured and comprehension questions: "answer" is a concise model answer with the main points a marker looks for.',
  '"explanation" is one or two sentences a student can learn from. If a question cannot be answered as written, give "answer":"".',
].join('\n')

export async function fillAnswerKeys(deps: HarvestDeps, limit = 6) {
  const { db } = deps
  if (!deps.runAi) return 0
  await ensurePracticeTables(db)
  const rows = ((await db.prepare(`SELECT * FROM question_bank WHERE answer_source = 'pending' AND COALESCE(playable, 0) = 0 ORDER BY updated_at LIMIT ?`).bind(limit).all()).results || []) as Record<string, any>[]
  if (!rows.length) return 0
  const items = rows.map(row => {
    const options = parse<string[]>(row.options_json, [])
    const metadata = parse<Record<string, any>>(row.metadata_json, {})
    return `ID: ${row.id}\nType: ${bankType(row.type)}\nSubject: ${row.subject || ''}${row.class_level ? ` (${row.class_level})` : ''}\n${metadata.passage ? `Passage: ${String(metadata.passage).slice(0, 1500)}\n` : ''}Question: ${String(row.prompt).slice(0, 1500)}${options.length ? `\nOptions: ${options.map((option, index) => `${String.fromCharCode(65 + index)}. ${option}`).join(' | ')}` : ''}`
  }).join('\n\n---\n\n')
  const reply = await deps.runAi([{ role: 'system', content: ANSWER_KEY_SYSTEM }, { role: 'user', content: items }], { maxTokens: 2500, temperature: 0.1 })
  const text = String(reply || '').replace(/```(?:json)?/g, '')
  let answers: any[] = []
  try { answers = JSON.parse(text.slice(text.indexOf('['), text.lastIndexOf(']') + 1)) } catch { answers = [] }
  const byId = new Map((Array.isArray(answers) ? answers : []).map(item => [String(item?.id || ''), item]))
  const statements: D1PreparedStatement[] = []
  const nowPlayable: Array<Record<string, any>> = []
  const stamp = new Date().toISOString()
  for (const row of rows) {
    const item = byId.get(String(row.id))
    const answer = String(item?.answer || '').trim()
    const type = bankType(row.type)
    const options = parse<string[]>(row.options_json, [])
    if (!answer) {
      // Asked once; not asked again until someone edits it.
      statements.push(db.prepare(`UPDATE question_bank SET answer_source = 'unanswerable', updated_at = ? WHERE id = ?`).bind(stamp, row.id))
      continue
    }
    let storedAnswer: unknown = answer
    let newType = type
    if (type === 'mcq' || type === 'truefalse') {
      const match = options.find(option => normalizeText(option) === normalizeText(answer)) || options[(answer.match(/^\(?([A-Ha-h])\)?[.)]?$/)?.[1]?.toUpperCase().charCodeAt(0) ?? 99) - 65]
      if (!match) { statements.push(db.prepare(`UPDATE question_bank SET answer_source = 'unanswerable', updated_at = ? WHERE id = ?`).bind(stamp, row.id)); continue }
      storedAnswer = match
    } else if (type === 'shortanswer' || type === 'fillgaps') {
      // A long answer cannot be marked by matching words: the student checks it against the model answer.
      if (answer.split(/\s+/).length > 6) newType = 'essay'
      else storedAnswer = [answer, ...(Array.isArray(item.alternatives) ? item.alternatives : [])].map(value => String(value || '').trim()).filter(Boolean)
    }
    statements.push(db.prepare(`UPDATE question_bank SET type = ?, answer_json = ?, explanation = COALESCE(NULLIF(explanation, ''), ?), answer_source = 'ai', playable = 1, updated_at = ? WHERE id = ?`)
      .bind(newType, JSON.stringify(storedAnswer), String(item.explanation || '').slice(0, 1500), stamp, row.id))
    nowPlayable.push(row)
  }
  if (statements.length) await db.batch(statements)
  await countNewlyPlayable(db, nowPlayable)
  return statements.length
}

// ─── The cron ────────────────────────────────────────────────────────────────

function lagosParts(at: Date) {
  const lagos = new Date(at.getTime() + 3600000)
  return { date: lagos.toISOString().slice(0, 10), hour: lagos.getUTCHours() }
}

/** Starts the nightly sweep the first time the cron runs after midnight (Lagos). */
async function maybeStartSweep(deps: HarvestDeps) {
  const { date } = lagosParts(deps.now || new Date())
  if ((await getState(deps.db, 'sweep:date')) === date) return false
  await setState(deps.db, 'sweep:date', date)
  for (const source of SOURCES) await setState(deps.db, `sweep:${source.type}`, '')
  await setState(deps.db, 'sweep:active', '1')
  return true
}

/** Run the sweep forward: the next page of the next unfinished source. */
async function sweepStep(deps: HarvestDeps, pageSize: number) {
  if ((await getState(deps.db, 'sweep:active')) !== '1') return 0
  for (const source of SOURCES) {
    const cursor = await getState(deps.db, `sweep:${source.type}`)
    if (cursor === '~done') continue
    const rows = await source.all(deps.db, cursor, pageSize)
    let added = 0
    for (const row of rows) added += await harvestRow(deps, source, row)
    await setState(deps.db, `sweep:${source.type}`, rows.length < pageSize ? '~done' : String(rows[rows.length - 1].id))
    return added
  }
  await setState(deps.db, 'sweep:active', '')
  return 0
}

/** Whatever changed since the last run, per source. */
async function incrementalStep(deps: HarvestDeps, pageSize: number) {
  let added = 0
  for (const source of SOURCES) {
    const [stamp, id] = (await getState(deps.db, `watermark:${source.type}`)).split('|')
    const rows = await source.changed(deps.db, stamp || '', id || '', pageSize)
    for (const row of rows) added += await harvestRow(deps, source, row)
    if (rows.length) await setState(deps.db, `watermark:${source.type}`, `${source.stamp(rows[rows.length - 1])}|${rows[rows.length - 1].id}`)
  }
  return added
}

/**
 * One cron run. Small on purpose: new and changed work first, a page of the
 * nightly sweep, one document step, a few answer keys, and tidying old rows.
 */
export async function runHarvestTick(deps: HarvestDeps, options: { pageSize?: number, documentSteps?: number, answerKeys?: number } = {}) {
  await ensureHarvestTables(deps.db)
  const pageSize = options.pageSize ?? 8
  const report = { incremental: 0, sweep: 0, documents: 0, answerKeys: 0, classified: 0, sweepStarted: false, quantReasoning: 0, verbalReasoning: 0 }
  // Ndovera's Quantitative Reasoning questions (Primary 1–6), one class a run until all are in.
  report.quantReasoning = await seedQuantReasoningBank(deps.db, key => getState(deps.db, key), (key, value) => setState(deps.db, key, value)).catch(() => 0)
  // And Verbal Reasoning (1,000 per class), a slice a run.
  report.verbalReasoning = await seedVerbalReasoningBank(deps.db, key => getState(deps.db, key), (key, value) => setState(deps.db, key, value)).catch(() => 0)
  report.incremental = await incrementalStep(deps, pageSize)
  report.sweepStarted = await maybeStartSweep(deps)
  report.sweep = await sweepStep(deps, pageSize)
  for (let step = 0; step < (options.documentSteps ?? 1); step += 1) {
    const next = await deps.db.prepare(`SELECT id FROM harvest_documents WHERE status IN ('queued', 'processing') AND (locked_until IS NULL OR locked_until < ?) ORDER BY CASE WHEN origin_type = 'ami_upload' THEN 0 ELSE 1 END, updated_at LIMIT 1`)
      .bind(new Date().toISOString()).first() as Record<string, any> | null
    if (!next) break
    if (await runDocumentStep(deps, String(next.id))) report.documents += 1
  }
  report.classified = await classifyLegacyQuestions(deps.db, 60)
  report.answerKeys = await fillAnswerKeys(deps, options.answerKeys ?? 6).catch(() => 0)
  return report
}

// ─── Notes for students (and offline) ─────────────────────────────────────────

export async function listNotes(db: D1Database, filters: { tenantId: string, classIds: string[], includeHidden?: boolean }) {
  await ensureHarvestTables(db)
  if (!filters.classIds.length) return []
  const rows = await db.prepare(`SELECT id, material_id, class_id, subject_id, subject_name, topic, title, word_count, source, visibility, release_at, updated_at FROM ndovera_notes
    WHERE tenant_id = ? AND class_id IN (${filters.classIds.map(() => '?').join(',')}) ORDER BY updated_at DESC LIMIT 300`).bind(filters.tenantId, ...filters.classIds).all()
  const stamp = new Date().toISOString()
  return ((rows.results || []) as Record<string, any>[])
    .filter(row => filters.includeHidden || ((!row.release_at || String(row.release_at) <= stamp) && /student/.test(String(row.visibility || 'student'))))
    .map(row => ({ id: row.id, materialId: row.material_id, classId: row.class_id, subjectId: row.subject_id, subjectName: row.subject_name, topic: row.topic, title: row.title, words: Number(row.word_count || 0), source: row.source, updatedAt: row.updated_at }))
}

export async function getNote(db: D1Database, tenantId: string, materialId: string) {
  await ensureHarvestTables(db)
  return db.prepare(`SELECT * FROM ndovera_notes WHERE tenant_id = ? AND material_id = ?`).bind(tenantId, materialId).first() as Promise<Record<string, any> | null>
}
