const { nmeDB } = require('../config/sqlite');

nmeDB.run(`
CREATE TABLE IF NOT EXISTS nme_import_batches (
  id TEXT PRIMARY KEY,
  school_id TEXT,
  source_type TEXT,
  status TEXT DEFAULT 'imported',
  created_by TEXT,
  created_at TEXT,
  updated_at TEXT
)
`);

nmeDB.run(`
CREATE TABLE IF NOT EXISTS nme_datasets (
  id TEXT PRIMARY KEY,
  batch_id TEXT,
  name TEXT,
  status TEXT DEFAULT 'pending',
  created_at TEXT,
  updated_at TEXT
)
`);

nmeDB.run(`
CREATE TABLE IF NOT EXISTS nme_records (
  id TEXT PRIMARY KEY,
  dataset_id TEXT,
  entity_type TEXT,
  payload TEXT,
  status TEXT DEFAULT 'pending',
  created_at TEXT,
  updated_at TEXT
)
`);

nmeDB.run(`
CREATE TABLE IF NOT EXISTS nme_versions (
  id TEXT PRIMARY KEY,
  record_id TEXT,
  version INTEGER,
  payload TEXT,
  created_at TEXT
)
`);

nmeDB.run(`
CREATE TABLE IF NOT EXISTS nme_approvals (
  id TEXT PRIMARY KEY,
  dataset_id TEXT,
  status TEXT DEFAULT 'pending',
  approved_by TEXT,
  approved_at TEXT
)
`);

nmeDB.run(`
CREATE TABLE IF NOT EXISTS nme_audit_logs (
  id TEXT PRIMARY KEY,
  entity_id TEXT,
  action TEXT,
  actor_id TEXT,
  actor_role TEXT,
  notes TEXT,
  created_at TEXT
)
`);

nmeDB.run(`
CREATE TABLE IF NOT EXISTS nme_mapping_templates (
  id TEXT PRIMARY KEY,
  school_id TEXT,
  name TEXT,
  template TEXT,
  created_by TEXT,
  created_at TEXT
)
`);

nmeDB.run(`
CREATE TABLE IF NOT EXISTS nme_rollback_points (
  id TEXT PRIMARY KEY,
  batch_id TEXT,
  entity_id TEXT,
  created_by TEXT,
  created_at TEXT
)
`);

module.exports = nmeDB;
