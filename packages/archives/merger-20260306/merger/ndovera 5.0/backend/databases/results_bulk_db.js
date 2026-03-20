const { resultsBulkDB } = require('../config/sqlite');

resultsBulkDB.run(`
CREATE TABLE IF NOT EXISTS results_bulk_uploads (
  id TEXT PRIMARY KEY,
  school_id TEXT,
  term TEXT,
  session TEXT,
  class_level TEXT,
  source_type TEXT,
  file_name TEXT,
  status TEXT DEFAULT 'uploaded',
  created_by TEXT,
  created_at TEXT,
  updated_at TEXT
)
`);

resultsBulkDB.run(`
CREATE TABLE IF NOT EXISTS results_bulk_tags (
  id TEXT PRIMARY KEY,
  upload_id TEXT,
  student_name TEXT,
  reg_number TEXT,
  class_level TEXT,
  confidence REAL,
  status TEXT DEFAULT 'pending',
  created_at TEXT
)
`);

resultsBulkDB.run(`
CREATE TABLE IF NOT EXISTS results_bulk_audit (
  id TEXT PRIMARY KEY,
  upload_id TEXT,
  action TEXT,
  actor_id TEXT,
  actor_role TEXT,
  notes TEXT,
  created_at TEXT
)
`);

module.exports = resultsBulkDB;
