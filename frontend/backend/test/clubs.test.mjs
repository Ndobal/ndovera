import test from 'node:test'
import assert from 'node:assert/strict'
import { sign } from '@tsndr/cloudflare-worker-jwt'
import { D1Shim, createLegacySchema } from './d1-shim.mjs'

// Clubs: who runs them, who is in them, what is shared, and how work is marked.

const SECRET = 'clubs-test-secret'
let worker
let generation = 0

const PEOPLE = {
  owner: ['o-1', 'owner@a.test', ['owner'], 'school-a'],
  ict: ['i-1', 'ict@a.test', ['ict'], 'school-a'],
  patron: ['t-art', 'art@a.test', ['teacher'], 'school-a'],
  teacher2: ['t-sci', 'sci@a.test', ['teacher'], 'school-a'],
  ada: ['s-ada', 'ada@a.test', ['student'], 'school-a'],
  bola: ['s-bola', 'bola@a.test', ['student'], 'school-a'],
  outsider: ['s-out', 'out@a.test', ['student'], 'school-a'],
  parent: ['p-1', 'mum@a.test', ['parent'], 'school-a'],
  other: ['o-b', 'owner@b.test', ['owner'], 'school-b'],
}

async function setup() {
  worker = (await import(`./build/worker.mjs?clubs=${generation++}`)).default
  const db = new D1Shim()
  createLegacySchema(db)
  for (const [id, email, roles, tenant] of Object.values(PEOPLE)) {
    await db.prepare('INSERT INTO users (id, email, name, role, tenantId, status) VALUES (?, ?, ?, ?, ?, ?)').bind(id, email, `Name ${id}`, roles[0], tenant, 'active').run()
    await db.prepare('INSERT INTO settings (studentId, payload) VALUES (?, ?)').bind(email, JSON.stringify({ name: `Name ${id}`, email, role: roles[0], roles, tenantId: tenant, schoolId: tenant, status: 'active', className: roles[0] === 'student' ? 'JSS 2' : '' })).run()
  }
  return db
}

async function call(db, person, method, path, body) {
  const [id, , roles, tenantId] = PEOPLE[person]
  const token = await sign({ id, role: roles[0], roles, tenantId, name: `Name ${id}`, exp: Math.floor(Date.now() / 1000) + 600 }, SECRET)
  const response = await worker.fetch(new Request(`https://ndovera.com${path}`, {
    method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
  }), { APP_DB: db, JWT_SECRET: SECRET }, { waitUntil() {}, passThroughOnException() {} })
  return { status: response.status, body: await response.json().catch(() => ({})) }
}

test('a teacher starts a club and runs it; students see only their clubs; posts, quizzes and assignments work end to end', async () => {
  const db = await setup()
  // Students cannot start clubs; a teacher can, and becomes its patron.
  assert.equal((await call(db, 'ada', 'POST', '/api/clubs', { name: 'Press Club' })).status, 403)
  const created = await call(db, 'patron', 'POST', '/api/clubs', { name: 'Press Club', category: 'Arts & Culture', meeting: 'Wednesdays 2pm', description: 'News, writing and photography.' })
  assert.equal(created.status, 201, JSON.stringify(created.body))
  const clubId = created.body.club.id
  assert.equal((await call(db, 'teacher2', 'POST', '/api/clubs', { name: 'press club' })).status, 409, 'one club per name')

  // Only the Owner, HoS and ICT add members: the patron cannot, not even searching the school.
  assert.equal((await call(db, 'patron', 'GET', `/api/clubs/${clubId}/candidates?q=name s-`)).status, 403)
  assert.equal((await call(db, 'patron', 'POST', `/api/clubs/${clubId}/members`, { people: [{ id: 's-ada', name: 'Ada', role: 'student' }] })).status, 403)
  // ICT sees every club, finds people and adds them: staff as patrons, students as members.
  assert.ok((await call(db, 'ict', 'GET', '/api/clubs')).body.clubs.some(club => club.id === clubId && club.canManageMembers))
  const found = await call(db, 'ict', 'GET', `/api/clubs/${clubId}/candidates?q=name s-`)
  assert.deepEqual(found.body.people.map(person => person.role).sort(), ['student', 'student', 'student'])
  const added = await call(db, 'ict', 'POST', `/api/clubs/${clubId}/members`, { people: [
    { id: 's-ada', name: 'Ada', role: 'student', className: 'JSS 2' }, { id: 's-bola', name: 'Bola', role: 'student' }, { id: 't-sci', name: 'Science Teacher', role: 'staff' },
  ] })
  assert.equal(added.status, 200, JSON.stringify(added.body))
  assert.deepEqual(added.body.members.map(member => member.role), ['patron', 'patron', 'member', 'member'])
  assert.equal((await call(db, 'owner', 'POST', `/api/clubs/${clubId}/members`, { people: [{ id: 'o-b', name: 'X', role: 'staff' }] })).status, 400, 'not from another school')
  assert.equal((await call(db, 'ada', 'POST', `/api/clubs/${clubId}/members`, { people: [{ id: 's-out', name: 'Out', role: 'student' }] })).status, 403)
  // Ada becomes club president.
  const leader = await call(db, 'patron', 'POST', `/api/clubs/${clubId}/members/s-ada/leader`, { leader: true })
  assert.equal(leader.body.members.find(member => member.userId === 's-ada').role, 'leader')

  // Who sees what.
  assert.deepEqual((await call(db, 'ada', 'GET', '/api/clubs')).body.clubs.map(club => club.name), ['Press Club'])
  assert.deepEqual((await call(db, 'outsider', 'GET', '/api/clubs')).body.clubs, [])
  assert.equal((await call(db, 'outsider', 'GET', `/api/clubs/${clubId}`)).status, 404)
  assert.equal((await call(db, 'other', 'GET', `/api/clubs/${clubId}`)).status, 404)
  assert.equal((await call(db, 'parent', 'GET', '/api/clubs')).status, 403)
  const ownerList = await call(db, 'owner', 'GET', '/api/clubs')
  assert.deepEqual([ownerList.body.clubs.length, ownerList.body.clubs[0].members, ownerList.body.clubs[0].patrons, ownerList.body.clubs[0].canManage], [1, 2, 2, true])

  // Posts: a note, a YouTube video, a document; students cannot post.
  const note = await call(db, 'patron', 'POST', `/api/clubs/${clubId}/posts`, { kind: 'note', title: 'How to write a headline', body: '# Headlines\n\n- Short\n- **Active** verbs' })
  assert.equal(note.status, 201, JSON.stringify(note.body))
  const video = await call(db, 'patron', 'POST', `/api/clubs/${clubId}/posts`, { kind: 'video', title: 'Interview skills', url: 'https://youtu.be/dQw4w9WgXcQ' })
  assert.equal(video.body.post.embedUrl, 'https://www.youtube.com/embed/dQw4w9WgXcQ')
  assert.equal((await call(db, 'patron', 'POST', `/api/clubs/${clubId}/posts`, { kind: 'document', title: 'Style guide' })).status, 400, 'a document needs its file')
  assert.equal((await call(db, 'patron', 'POST', `/api/clubs/${clubId}/posts`, { kind: 'link', title: 'Bad', url: 'http://insecure.test' })).status, 400)
  assert.equal((await call(db, 'ada', 'POST', `/api/clubs/${clubId}/posts`, { kind: 'note', title: 'Mine', body: 'x' })).status, 403)

  // A quiz: students never receive the answers before handing in; Ndovera marks it.
  const quiz = await call(db, 'patron', 'POST', `/api/clubs/${clubId}/posts`, { kind: 'quiz', title: 'Newsroom quiz', questions: [
    { id: 'q1', type: 'mcq', prompt: 'Who edits a newspaper?', options: ['Editor', 'Printer', 'Vendor'], answer: 0, marks: 2 },
    { id: 'q2', type: 'truefalse', prompt: 'A headline should be long.', answer: 1 },
    { id: 'q3', type: 'short', prompt: 'Capital of Nigeria?', answer: 'Abuja | Abuja city' },
  ] })
  assert.equal(quiz.status, 201, JSON.stringify(quiz.body))
  const quizId = quiz.body.post.id
  const page = await call(db, 'ada', 'GET', `/api/clubs/${clubId}`)
  const seen = page.body.posts.find(post => post.id === quizId)
  assert.ok(seen.questions.every(question => !('answer' in question)), 'no answers before handing in')
  assert.equal(page.body.canManage, false)
  const taken = await call(db, 'ada', 'POST', `/api/clubs/${clubId}/posts/${quizId}/submit`, { answers: { q1: 0, q2: 0, q3: ' abuja ' } })
  assert.equal(taken.status, 200, JSON.stringify(taken.body))
  assert.deepEqual([taken.body.submission.score, taken.body.submission.total], [3, 4])
  assert.deepEqual(taken.body.submission.review.map(item => item.correct), [true, false, true])
  assert.equal((await call(db, 'ada', 'POST', `/api/clubs/${clubId}/posts/${quizId}/submit`, { answers: { q1: 0 } })).status, 409, 'once only')

  // An assignment: written answer, marked by the patron with feedback.
  const task = await call(db, 'patron', 'POST', `/api/clubs/${clubId}/posts`, { kind: 'assignment', title: 'Write a news story', body: 'About sports day.', maxScore: 20, dueAt: '2026-11-01' })
  const taskId = task.body.post.id
  assert.equal((await call(db, 'bola', 'POST', `/api/clubs/${clubId}/posts/${taskId}/submit`, {})).status, 400)
  const handed = await call(db, 'bola', 'POST', `/api/clubs/${clubId}/posts/${taskId}/submit`, { answerText: 'Sports day was a success…' })
  assert.equal(handed.status, 200, JSON.stringify(handed.body))
  const work = await call(db, 'patron', 'GET', `/api/clubs/${clubId}/posts/${taskId}/submissions`)
  assert.deepEqual([work.body.submissions.length, work.body.notHandedIn], [1, ['Ada']])
  assert.equal((await call(db, 'patron', 'POST', `/api/clubs/${clubId}/submissions/${work.body.submissions[0].id}/mark`, { score: 25 })).status, 400)
  assert.equal((await call(db, 'patron', 'POST', `/api/clubs/${clubId}/submissions/${work.body.submissions[0].id}/mark`, { score: 17, feedback: 'Strong lead.' })).status, 200)
  const bolaPage = await call(db, 'bola', 'GET', `/api/clubs/${clubId}`)
  assert.deepEqual([bolaPage.body.work[taskId].score, bolaPage.body.work[taskId].total, bolaPage.body.work[taskId].feedback], [17, 20, 'Strong lead.'])
  assert.equal((await call(db, 'bola', 'POST', `/api/clubs/${clubId}/posts/${taskId}/submit`, { answerText: 'changed' })).status, 409, 'marked work stays as marked')
  assert.equal((await call(db, 'patron', 'GET', `/api/clubs/${clubId}`)).body.work[taskId].handedIn, 1)

  // Withdrawing a post hides it; removing the last patron needs the Owner.
  assert.equal((await call(db, 'patron', 'DELETE', `/api/clubs/${clubId}/posts/${note.body.post.id}`)).status, 200)
  assert.ok(!(await call(db, 'ada', 'GET', `/api/clubs/${clubId}`)).body.posts.some(post => post.id === note.body.post.id))
  // Removing members is for the Owner, HoS and ICT too.
  assert.equal((await call(db, 'patron', 'DELETE', `/api/clubs/${clubId}/members/t-sci`)).status, 403)
  assert.equal((await call(db, 'ict', 'DELETE', `/api/clubs/${clubId}/members/t-sci`)).status, 200)
  // The Owner can close a club; a patron cannot.
  assert.equal((await call(db, 'patron', 'PUT', `/api/clubs/${clubId}`, { status: 'closed' })).status, 403)
  assert.equal((await call(db, 'owner', 'PUT', `/api/clubs/${clubId}`, { status: 'closed' })).status, 200)
  assert.deepEqual((await call(db, 'ada', 'GET', '/api/clubs')).body.clubs, [])
})
