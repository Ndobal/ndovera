// School health register (sick bay / first aid).
//
// Any member of staff can report a health incident: the child, what happened, the first aid given
// and by whom, and photos of an injury. Teachers see only the reports they made.
// The school nurse (the clinic role) takes over every report: rest in the sick bay (timed),
// medication, outcome, informing the parent, follow-up and notes, and keeps each student's health
// profile (allergies, conditions…). Without a nurse, the Owner and Head of School do this.
// The Owner, Head of School and nurse see every student's history; parents see their own children's.

export class HealthError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

export const CATEGORIES = ['injury', 'illness', 'allergic_reaction', 'fever', 'headache', 'stomach_ache', 'breathing', 'fainting', 'other'] as const
export const SEVERITIES = ['minor', 'moderate', 'serious', 'emergency'] as const
export const OUTCOMES = ['returned_to_class', 'rested_then_class', 'sent_home', 'picked_up_by_parent', 'referred_to_hospital', 'emergency_services'] as const
export const STATUSES = ['reported', 'in_care', 'closed'] as const

const pick = <T extends readonly string[]>(list: T, value: unknown, fallback: T[number] | '' = '') => {
  const text = String(value ?? '').trim().toLowerCase()
  return ((list as readonly string[]).includes(text) ? text : fallback) as T[number] | ''
}
const text = (value: unknown, max = 2000) => String(value ?? '').replace(/\r/g, '').trim().slice(0, max)

const ready = new WeakSet<object>()
export async function ensureHealthTables(db: D1Database) {
  if (ready.has(db as object)) return
  const statements = [
    `CREATE TABLE IF NOT EXISTS health_incidents (
      id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, student_id TEXT NOT NULL, occurred_at TEXT NOT NULL, location TEXT,
      category TEXT, complaint TEXT, description TEXT, severity TEXT, temperature TEXT,
      first_aid_given TEXT, given_by_name TEXT, reported_by_id TEXT, reported_by_name TEXT, reporter_role TEXT,
      status TEXT NOT NULL DEFAULT 'reported', medication TEXT, rest_started_at TEXT, rest_ended_at TEXT, outcome TEXT,
      parent_notified_at TEXT, parent_notified_how TEXT, follow_up_needed INTEGER NOT NULL DEFAULT 0, follow_up_notes TEXT,
      follow_up_date TEXT, follow_up_done_at TEXT, nurse_notes TEXT, handled_by_id TEXT, handled_by_name TEXT,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_health_incidents_tenant ON health_incidents(tenant_id, occurred_at)`,
    `CREATE INDEX IF NOT EXISTS idx_health_incidents_student ON health_incidents(tenant_id, student_id, occurred_at)`,
    `CREATE TABLE IF NOT EXISTS health_photos (
      id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, incident_id TEXT NOT NULL, r2_key TEXT NOT NULL, content_type TEXT,
      uploaded_by TEXT, created_at TEXT NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_health_photos_incident ON health_photos(incident_id)`,
    `CREATE TABLE IF NOT EXISTS health_profiles (
      tenant_id TEXT NOT NULL, student_id TEXT NOT NULL, blood_group TEXT, genotype TEXT, allergies TEXT, conditions TEXT,
      medications TEXT, notes TEXT, updated_by TEXT, updated_at TEXT, PRIMARY KEY (tenant_id, student_id)
    )`,
  ]
  for (const sql of statements) await db.prepare(sql).run()
  ready.add(db as object)
}

/** Minutes between rest start and end (or now, while resting). */
export function restMinutes(startedAt?: string | null, endedAt?: string | null, now = new Date()) {
  if (!startedAt) return null
  const start = new Date(startedAt).getTime()
  const end = endedAt ? new Date(endedAt).getTime() : now.getTime()
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null
  return Math.round((end - start) / 60000)
}

export function mapIncident(row: Record<string, any>, { forParent = false } = {}) {
  const incident = {
    id: String(row.id), studentId: String(row.student_id), occurredAt: String(row.occurred_at || ''), location: String(row.location || ''),
    category: String(row.category || 'other'), complaint: String(row.complaint || ''), description: String(row.description || ''),
    severity: String(row.severity || 'minor'), temperature: String(row.temperature || ''), firstAidGiven: String(row.first_aid_given || ''),
    givenByName: String(row.given_by_name || ''), reportedById: String(row.reported_by_id || ''), reportedByName: String(row.reported_by_name || ''),
    reporterRole: String(row.reporter_role || ''), status: String(row.status || 'reported'), medication: String(row.medication || ''),
    restStartedAt: row.rest_started_at || null, restEndedAt: row.rest_ended_at || null, restMinutes: restMinutes(row.rest_started_at, row.rest_ended_at),
    outcome: String(row.outcome || ''), parentNotifiedAt: row.parent_notified_at || null, parentNotifiedHow: String(row.parent_notified_how || ''),
    followUpNeeded: Boolean(Number(row.follow_up_needed || 0)), followUpNotes: String(row.follow_up_notes || ''), followUpDate: String(row.follow_up_date || ''),
    followUpDoneAt: row.follow_up_done_at || null, nurseNotes: String(row.nurse_notes || ''), handledByName: String(row.handled_by_name || ''),
    createdAt: String(row.created_at || ''), updatedAt: String(row.updated_at || ''),
  }
  // Internal notes and the reporter's account stay with the school.
  if (forParent) return { ...incident, nurseNotes: '', reportedById: '' }
  return incident
}

export function mapProfile(row: Record<string, any> | null) {
  return {
    bloodGroup: String(row?.blood_group || ''), genotype: String(row?.genotype || ''), allergies: String(row?.allergies || ''),
    conditions: String(row?.conditions || ''), medications: String(row?.medications || ''), notes: String(row?.notes || ''),
    updatedAt: row?.updated_at || null,
  }
}

export type Reporter = { id: string, name: string, role: string, manager: boolean }

/** A new incident. Reporters give what happened and what they did; managers may fill in everything. */
export async function createIncident(db: D1Database, tenantId: string, input: Record<string, any>, reporter: Reporter) {
  await ensureHealthTables(db)
  const studentId = text(input.studentId, 120)
  if (!studentId) throw new HealthError('Choose the child.')
  const complaint = text(input.complaint, 300)
  if (!complaint) throw new HealthError('Say what happened or what the child complained of.')
  const now = new Date().toISOString()
  const occurredAt = (() => { const date = new Date(String(input.occurredAt || '')); return Number.isNaN(date.getTime()) ? now : date.toISOString() })()
  const id = `hinc_${crypto.randomUUID().replace(/-/g, '').slice(0, 18)}`
  await db.prepare(`INSERT INTO health_incidents (id, tenant_id, student_id, occurred_at, location, category, complaint, description, severity, temperature,
      first_aid_given, given_by_name, reported_by_id, reported_by_name, reporter_role, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'reported', ?, ?)`)
    .bind(id, tenantId, studentId, occurredAt, text(input.location, 200), pick(CATEGORIES, input.category, 'other'), complaint, text(input.description),
      pick(SEVERITIES, input.severity, 'minor'), text(input.temperature, 20), text(input.firstAidGiven), text(input.givenByName, 120) || reporter.name,
      reporter.id, reporter.name, reporter.role, now, now).run()
  if (reporter.manager) await updateIncident(db, tenantId, id, input, reporter)
  return id
}

/** The nurse (or, without one, the Owner/HoS) completes and manages an incident. */
export async function updateIncident(db: D1Database, tenantId: string, incidentId: string, input: Record<string, any>, handler: Reporter) {
  await ensureHealthTables(db)
  const row = await db.prepare(`SELECT * FROM health_incidents WHERE id = ? AND tenant_id = ?`).bind(incidentId, tenantId).first() as Record<string, any> | null
  if (!row) throw new HealthError('Record not found.', 404)
  const has = (key: string) => Object.prototype.hasOwnProperty.call(input, key)
  const sets: string[] = []
  const binds: unknown[] = []
  const set = (column: string, value: unknown) => { sets.push(`${column} = ?`); binds.push(value) }
  if (has('location')) set('location', text(input.location, 200))
  if (has('category')) set('category', pick(CATEGORIES, input.category, 'other'))
  if (has('complaint') && text(input.complaint, 300)) set('complaint', text(input.complaint, 300))
  if (has('description')) set('description', text(input.description))
  if (has('severity')) set('severity', pick(SEVERITIES, input.severity, 'minor'))
  if (has('temperature')) set('temperature', text(input.temperature, 20))
  if (has('firstAidGiven')) set('first_aid_given', text(input.firstAidGiven))
  if (has('givenByName')) set('given_by_name', text(input.givenByName, 120))
  if (has('medication')) set('medication', text(input.medication, 500))
  if (has('outcome')) set('outcome', pick(OUTCOMES, input.outcome))
  if (has('nurseNotes')) set('nurse_notes', text(input.nurseNotes))
  if (has('parentNotifiedHow')) set('parent_notified_how', text(input.parentNotifiedHow, 120))
  if (has('parentNotified')) set('parent_notified_at', input.parentNotified ? (row.parent_notified_at || new Date().toISOString()) : null)
  if (has('followUpNeeded')) set('follow_up_needed', input.followUpNeeded ? 1 : 0)
  if (has('followUpNotes')) set('follow_up_notes', text(input.followUpNotes))
  if (has('followUpDate')) set('follow_up_date', /^\d{4}-\d{2}-\d{2}$/.test(String(input.followUpDate || '')) ? String(input.followUpDate) : '')
  if (has('followUpDone')) set('follow_up_done_at', input.followUpDone ? (row.follow_up_done_at || new Date().toISOString()) : null)
  if (has('status')) set('status', pick(STATUSES, input.status, 'in_care'))
  else if (row.status === 'reported') set('status', 'in_care')
  set('handled_by_id', handler.id)
  set('handled_by_name', handler.name)
  set('updated_at', new Date().toISOString())
  await db.prepare(`UPDATE health_incidents SET ${sets.join(', ')} WHERE id = ? AND tenant_id = ?`).bind(...binds, incidentId, tenantId).run()
}

/** Rest in the sick bay: start, then end; the minutes follow. */
export async function setRest(db: D1Database, tenantId: string, incidentId: string, action: 'start' | 'end', handler: Reporter) {
  await ensureHealthTables(db)
  const row = await db.prepare(`SELECT rest_started_at, rest_ended_at FROM health_incidents WHERE id = ? AND tenant_id = ?`).bind(incidentId, tenantId).first() as Record<string, any> | null
  if (!row) throw new HealthError('Record not found.', 404)
  const now = new Date().toISOString()
  if (action === 'start') {
    await db.prepare(`UPDATE health_incidents SET rest_started_at = ?, rest_ended_at = NULL, status = 'in_care', handled_by_id = ?, handled_by_name = ?, updated_at = ? WHERE id = ? AND tenant_id = ?`)
      .bind(now, handler.id, handler.name, now, incidentId, tenantId).run()
  } else {
    if (!row.rest_started_at) throw new HealthError('Rest has not started.')
    await db.prepare(`UPDATE health_incidents SET rest_ended_at = COALESCE(rest_ended_at, ?), updated_at = ? WHERE id = ? AND tenant_id = ?`).bind(now, now, incidentId, tenantId).run()
  }
}

export async function getIncidentRow(db: D1Database, tenantId: string, incidentId: string) {
  await ensureHealthTables(db)
  return await db.prepare(`SELECT * FROM health_incidents WHERE id = ? AND tenant_id = ?`).bind(incidentId, tenantId).first() as Record<string, any> | null
}

export async function listIncidents(db: D1Database, tenantId: string, filters: { studentIds?: string[], reportedById?: string, status?: string, from?: string, to?: string, limit?: number } = {}) {
  await ensureHealthTables(db)
  const where = ['tenant_id = ?']
  const binds: unknown[] = [tenantId]
  if (filters.studentIds) {
    if (!filters.studentIds.length) return []
    where.push(`student_id IN (SELECT value FROM json_each(?))`); binds.push(JSON.stringify(filters.studentIds))
  }
  if (filters.reportedById) { where.push('reported_by_id = ?'); binds.push(filters.reportedById) }
  if (filters.status === 'open') where.push(`status != 'closed'`)
  else if (filters.status === 'follow_up') where.push(`follow_up_needed = 1 AND follow_up_done_at IS NULL`)
  else if (filters.status) { where.push('status = ?'); binds.push(filters.status) }
  if (filters.from) { where.push('occurred_at >= ?'); binds.push(filters.from) }
  if (filters.to) { where.push('occurred_at <= ?'); binds.push(`${filters.to}T23:59:59.999Z`) }
  const rows = await db.prepare(`SELECT * FROM health_incidents WHERE ${where.join(' AND ')} ORDER BY occurred_at DESC LIMIT ?`)
    .bind(...binds, Math.min(Math.max(Number(filters.limit) || 200, 1), 500)).all()
  return (rows.results || []) as Record<string, any>[]
}

export async function photosFor(db: D1Database, tenantId: string, incidentIds: string[]) {
  await ensureHealthTables(db)
  if (!incidentIds.length) return [] as Array<{ id: string, incidentId: string, createdAt: string }>
  const rows = await db.prepare(`SELECT id, incident_id, created_at FROM health_photos WHERE tenant_id = ? AND incident_id IN (SELECT value FROM json_each(?)) ORDER BY created_at`)
    .bind(tenantId, JSON.stringify(incidentIds)).all()
  return ((rows.results || []) as Record<string, any>[]).map(row => ({ id: String(row.id), incidentId: String(row.incident_id), createdAt: String(row.created_at) }))
}

export async function addPhoto(db: D1Database, tenantId: string, incidentId: string, r2Key: string, contentType: string, uploadedBy: string) {
  await ensureHealthTables(db)
  const count = await db.prepare(`SELECT COUNT(*) AS n FROM health_photos WHERE incident_id = ?`).bind(incidentId).first() as Record<string, any> | null
  if (Number(count?.n || 0) >= 6) throw new HealthError('A record can hold up to 6 photos.')
  const id = `hphoto_${crypto.randomUUID().replace(/-/g, '').slice(0, 18)}`
  await db.prepare(`INSERT INTO health_photos (id, tenant_id, incident_id, r2_key, content_type, uploaded_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .bind(id, tenantId, incidentId, r2Key, contentType, uploadedBy, new Date().toISOString()).run()
  return id
}

export async function getProfile(db: D1Database, tenantId: string, studentId: string) {
  await ensureHealthTables(db)
  return mapProfile(await db.prepare(`SELECT * FROM health_profiles WHERE tenant_id = ? AND student_id = ?`).bind(tenantId, studentId).first() as Record<string, any> | null)
}

export async function saveProfile(db: D1Database, tenantId: string, studentId: string, input: Record<string, any>, updatedBy: string) {
  await ensureHealthTables(db)
  await db.prepare(`INSERT INTO health_profiles (tenant_id, student_id, blood_group, genotype, allergies, conditions, medications, notes, updated_by, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(tenant_id, student_id) DO UPDATE SET blood_group = excluded.blood_group, genotype = excluded.genotype, allergies = excluded.allergies,
      conditions = excluded.conditions, medications = excluded.medications, notes = excluded.notes, updated_by = excluded.updated_by, updated_at = excluded.updated_at`)
    .bind(tenantId, studentId, text(input.bloodGroup, 10), text(input.genotype, 10), text(input.allergies, 1000), text(input.conditions, 1000), text(input.medications, 1000), text(input.notes, 2000), updatedBy, new Date().toISOString()).run()
  return getProfile(db, tenantId, studentId)
}
