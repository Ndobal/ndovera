import React, { useState, useMemo } from 'react';
import { 
  Users, 
  UserPlus, 
  Search, 
  Filter, 
  MoreVertical,
  Mail,
  Phone,
  GraduationCap,
  Briefcase,
  QrCode,
  Lock,
  Unlock
} from 'lucide-react';
import { useData } from '../hooks/useData';
import { SmartIDManager } from '../features/management/components/SmartIDManager';

// Temporary handler for local mock updates
const toggleUserStatus = async (id: string, currentStatus: string, mutateData: any) => {
  const newStatus = currentStatus === 'active' ? 'locked' : 'active';
  if (!confirm(`Are you sure you want to mark this user as ${newStatus}?`)) return;

  try {
    const res = await fetch(`/api/users/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    if (!res.ok) throw new Error('Failed to update status');
    mutateData();
  } catch(e) {
    alert(e);
  }
};

export const ManagementView = ({ searchQuery }: { searchQuery?: string }) => {
  const [activeTab, setActiveTab] = useState<'students' | 'teachers' | 'parents' | 'id_cards'>('students');
  const { data: students, refetch: refetchStudents } = useData<any[]>('/api/students');
  const { data: teachers, refetch: refetchTeachers } = useData<any[]>('/api/teachers');
  const { data: parents, refetch: refetchParents } = useData<any[]>('/api/parents');

  const list = useMemo(() => {
    const data = activeTab === 'students' ? students : activeTab === 'parents' ? parents : teachers;
    if (!searchQuery) return data;
    return data?.filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [activeTab, students, teachers, searchQuery]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">Institutional Management</h2>
          <p className="text-zinc-500 text-xs">Manage your school's staff and student population.</p>
        </div>
        <button className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-colors shadow-lg shadow-emerald-900/20 flex items-center gap-2">
          <UserPlus size={16} /> Add {activeTab === 'students' ? 'Student' : 'Staff'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-4 border-b border-white/5">
        <button 
          onClick={() => setActiveTab('students')}
          className={`pb-3 text-xs font-bold uppercase tracking-wider transition-all relative ${
            activeTab === 'students' ? 'text-emerald-500' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Students ({students?.length || 0})
          {activeTab === 'students' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-emerald-500 rounded-full"></div>}
        </button>
        <button 
          onClick={() => setActiveTab('teachers')}
          className={`pb-3 text-xs font-bold uppercase tracking-wider transition-all relative ${
            activeTab === 'teachers' ? 'text-emerald-500' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Staff ({teachers?.length || 0})
          {activeTab === 'teachers' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-emerald-500 rounded-full"></div>}
        </button>
        <button
          onClick={() => setActiveTab('parents')}
          className={`pb-3 text-xs font-bold uppercase tracking-wider transition-all relative ${
            activeTab === 'parents' ? 'text-emerald-500' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Parents ({parents?.length || 0})
          {activeTab === 'parents' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-emerald-500 rounded-full"></div>}
        </button>
        <button 
          onClick={() => setActiveTab('id_cards')}
          className={`pb-3 text-xs font-bold uppercase tracking-wider transition-all relative ${
            activeTab === 'id_cards' ? 'text-purple-500' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <div className="flex items-center gap-2">
            <QrCode size={14} /> Smart IDs
          </div>
          {activeTab === 'id_cards' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-purple-500 rounded-full"></div>}
        </button>
      </div>

      {/* List Grid / Smart IDs */}
      {activeTab === 'id_cards' ? (
        <SmartIDManager />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {list?.map((item) => (
            <div key={item.id} className="card-compact group">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-emerald-600/10 border border-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-500 font-bold text-lg">
                    {item.name.charAt(0)}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-zinc-200">{item.name}</h4>
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                      {activeTab === 'students' ? item.admission_number : activeTab === 'parents' ? (item.children_count ? `${item.children_count} Children Linked` : 'Parent') : item.staff_id}
                    </p>
                  </div>
                </div>
                <button className="p-1.5 text-zinc-600 hover:text-white transition-colors">
                  <MoreVertical size={16} />
                </button>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                  <Mail size={12} /> {item.email}
                </div>
                <div className="flex items-center justify-between text-[10px] text-zinc-500">
                  <div className="flex items-center gap-2">
                    {activeTab === 'students' ? <GraduationCap size={12} /> : activeTab === 'parents' ? <Users size={12} /> : <Briefcase size={12} />}
                    {activeTab === 'students' ? (item.class_name || 'No Class') : activeTab === 'parents' ? (item.children_names || 'No children links') : (item.specialization || 'General')}
                  </div>
                  <button 
                    onClick={() => toggleUserStatus(item.id, item.status || 'active', activeTab === 'students' ? refetchStudents : activeTab === 'parents' ? refetchParents : refetchTeachers)}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded-full border ${
                      item.status === 'locked' 
                        ? 'bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500/20' 
                        : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20'
                    }`}
                  >
                    {item.status === 'locked' ? <><Lock size={10} /> Locked</> : <><Unlock size={10} /> Active</>}
                  </button>
                </div>
              </div>

              <div className="flex gap-2 pt-4 border-t border-white/5">
                <button className="flex-1 bg-white/5 hover:bg-white/10 text-zinc-300 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all">
                  View Profile
                </button>
                <button className="flex-1 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-500 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all">
                  Message
                </button>
              </div>
            </div>
          )) || <div className="col-span-full text-center py-12 text-zinc-600">No {activeTab} found.</div>}
        </div>
      )}
    </div>
  );
};
