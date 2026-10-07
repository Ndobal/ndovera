import test from 'node:test'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { sign } from '@tsndr/cloudflare-worker-jwt'
import { D1Shim, createLegacySchema } from './d1-shim.mjs'
import { paperImport, sittings } from './build/materialSessionTest.mjs'

// ─── Reading a teacher's own paper ───────────────────────────────────────────

const PAPER = `GENESIS INTERNATIONAL SCHOOL
FIRST TERM EXAMINATION — PHYSICS SS 2

SECTION A: OBJECTIVES
Answer all questions in this section.
1. Which of these is a vector quantity?   A. mass  B. speed  C. velocity  D. time
2. The unit of force is
(a) joule
(b) newton*
(c) watt
(d) pascal
3. A body at rest has
A. kinetic energy
B. potential energy only
C. no energy at all
D. momentum
Answer: B
4. Light travels faster than sound.
A. True
B. False

SECTION B: THEORY
Answer any two questions. Question 1 is compulsory.
1. (a) Define work. [2 marks]
(b) A boy lifts a 5 kg box through 2 m. Calculate the work done. (g = 10 m/s²) [4 marks]
2. Explain three uses of a concave mirror. (6 marks)
3. (a) State Newton's first law. [2 marks]
(b) Give two examples of inertia in everyday life. [4 marks]

ANSWER KEY
1. C   2. B   3. B   4. A
`

test('a pasted paper becomes objective questions with their key and a theory section with parts and marks', () => {
  const result = paperImport.parsePaperText(PAPER)
  assert.deepEqual(result.sections.map(section => [section.name, section.kind]), [['A', 'objective'], ['B', 'theory']])
  const objective = result.questions.filter(question => question.section === 'A')
  const theory = result.questions.filter(question => question.section === 'B')
  assert.equal(objective.length, 4)
  assert.equal(theory.length, 3)
  assert.deepEqual(objective[0].options, ['mass', 'speed', 'velocity', 'time'])
  assert.equal(objective[0].prompt, 'Which of these is a vector quantity?')
  assert.deepEqual(objective.map(question => question.answerIndex), [2, 1, 1, 0])
  assert.equal(objective[1].options[1], 'newton', 'the asterisk is removed')
  assert.equal(objective[3].type, 'truefalse')
  assert.deepEqual(theory[0].parts.map(part => [part.label, part.marks]), [['a', 2], ['b', 4]])
  assert.match(theory[0].parts[1].prompt, /Calculate the work done/)
  assert.equal(theory[1].marks, 6)
  assert.equal(result.sections[1].attempt, 2)
  assert.deepEqual(result.sections[1].compulsory, [1])
  assert.deepEqual(result.warnings, [])

  const input = paperImport.toAssessmentInput(result)
  assert.equal(input.questions.length, 7)
  assert.equal(input.mcqOptions, 4)
  const sectionB = input.blueprint.sections.find(section => section.name === 'B')
  assert.deepEqual([sectionB.questions, sectionB.attempt, sectionB.compulsory], [3, 2, [1]])
  assert.equal(input.questions[4].compulsory, true)
})

test('what cannot be read safely is reported, never guessed', () => {
  const result = paperImport.parsePaperText('1. Pick one. A. x B. y C. z D. w\n2. Another one. A. p B. q C. r D. s\n3. Discuss the causes of inflation in Nigeria.')
  assert.deepEqual(result.questions.slice(0, 2).map(question => question.answerIndex), [-1, -1])
  assert.equal(result.questions[2].section, 'B', 'theory goes to Section B when the paper has no headings')
  assert.ok(result.warnings.some(warning => /no answer yet/.test(warning)))
  assert.ok(result.warnings.some(warning => /no marks written/.test(warning)))
  assert.equal(paperImport.needsAiHelp(paperImport.parsePaperText('The quick brown fox '.repeat(60)), 'The quick brown fox '.repeat(60)), true)
})

test('Ndovera AI replies are read into the same shape, keeping only what the paper says', () => {
  const reply = '```json\n[{"section":"A","type":"mcq","prompt":"What is 2+2?","options":["A. 3","B. 4","C. 5","D. 6"],"answer":"B"},{"section":"B","type":"structured","prompt":"Answer these.","parts":[{"prompt":"Define speed.","marks":2},{"prompt":"Give its unit.","marks":1}],"marks":3}]\n```'
  const result = paperImport.importFromAiReply(reply)
  assert.deepEqual(result.questions[0].options, ['3', '4', '5', '6'])
  assert.equal(result.questions[0].answerIndex, 1)
  assert.deepEqual(result.questions[1].parts.map(part => part.marks), [2, 1])
})

test('the score sheet gets (objective + theory) ÷ paper total × exam maximum — or the raw total when the school says so', () => {
  assert.deepEqual(sittings.sheetScore(59, 30, 100, { examMaxScore: 60, entry: 'convert', decimals: 1 }), { total: 89, score: 53.4 })
  assert.deepEqual(sittings.sheetScore(59, 30, 100, { examMaxScore: 60, entry: 'convert', decimals: 0 }), { total: 89, score: 53 })
  assert.deepEqual(sittings.sheetScore(40, 15, 70, { examMaxScore: 60, entry: 'raw', decimals: 1 }), { total: 55, score: 55 })
  assert.deepEqual(sittings.sheetScore(59, 30, 100, { examMaxScore: 60, entry: 'raw', decimals: 1 }), { total: 89, score: 60 }, 'never above the maximum')
  assert.throws(() => sittings.validateSchedule({ mode: 'cbt', opensAt: '2026-10-10T08:00:00Z', closesAt: '2026-10-10T08:30:00Z', durationMinutes: 45 }), /window is only 30 minutes/)
  assert.equal(sittings.validateSchedule({ mode: 'print' }).mode, 'print')
})

// ─── The whole journey ───────────────────────────────────────────────────────

const SECRET = 'test-secret'
let worker
let generation = 0
const PEOPLE = {
  teacher: ['t-phy', 'phy@a.test', 'teacher', 'school-a', {}],
  hos: ['h-1', 'hos@a.test', 'hos', 'school-a', {}],
  owner: ['o-1', 'owner@a.test', 'owner', 'school-a', {}],
  student: ['s-1', 'ada@a.test', 'student', 'school-a', { classId: 'ss2a' }],
  student2: ['s-2', 'bola@a.test', 'student', 'school-a', { classId: 'ss2a' }],
  student3: ['s-3', 'chi@a.test', 'student', 'school-a', { classId: 'ss2a' }],
}

async function setup() {
  worker = (await import(`./build/worker.mjs?sit=${generation++}`)).default
  const db = new D1Shim()
  createLegacySchema(db)
  const schema = readFileSync(new URL('../d1/schema.sql', import.meta.url), 'utf8')
  db.db.exec(schema.match(/CREATE TABLE IF NOT EXISTS tenants \([\s\S]*?\);/)[0])
  const now = new Date().toISOString()
  db.db.prepare(`INSERT INTO tenants (id, school_name, school_slug, owner_name, owner_email, plan_key, requested_subdomain, website_domain, status, approval_status, payment_status, website_status, setup_fee_cents, student_fee_cents, created_at, updated_at, activated_at)
    VALUES ('school-a', 'Genesis International School', 'genesis', 'Owner', 'o@a.test', 'standard', 'genesis', 'genesis.ndovera.com', 'active', 'approved', 'paid', 'active', 0, 0, ?, ?, ?)`).run(now, now, now)
  db.db.exec(`
    CREATE TABLE subjects (id TEXT PRIMARY KEY, tenantId TEXT, name TEXT, classId TEXT, teacherId TEXT, createdAt TEXT);
    INSERT INTO classes (id, tenantId, name, arm) VALUES ('ss2a', 'school-a', 'SS 2', 'A');
    INSERT INTO subjects VALUES ('phy', 'school-a', 'Physics', 'ss2a', 't-phy', 'x');
  `)
  for (const [id, email, role, tenant, extra] of Object.values(PEOPLE)) {
    await db.prepare('INSERT INTO users (id, email, name, role, tenantId, status) VALUES (?, ?, ?, ?, ?, ?)').bind(id, email, id, role, tenant, 'active').run()
    await db.prepare('INSERT INTO settings (studentId, payload) VALUES (?, ?)').bind(email, JSON.stringify({ name: id, email, role, tenantId: tenant, schoolId: tenant, status: 'active', ...extra })).run()
  }
  // Result settings are read by the signed-in id.
  await db.prepare('INSERT INTO settings (studentId, payload) VALUES (?, ?)').bind('o-1', JSON.stringify({ name: 'o-1', email: 'owner@a.test', role: 'owner', tenantId: 'school-a', schoolId: 'school-a', status: 'active' })).run()
  return db
}

async function call(db, person, method, path, body) {
  const [id, , role, tenantId] = PEOPLE[person]
  const token = await sign({ id, role, roles: [role], tenantId, name: id, exp: Math.floor(Date.now() / 1000) + 600 }, SECRET)
  const response = await worker.fetch(new Request(`https://ndovera.com${path}`, {
    method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
  }), { APP_DB: db, JWT_SECRET: SECRET }, { waitUntil() {}, passThroughOnException() {} })
  return { status: response.status, body: await response.json().catch(() => ({})) }
}

const RESULT_SETTINGS = {
  templateKey: 'premium-ledger',
  gradingScale: [{ minScore: 70, grade: 'A', remark: 'Excellent' }, { minScore: 0, grade: 'F', remark: 'Fail' }],
  ratingScale: [{ value: 5, label: 'Excellent' }, { value: 1, label: 'Poor' }],
  affectiveScale: [{ value: 5, label: 'Excellent' }, { value: 1, label: 'Poor' }],
  affectiveDomains: [{ key: 'punctuality', label: 'Punctuality' }],
  metadata: { affectiveWriteUp: 'Rate each area from 1 to 5.', caMaxScore: 40, examMaxScore: 60, caComponents: [{ key: 'ca1', label: 'CA 1', maxScore: 20 }, { key: 'ca2', label: 'CA 2', maxScore: 20 }] },
}

test('a typed paper → HOS approves it as CBT objectives + printed theory → students write it in its window → teacher marks the theory → scores land in the score sheet and the paper opens for review', async () => {
  const db = await setup()
  const configured = await call(db, 'owner', 'POST', '/api/results/settings', RESULT_SETTINGS)
  assert.equal(configured.status, 200, JSON.stringify(configured.body))

  // Exam questions no longer go in as uploaded files.
  const refused = await call(db, 'teacher', 'POST', '/api/teacher-submissions', { type: 'exam_questions', classId: 'ss2a', subjectId: 'phy', title: 'Exam', files: [{ name: 'exam.docx' }] })
  assert.equal(refused.status, 400)
  assert.equal(refused.body.useExamsPage, true)

  // The teacher pastes their paper; Ndovera reads it into the editor.
  const imported = await call(db, 'teacher', 'POST', '/api/ai-assessments/import', { classId: 'ss2a', subjectId: 'phy', title: 'Physics First Term Examination', text: PAPER })
  assert.equal(imported.status, 201, JSON.stringify(imported.body))
  const paper = imported.body.assessment
  assert.equal(paper.kind, 'exam')
  assert.equal(paper.questions.length, 7)
  assert.equal(paper.pending, 0)
  // Theory has no marking guide yet, so it cannot be submitted.
  assert.equal((await call(db, 'teacher', 'POST', `/api/ai-assessments/${paper.id}/submit-exam`)).status, 409)
  const withSchemes = paper.questions.map(question => (question.section === 'B'
    ? { ...question, ...(question.parts?.length ? { parts: question.parts.map(part => ({ ...part, answer: 'Model answer', markingPoints: ['point'] })) } : { answer: 'Model answer', markingPoints: ['point'] }) }
    : question))
  const saved = await call(db, 'teacher', 'PUT', `/api/ai-assessments/${paper.id}`, { questions: withSchemes })
  assert.equal(saved.status, 200, JSON.stringify(saved.body))
  assert.deepEqual(saved.body.problems, [])
  const audit = saved.body.assessment.audit
  assert.equal(audit.examMarks, 4 + 6 + 6, 'objectives 4 + compulsory Q1 (6) + best other (6)')
  const submitted = await call(db, 'teacher', 'POST', `/api/ai-assessments/${paper.id}/submit-exam`)
  assert.equal(submitted.status, 200, JSON.stringify(submitted.body))
  const submissionId = submitted.body.submission.id
  // The HOS can download it: awaiting approval now; teachers cannot list every school paper.
  const awaiting = await call(db, 'hos', 'GET', '/api/exam-papers?status=submitted')
  assert.deepEqual(awaiting.body.papers.map(item => [item.id, item.questions.length]), [[paper.id, 7]])
  assert.equal((await call(db, 'hos', 'GET', '/api/exam-papers?status=approved')).body.papers.length, 0)
  assert.equal((await call(db, 'teacher', 'GET', '/api/exam-papers')).status, 403)

  // The HOS sees what the paper holds and approves it as CBT objectives + printed theory.
  const detail = await call(db, 'hos', 'GET', `/api/teacher-submissions/${submissionId}`)
  assert.deepEqual([detail.body.examPaper.objectiveCount, detail.body.examPaper.objectiveMarks, detail.body.examPaper.theoryMarks, detail.body.examPaper.secondary], [4, 4, 12, true])
  const opensAt = new Date(Date.now() + 3600_000).toISOString()
  const closesAt = new Date(Date.now() + 7200_000).toISOString()
  assert.equal((await call(db, 'hos', 'POST', `/api/teacher-submissions/${submissionId}/decision`, { decision: 'approve', delivery: { mode: 'cbt_objective', opensAt, closesAt, durationMinutes: 90 } })).status, 400, 'duration longer than the window')
  const approved = await call(db, 'hos', 'POST', `/api/teacher-submissions/${submissionId}/decision`, { decision: 'approve', delivery: { mode: 'cbt_objective', opensAt, closesAt, durationMinutes: 40 } })
  assert.equal(approved.status, 200, JSON.stringify(approved.body))
  const sitting = approved.body.sitting
  assert.deepEqual((await call(db, 'owner', 'GET', '/api/exam-papers?status=approved')).body.papers.map(item => item.id), [paper.id])
  assert.deepEqual([sitting.mode, sitting.phase, sitting.uniquePerStudent, sitting.objectiveMarks, sitting.theoryMarks, sitting.paperTotal], ['cbt_objective', 'scheduled', true, 4, 12, 16])

  // Before it opens: listed with its time, but the paper cannot be opened. Never in the classroom.
  const upcoming = await call(db, 'student', 'GET', '/api/exam-sittings/student')
  assert.deepEqual(upcoming.body.exams.map(exam => [exam.id, exam.phase, exam.theoryOnPaper]), [[sitting.id, 'scheduled', true]])
  assert.equal((await call(db, 'student', 'GET', `/api/exam-sittings/${sitting.id}/paper`)).status, 403)
  assert.equal((await call(db, 'student', 'GET', '/api/classrooms/ss2a/assignments')).body.assignments.length, 0)
  assert.equal((await call(db, 'teacher', 'GET', '/api/classrooms/ss2a/assignments')).body.assignments.length, 0)

  // The HOS moves it to now.
  const moved = await call(db, 'hos', 'PUT', `/api/exam-sittings/${sitting.id}/schedule`, { opensAt: new Date(Date.now() - 60_000).toISOString(), closesAt, durationMinutes: 40 })
  assert.equal(moved.status, 200, JSON.stringify(moved.body))
  assert.equal(moved.body.sitting.phase, 'open')
  assert.equal((await call(db, 'teacher', 'PUT', `/api/exam-sittings/${sitting.id}/schedule`, { opensAt, closesAt, durationMinutes: 40 })).status, 403)
  assert.equal((await call(db, 'teacher', 'PUT', `/api/exam-sittings/${sitting.id}/marks`, { rows: [] })).status, 409, 'no marking while it is open')

  // Each student opens their own objectives-only paper, without answers, and writes it.
  const open1 = await call(db, 'student', 'GET', `/api/exam-sittings/${sitting.id}/paper`)
  assert.equal(open1.status, 200, JSON.stringify(open1.body))
  assert.equal(open1.body.questions.length, 4)
  assert.ok(open1.body.questions.every(question => !('answer' in question)))
  const assignmentId = open1.body.assignment.id
  const rightAnswer = question => ({ 'Which of these is a vector quantity?': 'velocity', 'The unit of force is': 'newton', 'A body at rest has': 'potential energy only', 'Light travels faster than sound.': 'True' })[question.prompt]
  // Ada gets all four right; Bola only the first two on her own paper.
  for (const [person, correct] of [['student', 4], ['student2', 2]]) {
    const questions = (await call(db, person, 'GET', `/api/exam-sittings/${sitting.id}/paper`)).body.questions
    const answers = Object.fromEntries(questions.map((question, index) => [question.id, index < correct ? rightAnswer(question) : 'wrong']))
    assert.equal((await call(db, person, 'POST', `/api/assignments/${assignmentId}/start`)).status, 200)
    const done = await call(db, person, 'POST', `/api/assignments/${assignmentId}/submit`, { answers })
    assert.equal(done.status, 201, JSON.stringify(done.body))
  }
  // Written: gone from the student's exam list, and cannot be opened again.
  assert.equal((await call(db, 'student', 'GET', '/api/exam-sittings/student')).body.exams.length, 0)
  assert.equal((await call(db, 'student', 'GET', `/api/exam-sittings/${sitting.id}/paper`)).status, 409)

  // The window closes; the teacher marks the theory only.
  await db.prepare(`UPDATE exam_sittings SET closes_at = ? WHERE id = ?`).bind(new Date(Date.now() - 1000).toISOString(), sitting.id).run()
  const sheet = await call(db, 'teacher', 'GET', `/api/exam-sittings/${sitting.id}/marking`)
  assert.equal(sheet.status, 200, JSON.stringify(sheet.body))
  const byStudent = Object.fromEntries(sheet.body.rows.map(row => [row.studentId, row]))
  assert.deepEqual([byStudent['s-1'].objective, byStudent['s-2'].objective, byStudent['s-3'].objective], [4, 2, null])
  assert.equal(sheet.body.scoring.entry, 'convert')
  assert.equal((await call(db, 'teacher', 'PUT', `/api/exam-sittings/${sitting.id}/marks`, { rows: [{ studentId: 's-1', theory: 13 }] })).status, 400, 'above the theory total')
  assert.equal((await call(db, 'teacher', 'PUT', `/api/exam-sittings/${sitting.id}/marks`, { rows: [{ studentId: 's-1', theory: 11, objective: 0 }] })).status, 200)
  const kept = (await call(db, 'teacher', 'GET', `/api/exam-sittings/${sitting.id}/marking`)).body.rows.find(row => row.studentId === 's-1')
  assert.equal(kept.objective, 4, 'the computer\'s objective score cannot be overwritten')

  // Bola has no theory mark yet: the teacher is asked first.
  const early = await call(db, 'teacher', 'POST', `/api/exam-sittings/${sitting.id}/post`)
  assert.equal(early.status, 409)
  assert.equal(early.body.needsConfirmation, true)
  await call(db, 'teacher', 'PUT', `/api/exam-sittings/${sitting.id}/marks`, { rows: [{ studentId: 's-2', theory: 6 }] })

  // A CA mark already in the score sheet must survive.
  assert.equal((await call(db, 'teacher', 'POST', '/api/results/entries', { classId: 'ss2a', rows: [{ studentId: 's-1', subjectId: 'phy', caComponents: { ca1: 18, ca2: 15 }, examScore: 0 }] })).status, 200)
  const post = await call(db, 'teacher', 'POST', `/api/exam-sittings/${sitting.id}/post`)
  assert.equal(post.status, 200, JSON.stringify(post.body))
  assert.equal(post.body.posted, 2, 'Chi was absent and is left for the teacher')
  const entries = (await call(db, 'teacher', 'GET', '/api/results/sheet?classId=ss2a')).body.entries || []
  const ada = entries.find(entry => entry.studentId === 's-1' && entry.subjectId === 'phy')
  const bola = entries.find(entry => entry.studentId === 's-2' && entry.subjectId === 'phy')
  // Ada: (4 + 11) ÷ 16 × 60 = 56.25 → 56.3; Bola: (2 + 6) ÷ 16 × 60 = 30
  assert.equal(ada.examScore, 56.3)
  assert.equal(ada.caScore, 33, 'CA kept')
  assert.equal(bola.examScore, 30)

  // The paper is now in the students' Assignments tab, with their own answers, the correct answers and the theory marking guide.
  const review = (await call(db, 'student', 'GET', '/api/classrooms/ss2a/assignments')).body.assignments
  assert.equal(review.length, 1)
  assert.equal(review[0].questions.length, 7)
  assert.ok(review[0].questions.some(question => question.markingGuide))
  assert.ok(review[0].questions.some(question => question.answer === 'velocity'))
  assert.match(review[0].mySubmission.feedback, /Score sheet: 56\.3\/60/)
})

test('the old CBT engine no longer hands students the answers, and students submit only as themselves', async () => {
  const db = await setup()
  // Production's question bank carries a legacy createdAt column the engine sorts by.
  await call(db, 'teacher', 'GET', '/api/exams')
  db.db.exec('ALTER TABLE question_bank ADD COLUMN createdAt TEXT')
  const created = await call(db, 'teacher', 'POST', '/api/exams', { title: 'Old CBT', status: 'published', questions: [{ type: 'mcq', prompt: 'Capital of Nigeria?', options: ['Lagos', 'Abuja'], answer: 'Abuja', score: 1 }] })
  assert.equal(created.status, 201, JSON.stringify(created.body))
  const id = created.body.exam.id
  const asStudent = await call(db, 'student', 'GET', `/api/exams/${id}`)
  assert.equal(asStudent.status, 200)
  assert.ok(asStudent.body.exam.questions.every(question => !('answer' in question)))
  assert.ok((await call(db, 'teacher', 'GET', `/api/exams/${id}`)).body.exam.questions.some(question => question.answer === 'Abuja'))
  await call(db, 'student', 'POST', `/api/exams/${id}/submit`, { userId: 's-2', answers: {} })
  const attempt = await db.prepare('SELECT student_id FROM cbt_attempts WHERE exam_id = ?').bind(id).first()
  assert.equal(attempt.student_id, 's-1')
})
