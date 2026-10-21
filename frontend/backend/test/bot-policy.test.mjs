import test from 'node:test'
import assert from 'node:assert/strict'
import { botGate, classifyUserAgent } from '../src/botPolicy.js'
import pagesWorker from '../../public/_worker.js'

// Only the search and AI crawlers NDOVERA welcomes may read it, and only its public
// pages; every other bot is turned away before any database work. People and the
// NDOVERA apps are never affected.

const UA = {
  chrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36',
  cubotPhone: 'Mozilla/5.0 (Linux; Android 11; Cubot X30) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0 Mobile Safari/537.36',
  flutterApp: 'Dart/3.5 (dart:io)',
  googlebot: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  bingbot: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm) Chrome/116.0 Safari/537.36',
  gptbot: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)',
  chatgptUser: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot',
  claudebot: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)',
  whatsapp: 'WhatsApp/2.23.20.0 A',
  ahrefs: 'Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)',
  yandex: 'Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)',
  python: 'python-requests/2.31.0',
  curl: 'curl/8.4.0',
  headless: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/120.0 Safari/537.36',
}

const gate = (path, ua, method = 'GET', host = 'ndovera.com') =>
  botGate(new Request(`https://${host}${path}`, { method, headers: ua ? { 'User-Agent': ua } : {} }))
const allowed = (...args) => gate(...args) === null

test('people and the NDOVERA apps go everywhere', () => {
  for (const ua of [UA.chrome, UA.cubotPhone, UA.flutterApp]) {
    assert.equal(classifyUserAgent(ua).kind, 'person', ua)
    assert.ok(allowed('/roles/owner/finance', ua))
    assert.ok(allowed('/api/school/finance/simple/overview', ua, 'POST'))
  }
})

test('Google, Bing/Copilot, ChatGPT, Claude and link previews read public pages and school sites only', () => {
  for (const ua of [UA.googlebot, UA.bingbot, UA.gptbot, UA.chatgptUser, UA.claudebot, UA.whatsapp]) {
    assert.equal(classifyUserAgent(ua).kind, 'crawler', ua)
    for (const path of ['/', '/pricing', '/championships/maths-2026', '/static/js/main.abc.js', '/sitemap.xml', '/api/public/platform-site', '/api/public/tenant/greenfield']) {
      assert.ok(allowed(path, ua), `${ua} → ${path}`)
    }
    for (const path of ['/', '/about', '/admissions', '/files/logo.png']) assert.ok(allowed(path, ua, 'GET', 'greenfield.ndovera.com'), `${ua} → school ${path}`)
    // Not the app, not private lookups, not the rest of the API, and read-only.
    for (const path of ['/roles/owner', '/login', '/api/users/me', '/api/public/fees-receipts/RCT-1', '/api/public/results/abc', '/receipt-verification/x']) {
      assert.equal(gate(path, ua)?.status, 403, `${ua} → ${path}`)
    }
    assert.equal(gate('/api/public/growth-partner-applications', ua, 'POST')?.status, 403)
  }
})

test('every other bot, scraper and script is turned away', () => {
  for (const ua of [UA.ahrefs, UA.yandex, UA.python, UA.curl, UA.headless, '']) {
    assert.equal(classifyUserAgent(ua).kind, 'bot', ua || 'empty')
    for (const path of ['/', '/api/public/platform-site', '/roles/owner']) assert.equal(gate(path, ua)?.status, 403, `${ua} → ${path}`)
  }
  // But anyone may read robots.txt, and payment / WhatsApp webhooks always get through.
  assert.ok(allowed('/robots.txt', UA.ahrefs))
  assert.ok(allowed('/api/webhooks/payments/flutterwave', 'Go-http-client/2.0', 'POST'))
  assert.ok(allowed('/api/webhooks/communications/meta', 'facebookexternalua', 'POST'))
})

test('both workers apply it: the API Worker (when BOT_GATE is on) and the ndovera.com Pages worker', async () => {
  const worker = (await import(`./build/worker.mjs?bots=${Date.now()}`)).default
  const call = (path, ua, env = { APP_DB: null, BOT_GATE: 'on' }) =>
    worker.fetch(new Request(`https://ndovera.com${path}`, { headers: { 'User-Agent': ua } }), env, { waitUntil() {}, passThroughOnException() {} })
  assert.equal((await call('/api/users/me', UA.curl)).status, 403)
  assert.equal((await call('/api/users/me', UA.claudebot)).status, 403)
  assert.equal((await call('/api/users/me', UA.flutterApp)).status, 401) // through the gate, then asked to sign in
  assert.equal((await call('/api/users/me', UA.curl, { APP_DB: null, BOT_GATE: 'off' })).status, 401) // the off switch

  const assets = { fetch: async () => new Response('body', { status: 200, headers: { 'Content-Type': 'application/javascript' } }) }
  const page = (path, ua) => pagesWorker.fetch(new Request(`https://ndovera.com${path}`, { headers: { 'User-Agent': ua } }), { ASSETS: assets })
  assert.equal((await page('/static/js/main.abc.js', UA.googlebot)).status, 200)
  assert.equal((await page('/', UA.ahrefs)).status, 403)
  assert.equal((await page('/roles/owner', UA.gptbot)).status, 403)
})

test('phone browsers are people even when their name mentions Google or their model ends in "bot"', () => {
  const phones = [
    // Old Android browsers and in-app browsers that say "Google".
    'Mozilla/5.0 (Linux; Android 5.1.1; SM-J320F Build/LMY47V) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/95.0.4638.74 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 5.0; itel it1508 Build/LRX21M; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/37.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 10; TECNO KF6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0 Mobile Safari/537.36 GoogleApp/13.1',
    'Mozilla/5.0 (Linux; Android 9; Google Pixel 3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 8.1; ROBOT ONE Build/OPM1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0 Mobile Safari/537.36',
  ]
  for (const ua of phones) {
    assert.equal(classifyUserAgent(ua).kind, 'person', ua)
    assert.ok(allowed('/api/auth/login', ua, 'POST'), ua)
  }
  // Real crawlers and scripts are still recognised.
  assert.equal(classifyUserAgent('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)').kind, 'crawler')
  assert.equal(classifyUserAgent('Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)').kind, 'bot')
  assert.equal(classifyUserAgent('python-requests/2.31').kind, 'bot')
  assert.equal(classifyUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/120.0 Safari/537.36').kind, 'bot')
})
