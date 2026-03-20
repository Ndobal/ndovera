
import React, { useState } from 'react';
import { Trophy, Plus, Search, Users, Award, Palette, X, Save, ShieldCheck } from 'lucide-react';
import { House, Student, UserRole } from '../types';

const MOCK_UNASSIGNED: Student[] = [
    { id: 'stu3', name: 'BELLO Ibrahim', adNo: 'ADM/003', section: 'JSS' as any, isProfileInitialized: true, globalId: 'G3' },
    { id: 'stu4', name: 'CHUKWUMA Chioma', adNo: 'ADM/004', section: 'SSS' as any, isProfileInitialized: true, globalId: 'G4' },
];

export const SportsModule: React.FC<{ role: UserRole }> = ({ role }) => {
    const [view, setView] = useState<'DASHBOARD' | 'ALLOCATE'>('DASHBOARD');
    const [houses, setHouses] = useState<House[]>([
        { id: 'h1', name: 'Red House', color: '#ef4444', master: 'Mr. Okon', studentIds: ['stu1'] },
        { id: 'h2', name: 'Blue House', color: '#3b82f6', master: 'Mrs. Enenu', studentIds: ['stu2'] },
        { id: 'h3', name: 'Yellow House', color: '#eab308', master: 'Mr. Michael', studentIds: [] },
        { id: 'h4', name: 'Green House', color: '#22c55e', master: 'Miss. Anna', studentIds: [] }
    ]);
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

    const handleAllocate = (houseId: string) => {
        if (!selectedStudent) return;
        setHouses(prev => prev.map(h => h.id === houseId ? { ...h, studentIds: [...h.studentIds, selectedStudent.id] } : h));
        alert(`Allocated ${selectedStudent.name} to ${houses.find(h => h.id === houseId)?.name}`);
        setSelectedStudent(null);
    };

    return (
        <div className="space-y-8 animate-fade-in pb-20">
            <div className="bg-slate-900 p-10 rounded-[3rem] text-white shadow-xl relative overflow-hidden border-b-8 border-indigo-600">
                <div className="relative z-10 flex justify-between items-center">
                    <div>
                        <h2 className="text-4xl font-black italic tracking-tighter uppercase leading-none">Championship Hub</h2>
                        <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-2 italic">Institutional Athletics & House Governance</p>
                    </div>
                    {role === UserRole.SCHOOL_OWNER && (
                        <button onClick={() => setView('ALLOCATE')} className="bg-indigo-600 text-white px-8 py-4 rounded-3xl font-black text-xs uppercase tracking-widest shadow-xl flex items-center gap-2 hover:scale-105 transition-all">
                            <Plus className="w-4 h-4"/> House Allocation
                        </button>
                    )}
                </div>
                <Trophy className="absolute right-[-20px] bottom-[-20px] w-64 h-64 opacity-5 rotate-12"/>
            </div>

            {view === 'ALLOCATE' ? (
                <div className="bg-white p-10 rounded-[4rem] border border-slate-100 shadow-2xl animate-scale-in">
                    <div className="flex justify-between items-center mb-10">
                        <h3 className="text-2xl font-black italic uppercase tracking-tighter text-slate-900">Allocation Engine</h3>
                        <button onClick={() => setView('DASHBOARD')} className="p-3 text-slate-300 hover:text-red-500 transition-colors"><X className="w-8 h-8"/></button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                        <div className="space-y-6">
                            <h4 className="text-sm font-black uppercase text-slate-400 tracking-widest">Unassigned Pool</h4>
                            <div className="space-y-3">
                                {MOCK_UNASSIGNED.map(s => (
                                    <button 
                                        key={s.id} 
                                        onClick={() => setSelectedStudent(s)}
                                        className={`w-full p-6 rounded-[2rem] border-2 transition-all text-left group ${selectedStudent?.id === s.id ? 'bg-indigo-600 border-indigo-600 text-white shadow-xl' : 'bg-slate-50 border-slate-100 hover:border-indigo-200 text-slate-900'}`}
                                    >
                                        <p className="font-black text-lg italic tracking-tight">{s.name}</p>
                                        <p className={`text-[10px] font-bold uppercase ${selectedStudent?.id === s.id ? 'text-indigo-200' : 'text-slate-400'}`}>{s.adNo} • {s.section}</p>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="lg:col-span-2 space-y-6">
                            <h4 className="text-sm font-black uppercase text-slate-400 tracking-widest">Target House</h4>
                            {selectedStudent ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
                                    {houses.map(house => (
                                        <div key={house.id} className="p-8 rounded-[3rem] border border-slate-100 bg-white shadow-xl space-y-6">
                                            <div className="flex justify-between items-center">
                                                <div className="w-10 h-10 rounded-xl" style={{ backgroundColor: house.color }}/>
                                                <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{house.studentIds.length} Members</span>
                                            </div>
                                            <h5 className="text-3xl font-black italic tracking-tighter uppercase">{house.name}</h5>
                                            <button 
                                                onClick={() => handleAllocate(house.id)}
                                                className="w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest border-2 border-slate-900 hover:bg-slate-900 hover:text-white transition-all"
                                            >
                                                Assign Member
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="h-full flex items-center justify-center bg-slate-50 rounded-[3rem] border-4 border-dashed border-slate-100">
                                    <p className="text-slate-300 font-black italic uppercase tracking-widest">Select a student to allocate</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                    {houses.map(house => (
                        <div key={house.id} className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm hover:shadow-xl hover:translate-y-[-4px] transition-all group">
                            <div className="w-16 h-16 rounded-[1.75rem] flex items-center justify-center text-white shadow-xl mb-6" style={{ backgroundColor: house.color }}>
                                <Award className="w-8 h-8"/>
                            </div>
                            <h4 className="text-2xl font-black italic tracking-tighter uppercase text-slate-900">{house.name}</h4>
                            <div className="mt-6 flex justify-between items-end border-t border-slate-50 pt-4">
                                <div>
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Members</p>
                                    <p className="text-xl font-black text-slate-900">{house.studentIds.length}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">House Master</p>
                                    <p className="text-xs font-bold text-indigo-600">{house.master}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
