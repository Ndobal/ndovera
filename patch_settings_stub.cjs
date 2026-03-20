const fs = require('fs');
let code = fs.readFileSync('packages/web/src/pages/Settings.tsx', 'utf8');

code = code.replace(
  '<p className="text-zinc-400 text-sm">This section is currently under development.</p>',
  `<div className="space-y-4">
      <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5">
        <div>
          <h4 className="text-white font-bold text-sm">Enable Modules</h4>
          <p className="text-zinc-500 text-xs text-wrap max-w-sm">Toggle global features on or off for your school</p>
        </div>
        <div className="w-10 h-6 bg-emerald-600 rounded-full flex items-center p-1"><div className="w-4 h-4 bg-white rounded-full translate-x-4"></div></div>
      </div>
      <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5">
        <div>
          <h4 className="text-white font-bold text-sm">Strict Security Mode</h4>
          <p className="text-zinc-500 text-xs text-wrap max-w-sm">Require 2FA for all staff roles</p>
        </div>
        <div className="w-10 h-6 bg-zinc-600 rounded-full flex items-center p-1"><div className="w-4 h-4 bg-white rounded-full"></div></div>
      </div>
      <button className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider">Save Configuration</button>
  </div>`
);

fs.writeFileSync('packages/web/src/pages/Settings.tsx', code);
