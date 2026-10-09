import test from 'node:test'
import assert from 'node:assert/strict'
import { sign } from '@tsndr/cloudflare-worker-jwt'
import { D1Shim, createLegacySchema } from './d1-shim.mjs'

const SECRET = 'practice-test-secret'
let worker
let generation = 0

const PEOPLE = {
  maths: ['t-math', 'math@a.test', 'teacher', 'school-a', {}],
  owner: ['o-1', 'owner@a.test', 'owner', 'school-a', {}],
  jss2: ['s-jss2', 'jss2@a.test', 'student', 'school-a', { classId: 'jss2a' }],
  jss3: ['s-jss3', 'jss3@a.test', 'student', 'school-a', { classId: 'jss3a' }],
  jss2b: ['s-jss2b', 'jss2b@a.test', 'student', 'school-a', { classId: 'jss2a' }],
  primary: ['s-pry', 'pry@a.test', 'student', 'school-a', { classId: 'pry4' }],
  ami: ['ami-1', 'ami@ndovera.test', 'ami', '', {}],
}

const now = () => new Date().toISOString()
const daysFromNow = days => new Date(Date.now() + days * 86400000).toISOString()

/** A stand-in model: writes quiz questions, answer keys and tutor answers, and counts what it was asked. */
function fakeModel(calls) {
  let counter = 0
  return {
    toMarkdown: async files => [{ name: files[0].name, format: 'markdown', data: 'unused' }],
    run: async (_model, input) => {
      const system = String(input.messages?.[0]?.content || '')
      const user = String(input.messages?.[input.messages.length - 1]?.content || '')
      if (/examiner/i.test(system)) {
        calls.keys += 1
        const ids = [...user.matchAll(/^ID: (\S+)/gm)].map(match => match[1])
        return { response: JSON.stringify(ids.map(id => ({ id, answer: 'Abuja', alternatives: ['Abuja city'], explanation: 'Abuja has been the capital since 1991.' }))) }
      }
      const slots = [...user.matchAll(/^\d+\. type "(\w+)", topic "([^"]+)", (\d+) mark/gm)]
      if (slots.length) {
        calls.generate += 1
        return { response: JSON.stringify(slots.map(([, , topic]) => {
          counter += 1
          return { prompt: `Q${counter}: Which statement about ${topic || 'numbers'} is correct in case ${counter}?`, options: [`Right ${counter}`, `Wrong a${counter}`, `Wrong b${counter}`, `Wrong c${counter}`], answerIndex: 0, markingPoints: ['x'] }
        })) }
      }
      calls.other += 1
      return { response: 'Photosynthesis is how green plants make food from sunlight, water and carbon dioxide.' }
    },
  }
}

function memoryBucket() {
  const store = new Map()
  return {
    store,
    put: async (key, value, options = {}) => { store.set(key, { value: typeof value === 'string' ? new TextEncoder().encode(value) : new Uint8Array(value), options }) },
    get: async key => {
      const item = store.get(key)
      if (!item) return null
      return { size: item.value.byteLength, httpMetadata: item.options.httpMetadata || {}, arrayBuffer: async () => item.value.buffer.slice(item.value.byteOffset, item.value.byteOffset + item.value.byteLength), text: async () => new TextDecoder().decode(item.value) }
    },
  }
}

async function setup() {
  worker = (await import(`./build/worker.mjs?practice-harvest=${generation++}`)).default
  const db = new D1Shim()
  createLegacySchema(db)
  db.db.exec(`
    CREATE TABLE subjects (id TEXT PRIMARY KEY, tenantId TEXT, name TEXT, classId TEXT, teacherId TEXT, createdAt TEXT);
    CREATE TABLE tenants (id TEXT PRIMARY KEY, school_name TEXT);
    INSERT INTO tenants VALUES ('school-a', 'Genesis International School');
    INSERT INTO classes (id, tenantId, name, arm) VALUES ('jss1a', 'school-a', 'JSS 1', 'A'), ('jss2a', 'school-a', 'JSS 2', 'A'), ('jss3a', 'school-a', 'JSS 3', 'A'), ('pry4', 'school-a', 'Primary 4', 'Gold');
    INSERT INTO subjects VALUES ('m1', 'school-a', 'Mathematics', 'jss1a', 't-math', 'x'), ('m2', 'school-a', 'Mathematics', 'jss2a', 't-math', 'x'),
      ('m3', 'school-a', 'General Mathematics', 'jss3a', 't-math', 'x'), ('mp', 'school-a', 'Maths', 'pry4', 't-math', 'x'), ('bs2', 'school-a', 'Basic Science', 'jss2a', 't-math', 'x'),
      ('qr4', 'school-a', 'Quantitative Reasoning', 'pry4', 't-math', 'x'), ('vr4', 'school-a', 'Verbal Reasoning', 'pry4', 't-math', 'x');
    CREATE TABLE assignments (id TEXT PRIMARY KEY, classId TEXT, title TEXT, description TEXT, dueAt TEXT, createdAt TEXT, subjectId TEXT, subjectName TEXT, format TEXT, questionPayload TEXT, metadata TEXT, createdBy TEXT, updatedAt TEXT);
    CREATE TABLE materials (id TEXT PRIMARY KEY, classId TEXT, title TEXT, url TEXT, metadata TEXT, uploadedAt TEXT, uploadedBy TEXT);
  `)
  for (const [id, email, role, tenant, extra] of Object.values(PEOPLE)) {
    await db.prepare('INSERT INTO users (id, email, name, role, tenantId, status) VALUES (?, ?, ?, ?, ?, ?)').bind(id, email, id, role, tenant, 'active').run()
    await db.prepare('INSERT INTO settings (studentId, payload) VALUES (?, ?)').bind(email, JSON.stringify({ name: id, email, role, tenantId: tenant, schoolId: tenant, status: 'active', ...extra })).run()
  }
  return db
}

function envFor(db, extra = {}) {
  return { APP_DB: db, JWT_SECRET: SECRET, ...extra }
}

async function call(db, person, method, path, body, env = {}) {
  const [id, , role, tenantId] = PEOPLE[person]
  const token = await sign({ id, role, roles: [role], tenantId, name: id, exp: Math.floor(Date.now() / 1000) + 600 }, SECRET)
  const isForm = body instanceof FormData
  const response = await worker.fetch(new Request(`https://ndovera.com${path}`, {
    method, headers: { Authorization: `Bearer ${token}`, ...(isForm ? {} : { 'Content-Type': 'application/json' }) }, body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
  }), envFor(db, env), { waitUntil() {}, passThroughOnException() {} })
  return { status: response.status, body: await response.json().catch(() => ({})) }
}

async function cronTick(db, env = {}) {
  const pending = []
  await worker.scheduled({ cron: '* * * * *', scheduledTime: Date.now() }, envFor(db, env), { waitUntil: promise => pending.push(promise), passThroughOnException() {} })
  await Promise.allSettled(pending)
}

async function seedTeachersWork(db) {
  const insert = (id, classId, subjectId, subjectName, dueAt, questions) => db.prepare(`INSERT INTO assignments (id, classId, title, description, dueAt, createdAt, subjectId, subjectName, format, questionPayload, metadata, createdBy, updatedAt)
    VALUES (?, ?, ?, '', ?, ?, ?, ?, 'objective', ?, '{}', 't-math', ?)`).bind(id, classId, `Work ${id}`, dueAt, now(), subjectId, subjectName, JSON.stringify(questions), now()).run()
  await insert('a-jss1', 'jss1a', 'm1', 'Mathematics', daysFromNow(-3), [
    { type: 'mcq', prompt: 'What is 2 + 2?', options: ['3', '4', '5', '6'], answer: '4' },
    { type: 'shortanswer', prompt: 'What is the square root of 81?', answer: '9' },
    { type: 'shortanswer', prompt: 'Name the capital of Nigeria.', answer: '' },
  ])
  await insert('a-jss3', 'jss3a', 'm3', 'General Mathematics', daysFromNow(-1), [
    { type: 'mcq', prompt: 'Solve 2x = 10 for x.', options: ['2', '5', '10', '20'], answer: 'B' },
    { type: 'truefalse', prompt: 'A triangle has three sides.', answer: 'True' },
  ])
  // Homework still open: its answers must not appear in practice until it is due.
  await insert('a-jss2-open', 'jss2a', 'm2', 'Mathematics', daysFromNow(4), [
    { type: 'mcq', prompt: 'HOMEWORK: What is 7 x 8?', options: ['54', '56', '58', '64'], answer: '56' },
  ])
  await insert('a-pry', 'pry4', 'mp', 'Maths', daysFromNow(-2), [
    { type: 'mcq', prompt: 'PRIMARY: What is 10 - 4?', options: ['4', '5', '6', '7'], answer: '6' },
  ])
  // An exam paper: held back until after the exam.
  db.db.exec(`CREATE TABLE IF NOT EXISTS ai_assessments (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, class_id TEXT NOT NULL, class_name TEXT, subject_id TEXT NOT NULL, subject_name TEXT,
    session_name TEXT, term_name TEXT, kind TEXT NOT NULL, title TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft', config_json TEXT NOT NULL, blueprint_json TEXT, blueprint_approved INTEGER NOT NULL DEFAULT 0,
    slots_json TEXT NOT NULL DEFAULT '[]', questions_json TEXT NOT NULL DEFAULT '[]', failed_json TEXT NOT NULL DEFAULT '[]', review_json TEXT, delivery_json TEXT, version INTEGER NOT NULL DEFAULT 0,
    posted_assignment_id TEXT, submission_id TEXT, created_by TEXT NOT NULL, created_by_name TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`)
  await db.prepare(`INSERT INTO ai_assessments (id, tenant_id, class_id, class_name, subject_id, subject_name, kind, title, status, config_json, questions_json, created_by, created_at, updated_at)
    VALUES ('exam-1', 'school-a', 'jss2a', 'JSS 2 A', 'm2', 'Mathematics', 'exam', 'First Term Exam', 'submitted', '{}', ?, 't-math', ?, ?)`).bind(JSON.stringify([
    { id: 'q-e1', type: 'mcq', prompt: 'EXAM: What is 12 divided by 4?', options: ['2', '3', '4', '6'], answerIndex: 1 },
  ]), now(), now()).run()
  // A material with structured notes and one typed with questions in it.
  await db.prepare('INSERT INTO materials (id, classId, title, url, metadata, uploadedAt, uploadedBy) VALUES (?, ?, ?, ?, ?, ?, ?)').bind('mat-blocks', 'jss2a', 'Fractions made easy', null, JSON.stringify({
    subjectId: 'm2', subjectName: 'Mathematics', topic: 'Fractions', visibility: 'student_parent',
    blocks: [{ type: 'heading', text: 'What is a fraction?' }, { type: 'paragraph', text: 'A fraction is part of a whole.' }, { type: 'exam_tip', text: 'Always simplify your answer.' }, { type: 'list', items: ['Numerator', 'Denominator'], ordered: false }],
  }), now(), 't-math').run()
  await db.prepare('INSERT INTO materials (id, classId, title, url, metadata, uploadedAt, uploadedBy) VALUES (?, ?, ?, ?, ?, ?, ?)').bind('mat-text', 'jss2a', 'Photosynthesis', null, JSON.stringify({
    subjectId: 'bs2', subjectName: 'Basic Science', topic: 'Plants', visibility: 'student_parent',
    description: 'PHOTOSYNTHESIS\nGreen plants make their own food using sunlight.\nThe process needs water, carbon dioxide and chlorophyll.\n\nEVALUATION\n1. Which gas do plants take in during photosynthesis?\n(a) oxygen (b) carbon dioxide* (c) nitrogen (d) hydrogen\n2. Define photosynthesis.',
  }), now(), 't-math').run()
}

test('levels are read from the names schools use, and subjects practise together however they are spelt', async () => {
  const { levelOf, subjectKeyOf } = await import('./build/practiceLevels.mjs')
  const rank = name => levelOf(name)?.rank ?? null
  assert.deepEqual(['Primary 4', 'Pry 4', 'Basic 4', 'JSS 2 Gold', 'JS2', 'Junior Secondary II', 'Basic 8', 'SS 3', 'SSS3', 'Senior Secondary School 1', 'Nursery 1', 'KG', 'Grade 11', 'Physics Lab'].map(rank),
    [4, 4, 4, 8, 8, 8, 8, 12, 12, 10, -1, 0, 11, null])
  assert.equal(levelOf('JSS 3').section, 'junior')
  assert.equal(subjectKeyOf('General Mathematics'), subjectKeyOf('Maths'))
  assert.equal(subjectKeyOf('English Language'), subjectKeyOf('English'))
  assert.notEqual(subjectKeyOf('Further Mathematics'), subjectKeyOf('Mathematics'))
})

test('the harvester fills the bank from teachers\' work; practice follows the class ladder, holds back exams and open homework, and makes no AI call', async () => {
  const db = await setup()
  await seedTeachersWork(db)
  const calls = { keys: 0, generate: 0, other: 0 }
  const env = { AI: fakeModel(calls), UPLOADS: memoryBucket() }
  for (let i = 0; i < 4; i += 1) await cronTick(db, env)

  // A question without an answer key got one from Ndovera AI, once, and it was stored.
  const capital = db.db.prepare(`SELECT * FROM question_bank WHERE prompt = 'Name the capital of Nigeria.'`).get()
  assert.equal(capital.answer_source, 'ai')
  assert.equal(capital.playable, 1)
  assert.deepEqual(JSON.parse(capital.answer_json), ['Abuja', 'Abuja city'])
  const keyCalls = calls.keys
  await cronTick(db, env)
  assert.equal(calls.keys, keyCalls, 'answer keys are not asked for again')

  // Practice runs without any AI binding at all.
  const noAi = {}
  const home2 = await call(db, 'jss2', 'GET', '/api/practice-arena/home', null, noAi)
  assert.equal(home2.status, 200, JSON.stringify(home2.body))
  assert.equal(home2.body.student.level, 'JSS 2')
  const maths2 = home2.body.subjects.find(subject => subject.key === 'mathematics')
  // JSS 2 sees JSS 1 work (3), not JSS 3's, not the open homework, not the exam, not Primary.
  assert.equal(maths2.questions, 3)
  const pack2 = await call(db, 'jss2', 'GET', '/api/practice-arena/pack?subject=mathematics', null, noAi)
  assert.equal(pack2.status, 200, JSON.stringify(pack2.body))
  const prompts2 = pack2.body.pack.questions.map(question => question.prompt)
  assert.ok(prompts2.includes('What is 2 + 2?'))
  assert.ok(!prompts2.some(prompt => /HOMEWORK|EXAM|PRIMARY|2x = 10/.test(prompt)), prompts2.join(' | '))
  // Questions from a note made by the teacher count too (Basic Science, JSS 2).
  const science = home2.body.subjects.find(subject => subject.key === 'basic-science')
  assert.ok(science && science.questions >= 1, JSON.stringify(home2.body.subjects))

  const home3 = await call(db, 'jss3', 'GET', '/api/practice-arena/home', null, noAi)
  assert.equal(home3.body.subjects.find(subject => subject.key === 'mathematics').questions, 5)
  const homeP = await call(db, 'primary', 'GET', '/api/practice-arena/home', null, noAi)
  assert.equal(homeP.body.subjects.find(subject => subject.key === 'mathematics').questions, 1)
  // Ndovera's own Quantitative Reasoning questions, Primary 1 up to the pupil's class (4 runs: Primary 1–4 are in).
  const qr = homeP.body.subjects.find(subject => subject.key === 'quantitative-reasoning')
  assert.ok(qr && qr.questions > 100, JSON.stringify(homeP.body.subjects))
  assert.equal(qr.levels, 'Primary 1 – Primary 4')
  assert.equal(home2.body.subjects.find(subject => subject.key === 'quantitative-reasoning'), undefined, 'JSS pupils do not get Primary QR')
  // And Verbal Reasoning, a slice of the 1,000-item class banks a run, Primary 1 first.
  const vr = homeP.body.subjects.find(subject => subject.key === 'verbal-reasoning')
  assert.ok(vr && vr.questions > 500, JSON.stringify(homeP.body.subjects))
  assert.match(vr.levels, /^Primary 1/)
  assert.equal(home2.body.subjects.find(subject => subject.key === 'verbal-reasoning'), undefined, 'JSS pupils do not get Primary VR')
  // Teachers do not practise.
  assert.equal((await call(db, 'maths', 'GET', '/api/practice-arena/home', null, noAi)).status, 403)

  // Exam questions wait for the exam; open homework waits for its due date.
  const held = db.db.prepare(`SELECT prompt, release_at FROM question_bank WHERE prompt LIKE 'EXAM:%' OR prompt LIKE 'HOMEWORK:%'`).all()
  assert.equal(held.length, 2)
  assert.ok(held.every(row => row.release_at > now()))
  // Once the exam is over, they come in.
  db.db.prepare(`UPDATE question_bank SET release_at = ? WHERE prompt LIKE 'EXAM:%'`).run(daysFromNow(-1))
  assert.equal((await call(db, 'jss2', 'GET', '/api/practice-arena/home', null, noAi)).body.subjects.find(subject => subject.key === 'mathematics').questions, 4)

  // Ndovera copies of the materials, formatted, for the class.
  const notes = await call(db, 'jss2', 'GET', '/api/ndovera-notes', null, noAi)
  assert.equal(notes.status, 200)
  assert.deepEqual(notes.body.notes.map(note => note.materialId).sort(), ['mat-blocks', 'mat-text'])
  const note = await call(db, 'jss2', 'GET', '/api/ndovera-notes/mat-blocks', null, noAi)
  assert.match(note.body.note.markdown, /^# Fractions made easy/)
  assert.match(note.body.note.markdown, /## What is a fraction\?/)
  assert.match(note.body.note.markdown, /💡 \*\*Exam tip:\*\* Always simplify/)
  const typed = await call(db, 'jss2', 'GET', '/api/ndovera-notes/mat-text', null, noAi)
  assert.match(typed.body.note.markdown, /## Photosynthesis/)
  assert.equal((await call(db, 'jss3', 'GET', '/api/ndovera-notes/mat-blocks', null, noAi)).status, 404)
  assert.equal(calls.other, 0, 'no tutor or other AI call was made')
})

test('a quiz is marked again on the server, counted once, and earns XP, streaks and badges', async () => {
  const db = await setup()
  await seedTeachersWork(db)
  const env = { AI: fakeModel({ keys: 0, generate: 0, other: 0 }) }
  for (let i = 0; i < 3; i += 1) await cronTick(db, env)
  const pack = (await call(db, 'jss3', 'GET', '/api/practice-arena/pack?subject=mathematics')).body.pack
  const answers = pack.questions.map(question => ({
    questionId: question.id,
    response: question.type === 'mcq' || question.type === 'truefalse' ? question.correctIndex : question.accepted?.[0],
  }))
  // A typo in a long answer still counts; a wrong choice does not.
  const attempt = { id: 'attempt_0001_abcdef', subjectKey: 'mathematics', subjectName: 'Mathematics', mode: 'quick', answers, durationSec: 90, finishedAt: now() }
  const saved = await call(db, 'jss3', 'POST', '/api/practice-arena/attempts', attempt)
  assert.equal(saved.status, 200, JSON.stringify(saved.body))
  assert.equal(saved.body.attempt.percent, 100)
  assert.equal(saved.body.attempt.total, answers.length)
  assert.ok(saved.body.attempt.xp >= answers.length * 10 + 10)
  assert.deepEqual(saved.body.newBadges.map(badge => badge.key).sort(), ['first_quiz', 'perfect'])
  assert.equal(saved.body.profile.streak, 1)
  assert.equal(saved.body.profile.quizzes, 1)
  // Synced again from the outbox: not counted twice.
  const again = await call(db, 'jss3', 'POST', '/api/practice-arena/attempts', { attempts: [attempt] })
  assert.equal(again.body.results[0].duplicate, true)
  assert.equal(again.body.profile.quizzes, 1)
  // Claimed answers do not matter: the bank marks it.
  const cheat = await call(db, 'jss3', 'POST', '/api/practice-arena/attempts', { ...attempt, id: 'attempt_0002_abcdef', answers: answers.map(answer => ({ ...answer, response: 'nonsense', correct: true })) })
  assert.equal(cheat.body.attempt.percent, 0)
  const board = await call(db, 'jss3', 'GET', '/api/practice-arena/leaderboard')
  assert.equal(board.body.leaderboard.entries[0].you, true)
  assert.equal(board.body.leaderboard.entries[0].xp, saved.body.attempt.xp + cheat.body.attempt.xp)
})

test('Ami uploads a question document for a section and level; it reaches only students on that ladder', async () => {
  const db = await setup()
  const uploads = memoryBucket()
  const env = { AI: fakeModel({ keys: 0, generate: 0, other: 0 }), UPLOADS: uploads }
  const paper = [
    'SECTION A: OBJECTIVES',
    '1. Which of these words is a noun?',
    'A. run   B. table   C. quickly   D. blue',
    '2. The plural of child is',
    '(a) childs  (b) children*  (c) childes  (d) childer',
    '3. Choose the word opposite in meaning to "ancient".',
    'A. old  B. modern  C. aged  D. antique',
    'ANSWER KEY  1. B  3. B',
  ].join('\n')
  const form = () => {
    const data = new FormData()
    data.append('file', new Blob([paper], { type: 'text/plain' }), 'english-jss2.txt')
    data.append('subject', 'English Language')
    data.append('section', 'junior')
    data.append('classLevel', 'JSS 2')
    return data
  }
  assert.equal((await call(db, 'maths', 'POST', '/api/ami/question-bank/import', form(), env)).status, 403)
  const bad = new FormData()
  bad.append('file', new Blob([paper], { type: 'text/plain' }), 'english.txt')
  bad.append('subject', 'English')
  bad.append('section', 'primary')
  bad.append('classLevel', 'JSS 2')
  assert.equal((await call(db, 'ami', 'POST', '/api/ami/question-bank/import', bad, env)).status, 400)
  const uploaded = await call(db, 'ami', 'POST', '/api/ami/question-bank/import', form(), env)
  assert.equal(uploaded.status, 202, JSON.stringify(uploaded.body))
  for (let i = 0; i < 3; i += 1) await cronTick(db, env)
  const list = await call(db, 'ami', 'GET', '/api/ami/question-bank/imports', null, env)
  assert.equal(list.body.documents[0].status, 'done', JSON.stringify(list.body.documents[0]))
  assert.equal(list.body.documents[0].added, 3)
  const rows = db.db.prepare(`SELECT tenant_id, section, level_rank, playable FROM question_bank WHERE tenant_id = 'global' AND origin_type = 'ami_upload'`).all()
  assert.equal(rows.length, 3)
  assert.ok(rows.every(row => row.section === 'junior' && row.level_rank === 8 && row.playable === 1))

  const english = home => home.body.subjects.find(subject => subject.key === 'english')
  assert.equal(english(await call(db, 'jss2', 'GET', '/api/practice-arena/home')).questions, 3)
  assert.equal(english(await call(db, 'jss3', 'GET', '/api/practice-arena/home')).questions, 3)
  assert.equal(english(await call(db, 'primary', 'GET', '/api/practice-arena/home')), undefined)
  const status = await call(db, 'ami', 'GET', '/api/ami/harvest', null, env)
  assert.ok(status.body.bank.total >= 3)
})

test('Ndovera AI answers a question asked before (in other words) from its pool of knowledge', async () => {
  const db = await setup()
  const calls = { keys: 0, generate: 0, other: 0 }
  const env = { AI: fakeModel(calls) }
  const first = await call(db, 'jss2', 'POST', '/api/ai/tutor/ask', { prompt: 'What is photosynthesis in green plants?' }, env)
  assert.equal(first.status, 200, JSON.stringify(first.body))
  assert.equal(calls.other, 1)
  const second = await call(db, 'jss2b', 'POST', '/api/ai/tutor/ask', { prompt: 'Explain photosynthesis in green plants' }, env)
  assert.equal(second.status, 200, JSON.stringify(second.body))
  assert.equal(second.body.source, 'knowledge_pool')
  assert.equal(second.body.answer, first.body.answer)
  assert.equal(calls.other, 1, 'the network call was not made again')
})

test('AI generation spends AI credits once (half to regenerate), is free before the start date, and bundles are on offer', async () => {
  const db = await setup()
  const calls = { keys: 0, generate: 0, other: 0 }
  const paid = { AI: fakeModel(calls), AI_PAY_START: '2020-01-01T00:00:00Z', KNOWLEDGE_POOL: 'off' }
  const quiz = { classId: 'jss2a', subjectId: 'm2', kind: 'quiz', standard: 'school', questionCount: 4, totalMarks: 4, types: ['mcq'] }
  const created = await call(db, 'maths', 'POST', '/api/ai-assessments', quiz, paid)
  assert.equal(created.status, 201, JSON.stringify(created.body))
  const id = created.body.assessment.id

  const blocked = await call(db, 'maths', 'POST', `/api/ai-assessments/${id}/generate-next`, {}, paid)
  assert.equal(blocked.status, 402)
  assert.equal(blocked.body.needsCredits, true)
  assert.equal(blocked.body.price, 100)
  assert.equal(calls.generate, 0)

  // A Standard bundle's worth would be 1,200; here the teacher holds 150 credits.
  db.db.prepare(`INSERT INTO settings (studentId, payload) VALUES ('ai_wallet_user_math@a.test', ?)`).run(JSON.stringify({ credits: 150, totalPurchasedCredits: 150, updatedAt: now() }))
  let result
  for (let i = 0; i < 10; i += 1) {
    result = await call(db, 'maths', 'POST', `/api/ai-assessments/${id}/generate-next`, {}, paid)
    assert.equal(result.status, 200, JSON.stringify(result.body))
    if (result.body.done) break
  }
  let wallet = (await call(db, 'maths', 'GET', '/api/ai-pay/wallet', null, paid)).body.wallet
  assert.equal(wallet.credits, 50, 'charged 100 credits once, however many steps')
  assert.equal(wallet.active, true)

  const regen = await call(db, 'maths', 'POST', `/api/ai-assessments/${id}/regenerate-all`, {}, paid)
  assert.equal(regen.status, 200, JSON.stringify(regen.body))
  assert.equal(regen.body.assessment.questions.length, 0)
  for (let i = 0; i < 10; i += 1) {
    result = await call(db, 'maths', 'POST', `/api/ai-assessments/${id}/generate-next`, {}, paid)
    assert.equal(result.status, 200, JSON.stringify(result.body))
    if (result.body.done) break
  }
  wallet = (await call(db, 'maths', 'GET', '/api/ai-pay/wallet', null, paid)).body.wallet
  assert.equal(wallet.credits, 0, 'regenerating the whole set cost half (50 credits)')
  assert.equal((await call(db, 'maths', 'POST', `/api/ai-assessments/${id}/regenerate-all`, {}, paid)).status, 402)

  // Before the start date nothing is charged, but the price is shown.
  const free = { AI: fakeModel(calls), AI_PAY_START: '2999-01-01T00:00:00Z' }
  const exam = await call(db, 'maths', 'POST', '/api/ai-assessments', { ...quiz, kind: 'test' }, free)
  const step = await call(db, 'maths', 'POST', `/api/ai-assessments/${exam.body.assessment.id}/generate-next`, {}, free)
  assert.equal(step.status, 200, JSON.stringify(step.body))
  wallet = (await call(db, 'maths', 'GET', '/api/ai-pay/wallet', null, free)).body.wallet
  assert.equal(wallet.active, false)
  assert.equal(wallet.recent[0].free, true)
  assert.equal(wallet.recent[0].price, 100)
  assert.ok(wallet.bundles.some(bundle => bundle.key === 'standard' && bundle.credits + bundle.bonus === 1200))

  // Free Ndovera AI a day: 10 for students, 3 for staff.
  const bundles = await call(db, 'jss2', 'GET', '/api/ai/credit-bundles', null, free)
  assert.equal(bundles.body.freeDailyRequests, 10)
  assert.equal((await call(db, 'maths', 'GET', '/api/ai/credit-bundles', null, free)).body.freeDailyRequests, 3)
  const access = await call(db, 'maths', 'GET', '/api/ai/access', null, free)
  assert.equal(access.body.access.usage.dailyFreeRequests, 3)
})

test('a staff sign-in made offline counts from when it was made, survives a QR rotation, and keeps the earliest time', async () => {
  const db = await setup()
  const settings = await call(db, 'owner', 'GET', '/api/school/staff-attendance/settings')
  assert.equal(settings.status, 200, JSON.stringify(settings.body))
  const qr = settings.body.settings.activeQrCode
  assert.ok(qr)
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  // 07:30 in Lagos — on time — but it only reaches Ndovera now.
  const early = await call(db, 'maths', 'POST', '/api/school/staff-attendance/activity', { action: 'sign-in', date: yesterday, qrCode: qr, capturedAt: `${yesterday}T06:30:00.000Z` })
  assert.equal(early.status, 200, JSON.stringify(early.body))
  assert.equal(early.body.event.isLate, false)
  assert.equal(early.body.capturedOffline, true)
  // A retry from the queue with a later time keeps the earlier sign-in.
  const retry = await call(db, 'maths', 'POST', '/api/school/staff-attendance/activity', { action: 'sign-in', date: yesterday, qrCode: qr, capturedAt: `${yesterday}T09:45:00.000Z` })
  assert.equal(retry.body.duplicate, true)
  assert.equal(retry.body.event.isLate, false)

  // The QR is rotated; a mark made before the rotation with the old code still syncs.
  assert.equal((await call(db, 'owner', 'POST', '/api/school/staff-attendance/settings/rotate-qr', {})).status, 200)
  const late = await call(db, 'owner', 'POST', '/api/school/staff-attendance/activity', { action: 'sign-in', date: yesterday, qrCode: qr, capturedAt: `${yesterday}T09:45:00.000Z` })
  assert.equal(late.status, 200, JSON.stringify(late.body))
  assert.equal(late.body.event.isLate, true)
  // Without the time it was made, the old code is refused.
  assert.equal((await call(db, 'maths', 'POST', '/api/school/staff-attendance/activity', { action: 'sign-out', date: yesterday, qrCode: qr })).status, 400)
})

test('Quantitative Reasoning in Primary is written by the Ndovera engine: no AI call, no credits, every answer computed', async () => {
  const { qrQuestion, topicsForGrade, seededRandom, quantReasoningGrade } = await import('./build/quantReasoning.mjs')
  assert.deepEqual(topicsForGrade(1), ['counting', 'sequence', 'missingNumber'])
  assert.deepEqual(topicsForGrade(6), ['sequence', 'missingNumber', 'numberMachine', 'fractions', 'grid'])
  assert.equal(quantReasoningGrade('Quantitative Reasoning', 'Primary 4 Gold'), 4)
  assert.equal(quantReasoningGrade('Quantitative Reasoning', 'JSS 1'), null)
  assert.equal(quantReasoningGrade('Mathematics', 'Primary 4'), null)
  const random = seededRandom(7)
  for (const topic of topicsForGrade(6)) {
    for (let i = 0; i < 30; i += 1) {
      const question = qrQuestion(topic, 6, random)
      assert.ok(Number.isInteger(question.answer) && question.answer > 0, `${topic}: ${question.answer}`)
      assert.match(question.explanation, new RegExp(String(question.answer)))
    }
  }

  const db = await setup()
  const calls = { keys: 0, generate: 0, other: 0 }
  const paid = { AI: fakeModel(calls), AI_PAY_START: '2020-01-01T00:00:00Z' }
  const created = await call(db, 'maths', 'POST', '/api/ai-assessments', { classId: 'pry4', subjectId: 'qr4', kind: 'quiz', standard: 'school', questionCount: 6, totalMarks: 6, types: ['mcq', 'short'] }, paid)
  assert.equal(created.status, 201, JSON.stringify(created.body))
  let result
  for (let i = 0; i < 10; i += 1) {
    result = await call(db, 'maths', 'POST', `/api/ai-assessments/${created.body.assessment.id}/generate-next`, {}, paid)
    assert.equal(result.status, 200, JSON.stringify(result.body))
    if (result.body.done) break
  }
  const questions = result.body.assessment.questions
  assert.equal(questions.length, 6)
  assert.equal(calls.generate + calls.other, 0, 'no AI call was made')
  for (const question of questions.filter(item => item.type === 'mcq')) {
    // The keyed option is the computed answer, wherever the key was moved to.
    assert.equal(question.options[question.answerIndex], question.answer)
  }
  // No credits held, and none needed.
  assert.equal((await call(db, 'maths', 'GET', '/api/ai-pay/wallet', null, paid)).body.wallet.credits, 0)
  assert.equal((await call(db, 'maths', 'POST', `/api/ai-assessments/${created.body.assessment.id}/regenerate-all`, {}, paid)).status, 200)
})

test('Verbal Reasoning in Primary comes from the 1,000-item class banks: no AI call, no credits, every key known', async () => {
  const { bankForGrade, topicsForGrade, verbalReasoningGrade, vrBankQuestions, vrDistractors, promptOf, encodeWord, BANK_SIZE } = await import('./build/verbalReasoning.mjs')
  const { seededRandom } = await import('./build/quantReasoning.mjs')
  assert.deepEqual(topicsForGrade(1), ['alphabet', 'alphabeticalOrder', 'opposites', 'oddOneOut'])
  assert.deepEqual(topicsForGrade(6), ['alphabet', 'alphabeticalOrder', 'opposites', 'oddOneOut', 'synonyms', 'analogies', 'letterCodes'])
  assert.equal(verbalReasoningGrade('Verbal Reasoning', 'Primary 2'), 2)
  assert.equal(verbalReasoningGrade('Verbal Aptitude', 'JSS 1'), null)
  assert.equal(encodeWord('ZOO', 1), 'APP')

  // The class banks, as in the Worksheet Studio's README table.
  const expected = { 1: [40, 110, 0], 2: [40, 110, 0], 3: [80, 200, 0], 4: [80, 200, 48], 5: [80, 270, 144], 6: [80, 270, 144] }
  const random = seededRandom(11)
  for (let grade = 1; grade <= 6; grade += 1) {
    const bank = bankForGrade(grade)
    assert.equal(bank.length, BANK_SIZE)
    assert.equal(new Set(bank.map(item => item.id)).size, BANK_SIZE)
    const count = topic => bank.filter(item => item.topic === topic).length
    const words = bank.filter(item => ['opposites', 'synonyms', 'oddOneOut', 'analogies'].includes(item.topic)).length
    assert.deepEqual([words, count('alphabet'), count('letterCodes')], expected[grade], `Primary ${grade}`)
    assert.ok(bank.every(item => topicsForGrade(grade).includes(item.topic)))
    for (const item of bank) {
      if (item.topic === 'alphabeticalOrder') assert.equal(item.answer, [...item.choices].sort()[0])
      if (item.choices.length) assert.ok(item.choices.includes(item.answer), item.id)
      // Extra options are never a second right answer.
      const wrong = vrDistractors(item, 3, random)
      assert.ok(!wrong.includes(item.answer), item.id)
      if (item.topic === 'alphabeticalOrder') assert.ok(wrong.every(word => word > item.answer), item.id)
      if (item.topic === 'oddOneOut') assert.deepEqual([...wrong].sort(), item.choices.filter(word => word !== item.answer).sort())
    }
  }
  const code = bankForGrade(5).find(item => item.id === 'vr1:letterCodes|CAT/2')
  assert.equal(code.answer, 'ECV')
  assert.match(promptOf(code), /\*\*DOG\*\* → \*\*FQI\*\*/, 'CAT is not its own worked example')

  // An item the classes share is laid out the same for each class, so the bank keeps one copy.
  const shared = id => [1, 6].map(grade => vrBankQuestions(grade).find(question => question.originId === id))
  const [p1, p6] = shared('vr1:opposites|Choose the opposite of hot.')
  assert.deepEqual(p1.options, p6.options)
  assert.equal(p1.prompt, 'Choose the opposite of hot.', 'the words are the options, not repeated in the prompt')

  const db = await setup()
  const calls = { keys: 0, generate: 0, other: 0 }
  const paid = { AI: fakeModel(calls), AI_PAY_START: '2020-01-01T00:00:00Z' }
  const created = await call(db, 'maths', 'POST', '/api/ai-assessments', { classId: 'pry4', subjectId: 'vr4', kind: 'test', standard: 'school', questionCount: 8, totalMarks: 8, types: ['mcq', 'short', 'truefalse'] }, paid)
  assert.equal(created.status, 201, JSON.stringify(created.body))
  let result
  for (let i = 0; i < 10; i += 1) {
    result = await call(db, 'maths', 'POST', `/api/ai-assessments/${created.body.assessment.id}/generate-next`, {}, paid)
    assert.equal(result.status, 200, JSON.stringify(result.body))
    if (result.body.done) break
  }
  const questions = result.body.assessment.questions
  assert.equal(questions.length, 8)
  assert.equal(calls.generate + calls.other, 0, 'no AI call was made')
  const ids = new Set()
  for (const question of questions) {
    assert.ok(!ids.has(question.prompt + (question.options || []).join()), 'no question twice in a set')
    ids.add(question.prompt + (question.options || []).join())
    if (question.type === 'mcq') {
      assert.equal(question.options.length, 4)
      assert.equal(question.options[question.answerIndex], question.answer)
    }
  }
  assert.equal((await call(db, 'maths', 'GET', '/api/ai-pay/wallet', null, paid)).body.wallet.credits, 0)
  assert.equal((await call(db, 'maths', 'POST', `/api/ai-assessments/${created.body.assessment.id}/regenerate-all`, {}, paid)).status, 200)
})
