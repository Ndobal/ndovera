// Requests for an exam Ndovera doesn't have yet. Someone at a school names the exam, says whether it is
// for one country or for everyone, and sends the curriculum. Ami reads it and answers. Curriculum files
// are kept private under PRIVATE_PREFIX: /files/* refuses that prefix, and only Ami can download them.

export class ExamRequestError extends Error {
  status: number
  constructor(message: string, status = 400) { super(message); this.status = status }
}

export const PRIVATE_PREFIX = 'exam-requests/'
export const MAX_FILE_BYTES = 10 * 1024 * 1024
const OPEN_PER_PERSON = 5
const LIST_LIMIT = 100
export const REQUEST_STATUSES = ['new', 'reviewing', 'building', 'ready', 'declined']
const FILE_TYPES: Record<string, string> = {
  pdf: 'application/pdf', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  txt: 'text/plain', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
}
const SECTIONS = ['primary', 'junior', 'senior', 'other']
const ready = new WeakSet<object>()

export async function ensureExamRequestTables(db: D1Database) {
  if (ready.has(db as object)) return
  await db.prepare(`CREATE TABLE IF NOT EXISTS exam_requests (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, user_name TEXT, user_role TEXT, tenant_id TEXT, school_name TEXT,
    exam_name TEXT NOT NULL, scope TEXT NOT NULL, country TEXT, section TEXT, subjects TEXT, curriculum_link TEXT, curriculum_note TEXT, file_key TEXT, file_name TEXT, file_type TEXT,
    status TEXT NOT NULL DEFAULT 'new', ami_note TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, handled_by TEXT)`).run()
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_exam_requests_status ON exam_requests(status, created_at)`).run()
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_exam_requests_user ON exam_requests(user_id, created_at)`).run()
  await db.prepare(`ALTER TABLE exam_requests ADD COLUMN custom_exam TEXT`).run().catch(() => null)
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_exam_requests_exam ON exam_requests(custom_exam, status)`).run()
  ready.add(db as object)
}

const clean = (value: unknown, limit: number) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, limit)

/** The file's real type comes from its extension here, never from what the browser claims. */
export function curriculumFileType(name: string) {
  const extension = String(name).toLowerCase().split('.').pop() || ''
  const type = FILE_TYPES[extension]
  if (!type) throw new ExamRequestError('Send the curriculum as a PDF, Word document, text file or photo.')
  return type
}

export function checkCurriculumFile(file: { name: string, size: number }) {
  if (file.size > MAX_FILE_BYTES) throw new ExamRequestError('That file is over 10 MB. Send a smaller copy, or a link to it.')
  return curriculumFileType(file.name)
}

type Person = { userId: string, name: string, role: string, tenantId: string, schoolName: string }
type RequestFile = { key: string, name: string, type: string } | null

export async function createExamRequest(db: D1Database, person: Person, input: Record<string, unknown>, file: RequestFile) {
  await ensureExamRequestTables(db)
  if (!person.userId || !person.tenantId) throw new ExamRequestError('Exam requests come from people using Ndovera at a school.', 403)
  const examName = clean(input.examName, 120)
  const scope = String(input.scope || '')
  const country = clean(input.country, 80)
  const section = SECTIONS.includes(String(input.section)) ? String(input.section) : 'other'
  const link = clean(input.curriculumLink, 500)
  const note = String(input.curriculumNote ?? '').trim().slice(0, 4000)
  if (examName.length < 2) throw new ExamRequestError('Name the exam, such as KCSE or BECE Ghana.')
  if (!['country', 'global'].includes(scope)) throw new ExamRequestError('Choose whether this exam is for one country or for everyone.')
  if (scope === 'country' && !country) throw new ExamRequestError('Say which country this exam is for.')
  if (link && !/^https:\/\//i.test(link)) throw new ExamRequestError('A curriculum link must start with https://')
  if (!file && !link && note.length < 20) throw new ExamRequestError('Send the curriculum: a file, a link, or the topics typed out.')
  if (input.confirmed !== true && input.confirmed !== 'true') throw new ExamRequestError('Tick the box to confirm Ndovera may use this curriculum to write questions.')
  const open = await db.prepare(`SELECT COUNT(*) AS n FROM (SELECT 1 FROM exam_requests WHERE user_id = ? AND status IN ('new', 'reviewing', 'building') LIMIT ${OPEN_PER_PERSON})`).bind(person.userId).first() as Record<string, any> | null
  if (Number(open?.n || 0) >= OPEN_PER_PERSON) throw new ExamRequestError(`You have ${OPEN_PER_PERSON} requests waiting. Ndovera will answer those first.`, 429)
  const id = `xreq_${crypto.randomUUID()}`
  const now = new Date().toISOString()
  await db.prepare(`INSERT INTO exam_requests (id, user_id, user_name, user_role, tenant_id, school_name, exam_name, scope, country, section, subjects, curriculum_link, curriculum_note, file_key, file_name, file_type, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?)`)
    .bind(id, person.userId, person.name, person.role, person.tenantId, person.schoolName, examName, scope, scope === 'country' ? country : '', section, clean(input.subjects, 500), link, note, file?.key || null, file ? clean(file.name, 160) : null, file?.type || null, now, now).run()
  return id
}

const view = (row: Record<string, any>) => ({
  id: String(row.id), examName: String(row.exam_name), scope: String(row.scope), country: String(row.country || ''), section: String(row.section || ''), subjects: String(row.subjects || ''),
  status: String(row.status), note: String(row.ami_note || ''), createdAt: String(row.created_at), updatedAt: String(row.updated_at), fileName: String(row.file_name || ''), link: String(row.curriculum_link || ''),
})

export async function listMyExamRequests(db: D1Database, userId: string) {
  await ensureExamRequestTables(db)
  const rows = await db.prepare(`SELECT * FROM exam_requests WHERE user_id = ? ORDER BY created_at DESC LIMIT 20`).bind(userId).all()
  return ((rows.results || []) as Record<string, any>[]).map(view)
}

export async function listExamRequests(db: D1Database, status: string) {
  await ensureExamRequestTables(db)
  const chosen = REQUEST_STATUSES.includes(status) ? status : 'new'
  const rows = await db.prepare(`SELECT * FROM exam_requests WHERE status = ? ORDER BY created_at DESC LIMIT ${LIST_LIMIT}`).bind(chosen).all()
  return ((rows.results || []) as Record<string, any>[]).map(row => ({ ...view(row), customExam: String(row.custom_exam || ''), curriculumNote: String(row.curriculum_note || ''), hasFile: Boolean(row.file_key), userName: String(row.user_name || ''), userRole: String(row.user_role || ''), schoolName: String(row.school_name || '') }))
}

export async function answerExamRequest(db: D1Database, id: string, input: Record<string, unknown>, actor: string) {
  await ensureExamRequestTables(db)
  const status = String(input.status || '')
  if (!REQUEST_STATUSES.includes(status)) throw new ExamRequestError('Choose a status.')
  const done = await db.prepare(`UPDATE exam_requests SET status = ?, ami_note = ?, handled_by = ?, updated_at = ? WHERE id = ?`).bind(status, String(input.note ?? '').trim().slice(0, 1000), actor, new Date().toISOString(), id).run()
  if (!Number((done as any)?.meta?.changes || 0)) throw new ExamRequestError('Request not found.', 404)
}

export async function examRequestFile(db: D1Database, id: string) {
  await ensureExamRequestTables(db)
  const row = await db.prepare(`SELECT file_key, file_name, file_type FROM exam_requests WHERE id = ?`).bind(id).first() as Record<string, any> | null
  if (!row?.file_key) throw new ExamRequestError('This request has no file.', 404)
  return { key: String(row.file_key), name: String(row.file_name || 'curriculum'), type: String(row.file_type || 'application/octet-stream') }
}

