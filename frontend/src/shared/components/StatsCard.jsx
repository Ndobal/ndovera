import React from 'react';

export default function StatsCard({ title, value, colorClass, icon }) {
  return (
    <div className={`card-google-${colorClass} glass-surface p-6 rounded-3xl shadow-sm mb-4 flex flex-col items-center justify-center text-center hover:scale-105 transition-transform cursor-pointer`}>
      <span className="micro-label text-slate-500 mb-1">Metric</span>
      <div className="flex items-center justify-center gap-2 mb-2">
        {icon && <span className="text-2xl">{icon}</span>}
        <h3 className="text-header-light text-lg">{title}</h3>
      </div>
      <p className="text-2xl font-bold mono-metric">{value}</p>
    </div>
  );
}
