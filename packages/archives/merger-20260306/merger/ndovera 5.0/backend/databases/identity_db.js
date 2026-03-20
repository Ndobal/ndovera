const { identityDB } = require('../config/sqlite');

identityDB.run(`
CREATE TABLE IF NOT EXISTS identities (
  id TEXT PRIMARY KEY,
  school_id TEXT,
  name TEXT,
  email TEXT,
  status TEXT DEFAULT 'active',
  created_at TEXT
)
`);

identityDB.run(`
CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  name TEXT,
  description TEXT
)
`);

identityDB.run(`
CREATE TABLE IF NOT EXISTS role_bindings (
  id TEXT PRIMARY KEY,
  identity_id TEXT,
  role_id TEXT,
  context TEXT,
  created_at TEXT
)
`);

identityDB.run(`
CREATE TABLE IF NOT EXISTS authority_tree (
  id TEXT PRIMARY KEY,
  parent_role TEXT,
  child_role TEXT,
  created_at TEXT
)
`);

identityDB.run(`
CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  identity_id TEXT,
  device_fingerprint TEXT,
  status TEXT DEFAULT 'bound',
  created_at TEXT
)
`);

identityDB.run(`
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  identity_id TEXT,
  device_id TEXT,
  status TEXT DEFAULT 'active',
  created_at TEXT,
  expires_at TEXT
)
`);

identityDB.run(`
CREATE TABLE IF NOT EXISTS signatures (
  id TEXT PRIMARY KEY,
  identity_id TEXT,
  status TEXT DEFAULT 'active',
  created_at TEXT
)
`);

identityDB.run(`
CREATE TABLE IF NOT EXISTS trust_profiles (
  id TEXT PRIMARY KEY,
  identity_id TEXT,
  score REAL DEFAULT 0,
  risk_level TEXT,
  updated_at TEXT
)
`);

identityDB.run(`
CREATE TABLE IF NOT EXISTS consent_profiles (
  id TEXT PRIMARY KEY,
  identity_id TEXT,
  consent_data TEXT,
  updated_at TEXT
)
`);

identityDB.run(`
CREATE TABLE IF NOT EXISTS identity_audit_logs (
  id TEXT PRIMARY KEY,
  identity_id TEXT,
  action TEXT,
  actor_id TEXT,
  actor_role TEXT,
  notes TEXT,
  created_at TEXT
)
`);

module.exports = identityDB;
