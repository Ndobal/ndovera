// News: headlines only, from Nigerian outlets' own RSS feeds. One edition a day, fetched at
// midnight Lagos time (23:00 UTC), kept as a history. Ndovera shows the headline and the outlet;
// opening one goes to the outlet's own site. No article text is copied or stored.

export const NEWS_OUTLETS: Array<{ key: string, name: string, site: string, feeds: string[] }> = [
  { key: 'punch', name: 'Punch', site: 'https://punchng.com', feeds: ['https://punchng.com/feed/'] },
  { key: 'vanguard', name: 'Vanguard', site: 'https://www.vanguardngr.com', feeds: ['https://www.vanguardngr.com/feed/'] },
  { key: 'dailytimes', name: 'Daily Times', site: 'https://dailytimesng.com', feeds: ['https://dailytimesng.com/feed/'] },
  { key: 'saharareporters', name: 'Sahara Reporters', site: 'https://saharareporters.com', feeds: ['https://saharareporters.com/feeds/latest/feed', 'https://saharareporters.com/rss.xml'] },
  { key: 'tvc', name: 'TVC News', site: 'https://www.tvcnews.tv', feeds: ['https://www.tvcnews.tv/feed/'] },
  { key: 'arise', name: 'Arise News', site: 'https://www.arise.tv', feeds: ['https://www.arise.tv/feed/'] },
  { key: 'channels', name: 'Channels TV', site: 'https://www.channelstv.com', feeds: ['https://www.channelstv.com/feed/'] },
  { key: 'premiumtimes', name: 'Premium Times', site: 'https://www.premiumtimesng.com', feeds: ['https://www.premiumtimesng.com/feed'] },
  { key: 'guardian', name: 'The Guardian Nigeria', site: 'https://guardian.ng', feeds: ['https://guardian.ng/feed/'] },
  { key: 'thisday', name: 'ThisDay', site: 'https://www.thisdaylive.com', feeds: ['https://www.thisdaylive.com/index.php/feed/'] },
  { key: 'dailytrust', name: 'Daily Trust', site: 'https://dailytrust.com', feeds: ['https://dailytrust.com/feed/'] },
  { key: 'thenation', name: 'The Nation', site: 'https://thenationonlineng.net', feeds: ['https://thenationonlineng.net/feed/'] },
]

const PER_OUTLET = 12
const KEEP_DAYS = 120

export async function ensureNewsTables(db: D1Database) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS news_headlines (
    id TEXT PRIMARY KEY, edition TEXT NOT NULL, outlet TEXT NOT NULL, title TEXT NOT NULL, link TEXT NOT NULL,
    published_at TEXT, position INTEGER NOT NULL DEFAULT 0, fetched_at TEXT NOT NULL)`).run()
  await db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_news_edition_link ON news_headlines (edition, link)`).run()
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_news_edition ON news_headlines (edition, outlet, position)`).run()
}

/** The Lagos calendar date (Lagos is UTC+1 all year). */
export function lagosDate(at = new Date()) {
  return new Date(at.getTime() + 60 * 60 * 1000).toISOString().slice(0, 10)
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#8217': '’', '#8216': '‘', '#8220': '“', '#8221': '”', '#8211': '–', '#8212': '—', '#038': '&' }
function decode(text: string) {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&#x([0-9a-f]+);/gi, (_m, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&(#?\w+);/g, (match, name) => ENTITIES[name] ?? (name.startsWith('#') && /^#\d+$/.test(name) ? String.fromCodePoint(Number(name.slice(1))) : match))
    .replace(/\s+/g, ' ')
    .trim()
}

function tag(block: string, name: string) {
  const found = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'))
  return found ? decode(found[1]) : ''
}

/** Only plain web links on the outlet's own site (or its subdomains) are kept. */
export function safeOutletLink(link: string, site: string) {
  try {
    const url = new URL(link.trim())
    if (!['http:', 'https:'].includes(url.protocol)) return ''
    const host = url.hostname.replace(/^www\./, '')
    const home = new URL(site).hostname.replace(/^www\./, '')
    if (host !== home && !host.endsWith(`.${home}`)) return ''
    return url.toString()
  } catch { return '' }
}

/** Headlines from an RSS 2.0 or Atom feed: [{ title, link, publishedAt }]. */
export function parseFeed(xml: string, site: string) {
  const items = [...xml.matchAll(/<item[\s>][\s\S]*?<\/item>/gi)].map(match => match[0])
  const entries = items.length ? [] : [...xml.matchAll(/<entry[\s>][\s\S]*?<\/entry>/gi)].map(match => match[0])
  const out: Array<{ title: string, link: string, publishedAt: string }> = []
  for (const block of items) {
    const link = safeOutletLink(tag(block, 'link') || tag(block, 'guid'), site)
    const title = tag(block, 'title')
    if (title && link) out.push({ title: title.slice(0, 300), link, publishedAt: isoOrEmpty(tag(block, 'pubDate') || tag(block, 'dc:date')) })
  }
  for (const block of entries) {
    const href = block.match(/<link[^>]*href="([^"]+)"/i)?.[1] || ''
    const link = safeOutletLink(decode(href), site)
    const title = tag(block, 'title')
    if (title && link) out.push({ title: title.slice(0, 300), link, publishedAt: isoOrEmpty(tag(block, 'updated') || tag(block, 'published')) })
  }
  return out
}

function isoOrEmpty(value: string) {
  const time = Date.parse(value)
  return Number.isFinite(time) ? new Date(time).toISOString() : ''
}

type Fetcher = (url: string) => Promise<string>
const defaultFetcher: Fetcher = async (url) => {
  const response = await fetch(url, { headers: { 'User-Agent': 'NdoveraNews/1.0 (+https://ndovera.com; headlines with links back)', Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml' }, signal: AbortSignal.timeout(15000) })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.text()
}

/**
 * Builds the day's edition: the latest headlines of each outlet. Runs once a day (midnight Lagos);
 * running again for the same edition only adds headlines not already in it.
 */
export async function buildNewsEdition(db: D1Database, options: { edition?: string, fetcher?: Fetcher, now?: Date } = {}) {
  await ensureNewsTables(db)
  const now = options.now || new Date()
  const edition = options.edition || lagosDate(now)
  const fetcher = options.fetcher || defaultFetcher
  const report: Record<string, number | string> = {}
  const statements: D1PreparedStatement[] = []
  await Promise.all(NEWS_OUTLETS.map(async outlet => {
    for (const feed of outlet.feeds) {
      try {
        const headlines = parseFeed(await fetcher(feed), outlet.site).slice(0, PER_OUTLET)
        if (!headlines.length) continue
        headlines.forEach((item, position) => statements.push(db.prepare(`INSERT OR IGNORE INTO news_headlines (id, edition, outlet, title, link, published_at, position, fetched_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
          .bind(crypto.randomUUID(), edition, outlet.key, item.title, item.link, item.publishedAt || null, position, now.toISOString())))
        report[outlet.key] = headlines.length
        return
      } catch (error) {
        report[outlet.key] = error instanceof Error ? error.message : 'failed'
      }
    }
    if (report[outlet.key] === undefined) report[outlet.key] = 'no headlines'
  }))
  for (let i = 0; i < statements.length; i += 50) await db.batch(statements.slice(i, i + 50))
  const cutoff = new Date(now.getTime() - KEEP_DAYS * 86400000).toISOString().slice(0, 10)
  await db.prepare(`DELETE FROM news_headlines WHERE edition < ?`).bind(cutoff).run().catch(() => null)
  return { edition, saved: statements.length, outlets: report }
}

/** The editions kept (newest first), and one edition's headlines grouped by outlet. */
export async function readNews(db: D1Database, edition?: string) {
  await ensureNewsTables(db)
  const editions = ((await db.prepare(`SELECT edition, COUNT(*) AS headlines FROM news_headlines GROUP BY edition ORDER BY edition DESC LIMIT ?`).bind(KEEP_DAYS).all()).results || []) as Array<{ edition: string, headlines: number }>
  const chosen = edition && editions.some(item => item.edition === edition) ? edition : editions[0]?.edition || ''
  const rows = chosen
    ? ((await db.prepare(`SELECT outlet, title, link, published_at FROM news_headlines WHERE edition = ? ORDER BY outlet, position LIMIT 400`).bind(chosen).all()).results || []) as Record<string, any>[]
    : []
  const outlets = NEWS_OUTLETS.map(outlet => ({
    key: outlet.key, name: outlet.name, site: outlet.site,
    headlines: rows.filter(row => row.outlet === outlet.key).map(row => ({ title: String(row.title), link: String(row.link), publishedAt: row.published_at ? String(row.published_at) : '' })),
  })).filter(outlet => outlet.headlines.length)
  return { edition: chosen, editions: editions.map(item => ({ edition: item.edition, headlines: Number(item.headlines) })), outlets }
}
