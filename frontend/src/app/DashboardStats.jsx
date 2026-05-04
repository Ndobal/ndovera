import React from 'react';
import StatsCard from '../shared/components/StatsCard';

export default function DashboardStats() {
  const stats = [];

  return (
    <div className="p-8">
      {stats.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch place-items-center">
          {stats.map(stat => (
            <StatsCard key={stat.title} {...stat} />
          ))}
        </div>
      ) : (
        <div className="glass-surface rounded-3xl border border-white/10 p-6 text-center">
          <p className="micro-label accent-amber">Live metrics unavailable</p>
          <p className="mt-2 text-slate-200">Dashboard statistics will appear when live attendance, assessment, and billing feeds are available.</p>
        </div>
      )}
    </div>
  );
}
