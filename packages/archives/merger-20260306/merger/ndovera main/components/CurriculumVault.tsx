
import React, { useState } from 'react';
import { 
    BookOpen, Search, Filter, ShieldCheck, Download, 
    Plus, Sparkles, Folder, FileText, CheckCircle,
    ArrowRight, Loader2, RefreshCw, Layers
} from 'lucide-react';
import { CurriculumResource, SchoolSection, UserRole } from '../types';

const MOCK_RESOURCES: CurriculumResource[] = [
    { id: '1', title: 'Quantitative Reasoning Module 1', subject: 'Mathematics', section: SchoolSection.JSS, type: 'LESSON_PLAN', isVerified: true, author: 'Mrs. Florence', term: 1 },
    { id: '2', title: 'African Literature Overview', subject: 'English', section: SchoolSection.SSS, type: 'SLIDES', isVerified: true, author: 'Mr. Ibeke', term: 1 },
    { id: '3', title: 'Physics WAEC Past Questions', subject: 'Science', section: SchoolSection.SSS, type: 'EXAM_PREP', isVerified: false, author: 'Mr. Michael', term: 2 },
];

export const CurriculumVault: React.FC<{ role: UserRole }> = ({ role }) => {
    const [view, setView] = useState<'VAULT' | 'UPLOAD'>('VAULT');
    const [resources] = useState<CurriculumResource[]>(MOCK_RESOURCES);
    const [isSyncing, setIsSyncing] = useState(false);

    const isStaff = role === UserRole.TEACHER || role === UserRole.SCHOOL_ADMIN || role === UserRole.SCHOOL_OWNER;

    const handleSyncWithNova = () => {
        setIsSyncing(true);
        setTimeout(() => {
            setIsSyncing(false);
            alert("Curriculum Data Synchronized with Professor Nova. AI Tutors are now updated with current term lessons.");
        }, 2000);
    };

    return (
        <div className="space-y-8 animate-fade-in pb-20">
            <div className="bg-indigo-600 p-12 rounded-[4rem] text-white shadow-3xl relative overflow-hidden border-b-8 border-amber-400">
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-10">
                    <div>
                        <h2 className="text-5xl font-black italic tracking-tighter uppercase leading-none">Curriculum Vault</h2>
                        <p className="text-indigo-200 font-bold uppercase text-[10px] tracking-widest mt-4 italic">Standardized Knowledge Grid & Resource Repository</p>
                    </div>
                    {isStaff && (
                        <div className="flex gap-4">
                            <button onClick={handleSyncWithNova} disabled={isSyncing} className="bg-white text-indigo-600 px-8 py-4 rounded-3xl font-black text-xs uppercase tracking-widest shadow-xl flex items-center gap-2 hover:scale-105 transition-all">
                                {isSyncing ? <RefreshCw className="animate-spin w-4 h-4"/> : <Sparkles className="w-4 h-4 text-amber-500"/>}
                                Sync Nova AI
                            </button>
                            <button className="bg-slate-900 text-white px-8 py-4 rounded-3xl font-black text-xs uppercase tracking-widest shadow-xl flex items-center gap-2 hover:bg-black transition-all">
                                <Plus className="w-4 h-4"/> Upload Asset
                            </button>
                        </div>
                    )}
                </div>
                <Layers className="absolute right-[-20px] bottom-[-20px] w-80 h-80 opacity-5 rotate-12"/>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                <div className="lg:col-span-3 space-y-8">
                    <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center justify-between">
                        <div className="relative flex-1">
                            <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300"/>
                            <input placeholder="Find lesson plans, slides..." className="w-full bg-slate-50 p-5 pl-16 rounded-2xl outline-none border border-slate-50 font-bold" />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {resources.map(res => (
                            <div key={res.id} className="bg-white p-8 rounded-[3.5rem] border border-slate-100 shadow-xl group hover:shadow-2xl transition-all space-y-6">
                                <div className="flex justify-between items-start">
                                    <div className="w-16 h-16 bg-indigo-50 rounded-3xl flex items-center justify-center text-indigo-600 shadow-inner group-hover:scale-110 transition-transform">
                                        {res.type === 'SLIDES' ? <Folder className="w-8 h-8"/> : <FileText className="w-8 h-8"/>}
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <span className="text-[9px] font-black uppercase text-indigo-400 tracking-[0.2em]">{res.type}</span>
                                        {res.isVerified && (
                                            <span className="flex items-center gap-1 text-[8px] font-black uppercase text-emerald-500 mt-1">
                                                <CheckCircle className="w-3 h-3"/> HOS Verified
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{res.subject} • Term {res.term}</p>
                                    <h4 className="text-2xl font-black text-slate-900 uppercase italic tracking-tighter leading-none mt-2">{res.title}</h4>
                                    <p className="text-xs font-medium italic text-slate-500 mt-4">Curated by {res.author}</p>
                                </div>
                                <div className="flex gap-2">
                                    <button className="flex-1 bg-slate-900 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl flex items-center justify-center gap-2"><Download className="w-4 h-4"/> Get PDF</button>
                                    <button className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl hover:bg-indigo-100"><ArrowRight className="w-5 h-5"/></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="space-y-8">
                    <div className="bg-slate-900 p-10 rounded-[3rem] text-white shadow-3xl space-y-8">
                        <h4 className="text-xl font-black italic tracking-tighter uppercase mb-6 flex items-center gap-3">Vault Stats</h4>
                        <div className="space-y-6">
                            <div className="flex justify-between items-end border-b border-white/10 pb-4">
                                <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Digital Assets</span>
                                <span className="text-3xl font-black italic text-indigo-400">128</span>
                            </div>
                            <div className="flex justify-between items-end border-b border-white/10 pb-4">
                                <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Verified Modules</span>
                                <span className="text-3xl font-black italic text-emerald-400">92%</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
