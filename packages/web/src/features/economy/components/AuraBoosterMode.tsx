import React, { useState } from 'react';
import { Zap, Coins, Clock, BookOpen, ShieldCheck, ToggleLeft, ToggleRight, Sparkles, Server, TrendingUp, TrendingDown, Vault, Activity } from 'lucide-react';

const DEFAULT_RECENT_DROPS = {
  student: [
    { id: 1, type: 'Practice', text: 'Completed JSS1 Math Practice', auras: '+15', time: '10 mins ago' },
    { id: 2, type: 'Reading', text: 'Read Note: Intro to Ecology', auras: '+5', time: '2 hours ago' },
    { id: 3, type: 'Revision', text: 'Submitted English take-home revision', auras: '+8', time: 'Today' },
  ],
  staff: [
    { id: 1, type: 'Lesson', text: 'Published Mathematics lesson note', auras: '+20', time: '25 mins ago' },
    { id: 2, type: 'Mentoring', text: 'Reviewed 18 student submissions', auras: '+12', time: '2 hours ago' },
    { id: 3, type: 'Leadership', text: 'Approved timetable adjustment', auras: '+9', time: 'Today' },
  ],
  partner: [
    { id: 1, type: 'Referral', text: 'School partnership follow-up completed', auras: '+30', time: '1 hour ago' },
    { id: 2, type: 'Campaign', text: 'Regional awareness drive delivered', auras: '+18', time: 'Today' },
    { id: 3, type: 'Lead', text: 'Qualified new school lead', auras: '+24', time: 'Today' },
  ],
};

export const AuraBoosterMode = ({ role }: { role: string }) => {
  const isMainSuperAdmin = role === 'Main Super Admin';
  const isSystemAdmin = role === 'Super Admin' || role === 'System Admin' || isMainSuperAdmin;
  const isSchoolOwner = ['Owner', 'HOS', 'School Admin'].includes(role);
  const isStaff = ['Teacher', 'Staff', 'Educator'].includes(role);
  const isGrowthPartner = role === 'Growth Partner';
  const isStudent = role === 'Student' || (!isSystemAdmin && !isSchoolOwner && !isStaff && !isGrowthPartner);

  // Student/Teacher User State
  const [userEnabled, setUserEnabled] = useState(false);
  const [balance, setBalance] = useState(1250); // Mock personal balance
  
  // Super Admin State - System Admin Vault Farming
  const [adminVaultActive, setAdminVaultActive] = useState(false);

  const roleDropKey = isStudent ? 'student' : isGrowthPartner ? 'partner' : 'staff';
  const recentDrops = (() => {
    try {
      const raw = localStorage.getItem('ndovera_recent_drop_rules');
      if (!raw) return DEFAULT_RECENT_DROPS[roleDropKey];
      const parsed = JSON.parse(raw);
      const custom = parsed?.[roleDropKey];
      return Array.isArray(custom) && custom.length ? custom : DEFAULT_RECENT_DROPS[roleDropKey];
    } catch {
      return DEFAULT_RECENT_DROPS[roleDropKey];
    }
  })();

  if (isSystemAdmin) {
    return (
      <div className="space-y-6 animate-in fade-in zoom-in duration-200">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Vault className="text-purple-500" />
            Super Admin Economy & Vault
          </h2>
          <p className="text-zinc-400 text-sm mt-1">Platform-wide ad metrics, outlier monitoring, and the System Admin Vault.</p>
        </div>

        {isMainSuperAdmin && (
          <div className="bg-[#151619] border border-blue-500/20 rounded-2xl p-6 md:p-8 relative overflow-hidden">
            <div className="absolute right-0 top-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
            <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div>
                <h3 className="text-xl font-bold text-blue-400 flex items-center gap-2 mb-2"><Server /> System Growth Reserve (Main Admin Only)</h3>
                <p className="text-sm text-zinc-400 max-w-xl mb-4">You are viewing the Main System Super Admin reserve. 15% of all Auras earned by assigned Super Admins and System Admins across the platform are silently reserved here to ensure the system consistently grows its own operational funds.</p>
                <p className="text-xs text-blue-500/80 font-bold uppercase tracking-widest mb-1">Total Silent System Reserve</p>
                <p className="text-3xl font-black text-blue-400">2,450,800 <span className="text-lg">AURAS</span></p>
              </div>
              <button className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-lg shadow-blue-900/20 font-bold transition-transform active:scale-95 shrink-0">
                Allocate Core Funds
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between bg-purple-500/10 border border-purple-500/20 rounded-2xl p-4 md:p-6 mb-2">
          <div>
            <p className="text-xs text-purple-400/80 font-bold uppercase tracking-widest mb-1">Your Admin Yields Wallet</p>
            <p className="text-2xl font-black text-purple-400">145,200 Auras</p>
          </div>
          <button className="px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl shadow-lg shadow-purple-900/20 font-bold text-sm transition-transform active:scale-95">
            Cashout Admin Earnings
          </button>
        </div>

        {/* Top Down Institutional Insight */}
        <div className="bg-[#151619] border border-white/5 rounded-2xl p-6">
          <h3 className="text-xl font-bold text-white mb-4">Top-Down Institutional Insight</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-zinc-400 border-collapse">
              <thead className="text-xs uppercase bg-black/30 text-zinc-500">
                <tr>
                  <th className="px-4 py-3 rounded-tl-lg">School Name</th>
                  <th className="px-4 py-3">Total Auras Mined</th>
                  <th className="px-4 py-3 rounded-tr-lg">Ad Impressions</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-white/5">
                  <td className="px-4 py-3 text-white font-medium">Lagos State Model College</td>
                  <td className="px-4 py-3 font-mono text-emerald-400">452,000</td>
                  <td className="px-4 py-3 font-mono">12,500</td>
                </tr>
                <tr className="border-none">
                  <td className="px-4 py-3 text-white font-medium">Ahmadu Bello Academy</td>
                  <td className="px-4 py-3 font-mono text-emerald-400">372,000</td>
                  <td className="px-4 py-3 font-mono">9,200</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Global User Outliers */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-[#151619] border border-emerald-500/10 rounded-2xl p-6 relative overflow-hidden">
            <div className="absolute right-0 top-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none"></div>
            <div className="flex items-center gap-3 mb-2 relative z-10">
              <TrendingUp className="text-emerald-500" />
              <h3 className="text-lg font-bold text-white">Top Active User</h3>
            </div>
            <p className="text-sm text-zinc-400 mb-1 relative z-10">Highest activity. Target for academic year-end rewards.</p>
            <div className="bg-black/40 p-3 rounded-lg border border-emerald-500/20 mt-3 relative z-10">
              <p className="font-mono text-emerald-400 font-bold">@sarah_genius_01</p>
              <p className="text-xs text-zinc-500 mt-1">Lagos State Model College • <span className="text-emerald-500/80 font-bold">85,200 Auras</span></p>
            </div>
          </div>
          <div className="bg-[#151619] border border-red-500/10 rounded-2xl p-6 relative overflow-hidden">
            <div className="absolute right-0 top-0 w-32 h-32 bg-red-500/5 rounded-full blur-2xl pointer-events-none"></div>
            <div className="flex items-center gap-3 mb-2 relative z-10">
              <TrendingDown className="text-red-500" />
              <h3 className="text-lg font-bold text-white">Lowest Active User</h3>
            </div>
            <p className="text-sm text-zinc-400 mb-1 relative z-10">Flagged to contact school/user for reasons and improvement.</p>
            <div className="bg-black/40 p-3 rounded-lg border border-red-500/20 mt-3 relative z-10">
              <p className="font-mono text-red-400 font-bold">@john_doe_99</p>
              <p className="text-xs text-zinc-500 mt-1">Ahmadu Bello Academy • <span className="text-red-500/80 font-bold">120 Auras</span></p>
            </div>
          </div>
        </div>

        {/* Super Admin Vault Farming */}
        <div className="bg-linear-to-br from-[#1a1025] to-[#151619] border border-purple-500/20 rounded-2xl p-6 relative overflow-hidden mt-6">
          <div className="absolute right-0 top-0 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl pointer-events-none"></div>
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 relative z-10">
            <div>
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Server className="text-purple-500" />
                System Admin Ad Vault
              </h3>
              <p className="text-sm text-purple-300/60 mt-1 max-w-xl">
                High-yield server monitoring interspersed with premium ad farming. Displays 5 ads with 7-minute cooling intervals to maximize platform revenue and admin yields.
              </p>
            </div>
            <button onClick={() => setAdminVaultActive(!adminVaultActive)} className="text-4xl text-purple-500 transition-transform hover:scale-105 active:scale-95 shrink-0">
              {adminVaultActive ? <ToggleRight className="text-purple-500 fill-purple-500/20" size={56} /> : <ToggleLeft className="text-zinc-600" size={56} />}
            </button>
          </div>

          {adminVaultActive && (
            <div className="space-y-4 animate-in fade-in relative z-10">
              <div className="bg-[#0a0510] border py-4 px-5 border-purple-500/30 rounded-xl font-mono text-xs text-purple-400 flex flex-col gap-3 shadow-inner">
                <p className="text-purple-500 font-bold">{'>'} INITIALIZING SYSTEM MONITORING TOOLS... OK</p>
                <p>{'>'} STATUS: ALL CLUSTERS ONLINE.</p>
                <p className="text-zinc-500 mt-2">{'>'} INJECTING HIGH-YIELD SPONSOR BATCH...</p>
                
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2 my-2">
                  {[1,2,3,4,5].map(i => (
                    <div key={i} className="h-24 bg-purple-900/20 border border-purple-500/30 rounded flex flex-col items-center justify-center text-purple-300/50 relative overflow-hidden group hover:border-purple-400/50 transition-colors">
                      <span className="text-[10px] uppercase font-bold text-purple-500/50">Sponsor Slot {i}</span>
                      <span className="text-sm font-black text-purple-400 mt-1">+100</span>
                    </div>
                  ))}
                </div>
                
                <p className="text-emerald-400 font-bold">{'>'} BATCH YIELD GENERATED: +500 AURAS FOR PLATFORM / ADMIN</p>
                <p className="text-zinc-500 flex items-center gap-2">
                  <Clock size={12}/> {'>'} WAITING 07:00 FOR NEXT BATCH
                </p>
              </div>
              
              <div className="mt-6 border-t border-purple-500/10 pt-6">
                <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2 uppercase tracking-widest"><Activity size={16} className="text-purple-500"/> Live System Admins Tracking</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center justify-between bg-black/40 p-3 rounded-lg border border-purple-500/10">
                    <span className="text-sm text-zinc-300 font-mono">sysadmin_root</span>
                    <span className="text-xs text-emerald-400 font-bold flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> FARMING</span>
                  </div>
                  <div className="flex items-center justify-between bg-black/40 p-3 rounded-lg border border-purple-500/10">
                    <span className="text-sm text-zinc-300 font-mono">sysadmin_beta</span>
                    <span className="text-xs text-zinc-500 font-bold">IDLE</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (isSchoolOwner) {
    return (
      <div className="space-y-6 animate-in fade-in zoom-in duration-200">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2">
            <Coins className="text-emerald-500" />
            Projected Institution Revenue
          </h2>
          <p className="text-zinc-400 text-sm mt-1">Manage your school's structural payout from user yields.</p>
        </div>

        <div className="bg-[#151619] border border-white/5 rounded-2xl p-6 md:p-8 relative overflow-hidden">
          <div className="absolute right-0 top-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
          
          <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest mb-2">Your 10% Cut (Institution Share)</p>
              <p className="text-4xl md:text-6xl font-black text-emerald-400 mb-2 font-mono">₦154,500<span className="text-xl md:text-3xl text-emerald-600">.00</span></p>
              <p className="text-sm text-zinc-400 max-w-lg mt-4">
                <span className="text-emerald-400 font-bold flex items-center gap-1 mb-1"><ShieldCheck size={14}/> Silent Extraction System</span>
                NDOVERA silently reserves 10% from all Auras actively mined by Staff and Students under your school's network. This builds your institution's revenue in the background without affecting their visible dashboard earnings.
              </p>
            </div>
            
            <button className="px-6 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition-transform active:scale-95 shadow-lg shadow-emerald-900/20 shrink-0">
              Cashout Funds to Bank
            </button>
          </div>
        </div>
      </div>
    );
  }

  // STANDARD VIEW FOR STAFF, STUDENTS, AND GROWTH PARTNERS
  return (
    <div className="space-y-6 animate-in fade-in zoom-in duration-200">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Zap className="text-yellow-500" />
            Aura Booster Mode & Economy
          </h2>
          <p className="text-zinc-400 text-sm mt-1">
            {isGrowthPartner ? "Boost your Auras for Extra Incentives." : "Farm Auras by opting into safe, educational sponsored content while you learn or teach."}
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl justify-center min-w-50">
            <Coins className="text-yellow-500" size={20} />
            <div className="flex flex-col">
              <span className="text-[10px] text-yellow-500/80 uppercase font-bold tracking-wider leading-none">Wallet Balance</span>
              <span className="text-lg font-black text-yellow-500 leading-none mt-0.5">{balance.toLocaleString()} Auras</span>
            </div>
          </div>
          
          {isStaff && (
            <button className="w-full sm:w-auto px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-900/20 font-bold text-sm transition-transform active:scale-95 shrink-0 whitespace-nowrap">
              Cashout Educentives
            </button>
          )}
          {isGrowthPartner && (
            <button className="w-full sm:w-auto px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-lg shadow-blue-900/20 font-bold text-sm transition-transform active:scale-95 shrink-0 whitespace-nowrap">
              Cashout Extra Incentives
            </button>
          )}
          {isStudent && (
            <div className="w-full sm:w-auto px-4 py-3 bg-black/40 text-zinc-500 border border-zinc-800 rounded-xl font-bold text-sm text-center shrink-0 cursor-not-allowed hidden sm:block">
              Student Bursary Disabled
            </div>
          )}
        </div>
      </div>

      {isStudent && (
         <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 text-sm text-zinc-400">
            <span className="font-bold text-zinc-300">Note:</span> Students cannot cashout their bursary at this time. However, if your school accepts it, you can actually use your Auras to pay for school services like the tuckshop, fines, etc.
         </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Main Toggle */}
          <div className="bg-linear-to-br from-[#1a1c23] to-[#151619] border border-white/10 rounded-2xl p-6 md:p-8 relative overflow-hidden">
            <div className="absolute right-0 top-0 w-64 h-64 bg-yellow-500/10 rounded-full blur-3xl pointer-events-none"></div>
            
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
              <div className="max-w-md">
                <h3 className="text-xl font-bold text-white mb-2">Activate Economy Booster</h3>
                <p className="text-sm text-zinc-400">
                  By turning this on, discreet educational content banners will display securely across non-exam pages. In exchange, your views and specific study milestones passively mine Auras directly to your wallet!
                </p>
              </div>
              <button onClick={() => setUserEnabled(!userEnabled)} className="text-4xl text-yellow-500 transition-transform hover:scale-105 active:scale-95 shrink-0">
                {userEnabled ? <ToggleRight className="text-yellow-500 fill-yellow-500/20" size={56} /> : <ToggleLeft className="text-zinc-600" size={56} />}
              </button>
            </div>
          </div>

          {/* Ad Simulation Block (When Active) */}
          {userEnabled && (
            <div className="bg-[#0a0b0d] border-2 border-dashed border-yellow-500/30 rounded-2xl p-4 animate-in fade-in slide-in-from-bottom-4">
              <div className="flex items-center justify-between mb-3 px-2">
                <span className="text-xs font-bold text-yellow-500 uppercase tracking-widest flex items-center gap-1">
                  <Sparkles size={12}/> Live Booster Active
                </span>
                <span className="text-xs text-zinc-500">Sponsored Content Feed</span>
              </div>
              <div className="bg-[#151619] p-6 rounded-xl border border-white/5 flex flex-col sm:flex-row items-center gap-6">
                <div className="w-24 h-24 bg-linear-to-tr from-emerald-600 to-green-600 rounded-2xl flex items-center justify-center shrink-0">
                  <TrendingUp className="text-white opacity-50" size={40} />
                </div>
                <div>
                  <h4 className="text-white font-bold text-lg">Growth Partner Opportunities</h4>
                  <p className="text-zinc-400 text-sm mt-1 mb-3">Connect with Ndovera's growth partners for exclusive rewards.</p>
                  <button className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-bold transition-transform active:scale-95" onClick={() => window.location.href='/growth'}>
                    Connect & Earn +20 Auras
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Ledger */}
        <div className="bg-[#151619] border border-white/5 rounded-2xl p-5 flex flex-col">
          <h3 className="text-sm font-bold tracking-widest text-zinc-400 uppercase mb-4 flex items-center gap-2">
            <Clock size={16} /> Recent Drops
          </h3>
          
          <div className="space-y-3 flex-1">
            {recentDrops.map(drop => (
              <div key={drop.id} className="bg-black/30 rounded-xl p-3 border border-white/5 flex items-center justify-between group hover:border-yellow-500/20 transition-all">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-yellow-500/10 flex items-center justify-center">
                    <Zap size={14} className="text-yellow-500" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-zinc-200">{drop.text}</p>
                    <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">{drop.time}</p>
                  </div>
                </div>
                <span className="text-sm font-black text-emerald-400">{drop.auras}</span>
              </div>
            ))}
          </div>

          <button className="w-full mt-4 py-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-xs font-bold uppercase tracking-widest text-zinc-300 transition-colors" onClick={() => window.location.href='/aurabooster-ledger'}>
            View Full Ledger
          </button>
        </div>
      </div>
    </div>
  );
};