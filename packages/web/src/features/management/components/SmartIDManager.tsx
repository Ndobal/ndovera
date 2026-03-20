import React, { useState } from 'react';
import { CreditCard, QrCode, Shield, Printer, AlertCircle } from 'lucide-react';
import { useData } from '../../../hooks/useData';

export const SmartIDManager = () => {
  const [activeSegment, setActiveSegment] = useState<'students' | 'teachers'>('students');
  const [selectedCards, setSelectedCards] = useState<Set<string>>(new Set());
  
  const { data: users } = useData<any[]>('/api/' + activeSegment);

  const toggleSelect = (id: string) => {
    const next = new Set(selectedCards);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedCards(next);
  };

  const handlePrint = () => {
    alert(`Sent ${selectedCards.size} ID cards to print queue.`);
  };

  const handleRevoke = () => {
    if (confirm(`Are you sure you want to revoke ${selectedCards.size} physical ID cards? They will be blocked at the security gates.`)) {
      alert("Revoked.");
      setSelectedCards(new Set());
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-[#151619] p-4 rounded-2xl border border-white/5 flex flex-col gap-1">
          <div className="flex items-center gap-2 text-emerald-500 mb-2"><CreditCard size={18} /> <span className="text-xs font-bold uppercase tracking-wider">Active Cards</span></div>
          <p className="text-2xl font-bold text-white">1,248</p>
        </div>
        <div className="bg-[#151619] p-4 rounded-2xl border border-white/5 flex flex-col gap-1">
          <div className="flex items-center gap-2 text-red-400 mb-2"><AlertCircle size={18} /> <span className="text-xs font-bold uppercase tracking-wider">Revoked Cards</span></div>
          <p className="text-2xl font-bold text-white">32</p>
        </div>
        <div className="bg-[#151619] p-4 rounded-2xl border border-white/5 flex flex-col gap-1">
          <div className="flex items-center gap-2 text-blue-400 mb-2"><Printer size={18} /> <span className="text-xs font-bold uppercase tracking-wider">Print Queue</span></div>
          <p className="text-2xl font-bold text-white">5</p>
        </div>
        <div className="bg-[#151619] p-4 rounded-2xl border border-white/5 flex flex-col gap-1">
          <div className="flex items-center gap-2 text-purple-400 mb-2"><QrCode size={18} /> <span className="text-xs font-bold uppercase tracking-wider">Gate Scans Today</span></div>
          <p className="text-2xl font-bold text-white">892</p>
        </div>
      </div>

      <div className="bg-[#0a0b0d] rounded-2xl border border-white/5 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-2">
            <button onClick={() => setActiveSegment('students')} className={`px-4 py-1.5 rounded-lg text-xs font-bold ${activeSegment === 'students' ? 'bg-emerald-600 text-white' : 'bg-white/5 text-zinc-400'}`}>Students</button>
            <button onClick={() => setActiveSegment('teachers')} className={`px-4 py-1.5 rounded-lg text-xs font-bold ${activeSegment === 'teachers' ? 'bg-emerald-600 text-white' : 'bg-white/5 text-zinc-400'}`}>Staff</button>
          </div>
          {selectedCards.size > 0 && (
            <div className="flex gap-2 animate-in fade-in zoom-in duration-200">
              <button onClick={handleRevoke} className="px-3 py-1.5 bg-red-500/10 text-red-500 text-xs font-bold uppercase rounded-lg border border-red-500/20 hover:bg-red-500/20"><Shield size={14} className="inline mr-1" /> Revoke Selected</button>
              <button onClick={handlePrint} className="px-3 py-1.5 bg-blue-500/10 text-blue-500 text-xs font-bold uppercase rounded-lg border border-blue-500/20 hover:bg-blue-500/20"><Printer size={14} className="inline mr-1" /> Batch Print ({selectedCards.size})</button>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-xs font-bold tracking-wider text-zinc-500 uppercase">
                <th className="py-3 px-4 w-10"><input type="checkbox" onChange={(e) => { e.target.checked && users ? setSelectedCards(new Set(users.map(u => u.id))) : setSelectedCards(new Set()) }} checked={selectedCards.size > 0 && selectedCards.size === (users?.length || -1)} /></th>
                <th className="py-3 px-4">Name</th>
                <th className="py-3 px-4">Identifier</th>
                <th className="py-3 px-4">ID Secret</th>
                <th className="py-3 px-4">Card Status</th>
                <th className="py-3 px-4 text-right">Gate Activity</th>
              </tr>
            </thead>
            <tbody>
              {users?.map(u => (
                <tr key={u.id} className="border-b border-white/5 text-sm cursor-pointer hover:bg-white/5" onClick={() => toggleSelect(u.id)}>
                  <td className="py-3 px-4"><input type="checkbox" checked={selectedCards.has(u.id)} readOnly /></td>
                  <td className="py-3 px-4 font-bold text-white flex items-center gap-3">
                    <img src={u.avatar || `https://placehold.co/100/102144/ffffff?text=${u.name?.[0] || '?'}`} className="w-8 h-8 rounded-full" />
                    {u.name}
                  </td>
                  <td className="py-3 px-4 text-zinc-400">{u.class_name || u.role || 'N/A'}</td>
                  <td className="py-3 px-4 font-mono text-zinc-500 text-xs">{btoa(u.id).substring(0, 8).toUpperCase()}</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Active</span>
                  </td>
                  <td className="py-3 px-4 text-right text-zinc-500 text-xs">
                    In: 07:15 AM
                  </td>
                </tr>
              ))}
              {!users?.length && <tr><td colSpan={6} className="text-center py-8 text-zinc-500 text-sm">No records found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};