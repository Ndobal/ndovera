// Renaming a subject: one record, one id, a new display name.
//
// Every relationship to a subject runs through its id (`subjects.id`, and the
// `subjectId` / `subject_id` columns that point at it), so a rename never
// creates a subject, never moves a result, assignment, material, attendance or
// teacher link, and never loses history. What changes is the name those
// records display: each table that keeps a copy of the name beside the id is
// brought up to date by id.
//
// Audit trails and saved versions (material_audit, lesson_plan_versions) keep
// the name as it was when they were written. Every rename is itself recorded in
// the append-only `subject_rename_audit`.

export class SubjectRenameError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

let _tableReady = false
export function resetSubjectRenameCache() {
  _tableReady = false
}

async function ensureRenameAuditTable(db: D1Database) {
  if (_tableReady) return
  await db.prepare(`CREATE TABLE IF NOT EXISTS subject_rename_audit (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    subject_id TEXT NOT NULL,
    class_id TEXT,
    old_name TEXT NOT NULL,
    new_name TEXT NOT NULL,
    actor_id TEXT,
    actor_name TEXT,
    created_at TEXT NOT NULL
  )`).run()
  try {
    await db.prepare(`CREATE INDEX IF NOT EXISTS idx_subject_rename_audit ON subject_rename_audit(tenant_id, subject_id, created_at)`).run()
  } catch {}
  _tableReady = true
}

// Display copies of the name, each updated strictly by subject id within the school.
const NAME_COPIES: Array<{ table: string, sql: string, binds: (args: { tenantId: string, subjectId: string, name: string }) => unknown[] }> = [
  { table: 'assignments', sql: `UPDATE assignments SET subjectName = ? WHERE subjectId = ? AND classId IN (SELECT id FROM classes WHERE tenantId = ?)`, binds: a => [a.name, a.subjectId, a.tenantId] },
  { table: 'classroom_live_sessions', sql: `UPDATE classroom_live_sessions SET subjectName = ? WHERE subjectId = ? AND classId IN (SELECT id FROM classes WHERE tenantId = ?)`, binds: a => [a.name, a.subjectId, a.tenantId] },
  {
    table: 'materials',
    sql: `UPDATE materials SET metadata = json_set(metadata, '$.subjectName', ?)
      WHERE json_valid(metadata) AND json_extract(metadata, '$.subjectId') = ? AND classId IN (SELECT id FROM classes WHERE tenantId = ?)`,
    binds: a => [a.name, a.subjectId, a.tenantId],
  },
  { table: 'lesson_plans', sql: `UPDATE lesson_plans SET subject_name = ? WHERE subject_id = ? AND tenant_id = ?`, binds: a => [a.name, a.subjectId, a.tenantId] },
  { table: 'result_ca_entries', sql: `UPDATE result_ca_entries SET subject_name = ? WHERE subject_id = ? AND tenant_id = ?`, binds: a => [a.name, a.subjectId, a.tenantId] },
  { table: 'timetable_entries', sql: `UPDATE timetable_entries SET subject_name = ? WHERE subject_id = ? AND tenant_id = ?`, binds: a => [a.name, a.subjectId, a.tenantId] },
  { table: 'question_bank', sql: `UPDATE question_bank SET subject = ? WHERE subject_id = ? AND tenant_id = ?`, binds: a => [a.name, a.subjectId, a.tenantId] },
  { table: 'cbt_exams', sql: `UPDATE cbt_exams SET subject_name = ? WHERE subject_id = ? AND tenant_id = ?`, binds: a => [a.name, a.subjectId, a.tenantId] },
  { table: 'teaching_assignments', sql: `UPDATE teaching_assignments SET subject_name = ? WHERE subject_id = ? AND tenant_id = ?`, binds: a => [a.name, a.subjectId, a.tenantId] },
]

export async function renameSubject(db: D1Database, options: {
  tenantId: string
  subjectId: string
  name: unknown
  actorId?: string
  actorName?: string
}) {
  const name = String(options.name ?? '').replace(/\s+/g, ' ').trim()
  if (!name) throw new SubjectRenameError('Subject name is required.')
  if (name.length > 120) throw new SubjectRenameError('Subject name must be 120 characters or fewer.')

  const subject = await db.prepare(`SELECT id, name, classId FROM subjects WHERE id = ? AND tenantId = ?`)
    .bind(options.subjectId, options.tenantId).first() as Record<string, any> | null
  if (!subject) throw new SubjectRenameError('Subject not found.', 404)

  const oldName = String(subject.name || '')
  if (oldName === name) return { subject: { ...subject, name }, renamed: false, updated: {} as Record<string, number> }

  // Two subjects with the same name in one class could not be told apart.
  const clash = await db.prepare(`SELECT id FROM subjects WHERE tenantId = ? AND classId IS ? AND id != ? AND lower(trim(name)) = lower(?)`)
    .bind(options.tenantId, subject.classId ?? null, options.subjectId, name).first()
  if (clash) throw new SubjectRenameError(`This class already has a subject called "${name}".`, 409)

  await ensureRenameAuditTable(db)
  const timestamp = new Date().toISOString()
  // The rename and its audit record land together or not at all.
  await db.batch([
    db.prepare(`UPDATE subjects SET name = ? WHERE id = ? AND tenantId = ?`).bind(name, options.subjectId, options.tenantId),
    db.prepare(`INSERT INTO subject_rename_audit (id, tenant_id, subject_id, class_id, old_name, new_name, actor_id, actor_name, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
      `subren-${crypto.randomUUID()}`, options.tenantId, options.subjectId, subject.classId ?? null,
      oldName, name, options.actorId || null, options.actorName || null, timestamp,
    ),
  ])

  // Display copies: a school may never have created some of these tables.
  const updated: Record<string, number> = {}
  for (const copy of NAME_COPIES) {
    try {
      const result = await db.prepare(copy.sql).bind(...copy.binds({ tenantId: options.tenantId, subjectId: options.subjectId, name })).run()
      updated[copy.table] = Number(result.meta?.changes || 0)
    } catch (error) {
      if (!/no such table/i.test(String((error as Error)?.message || ''))) {
        console.error(`Updating subject name copies in ${copy.table} failed`, error)
      }
    }
  }

  return { subject: { ...subject, name }, renamed: true, oldName, updated }
}

export async function listSubjectRenames(db: D1Database, tenantId: string, subjectId?: string) {
  await ensureRenameAuditTable(db)
  const rows = subjectId
    ? await db.prepare(`SELECT * FROM subject_rename_audit WHERE tenant_id = ? AND subject_id = ? ORDER BY created_at DESC`).bind(tenantId, subjectId).all()
    : await db.prepare(`SELECT * FROM subject_rename_audit WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 200`).bind(tenantId).all()
  return (rows.results || []) as Record<string, any>[]
}
