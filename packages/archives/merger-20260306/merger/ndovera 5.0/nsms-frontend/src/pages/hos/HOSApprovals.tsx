import React from 'react';
import GlassCard from '../../components/GlassCard';

const HOSApprovals: React.FC = () => {
  return (
    <div className="hos-page">
      <GlassCard title="Approvals">
        <p className="text-muted">All approval workflows queue here for final HOS sign-off.</p>
        <ul className="text-muted" style={{ listStyle: 'none', paddingLeft: 0, marginTop: '0.75rem' }}>
          <li>• Staff onboarding</li>
          <li>• Teacher onboarding</li>
          <li>• Student admissions</li>
          <li>• Hostel and transport allocations</li>
          <li>• Fee waivers and discipline actions</li>
          <li>• Website publishing, results release</li>
        </ul>
      </GlassCard>
      <div className="hos-tables">
        <div className="card card-tone-5">
          <h3 className="card-title">Pending Approvals</h3>
          <ul className="card-list">
            <li>Admissions: 6</li>
            <li>Staff: 3</li>
            <li>Fee waivers: 2</li>
          </ul>
        </div>
        <div className="card">
          <h3 className="card-title">Approval History</h3>
          <p className="text-muted">Audit trail for completed approvals.</p>
        </div>
        <div className="card card-tone-2">
          <h3 className="card-title">Locked Items</h3>
          <ul className="card-list">
            <li>Lesson notes: 12</li>
            <li>CA sheets: 9</li>
            <li>Results: 4</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default HOSApprovals;
