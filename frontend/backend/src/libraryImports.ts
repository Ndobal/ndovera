// PDF imports into the Curriculum & Examination Library, done in the background.
//
// The PDF is uploaded once and stored. From then on the Worker's minute cron
// does the work a piece at a time — whether or not the person who uploaded it
// is still online:
//
//   queued → reading (PDF → text) → processing (one chunk of text → rows per
//   step) → done
//
// Each step is claimed with a short lock, so the cron and an open page never
// process the same job twice. A step that fails is retried on later runs; after
// MAX_ATTEMPTS the job stops as "failed" and can be resumed. Every job reports
// its progress, so the uploader can see the status from any page.

import { addCurriculumTopics, addSpecTopics, curriculumImportPrompt, examSpecImportPrompt, extractJsonArray, getExamSpec, importChunk } from './curriculumLibrary'
import type { AiRunner } from './curriculumLibrary'

export class ImportError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

export const MAX_PDF_BYTES = 25 * 1024 * 1024
export const MAX_ATTEMPTS = 5
export const MIN_TEXT = 200
const LOCK_MS = 3 * 60 * 1000
const ACTIVE = ['queued', 'reading', 'processing']

const now = () => new Date().toISOString()
const json = <T,>(value: unknown, fallback: T): T => { try { return value ? JSON.parse(String(value)) as T : fallback } catch { return fallback } }

const readyDbs = new WeakSet<object>()
export async function ensureImportTables(db: D1Database) {
  if (readyDbs.has(db as object)) return
  await db.prepare(`CREATE TABLE IF NOT EXISTS library_import_jobs (
    id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL DEFAULT '', target_type TEXT NOT NULL, target_id TEXT NOT NULL, target_name TEXT,
    file_key TEXT NOT NULL, file_name TEXT, file_size INTEGER DEFAULT 0, text_key TEXT, defaults TEXT,
    status TEXT NOT NULL DEFAULT 'queued', offset INTEGER DEFAULT 0, total INTEGER DEFAULT 0, added INTEGER DEFAULT 0, rejected INTEGER DEFAULT 0,
    attempts INTEGER DEFAULT 0, error TEXT, locked_until TEXT, created_by TEXT, created_by_name TEXT, created_at TEXT, updated_at TEXT, finished_at TEXT
  )`).run()
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_library_import_jobs_status ON library_import_jobs(status, updated_at)`).run()
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_library_import_jobs_tenant ON library_import_jobs(tenant_id, created_at)`).run()
  readyDbs.add(db as object)
}

export function mapJob(row: Record<string, any>) {
  const total = Number(row.total || 0)
  const offset = Number(row.offset || 0)
  const status = String(row.status || 'queued')
  return {
    id: String(row.id), tenantId: String(row.tenant_id || ''), targetType: String(row.target_type) as 'curriculum' | 'exam_spec', targetId: String(row.target_id),
    targetName: String(row.target_name || ''), fileName: String(row.file_name || ''), fileSize: Number(row.file_size || 0), status,
    offset, total, added: Number(row.added || 0), rejected: Number(row.rejected || 0), attempts: Number(row.attempts || 0), error: String(row.error || ''),
    // Reading the PDF counts as the first 5%; the rest follows the text.
    percent: status === 'done' ? 100 : !total ? (status === 'reading' ? 2 : 0) : Math.min(99, 5 + Math.floor((offset / total) * 95)),
    defaults: json<Record<string, string>>(row.defaults, {}), createdBy: String(row.created_by || ''), createdByName: String(row.created_by_name || ''),
    createdAt: row.created_at, updatedAt: row.updated_at, finishedAt: row.finished_at || null, active: ACTIVE.includes(status),
  }
}
export type ImportJob = ReturnType<typeof mapJob>

export async function getJob(db: D1Database, id: string) {
  await ensureImportTables(db)
  const row = await db.prepare(`SELECT * FROM library_import_jobs WHERE id = ?`).bind(id).first() as Record<string, any> | null
  return row ? mapJob(row) : null
}

/** A tenant's jobs ('' = Ndovera's library): active ones first, then the latest. */
export async function listJobs(db: D1Database, tenantId: string, limit = 20) {
  await ensureImportTables(db)
  const rows = await db.prepare(`SELECT * FROM library_import_jobs WHERE tenant_id = ? ORDER BY CASE WHEN status IN ('queued', 'reading', 'processing') THEN 0 ELSE 1 END, created_at DESC LIMIT ?`).bind(tenantId, limit).all()
  return ((rows.results || []) as Record<string, any>[]).map(mapJob)
}

export async function createJob(db: D1Database, input: {
  tenantId: string, targetType: 'curriculum' | 'exam_spec', targetId: string, targetName: string, fileKey: string, fileName: string, fileSize: number,
  defaults: Record<string, string>, actor: { id: string, name: string },
}) {
  await ensureImportTables(db)
  const id = `imp_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`
  await db.prepare(`INSERT INTO library_import_jobs (id, tenant_id, target_type, target_id, target_name, file_key, file_name, file_size, defaults, status, created_by, created_by_name, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'queued', ?, ?, ?, ?)`).bind(id, input.tenantId, input.targetType, input.targetId, input.targetName, input.fileKey, input.fileName, input.fileSize,
    JSON.stringify(input.defaults), input.actor.id, input.actor.name, now(), now()).run()
  return getJob(db, id) as Promise<ImportJob>
}

export async function setJobStatus(db: D1Database, job: ImportJob, action: 'pause' | 'resume' | 'cancel') {
  if (action === 'pause' && !job.active) throw new ImportError('Only an import in progress can be paused.', 409)
  if (action === 'resume' && !['paused', 'failed'].includes(job.status)) throw new ImportError('Only a paused or failed import can be resumed.', 409)
  if (action === 'cancel' && ['done', 'cancelled'].includes(job.status)) throw new ImportError('This import has already finished.', 409)
  // Resuming goes back to reading if the text was never extracted.
  const status = action === 'pause' ? 'paused' : action === 'cancel' ? 'cancelled' : (job.total ? 'processing' : 'queued')
  await db.prepare(`UPDATE library_import_jobs SET status = ?, attempts = CASE WHEN ? = 'resume' THEN 0 ELSE attempts END, error = CASE WHEN ? = 'resume' THEN NULL ELSE error END, locked_until = NULL, updated_at = ? WHERE id = ?`)
    .bind(status, action, action, now(), job.id).run()
  return getJob(db, job.id) as Promise<ImportJob>
}

/** Take the job for one step; false when someone else holds it or it is no longer active. */
async function claim(db: D1Database, id: string) {
  const until = new Date(Date.now() + LOCK_MS).toISOString()
  const result = await db.prepare(`UPDATE library_import_jobs SET locked_until = ? WHERE id = ? AND status IN ('queued', 'reading', 'processing') AND (locked_until IS NULL OR locked_until < ?)`)
    .bind(until, id, now()).run()
  return Boolean(result.meta?.changes)
}

export type ImportDeps = {
  db: D1Database
  bucket: { get(key: string): Promise<any>, put(key: string, value: any, options?: any): Promise<any> }
  /** PDF bytes → text (Markdown). */
  pdfToText: (bytes: ArrayBuffer, fileName: string) => Promise<string>
  runAi: AiRunner
}

/** Text from Cloudflare Workers AI's document conversion. */
export function workersAiPdfToText(ai: any) {
  return async (bytes: ArrayBuffer, fileName: string) => {
    if (!ai || typeof ai.toMarkdown !== 'function') throw new ImportError('PDF reading is not available right now.', 503)
    const result = await ai.toMarkdown([{ name: fileName || 'document.pdf', blob: new Blob([bytes], { type: 'application/pdf' }) }])
    const first = Array.isArray(result) ? result[0] : result
    if (first?.format === 'error') throw new ImportError(String(first.error || 'The PDF could not be read.'), 422)
    return String(first?.data || '')
  }
}

/** Page furniture repeated on every page (running headers, page numbers) is noise for the model. */
export function cleanPdfText(text: string) {
  return String(text || '').replace(/\r\n?/g, '\n')
    .split('\n').filter(line => !/^\s*(page\s*)?\d{1,4}(\s*(of|\/)\s*\d{1,4})?\s*$/i.test(line)).join('\n')
    .replace(/\n{3,}/g, '\n\n').trim()
}

/**
 * One step of a job: read the PDF, or turn the next chunk of text into rows.
 * Returns the job afterwards (or null if it could not be claimed).
 */
export async function runImportStep(deps: ImportDeps, jobId: string) {
  const { db } = deps
  await ensureImportTables(db)
  if (!(await claim(db, jobId))) return null
  const job = await getJob(db, jobId) as ImportJob
  const release = (fields: Record<string, unknown>) => {
    const keys = Object.keys(fields)
    return db.prepare(`UPDATE library_import_jobs SET ${keys.map(key => `${key} = ?`).join(', ')}, locked_until = NULL, updated_at = ? WHERE id = ?`).bind(...keys.map(key => fields[key]), now(), jobId).run()
  }
  try {
    if (job.status === 'queued' || !job.total) {
      await release({ status: 'reading' })
      await claim(db, jobId)
      const object = await deps.bucket.get(String((await db.prepare(`SELECT file_key FROM library_import_jobs WHERE id = ?`).bind(jobId).first() as any)?.file_key || ''))
      if (!object) throw new ImportError('The uploaded PDF is missing. Upload it again.', 404)
      const bytes = typeof object.arrayBuffer === 'function' ? await object.arrayBuffer() : object.body
      const text = cleanPdfText(await deps.pdfToText(bytes, job.fileName))
      if (text.length < MIN_TEXT) {
        await release({ status: 'failed', error: 'This PDF has no readable text — it may be a scanned image. Upload a text PDF, or paste the text instead.', finished_at: now() })
        return getJob(db, jobId)
      }
      const textKey = `library-imports/${jobId}.txt`
      await deps.bucket.put(textKey, text, { httpMetadata: { contentType: 'text/plain; charset=utf-8' } })
      await release({ status: 'processing', text_key: textKey, total: text.length, offset: 0, attempts: 0, error: null })
      return getJob(db, jobId)
    }

    const textKey = String((await db.prepare(`SELECT text_key FROM library_import_jobs WHERE id = ?`).bind(jobId).first() as any)?.text_key || '')
    const stored = await deps.bucket.get(textKey)
    if (!stored) throw new ImportError('The extracted text is missing; resume to read the PDF again.', 404)
    const text = typeof stored.text === 'function' ? await stored.text() : String(stored.body || '')
    const { chunk, next } = importChunk(text, job.offset)
    let added = 0
    let rejected = 0
    if (chunk.trim()) {
      if (job.targetType === 'curriculum') {
        const reply = await deps.runAi(curriculumImportPrompt(chunk, { subject: job.defaults.subject, classLabel: job.defaults.classLabel }), { maxTokens: 3500, temperature: 0.1 })
        const rows = extractJsonArray(reply).map((row: Record<string, any>) => ({ ...(job.defaults.subject && !row.subject ? { subject: job.defaults.subject } : {}), ...(job.defaults.classLabel && !row.class ? { class: job.defaults.classLabel } : {}), ...row }))
        const result = await addCurriculumTopics(db, job.targetId, rows)
        added = result.added
        rejected = result.rejected.length
      } else {
        const spec = await getExamSpec(db, job.targetId)
        if (!spec) throw new ImportError('The examination specification was deleted.', 404)
        const reply = await deps.runAi(examSpecImportPrompt(chunk, spec.subject), { maxTokens: 3500, temperature: 0.1 })
        const result = await addSpecTopics(db, spec.id, extractJsonArray(reply))
        added = result.added
        rejected = result.rejected.length
      }
    }
    const done = next >= text.length
    await release({ status: done ? 'done' : 'processing', offset: next, added: job.added + added, rejected: job.rejected + rejected, attempts: 0, error: null, ...(done ? { finished_at: now() } : {}) })
    return getJob(db, jobId)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The import step failed.'
    const attempts = job.attempts + 1
    const hard = error instanceof ImportError && [404, 422].includes(error.status)
    // Transient failures (the model busy, a timeout) are retried on later runs.
    await release(hard || attempts >= MAX_ATTEMPTS
      ? { status: 'failed', attempts, error: message, finished_at: now() }
      : { status: job.total ? 'processing' : 'queued', attempts, error: `${message} — retrying automatically.` })
    return getJob(db, jobId)
  }
}

/** The cron: work through active jobs, oldest first, for up to `budgetMs`. */
export async function runDueImports(deps: ImportDeps, budgetMs = 45_000) {
  await ensureImportTables(deps.db)
  const started = Date.now()
  let steps = 0
  while (Date.now() - started < budgetMs && steps < 6) {
    const row = await deps.db.prepare(`SELECT id FROM library_import_jobs WHERE status IN ('queued', 'reading', 'processing') AND (locked_until IS NULL OR locked_until < ?) ORDER BY updated_at LIMIT 1`).bind(now()).first() as Record<string, any> | null
    if (!row) break
    const result = await runImportStep(deps, String(row.id))
    if (!result) break
    steps += 1
  }
  return steps
}
