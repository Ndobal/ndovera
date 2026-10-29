import test from 'node:test'
import assert from 'node:assert/strict'
import { sign } from '@tsndr/cloudflare-worker-jwt'
import { D1Shim, createLegacySchema } from './d1-shim.mjs'

// The linking screen shows every link however it was stored (id or email), parents marked
// there are turned off together (a reason when they still have a child), and a student who
// leaves through the Class Register takes a parent with no other child with them.

const SECRET = 'parent-links-secret'
let worker
let generation = 0

async function setup() {
  worker = (await import(`./build/worker.mjs?links=${generation++}`)).default
  const db = new D1Shim()
  createLegacySchema(db)
  db.db.exec(`
    INSERT INTO classes (id, tenantId, name, arm) VALUES ('c1', 'school-a', 'JSS 1', '');
    CREATE TABLE IF NOT EXISTS academic_sessions (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, name TEXT NOT NULL, start_date TEXT NOT NULL, end_date TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'upcoming', created_at TEXT, updated_at TEXT);
    INSERT INTO academic_sessions (id, tenant_id, name, start_date, end_date, status) VALUES ('s1', 'school-a', '2026/2027', '2026-09-01', '2027-07-31', 'active');
    CREATE TABLE IF NOT EXISTS parent_student_links (id TEXT PRIMARY KEY, parent_id TEXT, student_id TEXT, tenant_id TEXT, created_at TEXT);
  `)
  const people = [
    ['o-1', 'owner@a.test', 'Owner', 'owner', 'active'],
    ['st-1', 'ada@a.test', 'Ada', 'student', 'active'],
    ['st-2', 'bisi@a.test', 'Bisi', 'student', 'active'],
    ['st-3', 'chidi@a.test', 'Chidi', 'student', 'active'],
    ['p-1', 'obi@a.test', 'Mrs Obi', 'parent', 'active'],
    ['p-2', 'eze@a.test', 'Mr Eze', 'parent', 'active'],
    ['p-3', 'lone@a.test', 'Mr Lone', 'parent', 'active'],
    ['p-4', 'off@a.test', 'Mrs Off', 'parent', 'inactive'],
  ]
  for (const [id, email, name, role, status] of people) {
    await db.prepare('INSERT INTO users (id, email, name, role, primary_role, tenantId, status) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(id, email, name, role, role, 'school-a', status).run()
    await db.prepare('INSERT INTO settings (studentId, payload) VALUES (?, ?)').bind(email, JSON.stringify({ name, email, role, roles: [role], tenantId: 'school-a', status, classId: role === 'student' ? 'c1' : undefined, className: role === 'student' ? 'JSS 1' : undefined })).run()
  }
  db.db.exec(`
    INSERT INTO parent_student_links VALUES ('l1', 'obi@a.test', 'st-1', 'school-a', 'x');
    INSERT INTO parent_student_links VALUES ('l1b', 'p-1', 'st-1', 'school-a', 'x');
    INSERT INTO parent_student_links VALUES ('l2', 'p-2', 'bisi@a.test', 'school-a', 'x');
    INSERT INTO parent_student_links VALUES ('l3', 'p-4', 'st-3', 'school-a', 'x');
  `)
  return db
}

async function call(db, method, path, body) {
  const token = await sign({ id: 'o-1', role: 'owner,teacher', roles: ['owner', 'teacher'], tenantId: 'school-a', name: 'Owner', exp: Math.floor(Date.now() / 1000) + 600 }, SECRET)
  const response = await worker.fetch(new Request(`https://ndovera.com${path}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }),
    { APP_DB: db, JWT_SECRET: SECRET }, { waitUntil() {}, passThroughOnException() {} })
  return { status: response.status, body: await response.json().catch(() => ({})) }
}

const statusOf = (db, id) => db.db.prepare('SELECT status FROM users WHERE id = ?').get(id).status

test('links stored under an email still count, once each; a turned-off parent still counts as a link', async () => {
  const db = await setup()
  const overview = await call(db, 'GET', '/api/school/link-overview')
  assert.equal(overview.status, 200, JSON.stringify(overview.body))
  const student = id => overview.body.students.find(item => item.id === id)
  const parent = id => overview.body.parents.find(item => item.id === id)
  assert.deepEqual(student('st-1').parents.map(link => link.name), ['Mrs Obi'], 'saved under her email and her id: one link')
  assert.deepEqual(parent('p-2').children.map(link => link.name), ['Bisi'], 'saved under the child\'s email')
  assert.deepEqual(student('st-3').parents.map(link => [link.name, link.off]), [['Mrs Off', true]])
  assert.equal(parent('p-4'), undefined, 'turned-off parents are not on the list to work through')
  assert.deepEqual([overview.body.counts.unlinkedStudents, overview.body.counts.parentsWithoutChildren], [0, 1])

  // Unlinking removes the link however it was saved.
  assert.equal((await call(db, 'POST', '/api/school/parent-student-unlink', { parentId: 'p-1', studentId: 'st-1' })).status, 200)
  assert.equal(db.db.prepare(`SELECT COUNT(*) AS n FROM parent_student_links WHERE student_id = 'st-1'`).get().n, 0)
})

test('marked parents are turned off together; one who still has a child needs a reason, which is kept', async () => {
  const db = await setup()
  const refused = await call(db, 'POST', '/api/school/parents/turn-off', { parentIds: ['p-2', 'p-3'] })
  assert.equal(refused.status, 400)
  assert.deepEqual(refused.body.needReason.map(item => [item.name, item.children]), [['Mr Eze', ['Bisi']]])
  assert.deepEqual([statusOf(db, 'p-2'), statusOf(db, 'p-3')], ['active', 'active'], 'nothing is turned off without the reason')

  assert.equal((await call(db, 'POST', '/api/school/parents/turn-off', { parentIds: ['p-3'] })).status, 200, 'no child: no reason needed')
  assert.equal(statusOf(db, 'p-3'), 'inactive')

  const done = await call(db, 'POST', '/api/school/parents/turn-off', { parentIds: ['p-2', 'st-1'], reason: 'Moved abroad; the aunt collects Bisi now' })
  assert.equal(done.status, 200, JSON.stringify(done.body))
  assert.deepEqual(done.body.turnedOff, ['Mr Eze'], 'only parents are turned off here')
  assert.equal(statusOf(db, 'st-1'), 'active')
  const settings = JSON.parse(db.db.prepare(`SELECT payload FROM settings WHERE studentId = 'eze@a.test'`).get().payload)
  assert.equal(settings.deactivatedReason, 'Moved abroad; the aunt collects Bisi now')
})

test('a student withdrawn on the Class Register takes a parent with no other child with them', async () => {
  const db = await setup()
  db.db.exec(`INSERT INTO parent_student_links VALUES ('l4', 'p-2', 'st-2', 'school-a', 'x')`)
  for (const id of ['st-1', 'st-2']) {
    const placed = await call(db, 'POST', '/api/school/academic/sessions/s1/enrollments', { studentId: id, classId: 'c1' })
    assert.ok([200, 201].includes(placed.status), JSON.stringify(placed.body))
  }
  const moved = await call(db, 'POST', '/api/school/academic/sessions/s1/enrollments/move', { studentIds: ['st-1', 'st-2'], classId: '', status: 'withdrawn' })
  assert.equal(moved.status, 200, JSON.stringify(moved.body))
  assert.equal(statusOf(db, 'p-1'), 'inactive', 'Mrs Obi\'s only child left')
  assert.equal(statusOf(db, 'p-2'), 'inactive', 'Mr Eze\'s only child left (linked under the child\'s email and id)')
})
