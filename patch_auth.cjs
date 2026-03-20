const fs = require('fs');
let code = fs.readFileSync('packages/web/src/pages/Auth.tsx', 'utf8');
code = code.replace("'Super Admin',", "'Tenant School Owner', 'Revoked', 'Super Admin',");
fs.writeFileSync('packages/web/src/pages/Auth.tsx', code);
