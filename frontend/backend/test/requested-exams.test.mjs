// Free AI limits Ami can change, a parent's one name change, and exams built on request:
// hidden until they have enough checked questions, then on sale where they were asked for.
import test from 'node:test'
import assert from 'node:assert/strict'
import { aiLimits, saveAiLimits, addExamTopics, buildingExamKeys, createCustomExam, listCustomExams, loadCustomExams, promoteReadyExams, updateCustomExam, chargeReportAi, ReportAiError, childNameChange, takeChildNameChange, BUNDLES, EXAMS, addExamStock, bundleList, examKeyOf, examStock, examsForSection, priceFor, createExamRequest, ensureExamRequestTables, planSources, ensureBuilderTables } from './build/requestedExams.mjs'
import { D1Shim } from './d1-shim.mjs'

const fresh = async () => { const db = new D1Shim(); await loadCustomExams(db, true); return db }
const KCSE = { label: 'KCSE', section: 'senior', country: 'Kenya', subjects: 'English, Mathematics', priceNaira: 2500, minStock: 60 }
const fill = async (db, key, each = 30) => { await addExamStock(db, key, 'english', each); await addExamStock(db, key, 'mathematics', each) }

test('Ami changes the free AI limits, and reports follow them', async () => {
  const db = new D1Shim()
  assert.deepEqual(await aiLimits(db), { freeAiPerDay: 1, freeReportsPerDay: 2, reportCredits: 50 })
  await assert.rejects(saveAiLimits(db, { freeAiPerDay: -1, freeReportsPerDay: 2, reportCredits: 50 }, 'ami'), /whole number/)
  await saveAiLimits(db, { freeAiPerDay: 3, freeReportsPerDay: 1, reportCredits: 20 }, 'ami')
  assert.equal((await aiLimits(db)).freeAiPerDay, 3)

  const person = { settingsKey: 'a@school.test', tenantId: 't1' }
  await chargeReportAi(db, person)
  await assert.rejects(chargeReportAi(db, person), error => error instanceof ReportAiError && /1 free AI reports[\s\S]*20 AI credits/.test(error.message))

  await saveAiLimits(db, { freeAiPerDay: 0, freeReportsPerDay: 0, reportCredits: 20 }, 'ami')
  const noFree = { settingsKey: 'b@school.test', tenantId: 't1' }
  await assert.rejects(chargeReportAi(db, noFree), /costs 20 AI credits/)
  const used = await db.prepare(`SELECT COUNT(*) AS n FROM ai_report_usage WHERE settings_key = ?`).bind(noFree.settingsKey).first()
  assert.equal(Number(used.n), 0, 'no free report was taken when none are allowed')
})

test('a child\'s name can be changed from a parent account once, whichever parent tries', async () => {
  const db = new D1Shim()
  const change = { tenantId: 't1', studentId: 's1', parentId: 'p1', oldName: 'Ada Obi', newName: 'Adaeze Obi' }
  assert.equal(await childNameChange(db, 's1'), null)
  assert.equal(await takeChildNameChange(db, change), true)
  assert.equal(await takeChildNameChange(db, { ...change, parentId: 'p2', newName: 'Ada O.' }), false)
  assert.equal((await childNameChange(db, 's1')).newName, 'Adaeze Obi')
  assert.equal(await takeChildNameChange(db, { ...change, studentId: 's2' }), true, 'each child has their own')
})

test('a requested exam is hidden and cannot be bought until it has enough checked questions', async () => {
  const db = await fresh()
  const { key } = await createCustomExam(db, KCSE, 'ami')
  assert.equal(key, 'x_kcse')
  assert.ok(buildingExamKeys().includes(key), 'the night builder writes for it')
  assert.ok(!examsForSection('senior', 'KE').includes(key))
  assert.ok(!bundleList('senior', {}, 'KE').some(item => item.key === key))
  const buy = { section: 'senior', students: 1, forSchool: false, offered: [] }
  await assert.rejects(priceFor(db, { bundle: key }, buy), /still being prepared/)

  assert.equal((await promoteReadyExams(db)).length, 0, 'no questions, no sale')
  await addExamStock(db, key, 'english', 60)
  assert.equal((await promoteReadyExams(db)).length, 0, 'mathematics has none, so it waits')
  assert.ok((await examStock(db))[key] < 60)
  await addExamStock(db, key, 'mathematics', 30)

  const ready = await promoteReadyExams(db)
  assert.equal(ready.length, 1)
  assert.ok(examsForSection('senior', 'KE').includes(key), 'on sale in Kenya')
  assert.ok(!examsForSection('senior', 'GH').includes(key), 'not shown in Ghana')
  assert.ok(!examsForSection('junior', 'KE').includes(key), 'not shown to another level')
  const stock = await examStock(db)
  const pass = bundleList('senior', stock, 'KE').find(item => item.key === key)
  assert.equal(pass.ready, true)
  assert.equal(pass.priceNaira, 2500)
  assert.equal((await priceFor(db, { bundle: key }, buy)).amountNaira, 2500)
  assert.equal(BUNDLES[key].scope, 'year')
})

test('an exam for everyone shows in every country, and stopping takes it off sale', async () => {
  const db = await fresh()
  const { key } = await createCustomExam(db, { ...KCSE, label: 'Global Maths Test', country: '' }, 'ami')
  await fill(db, key)
  await promoteReadyExams(db)
  assert.ok(examsForSection('senior', 'GH').includes(key))
  assert.ok(examsForSection('senior', '').includes(key))
  await updateCustomExam(db, key, { status: 'paused' })
  assert.ok(!examsForSection('senior', 'GH').includes(key))
  assert.ok(!buildingExamKeys().includes(key))
  assert.equal((await promoteReadyExams(db)).length, 0, 'a stopped exam does not go on sale by itself')
  await updateCustomExam(db, key, { status: 'building', priceNaira: 4000 })
  assert.equal((await promoteReadyExams(db)).length, 1)
  assert.equal(BUNDLES[key].priceNaira, 4000)
})

test('the people who asked are told, and their request says it is on sale', async () => {
  const db = await fresh()
  await ensureExamRequestTables(db)
  await createExamRequest(db, { userId: 'u1', name: 'Kofi', role: 'teacher', tenantId: 't1', schoolName: 'School' }, { examName: 'KCSE', scope: 'country', country: 'Kenya', section: 'senior', curriculumNote: 'A long enough list of the topics to teach.', confirmed: true }, null)
  const request = await db.prepare(`SELECT id FROM exam_requests`).first()
  const { key } = await createCustomExam(db, { ...KCSE, requestId: request.id }, 'ami')
  assert.equal((await db.prepare(`SELECT status FROM exam_requests`).first()).status, 'building')
  await fill(db, key)
  const [ready] = await promoteReadyExams(db)
  assert.deepEqual(ready.requesters, [{ userId: 'u1', tenantId: 't1' }])
  const after = await db.prepare(`SELECT status, ami_note FROM exam_requests`).first()
  assert.equal(after.status, 'ready')
  assert.match(after.ami_note, /on sale/)
})

test('the curriculum becomes topics the night builder plans for this exam, with no AI', async () => {
  const db = await fresh()
  await ensureBuilderTables(db)
  const { key } = await createCustomExam(db, { ...KCSE, label: 'BECE Ghana', country: 'Ghana', section: 'junior' }, 'ami')
  assert.equal(examKeyOf(key), key, 'its own key, not Nigerian BECE')
  const added = await addExamTopics(db, key, { subject: 'Mathematics', topics: '1. Fractions\n- Algebra\n\nx\nGeometry' }, 'ami')
  assert.equal(added.added, 3)
  await addExamTopics(db, key, { subject: 'Mathematics', topics: 'Statistics' }, 'ami')
  const specs = await db.prepare(`SELECT COUNT(*) AS n FROM exam_specs WHERE exam_key = ?`).bind(key).first()
  assert.equal(Number(specs.n), 1, 'more topics join the same subject')
  await planSources(db)
  const queued = await db.prepare(`SELECT exam, section, subject_key, COUNT(*) AS n FROM practice_build_queue WHERE exam = ? GROUP BY exam`).bind(key).first()
  assert.equal(Number(queued.n), 4)
  assert.equal(queued.section, 'junior')
  assert.equal(queued.subject_key, 'mathematics')
  const [listed] = await listCustomExams(db)
  assert.equal(listed.subjects[0].topics, 4)
})

test('reading the list costs one query until it goes stale, and missing tables are no error', async () => {
  const db = new D1Shim()
  await loadCustomExams(db, true)
  assert.ok(!Object.keys(EXAMS).some(key => key.startsWith('x_')))
  let queries = 0
  const prepare = db.prepare.bind(db)
  db.prepare = sql => { queries += 1; return prepare(sql) }
  for (let index = 0; index < 5; index += 1) await loadCustomExams(db)
  assert.equal(queries, 0)
  assert.deepEqual(await promoteReadyExams(db), [])
  assert.equal(queries, 1, 'a night with nothing waiting is one read')
})
