import React from 'react';
import GlassCard from '../../components/GlassCard';

const HOSStaff: React.FC = () => {
  return (
    <div className="hos-page">
      <GlassCard title="Staff Management">
        <p className="text-muted">Approve onboarding, manage roles, and track performance.</p>
      </GlassCard>
      <div className="hos-tables">
        <div className="card card-tone-6">
          <h3 className="card-title">Onboarding Queue</h3>
          <ul className="card-list">
            <li>6 staff awaiting approval</li>
            <li>2 background checks pending</li>
            <li>1 contract renewal</li>
          </ul>
        </div>
        <div className="card">
          <h3 className="card-title">Recent Staff Activity</h3>
          <p className="text-muted">Latest submissions and requests from staff.</p>
        </div>
        <div className="card card-tone-5">
          <h3 className="card-title">Discipline & Compliance</h3>
          <ul className="card-list">
            <li>0 active warnings</li>
            <li>2 policy acknowledgements due</li>
            <li>Next audit: 12 days</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default HOSStaff;
