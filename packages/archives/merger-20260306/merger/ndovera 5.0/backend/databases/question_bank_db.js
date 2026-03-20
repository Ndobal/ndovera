const { questionBankDB } = require('../config/sqlite');

questionBankDB.run(`
CREATE TABLE IF NOT EXISTS question_bank_questions (
  id TEXT PRIMARY KEY,
  school_id TEXT,
  subject TEXT,
  class_level TEXT,
  topic TEXT,
  subtopic TEXT,
  difficulty TEXT,
  term TEXT,
  year TEXT,
  question_type TEXT,
  content TEXT,
  answer TEXT,
  tags TEXT,
  created_by TEXT,
  status TEXT DEFAULT 'draft',
  created_at TEXT,
  updated_at TEXT
)
`);

questionBankDB.run(`
CREATE TABLE IF NOT EXISTS question_bank_blueprints (
  id TEXT PRIMARY KEY,
  school_id TEXT,
  name TEXT,
  description TEXT,
  template TEXT,
  created_by TEXT,
  created_at TEXT,
  updated_at TEXT
)
`);

questionBankDB.run(`
CREATE TABLE IF NOT EXISTS question_bank_papers (
  id TEXT PRIMARY KEY,
  school_id TEXT,
  name TEXT,
  subject TEXT,
  class_level TEXT,
  term TEXT,
  year TEXT,
  status TEXT DEFAULT 'draft',
  generated_by TEXT,
  created_at TEXT,
  updated_at TEXT
)
`);

questionBankDB.run(`
CREATE TABLE IF NOT EXISTS question_bank_audit (
  id TEXT PRIMARY KEY,
  entity_id TEXT,
  action TEXT,
  actor_id TEXT,
  actor_role TEXT,
  notes TEXT,
  created_at TEXT
)
`);

module.exports = questionBankDB;
