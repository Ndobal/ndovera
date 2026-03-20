import React from 'react';
import GlassCard from '../components/GlassCard';

const Students: React.FC = () => {
  return (
    <div className="dashboard-page">
      <GlassCard title="Students">
        <p className="text-muted">Enrollment, guardianship, and performance overview.</p>
      </GlassCard>
    </div>
  );
};

export default Students;
