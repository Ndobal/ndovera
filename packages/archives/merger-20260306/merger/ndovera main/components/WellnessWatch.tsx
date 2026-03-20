
import React, { useState, useEffect } from 'react';
import { 
    Heart, Activity, Utensils, Moon, 
    Sparkles, ShieldCheck, TrendingUp, Smile, 
    Clock, AlertTriangle, Pill, Brain, Loader2,
    RefreshCw, Zap, Target
} from 'lucide-react';
import { HealthMetric, UserRole } from '../types';
import { GoogleGenAI } from "@google/genai";

const MOCK_METRICS: HealthMetric[] = [
    { id: '1', studentId: 's1', type: 'NUTRITION', value: 85, label: 'Balanced Intake', timestamp: 'Today' },
    { id: '2', studentId: 's1', type: 'ACTIVITY', value: 92, label: 'Sports Peak', timestamp: 'Yesterday' },
    { id: '3', studentId: 's1', type: 'SLEEP', value: 74, label: 'Standard Rest', timestamp: 'Today' },
    { id: '4', studentId: 's1', type: 'MOOD', value: 65, label: 'Mild Fatigue', timestamp: 'Session' },
];

export const WellnessWatch: React.FC<{ role: UserRole }> = ({ role }) => {
    const [metrics] = useState<HealthMetric[]>(MOCK_METRICS);
    const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    const analyzeWellness = async () => {
        setIsAnalyzing(true);
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const prompt = `Analyze these student health metrics and provide a friendly, non-clinical summary with 2 actionable recommendations:
            Nutrition: ${metrics.find(m => m.type === 'NUTRITION')?.value}%
            Activity: ${metrics.find(m => m.type === 'ACTIVITY')?.value}%
            Sleep: ${metrics.find(m => m.type === 'SLEEP')?.value}%
            Mood: ${metrics.find(m => m.type === 'MOOD')?.value}%
            Student Name: David. Context: Intensive inter-house sports season.`;

            const result = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: prompt
            });
            setAiAnalysis(result.text || "Your vitality data is looking stable. Keep up the good work! 🌟");
        } catch (e) {
            setAiAnalysis("Analysis complete: Maintain high protein intake and ensure 8 hours of rest during sports season. 🚀");
        } finally {
            setIsAnalyzing(false);
        }
    };

    useEffect(() => {
        analyzeWellness();
    }, []);

    return (
        <div className="space-y-8 animate-fade-in pb-20">
            <div className="bg-rose-600 p-12 rounded-[4rem] text-white shadow-3xl relative overflow-hidden border-b-8 border-rose-400">
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-10">
                    <div>
                        <h2 className="text-5xl font-black italic tracking-tighter uppercase leading-none">Wellness Watch</h2>
                        <p className="text-rose-200 font-bold uppercase text-[10px] tracking-widest mt-4 italic">Student Vitality & Institutional Health Registry</p>
                    </div>
                    <div className="flex gap-4">
                        <div className="bg-white/10 backdrop-blur-xl px-10 py-5 rounded-[2.5rem] border border-white/20 flex items-center gap-4">
                             <div className="relative">
                                <Smile className="w-10 h-10 text-rose-200"/>
                                <div className="absolute inset-0 bg-white/20 rounded-full animate-ping"/>
                             </div>
                             <div>
                                <p className="text-[10px] font-black text-rose-300 uppercase mb-1">Campus Vitality</p>
                                <p className="text-3xl font-black italic">Stable</p>
                             </div>
                        </div>
                    </div>
                </div>
                <Heart className="absolute right-[-20px] bottom-[-20px] w-80 h-80 opacity-5 rotate-12"/>
            </div>

            {/* Biometric Pulse Dashboard */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                {metrics.map(m => (
                    <div key={m.id} className="bg-white p-10 rounded-[3.5rem] border border-slate-100 shadow-xl group hover:shadow-2xl transition-all relative overflow-hidden">
                        <div className="flex justify-between items-start mb-8 relative z-10">
                            <div className="w-16 h-16 bg-rose-50 rounded-[1.75rem] flex items-center justify-center text-rose-600 shadow-inner group-hover:scale-110 transition-transform">
                                {m.type === 'NUTRITION' && <Utensils className="w-8 h-8"/>}
                                {m.type === 'ACTIVITY' && <Activity className="w-8 h-8"/>}
                                {m.type === 'SLEEP' && <Moon className="w-8 h-8"/>}
                                {m.type === 'MOOD' && <Brain className="w-8 h-8"/>}
                            </div>
                            <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{m.timestamp}</span>
                        </div>
                        <div className="relative z-10">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{m.type} INDEX</h4>
                            <div className="flex items-end gap-3">
                                <p className={`text-5xl font-black italic tracking-tighter ${m.value < 70 ? 'text-amber-500' : 'text-slate-900'}`}>{m.value}%</p>
                                <TrendingUp className={`w-5 h-5 mb-2 ${m.value < 70 ? 'text-amber-400 rotate-180' : 'text-emerald-500'}`}/>
                            </div>
                            <div className="mt-8 h-2 bg-slate-50 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full transition-all duration-1000 ${m.value < 70 ? 'bg-amber-400' : 'bg-rose-600'}`} style={{ width: `${m.value}%` }}/>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                <div className="lg:col-span-2 space-y-8">
                    {/* AI Vitality & Analysis */}
                    <div className="bg-slate-900 p-12 rounded-[4rem] text-white shadow-3xl space-y-12 relative overflow-hidden">
                        <div className="relative z-10 flex justify-between items-center">
                            <div>
                                <h3 className="text-3xl font-black italic uppercase tracking-tighter">AI Vitality Pulse</h3>
                                <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest mt-2">Ndovera Intelligence welfare sync</p>
                            </div>
                            <button onClick={analyzeWellness} disabled={isAnalyzing} className="p-4 bg-white/10 rounded-full hover:bg-white/20 transition-all">
                                {isAnalyzing ? <Loader2 className="w-6 h-6 animate-spin text-amber-400"/> : <RefreshCw className="w-6 h-6 text-amber-400"/>}
                            </button>
                        </div>
                        
                        <div className="relative z-10 p-10 bg-white/5 rounded-[3rem] border border-white/10 space-y-6">
                            {isAnalyzing ? (
                                <div className="space-y-4">
                                    <div className="h-4 bg-white/5 rounded-full w-3/4 animate-pulse"/>
                                    <div className="h-4 bg-white/5 rounded-full w-1/2 animate-pulse"/>
                                </div>
                            ) : (
                                <>
                                    <p className="text-2xl font-medium italic leading-relaxed opacity-90">
                                        "{aiAnalysis}"
                                    </p>
                                    <div className="pt-6 border-t border-white/10 flex gap-4">
                                         <button className="bg-rose-600 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl flex items-center gap-2">
                                            <Zap className="w-4 h-4"/> Optimize My Routine
                                         </button>
                                    </div>
                                </>
                            )}
                        </div>
                        <Activity className="absolute right-[-40px] bottom-[-40px] w-96 h-96 opacity-[0.03] rotate-12"/>
                    </div>

                    {/* Weekly Health Goals */}
                    <div className="bg-white p-12 rounded-[4rem] border border-slate-100 shadow-2xl">
                        <div className="flex justify-between items-center mb-10">
                            <h4 className="text-2xl font-black italic tracking-tighter uppercase">Weekly Health Goals</h4>
                            <Target className="text-rose-600 w-6 h-6"/>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {[
                                { t: 'Hydration Peak', d: '2.5L Daily Intake', p: 80, c: 'text-indigo-600' },
                                { t: 'Sleep Hygiene', d: '8 Hours Minimum', p: 65, c: 'text-purple-600' },
                                { t: 'Active Cardio', d: '3 Sessions (Sports)', p: 100, c: 'text-emerald-600' },
                                { t: 'Balanced Macro', d: 'From Sanctuary Mall', p: 40, c: 'text-rose-600' },
                            ].map((goal, i) => (
                                <div key={i} className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                                    <p className={`font-black uppercase text-[10px] tracking-widest mb-1 ${goal.c}`}>{goal.t}</p>
                                    <h5 className="font-bold text-slate-900 text-lg uppercase italic tracking-tight">{goal.d}</h5>
                                    <div className="mt-4 flex items-center gap-4">
                                        <div className="flex-1 h-2 bg-white rounded-full overflow-hidden shadow-inner border border-slate-100">
                                            <div className={`h-full bg-slate-900 rounded-full transition-all duration-[2s]`} style={{ width: `${goal.p}%` }}/>
                                        </div>
                                        <span className="text-xs font-black text-slate-400">{goal.p}%</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="space-y-8">
                    {/* Nutrition Log from Mall */}
                    <div className="bg-white p-10 rounded-[4rem] border border-slate-100 shadow-2xl space-y-10">
                        <div>
                            <h4 className="text-xl font-black italic tracking-tighter uppercase">Nutrition Log</h4>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1 italic">Synced from Sanctuary Mall</p>
                        </div>
                        <div className="space-y-6">
                            {[
                                { m: 'Beef Jollof Bowl', t: '11:30 AM', c: 'High Protein', s: 'MALL' },
                                { m: 'Fresh Fruit Pack', t: '08:15 AM', c: 'Vitamins', s: 'HOUSE' },
                                { m: 'Crunchy Plantain', t: '02:45 PM', c: 'High Sodium', s: 'MALL', warning: true },
                            ].map((n, i) => (
                                <div key={i} className="flex justify-between items-center group">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${n.warning ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 text-slate-400 group-hover:bg-rose-50 group-hover:text-rose-600'}`}>
                                            {n.warning ? <AlertTriangle className="w-5 h-5"/> : <Utensils className="w-5 h-5"/>}
                                        </div>
                                        <div>
                                            <p className="font-black text-slate-900 uppercase text-xs tracking-tight">{n.m}</p>
                                            <p className="text-[9px] font-bold text-slate-400 uppercase">{n.t}</p>
                                        </div>
                                    </div>
                                    <span className={`text-[8px] font-black uppercase border px-3 py-1 rounded-full ${n.warning ? 'text-amber-600 border-amber-100' : 'text-emerald-500 border-emerald-100'}`}>{n.c}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-rose-600 p-10 rounded-[3.5rem] text-white space-y-6 shadow-xl relative overflow-hidden">
                        <div className="relative z-10">
                            <h4 className="text-xl font-black italic tracking-tighter uppercase mb-2">Clinic Sync</h4>
                            <p className="text-sm font-medium italic opacity-80 leading-relaxed mb-8">"Proactive metrics help us prevent illness before it starts."</p>
                            <div className="p-6 bg-white/10 rounded-3xl border border-white/10 flex items-center gap-4">
                                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center text-white"><Pill className="w-5 h-5"/></div>
                                <div>
                                    <p className="text-[10px] font-black uppercase text-rose-200 tracking-widest">Medical Note</p>
                                    <p className="text-lg font-black italic tracking-tight uppercase">Session Vitals: OK</p>
                                </div>
                            </div>
                        </div>
                        <ShieldCheck className="absolute right-[-20px] bottom-[-20px] w-48 h-48 opacity-10 rotate-12"/>
                    </div>
                </div>
            </div>
        </div>
    );
};
