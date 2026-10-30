// Smart Setup Centre (docs/premium-upgrade-implementation-plan.md §4).
//
// One answer to "is this school fully set up, and ready for the new term or session?",
// worked out on the server from the school's own records — never from a box someone ticked.
// Every area gets one of six statuses with the reason and real counts:
//
//   complete · incomplete · blocked (waits on an earlier step) · not_started ·
//   not_applicable · unable_to_verify (the check itself failed; nothing is assumed)
//
// Progress (how much is done) and critical readiness (can the school run on Ndovera today)
// are reported separately. Each area names the page that fixes it; the screen shows the
// button only to roles allowed to open that page, and checks again on return.

import { ensureClassStandardLevel, levelOf } from './levels'

export type SetupStatus = 'complete' | 'incomplete' | 'blocked' | 'not_started' | 'not_applicable' | 'unable_to_verify'
export type SetupArea = {
  key: string
  title: string
  critical: boolean
  status: SetupStatus
  summary: string
  problems: string[]
  fix: string
  counts?: Record<string, number>
}

const NAMES_SHOWN = 8
const sectionNames: Record<string, string> = { nursery: 'Nursery', primary: 'Primary', junior: 'Junior Secondary', senior: 'Senior Secondary' }

/** A read that treats a table never created as empty (nothing has been set up there yet). */
async function rows(db: D1Database, sql: string, ...binds: unknown[]) {
  try {
    return ((await db.prepare(sql).bind(...binds).all()).results || []) as Record<string, any>[]
  } catch (error) {
    // Only a table that was never created means "nothing set up yet"; any other failure is reported.
    if (/no such table/i.test(String((error as Error)?.message || error))) return []
    throw error
  }
}
async function one(db: D1Database, sql: string, ...binds: unknown[]) {
  return (await rows(db, sql, ...binds))[0] || null
}
const n = (value: unknown) => Number(value || 0)
const listed = (names: string[]) => names.slice(0, NAMES_SHOWN).join(', ') + (names.length > NAMES_SHOWN ? ` and ${names.length - NAMES_SHOWN} more` : '')
const plural = (count: number, word: string, many = `${word}s`) => `${count} ${count === 1 ? word : many}`
const className = (row: Record<string, any>) => `${row.name || 'Class'}${row.arm ? ` ${row.arm}` : ''}`

function area(key: string, title: string, critical: boolean, fix: string, status: SetupStatus, summary: string, problems: string[] = [], counts?: Record<string, number>): SetupArea {
  return { key, title, critical, status, summary, problems, fix, ...(counts ? { counts } : {}) }
}

type Facts = {
  today: string
  tenant: Record<string, any> | null
  session: Record<string, any> | null
  term: Record<string, any> | null
  classes: Record<string, any>[]
  subjects: Record<string, any>[]
  students: Record<string, any>[]
  staffCount: number
}

async function loadFacts(db: D1Database, tenantId: string, now: Date): Promise<Facts> {
  const today = new Date(now.getTime() + 3600_000).toISOString().slice(0, 10)
  await ensureClassStandardLevel(db).catch(() => null)
  const [tenant, session, classes, subjects, students, staff] = await Promise.all([
    one(db, `SELECT * FROM tenants WHERE id = ?`, tenantId),
    one(db, `SELECT * FROM academic_sessions WHERE tenant_id = ? AND status = 'active' ORDER BY start_date DESC LIMIT 1`, tenantId),
    rows(db, `SELECT id, name, arm, classTeacherId, standard_level FROM classes WHERE tenantId = ? ORDER BY name COLLATE NOCASE, arm LIMIT 400`, tenantId),
    rows(db, `SELECT id, name, classId, teacherId FROM subjects WHERE tenantId = ? LIMIT 4000`, tenantId),
    rows(db, `SELECT id, email, name FROM users WHERE tenantId = ? AND lower(COALESCE(role, '')) = 'student' AND COALESCE(status, 'active') NOT IN ('inactive', 'left', 'graduated') LIMIT 5000`, tenantId),
    one(db, `SELECT COUNT(*) AS n FROM users WHERE tenantId = ? AND lower(COALESCE(role, '')) NOT IN ('student', 'parent', '') AND COALESCE(status, 'active') != 'inactive'`, tenantId),
  ])
  const term = session ? await one(db, `SELECT * FROM academic_terms WHERE tenant_id = ? AND session_id = ? AND status = 'active' ORDER BY sequence LIMIT 1`, tenantId, session.id) : null
  return { today, tenant, session, term, classes, subjects, students, staffCount: n(staff?.n) }
}

// ─── The areas, in the order a school sets up ────────────────────────────────

async function checkBranding(db: D1Database, tenantId: string, facts: Facts) {
  const branding = await one(db, `SELECT logo_url FROM tenant_branding WHERE tenant_id = ?`, tenantId)
  const letterhead = await one(db, `SELECT 1 AS found FROM exam_letterheads WHERE tenant_id = ?`, tenantId)
  const problems: string[] = []
  const name = String(facts.tenant?.school_name || '').trim()
  if (!name) problems.push('The school has no name on record.')
  if (!String(branding?.logo_url || '').trim()) problems.push('No school logo is uploaded (it shows on report cards, receipts and payslips).')
  if (!letterhead) problems.push('The exam letterhead has not been set (optional; printed exam papers use it).')
  const essential = problems.filter(problem => !problem.includes('optional'))
  if (!name && !branding) return area('branding', 'School branding', false, 'branding', 'not_started', 'Add the school name and logo.', problems)
  return area('branding', 'School branding', false, 'branding', essential.length ? 'incomplete' : 'complete', essential.length ? 'Name or logo missing.' : `${name}, with its logo.`, problems)
}

async function checkSession(_db: D1Database, _tenantId: string, facts: Facts) {
  if (!facts.session) return area('session', 'Session and current term', true, 'sessions', 'not_started', 'No running academic session. Create the session and its terms, then start it.')
  const problems: string[] = []
  if (facts.today < String(facts.session.start_date) || facts.today > String(facts.session.end_date)) problems.push(`Today is outside the running session's dates (${facts.session.start_date} to ${facts.session.end_date}).`)
  if (!facts.term) problems.push(`No term is running in ${facts.session.name}.`)
  else if (facts.today > String(facts.term.end_date)) problems.push(`${facts.term.name} ended on ${facts.term.end_date} but is still marked as running.`)
  return area('session', 'Session and current term', true, 'sessions', problems.length ? 'incomplete' : 'complete',
    problems.length ? 'The running session or term needs attention.' : `${facts.session.name}, ${facts.term!.name} (${facts.term!.start_date} to ${facts.term!.end_date}).`, problems)
}

async function checkTermsCalendar(db: D1Database, tenantId: string, facts: Facts) {
  if (!facts.session || !facts.term) return area('calendar', 'Terms calendar', false, 'calendar', 'blocked', 'Waits for a running session and term.')
  const [terms, breaks, events, published] = await Promise.all([
    rows(db, `SELECT id, name, sequence, start_date, end_date, resumption_date FROM academic_terms WHERE tenant_id = ? AND session_id = ? ORDER BY sequence`, tenantId, facts.session.id),
    one(db, `SELECT COUNT(*) AS n FROM academic_breaks WHERE tenant_id = ? AND session_id = ?`, tenantId, facts.session.id),
    one(db, `SELECT COUNT(*) AS n FROM school_calendar_events WHERE tenant_id = ? AND start_date BETWEEN ? AND ?`, tenantId, facts.term.start_date, facts.term.end_date),
    one(db, `SELECT status FROM terms_calendar_versions WHERE tenant_id = ? AND session_id = ? AND status = 'published' ORDER BY version DESC LIMIT 1`, tenantId, facts.session.id),
  ])
  const problems: string[] = []
  const next = terms.find(term => n(term.sequence) > n(facts.term!.sequence))
  if (!next) problems.push(`No term after ${facts.term.name} is set in ${facts.session.name} (or the next session has not been created).`)
  for (const term of terms) if (!term.resumption_date && n(term.sequence) > 1) problems.push(`${term.name} has no resumption date.`)
  if (!n(breaks?.n)) problems.push('No holidays or mid-term breaks are recorded for this session.')
  if (!n(events?.n)) problems.push(`No events (tests, exams, open day, closing) are on the calendar for ${facts.term.name}.`)
  if (!published) problems.push('The terms calendar for this session has not been approved and published.')
  return area('calendar', 'Terms calendar', false, 'calendar', problems.length ? 'incomplete' : 'complete',
    problems.length ? 'The calendar is not complete for this session.' : 'Terms, breaks and events are set and the calendar is published.', problems,
    { terms: terms.length, breaks: n(breaks?.n), events: n(events?.n) })
}

async function checkClasses(_db: D1Database, _tenantId: string, facts: Facts) {
  if (!facts.classes.length) return area('classes', 'Sections and classes', true, 'classes', 'not_started', 'No classes yet. Add the classes the school runs.')
  const unknown = facts.classes.filter(row => !levelOf(row.standard_level || row.name))
  const sections = new Set(facts.classes.map(row => levelOf(row.standard_level || row.name)?.section).filter(Boolean) as string[])
  const problems = unknown.length ? [`Ndovera cannot tell the section of ${plural(unknown.length, 'class', 'classes')}: ${listed(unknown.map(className))}. Set each one's level under Class Levels.`] : []
  return area('classes', 'Sections and classes', true, unknown.length ? 'classLevels' : 'classes', unknown.length ? 'incomplete' : 'complete',
    `${plural(facts.classes.length, 'class', 'classes')} in ${[...sections].map(key => sectionNames[key] || key).join(', ') || 'no known section'}.`, problems,
    { classes: facts.classes.length, sections: sections.size })
}

async function checkSubjects(_db: D1Database, _tenantId: string, facts: Facts) {
  if (!facts.classes.length) return area('subjects', 'Subjects', true, 'subjects', 'blocked', 'Waits for classes.')
  if (!facts.subjects.length) return area('subjects', 'Subjects', true, 'subjects', 'not_started', 'No subjects yet. Add each class\'s subjects.')
  const withSubjects = new Set(facts.subjects.map(row => String(row.classId)))
  const empty = facts.classes.filter(row => !withSubjects.has(String(row.id)))
  return area('subjects', 'Subjects', true, 'subjects', empty.length ? 'incomplete' : 'complete',
    empty.length ? `${plural(empty.length, 'class', 'classes')} without subjects.` : `${plural(facts.subjects.length, 'subject')} across every class.`,
    empty.length ? [`No subjects: ${listed(empty.map(className))}.`] : [], { subjects: facts.subjects.length, classesWithout: empty.length })
}

async function checkPeople(db: D1Database, tenantId: string, facts: Facts) {
  if (!facts.students.length && !facts.staffCount) return area('people', 'People', true, 'people', 'not_started', 'No staff or students yet. Add them one by one or import a list.')
  const problems: string[] = []
  if (!facts.staffCount) problems.push('No staff accounts yet.')
  if (!facts.students.length) problems.push('No students yet.')
  let unplaced: Record<string, any>[] = []
  if (facts.students.length) {
    // A student's class is on record in any of: their class pin, this session's register, or a class membership.
    const [pins, register, memberships] = await Promise.all([
      rows(db, `SELECT student_id AS id FROM student_class_pins WHERE tenant_id = ? AND COALESCE(class_id, '') != ''`, tenantId),
      facts.session ? rows(db, `SELECT student_id AS id FROM session_enrollments WHERE tenant_id = ? AND session_id = ? AND COALESCE(class_id, '') != ''`, tenantId, facts.session.id) : Promise.resolve([]),
      rows(db, `SELECT DISTINCT user_id AS id FROM class_memberships WHERE tenant_id = ? AND membership_role = 'student'`, tenantId),
    ])
    const placed = new Set([...pins, ...register, ...memberships].map(row => String(row.id).toLowerCase()))
    unplaced = facts.students.filter(student => !placed.has(String(student.id).toLowerCase()) && !placed.has(String(student.email || '').toLowerCase()))
    if (unplaced.length) problems.push(`${plural(unplaced.length, 'student')} not in any class: ${listed(unplaced.map(student => student.name || student.email))}.`)
  }
  return area('people', 'People', true, 'people', problems.length ? 'incomplete' : 'complete',
    `${plural(facts.staffCount, 'staff member')}, ${plural(facts.students.length, 'student')}.`, problems,
    { staff: facts.staffCount, students: facts.students.length, studentsWithoutClass: unplaced.length })
}

async function checkParents(db: D1Database, tenantId: string, facts: Facts) {
  if (!facts.students.length) return area('parents', 'Parent links', false, 'parents', 'blocked', 'Waits for students.')
  const links = await rows(db, `SELECT DISTINCT student_id FROM parent_student_links WHERE tenant_id = ?`, tenantId)
  const linked = new Set(links.map(row => String(row.student_id).toLowerCase()))
  const unlinked = facts.students.filter(student => !linked.has(String(student.id).toLowerCase()) && !linked.has(String(student.email || '').toLowerCase()))
  if (!links.length) return area('parents', 'Parent links', false, 'parents', 'not_started', 'No parent is linked to a child yet.', [], { unlinked: unlinked.length })
  return area('parents', 'Parent links', false, 'parents', unlinked.length ? 'incomplete' : 'complete',
    unlinked.length ? `${plural(unlinked.length, 'student')} with no parent linked.` : 'Every student has a parent linked.',
    unlinked.length ? [`No parent: ${listed(unlinked.map(student => student.name || student.email))}.`] : [], { unlinked: unlinked.length })
}

async function checkRoles(db: D1Database, tenantId: string) {
  const [noRole, owner, hos] = await Promise.all([
    rows(db, `SELECT name, email FROM users WHERE tenantId = ? AND COALESCE(trim(role), '') = '' AND COALESCE(status, 'active') != 'inactive' LIMIT 200`, tenantId),
    one(db, `SELECT 1 AS found FROM users WHERE tenantId = ? AND lower(role) = 'owner' LIMIT 1`, tenantId),
    one(db, `SELECT 1 AS found FROM users WHERE tenantId = ? AND (lower(role) = 'hos' OR id IN (SELECT user_id FROM user_roles WHERE tenant_id = ? AND role = 'hos')) LIMIT 1`, tenantId, tenantId),
  ])
  const problems: string[] = []
  if (noRole.length) problems.push(`${plural(noRole.length, 'person', 'people')} with no role (they cannot use Ndovera): ${listed(noRole.map(row => row.name || row.email))}.`)
  if (!owner) problems.push('No School Owner account is on record.')
  if (!hos) problems.push('No Head of School is appointed (optional: the Owner can run everything).')
  const blocking = problems.filter(problem => !problem.includes('optional'))
  return area('roles', 'Roles', true, 'roles', blocking.length ? 'incomplete' : 'complete', blocking.length ? 'Some people need a role.' : 'Everyone has a role.', problems, { withoutRole: noRole.length })
}

async function checkTeachers(_db: D1Database, _tenantId: string, facts: Facts) {
  if (!facts.classes.length) return area('teachers', 'Class and subject teachers', true, 'teachers', 'blocked', 'Waits for classes and subjects.')
  const noClassTeacher = facts.classes.filter(row => !String(row.classTeacherId || '').trim())
  const noSubjectTeacher = facts.subjects.filter(row => !String(row.teacherId || '').trim())
  const classNames = new Map(facts.classes.map(row => [String(row.id), className(row)]))
  const problems: string[] = []
  if (noClassTeacher.length) problems.push(`No class teacher: ${listed(noClassTeacher.map(className))}.`)
  if (noSubjectTeacher.length) problems.push(`${plural(noSubjectTeacher.length, 'subject')} with no teacher: ${listed(noSubjectTeacher.map(row => `${row.name} (${classNames.get(String(row.classId)) || 'class'})`))}.`)
  const assigned = facts.classes.length - noClassTeacher.length + facts.subjects.length - noSubjectTeacher.length
  if (!assigned) return area('teachers', 'Class and subject teachers', true, 'teachers', 'not_started', 'No teacher is assigned to a class or subject yet.', problems)
  return area('teachers', 'Class and subject teachers', true, 'teachers', problems.length ? 'incomplete' : 'complete',
    problems.length ? 'Some classes or subjects have no teacher.' : 'Every class and subject has a teacher.', problems,
    { classesWithoutTeacher: noClassTeacher.length, subjectsWithoutTeacher: noSubjectTeacher.length })
}

async function checkFees(db: D1Database, tenantId: string, facts: Facts) {
  if (!facts.term) return area('fees', 'School fees', true, 'fees', 'blocked', 'Waits for a running term.')
  const [lock, structures, legacy, payment] = await Promise.all([
    one(db, `SELECT locked FROM fee_term_locks WHERE tenant_id = ? AND term_id = ?`, tenantId, facts.term.id),
    one(db, `SELECT COUNT(*) AS n FROM fee_structures WHERE tenant_id = ? AND term_id = ? AND status = 'published'`, tenantId, facts.term.id),
    one(db, `SELECT COUNT(*) AS n FROM fees_config WHERE tenant_id = ? AND lower(trim(COALESCE(term, ''))) = lower(trim(?))`, tenantId, String(facts.term.name || '')),
    one(db, `SELECT payload FROM settings WHERE studentId = ?`, `fees_payment_details:${tenantId}`),
  ])
  let bank: Record<string, any> = {}
  try { bank = payment?.payload ? JSON.parse(payment.payload) : {} } catch {}
  const published = n(lock?.locked) === 1 || n(structures?.n) > 0 || n(legacy?.n) > 0
  const problems: string[] = []
  if (!published) problems.push(`${facts.term.name}'s fees are not published, so no student has a fee account for it.`)
  if (!String(bank.bankName || '').trim() || !String(bank.accountNumber || '').trim()) problems.push('The school\'s bank account for fees is not set (it goes on receipts and fee reminders).')
  if (!published && !bank.bankName) return area('fees', 'School fees', true, 'fees', 'not_started', `Set and publish ${facts.term.name}'s fees.`, problems)
  return area('fees', 'School fees', true, 'fees', problems.length ? 'incomplete' : 'complete', problems.length ? 'Fees are not fully set.' : `${facts.term.name}'s fees are published and the bank account is set.`, problems)
}

async function checkGrading(db: D1Database, tenantId: string, facts: Facts) {
  if (!facts.classes.length) return area('grading', 'Grading and report cards', false, 'grading', 'blocked', 'Waits for classes.')
  const [general, sections] = await Promise.all([
    one(db, `SELECT grading_scale_json FROM result_settings WHERE tenant_id = ?`, tenantId),
    rows(db, `SELECT section FROM result_settings_sections WHERE tenant_id = ?`, tenantId),
  ])
  const used = new Set(facts.classes.map(row => levelOf(row.standard_level || row.name)?.section).filter(Boolean).map(section => (section === 'junior' || section === 'senior' ? 'secondary' : section)) as string[])
  const configured = new Set(sections.map(row => String(row.section || '').toLowerCase()))
  const missing = [...used].filter(section => !configured.has(section))
  if (!general && !sections.length) return area('grading', 'Grading and report cards', false, 'grading', 'not_started', 'Ndovera\'s standard grading is in use. Confirm the school\'s grades and C.A. scores.', [])
  return area('grading', 'Grading and report cards', false, 'grading', missing.length && !general ? 'incomplete' : 'complete',
    missing.length ? `School-wide grading set; ${missing.map(section => sectionNames[section] || section).join(', ')} use${missing.length === 1 ? 's' : ''} it.` : 'Grading is set for every section in use.',
    missing.length && !general ? [`No grading for: ${missing.join(', ')}.`] : [])
}

async function checkWebsite(db: D1Database, tenantId: string) {
  const sections = await rows(db, `SELECT section_key, title, content, metadata FROM website_sections WHERE tenant_id = ?`, tenantId)
  if (!sections.length) return area('website', 'School website', false, 'website', 'not_started', 'The school website has no content yet.')
  const keys = new Set(sections.map(row => String(row.section_key)))
  const problems: string[] = []
  for (const [key, label] of [['hero', 'home banner'], ['about', 'about the school'], ['contact', 'contact details']]) if (!keys.has(key)) problems.push(`No ${label} section.`)
  return area('website', 'School website', false, 'website', problems.length ? 'incomplete' : 'complete', problems.length ? 'Some website sections are empty.' : `${plural(sections.length, 'section')} published.`, problems)
}

async function checkCommunications(db: D1Database, tenantId: string, facts: Facts) {
  const row = await one(db, `SELECT payload FROM comm_settings WHERE tenant_id = ?`, tenantId)
  let settings: Record<string, any> = {}
  try { settings = row?.payload ? JSON.parse(row.payload) : {} } catch {}
  if (!row) return area('communications', 'Parent notifications', false, 'communications', 'not_started', 'Parent notifications are off. Turn them on to send results, fee and attendance notices.')
  if (!settings.active) return area('communications', 'Parent notifications', false, 'communications', 'incomplete', 'Parent notifications are set up but switched off.', ['Switch notifications on under Parent Notifications.'])
  return area('communications', 'Parent notifications', false, 'communications', facts.students.length ? 'complete' : 'blocked', 'Parent notifications are on.')
}

async function checkAttendance(db: D1Database, tenantId: string, facts: Facts) {
  const [staffSettings, studentMarks] = await Promise.all([
    one(db, `SELECT mode FROM staff_attendance_settings WHERE tenant_id = ?`, tenantId),
    facts.term ? one(db, `SELECT COUNT(*) AS n FROM student_attendance_school WHERE tenant_id = ? AND date BETWEEN ? AND ?`, tenantId, facts.term.start_date, facts.term.end_date) : null,
  ])
  const problems: string[] = []
  if (!staffSettings) problems.push('Staff sign-in is not set up (QR, face or manual).')
  if (facts.term && !n(studentMarks?.n)) problems.push(`No student attendance has been taken in ${facts.term.name}.`)
  if (!staffSettings && !n(studentMarks?.n)) return area('attendance', 'Attendance', false, 'attendance', 'not_started', 'Neither staff sign-in nor student attendance is in use yet.', problems)
  return area('attendance', 'Attendance', false, problems[0]?.startsWith('Staff') ? 'staffAttendance' : 'attendance', problems.length ? 'incomplete' : 'complete',
    problems.length ? 'Attendance is partly set up.' : 'Staff sign-in is set and student attendance is being taken.', problems, { studentMarksThisTerm: n(studentMarks?.n) })
}

async function checkTimetable(db: D1Database, tenantId: string, facts: Facts) {
  if (!facts.classes.length) return area('timetable', 'Timetable', false, 'timetable', 'blocked', 'Waits for classes.')
  const withTimetable = new Set((await rows(db, `SELECT DISTINCT class_id FROM timetable_entries WHERE tenant_id = ?`, tenantId)).map(row => String(row.class_id)))
  const missing = facts.classes.filter(row => !withTimetable.has(String(row.id)))
  if (!withTimetable.size) return area('timetable', 'Timetable', false, 'timetable', 'not_started', 'No class has a timetable yet.')
  return area('timetable', 'Timetable', false, 'timetable', missing.length ? 'incomplete' : 'complete',
    missing.length ? `${plural(missing.length, 'class', 'classes')} without a timetable.` : 'Every class has a timetable.', missing.length ? [`No timetable: ${listed(missing.map(className))}.`] : [])
}

/** Moving to the next session: what must be in place, and what is kept. Shown from 75 days before the session ends. */
async function checkNewSession(db: D1Database, tenantId: string, facts: Facts) {
  if (!facts.session) return null
  const daysLeft = Math.round((new Date(`${facts.session.end_date}T00:00:00Z`).getTime() - new Date(`${facts.today}T00:00:00Z`).getTime()) / 86_400_000)
  const upcoming = await one(db, `SELECT * FROM academic_sessions WHERE tenant_id = ? AND status = 'upcoming' AND start_date > ? ORDER BY start_date LIMIT 1`, tenantId, facts.session.start_date)
  if (daysLeft > 75 && !upcoming) return null
  const [upcomingTerms, promotion, liveAssignments, history] = await Promise.all([
    upcoming ? rows(db, `SELECT name, start_date, end_date FROM academic_terms WHERE tenant_id = ? AND session_id = ? ORDER BY sequence`, tenantId, upcoming.id) : Promise.resolve([]),
    one(db, `SELECT COUNT(*) AS n FROM promotion_batches WHERE tenant_id = ?`, tenantId),
    one(db, `SELECT (SELECT COUNT(*) FROM classes WHERE tenantId = ? AND COALESCE(classTeacherId, '') != '') + (SELECT COUNT(*) FROM subjects WHERE tenantId = ? AND COALESCE(teacherId, '') != '') AS n`, tenantId, tenantId),
    one(db, `SELECT COUNT(*) AS n FROM result_ca_entries WHERE tenant_id = ?`, tenantId),
  ])
  const steps: SetupArea[] = []
  steps.push(upcoming
    ? area('nextSession', 'Next session created', true, 'sessions', upcomingTerms.length ? 'complete' : 'incomplete', upcomingTerms.length ? `${upcoming.name}: ${plural(upcomingTerms.length, 'term')} set.` : `${upcoming.name} has no terms yet.`, upcomingTerms.length ? [] : ['Add the new session\'s terms with their dates.'])
    : area('nextSession', 'Next session created', true, 'sessions', 'not_started', `${facts.session.name} ends in ${plural(daysLeft, 'day')}. Create the next session and its terms.`))
  steps.push(area('promotion', 'Promotion decisions', true, 'promotion', n(promotion?.n) ? 'complete' : 'not_started', n(promotion?.n) ? 'Promotion decisions are recorded.' : 'Decide who is promoted, repeats or graduates before the new session starts.'))
  steps.push(area('carryOver', 'Teachers carried into the new session', false, 'teachers', 'complete', `${plural(n(liveAssignments?.n), 'class or subject assignment')} will carry into the new session (change any after it starts). Who taught what this session is also kept on record.`))
  steps.push(area('history', 'Records kept', false, 'history', 'complete', `Every result (${n(history?.n).toLocaleString()} score entries), fee account and attendance record stays where it is; nothing is deleted when the session changes.`))
  return { session: facts.session.name, endsOn: facts.session.end_date, daysLeft, nextSession: upcoming?.name || null, steps }
}

const CHECKS: Array<[string, string, boolean, string, (db: D1Database, tenantId: string, facts: Facts) => Promise<SetupArea>]> = [
  ['branding', 'School branding', false, 'branding', checkBranding],
  ['session', 'Session and current term', true, 'sessions', checkSession],
  ['calendar', 'Terms calendar', false, 'calendar', checkTermsCalendar],
  ['classes', 'Sections and classes', true, 'classes', checkClasses],
  ['subjects', 'Subjects', true, 'subjects', checkSubjects],
  ['people', 'People', true, 'people', checkPeople],
  ['parents', 'Parent links', false, 'parents', checkParents],
  ['roles', 'Roles', true, 'roles', (db, tenantId) => checkRoles(db, tenantId)],
  ['teachers', 'Class and subject teachers', true, 'teachers', checkTeachers],
  ['fees', 'School fees', true, 'fees', checkFees],
  ['grading', 'Grading and report cards', false, 'grading', checkGrading],
  ['website', 'School website', false, 'website', (db, tenantId) => checkWebsite(db, tenantId)],
  ['communications', 'Parent notifications', false, 'communications', checkCommunications],
  ['attendance', 'Attendance', false, 'attendance', checkAttendance],
  ['timetable', 'Timetable', false, 'timetable', checkTimetable],
]

export async function checkSchoolSetup(db: D1Database, tenantId: string, options: { now?: Date } = {}) {
  const now = options.now || new Date()
  let facts: Facts
  try { facts = await loadFacts(db, tenantId, now) } catch (error) {
    console.error('Setup Centre could not read the school', error)
    return { checkedAt: now.toISOString(), areas: CHECKS.map(([key, title, critical, fix]) => area(key, title, critical, fix, 'unable_to_verify', 'Ndovera could not read the school\'s records just now. Check again shortly.')), progress: { done: 0, applicable: CHECKS.length, percent: 0 }, readiness: { ready: false, missing: [], unverified: CHECKS.filter(check => check[2]).map(check => check[1]) }, newSession: null }
  }
  const areas: SetupArea[] = []
  for (const [key, title, critical, fix, check] of CHECKS) {
    try { areas.push(await check(db, tenantId, facts)) } catch (error) {
      console.error(`Setup check ${key} failed`, error)
      areas.push(area(key, title, critical, fix, 'unable_to_verify', 'This check could not run just now. Nothing is assumed: check again shortly.'))
    }
  }
  const applicable = areas.filter(item => item.status !== 'not_applicable')
  const done = applicable.filter(item => item.status === 'complete').length
  const critical = areas.filter(item => item.critical)
  let newSession = null
  try { newSession = await checkNewSession(db, tenantId, facts) } catch (error) { console.error('New-session check failed', error) }
  return {
    checkedAt: now.toISOString(),
    areas,
    progress: { done, applicable: applicable.length, percent: applicable.length ? Math.round((done / applicable.length) * 100) : 0 },
    readiness: {
      ready: critical.every(item => item.status === 'complete'),
      missing: critical.filter(item => ['incomplete', 'blocked', 'not_started'].includes(item.status)).map(item => item.title),
      unverified: critical.filter(item => item.status === 'unable_to_verify').map(item => item.title),
    },
    newSession,
  }
}
