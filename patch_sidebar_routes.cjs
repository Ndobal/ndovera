const fs = require('fs');

let code = fs.readFileSync('packages/web/src/components/Sidebar.tsx', 'utf8');

if (!code.includes("id: 'duty-report'")) {
  code = code.replace(
    /\{ id: 'reports', label: 'Reports', icon: <BarChart3 size=\{20\} \/>, roles: \['Super Admin', 'School Admin', 'HOS', 'Finance Officer', 'Owner', 'Tenant School Owner'\] \},/,
    `{ id: 'reports', label: 'Reports', icon: <BarChart3 size={20} />, roles: ['Super Admin', 'School Admin', 'HOS', 'Finance Officer', 'Owner', 'Tenant School Owner'] },
    { id: 'duty-report', label: 'Duty Reports', icon: <FileText size={20} />, roles: ['Teacher', 'HOS', 'HoS', 'Owner', 'School Admin'] },`
  );
  
  // Also we need FileText import if it doesn't exist
  if (!code.includes('FileText')) {
    code = code.replace(/import \{([^}]+)\} from 'lucide-react';/, "import { $1, FileText } from 'lucide-react';");
  }

  fs.writeFileSync('packages/web/src/components/Sidebar.tsx', code);
  console.log('Sidebar patched');
} else {
  console.log('Sidebar already patched');
}
