const fs = require('fs');
let dash = fs.readFileSync('packages/web/src/pages/Dashboard.tsx', 'utf8');

dash = dash.replace(
  `          {isOperations && (
            <div className="card-compact">
              <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-4">Recent Operations Log</h3>`,
  `          {isOperations && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card-compact bg-orange-500/5 border-orange-500/10">
              <h3 className="text-xs font-bold uppercase tracking-widest text-orange-400 mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <button onClick={() => setActiveTab?.(role === 'Tuckshop Manager' ? 'tuckshop' : role === 'Hostel Manager' ? 'hostel' : role === 'Librarian' ? 'library' : 'clinic')} className="w-full text-left p-3 rounded-lg bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/20 transition-colors text-white text-sm font-bold">Open Operations Workspace</button>
                <button onClick={() => setActiveTab?.(role === 'Tuckshop Manager' ? 'tuckshop' : role === 'Hostel Manager' ? 'hostel' : role === 'Librarian' ? 'library' : 'clinic')} className="w-full text-left p-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 transition-colors text-white text-sm font-bold">Manage Inventory & Logs</button>
              </div>
            </div>
            <div className="card-compact">
              <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-4">Recent Operations Log</h3>`
);

// We need to properly close the new div since we replaced a single element with a wrapper
dash = dash.replace(
  `              </div>
            </div>
          )}

          <div className="flex items-center justify-between px-1">`,
  `              </div>
            </div>
            </div>
          )}

          <div className="flex items-center justify-between px-1">`
);

fs.writeFileSync('packages/web/src/pages/Dashboard.tsx', dash);
console.log('ops patched');