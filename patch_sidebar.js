const fs = require('fs');

let c = fs.readFileSync('packages/web/src/components/Sidebar.tsx', 'utf8');

c = c.replace(
  "{ id: 'scoresheet', label: 'Score Sheet', icon: <ClipboardCheck size={20} />, roles: ['School Admin', 'HOS', 'Teacher'] },",
  "{ id: 'scoresheet', label: 'Score Sheet', icon: <ClipboardCheck size={20} />, roles: ['HOS', 'Teacher'] },"
);

c = c.replace(
  "{ id: 'finance', label: 'Finance', icon: <Wallet size={20} />, roles: ['Super Admin', 'School Admin', 'HOS', 'Finance Officer', 'Parent'] },",
  "{ id: 'finance', label: 'Finance', icon: <Wallet size={20} />, roles: ['Super Admin', 'HOS', 'Finance Officer', 'Parent'] },"
);

fs.writeFileSync('packages/web/src/components/Sidebar.tsx', c);
console.log('Sidebar updated');
const fs = require('fs');
let sidebar = fs.readFileSync('packages/web/src/components/Sidebar.tsx', 'utf8');
sidebar = sidebar.replace(
  \  const visibleItems = useMemo(() => {\n    return NAVIGATION_ITEMS.filter(i => i.roles.includes(currentRole as any));\n  }, [currentRole]);\,
  \  const visibleItems = useMemo(() => {\n    let items = NAVIGATION_ITEMS.filter(i => i.roles.includes(currentRole as any));\n    if (currentRole === 'Parent' && !localStorage.getItem('activeChildId')) {\n      items = items.filter(i => i.id === 'dashboard' || i.id === 'settings' || i.id === 'notifications');\n    }\n    return items;\n  }, [currentRole, activeTab]);\
);
fs.writeFileSync('packages/web/src/components/Sidebar.tsx', sidebar);
console.log('Sidebar patched');

