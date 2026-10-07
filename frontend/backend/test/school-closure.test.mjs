import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { sign } from '@tsndr/cloudflare-worker-jwt'
import { D1Shim, createLegacySchema } from './d1-shim.mjs'

// Closing a school: Owner only, 72-hour window, revocable, Ndovera alerted,
// then the whole school is closed — and Ndovera can reopen it.

const SECRET = 'closure-test-secret'
let generation = 0
const PEOPLE = {
  owner: ['own', 'owner@a.test', ['owner'], 'school-a'],
  hos: ['hos', 'hos@a.test', ['teacher', 'hos'], 'school-a'],
  teacher: ['tee', 'tee@a.test', ['teacher'], 'school-a'],
  student: ['stu', 'stu@a.test', ['student'], 'school-a'],
  otherOwner: ['own-b', 'owner@b.test', ['owner'], 'school-b'],
  ami: ['ami-1', 'ami@ndovera.test', ['ami'], ''],
}

async function setup() {
  const worker = (await import(`./build/worker.mjs?closure=${generation++}`)).default
  const db = new D1Shim()
  createLegacySchema(db)
  const schema = readFileSync(new URL('../d1/schema.sql', import.meta.url), 'utf8')
  db.db.exec(schema.match(/CREATE TABLE IF NOT EXISTS tenants \([\s\S]*?\);/)[0])
  const now = new Date().toISOString()
  for (const [id, name, sub] of [['school-a', 'Genesis International School', 'genesis'], ['school-b', 'Other School', 'other']]) {
    db.db.prepare(`INSERT INTO tenants (id, school_name, school_slug, owner_name, owner_email, plan_key, requested_subdomain, website_domain, status, approval_status, payment_status, website_status, setup_fee_cents, student_fee_cents, created_at, updated_at, activated_at)
      VALUES (?, ?, ?, 'Owner', ?, 'standard', ?, ?, 'active', 'approved', 'paid', 'active', 0, 0, ?, ?, ?)`).run(id, name, sub, `${id}@owner.test`, sub, `${sub}.ndovera.com`, now, now, now)
  }
  for (const [id, email, roles, tenant] of Object.values(PEOPLE)) {
    await db.prepare('INSERT INTO users (id, email, name, role, tenantId, status) VALUES (?, ?, ?, ?, ?, ?)').bind(id, email, id.toUpperCase(), roles[0], tenant || null, 'active').run()
    await db.prepare('INSERT INTO settings (studentId, payload) VALUES (?, ?)').bind(email, JSON.stringify({ name: id.toUpperCase(), email, role: roles[0], roles, tenantId: tenant, schoolId: tenant, status: 'active' })).run()
  }
  const env = { APP_DB: db, JWT_SECRET: SECRET, ZOHO_MAIL_ACCOUNT_ID: '123', ZOHO_MAIL_FROM_ADDRESS: 'no-reply@ndovera.com', ZOHO_MAIL_CLIENT_ID: 'id', ZOHO_MAIL_CLIENT_SECRET: 'secret', ZOHO_MAIL_REFRESH_TOKEN: 'refresh' }
  // Zoho Mail stand-in: records every message instead of sending it.
  const emails = []
  globalThis.fetch = async (url, init = {}) => {
    const target = String(url)
    if (target.startsWith('https://accounts.zoho.com/')) return new Response(JSON.stringify({ access_token: 'token' }), { status: 200 })
    if (target.startsWith('https://mail.zoho.com/')) { emails.push(JSON.parse(init.body)); return new Response('{}', { status: 200 }) }
    throw new Error(`unexpected fetch ${target}`)
  }
  const background = []
  const call = async (person, method, path, body, selectedRole) => {
    const [id, , roles, tenantId] = PEOPLE[person]
    const token = await sign({ id, role: roles[0], roles, tenantId, name: id.toUpperCase(), exp: Math.floor(Date.now() / 1000) + 600 }, SECRET)
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(selectedRole ? { 'X-Selected-Role': selectedRole } : {}) }
    const response = await worker.fetch(new Request(`https://ndovera.com${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined }), env, { waitUntil: promise => background.push(promise), passThroughOnException() {} })
    await Promise.all(background.splice(0))
    return { status: response.status, body: await response.json().catch(() => ({})) }
  }
  const runCron = async () => {
    const pending = []
    await worker.scheduled({ cron: '* * * * *', scheduledTime: Date.now() }, env, { waitUntil: promise => pending.push(promise) })
    await Promise.all(pending)
  }
  return { db, call, runCron, worker, env, emails }
}

const REQUEST = { category: 'financial', reason: 'Enrolment has fallen below what the school can sustain this year.', confirmName: 'genesis international school' }

test('only the owner can ask, with a reason and the school name typed to confirm', async () => {
  const { call } = await setup()
  assert.equal((await call('hos', 'POST', '/api/school/closure', REQUEST, 'hos')).status, 403, 'the HOS can never close the school')
  assert.equal((await call('teacher', 'POST', '/api/school/closure', REQUEST)).status, 403)
  assert.equal((await call('owner', 'POST', '/api/school/closure', { ...REQUEST, confirmName: 'Genesis' })).status, 400)
  assert.equal((await call('owner', 'POST', '/api/school/closure', { ...REQUEST, reason: 'too short' })).status, 400)
  const created = await call('owner', 'POST', '/api/school/closure', REQUEST)
  assert.equal(created.status, 201, JSON.stringify(created.body))
  const hours = (Date.parse(created.body.closure.effectiveAt) - Date.parse(created.body.closure.requestedAt)) / 3600000
  assert.equal(hours, 72)
  assert.equal((await call('owner', 'POST', '/api/school/closure', REQUEST)).status, 409, 'one at a time')
})

test('Ndovera admins are alerted, can acknowledge, and see it in their header', async () => {
  const { call } = await setup()
  await call('owner', 'POST', '/api/school/closure', REQUEST)
  assert.equal((await call('owner', 'GET', '/api/ami/school-closures')).status, 403)
  const list = await call('ami', 'GET', '/api/ami/school-closures')
  assert.deepEqual(list.body.closures.map(item => [item.schoolName, item.status]), [['Genesis International School', 'pending']])
  const amiHeader = await call('ami', 'GET', '/api/header/ami')
  assert.ok(amiHeader.body.notificationItems.some(item => item.category === 'school_closure' && /Genesis International School/.test(item.title) && item.unread))
  const ownerHeader = await call('owner', 'GET', '/api/header/owner')
  assert.ok(ownerHeader.body.notificationItems.some(item => item.category === 'school_closure'))
  const acknowledged = await call('ami', 'POST', `/api/ami/school-closures/${list.body.closures[0].id}/acknowledge`, { note: 'Called the owner.' })
  assert.equal(acknowledged.body.closure.adminNote, 'Called the owner.')
  // Students learn the date, not the reason.
  const seen = await call('student', 'GET', '/api/school/closure')
  assert.equal(seen.body.closure.status, 'pending')
  assert.equal(seen.body.closure.reason, undefined)
})

test('within 72 hours the owner can revoke; nothing closes', async () => {
  const { call, runCron, db } = await setup()
  await call('owner', 'POST', '/api/school/closure', REQUEST)
  const revoked = await call('owner', 'POST', '/api/school/closure/revoke', { note: 'Funding secured.' })
  assert.equal(revoked.body.closure.status, 'revoked')
  await db.prepare(`UPDATE school_closure_requests SET effective_at = ?`).bind(new Date(Date.now() - 1000).toISOString()).run()
  await runCron()
  assert.equal(db.db.prepare(`SELECT status FROM tenants WHERE id = 'school-a'`).get().status, 'active')
  assert.notEqual((await call('teacher', 'GET', '/api/school/academic/overview')).status, 403, 'the school stays open')
})

test('after 72 hours the school closes for everyone in it — and only it; Ndovera can reopen it', async () => {
  const { call, runCron, db } = await setup()
  await call('owner', 'POST', '/api/school/closure', REQUEST)
  await runCron()
  assert.equal(db.db.prepare(`SELECT status FROM tenants WHERE id = 'school-a'`).get().status, 'active', 'not before 72 hours')
  await db.prepare(`UPDATE school_closure_requests SET effective_at = ?`).bind(new Date(Date.now() - 1000).toISOString()).run()
  await runCron()
  const tenant = db.db.prepare(`SELECT status, website_status FROM tenants WHERE id = 'school-a'`).get()
  assert.deepEqual([tenant.status, tenant.website_status], ['closed', 'inactive'])

  for (const person of ['teacher', 'student', 'owner']) {
    const blocked = await call(person, 'GET', '/api/school/academic/overview')
    assert.equal(blocked.status, 403, person)
    assert.equal(blocked.body.code, 'SCHOOL_CLOSED')
  }
  const status = await call('student', 'GET', '/api/school/closure')
  assert.equal(status.status, 200)
  assert.equal(status.body.closed, true)
  assert.notEqual((await call('otherOwner', 'GET', '/api/school/academic/overview')).status, 403, 'other schools are unaffected')
  assert.equal((await call('owner', 'POST', '/api/school/closure/revoke', {})).status, 403, 'too late to revoke: blocked as closed')

  const restored = await call('ami', 'POST', '/api/ami/tenants/school-a/restore')
  assert.equal(restored.status, 200, JSON.stringify(restored.body))
  assert.notEqual((await call('teacher', 'GET', '/api/school/academic/overview')).status, 403)
  const history = db.db.prepare(`SELECT status FROM school_closure_requests`).all().map(row => row.status)
  assert.deepEqual(history, ['reopened'])
})

test('every step is emailed through Zoho: Ndovera admins and the owner, never anyone else', async () => {
  const { call, runCron, db, emails } = await setup()
  db.db.exec(`UPDATE tenants SET owner_email = 'owner@a.test' WHERE id = 'school-a'`)
  await call('owner', 'POST', '/api/school/closure', REQUEST)
  const requested = emails.splice(0)
  assert.deepEqual(requested.map(email => email.toAddress).sort(), ['ami@ndovera.test', 'owner@a.test'])
  assert.ok(requested.every(email => email.subject === 'School closure requested: Genesis International School' && email.fromAddress === 'no-reply@ndovera.com'))
  assert.match(requested.find(email => email.toAddress === 'ami@ndovera.test').content, /Enrolment has fallen/)
  assert.match(requested.find(email => email.toAddress === 'owner@a.test').content, /If you did not make this request/)

  await db.prepare(`UPDATE school_closure_requests SET effective_at = ?`).bind(new Date(Date.now() - 1000).toISOString()).run()
  await runCron()
  assert.deepEqual(emails.splice(0).map(email => email.subject), ['School closed: Genesis International School', 'School closed: Genesis International School'])
  await call('ami', 'POST', '/api/ami/tenants/school-a/restore')
  assert.deepEqual(emails.splice(0).map(email => email.subject), ['School reopened: Genesis International School', 'School reopened: Genesis International School'])
  const audit = db.db.prepare(`SELECT COUNT(*) AS n FROM audit WHERE action = 'schoolClosureEmailed'`).get()
  assert.ok(audit.n >= 3)
})

test('a mail failure never stops the closure', async () => {
  const { call, db } = await setup()
  globalThis.fetch = async () => new Response('Zoho is down', { status: 500 })
  const created = await call('owner', 'POST', '/api/school/closure', REQUEST)
  assert.equal(created.status, 201)
  const failed = db.db.prepare(`SELECT COUNT(*) AS n FROM audit WHERE action = 'schoolClosureEmailFailed'`).get()
  assert.equal(failed.n, 1)
})
