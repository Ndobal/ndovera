const { liveEventsDB } = require('../config/sqlite');

liveEventsDB.run(`
CREATE TABLE IF NOT EXISTS live_events (
  id TEXT PRIMARY KEY,
  school_id TEXT,
  title TEXT,
  description TEXT,
  youtube_url TEXT,
  status TEXT DEFAULT 'scheduled',
  scheduled_at TEXT,
  created_by TEXT,
  created_at TEXT,
  updated_at TEXT
)
`);

liveEventsDB.run(`
CREATE TABLE IF NOT EXISTS live_events_audit (
  id TEXT PRIMARY KEY,
  event_id TEXT,
  action TEXT,
  actor_id TEXT,
  actor_role TEXT,
  notes TEXT,
  created_at TEXT
)
`);

module.exports = liveEventsDB;
