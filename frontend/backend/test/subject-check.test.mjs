import test from 'node:test'
import assert from 'node:assert/strict'
import { D1Shim } from './d1-shim.mjs'

// Questions stay in their own subject: ICT questions filed under Agricultural Science move to
// Computer Studies, questions of no known subject are held back, students can report one,
// and subject names are only joined when the names themselves agree.

const { namesCanMatch, checkQuestionSubjects, reportQuestionSubject, parseSubjectVerdicts, takeNightBatch, SUBJECT_SERVABLE_SQL } = await import('./build/subjectCheck.mjs')

function bank() {
  const db = new D1Shim()
  db.db.exec(`
    CREATE TABLE question_bank (id TEXT PRIMARY KEY, subject TEXT, subject_key TEXT, type TEXT, prompt TEXT, options_json TEXT, class_level TEXT, playable INTEGER, updated_at TEXT);
    CREATE TABLE practice_bank_counts (subject_key TEXT, section TEXT, level_rank INTEGER, difficulty TEXT, total INTEGER, updated_at TEXT);
    INSERT INTO practice_bank_counts (subject_key, total) VALUES ('agricultural-science', 10), ('computer-studies', 10), ('mathematics', 10);
    INSERT INTO question_bank (id, subject, subject_key, type, prompt, options_json, class_level, playable) VALUES
      ('q1', 'Agricultural Science', 'agricultural-science', 'mcq', 'Which of these is an input device?', '["Keyboard","Monitor","Printer","Speaker"]', 'JSS 2', 1),
      ('q2', 'Agricultural Science', 'agricultural-science', 'mcq', 'Which crop is a legume?', '["Cowpea","Maize","Yam","Cassava"]', 'JSS 2', 1),
      ('q3', 'Agricultural Science', 'agricultural-science', 'mcq', 'Who wrote Things Fall Apart?', '["Achebe","Soyinka","Clark","Okigbo"]', 'JSS 2', 1),
      ('q4', 'Agricultural Science', 'agricultural-science', 'mcq', 'Name a farm tool.', '["Hoe","Pen","Cup","Ball"]', 'JSS 2', 0);
  `)
  return db
}

test('subject names are joined only when the names agree', () => {
  assert.equal(namesCanMatch('agric-sci', 'agricultural-science'), true)
  assert.equal(namesCanMatch('crs', 'christian-religious-studies'), true)
  assert.equal(namesCanMatch('general-maths', 'mathematics'), true)
  // The model once could have joined these; the names do not support it.
  assert.equal(namesCanMatch('agricultural-science', 'computer-studies'), false)
  assert.equal(namesCanMatch('agricultural-science', 'computer-science'), false)
  assert.equal(namesCanMatch('further-mathematics', 'mathematics'), false)
  assert.equal(namesCanMatch('further-maths', 'mathematics'), false)
  assert.equal(namesCanMatch('further-maths', 'further-mathematics'), true)
  assert.equal(namesCanMatch('home-economics', 'economics'), false)
  assert.equal(namesCanMatch('physics', 'physical-education'), false)
  assert.equal(namesCanMatch('computer-studies', 'agricultural-science'), false)
  assert.equal(namesCanMatch('basic-science', 'agricultural-science'), false)
})

test('the check moves a question to its real subject, holds one of no known subject, and passes the rest', async () => {
  const db = bank()
  let asked = ''
  const runAi = async messages => {
    asked = messages[1].content
    return JSON.stringify([
      { id: 'q1', belongs: 'no', subject: 'computer-studies' },
      { id: 'q2', belongs: 'yes' },
      { id: 'q3', belongs: 'no', subject: 'none' },
    ])
  }
  const result = await checkQuestionSubjects(db, runAi)
  assert.deepEqual(result, { checked: 3, ok: 1, moved: 1, held: 1 })
  assert.match(asked, /Filed under: agricultural-science/)
  assert.doesNotMatch(asked, /farm tool/, 'questions that cannot be played are not checked')
  const rows = Object.fromEntries(db.db.prepare('SELECT id, subject_key, subject_check, subject_from FROM question_bank').all().map(row => [row.id, row]))
  assert.deepEqual([rows.q1.subject_key, rows.q1.subject_check, rows.q1.subject_from], ['computer-studies', 'moved', 'agricultural-science'])
  assert.equal(rows.q2.subject_check, 'ok')
  assert.deepEqual([rows.q3.subject_key, rows.q3.subject_check], ['agricultural-science', 'wrong'])
  // Practice serves the moved and passed questions, never the held one.
  const servable = db.db.prepare(`SELECT id FROM question_bank q WHERE ${SUBJECT_SERVABLE_SQL('q')} AND playable = 1 ORDER BY id`).all().map(row => row.id)
  assert.deepEqual(servable, ['q1', 'q2'])
  // Checked questions are not asked about again.
  assert.deepEqual(await checkQuestionSubjects(db, async () => '[]'), { checked: 0, ok: 0, moved: 0, held: 0 })
})

test('two students, or one teacher, hold a reported question until it is checked again', async () => {
  const db = bank()
  await checkQuestionSubjects(db, async () => JSON.stringify([{ id: 'q1', belongs: 'yes' }, { id: 'q2', belongs: 'yes' }, { id: 'q3', belongs: 'yes' }]))
  assert.equal((await reportQuestionSubject(db, { questionId: 'q1', reporterId: 's1', role: 'student', tenantId: 't' })).held, false)
  assert.equal((await reportQuestionSubject(db, { questionId: 'q1', reporterId: 's1', role: 'student', tenantId: 't' })).held, false, 'the same student counts once')
  assert.equal((await reportQuestionSubject(db, { questionId: 'q1', reporterId: 's2', role: 'student', tenantId: 't' })).held, true)
  assert.equal((await reportQuestionSubject(db, { questionId: 'q2', reporterId: 't1', role: 'teacher', tenantId: 't' })).held, true)
  assert.equal((await reportQuestionSubject(db, { questionId: 'nope', reporterId: 's1', role: 'student', tenantId: 't' })).found, false)
  const state = () => Object.fromEntries(db.db.prepare('SELECT id, subject_key, subject_check FROM question_bank').all().map(row => [row.id, row]))
  assert.deepEqual([state().q1.subject_check, state().q2.subject_check, state().q3.subject_check], ['reported', 'reported', 'ok'])
  // The day-time run looks only at reported questions: q1 really is ICT, q2 is fine after all.
  const result = await checkQuestionSubjects(db, async () => JSON.stringify([{ id: 'q1', belongs: 'no', subject: 'computer-studies' }, { id: 'q2', belongs: 'yes' }]), { reportedOnly: true })
  assert.deepEqual([result.moved, result.ok], [1, 1])
  assert.deepEqual([state().q1.subject_key, state().q1.subject_check, state().q2.subject_check], ['computer-studies', 'moved', 'ok'])
  assert.equal(db.db.prepare('SELECT COUNT(*) AS n FROM question_subject_reports').get().n, 0)
})

test('only well-formed verdicts for questions that were asked are used', () => {
  const verdicts = parseSubjectVerdicts('Here you go: ```json\n[{"id":"q1","belongs":"NO","subject":"Computer-Studies"},{"id":"zz","belongs":"yes"},{"id":"q2","belongs":"maybe"}]```', ['q1', 'q2'])
  assert.deepEqual([...verdicts], [['q1', { belongs: 'no', subject: 'computer-studies' }]])
  assert.equal(parseSubjectVerdicts('not json', ['q1']).size, 0)
})

test('the check keeps within its nightly allowance (the AI budget is shared with the night builder)', async () => {
  const db = bank()
  const taken = []
  for (let index = 0; index < 4; index += 1) taken.push(await takeNightBatch(db, '2026-10-24', 3))
  assert.deepEqual(taken, [true, true, true, false])
  assert.equal(await takeNightBatch(db, '2026-10-25', 3), true, 'a new night has a fresh allowance')
})
