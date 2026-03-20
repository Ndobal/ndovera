import React from 'react';
import GlassCard from '../../components/GlassCard';
import HOSTable from '../../components/hos/HOSTable';

const HOSCASheets: React.FC = () => {
  return (
    <div className="hos-page">
      <GlassCard title="C.A. Control Panel">
        <p className="text-muted">
          CA sheets lock after HOS approval. Change requests are logged and require explicit approval.
        </p>
      </GlassCard>
      <div className="hos-tables">
        <div className="card card-tone-2">
          <h3 className="card-title">Lock Rules</h3>
          <ul className="card-list">
            <li>Auto-lock on approval</li>
            <li>Change requests logged</li>
            <li>Field-level unlocks only</li>
          </ul>
        </div>
        <div className="card">
          <h3 className="card-title">Change Request Queue</h3>
          <p className="text-muted">Requests needing HOS review.</p>
        </div>
        <div className="card card-tone-5">
          <h3 className="card-title">Approval History</h3>
          <ul className="card-list">
            <li>Approved this term: 18</li>
            <li>Rejected: 2</li>
            <li>Pending: 5</li>
          </ul>
        </div>
      </div>
      <div className="hos-tables">
        <HOSTable title="Pending CA Approvals" endpoint="/hos/ca-sheets?status=pending" />
        <HOSTable title="Locked CA Sheets" endpoint="/hos/ca-sheets?status=locked" />
        <HOSTable title="Change Requests" endpoint="/hos/ca-sheets?status=change-request" />
      </div>
    </div>
  );
};

export default HOSCASheets;
