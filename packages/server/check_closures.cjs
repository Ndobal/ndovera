const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');
let lines = code.split('\n');

for (let i = 130; i < 480; i++) {
  if (lines[i] && lines[i].includes(');')) {
    console.log(`Line ${i}: ${lines[i]}`);
  }
}
