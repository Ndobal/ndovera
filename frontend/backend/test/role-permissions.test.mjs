// The role a request acts as: the role-switcher choice, honoured only while the
// person still holds that role. Runs requests through the bundled Worker.
import test from 'node:test'
import assert from 'node:assert/strict'
import { sign } from '@tsndr/cloudflare-worker-jwt'
import { D1Shim, createLegacySchema } from './d1-shim.mjs'

const SECRET = 'role-test-secret'
let worker
let generation = 0

// id, email, stored roles, tenant, roles carried in the login token
const PEOPLE = {
  dual: ['dual', 'dual@a.test', ['teacher', 'hos'], 'school-a', ['teacher', 'hos']],
  teacherOnly: ['teach', 'teach@a.test', ['teacher'], 'school-a', ['teacher']],
  // Was HOS when they signed in; the school has since removed the role.
  demoted: ['demoted', 'demoted@a.test', ['teacher'], 'school-a', ['teacher', 'hos']],
  otherHos: ['hos-b', 'hos@b.test', ['hos'], 'school-b', ['hos']],
}

async function setup() {
  worker = (await import(`./build/worker.mjs?roles=${generation++}`)).default
  const db = new D1Shim()
  createLegacySchema(db)
  db.db.exec('CREATE TABLE subjects (id TEXT PRIMARY KEY, tenantId TEXT, name TEXT, classId TEXT, teacherId TEXT, createdAt TEXT)')
  // Provisioned by d1/schema.sql in production rather than created at runtime.
  db.db.exec("CREATE TABLE tenants (id TEXT PRIMARY KEY, school_name TEXT); INSERT INTO tenants (id, school_name) VALUES ('school-a', 'School A'), ('school-b', 'School B')")
  await db.prepare("INSERT INTO classes (id, tenantId, name, arm) VALUES ('jss2a', 'school-a', 'JSS 2', 'A')").run()
  for (const [id, email, roles, tenant] of Object.values(PEOPLE)) {
    await db.prepare('INSERT INTO users (id, email, name, role, tenantId, status) VALUES (?, ?, ?, ?, ?, ?)').bind(id, email, id, roles[0], tenant, 'active').run()
    await db.prepare('INSERT INTO settings (studentId, payload) VALUES (?, ?)').bind(email, JSON.stringify({
      name: id, email, role: roles[0], roles, tenantId: tenant, schoolId: tenant, status: 'active',
    })).run()
  }
  return db
}

async function call(db, person, path, selectedRole) {
  const [id, , , tenantId, tokenRoles] = PEOPLE[person]
  const token = await sign({ id, role: tokenRoles[0], roles: tokenRoles, tenantId, name: id, exp: Math.floor(Date.now() / 1000) + 600 }, SECRET)
  const headers = { Authorization: `Bearer ${token}` }
  if (selectedRole) headers['X-Selected-Role'] = selectedRole
  const response = await worker.fetch(new Request(`https://ndovera.com${path}`, { headers }), { APP_DB: db, JWT_SECRET: SECRET }, { waitUntil() {}, passThroughOnException() {} })
  return response.status
}

test('a teacher who switches to HOS gets the HOS pages, not a teacher view of them', async () => {
  const db = await setup()
  assert.equal(await call(db, 'dual', '/api/school/admissions', 'hos'), 200)
  assert.equal(await call(db, 'dual', '/api/school/enquiries', 'hos'), 200)
  assert.equal(await call(db, 'dual', '/api/results/sheet?classId=jss2a', 'hos'), 200)
  // School-wide attendance: no classId needed for leadership.
  assert.equal(await call(db, 'dual', '/api/school/student-attendance?limit=10', 'hos'), 200)
  // Acting as teacher, the same person does not see admissions.
  assert.equal(await call(db, 'dual', '/api/school/admissions', 'teacher'), 403)
})

test('the switcher can never grant a role the person does not currently hold', async () => {
  const db = await setup()
  assert.equal(await call(db, 'teacherOnly', '/api/school/admissions', 'hos'), 403)
  assert.equal(await call(db, 'teacherOnly', '/api/results/sheet?classId=jss2a', 'hos'), 403)
  // Removed from HOS after signing in: the stored roles decide, not the old token.
  assert.equal(await call(db, 'demoted', '/api/school/admissions', 'hos'), 403)
  assert.equal(await call(db, 'demoted', '/api/school/enquiries', 'hos'), 403)
})

test("an HOS never reaches another school's classes", async () => {
  const db = await setup()
  assert.equal(await call(db, 'otherHos', '/api/results/sheet?classId=jss2a', 'hos'), 404)
})

// Appointing a Head of School is reserved to the Owner.
const STAFF = {
  owner: ['own', 'own@a.test', ['owner'], 'school-a', ['owner']],
  hos: ['hos-a', 'hos@a.test', ['hos'], 'school-a', ['hos']],
  ict: ['ict-a', 'ict@a.test', ['ict'], 'school-a', ['ict']],
}

async function setupStaff() {
  const db = await setup()
  for (const [id, email, roles, tenant] of Object.values(STAFF)) {
    await db.prepare('INSERT INTO users (id, email, name, role, tenantId, status) VALUES (?, ?, ?, ?, ?, ?)').bind(id, email, id, roles[0], tenant, 'active').run()
    await db.prepare('INSERT INTO settings (studentId, payload) VALUES (?, ?)').bind(email, JSON.stringify({ name: id, email, role: roles[0], roles, tenantId: tenant, schoolId: tenant, status: 'active' })).run()
  }
  return db
}

async function send(db, person, method, path, body) {
  const [id, , , tenantId, tokenRoles] = STAFF[person]
  const token = await sign({ id, role: tokenRoles[0], roles: tokenRoles, tenantId, name: id, exp: Math.floor(Date.now() / 1000) + 600 }, SECRET)
  const response = await worker.fetch(new Request(`https://ndovera.com${path}`, {
    method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }), { APP_DB: db, JWT_SECRET: SECRET, UPLOADS: { put: async () => null } }, { waitUntil() {}, passThroughOnException() {} })
  return response.status
}

test('only the owner can appoint or replace a head of school', async () => {
  const db = await setupStaff()
  const newHos = { name: 'New Head', email: 'newhead@a.test', role: 'hos', password: 'Passw0rd!x' }
  assert.equal(await send(db, 'hos', 'POST', '/api/people', newHos), 403)
  assert.equal(await send(db, 'ict', 'POST', '/api/people', newHos), 403)
  assert.equal(await send(db, 'hos', 'POST', '/api/people/bulk-upload', { rows: [{ name: 'X', email: 'x@a.test', role: 'hos' }] }), 403)
  // An HOS cannot change the existing head's role either.
  assert.equal(await send(db, 'ict', 'PUT', '/api/people/hos-a/role', { role: 'teacher' }), 403)
  assert.equal(await send(db, 'hos', 'PUT', '/api/people/teach/role', { role: 'hos' }), 403)
  // The owner can.
  assert.equal(await send(db, 'owner', 'POST', '/api/people', newHos), 201)
  // The HOS still adds ordinary staff.
  assert.equal(await send(db, 'hos', 'POST', '/api/people', { name: 'T', email: 't2@a.test', role: 'teacher', password: 'Passw0rd!x' }), 201)
})

test('results accept stable session and term ids, only from the same school', async () => {
  const db = await setup()
  const { academic } = await import('./build/materialSessionTest.mjs')
  academic.resetAcademicTablesCache()
  await academic.ensureAcademicTables(db)
  await db.prepare(`INSERT INTO academic_sessions (id, tenant_id, name, start_date, end_date, status, created_at, updated_at) VALUES
    ('s-a', 'school-a', '2026/2027', '2026-09-01', '2027-07-31', 'active', 'x', 'x'),
    ('s-b', 'school-b', '2026/2027', '2026-09-01', '2027-07-31', 'active', 'x', 'x')`).run()
  await db.prepare(`INSERT INTO academic_terms (id, tenant_id, session_id, name, sequence, start_date, end_date, status, created_at, updated_at) VALUES
    ('t-a', 'school-a', 's-a', 'First Term', 1, '2026-09-01', '2026-12-15', 'active', 'x', 'x')`).run()
  const [id, , , tenantId, roles] = PEOPLE.dual
  const token = await sign({ id, role: 'hos', roles, tenantId, name: id, exp: Math.floor(Date.now() / 1000) + 600 }, SECRET)
  const get = async query => {
    const response = await worker.fetch(new Request(`https://ndovera.com/api/results/sheet?classId=jss2a&${query}`, { headers: { Authorization: `Bearer ${token}`, 'X-Selected-Role': 'hos' } }),
      { APP_DB: db, JWT_SECRET: SECRET }, { waitUntil() {}, passThroughOnException() {} })
    return { status: response.status, body: await response.json() }
  }
  const ok = await get('sessionId=s-a&termId=t-a')
  assert.equal(ok.status, 200)
  assert.deepEqual([ok.body.period.sessionName, ok.body.period.termName, ok.body.period.termId], ['2026/2027', 'First Term', 't-a'])
  // No period asked for: new work follows the academic calendar, ids included.
  const current = await get('')
  assert.deepEqual([current.body.period.sessionId, current.body.period.termId, current.body.period.termName], ['s-a', 't-a', 'First Term'])
  // An older batch is still reachable by its saved names.
  const legacy = await get('sessionName=2025%2F2026&termName=Term%201')
  assert.deepEqual([legacy.status, legacy.body.period.sessionName, legacy.body.period.termName], [200, '2025/2026', 'Term 1'])
  assert.equal((await get('sessionId=s-b')).status, 400)
  assert.equal((await get('sessionId=s-a&termId=missing')).status, 400)
})

test('a teacher acting as HOS can open every finance screen; acting as teacher, or after losing the role, cannot', async () => {
  const db = await setup()
  const finance = ['/api/school/fees-ledger', '/api/school/fees-receipts', '/api/school/fees/payment-details', '/api/school/fees/payment-claims', '/api/school/finance/context']
  for (const path of finance) {
    assert.equal(await call(db, 'dual', path, 'hos'), 200, path)
    assert.equal(await call(db, 'dual', path, 'teacher'), 403, `${path} as teacher`)
    assert.equal(await call(db, 'demoted', path, 'hos'), 403, `${path} after the HOS role was removed`)
  }
})
