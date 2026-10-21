import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { sign } from '@tsndr/cloudflare-worker-jwt'
import { D1Shim, createLegacySchema } from './d1-shim.mjs'

// Ndovera's own finances: payments received (when, how much, by whom), what schools owe,
// money out, reminders to owners, and shareholders who can read but never change anything.

const SECRET = 'platform-finance-secret'
let generation = 0

async function setup() {
  const worker = (await import(`./build/worker.mjs?platform-finance=${generation++}`)).default
  const db = new D1Shim()
  createLegacySchema(db)
  for (const statement of readFileSync(new URL('../d1/schema.sql', import.meta.url), 'utf8').split(';')) {
    if (/CREATE TABLE IF NOT EXISTS/i.test(statement)) { try { db.db.exec(statement) } catch {} }
  }
  const now = new Date().toISOString()
  for (const [id, name, phone] of [['school-a', 'Genesis International School', '08031234567'], ['school-b', 'Bright Future Academy', '']]) {
    db.db.prepare(`INSERT INTO tenants (id, school_name, school_slug, owner_name, owner_email, owner_phone, plan_key, requested_subdomain, website_domain, status, approval_status, payment_status, website_status, setup_fee_cents, student_fee_cents, created_at, updated_at, activated_at)
      VALUES (?, ?, ?, 'Mrs Owner', ?, ?, 'growth', ?, ?, 'active', 'approved', 'paid', 'active', 5000000, 50000, ?, ?, ?)`).run(id, name, id, `owner@${id}.test`, phone, id, `${id}.ndovera.com`, now, now, now)
  }
  await db.prepare('INSERT INTO users (id, email, name, role, tenantId, status) VALUES (?, ?, ?, ?, ?, ?)').bind('ami-1', 'ami@ndovera.test', 'Ami Admin', 'ami', null, 'active').run()
  await db.prepare('INSERT INTO settings (studentId, payload) VALUES (?, ?)').bind('ami@ndovera.test', JSON.stringify({ name: 'Ami Admin', email: 'ami@ndovera.test', role: 'ami', roles: ['ami'], status: 'active' })).run()
  const emails = []
  const env = { APP_DB: db, JWT_SECRET: SECRET, ZOHO_MAIL_ACCOUNT_ID: '123', ZOHO_MAIL_FROM_ADDRESS: 'no-reply@ndovera.com', ZOHO_MAIL_CLIENT_ID: 'id', ZOHO_MAIL_CLIENT_SECRET: 'secret', ZOHO_MAIL_REFRESH_TOKEN: 'refresh' }
  globalThis.fetch = async (url, init = {}) => {
    const target = String(url)
    if (target.startsWith('https://accounts.zoho.com/')) return new Response(JSON.stringify({ access_token: 'token' }), { status: 200 })
    if (target.startsWith('https://mail.zoho.com/')) { emails.push(JSON.parse(init.body)); return new Response('{}', { status: 200 }) }
    throw new Error(`unexpected fetch ${target}`)
  }
  const call = async (who, method, path, body) => {
    const headers = { 'Content-Type': 'application/json' }
    if (who) headers.Authorization = `Bearer ${await sign({ id: who.id, email: who.email, role: who.role, roles: [who.role], name: who.name, exp: Math.floor(Date.now() / 1000) + 600 }, SECRET)}`
    const response = await worker.fetch(new Request(`https://ndovera.com${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined }), env, { waitUntil() {}, passThroughOnException() {} })
    return { status: response.status, body: await response.json().catch(() => ({})) }
  }
  const ami = { id: 'ami-1', email: 'ami@ndovera.test', role: 'ami', name: 'Ami Admin' }
  // Bills: Genesis paid onboarding + first term; Bright Future owes a sent, overdue term bill.
  db.db.exec(`CREATE TABLE IF NOT EXISTS school_sessions (id TEXT PRIMARY KEY, tenantId TEXT, session TEXT, term TEXT, startDate TEXT, endDate TEXT, createdAt TEXT)`)
  db.db.exec(`INSERT INTO school_sessions (id, tenantId, session, term, createdAt) VALUES ('s1', 'school-a', '2026/2027', 'First Term', '2026-09-01'), ('s2', 'school-b', '2026/2027', 'First Term', '2026-09-01')`)
  await call(ami, 'GET', '/api/ami/tenants/term-bills') // creates the table
  const paidAt = new Date(Date.now() - 2 * 86400000).toISOString()
  db.db.exec(`
    INSERT INTO tenant_term_bills (id, tenant_id, session, term, billable_users, rate_cents, amount_cents, status, term_started_at, due_at, grace_until, paid_at, paid_reference, created_at, updated_at, onboarding_cents, paid_by, receipt_no)
      VALUES ('bill-a', 'school-a', '2026/2027', 'First Term', 115, 50000, 10750000, 'paid', '${paidAt}', '${paidAt}', '${paidAt}', '${paidAt}', 'Flutterwave 777', '${paidAt}', '${paidAt}', 5000000, 'Flutterwave — Mrs Owner · owner@school-a.test', 'RCT-1');
    INSERT INTO tenant_term_bills (id, tenant_id, session, term, billable_users, rate_cents, amount_cents, status, term_started_at, due_at, grace_until, created_at, updated_at, pay_token, sent_at)
      VALUES ('bill-b', 'school-b', '2026/2027', 'First Term', 40, 50000, 2000000, 'unpaid', '2026-09-01T00:00:00Z', '2026-09-01T00:00:00Z', '2026-10-01T00:00:00Z', '${now}', '${now}', 'tok-b', '2026-09-02T00:00:00Z');
  `)
  return { db, call, ami, emails }
}

test('Ami sees what was paid, when and by whom, what is owed and overdue, and money out', async () => {
  const { call, ami } = await setup()
  assert.equal((await call(ami, 'POST', '/api/ami/finance/ledger', { kind: 'expense', category: 'Hosting & infrastructure', amount: 12000, description: 'Cloudflare Workers paid plan' })).status, 200)
  assert.equal((await call(ami, 'POST', '/api/ami/finance/ledger', { kind: 'expense', amount: 0, description: 'x' })).status, 400)
  const report = await call(ami, 'GET', '/api/platform/finance')
  assert.equal(report.status, 200, JSON.stringify(report.body))
  const { kpis, payments, schools, monthly, canManage } = report.body
  assert.equal(canManage, true)
  assert.deepEqual([kpis.collectedAllTime, kpis.outstanding, kpis.overdue, kpis.expenses, kpis.netAllTime], [107500, 20000, 20000, 12000, 95500])
  assert.equal(kpis.schoolsUnpaidThisTerm, 1)
  assert.deepEqual([payments[0].schoolName, payments[0].amount, payments[0].method, payments[0].kind], ['Genesis International School', 107500, 'Flutterwave', 'Onboarding + term'])
  assert.match(payments[0].recordedBy, /Mrs Owner/)
  const bright = schools.find(school => school.tenantId === 'school-b')
  assert.deepEqual([bright.outstanding, bright.overdue, bright.currentTermFee.status], [20000, 20000, 'overdue'])
  assert.ok(bright.daysOverdue > 0)
  assert.equal(monthly.length, 12)
  assert.equal(monthly.at(-1).expenses, 12000)
})

test('reminders: polite email with the pay link, once a day; WhatsApp needs the owner phone; schools with nothing sent are skipped', async () => {
  const { call, ami, emails } = await setup()
  const sent = await call(ami, 'POST', '/api/ami/finance/reminders', { tenantIds: ['school-b', 'school-a'], channel: 'email' })
  assert.equal(sent.status, 200, JSON.stringify(sent.body))
  assert.equal(sent.body.sent, 1)
  assert.match(sent.body.results.find(item => item.tenantId === 'school-a').skipped, /no unpaid bill/)
  assert.equal(emails.length, 1)
  assert.match(emails[0].subject, /Bright Future Academy/)
  assert.match(emails[0].content, /friendly reminder/)
  assert.match(emails[0].content, /invoice\/tok-b/)
  const again = await call(ami, 'POST', '/api/ami/finance/reminders', { tenantIds: ['school-b'], channel: 'email' })
  assert.equal(again.body.results[0].skipped, 'already emailed today')
  const whatsapp = await call(ami, 'POST', '/api/ami/finance/reminders', { tenantIds: ['school-b'], channel: 'whatsapp' })
  assert.equal(whatsapp.body.results[0].skipped, 'no owner phone number on file')
  const report = (await call(ami, 'GET', '/api/platform/finance')).body
  assert.equal(report.schools.find(school => school.tenantId === 'school-b').lastReminder.channel, 'email')
})

test('a shareholder signs in with the temporary password and can read the finances, but not change them', async () => {
  const { call, ami } = await setup()
  const added = await call(ami, 'POST', '/api/ami/shareholders', { name: 'Chief Investor', email: 'Investor@Example.com' })
  assert.equal(added.status, 200, JSON.stringify(added.body))
  assert.ok(added.body.temporaryPassword)
  const login = await call(null, 'POST', '/api/auth/login', { email: 'investor@example.com', password: added.body.temporaryPassword })
  assert.equal(login.status, 200, JSON.stringify(login.body))
  const holder = { id: 'investor@example.com', email: 'investor@example.com', role: 'shareholder', name: 'Chief Investor' }
  const report = await call(holder, 'GET', '/api/platform/finance')
  assert.equal(report.status, 200)
  assert.equal(report.body.canManage, false)
  assert.equal(report.body.kpis.collectedAllTime, 107500)
  assert.equal((await call(holder, 'POST', '/api/ami/finance/reminders', { tenantIds: ['school-b'] })).status, 403)
  assert.equal((await call(holder, 'POST', '/api/ami/finance/ledger', { kind: 'expense', amount: 1, description: 'x' })).status, 403)
  assert.equal((await call(holder, 'GET', '/api/ami/tenants')).status, 403)
  // Ami turns the access off.
  assert.equal((await call(ami, 'POST', `/api/ami/shareholders/${encodeURIComponent('investor@example.com')}/status`, { active: false })).status, 200)
  assert.equal((await call(ami, 'GET', '/api/ami/shareholders')).body.shareholders[0].status, 'inactive')
  // An email already used by a school account cannot become a shareholder.
  await call(null, 'GET', '/api/health').catch(() => null)
  assert.equal((await call(ami, 'POST', '/api/ami/shareholders', { name: 'X', email: 'ami@ndovera.test' })).status, 409)
})
