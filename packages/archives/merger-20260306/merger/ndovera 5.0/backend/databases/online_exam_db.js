const { onlineExamDB } = require('../config/sqlite');

onlineExamDB.run(`
CREATE TABLE IF NOT EXISTS online_exams (
  id TEXT PRIMARY KEY,
  school_id TEXT,
  class_id TEXT,
  subject TEXT,
  term TEXT,
  title TEXT,
  status TEXT DEFAULT 'draft',
  total_marks REAL DEFAULT 0,
  created_by TEXT,
  created_at TEXT,
  updated_at TEXT
)
`);

onlineExamDB.run(`
CREATE TABLE IF NOT EXISTS online_exam_questions (
  id TEXT PRIMARY KEY,
  exam_id TEXT,
  question_type TEXT,
  prompt TEXT,
  options TEXT,
  correct_answer TEXT,
  marks REAL DEFAULT 1,
  created_at TEXT
)
`);

onlineExamDB.run(`
CREATE TABLE IF NOT EXISTS online_exam_attempts (
  id TEXT PRIMARY KEY,
  exam_id TEXT,
  student_id TEXT,
  status TEXT DEFAULT 'submitted',
  total_score REAL DEFAULT 0,
  submitted_at TEXT,
  created_at TEXT
)
`);

onlineExamDB.run(`
CREATE TABLE IF NOT EXISTS online_exam_responses (
  id TEXT PRIMARY KEY,
  attempt_id TEXT,
  question_id TEXT,
  answer TEXT,
  score REAL DEFAULT 0,
  is_correct INTEGER DEFAULT 0,
  created_at TEXT
)
`);

onlineExamDB.run(`
CREATE TABLE IF NOT EXISTS online_exam_audit (
  id TEXT PRIMARY KEY,
  exam_id TEXT,
  action TEXT,
  actor_id TEXT,
  actor_role TEXT,
  notes TEXT,
  created_at TEXT
)
`);

module.exports = onlineExamDB;
