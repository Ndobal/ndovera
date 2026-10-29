import test from 'node:test'
import assert from 'node:assert/strict'
import { sign } from '@tsndr/cloudflare-worker-jwt'
import { D1Shim, createLegacySchema } from './d1-shim.mjs'

// Payroll by month: prepare any month (this one or earlier), reuse a month, release
// payslips one by one or all at once, and every staff member sees their released payslips.

const SECRET = 'payroll-release-secret'
let generation = 0

async function setup() {
  const worker = (await import(`./build/worker.mjs?payroll=${generation++}`)).default
  const db = new D1Shim()
  createLegacySchema(db)
  db.db.exec(`CREATE TABLE IF NOT EXISTS tenants (id TEXT PRIMARY KEY, requested_subdomain TEXT, website_domain TEXT, school_name TEXT)`)
  db.db.exec(`INSERT INTO tenants (id, requested_subdomain, school_name) VALUES ('school-a', 'greenfield', 'Greenfield School')`)
  const people = {
    owner: ['own', 'owner@greenfield.ng', ['owner']], hos: ['hos', 'hos@greenfield.ng', ['hos']], bursar: ['bursar', 'bursar@greenfield.ng', ['accountant']],
    tola: ['tola', 'tola@greenfield.ng', ['teacher']], nurse: ['nurse', 'nurse@greenfield.ng', ['clinic']],
  }
  for (const [id, email, roles] of Object.values(people)) {
    await db.prepare('INSERT INTO users (id, email, name, role, tenantId, status) VALUES (?, ?, ?, ?, ?, ?)').bind(id, email, id.toUpperCase(), roles[0], 'school-a', 'active').run()
    await db.prepare('INSERT INTO settings (studentId, payload) VALUES (?, ?)').bind(email, JSON.stringify({ name: id.toUpperCase(), email, role: roles[0], roles, tenantId: 'school-a', status: 'active' })).run()
  }
  const call = async (person, method, path, body) => {
    const [id, email, roles] = people[person]
    const token = await sign({ id, email, role: roles[0], roles, tenantId: 'school-a', name: id.toUpperCase(), exp: Math.floor(Date.now() / 1000) + 600 }, SECRET)
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'X-Selected-Role': roles[0] }
    const response = await worker.fetch(new Request(`https://ndovera.com${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined }), { APP_DB: db, JWT_SECRET: SECRET }, { waitUntil() {}, passThroughOnException() {} })
    return { status: response.status, body: await response.json().catch(() => ({})) }
  }
  return { db, call }
}

const monthsAgo = n => {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - n, 1)).toISOString().slice(0, 7)
}

test('a past month is prepared, reused for the next, and payslips reach staff only when released', async () => {
  const { call, db } = await setup()
  const earlier = monthsAgo(2)
  const later = monthsAgo(1)

  // Figures entered for a month two months back, not today's month.
  for (const [staff, basic] of [['tola', 150000], ['nurse', 90000]]) {
    const saved = await call('bursar', 'PUT', `/api/school/payroll/staff/${staff}`, { period: earlier, basicSalary: basic, housingAllowance: 10000, tax: 5000 })
    assert.equal(saved.status, 200, JSON.stringify(saved.body))
  }
  assert.equal((await call('bursar', 'PUT', '/api/school/payroll/staff/tola', { period: '2001-01', basicSalary: 1 })).status, 400)
  const sheet = (await call('bursar', 'GET', `/api/school/payroll?period=${earlier}`)).body
  const tolaRow = sheet.payroll.find(row => row.staffId === 'tola')
  assert.deepEqual([tolaRow.gross, tolaRow.hasEntry, tolaRow.released], [160000, true, false])

  // Approval alone does not show payslips to staff any more.
  assert.equal((await call('owner', 'POST', '/api/school/payroll/approve', { period: earlier })).status, 200)
  const notYet = (await call('tola', 'GET', `/api/school/payroll/my-payslip?period=${earlier}`)).body
  assert.deepEqual([notYet.payslip, notYet.status], [null, 'pending'])

  // A teacher cannot publish payslips; the Head of School releases one, then all the rest.
  assert.equal((await call('tola', 'POST', '/api/school/payroll/release', { period: earlier })).status, 403)
  assert.equal((await call('hos', 'POST', '/api/school/payroll/release', { period: earlier, staffIds: ['tola'] })).body.released, 1)
  const tola = (await call('tola', 'GET', '/api/school/payroll/my-payslip')).body
  assert.equal(tola.period, earlier) // the newest released month opens first
  assert.equal(tola.payslip.net, 155000)
  assert.equal(tola.payslip.schoolName, 'Greenfield School')
  assert.deepEqual(tola.available.map(item => item.period), [earlier])
  assert.equal((await call('nurse', 'GET', `/api/school/payroll/my-payslip?period=${earlier}`)).body.payslip, null)
  assert.equal((await call('owner', 'POST', '/api/school/payroll/release', { period: earlier })).body.released, 1)
  assert.equal((await call('nurse', 'GET', `/api/school/payroll/my-payslip?period=${earlier}`)).body.payslip.net, 95000)
  // A released payslip is final.
  assert.equal((await call('bursar', 'PUT', '/api/school/payroll/staff/tola', { period: earlier, basicSalary: 1 })).status, 409)

  // Next month starts as a copy, edited before release.
  const copied = await call('bursar', 'POST', '/api/school/payroll/copy', { from: earlier, to: later })
  assert.deepEqual([copied.status, copied.body.copied], [200, 2])
  await call('bursar', 'PUT', '/api/school/payroll/staff/tola', { period: later, bonus: 20000 })
  const next = (await call('bursar', 'GET', `/api/school/payroll?period=${later}`)).body.payroll.find(row => row.staffId === 'tola')
  assert.deepEqual([next.basicSalary, next.gross, next.released, next.approved], [150000, 180000, false, false])
  assert.equal((await call('tola', 'GET', `/api/school/payroll/my-payslip?period=${later}`)).body.payslip, null)

  // A payslip saved under the staff member's email (older records) is found too.
  db.db.exec(`UPDATE payroll_entries SET staff_id = 'tola@greenfield.ng' WHERE staff_id = 'tola' AND period = '${earlier}'`)
  assert.equal((await call('tola', 'GET', `/api/school/payroll/my-payslip?period=${earlier}`)).body.payslip.net, 155000)
  // Payrolls approved before releasing existed stay visible as they were.
  db.db.exec(`UPDATE payroll_entries SET released = NULL WHERE period = '${earlier}'`)
  assert.equal((await call('nurse', 'GET', `/api/school/payroll/my-payslip?period=${earlier}`)).body.payslip.net, 95000)
})

test('payslip headings keep the order the school sets', async () => {
  const { call } = await setup()
  const saved = await call('owner', 'POST', '/api/school/payroll/settings', {
    earningColumns: [{ key: 'bonus', label: 'Bonus' }, { key: 'basicSalary', label: 'Basic Pay' }, { key: 'earning_1', label: 'Responsibility' }, { key: 'housingAllowance', label: 'Housing' }],
    deductionColumns: [{ key: 'pension', label: 'Pension' }, { key: 'tax', label: 'PAYE' }],
  })
  assert.equal(saved.status, 200)
  const settings = (await call('owner', 'GET', '/api/school/payroll/settings')).body.settings
  // transportAllowance was not in the list, so it comes back at the front.
  assert.deepEqual(settings.earningColumns.map(column => column.key), ['transportAllowance', 'bonus', 'basicSalary', 'earning_1', 'housingAllowance'])
  assert.deepEqual(settings.earningColumns.map(column => column.label).slice(1, 3), ['Bonus', 'Basic Pay'])
  assert.deepEqual(settings.deductionColumns.map(column => column.key), ['otherDeduction', 'pension', 'tax'])
})

test('the accountant publishes payslips once the month is posted', async () => {
  const { call } = await setup()
  const month = monthsAgo(1)
  await call('bursar', 'PUT', '/api/school/payroll/staff/tola', { period: month, basicSalary: 120000 })
  const published = await call('bursar', 'POST', '/api/school/payroll/release', { period: month })
  assert.deepEqual([published.status, published.body.released], [200, 1])
  assert.equal((await call('tola', 'GET', `/api/school/payroll/my-payslip?period=${month}`)).body.payslip.net, 120000)
})

test('sign-in charges stay out of payroll until the school turns them on; deductions are kept or paid on', async () => {
  const { call } = await setup()
  const settings = (await call('owner', 'GET', '/api/school/payroll/settings')).body.settings
  assert.equal(settings.attendanceCharges, false)
  assert.deepEqual(settings.deductionColumns.map(column => column.kind), ['remit', 'remit', 'remit'])
  await call('bursar', 'POST', '/api/school/payroll/settings', {
    attendanceCharges: true,
    deductionColumns: [...settings.deductionColumns, { key: 'deduction_1', label: 'Staff Loan' }, { key: 'deduction_2', label: 'Cooperative' }, { key: 'deduction_3', label: 'Bus levy', kind: 'school' }],
  })
  const saved = (await call('owner', 'GET', '/api/school/payroll/settings')).body.settings
  assert.equal(saved.attendanceCharges, true)
  assert.deepEqual(Object.fromEntries(saved.deductionColumns.map(column => [column.key, column.kind])), { tax: 'remit', pension: 'remit', otherDeduction: 'remit', deduction_1: 'school', deduction_2: 'remit', deduction_3: 'school' })
})

test('staff enter their own salary account; it reaches payslips not yet released', async () => {
  const { call } = await setup()
  const month = monthsAgo(1)
  await call('bursar', 'PUT', '/api/school/payroll/staff/nurse', { period: month, basicSalary: 90000 })
  assert.equal((await call('nurse', 'PUT', '/api/school/payroll/my-bank-details', { bankName: 'Access Bank', accountName: 'Nurse Ade', accountNumber: '01234' })).status, 400)
  const saved = await call('nurse', 'PUT', '/api/school/payroll/my-bank-details', { bankName: 'Access Bank', accountName: 'Nurse Ade', accountNumber: '0123 456 789' })
  assert.deepEqual([saved.status, saved.body.details.accountNumber, saved.body.payslipsUpdated], [200, '0123456789', 1])
  assert.equal((await call('nurse', 'GET', '/api/school/payroll/my-bank-details')).body.details.bankName, 'Access Bank')
  const row = (await call('bursar', 'GET', `/api/school/payroll?period=${month}`)).body.payroll.find(entry => entry.staffId === 'nurse')
  assert.deepEqual([row.bankName, row.accountName, row.accountNumber], ['Access Bank', 'Nurse Ade', '0123456789'])
})
