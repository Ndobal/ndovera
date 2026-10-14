import test from 'node:test'
import assert from 'node:assert/strict'
import { sign } from '@tsndr/cloudflare-worker-jwt'
import { D1Shim, createLegacySchema } from './d1-shim.mjs'

// School messaging: only members read or write a conversation; the sender is the signed-in
// person; long threads show their newest messages; a person's chats are all found however
// busy the platform is; conversations stay within a school; contacts carry no phone numbers.

const SECRET = 'messaging-secret'
let worker
let generation = 0
const PEOPLE = {
  ada: ['s-ada', 'ada@a.test', 'student', 'school-a'],
  bola: ['s-bola', 'bola@a.test', 'student', 'school-a'],
  chi: ['s-chi', 'chi@a.test', 'student', 'school-a'],
  teacher: ['t-1', 'teacher@a.test', 'teacher', 'school-a'],
  mum: ['p-1', 'mum@a.test', 'parent', 'school-a'],
  stranger: ['s-x', 'x@b.test', 'student', 'school-b'],
}

async function setup() {
  worker = (await import(`./build/worker.mjs?messaging=${generation++}`)).default
  const db = new D1Shim()
  createLegacySchema(db)
  db.db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (id TEXT PRIMARY KEY, subject TEXT, participants TEXT, created_at TEXT, updated_at TEXT);
    CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, conversation_id TEXT, sender_id TEXT, body TEXT, metadata TEXT, sent_at TEXT, read_at TEXT);
  `)
  for (const [id, email, role, tenant] of Object.values(PEOPLE)) {
    await db.prepare('INSERT INTO users (id, email, name, role, tenantId, status) VALUES (?, ?, ?, ?, ?, ?)').bind(id, email, `Name ${id}`, role, tenant, 'active').run()
    await db.prepare('INSERT INTO settings (studentId, payload) VALUES (?, ?)').bind(email, JSON.stringify({ name: `Name ${id}`, email, role, roles: [role], tenantId: tenant, schoolId: tenant, status: 'active', phone: '08012345678', className: role === 'student' ? 'JSS 1' : '' })).run()
  }
  return db
}

async function call(db, person, method, path, body) {
  const [id, email, role, tenantId] = PEOPLE[person]
  const token = await sign({ id, email, role, roles: [role], tenantId, name: id, exp: Math.floor(Date.now() / 1000) + 600 }, SECRET)
  const response = await worker.fetch(new Request(`https://ndovera.com${path}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }),
    { APP_DB: db, JWT_SECRET: SECRET }, { waitUntil() {}, passThroughOnException() {} })
  return { status: response.status, body: await response.json().catch(() => ({})) }
}

test('only members read or write a chat, as themselves; long chats show the newest messages; old chats are never lost', async () => {
  const db = await setup()
  const started = await call(db, 'ada', 'POST', '/api/conversations', { participants: ['s-bola'] })
  assert.equal(started.status, 200, JSON.stringify(started.body))
  const id = started.body.conversation.id
  // Starting it again finds the same conversation.
  assert.equal((await call(db, 'bola', 'POST', '/api/conversations', { participants: ['s-ada'] })).body.conversation.id, id)
  // Not with someone from another school.
  assert.equal((await call(db, 'ada', 'POST', '/api/conversations', { participants: ['s-x'] })).status, 403)

  // The sender is always the signed-in person.
  const sent = await call(db, 'ada', 'POST', `/api/conversations/${id}/messages`, { senderId: 's-bola', body: 'Hello Bola' })
  assert.equal(sent.status, 200, JSON.stringify(sent.body))
  assert.equal(sent.body.message.senderId, 's-ada')
  // Outsiders cannot read, write or mark it read.
  assert.equal((await call(db, 'chi', 'GET', `/api/conversations/${id}/messages`)).status, 404)
  assert.equal((await call(db, 'chi', 'POST', `/api/conversations/${id}/messages`, { body: 'sneaky' })).status, 404)
  assert.equal((await call(db, 'chi', 'POST', `/api/conversations/${id}/mark-read`)).status, 404)
  assert.equal((await call(db, 'stranger', 'GET', `/api/conversations/${id}/messages`)).status, 404)
  assert.equal((await call(db, 'ada', 'POST', `/api/conversations/${id}/messages`, { body: 'x'.repeat(4001) })).status, 400)

  // A long chat: the newest message is on screen.
  const insert = db.db.prepare(`INSERT INTO messages (id, conversation_id, sender_id, body, metadata, sent_at) VALUES (?, ?, 's-bola', ?, '{}', ?)`)
  for (let i = 0; i < 350; i += 1) insert.run(`m${i}`, id, `old ${i}`, new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString())
  await call(db, 'bola', 'POST', `/api/conversations/${id}/messages`, { body: 'Newest one' })
  const thread = await call(db, 'ada', 'GET', `/api/conversations/${id}/messages`)
  assert.equal(thread.body.messages.at(-1).body, 'Newest one')
  assert.ok(thread.body.messages.length <= 300)

  // However many conversations the platform has, Ada's chat is in her list.
  const crowd = db.db.prepare(`INSERT INTO conversations (id, subject, participants, created_at, updated_at) VALUES (?, '', '["t-1","s-chi"]', ?, ?)`)
  const later = new Date(Date.now() + 86400000).toISOString()
  for (let i = 0; i < 260; i += 1) crowd.run(`crowd-${i}`, later, later)
  const list = await call(db, 'ada', 'GET', '/api/conversations?userId=s-bola')
  assert.deepEqual(list.body.conversations.map(conversation => conversation.id), [id], 'her own chats only, whatever userId is asked for')
})

test('contacts: everyone in the school a person may message, with no phone numbers; parents see staff only', async () => {
  const db = await setup()
  const forAda = await call(db, 'ada', 'GET', '/api/messaging/contacts')
  assert.equal(forAda.status, 200)
  assert.deepEqual(forAda.body.people.map(person => person.id).sort(), ['s-bola', 's-chi', 't-1'])
  assert.ok(forAda.body.people.every(person => !('phone' in person)))
  assert.equal(forAda.body.people.find(person => person.id === 's-bola').className, 'JSS 1')
  const forMum = await call(db, 'mum', 'GET', '/api/messaging/contacts')
  assert.deepEqual(forMum.body.people.map(person => person.id), ['t-1'])
})
