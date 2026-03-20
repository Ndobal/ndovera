const { onboardingDB } = require('../config/sqlite');

onboardingDB.run(`
CREATE TABLE IF NOT EXISTS staff_profiles (
  id TEXT PRIMARY KEY,
  school_id TEXT,
  name TEXT,
  surname TEXT,
  email TEXT,
  role TEXT,
  responsibilities TEXT,
  class_id TEXT,
  department TEXT,
  status TEXT DEFAULT 'pending',
  dob TEXT,
  state_of_origin TEXT,
  lga TEXT,
  gender TEXT,
  profile_photo TEXT,
  documents TEXT,
  school_verified INTEGER DEFAULT 0,
  cashout_verified INTEGER DEFAULT 0,
  created_at TEXT,
  updated_at TEXT
)
`);

onboardingDB.run(`
CREATE TABLE IF NOT EXISTS students (
  id TEXT PRIMARY KEY,
  school_id TEXT,
  name TEXT,
  surname TEXT,
  email TEXT,
  class_id TEXT,
  section_id TEXT,
  status TEXT DEFAULT 'active',
  privileges TEXT,
  access_level TEXT,
  created_at TEXT,
  updated_at TEXT
)
`);

onboardingDB.run(`
CREATE TABLE IF NOT EXISTS email_aliases (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  type TEXT,
  email TEXT,
  school_id TEXT,
  active INTEGER DEFAULT 1,
  created_at TEXT
)
`);

onboardingDB.run(`
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_aliases_unique
ON email_aliases (email, school_id)
`);

module.exports = onboardingDB;
