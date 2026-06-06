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

export async function ensureResultsTables(db: D1Database) {
  await db.prepare(RESULT_SETTINGS_DDL).run()
  await db.prepare(RESULT_BATCHES_DDL).run()
  await db.prepare(RESULT_ENTRIES_DDL).run()
  try { await db.exec('ALTER TABLE result_ca_entries ADD COLUMN ca_components_json TEXT') } catch {}
  await db.prepare(RESULT_STUDENT_PROFILES_DDL).run()
  await db.prepare(RESULT_PUBLICATIONS_DDL).run()
  await db.prepare(RESULT_DOCUMENTS_DDL).run()
}

export async function getResultSettings(db: D1Database, tenantId: string) {
  await ensureResultsTables(db)
  const row = await db.prepare('SELECT * FROM result_settings WHERE tenant_id = ?').bind(tenantId).first() as Record<string, any> | null
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

export async function saveResultSettings(db: D1Database, tenantId: string, settings: Record<string, any>, actorId: string) {
  await ensureResultsTables(db)
  const now = new Date().toISOString()
  await db.prepare(
    `INSERT OR REPLACE INTO result_settings
     (tenant_id, template_key, grading_scale_json, rating_scale_json, affective_scale_json, affective_domains_json, metadata_json, updated_by, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    tenantId,
    String(settings.templateKey || ''),
    JSON.stringify(settings.gradingScale || []),
    JSON.stringify(settings.ratingScale || []),
    JSON.stringify(settings.affectiveScale || []),
    JSON.stringify(settings.affectiveDomains || []),
    JSON.stringify(settings.metadata || {}),
    actorId,
    now,
  ).run()
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
  const rows = await db.prepare('SELECT * FROM result_batches WHERE tenant_id = ? ORDER BY updated_at DESC').bind(tenantId).all()
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

async function ensureBatchRow(db: D1Database, tenantId: string, classId: string, sessionName: string, termName: string, actorId: string, templateKey = '', settingsSnapshot: Record<string, any> = {}) {
  const batchId = buildBatchId(tenantId, classId, sessionName, termName)
  const now = new Date().toISOString()
  await db.prepare(
    `INSERT OR IGNORE INTO result_batches
     (id, tenant_id, class_id, session_name, term_name, status, template_key, settings_snapshot_json, created_by, created_at, updated_by, updated_at)
     VALUES (?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?)`
  ).bind(batchId, tenantId, classId, sessionName, termName, templateKey, JSON.stringify(settingsSnapshot || {}), actorId, now, actorId, now).run()
  return batchId
}

export async function upsertResultEntries(db: D1Database, params: { tenantId: string, classId: string, sessionName: string, termName: string, actorId: string, templateKey?: string, settingsSnapshot?: Record<string, any>, rows: Array<Record<string, any>> }) {
  await ensureResultsTables(db)
  const batchId = await ensureBatchRow(db, params.tenantId, params.classId, params.sessionName, params.termName, params.actorId, params.templateKey, params.settingsSnapshot)
  const existing = await getResultBatch(db, params.tenantId, params.classId, params.sessionName, params.termName)
  if (['submitted', 'published'].includes(String(existing.status || ''))) throw new Error('This result batch is locked. Ask HoS or owner to reopen it.')

  const now = new Date().toISOString()
  for (const row of params.rows || []) {
    await db.prepare(
      `INSERT OR REPLACE INTO result_ca_entries
       (id, batch_id, tenant_id, class_id, session_name, term_name, student_id, subject_id, subject_name, teacher_id, ca_components_json, ca_score, exam_score, updated_by, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      buildEntryId(batchId, String(row.studentId || ''), String(row.subjectId || '')),
      batchId,
      params.tenantId,
      params.classId,
      params.sessionName,
      params.termName,
      String(row.studentId || ''),
      String(row.subjectId || ''),
      String(row.subjectName || ''),
      String(row.teacherId || params.actorId || ''),
      JSON.stringify(normalizeEntryCaComponents(row.caComponents)),
      Number(row.caScore || 0),
      Number(row.examScore || 0),
      params.actorId,
      now,
    ).run()
  }

  const countRow = await db.prepare('SELECT COUNT(*) as count FROM result_ca_entries WHERE batch_id = ?').bind(batchId).first() as any
  await db.prepare('UPDATE result_batches SET status = ?, template_key = ?, settings_snapshot_json = ?, entry_count = ?, updated_by = ?, updated_at = ? WHERE id = ?')
    .bind('draft', String(params.templateKey || existing.templateKey || ''), JSON.stringify(params.settingsSnapshot || existing.settingsSnapshot || {}), Number(countRow?.count || 0), params.actorId, now, batchId).run()

  return getResultBatch(db, params.tenantId, params.classId, params.sessionName, params.termName)
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
  }))
}

export async function upsertResultStudentProfiles(db: D1Database, params: { tenantId: string, classId: string, sessionName: string, termName: string, actorId: string, templateKey?: string, settingsSnapshot?: Record<string, any>, rows: Array<Record<string, any>> }) {
  await ensureResultsTables(db)
  const batchId = await ensureBatchRow(db, params.tenantId, params.classId, params.sessionName, params.termName, params.actorId, params.templateKey, params.settingsSnapshot)
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
  const batchId = await ensureBatchRow(db, params.tenantId, params.classId, params.sessionName, params.termName, params.actorId, params.templateKey, params.settingsSnapshot)
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
  const batchId = await ensureBatchRow(db, params.tenantId, params.classId, params.sessionName, params.termName, params.actorId, params.templateKey, params.settingsSnapshot)
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