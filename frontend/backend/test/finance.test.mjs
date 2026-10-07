import test from 'node:test'
import assert from 'node:assert/strict'
import { sign } from '@tsndr/cloudflare-worker-jwt'
import { D1Shim, createLegacySchema } from './d1-shim.mjs'

// Fees & billing (finance.ts) through the Worker: structures, bills, explicit
// allocation, arrears, adjustments, reversals, receipts, claims, archives and
// the dashboard — and that schools never see each other's money.

const SECRET = 'finance-test-secret'
let generation = 0

async function setup() {
  const worker = (await import(`./build/worker.mjs?finance=${generation++}`)).default
  const db = new D1Shim()
  createLegacySchema(db)
  const people = {
    owner: ['own', 'owner@a', 'owner', 'school-a'], hos: ['hos', 'hos@a', 'hos', 'school-a'], bursar: ['bursar', 'bursar@a', 'accountant', 'school-a'],
    teacher: ['tee', 'tee@a', 'teacher', 'school-a'], ada: ['ada', 'ada@a', 'student', 'school-a'], bola: ['bola', 'bola@a', 'student', 'school-a'],
    mum: ['mum', 'mum@a', 'parent', 'school-a'], otherOwner: ['own-b', 'owner@b', 'owner', 'school-b'],
  }
  for (const [id, email, role, tenant] of Object.values(people)) {
    await db.prepare('INSERT INTO users (id, email, name, role, tenantId, status) VALUES (?, ?, ?, ?, ?, ?)').bind(id, email, id.toUpperCase(), role, tenant, 'active').run()
    await db.prepare('INSERT INTO settings (studentId, payload) VALUES (?, ?)').bind(email, JSON.stringify({ name: id.toUpperCase(), email, role, tenantId: tenant, status: 'active', ...(role === 'student' ? { classId: 'jss1' } : {}) })).run()
  }
  db.db.exec(`INSERT INTO classes (id, tenantId, name, arm) VALUES ('jss1', 'school-a', 'JSS 1', ''), ('jssb', 'school-b', 'JSS 1', '');`)
  const call = async (person, method, path, body) => {
    const [id, , role, tenantId] = people[person]
    const token = await sign({ id, role, roles: [role], tenantId, name: id.toUpperCase(), exp: Math.floor(Date.now() / 1000) + 600 }, SECRET)
    const response = await worker.fetch(new Request(`https://ndovera.com${path}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }),
      { APP_DB: db, JWT_SECRET: SECRET }, { waitUntil() {}, passThroughOnException() {} })
    return { status: response.status, body: await response.json().catch(() => ({})) }
  }
  // Creates the finance and academic tables.
  assert.equal((await call('owner', 'GET', '/api/school/finance/context')).status, 200)
  const now = new Date().toISOString()
  db.db.exec(`
    INSERT INTO academic_sessions (id, tenant_id, name, start_date, end_date, status, created_at, updated_at) VALUES
      ('s25', 'school-a', '2025/2026', '2025-09-01', '2026-07-31', 'completed', '${now}', '${now}'),
      ('s26', 'school-a', '2026/2027', '2026-09-01', '2027-07-31', 'active', '${now}', '${now}');
    INSERT INTO academic_terms (id, tenant_id, session_id, name, sequence, start_date, end_date, status, created_at, updated_at) VALUES
      ('t25-3', 'school-a', 's25', 'Third Term', 3, '2026-04-20', '2026-07-31', 'completed', '${now}', '${now}'),
      ('t26-1', 'school-a', 's26', 'First Term', 1, '2026-09-01', '2026-12-18', 'active', '${now}', '${now}');
    INSERT INTO session_enrollments (id, tenant_id, session_id, session_name, student_id, student_name, class_id, class_name, status, created_at, updated_at) VALUES
      ('e1', 'school-a', 's25', '2025/2026', 'ada', 'ADA', 'jss1', 'JSS 1', 'active', '${now}', '${now}'),
      ('e2', 'school-a', 's25', '2025/2026', 'bola', 'BOLA', 'jss1', 'JSS 1', 'active', '${now}', '${now}'),
      ('e3', 'school-a', 's26', '2026/2027', 'ada', 'ADA', 'jss1', 'JSS 1', 'active', '${now}', '${now}'),
      ('e4', 'school-a', 's26', '2026/2027', 'bola', 'BOLA', 'jss1', 'JSS 1', 'active', '${now}', '${now}');
    CREATE TABLE IF NOT EXISTS parent_student_links (id TEXT PRIMARY KEY, parent_id TEXT, student_id TEXT, tenant_id TEXT, created_at TEXT);
    INSERT INTO parent_student_links (id, parent_id, student_id, tenant_id, created_at) VALUES ('l1', 'mum', 'ada', 'school-a', '${now}');
  `)
  return { db, call }
}

const ITEMS = [
  { name: 'Tuition', amount: 100000, required: true, frequency: 'term' },
  { name: 'Development levy', amount: 20000, required: true, frequency: 'annual' },
  { name: 'Transport', amount: 15000, required: false, frequency: 'term' },
]

async function publishAndIssue(call, termId, items = ITEMS) {
  const created = await call('hos', 'POST', '/api/school/finance/structures', { termId, classId: 'jss1', items })
  assert.equal(created.status, 200, JSON.stringify(created.body))
  const id = created.body.structure.id
  assert.equal((await call('hos', 'POST', `/api/school/finance/structures/${id}/status`, { status: 'published' })).status, 200)
  const issued = await call('hos', 'POST', `/api/school/finance/structures/${id}/issue`)
  assert.equal(issued.status, 200, JSON.stringify(issued.body))
  return { id, structure: created.body.structure, issued: issued.body }
}

test('structures: HOS creates, publishes and issues bills; optional items only for those who take them; never billed twice', async () => {
  const { call } = await setup()
  const created = await call('hos', 'POST', '/api/school/finance/structures', { termId: 't26-1', classId: 'jss1', items: ITEMS })
  const id = created.body.structure.id
  assert.equal(created.body.structure.status, 'draft')
  assert.equal((await call('hos', 'POST', `/api/school/finance/structures/${id}/issue`)).status, 409, 'drafts cannot bill')
  assert.equal((await call('teacher', 'POST', '/api/school/finance/structures', { termId: 't26-1', classId: 'jss1', items: ITEMS })).status, 403)
  assert.equal((await call('hos', 'POST', '/api/school/finance/structures', { termId: 't26-1', classId: 'jss1', items: ITEMS })).status, 409, 'one structure per class per term')

  const transport = created.body.structure.items.find(item => item.name === 'Transport')
  assert.equal((await call('hos', 'POST', `/api/school/finance/items/${transport.id}/optins`, { studentIds: ['ada'] })).status, 200)
  await call('hos', 'POST', `/api/school/finance/structures/${id}/status`, { status: 'published' })
  const issued = await call('hos', 'POST', `/api/school/finance/structures/${id}/issue`)
  assert.equal(issued.body.issued, 5) // Ada: 3 items, Bola: 2
  const again = await call('hos', 'POST', `/api/school/finance/structures/${id}/issue`)
  assert.deepEqual([again.body.issued, again.body.alreadyBilled], [0, 5])

  // Bills issued: the structure cannot slip back to draft, and editing it does not reprice bills.
  assert.equal((await call('hos', 'POST', `/api/school/finance/structures/${id}/status`, { status: 'draft' })).status, 409)
  await call('hos', 'PUT', `/api/school/finance/structures/${id}`, { items: [{ ...ITEMS[0], amount: 999999 }, ITEMS[1], ITEMS[2]] })
  const account = await call('bursar', 'GET', '/api/school/finance/students/ada/account')
  assert.equal(account.body.current.find(charge => charge.feeItem === 'Tuition').amount, 100000)
  assert.equal(account.body.totals.currentTermOutstanding, 135000)
})

test('reuse a previous structure: preview, edit, save as new; the original is untouched', async () => {
  const { call } = await setup()
  const first = await publishAndIssue(call, 't25-3')
  const preview = await call('owner', 'GET', `/api/school/finance/structures/${first.id}/copy-preview`)
  assert.equal(preview.body.items.length, 3)
  const edited = preview.body.items.map(item => item.name === 'Tuition' ? { ...item, amount: 110000 } : item)
  const copy = await call('owner', 'POST', '/api/school/finance/structures', { termId: 't26-1', classId: 'jss1', items: edited, copiedFromId: first.id })
  assert.equal(copy.status, 200)
  assert.equal(copy.body.structure.copiedFromId, first.id)
  const original = (await call('owner', 'GET', '/api/school/finance/structures?termId=t25-3')).body.structures[0]
  assert.equal(original.items.find(item => item.name === 'Tuition').amount, 100000)
})

test('arrears stay separate, payments are allocated per charge, receipts snapshot, reversals undo without deleting', async () => {
  const { call, db } = await setup()
  await publishAndIssue(call, 't25-3', [ITEMS[0]])
  await publishAndIssue(call, 't26-1', [ITEMS[0], ITEMS[1]])

  let account = (await call('bursar', 'GET', '/api/school/finance/students/bola/account')).body
  assert.equal(account.totals.previousOutstanding, 100000)
  assert.equal(account.totals.currentTermOutstanding, 120000)
  assert.equal(account.totals.totalOutstanding, 220000)
  const arrear = account.previousOutstanding[0]
  const tuition = account.current.find(charge => charge.feeItem === 'Tuition')
  assert.equal(arrear.termName, 'Third Term')

  // Allocations must add up and may not exceed what a charge owes.
  assert.equal((await call('bursar', 'POST', '/api/school/finance/students/bola/payments', { amount: 50000, allocations: [{ obligationId: arrear.id, amount: 40000 }] })).status, 400)
  assert.equal((await call('bursar', 'POST', '/api/school/finance/students/bola/payments', { amount: 150000, allocations: [{ obligationId: arrear.id, amount: 150000 }] })).status, 400)
  assert.equal((await call('teacher', 'POST', '/api/school/finance/students/bola/payments', { amount: 1, allocations: [{ obligationId: arrear.id, amount: 1 }] })).status, 403)

  const paid = await call('bursar', 'POST', '/api/school/finance/students/bola/payments', {
    amount: 130000, method: 'transfer', reference: 'TRF-1', payerName: 'Mr Bola', idempotencyKey: 'k1',
    allocations: [{ obligationId: arrear.id, amount: 100000 }, { obligationId: tuition.id, amount: 30000 }],
  })
  assert.equal(paid.status, 200, JSON.stringify(paid.body))
  const snapshot = paid.body.receipt.snapshot
  assert.deepEqual([snapshot.previousBalance, snapshot.amountPaid, snapshot.remainingBalance, snapshot.items.length], [220000, 130000, 90000, 2])
  assert.equal((await call('bursar', 'POST', '/api/school/finance/students/bola/payments', { amount: 130000, idempotencyKey: 'k1', allocations: [] })).body.duplicate, true)

  account = (await call('bursar', 'GET', '/api/school/finance/students/bola/account')).body
  assert.equal(account.totals.previousOutstanding, 0)
  assert.equal(account.current.find(charge => charge.feeItem === 'Tuition').status, 'partially_paid')
  const settled = (await call('bursar', 'GET', '/api/school/finance/archives?status=settled')).body.obligations
  assert.deepEqual(settled.map(row => [row.studentId, row.termName, row.status]), [['bola', 'Third Term', 'paid']])

  // Payments against last session's debts, made during this term.
  const crossPeriod = (await call('bursar', 'GET', '/api/school/finance/archives?view=payments&debtSessionNot=s26')).body.payments
  assert.deepEqual(crossPeriod.map(row => [row.studentId, row.amount]), [['bola', 100000]])

  // Reverse: the payment stays, a reversal sits beside it, balances come back, the receipt is marked.
  assert.equal((await call('bursar', 'POST', `/api/school/finance/payments/${paid.body.paymentId}/reverse`, {})).status, 400, 'a reason is required')
  assert.equal((await call('bursar', 'POST', `/api/school/finance/payments/${paid.body.paymentId}/reverse`, { reason: 'Transfer bounced' })).status, 200)
  assert.equal((await call('bursar', 'POST', `/api/school/finance/payments/${paid.body.paymentId}/reverse`, { reason: 'again' })).status, 409)
  account = (await call('bursar', 'GET', '/api/school/finance/students/bola/account')).body
  assert.equal(account.totals.totalOutstanding, 220000)
  assert.deepEqual(account.payments.map(row => row.status).sort(), ['reversal', 'reversed'])
  assert.equal(account.receipts[0].status, 'reversed')
  const audit = (await call('owner', 'GET', '/api/school/finance/audit?studentId=bola')).body.entries.map(row => row.action)
  for (const action of ['payment_recorded', 'payment_allocated', 'payment_reversed']) assert.ok(audit.includes(action), action)
  const stored = db.db.prepare(`SELECT COUNT(*) AS n FROM fee_payments WHERE student_id = 'bola'`).get()
  assert.equal(stored.n, 2)
})

test('adjustments keep the original charge; waivers and cancellations need reasons', async () => {
  const { call } = await setup()
  await publishAndIssue(call, 't26-1', [ITEMS[0], ITEMS[1]])
  const account = (await call('hos', 'GET', '/api/school/finance/students/ada/account')).body
  const tuition = account.current.find(charge => charge.feeItem === 'Tuition')
  const levy = account.current.find(charge => charge.feeItem === 'Development levy')
  assert.equal((await call('hos', 'POST', `/api/school/finance/obligations/${tuition.id}/adjustments`, { kind: 'scholarship', amount: 50000 })).status, 400)
  const adjusted = await call('hos', 'POST', `/api/school/finance/obligations/${tuition.id}/adjustments`, { kind: 'scholarship', amount: 50000, reason: 'Merit scholarship' })
  assert.deepEqual([adjusted.body.obligation.amount, adjusted.body.obligation.netAmount, adjusted.body.obligation.balance], [100000, 50000, 50000])
  const waived = await call('bursar', 'POST', `/api/school/finance/obligations/${levy.id}/adjustments`, { kind: 'waiver', reason: 'Staff child' })
  assert.equal(waived.body.obligation.status, 'waived')
  assert.equal((await call('bursar', 'POST', `/api/school/finance/obligations/${tuition.id}/cancel`, { reason: 'x' })).status, 403, 'only owner/HOS cancel')
  const history = (await call('hos', 'GET', `/api/school/finance/obligations/${tuition.id}/history`)).body
  assert.equal(history.adjustments[0].reason, 'Merit scholarship')
  assert.equal(history.adjustments[0].authorizedBy, 'HOS')
})

test('claims: parents claim for their own child; claims auto-resolve when the bills are settled', async () => {
  const { call } = await setup()
  await publishAndIssue(call, 't26-1', [ITEMS[0]])
  const mine = (await call('mum', 'GET', '/api/school/finance/my-accounts')).body
  assert.deepEqual(mine.accounts.map(account => account.studentId), ['ada'])
  const tuition = mine.accounts[0].current[0]
  assert.equal((await call('mum', 'POST', '/api/school/finance/my-claims', { studentId: 'bola', amount: 1, obligationIds: [tuition.id] })).status, 403)
  assert.equal((await call('mum', 'GET', '/api/school/finance/students/bola/account')).status, 403)

  const claim = (await call('mum', 'POST', '/api/school/finance/my-claims', { studentId: 'ada', amount: 100000, reference: 'TRF-9', obligationIds: [tuition.id] })).body.claim
  assert.equal(claim.status, 'submitted')
  assert.equal((await call('bursar', 'GET', '/api/school/finance/dashboard')).body.unresolvedClaims, 1)
  assert.equal((await call('bursar', 'POST', `/api/school/finance/claims/${claim.id}/review`, { action: 'start_review' })).body.claim.status, 'under_review')
  assert.equal((await call('bursar', 'POST', `/api/school/finance/claims/${claim.id}/review`, { action: 'reject' })).status, 400, 'rejection needs a reason')

  // Paying the bill resolves the claim.
  const paid = await call('bursar', 'POST', '/api/school/finance/students/ada/payments', { amount: 100000, selectedObligationIds: [tuition.id], reference: 'TRF-9' })
  assert.deepEqual(paid.body.resolvedClaims, [claim.id])
  const claims = (await call('mum', 'GET', '/api/school/finance/claims')).body.claims
  assert.equal(claims[0].status, 'resolved')
  // A claim against something already paid resolves itself at once.
  const late = (await call('mum', 'POST', '/api/school/finance/my-claims', { studentId: 'ada', amount: 100000, obligationIds: [tuition.id] })).body.claim
  assert.equal(late.status, 'auto_resolved')

  const dashboard = (await call('owner', 'GET', '/api/school/finance/dashboard')).body
  assert.deepEqual([dashboard.expected, dashboard.collected, dashboard.outstanding, dashboard.collectionRate, dashboard.studentsOwing, dashboard.unresolvedClaims], [200000, 100000, 100000, 50, 1, 0])
  assert.equal(dashboard.period.termName, 'First Term')
})

test('tenant isolation: another school cannot see or touch these accounts', async () => {
  const { call } = await setup()
  const { id } = await publishAndIssue(call, 't26-1', [ITEMS[0]])
  const tuition = (await call('owner', 'GET', '/api/school/finance/students/ada/account')).body.current[0]
  assert.equal((await call('otherOwner', 'GET', '/api/school/finance/students/ada/account')).status, 403)
  assert.equal((await call('otherOwner', 'POST', `/api/school/finance/obligations/${tuition.id}/adjustments`, { kind: 'waiver', reason: 'x' })).status, 404)
  assert.equal((await call('otherOwner', 'POST', `/api/school/finance/structures/${id}/status`, { status: 'closed' })).status, 404)
  assert.equal((await call('otherOwner', 'GET', '/api/school/finance/structures')).body.structures.length, 0)
  assert.equal((await call('otherOwner', 'GET', '/api/school/finance/dashboard')).body.expected, 0)
})

test('bills from the earlier system stay put, show on the same ledger, are payable and reversible, and are never billed twice', async () => {
  const { call, db } = await setup()
  const now = new Date().toISOString()
  db.db.exec(`INSERT INTO fee_assessments (id, tenant_id, session_id, session_name, term_id, term_name, student_id, student_name, class_id, class_name, assessment_kind, gross_amount, net_amount, amount_paid, outstanding, status, created_at, updated_at)
    VALUES ('old-1', 'school-a', 's26', '2026/2027', 't26-1', 'First Term', 'bola', 'BOLA', 'jss1', 'JSS 1', 'term', 80000, 80000, 30000, 50000, 'partial', '${now}', '${now}')`)
  const { issued } = await publishAndIssue(call, 't26-1', [ITEMS[0]])
  assert.deepEqual([issued.issued, issued.skippedLegacy], [1, ['BOLA']])

  const account = (await call('bursar', 'GET', '/api/school/finance/students/bola/account')).body
  assert.deepEqual(account.current.map(charge => [charge.source, charge.balance]), [['legacy', 50000]])
  const paid = await call('bursar', 'POST', '/api/school/finance/students/bola/payments', { amount: 50000, allocations: [{ obligationId: 'legacy:old-1', amount: 50000 }] })
  assert.equal(paid.status, 200, JSON.stringify(paid.body))
  assert.deepEqual({ ...db.db.prepare(`SELECT amount_paid, outstanding, status FROM fee_assessments WHERE id = 'old-1'`).get() }, { amount_paid: 80000, outstanding: 0, status: 'paid' })
  await call('bursar', 'POST', `/api/school/finance/payments/${paid.body.paymentId}/reverse`, { reason: 'Wrong student' })
  assert.deepEqual({ ...db.db.prepare(`SELECT amount_paid, outstanding, status FROM fee_assessments WHERE id = 'old-1'`).get() }, { amount_paid: 30000, outstanding: 50000, status: 'partial' })
  // The dashboard counts both systems' bills for this term.
  const dashboard = (await call('owner', 'GET', '/api/school/finance/dashboard')).body
  assert.deepEqual([dashboard.expected, dashboard.collected, dashboard.outstanding, dashboard.studentsOwing, dashboard.previousTermArrears], [180000, 30000, 150000, 2, 0])
})

test('a payment never half-lands when the bill changed underneath it', async () => {
  const { finance } = await import(`./build/materialSessionTest.mjs?fin=${generation++}`)
  const { call, db } = await setup()
  await publishAndIssue(call, 't26-1', [ITEMS[0]])
  const [charge] = (await call('bursar', 'GET', '/api/school/finance/students/ada/account')).body.current
  // Someone else's payment lands between this one reading the bill and writing it.
  const racing = {
    prepare: sql => db.prepare(sql),
    exec: sql => db.exec(sql),
    batch: async statements => {
      db.db.exec(`UPDATE fee_obligations SET amount_paid = 10000, balance = 90000 WHERE id = '${charge.id}'`)
      return db.batch(statements)
    },
  }
  await assert.rejects(
    finance.recordPayment(racing, { tenantId: 'school-a', actor: { id: 'bursar', name: 'B' }, studentId: 'ada', amount: 95000, allocations: [{ obligationId: charge.id, amount: 95000 }] }),
    error => error.status === 409,
  )
  assert.equal(db.db.prepare(`SELECT COUNT(*) AS n FROM fee_payments`).get().n, 0)
  assert.equal(db.db.prepare(`SELECT COUNT(*) AS n FROM fee_obligation_allocations`).get().n, 0)
})
