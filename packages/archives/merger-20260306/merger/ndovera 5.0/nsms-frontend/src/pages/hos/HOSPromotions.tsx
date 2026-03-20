import React from 'react';
import GlassCard from '../../components/GlassCard';
import HOSTable from '../../components/hos/HOSTable';

const HOSPromotions: React.FC = () => {
  return (
    <div className="hos-page">
      <GlassCard title="Promotion Governance">
        <p className="text-muted">
          Promotion logic uses cumulative averages with HOS override authority for borderline cases.
        </p>
      </GlassCard>
      <div className="hos-tables">
        <div className="card card-tone-4">
          <h3 className="card-title">Promotion Rules</h3>
          <ul className="card-list">
            <li>Promoted ≥ 55%</li>
            <li>Borderline 45–54%</li>
            <li>Repeat ≤ 44%</li>
          </ul>
        </div>
        <div className="card card-tone-7">
          <h3 className="card-title">Override Queue</h3>
          <ul className="card-list">
            <li>Borderline: 12</li>
            <li>Overrides pending: 4</li>
            <li>Forced promotions: 2</li>
          </ul>
        </div>
        <div className="card">
          <h3 className="card-title">Auto Progression</h3>
          <p className="text-muted">Next session auto-migration scheduled after approvals.</p>
        </div>
      </div>
      <div className="hos-tables">
        <HOSTable title="Promotion Queue" endpoint="/hos/promotions?status=pending" />
        <HOSTable title="Borderline Students" endpoint="/hos/promotions?status=borderline" />
        <HOSTable title="Override History" endpoint="/hos/promotions/audit" />
      </div>
    </div>
  );
};

export default HOSPromotions;
