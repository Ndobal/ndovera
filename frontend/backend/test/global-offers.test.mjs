import test from 'node:test'
import assert from 'node:assert/strict'
import { sign } from '@tsndr/cloudflare-worker-jwt'
import { D1Shim, createLegacySchema } from './d1-shim.mjs'

// Country prices (+20%, or a discount code), one-time pass codes with an exact end,
// and the home page strips of schools and Ami-approved reviews.

const SECRET = 'global-offers-secret'
let generation = 0
const PEOPLE = {
  ss2: ['s-ss2', 'ss2@a.test', 'student', 'school-a', { classId: 'ss2a', name: 'Ada Student' }],
  ghana: ['s-gh', 'gh@b.test', 'student', 'school-b', { classId: 'ss2b', name: 'Kofi' }],
  promo: ['s-promo', 'promo@c.test', 'student', 'school-c', { classId: 'ss2c', name: 'Promo' }],
  teacher: ['t-1', 'teacher@a.test', 'teacher', 'school-a', { name: 'Mrs Bello' }],
  owner: ['o-1', 'owner@a.test', 'owner', 'school-a', { name: 'Owner One' }],
  ami: ['ami-1', 'ami@ndovera.test', 'ami', '', { name: 'Ami' }],
}
const DEVICE = { 'X-Practice-Device': 'device-global-0001' }

async function setup() {
  const worker = (await import(`./build/worker.mjs?offers=${generation++}`)).default
  const db = new D1Shim()
  createLegacySchema(db)
  db.db.exec(`
    CREATE TABLE IF NOT EXISTS subjects (id TEXT PRIMARY KEY, tenantId TEXT, name TEXT, classId TEXT, teacherId TEXT, createdAt TEXT);
    DROP TABLE IF EXISTS tenants;
    CREATE TABLE tenants (id TEXT PRIMARY KEY, school_name TEXT, country TEXT, status TEXT, discount_code TEXT);
    CREATE TABLE IF NOT EXISTS tenant_branding (tenant_id TEXT PRIMARY KEY, logo_url TEXT);
    INSERT INTO tenants VALUES ('school-a', 'Genesis College', 'Nigeria', 'active', NULL), ('school-b', 'Accra Academy', 'Ghana', 'active', NULL),
      ('school-c', 'Promo School', 'Kenya', 'active', 'PARTNER10'), ('school-d', 'Closed School', 'Nigeria', 'suspended', NULL);
    INSERT INTO tenant_branding (tenant_id, logo_url) VALUES ('school-a', 'https://ndovera.com/files/genesis.png');
    INSERT INTO classes (id, tenantId, name, arm) VALUES ('ss2a', 'school-a', 'SS 2', 'A'), ('ss2b', 'school-b', 'SS 2', 'B'), ('ss2c', 'school-c', 'SS 2', 'C');
    INSERT INTO subjects (id, tenantId, name, classId) VALUES ('m-a', 'school-a', 'Mathematics', 'ss2a'), ('m-b', 'school-b', 'Mathematics', 'ss2b'), ('m-c', 'school-c', 'Mathematics', 'ss2c');
  `)
  for (const [id, email, role, tenant, extra] of Object.values(PEOPLE)) {
    await db.prepare('INSERT INTO users (id, email, name, role, tenantId, status) VALUES (?, ?, ?, ?, ?, ?)').bind(id, email, extra.name, role, tenant, 'active').run()
    await db.prepare('INSERT INTO settings (studentId, payload) VALUES (?, ?)').bind(email, JSON.stringify({ email, role, tenantId: tenant, schoolId: tenant, status: 'active', ...extra })).run()
  }
  const sent = []
  const provider = { answer: null }
  globalThis.fetch = async (url, init) => {
    const target = String(url)
    if (target.endsWith('/payments')) { sent.push(JSON.parse(init.body)); return Response.json({ status: 'success', data: { link: 'https://checkout.example/pay' } }) }
    if (target.includes('verify_by_reference')) return Response.json({ status: 'success', data: provider.answer })
    throw new Error(`unexpected fetch ${target}`)
  }
  const env = { APP_DB: db, JWT_SECRET: SECRET, FLUTTERWAVE_SECRET_KEY: 'x' }
  const raw = async (path, init = {}) => worker.fetch(new Request(`https://ndovera.com${path}`, init), env, { waitUntil() {}, passThroughOnException() {} })
  const call = async (person, method, path, body, headers = {}) => {
    const [id, , role, tenantId, extra] = PEOPLE[person]
    const token = await sign({ id, role, roles: [role], tenantId, name: extra.name, exp: Math.floor(Date.now() / 1000) + 600 }, SECRET)
    const response = await raw(path, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...DEVICE, ...headers }, body: body ? JSON.stringify(body) : undefined })
    return { status: response.status, body: await response.json().catch(() => ({})) }
  }
  return { db, call, raw, sent, provider, env }
}

const later = (hours = 24) => new Date(Date.now() + hours * 3600_000).toISOString()
const rate = (ctx, country, currency, nairaPerUnit) => ctx.call('ami', 'POST', '/api/ami/pricing-countries', { country, currency, nairaPerUnit })
const ALL_BUNDLE = { bundle: 'all' }

test('Nigeria pays naira, unchanged and with no charge record', async () => {
  const ctx = await setup()
  await rate(ctx, 'GH', 'GHS', 100)
  const started = await ctx.call('ss2', 'POST', '/api/practice-arena/passes/checkout', ALL_BUNDLE)
  assert.equal(started.status, 200, JSON.stringify(started.body))
  assert.equal(ctx.sent[0].currency, 'NGN')
  assert.equal(Number(ctx.sent[0].amount), 1500)
  assert.equal(ctx.db.db.prepare('SELECT COUNT(*) AS n FROM payment_charges').get().n, 0)
})

test('a configured country pays its own currency, 20% above Nigeria, and only that settles the pass', async () => {
  const ctx = await setup()
  await rate(ctx, 'GH', 'GHS', 100)
  const started = await ctx.call('ghana', 'POST', '/api/practice-arena/passes/checkout', ALL_BUNDLE)
  assert.equal(ctx.sent[0].currency, 'GHS')
  assert.equal(ctx.sent[0].amount, 18) // ₦1,500 + 20% = ₦1,800 at ₦100 to the cedi
  const txRef = started.body.txRef
  const answer = (currency, amount) => ({ status: 'successful', tx_ref: txRef, currency, amount, id: 9 })

  // Naira at the Nigerian price, the same number in naira, and too few cedis: none of them is enough.
  for (const [currency, amount] of [['NGN', 1500], ['NGN', 18], ['GHS', 17]]) {
    ctx.provider.answer = answer(currency, amount)
    const verify = await ctx.call('ghana', 'POST', '/api/practice-arena/passes/verify', { txRef })
    assert.equal(verify.body.paid, false, `${currency} ${amount} must not settle`)
    ctx.db.db.prepare(`UPDATE practice_payments SET status = 'pending' WHERE tx_ref = ?`).run(txRef)
  }
  ctx.provider.answer = answer('GHS', 18)
  const paid = await ctx.call('ghana', 'POST', '/api/practice-arena/passes/verify', { txRef })
  assert.equal(paid.body.paid, true, JSON.stringify(paid.body))
  assert.equal(ctx.db.db.prepare(`SELECT COUNT(*) AS n FROM practice_passes WHERE student_id = 's-gh'`).get().n, 1)
})

test('a country with no rate pays dollars at ₦1,500, and Ami can change the dollar rate', async () => {
  const ctx = await setup()
  ctx.db.db.exec(`UPDATE tenants SET country = 'Uganda', discount_code = NULL WHERE id = 'school-c'`)
  const noRate = await ctx.call('promo', 'POST', '/api/practice-arena/passes/checkout', ALL_BUNDLE)
  assert.equal(noRate.status, 200)
  assert.equal(ctx.sent[0].currency, 'USD')
  assert.equal(ctx.sent[0].amount, 1.2)
  ctx.provider.answer = { status: 'successful', tx_ref: noRate.body.txRef, currency: 'NGN', amount: 1500, id: 1 }
  assert.equal((await ctx.call('promo', 'POST', '/api/practice-arena/passes/verify', { txRef: noRate.body.txRef })).body.paid, false, 'the Nigerian price is not enough abroad')

  await rate(ctx, '*', 'USD', 1000)
  await ctx.call('promo', 'POST', '/api/practice-arena/passes/checkout', ALL_BUNDLE)
  assert.equal(ctx.sent[1].amount, 1.8)
})

test('the launch countries are understood however the school typed them', async () => {
  const ctx = await setup()
  for (const [typed, currency] of [["Côte d'Ivoire", 'XOF'], ['Ivory Coast', 'XOF'], ['Cameroon', 'XAF'], ['kenya', 'KES']]) {
    ctx.db.db.prepare(`UPDATE tenants SET country = ?, discount_code = NULL WHERE id = 'school-c'`).run(typed)
    const code = { XOF: 'CI', XAF: 'CM', KES: 'KE' }[currency]
    await rate(ctx, code, currency, 2)
    ctx.sent.length = 0
    await ctx.call('promo', 'POST', '/api/practice-arena/passes/checkout', ALL_BUNDLE)
    assert.equal(ctx.sent[0].currency, currency, typed)
  }
})

test('an exam request carries its curriculum, stays private, and gets an answer', async () => {
  const ctx = await setup()
  const puts = new Map()
  ctx.env.UPLOADS = { put: async (key, body) => { puts.set(key, await new Response(body).text()) }, delete: async key => { puts.delete(key) }, get: async key => (puts.has(key) ? { body: puts.get(key), httpMetadata: { contentType: 'application/pdf' } } : null) }
  const send = async (person, fields, file) => {
    const form = new FormData()
    for (const [key, value] of Object.entries(fields)) form.append(key, value)
    if (file) form.append('file', file)
    const [id, , role, tenantId, extra] = PEOPLE[person]
    const token = await sign({ id, role, roles: [role], tenantId, name: extra.name, exp: Math.floor(Date.now() / 1000) + 600 }, SECRET)
    const response = await ctx.raw('/api/exam-requests', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form })
    return { status: response.status, body: await response.json() }
  }
  const good = { examName: 'KCSE', scope: 'country', country: 'Kenya', section: 'senior', subjects: 'Mathematics', confirmed: 'true' }
  const pdf = new File(['the syllabus'], 'kcse.pdf', { type: 'application/pdf' })
  assert.equal((await send('ghana', { ...good, confirmed: 'false' }, pdf)).status, 400, 'needs permission')
  assert.equal(puts.size, 0, 'a refused request leaves no file')
  assert.equal((await send('ghana', good)).status, 400, 'needs a curriculum')
  assert.equal((await send('ghana', good, new File(['x'], 'run.exe'))).status, 400, 'odd files are refused')
  assert.equal((await send('ami', good, pdf)).status, 403, 'needs a school')
  const made = await send('ghana', good, pdf)
  assert.equal(made.status, 201, JSON.stringify(made.body))
  const [key] = puts.keys()
  assert.match(key, /^exam-requests\//)
  assert.equal((await ctx.raw(`/files/${key}`)).status, 404, 'not on the public file route')

  assert.equal((await ctx.call('owner', 'GET', '/api/ami/exam-requests')).status, 403)
  const listed = (await ctx.call('ami', 'GET', '/api/ami/exam-requests?status=new')).body.requests
  assert.equal(listed[0].examName, 'KCSE')
  assert.equal(listed[0].schoolName, 'Accra Academy')
  const [amiId, , , , amiExtra] = PEOPLE.ami
  const amiToken = await sign({ id: amiId, role: 'ami', roles: ['ami'], tenantId: '', name: amiExtra.name, exp: Math.floor(Date.now() / 1000) + 600 }, SECRET)
  const download = await ctx.raw(`/api/ami/exam-requests/${listed[0].id}/file`, { headers: { Authorization: `Bearer ${amiToken}` } })
  assert.equal(await download.text(), 'the syllabus')
  assert.equal((await ctx.raw(`/api/ami/exam-requests/${listed[0].id}/file`)).status, 401)

  await ctx.call('ami', 'POST', `/api/ami/exam-requests/${listed[0].id}`, { status: 'building', note: 'Started on Mathematics.' })
  const mine = (await ctx.call('ghana', 'GET', '/api/exam-requests/mine')).body.requests
  assert.equal(mine[0].status, 'building')
  assert.equal(mine[0].note, 'Started on Mathematics.')
  assert.equal((await ctx.call('ss2', 'GET', '/api/exam-requests/mine')).body.requests.length, 0, 'only your own')
  const plan = ctx.db.db.prepare('EXPLAIN QUERY PLAN SELECT * FROM exam_requests WHERE status = ? ORDER BY created_at DESC LIMIT 100').all('new').map(row => row.detail).join()
  assert.match(plan, /idx_exam_requests_status/)
})

test('a school with a discount code pays no 20%, and whole-unit currencies round up', async () => {
  const ctx = await setup()
  await rate(ctx, 'KE', 'RWF', 0.7)
  await ctx.call('promo', 'POST', '/api/practice-arena/passes/checkout', ALL_BUNDLE)
  assert.equal(ctx.sent[0].currency, 'RWF')
  assert.equal(ctx.sent[0].amount, 2143) // ₦1,500 / 0.7 = 2142.86, no surcharge
})

test('only Ami sets rates, and Nigeria has no rate', async () => {
  const ctx = await setup()
  assert.equal((await ctx.call('owner', 'POST', '/api/ami/pricing-countries', { country: 'GH', currency: 'GHS', nairaPerUnit: 1 })).status, 403)
  assert.equal((await rate(ctx, 'NG', 'NGN', 1)).status, 400)
  assert.equal((await rate(ctx, 'GH', 'GHS', -5)).status, 400)
})

test('a code gives one pass once, at no charge, and stops at its date and time', async () => {
  const ctx = await setup()
  assert.equal((await ctx.call('owner', 'POST', '/api/ami/pass-codes', { bundle: 'all', count: 1, expiresAt: later() })).status, 403)
  assert.equal((await ctx.call('ami', 'POST', '/api/ami/pass-codes', { bundle: 'all', count: 1, expiresAt: later(-1) })).status, 400, 'an end in the past')
  const made = await ctx.call('ami', 'POST', '/api/ami/pass-codes', { bundle: 'all', count: 3, expiresAt: later(), label: 'Open day' })
  assert.equal(made.status, 201, JSON.stringify(made.body))
  const [first, second, third] = made.body.batch.codes
  assert.equal(new Set(made.body.batch.codes).size, 3)

  const used = await ctx.call('ss2', 'POST', '/api/practice-arena/passes/redeem', { code: first.toLowerCase() })
  assert.equal(used.status, 200, JSON.stringify(used.body))
  const pass = ctx.db.db.prepare(`SELECT source, amount_naira FROM practice_passes WHERE student_id = 's-ss2'`).get()
  assert.equal(pass.source, 'code')
  assert.equal(pass.amount_naira, 0)

  assert.equal((await ctx.call('ghana', 'POST', '/api/practice-arena/passes/redeem', { code: first })).status, 409, 'used codes stay used')
  assert.equal((await ctx.call('owner', 'POST', '/api/practice-arena/passes/redeem', { code: second })).status, 400, 'a school buys, it does not redeem')

  ctx.db.db.prepare(`UPDATE practice_code_batches SET expires_at = ?`).run(later(-1))
  assert.equal((await ctx.call('ghana', 'POST', '/api/practice-arena/passes/redeem', { code: second })).status, 410)
  ctx.db.db.prepare(`UPDATE practice_code_batches SET expires_at = ?`).run(later())
  await ctx.call('ami', 'POST', `/api/ami/pass-codes/${made.body.batch.id}/cancel`, {})
  assert.equal((await ctx.call('ghana', 'POST', '/api/practice-arena/passes/redeem', { code: third })).status, 410, 'stopped batch')

  const batches = await ctx.call('ami', 'GET', '/api/ami/pass-codes')
  assert.equal(batches.body.batches[0].used, 1)
})

test('two people using one code at once: only one gets the pass', async () => {
  const ctx = await setup()
  const made = await ctx.call('ami', 'POST', '/api/ami/pass-codes', { bundle: 'all', count: 1, expiresAt: later() })
  const code = made.body.batch.codes[0]
  const results = await Promise.all(['ss2', 'ghana'].map(person => ctx.call(person, 'POST', '/api/practice-arena/passes/redeem', { code })))
  assert.deepEqual(results.map(item => item.status).sort(), [200, 409])
  assert.equal(ctx.db.db.prepare(`SELECT COUNT(*) AS n FROM practice_passes WHERE source = 'code'`).get().n, 1)
})

test('a pass needing a choice asks first, keeps the code, and can end when Ami said', async () => {
  const ctx = await setup()
  const ends = later(72)
  const made = await ctx.call('ami', 'POST', '/api/ami/pass-codes', { bundle: 'subject', count: 1, expiresAt: later(), passEndsAt: ends })
  const code = made.body.batch.codes[0]
  const ask = await ctx.call('ss2', 'POST', '/api/practice-arena/passes/redeem', { code })
  assert.equal(ask.body.needs, 'subject')
  const home = await ctx.call('ss2', 'GET', '/api/practice-arena/home')
  const subject = home.body.subjects[0].key
  const used = await ctx.call('ss2', 'POST', '/api/practice-arena/passes/redeem', { code, subjectKey: subject })
  assert.equal(used.status, 200, JSON.stringify(used.body))
  assert.equal(used.body.expiresAt, new Date(ends).toISOString())
  const again = await ctx.call('ss2', 'GET', '/api/practice-arena/home')
  assert.ok(again.body.passes.list.some(pass => pass.subjectKey === subject && pass.source === 'code'), 'the pass counts with its own end date')
})

test('wrong codes are limited each day', async () => {
  const ctx = await setup()
  for (let i = 0; i < 10; i += 1) assert.equal((await ctx.call('ss2', 'POST', '/api/practice-arena/passes/redeem', { code: `WRONG${i}` })).status, 400)
  assert.equal((await ctx.call('ss2', 'POST', '/api/practice-arena/passes/redeem', { code: 'WRONG' })).status, 429)
})

test('reviews show only after Ami approves, students stay unnamed, and a change goes back to Ami', async () => {
  const ctx = await setup()
  const good = { rating: 5, body: 'Ndovera made our class work easy to follow.', consent: true }
  assert.equal((await ctx.call('ss2', 'POST', '/api/reviews/mine', { ...good, consent: false })).status, 400, 'needs consent')
  assert.equal((await ctx.call('ss2', 'POST', '/api/reviews/mine', { ...good, rating: 9 })).status, 400)
  assert.equal((await ctx.call('ami', 'POST', '/api/reviews/mine', good)).status, 403, 'Ami has no school to review from')
  assert.equal((await ctx.call('ss2', 'POST', '/api/reviews/mine', { ...good, showName: true })).status, 200)
  await ctx.call('teacher', 'POST', '/api/reviews/mine', { ...good, body: 'Marking is much faster for my classes now.', showName: true })

  let shown = await (await ctx.raw('/api/public/home-showcase')).json()
  assert.equal(shown.reviews.length, 0, 'nothing before approval')
  assert.equal((await ctx.call('owner', 'GET', '/api/ami/reviews')).status, 403)
  const pending = (await ctx.call('ami', 'GET', '/api/ami/reviews?status=pending')).body.reviews
  assert.equal(pending.length, 2)
  for (const review of pending) await ctx.call('ami', 'POST', `/api/ami/reviews/${review.id}`, { status: 'approved' })

  shown = await (await ctx.raw('/api/public/home-showcase')).json()
  assert.equal(shown.reviews.length, 2)
  const text = JSON.stringify(shown)
  assert.ok(!text.includes('Ada Student'), 'a student is never named')
  assert.ok(text.includes('Mrs Bello'))
  assert.ok(shown.reviews.some(item => item.name === 'Student' && item.detail === 'Genesis College'))
  assert.ok(!/@|user_id|tenant_id/.test(text), 'no emails or ids on the public page')

  await ctx.call('teacher', 'POST', '/api/reviews/mine', { ...good, body: 'Changed words that nobody at Ndovera has read.', showName: true })
  shown = await (await ctx.raw('/api/public/home-showcase')).json()
  assert.equal(shown.reviews.length, 1, 'a changed review waits again')
})

test('the home strip lists active schools only, and Ami can hide one', async () => {
  const ctx = await setup()
  const shown = await (await ctx.raw('/api/public/home-showcase')).json()
  assert.deepEqual(shown.schools.map(item => item.name), ['Accra Academy', 'Genesis College', 'Promo School'])
  assert.equal(shown.schools[1].logoUrl, 'https://ndovera.com/files/genesis.png')
  await ctx.call('ami', 'POST', '/api/ami/showcase/schools/school-c', { hidden: true })
  const after = await (await ctx.raw('/api/public/home-showcase')).json()
  assert.ok(!after.schools.some(item => item.name === 'Promo School'))
})

test('everyday queries use their indexes', async () => {
  const ctx = await setup()
  await ctx.raw('/api/public/home-showcase')
  await ctx.call('ami', 'POST', '/api/ami/pass-codes', { bundle: 'all', count: 1, expiresAt: later() })
  await rate(ctx, 'GH', 'GHS', 100)
  const plan = sql => ctx.db.db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all('x').map(row => row.detail).join(' | ')
  assert.match(plan(`SELECT * FROM platform_reviews WHERE status = ? ORDER BY updated_at DESC LIMIT 100`), /USING INDEX idx_platform_reviews_status/)
  assert.match(plan(`SELECT * FROM platform_reviews WHERE status = ? ORDER BY reviewed_at DESC LIMIT 30`), /USING INDEX idx_platform_reviews_shown/)
  assert.match(plan(`SELECT code FROM practice_pass_codes WHERE batch_id = ? LIMIT 500`), /USING (COVERING )?INDEX idx_practice_pass_codes_batch/)
  assert.match(plan(`SELECT currency FROM payment_charges WHERE tx_ref = ?`), /USING INDEX sqlite_autoindex_payment_charges/)
})
