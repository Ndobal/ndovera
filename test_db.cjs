const fs = require('fs');
const Database = require('better-sqlite3');
const lines = fs.readFileSync('packages/server/server.ts', 'utf8').split('\n');

let sql = '';
let inBlock = false;
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('db.exec(`')) {
        inBlock = true;
        sql += lines[i].split('`')[1] + '\n';
        continue;
    }
    if (inBlock) {
        if (lines[i].includes('`);')) {
            sql += lines[i].split('`')[0];
            break;
        } else {
            sql += lines[i] + '\n';
        }
    }
}

try {
    const db = new Database(':memory:');
    const statements = sql.split(';');

    for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i].trim();
        if (!stmt) continue;
        try {
            db.exec(stmt);
        } catch (err) {
            console.error('ERROR in statement index:', i);
            console.error('PREV STATEMENT WAS:');
            console.error(statements[i-1]);
            console.error('THE STATEMENT WAS:');
            console.error(stmt);
            console.error('THE ERROR:', err.message);
            break;
        }
    }
} catch (err) {
    console.error('SQL Error:', err);
}
