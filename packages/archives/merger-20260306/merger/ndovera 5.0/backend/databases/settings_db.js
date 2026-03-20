const { settingsDB } = require('../config/sqlite');

settingsDB.run(`
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_by TEXT,
  updated_at TEXT
)
`);

module.exports = settingsDB;
