const fs = require('fs');
let content = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');

content = content.replace(/if\s*\(isAdministration\)\s*\{\s*return\s*\(\s*<div className="space-y-6">\s*\{\/\* Header \*\/\}/g, 'if (isAdministration) {\n      return (\n        <div className="space-y-6">\n          <div className="mb-6"><ResultsTabs /></div>\n          {/* Header */}');

fs.writeFileSync('src/pages/Dashboard.tsx', content);
console.log('Done regex replace');
