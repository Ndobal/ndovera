import assert from 'node:assert/strict';
import test from 'node:test';
import { handleHelpArticleRoute } from './build/helpArticleRoutes.mjs';

const actor = { userId: 'owner1', tenantId: 'school1', role: 'owner' };
const db = {
  prepare(sql) {
    return {
      // Table creation on first use runs unbound statements.
      run: async () => ({ meta: { changes: 0 } }),
      bind(...values) {
        return {
          all: async () => ({ results: [] }),
          first: async () => null,
          run: async () => ({ meta: { changes: 0 } }),
        };
      },
    };
  },
};

const ctx = (identity = actor) => ({ db, resolveActor: async () => identity });
const request = (path, method = 'GET', body) => new Request('https://example.test' + path, {
  method, ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
});

test('non-help routes are not intercepted', async () => {
  assert.equal(await handleHelpArticleRoute(request('/api/students'), ctx()), null);
});

test('article routes require a verified actor', async () => {
  const result = await handleHelpArticleRoute(request('/api/help/articles/published'), ctx(null));
  assert.equal(result.status, 401);
});

test('student role cannot access article editor', async () => {
  const result = await handleHelpArticleRoute(request('/api/help/articles/editor'), ctx({ ...actor, role: 'student' }));
  assert.equal(result.status, 403);
});

test('published endpoint uses verified actor and returns array', async () => {
  const result = await handleHelpArticleRoute(request('/api/help/articles/published'), ctx());
  assert.equal(result.status, 200);
  assert.deepEqual((await result.json()).articles, []);
});

test('rejects malformed draft and invalid state payloads', async () => {
  const draft = await handleHelpArticleRoute(request('/api/help/articles/editor', 'POST', null), ctx());
  assert.equal(draft.status, 400);
  const transition = await handleHelpArticleRoute(request('/api/help/articles/editor/abc/state', 'PATCH', null), ctx());
  assert.equal(transition.status, 400);
});
