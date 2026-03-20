const fs = require('fs');
let c = fs.readFileSync('packages/web/src/pages/Management.tsx', 'utf8');

c = c.replace(/Staff \\(\{teachers\?\\.length \\\|\\\| 0\}\\)/, \Staff ({teachers?.length || 0})
            {activeTab === 'teachers' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-emerald-500 rounded-full"></div>}
          </button>
          <button 
            onClick={() => setActiveTab('parents')}
            className={\\\pb-3 text-xs font-bold uppercase tracking-wider transition-all relative \\\\\\}
          >
            Parents ({parents?.length || 0})
            {activeTab === 'parents' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-emerald-500 rounded-full"></div>}\);

fs.writeFileSync('packages/web/src/pages/Management.tsx', c);
console.log('done');
