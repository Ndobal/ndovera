import test from 'node:test'
import assert from 'node:assert/strict'
import { sign } from '@tsndr/cloudflare-worker-jwt'
import { D1Shim, createLegacySchema } from './d1-shim.mjs'

const SECRET = 'student-file-test-secret'
let worker
let generation = 0

const PEOPLE = {
  ada: ['s-1', 'ada@a.test', 'student', 'school-a', 'Ada Obi', { classId: 'jss1' }],
  mum: ['par-1', 'mum@a.test', 'parent', 'school-a', 'Mrs Obi', {}],
  otherParent: ['par-2', 'other@a.test', 'parent', 'school-a', 'Mr Bello', {}],
  classTeacher: ['t-james', 'james@a.test', 'teacher', 'school-a', 'Sarah James', {}],
  mathsTeacher: ['t-math', 'math@a.test', 'teacher', 'school-a', 'Mr Maths', {}],
  grace: ['t-grace', 'grace@a.test', 'teacher', 'school-a', 'Grace Obi', {}],
  accountant: ['a-1', 'accounts@a.test', 'accountant', 'school-a', 'The Accountant', {}],
  clinic: ['c-1', 'clinic@a.test', 'clinic', 'school-a', 'School Nurse', {}],
  principal: ['p-1', 'principal@a.test', 'principal', 'school-a', 'The Principal', {}],
  owner: ['o-1', 'owner@a.test', 'owner', 'school-a', 'The Owner', {}],
}

async function setup() {
  worker = (await import(`./build/worker.mjs?studentfile=${generation++}`)).default
  const db = new D1Shim()
  createLegacySchema(db)
  db.db.exec(`
    CREATE TABLE subjects (id TEXT PRIMARY KEY, tenantId TEXT, name TEXT, classId TEXT, teacherId TEXT, createdAt TEXT);
    CREATE TABLE tenants (id TEXT PRIMARY KEY, school_name TEXT);
    INSERT INTO tenants VALUES ('school-a', 'Genesis');
    INSERT INTO classes (id, tenantId, name, arm, classTeacherId) VALUES ('jss1', 'school-a', 'JSS 1', '', 't-james'), ('p5', 'school-a', 'Primary 5', '', 't-grace');
    INSERT INTO subjects VALUES ('m1', 'school-a', 'Mathematics', 'jss1', 't-math', 'x'), ('e5', 'school-a', 'English', 'p5', 't-grace', 'x');
    CREATE TABLE IF NOT EXISTS parent_student_links (id TEXT PRIMARY KEY, parent_id TEXT, student_id TEXT, tenant_id TEXT, created_at TEXT);
    INSERT INTO parent_student_links VALUES ('l1', 'par-1', 's-1', 'school-a', '2026-09-01');
  `)
  for (const [id, email, role, tenant, name, extra] of Object.values(PEOPLE)) {
    await db.prepare('INSERT INTO users (id, email, name, role, tenantId, status) VALUES (?, ?, ?, ?, ?, ?)').bind(id, email, name, role, tenant, 'active').run()
    await db.prepare('INSERT INTO settings (studentId, payload) VALUES (?, ?)').bind(email, JSON.stringify({ name, email, role, tenantId: tenant, schoolId: tenant, status: 'active', ...extra })).run()
  }
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

const profile = (db, person) => call(db, person, 'GET', '/api/students/s-1/profile')

test('each viewer gets their own slice of the student file, and teachers only for the classes they teach', async () => {
  const db = await setup()
  assert.equal((await profile(db, 'grace')).status, 403, 'teaches a different class')
  assert.equal((await profile(db, 'otherParent')).status, 403)

  const classTeacher = (await profile(db, 'classTeacher')).body
  assert.equal(classTeacher.relation, 'classteacher')
  assert.deepEqual([classTeacher.permissions.groups.health.view, classTeacher.permissions.fees.view, classTeacher.permissions.guardians.view], [true, false, true])
  assert.equal(classTeacher.fees, null)
  assert.deepEqual(classTeacher.guardians.map(guardian => guardian.name), ['Mrs Obi'])

  const maths = (await profile(db, 'mathsTeacher')).body
  assert.equal(maths.relation, 'teacher')
  assert.deepEqual([maths.permissions.groups.health.view, maths.permissions.guardians.view, maths.guardians.length], [false, false, 0])

  const accountant = (await profile(db, 'accountant')).body
  assert.equal(accountant.relation, 'accountant')
  assert.equal(accountant.permissions.fees.view, true)
  assert.equal(accountant.permissions.recordPayment, true)
  assert.deepEqual([accountant.results, accountant.attendance, accountant.assignments], [null, null, null])

  const mum = (await profile(db, 'mum')).body
  assert.deepEqual([mum.relation, mum.permissions.fees.view, mum.permissions.recordPayment, mum.permissions.groups.notes.view], ['parent', true, false, false])
  assert.equal((await profile(db, 'ada')).body.relation, 'self')
  assert.equal((await profile(db, 'principal')).body.permissions.fees.view, false, 'fees are for the Owner, HOS, Accountant and family')
})

test('who may add what: staff record behaviour, the clinic records health, notes never reach the family', async () => {
  const db = await setup()
  const add = (person, category, title, extra = {}) => call(db, person, 'POST', '/api/students/s-1/records', { category, title, ...extra })
  assert.equal((await add('mathsTeacher', 'behaviour', 'Helped a classmate', { metadata: { rating: 'Excellent' } })).status, 201)
  assert.equal((await add('mathsTeacher', 'health', 'Asthma')).status, 403)
  assert.equal((await add('clinic', 'health', 'Asthma — inhaler kept at the clinic')).status, 201)
  assert.equal((await add('classTeacher', 'note', 'Quiet this week; watch')).status, 201)
  assert.equal((await add('mum', 'behaviour', 'x')).status, 403)
  assert.equal((await add('accountant', 'behaviour', 'x')).status, 403)
  assert.equal((await add('principal', 'document', 'Birth certificate', { files: [{ name: 'cert.pdf', url: 'https://ndovera.com/files/x/cert.pdf' }] })).status, 201)

  const titles = async person => (await profile(db, person)).body.records.map(record => record.title).sort()
  assert.deepEqual(await titles('mathsTeacher'), ['Helped a classmate', 'Quiet this week; watch'])
  assert.deepEqual(await titles('classTeacher'), ['Asthma — inhaler kept at the clinic', 'Birth certificate', 'Helped a classmate', 'Quiet this week; watch'])
  assert.deepEqual(await titles('mum'), ['Asthma — inhaler kept at the clinic', 'Birth certificate', 'Helped a classmate'])
  const overview = (await profile(db, 'classTeacher')).body.overview
  assert.equal(overview.behaviour, 'Excellent')
  const timeline = (await profile(db, 'mum')).body.timeline.map(event => event.text)
  assert.ok(timeline.includes('Behaviour: Helped a classmate'), JSON.stringify(timeline))
  assert.ok(!timeline.some(text => /Quiet this week/.test(text)))
})

test('a disciplinary case is open until closed, its history is kept, and only the Owner/HOS delete records', async () => {
  const db = await setup()
  const created = await call(db, 'classTeacher', 'POST', '/api/students/s-1/records', { category: 'disciplinary', title: 'Fighting in the hall', detail: 'Parents invited' })
  assert.equal(created.status, 201)
  assert.equal(created.body.record.metadata.status, 'open')
  assert.equal((await profile(db, 'principal')).body.overview.openDisciplinary, 1)
  const closed = await call(db, 'principal', 'PUT', `/api/students/s-1/records/${created.body.record.id}`, { status: 'closed', note: 'Apologised; matter resolved' })
  assert.equal(closed.status, 200, JSON.stringify(closed.body))
  assert.deepEqual(closed.body.record.metadata.history.map(entry => [entry.by, entry.status]), [['The Principal', 'closed']])
  assert.equal((await profile(db, 'principal')).body.overview.openDisciplinary, 0)
  assert.equal((await call(db, 'mum', 'PUT', `/api/students/s-1/records/${created.body.record.id}`, { status: 'open' })).status, 403)

  assert.equal((await call(db, 'classTeacher', 'DELETE', `/api/students/s-1/records/${created.body.record.id}`)).status, 403)
  assert.equal((await call(db, 'owner', 'DELETE', `/api/students/s-1/records/${created.body.record.id}`)).status, 200)
})

test('private records reach only the student, their parents, the HOS/Owner and the Accountant — never teachers, the clinic or the AI report', async () => {
  const db = await setup()
  const add = (person, body) => call(db, person, 'POST', '/api/students/s-1/records', body)
  assert.equal((await add('classTeacher', { category: 'note', title: 'Family matter', private: true })).status, 403, 'teachers cannot add private records')
  assert.equal((await add('accountant', { category: 'note', title: 'x' })).status, 403, 'the accountant only adds private records')
  assert.equal((await add('accountant', { category: 'note', title: 'Scholarship arrangement with the family', private: true })).status, 201)
  assert.equal((await add('owner', { category: 'health', title: 'Counselling referral', private: true })).status, 201)
  const titles = async person => (await profile(db, person)).body.records.map(record => record.title).sort()
  const both = ['Counselling referral', 'Scholarship arrangement with the family']
  for (const person of ['owner', 'accountant', 'mum', 'ada']) assert.deepEqual(await titles(person), both, person)
  for (const person of ['classTeacher', 'mathsTeacher', 'clinic', 'principal']) assert.deepEqual(await titles(person), [], person)
  assert.equal((await profile(db, 'mum')).body.permissions.seePrivate, true)
  assert.equal((await profile(db, 'classTeacher')).body.permissions.seePrivate, false)
  assert.ok(!(await profile(db, 'classTeacher')).body.timeline.some(event => /Counselling/.test(event.text)))
})
