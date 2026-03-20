const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace("    CREATE TABLE IF NOT EXISTS evaluations (", "  db.exec(`\n    CREATE TABLE IF NOT EXISTS evaluations (");

fs.writeFileSync('server.ts', code);
console.log('Done restoring exec');
