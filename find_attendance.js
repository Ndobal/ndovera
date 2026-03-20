const fs = require('fs');
const code = fs.readFileSync('packages/server/server.ts', 'utf8');
const index = code.indexOf('app.post(\'/api/attendance/mark\', requireRoles');
console.log('Index:', index);
if (index !== -1) {
    const contextStart = Math.max(0, index - 200);
    const contextEnd = Math.min(code.length, index + 500);
    console.log(code.substring(contextStart, contextEnd));
} else {
    console.log("Not found.");
}
