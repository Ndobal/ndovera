// Growth Centre (docs/premium-upgrade-implementation-plan.md §6).
//
// One chat engine, two strictly separate scopes:
//   'ndovera'  — schools asking about Ndovera (managed by Ami);
//   <tenantId> — parents asking a school about admission (managed by its Owner/HoS).
// Every table carries the scope and every query filters on it; one scope never sees another.
//
// The virtual consultants (Rex, Zico, Vera, Nora) always say they are virtual, not people.
// They answer only with the scope's approved, versioned knowledge — word for word, never
// invented. A question with no approved answer goes to the gaps inbox and to a person.
// Contact first: the visitor's question is kept, then their name, email and phone are taken
// with consent to the privacy notice (recorded with time and notice version); marketing
// consent is separate, optional and unticked. No payment detail is ever taken in the chat:
// registration and admission go through the existing forms and hosted payment.

export class GrowthError extends Error {
  status: number
  constructor(message: string, status = 400) { super(message); this.status = status }
}

export const CONSULTANTS = ['Rex', 'Zico', 'Vera', 'Nora']
export const PRIVACY_NOTICE_VERSION = 'growth-chat-2026-10-30'
const RETENTION_MONTHS = 24
const clean = (value: unknown, max: number) => String(value ?? '').replace(/\u0000/g, '').trim().slice(0, max)
const nowIso = () => new Date().toISOString()

export async function ensureGrowthTables(db: D1Database) {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS gc_knowledge (id TEXT PRIMARY KEY, scope TEXT NOT NULL, article_key TEXT NOT NULL, version INTEGER NOT NULL, question TEXT NOT NULL, answer TEXT NOT NULL, keywords TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'draft', created_by TEXT, created_by_name TEXT, approved_by TEXT, approved_by_name TEXT, approved_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(scope, article_key, version))`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_gc_knowledge_scope ON gc_knowledge (scope, status)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS gc_conversations (id TEXT PRIMARY KEY, scope TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE, consultant TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open', first_question TEXT, visitor_name TEXT, email TEXT, phone TEXT, privacy_consent_at TEXT, privacy_notice_version TEXT, marketing_consent INTEGER NOT NULL DEFAULT 0, marketing_consent_at TEXT, assigned_to TEXT, assigned_name TEXT, client_key TEXT, answered_by_knowledge INTEGER NOT NULL DEFAULT 0, handed_over_at TEXT, deleted_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, last_message_at TEXT NOT NULL)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_gc_conversations_scope ON gc_conversations (scope, last_message_at)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS gc_messages (id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL, scope TEXT NOT NULL, sender TEXT NOT NULL, sender_name TEXT, body TEXT NOT NULL, source TEXT NOT NULL, knowledge_id TEXT, created_at TEXT NOT NULL)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_gc_messages_conversation ON gc_messages (conversation_id, created_at)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS gc_gaps (id TEXT PRIMARY KEY, scope TEXT NOT NULL, question TEXT NOT NULL, question_key TEXT NOT NULL, conversation_id TEXT, asked INTEGER NOT NULL DEFAULT 1, status TEXT NOT NULL DEFAULT 'open', created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(scope, question_key))`),
    db.prepare(`CREATE TABLE IF NOT EXISTS gc_answer_cache (scope TEXT NOT NULL, question_key TEXT NOT NULL, knowledge_id TEXT NOT NULL, hits INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, PRIMARY KEY (scope, question_key))`),
  ])
}

// ─── Matching a question to an approved answer (no invention) ─────────────────

const STOP = new Set('a an and are as at be by can do does for from have how i if in is it me my of on or our please school schools that the their there this to us we what when where which who why will with you your'.split(' '))
export function tokens(text: string) {
  return String(text || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(word => word.length > 1 && !STOP.has(word))
    .map(word => word.replace(/(ing|es|s)$/, ''))
}
export const questionKey = (text: string) => [...new Set(tokens(text))].sort().join(' ').slice(0, 300)

/** The approved entry that best answers the question, or null when none is close enough. */
export function bestMatch(question: string, entries: Array<{ id: string, question: string, keywords: string }>) {
  const asked = new Set(tokens(question))
  if (!asked.size) return null
  let best: { id: string, score: number } | null = null
  for (const entry of entries) {
    const known = new Set([...tokens(entry.question), ...tokens(entry.keywords.replace(/,/g, ' '))])
    if (!known.size) continue
    let shared = 0
    for (const word of asked) if (known.has(word)) shared += 1
    const score = shared / Math.min(asked.size, known.size)
    if (shared >= Math.min(2, asked.size) && score >= 0.5 && (!best || score > best.score)) best = { id: entry.id, score }
  }
  return best
}

// ─── Knowledge pool: drafted, approved, versioned ─────────────────────────────

export async function listKnowledge(db: D1Database, scope: string) {
  await ensureGrowthTables(db)
  return ((await db.prepare(`SELECT id, article_key, version, question, answer, keywords, status, created_by_name, approved_by_name, approved_at, updated_at FROM gc_knowledge WHERE scope = ? ORDER BY article_key, version DESC LIMIT 1000`).bind(scope).all()).results || [])
}

/** A new draft: a fresh question, or a new version of an existing one (the approved one stays live until this is approved). */
export async function draftKnowledge(db: D1Database, scope: string, actor: { id: string, name: string }, input: Record<string, any>) {
  await ensureGrowthTables(db)
  const question = clean(input.question, 300)
  const answer = clean(input.answer, 4000)
  if (!question || !answer) throw new GrowthError('Write the question and the approved answer.')
  const articleKey = /^[a-z0-9-]{6,60}$/.test(String(input.articleKey || '')) ? String(input.articleKey) : crypto.randomUUID()
  const latest = await db.prepare(`SELECT MAX(version) AS v FROM gc_knowledge WHERE scope = ? AND article_key = ?`).bind(scope, articleKey).first() as any
  if (input.articleKey && !latest?.v) throw new GrowthError('That answer was not found.', 404)
  const id = crypto.randomUUID()
  const at = nowIso()
  await db.prepare(`INSERT INTO gc_knowledge (id, scope, article_key, version, question, answer, keywords, status, created_by, created_by_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?)`)
    .bind(id, scope, articleKey, Number(latest?.v || 0) + 1, question, answer, clean(input.keywords, 400), actor.id, actor.name, at, at).run()
  return { id, articleKey }
}

/** Approve a draft: it goes live, the version before it is retired, cached answers are cleared. */
export async function approveKnowledge(db: D1Database, scope: string, actor: { id: string, name: string }, id: string) {
  await ensureGrowthTables(db)
  const row = await db.prepare(`SELECT * FROM gc_knowledge WHERE id = ? AND scope = ?`).bind(id, scope).first() as any
  if (!row) throw new GrowthError('Answer not found.', 404)
  if (row.status !== 'draft') throw new GrowthError('Only a draft can be approved.', 409)
  const at = nowIso()
  await db.batch([
    db.prepare(`UPDATE gc_knowledge SET status = 'retired', updated_at = ? WHERE scope = ? AND article_key = ? AND status = 'approved'`).bind(at, scope, row.article_key),
    db.prepare(`UPDATE gc_knowledge SET status = 'approved', approved_by = ?, approved_by_name = ?, approved_at = ?, updated_at = ? WHERE id = ?`).bind(actor.id, actor.name, at, at, id),
    db.prepare(`DELETE FROM gc_answer_cache WHERE scope = ?`).bind(scope),
    db.prepare(`UPDATE gc_gaps SET status = 'answered', updated_at = ? WHERE scope = ? AND question_key = ?`).bind(at, scope, questionKey(row.question)),
  ])
}

export async function retireKnowledge(db: D1Database, scope: string, id: string) {
  await ensureGrowthTables(db)
  await db.batch([
    db.prepare(`UPDATE gc_knowledge SET status = 'retired', updated_at = ? WHERE id = ? AND scope = ?`).bind(nowIso(), id, scope),
    db.prepare(`DELETE FROM gc_answer_cache WHERE scope = ?`).bind(scope),
  ])
}

async function answerFor(db: D1Database, scope: string, question: string) {
  const key = questionKey(question)
  // The safe cache: only ever points at an approved entry, and is checked against it each time.
  const cached = key ? await db.prepare(`SELECT k.id, k.answer FROM gc_answer_cache c JOIN gc_knowledge k ON k.id = c.knowledge_id AND k.scope = c.scope WHERE c.scope = ? AND c.question_key = ? AND k.status = 'approved'`).bind(scope, key).first() as any : null
  if (cached) {
    await db.prepare(`UPDATE gc_answer_cache SET hits = hits + 1 WHERE scope = ? AND question_key = ?`).bind(scope, key).run()
    return { id: String(cached.id), answer: String(cached.answer), source: 'cache' }
  }
  const approved = ((await db.prepare(`SELECT id, question, answer, keywords FROM gc_knowledge WHERE scope = ? AND status = 'approved' LIMIT 500`).bind(scope).all()).results || []) as any[]
  const match = bestMatch(question, approved)
  if (!match) return null
  const entry = approved.find(item => item.id === match.id)
  if (key) await db.prepare(`INSERT OR REPLACE INTO gc_answer_cache (scope, question_key, knowledge_id, hits, created_at) VALUES (?, ?, ?, 0, ?)`).bind(scope, key, entry.id, nowIso()).run()
  return { id: String(entry.id), answer: String(entry.answer), source: 'knowledge' }
}

// ─── The visitor's side (public, by a secret conversation token) ──────────────

async function sha(text: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

type Host = { scope: string, name: string, kind: 'ndovera' | 'school', registerUrl: string, privacyUrl: string }

export function greeting(consultant: string, host: Host) {
  return host.kind === 'ndovera'
    ? `Hello, I'm ${consultant}, a virtual consultant for Ndovera — an automated assistant, not a person. Ask me anything about running your school on Ndovera. A member of the team can take over at any time.`
    : `Hello, I'm ${consultant}, a virtual consultant for ${host.name} — an automated assistant, not a person. Ask me about admission and the school. A member of staff can take over at any time.`
}

async function addMessage(db: D1Database, conversation: { id: string, scope: string }, sender: string, senderName: string, body: string, source: string, knowledgeId: string | null = null) {
  const at = nowIso()
  await db.batch([
    db.prepare(`INSERT INTO gc_messages (id, conversation_id, scope, sender, sender_name, body, source, knowledge_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(crypto.randomUUID(), conversation.id, conversation.scope, sender, senderName, body, source, knowledgeId, at),
    db.prepare(`UPDATE gc_conversations SET last_message_at = ?, updated_at = ? WHERE id = ?`).bind(at, at, conversation.id),
  ])
}

export async function startConversation(db: D1Database, host: Host, clientKey: string) {
  await ensureGrowthTables(db)
  const recent = await db.prepare(`SELECT COUNT(*) AS n FROM gc_conversations WHERE scope = ? AND client_key = ? AND created_at >= ?`).bind(host.scope, clientKey, new Date(Date.now() - 3600_000).toISOString()).first() as any
  if (Number(recent?.n || 0) >= 10) throw new GrowthError('Too many chats from this device in the last hour. Please try again later.', 429)
  const token = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(24)))).replace(/[+/=]/g, char => (char === '+' ? '-' : char === '/' ? '_' : ''))
  const consultant = CONSULTANTS[crypto.getRandomValues(new Uint8Array(1))[0] % CONSULTANTS.length]
  const id = crypto.randomUUID()
  const at = nowIso()
  await db.prepare(`INSERT INTO gc_conversations (id, scope, token_hash, consultant, status, client_key, created_at, updated_at, last_message_at) VALUES (?, ?, ?, ?, 'open', ?, ?, ?, ?)`)
    .bind(id, host.scope, await sha(token), consultant, clientKey, at, at, at).run()
  await addMessage(db, { id, scope: host.scope }, 'consultant', consultant, greeting(consultant, host), 'system')
  return { token, consultant }
}

async function conversationByToken(db: D1Database, scope: string, token: string) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(String(token || ''))) throw new GrowthError('This chat has ended. Start a new one.', 404)
  await ensureGrowthTables(db)
  const row = await db.prepare(`SELECT * FROM gc_conversations WHERE token_hash = ? AND scope = ? AND deleted_at IS NULL`).bind(await sha(token), scope).first() as any
  if (!row) throw new GrowthError('This chat has ended. Start a new one.', 404)
  return row
}

export async function visitorView(db: D1Database, scope: string, token: string) {
  const row = await conversationByToken(db, scope, token)
  const messages = ((await db.prepare(`SELECT sender, sender_name, body, created_at FROM gc_messages WHERE conversation_id = ? ORDER BY created_at LIMIT 300`).bind(row.id).all()).results || []) as any[]
  return {
    consultant: row.consultant, status: row.status, hasContact: Boolean(row.privacy_consent_at),
    messages: messages.map(message => ({ from: message.sender, name: message.sender === 'consultant' ? `${message.sender_name} · virtual consultant` : message.sender === 'staff' ? `${message.sender_name} · staff` : 'You', text: message.body, at: message.created_at })),
  }
}

async function reply(db: D1Database, row: any, host: Host, question: string) {
  if (row.status === 'human' || row.status === 'closed') return
  const found = await answerFor(db, host.scope, question)
  if (found) {
    await addMessage(db, row, 'consultant', row.consultant, found.answer, found.source, found.id)
    await db.prepare(`UPDATE gc_conversations SET answered_by_knowledge = answered_by_knowledge + 1 WHERE id = ?`).bind(row.id).run()
    return
  }
  const key = questionKey(question) || question.toLowerCase().slice(0, 300)
  const at = nowIso()
  await db.batch([
    db.prepare(`INSERT INTO gc_gaps (id, scope, question, question_key, conversation_id, asked, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, 'open', ?, ?) ON CONFLICT(scope, question_key) DO UPDATE SET asked = asked + 1, status = 'open', updated_at = excluded.updated_at`)
      .bind(crypto.randomUUID(), host.scope, question.slice(0, 600), key, row.id, at, at),
    db.prepare(`UPDATE gc_conversations SET status = 'handover', handed_over_at = COALESCE(handed_over_at, ?), updated_at = ? WHERE id = ?`).bind(at, at, row.id),
  ])
  await addMessage(db, row, 'consultant', row.consultant, `I don't have an approved answer to that yet, so I won't guess. I've passed your question to ${host.kind === 'ndovera' ? 'the Ndovera team' : `the staff at ${host.name}`}; someone will reply here and by email.`, 'handover')
}

export async function visitorMessage(db: D1Database, host: Host, token: string, text: unknown) {
  const row = await conversationByToken(db, host.scope, token)
  const body = clean(text, 2000)
  if (!body) throw new GrowthError('Type a message.')
  const count = await db.prepare(`SELECT COUNT(*) AS n FROM gc_messages WHERE conversation_id = ? AND sender = 'visitor'`).bind(row.id).first() as any
  if (Number(count?.n || 0) >= 60) throw new GrowthError('This chat is long; the team will reply by email. You can start a new chat for another question.', 429)
  await addMessage(db, row, 'visitor', row.visitor_name || 'Visitor', body, 'visitor')
  if (!row.privacy_consent_at) {
    // Contact first: keep the question, ask who is asking before answering.
    if (!row.first_question) await db.prepare(`UPDATE gc_conversations SET first_question = ? WHERE id = ?`).bind(body, row.id).run()
    await addMessage(db, row, 'consultant', row.consultant, 'Thank you — I have your question. So we can reply properly, please tell me your name, email and phone number below. I\'ll answer straight after.', 'system')
    return visitorView(db, host.scope, token)
  }
  await reply(db, row, host, body)
  return visitorView(db, host.scope, token)
}

export async function visitorContact(db: D1Database, host: Host, token: string, input: Record<string, any>, hooks: { onContact?: (details: { email: string, name: string, phone: string, marketingConsent: boolean }) => Promise<void> } = {}) {
  const row = await conversationByToken(db, host.scope, token)
  const name = clean(input.name, 120)
  const email = clean(input.email, 160).toLowerCase()
  const phone = clean(input.phone, 30).replace(/[^\d+]/g, '')
  if (!name) throw new GrowthError('Please enter your name.')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new GrowthError('Please enter a valid email address.')
  if (!/^\+?\d{7,15}$/.test(phone)) throw new GrowthError('Please enter a valid phone number.')
  if (input.privacyConsent !== true) throw new GrowthError('Please agree to the privacy notice so we can answer.', 400)
  const marketing = input.marketingConsent === true
  const at = nowIso()
  await db.prepare(`UPDATE gc_conversations SET visitor_name = ?, email = ?, phone = ?, privacy_consent_at = ?, privacy_notice_version = ?, marketing_consent = ?, marketing_consent_at = ?, updated_at = ? WHERE id = ?`)
    .bind(name, email, phone, at, PRIVACY_NOTICE_VERSION, marketing ? 1 : 0, marketing ? at : null, at, row.id).run()
  if (hooks.onContact) await hooks.onContact({ email, name, phone, marketingConsent: marketing }).catch(() => null)
  const updated = { ...row, visitor_name: name, privacy_consent_at: at }
  await addMessage(db, updated, 'consultant', row.consultant, `Thank you, ${name.split(' ')[0]}.`, 'system')
  if (row.first_question) await reply(db, updated, host, String(row.first_question))
  return visitorView(db, host.scope, token)
}

/** The visitor deletes their chat: messages and contact details are erased; a dated stub remains. */
export async function visitorDelete(db: D1Database, scope: string, token: string) {
  const row = await conversationByToken(db, scope, token)
  const at = nowIso()
  await db.batch([
    db.prepare(`DELETE FROM gc_messages WHERE conversation_id = ?`).bind(row.id),
    db.prepare(`UPDATE gc_conversations SET visitor_name = NULL, email = NULL, phone = NULL, first_question = NULL, status = 'closed', deleted_at = ?, updated_at = ? WHERE id = ?`).bind(at, at, row.id),
  ])
}

// ─── Staff: inbox, take over, reply, gaps, analytics ──────────────────────────

export async function listConversations(db: D1Database, scope: string, status = '') {
  await ensureGrowthTables(db)
  const filter = status ? `AND status = ?` : ''
  const binds = status ? [scope, status] : [scope]
  return ((await db.prepare(`SELECT id, consultant, status, first_question, visitor_name, email, phone, marketing_consent, assigned_name, created_at, last_message_at FROM gc_conversations WHERE scope = ? AND deleted_at IS NULL ${filter} ORDER BY last_message_at DESC LIMIT 200`).bind(...binds).all()).results || [])
}

export async function getConversation(db: D1Database, scope: string, id: string) {
  await ensureGrowthTables(db)
  const row = await db.prepare(`SELECT * FROM gc_conversations WHERE id = ? AND scope = ? AND deleted_at IS NULL`).bind(id, scope).first() as any
  if (!row) throw new GrowthError('Conversation not found.', 404)
  const messages = ((await db.prepare(`SELECT sender, sender_name, body, source, created_at FROM gc_messages WHERE conversation_id = ? ORDER BY created_at LIMIT 500`).bind(id).all()).results || [])
  const { token_hash: _hidden, client_key: _client, ...conversation } = row
  return { conversation, messages }
}

export async function takeOver(db: D1Database, scope: string, id: string, actor: { id: string, name: string }) {
  const { conversation } = await getConversation(db, scope, id)
  await db.prepare(`UPDATE gc_conversations SET status = 'human', assigned_to = ?, assigned_name = ?, updated_at = ? WHERE id = ? AND scope = ?`).bind(actor.id, actor.name, nowIso(), id, scope).run()
  await addMessage(db, { id, scope }, 'system', 'Ndovera', `${actor.name} (staff) has joined the chat. ${conversation.consultant}, the virtual consultant, will stay quiet now.`, 'system')
}

export async function staffReply(db: D1Database, scope: string, id: string, actor: { id: string, name: string }, text: unknown) {
  const body = clean(text, 4000)
  if (!body) throw new GrowthError('Type a reply.')
  const { conversation } = await getConversation(db, scope, id)
  if (conversation.status !== 'human' || conversation.assigned_to !== actor.id) await takeOver(db, scope, id, actor)
  await addMessage(db, { id, scope }, 'staff', actor.name, body, 'staff')
}

export async function closeConversation(db: D1Database, scope: string, id: string) {
  await getConversation(db, scope, id)
  await db.prepare(`UPDATE gc_conversations SET status = 'closed', updated_at = ? WHERE id = ? AND scope = ?`).bind(nowIso(), id, scope).run()
}

export async function listGaps(db: D1Database, scope: string) {
  await ensureGrowthTables(db)
  return ((await db.prepare(`SELECT id, question, asked, status, updated_at FROM gc_gaps WHERE scope = ? AND status = 'open' ORDER BY asked DESC, updated_at DESC LIMIT 200`).bind(scope).all()).results || [])
}

export async function dismissGap(db: D1Database, scope: string, id: string) {
  await ensureGrowthTables(db)
  await db.prepare(`UPDATE gc_gaps SET status = 'dismissed', updated_at = ? WHERE id = ? AND scope = ?`).bind(nowIso(), id, scope).run()
}

export async function analytics(db: D1Database, scope: string, sinceDays = 30) {
  await ensureGrowthTables(db)
  const since = new Date(Date.now() - sinceDays * 86_400_000).toISOString()
  const [totals, consultants, gaps, knowledge] = await db.batch([
    db.prepare(`SELECT COUNT(*) AS conversations, SUM(CASE WHEN privacy_consent_at IS NOT NULL THEN 1 ELSE 0 END) AS contacts, SUM(marketing_consent) AS marketing, SUM(CASE WHEN handed_over_at IS NOT NULL THEN 1 ELSE 0 END) AS handovers, SUM(CASE WHEN status = 'human' THEN 1 ELSE 0 END) AS withStaff, SUM(CASE WHEN answered_by_knowledge > 0 THEN 1 ELSE 0 END) AS answered FROM gc_conversations WHERE scope = ? AND created_at >= ?`).bind(scope, since),
    db.prepare(`SELECT consultant, COUNT(*) AS n FROM gc_conversations WHERE scope = ? AND created_at >= ? GROUP BY consultant`).bind(scope, since),
    db.prepare(`SELECT COUNT(*) AS n FROM gc_gaps WHERE scope = ? AND status = 'open'`).bind(scope),
    db.prepare(`SELECT COUNT(*) AS n FROM gc_knowledge WHERE scope = ? AND status = 'approved'`).bind(scope),
  ])
  const total = ((totals.results || [])[0] || {}) as any
  return {
    days: sinceDays,
    conversations: Number(total.conversations || 0), contacts: Number(total.contacts || 0), marketingConsents: Number(total.marketing || 0),
    answeredFromKnowledge: Number(total.answered || 0), handovers: Number(total.handovers || 0), withStaff: Number(total.withStaff || 0),
    openGaps: Number(((gaps.results || [])[0] as any)?.n || 0), approvedAnswers: Number(((knowledge.results || [])[0] as any)?.n || 0),
    byConsultant: (consultants.results || []).map((row: any) => ({ consultant: row.consultant, conversations: Number(row.n || 0) })),
  }
}

/** Kept no longer than needed: chats older than two years are erased (a dated stub remains). */
export async function purgeOldConversations(db: D1Database, at = new Date()) {
  await ensureGrowthTables(db)
  const cutoff = new Date(at.getTime() - RETENTION_MONTHS * 30 * 86_400_000).toISOString()
  const old = ((await db.prepare(`SELECT id FROM gc_conversations WHERE last_message_at < ? AND deleted_at IS NULL LIMIT 200`).bind(cutoff).all()).results || []) as any[]
  for (const row of old) {
    await db.batch([
      db.prepare(`DELETE FROM gc_messages WHERE conversation_id = ?`).bind(row.id),
      db.prepare(`UPDATE gc_conversations SET visitor_name = NULL, email = NULL, phone = NULL, first_question = NULL, status = 'closed', deleted_at = ? WHERE id = ?`).bind(at.toISOString(), row.id),
    ])
  }
  return old.length
}
