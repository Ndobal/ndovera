import React from 'react';
import GlassCard from '../components/GlassCard';

const Analytics: React.FC = () => {
  return (
    <div className="dashboard-page">
      <GlassCard title="Analytics">
        <p className="text-muted">KPIs, revenue trends, and operational analytics.</p>
      </GlassCard>
    </div>
  );
};

export default Analytics;
