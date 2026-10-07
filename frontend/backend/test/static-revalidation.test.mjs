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

test('the Pages worker passes a 304 through and only 404s a genuinely missing build file', async () => {
  const revalidate = new Request(bundle, { headers: { 'If-None-Match': '"etag"' } })
  assert.equal((await pagesWorker.fetch(revalidate, { ASSETS: assetStore(304) })).status, 304)
  assert.equal((await pagesWorker.fetch(new Request(bundle), { ASSETS: assetStore(200) })).status, 200)
  assert.equal((await pagesWorker.fetch(new Request(bundle), { ASSETS: assetStore(404) })).status, 404)
  assert.equal((await pagesWorker.fetch(new Request(bundle), { ASSETS: assetStore(200, 'text/html') })).status, 404, 'the HTML fallback is not a script')
})

test('a school subdomain passes a 304 through from Pages', async () => {
  const worker = (await import(`./build/worker.mjs?static=${Date.now()}`)).default
  const realFetch = globalThis.fetch
  try {
    for (const [status, type, expected] of [[304, 'application/javascript', 304], [200, 'application/javascript', 200], [404, 'text/plain', 404], [200, 'text/html', 404]]) {
      globalThis.fetch = async () => new Response(status === 304 ? null : 'body', { status, headers: { 'Content-Type': type } })
      const response = await worker.fetch(
        new Request('https://greenfield.ndovera.com/static/js/main.abc123.js', { headers: { 'If-None-Match': '"etag"' } }),
        { APP_DB: null }, { waitUntil() {}, passThroughOnException() {} },
      )
      assert.equal(response.status, expected, `Pages answered ${status} ${type}`)
    }
  } finally {
    globalThis.fetch = realFetch
  }
})
