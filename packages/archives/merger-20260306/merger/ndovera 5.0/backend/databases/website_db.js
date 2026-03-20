const { websiteDB } = require('../config/sqlite');

websiteDB.run(`
CREATE TABLE IF NOT EXISTS pages (
  id TEXT PRIMARY KEY,
  school_id TEXT,
  template TEXT,
  page_name TEXT,
  content TEXT,
  created_at TEXT,
  updated_at TEXT
)
`);

module.exports = websiteDB;
