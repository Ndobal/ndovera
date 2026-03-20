const fs = require('fs');
let lp = fs.readFileSync('packages/web/src/pages/LandingPage.tsx', 'utf8');
lp = lp.replace(/&copy; 2026 Ndovera School\. All rights reserved\./g, 'Terms');
fs.writeFileSync('packages/web/src/pages/LandingPage.tsx', lp);
console.log('patched landing');

