import test from 'node:test'
import assert from 'node:assert/strict'
import { sign } from '@tsndr/cloudflare-worker-jwt'
import { D1Shim, createLegacySchema } from './d1-shim.mjs'

// School emails carry the school's letterhead and may use its own words. A receipt goes by email once,
// from one button or one at a time, and a parent can send their own from the dashboard.

const SECRET = 'receipt-email-secret'
let generation = 0
const PEOPLE = {
  owner: ['own', 'owner@a.test', 'owner', 'school-a'],
  teacher: ['tea', 'tea@a.test', 'teacher', 'school-a'],
  parent: ['par', 'parent@a.test', 'parent', 'school-a'],
  other: ['oth', 'other@a.test', 'parent', 'school-a'],
  kid1: ['kid1', 'kid1@a.test', 'student', 'school-a'],
  kid2: ['kid2', 'kid2@a.test', 'student', 'school-a'],
  kid9: ['kid9', 'kid9@a.test', 'student', 'school-a'],
  nobody: ['nobody', 'nobody@a.test', 'student', 'school-a'],
}

async function setup() {
  const worker = (await import(`./build/worker.mjs?receipts=${generation++}`)).default
  const db = new D1Shim()
  createLegacySchema(db)
  db.db.exec(`
    DROP TABLE IF EXISTS tenants;
    CREATE TABLE tenants (id TEXT PRIMARY KEY, school_name TEXT, country TEXT, status TEXT, discount_code TEXT, owner_email TEXT, address_line TEXT, city TEXT, state TEXT);
    INSERT INTO tenants (id, school_name, status, owner_email, address_line, city) VALUES ('school-a', 'Genesis College', 'active', 'office@genesis.test', '1 School Road', 'Abuja');
    CREATE TABLE IF NOT EXISTS tenant_branding (tenant_id TEXT PRIMARY KEY, logo_url TEXT, tagline TEXT, website TEXT);
    INSERT INTO tenant_branding (tenant_id, logo_url, tagline) VALUES ('school-a', 'https://ndovera.com/files/genesis.png', 'Knowledge and Light');
    CREATE TABLE IF NOT EXISTS parent_student_links (id TEXT PRIMARY KEY, parent_id TEXT, student_id TEXT, tenant_id TEXT, created_at TEXT);
    INSERT INTO parent_student_links VALUES ('l1', 'par', 'kid1', 'school-a', 'x'), ('l2', 'par', 'kid2', 'school-a', 'x');
  `)
  for (const [id, email, role, tenant] of Object.values(PEOPLE)) {
    await db.prepare('INSERT INTO users (id, email, name, role, tenantId, status) VALUES (?, ?, ?, ?, ?, ?)').bind(id, email, id === 'par' ? 'Mrs Obi' : id, role, tenant, 'active').run()
    await db.prepare('INSERT INTO settings (studentId, payload) VALUES (?, ?)').bind(email, JSON.stringify({ email, role, tenantId: tenant, schoolId: tenant, status: 'active', name: id === 'par' ? 'Mrs Obi' : id })).run()
  }
  const sent = []
  globalThis.fetch = async (url, init) => {
    const target = String(url)
    if (target.includes('oauth')) return Response.json({ access_token: 'tok', expires_in: 3600 })
    if (target.includes('/messages')) { const body = JSON.parse(init.body); if (ctx.emailDown) return new Response('down', { status: 500 }); sent.push(body); return Response.json({ status: { code: 200 }, data: {} }) }
    throw new Error(`unexpected fetch ${target}`)
  }
  const env = { APP_DB: db, JWT_SECRET: SECRET, ZOHO_MAIL_ACCOUNT_ID: 'acc', ZOHO_MAIL_FROM_ADDRESS: 'from@ndovera.test', ZOHO_MAIL_CLIENT_ID: 'a', ZOHO_MAIL_CLIENT_SECRET: 'b', ZOHO_MAIL_REFRESH_TOKEN: 'c' }
  const call = async (person, method, path, body) => {
    const [id, email, role, tenantId] = PEOPLE[person]
    const token = await sign({ id, email, role, roles: [role], tenantId, name: id, exp: Math.floor(Date.now() / 1000) + 600 }, SECRET)
    const response = await worker.fetch(new Request(`https://ndovera.com${path}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }), env, { waitUntil() {}, passThroughOnException() {} })
    return { status: response.status, body: await response.json().catch(() => ({})) }
  }
  const ctx = { db, call, sent, emailDown: false }
  // Creates the tables.
  await call('owner', 'GET', '/api/school/finance/simple/receipts/email-status')
  const add = (no, student, name) => db.db.prepare(`INSERT INTO finance_receipts (id, tenant_id, receipt_no, payment_id, student_id, snapshot_json, status, created_at) VALUES (?, 'school-a', ?, ?, ?, ?, 'valid', ?)`)
    .run(`id-${no}`, no, `pay-${no}`, student, JSON.stringify({ studentName: name, className: 'SS 2 A', termName: 'First Term', amountPaid: 50000, paidToDate: 50000, remainingBalance: 0, method: 'bank-transfer', reference: 'TRF1', issuedAt: new Date().toISOString() }), new Date().toISOString())
  ctx.add = add
  return ctx
}
const BULK = '/api/school/finance/simple/receipts/email-batch'

test('one button emails each new receipt once, on the school letterhead, in batches', async () => {
  const ctx = await setup()
  for (let i = 0; i < 10; i += 1) ctx.add(`RCT-${i}`, 'kid1', 'Ada Obi')
  ctx.add('RCT-X', 'nobody', 'No Parent')
  assert.equal((await ctx.call('teacher', 'POST', BULK, {})).status, 403)
  const status = await ctx.call('owner', 'GET', '/api/school/finance/simple/receipts/email-status')
  assert.equal(status.body.pending, 11)

  const first = await ctx.call('owner', 'POST', BULK, {})
  assert.equal(first.status, 200, JSON.stringify(first.body))
  assert.equal(first.body.sent + first.body.noEmail, 8, 'a request does only a few')
  assert.equal(first.body.remaining, 3)
  const second = await ctx.call('owner', 'POST', BULK, {})
  assert.equal(second.body.remaining, 0)
  const sentCount = ctx.sent.length
  assert.equal(sentCount, 10)
  assert.equal((await ctx.call('owner', 'POST', BULK, {})).body.sent, 0)
  assert.equal(ctx.sent.length, sentCount, 'pressing again sends nothing twice')

  const email = ctx.sent[0]
  assert.equal(email.toAddress, 'parent@a.test')
  assert.match(email.subject, /Genesis College: Payment receipt RCT-\d for Ada Obi/)
  for (const part of ['genesis.png', 'Knowledge and Light', '1 School Road', 'Dear Mrs Obi', 'Amount received', '₦50,000', 'Yours faithfully']) assert.ok(email.content.includes(part), part)
})

test('when email is down nothing is marked sent, and the batch stops', async () => {
  const ctx = await setup()
  ctx.add('RCT-1', 'kid1', 'Ada')
  ctx.emailDown = true
  const down = await ctx.call('owner', 'POST', BULK, {})
  assert.equal(down.body.stop, true)
  assert.equal(down.body.remaining, 1)
  ctx.emailDown = false
  assert.equal((await ctx.call('owner', 'POST', BULK, {})).body.sent, 1)
})

test('sending one receipt twice has to be asked for; a parent can email only their own', async () => {
  const ctx = await setup()
  ctx.add('RCT-1', 'kid1', 'Ada')
  ctx.add('RCT-2', 'kid9', 'Someone Else')
  const path = '/api/school/finance/simple/receipts/email'
  assert.equal((await ctx.call('owner', 'POST', path, { receiptNo: 'RCT-1' })).status, 200)
  const again = await ctx.call('owner', 'POST', path, { receiptNo: 'RCT-1' })
  assert.equal(again.status, 409)
  assert.equal(again.body.alreadySent, true)
  assert.equal((await ctx.call('owner', 'POST', path, { receiptNo: 'RCT-1', again: true })).status, 200)

  const mine = '/api/school/finance/my-receipts/email'
  assert.equal((await ctx.call('parent', 'POST', mine, { receiptNo: 'RCT-2' })).status, 404, 'not their child')
  assert.equal((await ctx.call('other', 'POST', mine, { receiptNo: 'RCT-1' })).status, 404)
  ctx.sent.length = 0
  assert.equal((await ctx.call('parent', 'POST', mine, { receiptNo: 'RCT-1' })).status, 200)
  assert.equal(ctx.sent[0].toAddress, 'parent@a.test')
})

test('a school can use its own words, with checked placeholders, and go back to the default', async () => {
  const ctx = await setup()
  const path = '/api/school/email-templates'
  assert.equal((await ctx.call('teacher', 'GET', path)).status, 403)
  const list = await ctx.call('owner', 'GET', path)
  assert.equal(list.body.letterhead.tagline, 'Knowledge and Light')
  assert.equal((await ctx.call('owner', 'PUT', `${path}/receipt`, { subject: 'Receipt', body: 'Hello {{parentNme}}, thank you for paying.' })).status, 400, 'a mistyped placeholder')
  assert.equal((await ctx.call('owner', 'PUT', `${path}/receipt`, { subject: 'Your receipt {{receiptNo}}', body: 'Hello {{parentName}}, <b>thank you</b> for {{amount}}.\nRef: {{reference}}' })).status, 200)
  ctx.add('RCT-1', 'kid1', 'Ada')
  ctx.db.db.exec(`UPDATE finance_receipts SET snapshot_json = json_set(snapshot_json, '$.reference', '')`)
  await ctx.call('owner', 'POST', BULK, {})
  assert.equal(ctx.sent[0].subject, 'Your receipt RCT-1')
  assert.ok(ctx.sent[0].content.includes('Hello Mrs Obi, &lt;b&gt;thank you&lt;/b&gt; for ₦50,000.'), 'school words are escaped')
  assert.ok(!ctx.sent[0].content.includes('Ref:'), 'a line with nothing to say is dropped')
  await ctx.call('owner', 'DELETE', `${path}/receipt`)
  assert.match((await ctx.call('owner', 'GET', path)).body.templates.find(item => item.kind === 'receipt').body, /Yours faithfully/)
})

test('the everyday receipt queries use their indexes', async () => {
  const ctx = await setup()
  const plan = sql => ctx.db.db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all('a', 'b', 8).map(row => row.detail).join(' | ')
  assert.match(plan(`SELECT * FROM finance_receipts r WHERE r.tenant_id = ? AND r.created_at >= ? AND r.status = 'valid' AND NOT EXISTS (SELECT 1 FROM finance_receipt_sends s WHERE s.tenant_id = r.tenant_id AND s.receipt_no = r.receipt_no AND s.channel = 'email') ORDER BY r.created_at LIMIT ?`), /idx_finance_receipts_time.*idx_receipt_sends|idx_receipt_sends.*idx_finance_receipts_time/s)
})
