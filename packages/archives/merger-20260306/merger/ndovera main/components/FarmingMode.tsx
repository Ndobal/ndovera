
import React, { useState, useEffect } from 'react';
import { 
  Zap, DollarSign, Wallet, 
  Clock, ShieldCheck, Flame, Landmark,
  Info, AlertCircle, Building2, CheckCircle2,
  Trophy, Star, ShoppingBag, ArrowRight,
  BookOpen, Mic, Layout, Sparkles, Loader2,
  PlayCircle, Eye, Users, ExternalLink
} from 'lucide-react';
import { LamsWallet, UserRole, Quest, MarketItem } from '../types';

/**
 * A simulated AdSense/AdMob Unit for institutional sponsors.
 * In production, this would be replaced with Google AdSense code.
 * Moved from DashboardFeatures to FarmingMode to unify ad-related units.
 */
export const SponsoredSearchUnit: React.FC = () => {
    return (
        <div className="bg-slate-50 border border-slate-200 rounded-[2.5rem] p-6 flex flex-col md:flex-row items-center gap-6 group hover:border-indigo-200 transition-all cursor-pointer">
            <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center shadow-sm border border-slate-100 group-hover:scale-110 transition-transform">
                <BookOpen className="w-10 h-10 text-indigo-600"/>
            </div>
            <div className="flex-1 text-center md:text-left">
                <div className="flex items-center justify-center md:justify-start gap-2 mb-1">
                    <span className="bg-slate-900 text-white text-[8px] font-black uppercase px-2 py-0.5 rounded-sm">Ad</span>
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Sponsored by Cambridge Press</span>
                </div>
                <h4 className="text-xl font-black text-slate-900 italic tracking-tight">"Get the 2025 WAEC Prep Guide for 20% Less!"</h4>
                <p className="text-xs text-slate-500 font-medium">Download the essential digital library for secondary excellence.</p>
            </div>
            <button className="bg-white border border-slate-200 text-slate-900 px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-900 hover:text-white transition-all shadow-sm flex items-center gap-2">
                Visit Library <ExternalLink className="w-3.5 h-3.5"/>
            </button>
        </div>
    );
};

const INITIAL_QUESTS: Quest[] = [
  { id: 'q1', title: 'Perfect Attendance', description: 'Be present for all classes this week.', reward: 50, category: 'WEEKLY', status: 'CLAIMABLE', progress: 5, target: 5 },
  { id: 'q2', title: 'Library Explorer', description: 'Spend 2 hours reading in the Digital Library.', reward: 25, category: 'DAILY', status: 'AVAILABLE', progress: 45, target: 120 },
  { id: 'q3', title: 'Quiz Master', description: 'Score 100% on 3 subject quizzes.', reward: 100, category: 'ACHIEVEMENT', status: 'AVAILABLE', progress: 1, target: 3 },
  { id: 'q4', title: 'Early Bird', description: 'Log in before 7:45 AM for 3 days.', reward: 30, category: 'WEEKLY', status: 'COMPLETED', progress: 3, target: 3 },
];

const MARKET_ITEMS: MarketItem[] = [
  { id: 'm1', name: 'Professor Nova Plus', description: 'Unlock voice-interactive 1-on-1 tutoring sessions.', price: 500, category: 'TOOLS', iconName: 'zap' },
  { id: 'm2', name: 'WAEC Practice Pack', description: 'Past questions and AI solutions for 10 subjects.', price: 1000, category: 'ACADEMIC', iconName: 'book' },
  { id: 'm3', name: 'Custom Profile Frame', description: 'A gold institutional frame for your dashboard.', price: 250, category: 'BOOSTS', iconName: 'star' },
  { id: 'm4', name: 'Session Booster', description: 'Earn 2x Lams from Farming Mode for 24 hours.', price: 750, category: 'BOOSTS', iconName: 'flame' },
];

export const LamsAdBanner: React.FC<{ onReward: (amt: number) => void }> = ({ onReward }) => {
    const [isWatching, setIsWatching] = useState(false);
    const [progress, setProgress] = useState(0);

    const startAd = () => {
        setIsWatching(true);
        setProgress(0);
    };

    useEffect(() => {
        let interval: any;
        if (isWatching && progress < 100) {
            interval = setInterval(() => {
                setProgress(prev => {
                    if (prev >= 100) {
                        clearInterval(interval);
                        return 100;
                    }
                    return prev + 2;
                });
            }, 100);
        } else if (progress === 100) {
            onReward(5); // Earn 5 Lams for watching
            setIsWatching(false);
            setProgress(0);
            alert("Reward Received: +5 Lams for supporting institutional partners! 🌟");
        }
        return () => clearInterval(interval);
    }, [isWatching, progress]);

    return (
        <div className="bg-gradient-to-r from-indigo-600 to-blue-700 rounded-[2.5rem] p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl relative overflow-hidden group">
            <div className="relative z-10 flex items-center gap-6">
                <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center text-white shadow-xl backdrop-blur-md">
                    {isWatching ? <Loader2 className="w-8 h-8 animate-spin" /> : <PlayCircle className="w-8 h-8" />}
                </div>
                <div>
                    <p className="text-[10px] font-black text-indigo-200 uppercase tracking-widest mb-1">Sponsored by Ndovera Library Mall</p>
                    <h4 className="text-xl font-black text-white italic tracking-tight">"Get 40% off Premium Textbooks today!"</h4>
                    <p className="text-indigo-100/60 text-xs font-medium mt-1">Watch this clip to earn <span className="text-amber-400 font-black">5 Lams</span> instantly.</p>
                </div>
            </div>
            
            <div className="relative z-10 w-full md:w-auto">
                {isWatching ? (
                    <div className="w-full md:w-48 bg-white/10 h-12 rounded-2xl border border-white/10 overflow-hidden relative">
                        <div className="h-full bg-amber-400 transition-all duration-100 ease-linear" style={{ width: `${progress}%` }} />
                        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black uppercase text-white">Viewing Partner Ad...</span>
                    </div>
                ) : (
                    <button 
                        onClick={startAd}
                        className="w-full md:w-auto bg-white text-indigo-600 px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:scale-105 transition-all flex items-center justify-center gap-2"
                    >
                        Watch & Earn <Sparkles className="w-4 h-4 text-amber-500" />
                    </button>
                )}
            </div>

            <Sparkles className="absolute right-[-20px] bottom-[-20px] w-48 h-48 opacity-10 rotate-12 text-white" />
        </div>
    );
};

const QuestCard: React.FC<{ quest: Quest; onClaim: (id: string) => void }> = ({ quest, onClaim }) => {
  const isClaimable = quest.status === 'CLAIMABLE';
  const isCompleted = quest.status === 'COMPLETED';
  const progressPercent = Math.min((quest.progress / quest.target) * 100, 100);

  return (
    <div className={`p-8 rounded-[3rem] border transition-all duration-500 ${isCompleted ? 'bg-slate-50 border-slate-200 opacity-60' : 'bg-white border-slate-100 shadow-xl hover:shadow-2xl hover:translate-y-[-4px]'}`}>
      <div className="flex justify-between items-start mb-6">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner ${isCompleted ? 'bg-slate-200 text-slate-500' : 'bg-indigo-50 text-indigo-600'}`}>
          {isCompleted ? <CheckCircle2 className="w-6 h-6" /> : <Trophy className="w-6 h-6" />}
        </div>
        <div className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${isClaimable ? 'bg-amber-400 text-slate-900 animate-pulse' : 'bg-slate-100 text-slate-400'}`}>
          {quest.category}
        </div>
      </div>
      
      <h5 className={`font-black text-lg uppercase mb-2 tracking-tight ${isCompleted ? 'text-slate-400 line-through' : 'text-slate-900'}`}>{quest.title}</h5>
      <p className="text-sm text-slate-500 font-medium mb-8 leading-relaxed italic">"{quest.description}"</p>
      
      <div className="space-y-4">
        <div className="flex justify-between items-end text-[10px] font-black uppercase tracking-widest">
          <span className="text-slate-400">{isCompleted ? 'Achievement Unlocked' : `${quest.progress} / ${quest.target}`}</span>
          <span className={isCompleted ? 'text-slate-300' : 'text-indigo-600'}>{quest.reward} Lams</span>
        </div>
        <div className="h-3 bg-slate-100 rounded-full overflow-hidden shadow-inner">
          <div 
            className={`h-full transition-all duration-1000 ease-out ${isCompleted ? 'bg-emerald-400' : 'bg-indigo-600'}`} 
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        
        {isClaimable && (
          <button 
            onClick={() => onClaim(quest.id)}
            className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-indigo-100 hover:bg-indigo-700 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3"
          >
            Claim Bounty <Zap className="w-4 h-4 text-amber-400" />
          </button>
        )}

        {isCompleted && (
            <div className="flex items-center justify-center gap-2 text-emerald-600 font-black text-[10px] uppercase py-2">
                <CheckCircle2 className="w-4 h-4" /> Rewards Dispatched
            </div>
        )}
      </div>
    </div>
  );
};

export const FarmingWallet: React.FC<{ 
    wallet: LamsWallet, 
    onToggle: () => void, 
    userAge: number,
    role: UserRole,
    onWithdraw: () => void,
    onUpdateBalance: (amt: number) => void,
    onPurchase: (itemId: string) => void,
    ownedItems: string[]
}> = ({ wallet, onToggle, userAge, role, onWithdraw, onUpdateBalance, onPurchase, ownedItems }) => {
    const [quests, setQuests] = useState<Quest[]>(INITIAL_QUESTS);
    const [purchasingId, setPurchasingId] = useState<string | null>(null);
    
    const is18 = userAge >= 18;
    const isSchool = role === UserRole.SCHOOL_OWNER || role === UserRole.SCHOOL_ADMIN;
    const isWithdrawalDay = new Date().getDate() === 18;

    const handleClaim = (id: string) => {
      const q = quests.find(x => x.id === id);
      if (!q) return;
      onUpdateBalance(q.reward);
      setQuests(prev => prev.map(x => x.id === id ? { ...x, status: 'COMPLETED' } : x));
    };

    const handleBuy = (item: MarketItem) => {
      if (wallet.balance < item.price) {
        alert("Insufficient Lams! You need " + (item.price - wallet.balance) + " more Lams. Complete more quests or view partner ads.");
        return;
      }
      setPurchasingId(item.id);
      setTimeout(() => {
        onUpdateBalance(-item.price);
        onPurchase(item.id);
        setPurchasingId(null);
        alert(`Success! ${item.name} is now active on your account.`);
      }, 1500);
    };

    return (
        <div className="space-y-12 animate-fade-in pb-24">
            {/* Wallet Section */}
            <div className={`p-12 rounded-[4rem] border-4 transition-all duration-700 relative overflow-hidden ${wallet.isFarmingActive ? 'bg-indigo-900 border-indigo-500 text-white shadow-3xl' : 'bg-white border-slate-100 text-slate-900 shadow-2xl'}`}>
                <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-10 mb-16">
                    <div>
                        <p className={`text-[11px] font-black uppercase tracking-[0.5em] mb-4 ${wallet.isFarmingActive ? 'text-indigo-400' : 'text-slate-400'}`}>Institutional Value Portfolio</p>
                        <h3 className="text-7xl font-black italic tracking-tighter flex items-baseline gap-4">
                            {wallet.balance.toLocaleString()} 
                            <span className={`text-2xl not-italic font-black uppercase tracking-widest ${wallet.isFarmingActive ? 'text-amber-400' : 'text-indigo-600'}`}>Lams</span>
                        </h3>
                        <div className="flex items-center gap-3 mt-4">
                            <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase border ${wallet.isFarmingActive ? 'bg-indigo-800/50 border-indigo-700 text-indigo-300' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
                                Market Value: ₦{(wallet.balance * 0.5).toLocaleString()}
                            </div>
                            {wallet.isFarmingActive && (
                                <span className="flex items-center gap-1.5 text-amber-400 text-[10px] font-black uppercase animate-pulse">
                                    <Flame className="w-3 h-3" /> Farming Mode Active
                                </span>
                            )}
                        </div>
                    </div>
                    {role !== UserRole.SUPER_ADMIN && (
                        <button 
                            onClick={onToggle}
                            className={`group relative px-12 py-6 rounded-[2.5rem] font-black text-sm uppercase tracking-widest transition-all hover:scale-105 active:scale-95 shadow-2xl ${wallet.isFarmingActive ? 'bg-amber-400 text-slate-900 shadow-amber-500/20' : 'bg-indigo-600 text-white shadow-indigo-500/20'}`}
                        >
                            <span className="relative z-10">{wallet.isFarmingActive ? 'Suspend Farming' : 'Initiate Farming Mode'}</span>
                            <div className="absolute inset-0 rounded-[2.5rem] bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10">
                    <div className={`p-8 rounded-[3rem] border transition-colors ${wallet.isFarmingActive ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-100'}`}>
                        <p className={`text-[10px] font-black uppercase tracking-widest mb-3 ${wallet.isFarmingActive ? 'text-indigo-300' : 'text-slate-400'}`}>Lifetime Yield</p>
                        <p className="text-3xl font-black italic">{wallet.lifetimeEarned.toLocaleString()}</p>
                    </div>
                    <div className={`p-8 rounded-[3rem] border transition-colors ${wallet.isFarmingActive ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-100'}`}>
                        <p className={`text-[10px] font-black uppercase tracking-widest mb-3 ${wallet.isFarmingActive ? 'text-indigo-300' : 'text-slate-400'}`}>Current Earning Rate</p>
                        <div className="flex items-center gap-3">
                            <p className="text-3xl font-black italic">{wallet.isFarmingActive ? '+12.5' : '0'}</p>
                            <span className="text-[10px] font-bold opacity-60 uppercase">Lams/h</span>
                        </div>
                    </div>
                    <div className={`p-8 rounded-[3rem] border transition-colors ${wallet.isFarmingActive ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-100'}`}>
                        <p className={`text-[10px] font-black uppercase tracking-widest mb-3 ${wallet.isFarmingActive ? 'text-indigo-300' : 'text-slate-400'}`}>Institutional Sync</p>
                        <p className="text-3xl font-black flex items-center gap-2 italic">
                           {is18 || isSchool ? 'Direct Bank' : 'Wallet Only'}
                        </p>
                    </div>
                </div>

                {wallet.isFarmingActive && (
                    <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-white/5 blur-[120px] rounded-full animate-pulse pointer-events-none"></div>
                )}
            </div>

            {/* Ad Reward Section */}
            <LamsAdBanner onReward={onUpdateBalance} />

            {/* Quest Engine Hub */}
            <div className="space-y-10">
              <div className="flex justify-between items-end px-6">
                <div>
                  <h3 className="text-4xl font-black italic tracking-tighter uppercase text-slate-900 leading-none mb-3">Quest Engine</h3>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.3em]">Institutional intelligence rotation</p>
                </div>
                <div className="flex gap-2">
                    <div className="bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                        <Users className="w-3.5 h-3.5"/> 1.2k Active Students
                    </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                {quests.map(q => (
                  <QuestCard key={q.id} quest={q} onClaim={handleClaim} />
                ))}
              </div>
            </div>

            {/* Marketplace Storefront */}
            <div className="space-y-10">
                <div className="bg-slate-950 p-16 rounded-[5rem] text-white relative overflow-hidden shadow-3xl border border-white/5">
                    <div className="relative z-10 space-y-16">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
                          <div className="flex items-center gap-6">
                            <div className="w-20 h-20 bg-amber-400 rounded-3xl flex items-center justify-center text-slate-900 shadow-2xl shadow-amber-400/20 rotate-3">
                                <ShoppingBag className="w-10 h-10"/>
                            </div>
                            <div>
                              <h3 className="text-5xl font-black italic tracking-tighter uppercase leading-none">The Storefront</h3>
                              <p className="text-xs font-bold text-slate-500 uppercase tracking-[0.4em] mt-3 italic">Convert your academic yield into services</p>
                            </div>
                          </div>
                          <div className="bg-white/5 backdrop-blur-xl px-10 py-5 rounded-[2rem] border border-white/10 flex items-center gap-4 shadow-inner">
                            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
                                <Wallet className="w-5 h-5 text-white"/>
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-slate-500 uppercase mb-1">Available Lams</p>
                                <p className="text-3xl font-black italic text-amber-400">{wallet.balance.toLocaleString()}</p>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {MARKET_ITEMS.map(item => {
                                const isOwned = ownedItems.includes(item.id);
                                const isBuying = purchasingId === item.id;
                                
                                return (
                                    <div key={item.id} className="bg-white/5 border border-white/5 p-10 rounded-[4rem] hover:bg-white/[0.08] transition-all group flex flex-col justify-between shadow-xl">
                                        <div className="space-y-8">
                                            <div className="flex justify-between items-start">
                                                <div className="w-20 h-20 bg-indigo-500/20 rounded-[2rem] flex items-center justify-center text-amber-400 shadow-inner group-hover:scale-110 transition-all group-hover:bg-indigo-500/30">
                                                  {item.iconName === 'zap' && <Zap className="w-10 h-10"/>}
                                                  {item.iconName === 'book' && <BookOpen className="w-10 h-10"/>}
                                                  {item.iconName === 'star' && <Star className="w-10 h-10"/>}
                                                  {item.iconName === 'flame' && <Flame className="w-10 h-10"/>}
                                                </div>
                                                <span className="text-[9px] font-black uppercase text-indigo-400 tracking-[0.4em] px-4 py-2 bg-indigo-400/10 rounded-full border border-indigo-400/20">{item.category}</span>
                                            </div>
                                            <div>
                                              <h4 className="text-3xl font-black italic tracking-tighter uppercase">{item.name}</h4>
                                              <p className="text-slate-400 font-medium text-lg leading-relaxed mt-3 italic opacity-80">"{item.description}"</p>
                                            </div>
                                        </div>
                                        
                                        <div className="mt-12 pt-8 border-t border-white/5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-6">
                                          <div className="text-center sm:text-left">
                                            <p className="text-[9px] font-black text-slate-500 uppercase mb-1 tracking-widest">Acquisition Cost</p>
                                            <p className="text-3xl font-black text-amber-400">{item.price} Lams</p>
                                          </div>
                                          
                                          {isOwned ? (
                                            <div className="flex items-center justify-center gap-3 text-emerald-400 font-black text-xs uppercase tracking-widest bg-emerald-400/10 px-10 py-5 rounded-[2rem] border border-emerald-400/20 animate-fade-in">
                                              <CheckCircle2 className="w-5 h-5"/> Service Active
                                            </div>
                                          ) : (
                                            <button 
                                              onClick={() => handleBuy(item)}
                                              disabled={isBuying}
                                              className="relative overflow-hidden group/btn bg-white text-slate-900 px-12 py-6 rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] shadow-2xl hover:bg-amber-400 hover:scale-105 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                                            >
                                              <span className="relative z-10 flex items-center gap-2">
                                                  {isBuying ? <><Loader2 className="w-4 h-4 animate-spin"/> Processing</> : <>Redeem Asset <ArrowRight className="w-4 h-4"/></>}
                                              </span>
                                              <div className="absolute inset-0 bg-gradient-to-r from-amber-400 to-amber-300 opacity-0 group-hover/btn:opacity-100 transition-opacity" />
                                            </button>
                                          )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    <Landmark className="absolute left-[-100px] bottom-[-100px] w-[600px] h-[600px] opacity-[0.02] rotate-[-12deg]" />
                    <Flame className="absolute right-[-60px] top-[-60px] w-[500px] h-[500px] opacity-[0.03] rotate-12"/>
                </div>
            </div>
            
            {/* Cash-Out Protocol Footer */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 bg-white p-12 rounded-[4rem] border border-slate-100 shadow-2xl">
                    <div className="flex justify-between items-start mb-10">
                        <div>
                            <h4 className="text-xl font-black uppercase tracking-widest flex items-center gap-3 italic">
                                <Building2 className="w-8 h-8 text-indigo-600"/> Institutional Settlement
                            </h4>
                            <p className="text-slate-400 font-bold uppercase text-[9px] mt-2 tracking-[0.2em]">Authorized Liquidity Protocol v4.0</p>
                        </div>
                    </div>
                    
                    {(is18 || isSchool) ? (
                        <div className="space-y-8">
                            <div className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-6">
                                <div className="space-y-2 text-center md:text-left">
                                    <div className="flex items-center justify-center md:justify-start gap-2 text-indigo-600 font-black text-xs uppercase tracking-widest">
                                        <Clock className="w-4 h-4"/> 18th of every month
                                    </div>
                                    <p className="text-slate-600 text-lg font-medium italic max-w-sm">Earnings are dispatched to your verified bank account during the standard payout window.</p>
                                </div>
                                <div className="text-center md:text-right">
                                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Estimated Settlement</p>
                                    <p className="text-4xl font-black text-slate-900 italic">₦{(wallet.balance * 0.5).toLocaleString()}</p>
                                </div>
                            </div>
                            <button 
                                disabled={!isWithdrawalDay}
                                onClick={onWithdraw}
                                className={`w-full py-8 rounded-[2rem] font-black text-sm uppercase tracking-[0.3em] transition-all shadow-3xl ${isWithdrawalDay ? 'bg-slate-900 text-white hover:bg-black hover:scale-[1.02]' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
                            >
                                {isWithdrawalDay ? 'Initiate Payout Transfer' : 'Settlement Window Closed'}
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-10">
                            <div className="p-10 bg-amber-50 rounded-[3rem] border border-amber-100 flex flex-col md:flex-row items-center gap-8">
                                <div className="w-20 h-20 bg-amber-400 rounded-[2rem] flex items-center justify-center text-amber-900 shadow-xl shadow-amber-400/20 flex-shrink-0">
                                    <ShieldCheck className="w-10 h-10"/>
                                </div>
                                <div className="space-y-3 text-center md:text-left">
                                    <p className="text-lg font-black text-amber-900 uppercase tracking-tight italic">Minor Custodial Protocol</p>
                                    <p className="text-base text-amber-800 font-medium leading-relaxed opacity-80 italic">"As an underage student, your earnings are held in trust. They can be redeemed for institutional services, fees, or transferred to your verified guardian's wallet."</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <button className="bg-slate-900 text-white py-6 rounded-[2rem] font-black text-xs uppercase tracking-widest shadow-2xl hover:bg-black transition-all">Settle Session Fees</button>
                                <button className="bg-white text-slate-900 py-6 rounded-[2rem] font-black text-xs uppercase tracking-widest border-4 border-slate-100 shadow-xl hover:bg-slate-50 transition-all">Guardian Transfer</button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="bg-indigo-600 p-12 rounded-[4rem] text-white shadow-3xl flex flex-col justify-center items-center text-center space-y-8 relative overflow-hidden group">
                    <div className="relative z-10 space-y-6">
                      <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center mx-auto shadow-2xl backdrop-blur-md group-hover:scale-110 transition-transform">
                        <Landmark className="w-12 h-12 opacity-60"/>
                      </div>
                      <div>
                        <h4 className="text-3xl font-black italic tracking-tighter uppercase leading-none">Security Ledger</h4>
                        <p className="text-indigo-200 text-xs font-black uppercase tracking-[0.2em] mt-4 opacity-60">Verified Audit Trail Active</p>
                      </div>
                      <p className="text-indigo-100 text-base font-medium leading-relaxed italic max-w-xs mx-auto">"Every Lams transaction is cryptographically logged on the Ndovera Ledger for session integrity and fraud prevention."</p>
                    </div>
                    <ShieldCheck className="absolute right-[-40px] bottom-[-40px] w-80 h-80 opacity-5 rotate-12 pointer-events-none"/>
                </div>
            </div>
        </div>
    );
};
