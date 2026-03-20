import React from 'react';
import GlassCard from '../../components/GlassCard';
import HOSTable from '../../components/hos/HOSTable';

const HOSSignatures: React.FC = () => {
  return (
    <div className="hos-page">
      <GlassCard title="Digital Signatures">
        <p className="text-muted">Manage signature enrollment and verification for academic approvals.</p>
      </GlassCard>
      <div className="hos-tables">
        <div className="card card-tone-7">
          <h3 className="card-title">Signature Coverage</h3>
          <ul className="card-list">
            <li>Teachers signed: 58/64</li>
            <li>Section heads signed: 6/8</li>
            <li>HOS signature: Active</li>
          </ul>
        </div>
        <div className="card">
          <h3 className="card-title">Pending Uploads</h3>
          <p className="text-muted">Users who need to submit signatures.</p>
        </div>
        <div className="card card-tone-3">
          <h3 className="card-title">Verification</h3>
          <ul className="card-list">
            <li>Verification queue: 3</li>
            <li>Failed checks: 0</li>
            <li>Last audit: 5 days ago</li>
          </ul>
        </div>
      </div>
      <div className="hos-tables">
        <HOSTable title="Signature Registry" endpoint="/hos/signatures" />
        <HOSTable title="Pending Signature Uploads" endpoint="/hos/signatures?status=pending" />
        <HOSTable title="Signature Audit" endpoint="/hos/signatures/audit" />
      </div>
    </div>
  );
};

export default HOSSignatures;
