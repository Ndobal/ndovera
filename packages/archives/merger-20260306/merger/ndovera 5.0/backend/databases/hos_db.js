const { hosDB } = require('../config/sqlite');

hosDB.run(`
CREATE TABLE IF NOT EXISTS approvals (
  id TEXT PRIMARY KEY,
  type TEXT,
  requested_by TEXT,
  school_id TEXT,
  status TEXT DEFAULT 'pending',
  created_at TEXT,
  updated_at TEXT
)
`);

hosDB.run(`
CREATE TABLE IF NOT EXISTS lesson_notes (
  id TEXT PRIMARY KEY,
  title TEXT,
  teacher_id TEXT,
  section_head_id TEXT,
  school_id TEXT,
  status TEXT DEFAULT 'pending',
  locked INTEGER DEFAULT 0,
  created_at TEXT,
  updated_at TEXT
)
`);

hosDB.run(`
CREATE TABLE IF NOT EXISTS ca_sheets (
  id TEXT PRIMARY KEY,
  class_id TEXT,
  subject TEXT,
  teacher_id TEXT,
  school_id TEXT,
  status TEXT DEFAULT 'pending',
  locked INTEGER DEFAULT 0,
  created_at TEXT,
  updated_at TEXT
)
`);

hosDB.run(`
CREATE TABLE IF NOT EXISTS ca_scores (
  id TEXT PRIMARY KEY,
  student_id TEXT,
  class_id TEXT,
  subject TEXT,
  term TEXT,
  school_id TEXT,
  score REAL,
  max_score REAL,
  source TEXT,
  reference_id TEXT,
  status TEXT DEFAULT 'pending',
  created_at TEXT
)
`);

hosDB.run(`
CREATE TABLE IF NOT EXISTS exams (
  id TEXT PRIMARY KEY,
  term TEXT,
  status TEXT DEFAULT 'ongoing',
  school_id TEXT,
  created_at TEXT,
  updated_at TEXT
)
`);

hosDB.run(`
CREATE TABLE IF NOT EXISTS results (
  id TEXT PRIMARY KEY,
  class_id TEXT,
  term TEXT,
  status TEXT DEFAULT 'pending',
  school_id TEXT,
  created_at TEXT,
  updated_at TEXT
)
`);

hosDB.run(`
CREATE TABLE IF NOT EXISTS promotions (
  id TEXT PRIMARY KEY,
  student_id TEXT,
  class_id TEXT,
  status TEXT DEFAULT 'pending',
  decision TEXT,
  school_id TEXT,
  created_at TEXT,
  updated_at TEXT
)
`);

hosDB.run(`
CREATE TABLE IF NOT EXISTS signatures (
  id TEXT PRIMARY KEY,
  role TEXT,
  user_id TEXT,
  status TEXT DEFAULT 'active',
  school_id TEXT,
  created_at TEXT,
  updated_at TEXT
)
`);

hosDB.run(`
CREATE TABLE IF NOT EXISTS academic_audit (
  id TEXT PRIMARY KEY,
  event_type TEXT,
  entity_id TEXT,
  actor_id TEXT,
  details TEXT,
  created_at TEXT
)
`);

hosDB.run(`
CREATE TABLE IF NOT EXISTS calendar_events (
  id TEXT PRIMARY KEY,
  title TEXT,
  start_date TEXT,
  end_date TEXT,
  event_type TEXT,
  school_id TEXT
)
`);

hosDB.run(`
CREATE TABLE IF NOT EXISTS holidays (
  id TEXT PRIMARY KEY,
  title TEXT,
  start_date TEXT,
  end_date TEXT,
  status TEXT DEFAULT 'scheduled',
  school_id TEXT
)
`);

module.exports = hosDB;
