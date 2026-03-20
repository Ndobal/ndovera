
import React, { useState } from 'react';
import { Stethoscope, Plus, Search, Activity, History, UserCheck, AlertCircle, Save, X, Clipboard } from 'lucide-react';
import { ClinicVisit, Student, UserRole } from '../types';

const MOCK_STUDENTS: Student[] = [
    { id: 'stu1', name: 'ADEYEMI David', adNo: 'ADM/001', section: 'PRIMARY' as any, isProfileInitialized: true, globalId: 'G1' },
    { id: 'stu2', name: 'OKORO Grace', adNo: 'ADM/002', section: 'JSS' as any, isProfileInitialized: true, globalId: 'G2' },
];

export const ClinicModule: React.FC<{ role: UserRole }> = ({ role }) => {
    const [view, setView] = useState<'DASHBOARD' | 'LOG'>('DASHBOARD');
    const [search, setSearch] = useState('');
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
    const [complaint, setComplaint] = useState('');
    const [treatment, setTreatment] = useState('');
    const [outcome, setOutcome] = useState<ClinicVisit['outcome']>('RETURNED_TO_CLASS');
    
    const [visits, setVisits] = useState<ClinicVisit[]>([
        { id: 'v1', studentId: 'stu1', studentName: 'ADEYEMI David', className: 'Primary 4', timestamp: '2024-11-20 09:15', complaint: 'Headache and fatigue', diagnosis: 'Mild Malaria', treatment: 'Paracetamol & Rest', outcome: 'RETURNED_TO_CLASS', recordedBy: 'Nurse Joy' }
    ]);

    const handleLogVisit = () => {
        if (!selectedStudent || !complaint) return;
        const newVisit: ClinicVisit = {
            id: Date.now().toString(),
            studentId: selectedStudent.id,
            studentName: selectedStudent.name,
            className: 'Class X',
            timestamp: new Date().toLocaleString(),
            complaint,
            treatment,
            outcome,
            recordedBy: 'Nurse User'
        };
        setVisits([newVisit, ...visits]);
        setView('DASHBOARD');
        setSelectedStudent(null);
        setComplaint('');
        setTreatment('');
    };

    return (
        <div className="space-y-8 animate-fade-in pb-20">
            <div className="bg-red-600 p-10 rounded-[3rem] text-white shadow-xl relative overflow-hidden">
                <div className="relative z-10 flex justify-between items-center">
                    <div>
                        <h2 className="text-4xl font-black italic tracking-tighter uppercase leading-none">Health Sanctuary</h2>
                        <p className="text-red-100 font-bold uppercase text-[10px] tracking-widest mt-2">Institutional Medical Registry</p>
                    </div>
                    {(role === UserRole.NURSE || role === UserRole.SCHOOL_OWNER) && (
                        <button onClick={() => setView('LOG')} className="bg-white text-red-600 px-8 py-4 rounded-3xl font-black text-xs uppercase tracking-widest shadow-xl flex items-center gap-2 hover:scale-105 transition-all">
                            <Plus className="w-4 h-4"/> Log New Visit
                        </button>
                    )}
                </div>
                <Stethoscope className="absolute right-[-20px] bottom-[-20px] w-64 h-64 opacity-10 rotate-12"/>
            </div>

            {view === 'LOG' ? (
                <div className="bg-white p-10 rounded-[4rem] border border-slate-100 shadow-2xl animate-scale-in">
                    <div className="flex justify-between items-center mb-10">
                        <h3 className="text-2xl font-black italic uppercase tracking-tighter text-slate-900">Medical Entry Form</h3>
                        <button onClick={() => setView('DASHBOARD')} className="p-3 text-slate-300 hover:text-red-500 transition-colors"><X className="w-8 h-8"/></button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                        <div className="space-y-6">
                            <div>
                                <label className="text-[10px] font-black uppercase text-slate-400 block mb-2 tracking-widest">Search Student</label>
                                <div className="relative">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300"/>
                                    <input 
                                        value={search} 
                                        onChange={e => setSearch(e.target.value)}
                                        placeholder="Name or Admission No." 
                                        className="w-full bg-slate-50 p-5 pl-12 rounded-2xl outline-none border border-slate-100 font-bold"
                                    />
                                    {search && (
                                        <div className="absolute top-full left-0 w-full bg-white border border-slate-100 rounded-2xl mt-2 shadow-2xl z-50 overflow-hidden">
                                            {MOCK_STUDENTS.filter(s => s.name.toLowerCase().includes(search.toLowerCase())).map(s => (
                                                <button key={s.id} onClick={() => {setSelectedStudent(s); setSearch('');}} className="w-full text-left p-4 hover:bg-red-50 font-bold text-sm border-b border-slate-50 last:border-none">
                                                    {s.name} <span className="text-[10px] text-slate-400 ml-2">{s.adNo}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                {selectedStudent && (
                                    <div className="mt-4 p-4 bg-red-50 rounded-2xl border border-red-100 flex justify-between items-center">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-red-600 shadow-sm font-black">{selectedStudent.name[0]}</div>
                                            <p className="font-black text-red-900">{selectedStudent.name}</p>
                                        </div>
                                        <button onClick={() => setSelectedStudent(null)} className="text-red-300 hover:text-red-600"><X className="w-5 h-5"/></button>
                                    </div>
                                )}
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase text-slate-400 block mb-2 tracking-widest">Primary Complaint</label>
                                <textarea value={complaint} onChange={e => setComplaint(e.target.value)} className="w-full bg-slate-50 p-5 rounded-2xl outline-none border border-slate-100 font-bold h-32 resize-none" placeholder="Describe symptoms..."/>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div>
                                <label className="text-[10px] font-black uppercase text-slate-400 block mb-2 tracking-widest">Treatment & Medication</label>
                                <textarea value={treatment} onChange={e => setTreatment(e.target.value)} className="w-full bg-slate-50 p-5 rounded-2xl outline-none border border-slate-100 font-bold h-32 resize-none" placeholder="Medical intervention given..."/>
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase text-slate-400 block mb-2 tracking-widest">Current Outcome</label>
                                <div className="grid grid-cols-2 gap-3">
                                    {[
                                        { id: 'RETURNED_TO_CLASS', label: 'Returned to Class' },
                                        { id: 'SENT_HOME', label: 'Sent Home' },
                                        { id: 'ADMITTED', label: 'Admitted' },
                                        { id: 'REFERRED', label: 'Referred' }
                                    ].map(o => (
                                        <button 
                                            key={o.id}
                                            onClick={() => setOutcome(o.id as any)}
                                            className={`p-4 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 transition-all ${outcome === o.id ? 'bg-red-600 border-red-600 text-white shadow-lg' : 'bg-slate-50 border-slate-100 text-slate-400 hover:border-red-200'}`}
                                        >
                                            {o.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <button onClick={handleLogVisit} className="w-full bg-slate-900 text-white py-6 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-2xl hover:bg-black transition-all flex items-center justify-center gap-3 mt-4">
                                <Save className="w-5 h-5"/> Finalize Record
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm">
                            <h3 className="text-xl font-black uppercase text-slate-900 tracking-tight mb-6">Recent Medical Encounters</h3>
                            <div className="space-y-4">
                                {visits.map(v => (
                                    <div key={v.id} className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 hover:bg-white hover:shadow-xl transition-all group">
                                        <div className="flex justify-between items-start">
                                            <div className="flex gap-4">
                                                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-red-600 shadow-sm"><Clipboard className="w-6 h-6"/></div>
                                                <div>
                                                    <h4 className="font-black text-slate-900 uppercase tracking-tight">{v.studentName}</h4>
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase">{v.className} • {v.timestamp}</p>
                                                </div>
                                            </div>
                                            <span className="px-3 py-1 bg-red-50 text-red-600 rounded-full text-[8px] font-black uppercase border border-red-100">{v.outcome.replace('_', ' ')}</span>
                                        </div>
                                        <div className="mt-4 pt-4 border-t border-slate-100">
                                            <p className="text-xs text-slate-500 font-medium italic">"{v.complaint}"</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-8">
                        <div className="bg-slate-900 p-8 rounded-[3rem] text-white space-y-8 shadow-2xl overflow-hidden relative">
                            <div className="relative z-10">
                                <div className="flex justify-between items-center mb-6">
                                    <h4 className="text-lg font-black italic tracking-tighter uppercase">Condition Pulse</h4>
                                    <Activity className="text-red-500 w-5 h-5 animate-pulse"/>
                                </div>
                                <div className="space-y-6">
                                    {[
                                        { l: 'Total Visits (Today)', v: '4' },
                                        { l: 'Common Case', v: 'Malaria' },
                                        { l: 'Admitted Students', v: '1' }
                                    ].map((s, i) => (
                                        <div key={i} className="flex justify-between items-end border-b border-white/10 pb-4">
                                            <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">{s.l}</span>
                                            <span className="text-2xl font-black italic">{s.v}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <History className="absolute right-[-20px] bottom-[-20px] w-48 h-48 opacity-5 rotate-12"/>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
