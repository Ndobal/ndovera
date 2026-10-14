import test from 'node:test'
import assert from 'node:assert/strict'
import { sign } from '@tsndr/cloudflare-worker-jwt'
import { D1Shim, createLegacySchema } from './d1-shim.mjs'
import { matchClass } from './build/classMatch.mjs'
import { guardStudentClass, monitorClassPins } from './build/classPins.mjs'

// Students keep their class: imports match how schools write class names and never add a
// student without one; a class changes only on record (Owner, Head of School, ICT,
// promotion); anything else keeps the class; the nightly monitor puts back unrecorded changes.

const SECRET = 'class-pins-secret'
let worker
let generation = 0
const CLASSES = [['g1', 'GRADE 1', 'PRIMARY'], ['jhs1', 'JHS 1', 'SECONDARY SCHOOL'], ['sh1a', 'SH 1', 'ARTS'], ['sh1s', 'SH 1', 'SCIENCE'], ['ps1', 'PRE-SCHOOL 1', 'PRE-SCHOOL']]
const PEOPLE = {
  owner: ['o-1', 'owner@a.test', 'owner'],
  teacher: ['t-1', 'teacher@a.test', 'teacher'],
}

async function setup() {
  worker = (await import(`./build/worker.mjs?pins=${generation++}`)).default
  const db = new D1Shim()
  createLegacySchema(db)
  for (const [id, name, arm] of CLASSES) db.db.prepare(`INSERT INTO classes (id, tenantId, name, arm) VALUES (?, 'school-a', ?, ?)`).run(id, name, arm)
  for (const [id, email, role] of Object.values(PEOPLE)) {
    await db.prepare('INSERT INTO users (id, email, name, role, tenantId, status) VALUES (?, ?, ?, ?, ?, ?)').bind(id, email, id, role, 'school-a', 'active').run()
    await db.prepare('INSERT INTO settings (studentId, payload) VALUES (?, ?)').bind(email, JSON.stringify({ name: id, email, role, roles: [role], tenantId: 'school-a', schoolId: 'school-a', status: 'active' })).run()
  }
  return db
}

async function call(db, person, method, path, body) {
  const [id, , role] = PEOPLE[person]
  const token = await sign({ id, role, roles: [role], tenantId: 'school-a', name: id, exp: Math.floor(Date.now() / 1000) + 600 }, SECRET)
  const response = await worker.fetch(new Request(`https://ndovera.com${path}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }),
    { APP_DB: db, JWT_SECRET: SECRET }, { waitUntil() {}, passThroughOnException() {} })
  return { status: response.status, body: await response.json().catch(() => ({})) }
}

const classOf = (db, email) => JSON.parse(db.db.prepare('SELECT payload FROM settings WHERE studentId = ?').get(email).payload).classId || ''
const schoolClasses = CLASSES.map(([id, name, arm]) => ({ id, name, arm }))

test('class names on import sheets match the way schools write them, and nothing ambiguous is guessed', () => {
  const pick = className => matchClass(schoolClasses, { className }).klass?.id || null
  assert.equal(pick('GRADE 1 PRIMARY'), 'g1')
  assert.equal(pick('Grade1'), 'g1')
  assert.equal(pick('Primary 1'), 'g1')
  assert.equal(pick('JSS 1'), 'jhs1')
  assert.equal(pick('jhs1'), 'jhs1')
  assert.equal(pick('SSS 1 Science'), 'sh1s')
  assert.equal(pick('SS1 Arts'), 'sh1a')
  assert.equal(pick('SS 1'), null, 'two SS 1 arms: not guessed')
  assert.match(matchClass(schoolClasses, { className: 'SS 1' }).reason, /could be SH 1 ARTS or SH 1 SCIENCE/)
  assert.equal(pick('Pre-School 1'), 'ps1')
  assert.equal(pick('Primary 9'), null)
})

test('imports never add a student without a class, and fill in the class of students already here without one', async () => {
  const db = await setup()
  const imported = await call(db, 'owner', 'POST', '/api/people/bulk', { rows: [
    { name: 'Ada', email: 'ada@a.test', role: 'student', className: 'SSS 1 Science' },
    { name: 'Bola', email: 'bola@a.test', role: 'student', className: 'SS 1' },
    { name: 'Chi', email: 'chi@a.test', role: 'student' },
  ] })
  assert.equal(imported.status, 200, JSON.stringify(imported.body))
  assert.deepEqual(imported.body.results.map(row => row.status), ['ok', 'error', 'error'])
  assert.match(imported.body.results[1].error, /could be SH 1 ARTS or SH 1 SCIENCE/)
  assert.match(imported.body.results[2].error, /needs a class/)
  assert.equal(classOf(db, 'ada@a.test'), 'sh1s')
  assert.equal(db.db.prepare(`SELECT COUNT(*) AS n FROM users WHERE email IN ('bola@a.test', 'chi@a.test')`).get().n, 0, 'not added')
  // A student already here with no class: the sheet's class places them.
  db.db.prepare(`INSERT INTO users (id, email, name, role, tenantId, status) VALUES ('s-dan', 'dan@a.test', 'Dan', 'student', 'school-a', 'active')`).run()
  db.db.prepare(`INSERT INTO settings (studentId, payload) VALUES ('dan@a.test', ?)`).run(JSON.stringify({ name: 'Dan', role: 'student', roles: ['student'], tenantId: 'school-a', status: 'active' }))
  await call(db, 'owner', 'POST', '/api/people/bulk', { rows: [{ name: 'Dan', email: 'dan@a.test', role: 'student', className: 'Grade 1' }] })
  assert.equal(classOf(db, 'dan@a.test'), 'g1')
})

test('a class changes only on record; an empty class field keeps it; a class with students cannot be deleted; the monitor puts back unrecorded changes', async () => {
  const db = await setup()
  await call(db, 'owner', 'POST', '/api/people/bulk', { rows: [{ name: 'Ada', email: 'ada@a.test', role: 'student', className: 'JHS 1' }] })
  const ada = db.db.prepare(`SELECT id FROM users WHERE email = 'ada@a.test'`).get().id
  // A profile save with an empty class field (the class list had not loaded) leaves the class.
  assert.equal((await call(db, 'owner', 'PUT', `/api/people/${ada}`, { name: 'Ada Obi', phone: '0801', classId: '' })).status, 200)
  assert.equal(classOf(db, 'ada@a.test'), 'jhs1')
  // The Owner moves her: on record.
  assert.equal((await call(db, 'owner', 'PUT', `/api/people/${ada}`, { classId: 'g1' })).status, 200)
  assert.equal(classOf(db, 'ada@a.test'), 'g1')
  assert.equal((await call(db, 'owner', 'PUT', `/api/people/${ada}`, { classId: 'nope' })).status, 404)
  // A class with students in it is not deleted.
  const del = await call(db, 'owner', 'DELETE', '/api/school/classes/g1')
  assert.equal(del.status, 409)
  assert.match(del.body.error, /still has 1 student/)
  assert.equal(classOf(db, 'ada@a.test'), 'g1')

  // Any write without a recorded change keeps the class (the guard under every settings write).
  const kept = await guardStudentClass(db, 'ada@a.test', { name: 'Ada Obi', role: 'student', roles: ['student'], tenantId: 'school-a' }, null)
  assert.equal(kept.classId, 'g1')
  const moved = await guardStudentClass(db, 'ada@a.test', { name: 'Ada', role: 'student', tenantId: 'school-a', classId: 'jhs1' }, { by: 't-1', role: 'teacher', reason: 'manual' })
  assert.equal(moved.classId, 'g1', 'a teacher cannot move a student')

  // A raw change that went around the guard: the monitor puts back the pinned class.
  db.db.prepare(`UPDATE settings SET payload = json_remove(payload, '$.classId', '$.className', '$.classArm') WHERE studentId = 'ada@a.test'`).run()
  const monitor = await monitorClassPins(db, { tenantId: 'school-a' })
  assert.deepEqual([monitor.restored, monitor.unplaced], [1, 0])
  assert.equal(classOf(db, 'ada@a.test'), 'g1')

  // Students who never had a class are counted, never placed by the monitor.
  db.db.prepare(`INSERT INTO users (id, email, name, role, tenantId, status) VALUES ('s-x', 'x@a.test', 'X', 'student', 'school-a', 'active')`).run()
  db.db.prepare(`INSERT INTO settings (studentId, payload) VALUES ('x@a.test', ?)`).run(JSON.stringify({ name: 'X', role: 'student', tenantId: 'school-a' }))
  assert.equal((await monitorClassPins(db, { tenantId: 'school-a' })).unplaced, 1)
  assert.equal(classOf(db, 'x@a.test'), '')

  // The history: who changed what, what was blocked and what was put back.
  const history = await call(db, 'owner', 'GET', `/api/school/class-history?studentId=${ada}`)
  assert.equal(history.status, 200)
  assert.deepEqual(history.body.entries.map(entry => entry.outcome).sort(), ['blocked', 'blocked', 'changed', 'placed', 'restored'])
  assert.equal(history.body.entries.find(entry => entry.outcome === 'changed').by_role, 'owner')
  assert.equal((await call(db, 'teacher', 'GET', '/api/school/class-history')).status, 403)
})

test('a class set on the People page reaches this session\'s register (fees, class lists); earlier ones are filled in by the check', async () => {
  const db = await setup()
  db.db.exec(`
    CREATE TABLE IF NOT EXISTS academic_sessions (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, name TEXT NOT NULL, start_date TEXT NOT NULL, end_date TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'upcoming');
    CREATE TABLE IF NOT EXISTS session_enrollments (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, session_id TEXT NOT NULL, session_name TEXT NOT NULL, student_id TEXT NOT NULL, student_name TEXT, class_id TEXT, class_name TEXT, class_arm TEXT, status TEXT, updated_at TEXT);
    INSERT INTO academic_sessions VALUES ('s-old', 'school-a', '2025/2026', '2025-09-01', '2026-07-31', 'completed'), ('s-now', 'school-a', '2026/2027', '2026-09-01', '2027-07-31', 'active');
  `)
  for (const [id, email] of [['s-ada', 'ada@a.test'], ['s-ben', 'ben@a.test']]) {
    db.db.prepare(`INSERT INTO users (id, email, name, role, tenantId, status) VALUES (?, ?, ?, 'student', 'school-a', 'active')`).run(id, email, id)
    db.db.prepare(`INSERT INTO settings (studentId, payload) VALUES (?, ?)`).run(email, JSON.stringify({ name: id, role: 'student', roles: ['student'], tenantId: 'school-a', status: 'active' }))
    db.db.prepare(`INSERT INTO session_enrollments (id, tenant_id, session_id, session_name, student_id, status) VALUES (?, 'school-a', 's-now', '2026/2027', ?, 'active'), (?, 'school-a', 's-old', '2025/2026', ?, 'active')`).run(`e-${id}`, id, `o-${id}`, id)
  }
  const registerClass = (student, session = 's-now') => db.db.prepare(`SELECT class_id FROM session_enrollments WHERE student_id = ? AND session_id = ?`).get(student, session).class_id
  // Placed on the People page: the register follows at once; last session's record is untouched.
  assert.equal((await call(db, 'owner', 'PUT', '/api/people/s-ada', { classId: 'jhs1' })).status, 200)
  assert.equal(registerClass('s-ada'), 'jhs1')
  assert.equal(registerClass('s-ada', 's-old'), null)
  // Placed before this fix (class on the profile, none on the register): the check fills the register.
  db.db.prepare(`UPDATE settings SET payload = json_set(payload, '$.classId', 'g1', '$.className', 'GRADE 1') WHERE studentId = 'ben@a.test'`).run()
  const result = await call(db, 'owner', 'POST', '/api/school/class-monitor/run')
  assert.equal(result.body.registered, 1)
  assert.equal(registerClass('s-ben'), 'g1')
})
