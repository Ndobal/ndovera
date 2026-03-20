const managementRoles = ['HoS', 'Owner', 'ICT Manager'];
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import multer from 'multer';
import sharp from 'sharp';
import Database from "better-sqlite3";

process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught Exception:', err);
  fs.writeFileSync('crash.log', String(err) + '\n' + err.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[FATAL] Unhandled Rejection at:', promise, 'reason:', reason);
  fs.writeFileSync('crash.log', 'Unhandled Rejection: ' + String(reason));
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("ndovera.db");

// RBAC middleware
import { attachUserFromHeaders, requireRoles } from './rbac.js'

const app = express();
app.use(express.json())
app.use(attachUserFromHeaders)

// Example protected route: only Teachers and Class Teacher can mark attendance


// --- STAFF ATTENDANCE ---
app.post('/api/attendance/staff/mark', requireRoles('HoS', 'Admin', 'Super Admin'), (req, res) => {
  const { staff_id, status, date } = req.body;
  if (!staff_id || !status || !date) return res.status(400).json({ error: 'Missing fields' });
  const user = (req as any).user;
  try {
    const stmt = db.prepare(`
      INSERT INTO staff_attendance (staff_id, status, date, marked_by)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(staff_id, date) DO UPDATE SET
        status = excluded.status,
        marked_by = excluded.marked_by
    `);
    stmt.run(staff_id, status, date, user.userId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get('/api/attendance/staff', requireRoles('HoS', 'Admin', 'Super Admin'), (req, res) => {
  const { date } = req.query;
  try {
    let records: any[] = [];
    if (date) {
      records = db.prepare('SELECT a.*, u.name, u.role FROM staff_attendance a JOIN users u ON a.staff_id = u.id WHERE a.date = ?').all(date) as any[];
    } else {
      records = db.prepare('SELECT a.*, u.name, u.role FROM staff_attendance a JOIN users u ON a.staff_id = u.id').all() as any[];
    }
    const staff = db.prepare('SELECT id, name, role FROM users WHERE role IN ("Teacher", "Class Teacher", "HoS", "Admin", "Super Admin", "Owner", "ICT Manager") ORDER BY name ASC').all() as any[];
    const withParts = (row: any) => {
      const segments = String(row?.name || '').trim().split(/\s+/).filter(Boolean);
      return {
        ...row,
        first_name: segments[0] || '',
        last_name: segments.slice(1).join(' ') || '',
      };
    };
    res.json({ records: records.map(withParts), staff: staff.map(withParts) });
  } catch (err: any) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// --- PARENT ATTENDANCE ---
app.post('/api/attendance/parent/mark', requireRoles('HoS', 'Admin', 'Teacher', 'Class Teacher', 'Super Admin'), (req, res) => {
  const { parent_id, status, date, notes } = req.body;
  if (!parent_id || !status || !date) return res.status(400).json({ error: 'Missing fields' });
  const user = (req as any).user;
  try {
    const stmt = db.prepare(`
      INSERT INTO parent_attendance (parent_id, status, date, marked_by, notes)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(parent_id, date) DO UPDATE SET
        status = excluded.status,
        marked_by = excluded.marked_by,
        notes = excluded.notes
    `);
    stmt.run(parent_id, status, date, user.userId, notes || null);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get('/api/attendance/parent', requireRoles('HoS', 'Admin', 'Teacher', 'Class Teacher', 'Super Admin'), (req, res) => {
  const { date } = req.query;
  try {
    let records: any[] = [];
    if (date) {
      records = db.prepare('SELECT a.*, u.name, u.role FROM parent_attendance a JOIN users u ON a.parent_id = u.id WHERE a.date = ?').all(date) as any[];
    } else {
      records = db.prepare('SELECT a.*, u.name, u.role FROM parent_attendance a JOIN users u ON a.parent_id = u.id').all() as any[];
    }
    const parents = db.prepare('SELECT id, name, role FROM users WHERE role = "Parent" ORDER BY name ASC').all() as any[];
    const withParts = (row: any) => {
      const segments = String(row?.name || '').trim().split(/\s+/).filter(Boolean);
      return {
        ...row,
        first_name: segments[0] || '',
        last_name: segments.slice(1).join(' ') || '',
      };
    };
    res.json({ records: records.map(withParts), parents: parents.map(withParts) });
  } catch (err: any) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/attendance/mark', requireRoles('Teacher', 'Class Teacher', 'HoS'), (req, res) => {
  const { student_id, status, date } = req.body
  if (!student_id || !status || !date) return res.status(400).json({ error: 'missing fields' })

  // ensure user has permission per roles config
  const user = (req as any).user
  const allowed = require('./rbac').hasPermission(user, 'attendance.mark')
  if (!allowed) return res.status(403).json({ error: 'Forbidden - missing permission' })

  // insert into DB (simplified)
  try {
    db.prepare('INSERT INTO attendance (id, school_id, student_id, class_id, status, date, recorded_by) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(`att_${Date.now()}`, user?.school_id || null, student_id, null, status, date, user?.id)
    return res.json({ ok: true })
  } catch (err) {
    return res.status(500).json({ error: 'db error', detail: String(err) })
  }
})


// Initialize database with full multi-tenant schema
db.exec(`
  -- Schools (Tenants)
  CREATE TABLE IF NOT EXISTS schools (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    subdomain TEXT UNIQUE NOT NULL,
    logo_url TEXT,
    primary_color TEXT DEFAULT '#10b981',
    live_class_quota INTEGER DEFAULT 5,
    website_config TEXT, -- JSON string for website builder
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Users
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL, -- Super Admin, School Admin, Teacher, Student, Parent, Finance Officer, Librarian
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(email, school_id),
    FOREIGN KEY(school_id) REFERENCES schools(id)
  );

  -- Students
  CREATE TABLE IF NOT EXISTS students (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    admission_number TEXT UNIQUE,
    class_id TEXT,
    parent_id TEXT,
    secondary_parent_id TEXT,
    FOREIGN KEY(school_id) REFERENCES schools(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  -- Teachers
  CREATE TABLE IF NOT EXISTS teachers (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    staff_id TEXT UNIQUE,
    specialization TEXT,
    FOREIGN KEY(school_id) REFERENCES schools(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  -- Classes
  CREATE TABLE IF NOT EXISTS classes (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL,
    name TEXT NOT NULL,
    level TEXT, -- e.g., JSS1, SS3
    section TEXT,
    teacher_id TEXT,
    FOREIGN KEY(school_id) REFERENCES schools(id),
    FOREIGN KEY(teacher_id) REFERENCES teachers(id)
  );

    -- Staff Attendance
  CREATE TABLE IF NOT EXISTS staff_attendance (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    status TEXT NOT NULL,
    date DATE NOT NULL,
    recorded_by TEXT
  );

  -- Parent Attendance
  CREATE TABLE IF NOT EXISTS parent_attendance (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    event_name TEXT NOT NULL,
    status TEXT NOT NULL,
    date DATE NOT NULL,
    recorded_by TEXT
  );

-- Attendance
  CREATE TABLE IF NOT EXISTS attendance (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL,
    student_id TEXT NOT NULL,
    class_id TEXT NOT NULL,
    status TEXT NOT NULL, -- Present, Absent, Late
    date DATE NOT NULL,
    recorded_by TEXT,
    FOREIGN KEY(school_id) REFERENCES schools(id),
    FOREIGN KEY(student_id) REFERENCES students(id)
  );

  CREATE TABLE IF NOT EXISTS school_calendar_events (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL,
    event_date DATE NOT NULL,
    title TEXT NOT NULL,
    event_type TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(school_id) REFERENCES schools(id)
  );

  -- Grades/Results
  CREATE TABLE IF NOT EXISTS grades (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL,
    student_id TEXT NOT NULL,
    subject TEXT NOT NULL,
    score INTEGER NOT NULL,
    grade TEXT NOT NULL,
    term TEXT NOT NULL,
    year TEXT NOT NULL,
    teacher_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(school_id) REFERENCES schools(id),
    FOREIGN KEY(student_id) REFERENCES students(id),
    FOREIGN KEY(teacher_id) REFERENCES teachers(id)
  );

  -- Assignments
  CREATE TABLE IF NOT EXISTS assignments (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL,
    class_id TEXT NOT NULL,
    teacher_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    due_date DATE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(school_id) REFERENCES schools(id),
    FOREIGN KEY(class_id) REFERENCES classes(id),
    FOREIGN KEY(teacher_id) REFERENCES teachers(id)
  );

  -- Finance: Fees & Payments
  CREATE TABLE IF NOT EXISTS fees (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL,
    title TEXT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    due_date DATE,
    FOREIGN KEY(school_id) REFERENCES schools(id)
  );

  CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL,
    student_id TEXT NOT NULL,
    fee_id TEXT NOT NULL,
    amount_paid DECIMAL(10,2) NOT NULL,
    payment_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'Completed',
    FOREIGN KEY(school_id) REFERENCES schools(id),
    FOREIGN KEY(student_id) REFERENCES students(id),
    FOREIGN KEY(fee_id) REFERENCES fees(id)
  );

  CREATE TABLE IF NOT EXISTS payroll_profiles (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    staff_id TEXT NOT NULL,
    role TEXT NOT NULL,
    department TEXT,
    employment_type TEXT DEFAULT 'FULL_TIME',
    base_salary DECIMAL(12,2) NOT NULL DEFAULT 0,
    allowances_json TEXT DEFAULT '{}',
    deductions_json TEXT DEFAULT '{}',
    bank_name TEXT,
    account_name TEXT,
    account_number TEXT,
    payment_method TEXT DEFAULT 'Bank Transfer',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(school_id, user_id),
    FOREIGN KEY(school_id) REFERENCES schools(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS payroll_runs (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL,
    title TEXT NOT NULL,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    month_label TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'DRAFT',
    notes TEXT,
    prepared_by TEXT,
    reviewed_by TEXT,
    approved_by TEXT,
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    approved_at DATETIME,
    UNIQUE(school_id, month, year),
    FOREIGN KEY(school_id) REFERENCES schools(id)
  );

  CREATE TABLE IF NOT EXISTS payroll_run_records (
    id TEXT PRIMARY KEY,
    payroll_run_id TEXT NOT NULL,
    school_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    staff_id TEXT NOT NULL,
    staff_name TEXT NOT NULL,
    role TEXT NOT NULL,
    department TEXT,
    base_salary DECIMAL(12,2) NOT NULL DEFAULT 0,
    allowances_json TEXT DEFAULT '{}',
    deductions_json TEXT DEFAULT '{}',
    incentive_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    accountant_note TEXT,
    gross_salary DECIMAL(12,2) NOT NULL DEFAULT 0,
    total_deductions DECIMAL(12,2) NOT NULL DEFAULT 0,
    net_salary DECIMAL(12,2) NOT NULL DEFAULT 0,
    payment_status TEXT NOT NULL DEFAULT 'Ready',
    payslip_number TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(payroll_run_id, user_id),
    FOREIGN KEY(payroll_run_id) REFERENCES payroll_runs(id),
    FOREIGN KEY(school_id) REFERENCES schools(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS payroll_payslips (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL,
    payroll_run_id TEXT NOT NULL,
    payroll_record_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    payslip_number TEXT NOT NULL,
    month_label TEXT NOT NULL,
    payment_date DATETIME NOT NULL,
    data_json TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(payroll_record_id),
    FOREIGN KEY(payroll_run_id) REFERENCES payroll_runs(id),
    FOREIGN KEY(payroll_record_id) REFERENCES payroll_run_records(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  -- Announcements
  CREATE TABLE IF NOT EXISTS announcements (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    role_visibility TEXT, -- comma separated roles
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(school_id) REFERENCES schools(id)
  );

  -- Contact messages (from public contact forms)
  CREATE TABLE IF NOT EXISTS contact_messages (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL,
    name TEXT,
    email TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(school_id) REFERENCES schools(id)
  );

  CREATE TABLE IF NOT EXISTS growth_partner_applications (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT,
    region TEXT,
    experience TEXT,
    audience TEXT,
    status TEXT DEFAULT 'Pending',
    reviewed_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Audit Logs
  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    school_id TEXT,
    user_id TEXT,
    action TEXT NOT NULL,
    details TEXT,
    ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  


    CREATE TABLE IF NOT EXISTS evaluations (
      id TEXT PRIMARY KEY,
      school_id TEXT,
      start_date TEXT,
      end_date TEXT,
      scope TEXT,
      is_forced BOOLEAN DEFAULT 1,
      is_active BOOLEAN DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS evaluation_responses (
      id TEXT PRIMARY KEY,
      evaluation_id TEXT,
      target_id TEXT,
      evaluator_role TEXT,
      rating INTEGER,
      comment TEXT,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS evaluation_progress (
      evaluator_id TEXT,
      evaluation_id TEXT,
      completed_count INTEGER DEFAULT 0,
      total_count INTEGER DEFAULT 0,
      finished BOOLEAN DEFAULT 0,
      PRIMARY KEY (evaluator_id, evaluation_id)
      );

    CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT, -- 'info', 'warning', 'error', 'success'
    is_read BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(school_id) REFERENCES schools(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);

// Additional feature tables: lesson notes, CBT, messages, farming
db.exec(`
  CREATE TABLE IF NOT EXISTS lesson_notes (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL,
    title TEXT NOT NULL,
    subject TEXT,
    content TEXT,
    week INTEGER,
    visibility TEXT,
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );


  CREATE TABLE IF NOT EXISTS aptitude_tests (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    duration_minutes INTEGER DEFAULT 30,
    candidate_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'Draft',
    scheduled_for TEXT,
    average_score REAL DEFAULT 0,
    success_rate REAL DEFAULT 0,
    questions_json TEXT,
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(school_id) REFERENCES schools(id)
  );

  CREATE TABLE IF NOT EXISTS staff_training_materials (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    material_type TEXT DEFAULT 'Guide',
    resource_url TEXT,
    audience TEXT DEFAULT 'All Staff',
    due_date TEXT,
    required_completion INTEGER DEFAULT 0,
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(school_id) REFERENCES schools(id)
  );

  CREATE TABLE IF NOT EXISTS staff_training_sessions (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL,
    title TEXT NOT NULL,
    summary TEXT,
    schedule TEXT,
    duration TEXT,
    live_session_id TEXT,
    material_ids_json TEXT,
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(school_id) REFERENCES schools(id),
    FOREIGN KEY(live_session_id) REFERENCES classroom_live_sessions(id)
  );

  CREATE TABLE IF NOT EXISTS staff_training_completions (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL,
    material_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(material_id, user_id),
    FOREIGN KEY(school_id) REFERENCES schools(id),
    FOREIGN KEY(material_id) REFERENCES staff_training_materials(id)
  );

  CREATE TABLE IF NOT EXISTS shared_files (
        id TEXT PRIMARY KEY,
        school_id TEXT,
        title TEXT NOT NULL,
        description TEXT,
        resource_url TEXT,
        scope TEXT DEFAULT 'school',
        source_type TEXT DEFAULT 'tenant',
        file_type TEXT DEFAULT 'Link',
        created_by TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        tags TEXT DEFAULT 'General',
        class_group TEXT,
        subject TEXT
      );
  CREATE TABLE IF NOT EXISTS lesson_plans (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL,
    topic TEXT NOT NULL,
    subject TEXT NOT NULL,
    week INTEGER NOT NULL,
    status TEXT DEFAULT 'Draft',
    visibility TEXT,
    release_at TEXT,
    live_class_mode TEXT,
    objectives TEXT,
    materials TEXT,
    activities TEXT,
    assessment TEXT,
    notes TEXT,
    live_class INTEGER DEFAULT 0,
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS cbt_exams (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL,
    title TEXT NOT NULL,
    total_marks INTEGER DEFAULT 100,
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS cbt_attempts (
    id TEXT PRIMARY KEY,
    exam_id TEXT NOT NULL,
    student_id TEXT NOT NULL,
    score INTEGER,
    answers TEXT, -- JSON
    taken_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(exam_id) REFERENCES cbt_exams(id)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL,
    from_user TEXT NOT NULL,
    to_user TEXT,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS messaging_settings (
    school_id TEXT PRIMARY KEY,
    allow_student_peer_messaging INTEGER DEFAULT 1,
    updated_by TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(school_id) REFERENCES schools(id)
  );

  CREATE TABLE IF NOT EXISTS library_books (
    id TEXT PRIMARY KEY,
    school_id TEXT,
    title TEXT NOT NULL,
    author_name TEXT NOT NULL,
    category TEXT NOT NULL,
    mode TEXT NOT NULL,
    library_scope TEXT NOT NULL,
    access_model TEXT NOT NULL,
    approval_status TEXT DEFAULT 'In Review',
    owner_user_id TEXT,
    owner_name TEXT,
    quality_label TEXT,
    format_label TEXT,
    summary TEXT,
    visibility_scope TEXT,
    shelf_code TEXT,
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(school_id) REFERENCES schools(id),
    FOREIGN KEY(owner_user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS book_versions (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL,
    version_label TEXT,
    storage_key TEXT,
    metadata_json TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(book_id) REFERENCES library_books(id)
  );

  CREATE TABLE IF NOT EXISTS book_categories (
    id TEXT PRIMARY KEY,
    school_id TEXT,
    name TEXT NOT NULL,
    description TEXT,
    is_global INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(school_id) REFERENCES schools(id)
  );

  CREATE TABLE IF NOT EXISTS book_pricing (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL,
    naira_price REAL DEFAULT 0,
    aura_price INTEGER DEFAULT 0,
    owner_share_percent INTEGER DEFAULT 80,
    platform_share_percent INTEGER DEFAULT 20,
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(book_id) REFERENCES library_books(id)
  );

  CREATE TABLE IF NOT EXISTS physical_borrows (
    id TEXT PRIMARY KEY,
    school_id TEXT,
    book_id TEXT NOT NULL,
    borrower_user_id TEXT NOT NULL,
    borrower_role TEXT,
    borrow_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    due_date DATETIME,
    status TEXT DEFAULT 'On Time',
    offline_logged INTEGER DEFAULT 0,
    sync_status TEXT DEFAULT 'Synced',
    librarian_user_id TEXT,
    return_marked_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(book_id) REFERENCES library_books(id),
    FOREIGN KEY(borrower_user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS digital_reads (
    id TEXT PRIMARY KEY,
    school_id TEXT,
    book_id TEXT NOT NULL,
    reader_user_id TEXT NOT NULL,
    pages_read INTEGER DEFAULT 0,
    minutes_spent INTEGER DEFAULT 0,
    bookmark_text TEXT,
    watermark_token TEXT,
    access_mode TEXT DEFAULT 'in-app',
    last_opened_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(book_id) REFERENCES library_books(id),
    FOREIGN KEY(reader_user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS return_confirmations (
    id TEXT PRIMARY KEY,
    borrow_id TEXT NOT NULL,
    confirmed_by_user_id TEXT,
    note TEXT,
    confirmed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(borrow_id) REFERENCES physical_borrows(id)
  );

  CREATE TABLE IF NOT EXISTS library_transactions (
    id TEXT PRIMARY KEY,
    school_id TEXT,
    book_id TEXT,
    user_id TEXT,
    amount_naira REAL DEFAULT 0,
    amount_aura INTEGER DEFAULT 0,
    transaction_type TEXT,
    status TEXT DEFAULT 'completed',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(book_id) REFERENCES library_books(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS aura_wallets (
    id TEXT PRIMARY KEY,
    school_id TEXT,
    user_id TEXT NOT NULL,
    balance_aura INTEGER DEFAULT 0,
    naira_equivalent REAL DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS earnings_split (
    id TEXT PRIMARY KEY,
    transaction_id TEXT NOT NULL,
    owner_user_id TEXT,
    owner_amount_naira REAL DEFAULT 0,
    owner_amount_aura INTEGER DEFAULT 0,
    platform_amount_naira REAL DEFAULT 0,
    platform_amount_aura INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(transaction_id) REFERENCES library_transactions(id)
  );

  CREATE TABLE IF NOT EXISTS ai_analysis_reports (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL,
    readability_score INTEGER DEFAULT 0,
    plagiarism_score INTEGER DEFAULT 0,
    structure_score INTEGER DEFAULT 0,
    relevance_score INTEGER DEFAULT 0,
    summary TEXT,
    tags_json TEXT,
    suggested_naira_price REAL DEFAULT 0,
    suggested_aura_price INTEGER DEFAULT 0,
    report_status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(book_id) REFERENCES library_books(id)
  );

  CREATE TABLE IF NOT EXISTS admin_reviews (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL,
    review_status TEXT DEFAULT 'pending',
    reviewer_user_id TEXT,
    note TEXT,
    reviewed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(book_id) REFERENCES library_books(id)
  );

  CREATE TABLE IF NOT EXISTS content_flags (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL,
    flagged_by_user_id TEXT,
    reason TEXT,
    status TEXT DEFAULT 'open',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(book_id) REFERENCES library_books(id)
  );

  CREATE TABLE IF NOT EXISTS library_recommendations (
    id TEXT PRIMARY KEY,
    school_id TEXT,
    book_id TEXT NOT NULL,
    recommender_user_id TEXT NOT NULL,
    recommender_role TEXT,
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(book_id, recommender_user_id),
    FOREIGN KEY(book_id) REFERENCES library_books(id),
    FOREIGN KEY(recommender_user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS clinic_profiles (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    patient_type TEXT NOT NULL,
    blood_group TEXT,
    genotype TEXT,
    allergies_json TEXT,
    chronic_conditions_json TEXT,
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    medical_notes TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(school_id) REFERENCES schools(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS clinic_visits (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL,
    patient_user_id TEXT NOT NULL,
    recorded_by_user_id TEXT,
    complaint TEXT NOT NULL,
    symptoms TEXT,
    diagnosis TEXT,
    treatment_administered TEXT NOT NULL,
    medications_json TEXT,
    vitals_json TEXT,
    outcome TEXT,
    case_status TEXT DEFAULT 'Open',
    triage_level TEXT DEFAULT 'Routine',
    follow_up_date TEXT,
    referral_notes TEXT,
    recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(school_id) REFERENCES schools(id),
    FOREIGN KEY(patient_user_id) REFERENCES users(id),
    FOREIGN KEY(recorded_by_user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS clinic_inventory (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL,
    item_name TEXT NOT NULL,
    category TEXT,
    dosage_form TEXT,
    stock_quantity INTEGER DEFAULT 0,
    unit_label TEXT DEFAULT 'units',
    reorder_level INTEGER DEFAULT 0,
    expiry_date TEXT,
    status TEXT DEFAULT 'In Stock',
    updated_by_user_id TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(school_id) REFERENCES schools(id),
    FOREIGN KEY(updated_by_user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS clinic_appointments (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL,
    patient_user_id TEXT NOT NULL,
    requested_by_user_id TEXT,
    assigned_to_user_id TEXT,
    reason TEXT NOT NULL,
    scheduled_for TEXT NOT NULL,
    status TEXT DEFAULT 'Scheduled',
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(school_id) REFERENCES schools(id),
    FOREIGN KEY(patient_user_id) REFERENCES users(id),
    FOREIGN KEY(requested_by_user_id) REFERENCES users(id),
    FOREIGN KEY(assigned_to_user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS tuckshop_products (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    image_url TEXT,
    price_naira REAL NOT NULL DEFAULT 0,
    stock_quantity INTEGER DEFAULT 0,
    stock_status TEXT DEFAULT 'In Stock',
    is_active INTEGER DEFAULT 1,
    created_by_user_id TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(school_id) REFERENCES schools(id),
    FOREIGN KEY(created_by_user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS tuckshop_sales (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL,
    buyer_user_id TEXT NOT NULL,
    buyer_role TEXT,
    student_user_id TEXT,
    product_id TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price_naira REAL NOT NULL DEFAULT 0,
    total_amount_naira REAL NOT NULL DEFAULT 0,
    amount_paid_naira REAL NOT NULL DEFAULT 0,
    balance_due_naira REAL NOT NULL DEFAULT 0,
    payment_source TEXT DEFAULT 'Wallet',
    payment_status TEXT DEFAULT 'paid',
    note TEXT,
    created_by_user_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(school_id) REFERENCES schools(id),
    FOREIGN KEY(buyer_user_id) REFERENCES users(id),
    FOREIGN KEY(student_user_id) REFERENCES users(id),
    FOREIGN KEY(product_id) REFERENCES tuckshop_products(id),
    FOREIGN KEY(created_by_user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS tuckshop_installments (
    id TEXT PRIMARY KEY,
    sale_id TEXT NOT NULL,
    amount_paid_naira REAL NOT NULL DEFAULT 0,
    recorded_by_user_id TEXT,
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(sale_id) REFERENCES tuckshop_sales(id),
    FOREIGN KEY(recorded_by_user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS tuckshop_balances (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    wallet_balance_naira REAL NOT NULL DEFAULT 0,
    credit_balance_naira REAL NOT NULL DEFAULT 0,
    spending_limit_naira REAL DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(school_id) REFERENCES schools(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS tuckshop_debtors (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    outstanding_balance_naira REAL NOT NULL DEFAULT 0,
    repayment_plan TEXT,
    status TEXT DEFAULT 'Active',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(school_id) REFERENCES schools(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS tuckshop_audit_logs (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL,
    actor_user_id TEXT,
    action TEXT NOT NULL,
    details_json TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(school_id) REFERENCES schools(id),
    FOREIGN KEY(actor_user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS tuckshop_orders (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL,
    requester_user_id TEXT NOT NULL,
    requester_role TEXT,
    student_user_id TEXT,
    product_id TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price_naira REAL NOT NULL DEFAULT 0,
    total_amount_naira REAL NOT NULL DEFAULT 0,
    payment_method TEXT,
    status TEXT DEFAULT 'Pending',
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(school_id) REFERENCES schools(id),
    FOREIGN KEY(requester_user_id) REFERENCES users(id),
    FOREIGN KEY(student_user_id) REFERENCES users(id),
    FOREIGN KEY(product_id) REFERENCES tuckshop_products(id)
  );

  CREATE TABLE IF NOT EXISTS tuckshop_payment_accounts (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL,
    method TEXT NOT NULL,
    account_name TEXT,
    account_number TEXT,
    bank_name TEXT,
    aura_wallet_id TEXT,
    instructions TEXT,
    is_active INTEGER DEFAULT 1,
    created_by_user_id TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(school_id) REFERENCES schools(id),
    FOREIGN KEY(created_by_user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS tuckshop_purchase_blocks (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL,
    parent_user_id TEXT NOT NULL,
    student_user_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    reason TEXT,
    is_blocked INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(school_id) REFERENCES schools(id),
    FOREIGN KEY(parent_user_id) REFERENCES users(id),
    FOREIGN KEY(student_user_id) REFERENCES users(id),
    FOREIGN KEY(product_id) REFERENCES tuckshop_products(id)
  );

  CREATE TABLE IF NOT EXISTS farms (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL,
    name TEXT NOT NULL,
    plot_count INTEGER DEFAULT 0,
    produce TEXT,
    manager_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS classroom_feed_posts (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL,
    class_id TEXT,
    author_id TEXT,
    author_name TEXT NOT NULL,
    author_role TEXT NOT NULL,
    body TEXT NOT NULL,
    pinned INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS classroom_feed_comments (
    id TEXT PRIMARY KEY,
    post_id TEXT NOT NULL,
    parent_comment_id TEXT,
    author_id TEXT,
    author_name TEXT NOT NULL,
    author_role TEXT NOT NULL,
    text TEXT NOT NULL,
    likes INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(post_id) REFERENCES classroom_feed_posts(id)
  );

  CREATE TABLE IF NOT EXISTS classroom_feed_reactions (
    id TEXT PRIMARY KEY,
    post_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    emoji TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(post_id) REFERENCES classroom_feed_posts(id)
  );

  CREATE TABLE IF NOT EXISTS classroom_subject_feed_archives (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL,
    subject_id TEXT NOT NULL,
    session_key TEXT NOT NULL,
    summary_json TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS classroom_assignments (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL,
    class_id TEXT,
    class_name TEXT,
    teacher_id TEXT,
    title TEXT NOT NULL,
    subject TEXT,
    due TEXT,
    status TEXT DEFAULT 'Draft',
    allow_comments INTEGER DEFAULT 1,
    allow_teacher_chat INTEGER DEFAULT 1,
    score TEXT DEFAULT 'Pending',
    teacher_feedback TEXT,
    types_json TEXT,
    shuffled_notice TEXT,
    sections_json TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS classroom_assignment_comments (
    id TEXT PRIMARY KEY,
    assignment_id TEXT NOT NULL,
    author_id TEXT,
    author_name TEXT NOT NULL,
    author_role TEXT NOT NULL,
    text TEXT NOT NULL,
    likes INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(assignment_id) REFERENCES classroom_assignments(id)
  );

  CREATE TABLE IF NOT EXISTS classroom_assignment_private_messages (
    id TEXT PRIMARY KEY,
    assignment_id TEXT NOT NULL,
    user_id TEXT,
    sender_role TEXT NOT NULL,
    text TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(assignment_id) REFERENCES classroom_assignments(id)
  );

  CREATE TABLE IF NOT EXISTS classroom_assignment_submissions (
    id TEXT PRIMARY KEY,
    assignment_id TEXT NOT NULL,
    student_id TEXT NOT NULL,
    answers_json TEXT,
    status TEXT DEFAULT 'Draft',
    submitted_at DATETIME,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(assignment_id, student_id),
    FOREIGN KEY(assignment_id) REFERENCES classroom_assignments(id)
  );

  CREATE TABLE IF NOT EXISTS classroom_notes (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL,
    title TEXT NOT NULL,
    subject TEXT,
    topic TEXT,
    week INTEGER,
    format TEXT,
    visibility TEXT,
    duration TEXT,
    summary TEXT,
    access TEXT,
    viewer_type TEXT,
    mime_type TEXT,
    file_name TEXT,
    file_size INTEGER,
    storage_key TEXT,
    analytics_json TEXT,
    materials_json TEXT,
    content_json TEXT,
    versions_json TEXT,
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS classroom_live_sessions (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL,
    title TEXT NOT NULL,
    mode TEXT,
    schedule TEXT,
    duration TEXT,
    attendees INTEGER DEFAULT 0,
    limit_count INTEGER DEFAULT 300,
    hosts_json TEXT,
    tools_json TEXT,
    note TEXT,
    status TEXT DEFAULT 'active',
    ended_at DATETIME,
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS classroom_subjects (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL,
    name TEXT NOT NULL,
    code TEXT,
    section TEXT,
    class_id TEXT,
    class_name TEXT,
    teacher_id TEXT,
    teacher_name TEXT,
    accent TEXT,
    summary TEXT,
    room TEXT,
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS classroom_subject_enrollments (
    id TEXT PRIMARY KEY,
    subject_id TEXT NOT NULL,
    class_id TEXT,
    student_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(subject_id) REFERENCES classroom_subjects(id)
  );

  CREATE TABLE IF NOT EXISTS classroom_practice_sets (
    id TEXT PRIMARY KEY,
    school_id TEXT,
    source TEXT NOT NULL,
    scope TEXT NOT NULL,
    subject TEXT NOT NULL,
    title TEXT NOT NULL,
    level TEXT,
    mode TEXT,
    reward TEXT,
    question_count INTEGER DEFAULT 0,
    note TEXT,
    questions_json TEXT,
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS classroom_result_records (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL,
    student_id TEXT NOT NULL,
    session TEXT NOT NULL,
    data_json TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, session)
  );
`);

const classroomFeedColumns = db.prepare("PRAGMA table_info(classroom_feed_posts)").all() as Array<{ name: string }>;
if (!classroomFeedColumns.some((column) => column.name === 'attachments_json')) {
  db.exec('ALTER TABLE classroom_feed_posts ADD COLUMN attachments_json TEXT');
}
if (!classroomFeedColumns.some((column) => column.name === 'scope')) {
  db.exec("ALTER TABLE classroom_feed_posts ADD COLUMN scope TEXT DEFAULT 'classroom'");
}
if (!classroomFeedColumns.some((column) => column.name === 'subject_id')) {
  db.exec('ALTER TABLE classroom_feed_posts ADD COLUMN subject_id TEXT');
}
if (!classroomFeedColumns.some((column) => column.name === 'session_key')) {
  db.exec("ALTER TABLE classroom_feed_posts ADD COLUMN session_key TEXT DEFAULT 'legacy'");
}

const classroomReactionColumns = db.prepare("PRAGMA table_info(classroom_feed_reactions)").all() as Array<{ name: string }>;
if (!classroomReactionColumns.some((column) => column.name === 'created_at')) {
  db.exec('ALTER TABLE classroom_feed_reactions ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP');
}

const notificationColumns = db.prepare("PRAGMA table_info(notifications)").all() as Array<{ name: string }>;
if (!notificationColumns.some((column) => column.name === 'school_id')) {
  db.exec("ALTER TABLE notifications ADD COLUMN school_id TEXT DEFAULT 'school_1'");
}
if (!notificationColumns.some((column) => column.name === 'user_id')) {
  db.exec("ALTER TABLE notifications ADD COLUMN user_id TEXT DEFAULT 'user_admin'");
}
if (!notificationColumns.some((column) => column.name === 'type')) {
  db.exec("ALTER TABLE notifications ADD COLUMN type TEXT DEFAULT 'info'");
}
if (!notificationColumns.some((column) => column.name === 'is_read')) {
  db.exec('ALTER TABLE notifications ADD COLUMN is_read BOOLEAN DEFAULT FALSE');
}
if (!notificationColumns.some((column) => column.name === 'created_at')) {
  db.exec('ALTER TABLE notifications ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP');
}

const messageColumns = db.prepare("PRAGMA table_info(messages)").all() as Array<{ name: string }>;
if (!messageColumns.some((column) => column.name === 'school_id')) {
  db.exec("ALTER TABLE messages ADD COLUMN school_id TEXT DEFAULT 'school_1'");
}
if (!messageColumns.some((column) => column.name === 'created_at')) {
  db.exec('ALTER TABLE messages ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP');
}

const userColumns = db.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>;
if (!userColumns.some((column) => column.name === 'auras')) {
  db.exec('ALTER TABLE users ADD COLUMN auras INTEGER DEFAULT 500');
}
if (!userColumns.some((column) => column.name === 'alternate_email')) {
  db.exec('ALTER TABLE users ADD COLUMN alternate_email TEXT');
}
if (!userColumns.some((column) => column.name === 'phone')) {
  db.exec('ALTER TABLE users ADD COLUMN phone TEXT');
}

const onboardingRequestColumns = db.prepare("PRAGMA table_info(school_onboarding_requests)").all() as Array<{ name: string }>;
if (onboardingRequestColumns.length && !onboardingRequestColumns.some((column) => column.name === 'payment_status')) {
  db.exec("ALTER TABLE school_onboarding_requests ADD COLUMN payment_status TEXT DEFAULT 'Pending'");
}
if (onboardingRequestColumns.length && !onboardingRequestColumns.some((column) => column.name === 'wait_token')) {
  db.exec("ALTER TABLE school_onboarding_requests ADD COLUMN wait_token TEXT DEFAULT ''");
}

db.exec(`
  CREATE TABLE IF NOT EXISTS duty_reports (
    id TEXT PRIMARY KEY,
    school_id TEXT,
    staff_id TEXT,
    date TEXT,
    report_text TEXT,
    report_data TEXT,
    ai_analysis TEXT,
    status TEXT DEFAULT 'pending',
    hos_notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS duty_roster_settings (
    school_id TEXT NOT NULL,
    roster_type TEXT NOT NULL,
    allow_same_class_pairing INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (school_id, roster_type)
  );

  CREATE TABLE IF NOT EXISTS duty_roster_entries (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL,
    roster_type TEXT NOT NULL,
    month_key TEXT NOT NULL,
    roster_date TEXT NOT NULL,
    lead_user_id TEXT,
    assistant_one_user_id TEXT,
    assistant_two_user_id TEXT,
    note TEXT,
    section TEXT NOT NULL DEFAULT '',
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (school_id, roster_type, roster_date, section)
  );

  CREATE TABLE IF NOT EXISTS user_profiles (
    user_id TEXT PRIMARY KEY,
    school_id TEXT,
    ndovera_email TEXT,
    alternate_email TEXT,
    phone TEXT,
    gender TEXT,
    date_of_birth TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    country TEXT,
    nationality TEXT,
    bio TEXT,
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    occupation TEXT,
    department TEXT,
    employee_id TEXT,
    admission_number TEXT,
    class_name TEXT,
    guardian_name TEXT,
    guardian_phone TEXT,
    skills_json TEXT,
    social_links_json TEXT,
    preferences_json TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS result_uploads (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL,
    uploader_user_id TEXT NOT NULL,
    uploader_role TEXT NOT NULL,
    title TEXT NOT NULL,
    session TEXT,
    term TEXT,
    class_name TEXT,
    result_type TEXT DEFAULT 'Result Sheet',
    file_name TEXT,
    file_url TEXT,
    notes TEXT,
    status TEXT DEFAULT 'uploaded',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS school_onboarding_requests (
    id TEXT PRIMARY KEY,
    school_name TEXT NOT NULL,
    subdomain TEXT NOT NULL,
    owner_name TEXT NOT NULL,
    owner_ndovera_email TEXT NOT NULL,
    owner_alternate_email TEXT,
    owner_phone TEXT,
    desired_password_hash TEXT NOT NULL,
    payment_reference TEXT,
    payment_proof_url TEXT,
    status TEXT DEFAULT 'Awaiting Payment',
    payment_status TEXT DEFAULT 'Pending',
    wait_token TEXT NOT NULL UNIQUE,
    notes TEXT,
    approved_school_id TEXT,
    approved_user_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

const dutyReportColumns = db.prepare("PRAGMA table_info(duty_reports)").all() as Array<{ name: string }>;
if (!dutyReportColumns.some((column) => column.name === 'school_id')) {
  db.exec("ALTER TABLE duty_reports ADD COLUMN school_id TEXT DEFAULT 'school_1'");
}
if (!dutyReportColumns.some((column) => column.name === 'report_data')) {
  db.exec('ALTER TABLE duty_reports ADD COLUMN report_data TEXT');
}
if (!dutyReportColumns.some((column) => column.name === 'ai_analysis')) {
  db.exec('ALTER TABLE duty_reports ADD COLUMN ai_analysis TEXT');
}

const studentColumns = db.prepare("PRAGMA table_info(students)").all() as Array<{ name: string }>;
if (!studentColumns.some((column) => column.name === 'secondary_parent_id')) {
  db.exec('ALTER TABLE students ADD COLUMN secondary_parent_id TEXT');
}

const classColumns = db.prepare("PRAGMA table_info(classes)").all() as Array<{ name: string }>;
if (!classColumns.some((column) => column.name === 'section')) {
  db.exec("ALTER TABLE classes ADD COLUMN section TEXT DEFAULT 'junior-secondary'");
}
const tuckshopProductColumns = db.prepare("PRAGMA table_info(tuckshop_products)").all() as Array<{ name: string }>;
if (!tuckshopProductColumns.some((column) => column.name === 'image_url')) {
  db.exec('ALTER TABLE tuckshop_products ADD COLUMN image_url TEXT');
}
const tuckshopOrderColumns = db.prepare("PRAGMA table_info(tuckshop_orders)").all() as Array<{ name: string }>;
if (!tuckshopOrderColumns.some((column) => column.name === 'requester_user_id')) {
  db.exec("ALTER TABLE tuckshop_orders ADD COLUMN requester_user_id TEXT DEFAULT 'user_admin'");
}
if (!tuckshopOrderColumns.some((column) => column.name === 'requester_role')) {
  db.exec("ALTER TABLE tuckshop_orders ADD COLUMN requester_role TEXT DEFAULT 'Student'");
}
if (!tuckshopOrderColumns.some((column) => column.name === 'student_user_id')) {
  db.exec('ALTER TABLE tuckshop_orders ADD COLUMN student_user_id TEXT');
}
if (!tuckshopOrderColumns.some((column) => column.name === 'unit_price_naira')) {
  db.exec('ALTER TABLE tuckshop_orders ADD COLUMN unit_price_naira REAL NOT NULL DEFAULT 0');
}
if (!tuckshopOrderColumns.some((column) => column.name === 'total_amount_naira')) {
  db.exec('ALTER TABLE tuckshop_orders ADD COLUMN total_amount_naira REAL NOT NULL DEFAULT 0');
}
if (!tuckshopOrderColumns.some((column) => column.name === 'payment_method')) {
  db.exec('ALTER TABLE tuckshop_orders ADD COLUMN payment_method TEXT');
}
if (!tuckshopOrderColumns.some((column) => column.name === 'note')) {
  db.exec('ALTER TABLE tuckshop_orders ADD COLUMN note TEXT');
}
if (!tuckshopOrderColumns.some((column) => column.name === 'created_at')) {
  db.exec('ALTER TABLE tuckshop_orders ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP');
}
const tuckshopOrderHasLegacyRequesterColumn = tuckshopOrderColumns.some((column) => column.name === 'requested_by_user_id');
if (tuckshopOrderHasLegacyRequesterColumn) {
  db.exec(`
    UPDATE tuckshop_orders
    SET requester_user_id = COALESCE(NULLIF(requester_user_id, ''), requested_by_user_id)
    WHERE requester_user_id IS NULL OR TRIM(requester_user_id) = ''
  `);
}
db.exec(`
  UPDATE classes
  SET section = CASE
    WHEN section IS NOT NULL AND TRIM(section) <> '' THEN section
    WHEN LOWER(COALESCE(level, '')) LIKE '%nursery%' OR LOWER(COALESCE(name, '')) LIKE '%nursery%' THEN 'pre-school'
    WHEN LOWER(COALESCE(level, '')) LIKE '%grade%' OR LOWER(COALESCE(name, '')) LIKE '%grade%' OR LOWER(COALESCE(name, '')) LIKE '%primary%' THEN 'primary'
    WHEN LOWER(COALESCE(level, '')) LIKE '%shs%' OR LOWER(COALESCE(level, '')) LIKE '%ss%' OR LOWER(COALESCE(name, '')) LIKE '%senior%' THEN 'senior-secondary'
    ELSE 'junior-secondary'
  END
  WHERE section IS NULL OR TRIM(section) = ''
`);

const classroomSubjectColumns = db.prepare("PRAGMA table_info(classroom_subjects)").all() as Array<{ name: string }>;
if (!classroomSubjectColumns.some((column) => column.name === 'section')) {
  db.exec("ALTER TABLE classroom_subjects ADD COLUMN section TEXT DEFAULT 'junior-secondary'");
}

const classroomNoteColumns = db.prepare("PRAGMA table_info(classroom_notes)").all() as Array<{ name: string }>;
if (!classroomNoteColumns.some((column) => column.name === 'viewer_type')) {
  db.exec('ALTER TABLE classroom_notes ADD COLUMN viewer_type TEXT');
}
if (!classroomNoteColumns.some((column) => column.name === 'mime_type')) {
  db.exec('ALTER TABLE classroom_notes ADD COLUMN mime_type TEXT');
}
if (!classroomNoteColumns.some((column) => column.name === 'file_name')) {
  db.exec('ALTER TABLE classroom_notes ADD COLUMN file_name TEXT');
}
if (!classroomNoteColumns.some((column) => column.name === 'file_size')) {
  db.exec('ALTER TABLE classroom_notes ADD COLUMN file_size INTEGER');
}
if (!classroomNoteColumns.some((column) => column.name === 'storage_key')) {
  db.exec('ALTER TABLE classroom_notes ADD COLUMN storage_key TEXT');
}
if (!classroomNoteColumns.some((column) => column.name === 'materials_json')) {
  db.exec('ALTER TABLE classroom_notes ADD COLUMN materials_json TEXT');
}
if (!classroomNoteColumns.some((column) => column.name === 'content_json')) {
  db.exec('ALTER TABLE classroom_notes ADD COLUMN content_json TEXT');
}

const classroomLiveSessionColumns = db.prepare("PRAGMA table_info(classroom_live_sessions)").all() as Array<{ name: string }>;
if (!classroomLiveSessionColumns.some((column) => column.name === 'status')) {
  db.exec("ALTER TABLE classroom_live_sessions ADD COLUMN status TEXT DEFAULT 'active'");
}
if (!classroomLiveSessionColumns.some((column) => column.name === 'ended_at')) {
  db.exec('ALTER TABLE classroom_live_sessions ADD COLUMN ended_at DATETIME');
}

const aptitudeTestColumns = db.prepare("PRAGMA table_info(aptitude_tests)").all() as Array<{ name: string }>;
if (!aptitudeTestColumns.some((column) => column.name === 'description')) {
  db.exec('ALTER TABLE aptitude_tests ADD COLUMN description TEXT');
}
if (!aptitudeTestColumns.some((column) => column.name === 'duration_minutes')) {
  db.exec('ALTER TABLE aptitude_tests ADD COLUMN duration_minutes INTEGER DEFAULT 30');
}
if (!aptitudeTestColumns.some((column) => column.name === 'candidate_count')) {
  db.exec('ALTER TABLE aptitude_tests ADD COLUMN candidate_count INTEGER DEFAULT 0');
}
if (!aptitudeTestColumns.some((column) => column.name === 'status')) {
  db.exec("ALTER TABLE aptitude_tests ADD COLUMN status TEXT DEFAULT 'Draft'");
}
if (!aptitudeTestColumns.some((column) => column.name === 'scheduled_for')) {
  db.exec('ALTER TABLE aptitude_tests ADD COLUMN scheduled_for TEXT');
}
if (!aptitudeTestColumns.some((column) => column.name === 'average_score')) {
  db.exec('ALTER TABLE aptitude_tests ADD COLUMN average_score REAL DEFAULT 0');
}
if (!aptitudeTestColumns.some((column) => column.name === 'success_rate')) {
  db.exec('ALTER TABLE aptitude_tests ADD COLUMN success_rate REAL DEFAULT 0');
}
if (!aptitudeTestColumns.some((column) => column.name === 'questions_json')) {
  db.exec('ALTER TABLE aptitude_tests ADD COLUMN questions_json TEXT');
}
if (!aptitudeTestColumns.some((column) => column.name === 'created_by')) {
  db.exec('ALTER TABLE aptitude_tests ADD COLUMN created_by TEXT');
}

const schoolColumns = db.prepare("PRAGMA table_info(schools)").all() as Array<{ name: string }>;
if (!schoolColumns.some((column) => column.name === 'live_class_quota')) {
  db.exec('ALTER TABLE schools ADD COLUMN live_class_quota INTEGER DEFAULT 5');
}
db.exec('UPDATE schools SET live_class_quota = 5 WHERE live_class_quota IS NULL OR live_class_quota < 1');

const attendanceColumns = db.prepare("PRAGMA table_info(attendance)").all() as Array<{ name: string }>;
if (!attendanceColumns.some((column) => column.name === 'morning_status')) {
  db.exec('ALTER TABLE attendance ADD COLUMN morning_status TEXT');
}
if (!attendanceColumns.some((column) => column.name === 'afternoon_status')) {
  db.exec('ALTER TABLE attendance ADD COLUMN afternoon_status TEXT');
}
db.exec(`
  UPDATE classroom_subjects
  SET section = CASE
    WHEN section IS NOT NULL AND TRIM(section) <> '' THEN section
    WHEN LOWER(COALESCE(class_name, '')) LIKE '%nursery%' OR LOWER(COALESCE(class_name, '')) LIKE '%pre%' THEN 'pre-school'
    WHEN LOWER(COALESCE(class_name, '')) LIKE '%primary%' OR LOWER(COALESCE(class_name, '')) LIKE '%grade%' THEN 'primary'
    WHEN LOWER(COALESCE(class_name, '')) LIKE '%ss%' THEN 'senior-secondary'
    ELSE 'junior-secondary'
  END
  WHERE section IS NULL OR TRIM(section) = ''
`);

// Seed Data Function
function seedDatabase() {
  const schoolCount = db.prepare("SELECT COUNT(*) as count FROM schools").get() as { count: number };
  if (schoolCount.count === 0) {
    const schoolId = "school_1";
    db.prepare(`
      INSERT INTO schools (id, name, subdomain, primary_color, live_class_quota) 
      VALUES (?, ?, ?, ?, ?)
    `).run(schoolId, "Ndovera Academy", "ndovera", "#10b981", 5);

    // Admin User
    db.prepare(`
      INSERT INTO users (id, school_id, name, email, password_hash, role)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run("user_admin", schoolId, "Ndovera Admin", "admin@school.com", hashPassword('NdoveraAdmin!2026'), "School Admin");

    // Teachers
    const teachers = [
      ["t1", "John Doe", "john@school.com", "Mathematics"],
      ["t2", "Jane Smith", "jane@school.com", "English Language"],
      ["t3", "Samuel Okoro", "samuel@school.com", "Agricultural Science"]
    ];
    teachers.forEach(([id, name, email, spec]) => {
      db.prepare("INSERT INTO users (id, school_id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?, ?)").run(id, schoolId, name, email, hashPassword('TeacherPass!2026'), "Teacher");
      db.prepare("INSERT INTO teachers (id, school_id, user_id, staff_id, specialization) VALUES (?, ?, ?, ?, ?)").run(`teacher_${id}`, schoolId, id, `STF${id.toUpperCase()}`, spec);
    });

    // Classes
    db.prepare("INSERT INTO classes (id, school_id, name, level, section, teacher_id) VALUES (?, ?, ?, ?, ?, ?)").run("class_1", schoolId, "Thinkers", "JHS 1", "junior-secondary", "teacher_t1");
    db.prepare("INSERT INTO classes (id, school_id, name, level, section, teacher_id) VALUES (?, ?, ?, ?, ?, ?)").run("class_2", schoolId, "Visionaries", "SHS 1", "senior-secondary", "teacher_t3");

    // Students
    const students = [
      ["s1", "Alice Johnson", "alice@student.com", "ADM001", "class_1"],
      ["s2", "Bob Williams", "bob@student.com", "ADM002", "class_1"],
      ["s3", "Charlie Brown", "charlie@student.com", "ADM003", "class_2"]
    ];
    students.forEach(([id, name, email, adm, classId]) => {
      db.prepare("INSERT INTO users (id, school_id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?, ?)").run(id, schoolId, name, email, hashPassword('StudentPass!2026'), "Student");
      db.prepare("INSERT INTO students (id, school_id, user_id, admission_number, class_id) VALUES (?, ?, ?, ?, ?)").run(`student_${id}`, schoolId, id, adm, classId);
    });

    // Announcements
    db.prepare("INSERT INTO announcements (id, school_id, title, content, role_visibility) VALUES (?, ?, ?, ?, ?)").run("ann_1", schoolId, "Inter-House Sports Day", "The annual competition holds on March 15th.", "Student,Teacher,Parent");

    // Default messaging rules
    db.prepare("INSERT OR IGNORE INTO messaging_settings (school_id, allow_student_peer_messaging, updated_by) VALUES (?, ?, ?)").run(schoolId, 0, 'user_admin');
    
    // Fees
    db.prepare("INSERT INTO fees (id, school_id, title, amount, due_date) VALUES (?, ?, ?, ?, ?)").run("fee_1", schoolId, "Tuition Fee - Term 2", 150000, "2026-03-30");
  }
}

seedDatabase();

db.prepare("UPDATE users SET password_hash = ? WHERE id = 'user_admin' AND password_hash IN ('hashed_password', 'pass')").run(hashPassword('NdoveraAdmin!2026'));
db.prepare("UPDATE users SET password_hash = ? WHERE role = 'Teacher' AND password_hash = 'pass'").run(hashPassword('TeacherPass!2026'));
db.prepare("UPDATE users SET password_hash = ? WHERE role = 'Student' AND password_hash = 'pass'").run(hashPassword('StudentPass!2026'));

function safeParseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function sumNumberMap(input: Record<string, number | string | null | undefined>) {
  return Object.values(input || {}).reduce<number>((total, value) => total + Number(value || 0), 0);
}

function monthLabelFromParts(month: number, year: number) {
  return new Date(year, Math.max(0, month - 1), 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

function maskAccountNumber(accountNumber: string | null | undefined) {
  const raw = String(accountNumber || '').replace(/\s+/g, '');
  if (!raw) return '—';
  if (raw.length <= 4) return raw;
  return `${'*'.repeat(Math.max(0, raw.length - 4))}${raw.slice(-4)}`;
}

function calculatePayrollFigures(baseSalary: number, allowances: Record<string, number>, deductions: Record<string, number>, incentiveAmount: number) {
  const totalAllowances = Number(sumNumberMap(allowances) || 0);
  const totalDeductions = Number(sumNumberMap(deductions) || 0);
  const grossSalary = Number(baseSalary || 0) + totalAllowances + Number(incentiveAmount || 0);
  const netSalary = Math.max(0, grossSalary - totalDeductions);
  return {
    totalAllowances,
    totalDeductions,
    grossSalary,
    netSalary,
  };
}

function ensurePayrollProfilesForSchool(schoolId: string) {
  const teacherRows = db.prepare(`
    SELECT t.user_id, t.staff_id, t.specialization, u.name, u.role
    FROM teachers t
    JOIN users u ON u.id = t.user_id
    WHERE t.school_id = ?
    ORDER BY u.name ASC
  `).all(schoolId) as Array<{ user_id: string; staff_id: string; specialization: string | null; name: string; role: string }>;

  teacherRows.forEach((teacher, index) => {
    const existing = db.prepare('SELECT id FROM payroll_profiles WHERE school_id = ? AND user_id = ?').get(schoolId, teacher.user_id) as { id?: string } | undefined;
    if (existing?.id) return;

    const baseSalary = 160000 + index * 5000;
    const allowances = { Housing: 25000, Transport: 12000 };
    const deductions = { PAYE: 15000, Pension: 7000 };

    db.prepare(`
      INSERT INTO payroll_profiles (
        id, school_id, user_id, staff_id, role, department, base_salary,
        allowances_json, deductions_json, bank_name, account_name, account_number, payment_method
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      makeId('payprof'),
      schoolId,
      teacher.user_id,
      teacher.staff_id,
      teacher.role || 'Teacher',
      teacher.specialization || 'Academics',
      baseSalary,
      JSON.stringify(allowances),
      JSON.stringify(deductions),
      'First Bank',
      teacher.name,
      `00000000${index + 1}`,
      'Bank Transfer',
    );
  });
}

function mapPayrollProfile(profile: any) {
  const allowances = safeParseJson<Record<string, number>>(profile.allowances_json, {});
  const deductions = safeParseJson<Record<string, number>>(profile.deductions_json, {});
  const figures = calculatePayrollFigures(Number(profile.base_salary || 0), allowances, deductions, 0);
  return {
    id: profile.id,
    userId: profile.user_id,
    staffId: profile.staff_id,
    name: profile.account_name || profile.name || profile.staff_id,
    role: profile.role,
    department: profile.department || 'General',
    employmentType: profile.employment_type || 'FULL_TIME',
    baseSalary: Number(profile.base_salary || 0),
    allowances,
    deductions,
    totalAllowances: figures.totalAllowances,
    totalDeductions: figures.totalDeductions,
    projectedNetSalary: figures.netSalary,
    bankName: profile.bank_name || '',
    accountName: profile.account_name || '',
    accountNumberMasked: maskAccountNumber(profile.account_number),
    paymentMethod: profile.payment_method || 'Bank Transfer',
    updatedAt: profile.updated_at,
  };
}

function mapPayrollRunRecord(record: any) {
  const allowances = safeParseJson<Record<string, number>>(record.allowances_json, {});
  const deductions = safeParseJson<Record<string, number>>(record.deductions_json, {});
  return {
    id: record.id,
    payrollRunId: record.payroll_run_id,
    userId: record.user_id,
    staffId: record.staff_id,
    staffName: record.staff_name,
    role: record.role,
    department: record.department || 'General',
    baseSalary: Number(record.base_salary || 0),
    allowances,
    deductions,
    incentiveAmount: Number(record.incentive_amount || 0),
    grossSalary: Number(record.gross_salary || 0),
    totalDeductions: Number(record.total_deductions || 0),
    netSalary: Number(record.net_salary || 0),
    paymentStatus: record.payment_status || 'Ready',
    payslipNumber: record.payslip_number || null,
    accountantNote: record.accountant_note || '',
  };
}

function getPayrollRunTotals(records: any[]) {
  return records.reduce((totals, record) => {
    totals.baseSalary += Number(record.base_salary || 0);
    totals.grossSalary += Number(record.gross_salary || 0);
    totals.netSalary += Number(record.net_salary || 0);
    totals.totalDeductions += Number(record.total_deductions || 0);
    totals.totalIncentives += Number(record.incentive_amount || 0);
    return totals;
  }, {
    baseSalary: 0,
    grossSalary: 0,
    netSalary: 0,
    totalDeductions: 0,
    totalIncentives: 0,
  });
}

function createPayrollRunFromProfiles(params: { schoolId: string; month: number; year: number; createdBy?: string | null; preparedBy?: string | null; notes?: string | null }) {
  const schoolId = params.schoolId;
  ensurePayrollProfilesForSchool(schoolId);

  const existing = db.prepare('SELECT id FROM payroll_runs WHERE school_id = ? AND month = ? AND year = ?').get(schoolId, params.month, params.year) as { id?: string } | undefined;
  if (existing?.id) {
    return { duplicate: true, runId: existing.id };
  }

  const profiles = db.prepare('SELECT * FROM payroll_profiles WHERE school_id = ? ORDER BY staff_id ASC').all(schoolId) as any[];
  const runId = makeId('payrun');
  const monthLabel = monthLabelFromParts(params.month, params.year);

  db.prepare(`
    INSERT INTO payroll_runs (
      id, school_id, title, month, year, month_label, status, notes, prepared_by, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    runId,
    schoolId,
    `Payroll ${monthLabel}`,
    params.month,
    params.year,
    monthLabel,
    'DRAFT',
    params.notes || 'Draft payroll generated from salary profiles.',
    params.preparedBy || 'Finance Desk',
    params.createdBy || null,
  );

  profiles.forEach((profile, index) => {
    const allowances = safeParseJson<Record<string, number>>(profile.allowances_json, {});
    const deductions = safeParseJson<Record<string, number>>(profile.deductions_json, {});
    const incentiveAmount = Math.max(0, Number((index + 1) * 1000));
    const figures = calculatePayrollFigures(Number(profile.base_salary || 0), allowances, deductions, incentiveAmount);

    db.prepare(`
      INSERT INTO payroll_run_records (
        id, payroll_run_id, school_id, user_id, staff_id, staff_name, role, department,
        base_salary, allowances_json, deductions_json, incentive_amount, accountant_note,
        gross_salary, total_deductions, net_salary, payment_status, payslip_number
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      makeId('payrec'),
      runId,
      schoolId,
      profile.user_id,
      profile.staff_id,
      profile.account_name || profile.staff_id,
      profile.role,
      profile.department,
      Number(profile.base_salary || 0),
      JSON.stringify(allowances),
      JSON.stringify(deductions),
      incentiveAmount,
      'Generated from staff payroll profile.',
      figures.grossSalary,
      figures.totalDeductions,
      figures.netSalary,
      'Ready',
      null,
    );
  });

  return { duplicate: false, runId };
}

function approvePayrollRun(runId: string, approverName: string, approverUserId?: string | null) {
  const run = db.prepare('SELECT * FROM payroll_runs WHERE id = ?').get(runId) as any;
  if (!run?.id) return { error: 'Payroll run not found' };

  const approvedAt = new Date().toISOString();
  db.prepare('UPDATE payroll_runs SET status = ?, reviewed_by = ?, approved_by = ?, approved_at = ? WHERE id = ?')
    .run('APPROVED', approverName, approverName, approvedAt, runId);

  const school = db.prepare('SELECT id, name, logo_url, primary_color FROM schools WHERE id = ?').get(run.school_id) as any;
  const records = db.prepare('SELECT prr.*, pp.bank_name, pp.account_name, pp.account_number, pp.payment_method FROM payroll_run_records prr LEFT JOIN payroll_profiles pp ON pp.school_id = prr.school_id AND pp.user_id = prr.user_id WHERE prr.payroll_run_id = ? ORDER BY prr.staff_name ASC').all(runId) as any[];

  records.forEach((record, index) => {
    const payslipNumber = record.payslip_number || `NDV-PS-${run.year}-${String(run.month).padStart(2, '0')}-${String(index + 1).padStart(4, '0')}`;
    db.prepare('UPDATE payroll_run_records SET payment_status = ?, payslip_number = ? WHERE id = ?').run('Paid', payslipNumber, record.id);

    const snapshot = buildPayslipSnapshot({ ...run, approved_at: approvedAt }, { ...record, payslip_number: payslipNumber }, school);
    const existing = db.prepare('SELECT id FROM payroll_payslips WHERE payroll_record_id = ?').get(record.id) as { id?: string } | undefined;
    if (existing?.id) {
      db.prepare('UPDATE payroll_payslips SET payslip_number = ?, month_label = ?, payment_date = ?, data_json = ? WHERE id = ?')
        .run(payslipNumber, run.month_label, approvedAt, JSON.stringify(snapshot), existing.id);
    } else {
      db.prepare(`
        INSERT INTO payroll_payslips (id, school_id, payroll_run_id, payroll_record_id, user_id, payslip_number, month_label, payment_date, data_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(makeId('payslip'), run.school_id, run.id, record.id, record.user_id, payslipNumber, run.month_label, approvedAt, JSON.stringify(snapshot));
    }
  });

  if (approverUserId) {
    db.prepare('UPDATE payroll_runs SET created_by = COALESCE(created_by, ?) WHERE id = ?').run(approverUserId, runId);
  }

  return { ok: true, approvedAt };
}

function buildPayslipSnapshot(run: any, record: any, school: any) {
  const allowances = safeParseJson<Record<string, number>>(record.allowances_json, {});
  const deductions = safeParseJson<Record<string, number>>(record.deductions_json, {});
  return {
    payslipNumber: record.payslip_number,
    payrollRunId: run.id,
    payrollRecordId: record.id,
    school: {
      id: school?.id,
      name: school?.name || 'Ndovera Academy',
      logoUrl: school?.logo_url || null,
      primaryColor: school?.primary_color || '#10b981',
    },
    period: run.month_label,
    paymentDate: run.approved_at || run.created_at,
    staff: {
      userId: record.user_id,
      staffId: record.staff_id,
      name: record.staff_name,
      role: record.role,
      department: record.department || 'General',
    },
    bank: {
      bankName: record.bank_name || 'Ndovera Salary Desk',
      accountName: record.account_name || record.staff_name,
      accountNumberMasked: maskAccountNumber(record.account_number),
      paymentMethod: record.payment_method || 'Bank Transfer',
    },
    salary: {
      baseSalary: Number(record.base_salary || 0),
      incentiveAmount: Number(record.incentive_amount || 0),
      allowances,
      deductions,
      grossSalary: Number(record.gross_salary || 0),
      totalDeductions: Number(record.total_deductions || 0),
      netSalary: Number(record.net_salary || 0),
    },
    accountantNote: record.accountant_note || '',
  };
}

function seedPayrollData() {
  const schoolId = 'school_1';
  const profileCount = db.prepare('SELECT COUNT(*) as count FROM payroll_profiles WHERE school_id = ?').get(schoolId) as { count?: number } | undefined;
  if (Number(profileCount?.count || 0) === 0) {
    const teacherRows = db.prepare(`
      SELECT t.user_id, t.staff_id, t.specialization, u.name, u.role
      FROM teachers t
      JOIN users u ON u.id = t.user_id
      WHERE t.school_id = ?
      ORDER BY u.name ASC
    `).all(schoolId) as Array<{ user_id: string; staff_id: string; specialization: string | null; name: string; role: string }>;

    const salaryTemplates: Record<string, { base: number; allowances: Record<string, number>; deductions: Record<string, number>; bankName: string; accountNumber: string }> = {
      t1: { base: 185000, allowances: { Housing: 35000, Transport: 18000, Bonus: 12000 }, deductions: { PAYE: 22000, Pension: 9000 }, bankName: 'Access Bank', accountNumber: '0123456789' },
      t2: { base: 175000, allowances: { Housing: 32000, Transport: 15000, Bonus: 10000 }, deductions: { PAYE: 20000, Pension: 8500 }, bankName: 'GTBank', accountNumber: '1234567890' },
      t3: { base: 165000, allowances: { Housing: 30000, Transport: 14000, Bonus: 9000 }, deductions: { PAYE: 18500, Pension: 8000, Loan: 5000 }, bankName: 'Zenith Bank', accountNumber: '2345678901' },
    };

    teacherRows.forEach((teacher, index) => {
      const template = salaryTemplates[teacher.user_id] || {
        base: 160000 + index * 5000,
        allowances: { Housing: 25000, Transport: 12000 },
        deductions: { PAYE: 15000, Pension: 7000 },
        bankName: 'First Bank',
        accountNumber: `00000000${index + 1}`,
      };
      db.prepare(`
        INSERT INTO payroll_profiles (
          id, school_id, user_id, staff_id, role, department, base_salary,
          allowances_json, deductions_json, bank_name, account_name, account_number, payment_method
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        makeId('payprof'),
        schoolId,
        teacher.user_id,
        teacher.staff_id,
        teacher.role || 'Teacher',
        teacher.specialization || 'Academics',
        template.base,
        JSON.stringify(template.allowances),
        JSON.stringify(template.deductions),
        template.bankName,
        teacher.name,
        template.accountNumber,
        'Bank Transfer',
      );
    });
  }

  const runCount = db.prepare('SELECT COUNT(*) as count FROM payroll_runs WHERE school_id = ?').get(schoolId) as { count?: number } | undefined;
  if (Number(runCount?.count || 0) === 0) {
    const school = db.prepare('SELECT id, name, logo_url, primary_color FROM schools WHERE id = ?').get(schoolId) as any;
    const profiles = db.prepare('SELECT * FROM payroll_profiles WHERE school_id = ? ORDER BY staff_id ASC').all(schoolId) as any[];

    const buildRun = (month: number, year: number, status: 'DRAFT' | 'APPROVED') => {
      const runId = makeId('payrun');
      const approvedAt = status === 'APPROVED' ? new Date(year, month - 1, 28, 15, 0, 0).toISOString() : null;
      db.prepare(`
        INSERT INTO payroll_runs (
          id, school_id, title, month, year, month_label, status, notes,
          prepared_by, reviewed_by, approved_by, created_by, approved_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        runId,
        schoolId,
        `Payroll ${monthLabelFromParts(month, year)}`,
        month,
        year,
        monthLabelFromParts(month, year),
        status,
        status === 'DRAFT' ? 'Draft payroll ready for final review.' : 'Approved and archived payroll batch.',
        'Ndovera Admin',
        status === 'APPROVED' ? 'Head of School' : null,
        status === 'APPROVED' ? 'Owner' : null,
        'user_admin',
        approvedAt,
      );

      profiles.forEach((profile, index) => {
        const allowances = safeParseJson<Record<string, number>>(profile.allowances_json, {});
        const deductions = safeParseJson<Record<string, number>>(profile.deductions_json, {});
        const incentiveAmount = status === 'APPROVED' ? 5000 + index * 1500 : 3500 + index * 1000;
        const figures = calculatePayrollFigures(Number(profile.base_salary || 0), allowances, deductions, incentiveAmount);
        const recordId = makeId('payrec');
        const payslipNumber = status === 'APPROVED' ? `NDV-PS-${year}-${String(month).padStart(2, '0')}-${String(index + 1).padStart(4, '0')}` : null;
        db.prepare(`
          INSERT INTO payroll_run_records (
            id, payroll_run_id, school_id, user_id, staff_id, staff_name, role, department,
            base_salary, allowances_json, deductions_json, incentive_amount, accountant_note,
            gross_salary, total_deductions, net_salary, payment_status, payslip_number
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          recordId,
          runId,
          schoolId,
          profile.user_id,
          profile.staff_id,
          profile.account_name || profile.staff_id,
          profile.role,
          profile.department,
          Number(profile.base_salary || 0),
          JSON.stringify(allowances),
          JSON.stringify(deductions),
          incentiveAmount,
          status === 'APPROVED' ? 'Approved monthly payroll and released to staff.' : 'Awaiting final approval and dispatch.',
          figures.grossSalary,
          figures.totalDeductions,
          figures.netSalary,
          status === 'APPROVED' ? 'Paid' : 'Ready',
          payslipNumber,
        );

        if (status === 'APPROVED' && payslipNumber) {
          db.prepare(`
            INSERT INTO payroll_payslips (id, school_id, payroll_run_id, payroll_record_id, user_id, payslip_number, month_label, payment_date, data_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            makeId('payslip'),
            schoolId,
            runId,
            recordId,
            profile.user_id,
            payslipNumber,
            monthLabelFromParts(month, year),
            approvedAt,
            JSON.stringify(buildPayslipSnapshot({ id: runId, month_label: monthLabelFromParts(month, year), approved_at: approvedAt, created_at: approvedAt }, {
              id: recordId,
              user_id: profile.user_id,
              staff_id: profile.staff_id,
              staff_name: profile.account_name || profile.staff_id,
              role: profile.role,
              department: profile.department,
              base_salary: Number(profile.base_salary || 0),
              allowances_json: JSON.stringify(allowances),
              deductions_json: JSON.stringify(deductions),
              incentive_amount: incentiveAmount,
              gross_salary: figures.grossSalary,
              total_deductions: figures.totalDeductions,
              net_salary: figures.netSalary,
              bank_name: profile.bank_name,
              account_name: profile.account_name,
              account_number: profile.account_number,
              payment_method: profile.payment_method,
              accountant_note: 'Approved monthly payroll and released to staff.',
              payslip_number: payslipNumber,
            }, school)),
          );
        }
      });
    };

    buildRun(2, 2026, 'APPROVED');
    buildRun(3, 2026, 'DRAFT');
  }
}

seedPayrollData();

function makeId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function resolveSchoolId(req: any, fallback = 'school_1') {
  return req.body?.school_id || req.user?.school_id || req.header?.('x-school-id') || fallback;
}

function resolveActor(req: any) {
  const activeRole = req.user?.activeRole || req.user?.roles?.[0] || 'Guest';
  const userId = req.user?.id || null;
  const userRow = userId ? db.prepare('SELECT name FROM users WHERE id = ?').get(userId) as { name?: string } | undefined : undefined;
  return {
    id: userId,
    name: userRow?.name || activeRole,
    role: activeRole,
  };
}

function getMessagingSettings(schoolId: string) {
  const existing = db.prepare('SELECT allow_student_peer_messaging FROM messaging_settings WHERE school_id = ?').get(schoolId) as { allow_student_peer_messaging?: number } | undefined;
  if (!existing) {
    db.prepare('INSERT OR IGNORE INTO messaging_settings (school_id, allow_student_peer_messaging) VALUES (?, 1)').run(schoolId);
    return { allowStudentPeerMessaging: true };
  }
  return { allowStudentPeerMessaging: Boolean(existing.allow_student_peer_messaging) };
}

function normalizeHexColor(input: string | null | undefined, fallback = '#10b981') {
  const value = String(input || '').trim();
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value) ? value : fallback;
}

function normalizeRoleKey(role: string | null | undefined) {
  return String(role || '').replace(/[^a-z0-9]/gi, '').toUpperCase();
}

const BASE_APTITUDE_CATEGORIES = ['Admission', 'Scholarship'];
const EXTENDED_APTITUDE_CATEGORIES = ['Recruitment', 'Evaluation', 'Placement', 'Staff Screening'];

function getAllowedAptitudeCategories(role: string | null | undefined) {
  const key = normalizeRoleKey(role);
  const canManageExtended = ['HOS', 'ICTMANAGER', 'OWNER'].includes(key);
  return canManageExtended ? [...BASE_APTITUDE_CATEGORIES, ...EXTENDED_APTITUDE_CATEGORIES] : [...BASE_APTITUDE_CATEGORIES];
}

function sanitizeAptitudeQuestions(input: any) {
  return (Array.isArray(input) ? input : []).flatMap((question, index) => {
    const prompt = typeof question?.prompt === 'string' ? question.prompt.trim() : '';
    const options = (Array.isArray(question?.options) ? question.options : [])
      .map((option: any) => String(option || '').trim())
      .filter(Boolean)
      .slice(0, 6);
    const providedAnswer = typeof question?.answer === 'string' ? question.answer.trim() : '';
    const answer = options.includes(providedAnswer) ? providedAnswer : (options[0] || '');
    if (!prompt || options.length < 2 || !answer) return [];
    return [{
      id: typeof question?.id === 'string' && question.id.trim() ? question.id.trim() : `apt_q_${index + 1}`,
      prompt,
      options,
      answer,
      explanation: typeof question?.explanation === 'string' ? question.explanation.trim() : '',
      points: Math.max(1, Number(question?.points || 1)),
    }];
  });
}

function mapAptitudeTestRecord(record: any) {
  return {
    id: record.id,
    title: record.title,
    category: record.category,
    description: record.description || null,
    duration_minutes: Number(record.duration_minutes || 30),
    candidate_count: Number(record.candidate_count || 0),
    status: record.status || 'Draft',
    scheduled_for: record.scheduled_for || null,
    average_score: Number(record.average_score || 0),
    success_rate: Number(record.success_rate || 0),
    questions: sanitizeAptitudeQuestions(safeParseJson(record.questions_json, [])),
    created_at: record.created_at,
  };
}

function resolveTenantWebsiteUrl(school: { subdomain?: string | null; website_config?: string | null } | undefined) {
  const website = safeParseJson<any>(school?.website_config, {});
  const candidate = website?.websiteUrl || website?.publicUrl || website?.homeUrl || website?.domain || website?.settings?.websiteUrl || website?.contact?.website;
  if (typeof candidate === 'string' && candidate.trim()) {
    const normalized = /^https?:\/\//i.test(candidate.trim()) ? candidate.trim() : `https://${candidate.trim()}`;
    try {
      const parsed = new URL(normalized);
      const host = parsed.hostname.trim().toLowerCase();
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
      if (host === 'localhost' || host === '127.0.0.1' || host.includes('.')) return normalized;
      return null;
    } catch {
      return null;
    }
  }
  if (school?.subdomain) {
    const host = String(school.subdomain).trim().toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host.includes('.')) {
      return `https://${host}`;
    }
  }
  return null;
}

function hashPassword(password: string) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function splitDisplayName(name: string | null | undefined) {
  const segments = String(name || '').trim().split(/\s+/).filter(Boolean);
  return {
    firstName: segments[0] || '',
    lastName: segments.slice(1).join(' ') || '',
  };
}

function slugifySchoolName(value: string) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32) || `school-${Date.now().toString().slice(-6)}`;
}

function buildNdoveraEmail(subdomain: string) {
  return `${slugifySchoolName(subdomain)}.owner@ndovera.app`;
}

function ensureUserProfile(userId: string) {
  const user = db.prepare('SELECT id, school_id, email, alternate_email, phone, name, role FROM users WHERE id = ?').get(userId) as any;
  if (!user) return null;
  db.prepare(`
    INSERT OR IGNORE INTO user_profiles (
      user_id, school_id, ndovera_email, alternate_email, phone, occupation, preferences_json, skills_json, social_links_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    user.id,
    user.school_id || null,
    user.email,
    user.alternate_email || null,
    user.phone || null,
    user.role || '',
    JSON.stringify({ googleSigninEnabled: Boolean(user.alternate_email), preferredContact: user.alternate_email ? 'alternate-email' : 'ndovera-email' }),
    JSON.stringify([]),
    JSON.stringify({}),
  );
  return db.prepare('SELECT * FROM user_profiles WHERE user_id = ?').get(userId) as any;
}

function buildProfileTemplate(role: string, userRow?: any) {
  return {
    core: [
      'Full name',
      'Ndovera sign-in email',
      'Alternate email for Google sign-in and mail delivery',
      'Phone number',
      'Gender',
      'Date of birth',
      'Home address',
      'City / State / Country',
      'Short biography',
      'Emergency contact name',
      'Emergency contact phone',
    ],
    teacher: [
      'Employee ID',
      'Department',
      'Subjects / specialisation',
      'Professional skills',
      'Years of experience',
    ],
    student: [
      'Admission number',
      'Class / arm',
      'Parent / guardian name',
      'Parent / guardian phone',
      'Learning support notes',
    ],
    parent: [
      'Occupation',
      'Preferred contact channel',
      'Residential address',
      'Emergency alternate contact',
    ],
    recommended: userRow?.role === 'Student' ? 'student' : userRow?.role === 'Parent' ? 'parent' : 'teacher',
    activeRole: role,
  };
}

function resolveMessagingContact(schoolId: string, peerId: string) {
  if (peerId === 'ndovera_helpdesk') {
    return {
      avatarUrl: null,
      id: 'ndovera_helpdesk',
      kind: 'helpdesk' as const,
      name: 'Ndovera Helpdesk',
      role: 'Helpdesk',
      school_id: schoolId,
    };
  }
  const user = db.prepare('SELECT id, school_id, name, role FROM users WHERE school_id = ? AND id = ?').get(schoolId, peerId) as { id: string; school_id: string; name: string; role: string } | undefined;
  if (!user) return null;
  return {
    avatarUrl: null,
    ...user,
    kind: 'user' as const,
  };
}

function canUserMessageContact(req: any, schoolId: string, peer: ReturnType<typeof resolveMessagingContact>) {
  if (!req.user?.id || !peer) return false;
  if (peer.id === 'ndovera_helpdesk') return true;
  const activeRole = req.user.activeRole || (req as any).user.roles?.[0];
  const settings = getMessagingSettings(schoolId);
  if (activeRole === 'Student' && peer.role === 'Student' && !settings.allowStudentPeerMessaging) {
    return false;
  }
  return peer.school_id === schoolId;
}

function resolveStudentId(req: any) {
  const userId = req.user?.id;
  const schoolId = resolveSchoolId(req);
  if (userId) {
    const student = db.prepare('SELECT id FROM students WHERE user_id = ?').get(userId) as { id?: string } | undefined;
    if (student?.id) return student.id;
  }
  const activeRole = req.user?.activeRole || req.user?.roles?.[0];
  if (activeRole === 'Student' || activeRole === 'Parent') {
    const fallbackStudent = db.prepare('SELECT id FROM students WHERE school_id = ? ORDER BY id LIMIT 1').get(schoolId) as { id?: string } | undefined;
    return fallbackStudent?.id || null;
  }
  return userId || null;
}

function normalizeSubjectName(value: string) {
  return (value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function inferSubjectSection(className: string | null | undefined) {
  const value = (className || '').trim().toLowerCase();
  if (!value) return 'junior-secondary';
  if (value.includes('nursery') || value.includes('pre-school') || value.includes('preschool')) return 'pre-school';
  if (value.includes('primary') || value.includes('grade')) return 'primary';
  if (value.includes('ss') || value.includes('senior')) return 'senior-secondary';
  return 'junior-secondary';
}

function inferClassSection(level: string | null | undefined, name?: string | null) {
  const value = `${level || ''} ${name || ''}`.trim().toLowerCase();
  if (!value) return 'junior-secondary';
  if (value.includes('nursery') || value.includes('preschool') || value.includes('pre-school') || /^\d/.test(value)) return 'pre-school';
  if (value.includes('grade') || value.includes('primary')) return 'primary';
  if (value.includes('shs') || value.includes('ss') || value.includes('senior')) return 'senior-secondary';
  return 'junior-secondary';
}

function seedClassroomExperience() {
  const feedCount = db.prepare('SELECT COUNT(*) as count FROM classroom_feed_posts').get() as { count: number };
  if (feedCount.count === 0) {
    db.prepare('INSERT INTO classroom_feed_posts (id, school_id, class_id, author_id, author_name, author_role, body, pinned) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run('feed_1', 'school_1', 'class_1', 't2', 'Mrs. Jane Smith', 'Teacher', 'Good morning class. I have posted the comprehension passage and follow-up questions. Read the instructions carefully before answering.', 1);
    db.prepare('INSERT INTO classroom_feed_posts (id, school_id, class_id, author_id, author_name, author_role, body, pinned) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run('feed_2', 'school_1', 'class_1', 't1', 'Mr. John Doe', 'Assistant Teacher', 'Mathematics revision live class has been moved to Thursday. Please raise questions here before the session so we can prioritize them.', 0);

    db.prepare('INSERT INTO classroom_feed_comments (id, post_id, parent_comment_id, author_id, author_name, author_role, text, likes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run('feed_c1', 'feed_1', null, 's1', 'Amaka Adebayo', 'Student', 'Thank you ma. Can we submit typed answers?', 4);
    db.prepare('INSERT INTO classroom_feed_comments (id, post_id, parent_comment_id, author_id, author_name, author_role, text, likes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run('feed_r1', 'feed_1', 'feed_c1', 't2', 'Mrs. Jane Smith', 'Teacher', 'Yes. Typed or uploaded PDF is allowed.', 0);
    db.prepare('INSERT INTO classroom_feed_comments (id, post_id, parent_comment_id, author_id, author_name, author_role, text, likes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run('feed_c2', 'feed_2', null, 's2', 'Bisi Adebayo', 'Student', 'Please explain simultaneous equations again.', 6);

    db.prepare('INSERT INTO classroom_feed_reactions (id, post_id, user_id, emoji) VALUES (?, ?, ?, ?)').run('feed_rx1', 'feed_1', 's1', '👏');
    db.prepare('INSERT INTO classroom_feed_reactions (id, post_id, user_id, emoji) VALUES (?, ?, ?, ?)').run('feed_rx2', 'feed_1', 's2', '👍');
    db.prepare('INSERT INTO classroom_feed_reactions (id, post_id, user_id, emoji) VALUES (?, ?, ?, ?)').run('feed_rx3', 'feed_2', 's3', '📚');
  }

  const assignmentCount = db.prepare('SELECT COUNT(*) as count FROM classroom_assignments').get() as { count: number };
  if (assignmentCount.count === 0) {
    const sectionsOne = JSON.stringify([
      {
        type: 'Comprehension',
        title: 'Passage Study',
        instructions: 'Read the passage carefully and answer the questions that follow. Students see the same passage but question order differs per learner.',
        prompt: 'Adebisi walked across the compound before dawn, balancing a basin of books and dreams. She believed every small discipline would one day become a larger freedom.',
      },
      {
        type: 'Multiple Choice',
        title: 'Grammar Check',
        instructions: 'Correct options are mixed so the right answer does not repeat the same letter pattern.',
        questions: [
          { no: 1, stem: 'Choose the closest meaning of discipline in the passage.', options: ['strict punishment', 'consistent self-control', 'public ceremony', 'physical exercise'], answer: 'consistent self-control' },
          { no: 2, stem: 'Select the sentence with the correct punctuation.', options: ['The bell rang, and the class stood up.', 'The bell rang and, the class stood up.', 'The bell, rang and the class stood up.', 'The bell rang and the class, stood up.'], answer: 'The bell rang, and the class stood up.' },
        ],
      },
      {
        type: 'Essay',
        title: 'Extended Writing',
        prompt: 'Write a short essay on how discipline can help a student succeed in school.',
      }
    ]);

    const sectionsTwo = JSON.stringify([
      {
        type: 'Multiple Choice',
        title: 'Concept Check',
        instructions: 'Objective questions auto-save whenever a teacher updates the correct option.',
        questions: [
          { no: 1, stem: 'Which organelle controls the activities of the cell?', options: ['ribosome', 'nucleus', 'cell membrane', 'vacuole'], answer: 'nucleus' },
          { no: 2, stem: 'Which process releases energy from food?', options: ['respiration', 'osmosis', 'diffusion', 'transpiration'], answer: 'respiration' },
        ],
      },
      {
        type: 'Long Answer',
        title: 'Practical Planning',
        prompt: 'Outline the steps you would follow to observe onion epidermal cells under a microscope.',
      }
    ]);

    db.prepare('INSERT INTO classroom_assignments (id, school_id, class_id, class_name, teacher_id, title, subject, due, status, allow_comments, allow_teacher_chat, score, teacher_feedback, types_json, shuffled_notice, sections_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run('assign_1', 'school_1', 'class_1', 'JSS 1 Gold', 't2', 'Comprehension and Grammar Blend', 'English Language', 'Today, 06:00 PM', 'Returned for correction', 1, 1, '16/20', 'Strong opening. Improve evidence in question 4 and polish your concluding paragraph.', JSON.stringify(['Comprehension', 'Multiple Choice', 'Short Answer', 'Essay']), 'Question order is uniquely shuffled per learner to reduce copying while preserving equal difficulty.', sectionsOne);
    db.prepare('INSERT INTO classroom_assignments (id, school_id, class_id, class_name, teacher_id, title, subject, due, status, allow_comments, allow_teacher_chat, score, teacher_feedback, types_json, shuffled_notice, sections_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run('assign_2', 'school_1', 'class_2', 'SS 1 Science', 't3', 'Biology Practical Readiness Check', 'Biology', 'Friday, 10:00 AM', 'Draft', 1, 1, 'Pending', 'You can still edit your response before final submission.', JSON.stringify(['Multiple Choice', 'Matching', 'Short Answer', 'Long Answer']), 'Every learner receives a different question order while answer keys remain mapped automatically.', sectionsTwo);

    db.prepare('INSERT INTO classroom_assignment_comments (id, assignment_id, author_id, author_name, author_role, text, likes) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run('assign_c1', 'assign_1', 't2', 'Class Stream', 'Teacher', 'Remember to read the passage twice before answering.', 5);
    db.prepare('INSERT INTO classroom_assignment_comments (id, assignment_id, author_id, author_name, author_role, text, likes) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run('assign_c2', 'assign_1', 's1', 'Amaka Adebayo', 'Student', 'The matching section was easier after I wrote rough notes first.', 2);
    db.prepare('INSERT INTO classroom_assignment_comments (id, assignment_id, author_id, author_name, author_role, text, likes) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run('assign_c3', 'assign_2', 't3', 'Mr. Samuel Okoro', 'Teacher', 'Upload diagram images only if they are clear and labelled.', 7);

    db.prepare('INSERT INTO classroom_assignment_private_messages (id, assignment_id, user_id, sender_role, text) VALUES (?, ?, ?, ?, ?)')
      .run('assign_p1', 'assign_1', 's1', 'Student', 'Please explain if my conclusion needs more examples.');
    db.prepare('INSERT INTO classroom_assignment_private_messages (id, assignment_id, user_id, sender_role, text) VALUES (?, ?, ?, ?, ?)')
      .run('assign_p2', 'assign_1', 't2', 'Teacher', 'Yes. Add one practical school example and tighten the final sentence.');
    db.prepare('INSERT INTO classroom_assignment_private_messages (id, assignment_id, user_id, sender_role, text) VALUES (?, ?, ?, ?, ?)')
      .run('assign_p3', 'assign_2', 't3', 'Teacher', 'Use your own wording in the practical steps.');
  }

  const noteCount = db.prepare('SELECT COUNT(*) as count FROM classroom_notes').get() as { count: number };
  if (noteCount.count === 0) {
    db.prepare('INSERT INTO classroom_notes (id, school_id, title, subject, topic, week, format, visibility, duration, summary, access, analytics_json, versions_json, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run('note_chem_6', 'school_1', 'Chemical Bonding and Valency', 'Chemistry', 'Bonding Basics', 6, 'PDF', 'Student + Parent', '12 min read', 'AI summary covers ionic and covalent bonding with highlighted teacher notes and worked examples.', 'Encrypted, DRM offline ready', JSON.stringify({ views: 138, downloads: 92, completion: '78%' }), JSON.stringify(['v3 current', 'v2 archived', 'v1 archived']), 't1');
    db.prepare('INSERT INTO classroom_notes (id, school_id, title, subject, topic, week, format, visibility, duration, summary, access, analytics_json, versions_json, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run('note_lit_6', 'school_1', 'Narrative Techniques in African Fiction', 'Literature', 'Narrative Voice', 6, 'Slides', 'Student-only', '9 min read', 'Breaks down tone, plot, and narrator perspective. Includes AI recommendations for follow-up notes.', 'Encrypted, view-only export blocked', JSON.stringify({ views: 101, downloads: 53, completion: '61%' }), JSON.stringify(['v2 current', 'v1 archived']), 't2');
  }

  const liveCount = db.prepare('SELECT COUNT(*) as count FROM classroom_live_sessions').get() as { count: number };
  if (liveCount.count === 0) {
    db.prepare('INSERT INTO classroom_live_sessions (id, school_id, title, mode, schedule, duration, attendees, limit_count, hosts_json, tools_json, note, status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run('live_1', 'school_1', 'Biology Revision Live Class', 'Student Lesson', 'Tomorrow, 09:00 AM', '60 mins', 186, 300, JSON.stringify(['Mrs. Jane Smith', 'Mr. Samuel Okoro']), JSON.stringify(['Raise hand', 'Screen share', 'Digital backgrounds', 'Moderated live chat', 'Waiting room', 'Recording for 1 week']), 'If both host and assistant leave, the class stays alive for only 30 minutes before auto-ending.', 'active', 't3');
    db.prepare('INSERT INTO classroom_live_sessions (id, school_id, title, mode, schedule, duration, attendees, limit_count, hosts_json, tools_json, note, status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run('live_2', 'school_1', 'PTF Quarterly Forum', 'Parents-Teachers Forum', 'Saturday, 10:00 AM', '90 mins', 243, 300, JSON.stringify(['Principal', 'PTF Secretary']), JSON.stringify(['Raise hand', 'Screen share', 'Attendance log', 'Parent microphone queue', 'Digital backgrounds', 'Meeting notes']), 'This same live-class system is available for staff meetings and leadership briefings.', 'active', 'user_admin');
  }

  const lessonPlanCount = db.prepare('SELECT COUNT(*) as count FROM lesson_plans').get() as { count: number };
  if (lessonPlanCount.count === 0) {
    db.prepare('INSERT INTO lesson_plans (id, school_id, topic, subject, week, status, visibility, live_class_mode, objectives, materials, activities, assessment, notes, live_class, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run('plan_1', 'school_1', 'Introduction to Quadratic Equations', 'Mathematics', 6, 'Published', 'Immediate release', 'Use as pre-read material', 'Learners define a quadratic equation and identify its coefficients.', 'Textbook chapter 6, whiteboard examples, worksheet 4', 'Starter recap, worked examples, guided practice, peer correction', 'Short exit quiz and boardwork checks', 'Follow-up revision before Friday lesson.', 1, 't1');
    db.prepare('INSERT INTO lesson_plans (id, school_id, topic, subject, week, status, visibility, live_class_mode, objectives, materials, activities, assessment, notes, live_class, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run('plan_2', 'school_1', 'Narrative Voice and Tone', 'English Language', 6, 'Draft', 'Draft only', 'Attach later', 'Students identify narrator perspective and tone shifts.', 'Novel extract, annotation slides, discussion prompts', 'Read aloud, annotation pairs, reflective writing', 'Teacher observation and short paragraph response', 'Pending live discussion scheduling.', 0, 't2');
  }

  const staffTrainingMaterialCount = db.prepare('SELECT COUNT(*) as count FROM staff_training_materials').get() as { count: number };
  if (staffTrainingMaterialCount.count === 0) {
    db.prepare('INSERT INTO staff_training_materials (id, school_id, title, description, material_type, resource_url, audience, due_date, required_completion, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run('staff_material_1', 'school_1', 'Safeguarding Essentials', 'Mandatory refresher for teaching and non-teaching staff on school safeguarding workflows.', 'Guide', 'https://example.com/safeguarding-essentials', 'All Staff', '2026-03-25', 1, 'user_admin');
    db.prepare('INSERT INTO staff_training_materials (id, school_id, title, description, material_type, resource_url, audience, due_date, required_completion, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run('staff_material_2', 'school_1', 'Digital Classroom Readiness', 'Device etiquette, LMS workflows, and live-class moderation tips for all instructors.', 'Video', 'https://example.com/digital-classroom-readiness', 'Teachers', '2026-03-28', 0, 'user_admin');
  }

  const staffTrainingSessionCount = db.prepare('SELECT COUNT(*) as count FROM staff_training_sessions').get() as { count: number };
  if (staffTrainingSessionCount.count === 0) {
    db.prepare('INSERT INTO staff_training_sessions (id, school_id, title, summary, schedule, duration, live_session_id, material_ids_json, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run('staff_session_1', 'school_1', 'Safeguarding Retraining Room', 'Live walkthrough for compliance reminders, reporting routes, and intervention escalation.', 'Friday, 2:00 PM', '45 mins', 'live_1', JSON.stringify(['staff_material_1']), 'user_admin');
  }

  const sharedFileCount = db.prepare('SELECT COUNT(*) as count FROM shared_files').get() as { count: number };
  if (sharedFileCount.count === 0) {
    db.prepare('INSERT INTO shared_files (id, school_id, title, description, resource_url, scope, source_type, file_type, created_by, tags, class_group, subject) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run('share_1', 'school_1', 'School Improvement Template', 'Reusable school-wide planning template for admin, teachers, and department leads.', 'https://example.com/school-improvement-template', 'school', 'tenant', 'Template', 'user_admin');
    db.prepare('INSERT INTO shared_files (id, school_id, title, description, resource_url, scope, source_type, file_type, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run('share_2', 'school_1', 'Cross-Tenant Assessment Moderation Guide', 'Tenant-wide moderation checklist shared across participating schools.', 'https://example.com/tenant-assessment-guide', 'tenant', 'tenant', 'Guide', 'user_admin');
    db.prepare('INSERT INTO shared_files (id, school_id, title, description, resource_url, scope, source_type, file_type, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run('share_3', null, 'Ndovera Origin Onboarding Pack', 'Official Ndovera-origin handbook for school launch, quality controls, and support channels.', 'https://example.com/ndovera-onboarding-pack', 'ndovera', 'ndovera', 'Handbook', 'system');
  }

  const calendarEventCount = db.prepare('SELECT COUNT(*) as count FROM school_calendar_events').get() as { count: number };
  if (calendarEventCount.count === 0) {
    db.prepare('INSERT INTO school_calendar_events (id, school_id, event_date, title, event_type) VALUES (?, ?, ?, ?, ?)')
      .run('calendar_1', 'school_1', '2026-03-20', 'Founders Day Holiday', 'Public Holiday');
    db.prepare('INSERT INTO school_calendar_events (id, school_id, event_date, title, event_type) VALUES (?, ?, ?, ?, ?)')
      .run('calendar_2', 'school_1', '2026-03-27', 'Inter-house Sports', 'School Event');
  }

  const subjectCount = db.prepare('SELECT COUNT(*) as count FROM classroom_subjects').get() as { count: number };
  if (subjectCount.count === 0) {
    const subjects = [
      ['subject_eng_1', 'English Language', 'ENG', 'junior-secondary', 'class_1', 'JSS 1 Gold', 't2', 'Mrs. Jane Smith', '#3b82f6', 'Class reading, grammar, speaking, and writing stream.', 'Room 3A'],
      ['subject_math_1', 'Mathematics', 'MTH', 'junior-secondary', 'class_1', 'JSS 1 Gold', 't1', 'Mr. John Doe', '#8b5cf6', 'Daily problem solving, examples, and challenge sets.', 'Room 2B'],
      ['subject_bio_1', 'Biology', 'BIO', 'senior-secondary', 'class_2', 'SS 1 Science', 't3', 'Mr. Samuel Okoro', '#10b981', 'Practical preparation, diagrams, and concept recall.', 'Lab 1'],
    ];

    subjects.forEach(([id, name, code, section, classId, className, teacherId, teacherName, accent, summary, room]) => {
      db.prepare('INSERT INTO classroom_subjects (id, school_id, name, code, section, class_id, class_name, teacher_id, teacher_name, accent, summary, room, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(id, 'school_1', name, code, section, classId, className, teacherId, teacherName, accent, summary, room, teacherId);
    });

    [
      ['enroll_1', 'subject_eng_1', 'class_1', 'student_s1'],
      ['enroll_2', 'subject_math_1', 'class_1', 'student_s1'],
      ['enroll_3', 'subject_eng_1', 'class_1', 'student_s2'],
      ['enroll_4', 'subject_math_1', 'class_1', 'student_s2'],
      ['enroll_5', 'subject_bio_1', 'class_2', 'student_s3'],
    ].forEach(([id, subjectId, classId, studentId]) => {
      db.prepare('INSERT INTO classroom_subject_enrollments (id, subject_id, class_id, student_id) VALUES (?, ?, ?, ?)')
        .run(id, subjectId, classId, studentId);
    });
  }

  const practiceCount = db.prepare('SELECT COUNT(*) as count FROM classroom_practice_sets').get() as { count: number };
  if (practiceCount.count === 0) {
    const sharedQuestions = JSON.stringify([
      { id: 'q1', stem: 'Which sentence uses a correct conjunction?', options: ['I came but I saw.', 'I came and I saw.', 'I came or I saw both.', 'I came so because I saw.'], answer: 'I came and I saw.' },
      { id: 'q2', stem: 'Choose the best topic sentence for a paragraph on punctuality.', options: ['Punctuality makes school routines easier to manage.', 'We should sleep a lot.', 'Books are helpful.', 'Rice is delicious.'], answer: 'Punctuality makes school routines easier to manage.' },
    ]);

    const schoolQuestions = JSON.stringify([
      { id: 'sq1', stem: 'Solve $3x + 6 = 21$.', options: ['3', '4', '5', '6'], answer: '5' },
      { id: 'sq2', stem: 'What is the next number in the sequence 5, 9, 13, 17, ...?', options: ['19', '20', '21', '22'], answer: '21' },
    ]);

    db.prepare('INSERT INTO classroom_practice_sets (id, school_id, source, scope, subject, title, level, mode, reward, question_count, note, questions_json, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run('practice_global_eng', null, 'Global pool', 'practice', 'English Language', 'Reading Fluency Sprint', 'JSS', 'Adaptive Practice', '12 Auras', 2, 'Pulled from the shared question pool and targeted at reading fluency.', sharedQuestions, 'system');
    db.prepare('INSERT INTO classroom_practice_sets (id, school_id, source, scope, subject, title, level, mode, reward, question_count, note, questions_json, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run('practice_global_cbt', null, 'Global pool', 'cbt', 'Basic Science', 'Foundational CBT Warmup', 'JSS', 'Timed CBT', '8 Auras', 2, 'Global CBT drills for cross-school benchmarking.', sharedQuestions, 'system');
    db.prepare('INSERT INTO classroom_practice_sets (id, school_id, source, scope, subject, title, level, mode, reward, question_count, note, questions_json, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run('practice_school_math', 'school_1', 'School question bank', 'exam', 'Mathematics', 'Ndovera Mid-Term Drill', 'JSS 1', 'Teacher Curated', 'School-set', 2, 'School-owned question bank for internal tests and exam prep.', schoolQuestions, 't1');
  }

  const resultCount = db.prepare('SELECT COUNT(*) as count FROM classroom_result_records').get() as { count: number };
  if (resultCount.count === 0) {
    const resultPayload = JSON.stringify({
      sessions: [
        {
          session: '2025/2026',
          feeStatus: 'Contact School',
          outstanding: 'Contact bursary',
          terms: [
            {
              name: 'First Term',
              allowPosition: true,
              summary: {
                average: '84%',
                grade: 'A',
                position: '3rd / 42',
                attendance: '98%',
                teacherRemark: 'Excellent participation and steady class focus.',
                principalRemark: 'Keep the pace and mentor classmates kindly.',
                promotion: 'Promoted to next term track',
              },
              subjects: [
                { subject: 'English Language', ca: 37, exam: 46, total: 83, grade: 'A', remark: 'Excellent' },
                { subject: 'Mathematics', ca: 39, exam: 47, total: 86, grade: 'A', remark: 'Excellent' },
                { subject: 'Basic Science', ca: 35, exam: 42, total: 77, grade: 'B+', remark: 'Very Good' },
              ],
            },
            {
              name: 'Second Term',
              allowPosition: false,
              summary: {
                average: '81%',
                grade: 'A-',
                position: 'School hidden',
                attendance: '95%',
                teacherRemark: 'Good improvement in written expression.',
                principalRemark: 'Maintain discipline and reading culture.',
                promotion: 'On track',
              },
              subjects: [
                { subject: 'English Language', ca: 36, exam: 45, total: 81, grade: 'A-', remark: 'Very Good' },
                { subject: 'Mathematics', ca: 34, exam: 44, total: 78, grade: 'B+', remark: 'Very Good' },
                { subject: 'Basic Science', ca: 37, exam: 46, total: 83, grade: 'A', remark: 'Excellent' },
              ],
            },
          ],
        },
      ],
    });

    db.prepare('INSERT INTO classroom_result_records (id, school_id, student_id, session, data_json) VALUES (?, ?, ?, ?, ?)')
      .run('result_student_s1', 'school_1', 'student_s1', '2025/2026', resultPayload);
  }
}

seedClassroomExperience();

function seedLibraryExperience() {
  const existing = db.prepare('SELECT COUNT(*) as count FROM library_books').get() as { count: number };

  const categories = [
    ['cat_textbook', 'school_1', 'Textbook', 'Core classroom textbooks', 0],
    ['cat_past_questions', null, 'Past Questions', 'Cross-school exam packs', 1],
    ['cat_novel', 'school_1', 'Novel', 'Physical and digital story books', 0],
    ['cat_research', null, 'Research', 'Teacher and contributor research materials', 1],
    ['cat_revision', null, 'Revision Guide', 'Premium revision and global support packs', 1],
  ] as const;

  categories.forEach(([id, schoolId, name, description, isGlobal]) => {
    db.prepare('INSERT OR IGNORE INTO book_categories (id, school_id, name, description, is_global) VALUES (?, ?, ?, ?, ?)').run(id, schoolId, name, description, isGlobal);
  });

  const showcaseBook = {
    id: 'LIB-007', schoolId: null, title: 'The Yam and the Goat', author: 'Ndovera', category: 'Storybook', mode: 'Shared',
    library: 'Global Library', access: 'Premium', approval: 'Approved', ownerUserId: 'user_admin', ownerName: 'Ndovera Global Library', qualityLabel: 'Protected global title',
    format: 'Protected EPUB', summary: 'A globally available Ndovera storybook priced at 5 Auras and retained as a protected showcase title.', visibility: 'Global access • Super admin deletion only', shelf: null,
    nairaPrice: 0, auraPrice: 5, read: 97, plagiarism: 0, structure: 95, relevance: 96, reportStatus: 'completed', reviewStatus: 'approved', reviewNote: 'Protected showcase title for global discovery.'
  };

  const books = [
    {
      id: 'LIB-001', schoolId: 'school_1', title: 'Senior Secondary Mathematics Companion', author: 'Ndovera Press', category: 'Textbook', mode: 'Digital',
      library: 'School Library', access: 'Free', approval: 'Approved', ownerUserId: 'user_admin', ownerName: 'School Library Unit', qualityLabel: 'AI 96%',
      format: 'Encrypted PDF', summary: 'Core senior-secondary maths guide with exam drills and worked examples.', visibility: 'School only', shelf: null,
      nairaPrice: 0, auraPrice: 0, read: 96, plagiarism: 6, structure: 94, relevance: 97, reportStatus: 'completed', reviewStatus: 'approved', reviewNote: 'Aligned with school curriculum.'
    },
    {
      id: 'LIB-002', schoolId: null, title: 'WAEC Biology Past Questions 2019-2025', author: 'Exam Unit', category: 'Past Questions', mode: 'Shared',
      library: 'Global Library', access: 'Premium', approval: 'Approved', ownerUserId: 'user_admin', ownerName: 'Ndovera Global Library', qualityLabel: 'AI 93%',
      format: 'Encrypted PDF', summary: 'Cross-school revision pack with analytics-ready answer trends.', visibility: 'Multi-school shared', shelf: null,
      nairaPrice: 2500, auraPrice: 125, read: 93, plagiarism: 4, structure: 92, relevance: 95, reportStatus: 'completed', reviewStatus: 'approved', reviewNote: 'Approved for tenant access.'
    },
    {
      id: 'LIB-003', schoolId: 'school_1', title: 'Things Fall Apart', author: 'Chinua Achebe', category: 'Novel', mode: 'Physical',
      library: 'School Library', access: 'Borrow', approval: 'Approved', ownerUserId: 'user_admin', ownerName: 'Main Campus Shelf', qualityLabel: 'Verified classic',
      format: 'Hard copy', summary: 'Physical borrowing item with librarian-controlled return workflow.', visibility: 'School circulation', shelf: 'B-04',
      nairaPrice: 0, auraPrice: 0, read: 90, plagiarism: 0, structure: 95, relevance: 91, reportStatus: 'completed', reviewStatus: 'approved', reviewNote: 'Circulation-ready physical title.'
    },
    {
      id: 'LIB-004', schoolId: null, title: 'Creative Writing for Teens', author: 'Mary Afolabi', category: 'Storybook', mode: 'User Upload',
      library: 'Contributor Library', access: 'Premium', approval: 'Approved', ownerUserId: 't2', ownerName: 'Contributor wallet: Mary Afolabi', qualityLabel: 'AI 89%',
      format: 'Protected EPUB', summary: 'User-submitted creative guide earning revenue per read, not per upload.', visibility: 'Approved for tenant schools', shelf: null,
      nairaPrice: 1800, auraPrice: 90, read: 89, plagiarism: 8, structure: 90, relevance: 87, reportStatus: 'completed', reviewStatus: 'approved', reviewNote: 'Published after manual review.'
    },
    {
      id: 'LIB-005', schoolId: 'school_1', title: 'African Climate & Agriculture Research Notes', author: 'Samuel Okoro', category: 'Research', mode: 'User Upload',
      library: 'Contributor Library', access: 'Free', approval: 'In Review', ownerUserId: 't3', ownerName: 'Teacher contributor: Samuel Okoro', qualityLabel: 'AI review pending',
      format: 'PDF + slides', summary: 'Teacher-submitted research notes awaiting manual admin approval.', visibility: 'Pending moderation', shelf: null,
      nairaPrice: 0, auraPrice: 0, read: 82, plagiarism: 11, structure: 86, relevance: 90, reportStatus: 'pending', reviewStatus: 'pending', reviewNote: 'Awaiting admin review.'
    },
    {
      id: 'LIB-006', schoolId: null, title: 'Global SAT Quantitative Study Guide', author: 'Ndovera Global Library', category: 'Revision Guide', mode: 'Shared',
      library: 'Global Library', access: 'Premium', approval: 'Approved', ownerUserId: 'user_admin', ownerName: 'Ndovera Global Library', qualityLabel: 'AI 94%',
      format: 'Encrypted PDF', summary: 'Premium multi-school study guide with watermark-protected reading.', visibility: 'Optional global content', shelf: null,
      nairaPrice: 3200, auraPrice: 160, read: 94, plagiarism: 3, structure: 95, relevance: 96, reportStatus: 'completed', reviewStatus: 'approved', reviewNote: 'Global premium content approved.'
    },
    showcaseBook,
  ];

  const insertLibraryBook = (book: any) => {
    const seedSuffix = String(book.id).toLowerCase().replace(/[^a-z0-9]+/g, '_');
    db.prepare(`
      INSERT INTO library_books (
        id, school_id, title, author_name, category, mode, library_scope, access_model, approval_status, owner_user_id, owner_name,
        quality_label, format_label, summary, visibility_scope, shelf_code, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      book.id,
      book.schoolId,
      book.title,
      book.author,
      book.category,
      book.mode,
      book.library,
      book.access,
      book.approval,
      book.ownerUserId,
      book.ownerName,
      book.qualityLabel,
      book.format,
      book.summary,
      book.visibility,
      book.shelf,
      book.ownerUserId,
    );

    db.prepare('INSERT INTO book_versions (id, book_id, version_label, storage_key, metadata_json) VALUES (?, ?, ?, ?, ?)').run(
      `book_ver_${seedSuffix}`,
      book.id,
      'v1.0',
      `library/${book.id.toLowerCase()}`,
      JSON.stringify({ protected: book.mode !== 'Physical', format: book.format }),
    );

    db.prepare('INSERT INTO book_pricing (id, book_id, naira_price, aura_price, owner_share_percent, platform_share_percent, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      `book_price_${seedSuffix}`,
      book.id,
      book.nairaPrice,
      book.auraPrice,
      80,
      20,
      'user_admin',
    );

    db.prepare(`
      INSERT INTO ai_analysis_reports (
        id, book_id, readability_score, plagiarism_score, structure_score, relevance_score, summary, tags_json,
        suggested_naira_price, suggested_aura_price, report_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      `ai_report_${seedSuffix}`,
      book.id,
      book.read,
      book.plagiarism,
      book.structure,
      book.relevance,
      book.summary,
      JSON.stringify([book.category, book.mode, book.library]),
      book.nairaPrice,
      book.auraPrice,
      book.reportStatus,
    );

    db.prepare('INSERT INTO admin_reviews (id, book_id, review_status, reviewer_user_id, note, reviewed_at) VALUES (?, ?, ?, ?, ?, ?)').run(
      `admin_review_${seedSuffix}`,
      book.id,
      book.reviewStatus,
      book.reviewStatus === 'pending' ? null : 'user_admin',
      book.reviewNote,
      book.reviewStatus === 'pending' ? null : new Date().toISOString(),
    );
  };

  if (existing.count === 0) {
    books.forEach((book) => insertLibraryBook(book));

    db.prepare(`
    INSERT INTO physical_borrows (id, school_id, book_id, borrower_user_id, borrower_role, due_date, status, offline_logged, sync_status, librarian_user_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run('BR-101', 'school_1', 'LIB-003', 's1', 'Student', '2026-03-18', 'On Time', 0, 'Synced', 'user_admin');
    db.prepare(`
    INSERT INTO physical_borrows (id, school_id, book_id, borrower_user_id, borrower_role, due_date, status, offline_logged, sync_status, librarian_user_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run('BR-102', 'school_1', 'LIB-003', 't1', 'Teacher', '2026-03-08', 'Overdue', 1, 'Logged offline', 'user_admin');
    db.prepare(`
    INSERT INTO physical_borrows (id, school_id, book_id, borrower_user_id, borrower_role, due_date, status, offline_logged, sync_status, librarian_user_id, return_marked_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run('BR-103', 'school_1', 'LIB-003', 's2', 'Student', '2026-03-21', 'Awaiting Return', 0, 'Synced', 'user_admin', new Date().toISOString());

    db.prepare('INSERT INTO return_confirmations (id, borrow_id, confirmed_by_user_id, note) VALUES (?, ?, ?, ?)').run('return_conf_1', 'BR-101', 'user_admin', 'Borrow remains active and verified.');

    db.prepare(`
    INSERT INTO digital_reads (id, school_id, book_id, reader_user_id, pages_read, minutes_spent, bookmark_text, watermark_token, access_mode, last_opened_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run('read_1', 'school_1', 'LIB-001', 's1', 34, 52, 'Chapter 4 - simultaneous equations', 'wm_s1_lib001', 'in-app', new Date().toISOString());
    db.prepare(`
    INSERT INTO digital_reads (id, school_id, book_id, reader_user_id, pages_read, minutes_spent, bookmark_text, watermark_token, access_mode, last_opened_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run('read_2', 'school_1', 'LIB-004', 't2', 18, 31, 'Narrative pacing section', 'wm_t2_lib004', 'in-app', new Date().toISOString());

    db.prepare('INSERT INTO aura_wallets (id, school_id, user_id, balance_aura, naira_equivalent) VALUES (?, ?, ?, ?, ?)').run('wallet_t2', 'school_1', 't2', 920, 18400);
    db.prepare('INSERT INTO aura_wallets (id, school_id, user_id, balance_aura, naira_equivalent) VALUES (?, ?, ?, ?, ?)').run('wallet_t3', 'school_1', 't3', 300, 6000);

    db.prepare(`
    INSERT INTO library_transactions (id, school_id, book_id, user_id, amount_naira, amount_aura, transaction_type, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run('lib_tx_1', 'school_1', 'LIB-004', 's1', 1800, 90, 'digital_read', 'completed');
    db.prepare(`
    INSERT INTO library_transactions (id, school_id, book_id, user_id, amount_naira, amount_aura, transaction_type, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run('lib_tx_2', 'school_1', 'LIB-002', 's2', 2500, 125, 'digital_read', 'completed');

    db.prepare(`
    INSERT INTO earnings_split (id, transaction_id, owner_user_id, owner_amount_naira, owner_amount_aura, platform_amount_naira, platform_amount_aura)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run('split_1', 'lib_tx_1', 't2', 1440, 72, 360, 18);
    db.prepare(`
    INSERT INTO earnings_split (id, transaction_id, owner_user_id, owner_amount_naira, owner_amount_aura, platform_amount_naira, platform_amount_aura)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run('split_2', 'lib_tx_2', 'user_admin', 2000, 100, 500, 25);

    db.prepare('INSERT INTO content_flags (id, book_id, flagged_by_user_id, reason, status) VALUES (?, ?, ?, ?, ?)').run('flag_1', 'LIB-005', 'user_admin', 'Similarity check needs manual confirmation before publication.', 'open');
  }

  const showcaseExists = db.prepare('SELECT COUNT(*) as count FROM library_books WHERE id = ?').get('LIB-007') as { count: number };
  if (!showcaseExists.count) {
    insertLibraryBook(showcaseBook);
  }
}

seedLibraryExperience();

function seedClinicExperience() {
  const schoolId = 'school_1';

  db.prepare('INSERT OR IGNORE INTO users (id, school_id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?, ?)')
    .run('clinic_1', schoolId, 'Nurse Adaeze Okeke', 'clinic@school.com', 'pass', 'Clinic Officer');
  db.prepare('INSERT OR IGNORE INTO users (id, school_id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?, ?)')
    .run('parent_1', schoolId, 'Grace Johnson', 'grace.parent@school.com', 'pass', 'Parent');

  db.prepare('UPDATE students SET parent_id = COALESCE(parent_id, ?) WHERE user_id IN (?, ?)').run('parent_1', 's1', 's2');

  [
    {
      id: 'clinic_profile_s1',
      userId: 's1',
      patientType: 'Student',
      bloodGroup: 'O+',
      genotype: 'AA',
      allergies: ['Dust', 'Pollen'],
      chronic: ['Seasonal allergy'],
      contactName: 'Grace Johnson',
      contactPhone: '+234-801-000-1001',
      notes: 'Prefers oral medication. Keep inhaler note on record.',
    },
    {
      id: 'clinic_profile_s2',
      userId: 's2',
      patientType: 'Student',
      bloodGroup: 'A+',
      genotype: 'AS',
      allergies: ['Peanuts'],
      chronic: ['Asthma watch'],
      contactName: 'Grace Johnson',
      contactPhone: '+234-801-000-1001',
      notes: 'Observe after sports and hydration drills.',
    },
    {
      id: 'clinic_profile_s3',
      userId: 's3',
      patientType: 'Student',
      bloodGroup: 'B+',
      genotype: 'AA',
      allergies: ['None reported'],
      chronic: [],
      contactName: 'Michael Brown',
      contactPhone: '+234-801-000-1002',
      notes: 'No chronic case on file.',
    },
    {
      id: 'clinic_profile_t1',
      userId: 't1',
      patientType: 'Teacher',
      bloodGroup: 'AB+',
      genotype: 'AA',
      allergies: ['Penicillin'],
      chronic: ['Migraine'],
      contactName: 'School Front Desk',
      contactPhone: '+234-801-000-1090',
      notes: 'Teacher wellness check every half-term.',
    },
    {
      id: 'clinic_profile_parent_1',
      userId: 'parent_1',
      patientType: 'Parent',
      bloodGroup: 'O+',
      genotype: 'AA',
      allergies: ['None reported'],
      chronic: [],
      contactName: 'Grace Johnson',
      contactPhone: '+234-801-000-1001',
      notes: 'Primary guardian for Alice Johnson and Bob Williams.',
    },
  ].forEach((profile) => {
    db.prepare(`
      INSERT OR IGNORE INTO clinic_profiles (
        id, school_id, user_id, patient_type, blood_group, genotype, allergies_json, chronic_conditions_json,
        emergency_contact_name, emergency_contact_phone, medical_notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      profile.id,
      schoolId,
      profile.userId,
      profile.patientType,
      profile.bloodGroup,
      profile.genotype,
      JSON.stringify(profile.allergies),
      JSON.stringify(profile.chronic),
      profile.contactName,
      profile.contactPhone,
      profile.notes,
    );
  });

  [
    {
      id: 'clinic_visit_1',
      patientUserId: 's1',
      recordedByUserId: 'clinic_1',
      complaint: 'Mild fever and headache',
      symptoms: 'Warm temperature, fatigue, slight cough',
      diagnosis: 'Likely viral fever',
      treatment: 'Administered 500mg paracetamol, oral fluids, and 45 minutes rest in clinic bay.',
      medications: [{ name: 'Paracetamol', dosage: '500mg', frequency: 'single dose', route: 'oral' }],
      vitals: { temperatureC: 37.9, pulseBpm: 92, bloodPressure: '100/65', oxygenSaturation: '98%' },
      outcome: 'Returned to class',
      caseStatus: 'Closed',
      triageLevel: 'Routine',
      followUpDate: '2026-03-16',
      referralNotes: 'Observe for another 24 hours and encourage hydration.',
      recordedAt: '2026-03-14T09:10:00.000Z',
    },
    {
      id: 'clinic_visit_2',
      patientUserId: 's2',
      recordedByUserId: 'clinic_1',
      complaint: 'Sports injury on right ankle',
      symptoms: 'Pain while walking, mild swelling after football drills',
      diagnosis: 'Minor ankle sprain',
      treatment: 'Applied cold compress, wrapped ankle with elastic bandage, administered topical pain relief, and restricted sports for 3 days.',
      medications: [{ name: 'Topical analgesic gel', dosage: 'thin layer', frequency: 'twice daily', route: 'topical' }],
      vitals: { temperatureC: 36.7, pulseBpm: 80, bloodPressure: '106/69', oxygenSaturation: '99%' },
      outcome: 'Sent home',
      caseStatus: 'Needs Follow-up',
      triageLevel: 'Moderate',
      followUpDate: '2026-03-17',
      referralNotes: 'Parent informed. Review range of motion before next sports activity.',
      recordedAt: '2026-03-13T12:40:00.000Z',
    },
    {
      id: 'clinic_visit_3',
      patientUserId: 't1',
      recordedByUserId: 'clinic_1',
      complaint: 'Migraine episode during class',
      symptoms: 'Light sensitivity and sharp headache',
      diagnosis: 'Recurring migraine',
      treatment: 'Moved to quiet recovery room, administered prescribed migraine medication, and monitored for 30 minutes.',
      medications: [{ name: 'Migraine relief tablet', dosage: '1 tablet', frequency: 'single dose', route: 'oral' }],
      vitals: { temperatureC: 36.5, pulseBpm: 76, bloodPressure: '118/75', oxygenSaturation: '99%' },
      outcome: 'Returned to duty',
      caseStatus: 'Closed',
      triageLevel: 'Routine',
      followUpDate: null,
      referralNotes: 'Teacher advised to attend wellness review if recurrence continues.',
      recordedAt: '2026-03-12T10:15:00.000Z',
    },
    {
      id: 'clinic_visit_4',
      patientUserId: 's3',
      recordedByUserId: 'clinic_1',
      complaint: 'Allergy flare after lunch',
      symptoms: 'Rash around neck, watery eyes, itching',
      diagnosis: 'Acute allergic reaction',
      treatment: 'Administered antihistamine syrup, observed breathing for 60 minutes, and documented suspected trigger for family follow-up.',
      medications: [{ name: 'Antihistamine syrup', dosage: '10ml', frequency: 'single dose', route: 'oral' }],
      vitals: { temperatureC: 36.8, pulseBpm: 96, bloodPressure: '102/66', oxygenSaturation: '97%' },
      outcome: 'Under observation',
      caseStatus: 'Open',
      triageLevel: 'High',
      followUpDate: '2026-03-15',
      referralNotes: 'Review cafeteria trigger and confirm family allergy history.',
      recordedAt: '2026-03-14T11:05:00.000Z',
    },
  ].forEach((visit) => {
    db.prepare(`
      INSERT OR IGNORE INTO clinic_visits (
        id, school_id, patient_user_id, recorded_by_user_id, complaint, symptoms, diagnosis, treatment_administered,
        medications_json, vitals_json, outcome, case_status, triage_level, follow_up_date, referral_notes, recorded_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      visit.id,
      schoolId,
      visit.patientUserId,
      visit.recordedByUserId,
      visit.complaint,
      visit.symptoms,
      visit.diagnosis,
      visit.treatment,
      JSON.stringify(visit.medications),
      JSON.stringify(visit.vitals),
      visit.outcome,
      visit.caseStatus,
      visit.triageLevel,
      visit.followUpDate,
      visit.referralNotes,
      visit.recordedAt,
    );
  });

  [
    { id: 'clinic_stock_1', itemName: 'Paracetamol', category: 'Analgesic', dosageForm: 'Tablet', stockQuantity: 250, unitLabel: 'tabs', reorderLevel: 80, expiryDate: '2027-01-30', status: 'In Stock' },
    { id: 'clinic_stock_2', itemName: 'Elastic Bandage', category: 'First Aid', dosageForm: 'Roll', stockQuantity: 15, unitLabel: 'rolls', reorderLevel: 10, expiryDate: '2028-05-15', status: 'Low Stock' },
    { id: 'clinic_stock_3', itemName: 'Antihistamine Syrup', category: 'Allergy', dosageForm: 'Bottle', stockQuantity: 12, unitLabel: 'bottles', reorderLevel: 6, expiryDate: '2026-11-02', status: 'In Stock' },
    { id: 'clinic_stock_4', itemName: 'Digital Thermometer', category: 'Equipment', dosageForm: 'Unit', stockQuantity: 4, unitLabel: 'units', reorderLevel: 2, expiryDate: '2029-09-01', status: 'In Stock' },
  ].forEach((item) => {
    db.prepare(`
      INSERT OR IGNORE INTO clinic_inventory (
        id, school_id, item_name, category, dosage_form, stock_quantity, unit_label, reorder_level, expiry_date, status, updated_by_user_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      item.id,
      schoolId,
      item.itemName,
      item.category,
      item.dosageForm,
      item.stockQuantity,
      item.unitLabel,
      item.reorderLevel,
      item.expiryDate,
      item.status,
      'clinic_1',
    );
  });

  [
    {
      id: 'clinic_appt_1',
      patientUserId: 's2',
      requestedByUserId: 'clinic_1',
      assignedToUserId: 'clinic_1',
      reason: 'Ankle sprain follow-up review',
      scheduledFor: '2026-03-17T09:00:00.000Z',
      status: 'Scheduled',
      notes: 'Assess swelling reduction and approve return to sports.',
    },
    {
      id: 'clinic_appt_2',
      patientUserId: 't1',
      requestedByUserId: 't1',
      assignedToUserId: 'clinic_1',
      reason: 'Teacher wellness review',
      scheduledFor: '2026-03-20T11:30:00.000Z',
      status: 'Scheduled',
      notes: 'Discuss migraine triggers and staff wellness plan.',
    },
  ].forEach((appointment) => {
    db.prepare(`
      INSERT OR IGNORE INTO clinic_appointments (
        id, school_id, patient_user_id, requested_by_user_id, assigned_to_user_id, reason, scheduled_for, status, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      appointment.id,
      schoolId,
      appointment.patientUserId,
      appointment.requestedByUserId,
      appointment.assignedToUserId,
      appointment.reason,
      appointment.scheduledFor,
      appointment.status,
      appointment.notes,
    );
  });
}

seedClinicExperience();

function seedTuckshopExperience() {
  const schoolId = 'school_1';

  db.prepare('INSERT OR IGNORE INTO users (id, school_id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?, ?)')
    .run('tuckshop_1', schoolId, 'Mariam Bello', 'tuckshop@school.com', 'pass', 'Tuckshop Manager');

  [
    { id: 'ts_prod_1', name: 'Bottled Water', category: 'Drinks', price: 200, stock: 150, status: 'In Stock' },
    { id: 'ts_prod_2', name: 'Fruit Juice', category: 'Drinks', price: 500, stock: 12, status: 'Low Stock' },
    { id: 'ts_prod_3', name: 'Snack Pack', category: 'Food', price: 350, stock: 85, status: 'In Stock' },
    { id: 'ts_prod_4', name: 'Exercise Book', category: 'Stationery', price: 700, stock: 44, status: 'In Stock' },
  ].forEach((product) => {
    db.prepare(`
      INSERT OR IGNORE INTO tuckshop_products (
        id, school_id, name, category, price_naira, stock_quantity, stock_status, created_by_user_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(product.id, schoolId, product.name, product.category, product.price, product.stock, product.status, 'tuckshop_1');
  });

  [
    { id: 'ts_balance_s1', userId: 's1', wallet: 8450, credit: 1200, limit: 2500 },
    { id: 'ts_balance_s2', userId: 's2', wallet: 4200, credit: 0, limit: 2000 },
    { id: 'ts_balance_parent_1', userId: 'parent_1', wallet: 12000, credit: 3200, limit: 2500 },
    { id: 'ts_balance_t3', userId: 't3', wallet: 5000, credit: 5500, limit: 0 },
  ].forEach((balance) => {
    db.prepare(`
      INSERT OR IGNORE INTO tuckshop_balances (
        id, school_id, user_id, wallet_balance_naira, credit_balance_naira, spending_limit_naira
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(balance.id, schoolId, balance.userId, balance.wallet, balance.credit, balance.limit);
  });

  [
    {
      id: 'ts_sale_1', buyerUserId: 's1', buyerRole: 'Student', studentUserId: 's1', productId: 'ts_prod_2', quantity: 1,
      unitPrice: 500, total: 500, paid: 500, due: 0, source: 'Parent Wallet', status: 'paid', note: 'Child purchase', createdBy: 'tuckshop_1',
    },
    {
      id: 'ts_sale_2', buyerUserId: 's1', buyerRole: 'Student', studentUserId: 's1', productId: 'ts_prod_3', quantity: 2,
      unitPrice: 350, total: 700, paid: 0, due: 700, source: 'Credit', status: 'credit', note: 'Awaiting parent settlement', createdBy: 'tuckshop_1',
    },
    {
      id: 'ts_sale_3', buyerUserId: 't3', buyerRole: 'Teacher', studentUserId: null, productId: 'ts_prod_1', quantity: 2,
      unitPrice: 200, total: 400, paid: 400, due: 0, source: 'Wallet', status: 'paid', note: 'Staff purchase', createdBy: 'tuckshop_1',
    },
    {
      id: 'ts_sale_4', buyerUserId: 't3', buyerRole: 'Teacher', studentUserId: null, productId: 'ts_prod_4', quantity: 1,
      unitPrice: 700, total: 700, paid: 0, due: 700, source: 'Credit', status: 'part-paid', note: 'Payroll deduction pending', createdBy: 'tuckshop_1',
    },
  ].forEach((sale) => {
    db.prepare(`
      INSERT OR IGNORE INTO tuckshop_sales (
        id, school_id, buyer_user_id, buyer_role, student_user_id, product_id, quantity, unit_price_naira,
        total_amount_naira, amount_paid_naira, balance_due_naira, payment_source, payment_status, note, created_by_user_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      sale.id,
      schoolId,
      sale.buyerUserId,
      sale.buyerRole,
      sale.studentUserId,
      sale.productId,
      sale.quantity,
      sale.unitPrice,
      sale.total,
      sale.paid,
      sale.due,
      sale.source,
      sale.status,
      sale.note,
      sale.createdBy,
    );
  });

  [
    { id: 'ts_inst_1', saleId: 'ts_sale_2', amount: 300, by: 'tuckshop_1', note: 'Parent part-payment received.' },
    { id: 'ts_inst_2', saleId: 'ts_sale_4', amount: 200, by: 'tuckshop_1', note: 'Staff installment logged.' },
  ].forEach((installment) => {
    db.prepare('INSERT OR IGNORE INTO tuckshop_installments (id, sale_id, amount_paid_naira, recorded_by_user_id, note) VALUES (?, ?, ?, ?, ?)')
      .run(installment.id, installment.saleId, installment.amount, installment.by, installment.note);
  });

  [
    { id: 'ts_debtor_1', userId: 's1', balance: 3200, plan: '₦1,000 weekly', status: 'Active' },
    { id: 'ts_debtor_2', userId: 't3', balance: 5500, plan: 'Payroll deduction pending', status: 'Pending' },
  ].forEach((debtor) => {
    db.prepare('INSERT OR IGNORE INTO tuckshop_debtors (id, school_id, user_id, outstanding_balance_naira, repayment_plan, status) VALUES (?, ?, ?, ?, ?, ?)')
      .run(debtor.id, schoolId, debtor.userId, debtor.balance, debtor.plan, debtor.status);
  });

  [
    { id: 'ts_audit_1', actor: 'tuckshop_1', action: 'sale_marked_part_paid', details: { saleId: 'ts_sale_2', amount: 300 } },
    { id: 'ts_audit_2', actor: 'tuckshop_1', action: 'installment_recorded', details: { saleId: 'ts_sale_4', amount: 200 } },
    { id: 'ts_audit_3', actor: 'tuckshop_1', action: 'offline_sync_completed', details: { productId: 'ts_prod_2', syncedSales: 3 } },
  ].forEach((log) => {
    db.prepare('INSERT OR IGNORE INTO tuckshop_audit_logs (id, school_id, actor_user_id, action, details_json) VALUES (?, ?, ?, ?, ?)')
      .run(log.id, schoolId, log.actor, log.action, JSON.stringify(log.details));
  });

  [
    {
      id: 'ts_account_1',
      method: 'Auras',
      accountName: 'Ndovera Tuckshop Wallet',
      accountNumber: null,
      bankName: null,
      auraWalletId: 'AURA-NDOVERA-TS-001',
      instructions: 'Send your Auras to the tuckshop wallet and tap I Have Paid after transfer.',
    },
    {
      id: 'ts_account_2',
      method: 'Bank Transfer',
      accountName: 'Ndovera Schools Tuckshop',
      accountNumber: '0123456789',
      bankName: 'Ndovera Microfinance Bank',
      auraWalletId: null,
      instructions: 'Use bank transfer, keep your receipt, then acknowledge payment in the dashboard.',
    },
  ].forEach((account) => {
    db.prepare(`
      INSERT OR IGNORE INTO tuckshop_payment_accounts (
        id, school_id, method, account_name, account_number, bank_name, aura_wallet_id, instructions, created_by_user_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(account.id, schoolId, account.method, account.accountName, account.accountNumber, account.bankName, account.auraWalletId, account.instructions, 'tuckshop_1');
  });

  [
    {
      id: 'ts_order_1', requesterUserId: 'parent_1', requesterRole: 'Parent', studentUserId: 's1', productId: 'ts_prod_4',
      quantity: 3, unitPrice: 700, total: 2100, paymentMethod: 'Bank Transfer', status: 'Pending payment', note: 'Weekly classroom supply order',
    },
    {
      id: 'ts_order_2', requesterUserId: 't3', requesterRole: 'Teacher', studentUserId: null, productId: 'ts_prod_1',
      quantity: 5, unitPrice: 200, total: 1000, paymentMethod: 'Auras', status: 'Awaiting pickup', note: 'Staff room restock',
    },
  ].forEach((order) => {
    const statement = tuckshopOrderHasLegacyRequesterColumn
      ? db.prepare(`
          INSERT OR IGNORE INTO tuckshop_orders (
            id, school_id, requester_user_id, requested_by_user_id, requester_role, student_user_id, product_id, quantity, unit_price_naira,
            total_amount_naira, payment_method, status, note
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
      : db.prepare(`
          INSERT OR IGNORE INTO tuckshop_orders (
            id, school_id, requester_user_id, requester_role, student_user_id, product_id, quantity, unit_price_naira,
            total_amount_naira, payment_method, status, note
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

    const args = tuckshopOrderHasLegacyRequesterColumn
      ? [
          order.id,
          schoolId,
          order.requesterUserId,
          order.requesterUserId,
          order.requesterRole,
          order.studentUserId,
          order.productId,
          order.quantity,
          order.unitPrice,
          order.total,
          order.paymentMethod,
          order.status,
          order.note,
        ]
      : [
          order.id,
          schoolId,
          order.requesterUserId,
          order.requesterRole,
          order.studentUserId,
          order.productId,
          order.quantity,
          order.unitPrice,
          order.total,
          order.paymentMethod,
          order.status,
          order.note,
        ];

    statement.run(...args);
  });

  db.prepare(`
    INSERT OR IGNORE INTO tuckshop_purchase_blocks (
      id, school_id, parent_user_id, student_user_id, product_id, reason, is_blocked
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run('ts_block_1', schoolId, 'parent_1', 's1', 'ts_prod_2', 'Fruit juice blocked on school days.', 1);
}

seedTuckshopExperience();

const LIBRARY_ACCESS_ROLES = ['Teacher', 'Student', 'Parent', 'Librarian', 'HoS', 'Head Teacher', 'Principal', 'Class Teacher', 'HOD', 'School Admin', 'Owner', 'Ami'];
const LIBRARY_UPLOAD_ROLES = ['Teacher', 'Student', 'Parent', 'Librarian', 'HoS', 'Head Teacher', 'Principal', 'Class Teacher', 'HOD', 'School Admin', 'Owner', 'Ami'];
const LIBRARY_MANAGER_ROLES = ['Librarian', 'HoS', 'Head Teacher', 'Principal', 'School Admin', 'Owner', 'Ami'];
const LIBRARY_MODERATOR_ROLES = ['Librarian', 'HoS', 'Head Teacher', 'Principal', 'School Admin', 'Owner', 'Ami'];

function getActiveRole(req: any) {
  return req.user?.activeRole || req.user?.roles?.[0] || 'Guest';
}

function getLibraryRoleState(req: any) {
  const role = getActiveRole(req);
  return {
    role,
    canManagePhysical: LIBRARY_MANAGER_ROLES.includes(role),
    canModerate: LIBRARY_MODERATOR_ROLES.includes(role),
    canUpload: LIBRARY_UPLOAD_ROLES.includes(role),
    canSeeAnalytics: LIBRARY_MANAGER_ROLES.includes(role) || role === 'Owner' || role === 'Ami',
    showParentHistory: role === 'Parent',
  };
}

function ensureLibraryActorUser(req: any, schoolId: string) {
  const currentUser = req.user as { id?: string; activeRole?: string; roles?: string[] } | undefined;
  const userId = currentUser?.id;
  if (!userId) return null;

  const existing = db.prepare('SELECT id, name, role, school_id FROM users WHERE id = ?').get(userId) as { id: string; name: string; role: string; school_id: string } | undefined;
  if (existing) return existing;

  const role = getActiveRole(req);
  const generatedName = role === 'Guest' ? `User ${userId}` : `${role} ${userId}`;
  const generatedEmail = `${userId}@ndovera.local`;

  db.prepare('INSERT INTO users (id, school_id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?, ?)')
    .run(userId, schoolId, generatedName, generatedEmail, 'header_auth', role);

  return db.prepare('SELECT id, name, role, school_id FROM users WHERE id = ?').get(userId) as { id: string; name: string; role: string; school_id: string } | undefined;
}

function makeSqlPlaceholders(values: any[]) {
  return values.map(() => '?').join(', ');
}

function getLibraryViewerUserIds(req: any, schoolId: string) {
  const role = getActiveRole(req);
  const viewerUserId = req.user?.id as string | undefined;
  const childUserIds = role === 'Parent' && viewerUserId
    ? (db.prepare('SELECT user_id FROM students WHERE parent_id = ? OR secondary_parent_id = ? ORDER BY id').all(viewerUserId, viewerUserId) as Array<{ user_id: string }>).map((row) => row.user_id)
    : [];

  return Array.from(new Set([viewerUserId, ...childUserIds].filter((value): value is string => Boolean(value))));
}

function mapLibraryBookRecord(row: any) {
  return {
    id: row.id,
    title: row.title,
    author: row.author_name,
    category: row.category,
    mode: row.mode,
    library: row.library_scope,
    access: row.access_model,
    nairaPrice: Number(row.naira_price || 0),
    auraPrice: Number(row.aura_price || 0),
    approval: row.approval_status,
    owner: row.owner_name || 'Ndovera Library',
    ownerUserId: row.owner_user_id || null,
    qualityScore: row.quality_label || 'Pending review',
    shelf: row.shelf_code || null,
    format: row.format_label || 'Digital',
    summary: row.summary || 'No summary available yet.',
    visibility: row.visibility_scope || 'School only',
    createdAt: row.created_at,
    recommendationCount: Number(row.recommendation_count || 0),
    recommendedByMe: Boolean(row.recommended_by_me),
  };
}

function getLibraryAnalytics(schoolId: string) {
  const mostBorrowed = db.prepare(`
    SELECT b.title, COUNT(*) as borrow_count
    FROM physical_borrows pb
    JOIN library_books b ON b.id = pb.book_id
    WHERE pb.school_id = ?
    GROUP BY b.id, b.title
    ORDER BY borrow_count DESC, b.title ASC
    LIMIT 1
  `).get(schoolId) as { title?: string; borrow_count?: number } | undefined;

  const readingStats = db.prepare(`
    SELECT COALESCE(SUM(minutes_spent), 0) as minutes, COUNT(*) as reads
    FROM digital_reads
    WHERE school_id = ?
  `).get(schoolId) as { minutes?: number; reads?: number };

  const revenueStats = db.prepare(`
    SELECT COALESCE(SUM(amount_naira), 0) as total_naira
    FROM library_transactions
    WHERE school_id = ? AND status = 'completed'
  `).get(schoolId) as { total_naira?: number };

  const qualityStats = db.prepare(`
    SELECT COALESCE(ROUND(AVG((readability_score + structure_score + relevance_score) / 3.0)), 0) as quality_score
    FROM ai_analysis_reports ar
    JOIN library_books b ON b.id = ar.book_id
    WHERE b.school_id IS NULL OR b.school_id = ?
  `).get(schoolId) as { quality_score?: number };

  return [
    { label: 'Most Borrowed', value: mostBorrowed?.title || 'No borrow data yet', note: `${Number(mostBorrowed?.borrow_count || 0)} physical borrows recorded` },
    { label: 'Student Reading Trend', value: `${Number(readingStats?.minutes || 0)} mins`, note: `${Number(readingStats?.reads || 0)} digital reading sessions logged` },
    { label: 'Revenue Performance', value: `₦${Number(revenueStats?.total_naira || 0).toLocaleString()}`, note: 'Completed paid reads and borrows across the visible library' },
    { label: 'Quality Scores', value: `${Number(qualityStats?.quality_score || 0)}% avg`, note: 'Average AI quality score across visible books' },
  ];
}

function getLibraryDashboardPayload(req: any) {
  const schoolId = resolveSchoolId(req);
  const roleState = getLibraryRoleState(req);
  const actor = ensureLibraryActorUser(req, schoolId);
  const viewerUserId = actor?.id || null;
  const scopedUserIds = getLibraryViewerUserIds(req, schoolId);

  const books = db.prepare(`
    SELECT b.*, COALESCE(bp.naira_price, 0) as naira_price, COALESCE(bp.aura_price, 0) as aura_price,
      (SELECT COUNT(*) FROM library_recommendations lr WHERE lr.book_id = b.id) as recommendation_count,
      (SELECT COUNT(*) FROM library_recommendations lr WHERE lr.book_id = b.id AND lr.recommender_user_id = ?) as recommended_by_me
    FROM library_books b
    LEFT JOIN book_pricing bp ON bp.book_id = b.id
    WHERE b.school_id IS NULL OR b.school_id = ?
    ORDER BY CASE b.approval_status WHEN 'Approved' THEN 0 WHEN 'In Review' THEN 1 ELSE 2 END, datetime(b.created_at) DESC, b.title ASC
  `).all(viewerUserId, schoolId).map(mapLibraryBookRecord);

  const myBooks = viewerUserId
    ? db.prepare(`
        SELECT b.id, b.title, b.owner_name, b.approval_status, b.created_at, ar.review_status, ar.note,
          air.report_status, air.summary, air.tags_json
        FROM library_books b
        LEFT JOIN admin_reviews ar ON ar.book_id = b.id
        LEFT JOIN ai_analysis_reports air ON air.book_id = b.id
        WHERE b.owner_user_id = ?
        ORDER BY datetime(b.created_at) DESC, b.title ASC
      `).all(viewerUserId).map((row: any) => ({
        id: row.id,
        title: row.title,
        owner: row.owner_name || actor?.name || roleState.role,
        stage: row.approval_status === 'Approved' ? 'Published' : row.review_status === 'flagged' ? 'Flagged' : 'AI Review',
        ai: row.report_status === 'pending'
          ? 'AI review pending. Readability, structure, and relevance checks are queued.'
          : `AI summary ready${row.tags_json ? ` • tags: ${safeParseJson<string[]>(row.tags_json, []).join(', ')}` : ''}`,
        compliance: row.note || (row.approval_status === 'Approved' ? 'Approved manually' : 'Awaiting admin review'),
        createdAt: row.created_at,
      }))
    : [];

  const history: Array<{ id: string; user: string; title: string; activity: string; timestamp: string; sortDate: string; status?: string }> = [];
  if (scopedUserIds.length) {
    const placeholders = makeSqlPlaceholders(scopedUserIds);
    const digitalReads = db.prepare(`
      SELECT dr.id, dr.pages_read, dr.minutes_spent, dr.bookmark_text, dr.last_opened_at, u.name as user_name, b.title
      FROM digital_reads dr
      JOIN users u ON u.id = dr.reader_user_id
      JOIN library_books b ON b.id = dr.book_id
      WHERE dr.reader_user_id IN (${placeholders})
      ORDER BY datetime(dr.last_opened_at) DESC
      LIMIT 24
    `).all(...scopedUserIds) as Array<any>;

    const borrows = db.prepare(`
      SELECT pb.id, pb.due_date, pb.status, pb.sync_status, pb.created_at, u.name as user_name, b.title
      FROM physical_borrows pb
      JOIN users u ON u.id = pb.borrower_user_id
      JOIN library_books b ON b.id = pb.book_id
      WHERE pb.borrower_user_id IN (${placeholders})
      ORDER BY datetime(pb.created_at) DESC
      LIMIT 24
    `).all(...scopedUserIds) as Array<any>;

    digitalReads.forEach((row) => {
      history.push({
        id: row.id,
        user: row.user_name,
        title: row.title,
        activity: `Read ${Number(row.pages_read || 0)} pages • ${Number(row.minutes_spent || 0)} mins${row.bookmark_text ? ` • ${row.bookmark_text}` : ''}`,
        timestamp: row.last_opened_at,
        sortDate: row.last_opened_at,
      });
    });

    borrows.forEach((row) => {
      history.push({
        id: row.id,
        user: row.user_name,
        title: row.title,
        activity: `Borrowed physically • due ${row.due_date ? new Date(row.due_date).toLocaleDateString() : 'not scheduled'}${row.sync_status ? ` • ${row.sync_status}` : ''}`,
        timestamp: row.created_at,
        sortDate: row.created_at,
        status: row.status,
      });
    });
  }

  const sortedHistory = history
    .sort((left, right) => String(right.sortDate).localeCompare(String(left.sortDate)))
    .slice(0, 18)
    .map(({ sortDate, ...entry }) => entry);

  const myBorrowedBooks = viewerUserId
    ? db.prepare(`
        SELECT pb.id, pb.borrow_date, pb.due_date, pb.status, b.title
        FROM physical_borrows pb
        JOIN library_books b ON b.id = pb.book_id
        WHERE pb.borrower_user_id = ?
        ORDER BY datetime(pb.created_at) DESC
      `).all(viewerUserId) as Array<any>
    : [];

  const physicalRecords = roleState.canManagePhysical
    ? db.prepare(`
        SELECT pb.id, u.name as borrower, pb.borrower_role, b.title as book, pb.due_date, pb.status, pb.sync_status
        FROM physical_borrows pb
        JOIN users u ON u.id = pb.borrower_user_id
        JOIN library_books b ON b.id = pb.book_id
        WHERE pb.school_id = ?
        ORDER BY datetime(pb.created_at) DESC
      `).all(schoolId).map((row: any) => ({
        id: row.id,
        borrower: row.borrower,
        userType: row.borrower_role,
        book: row.book,
        dueDate: row.due_date ? new Date(row.due_date).toISOString().slice(0, 10) : 'N/A',
        status: row.status,
        offline: row.sync_status || 'Synced',
      }))
    : [];

  const wallet = viewerUserId
    ? db.prepare('SELECT balance_aura, naira_equivalent FROM aura_wallets WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1').get(viewerUserId) as { balance_aura?: number; naira_equivalent?: number } | undefined
    : undefined;
  const earningsTotals = viewerUserId
    ? db.prepare(`
        SELECT COALESCE(SUM(owner_amount_naira), 0) as owner_naira, COALESCE(SUM(owner_amount_aura), 0) as owner_aura,
               COALESCE(SUM(platform_amount_naira), 0) as platform_naira
        FROM earnings_split
        WHERE owner_user_id = ?
      `).get(viewerUserId) as { owner_naira?: number; owner_aura?: number; platform_naira?: number }
    : { owner_naira: 0, owner_aura: 0, platform_naira: 0 };

  const earnings = [
    { label: 'Contributor Wallet', value: `₦${Number(wallet?.naira_equivalent || earningsTotals.owner_naira || 0).toLocaleString()}`, note: 'Available for withdrawal after review window.' },
    { label: 'Aura Balance', value: `${Number(wallet?.balance_aura || earningsTotals.owner_aura || 0)} Auras`, note: 'Aura equivalent follows the owner-set selling price.' },
    { label: 'Revenue Split', value: '80% / 20%', note: 'Owner share vs Ndovera share per read or borrow.' },
  ];

  const recommendations = viewerUserId
    ? db.prepare(`
        SELECT lr.book_id, lr.created_at, b.title
        FROM library_recommendations lr
        JOIN library_books b ON b.id = lr.book_id
        WHERE lr.recommender_user_id = ?
        ORDER BY datetime(lr.created_at) DESC
      `).all(viewerUserId) as Array<{ book_id: string; created_at: string; title: string }>
    : [];

  const stats = {
    modesCount: Array.from(new Set(books.map((book: any) => book.mode))).length,
    approvedTitles: books.filter((book: any) => book.approval === 'Approved').length,
    historyVisibility: roleState.showParentHistory ? 'Child view' : (sortedHistory.length ? `${sortedHistory.length} events` : 'Visible'),
    drmProtection: roleState.canSeeAnalytics ? '80 / 20' : 'Active',
  };

  return {
    roleState,
    books,
    myBooks,
    history: sortedHistory,
    myBorrowedBooks,
    physicalRecords,
    earnings,
    analytics: getLibraryAnalytics(schoolId),
    recommendations,
    stats,
  };
}

const CLINIC_MANAGER_ROLES = ['Clinic Officer', 'Clinic Manager', 'School Admin', 'Super Admin', 'HoS', 'HOS', 'Head Teacher', 'Principal', 'Owner', 'Ami'];
const CLINIC_USER_ROLES = ['Clinic Officer', 'Clinic Manager', 'School Admin', 'Super Admin', 'HoS', 'HOS', 'Head Teacher', 'Principal', 'Owner', 'Ami', 'Teacher', 'Student', 'Parent'];
const TUCKSHOP_MANAGER_ROLES = ['Tuckshop Manager', 'School Admin', 'Super Admin'];
const TUCKSHOP_OVERSIGHT_ROLES = ['HoS', 'HOS', 'Owner', 'Ami'];
const TUCKSHOP_ACCESS_ROLES = ['Tuckshop Manager', 'School Admin', 'Super Admin', 'HoS', 'HOS', 'Owner', 'Ami', 'Student', 'Parent', 'Teacher', 'Class Teacher', 'HOD', 'Principal', 'Head Teacher', 'Nursery Head', 'Librarian', 'Accountant'];

function resolveClinicViewerUserId(req: any, schoolId: string) {
  const activeRole = getActiveRole(req);
  const currentUserId = req.user?.id as string | undefined;
  const currentUserRole = currentUserId
    ? (db.prepare('SELECT role FROM users WHERE id = ? AND school_id = ?').get(currentUserId, schoolId) as { role?: string } | undefined)?.role
    : undefined;

  const exactRoleMatches = activeRole === currentUserRole || (activeRole === 'Clinic Manager' && currentUserRole === 'Clinic Officer');
  if (currentUserId && exactRoleMatches) return currentUserId;

  if (activeRole === 'Student') {
    return (db.prepare('SELECT user_id FROM students WHERE school_id = ? ORDER BY id LIMIT 1').get(schoolId) as { user_id?: string } | undefined)?.user_id || currentUserId || null;
  }

  if (activeRole === 'Parent') {
    return (db.prepare('SELECT id FROM users WHERE school_id = ? AND role = ? ORDER BY id LIMIT 1').get(schoolId, 'Parent') as { id?: string } | undefined)?.id || currentUserId || null;
  }

  if (activeRole === 'Teacher') {
    return (db.prepare('SELECT user_id FROM teachers WHERE school_id = ? ORDER BY id LIMIT 1').get(schoolId) as { user_id?: string } | undefined)?.user_id || currentUserId || null;
  }

  if (activeRole === 'Clinic Officer' || activeRole === 'Clinic Manager') {
    return (db.prepare('SELECT id FROM users WHERE school_id = ? AND role = ? ORDER BY id LIMIT 1').get(schoolId, 'Clinic Officer') as { id?: string } | undefined)?.id || currentUserId || null;
  }

  return currentUserId || null;
}

function getClinicScope(req: any) {
  const schoolId = resolveSchoolId(req);
  const role = getActiveRole(req);
  const viewerUserId = resolveClinicViewerUserId(req, schoolId);
  const canManage = CLINIC_MANAGER_ROLES.includes(role);

  if (canManage) {
    return { schoolId, role, viewerUserId, canManage, allowedUserIds: null as string[] | null };
  }

  if (role === 'Parent') {
    const childIds = viewerUserId
      ? (db.prepare('SELECT user_id FROM students WHERE parent_id = ? OR secondary_parent_id = ? ORDER BY id').all(viewerUserId, viewerUserId) as Array<{ user_id: string }>).map((row) => row.user_id)
      : [];
    return { schoolId, role, viewerUserId, canManage, allowedUserIds: [viewerUserId, ...childIds].filter(Boolean) as string[] };
  }

  return { schoolId, role, viewerUserId, canManage, allowedUserIds: viewerUserId ? [viewerUserId] : [] };
}

function applyClinicScope<T extends { user_id?: string | null; patient_user_id?: string | null }>(rows: T[], allowedUserIds: string[] | null, key: 'user_id' | 'patient_user_id') {
  if (!allowedUserIds) return rows;
  const allowed = new Set(allowedUserIds);
  return rows.filter((row) => {
    const value = row[key];
    return typeof value === 'string' && allowed.has(value);
  });
}

function getTuckshopScope(req: any) {
  const schoolId = resolveSchoolId(req);
  const role = getActiveRole(req);
  const viewerUserId = req.user?.id as string | undefined;
  const isManager = TUCKSHOP_MANAGER_ROLES.includes(role);
  const isOversight = TUCKSHOP_OVERSIGHT_ROLES.includes(role);
  const isParent = role === 'Parent';
  const isStudent = role === 'Student';
  const isStaff = !isManager && !isParent && !isStudent && !isOversight;
  const childUserIds = isParent && viewerUserId
    ? (db.prepare('SELECT user_id FROM students WHERE parent_id = ? OR secondary_parent_id = ? ORDER BY id').all(viewerUserId, viewerUserId) as Array<{ user_id: string }>).map((row) => row.user_id)
    : [];

  return { schoolId, role, viewerUserId: viewerUserId || null, isManager, isOversight, isParent, isStudent, isStaff, childUserIds };
}

function formatTuckshopCurrency(value: number) {
  return `₦${Number(value || 0).toLocaleString()}`;
}

function getWeekLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((utc.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${utc.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function getWeekRange(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { weekStart: value, weekEnd: value };
  const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = utc.getUTCDay() || 7;
  const monday = new Date(utc);
  monday.setUTCDate(utc.getUTCDate() - day + 1);
  const friday = new Date(monday);
  friday.setUTCDate(monday.getUTCDate() + 4);
  return {
    weekStart: monday.toISOString().slice(0, 10),
    weekEnd: friday.toISOString().slice(0, 10),
  };
}

function normalizeAttendanceStatus(value: string) {
  const normalized = String(value || '').trim();
  if (['Present', 'Absent', 'Late', 'Excused'].includes(normalized)) return normalized;
  if (normalized.includes('Absent')) return 'Absent';
  if (normalized.includes('Late')) return 'Late';
  if (normalized.includes('Excused')) return 'Excused';
  return 'Present';
}

function isAttendancePresentEquivalent(value: string) {
  return normalizeAttendanceStatus(value) !== 'Absent';
}

function buildTuckshopPeriodTotals(rows: Array<{ created_at: string; total_amount_naira: number }>) {
  const daily = new Map<string, number>();
  const weekly = new Map<string, number>();
  const monthly = new Map<string, number>();

  rows.forEach((row) => {
    const date = new Date(row.created_at);
    const dayLabel = Number.isNaN(date.getTime()) ? row.created_at : date.toISOString().slice(0, 10);
    const weekLabel = getWeekLabel(row.created_at);
    const monthLabel = Number.isNaN(date.getTime()) ? row.created_at.slice(0, 7) : date.toISOString().slice(0, 7);
    daily.set(dayLabel, (daily.get(dayLabel) || 0) + Number(row.total_amount_naira || 0));
    weekly.set(weekLabel, (weekly.get(weekLabel) || 0) + Number(row.total_amount_naira || 0));
    monthly.set(monthLabel, (monthly.get(monthLabel) || 0) + Number(row.total_amount_naira || 0));
  });

  return {
    daily: [...daily.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([period, amount]) => ({ period, total: formatTuckshopCurrency(amount) })),
    weekly: [...weekly.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([period, amount]) => ({ period, total: formatTuckshopCurrency(amount) })),
    monthly: [...monthly.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([period, amount]) => ({ period, total: formatTuckshopCurrency(amount) })),
  };
}

function syncTuckshopDebtorRecord(schoolId: string, userId: string, fallbackPlan = 'Awaiting settlement') {
  const debtSummary = db.prepare(`
    SELECT SUM(balance_due_naira) as total_due
    FROM tuckshop_sales
    WHERE school_id = ? AND buyer_user_id = ?
  `).get(schoolId, userId) as { total_due?: number };
  const outstanding = Number(debtSummary.total_due || 0);
  const existing = db.prepare('SELECT id, repayment_plan FROM tuckshop_debtors WHERE school_id = ? AND user_id = ?').get(schoolId, userId) as { id?: string; repayment_plan?: string | null } | undefined;

  if (existing?.id) {
    db.prepare(`
      UPDATE tuckshop_debtors
      SET outstanding_balance_naira = ?, status = ?, repayment_plan = COALESCE(repayment_plan, ?), updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(outstanding, outstanding > 0 ? 'Active' : 'Paid', fallbackPlan, existing.id);
  } else if (outstanding > 0) {
    db.prepare(`
      INSERT INTO tuckshop_debtors (
        id, school_id, user_id, outstanding_balance_naira, repayment_plan, status
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(makeId('tuck_debtor'), schoolId, userId, outstanding, fallbackPlan, 'Active');
  }
}

const uploadsDir = path.resolve(process.cwd(), 'packages', 'server', 'public', 'uploads');
const uploadChunkDir = path.resolve(process.cwd(), 'packages', 'server', 'public', 'chunk_uploads');
const classroomAssetSecret = process.env.CLASSROOM_ASSET_SECRET || 'ndovera-private-classroom-assets';
const classroomAssetTtlMs = 1000 * 60 * 60 * 12;
const classroomMediaRetentionMs = Number(process.env.CLASSROOM_MEDIA_RETENTION_HOURS || 12) * 60 * 60 * 1000;

// Create a signed token so browser-rendered media can remain backend-protected.
function signClassroomAssetToken(schoolId: string, storageKey: string, expiresAt: number) {
  return crypto.createHmac('sha256', classroomAssetSecret).update(`${schoolId}:${storageKey}:${expiresAt}`).digest('hex');
}

// Normalize both legacy public URLs and new storage keys into one internal classroom asset key.
function normalizeClassroomAssetKey(rawValue?: string | null) {
  if (!rawValue) return null;
  const normalized = String(rawValue).replace(/\\/g, '/');
  if (normalized.startsWith('/uploads/')) {
    const withoutPrefix = normalized.replace(/^\/uploads\//, '');
    const parts = withoutPrefix.split('/');
    if (parts.length >= 3 && parts[1] === 'classroom') {
      return `${parts[0]}/classroom/${parts.slice(2).join('/')}`;
    }
  }
  if (/^[^/]+\/classroom\/.+/.test(normalized)) return normalized;
  return null;
}

function buildPrivateClassroomAssetUrl(schoolId: string, storageKey: string) {
  const expiresAt = Date.now() + classroomAssetTtlMs;
  const token = signClassroomAssetToken(schoolId, storageKey, expiresAt);
  return `/api/classroom/assets?key=${encodeURIComponent(storageKey)}&expires=${expiresAt}&token=${token}`;
}

function resolvePrivateClassroomAssetPath(storageKey: string) {
  return path.join(uploadsDir, storageKey);
}

function getAcademicSessionKey(date = new Date()) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const startYear = month >= 8 ? year : year - 1;
  return `${startYear}-${startYear + 1}`;
}

async function deleteClassroomAttachments(attachments: any[]) {
  const keys = (Array.isArray(attachments) ? attachments : [])
    .map((attachment) => normalizeClassroomAssetKey(attachment?.storageKey || attachment?.url))
    .filter(Boolean) as string[];

  for (const storageKey of keys) {
    await fs.promises.unlink(resolvePrivateClassroomAssetPath(storageKey)).catch(() => undefined);
  }
}

async function pruneSubjectFeedForNewSession(schoolId: string, subjectId: string) {
  const currentSessionKey = getAcademicSessionKey();
  const stalePosts = db.prepare(`
    SELECT * FROM classroom_feed_posts
    WHERE school_id = ?
      AND subject_id = ?
      AND COALESCE(scope, 'classroom') = 'subject'
      AND COALESCE(session_key, 'legacy') != ?
    ORDER BY created_at ASC
  `).all(schoolId, subjectId, currentSessionKey) as any[];

  if (!stalePosts.length) return;

  const postsBySession = stalePosts.reduce<Record<string, any[]>>((groups, post) => {
    const key = String(post.session_key || 'legacy');
    groups[key] = groups[key] || [];
    groups[key].push(post);
    return groups;
  }, {});

  for (const [sessionKey, posts] of Object.entries(postsBySession)) {
    const archiveId = `subject_feed_archive_${subjectId}_${sessionKey}`.replace(/[^a-zA-Z0-9_-]/g, '_');
    const summary = {
      postCount: posts.length,
      archivedAt: new Date().toISOString(),
      sessionKey,
      snippets: posts.slice(0, 12).map((post) => ({
        author: post.author_name,
        role: post.author_role,
        body: String(post.body || '').slice(0, 180),
        createdAt: post.created_at,
      })),
    };

    db.prepare(`
      INSERT OR REPLACE INTO classroom_subject_feed_archives (id, school_id, subject_id, session_key, summary_json)
      VALUES (?, ?, ?, ?, ?)
    `).run(archiveId, schoolId, subjectId, sessionKey, JSON.stringify(summary));
  }

  for (const post of stalePosts) {
    await deleteClassroomAttachments(safeParseJson(post.attachments_json, []));
  }

  const postIds = stalePosts.map((post) => post.id);
  const placeholders = postIds.map(() => '?').join(', ');
  db.prepare(`DELETE FROM classroom_feed_comments WHERE post_id IN (${placeholders})`).run(...postIds);
  db.prepare(`DELETE FROM classroom_feed_reactions WHERE post_id IN (${placeholders})`).run(...postIds);
  db.prepare(`DELETE FROM classroom_feed_posts WHERE id IN (${placeholders})`).run(...postIds);
}

function normalizeChunkSessionId(sessionId?: string | null) {
  return String(sessionId || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 120);
}

function resolveChunkSessionDir(schoolId: string, sessionId: string) {
  return path.join(uploadChunkDir, schoolId, sessionId);
}

async function cleanupChunkSessionDir(sessionDir: string) {
  await fs.promises.rm(sessionDir, { force: true, recursive: true }).catch(() => undefined);
}

function isClassroomAssetExpired(filePath: string) {
  try {
    const stats = fs.statSync(filePath);
    return Date.now() - stats.mtimeMs > classroomMediaRetentionMs;
  } catch {
    return true;
  }
}

// Clear old classroom media so each later session starts with a fresh attachment store.
async function cleanupExpiredClassroomAssets() {
  if (!fs.existsSync(uploadsDir)) return;
  const schoolFolders = await fs.promises.readdir(uploadsDir, { withFileTypes: true });
  for (const schoolFolder of schoolFolders) {
    if (!schoolFolder.isDirectory()) continue;
    const classroomDir = path.join(uploadsDir, schoolFolder.name, 'classroom');
    if (!fs.existsSync(classroomDir)) continue;
    const files = await fs.promises.readdir(classroomDir, { withFileTypes: true });
    for (const file of files) {
      if (!file.isFile()) continue;
      const filePath = path.join(classroomDir, file.name);
      if (isClassroomAssetExpired(filePath)) {
        await fs.promises.unlink(filePath).catch(() => undefined);
      }
    }
  }
}

async function assembleChunkedUpload(params: {
  fileName: string;
  mimeType?: string;
  schoolId: string;
  sessionId: string;
  type: 'audio' | 'video';
}) {
  const sessionDir = resolveChunkSessionDir(params.schoolId, params.sessionId);
  const entries = await fs.promises.readdir(sessionDir, { withFileTypes: true });
  const chunkFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.part'))
    .map((entry) => entry.name)
    .sort((left, right) => {
      const leftIndex = Number(left.split('.')[0]);
      const rightIndex = Number(right.split('.')[0]);
      return leftIndex - rightIndex;
    });

  if (!chunkFiles.length) {
    throw new Error('No uploaded chunks found for this recording session.');
  }

  const ext = path.extname(params.fileName) || (params.type === 'audio' ? '.webm' : '.webm');
  const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
  const storageKey = `${params.schoolId}/classroom/${safeName}`;
  const finalPath = resolvePrivateClassroomAssetPath(storageKey);
  await fs.promises.mkdir(path.dirname(finalPath), { recursive: true });

  const output = fs.createWriteStream(finalPath);
  for (const chunkFile of chunkFiles) {
    const chunkPath = path.join(sessionDir, chunkFile);
    const chunkBuffer = await fs.promises.readFile(chunkPath);
    output.write(chunkBuffer);
  }

  await new Promise<void>((resolve, reject) => {
    output.end(() => resolve());
    output.on('error', reject);
  });

  const url = buildPrivateClassroomAssetUrl(params.schoolId, storageKey);
  const stats = await fs.promises.stat(finalPath);
  await cleanupChunkSessionDir(sessionDir);
  return {
    mimeType: params.mimeType || `${params.type}/${ext.replace('.', '')}`,
    name: params.fileName,
    ok: true,
    size: stats.size,
    storageKey,
    url,
  };
}

function mapClassroomAttachmentsForResponse(schoolId: string, attachments: any[]) {
  return (Array.isArray(attachments) ? attachments : []).flatMap((attachment) => {
    const storageKey = normalizeClassroomAssetKey(attachment?.storageKey || attachment?.url);
    if (!storageKey) return [attachment];
    const filePath = resolvePrivateClassroomAssetPath(storageKey);
    if (!fs.existsSync(filePath) || isClassroomAssetExpired(filePath)) return [];
    return [{
      ...attachment,
      storageKey,
      url: buildPrivateClassroomAssetUrl(schoolId, storageKey),
    }];
  });
}

type ClassroomNoteViewerType = 'image' | 'audio' | 'video' | 'pdf' | 'document' | 'slides' | 'ndovera-document' | 'mixed';
type ClassroomUploadAssetType = Exclude<ClassroomNoteViewerType, 'mixed' | 'ndovera-document'>;

type ClassroomNoteMaterial = {
  id: string;
  name: string;
  storageKey?: string;
  mimeType: string;
  size: number;
  extension?: string;
  assetType: ClassroomUploadAssetType;
  viewerType: ClassroomUploadAssetType;
};

function detectClassroomAssetTypeFromMeta(input: { mimeType?: string | null; fileName?: string | null }) {
  const mimeType = String(input.mimeType || '').toLowerCase();
  const lowerName = String(input.fileName || '').toLowerCase();
  const extension = path.extname(lowerName).toLowerCase();

  if (mimeType.startsWith('image/')) return 'image' as const;
  if (mimeType.startsWith('audio/')) return 'audio' as const;
  if (mimeType.startsWith('video/')) return 'video' as const;
  if (mimeType === 'application/pdf' || extension === '.pdf') return 'pdf' as const;
  if (mimeType.includes('presentation') || ['.ppt', '.pptx', '.odp', '.key'].includes(extension)) return 'slides' as const;
  if (
    mimeType.includes('msword')
    || mimeType.includes('wordprocessingml')
    || mimeType.startsWith('text/')
    || ['.doc', '.docx', '.rtf', '.txt'].includes(extension)
  ) {
    return 'document' as const;
  }

  return null;
}

function sanitizeClassroomNoteMaterials(materials: any[]) {
  return (Array.isArray(materials) ? materials : []).flatMap((material, index) => {
    const assetType = detectClassroomAssetTypeFromMeta({
      mimeType: typeof material?.mimeType === 'string' ? material.mimeType : null,
      fileName: typeof material?.name === 'string' ? material.name : null,
    }) || (material?.viewerType === 'pdf' || material?.viewerType === 'document' || material?.viewerType === 'slides' || material?.viewerType === 'image' || material?.viewerType === 'audio' || material?.viewerType === 'video' ? material.viewerType : null);
    if (!assetType) return [];

    const storageKey = normalizeClassroomAssetKey(typeof material?.storageKey === 'string' ? material.storageKey : typeof material?.url === 'string' ? material.url : '');
    if (!storageKey) return [];

    return [{
      id: typeof material?.id === 'string' && material.id.trim() ? material.id : makeId(`material_${index}`),
      name: typeof material?.name === 'string' && material.name.trim() ? material.name.trim() : 'Classroom material',
      storageKey,
      mimeType: typeof material?.mimeType === 'string' && material.mimeType.trim() ? material.mimeType.trim() : 'application/octet-stream',
      size: Number.isFinite(Number(material?.size)) ? Number(material.size) : 0,
      extension: typeof material?.extension === 'string' && material.extension.trim() ? material.extension.trim() : path.extname(typeof material?.name === 'string' ? material.name : '').replace('.', '') || undefined,
      assetType,
      viewerType: assetType,
    } satisfies ClassroomNoteMaterial];
  });
}

function mapClassroomNoteMaterialsForResponse(schoolId: string, materials: ClassroomNoteMaterial[]) {
  return (Array.isArray(materials) ? materials : []).flatMap((material) => {
    const storageKey = normalizeClassroomAssetKey(material?.storageKey);
    if (!storageKey) return [];
    const filePath = resolvePrivateClassroomAssetPath(storageKey);
    if (!fs.existsSync(filePath) || isClassroomAssetExpired(filePath)) return [];
    return [{
      ...material,
      storageKey,
      url: buildPrivateClassroomAssetUrl(schoolId, storageKey),
    }];
  });
}

function mapClassroomNoteForResponse(schoolId: string, note: any) {
  const storedMaterials = sanitizeClassroomNoteMaterials(safeParseJson(note.materials_json, []));
  const legacyAssetType = detectClassroomAssetTypeFromMeta({ mimeType: note.mime_type, fileName: note.file_name });
  const materials = storedMaterials.length
    ? storedMaterials
    : (note.storage_key && legacyAssetType
        ? [{
            id: `${note.id}_primary`,
            name: note.file_name || note.title,
            storageKey: note.storage_key,
            mimeType: note.mime_type || 'application/octet-stream',
            size: Number.isFinite(Number(note.file_size)) ? Number(note.file_size) : 0,
            extension: path.extname(note.file_name || '').replace('.', '') || undefined,
            assetType: legacyAssetType,
            viewerType: legacyAssetType,
          } satisfies ClassroomNoteMaterial]
        : []);

  return {
    id: note.id,
    title: note.title,
    subject: note.subject,
    topic: note.topic,
    week: note.week,
    format: note.format,
    visibility: note.visibility,
    duration: note.duration,
    summary: note.summary,
    access: note.access,
    analytics: safeParseJson(note.analytics_json, { views: 0, downloads: 0, completion: '0%' }),
    versions: safeParseJson<string[]>(note.versions_json, ['v1 current']),
    viewerType: (note.viewer_type || (materials.length > 1 ? 'mixed' : materials[0]?.viewerType) || (safeParseJson(note.content_json, null) ? 'ndovera-document' : null)) as ClassroomNoteViewerType | null,
    mimeType: note.mime_type || null,
    fileName: note.file_name || null,
    fileSize: Number.isFinite(Number(note.file_size)) ? Number(note.file_size) : null,
    storageKey: note.storage_key || null,
    materials: mapClassroomNoteMaterialsForResponse(schoolId, materials),
    ndoveraDocument: safeParseJson(note.content_json, null),
  };
}

function detectClassroomAssetType(file?: Express.Multer.File) {
  if (!file) return null;
  const mimeType = String(file.mimetype || '').toLowerCase();
  const lowerName = String(file.originalname || '').toLowerCase();
  if (mimeType === 'application/octet-stream') {
    if (lowerName.startsWith('video-note-')) return 'video';
    if (lowerName.startsWith('audio-note-')) return 'audio';
  }
  return detectClassroomAssetTypeFromMeta({ mimeType, fileName: file.originalname });
}

async function startServer() {
  console.log('[DEBUG] Starting server...');
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;

  try {
    console.log('[DEBUG] Cleaning up expired assets...');
    await cleanupExpiredClassroomAssets();
    console.log('[DEBUG] Cleanup done.');
  } catch (err) {
    console.error('[WARN] Cleanup failed:', err);
  }

  app.use(express.json());
  app.use(attachUserFromHeaders);

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/schools", (req, res) => {
    const schools = db.prepare("SELECT * FROM schools").all();
    res.json(schools);
  });

  
app.post('/api/users', requireRoles('Super Admin', 'HOS', 'School Admin', 'Owner'), (req, res) => {
  try {
    const { id, name, email, roles, password, class: className, contact_info } = req.body;
    if (!name || !roles) return res.status(400).json({ error: 'Name and roles required' });
    
    const newId = id || ('usr_' + Date.now());
    const schoolId = req.headers['x-school-id'] || 'school_1';

    db.prepare('INSERT INTO users (id, school_id, name, email, roles, password, class, contact_info) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
       .run(newId, schoolId, name, email || '', JSON.stringify(roles), password || 'password123', className || null, JSON.stringify(contact_info || {}));
    
    res.json({ id: newId, name, roles });
  } catch (err) {
    console.error('Add user error', err);
    res.status(500).json({ error: String(err) });
  }
});


// ==========================================
// EVALUATION SYSTEM API
// ==========================================

app.get('/api/evaluation/status', (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    const schoolId = req.headers['x-school-id'] || 'school_1';
    
    // Find active evaluation
    const activeEval = db.prepare('SELECT * FROM evaluations WHERE school_id = ? AND is_active = 1').get(schoolId);
    if (!activeEval) return res.json({ active: false });

    // Check progress
    let progress = db.prepare('SELECT * FROM evaluation_progress WHERE evaluator_id = ? AND evaluation_id = ?').get(userId, activeEval.id);
    if (!progress) {
      progress = { completed_count: 0, total_count: 10, finished: 0 }; // Placeholder total_count
    }

    res.json({
      active: true,
      completed: !!progress.finished,
      progress: `${progress.completed_count}/${progress.total_count}`,
      evaluation_id: activeEval.id
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.get('/api/evaluation/targets', (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    const schoolId = req.headers['x-school-id'] || 'school_1';
    
    // Simplistic target assignment logic based on user roles
    const userRoleReq = Array.isArray(req.headers['x-user-roles']) ? req.headers['x-user-roles'][0] : req.headers['x-user-roles'];
    const userRole = userRoleReq ? String(userRoleReq).split(',')[0] : 'Student';
    
    let targets = [];
    if (userRole === 'Student' || userRole === 'Parent') {
      // Evaluate Teachers
      targets = db.prepare(`SELECT id, name, roles FROM users WHERE school_id = ? AND roles LIKE '%Teacher%'`).all(schoolId);
    } else {
      // Staff evaluates all staff
      targets = db.prepare(`SELECT id, name, roles FROM users WHERE school_id = ? AND roles NOT LIKE '%Student%' AND roles NOT LIKE '%Parent%'`).all(schoolId);
    }

    res.json(targets.slice(0, 10)); // Limit to 10 for prototype
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.post('/api/evaluation/submit', (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    const userRoleReq = Array.isArray(req.headers['x-user-roles']) ? req.headers['x-user-roles'][0] : req.headers['x-user-roles'];
    const userRole = userRoleReq ? String(userRoleReq).split(',')[0] : 'Unknown';
    
    const { target_id, rating, comment, evaluation_id } = req.body;
    
    db.prepare('INSERT INTO evaluation_responses (id, evaluation_id, target_id, evaluator_role, rating, comment, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run('resp_' + Date.now() + Math.random(), evaluation_id || 'eval_1', target_id, userRole, rating, comment || '', new Date().toISOString());
      
    // Update progress
    db.prepare(`
      INSERT INTO evaluation_progress (evaluator_id, evaluation_id, completed_count, total_count, finished) 
      VALUES (?, ?, 1, 10, 0)
      ON CONFLICT(evaluator_id, evaluation_id) DO UPDATE SET completed_count = completed_count + 1
    `).run(userId, evaluation_id || 'eval_1');

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.post('/api/evaluation/finish', (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    const { evaluation_id } = req.body;
    db.prepare('UPDATE evaluation_progress SET finished = 1 WHERE evaluator_id = ? AND evaluation_id = ?').run(userId, evaluation_id || 'eval_1');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.get('/api/evaluation/results', requireRoles('Super Admin', 'HOS', 'School Admin', 'Owner'), (req, res) => {
  try {
    const results = db.prepare('SELECT evaluator_role, AVG(rating) as avg_rating, COUNT(*) as count FROM evaluation_responses GROUP BY evaluator_role').all();
    
    res.json({
      staff: results.find((r: any) => r.evaluator_role === 'Teacher' || r.evaluator_role === 'Staff') || { avg_rating: 0, count: 0 },
      students: results.find((r: any) => r.evaluator_role === 'Student') || { avg_rating: 0, count: 0 },
      parents: results.find((r: any) => r.evaluator_role === 'Parent') || { avg_rating: 0, count: 0 },
      ai: "AI indicates a 15% overall sentiment improvement compared to last quarter."
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Seed a default evaluation if none exists
app.post('/api/evaluation/seed', requireRoles('Super Admin', 'HOS', 'School Admin', 'Owner'), (req, res) => {
  try {
    const schoolId = req.headers['x-school-id'] || 'school_1';
    db.prepare('INSERT OR IGNORE INTO evaluations (id, school_id, start_date, end_date, scope, is_forced, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run('eval_1', schoolId, new Date().toISOString(), new Date(Date.now() + 86400000*30).toISOString(), 'all_staff', 1, 1);
    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ error: String(e) });
  }
});

app.post('/api/auth/login', (req, res) => {
  try {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = db.prepare('SELECT * FROM users WHERE lower(email) = ?').get(email) as any;
    if (!user || user.password_hash !== hashPassword(password)) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const profile = ensureUserProfile(user.id);
    const roles = Array.from(new Set([user.role, user.role === 'School Admin' ? 'HoS' : user.role].filter(Boolean)));
    res.json({
      ok: true,
      user: {
        id: user.id,
        schoolId: user.school_id,
        name: user.name,
        roles,
        activeRole: roles[0],
        email: user.email,
        alternateEmail: user.alternate_email || profile?.alternate_email || null,
      },
    });
  } catch (err) {
    console.error('Login error', err);
    res.status(500).json({ error: 'Unable to sign in right now.' });
  }
});

app.post('/api/onboarding/register-school', (req, res) => {
  try {
    const schoolName = typeof req.body?.schoolName === 'string' ? req.body.schoolName.trim() : '';
    const ownerName = typeof req.body?.ownerName === 'string' ? req.body.ownerName.trim() : '';
    const alternateEmail = typeof req.body?.alternateEmail === 'string' ? req.body.alternateEmail.trim().toLowerCase() : '';
    const phone = typeof req.body?.phone === 'string' ? req.body.phone.trim() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const requestedSubdomain = typeof req.body?.subdomain === 'string' ? req.body.subdomain.trim() : '';

    if (!schoolName || !ownerName || !alternateEmail || !phone || !password) {
      return res.status(400).json({ error: 'School name, owner name, alternate email, phone, and password are required.' });
    }

    if (password.length < 12) {
      return res.status(400).json({ error: 'Password must be at least 12 characters long.' });
    }

    const subdomain = slugifySchoolName(requestedSubdomain || schoolName);
    const ownerNdoveraEmail = buildNdoveraEmail(subdomain);
    const existing = db.prepare('SELECT id FROM school_onboarding_requests WHERE owner_alternate_email = ? AND status != ?').get(alternateEmail, 'Rejected') as { id?: string } | undefined;
    if (existing?.id) {
      return res.status(409).json({ error: 'An onboarding request already exists for this alternate email.' });
    }

    const waitToken = crypto.randomUUID();
    const requestId = makeId('onboard');
    db.prepare(`
      INSERT INTO school_onboarding_requests (
        id, school_name, subdomain, owner_name, owner_ndovera_email, owner_alternate_email, owner_phone,
        desired_password_hash, payment_reference, status, payment_status, wait_token, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(
      requestId,
      schoolName,
      subdomain,
      ownerName,
      ownerNdoveraEmail,
      alternateEmail,
      phone,
      hashPassword(password),
      `PAY-${Date.now()}`,
      'Awaiting Payment',
      'Pending',
      waitToken,
    );

    res.json({
      ok: true,
      requestId,
      waitToken,
      ownerNdoveraEmail,
      paymentAccount: {
        accountNumber: '8064252542',
        accountName: 'Williams James',
        bankName: 'Opay Bank',
      },
      instructions: 'Make payment, click I have paid, then remain in the waiting room while super admin reviews your request.',
    });
  } catch (err) {
    console.error('School onboarding registration error', err);
    res.status(500).json({ error: 'Unable to start registration right now.' });
  }
});

app.post('/api/onboarding/:waitToken/payment', (req, res) => {
  try {
    const waitToken = req.params.waitToken;
    const paymentReference = typeof req.body?.paymentReference === 'string' ? req.body.paymentReference.trim() : '';
    const paymentProofUrl = typeof req.body?.paymentProofUrl === 'string' ? req.body.paymentProofUrl.trim() : '';
    const existing = db.prepare('SELECT id FROM school_onboarding_requests WHERE wait_token = ?').get(waitToken) as { id?: string } | undefined;
    if (!existing?.id) {
      return res.status(404).json({ error: 'Onboarding request not found.' });
    }
    db.prepare(`
      UPDATE school_onboarding_requests
      SET payment_reference = ?, payment_proof_url = ?, payment_status = 'Submitted', status = 'Awaiting Approval', updated_at = CURRENT_TIMESTAMP
      WHERE wait_token = ?
    `).run(paymentReference || null, paymentProofUrl || null, waitToken);
    res.json({ ok: true, status: 'Awaiting Approval' });
  } catch (err) {
    console.error('Onboarding payment acknowledgement error', err);
    res.status(500).json({ error: 'Unable to update payment status.' });
  }
});

app.get('/api/onboarding/:waitToken/status', (req, res) => {
  try {
    const row = db.prepare(`
      SELECT id, school_name, owner_name, owner_ndovera_email, owner_alternate_email, status, payment_status, notes, approved_school_id, approved_user_id, created_at, updated_at
      FROM school_onboarding_requests
      WHERE wait_token = ?
    `).get(req.params.waitToken) as any;
    if (!row) return res.status(404).json({ error: 'Onboarding request not found.' });
    res.json({
      ok: true,
      request: row,
    });
  } catch (err) {
    console.error('Onboarding status error', err);
    res.status(500).json({ error: 'Unable to read onboarding status.' });
  }
});


app.get("/api/users", (req, res) => {
    const users = db.prepare("SELECT * FROM users").all();
    res.json(users);
  });

  app.get("/api/users/me", (req, res) => {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: 'Unauthenticated' });
    const userFromDb = db.prepare("SELECT * FROM users WHERE id = ?").get(user.id) as any;
    if (!userFromDb) return res.status(404).json({ error: 'User not found' });
    const profile = ensureUserProfile(user.id);
    const school = db.prepare('SELECT id, name, subdomain, logo_url, primary_color, website_config FROM schools WHERE id = ?').get(userFromDb.school_id) as any;
    res.json({
      ...userFromDb,
      activeRole: user.activeRole || user.roles?.[0] || userFromDb.role,
      profile: profile ? {
        ...profile,
        skills: safeParseJson(profile.skills_json, []),
        socialLinks: safeParseJson(profile.social_links_json, {}),
        preferences: safeParseJson(profile.preferences_json, {}),
      } : null,
      school: school ? {
        id: school.id,
        name: school.name,
        subdomain: school.subdomain,
        logoUrl: school.logo_url || null,
        primaryColor: school.primary_color || '#10b981',
        websiteUrl: resolveTenantWebsiteUrl(school) || `/public/under-construction?school=${encodeURIComponent(school.id)}`,
      } : null,
    });
  });

  app.get('/api/profile/template', (req, res) => {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: 'Unauthenticated' });
    const userRow = db.prepare('SELECT id, role FROM users WHERE id = ?').get(user.id) as any;
    res.json(buildProfileTemplate(user.activeRole || user.roles?.[0] || userRow?.role, userRow));
  });

  app.get('/api/profile/me', (req, res) => {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: 'Unauthenticated' });
    const profile = ensureUserProfile(user.id);
    const userRow = db.prepare('SELECT id, name, email, role, alternate_email, phone FROM users WHERE id = ?').get(user.id) as any;
    res.json({
      ok: true,
      profile: profile ? {
        ...profile,
        skills: safeParseJson(profile.skills_json, []),
        socialLinks: safeParseJson(profile.social_links_json, {}),
        preferences: safeParseJson(profile.preferences_json, {}),
      } : null,
      user: userRow,
      template: buildProfileTemplate(user.activeRole || user.roles?.[0] || userRow?.role, userRow),
    });
  });

  app.put('/api/profile/me', (req, res) => {
    try {
      const user = (req as any).user;
      if (!user) return res.status(401).json({ error: 'Unauthenticated' });
      const payload = req.body || {};
      const profile = ensureUserProfile(user.id);
      if (!profile) return res.status(404).json({ error: 'Profile owner not found.' });

      const alternateEmail = typeof payload.alternateEmail === 'string' ? payload.alternateEmail.trim().toLowerCase() : null;
      const phone = typeof payload.phone === 'string' ? payload.phone.trim() : null;
      db.prepare('UPDATE users SET alternate_email = ?, phone = ? WHERE id = ?').run(alternateEmail, phone, user.id);
      db.prepare(`
        UPDATE user_profiles
        SET ndovera_email = ?, alternate_email = ?, phone = ?, gender = ?, date_of_birth = ?, address = ?, city = ?, state = ?, country = ?, nationality = ?,
            bio = ?, emergency_contact_name = ?, emergency_contact_phone = ?, occupation = ?, department = ?, employee_id = ?, admission_number = ?, class_name = ?,
            guardian_name = ?, guardian_phone = ?, skills_json = ?, social_links_json = ?, preferences_json = ?, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
      `).run(
        typeof payload.ndoveraEmail === 'string' && payload.ndoveraEmail.trim() ? payload.ndoveraEmail.trim().toLowerCase() : profile.ndovera_email,
        alternateEmail,
        phone,
        typeof payload.gender === 'string' ? payload.gender.trim() : null,
        typeof payload.dateOfBirth === 'string' ? payload.dateOfBirth.trim() : null,
        typeof payload.address === 'string' ? payload.address.trim() : null,
        typeof payload.city === 'string' ? payload.city.trim() : null,
        typeof payload.state === 'string' ? payload.state.trim() : null,
        typeof payload.country === 'string' ? payload.country.trim() : null,
        typeof payload.nationality === 'string' ? payload.nationality.trim() : null,
        typeof payload.bio === 'string' ? payload.bio.trim() : null,
        typeof payload.emergencyContactName === 'string' ? payload.emergencyContactName.trim() : null,
        typeof payload.emergencyContactPhone === 'string' ? payload.emergencyContactPhone.trim() : null,
        typeof payload.occupation === 'string' ? payload.occupation.trim() : null,
        typeof payload.department === 'string' ? payload.department.trim() : null,
        typeof payload.employeeId === 'string' ? payload.employeeId.trim() : null,
        typeof payload.admissionNumber === 'string' ? payload.admissionNumber.trim() : null,
        typeof payload.className === 'string' ? payload.className.trim() : null,
        typeof payload.guardianName === 'string' ? payload.guardianName.trim() : null,
        typeof payload.guardianPhone === 'string' ? payload.guardianPhone.trim() : null,
        JSON.stringify(Array.isArray(payload.skills) ? payload.skills : []),
        JSON.stringify(payload.socialLinks && typeof payload.socialLinks === 'object' ? payload.socialLinks : {}),
        JSON.stringify(payload.preferences && typeof payload.preferences === 'object' ? payload.preferences : {}),
        user.id,
      );
      res.json({ ok: true });
    } catch (err) {
      console.error('Profile update error', err);
      res.status(500).json({ error: 'Unable to update profile.' });
    }
  });

  app.get("/api/parents/me/children", (req, res) => {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: 'Unauthenticated' });
    const children = db.prepare("SELECT s.*, u.name, u.email, c.name as class_name FROM students s JOIN users u ON s.user_id = u.id LEFT JOIN classes c ON s.class_id = c.id WHERE s.parent_id = ? OR s.secondary_parent_id = ?").all(user.id, user.id);
    res.json(children);
  });

  app.get('/api/library/dashboard', requireRoles(...LIBRARY_ACCESS_ROLES), (req, res) => {
    try {
      res.json(getLibraryDashboardPayload(req));
    } catch (err) {
      console.error('Library dashboard error', err);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  app.post('/api/library/submissions', requireRoles(...LIBRARY_UPLOAD_ROLES), (req, res) => {
    try {
      const schoolId = resolveSchoolId(req);
      const actor = ensureLibraryActorUser(req, schoolId);
      const role = getActiveRole(req);
      const title = String(req.body?.title || '').trim();
      const category = String(req.body?.category || 'Storybook').trim();
      const summary = String(req.body?.summary || '').trim();
      const format = String(req.body?.format || 'Draft Manuscript').trim() || 'Draft Manuscript';
      const contentSource = String(req.body?.contentSource || 'composer').trim() || 'composer';
      const nairaPrice = Math.max(0, Number(req.body?.nairaPrice || 0));
      const auraPrice = Math.max(0, Math.round(nairaPrice / 20));

      if (!title) return res.status(400).json({ error: 'Title is required' });
      if (!actor?.id) return res.status(401).json({ error: 'Unauthenticated' });

      const bookId = makeId('LIB_USER');
      const approvalStatus = 'In Review';
      const accessModel = nairaPrice > 0 ? 'Premium' : 'Free';
      const ownerName = `${role} contributor: ${actor.name}`;
      const summaryText = summary || `${title} submitted by ${actor.name} for review.`;
      const tags = [category, role, contentSource].filter(Boolean);

      db.prepare(`
        INSERT INTO library_books (
          id, school_id, title, author_name, category, mode, library_scope, access_model, approval_status, owner_user_id, owner_name,
          quality_label, format_label, summary, visibility_scope, shelf_code, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        bookId,
        schoolId,
        title,
        actor.name,
        category,
        'User Upload',
        'Contributor Library',
        accessModel,
        approvalStatus,
        actor.id,
        ownerName,
        'AI review pending',
        format,
        summaryText,
        'Pending moderation',
        null,
        actor.id,
      );

      db.prepare('INSERT INTO book_versions (id, book_id, version_label, storage_key, metadata_json) VALUES (?, ?, ?, ?, ?)').run(
        makeId('book_ver'),
        bookId,
        'v1.0',
        `library/${bookId.toLowerCase()}`,
        JSON.stringify({ contentSource, role, submittedBy: actor.name }),
      );

      db.prepare('INSERT INTO book_pricing (id, book_id, naira_price, aura_price, owner_share_percent, platform_share_percent, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
        makeId('book_price'),
        bookId,
        nairaPrice,
        auraPrice,
        80,
        20,
        actor.id,
      );

      db.prepare(`
        INSERT INTO ai_analysis_reports (
          id, book_id, readability_score, plagiarism_score, structure_score, relevance_score, summary, tags_json,
          suggested_naira_price, suggested_aura_price, report_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        makeId('ai_report'),
        bookId,
        Math.min(98, Math.max(60, 65 + Math.min(summaryText.length, 240) / 8)),
        4,
        Math.min(97, Math.max(58, 60 + Math.min(title.length + summaryText.length, 220) / 7)),
        88,
        summaryText,
        JSON.stringify(tags),
        nairaPrice,
        auraPrice,
        'pending',
      );

      db.prepare('INSERT INTO admin_reviews (id, book_id, review_status, reviewer_user_id, note, reviewed_at) VALUES (?, ?, ?, ?, ?, ?)').run(
        makeId('admin_review'),
        bookId,
        'pending',
        null,
        'Awaiting admin review',
        null,
      );

      res.status(201).json({ ok: true, bookId });
    } catch (err) {
      console.error('Library submission error', err);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  app.post('/api/library/books/:bookId/recommend', requireRoles(...LIBRARY_ACCESS_ROLES), (req, res) => {
    try {
      const schoolId = resolveSchoolId(req);
      const actor = ensureLibraryActorUser(req, schoolId);
      const bookId = req.params.bookId;
      const note = String(req.body?.note || '').trim() || null;
      const book = db.prepare('SELECT id FROM library_books WHERE id = ? AND (school_id IS NULL OR school_id = ?)').get(bookId, schoolId) as { id?: string } | undefined;
      if (!book?.id) return res.status(404).json({ error: 'Book not found' });
      if (!actor?.id) return res.status(401).json({ error: 'Unauthenticated' });

      const existing = db.prepare('SELECT id FROM library_recommendations WHERE book_id = ? AND recommender_user_id = ?').get(bookId, actor.id) as { id?: string } | undefined;
      let recommended = false;
      if (existing?.id) {
        db.prepare('DELETE FROM library_recommendations WHERE id = ?').run(existing.id);
      } else {
        db.prepare('INSERT INTO library_recommendations (id, school_id, book_id, recommender_user_id, recommender_role, note) VALUES (?, ?, ?, ?, ?, ?)')
          .run(makeId('lib_reco'), schoolId, bookId, actor.id, getActiveRole(req), note);
        recommended = true;
      }

      const countRow = db.prepare('SELECT COUNT(*) as count FROM library_recommendations WHERE book_id = ?').get(bookId) as { count: number };
      res.json({ ok: true, recommended, recommendationCount: Number(countRow.count || 0) });
    } catch (err) {
      console.error('Library recommendation error', err);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  app.post('/api/library/books/:bookId/open', requireRoles(...LIBRARY_ACCESS_ROLES), (req, res) => {
    try {
      const schoolId = resolveSchoolId(req);
      const actor = ensureLibraryActorUser(req, schoolId);
      const bookId = req.params.bookId;
      const book = db.prepare('SELECT id, access_model FROM library_books WHERE id = ? AND (school_id IS NULL OR school_id = ?)').get(bookId, schoolId) as { id?: string; access_model?: string } | undefined;
      if (!book?.id) return res.status(404).json({ error: 'Book not found' });
      if (!actor?.id) return res.status(401).json({ error: 'Unauthenticated' });

      const existing = db.prepare('SELECT id, pages_read, minutes_spent FROM digital_reads WHERE book_id = ? AND reader_user_id = ?').get(bookId, actor.id) as { id?: string; pages_read?: number; minutes_spent?: number } | undefined;
      if (existing?.id) {
        db.prepare('UPDATE digital_reads SET pages_read = ?, minutes_spent = ?, bookmark_text = ?, access_mode = ?, last_opened_at = ? WHERE id = ?')
          .run(Math.max(1, Number(existing.pages_read || 0)), Number(existing.minutes_spent || 0) + 1, 'Opened from library reader', 'in-app', new Date().toISOString(), existing.id);
      } else {
        db.prepare(`
          INSERT INTO digital_reads (id, school_id, book_id, reader_user_id, pages_read, minutes_spent, bookmark_text, watermark_token, access_mode, last_opened_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(makeId('read'), schoolId, bookId, actor.id, 1, 1, 'Opened from library reader', `wm_${actor.id}_${bookId.toLowerCase()}`, 'in-app', new Date().toISOString());
      }

      res.json({ ok: true });
    } catch (err) {
      console.error('Library open error', err);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  app.post('/api/library/books/:bookId/borrow', requireRoles(...LIBRARY_ACCESS_ROLES), (req, res) => {
    try {
      const schoolId = resolveSchoolId(req);
      const actor = ensureLibraryActorUser(req, schoolId);
      const bookId = req.params.bookId;
      const book = db.prepare('SELECT id, title FROM library_books WHERE id = ? AND mode = ? AND (school_id IS NULL OR school_id = ?)').get(bookId, 'Physical', schoolId) as { id?: string; title?: string } | undefined;
      if (!book?.id) return res.status(404).json({ error: 'Physical book not found' });
      if (!actor?.id) return res.status(401).json({ error: 'Unauthenticated' });

      const existing = db.prepare('SELECT id FROM physical_borrows WHERE book_id = ? AND borrower_user_id = ? AND status IN (?, ?, ?)').get(bookId, actor.id, 'On Time', 'Overdue', 'Awaiting Return') as { id?: string } | undefined;
      if (existing?.id) return res.json({ ok: true, alreadyBorrowed: true });

      const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      db.prepare(`
        INSERT INTO physical_borrows (id, school_id, book_id, borrower_user_id, borrower_role, due_date, status, offline_logged, sync_status, librarian_user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(makeId('borrow'), schoolId, bookId, actor.id, getActiveRole(req), dueDate, 'On Time', 0, 'Synced', 'user_admin');

      res.status(201).json({ ok: true, dueDate });
    } catch (err) {
      console.error('Library borrow error', err);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  app.get('/api/parents', requireRoles(...managementRoles), (req, res) => {
    try {
      const schoolId = resolveSchoolId(req);
      const parents = db.prepare(`
        SELECT u.id, u.name, u.email, u.role, u.created_at, u.status, 
               COUNT(s.id) as children_count, 
               GROUP_CONCAT(u_s.name) as children_names 
        FROM users u 
        LEFT JOIN students s ON s.parent_id = u.id OR s.secondary_parent_id = u.id OR s.secondary_parent_id = u.id 
        LEFT JOIN users u_s ON s.user_id = u_s.id 
        WHERE u.school_id = ? AND u.role = 'Parent' 
        GROUP BY u.id
      `).all(schoolId);
      res.json(parents);
    } catch (err: any) {
      res.status(500).json({ error: err.toString() });
    }
  });

  app.get("/api/students", (req, res) => {
    try {
      const schoolId = resolveSchoolId(req);
      const students = db.prepare(`
        SELECT s.*, u.name, u.email, c.name as class_name, p1.name as parent_name, p2.name as secondary_parent_name
        FROM students s
        JOIN users u ON s.user_id = u.id
        LEFT JOIN classes c ON s.class_id = c.id
        LEFT JOIN users p1 ON s.parent_id = p1.id
        LEFT JOIN users p2 ON s.secondary_parent_id = p2.id
        WHERE s.school_id = ?
        ORDER BY u.name ASC
      `).all(schoolId);
      res.json(students);
    } catch (err) {
      console.error('Students fetch error', err);
      res.status(500).json({ error: 'Internal Server Error', detail: String(err) });
    }
  });

  app.get("/api/students/:id/performance", (req, res) => {
    const studentId = req.params.id;
    // These are just dummy values. In a real application, you would calculate this from the database.
    const gpa = 4.5;
    const attendance = '98%';
    res.json({ gpa, attendance });
  });

  app.get("/api/teachers", (req, res) => {
    const teachers = db.prepare(`
      SELECT t.*, u.name, u.email 
      FROM teachers t
      JOIN users u ON t.user_id = u.id
    `).all();
    res.json(teachers);
  });

  app.get('/api/clinic/profiles', requireRoles(...CLINIC_USER_ROLES), (req, res) => {
    const scope = getClinicScope(req);
    let profiles = db.prepare(`
      SELECT
        cp.*, 
        u.name AS patient_name,
        u.email AS patient_email,
        u.role AS patient_role,
        s.admission_number,
        c.name AS class_name
      FROM clinic_profiles cp
      JOIN users u ON u.id = cp.user_id
      LEFT JOIN students s ON s.user_id = u.id
      LEFT JOIN classes c ON c.id = s.class_id
      WHERE cp.school_id = ?
      ORDER BY u.name ASC
    `).all(scope.schoolId) as any[];

    profiles = applyClinicScope(profiles, scope.allowedUserIds, 'user_id');

    res.json(profiles.map((profile) => ({
      id: profile.id,
      userId: profile.user_id,
      patientName: profile.patient_name,
      patientEmail: profile.patient_email,
      patientRole: profile.patient_role,
      patientType: profile.patient_type,
      admissionNumber: profile.admission_number,
      className: profile.class_name,
      bloodGroup: profile.blood_group,
      genotype: profile.genotype,
      allergies: safeParseJson(profile.allergies_json, []),
      chronicConditions: safeParseJson(profile.chronic_conditions_json, []),
      emergencyContactName: profile.emergency_contact_name,
      emergencyContactPhone: profile.emergency_contact_phone,
      medicalNotes: profile.medical_notes,
      updatedAt: profile.updated_at,
    })));
  });

  app.get('/api/clinic/visits', requireRoles(...CLINIC_USER_ROLES), (req, res) => {
    const scope = getClinicScope(req);
    let visits = db.prepare(`
      SELECT
        cv.*,
        patient.name AS patient_name,
        patient.role AS patient_role,
        clinician.name AS recorded_by_name,
        s.admission_number,
        c.name AS class_name
      FROM clinic_visits cv
      JOIN users patient ON patient.id = cv.patient_user_id
      LEFT JOIN users clinician ON clinician.id = cv.recorded_by_user_id
      LEFT JOIN students s ON s.user_id = patient.id
      LEFT JOIN classes c ON c.id = s.class_id
      WHERE cv.school_id = ?
      ORDER BY datetime(cv.recorded_at) DESC
    `).all(scope.schoolId) as any[];

    visits = applyClinicScope(visits, scope.allowedUserIds, 'patient_user_id');

    res.json(visits.map((visit) => ({
      id: visit.id,
      patientUserId: visit.patient_user_id,
      patientName: visit.patient_name,
      patientRole: visit.patient_role,
      admissionNumber: visit.admission_number,
      className: visit.class_name,
      complaint: visit.complaint,
      symptoms: visit.symptoms,
      diagnosis: visit.diagnosis,
      treatmentAdministered: visit.treatment_administered,
      medications: safeParseJson(visit.medications_json, []),
      vitals: safeParseJson(visit.vitals_json, {}),
      outcome: visit.outcome,
      caseStatus: visit.case_status,
      triageLevel: visit.triage_level,
      followUpDate: visit.follow_up_date,
      referralNotes: visit.referral_notes,
      recordedBy: visit.recorded_by_name,
      recordedAt: visit.recorded_at,
    })));
  });

  app.get('/api/clinic/inventory', requireRoles(...CLINIC_MANAGER_ROLES), (req, res) => {
    const schoolId = resolveSchoolId(req);
    const inventory = db.prepare(`
      SELECT ci.*, u.name as updated_by_name
      FROM clinic_inventory ci
      LEFT JOIN users u ON u.id = ci.updated_by_user_id
      WHERE ci.school_id = ?
      ORDER BY ci.item_name ASC
    `).all(schoolId) as any[];

    res.json(inventory.map((item) => ({
      id: item.id,
      itemName: item.item_name,
      category: item.category,
      dosageForm: item.dosage_form,
      stockQuantity: item.stock_quantity,
      unitLabel: item.unit_label,
      reorderLevel: item.reorder_level,
      expiryDate: item.expiry_date,
      status: item.status,
      updatedBy: item.updated_by_name,
      updatedAt: item.updated_at,
      lowStock: Number(item.stock_quantity) <= Number(item.reorder_level),
    })));
  });

  app.get('/api/clinic/appointments', requireRoles(...CLINIC_USER_ROLES), (req, res) => {
    const scope = getClinicScope(req);
    let appointments = db.prepare(`
      SELECT
        ca.*,
        patient.name AS patient_name,
        patient.role AS patient_role,
        assignee.name AS assigned_to_name,
        requester.name AS requested_by_name
      FROM clinic_appointments ca
      JOIN users patient ON patient.id = ca.patient_user_id
      LEFT JOIN users assignee ON assignee.id = ca.assigned_to_user_id
      LEFT JOIN users requester ON requester.id = ca.requested_by_user_id
      WHERE ca.school_id = ?
      ORDER BY datetime(ca.scheduled_for) ASC
    `).all(scope.schoolId) as any[];

    appointments = applyClinicScope(appointments, scope.allowedUserIds, 'patient_user_id');

    res.json(appointments.map((appointment) => ({
      id: appointment.id,
      patientUserId: appointment.patient_user_id,
      patientName: appointment.patient_name,
      patientRole: appointment.patient_role,
      assignedTo: appointment.assigned_to_name,
      requestedBy: appointment.requested_by_name,
      reason: appointment.reason,
      scheduledFor: appointment.scheduled_for,
      status: appointment.status,
      notes: appointment.notes,
      createdAt: appointment.created_at,
    })));
  });

  app.post('/api/clinic/visits', requireRoles(...CLINIC_MANAGER_ROLES), (req, res) => {
    const schoolId = resolveSchoolId(req);
    const actor = resolveActor(req);
    const { patient_user_id, complaint, symptoms, diagnosis, treatment_administered, medications, vitals, outcome, case_status, triage_level, follow_up_date, referral_notes } = req.body || {};

    if (!patient_user_id || !complaint || !treatment_administered) {
      return res.status(400).json({ error: 'patient_user_id, complaint, and treatment_administered are required' });
    }

    const patient = db.prepare('SELECT id FROM users WHERE id = ? AND school_id = ?').get(patient_user_id, schoolId) as { id?: string } | undefined;
    if (!patient?.id) return res.status(404).json({ error: 'Patient not found for this school' });

    const id = makeId('clinic_visit');
    db.prepare(`
      INSERT INTO clinic_visits (
        id, school_id, patient_user_id, recorded_by_user_id, complaint, symptoms, diagnosis, treatment_administered,
        medications_json, vitals_json, outcome, case_status, triage_level, follow_up_date, referral_notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      schoolId,
      patient_user_id,
      actor.id,
      complaint,
      symptoms || null,
      diagnosis || null,
      treatment_administered,
      JSON.stringify(Array.isArray(medications) ? medications : []),
      JSON.stringify(vitals && typeof vitals === 'object' ? vitals : {}),
      outcome || 'Returned to class',
      case_status || 'Open',
      triage_level || 'Routine',
      follow_up_date || null,
      referral_notes || null,
    );

    res.json({ id, status: 'created' });
  });

  app.post('/api/clinic/appointments', requireRoles(...CLINIC_USER_ROLES), (req, res) => {
    const schoolId = resolveSchoolId(req);
    const scope = getClinicScope(req);
    const { patient_user_id, reason, scheduled_for, notes } = req.body || {};
    const requestedPatientId = patient_user_id || scope.viewerUserId;

    if (!requestedPatientId || !reason || !scheduled_for) {
      return res.status(400).json({ error: 'patient_user_id, reason, and scheduled_for are required' });
    }

    if (!scope.canManage && scope.allowedUserIds && !scope.allowedUserIds.includes(requestedPatientId)) {
      return res.status(403).json({ error: 'You can only schedule appointments for your own clinic access scope' });
    }

    const assignedOfficer = (db.prepare('SELECT id FROM users WHERE school_id = ? AND role = ? ORDER BY id LIMIT 1').get(schoolId, 'Clinic Officer') as { id?: string } | undefined)?.id || null;
    const id = makeId('clinic_appt');
    db.prepare(`
      INSERT INTO clinic_appointments (id, school_id, patient_user_id, requested_by_user_id, assigned_to_user_id, reason, scheduled_for, status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, schoolId, requestedPatientId, scope.viewerUserId, assignedOfficer, reason, scheduled_for, 'Scheduled', notes || null);

    res.json({ id, status: 'created' });
  });

  app.post('/api/clinic/inventory/:id/adjust', requireRoles(...CLINIC_MANAGER_ROLES), (req, res) => {
    const schoolId = resolveSchoolId(req);
    const actor = resolveActor(req);
    const { delta } = req.body || {};
    const change = Number(delta);
    if (!Number.isFinite(change)) return res.status(400).json({ error: 'delta must be a valid number' });

    const item = db.prepare('SELECT stock_quantity, reorder_level FROM clinic_inventory WHERE id = ? AND school_id = ?').get(req.params.id, schoolId) as { stock_quantity?: number; reorder_level?: number } | undefined;
    if (!item) return res.status(404).json({ error: 'Inventory item not found' });

    const nextStock = Math.max(0, Number(item.stock_quantity || 0) + change);
    const status = nextStock <= Number(item.reorder_level || 0) ? 'Low Stock' : 'In Stock';
    db.prepare('UPDATE clinic_inventory SET stock_quantity = ?, status = ?, updated_by_user_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND school_id = ?')
      .run(nextStock, status, actor.id, req.params.id, schoolId);

    res.json({ id: req.params.id, stockQuantity: nextStock, status });
  });

  app.get("/api/classes", (req, res) => {
    const schoolId = resolveSchoolId(req);
    const classes = db.prepare(`
      SELECT c.*, t_u.name as teacher_name 
      FROM classes c
      LEFT JOIN teachers t ON c.teacher_id = t.id
      LEFT JOIN users t_u ON t.user_id = t_u.id
      WHERE c.school_id = ?
      ORDER BY c.rowid DESC
    `).all(schoolId);
    res.json(classes);
  });

  app.get('/api/dashboard/summary', (req, res) => {
    try {
      const schoolId = resolveSchoolId(req);
      const actor = resolveActor(req);
      const role = actor.role || ((req as any).user?.activeRole || (req as any).user?.roles?.[0] || 'Guest');
      const studentId = resolveStudentId(req);

      const subjectsQuery = studentId
        ? `
            SELECT COUNT(DISTINCT s.id) as count
            FROM classroom_subjects s
            INNER JOIN classroom_subject_enrollments e ON e.subject_id = s.id
            WHERE s.school_id = ? AND e.student_id = ?
          `
        : 'SELECT COUNT(*) as count FROM classroom_subjects WHERE school_id = ?';
      const subjectsCount = studentId
        ? (db.prepare(subjectsQuery).get(schoolId, studentId) as { count?: number } | undefined)
        : (db.prepare(subjectsQuery).get(schoolId) as { count?: number } | undefined);

      const liveSessions = db.prepare(`
        SELECT id, title, mode, schedule, duration, attendees, limit_count as attendee_limit, hosts_json, tools_json, note
        FROM classroom_live_sessions
        WHERE school_id = ?
        ORDER BY datetime(created_at) DESC, rowid DESC
        LIMIT 4
      `).all(schoolId) as any[];

      const announcements = db.prepare(`
        SELECT id, title, content, created_at
        FROM announcements
        WHERE school_id = ?
        ORDER BY datetime(created_at) DESC, rowid DESC
        LIMIT 4
      `).all(schoolId) as any[];

      const lessonPlans = db.prepare('SELECT COUNT(*) as count FROM lesson_plans WHERE school_id = ?').get(schoolId) as { count?: number } | undefined;

      if (role === 'Student') {
        const assignments = db.prepare(`
          SELECT a.id, a.title, a.subject, a.due, COALESCE(s.status, 'Not started') as submission_status
          FROM classroom_assignments a
          LEFT JOIN classroom_assignment_submissions s ON s.assignment_id = a.id AND s.student_id = ?
          WHERE a.school_id = ?
          ORDER BY datetime(a.created_at) DESC, a.rowid DESC
          LIMIT 6
        `).all(studentId || actor.id, schoolId) as any[];
        const resultRecord = studentId
          ? db.prepare('SELECT data_json FROM classroom_result_records WHERE school_id = ? AND student_id = ? ORDER BY created_at DESC LIMIT 1').get(schoolId, studentId) as { data_json?: string } | undefined
          : undefined;
        const sessions = safeParseJson(resultRecord?.data_json, { sessions: [] as any[] }).sessions || [];
        const latestTerm = sessions?.[0]?.terms?.[0];

        return res.json({
          role,
          student: {
            assignments: assignments.map((assignment) => ({
              id: assignment.id,
              title: assignment.title,
              subject: assignment.subject,
              due: assignment.due,
              status: assignment.submission_status,
            })),
            stats: {
              subjectCount: Number(subjectsCount?.count || 0),
              pendingAssignments: assignments.filter((assignment) => assignment.submission_status !== 'Submitted').length,
              submittedAssignments: assignments.filter((assignment) => assignment.submission_status === 'Submitted').length,
              liveClassCount: liveSessions.length,
              latestAverage: latestTerm?.summary?.average || '—',
            },
            announcements: announcements.map((item) => ({ id: item.id, title: item.title, detail: item.content || '', createdAt: item.created_at })),
            liveClasses: liveSessions.map((session) => ({
              id: session.id,
              title: session.title,
              schedule: session.schedule,
              attendees: Number(session.attendees || 0),
              limit: Number(session.attendee_limit || 300),
              tools: safeParseJson<string[]>(session.tools_json, []),
            })),
          },
        });
      }

      if (role === 'Teacher' || role === 'School Admin' || role === 'HoS' || role === 'HOS') {
        const teacherAssignments = db.prepare(`
          SELECT a.id, a.title, a.subject, a.class_name, a.due,
                 COUNT(s.id) as submission_count,
                 SUM(CASE WHEN s.status = 'Submitted' THEN 1 ELSE 0 END) as submitted_count
          FROM classroom_assignments a
          LEFT JOIN classroom_assignment_submissions s ON s.assignment_id = a.id
          WHERE a.school_id = ? AND (a.teacher_id = ? OR ? IN ('School Admin', 'HoS', 'HOS'))
          GROUP BY a.id
          ORDER BY datetime(a.created_at) DESC, a.rowid DESC
          LIMIT 6
        `).all(schoolId, actor.id, role) as any[];

        const teacherSubjects = db.prepare(`
          SELECT id, name, class_name, code, teacher_name, curriculum_json
          FROM classroom_subjects s
          LEFT JOIN classroom_curriculum cc ON cc.subject_id = s.id
          WHERE s.school_id = ? AND (s.teacher_id = ? OR ? IN ('School Admin', 'HoS', 'HOS'))
          ORDER BY datetime(s.created_at) DESC, s.rowid DESC
          LIMIT 6
        `).all(schoolId, actor.id, role) as any[];

        const pendingSubmissions = db.prepare(`
          SELECT COUNT(*) as count
          FROM classroom_assignment_submissions s
          INNER JOIN classroom_assignments a ON a.id = s.assignment_id
          WHERE a.school_id = ? AND s.status = 'Submitted' AND (a.teacher_id = ? OR ? IN ('School Admin', 'HoS', 'HOS'))
        `).get(schoolId, actor.id, role) as { count?: number } | undefined;

        return res.json({
          role,
          teacher: {
            stats: {
              classCount: Number((db.prepare('SELECT COUNT(*) as count FROM classes WHERE school_id = ?').get(schoolId) as { count?: number } | undefined)?.count || 0),
              subjectCount: teacherSubjects.length,
              assignmentCount: teacherAssignments.length,
              pendingGrading: Number(pendingSubmissions?.count || 0),
              lessonPlanCount: Number(lessonPlans?.count || 0),
              liveClassCount: liveSessions.length,
            },
            assignments: teacherAssignments.map((assignment) => ({
              id: assignment.id,
              title: assignment.title,
              subject: assignment.subject,
              className: assignment.class_name,
              due: assignment.due,
              submissions: Number(assignment.submission_count || 0),
              submitted: Number(assignment.submitted_count || 0),
            })),
            subjects: teacherSubjects.map((subject) => {
              const curriculum = safeParseJson<Record<'term1' | 'term2' | 'term3', any[]>>(subject.curriculum_json, { term1: [], term2: [], term3: [] });
              const totalTopics = (['term1', 'term2', 'term3'] as const).reduce((count, term) => count + (Array.isArray(curriculum?.[term]) ? curriculum[term].length : 0), 0);
              return {
                id: subject.id,
                name: subject.name,
                code: subject.code,
                className: subject.class_name,
                teacherName: subject.teacher_name,
                topicCount: totalTopics,
              };
            }),
            liveClasses: liveSessions.map((session) => ({
              id: session.id,
              title: session.title,
              schedule: session.schedule,
              attendees: Number(session.attendees || 0),
              limit: Number(session.attendee_limit || 300),
              mode: session.mode,
            })),
            announcements: announcements.map((item) => ({ id: item.id, title: item.title, detail: item.content || '', createdAt: item.created_at })),
          },
        });
      }

      const staffTrainingPending = db.prepare(`
        SELECT COUNT(*) as count
        FROM staff_training_materials m
        LEFT JOIN staff_training_completions c ON c.material_id = m.id AND c.user_id = ?
        WHERE m.school_id = ? AND m.required_completion = 1 AND c.id IS NULL
      `).get(actor.id, schoolId) as { count?: number } | undefined;

      return res.json({
        role,
        generic: {
          stats: {
            subjectCount: Number(subjectsCount?.count || 0),
            liveClassCount: liveSessions.length,
            announcementCount: announcements.length,
            lessonPlanCount: Number(lessonPlans?.count || 0),
            pendingTraining: Number(staffTrainingPending?.count || 0),
          },
          announcements: announcements.map((item) => ({ id: item.id, title: item.title, detail: item.content || '', createdAt: item.created_at })),
        },
      });
    } catch (err) {
      console.error('dashboard summary error', err);
      return res.status(500).json({ error: String(err) });
    }
  });

  app.post('/api/classes', requireRoles('Teacher', 'HoS', 'HoS'), (req, res) => {
    const { name, level, section, teacher_id } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    const schoolId = resolveSchoolId(req);
    const resolvedSection = section || inferClassSection(level, name);
    const duplicate = db.prepare('SELECT id FROM classes WHERE school_id = ? AND COALESCE(section, ?) = ? AND LOWER(TRIM(name)) = ? AND LOWER(COALESCE(TRIM(level), "")) = LOWER(COALESCE(TRIM(?), "")) LIMIT 1')
      .get(schoolId, resolvedSection, resolvedSection, normalizeSubjectName(name), level || null) as { id?: string } | undefined;
    if (duplicate?.id) return res.status(409).json({ error: 'This class already exists for the selected school section.' });
    const id = makeId('class');
    db.prepare('INSERT INTO classes (id, school_id, name, level, section, teacher_id) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, schoolId, name, level || null, resolvedSection, teacher_id || null);
    res.json({ id, status: 'created' });
  });

  app.get("/api/announcements", (req, res) => {
    const announcements = db.prepare("SELECT * FROM announcements ORDER BY created_at DESC").all();
    res.json(announcements);
  });

  app.post("/api/announcements", (req, res) => {
    const { school_id, title, content, role_visibility } = req.body;
    const id = `ann_${Date.now()}`;
    db.prepare("INSERT INTO announcements (id, school_id, title, content, role_visibility) VALUES (?, ?, ?, ?, ?)")
      .run(id, school_id || 'school_1', title, content, role_visibility);
    res.json({ id, status: 'success' });
  });

  // Public contact form endpoint
  app.post('/api/contact', express.json(), (req, res) => {
    try {
      const { name, email, message, school_id } = req.body as { name?: string; email?: string; message?: string; school_id?: string };
      if (!email || !message) return res.status(400).json({ error: 'email and message required' });
      const id = `c_${Date.now()}`;
      db.prepare('INSERT INTO contact_messages (id, school_id, name, email, message) VALUES (?, ?, ?, ?, ?)')
        .run(id, school_id || 'school_1', name || null, email, message);
      return res.json({ ok: true, id });
    } catch (err) {
      console.error('contact save error', err);
      return res.status(500).json({ error: String(err) });
    }
  });

  // Lesson Notes
  app.get('/api/notes', (req, res) => {
    const notes = db.prepare('SELECT * FROM lesson_notes ORDER BY created_at DESC').all();
    res.json(notes);
  });

  app.get('/api/lesson-plans', (req, res) => {
    try {
      const schoolId = typeof req.query.school_id === 'string' ? req.query.school_id : req.header('x-school-id') || 'school_1';
      const plans = db.prepare('SELECT * FROM lesson_plans WHERE school_id = ? ORDER BY created_at DESC').all(schoolId) as any[];
      res.json(plans.map((plan) => ({
        id: plan.id,
        topic: plan.topic,
        subject: plan.subject,
        week: plan.week,
        status: plan.status,
        visibility: plan.visibility,
        liveClass: Boolean(plan.live_class),
        liveClassMode: plan.live_class_mode,
        objectives: plan.objectives,
        materials: plan.materials,
        activities: plan.activities,
        assessment: plan.assessment,
        notes: plan.notes,
        createdAt: plan.created_at,
      })));
    } catch (err) {
      console.error('lesson plans fetch error', err);
      res.status(500).json({ error: String(err) });
    }
  });

  app.post('/api/lesson-plans', requireRoles('Teacher', 'HoS', 'HOS', 'School Admin'), (req, res) => {
    try {
      const user = (req as any).user;
      const schoolId = req.body?.school_id || user?.school_id || 'school_1';
      const { topic, subject, week, objectives, materials, activities, assessment, notes, visibility, releaseAt, liveClassMode } = req.body || {};
      if (!topic || !subject || !week) return res.status(400).json({ error: 'topic, subject, and week are required' });
      const id = `plan_${Date.now()}`;
      const normalizedVisibility = typeof visibility === 'string' && visibility.trim() ? visibility : 'Draft only';
      const status = normalizedVisibility === 'Draft only' ? 'Draft' : 'Published';
      const liveClass = typeof liveClassMode === 'string' && liveClassMode !== 'Attach later' ? 1 : 0;
      db.prepare('INSERT INTO lesson_plans (id, school_id, topic, subject, week, status, visibility, release_at, live_class_mode, objectives, materials, activities, assessment, notes, live_class, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(id, schoolId, topic, subject, Number(week), status, normalizedVisibility, releaseAt || null, liveClassMode || null, objectives || null, materials || null, activities || null, assessment || null, notes || null, liveClass, user?.id || null);
      res.json({ id, status: 'success' });
    } catch (err) {
      console.error('lesson plan save error', err);
      res.status(500).json({ error: String(err) });
    }
  });

  app.post('/api/notes', requireRoles('Teacher', 'HoS'), (req, res) => {
    const user = (req as any).user;
    const { school_id, title, subject, content, week, visibility } = req.body;
    if (!title) return res.status(400).json({ error: 'title required' });
    const id = `note_${Date.now()}`;
    db.prepare('INSERT INTO lesson_notes (id, school_id, title, subject, content, week, visibility, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(id, school_id || (user && user.school_id) || 'school_1', title, subject || null, content || null, week || null, visibility || null, (user && user.id) || null);
    res.json({ id, status: 'success' });
  });

  app.get('/api/classroom/feed', (req, res) => {
    const schoolId = typeof req.query.school_id === 'string' ? req.query.school_id : req.header('x-school-id') || 'school_1';
    const user = (req as any).user;
    const posts = db.prepare("SELECT * FROM classroom_feed_posts WHERE school_id = ? AND COALESCE(scope, 'classroom') = 'classroom' ORDER BY pinned DESC, created_at ASC").all(schoolId) as any[];
    const comments = db.prepare('SELECT * FROM classroom_feed_comments ORDER BY created_at ASC').all() as any[];
    const reactions = db.prepare('SELECT post_id, emoji, COUNT(*) as total FROM classroom_feed_reactions GROUP BY post_id, emoji').all() as Array<{ post_id: string; emoji: string; total: number }>;
    const viewerReactions = user?.id
      ? db.prepare('SELECT post_id, emoji FROM classroom_feed_reactions WHERE user_id = ?').all(user.id) as Array<{ post_id: string; emoji: string }>
      : [];

    const result = posts.map((post) => {
      const postComments = comments.filter((comment) => comment.post_id === post.id && !comment.parent_comment_id);
      return {
        id: post.id,
        author: post.author_name,
        role: post.author_role,
        time: new Date(post.created_at).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }),
        body: post.body,
        pinned: Boolean(post.pinned),
        attachments: mapClassroomAttachmentsForResponse(schoolId, safeParseJson(post.attachments_json, [])),
        viewerReaction: viewerReactions.find((reaction) => reaction.post_id === post.id)?.emoji || null,
        likes: reactions.filter((reaction) => reaction.post_id === post.id && reaction.emoji === '👍').reduce((sum, reaction) => sum + reaction.total, 0),
        dislikes: reactions.filter((reaction) => reaction.post_id === post.id && reaction.emoji === '👎').reduce((sum, reaction) => sum + reaction.total, 0),
        comments: postComments.map((comment) => ({
          id: comment.id,
          author: comment.author_name,
          role: comment.author_role,
          text: comment.text,
          likes: comment.likes || 0,
          replies: comments
            .filter((reply) => reply.parent_comment_id === comment.id)
            .map((reply) => ({ id: reply.id, author: reply.author_name, role: reply.author_role, text: reply.text })),
        })),
      };
    });

    res.json(result);
  });

  app.post('/api/classroom/feed', requireRoles('Teacher', 'Student', 'HoS', 'Parent', 'HoS'), (req, res) => {
    const actor = resolveActor(req);
    const { body, class_id, attachments } = req.body;
    if (!body && (!Array.isArray(attachments) || attachments.length === 0)) return res.status(400).json({ error: 'body or attachments required' });
    const id = makeId('feed');
    db.prepare('INSERT INTO classroom_feed_posts (id, school_id, class_id, author_id, author_name, author_role, body, pinned, attachments_json, scope, session_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(id, resolveSchoolId(req), class_id || 'class_1', actor.id, actor.name, actor.role, body || '', actor.role === 'Teacher' || actor.role === 'HoS' ? 1 : 0, JSON.stringify(Array.isArray(attachments) ? attachments : []), 'classroom', getAcademicSessionKey());
    res.json({ id, status: 'created' });
  });

  app.get('/api/classroom/subjects/:subjectId/feed', async (req, res) => {
    const schoolId = typeof req.query.school_id === 'string' ? req.query.school_id : req.header('x-school-id') || 'school_1';
    const subjectId = String(req.params.subjectId || '').trim();
    const user = (req as any).user;
    if (!subjectId) return res.status(400).json({ error: 'subjectId required' });

    await pruneSubjectFeedForNewSession(String(schoolId), subjectId);

    const posts = db.prepare(`
      SELECT * FROM classroom_feed_posts
      WHERE school_id = ?
        AND subject_id = ?
        AND COALESCE(scope, 'classroom') = 'subject'
        AND COALESCE(session_key, 'legacy') = ?
      ORDER BY pinned DESC, created_at ASC
    `).all(schoolId, subjectId, getAcademicSessionKey()) as any[];
    const comments = db.prepare('SELECT * FROM classroom_feed_comments ORDER BY created_at ASC').all() as any[];
    const reactions = db.prepare('SELECT post_id, emoji, COUNT(*) as total FROM classroom_feed_reactions GROUP BY post_id, emoji').all() as Array<{ post_id: string; emoji: string; total: number }>;
    const viewerReactions = user?.id
      ? db.prepare('SELECT post_id, emoji FROM classroom_feed_reactions WHERE user_id = ?').all(user.id) as Array<{ post_id: string; emoji: string }>
      : [];

    const result = posts.map((post) => {
      const postComments = comments.filter((comment) => comment.post_id === post.id && !comment.parent_comment_id);
      return {
        id: post.id,
        author: post.author_name,
        role: post.author_role,
        time: new Date(post.created_at).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }),
        body: post.body,
        pinned: Boolean(post.pinned),
        attachments: mapClassroomAttachmentsForResponse(String(schoolId), safeParseJson(post.attachments_json, [])),
        viewerReaction: viewerReactions.find((reaction) => reaction.post_id === post.id)?.emoji || null,
        likes: reactions.filter((reaction) => reaction.post_id === post.id && reaction.emoji === '👍').reduce((sum, reaction) => sum + reaction.total, 0),
        dislikes: reactions.filter((reaction) => reaction.post_id === post.id && reaction.emoji === '👎').reduce((sum, reaction) => sum + reaction.total, 0),
        comments: postComments.map((comment) => ({
          id: comment.id,
          author: comment.author_name,
          role: comment.author_role,
          text: comment.text,
          likes: comment.likes || 0,
          replies: comments
            .filter((reply) => reply.parent_comment_id === comment.id)
            .map((reply) => ({ id: reply.id, author: reply.author_name, role: reply.author_role, text: reply.text })),
        })),
      };
    });

    res.json(result);
  });

  app.post('/api/classroom/subjects/:subjectId/feed', requireRoles('Teacher', 'Student', 'HoS', 'Parent', 'HoS'), async (req, res) => {
    const actor = resolveActor(req);
    const { body, class_id, attachments } = req.body;
    const subjectId = String(req.params.subjectId || '').trim();
    if (!subjectId) return res.status(400).json({ error: 'subjectId required' });
    if (!body && (!Array.isArray(attachments) || attachments.length === 0)) return res.status(400).json({ error: 'body or attachments required' });

    await pruneSubjectFeedForNewSession(resolveSchoolId(req), subjectId);

    const id = makeId('subject_feed');
    db.prepare('INSERT INTO classroom_feed_posts (id, school_id, class_id, subject_id, author_id, author_name, author_role, body, pinned, attachments_json, scope, session_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(id, resolveSchoolId(req), class_id || 'class_1', subjectId, actor.id, actor.name, actor.role, body || '', actor.role === 'Teacher' || actor.role === 'HoS' ? 1 : 0, JSON.stringify(Array.isArray(attachments) ? attachments : []), 'subject', getAcademicSessionKey());
    res.json({ id, status: 'created' });
  });

  app.post('/api/classroom/feed/:postId/comments', requireRoles('Teacher', 'Student', 'HoS', 'Parent', 'HoS'), (req, res) => {
    const actor = resolveActor(req);
    const { text, parentCommentId } = req.body;
    if (!text) return res.status(400).json({ error: 'text required' });
    const id = makeId('feed_comment');
    db.prepare('INSERT INTO classroom_feed_comments (id, post_id, parent_comment_id, author_id, author_name, author_role, text, likes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(id, req.params.postId, parentCommentId || null, actor.id, actor.name, actor.role, text, 0);
    res.json({ id, status: 'created' });
  });

  app.post('/api/classroom/feed/:postId/reactions', requireRoles('Teacher', 'Student', 'HoS', 'Parent', 'HoS'), (req, res) => {
    const user = (req as any).user;
    if (!user?.id) return res.status(401).json({ error: 'Unauthenticated' });
    const { emoji } = req.body;
    if (!emoji) return res.status(400).json({ error: 'emoji required' });
    const exists = db.prepare('SELECT id, emoji FROM classroom_feed_reactions WHERE post_id = ? AND user_id = ?').get(req.params.postId, user.id) as { id?: string; emoji?: string } | undefined;
    if (exists?.id) {
      if (exists.emoji === emoji) {
        db.prepare('DELETE FROM classroom_feed_reactions WHERE id = ?').run(exists.id);
        return res.json({ id: exists.id, status: 'removed' });
      }
      db.prepare('UPDATE classroom_feed_reactions SET emoji = ? WHERE id = ?').run(emoji, exists.id);
      return res.json({ id: exists.id, status: 'updated' });
    }
    const id = makeId('feed_reaction');
    db.prepare('INSERT INTO classroom_feed_reactions (id, post_id, user_id, emoji) VALUES (?, ?, ?, ?)').run(id, req.params.postId, user.id, emoji);
    res.json({ id, status: 'created' });
  });

  app.post('/api/classroom/feed/:postId/pin', requireRoles('Teacher', 'HoS', 'HoS'), (req, res) => {
    const { pinned } = req.body;
    db.prepare('UPDATE classroom_feed_posts SET pinned = ? WHERE id = ?').run(pinned ? 1 : 0, req.params.postId);
    res.json({ ok: true, pinned: Boolean(pinned) });
  });

  app.get('/api/classroom/assignments', (req, res) => {
    const schoolId = req.query.school_id || req.header('x-school-id') || 'school_1';
    const user = (req as any).user;
    const actorRole = user?.activeRole || user?.roles?.[0] || 'Guest';
    const assignments = db.prepare('SELECT * FROM classroom_assignments WHERE school_id = ? ORDER BY created_at DESC').all(schoolId) as any[];
    const comments = db.prepare('SELECT * FROM classroom_assignment_comments ORDER BY created_at ASC').all() as any[];
    const messages = db.prepare('SELECT * FROM classroom_assignment_private_messages ORDER BY created_at ASC').all() as any[];
    const submissions = user?.id ? db.prepare('SELECT * FROM classroom_assignment_submissions WHERE student_id = ?').all(resolveStudentId(req) || user.id) as any[] : [];
    // Teachers receive the full submission roster so assignment flow stays connected end to end.
    const submissionRoster = actorRole === 'Teacher' || actorRole === 'HoS' || actorRole === 'HoS'
      ? db.prepare(`
        SELECT cas.*, COALESCE(u.name, cas.student_id) as student_name
        FROM classroom_assignment_submissions cas
        LEFT JOIN students s ON s.id = cas.student_id
        LEFT JOIN users u ON u.id = s.user_id
      `).all() as any[]
      : [];

    const result = assignments.map((assignment) => ({
      id: assignment.id,
      title: assignment.title,
      subject: assignment.subject,
      className: assignment.class_name,
      due: assignment.due,
      status: assignment.status,
      allowComments: Boolean(assignment.allow_comments),
      allowTeacherChat: Boolean(assignment.allow_teacher_chat),
      score: assignment.score,
      teacherFeedback: assignment.teacher_feedback || '',
      types: safeParseJson<string[]>(assignment.types_json, []),
      shuffledNotice: assignment.shuffled_notice || '',
      sections: safeParseJson<any[]>(assignment.sections_json, []),
      comments: comments.filter((comment) => comment.assignment_id === assignment.id).map((comment) => ({
        id: comment.id,
        author: comment.author_name,
        text: comment.text,
        likes: comment.likes || 0,
      })),
      privateThread: messages
        .filter((message) => message.assignment_id === assignment.id)
        .filter((message) => actorRole === 'Teacher' || actorRole === 'HoS' || message.user_id === (resolveStudentId(req) || user?.id))
        .map((message) => ({ id: message.id, from: message.sender_role, text: message.text })),
      submissionList: submissionRoster
        .filter((submission) => submission.assignment_id === assignment.id)
        .map((submission) => ({
          id: submission.id,
          studentId: submission.student_id,
          studentName: submission.student_name,
          status: submission.status,
          submittedAt: submission.submitted_at,
          updatedAt: submission.updated_at,
        })),
      submission: submissions.find((submission) => submission.assignment_id === assignment.id)
        ? {
            id: submissions.find((submission) => submission.assignment_id === assignment.id).id,
            status: submissions.find((submission) => submission.assignment_id === assignment.id).status,
            answers: safeParseJson<Record<string, string>>(submissions.find((submission) => submission.assignment_id === assignment.id).answers_json, {}),
            submittedAt: submissions.find((submission) => submission.assignment_id === assignment.id).submitted_at,
            updatedAt: submissions.find((submission) => submission.assignment_id === assignment.id).updated_at,
          }
        : null,
    }));

    res.json(result);
  });

  app.post('/api/classroom/assignments', requireRoles('Teacher', 'HoS', 'HoS'), (req, res) => {
    const actor = resolveActor(req);
    const { title, subject, className, due, questions, description } = req.body;
    if (!title) return res.status(400).json({ error: 'title required' });
    const id = makeId('assign');
    const classRow = db.prepare('SELECT id FROM classes WHERE name = ? LIMIT 1').get(className || 'JSS 1 Gold') as { id?: string } | undefined;
    
    // Wrap flat questions into a section if provided, otherwise use default
    const sections = questions && questions.length > 0 ? [
      {
        type: 'Mixed',
        title: 'Assignment Questions',
        instructions: description || 'Answer the following questions.',
        questions: questions
      }
    ] : [
      {
        type: 'Multiple Choice',
        title: 'Starter Questions',
        instructions: 'Teachers can keep editing this structure while the backend stores the latest version.',
        questions: [
          { no: 1, stem: 'Add your first question after creation.', options: ['Option A', 'Option B', 'Option C', 'Option D'], answer: 'Option A' },
        ],
      },
      {
        type: 'Essay',
        title: 'Long Response',
        prompt: 'Add the deeper teacher prompt here after the assignment is created.',
      },
    ];

    db.prepare('INSERT INTO classroom_assignments (id, school_id, class_id, class_name, teacher_id, title, subject, due, status, allow_comments, allow_teacher_chat, score, teacher_feedback, types_json, shuffled_notice, sections_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(id, resolveSchoolId(req), classRow?.id || 'class_1', className || 'JSS 1 Gold', actor.id, title, subject || 'General Studies', due || 'TBD', 'Draft', 1, 1, 'Pending', 'New assignment created. Continue editing questions and answer keys.', JSON.stringify(['Multiple Choice', 'Essay']), 'Question order can be shuffled per learner while one grading map stays intact.', JSON.stringify(sections));
    res.json({ id, status: 'created', assignment: { id, title, due, sections } });
  });

  app.post('/api/classroom/assignments/:assignmentId/comments', requireRoles('Teacher', 'Student', 'HoS', 'Parent', 'HoS'), (req, res) => {
    const actor = resolveActor(req);
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'text required' });
    const id = makeId('assign_comment');
    db.prepare('INSERT INTO classroom_assignment_comments (id, assignment_id, author_id, author_name, author_role, text, likes) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(id, req.params.assignmentId, actor.id, actor.name, actor.role, text, 0);
    res.json({ id, status: 'created' });
  });

  app.post('/api/classroom/assignments/:assignmentId/private-thread', requireRoles('Teacher', 'Student', 'HoS', 'HoS'), (req, res) => {
    const actor = resolveActor(req);
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'text required' });
    const id = makeId('assign_message');
    db.prepare('INSERT INTO classroom_assignment_private_messages (id, assignment_id, user_id, sender_role, text) VALUES (?, ?, ?, ?, ?)')
      .run(id, req.params.assignmentId, resolveStudentId(req) || actor.id, actor.role, text);
    res.json({ id, status: 'created' });
  });

  app.post('/api/classroom/assignments/:assignmentId/submission', requireRoles('Teacher', 'Student', 'HoS', 'HoS'), (req, res) => {
    const studentId = resolveStudentId(req) || (req as any).user?.id;
    if (!studentId) return res.status(401).json({ error: 'Unauthenticated' });
    const { answers, status } = req.body;
    const existing = db.prepare('SELECT id FROM classroom_assignment_submissions WHERE assignment_id = ? AND student_id = ?').get(req.params.assignmentId, studentId) as { id?: string } | undefined;
    const submittedAt = status === 'Submitted' ? new Date().toISOString() : null;
    if (existing?.id) {
      db.prepare('UPDATE classroom_assignment_submissions SET answers_json = ?, status = ?, submitted_at = COALESCE(?, submitted_at), updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(JSON.stringify(answers || {}), status || 'Draft', submittedAt, existing.id);
      return res.json({ id: existing.id, status: 'updated' });
    }
    const id = makeId('submission');
    db.prepare('INSERT INTO classroom_assignment_submissions (id, assignment_id, student_id, answers_json, status, submitted_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, req.params.assignmentId, studentId, JSON.stringify(answers || {}), status || 'Draft', submittedAt);
    res.json({ id, status: 'created' });
  });

  app.get('/api/classroom/notes', (req, res) => {
    const schoolId = req.query.school_id || req.header('x-school-id') || 'school_1';
    const notes = db.prepare('SELECT * FROM classroom_notes WHERE school_id = ? ORDER BY created_at DESC').all(schoolId) as any[];
    res.json(notes.map((note) => mapClassroomNoteForResponse(String(schoolId), note)));
  });

  app.post('/api/classroom/notes', requireRoles('Teacher', 'HoS', 'HoS'), (req, res) => {
    const actor = resolveActor(req);
    const { title, subject, topic, week, summary, visibility, format, duration, access, viewerType, ndoveraDocument } = req.body;
    const materials = sanitizeClassroomNoteMaterials(req.body?.materials);
    if (!title) return res.status(400).json({ error: 'title required' });

    const safeViewerType = viewerType === 'image' || viewerType === 'audio' || viewerType === 'video' || viewerType === 'pdf' || viewerType === 'document' || viewerType === 'slides' || viewerType === 'ndovera-document' || viewerType === 'mixed'
      ? viewerType
      : (materials.length > 1 ? 'mixed' : materials[0]?.viewerType || (ndoveraDocument ? 'ndovera-document' : null));
    const primaryMaterial = materials[0] || null;
    const id = makeId('note');
    db.prepare('INSERT INTO classroom_notes (id, school_id, title, subject, topic, week, format, visibility, duration, summary, access, viewer_type, mime_type, file_name, file_size, storage_key, analytics_json, materials_json, content_json, versions_json, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(
        id,
        resolveSchoolId(req),
        title,
        subject || 'General Studies',
        topic || title,
        week || 1,
        format || (materials.length ? materials.map((material) => material.viewerType).join(' + ') : 'Ndovera Doc'),
        visibility || 'Student-only',
        duration || 'In-app study',
        summary || 'New note created from classroom workspace.',
        access || 'Secure in-app viewer only',
        safeViewerType,
        primaryMaterial?.mimeType || null,
        primaryMaterial?.name || null,
        primaryMaterial?.size || null,
        primaryMaterial?.storageKey || null,
        JSON.stringify({ views: 0, downloads: 0, completion: '0%' }),
        JSON.stringify(materials),
        ndoveraDocument ? JSON.stringify(ndoveraDocument) : null,
        JSON.stringify(['v1 current']),
        actor.id,
      );
    res.json({ id, status: 'created' });
  });

  app.get('/api/classroom/subjects', (req, res) => {
    const schoolId = req.query.school_id || req.header('x-school-id') || 'school_1';
    const requestedClassId = typeof req.query.classId === 'string' ? req.query.classId : '';
    const activeRole = (req as any).user?.activeRole || (req as any).user?.roles?.[0];
    const studentId = resolveStudentId(req);
    let query = `
      SELECT s.*,
        COUNT(DISTINCT e.student_id) as student_count,
        COUNT(DISTINCT n.id) as note_count,
        COUNT(DISTINCT a.id) as assignment_count,
        cc.curriculum_json
      FROM classroom_subjects s
      LEFT JOIN classroom_subject_enrollments e ON e.subject_id = s.id
      LEFT JOIN classroom_notes n ON n.school_id = s.school_id AND n.subject = s.name
      LEFT JOIN classroom_assignments a ON a.school_id = s.school_id AND a.subject = s.name
      LEFT JOIN classroom_curriculum cc ON cc.subject_id = s.id
      WHERE s.school_id = ?`;
    const params: any[] = [schoolId];

    if ((activeRole === 'Student' || activeRole === 'Parent') && studentId) {
      query += ' AND EXISTS (SELECT 1 FROM classroom_subject_enrollments se WHERE se.subject_id = s.id AND se.student_id = ?)';
      params.push(studentId);
    }

    if (requestedClassId) {
      query += ' AND COALESCE(s.class_id, "") = ?';
      params.push(requestedClassId);
    }

    query += ' GROUP BY s.id ORDER BY s.created_at DESC';
    const subjects = db.prepare(query).all(...params) as any[];
    res.json(subjects.map((subject) => ({
      id: subject.id,
      name: subject.name,
      code: subject.code,
      section: subject.section,
      classId: subject.class_id,
      className: subject.class_name,
      teacherId: subject.teacher_id,
      teacherName: subject.teacher_name,
      accent: subject.accent || '#10b981',
      summary: subject.summary || 'Subject stream and resources live here.',
      room: subject.room || 'Main classroom',
      studentCount: Number(subject.student_count || 0),
      noteCount: Number(subject.note_count || 0),
      assignmentCount: Number(subject.assignment_count || 0),
      curriculum: safeParseJson(subject.curriculum_json, { term1: [], term2: [], term3: [] }),
    })));
  });

  app.post('/api/classroom/subjects', requireRoles('HoS', 'School Admin', 'Owner', 'ICT', 'ICT Manager'), (req, res) => {
    const actor = resolveActor(req);
    const { name, code, section, classId, className, accent, summary, room, studentIds } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    const schoolId = resolveSchoolId(req);
    const resolvedSection = section || inferSubjectSection(className);
    const normalizedName = normalizeSubjectName(name);
    const existingSubject = db.prepare('SELECT id FROM classroom_subjects WHERE school_id = ? AND COALESCE(section, ?) = ? AND LOWER(TRIM(name)) = ? LIMIT 1')
      .get(schoolId, resolvedSection, resolvedSection, normalizedName) as { id?: string } | undefined;
    if (existingSubject?.id) {
      return res.status(409).json({ error: 'This subject already exists for the selected school section.' });
    }
    const subjectId = makeId('subject');
    const teacherName = actor.name;
    db.prepare('INSERT INTO classroom_subjects (id, school_id, name, code, section, class_id, class_name, teacher_id, teacher_name, accent, summary, room, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(subjectId, schoolId, name, code || name.slice(0, 3).toUpperCase(), resolvedSection, classId || null, className || null, actor.id, teacherName, accent || '#10b981', summary || `${name} classroom stream and subject resources.`, room || 'Main room', actor.id);

    if (Array.isArray(studentIds)) {
      const insertEnrollment = db.prepare('INSERT INTO classroom_subject_enrollments (id, subject_id, class_id, student_id) VALUES (?, ?, ?, ?)');
      studentIds.forEach((studentId: string) => {
        if (!studentId) return;
        insertEnrollment.run(makeId('sub_enroll'), subjectId, classId || null, studentId);
      });
    }

    res.json({ id: subjectId, status: 'created' });
  });

  app.post('/api/classroom/subjects/:subjectId/assign-student', requireRoles('Teacher', 'HoS', 'HoS'), (req, res) => {
    const { studentId, classId } = req.body;
    if (!studentId) return res.status(400).json({ error: 'studentId required' });
    db.prepare('INSERT INTO classroom_subject_enrollments (id, subject_id, class_id, student_id) VALUES (?, ?, ?, ?)')
      .run(makeId('sub_enroll'), req.params.subjectId, classId || null, studentId);
    res.json({ ok: true });
  });

  app.get('/api/classroom/practice', (req, res) => {
    const schoolId = req.query.school_id || req.header('x-school-id') || 'school_1';
    const practice = db.prepare('SELECT * FROM classroom_practice_sets WHERE school_id IS NULL OR school_id = ? ORDER BY CASE WHEN school_id IS NULL THEN 0 ELSE 1 END, created_at DESC').all(schoolId) as any[];
    res.json(practice.map((item) => ({
      id: item.id,
      source: item.source,
      scope: item.scope,
      subject: item.subject,
      title: item.title,
      level: item.level,
      mode: item.mode,
      reward: item.reward,
      questions: item.question_count,
      note: item.note,
      questionItems: safeParseJson(item.questions_json, []),
    })));
  });

  app.post('/api/classroom/question-bank', requireRoles('Teacher', 'HoS', 'HoS'), (req, res) => {
    const actor = resolveActor(req);
    const { subject, title, level, mode, note, questions } = req.body;
    if (!subject || !title) return res.status(400).json({ error: 'subject and title required' });
    const id = makeId('practice');
    db.prepare('INSERT INTO classroom_practice_sets (id, school_id, source, scope, subject, title, level, mode, reward, question_count, note, questions_json, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(id, resolveSchoolId(req), 'School question bank', 'exam', subject, title, level || null, mode || 'Teacher Curated', 'School-set', Array.isArray(questions) ? questions.length : 0, note || 'Teacher-authored school question bank set.', JSON.stringify(questions || []), actor.id);
    res.json({ id, status: 'created' });
  });

  app.get('/api/classroom/results', (req, res) => {
    const schoolId = req.query.school_id || req.header('x-school-id') || 'school_1';
    const requestedStudentId = req.query.student_id as string | undefined;
    const studentId = requestedStudentId || resolveStudentId(req);
    if (!studentId) return res.json({ sessions: [] });
    const record = db.prepare('SELECT * FROM classroom_result_records WHERE school_id = ? AND student_id = ? ORDER BY created_at DESC LIMIT 1').get(schoolId, studentId) as any;
    if (!record) return res.json({ sessions: [] });
    const parsed = safeParseJson(record.data_json, { sessions: [] as any[] });
    res.json(parsed);
  });

  app.post('/api/classroom/results', requireRoles('Teacher', 'Class Teacher', 'HoS', 'HOS', 'School Admin', 'Owner'), (req, res) => {
    try {
      const schoolId = resolveSchoolId(req);
      const studentId = req.body.student_id as string | undefined;
      const session = (req.body.session as string | undefined) || '2025/2026';
      const data = req.body.data;
      if (!studentId || !data) {
        return res.status(400).json({ error: 'student_id and data are required' });
      }

      const existing = db.prepare('SELECT id FROM classroom_result_records WHERE student_id = ? AND session = ?').get(studentId, session) as { id: string } | undefined;
      const id = existing?.id || makeId('result');
      db.prepare(`
        INSERT INTO classroom_result_records (id, school_id, student_id, session, data_json)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(student_id, session) DO UPDATE SET
          school_id = excluded.school_id,
          data_json = excluded.data_json,
          created_at = CURRENT_TIMESTAMP
      `).run(id, schoolId, studentId, session, JSON.stringify(data));
      res.json({ id, status: 'saved' });
    } catch (error) {
      res.status(500).json({ error: 'Unable to save result record', detail: String(error) });
    }
  });

  app.get('/api/classroom/live-classes', (req, res) => {
    try {
      const schoolId = req.query.school_id || req.header('x-school-id') || 'school_1';
      // console.log('[DEBUG] Fetching live sessions for school:', schoolId);
      const sessions = db.prepare("SELECT * FROM classroom_live_sessions WHERE school_id = ? AND COALESCE(status, 'active') = 'active' ORDER BY created_at DESC").all(schoolId) as any[];
      res.json(sessions.map((session) => ({
        id: session.id,
        title: session.title,
        mode: session.mode,
        schedule: session.schedule,
        duration: session.duration,
        attendees: session.attendees,
        limit: session.limit_count,
        hosts: safeParseJson<string[]>(session.hosts_json, []),
        tools: safeParseJson<string[]>(session.tools_json, []),
        note: session.note,
        meetingUrl: `/live/${session.id}`,
      })));
    } catch (err) {
      console.error('[ERROR] /api/classroom/live-classes:', err);
      res.status(500).json({ error: String(err) });
    }
  });

  app.post('/api/classroom/live-classes', requireRoles('Teacher', 'HoS', 'HOS', 'School Admin', 'ICT Manager', 'Owner'), (req, res) => {
    const actor = resolveActor(req);
    const { title, mode, schedule, duration } = req.body;
    if (!title) return res.status(400).json({ error: 'title required' });
    const schoolId = resolveSchoolId(req);
    const school = db.prepare('SELECT live_class_quota FROM schools WHERE id = ?').get(schoolId) as { live_class_quota?: number } | undefined;
    const liveClassQuota = Math.max(1, Number(school?.live_class_quota || 5));
    const activeSessionCount = db.prepare("SELECT COUNT(*) as count FROM classroom_live_sessions WHERE school_id = ? AND COALESCE(status, 'active') = 'active'").get(schoolId) as { count: number };
    if (activeSessionCount.count >= liveClassQuota) {
      return res.status(409).json({ error: `This school already has ${liveClassQuota} active live classrooms. End one before opening another.` });
    }
    const id = makeId('live');
    db.prepare('INSERT INTO classroom_live_sessions (id, school_id, title, mode, schedule, duration, attendees, limit_count, hosts_json, tools_json, note, status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(id, schoolId, title, mode || 'Student Lesson', schedule || 'TBD', duration || '60 mins', 0, 300, JSON.stringify([actor.name, 'Assistant Host']), JSON.stringify(['Raise hand', 'Screen share', 'Digital backgrounds', 'Moderated live chat', 'Recording for 1 week']), 'If both host and assistant leave, the room will remain active for 30 minutes before auto-ending.', 'active', actor.id);
    res.json({ id, status: 'created', schoolActiveLimit: liveClassQuota, activeCount: activeSessionCount.count + 1 });
  });

  app.post('/api/classroom/live-classes/:sessionId/join', requireRoles('Teacher', 'Student', 'HoS', 'HOS', 'Parent', 'School Admin', 'ICT Manager', 'Owner', 'Finance Officer', 'Librarian', 'Clinic Manager', 'Hostel Manager', 'Tuckshop Manager'), (req, res) => {
    const schoolId = resolveSchoolId(req);
    const session = db.prepare("SELECT attendees, title, limit_count, COALESCE(status, 'active') as status FROM classroom_live_sessions WHERE id = ? AND school_id = ?").get(req.params.sessionId, schoolId) as { attendees?: number; title?: string; limit_count?: number; status?: string } | undefined;
    if (!session) return res.status(404).json({ error: 'Live class not found' });
    if (session.status !== 'active') return res.status(409).json({ error: 'This live classroom is no longer active.' });
    if ((session.attendees || 0) >= (session.limit_count || 300)) return res.status(409).json({ error: 'This live classroom is already full.' });
    db.prepare('UPDATE classroom_live_sessions SET attendees = attendees + 1 WHERE id = ? AND school_id = ?').run(req.params.sessionId, schoolId);
    const updated = db.prepare('SELECT attendees, title FROM classroom_live_sessions WHERE id = ? AND school_id = ?').get(req.params.sessionId, schoolId) as { attendees?: number; title?: string } | undefined;
    res.json({ ok: true, attendees: updated?.attendees || 0, meetingUrl: `/live/${req.params.sessionId}`, title: updated?.title || 'Live class' });
  });

  app.post('/api/classroom/live-classes/:sessionId/close', requireRoles('Teacher', 'HoS', 'HOS', 'School Admin', 'ICT Manager', 'Owner'), (req, res) => {
    const schoolId = resolveSchoolId(req);
    const existing = db.prepare("SELECT id FROM classroom_live_sessions WHERE id = ? AND school_id = ? AND COALESCE(status, 'active') = 'active'").get(req.params.sessionId, schoolId) as { id?: string } | undefined;
    if (!existing) return res.status(404).json({ error: 'Active live classroom not found' });
    db.prepare("UPDATE classroom_live_sessions SET status = 'closed', ended_at = CURRENT_TIMESTAMP WHERE id = ? AND school_id = ?").run(req.params.sessionId, schoolId);
    res.json({ ok: true });
  });

  // CBT: exams and attempts
  app.get('/api/cbt/exams', (req, res) => {
    const exams = db.prepare('SELECT * FROM cbt_exams ORDER BY created_at DESC').all();
    res.json(exams);
  });

  app.post('/api/cbt/exams', (req, res) => {
    const user = (req as any).user;
    const { school_id, title, total_marks } = req.body;
    if (!title) return res.status(400).json({ error: 'title required' });
    const id = `exam_${Date.now()}`;
    db.prepare('INSERT INTO cbt_exams (id, school_id, title, total_marks, created_by) VALUES (?, ?, ?, ?, ?)')
      .run(id, school_id || (user && user.school_id) || 'school_1', title, total_marks || 100, (user && user.id) || null);
    res.json({ id, status: 'success' });
  });

  app.post('/api/cbt/exams', requireRoles('Teacher','HoS'), (req, res) => {
    const user = (req as any).user;
    const { school_id, title, total_marks } = req.body;
    if (!title) return res.status(400).json({ error: 'title required' });
    const id = `exam_${Date.now()}`;
    db.prepare('INSERT INTO cbt_exams (id, school_id, title, total_marks, created_by) VALUES (?, ?, ?, ?, ?)')
      .run(id, school_id || (user && user.school_id) || 'school_1', title, total_marks || 100, (user && user.id) || null);
    res.json({ id, status: 'success' });
  });

  app.post('/api/cbt/attempts', requireRoles('Student'), (req, res) => {
    const { exam_id, student_id, score, answers } = req.body;
    if (!exam_id || !student_id) return res.status(400).json({ error: 'missing fields' });
    const id = `attempt_${Date.now()}`;
    try {
      db.prepare('INSERT INTO cbt_attempts (id, exam_id, student_id, score, answers) VALUES (?, ?, ?, ?, ?)')
        .run(id, exam_id, student_id, score || null, answers ? JSON.stringify(answers) : null);
      res.json({ id, status: 'success' });
    } catch (err) {
      res.status(500).send(String(err));
    }
  });

  app.get('/api/cbt/attempts/:studentId', (req, res) => {
    const attempts = db.prepare('SELECT * FROM cbt_attempts WHERE student_id = ? ORDER BY taken_at DESC').all(req.params.studentId);
    res.json(attempts);
  });

  // Messaging (direct messages)
  app.get('/api/messages', requireRoles('Teacher','Student','HoS','Parent'), (req, res) => {
    const userId = req.query.userId as string | undefined;
    if (!userId) return res.status(400).json({ error: 'userId query param required' });
    const msgs = db.prepare('SELECT * FROM messages WHERE to_user = ? OR from_user = ? ORDER BY created_at DESC').all(userId, userId);
    res.json(msgs);
  });

  app.post('/api/messages', requireRoles('Teacher','Student','HoS','Parent'), (req, res) => {
    const { school_id, from_user, to_user, content } = req.body;
    if (!from_user || !content) return res.status(400).json({ error: 'missing fields' });
    const id = `msg_${Date.now()}`;
    db.prepare('INSERT INTO messages (id, school_id, from_user, to_user, content) VALUES (?, ?, ?, ?, ?)')
      .run(id, school_id || 'school_1', from_user, to_user || null, content);
    res.json({ id, status: 'sent' });
  });

  app.get('/api/messaging/settings', requireRoles('Teacher', 'Student', 'HoS', 'Parent', 'HoS'), (req, res) => {
    const schoolId = resolveSchoolId(req);
    res.json(getMessagingSettings(schoolId));
  });

  app.post('/api/messaging/settings', requireRoles('HoS'), (req, res) => {
    const schoolId = resolveSchoolId(req);
    const user = (req as any).user;
    const allowStudentPeerMessaging = Boolean(req.body?.allowStudentPeerMessaging);
    db.prepare(`
      INSERT INTO messaging_settings (school_id, allow_student_peer_messaging, updated_by, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(school_id) DO UPDATE SET
        allow_student_peer_messaging = excluded.allow_student_peer_messaging,
        updated_by = excluded.updated_by,
        updated_at = CURRENT_TIMESTAMP
    `).run(schoolId, allowStudentPeerMessaging ? 1 : 0, user?.id || null);
    res.json({ allowStudentPeerMessaging });
  });

  app.get('/api/messaging/contacts', requireRoles('Teacher', 'Student', 'HoS', 'Parent', 'HoS'), (req, res) => {
    try {
      const schoolId = resolveSchoolId(req);
      const user = (req as any).user;
      const activeRole = user?.activeRole || user?.roles?.[0];
      const settings = getMessagingSettings(schoolId);
      const contacts = db.prepare(`
        SELECT u.id, u.name, u.role,
          s.admission_number,
          c.name as class_name,
          t.staff_id
        FROM users u
        LEFT JOIN students s ON s.user_id = u.id
        LEFT JOIN classes c ON c.id = s.class_id
        LEFT JOIN teachers t ON t.user_id = u.id
        WHERE u.school_id = ? AND u.id != ?
        ORDER BY CASE u.role
          WHEN 'HoS' THEN 0
          WHEN 'HoS' THEN 1
          WHEN 'Teacher' THEN 2
          WHEN 'Parent' THEN 3
          ELSE 4
        END, u.name ASC
      `).all(schoolId, user?.id || '') as Array<{
        id: string;
        name: string;
        role: string;
        admission_number?: string | null;
        class_name?: string | null;
        staff_id?: string | null;
      }>;
      const visibleContacts = contacts.filter((contact) => !(activeRole === 'Student' && contact.role === 'Student' && !settings.allowStudentPeerMessaging));

      res.json([
        {
          id: 'ndovera_helpdesk',
          kind: 'helpdesk',
          name: 'Ndovera Helpdesk',
          role: 'Helpdesk',
          subtitle: 'Get product help, report issues, or request support.',
          identifier: null,
          contextLabel: 'Support desk',
        },
        ...visibleContacts.map((contact) => ({
          id: contact.id,
          kind: 'user',
          name: contact.name,
          role: contact.role,
          identifier: contact.admission_number || contact.staff_id || null,
          contextLabel: contact.class_name || null,
          subtitle: contact.role === 'Student'
            ? [contact.class_name, settings.allowStudentPeerMessaging ? 'Peer chat enabled by HOS.' : 'Peer chat locked until HOS approval.'].filter(Boolean).join(' • ')
            : [contact.role, contact.staff_id ? `ID ${contact.staff_id}` : null].filter(Boolean).join(' • '),
        })),
      ]);
    } catch (err) {
      console.error('Error fetching messaging contacts:', err);
      res.status(500).json({ error: 'Internal Server Error', detail: String(err) });
    }
  });

  app.get('/api/chat/unread', (req, res) => {
    try {
      const schoolId = resolveSchoolId(req);
      const actor = resolveActor(req);
      if (!actor?.id) {
        return res.json({ count: 0 });
      }

      const unread = db.prepare(`
        SELECT COUNT(*) as count
        FROM messages
        WHERE school_id = ?
          AND to_user = ?
      `).get(schoolId, actor.id) as { count?: number } | undefined;

      res.json({ count: Number(unread?.count || 0) });
    } catch (err) {
      console.error('Error fetching chat unread count:', err);
      res.status(500).json({ error: 'Internal Server Error', detail: String(err) });
    }
  });

  app.get('/api/messaging/thread', requireRoles('Teacher', 'Student', 'HoS', 'Parent', 'HoS'), (req, res) => {
    try {
      const schoolId = resolveSchoolId(req);
      const user = (req as any).user;
      const peerId = typeof req.query.peerId === 'string' ? req.query.peerId : '';
      if (!peerId) return res.status(400).json({ error: 'peerId required' });

      const peer = resolveMessagingContact(schoolId, peerId);
      if (!peer) {
        return res.status(404).json({ error: 'Messaging contact not found.' });
      }
      if (!canUserMessageContact(req, schoolId, peer)) {
        return res.status(403).json({ error: 'Student to student messaging requires HOS approval.' });
      }

      const thread = db.prepare(`
        SELECT id, from_user, to_user, content, created_at
        FROM messages
        WHERE school_id = ?
          AND ((from_user = ? AND to_user = ?) OR (from_user = ? AND to_user = ?))
        ORDER BY created_at ASC
      `).all(schoolId, user.id, peerId, peerId, user.id) as Array<{ id: string; from_user: string; to_user: string; content: string; created_at: string }>;

      const schoolUsers = db.prepare('SELECT id, name FROM users WHERE school_id = ?').all(schoolId) as Array<{ id: string; name: string }>;
      const names = new Map<string, string>(schoolUsers.map((item) => [item.id, item.name]));
      names.set('ndovera_helpdesk', 'Ndovera Helpdesk');

      res.json(thread.map((message) => ({
        id: message.id,
        from: message.from_user,
        fromName: names.get(message.from_user) || message.from_user,
        to: message.to_user,
        text: message.content,
        time: message.created_at,
      })));
    } catch (err) {
      console.error('Error fetching messaging thread:', err);
      res.status(500).json({ error: 'Internal Server Error', detail: String(err) });
    }
  });

  app.post('/api/messaging/thread', requireRoles('Teacher', 'Student', 'HoS', 'Parent', 'HoS'), (req, res) => {
    try {
      const schoolId = resolveSchoolId(req);
      const user = (req as any).user;
      const peerId = typeof req.body?.peerId === 'string' ? req.body.peerId : '';
      const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
      if (!peerId) return res.status(400).json({ error: 'peerId required' });
      if (!text) return res.status(400).json({ error: 'text required' });

      const peer = resolveMessagingContact(schoolId, peerId);
      if (!peer) {
        return res.status(404).json({ error: 'Messaging contact not found.' });
      }
      if (!canUserMessageContact(req, schoolId, peer)) {
        return res.status(403).json({ error: 'Student to student messaging requires HOS approval.' });
      }

      const id = makeId('dm');
      db.prepare('INSERT INTO messages (id, school_id, from_user, to_user, content) VALUES (?, ?, ?, ?, ?)').run(id, schoolId, user.id, peerId, text);

      const createdMessages = [{
        id,
        from: user.id,
        fromName: resolveActor(req).name,
        to: peerId,
        text,
        time: new Date().toISOString(),
      }];

      if (peerId === 'ndovera_helpdesk') {
        const replyId = makeId('dm');
        const replyText = 'Ndovera Helpdesk received your message. A support guide or human agent will continue with you here.';
        db.prepare('INSERT INTO messages (id, school_id, from_user, to_user, content) VALUES (?, ?, ?, ?, ?)').run(replyId, schoolId, 'ndovera_helpdesk', user.id, replyText);
        createdMessages.push({
          id: replyId,
          from: 'ndovera_helpdesk',
          fromName: 'Ndovera Helpdesk',
          to: user.id,
          text: replyText,
          time: new Date().toISOString(),
        });
      }

      res.json({ messages: createdMessages });
    } catch (err) {
      console.error('Error posting to thread:', err);
      res.status(500).json({ error: 'Internal Server Error', detail: String(err) });
    }
  });

  // Farming / School Enterprise
  app.get('/api/farms', requireRoles('Teacher','HoS','Ami','Owner'), (req, res) => {
    const farms = db.prepare('SELECT * FROM farms ORDER BY created_at DESC').all();
    res.json(farms);
  });

  app.post('/api/farms', requireRoles('HoS','Ami','Owner'), (req, res) => {
    const { school_id, name, plot_count, produce, manager_id } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    const id = `farm_${Date.now()}`;
    db.prepare('INSERT INTO farms (id, school_id, name, plot_count, produce, manager_id) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, school_id || 'school_1', name, plot_count || 0, produce || null, manager_id || null);
    res.json({ id, status: 'created' });
  });

  app.post("/api/attendance", requireRoles('Teacher', 'Class Teacher', 'HoS', 'HOS', 'School Admin'), (req, res) => {
    const user = (req as any).user;
    const schoolId = user?.school_id || req.header('x-school-id') || 'school_1';
    const payload = Array.isArray(req.body.records) ? req.body.records : [req.body];
    const insert = db.prepare("INSERT INTO attendance (id, school_id, student_id, class_id, status, morning_status, afternoon_status, date, recorded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
    const removeExisting = db.prepare("DELETE FROM attendance WHERE school_id = ? AND student_id = ? AND class_id = ? AND date = ?");

    const processAttendance = db.transaction((rows: Array<Record<string, any>>) => {
      const ids: string[] = [];
      for (const row of rows) {
        if (!row?.student_id || !row?.class_id || !row?.date) {
          throw new Error('student_id, class_id, and date are required');
        }
        const morningStatus = row.morning_status || row.morningStatus || 'Present';
        const afternoonStatus = row.afternoon_status || row.afternoonStatus || 'Present';
        const summaryStatus = morningStatus === afternoonStatus ? morningStatus : `${morningStatus}/${afternoonStatus}`;
        const id = row.id || `att_${Date.now()}_${row.student_id}_${Math.random().toString(36).substr(2,6)}`;
        removeExisting.run(schoolId, row.student_id, row.class_id, row.date);
        insert.run(id, schoolId, row.student_id, row.class_id, summaryStatus, morningStatus, afternoonStatus, row.date, user?.id || row.recorded_by || null);
        ids.push(id);
      }
      return ids;
    });

    try {
      const ids = processAttendance(payload);
      res.json({ ids, status: 'success' });
    } catch (e) {
      res.status(500).json({ error: 'Attendance transaction failed', detail: String(e) });
    }
  });

  app.get('/api/attendance/workspace', requireRoles('Teacher', 'Class Teacher', 'HoS', 'HOS', 'School Admin', 'Student', 'Parent'), (req, res) => {
    try {
      const schoolId = resolveSchoolId(req);
      const actor = resolveActor(req);
      const actorRole = actor.role || ((req as any).user?.activeRole || (req as any).user?.roles?.[0] || 'Guest');
      const requestedDate = typeof req.query.date === 'string' && req.query.date.trim() ? req.query.date.trim() : new Date().toISOString().slice(0, 10);
      const requestedClassId = typeof req.query.classId === 'string' ? req.query.classId.trim() : '';
      const studentScopeId = resolveStudentId(req);

      const parentChildren = actorRole === 'Parent'
        ? db.prepare('SELECT id, class_id FROM students WHERE school_id = ? AND (parent_id = ? OR secondary_parent_id = ?)').all(schoolId, actor.id, actor.id) as Array<{ id: string; class_id?: string }>
        : [];
      const scopedStudentIds = actorRole === 'Student'
        ? [studentScopeId].filter(Boolean) as string[]
        : actorRole === 'Parent'
          ? parentChildren.map((child) => child.id)
          : [];
      const scopedClassIds = actorRole === 'Student'
        ? (() => {
            const student = db.prepare('SELECT class_id FROM students WHERE school_id = ? AND id = ?').get(schoolId, studentScopeId) as { class_id?: string } | undefined;
            return [student?.class_id].filter(Boolean) as string[];
          })()
        : actorRole === 'Parent'
          ? parentChildren.map((child) => child.class_id).filter(Boolean) as string[]
          : [];

      const baseClasses = db.prepare(`
        SELECT c.id, c.name, c.level, COUNT(s.id) as student_count
        FROM classes c
        LEFT JOIN students s ON s.class_id = c.id
        WHERE c.school_id = ?
        GROUP BY c.id
        ORDER BY c.rowid DESC
      `).all(schoolId) as any[];
      const classes = (actorRole === 'Student' || actorRole === 'Parent')
        ? baseClasses.filter((item) => scopedClassIds.includes(item.id))
        : baseClasses;
      const activeClassId = requestedClassId || classes[0]?.id || '';

      const holidayRows = db.prepare(`
        SELECT id, event_date, title, event_type
        FROM school_calendar_events
        WHERE school_id = ?
        ORDER BY event_date ASC, rowid ASC
      `).all(schoolId) as any[];
      const holidayForSelectedDate = holidayRows.find((item) => item.event_date === requestedDate && item.event_type === 'Public Holiday');

      const rosterQuery = `
        SELECT s.id as student_id, u.name, s.class_id, c.name as class_name, c.level as class_level
        FROM students s
        JOIN users u ON u.id = s.user_id
        LEFT JOIN classes c ON c.id = s.class_id
        WHERE s.school_id = ?
          ${activeClassId ? 'AND s.class_id = ?' : ''}
          ${(actorRole === 'Student' || actorRole === 'Parent') ? `AND s.id IN (${scopedStudentIds.map(() => '?').join(',')})` : ''}
        ORDER BY u.name COLLATE NOCASE ASC
      `;
      const rosterParams: any[] = [schoolId];
      if (activeClassId) rosterParams.push(activeClassId);
      if (actorRole === 'Student' || actorRole === 'Parent') rosterParams.push(...scopedStudentIds);
      const roster = db.prepare(rosterQuery).all(...rosterParams) as any[];

      const attendanceQuery = `
        SELECT a.*, u.name, c.name as class_name, c.level as class_level
        FROM attendance a
        JOIN students s ON s.id = a.student_id
        JOIN users u ON u.id = s.user_id
        LEFT JOIN classes c ON c.id = a.class_id
        WHERE a.school_id = ?
          ${activeClassId ? 'AND a.class_id = ?' : ''}
          ${(actorRole === 'Student' || actorRole === 'Parent') ? `AND a.student_id IN (${scopedStudentIds.map(() => '?').join(',')})` : ''}
        ORDER BY a.date DESC, u.name COLLATE NOCASE ASC
      `;
      const attendanceParams: any[] = [schoolId];
      if (activeClassId) attendanceParams.push(activeClassId);
      if (actorRole === 'Student' || actorRole === 'Parent') attendanceParams.push(...scopedStudentIds);
      const attendanceRows = db.prepare(attendanceQuery).all(...attendanceParams) as any[];

      const totals = attendanceRows.reduce((acc, row) => {
        const status = normalizeAttendanceStatus(row.status || row.morning_status || row.afternoon_status);
        if (status === 'Present') acc.present += 1;
        else if (status === 'Absent') acc.absent += 1;
        else if (status === 'Late') acc.late += 1;
        else acc.excused += 1;
        return acc;
      }, { present: 0, absent: 0, late: 0, excused: 0 });
      const attendedCount = totals.present + totals.late + totals.excused;
      const overallAttendance = attendanceRows.length ? `${Math.round((attendedCount / attendanceRows.length) * 1000) / 10}%` : '0%';

      const byDate = new Map<string, any[]>();
      attendanceRows.forEach((row) => {
        if (!byDate.has(row.date)) byDate.set(row.date, []);
        byDate.get(row.date)!.push(row);
      });

      const dayItems = [...byDate.entries()].map(([date, rows]) => {
        const { weekStart, weekEnd } = getWeekRange(date);
        const summary = rows.reduce((acc, row) => {
          const status = normalizeAttendanceStatus(row.status || row.morning_status || row.afternoon_status);
          if (status === 'Present') acc.present += 1;
          else if (status === 'Absent') acc.absent += 1;
          else if (status === 'Late') acc.late += 1;
          else acc.excused += 1;
          return acc;
        }, { present: 0, absent: 0, late: 0, excused: 0 });
        const averageAttendance = rows.length
          ? `${Math.round((rows.filter((row) => isAttendancePresentEquivalent(row.status || row.morning_status || row.afternoon_status)).length / rows.length) * 1000) / 10}%`
          : '0%';
        const dateObject = new Date(date);
        return {
          date,
          weekday: dateObject.toLocaleDateString('en-US', { weekday: 'long' }),
          label: dateObject.toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }),
          weekLabel: getWeekLabel(date),
          weekStart,
          weekEnd,
          averageAttendance,
          recordedCount: rows.length,
          classId: rows[0]?.class_id || activeClassId,
          classLabel: [rows[0]?.class_level, rows[0]?.class_name].filter(Boolean).join(' ') || rows[0]?.class_name || 'Class',
          summary,
          records: rows.map((row) => ({
            id: row.id,
            studentId: row.student_id,
            studentName: row.name,
            status: normalizeAttendanceStatus(row.status || row.morning_status || row.afternoon_status),
            morningStatus: normalizeAttendanceStatus(row.morning_status || row.status),
            afternoonStatus: normalizeAttendanceStatus(row.afternoon_status || row.status),
          })),
        };
      }).sort((a, b) => b.date.localeCompare(a.date));

      const weeksMap = new Map<string, { label: string; weekStart: string; weekEnd: string; days: any[] }>();
      dayItems.forEach((item) => {
        const existing = weeksMap.get(item.weekLabel) || { label: item.weekLabel, weekStart: item.weekStart, weekEnd: item.weekEnd, days: [] };
        existing.days.push(item);
        weeksMap.set(item.weekLabel, existing);
      });

      const weeks = [...weeksMap.values()].map((week) => {
        const recordedCount = week.days.reduce((sum, day) => sum + day.recordedCount, 0);
        const attended = week.days.reduce((sum, day) => sum + day.summary.present + day.summary.late + day.summary.excused, 0);
        return {
          ...week,
          days: week.days.sort((a, b) => a.date.localeCompare(b.date)),
          averageAttendance: recordedCount ? `${Math.round((attended / recordedCount) * 1000) / 10}%` : '0%',
        };
      }).sort((a, b) => b.weekStart.localeCompare(a.weekStart));

      const currentDayRows = byDate.get(requestedDate) || [];
      const currentDayMap = new Map(currentDayRows.map((row) => [row.student_id, row]));
      const selectedDaySummary = currentDayRows.reduce((acc, row) => {
        const status = normalizeAttendanceStatus(row.status || row.morning_status || row.afternoon_status);
        if (status === 'Present') acc.present += 1;
        else if (status === 'Absent') acc.absent += 1;
        else if (status === 'Late') acc.late += 1;
        else acc.excused += 1;
        return acc;
      }, { present: 0, absent: 0, late: 0, excused: 0 });
      const selectedDateObject = new Date(requestedDate);
      const activeClass = classes.find((item) => item.id === activeClassId);

      res.json({
        selectedDate: requestedDate,
        overview: {
          overallAttendance,
          presentCount: totals.present,
          absentCount: totals.absent,
          lateCount: totals.late,
          excusedCount: totals.excused,
        },
        classes: classes.map((item) => ({
          id: item.id,
          name: item.name,
          level: item.level || '',
          label: [item.level, item.name].filter(Boolean).join(' '),
          studentCount: Number(item.student_count || 0),
        })),
        holidays: holidayRows.filter((item) => item.event_type === 'Public Holiday').map((item) => ({
          id: item.id,
          date: item.event_date,
          name: item.title,
        })),
        selectedDay: {
          date: requestedDate,
          weekday: selectedDateObject.toLocaleDateString('en-US', { weekday: 'long' }),
          label: selectedDateObject.toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }),
          classId: activeClassId,
          classLabel: [activeClass?.level, activeClass?.name].filter(Boolean).join(' ') || activeClass?.name || 'Class',
          isHoliday: Boolean(holidayForSelectedDate),
          holidayName: holidayForSelectedDate?.title || null,
          alreadyMarked: currentDayRows.length > 0,
          summary: selectedDaySummary,
          records: currentDayRows.map((row) => ({
            id: row.id,
            studentId: row.student_id,
            studentName: row.name,
            status: normalizeAttendanceStatus(row.status || row.morning_status || row.afternoon_status),
            morningStatus: normalizeAttendanceStatus(row.morning_status || row.status),
            afternoonStatus: normalizeAttendanceStatus(row.afternoon_status || row.status),
          })),
          roster: roster.map((student, index) => {
            const existing = currentDayMap.get(student.student_id);
            return {
              studentId: student.student_id,
              name: student.name,
              roll: String(index + 1).padStart(3, '0'),
              classId: student.class_id,
              classLabel: [student.class_level, student.class_name].filter(Boolean).join(' ') || student.class_name || 'Class',
              status: normalizeAttendanceStatus(existing?.status || existing?.morning_status || existing?.afternoon_status || 'Present'),
            };
          }),
        },
        weeks,
      });
    } catch (err) {
      console.error('attendance workspace error', err);
      res.status(500).json({ error: 'Internal Server Error', detail: String(err) });
    }
  });

  app.get("/api/grades/:studentId", (req, res) => {
    const grades = db.prepare("SELECT * FROM grades WHERE student_id = ?").all(req.params.studentId);
    res.json(grades);
  });

  app.post("/api/grades", (req, res) => {
    const records = Array.isArray(req.body.records) ? req.body.records : [req.body];
    const insert = db.prepare("INSERT INTO grades (id, school_id, student_id, subject, score, grade, term, year, teacher_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
    
    // Unified Locked DB Transaction for CA Score Sheets
    const processGrades = db.transaction((rows: Array<Record<string, any>>) => {
      const ids: string[] = [];
      for (const row of rows) {
        const id = row.id || `grd_${Date.now()}_${row.student_id}_${Math.random().toString(36).substr(2,6)}`;
        insert.run(id, row.school_id || 'school_1', row.student_id, row.subject, row.score, row.grade, row.term, row.year, row.teacher_id);
        ids.push(id);
      }
      return ids;
    });
    
    try {
      const ids = processGrades(records);
      res.json({ ids, status: 'success' });
    } catch (e) {
      res.status(500).json({ error: 'Grades transaction failed', detail: String(e) });
    }
  });

  app.post("/api/finance/payments", requireRoles('Accountant', 'HoS', 'Owner'), (req, res) => {
    const { school_id, student_id, fee_id, amount_paid } = req.body;
    
    // Unified Locked DB Transaction for Fee Ledger Validation
    const processPayment = db.transaction(() => {
      const fee = db.prepare("SELECT amount FROM fees WHERE id = ?").get(fee_id) as {amount: number} | undefined;
      if (!fee) throw new Error("Fee ledger not found.");
      
      const previous = db.prepare("SELECT SUM(amount_paid) as total FROM payments WHERE fee_id = ? AND student_id = ?").get(fee_id, student_id) as {total: number};
      const totalPaid = (previous.total || 0) + Number(amount_paid);
      
      if (totalPaid > fee.amount) {
        throw new Error("Payment exceeds orig ledger amt");
      }
      
      const id = `pay_${Date.now()}_${student_id}`;
      db.prepare("INSERT INTO payments (id, school_id, student_id, fee_id, amount_paid, status) VALUES (?, ?, ?, ?, ?, ?)").run(id, school_id || 'school_1', student_id, fee_id, amount_paid, 'Completed');
      return id;
    });
    
    try {
      const id = processPayment();
      res.json({ id, status: 'success' });
    } catch (e) {
      res.status(400).json({ error: 'Fee Payment Validation Failed', detail: String(e) });
    }
  });

  app.get('/api/payroll/overview', requireRoles('Teacher', 'Finance Officer', 'Accountant', 'Bursar', 'School Admin', 'HoS', 'HOS', 'Owner', 'Super Admin'), (req, res) => {
    try {
      const schoolId = resolveSchoolId(req);
      ensurePayrollProfilesForSchool(schoolId);

      const role = getActiveRole(req);
      const actor = resolveActor(req);
      const isManager = ['Finance Officer', 'Accountant', 'Bursar', 'School Admin', 'HoS', 'HOS', 'Owner', 'Super Admin'].includes(role);
      const school = db.prepare('SELECT id, name, logo_url, primary_color FROM schools WHERE id = ?').get(schoolId) as any;

      const profileRows = db.prepare(`
        SELECT pp.*, u.name
        FROM payroll_profiles pp
        LEFT JOIN users u ON u.id = pp.user_id
        WHERE pp.school_id = ?
        ORDER BY pp.staff_id ASC
      `).all(schoolId) as any[];

      const runRows = db.prepare(`
        SELECT *
        FROM payroll_runs
        WHERE school_id = ?
        ORDER BY year DESC, month DESC, created_at DESC
      `).all(schoolId) as any[];

      const latestRun = runRows[0] || null;
      const currentRunRecords = latestRun
        ? db.prepare('SELECT * FROM payroll_run_records WHERE payroll_run_id = ? ORDER BY staff_name ASC').all(latestRun.id) as any[]
        : [];
      const currentTotals = getPayrollRunTotals(currentRunRecords);

      const managerPayslips = isManager
        ? (db.prepare(`
            SELECT id, payslip_number, month_label, payment_date, user_id, data_json
            FROM payroll_payslips
            WHERE school_id = ?
            ORDER BY payment_date DESC, created_at DESC
            LIMIT 8
          `).all(schoolId) as any[])
        : [];

      const myPayslips = actor.id
        ? (db.prepare(`
            SELECT id, payslip_number, month_label, payment_date, data_json
            FROM payroll_payslips
            WHERE school_id = ? AND user_id = ?
            ORDER BY payment_date DESC, created_at DESC
          `).all(schoolId, actor.id) as any[])
        : [];

      res.json({
        role,
        managerAccess: isManager,
        summary: {
          totalStaff: profileRows.length,
          activePayrollRuns: runRows.filter((run) => run.status === 'DRAFT').length,
          approvedPayrollRuns: runRows.filter((run) => run.status === 'APPROVED').length,
          monthlyGross: currentTotals.grossSalary,
          monthlyNet: currentTotals.netSalary,
          monthlyDeductions: currentTotals.totalDeductions,
        },
        school: school ? {
          id: school.id,
          name: school.name,
          logoUrl: school.logo_url || null,
          primaryColor: school.primary_color || '#10b981',
        } : null,
        profiles: isManager ? profileRows.map(mapPayrollProfile) : [],
        runs: runRows.map((run) => {
          const records = db.prepare('SELECT * FROM payroll_run_records WHERE payroll_run_id = ? ORDER BY staff_name ASC').all(run.id) as any[];
          const totals = getPayrollRunTotals(records);
          return {
            id: run.id,
            title: run.title,
            month: run.month,
            year: run.year,
            monthLabel: run.month_label,
            status: run.status,
            notes: run.notes || '',
            preparedBy: run.prepared_by || '',
            reviewedBy: run.reviewed_by || '',
            approvedBy: run.approved_by || '',
            approvedAt: run.approved_at || null,
            recordCount: records.length,
            totals,
            records: isManager && latestRun?.id === run.id ? records.map(mapPayrollRunRecord) : undefined,
          };
        }),
        currentRun: latestRun ? {
          id: latestRun.id,
          title: latestRun.title,
          monthLabel: latestRun.month_label,
          status: latestRun.status,
          notes: latestRun.notes || '',
          totals: currentTotals,
          records: currentRunRecords.map(mapPayrollRunRecord),
        } : null,
        recentPayslips: managerPayslips.map((row) => ({
          id: row.id,
          payslipNumber: row.payslip_number,
          monthLabel: row.month_label,
          paymentDate: row.payment_date,
          data: safeParseJson(row.data_json, null),
        })),
        myPayslips: myPayslips.map((row) => ({
          id: row.id,
          payslipNumber: row.payslip_number,
          monthLabel: row.month_label,
          paymentDate: row.payment_date,
          data: safeParseJson(row.data_json, null),
        })),
      });
    } catch (err) {
      console.error('Payroll overview error', err);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  app.post('/api/payroll/runs', requireRoles('Finance Officer', 'Accountant', 'Bursar', 'School Admin', 'HoS', 'HOS', 'Owner', 'Super Admin'), (req, res) => {
    try {
      const schoolId = resolveSchoolId(req);
      const actor = resolveActor(req);
      const month = Math.max(1, Math.min(12, Number(req.body?.month || new Date().getMonth() + 1)));
      const year = Math.max(2024, Number(req.body?.year || new Date().getFullYear()));
      const notes = String(req.body?.notes || '').trim();

      const created = createPayrollRunFromProfiles({
        schoolId,
        month,
        year,
        createdBy: actor.id,
        preparedBy: actor.name,
        notes,
      });

      if (created.duplicate) {
        return res.status(409).json({ error: 'Payroll run for this month already exists', runId: created.runId });
      }

      res.status(201).json({ ok: true, runId: created.runId });
    } catch (err) {
      console.error('Payroll run creation error', err);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  app.post('/api/payroll/runs/:runId/approve', requireRoles('Finance Officer', 'Accountant', 'Bursar', 'School Admin', 'HoS', 'HOS', 'Owner', 'Super Admin'), (req, res) => {
    try {
      const result = approvePayrollRun(req.params.runId, resolveActor(req).name, resolveActor(req).id);
      if ('error' in result) {
        return res.status(404).json({ error: result.error });
      }
      res.json(result);
    } catch (err) {
      console.error('Payroll approval error', err);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  app.get('/api/payroll/payslips/me', requireRoles('Teacher', 'Finance Officer', 'Accountant', 'Bursar', 'School Admin', 'HoS', 'HOS', 'Owner', 'Super Admin'), (req, res) => {
    try {
      const schoolId = resolveSchoolId(req);
      const actor = resolveActor(req);
      if (!actor.id) return res.status(401).json({ error: 'Unauthenticated' });

      const rows = db.prepare(`
        SELECT id, payslip_number, month_label, payment_date, data_json
        FROM payroll_payslips
        WHERE school_id = ? AND user_id = ?
        ORDER BY payment_date DESC, created_at DESC
      `).all(schoolId, actor.id) as any[];

      res.json(rows.map((row) => ({
        id: row.id,
        payslipNumber: row.payslip_number,
        monthLabel: row.month_label,
        paymentDate: row.payment_date,
        data: safeParseJson(row.data_json, null),
      })));
    } catch (err) {
      console.error('My payslips error', err);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  app.get('/api/payroll/payslips/:payslipId', requireRoles('Teacher', 'Finance Officer', 'Accountant', 'Bursar', 'School Admin', 'HoS', 'HOS', 'Owner', 'Super Admin'), (req, res) => {
    try {
      const schoolId = resolveSchoolId(req);
      const actor = resolveActor(req);
      const role = getActiveRole(req);
      const isManager = ['Finance Officer', 'Accountant', 'Bursar', 'School Admin', 'HoS', 'HOS', 'Owner', 'Super Admin'].includes(role);
      const row = db.prepare('SELECT * FROM payroll_payslips WHERE id = ? AND school_id = ?').get(req.params.payslipId, schoolId) as any;
      if (!row?.id) return res.status(404).json({ error: 'Payslip not found' });
      if (!isManager && row.user_id !== actor.id) return res.status(403).json({ error: 'Forbidden' });

      res.json({
        id: row.id,
        payslipNumber: row.payslip_number,
        monthLabel: row.month_label,
        paymentDate: row.payment_date,
        data: safeParseJson(row.data_json, null),
      });
    } catch (err) {
      console.error('Payslip detail error', err);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  app.get("/api/finance/stats", (req, res) => {
    const totalFees = db.prepare("SELECT SUM(amount) as total FROM fees").get() as { total: number };
    const totalPaid = db.prepare("SELECT SUM(amount_paid) as total FROM payments").get() as { total: number };
    res.json({
      totalCollected: totalPaid.total || 0,
      outstanding: (totalFees.total || 0) - (totalPaid.total || 0)
    });
  });

  app.get('/api/tuckshop/dashboard', requireRoles(...TUCKSHOP_ACCESS_ROLES), (req, res) => {
    try {
      const scope = getTuckshopScope(req);
      const actor = resolveActor(req);

      const childProfiles = scope.isParent && scope.viewerUserId
        ? (db.prepare(`
            SELECT s.user_id, COALESCE(u.name, s.admission_number, s.user_id) as name
            FROM students s
            LEFT JOIN users u ON u.id = s.user_id
            WHERE s.parent_id = ?
            ORDER BY s.id
          `).all(scope.viewerUserId) as Array<{ user_id: string; name: string }>).map((row) => ({ id: row.user_id, name: row.name }))
        : [];

      const balances = scope.viewerUserId
        ? (db.prepare('SELECT wallet_balance_naira, credit_balance_naira, spending_limit_naira FROM tuckshop_balances WHERE school_id = ? AND user_id = ?').get(scope.schoolId, scope.viewerUserId) as { wallet_balance_naira?: number; credit_balance_naira?: number; spending_limit_naira?: number } | undefined)
        : undefined;

      let blockedRows = (db.prepare(`
        SELECT b.parent_user_id, b.student_user_id, b.product_id, b.reason, p.name as product_name
        FROM tuckshop_purchase_blocks b
        JOIN tuckshop_products p ON p.id = b.product_id
        WHERE b.school_id = ? AND b.is_blocked = 1
        ORDER BY b.created_at DESC
      `).all(scope.schoolId) as Array<{ parent_user_id: string; student_user_id: string; product_id: string; reason: string | null; product_name: string }>);
      if (scope.isParent && scope.viewerUserId) {
        blockedRows = blockedRows.filter((row) => row.parent_user_id === scope.viewerUserId);
      } else if (scope.isStudent && scope.viewerUserId) {
        blockedRows = blockedRows.filter((row) => row.student_user_id === scope.viewerUserId);
      } else if (!scope.isManager) {
        blockedRows = [];
      }
      const blockedProductIds = new Set(blockedRows.map((row) => row.product_id));

      const paymentAccounts = (db.prepare(`
        SELECT id, method, account_name, account_number, bank_name, aura_wallet_id, instructions
        FROM tuckshop_payment_accounts
        WHERE school_id = ? AND is_active = 1
        ORDER BY method ASC
      `).all(scope.schoolId) as Array<{
        id: string;
        method: string;
        account_name: string | null;
        account_number: string | null;
        bank_name: string | null;
        aura_wallet_id: string | null;
        instructions: string | null;
      }>).map((row) => ({
        id: row.id,
        method: row.method,
        accountName: row.account_name || '',
        accountNumber: row.account_number || '',
        bankName: row.bank_name || '',
        auraWalletId: row.aura_wallet_id || '',
        instructions: row.instructions || '',
      }));

      const buyerOptions = scope.isManager
        ? (db.prepare(`
            SELECT id, name, role
            FROM users
            WHERE school_id = ?
              AND role IN ('Student', 'Parent', 'Teacher', 'Class Teacher', 'HOD', 'Principal', 'Head Teacher', 'Nursery Head', 'Librarian', 'Accountant', 'HoS', 'HOS', 'Owner', 'Ami')
            ORDER BY name ASC
          `).all(scope.schoolId) as Array<{ id: string; name: string; role: string }>).map((row) => ({
            id: row.id,
            name: row.name,
            role: row.role,
          }))
        : [];

      const productRows = db.prepare('SELECT id, name, category, image_url, price_naira, stock_quantity, stock_status FROM tuckshop_products WHERE school_id = ? ORDER BY name ASC').all(scope.schoolId) as Array<{ id: string; name: string; category: string; image_url: string | null; price_naira: number; stock_quantity: number; stock_status: string }>;

      let salesRows = db.prepare(`
        SELECT s.id, s.buyer_user_id, s.buyer_role, s.student_user_id, s.quantity, s.total_amount_naira, s.amount_paid_naira, s.payment_source, s.payment_status, s.created_at,
               p.name as product_name,
               buyer.name as buyer_name,
               student.name as student_name
        FROM tuckshop_sales s
        JOIN tuckshop_products p ON p.id = s.product_id
        LEFT JOIN users buyer ON buyer.id = s.buyer_user_id
        LEFT JOIN users student ON student.id = s.student_user_id
        WHERE s.school_id = ?
        ORDER BY s.created_at DESC
      `).all(scope.schoolId) as Array<{
        id: string;
        buyer_user_id: string;
        buyer_role: string;
        student_user_id: string | null;
        quantity: number;
        total_amount_naira: number;
        amount_paid_naira: number;
        payment_source: string;
        payment_status: string;
        created_at: string;
        product_name: string;
        buyer_name: string | null;
        student_name: string | null;
      }>;

      if (!scope.isManager) {
        if (scope.isParent) {
          const allowed = new Set(scope.childUserIds);
          salesRows = salesRows.filter((row) => !!row.student_user_id && allowed.has(row.student_user_id));
        } else if (scope.isOversight) {
          salesRows = salesRows.filter((row) => row.buyer_user_id === scope.viewerUserId);
        } else if (scope.viewerUserId) {
          salesRows = salesRows.filter((row) => row.buyer_user_id === scope.viewerUserId);
        } else {
          salesRows = [];
        }
      }

      const transactions = salesRows.map((row) => ({
        id: row.id,
        item: row.product_name,
        quantity: row.quantity,
        date: row.created_at,
        amount: `₦${Number(row.total_amount_naira || 0).toLocaleString()}`,
        method: row.payment_source,
        child: row.student_name || row.buyer_name || 'Self',
      }));

      const installmentOptions = scope.isManager
        ? salesRows
            .filter((row) => row.payment_status === 'credit' || row.payment_status === 'part-paid')
            .map((row) => ({
              id: row.id,
              label: `${row.product_name} • ${row.student_name || row.buyer_name || 'Buyer'} • ${row.created_at}`,
              paymentStatus: row.payment_status,
              totalAmount: formatTuckshopCurrency(row.total_amount_naira || 0),
              amountDue: formatTuckshopCurrency(Math.max(0, Number(row.total_amount_naira || 0) - Number(row.amount_paid_naira || 0))),
            }))
        : [];

      const transactionLedger = salesRows.map((row, index) => ({
        sn: index + 1,
        date: row.created_at,
        description: `${row.product_name} x${row.quantity}${row.student_name ? ` for ${row.student_name}` : ''}`,
        amount: formatTuckshopCurrency(row.total_amount_naira || 0),
      }));

      const periodTotals = buildTuckshopPeriodTotals(salesRows.map((row) => ({ created_at: row.created_at, total_amount_naira: row.total_amount_naira })));

      const orderRows = db.prepare(`
        SELECT o.id, o.student_user_id, o.quantity, o.total_amount_naira, o.payment_method, o.status, o.created_at, o.note,
               COALESCE(o.requester_user_id, o.requested_by_user_id) as requester_user_id,
               p.name as product_name,
               requester.name as requester_name,
               student.name as student_name
        FROM tuckshop_orders o
        JOIN tuckshop_products p ON p.id = o.product_id
        LEFT JOIN users requester ON requester.id = o.requester_user_id
        LEFT JOIN users student ON student.id = o.student_user_id
        WHERE o.school_id = ?
        ORDER BY o.created_at DESC
        LIMIT 30
      `).all(scope.schoolId) as Array<{
        id: string;
        requester_user_id: string;
        student_user_id: string | null;
        quantity: number;
        total_amount_naira: number;
        payment_method: string | null;
        status: string;
        created_at: string;
        note: string | null;
        product_name: string;
        requester_name: string | null;
        student_name: string | null;
      }>;

      const filteredOrderRows = orderRows.filter((row) => {
        if (scope.isManager) return true;
        if (scope.isParent) return !!row.student_user_id && scope.childUserIds.includes(row.student_user_id);
        if (scope.isOversight || scope.isStudent || scope.isStaff) return row.requester_user_id === scope.viewerUserId;
        return false;
      });

      const orders = filteredOrderRows.map((row) => ({
        id: row.id,
        date: row.created_at,
        item: row.product_name,
        quantity: row.quantity,
        amount: formatTuckshopCurrency(row.total_amount_naira || 0),
        paymentMethod: row.payment_method || 'Pending',
        status: row.status,
        target: row.student_name || row.requester_name || 'Self',
        note: row.note || '',
      }));

      const debtors = (scope.isManager || scope.isOversight)
        ? (db.prepare(`
            SELECT d.id, d.user_id, u.name, u.role, d.outstanding_balance_naira, d.repayment_plan, d.status
            FROM tuckshop_debtors d
            JOIN users u ON u.id = d.user_id
            WHERE d.school_id = ?
            ORDER BY d.outstanding_balance_naira DESC
          `).all(scope.schoolId) as Array<{ id: string; user_id: string; name: string; role: string; outstanding_balance_naira: number; repayment_plan: string | null; status: string }>).map((row) => ({
            id: row.id,
            userId: row.user_id,
            name: row.name,
            type: row.role,
            balance: `₦${Number(row.outstanding_balance_naira || 0).toLocaleString()}`,
            plan: row.repayment_plan || 'No plan set',
            status: row.status,
          }))
        : [];

      const ownOweNaira = scope.viewerUserId
        ? Number((db.prepare('SELECT outstanding_balance_naira as total FROM tuckshop_debtors WHERE school_id = ? AND user_id = ?').get(scope.schoolId, scope.viewerUserId) as { total?: number } | undefined)?.total || balances?.credit_balance_naira || 0)
        : 0;
      const othersOweNaira = Number((db.prepare('SELECT SUM(outstanding_balance_naira) as total FROM tuckshop_debtors WHERE school_id = ? AND user_id <> ?').get(scope.schoolId, scope.viewerUserId || '') as { total?: number } | undefined)?.total || 0);

      const auditLogs = scope.isManager
        ? (db.prepare('SELECT action, details_json, created_at FROM tuckshop_audit_logs WHERE school_id = ? ORDER BY created_at DESC LIMIT 10').all(scope.schoolId) as Array<{ action: string; details_json: string | null; created_at: string }>).map((row) => {
            const details = safeParseJson<Record<string, unknown>>(row.details_json, {});
            return `${row.action.replaceAll('_', ' ')} • ${Object.values(details).join(' • ') || 'No details'} • ${row.created_at}`;
          })
        : [];

      const totalSales = db.prepare('SELECT SUM(total_amount_naira) as total FROM tuckshop_sales WHERE school_id = ?').get(scope.schoolId) as { total?: number };
      const totalCredit = db.prepare('SELECT SUM(outstanding_balance_naira) as total FROM tuckshop_debtors WHERE school_id = ?').get(scope.schoolId) as { total?: number };
      const staffSales = db.prepare("SELECT SUM(total_amount_naira) as total FROM tuckshop_sales WHERE school_id = ? AND buyer_role <> 'Student'").get(scope.schoolId) as { total?: number };
      const studentSales = db.prepare("SELECT SUM(total_amount_naira) as total FROM tuckshop_sales WHERE school_id = ? AND buyer_role = 'Student'").get(scope.schoolId) as { total?: number };

      const reports = scope.isManager
        ? [
            { label: 'Daily sales', value: formatTuckshopCurrency(totalSales.total || 0), note: `Latest transaction day total: ${periodTotals.daily[0]?.total || formatTuckshopCurrency(0)} on ${periodTotals.daily[0]?.period || 'N/A'}.` },
            { label: 'Weekly sales', value: periodTotals.weekly[0]?.total || formatTuckshopCurrency(0), note: `Current week ${periodTotals.weekly[0]?.period || 'N/A'} total.` },
            { label: 'Monthly sales', value: periodTotals.monthly[0]?.total || formatTuckshopCurrency(0), note: `Current month ${periodTotals.monthly[0]?.period || 'N/A'} total.` },
            { label: 'Top products', value: 'Drinks + Snacks', note: 'Highest movement in the current seed data.' },
          ]
        : [];

      const accountCards = scope.isManager
        ? [
            { label: "Today's Sales", value: periodTotals.daily[0]?.total || formatTuckshopCurrency(0), tone: 'manager' },
            { label: 'Weekly Sales', value: periodTotals.weekly[0]?.total || formatTuckshopCurrency(0), tone: 'manager' },
            { label: 'Monthly Sales', value: periodTotals.monthly[0]?.total || formatTuckshopCurrency(0), tone: 'manager' },
            { label: 'Immutable Logs', value: 'Active', tone: 'manager' },
          ]
        : scope.isOversight
          ? [
              { label: 'What You Owe', value: formatTuckshopCurrency(ownOweNaira), tone: 'oversight' },
              { label: 'What Others Owe', value: formatTuckshopCurrency(othersOweNaira), tone: 'oversight' },
              { label: 'Orders Placed', value: String(orders.length), tone: 'oversight' },
              { label: 'Payment Methods', value: String(paymentAccounts.length), tone: 'oversight' },
            ]
        : scope.isParent
          ? [
              { label: 'Child Balance', value: formatTuckshopCurrency(balances?.credit_balance_naira || 0), tone: 'parent' },
              { label: 'Spending Limit', value: `${formatTuckshopCurrency(balances?.spending_limit_naira || 0)}/day`, tone: 'parent' },
              { label: 'Recent Purchases', value: String(transactions.length), tone: 'parent' },
              { label: 'Blocked Items', value: String(blockedRows.length), tone: 'parent' },
            ]
          : scope.isStaff
            ? [
                { label: 'Outstanding Balance', value: formatTuckshopCurrency(balances?.credit_balance_naira || 0), tone: 'staff' },
                { label: 'Credit Status', value: Number(balances?.credit_balance_naira || 0) > 0 ? 'Active' : 'Clear', tone: 'staff' },
                { label: 'This Week', value: periodTotals.weekly[0]?.total || formatTuckshopCurrency(0), tone: 'staff' },
                { label: 'Payroll Link', value: 'Optional', tone: 'staff' },
              ]
            : [
                { label: 'Wallet Balance', value: formatTuckshopCurrency(balances?.wallet_balance_naira || 0), tone: 'student' },
                { label: 'This Week', value: periodTotals.weekly[0]?.total || formatTuckshopCurrency(0), tone: 'student' },
                { label: 'Transactions', value: String(transactions.length), tone: 'student' },
                { label: 'Payment Mode', value: 'Cashless', tone: 'student' },
              ];

      res.json({
        roleState: {
          role: scope.role,
          isManager: scope.isManager,
          isOversight: scope.isOversight,
          isParent: scope.isParent,
          isStudent: scope.isStudent,
          isStaff: scope.isStaff,
        },
        actor,
        accountCards,
        paymentInstructions: [
          'All users can view account and payment instructions.',
          'Use the I Have Paid button only as an acknowledgement after transfer or funding.',
          'Tuck shop remains separate from school fees and result locking.',
        ],
        balances: {
          walletBalanceNaira: Number(balances?.wallet_balance_naira || 0),
          creditBalanceNaira: Number(balances?.credit_balance_naira || 0),
          spendingLimitNaira: Number(balances?.spending_limit_naira || 0),
        },
        debtOverview: {
          ownOweNaira,
          othersOweNaira,
        },
        transactions,
        transactionLedger,
        periodTotals,
        products: productRows.map((row) => ({
          id: row.id,
          name: row.name,
          category: row.category,
          imageUrl: row.image_url || '',
          price: formatTuckshopCurrency(row.price_naira || 0),
          stock: `${row.stock_quantity} Units`,
          status: row.stock_status,
          isBlocked: blockedProductIds.has(row.id),
          blockReason: blockedRows.find((entry) => entry.product_id === row.id)?.reason || '',
        })),
        paymentAccounts,
        buyerOptions,
        installmentOptions,
        children: childProfiles,
        purchaseBlocks: blockedRows.map((row) => ({
          studentUserId: row.student_user_id,
          productId: row.product_id,
          productName: row.product_name,
          reason: row.reason || '',
        })),
        orders,
        debtors,
        reports,
        auditLogs,
      });
    } catch (err) {
      console.error('Error fetching tuckshop dashboard:', err);
      res.status(500).json({ error: 'Internal Server Error', detail: String(err) });
    }
  });

  app.post('/api/tuckshop/sales', requireRoles(...TUCKSHOP_MANAGER_ROLES), (req, res) => {
    try {
      const schoolId = resolveSchoolId(req);
      const actor = resolveActor(req);
      const productId = typeof req.body?.productId === 'string' ? req.body.productId : '';
      const buyerUserId = typeof req.body?.buyerUserId === 'string' ? req.body.buyerUserId : '';
      const quantity = Math.max(1, Number(req.body?.quantity || 1));
      const amountPaid = Math.max(0, Number(req.body?.amountPaidNaira || 0));
      const unitPriceOverride = req.body?.unitPriceNaira === undefined ? undefined : Math.max(0, Number(req.body.unitPriceNaira || 0));
      const paymentSource = typeof req.body?.paymentSource === 'string' ? req.body.paymentSource : 'Wallet';
      const note = typeof req.body?.note === 'string' ? req.body.note : '';
      if (!productId || !buyerUserId) return res.status(400).json({ error: 'productId and buyerUserId are required' });

      const product = db.prepare('SELECT price_naira, stock_quantity FROM tuckshop_products WHERE id = ? AND school_id = ?').get(productId, schoolId) as { price_naira?: number; stock_quantity?: number } | undefined;
      if (!product) return res.status(404).json({ error: 'Product not found' });
      if (Number(product.stock_quantity || 0) < quantity) return res.status(400).json({ error: 'Insufficient stock' });

      const buyer = db.prepare('SELECT role FROM users WHERE id = ? AND school_id = ?').get(buyerUserId, schoolId) as { role?: string } | undefined;
      if (!buyer) return res.status(404).json({ error: 'Buyer not found' });

      const unitPrice = unitPriceOverride === undefined ? Number(product.price_naira || 0) : unitPriceOverride;
      const total = unitPrice * quantity;
      const balanceDue = Math.max(0, total - amountPaid);
      const saleId = makeId('tuck_sale');

      const tx = db.transaction(() => {
        db.prepare(`
          INSERT INTO tuckshop_sales (
            id, school_id, buyer_user_id, buyer_role, student_user_id, product_id, quantity, unit_price_naira,
            total_amount_naira, amount_paid_naira, balance_due_naira, payment_source, payment_status, note, created_by_user_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          saleId,
          schoolId,
          buyerUserId,
          buyer.role || 'User',
          buyer.role === 'Student' ? buyerUserId : null,
          productId,
          quantity,
          unitPrice,
          total,
          amountPaid,
          balanceDue,
          paymentSource,
          balanceDue > 0 ? (amountPaid > 0 ? 'part-paid' : 'credit') : 'paid',
          note,
          actor.id,
        );
        db.prepare('UPDATE tuckshop_products SET stock_quantity = stock_quantity - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(quantity, productId);
        db.prepare('INSERT INTO tuckshop_audit_logs (id, school_id, actor_user_id, action, details_json) VALUES (?, ?, ?, ?, ?)').run(
          makeId('tuck_audit'),
          schoolId,
          actor.id,
          'sale_created',
          JSON.stringify({ saleId, buyerUserId, productId, quantity, unitPrice, total, amountPaid, balanceDue }),
        );
        syncTuckshopDebtorRecord(schoolId, buyerUserId);
      });

      tx();
      res.json({ id: saleId, status: 'created' });
    } catch (err) {
      console.error('Error creating tuckshop sale:', err);
      res.status(500).json({ error: 'Internal Server Error', detail: String(err) });
    }
  });

  app.post('/api/tuckshop/installments', requireRoles(...TUCKSHOP_MANAGER_ROLES), (req, res) => {
    try {
      const schoolId = resolveSchoolId(req);
      const actor = resolveActor(req);
      const saleId = typeof req.body?.saleId === 'string' ? req.body.saleId : '';
      const amount = Math.max(0, Number(req.body?.amountPaidNaira || 0));
      const note = typeof req.body?.note === 'string' ? req.body.note : '';
      if (!saleId || amount <= 0) return res.status(400).json({ error: 'saleId and positive amountPaidNaira are required' });

      const sale = db.prepare('SELECT buyer_user_id, amount_paid_naira, total_amount_naira FROM tuckshop_sales WHERE id = ? AND school_id = ?').get(saleId, schoolId) as { buyer_user_id?: string; amount_paid_naira?: number; total_amount_naira?: number } | undefined;
      if (!sale) return res.status(404).json({ error: 'Sale not found' });

      const newPaid = Number(sale.amount_paid_naira || 0) + amount;
      const total = Number(sale.total_amount_naira || 0);
      if (newPaid > total) return res.status(400).json({ error: 'Installment exceeds outstanding balance' });
      const balanceDue = total - newPaid;

      const tx = db.transaction(() => {
        db.prepare('INSERT INTO tuckshop_installments (id, sale_id, amount_paid_naira, recorded_by_user_id, note) VALUES (?, ?, ?, ?, ?)')
          .run(makeId('tuck_installment'), saleId, amount, actor.id, note || 'Installment payment recorded.');
        db.prepare('UPDATE tuckshop_sales SET amount_paid_naira = ?, balance_due_naira = ?, payment_status = ? WHERE id = ?').run(
          newPaid,
          balanceDue,
          balanceDue > 0 ? 'part-paid' : 'paid',
          saleId,
        );
        db.prepare('INSERT INTO tuckshop_audit_logs (id, school_id, actor_user_id, action, details_json) VALUES (?, ?, ?, ?, ?)').run(
          makeId('tuck_audit'),
          schoolId,
          actor.id,
          'installment_recorded',
          JSON.stringify({ saleId, amount, newPaid, balanceDue }),
        );
        if (sale.buyer_user_id) {
          syncTuckshopDebtorRecord(schoolId, sale.buyer_user_id, 'Installment arrangement');
        }
      });

      tx();
      res.json({ saleId, amountPaidNaira: newPaid, balanceDueNaira: balanceDue, status: balanceDue > 0 ? 'part-paid' : 'paid' });
    } catch (err) {
      console.error('Error recording tuckshop installment:', err);
      res.status(500).json({ error: 'Internal Server Error', detail: String(err) });
    }
  });

  app.get('/api/tuckshop/debtors/:debtorId', requireRoles(...TUCKSHOP_MANAGER_ROLES), (req, res) => {
    try {
      const schoolId = resolveSchoolId(req);
      const debtorId = typeof req.params?.debtorId === 'string' ? req.params.debtorId : '';
      const debtor = db.prepare(`
        SELECT d.id, d.user_id, d.outstanding_balance_naira, d.repayment_plan, d.status, u.name, u.role
        FROM tuckshop_debtors d
        JOIN users u ON u.id = d.user_id
        WHERE d.school_id = ? AND d.id = ?
      `).get(schoolId, debtorId) as {
        id: string;
        user_id: string;
        outstanding_balance_naira: number;
        repayment_plan: string | null;
        status: string;
        name: string;
        role: string;
      } | undefined;

      if (!debtor) return res.status(404).json({ error: 'Debtor not found' });

      const sales = db.prepare(`
        SELECT s.id, s.quantity, s.total_amount_naira, s.amount_paid_naira, s.balance_due_naira, s.payment_source, s.payment_status, s.created_at, s.note,
               p.name as product_name
        FROM tuckshop_sales s
        JOIN tuckshop_products p ON p.id = s.product_id
        WHERE s.school_id = ? AND s.buyer_user_id = ? AND s.balance_due_naira > 0
        ORDER BY s.created_at DESC
      `).all(schoolId, debtor.user_id) as Array<{
        id: string;
        quantity: number;
        total_amount_naira: number;
        amount_paid_naira: number;
        balance_due_naira: number;
        payment_source: string;
        payment_status: string;
        created_at: string;
        note: string | null;
        product_name: string;
      }>;

      const installments = db.prepare(`
        SELECT i.id, i.sale_id, i.amount_paid_naira, i.note, i.created_at, p.name as product_name
        FROM tuckshop_installments i
        JOIN tuckshop_sales s ON s.id = i.sale_id
        JOIN tuckshop_products p ON p.id = s.product_id
        WHERE s.school_id = ? AND s.buyer_user_id = ?
        ORDER BY i.created_at DESC
      `).all(schoolId, debtor.user_id) as Array<{
        id: string;
        sale_id: string;
        amount_paid_naira: number;
        note: string | null;
        created_at: string;
        product_name: string;
      }>;

      res.json({
        debtor: {
          id: debtor.id,
          userId: debtor.user_id,
          name: debtor.name,
          role: debtor.role,
          outstandingBalance: formatTuckshopCurrency(debtor.outstanding_balance_naira || 0),
          repaymentPlan: debtor.repayment_plan || 'No plan set',
          status: debtor.status,
        },
        sales: sales.map((sale) => ({
          id: sale.id,
          item: sale.product_name,
          quantity: sale.quantity,
          total: formatTuckshopCurrency(sale.total_amount_naira || 0),
          paid: formatTuckshopCurrency(sale.amount_paid_naira || 0),
          due: formatTuckshopCurrency(sale.balance_due_naira || 0),
          method: sale.payment_source,
          status: sale.payment_status,
          date: sale.created_at,
          note: sale.note || '',
        })),
        installments: installments.map((installment) => ({
          id: installment.id,
          saleId: installment.sale_id,
          item: installment.product_name,
          amount: formatTuckshopCurrency(installment.amount_paid_naira || 0),
          note: installment.note || '',
          date: installment.created_at,
        })),
      });
    } catch (err) {
      console.error('Error fetching debtor detail:', err);
      res.status(500).json({ error: 'Internal Server Error', detail: String(err) });
    }
  });

  app.get('/api/classroom/subjects/mine', requireRoles('Student', 'Teacher'), (req, res) => {
    try {
      const scope = resolveActor(req);
      const schoolId = resolveSchoolId(req);
      
      let subjects = [];

      if (scope.role === 'Student') {
        const student = db.prepare('SELECT id, class_id FROM students WHERE user_id = ? AND school_id = ?').get(scope.id, schoolId) as any;
        if (student && student.class_id) {
           // For students, get subjects associated with their class
           // This assumes a 'subjects' table or similar logic. For now, we mock or join.
           // Since we don't have a rigid subject-class map in the schema shown, we'll try to infer or return all subjects for the class.
           // Using a join on grades or assignments to find active subjects, or just all subjects taught in that class.
           // A better schema would have `class_subjects`.
           // Fallback: Return all unique subjects where there is an assignment or grade for this student's class
           subjects = db.prepare(`
             SELECT DISTINCT s.subject as name, 'active' as status, t.user_id as teacher_id
             FROM grades s
             LEFT JOIN teachers t ON s.teacher_id = t.id
             WHERE s.student_id = ? AND s.school_id = ?
           `).all(student.id, schoolId);

           // If empty, return some defaults or check assignments
           if (subjects.length === 0) {
             subjects = db.prepare(`
               SELECT DISTINCT title as name, 'active' as status
               FROM assignments
               WHERE class_id = ? AND school_id = ?
             `).all(student.class_id, schoolId);
           }
        }
      } else if (scope.role === 'Teacher') {
         const teacher = db.prepare('SELECT id FROM teachers WHERE user_id = ? AND school_id = ?').get(scope.id, schoolId) as any;
         if (teacher) {
            // Find classes/subjects this teacher teaches.
            // Schema has `classes.teacher_id` for class teacher. 
            // We might need a `teacher_subjects` table or similar. 
            // For now, let's return classes they manage.
            const classes = db.prepare('SELECT id, name FROM classes WHERE teacher_id = ? AND school_id = ?').all(teacher.id, schoolId) as Array<{ id: string; name: string }>;
            subjects = classes.map((c) => ({
              id: c.id,
              name: c.name + ' (Class Teacher)',
              code: c.name.substring(0, 3).toUpperCase(),
              teacherName: scope.name,
              accent: 'purple'
            }));
         }
      }

      // If still empty (e.g. fresh db), return mock data for development so UI doesn't break
      if (subjects.length === 0) {
         return res.json([
           { id: 'sub_1', name: 'Mathematics', code: 'MTH', teacherName: 'Mr. Teacher', accent: 'blue' },
           { id: 'sub_2', name: 'English Language', code: 'ENG', teacherName: 'Mrs. Lang', accent: 'green' },
           { id: 'sub_3', name: 'Basic Science', code: 'BSC', teacherName: 'Dr. Sci', accent: 'yellow' }
         ]);
      }

      res.json(subjects);
    } catch (err) {
      console.error('Error fetching my subjects:', err);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  app.post('/api/tuckshop/orders', requireRoles(...TUCKSHOP_ACCESS_ROLES), (req, res) => {
    try {
      const scope = getTuckshopScope(req);
      const actor = resolveActor(req);
      const productId = typeof req.body?.productId === 'string' ? req.body.productId : '';
      const quantity = Math.max(1, Number(req.body?.quantity || 1));
      const paymentMethod = typeof req.body?.paymentMethod === 'string' ? req.body.paymentMethod : 'Bank Transfer';
      const note = typeof req.body?.note === 'string' ? req.body.note : '';
      const requestedStudentUserId = typeof req.body?.studentUserId === 'string' ? req.body.studentUserId : null;
      if (!productId || !scope.viewerUserId) return res.status(400).json({ error: 'productId is required' });

      const product = db.prepare('SELECT name, price_naira, stock_quantity FROM tuckshop_products WHERE id = ? AND school_id = ?').get(productId, scope.schoolId) as { name?: string; price_naira?: number; stock_quantity?: number } | undefined;
      if (!product) return res.status(404).json({ error: 'Product not found' });
      if (Number(product.stock_quantity || 0) < quantity) return res.status(400).json({ error: 'Insufficient stock for this order' });

      let studentUserId: string | null = null;
      if (scope.isParent) {
        if (requestedStudentUserId && !scope.childUserIds.includes(requestedStudentUserId)) {
          return res.status(403).json({ error: 'You can only place orders for your linked children' });
        }
        studentUserId = requestedStudentUserId || scope.childUserIds[0] || null;
      } else if (scope.isStudent) {
        studentUserId = scope.viewerUserId;
        const block = db.prepare('SELECT id FROM tuckshop_purchase_blocks WHERE school_id = ? AND student_user_id = ? AND product_id = ? AND is_blocked = 1').get(scope.schoolId, scope.viewerUserId, productId) as { id?: string } | undefined;
        if (block) return res.status(403).json({ error: 'This item is blocked by your parent/guardian.' });
      }

      const orderId = makeId('tuck_order');
      const total = Number(product.price_naira || 0) * quantity;
      if (tuckshopOrderHasLegacyRequesterColumn) {
        db.prepare(`
          INSERT INTO tuckshop_orders (
            id, school_id, requester_user_id, requested_by_user_id, requester_role, student_user_id, product_id, quantity, unit_price_naira,
            total_amount_naira, payment_method, status, note
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(orderId, scope.schoolId, scope.viewerUserId, scope.viewerUserId, scope.role, studentUserId, productId, quantity, Number(product.price_naira || 0), total, paymentMethod, 'Awaiting supply', note);
      } else {
        db.prepare(`
          INSERT INTO tuckshop_orders (
            id, school_id, requester_user_id, requester_role, student_user_id, product_id, quantity, unit_price_naira,
            total_amount_naira, payment_method, status, note
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(orderId, scope.schoolId, scope.viewerUserId, scope.role, studentUserId, productId, quantity, Number(product.price_naira || 0), total, paymentMethod, 'Awaiting supply', note);
      }
      db.prepare('INSERT INTO tuckshop_audit_logs (id, school_id, actor_user_id, action, details_json) VALUES (?, ?, ?, ?, ?)').run(
        makeId('tuck_audit'),
        scope.schoolId,
        actor.id,
        'order_created',
        JSON.stringify({ orderId, productId, quantity, paymentMethod, studentUserId }),
      );

      res.json({ id: orderId, totalAmountNaira: total, status: 'Awaiting supply' });
    } catch (err) {
      console.error('Error creating tuckshop order:', err);
      res.status(500).json({ error: 'Internal Server Error', detail: String(err) });
    }
  });

  app.post('/api/tuckshop/orders/:orderId/status', requireRoles(...TUCKSHOP_MANAGER_ROLES), (req, res) => {
    try {
      const schoolId = resolveSchoolId(req);
      const actor = resolveActor(req);
      const orderId = typeof req.params?.orderId === 'string' ? req.params.orderId : '';
      const status = typeof req.body?.status === 'string' ? req.body.status : '';
      if (!orderId || !status) return res.status(400).json({ error: 'orderId and status are required' });

      const order = db.prepare('SELECT id FROM tuckshop_orders WHERE school_id = ? AND id = ?').get(schoolId, orderId) as { id?: string } | undefined;
      if (!order?.id) return res.status(404).json({ error: 'Order not found' });

      db.prepare('UPDATE tuckshop_orders SET status = ? WHERE id = ?').run(status, orderId);
      db.prepare('INSERT INTO tuckshop_audit_logs (id, school_id, actor_user_id, action, details_json) VALUES (?, ?, ?, ?, ?)').run(
        makeId('tuck_audit'),
        schoolId,
        actor.id,
        'order_status_updated',
        JSON.stringify({ orderId, status }),
      );
      res.json({ orderId, status });
    } catch (err) {
      console.error('Error updating tuckshop order status:', err);
      res.status(500).json({ error: 'Internal Server Error', detail: String(err) });
    }
  });

  app.post('/api/tuckshop/products', requireRoles(...TUCKSHOP_MANAGER_ROLES), (req, res) => {
    try {
      const schoolId = resolveSchoolId(req);
      const actor = resolveActor(req);
      const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
      const category = typeof req.body?.category === 'string' ? req.body.category.trim() : 'General';
      const priceNaira = Math.max(0, Number(req.body?.priceNaira || 0));
      const stockQuantity = Math.max(0, Number(req.body?.stockQuantity || 0));
      const imageUrl = typeof req.body?.imageUrl === 'string' ? req.body.imageUrl : '';
      if (!name) return res.status(400).json({ error: 'name is required' });

      const productId = makeId('tuck_product');
      db.prepare(`
        INSERT INTO tuckshop_products (
          id, school_id, name, category, image_url, price_naira, stock_quantity, stock_status, created_by_user_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        productId,
        schoolId,
        name,
        category || 'General',
        imageUrl || null,
        priceNaira,
        stockQuantity,
        stockQuantity > 15 ? 'In Stock' : stockQuantity > 0 ? 'Low Stock' : 'Out of Stock',
        actor.id,
      );

      db.prepare('INSERT INTO tuckshop_audit_logs (id, school_id, actor_user_id, action, details_json) VALUES (?, ?, ?, ?, ?)').run(
        makeId('tuck_audit'),
        schoolId,
        actor.id,
        'product_created',
        JSON.stringify({ productId, name, category, priceNaira, stockQuantity }),
      );
      res.json({ id: productId, status: 'created' });
    } catch (err) {
      console.error('Error creating tuckshop product:', err);
      res.status(500).json({ error: 'Internal Server Error', detail: String(err) });
    }
  });

  app.post('/api/tuckshop/products/:productId', requireRoles(...TUCKSHOP_MANAGER_ROLES), (req, res) => {
    try {
      const schoolId = resolveSchoolId(req);
      const actor = resolveActor(req);
      const productId = typeof req.params?.productId === 'string' ? req.params.productId : '';
      const priceNaira = Number(req.body?.priceNaira || 0);
      const imageUrl = typeof req.body?.imageUrl === 'string' ? req.body.imageUrl : '';
      const stockQuantity = req.body?.stockQuantity === undefined ? undefined : Math.max(0, Number(req.body.stockQuantity || 0));
      const product = db.prepare('SELECT id FROM tuckshop_products WHERE school_id = ? AND id = ?').get(schoolId, productId) as { id?: string } | undefined;
      if (!product?.id) return res.status(404).json({ error: 'Product not found' });

      if (stockQuantity === undefined) {
        db.prepare('UPDATE tuckshop_products SET price_naira = ?, image_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(priceNaira, imageUrl || null, productId);
      } else {
        db.prepare(`
          UPDATE tuckshop_products
          SET price_naira = ?, image_url = ?, stock_quantity = ?, stock_status = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(priceNaira, imageUrl || null, stockQuantity, stockQuantity > 15 ? 'In Stock' : stockQuantity > 0 ? 'Low Stock' : 'Out of Stock', productId);
      }

      db.prepare('INSERT INTO tuckshop_audit_logs (id, school_id, actor_user_id, action, details_json) VALUES (?, ?, ?, ?, ?)').run(
        makeId('tuck_audit'),
        schoolId,
        actor.id,
        'product_updated',
        JSON.stringify({ productId, priceNaira, imageUrl, stockQuantity }),
      );
      res.json({ productId, status: 'updated' });
    } catch (err) {
      console.error('Error updating tuckshop product:', err);
      res.status(500).json({ error: 'Internal Server Error', detail: String(err) });
    }
  });

  app.post('/api/tuckshop/purchase-blocks', requireRoles('Parent'), (req, res) => {
    try {
      const scope = getTuckshopScope(req);
      const actor = resolveActor(req);
      const studentUserId = typeof req.body?.studentUserId === 'string' ? req.body.studentUserId : '';
      const productId = typeof req.body?.productId === 'string' ? req.body.productId : '';
      const reason = typeof req.body?.reason === 'string' ? req.body.reason : '';
      const blocked = req.body?.blocked !== false;
      if (!studentUserId || !productId || !scope.viewerUserId) return res.status(400).json({ error: 'studentUserId and productId are required' });
      if (!scope.childUserIds.includes(studentUserId)) return res.status(403).json({ error: 'You can only manage blocks for your linked children' });

      const existing = db.prepare('SELECT id FROM tuckshop_purchase_blocks WHERE school_id = ? AND parent_user_id = ? AND student_user_id = ? AND product_id = ?').get(scope.schoolId, scope.viewerUserId, studentUserId, productId) as { id?: string } | undefined;
      if (existing?.id) {
        db.prepare('UPDATE tuckshop_purchase_blocks SET is_blocked = ?, reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(blocked ? 1 : 0, reason, existing.id);
      } else {
        db.prepare(`
          INSERT INTO tuckshop_purchase_blocks (
            id, school_id, parent_user_id, student_user_id, product_id, reason, is_blocked
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(makeId('tuck_block'), scope.schoolId, scope.viewerUserId, studentUserId, productId, reason, blocked ? 1 : 0);
      }

      db.prepare('INSERT INTO tuckshop_audit_logs (id, school_id, actor_user_id, action, details_json) VALUES (?, ?, ?, ?, ?)').run(
        makeId('tuck_audit'),
        scope.schoolId,
        actor.id,
        blocked ? 'purchase_block_enabled' : 'purchase_block_disabled',
        JSON.stringify({ studentUserId, productId, reason }),
      );

      res.json({ studentUserId, productId, blocked, reason });
    } catch (err) {
      console.error('Error updating purchase block:', err);
      res.status(500).json({ error: 'Internal Server Error', detail: String(err) });
    }
  });

  app.post('/api/tuckshop/payment-accounts', requireRoles(...TUCKSHOP_MANAGER_ROLES), (req, res) => {
    try {
      const schoolId = resolveSchoolId(req);
      const actor = resolveActor(req);
      const method = typeof req.body?.method === 'string' ? req.body.method : '';
      const accountName = typeof req.body?.accountName === 'string' ? req.body.accountName : '';
      const accountNumber = typeof req.body?.accountNumber === 'string' ? req.body.accountNumber : '';
      const bankName = typeof req.body?.bankName === 'string' ? req.body.bankName : '';
      const auraWalletId = typeof req.body?.auraWalletId === 'string' ? req.body.auraWalletId : '';
      const instructions = typeof req.body?.instructions === 'string' ? req.body.instructions : '';
      if (!method) return res.status(400).json({ error: 'method is required' });

      const existing = db.prepare('SELECT id FROM tuckshop_payment_accounts WHERE school_id = ? AND method = ?').get(schoolId, method) as { id?: string } | undefined;
      if (existing?.id) {
        db.prepare(`
          UPDATE tuckshop_payment_accounts
          SET account_name = ?, account_number = ?, bank_name = ?, aura_wallet_id = ?, instructions = ?, is_active = 1, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(accountName, accountNumber, bankName, auraWalletId, instructions, existing.id);
      } else {
        db.prepare(`
          INSERT INTO tuckshop_payment_accounts (
            id, school_id, method, account_name, account_number, bank_name, aura_wallet_id, instructions, is_active, created_by_user_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
        `).run(makeId('tuck_payacct'), schoolId, method, accountName, accountNumber, bankName, auraWalletId, instructions, actor.id);
      }

      db.prepare('INSERT INTO tuckshop_audit_logs (id, school_id, actor_user_id, action, details_json) VALUES (?, ?, ?, ?, ?)').run(
        makeId('tuck_audit'),
        schoolId,
        actor.id,
        'payment_account_saved',
        JSON.stringify({ method, accountName, bankName, auraWalletId }),
      );
      res.json({ method, status: 'saved' });
    } catch (err) {
      console.error('Error saving payment account:', err);
      res.status(500).json({ error: 'Internal Server Error', detail: String(err) });
    }
  });

  app.post('/api/tuckshop/payments/acknowledge', requireRoles(...TUCKSHOP_ACCESS_ROLES), (req, res) => {
    try {
      const schoolId = resolveSchoolId(req);
      const actor = resolveActor(req);
      const orderId = typeof req.body?.orderId === 'string' ? req.body.orderId : '';
      const method = typeof req.body?.method === 'string' ? req.body.method : 'Bank Transfer';
      if (orderId) {
        db.prepare('UPDATE tuckshop_orders SET payment_method = ?, status = ? WHERE school_id = ? AND id = ?').run(method, 'Payment sent', schoolId, orderId);
      }
      db.prepare('INSERT INTO tuckshop_audit_logs (id, school_id, actor_user_id, action, details_json) VALUES (?, ?, ?, ?, ?)').run(
        makeId('tuck_audit'),
        schoolId,
        actor.id,
        'payment_acknowledged',
        JSON.stringify({ orderId, method }),
      );
      res.json({ status: 'acknowledged', orderId, method });
    } catch (err) {
      console.error('Error acknowledging payment:', err);
      res.status(500).json({ error: 'Internal Server Error', detail: String(err) });
    }
  });

  // Notifications
  app.get('/api/notifications', (req, res) => {
    try {
      const user = (req as any).user;
      if (!user) return res.status(401).json({ error: 'Unauthenticated' });
      const schoolId = user.school_id || req.header('x-school-id') || 'school_1';
      const notifications = db.prepare(`
        SELECT id, message, COALESCE(type, 'info') as type, COALESCE(is_read, 0) as is_read, COALESCE(created_at, CURRENT_TIMESTAMP) as created_at
        FROM notifications
        WHERE user_id = ? OR school_id = ? OR user_id = ''
        ORDER BY COALESCE(created_at, CURRENT_TIMESTAMP) DESC, rowid DESC
      `).all(user.id, schoolId) as any[];
      res.json(notifications.map((notification) => ({
        id: notification.id,
        message: notification.message,
        type: notification.type || 'info',
        is_read: Boolean(notification.is_read),
        created_at: notification.created_at || new Date().toISOString(),
      })));
    } catch (err) {
      console.error('Error fetching notifications:', err);
      res.status(500).json({ error: 'Internal Server Error', detail: String(err) });
    }
  });

  app.post('/api/notifications', requireRoles('Super Admin', 'HOS', 'School Admin', 'Owner'), (req, res) => {
    try {
      const user = (req as any).user;
      const schoolId = user.school_id || req.header('x-school-id') || 'school_1';
      const { message, targetRole, targetGroup, targetUser } = req.body;
      
      const id = 'notif_' + Date.now() + '_' + Math.random().toString(36).substring(2,9);
      
      const resolvedUserId = targetUser || (targetRole ? 'role:'+targetRole : '');

      db.prepare("INSERT INTO notifications (id, school_id, user_id, message, type, is_read, created_at) VALUES (?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP)")
        .run(id, schoolId, resolvedUserId, message, 'info');

      res.json({ id, message: 'Notification sent successfully' });
      
    } catch (err) {
      console.error('Error creating notification:', err);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  app.put('/api/notifications/:id/read', (req, res) => {
    try {
      const user = (req as any).user;
      if (!user) return res.status(401).json({ error: 'Unauthenticated' });
      const schoolId = user.school_id || req.header('x-school-id') || 'school_1';
      db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND (user_id = ? OR school_id = ? OR user_id = \'\')').run(req.params.id, user.id, schoolId);
      res.json({ ok: true });
    } catch (err) {
      console.error('Error marking notification read:', err);
      res.status(500).json({ error: 'Internal Server Error', detail: String(err) });
    }
  });

  // Vite middleware for development
  // Serve processed uploads and provide an image upload endpoint
  app.use('/uploads', (req, res, next) => {
    // Classroom uploads are intentionally excluded from public static access.
    if (req.path.includes('/classroom/')) return res.status(404).json({ error: 'Not found' });
    return next();
  }, express.static(uploadsDir));

  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

  app.post('/api/uploads/logo', upload.single('logo'), async (req, res) => {
    try {
      const file = req.file as Express.Multer.File | undefined;
      if (!file) return res.status(400).json({ error: 'no file uploaded' });

      const schoolId = (req.body && req.body.school_id) || ((req as any).user && (req as any).user.school_id) || 'school_1';

      const uploadBase = path.join(uploadsDir, String(schoolId));
      await fs.promises.mkdir(uploadBase, { recursive: true });
      const ts = Date.now();
      const names = {
        original: `${ts}-original.png`,
        large: `${ts}-large.png`,
        thumb: `${ts}-thumb.png`,
        favicon: `${ts}-favicon.png`
      };

      await Promise.all([
        sharp(file.buffer).png().resize({ width: 1200, withoutEnlargement: true }).toFile(path.join(uploadBase, names.large)),
        sharp(file.buffer).png().resize(200, 200, { fit: 'cover' }).toFile(path.join(uploadBase, names.thumb)),
        sharp(file.buffer).png().resize(32, 32, { fit: 'cover' }).toFile(path.join(uploadBase, names.favicon)),
        fs.promises.writeFile(path.join(uploadBase, names.original), file.buffer),
      ]);

      const baseUrl = `/uploads/${schoolId}`;
      const urls = {
        large: `${baseUrl}/${names.large}`,
        thumb: `${baseUrl}/${names.thumb}`,
        favicon: `${baseUrl}/${names.favicon}`,
        original: `${baseUrl}/${names.original}`
      };

      try {
        db.prepare('UPDATE schools SET logo_url = ? WHERE id = ?').run(urls.large, schoolId);
      } catch (e) {
        console.warn('Failed to update school logo_url', e);
      }

      return res.json({ ok: true, urls });
    } catch (err) {
      console.error('upload error', err);
      return res.status(500).json({ error: String(err) });
    }
  });

  app.post('/api/uploads/payment-proof', upload.single('proof'), async (req, res) => {
    try {
      const file = req.file as Express.Multer.File | undefined;
      if (!file) return res.status(400).json({ error: 'no file uploaded' });
      const waitToken = typeof req.body?.waitToken === 'string' ? req.body.waitToken.trim() : 'general';
      const folder = path.join(uploadsDir, 'onboarding');
      await fs.promises.mkdir(folder, { recursive: true });
      const safeName = `${Date.now()}-${waitToken}-${file.originalname.replace(/[^a-z0-9._-]+/gi, '_')}`;
      await fs.promises.writeFile(path.join(folder, safeName), file.buffer);
      return res.json({ ok: true, url: `/uploads/onboarding/${safeName}` });
    } catch (err) {
      console.error('payment proof upload error', err);
      return res.status(500).json({ error: String(err) });
    }
  });

  app.get('/api/result-uploads', requireRoles('HoS', 'Owner', 'ICT Manager', 'School Admin'), (req, res) => {
    try {
      const schoolId = resolveSchoolId(req);
      const uploads = db.prepare(`
        SELECT ru.*, u.name as uploader_name
        FROM result_uploads ru
        LEFT JOIN users u ON u.id = ru.uploader_user_id
        WHERE ru.school_id = ?
        ORDER BY datetime(ru.created_at) DESC, ru.id DESC
      `).all(schoolId) as any[];
      res.json({
        uploads: uploads.map((item) => ({
          ...item,
          uploaderName: item.uploader_name || item.uploader_role,
        })),
      });
    } catch (err) {
      console.error('result uploads fetch error', err);
      res.status(500).json({ error: 'Unable to fetch result uploads.' });
    }
  });

  app.post('/api/result-uploads', requireRoles('HoS', 'Owner', 'ICT Manager', 'School Admin'), upload.single('file'), async (req, res) => {
    try {
      const file = req.file as Express.Multer.File | undefined;
      if (!file) return res.status(400).json({ error: 'A result file is required.' });
      const schoolId = resolveSchoolId(req);
      const actor = resolveActor(req);
      const folder = path.join(uploadsDir, schoolId, 'results');
      await fs.promises.mkdir(folder, { recursive: true });
      const safeName = `${Date.now()}-${file.originalname.replace(/[^a-z0-9._-]+/gi, '_')}`;
      await fs.promises.writeFile(path.join(folder, safeName), file.buffer);
      const fileUrl = `/uploads/${schoolId}/results/${safeName}`;
      const title = typeof req.body?.title === 'string' && req.body.title.trim() ? req.body.title.trim() : file.originalname;
      const session = typeof req.body?.session === 'string' ? req.body.session.trim() : '';
      const term = typeof req.body?.term === 'string' ? req.body.term.trim() : '';
      const className = typeof req.body?.className === 'string' ? req.body.className.trim() : '';
      const resultType = typeof req.body?.resultType === 'string' ? req.body.resultType.trim() : 'Result Sheet';
      const notes = typeof req.body?.notes === 'string' ? req.body.notes.trim() : '';
      const id = makeId('result_upload');
      db.prepare(`
        INSERT INTO result_uploads (
          id, school_id, uploader_user_id, uploader_role, title, session, term, class_name, result_type, file_name, file_url, notes, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, schoolId, actor.id, actor.role, title, session || null, term || null, className || null, resultType, file.originalname, fileUrl, notes || null, 'uploaded');
      res.json({ ok: true, id, fileUrl });
    } catch (err) {
      console.error('result upload error', err);
      res.status(500).json({ error: 'Unable to upload result file.' });
    }
  });

  // Persist website configuration for a school (website builder save)
  app.post('/api/schools/website', (req, res) => {
    try {
      const { school_id, website_config, primary_color, logo_url } = req.body;
      if (!school_id) return res.status(400).json({ error: 'school_id required' });

      const configStr = typeof website_config === 'string' ? website_config : JSON.stringify(website_config || {});

      db.prepare('UPDATE schools SET website_config = ?, primary_color = COALESCE(?, primary_color), logo_url = COALESCE(?, logo_url) WHERE id = ?')
        .run(configStr, primary_color || null, logo_url || null, school_id);

      return res.json({ ok: true });
    } catch (err) {
      console.error('save website error', err);
      return res.status(500).json({ error: String(err) });
    }
  });

  // Generic media upload endpoint (images for pages/events)
  app.post('/api/uploads/media', upload.single('image'), async (req, res) => {
    try {
      const file = req.file as Express.Multer.File | undefined;
      if (!file) return res.status(400).json({ error: 'no file uploaded' });
      const schoolId = (req.body && req.body.school_id) || ((req as any).user && (req as any).user.school_id) || 'school_1';
      const uploadBase = path.join(uploadsDir, String(schoolId), 'media');
      await fs.promises.mkdir(uploadBase, { recursive: true });
      const ts = Date.now();
      const name = `${ts}-media.png`;
      await sharp(file.buffer).png().resize({ width: 1600, withoutEnlargement: true }).toFile(path.join(uploadBase, name));
      const url = `/uploads/${schoolId}/media/${name}`;
      return res.json({ ok: true, url });
    } catch (err) {
      console.error('media upload error', err);
      return res.status(500).json({ error: String(err) });
    }
  });

  app.post('/api/upload-chunk', requireRoles('Teacher', 'Student', 'HoS', 'Parent', 'HoS'), upload.single('chunk'), async (req, res) => {
    try {
      const file = req.file as Express.Multer.File | undefined;
      if (!file) return res.status(400).json({ error: 'no chunk uploaded' });

      const sessionId = normalizeChunkSessionId(typeof req.body?.sessionId === 'string' ? req.body.sessionId : '');
      const index = Number(req.body?.index ?? -1);
      const type = req.body?.type === 'audio' || req.body?.type === 'video' ? req.body.type : null;
      const schoolId = ((req as any).user && (req as any).user.school_id) || 'school_1';

      if (!sessionId) return res.status(400).json({ error: 'sessionId required' });
      if (!Number.isInteger(index) || index < 0) return res.status(400).json({ error: 'valid chunk index required' });
      if (!type) return res.status(400).json({ error: 'valid recording type required' });

      const sessionDir = resolveChunkSessionDir(String(schoolId), sessionId);
      await fs.promises.mkdir(sessionDir, { recursive: true });
      const chunkPath = path.join(sessionDir, `${String(index).padStart(6, '0')}.part`);
      await fs.promises.writeFile(chunkPath, file.buffer);

      return res.json({ ok: true, index, sessionId });
    } catch (err) {
      console.error('classroom chunk upload error', err);
      return res.status(500).json({ error: String(err) });
    }
  });

  app.post('/api/upload-chunk/complete', requireRoles('Teacher', 'Student', 'HoS', 'Parent', 'HoS'), async (req, res) => {
    try {
      const sessionId = normalizeChunkSessionId(typeof req.body?.sessionId === 'string' ? req.body.sessionId : '');
      const fileName = typeof req.body?.fileName === 'string' ? req.body.fileName : '';
      const mimeType = typeof req.body?.mimeType === 'string' ? req.body.mimeType : '';
      const type = req.body?.type === 'audio' || req.body?.type === 'video' ? req.body.type : null;
      const schoolId = ((req as any).user && (req as any).user.school_id) || 'school_1';

      if (!sessionId) return res.status(400).json({ error: 'sessionId required' });
      if (!fileName) return res.status(400).json({ error: 'fileName required' });
      if (!type) return res.status(400).json({ error: 'valid recording type required' });

      const asset = await assembleChunkedUpload({
        fileName,
        mimeType,
        schoolId: String(schoolId),
        sessionId,
        type,
      });

      return res.json(asset);
    } catch (err) {
      console.error('classroom chunk assembly error', err);
      return res.status(500).json({ error: String(err) });
    }
  });

  app.post('/api/uploads/classroom-asset', upload.single('asset'), async (req, res) => {
    try {
      const file = req.file as Express.Multer.File | undefined;
      if (!file) return res.status(400).json({ error: 'no file uploaded' });
      const detectedType = detectClassroomAssetType(file);
      if (!detectedType) {
        return res.status(400).json({ error: 'unsupported file type' });
      }

      const schoolId = (req.body && req.body.school_id) || ((req as any).user && (req as any).user.school_id) || 'school_1';
      const uploadBase = path.join(uploadsDir, String(schoolId), 'classroom');
      await fs.promises.mkdir(uploadBase, { recursive: true });

      const ext = path.extname(file.originalname)
        || (detectedType === 'image'
          ? '.png'
          : detectedType === 'audio'
            ? '.webm'
            : detectedType === 'video'
              ? '.webm'
              : detectedType === 'pdf'
                ? '.pdf'
                : detectedType === 'slides'
                  ? '.pptx'
                  : '.docx');
      const ts = Date.now();
      const safeName = `${ts}-${Math.random().toString(36).slice(2, 8)}${ext}`;
      const storageKey = `${schoolId}/classroom/${safeName}`;
      await fs.promises.writeFile(resolvePrivateClassroomAssetPath(storageKey), file.buffer);

      const url = buildPrivateClassroomAssetUrl(String(schoolId), storageKey);
      return res.json({ ok: true, url, storageKey, name: file.originalname, mimeType: file.mimetype || `${detectedType}/${ext.replace('.', '')}`, size: file.size, assetType: detectedType, viewerType: detectedType });
    } catch (err) {
      console.error('classroom asset upload error', err);
      return res.status(500).json({ error: String(err) });
    }
  });

  app.get('/api/classroom/assets', async (req, res) => {
    try {
      const storageKey = typeof req.query.key === 'string' ? decodeURIComponent(req.query.key) : '';
      const token = typeof req.query.token === 'string' ? req.query.token : '';
      const expires = Number(req.query.expires || 0);
      const normalizedKey = normalizeClassroomAssetKey(storageKey);
      if (!normalizedKey) return res.status(400).json({ error: 'invalid asset key' });
      const schoolId = normalizedKey.split('/')[0];
      if (!schoolId) return res.status(400).json({ error: 'invalid asset school' });
      if (!normalizedKey.startsWith(`${schoolId}/classroom/`)) return res.status(403).json({ error: 'forbidden asset access' });
      if (!expires || expires < Date.now()) return res.status(403).json({ error: 'asset link expired' });

      const expectedToken = signClassroomAssetToken(schoolId, normalizedKey, expires);
      if (token !== expectedToken) return res.status(403).json({ error: 'invalid asset token' });

      const filePath = resolvePrivateClassroomAssetPath(normalizedKey);
      if (!fs.existsSync(filePath) || isClassroomAssetExpired(filePath)) return res.status(404).json({ error: 'asset not found' });
      res.setHeader('Content-Disposition', `inline; filename="${path.basename(filePath).replace(/"/g, '')}"`);
      return res.sendFile(filePath);
    } catch (err) {
      console.error('private classroom asset error', err);
      return res.status(500).json({ error: String(err) });
    }
  });

  // Website content endpoints: get website config
  app.get('/api/schools/:id/website', (req, res) => {
    const id = req.params.id;
    const row = db.prepare('SELECT website_config FROM schools WHERE id = ?').get(id);
    if (!row || !row.website_config) return res.json({ website: null });
    try {
      const website = JSON.parse(row.website_config);
      return res.json({ website });
    } catch (e) {
      return res.json({ website: null });
    }
  });

  // Add a page to website config
  app.post('/api/schools/:id/website/pages', (req, res) => {
    try {
      const id = req.params.id;
      const page = req.body.page;
      if (!page || !page.id) return res.status(400).json({ error: 'page object with id required' });
      const row = db.prepare('SELECT website_config FROM schools WHERE id = ?').get(id);
      let website = {} as any;
      if (row && row.website_config) {
        website = JSON.parse(row.website_config);
      }
      website.pages = website.pages || [];
      website.pages.push(page);
      const configStr = JSON.stringify(website);
      db.prepare('UPDATE schools SET website_config = ? WHERE id = ?').run(configStr, id);
      return res.json({ ok: true, page });
    } catch (err) {
      console.error('add page error', err);
      return res.status(500).json({ error: String(err) });
    }
  });

  // Upload image and attach to page
  app.post('/api/schools/:id/website/pages/:pageId/images', upload.single('image'), async (req, res) => {
    try {
      const id = req.params.id;
      const pageId = req.params.pageId;
      const file = req.file as Express.Multer.File | undefined;
      if (!file) return res.status(400).json({ error: 'no file uploaded' });
      const uploadBase = path.join(uploadsDir, String(id), 'media');
      await fs.promises.mkdir(uploadBase, { recursive: true });
      const ts = Date.now();
      const name = `${ts}-page.png`;
      await sharp(file.buffer).png().resize({ width: 1600, withoutEnlargement: true }).toFile(path.join(uploadBase, name));
      const url = `/uploads/${id}/media/${name}`;
      const row = db.prepare('SELECT website_config FROM schools WHERE id = ?').get(id);
      let website = {} as any;
      if (row && row.website_config) website = JSON.parse(row.website_config);
      website.pages = website.pages || [];
      const p = website.pages.find((pp: any) => pp.id === pageId);
      if (!p) return res.status(404).json({ error: 'page not found' });
      p.images = p.images || [];
      p.images.push(url);
      db.prepare('UPDATE schools SET website_config = ? WHERE id = ?').run(JSON.stringify(website), id);
      return res.json({ ok: true, url });
    } catch (err) {
      console.error('attach page image error', err);
      return res.status(500).json({ error: String(err) });
    }
  });

  // Events: create and list (stored inside website_config.events)
  app.post('/api/schools/:id/events', upload.single('image'), async (req, res) => {
    try {
      const id = req.params.id;
      const { title, description, date } = req.body;
      if (!title) return res.status(400).json({ error: 'title required' });
      const row = db.prepare('SELECT website_config FROM schools WHERE id = ?').get(id);
      let website = {} as any;
      if (row && row.website_config) website = JSON.parse(row.website_config);
      website.events = website.events || [];
      const ev: any = { id: `ev_${Date.now()}`, title, description: description || null, date: date || null };
      if (req.file) {
        const uploadBase = path.join(uploadsDir, String(id), 'events');
        await fs.promises.mkdir(uploadBase, { recursive: true });
        const ts = Date.now();
        const name = `${ts}-event.png`;
        await sharp(req.file.buffer).png().resize({ width: 1600, withoutEnlargement: true }).toFile(path.join(uploadBase, name));
        ev.image = `/uploads/${id}/events/${name}`;
      }
      website.events.push(ev);
      db.prepare('UPDATE schools SET website_config = ? WHERE id = ?').run(JSON.stringify(website), id);
      return res.json({ ok: true, event: ev });
    } catch (err) {
      console.error('create event error', err);
      return res.status(500).json({ error: String(err) });
    }
  });

  app.get('/api/schools/:id/events', (req, res) => {
    const id = req.params.id;
    const row = db.prepare('SELECT website_config FROM schools WHERE id = ?').get(id);
    let website = {} as any;
    if (row && row.website_config) {
      try { website = JSON.parse(row.website_config); } catch(e) { website = {}; }
    }
    return res.json({ events: website.events || [] });
  });

  // FAQs management
  app.post('/api/schools/:id/faqs', (req, res) => {
    try {
      const id = req.params.id;
      const { question, answer } = req.body;
      if (!question || !answer) return res.status(400).json({ error: 'question and answer required' });
      const row = db.prepare('SELECT website_config FROM schools WHERE id = ?').get(id);
      let website = {} as any;
      if (row && row.website_config) website = JSON.parse(row.website_config);
      website.faq = website.faq || [];
      const faq = { id: `faq_${Date.now()}`, question, answer };
      website.faq.push(faq);
      db.prepare('UPDATE schools SET website_config = ? WHERE id = ?').run(JSON.stringify(website), id);
      return res.json({ ok: true, faq });
    } catch (err) {
      console.error('add faq error', err);
      return res.status(500).json({ error: String(err) });
    }
  });

  app.get('/api/schools/:id/faqs', (req, res) => {
    const id = req.params.id;
    const row = db.prepare('SELECT website_config FROM schools WHERE id = ?').get(id);
    let website = {} as any;
    if (row && row.website_config) {
      try { website = JSON.parse(row.website_config); } catch(e) { website = {}; }
    }
    return res.json({ faqs: website.faq || [] });
  });

  // Enhanced FAQ-chatbot: professional greeting and richer replies using FAQ matching
  app.post('/api/faq/chat', express.json(), (req, res) => {
    try {
      const { school_id, question } = req.body as { school_id?: string; question?: string };
      if (!question) return res.status(400).json({ error: 'question required' });
      const id = school_id || 'school_1';
      const row = db.prepare('SELECT website_config FROM schools WHERE id = ?').get(id);
      let faqs: any[] = [];
      if (row && row.website_config) {
        try { const website = JSON.parse(row.website_config); faqs = website.faq || []; } catch (e) { faqs = []; }
      }
      const qRaw = (question || '').trim();
      const q = qRaw.toLowerCase();

      // detect simple greeting
      const greetings = ['hi','hello','hey','good morning','good afternoon','good evening'];
      let greetingFound = '';
      for (const g of greetings) if (q.startsWith(g)) { greetingFound = g; break; }

      // scoring by token overlap
      let best: any = null; let bestScore = 0;
      for (const f of faqs) {
        const fq = (f.question || '').toLowerCase();
        const tokens = fq.split(/\W+/).filter(Boolean);
        let score = 0;
        for (const t of tokens) if (q.includes(t)) score++;
        if (score > bestScore) { bestScore = score; best = f; }
      }

      const capitalize = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';

      if (best && bestScore > 0) {
        const answerText = best.answer || '';
        const reply = `${greetingFound ? capitalize(greetingFound) + '! ' : 'Hello! '}I\u2019m the Ndovera Assistant — here to help.\n\n${answerText}\n\nIf you\u2019d like more details, reply with a follow-up or contact support@ndovera.com.`;
        return res.json({ answer: reply, source: 'faq', matchedFaqId: best.id, confidence: bestScore });
      }

      const fallback = `${greetingFound ? capitalize(greetingFound) + '! ' : 'Hello! '}I\u2019m the Ndovera Assistant. I couldn\u2019t find an exact answer in the FAQ. I can help with registration, features, pricing, and setup. Try asking \"How do I register?\" or contact support@ndovera.com for direct assistance.`;
      return res.json({ answer: fallback, source: 'fallback', confidence: 0 });
    } catch (err) {
      console.error('faq chat error', err);
      return res.status(500).json({ error: String(err) });
    }
  });

  // Testimonials management stored in website_config.testimonials
  app.post('/api/schools/:id/testimonials', (req, res) => {
    try {
      const id = req.params.id;
      const { author, role, quote, featured } = req.body;
      if (!quote) return res.status(400).json({ error: 'quote required' });
      const row = db.prepare('SELECT website_config FROM schools WHERE id = ?').get(id);
      let website: any = {};
      if (row && row.website_config) website = JSON.parse(row.website_config);
      website.testimonials = website.testimonials || [];
      const t = { id: `t_${Date.now()}`, author: author || 'Anonymous', role: role || null, quote, featured: !!featured };
      website.testimonials.push(t);
      db.prepare('UPDATE schools SET website_config = ? WHERE id = ?').run(JSON.stringify(website), id);
      return res.json({ ok: true, testimonial: t });
    } catch (err) {
      console.error('add testimonial error', err);
      return res.status(500).json({ error: String(err) });
    }
  });

  app.get('/api/schools/:id/testimonials', (req, res) => {
    try {
      const id = req.params.id;
      const row = db.prepare('SELECT website_config FROM schools WHERE id = ?').get(id);
      let website: any = {};
      if (row && row.website_config) {
        try { website = JSON.parse(row.website_config); } catch (e) { website = {}; }
      }
      const all = website.testimonials || [];
      // return featured first then random subset
      const featured = all.filter((t: any) => t.featured);
      const pool = featured.length ? featured.concat(all.filter((t: any) => !t.featured)) : all;
      return res.json({ testimonials: pool });
    } catch (err) {
      console.error('get testimonials error', err);
      return res.status(500).json({ error: String(err) });
    }
  });

  app.patch('/api/schools/:id/testimonials/:tid', (req, res) => {
    try {
      const id = req.params.id;
      const tid = req.params.tid;
      const { featured } = req.body;
      const row = db.prepare('SELECT website_config FROM schools WHERE id = ?').get(id);
      if (!row || !row.website_config) return res.status(404).json({ error: 'not found' });
      let website: any = JSON.parse(row.website_config);
      website.testimonials = website.testimonials || [];
      const t = website.testimonials.find((x: any) => x.id === tid);
      if (!t) return res.status(404).json({ error: 'testimonial not found' });
      t.featured = !!featured;
      db.prepare('UPDATE schools SET website_config = ? WHERE id = ?').run(JSON.stringify(website), id);
      return res.json({ ok: true, testimonial: t });
    } catch (err) {
      console.error('patch testimonial error', err);
      return res.status(500).json({ error: String(err) });
    }
  });

  app.get('/api/schools/:id/vacancies', (req, res) => {
    try {
      const id = req.params.id;
      const row = db.prepare('SELECT name, website_config FROM schools WHERE id = ?').get(id) as { name?: string; website_config?: string | null } | undefined;
      if (!row) return res.json({ schoolName: null, vacancies: [] });
      const website = safeParseJson<any>(row.website_config, {});
      const vacancies = Array.isArray(website.vacancies) ? website.vacancies : [];
      return res.json({ schoolName: row.name || id, vacancies });
    } catch (err) {
      console.error('get school vacancies error', err);
      return res.status(500).json({ error: String(err) });
    }
  });

  app.post('/api/schools/:id/vacancies', requireRoles('HoS', 'HOS', 'School Admin', 'Owner', 'ICT Manager'), (req, res) => {
    try {
      const id = req.params.id;
      const { title, description, type, category, salary } = req.body as { title?: string; description?: string; type?: string; category?: string; salary?: string };
      if (!title || !description) return res.status(400).json({ error: 'title and description required' });

      const schoolRow = db.prepare('SELECT name, website_config FROM schools WHERE id = ?').get(id) as { name?: string; website_config?: string | null } | undefined;
      if (!schoolRow) return res.status(404).json({ error: 'school not found' });

      const website = safeParseJson<any>(schoolRow.website_config, {});
      website.vacancies = Array.isArray(website.vacancies) ? website.vacancies : [];

      const vacancy = {
        id: makeId('vacancy'),
        schoolId: id,
        schoolName: schoolRow.name || id,
        title,
        description,
        type: type || 'Full-time',
        category: category || 'Teaching',
        salary: salary || null,
        postedAt: new Date().toISOString(),
      };

      website.vacancies.unshift(vacancy);
      db.prepare('UPDATE schools SET website_config = ? WHERE id = ?').run(JSON.stringify(website), id);

      return res.json({ ok: true, vacancy });
    } catch (err) {
      console.error('post school vacancy error', err);
      return res.status(500).json({ error: String(err) });
    }
  });

  app.post('/api/growth-partners/apply', (req, res) => {
    try {
      const fullName = typeof req.body?.name === 'string' ? req.body.name.trim() : typeof req.body?.full_name === 'string' ? req.body.full_name.trim() : '';
      const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
      const phone = typeof req.body?.phone === 'string' ? req.body.phone.trim() : '';
      const region = typeof req.body?.city === 'string' ? req.body.city.trim() : typeof req.body?.region === 'string' ? req.body.region.trim() : '';
      const experience = typeof req.body?.notes === 'string' ? req.body.notes.trim() : typeof req.body?.experience === 'string' ? req.body.experience.trim() : '';
      const audience = typeof req.body?.audience === 'string' ? req.body.audience.trim() : 'Public website applicant';

      if (!fullName || !email) return res.status(400).json({ error: 'name and email are required' });

      const existing = db.prepare('SELECT id, status FROM growth_partner_applications WHERE email = ?').get(email) as { id?: string; status?: string } | undefined;
      if (existing?.id) {
        db.prepare(`
          UPDATE growth_partner_applications
          SET full_name = ?, phone = ?, region = ?, experience = ?, audience = ?
          WHERE id = ?
        `).run(fullName, phone || null, region || null, experience || null, audience || null, existing.id);
        return res.json({ ok: true, id: existing.id, status: existing.status || 'Pending', updated: true });
      }

      const id = makeId('growth_partner_application');
      db.prepare(`
        INSERT INTO growth_partner_applications (id, full_name, email, phone, region, experience, audience)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(id, fullName, email, phone || null, region || null, experience || null, audience || null);

      return res.json({ ok: true, id, status: 'Pending' });
    } catch (err) {
      console.error('growth partner apply error', err);
      return res.status(500).json({ error: String(err) });
    }
  });

  app.get('/api/growth-partners/applications', requireRoles('Owner', 'School Admin', 'HoS', 'HOS', 'Ami', 'Super Admin'), (req, res) => {
    try {
      const applications = db.prepare(`
        SELECT id, full_name, email, phone, region, experience, audience, status, reviewed_by, created_at
        FROM growth_partner_applications
        ORDER BY datetime(created_at) DESC
      `).all();
      return res.json({ applications });
    } catch (err) {
      console.error('growth partner applications error', err);
      return res.status(500).json({ error: String(err) });
    }
  });

  const STAFF_TRAINING_ACCESS_ROLES = ['Teacher', 'HoS', 'HOS', 'School Admin', 'ICT Manager', 'Owner', 'Finance Officer', 'Librarian', 'Clinic Manager', 'Hostel Manager', 'Tuckshop Manager'] as const;
  const STAFF_TRAINING_MANAGER_ROLES = ['HoS', 'HOS', 'School Admin', 'ICT Manager', 'Owner'] as const;

  app.get('/api/staff-training', requireRoles(...STAFF_TRAINING_ACCESS_ROLES), (req, res) => {
    try {
      const schoolId = resolveSchoolId(req);
      const materials = db.prepare(`
        SELECT id, title, description, material_type, resource_url, audience, due_date, required_completion, created_at
        FROM staff_training_materials
        WHERE school_id = ?
        ORDER BY datetime(created_at) DESC, rowid DESC
      `).all(schoolId) as any[];
      const sessions = db.prepare(`
        SELECT s.id, s.title, s.summary, s.schedule, s.duration, s.live_session_id, s.material_ids_json, s.created_at,
               COALESCE(l.attendees, 0) as attendees,
               COALESCE(l.limit_count, 300) as limit_count,
               COALESCE(l.status, 'scheduled') as live_status
        FROM staff_training_sessions s
        LEFT JOIN classroom_live_sessions l ON l.id = s.live_session_id
        WHERE s.school_id = ?
        ORDER BY datetime(s.created_at) DESC, s.rowid DESC
      `).all(schoolId) as any[];
      const completions = db.prepare(`
        SELECT id, material_id, user_id, completed_at
        FROM staff_training_completions
        WHERE school_id = ?
      `).all(schoolId) as any[];
      const actor = resolveActor(req);

      return res.json({
        materials: materials.map((material) => ({
          id: material.id,
          title: material.title,
          description: material.description || '',
          materialType: material.material_type || 'Guide',
          resourceUrl: material.resource_url || '',
          audience: material.audience || 'All Staff',
          dueDate: material.due_date || '',
          requiredCompletion: Boolean(material.required_completion),
          completedCount: completions.filter((completion) => completion.material_id === material.id).length,
          completedByViewer: completions.some((completion) => completion.material_id === material.id && completion.user_id === actor.id),
          createdAt: material.created_at,
        })),
        sessions: sessions.map((session) => ({
          id: session.id,
          title: session.title,
          summary: session.summary || '',
          schedule: session.schedule || 'TBD',
          duration: session.duration || '60 mins',
          liveSessionId: session.live_session_id || null,
          materialIds: safeParseJson<string[]>(session.material_ids_json, []),
          attendees: Number(session.attendees || 0),
          limitCount: Number(session.limit_count || 300),
          liveStatus: session.live_status || 'scheduled',
          createdAt: session.created_at,
        })),
      });
    } catch (err) {
      console.error('staff training fetch error', err);
      return res.status(500).json({ error: String(err) });
    }
  });

  app.post('/api/staff-training/materials/:materialId/complete', requireRoles(...STAFF_TRAINING_ACCESS_ROLES), (req, res) => {
    try {
      const schoolId = resolveSchoolId(req);
      const actor = resolveActor(req);
      const material = db.prepare('SELECT id FROM staff_training_materials WHERE id = ? AND school_id = ?').get(req.params.materialId, schoolId) as { id?: string } | undefined;
      if (!material?.id) return res.status(404).json({ error: 'Training material not found' });

      const existing = db.prepare('SELECT id FROM staff_training_completions WHERE material_id = ? AND user_id = ?').get(req.params.materialId, actor.id) as { id?: string } | undefined;
      if (!existing?.id) {
        db.prepare('INSERT INTO staff_training_completions (id, school_id, material_id, user_id) VALUES (?, ?, ?, ?)')
          .run(makeId('staff_training_completion'), schoolId, req.params.materialId, actor.id);
      }

      const completedCount = db.prepare('SELECT COUNT(*) as count FROM staff_training_completions WHERE material_id = ?').get(req.params.materialId) as { count?: number } | undefined;
      return res.json({ ok: true, completed: true, completedCount: Number(completedCount?.count || 0) });
    } catch (err) {
      console.error('staff training completion error', err);
      return res.status(500).json({ error: String(err) });
    }
  });

  const SHARED_FILE_ACCESS_ROLES = ['Teacher', 'Student', 'Parent', 'School Admin', 'HoS', 'HOS', 'ICT Manager', 'Finance Officer', 'Librarian', 'Clinic Manager', 'Hostel Manager', 'Tuckshop Manager', 'Owner', 'Super Admin', 'Ami'] as const;
  const SHARED_FILE_MANAGER_ROLES = ['Teacher', 'School Admin', 'HoS', 'HOS', 'ICT Manager', 'Owner', 'Super Admin', 'Ami', 'Librarian'] as const;

  app.get('/api/shared-files', requireRoles(...SHARED_FILE_ACCESS_ROLES), (req, res) => {
    try {
      const schoolId = resolveSchoolId(req);
      const files = db.prepare(`
        SELECT sf.*, COALESCE(u.name, sf.created_by, 'System') as created_by_name
        FROM shared_files sf
        LEFT JOIN users u ON u.id = sf.created_by
        WHERE sf.scope = 'ndovera'
           OR (sf.scope IN ('school', 'tenant') AND sf.school_id = ?)
        ORDER BY CASE sf.scope WHEN 'ndovera' THEN 0 WHEN 'tenant' THEN 1 ELSE 2 END, datetime(sf.created_at) DESC, sf.rowid DESC
      `).all(schoolId) as any[];

      return res.json({
        files: files.map((file) => ({
          id: file.id,
          title: file.title,
          description: file.description || '',
          resourceUrl: file.resource_url || '',
          scope: file.scope || 'school',
          sourceType: file.source_type || 'tenant',
          fileType: file.file_type || 'Link',
          createdBy: file.created_by_name || 'System',
            tags: file.tags || 'General',
            classGroup: file.class_group,
            subject: file.subject,
          createdAt: file.created_at,
        })),
      });
    } catch (err) {
      console.error('shared files fetch error', err);
      return res.status(500).json({ error: String(err) });
    }
  });


  // Mock Virus Scanner & Image Reducer
  async function mockVirusScan(buffer: Buffer): Promise<boolean> {
    // In production, send to ClamAV or similar service.
    // For now, always clean unless it contains a dummy signature.
    if (buffer.toString('utf8').includes('EICAR-STANDARD-ANTIVIRUS-TEST-FILE')) {
      return false; 
    }
    return true;
  }

  async function mockImageServiceProcess(buffer: Buffer, mimetype: string): Promise<Buffer> {
    // In production, pass to an Image Processing service (like sharp) to reduce size.
    // We return original buffer for this mock.
    return buffer;
  }

  app.post('/api/shared-files/upload', upload.single('file'), requireRoles(...SHARED_FILE_MANAGER_ROLES), async (req, res) => {
    try {
      const schoolId = resolveSchoolId(req);
      const actor = resolveActor(req);
      
      const file = req.file;
      if (!file) return res.status(400).json({ error: 'No file uploaded' });

      // Only allow Docs, PDF, Images
      const allowedMimes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png', 'image/webp'];
      if (!allowedMimes.includes(file.mimetype)) {
        return res.status(400).json({ error: 'Only DOC, PDF, and Images are allowed.' });
      }

      // Virus Scan
      const isClean = await mockVirusScan(file.buffer);
      if (!isClean) {
        return res.status(400).json({ error: 'Security Alert: Malware detected in file.' });
      }

      // If image, pass through image service to reduce size
      let processedBuffer = file.buffer;
      if (file.mimetype.startsWith('image/')) {
        processedBuffer = await mockImageServiceProcess(file.buffer, file.mimetype);
      }

      // Save to cloud (mocked to local uploads dir for now)
      const uploadBase = path.join(uploadsDir, String(schoolId), 'shared');
      if (!fs.existsSync(uploadBase)) {
        fs.mkdirSync(uploadBase, { recursive: true });
      }
      
      const ext = path.extname(file.originalname) || '';
      const filename = `shared_file_${Date.now()}${ext}`;
      const filePath = path.join(uploadBase, filename);
      fs.writeFileSync(filePath, processedBuffer);

      // We'll serve it as /uploads/:schoolId/shared/:filename
      const resourceUrl = `http://localhost:5174/uploads/${schoolId}/shared/${filename}`;

      const title = typeof req.body?.title === 'string' ? req.body.title.trim() : file.originalname;
      const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';
      const requestedScope = typeof req.body?.scope === 'string' ? req.body.scope.trim().toLowerCase() : 'school';
      const fileType = file.mimetype.startsWith('image/') ? 'Image/Media' : 'Document';
      
      const sourceType = requestedScope === 'ndovera' ? 'ndovera' : 'tenant';
      const scope = ['school', 'ndovera'].includes(requestedScope) ? requestedScope : 'school';

      if (scope === 'ndovera' && !['Owner', 'Super Admin', 'Ami'].includes(actor.role)) {
        return res.status(403).json({ error: 'Only Ndovera/global roles can publish Ndovera-origin files.' });
      }

      const id = makeId('shared_file');
      db.prepare('INSERT INTO shared_files (id, school_id, title, description, resource_url, scope, source_type, file_type, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(id, scope === 'ndovera' ? null : schoolId, title, description || null, resourceUrl, scope, sourceType, fileType, actor.id);

      return res.status(201).json({ ok: true, id, resourceUrl });
    } catch (err) {
      console.error('shared files upload error', err);
      return res.status(500).json({ error: String(err) });
    }
  });

  app.post('/api/shared-files', requireRoles(...SHARED_FILE_MANAGER_ROLES), (req, res) => {
    try {
      const schoolId = resolveSchoolId(req);
      const actor = resolveActor(req);
      const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
      const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';
      const resourceUrl = typeof req.body?.resourceUrl === 'string' ? req.body.resourceUrl.trim() : '';
      const requestedScope = typeof req.body?.scope === 'string' ? req.body.scope.trim().toLowerCase() : 'school';
      const fileType = typeof req.body?.fileType === 'string' ? req.body.fileType.trim() : 'Link';
        const tags = req.body?.tags || 'General';
        const classGroup = req.body?.classGroup || null;
        const subject = req.body?.subject || null;
      const sourceType = requestedScope === 'ndovera' ? 'ndovera' : 'tenant';
      const scope = ['school', 'tenant', 'ndovera'].includes(requestedScope) ? requestedScope : 'school';

      if (!title) return res.status(400).json({ error: 'title is required' });
      if (scope === 'ndovera' && !['Owner', 'Super Admin', 'Ami'].includes(actor.role)) {
        return res.status(403).json({ error: 'Only Ndovera/global roles can publish Ndovera-origin files.' });
      }

      const id = makeId('shared_file');
      db.prepare('INSERT INTO shared_files (id, school_id, title, description, resource_url, scope, source_type, file_type, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(id, scope === 'ndovera' ? null : schoolId, title, description || null, resourceUrl || null, scope, sourceType, fileType || 'Link', actor.id, tags, classGroup, subject);

      return res.status(201).json({ ok: true, id });
    } catch (err) {
      console.error('shared files create error', err);
      return res.status(500).json({ error: String(err) });
    }
  });

  app.post('/api/staff-training/materials', requireRoles(...STAFF_TRAINING_MANAGER_ROLES), (req, res) => {
    try {
      const schoolId = resolveSchoolId(req);
      const actor = resolveActor(req);
      const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
      const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';
      const materialType = typeof req.body?.materialType === 'string' ? req.body.materialType.trim() : 'Guide';
      const resourceUrl = typeof req.body?.resourceUrl === 'string' ? req.body.resourceUrl.trim() : '';
      const audience = typeof req.body?.audience === 'string' ? req.body.audience.trim() : 'All Staff';
      const dueDate = typeof req.body?.dueDate === 'string' ? req.body.dueDate.trim() : '';
      const requiredCompletion = req.body?.requiredCompletion ? 1 : 0;

      if (!title) return res.status(400).json({ error: 'title is required' });

      const id = makeId('staff_material');
      db.prepare(`
        INSERT INTO staff_training_materials (
          id, school_id, title, description, material_type, resource_url, audience, due_date, required_completion, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, schoolId, title, description || null, materialType || 'Guide', resourceUrl || null, audience || 'All Staff', dueDate || null, requiredCompletion, actor.id);

      const created = db.prepare(`
        SELECT id, title, description, material_type, resource_url, audience, due_date, required_completion, created_at
        FROM staff_training_materials WHERE id = ?
      `).get(id) as any;

      return res.status(201).json({
        ok: true,
        material: {
          id: created.id,
          title: created.title,
          description: created.description || '',
          materialType: created.material_type || 'Guide',
          resourceUrl: created.resource_url || '',
          audience: created.audience || 'All Staff',
          dueDate: created.due_date || '',
          requiredCompletion: Boolean(created.required_completion),
          createdAt: created.created_at,
        },
      });
    } catch (err) {
      console.error('staff training material create error', err);
      return res.status(500).json({ error: String(err) });
    }
  });

  app.post('/api/staff-training/sessions', requireRoles(...STAFF_TRAINING_MANAGER_ROLES), (req, res) => {
    try {
      const schoolId = resolveSchoolId(req);
      const actor = resolveActor(req);
      const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
      const summary = typeof req.body?.summary === 'string' ? req.body.summary.trim() : '';
      const schedule = typeof req.body?.schedule === 'string' ? req.body.schedule.trim() : 'TBD';
      const duration = typeof req.body?.duration === 'string' ? req.body.duration.trim() : '60 mins';
      const materialIds = (Array.isArray(req.body?.materialIds) ? req.body.materialIds : []).map((value: any) => String(value || '').trim()).filter(Boolean);

      if (!title) return res.status(400).json({ error: 'title is required' });

      const school = db.prepare('SELECT live_class_quota FROM schools WHERE id = ?').get(schoolId) as { live_class_quota?: number } | undefined;
      const liveClassQuota = Math.max(1, Number(school?.live_class_quota || 5));
      const activeSessionCount = db.prepare("SELECT COUNT(*) as count FROM classroom_live_sessions WHERE school_id = ? AND COALESCE(status, 'active') = 'active'").get(schoolId) as { count: number };
      if (activeSessionCount.count >= liveClassQuota) {
        return res.status(409).json({ error: `This school already has ${liveClassQuota} active live classrooms. End one before opening another.` });
      }

      const liveSessionId = makeId('live_staff_training');
      db.prepare('INSERT INTO classroom_live_sessions (id, school_id, title, mode, schedule, duration, attendees, limit_count, hosts_json, tools_json, note, status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(
          liveSessionId,
          schoolId,
          title,
          'Staff Training',
          schedule || 'TBD',
          duration || '60 mins',
          0,
          300,
          JSON.stringify([actor.name, 'Training Moderator']),
          JSON.stringify(['Live video', 'Moderated chat', 'Screen share', 'Attendance tracking', 'Replay-ready delivery']),
          summary || 'Staff training session linked to the live classroom.',
          'active',
          actor.id,
        );

      const id = makeId('staff_training_session');
      db.prepare(`
        INSERT INTO staff_training_sessions (
          id, school_id, title, summary, schedule, duration, live_session_id, material_ids_json, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, schoolId, title, summary || null, schedule || 'TBD', duration || '60 mins', liveSessionId, JSON.stringify(materialIds), actor.id);

      return res.status(201).json({
        ok: true,
        session: {
          id,
          title,
          summary,
          schedule,
          duration,
          liveSessionId,
          materialIds,
          attendees: 0,
          limitCount: 300,
          liveStatus: 'active',
        },
      });
    } catch (err) {
      console.error('staff training session create error', err);
      return res.status(500).json({ error: String(err) });
    }
  });

  app.get('/api/aptitude-tests', requireRoles('Teacher', 'HoS', 'HOS', 'School Admin', 'Owner', 'ICT Manager'), (req, res) => {
    try {
      const schoolId = resolveSchoolId(req);
      const tests = db.prepare(`
        SELECT id, title, category, description, duration_minutes, candidate_count, status, scheduled_for, average_score, success_rate, questions_json, created_at
        FROM aptitude_tests
        WHERE school_id = ?
        ORDER BY COALESCE(scheduled_for, created_at) DESC
      `).all(schoolId) as any[];
      return res.json({ tests: tests.map(mapAptitudeTestRecord), allowedCategories: getAllowedAptitudeCategories((req as any).user?.activeRole || (req as any).user?.roles?.[0]) });
    } catch (err) {
      console.error('aptitude tests fetch error', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  app.post('/api/aptitude-tests', requireRoles('Teacher', 'HoS', 'HOS', 'School Admin', 'Owner', 'ICT Manager'), (req, res) => {
    try {
      const schoolId = resolveSchoolId(req);
      const actor = resolveActor(req);
      const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
      const allowedCategories = getAllowedAptitudeCategories(actor.role);
      const requestedCategory = typeof req.body?.category === 'string' ? req.body.category.trim() : BASE_APTITUDE_CATEGORIES[0];
      const category = allowedCategories.includes(requestedCategory) ? requestedCategory : '';
      const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';
      const durationMinutes = Math.max(10, Number(req.body?.duration_minutes || 30));
      const candidateCount = Math.max(0, Number(req.body?.candidate_count || 0));
      const status = typeof req.body?.status === 'string' ? req.body.status : 'Draft';
      const scheduledFor = typeof req.body?.scheduled_for === 'string' ? req.body.scheduled_for : null;
      const questions = sanitizeAptitudeQuestions(req.body?.questions);

      if (!title) return res.status(400).json({ error: 'title is required' });
      if (!category) return res.status(403).json({ error: `Your current role can only create: ${allowedCategories.join(', ')}` });

      const id = makeId('aptitude_test');
      db.prepare(`
        INSERT INTO aptitude_tests (
          id, school_id, title, category, description, duration_minutes, candidate_count, status, scheduled_for, questions_json, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, schoolId, title, category, description || null, durationMinutes, candidateCount, status || 'Draft', scheduledFor, JSON.stringify(questions), actor.id);

      const created = db.prepare(`
        SELECT id, title, category, description, duration_minutes, candidate_count, status, scheduled_for, average_score, success_rate, questions_json, created_at
        FROM aptitude_tests WHERE id = ?
      `).get(id) as any;

      return res.status(201).json({ ok: true, test: mapAptitudeTestRecord(created) });
    } catch (err) {
      console.error('aptitude tests create error', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  app.patch('/api/aptitude-tests/:id', requireRoles('Teacher', 'HoS', 'HOS', 'School Admin', 'Owner', 'ICT Manager'), (req, res) => {
    try {
      const schoolId = resolveSchoolId(req);
      const actor = resolveActor(req);
      const id = req.params.id;
      const existing = db.prepare('SELECT * FROM aptitude_tests WHERE school_id = ? AND id = ?').get(schoolId, id) as any;
      if (!existing?.id) return res.status(404).json({ error: 'Aptitude test not found' });

      const allowedCategories = getAllowedAptitudeCategories(actor.role);
      const requestedCategory = typeof req.body?.category === 'string' ? req.body.category.trim() : existing.category;
      if (!allowedCategories.includes(requestedCategory)) {
        return res.status(403).json({ error: `Your current role can only use: ${allowedCategories.join(', ')}` });
      }

      const title = typeof req.body?.title === 'string' ? req.body.title.trim() : existing.title;
      const description = typeof req.body?.description === 'string' ? req.body.description.trim() : (existing.description || '');
      const durationMinutes = Math.max(10, Number(req.body?.duration_minutes ?? existing.duration_minutes ?? 30));
      const status = typeof req.body?.status === 'string' ? req.body.status : (existing.status || 'Draft');
      const candidateCount = Math.max(0, Number(req.body?.candidate_count ?? existing.candidate_count ?? 0));
      const averageScore = Math.max(0, Number(req.body?.average_score ?? existing.average_score ?? 0));
      const successRate = Math.max(0, Number(req.body?.success_rate ?? existing.success_rate ?? 0));
      const scheduledFor = typeof req.body?.scheduled_for === 'string' ? req.body.scheduled_for : (existing.scheduled_for || null);
      const questions = req.body?.questions === undefined
        ? sanitizeAptitudeQuestions(safeParseJson(existing.questions_json, []))
        : sanitizeAptitudeQuestions(req.body?.questions);

      db.prepare(`
        UPDATE aptitude_tests
        SET title = ?, category = ?, description = ?, duration_minutes = ?, status = ?, candidate_count = ?, average_score = ?, success_rate = ?, scheduled_for = ?, questions_json = ?
        WHERE id = ?
      `).run(title, requestedCategory, description || null, durationMinutes, status, candidateCount, averageScore, successRate, scheduledFor, JSON.stringify(questions), id);

      const updated = db.prepare(`
        SELECT id, title, category, description, duration_minutes, candidate_count, status, scheduled_for, average_score, success_rate, questions_json, created_at
        FROM aptitude_tests WHERE id = ?
      `).get(id) as any;

      return res.json({ ok: true, test: mapAptitudeTestRecord(updated) });
    } catch (err) {
      console.error('aptitude tests patch error', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  // ---------- School Admin / HoS management endpoints ----------
  

  app.post('/api/admin/students', requireRoles(...managementRoles), (req, res) => {
    try {
      const schoolId = resolveSchoolId(req);
      const { userId, classId, parentId, secondaryParentId } = req.body || {};
      if (!userId) return res.status(400).json({ error: 'userId is required to create a student profile' });

      const user = db.prepare('SELECT id, school_id FROM users WHERE id = ?').get(userId) as any;
      if (!user) return res.status(404).json({ error: 'User not found' });
      if (user.school_id !== schoolId) return res.status(403).json({ error: 'Target user belongs to another school' });

      const studentId = makeId('student');
      db.prepare('INSERT INTO students (id, school_id, user_id, class_id, parent_id, secondary_parent_id) VALUES (?, ?, ?, ?, ?, ?)')
        .run(studentId, schoolId, userId, classId || null, parentId || null);

      return res.status(201).json({ ok: true, studentId });
    } catch (err) {
      console.error('student create error', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  app.delete('/api/admin/students/:id', requireRoles(...managementRoles), (req, res) => {
    try {
      const schoolId = resolveSchoolId(req);
      const id = req.params.id;
      const existing = db.prepare('SELECT id, school_id FROM students WHERE id = ?').get(id) as any;
      if (!existing) return res.status(404).json({ error: 'Student not found' });
      if (existing.school_id !== schoolId) return res.status(403).json({ error: 'Target student belongs to another school' });

      db.prepare('DELETE FROM students WHERE id = ?').run(id);
      return res.json({ ok: true });
    } catch (err) {
      console.error('student delete error', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  app.post('/api/admin/students/:id/assign-class', requireRoles(...managementRoles), (req, res) => {
    try {
      const schoolId = resolveSchoolId(req);
      const id = req.params.id;
      const { classId } = req.body || {};
      if (!classId) return res.status(400).json({ error: 'classId is required' });

      const student = db.prepare('SELECT id, school_id FROM students WHERE id = ?').get(id) as any;
      if (!student) return res.status(404).json({ error: 'Student not found' });
      if (student.school_id !== schoolId) return res.status(403).json({ error: 'Target student belongs to another school' });

      const classroom = db.prepare('SELECT id, school_id FROM classes WHERE id = ?').get(classId) as any;
      if (!classroom) return res.status(404).json({ error: 'Class not found' });
      if (classroom.school_id !== schoolId) return res.status(403).json({ error: 'Class belongs to another school' });

      db.prepare('UPDATE students SET class_id = ? WHERE id = ?').run(classId, id);
      return res.json({ ok: true });
    } catch (err) {
      console.error('student assign class error', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  app.post('/api/admin/staff/assign-role', requireRoles(...managementRoles), (req, res) => {
    try {
      const schoolId = resolveSchoolId(req);
      const { userId, role } = req.body || {};
      if (!userId || !role) return res.status(400).json({ error: 'userId and role are required' });

      const user = db.prepare('SELECT id, school_id FROM users WHERE id = ?').get(userId) as any;
      if (!user) return res.status(404).json({ error: 'User not found' });
      if (user.school_id !== schoolId) return res.status(403).json({ error: 'Target user belongs to another school' });

      db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, userId);

      const lower = String(role).toLowerCase();
      if (lower.includes('teacher')) {
        const existingTeacher = db.prepare('SELECT id FROM teachers WHERE user_id = ?').get(userId) as any;
        if (!existingTeacher) {
          const teacherId = makeId('teacher');
          db.prepare('INSERT INTO teachers (id, school_id, user_id, staff_id, specialization) VALUES (?, ?, ?, ?, ?)')
            .run(teacherId, schoolId, userId, `staff_${Date.now()}`, null);
        }
      }

      return res.json({ ok: true });
    } catch (err) {
      console.error('staff assign role error', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  app.delete('/api/admin/staff/:userId', requireRoles(...managementRoles), (req, res) => {
    try {
      const schoolId = resolveSchoolId(req);
      const userId = req.params.userId;
      const user = db.prepare('SELECT id, school_id FROM users WHERE id = ?').get(userId) as any;
      if (!user) return res.status(404).json({ error: 'User not found' });
      if (user.school_id !== schoolId) return res.status(403).json({ error: 'Target user belongs to another school' });

      db.prepare('DELETE FROM teachers WHERE user_id = ?').run(userId);
      db.prepare('DELETE FROM users WHERE id = ?').run(userId);
      return res.json({ ok: true });
    } catch (err) {
      console.error('staff delete error', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  app.post('/api/admin/parents/link', requireRoles(...managementRoles), (req, res) => {
    try {
      const schoolId = resolveSchoolId(req);
      const { studentId, parentId } = req.body || {};
      if (!studentId || !parentId) return res.status(400).json({ error: 'studentId and parentId are required' });

      const student = db.prepare('SELECT id, school_id FROM students WHERE id = ?').get(studentId) as any;
      if (!student) return res.status(404).json({ error: 'Student not found' });
      if (student.school_id !== schoolId) return res.status(403).json({ error: 'Student belongs to another school' });

      const parent = db.prepare('SELECT id, school_id, role FROM users WHERE id = ?').get(parentId) as any;
      if (!parent) return res.status(404).json({ error: 'Parent user not found' });
      if (parent.school_id !== schoolId) return res.status(403).json({ error: 'Parent belongs to another school' });
      if (String(parent.role).toLowerCase() !== 'parent') return res.status(400).json({ error: 'Target user is not a Parent role' });

      db.prepare('UPDATE students SET parent_id = ? WHERE id = ?').run(parentId, studentId);
      return res.json({ ok: true });
    } catch (err) {
      console.error('parent link error', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  app.post('/api/admin/parents/unlink', requireRoles(...managementRoles), (req, res) => {
    try {
      const schoolId = resolveSchoolId(req);
      const { studentId } = req.body || {};
      if (!studentId) return res.status(400).json({ error: 'studentId is required' });

      const student = db.prepare('SELECT id, school_id FROM students WHERE id = ?').get(studentId) as any;
      if (!student) return res.status(404).json({ error: 'Student not found' });
      if (student.school_id !== schoolId) return res.status(403).json({ error: 'Student belongs to another school' });

      db.prepare('UPDATE students SET parent_id = NULL WHERE id = ?').run(studentId);
      return res.json({ ok: true });
    } catch (err) {
      console.error('parent unlink error', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  // Curriculum persistence
  db.exec(`
    CREATE TABLE IF NOT EXISTS classroom_curriculum (
      subject_id TEXT PRIMARY KEY,
      curriculum_json TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(subject_id) REFERENCES classroom_subjects(id)
    );
  `);
  
  app.put('/api/classroom/subjects/:subjectId/curriculum', (req, res) => {
    try {
      const user = (req as any).user;
      if (!user) return res.status(401).json({ error: 'Unauthenticated' });
      
      const { subjectId } = req.params;
      const { curriculum } = req.body;
      
      if (!subjectId || !curriculum) return res.status(400).json({ error: 'Missing subjectId or curriculum' });
      
      const curriculumJson = JSON.stringify(curriculum);
      
      const existing = db.prepare('SELECT subject_id FROM classroom_curriculum WHERE subject_id = ?').get(subjectId) as { subject_id: string } | undefined;
      
      if (existing) {
        db.prepare('UPDATE classroom_curriculum SET curriculum_json = ?, updated_at = CURRENT_TIMESTAMP WHERE subject_id = ?').run(curriculumJson, subjectId);
      } else {
        db.prepare('INSERT INTO classroom_curriculum (subject_id, curriculum_json) VALUES (?, ?)').run(subjectId, curriculumJson);
      }
      
      return res.json({ ok: true });
    } catch (err) {
      console.error('Error saving curriculum:', err);
      return res.status(500).json({ error: String(err) });
    }
  });

type DutyRosterTypeId = 'DAILY_DUTY' | 'MORNING_ASSEMBLY' | 'GENDER_ASSEMBLY' | 'STAFF_FELLOWSHIP' | 'STUDENT_FELLOWSHIP';

const DUTY_MANAGEMENT_ROLES = ['HoS', 'School Admin', 'Teacher', 'Owner', 'Staff', 'ICT Manager'];
const DUTY_ROSTER_MANAGER_ROLES = ['HoS', 'School Admin', 'Owner', 'ICT Manager'];
const DUTY_ROSTER_DEFINITIONS: Array<{
  id: DutyRosterTypeId;
  label: string;
  weekdays: number[];
  assistantSlots: 0 | 1 | 2;
  defaultNote: string;
}> = [
  { id: 'DAILY_DUTY', label: 'Daily Duty', weekdays: [1, 2, 3, 4, 5], assistantSlots: 2, defaultNote: 'Campus supervision, gate cover, break monitoring, and dismissal support.' },
  { id: 'MORNING_ASSEMBLY', label: 'Morning Assembly', weekdays: [1, 2, 3, 4, 5], assistantSlots: 0, defaultNote: 'Coordinate assembly timing, announcements, and posture checks.' },
  { id: 'GENDER_ASSEMBLY', label: 'Gender Assembly', weekdays: [3], assistantSlots: 1, defaultNote: 'Coordinate gender-based guidance sessions and supervision.' },
  { id: 'STAFF_FELLOWSHIP', label: 'Staff Fellowship', weekdays: [3], assistantSlots: 0, defaultNote: 'Lead the weekly staff fellowship or devotional session.' },
  { id: 'STUDENT_FELLOWSHIP', label: 'Student Fellowship', weekdays: [5], assistantSlots: 1, defaultNote: 'Supervise and coordinate the student fellowship gathering.' },
];

function normalizeDutyRosterType(value: any): DutyRosterTypeId {
  const normalized = String(value || 'DAILY_DUTY').trim().toUpperCase();
  const match = DUTY_ROSTER_DEFINITIONS.find((item) => item.id === normalized);
  return match?.id || 'DAILY_DUTY';
}

function getDutyRosterDefinition(value: any) {
  const rosterType = normalizeDutyRosterType(value);
  return DUTY_ROSTER_DEFINITIONS.find((item) => item.id === rosterType) || DUTY_ROSTER_DEFINITIONS[0];
}

function resolveDutyMonthKey(value: any) {
  const candidate = typeof value === 'string' ? value.trim() : '';
  if (/^\d{4}-\d{2}$/.test(candidate)) return candidate;
  return new Date().toISOString().slice(0, 7);
}

function listDutyRosterDates(monthKey: string, rosterType: DutyRosterTypeId) {
  const definition = getDutyRosterDefinition(rosterType);
  const [yearText, monthText] = monthKey.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const cursor = new Date(year, month - 1, 1);
  const dates: Array<{ date: string; dayLabel: string }> = [];

  while (cursor.getMonth() === month - 1) {
    const day = cursor.getDay();
    if (definition.weekdays.includes(day)) {
      const isoDate = cursor.toISOString().slice(0, 10);
      dates.push({
        date: isoDate,
        dayLabel: cursor.toLocaleDateString('en-US', { weekday: 'long' }),
      });
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

function getDutyRosterSettings(schoolId: string, rosterType: DutyRosterTypeId) {
  const existing = db.prepare(`
    SELECT school_id, roster_type, allow_same_class_pairing
    FROM duty_roster_settings
    WHERE school_id = ? AND roster_type = ?
  `).get(schoolId, rosterType) as { allow_same_class_pairing?: number } | undefined;

  if (!existing) {
    db.prepare(`
      INSERT OR IGNORE INTO duty_roster_settings (school_id, roster_type, allow_same_class_pairing)
      VALUES (?, ?, 0)
    `).run(schoolId, rosterType);
  }

  return {
    allowSameClassPairing: Boolean(existing?.allow_same_class_pairing || 0),
  };
}

function getDutyTeachingStaff(schoolId: string) {
  const rows = db.prepare(`
    SELECT
      t.user_id,
      t.staff_id,
      t.specialization,
      u.name,
      u.role,
      GROUP_CONCAT(DISTINCT c.id) as class_ids,
      GROUP_CONCAT(DISTINCT c.name) as class_names
    FROM teachers t
    JOIN users u ON u.id = t.user_id
    LEFT JOIN classes c ON c.teacher_id = t.id
    WHERE t.school_id = ?
    GROUP BY t.user_id, t.staff_id, t.specialization, u.name, u.role
    ORDER BY u.name ASC
  `).all(schoolId) as Array<{
    user_id: string;
    staff_id: string | null;
    specialization: string | null;
    name: string;
    role: string;
    class_ids: string | null;
    class_names: string | null;
  }>;

  return rows.map((row) => ({
    userId: row.user_id,
    name: row.name,
    role: row.role,
    staffId: row.staff_id,
    specialization: row.specialization,
    classIds: row.class_ids ? row.class_ids.split(',').filter(Boolean) : [],
    classNames: row.class_names ? row.class_names.split(',').filter(Boolean) : [],
  }));
}

function getDutyAssignmentCountMap(schoolId: string, monthKey: string, rosterType: DutyRosterTypeId) {
  const rows = db.prepare(`
    SELECT user_id, COUNT(*) as count
    FROM (
      SELECT lead_user_id as user_id
      FROM duty_roster_entries
      WHERE school_id = ? AND month_key = ? AND roster_type = ? AND lead_user_id IS NOT NULL
      UNION ALL
      SELECT assistant_one_user_id as user_id
      FROM duty_roster_entries
      WHERE school_id = ? AND month_key = ? AND roster_type = ? AND assistant_one_user_id IS NOT NULL
      UNION ALL
      SELECT assistant_two_user_id as user_id
      FROM duty_roster_entries
      WHERE school_id = ? AND month_key = ? AND roster_type = ? AND assistant_two_user_id IS NOT NULL
    ) assignments
    GROUP BY user_id
  `).all(schoolId, monthKey, rosterType, schoolId, monthKey, rosterType, schoolId, monthKey, rosterType) as Array<{ user_id: string; count: number }>;

  return new Map<string, number>(rows.map((row) => [row.user_id, Number(row.count || 0)]));
}

function hasDutyClassConflict(candidateId: string, selectedIds: string[], staffMap: Map<string, ReturnType<typeof getDutyTeachingStaff>[number]>, allowSameClassPairing: boolean) {
  if (allowSameClassPairing) return false;
  const candidate = staffMap.get(candidateId);
  if (!candidate || candidate.classIds.length === 0) return false;
  return selectedIds.some((selectedId) => {
    const selected = staffMap.get(selectedId);
    if (!selected || selected.classIds.length === 0) return false;
    return candidate.classIds.some((classId) => selected.classIds.includes(classId));
  });
}

function generateDutyRosterMonth(schoolId: string, monthKey: string, rosterType: DutyRosterTypeId, createdBy: string) {
  const definition = getDutyRosterDefinition(rosterType);
  const staff = getDutyTeachingStaff(schoolId);
  if (staff.length === 0) {
    throw new Error('No teaching staff found. Add teaching staff before generating a roster.');
  }

  const settings = getDutyRosterSettings(schoolId, rosterType);
  const staffMap = new Map(staff.map((member) => [member.userId, member]));
  const counts = new Map(staff.map((member) => [member.userId, 0]));
  const lastAssignedIndex = new Map(staff.map((member) => [member.userId, -1]));
  const dates = listDutyRosterDates(monthKey, rosterType);
  const warnings: string[] = [];

  const generatedEntries = dates.map((item, dayIndex) => {
    const selectedIds: string[] = [];
    const slotCount = 1 + definition.assistantSlots;

    for (let slot = 0; slot < slotCount; slot++) {
      const candidate = staff
        .filter((member) => !selectedIds.includes(member.userId))
        .filter((member) => !hasDutyClassConflict(member.userId, selectedIds, staffMap, settings.allowSameClassPairing))
        .sort((left, right) => {
          const countDiff = (counts.get(left.userId) || 0) - (counts.get(right.userId) || 0);
          if (countDiff !== 0) return countDiff;
          const recencyDiff = (lastAssignedIndex.get(left.userId) || -1) - (lastAssignedIndex.get(right.userId) || -1);
          if (recencyDiff !== 0) return recencyDiff;
          return left.name.localeCompare(right.name);
        })[0];

      if (!candidate) {
        warnings.push(`${item.dayLabel} ${item.date}: not enough eligible teaching staff to fill every slot without breaking pairing rules.`);
        continue;
      }

      selectedIds.push(candidate.userId);
      counts.set(candidate.userId, (counts.get(candidate.userId) || 0) + 1);
      lastAssignedIndex.set(candidate.userId, dayIndex);
    }

    return {
      id: crypto.randomUUID(),
      schoolId,
      rosterType,
      monthKey,
      rosterDate: item.date,
      leadUserId: selectedIds[0] || null,
      assistantOneUserId: selectedIds[1] || null,
      assistantTwoUserId: selectedIds[2] || null,
      note: definition.defaultNote,
      section: '',
      createdBy,
    };
  });

  const replaceRoster = db.transaction((entries: typeof generatedEntries) => {
    db.prepare('DELETE FROM duty_roster_entries WHERE school_id = ? AND month_key = ? AND roster_type = ?').run(schoolId, monthKey, rosterType);
    const insert = db.prepare(`
      INSERT INTO duty_roster_entries (
        id, school_id, roster_type, month_key, roster_date,
        lead_user_id, assistant_one_user_id, assistant_two_user_id,
        note, section, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    entries.forEach((entry) => {
      insert.run(
        entry.id,
        entry.schoolId,
        entry.rosterType,
        entry.monthKey,
        entry.rosterDate,
        entry.leadUserId,
        entry.assistantOneUserId,
        entry.assistantTwoUserId,
        entry.note,
        entry.section,
        entry.createdBy,
      );
    });
  });

  replaceRoster(generatedEntries);
  return { warnings };
}

function upsertDutyRosterEntry(params: {
  schoolId: string;
  rosterType: DutyRosterTypeId;
  rosterDate: string;
  leadUserId: string | null;
  assistantOneUserId: string | null;
  assistantTwoUserId: string | null;
  note: string;
  section?: string;
  createdBy: string;
}) {
  const definition = getDutyRosterDefinition(params.rosterType);
  const settings = getDutyRosterSettings(params.schoolId, params.rosterType);
  const staff = getDutyTeachingStaff(params.schoolId);
  const staffMap = new Map(staff.map((member) => [member.userId, member]));
  const providedIds = [params.leadUserId, params.assistantOneUserId, params.assistantTwoUserId].filter(Boolean) as string[];

  if (!params.leadUserId) {
    throw new Error('Select the staff member on duty.');
  }

  if (definition.assistantSlots === 0) {
    params.assistantOneUserId = null;
    params.assistantTwoUserId = null;
  } else if (definition.assistantSlots === 1) {
    params.assistantTwoUserId = null;
  }

  const uniqueIds = new Set(providedIds);
  if (uniqueIds.size !== providedIds.length) {
    throw new Error('The same teaching staff member cannot occupy multiple slots on the same day.');
  }

  providedIds.forEach((userId) => {
    if (!staffMap.has(userId)) {
      throw new Error('Only teaching staff can be assigned to duty rosters.');
    }
  });

  providedIds.forEach((userId, index) => {
    const others = providedIds.filter((_, otherIndex) => otherIndex !== index);
    if (hasDutyClassConflict(userId, others, staffMap, settings.allowSameClassPairing)) {
      throw new Error('This school policy does not allow two class teachers for the same class to be paired on the same day.');
    }
  });

  const monthKey = params.rosterDate.slice(0, 7);
  db.prepare(`
    INSERT INTO duty_roster_entries (
      id, school_id, roster_type, month_key, roster_date,
      lead_user_id, assistant_one_user_id, assistant_two_user_id,
      note, section, created_by, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(school_id, roster_type, roster_date, section) DO UPDATE SET
      month_key = excluded.month_key,
      lead_user_id = excluded.lead_user_id,
      assistant_one_user_id = excluded.assistant_one_user_id,
      assistant_two_user_id = excluded.assistant_two_user_id,
      note = excluded.note,
      created_by = excluded.created_by,
      updated_at = CURRENT_TIMESTAMP
  `).run(
    crypto.randomUUID(),
    params.schoolId,
    params.rosterType,
    monthKey,
    params.rosterDate,
    params.leadUserId,
    params.assistantOneUserId,
    params.assistantTwoUserId,
    params.note,
    params.section || '',
    params.createdBy,
  );
}

// ==================== AURAS & DUTY MANAGEMENT ====================
app.get('/api/auras/balance', requireRoles(...DUTY_MANAGEMENT_ROLES), (req, res) => {
  const user = db.prepare("SELECT auras FROM users WHERE id = ?").get((req as any).user.id) as { auras?: number } | undefined;
  const balance = Number(user?.auras || 0);
  res.json({ auras: balance, balance });
});

app.post('/api/auras/deduct', requireRoles(...DUTY_MANAGEMENT_ROLES), (req, res) => {
  const amount = Number(req.body?.amount || 0);
  const user = db.prepare("SELECT auras FROM users WHERE id = ?").get((req as any).user.id) as { auras?: number } | undefined;
  const currentBalance = Number(user?.auras || 0);
  if (currentBalance < amount) return res.status(403).json({ error: 'Insufficient AURAS. Please top up.' });
  const newBalance = currentBalance - amount;
  db.prepare("UPDATE users SET auras = ? WHERE id = ?").run(newBalance, (req as any).user.id);
  res.json({ success: true, remaining: newBalance, new_balance: newBalance, balance: newBalance });
});

app.post('/api/duty-report/ai-review', requireRoles(...DUTY_MANAGEMENT_ROLES), (req, res) => {
  const { report_data } = req.body;
  res.json({
    analysis: {
      feedback: 'Duty day was mostly normal with isolated incidents during break time.',
      coverage_score: 8,
      tone: 'Professional',
      risks: ['Repeated rowdiness observed during break', 'Potential supervision gap at Gate B'],
      recommendations: ['Assign one additional assistant to break duty tomorrow', 'Review Gate B protocols'],
    },
    summary: 'Duty day was mostly normal with isolated incidents during break time.',
    risks: ['Repeated rowdiness observed during break', 'Potential supervision gap at Gate B'],
    recommendations: ['Assign one additional assistant to break duty tomorrow', 'Review Gate B protocols'],
    reportDataEcho: report_data || null,
  });
});

app.post('/api/duty-report/ai-autofill', requireRoles(...DUTY_MANAGEMENT_ROLES), (req, res) => {
  const { prompt } = req.body;
  res.json({
    text: `AI Expanded: ${prompt}. The situation was handled professionally according to standard school protocols, ensuring the safety and discipline of all students involved.`,
  });
});

app.get('/api/duty-report/roster', requireRoles(...DUTY_MANAGEMENT_ROLES), (req, res) => {
  try {
    const schoolId = resolveSchoolId(req);
    const actor = resolveActor(req);
    const rosterType = normalizeDutyRosterType(req.query.rosterType);
    const monthKey = resolveDutyMonthKey(req.query.month);
    const settings = getDutyRosterSettings(schoolId, rosterType);
    const definition = getDutyRosterDefinition(rosterType);
    const teachingStaff = getDutyTeachingStaff(schoolId);
    const countMap = getDutyAssignmentCountMap(schoolId, monthKey, rosterType);
    const dates = listDutyRosterDates(monthKey, rosterType);
    const rows = db.prepare(`
      SELECT
        dre.*,
        lead_user.name as lead_name,
        lead_teacher.staff_id as lead_staff_id,
        assistant_one.name as assistant_one_name,
        assistant_one_teacher.staff_id as assistant_one_staff_id,
        assistant_two.name as assistant_two_name,
        assistant_two_teacher.staff_id as assistant_two_staff_id
      FROM duty_roster_entries dre
      LEFT JOIN users lead_user ON lead_user.id = dre.lead_user_id
      LEFT JOIN teachers lead_teacher ON lead_teacher.user_id = dre.lead_user_id
      LEFT JOIN users assistant_one ON assistant_one.id = dre.assistant_one_user_id
      LEFT JOIN teachers assistant_one_teacher ON assistant_one_teacher.user_id = dre.assistant_one_user_id
      LEFT JOIN users assistant_two ON assistant_two.id = dre.assistant_two_user_id
      LEFT JOIN teachers assistant_two_teacher ON assistant_two_teacher.user_id = dre.assistant_two_user_id
      WHERE dre.school_id = ? AND dre.month_key = ? AND dre.roster_type = ?
      ORDER BY dre.roster_date ASC
    `).all(schoolId, monthKey, rosterType) as any[];

    const rowMap = new Map<string, any>(rows.map((row) => [row.roster_date, row]));
    const entries = dates.map((item) => {
      const row = rowMap.get(item.date);
      const leadUserId = row?.lead_user_id || null;
      const assistantOneUserId = row?.assistant_one_user_id || null;
      const assistantTwoUserId = row?.assistant_two_user_id || null;
      const myRole = actor.id === leadUserId
        ? 'Duty Lead'
        : actor.id === assistantOneUserId
          ? 'Assistant 1'
          : actor.id === assistantTwoUserId
            ? 'Assistant 2'
            : null;

      return {
        id: row?.id || `draft-${rosterType}-${item.date}`,
        rosterDate: item.date,
        dayLabel: item.dayLabel,
        rosterType,
        note: row?.note || definition.defaultNote,
        isDraft: !row,
        leadUserId,
        leadName: row?.lead_name || null,
        leadStaffId: row?.lead_staff_id || null,
        assistantOneUserId,
        assistantOneName: row?.assistant_one_name || null,
        assistantOneStaffId: row?.assistant_one_staff_id || null,
        assistantTwoUserId,
        assistantTwoName: row?.assistant_two_name || null,
        assistantTwoStaffId: row?.assistant_two_staff_id || null,
        myRole,
      };
    });

    const myAssignments = entries.filter((entry) => Boolean(entry.myRole)).map((entry) => ({
      rosterDate: entry.rosterDate,
      dayLabel: entry.dayLabel,
      role: entry.myRole,
      note: entry.note,
    }));

    res.json({
      rosterType,
      monthKey,
      settings,
      rosterMeta: {
        id: definition.id,
        label: definition.label,
        assistantSlots: definition.assistantSlots,
      },
      tabs: DUTY_ROSTER_DEFINITIONS.map((item) => ({
        id: item.id,
        label: item.label,
        assistantSlots: item.assistantSlots,
      })),
      teachingStaff: teachingStaff.map((member) => ({
        ...member,
        assignmentCount: countMap.get(member.userId) || 0,
      })),
      coverage: {
        scheduledDays: rows.length,
        expectedDays: dates.length,
        unassignedDays: dates.length - rows.length,
      },
      entries,
      myAssignments,
    });
  } catch (err) {
    console.error('Duty roster fetch error', err);
    res.status(500).json({ error: String(err) });
  }
});

app.post('/api/duty-report/roster/generate', requireRoles(...DUTY_ROSTER_MANAGER_ROLES), (req, res) => {
  try {
    const schoolId = resolveSchoolId(req);
    const actor = resolveActor(req);
    const rosterType = normalizeDutyRosterType(req.body?.rosterType);
    const monthKey = resolveDutyMonthKey(req.body?.month);
    const result = generateDutyRosterMonth(schoolId, monthKey, rosterType, actor.id);
    res.json({ ok: true, ...result, monthKey, rosterType });
  } catch (err) {
    console.error('Duty roster generation error', err);
    res.status(400).json({ error: (err as Error).message });
  }
});

app.put('/api/duty-report/roster/settings', requireRoles(...DUTY_ROSTER_MANAGER_ROLES), (req, res) => {
  try {
    const schoolId = resolveSchoolId(req);
    const rosterType = normalizeDutyRosterType(req.body?.rosterType);
    const allowSameClassPairing = Boolean(req.body?.allowSameClassPairing);
    db.prepare(`
      INSERT INTO duty_roster_settings (school_id, roster_type, allow_same_class_pairing, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(school_id, roster_type) DO UPDATE SET
        allow_same_class_pairing = excluded.allow_same_class_pairing,
        updated_at = CURRENT_TIMESTAMP
    `).run(schoolId, rosterType, allowSameClassPairing ? 1 : 0);
    res.json({ ok: true, settings: { allowSameClassPairing } });
  } catch (err) {
    console.error('Duty roster settings error', err);
    res.status(500).json({ error: String(err) });
  }
});

app.post('/api/duty-report/roster/entry', requireRoles(...DUTY_ROSTER_MANAGER_ROLES), (req, res) => {
  try {
    const schoolId = resolveSchoolId(req);
    const actor = resolveActor(req);
    const rosterType = normalizeDutyRosterType(req.body?.rosterType);
    const rosterDate = typeof req.body?.rosterDate === 'string' ? req.body.rosterDate : '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(rosterDate)) {
      return res.status(400).json({ error: 'A valid roster date is required.' });
    }

    upsertDutyRosterEntry({
      schoolId,
      rosterType,
      rosterDate,
      leadUserId: typeof req.body?.leadUserId === 'string' && req.body.leadUserId.trim() ? req.body.leadUserId : null,
      assistantOneUserId: typeof req.body?.assistantOneUserId === 'string' && req.body.assistantOneUserId.trim() ? req.body.assistantOneUserId : null,
      assistantTwoUserId: typeof req.body?.assistantTwoUserId === 'string' && req.body.assistantTwoUserId.trim() ? req.body.assistantTwoUserId : null,
      note: typeof req.body?.note === 'string' ? req.body.note.trim() : '',
      section: typeof req.body?.section === 'string' ? req.body.section : '',
      createdBy: actor.id,
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('Duty roster upsert error', err);
    res.status(400).json({ error: (err as Error).message });
  }
});

// ==================== DAILY DUTY REPORTS ====================
app.post('/api/duty-report', requireRoles(...DUTY_MANAGEMENT_ROLES), (req, res) => {
  const reportDataInput = req.body?.report_data;
  const aiAnalysisInput = req.body?.ai_analysis;
  const user = (req as any).user;
  const schoolId = resolveSchoolId(req);
  const today = new Date().toISOString().split('T')[0];
  const id = crypto.randomUUID();
  try {
    const reportDataJson = typeof reportDataInput === 'string' ? reportDataInput : JSON.stringify(reportDataInput || {});
    const aiAnalysisJson = typeof aiAnalysisInput === 'string' ? aiAnalysisInput : JSON.stringify(aiAnalysisInput || null);
    const reportData = safeParseJson<Record<string, any>>(reportDataJson, {});
    db.prepare(`
      INSERT INTO duty_reports (id, school_id, staff_id, date, report_data, ai_analysis, report_text)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      schoolId,
      user.id,
      today,
      reportDataJson,
      aiAnalysisJson,
      typeof reportData.general_notes === 'string' ? reportData.general_notes : ''
    );
    res.json({ success: true, id });
  } catch (err) {
    console.error('Duty report create error', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get('/api/duty-report', requireRoles(...DUTY_MANAGEMENT_ROLES), (req, res) => {
  try {
    const schoolId = resolveSchoolId(req);
    const actor = resolveActor(req);
    const activeRole = getActiveRole(req);
    const canReviewAll = DUTY_ROSTER_MANAGER_ROLES.includes(activeRole);
    let reports = db.prepare(`
      SELECT d.*, u.name as staff_name
      FROM duty_reports d
      LEFT JOIN users u ON d.staff_id = u.id
      WHERE COALESCE(d.school_id, ?) = ?
      ORDER BY d.created_at DESC, d.date DESC
    `).all(schoolId, schoolId) as any[];

    reports = reports.map((row) => ({
      ...row,
      report_data: safeParseJson(row.report_data, {}),
      ai_analysis: safeParseJson(row.ai_analysis, null),
    }));

    if (!canReviewAll) {
      reports = reports.filter((row) => row.staff_id === actor.id);
    }

    res.json({ reports });
  } catch (err) {
    console.error('Duty report fetch error', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.resolve(__dirname, "dist", "index.html"));
    });
  }


  async function tryListen(basePort: number, attempts = 10) {
    for (let i = 0; i < attempts; i++) {
      const p = basePort + i;
      try {
        await new Promise<void>((resolve, reject) => {
              const srv = 
app.listen(p, '0.0.0.0', () => {
                console.log(`Server running on http://localhost:${p}`);
                try {
                  const outPath = path.resolve(__dirname, 'BOUND_PORT.txt');
                  fs.writeFileSync(outPath, String(p), 'utf8');
                } catch (e) {
                  console.warn('Failed to write BOUND_PORT.txt', e);
                }
                resolve();
              });
          srv.on('error', (err: any) => reject(err));
        });
        return;
      } catch (err: any) {
        if (err && err.code === 'EADDRINUSE') {
          console.warn(`Port ${p} in use, trying next port...`);
          continue;
        }
        console.error('Server failed to start:', err);
        return;
      }
    }
    console.error(`Could not bind server to any port in range ${basePort}-${basePort + attempts - 1}`);
  }

  await tryListen(PORT, 12);
}

startServer();
      try { db.exec("ALTER TABLE shared_files ADD COLUMN tags TEXT DEFAULT 'General'"); } catch(e){}
      try { db.exec("ALTER TABLE shared_files ADD COLUMN class_group TEXT"); } catch(e){}
      try { db.exec("ALTER TABLE shared_files ADD COLUMN subject TEXT"); } catch(e){}

