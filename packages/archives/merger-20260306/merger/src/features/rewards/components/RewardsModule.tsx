import React from 'react';
import { Trophy, Cake, Star, Award, Heart, Clock, Sparkles, Wallet, BookOpen } from 'lucide-react';
import { UserRole } from '../../../shared/types';

const MOCK_REWARDS = [
  { id: '1', name: 'Adebayo Samuel', category: 'Academic', reason: 'Top in Mathematics Olympiad', date: '2026-02-24', points: '+50' },
  { id: '2', name: 'Mrs. Janet Okafor', category: 'Punctuality', reason: '100% attendance this month', date: '2026-02-25', points: 'Staff Award' },
  { id: '3', name: 'Chidi Benson', category: 'Behavior', reason: 'Exemplary leadership in JSS3', date: '2026-02-22', points: '+30' },
];

export default function RewardsModule({ role, auras, setAuras }: { role: UserRole; auras: number; setAuras: React.Dispatch<React.SetStateAction<number>> }) {
  const isStudentOrParent = [UserRole.STUDENT, UserRole.PARENT].includes(role);
  
  const spendOptions = [
    { id: 'ai', name: 'Unlock AI Tutor (1 Month)', cost: 500, icon: Sparkles },
    { id: 'tuck', name: 'Tuckshop Voucher (₦1,000)', cost: 300, icon: Wallet },
    { id: 'lib', name: 'Premium Library Access', cost: 200, icon: BookOpen },
  ];

  const handleSpend = (cost: number) => {
    if (auras >= cost) {
      setAuras(prev => prev - cost);
      alert('Purchase successful! Auras deducted.');
    } else {
      alert('Not enough Auras! Keep farming.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Rewards & Birthdays</h2>
          <p className="text-slate-500">Celebrating excellence and milestones in our community.</p>
        </div>
        {[UserRole.PROPRIETOR, UserRole.HOS, UserRole.PRINCIPAL].includes(role) && (
          <button className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-emerald-700 transition-colors flex items-center gap-2">
            <Award className="w-4 h-4" />
            Issue Reward
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-6">Recent Recognitions</h3>
            <div className="space-y-4">
              {MOCK_REWARDS.map((reward) => (
                <div key={reward.id} className="flex items-center justify-between p-4 rounded-xl border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl ${reward.category === 'Academic' ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600' : reward.category === 'Punctuality' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600' : 'bg-amber-50 dark:bg-amber-500/10 text-amber-600'}`}>
                      {reward.category === 'Academic' ? <Star className="w-5 h-5" /> : reward.category === 'Punctuality' ? <Clock className="w-5 h-5" /> : <Heart className="w-5 h-5" />}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 dark:text-slate-100">{reward.name}</h4>
                      <p className="text-xs text-slate-500">{reward.reason}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-emerald-600">{reward.points}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">{reward.date}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-6">Staff of the Month</h3>
            <div className="flex flex-col md:flex-row items-center gap-6 p-6 bg-emerald-50 dark:bg-emerald-500/5 rounded-2xl border border-emerald-100 dark:border-emerald-500/20">
              <img src="https://picsum.photos/seed/staff/150/150" alt="" className="w-32 h-32 rounded-2xl object-cover border-4 border-white dark:border-slate-800 shadow-sm" />
              <div className="text-center md:text-left">
                <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
                  <Trophy className="w-5 h-5 text-emerald-600" />
                  <span className="text-xs font-bold text-emerald-600 uppercase tracking-widest">Excellence Award</span>
                </div>
                <h4 className="text-2xl font-bold text-emerald-900 dark:text-emerald-400">Mr. Emmanuel Ade</h4>
                <p className="text-emerald-700 dark:text-emerald-500/80 font-medium">Secondary Section • Mathematics</p>
                <p className="text-sm text-emerald-600 dark:text-emerald-500 mt-3 italic">"Recognized for exceptional dedication to student success and 100% punctuality."</p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Aura Spending Section (Students/Parents Only) */}
          {isStudentOrParent && (
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center gap-2 mb-6">
                <Sparkles className="w-5 h-5 text-amber-500" />
                <h3 className="font-bold text-slate-800 dark:text-slate-100">Spend Your Auras</h3>
              </div>
              <div className="space-y-3">
                {spendOptions.map((option) => (
                  <button 
                    key={option.id}
                    onClick={() => handleSpend(option.cost)}
                    className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-amber-50 dark:bg-amber-500/10 text-amber-600 rounded-lg">
                        <option.icon className="w-4 h-4" />
                      </div>
                      <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{option.name}</span>
                    </div>
                    <span className="text-xs font-bold text-amber-600 group-hover:scale-110 transition-transform">{option.cost} ✨</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-slate-800 dark:text-slate-100">Birthdays Today</h3>
              <Cake className="w-5 h-5 text-pink-500" />
            </div>
            <div className="space-y-4">
              {[
                { name: 'Adebayo Samuel', role: 'Student', class: 'SS3', img: 'https://picsum.photos/seed/1/40/40' },
                { name: 'Mrs. Janet Okafor', role: 'Teacher', class: 'Primary', img: 'https://picsum.photos/seed/2/40/40' },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-pink-50/50 dark:bg-pink-500/5 border border-pink-100 dark:border-pink-500/20">
                  <img src={item.img} alt="" className="w-10 h-10 rounded-full border-2 border-white dark:border-slate-800" />
                  <div className="flex-1">
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{item.name}</p>
                    <p className="text-xs text-pink-600 dark:text-pink-400 font-medium">{item.role} • {item.class}</p>
                  </div>
                </div>
              ))}
            </div>
            <button className="w-full mt-6 py-3 bg-pink-600 text-white rounded-xl text-sm font-bold hover:bg-pink-700 transition-all shadow-lg shadow-pink-100 dark:shadow-none">
              Broadcast Wishes
            </button>
          </div>

          <div className="bg-slate-900 dark:bg-slate-950 p-6 rounded-2xl text-white border border-slate-800">
            <h3 className="font-bold mb-4">Merit Leaderboard</h3>
            <div className="space-y-4">
              {[
                { name: 'David Kalu', points: 1240 },
                { name: 'Ifeanyi Okafor', points: 1180 },
                { name: 'Sarah Peters', points: 1150 },
              ].map((p, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`w-6 h-6 flex items-center justify-center rounded-full text-[10px] font-bold ${i === 0 ? 'bg-amber-400 text-amber-900' : 'bg-slate-700 text-slate-300'}`}>
                      {i + 1}
                    </span>
                    <span className="text-sm font-medium">{p.name}</span>
                  </div>
                  <span className="text-sm font-bold text-emerald-400">{p.points}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

