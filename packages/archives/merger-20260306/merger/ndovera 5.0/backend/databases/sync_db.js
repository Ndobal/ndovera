const { syncDB } = require('../config/sqlite');

syncDB.run(`
CREATE TABLE IF NOT EXISTS offline_events (
  id TEXT PRIMARY KEY,
  type TEXT,
  payload TEXT,
  synced INTEGER DEFAULT 0,
  created_at TEXT
)
`);

module.exports = syncDB;
