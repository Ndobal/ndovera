const fs = require('fs');
const content = fs.readFileSync('packages/server/server.ts', 'utf8');
const lines = content.split('\n');
const match = [];
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('PORT =') || lines[i].includes('PORT')) {
    match.push(`Line ${i + 1}: ${lines[i]}`);
  }
}
fs.writeFileSync('my_port_result.txt', match.join('\n'));
