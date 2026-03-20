const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, 'packages/server/ndovera.db');
const db = new Database(dbPath);

console.log("Applying attendance and duty report schema...");

db.exec(`
  CREATE TABLE IF NOT EXISTS attendance_fines (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    amount REAL,
    reason TEXT,
    date TEXT,
    status TEXT DEFAULT 'unpaid'
  );

  CREATE TABLE IF NOT EXISTS duty_reports (
    id TEXT PRIMARY KEY,
    staff_id TEXT,
    date TEXT,
    report_text TEXT,
    status TEXT DEFAULT 'pending',
    hos_notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

try { db.exec(`ALTER TABLE attendance ADD COLUMN sign_in_time TEXT;`); } catch(e) {}
try { db.exec(`ALTER TABLE attendance ADD COLUMN sign_out_time TEXT;`); } catch(e) {}
try { db.exec(`ALTER TABLE attendance ADD COLUMN fine_applied INTEGER DEFAULT 0;`); } catch(e) {}

console.log("Done.");