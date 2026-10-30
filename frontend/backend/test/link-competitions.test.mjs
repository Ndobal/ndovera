import test from 'node:test'
import assert from 'node:assert/strict'
import { sign } from '@tsndr/cloudflare-worker-jwt'
import { D1Shim, createLegacySchema } from './d1-shim.mjs'

// Competitions shared by link: schools and Ndovera write them up; only an active one gets a
// link; only the link shows it; a new link kills the old; entries are checked and kept private.

const SECRET = 'link-competition-secret'

async function setup() {
  const worker = (await import('./build/worker.mjs?linkcomp=1')).default
  const db = new D1Shim()
  createLegacySchema(db)
  db.db.exec(`CREATE TABLE IF NOT EXISTS tenants (id TEXT PRIMARY KEY, requested_subdomain TEXT, website_domain TEXT, school_name TEXT)`)
  db.db.exec(`INSERT INTO tenants (id, requested_subdomain, school_name) VALUES ('school-a', 'greenfield', 'Greenfield School'), ('school-b', 'hilltop', 'Hilltop School')`)
  const people = { owner: ['own', 'own@a.ng', 'owner', 'school-a'], hos: ['hos', 'hos@a.ng', 'hos', 'school-a'], teacher: ['tea', 'tea@a.ng', 'teacher', 'school-a'], otherOwner: ['own-b', 'own@b.ng', 'owner', 'school-b'], ami: ['ami', 'ami@ndovera.com', 'ami', null] }
  for (const [id, email, role, tenantId] of Object.values(people)) {
    await db.prepare('INSERT INTO users (id, email, name, role, tenantId, status) VALUES (?, ?, ?, ?, ?, ?)').bind(id, email, id, role, tenantId, 'active').run()
    await db.prepare('INSERT INTO settings (studentId, payload) VALUES (?, ?)').bind(email, JSON.stringify({ id, email, role, roles: [role], tenantId })).run()
  }
  const call = async (person, method, path, body, ip = '1.1.1.1') => {
    const headers = { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 Chrome/130', 'CF-Connecting-IP': ip }
    if (person) {
      const [id, email, role, tenantId] = people[person]
      headers.Authorization = `Bearer ${await sign({ id, email, role, roles: [role], tenantId, exp: Math.floor(Date.now() / 1000) + 600 }, SECRET)}`
      headers['X-Selected-Role'] = role
    }
    const response = await worker.fetch(new Request(`https://ndovera.com${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined }), { APP_DB: db, JWT_SECRET: SECRET }, { waitUntil() {}, passThroughOnException() {} })
    const text = await response.text()
    let json = {}
    try { json = JSON.parse(text) } catch {}
    return { status: response.status, body: json, text, headers: response.headers }
  }
  return { call }
}

const COMPETITION = {
  title: 'Inter-house Spelling Bee', summary: 'Open to JSS students in Ikeja.', details: 'Three rounds.', prizes: 'Laptop for the winner',
  fliers: ['https://ndovera.com/files/competitions/abc.jpg', 'https://evil.example/x.jpg'],
  standardFields: ['phone', 'school'],
  fields: [{ key: 'phone', required: true }, { label: 'Which house?', type: 'choice', options: 'Red, Blue', required: true }],
}

test('a school writes up a competition; only an active one gets a link; only the link shows it', async () => {
  const { call } = await setup()
  assert.equal((await call('teacher', 'GET', '/api/link-competitions')).status, 403)
  const created = await call('owner', 'POST', '/api/link-competitions', COMPETITION)
  assert.equal(created.status, 200, created.text)
  const id = created.body.id
  const [listed] = (await call('hos', 'GET', '/api/link-competitions')).body.competitions
  assert.deepEqual([listed.title, listed.hostName, listed.status, listed.fliers], ['Inter-house Spelling Bee', 'Greenfield School', 'draft', ['https://ndovera.com/files/competitions/abc.jpg']])
  assert.deepEqual(listed.fields.map(field => [field.key, field.required]), [['fullName', true], ['phone', true], ['school', false], ['q1', true]])
  // Another school cannot see or touch it.
  assert.deepEqual((await call('otherOwner', 'GET', '/api/link-competitions')).body.competitions, [])
  assert.equal((await call('otherOwner', 'POST', `/api/link-competitions/${id}/link`)).status, 404)

  // No link while a draft.
  assert.equal((await call('owner', 'POST', `/api/link-competitions/${id}/link`)).status, 409)
  await call('owner', 'POST', `/api/link-competitions/${id}/status`, { status: 'active' })
  const first = (await call('owner', 'POST', `/api/link-competitions/${id}/link`)).body.token
  assert.match(first, /^[A-Za-z0-9_-]{24}$/)
  const page = await call(null, 'GET', `/api/public/link-competition/${first}`)
  assert.equal(page.status, 200, page.text)
  assert.equal(page.headers.get('x-robots-tag'), 'noindex, nofollow')
  assert.deepEqual([page.body.competition.title, page.body.competition.hostName, page.body.entriesOpen], ['Inter-house Spelling Bee', 'Greenfield School', true])
  assert.equal(page.body.competition.id, undefined) // nothing internal leaks
  assert.equal(page.body.competition.linkToken, undefined)
  assert.equal((await call(null, 'GET', '/api/public/link-competition/guessed-token-1234567890')).status, 404)

  // A new link kills the old one.
  const second = (await call('owner', 'POST', `/api/link-competitions/${id}/link`)).body.token
  assert.notEqual(second, first)
  assert.equal((await call(null, 'GET', `/api/public/link-competition/${first}`)).status, 404)
  assert.equal((await call(null, 'GET', `/api/public/link-competition/${second}`)).status, 200)
  await call('owner', 'DELETE', `/api/link-competitions/${id}/link`)
  assert.equal((await call(null, 'GET', `/api/public/link-competition/${second}`)).status, 404)
})

test('entries: required fields and choices checked, no duplicates, robots ignored, closed means closed; CSV for the school', async () => {
  const { call } = await setup()
  const id = (await call('owner', 'POST', '/api/link-competitions', COMPETITION)).body.id
  await call('owner', 'POST', `/api/link-competitions/${id}/status`, { status: 'active' })
  const token = (await call('owner', 'POST', `/api/link-competitions/${id}/link`)).body.token
  const enter = (answers, extra = {}, ip) => call(null, 'POST', `/api/public/link-competition/${token}/entries`, { answers, ...extra }, ip)

  assert.match((await enter({ fullName: 'Ada Obi', q1: 'Red' })).body.error, /Phone number/)
  assert.match((await enter({ fullName: 'Ada Obi', phone: '0803', q1: 'Green' })).body.error, /options/)
  assert.equal((await enter({ fullName: 'Ada Obi', phone: '08031234567', q1: 'Red', school: 'Greenfield' })).status, 200)
  assert.equal((await enter({ fullName: 'Ada again', phone: '08031234567', q1: 'Blue' })).status, 409)
  // A spam robot filling the hidden field is accepted quietly but stored nowhere.
  assert.equal((await enter({ fullName: 'Bot', phone: '1', q1: 'Red' }, { website: 'http://spam' })).status, 200)

  const entries = (await call('hos', 'GET', `/api/link-competitions/${id}/entries`)).body.entries
  assert.deepEqual(entries.map(entry => [entry.fullName, entry.answers.q1]), [['Ada Obi', 'Red']])
  const csv = await call('owner', 'GET', `/api/link-competitions/${id}/entries?format=csv`)
  assert.match(csv.text, /"Full name","Phone number","School","Which house\?","Entered at"/)
  assert.match(csv.text, /"Ada Obi","08031234567","Greenfield","Red"/)

  // Closed: the details still show, but no more entries.
  await call('owner', 'POST', `/api/link-competitions/${id}/status`, { status: 'closed' })
  const closed = await call(null, 'GET', `/api/public/link-competition/${token}`)
  assert.deepEqual([closed.status, closed.body.entriesOpen], [200, false])
  assert.equal((await enter({ fullName: 'Late', phone: '0809', q1: 'Red' })).status, 409)
})

test('Ndovera (Ami) runs its own competitions, apart from any school', async () => {
  const { call } = await setup()
  const id = (await call('ami', 'POST', '/api/link-competitions', { title: 'Ndovera National Quiz' })).body.id
  await call('ami', 'POST', `/api/link-competitions/${id}/status`, { status: 'active' })
  const token = (await call('ami', 'POST', `/api/link-competitions/${id}/link`)).body.token
  assert.equal((await call(null, 'GET', `/api/public/link-competition/${token}`)).body.competition.hostName, 'Ndovera')
  assert.deepEqual((await call('owner', 'GET', '/api/link-competitions')).body.competitions, [])
})
