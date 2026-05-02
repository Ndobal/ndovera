import React from 'react';
import StatsCard from '../shared/components/StatsCard';

export default function DashboardStats() {
  // Example stats, replace with real data later
  const stats = [
    { title: 'Attendance', value: '98%', colorClass: 'blue', icon: '📊' },
    { title: 'Recent Scores', value: 'A+', colorClass: 'green', icon: '🏆' },
    { title: 'Outstanding Fees', value: '₦0', colorClass: 'red', icon: '💸' },
    { title: 'Scholarships', value: '2', colorClass: 'yellow', icon: '🎓' },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 p-8 items-stretch place-items-center">
      {stats.map(stat => (
        <StatsCard key={stat.title} {...stat} />
      ))}
    </div>
  );
}
