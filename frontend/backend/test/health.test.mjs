import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { sign } from '@tsndr/cloudflare-worker-jwt'
import { D1Shim, createLegacySchema } from './d1-shim.mjs'

// The school health register: teachers report, the nurse (or the Owner/HoS with no nurse) manages,
// the Owner, HoS and nurse see every history, parents see their own child's.

const SECRET = 'health-test-secret'
let generation = 0
const PEOPLE = {
  owner: ['own', 'owner@a.test', 'owner', {}],
  hos: ['hos', 'hos@a.test', 'hos', {}],
  teacher: ['tee', 'tee@a.test', 'teacher', {}],
  teacher2: ['tee2', 'tee2@a.test', 'teacher', {}],
  parent: ['par', 'parent@a.test', 'parent', {}],
  otherParent: ['par2', 'parent2@a.test', 'parent', {}],
  ada: ['ada', 'ada@a.test', 'student', { classId: 'jss1a', className: 'JSS 1A' }],
}

function fakeBucket() {
  const store = new Map()
  return {
    store,
    async put(key, value, options) { store.set(key, { bytes: new Uint8Array(await new Response(value).arrayBuffer()), contentType: options?.httpMetadata?.contentType }) },
    async get(key) { const item = store.get(key); return item ? { body: item.bytes, httpMetadata: { contentType: item.contentType } } : null },
  }
}

async function setup() {
  const worker = (await import(`./build/worker.mjs?health=${generation++}`)).default
  const db = new D1Shim()
  createLegacySchema(db)
  const schema = readFileSync(new URL('../d1/schema.sql', import.meta.url), 'utf8')
  db.db.exec(schema.match(/CREATE TABLE IF NOT EXISTS tenants \([\s\S]*?\);/)[0])
  const now = new Date().toISOString()
  db.db.prepare(`INSERT INTO tenants (id, school_name, school_slug, owner_name, owner_email, plan_key, requested_subdomain, website_domain, status, approval_status, payment_status, website_status, setup_fee_cents, student_fee_cents, created_at, updated_at, activated_at)
    VALUES ('school-a', 'Genesis International School', 'genesis', 'Owner', 'owner@a.test', 'growth', 'genesis', 'genesis.ndovera.com', 'active', 'approved', 'paid', 'active', 0, 0, ?, ?, ?)`).run(now, now, now)
  const addPerson = async ([id, email, role, extra]) => {
    await db.prepare('INSERT INTO users (id, email, name, role, tenantId, status) VALUES (?, ?, ?, ?, ?, ?)').bind(id, email, id.toUpperCase(), role, 'school-a', 'active').run()
    await db.prepare('INSERT INTO settings (studentId, payload) VALUES (?, ?)').bind(email, JSON.stringify({ name: id.toUpperCase(), email, role, tenantId: 'school-a', schoolId: 'school-a', status: 'active', ...extra })).run()
  }
  for (const person of Object.values(PEOPLE)) await addPerson(person)
  db.db.exec(`CREATE TABLE IF NOT EXISTS parent_student_links (id TEXT PRIMARY KEY, parent_id TEXT, student_id TEXT, tenant_id TEXT, created_at TEXT);
    INSERT INTO parent_student_links VALUES ('l1', 'par', 'ada', 'school-a', 'x');`)
  const uploads = fakeBucket()
  const env = { APP_DB: db, JWT_SECRET: SECRET, UPLOADS: uploads }
  const call = async (person, method, path, body, raw = false) => {
    const [, email, role] = PEOPLE[person]
    const token = await sign({ id: email, role, roles: [role], tenantId: 'school-a', name: person, exp: Math.floor(Date.now() / 1000) + 600 }, SECRET)
    const isForm = body instanceof FormData
    const headers = { Authorization: `Bearer ${token}`, ...(isForm ? {} : { 'Content-Type': 'application/json' }) }
    const response = await worker.fetch(new Request(`https://ndovera.com${path}`, { method, headers, body: body ? (isForm ? body : JSON.stringify(body)) : undefined }), env, { waitUntil() {}, passThroughOnException() {} })
    if (raw) return response
    return { status: response.status, body: await response.json().catch(() => ({})) }
  }
  return { db, call, addPerson, uploads }
}

test('a teacher reports first aid with a photo; the HoS manages it until a nurse joins; parents see their child only', async () => {
  const { call, addPerson } = await setup()
  const reported = await call('teacher', 'POST', '/api/health/incidents', {
    studentId: 'ada', complaint: 'Grazed knee in the playground', category: 'injury', location: 'Playground', severity: 'minor',
    firstAidGiven: 'Cleaned the wound and applied a plaster', description: 'Fell during break',
  })
  assert.equal(reported.status, 201, JSON.stringify(reported.body))
  const id = reported.body.id

  const form = new FormData()
  form.append('file', new File([new Uint8Array([1, 2, 3])], 'knee.jpg', { type: 'image/jpeg' }))
  const photo = await call('teacher', 'POST', `/api/health/incidents/${id}/photos`, form)
  assert.equal(photo.status, 201, JSON.stringify(photo.body))
  const badForm = new FormData()
  badForm.append('file', new File(['x'], 'notes.pdf', { type: 'application/pdf' }))
  assert.equal((await call('teacher', 'POST', `/api/health/incidents/${id}/photos`, badForm)).status, 400)

  // Teachers see their own reports only, and no histories; they cannot manage.
  assert.equal((await call('teacher', 'GET', '/api/health/incidents')).body.incidents.length, 1)
  assert.equal((await call('teacher2', 'GET', '/api/health/incidents')).body.incidents.length, 0)
  assert.equal((await call('teacher', 'GET', '/api/health/students/ada')).status, 403)
  assert.equal((await call('teacher', 'PUT', `/api/health/incidents/${id}`, { outcome: 'sent_home' })).status, 403)
  assert.equal((await call('teacher2', 'GET', `/api/health/incidents/${id}`)).status, 404)

  // No nurse: the HoS manages, rests the child and records the outcome.
  assert.equal((await call('hos', 'POST', `/api/health/incidents/${id}/rest`, { action: 'start' })).status, 200)
  assert.equal((await call('hos', 'POST', `/api/health/incidents/${id}/rest`, { action: 'end' })).status, 200)
  assert.equal((await call('hos', 'PUT', `/api/health/incidents/${id}`, { outcome: 'rested_then_class', parentNotified: true, parentNotifiedHow: 'Phone call', followUpNeeded: true, followUpDate: '2000-01-01', followUpNotes: 'Check the dressing', nurseNotes: 'Internal note' })).status, 200)

  // A nurse joins: the nurse takes everything; the Owner and HoS keep seeing it all.
  PEOPLE.nurse = ['nur', 'nurse@a.test', 'clinic', {}]
  await addPerson(PEOPLE.nurse)
  assert.equal((await call('hos', 'PUT', `/api/health/incidents/${id}`, { status: 'closed' })).status, 403)
  assert.equal((await call('nurse', 'PUT', `/api/health/incidents/${id}`, { medication: 'Paracetamol 250 mg at 10:30' })).status, 200)
  assert.equal((await call('nurse', 'PUT', '/api/health/students/ada/profile', { allergies: 'Peanuts', bloodGroup: 'O+', genotype: 'AA' })).status, 200)
  const history = await call('owner', 'GET', '/api/health/students/ada')
  assert.equal(history.status, 200)
  const record = history.body.incidents[0]
  assert.deepEqual([record.outcome, record.medication, record.nurseNotes, record.givenByName, record.photos.length], ['rested_then_class', 'Paracetamol 250 mg at 10:30', 'Internal note', 'teacher', 1])
  assert.equal(typeof record.restMinutes, 'number')
  assert.equal(history.body.profile.allergies, 'Peanuts')

  // Bells: the school sees follow-ups due; the parent sees the child was seen.
  const nurseBell = await call('nurse', 'GET', '/api/header/clinic')
  assert.ok(nurseBell.body.notificationItems.some(item => /Follow-up due: ADA/.test(item.title)), JSON.stringify(nurseBell.body.notificationItems))
  const parentBell = await call('parent', 'GET', '/api/header/parent')
  assert.ok(parentBell.body.notificationItems.some(item => item.title === 'ADA was seen for grazed knee in the playground at school'))

  // The parent sees their child's history (without the school's internal notes) and the photo.
  const mine = await call('parent', 'GET', '/api/health/mine')
  assert.equal(mine.body.children[0].incidents[0].nurseNotes, '')
  assert.equal(mine.body.children[0].profile.bloodGroup, 'O+')
  const picture = await call('parent', 'GET', mine.body.children[0].incidents[0].photos[0].url, undefined, true)
  assert.equal(picture.status, 200)
  assert.equal(picture.headers.get('Content-Type'), 'image/jpeg')
  assert.equal((await call('otherParent', 'GET', mine.body.children[0].incidents[0].photos[0].url, undefined, true)).status, 404)
  assert.equal((await call('otherParent', 'GET', '/api/health/students/ada')).status, 403)
  delete PEOPLE.nurse
})
