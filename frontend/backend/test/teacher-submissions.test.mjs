import test from 'node:test'
import assert from 'node:assert/strict'
import { sign } from '@tsndr/cloudflare-worker-jwt'
import { D1Shim, createLegacySchema } from './d1-shim.mjs'
import * as academic from './build/academicSessions.mjs'

const SECRET = 'submission-test-secret'
let worker
let generation = 0
let aiCalls = []

const PEOPLE = {
  teacher: ['t-math', 'math@a.test', 'teacher', 'school-a'],
  other: ['t-eng', 'eng@a.test', 'teacher', 'school-a'],
  hos: ['h-a', 'hos@a.test', 'hos', 'school-a'],
  owner: ['o-a', 'owner@a.test', 'owner', 'school-a'],
  outsider: ['o-b', 'owner@b.test', 'owner', 'school-b'],
}

async function setup() {
  worker = (await import(`./build/worker.mjs?subs=${generation++}`)).default
  aiCalls = []
  const db = new D1Shim()
  createLegacySchema(db)
  db.db.exec(`
    CREATE TABLE subjects (id TEXT PRIMARY KEY, tenantId TEXT, name TEXT, classId TEXT, teacherId TEXT, createdAt TEXT);
    CREATE TABLE tenants (id TEXT PRIMARY KEY, school_name TEXT);
    INSERT INTO tenants VALUES ('school-a', 'A'), ('school-b', 'B');
    INSERT INTO classes (id, tenantId, name, arm) VALUES ('p5', 'school-a', 'Primary 5', ''), ('p6', 'school-a', 'Primary 6', '');
    INSERT INTO subjects VALUES ('math', 'school-a', 'Mathematics', 'p5', 't-math', 'x'), ('eng', 'school-a', 'English', 'p5', 't-eng', 'x');
  `)
  for (const [id, email, role, tenant] of Object.values(PEOPLE)) {
    await db.prepare('INSERT INTO users (id, email, name, role, tenantId, status) VALUES (?, ?, ?, ?, ?, ?)').bind(id, email, `Name ${id}`, role, tenant, 'active').run()
    await db.prepare('INSERT INTO settings (studentId, payload) VALUES (?, ?)').bind(email, JSON.stringify({ name: `Name ${id}`, email, role, tenantId: tenant, schoolId: tenant, status: 'active' })).run()
  }
  return db
}

async function call(db, person, method, path, body) {
  const [id, , role, tenantId] = PEOPLE[person]
  const token = await sign({ id, role, roles: [role], tenantId, name: id, exp: Math.floor(Date.now() / 1000) + 600 }, SECRET)
  const env = { APP_DB: db, JWT_SECRET: SECRET, AI: { run: async (_m, input) => { aiCalls.push(input); return { response: '# Preliminary review\n## Strengths\n- Clear objectives' } } } }
  const response = await worker.fetch(new Request(`https://ndovera.com${path}`, {
    method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
  }), env, { waitUntil() {}, passThroughOnException() {} })
  return { status: response.status, body: await response.json().catch(() => ({})) }
}

const lessonPlan = (week, extra = {}) => ({ classId: 'p5', subjectId: 'math', type: 'lesson_plan', weekNumber: week, content: `Objectives for week ${week}: add fractions.`, ...extra })

test('teachers submit only for what they teach; Other needs a description', async () => {
  const db = await setup()
  const created = await call(db, 'teacher', 'POST', '/api/teacher-submissions', lessonPlan(4))
  assert.equal(created.status, 201)
  assert.deepEqual([created.body.submission.status, created.body.submission.version, created.body.submission.typeLabel, created.body.submission.periodLabel], ['submitted', 1, 'Lesson Plan', 'Week 4'])
  assert.equal((await call(db, 'other', 'POST', '/api/teacher-submissions', lessonPlan(4))).status, 403)
  assert.equal((await call(db, 'teacher', 'POST', '/api/teacher-submissions', lessonPlan(5, { type: 'other' }))).status, 400)
  const other = await call(db, 'teacher', 'POST', '/api/teacher-submissions', lessonPlan(5, { type: 'other', otherLabel: 'Project brief' }))
  assert.equal(other.body.submission.typeLabel, 'Project brief')
  assert.equal((await call(db, 'teacher', 'POST', '/api/teacher-submissions', lessonPlan(6, { content: '' }))).status, 400)
})

test('weeks 1 to 4 can be submitted together and stay separately reviewable', async () => {
  const db = await setup()
  const bulk = await call(db, 'teacher', 'POST', '/api/teacher-submissions/bulk', {
    classId: 'p5', subjectId: 'math', type: 'lesson_plan', submit: true,
    items: [1, 2, 3, 4].map(week => ({ weekNumber: week, content: `Week ${week} plan` })),
  })
  assert.equal(bulk.status, 201)
  assert.equal(bulk.body.results.filter(result => result.ok).length, 4)
  const ids = bulk.body.results.map(result => result.submission.id)
  assert.equal(new Set(ids).size, 4)
  const mine = await call(db, 'teacher', 'GET', '/api/teacher-submissions/mine')
  assert.deepEqual(mine.body.submissions.map(item => item.weekNumber).sort(), [1, 2, 3, 4])
})

test('return, correct and resubmit keeps every version; reviewers decide, teachers cannot', async () => {
  const db = await setup()
  const id = (await call(db, 'teacher', 'POST', '/api/teacher-submissions', lessonPlan(2))).body.submission.id
  assert.equal((await call(db, 'other', 'POST', `/api/teacher-submissions/${id}/decision`, { decision: 'approve' })).status, 404)
  assert.equal((await call(db, 'outsider', 'GET', `/api/teacher-submissions/${id}`)).status, 404)

  assert.equal((await call(db, 'hos', 'POST', `/api/teacher-submissions/${id}/start-review`)).body.submission.status, 'under_review')
  // The teacher cannot change work while it is being reviewed.
  assert.equal((await call(db, 'teacher', 'PUT', `/api/teacher-submissions/${id}`, { content: 'sneaky' })).status, 409)
  assert.equal((await call(db, 'hos', 'POST', `/api/teacher-submissions/${id}/decision`, { decision: 'return' })).status, 400)
  const returned = await call(db, 'hos', 'POST', `/api/teacher-submissions/${id}/decision`, { decision: 'return', feedback: 'Add an assessment activity.' })
  assert.equal(returned.body.submission.status, 'returned')

  await call(db, 'teacher', 'PUT', `/api/teacher-submissions/${id}`, { content: 'Objectives… plus a short quiz at the end.' })
  const resubmitted = await call(db, 'teacher', 'POST', `/api/teacher-submissions/${id}/submit`)
  assert.deepEqual([resubmitted.body.submission.status, resubmitted.body.submission.version], ['resubmitted', 2])
  const approved = await call(db, 'owner', 'POST', `/api/teacher-submissions/${id}/decision`, { decision: 'approve', feedback: 'Good.' })
  assert.equal(approved.body.submission.status, 'approved')
  assert.equal(approved.body.submission.reviewedByName, 'Name o-a')

  const history = await call(db, 'teacher', 'GET', `/api/teacher-submissions/${id}`)
  assert.deepEqual(history.body.versions.map(v => [v.version, v.submittedStatus, v.outcome]), [[2, 'resubmitted', 'approved'], [1, 'submitted', 'returned']])
  assert.match(history.body.versions[1].content, /week 2/)
  assert.ok(history.body.events.some(event => event.action === 'edited'))

  // Reviewed work stays on record.
  assert.equal((await call(db, 'teacher', 'DELETE', `/api/teacher-submissions/${id}`)).status, 409)
  assert.equal((await call(db, 'teacher', 'PUT', `/api/teacher-submissions/${id}`, { content: 'x' })).status, 409)
})

test('the AI review is advice only and leaves the status alone', async () => {
  const db = await setup()
  const id = (await call(db, 'teacher', 'POST', '/api/teacher-submissions', lessonPlan(3))).body.submission.id
  assert.equal((await call(db, 'teacher', 'POST', `/api/teacher-submissions/${id}/ai-review`)).status, 403)
  const review = await call(db, 'hos', 'POST', `/api/teacher-submissions/${id}/ai-review`)
  assert.equal(review.status, 200)
  assert.match(aiCalls[0].messages[0].content, /Do not invent content, ratings or comments/)
  assert.match(aiCalls[0].messages[0].content, /Do not approve or reject/)
  const after = await call(db, 'hos', 'GET', `/api/teacher-submissions/${id}`)
  assert.equal(after.body.submission.status, 'submitted')
  assert.match(after.body.submission.aiReview.text, /Clear objectives/)
})

test('a draft can be deleted with an audit record; reviewers see who has not submitted, by class', async () => {
  const db = await setup()
  const draft = await call(db, 'teacher', 'POST', '/api/teacher-submissions', lessonPlan(1, { submit: false }))
  assert.equal(draft.body.submission.status, 'draft')
  assert.equal((await call(db, 'teacher', 'DELETE', `/api/teacher-submissions/${draft.body.submission.id}`)).status, 200)
  const audit = await db.prepare("SELECT action FROM teacher_submission_audit WHERE submission_id = ? ORDER BY created_at").bind(draft.body.submission.id).all()
  assert.ok(audit.results.some(row => row.action === 'deleted'))

  await call(db, 'teacher', 'POST', '/api/teacher-submissions', lessonPlan(2))
  const overview = await call(db, 'hos', 'GET', '/api/teacher-submissions/review')
  assert.deepEqual(overview.body.classes.map(item => [item.className, item.awaitingReview]), [['Primary 5', 1]])
  const p5 = await call(db, 'hos', 'GET', '/api/teacher-submissions/review?classId=p5')
  assert.deepEqual(p5.body.summary.notSubmittedTeachers.map(item => item.teacherId), ['t-eng'])
  assert.equal(p5.body.summary.awaitingReview, 1)
  assert.equal((await call(db, 'teacher', 'GET', '/api/teacher-submissions/review?classId=p5')).status, 403)
  assert.equal((await call(db, 'outsider', 'GET', '/api/teacher-submissions/review?classId=p5')).status, 404)
})

test('reviewers see every term by default — older work and work saved before the calendar existed are never hidden', async () => {
  const db = await setup()
  const calendar = await academic.createSession(db, {
    tenantId: 'school-a', name: '2026/2027', startDate: '2026-09-07', endDate: '2027-07-24', resumptionDate: '2026-09-07',
    terms: [
      { sequence: 1, name: 'First Term', startDate: '2026-09-07', endDate: '2026-12-18', resumptionDate: '2027-01-11' },
      { sequence: 2, name: 'Second Term', startDate: '2027-01-11', endDate: '2027-04-02', resumptionDate: '2027-04-20' },
      { sequence: 3, name: 'Third Term', startDate: '2027-04-20', endDate: '2027-07-24', resumptionDate: '2027-09-06' },
    ],
  })
  await academic.activateSession(db, { tenantId: 'school-a', sessionId: calendar.session.id })
  const current = await call(db, 'teacher', 'POST', '/api/teacher-submissions', lessonPlan(5))
  const older = await call(db, 'teacher', 'POST', '/api/teacher-submissions', lessonPlan(1))
  const beforeCalendar = await call(db, 'teacher', 'POST', '/api/teacher-submissions', lessonPlan(2))
  await db.prepare("UPDATE teacher_submissions SET session_id = 'old-session', term_id = 'old-term', term_name = 'Third Term' WHERE id = ?").bind(older.body.submission.id).run()
  await db.prepare("UPDATE teacher_submissions SET session_id = '', term_id = '', session_name = '', term_name = '' WHERE id = ?").bind(beforeCalendar.body.submission.id).run()
  const ids = body => body.submissions.map(item => item.id).sort()
  const all = await call(db, 'hos', 'GET', '/api/teacher-submissions/review?classId=p5')
  assert.equal(all.body.scope, 'all')
  assert.deepEqual(ids(all.body), [current.body.submission.id, older.body.submission.id, beforeCalendar.body.submission.id].sort())
  const term = await call(db, 'hos', 'GET', '/api/teacher-submissions/review?classId=p5&scope=term')
  assert.deepEqual(ids(term.body), [current.body.submission.id])
  const overview = await call(db, 'hos', 'GET', '/api/teacher-submissions/review')
  assert.equal(overview.body.classes[0].total, 3)
})

test('a teacher later made Head of School can review as HOS straight away, without logging in again — and the role switcher still cannot grant roles', async () => {
  const db = await setup()
  // Stored today: Teacher + Parent + HOS. The login token was issued when they were only a teacher.
  await db.prepare('INSERT INTO users (id, email, name, role, tenantId, status) VALUES (?, ?, ?, ?, ?, ?)').bind('t-hos', 'head@a.test', 'New Head', 'teacher', 'school-a', 'active').run()
  await db.prepare('INSERT INTO settings (studentId, payload) VALUES (?, ?)').bind('head@a.test', JSON.stringify({ name: 'New Head', email: 'head@a.test', role: 'teacher', roles: ['teacher', 'parent', 'hos'], tenantId: 'school-a', schoolId: 'school-a', status: 'active' })).run()
  await call(db, 'teacher', 'POST', '/api/teacher-submissions', lessonPlan(3))
  const asRole = async (selected, roles = ['teacher']) => {
    const token = await sign({ id: 't-hos', email: 'head@a.test', role: 'teacher', roles, tenantId: 'school-a', name: 'New Head', exp: Math.floor(Date.now() / 1000) + 600 }, SECRET)
    const response = await worker.fetch(new Request('https://ndovera.com/api/teacher-submissions/review?classId=p5', {
      headers: { Authorization: `Bearer ${token}`, 'X-Selected-Role': selected },
    }), { APP_DB: db, JWT_SECRET: SECRET }, { waitUntil() {}, passThroughOnException() {} })
    return { status: response.status, body: await response.json().catch(() => ({})) }
  }
  const asHos = await asRole('hos')
  assert.equal(asHos.status, 200, JSON.stringify(asHos.body))
  assert.equal(asHos.body.submissions.length, 1)
  assert.equal((await asRole('teacher')).status, 403, 'acting as a teacher, they do not review')
  assert.equal((await asRole('owner')).status, 403, 'a role they do not hold is never granted')
  // Lesson plans from the teachers' Lesson Plans page are listed for them too.
  const token = await sign({ id: 't-hos', email: 'head@a.test', role: 'teacher', roles: ['teacher'], tenantId: 'school-a', name: 'New Head', exp: Math.floor(Date.now() / 1000) + 600 }, SECRET)
  const plans = await worker.fetch(new Request('https://ndovera.com/api/lesson-plans', { headers: { Authorization: `Bearer ${token}`, 'X-Selected-Role': 'hos' } }), { APP_DB: db, JWT_SECRET: SECRET }, { waitUntil() {}, passThroughOnException() {} })
  assert.equal(plans.status, 200)
  assert.equal((await plans.json()).permissions.canReview, true)
  // Pages that check the role list directly (owner / HOS only) let them in as HOS too — not as an Ami.
  const page = async (path, selected) => (await worker.fetch(new Request(`https://ndovera.com${path}`, { headers: { Authorization: `Bearer ${token}`, 'X-Selected-Role': selected } }), { APP_DB: db, JWT_SECRET: SECRET }, { waitUntil() {}, passThroughOnException() {} })).status
  assert.notEqual(await page('/api/school/access-requests', 'hos'), 403)
  assert.equal(await page('/api/school/access-requests', 'teacher'), 403)
  assert.equal(await page('/api/ami/tenants', 'ami'), 403)
  // Fees, as the Head of School.
  for (const path of ['/api/school/finance/simple/overview', '/api/school/fees-ledger', '/api/school/fees-receipts', '/api/school/finance/context', '/api/school/finance/dashboard', '/api/school/fees/payment-claims', '/api/school/finance/claims', '/api/school/finance/ai-analysis']) {
    const status = await page(path, 'hos')
    assert.notEqual(status, 403, `${path} refused the HOS`)
  }
})
