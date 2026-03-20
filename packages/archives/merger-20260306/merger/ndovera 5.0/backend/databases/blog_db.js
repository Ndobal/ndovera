const { blogDB } = require('../config/sqlite');

blogDB.run(`
CREATE TABLE IF NOT EXISTS blog_posts (
  id TEXT PRIMARY KEY,
  school_id TEXT,
  author_id TEXT,
  author_role TEXT,
  title TEXT,
  summary TEXT,
  content TEXT,
  tags TEXT,
  status TEXT DEFAULT 'draft',
  endorsed_by TEXT,
  approved_by TEXT,
  created_at TEXT,
  updated_at TEXT,
  published_at TEXT
)
`);

blogDB.run(`
CREATE TABLE IF NOT EXISTS blog_workflow_events (
  id TEXT PRIMARY KEY,
  post_id TEXT,
  action TEXT,
  actor_id TEXT,
  actor_role TEXT,
  notes TEXT,
  created_at TEXT
)
`);

blogDB.run(`
CREATE TABLE IF NOT EXISTS blog_publish_targets (
  id TEXT PRIMARY KEY,
  post_id TEXT,
  target TEXT,
  status TEXT DEFAULT 'queued',
  published_at TEXT
)
`);

module.exports = blogDB;
