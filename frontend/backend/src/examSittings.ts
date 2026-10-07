// Exam sittings: an approved examination paper on the day.
//
// When the HOS approves an exam paper they choose how it is written:
//   print          — the whole paper is printed; the teacher enters objective and theory marks;
//   cbt            — the whole paper is written on the computer; objectives mark themselves,
//                    the teacher marks the typed theory answers;
//   cbt_objective  — objectives on the computer, theory printed and written on paper;
//                    the teacher enters only the theory marks.
// and, for CBT, when it opens and closes and how long each student has.
//
// The CBT part is a classroom assignment the student never sees in the
// classroom: it appears on their Exams page only while the window is open, and
// disappears once written. When the teacher posts the scores, each student's
// exam score goes into the exam column of the CA score sheet — converted to the
// score sheet's exam maximum if the school says so — and the paper, with the
// student's answers, the correct answers and the marking guide, moves to the
// student's Assignments tab for review.

export class SittingError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

export const SITTING_MODES = ['print', 'cbt', 'cbt_objective'] as const
export type SittingMode = typeof SITTING_MODES[number]
export const MODE_LABELS: Record<SittingMode, string> = {
  print: 'Printed paper',
  cbt: 'CBT (whole paper on the computer)',
  cbt_objective: 'CBT objectives + printed theory',
}

let _ready = false
export function resetSittingCache() { _ready = false }

export async function ensureSittingTables(db: D1Database) {
  if (_ready) return
  for (const statement of [
    `CREATE TABLE IF NOT EXISTS exam_sittings (
      id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, assessment_id TEXT NOT NULL, submission_id TEXT,
      class_id TEXT NOT NULL, class_name TEXT, subject_id TEXT NOT NULL, subject_name TEXT, title TEXT NOT NULL,
      session_name TEXT, term_name TEXT, mode TEXT NOT NULL, opens_at TEXT, closes_at TEXT, duration_minutes INTEGER NOT NULL DEFAULT 0,
      unique_per_student INTEGER NOT NULL DEFAULT 0, assignment_id TEXT,
      objective_marks REAL NOT NULL DEFAULT 0, theory_marks REAL NOT NULL DEFAULT 0, paper_total REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'scheduled', teacher_id TEXT, approved_by TEXT, approved_by_name TEXT,
      posted_at TEXT, posted_by TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_exam_sittings_class ON exam_sittings(tenant_id, class_id, opens_at)`,
    `CREATE INDEX IF NOT EXISTS idx_exam_sittings_assessment ON exam_sittings(tenant_id, assessment_id)`,
    `CREATE TABLE IF NOT EXISTS exam_sitting_marks (
      sitting_id TEXT NOT NULL, student_id TEXT NOT NULL, objective REAL, theory REAL,
      updated_by TEXT, updated_at TEXT NOT NULL, PRIMARY KEY (sitting_id, student_id)
    )`,
  ]) {
    await db.prepare(statement).run()
  }
  _ready = true
}

export function mapSitting(row: Record<string, any>) {
  return {
    id: String(row.id), tenantId: String(row.tenant_id), assessmentId: String(row.assessment_id), submissionId: String(row.submission_id || ''),
    classId: String(row.class_id), className: String(row.class_name || ''), subjectId: String(row.subject_id), subjectName: String(row.subject_name || ''),
    title: String(row.title), sessionName: String(row.session_name || ''), termName: String(row.term_name || ''),
    mode: (SITTING_MODES as readonly string[]).includes(row.mode) ? row.mode as SittingMode : 'print',
    opensAt: String(row.opens_at || ''), closesAt: String(row.closes_at || ''), durationMinutes: Number(row.duration_minutes || 0),
    uniquePerStudent: Boolean(Number(row.unique_per_student)), assignmentId: String(row.assignment_id || ''),
    objectiveMarks: Number(row.objective_marks || 0), theoryMarks: Number(row.theory_marks || 0), paperTotal: Number(row.paper_total || 0),
    status: String(row.status || 'scheduled'), teacherId: String(row.teacher_id || ''), approvedByName: String(row.approved_by_name || ''),
    postedAt: String(row.posted_at || ''), createdAt: String(row.created_at), updatedAt: String(row.updated_at),
  }
}
export type Sitting = ReturnType<typeof mapSitting>

/** Where a sitting is now: waiting to open, open, closed (marking), or scores posted. */
export function sittingPhase(sitting: Pick<Sitting, 'mode' | 'opensAt' | 'closesAt' | 'status'>, now = new Date().toISOString()) {
  if (sitting.status === 'posted') return 'posted'
  if (sitting.mode === 'print') return 'marking'
  if (sitting.opensAt && now < sitting.opensAt) return 'scheduled'
  if (sitting.closesAt && now < sitting.closesAt) return 'open'
  return 'marking'
}

// ─── Scores ──────────────────────────────────────────────────────────────────

export type ScoreSettings = { examMaxScore: number, entry: 'convert' | 'raw', decimals: number }

/**
 * The exam score for the score sheet.
 * convert: (objective + theory) ÷ paper total × exam maximum — e.g. (59 + 30) ÷ 100 × 60 = 53.4.
 * raw: the marks as obtained, never above the exam maximum.
 */
export function sheetScore(objective: number | null, theory: number | null, paperTotal: number, settings: ScoreSettings) {
  const total = (Number(objective) || 0) + (Number(theory) || 0)
  const max = Math.max(1, Number(settings.examMaxScore) || 60)
  const value = settings.entry === 'raw' || !paperTotal ? total : (total / paperTotal) * max
  const factor = 10 ** Math.max(0, Math.min(2, settings.decimals))
  return { total, score: Math.max(0, Math.min(max, Math.round(value * factor) / factor)) }
}

export function scoreSettingsFrom(metadata: Record<string, any> | undefined, examMaxScore: number): ScoreSettings {
  return {
    examMaxScore,
    entry: metadata?.examScoreEntry === 'raw' ? 'raw' : 'convert',
    decimals: [0, 1, 2].includes(Number(metadata?.examScoreDecimals)) ? Number(metadata?.examScoreDecimals) : 1,
  }
}

// ─── Reading and saving ──────────────────────────────────────────────────────

export async function getSitting(db: D1Database, tenantId: string, id: string) {
  await ensureSittingTables(db)
  const row = await db.prepare(`SELECT * FROM exam_sittings WHERE tenant_id = ? AND id = ?`).bind(tenantId, id).first() as Record<string, any> | null
  return row ? mapSitting(row) : null
}

export async function getSittingForAssessment(db: D1Database, tenantId: string, assessmentId: string) {
  await ensureSittingTables(db)
  const row = await db.prepare(`SELECT * FROM exam_sittings WHERE tenant_id = ? AND assessment_id = ? ORDER BY created_at DESC LIMIT 1`).bind(tenantId, assessmentId).first() as Record<string, any> | null
  return row ? mapSitting(row) : null
}

export async function listSittings(db: D1Database, tenantId: string, filters: { classIds?: string[], classId?: string } = {}) {
  await ensureSittingTables(db)
  const rows = await db.prepare(`SELECT * FROM exam_sittings WHERE tenant_id = ? ORDER BY COALESCE(opens_at, created_at) DESC LIMIT 300`).bind(tenantId).all()
  return ((rows.results || []) as Record<string, any>[]).map(mapSitting)
    .filter(sitting => (!filters.classId || sitting.classId === filters.classId) && (!filters.classIds || filters.classIds.includes(sitting.classId)))
}

export function validateSchedule(input: Record<string, any>) {
  const mode = (SITTING_MODES as readonly string[]).includes(String(input?.mode)) ? input.mode as SittingMode : 'print'
  if (mode === 'print') return { mode, opensAt: '', closesAt: '', durationMinutes: 0, uniquePerStudent: Boolean(input?.uniquePerStudent) }
  const iso = (value: unknown) => { const date = new Date(String(value || '')); return Number.isFinite(date.getTime()) ? date.toISOString() : '' }
  const opensAt = iso(input?.opensAt)
  const closesAt = iso(input?.closesAt)
  const durationMinutes = Math.round(Number(input?.durationMinutes) || 0)
  if (!opensAt || !closesAt) throw new SittingError('Choose when the CBT opens and closes.')
  if (closesAt <= opensAt) throw new SittingError('The closing time must be after the opening time.')
  if (durationMinutes < 1 || durationMinutes > 600) throw new SittingError('Set how many minutes each student has (1–600).')
  const windowMinutes = (Date.parse(closesAt) - Date.parse(opensAt)) / 60000
  if (durationMinutes > windowMinutes) throw new SittingError(`The exam lasts ${durationMinutes} minutes but the window is only ${Math.floor(windowMinutes)} minutes long.`)
  return { mode, opensAt, closesAt, durationMinutes, uniquePerStudent: input?.uniquePerStudent !== false }
}

export async function insertSitting(db: D1Database, sitting: Omit<Sitting, 'createdAt' | 'updatedAt' | 'postedAt' | 'status'> & { approvedBy: string }) {
  await ensureSittingTables(db)
  const now = new Date().toISOString()
  await db.prepare(`INSERT INTO exam_sittings (id, tenant_id, assessment_id, submission_id, class_id, class_name, subject_id, subject_name, title, session_name, term_name, mode,
      opens_at, closes_at, duration_minutes, unique_per_student, assignment_id, objective_marks, theory_marks, paper_total, status, teacher_id, approved_by, approved_by_name, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled', ?, ?, ?, ?, ?)`).bind(
    sitting.id, sitting.tenantId, sitting.assessmentId, sitting.submissionId || null, sitting.classId, sitting.className, sitting.subjectId, sitting.subjectName, sitting.title,
    sitting.sessionName || null, sitting.termName || null, sitting.mode, sitting.opensAt || null, sitting.closesAt || null, sitting.durationMinutes, sitting.uniquePerStudent ? 1 : 0,
    sitting.assignmentId || null, sitting.objectiveMarks, sitting.theoryMarks, sitting.paperTotal, sitting.teacherId, sitting.approvedBy, sitting.approvedByName, now, now).run()
  return (await getSitting(db, sitting.tenantId, sitting.id))!
}

export async function deleteSitting(db: D1Database, sitting: Sitting) {
  await db.prepare(`DELETE FROM exam_sitting_marks WHERE sitting_id = ?`).bind(sitting.id).run()
  await db.prepare(`DELETE FROM exam_sittings WHERE id = ?`).bind(sitting.id).run()
}

export async function updateSittingSchedule(db: D1Database, sitting: Sitting, schedule: { opensAt: string, closesAt: string, durationMinutes: number }) {
  await db.prepare(`UPDATE exam_sittings SET opens_at = ?, closes_at = ?, duration_minutes = ?, updated_at = ? WHERE id = ?`)
    .bind(schedule.opensAt, schedule.closesAt, schedule.durationMinutes, new Date().toISOString(), sitting.id).run()
  return (await getSitting(db, sitting.tenantId, sitting.id))!
}

export async function markPosted(db: D1Database, sitting: Sitting, actorId: string) {
  const now = new Date().toISOString()
  await db.prepare(`UPDATE exam_sittings SET status = 'posted', posted_at = ?, posted_by = ?, updated_at = ? WHERE id = ?`).bind(now, actorId, now, sitting.id).run()
  return (await getSitting(db, sitting.tenantId, sitting.id))!
}

export async function listMarks(db: D1Database, sittingId: string) {
  await ensureSittingTables(db)
  const rows = await db.prepare(`SELECT student_id, objective, theory, updated_at FROM exam_sitting_marks WHERE sitting_id = ?`).bind(sittingId).all()
  return new Map(((rows.results || []) as Record<string, any>[]).map(row => [String(row.student_id), {
    objective: row.objective === null || row.objective === undefined ? null : Number(row.objective),
    theory: row.theory === null || row.theory === undefined ? null : Number(row.theory),
    updatedAt: String(row.updated_at || ''),
  }]))
}

/** Save the teacher's marks. In CBT the computer's objective score stands; only print papers take a typed objective mark. */
export async function saveMarks(db: D1Database, sitting: Sitting, rows: Array<Record<string, any>>, allowedStudents: Set<string>, actorId: string) {
  await ensureSittingTables(db)
  const existing = await listMarks(db, sitting.id)
  const now = new Date().toISOString()
  const mark = (value: unknown, max: number, label: string, student: string) => {
    if (value === null || value === undefined || value === '') return null
    const number = Number(value)
    if (!Number.isFinite(number) || number < 0) throw new SittingError(`${label} for ${student} must be a number.`)
    if (number > max) throw new SittingError(`${label} for ${student} is ${number}, but the most it can be is ${max}.`)
    return Math.round(number * 100) / 100
  }
  let saved = 0
  for (const row of rows.slice(0, 400)) {
    const studentId = String(row?.studentId || '')
    if (!allowedStudents.has(studentId)) continue
    const before = existing.get(studentId)
    const objective = sitting.mode === 'print' ? mark(row.objective, sitting.objectiveMarks, 'The objective mark', String(row.studentName || studentId)) : (before?.objective ?? null)
    const theory = mark(row.theory, sitting.theoryMarks, 'The theory mark', String(row.studentName || studentId))
    await db.prepare(`INSERT OR REPLACE INTO exam_sitting_marks (sitting_id, student_id, objective, theory, updated_by, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .bind(sitting.id, studentId, objective, theory, actorId, now).run()
    saved += 1
  }
  return saved
}
