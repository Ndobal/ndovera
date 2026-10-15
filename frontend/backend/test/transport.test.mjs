import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { sign } from '@tsndr/cloudflare-worker-jwt'
import { D1Shim, createLegacySchema } from './d1-shim.mjs'

// School transport: the school sets up routes and students, the driver runs the trips (scan or tap),
// arriving marks children present and tells parents and the school; leaving school tells them too.

const SECRET = 'transport-test-secret'
let generation = 0
const PEOPLE = {
  owner: ['own', 'owner@a.test', 'owner', {}],
  hos: ['hos', 'hos@a.test', 'hos', {}],
  teacher: ['tee', 'tee@a.test', 'teacher', {}],
  driver: ['drv', 'driver@a.test', 'driver', { phone: '08030000000' }],
  parent: ['par', 'parent@a.test', 'parent', {}],
  ada: ['ada', 'ada@a.test', 'student', { classId: 'jss1a', className: 'JSS 1A' }],
  bayo: ['bayo', 'bayo@a.test', 'student', { classId: 'jss1a', className: 'JSS 1A' }],
  chi: ['chi', 'chi@a.test', 'student', { classId: 'jss2a', className: 'JSS 2A' }],
}

async function setup() {
  const worker = (await import(`./build/worker.mjs?transport=${generation++}`)).default
  const db = new D1Shim()
  createLegacySchema(db)
  const schema = readFileSync(new URL('../d1/schema.sql', import.meta.url), 'utf8')
  db.db.exec(schema.match(/CREATE TABLE IF NOT EXISTS tenants \([\s\S]*?\);/)[0])
  const now = new Date().toISOString()
  db.db.prepare(`INSERT INTO tenants (id, school_name, school_slug, owner_name, owner_email, plan_key, requested_subdomain, website_domain, status, approval_status, payment_status, website_status, setup_fee_cents, student_fee_cents, created_at, updated_at, activated_at)
    VALUES ('school-a', 'Genesis International School', 'genesis', 'Owner', 'owner@a.test', 'growth', 'genesis', 'genesis.ndovera.com', 'active', 'approved', 'paid', 'active', 0, 0, ?, ?, ?)`).run(now, now, now)
  for (const [id, email, role, extra] of Object.values(PEOPLE)) {
    await db.prepare('INSERT INTO users (id, email, name, role, tenantId, status) VALUES (?, ?, ?, ?, ?, ?)').bind(id, email, id.toUpperCase(), role, 'school-a', 'active').run()
    await db.prepare('INSERT INTO settings (studentId, payload) VALUES (?, ?)').bind(email, JSON.stringify({ name: id.toUpperCase(), email, role, tenantId: 'school-a', schoolId: 'school-a', status: 'active', ...extra })).run()
  }
  db.db.exec(`CREATE TABLE IF NOT EXISTS parent_student_links (id TEXT PRIMARY KEY, parent_id TEXT, student_id TEXT, tenant_id TEXT, created_at TEXT);
    INSERT INTO parent_student_links VALUES ('l1', 'par', 'ada', 'school-a', 'x');`)
  const env = { APP_DB: db, JWT_SECRET: SECRET }
  const call = async (person, method, path, body) => {
    const [, email, role] = PEOPLE[person]
    const token = await sign({ id: email, role, roles: [role], tenantId: 'school-a', name: person, exp: Math.floor(Date.now() / 1000) + 600 }, SECRET)
    const response = await worker.fetch(new Request(`https://ndovera.com${path}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }), env, { waitUntil() {}, passThroughOnException() {} })
    return { status: response.status, body: await response.json().catch(() => ({})) }
  }
  return { db, call }
}

test('the school sets up a route; the driver carries the children; arrival marks them present and tells parents and the school', async () => {
  const { db, call } = await setup()
  assert.equal((await call('teacher', 'POST', '/api/transport/routes', { name: 'Lugbe' })).status, 403)

  const route = await call('owner', 'POST', '/api/transport/routes', { name: 'Lugbe – Airport Road', areas: 'Lugbe, Pyakasa, Airport Road', driverId: 'drv', vehicle: 'Toyota Hiace ABC-123', directions: 'both' })
  assert.equal(route.status, 201, JSON.stringify(route.body))
  const routeId = route.body.id
  assert.equal((await call('hos', 'PUT', `/api/transport/routes/${routeId}/students`, { studentIds: ['ada', 'bayo'], pickupPoint: 'Lugbe junction', pickupTime: '6:45', dropoffTime: '3:30pm', tripNo: 1, directions: 'both' })).body.saved, 2)
  assert.equal((await call('hos', 'PUT', `/api/transport/routes/${routeId}/students`, { studentIds: ['chi'], pickupTime: '7:20', tripNo: 2, directions: 'morning' })).body.saved, 1)

  const admin = await call('hos', 'GET', '/api/transport/admin')
  assert.equal(admin.body.routes[0].driverName, 'DRV')
  const adaPass = admin.body.routes[0].students.find(item => item.studentId === 'ada')
  assert.equal(adaPass.pickupTime, '06:45')
  assert.match(adaPass.qrText, /^NDOVERA-BUS:[A-Z0-9]{10}$/)

  // The driver sees everyone, and runs the school runs twice.
  const mine = await call('driver', 'GET', '/api/transport/driver')
  assert.equal(mine.body.routes[0].students.length, 3)
  assert.equal((await call('driver', 'PUT', '/api/transport/driver/trips', { trips: 2 })).body.trips, 2)

  const trip1 = await call('driver', 'POST', '/api/transport/driver/runs', { direction: 'morning', tripNo: 1 })
  assert.deepEqual(trip1.body.riders.map(item => item.studentId).sort(), ['ada', 'bayo'], 'trip 1 carries only trip-1 children')
  const runId = trip1.body.run.id
  assert.equal((await call('driver', 'POST', `/api/transport/driver/runs/${runId}/board`, { code: adaPass.qrText })).body.name, 'ADA')
  assert.equal((await call('driver', 'POST', `/api/transport/driver/runs/${runId}/board`, { studentId: 'bayo' })).body.onBoard, true)
  const chiPass = admin.body.routes[0].students.find(item => item.studentId === 'chi').qrText
  const wrongTrip = await call('driver', 'POST', `/api/transport/driver/runs/${runId}/board`, { code: chiPass })
  assert.equal(wrongTrip.status, 404)
  assert.match(wrongTrip.body.message, /not on this trip/)
  assert.equal((await call('driver', 'POST', `/api/transport/driver/runs/${runId}/board`, { code: 'NDOVERA-BUS:ZZZZZZZZZZ' })).body.message, 'This bus pass is not recognised.')
  // Another driver or a teacher cannot use this trip.
  assert.equal((await call('teacher', 'POST', `/api/transport/driver/runs/${runId}/arrive`)).status, 404)
  assert.equal((await call('driver', 'POST', `/api/transport/driver/runs/${runId}/depart`)).status, 400, 'leaving school is an afternoon event')

  const arrived = await call('driver', 'POST', `/api/transport/driver/runs/${runId}/arrive`)
  assert.equal(arrived.status, 200, JSON.stringify(arrived.body))
  assert.deepEqual([arrived.body.onBoard, arrived.body.markedPresent], [2, 2])
  const attendance = (await db.prepare(`SELECT student_id, class_id, status FROM student_attendance_school ORDER BY student_id`).all()).results
  assert.deepEqual(attendance.map(row => [row.student_id, row.class_id, row.status]), [['ada', 'jss1a', 'present'], ['bayo', 'jss1a', 'present']])

  // Trip 2 picks up the trip-2 child.
  const trip2 = await call('driver', 'POST', '/api/transport/driver/runs', { direction: 'morning', tripNo: 2 })
  assert.deepEqual(trip2.body.riders.map(item => item.studentId), ['chi'])

  // The parent sees the bus, the driver, the pick-up time and today's arrival, in the page and the bell.
  const parentView = await call('parent', 'GET', '/api/transport/mine')
  assert.equal(parentView.body.children.length, 1)
  const child = parentView.body.children[0]
  assert.deepEqual([child.name, child.routes[0].driverName, child.routes[0].driverPhone, child.routes[0].pickupTime, child.routes[0].areas], ['ADA', 'DRV', '08030000000', '06:45', 'Lugbe, Pyakasa, Airport Road'])
  assert.ok(child.today[0].arrivedAt)
  const parentBell = await call('parent', 'GET', '/api/header/parent')
  assert.ok(parentBell.body.notificationItems.some(item => item.title === 'ADA arrived at school'), JSON.stringify(parentBell.body.notificationItems))
  const hosBell = await call('hos', 'GET', '/api/header/hos')
  assert.ok(hosBell.body.notificationItems.some(item => /School bus arrived/.test(item.title) && /with 2 students/.test(item.detail)))
  const studentView = await call('ada', 'GET', '/api/transport/mine')
  assert.equal(studentView.body.children[0].routes[0].routeName, 'Lugbe – Airport Road')

  // Afternoon: only the both-ways children ride; leaving school tells the parent.
  const afternoon = await call('driver', 'POST', '/api/transport/driver/runs', { direction: 'afternoon', tripNo: 1 })
  assert.deepEqual(afternoon.body.riders.map(item => item.studentId).sort(), ['ada', 'bayo'])
  await call('driver', 'POST', `/api/transport/driver/runs/${afternoon.body.run.id}/board`, { studentId: 'ada' })
  assert.equal((await call('driver', 'POST', `/api/transport/driver/runs/${afternoon.body.run.id}/depart`)).body.onBoard, 1)
  const later = await call('parent', 'GET', '/api/header/parent')
  assert.ok(later.body.notificationItems.some(item => item.title === 'ADA has just left school'))
})
