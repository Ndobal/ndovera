import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { sign } from '@tsndr/cloudflare-worker-jwt'
import { D1Shim, createLegacySchema } from './d1-shim.mjs'

// Ndovera's invoices to schools: prepared as drafts by Ami, sent only when Ami presses Send
// to the school's communication email, paid by link through Flutterwave, receipt emailed.

const SECRET = 'invoice-test-secret'
let generation = 0
const PEOPLE = {
  owner: ['own', 'wrong@signup.test', ['owner'], 'school-a'],
  hos: ['hos', 'hos@a.test', ['hos'], 'school-a'],
  ict: ['ict', 'ict@a.test', ['ict'], 'school-a'],
  teacher: ['tee', 'tee@a.test', ['teacher'], 'school-a'],
  ami: ['ami-1', 'ami@ndovera.test', ['ami'], ''],
}

async function setup({ paidAmount = null } = {}) {
  const worker = (await import(`./build/worker.mjs?invoices=${generation++}`)).default
  const db = new D1Shim()
  createLegacySchema(db)
  const schema = readFileSync(new URL('../d1/schema.sql', import.meta.url), 'utf8')
  db.db.exec(schema.match(/CREATE TABLE IF NOT EXISTS tenants \([\s\S]*?\);/)[0])
  const now = new Date().toISOString()
  db.db.prepare(`INSERT INTO tenants (id, school_name, school_slug, owner_name, owner_email, plan_key, requested_subdomain, website_domain, status, approval_status, payment_status, website_status, setup_fee_cents, student_fee_cents, created_at, updated_at, activated_at)
    VALUES ('school-a', 'Genesis International School', 'genesis', 'Owner', 'wrong@signup.test', 'growth', 'genesis', 'genesis.ndovera.com', 'active', 'approved', 'paid', 'active', 5000000, 50000, ?, ?, ?)`).run(now, now, now)
  for (const [id, email, roles, tenant] of Object.values(PEOPLE)) {
    await db.prepare('INSERT INTO users (id, email, name, role, tenantId, status) VALUES (?, ?, ?, ?, ?, ?)').bind(id, email, id.toUpperCase(), roles[0], tenant || null, 'active').run()
    await db.prepare('INSERT INTO settings (studentId, payload) VALUES (?, ?)').bind(email, JSON.stringify({ name: id.toUpperCase(), email, role: roles[0], roles, tenantId: tenant, schoolId: tenant, status: 'active' })).run()
  }
  for (let i = 0; i < 3; i += 1) await db.prepare('INSERT INTO users (id, email, name, role, tenantId, status) VALUES (?, ?, ?, ?, ?, ?)').bind(`stu${i}`, `stu${i}@a.test`, `S${i}`, 'student', 'school-a', 'active').run()
  await db.prepare('INSERT INTO users (id, email, name, role, tenantId, status) VALUES (?, ?, ?, ?, ?, ?)').bind('gone', 'gone@a.test', 'Gone', 'student', 'school-a', 'inactive').run()

  const env = { APP_DB: db, JWT_SECRET: SECRET, ZOHO_MAIL_ACCOUNT_ID: '123', ZOHO_MAIL_FROM_ADDRESS: 'no-reply@ndovera.com', ZOHO_MAIL_CLIENT_ID: 'id', ZOHO_MAIL_CLIENT_SECRET: 'secret', ZOHO_MAIL_REFRESH_TOKEN: 'refresh', FLUTTERWAVE_SECRET_KEY: 'flw', FLUTTERWAVE_WEBHOOK_HASH: 'hook' }
  const emails = []
  const checkouts = []
  globalThis.fetch = async (url, init = {}) => {
    const target = String(url)
    if (target.startsWith('https://accounts.zoho.com/')) return new Response(JSON.stringify({ access_token: 'token' }), { status: 200 })
    if (target.startsWith('https://mail.zoho.com/')) { emails.push(JSON.parse(init.body)); return new Response('{}', { status: 200 }) }
    if (target === 'https://api.flutterwave.com/v3/payments') { const body = JSON.parse(init.body); checkouts.push(body); return new Response(JSON.stringify({ status: 'success', data: { link: 'https://checkout.flutterwave.test/pay' } }), { status: 200 }) }
    if (target.startsWith('https://api.flutterwave.com/v3/transactions/verify_by_reference')) {
      const txRef = new URL(target).searchParams.get('tx_ref')
      const amount = paidAmount ?? Number(checkouts.at(-1)?.amount || 0)
      return new Response(JSON.stringify({ status: 'success', data: { id: 777, status: 'successful', currency: 'NGN', amount, tx_ref: txRef } }), { status: 200 })
    }
    throw new Error(`unexpected fetch ${target}`)
  }
  const call = async (person, method, path, body, headers = {}) => {
    const auth = person ? { Authorization: `Bearer ${await (async () => { const [, id, roles, tenantId] = PEOPLE[person]; return sign({ id, role: roles[0], roles, tenantId, name: id.toUpperCase(), exp: Math.floor(Date.now() / 1000) + 600 }, SECRET) })()}` } : {}
    const response = await worker.fetch(new Request(`https://ndovera.com${path}`, { method, headers: { 'Content-Type': 'application/json', ...auth, ...headers }, body: body ? JSON.stringify(body) : undefined }), env, { waitUntil() {}, passThroughOnException() {} })
    return { status: response.status, body: await response.json().catch(() => ({})) }
  }
  return { db, call, emails, checkouts }
}

test('the communication email: Ami or the Owner/HoS set it, teachers cannot, and Ndovera writes there', async () => {
  const { call } = await setup()
  assert.equal((await call('teacher', 'PUT', '/api/tenants/contact-email', { contactEmail: 'x@y.test' })).status, 403)
  assert.equal((await call('owner', 'PUT', '/api/tenants/contact-email', { contactEmail: 'not-an-email' })).status, 400)
  const saved = await call('ami', 'PUT', '/api/ami/tenants/school-a/contact-email', { contactEmail: 'Genesisintersch2013@mail.com' })
  assert.equal(saved.status, 200, JSON.stringify(saved.body))
  assert.equal(saved.body.sendsTo, 'genesisintersch2013@mail.com')
  const mine = await call('owner', 'GET', '/api/tenants/contact-email')
  assert.deepEqual([mine.body.contactEmail, mine.body.signUpEmail], ['genesisintersch2013@mail.com', 'wrong@signup.test'])
})

test('a bill waits as a draft until Ami sends it, then has 30 days; paying by Flutterwave emails the receipt', async () => {
  const { call, db, emails, checkouts } = await setup()
  await call('ami', 'PUT', '/api/ami/tenants/school-a/contact-email', { contactEmail: 'genesisintersch2013@mail.com' })

  const prepared = await call('ami', 'POST', '/api/ami/tenants/school-a/invoices', { onboardingFee: 50000, session: '2026/2027', term: 'First Term' })
  assert.equal(prepared.status, 200, JSON.stringify(prepared.body))
  // ₦50,000 onboarding + 3 active students × ₦500.
  assert.equal(prepared.body.bill.amountCents, 5000000 + 3 * 50000)
  assert.equal(prepared.body.bill.status, 'draft')
  assert.equal(emails.length, 0, 'nothing is sent while it is a draft')
  assert.equal((await call('owner', 'GET', '/api/tenants/term-bills')).body.bills.length, 0, 'the school does not see a draft')
  assert.equal((await call(null, 'GET', `/api/public/invoices/${prepared.body.bill.payToken}`)).status, 404)
  assert.equal((await call('owner', 'POST', `/api/ami/tenants/term-bills/${prepared.body.bill.id}/send`)).status, 403)

  const preview = await call('ami', 'GET', `/api/ami/tenants/term-bills/${prepared.body.bill.id}/invoice`)
  assert.match(preview.body.html, /NDOVERA/)
  assert.match(preview.body.html, /support@ndovera\.com/)
  assert.match(preview.body.html, /\+234 812 888 2800/)

  const sent = await call('ami', 'POST', `/api/ami/tenants/term-bills/${prepared.body.bill.id}/send`)
  assert.equal(sent.status, 200, JSON.stringify(sent.body))
  assert.equal(emails.length, 1)
  assert.equal(emails[0].toAddress, 'genesisintersch2013@mail.com')
  assert.match(emails[0].content, /Pay ₦51,500\.00 now/)
  const days = (new Date(sent.body.dueAt) - Date.now()) / 86400000
  assert.ok(days > 29.9 && days <= 30, `due in 30 days, got ${days}`)

  // Not overdue yet: nobody is blocked.
  const ownerBills = await call('owner', 'GET', '/api/tenants/term-bills')
  assert.equal(ownerBills.body.overdue, null)
  assert.equal(ownerBills.body.bills.length, 1)
  assert.ok(ownerBills.body.bills[0].payUrl.endsWith(`/invoice/${prepared.body.bill.payToken}`))

  // The school pays from the link.
  const token = prepared.body.bill.payToken
  const pub = await call(null, 'GET', `/api/public/invoices/${token}`)
  assert.equal(pub.body.invoice.schoolName, 'Genesis International School')
  const checkout = await call(null, 'POST', `/api/public/invoices/${token}/checkout`)
  assert.equal(checkout.body.link, 'https://checkout.flutterwave.test/pay')
  assert.equal(checkouts[0].amount, '51500.00')
  const confirmed = await call(null, 'POST', `/api/public/invoices/${token}/confirm`, { txRef: checkout.body.txRef })
  assert.equal(confirmed.body.paid, true, JSON.stringify(confirmed.body))
  assert.equal(confirmed.body.invoice.status, 'paid')
  assert.match(confirmed.body.invoice.receiptNo, /^NDV-RCT-/)
  assert.equal(emails.length, 2, 'the receipt is emailed')
  assert.match(emails[1].subject, /receipt/i)
  assert.match(emails[1].content, /OFFICIAL PAYMENT RECEIPT/)

  // The webhook arriving later does not pay or email twice.
  const hook = await call(null, 'POST', '/api/webhooks/payments/flutterwave', { data: { tx_ref: checkout.body.txRef } }, { 'verif-hash': 'hook' })
  assert.equal(hook.status, 200)
  assert.equal(emails.length, 2)
  const row = await db.prepare('SELECT status, receipt_sent_at FROM tenant_term_bills').first()
  assert.equal(row.status, 'paid')
  assert.ok(row.receipt_sent_at)
})

test('an underpayment does not settle the bill, and an unpaid bill past 30 days locks only Owner, HoS and ICT', async () => {
  const { call, db, emails } = await setup({ paidAmount: 100 })
  const prepared = await call('ami', 'POST', '/api/ami/tenants/school-a/invoices', { onboardingFee: 50000, session: '2026/2027', term: 'First Term' })
  await call('ami', 'POST', `/api/ami/tenants/term-bills/${prepared.body.bill.id}/send`)
  assert.equal(emails[0].toAddress, 'wrong@signup.test', 'with no communication email it goes to the sign-up email')
  const token = prepared.body.bill.payToken
  const checkout = await call(null, 'POST', `/api/public/invoices/${token}/checkout`)
  const confirmed = await call(null, 'POST', `/api/public/invoices/${token}/confirm`, { txRef: checkout.body.txRef })
  assert.equal(confirmed.body.paid, false)

  await db.prepare('UPDATE tenant_term_bills SET grace_until = ?').bind(new Date(Date.now() - 1000).toISOString()).run()
  const bills = await call('owner', 'GET', '/api/tenants/term-bills')
  assert.ok(bills.body.overdue)
  assert.deepEqual(bills.body.blockedRoles.sort(), ['hos', 'ict', 'ict_manager', 'owner'])
})
