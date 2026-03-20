import React from 'react';
import { UserPlus, MoreVertical } from 'lucide-react';

const mockAmiUsers = [
  { id: 'ami_01', name: 'Dr. Ndobera', role: 'AmiMaster', status: 'Active', lastLogin: '2026-02-26 22:30:15' },
  { id: 'ami_02', name: 'Jane Doe', role: 'AmiOperator', status: 'Active', lastLogin: '2026-02-26 18:40:00' },
  { id: 'ami_03', name: 'John Smith', role: 'AmiObserver', status: 'Invited', lastLogin: 'Never' },
];

const RolePill = ({ role }) => {
    const styles = {
        'AmiMaster': 'bg-rose-500/10 text-rose-400',
        'AmiOperator': 'bg-indigo-500/10 text-indigo-400',
        'AmiObserver': 'bg-slate-500/10 text-slate-400',
    };
    return (
        <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${styles[role]}`}>
            {role}
        </span>
    );
};

export default function Cipher() {
  return (
    <div>
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Cipher / User Management</h1>
          <p className="text-sm text-slate-400">Manage all super admin users of the Ami panel.</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 transition-colors">
          <UserPlus className="w-4 h-4" />
          Invite New Admin
        </button>
      </header>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-lg">
        <table className="w-full">
          <thead className="border-b border-slate-800">
            <tr>
              <th className="p-4 text-left text-xs font-bold uppercase tracking-wider text-slate-400">User</th>
              <th className="p-4 text-left text-xs font-bold uppercase tracking-wider text-slate-400">Role</th>
              <th className="p-4 text-left text-xs font-bold uppercase tracking-wider text-slate-400">Status</th>
              <th className="p-4 text-left text-xs font-bold uppercase tracking-wider text-slate-400">Last Login</th>
              <th className="p-4 text-right text-xs font-bold uppercase tracking-wider text-slate-400">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {mockAmiUsers.map(user => (
              <tr key={user.id}>
                <td className="p-4 text-sm font-medium text-slate-200">{user.name}</td>
                <td className="p-4"><RolePill role={user.role} /></td>
                <td className="p-4 text-sm text-slate-300">{user.status}</td>
                <td className="p-4 text-sm font-mono text-slate-400">{user.lastLogin}</td>
                <td className="p-4 text-right">
                  <button className="p-2 rounded-md hover:bg-slate-800 text-slate-500">
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
