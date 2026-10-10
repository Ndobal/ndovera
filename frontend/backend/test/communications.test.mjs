import test from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { sign } from '@tsndr/cloudflare-worker-jwt'
import { D1Shim, createLegacySchema } from './d1-shim.mjs'
import * as academic from './build/academicSessions.mjs'
import * as credits from './build/commCredits.mjs'

// Parent notifications (N20), end to end through the Worker: the spec's acceptance tests
// (messaging whatsapp.md §14) that do not need real providers. Providers are faked at fetch.

const SECRET = 'comm-test-secret'
const META_SECRET = 'meta-app-secret'
let worker
let generation = 0
const sent = { whatsapp: [], sms: [], flutterwave: [] }
let verifyReply = null

const PEOPLE = {
  owner: ['o-1', 'owner@a.test', 'owner', 'school-a', 'The Owner'],
  teacher: ['t-1', 'teacher@a.test', 'teacher', 'school-a', 'A Teacher'],
  ami: ['ami-1', 'ami@ndovera.test', 'ami', '', 'Ndovera'],
  ownerB: ['o-b', 'owner@b.test', 'owner', 'school-b', 'Other Owner'],
}

const day = offset => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10)

function fakeFetch(real) {
  return async (url, init = {}) => {
    const href = String(url)
    if (href.startsWith('https://graph.facebook.com/')) {
      const body = JSON.parse(init.body)
      sent.whatsapp.push(body)
      return new Response(JSON.stringify({ messages: [{ id: `wamid.${sent.whatsapp.length}` }] }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }
    if (href.startsWith('https://api.payhos.com/')) {
      sent.sms.push(JSON.parse(init.body))
      return new Response(JSON.stringify({ success: true, data: null }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }
    if (href.startsWith('https://api.flutterwave.com/v3/payments')) {
      sent.flutterwave.push(JSON.parse(init.body))
      return new Response(JSON.stringify({ status: 'success', data: { link: 'https://checkout.flutterwave.test/pay' } }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }
    if (href.startsWith('https://api.flutterwave.com/v3/transactions/verify_by_reference')) {
      return new Response(JSON.stringify({ status: 'success', data: verifyReply }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }
    return real(url, init)
  }
}

async function setup({ parents = 12 } = {}) {
  worker = (await import(`./build/worker.mjs?comm=${generation++}`)).default
  academic.resetAcademicTablesCache()
  sent.whatsapp = []; sent.sms = []; sent.flutterwave = []
  const db = new D1Shim()
  createLegacySchema(db)
  db.db.exec(`
    CREATE TABLE tenants (id TEXT PRIMARY KEY, school_name TEXT, owner_email TEXT, owner_name TEXT, status TEXT, requested_subdomain TEXT);
    INSERT INTO tenants VALUES ('school-a', 'Genesis College', 'owner@a.test', 'The Owner', 'active', 'genesis'), ('school-b', 'Other School', 'owner@b.test', 'Other', 'active', 'other');
    CREATE TABLE parent_student_links (id TEXT PRIMARY KEY, parent_id TEXT, student_id TEXT, tenant_id TEXT, created_at TEXT);
    INSERT INTO classes (id, tenantId, name, arm) VALUES ('jss1', 'school-a', 'JSS 1', 'A');
  `)
  for (const [id, email, role, tenant, name] of Object.values(PEOPLE)) {
    await db.prepare('INSERT INTO users (id, email, name, role, tenantId, status) VALUES (?, ?, ?, ?, ?, ?)').bind(id, email, name, role, tenant || null, 'active').run()
    await db.prepare('INSERT INTO settings (studentId, payload) VALUES (?, ?)').bind(email, JSON.stringify({ name, email, role, tenantId: tenant, schoolId: tenant, status: 'active' })).run()
  }
  for (let index = 1; index <= parents; index += 1) {
    const pad = String(index).padStart(2, '0')
    await db.prepare('INSERT INTO users (id, email, name, role, tenantId, status) VALUES (?, ?, ?, ?, ?, ?)').bind(`s-${pad}`, `s${pad}@a.test`, `Student ${pad}`, 'student', 'school-a', 'active').run()
    await db.prepare('INSERT INTO settings (studentId, payload) VALUES (?, ?)').bind(`s${pad}@a.test`, JSON.stringify({ role: 'student', tenantId: 'school-a', classId: 'jss1' })).run()
    await db.prepare('INSERT INTO users (id, email, name, role, tenantId, status) VALUES (?, ?, ?, ?, ?, ?)').bind(`p-${pad}`, `p${pad}@a.test`, `Parent ${pad}`, 'parent', 'school-a', 'active').run()
    await db.prepare('INSERT INTO settings (studentId, payload) VALUES (?, ?)').bind(`p${pad}@a.test`, JSON.stringify({ role: 'parent', tenantId: 'school-a', phone: `0803000${String(1000 + index)}` })).run()
    await db.prepare('INSERT INTO parent_student_links VALUES (?, ?, ?, ?, ?)').bind(`l-${pad}`, `p-${pad}`, `s-${pad}`, 'school-a', '2026-01-01').run()
  }
  const calendar = await academic.createSession(db, {
    tenantId: 'school-a', name: '2026/2027', startDate: day(-30), endDate: day(300), resumptionDate: day(-30),
    terms: [
      { sequence: 1, name: 'First Term', startDate: day(-30), endDate: day(60), resumptionDate: day(70) },
      { sequence: 2, name: 'Second Term', startDate: day(70), endDate: day(160), resumptionDate: day(170) },
      { sequence: 3, name: 'Third Term', startDate: day(170), endDate: day(290), resumptionDate: day(300) },
    ],
  })
  await academic.activateSession(db, { tenantId: 'school-a', sessionId: calendar.session.id })
  return db
}

const env = db => ({
  APP_DB: db, JWT_SECRET: SECRET, TENANT_BASE_DOMAIN: 'ndovera.com',
  META_WHATSAPP_TOKEN: 'meta-token', META_WHATSAPP_PHONE_NUMBER_ID: '12345', META_APP_SECRET: META_SECRET, META_WEBHOOK_VERIFY_TOKEN: 'verify-me',
  PAYHOS_API_KEY: 'key_token', PAYHOS_SENDER_ID: 'NDOVERA', FLUTTERWAVE_SECRET_KEY: 'flw-secret', FLUTTERWAVE_WEBHOOK_HASH: 'flw-hash',
})

async function call(db, person, method, path, body, headers = {}) {
  const [id, , role, tenantId, name] = PEOPLE[person]
  const token = await sign({ id, role, roles: [role], tenantId, name, exp: Math.floor(Date.now() / 1000) + 600 }, SECRET)
  const pending = []
  const response = await withFakeFetch(() => worker.fetch(new Request(`https://ndovera.com${path}`, {
    method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined,
  }), env(db), { waitUntil(promise) { pending.push(promise) }, passThroughOnException() {} }))
  await withFakeFetch(() => Promise.all(pending))
  return { status: response.status, body: await response.json().catch(() => ({})) }
}

async function raw(db, method, path, text, headers = {}) {
  const response = await withFakeFetch(() => worker.fetch(new Request(`https://ndovera.com${path}`, { method, headers, body: text }), env(db), { waitUntil() {}, passThroughOnException() {} }))
  return { status: response.status, text: await response.text() }
}

async function withFakeFetch(run) {
  const real = globalThis.fetch
  globalThis.fetch = fakeFetch(real)
  try { return await run() } finally { globalThis.fetch = real }
}

/** One cron minute: plan, admit, send. */
async function tick(db) {
  const pending = []
  await withFakeFetch(async () => {
    await worker.scheduled({}, env(db), { waitUntil(promise) { pending.push(Promise.resolve(promise).catch(() => null)) } })
    await Promise.all(pending)
  })
}

async function approveTemplates(db) {
  for (const type of ['notice', 'receipt', 'fee_bill']) assert.equal((await call(db, 'ami', 'PUT', `/api/super-admin/communications/templates/${type}`, { status: 'approved' })).status, 200)
}

const deliveries = (db, channel) => db.db.prepare(`SELECT status, financial, units FROM comm_deliveries WHERE channel = ?`).all(channel)

test('a new term grants exactly 10 WhatsApp and 10 SMS units once; switching terms cannot grant twice', async () => {
  const db = await setup()
  const first = await call(db, 'owner', 'GET', '/api/communications/overview')
  assert.equal(first.status, 200, JSON.stringify(first.body))
  assert.equal(first.body.wallet.whatsapp.spendable, 10)
  assert.equal(first.body.wallet.sms.spendable, 10)
  assert.equal(first.body.wallet.email.spendable, 0)
  await call(db, 'owner', 'GET', '/api/communications/overview')
  const active = db.db.prepare(`SELECT id, session_id FROM academic_terms WHERE status = 'active'`).get()
  await credits.ensureTermAllowance(db, 'school-a', { sessionId: active.session_id, termId: active.id, endDate: day(60) })
  assert.equal((await call(db, 'owner', 'GET', '/api/communications/overview')).body.wallet.whatsapp.spendable, 10)
  assert.equal(db.db.prepare(`SELECT COUNT(*) AS n FROM comm_grants WHERE source = 'term_allowance'`).get().n, 2)
  // Teachers cannot see wallets or buy.
  assert.equal((await call(db, 'teacher', 'GET', '/api/communications/overview')).status, 403)
})

test('nothing is sent until the school turns parent notifications on', async () => {
  const db = await setup({ parents: 2 })
  await approveTemplates(db)
  const before = await call(db, 'owner', 'POST', '/api/communications/notices', { title: 'Hello', idempotencyKey: 'off-1' })
  assert.equal(before.body.queued, false)
  await tick(db)
  assert.equal(db.db.prepare(`SELECT COUNT(*) AS n FROM comm_deliveries`).get().n, 0)
  assert.equal((await call(db, 'owner', 'GET', '/api/communications/overview')).body.settings.active, false)
  assert.equal((await call(db, 'teacher', 'PATCH', '/api/communications/settings', { active: true })).status, 403)
  await call(db, 'owner', 'PATCH', '/api/communications/settings', { active: true })
  assert.equal((await call(db, 'owner', 'POST', '/api/communications/notices', { title: 'Hello', idempotencyKey: 'on-1' })).body.queued, true)
})

test('pause policy: 12 parents and 10 WhatsApp units send no WhatsApp at all; free channels go ahead; a big enough gift resumes it', async () => {
  const db = await setup({ parents: 12 })
  await approveTemplates(db)
  await call(db, 'owner', 'PATCH', '/api/communications/settings', { active: true, consentConfirmed: true })
  await call(db, 'owner', 'GET', '/api/communications/overview')

  const preview = await call(db, 'owner', 'POST', '/api/communications/batches/preview', { type: 'notice', scope: { kind: 'school' }, facts: { title: 'Mid-term break' } })
  assert.equal(preview.body.preview.whatsapp, 12)
  assert.deepEqual(preview.body.preview.shortfall, { whatsapp: 2 })
  assert.match(preview.body.preview.warning, /WhatsApp sending paused\. This school notice needs 12 units; 10 are available\. Buy 2 units for ₦30\.40\. .*Email and in-app notifications remain active\./)

  assert.equal((await call(db, 'owner', 'POST', '/api/communications/notices', { title: 'Mid-term break', idempotencyKey: 'n1' })).status, 201)
  await tick(db)
  assert.equal(sent.whatsapp.length, 0, 'not one WhatsApp from an underfunded batch')
  assert.equal(db.db.prepare(`SELECT status FROM comm_batches`).get().status, 'awaiting_credits')
  assert.equal(deliveries(db, 'inapp').filter(item => item.status === 'delivered').length, 12, 'in-app still delivered')
  const overview = (await call(db, 'owner', 'GET', '/api/communications/overview')).body
  assert.equal(overview.wallet.whatsapp.spendable, 10, 'nothing was reserved')
  assert.deepEqual(overview.automation.find(item => item.channel === 'whatsapp').reasons, ['credits'])
  assert.equal(overview.waiting.length, 1)

  // A gift too small leaves it waiting; the gift that covers it resumes it, through the same check.
  const small = await call(db, 'ami', 'POST', '/api/super-admin/communications/grants', { tenantIds: ['school-a'], channel: 'whatsapp', units: 1, reason: 'Goodwill', idempotencyKey: 'g-small' })
  assert.equal(small.body.results[0].status, 'granted')
  assert.equal(db.db.prepare(`SELECT status FROM comm_batches`).get().status, 'awaiting_credits')
  const again = await call(db, 'ami', 'POST', '/api/super-admin/communications/grants', { tenantIds: ['school-a'], channel: 'whatsapp', units: 1, reason: 'Goodwill', idempotencyKey: 'g-small' })
  assert.equal(again.body.results[0].status, 'already_granted', 'an idempotent retry gives nothing twice')
  await call(db, 'ami', 'POST', '/api/super-admin/communications/grants', { tenantIds: ['school-a'], channel: 'whatsapp', units: 1, reason: 'Top up', idempotencyKey: 'g-2' })
  assert.ok(['funded', 'done'].includes(db.db.prepare(`SELECT status FROM comm_batches`).get().status), 'funded — and already sent within the gift request')
  await tick(db)
  assert.equal(sent.whatsapp.length, 12, 'each parent once, on WhatsApp')
  assert.equal(sent.whatsapp[0].template.name, 'ndovera_school_notice')
  assert.equal(sent.whatsapp[0].to, '2348030001001')
  const wallet = (await call(db, 'owner', 'GET', '/api/communications/overview')).body.wallet.whatsapp
  assert.deepEqual([wallet.spendable, wallet.reserved], [0, 12], 'reserved until Meta reports on them')
  assert.deepEqual((await call(db, 'owner', 'GET', '/api/communications/overview')).body.automation.find(item => item.channel === 'whatsapp').reasons, [])

  // Meta's signed webhook settles them; a repeat changes nothing; a forged one is refused.
  const statuses = { entry: [{ changes: [{ value: { statuses: sent.whatsapp.map((_, index) => ({ id: `wamid.${index + 1}`, status: index === 0 ? 'failed' : 'delivered', timestamp: String(Math.floor(Date.now() / 1000)), errors: index === 0 ? [{ code: 131026, title: 'Undeliverable' }] : undefined })) } }] }] }
  const body = JSON.stringify(statuses)
  const signature = `sha256=${createHmac('sha256', META_SECRET).update(body).digest('hex')}`
  assert.equal((await raw(db, 'POST', '/api/webhooks/communications/meta', body, { 'X-Hub-Signature-256': 'sha256=bad' })).status, 401)
  assert.equal((await raw(db, 'POST', '/api/webhooks/communications/meta', body, { 'X-Hub-Signature-256': signature })).status, 200)
  await raw(db, 'POST', '/api/webhooks/communications/meta', body, { 'X-Hub-Signature-256': signature })
  const settled = (await call(db, 'owner', 'GET', '/api/communications/overview')).body.wallet.whatsapp
  assert.deepEqual([settled.spendable, settled.reserved, settled.used], [1, 0, 11], 'the undeliverable one was given back; delivered ones charged once')
  assert.equal((await raw(db, 'GET', '/api/webhooks/communications/meta?hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=abc', undefined)).text, 'abc')
})

test('SMS for the remainder: WhatsApp for those the units cover, SMS for the rest — held whole until SMS covers all of the rest', async () => {
  const db = await setup({ parents: 12 })
  await approveTemplates(db)
  assert.equal((await call(db, 'owner', 'PATCH', '/api/communications/settings', { active: true, consentConfirmed: true, shortagePolicy: 'SMS_FOR_REMAINDER' })).status, 400, 'the SMS cost must be acknowledged')
  await call(db, 'owner', 'PATCH', '/api/communications/settings', { active: true, consentConfirmed: true, shortagePolicy: 'SMS_FOR_REMAINDER', acknowledgeSmsCost: true })
  await call(db, 'owner', 'GET', '/api/communications/overview')
  // 10 WhatsApp + 10 SMS units for 12 parents: 10 by WhatsApp, 2 by SMS — funded.
  await call(db, 'owner', 'POST', '/api/communications/notices', { title: 'Sports day', idempotencyKey: 'n-sms' })
  await tick(db)
  assert.equal(sent.whatsapp.length, 10)
  assert.equal(sent.sms.length, 2)
  assert.equal(sent.sms[0][0].senderId, 'NDOVERA')
  assert.ok(!/₦/.test(sent.sms[0][0].message), 'plain characters only in SMS')
  const after = (await call(db, 'owner', 'GET', '/api/communications/overview')).body.wallet
  assert.equal(after.sms.used, 2, 'SMS units are spent on acceptance')
  assert.equal(after.sms.spendable, 8)

  // Next notice: 0 WhatsApp units left, 12 parents need SMS, only 8 SMS units — the whole batch waits.
  await call(db, 'owner', 'POST', '/api/communications/notices', { title: 'PTA', idempotencyKey: 'n-sms-2' })
  await tick(db)
  assert.equal(sent.sms.length, 2, 'no knowingly underfunded partial campaign')
  const waiting = db.db.prepare(`SELECT shortfall FROM comm_batches WHERE status = 'awaiting_credits'`).get()
  assert.deepEqual(JSON.parse(waiting.shortfall), { sms: 4 })
})

test('buying units: a server quote, a Flutterwave checkout, credited once and only for the right payment', async () => {
  const db = await setup({ parents: 2 })
  const quote = await call(db, 'owner', 'POST', '/api/communications/purchases/quote', { channel: 'sms', units: 50 })
  assert.equal(quote.status, 201, JSON.stringify(quote.body))
  assert.deepEqual([quote.body.quote.amountKobo, quote.body.quote.unitPriceKobo], [40000, 800])
  assert.equal((await call(db, 'owner', 'POST', '/api/communications/purchases/quote', { channel: 'email', units: 50 })).status, 400, 'email is free: nothing to buy')
  assert.equal((await call(db, 'teacher', 'POST', '/api/communications/purchases/quote', { channel: 'sms', units: 50 })).status, 403)
  const started = await call(db, 'owner', 'POST', '/api/communications/purchases', { purchaseId: quote.body.quote.id })
  assert.equal(started.status, 200, JSON.stringify(started.body))
  assert.equal(started.body.checkoutUrl, 'https://checkout.flutterwave.test/pay')
  assert.equal(sent.flutterwave[0].amount, '400.00')
  const txRef = started.body.purchase.txRef
  const id = quote.body.quote.id
  assert.equal((await call(db, 'ownerB', 'GET', `/api/communications/purchases/${id}`)).status, 404, 'another school cannot see it')

  // The wrong amount credits nothing.
  verifyReply = { status: 'successful', tx_ref: txRef, amount: 40, currency: 'NGN', id: 77, meta: { tenantId: 'school-a' } }
  const wrong = await call(db, 'owner', 'GET', `/api/communications/purchases/${id}`)
  assert.equal(wrong.body.purchase.status, 'mismatch')
  assert.equal(db.db.prepare(`SELECT COUNT(*) AS n FROM comm_grants WHERE source = 'purchase'`).get().n, 0)

  // A correct payment (via the webhook, twice) credits once.
  db.db.prepare(`UPDATE comm_purchases SET status = 'pending', failure = NULL WHERE id = ?`).run(id)
  verifyReply = { status: 'successful', tx_ref: txRef, amount: 400, currency: 'NGN', id: 78, meta: { tenantId: 'school-a' } }
  const hook = JSON.stringify({ event: 'charge.completed', data: { tx_ref: txRef, status: 'successful', amount: 400000 } })
  assert.equal((await raw(db, 'POST', '/api/webhooks/payments/flutterwave', hook, { 'verif-hash': 'nope', 'Content-Type': 'application/json' })).status, 401)
  assert.equal((await raw(db, 'POST', '/api/webhooks/payments/flutterwave', hook, { 'verif-hash': 'flw-hash', 'Content-Type': 'application/json' })).status, 200)
  await raw(db, 'POST', '/api/webhooks/payments/flutterwave', hook, { 'verif-hash': 'flw-hash', 'Content-Type': 'application/json' })
  await call(db, 'owner', 'GET', `/api/communications/purchases/${id}`)
  assert.equal(db.db.prepare(`SELECT COUNT(*) AS n FROM comm_grants WHERE source = 'purchase'`).get().n, 1)
  const wallet = (await call(db, 'owner', 'GET', '/api/communications/overview')).body.wallet.sms
  assert.equal(wallet.purchased, 50)
})

test('the last units cannot be reserved twice; expired units fund nothing; only Super Admin gifts and prices', async () => {
  const db = await setup({ parents: 1 })
  await credits.ensureCommTables(db)
  db.db.prepare(`INSERT INTO comm_grants (id, tenant_id, channel, source, initial_units, remaining_units, reserved_units, created_at, updated_at) VALUES ('g1', 'school-a', 'sms', 'purchase', 3, 3, 0, '2026-01-01', '2026-01-01')`).run()
  const one = credits.reserveAll(db, 'school-a', 'b1', [{ deliveryId: 'd1', channel: 'sms', units: 2 }], { expiresAt: day(2) })
  const two = credits.reserveAll(db, 'school-a', 'b2', [{ deliveryId: 'd2', channel: 'sms', units: 2 }], { expiresAt: day(2) })
  const results = await Promise.all([one, two])
  assert.deepEqual(results.map(result => result.ok).sort(), [false, true], 'one funded, one short')
  assert.equal(db.db.prepare(`SELECT reserved_units FROM comm_grants WHERE id = 'g1'`).get().reserved_units, 2)
  // Whole-plan: a plan the units cannot fully cover reserves nothing.
  const partial = await credits.reserveAll(db, 'school-a', 'b3', [{ deliveryId: 'd3', channel: 'sms', units: 1 }, { deliveryId: 'd4', channel: 'sms', units: 1 }], { expiresAt: day(2) })
  assert.equal(partial.ok, false)
  assert.equal(db.db.prepare(`SELECT reserved_units FROM comm_grants WHERE id = 'g1'`).get().reserved_units, 2)
  // Expired units fund nothing.
  db.db.prepare(`INSERT INTO comm_grants (id, tenant_id, channel, source, initial_units, remaining_units, reserved_units, expires_at, created_at, updated_at) VALUES ('g2', 'school-a', 'whatsapp', 'gift', 5, 5, 0, '2020-01-01T00:00:00Z', '2026-01-01', '2026-01-01')`).run()
  assert.equal((await credits.reserveAll(db, 'school-a', 'b4', [{ deliveryId: 'd5', channel: 'whatsapp', units: 1 }], { expiresAt: day(2) })).ok, false)

  assert.equal((await call(db, 'owner', 'POST', '/api/super-admin/communications/grants', { tenantIds: ['school-a'], channel: 'sms', units: 100, reason: 'self', idempotencyKey: 'x' })).status, 403)
  assert.equal((await call(db, 'owner', 'POST', '/api/super-admin/communications/prices', { channel: 'email', unitPriceKobo: 100, effectiveFrom: day(30) })).status, 403)
  // A future email price leaves email free today and never charges a school silently.
  const scheduled = await call(db, 'ami', 'POST', '/api/super-admin/communications/prices', { channel: 'email', unitPriceKobo: 100, effectiveFrom: `${day(30)}T00:00:00Z`, notice: 'Email will cost ₦1 from next month.' })
  assert.equal(scheduled.status, 200, JSON.stringify(scheduled.body))
  assert.equal(scheduled.body.prices.email.current.billingMode, 'FREE')
  assert.equal(scheduled.body.prices.email.upcoming[0].unitPriceKobo, 100)
  // Reversing a gift takes back only what is unspent and unreserved.
  const gift = await call(db, 'ami', 'POST', '/api/super-admin/communications/grants', { tenantIds: ['school-a'], channel: 'sms', units: 4, reason: 'Pilot', idempotencyKey: 'pilot' })
  const reversed = await call(db, 'ami', 'POST', `/api/super-admin/communications/grants/${gift.body.results[0].grantId}/reverse`, { reason: 'Sent in error' })
  assert.equal(reversed.body.reversed, 4)
  assert.equal(db.db.prepare(`SELECT COUNT(*) AS n FROM comm_ledger WHERE op = 'reverse'`).get().n, 1)
  assert.equal(db.db.prepare(`SELECT initial_units FROM comm_grants WHERE id = ?`).get(gift.body.results[0].grantId).initial_units, 4, 'the original gift stays on record')
})

test('withdrawn consent and missing phones are excluded and reported, never counted as notified', async () => {
  const db = await setup({ parents: 3 })
  await approveTemplates(db)
  await call(db, 'owner', 'PATCH', '/api/communications/settings', { active: true, consentConfirmed: true })
  db.db.prepare(`UPDATE settings SET payload = json_set(payload, '$.phone', 'not a phone') WHERE studentId = 'p03@a.test'`).run()
  assert.equal((await call(db, 'owner', 'POST', '/api/communications/contacts/p-02/consent', { channel: 'whatsapp', status: 'withdrawn' })).status, 200)
  const preview = (await call(db, 'owner', 'POST', '/api/communications/batches/preview', { type: 'notice', scope: { kind: 'school' } })).body.preview
  assert.equal(preview.whatsapp, 1)
  assert.equal(preview.inapp, 3, 'in-app reaches every authorised parent')
  // Parent 2 withdrew WhatsApp; SMS could reach them, but this school only pauses (no SMS fallback).
  assert.deepEqual(preview.excluded, { sms_fallback_off: 1, no_valid_phone: 1 })
})

test('a notification is sent within the request that caused it; while idle the minute tick reads only one row', async () => {
  const db = await setup({ parents: 3 })
  await call(db, 'owner', 'PATCH', '/api/communications/settings', { active: true })
  await tick(db)
  assert.equal(db.db.prepare(`SELECT next_due_at FROM comm_work WHERE id = 'main'`).get()?.next_due_at ?? null, null, 'nothing due')
  await call(db, 'owner', 'POST', '/api/communications/notices', { title: 'Open day', idempotencyKey: 'kick-1' })
  // No tick: the in-app notices went out with the request.
  assert.equal(db.db.prepare(`SELECT COUNT(*) AS n FROM comm_deliveries WHERE channel = 'inapp' AND status = 'delivered'`).get().n, 3)
  assert.equal(db.db.prepare(`SELECT next_due_at FROM comm_work WHERE id = 'main'`).get().next_due_at, null, 'and nothing is left due')
  const parentInbox = db.db.prepare(`SELECT COUNT(*) AS n FROM comm_inbox WHERE user_id = 'p-01'`).get().n
  assert.equal(parentInbox, 1)
})

test('teachers see how notifications about their own classes went — counts only, never fees or other classes', async () => {
  const db = await setup({ parents: 2 })
  db.db.exec(`UPDATE classes SET classTeacherId = 't-1' WHERE id = 'jss1'; INSERT INTO classes (id, tenantId, name, arm) VALUES ('jss2', 'school-a', 'JSS 2', 'A');`)
  await call(db, 'owner', 'PATCH', '/api/communications/settings', { active: true, assignmentMode: 'each' })
  await call(db, 'owner', 'GET', '/api/communications/overview') // creates the notification tables, as opening the page does
  const insert = db.db.prepare(`INSERT INTO comm_events (id, tenant_id, type, scope, facts, link, dedupe_key, status, created_by, created_at) VALUES (?, 'school-a', ?, ?, ?, '', ?, 'new', 'test', ?)`)
  const now = new Date().toISOString()
  insert.run('ev-mine', 'assignment', JSON.stringify({ kind: 'class', classIds: ['jss1'] }), JSON.stringify({ title: 'Fractions worksheet' }), 'd1', now)
  insert.run('ev-other', 'assignment', JSON.stringify({ kind: 'class', classIds: ['jss2'] }), JSON.stringify({ title: 'Not mine' }), 'd2', now)
  insert.run('ev-fee', 'fee_reminder', JSON.stringify({ kind: 'students', studentIds: ['s-01'] }), JSON.stringify({}), 'd3', now)
  db.db.exec(`INSERT INTO comm_work (id, next_due_at) VALUES ('main', '2020-01-01T00:00:00Z') ON CONFLICT(id) DO UPDATE SET next_due_at = excluded.next_due_at`)
  await tick(db)
  const view = await call(db, 'teacher', 'GET', '/api/communications/my-classes')
  assert.equal(view.status, 200, JSON.stringify(view.body))
  assert.deepEqual(view.body.classes, ['JSS 1 A'])
  assert.deepEqual(view.body.notifications.map(item => item.title), ['Fractions worksheet'])
  const mine = view.body.notifications[0]
  assert.equal(mine.families, 2)
  assert.equal(mine.channels.inapp.delivered, 2)
  assert.ok(!JSON.stringify(view.body).includes('p-0'), 'no parent identities')
  assert.equal((await call(db, 'teacher', 'GET', '/api/communications/overview')).status, 403, 'and still no wallets or buying')
})
