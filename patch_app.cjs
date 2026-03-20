const fs = require('fs');
let code = fs.readFileSync('packages/web/src/App.tsx', 'utf8');

// Imports
code = code.replace("import { FinanceView } from './pages/Finance';", "import { FinanceView } from './pages/Finance';\nimport { Birthdays } from './pages/Birthdays';\nimport { ICTManagement } from './pages/ICTManagement';");

// Views mapping
code = code.replace("case 'communication':\n        return <CommunicationHub role={role} />;", "case 'communication':\n        return <CommunicationHub role={role} />;\n      case 'birthdays':\n        return <Birthdays role={role} />;\n      case 'ict':\n        return <ICTManagement role={role} />;");

// Revoked logic
code = code.replace("if (!role) return <ActivityLoader />;", "if (!role) return <ActivityLoader />;\n    if (role === 'Revoked') {\n      if (['aurabooster', 'farming', 'opportunities'].includes(activeTab)) return null; else setActiveTab('farming');\n    }");

fs.writeFileSync('packages/web/src/App.tsx', code);
