const { lamsDB } = require('../config/sqlite');
const pool = require('../config/postgres');
const { logLedgerEvent } = require('../utils/logger');
const { queueEvent } = require('../utils/offlineQueue');

/**
 * Helper: upsert a LAMS ledger entry into central PostgreSQL.
 *
 * Assumes a central table `nsms_lams_ledger` with columns:
 *   (id, user_id, school_id, points, farming_mode, type, status, created_at, updated_at)
 */
async function upsertLamsToPostgres(entry, client) {
  const pg = client || pool;
  const {
    id,
    user_id,
    school_id,
    points,
    farming_mode,
    type,
    status,
    created_at,
    updated_at,
  } = entry;

  const query = `
    INSERT INTO nsms_lams_ledger (id, user_id, school_id, points, farming_mode, type, status, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    ON CONFLICT (id) DO UPDATE SET
      points = EXCLUDED.points,
      farming_mode = EXCLUDED.farming_mode,
      type = EXCLUDED.type,
      status = EXCLUDED.status,
      updated_at = EXCLUDED.updated_at;
  `;

  await pg.query(query, [
    id,
    user_id,
    school_id,
    points,
    farming_mode,
    type,
    status,
    created_at,
    updated_at,
  ]);
}

/**
 * GET /api/lams/ledger/:userId
 */
exports.getLedgerForUser = (req, res) => {
  const { userId } = req.params;
  lamsDB.all('SELECT * FROM lams_ledger WHERE user_id = ?', [userId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};

/**
 * POST /api/lams/ledger
 * Create a LAMS entry (student redemption, staff reward, or farming accrual).
 *
 * Farming Mode rule: events with type 'farming' are only synced to PostgreSQL
 * if farming_mode is truthy; they are still logged locally for audit.
 */
exports.createLamsEntry = (req, res) => {
  const { id, user_id, school_id, points, farming_mode, type } = req.body;
  const status = req.body.status || 'pending';
  const created_at = req.body.created_at || new Date().toISOString();
  const updated_at = req.body.updated_at || created_at;

  lamsDB.run(
    `INSERT INTO lams_ledger (id, user_id, school_id, points, farming_mode, type, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, COALESCE(?, 0), ?, ?, ?, ?)`,
    [id, user_id, school_id, points, farming_mode, type, status, created_at, updated_at],
    async (err) => {
      if (err) return res.status(500).json({ error: err.message });

      const payload = {
        id,
        user_id,
        school_id,
        points,
        farming_mode: farming_mode ?? 0,
        type,
        status,
        created_at,
        updated_at,
      };

      logLedgerEvent('lams_entry', payload);
      queueEvent('lams_entry', payload);

      // Only sync "farming"-type events if Farming Mode is active.
      const shouldSync = type !== 'farming' || !!payload.farming_mode;

      if (shouldSync) {
        try {
          await upsertLamsToPostgres(payload);
        } catch (syncErr) {
          console.error('Deferred LAMS sync to PostgreSQL:', syncErr.message);
        }
      }

      res.status(201).json({ message: 'LAMS entry created successfully' });
    },
  );
};

exports.upsertLamsToPostgres = upsertLamsToPostgres;
