
import React, { useState, useEffect } from 'react';
import { 
    ResultSheet, SubjectScore, PsychomotorTrait, AffectiveTrait, 
    GradingConfig, ApprovalStatus, Scoresheet, UserRole 
} from '../types';
import { ResultTemplate } from './ResultTemplates';
import { 
    ChevronLeft, LayoutTemplate, Settings, UserCheck, 
    Activity, Lock, Send, Eye, Globe, 
    Loader2, Sparkles, Scale, Ruler, History, AlertTriangle
} from 'lucide-react';
import { sendMessageToNdove } from '../services/geminiService';

const DEFAULT_PSYCHOMOTOR: PsychomotorTrait[] = [
    { id: 'p1', label: 'Handwriting', rating: 3 },
    { id: 'p2', label: 'Fluency', rating: 3 },
    { id: 'p3', label: 'Games/Sports', rating: 3 },
];

const DEFAULT_AFFECTIVE: AffectiveTrait[] = [
    { id: 'a1', label: 'Punctuality', rating: 3 },
    { id: 'a2', label: 'Neatness', rating: 3 },
    { id: 'a3', label: 'Honesty', rating: 3 },
];

const DEFAULT_GRADING: GradingConfig[] = [
    { grade: 'A', min: 70, max: 120, remark: 'Distinction', color: 'green' },
    { grade: 'B', min: 60, max: 69, remark: 'Very Good', color: 'blue' },
    { grade: 'C', min: 50, max: 59, remark: 'Credit', color: 'yellow' },
    { grade: 'P', min: 40, max: 49, remark: 'Pass', color: 'orange' },
    { grade: 'F', min: 0, max: 39, remark: 'Fail', color: 'red' },
];

export const ResultManager: React.FC<{ 
    role: UserRole; 
    schoolLogo?: string;
    preloadedSheet?: Scoresheet | null;
    onBack?: () => void;
}> = ({ role, schoolLogo, preloadedSheet, onBack }) => {
    const [view, setView] = useState<'ENTRY' | 'PREVIEW'>('ENTRY');
    const [result, setResult] = useState<ResultSheet | null>(null);
    const [isGeneratingAI, setIsGeneratingAI] = useState(false);

    useEffect(() => {
        if (preloadedSheet) {
            setResult({
                id: `res_${preloadedSheet.studentId}`,
                studentId: preloadedSheet.studentId,
                studentName: preloadedSheet.studentName,
                admissionNumber: preloadedSheet.admissionNumber,
                class: preloadedSheet.class,
                session: preloadedSheet.session,
                term: preloadedSheet.term,
                attendance: 90,
                daysOpened: 100,
                startHeight: 120, endHeight: 124,
                startWeight: 35, endWeight: 38,
                scores: preloadedSheet.scores,
                psychomotor: [...DEFAULT_PSYCHOMOTOR],
                affective: [...DEFAULT_AFFECTIVE],
                teacherComment: '',
                headTeacherComment: '',
                principalComment: '',
                status: 'DRAFT',
                resultType: 'TEMPLATE'
            });
        }
    }, [preloadedSheet]);

    const handleAIGenerate = async () => {
        if (!result) return;
        setIsGeneratingAI(true);
        const prompt = `Write a short, professional behavioral comment for a student named ${result.studentName}. They are in ${result.class} and have shown good punctuality and academic focus. Keep it between 20-30 words.`;
        try {
            const comment = await sendMessageToNdove(prompt, []);
            setResult({ ...result, aiComment: comment });
        } catch (e) {
            console.error(e);
        } finally {
            setIsGeneratingAI(false);
        }
    };

    const advanceStatus = (action: 'SUBMIT' | 'APPROVE' | 'PUBLISH') => {
        if (!result) return;
        let newStatus = result.status;
        if (action === 'SUBMIT') newStatus = 'SUBMITTED';
        if (action === 'APPROVE') newStatus = 'APPROVED_HOS';
        if (action === 'PUBLISH') newStatus = 'PUBLISHED';
        setResult({ ...result, status: newStatus, publishedAt: action === 'PUBLISH' ? new Date().toISOString() : undefined });
        alert(`Status updated to ${newStatus}`);
    };

    if (!result) return <div className="p-20 text-center"><Loader2 className="animate-spin w-10 h-10 mx-auto text-slate-300"/></div>;

    const isLocked = result.status === 'PUBLISHED' || (role === UserRole.TEACHER && result.status !== 'DRAFT');

    return (
        <div className="space-y-10 animate-fade-in pb-20">
            <div className="flex justify-between items-center">
                <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-slate-900 font-black text-xs uppercase tracking-widest transition-colors"><ChevronLeft className="w-5 h-5"/> Back to Records</button>
                <div className="flex gap-4">
                    <button onClick={() => setView(view === 'ENTRY' ? 'PREVIEW' : 'ENTRY')} className="bg-slate-900 text-white px-8 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 shadow-xl hover:scale-105 transition-all">
                        {view === 'ENTRY' ? <Eye className="w-4 h-4"/> : <LayoutTemplate className="w-4 h-4"/>}
                        {view === 'ENTRY' ? 'Preview Result' : 'Edit Details'}
                    </button>
                    {!isLocked && (
                        <button onClick={() => advanceStatus(role === UserRole.TEACHER ? 'SUBMIT' : 'APPROVE')} className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 shadow-xl shadow-indigo-100 hover:scale-105 transition-all">
                            <Send className="w-4 h-4"/> {role === UserRole.TEACHER ? 'Submit for Review' : 'Approve Result'}
                        </button>
                    )}
                    {(role === UserRole.SCHOOL_ADMIN || role === UserRole.SCHOOL_OWNER) && result.status === 'APPROVED_HOS' && (
                        <button onClick={() => advanceStatus('PUBLISH')} className="bg-green-600 text-white px-8 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 shadow-xl shadow-green-100 hover:scale-105 transition-all">
                            <Globe className="w-4 h-4"/> Publish Result
                        </button>
                    )}
                </div>
            </div>

            {view === 'PREVIEW' ? (
                <div className="bg-white p-12 rounded-[4rem] shadow-2xl overflow-auto flex justify-center border border-slate-100">
                    <ResultTemplate data={result} grading={DEFAULT_GRADING} variant="classic" school={{ id: '1', name: 'Lagoon High', logo: schoolLogo || '' }} />
                </div>
            ) : (
                <div className="space-y-10">
                    {/* Growth Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                        <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-xl relative overflow-hidden">
                            <h3 className="text-xl font-black tracking-tight mb-8 flex items-center gap-3"><Ruler className="text-indigo-600"/> Physical Height (cm)</h3>
                            <div className="grid grid-cols-2 gap-6 relative z-10">
                                <div><label className="text-[10px] font-black uppercase text-slate-400 block mb-2 tracking-widest">Start of Term</label><input type="number" placeholder="120" value={result.startHeight} disabled={isLocked} onChange={e => setResult({...result, startHeight: Number(e.target.value)})} className="w-full bg-slate-50 p-5 rounded-2xl outline-none font-black focus:ring-2 ring-indigo-500"/></div>
                                <div><label className="text-[10px] font-black uppercase text-slate-400 block mb-2 tracking-widest">End of Term</label><input type="number" placeholder="124" value={result.endHeight} disabled={isLocked} onChange={e => setResult({...result, endHeight: Number(e.target.value)})} className="w-full bg-slate-50 p-5 rounded-2xl outline-none font-black focus:ring-2 ring-indigo-500"/></div>
                            </div>
                        </div>
                        <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-xl relative overflow-hidden">
                            <h3 className="text-xl font-black tracking-tight mb-8 flex items-center gap-3"><Scale className="text-indigo-600"/> Body Weight (kg)</h3>
                            <div className="grid grid-cols-2 gap-6 relative z-10">
                                <div><label className="text-[10px] font-black uppercase text-slate-400 block mb-2 tracking-widest">Start of Term</label><input type="number" placeholder="35" value={result.startWeight} disabled={isLocked} onChange={e => setResult({...result, startWeight: Number(e.target.value)})} className="w-full bg-slate-50 p-5 rounded-2xl outline-none font-black focus:ring-2 ring-indigo-500"/></div>
                                <div><label className="text-[10px] font-black uppercase text-slate-400 block mb-2 tracking-widest">End of Term</label><input type="number" placeholder="38" value={result.endWeight} disabled={isLocked} onChange={e => setResult({...result, endWeight: Number(e.target.value)})} className="w-full bg-slate-50 p-5 rounded-2xl outline-none font-black focus:ring-2 ring-indigo-500"/></div>
                            </div>
                        </div>
                    </div>

                    {/* Behavioral Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                        <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-xl"><h3 className="text-xl font-black tracking-tight mb-8 flex items-center gap-3"><UserCheck className="text-amber-500"/> Affective Traits</h3><div className="space-y-4">{result.affective.map((t, i) => (<div key={t.id} className="flex justify-between items-center pb-4 border-b border-slate-50"><span className="text-xs font-bold text-slate-600">{t.label}</span><div className="flex gap-2">{[1,2,3,4,5].map(v => (<button key={v} disabled={isLocked} onClick={() => {const na = [...result.affective]; na[i].rating = v as any; setResult({...result, affective: na})}} className={`w-8 h-8 rounded-lg text-[10px] font-black transition-all ${t.rating === v ? 'bg-amber-500 text-white shadow-lg' : 'bg-slate-50 text-slate-400'}`}>{v}</button>))}</div></div>))}</div></div>
                        <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-xl"><h3 className="text-xl font-black tracking-tight mb-8 flex items-center gap-3"><Activity className="text-purple-500"/> Psychomotor Skills</h3><div className="space-y-4">{result.psychomotor.map((t, i) => (<div key={t.id} className="flex justify-between items-center pb-4 border-b border-slate-50"><span className="text-xs font-bold text-slate-600">{t.label}</span><div className="flex gap-2">{[1,2,3,4,5].map(v => (<button key={v} disabled={isLocked} onClick={() => {const np = [...result.psychomotor]; np[i].rating = v as any; setResult({...result, psychomotor: np})}} className={`w-8 h-8 rounded-lg text-[10px] font-black transition-all ${t.rating === v ? 'bg-purple-600 text-white shadow-lg' : 'bg-slate-50 text-slate-400'}`}>{v}</button>))}</div></div>))}</div></div>
                    </div>

                    {/* AI Remark Engine */}
                    <div className="bg-slate-900 rounded-[4rem] p-16 text-white relative overflow-hidden">
                        <div className="relative z-10 space-y-8">
                            <div className="flex justify-between items-center">
                                <div><h3 className="text-4xl font-black tracking-tighter">AI Behavioral Summary</h3><p className="text-indigo-300 font-bold uppercase text-[10px] tracking-widest mt-2">Personalized AI Evaluation</p></div>
                                <button onClick={handleAIGenerate} disabled={isGeneratingAI || isLocked} className="bg-white text-slate-900 px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-indigo-50 transition-all disabled:opacity-50">
                                    {isGeneratingAI ? <Loader2 className="animate-spin w-5 h-5"/> : <Sparkles className="w-5 h-5 text-indigo-600"/>}
                                    {result.aiComment ? 'Rewrite Summary' : 'Generate Summary'}
                                </button>
                            </div>
                            <div className="bg-white/10 p-8 rounded-[2rem] border border-white/10">
                                {result.aiComment ? (
                                    <textarea value={result.aiComment} onChange={e => setResult({...result, aiComment: e.target.value})} disabled={isLocked} className="w-full bg-transparent outline-none font-medium italic text-xl leading-relaxed resize-none h-32"/>
                                ) : (
                                    <p className="text-white/30 italic text-xl">The AI Summary Engine is ready. Click the button to analyze student behavior and generate a professional remark.</p>
                                )}
                            </div>
                        </div>
                        <Sparkles className="absolute right-[-60px] top-[-60px] w-96 h-96 opacity-10 rotate-12"/>
                    </div>
                </div>
            )}
        </div>
    );
};
