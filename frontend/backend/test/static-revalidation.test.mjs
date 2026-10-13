import test from 'node:test'
import assert from 'node:assert/strict'
import pagesWorker from '../../public/_worker.js'

// A browser (or Cloudflare's cache) re-checking a bundle it already holds gets a 304.
// Both the Pages worker and the school-subdomain proxy once treated that as a missing
// file and answered 404, so returning users opened the app to a blank page.

function assetStore(status, contentType = 'application/javascript') {
  return { fetch: async () => new Response(status === 304 ? null : 'body', { status, headers: { 'Content-Type': contentType } }) }
}

const bundle = 'https://ndovera.com/static/js/main.abc123.js'
// A browser's request: the bot gate in front of both workers lets people straight through.
const BROWSER = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36' }
const asBrowser = (url, headers = {}) => new Request(url, { headers: { ...BROWSER, ...headers } })

test('the Pages worker passes a 304 through and only 404s a genuinely missing build file', async () => {
  const revalidate = asBrowser(bundle, { 'If-None-Match': '"etag"' })
  assert.equal((await pagesWorker.fetch(revalidate, { ASSETS: assetStore(304) })).status, 304)
  assert.equal((await pagesWorker.fetch(asBrowser(bundle), { ASSETS: assetStore(200) })).status, 200)
  assert.equal((await pagesWorker.fetch(asBrowser(bundle), { ASSETS: assetStore(404) })).status, 404)
  assert.equal((await pagesWorker.fetch(asBrowser(bundle), { ASSETS: assetStore(200, 'text/html') })).status, 404, 'the HTML fallback is not a script')
})

test('a school subdomain passes a 304 through from Pages', async () => {
  const worker = (await import(`./build/worker.mjs?static=${Date.now()}`)).default
  const realFetch = globalThis.fetch
  try {
    for (const [status, type, expected] of [[304, 'application/javascript', 304], [200, 'application/javascript', 200], [404, 'text/plain', 404], [200, 'text/html', 404]]) {
      globalThis.fetch = async () => new Response(status === 304 ? null : 'body', { status, headers: { 'Content-Type': type } })
      const response = await worker.fetch(
        asBrowser('https://greenfield.ndovera.com/static/js/main.abc123.js', { 'If-None-Match': '"etag"' }),
        { APP_DB: null, BOT_GATE: 'on' }, { waitUntil() {}, passThroughOnException() {} },
      )
      assert.equal(response.status, expected, `Pages answered ${status} ${type}`)
    }
  } finally {
    globalThis.fetch = realFetch
  }
})
