import React from 'react';
import GlassCard from '../components/GlassCard';

const Teachers: React.FC = () => {
  return (
    <div className="dashboard-page">
      <GlassCard title="Teachers">
        <p className="text-muted">Track teacher onboarding, performance, and assignments.</p>
      </GlassCard>
    </div>
  );
};

export default Teachers;
