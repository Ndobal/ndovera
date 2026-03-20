const fs = require('fs');
let code = fs.readFileSync('packages/web/src/pages/Dashboard.tsx', 'utf8');

code = code.replace(
  "const isAdministration = ['HOS', 'HoS', 'Owner', 'Principal', 'Head Teacher', 'Nursery Head', 'HOD', 'Ami'].includes(role);",
  "const isAdministration = ['HOS', 'HoS', 'Owner', 'Tenant School Owner', 'Principal', 'Head Teacher', 'Nursery Head', 'HOD', 'Ami'].includes(role);"
);

fs.writeFileSync('packages/web/src/pages/Dashboard.tsx', code);
