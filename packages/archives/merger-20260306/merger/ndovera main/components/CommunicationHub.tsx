
import React, { useState } from 'react';
// Added History to lucide-react imports to avoid shadowed global History interface error
import { Send, Sparkles, AlertTriangle, CheckCircle, Search, Mail, Newspaper, Bell, History } from 'lucide-react';
import { checkTextQuality } from '../services/geminiService';

export const CommunicationHub: React.FC<{ ownerMode?: boolean }> = ({ ownerMode }) => {
    const [draft, setDraft] = useState('');
    const [isChecking, setIsChecking] = useState(false);
    const [auditResult, setAuditResult] = useState<{ hasErrors: boolean; corrections: string; explanation: string } | null>(null);

    const handleAudit = async () => {
        if (!draft.trim()) return;
        setIsChecking(true);
        const result = await checkTextQuality(draft);
        setAuditResult(result);
        setIsChecking(false);
    };

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white p-12 rounded-[4rem] border border-slate-100 shadow-xl">
                        <div className="flex justify-between items-center mb-8">
                            <div>
                                <h3 className="text-3xl font-black tracking-tight mb-1">School Broadcast</h3>
                                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Professional Drafting Suite</p>
                            </div>
                            <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 shadow-inner">
                                <PenTool className="w-6 h-6"/>
                            </div>
                        </div>
                        
                        <textarea 
                            value={draft}
                            onChange={(e) => {setDraft(e.target.value); setAuditResult(null);}}
                            placeholder="Type your message to parents or staff here..."
                            className="w-full h-56 bg-slate-50 rounded-[2.5rem] p-10 outline-none font-medium text-lg text-slate-700 focus:ring-4 ring-indigo-50 transition-all resize-none shadow-inner"
                        />
                        
                        <div className="mt-8 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Target: Campus Wide Broadcast</p>
                            </div>
                            <div className="flex gap-4">
                                <button 
                                    onClick={handleAudit}
                                    disabled={isChecking || !draft.trim()}
                                    className="bg-indigo-50 text-indigo-600 px-10 py-4 rounded-3xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-100 transition-all flex items-center gap-2 border border-indigo-100"
                                >
                                    {isChecking ? <Sparkles className="animate-spin w-4 h-4"/> : <Sparkles className="w-4 h-4"/>}
                                    Check Professionalism
                                </button>
                                <button 
                                    className="bg-slate-900 text-white px-10 py-4 rounded-3xl font-black text-[10px] uppercase tracking-widest hover:bg-black transition-all flex items-center gap-2 shadow-2xl disabled:opacity-50"
                                    disabled={auditResult?.hasErrors || !draft.trim()}
                                >
                                    <Send className="w-4 h-4"/> Dispatch Message
                                </button>
                            </div>
                        </div>
                    </div>

                    {auditResult && (
                        <div className={`p-10 rounded-[3.5rem] border-2 animate-scale-in shadow-2xl ${auditResult.hasErrors ? 'bg-red-50 border-red-100 text-red-900' : 'bg-green-50 border-green-100 text-green-900'}`}>
                            <div className="flex items-start gap-8">
                                <div className={`w-16 h-16 rounded-3xl flex items-center justify-center shadow-xl ${auditResult.hasErrors ? 'bg-red-200 text-red-700' : 'bg-green-200 text-green-700'}`}>
                                    {auditResult.hasErrors ? <AlertTriangle className="w-8 h-8"/> : <CheckCircle className="w-8 h-8"/>}
                                </div>
                                <div className="flex-1">
                                    <h4 className="font-black text-2xl mb-2 tracking-tighter">{auditResult.hasErrors ? 'Correction Required' : 'Message Certified'}</h4>
                                    <p className="text-lg opacity-80 mb-6 font-medium leading-relaxed">{auditResult.explanation || 'The message meets the institutional standards for clarity and grammar.'}</p>
                                    
                                    {auditResult.hasErrors && (
                                        <div className="bg-white/60 p-8 rounded-[2.5rem] border border-white shadow-inner">
                                            <div className="flex items-center gap-2 mb-3">
                                                <Sparkles className="w-4 h-4 text-indigo-600"/>
                                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">AI Professional Suggestion:</p>
                                            </div>
                                            <p className="font-bold italic text-slate-900 text-xl leading-relaxed">"{auditResult.corrections}"</p>
                                            <div className="mt-6 flex gap-4">
                                                <button 
                                                    onClick={() => {setDraft(auditResult.corrections); setAuditResult(null);}}
                                                    className="bg-indigo-600 text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 shadow-lg"
                                                >
                                                    Apply AI Correction
                                                </button>
                                                {ownerMode && (
                                                    <button className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900">Ignore Correction</button>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="space-y-8">
                    <div className="bg-slate-950 rounded-[4rem] p-12 text-white relative overflow-hidden shadow-2xl">
                        <div className="flex items-center gap-4 mb-8">
                             <History className="w-8 h-8 text-indigo-400" />
                             <h3 className="text-2xl font-black tracking-tight">Broadcast History</h3>
                        </div>
                        <div className="space-y-6 relative z-10">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="bg-white/5 p-6 rounded-3xl border border-white/5 flex items-center gap-5 hover:bg-white/10 transition-colors cursor-pointer group">
                                    <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform">
                                        <Mail className="w-6 h-6"/>
                                    </div>
                                    <div>
                                        <p className="text-sm font-black tracking-tight">Parent Newsletter #{i}</p>
                                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Delivered • {i * 2} Days Ago</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <Bell className="absolute right-[-40px] bottom-[-40px] w-64 h-64 opacity-5 rotate-12"/>
                    </div>
                </div>
            </div>
        </div>
    );
};

const PenTool = ({ className }: { className?: string }) => <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>;
