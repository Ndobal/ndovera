import test, { mock } from 'node:test'
import assert from 'node:assert/strict'
import { sign } from '@tsndr/cloudflare-worker-jwt'
import { D1Shim, createLegacySchema } from './d1-shim.mjs'
import * as academic from './build/academicSessions.mjs'

const SECRET = 'ca-submissions-test-secret'
let worker
let generation = 0

const PEOPLE = {
  maths: ['t-math', 'math@a.test', 'teacher', 'school-a', 'Mr Maths'],
  classTeacher: ['t-james', 'james@a.test', 'teacher', 'school-a', 'Sarah James'],
  principal: ['p-1', 'principal@a.test', 'principal', 'school-a', 'The Principal'],
  headteacher: ['ht-1', 'headteacher@a.test', 'headteacher', 'school-a', 'The Headteacher'],
  hos: ['h-1', 'hos@a.test', 'hos', 'school-a', 'Head of School'],
  owner: ['o-1', 'owner@a.test', 'owner', 'school-a', 'The Owner'],
  ada: ['s-1', 'ada@a.test', 'student', 'school-a', 'Ada', { classId: 'jss1' }],
  bola: ['s-2', 'bola@a.test', 'student', 'school-a', 'Bola', { classId: 'jss1' }],
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

async function setup() {
  worker = (await import(`./build/worker.mjs?ca=${generation++}`)).default
  academic.resetAcademicTablesCache()
  const db = new D1Shim()
  createLegacySchema(db)
  db.db.exec(`
    CREATE TABLE subjects (id TEXT PRIMARY KEY, tenantId TEXT, name TEXT, classId TEXT, teacherId TEXT, createdAt TEXT);
    CREATE TABLE tenants (id TEXT PRIMARY KEY, school_name TEXT);
    INSERT INTO tenants VALUES ('school-a', 'Genesis International School');
    INSERT INTO classes (id, tenantId, name, arm, classTeacherId) VALUES ('jss1', 'school-a', 'JSS 1', '', 't-james');
    INSERT INTO subjects VALUES ('m1', 'school-a', 'Mathematics', 'jss1', 't-math', 'x');
  `)
  for (const [id, email, role, tenant, name, extra = {}] of Object.values(PEOPLE)) {
    await db.prepare('INSERT INTO users (id, email, name, role, tenantId, status) VALUES (?, ?, ?, ?, ?, ?)').bind(id, email, name, role, tenant, 'active').run()
    await db.prepare('INSERT INTO settings (studentId, payload) VALUES (?, ?)').bind(email, JSON.stringify({ name, email, role, tenantId: tenant, schoolId: tenant, status: 'active', ...extra })).run()
  }
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

const ZOHO_ENV = { ZOHO_MAIL_ACCOUNT_ID: 'acct', ZOHO_MAIL_FROM_ADDRESS: 'no-reply@ndovera.com', ZOHO_MAIL_CLIENT_ID: 'id', ZOHO_MAIL_CLIENT_SECRET: 'secret', ZOHO_MAIL_REFRESH_TOKEN: 'refresh' }

async function call(db, person, method, path, body) {
  const [id, , role, tenantId, name] = PEOPLE[person]
  const token = await sign({ id, role, roles: [role], tenantId, name, exp: Math.floor(Date.now() / 1000) + 600 }, SECRET)
  const response = await worker.fetch(new Request(`https://ndovera.com${path}`, {
    method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
  }), { APP_DB: db, JWT_SECRET: SECRET }, { waitUntil() {}, passThroughOnException() {} })
  return { status: response.status, body: await response.json().catch(() => ({})) }
}

const scores = (rows, extra = {}) => ({ classId: 'jss1', rows: rows.map(([studentId, ca1, ca2 = 0, exam = 0]) => ({ studentId, subjectId: 'm1', caComponents: { ca1, ca2 }, examScore: exam })), ...extra })

test('a C.A. is handed in, approved by the section head and then the HOS, and locked into the result', async () => {
  const db = await setup()
  assert.equal((await call(db, 'owner', 'POST', '/api/results/settings', RESULT_SETTINGS)).status, 200)
  const rule = await call(db, 'owner', 'POST', '/api/compliance/rules', { name: 'CA 1 scores', kind: 'ca_scores', caComponent: 'ca1', appliesTo: ['secondary'], frequency: 'once', dueDate: addDays(new Date().toISOString().slice(0, 10), 7), dueTime: '16:00', approvalRequired: true })
  assert.equal(rule.status, 201, JSON.stringify(rule.body))
  assert.equal(rule.body.rule.caComponent, 'ca1')

  // Not every student has a score yet.
  await call(db, 'maths', 'POST', '/api/results/entries', scores([['s-1', 15]]))
  const early = await call(db, 'maths', 'POST', '/api/results/ca-submissions', { classId: 'jss1', subjectId: 'm1', componentKey: 'ca1' })
  assert.equal(early.status, 400)
  assert.match(early.body.error, /Bola/)
  await call(db, 'maths', 'POST', '/api/results/entries', scores([['s-1', 15], ['s-2', 12]]))
  const handedIn = await call(db, 'maths', 'POST', '/api/results/ca-submissions', { classId: 'jss1', subjectId: 'm1', componentKey: 'ca1' })
  assert.equal(handedIn.status, 201, JSON.stringify(handedIn.body))
  assert.equal(handedIn.body.submission.status, 'submitted')
  assert.equal((await call(db, 'maths', 'POST', '/api/results/ca-submissions', { classId: 'jss1', subjectId: 'm1', componentKey: 'ca1' })).status, 409)

  // Handed in: CA 1 is frozen for the teacher; CA 2 can still be entered.
  const edit = await call(db, 'maths', 'POST', '/api/results/entries', scores([['s-1', 19, 10], ['s-2', 12, 11]]))
  assert.equal(edit.status, 200, JSON.stringify(edit.body))
  assert.deepEqual([edit.body.savedRows, edit.body.locked.map(row => [row.studentId, row.reason])], [1, [['s-1', 'submitted']]])
  let sheet = await call(db, 'maths', 'GET', '/api/results/sheet?classId=jss1')
  assert.deepEqual(sheet.body.entries.map(entry => [entry.studentId, entry.caComponents.ca1, entry.caComponents.ca2]).sort(), [['s-1', 15, 0], ['s-2', 12, 11]])
  assert.equal(sheet.body.permissions.canReviewCa, false)

  // Compliance: handed in but not yet approved.
  let item = (await call(db, 'maths', 'GET', '/api/compliance/mine')).body.items.find(entry => entry.kind === 'ca_scores')
  assert.equal(item.units[0].detail, 'Handed in — awaiting approval')
  assert.equal(item.status, 'pending')

  // The section head reviews; other heads and teachers cannot.
  const principalSheet = await call(db, 'principal', 'GET', '/api/results/sheet?classId=jss1')
  assert.equal(principalSheet.status, 200, JSON.stringify(principalSheet.body))
  assert.equal(principalSheet.body.permissions.canReviewCa, true)
  assert.equal(principalSheet.body.permissions.canApproveCa, false)
  const id = principalSheet.body.caSubmissions[0].id
  assert.equal((await call(db, 'maths', 'POST', `/api/results/ca-submissions/${id}/review`, { action: 'section_approve' })).status, 403)
  assert.equal((await call(db, 'headteacher', 'POST', `/api/results/ca-submissions/${id}/review`, { action: 'section_approve' })).status, 403)
  assert.equal((await call(db, 'principal', 'POST', `/api/results/ca-submissions/${id}/review`, { action: 'approve' })).status, 409, 'final approval is the HOS\'s')
  assert.equal((await call(db, 'principal', 'POST', `/api/results/ca-submissions/${id}/review`, { action: 'section_approve' })).status, 200)
  item = (await call(db, 'maths', 'GET', '/api/compliance/mine')).body.items.find(entry => entry.kind === 'ca_scores')
  assert.deepEqual([item.status, item.units[0].detail], ['complete', 'Approved'])

  // The HOS approves: locked into the result. The HOS can still correct it — with a reason, on the record.
  assert.equal((await call(db, 'hos', 'POST', `/api/results/ca-submissions/${id}/review`, { action: 'approve' })).status, 200)
  assert.equal((await call(db, 'hos', 'POST', '/api/results/entries', scores([['s-1', 16, 0], ['s-2', 12, 11]]))).status, 409, 'a reason is required')
  const corrected = await call(db, 'hos', 'POST', '/api/results/entries', scores([['s-1', 16, 0], ['s-2', 12, 11]], { reason: 'Script re-marked' }))
  assert.equal(corrected.status, 200, JSON.stringify(corrected.body))
  assert.equal(corrected.body.overrides, 1)
  const audit = (await call(db, 'hos', 'GET', '/api/results/audit?classId=jss1')).body.logs
  assert.deepEqual([audit[0].reason, audit[0].before.caComponents.ca1, audit[0].after.caComponents.ca1], ['Script re-marked', 15, 16])
  const held = (await call(db, 'maths', 'POST', '/api/results/entries', scores([['s-1', 20, 0], ['s-2', 13, 11]]))).body.locked.map(row => [row.studentId, row.reason]).sort()
  assert.deepEqual(held, [['s-1', 'override'], ['s-2', 'approved']])

  // Sent back: the teacher can correct and hand it in again.
  assert.equal((await call(db, 'principal', 'POST', `/api/results/ca-submissions/${id}/review`, { action: 'return', note: 'x' })).status, 409, 'approved scores are reopened by the HOS')
  assert.equal((await call(db, 'hos', 'POST', `/api/results/ca-submissions/${id}/review`, { action: 'return' })).status, 409, 'say what needs correcting')
  assert.equal((await call(db, 'hos', 'POST', `/api/results/ca-submissions/${id}/review`, { action: 'return', note: 'Bola\'s CA 1 is missing a test' })).status, 200)
  assert.equal((await call(db, 'maths', 'POST', '/api/results/entries', scores([['s-1', 16, 0], ['s-2', 14, 11]]))).body.savedRows, 1)
  const again = await call(db, 'maths', 'POST', '/api/results/ca-submissions', { classId: 'jss1', subjectId: 'm1', componentKey: 'ca1' })
  assert.equal(again.status, 201)
  assert.deepEqual(again.body.submission.history.map(entry => entry.action), ['submitted', 'section_approve', 'approve', 'return', 'resubmitted'])
})

test('the morning email run: reminders to teachers with outstanding work, a Monday summary to the HOS and Owner, punctuality tips — each once', async () => {
  // A Monday, 08:30 in Lagos.
  mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-12T07:30:00Z') })
  const sentTo = []
  const realFetch = globalThis.fetch
  globalThis.fetch = async (url, init = {}) => {
    const target = String(url)
    if (target.includes('accounts.zoho.com')) return new Response(JSON.stringify({ access_token: 'token', expires_in: 3600 }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    if (target.includes('mail.zoho.com')) {
      const body = JSON.parse(String(init.body || '{}'))
      sentTo.push([body.toAddress, body.subject])
      return new Response(JSON.stringify({ status: { code: 200 } }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }
    return realFetch(url, init)
  }
  try {
    const db = await setup()
    await call(db, 'owner', 'POST', '/api/compliance/rules', { name: 'Lesson Notes', kind: 'lesson_notes', appliesTo: ['all'], frequency: 'weekly', dueWeekday: 5, dueTime: '16:00' })
    db.db.exec(`CREATE TABLE IF NOT EXISTS staff_attendance_events (id TEXT PRIMARY KEY, tenant_id TEXT, staff_id TEXT, date TEXT, action TEXT, is_late INTEGER, late_minutes INTEGER, created_at TEXT)`)
    for (const [index, date] of ['2026-10-01', '2026-10-05', '2026-10-07', '2026-10-09'].entries()) {
      db.db.prepare(`INSERT INTO staff_attendance_events (id, tenant_id, staff_id, date, action, is_late, late_minutes, created_at) VALUES (?, 'school-a', 't-james', ?, 'sign_in', 1, 25, ?)`).run(`e${index}`, date, `${date}T08:25:00Z`)
    }
    const run = async () => {
      const pending = []
      await worker.scheduled({}, { APP_DB: db, JWT_SECRET: SECRET, ...ZOHO_ENV }, { waitUntil: promise => pending.push(promise) })
      await Promise.all(pending)
    }
    await run()
    const subjects = sentTo.map(([to, subject]) => `${to}: ${subject.split(' — ')[0]}`).sort()
    assert.ok(subjects.includes('math@a.test: Outstanding submissions'), JSON.stringify(subjects))
    assert.ok(subjects.includes('hos@a.test: Weekly submission summary'))
    assert.ok(subjects.includes('owner@a.test: Weekly submission summary'))
    assert.ok(subjects.includes('james@a.test: A few tips for getting to school on time'))
    assert.ok(!subjects.some(entry => entry.startsWith('grace@')))
    const count = sentTo.length
    await run()
    assert.equal(sentTo.length, count, 'each school is emailed once a day')
  } finally {
    globalThis.fetch = realFetch
    mock.timers.reset()
  }
})
