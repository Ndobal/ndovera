
import React, { useState } from 'react';
import { Bed, Plus, Search, Users, Layout, MapPin, X, Save, ShieldCheck, Home } from 'lucide-react';
import { Hostel, Student, UserRole } from '../types';

const MOCK_STUDENTS: Student[] = [
    { id: 'stu1', name: 'ADEYEMI David', adNo: 'ADM/001', section: 'PRIMARY' as any, isProfileInitialized: true, globalId: 'G1' },
    { id: 'stu2', name: 'NWOSU Emeka', adNo: 'ADM/002', section: 'SSS' as any, isProfileInitialized: true, globalId: 'G2' },
];

export const HostelModule: React.FC<{ role: UserRole }> = ({ role }) => {
    const [view, setView] = useState<'DASHBOARD' | 'ASSIGN'>('DASHBOARD');
    const [search, setSearch] = useState('');
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
    const [hostels, setHostels] = useState<Hostel[]>([
        { 
            id: 'h1', 
            name: 'Welfare Hall (Boys)', 
            rooms: [
                { id: 'r101', number: '101', capacity: 4, occupants: ['stu1'], gender: 'MALE' },
                { id: 'r102', number: '102', capacity: 4, occupants: [], gender: 'MALE' }
            ]
        }
    ]);
    const [activeHostelId, setActiveHostelId] = useState(hostels[0].id);

    const handleAssign = (roomId: string) => {
        if (!selectedStudent) return;
        setHostels(prev => prev.map(h => ({
            ...h,
            rooms: h.rooms.map(r => r.id === roomId ? { ...r, occupants: [...r.occupants, selectedStudent.id] } : r)
        })));
        alert(`Assigned ${selectedStudent.name} to Room ${hostels.find(h => h.id === activeHostelId)?.rooms.find(r => r.id === roomId)?.number}`);
        setSelectedStudent(null);
        setView('DASHBOARD');
    };

    return (
        <div className="space-y-8 animate-fade-in pb-20">
            <div className="bg-indigo-900 p-10 rounded-[3rem] text-white shadow-xl relative overflow-hidden">
                <div className="relative z-10 flex justify-between items-center">
                    <div>
                        <h2 className="text-4xl font-black italic tracking-tighter uppercase leading-none text-indigo-300">Sanctuary Dormitories</h2>
                        <p className="text-indigo-100 font-bold uppercase text-[10px] tracking-widest mt-2 italic">Institutional Boarding & Logistics</p>
                    </div>
                    {role === UserRole.SCHOOL_OWNER && (
                        <button onClick={() => setView('ASSIGN')} className="bg-amber-400 text-slate-900 px-8 py-4 rounded-3xl font-black text-xs uppercase tracking-widest shadow-xl flex items-center gap-2 hover:scale-105 transition-all">
                            <Plus className="w-4 h-4"/> Assign Student
                        </button>
                    )}
                </div>
                <Home className="absolute right-[-20px] bottom-[-20px] w-64 h-64 opacity-5 rotate-12"/>
            </div>

            {view === 'ASSIGN' ? (
                <div className="bg-white p-10 rounded-[4rem] border border-slate-100 shadow-2xl animate-scale-in">
                    <div className="flex justify-between items-center mb-10">
                        <h3 className="text-2xl font-black italic uppercase tracking-tighter text-slate-900">Room Allocation Engine</h3>
                        <button onClick={() => setView('DASHBOARD')} className="p-3 text-slate-300 hover:text-indigo-600 transition-colors"><X className="w-8 h-8"/></button>
                    </div>

                    <div className="space-y-8">
                        <div className="max-w-xl">
                            <label className="text-[10px] font-black uppercase text-slate-400 block mb-2 tracking-widest">Identify Student</label>
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300"/>
                                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Name or Admission No." className="w-full bg-slate-50 p-5 pl-12 rounded-2xl border border-slate-100 font-bold outline-none"/>
                                {search && (
                                    <div className="absolute top-full left-0 w-full bg-white border border-slate-100 rounded-2xl mt-2 shadow-2xl z-50 overflow-hidden">
                                        {MOCK_STUDENTS.filter(s => s.name.toLowerCase().includes(search.toLowerCase())).map(s => (
                                            <button key={s.id} onClick={() => {setSelectedStudent(s); setSearch('');}} className="w-full text-left p-4 hover:bg-indigo-50 font-bold text-sm border-b border-slate-50 last:border-none">
                                                {s.name} <span className="text-[10px] text-slate-400 ml-2">{s.adNo}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {selectedStudent && (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-scale-in">
                                {hostels.find(h => h.id === activeHostelId)?.rooms.map(room => (
                                    <div key={room.id} className={`p-8 rounded-[3rem] border transition-all ${room.occupants.length >= room.capacity ? 'bg-slate-50 border-slate-200 opacity-50' : 'bg-white border-indigo-100 shadow-xl hover:shadow-2xl'}`}>
                                        <div className="flex justify-between items-start mb-6">
                                            <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600"><Bed className="w-6 h-6"/></div>
                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Room {room.number}</span>
                                        </div>
                                        <p className="text-2xl font-black text-slate-900 tracking-tighter mb-2">{room.occupants.length} / {room.capacity}</p>
                                        <p className="text-[9px] font-black uppercase text-indigo-400 tracking-widest">Beds Available</p>
                                        
                                        {room.occupants.length < room.capacity && (
                                            <button onClick={() => handleAssign(room.id)} className="w-full mt-6 bg-indigo-600 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-indigo-100 hover:scale-105 transition-all">Assign to Bed</button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                    {hostels.find(h => h.id === activeHostelId)?.rooms.map(room => (
                        <div key={room.id} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all group">
                            <div className="flex justify-between items-center mb-6">
                                <h4 className="text-2xl font-black text-slate-900 tracking-tighter">R{room.number}</h4>
                                <Bed className="text-slate-200 group-hover:text-indigo-600 transition-colors w-6 h-6"/>
                            </div>
                            <div className="space-y-3">
                                <div className="flex justify-between text-[9px] font-black uppercase text-slate-400 tracking-widest">
                                    <span>Occupancy</span>
                                    <span>{room.occupants.length} / {room.capacity}</span>
                                </div>
                                <div className="h-2 bg-slate-50 rounded-full overflow-hidden">
                                    <div className="h-full bg-indigo-600 transition-all duration-1000" style={{ width: `${(room.occupants.length / room.capacity) * 100}%` }}/>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
