const fs = require('fs');
let sidebar = fs.readFileSync('packages/web/src/components/Sidebar.tsx', 'utf8');
sidebar = sidebar.replace(
  `  const visibleItems = useMemo(() => {\n    return NAVIGATION_ITEMS.filter(i => i.roles.includes(currentRole as any));\n  }, [currentRole]);`,
  `  const visibleItems = useMemo(() => {\n    let items = NAVIGATION_ITEMS.filter(i => i.roles.includes(currentRole as any));\n    if (currentRole === 'Parent' && !localStorage.getItem('activeChildId')) {\n      items = items.filter(i => i.id === 'dashboard' || i.id === 'settings' || i.id === 'notifications');\n    }\n    return items;\n  }, [currentRole, activeTab, localStorage.getItem('activeChildId')]);`
);
fs.writeFileSync('packages/web/src/components/Sidebar.tsx', sidebar);
console.log('Sidebar patched');
