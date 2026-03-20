const { videoGalleryDB } = require('../config/sqlite');
const { queueEvent } = require('../utils/offlineQueue');
const { logLedgerEvent } = require('../utils/logger');

const now = () => new Date().toISOString();

const logAudit = ({ video_id, action, actor_id, actor_role, notes }) => {
  const payload = {
    id: `vid_a_${Date.now()}`,
    video_id,
    action,
    actor_id,
    actor_role,
    notes: notes || null,
    created_at: now(),
  };
  videoGalleryDB.run(
    `INSERT INTO video_gallery_audit (id, video_id, action, actor_id, actor_role, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
    , [payload.id, payload.video_id, payload.action, payload.actor_id, payload.actor_role, payload.notes, payload.created_at],
  );
};

exports.getVideos = (req, res) => {
  const { school_id, visibility, status } = req.query;
  let sql = 'SELECT * FROM video_gallery_items';
  const params = [];
  if (school_id) {
    sql += ' WHERE school_id = ?';
    params.push(school_id);
  }
  if (visibility) {
    sql += params.length ? ' AND visibility = ?' : ' WHERE visibility = ?';
    params.push(visibility);
  }
  if (status) {
    sql += params.length ? ' AND status = ?' : ' WHERE status = ?';
    params.push(status);
  }
  videoGalleryDB.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};

exports.createVideo = (req, res) => {
  const {
    id,
    school_id,
    title,
    description,
    youtube_url,
    visibility,
    category,
    class_tag,
    event_tag,
    created_by,
  } = req.body;
  const created_at = now();
  const updated_at = created_at;
  const videoId = id || `vid_${Date.now()}`;

  videoGalleryDB.run(
    `INSERT INTO video_gallery_items (id, school_id, title, description, youtube_url, visibility, category, class_tag, event_tag, status, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    , [
      videoId,
      school_id,
      title,
      description || null,
      youtube_url || null,
      visibility || 'private',
      category || null,
      class_tag || null,
      event_tag || null,
      'uploaded',
      created_by || null,
      created_at,
      updated_at,
    ],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      logAudit({ video_id: videoId, action: 'uploaded', actor_id: created_by, actor_role: 'staff' });
      logLedgerEvent('video_gallery_uploaded', { video_id: videoId, school_id });
      queueEvent('video_gallery_uploaded', { video_id: videoId, school_id });
      res.status(201).json({ id: videoId, status: 'uploaded' });
    },
  );
};

exports.updateVideoStatus = (req, res) => {
  const { id } = req.params;
  const { status, actor_id, actor_role, notes } = req.body;
  const updated_at = now();

  videoGalleryDB.run(
    `UPDATE video_gallery_items SET status = ?, updated_at = ? WHERE id = ?`,
    [status, updated_at, id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Video not found' });
      logAudit({ video_id: id, action: status, actor_id, actor_role, notes });
      logLedgerEvent('video_gallery_status', { video_id: id, status });
      queueEvent('video_gallery_status', { video_id: id, status });
      res.json({ message: 'Video status updated' });
    },
  );
};

exports.getAudit = (req, res) => {
  videoGalleryDB.all('SELECT * FROM video_gallery_audit ORDER BY created_at DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};

exports.getDashboardStats = (req, res) => {
  res.json({
    total: 24,
    private: 12,
    unlisted: 8,
    published: 4,
  });
};
