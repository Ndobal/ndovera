import React from 'react';
import { Globe, Server, ExternalLink, RefreshCw } from 'lucide-react';

const mockSchoolWebsites = [
  { id: 'web_01', school: 'Greenwood International', domain: 'gwi.ndovera.com', status: 'Live', lastDeployed: '2026-02-26 14:00' },
  { id: 'web_02', school: 'Northcrest Academy', domain: 'nca.ndovera.com', status: 'Live', lastDeployed: '2026-02-25 10:30' },
  { id: 'web_03', school: 'Beacon Heights School', domain: 'bhs.ndovera.com', status: 'Deploying', lastDeployed: '2026-02-26 22:45' },
];

const StatusPill = ({ status }) => {
    const styles = {
        'Live': 'bg-emerald-500/10 text-emerald-400',
        'Deploying': 'bg-blue-500/10 text-blue-400 animate-pulse',
    };
    return (
        <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${styles[status]}`}>
            {status}
        </span>
    );
};

export default function PortalForge() {
  return (
    <div>
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-slate-100">PortalForge / Deployment & Website</h1>
        <p className="text-sm text-slate-400">Manage platform deployments and all public-facing school websites.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Deployment Settings */}
        <div className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h2 className="text-lg font-bold text-slate-100 mb-4 flex items-center gap-2"><Server className="w-5 h-5 text-indigo-400" /> Deployment Settings</h2>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-400">Main Platform Domain</label>
              <input type="text" defaultValue="app.ndovera.com" className="w-full mt-1 bg-slate-800 border-none rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 text-slate-200" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400">CDN Provider</label>
              <input type="text" defaultValue="Cloudflare" readOnly className="w-full mt-1 bg-slate-800 border-none rounded-lg text-sm text-slate-400" />
            </div>
            <button className="w-full mt-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-sm font-bold text-white transition-colors">
              Update Settings
            </button>
          </div>
        </div>

        {/* School Websites */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h2 className="text-lg font-bold text-slate-100 mb-4 flex items-center gap-2"><Globe className="w-5 h-5 text-emerald-400" /> School Websites</h2>
          <table className="w-full">
            <thead className="border-b border-slate-800">
                <tr>
                    <th className="p-3 text-left text-xs font-bold uppercase tracking-wider text-slate-400">School</th>
                    <th className="p-3 text-left text-xs font-bold uppercase tracking-wider text-slate-400">Domain</th>
                    <th className="p-3 text-left text-xs font-bold uppercase tracking-wider text-slate-400">Status</th>
                    <th className="p-3 text-right text-xs font-bold uppercase tracking-wider text-slate-400">Actions</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
                {mockSchoolWebsites.map(site => (
                    <tr key={site.id}>
                        <td className="p-3 text-sm text-slate-200 font-medium">{site.school}</td>
                        <td className="p-3 text-sm text-slate-400 font-mono"><a href={`#`} className="hover:text-emerald-400">{site.domain} <ExternalLink className="w-3 h-3 inline-block" /></a></td>
                        <td className="p-3"><StatusPill status={site.status} /></td>
                        <td className="p-3 text-right">
                            <button className="p-2 rounded-md hover:bg-slate-800 text-slate-500">
                                <RefreshCw className="w-4 h-4" />
                            </button>
                        </td>
                    </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
