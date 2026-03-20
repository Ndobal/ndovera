const fs = require('fs');

let dashboard = fs.readFileSync('packages/web/src/pages/Dashboard.tsx', 'utf8');
if (!dashboard.includes('Folder')) {
    dashboard = dashboard.replace(/import \{([^}]+)\} from 'lucide-react';/, "import { $1, Folder } from 'lucide-react';");
    fs.writeFileSync('packages/web/src/pages/Dashboard.tsx', dashboard);
}

let sidebar = fs.readFileSync('packages/web/src/components/Sidebar.tsx', 'utf8');
if (!sidebar.includes('FileText,')) {
    sidebar = sidebar.replace(/import \{([^}]+)\} from 'lucide-react';/, "import { $1, FileText } from 'lucide-react';");
    fs.writeFileSync('packages/web/src/components/Sidebar.tsx', sidebar);
}
console.log('Fixed imports');
