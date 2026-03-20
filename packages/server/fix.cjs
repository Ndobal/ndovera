const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// Fix \n
code = code.replace(/\\napp\.post/g, '\napp.post');

// Fix template string missing backtick
const badExec = `  db.exec(
    CREATE TABLE IF NOT EXISTS evaluations (`
const goodExec = `  db.exec(\`
    CREATE TABLE IF NOT EXISTS evaluations (`
code = code.replace(badExec, goodExec);

fs.writeFileSync('server.ts', code);
console.log('Fixed');