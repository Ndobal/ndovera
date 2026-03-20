const { randomUUID, createHmac } = require('crypto');
const { syncDB } = require('../config/sqlite');
const { encrypt } = require('./encryption');

/**
 * Queue an immutable, device-signed, encrypted offline event.
 *
 * - Payload is encrypted locally (AES-256) before being written to SQLite.
 * - Each event is tagged with a deviceId and HMAC signature so the
 *   SyncController can verify integrity before applying it to PostgreSQL.
 */
function queueEvent(type, payload, callback) {
  const id = randomUUID();
  const createdAt = new Date().toISOString();

  const deviceId = process.env.NDO_DEVICE_ID || 'dev-device';
  const deviceSecret = process.env.NDO_DEVICE_SECRET || 'dev-secret';

  const cipher = encrypt(JSON.stringify(payload));
  const serializedCipher = JSON.stringify(cipher);

  const signature = createHmac('sha256', deviceSecret)
    .update(serializedCipher)
    .digest('hex');

  const envelope = {
    deviceId,
    signature,
    cipher,
  };

  syncDB.run(
    `INSERT INTO offline_events (id, type, payload, synced, created_at)
     VALUES (?, ?, ?, 0, ?)`,
    [id, type, JSON.stringify(envelope), createdAt],
    (err) => {
      if (callback) callback(err);
    },
  );
}

function markEventSynced(id, callback) {
  syncDB.run(
    `UPDATE offline_events SET synced = 1 WHERE id = ?`,
    [id],
    function (err) {
      if (callback) callback(err, this.changes);
    },
  );
}

module.exports = {
  queueEvent,
  markEventSynced,
};
