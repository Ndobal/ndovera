const { lamsDB } = require('../config/sqlite');

lamsDB.run(`
CREATE TABLE IF NOT EXISTS lams_ledger (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  school_id TEXT,
  points INTEGER DEFAULT 0,
  farming_mode INTEGER DEFAULT 0,
  type TEXT,
  status TEXT DEFAULT 'pending',
  created_at TEXT,
  updated_at TEXT
)
`);

module.exports = lamsDB;
