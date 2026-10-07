import test from 'node:test'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { sign } from '@tsndr/cloudflare-worker-jwt'
import { D1Shim, createLegacySchema } from './d1-shim.mjs'

const SECRET = 'test-secret'
let worker
let generation = 0
const PEOPLE = {
  physics: ['t-phy', 'phy@a.test', 'teacher', 'school-a', {}],
  maths: ['t-math', 'math@a.test', 'teacher', 'school-a', {}],
  classTeacher: ['t-ct', 'ct@a.test', 'teacher', 'school-a', {}],
  hos: ['h-1', 'hos@a.test', 'hos', 'school-a', {}],
  owner: ['o-1', 'owner@a.test', 'owner', 'school-a', {}],
  ada: ['s-1', 'ada@a.test', 'student', 'school-a', { classId: 'ss2a' }],
  bola: ['s-2', 'bola@a.test', 'student', 'school-a', { classId: 'ss2a' }],
}

const RESULT_SETTINGS = {
  templateKey: 'premium-ledger',
  gradingScale: [{ minScore: 70, grade: 'A', remark: 'Excellent' }, { minScore: 50, grade: 'C', remark: 'Credit' }, { minScore: 0, grade: 'F', remark: 'Fail' }],
  ratingScale: [{ value: 5, label: 'Excellent' }, { value: 1, label: 'Poor' }],
  affectiveScale: [{ value: 5, label: 'Excellent' }, { value: 1, label: 'Poor' }],
  affectiveDomains: [{ key: 'punctuality', label: 'Punctuality' }],
  metadata: { affectiveWriteUp: 'Rate each area from 1 to 5.', caMaxScore: 40, examMaxScore: 60, caComponents: [{ key: 'ca1', label: 'CA 1', maxScore: 20 }, { key: 'ca2', label: 'CA 2', maxScore: 20 }] },
}

async function setup({ withStudents = true } = {}) {
  worker = (await import(`./build/worker.mjs?practice=${generation++}`)).default
  const db = new D1Shim()
  createLegacySchema(db)
  const schema = readFileSync(new URL('../d1/schema.sql', import.meta.url), 'utf8')
  db.db.exec(schema.match(/CREATE TABLE IF NOT EXISTS tenants \([\s\S]*?\);/)[0])
  const now = new Date().toISOString()
  db.db.prepare(`INSERT INTO tenants (id, school_name, school_slug, owner_name, owner_email, plan_key, requested_subdomain, website_domain, status, approval_status, payment_status, website_status, setup_fee_cents, student_fee_cents, created_at, updated_at, activated_at)
    VALUES ('school-a', 'Genesis International School', 'genesis', 'Owner', 'o@a.test', 'standard', 'genesis', 'genesis.ndovera.com', 'active', 'approved', 'paid', 'active', 0, 0, ?, ?, ?)`).run(now, now, now)
  db.db.exec(`
    CREATE TABLE subjects (id TEXT PRIMARY KEY, tenantId TEXT, name TEXT, classId TEXT, teacherId TEXT, createdAt TEXT);
    INSERT INTO classes (id, tenantId, name, arm, classTeacherId) VALUES ('ss2a', 'school-a', 'SS 2', 'A', 't-ct');
    INSERT INTO classes (id, tenantId, name, arm, classTeacherId) VALUES ('empty', 'school-a', 'JSS 1', 'A', 't-ct');
    INSERT INTO subjects VALUES ('phy', 'school-a', 'Physics', 'ss2a', 't-phy', 'x');
    INSERT INTO subjects VALUES ('math', 'school-a', 'Mathematics', 'ss2a', 't-math', 'x');
    CREATE TABLE IF NOT EXISTS school_sessions (id TEXT PRIMARY KEY, tenantId TEXT, session TEXT, term TEXT, startDate TEXT, endDate TEXT, createdAt TEXT);
    INSERT INTO school_sessions (id, tenantId, session, term, startDate, endDate, createdAt) VALUES ('ss', 'school-a', '2026/2027', 'First Term', '', '', 'x');
  `)
  for (const [id, email, role, tenant, extra] of Object.values(PEOPLE)) {
    if (!withStudents && role === 'student') continue
    await db.prepare('INSERT INTO users (id, email, name, role, tenantId, status) VALUES (?, ?, ?, ?, ?, ?)').bind(id, email, id, role, tenant, 'active').run()
    await db.prepare('INSERT INTO settings (studentId, payload) VALUES (?, ?)').bind(email, JSON.stringify({ name: id, email, role, tenantId: tenant, schoolId: tenant, status: 'active', ...extra })).run()
  }
  // Result settings are read by the signed-in id.
  await db.prepare('INSERT INTO settings (studentId, payload) VALUES (?, ?)').bind('o-1', JSON.stringify({ name: 'o-1', email: 'owner@a.test', role: 'owner', tenantId: 'school-a', schoolId: 'school-a', status: 'active' })).run()
  return db
}

async function call(db, person, method, path, body) {
  const [id, , role, tenantId] = PEOPLE[person]
  const token = await sign({ id, role, roles: [role], tenantId, name: id, exp: Math.floor(Date.now() / 1000) + 600 }, SECRET)
  const response = await worker.fetch(new Request(`https://ndovera.com${path}`, {
    method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
  }), { APP_DB: db, JWT_SECRET: SECRET }, { waitUntil() {}, passThroughOnException() {} })
  return { status: response.status, body: await response.json().catch(() => ({})) }
}

const score = (studentId, subjectId, ca1, ca2, exam) => ({ studentId, subjectId, caComponents: { ca1, ca2 }, examScore: exam })

test('practice runs on the real engine, shows staff what students will see, and never reaches the real term', async () => {
  const db = await setup()
  assert.equal((await call(db, 'owner', 'POST', '/api/results/settings', RESULT_SETTINGS)).status, 200)

  // A subject teacher only gets their own subject to fill in, even before any score exists.
  const sheet = await call(db, 'physics', 'GET', '/api/results/sheet?classId=ss2a&mode=practice')
  assert.equal(sheet.status, 200, JSON.stringify(sheet.body))
  assert.equal(sheet.body.mode, 'practice')
  assert.equal(sheet.body.period.termName, 'Practice Term')
  assert.deepEqual(sheet.body.subjects.map(subject => [subject.id, subject.ownSubject]), [['phy', true]])
  assert.equal(sheet.body.practice.available, true)

  const saved = await call(db, 'physics', 'POST', '/api/results/entries', { classId: 'ss2a', mode: 'practice', rows: [score('s-1', 'phy', 18, 17, 50), score('s-2', 'phy', 10, 10, 20), score('s-1', 'math', 20, 20, 60)] })
  assert.equal(saved.status, 200, JSON.stringify(saved.body))
  assert.equal(saved.body.savedRows, 2, 'Mathematics is not the physics teacher\'s to fill')
  await call(db, 'maths', 'POST', '/api/results/entries', { classId: 'ss2a', mode: 'practice', rows: [score('s-1', 'math', 15, 15, 40), score('s-2', 'math', 20, 20, 50)] })

  // Teachers and the HoS see exactly what each student would get.
  for (const person of ['physics', 'classTeacher', 'hos']) {
    const preview = await call(db, person, 'GET', '/api/results/preview?classId=ss2a&mode=practice')
    assert.equal(preview.status, 200, JSON.stringify(preview.body))
    const ada = preview.body.publications.find(record => record.payload.student.id === 's-1')
    assert.equal(ada.payload.practice, true)
    assert.equal(ada.payload.preview, true)
    assert.deepEqual(ada.payload.subjects.map(row => [row.subjectName, row.caScore, row.examScore, row.total, row.grade]), [['Mathematics', 30, 40, 70, 'A'], ['Physics', 35, 50, 85, 'A']])
    assert.equal(ada.payload.summary.position, 1)
    assert.equal(ada.payload.branding.schoolName, 'Genesis International School')
  }
  assert.equal((await call(db, 'ada', 'GET', '/api/results/preview?classId=ss2a&mode=practice')).status, 403)

  // The release step can be tried too — and still nothing reaches students or the real term.
  assert.equal((await call(db, 'classTeacher', 'POST', '/api/results/batch-status', { classId: 'ss2a', mode: 'practice', status: 'submitted' })).status, 200)
  assert.equal((await call(db, 'classTeacher', 'POST', '/api/results/batch-status', { classId: 'ss2a', mode: 'practice', status: 'published' })).status, 200)
  assert.equal((await call(db, 'classTeacher', 'POST', '/api/results/batch-status', { classId: 'ss2a', status: 'published' })).status, 400, 'a real batch is only published through /publish')
  assert.equal((await call(db, 'ada', 'GET', '/api/results/records')).body.publications?.length || 0, 0)
  assert.equal((await call(db, 'physics', 'GET', '/api/results/sheet?classId=ss2a')).body.entries.length, 0)
  assert.equal((await call(db, 'owner', 'GET', '/api/results/overview')).body.batches.length, 0)
  assert.equal((await call(db, 'hos', 'POST', '/api/results/publish', { classId: 'ss2a', sessionName: '__practice__', termName: '__practice__' })).status, 400)

  // A class with no students yet still gets a sample roster and subjects to practise on.
  const empty = await call(db, 'classTeacher', 'GET', '/api/results/sheet?classId=empty&mode=practice')
  assert.equal(empty.status, 200, JSON.stringify(empty.body))
  assert.equal(empty.body.practice.sampleRoster, true)
  assert.equal(empty.body.students.length, 5)
  assert.equal(empty.body.subjects.length, 3)

  // Reset starts the class over.
  assert.equal((await call(db, 'physics', 'POST', '/api/results/practice/reset', { classId: 'ss2a' })).status, 403)
  assert.equal((await call(db, 'classTeacher', 'POST', '/api/results/practice/reset', { classId: 'ss2a' })).status, 200)
  assert.equal((await call(db, 'physics', 'GET', '/api/results/sheet?classId=ss2a&mode=practice')).body.entries.length, 0)
})

test('practice closes when the HoS activates exams and returns only after exams end and results are published', async () => {
  const db = await setup()
  await call(db, 'owner', 'POST', '/api/results/settings', RESULT_SETTINGS)
  await call(db, 'physics', 'POST', '/api/results/entries', { classId: 'ss2a', mode: 'practice', rows: [score('s-1', 'phy', 10, 10, 10)] })

  assert.equal((await call(db, 'physics', 'POST', '/api/results/exam-period', { action: 'activate' })).status, 403)
  const activated = await call(db, 'hos', 'POST', '/api/results/exam-period', { action: 'activate' })
  assert.equal(activated.status, 200, JSON.stringify(activated.body))
  assert.equal(activated.body.examPeriod.status, 'active')
  assert.equal(activated.body.practiceAvailable, false)

  const locked = await call(db, 'physics', 'GET', '/api/results/sheet?classId=ss2a&mode=practice')
  assert.equal(locked.status, 409)
  assert.equal(locked.body.practiceLocked, true)
  assert.equal((await call(db, 'physics', 'POST', '/api/results/entries', { classId: 'ss2a', mode: 'practice', rows: [score('s-1', 'phy', 1, 1, 1)] })).status, 409)
  // The real sheet keeps working, and reports the exam period.
  const live = await call(db, 'physics', 'GET', '/api/results/sheet?classId=ss2a')
  assert.equal(live.status, 200)
  assert.equal(live.body.examPeriod.status, 'active')

  // Ending exams is not enough on its own.
  assert.equal((await call(db, 'owner', 'POST', '/api/results/exam-period', { action: 'end' })).status, 200)
  assert.equal((await call(db, 'physics', 'GET', '/api/results/sheet?classId=ss2a&mode=practice')).status, 409)

  await call(db, 'physics', 'POST', '/api/results/entries', { classId: 'ss2a', rows: [score('s-1', 'phy', 15, 15, 45), score('s-2', 'phy', 12, 12, 30)] })
  assert.equal((await call(db, 'hos', 'POST', '/api/results/publish', { classId: 'ss2a' })).status, 200)
  const back = await call(db, 'physics', 'GET', '/api/results/sheet?classId=ss2a&mode=practice')
  assert.equal(back.status, 200, JSON.stringify(back.body))
  assert.equal(back.body.entries.length, 0, 'practice scores were cleared when exams began')
})

test('the class teacher overrides subject teachers and the HoS overrides everyone, each change logged and held', async () => {
  const db = await setup()
  await call(db, 'owner', 'POST', '/api/results/settings', RESULT_SETTINGS)
  await call(db, 'physics', 'POST', '/api/results/entries', { classId: 'ss2a', rows: [score('s-1', 'phy', 12, 12, 30)] })

  // Unchanged rows are not rewritten or logged; the class teacher's change to Physics is.
  const overridden = await call(db, 'classTeacher', 'POST', '/api/results/entries', { classId: 'ss2a', reason: 'Script remarked', rows: [score('s-1', 'phy', 15, 12, 30), score('s-2', 'phy', 0, 0, 0)] })
  assert.equal(overridden.status, 200, JSON.stringify(overridden.body))
  assert.deepEqual([overridden.body.savedRows, overridden.body.overrides], [1, 1])

  // The physics teacher can no longer change that row, but can still fill in others.
  const blocked = await call(db, 'physics', 'POST', '/api/results/entries', { classId: 'ss2a', rows: [score('s-1', 'phy', 20, 20, 60), score('s-2', 'phy', 10, 10, 20)] })
  assert.equal(blocked.status, 200)
  assert.equal(blocked.body.savedRows, 1)
  assert.deepEqual(blocked.body.locked.map(row => [row.studentId, row.overrideRole]), [['s-1', 'teacher']])

  // The HoS overrides the class teacher; now the class teacher is held too.
  assert.equal((await call(db, 'hos', 'POST', '/api/results/entries', { classId: 'ss2a', rows: [score('s-1', 'phy', 16, 12, 30)] })).body.overrides, 1)
  assert.equal((await call(db, 'classTeacher', 'POST', '/api/results/entries', { classId: 'ss2a', rows: [score('s-1', 'phy', 1, 1, 1)] })).body.locked.length, 1)

  const sheet = await call(db, 'physics', 'GET', '/api/results/sheet?classId=ss2a')
  const ada = sheet.body.entries.find(entry => entry.studentId === 's-1')
  assert.deepEqual([ada.caScore, ada.overrideRank, ada.overrideName], [28, 2, 'h-1'])

  const logs = (await call(db, 'physics', 'GET', '/api/results/audit?classId=ss2a')).body.logs
  assert.deepEqual(logs.map(log => [log.actorName, log.before.caScore, log.after.caScore, log.reason]), [['h-1', 27, 28, ''], ['t-ct', 24, 27, 'Script remarked']])
  assert.equal(logs[0].studentName, 's-1')
  assert.equal((await call(db, 'maths', 'GET', '/api/results/audit?classId=ss2a')).body.logs.length, 0, 'the maths teacher sees only maths changes')
})
