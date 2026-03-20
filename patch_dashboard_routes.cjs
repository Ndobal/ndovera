const fs = require('fs');

let code = fs.readFileSync('packages/web/src/pages/Dashboard.tsx', 'utf8');

code = code.replace(/setActiveTab\?\.\('reports'\)/g, "setActiveTab?.('duty-report')");
code = code.replace(/setActiveTab\?\.\('filessharing'\)/g, "setActiveTab?.('file-sharing')");

fs.writeFileSync('packages/web/src/pages/Dashboard.tsx', code);
console.log('Dashboard patched');
