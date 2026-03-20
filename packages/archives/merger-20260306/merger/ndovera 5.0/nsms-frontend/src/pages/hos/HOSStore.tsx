import React from 'react';
import GlassCard from '../../components/GlassCard';

const HOSStore: React.FC = () => {
  return (
    <div className="hos-page">
      <GlassCard title="Store">
        <p className="text-muted">Supplies procurement, stock levels, and approvals.</p>
      </GlassCard>
      <div className="hos-tables">
        <div className="card card-tone-6">
          <h3 className="card-title">Procurement Queue</h3>
          <ul className="card-list">
            <li>7 purchase requests pending</li>
            <li>2 vendor approvals</li>
            <li>Next batch: Tuesday</li>
          </ul>
        </div>
        <div className="card">
          <h3 className="card-title">Stock Levels</h3>
          <p className="text-muted">Consumables and supplies critical list.</p>
        </div>
        <div className="card card-tone-1">
          <h3 className="card-title">Budget Status</h3>
          <ul className="card-list">
            <li>Monthly cap: ₦1.5m</li>
            <li>Committed: ₦820k</li>
            <li>Remaining: ₦680k</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default HOSStore;
