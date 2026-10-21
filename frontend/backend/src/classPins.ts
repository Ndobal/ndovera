// Class pins: a student stays in their class until someone with the authority to move
// them does, and every move is on record.
//
//   - Each student has a pinned class (`student_class_pins`). It changes only through a
//     recorded change: a move by the Owner, Head of School or ICT, a promotion or
//     graduation, a new admission, or a placement where they had none.
//   - Every write to a student's settings passes through `guardStudentClass` (db.ts →
//     upsertSettings). A write that would change or clear the class without such a change —
//     a profile form sent with an empty class field, a sync that rebuilt the record without
//     it — keeps the pinned class, and the attempt is logged as blocked.
//   - The nightly monitor (`monitorClassPins`) compares every student's class with their
//     pin. A class that changed with nothing on record is put back and logged; a student
//     placed without a pin gets one. Students with no class are left for the school to place.
//   - `student_class_history` is append-only: changed, placed, blocked, restored, pinned.

export type ClassChange = {
  /** Who made it (user id), their name and role; 'system' for promotion and session rollover. */
  by: string, byName?: string, role: string,
  reason: 'manual' | 'promotion' | 'graduation' | 'left' | 'session' | 'admission' | 'import' | 'roster' | 'class-deleted'
}

/** Who may move a student between classes by hand. */
export const CLASS_CHANGE_ROLES = ['owner', 'hos', 'ict', 'ict_manager', 'ami']
const SYSTEM_REASONS = new Set(['promotion', 'graduation', 'left', 'session', 'admission', 'import', 'class-deleted'])

export function isAuthorisedChange(change?: ClassChange | null) {
  if (!change) return false
  if (SYSTEM_REASONS.has(change.reason)) return true
  return CLASS_CHANGE_ROLES.includes(String(change.role || '').toLowerCase())
}

const now = () => new Date().toISOString()
const newId = () => `clh_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`

export function isStudentPayload(payload: Record<string, any> | null | undefined) {
  if (!payload || typeof payload !== 'object') return false
  const role = String(payload.role || payload.primaryRole || '').toLowerCase()
  const roles = Array.isArray(payload.roles) ? payload.roles.map((item: unknown) => String(item).toLowerCase()) : []
  return role === 'student' || roles.includes('student')
}

const readyDbs = new WeakSet<object>()
export async function ensureClassPinTables(db: D1Database) {
  if (readyDbs.has(db as object)) return
  for (const statement of [
    `CREATE TABLE IF NOT EXISTS student_class_pins (
      student_id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, settings_key TEXT, class_id TEXT NOT NULL, class_name TEXT, class_arm TEXT,
      pinned_at TEXT NOT NULL, pinned_by TEXT, pinned_by_name TEXT, pinned_by_role TEXT, reason TEXT)`,
    `CREATE INDEX IF NOT EXISTS idx_student_class_pins_tenant ON student_class_pins(tenant_id)`,
    `CREATE TABLE IF NOT EXISTS student_class_history (
      id TEXT PRIMARY KEY, tenant_id TEXT, student_id TEXT NOT NULL, settings_key TEXT, from_class_id TEXT, from_class_name TEXT, to_class_id TEXT, to_class_name TEXT,
      outcome TEXT NOT NULL, reason TEXT, by_id TEXT, by_name TEXT, by_role TEXT, at TEXT NOT NULL)`,
    `CREATE INDEX IF NOT EXISTS idx_student_class_history_student ON student_class_history(student_id, at)`,
    `CREATE INDEX IF NOT EXISTS idx_student_class_history_tenant ON student_class_history(tenant_id, at)`,
  ]) await db.prepare(statement).run()
  readyDbs.add(db as object)
}

const classLabel = (name: unknown, arm: unknown) => [name, arm].map(value => String(value ?? '').trim()).filter(Boolean).join(' ')

/** Statements recording a class event (and, unless blocked, the new pin). For batching with the write itself. */
export function classEventStatements(db: D1Database, event: {
  tenantId: string, studentId: string, settingsKey?: string, from?: { id?: unknown, name?: unknown, arm?: unknown }, to?: { id?: unknown, name?: unknown, arm?: unknown },
  outcome: 'changed' | 'placed' | 'blocked' | 'restored' | 'pinned' | 'cleared', change?: ClassChange | null,
}) {
  const at = now()
  const toId = String(event.to?.id || '')
  const statements = [db.prepare(`INSERT INTO student_class_history (id, tenant_id, student_id, settings_key, from_class_id, from_class_name, to_class_id, to_class_name, outcome, reason, by_id, by_name, by_role, at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(newId(), event.tenantId || null, event.studentId, event.settingsKey || null,
    String(event.from?.id || '') || null, classLabel(event.from?.name, event.from?.arm) || null, toId || null, classLabel(event.to?.name, event.to?.arm) || null,
    event.outcome, event.change?.reason || null, event.change?.by || null, event.change?.byName || null, event.change?.role || null, at)]
  if (event.outcome === 'blocked') return statements
  if (toId) {
    statements.push(db.prepare(`INSERT INTO student_class_pins (student_id, tenant_id, settings_key, class_id, class_name, class_arm, pinned_at, pinned_by, pinned_by_name, pinned_by_role, reason)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(student_id) DO UPDATE SET tenant_id = excluded.tenant_id, settings_key = excluded.settings_key, class_id = excluded.class_id,
      class_name = excluded.class_name, class_arm = excluded.class_arm, pinned_at = excluded.pinned_at, pinned_by = excluded.pinned_by, pinned_by_name = excluded.pinned_by_name,
      pinned_by_role = excluded.pinned_by_role, reason = excluded.reason`).bind(event.studentId, event.tenantId, event.settingsKey || null, toId,
      String(event.to?.name || '') || null, String(event.to?.arm || '') || null, at, event.change?.by || null, event.change?.byName || null, event.change?.role || null, event.change?.reason || (event.outcome === 'pinned' ? 'baseline' : null)))
  } else if (event.outcome === 'changed' || event.outcome === 'cleared') {
    // An authorised removal (graduation, left the school, class deleted): the pin goes too.
    statements.push(db.prepare(`DELETE FROM student_class_pins WHERE student_id = ?`).bind(event.studentId))
  }
  return statements
}

/**
 * The current session's register follows a recorded class change. Fees, class lists,
 * results and attendance read the register (session_enrollments); a class set on the
 * People page alone left a student "unplaced" there. Only the running session's active
 * row changes; history in earlier sessions is never touched.
 */
export function registerSyncStatement(db: D1Database, options: { tenantId: string, studentId: string, classId: string, className?: unknown, classArm?: unknown }) {
  return db.prepare(`UPDATE session_enrollments SET class_id = ?, class_name = ?, class_arm = ?, updated_at = ?
    WHERE tenant_id = ? AND student_id = ? AND COALESCE(status, 'active') = 'active' AND COALESCE(class_id, '') != ?
      AND session_id IN (SELECT id FROM academic_sessions WHERE tenant_id = ? AND status = 'active')`)
    .bind(options.classId, String(options.className || '') || null, String(options.classArm || '') || null, now(), options.tenantId, options.studentId, options.classId, options.tenantId)
}

async function syncRegister(db: D1Database, options: { tenantId: string, studentId: string, classId: string, className?: unknown, classArm?: unknown }) {
  if (!options.tenantId || !options.classId) return
  // The register tables may not exist yet in a school that never opened a session.
  await registerSyncStatement(db, options).run().catch(() => null)
}

/**
 * The guard on every settings write (db.ts → upsertSettings). Returns the payload to
 * write: unchanged, or with the student's existing class kept when the write would move
 * or clear it without an authorised change. Records what happened.
 */
export async function guardStudentClass(db: D1Database, settingsKey: string, next: Record<string, any>, change?: ClassChange | null) {
  if (!isStudentPayload(next)) return next
  const row = await db.prepare(`SELECT payload FROM settings WHERE studentId = ?`).bind(settingsKey).first().catch(() => null) as Record<string, any> | null
  let existing: Record<string, any> = {}
  try { existing = row?.payload ? JSON.parse(String(row.payload)) || {} : {} } catch { existing = {} }
  const before = String(existing.classId || '').trim()
  const after = String(next.classId || '').trim()
  if (before === after) return next
  await ensureClassPinTables(db)
  const tenantId = String(next.tenantId || next.schoolId || existing.tenantId || '')
  const user = await db.prepare(`SELECT id FROM users WHERE email = ? OR id = ? LIMIT 1`).bind(settingsKey, settingsKey).first().catch(() => null) as Record<string, any> | null
  const studentId = String(user?.id || settingsKey)
  const from = { id: before, name: existing.className, arm: existing.classArm }
  const to = { id: after, name: next.className, arm: next.classArm }
  if (!before) {
    // Placed where they had no class: always allowed, pinned, and put on the register.
    await db.batch(classEventStatements(db, { tenantId, studentId, settingsKey, from, to, outcome: 'placed', change }))
    await syncRegister(db, { tenantId, studentId, classId: after, className: next.className, classArm: next.classArm })
    await mirrorClassToSiblings(db, settingsKey, next)
    return next
  }
  if (isAuthorisedChange(change)) {
    await db.batch(classEventStatements(db, { tenantId, studentId, settingsKey, from, to, outcome: after ? 'changed' : 'cleared', change }))
    if (after) await syncRegister(db, { tenantId, studentId, classId: after, className: next.className, classArm: next.classArm })
    await mirrorClassToSiblings(db, settingsKey, next)
    return next
  }
  // Not authorised: the class stays as it was; everything else in the write goes through.
  await db.batch(classEventStatements(db, { tenantId, studentId, settingsKey, from, to, outcome: 'blocked', change }))
  console.warn('Blocked an unrecorded class change', { tenantId, studentId, from: before, to: after })
  return { ...next, classId: existing.classId, className: existing.className ?? null, classArm: existing.classArm ?? null }
}

/**
 * A student can have more than one settings record (one under their email, one under their
 * id). Class lists read all of them, so every record must carry the same class: otherwise a
 * promoted student also shows in the old class, or a placed one shows in none.
 */
export async function mirrorClassToSiblings(db: D1Database, settingsKey: string, klass: { classId: unknown, className?: unknown, classArm?: unknown }) {
  const user = await db.prepare(`SELECT id, email FROM users WHERE email = ? OR id = ? OR lower(email) = lower(?) LIMIT 1`).bind(settingsKey, settingsKey, settingsKey).first().catch(() => null) as Record<string, any> | null
  const keys = [...new Set([String(user?.id || ''), String(user?.email || ''), String(user?.email || '').toLowerCase(), settingsKey].filter(Boolean))].filter(key => key !== settingsKey)
  if (!keys.length) return 0
  const result = await db.prepare(`UPDATE settings SET payload = json_set(payload, '$.classId', ?, '$.className', ?, '$.classArm', ?)
    WHERE studentId IN (${keys.map(() => '?').join(', ')}) AND json_valid(payload) AND COALESCE(json_extract(payload, '$.classId'), '') != ?`)
    .bind(String(klass.classId || ''), klass.className ?? null, klass.classArm ?? null, ...keys, String(klass.classId || '')).run().catch(() => null)
  return Number(result?.meta?.changes || 0)
}

/**
 * Nightly: pin every placed student without a pin, and put back any class that changed
 * with no recorded change (a path that went around the guard). Students without a class
 * are only counted — the school places them.
 */
export async function monitorClassPins(db: D1Database, options: { tenantId?: string } = {}) {
  await ensureClassPinTables(db)
  const rows = ((await db.prepare(`SELECT u.id AS student_id, u.tenantId AS tenant_id,
      CASE WHEN s.studentId IS NOT NULL THEN s.studentId ELSE s2.studentId END AS settings_key, COALESCE(s.payload, s2.payload) AS payload,
      p.class_id AS pin_class, p.class_name AS pin_name, p.class_arm AS pin_arm, p.pinned_at AS pinned_at,
      (SELECT 1 FROM classes c WHERE c.id = p.class_id AND c.tenantId = u.tenantId) AS pin_class_exists
    FROM users u LEFT JOIN settings s ON s.studentId = u.email LEFT JOIN settings s2 ON s2.studentId = u.id LEFT JOIN student_class_pins p ON p.student_id = u.id
    WHERE lower(COALESCE(u.role, '')) = 'student' AND lower(COALESCE(NULLIF(trim(u.status), ''), 'active')) NOT IN ('alumni', 'graduated', 'withdrawn', 'transferred', 'inactive', 'deleted', 'left')
      ${options.tenantId ? 'AND u.tenantId = ?' : ''}`).bind(...(options.tenantId ? [options.tenantId] : [])).all()).results || []) as Record<string, any>[]
  const statements: D1PreparedStatement[] = []
  // A school that never opened a session has no register to keep in step.
  const hasRegister = Boolean(await db.prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'session_enrollments'`).first().catch(() => null))
    && Boolean(await db.prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'academic_sessions'`).first().catch(() => null))
  let pinned = 0
  let restored = 0
  let unplaced = 0
  for (const row of rows) {
    let payload: Record<string, any> = {}
    try { payload = JSON.parse(String(row.payload || '{}')) || {} } catch { payload = {} }
    const current = String(payload.classId || '').trim()
    const pin = String(row.pin_class || '').trim()
    if (!current && !pin) { unplaced += 1; continue }
    // A pinned class put back below also returns to the register.
    if (!pin) {
      statements.push(...classEventStatements(db, { tenantId: String(row.tenant_id), studentId: String(row.student_id), settingsKey: String(row.settings_key || ''), to: { id: current, name: payload.className, arm: payload.classArm }, outcome: 'pinned', change: { by: 'system', role: 'system', reason: 'session' } }))
      pinned += 1
      continue
    }
    if (current === pin || !row.settings_key || !row.pin_class_exists) continue
    // Changed with nothing on record: put the pinned class back.
    const fixed = { ...payload, classId: pin, className: row.pin_name || null, classArm: row.pin_arm || null }
    statements.push(db.prepare(`UPDATE settings SET payload = ? WHERE studentId = ?`).bind(JSON.stringify(fixed), row.settings_key))
    if (hasRegister) statements.push(registerSyncStatement(db, { tenantId: String(row.tenant_id), studentId: String(row.student_id), classId: pin, className: row.pin_name, classArm: row.pin_arm }))
    statements.push(...classEventStatements(db, { tenantId: String(row.tenant_id), studentId: String(row.student_id), settingsKey: String(row.settings_key), from: { id: current, name: payload.className, arm: payload.classArm }, to: { id: pin, name: row.pin_name, arm: row.pin_arm }, outcome: 'restored', change: { by: 'system', byName: 'Ndovera class monitor', role: 'system', reason: 'session' } }))
    restored += 1
  }
  // Every settings record of a pinned student carries the pinned class (a second record under
  // the student's id or email used to keep an old class, so promoted students showed in both).
  const strays = ((await db.prepare(`SELECT st.studentId AS settings_key, p.student_id AS student_id, p.tenant_id AS tenant_id, p.class_id AS pin_class, p.class_name AS pin_name, p.class_arm AS pin_arm,
      json_extract(st.payload, '$.classId') AS current_class
    FROM student_class_pins p JOIN users u ON u.id = p.student_id
    JOIN settings st ON st.studentId IN (u.email, lower(u.email), u.id)
    WHERE json_valid(st.payload) AND COALESCE(json_extract(st.payload, '$.classId'), '') != p.class_id
      AND lower(COALESCE(NULLIF(trim(u.status), ''), 'active')) NOT IN ('alumni', 'graduated', 'withdrawn', 'transferred', 'inactive', 'deleted', 'left')
      AND EXISTS (SELECT 1 FROM classes c WHERE c.id = p.class_id AND c.tenantId = u.tenantId)
      ${options.tenantId ? 'AND p.tenant_id = ?' : ''}`).bind(...(options.tenantId ? [options.tenantId] : [])).all().catch(() => ({ results: [] }))).results || []) as Record<string, any>[]
  let aligned = 0
  for (const stray of strays) {
    statements.push(db.prepare(`UPDATE settings SET payload = json_set(payload, '$.classId', ?, '$.className', ?, '$.classArm', ?) WHERE studentId = ? AND json_valid(payload)`)
      .bind(String(stray.pin_class), stray.pin_name ?? null, stray.pin_arm ?? null, String(stray.settings_key)))
    aligned += 1
  }

  // The register catches up with classes set elsewhere (e.g. on the People page before this fix):
  // only rows with no class are filled; a class on the register is never overwritten here.
  let registered = 0
  const gaps = !hasRegister ? [] : ((await db.prepare(`SELECT e.student_id AS student_id, e.tenant_id AS tenant_id, COALESCE(s.payload, s2.payload) AS payload
      FROM session_enrollments e JOIN academic_sessions a ON a.id = e.session_id AND a.tenant_id = e.tenant_id AND a.status = 'active'
      JOIN users u ON u.id = e.student_id LEFT JOIN settings s ON s.studentId = u.email LEFT JOIN settings s2 ON s2.studentId = u.id
      WHERE COALESCE(e.class_id, '') = '' AND COALESCE(e.status, 'active') = 'active' ${options.tenantId ? 'AND e.tenant_id = ?' : ''}`)
    .bind(...(options.tenantId ? [options.tenantId] : [])).all().catch(() => ({ results: [] }))).results || []) as Record<string, any>[]
  for (const gap of gaps) {
    let payload: Record<string, any> = {}
    try { payload = JSON.parse(String(gap.payload || '{}')) || {} } catch { payload = {} }
    if (!String(payload.classId || '').trim()) continue
    statements.push(registerSyncStatement(db, { tenantId: String(gap.tenant_id), studentId: String(gap.student_id), classId: String(payload.classId), className: payload.className, classArm: payload.classArm }))
    registered += 1
  }
  for (let index = 0; index < statements.length; index += 90) await db.batch(statements.slice(index, index + 90))
  return { checked: rows.length, pinned, restored, unplaced, registered, aligned }
}

/** A student's class history, newest first (for the Owner, Head of School and ICT). */
export async function classHistory(db: D1Database, tenantId: string, filters: { studentId?: string, outcome?: string, limit?: number } = {}) {
  await ensureClassPinTables(db)
  const where = ['tenant_id = ?']
  const params: unknown[] = [tenantId]
  if (filters.studentId) { where.push('student_id = ?'); params.push(filters.studentId) }
  if (filters.outcome) { where.push('outcome = ?'); params.push(filters.outcome) }
  const rows = await db.prepare(`SELECT * FROM student_class_history WHERE ${where.join(' AND ')} ORDER BY at DESC LIMIT ?`).bind(...params, Math.min(500, filters.limit || 200)).all()
  return (rows.results || []) as Record<string, any>[]
}
