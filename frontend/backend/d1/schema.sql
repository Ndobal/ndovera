PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS settings (
  studentId TEXT PRIMARY KEY,
  payload TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit (
  id TEXT PRIMARY KEY,
  studentId TEXT,
  ts TEXT,
  action TEXT,
  data TEXT
);

CREATE TABLE IF NOT EXISTS books (
  id TEXT PRIMARY KEY,
  title TEXT,
  author TEXT,
  description TEXT,
  cover TEXT,
  metadata TEXT
);

CREATE TABLE IF NOT EXISTS borrowings (
  id TEXT PRIMARY KEY,
  bookId TEXT,
  studentId TEXT,
  borrowedAt TEXT,
  dueAt TEXT,
  returnedAt TEXT,
  status TEXT,
  meta TEXT
);

CREATE TABLE IF NOT EXISTS classes (
  id TEXT PRIMARY KEY,
  name TEXT,
  teacherId TEXT,
  meta TEXT
);

CREATE TABLE IF NOT EXISTS class_members (
  id TEXT PRIMARY KEY,
  classId TEXT,
  studentId TEXT,
  role TEXT,
  joinedAt TEXT
);

CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  classId TEXT,
  authorId TEXT,
  content TEXT,
  attachments TEXT,
  createdAt TEXT
);

CREATE TABLE IF NOT EXISTS assignments (
  id TEXT PRIMARY KEY,
  classId TEXT,
  title TEXT,
  description TEXT,
  dueAt TEXT,
  createdAt TEXT
);

CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  assignmentId TEXT,
  studentId TEXT,
  content TEXT,
  submittedAt TEXT,
  grade REAL,
  gradedAt TEXT,
  feedback TEXT
);

CREATE TABLE IF NOT EXISTS attendance_records (
  id TEXT PRIMARY KEY,
  classId TEXT,
  studentId TEXT,
  date TEXT,
  status TEXT,
  recordedBy TEXT,
  notes TEXT,
  student_id TEXT,
  reason TEXT,
  recorded_by TEXT,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS materials (
  id TEXT PRIMARY KEY,
  classId TEXT,
  title TEXT,
  url TEXT,
  metadata TEXT,
  uploadedAt TEXT,
  uploadedBy TEXT
);

CREATE TABLE IF NOT EXISTS content_saves (
  id TEXT PRIMARY KEY,
  classId TEXT,
  role TEXT,
  content TEXT,
  ts TEXT
);

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  subject TEXT,
  participants TEXT,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT,
  sender_id TEXT,
  body TEXT,
  metadata TEXT,
  sent_at TEXT,
  read_at TEXT
);

CREATE TABLE IF NOT EXISTS tuck_orders (
  id TEXT PRIMARY KEY,
  placed_by TEXT,
  items TEXT,
  total_cents INTEGER,
  notes TEXT,
  status TEXT,
  placed_at TEXT,
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_studentId_ts ON audit(studentId, ts DESC);
CREATE INDEX IF NOT EXISTS idx_borrowings_studentId_borrowedAt ON borrowings(studentId, borrowedAt DESC);
CREATE INDEX IF NOT EXISTS idx_posts_classId_createdAt ON posts(classId, createdAt DESC);
CREATE INDEX IF NOT EXISTS idx_assignments_classId_createdAt ON assignments(classId, createdAt DESC);
CREATE INDEX IF NOT EXISTS idx_materials_classId_uploadedAt ON materials(classId, uploadedAt DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_classId_date ON attendance_records(classId, date DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_student_id_date ON attendance_records(student_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id_sent_at ON messages(conversation_id, sent_at ASC);
CREATE INDEX IF NOT EXISTS idx_tuck_orders_placed_at ON tuck_orders(placed_at DESC);