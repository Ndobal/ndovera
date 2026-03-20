import React from "react";

export const ProgressBar = ({ current, total }: { current: number, total: number }) => {
  const percentage = total > 0 ? (current / total) * 100 : 0;
  return (
    <div className="mb-6">
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Progress</span>
        <span className="text-xs font-bold text-emerald-500">{current} / {total} Completed</span>
      </div>
      <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
        <div 
          className="bg-emerald-500 h-full transition-all duration-500" 
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};