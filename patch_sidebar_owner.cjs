const fs = require('fs');
let code = fs.readFileSync('packages/web/src/components/Sidebar.tsx', 'utf8');

// The easiest way is to find all arrays that have 'HOS' and ensure they have 'Owner' and 'Tenant School Owner'.
// We can use a regex to find all arrays containing 'HOS' and append those roles if they don't exist.

const regex = /roles:\s*\[([^\]]+)\]/g;
code = code.replace(regex, (match, p1) => {
  let items = p1.split(',').map(s => s.trim().replace(/'/g, ''));
  if (items.includes('HOS')) {
    if (!items.includes('Owner')) items.push('Owner');
    if (!items.includes('Tenant School Owner')) items.push('Tenant School Owner');
  }
  const stringified = items.map(s => `'${s}'`).join(', ');
  return `roles: [${stringified}]`;
});

// Fix ROLES definition too
if (!code.includes("'Owner', 'Tenant School Owner'")) {
    if (code.includes("const ROLES: Role[] = ['Tenant School Owner', 'Revoked', 'School Admin', 'HOS'")) {
      code = code.replace("const ROLES: Role[] = ['Tenant School Owner', 'Revoked', 'School Admin', 'HOS'", "const ROLES: Role[] = ['Owner', 'Tenant School Owner', 'Revoked', 'School Admin', 'HOS'");
    }
}

fs.writeFileSync('packages/web/src/components/Sidebar.tsx', code);
