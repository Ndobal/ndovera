import React from 'react';
import { Server, Users, Shield, HardDrive, Wifi, Activity } from 'lucide-react';
import { Role } from '../types';

export const ICTManagement = ({ role }: { role: Role }) => {
  if (role !== 'HOS' && role !== 'Super Admin' && role !== 'ICT Admin' && role !== 'Owner' && role !== 'Tenant School Owner') {
    return <div className="text-white p-8">Access Denied. ICT Management is for administrators only.</div>;
  }
  
  return (
    <div className='space-y-6'>
      <div className='flex items-center gap-2'>
        <h2 className='text-xl font-bold text-white'><Server className='inline mr-2 text-cyan-500'/>ICT Management</h2>
      </div>
      <p className="text-zinc-400 text-sm">Monitor system health, manage user access, and handle technical support.</p>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
        <div className="card-compact border border-white/5 bg-linear-to-br from-cyan-900/20 to-black">
          <Activity className="text-cyan-500 mb-4" />
          <h3 className="text-white font-bold mb-2">System Health</h3>
          <p className="text-zinc-400 text-xs">All servers running normally at 99.9% uptime.</p>
        </div>
        <div className="card-compact border border-white/5 bg-linear-to-br from-purple-900/20 to-black">
          <Shield className="text-purple-500 mb-4" />
          <h3 className="text-white font-bold mb-2">Access Control</h3>
          <p className="text-zinc-400 text-xs">Manage user roles, API keys, and device restrictions.</p>
        </div>
        <div className="card-compact border border-white/5 bg-linear-to-br from-emerald-900/20 to-black">
          <Wifi className="text-emerald-500 mb-4" />
          <h3 className="text-white font-bold mb-2">Network Status</h3>
          <p className="text-zinc-400 text-xs">Campus WiFi functional. 200+ devices connected.</p>
        </div>
      </div>
    </div>
  );
};
