const { dropboxDB } = require('../config/sqlite');

dropboxDB.run(`
CREATE TABLE IF NOT EXISTS dropbox_items (
  id TEXT PRIMARY KEY,
  school_id TEXT,
  parent_id TEXT,
  name TEXT,
  type TEXT,
  path TEXT,
  owner_id TEXT,
  permissions TEXT,
  status TEXT DEFAULT 'active',
  version INTEGER DEFAULT 1,
  is_locked INTEGER DEFAULT 0,
  created_at TEXT,
  updated_at TEXT
)
`);

dropboxDB.run(`
CREATE TABLE IF NOT EXISTS dropbox_permissions (
  id TEXT PRIMARY KEY,
  item_id TEXT,
  role TEXT,
  can_view INTEGER DEFAULT 1,
  can_edit INTEGER DEFAULT 0,
  can_approve INTEGER DEFAULT 0
)
`);

dropboxDB.run(`
CREATE TABLE IF NOT EXISTS dropbox_audit (
  id TEXT PRIMARY KEY,
  item_id TEXT,
  action TEXT,
  actor_id TEXT,
  actor_role TEXT,
  notes TEXT,
  created_at TEXT
)
`);

module.exports = dropboxDB;
