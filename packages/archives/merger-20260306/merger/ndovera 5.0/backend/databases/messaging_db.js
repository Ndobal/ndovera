const { messagingDB } = require('../config/sqlite');

messagingDB.run(`
CREATE TABLE IF NOT EXISTS messaging_threads (
  id TEXT PRIMARY KEY,
  school_id TEXT,
  type TEXT,
  name TEXT,
  created_by TEXT,
  created_at TEXT
)
`);

messagingDB.run(`
CREATE TABLE IF NOT EXISTS messaging_messages (
  id TEXT PRIMARY KEY,
  thread_id TEXT,
  sender_id TEXT,
  sender_role TEXT,
  body TEXT,
  message_type TEXT DEFAULT 'text',
  status TEXT DEFAULT 'sent',
  created_at TEXT
)
`);

messagingDB.run(`
CREATE TABLE IF NOT EXISTS messaging_members (
  id TEXT PRIMARY KEY,
  thread_id TEXT,
  user_id TEXT,
  role TEXT,
  joined_at TEXT
)
`);

messagingDB.run(`
CREATE TABLE IF NOT EXISTS messaging_audit (
  id TEXT PRIMARY KEY,
  thread_id TEXT,
  action TEXT,
  actor_id TEXT,
  actor_role TEXT,
  notes TEXT,
  created_at TEXT
)
`);

module.exports = messagingDB;
