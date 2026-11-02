import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { D1Shim, createLegacySchema } from './d1-shim.mjs'

// Flutterwave's webhook settling onboarding fees and AI top-ups: only after Flutterwave confirms
// the amount and currency, and only once, however many times the webhook and the customer's return arrive.

const SECRET = 'webhook-test-secret'
const HASH = 'hook-hash'
let generation = 0

async function setup() {
  const worker = (await import(`./build/worker.mjs?flwhook=${generation++}`)).default
  const db = new D1Shim()
  createLegacySchema(db)
  const schema = readFileSync(new URL('../d1/schema.sql', import.meta.url), 'utf8')
  db.db.exec(schema.match(/CREATE TABLE IF NOT EXISTS tenants \([\s\S]*?\);/)[0])
  db.db.exec(schema.match(/CREATE TABLE IF NOT EXISTS tenant_payments \([\s\S]*?\);/)[0])
  const now = new Date().toISOString()
  db.db.prepare(`INSERT INTO tenants (id, school_name, school_slug, owner_name, owner_email, plan_key, requested_subdomain, website_domain, status, approval_status, payment_status, website_status, setup_fee_cents, student_fee_cents, discount_code, created_at, updated_at)
    VALUES ('school-a', 'Genesis School', 'genesis', 'Owner', 'owner@a.test', 'growth', 'genesis', 'genesis.ndovera.com', 'pending', 'approved', 'pending', 'inactive', 5000000, 50000, NULL, ?, ?)`).run(now, now)
  db.db.prepare(`INSERT INTO tenant_payments (id, tenant_id, tx_ref, amount_cents, currency, status, plan_key, discount_code, created_at, updated_at)
    VALUES ('pay-1', 'school-a', 'tenant_school-a_1', 5000000, 'NGN', 'pending', 'growth', NULL, ?, ?)`).run(now, now)
  const aiPayment = { txRef: 'ai_school_o1_1', target: 'school', tenantId: 'school-a', settingsKey: 'owner@a.test', quantity: 1400, amountNaira: 1000, currency: 'NGN', status: 'pending' }
  db.db.prepare('INSERT INTO settings (studentId, payload) VALUES (?, ?)').run('ai_credit_payment_ai_school_o1_1', JSON.stringify(aiPayment))

  const answers = {}
  const asked = []
  globalThis.fetch = async (url) => {
    const target = String(url)
    if (target.startsWith('https://api.flutterwave.com/v3/transactions/verify_by_reference')) {
      const txRef = new URL(target).searchParams.get('tx_ref')
      asked.push(txRef)
      return new Response(JSON.stringify({ status: 'success', data: { id: 77, tx_ref: txRef, currency: 'NGN', status: 'pending', ...answers[txRef] } }), { status: 200 })
    }
    throw new Error(`unexpected fetch ${target}`)
  }
  const env = { APP_DB: db, JWT_SECRET: SECRET, FLUTTERWAVE_SECRET_KEY: 'flw', FLUTTERWAVE_WEBHOOK_HASH: HASH }
  const post = async (path, body, headers = {}) => {
    const response = await worker.fetch(new Request(`https://ndovera.com${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) }), env, { waitUntil() {}, passThroughOnException() {} })
    return { status: response.status, body: await response.json().catch(() => ({})) }
  }
  const hook = txRef => post('/api/webhooks/payments/flutterwave', { data: { tx_ref: txRef, status: 'successful' } }, { 'verif-hash': HASH })
  const row = (sql, ...args) => db.db.prepare(sql).get(...args)
  const payment = () => row(`SELECT status, paid_at FROM tenant_payments WHERE tx_ref = 'tenant_school-a_1'`)
  const school = () => row(`SELECT payment_status FROM tenants WHERE id = 'school-a'`).payment_status
  const setting = key => JSON.parse(row('SELECT payload FROM settings WHERE studentId = ?', key)?.payload || '{}')
  return { db, post, hook, answers, asked, payment, school, setting }
}

const TENANT_REF = 'tenant_school-a_1'
const AI_REF = 'ai_school_o1_1'

test('without the right hash the webhook changes nothing', async () => {
  const { post, payment, answers } = await setup()
  answers[TENANT_REF] = { status: 'successful', amount: 50000 }
  const refused = await post('/api/webhooks/payments/flutterwave', { data: { tx_ref: TENANT_REF } }, { 'verif-hash': 'wrong' })
  assert.equal(refused.status, 401)
  assert.equal(payment().status, 'pending')
})

test('an onboarding fee paid in full marks the school paid, once', async () => {
  const { hook, post, answers, asked, payment, school } = await setup()
  answers[TENANT_REF] = { status: 'successful', amount: 50000 }
  const first = await hook(TENANT_REF)
  assert.equal(first.status, 200, JSON.stringify(first.body))
  assert.equal(first.body.verified, true)
  assert.equal(payment().status, 'paid')
  assert.equal(school(), 'paid')
  const paidAt = payment().paid_at
  assert.ok(paidAt)

  // The webhook again, then the customer's return: both agree, and Flutterwave isn't asked twice.
  assert.equal((await hook(TENANT_REF)).body.verified, true)
  const back = await post('/api/tenants/payments/verify-public', { txRef: TENANT_REF })
  assert.equal(back.body.verified, true)
  assert.equal(asked.length, 1)
  assert.equal(payment().paid_at, paidAt)
})

for (const [label, answer] of [['too little', { amount: 49999.99 }], ['the wrong currency', { amount: 50000, currency: 'USD' }]]) {
  test(`an onboarding fee in ${label} does not mark the school paid`, async () => {
    const { hook, post, answers, payment, school } = await setup()
    answers[TENANT_REF] = { status: 'successful', ...answer }
    assert.equal((await hook(TENANT_REF)).body.verified, false)
    assert.equal(payment().status, 'amount_mismatch')
    assert.equal(school(), 'pending')
    assert.equal((await post('/api/tenants/payments/verify-public', { txRef: TENANT_REF })).body.verified, false)
    assert.equal(school(), 'pending')
  })
}

test('a payment still pending stays pending, and settles when Flutterwave later confirms', async () => {
  const { hook, answers, payment, school } = await setup()
  assert.equal((await hook(TENANT_REF)).body.verified, false)
  assert.equal(payment().status, 'pending')
  answers[TENANT_REF] = { status: 'successful', amount: 50000 }
  assert.equal((await hook(TENANT_REF)).body.verified, true)
  assert.equal(school(), 'paid')
})

test('an AI top-up settled by the webhook credits the wallet once', async () => {
  const { hook, answers, asked, setting } = await setup()
  answers[AI_REF] = { status: 'successful', amount: 1000 }
  const first = await hook(AI_REF)
  assert.equal(first.status, 200, JSON.stringify(first.body))
  assert.equal(first.body.verified, true)
  assert.equal(setting('tenant_ai_wallet_school-a').credits, 1400)
  const record = setting(`ai_credit_payment_${AI_REF}`)
  assert.equal(record.status, 'paid')
  assert.equal(record.flutterwaveTxId, '77')

  assert.equal((await hook(AI_REF)).body.verified, true)
  assert.equal(setting('tenant_ai_wallet_school-a').credits, 1400, 'not credited twice')
  assert.equal(asked.length, 1)
})

test('webhook and return arriving together credit the wallet once', async () => {
  const { hook, answers, setting } = await setup()
  answers[AI_REF] = { status: 'successful', amount: 1000 }
  answers[TENANT_REF] = { status: 'successful', amount: 50000 }
  const results = await Promise.all([hook(AI_REF), hook(AI_REF), hook(TENANT_REF), hook(TENANT_REF)])
  assert.deepEqual(results.map(result => result.status), [200, 200, 200, 200])
  assert.equal(setting('tenant_ai_wallet_school-a').credits, 1400)
})

test('an AI top-up in the wrong amount or currency credits nothing', async () => {
  for (const answer of [{ amount: 500 }, { amount: 1000, currency: 'USD' }]) {
    const { hook, answers, setting } = await setup()
    answers[AI_REF] = { status: 'successful', ...answer }
    assert.equal((await hook(AI_REF)).body.verified, false)
    assert.equal(setting('tenant_ai_wallet_school-a').credits, undefined)
  }
})

test('a reference Ndovera never made is acknowledged and ignored', async () => {
  const { hook } = await setup()
  for (const ref of ['tenant_nobody_1', 'ai_nobody_1', 'other_1']) {
    const result = await hook(ref)
    assert.equal(result.status, 200)
    assert.equal(result.body.ignored, true)
  }
})
