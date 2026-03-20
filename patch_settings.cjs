const fs = require('fs');
let code = fs.readFileSync('packages/web/src/pages/Settings.tsx', 'utf8');

code = code.replace(
  "const isAdmin = role && ['HOS', 'HoS', 'Owner', 'ICT Manager'].includes(role);",
  "const isAdmin = role && ['HOS', 'HoS', 'Owner', 'Tenant School Owner', 'ICT Manager'].includes(role);\n  const isOwner = role && ['Owner', 'Tenant School Owner'].includes(role);"
);

code = code.replace(
  "if (isAdmin) {",
  `if (isOwner) {
    sections.push({ id: 'owner-hub', label: 'Ownership & Administration', desc: 'Transfer ownership, appoint HOS, or close the school.', icon: <Shield size={20} className="text-rose-500" /> });
  }

  if (isAdmin) {`
);

code = code.replace(
  "if (activeSection === 'result-management') {",
  `if (activeSection === 'owner-hub') {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button onClick={() => setActiveSection(null)} className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-all"><ArrowLeft size={18} /></button>
          <div>
            <h2 className="text-xl font-bold text-white">Ownership & Administration</h2>
            <p className="text-zinc-500 text-xs">High-level administrative actions for school owners.</p>
          </div>
        </div>
        <div className="card-compact border border-rose-500/20 bg-rose-500/5 space-y-6">
           <div>
             <h3 className="text-sm font-bold text-white">Appoint New HOS</h3>
             <p className="text-xs text-zinc-400 mb-2">Transfer Head of School responsibilities to another staff member.</p>
             <button onClick={() => alert('Appoint new HOS modal would open')} className="bg-white/10 border border-white/5 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-white/20 transition-colors">Select New HOS</button>
           </div>
           <div className="h-px bg-white/10"></div>
           <div>
             <h3 className="text-sm font-bold text-white">Transfer Ownership</h3>
             <p className="text-xs text-zinc-400 mb-2">Securely transfer full ownership of this tenant to another user.</p>
             <button onClick={() => alert('Transfer Ownership workflow initiated')} className="bg-orange-500/20 text-orange-500 px-4 py-2 rounded-lg text-xs font-bold hover:bg-orange-500/30 transition-colors">Transfer Ownership</button>
           </div>
           <div className="h-px bg-white/10"></div>
           <div>
             <h3 className="text-sm font-bold text-rose-500 mb-2">Danger Zone: Close School</h3>
             <p className="text-xs text-zinc-400 mb-2">Permanently deactivate this school tenant and archive all data.</p>
             <button onClick={() => confirm('Are you absolutely sure you want to close this school? This action is irreversible.')} className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition-colors">Close School</button>
           </div>
        </div>
      </div>
    );
  }

  if (activeSection === 'result-management') {`
);

fs.writeFileSync('packages/web/src/pages/Settings.tsx', code);
