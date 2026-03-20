const fs = require('fs');
let code = fs.readFileSync('packages/server/server.ts', 'utf8');

// Find the AURAS block
let aurasIndex = code.indexOf('// ==================== AURAS & PREMIUM FEATURES ====================');
let listenIdx = code.indexOf('app.listen(', aurasIndex);

// Let's strip out the AURAS / DUTY block entirely.
let firstSrv = code.indexOf('const srv = \n\n//');
// Wait, the easiest way to fix it is to move the AURAS & DUTY block back up *before* `startServer();` entirely or earlier where it makes sense, and fix the `const srv = app.listen` syntax.

let originalBadBlockStart = code.lastIndexOf('      try {\n        await new Promise<void>((resolve, reject) => {\n              const srv =\n\n// ==================== AURAS');

// I will just read all of server.ts and manually patch the bottom lines
