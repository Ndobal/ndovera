const { nmeDB } = require('../config/sqlite');
const { queueEvent } = require('../utils/offlineQueue');
const { logLedgerEvent } = require('../utils/logger');

const now = () => new Date().toISOString();

const logAudit = ({ entity_id, action, actor_id, actor_role, notes }) => {
  const payload = {
    id: `nme_a_${Date.now()}`,
    entity_id,
    action,
    actor_id,
    actor_role,
    notes: notes || null,
    created_at: now(),
  };
  nmeDB.run(
    `INSERT INTO nme_audit_logs (id, entity_id, action, actor_id, actor_role, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
    , [payload.id, payload.entity_id, payload.action, payload.actor_id, payload.actor_role, payload.notes, payload.created_at],
  );
};

exports.getBatches = (req, res) => {
  const { school_id, status } = req.query;
  let sql = 'SELECT * FROM nme_import_batches';
  const params = [];
  if (school_id) {
    sql += ' WHERE school_id = ?';
    params.push(school_id);
  }
  if (status) {
    sql += params.length ? ' AND status = ?' : ' WHERE status = ?';
    params.push(status);
  }
  nmeDB.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};

exports.createBatch = (req, res) => {
  const { id, school_id, source_type, created_by } = req.body;
  const created_at = now();
  const updated_at = created_at;
  const batchId = id || `batch_${Date.now()}`;

  nmeDB.run(
    `INSERT INTO nme_import_batches (id, school_id, source_type, status, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
    , [batchId, school_id, source_type, 'imported', created_by || null, created_at, updated_at],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      logAudit({ entity_id: batchId, action: 'imported', actor_id: created_by, actor_role: 'data_officer' });
      logLedgerEvent('nme_batch_created', { batch_id: batchId, school_id, source_type });
      queueEvent('nme_batch_created', { batch_id: batchId, school_id });
      res.status(201).json({ id: batchId, status: 'imported' });
    },
  );
};

exports.updateBatchStatus = (req, res) => {
  const { id } = req.params;
  const { status, actor_id, actor_role, notes } = req.body;
  const updated_at = now();

  nmeDB.run(
    `UPDATE nme_import_batches SET status = ?, updated_at = ? WHERE id = ?`,
    [status, updated_at, id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Batch not found' });
      logAudit({ entity_id: id, action: status, actor_id, actor_role, notes });
      logLedgerEvent('nme_batch_status', { batch_id: id, status });
      queueEvent('nme_batch_status', { batch_id: id, status });
      res.json({ message: 'Batch status updated' });
    },
  );
};

exports.getAudit = (req, res) => {
  nmeDB.all('SELECT * FROM nme_audit_logs ORDER BY created_at DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};

exports.getDashboardStats = (req, res) => {
  res.json({
    batches: 5,
    datasets: 18,
    records: 1240,
    pending_approval: 3,
    rollbacks: 1,
  });
};
