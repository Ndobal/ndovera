import test from 'node:test'
import assert from 'node:assert/strict'
import { sign } from '@tsndr/cloudflare-worker-jwt'
import { D1Shim, createLegacySchema } from './d1-shim.mjs'
import * as academic from './build/academicSessions.mjs'

// Score sheets: subject teachers submit each subject to the class teacher, who can
// correct it and hands the whole class in once — now or at a scheduled time — and
// only when every student has every score. Late students can still be scored.
// Combined subjects put one subject's students from several classes on one sheet.

const SECRET = 'class-handin-test-secret'
let worker
let generation = 0

const PEOPLE = {
  maths: ['t-math', 'math@a.test', 'teacher', 'school-a', 'Mr Maths'],
  english: ['t-eng', 'eng@a.test', 'teacher', 'school-a', 'Mrs English'],
  classTeacher: ['t-james', 'james@a.test', 'teacher', 'school-a', 'Sarah James'],
  assistant: ['t-asst', 'asst@a.test', 'teacher', 'school-a', 'Assistant Teacher'],
  fashion: ['t-fash', 'fash@a.test', 'teacher', 'school-a', 'Mrs Fashion'],
  ict: ['i-1', 'ict@a.test', 'ict', 'school-a', 'ICT Officer'],
  hos: ['h-1', 'hos@a.test', 'hos', 'school-a', 'Head of School'],
  owner: ['o-1', 'owner@a.test', 'owner', 'school-a', 'The Owner'],
  ada: ['s-1', 'ada@a.test', 'student', 'school-a', 'Ada', { classId: 'jss1' }],
  bola: ['s-2', 'bola@a.test', 'student', 'school-a', 'Bola', { classId: 'jss1' }],
  tolu: ['s-4', 'tolu@a.test', 'student', 'school-a', 'Tolu', { classId: 'ss1a' }],
  uche: ['s-5', 'uche@a.test', 'student', 'school-a', 'Uche', { classId: 'ss1b' }],
}

const RESULT_SETTINGS = {
  templateKey: 'premium-ledger',
  gradingScale: [{ minScore: 70, grade: 'A', remark: 'Excellent' }, { minScore: 0, grade: 'F', remark: 'Fail' }],
  ratingScale: [{ value: 5, label: 'Excellent' }, { value: 1, label: 'Poor' }],
  affectiveScale: [{ value: 5, label: 'Excellent' }, { value: 1, label: 'Poor' }],
  affectiveDomains: [{ key: 'punctuality', label: 'Punctuality' }],
  metadata: { affectiveWriteUp: 'Rate each area from 1 to 5.', caMaxScore: 40, examMaxScore: 60, caComponents: [{ key: 'ca1', label: 'CA 1', maxScore: 20 }, { key: 'ca2', label: 'CA 2', maxScore: 20 }] },
}

const addDays = (date, days) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10)
const mondayOf = date => { const d = new Date(`${date}T00:00:00Z`); return addDays(date, -((d.getUTCDay() + 6) % 7)) }

async function addPerson(db, [id, email, role, tenant, name, extra = {}]) {
  await db.prepare('INSERT INTO users (id, email, name, role, tenantId, status) VALUES (?, ?, ?, ?, ?, ?)').bind(id, email, name, role, tenant, 'active').run()
  await db.prepare('INSERT INTO settings (studentId, payload) VALUES (?, ?)').bind(email, JSON.stringify({ name, email, role, tenantId: tenant, schoolId: tenant, status: 'active', ...extra })).run()
}

async function setup() {
  worker = (await import(`./build/worker.mjs?handin=${generation++}`)).default
  academic.resetAcademicTablesCache()
  const db = new D1Shim()
  createLegacySchema(db)
  db.db.exec(`
    CREATE TABLE subjects (id TEXT PRIMARY KEY, tenantId TEXT, name TEXT, classId TEXT, teacherId TEXT, createdAt TEXT);
    CREATE TABLE tenants (id TEXT PRIMARY KEY, school_name TEXT);
    INSERT INTO tenants VALUES ('school-a', 'Genesis International School');
    INSERT INTO classes (id, tenantId, name, arm, classTeacherId) VALUES ('jss1', 'school-a', 'JSS 1', '', 't-james');
    INSERT INTO classes (id, tenantId, name, arm, classTeacherId) VALUES ('ss1a', 'school-a', 'SS 1', 'A', 't-eng');
    INSERT INTO classes (id, tenantId, name, arm, classTeacherId) VALUES ('ss1b', 'school-a', 'SS 1', 'B', 't-math');
    INSERT INTO subjects VALUES ('m1', 'school-a', 'Mathematics', 'jss1', 't-math', 'x');
    INSERT INTO subjects VALUES ('e1', 'school-a', 'English', 'jss1', 't-eng', 'x');
    INSERT INTO subjects VALUES ('f1', 'school-a', 'Fashion & Design', 'ss1a', 't-fash', 'x');
    INSERT INTO subjects VALUES ('f2', 'school-a', 'Fashion and Design', 'ss1b', 't-fash', 'x');
    INSERT INTO class_memberships VALUES ('cm1', 'school-a', 'jss1', 't-asst', 'teacher', 'x', 'x');
  `)
  for (const person of Object.values(PEOPLE)) await addPerson(db, person)
  await db.prepare('INSERT INTO settings (studentId, payload) VALUES (?, ?)').bind('o-1', JSON.stringify({ name: 'The Owner', email: 'owner@a.test', role: 'owner', tenantId: 'school-a', schoolId: 'school-a', status: 'active' })).run()
  const today = new Date().toISOString().slice(0, 10)
  const termStart = mondayOf(addDays(today, -21))
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
  const response = await worker.fetch(new Request(`https://ndovera.com${path}`, {
    method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
  }), { APP_DB: db, JWT_SECRET: SECRET }, { waitUntil() {}, passThroughOnException() {} })
  return { status: response.status, body: await response.json().catch(() => ({})) }
}

const scores = (subjectId, rows, extra = {}) => ({ classId: 'jss1', rows: rows.map(([studentId, ca1, ca2 = 0, exam = 0, entered]) => ({ studentId, subjectId, caComponents: { ca1, ca2 }, examScore: exam, entered })), ...extra })

test('subjects go to the class teacher; the class is handed in once, complete; late students can still be scored', async () => {
  const db = await setup()
  assert.equal((await call(db, 'owner', 'POST', '/api/results/settings', RESULT_SETTINGS)).status, 200)

  // The subject teacher cannot submit with a student missing; an absent student is recorded as typed zeros.
  await call(db, 'maths', 'POST', '/api/results/entries', scores('m1', [['s-1', 15, 10, 50]]))
  const early = await call(db, 'maths', 'POST', '/api/results/ca-submissions', { classId: 'jss1', subjectId: 'm1' })
  assert.equal(early.status, 400)
  assert.match(early.body.error, /Bola/)
  const absent = await call(db, 'maths', 'POST', '/api/results/entries', scores('m1', [['s-1', 15, 10, 50], ['s-2', 0, 0, 0, true]]))
  assert.equal(absent.body.savedRows, 1)
  const submitted = await call(db, 'maths', 'POST', '/api/results/ca-submissions', { classId: 'jss1', subjectId: 'm1' })
  assert.equal(submitted.status, 201, JSON.stringify(submitted.body))
  assert.equal(submitted.body.submission.componentKey, 'all')

  // Submitted: the subject teacher is locked out; the class teacher sees and overwrites it.
  const blocked = await call(db, 'maths', 'POST', '/api/results/entries', scores('m1', [['s-1', 16, 10, 50]]))
  assert.deepEqual(blocked.body.locked.map(row => row.reason), ['submitted'])
  const ctSheet = await call(db, 'classTeacher', 'GET', '/api/results/sheet?classId=jss1')
  assert.equal(ctSheet.body.permissions.canHandIn, true)
  assert.equal(ctSheet.body.permissions.canSubmitSubjects, false)
  assert.equal(ctSheet.body.entries.length, 2)
  const corrected = await call(db, 'classTeacher', 'POST', '/api/results/entries', scores('m1', [['s-1', 18, 10, 50], ['s-2', 0, 0, 0]]))
  assert.deepEqual([corrected.body.savedRows, corrected.body.overrides], [1, 1])
  const mathsSheet = await call(db, 'maths', 'GET', '/api/results/sheet?classId=jss1')
  assert.deepEqual([mathsSheet.body.permissions.canHandIn, mathsSheet.body.permissions.canSubmitSubjects], [false, true])

  // Only the class teacher hands in, and not while English is missing.
  assert.equal((await call(db, 'maths', 'POST', '/api/results/batch-status', { classId: 'jss1', status: 'submitted' })).status, 403)
  const incomplete = await call(db, 'classTeacher', 'POST', '/api/results/batch-status', { classId: 'jss1', status: 'submitted' })
  assert.equal(incomplete.status, 400)
  assert.match(incomplete.body.error, /English/)
  assert.equal(incomplete.body.missing.length, 2)

  // The assistant class teacher has the class teacher's rights: enters English for the class.
  const asstSheet = await call(db, 'assistant', 'GET', '/api/results/sheet?classId=jss1')
  assert.equal(asstSheet.status, 200, JSON.stringify(asstSheet.body))
  assert.equal(asstSheet.body.permissions.canHandIn, true)
  assert.equal((await call(db, 'assistant', 'POST', '/api/results/entries', scores('e1', [['s-1', 12, 12, 40], ['s-2', 11, 9, 35]]))).body.savedRows, 2)
  const handedIn = await call(db, 'classTeacher', 'POST', '/api/results/batch-status', { classId: 'jss1', status: 'submitted' })
  assert.equal(handedIn.status, 200, JSON.stringify(handedIn.body))
  assert.equal(handedIn.body.batch.status, 'submitted')

  // ICT can see and help with the class sheet too.
  const ictSheet = await call(db, 'ict', 'GET', '/api/results/sheet?classId=jss1')
  assert.deepEqual([ictSheet.status, ictSheet.body.permissions.canManageEntries, ictSheet.body.permissions.canHandIn], [200, true, false])

  // A student joins after the hand-in: only they can be scored, and the class stays handed in.
  await new Promise(resolve => setTimeout(resolve, 5))
  await addPerson(db, ['s-3', 'chidi@a.test', 'student', 'school-a', 'Chidi', { classId: 'jss1' }])
  const late = await call(db, 'classTeacher', 'POST', '/api/results/entries', scores('m1', [['s-1', 20, 10, 50], ['s-3', 14, 14, 44]]))
  assert.equal(late.status, 200, JSON.stringify(late.body))
  assert.deepEqual([late.body.savedRows, late.body.locked.map(row => [row.studentId, row.reason])], [1, [['s-1', 'handed_in']]])
  assert.equal(late.body.batch.status, 'submitted')
  const stillMissing = await call(db, 'classTeacher', 'POST', '/api/results/batch-status', { classId: 'jss1', status: 'submitted' })
  assert.match(stillMissing.body.error, /Chidi \(English\)/)
  await call(db, 'english', 'POST', '/api/results/entries', scores('e1', [['s-3', 10, 10, 30]]))
  assert.equal((await call(db, 'classTeacher', 'POST', '/api/results/batch-status', { classId: 'jss1', status: 'submitted' })).status, 200)
})

test('the class teacher returns a subject, and a scheduled hand-in goes through when it falls due', async () => {
  const db = await setup()
  await call(db, 'owner', 'POST', '/api/results/settings', RESULT_SETTINGS)
  await call(db, 'maths', 'POST', '/api/results/entries', scores('m1', [['s-1', 15, 10, 50], ['s-2', 12, 10, 40]]))
  await call(db, 'maths', 'POST', '/api/results/ca-submissions', { classId: 'jss1', subjectId: 'm1' })
  const id = (await call(db, 'classTeacher', 'GET', '/api/results/sheet?classId=jss1')).body.caSubmissions[0].id
  assert.equal((await call(db, 'english', 'POST', `/api/results/ca-submissions/${id}/review`, { action: 'return', note: 'x' })).status, 403)
  assert.equal((await call(db, 'classTeacher', 'POST', `/api/results/ca-submissions/${id}/review`, { action: 'return', note: 'Check Bola' })).status, 200)
  assert.equal((await call(db, 'maths', 'POST', '/api/results/entries', scores('m1', [['s-1', 15, 10, 50], ['s-2', 14, 10, 40]]))).body.savedRows, 1)

  // Scheduled while English is missing: the cron clears it and says why.
  const soon = new Date(Date.now() + 5 * 60_000).toISOString()
  assert.equal((await call(db, 'maths', 'POST', '/api/results/handin-schedule', { classId: 'jss1', at: soon })).status, 403)
  assert.equal((await call(db, 'classTeacher', 'POST', '/api/results/handin-schedule', { classId: 'jss1', at: new Date(Date.now() - 1000).toISOString() })).status, 400)
  const scheduled = await call(db, 'classTeacher', 'POST', '/api/results/handin-schedule', { classId: 'jss1', at: soon })
  assert.equal(scheduled.status, 200, JSON.stringify(scheduled.body))
  assert.equal(scheduled.body.batch.scheduledHandInAt, soon)
  const runCron = async () => {
    db.db.exec(`UPDATE result_batches SET scheduled_handin_at = '2000-01-01T00:00:00.000Z' WHERE scheduled_handin_at IS NOT NULL`)
    const pending = []
    await worker.scheduled({}, { APP_DB: db, JWT_SECRET: SECRET }, { waitUntil: promise => pending.push(promise) })
    await Promise.allSettled(pending)
  }
  await runCron()
  let batch = (await call(db, 'classTeacher', 'GET', '/api/results/sheet?classId=jss1')).body.batch
  assert.deepEqual([batch.status, batch.scheduledHandInAt], ['draft', null])
  assert.match(batch.handInNote, /did not go through.*English/)

  await call(db, 'english', 'POST', '/api/results/entries', scores('e1', [['s-1', 12, 12, 40], ['s-2', 11, 9, 35]]))
  await call(db, 'classTeacher', 'POST', '/api/results/handin-schedule', { classId: 'jss1', at: soon })
  await runCron()
  batch = (await call(db, 'classTeacher', 'GET', '/api/results/sheet?classId=jss1')).body.batch
  assert.deepEqual([batch.status, batch.scheduledHandInAt, batch.handInNote], ['submitted', null, ''])
})

test('a special subject taught across classes is combined on one sheet, unless the school switches it off', async () => {
  const db = await setup()
  await call(db, 'owner', 'POST', '/api/results/settings', RESULT_SETTINGS)
  const all = await call(db, 'hos', 'GET', '/api/results/subject-groups')
  assert.equal(all.body.canManage, true)
  const group = all.body.groups.find(item => item.subjectKey === 'fashion and design')
  assert.ok(group, JSON.stringify(all.body))
  assert.deepEqual([group.enabled, group.automatic, group.section, group.classIds.sort()], [true, true, 'secondary', ['ss1a', 'ss1b']])

  const mine = await call(db, 'fashion', 'GET', '/api/results/subject-groups')
  assert.deepEqual(mine.body.groups.map(item => item.id), [group.id])
  assert.equal((await call(db, 'english', 'GET', `/api/results/group-sheet?groupId=${group.id}`)).status, 403)
  const sheet = await call(db, 'fashion', 'GET', `/api/results/group-sheet?groupId=${group.id}`)
  assert.equal(sheet.status, 200, JSON.stringify(sheet.body))
  assert.deepEqual(sheet.body.students.map(student => [student.name, student.classId]), [['Tolu', 'ss1a'], ['Uche', 'ss1b']])

  assert.equal((await call(db, 'fashion', 'POST', '/api/results/group-submit', { groupId: group.id })).status, 400)
  const saved = await call(db, 'fashion', 'POST', '/api/results/group-entries', { groupId: group.id, rows: [
    { classId: 'ss1a', studentId: 's-4', caComponents: { ca1: 15, ca2: 12 }, examScore: 50 },
    { classId: 'ss1b', studentId: 's-5', caComponents: { ca1: 11, ca2: 10 }, examScore: 41 },
    { classId: 'ss1b', studentId: 's-4', caComponents: { ca1: 20, ca2: 20 }, examScore: 60 },
  ] })
  assert.deepEqual([saved.status, saved.body.savedRows], [200, 2])
  // Each score lands in the student's own class.
  const classA = await call(db, 'english', 'GET', '/api/results/sheet?classId=ss1a')
  assert.deepEqual(classA.body.entries.map(entry => [entry.studentId, entry.subjectId, entry.caScore]), [['s-4', 'f1', 27]])
  const submit = await call(db, 'fashion', 'POST', '/api/results/group-submit', { groupId: group.id })
  assert.deepEqual(submit.body.report.map(item => item.status), ['submitted', 'submitted'])

  assert.equal((await call(db, 'fashion', 'POST', '/api/results/subject-groups', { section: 'secondary', subjectKey: 'fashion and design', enabled: false })).status, 403)
  const off = await call(db, 'ict', 'POST', '/api/results/subject-groups', { section: 'secondary', subjectKey: 'fashion and design', enabled: false }); assert.equal(off.status, 200, JSON.stringify(off.body))
  assert.equal((await call(db, 'fashion', 'GET', `/api/results/group-sheet?groupId=${group.id}`)).status, 404)
  assert.deepEqual((await call(db, 'fashion', 'GET', '/api/results/subject-groups')).body.groups, [])
})

test('each section has its own score settings; a section not yet set says it is using the school-wide ones', async () => {
  const db = await setup()
  await call(db, 'owner', 'POST', '/api/results/settings', RESULT_SETTINGS)
  const before = await call(db, 'owner', 'GET', '/api/results/settings?section=secondary')
  assert.equal(before.body.inherited, true)
  const secondary = { ...RESULT_SETTINGS, section: 'secondary', metadata: { ...RESULT_SETTINGS.metadata, caMaxScore: 30, examMaxScore: 70, caComponents: [{ key: 'ca1', label: 'Test', maxScore: 30 }] } }
  assert.equal((await call(db, 'owner', 'POST', '/api/results/settings', secondary)).status, 200)
  const after = await call(db, 'owner', 'GET', '/api/results/settings?section=secondary')
  assert.deepEqual([after.body.inherited, after.body.settings.metadata.examMaxScore], [false, 70])
  const sheet = await call(db, 'english', 'GET', '/api/results/sheet?classId=ss1a')
  assert.equal(sheet.body.settings.metadata.examMaxScore, 70)
  assert.equal((await call(db, 'owner', 'GET', '/api/results/settings?section=primary')).body.inherited, true)
})
