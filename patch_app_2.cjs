const fs = require('fs');
let code = fs.readFileSync('packages/web/src/App.tsx', 'utf8');

// Imports
if (!code.includes("import { Birthdays }")) {
  code = code.replace("import { FinanceView } from './pages/Finance';", "import { FinanceView } from './pages/Finance';\nimport { Birthdays } from './pages/Birthdays';\nimport { ICTManagement } from './pages/ICTManagement';");
}

// Views mapping
if (!code.includes("<Birthdays role={role} />")) {
  code = code.replace("case 'communication':\n        return <CommunicationHub role={role} />;", "case 'communication':\n        return <CommunicationHub role={role} />;\n      case 'birthdays':\n        return <Birthdays role={role} />;\n      case 'ict':\n        return <ICTManagement role={role} />;");
}

// Revoked logic
if (!code.includes("role === 'Revoked'")) {
  code = code.replace("if (!role) return <ActivityLoader />;", "if (!role) return <ActivityLoader />;\n    if (role === 'Revoked') {\n      if (['aurabooster', 'farming', 'opportunities', 'communication'].includes(activeTab)) { /* allowed */ } else return <div className='p-6 w-full text-center text-white'>Access Revoked. You can only view Auras, Announcements and Farming.</div>;\n    }");
}

fs.writeFileSync('packages/web/src/App.tsx', code);
