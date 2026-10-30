/**
 * Tenant-scoped help article publishing workflow.
 * Caller MUST supply an actor verified by the Worker authentication layer.
 * Platform-wide editorial privileges require a separate verified policy.
 */
export type ArticleActor = { userId: string; tenantId: string; role: string };
export type ArticleState = 'draft' | 'in_review' | 'approved' | 'published' | 'archived';
export const ARTICLE_STATES: readonly ArticleState[] = ['draft', 'in_review', 'approved', 'published', 'archived'];

export function assertArticleEditor(actor: ArticleActor) {
  if (!actor || typeof actor.userId !== 'string' || !actor.userId.trim()
    || typeof actor.tenantId !== 'string' || !actor.tenantId.trim()
    || !['owner', 'hos'].includes(actor.role)) throw new Error('Article editor permission required.');
  return actor;
}

export function validateArticleContent(raw: unknown) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Invalid article.');
  const input = raw as Record<string, unknown>;
  const field = (key: string, max: number) => {
    if (typeof input[key] !== 'string') throw new Error(`Invalid ${key}.`);
    const value = input[key].trim();
    if (!value || value.length > max) throw new Error(`${key} must be between 1 and ${max} characters.`);
    return value;
  };
  const roles = input.roles;
  const allowed = ['student', 'parent', 'teacher', 'hos', 'accountant', 'owner'];
  if (!Array.isArray(roles) || !roles.length || roles.length > allowed.length
    || roles.some(role => typeof role !== 'string' || !allowed.includes(role))
    || new Set(roles).size !== roles.length) throw new Error('Invalid article audience.');
  const steps = input.steps;
  if (!Array.isArray(steps) || steps.length < 1 || steps.length > 20
    || steps.some(step => typeof step !== 'string' || !step.trim() || step.length > 1500)) {
    throw new Error('Article must contain 1–20 valid steps.');
  }
  return {
    title: field('title', 160),
    category: field('category', 80),
    keywords: typeof input.keywords === 'string' ? input.keywords.trim().slice(0, 500) : '',
    roles: roles as string[],
    steps: (steps as string[]).map(step => step.trim()),
  };
}

// Created on first use, once per Worker instance (no manual migration needed).
let helpTablesReady = false;
export async function ensureHelpArticleTables(db: D1Database) {
  if (helpTablesReady) return;
  await db.prepare(`CREATE TABLE IF NOT EXISTS help_article_revisions (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    article_id TEXT NOT NULL,
    revision INTEGER NOT NULL,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    keywords TEXT NOT NULL,
    roles_json TEXT NOT NULL,
    steps_json TEXT NOT NULL,
    state TEXT NOT NULL,
    created_by TEXT NOT NULL,
    reviewed_by TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TEXT,
    published_at TEXT,
    UNIQUE(tenant_id, article_id, revision)
  )`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_help_article_revisions_scope
    ON help_article_revisions (tenant_id, article_id, revision DESC)`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS help_article_events (
    id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, revision_id TEXT NOT NULL,
    actor_id TEXT NOT NULL, action TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_help_article_events_scope
    ON help_article_events (tenant_id, revision_id, created_at DESC)`).run();
  helpTablesReady = true;
}

export async function createHelpArticleDraft(
  db: D1Database, actor: ArticleActor, raw: unknown, articleId = crypto.randomUUID(),
) {
  const editor = assertArticleEditor(actor);
  const article = validateArticleContent(raw);
  if (!/^[a-zA-Z0-9-]{1,100}$/.test(articleId)) throw new Error('Invalid article id.');
  const revisionId = crypto.randomUUID();
  // Allocate the revision inside the INSERT statement so concurrent writers
  // cannot both commit the same revision number. The unique constraint is a
  // final guard and callers must retry on a write conflict.
  // D1 batch executes as one transaction: failure to record the audit event
  // rolls back the draft insertion.
  await db.batch([
    db.prepare(`INSERT INTO help_article_revisions
      (id, tenant_id, article_id, revision, title, category, keywords, roles_json,
       steps_json, state, created_by)
      SELECT ?, ?, ?, COALESCE(MAX(revision), 0) + 1, ?, ?, ?, ?, ?, 'draft', ?
      FROM help_article_revisions WHERE tenant_id = ? AND article_id = ?`)
      .bind(revisionId, editor.tenantId, articleId, article.title, article.category,
        article.keywords, JSON.stringify(article.roles), JSON.stringify(article.steps), editor.userId,
        editor.tenantId, articleId),
    db.prepare(`INSERT INTO help_article_events (id, tenant_id, revision_id, actor_id, action)
      VALUES (?, ?, ?, ?, 'draft_created')`)
      .bind(crypto.randomUUID(), editor.tenantId, revisionId, editor.userId),
  ]);
  const inserted = await db.prepare(`SELECT revision FROM help_article_revisions
    WHERE tenant_id = ? AND id = ?`).bind(editor.tenantId, revisionId)
    .first<{ revision: number }>();
  if (!inserted) throw new Error('Could not read created article revision.');
  return { articleId, revisionId, revision: inserted.revision, state: 'draft' as const };
}

const TRANSITIONS: Record<ArticleState, ArticleState[]> = {
  draft: ['in_review'],
  in_review: ['approved', 'draft'],
  approved: ['published', 'draft'],
  published: ['archived'],
  archived: [],
};

export function assertArticleTransition(from: ArticleState, to: ArticleState, authorId: string, actor: ArticleActor) {
  assertArticleEditor(actor);
  if (!TRANSITIONS[from]?.includes(to)) throw new Error('Invalid article workflow transition.');
  if (to === 'approved' && authorId === actor.userId) {
    throw new Error('A separate reviewer must approve this article.');
  }
}

export async function transitionHelpArticle(
  db: D1Database, actor: ArticleActor, revisionId: string, to: ArticleState,
) {
  const editor = assertArticleEditor(actor);
  if (typeof revisionId !== 'string' || !revisionId.trim() || !ARTICLE_STATES.includes(to)) {
    throw new Error('Invalid article transition.');
  }
  const current = await db.prepare(`SELECT id, article_id, state, created_by
    FROM help_article_revisions WHERE tenant_id = ? AND id = ?`)
    .bind(editor.tenantId, revisionId)
    .first<{ id: string; article_id: string; state: ArticleState; created_by: string }>();
  if (!current) return null;
  assertArticleTransition(current.state, to, current.created_by, editor);
  // Never let an older approved revision supersede a newer published one.
  if (to === 'published') {
    const newer = await db.prepare(`SELECT id FROM help_article_revisions
      WHERE tenant_id = ? AND article_id = ? AND revision > (
        SELECT revision FROM help_article_revisions WHERE tenant_id = ? AND id = ?
      ) AND state = 'published' LIMIT 1`)
      .bind(editor.tenantId, current.article_id, editor.tenantId, revisionId)
      .first<{ id: string }>();
    if (newer) throw new Error('A newer revision is already published.');
  }
  // D1 transactional batch keeps the state change and audit event together.
  const [result] = await db.batch([
    db.prepare(`UPDATE help_article_revisions SET state = ?,
      reviewed_by = CASE WHEN ? = 'approved' THEN ? ELSE reviewed_by END,
      reviewed_at = CASE WHEN ? = 'approved' THEN CURRENT_TIMESTAMP ELSE reviewed_at END,
      published_at = CASE WHEN ? = 'published' THEN CURRENT_TIMESTAMP ELSE published_at END
      WHERE tenant_id = ? AND id = ? AND state = ?`)
      .bind(to, to, editor.userId, to, to, editor.tenantId, revisionId, current.state),
    db.prepare(`INSERT INTO help_article_events (id, tenant_id, revision_id, actor_id, action)
      SELECT ?, ?, ?, ?, ? WHERE EXISTS (
        SELECT 1 FROM help_article_revisions WHERE tenant_id = ? AND id = ? AND state = ?
      )`).bind(crypto.randomUUID(), editor.tenantId, revisionId, editor.userId, to,
        editor.tenantId, revisionId, to),
  ]);
  if (Number(result.meta?.changes || 0) !== 1) throw new Error('Article changed. Refresh and retry.');
  return { revisionId, state: to };
}

export async function listPublishedHelpArticles(db: D1Database, tenantId: string, role: string) {
  if (typeof tenantId !== 'string' || !tenantId.trim() || typeof role !== 'string') throw new Error('Invalid scope.');
  const rows = await db.prepare(`SELECT article_id, title, category, keywords, roles_json, steps_json, revision
    FROM help_article_revisions
    WHERE tenant_id = ? AND state = 'published'
      AND revision = (SELECT MAX(r2.revision) FROM help_article_revisions r2
        WHERE r2.tenant_id = help_article_revisions.tenant_id
          AND r2.article_id = help_article_revisions.article_id AND r2.state = 'published')
    ORDER BY published_at DESC LIMIT 500`)
    .bind(tenantId).all<Record<string, unknown>>();
  return (rows.results || []).filter(row => {
    try { return (JSON.parse(String(row.roles_json)) as string[]).includes(role); } catch { return false; }
  }).map(row => ({
    id: row.article_id, title: row.title, category: row.category, keywords: row.keywords,
    roles: JSON.parse(String(row.roles_json)), steps: JSON.parse(String(row.steps_json)),
    revision: row.revision,
  }));
}

export async function listEditorialHelpArticles(db: D1Database, actor: ArticleActor) {
  const editor = assertArticleEditor(actor);
  return db.prepare(`SELECT id, article_id, revision, title, category, state, created_by,
    reviewed_by, created_at, reviewed_at, published_at FROM help_article_revisions
    WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 200`)
    .bind(editor.tenantId).all();
}
