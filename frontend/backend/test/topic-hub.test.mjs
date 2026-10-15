import test from 'node:test'
import assert from 'node:assert/strict'
import { sign } from '@tsndr/cloudflare-worker-jwt'
import { D1Shim, createLegacySchema } from './d1-shim.mjs'

const SECRET = 'topic-test-secret'
let worker
let generation = 0

const PEOPLE = {
  teacher: ['t-math', 'math@a.test', 'teacher', 'school-a', {}],
  other: ['t-eng', 'eng@a.test', 'teacher', 'school-a', {}],
  student: ['s-1', 'pupil@a.test', 'student', 'school-a', { classId: 'jss1a' }],
  outsider: ['o-b', 'owner@b.test', 'owner', 'school-b', {}],
}

async function setup() {
  worker = (await import(`./build/worker.mjs?topics=${generation++}`)).default
  const db = new D1Shim()
  createLegacySchema(db)
  db.db.exec(`
    CREATE TABLE subjects (id TEXT PRIMARY KEY, tenantId TEXT, name TEXT, classId TEXT, teacherId TEXT, createdAt TEXT);
    CREATE TABLE tenants (id TEXT PRIMARY KEY, school_name TEXT);
    INSERT INTO tenants VALUES ('school-a', 'Bright Future School'), ('school-b', 'Other');
    INSERT INTO classes (id, tenantId, name, arm) VALUES ('jss1a', 'school-a', 'JSS 1', 'A');
    INSERT INTO subjects VALUES ('math', 'school-a', 'Mathematics', 'jss1a', 't-math', 'x'), ('eng', 'school-a', 'English', 'jss1a', 't-eng', 'x');
    CREATE TABLE materials (id TEXT PRIMARY KEY, classId TEXT, title TEXT, url TEXT, metadata TEXT, uploadedAt TEXT, uploadedBy TEXT);
  `)
  for (const [id, email, role, tenant, extra] of Object.values(PEOPLE)) {
    await db.prepare('INSERT INTO users (id, email, name, role, tenantId, status) VALUES (?, ?, ?, ?, ?, ?)').bind(id, email, id, role, tenant, 'active').run()
    await db.prepare('INSERT INTO settings (studentId, payload) VALUES (?, ?)').bind(email, JSON.stringify({ name: id, email, role, tenantId: tenant, schoolId: tenant, status: 'active', ...extra })).run()
  }
  return db
}

function makeEnv(db, seen = []) {
  return {
    APP_DB: db, JWT_SECRET: SECRET,
    AI: { run: async (_model, input) => { seen.push(input.messages); return { response: '# Fractions\nDefinition: A fraction is part of a whole.' } } },
  }
}

async function call(db, person, method, path, body, env) {
  const [id, , role, tenantId] = PEOPLE[person]
  const token = await sign({ id, role, roles: [role], tenantId, name: id, exp: Math.floor(Date.now() / 1000) + 600 }, SECRET)
  const response = await worker.fetch(new Request(`https://ndovera.com${path}`, {
    method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
  }), env || makeEnv(db), { waitUntil() {}, passThroughOnException() {} })
  return { status: response.status, body: await response.json().catch(() => ({})) }
}

const material = (db, id, topic, extra = {}) => db.prepare('INSERT INTO materials (id, classId, title, url, metadata, uploadedAt, uploadedBy) VALUES (?, ?, ?, ?, ?, ?, ?)')
  .bind(id, 'jss1a', id, null, JSON.stringify({ subjectId: 'math', topic, visibility: 'student_parent', description: 'A fraction shows parts of a whole, like 3/4.', ...extra }), '2026-10-01T00:00:00Z', 't-math').run()

test('teachers build topics for their own subject; students see only published ones', async () => {
  const db = await setup()
  const created = await call(db, 'teacher', 'POST', '/api/classrooms/jss1a/topics', { subjectId: 'math', name: 'Fractions', description: 'Parts of a whole', week: 'Week 4', objectives: 'Name fractions\nCompare fractions' })
  assert.equal(created.status, 201)
  assert.deepEqual(created.body.topic.objectives, ['Name fractions', 'Compare fractions'])
  await call(db, 'teacher', 'POST', '/api/classrooms/jss1a/topics', { subjectId: 'math', name: 'Algebra', status: 'draft' })

  assert.equal((await call(db, 'other', 'POST', '/api/classrooms/jss1a/topics', { subjectId: 'math', name: 'Sneaky' })).status, 403)
  assert.equal((await call(db, 'outsider', 'GET', '/api/classrooms/jss1a/topics')).status, 404)

  const studentView = await call(db, 'student', 'GET', '/api/classrooms/jss1a/topics?subjectId=math')
  assert.deepEqual(studentView.body.topics.map(topic => topic.name), ['Fractions'])
  const teacherView = await call(db, 'teacher', 'GET', '/api/classrooms/jss1a/topics?subjectId=math')
  assert.deepEqual(teacherView.body.topics.map(topic => topic.name), ['Fractions', 'Algebra'])

  const audit = await db.prepare("SELECT action FROM topic_audit WHERE topic_id = ?").bind(created.body.topic.id).all()
  assert.ok(audit.results.some(row => row.action === 'created'))
})

test('a topic page gathers its content and renaming carries older content along', async () => {
  const db = await setup()
  const topic = (await call(db, 'teacher', 'POST', '/api/classrooms/jss1a/topics', { subjectId: 'math', name: 'Fractions' })).body.topic
  await material(db, 'notes', 'fractions')
  await material(db, 'private', 'Fractions', { visibility: 'teacher' })

  const hub = await call(db, 'student', 'GET', `/api/classrooms/jss1a/topics/${topic.id}/hub`)
  assert.equal(hub.status, 200)
  assert.deepEqual(hub.body.materials.map(item => item.id), ['notes'])
  assert.equal(hub.body.progress.label, 'Not Started')

  assert.equal((await call(db, 'student', 'POST', `/api/classrooms/jss1a/topics/${topic.id}/progress`, { event: 'material_viewed', materialId: 'notes' })).status, 200)
  const after = await call(db, 'student', 'GET', `/api/classrooms/jss1a/topics/${topic.id}/hub`)
  assert.equal(after.body.progress.label, 'Materials Viewed')

  await call(db, 'teacher', 'PUT', `/api/classrooms/jss1a/topics/${topic.id}`, { name: 'Fractions and Decimals' })
  const meta = JSON.parse((await db.prepare("SELECT metadata FROM materials WHERE id = 'notes'").first()).metadata)
  assert.deepEqual([meta.topic, meta.topicId], ['Fractions and Decimals', topic.id])
})

test('removing a topic with content asks first, then moves or unassigns — never deletes', async () => {
  const db = await setup()
  const fractions = (await call(db, 'teacher', 'POST', '/api/classrooms/jss1a/topics', { subjectId: 'math', name: 'Fractions' })).body.topic
  const numbers = (await call(db, 'teacher', 'POST', '/api/classrooms/jss1a/topics', { subjectId: 'math', name: 'Numbers' })).body.topic
  await material(db, 'chart', 'Fractions')

  const blocked = await call(db, 'teacher', 'DELETE', `/api/classrooms/jss1a/topics/${fractions.id}`)
  assert.equal(blocked.status, 409)
  assert.equal(blocked.body.content.materials, 1)

  assert.equal((await call(db, 'teacher', 'DELETE', `/api/classrooms/jss1a/topics/${fractions.id}?contentAction=move&targetTopicId=${numbers.id}`)).status, 200)
  const moved = JSON.parse((await db.prepare("SELECT metadata FROM materials WHERE id = 'chart'").first()).metadata)
  assert.deepEqual([moved.topic, moved.topicId], ['Numbers', numbers.id])

  assert.equal((await call(db, 'teacher', 'DELETE', `/api/classrooms/jss1a/topics/${numbers.id}?contentAction=unassign`)).status, 200)
  const unassigned = JSON.parse((await db.prepare("SELECT metadata FROM materials WHERE id = 'chart'").first()).metadata)
  assert.equal(unassigned.topic, '')
  assert.equal(unassigned.topicId, undefined)
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM materials').first()).n, 1)
})

test('Study with Ndovera AI carries the topic and the teacher notes, marked as the teacher\'s', async () => {
  const db = await setup()
  const topic = (await call(db, 'teacher', 'POST', '/api/classrooms/jss1a/topics', { subjectId: 'math', name: 'Fractions', objectives: ['Compare fractions'] })).body.topic
  await material(db, 'notes', 'Fractions')
  const seen = []
  const env = makeEnv(db, seen)
  const reply = await call(db, 'student', 'POST', '/api/ai/tutor/ask', {
    prompt: 'Give me another example', topicContext: { classId: 'jss1a', topicId: topic.id },
    messages: [{ role: 'user', content: 'Explain equivalent fractions.' }, { role: 'assistant', content: 'Equivalent fractions are equal.' }],
  }, env)
  assert.equal(reply.status, 200, JSON.stringify(reply.body))
  assert.equal(reply.body.topic.topicName, 'Fractions')
  const context = seen[0].find(message => message.role === 'system' && message.content.includes('LEARNING CONTEXT'))
  assert.match(context.content, /Subject: Mathematics\. Topic: Fractions/)
  assert.match(context.content, /TEACHER-PROVIDED NOTES/)
  assert.match(context.content, /A fraction shows parts of a whole/)
  // The earlier turns travel with the follow-up, so "another example" stays on Fractions.
  assert.ok(seen[0].some(message => message.content === 'Explain equivalent fractions.'))

  // A student cannot point the AI at another class's topic.
  assert.equal((await call(db, 'outsider', 'POST', '/api/ai/tutor/ask', { prompt: 'hi', topicContext: { classId: 'jss1a', topicId: topic.id } }, env)).status, 404)
})

test('a teacher imports the term topics from the Ndovera curriculum as drafts, edits, then publishes them', async () => {
  const db = await setup()
  db.db.exec(`
    CREATE TABLE curricula (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL DEFAULT '', name TEXT NOT NULL, country TEXT, system TEXT, version TEXT,
      source TEXT, notes TEXT, status TEXT NOT NULL DEFAULT 'draft', created_by TEXT, created_at TEXT, updated_at TEXT, published_at TEXT);
    CREATE TABLE curriculum_topics (id TEXT PRIMARY KEY, curriculum_id TEXT NOT NULL, class_key TEXT, class_label TEXT, class_order INTEGER DEFAULT 0, section TEXT,
      subject_key TEXT, subject TEXT, theme TEXT, topic TEXT NOT NULL, subtopics TEXT, objectives TEXT, competencies TEXT, keywords TEXT,
      term TEXT, week TEXT, position INTEGER DEFAULT 0, created_at TEXT, updated_at TEXT);
    INSERT INTO curricula (id, tenant_id, name, status) VALUES ('nerdc', '', 'NERDC CURRICULUM', 'published'), ('draftcur', '', 'Unfinished', 'draft');
    INSERT INTO curriculum_topics (id, curriculum_id, class_key, class_label, class_order, section, subject_key, subject, topic, subtopics, objectives, term, week, position) VALUES
      ('t1', 'nerdc', 'JSS1', 'JSS 1', 21, 'junior', 'mathematics', 'Mathematics', 'Whole Numbers', '["Place value","Ordering"]', '[]', '1', '1', 1),
      ('t2', 'nerdc', 'JSS1', 'JSS 1', 21, 'junior', 'mathematics', 'Mathematics', 'LCM', '[]', '["find the LCM of numbers"]', '1', '2', 2),
      ('t3', 'nerdc', 'JSS1', 'JSS 1', 21, 'junior', 'mathematics', 'Mathematics', 'Simple Equations', '[]', '[]', '3', '1', 3),
      ('t4', 'nerdc', 'JSS2', 'JSS 2', 22, 'junior', 'mathematics', 'Mathematics', 'Linear Inequalities', '[]', '[]', '1', '1', 4),
      ('t5', 'nerdc', 'JSS1', 'JSS 1', 21, 'junior', 'english', 'English Language', 'Nouns', '[]', '[]', '1', '1', 5),
      ('t6', 'draftcur', 'JSS1', 'JSS 1', 21, 'junior', 'mathematics', 'Mathematics', 'Hidden Draft Topic', '[]', '[]', '1', '1', 6);
  `)
  await call(db, 'teacher', 'POST', '/api/classrooms/jss1a/topics', { subjectId: 'math', name: 'LCM' })

  const list = await call(db, 'teacher', 'GET', '/api/classrooms/jss1a/topics/curriculum?subjectId=math')
  assert.equal(list.status, 200, JSON.stringify(list.body))
  assert.equal(list.body.level, 'JSS 1')
  assert.deepEqual(list.body.topics.map(topic => [topic.topic, topic.term, topic.added]), [['Whole Numbers', '1', false], ['LCM', '1', true], ['Simple Equations', '3', false]])

  // Another teacher's subject, a student and another school cannot use it.
  assert.equal((await call(db, 'other', 'GET', '/api/classrooms/jss1a/topics/curriculum?subjectId=math')).status, 403)
  assert.equal((await call(db, 'student', 'POST', '/api/classrooms/jss1a/topics/import-curriculum', { subjectId: 'math', curriculumTopicIds: ['t1'] })).status, 403)

  // Rows of another level, subject or an unpublished curriculum are ignored; an existing name is skipped.
  const imported = await call(db, 'teacher', 'POST', '/api/classrooms/jss1a/topics/import-curriculum', { subjectId: 'math', curriculumTopicIds: ['t1', 't2', 't4', 't5', 't6'] })
  assert.equal(imported.status, 200, JSON.stringify(imported.body))
  assert.equal(imported.body.added, 1)
  assert.deepEqual(imported.body.skipped, ['LCM'])

  const teacherView = (await call(db, 'teacher', 'GET', '/api/classrooms/jss1a/topics?subjectId=math')).body.topics
  const whole = teacherView.find(topic => topic.name === 'Whole Numbers')
  assert.deepEqual([whole.status, whole.week, whole.description], ['draft', 'Week 1', 'Place value; Ordering'])
  assert.deepEqual((await call(db, 'student', 'GET', '/api/classrooms/jss1a/topics?subjectId=math')).body.topics.map(topic => topic.name), ['LCM'])

  // The teacher edits a draft and adds their own, then publishes the lot.
  assert.equal((await call(db, 'teacher', 'PUT', `/api/classrooms/jss1a/topics/${whole.id}`, { name: 'Whole Numbers and Place Value' })).status, 200)
  await call(db, 'teacher', 'POST', '/api/classrooms/jss1a/topics', { subjectId: 'math', name: 'Number Puzzles', status: 'draft' })
  const published = await call(db, 'teacher', 'POST', '/api/classrooms/jss1a/topics/publish-drafts', { subjectId: 'math' })
  assert.equal(published.body.published, 2)
  const studentView = (await call(db, 'student', 'GET', '/api/classrooms/jss1a/topics?subjectId=math')).body.topics.map(topic => topic.name).sort()
  assert.deepEqual(studentView, ['LCM', 'Number Puzzles', 'Whole Numbers and Place Value'])
  const audit = await db.prepare("SELECT action FROM topic_audit WHERE topic_id = ?").bind(whole.id).all()
  assert.ok(audit.results.some(row => row.action === 'imported'))
})
