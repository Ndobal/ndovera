
import React, { useState } from 'react';
import { 
    Package, Search, Plus, Filter, 
    CheckCircle, AlertTriangle, Clock,
    User, Trash2, Save, X, History,
    ShieldCheck, Box, Activity
} from 'lucide-react';
import { SupplyItem, UserRole } from '../types';

const MOCK_ITEMS: SupplyItem[] = [
    { id: '1', name: 'Digital Projector ND-1', category: 'IT', status: 'AVAILABLE', lastCheckedAt: '2024-11-28 09:00' },
    { id: '2', name: 'Football (Set of 5)', category: 'SPORTS', status: 'IN_USE', currentHolder: 'Mr. Michael', returnDeadline: '2024-11-28 16:00', lastCheckedAt: '2024-11-28 10:30' },
    { id: '3', name: 'Microscope Elite-X', category: 'LAB', status: 'AVAILABLE', lastCheckedAt: '2024-11-27 14:00' },
];

export const SupplySanctuary: React.FC<{ role: UserRole }> = ({ role }) => {
    const [view, setView] = useState<'INVENTORY' | 'CHECKOUT'>('INVENTORY');
    const [items] = useState<SupplyItem[]>(MOCK_ITEMS);
    const [searchQuery, setSearchQuery] = useState('');

    return (
        <div className="space-y-8 animate-fade-in pb-20">
            <div className="bg-slate-900 p-12 rounded-[4rem] text-white shadow-3xl relative overflow-hidden border-b-8 border-indigo-600">
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-10">
                    <div>
                        <h2 className="text-5xl font-black italic tracking-tighter uppercase leading-none text-white">Supply Sanctuary</h2>
                        <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-4 italic">Institutional Asset Governance & Inventory Hub</p>
                    </div>
                    {role !== UserRole.STUDENT && (
                        <div className="flex gap-4">
                            <button className="bg-indigo-600 text-white px-8 py-4 rounded-3xl font-black text-xs uppercase tracking-widest shadow-xl flex items-center gap-2 hover:scale-105 transition-all">
                                <CheckCircle className="w-4 h-4"/> Asset Checkout
                            </button>
                        </div>
                    )}
                </div>
                <Box className="absolute right-[-20px] bottom-[-20px] w-80 h-80 opacity-5 rotate-12"/>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                <div className="lg:col-span-2 space-y-8">
                    <div className="flex justify-between items-center bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
                        <div className="relative flex-1">
                            <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300"/>
                            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search inventory..." className="w-full bg-slate-50 p-5 pl-16 rounded-2xl outline-none border border-slate-50 font-bold" />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {items.map(item => (
                            <div key={item.id} className="bg-white p-8 rounded-[3.5rem] border border-slate-100 shadow-xl group hover:shadow-2xl transition-all space-y-6">
                                <div className="flex justify-between items-start">
                                    <div className={`w-16 h-16 rounded-3xl flex items-center justify-center shadow-inner ${
                                        item.status === 'AVAILABLE' ? 'bg-indigo-50 text-indigo-600' : 'bg-amber-50 text-amber-600'
                                    }`}>
                                        <Package className="w-8 h-8"/>
                                    </div>
                                    <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase border ${
                                        item.status === 'AVAILABLE' ? 'bg-green-50 text-green-600 border-green-100' : 'bg-amber-50 text-amber-600 border-amber-100 animate-pulse'
                                    }`}>{item.status}</span>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.category} Sector</p>
                                    <h4 className="text-2xl font-black text-slate-900 uppercase italic tracking-tighter leading-none mt-2">{item.name}</h4>
                                    {item.currentHolder && (
                                        <p className="text-xs font-bold text-amber-600 uppercase mt-4 flex items-center gap-2">
                                            <User className="w-3 h-3"/> Held by: {item.currentHolder}
                                        </p>
                                    )}
                                </div>
                                <div className="p-6 bg-slate-50 rounded-3xl space-y-2">
                                    <div className="flex justify-between text-[9px] font-black uppercase text-slate-400">
                                        <span>Last Audit</span>
                                        <span>{item.lastCheckedAt}</span>
                                    </div>
                                    {item.returnDeadline && (
                                        <div className="flex justify-between text-[9px] font-black uppercase text-red-500">
                                            <span>Deadline</span>
                                            <span>Today 16:00</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="space-y-8">
                    <div className="bg-slate-900 p-10 rounded-[3rem] text-white space-y-12 shadow-3xl">
                        <div>
                            <h4 className="text-xl font-black italic tracking-tighter uppercase mb-8 flex items-center gap-3"><Activity className="text-indigo-400 w-5 h-5"/> Inventory Pulse</h4>
                            <div className="space-y-8">
                                <div className="flex justify-between items-end border-b border-white/10 pb-4">
                                    <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Total Assets</span>
                                    <span className="text-4xl font-black italic text-indigo-400">420</span>
                                </div>
                                <div className="flex justify-between items-end border-b border-white/10 pb-4">
                                    <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Currently Out</span>
                                    <span className="text-4xl font-black italic text-amber-400">12</span>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white/5 border border-white/10 p-8 rounded-[2.5rem] flex flex-col items-center text-center space-y-4">
                            <AlertTriangle className="w-8 h-8 text-amber-400" />
                            <p className="text-xs font-medium italic text-slate-400">"4:00 PM Protocol: Auto-alerts are dispatched to all staff for items not yet archived in the sanctuary store."</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
