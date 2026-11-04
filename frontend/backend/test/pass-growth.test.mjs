import test from 'node:test'
import assert from 'node:assert/strict'
import { sign } from '@tsndr/cloudflare-worker-jwt'
import { D1Shim, createLegacySchema } from './d1-shim.mjs'

// Phones hearing about notifications, monthly pass reminders with a button, term passes that last the term plus a
// month, no points for questions already mastered, tighter AI allowances, and paying for someone else by link.

const SECRET = 'pass-growth-secret'
let generation = 0

async function setup() {
  const worker = (await import(`./build/worker.mjs?growth=${generation++}`)).default
  const db = new D1Shim()
  createLegacySchema(db)
  db.db.exec(`
    DROP TABLE IF EXISTS tenants;
    CREATE TABLE tenants (id TEXT PRIMARY KEY, school_name TEXT, requested_subdomain TEXT, country TEXT, status TEXT, owner_email TEXT, discount_code TEXT);
    INSERT INTO tenants (id, school_name, requested_subdomain, country, status, owner_email) VALUES ('school-a', 'Genesis College', 'genesis', 'Nigeria', 'active', 'owner@a.test');
    CREATE TABLE IF NOT EXISTS subjects (id TEXT PRIMARY KEY, tenantId TEXT, name TEXT, classId TEXT, teacherId TEXT, createdAt TEXT);
    INSERT INTO classes (id, tenantId, name, arm) VALUES ('ss2a', 'school-a', 'SS 2', 'A'), ('jss1a', 'school-a', 'JSS 1', 'A');
    INSERT INTO subjects (id, tenantId, name, classId) VALUES ('m1', 'school-a', 'Mathematics', 'ss2a');
    CREATE TABLE IF NOT EXISTS parent_student_links (id TEXT PRIMARY KEY, parent_id TEXT, student_id TEXT, tenant_id TEXT, created_at TEXT);
    INSERT INTO parent_student_links VALUES ('l1', 'p-1', 's-1', 'school-a', 'x'), ('l2', 'p-2', 's-2', 'school-a', 'x');
  `)
  const person = async (id, email, name, role, extra = {}) => {
    await db.prepare('INSERT INTO users (id, email, name, role, primary_role, tenantId, status) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(id, email, name, role, role, role === 'ami' ? '' : 'school-a', 'active').run()
    await db.prepare('INSERT INTO settings (studentId, payload) VALUES (?, ?)').bind(email, JSON.stringify({ name, email, role, primaryRole: role, roles: [role], tenantId: role === 'ami' ? '' : 'school-a', schoolId: 'school-a', status: 'active', ...extra })).run()
  }
  await person('s-1', 'ada@a.test', 'Ada Obi', 'student', { classId: 'ss2a' })
  await person('s-2', 'bola@a.test', 'Bola Ade', 'student', { classId: 'jss1a' })
  await person('p-1', 'mum@a.test', 'Mrs Obi', 'parent')
  await person('p-2', 'dad@a.test', 'Mr Ade', 'parent')
  await person('o-1', 'owner@a.test', 'Owner', 'owner')
  await person('ami-1', 'ami@n.test', 'Ami', 'ami')
  const sent = { emails: [], pushes: [], payments: [] }
  const provider = { answer: null }
  globalThis.fetch = async (url, init) => {
    const target = String(url)
    if (target.includes('oauth')) return Response.json({ access_token: 'tok', expires_in: 3600 })
    if (target.includes('/messages')) { sent.emails.push(JSON.parse(init.body)); return Response.json({ status: { code: 200 }, data: {} }) }
    if (target.startsWith('https://push.example')) { sent.pushes.push({ target, ttl: init.headers.TTL }); return new Response('', { status: 201 }) }
    if (target.endsWith('/payments')) { sent.payments.push(JSON.parse(init.body)); return Response.json({ status: 'success', data: { link: 'https://checkout.example/pay' } }) }
    if (target.includes('verify_by_reference')) return Response.json({ status: 'success', data: provider.answer })
    throw new Error(`unexpected fetch ${target}`)
  }
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign'])
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey))
  const d = (await crypto.subtle.exportKey('jwk', pair.privateKey)).d
  const env = { APP_DB: db, JWT_SECRET: SECRET, FLUTTERWAVE_SECRET_KEY: 'x', ZOHO_MAIL_ACCOUNT_ID: 'a', ZOHO_MAIL_FROM_ADDRESS: 'f@n.test', ZOHO_MAIL_CLIENT_ID: 'a', ZOHO_MAIL_CLIENT_SECRET: 'b', ZOHO_MAIL_REFRESH_TOKEN: 'c', WEB_PUSH_VAPID_PUBLIC_KEY: Buffer.from(raw).toString('base64url'), WEB_PUSH_VAPID_PRIVATE_KEY: d }
  const WHO = { ada: ['ada@a.test', 'student'], bola: ['bola@a.test', 'student'], mum: ['mum@a.test', 'parent'], owner: ['owner@a.test', 'owner'], ami: ['ami@n.test', 'ami'] }
  const hit = async (path, init = {}) => {
    const response = await worker.fetch(new Request(`https://ndovera.com${path}`, { headers: { 'Content-Type': 'application/json', 'X-Practice-Device': 'device-growth-01', ...(init.headers || {}) }, method: init.method, body: init.body }), env, { waitUntil() {}, passThroughOnException() {} })
    return { status: response.status, body: await response.json().catch(() => ({})) }
  }
  const call = async (who, method, path, body) => {
    const [email, role] = WHO[who]
    const token = await sign({ id: email, email, role, roles: [role], tenantId: role === 'ami' ? '' : 'school-a', name: who === 'ada' ? 'Ada Obi' : who, exp: Math.floor(Date.now() / 1000) + 600 }, SECRET)
    return hit(path, { method, headers: { Authorization: `Bearer ${token}` }, body: body ? JSON.stringify(body) : undefined })
  }
  return { db, env, call, hit, sent, provider }
}
const tick = ctx => ctx.call('ami', 'POST', '/api/ami/pass-nudges/tick')
const CORE = ['english', 'mathematics', 'biology', 'chemistry', 'physics', 'government']
const stock = (ctx, ready) => { for (const exam of ['waec', 'neco', 'jamb']) for (const subject of CORE) ctx.db.db.prepare('INSERT INTO practice_exam_stock (exam, subject_key, ready) VALUES (?, ?, ?)').run(exam, subject, ready) }
const question = (ctx, id) => ctx.db.db.prepare(`INSERT INTO question_bank (id, tenant_id, subject, type, prompt, options_json, correct_index, status) VALUES (?, 'school-a', 'Mathematics', 'mcq', 'Q', '["1","2"]', 1, 'approved')`).run(id)

test('reminders reach students without a pass and their parents, with a button; senior parents also get an email', async () => {
  const ctx = await setup()
  await ctx.call('owner', 'GET', '/api/school/pass-nudges')
  const first = await tick(ctx); assert.equal(first.status, 200, JSON.stringify(first.body))
  ctx.db.db.exec(`DELETE FROM comm_inbox; DELETE FROM practice_nudge_runs;`)
  ctx.sent.emails.length = 0
  stock(ctx, 500)
  ctx.db.db.exec(`INSERT INTO practice_passes (id, tenant_id, student_id, bundle, starts_at, expires_at, source, created_at) VALUES ('x', 'school-a', 's-2', 'bece', 'x', '2099-01-01', 'payment', 'x')`)
  const result = await tick(ctx)
  assert.equal(result.status, 200, JSON.stringify(result.body))
  const inbox = ctx.db.db.prepare('SELECT user_id, link FROM comm_inbox ORDER BY user_id').all()
  assert.deepEqual(inbox.map(row => row.user_id), ['p-1', 's-1'], 'the student holding a pass, and their parent, hear nothing')
  assert.equal(inbox.find(row => row.user_id === 's-1').link, '/roles/student/practice?tab=passes')
  assert.equal(ctx.sent.emails.length, 1)
  assert.equal(ctx.sent.emails[0].toAddress, 'mum@a.test')
  for (const part of ['WAEC', 'JAMB', 'Buy a pass', '/roles/parent/practice-passes', 'Genesis College']) assert.ok(ctx.sent.emails[0].content.includes(part), part)

  const bell = await ctx.call('ada', 'GET', '/api/push/feed?roleKey=student')
  assert.equal(bell.body.notification.url, '/roles/student/practice?tab=passes', 'the phone opens straight on the passes')
  assert.equal(bell.body.notification.actionLabel, 'Buy pass')

  await tick(ctx)
  const count = ctx.db.db.prepare('SELECT COUNT(*) AS n FROM comm_inbox').get().n
  await tick(ctx)
  assert.equal(ctx.db.db.prepare('SELECT COUNT(*) AS n FROM comm_inbox').get().n, count, 'once a month for each school')
})

test('no exam email while exams are not on sale, or when a school turns reminders off', async () => {
  const ctx = await setup()
  await tick(ctx)
  assert.equal(ctx.sent.emails.length, 0, 'nothing to sell yet')
  assert.ok(ctx.db.db.prepare('SELECT COUNT(*) AS n FROM comm_inbox').get().n > 0)

  const off = await setup()
  assert.equal((await off.call('ada', 'PUT', '/api/school/pass-nudges', { off: true })).status, 403)
  await off.call('owner', 'PUT', '/api/school/pass-nudges', { off: true })
  assert.equal((await tick(off)).body.idle, true)
})

test('a phone registered under an email is woken for a notification naming the id, with a day to hear it', async () => {
  const ctx = await setup()
  await tick(ctx)
  ctx.db.db.exec(`DELETE FROM practice_nudge_runs; DELETE FROM comm_inbox;`)
  const saved = await ctx.call('ada', 'POST', '/api/push/subscriptions', { roleKey: 'student', subscription: { endpoint: 'https://push.example/phone1', keys: { p256dh: 'a', auth: 'b' } } })
  assert.equal(saved.status, 200, JSON.stringify(saved.body))
  ctx.sent.pushes.length = 0
  await tick(ctx)
  assert.ok(ctx.sent.pushes.some(push => push.target === 'https://push.example/phone1'), 'the student phone rang')
  assert.equal(ctx.sent.pushes[0].ttl, '86400')
})

test('a term pass lasts to the term end plus one month, and a new term can buy a new one', async () => {
  const ctx = await setup()
  ctx.db.db.exec(`CREATE TABLE IF NOT EXISTS academic_sessions (id TEXT PRIMARY KEY, tenant_id TEXT, name TEXT, start_date TEXT, end_date TEXT, status TEXT, created_at TEXT, updated_at TEXT);`)
  await ctx.call('ada', 'GET', '/api/practice-arena/home')
  const end = new Date(Date.now() + 40 * 86400_000).toISOString().slice(0, 10)
  ctx.db.db.exec(`DELETE FROM academic_sessions; INSERT INTO academic_sessions (id, tenant_id, name, start_date, end_date, status) VALUES ('sess', 'school-a', '2026/27', '2026-01-01', '2099-01-01', 'active');`)
  ctx.db.db.exec(`CREATE TABLE IF NOT EXISTS academic_terms (id TEXT PRIMARY KEY, tenant_id TEXT, session_id TEXT, name TEXT, sequence INTEGER, start_date TEXT, end_date TEXT, status TEXT);`)
  ctx.db.db.prepare(`INSERT INTO academic_terms (id, tenant_id, session_id, name, sequence, start_date, end_date, status) VALUES ('t1', 'school-a', 'sess', 'First', 1, '2026-01-01', ?, 'active')`).run(end)
  const started = await ctx.call('ada', 'POST', '/api/practice-arena/passes/checkout', { bundle: 'all' })
  assert.equal(started.status, 200, JSON.stringify(started.body))
  ctx.provider.answer = { status: 'successful', tx_ref: started.body.txRef, currency: 'NGN', amount: 1500, id: 1 }
  assert.equal((await ctx.call('ada', 'POST', '/api/practice-arena/passes/verify', { txRef: started.body.txRef })).body.paid, true)
  const pass = ctx.db.db.prepare(`SELECT term_id, expires_at FROM practice_passes WHERE student_id = 's-1'`).get()
  const days = (Date.parse(pass.expires_at) - Date.parse(end)) / 86400_000
  assert.ok(days >= 27 && days <= 32, `one month after the term, got ${days}`)
  assert.equal(pass.term_id, 't1')

  // Next term: still open during the month, and a new one can be bought.
  ctx.db.db.exec(`UPDATE academic_terms SET status = 'closed'; INSERT INTO academic_terms (id, tenant_id, session_id, name, sequence, start_date, end_date, status) VALUES ('t2', 'school-a', 'sess', 'Second', 2, '2026-05-01', '2099-01-01', 'active');`)
  const home = await ctx.call('ada', 'GET', '/api/practice-arena/home')
  assert.equal(home.body.passes.allSubjects, true)
  assert.equal(home.body.passes.allInGrace, true)
  ctx.db.db.exec(`UPDATE practice_passes SET expires_at = '2000-01-01'`)
  assert.equal((await ctx.call('ada', 'GET', '/api/practice-arena/home')).body.passes.allSubjects, false, 'and gone after that month')
})

test('free AI is one a day; reports get two free, then 50 credits, and a failure costs nothing', async () => {
  const ctx = await setup()
  const access = await ctx.call('owner', 'GET', '/api/ai/credit-bundles')
  assert.equal(access.body.freeDailyRequests, 1)
  const studentAccess = await ctx.call('ada', 'GET', '/api/ai/credit-bundles')
  assert.equal(studentAccess.body.freeDailyRequests, 1)

  ctx.env.AI = { run: async () => { if (ctx.aiDown) throw new Error('down'); return { response: 'A report.' } } }
  const report = () => ctx.call('owner', 'POST', '/api/students/s-1/ai-report', {})
  assert.equal((await report()).status, 200)
  assert.equal((await report()).status, 200)
  const third = await report()
  assert.equal(third.status, 402)
  assert.match(third.body.message, /50 AI credits/)
  ctx.db.db.exec(`UPDATE ai_report_usage SET used = 1`)
  ctx.aiDown = true
  assert.equal((await report()).status, 503)
  assert.equal(ctx.db.db.prepare('SELECT used FROM ai_report_usage').get().used, 1, 'the failed report was not counted')
})

test('someone else can pay by link, for the right price, with no account, and only once', async () => {
  const ctx = await setup()
  const made = await ctx.call('ada', 'POST', '/api/practice-arena/passes/pay-link', { bundle: 'all' })
  assert.equal(made.status, 201, JSON.stringify(made.body))
  assert.match(made.body.message, /Please help Ada/)
  const token = made.body.url.split('/pay/')[1]
  const path = `/api/public/pass-pay/${token}`
  const shown = await ctx.hit(path)
  assert.equal(shown.body.childName, 'Ada')
  assert.equal(shown.body.amountNaira, 1500)
  assert.ok(!JSON.stringify(shown.body).includes('Obi'), 'first name only')
  assert.ok(!JSON.stringify(shown.body).includes('ada@'), 'no address')
  assert.equal((await ctx.hit('/api/public/pass-pay/wrong')).status, 404)
  const post = (suffix, body) => ctx.hit(path + suffix, { method: 'POST', body: JSON.stringify(body) })
  assert.equal((await post('/checkout', { email: 'nope', amount: 1 })).status, 400)
  const checkout = await post('/checkout', { email: 'aunt@b.test', name: 'Aunt', amount: 1 })
  assert.equal(checkout.status, 200, JSON.stringify(checkout.body))
  const payment = ctx.sent.payments[0]
  assert.equal(payment.amount, 1500, 'the price is never the request\'s')
  assert.equal(payment.customer.email, 'aunt@b.test')
  assert.equal((await post('/confirm', { txRef: 'prac_other' })).status, 400)
  ctx.provider.answer = { status: 'successful', tx_ref: payment.tx_ref, currency: 'NGN', amount: 1500, id: 3 }
  assert.equal((await post('/confirm', { txRef: payment.tx_ref })).body.paid, true)
  assert.equal(ctx.db.db.prepare(`SELECT COUNT(*) AS n FROM practice_passes WHERE student_id = 's-1' AND bundle = 'all'`).get().n, 1)
  assert.equal((await ctx.hit(path)).body.paid, true)
  assert.equal((await post('/checkout', { email: 'aunt@b.test' })).status, 409, 'the pass is already held')
  ctx.db.db.exec(`UPDATE practice_pay_links SET expires_at = '2000-01-01'`)
  assert.equal((await post('/checkout', { email: 'x@b.test' })).status, 410)
})

test('bank transfer works for any payment: the account and amount show, and only Ami approving gives anything, once', async () => {
  const ctx = await setup()
  const started = await ctx.call('ada', 'POST', '/api/practice-arena/passes/checkout?payBy=bank', { bundle: 'all', amountNaira: 1 })
  assert.equal(started.status, 200, JSON.stringify(started.body))
  assert.equal(ctx.sent.payments.length, 0, 'no card page is opened')
  const id = started.body.checkoutUrl.split('/bank-pay/')[1]
  const claim = await ctx.hit(`/api/public/bank-pay/${id}`)
  assert.equal(claim.body.accountNumber, '8064252542')
  assert.equal(claim.body.accountName, 'Ndovera Limited')
  assert.equal(claim.body.bankName, 'Moniepoint')
  assert.equal(claim.body.payNaira, 1500, 'the price is never the request\'s')
  assert.equal(claim.body.status, 'opened')
  assert.equal((await ctx.call('ami', 'GET', '/api/ami/bank-claims')).body.claims.length, 0, 'Ami sees it only after "I have paid"')
  const paid = await ctx.hit(`/api/public/bank-pay/${id}/paid`, { method: 'POST', body: JSON.stringify({ reference: 'TRF9' }) })
  assert.equal(paid.body.status, 'waiting')
  assert.match(paid.body.whatsappUrl, /^https:\/\/wa\.me\/2348128882800\?text=/)
  assert.ok(decodeURIComponent(paid.body.whatsappUrl).includes(id))
  const passes = () => ctx.db.db.prepare(`SELECT COUNT(*) AS n FROM practice_passes WHERE student_id = 's-1'`).get().n
  assert.equal(passes(), 0, 'pressing "I have paid" gives nothing yet')
  assert.equal((await ctx.call('owner', 'GET', '/api/ami/bank-claims')).status, 403)
  assert.equal((await ctx.call('ada', 'POST', `/api/ami/bank-claims/${id}`, { decision: 'approve' })).status, 403)
  assert.equal((await ctx.call('ami', 'POST', `/api/ami/bank-claims/${id}`, { decision: 'approve' })).status, 200)
  assert.equal(passes(), 1)
  assert.equal((await ctx.call('ami', 'POST', `/api/ami/bank-claims/${id}`, { decision: 'approve' })).status, 404, 'decided once')
  assert.equal(passes(), 1)

  const second = await ctx.call('bola', 'POST', '/api/practice-arena/passes/checkout?payBy=bank', { bundle: 'all' })
  const other = second.body.checkoutUrl.split('/bank-pay/')[1]
  await ctx.hit(`/api/public/bank-pay/${other}/paid`, { method: 'POST', body: '{}' })
  await ctx.call('ami', 'POST', `/api/ami/bank-claims/${other}`, { decision: 'reject' })
  assert.equal(ctx.db.db.prepare(`SELECT COUNT(*) AS n FROM practice_passes WHERE student_id = 's-2'`).get().n, 0, 'a rejected claim gives nothing')
})

test('bank transfer also settles extra email and phone changes; abroad it is the price plus 20% in naira', async () => {
  const ctx = await setup()
  const started = await ctx.call('owner', 'POST', '/api/school/contact-changes/buy?payBy=bank', {})
  assert.equal(started.status, 200, JSON.stringify(started.body))
  const id = started.body.checkoutUrl.split('/bank-pay/')[1]
  await ctx.hit(`/api/public/bank-pay/${id}/paid`, { method: 'POST', body: '{}' })
  assert.equal((await ctx.call('ami', 'POST', `/api/ami/bank-claims/${id}`, { decision: 'approve' })).status, 200)
  assert.equal((await ctx.call('owner', 'GET', '/api/school/contact-changes')).body.extra, 5)
  ctx.db.db.exec(`UPDATE tenants SET country = 'Ghana'`)
  const abroad = await ctx.call('owner', 'POST', '/api/school/contact-changes/buy?payBy=bank', {})
  const shown = await ctx.hit(`/api/public/bank-pay/${abroad.body.checkoutUrl.split('/bank-pay/')[1]}`)
  assert.equal(shown.body.payNaira, 1800)
})

test('whole-class invitations, the portal link, and notifications that clear', async () => {
  const ctx = await setup()
  const made = await ctx.call('owner', 'POST', '/api/school/parent-invites/bulk', { studentIds: ['s-1', 's-2'] })
  assert.equal(made.status, 201, JSON.stringify(made.body))
  assert.equal(made.body.invites.length, 2)
  assert.notEqual(made.body.invites[0].url, made.body.invites[1].url)
  assert.equal((await ctx.call('ada', 'POST', '/api/school/parent-invites/bulk', { studentIds: ['s-1'] })).status, 403)
  const portal = await ctx.call('owner', 'GET', '/api/school/portal-link')
  assert.match(portal.body.url, /\/login$/)
  await tick(ctx)
  const bell = await ctx.call('ada', 'GET', '/api/communications/inbox')
  assert.equal(bell.status, 200, JSON.stringify(bell.body))
  const row = ctx.db.db.prepare(`SELECT id FROM comm_inbox WHERE user_id = 's-1'`).get()
  const read = await ctx.call('ada', 'POST', '/api/communications/inbox/read', { ids: [row.id] })
  assert.equal(read.status, 200, JSON.stringify(read.body))
  assert.ok(ctx.db.db.prepare('SELECT read_at FROM comm_inbox WHERE id = ?').get(row.id).read_at)
})

test('existing term passes get the new length when a school is reminded', async () => {
  const ctx = await setup()
  await tick(ctx)
  ctx.db.db.exec(`DELETE FROM practice_nudge_runs`)
  const termId = `year-${new Date(Date.now() + 3600_000).getUTCFullYear()}`
  ctx.db.db.prepare(`INSERT INTO practice_passes (id, tenant_id, student_id, bundle, term_id, starts_at, expires_at, source, created_at) VALUES ('old', 'school-a', 's-1', 'all', ?, 'x', NULL, 'payment', 'x')`).run(termId)
  await tick(ctx)
  assert.ok(ctx.db.db.prepare(`SELECT expires_at FROM practice_passes WHERE id = 'old'`).get().expires_at)
})

test('a question answered right before earns nothing, and full marks on repeats asks for new questions', async () => {
  const ctx = await setup()
  await ctx.call('ada', 'GET', '/api/practice-arena/home')
  const add = id => ctx.db.db.prepare(`INSERT INTO question_bank (id, tenant_id, subject, type, prompt, normalized_prompt, question_hash, options_json, answer_json, status, source, created_at, updated_at, section, level_rank, subject_key, playable)
    VALUES (?, 'school-a', 'Mathematics', 'mcq', ?, ?, ?, '["3","4"]', '"4"', 'approved', 'test', 'x', 'x', 'senior', 11, 'mathematics', 1)`).run(id, `Question ${id}`, `question ${id}`, `h-${id}`)
  for (const id of ['q1', 'q2', 'q3', 'q4', 'q5', 'q6']) add(id)
  let number = 0
  const play = (ids, pick = 1) => ctx.call('ada', 'POST', '/api/practice-arena/attempts', { id: `attempt_growth_${number += 1}_abcdef`, subjectKey: 'mathematics', subjectName: 'Mathematics', mode: 'quick', durationSec: 60, finishedAt: new Date().toISOString(), answers: ids.map(questionId => ({ questionId, response: pick })) })
  const FIVE = ['q1', 'q2', 'q3', 'q4', 'q5']

  const first = await play(FIVE)
  assert.equal(first.status, 200, JSON.stringify(first.body))
  assert.ok(first.body.attempt.xp > 0, 'new questions earn')
  assert.equal(first.body.needNewQuestions, false)
  const xpAfterFirst = first.body.profile.xp

  const repeat = await play(FIVE)
  assert.equal(repeat.body.attempt.percent, 100)
  assert.equal(repeat.body.attempt.xp, 0, 'the same questions, right again, earn nothing')
  assert.equal(repeat.body.needNewQuestions, true)
  assert.equal(repeat.body.profile.xp, xpAfterFirst)

  const mixed = await play(['q1', 'q6'])
  assert.ok(mixed.body.attempt.xp > 0, 'a new question among them still earns')
  assert.equal(mixed.body.needNewQuestions, false)
})
