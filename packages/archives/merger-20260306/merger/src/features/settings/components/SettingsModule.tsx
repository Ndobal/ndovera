import React, { useState } from 'react';
import { Settings, Shield, Globe, Bell, Palette, Database, Smartphone, HelpCircle, ChevronRight, CheckCircle, AlertTriangle, History, Download, Zap, TrendingUp } from 'lucide-react';
import { UserRole, SystemConfig } from '../../../shared/types';

type SettingsTab = 'general' | 'security' | 'notifications' | 'appearance' | 'data' | 'audit' | 'mobile' | 'farming' | 'help';

export default function SettingsModule({ role, config, setConfig, auditLogs }: { role: UserRole; config: SystemConfig; setConfig: (c: SystemConfig) => void; auditLogs: any[] }) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');

  const tabs = [
    { id: 'general', label: 'General Configuration', icon: Settings, roles: Object.values(UserRole) },
    { id: 'security', label: 'Security & Permissions', icon: Shield, roles: [UserRole.PROPRIETOR, UserRole.HOS, UserRole.ICT_MANAGER] },
    { id: 'notifications', label: 'Notifications & SMS', icon: Bell, roles: [UserRole.PROPRIETOR, UserRole.HOS, UserRole.ICT_MANAGER] },
    { id: 'appearance', label: 'Theme & Appearance', icon: Palette, roles: Object.values(UserRole) },
    { id: 'data', label: 'Data & Backup', icon: Database, roles: [UserRole.PROPRIETOR, UserRole.ICT_MANAGER] },
    { id: 'audit', label: 'Audit Logs', icon: History, roles: [UserRole.PROPRIETOR, UserRole.HOS, UserRole.ICT_MANAGER] },
    { id: 'farming', label: 'Farming & Incentives', icon: Zap, roles: [UserRole.SUPER_ADMIN] },
    { id: 'mobile', label: 'Mobile App Settings', icon: Smartphone, roles: [UserRole.PROPRIETOR, UserRole.ICT_MANAGER] },
    { id: 'help', label: 'Help & Support', icon: HelpCircle, roles: Object.values(UserRole) },
  ];

  const filteredTabs = tabs.filter(t => t.roles.includes(role));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">System Settings</h2>
        <p className="text-slate-500">Manage school configuration, security, and digital presence.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-2">
          {filteredTabs.map((item) => (
            <button 
              key={item.id}
              onClick={() => setActiveTab(item.id as SettingsTab)}
              className={`w-full flex items-center justify-between p-4 rounded-xl transition-all border ${
                activeTab === item.id 
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200 border-emerald-600' 
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-800'
              }`}
            >
              <div className="flex items-center gap-3">
                <item.icon className="w-5 h-5" />
                <span className="font-semibold text-sm">{item.label}</span>
              </div>
              <ChevronRight className={`w-4 h-4 ${activeTab === item.id ? 'text-white/70' : 'text-slate-300'}`} />
            </button>
          ))}
        </div>

        <div className="lg:col-span-2 space-y-6">
          {activeTab === 'general' && (
            <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-6">General School Configuration</h3>
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">School Name</label>
                    <input type="text" defaultValue="NDOVERA International School" className="w-full p-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 dark:text-slate-200" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">Current Session</label>
                    <input type="text" defaultValue="2025/2026" className="w-full p-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 dark:text-slate-200" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">Current Term</label>
                    <select className="w-full p-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 dark:text-slate-200">
                      <option>First Term</option>
                      <option>Second Term</option>
                      <option>Third Term</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">School Email</label>
                    <input type="email" defaultValue="info@ndovera.edu.ng" className="w-full p-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 dark:text-slate-200" />
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
                  <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-4">Active Sections</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {['Secondary Section', 'Primary Section', 'Nursery Section'].map((section, i) => (
                      <label key={i} className="flex items-center gap-3 p-4 rounded-xl border border-slate-100 dark:border-slate-800 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <input type="checkbox" defaultChecked className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500" />
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{section}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
                  <button className="px-6 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl text-sm font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                    Discard Changes
                  </button>
                  <button className="px-6 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-colors">
                    Save Configuration
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-6">Security & Permissions</h3>
              <div className="space-y-6">
                <div className="p-4 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl border border-emerald-100 dark:border-emerald-500/20 flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-emerald-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-emerald-900 dark:text-emerald-400">Two-Factor Authentication Enforced</p>
                    <p className="text-xs text-emerald-700 dark:text-emerald-500/80">All administrative accounts are required to use 2FA for login.</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm">Role Permissions Matrix</h4>
                  <div className="space-y-2">
                    {['Proprietor', 'HOS', 'Principal', 'Bursar', 'Teacher'].map((role) => (
                      <div key={role} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{role}</span>
                        <button className="text-xs font-bold text-emerald-600 hover:underline">Manage Access</button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'data' && (
            <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-6">Data Management & Backups</h3>
              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                  <div>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Automatic Daily Backups</p>
                    <p className="text-xs text-slate-500">Last backup: Today at 03:00 AM</p>
                  </div>
                  <div className="w-10 h-5 bg-emerald-500 rounded-full relative"><div className="absolute right-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow-sm"></div></div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <button className="p-4 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-center">
                    <Database className="w-6 h-6 text-slate-400 mx-auto mb-2" />
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300">Download Full Export</p>
                  </button>
                  <button className="p-4 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-center">
                    <Smartphone className="w-6 h-6 text-slate-400 mx-auto mb-2" />
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300">Sync to Cloud</p>
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'farming' && role === UserRole.SUPER_ADMIN && (
            <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 rounded-lg">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Ndovera Platform: Farming Configuration</h3>
                  <p className="text-xs text-slate-500">Global settings for Aura generation and Educentive rates across all tenant schools.</p>
                </div>
              </div>

              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">Aura to Naira Rate (₦)</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">₦</span>
                      <input 
                        type="number" 
                        value={config.auraToNairaRate} 
                        onChange={(e) => setConfig({ ...config, auraToNairaRate: parseInt(e.target.value) || 0 })}
                        className="w-full pl-8 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-emerald-500 dark:text-slate-200" 
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 italic">Example: 1 Aura = ₦{config.auraToNairaRate}</p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">Auras Per Ad Impression</label>
                    <input 
                      type="number" 
                      value={config.auraPerImpression} 
                      onChange={(e) => setConfig({ ...config, auraPerImpression: parseInt(e.target.value) || 0 })}
                      className="w-full p-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-emerald-500 dark:text-slate-200" 
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">Daily User Cap (Auras)</label>
                    <input 
                      type="number" 
                      value={config.dailyAuraCapPerUser} 
                      onChange={(e) => setConfig({ ...config, dailyAuraCapPerUser: parseInt(e.target.value) || 0 })}
                      className="w-full p-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-emerald-500 dark:text-slate-200" 
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">Global Daily Cap (Auras)</label>
                    <input 
                      type="number" 
                      value={config.globalDailyAuraCap} 
                      onChange={(e) => setConfig({ ...config, globalDailyAuraCap: parseInt(e.target.value) || 0 })}
                      className="w-full p-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-emerald-500 dark:text-slate-200" 
                    />
                  </div>
                </div>

                <div className="p-4 bg-amber-50 dark:bg-amber-500/10 rounded-xl border border-amber-100 dark:border-amber-500/20 flex items-start gap-3">
                  <TrendingUp className="w-5 h-5 text-amber-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-amber-900 dark:text-amber-400">Current Payout Potential</p>
                    <p className="text-xs text-amber-700 dark:text-amber-500/80">Based on your settings, a user hitting their daily cap earns ₦{(config.dailyAuraCapPerUser * config.auraToNairaRate).toLocaleString()} Educentive per day.</p>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                  <button className="px-8 py-3 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition-all">
                    Update Farming Policy
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'audit' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">System Audit Logs</h3>
                <button className="text-emerald-600 text-xs font-bold hover:underline flex items-center gap-1">
                  <Download className="w-3 h-3" />
                  Export Logs
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-4">User</th>
                      <th className="px-6 py-4">Action</th>
                      <th className="px-6 py-4">Target</th>
                      <th className="px-6 py-4">Date & Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                        <td className="px-6 py-4">
                          <p className="font-semibold text-slate-800 dark:text-slate-200">{log.user}</p>
                          <p className="text-[10px] text-slate-400">{log.ip}</p>
                        </td>
                        <td className="px-6 py-4 font-medium text-slate-700 dark:text-slate-300">{log.action}</td>
                        <td className="px-6 py-4 text-slate-500">{log.target}</td>
                        <td className="px-6 py-4 text-slate-400">{log.date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {role === UserRole.PROPRIETOR && (
            <div className="bg-rose-50 dark:bg-rose-500/10 p-6 rounded-2xl border border-rose-100 dark:border-rose-500/20">
              <div className="flex items-start gap-4">
                <div className="p-2 bg-rose-100 dark:bg-rose-500/20 text-rose-600 rounded-lg">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-rose-900 dark:text-rose-400 mb-1">Danger Zone</h4>
                  <p className="text-sm text-rose-700 dark:text-rose-500/80 mb-4">Actions here are permanent and can affect the entire school system. Only the Proprietor has access to these functions.</p>
                  <div className="flex gap-3">
                    <button className="px-4 py-2 bg-rose-600 text-white rounded-lg text-xs font-bold hover:bg-rose-700 transition-colors">
                      Close School Session
                    </button>
                    <button className="px-4 py-2 bg-white dark:bg-slate-900 text-rose-600 border border-rose-200 dark:border-rose-800 rounded-lg text-xs font-bold hover:bg-rose-50 dark:hover:bg-rose-800 transition-colors">
                      Reset System Data
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
