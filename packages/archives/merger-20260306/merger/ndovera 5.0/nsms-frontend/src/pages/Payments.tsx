import React from 'react';
import GlassCard from '../components/GlassCard';

const Payments: React.FC = () => {
  return (
    <div className="dashboard-page">
      <GlassCard title="Payments">
        <p className="text-muted">Track billing cycles, invoices, and payment activity.</p>
      </GlassCard>
    </div>
  );
};

export default Payments;
