import test from 'node:test'
import assert from 'node:assert/strict'
import { sign } from '@tsndr/cloudflare-worker-jwt'
import { D1Shim, createLegacySchema } from './d1-shim.mjs'

const SECRET = 'evaluation-test-secret'
let worker
let generation = 0
let aiInputs = []

const PEOPLE = {
  hos: ['h-a', 'hos@a.test', 'hos', 'school-a'],
  ada: ['ada', 'ada@a.test', 'teacher', 'school-a'],
  bola: ['bola', 'bola@a.test', 'teacher', 'school-a'],
  chi: ['chi', 'chi@a.test', 'teacher', 'school-a'],
  pupil: ['pupil', 'pupil@a.test', 'student', 'school-a'],
  outsider: ['zed', 'zed@b.test', 'owner', 'school-b'],
}

async function setup() {
  worker = (await import(`./build/worker.mjs?eval=${generation++}`)).default
  aiInputs = []
  const db = new D1Shim()
  createLegacySchema(db)
  for (const [id, email, role, tenant] of Object.values(PEOPLE)) {
    await db.prepare('INSERT INTO users (id, email, name, role, tenantId, status) VALUES (?, ?, ?, ?, ?, ?)').bind(id, email, id.toUpperCase(), role, tenant, 'active').run()
    await db.prepare('INSERT INTO settings (studentId, payload) VALUES (?, ?)').bind(email, JSON.stringify({ name: id.toUpperCase(), email, role, tenantId: tenant, status: 'active' })).run()
  }
  return db
}

async function call(db, person, method, path, body) {
  const [id, , role, tenantId] = PEOPLE[person]
  const token = await sign({ id, role, roles: [role], tenantId, name: id, exp: Math.floor(Date.now() / 1000) + 600 }, SECRET)
  const env = { APP_DB: db, JWT_SECRET: SECRET, AI: { run: async (_m, input) => { aiInputs.push(input); return { response: '# Summary\n## Recurring strengths\n- Punctual' } } } }
  const response = await worker.fetch(new Request(`https://ndovera.com${path}`, {
    method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
  }), env, { waitUntil() {}, passThroughOnException() {} })
  return { status: response.status, body: await response.json().catch(() => ({})) }
}

const day = offset => new Date(Date.now() + offset * 86400000).toISOString()
const exercise = (extra = {}) => ({
  title: 'First Term peer review', periodLabel: 'First Term 2026/2027',
  questions: [{ id: 'q1', text: 'Punctuality', kind: 'rating' }, { id: 'q2', text: 'Teamwork', kind: 'rating' }, { id: 'c1', text: 'Comments', kind: 'comment' }],
  scale: { min: 1, max: 5 }, reviewers: { mode: 'roles', roles: ['teacher'] }, subjects: { mode: 'roles', roles: ['teacher'] },
  opensAt: day(-1), closesAt: day(7), ...extra,
})

test('staff review colleagues once each, never themselves, and only while open', async () => {
  const db = await setup()
  assert.equal((await call(db, 'ada', 'POST', '/api/staff-evaluations', exercise())).status, 403)
  const created = await call(db, 'hos', 'POST', '/api/staff-evaluations', exercise())
  assert.equal(created.status, 201)
  assert.equal(created.body.evaluation.status, 'open')
  const id = created.body.evaluation.id

  const mine = await call(db, 'ada', 'GET', '/api/staff-evaluations-mine')
  assert.deepEqual(mine.body.evaluations[0].colleagues.map(person => person.id).sort(), ['bola', 'chi'])
  assert.equal((await call(db, 'pupil', 'GET', '/api/staff-evaluations-mine')).body.evaluations.length, 0)

  const answers = { q1: 5, q2: 4, c1: 'Always early to class.' }
  assert.equal((await call(db, 'ada', 'POST', `/api/staff-evaluations/${id}/responses`, { subjectId: 'ada', answers })).status, 403)
  assert.equal((await call(db, 'ada', 'POST', `/api/staff-evaluations/${id}/responses`, { subjectId: 'bola', answers: { q1: 9, q2: 4 } })).status, 400)
  assert.equal((await call(db, 'ada', 'POST', `/api/staff-evaluations/${id}/responses`, { subjectId: 'bola', answers })).status, 201)
  assert.equal((await call(db, 'ada', 'POST', `/api/staff-evaluations/${id}/responses`, { subjectId: 'bola', answers })).status, 409)
  assert.equal((await call(db, 'pupil', 'POST', `/api/staff-evaluations/${id}/responses`, { subjectId: 'bola', answers })).status, 403)

  // Closing ends it; extending the deadline reopens it.
  await call(db, 'hos', 'POST', `/api/staff-evaluations/${id}/close`)
  assert.equal((await call(db, 'chi', 'POST', `/api/staff-evaluations/${id}/responses`, { subjectId: 'bola', answers })).status, 409)
  const extended = await call(db, 'hos', 'PUT', `/api/staff-evaluations/${id}`, exercise({ closesAt: day(14) }))
  assert.equal(extended.body.evaluation.status, 'open')
})

test('results aggregate without revealing reviewers, and the AI summary uses only what was said', async () => {
  const db = await setup()
  const id = (await call(db, 'hos', 'POST', '/api/staff-evaluations', exercise())).body.evaluation.id
  await call(db, 'ada', 'POST', `/api/staff-evaluations/${id}/responses`, { subjectId: 'bola', answers: { q1: 5, q2: 3, c1: 'Always early.' } })
  await call(db, 'chi', 'POST', `/api/staff-evaluations/${id}/responses`, { subjectId: 'bola', answers: { q1: 4, q2: 5, c1: 'Helps colleagues.' } })

  assert.equal((await call(db, 'ada', 'GET', `/api/staff-evaluations/${id}/results`)).status, 403)
  assert.equal((await call(db, 'outsider', 'GET', `/api/staff-evaluations/${id}/results`)).status, 404)
  const results = await call(db, 'hos', 'GET', `/api/staff-evaluations/${id}/results`)
  const bola = results.body.staff.find(item => item.staffId === 'bola')
  assert.deepEqual([bola.responses, bola.questions[0].average, bola.questions[1].average, bola.overall], [2, 4.5, 4, 4.25])
  assert.deepEqual(bola.questions[2].comments, ['Always early.', 'Helps colleagues.'])
  assert.deepEqual(results.body.completion, { eligibleReviewers: 3, reviewersStarted: 2, reviewersFinished: 0, responsesReceived: 2, responsesExpected: 6, rate: 33.3 })
  // No reviewer identity anywhere in the results.
  assert.ok(!/"(ada|chi)"/.test(JSON.stringify(bola)))

  const summary = await call(db, 'hos', 'POST', `/api/staff-evaluations/${id}/results/bola/ai-summary`)
  assert.equal(summary.status, 200)
  assert.match(aiInputs[0].messages[0].content, /Do not invent ratings, comments/)
  assert.match(aiInputs[0].messages[1].content, /average 4\.5/)
  const again = await call(db, 'hos', 'GET', `/api/staff-evaluations/${id}/results`)
  assert.match(again.body.staff.find(item => item.staffId === 'bola').aiSummary.text, /Punctual/)
})

test('an evaluation not yet open shows as Not Started and refuses answers', async () => {
  const db = await setup()
  const created = await call(db, 'hos', 'POST', '/api/staff-evaluations', exercise({ opensAt: day(2), closesAt: day(9) }))
  assert.equal(created.body.evaluation.status, 'not_started')
  assert.equal((await call(db, 'ada', 'POST', `/api/staff-evaluations/${created.body.evaluation.id}/responses`, { subjectId: 'bola', answers: { q1: 5, q2: 5 } })).status, 409)
})
