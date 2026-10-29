import test from 'node:test'
import assert from 'node:assert/strict'
import { sign } from '@tsndr/cloudflare-worker-jwt'
import { D1Shim, createLegacySchema } from './d1-shim.mjs'
import { normalizePhone, looksLikePhone } from './build/phoneLogin.mjs'

// The family table: every student with their parents beside them. Parents typed in are
// created (with or without an email) and linked; a parent at the school already is found by
// email or phone; phone numbers become sign-in numbers; new students can be added here.

const SECRET = 'families-secret'
let worker
let generation = 0

async function setup() {
  worker = (await import(`./build/worker.mjs?families=${generation++}`)).default
  const db = new D1Shim()
  createLegacySchema(db)
  db.db.exec(`
    INSERT INTO classes (id, tenantId, name, arm) VALUES ('c1', 'school-a', 'JSS 1', 'A');
    CREATE TABLE IF NOT EXISTS tenants (id TEXT PRIMARY KEY, school_name TEXT, owner_email TEXT, status TEXT);
    INSERT INTO tenants VALUES ('school-a', 'Genesis', 'owner@a.test', 'active');
    CREATE TABLE IF NOT EXISTS academic_sessions (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, name TEXT NOT NULL, start_date TEXT NOT NULL, end_date TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'upcoming', created_at TEXT, updated_at TEXT);
    INSERT INTO academic_sessions (id, tenant_id, name, start_date, end_date, status) VALUES ('s1', 'school-a', '2026/2027', '2026-09-01', '2027-07-31', 'active');
  `)
  for (const [id, email, name, role] of [['o-1', 'owner@a.test', 'Owner', 'owner'], ['st-1', 'ada@a.test', 'Ada', 'student'], ['st-2', 'bisi@a.test', 'Bisi', 'student'], ['t-1', 'teacher@a.test', 'Mr Teach', 'teacher']]) {
    await db.prepare('INSERT INTO users (id, email, name, role, primary_role, tenantId, status) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(id, email, name, role, role, 'school-a', 'active').run()
    await db.prepare('INSERT INTO settings (studentId, payload) VALUES (?, ?)').bind(email, JSON.stringify({ name, email, role, roles: [role], tenantId: 'school-a', status: 'active', ...(role === 'student' ? { classId: 'c1', className: 'JSS 1', classArm: 'A' } : {}) })).run()
  }
  return db
}

async function call(db, method, path, body, token) {
  const auth = token ?? await sign({ id: 'o-1', role: 'owner', roles: ['owner'], tenantId: 'school-a', name: 'Owner', exp: Math.floor(Date.now() / 1000) + 600 }, SECRET)
  const response = await worker.fetch(new Request(`https://ndovera.com${path}`, { method, headers: { ...(auth ? { Authorization: `Bearer ${auth}` } : {}), 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }),
    { APP_DB: db, JWT_SECRET: SECRET }, { waitUntil() {}, passThroughOnException() {} })
  return { status: response.status, body: await response.json().catch(() => ({})) }
}

test('phone numbers are read the way Nigerians write them', () => {
  for (const written of ['0803 123 4567', '+234 803 123 4567', '2348031234567', '803-123-4567', '00234 8031234567']) assert.equal(normalizePhone(written), '2348031234567', written)
  assert.equal(normalizePhone('ada@a.test'), '')
  assert.equal(normalizePhone('12345'), '')
  assert.ok(looksLikePhone('0803 123 4567'))
  assert.ok(!looksLikePhone('GIS/STU/001'))
  assert.ok(!looksLikePhone('ada@a.test'))
})

test('parents typed into the table are created and linked, sign in by phone or email, and are found again for a brother or sister', async () => {
  const db = await setup()
  const saved = await call(db, 'POST', '/api/school/families/save', { rows: [
    { key: 'st-1', studentId: 'st-1', parents: [{ name: 'Mrs Obi', phone: '0803 123 4567' }, { name: 'Mr Obi', phone: '0805 000 1111', email: 'mr.obi@mail.test' }] },
    // Bisi's mother is the same Mrs Obi: found by her number, not created twice.
    { key: 'st-2', studentId: 'st-2', parents: [{ name: 'Mrs Obi', phone: '+2348031234567' }] },
    // A new student, with a new parent.
    { key: 'new-1', student: { name: 'Chidi Eze', classId: 'c1' }, parents: [{ name: 'Mr Eze', phone: '07011112222' }] },
  ] })
  assert.equal(saved.status, 200, JSON.stringify(saved.body))
  assert.deepEqual(saved.body.results.map(row => [row.key, row.ok, row.error || '']), [['st-1', true, ''], ['st-2', true, ''], ['new-1', true, '']])
  assert.equal(db.db.prepare(`SELECT COUNT(*) AS n FROM users WHERE name = 'Mrs Obi'`).get().n, 1)

  const table = await call(db, 'GET', '/api/school/families')
  assert.equal(table.status, 200)
  const row = name => table.body.students.find(student => student.name === name)
  assert.deepEqual(row('Ada').parents.map(parent => [parent.name, parent.phone, parent.email]).sort(), [['Mr Obi', '2348050001111', 'mr.obi@mail.test'], ['Mrs Obi', '2348031234567', '']])
  assert.deepEqual(row('Bisi').parents.map(parent => parent.name), ['Mrs Obi'])
  assert.deepEqual([row('Chidi Eze').className, row('Chidi Eze').parents.map(parent => parent.name)], ['JSS 1 A', ['Mr Eze']])
  const chidi = row('Chidi Eze').id
  assert.equal(db.db.prepare(`SELECT class_id FROM session_enrollments WHERE student_id = ?`).get(chidi).class_id, 'c1', 'the new student is on this session\'s register')

  // Mrs Obi has no email: she signs in with her phone number, written any way.
  const byPhone = await call(db, 'POST', '/api/auth/login', { email: '0803-123-4567', password: 'abcABC@123' }, '')
  assert.equal(byPhone.status, 200, JSON.stringify(byPhone.body))
  const byEmail = await call(db, 'POST', '/api/auth/login', { email: 'mr.obi@mail.test', password: 'abcABC@123' }, '')
  assert.equal(byEmail.status, 200, JSON.stringify(byEmail.body))
  const byHisPhone = await call(db, 'POST', '/api/auth/login', { email: '08050001111', password: 'abcABC@123' }, '')
  assert.equal(byHisPhone.status, 200)

  // Later she gets an email: added in the table, both ways of signing in keep working, the link stays.
  const mrsObi = row('Ada').parents.find(parent => parent.name === 'Mrs Obi').id
  const emailAdded = await call(db, 'POST', '/api/school/families/save', { rows: [{ key: 'st-1', studentId: 'st-1', parents: [{ id: mrsObi, name: 'Mrs Obi', phone: '08031234567', email: 'mrs.obi@mail.test' }] }] })
  assert.equal(emailAdded.body.results[0].ok, true, JSON.stringify(emailAdded.body))
  assert.equal((await call(db, 'POST', '/api/auth/login', { email: 'mrs.obi@mail.test', password: 'abcABC@123' }, '')).status, 200)
  assert.equal((await call(db, 'POST', '/api/auth/login', { email: '08031234567', password: 'abcABC@123' }, '')).status, 200)
  const again = await call(db, 'GET', '/api/school/families')
  assert.deepEqual(again.body.students.find(student => student.name === 'Bisi').parents.map(parent => parent.email), ['mrs.obi@mail.test'])
})

test('mistakes are reported per row and the other rows still save', async () => {
  const db = await setup()
  await call(db, 'POST', '/api/school/families/save', { rows: [{ key: 'st-1', studentId: 'st-1', parents: [{ name: 'Mrs Obi', phone: '08031234567' }] }] })
  const saved = await call(db, 'POST', '/api/school/families/save', { rows: [
    { key: 'a', studentId: 'st-2', parents: [{ name: 'Someone', phone: 'abc' }] },
    { key: 'b', student: { name: 'No Class' }, parents: [] },
    { key: 'c', studentId: 'st-2', parents: [{ name: 'Mr Teach', email: 'teacher@a.test' }] },
    { key: 'd', studentId: 'st-1', parents: [{ name: 'Second', phone: '07000000001' }, { name: 'Third', phone: '07000000002' }] },
    { key: 'e', studentId: 'st-2', parents: [{ name: 'Mrs Bello', phone: '0809 999 8888' }] },
  ] })
  const byKey = Object.fromEntries(saved.body.results.map(row => [row.key, row]))
  assert.match(byKey.a.error, /not a phone number/)
  assert.match(byKey.b.error, /Choose a class/)
  assert.match(byKey.c.error, /not a parent account/)
  assert.match(byKey.d.error, /at most 2/)
  assert.equal(byKey.e.ok, true)
  // A teacher cannot open the table.
  const teacher = await sign({ id: 't-1', role: 'teacher', roles: ['teacher'], tenantId: 'school-a', name: 'T', exp: Math.floor(Date.now() / 1000) + 600 }, SECRET)
  assert.equal((await call(db, 'GET', '/api/school/families', null, teacher)).status, 403)
})
