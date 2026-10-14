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
    mum: ['mum', 'mum@a', ['parent'], 'school-a'],
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
  const view = (await call('bursar', 'GET', '/api/school/finance/simple/accounts/chi')).body
  assert.deepEqual([view.unbilled, view.standardFee], [true, 170000])
  // Opening Fees creates the account at the class fees; nobody has to press a button.
  const counts = (await call('owner', 'GET', '/api/school/finance/simple/overview')).body.counts
  assert.deepEqual([counts.autoBilled, counts.unbilled], [1, 0])
  assert.equal((await call('bursar', 'POST', '/api/school/finance/simple/bill-new', { studentIds: ['chi'] })).body.students, 0, 'already billed')
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

test('last term on the earlier Fee Template is reused exactly — class fees and every student-specific fee — then saved and billed as this term', async () => {
  const { call, db } = await setup()
  const now = new Date().toISOString()
  // Third Term 2025/2026 lived in the Fee Template: JSS 1 pays 100,000 tuition + 5,000 PTA;
  // ADA was on 80,000 tuition and no PTA; BOLA's own row equals the class amount (not special).
  db.db.exec(`INSERT INTO fees_config (id, tenant_id, fee_type, class_id, student_id, amount, session, term, sort_order, updated_at) VALUES
    ('f1', 'school-a', 'Tuition', 'jss1', NULL, 100000, '2025/2026', 'Third Term', 0, '${now}'),
    ('f2', 'school-a', 'PTA', 'jss1', NULL, 5000, '2025/2026', 'Third Term', 1, '${now}'),
    ('f3', 'school-a', 'Tuition', NULL, 'ada', 80000, '2025/2026', 'Third Term', 0, '${now}'),
    ('f4', 'school-a', 'PTA', NULL, 'ada', 0, '2025/2026', 'Third Term', 1, '${now}'),
    ('f5', 'school-a', 'Tuition', NULL, 'bola', 100000, '2025/2026', 'Third Term', 0, '${now}'),
    ('f6', 'school-a', 'Transport', NULL, 'bola', 30000, '2025/2026', 'Third Term', 2, '${now}')`)

  const overview = (await call('hos', 'GET', '/api/school/finance/simple/overview')).body
  assert.deepEqual(overview.reuse.map(option => [option.sessionName, option.termName, option.origin]), [['2025/2026', 'Third Term', 'template']])
  const source = (await call('hos', 'GET', '/api/school/finance/simple/source?termId=t26-1&from=t25-3')).body
  assert.equal(source.found, true)
  assert.deepEqual(source.rows.find(row => row.classId === 'jss1').amounts, { Tuition: 100000, PTA: 5000 })
  const own = Object.fromEntries(source.students.map(row => [row.studentId, row.amounts]))
  assert.deepEqual(own, { ada: { Tuition: 80000, PTA: 0 }, bola: { Transport: 30000 } })

  // Edit (ADA now 85,000) and save as First Term's fees, carrying the student-specific fees.
  const students = source.students.map(row => (row.studentId === 'ada' ? { ...row, amounts: { ...row.amounts, Tuition: 85000 } } : row))
  const saved = await call('hos', 'PUT', '/api/school/finance/simple/grid', { termId: 't26-1', columns: source.columns, rows: source.rows, students })
  assert.equal(saved.status, 200, JSON.stringify(saved.body))
  const grid = (await call('hos', 'GET', '/api/school/finance/simple/grid?termId=t26-1')).body
  assert.ok(grid.grid.columns.some(column => column.name === 'Transport'), 'an item only one student pays keeps its column')
  assert.equal(grid.grid.students.length, 2)

  await call('hos', 'POST', '/api/school/finance/simple/lock', { termId: 't26-1' })
  const accounts = (await call('bursar', 'GET', '/api/school/finance/simple/accounts')).body.accounts
  assert.equal(account(accounts, 'ada').termFee, 85000)
  assert.equal(account(accounts, 'bola').termFee, 135000)

  // A change to a billed student's own fee asks first, then is applied with a reason.
  const changed = students.map(row => (row.studentId === 'bola' ? { ...row, amounts: { Transport: 20000 } } : row))
  await call('hos', 'POST', '/api/school/finance/simple/lock', { termId: 't26-1', unlock: true, reason: 'transport' })
  const asked = await call('hos', 'PUT', '/api/school/finance/simple/grid', { termId: 't26-1', columns: source.columns, rows: source.rows, students: changed })
  assert.deepEqual([asked.status, asked.body.affectedStudents], [409, 1])
  assert.equal((await call('hos', 'PUT', '/api/school/finance/simple/grid', { termId: 't26-1', columns: source.columns, rows: source.rows, students: changed, changeMode: 'adjust_existing' })).status, 200)
  const bola = account((await call('bursar', 'GET', '/api/school/finance/simple/accounts')).body.accounts, 'bola')
  assert.equal(bola.totalPayable, 125000)
})

test('reusing fees can write off earlier debts instead of carrying them in, and every write-off is recorded', async () => {
  const { call, db } = await setup()
  await lastTerm(call)
  await call('bursar', 'POST', '/api/school/finance/simple/accounts/ada/pay', { amount: 125000 })
  backdate(db)
  const before = (await call('owner', 'GET', '/api/school/finance/simple/grid?termId=t26-1')).body
  assert.deepEqual(before.earlierDebts, { students: 2, total: 195000 })
  assert.equal((await call('owner', 'PUT', '/api/school/finance/simple/grid', { termId: 't26-1', ...GRID, debtMode: 'write_off' })).status, 200)
  const locked = await call('owner', 'POST', '/api/school/finance/simple/lock', { termId: 't26-1' })
  assert.deepEqual(locked.body.writtenOff, { students: 2, amount: 195000 })
  const ada = account((await call('bursar', 'GET', '/api/school/finance/simple/accounts')).body.accounts, 'ada')
  assert.deepEqual([ada.outstanding, ada.totalPayable], [0, 160000])
  const audit = db.db.prepare(`SELECT COUNT(*) AS n FROM finance_audit WHERE action = 'debts_written_off'`).get()
  assert.equal(audit.n, 1)
  // Once written off, the choice cannot quietly flip back.
  await call('owner', 'POST', '/api/school/finance/simple/lock', { termId: 't26-1', unlock: true, reason: 'x' })
  assert.equal((await call('owner', 'PUT', '/api/school/finance/simple/grid', { termId: 't26-1', ...GRID, debtMode: 'carry' })).status, 409)
})

test('a student turned off leaves the fee list and class register at once; still-owing leavers are one filter away', async () => {
  const { call, db } = await setup()
  await call('owner', 'PUT', '/api/school/finance/simple/grid', { termId: 't26-1', ...GRID })
  await call('owner', 'POST', '/api/school/finance/simple/lock', { termId: 't26-1' })
  db.db.exec(`UPDATE users SET status = 'inactive' WHERE id = 'bola'`)
  const list = (await call('bursar', 'GET', '/api/school/finance/simple/accounts')).body.accounts
  assert.deepEqual(list.map(item => item.studentId).sort(), ['ada', 'chi'])
  const left = (await call('bursar', 'GET', '/api/school/finance/simple/accounts?status=left')).body.accounts
  assert.deepEqual(left.map(item => [item.studentId, item.left]), [['bola', true]])
  db.db.exec(`UPDATE users SET status = 'active' WHERE id = 'bola'`)
  assert.equal((await call('bursar', 'GET', '/api/school/finance/simple/accounts')).body.accounts.length, 3)
})

test('class fees: a student in a class with an empty row is still billed their own amounts', async () => {
  const { call } = await setup()
  const rows = [{ classId: 'jss1', amounts: {} }, { classId: 'jss2', amounts: { Tuition: 140000 } }]
  const saved = await call('owner', 'PUT', '/api/school/finance/simple/grid', { termId: 't26-1', columns: [{ name: 'Tuition' }], rows, students: [{ studentId: 'ada', amounts: { Tuition: 50000 } }] })
  assert.equal(saved.status, 200, JSON.stringify(saved.body))
  await call('owner', 'POST', '/api/school/finance/simple/lock', { termId: 't26-1' })
  const accounts = (await call('bursar', 'GET', '/api/school/finance/simple/accounts')).body.accounts
  assert.equal(account(accounts, 'ada').termFee, 50000)
  assert.equal(account(accounts, 'bola').status, 'not_billed') // JSS 1 pays nothing as a class
})

test('individual student fees: each student pays only what is entered for them; class rows are just starting amounts', async () => {
  const { call } = await setup()
  const saved = await call('hos', 'PUT', '/api/school/finance/simple/grid', {
    termId: 't26-1', feeMode: 'student', ...GRID,
    students: [{ studentId: 'ada', amounts: { Tuition: 120000, Books: 20000 } }, { studentId: 'bola', amounts: { Tuition: 90000 } }],
  })
  assert.equal(saved.status, 200, JSON.stringify(saved.body))
  const grid = (await call('hos', 'GET', '/api/school/finance/simple/grid?termId=t26-1')).body.grid
  assert.equal(grid.feeMode, 'student')
  await call('hos', 'POST', '/api/school/finance/simple/lock', { termId: 't26-1' })
  const accounts = (await call('bursar', 'GET', '/api/school/finance/simple/accounts')).body.accounts
  assert.deepEqual([account(accounts, 'ada').termFee, account(accounts, 'bola').termFee], [140000, 90000])
  assert.equal(account(accounts, 'chi').status, 'not_billed') // nothing entered for CHI yet
})

test('reusing a term brings its settings and lists students who were not at the school then, for their fees to be entered', async () => {
  const { call, db } = await setup()
  db.db.exec(`UPDATE users SET createdAt = '2026-05-01T08:00:00.000Z' WHERE id IN ('ada', 'bola'); UPDATE users SET createdAt = '2026-09-02T08:00:00.000Z' WHERE id = 'chi'`)
  await call('owner', 'PUT', '/api/school/finance/simple/grid', { termId: 't25-3', feeMode: 'student', ...GRID, students: [{ studentId: 'ada', amounts: { Tuition: 100000 } }] })
  const source = (await call('owner', 'GET', '/api/school/finance/simple/source?termId=t26-1&from=t25-3')).body
  assert.equal(source.feeMode, 'student')
  assert.deepEqual(source.newStudents.map(student => student.studentId), ['chi'])
})

test('save as draft changes nobody; publish bills everyone; published fees stay editable and changes for billed students ask first', async () => {
  const { call } = await setup()
  const draft = await call('owner', 'PUT', '/api/school/finance/simple/grid', { termId: 't26-1', action: 'draft', ...GRID, feeMode: 'class', debtMode: 'carry' })
  assert.equal(draft.status, 200, JSON.stringify(draft.body))
  const grid = (await call('owner', 'GET', '/api/school/finance/simple/grid?termId=t26-1')).body
  assert.deepEqual([grid.grid.configured, grid.draft.payload.rows[0].amounts.Tuition], [false, 130000])
  assert.equal((await call('owner', 'GET', '/api/school/finance/simple/overview')).body.hasDraft, true)
  assert.equal(account((await call('bursar', 'GET', '/api/school/finance/simple/accounts')).body.accounts, 'ada').status, 'not_billed')

  const published = await call('owner', 'PUT', '/api/school/finance/simple/grid', { termId: 't26-1', action: 'publish', ...GRID })
  assert.equal(published.status, 200, JSON.stringify(published.body))
  assert.equal(published.body.published.students, 2) // CHI has no class yet
  assert.equal((await call('owner', 'GET', '/api/school/finance/simple/grid?termId=t26-1')).body.draft, null)
  assert.equal(account((await call('bursar', 'GET', '/api/school/finance/simple/accounts')).body.accounts, 'ada').termFee, 160000)

  // Published, and still editable without unlocking: a draft first, then publish with a decision.
  const raised = { ...GRID, rows: GRID.rows.map(row => ({ ...row, amounts: { ...row.amounts, Tuition: row.amounts.Tuition + 10000 } })) }
  assert.equal((await call('owner', 'PUT', '/api/school/finance/simple/grid', { termId: 't26-1', action: 'draft', ...raised })).status, 200)
  assert.equal(account((await call('bursar', 'GET', '/api/school/finance/simple/accounts')).body.accounts, 'ada').termFee, 160000) // a draft bills nobody
  const asked = await call('owner', 'PUT', '/api/school/finance/simple/grid', { termId: 't26-1', action: 'publish', ...raised })
  assert.deepEqual([asked.status, asked.body.needsDecision], [409, true])
  const done = await call('owner', 'PUT', '/api/school/finance/simple/grid', { termId: 't26-1', action: 'publish', ...raised, changeMode: 'adjust_existing' })
  assert.equal(done.status, 200, JSON.stringify(done.body))
  assert.equal(account((await call('bursar', 'GET', '/api/school/finance/simple/accounts')).body.accounts, 'ada').totalPayable, 170000)
})

test('only current students are listed; a student who left keeps their own fees on file for when they are restored', async () => {
  const { call, db } = await setup()
  const students = [{ studentId: 'ada', amounts: { Tuition: 90000 } }, { studentId: 'bola', amounts: { Tuition: 70000 } }]
  await call('owner', 'PUT', '/api/school/finance/simple/grid', { termId: 't26-1', ...GRID, students })
  db.db.exec(`UPDATE users SET status = 'inactive' WHERE id = 'bola'`)
  const listed = (await call('owner', 'GET', '/api/school/finance/simple/grid?termId=t26-1')).body
  assert.deepEqual(listed.grid.students.map(row => row.studentId), ['ada'])
  assert.ok(!listed.students.some(row => row.studentId === 'bola'))
  // Saving the page (which shows only ADA) keeps BOLA's amounts.
  await call('owner', 'PUT', '/api/school/finance/simple/grid', { termId: 't26-1', ...GRID, students: [{ studentId: 'ada', amounts: { Tuition: 95000 } }] })
  db.db.exec(`UPDATE users SET status = 'active' WHERE id = 'bola'`)
  const back = (await call('owner', 'GET', '/api/school/finance/simple/grid?termId=t26-1')).body.grid.students
  assert.deepEqual(Object.fromEntries(back.map(row => [row.studentId, row.amounts.Tuition])), { ada: 95000, bola: 70000 })
})

test('receipts can be fetched many at once, and each one verifies on the school web address', async () => {
  const { call, db } = await setup()
  db.db.exec(`CREATE TABLE IF NOT EXISTS tenants (id TEXT PRIMARY KEY, requested_subdomain TEXT, website_domain TEXT, school_name TEXT)`)
  db.db.exec(`INSERT OR REPLACE INTO tenants (id, requested_subdomain, school_name) VALUES ('school-a', 'greenfield', 'Greenfield School')`)
  await call('owner', 'PUT', '/api/school/finance/simple/grid', { termId: 't26-1', action: 'publish', ...GRID })
  const paid = []
  for (const student of ['ada', 'bola']) paid.push((await call('bursar', 'POST', `/api/school/finance/simple/accounts/${student}/pay`, { amount: 50000, method: 'cash' })).body)
  assert.match(paid[0].receipt.verificationUrl || '', /^https:\/\/greenfield\.ndovera\.com\/receipt-verification\/RCT-/)
  const all = (await call('bursar', 'POST', '/api/school/finance/simple/receipts', { paymentIds: paid.map(result => result.paymentId) })).body
  assert.equal(all.receipts.length, 2)
  assert.ok(all.receipts.every(receipt => receipt.verificationUrl && receipt.snapshot.amountPaid === 50000))
})

test('fees filter per family: a parent\'s children together, findable by the parent\'s name too', async () => {
  const { call, db } = await setup()
  await db.prepare('INSERT INTO users (id, email, name, role, tenantId, status) VALUES (?, ?, ?, ?, ?, ?)').bind('mrs-obi', 'obi@a', 'Mrs Obi', 'parent', 'school-a', 'active').run()
  db.db.exec(`CREATE TABLE IF NOT EXISTS parent_student_links (tenant_id TEXT, parent_id TEXT, student_id TEXT)`)
  db.db.exec(`INSERT INTO parent_student_links (tenant_id, parent_id, student_id) VALUES ('school-a', 'obi@a', 'ada'), ('school-a', 'mrs-obi', 'bola')`)
  await call('owner', 'PUT', '/api/school/finance/simple/grid', { termId: 't26-1', action: 'publish', ...GRID })
  const all = (await call('bursar', 'GET', '/api/school/finance/simple/accounts')).body
  assert.deepEqual(all.families.map(family => [family.id, family.name, family.children]), [['mrs-obi', 'Mrs Obi', 2]]) // linked by email and by id: one family
  const family = (await call('bursar', 'GET', '/api/school/finance/simple/accounts?familyId=mrs-obi')).body
  assert.deepEqual(family.accounts.map(account => account.studentId).sort(), ['ada', 'bola'])
  assert.equal(family.families.length, 1) // the choices stay complete while one family is shown
  assert.deepEqual((await call('bursar', 'GET', '/api/school/finance/simple/accounts?q=obi')).body.accounts.map(account => account.studentId).sort(), ['ada', 'bola'])
})

test('a receipt records the term figures it was issued against, for the designed receipt', async () => {
  const { call } = await setup()
  await call('owner', 'PUT', '/api/school/finance/simple/grid', { termId: 't26-1', action: 'publish', ...GRID })
  await call('bursar', 'POST', '/api/school/finance/simple/accounts/ada/pay', { amount: 40000, method: 'cash' })
  const paid = (await call('bursar', 'POST', '/api/school/finance/simple/accounts/ada/pay', { amount: 20000, method: 'transfer' })).body
  const snap = paid.receipt.snapshot
  assert.deepEqual([snap.className, snap.termName, snap.sessionName, snap.totalPayable, snap.paidToDate], ['JSS 1', 'First Term', '2026/2027', 160000, 60000])
  const again = (await call('bursar', 'GET', '/api/school/finance/simple/accounts/ada')).body.receipts.find(receipt => receipt.receiptNo === paid.receipt.receiptNo)
  assert.equal(again.snapshot.paidToDate, 60000) // kept on the receipt as issued
})

test('parents get each receipt in their Ndovera account, with its check link; the message names it and opens it', async () => {
  const { call, db } = await setup()
  db.db.exec(`CREATE TABLE IF NOT EXISTS tenants (id TEXT PRIMARY KEY, requested_subdomain TEXT, website_domain TEXT, school_name TEXT)`)
  db.db.exec(`INSERT OR REPLACE INTO tenants (id, requested_subdomain, school_name) VALUES ('school-a', 'greenfield', 'Greenfield School')`)
  db.db.exec(`CREATE TABLE IF NOT EXISTS parent_student_links (tenant_id TEXT, parent_id TEXT, student_id TEXT)`)
  db.db.exec(`INSERT INTO parent_student_links (tenant_id, parent_id, student_id) VALUES ('school-a', 'mum', 'ada')`)
  // The school has switched parent notifications on (nothing is sent until it does).
  db.db.exec(`CREATE TABLE IF NOT EXISTS comm_settings (tenant_id TEXT PRIMARY KEY, payload TEXT NOT NULL, updated_by TEXT, updated_at TEXT)`)
  db.db.exec(`INSERT OR REPLACE INTO comm_settings (tenant_id, payload) VALUES ('school-a', '{"active":true,"events":{"receipt":true,"fee_bill":true}}')`)

  // Publishing from Fee Setup tells the families their fees are ready.
  await call('owner', 'PUT', '/api/school/finance/simple/grid', { termId: 't26-1', action: 'publish', ...GRID })
  // Notifications are recorded after the response (in the background), so wait for them.
  const eventOf = async type => { for (let i = 0; i < 50; i += 1) { const row = (() => { try { return db.db.prepare(`SELECT facts, link FROM comm_events WHERE type = ?`).get(type) } catch { return null } })(); if (row) return row; await new Promise(resolve => setTimeout(resolve, 20)) } return null }
  const bill = await eventOf('fee_bill')
  assert.ok(bill, 'publishing notifies parents of the new fees')

  const paid = (await call('bursar', 'POST', '/api/school/finance/simple/accounts/ada/pay', { amount: 50000, method: 'cash' })).body
  const event = await eventOf('receipt')
  assert.equal(JSON.parse(event.facts).receiptNo, paid.receipt.receiptNo)
  assert.ok(event.link.endsWith(`/roles/parent/fees?receipt=${encodeURIComponent(paid.receipt.receiptNo)}&student=ada`), event.link)

  const mine = (await call('mum', 'GET', '/api/school/finance/my-accounts')).body
  const receipt = mine.accounts.find(account => account.studentId === 'ada').receipts.find(item => item.receiptNo === paid.receipt.receiptNo)
  assert.match(receipt.verificationUrl, /^https:\/\/greenfield\.ndovera\.com\/receipt-verification\/RCT-/)
  assert.equal(receipt.snapshot.paidToDate, 50000)
})

test('autosaved drafts write no audit entry; publishing bills everyone; late joiners get accounts on their own; HOS records payments; reports by class', async () => {
  const { call, db } = await setup()
  const audits = () => db.db.prepare(`SELECT COUNT(*) AS n FROM finance_audit WHERE action = 'term_fees_draft_saved'`).get().n
  // Autosave keeps the work without an audit row each time; a manual save is audited.
  assert.equal((await call('owner', 'PUT', '/api/school/finance/simple/grid', { termId: 't26-1', ...GRID, action: 'draft', autosave: true })).status, 200)
  assert.equal(audits(), 0)
  assert.equal((await call('owner', 'PUT', '/api/school/finance/simple/grid', { termId: 't26-1', ...GRID, action: 'draft' })).status, 200)
  assert.equal(audits(), 1)

  // Publishing creates every current student's account; CHI has no class yet, so no fees, and is named.
  const published = await call('owner', 'PUT', '/api/school/finance/simple/grid', { termId: 't26-1', ...GRID, action: 'publish' })
  assert.equal(published.status, 200, JSON.stringify(published.body))
  assert.deepEqual([published.body.published.students, published.body.published.noFees], [2, ['CHI']])
  assert.equal((await call('owner', 'GET', '/api/school/finance/simple/overview')).body.counts.noFees, 1)

  // CHI is put in JSS 2 after publishing: the next time Fees is opened, CHI's account exists.
  db.db.exec(`UPDATE session_enrollments SET class_id = 'jss2', class_name = 'JSS 2' WHERE student_id = 'chi' AND session_id = 's26'`)
  const overview = (await call('owner', 'GET', '/api/school/finance/simple/overview')).body
  assert.deepEqual([overview.counts.autoBilled, overview.counts.unbilled, overview.counts.students], [1, 0, 3])
  const list = (await call('hos', 'GET', '/api/school/finance/simple/accounts')).body
  assert.equal(list.canRecordPayments, true)
  assert.equal(account(list.accounts, 'chi').termFee, 170000)
  // Opening Fees again writes nothing more.
  assert.equal((await call('owner', 'GET', '/api/school/finance/simple/overview')).body.counts.autoBilled, 0)

  // The Head of School records a payment by hand.
  const paid = await call('hos', 'POST', '/api/school/finance/simple/accounts/chi/pay', { amount: 70000, method: 'cash' })
  assert.equal(paid.status, 200, JSON.stringify(paid.body))
  assert.ok(paid.body.receipt.receiptNo)

  // Reports: each student by class, and the class fee table.
  const reports = (await call('bursar', 'GET', '/api/school/finance/simple/reports')).body
  assert.deepEqual(reports.feeTable.columns, ['Tuition', 'Books', 'ICT'])
  assert.equal(reports.feeTable.rows.find(row => row.classId === 'jss2').amounts.Tuition, 140000)
  const chi = reports.students.find(student => student.studentId === 'chi')
  assert.deepEqual([chi.className, chi.paid, chi.balance], ['JSS 2', 70000, 100000])
  assert.equal(reports.byClass.find(row => row.className === 'JSS 2').collected, 70000)
  db.close?.()
})
