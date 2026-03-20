const { hosDB } = require('../config/sqlite');
const pool = require('../config/postgres');
const { queueEvent } = require('../utils/offlineQueue');
const { logLedgerEvent } = require('../utils/logger');

/**
 * Helper: upsert HOS approvals into central PostgreSQL.
 *
 * Assumes a central table `nsms_hos_approvals` with columns:
 *   (id, type, requested_by, school_id, status, created_at, updated_at)
 */
async function upsertApprovalToPostgres(approval, client) {
  const pg = client || pool;
  const { id, type, requested_by, school_id, status, created_at, updated_at } = approval;

  const query = `
    INSERT INTO nsms_hos_approvals (id, type, requested_by, school_id, status, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (id) DO UPDATE SET
      type = EXCLUDED.type,
      requested_by = EXCLUDED.requested_by,
      school_id = EXCLUDED.school_id,
      status = EXCLUDED.status,
      updated_at = EXCLUDED.updated_at;
  `;

  await pg.query(query, [id, type, requested_by, school_id, status, created_at, updated_at]);
}

/**
 * GET /api/hos/approvals
 * Optionally filter by school or status for HOS dashboards.
 */
exports.getApprovals = (req, res) => {
  const { school_id, status } = req.query;

  let sql = 'SELECT * FROM approvals';
  const params = [];
  if (school_id) {
    sql += ' WHERE school_id = ?';
    params.push(school_id);
  }
  if (status) {
    sql += params.length ? ' AND status = ?' : ' WHERE status = ?';
    params.push(status);
  }

  hosDB.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};

/**
 * POST /api/hos/approvals
 * Create a new approval request (enrollment, payment, module toggle).
 * This is logged immutably and queued for central sync.
 */
exports.createApproval = (req, res) => {
  const { id, type, requested_by, school_id } = req.body;
  const status = req.body.status || 'pending';
  const created_at = req.body.created_at || new Date().toISOString();
  const updated_at = req.body.updated_at || created_at;

  hosDB.run(
    `INSERT INTO approvals (id, type, requested_by, school_id, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, type, requested_by, school_id, status, created_at, updated_at],
    async (err) => {
      if (err) return res.status(500).json({ error: err.message });

      const payload = { id, type, requested_by, school_id, status, created_at, updated_at, op: 'create' };

      // Immutable log entry for regulator-friendly audit trail.
      logLedgerEvent('hos_approval_created', payload);
      queueEvent('hos_approval_upsert', payload);

      try {
        await upsertApprovalToPostgres(payload);
      } catch (syncErr) {
        console.error('Deferred HOS approval sync to PostgreSQL:', syncErr.message);
      }

      res.status(201).json({ message: 'Approval created successfully' });
    },
  );
};

/**
 * PATCH /api/hos/approvals/:id
 * Approve or reject an existing request.
 */
exports.updateApprovalStatus = (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const updated_at = new Date().toISOString();

  hosDB.run(
    `UPDATE approvals SET status = ?, updated_at = ? WHERE id = ?`,
    [status, updated_at, id],
    async function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Approval not found' });

      const payload = { id, status, updated_at, op: 'update' };
      logLedgerEvent('hos_approval_status_changed', payload);
      queueEvent('hos_approval_upsert', payload);

      try {
        await upsertApprovalToPostgres({ id, status, updated_at });
      } catch (syncErr) {
        console.error('Deferred HOS approval status sync to PostgreSQL:', syncErr.message);
      }

      res.json({ message: 'Approval status updated' });
    },
  );
};

exports.upsertApprovalToPostgres = upsertApprovalToPostgres;

const listByStatus = (table, req, res) => {
  const { status } = req.query;
  let sql = `SELECT * FROM ${table}`;
  const params = [];
  if (status) {
    sql += ' WHERE status = ?';
    params.push(status);
  }
  hosDB.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};

exports.getDashboardStats = (req, res) => {
  res.json({
    students: 1240,
    staff: 96,
    teachers: 64,
    attendance: '93%',
    fee_status: 'On track',
    approvals: 4,
    lams_users: 418,
    wallet: '₦12,450,000',
    sync_status: 'Online • 6 queued',
  });
};

exports.getRecentStudents = (req, res) => {
  res.json([
    { name: 'Amina Y.', class: 'JSS1', enrolled_at: '2026-02-01' },
    { name: 'Samuel K.', class: 'SS2', enrolled_at: '2026-01-29' },
  ]);
};

exports.getStaffActivity = (req, res) => {
  res.json([
    { staff: 'Grace A.', action: 'Attendance submitted', time: '08:12' },
    { staff: 'Joseph M.', action: 'Inventory request', time: '09:05' },
  ]);
};

exports.getRecentPayments = (req, res) => {
  res.json([
    { student: 'Linda T.', amount: '₦65,000', status: 'Paid' },
    { student: 'Peter O.', amount: '₦42,000', status: 'Pending' },
  ]);
};

exports.getAttendanceChart = (req, res) => {
  res.json({ labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], values: [91, 93, 89, 95, 94] });
};

exports.getFeesChart = (req, res) => {
  res.json({ labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'], values: [28, 42, 61, 77] });
};

exports.getLamsChart = (req, res) => {
  res.json({ labels: ['Jan', 'Feb', 'Mar'], values: [320, 410, 515] });
};

exports.getLessons = (req, res) => listByStatus('lesson_notes', req, res);
exports.getCASheets = (req, res) => listByStatus('ca_sheets', req, res);
exports.getExams = (req, res) => listByStatus('exams', req, res);
exports.getResults = (req, res) => listByStatus('results', req, res);
exports.getPromotions = (req, res) => listByStatus('promotions', req, res);
exports.getSignatures = (req, res) => listByStatus('signatures', req, res);
exports.getAuditLog = (req, res) => listByStatus('academic_audit', req, res);
exports.getCalendar = (req, res) => listByStatus('calendar_events', req, res);
exports.getHolidays = (req, res) => listByStatus('holidays', req, res);

exports.getExamActivity = (req, res) => {
  res.json([
    { teacher: 'Ms. Ada', action: 'Scores submitted', time: '10:18' },
    { teacher: 'Mr. John', action: 'Scores pending', time: '11:05' },
  ]);
};

exports.getExamCompilation = (req, res) => {
  res.json([
    { class: 'JSS3', status: 'In progress' },
    { class: 'SS1', status: 'Queued' },
  ]);
};

exports.getResultsAudit = (req, res) => {
  res.json([
    { event: 'Result approved', by: 'HOS', at: '2026-02-05' },
    { event: 'Head of Section endorsed', by: 'HOS-Section', at: '2026-02-04' },
  ]);
};

exports.getPromotionsAudit = (req, res) => {
  res.json([
    { student: 'Amaka N.', decision: 'Promoted', by: 'HOS', at: '2026-02-02' },
    { student: 'Chidi O.', decision: 'Borderline', by: 'System', at: '2026-02-02' },
  ]);
};

exports.getCalendarEvents = (req, res) => {
  res.json([
    { title: 'Term 2 Exams', start: '2026-03-10', end: '2026-03-24' },
    { title: 'Result Release', start: '2026-04-02', end: '2026-04-02' },
  ]);
};

exports.getCalendarSessions = (req, res) => {
  res.json([
    { session: '2025/2026', term: 'Second Term', status: 'Active' },
  ]);
};

exports.getHolidayEmergency = (req, res) => {
  res.json([{ title: 'Emergency Closure', status: 'None' }]);
};

exports.getHolidayResumption = (req, res) => {
  res.json([{ date: '2026-04-15', status: 'Scheduled' }]);
};

exports.getSignatureAudit = (req, res) => {
  res.json([
    { user: 'HOS', action: 'Signature uploaded', at: '2026-01-10' },
  ]);
};

exports.getCaAnalytics = (req, res) => {
  res.json({ labels: ['Week 1', 'Week 2', 'Week 3'], values: [74, 79, 81] });
};

exports.getExamAnalytics = (req, res) => {
  res.json({ labels: ['Math', 'English', 'Science'], values: [65, 71, 68] });
};

exports.getPromotionAnalytics = (req, res) => {
  res.json({ labels: ['Promoted', 'Borderline', 'Repeat'], values: [78, 12, 10] });
};
