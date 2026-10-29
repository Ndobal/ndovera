import test from 'node:test'
import assert from 'node:assert/strict'
import { sign } from '@tsndr/cloudflare-worker-jwt'
import { D1Shim, createLegacySchema } from './d1-shim.mjs'

// A person's roles: revoke one, swap it for another, keep the rest; never left with none.

const SECRET = 'person-roles-secret'
let generation = 0

async function setup() {
  const worker = (await import(`./build/worker.mjs?roles=${generation++}`)).default
  const db = new D1Shim()
  createLegacySchema(db)
  db.db.exec(`CREATE TABLE IF NOT EXISTS tenants (id TEXT PRIMARY KEY, requested_subdomain TEXT, website_domain TEXT, school_name TEXT)`)
  db.db.exec(`INSERT INTO tenants (id, requested_subdomain, school_name) VALUES ('school-a', 'greenfield', 'Greenfield School')`)
  const people = {
    owner: ['own', 'owner@greenfield.ng', ['owner']], ict: ['ict', 'ict@greenfield.ng', ['ict']],
    tola: ['tola', 'tola@greenfield.ng', ['teacher', 'accountant']], hos: ['hos', 'hos@greenfield.ng', ['hos']],
  }
  for (const [id, email, roles] of Object.values(people)) {
    await db.prepare('INSERT INTO users (id, email, name, role, tenantId, status) VALUES (?, ?, ?, ?, ?, ?)').bind(id, email, id.toUpperCase(), roles[0], 'school-a', 'active').run()
    await db.prepare('INSERT INTO settings (studentId, payload) VALUES (?, ?)').bind(email, JSON.stringify({ name: id.toUpperCase(), email, role: roles[0], primaryRole: roles[0], roles, tenantId: 'school-a', status: 'active' })).run()
  }
  const call = async (person, method, path, body) => {
    const [id, email, roles] = people[person]
    const token = await sign({ id, email, role: roles[0], roles, tenantId: 'school-a', name: id.toUpperCase(), exp: Math.floor(Date.now() / 1000) + 600 }, SECRET)
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'X-Selected-Role': roles[0] }
    const response = await worker.fetch(new Request(`https://ndovera.com${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined }), { APP_DB: db, JWT_SECRET: SECRET }, { waitUntil() {}, passThroughOnException() {} })
    return { status: response.status, body: await response.json().catch(() => ({})) }
  }
  const settingsOf = email => JSON.parse(db.db.prepare('SELECT payload FROM settings WHERE studentId = ?').get(email).payload)
  return { db, call, settingsOf }
}

test('a role is revoked and the other kept; swapped for another; never none', async () => {
  const { call, settingsOf } = await setup()
  // Revoke accountant, keep teacher.
  const kept = await call('ict', 'PUT', '/api/people/tola/roles', { roles: ['teacher'] })
  assert.deepEqual([kept.status, kept.body.roles, kept.body.removed], [200, ['teacher'], ['accountant']])
  assert.deepEqual(settingsOf('tola@greenfield.ng').roles, ['teacher'])
  // Swap teacher for librarian.
  const swapped = await call('ict', 'PUT', '/api/people/tola/roles', { roles: ['librarian'] })
  assert.deepEqual([swapped.body.primaryRole, swapped.body.added, swapped.body.removed], ['librarian', ['librarian'], ['teacher']])
  // No role at all is refused, with a code the screen uses to ask for one.
  const none = await call('ict', 'PUT', '/api/people/tola/roles', { roles: [] })
  assert.deepEqual([none.status, none.body.code], [400, 'role_required'])
  assert.deepEqual(settingsOf('tola@greenfield.ng').roles, ['librarian'])
})

test('owner cannot be given or taken, only the Owner touches a Head of School, nobody edits their own roles', async () => {
  const { call } = await setup()
  assert.equal((await call('ict', 'PUT', '/api/people/tola/roles', { roles: ['owner'] })).status, 400)
  assert.equal((await call('hos', 'PUT', '/api/people/own/roles', { roles: ['teacher'] })).status, 400)
  assert.equal((await call('ict', 'PUT', '/api/people/hos/roles', { roles: ['teacher'] })).status, 403)
  assert.equal((await call('ict', 'PUT', '/api/people/tola/roles', { roles: ['teacher', 'hos'] })).status, 403)
  assert.equal((await call('owner', 'PUT', '/api/people/hos/roles', { roles: ['hos', 'teacher'] })).status, 200)
  assert.equal((await call('ict', 'PUT', '/api/people/ict/roles', { roles: ['teacher'] })).status, 403)
  assert.equal((await call('tola', 'PUT', '/api/people/ict/roles', { roles: ['teacher'] })).status, 403)
})
