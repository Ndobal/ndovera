import React, { useState } from 'react';
import { Plus, MoreVertical, Search } from 'lucide-react';
import OnboardSchoolModal from './OnboardSchoolModal';

const mockSchools = [
  { id: 'sch_01', name: 'Greenwood International', hos: 'Dr. Evelyn Reed', initials: 'GWI', status: 'Active' },
  { id: 'sch_02', name: 'Northcrest Academy', hos: 'Mr. Samuel Chen', initials: 'NCA', status: 'Active' },
  { id: 'sch_03', name: 'Beacon Heights School', hos: 'Mrs. Aisha Khan', initials: 'BHS', status: 'Pending' },
  { id: 'sch_04', name: 'Riverdale Preparatory', hos: 'Mr. David Grant', initials: 'RDP', status: 'Suspended' },
];

const StatusPill = ({ status }) => {
  const styles = {
    'Active': 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
    'Pending': 'bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400',
    'Suspended': 'bg-rose-100 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400',
  };
  return (
    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${styles[status]}`}>
      {status}
    </span>
  );
};

export default function Colony() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div>
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Colony / Tenant Management</h1>
          <p className="text-sm text-slate-400">Onboard, manage, and oversee all schools on the Ndovera platform.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Onboard New School
        </button>
      </header>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-lg">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input 
                    type="text"
                    placeholder="Search schools..."
                    className="pl-10 pr-4 py-2 bg-slate-800 border-none rounded-lg text-sm w-64 focus:ring-2 focus:ring-emerald-500 transition-all text-slate-200"
                />
            </div>
        </div>
        <table className="w-full">
          <thead className="border-b border-slate-800">
            <tr>
              <th className="p-4 text-left text-xs font-bold uppercase tracking-wider text-slate-400">School Name</th>
              <th className="p-4 text-left text-xs font-bold uppercase tracking-wider text-slate-400">Head of School (HoS)</th>
              <th className="p-4 text-left text-xs font-bold uppercase tracking-wider text-slate-400">Initials</th>
              <th className="p-4 text-left text-xs font-bold uppercase tracking-wider text-slate-400">Status</th>
              <th className="p-4 text-right text-xs font-bold uppercase tracking-wider text-slate-400">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {mockSchools.map(school => (
              <tr key={school.id}>
                <td className="p-4 text-sm font-medium text-slate-200">{school.name}</td>
                <td className="p-4 text-sm text-slate-400">{school.hos}</td>
                <td className="p-4 text-sm font-mono text-emerald-400 bg-emerald-900/50">{school.initials}</td>
                <td className="p-4"><StatusPill status={school.status} /></td>
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
      <OnboardSchoolModal isOpen={isModalOpen} setIsOpen={setIsModalOpen} />
    </div>
  );
}
