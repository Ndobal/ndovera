import React from 'react';
import GlassCard from '../components/GlassCard';

const Staff: React.FC = () => {
  return (
    <div className="dashboard-page">
      <GlassCard title="Staff">
        <p className="text-muted">Monitor staff teams, roles, and approvals.</p>
      </GlassCard>
    </div>
  );
};

export default Staff;
