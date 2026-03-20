const { resultsBulkDB } = require('../config/sqlite');
const { queueEvent } = require('../utils/offlineQueue');
const { logLedgerEvent } = require('../utils/logger');

const now = () => new Date().toISOString();

const logAudit = ({ upload_id, action, actor_id, actor_role, notes }) => {
  const payload = {
    id: `rba_${Date.now()}`,
    upload_id,
    action,
    actor_id,
    actor_role,
    notes: notes || null,
    created_at: now(),
  };
  resultsBulkDB.run(
    `INSERT INTO results_bulk_audit (id, upload_id, action, actor_id, actor_role, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
    , [payload.id, payload.upload_id, payload.action, payload.actor_id, payload.actor_role, payload.notes, payload.created_at],
  );
};

exports.getUploads = (req, res) => {
  const { school_id, status } = req.query;
  let sql = 'SELECT * FROM results_bulk_uploads';
  const params = [];
  if (school_id) {
    sql += ' WHERE school_id = ?';
    params.push(school_id);
  }
  if (status) {
    sql += params.length ? ' AND status = ?' : ' WHERE status = ?';
    params.push(status);
  }
  resultsBulkDB.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};

exports.createUpload = (req, res) => {
  const { id, school_id, term, session, class_level, source_type, file_name, created_by } = req.body;
  const created_at = now();
  const updated_at = created_at;
  const uploadId = id || `upload_${Date.now()}`;

  resultsBulkDB.run(
    `INSERT INTO results_bulk_uploads (id, school_id, term, session, class_level, source_type, file_name, status, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    , [
      uploadId,
      school_id,
      term,
      session,
      class_level,
      source_type,
      file_name,
      'uploaded',
      created_by || null,
      created_at,
      updated_at,
    ],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      logAudit({ upload_id: uploadId, action: 'uploaded', actor_id: created_by, actor_role: 'staff' });
      logLedgerEvent('results_bulk_upload_created', { upload_id: uploadId, school_id });
      queueEvent('results_bulk_upload_created', { upload_id: uploadId, school_id });
      res.status(201).json({ id: uploadId, status: 'uploaded' });
    },
  );
};

exports.updateUploadStatus = (req, res) => {
  const { id } = req.params;
  const { status, actor_id, actor_role, notes } = req.body;
  const updated_at = now();

  resultsBulkDB.run(
    `UPDATE results_bulk_uploads SET status = ?, updated_at = ? WHERE id = ?`,
    [status, updated_at, id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Upload not found' });
      logAudit({ upload_id: id, action: status, actor_id, actor_role, notes });
      logLedgerEvent('results_bulk_upload_status', { upload_id: id, status });
      queueEvent('results_bulk_upload_status', { upload_id: id, status });
      res.json({ message: 'Upload status updated' });
    },
  );
};

exports.getTags = (req, res) => {
  const { upload_id, status } = req.query;
  let sql = 'SELECT * FROM results_bulk_tags';
  const params = [];
  if (upload_id) {
    sql += ' WHERE upload_id = ?';
    params.push(upload_id);
  }
  if (status) {
    sql += params.length ? ' AND status = ?' : ' WHERE status = ?';
    params.push(status);
  }
  resultsBulkDB.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};

exports.getAudit = (req, res) => {
  resultsBulkDB.all('SELECT * FROM results_bulk_audit ORDER BY created_at DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};

exports.getDashboardStats = (req, res) => {
  res.json({
    uploads: 6,
    queued: 3,
    tagged: 124,
    pending_review: 18,
    published: 4,
  });
};
