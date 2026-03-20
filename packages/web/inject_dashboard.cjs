const fs = require('fs');

let content = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');

// Add import if not exists
if (!content.includes('ResultsTabs')) {
    content = content.replace("import { SchoolGuard } from '../components/SchoolGuard';", "import { SchoolGuard } from '../components/SchoolGuard';\nimport { ResultsTabs } from '../features/evaluation/components/ResultsTabs';");
}

// Replace the end of Admin block
const adminInsertPoint = `Term 2, Week 6
              </div>
            </div>`;

if (content.includes(adminInsertPoint) && !content.includes('<ResultsTabs />')) {
  content = content.replace(adminInsertPoint, `${adminInsertPoint}\n          </div>\n          <div className="mt-8">\n            <ResultsTabs />\n          </div>\n          <div className="hidden">`);
}

fs.writeFileSync('src/pages/Dashboard.tsx', content);
console.log('Injected ResultsTabs successfully');
