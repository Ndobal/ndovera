import test from 'node:test'
import assert from 'node:assert/strict'
import { sign } from '@tsndr/cloudflare-worker-jwt'
import { D1Shim, createLegacySchema } from './d1-shim.mjs'

// Practice passes and the night builder: what is free, what is paid, how payment is
// checked, the device and download limits, examination standards and mocks, and the
// bank that grows (and is checked) every night.

const SECRET = 'practice-passes-secret'
let worker
let generation = 0

const PEOPLE = {
  ss2: ['s-ss2', 'ss2@a.test', 'student', 'school-a', { classId: 'ss2a' }],
  jss1: ['s-jss1', 'jss1@a.test', 'student', 'school-a', { classId: 'jss1a' }],
  owner: ['o-1', 'owner@a.test', 'owner', 'school-a', {}],
  ami: ['ami-1', 'ami@ndovera.test', 'ami', '', {}],
}
const SUBJECTS = [['Mathematics', 'mathematics'], ['English Language', 'english'], ['Physics', 'physics'], ['Chemistry', 'chemistry'], ['Biology', 'biology']]

async function setup() {
  worker = (await import(`./build/worker.mjs?passes=${generation++}`)).default
  const db = new D1Shim()
  createLegacySchema(db)
  db.db.exec(`
    CREATE TABLE subjects (id TEXT PRIMARY KEY, tenantId TEXT, name TEXT, classId TEXT, teacherId TEXT, createdAt TEXT);
    CREATE TABLE tenants (id TEXT PRIMARY KEY, school_name TEXT);
    INSERT INTO tenants VALUES ('school-a', 'Genesis College');
    INSERT INTO classes (id, tenantId, name, arm) VALUES ('ss2a', 'school-a', 'SS 2', 'A'), ('jss1a', 'school-a', 'JSS 1', 'A');
  `)
  for (const [index, [name]] of SUBJECTS.entries()) db.db.prepare(`INSERT INTO subjects VALUES (?, 'school-a', ?, 'ss2a', 't', 'x')`).run(`ss-${index}`, name)
  db.db.exec(`INSERT INTO subjects VALUES ('j-m', 'school-a', 'Mathematics', 'jss1a', 't', 'x')`)
  for (const [id, email, role, tenant, extra] of Object.values(PEOPLE)) {
    await db.prepare('INSERT INTO users (id, email, name, role, tenantId, status) VALUES (?, ?, ?, ?, ?, ?)').bind(id, email, id, role, tenant, 'active').run()
    await db.prepare('INSERT INTO settings (studentId, payload) VALUES (?, ?)').bind(email, JSON.stringify({ name: id, email, role, tenantId: tenant, schoolId: tenant, status: 'active', ...extra })).run()
  }
  return db
}

// Flutterwave stand-in: checkout links, and a verification answer the test controls.
const flutterwave = { created: [], verify: {} }
function withFlutterwave(run) {
  const real = globalThis.fetch
  globalThis.fetch = async (input, init = {}) => {
    const href = typeof input === 'string' ? input : input.url
    if (href.startsWith('https://api.flutterwave.com/v3/payments')) {
      flutterwave.created.push(JSON.parse(init.body))
      return new Response(JSON.stringify({ status: 'success', data: { link: 'https://checkout.flutterwave.test/pay' } }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }
    if (href.startsWith('https://api.flutterwave.com/v3/transactions/verify_by_reference')) {
      const ref = new URL(href).searchParams.get('tx_ref')
      const answer = flutterwave.verify[ref] || { status: 'pending' }
      return new Response(JSON.stringify({ status: 'success', data: { tx_ref: ref, currency: 'NGN', id: 77, ...answer } }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }
    return real(input, init)
  }
  return Promise.resolve(run()).finally(() => { globalThis.fetch = real })
}

function model(calls) {
  let counter = 0
  return {
    run: async (_model, input) => {
      const system = String(input.messages?.[0]?.content || '')
      const user = String(input.messages?.[input.messages.length - 1]?.content || '')
      if (/chief examiner/i.test(system)) {
        calls.review += 1
        const ids = [...user.matchAll(/^ID: (\S+)/gm)].map(match => match[1])
        // First question upgraded, second rejected, the rest fine.
        return { response: JSON.stringify(ids.map((id, index) => index === 0
          ? { id, verdict: 'fix', prompt: `Improved question ${id}: what is 12 × 12?`, options: ['124', '144', '154', '164'], answerIndex: 1, explanation: '12 × 12 = 144.' }
          : index === 1 ? { id, verdict: 'reject', reason: 'two answers are correct' } : { id, verdict: 'ok' })) }
      }
      const slots = [...user.matchAll(/^\d+\. type "(\w+)", topic "([^"]+)", (\d+) mark/gm)]
      if (slots.length) {
        calls.generate += 1
        calls.lastSystem = system
        calls.lastUser = user
        return { response: JSON.stringify(slots.map(([, type, topic]) => {
          counter += 1
          const five = /five options|options A–E/.test(user) || /NECO/.test(user)
          return type === 'truefalse' ? { type, prompt: `Statement ${counter} about ${topic}.`, answer: 'True' } : { type, prompt: `Q${counter}: about ${topic}, which is right?`, options: five ? ['A1', 'B1', 'C1', 'D1', 'E1'].map(o => `${o}-${counter}`) : ['W', 'X', 'Y', 'Z'].map(o => `${o}-${counter}`), answerIndex: 0, workingSteps: ['Because.'] }
        })) }
      }
      return { response: '[]' }
    },
  }
}

async function call(db, person, method, path, body, env = {}, headers = {}) {
  const [id, , role, tenantId] = PEOPLE[person]
  const token = await sign({ id, role, roles: [role], tenantId, name: id, exp: Math.floor(Date.now() / 1000) + 600 }, SECRET)
  const response = await worker.fetch(new Request(`https://ndovera.com${path}`, {
    method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined,
  }), { APP_DB: db, JWT_SECRET: SECRET, FLUTTERWAVE_SECRET_KEY: 'flw-test', FLUTTERWAVE_WEBHOOK_HASH: 'hook-hash', ...env }, { waitUntil() {}, passThroughOnException() {} })
  return { status: response.status, body: await response.json().catch(() => ({})) }
}

/** Questions in the bank, checked, for an examination (what nightly building and checking produce). */
function stockExam(db, exam, subjectKey, count, section = 'senior') {
  const insert = db.db.prepare(`INSERT INTO question_bank (id, tenant_id, subject, class_level, type, prompt, normalized_prompt, question_hash, options_json, answer_json, status, source, created_at, updated_at,
    section, level_rank, subject_key, playable, difficulty, exam, quality) VALUES (?, 'global', ?, 'SS 3', 'mcq', ?, ?, ?, ?, '0', 'approved', 'test', ?, ?, ?, 12, ?, 1, 'external', ?, 'ok')`)
  const stamp = new Date().toISOString()
  for (let i = 0; i < count; i += 1) insert.run(`${exam}-${subjectKey}-${i}`, subjectKey, `${exam} ${subjectKey} question ${i}`, `${exam} ${subjectKey} question ${i}`, `${exam}-${subjectKey}-${i}`, JSON.stringify(exam === 'neco' ? ['a', 'b', 'c', 'd', 'e'] : ['a', 'b', 'c', 'd']), stamp, stamp, section, subjectKey, exam)
}

const dev = id => ({ 'X-Practice-Device': `device-${id}-0001` })

test('every subject free at school level, 10 questions a day across subjects; passes lift the limit; other subjects and examinations are paid; payments are checked and granted once', async () => {
  const db = await setup()
  await call(db, 'ami', 'GET', '/api/ami/practice/builder') // creates the tables
  db.db.exec(`INSERT INTO question_bank (id, tenant_id, subject, type, prompt, normalized_prompt, question_hash, options_json, answer_json, status, source, created_at, updated_at, section, level_rank, subject_key, playable)
    VALUES ('m1', 'school-a', 'Mathematics', 'mcq', 'What is 2 + 2?', 'what is 2 2', 'h-m1', '["3","4","5","6"]', '"4"', 'approved', 'test', 'x', 'x', 'senior', 11, 'mathematics', 1)`)
  const more = db.db.prepare(`INSERT INTO question_bank (id, tenant_id, subject, type, prompt, normalized_prompt, question_hash, options_json, answer_json, status, source, created_at, updated_at, section, level_rank, subject_key, playable)
    VALUES (?, 'school-a', ?, 'mcq', ?, ?, ?, '["a","b","c","d"]', '"a"', 'approved', 'test', 'x', 'x', 'senior', 11, ?, 1)`)
  for (let i = 0; i < 6; i += 1) more.run(`m-extra-${i}`, 'Mathematics', `Maths question ${i}?`, `maths question ${i}`, `h-mx-${i}`, 'mathematics')
  for (let i = 0; i < 6; i += 1) more.run(`p-${i}`, 'Physics', `Physics question ${i}?`, `physics question ${i}`, `h-p-${i}`, 'physics')
  await withFlutterwave(async () => {
    const home = await call(db, 'ss2', 'GET', '/api/practice-arena/home')
    assert.equal(home.status, 200, JSON.stringify(home.body))
    assert.deepEqual(home.body.levels.map(level => level.key), ['simple', 'intermediate', 'external:waec', 'external:neco', 'external:jamb'])
    assert.deepEqual(home.body.bundles.map(bundle => bundle.key), ['subject', 'all', 'ssce', 'jamb', 'super'])
    assert.ok(home.body.subjects.every(subject => subject.access === 'free'))
    assert.deepEqual([home.body.passes.freePerDay, home.body.passes.freeLeftToday], [10, 10])

    // Every subject is free, 10 questions a day across all of them, counted as they are served.
    const free = await call(db, 'ss2', 'GET', '/api/practice-arena/pack?subject=mathematics&difficulty=intermediate')
    assert.equal(free.status, 200, JSON.stringify(free.body))
    assert.ok(free.body.pack.validUntil)
    assert.deepEqual([free.body.pack.questions.length, free.body.pack.free.leftToday], [7, 3])
    const physics = await call(db, 'ss2', 'GET', '/api/practice-arena/pack?subject=physics&difficulty=simple')
    assert.equal(physics.status, 200, JSON.stringify(physics.body))
    assert.deepEqual([physics.body.pack.questions.length, physics.body.pack.free.leftToday], [3, 0])
    const spent = await call(db, 'ss2', 'GET', '/api/practice-arena/pack?subject=mathematics&difficulty=intermediate')
    assert.deepEqual([spent.status, spent.body.freeLimit], [429, true], 'asking again does not refill the day')
    assert.equal((await call(db, 'ss2', 'GET', '/api/practice-arena/home')).body.passes.freeLeftToday, 0)
    // Free practice never triggers paid AI generation.
    assert.equal((await call(db, 'ss2', 'POST', '/api/practice-arena/generate', { subject: 'mathematics', difficulty: 'intermediate' })).body.freeTier, true)

    // A Subject Pass: priced here, paid, checked with Flutterwave, granted once.
    assert.equal((await call(db, 'ss2', 'POST', '/api/practice-arena/passes/quote', { bundle: 'subject', subjectKey: 'mathematics' })).body.quote.amountNaira, 300)
    const checkout = await call(db, 'ss2', 'POST', '/api/practice-arena/passes/checkout', { bundle: 'subject', subjectKey: 'mathematics', amountNaira: 1 })
    assert.equal(checkout.status, 200, JSON.stringify(checkout.body))
    assert.equal(flutterwave.created.at(-1).amount, 300, 'the request cannot set the price')
    assert.equal((await call(db, 'ss2', 'POST', '/api/practice-arena/passes/verify', { txRef: checkout.body.txRef })).status, 402, 'not paid yet')
    flutterwave.verify[checkout.body.txRef] = { status: 'successful', amount: 300 }
    const paid = await call(db, 'ss2', 'POST', '/api/practice-arena/passes/verify', { txRef: checkout.body.txRef })
    assert.deepEqual([paid.status, paid.body.granted], [200, 1])
    assert.equal((await call(db, 'ss2', 'POST', '/api/practice-arena/passes/verify', { txRef: checkout.body.txRef })).body.granted, 0, 'granted once')
    // Paid content: a device is required, and at most two.
    assert.equal((await call(db, 'ss2', 'GET', '/api/practice-arena/pack?subject=mathematics&difficulty=intermediate')).status, 400)
    assert.equal((await call(db, 'ss2', 'GET', '/api/practice-arena/pack?subject=mathematics&difficulty=intermediate', null, {}, dev(1))).status, 200)
    assert.equal((await call(db, 'ss2', 'GET', '/api/practice-arena/pack?subject=mathematics&difficulty=intermediate', null, {}, dev(2))).status, 200)
    const third = await call(db, 'ss2', 'GET', '/api/practice-arena/pack?subject=mathematics&difficulty=intermediate', null, {}, dev(3))
    assert.deepEqual([third.status, third.body.deviceLimit], [403, true])
    assert.equal((await call(db, 'owner', 'POST', '/api/practice-arena/devices/clear', { studentId: 's-ss2' })).status, 200)
    assert.equal((await call(db, 'ss2', 'GET', '/api/practice-arena/pack?subject=mathematics&difficulty=intermediate', null, {}, dev(3))).status, 200)
    assert.equal((await call(db, 'ss2', 'POST', '/api/practice-arena/passes/quote', { bundle: 'subject', subjectKey: 'mathematics' })).status, 409, 'already held')

    // A payment for the wrong amount grants nothing.
    const all = await call(db, 'ss2', 'POST', '/api/practice-arena/passes/checkout', { bundle: 'all' })
    flutterwave.verify[all.body.txRef] = { status: 'successful', amount: 150 }
    assert.equal((await call(db, 'ss2', 'POST', '/api/practice-arena/passes/verify', { txRef: all.body.txRef })).body.paid, false)
    assert.equal((await call(db, 'ss2', 'GET', '/api/practice-arena/pack?subject=chemistry&difficulty=simple', null, {}, dev(3))).status, 429, 'still on the free daily limit')

    // Examinations: not for sale until the bank holds enough checked questions.
    assert.equal((await call(db, 'ss2', 'GET', '/api/practice-arena/pack?subject=mathematics&difficulty=external&exam=waec', null, {}, dev(3))).status, 402)
    const notReady = await call(db, 'ss2', 'POST', '/api/practice-arena/passes/quote', { bundle: 'ssce' })
    assert.deepEqual([notReady.status, notReady.body.notReady], [409, ['waec', 'neco']])
    assert.equal((await call(db, 'jss1', 'POST', '/api/practice-arena/passes/quote', { bundle: 'ssce' })).status, 400, 'senior passes are for SS students')
    stockExam(db, 'waec', 'mathematics', 300)
    stockExam(db, 'neco', 'mathematics', 300)
    assert.equal((await call(db, 'ami', 'POST', '/api/ami/practice/recount', {})).status, 200)
    const ssce = await call(db, 'ss2', 'POST', '/api/practice-arena/passes/checkout', { bundle: 'ssce' })
    assert.equal(ssce.body.amountNaira, 3000)
    // Settled by Flutterwave's webhook (checked with Flutterwave, not trusted from the payload).
    flutterwave.verify[ssce.body.txRef] = { status: 'successful', amount: 3000 }
    const hook = await worker.fetch(new Request('https://ndovera.com/api/webhooks/payments/flutterwave', { method: 'POST', headers: { 'verif-hash': 'hook-hash', 'Content-Type': 'application/json' }, body: JSON.stringify({ data: { tx_ref: ssce.body.txRef, status: 'successful', amount: 3000 } }) }),
      { APP_DB: db, JWT_SECRET: SECRET, FLUTTERWAVE_SECRET_KEY: 'flw-test', FLUTTERWAVE_WEBHOOK_HASH: 'hook-hash' }, { waitUntil() {}, passThroughOnException() {} })
    assert.equal(hook.status, 200)
    const waec = await call(db, 'ss2', 'GET', '/api/practice-arena/pack?subject=mathematics&difficulty=external&exam=waec', null, {}, dev(3))
    assert.equal(waec.status, 200, JSON.stringify(waec.body))
    assert.equal(waec.body.pack.questions.length, 60)
    assert.ok(waec.body.pack.questions.every(question => question.prompt.startsWith('waec ')), 'only WAEC-standard, checked questions')
    const neco = await call(db, 'ss2', 'GET', '/api/practice-arena/pack?subject=mathematics&difficulty=external&exam=neco', null, {}, dev(3))
    assert.ok(neco.body.pack.questions.every(question => question.options.length === 5))
    // A timed mock: the examination's length and time.
    const mock = await call(db, 'ss2', 'GET', '/api/practice-arena/mock?exam=waec&subject=mathematics', null, {}, dev(3))
    assert.deepEqual([mock.status, mock.body.minutes, mock.body.pack.questions.length], [200, 60, 50])
    assert.equal((await call(db, 'ss2', 'GET', '/api/practice-arena/mock?exam=jamb', null, {}, dev(3))).status, 402)

    // JAMB: Use of English + 3 chosen subjects; the full 180-question, 2-hour mock.
    assert.equal((await call(db, 'ss2', 'POST', '/api/practice-arena/passes/quote', { bundle: 'jamb', jambSubjects: ['mathematics', 'physics', 'chemistry'] })).status, 409, 'not ready yet')
    for (const key of ['english', 'mathematics', 'physics', 'chemistry']) stockExam(db, 'jamb', key, key === 'english' ? 120 : 80)
    await call(db, 'ami', 'POST', '/api/ami/practice/recount', {})
    assert.equal((await call(db, 'ss2', 'POST', '/api/practice-arena/passes/quote', { bundle: 'jamb', jambSubjects: ['mathematics'] })).status, 400, 'three subjects')
    const jamb = await call(db, 'ss2', 'POST', '/api/practice-arena/passes/checkout', { bundle: 'jamb', jambSubjects: ['mathematics', 'physics', 'chemistry'] })
    flutterwave.verify[jamb.body.txRef] = { status: 'successful', amount: 3000 }
    await call(db, 'ss2', 'POST', '/api/practice-arena/passes/verify', { txRef: jamb.body.txRef })
    const utme = await call(db, 'ss2', 'GET', '/api/practice-arena/mock?exam=jamb', null, {}, dev(3))
    assert.equal(utme.status, 200, JSON.stringify(utme.body))
    assert.deepEqual([utme.body.minutes, utme.body.sections.map(section => [section.subjectKey, section.available])], [120, [['english', 60], ['mathematics', 40], ['physics', 40], ['chemistry', 40]]])
    assert.equal(utme.body.pack.questions.length, 180)
    assert.equal((await call(db, 'ss2', 'GET', '/api/practice-arena/pack?subject=biology&difficulty=external&exam=jamb', null, {}, dev(3))).status, 402, 'JAMB covers the chosen subjects only')

    // The school buys for a whole class at 30% off.
    const school = await call(db, 'owner', 'POST', '/api/practice-arena/passes/quote', { bundle: 'all', classId: 'ss2a' })
    assert.equal(school.status, 400, 'no enrolled students this session')

    // Downloads per day are limited.
    db.db.prepare(`UPDATE practice_pack_log SET packs = 30 WHERE student_id = 's-ss2'`).run()
    assert.equal((await call(db, 'ss2', 'GET', '/api/practice-arena/pack?subject=mathematics&difficulty=intermediate', null, {}, dev(3))).status, 429)
  })
})

test('the night builder writes questions from syllabus topics and materials, continues each night, and checks and upgrades questions to their standard', async () => {
  const db = await setup()
  const calls = { generate: 0, review: 0 }
  const env = { AI: model(calls) }
  await call(db, 'ami', 'GET', '/api/ami/practice/builder', null, env)
  // Ami publishes the WAEC Mathematics syllabus (two topics) and a JAMB Physics topic.
  const stamp = new Date().toISOString()
  db.db.exec(`
    INSERT INTO exam_specs (id, exam_key, name, subject_key, subject, status, created_at, updated_at) VALUES ('sp1', 'WASSCE', 'WAEC Mathematics', 'mathematics', 'Mathematics', 'published', '${stamp}', '${stamp}'),
      ('sp2', 'UTME', 'JAMB Physics', 'physics', 'Physics', 'published', '${stamp}', '${stamp}'), ('sp3', 'NECO', 'Draft', 'chemistry', 'Chemistry', 'draft', '${stamp}', '${stamp}');
    INSERT INTO exam_spec_topics (id, spec_id, area, topic, objectives, position, created_at, updated_at) VALUES
      ('t1', 'sp1', 'Algebra', 'Quadratic equations', 'Solve by factorisation and formula', 1, '${stamp}', '${stamp}'),
      ('t2', 'sp1', 'Number', 'Indices and logarithms', '', 2, '${stamp}', '${stamp}'),
      ('t3', 'sp2', 'Mechanics', 'Motion', '', 1, '${stamp}', '${stamp}'),
      ('t4', 'sp3', 'x', 'Not published', '', 1, '${stamp}', '${stamp}');
  `)
  const step = () => call(db, 'ami', 'POST', '/api/ami/practice/builder/step', {}, env)
  const first = await step()
  assert.equal(first.status, 200, JSON.stringify(first.body))
  assert.equal(first.body.result.added, 8)
  // Written to the examination's standard, from the syllabus.
  assert.match(calls.lastUser, /WAEC West African Senior School Certificate Examination|UTME/)
  assert.match(calls.lastUser, /Solve by factorisation and formula|Motion/)
  let overview = (await call(db, 'ami', 'GET', '/api/ami/practice/builder', null, env)).body
  assert.equal(overview.queue.reduce((sum, row) => sum + row.items, 0), 3, 'draft syllabuses are not used')
  // Each step goes to the least-served examination topic: every topic gets its first batch before any gets a second.
  await step()
  const third = await step() // every third step is a quality check
  assert.equal(third.body.result.reviewed, 10)
  assert.deepEqual([third.body.result.upgraded, third.body.result.rejected], [1, 1])
  const made = db.db.prepare(`SELECT made FROM practice_build_queue`).all().map(row => row.made).sort()
  assert.deepEqual(made, [0, 8, 8])
  await step()
  assert.deepEqual(db.db.prepare(`SELECT source_id, made FROM practice_build_queue ORDER BY source_id`).all().map(row => row.made), [8, 8, 8])
  // Stored for its examination, in Ndovera's bank; the checked ones count as stock.
  const rows = db.db.prepare(`SELECT exam, quality, playable, prompt FROM question_bank WHERE origin_type LIKE 'ndovera_builder:%'`).all()
  assert.equal(rows.length, 24)
  assert.ok(rows.filter(row => row.exam === 'waec').length === 16 && rows.filter(row => row.exam === 'jamb').length === 8)
  assert.equal(rows.filter(row => row.quality === 'upgraded').length, 1)
  assert.ok(rows.some(row => row.quality === 'upgraded' && /Improved question/.test(row.prompt)))
  assert.equal(rows.filter(row => row.quality === 'rejected' && row.playable === 0).length, 1)
  overview = (await call(db, 'ami', 'GET', '/api/ami/practice/builder', null, env)).body
  assert.equal(Object.values(overview.stock).reduce((sum, value) => sum + value, 0), 9, 'ok + upgraded')
  assert.equal(overview.nights[0].steps, 4)
  // Ami sets the nightly budget; outside the night window the cron does nothing.
  assert.deepEqual((await call(db, 'ami', 'PUT', '/api/ami/practice/builder', { batchesPerNight: 40 }, env)).body.settings.batchesPerNight, 40)
  assert.equal((await call(db, 'ss2', 'PUT', '/api/ami/practice/builder', { batchesPerNight: 4000 }, env)).status, 403)
})
