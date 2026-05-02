const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data', 'ndovera.db');
const db = new sqlite3.Database(DB_PATH);

async function exportToSQL() {
  const tables = ['settings', 'audit', 'books', 'borrowings', 'classes', 'class_members', 'posts', 'assignments', 'submissions', 'attendance_records', 'materials', 'content_saves'];

  let sql = '';

  for (const table of tables) {
    sql += `-- Exporting ${table}\n`;
    const rows = await new Promise((resolve, reject) => {
      db.all(`SELECT * FROM ${table}`, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    if (rows.length === 0) continue;

    // Get columns
    const columns = Object.keys(rows[0]);
    sql += `INSERT INTO ${table} (${columns.join(', ')}) VALUES\n`;

    const values = rows.map(row => {
      const vals = columns.map(col => {
        const val = row[col];
        if (val === null) return 'NULL';
        if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
        return val;
      });
      return `(${vals.join(', ')})`;
    });

    sql += values.join(',\n') + ';\n\n';
  }

  fs.writeFileSync('migration_data.sql', sql);
  console.log('Exported to migration_data.sql');
}

exportToSQL().then(() => db.close());