
import React, { useState } from 'react';
import { 
  Heart, Globe, ArrowRight, Camera, 
  Plus, Save, Trash2, ShieldCheck,
  TrendingUp, Activity, Layout, EyeOff, CheckCircle, HandHeart
} from 'lucide-react';
import { CSRImpactProject, UserRole } from '../types';

export const NdoveraImpact: React.FC<{ role: UserRole }> = ({ role }) => {
    const [projects, setProjects] = useState<CSRImpactProject[]>([
        { id: '1', title: 'Community Tuition: Borno District', description: 'Settled full academic session fees for 40 orphan students in primary school.', imageUrl: 'https://images.unsplash.com/photo-1526628953301-3e589a6a8b74', amountSpent: 1450000, date: 'Nov 02, 2024' },
        { id: '2', title: 'Orphanage Winter Aid: Lagos', description: 'Provided mattresses, solar lamps, and school kits for local child-care centers.', imageUrl: 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c', amountSpent: 980000, date: 'Oct 15, 2024' },
    ]);
    const [isAdding, setIsAdding] = useState(false);
    const [newProject, setNewProject] = useState<Partial<CSRImpactProject>>({});

    const isAdmin = role === UserRole.SUPER_ADMIN;

    const handleAdd = () => {
        if (!newProject.title || !newProject.amountSpent) return;
        setProjects([{ 
            ...newProject, 
            id: Date.now().toString(), 
            date: new Date().toLocaleDateString() 
        } as CSRImpactProject, ...projects]);
        setIsAdding(false);
        setNewProject({});
    };

    return (
        <div className="space-y-12 animate-fade-in pb-20">
            <div className="bg-emerald-600 rounded-[4rem] p-20 text-white relative overflow-hidden shadow-2xl">
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-10">
                    <div className="max-w-2xl text-center md:text-left space-y-6">
                        <div className="inline-flex items-center gap-2 px-6 py-2 bg-white/10 rounded-full text-[10px] font-black uppercase tracking-widest border border-white/20">Humanity Ledger: Community Support Projects</div>
                        <h2 className="text-6xl font-black tracking-tighter italic text-white">Heart for Humanity.</h2>
                        <div className="space-y-4">
                            <p className="text-emerald-100 text-xl font-medium opacity-90 leading-relaxed">
                                We use the money you give to pay school fees for children who need it. We also buy food and clothes for orphanages and help build things for our community.
                            </p>
                            <p className="text-emerald-950 text-xl font-black italic">Your humanity changes everything.</p>
                        </div>
                        {isAdmin && (
                            <button onClick={() => setIsAdding(true)} className="bg-white text-emerald-600 px-10 py-5 rounded-[2rem] font-black text-xs uppercase tracking-widest shadow-xl flex items-center gap-2">
                                <Plus className="w-5 h-5"/> Deploy Humanity Project
                            </button>
                        )}
                    </div>
                    <div className="bg-white/10 backdrop-blur-xl p-12 rounded-[3rem] border border-white/10 text-center flex flex-col items-center">
                        <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mb-4"><ShieldCheck className="w-8 h-8"/></div>
                        <h4 className="text-5xl font-black italic tracking-tighter">₦{(projects.reduce((a,b) => a + b.amountSpent, 0) / 1000000).toFixed(2)}M</h4>
                        <p className="text-[10px] font-black uppercase text-emerald-300 tracking-[0.4em] mt-2">Verified Humanity Disbursed</p>
                    </div>
                </div>
                <Globe className="absolute right-[-60px] top-[-100px] w-96 h-96 opacity-10 rotate-12"/>
            </div>

            {isAdding && (
                <div className="bg-white p-16 rounded-[4rem] border-4 border-dashed border-emerald-100 shadow-2xl space-y-10 animate-scale-in">
                    <div className="flex justify-between items-center">
                        <h3 className="text-3xl font-black italic tracking-tighter text-emerald-600">Humanity Deployment Hub</h3>
                        <button onClick={() => setIsAdding(false)}><Trash2 className="text-slate-300 w-8 h-8 hover:text-red-500 transition-colors"/></button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-6">
                            <div><label className="text-[10px] font-black uppercase text-slate-400 block mb-2 tracking-widest">Project Category (Fees/Orphans/Community)</label><input onChange={e => setNewProject({...newProject, title: e.target.value})} placeholder="e.g. Tuition Aid: Central Region" className="w-full bg-slate-50 p-6 rounded-3xl outline-none border border-slate-100 focus:ring-4 ring-emerald-500/10 font-black text-lg"/></div>
                            <div><label className="text-[10px] font-black uppercase text-slate-400 block mb-2 tracking-widest">Amount Disbursed (₦)</label><input type="number" onChange={e => setNewProject({...newProject, amountSpent: Number(e.target.value)})} className="w-full bg-slate-50 p-6 rounded-3xl outline-none border border-slate-100 focus:ring-4 ring-emerald-500/10 font-black text-lg"/></div>
                        </div>
                        <div><label className="text-[10px] font-black uppercase text-slate-400 block mb-2 tracking-widest">Beneficiary Details & Verification</label><textarea onChange={e => setNewProject({...newProject, description: e.target.value})} placeholder="Describe how the funds were used specifically..." className="w-full bg-slate-50 p-6 rounded-3xl outline-none border border-slate-100 focus:ring-4 ring-emerald-500/10 h-44 font-medium italic"/></div>
                    </div>
                    <div><label className="text-[10px] font-black uppercase text-slate-400 block mb-2 tracking-widest">Field Evidence (Photo URL)</label><input onChange={e => setNewProject({...newProject, imageUrl: e.target.value})} placeholder="https://cdn.ndovera.com/evidence-shot.jpg" className="w-full bg-slate-50 p-6 rounded-3xl outline-none border border-slate-100 font-black"/></div>
                    <button onClick={handleAdd} className="w-full bg-emerald-600 text-white py-8 rounded-[2.5rem] font-black text-sm uppercase tracking-[0.3em] shadow-2xl flex items-center justify-center gap-3">
                        <Save className="w-6 h-6"/> Publish Humanity Proof
                    </button>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                {projects.map(project => (
                    <div key={project.id} className="bg-white rounded-[4rem] overflow-hidden shadow-xl border border-slate-100 group hover:shadow-2xl transition-all duration-500">
                        <div className="h-96 relative overflow-hidden">
                            <img src={project.imageUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-[2000ms]" />
                            <div className="absolute top-10 left-10 bg-emerald-600 text-white px-8 py-3 rounded-full text-[10px] font-black uppercase tracking-widest shadow-2xl flex items-center gap-2">
                                <CheckCircle className="w-4 h-4"/> Field Verified Humanity
                            </div>
                        </div>
                        <div className="p-16 space-y-8">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h4 className="text-4xl font-black tracking-tight">{project.title}</h4>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">{project.date} • Direct Intervention</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-3xl font-black text-emerald-600">₦{project.amountSpent.toLocaleString()}</p>
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Humanity Volume</p>
                                </div>
                            </div>
                            <p className="text-slate-500 font-medium text-lg leading-relaxed italic">"{project.description}"</p>
                            <div className="pt-8 border-t border-slate-50 flex items-center justify-between">
                                <button className="flex items-center gap-3 font-black text-[10px] uppercase tracking-widest text-emerald-600 hover:gap-6 transition-all">View Audit Trail <ArrowRight className="w-5 h-5"/></button>
                                <div className="flex items-center gap-2 text-slate-300"><EyeOff className="w-4 h-4"/> <span className="text-[8px] font-black uppercase">Recipient Privacy Active</span></div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
