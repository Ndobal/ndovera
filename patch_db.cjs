const fs = require('fs');
let code = fs.readFileSync('packages/server/server.ts', 'utf8');

const sqlSchema = `  -- Staff Attendance
  CREATE TABLE IF NOT EXISTS staff_attendance (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    status TEXT NOT NULL,
    date DATE NOT NULL,
    recorded_by TEXT
  );

  -- Parent Attendance
  CREATE TABLE IF NOT EXISTS parent_attendance (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    event_name TEXT NOT NULL,
    status TEXT NOT NULL,
    date DATE NOT NULL,
    recorded_by TEXT
  );

`;

code = code.replace('-- Attendance', sqlSchema + '-- Attendance');

fs.writeFileSync('packages/server/server.ts', code);
