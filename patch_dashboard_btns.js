const fs = require('fs');

let c = fs.readFileSync('packages/web/src/pages/Dashboard.tsx', 'utf8');

c = c.replace(
  '<button className="text-[10px] bg-emerald-500/10 text-emerald-500 px-2 py-1 rounded">New Broadcast</button>',
  '<button onClick={() => setActiveTab && setActiveTab(\'communication\')} className="text-[10px] bg-emerald-500/10 text-emerald-500 px-2 py-1 rounded hover:bg-emerald-500/20">New Broadcast</button>'
);

c = c.replace(
  '<button className="w-full text-center text-xs text-emerald-500 hover:text-emerald-600 font-medium py-2">View Communication Details</button>',
  '<button onClick={() => setActiveTab && setActiveTab(\'communication\')} className="w-full text-center text-xs text-emerald-500 hover:text-emerald-600 font-medium py-2 transition-colors">View Communication Details</button>'
);

c = c.replace('View Activity Logs', 'View Timetables');
c = c.replace('View Medical Records', 'View Clinic');

c = c.replace(
  '<button className="w-full text-center text-xs text-blue-500 hover:text-blue-600 font-medium py-2">View Timetables</button>',
  '<button onClick={() => setActiveTab && setActiveTab(\'timetable\')} className="w-full text-center text-xs text-blue-500 hover:text-blue-600 font-medium py-2 transition-colors">View Timetables</button>'
);

c = c.replace(
  '<button className="w-full text-center text-xs text-rose-500 hover:text-rose-600 font-medium py-2">View Clinic</button>',
  '<button onClick={() => setActiveTab && setActiveTab(\'clinic\')} className="w-full text-center text-xs text-rose-500 hover:text-rose-600 font-medium py-2 transition-colors">View Clinic</button>'
);

c = c.replace(
  '<button className="w-full py-2 bg-amber-500 text-white rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-amber-600 transition-colors">\n                  Open Admin Workspace\n                </button>',
  '<button onClick={() => setActiveTab && setActiveTab(\'management\')} className="w-full py-2 bg-amber-500 text-white rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-amber-600 transition-colors shadow-lg shadow-amber-900/20">\n                  Open Institutional Management\n                </button>'
);

fs.writeFileSync('packages/web/src/pages/Dashboard.tsx', c);
console.log('Wired up School Admin dashboard buttons.');
