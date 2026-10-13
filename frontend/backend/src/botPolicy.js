// Who may crawl NDOVERA, and where.
//
// Shared by the API Worker (school sites, custom domains, /api) and the Pages
// worker (ndovera.com). Plain JavaScript so both can import it.
//
//   People and the NDOVERA apps         → everything, as before.
//   Search and AI crawlers we welcome   → public pages only (the marketing site,
//                                         school websites, their images, and the
//                                         read-only /api/public/* they load).
//   Every other bot, scraper or script  → 403, before any database work.
//
// A User-Agent can be faked, so this stops honest bots and cheap scrapers and
// keeps them off the database. The Cloudflare WAF rule in the README
// (Known Bots + these names) stops the rest before the Worker runs at all.

/** Crawlers welcome on public pages. Each entry: label → User-Agent pattern. */
export const ALLOWED_CRAWLERS = [
  // Google Search, Gemini (Google-Extended, Google-CloudVertexBot), Search Console checks.
  ['Google', /google/i],
  // Bing Search; Microsoft Copilot answers from Bing's crawl.
  ['Bing / Copilot', /bingbot|bingpreview|msnbot|adidxbot|microsoftpreview|copilot/i],
  ['ChatGPT', /gptbot|oai-searchbot|chatgpt/i],
  ['Claude', /claudebot|claude-user|claude-searchbot|claude-web|anthropic-ai/i],
  // One fetch when someone shares a link, so WhatsApp, Facebook and others show its preview.
  ['Link previews', /facebookexternalhit|facebookcatalog|whatsapp|twitterbot|linkedinbot|telegrambot|slackbot|discordbot/i],
]

// Anything that announces itself as automated. Lookbehind keeps "Cubot" phones out.
const AUTOMATED = /(?<!cu)bot|crawl|spider|slurp|scrap|archiv|fetcher|curl\/|wget|python|httpx|aiohttp|go-http-client|libwww|perl\/|ruby|php\/|node-fetch|axios|undici|headless|phantomjs|selenium|puppeteer|playwright|httpclient|postman|insomnia|semrush|ahrefs|mj12|petalbot|yandex|baidu|bytespider|ccbot|perplexity|zgrab|masscan|nmap|nikto|sqlmap|censys|scanner/i

// Machine callers that must always get through, whatever they call themselves.
const ALWAYS_ALLOWED_PREFIXES = ['/api/webhooks/', '/api/integrations/youtube/callback']

// Readable by welcome crawlers: the public API the public pages load. Lookups that
// need a number someone was given (receipts, results, certificates) are not for crawling.
const CRAWLABLE_API_PREFIX = '/api/public/'
const PRIVATE_PUBLIC_API = ['/api/public/fees-receipts/', '/api/public/results/', '/api/public/certificates/']

// Signed-in surfaces and one-time links: never public, whatever host they are on.
const APP_PREFIXES = [
  '/roles', '/login', '/change-password', '/reset-password', '/settings', '/classroom', '/assignments', '/exams',
  '/ai-tutor', '/attendance', '/rewards', '/news', '/receipt-verification', '/result-verification',
]

/** 'person' | 'crawler' | 'bot', and for crawlers which one. */
export function classifyUserAgent(userAgent) {
  const ua = String(userAgent || '').trim()
  if (!ua) return { kind: 'bot', name: 'no user agent' }
  const crawler = ALLOWED_CRAWLERS.find(([, pattern]) => pattern.test(ua))
  if (crawler) return { kind: 'crawler', name: crawler[0] }
  if (AUTOMATED.test(ua)) return { kind: 'bot', name: ua.slice(0, 80) }
  return { kind: 'person' }
}

/** Public pages, their assets and the public API — what a welcome crawler may read. */
export function isCrawlablePath(pathname) {
  const path = String(pathname || '/').toLowerCase()
  if (path.startsWith('/api/')) return path.startsWith(CRAWLABLE_API_PREFIX) && !PRIVATE_PUBLIC_API.some(prefix => path.startsWith(prefix))
  return !APP_PREFIXES.some(prefix => path === prefix || path.startsWith(`${prefix}/`))
}

/**
 * The decision for one request. Returns null to let it through, or a Response
 * to send instead (a 403 that costs no database reads).
 */
export function botGate(request) {
  const url = new URL(request.url)
  const path = url.pathname
  // Everyone may read the rules.
  if (path === '/robots.txt') return null
  if (ALWAYS_ALLOWED_PREFIXES.some(prefix => path.startsWith(prefix))) return null
  // Browsers send these before cross-site calls; they carry no data.
  if (request.method === 'OPTIONS') return null
  const who = classifyUserAgent(request.headers.get('user-agent'))
  if (who.kind === 'person') return null
  if (who.kind === 'crawler' && (request.method === 'GET' || request.method === 'HEAD') && isCrawlablePath(path)) return null
  return new Response('Automated access to this address is not permitted. See /robots.txt.\n', {
    status: 403,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex', 'X-Ndovera-Blocked': who.kind },
  })
}
