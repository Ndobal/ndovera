import test from 'node:test'
import assert from 'node:assert/strict'
import { sign } from '@tsndr/cloudflare-worker-jwt'
import { D1Shim, createLegacySchema } from './d1-shim.mjs'
import * as academic from './build/academicSessions.mjs'

const SECRET = 'compliance-test-secret'
let worker
let generation = 0
let aiCalls = []

const PEOPLE = {
  james: ['t-james', 'james@a.test', 'teacher', 'school-a', 'Sarah James'],
  grace: ['t-grace', 'grace@a.test', 'teacher', 'school-a', 'Grace Obi'],
  principal: ['p-1', 'principal@a.test', 'principal', 'school-a', 'The Principal'],
  headteacher: ['ht-1', 'headteacher@a.test', 'headteacher', 'school-a', 'The Headteacher'],
  hos: ['h-1', 'hos@a.test', 'hos', 'school-a', 'Head of School'],
  owner: ['o-1', 'owner@a.test', 'owner', 'school-a', 'The Owner'],
}

// Dates relative to today, so the test never ages out.
const day = offset => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10)
const mondayOf = date => { const d = new Date(`${date}T00:00:00Z`); return new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * 86400000).toISOString().slice(0, 10) }
const addDays = (date, days) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10)
const termStart = mondayOf(day(-21))
const pastWeek = mondayOf(day(-14)) // a week that is over
const pastWeekNumber = Math.round((Date.parse(pastWeek) - Date.parse(termStart)) / (7 * 86400000)) + 1
const midPastWeek = addDays(pastWeek, 2)

async function setup() {
  worker = (await import(`./build/worker.mjs?compliance=${generation++}`)).default
  aiCalls = []
  academic.resetAcademicTablesCache()
  const db = new D1Shim()
  createLegacySchema(db)
  db.db.exec(`
    CREATE TABLE subjects (id TEXT PRIMARY KEY, tenantId TEXT, name TEXT, classId TEXT, teacherId TEXT, createdAt TEXT);
    CREATE TABLE tenants (id TEXT PRIMARY KEY, school_name TEXT);
    INSERT INTO tenants VALUES ('school-a', 'Genesis');
    INSERT INTO classes (id, tenantId, name, arm, classTeacherId) VALUES ('jss1', 'school-a', 'JSS 1', '', 't-james'), ('jss2', 'school-a', 'JSS 2', '', ''), ('p5', 'school-a', 'Primary 5', '', 't-grace');
    INSERT INTO subjects VALUES ('m1', 'school-a', 'Mathematics', 'jss1', 't-james', 'x'), ('m2', 'school-a', 'Mathematics', 'jss2', 't-james', 'x'),
      ('b1', 'school-a', 'Basic Science', 'jss1', 't-james', 'x'), ('b2', 'school-a', 'Basic Science', 'jss2', 't-james', 'x'),
      ('e5', 'school-a', 'English', 'p5', 't-grace', 'x');
  `)
  for (const [id, email, role, tenant, name] of Object.values(PEOPLE)) {
    await db.prepare('INSERT INTO users (id, email, name, role, tenantId, status) VALUES (?, ?, ?, ?, ?, ?)').bind(id, email, name, role, tenant, 'active').run()
    await db.prepare('INSERT INTO settings (studentId, payload) VALUES (?, ?)').bind(email, JSON.stringify({ name, email, role, tenantId: tenant, schoolId: tenant, status: 'active' })).run()
  }
  const calendar = await academic.createSession(db, {
    tenantId: 'school-a', name: '2026/2027', startDate: termStart, endDate: addDays(termStart, 300), resumptionDate: termStart,
    terms: [
      { sequence: 1, name: 'First Term', startDate: termStart, endDate: addDays(termStart, 90), resumptionDate: addDays(termStart, 100) },
      { sequence: 2, name: 'Second Term', startDate: addDays(termStart, 100), endDate: addDays(termStart, 190), resumptionDate: addDays(termStart, 200) },
      { sequence: 3, name: 'Third Term', startDate: addDays(termStart, 200), endDate: addDays(termStart, 290), resumptionDate: addDays(termStart, 300) },
    ],
  })
  await academic.activateSession(db, { tenantId: 'school-a', sessionId: calendar.session.id })
  return db
}

async function call(db, person, method, path, body) {
  const [id, , role, tenantId, name] = PEOPLE[person]
  const token = await sign({ id, role, roles: [role], tenantId, name, exp: Math.floor(Date.now() / 1000) + 600 }, SECRET)
  const env = { APP_DB: db, JWT_SECRET: SECRET, AI: { run: async (_model, input) => { aiCalls.push(input); return { response: 'Summary\nThe class covered fractions.' } } } }
  const response = await worker.fetch(new Request(`https://ndovera.com${path}`, {
    method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
  }), env, { waitUntil() {}, passThroughOnException() {} })
  return { status: response.status, body: await response.json().catch(() => ({})) }
}

const RULES = {
  lessonNotes: { name: 'Lesson Notes', kind: 'lesson_notes', appliesTo: ['secondary'], frequency: 'weekly', dueWeekday: 5, dueTime: '16:00', method: 'either', fineAmount: 1000, graceHours: 24 },
  examQuestions: { name: 'First Term Examination Questions', kind: 'exam_questions', appliesTo: ['secondary'], frequency: 'once', dueDate: day(10), dueTime: '16:00', method: 'either' },
  register: { name: 'Register', kind: 'register', appliesTo: ['all'], frequency: 'weekly', dueWeekday: 5, dueTime: '16:00', method: 'either' },
  diary: { name: 'Diary', kind: 'diary', appliesTo: ['all'], frequency: 'weekly', dueWeekday: 5, dueTime: '16:00', method: 'manual' },
  classReport: { name: 'Weekly Class Report', kind: 'class_report', appliesTo: ['all'], frequency: 'weekly', dueWeekday: 5, dueTime: '16:00', method: 'ndovera' },
}

async function createRules(db) {
  const ids = {}
  for (const [key, rule] of Object.entries(RULES)) {
    const created = await call(db, 'owner', 'POST', '/api/compliance/rules', rule)
    assert.equal(created.status, 201, JSON.stringify(created.body))
    ids[key] = created.body.rule.id
  }
  return ids
}

const itemFor = (items, ruleId) => items.find(item => item.ruleId === ruleId)

test('rules are set once by the Owner or HOS, and validated', async () => {
  const db = await setup()
  assert.equal((await call(db, 'james', 'POST', '/api/compliance/rules', RULES.diary)).status, 403)
  assert.equal((await call(db, 'principal', 'POST', '/api/compliance/rules', RULES.diary)).status, 403, 'section heads oversee, they do not configure')
  assert.equal((await call(db, 'owner', 'POST', '/api/compliance/rules', { ...RULES.examQuestions, dueDate: '' })).status, 400, 'a one-time requirement needs its deadline')
  assert.equal((await call(db, 'hos', 'POST', '/api/compliance/rules', { ...RULES.diary, dueTime: '4pm' })).status, 400)
  const ids = await createRules(db)
  const stopped = await call(db, 'owner', 'POST', `/api/compliance/rules/${ids.diary}/active`, { active: false })
  assert.equal(stopped.status, 200)
  const config = await call(db, 'owner', 'GET', '/api/compliance/config')
  assert.equal(config.body.rules.length, 5, 'the Owner still sees a stopped rule')
  assert.equal((await call(db, 'james', 'GET', '/api/compliance/config')).body.rules.length, 4)
  assert.deepEqual(config.body.permissions.scope, 'all')
  assert.deepEqual((await call(db, 'principal', 'GET', '/api/compliance/config')).body.permissions.scope, ['secondary'])
})

test('exam questions are tracked per subject and class, and a Head can submit the missing one on the teacher\'s behalf', async () => {
  const db = await setup()
  const ids = await createRules(db)
  await call(db, 'james', 'GET', '/api/teacher-submissions/mine') // creates the submissions table
  const term = await db.prepare(`SELECT id FROM academic_terms WHERE status = 'active'`).first()
  for (const [classId, subjectId] of [['jss1', 'm1'], ['jss2', 'm2'], ['jss1', 'b1']]) {
    await db.prepare(`INSERT INTO teacher_submissions (id, tenant_id, term_id, class_id, subject_id, teacher_id, type, type_label, title, status, current_version, first_submitted_at, submitted_at, created_at, updated_at)
      VALUES (?, 'school-a', ?, ?, ?, 't-james', 'exam_questions', 'Exam Questions', 'Paper', 'submitted', 1, ?, ?, ?, ?)`).bind(`sub-${classId}-${subjectId}`, term.id, classId, subjectId, new Date().toISOString(), new Date().toISOString(), new Date().toISOString(), new Date().toISOString()).run()
  }
  const mine = await call(db, 'james', 'GET', '/api/compliance/mine')
  assert.equal(mine.status, 200, JSON.stringify(mine.body))
  const exam = itemFor(mine.body.items, ids.examQuestions)
  assert.deepEqual([exam.done, exam.total, exam.status], [3, 4, 'pending'])
  assert.deepEqual(exam.missing, ['Basic Science — JSS 2'])
  assert.ok(exam.units.every(unit => unit.done ? unit.source === 'auto' : true))

  const unitKey = exam.units.find(unit => !unit.done).key
  const target = { ruleId: ids.examQuestions, periodKey: exam.periodKey, teacherId: 't-james', unitKey }
  assert.equal((await call(db, 'principal', 'POST', '/api/compliance/verify', { ...target, onBehalf: true })).status, 400, 'on-behalf needs the work attached')
  assert.equal((await call(db, 'headteacher', 'POST', '/api/compliance/verify', { ...target, onBehalf: true, files: [{ name: 'paper.pdf', url: 'https://ndovera.com/files/x/paper.pdf' }] })).status, 403, 'the primary head does not oversee a secondary teacher')
  const onBehalf = await call(db, 'principal', 'POST', '/api/compliance/verify', { ...target, onBehalf: true, files: [{ name: 'paper.pdf', url: 'https://ndovera.com/files/x/paper.pdf' }] })
  assert.equal(onBehalf.status, 200, JSON.stringify(onBehalf.body))
  const after = itemFor((await call(db, 'james', 'GET', '/api/compliance/mine')).body.items, ids.examQuestions)
  assert.deepEqual([after.done, after.status], [4, 'complete'])
  const unit = after.units.find(item => item.key === unitKey)
  assert.equal(unit.detail, "Submitted by The Principal on the teacher's behalf")
  const audit = (await call(db, 'principal', 'GET', '/api/compliance/audit?teacherId=t-james')).body.audit
  assert.equal(audit[0].action, 'submitted_on_behalf')
  assert.equal(audit[0].actorName, 'The Principal')
})

test('partial lesson notes stay partial, a penalty is proposed but never charged, and only the Owner/HOS decide it', async () => {
  const db = await setup()
  const ids = await createRules(db)
  // One of four lesson notes, for the past week, handed in today: late and incomplete.
  const note = await call(db, 'james', 'POST', '/api/teacher-submissions', { classId: 'jss1', subjectId: 'm1', type: 'lesson_note', weekNumber: pastWeekNumber, content: 'Fractions' })
  assert.equal(note.status, 201, JSON.stringify(note.body))
  const view = await call(db, 'principal', 'GET', `/api/compliance/teachers/t-james?date=${midPastWeek}`)
  assert.equal(view.status, 200, JSON.stringify(view.body))
  const lessons = itemFor(view.body.items, ids.lessonNotes)
  assert.deepEqual([lessons.done, lessons.total, lessons.status], [1, 4, 'partial'])
  assert.deepEqual(lessons.missing, ['Basic Science — JSS 1', 'Basic Science — JSS 2', 'Mathematics — JSS 2'])
  assert.deepEqual(lessons.fine, { proposed: 1000, decision: null, amount: 1000, reason: '' })

  // The Heads' matrix, scoped by section.
  const overview = await call(db, 'principal', 'GET', `/api/compliance/overview?date=${midPastWeek}`)
  assert.equal(overview.status, 200, JSON.stringify(overview.body))
  assert.deepEqual(overview.body.rows.map(row => row.teacher.name), ['Sarah James'])
  assert.equal(overview.body.summary.proposedPenalties, 1000)
  assert.equal(overview.body.weekLabel, `Week ${pastWeekNumber}`)
  assert.deepEqual((await call(db, 'headteacher', 'GET', `/api/compliance/overview?date=${midPastWeek}`)).body.rows.map(row => row.teacher.name), ['Grace Obi'])
  assert.equal((await call(db, 'hos', 'GET', `/api/compliance/overview?date=${midPastWeek}`)).body.rows.length, 2)
  assert.equal((await call(db, 'james', 'GET', '/api/compliance/overview')).status, 403)
  assert.equal((await call(db, 'grace', 'GET', '/api/compliance/teachers/t-james')).status, 403)

  const fine = { ruleId: ids.lessonNotes, periodKey: lessons.periodKey, teacherId: 't-james' }
  assert.equal((await call(db, 'principal', 'POST', '/api/compliance/fines', { ...fine, decision: 'approved' })).status, 403)
  assert.equal((await call(db, 'owner', 'POST', '/api/compliance/fines', { ...fine, decision: 'waived' })).status, 400, 'a waiver needs a reason')
  const waived = await call(db, 'owner', 'POST', '/api/compliance/fines', { ...fine, decision: 'waived', reason: 'Was on approved leave' })
  assert.equal(waived.status, 200, JSON.stringify(waived.body))
  const later = await call(db, 'hos', 'GET', `/api/compliance/overview?date=${midPastWeek}&section=secondary`)
  assert.equal(later.body.summary.proposedPenalties, 0)
  const audit = (await call(db, 'owner', 'GET', '/api/compliance/audit?teacherId=t-james')).body.audit
  assert.deepEqual([audit[0].action, audit[0].reason, audit[0].before.amount, audit[0].after.amount], ['fine_waived', 'Was on approved leave', 1000, 0])
})

test('the register completes itself from attendance, and a Head verifies the diary', async () => {
  const db = await setup()
  const ids = await createRules(db)
  await call(db, 'grace', 'GET', `/api/compliance/mine?date=${midPastWeek}`)
  for (let offset = 0; offset < 5; offset += 1) {
    const date = addDays(pastWeek, offset)
    await db.prepare(`INSERT INTO student_attendance_school (id, tenant_id, student_id, class_id, date, status, recorded_by, created_at, updated_at) VALUES (?, 'school-a', 's-1', 'p5', ?, 'present', 't-grace', ?, ?)`)
      .bind(`att-${offset}`, date, `${date}T08:00:00Z`, `${date}T08:00:00Z`).run()
  }
  let items = (await call(db, 'grace', 'GET', `/api/compliance/mine?date=${midPastWeek}`)).body.items
  const register = itemFor(items, ids.register)
  assert.deepEqual([register.status, register.verification, register.units[0].detail], ['complete', 'auto', '5/5 days marked'])
  assert.equal(itemFor(items, ids.diary).status, 'missing')

  const diary = itemFor(items, ids.diary)
  const target = { ruleId: ids.diary, periodKey: diary.periodKey, teacherId: 't-grace', unitKey: 'all' }
  assert.equal((await call(db, 'grace', 'POST', '/api/compliance/verify', target)).status, 403, 'teachers cannot mark their own work')
  assert.equal((await call(db, 'headteacher', 'POST', '/api/compliance/verify', { ...target, note: 'Seen in the staff room' })).status, 200)
  items = (await call(db, 'grace', 'GET', `/api/compliance/mine?date=${midPastWeek}`)).body.items
  const verified = itemFor(items, ids.diary)
  assert.deepEqual([verified.verification, verified.units[0].detail], ['manual', 'Verified by The Headteacher'])
  assert.equal(verified.status, 'late', 'confirmed after the deadline')

  // Withdrawing the confirmation is recorded too.
  await call(db, 'headteacher', 'POST', '/api/compliance/verify', { ...target, revoke: true, note: 'Wrong week' })
  assert.equal(itemFor((await call(db, 'grace', 'GET', `/api/compliance/mine?date=${midPastWeek}`)).body.items, ids.diary).status, 'missing')
  const audit = (await call(db, 'hos', 'GET', '/api/compliance/audit?teacherId=t-grace')).body.audit
  assert.deepEqual(audit.slice(0, 2).map(entry => entry.action), ['verification_withdrawn', 'marked_submitted'])
})

test('the weekly class report: the school\'s questions, the teacher\'s answers, an AI write-up the teacher can edit, and both kept for the Heads', async () => {
  const db = await setup()
  const ids = await createRules(db)
  assert.equal((await call(db, 'grace', 'PUT', '/api/compliance/class-report-template', { questions: [] })).status, 403)
  assert.equal((await call(db, 'hos', 'PUT', '/api/compliance/class-report-template', { questions: [] })).status, 400)
  const saved = await call(db, 'hos', 'PUT', '/api/compliance/class-report-template', { questions: [
    { label: 'Topics covered', type: 'long', required: true },
    { label: 'Pupils who are struggling', type: 'students' },
    { label: 'Homework checked?', type: 'yesno' },
  ] })
  assert.equal(saved.status, 200)
  const [topics, struggling] = saved.body.questions

  assert.equal((await call(db, 'james', 'GET', '/api/compliance/class-report?classId=p5')).body.classId, 'jss1', 'only their own class')
  const opened = await call(db, 'grace', 'GET', '/api/compliance/class-report')
  assert.equal(opened.status, 200, JSON.stringify(opened.body))
  assert.equal(opened.body.questions.length, 3)
  assert.equal(opened.body.report, null)
  let report = (await call(db, 'grace', 'PUT', '/api/compliance/class-report', { classId: 'p5', answers: { [struggling.id]: ['s-9'] } })).body.report
  assert.equal(report.status, 'draft')
  assert.equal((await call(db, 'grace', 'POST', `/api/compliance/class-report/${report.id}/submit`)).status, 400, 'required question unanswered')
  report = (await call(db, 'grace', 'PUT', '/api/compliance/class-report', { classId: 'p5', answers: { [topics.id]: 'Fractions and decimals', [struggling.id]: ['s-9'] } })).body.report
  assert.equal((await call(db, 'james', 'POST', `/api/compliance/class-report/${report.id}/ai-summary`)).status, 404)
  const drafted = await call(db, 'grace', 'POST', `/api/compliance/class-report/${report.id}/ai-summary`)
  assert.equal(drafted.status, 200, JSON.stringify(drafted.body))
  assert.match(aiCalls[0].messages[0].content, /Use only what the teacher wrote/)
  assert.match(aiCalls[0].messages[1].content, /Topics covered: Fractions and decimals/)
  assert.equal(drafted.body.report.summary, drafted.body.report.aiSummary)
  const submitted = await call(db, 'grace', 'POST', `/api/compliance/class-report/${report.id}/submit`, { summary: 'Edited by the teacher: fractions went well.' })
  assert.equal(submitted.status, 200, JSON.stringify(submitted.body))
  assert.equal((await call(db, 'grace', 'PUT', '/api/compliance/class-report', { classId: 'p5', answers: { [topics.id]: 'changed' } })).status, 409)

  const mine = (await call(db, 'grace', 'GET', '/api/compliance/mine')).body.items
  assert.equal(itemFor(mine, ids.classReport).status, 'complete')
  const forHeads = await call(db, 'headteacher', 'GET', '/api/compliance/class-reports')
  assert.equal(forHeads.body.reports.length, 1)
  const kept = forHeads.body.reports[0]
  assert.deepEqual([kept.answers[topics.id], kept.summary, kept.aiSummary], ['Fractions and decimals', 'Edited by the teacher: fractions went well.', 'Summary\nThe class covered fractions.'])
  assert.equal((await call(db, 'principal', 'GET', '/api/compliance/class-reports')).body.reports.length, 0, 'a primary class is not the principal\'s')
})

test('every teacher has a permanent weekly history, and reminders reach teachers and a summary reaches the HOS', async () => {
  const db = await setup()
  await createRules(db)
  const history = (await call(db, 'james', 'GET', '/api/compliance/teachers/t-james')).body.history
  assert.ok(history.length >= 3, JSON.stringify(history))
  const week = history.find(entry => entry.label === `Week ${pastWeekNumber}`)
  assert.ok(week.required >= 3)
  assert.equal(week.onTime + week.late + week.missing + week.partial + week.pending, week.required)

  const teacherHeader = await call(db, 'james', 'GET', '/api/header/teacher')
  assert.ok(teacherHeader.body.notificationItems.some(item => item.category === 'compliance' && /overdue/.test(item.title)), JSON.stringify(teacherHeader.body.notificationItems))
  const hosHeader = await call(db, 'hos', 'GET', '/api/header/hos')
  const summary = hosHeader.body.notificationItems.find(item => item.category === 'compliance')
  assert.match(summary.detail, /\/2 teachers compliant/)
})
