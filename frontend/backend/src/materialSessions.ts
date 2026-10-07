import { ensureAcademicTables, getActiveSession, lagosToday } from './academicSessions'

// Where a material sits in the school's academic history.
//
// A material belongs to one session and, inside it, one term. The "current"
// operational view shows the running session and term; everything else is
// academic history. Moving to a new term or session changes which context is
// current — it never deletes or edits a material.
//
// Stamps come in two strengths. A real session id (from academic_sessions) is
// final: later calendar edits never move the record. `legacy` and provisional
// `period-YYYY-YYYY` stamps only stand in until the school records a session
// that covers the upload date, and are re-classified once it does.

export const LEGACY_MATERIAL_SESSION = 'legacy'
const PROVISIONAL_PREFIX = 'period-'

// Enforcement date for schools already live on deployment: anything published
// before the start of the 2026/2027 year is history, whatever its stamps say.
export const MATERIAL_ARCHIVE_CUTOFF = '2026-09-01'

// Academic years run September to August.
export function provisionalSessionId(date: string) {
  const year = Number(date.slice(0, 4))
  const month = Number(date.slice(5, 7))
  const start = month >= 9 ? year : year - 1
  return `${PROVISIONAL_PREFIX}${start}-${start + 1}`
}

export function provisionalSessionName(sessionId: string) {
  if (sessionId === LEGACY_MATERIAL_SESSION) return 'Before 2026/2027'
  if (!sessionId.startsWith(PROVISIONAL_PREFIX)) return ''
  return sessionId.slice(PROVISIONAL_PREFIX.length).replace('-', '/')
}

export function isRealMaterialSession(sessionId: string) {
  return Boolean(sessionId) && sessionId !== LEGACY_MATERIAL_SESSION && !sessionId.startsWith(PROVISIONAL_PREFIX)
}

export type MaterialContext = { sessionId: string, termId: string }

// Backfill runs on read paths, so it is throttled per isolate: new materials are
// stamped on insert, and only historic or provisional rows ever need it.
const BACKFILL_INTERVAL_MS = 5 * 60 * 1000
const _lastBackfill = new Map<string, number>()

export function resetMaterialBackfillCache() {
  _lastBackfill.clear()
}

const VALID_METADATA = `CASE WHEN json_valid(metadata) AND substr(trim(metadata), 1, 1) = '{' THEN metadata ELSE '{}' END`
const UPLOAD_DATE = `substr(materials.uploadedAt, 1, 10)`
const COVERING_SESSION = `(SELECT s.id FROM academic_sessions s
  WHERE s.tenant_id = ? AND s.status IN ('active', 'completed', 'archived')
    AND ${UPLOAD_DATE} >= s.start_date AND ${UPLOAD_DATE} <= s.end_date
  ORDER BY s.start_date DESC LIMIT 1)`

export async function backfillMaterialSessions(db: D1Database, tenantId: string, { force = false } = {}) {
  const last = _lastBackfill.get(tenantId) || 0
  if (!force && Date.now() - last < BACKFILL_INTERVAL_MS) return
  await ensureAcademicTables(db)

  // 1. Unstamped rows: the covering session, or a provisional year, or legacy.
  await db.prepare(`UPDATE materials SET metadata = json_set(${VALID_METADATA},
    '$.academicSessionId', COALESCE(${COVERING_SESSION},
      CASE WHEN ${UPLOAD_DATE} >= ? THEN '${PROVISIONAL_PREFIX}' ||
        (CAST(substr(materials.uploadedAt, 1, 4) AS INTEGER) - (CAST(substr(materials.uploadedAt, 6, 2) AS INTEGER) < 9)) || '-' ||
        (CAST(substr(materials.uploadedAt, 1, 4) AS INTEGER) - (CAST(substr(materials.uploadedAt, 6, 2) AS INTEGER) < 9) + 1)
      ELSE '${LEGACY_MATERIAL_SESSION}' END))
    WHERE classId IN (SELECT id FROM classes WHERE tenantId = ?)
      AND (CASE WHEN json_valid(metadata) THEN json_extract(metadata, '$.academicSessionId') END) IS NULL`
  ).bind(tenantId, MATERIAL_ARCHIVE_CUTOFF, tenantId).run()

  // 2. Stand-in stamps move to a real session once the school has recorded one.
  await db.prepare(`UPDATE materials SET metadata = json_remove(json_set(metadata,
      '$.academicSessionId', ${COVERING_SESSION}), '$.academicTermId')
    WHERE classId IN (SELECT id FROM classes WHERE tenantId = ?)
      AND json_valid(metadata)
      AND (json_extract(metadata, '$.academicSessionId') = '${LEGACY_MATERIAL_SESSION}'
        OR json_extract(metadata, '$.academicSessionId') LIKE '${PROVISIONAL_PREFIX}%')
      AND ${COVERING_SESSION} IS NOT NULL`
  ).bind(tenantId, tenantId, tenantId).run()

  // 3. Terms: the latest term of the material's session that had started by the
  // upload date (covers uploads during a break), else the session's first term.
  await db.prepare(`UPDATE materials SET metadata = json_set(metadata, '$.academicTermId', COALESCE(
      (SELECT t.id FROM academic_terms t WHERE t.tenant_id = ?
        AND t.session_id = json_extract(materials.metadata, '$.academicSessionId')
        AND t.start_date <= ${UPLOAD_DATE} ORDER BY t.start_date DESC LIMIT 1),
      (SELECT t.id FROM academic_terms t WHERE t.tenant_id = ?
        AND t.session_id = json_extract(materials.metadata, '$.academicSessionId')
        ORDER BY t.sequence ASC LIMIT 1),
      ''))
    WHERE classId IN (SELECT id FROM classes WHERE tenantId = ?)
      AND json_valid(metadata)
      AND json_extract(metadata, '$.academicSessionId') IS NOT NULL
      AND json_extract(metadata, '$.academicTermId') IS NULL`
  ).bind(tenantId, tenantId, tenantId).run()

  _lastBackfill.set(tenantId, Date.now())
}

/**
 * The context new work is published into and the current view shows: the active
 * session and its running term. Between terms that is the term that ran last,
 * so students keep it until the next one opens. A school with no active session
 * still moves on each September through a provisional academic year.
 */
export async function currentMaterialContext(db: D1Database, tenantId: string, today = lagosToday()): Promise<MaterialContext> {
  const active = await getActiveSession(db, tenantId)
  if (!active) return { sessionId: provisionalSessionId(today), termId: '' }
  const term = await db.prepare(`SELECT id FROM academic_terms WHERE tenant_id = ? AND session_id = ?
    ORDER BY CASE WHEN status = 'active' THEN 0 WHEN start_date <= ? THEN 1 ELSE 2 END,
      CASE WHEN start_date <= ? THEN start_date END DESC, sequence ASC LIMIT 1`
  ).bind(tenantId, active.id, today, today).first() as Record<string, any> | null
  return { sessionId: active.id, termId: String(term?.id || '') }
}

export async function currentMaterialSession(db: D1Database, tenantId: string) {
  return (await currentMaterialContext(db, tenantId)).sessionId
}

export function materialBelongsToSession(material: { metadata?: Record<string, any> }, sessionId: string) {
  return String(material.metadata?.academicSessionId || LEGACY_MATERIAL_SESSION) === sessionId
}

/** Whether a material belongs to today's operational view rather than to history. */
export function isCurrentMaterial(material: { uploadedAt?: string, metadata?: Record<string, any> }, context: MaterialContext) {
  if (String(material.uploadedAt || '').slice(0, 10) < MATERIAL_ARCHIVE_CUTOFF) return false
  if (!materialBelongsToSession(material, context.sessionId)) return false
  const termId = String(material.metadata?.academicTermId || '')
  return !context.termId || !termId || termId === context.termId
}

/**
 * A student's history is the classes they were actually in: the session register
 * where one exists, and their current class for earlier terms of this session.
 * Periods with no register (before the school kept one) fall back to the
 * earliest class on record, or the current class for a school with none.
 */
export function studentCanAccessArchivedMaterial(
  material: { classId: string, metadata?: Record<string, any> },
  placements: Array<Record<string, any>>,
  current: { classId: string, sessionId: string } = { classId: '', sessionId: '' },
) {
  const sessionId = String(material.metadata?.academicSessionId || LEGACY_MATERIAL_SESSION)
  if (placements.some(placement => placement.class_id === material.classId && placement.session_id === sessionId)) return true
  if (sessionId === current.sessionId) return Boolean(current.classId) && material.classId === current.classId
  if (isRealMaterialSession(sessionId)) return false
  const fallbackClassId = placements.length ? placements[placements.length - 1].class_id : current.classId
  return Boolean(fallbackClassId) && material.classId === fallbackClassId
}

export async function materialArchivePlacements(db: D1Database, tenantId: string, studentId: string) {
  await ensureAcademicTables(db)
  const rows = await db.prepare(`SELECT e.session_id, e.class_id, e.class_name, s.name AS session_name
    FROM session_enrollments e JOIN academic_sessions s ON s.id = e.session_id AND s.tenant_id = e.tenant_id
    WHERE e.tenant_id = ? AND e.student_id = ? AND s.status IN ('completed', 'archived')
    ORDER BY s.start_date DESC`).bind(tenantId, studentId).all()
  return rows.results as Array<Record<string, any>>
}
