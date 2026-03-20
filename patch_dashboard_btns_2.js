const fs = require('fs');
let dash = fs.readFileSync('packages/web/src/pages/Dashboard.tsx', 'utf8');

dash = dash.replace(
  '<button className="w-full text-left p-3 rounded-lg bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/20 transition-colors text-white text-sm font-bold">Generate Fee Invoices</button>',
  '<button onClick={() => setActiveTab?.(\'finance\')} className="w-full text-left p-3 rounded-lg bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/20 transition-colors text-white text-sm font-bold">Generate Fee Invoices</button>'
);
dash = dash.replace(
  '<button className="w-full text-left p-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 transition-colors text-white text-sm font-bold">Record Manual Payment</button>',
  '<button onClick={() => setActiveTab?.(\'finance\')} className="w-full text-left p-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 transition-colors text-white text-sm font-bold">Record Manual Payment</button>'
);
dash = dash.replace(
  '<button className="w-full text-left p-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 transition-colors text-white text-sm font-bold">View Financial Report</button>',
  '<button onClick={() => setActiveTab?.(\'finance\')} className="w-full text-left p-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 transition-colors text-white text-sm font-bold">View Financial Report</button>'
);

// Are there other buttons? Let's check what's passed for isOperations.
dash = dash.replace(
  '<button className="w-full text-left p-3 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/20 transition-colors text-white text-sm font-bold">New Inventory Request</button>',
  '<button onClick={() => setActiveTab?.(role === \'Tuckshop Manager\' ? \'tuckshop\' : \'hostel\')} className="w-full text-left p-3 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/20 transition-colors text-white text-sm font-bold">New Inventory Request</button>'
);

dash = dash.replace(
  '<button className="w-full text-left p-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 transition-colors text-white text-sm font-bold">Review Stock Logs</button>',
  '<button onClick={() => setActiveTab?.(role === \'Tuckshop Manager\' ? \'tuckshop\' : \'hostel\')} className="w-full text-left p-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 transition-colors text-white text-sm font-bold">Review Stock Logs</button>'
);

dash = dash.replace(
  '<button className="w-full text-left p-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 transition-colors text-white text-sm font-bold">Generate Op Report</button>',
  '<button onClick={() => setActiveTab?.(role === \'Tuckshop Manager\' ? \'tuckshop\' : \'hostel\')} className="w-full text-left p-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 transition-colors text-white text-sm font-bold">Generate Op Report</button>'
);

fs.writeFileSync('packages/web/src/pages/Dashboard.tsx', dash);
console.log('patched dash btns');
