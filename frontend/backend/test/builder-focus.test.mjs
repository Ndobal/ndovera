// Ami can pause the night job, or point it at one exam or class. A focus changes the order, never the nightly limit.
import test from 'node:test'
import assert from 'node:assert/strict'
import { D1Shim } from './d1-shim.mjs'
import { builderOverview, clearBuildFocus, ensureBuilderTables, getBuildSettings, loadCustomExams, nextQueueItem, runBuilderTick, saveBuildSettings, setBuildFocus } from './build/requestedExams.mjs'

const NIGHT = new Date('2026-11-07T23:30:00.000Z') // a Sunday, 00:30 in Lagos

async function setup() {
  const db = new D1Shim()
  await ensureBuilderTables(db)
  await loadCustomExams(db, true)
  const add = (id, exam, rank, subject, priority, status = 'pending') => db.db.prepare(`INSERT INTO practice_build_queue (id, source_type, source_id, subject_key, subject_name, section, level_rank, difficulty, exam, topic, target, made, priority, status, created_at, updated_at) VALUES (?, 'exam_topic', ?, ?, ?, 'senior', ?, 'external', ?, 'Topic', 40, 0, ?, ?, 'x', 'x')`).run(id, id, subject, subject, rank, exam, priority, status)
  add('jamb1', 'jamb', 12, 'english', 1)
  add('waec1', 'waec', 12, 'english', 1)
  add('waec2', 'waec', 12, 'physics', 1)
  add('class8', null, 8, 'mathematics', 5)
  add('class9', null, 9, 'mathematics', 5)
  add('waecDone', 'waec', 12, 'english', 1, 'done')
  return db
}
const priorities = db => Object.fromEntries(db.db.prepare(`SELECT id, priority FROM practice_build_queue`).all().map(row => [row.id, row.priority]))

test('pausing stops the night job, and resuming starts it again', async () => {
  const db = await setup()
  let calls = 0
  const runAi = async () => { calls += 1; return '[]' }
  await saveBuildSettings(db, { paused: true })
  const stopped = await runBuilderTick(db, runAi, { at: NIGHT })
  assert.match(stopped.skipped, /paused/)
  assert.equal(calls, 0)
  assert.equal((await getBuildSettings(db)).batchesPerNight, 12, 'the nightly limit is kept')

  await saveBuildSettings(db, { batchesPerNight: 5 })
  assert.equal((await getBuildSettings(db)).paused, true, 'saving the limit does not resume it')
  await saveBuildSettings(db, { paused: false })
  const running = await runBuilderTick(db, runAi, { at: NIGHT })
  assert.equal(running.skipped, undefined)
  assert.ok(calls > 0)
})

test('a focus on an exam writes only for it, and removing the focus restores the queue', async () => {
  const db = await setup()
  const before = priorities(db)
  const { focus, marked } = await setBuildFocus(db, { exam: 'waec' })
  assert.equal(marked, 2)
  assert.equal((await nextQueueItem(db, focus)).exam, 'waec')
  await clearBuildFocus(db)
  assert.deepEqual(priorities(db), before)
  assert.equal((await getBuildSettings(db)).focus, null)
})

test('a focus can be one subject of an exam, or one class level', async () => {
  const db = await setup()
  const subject = await setBuildFocus(db, { exam: 'waec', subject: 'Physics' })
  assert.equal(subject.marked, 1)
  assert.equal((await nextQueueItem(db, subject.focus)).id, 'waec2')
  assert.match(subject.focus.label, /Physics/)

  const level = await setBuildFocus(db, { rank: 8 })
  assert.equal(level.marked, 1, 'the earlier focus was undone first')
  assert.equal((await nextQueueItem(db, level.focus)).id, 'class8')
  assert.equal(priorities(db).waec2, 1)
})

test('a focus with nothing waiting says so, and changes nothing', async () => {
  const db = await setup()
  const before = priorities(db)
  await assert.rejects(setBuildFocus(db, { exam: 'bece' }), /Nothing is waiting/)
  await assert.rejects(setBuildFocus(db, { exam: 'nope' }), /not found/)
  await assert.rejects(setBuildFocus(db, {}), /Choose an exam/)
  assert.deepEqual(priorities(db), before)
  assert.equal((await getBuildSettings(db)).focus, null)
})

test('when the focus runs out, the job goes back to taking turns by itself', async () => {
  const db = await setup()
  const { focus } = await setBuildFocus(db, { rank: 9 })
  db.db.prepare(`UPDATE practice_build_queue SET status = 'done' WHERE id = 'class9'`).run()
  const next = await nextQueueItem(db, focus)
  assert.notEqual(next.id, 'class9')
  assert.equal((await getBuildSettings(db)).focus, null)
})

test('a focus keeps to the nightly limit', async () => {
  const db = await setup()
  await saveBuildSettings(db, { batchesPerNight: 2 })
  await setBuildFocus(db, { exam: 'waec' })
  let calls = 0
  const runAi = async () => { calls += 1; return '[]' }
  for (let step = 0; step < 5; step += 1) await runBuilderTick(db, runAi, { at: NIGHT })
  assert.ok(calls <= 2, `${calls} calls`)
})

test('the next focused topic is one row from the queue index, with no sorting', async () => {
  const db = await setup()
  await setBuildFocus(db, { exam: 'waec' })
  const plan = db.db.prepare(`EXPLAIN QUERY PLAN SELECT * FROM practice_build_queue WHERE status = 'pending' AND priority < 0 ORDER BY priority, made, updated_at LIMIT 1`).all().map(row => row.detail).join(' ')
  assert.match(plan, /idx_practice_build_pick/, plan)
  assert.doesNotMatch(plan, /TEMP B-TREE/, plan)
  const overview = await builderOverview(db)
  assert.deepEqual(overview.focusProgress, { items: 2, target: 80, made: 0 })
  assert.ok(overview.examChoices.some(item => item.key === 'waec'))
  assert.equal(overview.levelChoices.find(item => item.rank === 8).label, 'JSS 2')
})
