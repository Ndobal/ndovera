import React from 'react';
import GlassCard from '../components/GlassCard';

const Schools: React.FC = () => {
  return (
    <div className="dashboard-page">
      <GlassCard title="Schools">
        <p className="text-muted">Manage all schools under this owner account.</p>
      </GlassCard>
    </div>
  );
};

export default Schools;
