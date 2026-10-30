import test from 'node:test'
import assert from 'node:assert/strict'
import { sign } from '@tsndr/cloudflare-worker-jwt'
import { D1Shim, createLegacySchema } from './d1-shim.mjs'

// The premium upgrade through the real Worker and a real database: premises security
// and Help Centre articles create their own tables, work end to end, and never let one
// school see another's records.

const SECRET = 'premium-integration-secret'
let generation = 0

async function setup() {
  const worker = (await import(`./build/worker.mjs?premium=${generation++}`)).default
  const db = new D1Shim()
  createLegacySchema(db)
  db.db.exec(`CREATE TABLE IF NOT EXISTS tenants (id TEXT PRIMARY KEY, requested_subdomain TEXT, website_domain TEXT, school_name TEXT)`)
  db.db.exec(`INSERT INTO tenants (id, requested_subdomain, school_name) VALUES ('school-a', 'greenfield', 'Greenfield School'), ('school-b', 'hilltop', 'Hilltop School')`)
  const people = {
    cso: ['cso', 'cso@a.ng', 'chiefsecurityofficer', 'school-a'], guard: ['guard', 'guard@a.ng', 'securityofficer', 'school-a'],
    owner: ['own', 'own@a.ng', 'owner', 'school-a'], hos: ['hos', 'hos@a.ng', 'hos', 'school-a'], student: ['stu', 'stu@a.ng', 'student', 'school-a'],
    otherCso: ['cso-b', 'cso@b.ng', 'chiefsecurityofficer', 'school-b'], otherOwner: ['own-b', 'own@b.ng', 'owner', 'school-b'],
  }
  for (const [id, email, role, tenantId] of Object.values(people)) {
    await db.prepare('INSERT INTO users (id, email, name, role, tenantId, status) VALUES (?, ?, ?, ?, ?, ?)').bind(id, email, id.toUpperCase(), role, tenantId, 'active').run()
    await db.prepare('INSERT INTO settings (studentId, payload) VALUES (?, ?)').bind(email, JSON.stringify({ id, name: id.toUpperCase(), email, role, primaryRole: role, roles: [role], tenantId, status: 'active' })).run()
  }
  const call = async (person, method, path, body) => {
    const [id, email, role, tenantId] = people[person]
    const token = await sign({ id, email, role, roles: [role], tenantId, name: id.toUpperCase(), exp: Math.floor(Date.now() / 1000) + 600 }, SECRET)
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'X-Selected-Role': role }
    const response = await worker.fetch(new Request(`https://ndovera.com${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined }), { APP_DB: db, JWT_SECRET: SECRET }, { waitUntil() {}, passThroughOnException() {} })
    return { status: response.status, body: await response.json().catch(() => ({})) }
  }
  return { db, call }
}

test('premises security: tables appear on first use, records stay inside their school', async () => {
  const { call, db } = await setup()
  const first = await call('cso', 'GET', '/api/premises-security/checkpoints')
  assert.equal(first.status, 200, JSON.stringify(first.body))
  assert.ok(db.db.prepare(`SELECT name FROM sqlite_master WHERE name = 'premises_security_records'`).get())

  const checkpoint = await call('cso', 'POST', '/api/premises-security/checkpoints', { name: 'Main gate', location: 'North entrance' })
  assert.equal(checkpoint.status, 201, JSON.stringify(checkpoint.body))
  assert.equal((await call('guard', 'POST', '/api/premises-security/checkpoints', { name: 'Back gate', location: 'South' })).status, 403)

  const own = await call('cso', 'GET', '/api/premises-security/checkpoints')
  assert.deepEqual(own.body.checkpoints.map(item => item.name), ['Main gate'])
  // Another school's security chief sees none of it.
  const other = await call('otherCso', 'GET', '/api/premises-security/checkpoints')
  assert.deepEqual([other.status, other.body.checkpoints.length], [200, 0])
  // Students never reach security records.
  assert.equal((await call('student', 'GET', '/api/premises-security/checkpoints')).status, 403)
})

test('help articles: tables appear on first use; drafts reviewed by someone else, published only to their school', async () => {
  const { call } = await setup()
  const empty = await call('student', 'GET', '/api/help/articles/published')
  assert.deepEqual([empty.status, empty.body.articles], [200, []])
  assert.equal((await call('student', 'GET', '/api/help/articles/editor')).status, 403)

  const draft = await call('owner', 'POST', '/api/help/articles/editor', {
    title: 'How to pay school fees', category: 'Fees', keywords: ['fees', 'pay'], roles: ['parent', 'student'],
    steps: ['Open Fees from the menu.', 'Choose the term you are paying for.', 'Pay by bank transfer and upload the receipt.'],
  })
  assert.equal(draft.status, 201, JSON.stringify(draft.body))
  const revisionId = draft.body.id || draft.body.revisionId
  assert.ok(revisionId, JSON.stringify(draft.body))
  // The author cannot approve their own article; the Head of School can.
  assert.equal((await call('owner', 'PATCH', `/api/help/articles/editor/${revisionId}/state`, { state: 'in_review' })).status, 200)
  assert.equal((await call('owner', 'PATCH', `/api/help/articles/editor/${revisionId}/state`, { state: 'approved' })).status, 409)
  assert.equal((await call('hos', 'PATCH', `/api/help/articles/editor/${revisionId}/state`, { state: 'approved' })).status, 200)
  const published = await call('hos', 'PATCH', `/api/help/articles/editor/${revisionId}/state`, { state: 'published' })
  assert.equal(published.status, 200, JSON.stringify(published.body))

  const seen = await call('student', 'GET', '/api/help/articles/published')
  assert.deepEqual(seen.body.articles.map(article => article.title), ['How to pay school fees'])
  // Another school does not see it.
  assert.deepEqual((await call('otherOwner', 'GET', '/api/help/articles/published')).body.articles, [])
})
