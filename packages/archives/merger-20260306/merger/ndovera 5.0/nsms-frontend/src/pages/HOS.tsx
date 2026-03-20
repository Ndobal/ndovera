import React from 'react';
import GlassCard from '../components/GlassCard';

const HOS: React.FC = () => {
  return (
    <div className="dashboard-page">
      <GlassCard title="Head of School">
        <p className="text-muted">Review and assign Head of School roles for each campus.</p>
      </GlassCard>
    </div>
  );
};

export default HOS;
