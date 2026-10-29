-- Help Centre article revisions. Apply through the existing controlled D1 migration process.
-- This is additive and does not modify existing school data.
CREATE TABLE IF NOT EXISTS help_article_revisions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  article_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  keywords TEXT NOT NULL,
  roles_json TEXT NOT NULL,
  steps_json TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('draft','in_review','approved','published','archived')),
  created_by TEXT NOT NULL,
  reviewed_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TEXT,
  published_at TEXT,
  UNIQUE(tenant_id, article_id, revision)
);
CREATE INDEX IF NOT EXISTS idx_help_article_revisions_scope
  ON help_article_revisions(tenant_id, article_id, revision DESC);
CREATE TABLE IF NOT EXISTS help_article_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  revision_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_help_article_events_scope
  ON help_article_events(tenant_id, revision_id, created_at DESC);
