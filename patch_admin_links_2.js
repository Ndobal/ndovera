const fs = require('fs');
let dash = fs.readFileSync('packages/web/src/pages/Dashboard.tsx', 'utf8');

dash = dash.replace(
  `<h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-zinc-400 mb-4">Command Actions</h3>
                <div className="grid gap-3">
                  <button onClick={() => setActiveTab?.('approvals')}`,
  `<h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-zinc-400 mb-4">Command Actions</h3>
                <div className="grid gap-3">
                  <button onClick={() => setActiveTab?.('finance')} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 hover:border-emerald-500/30 text-left transition-all">
                    <div className="p-2 bg-emerald-100 dark:bg-emerald-500/10 rounded-lg text-emerald-600 dark:text-emerald-500"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg></div>
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-white">Finance</p>
                      <p className="text-[9px] uppercase tracking-wider text-slate-500 dark:text-zinc-500 mt-0.5">Fees & Reports</p>
                    </div>
                  </button>
                  <button onClick={() => setActiveTab?.('tuckshop')} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 hover:border-orange-500/30 text-left transition-all">
                    <div className="p-2 bg-orange-100 dark:bg-orange-500/10 rounded-lg text-orange-600 dark:text-orange-500"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg></div>
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-white">Tuckshop</p>
                      <p className="text-[9px] uppercase tracking-wider text-slate-500 dark:text-zinc-500 mt-0.5">Sales & Inventory</p>
                    </div>
                  </button>
                  <button onClick={() => setActiveTab?.('hostel')} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 hover:border-blue-500/30 text-left transition-all">
                    <div className="p-2 bg-blue-100 dark:bg-blue-500/10 rounded-lg text-blue-600 dark:text-blue-500"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></div>
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-white">Hostel</p>
                      <p className="text-[9px] uppercase tracking-wider text-slate-500 dark:text-zinc-500 mt-0.5">Rooms & Setup</p>
                    </div>
                  </button>
                  <button onClick={() => setActiveTab?.('approvals')}`
);

fs.writeFileSync('packages/web/src/pages/Dashboard.tsx', dash);
console.log('patched admin links 2');
