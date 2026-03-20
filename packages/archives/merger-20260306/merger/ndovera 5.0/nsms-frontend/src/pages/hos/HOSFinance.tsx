import React from 'react';
import GlassCard from '../../components/GlassCard';

const HOSFinance: React.FC = () => {
  return (
    <div className="hos-page">
      <GlassCard title="Finance">
        <p className="text-muted">Fee collection, approvals, waivers, and finance reporting.</p>
      </GlassCard>
      <div className="hos-tables">
        <div className="card card-tone-3">
          <h3 className="card-title">Fee Collection</h3>
          <ul className="card-list">
            <li>Collected: ₦18.2m</li>
            <li>Outstanding: ₦3.1m</li>
            <li>Payment plans: 24</li>
          </ul>
        </div>
        <div className="card">
          <h3 className="card-title">Waiver Requests</h3>
          <p className="text-muted">Requests waiting for HOS approval.</p>
        </div>
        <div className="card card-tone-1">
          <h3 className="card-title">Financial Reports</h3>
          <ul className="card-list">
            <li>Monthly report ready</li>
            <li>Budget variance: 6%</li>
            <li>Next audit: 30 days</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default HOSFinance;
