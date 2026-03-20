import React from 'react';
import { useData } from '../hooks/useData';

export const ChildPerformanceCard = ({ child }: { child: any }) => {
  const { data: performance } = useData<any>(`/api/students/${child.id}/performance`);

  return (
    <div className="p-4 bg-white/5 rounded-2xl border border-white/5 hover:border-emerald-500/30 transition-all">
      <div className="flex justify-between items-start mb-4">
        <div>
          <p className="text-sm font-bold text-white">{child.name}</p>
          <p className="text-[10px] text-zinc-500 font-bold uppercase">{child.class_name}</p>
        </div>
        <div className="text-right">
          <p className="text-[9px] font-bold text-zinc-500 uppercase">GPA</p>
          <p className="text-sm font-mono font-bold text-emerald-500">{performance?.gpa || '...'}</p>
        </div>
      </div>
      <div className="flex justify-between items-center pt-4 border-t border-white/5">
        <span className="text-[10px] text-zinc-500 font-bold uppercase">Attendance</span>
        <span className="text-[10px] text-white font-bold">{performance?.attendance || '...'}</span>
      </div>
    </div>
  );
};
