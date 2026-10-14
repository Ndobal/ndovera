// School messaging (conversations and messages): who is in a conversation, and the
// rules every read and write follows.
//
//   - A conversation's people are kept in `conversation_participants` (one row each,
//     indexed), so a person's chats are found directly — never by reading the newest
//     conversations on the whole platform and filtering (which lost older chats).
//   - Only someone in a conversation may read it, write to it or mark it read. The
//     sender is always the signed-in person; a sender id sent by the browser is ignored.
//   - A thread shows its newest messages (the last MESSAGE_PAGE), oldest first.
//   - A new conversation is only with people of the same school (or Ndovera support).

export const MESSAGE_PAGE = 300
export const MAX_MESSAGE_LENGTH = 4000

const comparable = (value: unknown) => String(value ?? '').trim().toLowerCase()
const parseList = (value: unknown) => { try { const list = JSON.parse(String(value || '[]')); return Array.isArray(list) ? list.map(String) : [] } catch { return [] } }

const readyDbs = new WeakSet<object>()
/** The participants index, filled once from the conversations already there. */
export async function ensureParticipantIndex(db: D1Database) {
  if (readyDbs.has(db as object)) return
  await db.prepare(`CREATE TABLE IF NOT EXISTS conversation_participants (conversation_id TEXT NOT NULL, participant TEXT NOT NULL, PRIMARY KEY (conversation_id, participant))`).run()
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_conversation_participants_person ON conversation_participants(participant)`).run()
  await db.prepare(`CREATE TABLE IF NOT EXISTS messaging_meta (key TEXT PRIMARY KEY, value TEXT)`).run()
  const done = await db.prepare(`SELECT value FROM messaging_meta WHERE key = 'participants_backfilled'`).first().catch(() => null)
  if (!done) {
    const exists = await db.prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'conversations'`).first().catch(() => null)
    if (exists) {
      await db.prepare(`INSERT OR IGNORE INTO conversation_participants (conversation_id, participant)
        SELECT c.id, lower(trim(j.value)) FROM conversations c, json_each(CASE WHEN json_valid(c.participants) THEN c.participants ELSE '[]' END) j WHERE trim(COALESCE(j.value, '')) != ''`).run()
    }
    await db.prepare(`INSERT OR REPLACE INTO messaging_meta (key, value) VALUES ('participants_backfilled', ?)`).bind(new Date().toISOString()).run()
  }
  readyDbs.add(db as object)
}

export function participantStatements(db: D1Database, conversationId: string, participants: string[]) {
  return Array.from(new Set(participants.map(comparable).filter(Boolean)))
    .map(participant => db.prepare(`INSERT OR IGNORE INTO conversation_participants (conversation_id, participant) VALUES (?, ?)`).bind(conversationId, participant))
}

function mapConversation(row: Record<string, any>) {
  return { id: String(row.id), subject: row.subject ?? null, participants: parseList(row.participants), created_at: row.created_at, updated_at: row.updated_at }
}

/** The conversations any of these identifiers (id, email, display id…) is in, newest first. */
export async function conversationsFor(db: D1Database, identifiers: string[], limit = 200) {
  await ensureParticipantIndex(db)
  const ids = Array.from(new Set(identifiers.map(comparable).filter(Boolean))).slice(0, 40)
  if (!ids.length) return []
  const rows = await db.prepare(`SELECT c.id, c.subject, c.participants, c.created_at, c.updated_at FROM conversations c
    WHERE c.id IN (SELECT conversation_id FROM conversation_participants WHERE participant IN (${ids.map(() => '?').join(',')}))
    ORDER BY c.updated_at DESC LIMIT ?`).bind(...ids, limit).all()
  return ((rows.results || []) as Record<string, any>[]).map(mapConversation)
}

/** The conversation, if this person is in it; otherwise null (callers answer 404). */
export async function conversationIfMember(db: D1Database, conversationId: string, identifiers: string[]) {
  const row = await db.prepare(`SELECT id, subject, participants, created_at, updated_at FROM conversations WHERE id = ?`).bind(conversationId).first() as Record<string, any> | null
  if (!row) return null
  const conversation = mapConversation(row)
  const mine = new Set(identifiers.map(comparable).filter(Boolean))
  return conversation.participants.some(participant => mine.has(comparable(participant))) ? conversation : null
}

/** The newest MESSAGE_PAGE messages of a conversation, oldest first. */
export async function newestMessages(db: D1Database, conversationId: string, limit = MESSAGE_PAGE) {
  const rows = await db.prepare(`SELECT id, conversation_id, sender_id, body, metadata, sent_at, read_at FROM messages WHERE conversation_id = ? ORDER BY sent_at DESC LIMIT ?`).bind(conversationId, limit).all()
  return ((rows.results || []) as Record<string, any>[]).reverse().map(row => {
    let metadata: Record<string, any> = {}
    try { metadata = row.metadata ? JSON.parse(String(row.metadata)) : {} } catch { metadata = {} }
    return { ...row, metadata }
  })
}

/** An existing conversation with exactly these people (any of their identifiers), if there is one. */
export async function findConversationWith(db: D1Database, actorIdentifiers: string[], participantSets: string[][]) {
  const candidates = await conversationsFor(db, actorIdentifiers, 500)
  return candidates.find(conversation => {
    const people = conversation.participants.map(comparable)
    if (people.length !== participantSets.length) return false
    return participantSets.every(set => set.some(identifier => people.includes(comparable(identifier))))
  }) || null
}
