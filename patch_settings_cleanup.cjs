const fs = require('fs');
let code = fs.readFileSync('packages/web/src/pages/Settings.tsx', 'utf8');

code = code.replace(
  "import { useState } from 'react';",
  "import { useState } from 'react';\nimport { useToast } from '../components/Toast';"
);

code = code.replace(
  "const [activeSection, setActiveSection] = useState<string | null>(null);",
  "const [activeSection, setActiveSection] = useState<string | null>(null);\n  const { showToast } = useToast();\n  const [showHOSModal, setShowHOSModal] = useState(false);\n  const [showTransferModal, setShowTransferModal] = useState(false);"
);

code = code.replace(
  "onClick={() => alert('Appoint new HOS modal would open')}",
  "onClick={() => setShowHOSModal(true)}"
);

code = code.replace(
  "onClick={() => alert('Transfer Ownership workflow initiated')}",
  "onClick={() => setShowTransferModal(true)}"
);

code = code.replace(
  /onClick=\{\(\) => confirm[^}]+\}/,
  "onClick={() => { if(confirm('Are you absolutely sure you want to close this school? This action is irreversible.')) { showToast('School closed successfully.', 'success'); } }}"
);

code = code.replace(
  '<div className="card-compact border border-rose-500/20 bg-rose-500/5 space-y-6">',
  `<div className="card-compact border border-rose-500/20 bg-rose-500/5 space-y-6">
        {showHOSModal && <div className="p-4 mb-4 bg-white/10 rounded-xl border border-white/20"><h4 className="text-white font-bold mb-2">Select New Head of School</h4><select className="w-full bg-black/50 border border-white/10 text-white rounded p-2 mb-2"><option>Mr. A (Current Teacher)</option><option>Mrs. B (Vice Principal)</option></select><div className="flex gap-2"><button onClick={() => { showToast('New HOS appointed successfully.', 'success'); setShowHOSModal(false); }} className="bg-emerald-600 px-3 py-1 rounded text-white text-xs">Confirm</button><button onClick={() => setShowHOSModal(false)} className="px-3 py-1 text-white text-xs">Cancel</button></div></div>}
        {showTransferModal && <div className="p-4 mb-4 bg-orange-500/10 rounded-xl border border-orange-500/20"><h4 className="text-white font-bold mb-2">Transfer Ownership</h4><input placeholder="Enter new owner email" className="w-full bg-black/50 border border-white/10 text-white rounded p-2 mb-2" /><div className="flex gap-2"><button onClick={() => { showToast('Ownership transfer initiated. Verification email sent.', 'success'); setShowTransferModal(false); }} className="bg-orange-600 px-3 py-1 rounded text-white text-xs">Send Transfer Request</button><button onClick={() => setShowTransferModal(false)} className="px-3 py-1 text-white text-xs">Cancel</button></div></div>}`
);

fs.writeFileSync('packages/web/src/pages/Settings.tsx', code);
