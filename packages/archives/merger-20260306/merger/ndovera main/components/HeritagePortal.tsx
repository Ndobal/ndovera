
import React, { useState } from 'react';
import { 
    History, Users, Star, Video, HandHeart, 
    Search, Award, Globe, ArrowUpRight, 
    X, Play, Camera, MessageSquare 
} from 'lucide-react';
import { HeritageProfile, ScholarshipFund } from '../types';

const MOCK_ALUMNI: HeritageProfile[] = [
    { id: '1', name: 'Dr. Chidi Okonjo', graduationYear: 2005, profession: 'Neurosurgeon', bio: 'Passionate about bringing tech to medicine.', img: 'https://ui-avatars.com/api/?name=Chidi+Okonjo', isMentor: true },
    { id: '2', name: 'Engr. Fatima Musa', graduationYear: 2010, profession: 'Renewable Energy', bio: 'Building the next gen of power systems.', img: 'https://ui-avatars.com/api/?name=Fatima+Musa', isMentor: true },
];

export const HeritagePortal: React.FC = () => {
    const [view, setView] = useState<'WALL' | 'MENTORS' | 'SCHOLARSHIPS'>('WALL');
    const [searchQuery, setSearchQuery] = useState('');

    return (
        <div className="space-y-8 animate-fade-in pb-20">
            <div className="bg-indigo-950 p-12 rounded-[4rem] text-white shadow-3xl relative overflow-hidden border-b-8 border-indigo-400">
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-10">
                    <div>
                        <h2 className="text-5xl font-black italic tracking-tighter uppercase leading-none">Heritage Portal</h2>
                        <p className="text-indigo-300 font-bold uppercase text-[10px] tracking-widest mt-4 italic">Connecting Generations of Excellence</p>
                    </div>
                    <div className="flex gap-2 p-1.5 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-xl">
                        <button onClick={() => setView('WALL')} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${view === 'WALL' ? 'bg-white text-slate-900 shadow-xl' : 'text-slate-400'}`}>Wall of Fame</button>
                        <button onClick={() => setView('MENTORS')} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${view === 'MENTORS' ? 'bg-white text-slate-900 shadow-xl' : 'text-slate-400'}`}>Mentors</button>
                        <button onClick={() => setView('SCHOLARSHIPS')} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${view === 'SCHOLARSHIPS' ? 'bg-white text-slate-900 shadow-xl' : 'text-slate-400'}`}>Humanity Fund</button>
                    </div>
                </div>
                <History className="absolute right-[-20px] bottom-[-20px] w-80 h-80 opacity-5 rotate-12"/>
            </div>

            {view === 'WALL' && (
                <div className="space-y-12">
                    <div className="bg-white p-12 rounded-[4rem] shadow-xl border border-slate-100 flex flex-col items-center text-center space-y-6">
                        <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 shadow-inner">
                            <Video className="w-10 h-10" />
                        </div>
                        <h3 className="text-3xl font-black italic uppercase tracking-tighter">Live Sanctuary Webinar</h3>
                        <p className="text-slate-500 max-w-lg font-medium">"From Lagoon High to NASA: A Career in Robotics" - Hosted by Alumnus John Doe. Starting in 45 mins.</p>
                        <button className="bg-indigo-600 text-white px-10 py-4 rounded-3xl font-black text-xs uppercase tracking-widest shadow-xl flex items-center gap-2 hover:scale-105 transition-all">
                            <Play className="w-4 h-4 fill-current"/> Join Session
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                        {MOCK_ALUMNI.map(alum => (
                            <div key={alum.id} className="bg-white rounded-[3.5rem] p-8 shadow-xl border border-slate-100 group hover:shadow-2xl transition-all flex flex-col items-center text-center space-y-6">
                                <div className="w-32 h-32 rounded-[2.5rem] overflow-hidden border-4 border-indigo-50 shadow-lg group-hover:scale-105 transition-transform">
                                    <img src={alum.img} className="w-full h-full object-cover" alt="" />
                                </div>
                                <div>
                                    <h4 className="text-xl font-black text-slate-900 uppercase italic tracking-tighter leading-none">{alum.name}</h4>
                                    <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mt-2">Class of {alum.graduationYear}</p>
                                </div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-tight">{alum.profession}</p>
                                <button className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-[9px] uppercase tracking-widest flex items-center justify-center gap-2">
                                    View Profile <ArrowUpRight className="w-3 h-3"/>
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {view === 'MENTORS' && (
                <div className="bg-white p-12 rounded-[4rem] shadow-2xl border border-slate-100 space-y-12">
                    <div className="flex justify-between items-center">
                        <h3 className="text-3xl font-black italic uppercase tracking-tighter">Legacy Mentorship Hub</h3>
                        <div className="relative w-64">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300"/>
                            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search profession..." className="w-full bg-slate-50 p-4 pl-10 rounded-2xl outline-none font-bold text-xs" />
                        </div>
                    </div>
                    <div className="space-y-4">
                        {MOCK_ALUMNI.filter(a => a.isMentor).map(mentor => (
                            <div key={mentor.id} className="p-8 bg-slate-50 rounded-[3rem] border border-slate-100 flex justify-between items-center group hover:bg-white hover:shadow-xl transition-all">
                                <div className="flex items-center gap-6">
                                    <img src={mentor.img} className="w-16 h-16 rounded-2xl border-2 border-white shadow-sm" alt="" />
                                    <div>
                                        <h4 className="text-xl font-black text-slate-900 uppercase italic tracking-tighter">{mentor.name}</h4>
                                        <p className="text-xs font-bold text-indigo-600 uppercase">{mentor.profession}</p>
                                    </div>
                                </div>
                                <button className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg flex items-center gap-2">
                                    <MessageSquare className="w-4 h-4" /> Request Mentorship
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
