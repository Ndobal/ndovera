import test from 'node:test'
import assert from 'node:assert/strict'
import { sign } from '@tsndr/cloudflare-worker-jwt'
import { D1Shim, createLegacySchema } from './d1-shim.mjs'

// The simple fee workflow, end to end:
// reuse last term → edit → save → lock (accounts created, outstanding carried)
// → pay (oldest first) → charges, discounts → permissions → changes after billing
// → new students → class moves.

const SECRET = 'simple-fees-secret'
let generation = 0

async function setup() {
  const worker = (await import(`./build/worker.mjs?simplefees=${generation++}`)).default
  const db = new D1Shim()
  createLegacySchema(db)
  const people = {
    owner: ['own', 'owner@a', ['owner'], 'school-a'], hos: ['hos', 'hos@a', ['teacher', 'hos'], 'school-a'], bursar: ['bursar', 'bursar@a', ['accountant'], 'school-a'],
    ada: ['ada', 'ada@a', ['student'], 'school-a'], bola: ['bola', 'bola@a', ['student'], 'school-a'], chi: ['chi', 'chi@a', ['student'], 'school-a'],
  }
  for (const [id, email, roles, tenant] of Object.values(people)) {
    await db.prepare('INSERT INTO users (id, email, name, role, tenantId, status) VALUES (?, ?, ?, ?, ?, ?)').bind(id, email, id.toUpperCase(), roles[0], tenant, 'active').run()
    await db.prepare('INSERT INTO settings (studentId, payload) VALUES (?, ?)').bind(email, JSON.stringify({ name: id.toUpperCase(), email, role: roles[0], roles, tenantId: tenant, status: 'active' })).run()
  }
  db.db.exec(`INSERT INTO classes (id, tenantId, name, arm) VALUES ('jss1', 'school-a', 'JSS 1', ''), ('jss2', 'school-a', 'JSS 2', '');`)
  const call = async (person, method, path, body) => {
    const [id, , roles, tenantId] = people[person]
    const token = await sign({ id, role: roles[roles.length - 1], roles, tenantId, name: id.toUpperCase(), exp: Math.floor(Date.now() / 1000) + 600 }, SECRET)
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'X-Selected-Role': roles[roles.length - 1] }
    const response = await worker.fetch(new Request(`https://ndovera.com${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined }), { APP_DB: db, JWT_SECRET: SECRET }, { waitUntil() {}, passThroughOnException() {} })
    return { status: response.status, body: await response.json().catch(() => ({})) }
  }
  assert.equal((await call('owner', 'GET', '/api/school/finance/context')).status, 200) // creates the tables
  const now = new Date().toISOString()
  db.db.exec(`
    INSERT INTO academic_sessions (id, tenant_id, name, start_date, end_date, status, created_at, updated_at) VALUES
      ('s25', 'school-a', '2025/2026', '2025-09-01', '2026-07-31', 'completed', '${now}', '${now}'),
      ('s26', 'school-a', '2026/2027', '2026-09-01', '2027-07-31', 'active', '${now}', '${now}');
    INSERT INTO academic_terms (id, tenant_id, session_id, name, sequence, start_date, end_date, status, created_at, updated_at) VALUES
      ('t25-3', 'school-a', 's25', 'Third Term', 3, '2026-04-20', '2026-07-31', 'completed', '${now}', '${now}'),
      ('t26-1', 'school-a', 's26', 'First Term', 1, '2026-09-07', '2026-12-18', 'active', '${now}', '${now}');
    INSERT INTO session_enrollments (id, tenant_id, session_id, session_name, student_id, student_name, class_id, class_name, status, created_at, updated_at) VALUES
      ('e1', 'school-a', 's25', '2025/2026', 'ada', 'ADA', 'jss1', 'JSS 1', 'active', '${now}', '${now}'),
      ('e2', 'school-a', 's25', '2025/2026', 'bola', 'BOLA', 'jss1', 'JSS 1', 'active', '${now}', '${now}'),
      ('e3', 'school-a', 's26', '2026/2027', 'ada', 'ADA', 'jss1', 'JSS 1', 'active', '${now}', '${now}'),
      ('e4', 'school-a', 's26', '2026/2027', 'bola', 'BOLA', 'jss1', 'JSS 1', 'active', '${now}', '${now}');
  `)
  return { db, call }
}

const GRID = {
  columns: [{ name: 'Tuition' }, { name: 'Books' }, { name: 'ICT' }],
  rows: [
    { classId: 'jss1', amounts: { Tuition: 130000, Books: 20000, ICT: 10000 } },
    { classId: 'jss2', amounts: { Tuition: 140000, Books: 20000, ICT: 10000 } },
  ],
}
const account = (accounts, id) => accounts.find(item => item.studentId === id)

/** Last term set up and locked. */
async function lastTerm(call) {
  assert.equal((await call('owner', 'PUT', '/api/school/finance/simple/grid', { termId: 't25-3', ...GRID })).status, 200)
  assert.equal((await call('owner', 'POST', '/api/school/finance/simple/lock', { termId: 't25-3' })).status, 200)
}

/** Payments recorded during last term: dated in July, before First Term began. */
function backdate(db) {
  db.db.exec(`UPDATE fee_obligation_allocations SET created_at = '2026-07-01T10:00:00.000Z'; UPDATE fee_payments SET recorded_at = '2026-07-01T10:00:00.000Z', paid_on = '2026-07-01'`)
}

test('a new term: set up from last term in a few steps, lock, and every account shows Term Fee + Outstanding = Total Payable', async () => {
  const { call, db } = await setup()
  // Nothing configured yet: the dashboard prompts setup instead of showing zeros.
  const empty = await call('owner', 'GET', '/api/school/finance/simple/overview')
  assert.equal(empty.body.configured, false)
  assert.equal(empty.body.term.name, 'First Term')

  await lastTerm(call)
  // During Third Term: ADA pays 125,000 of 160,000; BOLA pays in full.
  const last = await call('bursar', 'POST', '/api/school/finance/simple/accounts/ada/pay', { amount: 125000, method: 'transfer' })
  assert.equal(last.status, 200, JSON.stringify(last.body))
  await call('bursar', 'POST', '/api/school/finance/simple/accounts/bola/pay', { amount: 160000, method: 'cash' })
  backdate(db)

  // Reuse: last term's table, tuition +10%, saved for this term.
  const overview = await call('owner', 'GET', '/api/school/finance/simple/overview')
  assert.deepEqual(overview.body.reuse.map(option => option.termName), ['Third Term'])
  const source = (await call('owner', 'GET', '/api/school/finance/simple/grid?termId=t25-3')).body.grid
  const rows = source.rows.map(row => ({ classId: row.classId, amounts: { ...row.amounts, Tuition: Math.round(row.amounts.Tuition * 1.1) } }))
  const saved = await call('owner', 'PUT', '/api/school/finance/simple/grid', { termId: 't26-1', columns: source.columns, rows })
  assert.equal(saved.status, 200, JSON.stringify(saved.body))
  assert.equal(saved.body.grid.rows.find(row => row.classId === 'jss1').amounts.Tuition, 143000)
  // Third Term's table is untouched.
  assert.equal((await call('owner', 'GET', '/api/school/finance/simple/grid?termId=t25-3')).body.grid.rows.find(row => row.classId === 'jss1').amounts.Tuition, 130000)

  const locked = await call('owner', 'POST', '/api/school/finance/simple/lock', { termId: 't26-1' })
  assert.deepEqual([locked.status, locked.body.students, locked.body.lock.locked], [200, 2, true])

  const accounts = (await call('bursar', 'GET', '/api/school/finance/simple/accounts')).body.accounts
  const ada = account(accounts, 'ada')
  assert.deepEqual([ada.termFee, ada.outstanding, ada.totalPayable, ada.paid, ada.balance, ada.status], [173000, 35000, 208000, 0, 208000, 'unpaid'])
  const bola = account(accounts, 'bola')
  assert.deepEqual([bola.outstanding, bola.totalPayable], [0, 173000])

  // Outstanding Fee history: where the ₦35,000 came from.
  const statement = (await call('bursar', 'GET', '/api/school/finance/simple/accounts/ada')).body.statement
  assert.equal(statement.lines[0].description, 'Outstanding Fee')
  assert.equal(statement.outstandingSources.reduce((sum, source) => sum + source.carriedForward, 0), 35000)
  assert.ok(statement.outstandingSources.every(source => source.termName === 'Third Term'))

  // Dashboard figures are the accounts added up.
  const dashboard = (await call('owner', 'GET', '/api/school/finance/simple/overview')).body
  assert.deepEqual([dashboard.configured, dashboard.locked, dashboard.cards.expected, dashboard.cards.outstanding], [true, true, 381000, 381000])
  db.close?.()
})

test('payments need no choices: oldest debt first, extra kept as credit; charges and discounts need reasons', async () => {
  const { call, db } = await setup()
  await lastTerm(call)
  await call('bursar', 'POST', '/api/school/finance/simple/accounts/ada/pay', { amount: 125000 })
  backdate(db)
  const source = (await call('owner', 'GET', '/api/school/finance/simple/grid?termId=t25-3')).body.grid
  await call('owner', 'PUT', '/api/school/finance/simple/grid', { termId: 't26-1', columns: source.columns, rows: source.rows.map(row => ({ classId: row.classId, amounts: row.amounts })) })
  await call('owner', 'POST', '/api/school/finance/simple/lock', { termId: 't26-1' })

  // 50,000: the 35,000 outstanding is cleared first, then 15,000 of this term.
  const paid = await call('bursar', 'POST', '/api/school/finance/simple/accounts/ada/pay', { amount: 50000, method: 'pos', reference: 'POS-1' })
  assert.equal(paid.status, 200, JSON.stringify(paid.body))
  assert.ok(paid.body.receipt.receiptNo)
  assert.equal(paid.body.receipt.snapshot.items[0].termName, 'Third Term')
  let ada = account((await call('bursar', 'GET', '/api/school/finance/simple/accounts')).body.accounts, 'ada')
  assert.deepEqual([ada.totalPayable, ada.paid, ada.balance, ada.status], [195000, 50000, 145000, 'part_payment'])

  // Lost textbook +5,000; scholarship −20,000.
  assert.equal((await call('bursar', 'POST', '/api/school/finance/simple/accounts/ada/charge', { description: 'Lost textbook', amount: 5000 })).status, 200)
  assert.equal((await call('bursar', 'POST', '/api/school/finance/simple/accounts/ada/adjust', { kind: 'scholarship', amount: 20000 })).status, 400, 'reason required')
  assert.equal((await call('bursar', 'POST', '/api/school/finance/simple/accounts/ada/adjust', { kind: 'scholarship', amount: 20000, reason: 'Merit scholarship' })).status, 200)
  ada = account((await call('bursar', 'GET', '/api/school/finance/simple/accounts')).body.accounts, 'ada')
  assert.deepEqual([ada.otherCharges, ada.discounts, ada.totalPayable, ada.balance], [5000, 20000, 180000, 130000])

  // Paying more than owed leaves credit, and the account shows Overpaid.
  await call('bursar', 'POST', '/api/school/finance/simple/accounts/ada/pay', { amount: 140000 })
  ada = account((await call('bursar', 'GET', '/api/school/finance/simple/accounts')).body.accounts, 'ada')
  assert.deepEqual([ada.balance, ada.status], [-10000, 'overpaid'])
  const audit = (await call('owner', 'GET', '/api/school/finance/audit?studentId=ada')).body.entries.map(entry => entry.action)
  for (const action of ['charge_added', 'adjustment_scholarship', 'payment_recorded']) assert.ok(audit.includes(action), action)
})

test('the Owner decides who can change fees; locked fees cannot change; changes after billing need a decision', async () => {
  const { call } = await setup()
  await call('owner', 'PUT', '/api/school/finance/simple/grid', { termId: 't26-1', ...GRID })
  assert.equal((await call('hos', 'PUT', '/api/school/finance/simple/settings', { feeEditMode: 'owner_only' })).status, 403)
  assert.equal((await call('owner', 'PUT', '/api/school/finance/simple/settings', { feeEditMode: 'owner_only' })).status, 200)
  assert.equal((await call('hos', 'PUT', '/api/school/finance/simple/grid', { termId: 't26-1', ...GRID })).status, 403)
  assert.equal((await call('bursar', 'POST', '/api/school/finance/simple/lock', { termId: 't26-1' })).status, 403)
  await call('owner', 'PUT', '/api/school/finance/simple/settings', { feeEditMode: 'owner_accountant' })
  assert.equal((await call('bursar', 'POST', '/api/school/finance/simple/lock', { termId: 't26-1' })).status, 200)
  // Payments stay open to the accountant whatever the setting.
  await call('owner', 'PUT', '/api/school/finance/simple/settings', { feeEditMode: 'owner_only' })
  assert.equal((await call('bursar', 'POST', '/api/school/finance/simple/accounts/bola/pay', { amount: 1000 })).status, 200)

  // Locked: no edits until unlocked.
  const raised = { termId: 't26-1', columns: GRID.columns, rows: [{ classId: 'jss1', amounts: { Tuition: 140000, Books: 20000, ICT: 10000 } }, GRID.rows[1]] }
  assert.equal((await call('owner', 'PUT', '/api/school/finance/simple/grid', raised)).status, 423)
  await call('owner', 'POST', '/api/school/finance/simple/lock', { termId: 't26-1', unlock: true, reason: 'Tuition review' })

  // Already billed: Ndovera asks first.
  const ask = await call('owner', 'PUT', '/api/school/finance/simple/grid', raised)
  assert.equal(ask.status, 409)
  assert.equal(ask.body.needsDecision, true)
  assert.equal(ask.body.affectedStudents, 2)
  assert.deepEqual(ask.body.changes.map(change => [change.item, change.from, change.to, change.students]), [['Tuition', 130000, 140000, 2]])

  // Future students only: existing bills unchanged.
  assert.equal((await call('owner', 'PUT', '/api/school/finance/simple/grid', { ...raised, changeMode: 'future_only' })).status, 200)
  let ada = account((await call('owner', 'GET', '/api/school/finance/simple/accounts')).body.accounts, 'ada')
  assert.equal(ada.totalPayable, 160000)

  // Apply to everyone billed: a ₦10,000 audited adjustment each.
  const higher = { ...raised, rows: [{ classId: 'jss1', amounts: { Tuition: 150000, Books: 20000, ICT: 10000 } }, GRID.rows[1]] }
  assert.equal((await call('owner', 'PUT', '/api/school/finance/simple/grid', { ...higher, changeMode: 'adjust_existing' })).status, 200)
  ada = account((await call('owner', 'GET', '/api/school/finance/simple/accounts')).body.accounts, 'ada')
  assert.deepEqual([ada.termFee, ada.otherCharges, ada.totalPayable], [160000, 10000, 170000])
})

test('a student who joins after locking gets their class fees; a class move asks before changing anything', async () => {
  const { call, db } = await setup()
  await call('owner', 'PUT', '/api/school/finance/simple/grid', { termId: 't26-1', ...GRID })
  await call('owner', 'POST', '/api/school/finance/simple/lock', { termId: 't26-1' })
  const now = new Date().toISOString()
  // Chi joins JSS 2 after the fees were locked.
  db.db.exec(`DELETE FROM session_enrollments WHERE student_id = 'chi'; INSERT INTO session_enrollments (id, tenant_id, session_id, session_name, student_id, student_name, class_id, class_name, status, created_at, updated_at) VALUES ('e5', 'school-a', 's26', '2026/2027', 'chi', 'CHI', 'jss2', 'JSS 2', 'active', '${now}', '${now}')`)
  assert.equal((await call('owner', 'GET', '/api/school/finance/simple/overview')).body.counts.unbilled, 1)
  const view = (await call('bursar', 'GET', '/api/school/finance/simple/accounts/chi')).body
  assert.deepEqual([view.unbilled, view.standardFee], [true, 170000])
  assert.equal((await call('bursar', 'POST', '/api/school/finance/simple/bill-new', { studentIds: ['chi'] })).body.created, 3)
  assert.equal(account((await call('bursar', 'GET', '/api/school/finance/simple/accounts')).body.accounts, 'chi').totalPayable, 170000)

  // Bola moves from JSS 1 to JSS 2.
  db.db.exec(`UPDATE session_enrollments SET class_id = 'jss2', class_name = 'JSS 2' WHERE id = 'e4'`)
  let bola = account((await call('bursar', 'GET', '/api/school/finance/simple/accounts')).body.accounts, 'bola')
  assert.deepEqual(bola.classMove, { fromClassId: 'jss1', toClassId: 'jss2' })
  assert.equal(bola.totalPayable, 160000, 'nothing changed by itself')
  assert.equal((await call('bursar', 'POST', '/api/school/finance/simple/accounts/bola/class-move', { decision: 'difference' })).status, 200)
  bola = account((await call('bursar', 'GET', '/api/school/finance/simple/accounts')).body.accounts, 'bola')
  assert.deepEqual([bola.classMove, bola.totalPayable], [null, 170000])
})

test('a term without a usable start date still splits Outstanding correctly, using when its fees were first billed', async () => {
  const { call, db } = await setup()
  db.db.exec(`UPDATE academic_terms SET start_date = '' WHERE id = 't26-1'`)
  await lastTerm(call)
  await call('bursar', 'POST', '/api/school/finance/simple/accounts/ada/pay', { amount: 125000 })
  backdate(db)
  await call('owner', 'PUT', '/api/school/finance/simple/grid', { termId: 't26-1', ...GRID })
  await call('owner', 'POST', '/api/school/finance/simple/lock', { termId: 't26-1' })
  await call('bursar', 'POST', '/api/school/finance/simple/accounts/ada/pay', { amount: 50000 })
  const ada = account((await call('bursar', 'GET', '/api/school/finance/simple/accounts')).body.accounts, 'ada')
  // 35,000 carried in from Third Term; the 50,000 paid this term counts as paid, not as a smaller outstanding.
  assert.deepEqual([ada.outstanding, ada.termFee, ada.totalPayable, ada.paid, ada.balance], [35000, 160000, 195000, 50000, 145000])
})
