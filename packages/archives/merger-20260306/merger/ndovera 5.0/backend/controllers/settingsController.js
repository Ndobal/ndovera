const { settingsDB } = require('../config/sqlite');

const now = () => new Date().toISOString();

// Default ad-free zones that cannot be disabled
const DEFAULT_AD_FREE_ZONES = [
  'cbt',
  'exams',
  'voting',
  'civic-centre',
  'results',
  'messaging',
  'video-streams',
  'library-reading',
  'practice-corner',
  'ai-study',
  'assignments',
  'profile-editing',
  'payments',
  'cashouts',
  'financial-pages',
];

exports.getAdsConfig = (req, res) => {
  settingsDB.get('SELECT value FROM app_settings WHERE key = ?', ['ads_count'], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    const value = row?.value ? Number(row.value) : 2;
    res.json({ ads_count: Number.isFinite(value) ? value : 2 });
  });
};

exports.updateAdsConfig = (req, res) => {
  const { ads_count, updated_by } = req.body;
  const parsed = Number(ads_count);
  const count = Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 2;
  const updated_at = now();

  settingsDB.run(
    `INSERT INTO app_settings (key, value, updated_by, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_by = excluded.updated_by, updated_at = excluded.updated_at`
    , ['ads_count', String(count), updated_by || null, updated_at],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ ads_count: count });
    },
  );
};

exports.getAdFreeZones = (req, res) => {
  res.json({
    ad_free_zones: DEFAULT_AD_FREE_ZONES,
    description: 'Ad-free zones where ads are disabled globally',
  });
};

exports.isAdFreeZone = (zoneName) => {
  if (!zoneName) return false;
  const normalized = String(zoneName).toLowerCase().trim();
  return DEFAULT_AD_FREE_ZONES.includes(normalized);
};
