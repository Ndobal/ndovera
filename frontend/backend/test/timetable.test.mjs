import test from 'node:test'
import assert from 'node:assert/strict'
import { sign } from '@tsndr/cloudflare-worker-jwt'
import { D1Shim, createLegacySchema } from './d1-shim.mjs'

const SECRET = 'timetable-test-secret'
let worker
let generation = 0

const PEOPLE = {
  hos: ['h-a', 'hos@a.test', ['hos'], 'school-a', {}],
  teacher: ['t-a', 't@a.test', ['teacher'], 'school-a', {}],
  pupil: ['s-1', 's1@a.test', ['student'], 'school-a', { classId: 'jss1' }],
}

async function setup() {
  worker = (await import(`./build/worker.mjs?tt=${generation++}`)).default
  const db = new D1Shim()
  createLegacySchema(db)
  db.db.exec(`INSERT INTO classes (id, tenantId, name) VALUES ('jss1', 'school-a', 'JSS 1'), ('jss2', 'school-a', 'JSS 2');`)
  for (const [id, email, roles, tenant, extra] of Object.values(PEOPLE)) {
    await db.prepare('INSERT INTO users (id, email, name, role, tenantId, status) VALUES (?, ?, ?, ?, ?, ?)').bind(id, email, id, roles[0], tenant, 'active').run()
    await db.prepare('INSERT INTO settings (studentId, payload) VALUES (?, ?)').bind(email, JSON.stringify({ name: id, email, role: roles[0], roles, tenantId: tenant, schoolId: tenant, status: 'active', ...extra })).run()
  }
  return db
}

async function call(db, person, method, path, body) {
  const [id, , roles, tenantId] = PEOPLE[person]
  const token = await sign({ id, role: roles[0], roles, tenantId, name: id, exp: Math.floor(Date.now() / 1000) + 600 }, SECRET)
  const response = await worker.fetch(new Request(`https://ndovera.com${path}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }),
    { APP_DB: db, JWT_SECRET: SECRET }, { waitUntil() {}, passThroughOnException() {} })
  return { status: response.status, body: await response.json().catch(() => ({})) }
}

const maths = (teacherId = 'mrs-a') => [{ dayOfWeek: 1, periodIndex: 0, startTime: '08:00', endTime: '08:40', subjectName: 'Mathematics', teacherId, teacherName: 'Mrs A' }]

test('a draft stays private until published, and every publish is kept as a version', async () => {
  const db = await setup()
  assert.equal((await call(db, 'teacher', 'PUT', '/api/school/timetable/draft', { classId: 'jss1', entries: maths() })).status, 403)
  assert.equal((await call(db, 'hos', 'PUT', '/api/school/timetable/draft', { classId: 'jss1', entries: maths() })).status, 200)
  assert.deepEqual((await call(db, 'pupil', 'GET', '/api/school/timetable')).body.entries, [])

  const first = await call(db, 'hos', 'POST', '/api/school/timetable/publish', { classId: 'jss1', note: 'First term' })
  assert.deepEqual([first.status, first.body.version], [200, 1])
  assert.equal((await call(db, 'pupil', 'GET', '/api/school/timetable')).body.entries[0].subjectName, 'Mathematics')
  assert.equal((await call(db, 'hos', 'POST', '/api/school/timetable/publish', { classId: 'jss1' })).status, 400)

  await call(db, 'hos', 'POST', '/api/school/timetable/publish', { classId: 'jss1', entries: [{ ...maths()[0], subjectName: 'English' }] })
  const versions = await call(db, 'hos', 'GET', '/api/school/timetable/versions?classId=jss1')
  assert.deepEqual(versions.body.versions.map(item => [item.version, item.entries[0].subjectName]), [[2, 'English'], [1, 'Mathematics']])

  const manage = await call(db, 'hos', 'GET', '/api/school/timetable?classId=jss1')
  assert.equal(manage.body.published.version, 2)

  // Restoring brings version 1 back as a draft; students still see version 2 until it is published.
  await call(db, 'hos', 'POST', `/api/school/timetable/versions/${versions.body.versions[1].id}/restore`)
  assert.equal((await call(db, 'pupil', 'GET', '/api/school/timetable')).body.entries[0].subjectName, 'English')
  assert.equal((await call(db, 'hos', 'GET', '/api/school/timetable/draft?classId=jss1')).body.draft.entries[0].subjectName, 'Mathematics')
})

test('a teacher booked in two classes at once blocks publishing until confirmed', async () => {
  const db = await setup()
  await call(db, 'hos', 'POST', '/api/school/timetable/publish', { classId: 'jss1', entries: maths() })
  const clash = await call(db, 'hos', 'POST', '/api/school/timetable/publish', { classId: 'jss2', entries: maths() })
  assert.equal(clash.status, 409)
  assert.deepEqual([clash.body.clashes[0].otherClass, clash.body.clashes[0].startTime], ['JSS 1', '08:00'])
  assert.equal((await call(db, 'hos', 'POST', '/api/school/timetable/publish', { classId: 'jss2', entries: maths('mr-b') })).status, 200)
  assert.equal((await call(db, 'hos', 'POST', '/api/school/timetable/publish', { classId: 'jss2', entries: maths(), allowClashes: true })).status, 200)
})
