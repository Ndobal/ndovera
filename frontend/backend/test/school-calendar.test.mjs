import test from 'node:test'
import assert from 'node:assert/strict'
import { sign } from '@tsndr/cloudflare-worker-jwt'
import { D1Shim, createLegacySchema } from './d1-shim.mjs'

const SECRET = 'calendar-test-secret'
let worker
let generation = 0

const PEOPLE = {
  owner: ['o-a', 'owner@a.test', ['owner'], 'school-a', {}],
  hosTeacher: ['ht', 'ht@a.test', ['teacher', 'hos'], 'school-a', {}],
  teacher: ['t-a', 't@a.test', ['teacher'], 'school-a', {}],
  pupil1: ['s-1', 's1@a.test', ['student'], 'school-a', { classId: 'jss1' }],
  pupil2: ['s-2', 's2@a.test', ['student'], 'school-a', { classId: 'jss2' }],
}

async function setup() {
  worker = (await import(`./build/worker.mjs?cal=${generation++}`)).default
  const db = new D1Shim()
  createLegacySchema(db)
  db.db.exec(`INSERT INTO classes (id, tenantId, name) VALUES ('jss1', 'school-a', 'JSS 1'), ('jss2', 'school-a', 'JSS 2');`)
  for (const [id, email, roles, tenant, extra] of Object.values(PEOPLE)) {
    await db.prepare('INSERT INTO users (id, email, name, role, tenantId, status) VALUES (?, ?, ?, ?, ?, ?)').bind(id, email, id, roles[0], tenant, 'active').run()
    await db.prepare('INSERT INTO settings (studentId, payload) VALUES (?, ?)').bind(email, JSON.stringify({ name: id, email, role: roles[0], roles, tenantId: tenant, schoolId: tenant, status: 'active', ...extra })).run()
  }
  return db
}

async function call(db, person, method, path, body, selectedRole) {
  const [id, , roles, tenantId] = PEOPLE[person]
  const token = await sign({ id, role: roles[0], roles, tenantId, name: id, exp: Math.floor(Date.now() / 1000) + 600 }, SECRET)
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(selectedRole ? { 'X-Selected-Role': selectedRole } : {}) }
  const response = await worker.fetch(new Request(`https://ndovera.com${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined }),
    { APP_DB: db, JWT_SECRET: SECRET }, { waitUntil() {}, passThroughOnException() {} })
  return { status: response.status, body: await response.json().catch(() => ({})) }
}

const soon = offset => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10)

test('owner and HOS manage events with times, audiences and reminders; teachers cannot', async () => {
  const db = await setup()
  const event = { title: 'PTA meeting', type: 'event', startDate: soon(3), startTime: '14:00', endTime: '16:00', location: 'Hall', reminderMinutes: 1440, audience: { roles: ['parent'] } }
  assert.equal((await call(db, 'teacher', 'POST', '/api/school/calendar', event)).status, 403)
  const created = await call(db, 'owner', 'POST', '/api/school/calendar', event)
  assert.equal(created.status, 200)
  assert.deepEqual([created.body.event.startTime, created.body.event.reminderMinutes, created.body.event.audience.roles], ['14:00', 1440, ['parent']])
  // A teacher who is also HOS manages the calendar while acting as HOS.
  assert.equal((await call(db, 'hosTeacher', 'POST', '/api/school/calendar', { title: 'Staff training', type: 'event', startDate: soon(5), audience: { roles: ['staff'] } }, 'hos')).status, 200)
  assert.equal((await call(db, 'owner', 'POST', '/api/school/calendar', { title: 'Bad', type: 'event', startDate: soon(1), startTime: '10:00', endTime: '09:00' })).status, 400)

  const edited = await call(db, 'owner', 'PUT', `/api/school/calendar/${created.body.event.id}`, { ...event, title: 'PTA meeting (moved)', startTime: '15:00' })
  assert.equal(edited.body.event.title, 'PTA meeting (moved)')
  const audit = await db.prepare("SELECT action, data FROM audit WHERE action = 'schoolCalendarEventEdited'").all()
  assert.equal(audit.results.length, 1)
  const change = JSON.parse(audit.results[0].data)
  assert.deepEqual([change.before.title, change.after.title], ['PTA meeting', 'PTA meeting (moved)'])
})

test('each person sees only events addressed to them, and cancelled events disappear but stay on file', async () => {
  const db = await setup()
  await call(db, 'owner', 'POST', '/api/school/calendar', { title: 'Parents only', type: 'event', startDate: soon(2), audience: { roles: ['parent'] } })
  await call(db, 'owner', 'POST', '/api/school/calendar', { title: 'JSS 1 trip', type: 'event', startDate: soon(4), audience: { roles: ['student'], classIds: ['jss1'] } })
  const sports = await call(db, 'owner', 'POST', '/api/school/calendar', { title: 'Sports day', type: 'event', startDate: soon(6) })

  const titles = async person => (await call(db, person, 'GET', '/api/school/calendar/upcoming')).body.events.map(event => event.title)
  assert.deepEqual(await titles('pupil1'), ['JSS 1 trip', 'Sports day'])
  assert.deepEqual(await titles('pupil2'), ['Sports day'])
  assert.deepEqual(await titles('teacher'), ['Sports day'])

  assert.equal((await call(db, 'owner', 'DELETE', `/api/school/calendar/${sports.body.event.id}?reason=Rain`)).status, 200)
  assert.deepEqual(await titles('pupil2'), [])
  const managerView = await call(db, 'owner', 'GET', `/api/school/calendar?from=${soon(0)}&to=${soon(30)}`)
  const cancelled = managerView.body.events.find(event => event.title === 'Sports day')
  assert.deepEqual([cancelled.status, cancelled.cancelReason], ['cancelled', 'Rain'])
})

test('a cancelled holiday no longer counts as a holiday', async () => {
  const db = await setup()
  const holiday = await call(db, 'owner', 'POST', '/api/school/calendar', { title: 'Founders Day', type: 'holiday', startDate: soon(10) })
  const before = await call(db, 'owner', 'GET', `/api/school/calendar?from=${soon(0)}&to=${soon(30)}`)
  assert.ok(before.body.holidays.some(day => day.title === 'Founders Day'))
  await call(db, 'owner', 'DELETE', `/api/school/calendar/${holiday.body.event.id}`)
  const after = await call(db, 'owner', 'GET', `/api/school/calendar?from=${soon(0)}&to=${soon(30)}`)
  assert.ok(!after.body.holidays.some(day => day.title === 'Founders Day'))
})
