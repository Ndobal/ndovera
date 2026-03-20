const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// Count template string backticks before line 425
let lines = code.split('\n');
let count = 0;
for(let i = 0; i < 425; i++) {
  let line = lines[i] || '';
  // count occurrences of literal backtick (not escaped)
  let m = line.match(/(?<!\\)`/g);
  if (m) count += m.length;
}

console.log('Backticks before line 425:', count);
// If count is odd, there's an unclosed template string.
