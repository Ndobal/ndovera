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

CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  school_name TEXT NOT NULL,
  school_slug TEXT NOT NULL UNIQUE,
  owner_name TEXT NOT NULL,
  owner_email TEXT NOT NULL UNIQUE,
  owner_phone TEXT,
  plan_key TEXT NOT NULL,
  student_count INTEGER NOT NULL DEFAULT 0,
  requested_subdomain TEXT NOT NULL UNIQUE,
  website_domain TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending_payment',
  approval_status TEXT NOT NULL DEFAULT 'pending',
  payment_status TEXT NOT NULL DEFAULT 'pending',
  website_status TEXT NOT NULL DEFAULT 'inactive',
  setup_fee_cents INTEGER NOT NULL,
  student_fee_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'NGN',
  discount_code TEXT,
  discount_snapshot TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  approved_at TEXT,
  approved_by TEXT,
  approval_note TEXT,
  activated_at TEXT,
  suspended_at TEXT
);

CREATE TABLE IF NOT EXISTS tenant_discount_codes (
  code TEXT PRIMARY KEY,
  name TEXT,
  description TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  setup_fee_cents INTEGER,
  student_fee_cents INTEGER,
  plan_scope TEXT,
  starts_at TEXT,
  ends_at TEXT,
  max_redemptions INTEGER,
  redemption_count INTEGER NOT NULL DEFAULT 0,
  created_by TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tenant_payments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  initiated_by TEXT,
  initiated_role TEXT,
  tx_ref TEXT NOT NULL UNIQUE,
  flutterwave_link TEXT,
  flutterwave_tx_id TEXT,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'NGN',
  status TEXT NOT NULL DEFAULT 'pending',
  plan_key TEXT NOT NULL,
  student_count INTEGER NOT NULL DEFAULT 0,
  discount_code TEXT,
  provider_response TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  paid_at TEXT,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
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
CREATE INDEX IF NOT EXISTS idx_tenants_owner_email ON tenants(owner_email);
CREATE INDEX IF NOT EXISTS idx_tenants_status_created_at ON tenants(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tenants_subdomain ON tenants(requested_subdomain);
CREATE INDEX IF NOT EXISTS idx_tenant_discount_codes_active ON tenant_discount_codes(active, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_tenant_payments_tenant_id_created_at ON tenant_payments(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tenant_payments_status ON tenant_payments(status, updated_at DESC);

INSERT INTO tenant_discount_codes(
  code,
  name,
  description,
  active,
  setup_fee_cents,
  student_fee_cents,
  plan_scope,
  starts_at,
  ends_at,
  max_redemptions,
  redemption_count,
  created_by,
  metadata,
  created_at,
  updated_at
) VALUES (
  'NDO35K500',
  'Launch Discount',
  'Drops setup fee to N35,000 and student billing to N500 per student per term while active.',
  1,
  3500000,
  50000,
  'growth,custom',
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
  NULL,
  NULL,
  0,
  'ami-bootstrap',
  '{}',
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
) ON CONFLICT(code) DO NOTHING;