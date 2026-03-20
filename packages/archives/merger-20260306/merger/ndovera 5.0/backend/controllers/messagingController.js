const { messagingDB } = require('../config/sqlite');
const { queueEvent } = require('../utils/offlineQueue');
const { logLedgerEvent } = require('../utils/logger');

const now = () => new Date().toISOString();

const logAudit = ({ thread_id, action, actor_id, actor_role, notes }) => {
  const payload = {
    id: `msg_a_${Date.now()}`,
    thread_id,
    action,
    actor_id,
    actor_role,
    notes: notes || null,
    created_at: now(),
  };
  messagingDB.run(
    `INSERT INTO messaging_audit (id, thread_id, action, actor_id, actor_role, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
    , [payload.id, payload.thread_id, payload.action, payload.actor_id, payload.actor_role, payload.notes, payload.created_at],
  );
};

exports.getThreads = (req, res) => {
  const { school_id, type } = req.query;
  let sql = 'SELECT * FROM messaging_threads';
  const params = [];
  if (school_id) {
    sql += ' WHERE school_id = ?';
    params.push(school_id);
  }
  if (type) {
    sql += params.length ? ' AND type = ?' : ' WHERE type = ?';
    params.push(type);
  }
  messagingDB.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};

exports.createThread = (req, res) => {
  const { id, school_id, type, name, created_by } = req.body;
  const created_at = now();
  const threadId = id || `thread_${Date.now()}`;

  messagingDB.run(
    `INSERT INTO messaging_threads (id, school_id, type, name, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
    , [threadId, school_id, type, name, created_by || null, created_at],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      logAudit({ thread_id: threadId, action: 'thread_created', actor_id: created_by, actor_role: 'staff' });
      logLedgerEvent('messaging_thread_created', { thread_id: threadId, school_id, type });
      queueEvent('messaging_thread_created', { thread_id: threadId, school_id });
      res.status(201).json({ id: threadId });
    },
  );
};

exports.getMessages = (req, res) => {
  const { thread_id } = req.query;
  let sql = 'SELECT * FROM messaging_messages';
  const params = [];
  if (thread_id) {
    sql += ' WHERE thread_id = ?';
    params.push(thread_id);
  }
  messagingDB.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};

exports.sendMessage = (req, res) => {
  const { id, thread_id, sender_id, sender_role, body, message_type } = req.body;
  const created_at = now();
  const messageId = id || `msg_${Date.now()}`;

  messagingDB.run(
    `INSERT INTO messaging_messages (id, thread_id, sender_id, sender_role, body, message_type, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    , [
      messageId,
      thread_id,
      sender_id,
      sender_role,
      body,
      message_type || 'text',
      'sent',
      created_at,
    ],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      logAudit({ thread_id, action: 'message_sent', actor_id: sender_id, actor_role: sender_role });
      queueEvent('messaging_message_sent', { message_id: messageId, thread_id });
      res.status(201).json({ id: messageId });
    },
  );
};

exports.getAudit = (req, res) => {
  messagingDB.all('SELECT * FROM messaging_audit ORDER BY created_at DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};

exports.getDashboardStats = (req, res) => {
  res.json({
    active_threads: 28,
    messages_today: 412,
    group_chats: 12,
    unread: 64,
    broadcasts: 3,
  });
};
