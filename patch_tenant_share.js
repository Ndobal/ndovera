const fs = require('fs');
let c = fs.readFileSync('packages/web/src/pages/SchoolFileSharing.tsx', 'utf8');

c = c.replace(
  '<option value="tenant">Tenant-wide</option>',
  ''
);

c = c.replace(
  "{renderSection('Tenant-wide shelf', 'Files shared across schools within the tenant workspace.', 'border-amber-500/20 bg-amber-500/5', grouped.tenant)}",
  ""
);

c = c.replace(
  "{ label: 'Tenant-wide', value: grouped.tenant.length, icon: <Globe2 size={18} className=\"text-amber-400\" /> },",
  ""
);

fs.writeFileSync('packages/web/src/pages/SchoolFileSharing.tsx', c);
console.log('Removed tenant share options from UI');
