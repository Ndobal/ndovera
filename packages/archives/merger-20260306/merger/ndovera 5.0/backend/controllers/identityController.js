const { identityDB } = require('../config/sqlite');
const { queueEvent } = require('../utils/offlineQueue');
const { logLedgerEvent } = require('../utils/logger');

const now = () => new Date().toISOString();

const logAudit = ({ identity_id, action, actor_id, actor_role, notes }) => {
  const payload = {
    id: `id_a_${Date.now()}`,
    identity_id,
    action,
    actor_id,
    actor_role,
    notes: notes || null,
    created_at: now(),
  };
  identityDB.run(
    `INSERT INTO identity_audit_logs (id, identity_id, action, actor_id, actor_role, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
    , [payload.id, payload.identity_id, payload.action, payload.actor_id, payload.actor_role, payload.notes, payload.created_at],
  );
};

exports.getIdentities = (req, res) => {
  identityDB.all('SELECT * FROM identities', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};

exports.createIdentity = (req, res) => {
  const { id, school_id, name, email } = req.body;
  const created_at = now();
  const identityId = id || `id_${Date.now()}`;

  identityDB.run(
    `INSERT INTO identities (id, school_id, name, email, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
    , [identityId, school_id, name, email, 'active', created_at],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      logAudit({ identity_id: identityId, action: 'identity_created', actor_id: identityId, actor_role: 'system' });
      logLedgerEvent('identity_created', { identity_id: identityId, school_id });
      queueEvent('identity_created', { identity_id: identityId, school_id });
      res.status(201).json({ id: identityId });
    },
  );
};

exports.getDashboardStats = (req, res) => {
  res.json({
    identities: 1240,
    active_sessions: 86,
    device_bindings: 320,
    trust_alerts: 2,
    signatures: 410,
  });
};

exports.getAudit = (req, res) => {
  identityDB.all('SELECT * FROM identity_audit_logs ORDER BY created_at DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};
