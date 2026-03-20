const { liveEventsDB } = require('../config/sqlite');
const { queueEvent } = require('../utils/offlineQueue');
const { logLedgerEvent } = require('../utils/logger');

const now = () => new Date().toISOString();

const logAudit = ({ event_id, action, actor_id, actor_role, notes }) => {
  const payload = {
    id: `live_a_${Date.now()}`,
    event_id,
    action,
    actor_id,
    actor_role,
    notes: notes || null,
    created_at: now(),
  };
  liveEventsDB.run(
    `INSERT INTO live_events_audit (id, event_id, action, actor_id, actor_role, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
    , [payload.id, payload.event_id, payload.action, payload.actor_id, payload.actor_role, payload.notes, payload.created_at],
  );
};

exports.getEvents = (req, res) => {
  const { school_id, status } = req.query;
  let sql = 'SELECT * FROM live_events';
  const params = [];
  if (school_id) {
    sql += ' WHERE school_id = ?';
    params.push(school_id);
  }
  if (status) {
    sql += params.length ? ' AND status = ?' : ' WHERE status = ?';
    params.push(status);
  }
  liveEventsDB.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};

exports.createEvent = (req, res) => {
  const { id, school_id, title, description, youtube_url, scheduled_at, created_by } = req.body;
  const created_at = now();
  const updated_at = created_at;
  const eventId = id || `event_${Date.now()}`;

  liveEventsDB.run(
    `INSERT INTO live_events (id, school_id, title, description, youtube_url, status, scheduled_at, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    , [
      eventId,
      school_id,
      title,
      description || null,
      youtube_url || null,
      'scheduled',
      scheduled_at || null,
      created_by || null,
      created_at,
      updated_at,
    ],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      logAudit({ event_id: eventId, action: 'scheduled', actor_id: created_by, actor_role: 'staff' });
      logLedgerEvent('live_event_created', { event_id: eventId, school_id });
      queueEvent('live_event_created', { event_id: eventId, school_id });
      res.status(201).json({ id: eventId, status: 'scheduled' });
    },
  );
};

exports.updateEventStatus = (req, res) => {
  const { id } = req.params;
  const { status, actor_id, actor_role, notes } = req.body;
  const updated_at = now();

  liveEventsDB.run(
    `UPDATE live_events SET status = ?, updated_at = ? WHERE id = ?`,
    [status, updated_at, id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Event not found' });
      logAudit({ event_id: id, action: status, actor_id, actor_role, notes });
      logLedgerEvent('live_event_status', { event_id: id, status });
      queueEvent('live_event_status', { event_id: id, status });
      res.json({ message: 'Event status updated' });
    },
  );
};

exports.getAudit = (req, res) => {
  liveEventsDB.all('SELECT * FROM live_events_audit ORDER BY created_at DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};

exports.getDashboardStats = (req, res) => {
  res.json({
    scheduled: 4,
    live: 1,
    completed: 12,
    reminders: 6,
  });
};
