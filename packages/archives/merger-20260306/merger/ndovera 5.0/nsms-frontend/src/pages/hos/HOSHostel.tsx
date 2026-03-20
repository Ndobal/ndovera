import React from 'react';
import GlassCard from '../../components/GlassCard';

const HOSHostel: React.FC = () => {
  return (
    <div className="hos-page">
      <GlassCard title="Hostel">
        <p className="text-muted">Manage allocations, capacity, and boarding approvals.</p>
      </GlassCard>
      <div className="hos-tables">
        <div className="card card-tone-7">
          <h3 className="card-title">Capacity Overview</h3>
          <ul className="card-list">
            <li>Total beds: 320</li>
            <li>Occupied: 288</li>
            <li>Maintenance holds: 6</li>
          </ul>
        </div>
        <div className="card">
          <h3 className="card-title">Allocation Requests</h3>
          <p className="text-muted">Pending hostel allocations and transfers.</p>
        </div>
        <div className="card card-tone-5">
          <h3 className="card-title">Boarding Compliance</h3>
          <ul className="card-list">
            <li>Safety inspections: complete</li>
            <li>Incident reports: 0</li>
            <li>Next audit: 14 days</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default HOSHostel;
