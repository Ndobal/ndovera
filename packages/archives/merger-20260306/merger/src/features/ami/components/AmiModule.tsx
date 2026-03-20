import React, { useState, Suspense } from 'react';
import { Shield, University, Palette, Gem, BarChart2, GanttChartSquare, BrainCircuit, Server, UserCog, Lock } from 'lucide-react';

// Lazy-loaded modules
const Colony = React.lazy(() => import('./Colony'));
const Blueprint = React.lazy(() => import('./Blueprint'));
const AuricVault = React.lazy(() => import('./AuricVault'));
const Spectrometer = React.lazy(() => import('./Spectrometer'));
const Sentinel = React.lazy(() => import('./Sentinel'));
const Oracle = React.lazy(() => import('./Oracle'));
const PortalForge = React.lazy(() => import('./PortalForge'));
const Cipher = React.lazy(() => import('./Cipher'));
const Rampart = React.lazy(() => import('./Rampart'));

const amiModules = [
  { id: 'colony', label: 'Colony', icon: University, component: Colony },
  { id: 'blueprint', label: 'Blueprint', icon: Palette, component: Blueprint },
  { id: 'auric_vault', label: 'Auric Vault', icon: Gem, component: AuricVault },
  { id: 'spectrometer', label: 'Spectrometer', icon: BarChart2, component: Spectrometer },
  { id: 'sentinel', label: 'Sentinel', icon: GanttChartSquare, component: Sentinel },
  { id: 'oracle', label: 'Oracle', icon: BrainCircuit, component: Oracle },
  { id: 'portal_forge', label: 'Portal Forge', icon: Server, component: PortalForge },
  { id: 'cipher', label: 'Cipher', icon: UserCog, component: Cipher },
  { id: 'rampart', label: 'Rampart', icon: Lock, component: Rampart },
];

export default function AmiModule() {
  const [activeModule, setActiveModule] = useState('colony');

  const ActiveComponent = amiModules.find(m => m.id === activeModule)?.component;

  return (
    <div className="flex h-full bg-slate-950 text-slate-200">
      <aside className="w-64 bg-slate-900 p-4 flex flex-col border-r border-slate-800">
        <div className="flex items-center gap-3 mb-8 px-2">
          <Shield className="w-8 h-8 text-emerald-400" />
          <h1 className="text-xl font-bold tracking-tighter">Ami / Vault</h1>
        </div>
        <nav className="flex flex-col gap-2">
          {amiModules.map(module => (
            <button 
              key={module.id} 
              onClick={() => setActiveModule(module.id)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeModule === module.id ? 'bg-emerald-500/10 text-emerald-400' : 'hover:bg-slate-800'}`}>
              <module.icon className="w-4 h-4" />
              {module.label}
            </button>
          ))}
        </nav>
      </aside>
      <main className="flex-1 p-8 overflow-y-auto">
        <Suspense fallback={<div className="text-center p-16">Loading Module...</div>}>
          {ActiveComponent && <ActiveComponent />}
        </Suspense>
      </main>
    </div>
  );
}
