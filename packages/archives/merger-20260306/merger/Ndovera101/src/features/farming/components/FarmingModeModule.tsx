import React from 'react';
import { Star, ShoppingCart, Trophy } from 'lucide-react';

// Mock data for demonstration
const farmPlots = [
  { id: 1, crop: 'Corn', stage: 4, grown: true },
  { id: 2, crop: 'Tomato', stage: 3, grown: false },
  { id: 3, crop: 'Carrot', stage: 5, grown: true },
  { id: 4, crop: 'Empty', stage: 0, grown: false },
  { id: 5, crop: 'Wheat', stage: 2, grown: false },
  { id: 6, crop: 'Empty', stage: 0, grown: false },
];

const leaderboard = [
  { rank: 1, name: 'Mr. Adekunle', points: 1250, school: 'Top Scholars Academy' },
  { rank: 2, name: 'Mrs. Eze', points: 1180, school: 'Bright Future High' },
  { rank: 3, name: 'You', points: 1150, school: 'Your School' },
  { rank: 4, name: 'Ms. Folake', points: 1120, school: 'Your School' },
];

const storeItems = [
  { id: 'item1', name: 'Box of Chalk', cost: 50 },
  { id: 'item2', name: 'Whiteboard Markers', cost: 75 },
  { id: 'item3', name: 'Online Course Coupon', cost: 500 },
  { id: 'item4', name: 'Projector Rental (1 day)', cost: 1000 },
];

const CropVisual = ({ crop }) => {
  if (crop === 'Empty') {
    return <div className="w-12 h-12 bg-yellow-900/50 border-2 border-dashed border-yellow-700 rounded-full"></div>;
  }

  const cropEmoji = {
    'Corn': '🌽',
    'Tomato': '🍅',
    'Carrot': '🥕',
    'Wheat': '🌾',
  };

  return (
    <div className="text-4xl transform transition-transform duration-500 hover:scale-125">
      {cropEmoji[crop] || '🌱'}
    </div>
  );
};

export default function FarmingModeModule() {
  const userAuras = 1150; // Mock data

  return (
    <div className="p-6 bg-slate-900 text-white h-full overflow-y-auto rounded-2xl">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Main Farm View */}
        <div className="lg:col-span-2 bg-green-900/20 border border-green-700/50 p-6 rounded-2xl">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-green-300">My Farm</h2>
            <div className="flex items-center gap-2 text-yellow-400 bg-yellow-500/10 px-3 py-1 rounded-full">
              <Star className="w-5 h-5" />
              <span className="font-bold text-lg">{userAuras} Auras</span>
            </div>
          </div>
          <p className="text-sm text-green-400 mb-6">Complete tasks to grow your farm and earn more Auras.</p>
          
          <div className="grid grid-cols-3 gap-4 p-4 bg-yellow-900/30 rounded-lg">
            {farmPlots.map(plot => (
              <div key={plot.id} className="aspect-square bg-yellow-800/50 rounded-lg flex flex-col items-center justify-center p-2 text-center">
                <CropVisual crop={plot.crop} />
                <p className="text-xs font-bold mt-2 text-yellow-200">{plot.crop}</p>
                {plot.crop !== 'Empty' && <p className="text-[10px] text-yellow-400">{plot.grown ? 'Harvest Ready' : `Stage ${plot.stage}/5`}</p>}
              </div>
            ))}
          </div>
        </div>

        {/* Redemption Store */}
        <div className="bg-sky-900/20 border border-sky-700/50 p-6 rounded-2xl">
          <h3 className="text-xl font-bold text-sky-300 mb-4 flex items-center gap-2"><ShoppingCart className="w-5 h-5"/> Redemption Store</h3>
          <div className="space-y-3">
            {storeItems.map(item => (
              <div key={item.id} className="bg-slate-800/50 p-3 rounded-lg flex justify-between items-center">
                <div>
                  <p className="font-semibold text-slate-200 text-sm">{item.name}</p>
                </div>
                <button className="flex items-center gap-1 text-xs bg-sky-600 hover:bg-sky-700 text-white font-bold px-3 py-1 rounded-full disabled:bg-slate-600" disabled={userAuras < item.cost}>
                  <Star className="w-3 h-3"/> {item.cost}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Leaderboard */}
        <div className="lg:col-span-3 bg-purple-900/20 border border-purple-700/50 p-6 rounded-2xl">
          <h3 className="text-xl font-bold text-purple-300 mb-4 flex items-center gap-2"><Trophy className="w-5 h-5"/> Leaderboard</h3>
          <div className="space-y-2">
            {leaderboard.map(entry => (
              <div key={entry.rank} className={`p-3 rounded-lg flex items-center gap-4 ${entry.name === 'You' ? 'bg-purple-600/50 border-2 border-purple-400' : 'bg-slate-800/50'}`}>
                <div className="font-bold text-lg w-8 text-center">{entry.rank}</div>
                <div className="flex-1">
                  <p className="font-bold text-slate-100">{entry.name}</p>
                  <p className="text-xs text-slate-400">{entry.school}</p>
                </div>
                <div className="font-bold text-yellow-400">{entry.points} Auras</div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
