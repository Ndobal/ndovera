import test from 'node:test'
import assert from 'node:assert/strict'
import { sign } from '@tsndr/cloudflare-worker-jwt'
import { D1Shim, createLegacySchema } from './d1-shim.mjs'

// Mock papers: pasted from an AI assistant, checked, kept as drafts until Ami publishes,
// sat as objectives, theory or both, with the answers held back until hand-in.

const SECRET = 'mock-papers-secret'
let generation = 0
const PEOPLE = {
  ss2: ['s-ss2', 'ss2@a.test', 'student', 'school-a', { classId: 'ss2a' }],
  jss1: ['s-jss1', 'jss1@a.test', 'student', 'school-a', { classId: 'jss1a' }],
  owner: ['o-1', 'owner@a.test', 'owner', 'school-a', {}],
  ami: ['ami-1', 'ami@ndovera.test', 'ami', '', {}],
}
const DEVICE = { 'X-Practice-Device': 'device-paper-0001' }

async function setup() {
  const worker = (await import(`./build/worker.mjs?papers=${generation++}`)).default
  const db = new D1Shim()
  createLegacySchema(db)
  db.db.exec(`
    CREATE TABLE subjects (id TEXT PRIMARY KEY, tenantId TEXT, name TEXT, classId TEXT, teacherId TEXT, createdAt TEXT);
    CREATE TABLE tenants (id TEXT PRIMARY KEY, school_name TEXT);
    INSERT INTO tenants VALUES ('school-a', 'Genesis College');
    INSERT INTO classes (id, tenantId, name, arm) VALUES ('ss2a', 'school-a', 'SS 2', 'A'), ('jss1a', 'school-a', 'JSS 1', 'A');
  `)
  for (const [id, email, role, tenant, extra] of Object.values(PEOPLE)) {
    await db.prepare('INSERT INTO users (id, email, name, role, tenantId, status) VALUES (?, ?, ?, ?, ?, ?)').bind(id, email, id, role, tenant, 'active').run()
    await db.prepare('INSERT INTO settings (studentId, payload) VALUES (?, ?)').bind(email, JSON.stringify({ name: id, email, role, tenantId: tenant, schoolId: tenant, status: 'active', ...extra })).run()
  }
  const call = async (person, method, path, body, headers = {}) => {
    const [id, , role, tenantId] = PEOPLE[person]
    const token = await sign({ id, role, roles: [role], tenantId, name: id, exp: Math.floor(Date.now() / 1000) + 600 }, SECRET)
    const response = await worker.fetch(new Request(`https://ndovera.com${path}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined }),
      { APP_DB: db, JWT_SECRET: SECRET }, { waitUntil() {}, passThroughOnException() {} })
    return { status: response.status, body: await response.json().catch(() => ({})) }
  }
  return { db, call }
}

const GOOD = {
  exam: 'WAEC', subject: 'Mathematics', setLabel: 'Mock 1', objectiveMinutes: 60, theoryMinutes: 120, instructions: 'Answer all.',
  objectives: [
    { question: 'What is 2 + 2?', options: ['3', '4', '5', '6'], answer: 'B', explanation: '2 + 2 = 4.' },
    { question: 'What is 3 x 3?', options: ['A. 6', 'B. 8', 'C. 9', 'D. 12'], answer: 'C', explanation: '3 x 3 = 9.' },
  ],
  theory: [{ question: 'Solve x + 2 = 5.', marks: 10, modelAnswer: 'x = 3', markingPoints: ['Subtract 2 from both sides'] }],
}
const WITH_DIAGRAMS = {
  ...GOOD, setLabel: 'Mock 2',
  objectives: [...GOOD.objectives, { question: 'Which part labelled in the diagram stores bile?', options: ['I', 'II', 'III', 'IV'], answer: 'A', explanation: 'Part I.', diagram: 'Human liver and gall bladder, labelled I to IV.' }],
  theory: [{ ...GOOD.theory[0], question: 'Describe the organ in the diagram.', diagram: 'Mammalian heart, four chambers labelled.' }],
}
const pasted = paper => 'Here is your paper:\n```json\n' + JSON.stringify(paper, null, 2) + '\n```'

async function publishedPaper(call) {
  const saved = await call('ami', 'POST', '/api/ami/mock-papers', { text: pasted(GOOD) })
  assert.equal(saved.status, 200, JSON.stringify(saved.body))
  const published = await call('ami', 'POST', `/api/ami/mock-papers/${saved.body.paper.id}/status`, { status: 'published' })
  assert.equal(published.status, 200, JSON.stringify(published.body))
  return saved.body.paper.id
}

async function grantWaecPass(db, call, studentId = 's-ss2') {
  await call('ss2', 'GET', '/api/practice-arena/papers') // creates the tables
  const stamp = new Date().toISOString()
  db.db.prepare(`INSERT INTO practice_passes (id, tenant_id, student_id, bundle, starts_at, expires_at, source, created_at) VALUES ('pass-1', 'school-a', ?, 'ssce', ?, '2099-01-01T00:00:00.000Z', 'payment', ?)`).run(studentId, stamp, stamp)
}

test('only Ami manages papers; a reply is read from its wrapping and every mistake is named', async () => {
  const { call } = await setup()
  assert.equal((await call('owner', 'GET', '/api/ami/mock-papers')).status, 403)
  assert.equal((await call('ss2', 'POST', '/api/ami/mock-papers', { text: pasted(GOOD) })).status, 403)

  const good = await call('ami', 'POST', '/api/ami/mock-papers/check', { text: pasted(GOOD) })
  assert.deepEqual(good.body.problems, [])
  assert.deepEqual([good.body.summary.objectives, good.body.summary.theory], [2, 1])
  // Trailing commas, as assistants sometimes write them, are forgiven.
  assert.ok((await call('ami', 'POST', '/api/ami/mock-papers/check', { text: '{"exam":"WAEC","subject":"Physics","setLabel":"M","objectiveMinutes":5,"objectives":[{"question":"Q?","options":["a","b","c","d"],"answer":"A",},],}' })).body.summary)

  assert.match((await call('ami', 'POST', '/api/ami/mock-papers/check', { text: 'Sorry, I cannot do that.' })).body.problems[0], /could not be read/)
  const bad = await call('ami', 'POST', '/api/ami/mock-papers/check', { text: JSON.stringify({ ...GOOD, objectiveMinutes: 0,
    objectives: [{ question: 'Q1?', options: ['a', 'a'], answer: 'B' }, { question: 'Q1?', options: ['x', 'y'], answer: 'E' }],
    theory: [{ question: 'T?', marks: 0 }] }) })
  const problems = bad.body.problems.join('\n')
  assert.equal(bad.body.summary, null)
  for (const expected of [/Objective 1: two options are the same/, /Objective 2: this question appears twice/, /Objective 2: the answer must be/, /Theory 1: the model answer is missing/, /Theory 1: "marks"/, /objectiveMinutes/]) assert.match(problems, expected)
  assert.equal((await call('ami', 'POST', '/api/ami/mock-papers', { text: JSON.stringify({ ...GOOD, objectives: [] , theory: [] }) })).status, 400)
  assert.match((await call('ami', 'POST', '/api/ami/mock-papers/check', { text: JSON.stringify({ ...GOOD, exam: 'JAMB' }) })).body.problems.join(), /JAMB is objective only/)

  const warned = await call('ami', 'POST', '/api/ami/mock-papers/check', { text: JSON.stringify({ ...GOOD, objectives: [{ question: 'From WAEC 2019: use the diagram below.', options: ['a', 'b', 'c'], answer: 'A' }] }) })
  const warnings = warned.body.warnings.join('\n')
  assert.match(warnings, /diagram/)
  assert.match(warnings, /real past paper/)
  assert.match(warnings, /3 options/)
})

test('a draft stays away from students and the bank until published; withdrawing takes it back', async () => {
  const { db, call } = await setup()
  const saved = await call('ami', 'POST', '/api/ami/mock-papers', { text: pasted(GOOD) })
  const id = saved.body.paper.id
  assert.equal(saved.body.paper.status, 'draft')
  assert.equal(saved.body.paper.objectives[1].answerIndex, 2)
  assert.equal(saved.body.paper.objectives[1].options[2], '9', 'option letters are removed')
  assert.equal((await call('ami', 'POST', '/api/ami/mock-papers', { text: pasted(GOOD) })).status, 409, 'the same paper name twice')
  assert.deepEqual((await call('ss2', 'GET', '/api/practice-arena/papers')).body.papers, [])
  assert.equal((await call('ss2', 'GET', `/api/practice-arena/papers/${id}?part=both`, null, DEVICE)).status, 404)

  assert.equal((await call('ami', 'POST', `/api/ami/mock-papers/${id}/status`, { status: 'published' })).status, 200)
  assert.equal((await call('ami', 'DELETE', `/api/ami/mock-papers/${id}`)).status, 409, 'withdraw first')
  // The objectives wait in the bank for the chief examiner's check, filed under their examination.
  const bank = db.db.prepare(`SELECT exam, difficulty, section, subject_key, quality, playable FROM question_bank WHERE origin_type = 'mock_paper' AND origin_id = ?`).all(id)
  assert.equal(bank.length, 2)
  assert.ok(bank.every(row => row.exam === 'waec' && row.difficulty === 'external' && row.section === 'senior' && row.subject_key === 'mathematics' && row.quality === null && row.playable === 1))
  // Another section does not see it.
  assert.deepEqual((await call('jss1', 'GET', '/api/practice-arena/papers')).body.papers, [])

  assert.equal((await call('ami', 'POST', `/api/ami/mock-papers/${id}/status`, { status: 'draft' })).status, 200)
  assert.deepEqual((await call('ss2', 'GET', '/api/practice-arena/papers')).body.papers, [])
  assert.ok(db.db.prepare(`SELECT playable FROM question_bank WHERE origin_id = ?`).all(id).every(row => row.playable === 0))
  assert.equal((await call('ami', 'DELETE', `/api/ami/mock-papers/${id}`)).status, 200)
  assert.deepEqual((await call('ami', 'GET', '/api/ami/mock-papers')).body.papers, [])
})

test('a paper with diagrams cannot be published until each is attached, and diagrams reach students', async () => {
  const { db, call } = await setup()
  const uploads = new Map()
  const UPLOADS = { put: async (key, body, options) => { uploads.set(key, { body, options }) }, delete: async key => { uploads.delete(key) } }
  const send = async (person, method, path, form) => {
    const [id, , role, tenantId] = PEOPLE[person]
    const token = await sign({ id, role, roles: [role], tenantId, name: id, exp: Math.floor(Date.now() / 1000) + 600 }, SECRET)
    const worker = (await import(`./build/worker.mjs?papers=${generation++}`)).default
    const response = await worker.fetch(new Request(`https://ndovera.com${path}`, { method, headers: { Authorization: `Bearer ${token}` }, body: form }), { APP_DB: db, JWT_SECRET: SECRET, UPLOADS }, { waitUntil() {}, passThroughOnException() {} })
    return { status: response.status, body: await response.json().catch(() => ({})) }
  }
  const image = (type = 'image/png', size = 10) => { const form = new FormData(); form.append('file', new File([new Uint8Array(size)], 'd.png', { type })); return form }

  const checked = await call('ami', 'POST', '/api/ami/mock-papers/check', { text: pasted(WITH_DIAGRAMS) })
  assert.equal(checked.body.summary.diagrams, 2)
  assert.doesNotMatch(checked.body.warnings.join(), /no "diagram" description/)
  // Mentioning a diagram without describing one is pointed out.
  const undescribed = await call('ami', 'POST', '/api/ami/mock-papers/check', { text: JSON.stringify({ ...GOOD, objectives: [{ question: 'Name the part in the diagram.', options: ['a', 'b', 'c', 'd'], answer: 'A' }] }) })
  assert.match(undescribed.body.warnings.join(), /no "diagram" description/)

  const saved = await call('ami', 'POST', '/api/ami/mock-papers', { text: pasted(WITH_DIAGRAMS) })
  const id = saved.body.paper.id
  const objective = saved.body.paper.objectives[2]
  const theory = saved.body.paper.theory[0]
  assert.equal(objective.diagram, 'Human liver and gall bladder, labelled I to IV.')
  assert.equal((await call('ami', 'GET', '/api/ami/mock-papers')).body.papers[0].diagramsMissing, 2)

  const blocked = await call('ami', 'POST', `/api/ami/mock-papers/${id}/status`, { status: 'published' })
  assert.equal(blocked.status, 409)
  assert.match(blocked.body.message, /Objective 3, Theory 1/)

  const path = question => `/api/ami/mock-papers/${id}/questions/${question}/diagram`
  assert.equal((await send('ss2', 'POST', path(objective.id), image())).status, 403)
  assert.equal((await send('ami', 'POST', path(objective.id), image('image/svg+xml'))).status, 400, 'SVG can carry scripts')
  assert.equal((await send('ami', 'POST', path(objective.id), image('image/png', 2 * 1024 * 1024 + 1))).status, 400)
  assert.equal((await send('ami', 'POST', path('nope'), image())).status, 404)
  assert.equal(uploads.size, 0, 'nothing is left behind by a refused upload')

  const first = await send('ami', 'POST', path(objective.id), image())
  assert.equal(first.status, 200, JSON.stringify(first.body))
  assert.match(first.body.paper.objectives[2].imageUrl, /^\/files\/mock-papers\//)
  // Replacing a diagram removes the old image.
  await send('ami', 'POST', path(objective.id), image('image/jpeg'))
  assert.equal(uploads.size, 1)
  assert.equal((await call('ami', 'POST', `/api/ami/mock-papers/${id}/status`, { status: 'published' })).status, 409, 'one is still missing')
  await send('ami', 'POST', path(theory.id), image())
  const published = await call('ami', 'POST', `/api/ami/mock-papers/${id}/status`, { status: 'published' })
  assert.equal(published.status, 200, JSON.stringify(published.body))
  assert.equal((await send('ami', 'DELETE', path(theory.id))).status, 409, 'withdraw before changing')

  // The night's check reads text only: diagram questions stay in the paper, out of the bank.
  const bank = db.db.prepare(`SELECT prompt FROM question_bank WHERE origin_type = 'mock_paper' AND origin_id = ?`).all(id)
  assert.equal(bank.length, 2)
  assert.ok(bank.every(row => !/diagram/.test(row.prompt)))

  await grantWaecPass(db, call)
  const sitting = await call('ss2', 'GET', `/api/practice-arena/papers/${id}?part=both`, null, DEVICE)
  assert.match(sitting.body.paper.objectives[2].imageUrl, /^\/files\//)
  assert.match(sitting.body.paper.theory[0].imageUrl, /^\/files\//)
  assert.doesNotMatch(JSON.stringify(sitting.body), /Human liver|four chambers/, 'the drawing notes stay with Ami')
  const handed = await call('ss2', 'POST', `/api/practice-arena/papers/${id}/submit`, { part: 'both', answers: {} }, DEVICE)
  assert.match(handed.body.result.objectives[2].imageUrl, /^\/files\//)
  assert.match(handed.body.result.theory[0].imageUrl, /^\/files\//)

  // Withdrawn, a diagram can be removed, and the paper cannot go back up without it.
  await call('ami', 'POST', `/api/ami/mock-papers/${id}/status`, { status: 'draft' })
  assert.equal((await send('ami', 'DELETE', path(theory.id))).status, 200)
  assert.equal((await call('ami', 'POST', `/api/ami/mock-papers/${id}/status`, { status: 'published' })).status, 409)
})

test('a paper needs its pass, and a device', async () => {
  const { db, call } = await setup()
  const id = await publishedPaper(call)
  const [listed] = (await call('ss2', 'GET', '/api/practice-arena/papers')).body.papers
  assert.equal(listed.locked, true)
  assert.match(listed.lockedReason, /WAEC \/ NECO Prep/)
  assert.equal(listed.objectives, undefined)
  const locked = await call('ss2', 'GET', `/api/practice-arena/papers/${id}?part=objective`, null, DEVICE)
  assert.deepEqual([locked.status, locked.body.needs], [402, 'waec'])
  assert.equal((await call('ss2', 'POST', `/api/practice-arena/papers/${id}/submit`, { part: 'objective', answers: {} }, DEVICE)).status, 402, 'no answers without the pass')

  await grantWaecPass(db, call)
  assert.equal((await call('ss2', 'GET', '/api/practice-arena/papers')).body.papers[0].locked, false)
  assert.equal((await call('ss2', 'GET', `/api/practice-arena/papers/${id}?part=objective`)).status, 400, 'a device is required')
})

test('students choose objectives, theory or both; answers come only after hand-in, marked on the server', async () => {
  const { db, call } = await setup()
  const id = await publishedPaper(call)
  await grantWaecPass(db, call)
  const open = part => call('ss2', 'GET', `/api/practice-arena/papers/${id}?part=${part}`, null, DEVICE)

  const objective = (await open('objective')).body.paper
  assert.deepEqual([objective.objectives.length, objective.theory.length, objective.minutes], [2, 0, 60])
  const theory = (await open('theory')).body.paper
  assert.deepEqual([theory.objectives.length, theory.theory.length, theory.minutes], [0, 1, 120])
  const both = await open('both')
  assert.deepEqual([both.body.paper.objectives.length, both.body.paper.theory.length, both.body.paper.minutes], [2, 1, 180])
  assert.equal((await open('neither')).status, 400)
  // Nothing that gives the answers away is sent before hand-in.
  assert.doesNotMatch(JSON.stringify(both.body), /answerIndex|explanation|modelAnswer|markingPoints|x = 3/)

  const [first, second] = both.body.paper.objectives
  const handed = await call('ss2', 'POST', `/api/practice-arena/papers/${id}/submit`, { part: 'both', answers: { [first.id]: 1, [second.id]: 0 }, score: 99 }, DEVICE)
  assert.equal(handed.status, 200, JSON.stringify(handed.body))
  const { result } = handed.body
  assert.deepEqual([result.score, result.total], [1, 2], 'the request cannot set the score')
  assert.deepEqual(result.objectives.map(item => [item.correct, item.answerIndex]), [[true, 1], [false, 2]])
  assert.equal(result.theory[0].modelAnswer, 'x = 3')
  assert.deepEqual(result.theory[0].markingPoints, ['Subtract 2 from both sides'])

  const theoryOnly = await call('ss2', 'POST', `/api/practice-arena/papers/${id}/submit`, { part: 'theory', answers: {} }, DEVICE)
  assert.deepEqual([theoryOnly.body.result.total, theoryOnly.body.result.objectives.length, theoryOnly.body.result.theory.length], [0, 0, 1])
  const attempts = db.db.prepare(`SELECT part, score, total FROM mock_paper_attempts WHERE student_id = 's-ss2' ORDER BY created_at`).all()
  assert.equal(attempts.length, 2)
})
