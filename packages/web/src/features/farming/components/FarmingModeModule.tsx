import React, { useState, useMemo } from 'react';
import { Tractor, Sprout, Plus, MapPin, User, Wheat, Target, X } from 'lucide-react';
import { useData } from '../../../hooks/useData';
import api from '../../../services/api';

export default function FarmingModeModule({ role }: { role?: string }) {
  const { data: farms, refetch, loading } = useData<any[]>('/api/farms');
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState({ name: '', produce: '', plot_count: 1, manager_id: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Stats calculation
  const stats = useMemo(() => {
    if (!farms) return { totalFarms: 0, totalPlots: 0, topCrop: 'None' };
    const plots = farms.reduce((acc: number, farm: any) => acc + (farm.plot_count || 0), 0);
    
    const crops = farms.reduce((acc: any, farm: any) => {
      if (farm.produce) acc[farm.produce] = (acc[farm.produce] || 0) + 1;
      return acc;
    }, {});
    
    let topCrop = 'None';
    let max = 0;
    for (const [crop, count] of Object.entries(crops)) {
      if ((count as number) > max) { max = count as number; topCrop = crop; }
    }

    return { totalFarms: farms.length, totalPlots: plots, topCrop };
  }, [farms]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await api.createFarm(formData);
      setIsAdding(false);
      setFormData({ name: '', produce: '', plot_count: 1, manager_id: '' });
      refetch();
    } catch (err) {
      alert('Failed to create farm');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in zoom-in duration-200">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Tractor className="text-emerald-500" />
            School Enterprise Management
          </h2>
          <p className="text-zinc-400 text-sm mt-1">Manage agricultural projects, track crop yields, and monitor school farm plots.</p>
        </div>
        {!isAdding && (
          <button 
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-bold transition-all shadow-lg shadow-emerald-500/20"
          >
            <Plus size={16} /> New Farm Project
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#151619] border border-white/5 rounded-2xl p-5 flex flex-col gap-2 relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all"></div>
          <div className="flex items-center gap-2 text-emerald-400 font-bold uppercase tracking-wider text-xs mb-2">
            <Sprout size={16} /> Active Farms
          </div>
          <p className="text-3xl font-bold text-white">{loading ? '-' : stats.totalFarms}</p>
        </div>
        
        <div className="bg-[#151619] border border-white/5 rounded-2xl p-5 flex flex-col gap-2 relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all"></div>
          <div className="flex items-center gap-2 text-blue-400 font-bold uppercase tracking-wider text-xs mb-2">
            <Target size={16} /> Total Managed Plots
          </div>
          <p className="text-3xl font-bold text-white">{loading ? '-' : stats.totalPlots}</p>
        </div>

        <div className="bg-[#151619] border border-white/5 rounded-2xl p-5 flex flex-col gap-2 relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl group-hover:bg-amber-500/20 transition-all"></div>
          <div className="flex items-center gap-2 text-amber-400 font-bold uppercase tracking-wider text-xs mb-2">
            <Wheat size={16} /> Top Output Crop
          </div>
          <p className="text-3xl font-bold text-white">{loading ? '-' : stats.topCrop}</p>
        </div>
      </div>

      {isAdding && (
        <div className="bg-[#0a0b0d] border border-emerald-500/20 rounded-2xl p-6 shadow-xl shadow-emerald-900/10">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-white">Initialize Farm Project</h3>
            <button onClick={() => setIsAdding(false)} className="text-zinc-500 hover:text-white"><X size={20}/></button>
          </div>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-bold text-zinc-400 uppercase">Farm Name</label>
              <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} type="text" className="w-full bg-[#151619] border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500" placeholder="e.g. North Wing Poultry / Block A Cassava" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-zinc-400 uppercase">Target Produce</label>
              <input required value={formData.produce} onChange={e => setFormData({...formData, produce: e.target.value})} type="text" className="w-full bg-[#151619] border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500" placeholder="e.g. Maize, Poultry, Yam" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-zinc-400 uppercase">Plot Count</label>
              <input required min="1" value={formData.plot_count} onChange={e => setFormData({...formData, plot_count: parseInt(e.target.value) || 1})} type="number" className="w-full bg-[#151619] border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500" />
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-bold text-zinc-400 uppercase">Assigned Manager (Teacher/Prefect)</label>
              <input value={formData.manager_id} onChange={e => setFormData({...formData, manager_id: e.target.value})} type="text" className="w-full bg-[#151619] border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500" placeholder="Manager Name or ID..." />
            </div>
            <div className="md:col-span-2 flex justify-end gap-3 mt-2">
              <button type="button" onClick={() => setIsAdding(false)} className="px-4 py-2 text-sm font-bold text-zinc-400 hover:text-white">Cancel</button>
              <button disabled={isSubmitting} type="submit" className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-bold">
                {isSubmitting ? 'Initializing...' : 'Save Enterprise'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-[#0a0b0d] border border-white/5 rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-white/5 flex items-center justify-between">
          <h3 className="text-sm font-bold tracking-widest text-zinc-400 uppercase">Farm Directory</h3>
        </div>
        {loading ? (
          <div className="p-8 text-center text-zinc-500">Loading directory...</div>
        ) : !farms?.length ? (
          <div className="p-12 flex flex-col items-center text-center text-zinc-500">
            <Tractor size={48} className="mb-4 text-white/10" />
            <p>No agricultural projects found.</p>
            <p className="text-sm mt-1">Initialize your first school enterprise to start tracking.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 p-4 gap-4">
            {farms.map((farm: any) => (
              <div key={farm.id} className="bg-[#151619] rounded-xl border border-white/5 hover:border-emerald-500/30 transition-colors p-5 group flex flex-col">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center text-emerald-500">
                      <Sprout size={20} />
                    </div>
                    <div>
                      <h4 className="text-white font-bold text-sm">{farm.name}</h4>
                      <p className="text-xs text-zinc-500">{new Date(farm.created_at || Date.now()).toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-3 mt-auto pt-4 border-t border-white/5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-500 flex items-center gap-1"><Wheat size={12}/> Crop/Produce</span>
                    <span className="text-zinc-200 font-bold">{farm.produce || 'N/A'}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-500 flex items-center gap-1"><MapPin size={12}/> Yield Plots</span>
                    <span className="text-zinc-200 font-bold bg-white/5 px-2 py-0.5 rounded">{farm.plot_count || 0}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-500 flex items-center gap-1"><User size={12}/> Primary Exec</span>
                    <span className="text-emerald-400 font-bold">{farm.manager_id || 'System'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
