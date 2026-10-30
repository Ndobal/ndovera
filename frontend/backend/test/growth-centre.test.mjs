import test from 'node:test'
import assert from 'node:assert/strict'
import { sign } from '@tsndr/cloudflare-worker-jwt'
import { D1Shim, createLegacySchema } from './d1-shim.mjs'

// Growth Centre: virtual consultants who say they are virtual, answer only from approved
// knowledge, take contact details with consent first, hand over what they cannot answer, and
// keep Ndovera's chats and each school's chats strictly apart.

const SECRET = 'growth-centre-secret'

async function setup() {
  const worker = (await import(`./build/worker.mjs?growth=${Math.random()}`)).default
  const db = new D1Shim()
  createLegacySchema(db)
  db.db.exec(`CREATE TABLE IF NOT EXISTS tenants (id TEXT PRIMARY KEY, requested_subdomain TEXT, website_domain TEXT, school_name TEXT, status TEXT)`)
  db.db.exec(`INSERT INTO tenants (id, requested_subdomain, school_name, status) VALUES ('school-a', 'greenfield', 'Greenfield School', 'active'), ('school-b', 'hilltop', 'Hilltop School', 'active')`)
  const people = {
    ami: ['ami', 'ami@ndovera.com', 'ami', null], ami2: ['ami2', 'ami2@ndovera.com', 'ami', null],
    owner: ['own', 'own@a.ng', 'owner', 'school-a'], hos: ['hos', 'hos@a.ng', 'hos', 'school-a'], teacher: ['tea', 'tea@a.ng', 'teacher', 'school-a'], ownerB: ['own-b', 'own@b.ng', 'owner', 'school-b'],
  }
  for (const [id, email, role, tenantId] of Object.values(people)) {
    await db.prepare('INSERT INTO users (id, email, name, role, tenantId, status) VALUES (?, ?, ?, ?, ?, ?)').bind(id, email, id.toUpperCase(), role, tenantId, 'active').run()
    await db.prepare('INSERT INTO settings (studentId, payload) VALUES (?, ?)').bind(email, JSON.stringify({ id, email, role, roles: [role], tenantId })).run()
  }
  const call = async (person, method, path, body, headers = {}) => {
    const all = { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 Chrome/130', 'CF-Connecting-IP': '9.9.9.9', ...headers }
    if (person) {
      const [id, email, role, tenantId] = people[person]
      all.Authorization = `Bearer ${await sign({ id, email, role, roles: [role], name: id.toUpperCase(), tenantId, exp: Math.floor(Date.now() / 1000) + 600 }, SECRET)}`
      all['X-Selected-Role'] = role
    }
    const response = await worker.fetch(new Request(`https://ndovera.com${path}`, { method, headers: all, body: body ? JSON.stringify(body) : undefined }), { APP_DB: db, JWT_SECRET: SECRET }, { waitUntil() {}, passThroughOnException() {} })
    const text = await response.text()
    let json = {}
    try { json = JSON.parse(text) } catch {}
    return { status: response.status, body: json, text }
  }
  const visitor = async ref => {
    const started = await call(null, 'POST', `/api/growth/${ref}/start`, {})
    const token = started.body.token
    const as = (method, path, body) => call(null, method, `/api/growth/${ref}${path}`, body, { 'X-Chat-Token': token })
    return { token, started, as }
  }
  return { db, call, visitor }
}

async function approvedAnswer(call, author, approver, entry) {
  const draft = await call(author, 'POST', '/api/growth-centre/knowledge', entry)
  assert.equal(draft.status, 200, draft.text)
  const approved = await call(approver, 'POST', `/api/growth-centre/knowledge/${draft.body.id}/approve`)
  assert.equal(approved.status, 200, approved.text)
  return draft.body
}

test('a school admissions chat: the consultant says it is virtual, takes contact details with consent first, answers only from approved knowledge', async () => {
  const { call, visitor, db } = await setup()
  await approvedAnswer(call, 'hos', 'owner', { question: 'What are the school fees for JSS 1?', answer: 'JSS 1 fees are ₦150,000 a term, including books.', keywords: 'fees, tuition, cost, price' })

  const chat = await visitor('greenfield')
  assert.equal(chat.started.status, 200, chat.started.text)
  let view = (await chat.as('GET', '/conversation')).body
  assert.match(view.messages[0].text, /a virtual consultant for Greenfield School — an automated assistant, not a person/)
  assert.match(view.messages[0].name, /virtual consultant$/)

  // Contact first: the question is kept, not answered yet.
  view = (await chat.as('POST', '/message', { text: 'How much are the fees for JSS 1?' })).body
  assert.equal(view.hasContact, false)
  assert.ok(!view.messages.some(message => /150,000/.test(message.text)))
  assert.equal((await chat.as('POST', '/contact', { name: 'Mrs Obi', email: 'obi@mail.ng', phone: '08031234567', privacyConsent: false })).status, 400)
  view = (await chat.as('POST', '/contact', { name: 'Mrs Obi', email: 'obi@mail.ng', phone: '0803 123 4567', privacyConsent: true })).body
  assert.equal(view.hasContact, true)
  assert.equal(view.messages.at(-1).text, 'JSS 1 fees are ₦150,000 a term, including books.') // word for word
  const row = db.db.prepare(`SELECT privacy_consent_at, privacy_notice_version, marketing_consent FROM gc_conversations`).get()
  assert.ok(row.privacy_consent_at)
  assert.equal(row.privacy_notice_version, 'growth-chat-2026-10-30')
  assert.equal(row.marketing_consent, 0) // optional and separate: off unless ticked

  // No approved answer: no guess; it goes to the gaps inbox and to a person.
  view = (await chat.as('POST', '/message', { text: 'Do you run a school bus to Lekki?' })).body
  assert.match(view.messages.at(-1).text, /I don't have an approved answer to that yet, so I won't guess/)
  const centre = (await call('owner', 'GET', '/api/growth-centre')).body
  assert.equal(centre.gaps[0].question, 'Do you run a school bus to Lekki?')
  assert.equal(centre.conversations[0].status, 'handover')
  assert.equal(centre.stats.handovers, 1)

  // Staff take over: the consultant stays quiet; the visitor sees the staff reply.
  const id = centre.conversations[0].id
  assert.equal((await call('hos', 'POST', `/api/growth-centre/conversations/${id}/reply`, { text: 'Yes, from Lekki Phase 1.' })).status, 200)
  view = (await chat.as('POST', '/message', { text: 'How much are the fees for JSS 1?' })).body
  assert.equal(view.messages.at(-1).from, 'visitor') // no automated answer once a person has the chat
  assert.ok(view.messages.some(message => message.name === 'HOS · staff'))

  // The other school sees none of it; teachers have no access.
  assert.deepEqual((await call('ownerB', 'GET', '/api/growth-centre')).body.conversations, [])
  assert.equal((await call('ownerB', 'GET', `/api/growth-centre/conversations/${id}`)).status, 404)
  assert.equal((await call('teacher', 'GET', '/api/growth-centre')).status, 403)
  // The token does not open the chat through another school's address.
  assert.equal((await call(null, 'GET', '/api/growth/hilltop/conversation', null, { 'X-Chat-Token': chat.token })).status, 404)

  // The visitor deletes their chat: messages and details erased.
  assert.equal((await chat.as('DELETE', '/conversation')).status, 200)
  assert.equal(db.db.prepare(`SELECT COUNT(*) AS n FROM gc_messages WHERE conversation_id = ?`).get(id).n, 0)
  assert.equal(db.db.prepare(`SELECT email FROM gc_conversations WHERE id = ?`).get(id).email, null)
})

test('knowledge is versioned and approved by someone else; a new version replaces the old answer', async () => {
  const { call, visitor } = await setup()
  const draft = await call('owner', 'POST', '/api/growth-centre/knowledge', { question: 'When does the term start?', answer: 'First Term starts on 7 September.', keywords: 'term, resumption, start' })
  assert.equal((await call('owner', 'POST', `/api/growth-centre/knowledge/${draft.body.id}/approve`)).status, 403) // the author cannot approve
  await call('hos', 'POST', `/api/growth-centre/knowledge/${draft.body.id}/approve`)
  const chat = await visitor('greenfield')
  await chat.as('POST', '/message', { text: 'When does the term start?' })
  let view = (await chat.as('POST', '/contact', { name: 'Ade', email: 'ade@mail.ng', phone: '+2348031234567', privacyConsent: true })).body
  assert.equal(view.messages.at(-1).text, 'First Term starts on 7 September.')

  // Version 2 waits as a draft (the approved answer stays live) until approved; then it replaces it.
  const second = await call('owner', 'POST', '/api/growth-centre/knowledge', { articleKey: draft.body.articleKey, question: 'When does the term start?', answer: 'First Term starts on 14 September.', keywords: 'term, resumption, start' })
  view = (await chat.as('POST', '/message', { text: 'When does term start?' })).body
  assert.equal(view.messages.at(-1).text, 'First Term starts on 7 September.')
  await call('hos', 'POST', `/api/growth-centre/knowledge/${second.body.id}/approve`)
  view = (await chat.as('POST', '/message', { text: 'When does the term start?' })).body
  assert.equal(view.messages.at(-1).text, 'First Term starts on 14 September.') // the cached answer was cleared
  const versions = (await call('owner', 'GET', '/api/growth-centre')).body.knowledge.map(item => [item.version, item.status])
  assert.deepEqual(versions, [[2, 'approved'], [1, 'retired']])
})

test("Ndovera's chat: Ami's scope only; starting a chat stops cold outreach; marketing consent signs them up", async () => {
  const { call, visitor, db } = await setup()
  await approvedAnswer(call, 'ami', 'ami2', { question: 'How much does Ndovera cost per student?', answer: 'Plans start from ₦1,000 per student per term. See ndovera.com/pricing.', keywords: 'price, pricing, cost, plan' })
  db.db.exec(`CREATE TABLE IF NOT EXISTS prospect_schools (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, domain TEXT NOT NULL, school_name TEXT, country TEXT NOT NULL, source_url TEXT NOT NULL, found_at TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'new', step INTEGER NOT NULL DEFAULT 0, last_sent_at TEXT, next_due_at TEXT, stopped_reason TEXT, updated_at TEXT NOT NULL)`)
  db.db.exec(`INSERT INTO prospect_schools (id, email, domain, country, source_url, found_at, status, step, next_due_at, updated_at) VALUES ('p1', 'head@cold.edu.ng', 'cold.edu.ng', 'NG', 'x', 'x', 'active', 1, '2026-12-01', 'x')`)

  const cold = await visitor('ndovera')
  await cold.as('POST', '/message', { text: 'How much does it cost per student?' })
  const view = (await cold.as('POST', '/contact', { name: 'Head', email: 'head@cold.edu.ng', phone: '08031234567', privacyConsent: true })).body
  assert.match(view.messages.at(-1).text, /₦1,000 per student/)
  assert.deepEqual(Object.values(db.db.prepare(`SELECT status, stopped_reason FROM prospect_schools WHERE id = 'p1'`).get()), ['replied', 'started a chat'])

  const keen = await visitor('ndovera')
  await keen.as('POST', '/message', { text: 'Do you do demos?' })
  await keen.as('POST', '/contact', { name: 'Keen', email: 'keen@school.ng', phone: '08031234568', privacyConsent: true, marketingConsent: true })
  assert.equal(db.db.prepare(`SELECT status FROM prospect_schools WHERE email = 'keen@school.ng'`).get().status, 'active')

  // Schools never see Ndovera's chats; Ami never sees a school's.
  assert.deepEqual((await call('owner', 'GET', '/api/growth-centre')).body.conversations, [])
  assert.equal((await call('ami', 'GET', '/api/growth-centre')).body.conversations.length, 2)
  // The chat page names the consultant as virtual and never asks for card details.
  const page = await call(null, 'GET', '/api/growth/ndovera/chat')
  assert.match(page.text, /virtual consultant \(an automated assistant\)/)
  assert.match(page.text, /We never ask for card or bank details/)
  assert.ok(!/card number|cvv/i.test(page.text))
})
