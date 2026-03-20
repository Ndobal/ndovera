const fs = require('fs');

const path = 'packages/web/src/pages/Management.tsx';
let c = fs.readFileSync(path, 'utf8');

const target = `        >
          Staff ({teachers?.length || 0})
          {activeTab === 'teachers' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-emerald-500 rounded-full"></div>}
        </button>`;

const newBtn = `
        <button
          onClick={() => setActiveTab('parents')}
          className={\`pb-3 text-xs font-bold uppercase tracking-wider transition-all relative \${
            activeTab === 'parents' ? 'text-emerald-500' : 'text-zinc-500 hover:text-zinc-300'
          }\`}
        >
          Parents ({parents?.length || 0})
          {activeTab === 'parents' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-emerald-500 rounded-full"></div>}
        </button>`;

if (c.includes(target) && !c.includes("setActiveTab('parents')")) {
    c = c.replace(target, target + newBtn);
    fs.writeFileSync(path, c);
    console.log("Success! Parent tab added.");
} else {
    console.log("Target not found or already added.");
}
