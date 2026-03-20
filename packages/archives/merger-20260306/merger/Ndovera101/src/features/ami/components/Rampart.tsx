import React from 'react';
import { Shield, Lock, KeyRound, Wifi } from 'lucide-react';

export default function Rampart() {
  return (
    <div>
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-slate-100">Rampart / Security Settings</h1>
        <p className="text-sm text-slate-400">Configure and enforce platform-wide security policies.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Access Control */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h2 className="text-lg font-bold text-slate-100 mb-4 flex items-center gap-2"><Lock className="w-5 h-5 text-indigo-400" /> Access Control</h2>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-400">Session Timeout (minutes)</label>
              <input type="number" defaultValue="15" className="w-full mt-1 bg-slate-800 border-none rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 text-slate-200" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400">IP Whitelist</label>
              <textarea rows={3} defaultValue="102.89.47.0/24\n198.51.100.0/24" className="w-full mt-1 bg-slate-800 border-none rounded-lg text-sm font-mono focus:ring-2 focus:ring-emerald-500 text-slate-200"></textarea>
            </div>
          </div>
        </div>

        {/* MFA & API Security */}
        <div className="space-y-8">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <h2 className="text-lg font-bold text-slate-100 mb-4 flex items-center gap-2"><KeyRound className="w-5 h-5 text-rose-400" /> Multi-Factor Authentication (MFA)</h2>
                <div className="flex items-center justify-between">
                    <p className="text-sm text-slate-300">Enforce MFA for all Super Admins</p>
                    <div className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-bold">ENFORCED</div>
                </div>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <h2 className="text-lg font-bold text-slate-100 mb-4 flex items-center gap-2"><Wifi className="w-5 h-5 text-emerald-400" /> API Security</h2>
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-slate-300">Rate Limiting</p>
                        <div className="text-sm text-emerald-400 font-medium">Active</div>
                    </div>
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-slate-300">Token Encryption</p>
                        <div className="text-sm text-emerald-400 font-medium">AES-256</div>
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}
