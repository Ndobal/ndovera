import React from 'react';
import GlassCard from '../components/GlassCard';

const Website: React.FC = () => {
  return (
    <div className="dashboard-page">
      <GlassCard title="School Website">
        <p className="text-muted">Design, publish, and manage school public websites.</p>
      </GlassCard>
    </div>
  );
};

export default Website;
