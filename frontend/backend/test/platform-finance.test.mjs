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

test('what a school owes is stated: invoices sent, drafts, and an estimate when no bill is raised', async () => {
  const { db, call, ami } = await setup()
  const now = new Date().toISOString()
  db.db.prepare(`INSERT INTO tenants (id, school_name, school_slug, owner_name, owner_email, owner_phone, plan_key, requested_subdomain, website_domain, status, approval_status, payment_status, website_status, setup_fee_cents, student_fee_cents, created_at, updated_at, activated_at)
    VALUES ('school-c', 'Cotter Academy', 'school-c', 'Mr C', 'c@c.test', '', 'growth', 'school-c', 'school-c.ndovera.com', 'active', 'approved', 'paid', 'active', 5000000, 50000, ?, ?, ?)`).run(now, now, now)
  db.db.exec(`INSERT INTO school_sessions (id, tenantId, session, term, createdAt) VALUES ('s3', 'school-c', '2026/2027', 'First Term', '2026-09-01')`)
  for (let index = 0; index < 10; index += 1) await db.prepare('INSERT INTO users (id, email, name, role, tenantId, status) VALUES (?, ?, ?, ?, ?, ?)').bind(`stu-${index}`, `stu${index}@c.test`, `Student ${index}`, 'student', 'school-c', 'active').run()
  const { kpis, schools } = (await call(ami, 'GET', '/api/platform/finance')).body
  const cotter = schools.find(school => school.tenantId === 'school-c')
  assert.deepEqual([cotter.thisTerm.basis, cotter.thisTerm.students, cotter.thisTerm.rate, cotter.thisTerm.owed, cotter.totalOwed], ['estimate', 10, 500, 5000, 5000])
  assert.match(cotter.thisTerm.note, /10 students × ₦500/)
  const bright = schools.find(school => school.tenantId === 'school-b')
  assert.deepEqual([bright.thisTerm.basis, bright.totalOwed], ['invoiced', 20000])
  const genesis = schools.find(school => school.tenantId === 'school-a')
  assert.deepEqual([genesis.thisTerm.basis, genesis.totalOwed, genesis.paid], ['paid', 0, 107500])
  assert.deepEqual([kpis.owedTotal, kpis.outstanding, kpis.owedNotInvoiced, kpis.schoolsPaid, kpis.collectedThisTerm], [25000, 20000, 5000, 1, 107500])
})

test('profit and loss counts monthly running costs and splits school fees from onboarding', async () => {
  const { call, ami } = await setup()
  const current = new Date().toISOString().slice(0, 7)
  assert.equal((await call(ami, 'POST', '/api/ami/finance/recurring', { category: 'Hosting & infrastructure', description: 'Cloudflare', amount: 20000, startMonth: current })).status, 200)
  assert.equal((await call(ami, 'POST', '/api/ami/finance/recurring', { description: 'x', amount: 0 })).status, 400)
  await call(ami, 'POST', '/api/ami/finance/ledger', { kind: 'expense', category: 'Marketing', amount: 12000, description: 'Flyers' })
  const paidMonth = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 7)
  const pnl = await call(ami, 'GET', `/api/platform/pnl?from=${paidMonth}&to=${current}`)
  assert.equal(pnl.status, 200, JSON.stringify(pnl.body))
  const { totals, categories, analysis } = pnl.body
  assert.deepEqual([totals.termFees, totals.onboarding, totals.revenue, totals.expenses, totals.net], [57500, 50000, 107500, 32000, 75500])
  assert.deepEqual(categories.map(row => row.category), ['Hosting & infrastructure', 'Marketing'])
  assert.equal(analysis.currentRunningCost, 20000)
  // The finance report's money out includes the running cost too.
  assert.equal((await call(ami, 'GET', '/api/platform/finance')).body.kpis.expenses, 32000)
})

test('shares: register with capital, profit shared by the formula, payouts recorded, shareholders read their due', async () => {
  const { call, ami } = await setup()
  const issue = (email, name, shares, capital) => call(ami, 'POST', '/api/ami/shares/events', { kind: 'issue', email, name, shares, capital, occurredOn: '2025-01-01' })
  assert.equal((await issue('a@x.test', 'Ade', 600, 600000)).status, 200)
  assert.equal((await issue('b@x.test', 'Bola', 400, 400000)).status, 200)
  assert.equal((await call(ami, 'POST', '/api/ami/shares/events', { kind: 'transfer', email: 'a@x.test', toEmail: 'c@x.test', toName: 'Chidi', shares: 100, occurredOn: '2025-01-02' })).status, 200)
  assert.equal((await call(ami, 'POST', '/api/ami/shares/events', { kind: 'redeem', email: 'c@x.test', shares: 101 })).status, 400)
  let shares = (await call(ami, 'GET', '/api/platform/shares')).body
  assert.deepEqual(shares.register.holders.map(row => [row.name, row.shares, row.capital, row.pct]), [['Ade', 500, 500000, 50], ['Bola', 400, 400000, 40], ['Chidi', 100, 100000, 10]])
  assert.equal(shares.register.totalCapital, 1000000)
  assert.equal(shares.policy.retentionPct, 30)
  assert.equal((await call(ami, 'POST', '/api/ami/shares/policy', { retentionPct: 20, frequency: 'yearly' })).status, 200)
  // January 2025 made ₦100,000 (other income); 20% is kept, ₦80,000 is shared 50/40/10.
  await call(ami, 'POST', '/api/ami/finance/ledger', { kind: 'income', category: 'Other income', amount: 100000, description: 'Training', occurredOn: '2025-01-15' })
  const declared = await call(ami, 'POST', '/api/ami/shares/dividends', { fromMonth: '2025-01', toMonth: '2025-01' })
  assert.equal(declared.status, 200, JSON.stringify(declared.body))
  assert.deepEqual([declared.body.retainedCents, declared.body.distributableCents], [2000000, 8000000])
  assert.deepEqual(declared.body.lines.map(line => line.amountCents), [4000000, 3200000, 800000])
  assert.equal((await call(ami, 'POST', '/api/ami/shares/dividends', { fromMonth: '2025-01', toMonth: '2025-02' })).status, 409)
  assert.equal((await call(ami, 'POST', '/api/ami/shares/dividends', { fromMonth: '2025-03', toMonth: '2025-03' })).status, 400)
  shares = (await call(ami, 'GET', '/api/platform/shares')).body
  const line = shares.dividends[0].lines.find(row => row.email === 'b@x.test')
  assert.equal((await call(ami, 'POST', `/api/ami/shares/dividend-lines/${line.id}/pay`, { reference: 'GTB 123' })).status, 200)
  shares = (await call(ami, 'GET', '/api/platform/shares')).body
  assert.deepEqual(shares.dues.filter(row => row.declared).map(row => [row.name, row.declared, row.paid, row.due]), [['Ade', 40000, 0, 40000], ['Chidi', 8000, 0, 8000], ['Bola', 32000, 32000, 0]])
  assert.equal((await call(ami, 'POST', `/api/ami/shares/dividends/${shares.dividends[0].id}/void`)).status, 409)
  const holder = { id: 'a@x.test', email: 'a@x.test', role: 'shareholder', name: 'Ade' }
  const mine = await call(holder, 'GET', '/api/platform/shares')
  assert.equal(mine.status, 200)
  assert.deepEqual([mine.body.canManage, mine.body.mine.due], [false, 40000])
  assert.equal((await call(holder, 'POST', '/api/ami/shares/events', { kind: 'issue', email: 'z@x.test', name: 'Z', shares: 1 })).status, 403)
})

test('audit trail and reports show the recorded actions and real figures', async () => {
  const { call, ami } = await setup()
  await call(ami, 'POST', '/api/ami/finance/ledger', { kind: 'expense', category: 'Marketing', amount: 5000, description: 'Flyers' })
  await call(ami, 'POST', '/api/ami/shares/events', { kind: 'issue', email: 'a@x.test', name: 'Ade', shares: 10 })
  const logs = await call(ami, 'GET', '/api/ami/audit-logs')
  assert.equal(logs.status, 200, JSON.stringify(logs.body))
  const issued = logs.body.logs.find(entry => entry.actionKey === 'sharesIssued')
  assert.ok(issued)
  assert.deepEqual([issued.action, issued.actor, issued.target], ['Shares issued', 'Ami Admin (ami)', 'Ndovera finance & pricing'])
  const searched = (await call(ami, 'GET', '/api/ami/audit-logs?search=ledger')).body.logs
  assert.deepEqual(searched.map(entry => entry.actionKey), ['platformLedgerRecorded'])
  const summary = await call(ami, 'GET', '/api/ami/reports/summary')
  assert.equal(summary.status, 200, JSON.stringify(summary.body))
  assert.deepEqual([summary.body.schools.total, summary.body.schools.active, summary.body.finance.collectedAllTime, summary.body.finance.owedTotal], [2, 2, 107500, 20000])
  assert.ok(summary.body.activity.total >= 2)
  const holder = { id: 'a@x.test', email: 'a@x.test', role: 'shareholder', name: 'Ade' }
  assert.equal((await call(holder, 'GET', '/api/ami/audit-logs')).status, 403)
})
