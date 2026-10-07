import test from 'node:test'
import assert from 'node:assert/strict'
import { sign } from '@tsndr/cloudflare-worker-jwt'
import { D1Shim, createLegacySchema } from './d1-shim.mjs'
import { curriculum as lib, generator as gen } from './build/materialSessionTest.mjs'

// ─── The library and the generator, without the model ───────────────────────

test('class levels and subjects are recognised however a school writes them', () => {
  const key = value => lib.normalizeClassLevel(value).key
  assert.deepEqual(['SS 2', 'SSS2', 'Senior Secondary Two', 'SS2 Science', 'ss2'].map(key), ['SS2', 'SS2', 'SS2', 'SS2', 'SS2'])
  assert.deepEqual(['JSS 1A', 'Junior Secondary 3', 'Basic 7', 'Primary Five', 'Pry 4', 'Nursery 2', 'Grade 11'].map(key), ['JSS1', 'JSS3', 'JSS1', 'PRY5', 'PRY4', 'NUR2', 'SS2'])
  assert.equal(key('Science Lab'), '')
  assert.equal(lib.subjectKey('General Maths'), lib.subjectKey('Mathematics'))
  assert.equal(lib.subjectKey('English Language'), 'english')
})

test('CSV imports keep quoted commas and multi-line cells', () => {
  const rows = lib.parseCsv('class,subject,topic,objectives\n"SS 2",Mathematics,"Quadratic Equations","solve by factorisation; use the formula, and check"\nPrimary 4,Mathematics,Fractions,"equivalent fractions\ncompare fractions"')
  assert.equal(rows.length, 2)
  assert.equal(rows[0].objectives, 'solve by factorisation; use the formula, and check')
  const { row, problems } = lib.normalizeCurriculumRow(rows[1])
  assert.deepEqual(problems, [])
  assert.deepEqual([row.classKey, row.subjectKey, row.objectives], ['PRY4', 'mathematics', ['equivalent fractions', 'compare fractions']])
  assert.deepEqual(lib.normalizeCurriculumRow({ class: 'Lab', subject: 'Maths', topic: 'x' }).problems, ['class "Lab" not recognised'])
})

test('blocks the model writes are checked: tables are rectangular, graphs drawable, answers among the options', () => {
  const allow = { formulae: true, tables: true, graphs: true, images: true }
  const norm = raw => gen.normalizeBlock(raw, 'core', allow)
  assert.equal(norm({ type: 'table', columns: ['a', 'b'], rows: [['1', '2'], ['3']] }).problem, 'table rows do not match the columns')
  assert.match(norm({ type: 'graph', figure: { type: 'spaceship' } }).problem, /cannot be drawn/)
  assert.equal(norm({ type: 'graph', figure: { type: 'function', xRange: [-3, 3], functions: [{ expr: 'x^2' }] } }).block.type, 'graph')
  assert.equal(norm({ type: 'question', prompt: 'Pick one', options: ['1', '2', '3', '4'], answer: 'E' }).problem, 'the answer is not one of the options')
  assert.equal(norm({ type: 'question', prompt: 'Pick one', options: ['A. 1', 'B. 2', 'C. 3', 'D. 4'], answer: 'C' }).block.answer, 'C. 3')
  assert.equal(norm({ type: 'formula', latex: '\\frac{1}{2' }).problem, 'formula braces do not balance')
  assert.equal(gen.normalizeBlock({ type: 'image', prompt: 'heart' }, 'core', { ...allow, images: false }).problem, 'images are switched off')
})

test('the validator checks arithmetic, examination claims and curriculum coverage', () => {
  assert.deepEqual(gen.arithmeticSlips('so 3 × 4 = 12 and 12 + 5 = 17'), [])
  assert.equal(gen.arithmeticSlips('then 2 + 3 = 6').length, 1)
  assert.equal(gen.evaluateArithmetic('2^3 + (4 - 1) * 2'), 14)
  assert.ok(Number.isNaN(gen.evaluateArithmetic('2x + 1')))
  const grounding = { curriculum: [{ classLabel: 'SS 2', objectives: ['solve quadratic equations by factorisation', 'apply the quadratic formula to real problems'] }], exams: [], classLevel: { label: 'SS 2' }, levelDecision: 'matched', customExam: '' }
  const blocks = [
    { type: 'paragraph', section: 'core', text: 'We solve quadratic equations by factorisation.' },
    { type: 'question', section: 'practice', prompt: 'This WAEC 2019 question asks…', style: 'theory', options: [], answer: 'x', solution: '' },
  ]
  const result = gen.validateDraft({ blocks, grounding, sections: [], options: ['answers'], examLabels: ['WAEC'] })
  const check = key => result.checks.find(item => item.key === key)
  assert.equal(check('claims').status, 'fail')
  assert.equal(check('curriculum').status, 'warn')
  assert.match(check('curriculum').detail, /apply the quadratic formula/)
  assert.equal(result.ok, false)
})

test('the plan follows the kind of material and the teacher\'s switches', () => {
  const titles = (kind, options, extra = {}) => gen.planSections({ kind, length: 'detailed', options, hasExams: false, subtopics: [], progressiveLevels: [], ...extra }).map(section => section.key)
  assert.deepEqual(titles('flashcards', []), ['flashcards'])
  assert.deepEqual(titles('study_note', ['common_mistakes', 'practice', 'objective', 'answers', 'summary'], { hasExams: true }),
    ['coverage', 'prerequisites', 'core', 'exam_focus', 'mistakes', 'practice', 'assessment', 'solutions', 'summary'])
  assert.deepEqual(titles('lesson_note', [], { progressiveLevels: ['Primary 3', 'Primary 4', 'Primary 5'] }).filter(key => key.startsWith('core')), ['core_1', 'core_2', 'core_3'])
})

// ─── Through the Worker, with a stand-in model ───────────────────────────────

const SECRET = 'material-ai-test-secret'
let worker
let generation = 0
const PEOPLE = {
  ami: ['ami-1', 'ami@ndovera.com', 'ami', '', {}],
  teacher: ['t-math', 'math@a.test', 'teacher', 'school-a', {}],
  other: ['t-eng', 'eng@a.test', 'teacher', 'school-a', {}],
  owner: ['o-1', 'owner@a.test', 'owner', 'school-a', {}],
  student: ['s-1', 'pupil@a.test', 'student', 'school-a', { classId: 'ss2a' }],
}

const PIXEL = Buffer.from('fake-jpeg-bytes').toString('base64')

/** Writes each section from the allowed block types; reads curricula; reviews; draws. */
function fakeModel(log = [], { claim = false, slip = false } = {}) {
  return {
    run: async (model, input) => {
      if (model.includes('flux')) { log.push({ image: input.prompt }); return { image: PIXEL } }
      const system = input.messages[0].content
      const user = input.messages[input.messages.length - 1].content
      log.push({ system, user })
      if (/convert an official school curriculum/.test(system)) {
        return { response: JSON.stringify([{ class: 'SS 2', subject: 'Chemistry', topic: 'Chemical Equilibrium', subtopics: ['Le Chatelier'], objectives: ['state Le Chatelier\'s principle'] }]) }
      }
      if (/You check a school learning material/.test(system)) return { response: '{"findings":[{"block":2,"severity":"warning","issue":"Define the discriminant before using it.","fix":"Add a definition."}],"summary":"Mostly sound."}' }
      const allowed = (user.match(/Block types allowed in this section: ([^\n.]+)/) || [])[1]?.split(', ') || []
      const blocks = []
      if (allowed.includes('question')) {
        blocks.push({ type: 'question', style: 'objective', level: 'easy', prompt: claim ? 'This is WAEC 2019 question 4: solve x^2 - 5x + 6 = 0.' : 'Solve \\(x^2 - 5x + 6 = 0\\).', options: ['x = 1, 6', 'x = 2, 3', 'x = -2, -3', 'x = 0, 5'], answer: 'B', marks: 1 })
        blocks.push({ type: 'question', style: 'theory', level: 'exam', prompt: 'Use the quadratic formula to solve 2x^2 + 3x - 2 = 0.', answer: 'x = 0.5 or x = -2', solution: slip ? 'b^2 - 4ac = 9 + 16 = 24' : 'b^2 - 4ac = 9 + 16 = 25', marks: 6, markingGuide: ['Correct substitution (2)', 'Both roots (4)'] })
      } else if (allowed.includes('flashcard')) {
        blocks.push({ type: 'flashcard', front: 'Discriminant', back: 'b^2 - 4ac' })
      } else {
        blocks.push({ type: 'paragraph', text: 'We solve quadratic equations by factorisation and apply the quadratic formula to real problems such as area.' })
        if (allowed.includes('definition')) blocks.push({ type: 'definition', term: 'Quadratic equation', text: 'An equation of the form \\(ax^2 + bx + c = 0\\), a ≠ 0.' })
        if (allowed.includes('formula')) blocks.push({ type: 'formula', latex: 'x=\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}', caption: 'The quadratic formula' })
        if (allowed.includes('table')) blocks.push({ type: 'table', caption: 'Roots', columns: ['Equation', 'Roots'], rows: [['x^2 - 4 = 0', '±2']] })
        if (allowed.includes('graph')) blocks.push({ type: 'graph', caption: 'y = x^2 - 4', figure: { type: 'function', xRange: [-3, 3], functions: [{ expr: 'x^2-4' }] } })
        if (allowed.includes('worked_example')) blocks.push({ type: 'worked_example', question: 'Solve x^2 - 4 = 0', steps: ['x^2 = 4', '2 × 2 = 4', 'x = ±2'], answer: 'x = 2 or x = -2' })
        if (allowed.includes('image')) blocks.push({ type: 'image', prompt: 'a parabola crossing the x-axis at two points', caption: 'Two real roots' })
        if (allowed.includes('list')) blocks.push({ type: 'list', items: ['factorisation', 'completing the square'] })
        if (allowed.includes('common_mistake')) blocks.push({ type: 'common_mistake', text: 'Dividing both sides by x loses the root x = 0.' })
        if (allowed.includes('exam_tip')) blocks.push({ type: 'exam_tip', text: 'Show the substitution into the formula: method marks are awarded for it.' })
        if (allowed.includes('summary')) blocks.push({ type: 'summary', items: ['A quadratic has at most two real roots.'] })
        blocks.push({ type: 'spaceship', text: 'junk the server must drop' })
      }
      return { response: JSON.stringify({ blocks }) }
    },
  }
}

function fakeBucket() {
  const store = new Map()
  return { store, put: async (key, value, options) => { store.set(key, { value, options }) }, get: async key => (store.has(key) ? { body: store.get(key).value, httpMetadata: store.get(key).options?.httpMetadata } : null) }
}

async function setup() {
  worker = (await import(`./build/worker.mjs?materialai=${generation++}`)).default
  const db = new D1Shim()
  createLegacySchema(db)
  db.db.exec(`
    CREATE TABLE subjects (id TEXT PRIMARY KEY, tenantId TEXT, name TEXT, classId TEXT, teacherId TEXT, createdAt TEXT);
    CREATE TABLE tenants (id TEXT PRIMARY KEY, school_name TEXT);
    INSERT INTO tenants VALUES ('school-a', 'Genesis International School');
    INSERT INTO classes (id, tenantId, name, arm) VALUES ('ss2a', 'school-a', 'SS 2', 'A'), ('p4', 'school-a', 'Primary 4', '');
    INSERT INTO subjects VALUES ('math', 'school-a', 'Mathematics', 'ss2a', 't-math', 'x'), ('eng', 'school-a', 'English Language', 'ss2a', 't-eng', 'x'),
      ('chem', 'school-a', 'Chemistry', 'ss2a', 't-math', 'x'), ('p4math', 'school-a', 'Mathematics', 'p4', 't-math', 'x');
    CREATE TABLE materials (id TEXT PRIMARY KEY, classId TEXT, title TEXT, url TEXT, metadata TEXT, uploadedAt TEXT, uploadedBy TEXT);
  `)
  for (const [id, email, role, tenant, extra] of Object.values(PEOPLE)) {
    await db.prepare('INSERT INTO users (id, email, name, role, tenantId, status) VALUES (?, ?, ?, ?, ?, ?)').bind(id, email, id, role, tenant, 'active').run()
    await db.prepare('INSERT INTO settings (studentId, payload) VALUES (?, ?)').bind(email, JSON.stringify({ name: id, email, role, tenantId: tenant, schoolId: tenant, status: 'active', ...extra })).run()
  }
  return db
}

function caller(db, ai = fakeModel(), uploads = fakeBucket()) {
  return async (person, method, path, body) => {
    const [id, , role, tenantId] = PEOPLE[person]
    const token = await sign({ id, role, roles: [role], tenantId, name: id, exp: Math.floor(Date.now() / 1000) + 600 }, SECRET)
    const response = await worker.fetch(new Request(`https://ndovera.com${path}`, {
      method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
    }), { APP_DB: db, JWT_SECRET: SECRET, AI: ai, UPLOADS: uploads }, { waitUntil() {}, passThroughOnException() {} })
    return { status: response.status, body: await response.json().catch(() => ({})) }
  }
}

const CURRICULUM_CSV = [
  'class,subject,theme,topic,subtopics,objectives',
  'SS 2,Mathematics,Algebra,Quadratic Equations,"Factorisation; Completing the square; Quadratic formula","solve quadratic equations by factorisation; apply the quadratic formula to real problems"',
  'SS 2,Mathematics,Algebra,Simultaneous Equations,"Elimination; Substitution","solve simultaneous linear equations"',
  'Primary 3,Mathematics,Number,Introduction to Fractions,,"identify halves and quarters"',
  'Primary 4,Mathematics,Number,Equivalent Fractions,,"find equivalent fractions"',
  'Primary 5,Mathematics,Number,Operations on Fractions,,"add and subtract fractions"',
].join('\n')

/** Ami builds and publishes a curriculum; returns its id. */
async function publishedCurriculum(call) {
  const created = await call('ami', 'POST', '/api/ami/curricula', { name: 'Nigerian NERDC Curriculum', country: 'Nigeria', version: '2025' })
  assert.equal(created.status, 201, JSON.stringify(created.body))
  const id = created.body.curriculum.id
  const added = await call('ami', 'POST', `/api/ami/curricula/${id}/topics`, { csv: CURRICULUM_CSV })
  assert.deepEqual([added.body.added, added.body.rejected.length], [5, 0])
  assert.equal((await call('ami', 'POST', `/api/ami/curricula/${id}/status`, { status: 'published' })).status, 200)
  return id
}

async function publishedWaecMaths(call) {
  const spec = await call('ami', 'POST', '/api/ami/exam-specs', {
    examKey: 'waec', subject: 'Mathematics', version: '2025–2027 syllabus', effectiveFrom: '2025-01-01', calculator: 'Non-programmable calculators allowed',
    papers: [{ name: 'Paper 1 (Objective)', marks: 50, durationMinutes: 90 }, { name: 'Paper 2 (Essay)', marks: 100, durationMinutes: 150 }],
  })
  assert.equal(spec.status, 201, JSON.stringify(spec.body))
  const specId = spec.body.spec.id
  await call('ami', 'POST', `/api/ami/exam-specs/${specId}/topics`, { csv: 'area,topic,objectives\nAlgebra,Quadratic equations,"solve quadratic equations; form equations from word problems"\nTrigonometry,Bearings,"solve bearing problems"\nStatistics,Probability,"calculate simple probabilities"' })
  assert.equal((await call('ami', 'POST', `/api/ami/exam-specs/${specId}/status`, { status: 'published' })).status, 200)
  const mapped = await call('ami', 'POST', `/api/ami/exam-specs/${specId}/automap`)
  assert.ok(mapped.body.linked >= 1, JSON.stringify(mapped.body))
  return specId
}

test('only Ndovera edits the Ndovera library; text imports are restructured, not invented', async () => {
  const db = await setup()
  const log = []
  const call = caller(db, fakeModel(log))
  assert.equal((await call('teacher', 'POST', '/api/ami/curricula', { name: 'x' })).status, 403)
  assert.equal((await call('owner', 'POST', '/api/ami/exam-specs', { examKey: 'waec', subject: 'Maths', version: '1' })).status, 403)
  const id = await publishedCurriculum(call)
  // An unpublished draft curriculum is invisible to schools.
  const draft = await call('ami', 'POST', '/api/ami/curricula', { name: 'Draft chemistry' })
  const imported = await call('ami', 'POST', `/api/ami/curricula/${draft.body.curriculum.id}/import-text`, { text: 'SS 2 Chemistry. Topic: Chemical equilibrium. Objectives: state Le Chatelier\'s principle.', offset: 0 })
  assert.deepEqual([imported.body.added, imported.body.done], [1, true])
  assert.match(log[0].system, /never add topics/)
  const schoolView = await call('owner', 'GET', '/api/school/material-ai/settings')
  assert.deepEqual(schoolView.body.curricula.map(item => item.id), [id])
  // A school's own curriculum is the school's; another school cannot touch it.
  const own = await call('owner', 'POST', '/api/school/curricula', { name: 'Genesis scheme of work' })
  assert.equal(own.status, 201)
  assert.equal((await call('ami', 'DELETE', `/api/ami/curricula/${own.body.curriculum.id}`)).status, 404)
})

test('the resolver finds the class, flags a mismatch, lists every level, and says when a topic is missing', async () => {
  const db = await setup()
  const call = caller(db)
  const before = await call('teacher', 'POST', '/api/material-ai/resolve', { classId: 'ss2a', subjectId: 'math', topic: 'Quadratic Equations' })
  assert.equal(before.body.resolution.status, 'no_curriculum')
  await publishedCurriculum(call)
  const matched = await call('teacher', 'POST', '/api/material-ai/resolve', { classId: 'ss2a', subjectId: 'math', topic: 'quadratic equation' })
  assert.equal(matched.body.resolution.status, 'matched')
  assert.equal(matched.body.resolution.match.classKey, 'SS2')
  // A Primary 4 teacher asking for simultaneous equations.
  const mismatch = await call('teacher', 'POST', '/api/material-ai/resolve', { classId: 'p4', subjectId: 'p4math', topic: 'Simultaneous Equations' })
  assert.equal(mismatch.body.resolution.status, 'mismatch')
  assert.match(mismatch.body.resolution.message, /not found under Primary 4 Mathematics[\s\S]*SS 2/)
  // No class chosen: fractions sit at three levels.
  const multiple = await call('teacher', 'POST', '/api/material-ai/resolve', { classId: 'p4', subjectId: 'p4math', topic: 'Fractions', classLevel: '' })
  assert.equal(multiple.body.resolution.status, 'multiple')
  assert.deepEqual(multiple.body.resolution.matches.map(row => row.classLabel), ['Primary 3', 'Primary 4', 'Primary 5'])
  const missing = await call('teacher', 'POST', '/api/material-ai/resolve', { classId: 'ss2a', subjectId: 'math', topic: 'Photosynthesis' })
  assert.equal(missing.body.resolution.status, 'not_found')
  // Not this teacher's subject.
  assert.equal((await call('other', 'POST', '/api/material-ai/resolve', { classId: 'ss2a', subjectId: 'math', topic: 'x' })).status, 403)
})

test('examinations are subject- and level-aware, and say whether a specification is on file', async () => {
  const db = await setup()
  const call = caller(db)
  await publishedCurriculum(call)
  await publishedWaecMaths(call)
  const maths = (await call('teacher', 'GET', '/api/material-ai/options?classId=ss2a&subjectId=math')).body.exams
  assert.deepEqual(maths.map(exam => exam.key), ['waec', 'neco', 'igcse', 'sat'])
  assert.equal(maths.find(exam => exam.key === 'waec').grounded, true)
  assert.equal(maths.find(exam => exam.key === 'neco').grounded, false)
  const chemistry = (await call('teacher', 'GET', '/api/material-ai/options?classId=ss2a&subjectId=chem')).body.exams.map(exam => exam.key)
  assert.ok(!chemistry.includes('ielts') && !chemistry.includes('toefl') && chemistry.includes('waec'))
  const english = (await call('other', 'GET', '/api/material-ai/options?classId=ss2a&subjectId=eng')).body.exams.map(exam => exam.key)
  assert.ok(english.includes('ielts') && english.includes('toefl'))
  const primary = (await call('teacher', 'GET', '/api/material-ai/options?classId=p4&subjectId=p4math')).body.exams.map(exam => exam.key)
  assert.deepEqual(primary, [], 'WAEC is not for Primary 4, and Common Entrance starts at Primary 5')
  // Asking for an exam that does not apply is refused.
  const refused = await call('teacher', 'POST', '/api/material-ai/drafts', { classId: 'ss2a', subjectId: 'chem', topic: 'Equilibrium', exams: ['ielts'], levelDecision: 'ungrounded' })
  assert.equal(refused.status, 400)
})

test('from request to published material: grounded, written in blocks, checked, illustrated and published by the teacher', async () => {
  const db = await setup()
  const log = []
  const uploads = fakeBucket()
  const call = caller(db, fakeModel(log), uploads)
  await publishedCurriculum(call)
  await publishedWaecMaths(call)
  const resolved = await call('teacher', 'POST', '/api/material-ai/resolve', { classId: 'ss2a', subjectId: 'math', topic: 'Quadratic Equations' })
  const created = await call('teacher', 'POST', '/api/material-ai/drafts', {
    classId: 'ss2a', subjectId: 'math', topic: 'Quadratic Equations', kind: 'study_note', length: 'detailed', exams: ['waec', 'neco'],
    curriculumTopicIds: [resolved.body.resolution.match.id], levelDecision: 'matched',
    options: ['explanation', 'definitions', 'worked_examples', 'common_mistakes', 'exam_tips', 'summary', 'images', 'tables', 'graphs', 'formulae', 'practice', 'objective', 'theory', 'answers', 'solutions'],
  })
  assert.equal(created.status, 201, JSON.stringify(created.body))
  const draftId = created.body.draft.id
  assert.deepEqual(created.body.draft.grounding.curriculum[0].objectives, ['solve quadratic equations by factorisation', 'apply the quadratic formula to real problems'])
  assert.equal(created.body.draft.grounding.exams.find(exam => exam.key === 'waec').topics[0].topic, 'Quadratic equations')
  // Subtopics from the curriculum split the core teaching.
  assert.ok(created.body.draft.sections.filter(section => section.key.startsWith('core_')).length >= 2)
  // Another teacher cannot drive this draft.
  assert.equal((await call('other', 'POST', `/api/material-ai/drafts/${draftId}/next`)).status, 403)

  let step
  let guard = 0
  do { step = await call('teacher', 'POST', `/api/material-ai/drafts/${draftId}/next`); guard += 1 } while (step.status === 200 && !step.body.done && guard < 20)
  assert.equal(step.status, 200, JSON.stringify(step.body))
  const draft = step.body.draft
  assert.equal(draft.status, 'ready')
  assert.ok(draft.sections.every(section => section.status === 'done'))
  assert.ok(!draft.blocks.some(block => block.type === 'spaceship'), 'unknown blocks are dropped')
  // Grounding reached the model: the objectives, the WAEC paper and the labelling rule.
  const sectionPrompt = log.find(entry => entry.user && /WRITE THIS SECTION NOW/.test(entry.user))
  assert.match(sectionPrompt.system, /apply the quadratic formula to real problems/)
  assert.match(sectionPrompt.system, /Paper 1 \(Objective\), 50 marks/)
  assert.match(sectionPrompt.system, /no specification on file/, 'NECO is flagged as unverified')
  assert.match(sectionPrompt.system, /WAEC\/NECO-style practice/)
  // Illustrations are drawn and stored, within the school's limit.
  const images = draft.blocks.filter(block => block.type === 'image')
  assert.ok(images.length >= 1 && images.length <= 4)
  assert.ok(images.every(block => block.url.startsWith('/files/material-ai/school-a/')))
  assert.equal(uploads.store.size, images.length)
  // Checks: curriculum covered; NECO unverified.
  const checks = Object.fromEntries(draft.validation.checks.map(check => [check.key, check.status]))
  assert.deepEqual([checks.curriculum, checks.claims, checks.consistency, checks.specs], ['pass', 'pass', 'pass', 'warn'])

  // The teacher edits a block; a broken table is refused.
  const edited = draft.blocks.map(block => (block.type === 'paragraph' ? { ...block, text: `${block.text} Edited by the teacher.` } : block))
  assert.equal((await call('teacher', 'PUT', `/api/material-ai/drafts/${draftId}/blocks`, { blocks: [...edited, { type: 'table', section: 'core_1', columns: ['a', 'b'], rows: [['1']] }] })).status, 400)
  const saved = await call('teacher', 'PUT', `/api/material-ai/drafts/${draftId}/blocks`, { blocks: edited })
  assert.equal(saved.status, 200, JSON.stringify(saved.body))
  // A second opinion from the model.
  const reviewed = await call('teacher', 'POST', `/api/material-ai/drafts/${draftId}/review`)
  assert.equal(reviewed.body.draft.review.findings[0].issue, 'Define the discriminant before using it.')

  const published = await call('teacher', 'POST', `/api/material-ai/drafts/${draftId}/publish`, { status: 'published', visibility: 'student_parent' })
  assert.equal(published.status, 201, JSON.stringify(published.body))
  const material = published.body.material
  const metadata = typeof material.metadata === 'string' ? JSON.parse(material.metadata) : material.metadata
  assert.equal(metadata.source, 'ndovera_ai')
  assert.equal(metadata.ai.label, 'Prepared with Ndovera AI · reviewed by t-math')
  assert.equal(metadata.ai.curriculumChecked, true)
  const types = new Set(metadata.blocks.map(block => block.type))
  for (const type of ['formula', 'table', 'figure', 'image', 'worked_example', 'question', 'common_mistake', 'exam_tip', 'definition']) assert.ok(types.has(type), `material has a ${type} block`)
  const question = metadata.blocks.find(block => block.type === 'question')
  assert.match(question.text, /WAEC\/NECO-style Practice Question/)
  assert.match(question.answer, /Answer:/)
  assert.ok(metadata.blocks.find(block => block.type === 'formula').text.startsWith('$$x=\\frac'))
  assert.match(metadata.blocks.find(block => block.type === 'figure').text, /^```figure\n\{"type":"function"/)
  assert.match(metadata.description, /Edited by the teacher/)
  // The student sees it in the class; the draft is closed.
  const list = await call('student', 'GET', '/api/classrooms/ss2a/materials')
  assert.ok(list.body.materials.some(item => item.id === material.id))
  assert.equal((await call('teacher', 'POST', `/api/material-ai/drafts/${draftId}/publish`, {})).status, 409)
})

test('claims of past questions and arithmetic slips block publishing until the teacher confirms', async () => {
  const db = await setup()
  const call = caller(db, fakeModel([], { claim: true, slip: true }))
  await publishedCurriculum(call)
  await publishedWaecMaths(call)
  const created = await call('teacher', 'POST', '/api/material-ai/drafts', { classId: 'ss2a', subjectId: 'math', topic: 'Quadratic Equations', kind: 'practice_questions', length: 'short', exams: ['waec'], levelDecision: 'ungrounded', options: ['practice', 'objective', 'theory', 'answers'] })
  const id = created.body.draft.id
  let step
  do { step = await call('teacher', 'POST', `/api/material-ai/drafts/${id}/next`) } while (step.status === 200 && !step.body.done)
  const checks = Object.fromEntries(step.body.draft.validation.checks.map(check => [check.key, check.status]))
  assert.deepEqual([checks.claims, checks.consistency, checks.curriculum], ['fail', 'fail', 'warn'])
  const blocked = await call('teacher', 'POST', `/api/material-ai/drafts/${id}/publish`, { status: 'published' })
  assert.deepEqual([blocked.status, blocked.body.needsAcknowledgement], [409, true])
  // Saving as a draft material is always allowed; publishing needs the teacher's confirmation.
  assert.equal((await call('teacher', 'POST', `/api/material-ai/drafts/${id}/publish`, { status: 'published', acknowledgeChecks: true })).status, 201)
})

test('a school can switch illustrations off, but never raise Ndovera\'s limits', async () => {
  const db = await setup()
  const log = []
  const call = caller(db, fakeModel(log))
  await call('ami', 'PUT', '/api/ami/material-ai/settings', { images: true, maxImages: 2 })
  const raised = await call('owner', 'PUT', '/api/school/material-ai/settings', { maxImages: 8 })
  assert.equal(raised.body.settings.maxImages, 2)
  assert.equal((await call('teacher', 'PUT', '/api/school/material-ai/settings', { images: false })).status, 403)
  await call('owner', 'PUT', '/api/school/material-ai/settings', { images: false })
  const created = await call('teacher', 'POST', '/api/material-ai/drafts', { classId: 'ss2a', subjectId: 'math', topic: 'Quadratic Equations', kind: 'lesson_note', length: 'short', levelDecision: 'ungrounded', options: ['explanation', 'images'] })
  let step
  do { step = await call('teacher', 'POST', `/api/material-ai/drafts/${created.body.draft.id}/next`) } while (step.status === 200 && !step.body.done)
  assert.ok(!step.body.draft.blocks.some(block => block.type === 'image'))
  assert.ok(!log.some(entry => entry.image), 'no illustration was requested')
  assert.ok(log.filter(entry => entry.system).every(entry => /Do not use image blocks/.test(entry.system)))
})

test('Exam Readiness comes from marked work against the specification, and says what is not yet assessed', async () => {
  const db = await setup()
  const call = caller(db)
  await publishedCurriculum(call)
  await publishedWaecMaths(call)
  db.db.exec(`
    CREATE TABLE IF NOT EXISTS assignments (id TEXT PRIMARY KEY, classId TEXT, title TEXT, description TEXT, dueAt TEXT, createdAt TEXT, subjectId TEXT, subjectName TEXT, format TEXT, questionPayload TEXT, metadata TEXT, createdBy TEXT, updatedAt TEXT);
    CREATE TABLE IF NOT EXISTS submissions (id TEXT PRIMARY KEY, assignmentId TEXT, studentId TEXT, content TEXT, submittedAt TEXT, grade REAL, gradedAt TEXT, feedback TEXT);
    INSERT INTO assignments (id, classId, title, subjectId, metadata) VALUES
      ('a1', 'ss2a', 'Quadratics quiz', 'math', '{"topic":"Quadratic Equations","totalMarks":20}'),
      ('a2', 'ss2a', 'Bearings test', 'math', '{"topic":"Bearings","totalMarks":10}'),
      ('a3', 'ss2a', 'Poetry', 'math', '{"topic":"Figures of speech","totalMarks":10}');
    INSERT INTO submissions (id, assignmentId, studentId, grade, content) VALUES
      ('x1', 'a1', 's-1', 18, '{}'), ('x2', 'a2', 's-1', 4, '{}'), ('x3', 'a3', 's-1', 9, '{}');
  `)
  const options = await call('student', 'GET', '/api/exam-readiness?classId=ss2a')
  assert.equal(options.status, 200, JSON.stringify(options.body))
  const maths = options.body.options.find(option => option.subjectId === 'math')
  assert.deepEqual(maths.exams.map(exam => exam.key), ['waec'], 'only examinations with a specification on file')
  const result = (await call('student', 'GET', '/api/exam-readiness?classId=ss2a&subjectId=math&exam=waec')).body.readiness
  const area = name => result.areas.find(item => item.area === name)
  assert.deepEqual([area('Algebra').percent, area('Trigonometry').percent, area('Statistics').percent], [90, 40, null])
  assert.deepEqual(result.attention.map(item => item.topic), ['Bearings'])
  assert.deepEqual(result.notAssessed.map(item => item.topic), ['Probability'])
  assert.equal(result.unmatched, 1)
  assert.equal((await call('student', 'GET', '/api/exam-readiness?classId=ss2a&subjectId=math&exam=neco')).status, 404)
})
