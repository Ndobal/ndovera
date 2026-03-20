import React from 'react';
import GlassCard from '../../components/GlassCard';
import HOSTable from '../../components/hos/HOSTable';

const HOSResults: React.FC = () => {
  return (
    <div className="hos-page">
      <GlassCard title="Results Workflow">
        <p className="text-muted">
          Results require CA approval, exam compilation, endorsements, and HOS final approval before publishing.
        </p>
      </GlassCard>
      <div className="hos-tables">
        <div className="card card-tone-2">
          <h3 className="card-title">Pipeline Status</h3>
          <ul className="card-list">
            <li>CA approved: 18</li>
            <li>Endorsements pending: 6</li>
            <li>HOS approvals pending: 4</li>
          </ul>
        </div>
        <div className="card card-tone-6">
          <h3 className="card-title">Publish Readiness</h3>
          <ul className="card-list">
            <li>Results ready: 5</li>
            <li>Waiting on signatures: 3</li>
            <li>Release window: Friday</li>
          </ul>
        </div>
        <div className="card">
          <h3 className="card-title">Audit Highlights</h3>
          <p className="text-muted">Latest approval trail and lock events.</p>
        </div>
      </div>
      <div className="hos-tables">
        <HOSTable title="Pending Result Approvals" endpoint="/hos/results?status=pending" />
        <HOSTable title="Published Results" endpoint="/hos/results?status=published" />
        <HOSTable title="Result Audit Trail" endpoint="/hos/results/audit" />
      </div>
    </div>
  );
};

export default HOSResults;
