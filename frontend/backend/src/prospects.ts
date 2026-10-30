// School outreach (Growth Centre, docs/premium-upgrade-implementation-plan.md §6).
//
// Gathering: once a week (Sunday night, Lagos) Ndovera visits the public web pages Ami has
// listed as sources — school websites and school directories in Nigeria and across Africa —
// plus, when a search key is set, pages found by searching for schools in each country.
// Only addresses printed on those pages are kept, each with the page it came from. Nothing is
// guessed or made up by AI. An address is stored once, ever: it is never gathered again, and an
// address that opted out is never written to again.
//
// Sending (only when Ami switches it on): the plan's cadence — day 1, day 15, then every two
// months — stopping on reply, demo, opt-out or when the school joins Ndovera. Every email names
// the sender and carries a one-click unsubscribe link. A daily cap protects the mailbox.

export type ProspectSettings = {
  sending: boolean
  dailyCap: number
  // Countries Ndovera gathers for but does not email automatically (local consent rules).
  noAutoSend: string[]
  templates: { first: Template, second: Template, later: Template }
}
type Template = { subject: string, body: string }

export const AFRICAN_COUNTRIES: Record<string, string> = {
  NG: 'Nigeria', GH: 'Ghana', KE: 'Kenya', ZA: 'South Africa', UG: 'Uganda', TZ: 'Tanzania', RW: 'Rwanda', CM: 'Cameroon',
  SL: 'Sierra Leone', LR: 'Liberia', GM: 'The Gambia', ZM: 'Zambia', ZW: 'Zimbabwe', MW: 'Malawi', BW: 'Botswana', NA: 'Namibia',
  ET: 'Ethiopia', EG: 'Egypt', MA: 'Morocco', SN: 'Senegal', CI: "Côte d'Ivoire", BJ: 'Benin', TG: 'Togo', BF: 'Burkina Faso',
  ML: 'Mali', NE: 'Niger', SD: 'Sudan', SS: 'South Sudan', SO: 'Somalia', MZ: 'Mozambique', AO: 'Angola', CD: 'DR Congo',
  CG: 'Congo', GA: 'Gabon', LS: 'Lesotho', SZ: 'Eswatini', MU: 'Mauritius', DZ: 'Algeria', TN: 'Tunisia', LY: 'Libya',
}

const DAY = 86_400_000
// Day 1, day 15, then every two months.
export const CADENCE_DAYS = { second: 14, later: 60 }
export const BOT_USER_AGENT = 'NdoveraBot/1.0 (+https://ndovera.com/contact; school outreach, public contact pages only)'

export const DEFAULT_SETTINGS: ProspectSettings = {
  sending: false,
  dailyCap: 40,
  // South Africa's POPIA (s69) needs prior consent for unsolicited electronic marketing.
  noAutoSend: ['ZA'],
  templates: {
    first: {
      subject: 'Running {schoolName} in one place: results, fees and parents',
      body: 'Dear {schoolName} team,\n\nI am writing from Ndovera, a school management platform built for African schools. Schools use Ndovera to keep C.A. score sheets and report cards, record and remind about school fees, send parents notices by WhatsApp and email, run CBT exams and practice, and prepare payroll — in one app that also works offline.\n\nIf it would help {schoolName}, we would be glad to show you around in a short demo, at no cost: reply to this email or visit https://ndovera.com.\n\nWarm regards,\nThe Ndovera team',
    },
    second: {
      subject: 'A short follow-up for {schoolName}',
      body: 'Dear {schoolName} team,\n\nA short follow-up to our note two weeks ago. Many schools start with one thing — report cards, school fees or parent messages — and add the rest later. You can see the plans at https://ndovera.com/pricing, or reply and we will arrange a demo at a time that suits you.\n\nWarm regards,\nThe Ndovera team',
    },
    later: {
      subject: 'What is new in Ndovera for schools',
      body: 'Dear {schoolName} team,\n\nA brief update from Ndovera: schools now use it for payroll and payslips, WhatsApp-only parent messages, offline score sheets and full report cards. If any of this would help {schoolName}, reply to this email or visit https://ndovera.com.\n\nWarm regards,\nThe Ndovera team',
    },
  },
}

export function normalizeSettings(input: any): ProspectSettings {
  const source = input && typeof input === 'object' ? input : {}
  const template = (key: keyof ProspectSettings['templates']) => {
    const value = source.templates?.[key] || {}
    const subject = String(value.subject || '').trim().slice(0, 200)
    const body = String(value.body || '').trim().slice(0, 5000)
    return subject && body ? { subject, body } : DEFAULT_SETTINGS.templates[key]
  }
  const cap = Number(source.dailyCap)
  return {
    sending: source.sending === true,
    dailyCap: Number.isFinite(cap) ? Math.max(1, Math.min(300, Math.round(cap))) : DEFAULT_SETTINGS.dailyCap,
    noAutoSend: Array.isArray(source.noAutoSend)
      ? [...new Set(source.noAutoSend.map((code: unknown) => String(code || '').toUpperCase()).filter((code: string) => code in AFRICAN_COUNTRIES))] as string[]
      : DEFAULT_SETTINGS.noAutoSend,
    templates: { first: template('first'), second: template('second'), later: template('later') },
  }
}

export async function ensureProspectTables(db: D1Database) {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS prospect_sources (id TEXT PRIMARY KEY, url TEXT NOT NULL UNIQUE, country TEXT NOT NULL, label TEXT, added_by TEXT, added_at TEXT NOT NULL, last_crawled_at TEXT, last_found INTEGER NOT NULL DEFAULT 0, last_error TEXT, active INTEGER NOT NULL DEFAULT 1)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS prospect_schools (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, domain TEXT NOT NULL, school_name TEXT, country TEXT NOT NULL, source_url TEXT NOT NULL, found_at TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'new', step INTEGER NOT NULL DEFAULT 0, last_sent_at TEXT, next_due_at TEXT, stopped_reason TEXT, updated_at TEXT NOT NULL)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_prospect_due ON prospect_schools (status, next_due_at)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_prospect_country ON prospect_schools (country, found_at)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS prospect_messages (id TEXT PRIMARY KEY, prospect_id TEXT NOT NULL, step INTEGER NOT NULL, subject TEXT NOT NULL, sent_at TEXT NOT NULL, result TEXT NOT NULL)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_prospect_messages_day ON prospect_messages (sent_at)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS prospect_runs (week TEXT PRIMARY KEY, started_at TEXT NOT NULL, finished_at TEXT, sources_crawled INTEGER NOT NULL DEFAULT 0, found_new INTEGER NOT NULL DEFAULT 0, searched INTEGER NOT NULL DEFAULT 0)`),
  ])
}

// ─── Finding addresses on a page ─────────────────────────────────────────────

const IGNORED_DOMAINS = /(^|\.)(example\.(com|org)|sentry\.io|wixpress\.com|w3\.org|schema\.org|domain\.com|email\.com|yourdomain\.com|godaddy\.com|wordpress\.(com|org)|cloudflare\.com|google\.com|facebook\.com|ndovera\.com)$/i
const IGNORED_LOCAL = /^(no-?reply|do-?not-?reply|postmaster|abuse|webmaster|hostmaster|mailer-daemon|privacy|example|test|user|name|email|your)$/i
const FILE_LIKE = /\.(png|jpe?g|gif|webp|svg|css|js|ico)$/i

export function normalizeEmail(raw: string) {
  const email = String(raw || '').trim().toLowerCase().replace(/^mailto:/, '').split('?')[0].replace(/[.,;:)\]]+$/, '')
  if (!/^[a-z0-9._%+-]{1,64}@[a-z0-9.-]+\.[a-z]{2,24}$/.test(email)) return ''
  const [local, domain] = email.split('@')
  if (FILE_LIKE.test(email) || IGNORED_DOMAINS.test(domain) || IGNORED_LOCAL.test(local)) return ''
  return email
}

/** Addresses written on the page: mailto links, plain text, and the common "info [at] school [dot] ng" form. */
export function extractEmails(html: string) {
  const text = String(html || '')
    .replace(/&#64;|&commat;/gi, '@').replace(/&#46;|&period;/gi, '.')
    .replace(/\s*[[(]\s*at\s*[\])]\s*/gi, '@').replace(/\s*[[(]\s*dot\s*[\])]\s*/gi, '.')
  const found = new Set<string>()
  for (const match of text.matchAll(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,24}/gi)) {
    const email = normalizeEmail(match[0])
    if (email) found.add(email)
  }
  return [...found]
}

export function pageTitle(html: string) {
  const match = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(String(html || ''))
  return match ? match[1].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim().split(/\s[|–-]\s/)[0].slice(0, 160) : ''
}

/** Same-site links that usually hold contact details. */
export function contactLinks(html: string, base: string) {
  const out = new Set<string>()
  let origin = ''
  try { origin = new URL(base).origin } catch { return [] }
  for (const match of String(html || '').matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const [, href, label] = match
    if (!/contact|about|admission|enquir|reach/i.test(`${href} ${label}`)) continue
    try {
      const url = new URL(href, base)
      if (url.origin === origin && /^https?:$/.test(url.protocol)) out.add(url.toString())
    } catch {}
    if (out.size >= 3) break
  }
  return [...out]
}

/** A simple robots.txt check for our user agent and '*': Disallow prefixes only. */
export function robotsAllows(robots: string, path: string) {
  const lines = String(robots || '').split(/\r?\n/).map(line => line.replace(/#.*/, '').trim())
  let applies = false
  const disallowed: string[] = []
  for (const line of lines) {
    const [rawKey, ...rest] = line.split(':')
    const key = String(rawKey || '').trim().toLowerCase()
    const value = rest.join(':').trim()
    if (key === 'user-agent') applies = value === '*' || /ndoverabot/i.test(value)
    else if (key === 'disallow' && applies && value) disallowed.push(value)
  }
  return !disallowed.some(prefix => path.startsWith(prefix))
}

// ─── The weekly gathering ────────────────────────────────────────────────────

/** The Monday (Lagos) that starts this week, as YYYY-MM-DD: one gathering per week. */
export function weekKey(at = new Date()) {
  const lagos = new Date(at.getTime() + 3600_000)
  const day = (lagos.getUTCDay() + 6) % 7
  return new Date(Date.UTC(lagos.getUTCFullYear(), lagos.getUTCMonth(), lagos.getUTCDate() - day)).toISOString().slice(0, 10)
}

/** Sunday 02:00–05:59 Lagos (01:00–04:59 UTC). */
export function inGatherWindow(at = new Date()) {
  return at.getUTCDay() === 0 && at.getUTCHours() >= 1 && at.getUTCHours() <= 4
}

type Fetcher = (url: string, init?: RequestInit) => Promise<Response>

async function fetchText(fetcher: Fetcher, url: string) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8000)
  try {
    const response = await fetcher(url, { headers: { 'User-Agent': BOT_USER_AGENT, Accept: 'text/html,text/plain' }, signal: controller.signal, redirect: 'follow' })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const type = response.headers.get('content-type') || ''
    if (type && !/text\/(html|plain)|xhtml/i.test(type)) throw new Error('not a web page')
    return (await response.text()).slice(0, 600_000)
  } finally { clearTimeout(timer) }
}

/** Visit one source (and up to three of its contact pages) and store the new addresses. */
export async function crawlSource(db: D1Database, fetcher: Fetcher, source: { id: string, url: string, country: string }, now = new Date()) {
  const at = now.toISOString()
  try {
    const start = new URL(source.url)
    const robots = await fetchText(fetcher, `${start.origin}/robots.txt`).catch(() => '')
    if (!robotsAllows(robots, start.pathname)) throw new Error('robots.txt does not allow this page')
    const html = await fetchText(fetcher, source.url)
    const pages = [{ url: source.url, html }]
    for (const link of contactLinks(html, source.url)) {
      if (!robotsAllows(robots, new URL(link).pathname)) continue
      const extra = await fetchText(fetcher, link).catch(() => '')
      if (extra) pages.push({ url: link, html: extra })
    }
    const title = pageTitle(html)
    const statements: D1PreparedStatement[] = []
    const seen = new Set<string>()
    for (const page of pages) {
      for (const email of extractEmails(page.html)) {
        if (seen.has(email)) continue
        seen.add(email)
        // INSERT OR IGNORE on the unique address: an address is stored once, ever.
        statements.push(db.prepare(`INSERT OR IGNORE INTO prospect_schools (id, email, domain, school_name, country, source_url, found_at, status, step, next_due_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'new', 0, ?, ?)`)
          .bind(crypto.randomUUID(), email, email.split('@')[1], title || null, source.country, page.url, at, at, at))
      }
    }
    let added = 0
    for (let index = 0; index < statements.length; index += 50) {
      const results = await db.batch(statements.slice(index, index + 50))
      added += results.reduce((sum, result: any) => sum + Number(result?.meta?.changes || 0), 0)
    }
    await db.prepare(`UPDATE prospect_sources SET last_crawled_at = ?, last_found = ?, last_error = NULL WHERE id = ?`).bind(at, added, source.id).run()
    return { added, found: seen.size }
  } catch (error) {
    await db.prepare(`UPDATE prospect_sources SET last_crawled_at = ?, last_error = ? WHERE id = ?`).bind(at, String((error as Error)?.message || error).slice(0, 300), source.id).run()
    return { added: 0, found: 0, error: String((error as Error)?.message || error) }
  }
}

/**
 * Pages found by searching for schools in a country (Brave Search API), added as sources so
 * the crawl visits them. Runs once a week, two countries at a time in rotation.
 */
export async function discoverSources(db: D1Database, fetcher: Fetcher, apiKey: string, week: string, countries: string[]) {
  if (!apiKey || !countries.length) return 0
  const index = Math.floor(new Date(`${week}T00:00:00Z`).getTime() / (7 * DAY))
  const picked = [0, 1].map(offset => countries[(index * 2 + offset) % countries.length])
  let added = 0
  for (const code of [...new Set(picked)]) {
    const country = AFRICAN_COUNTRIES[code]
    for (const query of [`secondary school ${country} contact email`, `private school ${country} admissions contact`]) {
      const response = await fetcher(`https://api.search.brave.com/res/v1/web/search?count=20&q=${encodeURIComponent(query)}`, { headers: { Accept: 'application/json', 'X-Subscription-Token': apiKey } }).catch(() => null)
      if (!response?.ok) continue
      const data = await response.json().catch(() => ({})) as any
      for (const result of data?.web?.results || []) {
        const url = String(result?.url || '')
        if (!/^https?:\/\//.test(url) || /facebook|instagram|twitter|x\.com|linkedin|youtube|wikipedia|tiktok/i.test(url)) continue
        const outcome = await db.prepare(`INSERT OR IGNORE INTO prospect_sources (id, url, country, label, added_by, added_at) VALUES (?, ?, ?, ?, 'search', ?)`)
          .bind(crypto.randomUUID(), url.slice(0, 500), code, String(result?.title || '').slice(0, 160), new Date().toISOString()).run()
        added += Number(outcome?.meta?.changes || 0)
      }
    }
  }
  return added
}

/** One step of the weekly gathering: a few sources not yet visited this week. */
export async function gatherTick(db: D1Database, fetcher: Fetcher, options: { at?: Date, batch?: number, searchKey?: string } = {}) {
  await ensureProspectTables(db)
  const at = options.at || new Date()
  const week = weekKey(at)
  const run = await db.prepare(`SELECT * FROM prospect_runs WHERE week = ?`).bind(week).first() as any
  if (!run) {
    await db.prepare(`INSERT OR IGNORE INTO prospect_runs (week, started_at) VALUES (?, ?)`).bind(week, at.toISOString()).run()
    const searched = options.searchKey ? await discoverSources(db, fetcher, options.searchKey, week, Object.keys(AFRICAN_COUNTRIES)) : 0
    if (searched) await db.prepare(`UPDATE prospect_runs SET searched = ? WHERE week = ?`).bind(searched, week).run()
  } else if (run.finished_at) return { week, done: true, crawled: 0, added: 0 }
  const weekStart = `${week}T00:00:00.000Z`
  const due = ((await db.prepare(`SELECT id, url, country FROM prospect_sources WHERE active = 1 AND (last_crawled_at IS NULL OR last_crawled_at < ?) ORDER BY last_crawled_at IS NOT NULL, last_crawled_at LIMIT ?`).bind(weekStart, options.batch || 6).all()).results || []) as any[]
  let added = 0
  for (const source of due) added += (await crawlSource(db, fetcher, source, at)).added
  if (due.length) await db.prepare(`UPDATE prospect_runs SET sources_crawled = sources_crawled + ?, found_new = found_new + ? WHERE week = ?`).bind(due.length, added, week).run()
  else await db.prepare(`UPDATE prospect_runs SET finished_at = ? WHERE week = ?`).bind(at.toISOString(), week).run()
  return { week, done: !due.length, crawled: due.length, added }
}

// ─── Sending ─────────────────────────────────────────────────────────────────

/** 09:00–10:59 Lagos on weekdays. */
export function inSendWindow(at = new Date()) {
  const day = at.getUTCDay()
  return day >= 1 && day <= 5 && (at.getUTCHours() === 8 || at.getUTCHours() === 9)
}

export async function unsubscribeToken(secret: string, email: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(`outreach:${secret}`), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(email.toLowerCase()))
  return [...new Uint8Array(signature)].slice(0, 16).map(byte => byte.toString(16).padStart(2, '0')).join('')
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] as string))
}

export function renderOutreachEmail(template: Template, prospect: { school_name?: string | null, domain: string }, unsubscribeUrl: string) {
  const schoolName = String(prospect.school_name || '').trim() || prospect.domain
  const fill = (text: string) => text.replace(/\{schoolName\}/g, schoolName)
  const subject = fill(template.subject)
  const paragraphs = fill(template.body).split(/\n{2,}/).map(part => `<p style="margin:0 0 14px;">${escapeHtml(part).replace(/\n/g, '<br>')}</p>`).join('')
  const html = `<div style="font-family:Segoe UI,Arial,sans-serif;color:#191970;line-height:1.6;max-width:640px;margin:0 auto;padding:24px;">${paragraphs}
    <p style="margin:24px 0 0;font-size:12px;color:#475569;">You are receiving this one-to-one note because this address is published on your school's website. Ndovera, Lagos, Nigeria · <a href="https://ndovera.com" style="color:#475569;">ndovera.com</a><br>Not interested? <a href="${escapeHtml(unsubscribeUrl)}" style="color:#475569;">Stop these emails</a> — one click, and we will not write again.</p></div>`
  return { subject, html }
}

type SendDeps = {
  db: D1Database
  send: ((to: string, subject: string, html: string) => Promise<boolean>) | null
  secret: string
  baseUrl: string
  at?: Date
  batch?: number
}

/** Emails that are due, up to the daily cap; stops for schools that joined Ndovera. */
export async function sendTick(deps: SendDeps, settings: ProspectSettings) {
  const { db } = deps
  await ensureProspectTables(db)
  if (!settings.sending || !deps.send) return { sent: 0, reason: settings.sending ? 'email is not set up' : 'sending is off' }
  const at = deps.at || new Date()
  const dayStart = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate())).toISOString()
  const sentToday = Number(((await db.prepare(`SELECT COUNT(*) AS n FROM prospect_messages WHERE sent_at >= ? AND result = 'sent'`).bind(dayStart).first()) as any)?.n || 0)
  const room = Math.min(settings.dailyCap - sentToday, deps.batch || 10)
  if (room <= 0) return { sent: 0, reason: 'daily cap reached' }
  const blocked = settings.noAutoSend.length ? ` AND country NOT IN (${settings.noAutoSend.map(() => '?').join(', ')})` : ''
  const due = ((await db.prepare(`SELECT * FROM prospect_schools WHERE status IN ('new', 'active') AND next_due_at <= ?${blocked} ORDER BY next_due_at LIMIT ?`)
    .bind(at.toISOString(), ...settings.noAutoSend, room).all()).results || []) as any[]
  let sent = 0
  for (const prospect of due) {
    // A school that has joined Ndovera is not written to again.
    const joined = await db.prepare(`SELECT 1 FROM users WHERE lower(email) = ? OR (lower(email) LIKE ? AND role IN ('owner', 'hos')) LIMIT 1`).bind(prospect.email, `%@${prospect.domain}`).first().catch(() => null)
    if (joined) {
      await db.prepare(`UPDATE prospect_schools SET status = 'converted', stopped_reason = 'joined Ndovera', next_due_at = NULL, updated_at = ? WHERE id = ?`).bind(at.toISOString(), prospect.id).run()
      continue
    }
    const step = Number(prospect.step || 0)
    const template = step === 0 ? settings.templates.first : step === 1 ? settings.templates.second : settings.templates.later
    const token = await unsubscribeToken(deps.secret, prospect.email)
    const email = renderOutreachEmail(template, prospect, `${deps.baseUrl}/api/outreach/unsubscribe?e=${encodeURIComponent(prospect.email)}&t=${token}`)
    const ok = await deps.send(prospect.email, email.subject, email.html).catch(() => false)
    const nextDue = new Date(at.getTime() + (step === 0 ? CADENCE_DAYS.second : CADENCE_DAYS.later) * DAY).toISOString()
    await db.batch([
      db.prepare(`INSERT INTO prospect_messages (id, prospect_id, step, subject, sent_at, result) VALUES (?, ?, ?, ?, ?, ?)`).bind(crypto.randomUUID(), prospect.id, step, email.subject, at.toISOString(), ok ? 'sent' : 'failed'),
      ok
        ? db.prepare(`UPDATE prospect_schools SET status = 'active', step = step + 1, last_sent_at = ?, next_due_at = ?, updated_at = ? WHERE id = ?`).bind(at.toISOString(), nextDue, at.toISOString(), prospect.id)
        // A failed send is tried again tomorrow; after three failures the address is set aside.
        : db.prepare(`UPDATE prospect_schools SET status = CASE WHEN (SELECT COUNT(*) FROM prospect_messages WHERE prospect_id = ? AND result = 'failed') >= 3 THEN 'bounced' ELSE status END, next_due_at = ?, updated_at = ? WHERE id = ?`).bind(prospect.id, new Date(at.getTime() + DAY).toISOString(), at.toISOString(), prospect.id),
    ])
    if (ok) sent += 1
  }
  return { sent }
}

/** Stop writing to an address for good (unsubscribe, reply, demo, joined, removed by Ami). */
export async function stopProspect(db: D1Database, email: string, status: 'opted_out' | 'replied' | 'demo' | 'converted' | 'paused', reason: string) {
  await ensureProspectTables(db)
  const at = new Date().toISOString()
  const normalized = normalizeEmail(email) || String(email || '').trim().toLowerCase()
  const result = await db.prepare(`UPDATE prospect_schools SET status = ?, stopped_reason = ?, next_due_at = NULL, updated_at = ? WHERE email = ?`).bind(status, reason.slice(0, 200), at, normalized).run()
  // An opt-out for an address not gathered yet is still remembered, so it is never written to.
  if (status === 'opted_out' && !Number(result?.meta?.changes || 0) && normalized.includes('@')) {
    await db.prepare(`INSERT OR IGNORE INTO prospect_schools (id, email, domain, country, source_url, found_at, status, stopped_reason, updated_at) VALUES (?, ?, ?, 'NG', 'unsubscribe', ?, 'opted_out', ?, ?)`)
      .bind(crypto.randomUUID(), normalized, normalized.split('@')[1], at, reason.slice(0, 200), at).run()
  }
  return Number(result?.meta?.changes || 0)
}
