const fs = require('fs');
const path = require('path');

const logDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const ledgerLogPath = path.join(logDir, 'ledger.log');

function logLedgerEvent(type, payload) {
  const entry = {
    time: new Date().toISOString(),
    type,
    payload,
  };

  fs.appendFile(ledgerLogPath, JSON.stringify(entry) + '\n', (err) => {
    if (err) {
      // Logging failures should not crash the app, but we want visibility.
      console.error('Failed to write ledger log', err);
    }
  });
}

module.exports = {
  logLedgerEvent,
};
