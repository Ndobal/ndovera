const { dropboxDB } = require('../config/sqlite');
const { queueEvent } = require('../utils/offlineQueue');
const { logLedgerEvent } = require('../utils/logger');

const now = () => new Date().toISOString();

const logAudit = ({ item_id, action, actor_id, actor_role, notes }) => {
  const payload = {
    id: `audit_${Date.now()}`,
    item_id,
    action,
    actor_id,
    actor_role,
    notes: notes || null,
    created_at: now(),
  };
  dropboxDB.run(
    `INSERT INTO dropbox_audit (id, item_id, action, actor_id, actor_role, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
    , [payload.id, payload.item_id, payload.action, payload.actor_id, payload.actor_role, payload.notes, payload.created_at],
  );
};

exports.getItems = (req, res) => {
  const { school_id, parent_id, type } = req.query;
  let sql = 'SELECT * FROM dropbox_items';
  const params = [];
  if (school_id) {
    sql += ' WHERE school_id = ?';
    params.push(school_id);
  }
  if (parent_id) {
    sql += params.length ? ' AND parent_id = ?' : ' WHERE parent_id = ?';
    params.push(parent_id);
  }
  if (type) {
    sql += params.length ? ' AND type = ?' : ' WHERE type = ?';
    params.push(type);
  }
  dropboxDB.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};

exports.getItem = (req, res) => {
  const { id } = req.params;
  dropboxDB.get('SELECT * FROM dropbox_items WHERE id = ?', [id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Item not found' });
    res.json(row);
  });
};

exports.createItem = (req, res) => {
  const {
    id,
    school_id,
    parent_id,
    name,
    type,
    path,
    owner_id,
    permissions,
  } = req.body;

  const created_at = now();
  const updated_at = created_at;
  const itemId = id || `item_${Date.now()}`;

  dropboxDB.run(
    `INSERT INTO dropbox_items (id, school_id, parent_id, name, type, path, owner_id, permissions, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    , [
      itemId,
      school_id,
      parent_id || null,
      name,
      type,
      path || null,
      owner_id || null,
      permissions || null,
      created_at,
      updated_at,
    ],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      logAudit({ item_id: itemId, action: 'created', actor_id: owner_id, actor_role: 'staff' });
      logLedgerEvent('dropbox_item_created', { item_id: itemId, school_id, type });
      queueEvent('dropbox_item_created', { item_id: itemId, school_id });
      res.status(201).json({ id: itemId, status: 'created' });
    },
  );
};

exports.updateLockStatus = (req, res) => {
  const { id } = req.params;
  const { is_locked, actor_id, actor_role } = req.body;
  const updated_at = now();

  dropboxDB.run(
    `UPDATE dropbox_items SET is_locked = ?, updated_at = ? WHERE id = ?`,
    [is_locked ? 1 : 0, updated_at, id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Item not found' });
      logAudit({ item_id: id, action: is_locked ? 'locked' : 'unlocked', actor_id, actor_role });
      logLedgerEvent('dropbox_item_lock_changed', { item_id: id, is_locked });
      queueEvent('dropbox_item_lock_changed', { item_id: id, is_locked });
      res.json({ message: 'Lock status updated' });
    },
  );
};

exports.getAudit = (req, res) => {
  dropboxDB.all('SELECT * FROM dropbox_audit ORDER BY created_at DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};

exports.getDashboardStats = (req, res) => {
  const queries = {
    total: 'SELECT COUNT(*) as count FROM dropbox_items',
    locked: 'SELECT COUNT(*) as count FROM dropbox_items WHERE is_locked = 1',
    folders: "SELECT COUNT(*) as count FROM dropbox_items WHERE type = 'folder'",
    approvals: "SELECT COUNT(*) as count FROM dropbox_items WHERE status = 'pending'",
  };

  const stats = {};
  const keys = Object.keys(queries);
  let remaining = keys.length;

  keys.forEach((key) => {
    dropboxDB.get(queries[key], [], (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      stats[key] = row?.count || 0;
      remaining -= 1;
      if (remaining === 0) res.json(stats);
    });
  });
};
