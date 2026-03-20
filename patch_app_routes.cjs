const fs = require('fs');

let code = fs.readFileSync('packages/web/src/App.tsx', 'utf8');

// Ensure DutyReport route
if (!code.includes('DutyReport =')) {
  // Add import
  const firstImport = code.indexOf('function PageLoader');
  code = code.slice(0, firstImport) + "const DutyReport = lazy(() => import('./features/reports/components/DutyReport').then((module) => ({ default: module.default })));\n" + code.slice(firstImport);
}

// Replace route if needed
if (!code.includes('path="/duty-report"')) {
  code = code.replace(
    /(<Route path="\/reports" element={<ReportsView \/>} \/>)/,
    `$1\n        <Route path="/duty-report" element={<DutyReport />} />\n        <Route path="/evaluations" element={<ReportsView />} />`
  );
}

fs.writeFileSync('packages/web/src/App.tsx', code);
console.log('App patched');
