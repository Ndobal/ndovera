const { eventBusDB } = require('../config/sqlite');

eventBusDB.run(`
CREATE TABLE IF NOT EXISTS event_bus_events (
  id TEXT PRIMARY KEY,
  event_type TEXT,
  payload TEXT,
  status TEXT DEFAULT 'queued',
  created_at TEXT
)
`);

module.exports = eventBusDB;
