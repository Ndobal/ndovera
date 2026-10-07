// Which teacher taught which class and subject, session by session.
//
// The live assignment fields (`subjects.teacherId`, `classes.classTeacherId` and
// teacher rows in `class_memberships`) describe the session that is running now.
// This ledger keeps them per session, so moving to a new session can release
// every live assignment without losing who taught what:
//
//   2026/2027 → JSS 1A → Mathematics → Teacher A   (kept here for good)
//
// Academic continuity is automatic; teacher assignment is administrative. When a
// session hands over to the next, the outgoing assignments are recorded and the
// live ones cleared, and the school's administrators assign the new session's
// teachers — optionally by confirming last session's rows one by one.
//
// Rows are tenant-scoped. A teacher who moves to another school keeps their
// account, but nothing here is visible from the other tenant.

export type AssignmentRole = 'subject' | 'class_teacher' | 'co_teacher'

export type LiveAssignment = {
  role: AssignmentRole
  classId: string
  className: string
  subjectId: string
  subjectName: string
  teacherId: string
}

let _tableReady = false
export function resetTeachingAssignmentsCache() {
  _tableReady = false
}

export async function ensureTeachingAssignmentsTable(db: D1Database) {
  if (_tableReady) return
  await db.prepare(`CREATE TABLE IF NOT EXISTS teaching_assignments (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    session_name TEXT,
    role TEXT NOT NULL,
    class_id TEXT NOT NULL,
    class_name TEXT,
    subject_id TEXT NOT NULL DEFAULT '',
    subject_name TEXT,
    teacher_id TEXT NOT NULL,
    first_seen_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL,
    ended_at TEXT
  )`).run()
  for (const statement of [
    `CREATE INDEX IF NOT EXISTS idx_teaching_assignments_session ON teaching_assignments(tenant_id, session_id, class_id)`,
    `CREATE INDEX IF NOT EXISTS idx_teaching_assignments_teacher ON teaching_assignments(tenant_id, teacher_id)`,
  ]) {
    try { await db.prepare(statement).run() } catch {}
  }
  _tableReady = true
}

function assignmentId(tenantId: string, sessionId: string, item: LiveAssignment) {
  return ['tassign', tenantId, sessionId, item.role, item.classId, item.subjectId, item.teacherId.trim().toLowerCase()].join('|')
}

function className(row: Record<string, any>) {
  return `${row.name || ''}${row.arm ? ` ${row.arm}` : ''}`.trim()
}

/** Every teacher assignment that is live right now. Tolerates tables a school has never created. */
export async function loadLiveAssignments(db: D1Database, tenantId: string): Promise<LiveAssignment[]> {
  const empty = { results: [] as Record<string, any>[] }
  const [subjects, classes, members] = await Promise.all([
    db.prepare(`SELECT s.id, s.name, s.classId, s.teacherId, c.name AS className, c.arm AS classArm
      FROM subjects s JOIN classes c ON c.id = s.classId AND c.tenantId = ?
      WHERE s.tenantId = ? AND COALESCE(s.teacherId, '') != ''`).bind(tenantId, tenantId).all().catch(() => empty),
    db.prepare(`SELECT id, name, arm, classTeacherId FROM classes WHERE tenantId = ? AND COALESCE(classTeacherId, '') != ''`)
      .bind(tenantId).all().catch(() => empty),
    db.prepare(`SELECT m.class_id, m.user_id, c.name, c.arm FROM class_memberships m
      JOIN classes c ON c.id = m.class_id AND c.tenantId = m.tenant_id
      WHERE m.tenant_id = ? AND m.membership_role = 'teacher'`).bind(tenantId).all().catch(() => empty),
  ])
  const live: LiveAssignment[] = []
  for (const row of (subjects.results || []) as Record<string, any>[]) {
    live.push({ role: 'subject', classId: String(row.classId), className: className({ name: row.className, arm: row.classArm }), subjectId: String(row.id), subjectName: String(row.name || ''), teacherId: String(row.teacherId) })
  }
  const classTeachers = new Set<string>()
  for (const row of (classes.results || []) as Record<string, any>[]) {
    classTeachers.add(`${row.id}|${String(row.classTeacherId).trim().toLowerCase()}`)
    live.push({ role: 'class_teacher', classId: String(row.id), className: className(row), subjectId: '', subjectName: '', teacherId: String(row.classTeacherId) })
  }
  for (const row of (members.results || []) as Record<string, any>[]) {
    // The class teacher is mirrored into memberships; record them once.
    if (classTeachers.has(`${row.class_id}|${String(row.user_id).trim().toLowerCase()}`)) continue
    live.push({ role: 'co_teacher', classId: String(row.class_id), className: className(row), subjectId: '', subjectName: '', teacherId: String(row.user_id) })
  }
  return live
}

/**
 * Bring a session's ledger in line with the live assignments: record new ones,
 * close ones that have been removed, and reopen any that were restored.
 */
export async function recordLiveAssignments(db: D1Database, options: { tenantId: string, sessionId: string, sessionName?: string }) {
  await ensureTeachingAssignmentsTable(db)
  const live = await loadLiveAssignments(db, options.tenantId)
  const timestamp = new Date().toISOString()
  const statements: D1PreparedStatement[] = live.map(item => db.prepare(`INSERT INTO teaching_assignments
      (id, tenant_id, session_id, session_name, role, class_id, class_name, subject_id, subject_name, teacher_id, first_seen_at, last_seen_at, ended_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
    ON CONFLICT(id) DO UPDATE SET class_name = excluded.class_name, subject_name = excluded.subject_name,
      session_name = COALESCE(excluded.session_name, session_name), last_seen_at = excluded.last_seen_at, ended_at = NULL`).bind(
    assignmentId(options.tenantId, options.sessionId, item), options.tenantId, options.sessionId, options.sessionName || null,
    item.role, item.classId, item.className, item.subjectId, item.subjectName, item.teacherId, timestamp, timestamp,
  ))
  const liveIds = live.map(item => assignmentId(options.tenantId, options.sessionId, item))
  statements.push(db.prepare(`UPDATE teaching_assignments SET ended_at = ?
    WHERE tenant_id = ? AND session_id = ? AND ended_at IS NULL
      AND id NOT IN (SELECT value FROM json_each(?))`).bind(timestamp, options.tenantId, options.sessionId, JSON.stringify(liveIds)))
  await db.batch(statements)
  return live.length
}

/**
 * Release every live teacher assignment for a new session. History is in the
 * ledger, so callers must record the outgoing session first.
 */
export async function clearLiveAssignments(db: D1Database, tenantId: string) {
  const live = await loadLiveAssignments(db, tenantId)
  if (!live.length) return 0
  await db.batch([
    db.prepare(`UPDATE subjects SET teacherId = NULL WHERE tenantId = ? AND COALESCE(teacherId, '') != ''`).bind(tenantId),
    db.prepare(`UPDATE classes SET classTeacherId = NULL WHERE tenantId = ? AND COALESCE(classTeacherId, '') != ''`).bind(tenantId),
    db.prepare(`DELETE FROM class_memberships WHERE tenant_id = ? AND membership_role = 'teacher'`).bind(tenantId),
    // Staff settings carry their class-teacher class; students' placements are untouched.
    db.prepare(`UPDATE settings SET payload = json_remove(payload, '$.classId', '$.className', '$.classArm')
      WHERE json_valid(payload) AND json_extract(payload, '$.tenantId') = ?
        AND lower(COALESCE(json_extract(payload, '$.role'), '')) NOT IN ('', 'student', 'parent')
        AND json_extract(payload, '$.classId') IS NOT NULL`).bind(tenantId),
  ])
  return live.length
}

export async function listSessionAssignments(db: D1Database, tenantId: string, sessionId: string) {
  await ensureTeachingAssignmentsTable(db)
  const rows = await db.prepare(`SELECT t.*, (SELECT u.name FROM users u WHERE u.tenantId = t.tenant_id
      AND (lower(u.id) = lower(t.teacher_id) OR lower(u.email) = lower(t.teacher_id)) LIMIT 1) AS teacher_name
    FROM teaching_assignments t WHERE t.tenant_id = ? AND t.session_id = ?
    ORDER BY t.class_name, t.role, t.subject_name`).bind(tenantId, sessionId).all()
  return (rows.results || []) as Record<string, any>[]
}

export async function listTeachingHistory(db: D1Database, tenantId: string, teacherIdentifiers: string[]) {
  await ensureTeachingAssignmentsTable(db)
  if (!teacherIdentifiers.length) return []
  const rows = await db.prepare(`SELECT t.*, s.status AS session_status, s.start_date AS session_start
    FROM teaching_assignments t LEFT JOIN academic_sessions s ON s.id = t.session_id AND s.tenant_id = t.tenant_id
    WHERE t.tenant_id = ? AND lower(trim(t.teacher_id)) IN (SELECT value FROM json_each(?))
    ORDER BY COALESCE(s.start_date, t.first_seen_at) DESC, t.class_name, t.subject_name`
  ).bind(tenantId, JSON.stringify(teacherIdentifiers.map(value => value.trim().toLowerCase()))).all().catch(() => ({ results: [] }))
  return (rows.results || []) as Record<string, any>[]
}

/**
 * An administrator confirming last session's assignments for the new one. Only
 * fills empty slots: an assignment already made for this session always wins.
 * Subjects and classes are matched by id, so a class or subject removed since is
 * skipped rather than recreated.
 */
export async function carryForwardAssignments(db: D1Database, options: { tenantId: string, fromSessionId: string, assignmentIds: string[] }) {
  await ensureTeachingAssignmentsTable(db)
  const rows = await db.prepare(`SELECT * FROM teaching_assignments WHERE tenant_id = ? AND session_id = ?
    AND id IN (SELECT value FROM json_each(?))`).bind(options.tenantId, options.fromSessionId, JSON.stringify(options.assignmentIds)).all()
  const timestamp = new Date().toISOString()
  let applied = 0
  const classTeacherClassIds: string[] = []
  for (const row of (rows.results || []) as Record<string, any>[]) {
    let result: D1Result | null = null
    if (row.role === 'subject') {
      result = await db.prepare(`UPDATE subjects SET teacherId = ? WHERE id = ? AND tenantId = ? AND classId = ? AND COALESCE(teacherId, '') = ''`)
        .bind(row.teacher_id, row.subject_id, options.tenantId, row.class_id).run()
    } else if (row.role === 'class_teacher') {
      result = await db.prepare(`UPDATE classes SET classTeacherId = ? WHERE id = ? AND tenantId = ? AND COALESCE(classTeacherId, '') = ''`)
        .bind(row.teacher_id, row.class_id, options.tenantId).run()
      if (result.meta?.changes) classTeacherClassIds.push(String(row.class_id))
    }
    if (row.role !== 'subject') {
      const exists = await db.prepare(`SELECT 1 FROM classes WHERE id = ? AND tenantId = ?`).bind(row.class_id, options.tenantId).first()
      if (exists) {
        const member = await db.prepare(`INSERT OR IGNORE INTO class_memberships (id, tenant_id, class_id, user_id, membership_role, created_at, updated_at)
          VALUES (?, ?, ?, ?, 'teacher', ?, ?)`).bind(
          `classmember_${options.tenantId}_${row.class_id}_teacher_${String(row.teacher_id).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80)}`,
          options.tenantId, row.class_id, row.teacher_id, timestamp, timestamp,
        ).run()
        if (row.role === 'co_teacher') result = member
      }
    }
    if (result?.meta?.changes) applied += 1
  }
  return { applied, requested: options.assignmentIds.length, classTeacherClassIds }
}
