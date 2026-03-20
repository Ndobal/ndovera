const fs = require('fs');
let code = fs.readFileSync('packages/web/src/pages/AuraBooster.tsx', 'utf8');

code = code.replace(
  '<div className="flex flex-col md:flex-row md:items-center justify-between gap-4">',
  `<div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
      {role === 'HOS' && <button onClick={() => alert('School auras cashed out to school account')} className='bg-emerald-600 px-4 py-2 rounded-xl text-white font-bold tracking-widest text-[10px] uppercase'>Cashout All School Auras</button>}`
);

fs.writeFileSync('packages/web/src/pages/AuraBooster.tsx', code);
