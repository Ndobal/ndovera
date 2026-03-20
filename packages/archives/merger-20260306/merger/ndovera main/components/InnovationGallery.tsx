
import React, { useState } from 'react';
import { 
    Image as ImageIcon, Search, Plus, Filter, 
    Heart, Eye, MessageSquare, ShieldCheck, 
    Award, ExternalLink, Sparkles, Play,
    CheckCircle, User, Grid, Layout
} from 'lucide-react';
import { CreativeAsset } from '../types';

const MOCK_ASSETS: CreativeAsset[] = [
    { id: '1', studentId: 's1', studentName: 'David Okon', title: 'Solar Powered Irrigation', description: 'A working prototype for small-scale Nigerian farms.', type: 'SCIENCE', url: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758', likes: 142, verifiedBy: 'Mr. Ibeke' },
    { id: '2', studentId: 's1', studentName: 'David Okon', title: 'Echoes of the Delta', description: 'A short story exploring the future of environmental preservation.', type: 'WRITING', url: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c', likes: 88, verifiedBy: 'Mrs. Florence' },
    { id: '3', studentId: 's1', studentName: 'David Okon', title: 'Ndovera Redesign', description: 'Proposed UI refinements for the student sanctuary.', type: 'CODE', url: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c', likes: 210, verifiedBy: 'System AI' },
];

export const InnovationGallery: React.FC = () => {
    const [assets] = useState<CreativeAsset[]>(MOCK_ASSETS);
    const [view, setView] = useState<'GRID' | 'PORTFOLIO'>('GRID');

    return (
        <div className="space-y-8 animate-fade-in pb-20">
            <div className="bg-slate-950 p-12 rounded-[4rem] text-white shadow-3xl relative overflow-hidden border-b-8 border-indigo-600">
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-10">
                    <div>
                        <h2 className="text-5xl font-black italic tracking-tighter uppercase leading-none">Innovation Gallery</h2>
                        <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest mt-4 italic">Showcasing Institutional Intelligence & Creative Output</p>
                    </div>
                    <div className="flex gap-4">
                        <button className="bg-white text-slate-950 px-8 py-4 rounded-3xl font-black text-xs uppercase tracking-widest shadow-xl flex items-center gap-2 hover:scale-105 transition-all">
                            <Plus className="w-4 h-4"/> Submit Artifact
                        </button>
                    </div>
                </div>
                <ImageIcon className="absolute right-[-20px] bottom-[-20px] w-80 h-80 opacity-5 rotate-12"/>
            </div>

            <div className="flex justify-between items-center bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300"/>
                    <input placeholder="Search projects..." className="w-full bg-slate-50 p-5 pl-16 rounded-2xl outline-none border border-slate-50 font-bold" />
                </div>
                <div className="hidden md:flex gap-4 p-1.5 bg-slate-100 rounded-2xl">
                    <button onClick={() => setView('GRID')} className={`px-6 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${view === 'GRID' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}><Grid className="w-4 h-4"/></button>
                    <button onClick={() => setView('PORTFOLIO')} className={`px-6 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${view === 'PORTFOLIO' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}><User className="w-4 h-4"/></button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                {assets.map(asset => (
                    <div key={asset.id} className="bg-white rounded-[3.5rem] overflow-hidden shadow-xl border border-slate-100 group hover:shadow-2xl transition-all duration-500 flex flex-col">
                        <div className="h-72 relative overflow-hidden">
                            <img src={asset.url} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-[1500ms]" />
                            <div className="absolute top-6 left-6 bg-slate-900/80 backdrop-blur-md text-white px-4 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest shadow-xl">
                                {asset.type}
                            </div>
                            {asset.verifiedBy && (
                                <div className="absolute top-6 right-6 bg-emerald-500 text-white p-2 rounded-full shadow-xl">
                                    <ShieldCheck className="w-4 h-4"/>
                                </div>
                            )}
                        </div>
                        <div className="p-10 space-y-6 flex-1 flex flex-col justify-between">
                            <div className="space-y-2">
                                <h4 className="text-2xl font-black italic tracking-tighter uppercase text-slate-900 group-hover:text-indigo-600 transition-colors leading-none">{asset.title}</h4>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">by {asset.studentName}</p>
                                <p className="text-sm text-slate-500 font-medium leading-relaxed italic mt-4">"{asset.description}"</p>
                            </div>
                            
                            <div className="pt-6 border-t border-slate-50 flex justify-between items-center">
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-1.5 text-slate-400 font-black text-[10px]">
                                        <Heart className="w-4 h-4 text-rose-500 fill-rose-500"/> {asset.likes}
                                    </div>
                                    <div className="flex items-center gap-1.5 text-slate-400 font-black text-[10px]">
                                        <Eye className="w-4 h-4"/> 1.2k
                                    </div>
                                </div>
                                <button className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl hover:bg-indigo-600 hover:text-white transition-all">
                                    <ExternalLink className="w-4 h-4"/>
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="bg-indigo-600 p-16 rounded-[4rem] text-white text-center space-y-8 shadow-3xl relative overflow-hidden">
                <div className="relative z-10 max-w-2xl mx-auto space-y-6">
                    <Sparkles className="w-16 h-16 text-amber-400 mx-auto animate-pulse"/>
                    <h3 className="text-5xl font-black italic tracking-tighter uppercase">Join the Showcase.</h3>
                    <p className="text-xl font-medium italic opacity-90 leading-relaxed">"Innovation is rewarded. Top-rated gallery artifacts earn historical prestige points and Lams bonuses."</p>
                    <button className="bg-slate-950 text-white px-12 py-6 rounded-[2.5rem] font-black text-sm uppercase tracking-widest shadow-2xl hover:bg-white hover:text-slate-950 transition-all">
                        Initiate Submission
                    </button>
                </div>
                <Award className="absolute left-[-40px] bottom-[-40px] w-96 h-96 opacity-10 rotate-12"/>
            </div>
        </div>
    );
};
