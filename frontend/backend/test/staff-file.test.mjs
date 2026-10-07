import test from 'node:test'
import assert from 'node:assert/strict'
import { sign } from '@tsndr/cloudflare-worker-jwt'
import { D1Shim, createLegacySchema } from './d1-shim.mjs'

const SECRET = 'staff-file-test-secret'
let worker
let generation = 0

const PEOPLE = {
  james: ['t-james', 'james@a.test', 'teacher', 'school-a', 'Sarah James'],
  grace: ['t-grace', 'grace@a.test', 'teacher', 'school-a', 'Grace Obi'],
  principal: ['p-1', 'principal@a.test', 'principal', 'school-a', 'The Principal'],
  accountant: ['a-1', 'accounts@a.test', 'accountant', 'school-a', 'The Accountant'],
  hos: ['h-1', 'hos@a.test', 'hos', 'school-a', 'Head of School'],
  owner: ['o-1', 'owner@a.test', 'owner', 'school-a', 'The Owner'],
  outsider: ['o-b', 'owner@b.test', 'owner', 'school-b', 'Other Owner'],
}

async function setup() {
  worker = (await import(`./build/worker.mjs?stafffile=${generation++}`)).default
  const db = new D1Shim()
  createLegacySchema(db)
  db.db.exec(`
    CREATE TABLE subjects (id TEXT PRIMARY KEY, tenantId TEXT, name TEXT, classId TEXT, teacherId TEXT, createdAt TEXT);
    CREATE TABLE tenants (id TEXT PRIMARY KEY, school_name TEXT);
    INSERT INTO tenants VALUES ('school-a', 'Genesis International School'), ('school-b', 'Other');
    INSERT INTO classes (id, tenantId, name, arm, classTeacherId) VALUES ('jss1', 'school-a', 'JSS 1', '', 't-james'), ('p5', 'school-a', 'Primary 5', '', 't-grace');
    INSERT INTO subjects VALUES ('m1', 'school-a', 'Mathematics', 'jss1', 't-james', 'x'), ('e5', 'school-a', 'English', 'p5', 't-grace', 'x');
  `)
  for (const [id, email, role, tenant, name] of Object.values(PEOPLE)) {
    await db.prepare('INSERT INTO users (id, email, name, role, tenantId, status) VALUES (?, ?, ?, ?, ?, ?)').bind(id, email, name, role, tenant, 'active').run()
    await db.prepare('INSERT INTO settings (studentId, payload) VALUES (?, ?)').bind(email, JSON.stringify({ name, email, role, tenantId: tenant, schoolId: tenant, status: 'active' })).run()
  }
  return db
}

async function call(db, person, method, path, body) {
  const [id, , role, tenantId, name] = PEOPLE[person]
  const token = await sign({ id, role, roles: [role], tenantId, name, exp: Math.floor(Date.now() / 1000) + 600 }, SECRET)
  const response = await worker.fetch(new Request(`https://ndovera.com${path}`, {
    method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
  }), { APP_DB: db, JWT_SECRET: SECRET }, { waitUntil() {}, passThroughOnException() {} })
  return { status: response.status, body: await response.json().catch(() => ({})) }
}

test('who may open a staff file: themselves, the Owner/HOS, the Accountant, and the section head over them — no one else', async () => {
  const db = await setup()
  const own = await call(db, 'james', 'GET', '/api/staff-file/t-james')
  assert.equal(own.status, 200, JSON.stringify(own.body))
  assert.equal(own.body.profile.name, 'Sarah James')
  assert.deepEqual(own.body.sections, ['secondary'])
  assert.equal((await call(db, 'grace', 'GET', '/api/staff-file/t-james')).status, 403)
  assert.equal((await call(db, 'principal', 'GET', '/api/staff-file/t-james')).status, 200)
  assert.equal((await call(db, 'principal', 'GET', '/api/staff-file/t-grace')).status, 403, 'a primary teacher is not the principal\'s')
  assert.equal((await call(db, 'accountant', 'GET', '/api/staff-file/t-grace')).status, 200)
  assert.equal((await call(db, 'outsider', 'GET', '/api/staff-file/t-james')).status, 404)
  const principalView = await call(db, 'principal', 'GET', '/api/staff-file/t-james')
  assert.equal(principalView.body.overview.loanOutstanding, null, 'loans are not the principal\'s business')
  assert.equal(principalView.body.permissions.loans, false)
})

test('records are never overwritten: an edit is a new version, and each viewer sees only what their role allows', async () => {
  const db = await setup()
  const teacherRole = await call(db, 'hos', 'POST', '/api/staff-file/t-james/records', { category: 'employment', title: 'Mathematics Teacher', effectiveFrom: '2022-09-05', effectiveTo: '2026-08-31' })
  assert.equal(teacherRole.status, 201, JSON.stringify(teacherRole.body))
  await call(db, 'hos', 'POST', '/api/staff-file/t-james/records', { category: 'employment', title: 'Head of Mathematics', effectiveFrom: '2026-09-01' })
  const query = await call(db, 'hos', 'POST', '/api/staff-file/t-james/records', { category: 'disciplinary', title: 'Query — late submissions', detail: 'Three weeks late' })
  assert.equal(query.body.record.visibility, 'management')
  const salary = await call(db, 'owner', 'POST', '/api/staff-file/t-james/records', { category: 'salary', title: 'Salary review', detail: '₦250,000 monthly' })
  assert.equal(salary.body.record.visibility, 'restricted')
  assert.equal((await call(db, 'hos', 'POST', '/api/staff-file/t-james/records', { category: 'salary', title: 'x', visibility: 'restricted' })).status, 403, 'restricted records are the Owner\'s')

  // Revising keeps the old version.
  const revised = await call(db, 'hos', 'PUT', `/api/staff-file/t-james/records/${teacherRole.body.record.id}`, { title: 'Mathematics & Further Maths Teacher' })
  assert.equal(revised.status, 200, JSON.stringify(revised.body))
  const history = await call(db, 'hos', 'GET', `/api/staff-file/t-james/records/${revised.body.record.id}/history`)
  assert.deepEqual(history.body.versions.map(version => version.title), ['Mathematics & Further Maths Teacher', 'Mathematics Teacher'])
  assert.equal((await call(db, 'hos', 'PUT', `/api/staff-file/t-james/records/${teacherRole.body.record.id}`, { title: 'again' })).status, 409, 'edit the newest version, not an old one')

  const titles = async person => (await call(db, person, 'GET', '/api/staff-file/t-james/records')).body.records.map(record => record.title).sort()
  assert.deepEqual(await titles('james'), ['Head of Mathematics', 'Mathematics & Further Maths Teacher'])
  assert.deepEqual(await titles('hos'), ['Head of Mathematics', 'Mathematics & Further Maths Teacher', 'Query — late submissions'])
  assert.deepEqual(await titles('owner'), ['Head of Mathematics', 'Mathematics & Further Maths Teacher', 'Query — late submissions', 'Salary review'])
  assert.deepEqual(await titles('accountant'), ['Head of Mathematics', 'Mathematics & Further Maths Teacher', 'Salary review'])

  // Staff keep their own next of kin up to date, nothing else.
  assert.equal((await call(db, 'james', 'POST', '/api/staff-file/t-james/records', { category: 'next_of_kin', title: 'John James (husband)', detail: '0803…' })).status, 201)
  assert.equal((await call(db, 'james', 'POST', '/api/staff-file/t-james/records', { category: 'document', title: 'My CV' })).status, 403)
})

test('a loan balance only moves through confirmed transactions — the borrower cannot confirm their own payment', async () => {
  const db = await setup()
  assert.equal((await call(db, 'james', 'POST', '/api/staff-file/t-james/loans', { principal: 300000 })).status, 400, 'say what it is for')
  const applied = await call(db, 'james', 'POST', '/api/staff-file/t-james/loans', { principal: 300000, purpose: 'Rent', periodMonths: 6 })
  assert.equal(applied.status, 201, JSON.stringify(applied.body))
  const loan = applied.body.loan
  assert.deepEqual([loan.number, loan.status, loan.monthlyInstalment, loan.outstanding], ['LN-0001', 'submitted', 50000, 300000])
  assert.equal((await call(db, 'grace', 'POST', '/api/staff-file/t-james/loans', { principal: 1000, purpose: 'x' })).status, 403)
  assert.equal((await call(db, 'james', 'POST', `/api/staff-loans/${loan.id}/decision`, { decision: 'approve' })).status, 403)
  assert.equal((await call(db, 'accountant', 'POST', `/api/staff-loans/${loan.id}/decision`, { decision: 'activate' })).status, 409, 'approve before disbursing')
  assert.equal((await call(db, 'accountant', 'POST', `/api/staff-loans/${loan.id}/decision`, { decision: 'approve' })).status, 200)
  const active = await call(db, 'accountant', 'POST', `/api/staff-loans/${loan.id}/decision`, { decision: 'activate', nextPaymentOn: '2026-10-30' })
  assert.equal(active.body.loan.status, 'active')

  const reported = await call(db, 'james', 'POST', `/api/staff-loans/${loan.id}/payments`, { amount: 50000, paidOn: '2026-10-01', proof: [{ name: 'teller.jpg', url: 'https://ndovera.com/files/x/teller.jpg' }] })
  assert.equal(reported.status, 201, JSON.stringify(reported.body))
  assert.deepEqual([reported.body.loan.outstanding, reported.body.loan.awaitingConfirmation], [300000, 50000])
  const tx = reported.body.loan.transactions.find(item => item.status === 'awaiting_confirmation')
  assert.equal((await call(db, 'james', 'POST', `/api/staff-loans/${loan.id}/payments/${tx.id}/confirm`)).status, 403)
  const confirmed = await call(db, 'accountant', 'POST', `/api/staff-loans/${loan.id}/payments/${tx.id}/confirm`)
  assert.deepEqual([confirmed.body.loan.outstanding, confirmed.body.loan.totalPaid], [250000, 50000])

  assert.equal((await call(db, 'hos', 'POST', `/api/staff-loans/${loan.id}/adjust`, { type: 'waiver', amount: 50000 })).status, 400, 'a waiver needs a reason')
  const waived = await call(db, 'hos', 'POST', `/api/staff-loans/${loan.id}/adjust`, { type: 'waiver', amount: 50000, reason: 'Long-service relief' })
  assert.equal(waived.body.loan.outstanding, 200000)
  const paidOff = await call(db, 'accountant', 'POST', `/api/staff-loans/${loan.id}/payments`, { amount: 200000 })
  assert.deepEqual([paidOff.body.loan.status, paidOff.body.loan.outstanding], ['cleared', 0])

  // A loan from before Ndovera, half repaid.
  const existing = await call(db, 'owner', 'POST', '/api/staff-file/t-james/loans', { existing: true, principal: 300000, issuedOn: '2026-01-15', alreadyRepaid: 150000, monthlyInstalment: 50000 })
  assert.equal(existing.status, 201, JSON.stringify(existing.body))
  assert.deepEqual([existing.body.loan.number, existing.body.loan.status, existing.body.loan.outstanding], ['LN-0002', 'active', 150000])
  assert.equal((await call(db, 'james', 'POST', '/api/staff-file/t-james/loans', { existing: true, principal: 1, issuedOn: '2026-01-01' })).status, 403)

  const activity = (await call(db, 'james', 'GET', '/api/staff-file/t-james')).body.activity.map(entry => entry.text)
  assert.ok(activity.includes('Loan cleared — 100% paid'), JSON.stringify(activity))
  assert.ok(activity.some(text => /Loan repayment of ₦50,000 confirmed/.test(text)))
})

test('tasks are assigned within the assigner\'s scope, updated by the staff member, then evaluated', async () => {
  const db = await setup()
  const due = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
  assert.equal((await call(db, 'principal', 'POST', '/api/staff-tasks', { title: 'Organise the Mathematics Laboratory', staffIds: ['t-james', 't-grace'], dueOn: due, priority: 'high' })).status, 403)
  const created = await call(db, 'principal', 'POST', '/api/staff-tasks', { title: 'Organise the Mathematics Laboratory', staffIds: ['t-james'], dueOn: due, priority: 'high' })
  assert.equal(created.status, 201, JSON.stringify(created.body))
  const tasks = (await call(db, 'james', 'GET', '/api/staff-file/t-james/tasks')).body.tasks
  assert.deepEqual([tasks.length, tasks[0].status, tasks[0].assignedByName], [1, 'assigned', 'The Principal'])
  const overview = await call(db, 'james', 'GET', '/api/staff-file/t-james')
  assert.ok(overview.body.attention.some(item => item.level === 'orange' && /Mathematics Laboratory/.test(item.text)))

  assert.equal((await call(db, 'james', 'POST', `/api/staff-tasks/${tasks[0].id}/evaluate`, { rating: 'Outstanding' })).status, 403)
  const submitted = await call(db, 'james', 'POST', `/api/staff-tasks/${tasks[0].id}/progress`, { status: 'submitted', note: 'Lab shelved and labelled', evidence: [{ name: 'lab.jpg', url: 'https://ndovera.com/files/x/lab.jpg' }] })
  assert.equal(submitted.body.task.status, 'submitted')
  assert.equal((await call(db, 'principal', 'POST', `/api/staff-tasks/${tasks[0].id}/evaluate`, { rating: 'Superb' })).status, 400)
  const done = await call(db, 'principal', 'POST', `/api/staff-tasks/${tasks[0].id}/evaluate`, { rating: 'Very Well Done', score: 92, comments: 'Neat work' })
  assert.deepEqual([done.body.task.status, done.body.task.rating, done.body.task.score], ['completed', 'Very Well Done', 92])
  assert.ok((await call(db, 'james', 'GET', '/api/staff-file/t-james')).body.activity.some(entry => entry.text === 'Task completed: Very Well Done'))
})

test('formal reviews: staff see their scores and comments, never management\'s internal notes', async () => {
  const db = await setup()
  const body = { periodLabel: 'Term 1 2026/2027', criteria: [{ label: 'Teaching', score: 91 }, { label: 'Punctuality', score: 82 }, { label: 'Professionalism', score: 88 }, { label: 'Teamwork', score: 84 }], comments: 'A strong term.', internalNotes: 'Consider for HOD.' }
  assert.equal((await call(db, 'principal', 'POST', '/api/staff-file/t-james/reviews', body)).status, 403)
  assert.equal((await call(db, 'hos', 'POST', '/api/staff-file/t-james/reviews', { ...body, criteria: [{ label: 'Teaching', score: 140 }] })).status, 400)
  assert.equal((await call(db, 'hos', 'POST', '/api/staff-file/t-james/reviews', body)).status, 201)
  const mine = (await call(db, 'james', 'GET', '/api/staff-file/t-james/reviews')).body.formal[0]
  assert.deepEqual([mine.overall, mine.comments, 'internalNotes' in mine], [86, 'A strong term.', false])
  assert.equal((await call(db, 'hos', 'GET', '/api/staff-file/t-james/reviews')).body.formal[0].internalNotes, 'Consider for HOD.')
  assert.deepEqual((await call(db, 'james', 'GET', '/api/staff-file/t-james')).body.overview.latestReview, { periodLabel: 'Term 1 2026/2027', overall: 86 })
})

test('a report about a colleague: the reporter stays confidential to them, and no adverse finding before they respond', async () => {
  const db = await setup()
  assert.equal((await call(db, 'grace', 'POST', '/api/staff-file/t-grace/reports', { category: 'Professional conduct', details: 'Reporting myself for testing' })).status, 400)
  const filed = await call(db, 'grace', 'POST', '/api/staff-file/t-james/reports', { category: 'Professional conduct', details: 'Left the class unattended on Monday.' })
  assert.equal(filed.status, 201, JSON.stringify(filed.body))
  assert.equal((await call(db, 'james', 'GET', '/api/staff-file/t-james/reports')).body.reports.length, 0, 'not shown until a response is requested')
  const forHos = (await call(db, 'hos', 'GET', '/api/staff-file/t-james/reports')).body.reports[0]
  assert.equal(forHos.reporterName, 'Grace Obi')
  assert.equal((await call(db, 'hos', 'POST', `/api/staff-reports/${forHos.id}/status`, { status: 'substantiated' })).status, 409)
  assert.equal((await call(db, 'james', 'POST', `/api/staff-reports/${forHos.id}/status`, { status: 'closed' })).status, 403)
  await call(db, 'hos', 'POST', `/api/staff-reports/${forHos.id}/status`, { status: 'response_requested', managementResponse: 'Please explain.' })
  const forJames = (await call(db, 'james', 'GET', '/api/staff-file/t-james/reports')).body.reports[0]
  assert.deepEqual([forJames.reporterName, forJames.status, forJames.managementResponse], ['', 'response_requested', 'Please explain.'])
  assert.ok((await call(db, 'james', 'GET', '/api/staff-file/t-james')).body.attention.some(item => /response is requested/.test(item.text)))
  assert.equal((await call(db, 'james', 'POST', `/api/staff-reports/${forHos.id}/respond`, { response: 'I was called to the office by the HOS.' })).status, 200)
  assert.equal((await call(db, 'hos', 'POST', `/api/staff-reports/${forHos.id}/status`, { status: 'unsubstantiated', outcome: 'Explanation accepted.' })).status, 200)
  assert.equal((await call(db, 'james', 'GET', '/api/staff-file/t-james/reports')).body.reports[0].status, 'unsubstantiated')
  assert.equal((await call(db, 'james', 'GET', '/api/staff-file/t-james/audit')).status, 403)
  assert.ok((await call(db, 'hos', 'GET', '/api/staff-file/t-james/audit')).body.audit.some(entry => entry.action === 'report_filed' && entry.actorName === 'Grace Obi'))
})

test('awards appear in the file with a certificate, and the staff directory lists colleagues', async () => {
  const db = await setup()
  assert.equal((await call(db, 'james', 'POST', '/api/staff-file/t-james/rewards', { title: 'Self award' })).status, 403)
  const given = await call(db, 'principal', 'POST', '/api/staff-file/t-james/rewards', { title: 'Outstanding Teacher Award', reason: 'Exceptional classroom performance', periodLabel: 'First Term 2026/2027', badge: '🏆' })
  assert.equal(given.status, 201, JSON.stringify(given.body))
  const rewards = (await call(db, 'james', 'GET', '/api/staff-file/t-james/rewards')).body.rewards
  assert.deepEqual([rewards[0].title, rewards[0].awardedByName], ['Outstanding Teacher Award', 'The Principal'])
  const certificate = await call(db, 'james', 'GET', `/api/staff-rewards/${rewards[0].id}/certificate`)
  assert.equal(certificate.status, 200, JSON.stringify(certificate.body))
  assert.equal(certificate.body.staff.name, 'Sarah James')
  assert.equal((await call(db, 'grace', 'GET', `/api/staff-rewards/${rewards[0].id}/certificate`)).status, 403)
  const overview = (await call(db, 'james', 'GET', '/api/staff-file/t-james')).body.overview
  assert.deepEqual([overview.rewards, overview.badges[0].badge], [1, '🏆'])
  const directory = await call(db, 'grace', 'GET', '/api/staff-directory')
  assert.ok(directory.body.staff.some(person => person.name === 'Sarah James'))
})

test('private staff records: the staff member, the HOS, the Owner and the Accountant — not section heads', async () => {
  const db = await setup()
  const added = await call(db, 'accountant', 'POST', '/api/staff-file/t-james/records', { category: 'note', title: 'Salary advance agreement', visibility: 'private' })
  assert.equal(added.status, 201, JSON.stringify(added.body))
  assert.equal((await call(db, 'accountant', 'POST', '/api/staff-file/t-james/records', { category: 'note', title: 'x', visibility: 'management' })).status, 403)
  assert.equal((await call(db, 'principal', 'POST', '/api/staff-file/t-james/records', { category: 'note', title: 'x', visibility: 'private' })).status, 403)
  await call(db, 'hos', 'POST', '/api/staff-file/t-james/records', { category: 'document', title: 'Medical report', visibility: 'private' })
  const titles = async person => (await call(db, person, 'GET', '/api/staff-file/t-james/records')).body.records.map(record => record.title).sort()
  for (const person of ['james', 'hos', 'owner', 'accountant']) assert.deepEqual(await titles(person), ['Medical report', 'Salary advance agreement'], person)
  assert.deepEqual(await titles('principal'), [])
})
