import React from 'react';
import { ShieldCheck, Search, Filter, Calendar, User } from 'lucide-react';

const mockAuditLogs = [
  { id: 'log_01', user: 'AmiMaster (Dr. Ndobera)', action: 'UPDATE_PRICING', target: 'Professional Tier', ip: '102.89.47.21', date: '2026-02-26 22:30:15' },
  { id: 'log_02', user: 'AmiOperator (Jane Doe)', action: 'SUSPEND_SCHOOL', target: 'Riverdale Preparatory', ip: '198.51.100.2', date: '2026-02-26 18:45:00' },
  { id: 'log_03', user: 'GATEKEEPER_SERVICE', action: 'MFA_SUCCESS', target: 'AmiMaster (Dr. Ndobera)', ip: '102.89.47.21', date: '2026-02-26 09:05:11' },
  { id: 'log_04', user: 'AmiMaster (Dr. Ndobera)', action: 'CREATE_BLUEPRINT', target: 'International Blueprint', ip: '102.89.47.21', date: '2026-02-25 14:20:30' },
  { id: 'log_05', user: 'VAULT_SERVICE', action: 'DB_BACKUP_SUCCESS', target: 'vaultDB', ip: 'INTERNAL', date: '2026-02-25 03:00:00' },
];

const ActionPill = ({ action }) => {
    const styles = {
        'UPDATE': 'bg-blue-500/10 text-blue-400',
        'CREATE': 'bg-emerald-500/10 text-emerald-400',
        'DELETE': 'bg-rose-500/10 text-rose-400',
        'SUSPEND': 'bg-amber-500/10 text-amber-400',
        'MFA': 'bg-indigo-500/10 text-indigo-400',
        'DB': 'bg-slate-500/10 text-slate-400',
    };
    const actionType = action.split('_')[0];
    return (
        <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${styles[actionType] || styles['DB']}`}>
            {action.replace('_', ' ')}
        </span>
    );
};

export default function Sentinel() {
  return (
    <div>
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-slate-100">Sentinel / Audit & Governance</h1>
        <p className="text-sm text-slate-400">Immutable, detailed records of all significant actions on the platform.</p>
      </header>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-lg">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-4">
                <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input 
                        type="text"
                        placeholder="Search logs..."
                        className="pl-10 pr-4 py-2 bg-slate-800 border-none rounded-lg text-sm w-64 focus:ring-2 focus:ring-emerald-500 transition-all text-slate-200"
                    />
                </div>
                <button className="flex items-center gap-2 px-3 py-2 bg-slate-800 rounded-lg text-sm text-slate-300 hover:bg-slate-700">
                    <Filter className="w-4 h-4" />
                    Filter
                </button>
                <button className="flex items-center gap-2 px-3 py-2 bg-slate-800 rounded-lg text-sm text-slate-300 hover:bg-slate-700">
                    <Calendar className="w-4 h-4" />
                    Date Range
                </button>
                <button className="flex items-center gap-2 px-3 py-2 bg-slate-800 rounded-lg text-sm text-slate-300 hover:bg-slate-700">
                    <User className="w-4 h-4" />
                    User Role
                </button>
            </div>
        </div>
        <table className="w-full">
          <thead className="border-b border-slate-800">
            <tr>
              <th className="p-4 text-left text-xs font-bold uppercase tracking-wider text-slate-400">Timestamp</th>
              <th className="p-4 text-left text-xs font-bold uppercase tracking-wider text-slate-400">User / Service</th>
              <th className="p-4 text-left text-xs font-bold uppercase tracking-wider text-slate-400">Action</th>
              <th className="p-4 text-left text-xs font-bold uppercase tracking-wider text-slate-400">Target</th>
              <th className="p-4 text-left text-xs font-bold uppercase tracking-wider text-slate-400">IP Address</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {mockAuditLogs.map(log => (
              <tr key={log.id}>
                <td className="p-4 text-sm font-mono text-slate-400">{log.date}</td>
                <td className="p-4 text-sm font-medium text-slate-200">{log.user}</td>
                <td className="p-4"><ActionPill action={log.action} /></td>
                <td className="p-4 text-sm text-slate-300">{log.target}</td>
                <td className="p-4 text-sm font-mono text-slate-500">{log.ip}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
