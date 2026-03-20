import React, { useState } from 'react';
import { 
  Cpu, 
  Plus, 
  Search, 
  Users, 
  Server, 
  ShieldCheck, 
  Activity, 
  Clock, 
  AlertCircle,
  Download,
  Filter,
  ChevronRight,
  Terminal,
  Settings
} from 'lucide-react';
import { Role } from '../types';
import { SchoolGuard } from '../components/SchoolGuard';

export const ICTView = ({ role }: { role: Role }) => {
  const isICTManager = role === 'ICT Manager' || role === 'School Admin' || role === 'Super Admin' || role === 'HOS';
  const [activeTab, setActiveTab] = useState<'status' | 'users' | 'tickets'>(isICTManager ? 'status' : 'tickets');

  if (role && ['Ami','Super Admin','Owner'].includes(role)) return <SchoolGuard role={role} />

  const stats = [
    { label: 'System Status', value: 'Online', icon: <Server size={16} />, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { label: 'Active Users', value: '1,240', icon: <Users size={16} />, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { label: 'Open Tickets', value: '4', icon: <AlertCircle size={16} />, color: 'text-orange-500', bg: 'bg-orange-500/10' },
    { label: 'Security Score', value: '98%', icon: <ShieldCheck size={16} />, color: 'text-purple-500', bg: 'bg-purple-500/10' },
  ];

  const systems = [
    { name: 'Student Portal', status: 'Operational', uptime: '99.9%', lastCheck: '2m ago' },
    { name: 'Teacher Portal', status: 'Operational', uptime: '99.8%', lastCheck: '5m ago' },
    { name: 'Finance System', status: 'Operational', uptime: '100%', lastCheck: '1m ago' },
    { name: 'Library System', status: 'Degraded', uptime: '95.2%', lastCheck: '10m ago' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">ICT Management</h2>
          <p className="text-zinc-500 text-xs">Monitor system health, manage user access, and handle technical support.</p>
        </div>
        <div className="flex gap-2">
          <button className="bg-white/5 border border-white/5 text-zinc-400 px-4 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider flex items-center gap-2 hover:bg-white/10 transition-all">
            <Terminal size={14} /> System Logs
          </button>
          {isICTManager && (
            <button className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-emerald-900/20">
              <Plus size={14} /> New User
            </button>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <div key={i} className="card-mini flex items-center gap-3">
            <div className={`w-8 h-8 ${stat.bg} ${stat.color} rounded-lg flex items-center justify-center`}>
              {stat.icon}
            </div>
            <div>
              <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">{stat.label}</p>
              <p className="text-base font-mono font-bold text-white">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-6 border-b border-white/5">
        {isICTManager && (
          <button 
            onClick={() => setActiveTab('status')}
            className={`pb-3 text-[10px] font-bold uppercase tracking-widest transition-all relative ${
              activeTab === 'status' ? 'text-emerald-500' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            System Status
            {activeTab === 'status' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-emerald-500 rounded-full"></div>}
          </button>
        )}
        {isICTManager && (
          <button 
            onClick={() => setActiveTab('users')}
            className={`pb-3 text-[10px] font-bold uppercase tracking-widest transition-all relative ${
              activeTab === 'users' ? 'text-emerald-500' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            User Management
            {activeTab === 'users' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-emerald-500 rounded-full"></div>}
          </button>
        )}
        <button 
          onClick={() => setActiveTab('tickets')}
          className={`pb-3 text-[10px] font-bold uppercase tracking-widest transition-all relative ${
            activeTab === 'tickets' ? 'text-emerald-500' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          {isICTManager ? 'Support Tickets' : 'My Support Tickets'}
          {activeTab === 'tickets' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-emerald-500 rounded-full"></div>}
        </button>
      </div>

      {/* Content */}
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
        {activeTab === 'status' && isICTManager && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {systems.map((sys) => (
              <div key={sys.name} className="card-compact group">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-emerald-500">
                      <Activity size={20} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-zinc-200">{sys.name}</h4>
                      <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Uptime: {sys.uptime}</p>
                    </div>
                  </div>
                  <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded ${
                    sys.status === 'Operational' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-orange-500/10 text-orange-400'
                  }`}>
                    {sys.status}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/5">
                  <p className="text-[10px] text-zinc-600 font-mono">Last Check: {sys.lastCheck}</p>
                  <button className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider hover:underline">
                    View Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
