import test from 'node:test'
import assert from 'node:assert/strict'
import { sign } from '@tsndr/cloudflare-worker-jwt'
import { D1Shim, createLegacySchema } from './d1-shim.mjs'

// Smart Setup Centre: statuses worked out from the school's own records, with reasons and
// counts; progress and critical readiness apart; a failed check says so instead of guessing.

const SECRET = 'setup-centre-secret'
const TODAY = new Date().toISOString().slice(0, 10)
const shift = days => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10)

async function setup() {
  const worker = (await import(`./build/worker.mjs?setup=${Math.random()}`)).default
  const db = new D1Shim()
  createLegacySchema(db)
  db.db.exec(`CREATE TABLE IF NOT EXISTS tenants (id TEXT PRIMARY KEY, requested_subdomain TEXT, website_domain TEXT, school_name TEXT)`)
  db.db.exec(`INSERT INTO tenants (id, requested_subdomain, school_name) VALUES ('school-a', 'greenfield', 'Greenfield School')`)
  const people = { owner: ['own', 'own@a.ng', 'owner'], hos: ['hos', 'hos@a.ng', 'hos'], teacher: ['tea', 'tea@a.ng', 'teacher'] }
  for (const [id, email, role] of Object.values(people)) {
    await db.prepare('INSERT INTO users (id, email, name, role, tenantId, status) VALUES (?, ?, ?, ?, ?, ?)').bind(id, email, id.toUpperCase(), role, 'school-a', 'active').run()
    await db.prepare('INSERT INTO settings (studentId, payload) VALUES (?, ?)').bind(email, JSON.stringify({ id, email, role, roles: [role], tenantId: 'school-a' })).run()
  }
  const call = async (person, method, path, body) => {
    const [id, email, role] = people[person]
    const token = await sign({ id, email, role, roles: [role], tenantId: 'school-a', exp: Math.floor(Date.now() / 1000) + 600 }, SECRET)
    const response = await worker.fetch(new Request(`https://ndovera.com${path}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'X-Selected-Role': role }, body: body ? JSON.stringify(body) : undefined }), { APP_DB: db, JWT_SECRET: SECRET }, { waitUntil() {}, passThroughOnException() {} })
    return { status: response.status, body: await response.json().catch(() => ({})) }
  }
  return { db, call }
}

const byKey = result => Object.fromEntries(result.areas.map(item => [item.key, item]))

test('a new school: nothing set up, every step says what to do, not ready', async () => {
  const { call } = await setup()
  assert.equal((await call('teacher', 'GET', '/api/school/setup')).status, 403)
  const result = (await call('owner', 'GET', '/api/school/setup')).body
  const areas = byKey(result)
  assert.equal(areas.session.status, 'not_started')
  assert.equal(areas.classes.status, 'not_started')
  assert.equal(areas.subjects.status, 'blocked') // waits for classes
  assert.equal(areas.teachers.status, 'blocked')
  assert.equal(areas.fees.status, 'blocked') // waits for a running term
  assert.equal(areas.calendar.status, 'blocked')
  assert.equal(result.readiness.ready, false)
  assert.ok(result.readiness.missing.includes('Session and current term'))
  assert.equal(result.progress.percent, Math.round(result.progress.done / result.progress.applicable * 100))
  assert.equal(result.keepTeachers, true)
})

test('a half-set-up school: each gap is named with counts', async () => {
  const { call, db } = await setup()
  db.db.exec(`CREATE TABLE IF NOT EXISTS academic_sessions (id TEXT PRIMARY KEY, tenant_id TEXT, name TEXT, start_date TEXT, end_date TEXT, status TEXT)`)
  db.db.exec(`CREATE TABLE IF NOT EXISTS academic_terms (id TEXT PRIMARY KEY, tenant_id TEXT, session_id TEXT, name TEXT, sequence INTEGER, start_date TEXT, end_date TEXT, resumption_date TEXT, status TEXT)`)
  db.db.prepare(`INSERT INTO academic_sessions VALUES ('s1', 'school-a', '2026/2027', ?, ?, 'active')`).run(shift(-40), shift(300))
  db.db.prepare(`INSERT INTO academic_terms VALUES ('t1', 'school-a', 's1', 'First Term', 1, ?, ?, NULL, 'active')`).run(shift(-40), shift(50))
  db.db.exec(`INSERT INTO classes (id, tenantId, name, arm, classTeacherId) VALUES ('c1', 'school-a', 'JSS 1', 'A', 'tea'), ('c2', 'school-a', 'Blue Room', '', NULL)`)
  db.db.exec(`CREATE TABLE IF NOT EXISTS subjects (id TEXT PRIMARY KEY, tenantId TEXT, name TEXT, classId TEXT, teacherId TEXT, createdAt TEXT)`)
  db.db.exec(`INSERT INTO subjects (id, tenantId, name, classId, teacherId) VALUES ('m1', 'school-a', 'Mathematics', 'c1', 'tea'), ('e1', 'school-a', 'English', 'c1', NULL)`)
  db.db.exec(`INSERT INTO users (id, email, name, role, tenantId, status) VALUES ('s-ada', 'ada@a.ng', 'Ada Obi', 'student', 'school-a', 'active'), ('s-bo', 'bo@a.ng', 'Bo Eze', 'student', 'school-a', 'active'), ('x', 'x@a.ng', 'No Role', '', 'school-a', 'active')`)
  db.db.exec(`CREATE TABLE IF NOT EXISTS student_class_pins (student_id TEXT PRIMARY KEY, tenant_id TEXT, settings_key TEXT, class_id TEXT, class_name TEXT, class_arm TEXT, pinned_at TEXT, pinned_by TEXT, pinned_by_name TEXT, pinned_by_role TEXT, reason TEXT)`)
  db.db.exec(`INSERT INTO student_class_pins (student_id, tenant_id, class_id, pinned_at) VALUES ('s-ada', 'school-a', 'c1', 'x')`)
  db.db.exec(`CREATE TABLE IF NOT EXISTS parent_student_links (id TEXT PRIMARY KEY, parent_id TEXT, student_id TEXT, tenant_id TEXT, created_at TEXT)`)
  db.db.exec(`INSERT INTO parent_student_links VALUES ('l1', 'p1', 'ada@a.ng', 'school-a', 'x')`)

  const areas = byKey((await call('hos', 'GET', '/api/school/setup')).body)
  assert.equal(areas.session.status, 'complete')
  assert.match(areas.session.summary, /2026\/2027, First Term/)
  assert.equal(areas.classes.status, 'incomplete')
  assert.match(areas.classes.problems[0], /Blue Room/) // section unknown
  assert.equal(areas.classes.fix, 'classLevels')
  assert.equal(areas.subjects.counts.classesWithout, 1)
  assert.equal(areas.people.counts.studentsWithoutClass, 1)
  assert.match(areas.people.problems.join(' '), /Bo Eze/)
  assert.equal(areas.parents.counts.unlinked, 1) // a link by email counts
  assert.match(areas.roles.problems[0], /No Role/)
  assert.equal(areas.teachers.counts.classesWithoutTeacher, 1)
  assert.equal(areas.teachers.counts.subjectsWithoutTeacher, 1)
  assert.equal(areas.fees.status, 'not_started')
  assert.match(areas.fees.problems.join(' '), /First Term's fees are not published/)
  assert.match(areas.calendar.problems.join(' '), /No term after First Term/)
})

test('a fully set-up school is ready; a check that fails says "unable to verify" without hiding the rest', async () => {
  const { call, db } = await setup()
  db.db.exec(`CREATE TABLE IF NOT EXISTS academic_sessions (id TEXT PRIMARY KEY, tenant_id TEXT, name TEXT, start_date TEXT, end_date TEXT, status TEXT)`)
  db.db.exec(`CREATE TABLE IF NOT EXISTS academic_terms (id TEXT PRIMARY KEY, tenant_id TEXT, session_id TEXT, name TEXT, sequence INTEGER, start_date TEXT, end_date TEXT, resumption_date TEXT, status TEXT)`)
  db.db.prepare(`INSERT INTO academic_sessions VALUES ('s1', 'school-a', '2026/2027', ?, ?, 'active')`).run(shift(-40), shift(300))
  db.db.prepare(`INSERT INTO academic_terms VALUES ('t1', 'school-a', 's1', 'First Term', 1, ?, ?, NULL, 'active'), ('t2', 'school-a', 's1', 'Second Term', 2, ?, ?, ?, 'upcoming')`).run(shift(-40), shift(50), shift(70), shift(150), shift(70))
  db.db.exec(`INSERT INTO classes (id, tenantId, name, arm, classTeacherId) VALUES ('c1', 'school-a', 'JSS 1', 'A', 'tea')`)
  db.db.exec(`CREATE TABLE IF NOT EXISTS subjects (id TEXT PRIMARY KEY, tenantId TEXT, name TEXT, classId TEXT, teacherId TEXT, createdAt TEXT)`)
  db.db.exec(`INSERT INTO subjects (id, tenantId, name, classId, teacherId) VALUES ('m1', 'school-a', 'Mathematics', 'c1', 'tea')`)
  db.db.exec(`INSERT INTO users (id, email, name, role, tenantId, status) VALUES ('s-ada', 'ada@a.ng', 'Ada Obi', 'student', 'school-a', 'active')`)
  db.db.exec(`CREATE TABLE IF NOT EXISTS student_class_pins (student_id TEXT PRIMARY KEY, tenant_id TEXT, settings_key TEXT, class_id TEXT, class_name TEXT, class_arm TEXT, pinned_at TEXT, pinned_by TEXT, pinned_by_name TEXT, pinned_by_role TEXT, reason TEXT)`)
  db.db.exec(`INSERT INTO student_class_pins (student_id, tenant_id, class_id, pinned_at) VALUES ('s-ada', 'school-a', 'c1', 'x')`)
  db.db.exec(`CREATE TABLE IF NOT EXISTS fee_term_locks (tenant_id TEXT, term_id TEXT, locked INTEGER)`)
  db.db.exec(`INSERT INTO fee_term_locks VALUES ('school-a', 't1', 1)`)
  db.db.prepare('INSERT INTO settings (studentId, payload) VALUES (?, ?)').run('fees_payment_details:school-a', JSON.stringify({ bankName: 'First Bank', accountNumber: '3012345678' }))

  const result = (await call('owner', 'GET', '/api/school/setup')).body
  const areas = byKey(result)
  for (const key of ['session', 'classes', 'subjects', 'people', 'roles', 'teachers', 'fees']) assert.equal(areas[key].status, 'complete', `${key}: ${areas[key].summary} ${areas[key].problems}`)
  assert.equal(result.readiness.ready, true)
  assert.ok(result.progress.done < result.progress.applicable) // optional areas still open: progress and readiness are apart

  // A broken record (not a missing table) is reported, never guessed.
  db.db.exec(`DROP TABLE fee_term_locks`)
  db.db.exec(`CREATE VIEW fee_term_locks AS SELECT 1 / 0 AS tenant_id, json('broken') AS term_id, 1 AS locked`)
  const broken = (await call('owner', 'GET', '/api/school/setup')).body
  const brokenAreas = byKey(broken)
  assert.equal(brokenAreas.fees.status, 'unable_to_verify')
  assert.equal(brokenAreas.session.status, 'complete')
  assert.equal(broken.readiness.ready, false)
  assert.deepEqual(broken.readiness.unverified, ['School fees'])
})

test('the school chooses whether teachers carry into a new session', async () => {
  const { call } = await setup()
  assert.equal((await call('teacher', 'PUT', '/api/school/setup/session-transition', { keepTeachers: false })).status, 403)
  assert.equal((await call('owner', 'PUT', '/api/school/setup/session-transition', { keepTeachers: false })).body.keepTeachers, false)
  assert.equal((await call('hos', 'GET', '/api/school/setup')).body.keepTeachers, false)
})
