const { schoolsDB } = require('../config/sqlite');

schoolsDB.run(`
CREATE TABLE IF NOT EXISTS schools (
  id TEXT PRIMARY KEY,
  name TEXT,
  level TEXT,
  owner_id TEXT,
  hos_id TEXT,
  template TEXT,
  language TEXT,
  is_active INTEGER DEFAULT 0
)
`);

module.exports = schoolsDB;
