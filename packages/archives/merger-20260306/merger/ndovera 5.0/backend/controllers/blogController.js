const { blogDB } = require('../config/sqlite');
const { queueEvent } = require('../utils/offlineQueue');
const { logLedgerEvent } = require('../utils/logger');

const now = () => new Date().toISOString();

const addWorkflowEvent = (event) => {
  const payload = { ...event, id: event.id || `evt_${Date.now()}`, created_at: event.created_at || now() };
  blogDB.run(
    `INSERT INTO blog_workflow_events (id, post_id, action, actor_id, actor_role, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
    , [
      payload.id,
      payload.post_id,
      payload.action,
      payload.actor_id,
      payload.actor_role,
      payload.notes || null,
      payload.created_at,
    ],
  );
};

exports.getPosts = (req, res) => {
  const { status, school_id } = req.query;
  let sql = 'SELECT * FROM blog_posts';
  const params = [];
  if (status) {
    sql += ' WHERE status = ?';
    params.push(status);
  }
  if (school_id) {
    sql += params.length ? ' AND school_id = ?' : ' WHERE school_id = ?';
    params.push(school_id);
  }
  blogDB.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};

exports.getPost = (req, res) => {
  const { id } = req.params;
  blogDB.get('SELECT * FROM blog_posts WHERE id = ?', [id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Post not found' });
    res.json(row);
  });
};

exports.createPost = (req, res) => {
  const {
    id,
    school_id,
    author_id,
    author_role,
    title,
    summary,
    content,
    tags,
  } = req.body;

  const created_at = now();
  const updated_at = created_at;
  const status = 'draft';
  const postId = id || `post_${Date.now()}`;

  blogDB.run(
    `INSERT INTO blog_posts (id, school_id, author_id, author_role, title, summary, content, tags, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    , [
      postId,
      school_id,
      author_id,
      author_role,
      title,
      summary || null,
      content || null,
      tags || null,
      status,
      created_at,
      updated_at,
    ],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      addWorkflowEvent({ post_id: postId, action: 'created', actor_id: author_id, actor_role: author_role });
      logLedgerEvent('blog_post_created', { post_id: postId, school_id, author_id, status });
      queueEvent('blog_post_created', { post_id: postId, school_id });
      res.status(201).json({ id: postId, status });
    },
  );
};

exports.updatePostStatus = (req, res) => {
  const { id } = req.params;
  const { status, actor_id, actor_role, notes } = req.body;
  const updated_at = now();

  let approvalFields = '';
  const approvalParams = [];
  if (status === 'endorsed') {
    approvalFields = ', endorsed_by = ?';
    approvalParams.push(actor_id || null);
  }
  if (status === 'approved') {
    approvalFields += ', approved_by = ?';
    approvalParams.push(actor_id || null);
  }
  if (status === 'published') {
    approvalFields += ', published_at = ?';
    approvalParams.push(now());
  }

  blogDB.run(
    `UPDATE blog_posts SET status = ?, updated_at = ?${approvalFields} WHERE id = ?`,
    [status, updated_at, ...approvalParams, id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Post not found' });
      addWorkflowEvent({ post_id: id, action: status, actor_id, actor_role, notes });
      logLedgerEvent('blog_status_changed', { post_id: id, status });
      queueEvent('blog_status_changed', { post_id: id, status });
      res.json({ message: 'Status updated' });
    },
  );
};

exports.getWorkflow = (req, res) => {
  const { post_id } = req.query;
  let sql = 'SELECT * FROM blog_workflow_events';
  const params = [];
  if (post_id) {
    sql += ' WHERE post_id = ?';
    params.push(post_id);
  }
  blogDB.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};

exports.getDashboardStats = (req, res) => {
  res.json({
    drafts: 8,
    pending_endorsement: 4,
    pending_approval: 2,
    published: 24,
    rejected: 1,
    queued_channels: 3,
  });
};

exports.getPublishTargets = (req, res) => {
  blogDB.all('SELECT * FROM blog_publish_targets', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};
