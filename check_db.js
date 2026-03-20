
const Database = require('better-sqlite3');
const db = new Database('ndovera.db', { verbose: console.log });

try {
  console.log('Checking tables...');
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log('Tables:', tables.map(t => t.name));

  console.log('\nChecking schools table schema...');
  const activeSchool = db.prepare("SELECT * FROM schools WHERE id = 'school_1'").get();
  console.log('School school_1:', activeSchool);

  console.log('\nChecking classroom_live_sessions table...');
  const sessions = db.prepare("SELECT * FROM classroom_live_sessions").all();
  console.log('Sessions:', sessions);

} catch (err) {
  console.error('Error:', err);
}
