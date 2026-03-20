const { eventBusDB } = require('../config/sqlite');

const now = () => new Date().toISOString();

exports.getEvents = (req, res) => {
  const { status } = req.query;
  let sql = 'SELECT * FROM event_bus_events';
  const params = [];
  if (status) {
    sql += ' WHERE status = ?';
    params.push(status);
  }
  eventBusDB.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};

exports.publishEvent = (req, res) => {
  const { id, event_type, payload } = req.body;
  const created_at = now();
  const eventId = id || `evt_${Date.now()}`;

  eventBusDB.run(
    `INSERT INTO event_bus_events (id, event_type, payload, status, created_at)
     VALUES (?, ?, ?, ?, ?)`
    , [eventId, event_type, JSON.stringify(payload || {}), 'queued', created_at],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ id: eventId, status: 'queued' });
    },
  );
};

exports.getDashboardStats = (req, res) => {
  res.json({
    queued: 32,
    processed: 1204,
    failed: 1,
    audit_locked: true,
  });
};
