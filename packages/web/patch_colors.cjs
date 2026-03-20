const fs = require('fs');
const paths = [
  'C:/Users/HP/Desktop/Projects/ndovera/packages/web/src/features/attendance/components/ParentAttendance.tsx',
  'C:/Users/HP/Desktop/Projects/ndovera/packages/web/src/features/attendance/components/StaffAttendance.tsx'
];

paths.forEach(p => {
  let f = fs.readFileSync(p, 'utf8');

  // Background replacements
  f = f.replace(/bg-slate-800\/50/g, 'bg-white dark:bg-slate-800/50');
  f = f.replace(/bg-slate-800(?![\/\w])/g, 'bg-white dark:bg-slate-800');
  f = f.replace(/bg-slate-900\/50/g, 'bg-slate-50 dark:bg-slate-900/50');
  f = f.replace(/bg-slate-700\/30/g, 'bg-white'); // QR code background -> White for printing

  // Border replacements
  f = f.replace(/border-slate-700\/50/g, 'border-slate-200 dark:border-slate-700/50');
  f = f.replace(/border-slate-700(?![\/\w])/g, 'border-slate-200 dark:border-slate-700');
  f = f.replace(/border-slate-600\/50/g, 'border-slate-200 dark:border-slate-600/50');
  f = f.replace(/border-slate-600/g, 'border-slate-200 dark:border-slate-600');

  // Text replacements
  f = f.replace(/text-slate-400/g, 'text-slate-500 dark:text-slate-400');
  f = f.replace(/text-slate-300/g, 'text-slate-600 dark:text-slate-300');
  f = f.replace(/text-white/g, 'text-slate-900 dark:text-white');
  f = f.replace(/text-indigo-400/g, 'text-black'); // Make QR code icon Black instead of indigo
  
  // Custom tweaks for QR Scanner
  f = f.replace(/bg-slate-700/g, 'bg-slate-100 dark:bg-slate-700');
  
  fs.writeFileSync(p, f);
});

console.log("Replaced successfully!");