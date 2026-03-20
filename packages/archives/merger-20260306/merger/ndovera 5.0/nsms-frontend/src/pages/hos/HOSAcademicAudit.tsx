import React from 'react';
import GlassCard from '../../components/GlassCard';
import HOSTable from '../../components/hos/HOSTable';

const HOSAcademicAudit: React.FC = () => {
  return (
    <div className="hos-page">
      <GlassCard title="Academic Audit Log">
        <p className="text-muted">Immutable audit trails for lesson notes, CA approvals, and results.</p>
      </GlassCard>
      <div className="hos-tables">
        <div className="card card-tone-6">
          <h3 className="card-title">Audit Coverage</h3>
          <ul className="card-list">
            <li>Events logged today: 24</li>
            <li>Locked items: 18</li>
            <li>Signature events: 6</li>
          </ul>
        </div>
        <div className="card">
          <h3 className="card-title">Compliance Status</h3>
          <p className="text-muted">All academic locks verified.</p>
        </div>
        <div className="card card-tone-1">
          <h3 className="card-title">Recent Highlights</h3>
          <ul className="card-list">
            <li>Result batch approved (SS2)</li>
            <li>Lesson notes locked (Math)</li>
            <li>CA sheet change approved</li>
          </ul>
        </div>
      </div>
      <div className="hos-tables">
        <HOSTable title="Audit History" endpoint="/hos/audit" />
        <HOSTable title="Lock Events" endpoint="/hos/audit?type=lock" />
        <HOSTable title="Signature Events" endpoint="/hos/audit?type=signature" />
      </div>
    </div>
  );
};

export default HOSAcademicAudit;
