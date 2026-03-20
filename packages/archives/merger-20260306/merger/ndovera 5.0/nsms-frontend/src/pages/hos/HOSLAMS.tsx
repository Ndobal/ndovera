import React from 'react';
import GlassCard from '../../components/GlassCard';

const HOSLAMS: React.FC = () => {
  return (
    <div className="hos-page">
      <GlassCard title="LAMS">
        <p className="text-muted">Monitor LAMS usage, withdrawals, and economy health.</p>
      </GlassCard>
      <div className="hos-tables">
        <div className="card card-tone-6">
          <h3 className="card-title">LAMS Wallet</h3>
          <ul className="card-list">
            <li>Wallet balance: ₦2.4m</li>
            <li>Pending withdrawals: 5</li>
            <li>Active users: 418</li>
          </ul>
        </div>
        <div className="card">
          <h3 className="card-title">Activity Monitoring</h3>
          <p className="text-muted">Track staff and student LAMS activity.</p>
        </div>
        <div className="card card-tone-4">
          <h3 className="card-title">Economy Health</h3>
          <ul className="card-list">
            <li>Reward redemptions: steady</li>
            <li>Farming mode: system-managed</li>
            <li>Alerts: none</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default HOSLAMS;
