const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, 'packages/server/ndovera.db');
const db = new Database(dbPath);

try { db.exec(`ALTER TABLE duty_reports ADD COLUMN report_data TEXT;`); } catch(e){}
try { db.exec(`ALTER TABLE duty_reports ADD COLUMN ai_analysis TEXT;`); } catch(e){}
try { db.exec(`ALTER TABLE users ADD COLUMN auras INTEGER DEFAULT 500;`); } catch(e){}

console.log('Advanced DB updated');