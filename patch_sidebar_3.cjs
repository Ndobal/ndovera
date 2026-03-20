const fs = require('fs');
let code = fs.readFileSync('packages/web/src/components/Sidebar.tsx', 'utf8');
code = code.replace("import { Role } from '../types';", "import { Role } from '../types';\nimport { Cake, Server } from 'lucide-react';");

// Add Tenant School Owner to Roles
code = code.replace("const ROLES: Role[] = [", "const ROLES: Role[] = ['Tenant School Owner', 'Revoked', ");

// Add Birthday to top level items 
code = code.replace("{ id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} />, roles: ROLES },", 
`{ id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} />, roles: ROLES },
  { id: 'birthdays', label: 'Birthdays', icon: <Cake size={20} />, roles: ROLES },`);

// Add ICT to specific roles 
code = code.replace("roles: ['Super Admin', 'HOS', 'ICT Manager'] },", "roles: ['Super Admin', 'HOS', 'ICT Manager', 'Tenant School Owner'] },");

// Fix global roles
code = code.replace("const globalRole = ['Super Admin', 'Ami', 'Owner'].includes(currentRole);", "const globalRole = ['Super Admin', 'Ami', 'Owner', 'Tenant School Owner'].includes(currentRole);");

fs.writeFileSync('packages/web/src/components/Sidebar.tsx', code);
