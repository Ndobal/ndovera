
import React, { useState } from 'react';
import { 
    Medal, Award, ShieldCheck, Plus, Search, 
    X, Save, Heart, Star, Target, Users,
    History, TrendingUp, AlertCircle, Trash2
} from 'lucide-react';
import { HonorRecord, UserRole } from '../types';

const MOCK_RECORDS: HonorRecord[] = [
    { id: '1', studentId: 's1', studentName: 'ADEYEMI David', trait: 'LEADERSHIP', type: 'MERIT', points: 50, reason: 'Organized the inter-class science debate with zero supervision.', issuerName: 'Mr. Ibeke', timestamp: '2024-11-20 10:00' },
    { id: '2', studentId: 's1', studentName: 'ADEYEMI David', trait: 'PUNCTUALITY', type: 'MERIT', points: 10, reason: 'First student in assembly for 5 consecutive days.', issuerName: 'Mrs. Florence', timestamp: '2024-11-22 07:45' },
];

export const HonorHallModule: React.FC<{ role: UserRole; onAwardLams?: (amt: number) => void }> = ({ role, onAwardLams }) => {
    const [view, setView] = useState<'DASHBOARD' | 'ISSUE'>('DASHBOARD');
    const [records, setRecords] = useState<HonorRecord[]>(MOCK_RECORDS);
    const [newRecord, setNewRecord] = useState<Partial<HonorRecord>>({ trait: 'KINDNESS', type: 'MERIT', points: 10 });
    const [searchQuery, setSearchQuery] = useState('');

    const isTeacher = role === UserRole.TEACHER || role === UserRole.SCHOOL_ADMIN || role === UserRole.SCHOOL_OWNER;

    const handleIssue = () => {
        if (!newRecord.studentName || !newRecord.reason) return;
        const record: HonorRecord = {
            ...newRecord,
            id: Date.now().toString(),
            timestamp: new Date().toLocaleString(),
            issuerName: 'Current User'
        } as HonorRecord;
        
        setRecords([record, ...records]);
        if (record.type === 'MERIT' && onAwardLams) onAwardLams(record.points);
        setView('DASHBOARD');
        setNewRecord({ trait: 'KINDNESS', type: 'MERIT', points: 10 });
    };

    return (
        <div className="space-y-8 animate-fade-in pb-20">
            {/* Header */}
            <div className="bg-slate-900 p-12 rounded-[4rem] text-white shadow-3xl relative overflow-hidden border-b-8 border-amber-400">
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-10">
                    <div>
                        <h2 className="text-5xl font-black italic tracking-tighter uppercase leading-none">The Honor Hall</h2>
                        <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-4 italic">Institutional Character & Behavioral Ledger</p>
                    </div>
                    {isTeacher && (
                        <button onClick={() => setView('ISSUE')} className="bg-amber-400 text-slate-900 px-8 py-4 rounded-3xl font-black text-xs uppercase tracking-widest shadow-xl flex items-center gap-2 hover:scale-105 transition-all">
                            <Medal className="w-4 h-4"/> Issue Merit Badge
                        </button>
                    )}
                </div>
                <Award className="absolute right-[-20px] bottom-[-20px] w-80 h-80 opacity-5 rotate-12"/>
            </div>

            {view === 'ISSUE' ? (
                <div className="max-w-3xl mx-auto bg-white p-12 rounded-[4rem] border border-slate-100 shadow-2xl space-y-10 animate-scale-in">
                    <div className="flex justify-between items-center">
                        <h3 className="text-3xl font-black italic tracking-tighter uppercase">Issue Honor Badge</h3>
                        <button onClick={() => setView('DASHBOARD')} className="p-3 text-slate-300 hover:text-red-500 transition-colors"><X className="w-8 h-8"/></button>
                    </div>

                    <div className="grid grid-cols-2 gap-8">
                        <div className="col-span-2">
                            <label className="text-[10px] font-black uppercase text-slate-400 block mb-2 tracking-widest px-2">Student Identity</label>
                            <input value={newRecord.studentName} onChange={e => setNewRecord({...newRecord, studentName: e.target.value})} placeholder="Full Legal Name" className="w-full bg-slate-50 p-6 rounded-[2rem] border border-slate-100 font-bold outline-none focus:ring-4 ring-amber-50" />
                        </div>
                        <div>
                            <label className="text-[10px] font-black uppercase text-slate-400 block mb-2 tracking-widest px-2">Trait Selection</label>
                            <select value={newRecord.trait} onChange={e => setNewRecord({...newRecord, trait: e.target.value as any})} className="w-full bg-slate-50 p-6 rounded-[2rem] border border-slate-100 font-black outline-none">
                                <option value="KINDNESS">Kindness</option>
                                <option value="LEADERSHIP">Leadership</option>
                                <option value="HONESTY">Honesty</option>
                                <option value="PUNCTUALITY">Punctuality</option>
                                <option value="DISCIPLINE">Discipline</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-black uppercase text-slate-400 block mb-2 tracking-widest px-2">Yield (Points)</label>
                            <input type="number" value={newRecord.points} onChange={e => setNewRecord({...newRecord, points: Number(e.target.value)})} className="w-full bg-slate-50 p-6 rounded-[2rem] border border-slate-100 font-black outline-none" />
                        </div>
                        <div className="col-span-2">
                            <label className="text-[10px] font-black uppercase text-slate-400 block mb-2 tracking-widest px-2">Situational Justification</label>
                            <textarea value={newRecord.reason} onChange={e => setNewRecord({...newRecord, reason: e.target.value})} placeholder="Describe the behavior being honored..." className="w-full bg-slate-50 p-6 rounded-[2rem] border border-slate-100 font-medium italic h-32 outline-none focus:ring-4 ring-amber-50" />
                        </div>
                    </div>

                    <button onClick={handleIssue} className="w-full bg-slate-900 text-white py-8 rounded-[2.5rem] font-black text-sm uppercase tracking-[0.2em] shadow-2xl hover:bg-black transition-all flex items-center justify-center gap-3">
                        <ShieldCheck className="w-6 h-6 text-amber-400"/> Authenticate & Award Points
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                    <div className="lg:col-span-2 space-y-8">
                        <div className="flex justify-between items-center px-4">
                            <h3 className="text-2xl font-black italic tracking-tighter uppercase">Recent Honors</h3>
                            <div className="relative w-64">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300"/>
                                <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Find student..." className="w-full bg-white border border-slate-200 p-3 pl-10 rounded-xl outline-none font-bold text-xs" />
                            </div>
                        </div>
                        <div className="space-y-4">
                            {records.map(record => (
                                <div key={record.id} className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-xl group hover:shadow-2xl transition-all flex flex-col md:flex-row justify-between items-center gap-6">
                                    <div className="flex items-center gap-6">
                                        <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600 shadow-inner group-hover:scale-110 transition-transform">
                                            {record.trait === 'LEADERSHIP' ? <Target className="w-8 h-8"/> : <Heart className="w-8 h-8"/>}
                                        </div>
                                        <div>
                                            <h4 className="text-xl font-black text-slate-900 uppercase italic tracking-tighter">{record.studentName}</h4>
                                            <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mt-1">Badge: {record.trait}</p>
                                        </div>
                                    </div>
                                    <div className="flex-1 px-4 text-center md:text-left">
                                        <p className="text-sm text-slate-500 font-medium italic leading-relaxed">"{record.reason}"</p>
                                    </div>
                                    <div className="text-center md:text-right shrink-0">
                                        <p className="text-2xl font-black text-amber-600 italic tracking-tighter">+{record.points} Lams</p>
                                        <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest mt-1">Issued by {record.issuerName}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-8">
                        <div className="bg-slate-900 p-10 rounded-[3rem] text-white shadow-3xl relative overflow-hidden">
                            <h4 className="text-xl font-black italic tracking-tighter uppercase mb-8 flex items-center gap-3"><TrendingUp className="text-indigo-400 w-5 h-5"/> Honor Analytics</h4>
                            <div className="space-y-8 relative z-10">
                                <div className="flex justify-between items-end border-b border-white/10 pb-4">
                                    <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Total Merits Dispatched</span>
                                    <span className="text-4xl font-black italic text-amber-400">1,240</span>
                                </div>
                                <div className="space-y-4">
                                    <p className="text-[9px] font-black text-indigo-400 uppercase tracking-[0.2em]">Dominant Traits</p>
                                    <div className="space-y-3">
                                        {[
                                            { t: 'Kindness', v: 85 },
                                            { t: 'Punctuality', v: 72 },
                                            { t: 'Honesty', v: 94 }
                                        ].map(s => (
                                            <div key={s.t}>
                                                <div className="flex justify-between text-[10px] font-bold uppercase mb-1">
                                                    <span>{s.t}</span>
                                                    <span>{s.v}%</span>
                                                </div>
                                                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                                                    <div className="h-full bg-indigo-500" style={{ width: `${s.v}%` }}/>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-amber-50 p-10 rounded-[3rem] border border-amber-100 space-y-6">
                            <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center text-amber-600 shadow-xl border border-amber-100"><ShieldCheck className="w-8 h-8"/></div>
                            <h4 className="text-lg font-black uppercase text-slate-900 tracking-tight">Governance Rule</h4>
                            <p className="text-sm text-slate-600 leading-relaxed font-medium italic">"Every honor badge issued is cryptographically logged to prevent session manipulation and preserve the integrity of the school's reward economy."</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
