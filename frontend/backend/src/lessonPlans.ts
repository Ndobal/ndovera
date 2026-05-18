function parseJsonField<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string' || !value) return fallback

  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function normalizeKeyPart(value: unknown) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'na'
}

function buildLessonPlanId(tenantId: string, classId: string, subjectId: string) {
  return `lessonplan_${normalizeKeyPart(tenantId)}_${normalizeKeyPart(classId)}_${normalizeKeyPart(subjectId)}_${Date.now()}`
}

function normalizeLessonPlanResources(resources: unknown) {
  return (Array.isArray(resources) ? resources : [])
    .map(resource => ({
      id: String((resource as any)?.id || '').trim(),
      title: String((resource as any)?.title || '').trim(),
      url: String((resource as any)?.url || '').trim(),
      type: String((resource as any)?.type || 'document').trim(),
      description: String((resource as any)?.description || '').trim(),
    }))
    .filter(resource => resource.title || resource.url)
}

const LESSON_PLANS_DDL = `CREATE TABLE IF NOT EXISTS lesson_plans (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  class_id TEXT NOT NULL,
  class_name TEXT,
  subject_id TEXT NOT NULL,
  subject_name TEXT,
  teacher_id TEXT NOT NULL,
  teacher_name TEXT,
  title TEXT NOT NULL,
  topic TEXT,
  week_label TEXT,
  visibility TEXT NOT NULL,
  status TEXT NOT NULL,
  release_at TEXT,
  live_session_id TEXT,
  live_session_label TEXT,
  objectives_text TEXT,
  activities_text TEXT,
  assessment_text TEXT,
  notes_text TEXT,
  resources_json TEXT,
  review_comment TEXT,
  reviewed_by TEXT,
  reviewed_by_name TEXT,
  reviewed_at TEXT,
  submitted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`

const LESSON_PLAN_VERSIONS_DDL = `CREATE TABLE IF NOT EXISTS lesson_plan_versions (
  id TEXT PRIMARY KEY,
  lesson_plan_id TEXT NOT NULL,
  changed_by TEXT,
  change_note TEXT,
  snapshot_json TEXT NOT NULL,
  created_at TEXT NOT NULL
)`

function mapLessonPlanRow(row: Record<string, any>) {
  const resources = normalizeLessonPlanResources(parseJsonField(row.resources_json, [] as Array<Record<string, any>>))
  const releaseAt = String(row.release_at || '')
  const releaseTime = releaseAt ? new Date(releaseAt).getTime() : 0

  return {
    id: row.id,
    tenantId: row.tenant_id,
    classId: row.class_id,
    className: String(row.class_name || ''),
    subjectId: row.subject_id,
    subjectName: String(row.subject_name || ''),
    teacherId: row.teacher_id,
    teacherName: String(row.teacher_name || ''),
    title: String(row.title || ''),
    topic: String(row.topic || ''),
    weekLabel: String(row.week_label || ''),
    visibility: String(row.visibility || 'student'),
    status: String(row.status || 'draft'),
    releaseAt,
    isReleased: !releaseAt || (!Number.isNaN(releaseTime) && releaseTime <= Date.now()),
    liveSessionId: String(row.live_session_id || ''),
    liveSessionLabel: String(row.live_session_label || ''),
    objectives: String(row.objectives_text || ''),
    activities: String(row.activities_text || ''),
    assessment: String(row.assessment_text || ''),
    notes: String(row.notes_text || ''),
    resources,
    reviewComment: String(row.review_comment || ''),
    reviewedBy: String(row.reviewed_by || ''),
    reviewedByName: String(row.reviewed_by_name || ''),
    reviewedAt: String(row.reviewed_at || ''),
    submittedAt: String(row.submitted_at || ''),
    createdAt: String(row.created_at || ''),
    updatedAt: String(row.updated_at || ''),
  }
}

async function saveLessonPlanVersion(db: D1Database, lessonPlanId: string, actorId: string, changeNote: string, snapshot: Record<string, any>) {
  await db.prepare(LESSON_PLAN_VERSIONS_DDL).run()
  const now = new Date().toISOString()
  const versionId = `lessonplanver_${normalizeKeyPart(lessonPlanId)}_${Date.now()}`

  await db.prepare(
    `INSERT INTO lesson_plan_versions (id, lesson_plan_id, changed_by, change_note, snapshot_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(versionId, lessonPlanId, actorId || null, changeNote || null, JSON.stringify(snapshot || {}), now).run()
}

export async function ensureLessonPlanTables(db: D1Database) {
  await db.prepare(LESSON_PLANS_DDL).run()
  await db.prepare(LESSON_PLAN_VERSIONS_DDL).run()
}

export async function getLessonPlanById(db: D1Database, tenantId: string, lessonPlanId: string) {
  await ensureLessonPlanTables(db)
  const row = await db.prepare(
    `SELECT * FROM lesson_plans WHERE tenant_id = ? AND id = ? LIMIT 1`
  ).bind(tenantId, lessonPlanId).first() as Record<string, any> | null

  return row ? mapLessonPlanRow(row) : null
}

export async function listLessonPlans(db: D1Database, tenantId: string, filters: Record<string, any> = {}) {
  await ensureLessonPlanTables(db)
  const rows = await db.prepare(
    `SELECT * FROM lesson_plans WHERE tenant_id = ? ORDER BY updated_at DESC, created_at DESC`
  ).bind(tenantId).all()

  return ((rows.results || []) as Record<string, any>[])
    .map(mapLessonPlanRow)
    .filter(plan => {
      if (filters.classId && String(plan.classId || '') !== String(filters.classId || '')) return false
      if (filters.teacherId && String(plan.teacherId || '') !== String(filters.teacherId || '')) return false
      if (filters.status && String(plan.status || '') !== String(filters.status || '')) return false
      return true
    })
}

export async function upsertLessonPlan(db: D1Database, input: Record<string, any>) {
  await ensureLessonPlanTables(db)

  const now = new Date().toISOString()
  const existing = input.id ? await getLessonPlanById(db, String(input.tenantId || ''), String(input.id || '')) : null
  const lessonPlanId = String(existing?.id || input.id || buildLessonPlanId(String(input.tenantId || ''), String(input.classId || ''), String(input.subjectId || '')))
  const resources = normalizeLessonPlanResources(input.resources)
  const status = String(input.status || existing?.status || 'draft')
  const submittedAt = status === 'submitted' ? String(existing?.submittedAt || now) : ''

  await db.prepare(
    `INSERT OR REPLACE INTO lesson_plans (
      id, tenant_id, class_id, class_name, subject_id, subject_name, teacher_id, teacher_name, title, topic, week_label,
      visibility, status, release_at, live_session_id, live_session_label, objectives_text, activities_text, assessment_text,
      notes_text, resources_json, review_comment, reviewed_by, reviewed_by_name, reviewed_at, submitted_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    lessonPlanId,
    String(input.tenantId || ''),
    String(input.classId || ''),
    String(input.className || ''),
    String(input.subjectId || ''),
    String(input.subjectName || ''),
    String(input.teacherId || ''),
    String(input.teacherName || ''),
    String(input.title || ''),
    String(input.topic || ''),
    String(input.weekLabel || ''),
    String(input.visibility || 'student'),
    status,
    String(input.releaseAt || ''),
    String(input.liveSessionId || ''),
    String(input.liveSessionLabel || ''),
    String(input.objectives || ''),
    String(input.activities || ''),
    String(input.assessment || ''),
    String(input.notes || ''),
    JSON.stringify(resources),
    String(existing?.reviewComment || input.reviewComment || ''),
    String(existing?.reviewedBy || input.reviewedBy || ''),
    String(existing?.reviewedByName || input.reviewedByName || ''),
    String(existing?.reviewedAt || input.reviewedAt || ''),
    submittedAt,
    String(existing?.createdAt || now),
    now,
  ).run()

  const saved = await getLessonPlanById(db, String(input.tenantId || ''), lessonPlanId)
  if (saved) {
    await saveLessonPlanVersion(db, lessonPlanId, String(input.actorId || input.teacherId || ''), String(input.changeNote || ''), saved)
  }

  return saved
}

export async function reviewLessonPlan(db: D1Database, input: Record<string, any>) {
  await ensureLessonPlanTables(db)

  const existing = await getLessonPlanById(db, String(input.tenantId || ''), String(input.id || ''))
  if (!existing) return null

  const now = new Date().toISOString()
  const nextStatus = String(input.status || '').toLowerCase() === 'approved' ? 'approved' : 'returned'

  await db.prepare(
    `UPDATE lesson_plans
     SET status = ?, review_comment = ?, reviewed_by = ?, reviewed_by_name = ?, reviewed_at = ?, updated_at = ?
     WHERE tenant_id = ? AND id = ?`
  ).bind(
    nextStatus,
    String(input.reviewComment || ''),
    String(input.reviewedBy || ''),
    String(input.reviewedByName || ''),
    now,
    now,
    String(input.tenantId || ''),
    String(input.id || ''),
  ).run()

  const saved = await getLessonPlanById(db, String(input.tenantId || ''), String(input.id || ''))
  if (saved) {
    await saveLessonPlanVersion(db, String(input.id || ''), String(input.reviewedBy || ''), `Review: ${nextStatus}`, saved)
  }

  return saved
}

export async function listLessonPlanVersions(db: D1Database, lessonPlanId: string, limit = 12) {
  await ensureLessonPlanTables(db)
  const rows = await db.prepare(
    `SELECT id, lesson_plan_id, changed_by, change_note, snapshot_json, created_at FROM lesson_plan_versions WHERE lesson_plan_id = ? ORDER BY created_at DESC LIMIT ?`
  ).bind(lessonPlanId, limit).all()

  return ((rows.results || []) as Record<string, any>[]).map(row => ({
    id: row.id,
    lessonPlanId: row.lesson_plan_id,
    changedBy: String(row.changed_by || ''),
    changeNote: String(row.change_note || ''),
    snapshot: parseJsonField(row.snapshot_json, {} as Record<string, any>),
    createdAt: String(row.created_at || ''),
  }))
}