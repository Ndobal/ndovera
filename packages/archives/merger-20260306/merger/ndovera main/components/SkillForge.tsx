
import React, { useState } from 'react';
import { 
    Cpu, MessageCircle, DollarSign, PenTool, 
    Award, Layers, ChevronRight, Play, 
    Lock, CheckCircle, Star, Sparkles,
    Zap, Terminal, Mic, Briefcase
} from 'lucide-react';
import { MasterySkill } from '../types';

const MOCK_SKILLS: MasterySkill[] = [
    { id: 's1', title: 'Python Basics', category: 'TECH', progress: 100, isUnlocked: true, badges: ['CODE_PILOT'] },
    { id: 's2', title: 'Public Speaking', category: 'CIVIC', progress: 45, isUnlocked: true, badges: [] },
    { id: 's3', title: 'Financial Literacy', category: 'LIFE', progress: 12, isUnlocked: true, badges: [] },
    { id: 's4', title: 'Digital Arts', category: 'ARTS', progress: 0, isUnlocked: false, badges: [] },
];

export const SkillForge: React.FC = () => {
    const [skills] = useState<MasterySkill[]>(MOCK_SKILLS);

    return (
        <div className="space-y-12 animate-fade-in pb-20">
            <div className="bg-indigo-900 p-12 rounded-[4rem] text-white shadow-3xl relative overflow-hidden border-b-8 border-indigo-400">
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-10">
                    <div>
                        <h2 className="text-5xl font-black italic tracking-tighter uppercase leading-none">Skill Forge</h2>
                        <p className="text-indigo-300 font-bold uppercase text-[10px] tracking-widest mt-4 italic">Practical Intelligence & Micro-Credentialing Hub</p>
                    </div>
                    <div className="bg-white/10 backdrop-blur-xl px-10 py-5 rounded-[2.5rem] border border-white/10 flex items-center gap-4">
                        <Award className="w-10 h-10 text-amber-400"/>
                        <div>
                           <p className="text-[10px] font-black text-indigo-300 uppercase mb-1">Prestige Earned</p>
                           <p className="text-3xl font-black italic">Level 14</p>
                        </div>
                    </div>
                </div>
                <Layers className="absolute right-[-20px] bottom-[-20px] w-80 h-80 opacity-5 rotate-12"/>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {skills.map(skill => (
                    <div key={skill.id} className={`bg-white rounded-[4rem] p-10 border transition-all ${!skill.isUnlocked ? 'opacity-60 grayscale' : 'shadow-xl hover:shadow-2xl hover:translate-y-[-4px] border-slate-100'}`}>
                        <div className="flex justify-between items-start mb-8">
                            <div className="w-16 h-16 bg-slate-50 rounded-3xl flex items-center justify-center text-slate-900 shadow-inner">
                                {skill.category === 'TECH' && <Terminal className="w-8 h-8"/>}
                                {skill.category === 'CIVIC' && <Mic className="w-8 h-8"/>}
                                {skill.category === 'LIFE' && <Briefcase className="w-8 h-8"/>}
                                {skill.category === 'ARTS' && <PenTool className="w-8 h-8"/>}
                            </div>
                            {!skill.isUnlocked ? (
                                <div className="p-3 bg-slate-100 rounded-2xl"><Lock className="w-5 h-5 text-slate-400"/></div>
                            ) : skill.progress === 100 ? (
                                <div className="p-3 bg-emerald-50 rounded-2xl shadow-inner"><CheckCircle className="w-5 h-5 text-emerald-600"/></div>
                            ) : (
                                <div className="p-3 bg-indigo-50 rounded-2xl"><Sparkles className="w-5 h-5 text-indigo-600 animate-pulse"/></div>
                            )}
                        </div>

                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{skill.category} MASTERY</p>
                        <h4 className="text-3xl font-black italic tracking-tighter uppercase text-slate-900 leading-none mb-6">{skill.title}</h4>
                        
                        <div className="space-y-4">
                            <div className="flex justify-between text-[10px] font-black uppercase text-slate-500 tracking-widest">
                                <span>Track Progress</span>
                                <span>{skill.progress}%</span>
                            </div>
                            <div className="h-3 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                                <div className="h-full bg-indigo-600 rounded-full transition-all duration-1000" style={{ width: `${skill.progress}%` }}/>
                            </div>
                        </div>

                        <div className="mt-10 flex gap-2">
                            {skill.badges.map(b => (
                                <span key={b} className="px-4 py-1.5 bg-amber-400 text-slate-900 rounded-full text-[9px] font-black uppercase tracking-widest shadow-lg">{b}</span>
                            ))}
                        </div>

                        {skill.isUnlocked && skill.progress < 100 && (
                            <button className="w-full mt-10 bg-slate-900 text-white py-6 rounded-3xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-indigo-600 transition-all shadow-2xl">
                                <Play className="w-4 h-4 fill-current"/> Continue Track
                            </button>
                        )}
                        {!skill.isUnlocked && (
                            <button className="w-full mt-10 bg-slate-100 text-slate-400 py-6 rounded-3xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3">
                                Redeem for 500 Lams
                            </button>
                        )}
                    </div>
                ))}
            </div>

            <div className="bg-slate-950 p-16 rounded-[5rem] text-white relative overflow-hidden shadow-3xl border border-white/5">
                <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
                    <div className="space-y-8">
                        <div className="inline-flex items-center gap-3 px-6 py-2 bg-indigo-600/20 rounded-full text-indigo-400 text-[10px] font-black uppercase tracking-widest border border-indigo-600/30">Sanctuary Mentorship Engine</div>
                        <h3 className="text-6xl font-black italic tracking-tighter leading-none">The Mastery Map.</h3>
                        <p className="text-slate-400 text-2xl font-medium italic opacity-80 leading-relaxed">
                            "Connect your classroom knowledge with life skills. Build a portfolio that university boards can't ignore."
                        </p>
                        <button className="bg-white text-slate-900 px-14 py-6 rounded-[2.5rem] font-black text-lg uppercase tracking-widest shadow-2xl hover:scale-105 transition-all flex items-center gap-4">
                            Explore Skill Tree <ChevronRight className="w-6 h-6"/>
                        </button>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                         {[
                             { l: 'Mastered', v: '4', c: 'indigo' },
                             { l: 'Badges', v: '12', c: 'amber' },
                             { l: 'Global Rank', v: '#12', c: 'emerald' },
                             { l: 'XP Yield', v: '420k', c: 'indigo' }
                         ].map((s, i) => (
                             <div key={i} className="bg-white/5 p-10 rounded-[3rem] border border-white/5 text-center space-y-2">
                                 <p className="text-5xl font-black italic">{s.v}</p>
                                 <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{s.l}</p>
                             </div>
                         ))}
                    </div>
                </div>
                <Zap className="absolute left-[-40px] bottom-[-40px] w-96 h-96 opacity-[0.03] rotate-12"/>
            </div>
        </div>
    );
};
