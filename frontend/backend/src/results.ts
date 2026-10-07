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

function normalizeEntryCaComponents(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {} as Record<string, number>

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([key, componentScore]) => {
        const normalizedKey = normalizeKeyPart(key)
        const numeric = Number(componentScore || 0)
        return [normalizedKey, Number.isFinite(numeric) ? Math.max(0, numeric) : 0]
      })
      .filter(([key]) => Boolean(key))
  )
}

function buildBatchId(tenantId: string, classId: string, sessionName: string, termName: string) {
  return `resultbatch_${normalizeKeyPart(tenantId)}_${normalizeKeyPart(classId)}_${normalizeKeyPart(sessionName)}_${normalizeKeyPart(termName)}`
}

function buildEntryId(batchId: string, studentId: string, subjectId: string) {
  return `resultentry_${normalizeKeyPart(batchId)}_${normalizeKeyPart(studentId)}_${normalizeKeyPart(subjectId)}`
}

function buildPublicationId(tenantId: string, studentId: string, sessionName: string, termName: string) {
  return `resultpub_${normalizeKeyPart(tenantId)}_${normalizeKeyPart(studentId)}_${normalizeKeyPart(sessionName)}_${normalizeKeyPart(termName)}`
}

function buildProfileId(batchId: string, studentId: string) {
  return `resultprofile_${normalizeKeyPart(batchId)}_${normalizeKeyPart(studentId)}`
}

const RESULT_SETTINGS_DDL = `CREATE TABLE IF NOT EXISTS result_settings (
  tenant_id TEXT PRIMARY KEY,
  template_key TEXT,
  grading_scale_json TEXT,
  rating_scale_json TEXT,
  affective_scale_json TEXT,
  affective_domains_json TEXT,
  metadata_json TEXT,
  updated_by TEXT,
  updated_at TEXT NOT NULL
)`

// Per-section overrides (Nursery / Primary / Secondary). A missing section row
// falls back to the school-wide result_settings above, so existing schools are
// unaffected until they configure a section.
const RESULT_SETTINGS_SECTIONS_DDL = `CREATE TABLE IF NOT EXISTS result_settings_sections (
  tenant_id TEXT,
  section TEXT,
  template_key TEXT,
  grading_scale_json TEXT,
  rating_scale_json TEXT,
  affective_scale_json TEXT,
  affective_domains_json TEXT,
  metadata_json TEXT,
  updated_by TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, section)
)`

const RESULT_BATCHES_DDL = `CREATE TABLE IF NOT EXISTS result_batches (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  class_id TEXT NOT NULL,
  session_name TEXT NOT NULL,
  term_name TEXT NOT NULL,
  status TEXT NOT NULL,
  template_key TEXT,
  settings_snapshot_json TEXT,
  entry_count INTEGER NOT NULL DEFAULT 0,
  publication_count INTEGER NOT NULL DEFAULT 0,
  created_by TEXT,
  created_at TEXT NOT NULL,
  updated_by TEXT,
  updated_at TEXT NOT NULL,
  submitted_by TEXT,
  submitted_at TEXT,
  approved_by TEXT,
  approved_at TEXT,
  published_at TEXT,
  UNIQUE(tenant_id, class_id, session_name, term_name)
)`

const RESULT_ENTRIES_DDL = `CREATE TABLE IF NOT EXISTS result_ca_entries (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  class_id TEXT NOT NULL,
  session_name TEXT NOT NULL,
  term_name TEXT NOT NULL,
  student_id TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  subject_name TEXT NOT NULL,
  teacher_id TEXT,
  ca_components_json TEXT,
  ca_score REAL NOT NULL DEFAULT 0,
  exam_score REAL NOT NULL DEFAULT 0,
  updated_by TEXT,
  updated_at TEXT NOT NULL,
  UNIQUE(batch_id, student_id, subject_id)
)`

const RESULT_STUDENT_PROFILES_DDL = `CREATE TABLE IF NOT EXISTS result_student_profiles (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  class_id TEXT NOT NULL,
  session_name TEXT NOT NULL,
  term_name TEXT NOT NULL,
  student_id TEXT NOT NULL,
  attendance_rate REAL NOT NULL DEFAULT 0,
  affective_json TEXT,
  ratings_json TEXT,
  teacher_remark TEXT,
  principal_remark TEXT,
  promotion_status TEXT,
  updated_by TEXT,
  updated_at TEXT NOT NULL,
  UNIQUE(batch_id, student_id)
)`

const RESULT_PUBLICATIONS_DDL = `CREATE TABLE IF NOT EXISTS result_publications (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  session_name TEXT NOT NULL,
  term_name TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  approved_by TEXT,
  approved_at TEXT,
  published_at TEXT,
  updated_at TEXT NOT NULL,
  UNIQUE(tenant_id, student_id, session_name, term_name)
)`

const RESULT_DOCUMENTS_DDL = `CREATE TABLE IF NOT EXISTS result_documents (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  session_name TEXT NOT NULL,
  term_name TEXT NOT NULL,
  source_kind TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  uploaded_by TEXT,
  uploaded_at TEXT NOT NULL,
  metadata_json TEXT
)`

// Every override of someone else's score row (class teacher over a subject
// teacher, HoS/owner over anyone) is written here with the before and after.
const RESULT_ENTRY_AUDIT_DDL = `CREATE TABLE IF NOT EXISTS result_entry_audit (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  batch_id TEXT NOT NULL,
  class_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  subject_name TEXT,
  actor_id TEXT,
  actor_name TEXT,
  actor_role TEXT,
  replaced_by TEXT,
  before_json TEXT,
  after_json TEXT,
  reason TEXT,
  created_at TEXT NOT NULL
)`

// One row per school per term once the HoS/owner opens the exam period. No row
// means exams have not been activated for that term.
const RESULT_EXAM_PERIODS_DDL = `CREATE TABLE IF NOT EXISTS result_exam_periods (
  tenant_id TEXT NOT NULL,
  session_name TEXT NOT NULL,
  term_name TEXT NOT NULL,
  status TEXT NOT NULL,
  activated_by TEXT,
  activated_at TEXT,
  ended_by TEXT,
  ended_at TEXT,
  PRIMARY KEY (tenant_id, session_name, term_name)
)`

// A subject teacher hands in one C.A. (or all of them) for a class and subject:
// submitted → approved by the section head → approved by the HoS/Owner (locked
// into the result), or returned for correction at either step.
const CA_SUBMISSIONS_DDL = `CREATE TABLE IF NOT EXISTS ca_submissions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  batch_id TEXT NOT NULL,
  class_id TEXT NOT NULL,
  session_name TEXT NOT NULL,
  term_name TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  subject_name TEXT,
  component_key TEXT NOT NULL,
  component_label TEXT,
  teacher_id TEXT,
  teacher_name TEXT,
  status TEXT NOT NULL,
  submitted_at TEXT,
  section_approved_by_name TEXT,
  section_approved_at TEXT,
  approved_by_name TEXT,
  approved_at TEXT,
  returned_by_name TEXT,
  returned_at TEXT,
  return_note TEXT,
  history_json TEXT,
  updated_at TEXT NOT NULL,
  UNIQUE(batch_id, subject_id, component_key)
)`

/**
 * Practice results live in the same tables as real ones, under a period name no
 * school can type, so the real engine computes them exactly as it would a real
 * term. They are never written to result_publications, and real routes refuse
 * this period name.
 */
export const PRACTICE_PERIOD_KEY = '__practice__'
export const PRACTICE_SESSION_LABEL = 'Practice Session'
export const PRACTICE_TERM_LABEL = 'Practice Term'

// The DDL above runs once per database handle per isolate, not on every read.
const _resultsTablesReady = new WeakSet<object>()

export async function ensureResultsTables(db: D1Database) {
  if (_resultsTablesReady.has(db as object)) return
  await db.prepare(RESULT_SETTINGS_DDL).run()
  await db.prepare(RESULT_SETTINGS_SECTIONS_DDL).run()
  await db.prepare(RESULT_BATCHES_DDL).run()
  // Batches created from now on also carry the academic calendar's stable ids.
  // Older batches keep only their names and are left exactly where they are.
  try { await db.exec('ALTER TABLE result_batches ADD COLUMN session_id TEXT') } catch {}
  try { await db.exec('ALTER TABLE result_batches ADD COLUMN term_id TEXT') } catch {}
  await db.prepare(RESULT_ENTRIES_DDL).run()
  try { await db.exec('ALTER TABLE result_ca_entries ADD COLUMN ca_components_json TEXT') } catch {}
  // 0 = the subject teacher's own entry, 1 = class teacher override, 2 = HoS/owner override.
  try { await db.exec('ALTER TABLE result_ca_entries ADD COLUMN override_rank INTEGER NOT NULL DEFAULT 0') } catch {}
  try { await db.exec('ALTER TABLE result_ca_entries ADD COLUMN override_by TEXT') } catch {}
  try { await db.exec('ALTER TABLE result_ca_entries ADD COLUMN override_name TEXT') } catch {}
  try { await db.exec('ALTER TABLE result_ca_entries ADD COLUMN override_role TEXT') } catch {}
  try { await db.exec('ALTER TABLE result_ca_entries ADD COLUMN override_at TEXT') } catch {}
  await db.prepare(RESULT_STUDENT_PROFILES_DDL).run()
  await db.prepare(RESULT_PUBLICATIONS_DDL).run()
  await db.prepare(RESULT_DOCUMENTS_DDL).run()
  await db.prepare(RESULT_ENTRY_AUDIT_DDL).run()
  await db.prepare(RESULT_EXAM_PERIODS_DDL).run()
  await db.prepare(CA_SUBMISSIONS_DDL).run()
  _resultsTablesReady.add(db as object)
}

function mapResultSettingsRow(row: Record<string, any> | null, tenantId: string) {
  return row ? {
    tenantId: row.tenant_id,
    templateKey: String(row.template_key || ''),
    gradingScale: parseJsonField(row.grading_scale_json, [] as Record<string, any>[]),
    ratingScale: parseJsonField(row.rating_scale_json, [] as Record<string, any>[]),
    affectiveScale: parseJsonField(row.affective_scale_json, [] as Record<string, any>[]),
    affectiveDomains: parseJsonField(row.affective_domains_json, [] as Record<string, any>[]),
    metadata: parseJsonField(row.metadata_json, {} as Record<string, any>),
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
  } : {
    tenantId,
    templateKey: '',
    gradingScale: [],
    ratingScale: [],
    affectiveScale: [],
    affectiveDomains: [],
    metadata: {},
    updatedBy: null,
    updatedAt: null,
  }
}

// section '' = school-wide (default). A named section (nursery/primary/secondary)
// returns its own overrides if configured, otherwise falls back to the school-wide row.
export async function getResultSettings(db: D1Database, tenantId: string, section = '') {
  await ensureResultsTables(db)
  const sec = String(section || '').trim().toLowerCase()
  if (sec) {
    const sectionRow = await db.prepare('SELECT * FROM result_settings_sections WHERE tenant_id = ? AND section = ?').bind(tenantId, sec).first() as Record<string, any> | null
    if (sectionRow) return { ...mapResultSettingsRow(sectionRow, tenantId), section: sec }
  }
  const row = await db.prepare('SELECT * FROM result_settings WHERE tenant_id = ?').bind(tenantId).first() as Record<string, any> | null
  return { ...mapResultSettingsRow(row, tenantId), section: sec }
}

export async function saveResultSettings(db: D1Database, tenantId: string, settings: Record<string, any>, actorId: string, section = '') {
  await ensureResultsTables(db)
  const now = new Date().toISOString()
  const sec = String(section || '').trim().toLowerCase()
  const args = [
    String(settings.templateKey || ''),
    JSON.stringify(settings.gradingScale || []),
    JSON.stringify(settings.ratingScale || []),
    JSON.stringify(settings.affectiveScale || []),
    JSON.stringify(settings.affectiveDomains || []),
    JSON.stringify(settings.metadata || {}),
    actorId,
    now,
  ]
  if (sec) {
    await db.prepare(
      `INSERT OR REPLACE INTO result_settings_sections
       (tenant_id, section, template_key, grading_scale_json, rating_scale_json, affective_scale_json, affective_domains_json, metadata_json, updated_by, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(tenantId, sec, ...args).run()
    return getResultSettings(db, tenantId, sec)
  }
  await db.prepare(
    `INSERT OR REPLACE INTO result_settings
     (tenant_id, template_key, grading_scale_json, rating_scale_json, affective_scale_json, affective_domains_json, metadata_json, updated_by, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(tenantId, ...args).run()
  return getResultSettings(db, tenantId)
}

export async function getResultBatch(db: D1Database, tenantId: string, classId: string, sessionName: string, termName: string) {
  await ensureResultsTables(db)
  const row = await db.prepare(
    'SELECT * FROM result_batches WHERE tenant_id = ? AND class_id = ? AND session_name = ? AND term_name = ?'
  ).bind(tenantId, classId, sessionName, termName).first() as Record<string, any> | null
  return row ? {
    id: row.id,
    tenantId: row.tenant_id,
    classId: row.class_id,
    sessionName: row.session_name,
    termName: row.term_name,
    status: row.status,
    templateKey: String(row.template_key || ''),
    settingsSnapshot: parseJsonField(row.settings_snapshot_json, {} as Record<string, any>),
    entryCount: Number(row.entry_count || 0),
    publicationCount: Number(row.publication_count || 0),
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
    submittedBy: row.submitted_by,
    submittedAt: row.submitted_at,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    publishedAt: row.published_at,
  } : {
    id: buildBatchId(tenantId, classId, sessionName, termName),
    tenantId,
    classId,
    sessionName,
    termName,
    status: 'draft',
    templateKey: '',
    settingsSnapshot: {},
    entryCount: 0,
    publicationCount: 0,
    createdBy: null,
    createdAt: null,
    updatedBy: null,
    updatedAt: null,
    submittedBy: null,
    submittedAt: null,
    approvedBy: null,
    approvedAt: null,
    publishedAt: null,
  }
}

export async function listResultBatches(db: D1Database, tenantId: string) {
  await ensureResultsTables(db)
  const rows = await db.prepare('SELECT * FROM result_batches WHERE tenant_id = ? AND session_name != ? ORDER BY updated_at DESC').bind(tenantId, PRACTICE_PERIOD_KEY).all()
  return (rows.results || []).map((row: any) => ({
    id: row.id,
    classId: row.class_id,
    sessionName: row.session_name,
    termName: row.term_name,
    status: row.status,
    templateKey: String(row.template_key || ''),
    entryCount: Number(row.entry_count || 0),
    publicationCount: Number(row.publication_count || 0),
    updatedAt: row.updated_at,
    submittedAt: row.submitted_at,
    approvedAt: row.approved_at,
    approvedBy: row.approved_by,
    publishedAt: row.published_at,
  }))
}

async function ensureBatchRow(db: D1Database, tenantId: string, classId: string, sessionName: string, termName: string, actorId: string, templateKey = '', settingsSnapshot: Record<string, any> = {}, ids: { sessionId?: string, termId?: string } = {}) {
  const batchId = buildBatchId(tenantId, classId, sessionName, termName)
  const now = new Date().toISOString()
  await db.prepare(
    `INSERT OR IGNORE INTO result_batches
     (id, tenant_id, class_id, session_name, term_name, status, template_key, settings_snapshot_json, created_by, created_at, updated_by, updated_at)
     VALUES (?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?)`
  ).bind(batchId, tenantId, classId, sessionName, termName, templateKey, JSON.stringify(settingsSnapshot || {}), actorId, now, actorId, now).run()
  if (ids.sessionId || ids.termId) {
    await db.prepare(`UPDATE result_batches SET session_id = COALESCE(session_id, ?), term_id = COALESCE(term_id, ?) WHERE id = ?`)
      .bind(ids.sessionId || null, ids.termId || null, batchId).run()
  }
  return batchId
}

type ResultEntryWriter = {
  name: string,
  role: string,
  // 0 subject teacher, 1 class teacher, 2 HoS/owner. A row overridden at a
  // higher rank cannot be changed from a lower one.
  rank: number,
  reason?: string,
}

function sameEntryScores(left: Record<string, any>, right: Record<string, any>) {
  if (Number(left.caScore || 0) !== Number(right.caScore || 0)) return false
  if (Number(left.examScore || 0) !== Number(right.examScore || 0)) return false
  const a = normalizeEntryCaComponents(left.caComponents)
  const b = normalizeEntryCaComponents(right.caComponents)
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  for (const key of keys) if (Number(a[key] || 0) !== Number(b[key] || 0)) return false
  return true
}

/** Which C.A. components a save changes ('all' when only a bare C.A. total is given). */
function changedCaKeys(before: Record<string, any> | undefined, row: Record<string, any>) {
  const a = normalizeEntryCaComponents(before?.caComponents)
  const b = normalizeEntryCaComponents(row.caComponents)
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter(key => Number(a[key] || 0) !== Number(b[key] || 0))
  if (!keys.length && Number(before?.caScore || 0) !== Number(row.caScore || 0)) return ['all']
  return keys
}

function isBlankEntry(row: Record<string, any>) {
  return Number(row.caScore || 0) === 0 && Number(row.examScore || 0) === 0
    && Object.values(normalizeEntryCaComponents(row.caComponents)).every(value => Number(value || 0) === 0)
}

function entryScoreSnapshot(row: Record<string, any> | undefined) {
  return row ? { caComponents: normalizeEntryCaComponents(row.caComponents), caScore: Number(row.caScore || 0), examScore: Number(row.examScore || 0) } : null
}

/**
 * Writes score rows into a batch. Without `writer` every row is written as
 * given (the exam-sitting posting path). With `writer` only rows whose scores
 * changed are written; a row counts as an override when `ownSubject` is false,
 * and is logged to result_entry_audit; and a row overridden at a higher rank
 * than the writer's is left alone and reported back as locked.
 */
export async function writeResultEntries(db: D1Database, params: {
  tenantId: string, classId: string, sessionName: string, termName: string, sessionId?: string, termId?: string, actorId: string, templateKey?: string, settingsSnapshot?: Record<string, any>,
  rows: Array<Record<string, any>>, writer?: ResultEntryWriter,
  // C.A. components handed in or approved, per subject: teachers cannot change them; the HoS/Owner can, with a reason.
  frozen?: Map<string, { keys: Set<string>, status: string }>, frozenOverride?: boolean,
}) {
  await ensureResultsTables(db)
  const batchId = await ensureBatchRow(db, params.tenantId, params.classId, params.sessionName, params.termName, params.actorId, params.templateKey, params.settingsSnapshot, { sessionId: params.sessionId, termId: params.termId })
  const existing = await getResultBatch(db, params.tenantId, params.classId, params.sessionName, params.termName)
  if (['submitted', 'published'].includes(String(existing.status || ''))) throw new Error('This result batch is locked. Ask HoS or owner to reopen it.')

  const writer = params.writer
  const current = writer
    ? new Map((await listResultEntries(db, batchId)).map(entry => [`${entry.studentId}::${entry.subjectId}`, entry]))
    : new Map<string, Record<string, any>>()
  const now = new Date().toISOString()
  const locked: Array<{ studentId: string, subjectId: string, subjectName: string, overrideName: string, overrideRole: string, reason?: string }> = []
  let saved = 0
  let overrides = 0

  for (const row of params.rows || []) {
    const studentId = String(row.studentId || '')
    const subjectId = String(row.subjectId || '')
    const before = current.get(`${studentId}::${subjectId}`)
    let override: { rank: number, by: string, name: string, role: string } | null = null

    if (writer) {
      if (before ? sameEntryScores(before, row) : isBlankEntry(row)) continue
      const heldRank = Number(before?.overrideRank || 0)
      if (heldRank > writer.rank) {
        locked.push({ studentId, subjectId, subjectName: String(row.subjectName || before?.subjectName || ''), overrideName: String(before?.overrideName || ''), overrideRole: String(before?.overrideRole || ''), reason: 'override' })
        continue
      }
      if (!row.ownSubject && writer.rank > 0) override = { rank: writer.rank, by: params.actorId, name: writer.name, role: writer.role }
      const frozen = params.frozen?.get(subjectId)
      if (frozen) {
        const changed = changedCaKeys(before, row)
        if (changed.length && (frozen.keys.has('all') || changed.some(key => frozen.keys.has(key)))) {
          if (!params.frozenOverride) {
            locked.push({ studentId, subjectId, subjectName: String(row.subjectName || before?.subjectName || ''), overrideName: '', overrideRole: '', reason: frozen.status })
            continue
          }
          if (!String(writer.reason || '').trim()) throw new Error('These C.A. scores have been handed in or approved. Give a reason for changing them.')
          override = { rank: Math.max(writer.rank, 2), by: params.actorId, name: writer.name, role: writer.role }
        }
      }
    }

    const caComponentsJson = JSON.stringify(normalizeEntryCaComponents(row.caComponents))
    await db.prepare(
      `INSERT INTO result_ca_entries
       (id, batch_id, tenant_id, class_id, session_name, term_name, student_id, subject_id, subject_name, teacher_id, ca_components_json, ca_score, exam_score, updated_by, updated_at, override_rank, override_by, override_name, override_role, override_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         subject_name = excluded.subject_name, teacher_id = excluded.teacher_id, ca_components_json = excluded.ca_components_json,
         ca_score = excluded.ca_score, exam_score = excluded.exam_score, updated_by = excluded.updated_by, updated_at = excluded.updated_at,
         override_rank = CASE WHEN excluded.override_by IS NOT NULL THEN excluded.override_rank ELSE override_rank END,
         override_by = COALESCE(excluded.override_by, override_by),
         override_name = COALESCE(excluded.override_name, override_name),
         override_role = COALESCE(excluded.override_role, override_role),
         override_at = COALESCE(excluded.override_at, override_at)`
    ).bind(
      buildEntryId(batchId, studentId, subjectId),
      batchId,
      params.tenantId,
      params.classId,
      params.sessionName,
      params.termName,
      studentId,
      subjectId,
      String(row.subjectName || ''),
      String(row.teacherId || params.actorId || ''),
      caComponentsJson,
      Number(row.caScore || 0),
      Number(row.examScore || 0),
      params.actorId,
      now,
      override ? override.rank : 0,
      override ? override.by : null,
      override ? override.name : null,
      override ? override.role : null,
      override ? now : null,
    ).run()
    saved += 1

    if (override && writer) {
      overrides += 1
      await db.prepare(
        `INSERT INTO result_entry_audit (id, tenant_id, batch_id, class_id, student_id, subject_id, subject_name, actor_id, actor_name, actor_role, replaced_by, before_json, after_json, reason, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        `resultaudit_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
        params.tenantId, batchId, params.classId, studentId, subjectId, String(row.subjectName || ''),
        params.actorId, writer.name, writer.role, String(before?.overrideName || before?.updatedBy || ''),
        JSON.stringify(entryScoreSnapshot(before)), JSON.stringify(entryScoreSnapshot({ caComponents: row.caComponents, caScore: row.caScore, examScore: row.examScore })),
        String(writer.reason || '').slice(0, 500), now,
      ).run()
    }
  }

  const countRow = await db.prepare('SELECT COUNT(*) as count FROM result_ca_entries WHERE batch_id = ?').bind(batchId).first() as any
  await db.prepare('UPDATE result_batches SET status = ?, template_key = ?, settings_snapshot_json = ?, entry_count = ?, updated_by = ?, updated_at = ? WHERE id = ?')
    .bind('draft', String(params.templateKey || existing.templateKey || ''), JSON.stringify(params.settingsSnapshot || existing.settingsSnapshot || {}), Number(countRow?.count || 0), params.actorId, now, batchId).run()

  return { batch: await getResultBatch(db, params.tenantId, params.classId, params.sessionName, params.termName), saved, overrides, locked }
}

export async function upsertResultEntries(db: D1Database, params: { tenantId: string, classId: string, sessionName: string, termName: string, sessionId?: string, termId?: string, actorId: string, templateKey?: string, settingsSnapshot?: Record<string, any>, rows: Array<Record<string, any>> }) {
  return (await writeResultEntries(db, params)).batch
}

export async function listResultEntryAudit(db: D1Database, batchId: string, limit = 300) {
  await ensureResultsTables(db)
  const rows = await db.prepare('SELECT * FROM result_entry_audit WHERE batch_id = ? ORDER BY created_at DESC LIMIT ?').bind(batchId, limit).all()
  return (rows.results || []).map((row: any) => ({
    id: row.id,
    studentId: row.student_id,
    subjectId: row.subject_id,
    subjectName: String(row.subject_name || ''),
    actorId: row.actor_id,
    actorName: String(row.actor_name || ''),
    actorRole: String(row.actor_role || ''),
    replacedBy: String(row.replaced_by || ''),
    before: parseJsonField(row.before_json, null as Record<string, any> | null),
    after: parseJsonField(row.after_json, null as Record<string, any> | null),
    reason: String(row.reason || ''),
    createdAt: row.created_at,
  }))
}

// ─── Exam period (per school, per term) ──────────────────────────────────────

export async function getResultExamPeriod(db: D1Database, tenantId: string, sessionName: string, termName: string) {
  await ensureResultsTables(db)
  const row = await db.prepare('SELECT * FROM result_exam_periods WHERE tenant_id = ? AND session_name = ? AND term_name = ?').bind(tenantId, sessionName, termName).first() as Record<string, any> | null
  return {
    sessionName,
    termName,
    status: (row ? String(row.status) : 'none') as 'none' | 'active' | 'ended',
    activatedBy: row?.activated_by || null,
    activatedAt: row?.activated_at || null,
    endedBy: row?.ended_by || null,
    endedAt: row?.ended_at || null,
  }
}

export async function setResultExamPeriod(db: D1Database, params: { tenantId: string, sessionName: string, termName: string, status: 'active' | 'ended', actorName: string }) {
  await ensureResultsTables(db)
  const now = new Date().toISOString()
  if (params.status === 'active') {
    await db.prepare(
      `INSERT INTO result_exam_periods (tenant_id, session_name, term_name, status, activated_by, activated_at, ended_by, ended_at)
       VALUES (?, ?, ?, 'active', ?, ?, NULL, NULL)
       ON CONFLICT(tenant_id, session_name, term_name) DO UPDATE SET status = 'active', activated_by = excluded.activated_by, activated_at = excluded.activated_at, ended_by = NULL, ended_at = NULL`
    ).bind(params.tenantId, params.sessionName, params.termName, params.actorName, now).run()
  } else {
    await db.prepare(`UPDATE result_exam_periods SET status = 'ended', ended_by = ?, ended_at = ? WHERE tenant_id = ? AND session_name = ? AND term_name = ?`)
      .bind(params.actorName, now, params.tenantId, params.sessionName, params.termName).run()
  }
  return getResultExamPeriod(db, params.tenantId, params.sessionName, params.termName)
}

export async function countPublishedResultBatches(db: D1Database, tenantId: string, sessionName: string, termName: string) {
  await ensureResultsTables(db)
  const row = await db.prepare(`SELECT COUNT(*) as count FROM result_batches WHERE tenant_id = ? AND session_name = ? AND term_name = ? AND status = 'published'`).bind(tenantId, sessionName, termName).first() as any
  return Number(row?.count || 0)
}

// Wipes one class's practice sheet, or the whole school's when classId is empty.
export async function clearPracticeResults(db: D1Database, tenantId: string, classId = '') {
  await ensureResultsTables(db)
  const scope = classId ? ' AND class_id = ?' : ''
  const binds = classId ? [tenantId, PRACTICE_PERIOD_KEY, classId] : [tenantId, PRACTICE_PERIOD_KEY]
  const batchIds = ((await db.prepare(`SELECT id FROM result_batches WHERE tenant_id = ? AND session_name = ?${scope}`).bind(...binds).all()).results || []).map((row: any) => String(row.id))
  for (const table of ['result_ca_entries', 'result_student_profiles', 'result_batches']) {
    await db.prepare(`DELETE FROM ${table} WHERE tenant_id = ? AND session_name = ?${scope}`).bind(...binds).run()
  }
  for (const batchId of batchIds) await db.prepare('DELETE FROM result_entry_audit WHERE batch_id = ?').bind(batchId).run()
}

export async function listResultEntries(db: D1Database, batchId: string) {
  await ensureResultsTables(db)
  const rows = await db.prepare('SELECT * FROM result_ca_entries WHERE batch_id = ? ORDER BY subject_name, student_id').bind(batchId).all()
  return (rows.results || []).map((row: any) => ({
    id: row.id,
    batchId: row.batch_id,
    studentId: row.student_id,
    subjectId: row.subject_id,
    subjectName: row.subject_name,
    teacherId: row.teacher_id,
    caComponents: normalizeEntryCaComponents(parseJsonField(row.ca_components_json, {} as Record<string, unknown>)),
    caScore: Number(row.ca_score || 0),
    examScore: Number(row.exam_score || 0),
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
    overrideRank: Number(row.override_rank || 0),
    overrideBy: row.override_by || null,
    overrideName: String(row.override_name || ''),
    overrideRole: String(row.override_role || ''),
    overrideAt: row.override_at || null,
  }))
}

export async function upsertResultStudentProfiles(db: D1Database, params: { tenantId: string, classId: string, sessionName: string, termName: string, sessionId?: string, termId?: string, actorId: string, templateKey?: string, settingsSnapshot?: Record<string, any>, rows: Array<Record<string, any>> }) {
  await ensureResultsTables(db)
  const batchId = await ensureBatchRow(db, params.tenantId, params.classId, params.sessionName, params.termName, params.actorId, params.templateKey, params.settingsSnapshot, { sessionId: (params as any).sessionId, termId: (params as any).termId })
  const existing = await getResultBatch(db, params.tenantId, params.classId, params.sessionName, params.termName)
  if (['submitted', 'published'].includes(String(existing.status || ''))) throw new Error('This result batch is locked. Ask HoS or owner to reopen it.')

  const now = new Date().toISOString()
  for (const row of params.rows || []) {
    await db.prepare(
      `INSERT OR REPLACE INTO result_student_profiles
       (id, batch_id, tenant_id, class_id, session_name, term_name, student_id, attendance_rate, affective_json, ratings_json, teacher_remark, principal_remark, promotion_status, updated_by, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      buildProfileId(batchId, String(row.studentId || '')),
      batchId,
      params.tenantId,
      params.classId,
      params.sessionName,
      params.termName,
      String(row.studentId || ''),
      Number(row.attendanceRate || 0),
      JSON.stringify(row.affective || {}),
      JSON.stringify(row.ratings || {}),
      String(row.teacherRemark || ''),
      String(row.principalRemark || ''),
      String(row.promotionStatus || ''),
      params.actorId,
      now,
    ).run()
  }

  await db.prepare('UPDATE result_batches SET status = ?, template_key = ?, settings_snapshot_json = ?, updated_by = ?, updated_at = ? WHERE id = ?')
    .bind('draft', String(params.templateKey || existing.templateKey || ''), JSON.stringify(params.settingsSnapshot || existing.settingsSnapshot || {}), params.actorId, now, batchId).run()

  return getResultBatch(db, params.tenantId, params.classId, params.sessionName, params.termName)
}

export async function listResultStudentProfiles(db: D1Database, batchId: string) {
  await ensureResultsTables(db)
  const rows = await db.prepare('SELECT * FROM result_student_profiles WHERE batch_id = ? ORDER BY student_id').bind(batchId).all()
  return (rows.results || []).map((row: any) => ({
    id: row.id,
    batchId: row.batch_id,
    studentId: row.student_id,
    attendanceRate: Number(row.attendance_rate || 0),
    affective: parseJsonField(row.affective_json, {} as Record<string, number | string>),
    ratings: parseJsonField(row.ratings_json, {} as Record<string, number | string>),
    teacherRemark: String(row.teacher_remark || ''),
    principalRemark: String(row.principal_remark || ''),
    promotionStatus: String(row.promotion_status || ''),
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
  }))
}

export async function updateResultBatchStatus(db: D1Database, params: { tenantId: string, classId: string, sessionName: string, termName: string, actorId: string, status: 'draft' | 'submitted' | 'published', templateKey?: string, settingsSnapshot?: Record<string, any> }) {
  await ensureResultsTables(db)
  const batchId = await ensureBatchRow(db, params.tenantId, params.classId, params.sessionName, params.termName, params.actorId, params.templateKey, params.settingsSnapshot, { sessionId: (params as any).sessionId, termId: (params as any).termId })
  const now = new Date().toISOString()
  const submittedBy = params.status === 'submitted' ? params.actorId : null
  const submittedAt = params.status === 'submitted' ? now : null
  const approvedBy = params.status === 'published' ? params.actorId : null
  const approvedAt = params.status === 'published' ? now : null
  const publishedAt = params.status === 'published' ? now : null

  await db.prepare(
    `UPDATE result_batches
     SET status = ?, template_key = ?, settings_snapshot_json = ?, updated_by = ?, updated_at = ?, submitted_by = COALESCE(?, submitted_by), submitted_at = COALESCE(?, submitted_at), approved_by = ?, approved_at = ?, published_at = ?
     WHERE id = ?`
  ).bind(params.status, String(params.templateKey || ''), JSON.stringify(params.settingsSnapshot || {}), params.actorId, now, submittedBy, submittedAt, approvedBy, approvedAt, publishedAt, batchId).run()

  return getResultBatch(db, params.tenantId, params.classId, params.sessionName, params.termName)
}

export async function saveResultPublications(db: D1Database, params: { tenantId: string, classId: string, sessionName: string, termName: string, actorId: string, templateKey?: string, settingsSnapshot?: Record<string, any>, publications: Array<{ studentId: string, payload: Record<string, any> }> }) {
  await ensureResultsTables(db)
  const batchId = await ensureBatchRow(db, params.tenantId, params.classId, params.sessionName, params.termName, params.actorId, params.templateKey, params.settingsSnapshot, { sessionId: (params as any).sessionId, termId: (params as any).termId })
  const now = new Date().toISOString()

  for (const item of params.publications || []) {
    await db.prepare(
      `INSERT OR REPLACE INTO result_publications
       (id, batch_id, tenant_id, student_id, session_name, term_name, payload_json, approved_by, approved_at, published_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      buildPublicationId(params.tenantId, item.studentId, params.sessionName, params.termName),
      batchId,
      params.tenantId,
      item.studentId,
      params.sessionName,
      params.termName,
      JSON.stringify(item.payload || {}),
      params.actorId,
      now,
      now,
      now,
    ).run()
  }

  await db.prepare('UPDATE result_batches SET status = ?, template_key = ?, settings_snapshot_json = ?, publication_count = ?, approved_by = ?, approved_at = ?, published_at = ?, updated_by = ?, updated_at = ? WHERE id = ?')
    .bind('published', String(params.templateKey || ''), JSON.stringify(params.settingsSnapshot || {}), (params.publications || []).length, params.actorId, now, now, params.actorId, now, batchId).run()

  return getResultBatch(db, params.tenantId, params.classId, params.sessionName, params.termName)
}

// Newest results first: newest session at the top, and within a session the
// newest term (Term 3 → 2 → 1) on top — so each new term cascades above older ones.
function resultTermRank(termName: unknown): number {
  const value = String(termName || '').toLowerCase()
  if (/(third|(^|[^0-9])3)/.test(value)) return 3
  if (/(second|(^|[^0-9])2)/.test(value)) return 2
  if (/(first|(^|[^0-9])1)/.test(value)) return 1
  return 0
}
function compareResultPeriodDesc(a: { sessionName?: unknown; termName?: unknown }, b: { sessionName?: unknown; termName?: unknown }) {
  const sessionA = String(a.sessionName || '')
  const sessionB = String(b.sessionName || '')
  if (sessionA !== sessionB) return sessionB.localeCompare(sessionA, undefined, { numeric: true })
  return resultTermRank(b.termName) - resultTermRank(a.termName)
}

export async function listStudentResultPublications(db: D1Database, tenantId: string, studentId: string) {
  await ensureResultsTables(db)
  const rows = await db.prepare('SELECT * FROM result_publications WHERE tenant_id = ? AND student_id = ? ORDER BY published_at DESC, updated_at DESC').bind(tenantId, studentId).all()
  return (rows.results || []).map((row: any) => ({
    id: row.id,
    batchId: row.batch_id,
    sessionName: row.session_name,
    termName: row.term_name,
    payload: parseJsonField(row.payload_json, {} as Record<string, any>),
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    publishedAt: row.published_at,
    updatedAt: row.updated_at,
  })).sort(compareResultPeriodDesc)
}

export async function saveResultDocuments(db: D1Database, docs: Array<Record<string, any>>) {
  await ensureResultsTables(db)
  for (const doc of docs || []) {
    await db.prepare(
      `INSERT OR REPLACE INTO result_documents
       (id, tenant_id, student_id, session_name, term_name, source_kind, file_url, file_name, uploaded_by, uploaded_at, metadata_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(doc.id, doc.tenantId, doc.studentId, doc.sessionName, doc.termName, doc.sourceKind, doc.fileUrl, doc.fileName, doc.uploadedBy, doc.uploadedAt, JSON.stringify(doc.metadata || {})).run()
  }
}

export async function listStudentResultDocuments(db: D1Database, tenantId: string, studentId: string) {
  await ensureResultsTables(db)
  const rows = await db.prepare('SELECT * FROM result_documents WHERE tenant_id = ? AND student_id = ? ORDER BY uploaded_at DESC').bind(tenantId, studentId).all()
  return (rows.results || []).map((row: any) => ({
    id: row.id,
    studentId: row.student_id,
    sessionName: row.session_name,
    termName: row.term_name,
    sourceKind: row.source_kind,
    fileUrl: row.file_url,
    fileName: row.file_name,
    uploadedBy: row.uploaded_by,
    uploadedAt: row.uploaded_at,
    metadata: parseJsonField(row.metadata_json, {} as Record<string, any>),
  })).sort(compareResultPeriodDesc)
}

export async function listResultDocumentsForPeriod(db: D1Database, tenantId: string, sessionName: string, termName: string) {
  await ensureResultsTables(db)
  const rows = await db.prepare(
    'SELECT * FROM result_documents WHERE tenant_id = ? AND session_name = ? AND term_name = ? ORDER BY uploaded_at DESC'
  ).bind(tenantId, sessionName, termName).all()

  return (rows.results || []).map((row: any) => ({
    id: row.id,
    studentId: row.student_id,
    sessionName: row.session_name,
    termName: row.term_name,
    sourceKind: row.source_kind,
    fileUrl: row.file_url,
    fileName: row.file_name,
    uploadedBy: row.uploaded_by,
    uploadedAt: row.uploaded_at,
    metadata: parseJsonField(row.metadata_json, {} as Record<string, any>),
  }))
}

export async function listRecentResultDocuments(db: D1Database, tenantId: string, limit = 50) {
  await ensureResultsTables(db)
  const rows = await db.prepare('SELECT * FROM result_documents WHERE tenant_id = ? ORDER BY uploaded_at DESC LIMIT ?').bind(tenantId, limit).all()
  return (rows.results || []).map((row: any) => ({
    id: row.id,
    studentId: row.student_id,
    sessionName: row.session_name,
    termName: row.term_name,
    fileUrl: row.file_url,
    fileName: row.file_name,
    uploadedAt: row.uploaded_at,
    metadata: parseJsonField(row.metadata_json, {} as Record<string, any>),
  }))
}

// ─── C.A. submissions ────────────────────────────────────────────────────────

function mapCaSubmission(row: Record<string, any>) {
  return {
    id: String(row.id), batchId: row.batch_id, classId: row.class_id, sessionName: row.session_name, termName: row.term_name,
    subjectId: row.subject_id, subjectName: row.subject_name || '', componentKey: row.component_key, componentLabel: row.component_label || row.component_key,
    teacherId: row.teacher_id || '', teacherName: row.teacher_name || '', status: row.status as 'submitted' | 'section_approved' | 'approved' | 'returned',
    submittedAt: row.submitted_at || null, sectionApprovedByName: row.section_approved_by_name || '', sectionApprovedAt: row.section_approved_at || null,
    approvedByName: row.approved_by_name || '', approvedAt: row.approved_at || null, returnedByName: row.returned_by_name || '', returnedAt: row.returned_at || null,
    returnNote: row.return_note || '', history: parseJsonField(row.history_json, [] as Array<Record<string, any>>), updatedAt: row.updated_at,
  }
}
export type CaSubmission = ReturnType<typeof mapCaSubmission>

export async function listCaSubmissions(db: D1Database, batchId: string) {
  await ensureResultsTables(db)
  const rows = await db.prepare('SELECT * FROM ca_submissions WHERE batch_id = ? ORDER BY subject_name, component_key').bind(batchId).all()
  return ((rows.results || []) as Record<string, any>[]).map(mapCaSubmission)
}

export async function listCaSubmissionsForPeriod(db: D1Database, tenantId: string, sessionName: string, termName: string) {
  await ensureResultsTables(db)
  const rows = await db.prepare('SELECT * FROM ca_submissions WHERE tenant_id = ? AND session_name = ? AND term_name = ?').bind(tenantId, sessionName, termName).all()
  return ((rows.results || []) as Record<string, any>[]).map(mapCaSubmission)
}

export async function getCaSubmission(db: D1Database, tenantId: string, id: string) {
  await ensureResultsTables(db)
  const row = await db.prepare('SELECT * FROM ca_submissions WHERE tenant_id = ? AND id = ?').bind(tenantId, id).first() as Record<string, any> | null
  return row ? mapCaSubmission(row) : null
}

/** What is frozen for teachers: everything handed in and not returned. */
export function frozenCaComponents(submissions: CaSubmission[]) {
  const frozen = new Map<string, { keys: Set<string>, status: string }>()
  for (const submission of submissions) {
    if (submission.status === 'returned') continue
    const entry = frozen.get(submission.subjectId) || { keys: new Set<string>(), status: submission.status }
    entry.keys.add(submission.componentKey)
    if (submission.status === 'approved') entry.status = 'approved'
    frozen.set(submission.subjectId, entry)
  }
  return frozen
}

export async function submitCaComponent(db: D1Database, params: {
  tenantId: string, batchId: string, classId: string, sessionName: string, termName: string, subjectId: string, subjectName: string,
  componentKey: string, componentLabel: string, teacher: { id: string, name: string },
}) {
  await ensureResultsTables(db)
  const existing = (await listCaSubmissions(db, params.batchId)).filter(item => item.subjectId === params.subjectId)
  const same = existing.find(item => item.componentKey === params.componentKey)
  if (same && same.status !== 'returned') throw new Error(`${params.componentLabel} for ${params.subjectName} has already been handed in.`)
  if (params.componentKey !== 'all' && existing.some(item => item.componentKey === 'all' && item.status !== 'returned')) throw new Error(`All C.A. for ${params.subjectName} has already been handed in.`)
  const now = new Date().toISOString()
  const history = [...(same?.history || []), { at: now, by: params.teacher.name, action: same ? 'resubmitted' : 'submitted' }]
  const id = same?.id || `casub_${normalizeKeyPart(params.batchId)}_${normalizeKeyPart(params.subjectId)}_${normalizeKeyPart(params.componentKey)}`
  await db.prepare(`INSERT INTO ca_submissions (id, tenant_id, batch_id, class_id, session_name, term_name, subject_id, subject_name, component_key, component_label, teacher_id, teacher_name, status, submitted_at, history_json, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted', ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET status = 'submitted', teacher_id = excluded.teacher_id, teacher_name = excluded.teacher_name, submitted_at = excluded.submitted_at,
      section_approved_by_name = NULL, section_approved_at = NULL, approved_by_name = NULL, approved_at = NULL, history_json = excluded.history_json, updated_at = excluded.updated_at`)
    .bind(id, params.tenantId, params.batchId, params.classId, params.sessionName, params.termName, params.subjectId, params.subjectName, params.componentKey, params.componentLabel,
      params.teacher.id, params.teacher.name, now, JSON.stringify(history), now).run()
  return (await getCaSubmission(db, params.tenantId, id))!
}

/**
 * section_approve: the section head accepts it (the teacher's requirement is met).
 * approve: the HoS/Owner accepts it — it is now part of the result and locked.
 * return: sent back for correction, with a note; the teacher can edit and hand it in again.
 */
export async function reviewCaSubmission(db: D1Database, params: { tenantId: string, id: string, action: string, note?: string, actor: { name: string }, finalApprover: boolean }) {
  const submission = await getCaSubmission(db, params.tenantId, params.id)
  if (!submission) throw new Error('Submission not found.')
  const now = new Date().toISOString()
  const note = String(params.note || '').trim().slice(0, 1000)
  const history = [...submission.history, { at: now, by: params.actor.name, action: params.action, note }]
  if (params.action === 'return') {
    if (!note) throw new Error('Say what needs correcting.')
    if (submission.status === 'approved' && !params.finalApprover) throw new Error('Only the HoS or Owner can reopen approved scores.')
    await db.prepare(`UPDATE ca_submissions SET status = 'returned', returned_by_name = ?, returned_at = ?, return_note = ?, history_json = ?, updated_at = ? WHERE id = ?`)
      .bind(params.actor.name, now, note, JSON.stringify(history), now, submission.id).run()
  } else if (params.action === 'section_approve') {
    if (submission.status !== 'submitted') throw new Error('Only handed-in scores waiting for review can be approved here.')
    await db.prepare(`UPDATE ca_submissions SET status = 'section_approved', section_approved_by_name = ?, section_approved_at = ?, history_json = ?, updated_at = ? WHERE id = ?`)
      .bind(params.actor.name, now, JSON.stringify(history), now, submission.id).run()
  } else if (params.action === 'approve') {
    if (!params.finalApprover) throw new Error('Final approval is for the HoS or Owner.')
    if (!['submitted', 'section_approved'].includes(submission.status)) throw new Error('These scores are not waiting for approval.')
    await db.prepare(`UPDATE ca_submissions SET status = 'approved', approved_by_name = ?, approved_at = ?, history_json = ?, updated_at = ? WHERE id = ?`)
      .bind(params.actor.name, now, JSON.stringify(history), now, submission.id).run()
  } else {
    throw new Error('Choose approve or return.')
  }
  return (await getCaSubmission(db, params.tenantId, submission.id))!
}
