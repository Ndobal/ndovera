const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// I will remove line 423 and whatever else was breaking
let lines = code.split('\n');

if (lines[423].includes('db.exec(`')) {
  lines[423] = '';
}

if (lines[452].includes('`);')) {
  lines[452] = '  );'; // change it to just close the table
}

fs.writeFileSync('server.ts', lines.join('\n'));
console.log('Fixed');
