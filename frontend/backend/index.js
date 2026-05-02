const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const {
  getSettings, upsertSettings, addAudit, getAuditForStudent, getAllAudits,
  getAllBooks, getBookById, upsertBook, deleteBook, borrowBook, returnBook,
  getBorrowingsForStudent, getAllBorrowings,
  saveContent
} = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

const classroomRouter = require('./classroom');

const fs = require('fs');
const path = require('path');
const multer = require('multer');
// ensure uploads directory exists
const UPLOAD_DIR = path.join(__dirname, 'data', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
// serve uploaded files
app.use('/uploads', express.static(UPLOAD_DIR));

// Multer for multipart uploads (limit file size to 20MB)
const storage = multer.diskStorage({
  destination: function (req, file, cb) { cb(null, UPLOAD_DIR); },
  filename: function (req, file, cb) { const safe = Date.now() + '_' + file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_'); cb(null, safe); }
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

function authenticate(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'missing auth' });
  const parts = auth.split(' ');
  if (parts.length !== 2) return res.status(401).json({ error: 'invalid auth' });
  const token = parts[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'invalid token' });
  }
}


// Secure login: POST /api/login { id, password, role }
app.post('/api/login', async (req, res) => {
  const { id, password, role } = req.body || {};
  if (!id || !password) {
    return res.status(400).json({ error: 'id and password required' });
  }
  // Load user settings (payload)
  const settings = await getSettings(id);
  if (!settings || !settings.password) {
    return res.status(401).json({ error: 'invalid credentials' });
  }
  if (String(settings.password) !== String(password)) {
    return res.status(401).json({ error: 'invalid credentials' });
  }
  // Use role from settings if present, else fallback to provided
  const userRole = settings.role || role || 'student';
  const name = settings.name || id;
  const token = jwt.sign({ role: userRole, name, id }, JWT_SECRET, { expiresIn: '8h' });
  res.json({ token });
});

app.get('/api/settings/:id', authenticate, async (req, res) => {
  const id = req.params.id;
  const settings = await getSettings(id);
  res.json(settings || null);
});

app.post('/api/settings/:id', authenticate, async (req, res) => {
  const id = req.params.id;
  const payload = req.body || {};
  await upsertSettings(id, payload);
  await addAudit(id, { action: 'upsertSettings', data: { by: req.user.name } });
  res.json({ ok: true });
});

app.get('/api/settings/:id/audit', authenticate, async (req, res) => {
  const id = req.params.id;
  const list = await getAuditForStudent(id);
  res.json(list || []);
});

app.post('/api/settings/:id/audit', authenticate, async (req, res) => {
  const id = req.params.id;
  const entry = req.body || {};
  const saved = await addAudit(id, entry);
  res.json({ ok: true, entry: saved });
});


// Admin endpoints for audits
app.get('/api/audit', authenticate, async (req, res) => {
  // only allow roles with admin privileges
  if (!['hos', 'owner'].includes(req.user.role)) return res.status(403).json({ error: 'forbidden' });
  const all = await getAllAudits();
  res.json(all || []);
});

// Password reset endpoint (superadmin/owner only)
app.post('/api/admin/reset-password', authenticate, async (req, res) => {
  // Only allow superadmin (ami) or owner to reset passwords
  if (!['ami', 'owner'].includes(req.user.role)) {
    return res.status(403).json({ error: 'forbidden' });
  }
  const { targetId, newPassword } = req.body || {};
  if (!targetId || !newPassword) {
    return res.status(400).json({ error: 'targetId and newPassword required' });
  }
  // Load target user settings
  let settings = await getSettings(targetId);
  if (!settings) settings = {};
  settings.password = String(newPassword);
  await upsertSettings(targetId, settings);
  await addAudit(targetId, {
    action: 'resetPassword',
    data: { by: req.user.name || req.user.role, adminRole: req.user.role }
  });
  res.json({ ok: true, message: 'Password reset successful' });
});

// Library endpoints (simple fullstack feature)
// public catalog listing (allow anonymous browse)
app.get('/api/library/books', async (req, res) => {
  const list = await getAllBooks();
  res.json({ success: true, books: list });
});

// public book detail (allow anonymous browse)
app.get('/api/library/books/:id', async (req, res) => {
  const { id } = req.params;
  const book = await getBookById(id);
  if (!book) return res.status(404).json({ success: false, error: 'not found' });
  res.json({ success: true, book });
});

app.post('/api/library/books', authenticate, async (req, res) => {
  // only privileged roles may manage catalog
  if (!['hos', 'owner', 'admin', 'teacher', 'librarian'].includes(req.user.role)) return res.status(403).json({ error: 'forbidden' });
  const payload = req.body || {};
  const result = await upsertBook(payload);
  res.json({ success: true, id: result.id });
});

app.delete('/api/library/books/:id', authenticate, async (req, res) => {
  if (!['hos', 'owner', 'admin', 'librarian'].includes(req.user.role)) return res.status(403).json({ error: 'forbidden' });
  const { id } = req.params;
  await deleteBook(id);
  res.json({ success: true });
});

app.post('/api/library/books/:id/borrow', authenticate, async (req, res) => {
  const { id } = req.params;
  const by = req.user && (req.user.name || req.user.sub || 'unknown');
  const studentId = req.user.role === 'student' ? by : (req.body.studentId || by);
  const dueAt = req.body.dueAt || null;
  const b = await borrowBook(id, studentId, dueAt, { by });
  await addAudit(studentId, { action: 'borrow', data: { bookId: id, by } });
  res.json({ success: true, borrowing: b });
});

app.post('/api/library/borrowings/:id/return', authenticate, async (req, res) => {
  const { id } = req.params;
  const by = req.user && (req.user.name || req.user.sub || 'unknown');
  const r = await returnBook(id);
  // try to record who returned
  await addAudit(by, { action: 'return', data: { borrowingId: id, by } }).catch(()=>{});
  res.json({ success: true, returned: r });
});

app.get('/api/library/borrowings/mine', authenticate, async (req, res) => {
  const by = req.user && (req.user.name || req.user.sub || 'guest');
  const list = await getBorrowingsForStudent(by);
  res.json({ success: true, borrowings: list });
});

app.get('/api/library/borrowings', authenticate, async (req, res) => {
  if (!['hos', 'owner', 'admin', 'librarian'].includes(req.user.role)) return res.status(403).json({ error: 'forbidden' });
  const all = await getAllBorrowings();
  res.json({ success: true, borrowings: all });
});

// Teacher Classroom API
app.use('/api/classrooms', authenticate, classroomRouter);

// Auto-save editor content
app.post('/api/save-content', authenticate, async (req, res) => {
  const { classId, content, role } = req.body || {};
  if (!classId || typeof content === 'undefined') return res.status(400).json({ success: false, error: 'missing fields' });
  try {
    const saved = await saveContent(classId, role || (req.user && req.user.role) || 'unknown', content);
    res.json({ success: true, saved });
  } catch (err) {
    console.error('Save content failed', err && err.message);
    res.status(500).json({ success: false, error: 'could not save content' });
  }
});

const PORT = process.env.PORT || 4001;
app.listen(PORT, () => console.log(`Settings API server running on http://localhost:${PORT}`));

// Note: Additional legacy services (knex/socket.io/exams/purchase) were
// previously present in this file and have been removed to avoid duplicate
// Express app declarations during local development. If you need those
// routes, consider merging them into this app or running the separate
// service responsible for them.

// Simple in-memory books catalog (mirror of front-end sample)
const books = [
  { id: 'book-ndovera-about', price: 0 },
  { id: 'book-algebra-simplified', price: 0 },
  { id: 'book-waec-2010-23', price: 2000 },
];

// simple exam catalog (in-memory)
const exams = [
  {
    id: 'exam-math-cbt',
    title: 'Mathematics CBT',
    window: '2026-03-05 09:00',
    questions: [
      { id: 'q1', text: '2 + 2 = ?', choices: ['1','2','3','4'], answer: '4' },
      { id: 'q2', text: '5 × 6 = ?', choices: ['11','30','56','65'], answer: '30' },
    ],
  },
  {
    id: 'exam-bio-mid',
    title: 'Biology Midterm',
    window: '2026-03-08 10:00',
    questions: [
      { id: 'q1', text: 'Cell nucleus contains?', choices: ['DNA','RNA','Proteins','Lipids'], answer: 'DNA' },
      { id: 'q2', text: 'Photosynthesis takes place in?', choices: ['Roots','Stem','Leaves','Flowers'], answer: 'Leaves' },
    ],
  },
];

// record of submissions
const examResults = [];

// POST /api/purchase -> validate and create license token
app.post('/api/purchase', (req, res) => {
  const { bookId, userId, amount, deviceFingerprint } = req.body;
  const book = books.find(b => b.id === bookId);
  if (!book) return res.status(404).json({ error: 'Book not found' });
  if (book.price !== amount) return res.status(400).json({ error: 'Invalid amount' });

  // Create receipt and license JWT
  const receiptId = `rcpt_${Date.now()}`;
  const license = jwt.sign({ bookId, userId, deviceFingerprint, receiptId }, JWT_SECRET, { expiresIn: '7d' });

  // In production, persist transaction and issue invoice
  return res.json({ success: true, receiptId, license });
});

// POST /api/package -> validate license and return packaged ND-BOOK token
app.post('/api/package', (req, res) => {
  const { license, deviceFingerprint } = req.body;
  if (!license) return res.status(400).json({ error: 'Missing license token' });

  try {
    const payload = jwt.verify(license, JWT_SECRET);
    // Validate device fingerprint matches
    if (payload.deviceFingerprint && deviceFingerprint && payload.deviceFingerprint !== deviceFingerprint) {
      return res.status(403).json({ error: 'Device fingerprint mismatch' });
    }

    // Create a short-lived download token
    const downloadToken = jwt.sign({ bookId: payload.bookId, userId: payload.userId }, JWT_SECRET, { expiresIn: '24h' });

    // For simulation return a simple ND-BOOK base64 blob placeholder and token
    const ndbookContent = Buffer.from(`ND-BOOK ${payload.bookId} for ${payload.userId}`).toString('base64');

    return res.json({ success: true, downloadToken, ndbookBase64: ndbookContent });
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired license' });
  }
});

// POST /api/admin/log -> record admin decisions (logged to console for demo)

// GET /api/exams -> list all available exams (could be filtered by user/role)
app.get('/api/exams', (req, res) => {
  // hide answers in listing
  const safe = exams.map(e => ({ id: e.id, title: e.title, window: e.window }));
  res.json({ success: true, exams: safe });
});

// GET /api/exams/:id -> return full exam (questions included) for editing/viewing by privileged users
app.get('/api/exams/:id', (req, res) => {
  const { id } = req.params;
  const exam = exams.find(e => e.id === id);
  if (!exam) return res.status(404).json({ error: 'Exam not found' });
  // In production check permissions; here return full exam (including questions)
  res.json({ success: true, exam });
});

// POST /api/exams -> create a new exam (teacher/privileged)
app.post('/api/exams', (req, res) => {
  const { title, window, questions } = req.body;
  if (!title || !questions || !Array.isArray(questions)) {
    return res.status(400).json({ error: 'Invalid exam payload' });
  }
  const id = `exam-${Date.now()}`;
  exams.push({ id, title, window, questions });
  res.json({ success: true, exam: { id, title, window } });
});

// PUT /api/exams/:id -> update an exam (teacher)
app.put('/api/exams/:id', (req, res) => {
  const { id } = req.params;
  const { title, window, questions } = req.body;
  const exam = exams.find(e => e.id === id);
  if (!exam) return res.status(404).json({ error: 'Exam not found' });
  if (title) exam.title = title;
  if (window) exam.window = window;
  if (Array.isArray(questions)) exam.questions = questions;
  return res.json({ success: true, exam: { id: exam.id, title: exam.title, window: exam.window } });
});

// DELETE /api/exams/:id -> delete an exam
app.delete('/api/exams/:id', (req, res) => {
  const { id } = req.params;
  const idx = exams.findIndex(e => e.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Exam not found' });
  exams.splice(idx, 1);
  return res.json({ success: true, deletedId: id });
});

// POST /api/exams/:id/start -> return questions for exam
app.post('/api/exams/:id/start', (req, res) => {
  const { id } = req.params;
  const exam = exams.find(e => e.id === id);
  if (!exam) return res.status(404).json({ error: 'Exam not found' });
  // in real app would check window/time and user eligibility
  const questions = exam.questions.map(q => ({ id: q.id, text: q.text, choices: q.choices }));
  res.json({ success: true, exam: { id: exam.id, title: exam.title }, questions });
});

// POST /api/exams/:id/submit -> submit answers and grade
app.post('/api/exams/:id/submit', (req, res) => {
  const { id } = req.params;
  const { userId, answers } = req.body;
  const exam = exams.find(e => e.id === id);
  if (!exam) return res.status(404).json({ error: 'Exam not found' });
  let score = 0;
  exam.questions.forEach(q => {
    if (answers[q.id] === q.answer) score += 1;
  });
  const result = { examId: id, userId, score, total: exam.questions.length, timestamp: new Date().toISOString() };
  examResults.push(result);
  res.json({ success: true, result });
});
app.post('/api/admin/log', (req, res) => {
  const { bookId, adminId, action, reason } = req.body;
  // In production, write to immutable audit logs
  console.log('ADMIN LOG', { bookId, adminId, action, reason, ts: new Date().toISOString() });
  // try to persist to audit_logs table if available
  const details = JSON.stringify({ bookId, adminId, action, reason });
  if (typeof knex === 'undefined') {
    // DB layer not configured in this lightweight server build
    return res.json({ success: true, loggedAt: new Date().toISOString(), persisted: false, note: 'knex not configured' });
  }

  knex('audit_logs').insert({ actor_id: adminId || null, action: action || 'admin_log', resource_type: 'admin_log', resource_id: bookId || null, details }).then(() => {
    return res.json({ success: true, loggedAt: new Date().toISOString(), persisted: true });
  }).catch((err) => {
    console.warn('Could not persist admin log:', err && err.message);
    return res.json({ success: true, loggedAt: new Date().toISOString(), persisted: false });
  });
});

// POST /api/tuck/orders -> persist tuck shop orders (best-effort)
// POST /api/tuck/orders -> create a tuck order in tuck_orders
app.post('/api/tuck/orders', async (req, res) => {
  // tuck orders persistence relies on a separate DB layer (knex). In this lightweight
  // server build that DB may not be configured. Return a not-implemented response
  // so the rest of the API (library/settings) can operate without a knex dependency.
  if (typeof knex === 'undefined') {
    return res.status(501).json({ success: false, error: 'tuck orders not available in this server build' });
  }

  let order = req.body;
  if (!order) return res.status(400).json({ success: false, error: 'Invalid order payload' });
  try {
    const id = order.id || `order_${Date.now()}`;
    const placedBy = order.placedBy || null;
    const itemsJson = JSON.stringify(order.items || []);
    const totalCents = Math.round((order.total || 0) * 100);
    const notes = order.notes || null;
    const status = order.status || 'pending';

    await knex('tuck_orders').insert({ id, placed_by: placedBy, items: itemsJson, total_cents: totalCents, notes, status });

    // also write an audit log
    const details = JSON.stringify({ orderId: id, placedBy, totalCents });
    knex('audit_logs').insert({ actor_id: placedBy, action: 'tuck_order_created', resource_type: 'tuck_order', resource_id: id, details }).catch(()=>{});

    order = { ...order, id, total: Math.round(totalCents) / 100, placedAt: new Date().toISOString(), status };
    return res.json({ success: true, order });
  } catch (err) {
    console.error('Error creating tuck order', err && err.message);
    return res.status(500).json({ success: false, error: 'Could not persist order' });
  }
});

// GET /api/tuck/orders -> list orders, optional ?placedBy=...
app.get('/api/tuck/orders', async (req, res) => {
  const { placedBy } = req.query;
  try {
    if (typeof knex === 'undefined') return res.status(501).json({ success: false, error: 'tuck orders not available in this server build' });

    let q = knex('tuck_orders').select('*').orderBy('placed_at', 'desc').limit(200);
    if (placedBy) q = q.where('placed_by', placedBy);
    const rows = await q;
    const orders = rows.map(r => ({ id: r.id, placedBy: r.placed_by, items: JSON.parse(r.items || '[]'), total: (r.total_cents || 0) / 100, notes: r.notes, status: r.status, placedAt: r.placed_at, updatedAt: r.updated_at }));
    return res.json({ success: true, orders });
  } catch (err) {
    console.error('Error fetching tuck orders', err && err.message);
    return res.status(500).json({ success: false, error: 'Could not fetch orders' });
  }
});

// PUT /api/tuck/orders/:id -> amend pending orders or update status
app.put('/api/tuck/orders/:id', async (req, res) => {
  const { id } = req.params;
  const changes = req.body;
  try {
    if (typeof knex === 'undefined') return res.status(501).json({ success: false, error: 'tuck orders not available in this server build' });

    const existing = await knex('tuck_orders').where({ id }).first();
    if (!existing) return res.status(404).json({ success: false, error: 'Order not found' });
    if (existing.status !== 'pending') return res.status(409).json({ success: false, error: 'Only pending orders can be amended' });

    const update = {};
    if (changes.items) update.items = JSON.stringify(changes.items);
    if (typeof changes.total !== 'undefined') update.total_cents = Math.round(changes.total * 100);
    if (typeof changes.notes !== 'undefined') update.notes = changes.notes;
    if (typeof changes.status !== 'undefined') update.status = changes.status;
    update.updated_at = knex.fn.now();

    await knex('tuck_orders').where({ id }).update(update);
    // audit
    knex('audit_logs').insert({ actor_id: changes.placedBy || null, action: 'tuck_order_amend', resource_type: 'tuck_order', resource_id: id, details: JSON.stringify(changes) }).catch(()=>{});
    return res.json({ success: true });
  } catch (err) {
    console.error('Error updating tuck order', err && err.message);
    return res.status(500).json({ success: false, error: 'Could not update order' });
  }
});

// GET /api/tuck/orders/weekly -> grouped weekly summary
app.get('/api/tuck/orders/weekly', async (req, res) => {
  const { placedBy, weeks } = req.query;
  const lookback = Math.max(1, Math.min(52, Number(weeks) || 12));
  try {
    if (typeof knex === 'undefined') return res.status(501).json({ success: false, error: 'tuck orders not available in this server build' });

    const since = new Date();
    since.setDate(since.getDate() - (lookback * 7));
    let q = knex('tuck_orders').select('*').where('placed_at', '>=', since.toISOString());
    if (placedBy) q = q.andWhere('placed_by', placedBy);
    const rows = await q.orderBy('placed_at', 'desc');

    // group by week starting Monday and optionally by user
    const groups = {};
    rows.forEach(r => {
      const d = r.placed_at ? new Date(r.placed_at) : new Date();
      const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
      const day = tmp.getUTCDay() || 7;
      const monday = new Date(tmp);
      monday.setUTCDate(tmp.getUTCDate() - (day - 1));
      const weekKey = monday.toISOString().slice(0,10);
      const userKey = r.placed_by || 'unknown';
      const key = `${userKey}::${weekKey}`;
      if (!groups[key]) groups[key] = { placedBy: userKey, weekStart: weekKey, orders: [], total: 0 };
      groups[key].orders.push({ id: r.id, items: JSON.parse(r.items || '[]'), total: (r.total_cents || 0) / 100, status: r.status, placedAt: r.placed_at });
      groups[key].total += (r.total_cents || 0) / 100;
    });

    const result = Object.values(groups).sort((a,b) => b.weekStart.localeCompare(a.weekStart));
    return res.json({ success: true, weeks: result });
  } catch (err) {
    console.error('Error building weekly tuck summary', err && err.message);
    return res.status(500).json({ success: false, error: 'Could not compute weekly summary' });
  }
});

// Debug: seed tuck orders (admin/dev only)
app.post('/api/debug/seed-tuck-orders', async (req, res) => {
  const { orders } = req.body || {};
  if (!Array.isArray(orders)) return res.status(400).json({ success: false, error: 'Provide orders array' });
  try {
    const inserts = orders.map(o => ({ id: o.id || `order_${Date.now()}_${Math.random().toString(36).slice(2,8)}`, placed_by: o.placedBy || null, items: JSON.stringify(o.items || []), total_cents: Math.round((o.total || 0) * 100), notes: o.notes || null, status: o.status || 'pending', placed_at: o.placedAt || new Date().toISOString(), updated_at: o.placedAt || new Date().toISOString() }));
    await knex('tuck_orders').insert(inserts);
    return res.json({ success: true, inserted: inserts.length });
  } catch (err) {
    console.error('Seed tuck orders failed', err && err.message);
    return res.status(500).json({ success: false, error: 'Could not seed orders' });
  }
});

// Attendance endpoints
// GET /api/attendance?studentId=...&limit=... -> list attendance records (most recent first)
app.get('/api/attendance', async (req, res) => {
  const { studentId, limit } = req.query;
  if (!studentId) return res.status(400).json({ success: false, error: 'Missing studentId' });
  try {
    const q = knex('attendance_records').where({ student_id: studentId }).orderBy('date', 'desc').limit(Number(limit) || 365);
    const rows = await q;
    return res.json({ success: true, records: rows });
  } catch (err) {
    console.error('Error fetching attendance', err && err.message);
    return res.status(500).json({ success: false, error: 'Could not fetch attendance' });
  }
});

// POST /api/attendance -> create or upsert attendance record
app.post('/api/attendance', async (req, res) => {
  const { studentId, date, status, reason, recordedBy } = req.body;
  if (!studentId || !date || !status) return res.status(400).json({ success: false, error: 'Missing fields' });
  try {
    const existing = await knex('attendance_records').where({ student_id: studentId, date }).first();
    if (existing) {
      await knex('attendance_records').where({ id: existing.id }).update({ status, reason: reason || null, recorded_by: recordedBy || null, updated_at: knex.fn.now() });
      return res.json({ success: true, updated: true });
    }
    const [id] = await knex('attendance_records').insert({ student_id: studentId, date, status, reason: reason || null, recorded_by: recordedBy || null });
    return res.json({ success: true, id });
  } catch (err) {
    console.error('Error saving attendance', err && err.message);
    return res.status(500).json({ success: false, error: 'Could not save attendance' });
  }
});

// PUT /api/attendance/:id -> update record (status/reason)
app.put('/api/attendance/:id', async (req, res) => {
  const { id } = req.params;
  const { status, reason } = req.body;
  try {
    const existing = await knex('attendance_records').where({ id }).first();
    if (!existing) return res.status(404).json({ success: false, error: 'Record not found' });
    await knex('attendance_records').where({ id }).update({ status: status || existing.status, reason: typeof reason === 'undefined' ? existing.reason : reason, updated_at: knex.fn.now() });
    return res.json({ success: true });
  } catch (err) {
    console.error('Error updating attendance', err && err.message);
    return res.status(500).json({ success: false, error: 'Could not update attendance' });
  }
});

// POST /api/ai/review -> simple AI review endpoint returning fixed report
app.post('/api/ai/review', (req, res) => {
  const report = {
    academicQuality: 'High',
    formattingIssues: 'Minor',
    plagiarismRisk: 'Low',
    ageAppropriateness: 'OK',
    recommendedAction: 'Recommend approval',
    score: 87,
  };
  return res.json({ success: true, report });
});

// run any pending migrations and start server
// Messaging endpoints
// GET /api/conversations?userId=...
app.get('/api/conversations', async (req, res) => {
  const { userId } = req.query;
  try {
    let q = knex('conversations').select('*').orderBy('updated_at', 'desc').limit(200);
    if (userId) q = q.whereRaw('participants LIKE ?', [`%"${userId}"%`]);
    const rows = await q;
    const convs = rows.map(r => ({ id: r.id, subject: r.subject, participants: JSON.parse(r.participants || '[]'), createdAt: r.created_at, updatedAt: r.updated_at }));
    return res.json({ success: true, conversations: convs });
  } catch (err) {
    console.error('Error fetching conversations', err && err.message);
    return res.status(500).json({ success: false, error: 'Could not fetch conversations' });
  }
});

// POST /api/conversations -> create new conversation
app.post('/api/conversations', async (req, res) => {
  const { subject, participants } = req.body;
  if (!Array.isArray(participants) || participants.length === 0) return res.status(400).json({ success: false, error: 'Missing participants' });
  try {
    // enforce NDOVERA rule: no student-to-student conversations by default
    const studentCount = participants.filter(p => String(p).startsWith('student-')).length;
    if (studentCount > 1) return res.status(403).json({ success: false, error: 'Student-to-student messaging is disabled' });

    const id = `conv_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
    await knex('conversations').insert({ id, subject: subject || null, participants: JSON.stringify(participants || []), created_at: knex.fn.now(), updated_at: knex.fn.now() });
    return res.json({ success: true, conversation: { id, subject, participants } });
  } catch (err) {
    console.error('Error creating conversation', err && err.message);
    return res.status(500).json({ success: false, error: 'Could not create conversation' });
  }
});

// GET /api/conversations/:id/messages
app.get('/api/conversations/:id/messages', async (req, res) => {
  const { id } = req.params;
  try {
    const rows = await knex('messages').where({ conversation_id: id }).orderBy('sent_at', 'asc').limit(200);
    const msgs = rows.map(r => ({ id: r.id, conversationId: r.conversation_id, senderId: r.sender_id, body: r.body, metadata: JSON.parse(r.metadata || '{}'), sentAt: r.sent_at, readAt: r.read_at }));
    return res.json({ success: true, messages: msgs });
  } catch (err) {
    console.error('Error fetching messages', err && err.message);
    return res.status(500).json({ success: false, error: 'Could not fetch messages' });
  }
});

// POST /api/conversations/:id/messages -> send message
app.post('/api/conversations/:id/messages', async (req, res) => {
  const { id } = req.params;
  const { senderId, body, metadata } = req.body;
  if (!senderId || !body) return res.status(400).json({ success: false, error: 'Missing senderId or body' });
  try {
    const conv = await knex('conversations').where({ id }).first();
    if (!conv) return res.status(404).json({ success: false, error: 'Conversation not found' });
    const participants = JSON.parse(conv.participants || '[]');
    // NDOVERA rule: block student-to-student
    const otherStudents = participants.filter(p => String(p).startsWith('student-') && p !== senderId);
    if (String(senderId).startsWith('student-') && otherStudents.length > 0) {
      return res.status(403).json({ success: false, error: 'Student-to-student messaging is disabled' });
    }

    const msgId = `msg_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
    await knex('messages').insert({ id: msgId, conversation_id: id, sender_id: senderId, body, metadata: JSON.stringify(metadata || {}), sent_at: knex.fn.now() });

    const message = { id: msgId, conversationId: id, senderId, body, metadata: metadata || {}, sentAt: new Date().toISOString() };
    // emit to conversation room
    io.to(id).emit('message', message);

    // audit log for message send
    knex('audit_logs').insert({ actor_id: senderId, action: 'message_sent', resource_type: 'conversation', resource_id: id, details: JSON.stringify({ messageId: msgId, body }), timestamp: knex.fn.now() }).catch(()=>{});

    // update conversation updated_at
    await knex('conversations').where({ id }).update({ updated_at: knex.fn.now() });

    return res.json({ success: true, message });
  } catch (err) {
    console.error('Error sending message', err && err.message);
    return res.status(500).json({ success: false, error: 'Could not send message' });
  }
});

// POST /api/conversations/:id/mark-read -> mark messages in conversation as read by user
app.post('/api/conversations/:id/mark-read', async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body || {};
  if (!userId) return res.status(400).json({ success: false, error: 'Missing userId' });
  try {
    // mark unread messages as read
    await knex('messages').where({ conversation_id: id }).andWhereNull('read_at').update({ read_at: knex.fn.now() });
    // emit read event to room
    io.to(id).emit('read', { conversationId: id, userId, ts: new Date().toISOString() });
    return res.json({ success: true });
  } catch (err) {
    console.error('Error marking messages read', err && err.message);
    return res.status(500).json({ success: false, error: 'Could not mark read' });
  }
});

// Debug: seed messages
app.post('/api/debug/seed-messages', async (req, res) => {
  const { conversations, messages } = req.body || {};
  try {
    if (Array.isArray(conversations) && conversations.length) {
      const inserts = conversations.map(c => ({ id: c.id || `conv_${Date.now()}_${Math.random().toString(36).slice(2,6)}`, subject: c.subject || null, participants: JSON.stringify(c.participants || []), created_at: c.createdAt || new Date().toISOString(), updated_at: c.updatedAt || new Date().toISOString() }));
      await knex('conversations').insert(inserts);
    }
    if (Array.isArray(messages) && messages.length) {
      const msgs = messages.map(m => ({ id: m.id || `msg_${Date.now()}_${Math.random().toString(36).slice(2,6)}`, conversation_id: m.conversationId, sender_id: m.senderId, body: m.body, metadata: JSON.stringify(m.metadata || {}), sent_at: m.sentAt || new Date().toISOString() }));
      await knex('messages').insert(msgs);
    }
    return res.json({ success: true });
  } catch (err) {
    console.error('Seed messages failed', err && err.message);
    return res.status(500).json({ success: false, error: 'Could not seed messages' });
  }
});

// Legacy migrations / socket startup removed for lightweight server build.
// The server is started earlier via `app.listen(PORT, ...)` above.
