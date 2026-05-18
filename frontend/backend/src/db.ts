export interface Bindings {
  APP_DB: D1Database
  SESSIONS: KVNamespace
  UPLOADS: R2Bucket
  JWT_SECRET: string
  CORS_ORIGIN: string
}

function parseJsonField<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string' || !value) return fallback

  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function resolveMaterialType(url: string | null | undefined, metadata: Record<string, any> = {}) {
  const explicit = String(metadata.type || '').trim().toLowerCase()
  if (['document', 'video', 'image', 'link'].includes(explicit)) return explicit

  const contentType = String(metadata.contentType || '').toLowerCase()
  const target = String(url || '').toLowerCase()

  if (contentType.startsWith('video/') || /\.(mp4|webm|ogg|mov|m4v)(\?|#|$)/.test(target)) return 'video'
  if (contentType.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)(\?|#|$)/.test(target)) return 'image'
  if (/^https?:\/\//.test(target) && !/\.(pdf|docx?|pptx?|xlsx?|csv|txt|rtf|zip)(\?|#|$)/.test(target)) return 'link'
  return 'document'
}

function mapMaterialRow(row: any) {
  const metadata = row?.metadata && typeof row.metadata === 'object'
    ? row.metadata as Record<string, any>
    : parseJsonField(row?.metadata, {} as Record<string, any>)

  return {
    ...row,
    metadata,
    type: resolveMaterialType(row?.url as string, metadata),
    subjectId: String(metadata.subjectId || ''),
    subjectName: String(metadata.subjectName || metadata.subject || 'General Material'),
    description: String(metadata.description || ''),
    topic: String(metadata.topic || ''),
    weekLabel: String(metadata.weekLabel || metadata.week || ''),
    visibility: String(metadata.visibility || ''),
    releaseAt: String(metadata.releaseAt || ''),
    uploadedByName: String(metadata.uploadedByName || row?.uploadedBy || ''),
  }
}

function mapTenantRow(row: any) {
  return {
    id: row.id,
    schoolName: row.school_name,
    schoolSlug: row.school_slug,
    ownerName: row.owner_name,
    ownerEmail: row.owner_email,
    ownerPhone: row.owner_phone,
    planKey: row.plan_key,
    studentCount: Number(row.student_count || 0),
    requestedSubdomain: row.requested_subdomain,
    websiteDomain: row.website_domain,
    status: row.status,
    approvalStatus: row.approval_status,
    paymentStatus: row.payment_status,
    websiteStatus: row.website_status,
    setupFeeCents: Number(row.setup_fee_cents || 0),
    setupFee: Number(row.setup_fee_cents || 0) / 100,
    studentFeeCents: Number(row.student_fee_cents || 0),
    studentFeePerTerm: Number(row.student_fee_cents || 0) / 100,
    currency: row.currency,
    discountCode: row.discount_code,
    discountSnapshot: parseJsonField(row.discount_snapshot, null),
    metadata: parseJsonField(row.metadata, {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    approvedAt: row.approved_at,
    approvedBy: row.approved_by,
    approvalNote: row.approval_note,
    activatedAt: row.activated_at,
    suspendedAt: row.suspended_at,
  }
}

function mapDiscountCodeRow(row: any) {
  return {
    code: row.code,
    name: row.name,
    description: row.description,
    active: Boolean(row.active),
    setupFeeCents: typeof row.setup_fee_cents === 'number' ? row.setup_fee_cents : null,
    setupFee: typeof row.setup_fee_cents === 'number' ? row.setup_fee_cents / 100 : null,
    studentFeeCents: typeof row.student_fee_cents === 'number' ? row.student_fee_cents : null,
    studentFeePerTerm: typeof row.student_fee_cents === 'number' ? row.student_fee_cents / 100 : null,
    planScope: row.plan_scope,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    maxRedemptions: row.max_redemptions,
    redemptionCount: Number(row.redemption_count || 0),
    createdBy: row.created_by,
    metadata: parseJsonField(row.metadata, {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapTenantPaymentRow(row: any) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    initiatedBy: row.initiated_by,
    initiatedRole: row.initiated_role,
    txRef: row.tx_ref,
    flutterwaveLink: row.flutterwave_link,
    flutterwaveTxId: row.flutterwave_tx_id,
    amountCents: Number(row.amount_cents || 0),
    amount: Number(row.amount_cents || 0) / 100,
    currency: row.currency,
    status: row.status,
    planKey: row.plan_key,
    studentCount: Number(row.student_count || 0),
    discountCode: row.discount_code,
    providerResponse: parseJsonField(row.provider_response, null),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    paidAt: row.paid_at,
  }
}

const SETTINGS_DDL = `CREATE TABLE IF NOT EXISTS settings (studentId TEXT PRIMARY KEY, payload TEXT NOT NULL)`
const AUDIT_DDL = `CREATE TABLE IF NOT EXISTS audit (
  id TEXT PRIMARY KEY,
  studentId TEXT,
  ts TEXT,
  action TEXT,
  data TEXT
)`

// Settings functions
export async function getSettings(db: D1Database, studentId: string) {
  try {
    await db.prepare(SETTINGS_DDL).run()
  } catch { /* table already exists */ }
  const result = await db.prepare('SELECT payload FROM settings WHERE studentId = ?').bind(studentId).first()
  if (!result) return null
  try {
    return JSON.parse(result.payload as string)
  } catch {
    return null
  }
}

export async function upsertSettings(db: D1Database, studentId: string, payload: any) {
  try {
    await db.prepare(SETTINGS_DDL).run()
  } catch { /* table already exists */ }
  const str = JSON.stringify(payload)
  await db.prepare('INSERT INTO settings(studentId, payload) VALUES(?, ?) ON CONFLICT(studentId) DO UPDATE SET payload = excluded.payload').bind(studentId, str).run()
  return true
}

async function ensureAuditTable(db: D1Database) {
  try {
    await db.prepare(AUDIT_DDL).run()
  } catch { /* table already exists */ }
}

export async function addAudit(db: D1Database, studentId: string, entry: any) {
  await ensureAuditTable(db)
  const id = entry.id || `audit-${Date.now()}`
  const ts = entry.ts || new Date().toISOString()
  const action = entry.action || 'unknown'
  const data = JSON.stringify(entry.data || {})
  await db.prepare('INSERT INTO audit(id, studentId, ts, action, data) VALUES(?, ?, ?, ?, ?)').bind(id, studentId, ts, action, data).run()
  return { id, studentId, ts, action, data: JSON.parse(data) }
}

export async function getAuditForStudent(db: D1Database, studentId: string) {
  await ensureAuditTable(db)
  const result = await db.prepare('SELECT id, studentId, ts, action, data FROM audit WHERE studentId = ? ORDER BY ts DESC').bind(studentId).all()
  return result.results.map(r => ({ ...r, data: JSON.parse(r.data as string) }))
}

export async function getAllAudits(db: D1Database) {
  await ensureAuditTable(db)
  const result = await db.prepare('SELECT id, studentId, ts, action, data FROM audit ORDER BY ts DESC').all()
  return result.results.map(r => ({ ...r, data: JSON.parse(r.data as string) }))
}

// Library functions
export async function getAllBooks(db: D1Database) {
  const result = await db.prepare('SELECT id, title, author, description, cover, metadata FROM books ORDER BY title').all()
  return result.results.map(r => ({ ...r, metadata: r.metadata ? JSON.parse(r.metadata as string) : {} }))
}

export async function getBookById(db: D1Database, id: string) {
  const result = await db.prepare('SELECT id, title, author, description, cover, metadata FROM books WHERE id = ?').bind(id).first()
  if (!result) return null
  return { ...result, metadata: result.metadata ? JSON.parse(result.metadata as string) : {} }
}

export async function upsertBook(db: D1Database, book: any) {
  const id = book.id || `book-${Date.now()}`
  const meta = JSON.stringify(book.metadata || {})
  await db.prepare('INSERT INTO books(id, title, author, description, cover, metadata) VALUES(?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET title = excluded.title, author = excluded.author, description = excluded.description, cover = excluded.cover, metadata = excluded.metadata').bind(id, book.title || null, book.author || null, book.description || null, book.cover || null, meta).run()
  return { id }
}

export async function deleteBook(db: D1Database, id: string) {
  await db.prepare('DELETE FROM books WHERE id = ?').bind(id).run()
  return true
}

export async function borrowBook(db: D1Database, bookId: string, studentId: string, dueAt: string | null, meta: any) {
  const id = `borrow-${Date.now()}`
  const borrowedAt = new Date().toISOString()
  const status = 'borrowed'
  const metaStr = JSON.stringify(meta || {})
  await db.prepare('INSERT INTO borrowings(id, bookId, studentId, borrowedAt, dueAt, returnedAt, status, meta) VALUES(?, ?, ?, ?, ?, ?, ?, ?)').bind(id, bookId, studentId, borrowedAt, dueAt, null, status, metaStr).run()
  return { id, bookId, studentId, borrowedAt, dueAt, status, meta: meta || {} }
}

export async function returnBook(db: D1Database, borrowingId: string) {
  const returnedAt = new Date().toISOString()
  const status = 'returned'
  await db.prepare('UPDATE borrowings SET returnedAt = ?, status = ? WHERE id = ?').bind(returnedAt, status, borrowingId).run()
  return { id: borrowingId, returnedAt, status }
}

export async function getBorrowingsForStudent(db: D1Database, studentId: string) {
  const result = await db.prepare('SELECT id, bookId, studentId, borrowedAt, dueAt, returnedAt, status, meta FROM borrowings WHERE studentId = ? ORDER BY borrowedAt DESC').bind(studentId).all()
  return result.results.map(r => ({ ...r, meta: r.meta ? JSON.parse(r.meta as string) : {} }))
}

export async function getAllBorrowings(db: D1Database) {
  const result = await db.prepare('SELECT id, bookId, studentId, borrowedAt, dueAt, returnedAt, status, meta FROM borrowings ORDER BY borrowedAt DESC').all()
  return result.results.map(r => ({ ...r, meta: r.meta ? JSON.parse(r.meta as string) : {} }))
}

async function ensureAssignmentsTable(db: D1Database) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS assignments (
    id TEXT PRIMARY KEY,
    classId TEXT,
    title TEXT,
    description TEXT,
    dueAt TEXT,
    createdAt TEXT,
    subjectId TEXT,
    subjectName TEXT,
    format TEXT,
    questionPayload TEXT,
    metadata TEXT,
    createdBy TEXT,
    updatedAt TEXT
  )`).run()
  try { await db.exec('ALTER TABLE assignments ADD COLUMN subjectId TEXT') } catch {}
  try { await db.exec('ALTER TABLE assignments ADD COLUMN subjectName TEXT') } catch {}
  try { await db.exec('ALTER TABLE assignments ADD COLUMN format TEXT') } catch {}
  try { await db.exec('ALTER TABLE assignments ADD COLUMN questionPayload TEXT') } catch {}
  try { await db.exec('ALTER TABLE assignments ADD COLUMN metadata TEXT') } catch {}
  try { await db.exec('ALTER TABLE assignments ADD COLUMN createdBy TEXT') } catch {}
  try { await db.exec('ALTER TABLE assignments ADD COLUMN updatedAt TEXT') } catch {}
}

async function ensureSubmissionsTable(db: D1Database) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS submissions (
    id TEXT PRIMARY KEY,
    assignmentId TEXT,
    studentId TEXT,
    content TEXT,
    submittedAt TEXT,
    grade REAL,
    gradedAt TEXT,
    feedback TEXT
  )`).run()
}

async function ensurePostsTable(db: D1Database) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS posts (
    id TEXT PRIMARY KEY,
    classId TEXT,
    authorId TEXT,
    content TEXT,
    attachments TEXT,
    comments TEXT,
    createdAt TEXT
  )`).run()
  try { await db.exec('ALTER TABLE posts ADD COLUMN comments TEXT') } catch {}
}

async function ensureMaterialsTable(db: D1Database) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS materials (
    id TEXT PRIMARY KEY,
    classId TEXT,
    title TEXT,
    url TEXT,
    metadata TEXT,
    uploadedAt TEXT,
    uploadedBy TEXT
  )`).run()
}

async function ensureLiveSessionsTable(db: D1Database) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS classroom_live_sessions (
    id TEXT PRIMARY KEY,
    classId TEXT,
    subjectId TEXT,
    subjectName TEXT,
    topic TEXT,
    mode TEXT,
    status TEXT,
    createdBy TEXT,
    createdByName TEXT,
    startedAt TEXT,
    endedAt TEXT,
    createdAt TEXT,
    metadata TEXT
  )`).run()
  try { await db.exec('ALTER TABLE classroom_live_sessions ADD COLUMN metadata TEXT') } catch {}
  try { await db.exec('ALTER TABLE classroom_live_sessions ADD COLUMN createdByName TEXT') } catch {}
}

// Classroom functions
export async function getClassById(db: D1Database, id: string) {
  const result = await db.prepare('SELECT id, tenantId, name, arm, classTeacherId FROM classes WHERE id = ?').bind(id).first()
  if (!result) return null
  return {
    ...result,
    className: `${result.name as string}${result.arm ? ` ${result.arm as string}` : ''}`,
    teacherId: result.classTeacherId,
  }
}

export async function getPostsForClass(db: D1Database, classId: string, limit = 100) {
  await ensurePostsTable(db)
  const result = await db.prepare('SELECT id, classId, authorId, content, attachments, comments, createdAt FROM posts WHERE classId = ? ORDER BY createdAt DESC LIMIT ?').bind(classId, limit).all()
  return result.results.map(r => ({
    ...r,
    attachments: parseJsonField(r.attachments, [] as any[]),
    comments: parseJsonField(r.comments, [] as any[]),
  }))
}

export async function createPost(db: D1Database, post: any) {
  await ensurePostsTable(db)
  const id = post.id || `post-${Date.now()}`
  const createdAt = new Date().toISOString()
  const attachments = JSON.stringify(post.attachments || [])
  const comments = JSON.stringify(post.comments || [])
  await db.prepare('INSERT INTO posts(id, classId, authorId, content, attachments, comments, createdAt) VALUES(?, ?, ?, ?, ?, ?, ?)').bind(id, post.classId, post.authorId, post.content || null, attachments, comments, createdAt).run()
  return { id, classId: post.classId, authorId: post.authorId, content: post.content, attachments: post.attachments || [], comments: post.comments || [], createdAt }
}

export async function addPostComment(db: D1Database, postId: string, comment: any) {
  await ensurePostsTable(db)
  const row = await db.prepare('SELECT id, comments FROM posts WHERE id = ?').bind(postId).first()
  if (!row) throw new Error('Post not found')

  const existingComments = parseJsonField((row as any).comments, [] as any[])
  const insertedComment = {
    id: comment.id || `comment-${Date.now()}`,
    user: comment.user || comment.authorId || 'Teacher',
    authorId: comment.authorId || null,
    text: comment.text || '',
    createdAt: comment.createdAt || new Date().toISOString(),
  }

  await db.prepare('UPDATE posts SET comments = ? WHERE id = ?').bind(JSON.stringify([...existingComments, insertedComment]), postId).run()
  return insertedComment
}

export async function getAssignmentsForClass(db: D1Database, classId: string) {
  await ensureAssignmentsTable(db)
  const result = await db.prepare(
    'SELECT id, classId, title, description, dueAt, createdAt, subjectId, subjectName, format, questionPayload, metadata, createdBy, updatedAt FROM assignments WHERE classId = ? ORDER BY createdAt DESC'
  ).bind(classId).all()
  return result.results.map(row => ({
    ...row,
    questions: parseJsonField(row.questionPayload, [] as any[]),
    metadata: parseJsonField(row.metadata, {} as Record<string, any>),
  }))
}

export async function getAssignmentById(db: D1Database, assignmentId: string) {
  await ensureAssignmentsTable(db)
  const row = await db.prepare(
    'SELECT id, classId, title, description, dueAt, createdAt, subjectId, subjectName, format, questionPayload, metadata, createdBy, updatedAt FROM assignments WHERE id = ?'
  ).bind(assignmentId).first()
  if (!row) return null
  return {
    ...row,
    questions: parseJsonField((row as any).questionPayload, [] as any[]),
    metadata: parseJsonField((row as any).metadata, {} as Record<string, any>),
  }
}

export async function createAssignment(db: D1Database, a: any) {
  await ensureAssignmentsTable(db)
  const id = a.id || `assign-${Date.now()}`
  const createdAt = new Date().toISOString()
  const updatedAt = createdAt
  const questions = Array.isArray(a.questions) ? a.questions : []
  const metadata = a.metadata && typeof a.metadata === 'object' ? a.metadata : {}
  await db.prepare(
    'INSERT INTO assignments(id, classId, title, description, dueAt, createdAt, subjectId, subjectName, format, questionPayload, metadata, createdBy, updatedAt) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(
    id,
    a.classId,
    a.title || null,
    a.description || null,
    a.dueAt || null,
    createdAt,
    a.subjectId || null,
    a.subjectName || null,
    a.format || null,
    JSON.stringify(questions),
    JSON.stringify(metadata),
    a.createdBy || null,
    updatedAt,
  ).run()
  return {
    id,
    classId: a.classId,
    title: a.title,
    description: a.description,
    dueAt: a.dueAt,
    createdAt,
    updatedAt,
    subjectId: a.subjectId || null,
    subjectName: a.subjectName || null,
    format: a.format || null,
    questions,
    metadata,
    createdBy: a.createdBy || null,
  }
}

export async function getLatestSubmissionForStudent(db: D1Database, assignmentId: string, studentId: string) {
  await ensureSubmissionsTable(db)
  const row = await db.prepare(
    'SELECT id, assignmentId, studentId, content, submittedAt, grade, gradedAt, feedback FROM submissions WHERE assignmentId = ? AND studentId = ? ORDER BY submittedAt DESC LIMIT 1'
  ).bind(assignmentId, studentId).first()
  if (!row) return null
  return {
    ...row,
    content: parseJsonField((row as any).content, {} as Record<string, any>),
  }
}

export async function createSubmission(db: D1Database, submission: any) {
  await ensureSubmissionsTable(db)
  const id = submission.id || `submission_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const submittedAt = submission.submittedAt || new Date().toISOString()
  await db.prepare(
    'INSERT INTO submissions(id, assignmentId, studentId, content, submittedAt, grade, gradedAt, feedback) VALUES(?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(
    id,
    submission.assignmentId,
    submission.studentId,
    JSON.stringify(submission.content || {}),
    submittedAt,
    submission.grade ?? null,
    submission.gradedAt ?? null,
    submission.feedback ?? null,
  ).run()
  return {
    id,
    assignmentId: submission.assignmentId,
    studentId: submission.studentId,
    content: submission.content || {},
    submittedAt,
    grade: submission.grade ?? null,
    gradedAt: submission.gradedAt ?? null,
    feedback: submission.feedback ?? null,
  }
}

export async function getMaterialsForClass(db: D1Database, classId: string) {
  await ensureMaterialsTable(db)
  const result = await db.prepare('SELECT id, classId, title, url, metadata, uploadedAt, uploadedBy FROM materials WHERE classId = ? ORDER BY uploadedAt DESC').bind(classId).all()
  return result.results.map(mapMaterialRow)
}

export async function addMaterial(db: D1Database, mat: any) {
  await ensureMaterialsTable(db)
  const id = mat.id || `mat-${Date.now()}`
  const uploadedAt = new Date().toISOString()
  const metadata = mat.metadata && typeof mat.metadata === 'object' ? mat.metadata : {}
  await db.prepare('INSERT INTO materials(id, classId, title, url, metadata, uploadedAt, uploadedBy) VALUES(?, ?, ?, ?, ?, ?, ?)').bind(id, mat.classId, mat.title || null, mat.url || null, JSON.stringify(metadata), uploadedAt, mat.uploadedBy || null).run()
  return mapMaterialRow({
    id,
    classId: mat.classId,
    title: mat.title,
    url: mat.url,
    metadata,
    uploadedAt,
    uploadedBy: mat.uploadedBy,
  })
}

export async function getAttendanceForClass(db: D1Database, classId: string, sinceDate?: string) {
  let query = 'SELECT id, classId, studentId, date, status, recordedBy, notes FROM attendance_records WHERE classId = ?'
  const params = [classId]
  if (sinceDate) {
    query += ' AND date >= ?'
    params.push(sinceDate)
  }
  query += ' ORDER BY date DESC'
  const result = await db.prepare(query).bind(...params).all()
  return result.results
}

export async function recordAttendance(db: D1Database, classId: string, studentId: string, date: string, status: string, recordedBy?: string, notes?: string) {
  const id = `att-${Date.now()}-${Math.random().toString(36).slice(2,6)}`
  await db.prepare('INSERT INTO attendance_records(id, classId, studentId, date, status, recordedBy, notes) VALUES(?, ?, ?, ?, ?, ?, ?)').bind(id, classId, studentId, date, status, recordedBy || null, notes || null).run()
  return { id, classId, studentId, date, status, recordedBy, notes }
}

export async function saveContent(db: D1Database, classId: string, role: string, content: string) {
  const id = `save-${Date.now()}`
  const ts = new Date().toISOString()
  await db.prepare('INSERT INTO content_saves(id, classId, role, content, ts) VALUES(?, ?, ?, ?, ?)').bind(id, classId || null, role || null, content || null, ts).run()
  return { id, classId, role, ts }
}

export async function getLiveSessionsForClass(db: D1Database, classId: string) {
  await ensureLiveSessionsTable(db)
  const result = await db.prepare(
    'SELECT id, classId, subjectId, subjectName, topic, mode, status, createdBy, createdByName, startedAt, endedAt, createdAt, metadata FROM classroom_live_sessions WHERE classId = ? ORDER BY createdAt DESC LIMIT 50'
  ).bind(classId).all()

  return result.results.map(row => ({
    ...row,
    metadata: parseJsonField((row as any).metadata, {} as Record<string, any>),
  }))
}

export async function createLiveSession(db: D1Database, session: any) {
  await ensureLiveSessionsTable(db)
  const id = session.id || `live_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const now = new Date().toISOString()
  const inserted = {
    id,
    classId: session.classId,
    subjectId: session.subjectId || null,
    subjectName: session.subjectName || null,
    topic: session.topic || 'Live Class',
    mode: session.mode || 'Video + Audio',
    status: session.status || 'Live Now',
    createdBy: session.createdBy || null,
    createdByName: session.createdByName || null,
    startedAt: session.startedAt || now,
    endedAt: session.endedAt || null,
    createdAt: now,
    metadata: session.metadata && typeof session.metadata === 'object' ? session.metadata : {},
  }

  await db.prepare(
    'INSERT INTO classroom_live_sessions(id, classId, subjectId, subjectName, topic, mode, status, createdBy, createdByName, startedAt, endedAt, createdAt, metadata) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(
    inserted.id,
    inserted.classId,
    inserted.subjectId,
    inserted.subjectName,
    inserted.topic,
    inserted.mode,
    inserted.status,
    inserted.createdBy,
    inserted.createdByName,
    inserted.startedAt,
    inserted.endedAt,
    inserted.createdAt,
    JSON.stringify(inserted.metadata),
  ).run()

  return inserted
}

export async function updateLiveSessionStatus(db: D1Database, sessionId: string, status: string, endedAt?: string | null) {
  await ensureLiveSessionsTable(db)
  const row = await db.prepare(
    'SELECT id, classId, subjectId, subjectName, topic, mode, status, createdBy, createdByName, startedAt, endedAt, createdAt, metadata FROM classroom_live_sessions WHERE id = ?'
  ).bind(sessionId).first()
  if (!row) throw new Error('Live session not found')

  const nextEndedAt = typeof endedAt === 'string' ? endedAt : (status === 'Ended' ? new Date().toISOString() : null)
  await db.prepare('UPDATE classroom_live_sessions SET status = ?, endedAt = ? WHERE id = ?').bind(status, nextEndedAt, sessionId).run()

  return {
    ...row,
    status,
    endedAt: nextEndedAt,
    metadata: parseJsonField((row as any).metadata, {} as Record<string, any>),
  }
}

// Attendance functions (assuming attendance_records table exists)
export async function getAttendance(db: D1Database, studentId: string, limit = 365) {
  const result = await db.prepare('SELECT * FROM attendance_records WHERE student_id = ? ORDER BY date DESC LIMIT ?').bind(studentId, limit).all()
  return result.results
}

export async function upsertAttendance(db: D1Database, studentId: string, date: string, status: string, reason?: string, recordedBy?: string) {
  const existing = await db.prepare('SELECT id FROM attendance_records WHERE student_id = ? AND date = ?').bind(studentId, date).first()
  if (existing) {
    await db.prepare('UPDATE attendance_records SET status = ?, reason = ?, recorded_by = ?, updated_at = ? WHERE id = ?').bind(status, reason || null, recordedBy || null, new Date().toISOString(), existing.id).run()
    return { updated: true }
  } else {
    const id = `att-${Date.now()}`
    await db.prepare('INSERT INTO attendance_records(id, student_id, date, status, reason, recorded_by) VALUES(?, ?, ?, ?, ?, ?)').bind(id, studentId, date, status, reason || null, recordedBy || null).run()
    return { id }
  }
}

export async function updateAttendance(db: D1Database, id: string, status: string, reason?: string) {
  const existing = await db.prepare('SELECT * FROM attendance_records WHERE id = ?').bind(id).first()
  if (!existing) throw new Error('Record not found')
  await db.prepare('UPDATE attendance_records SET status = ?, reason = ?, updated_at = ? WHERE id = ?').bind(status, reason || (existing.reason as string), new Date().toISOString(), id).run()
  return true
}

// Conversations and messages (assuming tables exist from migrations)
export async function getConversations(db: D1Database, userId?: string) {
  let query = 'SELECT id, subject, participants, created_at, updated_at FROM conversations ORDER BY updated_at DESC LIMIT 200'
  const params: string[] = []
  if (userId) {
    query = 'SELECT id, subject, participants, created_at, updated_at FROM conversations WHERE participants LIKE ? ORDER BY updated_at DESC LIMIT 200'
    params.push(`%"${userId}"%`)
  }
  const result = await db.prepare(query).bind(...params).all()
  return result.results.map(r => ({ ...r, participants: JSON.parse(r.participants as string) }))
}

export async function createConversation(db: D1Database, subject: string | null, participants: string[]) {
  const normalizedParticipants = Array.from(new Set((participants || []).map(participant => String(participant || '').trim()).filter(Boolean)))
  if (!Array.isArray(normalizedParticipants) || normalizedParticipants.length === 0) throw new Error('Missing participants')
  const id = `conv_${Date.now()}_${Math.random().toString(36).slice(2,8)}`
  const now = new Date().toISOString()
  await db.prepare('INSERT INTO conversations(id, subject, participants, created_at, updated_at) VALUES(?, ?, ?, ?, ?)').bind(id, subject, JSON.stringify(normalizedParticipants), now, now).run()
  return { id, subject, participants: normalizedParticipants }
}

export async function getMessages(db: D1Database, conversationId: string) {
  const result = await db.prepare('SELECT id, conversation_id, sender_id, body, metadata, sent_at, read_at FROM messages WHERE conversation_id = ? ORDER BY sent_at ASC LIMIT 200').bind(conversationId).all()
  return result.results.map(r => ({ ...r, metadata: r.metadata ? JSON.parse(r.metadata as string) : {} }))
}

export async function sendMessage(db: D1Database, conversationId: string, senderId: string, body: string, metadata?: any) {
  const conv = await db.prepare('SELECT participants FROM conversations WHERE id = ?').bind(conversationId).first()
  if (!conv) throw new Error('Conversation not found')
  const msgId = `msg_${Date.now()}_${Math.random().toString(36).slice(2,8)}`
  const now = new Date().toISOString()
  await db.prepare('INSERT INTO messages(id, conversation_id, sender_id, body, metadata, sent_at) VALUES(?, ?, ?, ?, ?, ?)').bind(msgId, conversationId, senderId, body, JSON.stringify(metadata || {}), now).run()
  await db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?').bind(now, conversationId).run()
  return { id: msgId, conversationId, senderId, body, metadata: metadata || {}, sentAt: now }
}

const CONVERSATION_READS_DDL = `CREATE TABLE IF NOT EXISTS conversation_reads (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  last_read_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(conversation_id, user_id)
)`

async function ensureConversationReadsTable(db: D1Database) {
  await db.prepare(CONVERSATION_READS_DDL).run()
}

export async function listConversationReadStates(db: D1Database, userId: string) {
  await ensureConversationReadsTable(db)
  const normalizedUserId = String(userId || '').trim()
  if (!normalizedUserId) return {}

  const result = await db.prepare(
    'SELECT conversation_id, last_read_at FROM conversation_reads WHERE user_id = ?'
  ).bind(normalizedUserId).all()

  return result.results.reduce((accumulator, row) => {
    accumulator[String(row.conversation_id)] = String(row.last_read_at || '')
    return accumulator
  }, {} as Record<string, string>)
}

export async function markMessagesRead(db: D1Database, conversationId: string, readerId?: string, readerIdentifiers: string[] = []) {
  await ensureConversationReadsTable(db)

  const now = new Date().toISOString()
  const normalizedReaderId = String(readerId || '').trim()
  const normalizedIdentifiers = Array.from(new Set((readerIdentifiers || []).map(identifier => String(identifier || '').trim()).filter(Boolean)))

  if (normalizedIdentifiers.length > 0) {
    const placeholders = normalizedIdentifiers.map(() => '?').join(', ')
    await db.prepare(
      `UPDATE messages SET read_at = ? WHERE conversation_id = ? AND sender_id NOT IN (${placeholders}) AND read_at IS NULL`
    ).bind(now, conversationId, ...normalizedIdentifiers).run()
  } else {
    await db.prepare('UPDATE messages SET read_at = ? WHERE conversation_id = ? AND read_at IS NULL').bind(now, conversationId).run()
  }

  if (normalizedReaderId) {
    const recordId = `convread_${conversationId}_${normalizedReaderId}`
    await db.prepare(
      `INSERT INTO conversation_reads(id, conversation_id, user_id, last_read_at, created_at, updated_at)
       VALUES(?, ?, ?, ?, ?, ?)
       ON CONFLICT(conversation_id, user_id)
       DO UPDATE SET last_read_at = excluded.last_read_at, updated_at = excluded.updated_at`
    ).bind(recordId, conversationId, normalizedReaderId, now, now, now).run()
  }

  return true
}

const SCHOOL_ANNOUNCEMENTS_DDL = `CREATE TABLE IF NOT EXISTS school_announcements (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  author_id TEXT NOT NULL,
  author_name TEXT,
  author_role TEXT,
  audience_roles TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`

async function ensureSchoolAnnouncementsTable(db: D1Database) {
  await db.prepare(SCHOOL_ANNOUNCEMENTS_DDL).run()
}

export async function listSchoolAnnouncements(db: D1Database, tenantId: string, limit = 10) {
  await ensureSchoolAnnouncementsTable(db)
  const safeLimit = Math.max(1, Math.min(Number(limit) || 10, 50))
  const result = await db.prepare(
    'SELECT id, tenant_id, title, body, author_id, author_name, author_role, audience_roles, created_at, updated_at FROM school_announcements WHERE tenant_id = ? ORDER BY created_at DESC LIMIT ?'
  ).bind(tenantId, safeLimit).all()

  return result.results.map(row => ({
    id: row.id,
    tenantId: row.tenant_id,
    title: row.title,
    body: row.body,
    authorId: row.author_id,
    authorName: row.author_name,
    authorRole: row.author_role,
    audienceRoles: row.audience_roles ? JSON.parse(row.audience_roles as string) : ['all'],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }))
}

export async function createSchoolAnnouncement(db: D1Database, payload: {
  tenantId: string,
  title: string,
  body: string,
  authorId: string,
  authorName?: string,
  authorRole?: string,
  audienceRoles?: string[],
}) {
  await ensureSchoolAnnouncementsTable(db)

  const id = `ann_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const now = new Date().toISOString()
  const audienceRoles = Array.from(new Set((payload.audienceRoles || ['all']).map(role => String(role || '').trim().toLowerCase()).filter(Boolean)))

  await db.prepare(
    'INSERT INTO school_announcements(id, tenant_id, title, body, author_id, author_name, author_role, audience_roles, created_at, updated_at) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(
    id,
    payload.tenantId,
    payload.title,
    payload.body,
    payload.authorId,
    payload.authorName || null,
    payload.authorRole || null,
    JSON.stringify(audienceRoles.length > 0 ? audienceRoles : ['all']),
    now,
    now,
  ).run()

  return {
    id,
    tenantId: payload.tenantId,
    title: payload.title,
    body: payload.body,
    authorId: payload.authorId,
    authorName: payload.authorName || null,
    authorRole: payload.authorRole || null,
    audienceRoles: audienceRoles.length > 0 ? audienceRoles : ['all'],
    createdAt: now,
    updatedAt: now,
  }
}

// Tuck orders (assuming tuck_orders table exists)
export async function getTuckOrders(db: D1Database, placedBy?: string) {
  let query = 'SELECT id, placed_by, items, total_cents, notes, status, placed_at, updated_at FROM tuck_orders ORDER BY placed_at DESC LIMIT 200'
  const params: string[] = []
  if (placedBy) {
    query = 'SELECT id, placed_by, items, total_cents, notes, status, placed_at, updated_at FROM tuck_orders WHERE placed_by = ? ORDER BY placed_at DESC LIMIT 200'
    params.push(placedBy)
  }
  const result = await db.prepare(query).bind(...params).all()
  return result.results.map(r => ({
    id: r.id,
    placedBy: r.placed_by,
    items: JSON.parse(r.items as string),
    total: (r.total_cents as number) / 100,
    notes: r.notes,
    status: r.status,
    placedAt: r.placed_at,
    updatedAt: r.updated_at
  }))
}

export async function createTuckOrder(db: D1Database, order: any) {
  const id = order.id || `order_${Date.now()}`
  const placedBy = order.placedBy || null
  const itemsJson = JSON.stringify(order.items || [])
  const totalCents = Math.round((order.total || 0) * 100)
  const notes = order.notes || null
  const status = order.status || 'pending'
  const now = new Date().toISOString()
  await db.prepare('INSERT INTO tuck_orders(id, placed_by, items, total_cents, notes, status, placed_at, updated_at) VALUES(?, ?, ?, ?, ?, ?, ?, ?)').bind(id, placedBy, itemsJson, totalCents, notes, status, now, now).run()
  return {
    ...order,
    id,
    total: totalCents / 100,
    placedAt: now,
    status
  }
}

export async function updateTuckOrder(db: D1Database, id: string, changes: any) {
  const existing = await db.prepare('SELECT * FROM tuck_orders WHERE id = ?').bind(id).first()
  if (!existing) throw new Error('Order not found')
  if (existing.status !== 'pending') throw new Error('Only pending orders can be amended')
  const update: any = {}
  if (changes.items) update.items = JSON.stringify(changes.items)
  if (typeof changes.total !== 'undefined') update.total_cents = Math.round(changes.total * 100)
  if (typeof changes.notes !== 'undefined') update.notes = changes.notes
  if (typeof changes.status !== 'undefined') update.status = changes.status
  update.updated_at = new Date().toISOString()
  const setClause = Object.keys(update).map(k => `${k} = ?`).join(', ')
  const values = Object.values(update)
  values.push(id)
  await db.prepare(`UPDATE tuck_orders SET ${setClause} WHERE id = ?`).bind(...values).run()
  return true
}

export async function getWeeklyTuckSummary(db: D1Database, placedBy?: string, weeks = 12) {
  const lookback = Math.max(1, Math.min(52, weeks))
  const since = new Date()
  since.setDate(since.getDate() - (lookback * 7))
  let query = 'SELECT * FROM tuck_orders WHERE placed_at >= ?'
  const params = [since.toISOString()]
  if (placedBy) {
    query += ' AND placed_by = ?'
    params.push(placedBy)
  }
  const result = await db.prepare(query).bind(...params).all()
  const groups: any = {}
  result.results.forEach((r: any) => {
    const d = new Date(r.placed_at as string)
    const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
    const day = tmp.getUTCDay() || 7
    const monday = new Date(tmp)
    monday.setUTCDate(tmp.getUTCDate() - (day - 1))
    const weekKey = monday.toISOString().slice(0,10)
    const userKey = r.placed_by || 'unknown'
    const key = `${userKey}::${weekKey}`
    if (!groups[key]) groups[key] = { placedBy: userKey, weekStart: weekKey, orders: [], total: 0 }
    groups[key].orders.push({
      id: r.id,
      items: JSON.parse(r.items as string),
      total: (r.total_cents as number) / 100,
      status: r.status,
      placedAt: r.placed_at
    })
    groups[key].total += (r.total_cents as number) / 100
  })
  return Object.values(groups).sort((a: any, b: any) => b.weekStart.localeCompare(a.weekStart))
}

export async function createTenant(db: D1Database, tenant: any) {
  const now = new Date().toISOString()
  await db.prepare(
    'INSERT INTO tenants(id, school_name, school_slug, owner_name, owner_email, owner_phone, plan_key, student_count, requested_subdomain, website_domain, status, approval_status, payment_status, website_status, setup_fee_cents, student_fee_cents, currency, discount_code, discount_snapshot, metadata, created_at, updated_at, approved_at, approved_by, approval_note, activated_at, suspended_at) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(
    tenant.id,
    tenant.schoolName,
    tenant.schoolSlug,
    tenant.ownerName,
    tenant.ownerEmail,
    tenant.ownerPhone || null,
    tenant.planKey,
    tenant.studentCount || 0,
    tenant.requestedSubdomain,
    tenant.websiteDomain,
    tenant.status || 'pending_payment',
    tenant.approvalStatus || 'pending',
    tenant.paymentStatus || 'pending',
    tenant.websiteStatus || 'inactive',
    tenant.setupFeeCents,
    tenant.studentFeeCents,
    tenant.currency || 'NGN',
    tenant.discountCode || null,
    JSON.stringify(tenant.discountSnapshot || null),
    JSON.stringify(tenant.metadata || {}),
    tenant.createdAt || now,
    tenant.updatedAt || now,
    tenant.approvedAt || null,
    tenant.approvedBy || null,
    tenant.approvalNote || null,
    tenant.activatedAt || null,
    tenant.suspendedAt || null,
  ).run()

  return getTenantById(db, tenant.id)
}

export async function getTenantById(db: D1Database, id: string) {
  const result = await db.prepare('SELECT * FROM tenants WHERE id = ?').bind(id).first()
  if (!result) return null
  return mapTenantRow(result)
}

export async function getTenantByOwnerEmail(db: D1Database, ownerEmail: string) {
  const result = await db.prepare('SELECT * FROM tenants WHERE owner_email = ?').bind(ownerEmail).first()
  if (!result) return null
  return mapTenantRow(result)
}

export async function getTenantBySubdomain(db: D1Database, requestedSubdomain: string) {
  const result = await db.prepare('SELECT * FROM tenants WHERE requested_subdomain = ? OR website_domain = ?').bind(requestedSubdomain, requestedSubdomain).first()
  if (!result) return null
  return mapTenantRow(result)
}

export async function listTenants(db: D1Database) {
  const result = await db.prepare('SELECT * FROM tenants ORDER BY created_at DESC').all()
  return result.results.map(mapTenantRow)
}

export async function updateTenant(db: D1Database, tenantId: string, changes: Record<string, any>) {
  const fieldMap: Record<string, string> = {
    schoolName: 'school_name',
    schoolSlug: 'school_slug',
    ownerName: 'owner_name',
    ownerEmail: 'owner_email',
    ownerPhone: 'owner_phone',
    planKey: 'plan_key',
    studentCount: 'student_count',
    requestedSubdomain: 'requested_subdomain',
    websiteDomain: 'website_domain',
    status: 'status',
    approvalStatus: 'approval_status',
    paymentStatus: 'payment_status',
    websiteStatus: 'website_status',
    setupFeeCents: 'setup_fee_cents',
    studentFeeCents: 'student_fee_cents',
    currency: 'currency',
    discountCode: 'discount_code',
    discountSnapshot: 'discount_snapshot',
    metadata: 'metadata',
    updatedAt: 'updated_at',
    approvedAt: 'approved_at',
    approvedBy: 'approved_by',
    approvalNote: 'approval_note',
    activatedAt: 'activated_at',
    suspendedAt: 'suspended_at',
  }

  const updates: string[] = []
  const values: any[] = []

  for (const [key, value] of Object.entries(changes)) {
    const column = fieldMap[key]
    if (!column) continue

    updates.push(`${column} = ?`)
    if (key === 'discountSnapshot' || key === 'metadata') {
      values.push(JSON.stringify(value ?? null))
    } else {
      values.push(value)
    }
  }

  if (!changes.updatedAt) {
    updates.push('updated_at = ?')
    values.push(new Date().toISOString())
  }

  if (!updates.length) {
    return getTenantById(db, tenantId)
  }

  values.push(tenantId)
  await db.prepare(`UPDATE tenants SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run()
  return getTenantById(db, tenantId)
}

export async function listTenantDiscountCodes(db: D1Database, includeInactive = false) {
  if (includeInactive) {
    const result = await db.prepare('SELECT * FROM tenant_discount_codes ORDER BY updated_at DESC').all()
    return result.results.map(mapDiscountCodeRow)
  }

  const now = new Date().toISOString()
  const result = await db.prepare(
    'SELECT * FROM tenant_discount_codes WHERE active = 1 AND (starts_at IS NULL OR starts_at <= ?) AND (ends_at IS NULL OR ends_at >= ?) AND (max_redemptions IS NULL OR redemption_count < max_redemptions) ORDER BY updated_at DESC'
  ).bind(now, now).all()
  return result.results.map(mapDiscountCodeRow)
}

export async function getTenantDiscountCode(db: D1Database, code: string) {
  const result = await db.prepare('SELECT * FROM tenant_discount_codes WHERE code = ?').bind(code).first()
  if (!result) return null
  return mapDiscountCodeRow(result)
}

export async function upsertTenantDiscountCode(db: D1Database, discountCode: Record<string, any>) {
  const now = new Date().toISOString()
  await db.prepare(
    'INSERT INTO tenant_discount_codes(code, name, description, active, setup_fee_cents, student_fee_cents, plan_scope, starts_at, ends_at, max_redemptions, redemption_count, created_by, metadata, created_at, updated_at) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(code) DO UPDATE SET name = excluded.name, description = excluded.description, active = excluded.active, setup_fee_cents = excluded.setup_fee_cents, student_fee_cents = excluded.student_fee_cents, plan_scope = excluded.plan_scope, starts_at = excluded.starts_at, ends_at = excluded.ends_at, max_redemptions = excluded.max_redemptions, created_by = excluded.created_by, metadata = excluded.metadata, updated_at = excluded.updated_at'
  ).bind(
    discountCode.code,
    discountCode.name || discountCode.code,
    discountCode.description || null,
    discountCode.active ? 1 : 0,
    typeof discountCode.setupFeeCents === 'number' ? discountCode.setupFeeCents : null,
    typeof discountCode.studentFeeCents === 'number' ? discountCode.studentFeeCents : null,
    discountCode.planScope || null,
    discountCode.startsAt || null,
    discountCode.endsAt || null,
    typeof discountCode.maxRedemptions === 'number' ? discountCode.maxRedemptions : null,
    typeof discountCode.redemptionCount === 'number' ? discountCode.redemptionCount : 0,
    discountCode.createdBy || null,
    JSON.stringify(discountCode.metadata || {}),
    discountCode.createdAt || now,
    now,
  ).run()

  return getTenantDiscountCode(db, discountCode.code)
}

export async function incrementTenantDiscountCodeRedemption(db: D1Database, code: string) {
  await db.prepare('UPDATE tenant_discount_codes SET redemption_count = redemption_count + 1, updated_at = ? WHERE code = ?').bind(new Date().toISOString(), code).run()
  return getTenantDiscountCode(db, code)
}

export async function createTenantPayment(db: D1Database, payment: Record<string, any>) {
  const now = new Date().toISOString()
  await db.prepare(
    'INSERT INTO tenant_payments(id, tenant_id, initiated_by, initiated_role, tx_ref, flutterwave_link, flutterwave_tx_id, amount_cents, currency, status, plan_key, student_count, discount_code, provider_response, created_at, updated_at, paid_at) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(
    payment.id,
    payment.tenantId,
    payment.initiatedBy || null,
    payment.initiatedRole || null,
    payment.txRef,
    payment.flutterwaveLink || null,
    payment.flutterwaveTxId || null,
    payment.amountCents,
    payment.currency || 'NGN',
    payment.status || 'pending',
    payment.planKey,
    payment.studentCount || 0,
    payment.discountCode || null,
    JSON.stringify(payment.providerResponse || null),
    payment.createdAt || now,
    payment.updatedAt || now,
    payment.paidAt || null,
  ).run()

  return getTenantPaymentByTxRef(db, payment.txRef)
}

export async function getTenantPaymentByTxRef(db: D1Database, txRef: string) {
  const result = await db.prepare('SELECT * FROM tenant_payments WHERE tx_ref = ?').bind(txRef).first()
  if (!result) return null
  return mapTenantPaymentRow(result)
}

export async function listTenantPayments(db: D1Database, tenantId?: string) {
  if (tenantId) {
    const result = await db.prepare('SELECT * FROM tenant_payments WHERE tenant_id = ? ORDER BY created_at DESC').bind(tenantId).all()
    return result.results.map(mapTenantPaymentRow)
  }

  const result = await db.prepare('SELECT * FROM tenant_payments ORDER BY created_at DESC').all()
  return result.results.map(mapTenantPaymentRow)
}

export async function updateTenantPayment(db: D1Database, txRef: string, changes: Record<string, any>) {
  const fieldMap: Record<string, string> = {
    initiatedBy: 'initiated_by',
    initiatedRole: 'initiated_role',
    flutterwaveLink: 'flutterwave_link',
    flutterwaveTxId: 'flutterwave_tx_id',
    amountCents: 'amount_cents',
    currency: 'currency',
    status: 'status',
    planKey: 'plan_key',
    studentCount: 'student_count',
    discountCode: 'discount_code',
    providerResponse: 'provider_response',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    paidAt: 'paid_at',
  }

  const updates: string[] = []
  const values: any[] = []

  for (const [key, value] of Object.entries(changes)) {
    const column = fieldMap[key]
    if (!column) continue

    updates.push(`${column} = ?`)
    if (key === 'providerResponse') {
      values.push(JSON.stringify(value ?? null))
    } else {
      values.push(value)
    }
  }

  if (!changes.updatedAt) {
    updates.push('updated_at = ?')
    values.push(new Date().toISOString())
  }

  if (!updates.length) {
    return getTenantPaymentByTxRef(db, txRef)
  }

  values.push(txRef)
  await db.prepare(`UPDATE tenant_payments SET ${updates.join(', ')} WHERE tx_ref = ?`).bind(...values).run()
  return getTenantPaymentByTxRef(db, txRef)
}