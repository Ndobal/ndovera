const fs = require('fs');
let c = fs.readFileSync('packages/web/src/pages/Management.tsx', 'utf8');

const anchor = 'Staff ({teachers?.length || 0})';
const tabHTML =           <button 
            onClick={() => setActiveTab('parents')}
            className={\pb-3 text-xs font-bold uppercase tracking-wider transition-all relative \\}
          >
            Parents ({parents?.length || 0})
            {activeTab === 'parents' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-emerald-500 rounded-full"></div>}
          </button>;

if (c.includes(anchor)) {
    let index = c.indexOf('</button>', c.indexOf(anchor)) + '</button>'.length;
    c = c.slice(0, index) + '\n' + tabHTML + c.slice(index);
    fs.writeFileSync('packages/web/src/pages/Management.tsx', c);
    console.log('Tab injected!');
} else {
    console.log('Anchor not found');
}
