// Topics as learning hubs: Class → Subject → Topic → notes, materials,
// assignments and quizzes → study with Ndovera AI.
//
// A topic belongs to one class and subject (`class_topics`). Content points at
// it by `metadata.topicId`; content saved before topics had ids is still found
// by its topic name within the same subject. Removing a topic never deletes the
// content filed under it — it is moved to another topic or left unassigned.
// Every topic change is written to the append-only `topic_audit`.
//
// Progress (`topic_progress`) records what a student has done — opened the
// topic, studied with the AI, viewed materials — and reads submissions for
// assignment and quiz completion. It never declares that a student has
// mastered a topic: formal completion comes from assessment and the teacher.

export class TopicError extends Error {
  status: number
  details: Record<string, any>
  constructor(message: string, status = 400, details: Record<string, any> = {}) {
    super(message)
    this.status = status
    this.details = details
  }
}

let _ready = false
export function resetTopicHubCache() {
  _ready = false
}

export async function ensureTopicHubTables(db: D1Database) {
  if (_ready) return
  await db.prepare(`CREATE TABLE IF NOT EXISTS class_topics (
    id TEXT PRIMARY KEY,
    tenant_id TEXT,
    class_id TEXT,
    subject_id TEXT,
    name TEXT,
    created_by TEXT,
    created_at TEXT
  )`).run()
  for (const column of ['sort_order INTEGER', 'description TEXT', 'week TEXT', 'objectives TEXT', 'term_id TEXT', 'status TEXT', 'updated_by TEXT', 'updated_at TEXT']) {
    try { await db.exec(`ALTER TABLE class_topics ADD COLUMN ${column}`) } catch {}
  }
  await db.prepare(`CREATE TABLE IF NOT EXISTS topic_audit (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    class_id TEXT NOT NULL,
    subject_id TEXT,
    topic_id TEXT NOT NULL,
    action TEXT NOT NULL,
    actor_id TEXT,
    actor_name TEXT,
    before_json TEXT,
    after_json TEXT,
    created_at TEXT NOT NULL
  )`).run()
  await db.prepare(`CREATE TABLE IF NOT EXISTS topic_progress (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    topic_id TEXT NOT NULL,
    student_id TEXT NOT NULL,
    opened_at TEXT,
    studied_at TEXT,
    viewed_material_ids TEXT,
    updated_at TEXT NOT NULL,
    UNIQUE(topic_id, student_id)
  )`).run()
  _ready = true
}

export function mapTopicRow(row: Record<string, any>) {
  let objectives: string[] = []
  try { objectives = JSON.parse(String(row.objectives || '[]')) } catch {}
  return {
    id: String(row.id || ''),
    classId: String(row.class_id || ''),
    subjectId: String(row.subject_id || ''),
    name: String(row.name || ''),
    description: String(row.description || ''),
    week: String(row.week || ''),
    objectives: Array.isArray(objectives) ? objectives.map(String) : [],
    termId: String(row.term_id || ''),
    // Topics from before publishing existed were always visible to students.
    status: row.status === 'draft' ? 'draft' : 'published',
    sortOrder: row.sort_order == null ? null : Number(row.sort_order),
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  }
}

export async function getTopic(db: D1Database, classId: string, topicId: string) {
  await ensureTopicHubTables(db)
  const row = await db.prepare(`SELECT * FROM class_topics WHERE id = ? AND class_id = ?`).bind(topicId, classId).first() as Record<string, any> | null
  return row ? mapTopicRow(row) : null
}

export async function listTopics(db: D1Database, classId: string, subjectId = '', { publishedOnly = false } = {}) {
  await ensureTopicHubTables(db)
  const filters = ['class_id = ?']
  const params: unknown[] = [classId]
  if (subjectId) { filters.push('subject_id = ?'); params.push(subjectId) }
  if (publishedOnly) filters.push(`COALESCE(status, 'published') = 'published'`)
  const rows = await db.prepare(`SELECT * FROM class_topics WHERE ${filters.join(' AND ')} ORDER BY COALESCE(sort_order, 999999), name`).bind(...params).all()
  return ((rows.results || []) as Record<string, any>[]).map(mapTopicRow)
}

export async function recordTopicAudit(db: D1Database, entry: {
  tenantId: string, classId: string, subjectId?: string, topicId: string, action: string,
  actorId?: string, actorName?: string, before?: unknown, after?: unknown,
}) {
  await ensureTopicHubTables(db)
  await db.prepare(`INSERT INTO topic_audit (id, tenant_id, class_id, subject_id, topic_id, action, actor_id, actor_name, before_json, after_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
    `topaud-${crypto.randomUUID()}`, entry.tenantId, entry.classId, entry.subjectId || null, entry.topicId, entry.action,
    entry.actorId || null, entry.actorName || null,
    entry.before === undefined ? null : JSON.stringify(entry.before), entry.after === undefined ? null : JSON.stringify(entry.after),
    new Date().toISOString(),
  ).run()
}

function normalizeObjectives(value: unknown) {
  const list = Array.isArray(value) ? value : String(value || '').split('\n')
  return list.map(item => String(item || '').trim()).filter(Boolean).slice(0, 20).map(item => item.slice(0, 300))
}

export async function updateTopic(db: D1Database, options: {
  tenantId: string, classId: string, topicId: string, changes: Record<string, any>, actorId?: string, actorName?: string,
}) {
  const before = await getTopic(db, options.classId, options.topicId)
  if (!before) throw new TopicError('Topic not found.', 404)
  const has = (key: string) => Object.prototype.hasOwnProperty.call(options.changes, key)
  const name = has('name') ? String(options.changes.name || '').replace(/\s+/g, ' ').trim() : before.name
  if (!name) throw new TopicError('Topic name is required.')
  if (name.toLowerCase() !== before.name.toLowerCase()) {
    const clash = await db.prepare(`SELECT id FROM class_topics WHERE class_id = ? AND subject_id = ? AND lower(name) = lower(?) AND id != ?`)
      .bind(options.classId, before.subjectId, name, options.topicId).first()
    if (clash) throw new TopicError(`This subject already has a topic called "${name}".`, 409)
  }
  const after = {
    ...before,
    name,
    description: has('description') ? String(options.changes.description || '').trim().slice(0, 4000) : before.description,
    week: has('week') ? String(options.changes.week || '').trim().slice(0, 60) : before.week,
    objectives: has('objectives') ? normalizeObjectives(options.changes.objectives) : before.objectives,
    termId: has('termId') ? String(options.changes.termId || '') : before.termId,
    status: has('status') ? (options.changes.status === 'draft' ? 'draft' : 'published') : before.status,
  }
  const timestamp = new Date().toISOString()
  await db.prepare(`UPDATE class_topics SET name = ?, description = ?, week = ?, objectives = ?, term_id = ?, status = ?, updated_by = ?, updated_at = ?
    WHERE id = ? AND class_id = ?`).bind(
    after.name, after.description || null, after.week || null, JSON.stringify(after.objectives), after.termId || null, after.status,
    options.actorId || null, timestamp, options.topicId, options.classId,
  ).run()

  // Content filed under the old name moves with the rename, and gains the id.
  if (after.name !== before.name) {
    await db.prepare(`UPDATE materials SET metadata = json_set(metadata, '$.topic', ?, '$.topicId', ?)
      WHERE classId = ? AND json_valid(metadata) AND json_extract(metadata, '$.subjectId') = ?
        AND (json_extract(metadata, '$.topicId') = ? OR (json_extract(metadata, '$.topicId') IS NULL AND lower(trim(json_extract(metadata, '$.topic'))) = lower(?)))`)
      .bind(after.name, options.topicId, options.classId, before.subjectId, options.topicId, before.name).run().catch(() => null)
    await db.prepare(`UPDATE assignments SET metadata = json_set(metadata, '$.topic', ?, '$.topicId', ?)
      WHERE classId = ? AND subjectId = ? AND json_valid(metadata)
        AND (json_extract(metadata, '$.topicId') = ? OR (json_extract(metadata, '$.topicId') IS NULL AND lower(trim(json_extract(metadata, '$.topic'))) = lower(?)))`)
      .bind(after.name, options.topicId, options.classId, before.subjectId, options.topicId, before.name).run().catch(() => null)
  }

  await recordTopicAudit(db, {
    tenantId: options.tenantId, classId: options.classId, subjectId: before.subjectId, topicId: options.topicId,
    action: before.status !== after.status ? (after.status === 'published' ? 'published' : 'unpublished') : 'edited',
    actorId: options.actorId, actorName: options.actorName, before, after,
  })
  return after
}

// Content belongs to a topic by id, or — for content saved before ids — by name within the subject.
const MATERIAL_IN_TOPIC = `classId = ? AND json_valid(metadata) AND json_extract(metadata, '$.subjectId') = ?
  AND (json_extract(metadata, '$.topicId') = ? OR (json_extract(metadata, '$.topicId') IS NULL AND lower(trim(json_extract(metadata, '$.topic'))) = lower(?)))`
const ASSIGNMENT_IN_TOPIC = `classId = ? AND subjectId = ? AND json_valid(metadata)
  AND (json_extract(metadata, '$.topicId') = ? OR (json_extract(metadata, '$.topicId') IS NULL AND lower(trim(json_extract(metadata, '$.topic'))) = lower(?)))`

export async function countTopicContent(db: D1Database, topic: ReturnType<typeof mapTopicRow>) {
  const binds = [topic.classId, topic.subjectId, topic.id, topic.name]
  const [materials, assignments] = await Promise.all([
    db.prepare(`SELECT COUNT(*) AS n FROM materials WHERE ${MATERIAL_IN_TOPIC} AND COALESCE(json_extract(metadata, '$.status'), 'published') != 'deleted'`).bind(...binds).first().catch(() => ({ n: 0 })) as Promise<Record<string, any>>,
    db.prepare(`SELECT COUNT(*) AS n FROM assignments WHERE ${ASSIGNMENT_IN_TOPIC}`).bind(...binds).first().catch(() => ({ n: 0 })) as Promise<Record<string, any>>,
  ])
  return { materials: Number(materials?.n || 0), assignments: Number(assignments?.n || 0) }
}

/**
 * Remove a topic. If content is filed under it, the caller must say what
 * happens to it: `move` to another topic in the same subject, or `unassign`.
 * The content itself is never deleted here.
 */
export async function removeTopic(db: D1Database, options: {
  tenantId: string, classId: string, topicId: string, contentAction?: string, targetTopicId?: string, actorId?: string, actorName?: string,
}) {
  const topic = await getTopic(db, options.classId, options.topicId)
  if (!topic) throw new TopicError('Topic not found.', 404)
  const counts = await countTopicContent(db, topic)
  const hasContent = counts.materials + counts.assignments > 0
  const action = String(options.contentAction || '')
  if (hasContent && !['move', 'unassign'].includes(action)) {
    throw new TopicError('This topic has content. Choose whether to move it to another topic or leave it unassigned.', 409, { content: counts })
  }

  let target: ReturnType<typeof mapTopicRow> | null = null
  if (hasContent && action === 'move') {
    target = options.targetTopicId ? await getTopic(db, options.classId, options.targetTopicId) : null
    if (!target || target.subjectId !== topic.subjectId || target.id === topic.id) {
      throw new TopicError('Choose another topic in the same subject to move the content to.')
    }
  }

  const binds = [topic.classId, topic.subjectId, topic.id, topic.name]
  if (hasContent) {
    const setMaterial = target
      ? `json_set(metadata, '$.topic', ?, '$.topicId', ?)`
      : `json_remove(json_set(metadata, '$.topic', ''), '$.topicId')`
    const targetBinds = target ? [target.name, target.id] : []
    await db.prepare(`UPDATE materials SET metadata = ${setMaterial} WHERE ${MATERIAL_IN_TOPIC}`).bind(...targetBinds, ...binds).run()
    await db.prepare(`UPDATE assignments SET metadata = ${setMaterial} WHERE ${ASSIGNMENT_IN_TOPIC}`).bind(...targetBinds, ...binds).run().catch(() => null)
  }
  await db.prepare(`DELETE FROM class_topics WHERE id = ? AND class_id = ?`).bind(topic.id, topic.classId).run()
  await recordTopicAudit(db, {
    tenantId: options.tenantId, classId: topic.classId, subjectId: topic.subjectId, topicId: topic.id, action: 'removed',
    actorId: options.actorId, actorName: options.actorName, before: topic,
    after: { content: counts, contentAction: hasContent ? action : 'none', movedTo: target?.id || null },
  })
  return { removed: topic, content: counts, movedTo: target }
}

const QUIZ_FORMATS = new Set(['objective', 'multiplechoice', 'multiple_choice', 'mcq', 'truefalse', 'true_false', 'fillgaps', 'fill_gaps', 'shortanswer', 'matching', 'quiz'])

export function isQuizAssignment(assignment: Record<string, any>) {
  const metadata = typeof assignment.metadata === 'string' ? (() => { try { return JSON.parse(assignment.metadata) } catch { return {} } })() : (assignment.metadata || {})
  return metadata.kind === 'quiz' || QUIZ_FORMATS.has(String(assignment.format || '').toLowerCase())
}

/** Materials and assignments filed under a topic, newest first. Visibility filtering is the caller's. */
export async function listTopicContent(db: D1Database, topic: ReturnType<typeof mapTopicRow>) {
  const binds = [topic.classId, topic.subjectId, topic.id, topic.name]
  const [materials, assignments] = await Promise.all([
    db.prepare(`SELECT id, classId, title, url, metadata, uploadedAt, uploadedBy FROM materials WHERE ${MATERIAL_IN_TOPIC} ORDER BY uploadedAt DESC`).bind(...binds).all().catch(() => ({ results: [] })),
    db.prepare(`SELECT * FROM assignments WHERE ${ASSIGNMENT_IN_TOPIC} ORDER BY createdAt DESC`).bind(...binds).all().catch(() => ({ results: [] })),
  ])
  return {
    materials: (materials.results || []) as Record<string, any>[],
    assignments: (assignments.results || []) as Record<string, any>[],
  }
}

export async function recordTopicProgress(db: D1Database, options: { tenantId: string, topicId: string, studentId: string, event: string, materialId?: string }) {
  await ensureTopicHubTables(db)
  const now = new Date().toISOString()
  const existing = await db.prepare(`SELECT * FROM topic_progress WHERE topic_id = ? AND student_id = ?`).bind(options.topicId, options.studentId).first() as Record<string, any> | null
  let viewed: string[] = []
  try { viewed = JSON.parse(String(existing?.viewed_material_ids || '[]')) } catch {}
  if (options.event === 'material_viewed' && options.materialId && !viewed.includes(options.materialId)) viewed.push(options.materialId)
  await db.prepare(`INSERT INTO topic_progress (id, tenant_id, topic_id, student_id, opened_at, studied_at, viewed_material_ids, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(topic_id, student_id) DO UPDATE SET
      opened_at = COALESCE(topic_progress.opened_at, excluded.opened_at),
      studied_at = COALESCE(topic_progress.studied_at, excluded.studied_at),
      viewed_material_ids = excluded.viewed_material_ids,
      updated_at = excluded.updated_at`).bind(
    `topprog-${crypto.randomUUID()}`, options.tenantId, options.topicId, options.studentId,
    now, options.event === 'studied' ? now : null, JSON.stringify(viewed), now,
  ).run()
}

/**
 * Where a student stands on a topic, from what they did and what they handed
 * in. Stages: Not Started → Studying → Materials Viewed → Assignment Completed
 * → Quiz Completed. Activity, not mastery.
 */
export async function getTopicProgress(db: D1Database, options: { topicId: string, studentIds: string[], materialIds: string[], assignments: Record<string, any>[] }) {
  await ensureTopicHubTables(db)
  const row = options.studentIds.length
    ? await db.prepare(`SELECT * FROM topic_progress WHERE topic_id = ? AND student_id IN (SELECT value FROM json_each(?)) ORDER BY updated_at DESC LIMIT 1`)
      .bind(options.topicId, JSON.stringify(options.studentIds)).first() as Record<string, any> | null
    : null
  let viewed: string[] = []
  try { viewed = JSON.parse(String(row?.viewed_material_ids || '[]')) } catch {}

  const assignmentIds = options.assignments.map(item => String(item.id))
  const submitted = new Set<string>()
  if (assignmentIds.length && options.studentIds.length) {
    const rows = await db.prepare(`SELECT DISTINCT assignmentId FROM submissions WHERE assignmentId IN (SELECT value FROM json_each(?))
      AND lower(studentId) IN (SELECT lower(value) FROM json_each(?))`).bind(JSON.stringify(assignmentIds), JSON.stringify(options.studentIds)).all().catch(() => ({ results: [] }))
    for (const entry of (rows.results || []) as Record<string, any>[]) submitted.add(String(entry.assignmentId))
  }
  const quizzes = options.assignments.filter(isQuizAssignment)
  const tasks = options.assignments.filter(item => !isQuizAssignment(item))
  const viewedCount = options.materialIds.filter(id => viewed.includes(id)).length

  const stages = {
    studying: Boolean(row?.opened_at || row?.studied_at),
    materialsViewed: options.materialIds.length > 0 && viewedCount === options.materialIds.length,
    assignmentCompleted: tasks.length > 0 && tasks.every(item => submitted.has(String(item.id))),
    quizCompleted: quizzes.length > 0 && quizzes.every(item => submitted.has(String(item.id))),
  }
  const order: Array<[keyof typeof stages, string]> = [['quizCompleted', 'Quiz Completed'], ['assignmentCompleted', 'Assignment Completed'], ['materialsViewed', 'Materials Viewed'], ['studying', 'Studying']]
  const label = order.find(([key]) => stages[key])?.[1] || 'Not Started'
  return {
    label,
    stages,
    counts: {
      materials: options.materialIds.length, materialsViewed: viewedCount,
      assignments: tasks.length, assignmentsSubmitted: tasks.filter(item => submitted.has(String(item.id))).length,
      quizzes: quizzes.length, quizzesSubmitted: quizzes.filter(item => submitted.has(String(item.id))).length,
    },
    viewedMaterialIds: viewed,
  }
}

/**
 * What the AI may draw on for a topic: the teacher's own published notes,
 * marked as the teacher's, trimmed to a sensible length.
 */
export function buildTeacherNotesContext(materials: Array<Record<string, any>>, limit = 6000) {
  const parts: string[] = []
  let used = 0
  for (const material of materials) {
    const meta = material.metadata || {}
    const text = String(meta.description || '').trim()
    const piece = [`Title: ${material.title || 'Untitled'}`, material.url ? `(attached file, type ${meta.type || 'document'})` : '', text].filter(Boolean).join('\n')
    if (!piece) continue
    if (used + piece.length > limit) {
      parts.push(piece.slice(0, Math.max(0, limit - used)))
      break
    }
    parts.push(piece)
    used += piece.length
  }
  return parts.join('\n---\n')
}

