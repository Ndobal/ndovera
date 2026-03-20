import React from 'react';
import GlassCard from '../../components/GlassCard';
import HOSTable from '../../components/hos/HOSTable';

const HOSLessonNotes: React.FC = () => {
  return (
    <div className="hos-page">
      <GlassCard title="Lesson Governance Panel">
        <p className="text-muted">
          Lesson notes become official only after Head of Section endorsement and HOS approval.
        </p>
      </GlassCard>
      <div className="hos-tables">
        <div className="card card-tone-3">
          <h3 className="card-title">Approval Rules</h3>
          <ul className="card-list">
            <li>Section head endorsement required</li>
            <li>Approval locks content</li>
            <li>Audit trail enabled</li>
          </ul>
        </div>
        <div className="card">
          <h3 className="card-title">Revision Requests</h3>
          <p className="text-muted">Pending teacher revisions and feedback loop.</p>
        </div>
        <div className="card card-tone-6">
          <h3 className="card-title">Audit History</h3>
          <ul className="card-list">
            <li>Locked notes: 42</li>
            <li>Revisions approved: 12</li>
            <li>Last approval: Today</li>
          </ul>
        </div>
      </div>
      <div className="hos-tables">
        <HOSTable title="Pending Lesson Endorsements" endpoint="/hos/lessons?status=pending" />
        <HOSTable title="Approved Lesson Notes" endpoint="/hos/lessons?status=approved" />
        <HOSTable title="Revision Requests" endpoint="/hos/lessons?status=revision" />
      </div>
    </div>
  );
};

export default HOSLessonNotes;
