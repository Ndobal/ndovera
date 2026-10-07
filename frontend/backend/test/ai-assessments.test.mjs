import test from 'node:test'
import assert from 'node:assert/strict'
import { sign } from '@tsndr/cloudflare-worker-jwt'
import { D1Shim, createLegacySchema } from './d1-shim.mjs'
import { assessment as engine, variants } from './build/materialSessionTest.mjs'

// ─── The engine, without the model ───────────────────────────────────────────

test('answer keys are balanced, never three in a row, and never run A-B-C-D', () => {
  for (const seed of [1, 7, 42, 99, 2026]) {
    const key = engine.balancedAnswerSequence(40, 4, engine.seededRandom(seed))
    const counts = [0, 1, 2, 3].map(option => key.filter(value => value === option).length)
    assert.deepEqual(counts, [10, 10, 10, 10])
    for (let i = 2; i < key.length; i += 1) assert.ok(!(key[i] === key[i - 1] && key[i] === key[i - 2]), `three in a row at ${i}`)
    for (let i = 3; i < key.length; i += 1) {
      const run = key.slice(i - 3, i + 1)
      assert.ok(!run.every((v, j) => j === 0 || v === run[j - 1] + 1), 'ascending run')
      assert.ok(!run.every((v, j) => j === 0 || v === run[j - 1] - 1), 'descending run')
    }
  }
})

test('placing an answer moves only the order; "none of the above" stays last', () => {
  const question = { id: 'q', type: 'mcq', options: ['Lagos', 'Abuja', 'Kano', 'None of the above'], answerIndex: 1, prompt: 'Capital?', markingPoints: [] }
  for (const target of [0, 1, 2]) {
    const placed = engine.placeAnswer(question, target, engine.seededRandom(target + 3))
    assert.equal(placed.options[placed.answerIndex], 'Abuja')
    assert.equal(placed.answerIndex, target)
    assert.equal(placed.options[3], 'None of the above')
    assert.deepEqual([...placed.options].sort(), [...question.options].sort())
  }
})

test('the pattern report flags predictable keys', () => {
  const mcq = answerIndex => ({ type: 'mcq', options: ['a', 'b', 'c', 'd'], answerIndex })
  assert.equal(engine.answerPatternReport([0, 0, 0, 1, 2, 3, 1, 2].map(mcq)).risk, 'high')
  assert.equal(engine.answerPatternReport([0, 1, 2, 3, 0, 2].map(mcq)).cycles > 0, true)
  assert.equal(engine.answerPatternReport([2, 0, 3, 1, 0, 2, 1, 3].map(mcq)).risk, 'low')
})

test('slots follow the Bloom plan and the marks add up', () => {
  const config = engine.normalizeConfig({ kind: 'test', standard: 'waec', questionCount: 12, totalMarks: 40, types: ['mcq', 'structured', 'essay'], topicNames: ['Demand', 'Supply'] }, 'SS 2')
  const slots = engine.planSlots(config)
  assert.equal(slots.length, 12)
  assert.equal(slots.reduce((sum, slot) => sum + slot.marks, 0), 40)
  // Senior/WAEC: higher-order levels dominate.
  const higher = slots.filter(slot => ['apply', 'analyse', 'evaluate', 'create'].includes(slot.bloom)).length
  assert.ok(higher >= 7, `higher-order slots: ${higher}`)
  // Every slot's type can test its level.
  for (const slot of slots) assert.ok(!(slot.type === 'mcq' && ['evaluate', 'create'].includes(slot.bloom)))
  assert.deepEqual([...new Set(slots.map(slot => slot.topic))].sort(), ['Demand', 'Supply'])
})

test('an exam blueprint follows the standard and "answer 3 of 5" counts once', () => {
  const config = engine.normalizeConfig({ kind: 'exam', standard: 'waec', totalMarks: 100, types: ['mcq', 'structured', 'essay'], topicNames: ['A', 'B'] }, 'SS 2')
  const blueprint = engine.proposeBlueprint(config)
  assert.deepEqual(blueprint.sections.map(section => [section.name, section.type, section.marks]), [['A', 'mcq', 40], ['B', 'structured', 30], ['C', 'essay', 30]])
  const essay = blueprint.sections[2]
  assert.deepEqual([essay.attempt, essay.questions], [3, 5])
  const slots = engine.planSlots(config, blueprint)
  assert.equal(slots.filter(slot => slot.section === 'A').length, 40)
  assert.equal(slots.filter(slot => slot.section === 'C').length, 5)
  const questions = slots.map(slot => ({ ...engine.normalizeQuestion({ prompt: 'Explain the concept fully here.', options: ['w', 'x', 'y', 'z'], answerIndex: 0, expectedAnswer: 'x', markingPoints: ['x'] }, slot).question, topic: slot.topic }))
  const audit = engine.auditAssessment(questions, config, blueprint)
  assert.equal(audit.examMarks, 100)
  assert.equal(audit.checks.find(check => check.key === 'marks').status, 'ok')
})

test('invalid model output is rejected, not accepted', () => {
  const slot = { index: 0, section: 'A', type: 'mcq', bloom: 'apply', topic: 'T', marks: 1 }
  assert.ok(engine.normalizeQuestion({ prompt: 'Which is correct here?', options: ['a', 'a', 'b', 'c'], answerIndex: 0 }, slot).problems.length)
  assert.ok(engine.normalizeQuestion({ prompt: 'Which is correct here?', options: ['a', 'b', 'c'], answerIndex: 0 }, slot).problems.length)
  assert.ok(engine.normalizeQuestion({ prompt: 'Which is correct here?', options: ['a', 'b', 'c', 'd'], answer: 'e' }, slot).problems.length)
  assert.deepEqual(engine.normalizeQuestion({ prompt: 'Which is correct here?', options: ['A. a', 'B. b', 'C. c', 'D. d'], answer: 'C' }, slot).problems, [])
  assert.deepEqual(engine.parseQuestionsJson('Sure! ```json\n[{"prompt": "x",}]\n```').length, 1)
})

test('students never receive answer keys; objective questions are marked from the hidden key', () => {
  const questions = [{ id: 'a', type: 'mcq', options: ['x', 'y'], answer: 'y', score: 2 }, { id: 'b', type: 'fillgaps', acceptedAnswers: 'Abuja, abuja city', score: 1 }, { id: 'c', type: 'essay', markingGuide: 'secret', score: 5 }]
  const stripped = engine.stripAnswersForStudent(questions)
  assert.ok(stripped.every(question => !('answer' in question) && !('acceptedAnswers' in question) && !('markingGuide' in question)))
  assert.deepEqual(stripped[0].options, ['x', 'y'])
  const marked = engine.autoMark(questions, { a: 'y', b: 'ABUJA', c: 'my essay' })
  assert.deepEqual([marked.score, marked.max, marked.pending], [3, 3, 1])
})

// ─── Through the Worker, with a stand-in model ───────────────────────────────

const SECRET = 'assess-test-secret'
let worker
let generation = 0
const PEOPLE = {
  teacher: ['t-econ', 'econ@a.test', 'teacher', 'school-a', {}],
  other: ['t-eng', 'eng@a.test', 'teacher', 'school-a', {}],
  student: ['s-1', 'pupil@a.test', 'student', 'school-a', { classId: 'ss2a' }],
  student2: ['s-2', 'pupil2@a.test', 'student', 'school-a', { classId: 'ss2a' }],
  outsider: ['o-b', 'owner@b.test', 'owner', 'school-b', {}],
}

/** A model stand-in that answers each requested slot with a valid question (or junk, when asked). */
function fakeModel(log, { junk = false } = {}) {
  let counter = 0
  return {
    run: async (_model, input) => {
      log.push(input.messages)
      const user = input.messages[input.messages.length - 1].content
      if (/moderator/.test(input.messages[0].content)) return { response: '[{"question": 1, "issue": "Option B is also arguably correct.", "severity": "warning"}]' }
      if (junk) return { response: 'I cannot do that.' }
      const slots = [...user.matchAll(/^\d+\. type "(\w+)", topic "([^"]+)", (\d+) mark/gm)]
      return { response: JSON.stringify(slots.map(([, type, topic]) => {
        counter += 1
        const base = { prompt: `Question ${counter}: Explain how ${topic} affects the economy in case ${counter}.`, topic, markingPoints: ['Point one', 'Point two'], expectedAnswer: 'A full explanation.' }
        if (type === 'mcq') return { ...base, prompt: `Q${counter}: Which statement about ${topic} is correct in case ${counter}?`, options: [`Right ${counter}`, `Wrong a${counter}`, `Wrong b${counter}`, `Wrong c${counter}`], answerIndex: 0 }
        return base
      })) }
    },
  }
}

async function setup() {
  worker = (await import(`./build/worker.mjs?assess=${generation++}`)).default
  const db = new D1Shim()
  createLegacySchema(db)
  db.db.exec(`
    CREATE TABLE subjects (id TEXT PRIMARY KEY, tenantId TEXT, name TEXT, classId TEXT, teacherId TEXT, createdAt TEXT);
    CREATE TABLE tenants (id TEXT PRIMARY KEY, school_name TEXT);
    INSERT INTO tenants VALUES ('school-a', 'Genesis International School'), ('school-b', 'Other');
    INSERT INTO classes (id, tenantId, name, arm) VALUES ('ss2a', 'school-a', 'SS 2', 'A');
    INSERT INTO subjects VALUES ('econ', 'school-a', 'Economics', 'ss2a', 't-econ', 'x'), ('eng', 'school-a', 'English', 'ss2a', 't-eng', 'x');
    CREATE TABLE materials (id TEXT PRIMARY KEY, classId TEXT, title TEXT, url TEXT, metadata TEXT, uploadedAt TEXT, uploadedBy TEXT);
  `)
  for (const [id, email, role, tenant, extra] of Object.values(PEOPLE)) {
    await db.prepare('INSERT INTO users (id, email, name, role, tenantId, status) VALUES (?, ?, ?, ?, ?, ?)').bind(id, email, id, role, tenant, 'active').run()
    await db.prepare('INSERT INTO settings (studentId, payload) VALUES (?, ?)').bind(email, JSON.stringify({ name: id, email, role, tenantId: tenant, schoolId: tenant, status: 'active', ...extra })).run()
  }
  return db
}

async function call(db, person, method, path, body, ai) {
  const [id, , role, tenantId] = PEOPLE[person]
  const token = await sign({ id, role, roles: [role], tenantId, name: id, exp: Math.floor(Date.now() / 1000) + 600 }, SECRET)
  const response = await worker.fetch(new Request(`https://ndovera.com${path}`, {
    method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
  }), { APP_DB: db, JWT_SECRET: SECRET, AI: ai || fakeModel([]) }, { waitUntil() {}, passThroughOnException() {} })
  return { status: response.status, body: await response.json().catch(() => ({})) }
}

async function topicWithNotes(db, name) {
  const created = await call(db, 'teacher', 'POST', '/api/classrooms/ss2a/topics', { subjectId: 'econ', name })
  await db.prepare('INSERT INTO materials (id, classId, title, url, metadata, uploadedAt, uploadedBy) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(`m-${name}`, 'ss2a', `${name} notes`, null, JSON.stringify({ subjectId: 'econ', topic: name, visibility: 'student_parent', description: `${name}: OPPORTUNITY-COST-NOTE about scarcity and choice.` }), '2026-10-01T00:00:00Z', 't-econ').run()
  return created.body.topic
}

async function generateAll(db, id, ai) {
  let result
  for (let i = 0; i < 40; i += 1) {
    result = await call(db, 'teacher', 'POST', `/api/ai-assessments/${id}/generate-next`, {}, ai)
    assert.equal(result.status, 200, JSON.stringify(result.body))
    if (result.body.done) return result.body.assessment
  }
  throw new Error('generation did not finish')
}

test('a quiz is generated from the teacher\'s own notes, reviewed, versioned and posted — never automatically', async () => {
  const db = await setup()
  const log = []
  const ai = fakeModel(log)
  const topic = await topicWithNotes(db, 'Scarcity')
  assert.equal((await call(db, 'other', 'POST', '/api/ai-assessments', { classId: 'ss2a', subjectId: 'econ', kind: 'quiz', topicIds: [topic.id] })).status, 403)
  assert.equal((await call(db, 'outsider', 'POST', '/api/ai-assessments', { classId: 'ss2a', subjectId: 'econ', kind: 'quiz' })).status, 404)

  const created = await call(db, 'teacher', 'POST', '/api/ai-assessments', { classId: 'ss2a', subjectId: 'econ', kind: 'quiz', standard: 'waec', questionCount: 10, totalMarks: 10, types: ['mcq'], topicIds: [topic.id] }, ai)
  assert.equal(created.status, 201, JSON.stringify(created.body))
  assert.equal(created.body.assessment.pending, 10)
  const done = await generateAll(db, created.body.assessment.id, ai)
  assert.equal(done.questions.length, 10)
  assert.equal(done.status, 'draft')
  // The model saw the teacher's notes and the topic.
  assert.ok(log.some(messages => messages[1].content.includes('OPPORTUNITY-COST-NOTE')))
  // The stand-in always put the answer first; the key was rebalanced.
  const pattern = done.audit.pattern
  assert.notEqual(pattern.key, 'AAAAAAAAAA')
  assert.equal(pattern.risk, 'low')
  assert.ok(done.questions.every(question => question.options[question.answerIndex].startsWith('Right')))
  // Nothing reached the class yet.
  assert.equal((await call(db, 'student', 'GET', '/api/classrooms/ss2a/assignments')).body.assignments.length, 0)

  // Teacher edits: a version with a summary of the change.
  const edited = done.questions.map((question, index) => (index === 0 ? { ...question, prompt: 'Which of these best explains scarcity?', marks: 2 } : question)).filter((_, index) => index !== 9)
  const saved = await call(db, 'teacher', 'PUT', `/api/ai-assessments/${done.id}`, { questions: edited })
  assert.equal(saved.status, 200)
  const versions = (await call(db, 'teacher', 'GET', `/api/ai-assessments/${done.id}/versions`)).body.versions
  assert.deepEqual(versions.map(version => version.label), ['Teacher Edited', 'AI Generated'])
  assert.match(versions[0].summary, /Q1 prompt, marks edited/)
  assert.match(versions[0].summary, /Q10 deleted/)
  assert.equal((await call(db, 'other', 'PUT', `/api/ai-assessments/${done.id}`, { questions: edited })).status, 403)

  // The AI review only warns.
  const review = await call(db, 'teacher', 'POST', `/api/ai-assessments/${done.id}/review`, {}, ai)
  assert.equal(review.body.review.findings[0].question, 1)

  // Schedule it; students see nothing until it opens, and never the answers.
  const opens = new Date(Date.now() + 3600_000).toISOString()
  const posted = await call(db, 'teacher', 'POST', `/api/ai-assessments/${done.id}/post`, { mode: 'schedule', opensAt: opens, attempts: 1, durationMinutes: 0 })
  assert.equal(posted.status, 200, JSON.stringify(posted.body))
  assert.equal(posted.body.assessment.status, 'scheduled')
  assert.equal((await call(db, 'student', 'GET', '/api/classrooms/ss2a/assignments')).body.assignments.length, 0)
  const assignmentId = posted.body.assignment.id
  assert.equal((await call(db, 'student', 'POST', `/api/assignments/${assignmentId}/submit`, { answers: {} })).status, 403)

  await db.prepare(`UPDATE assignments SET metadata = json_set(metadata, '$.opensAt', ?) WHERE id = ?`).bind(new Date(Date.now() - 1000).toISOString(), assignmentId).run()
  const studentView = (await call(db, 'student', 'GET', '/api/classrooms/ss2a/assignments')).body.assignments
  assert.equal(studentView.length, 1)
  assert.ok(studentView[0].questions.every(question => !('answer' in question) && !('markingGuide' in question)))
  assert.ok((await call(db, 'teacher', 'GET', '/api/classrooms/ss2a/assignments')).body.assignments[0].questions.every(question => 'answer' in question))
  assert.equal((await call(db, 'outsider', 'GET', '/api/classrooms/ss2a/assignments')).status, 404)

  // Auto-marked from the hidden key; one attempt only.
  const key = (await call(db, 'teacher', 'GET', '/api/classrooms/ss2a/assignments')).body.assignments[0].questions
  const answers = Object.fromEntries(key.map((question, index) => [question.id, index < 5 ? question.answer : 'wrong']))
  const submitted = await call(db, 'student', 'POST', `/api/assignments/${assignmentId}/submit`, { answers })
  assert.equal(submitted.status, 201, JSON.stringify(submitted.body))
  const expected = key.slice(0, 5).reduce((sum, question) => sum + question.score, 0)
  assert.deepEqual([submitted.body.score, submitted.body.maxScore], [expected, key.reduce((sum, question) => sum + question.score, 0)])
  assert.equal((await call(db, 'student', 'POST', `/api/assignments/${assignmentId}/submit`, { answers })).status, 409)

  // After the teacher releases them, students see the answers.
  await call(db, 'teacher', 'POST', `/api/ai-assessments/${done.id}/release-answers`)
  assert.ok((await call(db, 'student', 'GET', '/api/classrooms/ss2a/assignments')).body.assignments[0].questions.every(question => 'answer' in question))
})

test('an exam needs an approved blueprint, then goes through the exam-question submission path with its marking scheme', async () => {
  const db = await setup()
  const ai = fakeModel([])
  const demand = await topicWithNotes(db, 'Demand')
  const supply = await topicWithNotes(db, 'Supply')
  const created = await call(db, 'teacher', 'POST', '/api/ai-assessments', { classId: 'ss2a', subjectId: 'econ', kind: 'exam', standard: 'waec', totalMarks: 30, types: ['mcq', 'structured', 'essay'], topicIds: [demand.id, supply.id] }, ai)
  const id = created.body.assessment.id
  assert.equal(created.body.assessment.blueprint.sections.length, 3)
  assert.equal((await call(db, 'teacher', 'POST', `/api/ai-assessments/${id}/generate-next`, {}, ai)).status, 409, 'blueprint first')

  const blueprint = { ...created.body.assessment.blueprint, sections: [
    { name: 'A', type: 'mcq', questions: 10, attempt: 10, marks: 10, instructions: 'Answer ALL questions.' },
    { name: 'B', type: 'essay', questions: 3, attempt: 2, marks: 20, instructions: 'Answer any TWO questions.' },
  ] }
  const approved = await call(db, 'teacher', 'PUT', `/api/ai-assessments/${id}/blueprint`, { blueprint })
  assert.equal(approved.status, 200, JSON.stringify(approved.body))
  assert.equal(approved.body.assessment.slots.length, 13)
  const done = await generateAll(db, id, ai)
  assert.equal(done.audit.examMarks, 30)
  assert.equal(done.audit.checks.find(check => check.key === 'marks').status, 'ok')
  assert.equal((await call(db, 'teacher', 'POST', `/api/ai-assessments/${id}/post`, {})).status, 400, 'exams are not posted to the class')

  const submitted = await call(db, 'teacher', 'POST', `/api/ai-assessments/${id}/submit-exam`)
  assert.equal(submitted.status, 200, JSON.stringify(submitted.body))
  assert.equal(submitted.body.submission.type, 'exam_questions')
  assert.match(submitted.body.submission.content, /SECTION A/)
  assert.match(submitted.body.submission.content, /Marking Scheme/)
  const versions = (await call(db, 'teacher', 'GET', `/api/ai-assessments/${id}/versions`)).body.versions.map(version => version.label)
  assert.deepEqual(versions, ['Submitted', 'AI Generated', 'Blueprint approved'])
  // Students cannot reach the marking scheme.
  assert.equal((await call(db, 'student', 'GET', `/api/ai-assessments/${id}`)).status, 404)
})

test('a model that returns nonsense never produces questions; failed slots wait for the teacher', async () => {
  const db = await setup()
  const topic = await topicWithNotes(db, 'Scarcity')
  const created = await call(db, 'teacher', 'POST', '/api/ai-assessments', { classId: 'ss2a', subjectId: 'econ', kind: 'quiz', questionCount: 3, totalMarks: 3, types: ['mcq'], topicIds: [topic.id] })
  const result = await generateAll(db, created.body.assessment.id, fakeModel([], { junk: true }))
  assert.equal(result.questions.length, 0)
  assert.equal(result.failed.length, 3)
  const regenerated = await call(db, 'teacher', 'POST', `/api/ai-assessments/${result.id}/regenerate`, { slot: result.failed[0] }, fakeModel([]))
  assert.equal(regenerated.status, 200, JSON.stringify(regenerated.body))
  assert.equal(regenerated.body.assessment.questions.length, 1)
  assert.equal(regenerated.body.assessment.failed.length, 2)
})

test('a timed quiz runs on the server clock: start first, deadline enforced, resumable', async () => {
  const db = await setup()
  const ai = fakeModel([])
  const topic = await topicWithNotes(db, 'Scarcity')
  const created = await call(db, 'teacher', 'POST', '/api/ai-assessments', { classId: 'ss2a', subjectId: 'econ', kind: 'quiz', questionCount: 4, totalMarks: 4, types: ['mcq'], topicIds: [topic.id] }, ai)
  const done = await generateAll(db, created.body.assessment.id, ai)
  const posted = await call(db, 'teacher', 'POST', `/api/ai-assessments/${done.id}/post`, { mode: 'now', durationMinutes: 10, attempts: 2, latePolicy: 'reject' })
  const assignmentId = posted.body.assignment.id

  assert.equal((await call(db, 'student', 'POST', `/api/assignments/${assignmentId}/submit`, { answers: {} })).status, 409, 'must start first')
  const started = await call(db, 'student', 'POST', `/api/assignments/${assignmentId}/start`)
  assert.equal(started.body.timed, true)
  const minutes = (Date.parse(started.body.deadline) - Date.parse(started.body.startedAt)) / 60000
  assert.equal(Math.round(minutes), 10)
  // Opening it again resumes the same clock.
  assert.equal((await call(db, 'student', 'POST', `/api/assignments/${assignmentId}/start`)).body.deadline, started.body.deadline)
  assert.equal((await call(db, 'student', 'POST', `/api/assignments/${assignmentId}/submit`, { answers: {} })).status, 201)

  // Second attempt: time runs out (beyond the grace) — refused under a "reject" late policy.
  await call(db, 'student', 'POST', `/api/assignments/${assignmentId}/start`)
  await db.prepare(`UPDATE assignment_attempts SET deadline = ? WHERE submitted_at IS NULL`).bind(new Date(Date.now() - 10 * 60000).toISOString()).run()
  const late = await call(db, 'student', 'POST', `/api/assignments/${assignmentId}/submit`, { answers: {} })
  assert.equal(late.status, 403)
  assert.match(late.body.message, /Time ran out/)
})

test('every answer key keeps every rule, whatever the paper size or random seed', () => {
  for (const [count, options] of [[4, 4], [5, 4], [10, 4], [13, 4], [40, 4], [80, 4], [10, 5], [50, 5], [7, 2]]) {
    for (let seed = 1; seed <= 400; seed += 1) {
      const key = engine.balancedAnswerSequence(count, options, engine.seededRandom(seed))
      assert.equal(key.length, count)
      const counts = Array(options).fill(0)
      key.forEach(value => { counts[value] += 1 })
      assert.ok(Math.max(...counts) - Math.min(...counts) <= 1, `balanced ${count}/${options} seed ${seed}: ${counts}`)
      for (let i = 2; i < key.length; i += 1) assert.ok(!(key[i] === key[i - 1] && key[i] === key[i - 2]), `three in a row ${count}/${options} seed ${seed}`)
      for (let i = 3; i < key.length; i += 1) {
        const run = key.slice(i - 3, i + 1)
        assert.ok(!run.every((v, j) => j === 0 || v === run[j - 1] + 1) && !run.every((v, j) => j === 0 || v === run[j - 1] - 1), `A-B-C-D run ${count}/${options} seed ${seed}: ${key}`)
      }
    }
  }
})

test('a teacher-built paper: 60 MCQs and 5 essays in parts (a)-(c), Question 1 compulsory, answer 4 — the total counts only what is answered', () => {
  const config = engine.normalizeConfig({ kind: 'exam', standard: 'waec', topicNames: ['Motion', 'Electricity'] }, 'SS 2')
  const blueprint = engine.normalizeBlueprint({ sections: [
    { name: 'A', type: 'mcq', questions: 60, attempt: 60, marksPerQuestion: 1 },
    { name: 'B', type: 'essay', questions: 5, attempt: 4, marksPerQuestion: 10, parts: 3, compulsory: '1' },
  ] }, config)
  assert.equal(blueprint.totalMarks, 100)
  assert.equal(blueprint.sections[0].instructions, 'Answer ALL questions in this section. Choose the correct option for each question.')
  assert.equal(blueprint.sections[1].instructions, 'Question 1 is compulsory. Answer any 3 other questions.')
  assert.equal(engine.describeSection({ type: 'essay', questions: 6, attempt: 3, compulsory: [] }), 'Answer any 3 of the 6 questions in this section.')
  const slots = engine.planSlots(config, blueprint)
  assert.equal(slots.length, 65)
  const essays = slots.filter(slot => slot.section === 'B')
  assert.ok(essays.every(slot => slot.parts === 3 && slot.marks === 10))
  assert.deepEqual(essays.map(slot => Boolean(slot.compulsory)), [true, false, false, false, false])

  // Parts: marks add up to the question's; a missing part is sent back.
  const good = engine.normalizeQuestion({ prompt: 'A car accelerates uniformly from rest.', parts: [
    { prompt: 'Define acceleration.', marks: 2, expectedAnswer: 'Rate of change of velocity' },
    { prompt: 'Calculate the acceleration.', marks: 3, markingPoints: ['a = v/t', '= 2 m/s²'] },
    { prompt: 'Sketch the velocity-time graph.', marks: 9, markingPoints: ['Straight line through origin'] },
  ] }, essays[0])
  assert.deepEqual(good.problems, [])
  assert.equal(good.question.parts.reduce((sum, part) => sum + part.marks, 0), 10)
  assert.deepEqual(good.question.parts.map(part => part.label), ['a', 'b', 'c'])
  assert.equal(good.question.compulsory, true)
  assert.ok(engine.normalizeQuestion({ prompt: 'A car accelerates uniformly from rest.', parts: [{ prompt: 'Define it.', expectedAnswer: 'x' }] }, essays[1]).problems.some(problem => /parts/.test(problem)))

  // Answered total: compulsory Q1 + best 3 of the rest.
  const questions = slots.map(slot => ({ ...engine.normalizeQuestion({ prompt: 'Explain the idea in full detail.', options: ['w', 'x', 'y', 'z'], answerIndex: 0, expectedAnswer: 'x', parts: slot.parts ? [1, 2, 3].map(n => ({ prompt: `Part ${n} of the question`, expectedAnswer: 'x' })) : undefined }, slot).question, topic: slot.topic }))
  const audit = engine.auditAssessment(questions, config, blueprint)
  assert.equal(audit.examMarks, 100)
  assert.equal(audit.checks.find(check => check.key === 'marks').status, 'ok')
})

test('figures: valid specs pass, broken ones are sent back, and reply parsing keeps the figure blocks', () => {
  const graph = '{"type":"function","xRange":[-3,5],"functions":[{"expr":"x^2-2*x-3"}]}'
  const ok = engine.normalizeQuestion({ prompt: `Use the graph below.\n\n\`\`\`figure\n${graph}\n\`\`\`\n\nState the roots.`, expectedAnswer: 'x = -1 and x = 3' }, { type: 'short', marks: 2 })
  assert.deepEqual(ok.problems, [])
  for (const [spec, why] of [
    ['{"type":"function","xRange":[5,1],"functions":[{"expr":"x"}]}', /xRange/],
    ['{"type":"function","xRange":[0,1],"functions":[{"expr":"x; alert(1)"}]}', /unsupported/],
    ['{"type":"geometry","points":{"A":[0,0]},"segments":[["A","Z"]]}', /segments/],
    ['{"type":"circuit","components":[{"type":"transistor"}]}', /components/],
    ['{"type":"hologram"}', /unknown/],
    ['{not json', /JSON/],
  ]) {
    const result = engine.normalizeQuestion({ prompt: `Look:\n\`\`\`figure\n${spec}\n\`\`\``, expectedAnswer: 'x' }, { type: 'short', marks: 1 })
    assert.ok(result.problems.some(problem => why.test(problem)), `${spec} → ${result.problems}`)
  }
  for (const spec of [
    '{"type":"bar","categories":["A","B"],"series":[{"name":"s","values":[1,2]}]}',
    '{"type":"scatter","series":[{"name":"s","points":[[1,2],[3,4]]}]}',
    '{"type":"pie","slices":[{"label":"a","value":1},{"label":"b","value":2}]}',
    '{"type":"geometry","points":{"A":[0,0],"B":[4,0],"C":[0,3],"O":[1,1]},"polygons":[["A","B","C"]],"circles":[{"center":"O","radius":1}],"angles":[{"at":"A","from":"B","to":"C","right":true}]}',
    '{"type":"circuit","components":[{"type":"battery","label":"12 V"},{"type":"ammeter"}],"parallel":[[{"type":"resistor","label":"4 Ω"}],[{"type":"bulb"}]]}',
    '{"type":"numberline","min":-5,"max":5,"points":[{"value":2,"open":true}]}',
  ]) assert.equal(engine.figureSpecError(JSON.parse(spec)), '', spec)

  // An outer ```json fence is removed; the ```figure fences inside question text survive.
  const reply = '```json\n[{"prompt":"See:\\n```figure\\n{\\"type\\":\\"pie\\",\\"slices\\":[{\\"value\\":1},{\\"value\\":2}]}\\n```"}]\n```'
  const [item] = engine.parseQuestionsJson(reply)
  assert.match(item.prompt, /```figure\n\{"type":"pie"/)
  assert.deepEqual(engine.figureProblems(item.prompt), [])
})

// ─── Unique papers ───────────────────────────────────────────────────────────

const speedQuestion = { id: 'speed', section: 'A', type: 'mcq', prompt: 'A car travels {{d=100..300 step 10}} km in {{t=2..5}} hours. What is its average speed?', options: ['{{= d/t :1}} km/h', '{{= d*t}} km/h', '{{= d+t}} km/h', '{{= d-t}} km/h'], answerIndex: 0, answer: 'Speed = {{d}} ÷ {{t}} = {{= d/t :1}} km/h', markingPoints: [], marks: 1 }

test('number templates: values per seed, worked answers, and teacher mistakes reported', () => {
  assert.equal(variants.evaluate('2pi r', { r: 1 }).toFixed(4), (2 * Math.PI).toFixed(4))
  assert.equal(variants.evaluate('sin(30) + sqrt(16)', {}), 4.5)
  assert.throws(() => variants.evaluate('alert(1)', {}))
  const master = variants.masterQuestions([speedQuestion])[0]
  assert.equal(master.prompt, 'A car travels 100 km in 2 hours. What is its average speed?')
  assert.equal(master.options[0], '50.0 km/h')
  assert.equal(master.answer, 'Speed = 100 ÷ 2 = 50.0 km/h')
  const seen = new Set()
  for (let n = 0; n < 30; n += 1) {
    const [paper] = variants.personalise([speedQuestion], `seed-${n}`).questions
    const [, d, t] = /travels (\d+) km in (\d+) hours/.exec(paper.prompt)
    assert.ok(Number(d) >= 100 && Number(d) <= 300 && Number(d) % 10 === 0 && Number(t) >= 2 && Number(t) <= 5)
    assert.equal(paper.options[paper.answerIndex], `${(Number(d) / Number(t)).toFixed(1)} km/h`, 'the key follows the numbers and the shuffle')
    assert.ok(!JSON.stringify(paper).includes('{{'))
    seen.add(paper.prompt)
  }
  assert.ok(seen.size > 10, 'students get different numbers')
  assert.deepEqual(variants.templateProblems({ prompt: '{{x=1..5}} and {{= x*y}}' }), ['{{= x*y}}: "y" is not defined.'])
  const { problems } = engine.normalizeQuestion({ ...speedQuestion, prompt: 'Find {{= q + 1}} now please.' }, { index: 0, section: 'A', type: 'mcq', bloom: 'apply', topic: '', marks: 1 }, 4)
  assert.ok(problems.some(problem => /Number template/.test(problem)))
})

test('a unique paper: same seed, same paper; objective questions move, theory numbers and special options stay', () => {
  const questions = [
    ...Array.from({ length: 8 }, (_, i) => ({ id: `m${i}`, section: 'A', type: 'mcq', prompt: `MCQ ${i}`, options: [`right ${i}`, 'b', 'c', 'd'], answerIndex: 0, marks: 1 })),
    { id: 'tf', section: 'A', type: 'truefalse', prompt: 'True?', options: ['True', 'False'], answerIndex: 1, marks: 1 },
    { id: 'all', section: 'A', type: 'mcq', prompt: 'All?', options: ['x', 'y', 'z', 'All of the above'], answerIndex: 3, marks: 1 },
    { id: 'e1', section: 'B', type: 'essay', prompt: 'Essay 1', options: [], marks: 10, compulsory: true },
    { id: 'e2', section: 'B', type: 'essay', prompt: 'Essay 2', options: [], marks: 10 },
  ]
  const one = variants.personalise(questions, 'student-1')
  assert.deepEqual(variants.personalise(questions, 'student-1').questions, one.questions, 'deterministic')
  const two = variants.personalise(questions, 'student-2')
  assert.notDeepEqual(one.record.order, two.record.order)
  for (const paper of [one.questions, two.questions]) {
    assert.deepEqual(paper.slice(10).map(question => question.id), ['e1', 'e2'], 'theory keeps its numbers')
    assert.deepEqual(paper.find(question => question.id === 'tf').options, ['True', 'False'])
    assert.equal(paper.find(question => question.id === 'all').options[3], 'All of the above')
    for (const question of paper.filter(item => item.id.startsWith('m'))) assert.equal(question.options[question.answerIndex], `right ${question.id.slice(1)}`)
  }
  // The stored record rebuilds the same paper.
  assert.deepEqual(variants.applyPaper(questions, one.record), one.questions)
  assert.notEqual(variants.paperCode('a'), variants.paperCode('b'))
  for (const name of ['SS 2A', 'JSS1', 'SSS 3 Gold', 'Year 9', 'Grade 11', 'Basic 8']) assert.ok(variants.isSecondaryClass(name), name)
  for (const name of ['Primary 4', 'Nursery 2', 'KG 1', 'Basic 3', 'Year 2']) assert.ok(!variants.isSecondaryClass(name), name)
})

test('online: every student sits their own paper and is marked with their own key; teachers print versions or one per student', async () => {
  const db = await setup()
  const ai = fakeModel([])
  const topic = await topicWithNotes(db, 'Scarcity')
  const created = await call(db, 'teacher', 'POST', '/api/ai-assessments', { classId: 'ss2a', subjectId: 'econ', kind: 'test', questionCount: 6, totalMarks: 6, types: ['mcq'], topicIds: [topic.id] }, ai)
  const done = await generateAll(db, created.body.assessment.id, ai)
  const saved = await call(db, 'teacher', 'PUT', `/api/ai-assessments/${done.id}`, { questions: [...done.questions, { ...speedQuestion, section: done.questions[0].section, source: 'teacher', bloom: 'apply' }] })
  assert.equal(saved.status, 200, JSON.stringify(saved.body))
  assert.deepEqual(saved.body.problems, [])

  // Printing: versions A–C and one paper per student, each with its own key.
  const versions = await call(db, 'teacher', 'GET', `/api/ai-assessments/${done.id}/papers?mode=versions&count=3`)
  assert.equal(versions.status, 200, JSON.stringify(versions.body))
  assert.deepEqual(versions.body.papers.map(paper => paper.label), ['Version A', 'Version B', 'Version C'])
  assert.equal(new Set(versions.body.papers.map(paper => paper.code)).size, 3)
  assert.ok(versions.body.papers.every(paper => paper.questions.length === 7 && paper.questions.every(question => question.answerIndex >= 0)))
  const perStudent = await call(db, 'teacher', 'GET', `/api/ai-assessments/${done.id}/papers?mode=students`)
  assert.deepEqual(perStudent.body.papers.map(paper => paper.studentId).sort(), ['s-1', 's-2'])
  assert.equal((await call(db, 'student', 'GET', `/api/ai-assessments/${done.id}/papers?mode=versions`)).status, 403)

  const posted = await call(db, 'teacher', 'POST', `/api/ai-assessments/${done.id}/post`, { mode: 'now', durationMinutes: 0, uniquePerStudent: true })
  assert.equal(posted.status, 200, JSON.stringify(posted.body))
  const assignmentId = posted.body.assignment.id
  const viewOf = async person => (await call(db, person, 'GET', '/api/classrooms/ss2a/assignments')).body.assignments[0].questions
  const first = await viewOf('student')
  const second = await viewOf('student2')
  assert.deepEqual(await viewOf('student'), first, 'a refresh gives the same paper')
  assert.notDeepEqual(first, second)
  for (const paper of [first, second]) {
    assert.ok(paper.every(question => !('answer' in question)))
    assert.ok(!JSON.stringify(paper).includes('{{'))
  }
  // The teacher's copy keeps the templates and the key.
  const key = (await call(db, 'teacher', 'GET', '/api/classrooms/ss2a/assignments')).body.assignments[0].questions
  assert.ok(JSON.stringify(key).includes('{{d=100..300'))

  // Each student answers from their own paper: the speed comes from their own numbers.
  const answersFor = paper => Object.fromEntries(key.map(question => {
    if (question.id !== 'speed') return [question.id, question.answer]
    const mine = paper.find(item => item.id === 'speed')
    const [, d, t] = /travels (\d+) km in (\d+) hours/.exec(mine.prompt)
    return [question.id, `${(Number(d) / Number(t)).toFixed(1)} km/h`]
  }))
  for (const [person, paper] of [['student', first], ['student2', second]]) {
    const submitted = await call(db, person, 'POST', `/api/assignments/${assignmentId}/submit`, { answers: answersFor(paper) })
    assert.equal(submitted.status, 201, JSON.stringify(submitted.body))
    assert.equal(submitted.body.score, submitted.body.maxScore, `${person} marked with their own key`)
  }
  // The teacher sees each student's own paper beside their answers.
  const submissions = (await call(db, 'teacher', 'GET', `/api/assignments/${assignmentId}/submissions`)).body.submissions
  const mine = submissions.find(submission => submission.studentId === 's-1')
  assert.deepEqual(mine.paperQuestions.map(question => question.id), first.map(question => question.id))
  assert.equal(mine.paperQuestions.find(question => question.id === 'speed').prompt, first.find(question => question.id === 'speed').prompt)
})

test('an approved secondary-school exam can be sat online, and gets unique papers by default', async () => {
  const db = await setup()
  const ai = fakeModel([])
  const topic = await topicWithNotes(db, 'Demand')
  const created = await call(db, 'teacher', 'POST', '/api/ai-assessments', { classId: 'ss2a', subjectId: 'econ', kind: 'exam', blueprint: { sections: [{ name: 'A', type: 'mcq', questions: 5, attempt: 5, marksPerQuestion: 1 }] }, topicIds: [topic.id] }, ai)
  const id = created.body.assessment.id
  await call(db, 'teacher', 'PUT', `/api/ai-assessments/${id}/blueprint`, { blueprint: created.body.assessment.blueprint })
  await generateAll(db, id, ai)
  assert.equal((await call(db, 'teacher', 'POST', `/api/ai-assessments/${id}/post`, {})).status, 400, 'not before approval')
  await db.prepare(`UPDATE ai_assessments SET status = 'finalised' WHERE id = ?`).bind(id).run()
  const posted = await call(db, 'teacher', 'POST', `/api/ai-assessments/${id}/post`, { mode: 'now' })
  assert.equal(posted.status, 200, JSON.stringify(posted.body))
  assert.equal(posted.body.assignment.metadata.uniquePerStudent, true)
})
