import React from 'react';
import GlassCard from '../../components/GlassCard';

const HOSTransport: React.FC = () => {
  return (
    <div className="hos-page">
      <GlassCard title="Transport">
        <p className="text-muted">Route management, fleet approvals, and allocations.</p>
      </GlassCard>
      <div className="hos-tables">
        <div className="card card-tone-1">
          <h3 className="card-title">Fleet Status</h3>
          <ul className="card-list">
            <li>Vehicles active: 12</li>
            <li>Maintenance: 1</li>
            <li>Drivers on duty: 10</li>
          </ul>
        </div>
        <div className="card">
          <h3 className="card-title">Route Coverage</h3>
          <p className="text-muted">Track student allocations and route performance.</p>
        </div>
        <div className="card card-tone-6">
          <h3 className="card-title">Compliance</h3>
          <ul className="card-list">
            <li>Safety checks due: 2</li>
            <li>Insurance renewals: 1</li>
            <li>Incident log: clear</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default HOSTransport;
