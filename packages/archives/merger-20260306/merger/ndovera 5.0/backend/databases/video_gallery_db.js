const { videoGalleryDB } = require('../config/sqlite');

videoGalleryDB.run(`
CREATE TABLE IF NOT EXISTS video_gallery_items (
  id TEXT PRIMARY KEY,
  school_id TEXT,
  title TEXT,
  description TEXT,
  youtube_url TEXT,
  visibility TEXT DEFAULT 'private',
  category TEXT,
  class_tag TEXT,
  event_tag TEXT,
  status TEXT DEFAULT 'uploaded',
  created_by TEXT,
  created_at TEXT,
  updated_at TEXT
)
`);

videoGalleryDB.run(`
CREATE TABLE IF NOT EXISTS video_gallery_audit (
  id TEXT PRIMARY KEY,
  video_id TEXT,
  action TEXT,
  actor_id TEXT,
  actor_role TEXT,
  notes TEXT,
  created_at TEXT
)
`);

module.exports = videoGalleryDB;
