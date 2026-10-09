// Ndovera's pool of knowledge: everything Ndovera AI has written is kept, and an AI
// call looks in the pool before it goes out over the network.
//
// Two lookups:
//   • exact  — the same request (system + conversation + length) answered before
//   • question — a student's single question asked before in other words
//     ("what is photosynthesis?" / "explain photosynthesis"), within the same
//     topic context, for the AI tutor
//
// What is never pooled: streaming calls, images and documents (not text), and
// creative calls (temperature ≥ 0.8 — the daily digest must change every day).
// A reply that asked for JSON is stored only when it contains JSON, and when the
// same request comes back within two minutes it is treated as a retry of a reply
// that did not work: the pool is skipped and the new answer replaces the old one.

const RETRY_WINDOW_MS = 2 * 60 * 1000
const MAX_STORED = 120_000

const readyDbs = new WeakSet<object>()
export async function ensureKnowledgeTables(db: D1Database) {
  if (readyDbs.has(db as object)) return
  await db.prepare(`CREATE TABLE IF NOT EXISTS ai_knowledge (
    hash TEXT PRIMARY KEY, kind TEXT NOT NULL, question_key TEXT, question TEXT, context_key TEXT, response TEXT NOT NULL,
    hits INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, last_hit_at TEXT
  )`).run()
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_ai_knowledge_question ON ai_knowledge(question_key, context_key)`).run()
  readyDbs.add(db as object)
}

async function sha256(text: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest)).map(value => value.toString(16).padStart(2, '0')).join('')
}

const STOPWORDS = new Set(('a an and are as at be by can could define definition describe did do does explain for from give how i in is it its me meaning '
  + 'my of on or please show state tell than that the their them then there these this to us was what when where which who whom why will with would you your '
  + 'about briefly simple simply term terms understand dont don t help need want know explanation').split(' '))

/** The words that carry a question's meaning, sorted — the same for "What is osmosis?" and "explain osmosis". */
export function questionKey(question: string) {
  const words = String(question || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
    .filter(word => word && !STOPWORDS.has(word))
    .map(word => word.length > 4 ? word.replace(/(ies|es|s)$/, '') : word)
  return Array.from(new Set(words)).sort().join(' ')
}

function textOf(result: unknown): string {
  if (typeof result === 'string') return result
  const response = (result as any)?.response
  if (typeof response === 'string') return response
  if (response && typeof response === 'object') return JSON.stringify(response)
  const choice = (result as any)?.choices?.[0]?.message?.content
  return typeof choice === 'string' ? choice : ''
}

function wantsJson(messages: Array<{ role: string, content: string }>) {
  return messages.some(message => message.role === 'system' && /\bjson\b/i.test(String(message.content || '')))
}

function hasJson(text: string) {
  const body = String(text || '')
  for (const [open, close] of [['[', ']'], ['{', '}']]) {
    const start = body.indexOf(open)
    const end = body.lastIndexOf(close)
    if (start >= 0 && end > start) {
      try { JSON.parse(body.slice(start, end + 1)); return true } catch {}
    }
  }
  return false
}

export async function lookup(db: D1Database, hash: string) {
  await ensureKnowledgeTables(db)
  return db.prepare(`SELECT hash, response, hits, created_at, last_hit_at FROM ai_knowledge WHERE hash = ?`).bind(hash).first() as Promise<Record<string, any> | null>
}

export async function remember(db: D1Database, entry: { hash: string, kind: string, response: string, question?: string, contextKey?: string }) {
  await ensureKnowledgeTables(db)
  const response = String(entry.response || '')
  if (!response.trim() || response.length > MAX_STORED) return
  const question = String(entry.question || '').slice(0, 500)
  await db.prepare(`INSERT INTO ai_knowledge (hash, kind, question_key, question, context_key, response, hits, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 0, ?)
    ON CONFLICT(hash) DO UPDATE SET response = excluded.response, created_at = excluded.created_at, last_hit_at = NULL`)
    .bind(entry.hash, entry.kind, question ? questionKey(question) : null, question || null, entry.contextKey || '', response, new Date().toISOString()).run()
}

async function markHit(db: D1Database, hash: string) {
  await db.prepare(`UPDATE ai_knowledge SET hits = hits + 1, last_hit_at = ? WHERE hash = ?`).bind(new Date().toISOString(), hash).run()
}

/** A hit counts unless the same request came back moments ago — then it is a retry. */
function isRetry(row: Record<string, any>) {
  const last = Date.parse(String(row.last_hit_at || row.created_at || ''))
  return Number.isFinite(last) && Date.now() - last < RETRY_WINDOW_MS
}

type AiBinding = { run: (model: string, input: any, options?: any) => Promise<any>, [key: string]: any }

/**
 * The AI binding, with the pool in front of text generation. Everything else
 * (images, toMarkdown, streaming) goes straight through.
 */
export function withKnowledgePool(ai: AiBinding | undefined, db: D1Database | undefined): AiBinding | undefined {
  if (!ai || typeof ai.run !== 'function' || !db || (ai as any).__pooled) return ai
  const run = async (model: string, input: any, options?: any) => {
    const messages = Array.isArray(input?.messages) ? input.messages : null
    const creative = Number(input?.temperature ?? 0) >= 0.8
    if (!messages || input?.stream || creative) return ai.run(model, input, options)
    let hash = ''
    try {
      hash = await sha256(JSON.stringify({ messages, max_tokens: input.max_tokens || 0 }))
      const row = await lookup(db, hash)
      if (row && !isRetry(row)) {
        await markHit(db, hash).catch(() => null)
        return { response: String(row.response), pooled: true }
      }
    } catch { hash = hash || '' }
    const result = await ai.run(model, input, options)
    const text = textOf(result)
    if (hash && text.trim() && (!wantsJson(messages) || hasJson(text))) {
      const lastUser = [...messages].reverse().find((message: any) => message.role === 'user')
      await remember(db, { hash, kind: 'text', response: text, question: messages.length <= 3 ? String(lastUser?.content || '') : '' }).catch(() => null)
    }
    return result
  }
  // A Proxy rather than a copy: the binding's own methods keep the binding as `this`.
  return new Proxy(ai, {
    get(target, prop) {
      if (prop === 'run') return run
      if (prop === '__pooled') return true
      if (prop === '__raw') return target
      const value = Reflect.get(target, prop)
      return typeof value === 'function' ? value.bind(target) : value
    },
  })
}

/** The binding without the pool — for "regenerate", where a new answer is the point. */
export function rawAi(ai: any) {
  return ai?.__raw || ai
}

/** A single question asked before (in other words) in the same context: its stored answer. */
export async function findAnswer(db: D1Database, question: string, contextKey = '') {
  const key = questionKey(question)
  // One or two meaningful words is too little to know it is the same question.
  if (key.split(' ').filter(Boolean).length < 2 && key.length < 10) return null
  await ensureKnowledgeTables(db)
  const row = await db.prepare(`SELECT hash, response FROM ai_knowledge WHERE kind = 'answer' AND question_key = ? AND context_key = ? ORDER BY hits DESC, created_at DESC LIMIT 1`)
    .bind(key, contextKey).first() as Record<string, any> | null
  if (!row) return null
  await markHit(db, String(row.hash)).catch(() => null)
  return String(row.response)
}

export async function rememberAnswer(db: D1Database, question: string, answer: string, contextKey = '') {
  const hash = await sha256(`answer:${contextKey}:${questionKey(question)}`)
  await remember(db, { hash, kind: 'answer', response: answer, question, contextKey })
}
