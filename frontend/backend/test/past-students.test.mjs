import test from 'node:test'
import assert from 'node:assert/strict'
import { sign } from '@tsndr/cloudflare-worker-jwt'
import { D1Shim, createLegacySchema } from './d1-shim.mjs'

// Turned-off students leave the Class Register; one added by mistake (nothing on record)
// can be deleted for good, anyone with work, results or payments cannot.

const SECRET = 'past-students-secret'
let worker
let generation = 0

async function setup() {
  worker = (await import(`./build/worker.mjs?past=${generation++}`)).default
  const db = new D1Shim()
  createLegacySchema(db)
  db.db.exec(`
    INSERT INTO classes (id, tenantId, name, arm) VALUES ('c1', 'school-a', 'JSS 1', '');
    CREATE TABLE IF NOT EXISTS academic_sessions (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, name TEXT NOT NULL, start_date TEXT NOT NULL, end_date TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'upcoming', created_at TEXT, updated_at TEXT);
    INSERT INTO academic_sessions (id, tenant_id, name, start_date, end_date, status) VALUES ('s1', 'school-a', '2026/2027', '2026-09-01', '2027-07-31', 'active');
    CREATE TABLE IF NOT EXISTS practice_attempts (id TEXT PRIMARY KEY, tenant_id TEXT, student_id TEXT, created_at TEXT);
  `)
  const people = [['o-1', 'owner@a.test', 'owner', 'active'], ['t-1', 'teacher@a.test', 'teacher', 'active'], ['s-mistake', 'mistake@a.test', 'student', 'inactive'],
    ['s-worked', 'worked@a.test', 'student', 'inactive'], ['s-here', 'here@a.test', 'student', 'active']]
  for (const [id, email, role, status] of people) {
    await db.prepare('INSERT INTO users (id, email, name, role, tenantId, status) VALUES (?, ?, ?, ?, ?, ?)').bind(id, email, id, role, 'school-a', status).run()
    await db.prepare('INSERT INTO settings (studentId, payload) VALUES (?, ?)').bind(email, JSON.stringify({ name: id, email, role, roles: [role], tenantId: 'school-a', status, classId: role === 'student' ? 'c1' : undefined })).run()
  }
  db.db.exec(`INSERT INTO practice_attempts VALUES ('a1', 'school-a', 's-worked', 'x')`)
  return db
}

async function call(db, as, method, path, body) {
  const [id, role] = as === 'owner' ? ['o-1', 'owner'] : ['t-1', 'teacher']
  const token = await sign({ id, role, roles: [role], tenantId: 'school-a', name: id, exp: Math.floor(Date.now() / 1000) + 600 }, SECRET)
  const response = await worker.fetch(new Request(`https://ndovera.com${path}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }),
    { APP_DB: db, JWT_SECRET: SECRET }, { waitUntil() {}, passThroughOnException() {} })
  return { status: response.status, body: await response.json().catch(() => ({})) }
}

test('turned-off students are not on the Class Register; only ones with nothing on record can be deleted for good', async () => {
  const db = await setup()
  // Everyone was on this session's register before two were turned off.
  const enrolled = await call(db, 'owner', 'POST', '/api/school/academic/sessions/s1/enrollments', { studentId: 's-here', classId: 'c1' })
  assert.ok([200, 201].includes(enrolled.status), JSON.stringify(enrolled.body))
  for (const id of ['s-mistake', 's-worked']) db.db.prepare(`INSERT INTO session_enrollments (id, tenant_id, session_id, session_name, student_id, student_name, class_id, class_name, status, created_at, updated_at) VALUES (?, 'school-a', 's1', '2026/2027', ?, ?, 'c1', 'JSS 1', 'active', 'x', 'x')`).run(`e-${id}`, id, id)
  const register = await call(db, 'owner', 'GET', '/api/school/academic/sessions/s1/enrollments')
  assert.equal(register.status, 200, JSON.stringify(register.body))
  assert.deepEqual(register.body.enrollments.map(row => row.studentId), ['s-here'])

  // Past students show what each has on record.
  const past = await call(db, 'owner', 'GET', '/api/people/past-students')
  const byId = Object.fromEntries(past.body.students.map(student => [student.id, student]))
  assert.deepEqual([byId['s-mistake'].deletable, byId['s-worked'].deletable, byId['s-worked'].records], [true, false, ['practice quizzes']])

  assert.equal((await call(db, 'teacher', 'POST', '/api/people/past-students/delete', { ids: ['s-mistake'] })).status, 403)
  const result = await call(db, 'owner', 'POST', '/api/people/past-students/delete', { ids: ['s-mistake', 's-worked', 's-here', 'nobody'] })
  assert.equal(result.status, 200, JSON.stringify(result.body))
  assert.equal(result.body.deleted, 1)
  assert.deepEqual(result.body.kept.map(item => [item.id, item.reason]).sort(), [['nobody', 'not found in this school'], ['s-here', 'still active — turn them off first'], ['s-worked', 'has practice quizzes']])
  assert.equal(db.db.prepare(`SELECT COUNT(*) AS n FROM users WHERE id = 's-mistake'`).get().n, 0)
  assert.equal(db.db.prepare(`SELECT COUNT(*) AS n FROM settings WHERE studentId = 'mistake@a.test'`).get().n, 0)
  assert.equal(db.db.prepare(`SELECT COUNT(*) AS n FROM session_enrollments WHERE student_id = 's-mistake'`).get().n, 0)
  assert.equal(db.db.prepare(`SELECT COUNT(*) AS n FROM users WHERE id IN ('s-worked', 's-here')`).get().n, 2)
})

test('a turned-off student who chats with friends is kept, so their friends\' conversations stay whole', async () => {
  const db = await setup()
  db.db.exec(`CREATE TABLE IF NOT EXISTS conversations (id TEXT PRIMARY KEY, subject TEXT, participants TEXT, created_at TEXT, updated_at TEXT);
    INSERT INTO conversations VALUES ('cv1', 'Friends', '["s-mistake","friend-1"]', 'x', 'x');`)
  const result = await call(db, 'owner', 'POST', '/api/people/past-students/delete', { ids: ['s-mistake'] })
  assert.deepEqual([result.body.deleted, result.body.kept[0].reason], [0, 'has chats with friends'])
})

test('past students (any past status, any case) leave class lists; Remove hides them everywhere; parents follow', async () => {
  const db = await setup()
  // A withdrawn student written with a capital letter, and a parent whose only child has left.
  await db.prepare('INSERT INTO users (id, email, name, role, tenantId, status) VALUES (?, ?, ?, ?, ?, ?)').bind('s-gone', 'gone@a.test', 's-gone', 'student', 'school-a', 'Withdrawn').run()
  await db.prepare('INSERT INTO settings (studentId, payload) VALUES (?, ?)').bind('gone@a.test', JSON.stringify({ name: 's-gone', email: 'gone@a.test', role: 'student', tenantId: 'school-a', status: 'Withdrawn', classId: 'c1' })).run()
  await db.prepare('INSERT INTO users (id, email, name, role, primary_role, tenantId, status) VALUES (?, ?, ?, ?, ?, ?, ?)').bind('p-1', 'parent@a.test', 'Parent One', 'parent', 'parent', 'school-a', 'active').run()
  await db.prepare('INSERT INTO settings (studentId, payload) VALUES (?, ?)').bind('parent@a.test', JSON.stringify({ name: 'Parent One', email: 'parent@a.test', role: 'parent', tenantId: 'school-a', status: 'active' })).run()
  db.db.exec(`CREATE TABLE IF NOT EXISTS parent_student_links (id TEXT, tenant_id TEXT, parent_id TEXT, student_id TEXT, created_at TEXT)`)
  db.db.exec(`INSERT INTO parent_student_links (id, tenant_id, parent_id, student_id, created_at) VALUES ('l1', 'school-a', 'p-1', 's-worked', 'x')`)

  const classList = (await call(db, 'owner', 'GET', '/api/classrooms/c1/students')).body.students.map(student => student.id)
  assert.deepEqual(classList, ['s-here'])

  // Remove: s-worked has records, so it is hidden, not deleted; its parent has no child left.
  const removed = await call(db, 'owner', 'POST', '/api/people/past-students/remove', { ids: ['s-worked', 's-here'] })
  assert.equal(removed.status, 200, JSON.stringify(removed.body))
  assert.equal(removed.body.removed, 1)
  assert.match(removed.body.kept[0].reason, /still active/)
  assert.deepEqual(removed.body.parentsTurnedOff, ['Parent One'])
  const past = (await call(db, 'owner', 'GET', '/api/people/past-students')).body.students.map(student => student.id)
  assert.ok(!past.includes('s-worked'))
  assert.deepEqual((await call(db, 'owner', 'GET', '/api/people/past-students?view=removed')).body.students.map(student => student.id), ['s-worked'])
  assert.deepEqual((await call(db, 'owner', 'GET', '/api/people/past-parents')).body.parents.map(parent => [parent.id, parent.automatic]), [['p-1', true]])

  // Restoring the child brings the parent back on their own.
  const back = await call(db, 'owner', 'POST', '/api/people/s-worked/restore')
  assert.deepEqual(back.body.parentsRestored, ['Parent One'])
  assert.equal(db.db.prepare(`SELECT status FROM users WHERE id = 'p-1'`).get().status, 'active')
})
