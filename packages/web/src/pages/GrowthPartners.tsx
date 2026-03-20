import React, { useState } from 'react';
import { 
  TrendingUp, 
  Users, 
  Gift, 
  Share2, 
  Copy, 
  CheckCircle2, 
  Zap, 
  Trophy,
  MessageSquare,
  Facebook,
  Twitter,
  Mail,
  ArrowUpRight,
  Target,
  Coins
} from 'lucide-react';
import { Role, GrowthPartner, AuraTransaction } from '../types';

const MOCK_PARTNER: GrowthPartner = {
  userId: 'u1',
  referralCode: 'NDO-Lagos-001',
  totalReferrals: 12,
  auraBalance: 4500,
  rank: 'Silver'
};

const MOCK_MISSIONS = [
  { id: 'm1', title: 'Invite 3 Parents', reward: 100, progress: 2, total: 3, icon: <Users size={18} /> },
  { id: 'm2', title: 'Refer a School', reward: 2000, progress: 0, total: 1, icon: <TrendingUp size={18} /> },
  { id: 'm3', title: 'Invite 10 Students', reward: 500, progress: 7, total: 10, icon: <Zap size={18} /> }
];

export const GrowthPartnersView = ({ role }: { role: Role }) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'missions' | 'admin'>(role === 'Super Admin' ? 'admin' : 'dashboard');
  const [copied, setCopied] = useState(false);

  // Growth Partners is a global feature — restrict to super roles only
  const allowedRoles: Role[] = ['Ami', 'Super Admin', 'Owner', 'Growth Partner']
  const isAdmin = ['Ami', 'Super Admin', 'Owner'].includes(role)

  if (!allowedRoles.includes(role)) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h3 className="text-lg font-bold text-white">Access Denied</h3>
          <p className="text-sm text-zinc-500">Growth partner access is approval-based. Apply from the public website and approved users get a limited growth-only workspace.</p>
        </div>
      </div>
    )
  }

  const copyRef = () => {
    navigator.clipboard.writeText(MOCK_PARTNER.referralCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">Growth Partners Hub</h2>
          <p className="text-zinc-500 text-xs">Expand the Ndovera network and earn Aura rewards.</p>
        </div>
        <div className="flex gap-2">
          <button className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-emerald-900/20">
            <Share2 size={16} /> Share Ndovera
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card-compact bg-emerald-600 text-white border-0">
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Coins size={20} />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">Aura Balance</span>
          </div>
          <h3 className="text-3xl font-mono font-bold">{MOCK_PARTNER.auraBalance.toLocaleString()}</h3>
          <p className="text-[10px] mt-2 opacity-80 font-medium">≈ ₦{(MOCK_PARTNER.auraBalance * 0.5).toLocaleString()} Naira</p>
        </div>
        <div className="card-compact">
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-500">
              <Users size={20} />
            </div>
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Total Referrals</span>
          </div>
          <h3 className="text-3xl font-mono font-bold text-white">{MOCK_PARTNER.totalReferrals}</h3>
          <p className="text-[10px] mt-2 text-emerald-500 font-bold">+2 this week</p>
        </div>
        <div className="card-compact">
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 bg-purple-500/10 rounded-xl flex items-center justify-center text-purple-500">
              <Trophy size={20} />
            </div>
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Partner Rank</span>
          </div>
          <h3 className="text-3xl font-bold text-white">{MOCK_PARTNER.rank}</h3>
          <p className="text-[10px] mt-2 text-zinc-500">Next Rank: Gold (8 more referrals)</p>
        </div>
        <div className="card-compact">
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 bg-orange-500/10 rounded-xl flex items-center justify-center text-orange-500">
              <TrendingUp size={20} />
            </div>
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Viral Coeff.</span>
          </div>
          <h3 className="text-3xl font-mono font-bold text-white">1.42</h3>
          <p className="text-[10px] mt-2 text-emerald-500 font-bold">Exponential Growth</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/5 p-1 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'dashboard' ? 'bg-emerald-600 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
          My Dashboard
        </button>
        <button
          onClick={() => setActiveTab('missions')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'missions' ? 'bg-emerald-600 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
          Viral Missions
        </button>
        {isAdmin && (
          <button
            onClick={() => setActiveTab('admin')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'admin' ? 'bg-emerald-600 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            Viral Analytics
          </button>
        )}
      </div>

      {activeTab === 'dashboard' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Referral Card */}
          <div className="lg:col-span-2 space-y-6">
            <div className="card-compact p-8 bg-linear-to-br from-[#151619] to-black border-white/5 relative overflow-hidden">
              <div className="relative z-10">
                <h3 className="text-2xl font-bold text-white mb-2">Your Referral Engine</h3>
                <p className="text-zinc-500 text-sm mb-8">Share your unique code to invite schools, parents, and teachers.</p>
                
                <div className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/10">
                  <div className="flex-1">
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Referral Code</p>
                    <p className="text-xl font-mono font-bold text-emerald-500">{MOCK_PARTNER.referralCode}</p>
                  </div>
                  <button 
                    onClick={copyRef}
                    className="p-4 bg-white/5 hover:bg-white/10 rounded-xl text-zinc-400 hover:text-white transition-all"
                  >
                    {copied ? <CheckCircle2 className="text-emerald-500" /> : <Copy />}
                  </button>
                </div>

                <div className="grid grid-cols-4 gap-4 mt-8">
                  {[
                    { icon: <MessageSquare size={20} />, label: 'WhatsApp', color: 'bg-green-600' },
                    { icon: <Facebook size={20} />, label: 'Facebook', color: 'bg-blue-600' },
                    { icon: <Twitter size={20} />, label: 'Twitter', color: 'bg-sky-500' },
                    { icon: <Mail size={20} />, label: 'Email', color: 'bg-zinc-700' },
                  ].map((social) => (
                    <button key={social.label} className="flex flex-col items-center gap-2 group">
                      <div className={`w-12 h-12 ${social.color} rounded-2xl flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-all`}>
                        {social.icon}
                      </div>
                      <span className="text-[10px] font-bold text-zinc-500 uppercase">{social.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-600/10 blur-[100px] -z-0" />
            </div>

            {/* Recent Activity */}
            <div className="card-compact">
              <h3 className="text-sm font-bold text-white mb-6">Recent Rewards</h3>
              <div className="space-y-4">
                {[
                  { desc: 'Referral: St. Marys School', amount: 2000, time: '2 hours ago' },
                  { desc: 'Mission: Invite 3 Parents', amount: 100, time: '1 day ago' },
                  { desc: 'Referral: Mr. Ibrahim (Teacher)', amount: 100, time: '3 days ago' },
                ].map((tx, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition-all">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center text-emerald-500">
                        <Gift size={16} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white">{tx.desc}</p>
                        <p className="text-[10px] text-zinc-500">{tx.time}</p>
                      </div>
                    </div>
                    <span className="text-xs font-mono font-bold text-emerald-500">+{tx.amount} Auras</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Viral Loop Info */}
          <div className="space-y-6">
            <div className="card-compact bg-blue-600/5 border-blue-500/10">
              <h3 className="text-xs font-bold uppercase tracking-widest text-blue-500 mb-4">The Viral Loop</h3>
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-[10px] font-bold text-white">1</div>
                  <p className="text-xs text-zinc-400 leading-relaxed">Invite a school to join Ndovera.</p>
                </div>
                <div className="flex gap-3">
                  <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-[10px] font-bold text-white">2</div>
                  <p className="text-xs text-zinc-400 leading-relaxed">The school invites 500+ parents automatically.</p>
                </div>
                <div className="flex gap-3">
                  <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-[10px] font-bold text-white">3</div>
                  <p className="text-xs text-zinc-400 leading-relaxed">Parents invite other parents to see results.</p>
                </div>
                <div className="flex gap-3">
                  <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-[10px] font-bold text-white">4</div>
                  <p className="text-xs text-zinc-400 leading-relaxed">You earn Aura rewards for every new user.</p>
                </div>
              </div>
            </div>

            <div className="card-compact border-dashed border-white/10 flex flex-col items-center justify-center text-center py-12">
              <Target size={32} className="text-zinc-700 mb-4" />
              <h4 className="text-sm font-bold text-zinc-400">Next Milestone</h4>
              <p className="text-[10px] text-zinc-600 mt-1">Refer 2 more schools to unlock Gold status.</p>
              <div className="w-full h-1 bg-white/5 rounded-full mt-4 overflow-hidden">
                <div className="h-full bg-emerald-500 w-[60%]" />
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'missions' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {MOCK_MISSIONS.map((mission) => (
            <div key={mission.id} className="card-compact group hover:border-emerald-500/30 transition-all">
              <div className="flex items-center justify-between mb-6">
                <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-emerald-500 group-hover:bg-emerald-600 group-hover:text-white transition-all">
                  {mission.icon}
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Reward</p>
                  <p className="text-lg font-mono font-bold text-emerald-500">{mission.reward} Auras</p>
                </div>
              </div>
              <h3 className="text-sm font-bold text-white mb-2">{mission.title}</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
                  <span className="text-zinc-500">Progress</span>
                  <span className="text-white">{mission.progress} / {mission.total}</span>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-emerald-500 transition-all duration-500" 
                    style={{ width: `${(mission.progress / mission.total) * 100}%` }}
                  />
                </div>
              </div>
              <button className="mt-6 w-full bg-white/5 hover:bg-white/10 text-white py-3 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all">
                View Details
              </button>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'admin' && isAdmin && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="card-compact">
              <h4 className="text-xs font-bold text-zinc-500 uppercase mb-4">Viral Growth Curve</h4>
              <div className="h-48 flex items-end gap-2">
                {[20, 35, 25, 45, 60, 85, 100].map((h, i) => (
                  <div key={i} className="flex-1 bg-emerald-500/20 rounded-t-lg relative group">
                    <div 
                      className="absolute bottom-0 left-0 right-0 bg-emerald-500 rounded-t-lg transition-all duration-1000"
                      style={{ height: `${h}%` }}
                    />
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-zinc-800 text-white text-[8px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-all">
                      {h}%
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-between mt-4 text-[8px] font-bold text-zinc-600 uppercase tracking-widest">
                <span>Jan</span>
                <span>Feb</span>
                <span>Mar</span>
                <span>Apr</span>
                <span>May</span>
                <span>Jun</span>
                <span>Jul</span>
              </div>
            </div>

            <div className="card-compact md:col-span-2">
              <h4 className="text-xs font-bold text-zinc-500 uppercase mb-6">Top Growth Partners</h4>
              <div className="space-y-4">
                {[
                  { name: 'Lagos Education Hub', referrals: 142, aura: '284k', rank: 'Platinum' },
                  { name: 'Abuja Schools Network', referrals: 98, aura: '196k', rank: 'Gold' },
                  { name: 'Port Harcourt Partners', referrals: 64, aura: '128k', rank: 'Gold' },
                ].map((partner, i) => (
                  <div key={i} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white font-bold">
                        {i + 1}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white">{partner.name}</p>
                        <p className="text-[10px] text-zinc-500">{partner.rank} Partner</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-8">
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-zinc-500 uppercase">Referrals</p>
                        <p className="text-sm font-bold text-white">{partner.referrals}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-zinc-500 uppercase">Aura Earned</p>
                        <p className="text-sm font-bold text-emerald-500">{partner.aura}</p>
                      </div>
                      <button className="p-2 text-zinc-600 hover:text-white transition-colors">
                        <ArrowUpRight size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
