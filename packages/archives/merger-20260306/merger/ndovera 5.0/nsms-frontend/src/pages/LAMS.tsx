import React from 'react';
import GlassCard from '../components/GlassCard';

const LAMS: React.FC = () => {
  return (
    <div className="dashboard-page">
      <GlassCard title="LAMS">
        <p className="text-muted">Reward system balances, activity, and settlements.</p>
      </GlassCard>
    </div>
  );
};

export default LAMS;
