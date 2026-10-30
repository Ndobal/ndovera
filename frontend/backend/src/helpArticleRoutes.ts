import {
  assertArticleEditor, createHelpArticleDraft, ensureHelpArticleTables,
  listEditorialHelpArticles, listPublishedHelpArticles, transitionHelpArticle,
  type ArticleActor, type ArticleState,
} from './helpArticleWorkflow';

/**
 * Integration adapter: mount from the existing authenticated Worker router.
 * The resolver MUST verify JWT/session, selected role, tenant membership and
 * tenant ID on the server. Never infer identity from request JSON or URL.
 */
export type ArticleRouteContext = {
  db: D1Database;
  resolveActor: (request: Request) => Promise<ArticleActor | null>;
};
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});
const fail = (status: number, error: string) => json({ error }, status);

export async function handleHelpArticleRoute(
  request: Request, context: ArticleRouteContext,
): Promise<Response | null> {
  const path = new URL(request.url).pathname;
  if (!path.startsWith('/api/help/articles/')) return null;
  const actor = await context.resolveActor(request);
  if (!actor) return fail(401, 'Authentication required.');
  if (!actor.userId || !actor.tenantId || !actor.role) return fail(403, 'Verified school access required.');
  try { await ensureHelpArticleTables(context.db); } catch { return fail(500, 'Help articles are unavailable right now.'); }
  if (path === '/api/help/articles/published' && request.method === 'GET') {
    try {
      const articles = await listPublishedHelpArticles(context.db, actor.tenantId, actor.role);
      return json({ articles });
    } catch { return fail(500, 'Unable to load published articles.'); }
  }
  try { assertArticleEditor(actor); } catch { return fail(403, 'Article editor permission required.'); }
  if (path === '/api/help/articles/editor' && request.method === 'GET') {
    const result = await listEditorialHelpArticles(context.db, actor);
    return json({ articles: result.results || [] });
  }
  if (path === '/api/help/articles/editor' && request.method === 'POST') {
    const raw = await request.text();
    if (raw.length > 40000) return fail(413, 'Article request is too large.');
    let input: Record<string, unknown>;
    try { input = JSON.parse(raw); } catch { return fail(400, 'Invalid JSON.'); }
    if (!input || typeof input !== 'object' || Array.isArray(input)) return fail(400, 'Invalid article.');
    const id = typeof input.articleId === 'string' ? input.articleId : undefined;
    try { return json(await createHelpArticleDraft(context.db, actor, input, id), 201); }
    catch (error) { return fail(400, error instanceof Error ? error.message : 'Invalid article.'); }
  }
  const match = /^\/api\/help\/articles\/editor\/([a-zA-Z0-9-]{1,100})\/state$/.exec(path);
  if (match && request.method === 'PATCH') {
    const raw = await request.text();
    if (raw.length > 1024) return fail(413, 'Request too large.');
    let input: { state?: ArticleState };
    try { input = JSON.parse(raw); } catch { return fail(400, 'Invalid JSON.'); }
    if (!input || typeof input !== 'object' || Array.isArray(input)) return fail(400, 'Invalid transition.');
    try {
      const result = await transitionHelpArticle(context.db, actor, match[1], input.state as ArticleState);
      return result ? json(result) : fail(404, 'Article revision not found.');
    } catch (error) { return fail(409, error instanceof Error ? error.message : 'Transition rejected.'); }
  }
  return fail(405, 'Method or article route not supported.');
}
