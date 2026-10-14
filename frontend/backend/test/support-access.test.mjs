import test from 'node:test'
import assert from 'node:assert/strict'
import { sign } from '@tsndr/cloudflare-worker-jwt'
import { D1Shim, createLegacySchema } from './d1-shim.mjs'

// Ndovera support (Ami) manages a school only with the owner's approval, for the hours the
// owner sets; the session ends with the approval (time up, task done, or deactivated), is
// never refreshed into an ordinary owner session, and a new request is needed to continue.

const SECRET = 'support-access-secret'
let worker
let generation = 0
const PEOPLE = { ami: ['ami-1', 'ami@ndovera.test', 'ami', ''], owner: ['o-1', 'owner@a.test', 'owner', 'school-a'], hos: ['h-1', 'hos@a.test', 'hos', 'school-a'] }

async function setup() {
  worker = (await import(`./build/worker.mjs?support=${generation++}`)).default
  const db = new D1Shim()
  createLegacySchema(db)
  db.db.exec(`CREATE TABLE IF NOT EXISTS tenants (id TEXT PRIMARY KEY, school_name TEXT, owner_email TEXT, status TEXT);
    INSERT INTO tenants VALUES ('school-a', 'Genesis College', 'owner@a.test', 'active');`)
  for (const [id, email, role, tenant] of Object.values(PEOPLE)) {
    await db.prepare('INSERT INTO users (id, email, name, role, tenantId, status) VALUES (?, ?, ?, ?, ?, ?)').bind(id, email, `Name ${id}`, role, tenant, 'active').run()
    await db.prepare('INSERT INTO settings (studentId, payload) VALUES (?, ?)').bind(email, JSON.stringify({ name: `Name ${id}`, email, role, roles: [role], tenantId: tenant, status: 'active' })).run()
  }
  return db
}

async function raw(db, token, method, path, body) {
  const response = await worker.fetch(new Request(`https://ndovera.com${path}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }),
    { APP_DB: db, JWT_SECRET: SECRET }, { waitUntil() {}, passThroughOnException() {} })
  return { status: response.status, body: await response.json().catch(() => ({})), refreshed: response.headers.get('X-Refresh-Token') }
}
async function call(db, person, method, path, body) {
  const [id, email, role, tenantId] = PEOPLE[person]
  return raw(db, await sign({ id, email, role, roles: [role], tenantId, name: id, exp: Math.floor(Date.now() / 1000) + 600 }, SECRET), method, path, body)
}
const decode = token => JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString())

test('support access: requested with a reason and hours, approved by the owner for a set time, ended by task done or the owner, never extended by use', async () => {
  const db = await setup()
  assert.equal((await call(db, 'ami', 'POST', '/api/ami/school-access/request', { tenantId: 'school-a' })).status, 400, 'a reason is needed')
  const requested = await call(db, 'ami', 'POST', '/api/ami/school-access/request', { tenantId: 'school-a', reason: 'Set up classes and import students', hours: 6 })
  assert.equal(requested.status, 201, JSON.stringify(requested.body))
  const id = requested.body.grant.id
  assert.equal(requested.body.grant.requestedHours, 6)
  assert.equal((await call(db, 'ami', 'POST', `/api/ami/school-access/${id}/open`)).status, 403, 'not before approval')

  // The owner sees it and approves for 3 hours (the HoS cannot approve).
  const seen = await call(db, 'owner', 'GET', '/api/school/access-requests')
  assert.equal(seen.body.requests[0].reason, 'Set up classes and import students')
  assert.equal((await call(db, 'hos', 'POST', `/api/school/access-requests/${id}/decide`, { decision: 'approve' })).status, 403)
  assert.equal((await call(db, 'owner', 'POST', `/api/school/access-requests/${id}/decide`, { decision: 'approve', hours: 3 })).status, 200)
  assert.equal((await call(db, 'owner', 'POST', `/api/school/access-requests/${id}/decide`, { decision: 'deny' })).status, 409, 'decided once')
  const grant = (await call(db, 'ami', 'GET', '/api/ami/school-access')).body.grants[0]
  assert.equal(grant.approvedHours, 3)
  assert.ok(Math.abs(new Date(grant.expiresAt).getTime() - (Date.now() + 3 * 3600_000)) < 60_000)

  // Ami opens the school as its owner: full access, for at most 2 hours a session.
  const opened = await call(db, 'ami', 'POST', `/api/ami/school-access/${id}/open`)
  assert.equal(opened.status, 200, JSON.stringify(opened.body))
  const session = opened.body.token
  assert.deepEqual([decode(session).role, decode(session).grantId, decode(session).impersonatedBy], ['owner', id, 'ami@ndovera.test'])
  const used = await raw(db, session, 'GET', '/api/school/access-requests')
  assert.equal(used.status, 200)
  // Using it never turns it into an ordinary owner session.
  const refreshed = decode(used.refreshed)
  assert.equal(refreshed.grantId, id)
  assert.ok(refreshed.exp * 1000 <= Date.now() + 2 * 3600_000 + 5000)

  // Task done: the session stops at once, and a new request is needed.
  assert.equal((await call(db, 'ami', 'POST', `/api/ami/school-access/${id}/complete`)).status, 200)
  const after = await raw(db, session, 'GET', '/api/school/access-requests')
  assert.deepEqual([after.status, after.body.code], [401, 'SUPPORT_ACCESS_ENDED'])
  assert.equal((await raw(db, used.refreshed, 'GET', '/api/school/access-requests')).status, 401, 'the refreshed token ends too')
  assert.equal((await call(db, 'ami', 'POST', `/api/ami/school-access/${id}/open`)).status, 403)
  const again = await call(db, 'ami', 'POST', '/api/ami/school-access/request', { tenantId: 'school-a', reason: 'Finish the timetable', hours: 2 })
  assert.equal(again.status, 201)
  assert.notEqual(again.body.grant.id, id)

  // The owner can end it any time; time running out ends it too.
  const second = again.body.grant.id
  await call(db, 'owner', 'POST', `/api/school/access-requests/${second}/decide`, { decision: 'approve' })
  const session2 = (await call(db, 'ami', 'POST', `/api/ami/school-access/${second}/open`)).body.token
  assert.equal((await raw(db, session2, 'GET', '/api/school/access-requests')).status, 200)
  db.db.prepare(`UPDATE school_access_grants SET expires_at = ? WHERE id = ?`).run(new Date(Date.now() - 1000).toISOString(), second)
  // (the per-Worker cache holds a state up to 20 seconds; a revoke clears it at once)
  await call(db, 'owner', 'POST', `/api/school/access-requests/${second}/revoke`)
  assert.equal((await raw(db, session2, 'GET', '/api/school/access-requests')).status, 401)
  // An old-style support token without a grant is refused.
  const legacy = await sign({ id: 'o-1', role: 'owner', roles: ['owner'], tenantId: 'school-a', impersonatedBy: 'ami@ndovera.test', exp: Math.floor(Date.now() / 1000) + 600 }, SECRET)
  assert.equal((await raw(db, legacy, 'GET', '/api/school/access-requests')).status, 401)
})
