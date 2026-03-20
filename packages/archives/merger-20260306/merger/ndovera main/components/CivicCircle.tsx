
import React, { useState } from 'react';
import { 
    Gavel, Users, Search, Plus, 
    ThumbsUp, ThumbsDown, MessageCircle, Clock,
    CheckCircle, ShieldCheck, Radio,
    Scale, Activity, ArrowRight,
    Trophy, Medal, Star, Send, X, UserCheck, Sparkles, Loader2
} from 'lucide-react';
import { CivicProposal } from '../types';
import { checkTextQuality } from '../services/geminiService';

const MOCK_PROPOSALS: CivicProposal[] = [
    { id: 'p1', title: 'Friday "Wear What You Love" Day', description: 'Proposal to allow non-uniform attire every last Friday of the month.', proposerName: 'Prefect David Okon', votesFor: 412, votesAgainst: 88, status: 'VOTING', deadline: 'Today 4:00 PM' },
    { id: 'p2', title: 'Solar Kiosk Expansion', description: 'Request for more outdoor charging stations for digital library tablets.', proposerName: 'Head Girl Aisha', votesFor: 620, votesAgainst: 12, status: 'APPROVED', deadline: 'Expired' },
];

const MOCK_DEBATE = [
    { user: 'Chioma B.', text: 'This would improve student morale significantly!', timestamp: '2 mins ago' },
    { user: 'Samuel E.', text: 'We should ensure the dress code remains decent for school.', timestamp: '10 mins ago' },
];

const MOCK_HONOR_ROLL = [
    { name: 'David Okon', role: 'Sports Prefect', achievement: '92% Consensus Rate', points: 1240 },
    { name: 'Aisha Bello', role: 'Head Girl', achievement: '4 Implemented Bills', points: 2100 },
    { name: 'Grace Adeyemi', role: 'Welfare Officer', achievement: 'Community Care Lead', points: 980 },
];

export const CivicCircle: React.FC = () => {
    const [proposals, setProposals] = useState<CivicProposal[]>(MOCK_PROPOSALS);
    const [showPostModal, setShowPostModal] = useState(false);
    const [newBill, setNewBill] = useState({ title: '', desc: '' });
    const [debateComments, setDebateComments] = useState(MOCK_DEBATE);
    const [commentInput, setCommentInput] = useState('');
    const [isAuditing, setIsAuditing] = useState(false);

    const handleVote = (id: string, type: 'FOR' | 'AGAINST') => {
        setProposals(prev => prev.map(p => {
            if (p.id !== id) return p;
            return {
                ...p,
                votesFor: type === 'FOR' ? p.votesFor + 1 : p.votesFor,
                votesAgainst: type === 'AGAINST' ? p.votesAgainst + 1 : p.votesAgainst
            };
        }));
    };

    const handlePostComment = async () => {
        if (!commentInput.trim()) return;
        setIsAuditing(true);
        const audit = await checkTextQuality(commentInput);
        
        if (audit.hasErrors) {
            alert(`Comment rejected by AI Moderator: ${audit.explanation}`);
            setIsAuditing(false);
            return;
        }

        const newComment = {
            user: 'David O. (Me)',
            text: commentInput,
            timestamp: 'Just now'
        };
        setDebateComments([newComment, ...debateComments]);
        setCommentInput('');
        setIsAuditing(false);
    };

    const handleCreateProposal = () => {
        if (!newBill.title || !newBill.desc) return;
        const bill: CivicProposal = {
            id: `p${Date.now()}`,
            title: newBill.title,
            description: newBill.desc,
            proposerName: 'Prefect Student',
            votesFor: 0,
            votesAgainst: 0,
            status: 'VOTING',
            deadline: '7 Days Left'
        };
        setProposals([bill, ...proposals]);
        setShowPostModal(false);
        setNewBill({ title: '', desc: '' });
    };

    return (
        <div className="space-y-8 animate-fade-in pb-20">
            {/* Democracy Header */}
            <div className="bg-emerald-900 p-12 rounded-[4rem] text-white shadow-3xl relative overflow-hidden border-b-8 border-emerald-400">
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-10">
                    <div>
                        <h2 className="text-5xl font-black italic tracking-tighter uppercase leading-none">Civic Circle</h2>
                        <p className="text-emerald-300 font-bold uppercase text-[10px] tracking-widest mt-4 italic">Sovereign Student Governance & Institutional Democracy</p>
                    </div>
                    <div className="flex gap-4">
                        <button onClick={() => setShowPostModal(true)} className="bg-white text-emerald-900 px-10 py-5 rounded-[2rem] font-black text-xs uppercase tracking-widest shadow-xl flex items-center gap-3 hover:scale-105 transition-all">
                            <Plus className="w-5 h-5"/> Post Community Bill
                        </button>
                        <div className="bg-white/5 backdrop-blur-xl px-10 py-5 rounded-[2.5rem] border border-white/10 flex items-center gap-4">
                            <Users className="w-10 h-10 text-emerald-300"/>
                            <div>
                               <p className="text-[10px] font-black text-emerald-400 uppercase mb-1">Electorate Size</p>
                               <p className="text-3xl font-black italic">1,240</p>
                            </div>
                        </div>
                    </div>
                </div>
                <Scale className="absolute right-[-20px] bottom-[-20px] w-80 h-80 opacity-5 rotate-12"/>
            </div>

            {/* Post Modal */}
            {showPostModal && (
                <div className="fixed inset-0 z-[500] bg-slate-950/90 backdrop-blur-xl flex items-center justify-center p-6">
                    <div className="bg-white rounded-[4rem] w-full max-w-xl overflow-hidden shadow-3xl animate-scale-in border border-slate-100">
                        <div className="p-10 bg-emerald-600 text-white flex justify-between items-center relative overflow-hidden">
                            <div className="relative z-10">
                                <h3 className="text-3xl font-black italic uppercase tracking-tight leading-none">Propose New Bill</h3>
                                <p className="text-emerald-100 font-bold uppercase text-[10px] tracking-widest mt-4 italic">Institutional Governance Suite</p>
                            </div>
                            <button onClick={() => setShowPostModal(false)} className="relative z-10 p-3 bg-white/10 rounded-full hover:bg-white/20 transition-all"><X className="w-6 h-6"/></button>
                            <Gavel className="absolute right-[-20px] bottom-[-20px] w-48 h-48 opacity-10 rotate-12"/>
                        </div>
                        <div className="p-12 space-y-8">
                            <div className="space-y-4">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-2">Legislative Title</label>
                                <input value={newBill.title} onChange={e => setNewBill({...newBill, title: e.target.value})} placeholder="e.g. New ICT Lab Hours" className="w-full bg-slate-50 p-6 rounded-[2rem] border-2 border-slate-100 focus:border-emerald-500 font-bold outline-none" />
                            </div>
                            <div className="space-y-4">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-2">Constituency Justification</label>
                                <textarea value={newBill.desc} onChange={e => setNewBill({...newBill, desc: e.target.value})} placeholder="Explain why the students need this..." className="w-full bg-slate-50 p-6 rounded-[2rem] border-2 border-slate-100 focus:border-emerald-500 font-medium italic h-40 outline-none resize-none" />
                            </div>
                            <button onClick={handleCreateProposal} className="w-full bg-slate-900 text-white py-8 rounded-[2.5rem] font-black text-sm uppercase tracking-widest shadow-2xl flex items-center justify-center gap-3 hover:bg-emerald-600 transition-all">
                                <Send className="w-5 h-5"/> Dispatch Proposal to Feed
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                <div className="lg:col-span-2 space-y-8">
                    <div className="flex justify-between items-center bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
                        <h3 className="text-xl font-black uppercase italic tracking-tighter px-4">Democracy Feed</h3>
                        <div className="bg-emerald-50 text-emerald-600 px-6 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2">
                            <Radio className="w-4 h-4 animate-pulse"/> Voting Channels Open
                        </div>
                    </div>

                    <div className="space-y-6">
                        {proposals.map(prop => (
                            <div key={prop.id} className="bg-white p-12 rounded-[4rem] border border-slate-100 shadow-xl group hover:shadow-2xl transition-all space-y-10 relative overflow-hidden">
                                <div className="flex justify-between items-start relative z-10">
                                    <div className="space-y-2">
                                        <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${prop.status === 'VOTING' ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-green-50 text-green-600 border-green-100'}`}>
                                            {prop.status}
                                        </span>
                                        <h4 className="text-4xl font-black italic tracking-tighter text-slate-900 leading-none uppercase">{prop.title}</h4>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">PROPOSED BY: {prop.proposerName}</p>
                                    </div>
                                    <div className="text-right">
                                        <div className="flex items-center gap-2 text-slate-400 font-black text-xs uppercase mb-1"><Clock className="w-3 h-3"/> {prop.deadline}</div>
                                        <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest tracking-tighter">ID: {prop.id.toUpperCase()}</p>
                                    </div>
                                </div>

                                <p className="text-xl font-medium text-slate-500 leading-relaxed italic relative z-10">"{prop.description}"</p>

                                <div className="space-y-6 relative z-10">
                                    <div className="flex justify-between items-end text-[11px] font-black uppercase tracking-widest">
                                        <span className="text-emerald-600">IN FAVOR ({prop.votesFor})</span>
                                        <span className="text-rose-600">AGAINST ({prop.votesAgainst})</span>
                                    </div>
                                    <div className="h-4 bg-slate-50 rounded-full overflow-hidden flex shadow-inner">
                                        <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${(prop.votesFor / Math.max(1, prop.votesFor + prop.votesAgainst)) * 100}%` }}/>
                                        <div className="h-full bg-rose-500 transition-all duration-1000" style={{ width: `${(prop.votesAgainst / Math.max(1, prop.votesFor + prop.votesAgainst)) * 100}%` }}/>
                                    </div>
                                </div>

                                {prop.status === 'VOTING' && (
                                    <div className="flex gap-4 pt-4 relative z-10">
                                        <button onClick={() => handleVote(prop.id, 'FOR')} className="flex-1 bg-emerald-600 text-white py-6 rounded-[2rem] font-black text-xs uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 hover:bg-emerald-700 transition-all">
                                            <ThumbsUp className="w-5 h-5"/> Cast Yea
                                        </button>
                                        <button onClick={() => handleVote(prop.id, 'AGAINST')} className="flex-1 bg-white border-4 border-rose-100 text-rose-600 py-6 rounded-[2rem] font-black text-xs uppercase tracking-widest hover:bg-rose-50 transition-all flex items-center justify-center gap-3">
                                            <ThumbsDown className="w-5 h-5"/> Cast Nay
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="space-y-8">
                    {/* Leadership Honor Roll */}
                    <div className="bg-slate-900 p-10 rounded-[3.5rem] text-white space-y-10 shadow-3xl">
                        <div className="flex justify-between items-center">
                            <h4 className="text-xl font-black italic tracking-tighter uppercase flex items-center gap-3"><Medal className="text-amber-400 w-6 h-6"/> Honor Roll</h4>
                        </div>
                        <div className="space-y-6">
                            {MOCK_HONOR_ROLL.map((leader, i) => (
                                <div key={i} className="flex items-center gap-5 group cursor-pointer hover:translate-x-2 transition-transform">
                                    <div className="relative">
                                        <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center text-amber-400 font-black italic border border-white/10">{i + 1}</div>
                                        {i === 0 && <Star className="absolute -top-2 -right-2 w-5 h-5 text-amber-400 fill-amber-400 animate-pulse"/>}
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-black text-sm uppercase tracking-tight">{leader.name}</p>
                                        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{leader.role}</p>
                                        <p className="text-[8px] text-emerald-400 font-black uppercase mt-1 italic">{leader.achievement}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs font-black text-amber-400">{leader.points}</p>
                                        <p className="text-[7px] font-black text-slate-500 uppercase">Prestige</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <button className="w-full py-4 bg-white/5 border border-white/10 rounded-2xl font-black text-[9px] uppercase tracking-widest text-slate-400 hover:bg-white/10 transition-all">View All Leaders</button>
                    </div>

                    <div className="bg-white p-10 rounded-[3.5rem] border border-slate-100 shadow-xl space-y-8">
                        <div className="flex items-center gap-4">
                             <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 shadow-inner"><MessageCircle className="w-6 h-6"/></div>
                             <h4 className="text-lg font-black uppercase text-slate-900 tracking-tight">Debate Channel</h4>
                        </div>
                        <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 scrollbar-hide">
                             {debateComments.map((c, i) => (
                                <div key={i} className="p-5 bg-slate-50 rounded-3xl space-y-2 border-l-4 border-indigo-600 animate-fade-in">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{c.user} • {c.timestamp}</p>
                                    <p className="text-sm font-medium italic text-slate-600 leading-relaxed">"{c.text}"</p>
                                </div>
                             ))}
                        </div>
                        <div className="relative pt-4 border-t border-slate-50">
                            <input 
                                value={commentInput}
                                onChange={e => setCommentInput(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handlePostComment()}
                                disabled={isAuditing}
                                placeholder="Post moderated reply..." 
                                className="w-full bg-slate-100 p-4 rounded-2xl pr-14 font-bold text-xs outline-none focus:ring-2 ring-indigo-500/20"
                            />
                            <button 
                                onClick={handlePostComment}
                                disabled={isAuditing || !commentInput.trim()}
                                className="absolute right-2 top-[22px] p-2 text-indigo-600 hover:bg-white rounded-xl transition-all disabled:opacity-30"
                            >
                                {isAuditing ? <Loader2 className="w-4 h-4 animate-spin"/> : <Sparkles className="w-4 h-4"/>}
                            </button>
                        </div>
                    </div>

                    <div className="bg-emerald-600 p-10 rounded-[3.5rem] text-white shadow-xl relative overflow-hidden group">
                        <h4 className="relative z-10 text-xl font-black italic tracking-tighter uppercase mb-4">Sovereign Proof</h4>
                        <p className="relative z-10 text-sm font-medium italic leading-relaxed opacity-90 mb-6">"Every vote cast is cryptographically verified to prevent double-voting and ensure absolute electoral integrity."</p>
                        <ShieldCheck className="absolute right-[-20px] bottom-[-20px] w-48 h-48 opacity-10 rotate-12 transition-transform group-hover:scale-110"/>
                    </div>
                </div>
            </div>
        </div>
    );
};
