import React from 'react';
import GlassCard from '../../components/GlassCard';

const HOSSettings: React.FC = () => {
  return (
    <div className="hos-page">
      <GlassCard title="Settings">
        <p className="text-muted">Configure approvals, role policies, and sync preferences.</p>
      </GlassCard>
      <div className="hos-tables">
        <div className="card card-tone-1">
          <h3 className="card-title">Approval Policies</h3>
          <ul className="card-list">
            <li>Require section head endorsement: On</li>
            <li>Auto-lock after approval: On</li>
            <li>Signature enforcement: On</li>
          </ul>
        </div>
        <div className="card">
          <h3 className="card-title">Sync Preferences</h3>
          <p className="text-muted">Configure offline queue and sync frequency.</p>
        </div>
        <div className="card card-tone-6">
          <h3 className="card-title">Role Governance</h3>
          <ul className="card-list">
            <li>Teacher edit window: 7 days</li>
            <li>HOS override: Enabled</li>
            <li>Audit retention: 7 years</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default HOSSettings;
