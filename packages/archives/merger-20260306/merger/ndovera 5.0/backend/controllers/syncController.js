const { createHmac } = require('crypto');
const { syncDB } = require('../config/sqlite');
const { decrypt } = require('../utils/encryption');
const { upsertUserToPostgres } = require('./usersController');
const { upsertSchoolToPostgres } = require('./schoolsController');
const { upsertApprovalToPostgres } = require('./hosController');
const { upsertLamsToPostgres } = require('./lamsController');
const { upsertPageToPostgres } = require('./websiteController');

/**
 * GET /api/sync/pending
 * Debug/ops endpoint: list all unsynced offline events.
 */
exports.getPendingEvents = (req, res) => {
  syncDB.all('SELECT * FROM offline_events WHERE synced = 0', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};

/**
 * POST /api/sync/mark-synced
 * Mark a given set of event ids as synced (used after a successful replay).
 */
exports.markEventsSynced = (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids array is required' });
  }

  const placeholders = ids.map(() => '?').join(',');
  syncDB.run(
    `UPDATE offline_events SET synced = 1 WHERE id IN (${placeholders})`,
    ids,
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Events marked as synced', updated: this.changes });
    },
  );
};

/**
 * POST /api/sync/apply
 *
 * Offline-first central sync endpoint.
 * - Reads all unsynced events from SQLite.
 * - Verifies device signature for each event.
 * - Decrypts the payload and routes it to the appropriate controller-level
 *   PostgreSQL upsert helper.
 * - Applies a simple "latest timestamp wins" conflict strategy using
 *   the updated_at field inside each payload.
 */
exports.applyPendingToPostgres = async (req, res) => {
  const deviceSecret = process.env.NDO_DEVICE_SECRET || 'dev-secret';

  syncDB.all('SELECT * FROM offline_events WHERE synced = 0', [], async (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });

    const processedIds = [];

    for (const row of rows) {
      try {
        const envelope = JSON.parse(row.payload);
        const serializedCipher = JSON.stringify(envelope.cipher);

        // Verify HMAC signature to ensure integrity.
        const expectedSignature = createHmac('sha256', deviceSecret)
          .update(serializedCipher)
          .digest('hex');

        if (envelope.signature !== expectedSignature) {
          console.warn('Signature mismatch for event', row.id);
          continue; // Skip tampered events.
        }

        const plaintext = decrypt(envelope.cipher);
        const payload = JSON.parse(plaintext);

        await applyEventToPostgres(row.type, payload);
        processedIds.push(row.id);
      } catch (e) {
        console.error('Failed to apply offline event', row.id, e.message);
      }
    }

    if (processedIds.length) {
      const placeholders = processedIds.map(() => '?').join(',');
      syncDB.run(
        `UPDATE offline_events SET synced = 1 WHERE id IN (${placeholders})`,
        processedIds,
      );
    }

    res.json({ message: 'Sync applied', processed: processedIds.length });
  });
};

/**
 * Route a decoded event payload into the appropriate PostgreSQL helper.
 * Types are intentionally coarse-grained and can be extended.
 */
async function applyEventToPostgres(type, payload) {
  switch (type) {
    case 'user_upsert':
      return upsertUserToPostgres(payload);
    case 'user_delete':
      // Hard delete in central DB mirrors local delete.
      return require('../config/postgres').query('DELETE FROM nsms_users WHERE id = $1', [payload.id]);
    case 'school_upsert':
      return upsertSchoolToPostgres(payload);
    case 'school_delete':
      return require('../config/postgres').query('DELETE FROM nsms_schools WHERE id = $1', [payload.id]);
    case 'hos_approval_upsert':
      return upsertApprovalToPostgres(payload);
    case 'lams_entry': {
      // LAMS Farming Mode guard is re-applied here as a safety net.
      const isFarming = payload.type === 'farming';
      const farmingActive = !!payload.farming_mode;
      if (isFarming && !farmingActive) return; // Do not sync.
      return upsertLamsToPostgres(payload);
    }
    case 'website_page_upsert':
      return upsertPageToPostgres(payload);
    default:
      console.warn('Unhandled offline event type', type);
  }
}

exports.applyEventToPostgres = applyEventToPostgres;
