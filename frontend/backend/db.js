const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const DB_PATH = path.join(__dirname, 'data', 'ndovera.db');
const DIR = path.dirname(DB_PATH);
if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });

const db = new sqlite3.Database(DB_PATH);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS settings (
    studentId TEXT PRIMARY KEY,
    payload TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS audit (
    id TEXT PRIMARY KEY,
    studentId TEXT,
    ts TEXT,
    action TEXT,
    data TEXT
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS books (
    id TEXT PRIMARY KEY,
    title TEXT,
    author TEXT,
    description TEXT,
    cover TEXT,
    metadata TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS borrowings (
    id TEXT PRIMARY KEY,
    bookId TEXT,
    studentId TEXT,
    borrowedAt TEXT,
    dueAt TEXT,
    returnedAt TEXT,
    status TEXT,
    meta TEXT
  )`);

  // Classroom tables
  db.run(`CREATE TABLE IF NOT EXISTS classes (
    id TEXT PRIMARY KEY,
    name TEXT,
    teacherId TEXT,
    meta TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS class_members (
    id TEXT PRIMARY KEY,
    classId TEXT,
    studentId TEXT,
    role TEXT,
    joinedAt TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS posts (
    id TEXT PRIMARY KEY,
    classId TEXT,
    authorId TEXT,
    content TEXT,
    attachments TEXT,
    createdAt TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS assignments (
    id TEXT PRIMARY KEY,
    classId TEXT,
    title TEXT,
    description TEXT,
    dueAt TEXT,
    createdAt TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS submissions (
    id TEXT PRIMARY KEY,
    assignmentId TEXT,
    studentId TEXT,
    content TEXT,
    submittedAt TEXT,
    grade REAL,
    gradedAt TEXT,
    feedback TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS attendance_records (
    id TEXT PRIMARY KEY,
    classId TEXT,
    studentId TEXT,
    date TEXT,
    status TEXT,
    recordedBy TEXT,
    notes TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS materials (
    id TEXT PRIMARY KEY,
    classId TEXT,
    title TEXT,
    url TEXT,
    metadata TEXT,
    uploadedAt TEXT,
    uploadedBy TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS content_saves (
    id TEXT PRIMARY KEY,
    classId TEXT,
    role TEXT,
    content TEXT,
    ts TEXT
  )`);
});

function getSettings(studentId) {
  return new Promise((resolve, reject) => {
    db.get('SELECT payload FROM settings WHERE studentId = ?', [studentId], (err, row) => {
      if (err) return reject(err);
      if (!row) return resolve(null);
      try { return resolve(JSON.parse(row.payload)); } catch (e) { return resolve(null); }
    });
  });
}

function upsertSettings(studentId, payload) {
  return new Promise((resolve, reject) => {
    const str = JSON.stringify(payload);
    db.run('INSERT INTO settings(studentId,payload) VALUES(?,?) ON CONFLICT(studentId) DO UPDATE SET payload=excluded.payload', [studentId, str], function (err) {
      if (err) return reject(err);
      resolve(true);
    });
  });
}

function addAudit(studentId, entry) {
  return new Promise((resolve, reject) => {
    const id = entry.id || `audit-${Date.now()}`;
    const ts = entry.ts || new Date().toISOString();
    const action = entry.action || 'unknown';
    const data = JSON.stringify(entry.data || {});
    db.run('INSERT INTO audit(id,studentId,ts,action,data) VALUES(?,?,?,?,?)', [id, studentId, ts, action, data], function (err) {
      if (err) return reject(err);
      resolve({ id, studentId, ts, action, data: JSON.parse(data) });
    });
  });
}

function getAuditForStudent(studentId) {
  return new Promise((resolve, reject) => {
    db.all('SELECT id,studentId,ts,action,data FROM audit WHERE studentId = ? ORDER BY ts DESC', [studentId], (err, rows) => {
      if (err) return reject(err);
      const parsed = rows.map(r => ({ ...r, data: JSON.parse(r.data) }));
      resolve(parsed);
    });
  });
}

function getAllAudits() {
  return new Promise((resolve, reject) => {
    db.all('SELECT id,studentId,ts,action,data FROM audit ORDER BY ts DESC', [], (err, rows) => {
      if (err) return reject(err);
      const parsed = rows.map(r => ({ ...r, data: JSON.parse(r.data) }));
      resolve(parsed);
    });
  });
}

function getAllBooks() {
  return new Promise((resolve, reject) => {
    db.all('SELECT id,title,author,description,cover,metadata FROM books ORDER BY title', [], (err, rows) => {
      if (err) return reject(err);
      const parsed = rows.map(r => ({ ...r, metadata: r.metadata ? JSON.parse(r.metadata) : {} }));
      resolve(parsed);
    });
  });
}

function getBookById(id) {
  return new Promise((resolve, reject) => {
    db.get('SELECT id,title,author,description,cover,metadata FROM books WHERE id = ?', [id], (err, row) => {
      if (err) return reject(err);
      if (!row) return resolve(null);
      const parsed = { ...row, metadata: row.metadata ? JSON.parse(row.metadata) : {} };
      resolve(parsed);
    });
  });
}

function upsertBook(book) {
  return new Promise((resolve, reject) => {
    const id = book.id || `book-${Date.now()}`;
    const meta = JSON.stringify(book.metadata || {});
    db.run('INSERT INTO books(id,title,author,description,cover,metadata) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,author=excluded.author,description=excluded.description,cover=excluded.cover,metadata=excluded.metadata', [id, book.title || null, book.author || null, book.description || null, book.cover || null, meta], function (err) {
      if (err) return reject(err);
      resolve({ id });
    });
  });
}

function deleteBook(id) {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM books WHERE id = ?', [id], function (err) {
      if (err) return reject(err);
      resolve(true);
    });
  });
}

function borrowBook(bookId, studentId, dueAt, meta) {
  return new Promise((resolve, reject) => {
    const id = `borrow-${Date.now()}`;
    const borrowedAt = new Date().toISOString();
    const status = 'borrowed';
    const metaStr = JSON.stringify(meta || {});
    db.run('INSERT INTO borrowings(id,bookId,studentId,borrowedAt,dueAt,returnedAt,status,meta) VALUES(?,?,?,?,?,?,?,?)', [id, bookId, studentId, borrowedAt, dueAt || null, null, status, metaStr], function (err) {
      if (err) return reject(err);
      resolve({ id, bookId, studentId, borrowedAt, dueAt, status, meta: meta || {} });
    });
  });
}

function returnBook(borrowingId) {
  return new Promise((resolve, reject) => {
    const returnedAt = new Date().toISOString();
    const status = 'returned';
    db.run('UPDATE borrowings SET returnedAt = ?, status = ? WHERE id = ?', [returnedAt, status, borrowingId], function (err) {
      if (err) return reject(err);
      resolve({ id: borrowingId, returnedAt, status });
    });
  });
}

function getBorrowingsForStudent(studentId) {
  return new Promise((resolve, reject) => {
    db.all('SELECT id,bookId,studentId,borrowedAt,dueAt,returnedAt,status,meta FROM borrowings WHERE studentId = ? ORDER BY borrowedAt DESC', [studentId], (err, rows) => {
      if (err) return reject(err);
      const parsed = rows.map(r => ({ ...r, meta: r.meta ? JSON.parse(r.meta) : {} }));
      resolve(parsed);
    });
  });
}

function getAllBorrowings() {
  return new Promise((resolve, reject) => {
    db.all('SELECT id,bookId,studentId,borrowedAt,dueAt,returnedAt,status,meta FROM borrowings ORDER BY borrowedAt DESC', [], (err, rows) => {
      if (err) return reject(err);
      const parsed = rows.map(r => ({ ...r, meta: r.meta ? JSON.parse(r.meta) : {} }));
      resolve(parsed);
    });
  });
}

// Classroom helpers
function createClass(cls) {
  return new Promise((resolve, reject) => {
    const id = cls.id || `class-${Date.now()}`;
    const meta = JSON.stringify(cls.meta || {});
    db.run('INSERT INTO classes(id,name,teacherId,meta) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,teacherId=excluded.teacherId,meta=excluded.meta', [id, cls.name || null, cls.teacherId || null, meta], function (err) {
      if (err) return reject(err);
      resolve({ id });
    });
  });
}

function getClassById(id) {
  return new Promise((resolve, reject) => {
    db.get('SELECT id,name,teacherId,meta FROM classes WHERE id = ?', [id], (err, row) => {
      if (err) return reject(err);
      if (!row) return resolve(null);
      resolve({ ...row, meta: row.meta ? JSON.parse(row.meta) : {} });
    });
  });
}

function addClassMember(classId, studentId, role) {
  return new Promise((resolve, reject) => {
    const id = `cm-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
    const joinedAt = new Date().toISOString();
    db.run('INSERT INTO class_members(id,classId,studentId,role,joinedAt) VALUES(?,?,?,?,?)', [id, classId, studentId, role || 'student', joinedAt], function (err) {
      if (err) return reject(err);
      resolve({ id, classId, studentId, role: role || 'student', joinedAt });
    });
  });
}

function getClassMembers(classId) {
  return new Promise((resolve, reject) => {
    db.all('SELECT id,classId,studentId,role,joinedAt FROM class_members WHERE classId = ? ORDER BY joinedAt DESC', [classId], (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

function createPost(post) {
  return new Promise((resolve, reject) => {
    const id = post.id || `post-${Date.now()}`;
    const createdAt = new Date().toISOString();
    const attachments = JSON.stringify(post.attachments || []);
    db.run('INSERT INTO posts(id,classId,authorId,content,attachments,createdAt) VALUES(?,?,?,?,?,?)', [id, post.classId, post.authorId, post.content || null, attachments, createdAt], function (err) {
      if (err) return reject(err);
      resolve({ id, classId: post.classId, authorId: post.authorId, content: post.content, attachments: post.attachments || [], createdAt });
    });
  });
}

function getPostsForClass(classId, limit = 100) {
  return new Promise((resolve, reject) => {
    db.all('SELECT id,classId,authorId,content,attachments,createdAt FROM posts WHERE classId = ? ORDER BY createdAt DESC LIMIT ?', [classId, Number(limit) || 100], (err, rows) => {
      if (err) return reject(err);
      const parsed = rows.map(r => ({ ...r, attachments: r.attachments ? JSON.parse(r.attachments) : [] }));
      resolve(parsed);
    });
  });
}

function createAssignment(a) {
  return new Promise((resolve, reject) => {
    const id = a.id || `assign-${Date.now()}`;
    const createdAt = new Date().toISOString();
    db.run('INSERT INTO assignments(id,classId,title,description,dueAt,createdAt) VALUES(?,?,?,?,?,?)', [id, a.classId, a.title || null, a.description || null, a.dueAt || null, createdAt], function (err) {
      if (err) return reject(err);
      resolve({ id, classId: a.classId, title: a.title, description: a.description, dueAt: a.dueAt, createdAt });
    });
  });
}

function getAssignmentsForClass(classId) {
  return new Promise((resolve, reject) => {
    db.all('SELECT id,classId,title,description,dueAt,createdAt FROM assignments WHERE classId = ? ORDER BY createdAt DESC', [classId], (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

function submitAssignment(sub) {
  return new Promise((resolve, reject) => {
    const id = sub.id || `sub-${Date.now()}`;
    const submittedAt = new Date().toISOString();
    db.run('INSERT INTO submissions(id,assignmentId,studentId,content,submittedAt,grade,gradedAt,feedback) VALUES(?,?,?,?,?,?,?,?)', [id, sub.assignmentId, sub.studentId, sub.content || null, submittedAt, null, null, null], function (err) {
      if (err) return reject(err);
      resolve({ id, assignmentId: sub.assignmentId, studentId: sub.studentId, content: sub.content, submittedAt });
    });
  });
}

function getSubmissionsForAssignment(assignmentId) {
  return new Promise((resolve, reject) => {
    db.all('SELECT id,assignmentId,studentId,content,submittedAt,grade,gradedAt,feedback FROM submissions WHERE assignmentId = ? ORDER BY submittedAt DESC', [assignmentId], (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

function gradeSubmission(submissionId, grade, feedback) {
  return new Promise((resolve, reject) => {
    const gradedAt = new Date().toISOString();
    db.run('UPDATE submissions SET grade = ?, gradedAt = ?, feedback = ? WHERE id = ?', [grade, gradedAt, feedback || null, submissionId], function (err) {
      if (err) return reject(err);
      resolve({ id: submissionId, grade, feedback, gradedAt });
    });
  });
}

function recordAttendance(classId, studentId, date, status, recordedBy, notes) {
  return new Promise((resolve, reject) => {
    const id = `att-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
    db.run('INSERT INTO attendance_records(id,classId,studentId,date,status,recordedBy,notes) VALUES(?,?,?,?,?,?,?)', [id, classId, studentId, date, status, recordedBy || null, notes || null], function (err) {
      if (err) return reject(err);
      resolve({ id, classId, studentId, date, status, recordedBy, notes });
    });
  });
}

function getAttendanceForClass(classId, sinceDate) {
  return new Promise((resolve, reject) => {
    const params = [classId];
    let q = 'SELECT id,classId,studentId,date,status,recordedBy,notes FROM attendance_records WHERE classId = ?';
    if (sinceDate) { q += ' AND date >= ?'; params.push(sinceDate); }
    q += ' ORDER BY date DESC';
    db.all(q, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

function addMaterial(mat) {
  return new Promise((resolve, reject) => {
    const id = mat.id || `mat-${Date.now()}`;
    const uploadedAt = new Date().toISOString();
    const metadata = JSON.stringify(mat.metadata || {});
    db.run('INSERT INTO materials(id,classId,title,url,metadata,uploadedAt,uploadedBy) VALUES(?,?,?,?,?,?,?)', [id, mat.classId, mat.title || null, mat.url || null, metadata, uploadedAt, mat.uploadedBy || null], function (err) {
      if (err) return reject(err);
      resolve({ id, classId: mat.classId, title: mat.title, url: mat.url, metadata: mat.metadata || {}, uploadedAt, uploadedBy: mat.uploadedBy || null });
    });
  });
}

function getMaterialsForClass(classId) {
  return new Promise((resolve, reject) => {
    db.all('SELECT id,classId,title,url,metadata,uploadedAt,uploadedBy FROM materials WHERE classId = ? ORDER BY uploadedAt DESC', [classId], (err, rows) => {
      if (err) return reject(err);
      const parsed = rows.map(r => ({ ...r, metadata: r.metadata ? JSON.parse(r.metadata) : {} }));
      resolve(parsed || []);
    });
  });
}

function saveContent(classId, role, content) {
  return new Promise((resolve, reject) => {
    const id = `save-${Date.now()}`;
    const ts = new Date().toISOString();
    db.run('INSERT INTO content_saves(id,classId,role,content,ts) VALUES(?,?,?,?,?)', [id, classId || null, role || null, content || null, ts], function (err) {
      if (err) return reject(err);
      resolve({ id, classId, role, ts });
    });
  });
}

function getSavedContentForClass(classId, limit = 10) {
  return new Promise((resolve, reject) => {
    db.all('SELECT id,classId,role,content,ts FROM content_saves WHERE classId = ? ORDER BY ts DESC LIMIT ?', [classId, Number(limit) || 10], (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

module.exports = {
  getSettings,
  upsertSettings,
  addAudit,
  getAuditForStudent,
  getAllAudits,
  getAllBooks,
  getBookById,
  upsertBook,
  deleteBook,
  borrowBook,
  returnBook,
  getBorrowingsForStudent,
  getAllBorrowings,

  // classroom
  createClass,
  getClassById,
  addClassMember,
  getClassMembers,
  createPost,
  getPostsForClass,
  createAssignment,
  getAssignmentsForClass,
  submitAssignment,
  getSubmissionsForAssignment,
  gradeSubmission,
  recordAttendance,
  getAttendanceForClass,
  addMaterial,
  getMaterialsForClass,
  saveContent,
  getSavedContentForClass,
};

